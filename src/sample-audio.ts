import { defaultCicadaFit, type CicadaPlaybackState, type CicadaVoice } from './audio';
import type { MotionState } from './types';

const TAU = Math.PI * 2;
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const finite = (value: number | undefined, fallback = 0): number => Number.isFinite(value) ? value as number : fallback;

export interface SampledCicadaSettings {
  /** Final sample gain before the safety limiter. */
  volume: number;
  /** 0 keeps the file continuously audible; 1 fully follows motion and rope tension. */
  motionAmount: number;
  /** Amount of rotation-speed pitch tracking. 0 preserves the uploaded pitch. */
  pitchAmount: number;
  /** Amount of tension/speed low-pass modulation. */
  filterAmount: number;
  /** Playback rate used before physical modulation. */
  basePlaybackRate: number;
  /** Repeat the decoded file continuously. */
  loop: boolean;
}

export interface SampleMotionParameters {
  gain: number;
  playbackRate: number;
  filterFrequency: number;
  modulation: number;
}

export const defaultSampledCicadaSettings: Readonly<SampledCicadaSettings> = Object.freeze({
  volume: 1,
  motionAmount: 1,
  pitchAmount: 0.35,
  filterAmount: 0.72,
  basePlaybackRate: 1,
  loop: true,
});

function limiterCurve(length = 2049): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(new ArrayBuffer(length * Float32Array.BYTES_PER_ELEMENT));
  for (let index = 0; index < length; index += 1) {
    const input = index / (length - 1) * 2 - 1;
    curve[index] = Math.tanh(input);
  }
  return curve;
}

export function mapSampleMotion(
  state: Readonly<MotionState>,
  options: Partial<SampledCicadaSettings> = {},
): SampleMotionParameters {
  const settings = { ...defaultSampledCicadaSettings, ...options };
  const turns = clamp(Math.abs(finite(state.rope.angularVelocity)) / TAU, 0, 8);
  const length = Math.max(1e-6, finite(state.rope.length, 1));
  const tautness = clamp((finite(state.rope.distance) / length - 0.84) / 0.16, 0, 1);
  const activity = clamp(finite(state.activity), 0, 1);
  const angle = finite(state.rope.angle);
  const primary = defaultCicadaFit.primaryAmDepth * Math.cos(angle);
  const secondary = defaultCicadaFit.secondaryAmDepth * Math.cos(angle * 2 + 0.55);
  const modulation = clamp((1 + primary + secondary) / 2.01, 0.08, 1);
  const physicalGain = Math.pow(activity, 0.62) * tautness * modulation;
  const motionAmount = clamp(finite(settings.motionAmount, 1), 0, 1);
  const pitchAmount = clamp(finite(settings.pitchAmount, 0.35), 0, 1);
  const filterAmount = clamp(finite(settings.filterAmount, 0.72), 0, 1);
  const speedRate = clamp(0.75 + turns * 0.18, 0.72, 1.75);
  const physicalCutoff = clamp(1800 + turns * 1050 + tautness * 1800, 1200, 12_000);

  return {
    gain: clamp(finite(settings.volume, 1), 0, 2) * ((1 - motionAmount) + motionAmount * physicalGain),
    playbackRate: clamp(finite(settings.basePlaybackRate, 1), 0.25, 4) * (1 + (speedRate - 1) * pitchAmount),
    filterFrequency: 16_000 + (physicalCutoff - 16_000) * filterAmount,
    modulation,
  };
}

/** A local AudioBuffer voice modulated by the same MotionState as the physical synthesizer. */
export class SampledCicadaVoice implements CicadaVoice {
  private settings: SampledCicadaSettings = { ...defaultSampledCicadaSettings };
  private context?: AudioContext;
  private source?: AudioBufferSourceNode;
  private decoded?: AudioBuffer;
  private filter?: BiquadFilterNode;
  private output?: GainNode;
  private pending?: ArrayBuffer;
  private generation = 0;

  constructor(options: Partial<SampledCicadaSettings> = {}) {
    this.configure(options);
  }

  get acoustics(): Readonly<SampledCicadaSettings> {
    return { ...this.settings };
  }

  get hasSource(): boolean {
    return Boolean(this.pending || this.decoded);
  }

