import { afterEach, describe, expect, it, vi } from 'vitest';
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

const audioParam = () => ({ value: 0, setTargetAtTime: vi.fn() });
const audioNode = () => ({
  frequency: audioParam(),
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
  createBuffer() { return { getChannelData: () => new Float32Array(16) }; }
  async resume() { this.state = 'running'; }
  async close() { this.state = 'closed'; }
}

afterEach(() => {
  delete (window as Window & { webkitAudioContext?: unknown }).webkitAudioContext;
  FakeWebkitAudioContext.constructions = 0;
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
