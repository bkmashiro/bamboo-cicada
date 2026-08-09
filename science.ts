import {
  createPhysics,
  defaultCicadaFit,
  defaultPhysicsOptions,
  stepPhysics,
} from './src/index';
import type { PhysicsState } from './src/index';

const TAU = Math.PI * 2;
const SPEED_OF_SOUND = 343;
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const value = (id: string): number => Number.parseFloat((document.querySelector<HTMLInputElement>(`#${id}`)!).value);
const output = (selector: string, text: string): void => {
  const node = document.querySelector<HTMLOutputElement>(selector);
  if (node) node.value = text;
};

interface CanvasSurface {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  width: number;
  height: number;
  ratio: number;
}

function surface(id: string): CanvasSurface {
  const canvas = document.querySelector<HTMLCanvasElement>(`#${id}`)!;
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const width = Math.max(1, Math.round(rect.width * ratio));
  const height = Math.max(1, Math.round(rect.height * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const context = canvas.getContext('2d')!;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { canvas, context, width: rect.width, height: rect.height, ratio };
}

function grid(context: CanvasRenderingContext2D, width: number, height: number, xStep = 40, yStep = 40): void {
  context.save();
  context.strokeStyle = 'rgba(185,223,201,.12)';
  context.lineWidth = 1;
  for (let x = 0; x <= width; x += xStep) {
    context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke();
  }
  for (let y = 0; y <= height; y += yStep) {
    context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke();
  }
  context.restore();
}

// --- Production rope-mass model -------------------------------------------------
const ropeCanvas = document.querySelector<HTMLCanvasElement>('#rope-canvas')!;
let ropeState: PhysicsState;
let ropeDragging = false;
let lastRopeFrame = performance.now();

function resetRope(): void {
  const rect = ropeCanvas.getBoundingClientRect();
  ropeState = createPhysics(
    { x: rect.width * 0.5, y: Math.min(95, rect.height * 0.3) },
    {
      ropeLength: value('rope-length-lab'),
      gravity: value('gravity-lab'),
      airDrag: value('drag-lab'),
      stiffness: value('stiffness-lab'),
    },
  );
}

function syncRopeOptions(): void {
  ropeState.options.ropeLength = value('rope-length-lab');
  ropeState.rope.length = ropeState.options.ropeLength;
  ropeState.options.gravity = value('gravity-lab');
  ropeState.options.airDrag = value('drag-lab');
  ropeState.options.stiffness = value('stiffness-lab');
  output('[data-out="rope-length"]', `${ropeState.options.ropeLength.toFixed(0)} px`);
  output('[data-out="gravity"]', ropeState.options.gravity.toFixed(0));
  output('[data-out="drag"]', ropeState.options.airDrag.toFixed(2));
  output('[data-out="stiffness"]', ropeState.options.stiffness.toFixed(0));
}

function ropePoint(event: PointerEvent): { x: number; y: number } {
  const rect = ropeCanvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

ropeCanvas.addEventListener('pointerdown', (event) => {
  const point = ropePoint(event);
  if (Math.hypot(point.x - ropeState.anchor.x, point.y - ropeState.anchor.y) <= 35) {
    ropeDragging = true;
    ropeCanvas.setPointerCapture(event.pointerId);
    ropeState.anchor = point;
  }
});
ropeCanvas.addEventListener('pointermove', (event) => {
  if (ropeDragging) ropeState.anchor = ropePoint(event);
});
const stopRopeDrag = (): void => { ropeDragging = false; };
ropeCanvas.addEventListener('pointerup', stopRopeDrag);
ropeCanvas.addEventListener('pointercancel', stopRopeDrag);
ropeCanvas.addEventListener('lostpointercapture', stopRopeDrag);

for (const id of ['rope-length-lab', 'gravity-lab', 'drag-lab', 'stiffness-lab']) {
  document.querySelector(`#${id}`)?.addEventListener('input', syncRopeOptions);
}
document.querySelector('#rope-reset')?.addEventListener('click', resetRope);
document.querySelector('#rope-kick')?.addEventListener('click', () => {
  const dx = ropeState.body.x - ropeState.anchor.x;
  const dy = ropeState.body.y - ropeState.anchor.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  ropeState.body.vx += -dy / distance * 920;
  ropeState.body.vy += dx / distance * 920;
});

function drawRope(now: number): void {
  const elapsed = clamp((now - lastRopeFrame) / 1000, 0, 0.04);
  lastRopeFrame = now;
  syncRopeOptions();
  stepPhysics(ropeState, elapsed);
  const { context, width, height } = surface('rope-canvas');
  context.clearRect(0, 0, width, height);
  grid(context, width, height);

  context.save();
  context.strokeStyle = 'rgba(240,199,94,.3)';
  context.setLineDash([5, 8]);
  context.beginPath();
  context.arc(ropeState.anchor.x, ropeState.anchor.y, ropeState.options.ropeLength, 0, TAU);
  context.stroke();
  context.restore();

  const taut = ropeState.rope.tension > 0;
  context.strokeStyle = taut ? '#f0c75e' : 'rgba(185,223,201,.42)';
  context.lineWidth = taut ? 2.5 : 1.4;
  context.setLineDash(taut ? [] : [5, 6]);
  context.beginPath();
  context.moveTo(ropeState.anchor.x, ropeState.anchor.y);
  context.lineTo(ropeState.body.x, ropeState.body.y);
  context.stroke();
  context.setLineDash([]);

  context.fillStyle = '#f0c75e';
  context.beginPath(); context.arc(ropeState.anchor.x, ropeState.anchor.y, 9, 0, TAU); context.fill();
  context.strokeStyle = '#f8f2e2'; context.lineWidth = 2;
  context.beginPath(); context.arc(ropeState.anchor.x, ropeState.anchor.y, 13, 0, TAU); context.stroke();

  context.save();
  context.translate(ropeState.body.x, ropeState.body.y);
  context.rotate(ropeState.rope.angle - Math.PI / 2);
  context.fillStyle = '#e97144';
  context.beginPath(); context.ellipse(0, 0, 19, 29, 0, 0, TAU); context.fill();
  context.fillStyle = 'rgba(185,223,201,.82)';
  context.beginPath(); context.ellipse(-17, 2, 10, 24, -.42, 0, TAU); context.ellipse(17, 2, 10, 24, .42, 0, TAU); context.fill();
  context.fillStyle = '#173f35'; context.beginPath(); context.arc(0, -11, 5, 0, TAU); context.fill();
  context.restore();

  output('#rope-distance', `${ropeState.rope.distance.toFixed(1)} px`);
  output('#rope-tension', ropeState.rope.tension.toFixed(0));
  output('#rope-omega', `${(ropeState.rope.angularVelocity / TAU).toFixed(2)} r/s`);
  output('#rope-activity', ropeState.activity.toFixed(2));
  requestAnimationFrame(drawRope);
}

// --- Deterministic renewal event train ------------------------------------------
function mulberry(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let result = state;
    result = Math.imul(result ^ result >>> 15, result | 1);
    result ^= result + Math.imul(result ^ result >>> 7, result | 61);
    return ((result ^ result >>> 14) >>> 0) / 4294967296;
  };
}

function normal(random: () => number): number {
  const first = Math.max(1e-9, random());
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(TAU * random());
}

function eventTimes(rate: number, cv: number, duration: number): number[] {
  const random = mulberry(0x5eedc1ca);
  const sigma = Math.sqrt(Math.log(1 + cv * cv));
  const mu = -0.5 * sigma * sigma;
  const times: number[] = [];
  let time = 0;
  while (time < duration) {
    time += Math.exp(mu + sigma * normal(random)) / rate;
    if (time < duration) times.push(time);
  }
  return times;
}

function drawEvents(): void {
  const turns = value('turn-rate');
  const cv = value('event-cv');
  const rate = turns * defaultCicadaFit.eventsPerRotation;
  const duration = 0.25;
  const events = eventTimes(rate, cv, duration);
  const { context, width, height } = surface('event-canvas');
  context.clearRect(0, 0, width, height); grid(context, width, height, width / 5, 40);
  context.strokeStyle = '#f0c75e'; context.lineWidth = 1.5;
  for (const time of events) {
    const x = time / duration * width;
    const jitter = 0.72 + 0.28 * Math.sin(time * 791.3);
    context.beginPath(); context.moveTo(x, height * .78); context.lineTo(x, height * (.78 - .58 * jitter)); context.stroke();
  }
  context.strokeStyle = '#b9dfc9'; context.lineWidth = 2; context.beginPath();
  for (let x = 0; x < width; x += 1) {
    const t = x / width * duration;
    let sample = 0;
    for (const event of events) {
      const age = t - event;
      if (age >= 0 && age < .018) sample += Math.sin(age * 1506.37 * TAU) * Math.exp(-age * 310);
    }
    const y = height * .82 - sample * height * .13;
    if (x === 0) context.moveTo(x, y); else context.lineTo(x, y);
  }
  context.stroke();
  context.fillStyle = 'rgba(248,242,226,.75)'; context.font = '10px ui-monospace, monospace';
  for (let index = 0; index <= 5; index += 1) context.fillText(`${index * 50} ms`, index / 5 * (width - 42) + 4, height - 10);
  output('[data-out="turn-rate"]', `${turns.toFixed(3)} r/s`);
  output('[data-out="event-cv"]', cv.toFixed(2));
  output('#event-rate', `${rate.toFixed(1)} Hz`);
  output('#event-gap', `${(1000 / rate).toFixed(1)} ms`);
}
for (const id of ['turn-rate', 'event-cv']) document.querySelector(`#${id}`)?.addEventListener('input', drawEvents);

// --- Analytic complex spectral model --------------------------------------------
interface Complex { re: number; im: number }
const complex = (re: number, im = 0): Complex => ({ re, im });
const add = (a: Complex, b: Complex): Complex => complex(a.re + b.re, a.im + b.im);
const sub = (a: Complex, b: Complex): Complex => complex(a.re - b.re, a.im - b.im);
const mul = (a: Complex, b: Complex): Complex => complex(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
const scale = (a: Complex, factor: number): Complex => complex(a.re * factor, a.im * factor);
const div = (a: Complex, b: Complex): Complex => {
  const denominator = b.re * b.re + b.im * b.im || 1e-18;
  return complex((a.re * b.re + a.im * b.im) / denominator, (a.im * b.re - a.re * b.im) / denominator);
};
const magnitude = (a: Complex): number => Math.hypot(a.re, a.im);
const cis = (phase: number): Complex => complex(Math.cos(phase), Math.sin(phase));

function bandpass(frequency: number, center: number, q: number): Complex {
  const x = frequency / center;
  return div(complex(0, x / q), complex(1 - x * x, x / q));
}
function highpass(frequency: number, cutoff: number): Complex {
  const x = frequency / cutoff;
  return div(complex(0, x), complex(1, x));
}

interface SpectrumPoint { frequency: number; full: number; membrane: number; hollow: number }
function spectrumData(): SpectrumPoint[] {
  const length = value('spec-length') / 1000;
  const reflection = value('spec-reflection');
  const lossAmount = value('spec-loss');
  const coupling = value('spec-coupling');
  const radiationOn = document.querySelector<HTMLInputElement>('#spec-radiation')!.checked;
  const hollowOn = document.querySelector<HTMLInputElement>('#spec-hollow')!.checked;
  const points: SpectrumPoint[] = [];
  for (let index = 0; index <= 780; index += 1) {
    const frequency = 300 + index / 780 * 6700;
    let membrane = add(bandpass(frequency, 1506.37, 10.49), scale(bandpass(frequency, 1760.85, 10.62), .54));
    if (radiationOn) membrane = mul(membrane, highpass(frequency, 1863.85));
    const omega = TAU * frequency;
    const loss = Math.exp(-lossAmount * Math.pow(frequency / 4000, 1.2));
    const roundTrip = scale(cis(-2 * omega * length / SPEED_OF_SOUND), reflection * loss);
    const tube = div(scale(cis(-omega * length / SPEED_OF_SOUND), 1 - reflection), sub(complex(1), roundTrip));
    const mouth = highpass(frequency, 429.96);
    const hollow = sub(complex(1), scale(mul(mouth, tube), coupling));
    const full = hollowOn ? mul(membrane, hollow) : membrane;
    points.push({ frequency, full: magnitude(full), membrane: magnitude(membrane), hollow: magnitude(hollow) });
  }
  return points;
}

function drawSpectrum(): void {
  const data = spectrumData();
  const peak = Math.max(...data.map((point) => point.full), 1e-12);
  const toDb = (amplitude: number): number => 20 * Math.log10(amplitude / peak + 1e-12);
  const { context, width, height } = surface('spectrum-canvas');
  context.clearRect(0, 0, width, height);
  const margin = { left: 52, right: 18, top: 18, bottom: 34 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const xFor = (frequency: number): number => margin.left + (frequency - 300) / 6700 * plotWidth;
  const yFor = (db: number): number => margin.top + clamp((-db) / 70, 0, 1) * plotHeight;
  context.font = '10px ui-monospace, monospace';
  context.lineWidth = 1;
  for (const db of [0, -10, -20, -30, -40, -50, -60, -70]) {
    const y = yFor(db); context.strokeStyle = 'rgba(185,223,201,.13)'; context.beginPath(); context.moveTo(margin.left, y); context.lineTo(width - margin.right, y); context.stroke();
    context.fillStyle = 'rgba(248,242,226,.58)'; context.fillText(`${db} dB`, 8, y + 3);
  }
  for (const frequency of [500, 1000, 1500, 2000, 3000, 4000, 5000, 6000, 7000]) {
    const x = xFor(frequency); context.strokeStyle = 'rgba(185,223,201,.09)'; context.beginPath(); context.moveTo(x, margin.top); context.lineTo(x, height - margin.bottom); context.stroke();
    context.fillStyle = 'rgba(248,242,226,.58)'; context.fillText(frequency >= 1000 ? `${frequency / 1000}k` : `${frequency}`, x - 8, height - 12);
  }
  const line = (color: string, accessor: (point: SpectrumPoint) => number, lineWidth: number): void => {
    context.strokeStyle = color; context.lineWidth = lineWidth; context.beginPath();
    data.forEach((point, index) => {
      const x = xFor(point.frequency); const y = yFor(accessor(point));
      if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
    }); context.stroke();
  };
  line('rgba(185,223,201,.72)', (point) => toDb(point.membrane), 1.5);
  line('#f0c75e', (point) => toDb(point.full), 2.4);
  line('#e97144', (point) => clamp(20 * Math.log10(point.hollow + 1e-12), -70, 0), 1.1);
  for (const frequency of [1506.37, 1760.85]) {
    const nearest = data.reduce((best, point) => Math.abs(point.frequency - frequency) < Math.abs(best.frequency - frequency) ? point : best);
    const x = xFor(frequency); const y = yFor(toDb(nearest.full));
    context.fillStyle = '#f8f2e2'; context.beginPath(); context.arc(x, y, 3.5, 0, TAU); context.fill();
    context.fillStyle = '#f0c75e'; context.fillText(`${frequency.toFixed(0)} Hz`, x + 7, y - 8);
  }
  const length = value('spec-length');
  const low = data.reduce((best, point) => Math.abs(point.frequency - 500) < Math.abs(best.frequency - 500) ? point : best);
  const peakPoint = data.reduce((best, point) => point.full > best.full ? point : best);
  output('[data-out="spec-length"]', `${length.toFixed(2)} mm`);
  output('[data-out="spec-reflection"]', value('spec-reflection').toFixed(2));
  output('[data-out="spec-loss"]', value('spec-loss').toFixed(2));
  output('[data-out="spec-coupling"]', value('spec-coupling').toFixed(2));
  output('#spec-oneway', `${(length / SPEED_OF_SOUND).toFixed(3)} ms`);
  output('#spec-roundtrip', `${(2 * length / SPEED_OF_SOUND).toFixed(3)} ms`);
  output('#spec-low', `${toDb(low.full).toFixed(1)} dB`);
  output('#spec-peak', `${peakPoint.frequency.toFixed(0)} Hz`);
}
for (const id of ['spec-length', 'spec-reflection', 'spec-loss', 'spec-coupling', 'spec-radiation', 'spec-hollow']) {
  document.querySelector(`#${id}`)?.addEventListener('input', drawSpectrum);
}

// --- Rotation AM ----------------------------------------------------------------
let amPlaying = false;
let amStart = 0;
const amInput = document.querySelector<HTMLInputElement>('#am-phase')!;
function envelopeAt(phase: number): number {
  return clamp(
    (1
      + defaultCicadaFit.primaryAmDepth * Math.cos(phase)
      + defaultCicadaFit.secondaryAmDepth * Math.cos(2 * phase + .55)) / 2.01,
    .08,
    1,
  );
}
function drawAm(now = performance.now()): void {
  if (amPlaying) {
    const progress = (now - amStart) / (1000 / defaultCicadaFit.rotationRate);
    amInput.value = String((progress % 1) * 360);
    if (progress >= 1) { amPlaying = false; amInput.value = '360'; }
  }
  const phaseDegrees = value('am-phase');
  const phase = phaseDegrees / 360 * TAU;
  const { context, width, height } = surface('am-canvas');
  context.clearRect(0, 0, width, height); grid(context, width, height, width / 8, 40);
  const samples = 360;
  const values = Array.from({ length: samples + 1 }, (_, index) => envelopeAt(index / samples * TAU));
  const minimum = Math.min(...values); const maximum = Math.max(...values);
  context.strokeStyle = '#f0c75e'; context.lineWidth = 2.5; context.beginPath();
  values.forEach((current, index) => {
    const x = index / samples * width; const y = height - 32 - (current - minimum) / (maximum - minimum) * (height - 64);
    if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
  }); context.stroke();
  const current = envelopeAt(phase); const x = phase / TAU * width; const y = height - 32 - (current - minimum) / (maximum - minimum) * (height - 64);
  context.strokeStyle = 'rgba(233,113,68,.7)'; context.lineWidth = 1; context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke();
  context.fillStyle = '#e97144'; context.beginPath(); context.arc(x, y, 6, 0, TAU); context.fill();
  context.fillStyle = 'rgba(248,242,226,.72)'; context.font = '10px ui-monospace, monospace';
  for (let degree = 0; degree <= 360; degree += 90) context.fillText(`${degree}°`, degree / 360 * (width - 28) + 3, height - 10);
  output('[data-out="am-phase"]', `${phaseDegrees.toFixed(0)}°`);
  output('#am-value', current.toFixed(3));
  if (amPlaying) requestAnimationFrame(drawAm);
}
amInput.addEventListener('input', () => { amPlaying = false; drawAm(); });
document.querySelector('#am-play')?.addEventListener('click', () => { amPlaying = true; amStart = performance.now(); requestAnimationFrame(drawAm); });

// Keep canvas plots crisp after layout changes.
const redrawStatic = (): void => { drawEvents(); drawSpectrum(); drawAm(); };
window.addEventListener('resize', redrawStatic);

resetRope();
syncRopeOptions();
drawEvents();
drawSpectrum();
drawAm();
requestAnimationFrame(drawRope);

// Surface canonical values for browser QA without creating audio or network activity.
(window as Window & { __zhuzhiliaoScience?: unknown }).__zhuzhiliaoScience = {
  fit: defaultCicadaFit,
  physics: defaultPhysicsOptions,
  spectrumData,
};
