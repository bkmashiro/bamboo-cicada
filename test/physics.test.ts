import { describe, expect, it } from 'vitest';
import { createPhysics, defaultPhysicsOptions, stepPhysics, type PhysicsState } from '../src/physics';

describe('rope physics', () => {
  it('starts with a hanging body and a slack-safe rope', () => {
    const state = createPhysics({ x: 120, y: 90 }, { ropeLength: 110 });
    expect(state.body.y).toBeGreaterThan(state.anchor.y);
    expect(state.rope.distance).toBeLessThanOrEqual(110);
    expect(state.rope.tension).toBe(0);
  });

  it('uses a rope that pulls but never pushes', () => {
    const slack: PhysicsState = createPhysics({ x: 100, y: 100 }, { ropeLength: 120 });
    slack.body = { x: 100, y: 120, vx: 0, vy: 0 };
    stepPhysics(slack, 1 / 240);
    expect(slack.rope.tension).toBe(0);
  });

  it('turns circular anchor motion into body angular velocity while remaining bounded', () => {
    const state = createPhysics({ x: 160, y: 150 }, { ropeLength: 105 });
    let peakAngularVelocity = 0;
    for (let frame = 0; frame < 720; frame += 1) {
      const angle = frame / 720 * Math.PI * 8;
      state.anchor.x = 160 + Math.cos(angle) * 36;
      state.anchor.y = 150 + Math.sin(angle) * 36;
      stepPhysics(state, 1 / 120);
      peakAngularVelocity = Math.max(peakAngularVelocity, Math.abs(state.rope.angularVelocity));
    }
    expect(peakAngularVelocity).toBeGreaterThan(1);
    expect(state.rope.distance).toBeLessThan(155);
    expect(state.rope.tension).toBeGreaterThanOrEqual(0);
  });

  it('sanitizes unsafe developer physics overrides before integration', () => {
    const state = createPhysics(
      { x: 10, y: 20 },
      { ropeLength: -1, stiffness: Number.NaN, radialDamping: -4, gravity: Number.POSITIVE_INFINITY, airDrag: -2, fixedStep: 0 },
    );
    expect(state.options.ropeLength).toBeGreaterThan(0);
    expect(state.options.fixedStep).toBeGreaterThan(0);
    expect(Object.values(state.options).every(Number.isFinite)).toBe(true);
    expect(() => stepPhysics(state, 1)).not.toThrow();
    expect(Number.isFinite(state.body.x)).toBe(true);
    expect(Number.isFinite(state.body.y)).toBe(true);
  });

  it('keeps exported defaults immutable and initial state finite for unsafe anchors', () => {
    expect(Object.isFrozen(defaultPhysicsOptions)).toBe(true);
    expect(() => {
      (defaultPhysicsOptions as { fixedStep: number }).fixedStep = 0;
    }).toThrow();

    const state = createPhysics({ x: Number.NaN, y: Number.POSITIVE_INFINITY });
    expect(Object.values(state.anchor).every(Number.isFinite)).toBe(true);
    expect(Number.isFinite(state.rope.distance)).toBe(true);
  });

  it('repairs a corrupted integration step before entering the substep loop', () => {
    const state = createPhysics({ x: 140, y: 100 });
    state.options.fixedStep = Number.NaN;
    stepPhysics(state, 0.01);
    expect(state.options.fixedStep).toBeGreaterThan(0);
    expect(Number.isFinite(state.body.x)).toBe(true);
    expect(Number.isFinite(state.body.y)).toBe(true);
  });

  it('is stable across a large frame split into fixed substeps', () => {
    const state = createPhysics({ x: 140, y: 100 });
    state.anchor.x += 60;
    stepPhysics(state, 0.08);
    expect(Number.isFinite(state.body.x)).toBe(true);
    expect(Number.isFinite(state.body.vy)).toBe(true);
    expect(state.rope.distance).toBeLessThan(220);
  });
});
