import { BambooCicadaElement, type BambooCicadaOptions } from './bamboo-cicada';

export { BambooCicadaElement };
export type { BambooCicadaOptions };
export { angularVelocity, damp, soundLevel } from './physics';

export function defineBambooCicada(): void {
  if (!customElements.get('bamboo-cicada')) {
    customElements.define('bamboo-cicada', BambooCicadaElement);
  }
}

export function mountBambooCicada(
  host: Element,
  options: BambooCicadaOptions = {},
): BambooCicadaElement {
  defineBambooCicada();
  const element = document.createElement('bamboo-cicada') as BambooCicadaElement;
  element.configure(options);
  host.append(element);
  return element;
}

if (typeof window !== 'undefined' && 'customElements' in window) {
  defineBambooCicada();
}
