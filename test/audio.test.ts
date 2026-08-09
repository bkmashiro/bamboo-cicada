import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  defaultCicadaFit,
  generateStickSlipExcitation,
  mapVoiceParameters,
  SynthCicadaVoice,
} from '../src/audio';
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

const audioParam = () => ({
  value: 0,
  setTargetAtTime: vi.fn((value: number) => {
    if (!Number.isFinite(value)) throw new TypeError('AudioParam target must be finite');
  }),
});
const audioNode = () => ({
  frequency: audioParam(),
  playbackRate: audioParam(),
  detune: audioParam(),
  gain: audioParam(),
  Q: audioParam(),
  type: '',
  connect(target: unknown) { return target; },
  start: vi.fn(),
  stop: vi.fn(),
});

class FakeWebkitAudioContext {
  static constructions = 0;
  state: AudioContextState = 'suspended';
  currentTime = 0;
  sampleRate = 48_000;
  destination = audioNode();
  constructor() { FakeWebkitAudioContext.constructions += 1; }
  createOscillator() { return audioNode(); }
  createBufferSource() { return { ...audioNode(), buffer: null, loop: false }; }
  createGain() { return audioNode(); }
  createBiquadFilter() { return audioNode(); }
  createBuffer(_channels: number, length: number) { return { getChannelData: () => new Float32Array(length) }; }
  async resume() { this.state = 'running'; }
  async close() { this.state = 'closed'; }
}

afterEach(() => {
  delete (window as Window & { webkitAudioContext?: unknown }).webkitAudioContext;
  FakeWebkitAudioContext.constructions = 0;
});

describe('source-filter voice model', () => {
  it('uses the fitted rotation, stick-slip, AM, and resonator parameters', () => {
    expect(defaultCicadaFit).toMatchObject({
      rotationRate: 2.367,
      slipRate: 78,
      slipIntervalCv: 0.25,
      primaryAmDepth: 0.66,
      secondaryAmDepth: 0.35,
    });
    expect(defaultCicadaFit.modes).toEqual([
      { frequency: 1485, q: 11.3, gain: 1, family: 'membrane' },
      { frequency: 1891, q: 10, gain: 0.8, family: 'cavity' },
      { frequency: 1680, q: 2.8, gain: 0.65, family: 'coupling' },
      { frequency: 3870, q: 7, gain: 0.07, family: 'radiation' },
      { frequency: 4540, q: 6, gain: 0.055, family: 'radiation' },
      { frequency: 5940, q: 5, gain: 0.04, family: 'radiation' },
    ]);
    expect(Object.isFrozen(defaultCicadaFit)).toBe(true);
    expect(Object.isFrozen(defaultCicadaFit.modes)).toBe(true);
  });

  it('maps the fitted rotation rate to about 78 stick-slip events per second', () => {
    const fitted = mapVoiceParameters(motion(2.367 * Math.PI * 2));
    expect(fitted.frequency).toBeCloseTo(78, 1);
    expect(fitted.eventsPerRotation).toBeCloseTo(33, 1);
  });

  it('generates deterministic irregular stick-slip intervals near CV 0.25', () => {
    const excitation = generateStickSlipExcitation(8_000, 4, 78, 0.25, 0x12345678);
    const repeated = generateStickSlipExcitation(8_000, 4, 78, 0.25, 0x12345678);
    expect(excitation).toEqual(repeated);

    const events: number[] = [];
    for (let index = 1; index < excitation.length - 1; index += 1) {
      if (excitation[index]! > 0.9 && excitation[index]! >= excitation[index - 1]! && excitation[index]! > excitation[index + 1]!) {
        events.push(index);
      }
    }
    const intervals = events.slice(1).map((event, index) => (event - events[index]!) / 8_000);
    const mean = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
    const deviation = Math.sqrt(intervals.reduce((sum, value) => sum + (value - mean) ** 2, 0) / intervals.length);
    expect(1 / mean).toBeGreaterThan(74);
    expect(1 / mean).toBeLessThan(82);
    expect(deviation / mean).toBeGreaterThan(0.18);
    expect(deviation / mean).toBeLessThan(0.32);
  });

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

  it('unlocks through the iOS webkit AudioContext fallback and exposes playback state', async () => {
    vi.stubGlobal('AudioContext', undefined);
    (window as Window & { webkitAudioContext?: unknown }).webkitAudioContext = FakeWebkitAudioContext;
    const voice = new SynthCicadaVoice();

    expect(voice.playbackState).toBe('uninitialized');
    await voice.unlock();

    expect(FakeWebkitAudioContext.constructions).toBe(1);
    expect(voice.playbackState).toBe('running');
    voice.destroy();
  });

  it('keeps every AudioParam target finite for malformed public motion input', async () => {
    vi.stubGlobal('AudioContext', undefined);
    (window as Window & { webkitAudioContext?: unknown }).webkitAudioContext = FakeWebkitAudioContext;
    const voice = new SynthCicadaVoice();
    await voice.unlock();
    const malformed = motion(Math.PI * 4) as MotionState & { rope: MotionState['rope'] & { angle: number } };
    malformed.rope = { ...malformed.rope, angle: Number.NaN };

    expect(() => voice.update(malformed)).not.toThrow();
    voice.destroy();
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
