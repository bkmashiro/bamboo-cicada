import {
  defaultCicadaFit,
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

const emojiCicada = document.createElement('span');
emojiCicada.className = 'demo-emoji-part';
emojiCicada.textContent = '🪲';
emojiCicada.setAttribute('aria-label', 'Emoji 甲虫皮肤');

const rocketCicada = document.createElement('img');
rocketCicada.className = 'demo-rocket-part';
rocketCicada.src = new URL('./skins/cicada-rocket.webp', window.location.href).href;
rocketCicada.alt = '带红色吊环的竹蝉飞船';

const liveButton = document.createElement('button');
liveButton.type = 'button';
liveButton.className = 'demo-live-button';
liveButton.innerHTML = '<span class="part-socket" aria-hidden="true"></span><span>真按钮 · 0 次</span>';
let liveButtonClicks = 0;
liveButton.addEventListener('click', () => {
  liveButtonClicks += 1;
  liveButton.querySelector('span:last-child')!.textContent = `真按钮 · ${liveButtonClicks} 次`;
});

const emojiPole = document.createElement('span');
emojiPole.className = 'demo-emoji-pole';
emojiPole.textContent = '🎋';
emojiPole.setAttribute('aria-label', 'Emoji 竹子木棍');

const rulerPole = document.createElement('div');
rulerPole.className = 'demo-ruler-part';
rulerPole.setAttribute('aria-label', 'CSS 刻度尺木棍');
rulerPole.innerHTML = '<span class="part-socket" aria-hidden="true"></span>';

function syncSkinButtons(selector: string, active: string): void {
  document.querySelectorAll<HTMLButtonElement>(selector).forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.cicadaSkin === active || button.dataset.poleSkin === active));
  });
}

function setCicadaSkin(skin: string): void {
  if (skin === 'emoji') toy.configure({ parts: { cicada: { source: emojiCicada, socket: { x: 0.5, y: 0.16 } } } });
  else if (skin === 'rocket') toy.configure({ parts: { cicada: { source: rocketCicada, socket: { x: 0.5, y: 0.052 } } } });
  else if (skin === 'button') toy.configure({ parts: { cicada: { source: liveButton, socket: { x: 0.5, y: 0 } } } });
  else toy.configure({ parts: { cicada: null } });
  syncSkinButtons('[data-cicada-skin]', skin);
}

function setPoleSkin(skin: string): void {
  if (skin === 'emoji') toy.configure({ parts: { pole: { source: emojiPole, socket: { x: 0.5, y: 0.08 } } } });
  else if (skin === 'ruler') toy.configure({ parts: { pole: { source: rulerPole, socket: { x: 0.5, y: 0 } } } });
  else toy.configure({ parts: { pole: null } });
  syncSkinButtons('[data-pole-skin]', skin);
}

document.querySelectorAll<HTMLButtonElement>('[data-cicada-skin]').forEach((button) => {
  button.addEventListener('click', () => setCicadaSkin(button.dataset.cicadaSkin ?? 'default'));
});
document.querySelectorAll<HTMLButtonElement>('[data-pole-skin]').forEach((button) => {
  button.addEventListener('click', () => setPoleSkin(button.dataset.poleSkin ?? 'default'));
});

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
  outputs.tubeLength.value = `${number(controls.tubeLength).toFixed(2)} mm`;
  outputs.tubeDiameter.value = `${number(controls.tubeDiameter).toFixed(0)} mm`;
}

function applyRopeControl(): void {
  const ropeLength = number(controls.rope);
  toy.configure({ physics: { ropeLength } });
  outputs.rope.value = `${ropeLength.toFixed(0)} mm`;
}

function syncAutoButtons(): void {
  autoButton.setAttribute('aria-pressed', String(auto));
  autoButton.textContent = auto ? '停下竹蝉' : '自动甩动';
  heroPlay.textContent = auto ? '让竹蝉停下' : '听一圈盛夏';
}

