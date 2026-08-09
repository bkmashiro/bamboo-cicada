export interface SoundVoice {
  setMotion(speed: number, level: number): void;
  silence(): void;
  destroy(): void;
}

export class CicadaVoice implements SoundVoice {
  private context?: AudioContext;
  private carrier?: OscillatorNode;
  private overtone?: OscillatorNode;
  private gain?: GainNode;
  private filter?: BiquadFilterNode;

  setMotion(speed: number, level: number): void {
    const AudioContextClass = window.AudioContext;
    if (!AudioContextClass) return;
    if (!this.context) this.start(AudioContextClass);
    if (!this.context || !this.carrier || !this.overtone || !this.gain || !this.filter) return;
    if (this.context.state === 'suspended') void this.context.resume();

    const now = this.context.currentTime;
    const turns = Math.abs(speed) / (Math.PI * 2);
    const base = Math.min(190, 72 + turns * 18);
    this.carrier.frequency.setTargetAtTime(base, now, 0.035);
    this.overtone.frequency.setTargetAtTime(base * 2.03, now, 0.035);
    this.filter.frequency.setTargetAtTime(850 + level * 1550, now, 0.04);
    this.gain.gain.setTargetAtTime(level * 0.12, now, 0.025);
  }

  silence(): void {
    if (this.context && this.gain) {
      this.gain.gain.setTargetAtTime(0, this.context.currentTime, 0.06);
    }
  }

  destroy(): void {
    this.carrier?.stop();
    this.overtone?.stop();
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
    overtoneGain.gain.value = 0.18;
    filter.type = 'bandpass';
    filter.Q.value = 1.25;
    output.gain.value = 0;

    carrier.connect(carrierGain).connect(filter);
    overtone.connect(overtoneGain).connect(filter);
    filter.connect(output).connect(context.destination);
    carrier.start();
    overtone.start();

    this.context = context;
    this.carrier = carrier;
    this.overtone = overtone;
    this.gain = output;
    this.filter = filter;
  }
}
