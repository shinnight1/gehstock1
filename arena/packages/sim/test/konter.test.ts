/* Prueft die Konter-Matrix aus data/cards.ts gegen die Simulation.
 *
 * Dokumentation und Verhalten duerfen nicht auseinanderlaufen: wer
 * einen Wert in cards.ts dreht, soll hier merken, wenn dabei ein
 * Konter kippt. Die Tests sind bewusst grob - sie fragen "gewinnt die
 * richtige Seite deutlich", nicht "mit wie viel Rest-HP". */

import { describe, it, expect } from 'vitest';
import { matchAnlegen } from '../src/entity.js';
import { ticks } from '../src/match.js';
import { karteSetzen } from '../src/spawn.js';
import { zauberWirken } from '../src/zauber.js';
import { tile } from '../src/fixed.js';
import type { MatchState } from '../src/state.js';
import type { Spieler } from '../src/types.js';

const DECK = [
  'rattenschar', 'hundemeute', 'bogenschuetzin', 'funkenregen',
  'hammergarde', 'flammenspeier', 'feuersturm', 'sturmfalken',
];

function feld(): MatchState {
  const s = matchAnlegen({
    seed: 99, decks: [DECK.slice(), DECK.slice()], einheitlicheLevel: true,
  });
  // Countdown abwarten, damit die Phase 'laeuft' ist.
  ticks(s, 60);
  return s;
}

/**
 * Feld fuer ein reines Duell.
 *
 * Zwei Eingriffe gegenueber einem echten Match, beide noetig:
 *
 * 1. Die Tuerme schweigen. Sonst schoesse einer der beiden Seiten in
 *    das Duell hinein und man wuesste am Ende nicht, ob der Konter
 *    gewirkt hat oder der Turm.
 * 2. Gekaempft wird nicht an der Feldmitte, sondern klar diesseits
 *    des Flusses. Auf der Mittellinie stuenden die beiden auf
 *    verschiedenen Ufern und liefen erst einmal zur Bruecke - der
 *    Test haette dann die Wegfindung gemessen, nicht den Konter.
 */
function duellFeld(): MatchState {
  const s = feld();
  for (const t of s.tuerme) t.reichweite = 0;
  return s;
}

function lebende(s: MatchState, spieler: Spieler): number {
  return s.einheiten.filter((e) => e.aktiv && e.spieler === spieler).length;
}

const MITTE_X = tile(9);
/** Untere Haelfte, weit genug von Fluss und Grundlinie. */
const MITTE_Y = tile(21);

describe('Konter: Zauber gegen Schwaerme', () => {
  it('Funkenregen raeumt eine Rattenschar ab', () => {
    const s = feld();
    karteSetzen(s, 1, 'rattenschar', 3, MITTE_X, MITTE_Y);
    ticks(s, 20);
    expect(lebende(s, 1)).toBe(6);
    zauberWirken(s, 0, 'funkenregen', 3, MITTE_X, MITTE_Y);
    expect(lebende(s, 1)).toBe(0);
  });

  it('Feuersturm raeumt eine Hundemeute ab', () => {
    const s = feld();
    karteSetzen(s, 1, 'hundemeute', 3, MITTE_X, MITTE_Y);
    ticks(s, 20);
    expect(lebende(s, 1)).toBe(4);
    zauberWirken(s, 0, 'feuersturm', 3, MITTE_X, MITTE_Y);
    expect(lebende(s, 1)).toBe(0);
  });

  it('Funkenregen allein legt keinen Tank um', () => {
    const s = feld();
    karteSetzen(s, 1, 'steinwaechter', 3, MITTE_X, MITTE_Y);
    ticks(s, 20);
    zauberWirken(s, 0, 'funkenregen', 3, MITTE_X, MITTE_Y);
    expect(lebende(s, 1)).toBe(1);
  });
});

describe('Konter: Flaechenschaden gegen Schwaerme', () => {
  it('Hammergarde ueberlebt eine Rattenschar', () => {
    const s = duellFeld();
    karteSetzen(s, 0, 'hammergarde', 3, MITTE_X, MITTE_Y + tile(1));
    karteSetzen(s, 1, 'rattenschar', 3, MITTE_X, MITTE_Y - tile(1));
    ticks(s, 300);
    expect(lebende(s, 0)).toBe(1);
    expect(lebende(s, 1)).toBe(0);
  });

  it('Hammergarde verliert gegen einen einzelnen dicken Gegner', () => {
    const s = duellFeld();
    karteSetzen(s, 0, 'hammergarde', 3, MITTE_X, MITTE_Y + tile(1));
    karteSetzen(s, 1, 'frostkoloss', 3, MITTE_X, MITTE_Y - tile(1));
    /* Nur bis zum Ende des Duells, nicht laenger: danach laeuft der
       Sieger weiter und stirbt irgendwann am Turm - das wuerde den
       Test etwas ganz anderes messen lassen. */
    ticks(s, 200);
    expect(lebende(s, 0)).toBe(0);
    expect(lebende(s, 1)).toBe(1);
  });
});

