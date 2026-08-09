import { BambooCicadaElement, type BambooCicadaOptions } from './bamboo-cicada';

export { BambooCicadaElement };
export type { BambooCicadaOptions };
export { DefaultCicadaRenderer } from './renderer';
export { SynthCicadaVoice, mapVoiceParameters, defaultCicadaAcoustics, defaultCicadaFit } from './audio';
export type { CicadaAcoustics, CicadaFit, CicadaPlaybackState, CicadaVoice, FittedResonanceMode, HollowTubeFit, ResonanceFamily, VoiceParameters } from './audio';
export { createPhysics, stepPhysics, defaultPhysicsOptions } from './physics';
export type { BodyPoint, PhysicsOptions, PhysicsState, Point, RopeState } from './physics';
export type {
  CicadaParts,
  CicadaPart,
  CicadaRenderer,
  MotionState,
  PartDefinition,
  PartSocket,
  PartSource,
  RendererMountContext,
} from './types';

export function defineBambooCicada(): void {
  if (typeof customElements !== 'undefined' && !customElements.get('bamboo-cicada')) {
    customElements.define('bamboo-cicada', BambooCicadaElement);
  }
}

export function mountBambooCicada(): BambooCicadaElement;
export function mountBambooCicada(options: BambooCicadaOptions): BambooCicadaElement;
export function mountBambooCicada(host: Element, options?: BambooCicadaOptions): BambooCicadaElement;
export function mountBambooCicada(
  hostOrOptions?: Element | BambooCicadaOptions,
  maybeOptions: BambooCicadaOptions = {},
): BambooCicadaElement {
  if (typeof document === 'undefined') {
    throw new Error('mountBambooCicada() requires a browser document. Importing zhuzhiliao remains SSR-safe.');
  }
  defineBambooCicada();
  const isHost = hostOrOptions != null && typeof (hostOrOptions as Element).append === 'function';
  const host = isHost ? hostOrOptions as Element : document.body;
  const options = isHost ? maybeOptions : hostOrOptions as BambooCicadaOptions | undefined;
  const element = document.createElement('bamboo-cicada') as BambooCicadaElement;
  element.configure(options ?? {});
  host.append(element);
  return element;
}

if (typeof window !== 'undefined' && 'customElements' in window) {
  defineBambooCicada();
}
