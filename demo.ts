import { mountBambooCicada } from './src/index';

const toy = mountBambooCicada();
const autoButton = document.querySelector<HTMLButtonElement>('#auto')!;
const soundButton = document.querySelector<HTMLButtonElement>('#sound')!;
const tip = document.querySelector<HTMLElement>('#tip')!;
let auto = false;
let sound = true;

autoButton.addEventListener('click', () => {
  auto = !auto;
  if (auto) toy.startAuto(); else toy.stopAuto();
  autoButton.setAttribute('aria-pressed', String(auto));
  autoButton.textContent = auto ? '停止' : '自动甩';
  tip.classList.add('hidden');
});

soundButton.addEventListener('click', () => {
  sound = !sound;
  toy.configure({ sound });
  soundButton.setAttribute('aria-pressed', String(sound));
  soundButton.textContent = sound ? '声音开' : '声音关';
});

toy.addEventListener('pointerdown', () => {
  auto = false;
  autoButton.setAttribute('aria-pressed', 'false');
  autoButton.textContent = '自动甩';
  tip.classList.add('hidden');
}, { once: true });
