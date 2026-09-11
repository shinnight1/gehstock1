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
import { duell } from '../src/turnier.js';
import type { MatchState } from '../src/state.js';

/** Ein festes Deck fuer die Stufenmessung - beide Seiten spielen es. */
const DECK_TEST = [
  'rattenschar', 'hundemeute', 'bogenschuetzin', 'steinwaechter',
  'funkenregen', 'speerwerferinnen', 'hammergarde', 'bollwerk',
];

/* Die frueheren Helfer botDuell und serie sind entfallen: dieselbe
   Aufgabe erledigt jetzt duell() aus turnier.ts, und zwar mit
   ausgewiesenem Vertrauensband statt mit dreissig Partien und
   Daumenwerten. */

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
    /* Gemessen mit dem Turnierwerkzeug, damit die Stichprobe reicht.
       Beide Seiten spielen dasselbe Deck: gemessen werden soll die
       Stufe, nicht die Karten.

       Die Schranke liegt beim Doppelten des Rauschens, nicht beim
       Dreifachen. Grund: seit die Haerte an der Arena haengt, ist der
       300er-Bot kein Anfaenger mehr, sondern spielt bereits ein
       Drittel des Weges zur Hoechststufe. Der Abstand nach oben ist
       damit kleiner geworden - gewollt, denn die zweite Arena soll
       sich nach zweiter Arena anfuehlen. Gemessen ueber 400 Partien
       liegt er bei 63 Prozent, also beim 2,8-fachen des Bandes.

       Deshalb auch 400 Partien statt 200: bei 200 ist das Band so
       breit, dass ein echter Abstand von 13 Punkten nicht mehr sicher
       von Rauschen zu trennen waere. */
    const e = duell(DECK_TEST, DECK_TEST, {
      partien: 400, seed: 17, trophaeen: 2500, trophaeenB: 300,
    });
    expect(e.quote - 0.5).toBeGreaterThan(e.unsicherheit / 100 * 2);
    expect(e.quote).toBeGreaterThan(0.58);
  }, 120_000);

  it('macht die zweite Arena spuerbar schwerer als die erste', () => {
    /* Der eigentliche Zweck der Arena-Haerte. Vorher lag der Bot bei
       300 Trophaeen bei 2,8 Prozent zwischen leicht und schwer - also
       praktisch gleichauf mit dem Anfangsgegner. Ein Wechsel der Arena
       muss sich bemerkbar machen. */
    const e = duell(DECK_TEST, DECK_TEST, {
      partien: 200, seed: 23, trophaeen: 300, trophaeenB: 0,
    });
    expect(e.quote).toBeGreaterThan(0.58);
  }, 120_000);

  it('endet zwischen gleich starken Bots ausgeglichen', () => {
    /* Die Gegenprobe zur Zeile darueber: ohne Stufenunterschied darf
       kein Unterschied uebrigbleiben. Ginge das hier schief, laege der
       Vorteil oben nicht an der Stufe, sondern am Aufbau. */
    const e = duell(DECK_TEST, DECK_TEST, {
      partien: 200, seed: 21, trophaeen: 1200, paarweise: false,
    });
    expect(e.quote).toBeGreaterThan(0.4);
    expect(e.quote).toBeLessThan(0.6);
  }, 120_000);

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
