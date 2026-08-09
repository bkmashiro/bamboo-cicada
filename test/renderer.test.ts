import { describe, expect, it } from 'vitest';
import { floatingStyles } from '../src/styles';

describe('default attachment sockets', () => {
  it('rotates both visual parts around the zero-sized physics socket', () => {
    expect(floatingStyles).toMatch(/\.part\s*\{[^}]*width:\s*0;[^}]*height:\s*0;[^}]*transform-origin:\s*0 0;/s);
    expect(floatingStyles).not.toMatch(/\.pole\s*\{\s*transform-origin:\s*50%/);
  });

  it('uses the whole viewport as its transparent interaction coordinate space', () => {
    expect(floatingStyles).toMatch(/:host\s*\{[^}]*inset:\s*0;[^}]*width:\s*100vw;[^}]*height:\s*100vh;/s);
    expect(floatingStyles).not.toContain('width: min(76vw, 340px)');
  });

  it('places the pole bead and cicada membrane centers on the socket', () => {
    expect(floatingStyles).toContain('transform: translate(-14px, -9px)');
    expect(floatingStyles).toContain('transform: translate(-38px, -10.5px)');
  });
});
