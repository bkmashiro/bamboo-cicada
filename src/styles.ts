export const styles = `
  :host {
    --bc-accent: #d86f45;
    --bc-ink: #24332b;
    display: inline-block;
    width: min(100%, 22rem);
    color: var(--bc-ink);
    font-family: ui-rounded, "SF Pro Rounded", "Nunito", system-ui, sans-serif;
    contain: content;
  }
  * { box-sizing: border-box; }
  .toy {
    position: relative;
    overflow: hidden;
    aspect-ratio: 4 / 5;
    min-height: 22rem;
    border: 1px solid color-mix(in srgb, var(--bc-ink) 12%, transparent);
    border-radius: 1.8rem;
    background:
      radial-gradient(circle at 78% 17%, rgba(255,255,255,.75) 0 5%, transparent 5.2%),
      linear-gradient(155deg, #fff6df, #e9f0d3 58%, #cbdcb9);
    box-shadow: 0 1.2rem 3.2rem rgba(56, 72, 43, .16);
    user-select: none;
    touch-action: none;
  }
  .topline {
    position: absolute;
    z-index: 2;
    inset: 1rem 1.1rem auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    pointer-events: none;
  }
  .label { font-size: .93rem; font-weight: 750; letter-spacing: .04em; }
  .speed {
    min-width: 3.7rem;
    padding: .34rem .55rem;
    border-radius: 99rem;
    background: rgba(255,255,255,.62);
    font: 700 .7rem/1 ui-monospace, monospace;
    text-align: center;
  }
  svg { width: 100%; height: 100%; display: block; overflow: visible; }
  .cord { stroke: #765f42; stroke-width: 2.2; stroke-linecap: round; }
  .handle { fill: #c69456; stroke: #6e5438; stroke-width: 2; }
  .handle-shine { fill: none; stroke: rgba(255,255,255,.45); stroke-width: 3; stroke-linecap: round; }
  .hub { fill: var(--bc-accent); stroke: #6e3d2b; stroke-width: 2; }
  .bug-body { fill: #7ea04e; stroke: #3d572d; stroke-width: 2; }
  .bug-belly { fill: #c8d987; }
  .wing { fill: rgba(235,247,203,.82); stroke: #607d43; stroke-width: 1.5; }
  .eye { fill: #253126; }
  .motion { opacity: 0; fill: none; stroke: var(--bc-accent); stroke-width: 3; stroke-linecap: round; transition: opacity .18s; }
  .toy[data-active="true"] .motion { opacity: .56; }
  .hint {
    position: absolute;
    inset: auto 1rem 1rem;
    margin: 0;
    color: color-mix(in srgb, var(--bc-ink) 72%, transparent);
    font-size: .76rem;
    line-height: 1.4;
    text-align: center;
    pointer-events: none;
  }
  button {
    position: absolute;
    z-index: 3;
    right: 1rem;
    bottom: 3.3rem;
    width: 3rem;
    height: 3rem;
    border: 0;
    border-radius: 50%;
    color: white;
    background: var(--bc-accent);
    box-shadow: 0 .5rem 1.2rem rgba(121, 62, 39, .25);
    cursor: pointer;
    font: 800 1rem/1 inherit;
    transition: transform .15s, filter .15s;
  }
  button:hover { transform: scale(1.06); filter: brightness(1.04); }
  button:focus-visible { outline: 3px solid white; box-shadow: 0 0 0 5px var(--bc-accent); }
  button[aria-pressed="true"] { transform: scale(.94); }
  @media (prefers-reduced-motion: reduce) { button, .motion { transition: none; } }
`;
