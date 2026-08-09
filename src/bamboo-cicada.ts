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
  renderer?: CicadaRenderer | (() => CicadaRenderer);
  physics?: Partial<PhysicsOptions>;
}

const FALLBACK_WIDTH = 340;
const FALLBACK_HEIGHT = 430;
const AUTO_RADIUS = 58;
const AUTO_TURNS_PER_SECOND = 2.367;
const AUTO_COMPACT_RADIUS = 44;
const AUTO_COMPACT_TURNS_PER_SECOND = 1.9;
const AUTO_FOLLOW_RATE = 35;
const AUTO_KICK_TURNS_PER_SECOND = 1.15;
const AUTO_ASSIST_RATE = 4;
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
  private viewport = { width: FALLBACK_WIDTH, height: FALLBACK_HEIGHT };
  private physics: PhysicsState = createPhysics({ x: 260, y: 128 });
  private target: Point = { ...this.physics.anchor };
  private renderer?: CicadaRenderer;
  private voice?: CicadaVoice;
  private ownsRenderer = false;
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
    window.addEventListener('resize', this.onResize, { passive: true });
    this.onResize();
    this.syncAccessibility();
    this.render();
    if (this.auto) this.startLoop();
    else if (this.options.autoStart || this.hasAttribute('auto-start')) this.startAuto();
  }

  disconnectedCallback(): void {
    this.stopLoop();
    this.clearPointer();
    this.detachInput();
    window.removeEventListener('resize', this.onResize);
    this.voice?.silence();
  }

  configure(next: BambooCicadaOptions): this {
    const rendererChanged = 'renderer' in next && next.renderer !== this.options.renderer;
    const voiceChanged = 'voice' in next && next.voice !== this.options.voice;
    const physicsChanged = 'physics' in next && next.physics !== this.options.physics;
    this.options = { ...this.options, ...next, parts: next.parts ?? this.options.parts };
    this.setAttribute('aria-label', this.options.label ?? defaults.label);
    this.style.setProperty('--bc-accent', this.options.accent ?? defaults.accent);
    this.syncAccessibility();
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
    this.target.x = Math.max(52, Math.min(this.viewport.width - 52, x));
    this.target.y = Math.max(20, Math.min(this.viewport.height - 160, y));
    this.startLoop();
  }

  startAuto(): void {
    const starting = !this.auto;
    this.auto = true;
    this.clearPointer();
    if (starting && Math.abs(this.physics.rope.angularVelocity) < TAU * 0.5) {
      const angle = Number.isFinite(this.physics.rope.angle) ? this.physics.rope.angle : Math.PI / 2;
      const kickSpeed = this.physics.rope.length * TAU * AUTO_KICK_TURNS_PER_SECOND;
      this.physics.body.vx += -Math.sin(angle) * kickSpeed;
      this.physics.body.vy += Math.cos(angle) * kickSpeed;
    }
    if (this.options.sound !== false) void this.voice?.unlock?.();
    this.startLoop();
  }

  stopAuto(): void {
    this.auto = false;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stopLoop();
    this.clearPointer();
    this.detachInput();
    if (this.ownsRenderer) this.renderer?.destroy();
    if (this.ownsVoice) this.voice?.destroy(); else this.voice?.silence();
    this.renderer = undefined;
    this.voice = undefined;
    this.initialized = false;
    this.remove();
  }

  private initialize(): void {
    this.resetPhysics();
    this.applyParts(this.options.parts ?? {});
    this.createRenderer();
    this.renderer!.mount({ root: this.shadowRoot!, host: this });
    this.createVoice();
    this.initialized = true;
    this.syncAccessibility();
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
    this.viewport = this.measureViewport();
    const anchor = this.defaultAnchor();
    this.physics = createPhysics(anchor, this.options.physics);
    const restY = Math.min(anchor.y + this.physics.rope.length, this.maxBodyY());
    const restDistance = Math.max(0, restY - anchor.y);
    this.physics.body.x = anchor.x;
    this.physics.body.y = restY;
    this.physics.body.vx = 0;
    this.physics.body.vy = 0;
    this.physics.rope.distance = restDistance;
    this.physics.rope.tension = 0;
    this.physics.rope.angle = Math.PI / 2;
    this.physics.rope.angularVelocity = 0;
    this.physics.activity = 0;
    this.target = { ...anchor };
    this.render();
  }

  private replaceRenderer(): void {
    this.clearPointer();
    this.detachInput();
    if (this.ownsRenderer) this.renderer?.destroy();
    this.createRenderer();
    this.renderer!.mount({ root: this.shadowRoot!, host: this });
    this.attachInput();
    this.syncAccessibility();
    this.render();
  }

  private createRenderer(): void {
    const source = this.options.renderer;
    if (typeof source === 'function') {
      this.renderer = source();
      this.ownsRenderer = true;
    } else if (source) {
      this.renderer = source;
      this.ownsRenderer = false;
    } else {
      this.renderer = new DefaultCicadaRenderer();
      this.ownsRenderer = true;
    }
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
    const element = typeof source === 'function' ? source() : source;
    this.querySelectorAll(`[slot="${slot}"]`).forEach((existing) => {
      if (existing !== element) existing.remove();
    });
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
    target.addEventListener('lostpointercapture', this.onLostPointerCapture);
    target.addEventListener('keydown', this.onKeyDown);
    this.listening = true;
  }

  private detachInput(): void {
    if (!this.listening) return;
    const target = this.renderer?.interactionTarget ?? this;
    target.removeEventListener('pointerdown', this.onPointerDown);
    target.removeEventListener('pointermove', this.onPointerMove);
    target.removeEventListener('pointerup', this.onPointerUp);
    target.removeEventListener('pointercancel', this.onPointerUp);
    target.removeEventListener('lostpointercapture', this.onLostPointerCapture);
    target.removeEventListener('keydown', this.onKeyDown);
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
    if (this.options.sound !== false) void this.voice?.unlock?.();
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
    this.clearPointer(event.currentTarget as HTMLElement);
  };

  private readonly onLostPointerCapture = (event: PointerEvent): void => {
    if (event.pointerId === this.pointerId) this.pointerId = null;
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    if (this.auto) this.stopAuto(); else this.startAuto();
  };

  private clearPointer(target = this.renderer?.interactionTarget ?? this): void {
    if (this.pointerId === null) return;
    const pointerId = this.pointerId;
    this.pointerId = null;
    try { target.releasePointerCapture?.(pointerId); } catch { /* capture already released */ }
  }

  private syncAccessibility(): void {
    const target = this.renderer?.interactionTarget;
    if (!target) return;
    target.setAttribute('aria-label', this.options.label ?? defaults.label);
    if (!target.hasAttribute('role')) target.setAttribute('role', 'button');
    if (!target.hasAttribute('tabindex')) target.tabIndex = 0;
  }

  private pointerPoint(event: PointerEvent): Point {
    const rect = this.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  private measureViewport(): { width: number; height: number } {
    const rect = this.getBoundingClientRect();
    return {
      width: Math.max(320, rect.width || window.innerWidth || FALLBACK_WIDTH),
      height: Math.max(360, rect.height || window.innerHeight || FALLBACK_HEIGHT),
    };
  }

  private defaultAnchor(): Point {
    const compact = this.viewport.width < 640;
    return {
      x: compact
        ? Math.min(this.viewport.width - 72, Math.max(210, this.viewport.width * 0.72))
        : Math.min(this.viewport.width - 90, Math.max(210, this.viewport.width * 0.52)),
      y: compact
        ? Math.min(this.viewport.height - 180, Math.max(270, this.viewport.height * 0.34))
        : Math.min(this.viewport.height - 180, Math.max(120, this.viewport.height * 0.25)),
    };
  }

  private readonly onResize = (): void => {
    this.viewport = this.measureViewport();
    this.setAnchor(this.target.x, this.target.y);
    this.physics.anchor.x = Math.max(52, Math.min(this.viewport.width - 52, this.physics.anchor.x));
    this.physics.anchor.y = Math.max(20, Math.min(this.viewport.height - 160, this.physics.anchor.y));
    this.render();
  };

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
      const compact = this.viewport.width < 640;
      const turnsPerSecond = compact ? AUTO_COMPACT_TURNS_PER_SECOND : AUTO_TURNS_PER_SECOND;
      const radius = compact ? AUTO_COMPACT_RADIUS : AUTO_RADIUS;
      this.autoPhase += turnsPerSecond * TAU * elapsed;
      const center = this.defaultAnchor();
      if (compact) center.x = this.viewport.width / 2;
      this.target.x = center.x + Math.cos(this.autoPhase) * radius;
      this.target.y = center.y + Math.sin(this.autoPhase) * radius;
    }

    const follow = 1 - Math.exp(-elapsed * (this.auto ? AUTO_FOLLOW_RATE : 25));
    this.physics.anchor.x += (this.target.x - this.physics.anchor.x) * follow;
    this.physics.anchor.y += (this.target.y - this.physics.anchor.y) * follow;
    if (this.auto) this.assistAutoDrive(elapsed);
    stepPhysics(this.physics, elapsed);
    this.constrainBodyToViewport();
    const settled = this.settleIfReady();
    this.render();

    if (!settled) this.frame = requestAnimationFrame(this.tick);
    else {
      this.frame = 0;
      this.voice?.silence();
    }
  };

  private assistAutoDrive(elapsed: number): void {
    const dx = this.physics.body.x - this.physics.anchor.x;
    const dy = this.physics.body.y - this.physics.anchor.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const tangentX = -dy / distance;
    const tangentY = dx / distance;
    const currentTangential = this.physics.body.vx * tangentX + this.physics.body.vy * tangentY;
    const compact = this.viewport.width < 640;
    const turnsPerSecond = compact ? AUTO_COMPACT_TURNS_PER_SECOND : AUTO_TURNS_PER_SECOND;
    const targetTangential = this.physics.rope.length * TAU * turnsPerSecond;
    if (currentTangential >= targetTangential) return;
    const assist = (targetTangential - currentTangential) * (1 - Math.exp(-elapsed * AUTO_ASSIST_RATE));
    this.physics.body.vx += tangentX * assist;
    this.physics.body.vy += tangentY * assist;
  }

  private constrainBodyToViewport(): void {
    const body = this.physics.body;
    const minX = 52;
    const maxX = Math.max(minX, this.viewport.width - 52);
    const minY = 34;
    const maxY = this.maxBodyY();
    let collided = false;
    if (body.x < minX) { body.x = minX; body.vx = Math.abs(body.vx) * 0.28; collided = true; }
    if (body.x > maxX) { body.x = maxX; body.vx = -Math.abs(body.vx) * 0.28; collided = true; }
    if (body.y < minY) { body.y = minY; body.vy = Math.abs(body.vy) * 0.28; collided = true; }
    if (body.y > maxY) { body.y = maxY; body.vy = -Math.abs(body.vy) * 0.28; collided = true; }
    if (collided) stepPhysics(this.physics, 0);
  }

  private settleIfReady(): boolean {
    if (this.auto || this.pointerId !== null) return false;
    const bodySpeed = Math.hypot(this.physics.body.vx, this.physics.body.vy);
    const anchorError = Math.hypot(
      this.target.x - this.physics.anchor.x,
      this.target.y - this.physics.anchor.y,
    );
    const verticalDelta = this.physics.rope.angle - Math.PI / 2;
    const verticalError = Math.abs(Math.atan2(Math.sin(verticalDelta), Math.cos(verticalDelta)));
    const restY = Math.min(this.target.y + this.physics.rope.length, this.maxBodyY());
    const restDistance = Math.max(0, restY - this.target.y);
    const distanceError = Math.abs(this.physics.rope.distance - restDistance);
    const bottomSupported = restDistance < this.physics.rope.length - 0.5
      && this.physics.body.y >= this.maxBodyY() - 0.5;
    const geometryReady = bottomSupported || (verticalError <= 0.025 && distanceError <= 0.75);
    const speedLimit = bottomSupported ? 3 : 2;
    if (bodySpeed > speedLimit || anchorError > 0.25 || !geometryReady) return false;

    this.physics.anchor.x = this.target.x;
    this.physics.anchor.y = this.target.y;
    this.physics.body.x = this.target.x;
    this.physics.body.y = restY;
    this.physics.body.vx = 0;
    this.physics.body.vy = 0;
    this.physics.rope.distance = restDistance;
    this.physics.rope.tension = 0;
    this.physics.rope.angle = Math.PI / 2;
    this.physics.rope.angularVelocity = 0;
    this.physics.activity = 0;
    return true;
  }

  private maxBodyY(): number {
    return Math.max(34, this.viewport.height - 64);
  }

  private motionState(): MotionState {
    return {
      time: this.physics.time,
      anchor: { ...this.physics.anchor },
      body: { ...this.physics.body },
      rope: { ...this.physics.rope },
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
