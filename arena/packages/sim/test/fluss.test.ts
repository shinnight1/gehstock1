/* ------------------------------------------------------------------
   Der Fluss darf keine Falle sein.

   Zwei Fehler hingen zusammen und machten Einheiten unbrauchbar:

   Erstens schob die Kollisionsaufloesung Einheiten ohne jede Pruefung
   auseinander. Ein Knaeuel auf der Bruecke drueckte die aeusseren
   daneben - ins Wasser.

   Zweitens kam niemand dort wieder heraus. Die Bewegung wies jeden
   Schritt ab, dessen Ziel im Wasser lag, und fuer eine Einheit, die
   schon drin steht, trifft das auf jeden Schritt zu. Sie rutschte
   seitwaerts am Ufer entlang, bis das Match vorbei war.

   Beide Tests hier faellt die alte Fassung.
   ------------------------------------------------------------------ */

import { describe, it, expect } from 'vitest';
import { matchAnlegen } from '../src/entity.js';
import { ticks } from '../src/match.js';
import { karteSetzen } from '../src/spawn.js';
import { bewegen, kollisionAufloesen } from '../src/bewegung.js';
import { istBegehbar, istImFluss, BRUECKEN, BRUECKE_Y } from '../src/arena.js';
import { MATCH } from '../src/data/balance.js';
import { tile } from '../src/fixed.js';
import type { MatchState, Einheit } from '../src/state.js';

const DECK = [
  'rattenschar', 'hundemeute', 'bogenschuetzin', 'steinwaechter',
  'funkenregen', 'speerwerferinnen', 'hammergarde', 'bollwerk',
];

function feld(): MatchState {
  const s = matchAnlegen({ seed: 3, decks: [DECK.slice(), DECK.slice()] });
  ticks(s, MATCH.countdown);
  return s;
}

const lebende = (s: MatchState): Einheit[] => s.einheiten.filter((e) => e.aktiv);

/** Steht eine Bodeneinheit im Wasser, wo sie nicht stehen darf? */
function imWasser(s: MatchState): Einheit[] {
  return lebende(s).filter(
    (e) => e.ebene === 'boden' && !e.istGebaeude && !istBegehbar(e.x, e.y),
  );
}

describe('Kollision', () => {
  it('schiebt niemanden von der Bruecke ins Wasser', () => {
    const s = feld();
    /* Ein dichtes Knaeuel mitten auf der Bruecke - genau die Lage, in
       der es vorher passierte. Ohne Flusspruefung weichen die
       aeusseren seitlich aus, und daneben ist Wasser. */
    const b = BRUECKEN[0]!;
    for (let i = 0; i < 6; i++) {
      karteSetzen(s, 0, 'rattenschar', 3, b.x, BRUECKE_Y);
    }
    for (const e of lebende(s)) { e.deployRest = 0; e.tempo = 0; }

    for (let i = 0; i < 60; i++) kollisionAufloesen(s);

    expect(lebende(s).length).toBeGreaterThan(5);
    expect(imWasser(s)).toHaveLength(0);
  });

  it('laesst Einheiten trotzdem auseinanderruecken', () => {
    /* Die Pruefung darf den Stau nicht festfrieren: uebereinander
       stehende Einheiten muessen sich weiterhin loesen. */
    const s = feld();
    for (let i = 0; i < 4; i++) karteSetzen(s, 0, 'rattenschar', 3, tile(9), tile(22));
    for (const e of lebende(s)) { e.deployRest = 0; e.tempo = 0; }

    const vorher = spreizung(lebende(s));
    for (let i = 0; i < 40; i++) kollisionAufloesen(s);
    expect(spreizung(lebende(s))).toBeGreaterThan(vorher);
  });
});

describe('Einheit im Wasser', () => {
  it('findet zurueck auf festen Grund', () => {
    const s = feld();
    karteSetzen(s, 0, 'hundemeute', 3, tile(9), tile(20));
    const e = lebende(s)[0]!;
    e.deployRest = 0;

    // Von Hand mitten in den Fluss gesetzt, weit weg von jeder Bruecke.
    e.x = tile(9);
    e.y = BRUECKE_Y;
    expect(istBegehbar(e.x, e.y)).toBe(false);

    for (let i = 0; i < 200; i++) bewegen(s, e);

    expect(istBegehbar(e.x, e.y)).toBe(true);
  });

  it('bleibt nicht am Ufer kleben, sondern kommt drueben an', () => {
    /* Der eigentliche Schaden: die Einheit lebte, war aber ohne
       Wirkung. Nach der Rettung muss sie ihren Weg fortsetzen. */
    const s = feld();
    karteSetzen(s, 0, 'hundemeute', 3, tile(9), tile(20));
    const e = lebende(s)[0]!;
    e.deployRest = 0;
    e.x = tile(9);
    e.y = BRUECKE_Y;

    for (let i = 0; i < 600; i++) bewegen(s, e);

    expect(istImFluss(e.y)).toBe(false);
    // Drueben heisst: oberhalb des Flusses, auf der gegnerischen Seite.
    expect(e.y).toBeLessThan(BRUECKE_Y);
  });
});

describe('Voller Matchverlauf', () => {
  it('laesst ueber ein ganzes Match niemanden im Wasser zurueck', () => {
    /* Die Gegenprobe ohne kuenstliche Lage: ein Match mit viel Verkehr
       ueber beide Bruecken. Vorher blieben dabei regelmaessig
       Einheiten im Fluss haengen. */
    const s = feld();
    for (let t = 0; t < 1200; t++) {
      if (t % 40 === 0) {
        for (const spieler of [0, 1] as const) {
          const y = spieler === 0 ? tile(20) : tile(12);
          karteSetzen(s, spieler, 'rattenschar', 3, BRUECKEN[t % 2]!.x, y);
          karteSetzen(s, spieler, 'hundemeute', 3, BRUECKEN[t % 2]!.x + 400, y);
        }
      }
      ticks(s, 1);
      expect(imWasser(s)).toHaveLength(0);
    }
  });
});

/** Mittlerer Abstand zum Schwerpunkt - Mass fuer das Auseinanderruecken. */
function spreizung(liste: readonly Einheit[]): number {
  if (!liste.length) return 0;
  const mx = liste.reduce((n, e) => n + e.x, 0) / liste.length;
  const my = liste.reduce((n, e) => n + e.y, 0) / liste.length;
  return liste.reduce(
    (n, e) => n + Math.hypot(e.x - mx, e.y - my), 0,
  ) / liste.length;
}
