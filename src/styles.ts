export const floatingStyles = `
  :host {
    position: fixed;
    inset: 0;
    z-index: 2147483000;
    display: block;
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    pointer-events: none;
    contain: layout style;
    user-select: none;
    -webkit-user-select: none;
  }
  *, *::before, *::after { box-sizing: border-box; }
  .scene {
    position: absolute;
    inset: 0;
    overflow: visible;
    pointer-events: none;
    touch-action: none;
  }
  .cord-layer { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
  .cord {
    fill: none;
    stroke: rgba(92, 64, 35, .78);
    stroke-width: 1.5;
    stroke-linecap: round;
    filter: drop-shadow(0 1px 1px rgba(255,255,255,.45));
  }
  .part {
    position: absolute;
    left: 0;
    top: 0;
    width: 0;
    height: 0;
    transform-origin: 0 0;
    will-change: transform;
  }
  .pole, .cicada,
  .default-pole, .default-cicada,
  slot[name='pole']::slotted(*), slot[name='cicada']::slotted(*) {
    pointer-events: auto;
    cursor: grab;
    touch-action: none;
  }
  .pole:active, .cicada:active { cursor: grabbing; }
  .default-pole {
    position: relative;
    width: 28px;
    height: 132px;
    transform: translate(-14px, -9px);
    filter: drop-shadow(1px 4px 3px rgba(35, 24, 10, .24));
  }
  .default-pole::before {
    content: '';
    position: absolute;
    left: 10px;
    top: 12px;
    width: 8px;
    height: 120px;
    border-radius: 6px;
    background:
      linear-gradient(90deg, rgba(81,47,13,.4), transparent 22% 67%, rgba(255,240,174,.34)),
      repeating-linear-gradient(0deg, #bf8437 0 22px, #9e6427 22px 24px);
    border: 1px solid #80501f;
  }
  .default-pole .bead {
    position: absolute;
    left: 5px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: radial-gradient(circle at 33% 28%, #ff8d5d 0 8%, var(--bc-accent, #b92820) 34%, #6d0f13 78%);
    border: 1px solid #6e1011;
  }
  .default-pole .bead.top { top: 0; }
  .default-pole .bead.lower { top: 21px; transform: scale(.82); }
  .default-cicada {
    position: relative;
    width: 76px;
    height: 84px;
    transform: translate(-38px, -10.5px);
    filter: drop-shadow(2px 7px 5px rgba(28, 20, 10, .28));
  }
  .default-cicada .tube {
    position: absolute;
    left: 20px;
    top: 8px;
    width: 36px;
    height: 63px;
    z-index: 2;
    border: 1px solid #7c4f20;
    border-radius: 47% 47% 34% 34% / 14% 14% 10% 10%;
    background:
      linear-gradient(90deg, rgba(79,46,11,.38), rgba(255,235,164,.2) 25%, transparent 52%, rgba(88,52,15,.22)),
      repeating-linear-gradient(90deg, #c79245 0 4px, #d5a658 4px 7px, #b67b32 7px 9px);
  }
  .default-cicada .rim {
    position: absolute;
    left: 18px;
    top: 4px;
    width: 40px;
    height: 13px;
    z-index: 4;
    border-radius: 50%;
    border: 2px solid #731415;
    background: radial-gradient(ellipse, #e8bd70 0 49%, var(--bc-accent, #9f241f) 51% 72%, #5d1012 74%);
  }
  .default-cicada .wing {
    position: absolute;
    top: 25px;
    width: 24px;
    height: 54px;
    border-radius: 65% 38% 72% 35%;
    border: 1px solid #8c612c;
    background: linear-gradient(110deg, rgba(244,216,144,.9), rgba(163,107,43,.92));
    transform-origin: 50% 8%;
  }
  .default-cicada .wing.left { left: 7px; transform: rotate(19deg); }
  .default-cicada .wing.right { right: 7px; transform: rotate(-19deg) scaleX(-1); }
  .default-cicada .eye {
    position: absolute;
    z-index: 5;
    top: 20px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, #fff 0 9%, #17120d 35%);
  }
  .default-cicada .eye.left { left: 28px; }
  .default-cicada .eye.right { right: 28px; }
  .scene[data-active='true'] .default-cicada .rim {
    box-shadow: 0 0 16px rgba(234, 106, 57, .55);
  }
  .scene[data-active='true'] .wing.left { animation: wing-left .075s ease-in-out infinite alternate; }
  .scene[data-active='true'] .wing.right { animation: wing-right .075s ease-in-out infinite alternate; }
  @keyframes wing-left { to { transform: rotate(27deg); } }
  @keyframes wing-right { to { transform: rotate(-27deg) scaleX(-1); } }
  @media (prefers-reduced-motion: reduce) {
    .scene[data-active='true'] .wing { animation: none !important; }
  }
`;
