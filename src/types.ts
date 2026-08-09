import type { BodyPoint, Point, RopeState } from './physics';

export interface MotionState {
  readonly time: number;
  readonly anchor: Readonly<Point>;
  readonly body: Readonly<BodyPoint>;
  readonly rope: Readonly<RopeState>;
  readonly activity: number;
  readonly dragging: boolean;
  readonly auto: boolean;
}

export type PartSource = Element | (() => Element);

export interface CicadaParts {
  cicada?: PartSource;
  pole?: PartSource;
}

export interface RendererMountContext {
  root: ShadowRoot;
  host: HTMLElement;
}

export interface CicadaRenderer {
  mount(context: RendererMountContext): void;
  render(state: Readonly<MotionState>): void;
  destroy(): void;
  interactionTarget?: HTMLElement;
}
