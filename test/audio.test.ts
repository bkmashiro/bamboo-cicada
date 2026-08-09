import { describe, expect, it } from 'vitest';
import { mapVoiceParameters } from '../src/audio';
import type { MotionState } from '../src/index';

const motion = (angularVelocity: number, phase = 0, tension = 1): MotionState => ({
  time: 1,
  anchor: { x: 0, y: 0 },
  body: { x: 0, y: 100, vx: 0, vy: 0 },
  rope: { length: 1, distance: tension > 0 ? 1 : 0.5, tension, angle: phase, angularVelocity },
  activity: 1,
  dragging: false,
  auto: false,
});

describe('voice modulation', () => {
  it('raises pitch and brightness as rope angular speed increases', () => {
    const slow = mapVoiceParameters(motion(Math.PI * 2));
    const fast = mapVoiceParameters(motion(Math.PI * 7));
    expect(fast.frequency).toBeGreaterThan(slow.frequency);
    expect(fast.filterFrequency).toBeGreaterThan(slow.filterFrequency);
  });

  it('adds a phase-dependent pitch wobble and respects rope tension', () => {
    const first = mapVoiceParameters(motion(Math.PI * 6, 0));
    const quarter = mapVoiceParameters(motion(Math.PI * 6, Math.PI / 2));
    const slack = mapVoiceParameters(motion(Math.PI * 6, 0, 0));
    expect(first.detune).not.toBe(quarter.detune);
    expect(slack.gain).toBe(0);
  });
});
