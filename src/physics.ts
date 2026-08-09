export interface Point {
  x: number;
  y: number;
}

export interface BodyPoint extends Point {
  vx: number;
  vy: number;
}

export interface RopeState {
  length: number;
  distance: number;
  tension: number;
  angle: number;
  angularVelocity: number;
}

export interface PhysicsOptions {
  ropeLength: number;
  stiffness: number;
  radialDamping: number;
  gravity: number;
  airDrag: number;
  fixedStep: number;
}

export interface PhysicsState {
  anchor: Point;
  body: BodyPoint;
  rope: RopeState;
  activity: number;
  options: PhysicsOptions;
  time: number;
  previousAngle: number;
}

export const defaultPhysicsOptions: PhysicsOptions = {
  ropeLength: 116,
  stiffness: 2200,
  radialDamping: 15,
  gravity: 720,
  airDrag: 0.72,
  fixedStep: 1 / 240,
};

const TAU = Math.PI * 2;
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const finiteInRange = (value: number | undefined, fallback: number, min: number, max: number): number =>
  Number.isFinite(value) ? clamp(value as number, min, max) : fallback;

export function createPhysics(anchor: Point, overrides: Partial<PhysicsOptions> = {}): PhysicsState {
  const options: PhysicsOptions = {
    ropeLength: finiteInRange(overrides.ropeLength, defaultPhysicsOptions.ropeLength, 24, 320),
    stiffness: finiteInRange(overrides.stiffness, defaultPhysicsOptions.stiffness, 50, 12_000),
    radialDamping: finiteInRange(overrides.radialDamping, defaultPhysicsOptions.radialDamping, 0, 240),
    gravity: finiteInRange(overrides.gravity, defaultPhysicsOptions.gravity, -3_000, 3_000),
    airDrag: finiteInRange(overrides.airDrag, defaultPhysicsOptions.airDrag, 0, 20),
    fixedStep: finiteInRange(overrides.fixedStep, defaultPhysicsOptions.fixedStep, 1 / 2_000, 1 / 30),
  };
  const safeAnchor = {
    x: Number.isFinite(anchor.x) ? anchor.x : 170,
    y: Number.isFinite(anchor.y) ? anchor.y : 128,
  };
  const initialDistance = options.ropeLength * 0.92;
  const body = {
    x: safeAnchor.x - initialDistance * 0.58,
    y: safeAnchor.y + initialDistance * 0.815,
    vx: 0,
    vy: 0,
  };
  const angle = Math.atan2(body.y - safeAnchor.y, body.x - safeAnchor.x);
  return {
    anchor: safeAnchor,
    body,
    rope: {
      length: options.ropeLength,
      distance: Math.hypot(body.x - anchor.x, body.y - anchor.y),
      tension: 0,
      angle,
      angularVelocity: 0,
    },
    activity: 0,
    options,
    time: 0,
    previousAngle: angle,
  };
}

function shortestAngle(delta: number): number {
  while (delta > Math.PI) delta -= TAU;
  while (delta < -Math.PI) delta += TAU;
  return delta;
}

function substep(state: PhysicsState, elapsed: number): void {
  const { body, anchor, options } = state;
  const dx = body.x - anchor.x;
  const dy = body.y - anchor.y;
  const distance = Math.max(1e-6, Math.hypot(dx, dy));
  const ux = dx / distance;
  const uy = dy / distance;
  const radialVelocity = body.vx * ux + body.vy * uy;
  const stretch = Math.max(0, distance - options.ropeLength);
  const tension = stretch > 0
    ? Math.max(0, options.stiffness * stretch + options.radialDamping * radialVelocity)
    : 0;

  let ax = -options.airDrag * body.vx;
  let ay = options.gravity - options.airDrag * body.vy;
  if (tension > 0) {
    ax -= tension * ux;
    ay -= tension * uy;
  }

  body.vx += ax * elapsed;
  body.vy += ay * elapsed;
  body.x += body.vx * elapsed;
  body.y += body.vy * elapsed;

  // A safety projection prevents tab stalls from injecting unbounded spring energy.
  const nextDx = body.x - anchor.x;
  const nextDy = body.y - anchor.y;
  const nextDistance = Math.max(1e-6, Math.hypot(nextDx, nextDy));
  const maxDistance = options.ropeLength * 1.32;
  if (nextDistance > maxDistance) {
    const nx = nextDx / nextDistance;
    const ny = nextDy / nextDistance;
    body.x = anchor.x + nx * maxDistance;
    body.y = anchor.y + ny * maxDistance;
    const outward = body.vx * nx + body.vy * ny;
    if (outward > 0) {
      body.vx -= outward * nx;
      body.vy -= outward * ny;
    }
  }
}

export function stepPhysics(state: PhysicsState, elapsedSeconds: number): PhysicsState {
  const elapsed = clamp(elapsedSeconds, 0, 0.1);
  let remaining = elapsed;
  while (remaining > 1e-8) {
    const step = Math.min(state.options.fixedStep, remaining);
    substep(state, step);
    remaining -= step;
  }

  const dx = state.body.x - state.anchor.x;
  const dy = state.body.y - state.anchor.y;
  const distance = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);
  const measured = elapsed > 0 ? shortestAngle(angle - state.previousAngle) / elapsed : 0;
  state.rope.angularVelocity += (measured - state.rope.angularVelocity) * Math.min(1, elapsed * 11);
  state.previousAngle = angle;
  state.rope.angle = angle;
  state.rope.distance = distance;
  state.rope.tension = Math.max(0, distance - state.options.ropeLength) * state.options.stiffness;

  const turns = Math.abs(state.rope.angularVelocity) / TAU;
  const tautness = clamp((distance / state.options.ropeLength - 0.84) / 0.16, 0, 1);
  const targetActivity = Math.pow(clamp((turns - 0.45) / 1.8, 0, 1), 1.2) * tautness;
  state.activity += (targetActivity - state.activity) * Math.min(1, elapsed * (targetActivity > state.activity ? 28 : 3));
  state.time += elapsed;
  return state;
}
