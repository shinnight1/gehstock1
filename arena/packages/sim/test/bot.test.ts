/* Belegt, dass die Schwierigkeitsskalierung wirkt.
 *
 * Der Auftrag verlangt genau das: ein Bot auf Stufe 2500 muss gegen
 * einen auf Stufe 300 in einer Serie deutlich haeufiger gewinnen.
 * Ohne diesen Test waere "skaliert stufenlos mit den Trophaeen" eine
 * Behauptung. */

import { describe, it, expect } from 'vitest';
import { matchAnlegen } from '../src/entity.js';
import { tick } from '../src/match.js';
import { botAnlegen, botTick, botDeck } from '../src/bot/bot.js';
import { botProfil } from '../src/bot/profil.js';
import { KARTEN_IDS } from '../src/data/cards.js';
import { DECK } from '../src/data/balance.js';
import type { MatchState } from '../src/state.js';

/** Ein volles Match zwischen zwei Bots. Gibt den Ausgang zurueck. */
function botDuell(
  trophaeenA: number, trophaeenB: number, seed: number,
): 'sieg0' | 'sieg1' | 'unentschieden' {
  const profilA = botProfil(trophaeenA);
  const profilB = botProfil(trophaeenB);

  // Decks aus einem Vorlauf-Zustand, damit beide aus demselben RNG kommen.
  const vorlauf = matchAnlegen({ seed, decks: [[], []] });
  const deckA = botDeck(vorlauf, KARTEN_IDS, profilA.deckQualitaet, DECK.groesse);
  const deckB = botDeck(vorlauf, KARTEN_IDS, profilB.deckQualitaet, DECK.groesse);

  const s: MatchState = matchAnlegen({
    seed, decks: [deckA, deckB], einheitlicheLevel: true,
  });
  const a = botAnlegen(0, profilA);
  const b = botAnlegen(1, profilB);

  while (s.phase !== 'ende' && s.tick < 8000) {
    botTick(s, a);
    botTick(s, b);
    tick(s);
  }
  return s.ausgang ?? 'unentschieden';
}

function serie(
  trophaeenA: number, trophaeenB: number, partien: number,
): { siegeA: number; siegeB: number; remis: number } {
  let siegeA = 0;
  let siegeB = 0;
  let remis = 0;
  for (let i = 0; i < partien; i++) {
    /* Jede Paarung zweimal, mit getauschten Seiten. So kann ein
       Seitenvorteil das Ergebnis nicht faelschen. */
    const hin = botDuell(trophaeenA, trophaeenB, 1000 + i);
    if (hin === 'sieg0') siegeA++;
    else if (hin === 'sieg1') siegeB++;
    else remis++;

    const rueck = botDuell(trophaeenB, trophaeenA, 1000 + i);
    if (rueck === 'sieg1') siegeA++;
    else if (rueck === 'sieg0') siegeB++;
    else remis++;
  }
  return { siegeA, siegeB, remis };
}

describe('Botprofil', () => {
  it('waechst in allen Werten mit den Trophaeen', () => {
    const schwach = botProfil(0);
    const stark = botProfil(3000);

    // Kleiner ist besser: schneller reagieren, genauer setzen.
    expect(stark.reaktion).toBeLessThan(schwach.reaktion);
    expect(stark.platzierungsFehler).toBeLessThan(schwach.platzierungsFehler);
    // Groesser ist besser.
    expect(stark.konterGenauigkeit).toBeGreaterThan(schwach.konterGenauigkeit);
    expect(stark.elixirDisziplin).toBeGreaterThan(schwach.elixirDisziplin);
    expect(stark.deckQualitaet).toBeGreaterThan(schwach.deckQualitaet);
  });

  it('verlaeuft monoton, ohne Spruenge', () => {
    let vorher = botProfil(0);
    for (let t = 100; t <= 3500; t += 100) {
      const jetzt = botProfil(t);
      expect(jetzt.reaktion).toBeLessThanOrEqual(vorher.reaktion);
      expect(jetzt.konterGenauigkeit).toBeGreaterThanOrEqual(vorher.konterGenauigkeit);
      vorher = jetzt;
    }
  });

  it('schaltet das Buendeln erst in den hoeheren Arenen frei', () => {
    expect(botProfil(500).pushTiming).toBe(false);
    expect(botProfil(2000).pushTiming).toBe(true);
  });

  it('bleibt an den Raendern stehen', () => {
    expect(botProfil(-500)).toEqual(botProfil(0));
    expect(botProfil(99999)).toEqual(botProfil(3000));
  });
});

