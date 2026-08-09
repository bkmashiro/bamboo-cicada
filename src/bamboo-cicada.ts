import { CicadaVoice, type SoundVoice } from './audio';
import { angularVelocity, damp, soundLevel } from './physics';
import { styles } from './styles';

export interface BambooCicadaOptions {
  label?: string;
  accent?: string;
  sound?: boolean;
  autoStart?: boolean;
}

const CENTER_X = 160;
const CENTER_Y = 162;
const RADIUS = 94;
const HTMLElementBase = (globalThis.HTMLElement ?? class {}) as typeof HTMLElement;

export class BambooCicadaElement extends HTMLElementBase {
  private options: Required<BambooCicadaOptions> = {
    label: '竹知了',
    accent: '#d86f45',
    sound: true,
    autoStart: false,
  };
  private readonly voice: SoundVoice = new CicadaVoice();
  private angle = Math.PI / 2;
  private speed = 0;
  private pointerId: number | null = null;
  private previousPointerAngle = 0;
  private previousPointerTime = 0;
  private auto = false;
  private frame = 0;
  private lastFrame = 0;
  private destroyed = false;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' }).innerHTML = this.template();
  }

  connectedCallback(): void {
    this.destroyed = false;
    const label = this.getAttribute('label');
    const accent = this.getAttribute('accent');
    this.configure({
      ...(label ? { label } : {}),
      ...(accent ? { accent } : {}),
    });
    this.stage.addEventListener('pointerdown', this.onPointerDown);
    this.stage.addEventListener('pointermove', this.onPointerMove);
    this.stage.addEventListener('pointerup', this.onPointerUp);
    this.stage.addEventListener('pointercancel', this.onPointerUp);
    this.autoButton.addEventListener('click', this.onAutoClick);
    this.render();
    if (this.options.autoStart) this.startAuto();
  }

  disconnectedCallback(): void {
    this.stopLoop();
    this.voice.silence();
    this.stage.removeEventListener('pointerdown', this.onPointerDown);
    this.stage.removeEventListener('pointermove', this.onPointerMove);
    this.stage.removeEventListener('pointerup', this.onPointerUp);
    this.stage.removeEventListener('pointercancel', this.onPointerUp);
    this.autoButton.removeEventListener('click', this.onAutoClick);
  }

  configure(options: BambooCicadaOptions): this {
    this.options = { ...this.options, ...options };
    this.style.setProperty('--bc-accent', this.options.accent);
    const label = this.shadowRoot?.querySelector<HTMLElement>('.label');
    if (label) label.textContent = this.options.label;
    if (!this.options.sound) this.voice.silence();
    return this;
  }

  startAuto(): void {
    this.auto = true;
    this.speed = 8.6;
    this.autoButton.setAttribute('aria-pressed', 'true');
    this.autoButton.setAttribute('aria-label', '停止自动旋转');
    this.startLoop();
  }

  stopAuto(): void {
    this.auto = false;
    this.autoButton.setAttribute('aria-pressed', 'false');
    this.autoButton.setAttribute('aria-label', '自动旋转');
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stopLoop();
    this.voice.destroy();
    this.remove();
  }

  private get stage(): HTMLElement {
    return this.shadowRoot!.querySelector<HTMLElement>('.toy')!;
  }

  private get autoButton(): HTMLButtonElement {
    return this.shadowRoot!.querySelector<HTMLButtonElement>('button')!;
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if ((event.target as Element).closest('button')) return;
    this.stopAuto();
    this.pointerId = event.pointerId;
    this.stage.setPointerCapture?.(event.pointerId);
    const angle = this.pointerAngle(event);
    this.previousPointerAngle = angle;
    this.previousPointerTime = event.timeStamp;
    this.angle = angle;
    this.speed = 0;
    this.render();
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) return;
    const nextAngle = this.pointerAngle(event);
    const elapsed = (event.timeStamp - this.previousPointerTime) / 1000;
    const measured = angularVelocity(this.previousPointerAngle, nextAngle, elapsed);
    this.speed = this.speed * 0.35 + measured * 0.65;
    this.angle = nextAngle;
    this.previousPointerAngle = nextAngle;
    this.previousPointerTime = event.timeStamp;
    this.updateSound();
    this.render();
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.stage.releasePointerCapture?.(event.pointerId);
    this.startLoop();
  };

  private readonly onAutoClick = (event: MouseEvent): void => {
    event.stopPropagation();
    if (this.auto) this.stopAuto(); else this.startAuto();
  };

  private pointerAngle(event: PointerEvent): number {
    const rect = this.stage.getBoundingClientRect();
    const x = (event.clientX - rect.left) / Math.max(1, rect.width) * 320;
    const y = (event.clientY - rect.top) / Math.max(1, rect.height) * 400;
    return Math.atan2(y - CENTER_Y, x - CENTER_X);
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
      this.speed += (8.6 - this.speed) * Math.min(1, elapsed * 5);
    } else if (this.pointerId === null) {
      this.speed = damp(this.speed, elapsed);
    }
    this.angle += this.speed * elapsed;
    this.updateSound();
    this.render();

    if (this.auto || this.pointerId !== null || Math.abs(this.speed) > 0.08) {
      this.frame = requestAnimationFrame(this.tick);
    } else {
      this.frame = 0;
      this.speed = 0;
      this.voice.silence();
      this.render();
    }
  };

  private updateSound(): void {
    const level = soundLevel(this.speed, 4.5);
    if (this.options.sound) this.voice.setMotion(this.speed, level);
  }

  private render(): void {
    const x = CENTER_X + Math.cos(this.angle) * RADIUS;
    const y = CENTER_Y + Math.sin(this.angle) * RADIUS;
    const root = this.shadowRoot;
    root?.querySelector<SVGLineElement>('.cord')?.setAttribute('x2', x.toFixed(2));
    root?.querySelector<SVGLineElement>('.cord')?.setAttribute('y2', y.toFixed(2));
    root?.querySelector<SVGGElement>('.bug')?.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${(this.angle * 180 / Math.PI + 90).toFixed(2)})`);
    const turns = Math.abs(this.speed) / (Math.PI * 2);
    const active = turns > 0.7;
    this.stage.dataset.active = String(active);
    const readout = root?.querySelector<HTMLElement>('.speed');
    if (readout) readout.textContent = `${turns.toFixed(1)} 圈/秒`;
  }

  private template(): string {
    return `<style>${styles}</style>
      <section class="toy" role="application" aria-label="可玩的竹知了；按住并绕圈拖动">
        <div class="topline"><span class="label">竹知了</span><span class="speed" aria-live="polite">0.0 圈/秒</span></div>
        <svg viewBox="0 0 320 400" aria-hidden="true">
          <path class="motion" d="M55 166 A106 106 0 0 1 248 98" />
          <line class="cord" x1="160" y1="162" x2="160" y2="256" />
          <g>
            <rect class="handle" x="145" y="62" width="30" height="101" rx="14" />
            <path class="handle-shine" d="M154 78 V137" />
            <circle class="hub" cx="160" cy="162" r="8" />
          </g>
          <g class="bug" transform="translate(160 256)">
            <ellipse class="wing" cx="-13" cy="-2" rx="14" ry="7" transform="rotate(-25)" />
            <ellipse class="wing" cx="13" cy="-2" rx="14" ry="7" transform="rotate(25)" />
            <rect class="bug-body" x="-13" y="-19" width="26" height="39" rx="12" />
            <path class="bug-belly" d="M-9 4 Q0 12 9 4 V12 Q0 21 -9 12Z" />
            <circle class="eye" cx="-5" cy="-10" r="2" /><circle class="eye" cx="5" cy="-10" r="2" />
          </g>
        </svg>
        <button type="button" aria-label="自动旋转" aria-pressed="false">↻</button>
        <p class="hint">按住画圈甩起来 · 转得越快，叫得越响</p>
      </section>`;
  }
}
