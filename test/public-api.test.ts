import { afterEach, describe, expect, it } from 'vitest';
import { BambooCicadaElement, mountBambooCicada } from '../src/index';

afterEach(() => document.body.replaceChildren());

describe('public API', () => {
  it('mounts an isolated custom element into any host', () => {
    const host = document.createElement('div');
    document.body.append(host);

    const toy = mountBambooCicada(host, { label: '转起来' });

    expect(toy).toBeInstanceOf(BambooCicadaElement);
    expect(host.querySelector('bamboo-cicada')).toBe(toy);
    expect(toy.shadowRoot?.textContent).toContain('转起来');
  });

  it('supports idempotent destroy', () => {
    const toy = mountBambooCicada(document.body);
    toy.destroy();
    expect(() => toy.destroy()).not.toThrow();
    expect(document.body.querySelector('bamboo-cicada')).toBeNull();
  });

  it('registers the declarative custom element', () => {
    expect(customElements.get('bamboo-cicada')).toBe(BambooCicadaElement);
  });
});
