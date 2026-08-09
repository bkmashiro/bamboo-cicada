import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  defaultCicadaAcoustics,
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
  delayTime: audioParam(),
  Q: audioParam(),
  curve: null as Float32Array | null,
  oversample: 'none' as OverSampleType,
  type: '',
  connect(target: unknown) { return target; },
  start: vi.fn(),
  stop: vi.fn(),
});

class FakeWebkitAudioContext {
  static constructions = 0;
  static filters: ReturnType<typeof audioNode>[] = [];
  static delays: ReturnType<typeof audioNode>[] = [];
  static gains: ReturnType<typeof audioNode>[] = [];
  static shapers: ReturnType<typeof audioNode>[] = [];
  state: AudioContextState = 'suspended';
  currentTime = 0;
  sampleRate = 48_000;
  destination = audioNode();
  constructor() { FakeWebkitAudioContext.constructions += 1; }
  createOscillator() { return audioNode(); }
  createBufferSource() { return { ...audioNode(), buffer: null, loop: false }; }
  createGain() { const node = audioNode(); FakeWebkitAudioContext.gains.push(node); return node; }
  createBiquadFilter() { const node = audioNode(); FakeWebkitAudioContext.filters.push(node); return node; }
  createDelay() { const node = audioNode(); FakeWebkitAudioContext.delays.push(node); return node; }
  createWaveShaper() { const node = audioNode(); FakeWebkitAudioContext.shapers.push(node); return node; }
  createBuffer(_channels: number, length: number) { return { getChannelData: () => new Float32Array(length) }; }
  async resume() { this.state = 'running'; }
  async close() { this.state = 'closed'; }
}

afterEach(() => {
  delete (window as Window & { webkitAudioContext?: unknown }).webkitAudioContext;
  FakeWebkitAudioContext.constructions = 0;
  FakeWebkitAudioContext.filters = [];
  FakeWebkitAudioContext.delays = [];
  FakeWebkitAudioContext.gains = [];
  FakeWebkitAudioContext.shapers = [];
});

describe('source-filter voice model', () => {
  it('ships with a clearly audible 2.5x output gain', () => {
    const voice = new SynthCicadaVoice();
    expect(defaultCicadaAcoustics.volume).toBe(2.5);
    expect(voice.acoustics.volume).toBe(2.5);
    expect(voice.configure({ volume: 99 }).acoustics.volume).toBe(4);
    expect(voice.configure({ volume: 0 }).acoustics.volume).toBe(0.25);
  });

  it('uses the fitted rotation, stick-slip, membrane, radiation, and hollow-tube parameters', () => {
    expect(defaultCicadaFit).toMatchObject({
      rotationRate: 2.367,
      slipRate: 78,
      slipIntervalCv: 0.25,
      primaryAmDepth: 0.66,
      secondaryAmDepth: 0.35,
    });
    expect(defaultCicadaFit.modes).toEqual([
      { frequency: 1506.37, q: 10.49, gain: 1, family: 'membrane' },
      { frequency: 1760.85, q: 10.62, gain: 0.54, family: 'membrane' },
    ]);
    expect(defaultCicadaFit.radiationHighpass).toBe(1863.85);
    expect(defaultCicadaFit.hollowTube).toEqual({
      lengthMeters: 0.10886,
      reflection: 0.4,
      loss: 1.5,
      coupling: 0.45,
      mouthRadiationHighpass: 429.96,
    });
    expect(Object.isFrozen(defaultCicadaFit)).toBe(true);
    expect(Object.isFrozen(defaultCicadaFit.modes)).toBe(true);
    expect(Object.isFrozen(defaultCicadaFit.hollowTube)).toBe(true);
  });

  it('builds a radiating membrane plus one-way and round-trip lossy tube paths', async () => {
    vi.stubGlobal('AudioContext', undefined);
    (window as Window & { webkitAudioContext?: unknown }).webkitAudioContext = FakeWebkitAudioContext;
    const voice = new SynthCicadaVoice();
    await voice.unlock();

    expect(FakeWebkitAudioContext.delays).toHaveLength(2);
    expect(FakeWebkitAudioContext.delays[0]?.delayTime.value).toBeCloseTo(0.10886 / 343, 8);
    expect(FakeWebkitAudioContext.delays[1]?.delayTime.value).toBeCloseTo(2 * 0.10886 / 343, 8);
    expect(FakeWebkitAudioContext.filters.some((filter) => filter.type === 'highpass' && filter.frequency.value === 1863.85)).toBe(true);
    expect(FakeWebkitAudioContext.filters.some((filter) => filter.type === 'highpass' && filter.frequency.value === 429.96)).toBe(true);
    const lossCutoff = 4000 / Math.sqrt(Math.exp((2 * 1.5) / 3) - 1);
    const tubeLossFilters = FakeWebkitAudioContext.filters.filter((filter) => filter.type === 'lowpass' && Math.abs(filter.frequency.value - lossCutoff) < 0.001);
    expect(tubeLossFilters).toHaveLength(3);
    expect(FakeWebkitAudioContext.gains.some((gain) => gain.gain.value === 0.4)).toBe(true);
    expect(FakeWebkitAudioContext.gains.some((gain) => gain.gain.value === -0.45)).toBe(true);
    expect(FakeWebkitAudioContext.gains.some((gain) => gain.gain.value === 32)).toBe(true);
    expect(FakeWebkitAudioContext.shapers).toHaveLength(1);
    const limiter = FakeWebkitAudioContext.shapers[0]!;
    expect(limiter.oversample).toBe('2x');
    expect(limiter.curve?.[0]).toBeCloseTo(-Math.tanh(1), 6);
    expect(limiter.curve?.[limiter.curve.length - 1]).toBeCloseTo(Math.tanh(1), 6);
    voice.destroy();
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
      volume: 2.5,
      friction: 1,
      membraneTension: 0.4,
      tubeLength: 240,
      tubeDiameter: 20,
    });

    voice.configure({ friction: 1.7, membraneTension: 1.4, tubeLength: 160, tubeDiameter: 56 });
    expect(voice.acoustics).toEqual({
      volume: 2.5,
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
