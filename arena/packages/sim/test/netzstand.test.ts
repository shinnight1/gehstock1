/* ------------------------------------------------------------------
   Was den Onlinemodus traegt: Pruefsumme und Schnappschuss.

   Beide sind nur so viel wert wie ihre Genauigkeit. Eine Pruefsumme,
   die eine Abweichung uebersieht, ist schlimmer als keine - sie
   erzeugt Vertrauen, das nicht da ist. Ein Schnappschuss, der etwas
   verliert, laesst die Partie genau dann auseinanderlaufen, wenn sie
   gerade wieder zusammengefuehrt werden sollte.
   ------------------------------------------------------------------ */

import { describe, it, expect } from 'vitest';
import { matchAnlegen } from '../src/entity.js';
import type { MatchAufbau } from '../src/entity.js';
import { tick, ticks } from '../src/match.js';
import type { Command } from '../src/commands.js';
import { pruefsumme } from '../src/pruefsumme.js';
import { zustandPacken, zustandEntpacken } from '../src/schnappschuss.js';
import { MATCH } from '../src/data/balance.js';
import { tile } from '../src/fixed.js';
import type { MatchState } from '../src/state.js';

const DECK_A = [
  'rattenschar', 'hundemeute', 'bogenschuetzin', 'steinwaechter',
  'funkenregen', 'speerwerferinnen', 'hammergarde', 'bollwerk',
];
const DECK_B = [
  'frostkoloss', 'sturmfalken', 'flammenspeier', 'blitzmagier',
  'feuersturm', 'krypta', 'wolkenwal', 'frostschleier',
];

function aufbau(): MatchAufbau {
  return { seed: 90210, decks: [DECK_A.slice(), DECK_B.slice()] };
}

/**
 * Eine Partie mit Zuegen fahren, wie sie online entstuenden.
 *
 * Gespielt wird jeweils die vorderste Handkarte - was dort liegt,
 * haengt vom Zyklus ab und damit vom bisherigen Verlauf. Genau das
 * ist gewuenscht: der Test soll nicht eine feste Liste abspielen,
 * sondern einen Ablauf, der von seinem eigenen Zustand abhaengt.
 */
function fahren(s: MatchState, bisTick: number): void {
  while (s.tick < bisTick) {
    const commands: Command[] = [];
    if (s.phase !== 'countdown' && s.tick % 23 === 0) {
      for (const spieler of [0, 1] as const) {
        const id = s.spieler[spieler].hand[0];
        if (!id) continue;
        commands.push({
          typ: 'playCard', spieler, kartenId: id, tick: s.tick,
          x: tile(4 + (s.tick % 9)),
          y: spieler === 0 ? tile(20) : tile(11),
        });
      }
    }
    tick(s, commands);
  }
}

describe('Pruefsumme', () => {
  it('ist fuer denselben Zustand gleich und fuer verschiedene verschieden', () => {
    const a = matchAnlegen(aufbau());
    const b = matchAnlegen(aufbau());
    expect(pruefsumme(a)).toBe(pruefsumme(b));

    ticks(a, MATCH.countdown + 40);
    expect(pruefsumme(a)).not.toBe(pruefsumme(b));

    ticks(b, MATCH.countdown + 40);
    expect(pruefsumme(a)).toBe(pruefsumme(b));
  });

  it('meldet einen abweichenden Zug', () => {
    const a = matchAnlegen(aufbau());
    const b = matchAnlegen(aufbau());
    ticks(a, MATCH.countdown);
    ticks(b, MATCH.countdown);

    const zug: Command = {
      typ: 'playCard', spieler: 0, kartenId: a.spieler[0].hand[0]!,
      tick: a.tick, x: tile(5), y: tile(20),
    };
    tick(a, [zug]);
    tick(b, []);
    expect(pruefsumme(a)).not.toBe(pruefsumme(b));
  });

  it('bemerkt eine einzelne veraenderte Zahl', () => {
    const s = matchAnlegen(aufbau());
    ticks(s, MATCH.countdown + 30);
    const vorher = pruefsumme(s);
    s.tuerme[0]!.hp -= 1;
    expect(pruefsumme(s)).not.toBe(vorher);
  });
});

describe('Schnappschuss', () => {
  it('gibt einen Zustand unveraendert zurueck', () => {
    const s = matchAnlegen(aufbau());
    fahren(s, MATCH.countdown + 300);

    const zurueck = zustandEntpacken(aufbau(), zustandPacken(s));
    expect(pruefsumme(zurueck)).toBe(pruefsumme(s));
    expect(zurueck.tick).toBe(s.tick);
  });

  it('rechnet nach dem Auspacken genauso weiter', () => {
    const s = matchAnlegen(aufbau());
    fahren(s, MATCH.countdown + 200);

    const zurueck = zustandEntpacken(aufbau(), zustandPacken(s));
    /* Der eigentliche Punkt: nicht nur der Stand muss stimmen,
       sondern auch alles, woraus die naechsten Ticks entstehen -
       Zufallszustand, Freilisten, Zielbindungen. */
    fahren(s, MATCH.countdown + 500);
    fahren(zurueck, MATCH.countdown + 500);
    expect(pruefsumme(zurueck)).toBe(pruefsumme(s));
  });

  it('ueberlebt den Weg durch JSON', () => {
    const s = matchAnlegen(aufbau());
    fahren(s, MATCH.countdown + 240);

    // So geht er ueber die Leitung - und nur so zaehlt der Test.
    const roh = JSON.parse(JSON.stringify(zustandPacken(s)));
    const zurueck = zustandEntpacken(aufbau(), roh);
    expect(pruefsumme(zurueck)).toBe(pruefsumme(s));
  });
});

describe('Gleichlauf', () => {
  it('drei Rechner mit derselben Befehlsfolge bleiben Tick fuer Tick gleich', () => {
    /* Genau das ist die Wette des Onlinemodus: Server und beide
       Clients rechnen dieselbe Partie, statt einen Zustand zu
       verschicken. Bricht dieser Test, ist der Modus kaputt. */
    const server = matchAnlegen(aufbau());
    const clientA = matchAnlegen(aufbau());
    const clientB = matchAnlegen(aufbau());

    for (let i = 0; i < MATCH.countdown + 600; i++) {
      const commands: Command[] = [];
      if (server.phase !== 'countdown' && server.tick % 17 === 0) {
        const id = server.spieler[0].hand[0];
        if (id) {
          commands.push({
            typ: 'playCard', spieler: 0, kartenId: id, tick: server.tick,
            x: tile(3 + (server.tick % 11)), y: tile(19),
          });
        }
      }
      /* Absichtlich in unterschiedlicher Reihenfolge uebergeben: die
         Sortierung in commandsAnwenden muss das ausgleichen, sonst
         haengt der Ausgang an der Ankunftsreihenfolge im Netz. */
      tick(server, commands);
      tick(clientA, commands.slice());
      tick(clientB, commands.slice().reverse());

      if (i % 50 === 0) {
        expect(pruefsumme(clientA)).toBe(pruefsumme(server));
        expect(pruefsumme(clientB)).toBe(pruefsumme(server));
      }
    }
    expect(pruefsumme(clientA)).toBe(pruefsumme(server));
    expect(pruefsumme(clientB)).toBe(pruefsumme(server));
  });
});
