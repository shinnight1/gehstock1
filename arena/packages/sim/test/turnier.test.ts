/* ------------------------------------------------------------------
   Prueft das Messwerkzeug, nicht die Balance.

   Der Spiegeltest ist der wichtigste hier: laesst man ein Deck gegen
   sich selbst antreten, muss ungefaehr fifty-fifty herauskommen.
   Kommt etwas anderes heraus, bevorzugt der Aufbau eine Seite - und
   dann ist jede Zahl, die das Werkzeug ueber echte Decks ausgibt,
   um genau diesen Betrag falsch.

   Die Partien laufen ohne Zeichnen und ohne Warten, ein voller
   Dreiminuenmatch ist in wenigen Millisekunden durch. Deshalb
   koennen hier echte Partien stehen statt Attrappen.
   ------------------------------------------------------------------ */

import { describe, it, expect } from 'vitest';
import { duell, partie, kartenWertung, vertrauensband } from '../src/turnier.js';
import { botProfil } from '../src/bot/profil.js';
import { KARTEN_IDS } from '../src/data/cards.js';
import { MATCH, TICKS_PRO_SEKUNDE } from '../src/data/balance.js';

const DECK_A = [
  'rattenschar', 'hundemeute', 'bogenschuetzin', 'steinwaechter',
  'funkenregen', 'speerwerferinnen', 'hammergarde', 'bollwerk',
];
const DECK_B = [
  'frostkoloss', 'sturmfalken', 'flammenspeier', 'blitzmagier',
  'feuersturm', 'krypta', 'wolkenwal', 'frostschleier',
];

describe('Einzelpartie', () => {
  it('kommt zu einem Ende und meldet einen Ausgang', () => {
    const e = partie(DECK_A, DECK_B, 12345, botProfil(2000));
    expect(['sieg0', 'sieg1', 'unentschieden']).toContain(e.ausgang);
    expect(e.sekunden).toBeGreaterThan(0);
    expect(e.sekunden).toBeLessThanOrEqual(
      (MATCH.dauer + MATCH.overtime) / TICKS_PRO_SEKUNDE + 2,
    );
  });

  it('laeuft mit demselben Startwert zweimal gleich aus', () => {
    /* Ohne das waere keine gemessene Zahl nachpruefbar: wer ein
       Ergebnis anzweifelt, muss es wiederholen koennen. */
    const a = partie(DECK_A, DECK_B, 777, botProfil(2000));
    const b = partie(DECK_A, DECK_B, 777, botProfil(2000));
    expect(b).toEqual(a);
  });

  it('gibt bei verschiedenen Startwerten verschiedene Partien', () => {
    const ergebnisse = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      const e = partie(DECK_A, DECK_B, seed, botProfil(2000));
      ergebnisse.add(e.ausgang + ':' + e.tuerme.join('-') + ':' + e.sekunden);
    }
    // Zwoelf identische Partien waeren ein festhaengender Zufall.
    expect(ergebnisse.size).toBeGreaterThan(3);
  });
});

