import { describe, expect, it } from 'vitest';
import { angularVelocity, soundLevel } from '../src/physics';

describe('angularVelocity', () => {
  it('measures the shortest signed turn across the ±π boundary', () => {
    expect(angularVelocity(Math.PI - 0.1, -Math.PI + 0.1, 0.1)).toBeCloseTo(2);
  });

  it('returns zero when elapsed time is not positive', () => {
    expect(angularVelocity(0, 1, 0)).toBe(0);
  });
});

describe('soundLevel', () => {
  it('stays silent below the play threshold', () => {
    expect(soundLevel(2, 3)).toBe(0);
  });

  it('ramps smoothly and clamps to one', () => {
    expect(soundLevel(5, 3)).toBeGreaterThan(0);
    expect(soundLevel(100, 3)).toBe(1);
  });
});
