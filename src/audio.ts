import type { MotionState } from './types';

export type ResonanceFamily = 'membrane' | 'cavity' | 'coupling' | 'radiation';

export interface FittedResonanceMode {
  readonly frequency: number;
  readonly q: number;
  readonly gain: number;
  readonly family: ResonanceFamily;
}

export interface CicadaFit {
  readonly rotationRate: number;
  readonly slipRate: number;
  readonly slipIntervalCv: number;
  readonly primaryAmDepth: number;
  readonly secondaryAmDepth: number;
  readonly eventsPerRotation: number;
  readonly modes: readonly FittedResonanceMode[];
}

const fittedModes = Object.freeze([
  Object.freeze({ frequency: 1485, q: 11.3, gain: 1, family: 'membrane' as const }),
  Object.freeze({ frequency: 1891, q: 10, gain: 0.8, family: 'cavity' as const }),
  Object.freeze({ frequency: 1680, q: 2.8, gain: 0.65, family: 'coupling' as const }),
  Object.freeze({ frequency: 3870, q: 7, gain: 0.07, family: 'radiation' as const }),
  Object.freeze({ frequency: 4540, q: 6, gain: 0.055, family: 'radiation' as const }),
  Object.freeze({ frequency: 5940, q: 5, gain: 0.04, family: 'radiation' as const }),
]);

/** Effective parameters fitted from one 1.72 s real-world operating condition. */
export const defaultCicadaFit: Readonly<CicadaFit> = Object.freeze({
  rotationRate: 2.367,
  slipRate: 78,
  slipIntervalCv: 0.25,
  primaryAmDepth: 0.66,
  secondaryAmDepth: 0.35,
  eventsPerRotation: 32.953105196451205,
  modes: fittedModes,
});

