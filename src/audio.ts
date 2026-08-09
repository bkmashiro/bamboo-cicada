import type { MotionState } from './types';

export interface VoiceParameters {
  /** Stick-slip impulse repetition rate in hertz. */
  frequency: number;
  /** Radiation low-pass cutoff controlling perceived brightness. */
  filterFrequency: number;
  /** Small rotation-dependent pitch offset in cents. */
  detune: number;
  /** Final output gain after directional amplitude modulation. */
  gain: number;
  /** Broadband friction component mixed into the impulse train. */
  noiseGain: number;
  /** Frequency multiplier for membrane and cavity modes. */
  resonanceScale: number;
  /** Directional amplitude factor produced by rotation phase. */
  modulation: number;
}

export interface CicadaVoice {
  /** Called from a user gesture to create or resume browser audio. */
  unlock?(): void | Promise<void>;
  update(state: Readonly<MotionState>): void;
  silence(): void;
  destroy(): void;
}

export type CicadaPlaybackState = AudioContextState | 'uninitialized' | 'unsupported';

const TAU = Math.PI * 2;
const MODES = [
  { frequency: 430, q: 8, gain: 0.78, family: 'membrane' },
  { frequency: 870, q: 5, gain: 0.42, family: 'membrane' },
  { frequency: 1350, q: 12, gain: 0.24, family: 'cavity' },
  { frequency: 2200, q: 6, gain: 0.12, family: 'cavity' },
] as const;

export interface CicadaAcoustics {
  /** Relative rosin/string friction strength. */
  friction: number;
  /** Relative membrane tension. */
  membraneTension: number;
  /** Effective bamboo cavity length in millimetres. */
  tubeLength: number;
  /** Effective bamboo cavity diameter in millimetres. */
  tubeDiameter: number;
}

export const defaultCicadaAcoustics: Readonly<CicadaAcoustics> = Object.freeze({
  friction: 1,
  membraneTension: 1,
  tubeLength: 120,
  tubeDiameter: 42,
});

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const finite = (value: number | undefined, fallback = 0): number => Number.isFinite(value) ? value as number : fallback;

/**
 * Maps rope motion to a compact source-filter model:
 * nonlinear pulse density + friction noise -> membrane modes -> bamboo cavity/radiation.
 */
export function mapVoiceParameters(state: Readonly<MotionState>): VoiceParameters {
  const turns = clamp(Math.abs(finite(state.rope.angularVelocity)) / TAU, 0, 12);
  const length = Math.max(1e-6, finite(state.rope.length, 1));
  const ratio = finite(state.rope.distance) / length;
  const tautness = clamp((ratio - 0.84) / 0.16, 0, 1);
  const activity = clamp(finite(state.activity), 0, 1);
  const angle = finite(state.rope.angle);
  const modulation = 0.58 + 0.42 * (0.5 + 0.5 * Math.cos(angle));
  const activeTautness = activity * tautness;

  return {
    frequency: clamp(34 + turns * 23, 34, 220),
    filterFrequency: clamp(1050 + turns * 330 + tautness * 420, 1050, 5200),
    detune: Math.sin(angle) * clamp(turns * 3.2, 0, 24),
    gain: Math.pow(activity, 0.65) * tautness * modulation * 0.17,
    noiseGain: activeTautness * clamp(0.018 + turns * 0.009, 0.018, 0.11),
    resonanceScale: clamp(0.82 + tautness * 0.22 + turns * 0.008, 0.82, 1.18),
    modulation,
  };
}

export class SynthCicadaVoice implements CicadaVoice {
  private settings: CicadaAcoustics;
  private context?: AudioContext;
  private pulse?: OscillatorNode;
  private noise?: AudioBufferSourceNode;
  private pulseGain?: GainNode;
  private noiseGain?: GainNode;
  private output?: GainNode;
  private radiation?: BiquadFilterNode;
  private modeFilters: BiquadFilterNode[] = [];

  constructor(options: Partial<CicadaAcoustics> = {}) {
    this.settings = { ...defaultCicadaAcoustics };
    this.configure(options);
  }

  get acoustics(): Readonly<CicadaAcoustics> {
    return { ...this.settings };
  }

