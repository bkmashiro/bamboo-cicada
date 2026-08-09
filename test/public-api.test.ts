import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BambooCicadaElement,
  mountBambooCicada,
  type CicadaRenderer,
  type CicadaVoice,
  type MotionState,
} from '../src/index';

afterEach(() => document.body.replaceChildren());

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

  it('supports injected audio and renderer contracts with explicit ownership', () => {
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

    const toy = mountBambooCicada({ voice: () => voice, renderer, sound: false });
    expect(renderer.mount).toHaveBeenCalledOnce();
    toy.destroy();
    expect(renderer.destroy).toHaveBeenCalledOnce();
    expect(voice.destroy).toHaveBeenCalledOnce();
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
