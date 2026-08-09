import type { BodyPoint, Point, RopeState } from './physics';

export interface MotionState {
  time: number;
  anchor: Point;
  body: BodyPoint;
  rope: RopeState;
  activity: number;
  dragging: boolean;
  auto: boolean;
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
