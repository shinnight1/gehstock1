import { describe, it, expect } from 'vitest';
import { BREITE, HOEHE, tile } from '@arena/sim';
import {
  kameraAnlegen, kameraNeuBerechnen, pxX, pxY, mtX, mtY,
  skalaBei, pxHoehe, trifftArena,
} from '../src/render/kamera.js';

function kamera(gespiegelt = false) {
  const k = kameraAnlegen(gespiegelt);
  kameraNeuBerechnen(k, 1180, 820);
  return k;
}

describe('Perspektivkamera', () => {
  it('haelt die Arena innerhalb der Flaeche', () => {
    const k = kamera();
    expect(k.x0).toBeGreaterThanOrEqual(0);
    expect(k.y0).toBeGreaterThanOrEqual(0);
    expect(k.x0 + k.breitePx).toBeLessThanOrEqual(1180);
    expect(k.y0 + k.hoehePx).toBeLessThanOrEqual(820);
  });

  it('zeichnet die Hinterkante schmaler als die Vorderkante', () => {
    const k = kamera();
    const vorne = pxX(k, BREITE, HOEHE) - pxX(k, 0, HOEHE);
    const hinten = pxX(k, BREITE, 0) - pxX(k, 0, 0);
    expect(hinten).toBeLessThan(vorne);
    // Der gewaehlte Massstab hinten ist 0.78.
    expect(hinten / vorne).toBeCloseTo(0.78, 2);
  });

  it('laesst y ueber das ganze Feld monoton wachsen', () => {
    const k = kamera();
    let vorher = -Infinity;
    for (let t = 0; t <= 32; t++) {
      const y = pxY(k, tile(t));
      expect(y).toBeGreaterThan(vorher);
      vorher = y;
    }
  });

  it('setzt Vorder- und Hinterkante genau auf den Rand', () => {
    const k = kamera();
    expect(pxY(k, 0)).toBeCloseTo(k.y0, 6);
    expect(pxY(k, HOEHE)).toBeCloseTo(k.y0 + k.hoehePx, 6);
  });

  it('findet nach der Umkehrung denselben Punkt wieder', () => {
    const k = kamera();
    for (const ty of [0, 4, 8, 15, 17, 24, 32]) {
      for (const tx of [0, 3.5, 9, 14.5, 18]) {
        const px = pxX(k, tile(tx), tile(ty));
        const py = pxY(k, tile(ty));
        const zurueckY = mtY(k, py);
        const zurueckX = mtX(k, px, zurueckY);
        // Ein Millitile Rundungsfehler ist ein Tausendstel Tile.
        expect(Math.abs(zurueckY - tile(ty))).toBeLessThanOrEqual(2);
        expect(Math.abs(zurueckX - tile(tx))).toBeLessThanOrEqual(2);
      }
    }
  });

  it('kehrt gespiegelt genauso sauber um', () => {
    const k = kamera(true);
    for (const ty of [0, 10, 20, 32]) {
      const px = pxX(k, tile(6), tile(ty));
      const py = pxY(k, tile(ty));
      const zurueckY = mtY(k, py);
      expect(Math.abs(zurueckY - tile(ty))).toBeLessThanOrEqual(2);
      expect(Math.abs(mtX(k, px, zurueckY) - tile(6))).toBeLessThanOrEqual(2);
    }
  });

  it('legt bei Spiegelung die eigene Grundlinie nach vorne', () => {
    const normal = kamera(false);
    const gedreht = kamera(true);
    // Spieler 0 steht bei grossem y. Ungespiegelt liegt das unten,
    // gespiegelt oben.
    expect(pxY(normal, tile(30))).toBeGreaterThan(pxY(normal, tile(2)));
    expect(pxY(gedreht, tile(30))).toBeLessThan(pxY(gedreht, tile(2)));
  });

  it('skaliert Objekte hinten kleiner als vorne', () => {
    const k = kamera();
    expect(skalaBei(k, 0)).toBeLessThan(skalaBei(k, HOEHE));
    expect(pxHoehe(k, 0, tile(2))).toBeLessThan(pxHoehe(k, HOEHE, tile(2)));
  });

  it('erkennt Punkte ausserhalb des Trapezes', () => {
    const k = kamera();
    const mitte = k.x0 + k.breitePx / 2;
    expect(trifftArena(k, mitte, pxY(k, tile(16)))).toBe(true);
    // Die vordere Ecke liegt hinten schon ausserhalb.
    expect(trifftArena(k, k.x0 + 2, k.y0 + 2)).toBe(false);
    expect(trifftArena(k, mitte, k.y0 - 20)).toBe(false);
  });
});
