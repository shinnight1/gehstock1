import { describe, it, expect } from 'vitest';
import { matchAnlegen, koenigVon } from '../src/entity.js';
import type { MatchAufbau } from '../src/entity.js';
import { tick, ticks, matchZeit } from '../src/match.js';
import type { Command } from '../src/commands.js';
import { pruefeZug, fuehreZugAus } from '../src/commands.js';
import { karteSetzen } from '../src/spawn.js';
import { MATCH, ELIXIR, TURM } from '../src/data/balance.js';
import { tile } from '../src/fixed.js';
import { turmY } from '../src/arena.js';
import type { MatchState } from '../src/state.js';

const DECK_A = [
  'rattenschar', 'hundemeute', 'bogenschuetzin', 'steinwaechter',
  'funkenregen', 'speerwerferinnen', 'hammergarde', 'bollwerk',
];
const DECK_B = [
  'frostkoloss', 'sturmfalken', 'flammenspeier', 'blitzmagier',
  'feuersturm', 'krypta', 'wolkenwal', 'frostschleier',
];

function aufbau(over: Partial<MatchAufbau> = {}): MatchAufbau {
  return { seed: 4242, decks: [DECK_A.slice(), DECK_B.slice()], ...over };
}

/** Match bis zum Anpfiff durchlaufen lassen. */
function angepfiffen(over: Partial<MatchAufbau> = {}): MatchState {
  const s = matchAnlegen(aufbau(over));
  ticks(s, MATCH.countdown);
  return s;
}

function lebende(s: MatchState): number {
  return s.einheiten.filter((e) => e.aktiv).length;
}

describe('Matchablauf', () => {
  it('startet im Countdown und pfeift dann an', () => {
    const s = matchAnlegen(aufbau());
    expect(s.phase).toBe('countdown');
    ticks(s, MATCH.countdown);
    expect(s.phase).toBe('laeuft');
    expect(matchZeit(s)).toBe(0);
  });

  it('teilt vier Karten aus und haelt den Rest in der Warteschlange', () => {
    const s = angepfiffen();
    for (const p of s.spieler) {
      expect(p.hand.length).toBe(4);
      expect(p.queue.length).toBe(4);
      // Keine Karte doppelt.
      expect(new Set([...p.hand, ...p.queue]).size).toBe(8);
    }
  });

  it('startet mit dem vereinbarten Elixir', () => {
    const s = angepfiffen();
    expect(s.spieler[0].elixir).toBe(ELIXIR.start);
  });

  it('laesst Elixir im vorgesehenen Takt nachlaufen', () => {
    const s = angepfiffen();
    s.spieler[0].elixir = 0;
    s.spieler[0].elixirRest = 0;
    ticks(s, ELIXIR.ticksProPunkt);
    expect(s.spieler[0].elixir).toBe(1);
  });

  it('deckelt Elixir bei der Obergrenze', () => {
    const s = angepfiffen();
    ticks(s, ELIXIR.ticksProPunkt * 20);
    expect(s.spieler[0].elixir).toBeLessThanOrEqual(ELIXIR.cap);
  });

  it('verdoppelt Elixir in der letzten Minute', () => {
    const s = angepfiffen();
    // Kurz vor die Grenze springen und dort messen.
    s.tick = MATCH.countdown + MATCH.doppeltAb;
    s.spieler[0].elixir = 0;
    s.spieler[0].elixirRest = 0;
    ticks(s, ELIXIR.ticksProPunkt);
    expect(s.spieler[0].elixir).toBe(2);
  });
});

describe('Zuege', () => {
  it('verwirft eine Karte, die nicht auf der Hand liegt', () => {
    const s = angepfiffen();
    const fremd = s.spieler[0].queue[0]!;
    const cmd: Command = {
      typ: 'playCard', spieler: 0, kartenId: fremd,
      tick: s.tick, x: tile(9), y: tile(22),
    };
    expect(pruefeZug(s, cmd)).toBe('nichtAufDerHand');
    expect(fuehreZugAus(s, cmd)).toBe(false);
  });

  it('verwirft einen Zug ohne genug Elixir', () => {
    const s = angepfiffen();
    s.spieler[0].elixir = 0;
    const karte = s.spieler[0].hand[0]!;
    expect(pruefeZug(s, {
      typ: 'playCard', spieler: 0, kartenId: karte,
      tick: s.tick, x: tile(9), y: tile(22),
    })).toBe('zuwenigElixir');
  });

  it('verwirft eine Platzierung auf der gegnerischen Haelfte', () => {
    const s = angepfiffen();
    s.spieler[0].elixir = ELIXIR.cap;
    const karte = s.spieler[0].hand.find((k) => k !== 'funkenregen')!;
    expect(pruefeZug(s, {
      typ: 'playCard', spieler: 0, kartenId: karte,
      tick: s.tick, x: tile(9), y: tile(6),
    })).toBe('zonneVerboten');
  });

  it('laesst Zauber ueberall zu', () => {
    const s = angepfiffen();
    s.spieler[0].elixir = ELIXIR.cap;
    s.spieler[0].hand[0] = 'funkenregen';
    expect(pruefeZug(s, {
      typ: 'playCard', spieler: 0, kartenId: 'funkenregen',
      tick: s.tick, x: tile(9), y: tile(4),
    })).toBe(null);
  });

  it('zieht Elixir ab und tauscht die Karte durch', () => {
    const s = angepfiffen();
    s.spieler[0].elixir = ELIXIR.cap;
    const karte = s.spieler[0].hand[1]!;
    const naechste = s.spieler[0].queue[0]!;
    const ok = fuehreZugAus(s, {
      typ: 'playCard', spieler: 0, kartenId: karte,
      tick: s.tick, x: tile(9), y: tile(22),
    });
    expect(ok).toBe(true);
    expect(s.spieler[0].hand[1]).toBe(naechste);
    expect(s.spieler[0].queue[s.spieler[0].queue.length - 1]).toBe(karte);
    expect(s.spieler[0].elixir).toBeLessThan(ELIXIR.cap);
  });
});

