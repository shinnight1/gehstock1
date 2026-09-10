/* ------------------------------------------------------------------
   Elixir, Hand und Kartenzyklus.

   Elixir laeuft ueber einen ganzzahligen Zaehler, nicht ueber einen
   Bruchteil pro Tick. Bei 2.8 Sekunden je Punkt waeren das 17.857
   Tausendstel pro Tick - eine Zahl, die sich nicht sauber addieren
   laesst. Stattdessen zaehlt elixirRest die Ticks hoch, mit Tempo 1,
   2 oder 3, und springt bei ticksProPunkt auf den naechsten Punkt.
   Doppeltes und dreifaches Elixir sind damit exakt und nicht
   ungefaehr doppelt so schnell.

   Der Zyklus ist eine reine Warteschlange: die gespielte Karte
   wandert ans Ende, die vorderste rueckt nach. Wer sein Deck kennt,
   weiss damit immer, was kommt - genau das macht Deckbau zu einer
   Entscheidung und nicht zu Glueck.
   ------------------------------------------------------------------ */

import { rngMische } from './rng.js';
import type { MatchState, SpielerState } from './state.js';
import type { Spieler } from './types.js';
import { ELIXIR, MATCH, DECK } from './data/balance.js';

/**
 * Elixir-Tempo im aktuellen Abschnitt.
 *
 * Einfach bis zur letzten Minute, doppelt danach, dreifach in der
 * Verlaengerung. Die Grenzen stehen in balance.ts.
 */
export function elixirTempo(s: MatchState): number {
  if (s.phase === 'overtime') return ELIXIR.tempoDreifach;
  if (s.tick >= MATCH.doppeltAb) return ELIXIR.tempoDoppelt;
  return ELIXIR.tempoNormal;
}

export function elixirTick(s: MatchState): void {
  const tempo = elixirTempo(s);
  for (const p of s.spieler) {
    if (p.elixir >= ELIXIR.cap) {
      // Voll - der Zaehler laeuft nicht weiter, sonst gaebe es beim
      // Ausspielen einen Gratispunkt obendrauf.
      p.elixirRest = 0;
      continue;
    }
    p.elixirRest += tempo;
    while (p.elixirRest >= ELIXIR.ticksProPunkt && p.elixir < ELIXIR.cap) {
      p.elixirRest -= ELIXIR.ticksProPunkt;
      p.elixir++;
    }
    if (p.elixir >= ELIXIR.cap) p.elixirRest = 0;
  }
}

/** Fuellstand zum naechsten Punkt in Promille - nur zum Anzeigen. */
export function elixirAnteilPromille(p: SpielerState): number {
  if (p.elixir >= ELIXIR.cap) return 1000;
  return Math.trunc((p.elixirRest * 1000) / ELIXIR.ticksProPunkt);
}

/* ------------------------------ Hand ------------------------------- */

/**
 * Hand und Warteschlange erstmalig fuellen.
 *
 * Gemischt wird mit dem Match-RNG, damit beide Seiten dieselbe
 * Startreihenfolge berechnen. Ein eigener Mischvorgang je Spieler
 * waere nicht reproduzierbar, wenn ein Client spaeter dazukommt.
 */
export function handAusteilen(s: MatchState): void {
  for (const p of s.spieler) {
    const karten = p.deck.slice();
    rngMische(s.rng, karten);
    p.hand = karten.slice(0, DECK.handGroesse);
    p.queue = karten.slice(DECK.handGroesse);
  }
}

/** Steht die Karte auf der Hand? Gibt den Platz zurueck, sonst -1. */
export function handPlatz(p: SpielerState, kartenId: string): number {
  return p.hand.indexOf(kartenId);
}

/**
 * Eine gespielte Karte durch die naechste ersetzen.
 *
 * Die gespielte wandert ans Ende der Warteschlange, die vorderste
 * nimmt ihren Platz auf der Hand ein - an derselben Stelle, damit die
 * Kartenleiste nicht springt.
 */
export function karteZyklieren(p: SpielerState, platz: number): void {
  const gespielt = p.hand[platz];
  if (gespielt === undefined) return;
  const naechste = p.queue.shift();
  if (naechste === undefined) {
    // Sollte nie vorkommen - Deck und Hand sind gleich gross geteilt.
    p.queue.push(gespielt);
    return;
  }
  p.hand[platz] = naechste;
  p.queue.push(gespielt);
}

/** Die Karte, die als naechste nachrueckt. Fuer die Vorschau. */
export function naechsteKarte(p: SpielerState): string | null {
  return p.queue.length > 0 ? p.queue[0]! : null;
}

/* ---------------------------- Kosten ------------------------------- */

export function hatElixir(p: SpielerState, kosten: number): boolean {
  return p.elixir >= kosten;
}

export function elixirAbziehen(p: SpielerState, kosten: number): void {
  p.elixir = Math.max(0, p.elixir - kosten);
}

/** Kartenlevel eines Spielers. Fehlt der Eintrag, gilt Stufe 1. */
export function levelVon(s: MatchState, spieler: Spieler, kartenId: string): number {
  return s.spieler[spieler].level[kartenId] ?? 1;
}