  get playbackState(): CicadaPlaybackState {
    if (this.context) return this.context.state;
    if (typeof window === 'undefined') return 'uninitialized';
    const audioWindow = window as Window & { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    return audioWindow.AudioContext || audioWindow.webkitAudioContext ? 'uninitialized' : 'unsupported';
  }

  configure(options: Partial<CicadaAcoustics>): this {
    this.settings = {
      friction: clamp(finite(options.friction, this.settings.friction), 0.2, 2.5),
      membraneTension: clamp(finite(options.membraneTension, this.settings.membraneTension), 0.4, 2.2),
      tubeLength: clamp(finite(options.tubeLength, this.settings.tubeLength), 60, 240),
      tubeDiameter: clamp(finite(options.tubeDiameter, this.settings.tubeDiameter), 20, 80),
    };
    return this;
  }

  async unlock(): Promise<void> {
    const audioWindow = typeof window === 'undefined'
      ? undefined
      : window as Window & { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    const AudioContextClass = audioWindow?.AudioContext ?? audioWindow?.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!this.context) this.start(AudioContextClass);
    if (this.context && this.context.state !== 'running' && this.context.state !== 'closed') {
      await this.context.resume().catch(() => undefined);
    }
  }

  update(state: Readonly<MotionState>): void {
    if (!this.context || !this.pulse || !this.pulseGain || !this.noiseGain || !this.output || !this.radiation) return;

    const values = mapVoiceParameters(state);
    const now = this.context.currentTime;
    const frictionScale = Math.sqrt(this.settings.friction);
    const membraneScale = values.resonanceScale * Math.sqrt(this.settings.membraneTension);
    const cavityScale = (defaultCicadaAcoustics.tubeLength / this.settings.tubeLength)
      * Math.sqrt(defaultCicadaAcoustics.tubeDiameter / this.settings.tubeDiameter);
    this.pulse.frequency.setTargetAtTime(values.frequency * frictionScale, now, 0.025);
    this.pulse.detune.setTargetAtTime(values.detune, now, 0.035);
    this.pulseGain.gain.setTargetAtTime(0.72 + values.modulation * 0.18, now, 0.03);
    this.noiseGain.gain.setTargetAtTime(values.noiseGain * this.settings.friction, now, 0.02);
    this.radiation.frequency.setTargetAtTime(
      values.filterFrequency * Math.sqrt(this.settings.tubeDiameter / defaultCicadaAcoustics.tubeDiameter),
      now,
      0.045,
    );
    this.output.gain.setTargetAtTime(values.gain * clamp(0.72 + this.settings.friction * 0.28, 0.6, 1.35), now, 0.022);
    this.modeFilters.forEach((filter, index) => {
      const mode = MODES[index];
      if (!mode) return;
      const scale = mode.family === 'membrane' ? membraneScale : cavityScale;
      filter.frequency.setTargetAtTime(mode.frequency * scale, now, 0.055);
    });
  }

  silence(): void {
    if (this.context && this.output) {
      this.output.gain.setTargetAtTime(0, this.context.currentTime, 0.06);
    }
  }

  destroy(): void {
    try { this.pulse?.stop(); } catch { /* already stopped */ }
    try { this.noise?.stop(); } catch { /* already stopped */ }
    void this.context?.close().catch(() => undefined);
    this.context = undefined;
    this.pulse = undefined;
    this.noise = undefined;
    this.pulseGain = undefined;
    this.noiseGain = undefined;
    this.output = undefined;
    this.radiation = undefined;
    this.modeFilters = [];
  }

  private start(AudioContextClass: typeof AudioContext): void {
    const context = new AudioContextClass();
    const pulse = context.createOscillator();
    const noise = context.createBufferSource();
    const pulseGain = context.createGain();
    const noiseGain = context.createGain();
    const exciter = context.createGain();
    const radiation = context.createBiquadFilter();
    const output = context.createGain();

    pulse.type = 'sawtooth';
    pulse.frequency.value = 34;
    pulseGain.gain.value = 0.8;
    noiseGain.gain.value = 0;
    radiation.type = 'lowpass';
    radiation.frequency.value = 1800;
    radiation.Q.value = 0.7;
    output.gain.value = 0;

    const noiseBuffer = context.createBuffer(1, Math.max(1, Math.floor(context.sampleRate * 2)), context.sampleRate);
    const samples = noiseBuffer.getChannelData(0);
    let seed = 0x6d2b79f5;
    for (let index = 0; index < samples.length; index += 1) {
      seed = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      seed ^= seed + Math.imul(seed ^ (seed >>> 7), 61 | seed);
      samples[index] = (((seed ^ (seed >>> 14)) >>> 0) / 4294967296) * 2 - 1;
    }
    noise.buffer = noiseBuffer;
    noise.loop = true;

    pulse.connect(pulseGain).connect(exciter);
    noise.connect(noiseGain).connect(exciter);

    const modeFilters = MODES.map((mode) => {
      const filter = context.createBiquadFilter();
      const modeGain = context.createGain();
      filter.type = 'bandpass';
      filter.frequency.value = mode.frequency;
      filter.Q.value = mode.q;
      modeGain.gain.value = mode.gain;
      exciter.connect(filter).connect(modeGain).connect(radiation);
      return filter;
    });

    radiation.connect(output).connect(context.destination);
    pulse.start();
    noise.start();

    this.context = context;
    this.pulse = pulse;
    this.noise = noise;
    this.pulseGain = pulseGain;
    this.noiseGain = noiseGain;
    this.output = output;
    this.radiation = radiation;
    this.modeFilters = modeFilters;
  }
}