describe('Determinismus', () => {
  it('liefert bei gleichem Seed und gleichen Zuegen denselben Endzustand', () => {
    const commands: Command[] = [
      { typ: 'playCard', spieler: 0, kartenId: 'rattenschar', tick: 70, x: tile(4), y: tile(22) },
      { typ: 'playCard', spieler: 1, kartenId: 'frostkoloss', tick: 90, x: tile(5), y: tile(9) },
      { typ: 'playCard', spieler: 0, kartenId: 'bogenschuetzin', tick: 140, x: tile(6), y: tile(24) },
      { typ: 'playCard', spieler: 1, kartenId: 'sturmfalken', tick: 200, x: tile(13), y: tile(10) },
    ];

    const a = matchAnlegen(aufbau());
    const b = matchAnlegen(aufbau());
    ticks(a, 900, commands);
    ticks(b, 900, commands);

    // Ereignisse sind pro Tick fluechtig - der Rest muss gleich sein.
    const ohneEreignisse = (s: MatchState) => JSON.stringify({ ...s, ereignisse: [] });
    expect(ohneEreignisse(a)).toBe(ohneEreignisse(b));
  });

  it('laeuft bei anderem Seed anders', () => {
    const a = matchAnlegen(aufbau({ seed: 1 }));
    const b = matchAnlegen(aufbau({ seed: 2 }));
    ticks(a, MATCH.countdown);
    ticks(b, MATCH.countdown);
    // Die Starthand kommt aus dem Seed.
    expect(a.spieler[0].hand).not.toEqual(b.spieler[0].hand);
  });
});

describe('Kampf', () => {
  it('laesst eine Einheit den Turm erreichen und beschaedigen', () => {
    const s = angepfiffen();
    // Direkt vor den gegnerischen Seitenturm setzen.
    const ziel = s.tuerme.find((t) => t.spieler === 1 && t.art === 'seite')!;
    karteSetzen(s, 0, 'steinwaechter', 1, ziel.x, ziel.y + tile(3));
    const vorher = ziel.hp;
    ticks(s, 200);
    expect(ziel.hp).toBeLessThan(vorher);
  });

  it('laesst Tuerme auf Einheiten in Reichweite schiessen', () => {
    const s = angepfiffen();
    const turm = s.tuerme.find((t) => t.spieler === 1 && t.art === 'seite')!;
    karteSetzen(s, 0, 'hundemeute', 1, turm.x, turm.y + tile(2));
    const start = lebende(s);
    expect(start).toBeGreaterThan(0);
    ticks(s, 300);
    // Der Turm hat mindestens einen Hund erwischt.
    expect(lebende(s)).toBeLessThan(start);
  });

  it('oeffnet nach einem Turmfall die Flanke und weckt den Koenig', () => {
    const s = angepfiffen();
    const turm = s.tuerme.find((t) => t.spieler === 1 && t.flanke === 'links')!;
    expect(koenigVon(s, 1).wach).toBe(false);
    turm.hp = 1;
    karteSetzen(s, 0, 'hundemeute', 1, turm.x, turm.y + tile(2));
    ticks(s, 300);
    expect(turm.hp).toBe(0);
    expect(s.spieler[0].offeneFlanken).toContain('links');
    expect(koenigVon(s, 1).wach).toBe(true);
  });

  it('beendet das Match sofort, wenn der Koenig faellt', () => {
    const s = angepfiffen();
    const koenig = koenigVon(s, 1);
    koenig.hp = 1;
    karteSetzen(s, 0, 'hundemeute', 1, koenig.x, koenig.y + tile(2));
    ticks(s, 400);
    expect(s.phase).toBe('ende');
    expect(s.ausgang).toBe('sieg0');
  });

  it('setzt die vereinbarte Anzahl Exemplare', () => {
    const s = angepfiffen();
    const gesetzt = karteSetzen(s, 0, 'rattenschar', 1, tile(9), tile(25));
    expect(gesetzt).toBe(6);
    expect(lebende(s)).toBe(6);
  });

  it('gibt Plaetze gestorbener Einheiten wieder frei', () => {
    const s = angepfiffen();
    const frei = s.freieEinheiten.length;
    karteSetzen(s, 0, 'rattenschar', 1, tile(9), tile(25));
    expect(s.freieEinheiten.length).toBe(frei - 6);
    for (const e of s.einheiten) if (e.aktiv) e.hp = 1;
    // Sie laufen in den Turm und sterben.
    ticks(s, 600);
    expect(s.freieEinheiten.length + lebende(s)).toBe(s.einheiten.length);
  });
});

describe('Turmwerte', () => {
  it('nimmt die Werte aus balance.ts', () => {
    const s = matchAnlegen(aufbau());
    const koenig = koenigVon(s, 0);
    expect(koenig.maxHp).toBe(TURM.koenig.hp);
    expect(s.tuerme.filter((t) => t.art === 'seite').length).toBe(4);
  });

  it('spiegelt die Tuerme beider Seiten', () => {
    const s = matchAnlegen(aufbau());
    expect(koenigVon(s, 0).y).toBe(turmY(0, 'koenig'));
    expect(koenigVon(s, 1).y).toBe(turmY(1, 'koenig'));
  });
});