  get playbackState(): CicadaPlaybackState {
    if (this.context) return this.context.state;
    if (typeof window === 'undefined') return 'uninitialized';
    const audioWindow = window as Window & { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    return audioWindow.AudioContext || audioWindow.webkitAudioContext ? 'uninitialized' : 'unsupported';
  }

  configure(options: Partial<SampledCicadaSettings>): this {
    this.settings = {
      volume: clamp(finite(options.volume, this.settings.volume), 0, 2),
      motionAmount: clamp(finite(options.motionAmount, this.settings.motionAmount), 0, 1),
      pitchAmount: clamp(finite(options.pitchAmount, this.settings.pitchAmount), 0, 1),
      filterAmount: clamp(finite(options.filterAmount, this.settings.filterAmount), 0, 1),
      basePlaybackRate: clamp(finite(options.basePlaybackRate, this.settings.basePlaybackRate), 0.25, 4),
      loop: options.loop ?? this.settings.loop,
    };
    if (this.source) this.source.loop = this.settings.loop;
    return this;
  }

  async load(source: Blob | ArrayBuffer): Promise<void> {
    const data = source instanceof Blob ? await source.arrayBuffer() : source.slice(0);
    if (data.byteLength === 0) throw new TypeError('Audio source is empty.');
    this.pending = data;
    const generation = ++this.generation;
    if (this.context) await this.decodeAndStart(data, generation);
  }

  async unlock(): Promise<void> {
    const audioWindow = typeof window === 'undefined'
      ? undefined
      : window as Window & { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    const AudioContextClass = audioWindow?.AudioContext ?? audioWindow?.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!this.context) {
      await this.start(AudioContextClass);
    } else if (this.context.state !== 'running' && this.context.state !== 'closed') {
      await this.context.resume().catch(() => undefined);
    }
    if (this.context && this.pending && !this.decoded) {
      await this.decodeAndStart(this.pending, this.generation);
    }
  }

  update(state: Readonly<MotionState>): void {
    if (!this.context || !this.source || !this.filter || !this.output) return;
    const values = mapSampleMotion(state, this.settings);
    const now = this.context.currentTime;
    this.source.playbackRate.setTargetAtTime(values.playbackRate, now, 0.035);
    this.filter.frequency.setTargetAtTime(values.filterFrequency, now, 0.04);
    this.output.gain.setTargetAtTime(values.gain, now, 0.018);
  }

  silence(): void {
    if (this.context && this.output) this.output.gain.setTargetAtTime(0, this.context.currentTime, 0.04);
  }

  replay(): void {
    if (this.context && this.decoded) this.startSource(this.decoded);
  }

  destroy(): void {
    this.generation += 1;
    try { this.source?.stop(); } catch { /* already stopped */ }
    void this.context?.close().catch(() => undefined);
    this.context = undefined;
    this.source = undefined;
    this.decoded = undefined;
    this.filter = undefined;
    this.output = undefined;
    this.pending = undefined;
  }

  private start(AudioContextClass: typeof AudioContext): Promise<void> {
    const context = new AudioContextClass();
    let resumed = Promise.resolve();
    let resumeThrew = false;
    if (context.state !== 'running' && context.state !== 'closed') {
      try { resumed = Promise.resolve(context.resume()).catch(() => undefined); } catch { resumeThrew = true; }
    }
    const filter = context.createBiquadFilter();
    const output = context.createGain();
    const limiter = context.createWaveShaper();
    filter.type = 'lowpass';
    filter.frequency.value = 16_000;
    filter.Q.value = 0.55;
    output.gain.value = 0;
    limiter.curve = limiterCurve();
    limiter.oversample = '2x';
    filter.connect(output).connect(limiter).connect(context.destination);
    this.context = context;
    this.filter = filter;
    this.output = output;
    if (resumeThrew && context.state !== 'running' && context.state !== 'closed') {
      try { resumed = Promise.resolve(context.resume()).catch(() => undefined); } catch { /* retry on the next gesture */ }
    }
    return resumed;
  }

  private async decodeAndStart(data: ArrayBuffer, generation: number): Promise<void> {
    const context = this.context;
    if (!context) return;
    const decoded = await context.decodeAudioData(data.slice(0));
    if (generation !== this.generation || context !== this.context) return;
    this.decoded = decoded;
    this.startSource(decoded);
  }

  private startSource(buffer: AudioBuffer): void {
    const context = this.context;
    const filter = this.filter;
    if (!context || !filter) return;
    try { this.source?.stop(); } catch { /* already stopped */ }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = this.settings.loop;
    source.connect(filter);
    source.start();
    this.source = source;
  }
}
