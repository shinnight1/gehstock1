/* ------------------------------------------------------------------
   Eingaben als Commands.

   Ein Command ist das Einzige, was von aussen in die Simulation
   hineingeht. Er traegt den Tick, fuer den er gilt - damit ist die
   Reihenfolge festgelegt, egal ob er lokal entsteht oder ueber das
   Netz kommt.

   Die Pruefung steht hier und nur hier. Client und Server rufen
   dieselbe Funktion auf: der Client, um einen sinnlosen Zug gar
   nicht erst zu zeigen, der Server, um einen manipulierten zu
   verwerfen. Zwei getrennte Pruefungen waeren zwei Gelegenheiten,
   unterschiedlich zu urteilen.
   ------------------------------------------------------------------ */

import type { Spieler } from './types.js';
import type { MatchState } from './state.js';
import { darfPlatzieren } from './arena.js';
import { karteVon } from './data/cards.js';
import { handPlatz, karteZyklieren, hatElixir, elixirAbziehen, levelVon } from './hand.js';
import { karteSetzen } from './spawn.js';
import { zauberWirken } from './zauber.js';

export interface PlayCard {
  typ: 'playCard';
  spieler: Spieler;
  kartenId: string;
  /** Tick, in dem der Zug ausgefuehrt werden soll. */
  tick: number;
  x: number;
  y: number;
}

export type Command = PlayCard;

/** Warum ein Zug nicht geht. `null` heisst: er geht. */
export type Ablehnung =
  | 'phase'
  | 'unbekannteKarte'
  | 'nichtAufDerHand'
  | 'zuwenigElixir'
  | 'zonneVerboten';

/**
 * Zug pruefen, ohne ihn auszufuehren.
 *
 * Gibt null zurueck, wenn er erlaubt ist, sonst den Grund. Der Grund
 * ist maschinenlesbar, damit der Server ihn protokollieren und der
 * Client ihn anzeigen kann, ohne Text zu vergleichen.
 */
export function pruefeZug(s: MatchState, cmd: PlayCard): Ablehnung | null {
  if (s.phase !== 'laeuft' && s.phase !== 'overtime') return 'phase';

  const karte = karteVon(cmd.kartenId);
  if (!karte || karte.sammelbar === false) return 'unbekannteKarte';

  const p = s.spieler[cmd.spieler];
  if (handPlatz(p, cmd.kartenId) < 0) return 'nichtAufDerHand';
  if (!hatElixir(p, karte.elixir)) return 'zuwenigElixir';

  /* Zauber duerfen ueberall hin - das ist ihr Wesen. Alles andere nur
     auf die eigene Haelfte, erweitert um die Viertel hinter gefallenen
     gegnerischen Seitentuermen. */
  if (karte.art !== 'zauber') {
    if (!darfPlatzieren(cmd.spieler, cmd.x, cmd.y, p.offeneFlanken)) {
      return 'zonneVerboten';
    }
  }

  return null;
}

/**
 * Zug ausfuehren. Gibt zurueck, ob er angenommen wurde.
 *
 * Ein abgelehnter Zug aendert nichts - kein halber Abzug, kein
 * halbes Absetzen.
 */
export function fuehreZugAus(s: MatchState, cmd: PlayCard): boolean {
  if (pruefeZug(s, cmd) !== null) return false;

  const karte = karteVon(cmd.kartenId)!;
  const p = s.spieler[cmd.spieler];
  const platz = handPlatz(p, cmd.kartenId);
  const level = levelVon(s, cmd.spieler, cmd.kartenId);

  elixirAbziehen(p, karte.elixir);
  karteZyklieren(p, platz);

  if (karte.art === 'zauber') {
    zauberWirken(s, cmd.spieler, cmd.kartenId, level, cmd.x, cmd.y);
  } else {
    karteSetzen(s, cmd.spieler, cmd.kartenId, level, cmd.x, cmd.y);
  }
  return true;
}

/**
 * Alle Commands eines Ticks ausfuehren.
 *
 * Sortiert wird nach Spieler und dann nach Kartenname - nicht nach
 * Eingangszeit. Zwei Geraete koennen dieselben zwei Commands in
 * unterschiedlicher Reihenfolge empfangen; ohne feste Sortierung
 * liefe die Simulation danach auseinander.
 */
export function commandsAnwenden(s: MatchState, commands: readonly Command[]): void {
  if (commands.length === 0) return;
  const dran = commands.filter((c) => c.tick === s.tick);
  if (dran.length === 0) return;

  dran.sort((a, b) => {
    if (a.spieler !== b.spieler) return a.spieler - b.spieler;
    if (a.kartenId !== b.kartenId) return a.kartenId < b.kartenId ? -1 : 1;
    if (a.x !== b.x) return a.x - b.x;
    return a.y - b.y;
  });

  for (const c of dran) fuehreZugAus(s, c);
}