function syncSoundButton(): void {
  const running = sound && voice.playbackState === 'running';
  soundButton.setAttribute('aria-pressed', String(running));
  if (!sound) soundButton.textContent = '声音：关';
  else if (running) soundButton.textContent = '声音：开';
  else if (voice.playbackState === 'unsupported') soundButton.textContent = '浏览器无音频';
  else soundButton.textContent = '启用声音';
}

async function unlockSound(): Promise<void> {
  if (!sound) return;
  await voice.unlock();
  syncSoundButton();
}

function toggleAuto(): void {
  auto = !auto;
  if (auto) {
    toy.startAuto();
    void unlockSound();
  } else toy.stopAuto();
  syncAutoButtons();
}

for (const input of [controls.friction, controls.membrane, controls.tubeLength, controls.tubeDiameter]) {
  input.addEventListener('input', applyMaterialControls);
}
controls.rope.addEventListener('input', applyRopeControl);
autoButton.addEventListener('click', toggleAuto);
heroPlay.addEventListener('click', toggleAuto);

soundButton.addEventListener('click', async () => {
  sound = !(sound && voice.playbackState === 'running');
  toy.configure({ sound });
  if (sound) await unlockSound();
  else syncSoundButton();
});

resetButton.addEventListener('click', () => {
  controls.friction.value = '1';
  controls.membrane.value = '1';
  controls.rope.value = '116';
  controls.tubeLength.value = String(defaultCicadaFit.hollowTube.lengthMeters * 1000);
  controls.tubeDiameter.value = '42';
  applyMaterialControls();
  applyRopeControl();
  setCicadaSkin('default');
  setPoleSkin('default');
});

toy.addEventListener('pointerdown', () => {
  auto = false;
  syncAutoButtons();
  void unlockSound();
});

document.addEventListener('visibilitychange', syncSoundButton);

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
  const rotationEnvelope = 0.56
    + defaultCicadaFit.primaryAmDepth * 0.24 * Math.cos(time * Math.PI * 2 * defaultCicadaFit.rotationRate)
    + defaultCicadaFit.secondaryAmDepth * 0.16 * Math.cos(time * Math.PI * 4 * defaultCicadaFit.rotationRate + 0.55);
  context.strokeStyle = `rgba(185, 223, 201, ${0.42 + activity * 0.58})`;
  context.lineWidth = Math.max(1.5, width / 420);
  context.beginPath();
  const cycles = Math.max(4, pulseRate / 7);
  for (let x = 0; x < width; x += 1) {
    const eventPosition = x / width * cycles + time * pulseRate * 0.06;
    const eventIndex = Math.floor(eventPosition);
    const jitter = Math.sin(eventIndex * 12.9898) * defaultCicadaFit.slipIntervalCv * 0.38;
    const local = ((eventPosition + jitter) % 1 + 1) % 1;
    const impulse = Math.exp(-local * 17);
    const ring = Math.sin(local * Math.PI * 16.5) * Math.exp(-local * 8.5);
    const friction = Math.sin((x + eventIndex * 17) * 0.71) * 0.045;
    const envelope = (0.2 + activity * 0.8) * Math.max(0.22, rotationEnvelope);
    const y = height * 0.52 - (impulse * 0.7 + ring * 0.42 + friction) * height * 0.48 * envelope;
    if (x === 0) context.moveTo(x, y); else context.lineTo(x, y);
  }
  context.stroke();

  context.strokeStyle = 'rgba(240, 199, 94, .72)';
  context.lineWidth = Math.max(1, width / 700);
  context.beginPath();
  for (let x = 0; x < width; x += 1) {
    const phase = x / width * Math.PI * 4 + time * Math.PI * 2 * defaultCicadaFit.rotationRate;
    const y = height * (0.83 - Math.cos(phase) * 0.055 - Math.cos(phase * 2 + 0.55) * 0.026);
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
syncSoundButton();
requestAnimationFrame(updateTelemetry);

(window as Window & { __zhuzhiliao?: unknown }).__zhuzhiliao = { toy, voice };
