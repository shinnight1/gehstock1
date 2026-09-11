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
    expect(darfPlatzieren(0, tile(3), tile(10), ['links'])).toBe(true);
    expect(darfPlatzieren(0, tile(15), tile(10), ['links'])).toBe(false);
    expect(darfPlatzieren(0, tile(15), tile(10), ['links', 'rechts'])).toBe(true);
  });

  it('laesst auch im offenen Viertel nicht bis an den gegnerischen Koenig', () => {
    /* Ein gefallener Seitenturm reichte sonst, um direkt neben den
       gegnerischen Koenig zu setzen. Dagegen hatte der Verteidiger
       kein Mittel: seine eigene Sperrzone verbietet ihm genau dort
       die Antwort. */
    const grenze = turmY(1, 'seite');
    expect(darfPlatzieren(0, tile(3), grenze, ['links'])).toBe(true);
    expect(darfPlatzieren(0, tile(3), grenze - tile(1), ['links'])).toBe(false);
    expect(darfPlatzieren(0, tile(3), turmY(1, 'koenig'), ['links'])).toBe(false);

    // Gespiegelt gilt dasselbe fuer den anderen Spieler.
    const gespiegelt = turmY(0, 'seite');
    expect(darfPlatzieren(1, tile(3), gespiegelt, ['links'])).toBe(true);
    expect(darfPlatzieren(1, tile(3), gespiegelt + tile(1), ['links'])).toBe(false);
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

  it('sperrt auch den gegnerischen Koenig, aber nicht die halbe Haelfte', () => {
    /* Frueher galt hier das Gegenteil: ein gefallener Turm gab die
       ganze gegnerische Haelfte frei, bis an den Koenig. Das war
       nicht Druck, sondern das Ende - der Verteidiger konnte dort
       wegen seiner eigenen Sperrzone gar nicht antworten. */
    const gegnerKoenig = turmY(1, 'koenig');
    expect(darfPlatzieren(0, KOENIG_X, gegnerKoenig, ['links', 'rechts'])).toBe(false);

    // Bis vor die gegnerischen Seitentuerme geht es aber sehr wohl.
    expect(darfPlatzieren(0, KOENIG_X, turmY(1, 'seite'), ['links', 'rechts'])).toBe(true);
  });
});
