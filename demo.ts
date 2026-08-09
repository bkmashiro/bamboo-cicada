import {
  mapVoiceParameters,
  mountBambooCicada,
  SynthCicadaVoice,
} from './src/index';

const voice = new SynthCicadaVoice();
const toy = mountBambooCicada({ voice: () => voice });

const autoButton = document.querySelector<HTMLButtonElement>('#auto')!;
const heroPlay = document.querySelector<HTMLButtonElement>('#hero-play')!;
const soundButton = document.querySelector<HTMLButtonElement>('#sound')!;
const resetButton = document.querySelector<HTMLButtonElement>('#reset')!;
const canvas = document.querySelector<HTMLCanvasElement>('#scope')!;
const context = canvas.getContext('2d')!;

const controls = {
  friction: document.querySelector<HTMLInputElement>('#friction')!,
  membrane: document.querySelector<HTMLInputElement>('#membrane')!,
  rope: document.querySelector<HTMLInputElement>('#rope')!,
  tubeLength: document.querySelector<HTMLInputElement>('#tube-length')!,
  tubeDiameter: document.querySelector<HTMLInputElement>('#tube-diameter')!,
};

const outputs = {
  rotation: document.querySelector<HTMLOutputElement>('#rotation')!,
  tension: document.querySelector<HTMLOutputElement>('#tension')!,
  pulse: document.querySelector<HTMLOutputElement>('#pulse')!,
  phase: document.querySelector<HTMLOutputElement>('#phase')!,
  friction: document.querySelector<HTMLOutputElement>('[data-for="friction"]')!,
  membrane: document.querySelector<HTMLOutputElement>('[data-for="membrane"]')!,
  rope: document.querySelector<HTMLOutputElement>('[data-for="rope"]')!,
  tubeLength: document.querySelector<HTMLOutputElement>('[data-for="tube-length"]')!,
  tubeDiameter: document.querySelector<HTMLOutputElement>('[data-for="tube-diameter"]')!,
};

let auto = false;
let sound = true;

function number(input: HTMLInputElement): number {
  return Number.parseFloat(input.value);
}

function applyMaterialControls(): void {
  voice.configure({
    friction: number(controls.friction),
    membraneTension: number(controls.membrane),
    tubeLength: number(controls.tubeLength),
    tubeDiameter: number(controls.tubeDiameter),
  });
  outputs.friction.value = `${number(controls.friction).toFixed(2)}×`;
  outputs.membrane.value = `${number(controls.membrane).toFixed(2)}×`;
  outputs.tubeLength.value = `${number(controls.tubeLength).toFixed(0)} mm`;
  outputs.tubeDiameter.value = `${number(controls.tubeDiameter).toFixed(0)} mm`;
}

function applyRopeControl(): void {
  const ropeLength = number(controls.rope);
  toy.configure({ physics: { ropeLength } });
  outputs.rope.value = `${ropeLength.toFixed(0)} mm`;
}

function syncAutoButtons(): void {
  autoButton.setAttribute('aria-pressed', String(auto));
  autoButton.textContent = auto ? '停止甩动' : '自动甩';
  heroPlay.textContent = auto ? '停止自动甩动' : '开始自动甩动';
}

function toggleAuto(): void {
  auto = !auto;
  if (auto) toy.startAuto(); else toy.stopAuto();
  syncAutoButtons();
}

for (const input of [controls.friction, controls.membrane, controls.tubeLength, controls.tubeDiameter]) {
  input.addEventListener('input', applyMaterialControls);
}
controls.rope.addEventListener('input', applyRopeControl);
autoButton.addEventListener('click', toggleAuto);
heroPlay.addEventListener('click', toggleAuto);

soundButton.addEventListener('click', () => {
  sound = !sound;
  toy.configure({ sound });
  if (sound) voice.unlock();
  soundButton.setAttribute('aria-pressed', String(sound));
  soundButton.textContent = sound ? '声音开启' : '声音关闭';
});

resetButton.addEventListener('click', () => {
  controls.friction.value = '1';
  controls.membrane.value = '1';
  controls.rope.value = '116';
  controls.tubeLength.value = '120';
  controls.tubeDiameter.value = '42';
  applyMaterialControls();
  applyRopeControl();
});

toy.addEventListener('pointerdown', () => {
  auto = false;
  syncAutoButtons();
});

function resizeScope(): void {
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const width = Math.max(1, Math.round(rect.width * ratio));
  const height = Math.max(1, Math.round(rect.height * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function drawScope(time: number, pulseRate: number, activity: number): void {
  resizeScope();
  const { width, height } = canvas;
  context.clearRect(0, 0, width, height);
  context.strokeStyle = `rgba(215, 245, 107, ${0.35 + activity * 0.65})`;
  context.lineWidth = Math.max(1.5, width / 420);
  context.beginPath();
  const cycles = Math.max(2, pulseRate / 16);
  for (let x = 0; x < width; x += 1) {
    const phase = x / width * Math.PI * 2 * cycles + time * pulseRate * 0.035;
    const stickSlip = Math.tanh(Math.sin(phase) * 5);
    const membrane = Math.sin(phase * 2.03) * 0.2 + Math.sin(phase * 3.14) * 0.1;
    const envelope = 0.35 + activity * 0.65;
    const y = height * 0.5 - (stickSlip * 0.42 + membrane) * height * 0.36 * envelope;
    if (x === 0) context.moveTo(x, y); else context.lineTo(x, y);
  }
  context.stroke();
}

function updateTelemetry(): void {
  const motion = toy.motion;
  const voiceParameters = mapVoiceParameters(motion);
  const turns = Math.abs(motion.rope.angularVelocity) / (Math.PI * 2);
  const degrees = ((motion.rope.angle * 180 / Math.PI) % 360 + 360) % 360;
  outputs.rotation.value = `${turns.toFixed(2)} r/s`;
  outputs.tension.value = `${motion.rope.tension.toFixed(0)} rel`;
  outputs.pulse.value = `${voiceParameters.frequency.toFixed(0)} Hz`;
  outputs.phase.value = `${degrees.toFixed(0)}°`;
  drawScope(motion.time, voiceParameters.frequency, motion.activity);
  requestAnimationFrame(updateTelemetry);
}

applyMaterialControls();
outputs.rope.value = `${number(controls.rope).toFixed(0)} mm`;
syncAutoButtons();
requestAnimationFrame(updateTelemetry);

(window as Window & { __zhuzhiliao?: unknown }).__zhuzhiliao = { toy, voice };