describe('Spiegeltest', () => {
  it('bevorzugt keine Seite, wenn beide dasselbe Deck spielen', () => {
    /* Der Kern der Sache - und er muss mit unabhaengigen Startwerten
       laufen. Mit Paarung waere er wertlos: dort ist die Rueckrunde
       dieselbe Partie wie die Hinrunde, nur mit vertauschten Sitzen,
       und beim Spiegelduell kommt deshalb zwangslaeufig genau 50
       Prozent heraus, egal wie schief das Spiel waere.

       200 Partien geben ein Band von rund sieben Prozentpunkten. Ein
       Ergebnis ausserhalb von 40 bis 60 waere kein Rauschen mehr,
       sondern ein Vorteil, den eine Seite allein aus ihrer
       Sitzordnung zieht. Mehr Partien waeren genauer, aber diese
       Datei laeuft bei jedem `npm test` mit, und eine Testsuite, die
       eine Minute braucht, wird nicht mehr ausgefuehrt. Wer es genauer
       will, nimmt das Werkzeug: `npm run turnier`. */
    const e = duell(DECK_A, DECK_A, { partien: 200, seed: 4242, paarweise: false });
    expect(e.partien).toBe(200);
    expect(e.siegeA + e.siegeB + e.unentschieden).toBe(200);
    expect(e.quote).toBeGreaterThan(0.4);
    expect(e.quote).toBeLessThan(0.6);
  }, 120_000);

  it('bevorzugt auch mit dem zweiten Deck keine Seite', () => {
    const e = duell(DECK_B, DECK_B, { partien: 200, seed: 99, paarweise: false });
    expect(e.quote).toBeGreaterThan(0.4);
    expect(e.quote).toBeLessThan(0.6);
  }, 120_000);

  it('hebt die Seitenverzerrung mit Paarung exakt auf', () => {
    /* Mit Paarung ist ein Spiegelduell nicht ungefaehr, sondern genau
       ausgeglichen - und der Turmvorsprung genau null. Das ist keine
       Messung, sondern eine Eigenschaft des Aufbaus, und sie ist der
       Grund, warum Paarung die Voreinstellung ist. */
    const e = duell(DECK_A, DECK_A, { partien: 100, seed: 5 });
    expect(e.quote).toBe(0.5);
    expect(e.turmVorsprung).toBe(0);
  }, 60_000);

  it('kehrt sich um, wenn man die Decks tauscht', () => {
    /* A gegen B und B gegen A muessen sich zu eins ergaenzen. Tun sie
       das nicht, wird der Sieg dem falschen Deck gutgeschrieben. */
    const hin = duell(DECK_A, DECK_B, { partien: 60, seed: 31 });
    const rueck = duell(DECK_B, DECK_A, { partien: 60, seed: 31 });
    expect(hin.quote + rueck.quote).toBeCloseTo(1, 5);
    expect(hin.turmVorsprung).toBeCloseTo(-rueck.turmVorsprung, 5);
  }, 120_000);
});

describe('Duell', () => {
  it('liefert bei gleichem Startwert dasselbe Ergebnis', () => {
    const a = duell(DECK_A, DECK_B, { partien: 40, seed: 5 });
    const b = duell(DECK_A, DECK_B, { partien: 40, seed: 5 });
    expect(b).toEqual(a);
  }, 60_000);

  it('rundet eine ungerade Partienzahl ab, damit die Seiten aufgehen', () => {
    expect(duell(DECK_A, DECK_B, { partien: 41, seed: 1 }).partien).toBe(40);
  });
});

describe('Kartenwertung', () => {
  it('wertet jede Karte und zaehlt jede Partie genau einmal je Deck', () => {
    const w = kartenWertung(KARTEN_IDS, { partien: 60, seed: 8 });
    expect(w).toHaveLength(KARTEN_IDS.length);

    /* Je Partie liegen acht Karten in jedem der beiden Decks. Ueber
       alle Karten summiert muessen also 16 Deckplaetze je Partie
       herauskommen - eine Kontrolle, dass nichts doppelt oder gar
       nicht gezaehlt wird. */
    const summe = w.reduce((n, k) => n + k.partien, 0);
    expect(summe).toBe(60 * 16);

    // Ebenso: gewonnen wird je Partie genau einmal, von acht Karten.
    const siege = w.reduce((n, k) => n + k.siege, 0);
    expect(siege).toBeCloseTo(60 * 8, 5);
  }, 60_000);

  it('gibt die stärkste Karte zuerst aus', () => {
    const w = kartenWertung(KARTEN_IDS, { partien: 40, seed: 3 });
    for (let i = 1; i < w.length; i++) {
      expect(w[i - 1]!.quote).toBeGreaterThanOrEqual(w[i]!.quote);
    }
  }, 60_000);

  it('ist mit demselben Startwert wiederholbar', () => {
    const a = kartenWertung(KARTEN_IDS, { partien: 40, seed: 11 });
    const b = kartenWertung(KARTEN_IDS, { partien: 40, seed: 11 });
    expect(b).toEqual(a);
  }, 60_000);
});

describe('Vertrauensband', () => {
  it('wird mit mehr Partien enger', () => {
    expect(vertrauensband(0.5, 1000)).toBeLessThan(vertrauensband(0.5, 100));
  });

  it('liegt bei 100 Partien um sieben Prozentpunkte', () => {
    // Der Wert, an dem man ablesen kann, wie viele Partien noetig sind.
    expect(vertrauensband(0.5, 100)).toBeCloseTo(9.8, 1);
    expect(vertrauensband(0.5, 1000)).toBeCloseTo(3.1, 1);
  });
});
