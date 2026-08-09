import { SynthCicadaVoice, type CicadaVoice } from './audio';
import { createPhysics, stepPhysics, type PhysicsOptions, type PhysicsState, type Point } from './physics';
import { DefaultCicadaRenderer } from './renderer';
import type { CicadaParts, CicadaRenderer, MotionState, PartSource } from './types';

export interface BambooCicadaOptions {
  /** Accessible name. The component renders no visible title. */
  label?: string;
  /** Legacy theming hook retained for compatibility. */
  accent?: string;
  sound?: boolean;
  inputGain?: number;
  autoStart?: boolean;
  parts?: CicadaParts;
  voice?: CicadaVoice | (() => CicadaVoice);
  renderer?: CicadaRenderer;
  physics?: Partial<PhysicsOptions>;
}

const WIDTH = 340;
const HEIGHT = 430;
const AUTO_CENTER: Point = { x: 170, y: 150 };
const AUTO_RADIUS = 42;
const TAU = Math.PI * 2;
const HTMLElementBase = (globalThis.HTMLElement ?? class {}) as typeof HTMLElement;

const defaults = {
  label: '可甩动的竹知了',
  accent: '#a72620',
  sound: true,
  inputGain: 1.45,
  autoStart: false,
};

export class BambooCicadaElement extends HTMLElementBase {
  private options: BambooCicadaOptions = { ...defaults };
  private physics: PhysicsState = createPhysics({ x: 170, y: 128 });
  private target: Point = { ...this.physics.anchor };
  private renderer?: CicadaRenderer;
  private voice?: CicadaVoice;
  private ownsVoice = false;
  private pointerId: number | null = null;
  private dragStart: Point = { x: 0, y: 0 };
  private anchorAtDragStart: Point = { x: 0, y: 0 };
  private auto = false;
  private autoPhase = -Math.PI / 2;
  private frame = 0;
  private lastFrame = 0;
  private listening = false;
  private initialized = false;
  private destroyed = false;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.destroyed = false;
    this.readAttributes();
    if (!this.initialized) this.initialize();
    this.attachInput();
    this.render();
    if (this.options.autoStart || this.hasAttribute('auto-start')) this.startAuto();
  }

  disconnectedCallback(): void {
    this.stopLoop();
    this.detachInput();
    this.voice?.silence();
  }

  configure(next: BambooCicadaOptions): this {
    const rendererChanged = 'renderer' in next && next.renderer !== this.options.renderer;
    const voiceChanged = 'voice' in next && next.voice !== this.options.voice;
    const physicsChanged = 'physics' in next && next.physics !== this.options.physics;
    this.options = { ...this.options, ...next, parts: next.parts ?? this.options.parts };
    this.setAttribute('aria-label', this.options.label ?? defaults.label);
    this.style.setProperty('--bc-accent', this.options.accent ?? defaults.accent);
    if (this.initialized && next.parts) this.applyParts(next.parts);

    if (this.initialized && rendererChanged) this.replaceRenderer();
    if (this.initialized && voiceChanged) this.replaceVoice();
    if (physicsChanged) this.resetPhysics();
    if (this.options.sound === false) this.voice?.silence();
    if (this.isConnected && next.autoStart === true) this.startAuto();
    return this;
  }

  get motion(): Readonly<MotionState> {
    return this.motionState();
  }

  setAnchor(x: number, y: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    this.target.x = Math.max(16, Math.min(WIDTH - 16, x));
    this.target.y = Math.max(16, Math.min(HEIGHT - 16, y));
    this.startLoop();
  }

  startAuto(): void {
    this.auto = true;
    this.pointerId = null;
    this.startLoop();
  }

  stopAuto(): void {
    this.auto = false;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stopLoop();
    this.detachInput();
    this.renderer?.destroy();
    if (this.ownsVoice) this.voice?.destroy(); else this.voice?.silence();
    this.renderer = undefined;
    this.voice = undefined;
    this.initialized = false;
    this.remove();
  }

  private initialize(): void {
    this.resetPhysics();
    this.applyParts(this.options.parts ?? {});
    this.renderer = this.options.renderer ?? new DefaultCicadaRenderer();
    this.renderer.mount({ root: this.shadowRoot!, host: this });
    this.createVoice();
    this.initialized = true;
  }

  private readAttributes(): void {
    const label = this.getAttribute('label');
    const accent = this.getAttribute('accent');
    this.options = {
      ...this.options,
      ...(label ? { label } : {}),
      ...(accent ? { accent } : {}),
      ...(this.hasAttribute('muted') ? { sound: false } : {}),
    };
    this.setAttribute('aria-label', this.options.label ?? defaults.label);
    this.style.setProperty('--bc-accent', this.options.accent ?? defaults.accent);
  }

  private resetPhysics(): void {
    this.physics = createPhysics({ x: 170, y: 128 }, this.options.physics);
    this.target = { ...this.physics.anchor };
    this.render();
  }

  private replaceRenderer(): void {
    this.detachInput();
    this.renderer?.destroy();
    this.renderer = this.options.renderer ?? new DefaultCicadaRenderer();
    this.renderer.mount({ root: this.shadowRoot!, host: this });
    this.attachInput();
    this.render();
  }

  private replaceVoice(): void {
    if (this.ownsVoice) this.voice?.destroy(); else this.voice?.silence();
    this.createVoice();
  }

  private createVoice(): void {
    const source = this.options.voice;
    if (typeof source === 'function') {
      this.voice = source();
      this.ownsVoice = true;
    } else if (source) {
      this.voice = source;
      this.ownsVoice = false;
    } else {
      this.voice = new SynthCicadaVoice();
      this.ownsVoice = true;
    }
  }

  private applyParts(parts: CicadaParts): void {
    if (parts.cicada) this.installPart('cicada', parts.cicada);
    if (parts.pole) this.installPart('pole', parts.pole);
  }

  private installPart(slot: 'cicada' | 'pole', source: PartSource): void {
    this.querySelector(`[slot="${slot}"][data-bc-managed]`)?.remove();
    const element = typeof source === 'function' ? source() : source;
    element.setAttribute('slot', slot);
    element.setAttribute('data-bc-managed', 'true');
    this.append(element);
  }

  private attachInput(): void {
    if (this.listening) return;
    const target = this.renderer?.interactionTarget ?? this;
    target.addEventListener('pointerdown', this.onPointerDown);
    target.addEventListener('pointermove', this.onPointerMove);
    target.addEventListener('pointerup', this.onPointerUp);
    target.addEventListener('pointercancel', this.onPointerUp);
    this.listening = true;
  }

  private detachInput(): void {
    if (!this.listening) return;
    const target = this.renderer?.interactionTarget ?? this;
    target.removeEventListener('pointerdown', this.onPointerDown);
    target.removeEventListener('pointermove', this.onPointerMove);
    target.removeEventListener('pointerup', this.onPointerUp);
    target.removeEventListener('pointercancel', this.onPointerUp);
    this.listening = false;
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (this.pointerId !== null) return;
    this.stopAuto();
    this.pointerId = event.pointerId;
    const point = this.pointerPoint(event);
    this.dragStart = point;
    this.anchorAtDragStart = { ...this.physics.anchor };
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    this.startLoop();
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) return;
    const point = this.pointerPoint(event);
    const configuredGain = this.options.inputGain ?? defaults.inputGain;
    const gain = Number.isFinite(configuredGain) ? Math.max(0.1, Math.min(4, configuredGain)) : defaults.inputGain;
    this.setAnchor(
      this.anchorAtDragStart.x + (point.x - this.dragStart.x) * gain,
      this.anchorAtDragStart.y + (point.y - this.dragStart.y) * gain,
    );
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) return;
    this.pointerId = null;
    (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
  };

  private pointerPoint(event: PointerEvent): Point {
    const rect = this.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / Math.max(1, rect.width) * WIDTH,
      y: (event.clientY - rect.top) / Math.max(1, rect.height) * HEIGHT,
    };
  }

  private startLoop(): void {
    if (this.frame || typeof requestAnimationFrame === 'undefined') return;
    this.lastFrame = performance.now();
    this.frame = requestAnimationFrame(this.tick);
  }

  private stopLoop(): void {
    if (this.frame && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  private readonly tick = (time: number): void => {
    const elapsed = Math.min(0.05, Math.max(0, (time - this.lastFrame) / 1000));
    this.lastFrame = time;
    if (this.auto) {
      this.autoPhase += 2.75 * TAU * elapsed;
      this.target.x = AUTO_CENTER.x + Math.cos(this.autoPhase) * AUTO_RADIUS;
      this.target.y = AUTO_CENTER.y + Math.sin(this.autoPhase) * AUTO_RADIUS;
    }

    const follow = 1 - Math.exp(-elapsed * 25);
    this.physics.anchor.x += (this.target.x - this.physics.anchor.x) * follow;
    this.physics.anchor.y += (this.target.y - this.physics.anchor.y) * follow;
    stepPhysics(this.physics, elapsed);
    this.render();

    const bodySpeed = Math.hypot(this.physics.body.vx, this.physics.body.vy);
    const moving = this.auto || this.pointerId !== null || bodySpeed > 0.8 || this.physics.activity > 0.01;
    if (moving) this.frame = requestAnimationFrame(this.tick);
    else {
      this.frame = 0;
      this.voice?.silence();
    }
  };

  private motionState(): MotionState {
    return {
      time: this.physics.time,
      anchor: this.physics.anchor,
      body: this.physics.body,
      rope: this.physics.rope,
      activity: this.physics.activity,
      dragging: this.pointerId !== null,
      auto: this.auto,
    };
  }

  private render(): void {
    if (!this.renderer) return;
    const state = this.motionState();
    this.renderer.render(state);
    if (this.options.sound !== false) this.voice?.update(state);
  }
}
