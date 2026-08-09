import { describe, expect, it } from 'vitest';
import { mapVoiceParameters, SynthCicadaVoice } from '../src/audio';
import type { MotionState } from '../src/index';

const motion = (
  angularVelocity: number,
  phase = 0,
  tension = 1,
  distance = tension > 0 ? 1 : 0.5,
): MotionState => ({
  time: 1,
  anchor: { x: 0, y: 0 },
  body: { x: 0, y: 100, vx: 0, vy: 0 },
  rope: { length: 1, distance, tension, angle: phase, angularVelocity },
  activity: 1,
  dragging: false,
  auto: false,
});

describe('source-filter voice model', () => {
  it('increases stick-slip pulse rate, brightness, and friction noise with rotation speed', () => {
    const slow = mapVoiceParameters(motion(Math.PI * 2));
    const fast = mapVoiceParameters(motion(Math.PI * 7));

    expect(fast.frequency).toBeGreaterThan(slow.frequency);
    expect(fast.filterFrequency).toBeGreaterThan(slow.filterFrequency);
    expect(fast.noiseGain).toBeGreaterThan(slow.noiseGain);
  });

  it('uses rotation phase for amplitude modulation', () => {
    const facing = mapVoiceParameters(motion(Math.PI * 6, 0));
    const away = mapVoiceParameters(motion(Math.PI * 6, Math.PI));

    expect(facing.modulation).toBeGreaterThan(away.modulation);
    expect(facing.gain).toBeGreaterThan(away.gain);
  });

  it('raises the membrane resonance scale as the rope becomes taut', () => {
    const loose = mapVoiceParameters(motion(Math.PI * 6, 0, 0.1, 0.86));
    const taut = mapVoiceParameters(motion(Math.PI * 6, 0, 1, 1.05));

    expect(taut.resonanceScale).toBeGreaterThan(loose.resonanceScale);
  });

  it('clamps interactive acoustic material controls to stable ranges', () => {
    const voice = new SynthCicadaVoice({
      friction: Number.POSITIVE_INFINITY,
      membraneTension: -4,
      tubeLength: 999,
      tubeDiameter: 1,
    });
    expect(voice.acoustics).toEqual({
      friction: 1,
      membraneTension: 0.4,
      tubeLength: 240,
      tubeDiameter: 20,
    });

    voice.configure({ friction: 1.7, membraneTension: 1.4, tubeLength: 160, tubeDiameter: 56 });
    expect(voice.acoustics).toEqual({
      friction: 1.7,
      membraneTension: 1.4,
      tubeLength: 160,
      tubeDiameter: 56,
    });
  });

  it('mutes while the rope is slack', () => {
    const slack = mapVoiceParameters(motion(Math.PI * 6, 0, 0, 0.5));
    expect(slack.gain).toBe(0);
    expect(slack.noiseGain).toBe(0);
  });
});
