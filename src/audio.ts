import type { MotionState } from './types';

export interface VoiceParameters {
  frequency: number;
  filterFrequency: number;
  detune: number;
  gain: number;
}

export interface CicadaVoice {
  update(state: Readonly<MotionState>): void;
  silence(): void;
  destroy(): void;
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export function mapVoiceParameters(state: Readonly<MotionState>): VoiceParameters {
  const turns = Math.abs(state.rope.angularVelocity) / (Math.PI * 2);
  const tautness = clamp((state.rope.distance / state.rope.length - 0.84) / 0.16, 0, 1);
  return {
    frequency: clamp(62 + turns * 19, 62, 205),
    filterFrequency: clamp(780 + turns * 390, 780, 3400),
    detune: Math.sin(state.rope.angle * 2 + state.time * 0.8) * 44 * state.activity,
    gain: Math.pow(state.activity, 0.65) * tautness * 0.13,
  };
}

export class SynthCicadaVoice implements CicadaVoice {
  private context?: AudioContext;
  private carrier?: OscillatorNode;
  private overtone?: OscillatorNode;
  private gain?: GainNode;
  private filter?: BiquadFilterNode;

  update(state: Readonly<MotionState>): void {
    const AudioContextClass = typeof window === 'undefined' ? undefined : window.AudioContext;
    if (!AudioContextClass) return;
    if (!this.context) this.start(AudioContextClass);
    if (!this.context || !this.carrier || !this.overtone || !this.gain || !this.filter) return;
    if (this.context.state === 'suspended') void this.context.resume();

    const values = mapVoiceParameters(state);
    const now = this.context.currentTime;
    this.carrier.frequency.setTargetAtTime(values.frequency, now, 0.035);
    this.carrier.detune.setTargetAtTime(values.detune, now, 0.04);
    this.overtone.frequency.setTargetAtTime(values.frequency * 2.07, now, 0.035);
    this.overtone.detune.setTargetAtTime(-values.detune * 0.45, now, 0.04);
    this.filter.frequency.setTargetAtTime(values.filterFrequency, now, 0.04);
    this.gain.gain.setTargetAtTime(values.gain, now, 0.025);
  }

  silence(): void {
    if (this.context && this.gain) {
      this.gain.gain.setTargetAtTime(0, this.context.currentTime, 0.06);
    }
  }

  destroy(): void {
    try { this.carrier?.stop(); } catch { /* already stopped */ }
    try { this.overtone?.stop(); } catch { /* already stopped */ }
    void this.context?.close();
    this.context = undefined;
  }

  private start(AudioContextClass: typeof AudioContext): void {
    const context = new AudioContextClass();
    const carrier = context.createOscillator();
    const overtone = context.createOscillator();
    const carrierGain = context.createGain();
    const overtoneGain = context.createGain();
    const filter = context.createBiquadFilter();
    const output = context.createGain();

    carrier.type = 'sawtooth';
    overtone.type = 'square';
    carrierGain.gain.value = 0.72;
    overtoneGain.gain.value = 0.16;
    filter.type = 'bandpass';
    filter.Q.value = 1.5;
    output.gain.value = 0;

    carrier.connect(carrierGain).connect(filter);
    overtone.connect(overtoneGain).connect(filter);
    filter.connect(output).connect(context.destination);
    carrier.start();
    overtone.start();

    this.context = context;
    this.carrier = carrier;
    this.overtone = overtone;
    this.filter = filter;
    this.gain = output;
  }
}
