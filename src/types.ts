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

/** A normalized point inside a replacement DOM part: (0,0) top-left, (1,1) bottom-right. */
export interface PartSocket {
  x: number;
  y: number;
}

export interface PartDefinition {
  source: PartSource;
  socket?: Partial<PartSocket>;
}

export type CicadaPart = PartSource | PartDefinition | null;

export interface CicadaParts {
  cicada?: CicadaPart;
  pole?: CicadaPart;
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
