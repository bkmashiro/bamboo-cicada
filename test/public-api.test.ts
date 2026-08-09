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

function pointerEvent(type: string, pointerId: number): Event {
  const event = new Event(type, { bubbles: true, composed: true });
  Object.defineProperty(event, 'pointerId', { value: pointerId });
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
