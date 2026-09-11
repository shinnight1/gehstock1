import { describe, it, expect } from 'vitest';
import {
  BREITE, HOEHE, FLUSS_OBEN, FLUSS_UNTEN, BRUECKEN, BRUECKE_BREITE,
  istBegehbar, istImFluss, darfPlatzieren, turmY, spiegelY, naechsteBruecke,
  KOENIG_X,
} from '../src/arena.js';
import { tile } from '../src/fixed.js';

describe('Arena-Geometrie', () => {
  it('hat die vereinbarten Masse', () => {
    expect(BREITE).toBe(tile(18));
    expect(HOEHE).toBe(tile(32));
  });

  it('spiegelt Tuerme symmetrisch', () => {
    expect(turmY(0, 'koenig')).toBe(spiegelY(turmY(1, 'koenig')));
    expect(turmY(0, 'seite')).toBe(spiegelY(turmY(1, 'seite')));
  });

  it('sperrt den Fluss ausserhalb der Bruecken', () => {
    const mitte = (FLUSS_OBEN + FLUSS_UNTEN) / 2;
    expect(istImFluss(mitte)).toBe(true);
    expect(istBegehbar(tile(9), mitte)).toBe(false);
    for (const b of BRUECKEN) {
      expect(istBegehbar(b.x, mitte)).toBe(true);
      expect(istBegehbar(b.x + BRUECKE_BREITE, mitte)).toBe(false);
    }
  });

  it('laesst Ufer und Grundlinien frei begehbar', () => {
    expect(istBegehbar(tile(9), tile(2))).toBe(true);
    expect(istBegehbar(tile(9), tile(30))).toBe(true);
    expect(istBegehbar(tile(-1), tile(9))).toBe(false);
  });

  it('findet die naechste Bruecke', () => {
    expect(naechsteBruecke(tile(1)).flanke).toBe('links');
    expect(naechsteBruecke(tile(17)).flanke).toBe('rechts');
  });

  it('erlaubt Platzierung nur auf der eigenen Haelfte', () => {
    expect(darfPlatzieren(0, tile(9), tile(20), [])).toBe(true);
    expect(darfPlatzieren(0, tile(9), tile(10), [])).toBe(false);
    expect(darfPlatzieren(1, tile(9), tile(10), [])).toBe(true);
    expect(darfPlatzieren(1, tile(9), tile(20), [])).toBe(false);
  });

  it('oeffnet nach einem Turmfall genau das eine Viertel', () => {
    expect(darfPlatzieren(0, tile(3), tile(6), ['links'])).toBe(true);
    expect(darfPlatzieren(0, tile(15), tile(6), ['links'])).toBe(false);
    expect(darfPlatzieren(0, tile(15), tile(6), ['links', 'rechts'])).toBe(true);
  });

  it('laesst die Platzierung nicht ins Aus rutschen', () => {
    expect(darfPlatzieren(0, tile(-0.5), tile(20), [])).toBe(false);
    expect(darfPlatzieren(0, tile(9), tile(33), [])).toBe(false);
  });
});

describe('Sperrzone um den Koenig', () => {
  it('verbietet das Setzen unmittelbar am eigenen Koenigsturm', () => {
    /* Direkt an den Koenig zu setzen war die staerkste Verteidigung
       im Spiel und kostete nichts: die Einheit erschien hinter dem
       Angreifer, der Turm uebernahm den Rest. */
    const ky = turmY(0, 'koenig');
    expect(darfPlatzieren(0, KOENIG_X, ky, [])).toBe(false);
    expect(darfPlatzieren(0, KOENIG_X, ky - tile(2), [])).toBe(false);
    expect(darfPlatzieren(0, KOENIG_X + tile(2), ky, [])).toBe(false);
  });

  it('erlaubt es knapp ausserhalb wieder', () => {
    const ky = turmY(0, 'koenig');
    expect(darfPlatzieren(0, KOENIG_X, ky - tile(4.5), [])).toBe(true);
    expect(darfPlatzieren(0, KOENIG_X + tile(5), ky, [])).toBe(true);
  });

  it('gilt gespiegelt fuer die andere Seite', () => {
    const ky = turmY(1, 'koenig');
    expect(darfPlatzieren(1, KOENIG_X, ky, [])).toBe(false);
    expect(darfPlatzieren(1, KOENIG_X, ky + tile(5), [])).toBe(true);
  });

  it('sperrt nicht den gegnerischen Koenig', () => {
    /* Auf der gegnerischen Haelfte darf man ohnehin erst, wenn dort
       ein Turm gefallen ist - und dann soll der Druck ankommen. */
    const gegnerKoenig = turmY(1, 'koenig');
    expect(darfPlatzieren(0, KOENIG_X, gegnerKoenig, ['links', 'rechts'])).toBe(true);
  });
});
