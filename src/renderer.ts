import { floatingStyles } from './styles';
import type { CicadaRenderer, MotionState, RendererMountContext } from './types';

export class DefaultCicadaRenderer implements CicadaRenderer {
  interactionTarget?: HTMLElement;
  private root?: ShadowRoot;
  private scene?: HTMLElement;
  private cord?: SVGPathElement;
  private pole?: HTMLElement;
  private cicada?: HTMLElement;

  mount({ root }: RendererMountContext): void {
    this.root = root;
    root.innerHTML = `<style>${floatingStyles}</style>
      <div class="scene" part="surface" role="application" aria-label="可甩动的竹知了">
        <svg class="cord-layer" viewBox="0 0 340 430" preserveAspectRatio="none" aria-hidden="true">
          <path class="cord" part="cord" />
        </svg>
        <div class="part pole" part="pole">
          <slot name="pole">
            <div class="default-pole" aria-hidden="true">
              <span class="bead top"></span><span class="bead lower"></span>
            </div>
          </slot>
        </div>
        <div class="part cicada" part="cicada">
          <slot name="cicada">
            <div class="default-cicada" aria-hidden="true">
              <span class="wing left"></span><span class="wing right"></span>
              <span class="tube"></span><span class="rim"></span>
              <span class="eye left"></span><span class="eye right"></span>
            </div>
          </slot>
        </div>
      </div>`;
    this.scene = root.querySelector<HTMLElement>('.scene') ?? undefined;
    this.cord = root.querySelector<SVGPathElement>('.cord') ?? undefined;
    this.pole = root.querySelector<HTMLElement>('.pole') ?? undefined;
    this.cicada = root.querySelector<HTMLElement>('.cicada') ?? undefined;
    this.interactionTarget = this.scene;
  }

  render(state: Readonly<MotionState>): void {
    const { anchor, body, rope } = state;
    const hostWidth = (this.root?.host as HTMLElement | undefined)?.getBoundingClientRect().width || 340;
    const scale = hostWidth / 340;
    const bodyAngle = rope.angle * 180 / Math.PI - 90;
    const poleLean = Math.max(-8, Math.min(8, (anchor.x - 170) * 0.035));
    this.pole?.style.setProperty('transform', `translate3d(${anchor.x * scale}px, ${anchor.y * scale}px, 0) rotate(${poleLean}deg) scale(${scale})`);
    this.cicada?.style.setProperty('transform', `translate3d(${body.x * scale}px, ${body.y * scale}px, 0) rotate(${bodyAngle}deg) scale(${scale})`);

    if (this.cord) {
      const slack = Math.max(0, rope.length - rope.distance);
      const midX = (anchor.x + body.x) / 2;
      const midY = (anchor.y + body.y) / 2 + slack * 0.42;
      this.cord.setAttribute('d', `M ${anchor.x.toFixed(2)} ${anchor.y.toFixed(2)} Q ${midX.toFixed(2)} ${midY.toFixed(2)} ${body.x.toFixed(2)} ${body.y.toFixed(2)}`);
    }
    if (this.scene) this.scene.dataset.active = String(state.activity > 0.12);
  }

  destroy(): void {
    this.root?.replaceChildren();
    this.root = undefined;
    this.scene = undefined;
    this.cord = undefined;
    this.pole = undefined;
    this.cicada = undefined;
    this.interactionTarget = undefined;
  }
}
