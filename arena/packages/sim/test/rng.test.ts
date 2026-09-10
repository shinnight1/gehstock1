import { describe, it, expect } from 'vitest';
import {
  rngAusSeed, rngKopie, rngNext, rngInt, rngChance, rngMische,
} from '../src/rng.js';

describe('RNG', () => {
  it('liefert fuer denselben Seed dieselbe Folge', () => {
    const a = rngAusSeed(12345);
    const b = rngAusSeed(12345);
    for (let i = 0; i < 500; i++) expect(rngNext(a)).toBe(rngNext(b));
  });

  it('liefert fuer andere Seeds andere Folgen', () => {
    const a = rngAusSeed(1);
    const b = rngAusSeed(2);
    let gleich = 0;
    for (let i = 0; i < 100; i++) if (rngNext(a) === rngNext(b)) gleich++;
    expect(gleich).toBeLessThan(3);
  });

  it('bleibt nach dem Kopieren synchron', () => {
    const a = rngAusSeed(999);
    for (let i = 0; i < 50; i++) rngNext(a);
    const b = rngKopie(a);
    for (let i = 0; i < 200; i++) expect(rngNext(a)).toBe(rngNext(b));
  });

  it('bleibt bei rngInt im Bereich', () => {
    const s = rngAusSeed(7);
    for (let i = 0; i < 5000; i++) {
      const n = rngInt(s, 6);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(6);
    }
  });

  it('verteilt rngInt gleichmaessig genug', () => {
    const s = rngAusSeed(4242);
    const faecher: number[] = new Array(10).fill(0);
    const n = 200000;
    for (let i = 0; i < n; i++) faecher[rngInt(s, 10)]!++;
    for (const anzahl of faecher) {
      expect(Math.abs(anzahl - n / 10)).toBeLessThan((n / 10) * 0.02);
    }
  });

  it('trifft rngChance in der richtigen Haeufigkeit', () => {
    const s = rngAusSeed(31337);
    let treffer = 0;
    const n = 100000;
    for (let i = 0; i < n; i++) if (rngChance(s, 250, 1000)) treffer++;
    expect(Math.abs(treffer / n - 0.25)).toBeLessThan(0.01);
  });

  it('mischt ohne Elemente zu verlieren', () => {
    const s = rngAusSeed(5);
    const liste = [1, 2, 3, 4, 5, 6, 7, 8];
    rngMische(s, liste);
    expect([...liste].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});
