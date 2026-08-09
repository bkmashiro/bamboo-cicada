import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BambooCicadaElement,
  mountBambooCicada,
  type CicadaRenderer,
  type CicadaVoice,
  type MotionState,
} from '../src/index';

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

function pointerEvent(type: string, pointerId: number, clientX = 0, clientY = 0): Event {
  const event = new Event(type, { bubbles: true, composed: true });
  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    clientX: { value: clientX },
    clientY: { value: clientY },
  });
  return event;
}

describe('floating public API', () => {
  it('mounts to document.body by default with only the toy surface', () => {
    const toy = mountBambooCicada();

    expect(toy).toBeInstanceOf(BambooCicadaElement);
    expect(toy.parentElement).toBe(document.body);
    expect(toy.shadowRoot?.querySelector('[part="pole"]')).not.toBeNull();
    expect(toy.shadowRoot?.querySelector('[part="cord"]')).not.toBeNull();
    expect(toy.shadowRoot?.querySelector('[part="cicada"]')).not.toBeNull();
    expect(toy.shadowRoot?.querySelector('h1, header, p, button, .card')).toBeNull();
  });

  it('keeps the existing host-first mount overload', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const toy = mountBambooCicada(host, { sound: false });
    expect(toy.parentElement).toBe(host);
  });

  it('accepts arbitrary DOM nodes for the cicada and pole', () => {
    const svgCicada = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const cicada = document.createElement('img');
    cicada.alt = '我的知了';
    const pole = document.createElement('strong');
    pole.textContent = '自定义杆';

    const toy = mountBambooCicada({ parts: { cicada, pole }, sound: false });
    const svgToy = mountBambooCicada({ parts: { cicada: svgCicada }, sound: false });

    expect(cicada.slot).toBe('cicada');
    expect(pole.slot).toBe('pole');
    expect(svgCicada.getAttribute('slot')).toBe('cicada');
    expect(toy.contains(cicada)).toBe(true);
    expect(toy.contains(pole)).toBe(true);
    expect(svgToy.contains(svgCicada)).toBe(true);
  });

  it('aligns arbitrary DOM parts by explicit normalized attachment sockets', () => {
    const cicada = document.createElement('img');
    const pole = document.createElement('button');
    const toy = mountBambooCicada({
      sound: false,
      parts: {
        cicada: { source: cicada, socket: { x: 0.5, y: 0.052 } },
        pole: { source: pole, socket: { x: 0.25, y: 0.8 } },
      },
    });

    expect(cicada.style.getPropertyValue('--bc-part-offset-x')).toBe('-50%');
    expect(cicada.style.getPropertyValue('--bc-part-offset-y')).toBe('-5.2%');
    expect(pole.style.getPropertyValue('--bc-part-offset-x')).toBe('-25%');
    expect(pole.style.getPropertyValue('--bc-part-offset-y')).toBe('-80%');
    expect(cicada.dataset.bcSocket).toBe('0.5,0.052');
    expect(toy.contains(pole)).toBe(true);
  });

  it('restores fallback skins and clamps unsafe socket coordinates', () => {
    const cicada = document.createElement('span');
    const toy = mountBambooCicada({
      sound: false,
      parts: { cicada: { source: cicada, socket: { x: 4, y: Number.NaN } } },
    });
    expect(cicada.style.getPropertyValue('--bc-part-offset-x')).toBe('-100%');
    expect(cicada.style.getPropertyValue('--bc-part-offset-y')).toBe('-12.5%');

    toy.configure({ parts: { cicada: null, pole: null } });
    expect(toy.querySelector('[slot="cicada"]')).toBeNull();
    expect(toy.querySelector('[slot="pole"]')).toBeNull();
    expect(toy.shadowRoot?.querySelector('.default-cicada')).not.toBeNull();
    expect(toy.shadowRoot?.querySelector('.default-pole')).not.toBeNull();
  });

  it('reads attachment sockets from declarative HTML slots', () => {
    const toy = document.createElement('bamboo-cicada') as BambooCicadaElement;
    const image = document.createElement('img');
    image.slot = 'cicada';
    image.dataset.bcSocket = '0.4,0.08';
    toy.append(image);
    document.body.append(toy);

    expect(image.style.getPropertyValue('--bc-part-offset-x')).toBe('-40%');
    expect(image.style.getPropertyValue('--bc-part-offset-y')).toBe('-8%');
  });

  it('preserves native clicks on DOM skins but suppresses the click after a drag', () => {
    const button = document.createElement('button');
    let clicks = 0;
    button.addEventListener('click', () => { clicks += 1; });
    const toy = mountBambooCicada({ sound: false, parts: { cicada: button } });

    button.dispatchEvent(pointerEvent('pointerdown', 31, 500, 300));
    button.dispatchEvent(pointerEvent('pointerup', 31, 500, 300));
    button.click();
    expect(clicks).toBe(1);

    button.dispatchEvent(pointerEvent('pointerdown', 32, 500, 300));
    button.dispatchEvent(pointerEvent('pointermove', 32, 530, 300));
    button.dispatchEvent(pointerEvent('pointerup', 32, 530, 300));
    button.click();
    expect(clicks).toBe(1);
    expect(toy.motion.dragging).toBe(false);
  });

  it('accepts part factories so every instance gets fresh DOM', () => {
    const factory = vi.fn(() => document.createElement('i'));
    const one = mountBambooCicada({ parts: { cicada: factory }, sound: false });
    const two = mountBambooCicada({ parts: { cicada: factory }, sound: false });
    expect(factory).toHaveBeenCalledTimes(2);
    expect(one.querySelector('[slot="cicada"]')).not.toBe(two.querySelector('[slot="cicada"]'));
  });

  it('replaces an existing declarative part during runtime configuration', () => {
    const toy = document.createElement('bamboo-cicada') as BambooCicadaElement;
    const original = document.createElement('span');
    original.slot = 'cicada';
    toy.append(original);
    document.body.append(toy);

    toy.configure({ parts: { cicada: document.createElement('img') }, sound: false });

    expect(toy.querySelectorAll('[slot="cicada"]')).toHaveLength(1);
    expect(toy.contains(original)).toBe(false);
  });

  it('returns detached motion snapshots', () => {
    const toy = mountBambooCicada({ sound: false });
    const snapshot = toy.motion;
    (snapshot.anchor as { x: number }).x = 999;
    (snapshot.body as { y: number }).y = -999;
    (snapshot.rope as { angle: number }).angle = 42;

    expect(toy.motion.anchor.x).not.toBe(999);
    expect(toy.motion.body.y).not.toBe(-999);
    expect(toy.motion.rope.angle).not.toBe(42);
  });

  it('clears pointer state across disconnect, lost capture, and reconnect', () => {
    const toy = mountBambooCicada({ sound: false });
    const target = toy.shadowRoot!.querySelector<HTMLElement>('.scene')!;

    target.dispatchEvent(pointerEvent('pointerdown', 7));
    expect(toy.motion.dragging).toBe(true);
    target.dispatchEvent(pointerEvent('lostpointercapture', 7));
    expect(toy.motion.dragging).toBe(false);

    target.dispatchEvent(pointerEvent('pointerdown', 8));
    toy.remove();
    expect(toy.motion.dragging).toBe(false);
    document.body.append(toy);
    target.dispatchEvent(pointerEvent('pointerdown', 9));
    expect(toy.motion.dragging).toBe(true);
  });

  it('keeps the grabbed pole point locked to the pointer through repeated shaking', () => {
    const toy = mountBambooCicada({ sound: false });
    const target = toy.shadowRoot!.querySelector<HTMLElement>('.scene')!;
    const start = toy.motion.anchor;
    const grab = { x: start.x + 9, y: start.y - 6 };
    target.dispatchEvent(pointerEvent('pointerdown', 12, grab.x, grab.y));

    const deltas = [-18, 24, -31, 36, -22, 15];
    for (const deltaX of deltas) {
      target.dispatchEvent(pointerEvent('pointermove', 12, grab.x + deltaX, grab.y));
      expect(toy.motion.anchor.x).toBeCloseTo(start.x + deltaX, 6);
      expect(toy.motion.anchor.y).toBeCloseTo(start.y, 6);
    }
  });

  it('resumes an active automatic loop after reconnect', () => {
    const raf = vi.spyOn(globalThis, 'requestAnimationFrame');
    const toy = mountBambooCicada({ sound: false });
    toy.startAuto();
    const callsBeforeReconnect = raf.mock.calls.length;

    toy.remove();
    document.body.append(toy);

    expect(toy.motion.auto).toBe(true);
    expect(raf.mock.calls.length).toBeGreaterThan(callsBeforeReconnect);
    raf.mockRestore();
  });

  it('drives a forceful sustained automatic circle without repeatedly losing the rope', () => {
    const frames = new Map<number, FrameRequestCallback>();
    let nextFrame = 1;
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      const id = nextFrame++;
      frames.set(id, callback);
      return id;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => frames.delete(id)));

    const toy = mountBambooCicada({ sound: false });
    toy.startAuto();
    const samples: MotionState[] = [];
    let time = performance.now();
    for (let step = 0; step < 360; step += 1) {
      const [id, callback] = frames.entries().next().value as [number, FrameRequestCallback];
      frames.delete(id);
      time += 1000 / 60;
      callback(time);
      if (step >= 120) samples.push(toy.motion);
    }

    const signedTurns = samples.map((motion) => motion.rope.angularVelocity / (Math.PI * 2));
    const slackFraction = samples.filter((motion) => motion.rope.distance < motion.rope.length * 0.99).length / samples.length;
    const anchorX = samples.map((motion) => motion.anchor.x);
    const anchorExcursion = Math.max(...anchorX) - Math.min(...anchorX);
    const meanTurns = signedTurns.reduce((sum, turns) => sum + turns, 0) / signedTurns.length;

    expect(anchorExcursion).toBeGreaterThan(100);
    expect(slackFraction).toBeLessThan(0.2);
    expect(signedTurns.filter((turns) => turns < 0)).toHaveLength(0);
    expect(meanTurns).toBeGreaterThan(2);
    expect(meanTurns).toBeLessThan(2.7);
  });

  it('unlocks injected audio from pointer and keyboard gestures', () => {
    const voice: CicadaVoice = {
      unlock: vi.fn(),
      update: vi.fn(),
      silence: vi.fn(),
      destroy: vi.fn(),
    };
    const toy = mountBambooCicada({ voice: () => voice });
    const target = toy.shadowRoot!.querySelector<HTMLElement>('.scene')!;

    expect(voice.unlock).not.toHaveBeenCalled();
    target.dispatchEvent(pointerEvent('pointerdown', 1));
    expect(voice.unlock).toHaveBeenCalledTimes(1);
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(voice.unlock).toHaveBeenCalledTimes(2);
  });

  it('exposes a keyboard-operable interaction surface with the configured label', () => {
    const toy = mountBambooCicada({ label: '旋转竹知了', sound: false });
    const target = toy.shadowRoot!.querySelector<HTMLElement>('.scene')!;

    expect(target.getAttribute('role')).toBe('button');
    expect(target.tabIndex).toBe(0);
    expect(target.getAttribute('aria-label')).toBe('旋转竹知了');
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(toy.motion.auto).toBe(true);
    target.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(toy.motion.auto).toBe(false);
  });

  it('keeps integrating gravity until the idle rope reaches vertical equilibrium', () => {
    const frames = new Map<number, FrameRequestCallback>();
    let nextFrame = 1;
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      const id = nextFrame++;
      frames.set(id, callback);
      return id;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => frames.delete(id)));

    const toy = mountBambooCicada({ sound: false });
    toy.setAnchor(120, 140);

    let time = performance.now();
    for (let step = 0; step < 4000 && frames.size > 0; step += 1) {
      const [id, callback] = frames.entries().next().value as [number, FrameRequestCallback];
      frames.delete(id);
      time += 1000 / 60;
      callback(time);
    }

    const motion = toy.motion;
    expect(frames.size).toBe(0);
    expect(motion.rope.distance).toBeGreaterThanOrEqual(motion.rope.length);
    expect(motion.rope.distance - motion.rope.length).toBeLessThan(1);
    expect(motion.rope.angle).toBeCloseTo(Math.PI / 2, 3);
    expect(Math.hypot(motion.body.vx, motion.body.vy)).toBe(0);
  });

  it('settles a long rope vertically against a short viewport boundary', () => {
    vi.stubGlobal('innerWidth', 320);
    vi.stubGlobal('innerHeight', 360);
    const frames = new Map<number, FrameRequestCallback>();
    let nextFrame = 1;
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      const id = nextFrame++;
      frames.set(id, callback);
      return id;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => frames.delete(id)));

    const toy = mountBambooCicada({ sound: false, physics: { ropeLength: 220 } });
    toy.setAnchor(100, 200);

    let time = performance.now();
    for (let step = 0; step < 4000 && frames.size > 0; step += 1) {
      const [id, callback] = frames.entries().next().value as [number, FrameRequestCallback];
      frames.delete(id);
      time += 1000 / 60;
      callback(time);
    }

    const motion = toy.motion;
    expect(frames.size).toBe(0);
    expect(motion.rope.angle).toBeCloseTo(Math.PI / 2, 3);
    expect(motion.body.x).toBe(100);
    expect(motion.body.y).toBe(296);
    expect(motion.rope.distance).toBe(96);
    expect(Math.hypot(motion.body.vx, motion.body.vy)).toBe(0);
  });

  it('supports injected audio and renderer factories with explicit ownership', () => {
    const voice: CicadaVoice = {
      update: vi.fn(),
      silence: vi.fn(),
      destroy: vi.fn(),
    };
    const renderer: CicadaRenderer = {
      mount: vi.fn(),
      render: vi.fn((_state: Readonly<MotionState>) => undefined),
      destroy: vi.fn(),
    };
    const rendererFactory = vi.fn(() => renderer);

    const toy = mountBambooCicada({ voice: () => voice, renderer: rendererFactory, sound: false });
    expect(rendererFactory).toHaveBeenCalledOnce();
    expect(renderer.mount).toHaveBeenCalledOnce();
    toy.destroy();
    expect(renderer.destroy).toHaveBeenCalledOnce();
    expect(voice.destroy).toHaveBeenCalledOnce();
  });

  it('leaves directly injected shared renderers alive on destroy', () => {
    const renderer: CicadaRenderer = {
      mount: vi.fn(),
      render: vi.fn(),
      destroy: vi.fn(),
    };
    const toy = mountBambooCicada({ renderer, sound: false });
    toy.destroy();
    expect(renderer.destroy).not.toHaveBeenCalled();
  });

  it('registers the declarative element and supports light-DOM slots', () => {
    const toy = document.createElement('bamboo-cicada');
    const cicada = document.createElement('span');
    cicada.slot = 'cicada';
    toy.append(cicada);
    document.body.append(toy);
    expect(customElements.get('bamboo-cicada')).toBe(BambooCicadaElement);
    expect(toy.shadowRoot?.querySelector('slot[name="cicada"]')).not.toBeNull();
  });

  it('supports idempotent destroy', () => {
    const toy = mountBambooCicada();
    toy.destroy();
    expect(() => toy.destroy()).not.toThrow();
    expect(document.body.querySelector('bamboo-cicada')).toBeNull();
  });
});