describe('Botdeck', () => {
  it('hat immer die richtige Groesse und keine Doppelten', () => {
    for (const q of [0, 300, 600, 950]) {
      const s = matchAnlegen({ seed: q + 1, decks: [[], []] });
      const deck = botDeck(s, KARTEN_IDS, q, DECK.groesse);
      expect(deck.length).toBe(DECK.groesse);
      expect(new Set(deck).size).toBe(DECK.groesse);
      for (const id of deck) expect(KARTEN_IDS).toContain(id);
    }
  });

  it('gibt starken Bots haeufiger eine Antwort auf Luft', () => {
    const antiLuft = ['speerwerferinnen', 'bogenschuetzin', 'flammenspeier'];
    const zaehlen = (q: number): number => {
      let treffer = 0;
      for (let i = 0; i < 60; i++) {
        const s = matchAnlegen({ seed: i * 31 + q, decks: [[], []] });
        const deck = botDeck(s, KARTEN_IDS, q, DECK.groesse);
        if (deck.some((id) => antiLuft.includes(id))) treffer++;
      }
      return treffer;
    };
    expect(zaehlen(950)).toBeGreaterThan(zaehlen(200));
  });
});

describe('Schwierigkeitsskalierung', () => {
  it('laesst Stufe 2500 gegen Stufe 300 deutlich haeufiger gewinnen', () => {
    const { siegeA, siegeB, remis } = serie(2500, 300, 15);
    const entschieden = siegeA + siegeB;
    expect(entschieden).toBeGreaterThan(15);
    // Deutlich heisst hier: mindestens zwei von drei entschiedenen Partien.
    expect(siegeA / entschieden).toBeGreaterThan(0.66);
    expect(siegeA).toBeGreaterThan(siegeB);
    expect(remis).toBeLessThan(siegeA);
  });

  it('endet zwischen gleich starken Bots ungefaehr ausgeglichen', () => {
    const { siegeA, siegeB } = serie(1200, 1200, 12);
    const entschieden = siegeA + siegeB;
    if (entschieden === 0) return;
    const anteil = siegeA / entschieden;
    // Grosszuegig: es geht nur darum, dass kein systematischer Vorteil bleibt.
    expect(anteil).toBeGreaterThan(0.25);
    expect(anteil).toBeLessThan(0.75);
  });

  it('spielt ueberhaupt Karten', () => {
    const profil = botProfil(1500);
    const s = matchAnlegen({
      seed: 5, decks: [KARTEN_IDS.slice(0, 8), KARTEN_IDS.slice(0, 8)],
      einheitlicheLevel: true,
    });
    const b = botAnlegen(1, profil);
    for (let i = 0; i < 600; i++) { botTick(s, b); tick(s); }
    const seine = s.einheiten.filter((e) => e.aktiv && e.spieler === 1);
    expect(seine.length).toBeGreaterThan(0);
  });

  it('bekommt kein Extra-Elixir', () => {
    const s = matchAnlegen({
      seed: 9, decks: [KARTEN_IDS.slice(0, 8), KARTEN_IDS.slice(0, 8)],
      einheitlicheLevel: true,
    });
    const b = botAnlegen(1, botProfil(3000));
    for (let i = 0; i < 400; i++) { botTick(s, b); tick(s); }
    // Beide Seiten haben dieselbe Obergrenze - der Bot bekommt nichts geschenkt.
    expect(s.spieler[1].elixir).toBeLessThanOrEqual(10);
  });
});
