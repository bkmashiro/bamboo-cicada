import {
  defaultCicadaFit,
  mapVoiceParameters,
  mountBambooCicada,
  SampledCicadaVoice,
  SynthCicadaVoice,
} from './src/index';

let voice: SynthCicadaVoice | SampledCicadaVoice = new SynthCicadaVoice();
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

const sampleControls = {
  motionAmount: document.querySelector<HTMLInputElement>('#sample-motion')!,
  pitchAmount: document.querySelector<HTMLInputElement>('#sample-pitch')!,
  filterAmount: document.querySelector<HTMLInputElement>('#sample-filter')!,
  volume: document.querySelector<HTMLInputElement>('#sample-volume')!,
};
const sampleOutputs = {
  motionAmount: document.querySelector<HTMLOutputElement>('#sample-motion-out')!,
  pitchAmount: document.querySelector<HTMLOutputElement>('#sample-pitch-out')!,
  filterAmount: document.querySelector<HTMLOutputElement>('#sample-filter-out')!,
  volume: document.querySelector<HTMLOutputElement>('#sample-volume-out')!,
};
const audioUpload = document.querySelector<HTMLInputElement>('#audio-upload')!;
const audioStatus = document.querySelector<HTMLOutputElement>('#audio-status')!;

let auto = false;
let sound = true;
let audioSelection = 0;

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
emojiPole.setAttribute('aria-label', 'Emoji 竹子木棍');
emojiPole.innerHTML = '<span aria-hidden="true">🎋</span><span class="part-socket" aria-hidden="true"></span>';

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
  if (skin === 'emoji') toy.configure({ parts: { pole: { source: emojiPole, socket: { x: 0.25, y: 0.08 } } } });
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
  if (!(voice instanceof SynthCicadaVoice)) return;
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

function sampleSettings() {
  return {
    motionAmount: number(sampleControls.motionAmount),
    pitchAmount: number(sampleControls.pitchAmount),
    filterAmount: number(sampleControls.filterAmount),
    volume: number(sampleControls.volume),
  };
}

function setAudioPressed(name: string): void {
  document.querySelectorAll<HTMLButtonElement>('[data-audio-preset]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.audioPreset === name));
  });
}

async function activateVoice(
  next: SynthCicadaVoice | SampledCicadaVoice,
  label: string,
  preset: string,
  startMotion = true,
  selection = audioSelection,
): Promise<void> {
  voice = next;
  sound = true;
  toy.configure({ voice: () => next, sound: true });
  await next.unlock();
  if (selection !== audioSelection) return;
  if (startMotion && !auto) {
    auto = true;
    toy.startAuto();
    syncAutoButtons();
  }
  setAudioPressed(preset);
  audioStatus.value = `${label} · 速度、张力、相位和滤波调制已接入`;
  syncSoundButton();
}

async function activatePhysicalVoice(startMotion = true): Promise<void> {
  const next = new SynthCicadaVoice({
    friction: number(controls.friction),
    membraneTension: number(controls.membrane),
    tubeLength: number(controls.tubeLength),
    tubeDiameter: number(controls.tubeDiameter),
  });
  await activateVoice(next, '物理合成器工作中', 'physical', startMotion);
}

async function activateSample(
  source: Blob,
  label: string,
  preset: string,
  prepared = new SampledCicadaVoice(sampleSettings()),
  selection = audioSelection,
): Promise<void> {
  const next = prepared;
  audioStatus.value = `${label} · 正在本地解码…`;
  try {
    // Resume inside the user gesture before fetch/File decoding can consume activation.
    await next.unlock();
    await next.load(source);
    if (selection !== audioSelection) {
      next.destroy();
      return;
    }
    await activateVoice(next, label, preset);
  } catch (error) {
    next.destroy();
    const message = error instanceof Error ? error.message : '浏览器无法解码这个文件';
    audioStatus.value = `${label} · ${message}`;
  }
}

for (const input of Object.values(sampleControls)) {
  input.addEventListener('input', () => {
    const settings = sampleSettings();
    sampleOutputs.motionAmount.value = settings.motionAmount.toFixed(2);
    sampleOutputs.pitchAmount.value = settings.pitchAmount.toFixed(2);
    sampleOutputs.filterAmount.value = settings.filterAmount.toFixed(2);
    sampleOutputs.volume.value = settings.volume.toFixed(2);
    if (voice instanceof SampledCicadaVoice) voice.configure(settings);
  });
}

document.querySelectorAll<HTMLButtonElement>('[data-audio-preset]').forEach((button) => {
  button.addEventListener('click', async () => {
    const selection = ++audioSelection;
    const preset = button.dataset.audioPreset;
    if (preset === 'physical') {
      await activatePhysicalVoice();
      return;
    }
    const file = preset === 'wood' ? 'wood-gear.mp3' : 'glass-wing.mp3';
    const label = preset === 'wood' ? '木齿轮' : '玻璃翼';
    const prepared = new SampledCicadaVoice(sampleSettings());
    audioStatus.value = `${label} · 正在读取本地样本…`;
    try {
      await prepared.unlock();
      const response = await fetch(new URL(`./audio/${file}`, window.location.href));
      if (selection !== audioSelection) {
        prepared.destroy();
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await activateSample(await response.blob(), label, preset ?? '', prepared, selection);
    } catch (error) {
      prepared.destroy();
      if (selection !== audioSelection) return;
      const message = error instanceof Error ? error.message : '读取失败';
      audioStatus.value = `${label} · ${message}`;
    }
  });
});

audioUpload.addEventListener('change', async () => {
  const selection = ++audioSelection;
  const file = audioUpload.files?.[0];
  if (!file) return;
  const supportedName = /\.(wav|mp3|m4a|aac|ogg|oga|flac|webm)$/i.test(file.name);
  if ((!file.type.startsWith('audio/') && !supportedName) || file.size > 20 * 1024 * 1024) {
    audioStatus.value = file.size > 20 * 1024 * 1024
      ? '文件超过 20 MB；没有读取或上传'
      : '请选择浏览器支持的音频文件';
    audioUpload.value = '';
    return;
  }
  setAudioPressed('upload');
  await activateSample(file, file.name, 'upload', undefined, selection);
  audioUpload.value = '';
});

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

resetButton.addEventListener('click', async () => {
  audioSelection += 1;
  controls.friction.value = '1';
  controls.membrane.value = '1';
  controls.rope.value = '116';
  controls.tubeLength.value = String(defaultCicadaFit.hollowTube.lengthMeters * 1000);
  controls.tubeDiameter.value = '42';
  await activatePhysicalVoice(false);
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