export interface VoiceParameters {
  /** Effective stick-slip event rate in hertz. */
  frequency: number;
  /** Effective number of friction events during one rotation. */
  eventsPerRotation: number;
  /** Radiation low-pass cutoff controlling perceived brightness. */
  filterFrequency: number;
  /** Small rotation-dependent pitch offset in cents. */
  detune: number;
  /** Final output gain after first- and second-order rotation AM. */
  gain: number;
  /** Broadband friction component mixed into the impulse train. */
  noiseGain: number;
  /** Frequency multiplier for membrane and cavity modes. */
  resonanceScale: number;
  /** Combined directional/tension amplitude modulation factor. */
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

const TAU = Math.PI * 2;
const EXCITATION_SECONDS = 4;
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const finite = (value: number | undefined, fallback = 0): number => Number.isFinite(value) ? value as number : fallback;

function randomUnit(state: { value: number }): number {
  state.value = (state.value + 0x6d2b79f5) | 0;
  let value = state.value;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

function randomNormal(state: { value: number }): number {
  const first = Math.max(1e-9, randomUnit(state));
  const second = randomUnit(state);
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(TAU * second);
}

/**
 * Builds a deterministic broadband stick-slip excitation buffer. Event spacing follows
 * a log-normal renewal process, so the requested interval CV remains positive and stable.
 */
export function generateStickSlipExcitation(
  sampleRate: number,
  duration: number,
  eventRate = defaultCicadaFit.slipRate,
  intervalCv = defaultCicadaFit.slipIntervalCv,
  seed = 0x51f15e,
): Float32Array {
  const safeSampleRate = Math.max(1000, Math.floor(finite(sampleRate, 48_000)));
  const length = Math.max(1, Math.floor(safeSampleRate * clamp(finite(duration, 1), 0.1, 16)));
  const rate = clamp(finite(eventRate, defaultCicadaFit.slipRate), 8, 400);
  const cv = clamp(finite(intervalCv, defaultCicadaFit.slipIntervalCv), 0, 0.8);
  const result = new Float32Array(length);
  const state = { value: seed | 0 };
  const sigma = Math.sqrt(Math.log(1 + cv * cv));
  const mu = Math.log(1 / rate) - sigma * sigma / 2;
  let cursor = Math.max(1, Math.round(safeSampleRate / rate));

  while (cursor < length - 4) {
    const strength = 0.92 + randomUnit(state) * 0.08;
    result[cursor] = strength;
    result[cursor + 1] = -strength * (0.42 + randomUnit(state) * 0.12);
    result[cursor + 2] = strength * 0.18;
    result[cursor + 3] = -strength * 0.06;
    const interval = Math.exp(mu + sigma * randomNormal(state));
    cursor += Math.max(2, Math.round(interval * safeSampleRate));
  }
  return result;
}

/** Maps rope motion to the fitted nonlinear-exciter + coupled-resonator model. */
export function mapVoiceParameters(state: Readonly<MotionState>): VoiceParameters {
  const turns = clamp(Math.abs(finite(state.rope.angularVelocity)) / TAU, 0, 8);
  const length = Math.max(1e-6, finite(state.rope.length, 1));
  const ratio = finite(state.rope.distance) / length;
  const tautness = clamp((ratio - 0.84) / 0.16, 0, 1);
  const activity = clamp(finite(state.activity), 0, 1);
  const angle = finite(state.rope.angle);
  const primary = defaultCicadaFit.primaryAmDepth * Math.cos(angle);
  const secondary = defaultCicadaFit.secondaryAmDepth * Math.cos(angle * 2 + 0.55);
  const modulation = clamp((1 + primary + secondary) / 2.01, 0.08, 1);
  const activeTautness = activity * tautness;

  return {
    frequency: clamp(turns * defaultCicadaFit.eventsPerRotation, 24, 180),
    eventsPerRotation: defaultCicadaFit.eventsPerRotation,
    filterFrequency: clamp(4800 + turns * 900 + tautness * 260, 4800, 9600),
    detune: Math.sin(angle) * clamp(turns * 2.4, 0, 18),
    gain: Math.pow(activity, 0.62) * tautness * modulation * 0.2,
    noiseGain: activeTautness * clamp(0.028 + turns * 0.008, 0.028, 0.1),
    resonanceScale: clamp(0.94 + tautness * 0.06 + turns * 0.004, 0.94, 1.08),
    modulation,
  };
}

export class SynthCicadaVoice implements CicadaVoice {
  private settings: CicadaAcoustics;
  private context?: AudioContext;
  private pulse?: AudioBufferSourceNode;
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
    const angle = finite(state.rope.angle);
    const phaseDrift = Math.sin(angle);

    this.pulse.playbackRate.setTargetAtTime(values.frequency / defaultCicadaFit.slipRate * frictionScale, now, 0.025);
    this.pulse.detune.setTargetAtTime(values.detune, now, 0.035);
    this.pulseGain.gain.setTargetAtTime(0.82 + values.modulation * 0.18, now, 0.02);
    this.noiseGain.gain.setTargetAtTime(values.noiseGain * this.settings.friction, now, 0.02);
    this.radiation.frequency.setTargetAtTime(
      values.filterFrequency * Math.sqrt(this.settings.tubeDiameter / defaultCicadaAcoustics.tubeDiameter),
      now,
      0.04,
    );
    this.output.gain.setTargetAtTime(values.gain * clamp(0.72 + this.settings.friction * 0.28, 0.6, 1.35), now, 0.018);

    this.modeFilters.forEach((filter, index) => {
      const mode = fittedModes[index];
      if (!mode) return;
      let scale = 1;
      if (mode.family === 'membrane') scale = membraneScale * (1 + phaseDrift * 0.012);
      if (mode.family === 'cavity') scale = cavityScale * (1 - phaseDrift * 0.01);
      if (mode.family === 'coupling') scale = Math.sqrt(membraneScale * cavityScale) * (1 + Math.cos(angle * 2) * 0.006);
      if (mode.family === 'radiation') scale = Math.sqrt(cavityScale);
      filter.frequency.setTargetAtTime(mode.frequency * scale, now, 0.045);
    });
  }

  silence(): void {
    if (this.context && this.output) {
      this.output.gain.setTargetAtTime(0, this.context.currentTime, 0.055);
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
    const pulse = context.createBufferSource();
    const noise = context.createBufferSource();
    const pulseGain = context.createGain();
    const noiseGain = context.createGain();
    const exciter = context.createGain();
    const radiation = context.createBiquadFilter();
    const output = context.createGain();

    const pulseBuffer = context.createBuffer(1, Math.max(1, Math.floor(context.sampleRate * EXCITATION_SECONDS)), context.sampleRate);
    pulseBuffer.getChannelData(0).set(generateStickSlipExcitation(
      context.sampleRate,
      EXCITATION_SECONDS,
      defaultCicadaFit.slipRate,
      defaultCicadaFit.slipIntervalCv,
    ));
    pulse.buffer = pulseBuffer;
    pulse.loop = true;
    pulse.playbackRate.value = 1;
    pulseGain.gain.value = 0.9;

    const noiseBuffer = context.createBuffer(1, Math.max(1, Math.floor(context.sampleRate * 3.17)), context.sampleRate);
    const samples = noiseBuffer.getChannelData(0);
    const random = { value: 0x6d2b79f5 };
    let previous = 0;
    for (let index = 0; index < samples.length; index += 1) {
      const white = randomUnit(random) * 2 - 1;
      previous = previous * 0.62 + white * 0.38;
      samples[index] = previous;
    }
    noise.buffer = noiseBuffer;
    noise.loop = true;
    noiseGain.gain.value = 0;

    radiation.type = 'lowpass';
    radiation.frequency.value = 6800;
    radiation.Q.value = 0.62;
    output.gain.value = 0;

    pulse.connect(pulseGain).connect(exciter);
    noise.connect(noiseGain).connect(exciter);

    const modeFilters = fittedModes.map((mode) => {
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
