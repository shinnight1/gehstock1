import { describe, it, expect } from 'vitest';
import { isqrt, dist, schrittRichtung, skaliere, MT, tile } from '../src/fixed.js';

describe('Festkomma', () => {
  it('rechnet isqrt exakt', () => {
    for (let n = 0; n < 2000; n++) {
      const w = isqrt(n);
      expect(w * w).toBeLessThanOrEqual(n);
      expect((w + 1) * (w + 1)).toBeGreaterThan(n);
    }
  });

  it('rechnet isqrt auch bei grossen Zahlen exakt', () => {
    for (const n of [1e6, 1234567890, 4e9, 1e12, 999999999999]) {
      const w = isqrt(n);
      expect(w * w).toBeLessThanOrEqual(n);
      expect((w + 1) * (w + 1)).toBeGreaterThan(n);
    }
  });

  it('misst Distanzen im Millitile-Raster', () => {
    expect(dist(0, 0, tile(3), tile(4))).toBe(tile(5));
  });

  it('normiert einen Schritt auf die gewuenschte Laenge', () => {
    const raus = { x: 0, y: 0 };
    schrittRichtung(tile(3), tile(4), 100, raus);
    const laenge = isqrt(raus.x * raus.x + raus.y * raus.y);
    expect(Math.abs(laenge - 100)).toBeLessThanOrEqual(2);
  });

  it('liefert bei Nullrichtung keinen Schritt', () => {
    const raus = { x: 9, y: 9 };
    schrittRichtung(0, 0, 500, raus);
    expect(raus).toEqual({ x: 0, y: 0 });
  });

  it('skaliert Kartenlevel ohne Fliesskomma-Drift', () => {
    expect(skaliere(1000, 1070)).toBe(1070);
    expect(skaliere(333, 1311)).toBe(437);
    expect(MT).toBe(1000);
  });
});