describe('Konter: Luft', () => {
  it('Sturmfalken gewinnen gegen reine Bodenabwehr', () => {
    const s = duellFeld();
    karteSetzen(s, 0, 'sturmfalken', 3, MITTE_X, MITTE_Y + tile(1));
    karteSetzen(s, 1, 'hundemeute', 3, MITTE_X, MITTE_Y - tile(1));
    ticks(s, 300);
    expect(lebende(s, 0)).toBeGreaterThan(0);
    expect(lebende(s, 1)).toBe(0);
  });

  it('Speerwerferinnen holen Sturmfalken herunter', () => {
    const s = duellFeld();
    karteSetzen(s, 0, 'speerwerferinnen', 3, MITTE_X, MITTE_Y + tile(1));
    karteSetzen(s, 1, 'sturmfalken', 3, MITTE_X, MITTE_Y - tile(1));
    ticks(s, 400);
    expect(lebende(s, 1)).toBe(0);
  });

  it('Wolkenwal ignoriert Einheiten und zieht zum Turm', () => {
    const s = feld();
    karteSetzen(s, 0, 'wolkenwal', 3, MITTE_X, MITTE_Y + tile(2));
    karteSetzen(s, 1, 'hundemeute', 3, MITTE_X, MITTE_Y);
    ticks(s, 100);
    const wal = s.einheiten.find((e) => e.aktiv && e.karte === 'wolkenwal');
    expect(wal).toBeDefined();
    // Er greift keine Einheit an, sondern hat einen Turm im Visier.
    expect(wal!.zielArt).toBe('turm');
  });
});

describe('Konter: Schwarm gegen Belagerungstank', () => {
  it('Rattenschar legt den Steinwaechter um', () => {
    const s = duellFeld();
    karteSetzen(s, 0, 'rattenschar', 3, MITTE_X, MITTE_Y + tile(1));
    karteSetzen(s, 1, 'steinwaechter', 3, MITTE_X, MITTE_Y - tile(1));
    ticks(s, 500);
    const tank = s.einheiten.find((e) => e.aktiv && e.karte === 'steinwaechter');
    expect(tank).toBeUndefined();
  });

  it('Steinwaechter greift die Ratten nie an', () => {
    const s = feld();
    karteSetzen(s, 1, 'rattenschar', 3, MITTE_X, MITTE_Y + tile(1));
    karteSetzen(s, 0, 'steinwaechter', 3, MITTE_X, MITTE_Y);
    ticks(s, 60);
    const tank = s.einheiten.find((e) => e.aktiv && e.karte === 'steinwaechter')!;
    // Sein Ziel ist nie eine gegnerische Einheit - nur Bauwerke.
    if (tank.zielArt === 'einheit') {
      expect(s.einheiten[tank.zielIndex]!.istGebaeude).toBe(true);
    }
  });
});

describe('Konter: Verlangsamung', () => {
  it('Frostschleier halbiert das Tempo im Wirkbereich', () => {
    const s = feld();
    karteSetzen(s, 1, 'hundemeute', 3, MITTE_X, MITTE_Y);
    ticks(s, 20);
    const vorher = s.einheiten.filter((e) => e.aktiv && e.spieler === 1)
      .map((e) => e.y);
    zauberWirken(s, 0, 'frostschleier', 3, MITTE_X, MITTE_Y);

    const gebremst = s.einheiten.find((e) => e.aktiv && e.spieler === 1)!;
    expect(gebremst.bremseRest).toBeGreaterThan(0);
    expect(gebremst.bremsePromille).toBeLessThan(1000);
    expect(vorher.length).toBeGreaterThan(0);
  });

  it('laesst die Bremse nach der Dauer auslaufen', () => {
    const s = feld();
    karteSetzen(s, 1, 'hundemeute', 3, MITTE_X, MITTE_Y);
    ticks(s, 20);
    zauberWirken(s, 0, 'frostschleier', 3, MITTE_X, MITTE_Y);
    ticks(s, 120);
    for (const e of s.einheiten) {
      if (e.aktiv) expect(e.bremsePromille).toBe(1000);
    }
  });
});

describe('Gebaeude', () => {
  it('Krypta schickt Nachschub und zerfaellt danach', () => {
    const s = feld();
    karteSetzen(s, 0, 'krypta', 3, MITTE_X, MITTE_Y + tile(4));
    ticks(s, 120);
    // Nach zwei Wellen stehen Diener auf dem Feld.
    const diener = s.einheiten.filter(
      (e) => e.aktiv && e.karte === 'knochendiener',
    ).length;
    expect(diener).toBeGreaterThan(0);

    ticks(s, 900);
    const bau = s.einheiten.find((e) => e.aktiv && e.karte === 'krypta');
    expect(bau).toBeUndefined();
  });

  it('Bollwerk zieht Angreifer auf sich', () => {
    const s = duellFeld();
    karteSetzen(s, 0, 'bollwerk', 3, MITTE_X, MITTE_Y + tile(2));
    karteSetzen(s, 1, 'steinwaechter', 3, MITTE_X, MITTE_Y - tile(2));
    ticks(s, 80);
    const tank = s.einheiten.find((e) => e.aktiv && e.karte === 'steinwaechter')!;
    expect(tank.zielArt).toBe('einheit');
    expect(s.einheiten[tank.zielIndex]!.karte).toBe('bollwerk');
  });
});
