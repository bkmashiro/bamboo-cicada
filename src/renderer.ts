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
      <div class="scene" part="surface" role="button" tabindex="0" aria-label="可甩动的竹知了">
        <svg class="cord-layer" viewBox="0 0 340 430" aria-hidden="true">
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
    const hostRect = (this.root?.host as HTMLElement | undefined)?.getBoundingClientRect();
    const hostWidth = Math.max(1, hostRect?.width || window.innerWidth || 340);
    const hostHeight = Math.max(1, hostRect?.height || window.innerHeight || 430);
    const bodyAngle = rope.angle * 180 / Math.PI - 90;
    const poleLean = Math.max(-8, Math.min(8, (anchor.x - hostWidth * 0.72) * 0.02));
    this.pole?.style.setProperty('transform', `translate3d(${anchor.x}px, ${anchor.y}px, 0) rotate(${poleLean}deg)`);
    this.cicada?.style.setProperty('transform', `translate3d(${body.x}px, ${body.y}px, 0) rotate(${bodyAngle}deg)`);

    if (this.cord) {
      this.cord.ownerSVGElement?.setAttribute('viewBox', `0 0 ${hostWidth} ${hostHeight}`);
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
