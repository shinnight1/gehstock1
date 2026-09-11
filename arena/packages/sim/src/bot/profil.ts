/* ------------------------------------------------------------------
   Wie stark der Bot spielt.

   Alle Werte haengen stufenlos an den Trophaeen des Spielers. Es gibt
   keine Schwierigkeitsstufen zum Auswaehlen - der Gegner waechst
   einfach mit, und zwar an genau den Stellen, an denen sich Koennen
   zeigt: wie schnell er reagiert, ob er den richtigen Konter findet,
   ob er auf Elixirvorteil spielt und wie genau er setzt.

   Was der Bot NICHT bekommt: Kenntnis der gegnerischen Hand,
   zusaetzliches Elixir, kuerzere Aufstellzeiten. Ein Gegner, der
   schummelt, ist kein Massstab fuer das eigene Koennen - man lernt
   dann nur, gegen Betrug zu spielen.
   ------------------------------------------------------------------ */

import { tile } from '../fixed.js';
import { ARENEN, TICKS_PRO_SEKUNDE, arenaFuer } from '../data/balance.js';

export interface BotProfil {
  /** Ticks, bis der Bot auf eine gespielte Karte reagiert. */
  reaktion: number;
  /** Promille: wie oft er den optimalen Konter statt irgendeiner Karte nimmt. */
  konterGenauigkeit: number;
  /** Promille: wie konsequent er auf Elixirvorteil spielt statt sofort auszugeben. */
  elixirDisziplin: number;
  /** Streuung beim Setzen, in Millitiles. */
  platzierungsFehler: number;
  /** Buendelt er Angriffe und nutzt doppeltes Elixir gezielt? */
  pushTiming: boolean;
  /** Promille: wie stimmig sein Deck zusammengestellt ist. */
  deckQualitaet: number;
}

/* Die Eckwerte. Dazwischen wird linear ueberblendet - eine Stufe mehr
   soll sich nach etwas anfuehlen, aber nie nach einer Wand. */
const LEICHT = {
  reaktion: Math.round(1.8 * TICKS_PRO_SEKUNDE),
  konterGenauigkeit: 300,
  elixirDisziplin: 200,
  platzierungsFehler: tile(4),
  deckQualitaet: 300,
};

const SCHWER = {
  reaktion: Math.round(0.25 * TICKS_PRO_SEKUNDE),
  konterGenauigkeit: 950,
  elixirDisziplin: 900,
  platzierungsFehler: tile(0.3),
  deckQualitaet: 950,
};

/** Ab hier buendelt der Bot Angriffe. */
const PUSH_AB = 1500;

function misch(leicht: number, schwer: number, t: number): number {
  return Math.round(leicht + (schwer - leicht) * t);
}

/**
 * Botprofil zu einem Trophaeenstand.
 *
 * `t` laeuft von 0 bis 1 und wird nicht mehr aus einer Kurve ueber
 * alle Trophaeen gebildet, sondern aus der Arena: jede hat einen
 * eigenen Haertegrad, und innerhalb einer Arena wird zum Wert der
 * naechsten ueberblendet.
 *
 * Der Grund steht bei `Arena.haerte`. Kurz: eine reine Gesamtkurve
 * liess die zweite Arena bei 2,8 Prozent Staerke beginnen - also
 * genauso leicht wie die erste. Die Stufen gehoeren dorthin, wo der
 * Spieler sie als Fortschritt erlebt.
 */
export function botProfil(trophaeen: number): BotProfil {
  const arena = arenaFuer(trophaeen);
  const naechste = ARENEN.find((a) => a.ab > trophaeen);
  const spanne = naechste && naechste.ab > arena.ab
    ? Math.max(0, Math.min(1, (trophaeen - arena.ab) / (naechste.ab - arena.ab)))
    : 1;
  const bis = naechste ? naechste.haerte : 1;
  const t = Math.max(0, Math.min(1, arena.haerte + (bis - arena.haerte) * spanne));

  return {
    reaktion: misch(LEICHT.reaktion, SCHWER.reaktion, t),
    konterGenauigkeit: misch(LEICHT.konterGenauigkeit, SCHWER.konterGenauigkeit, t),
    elixirDisziplin: misch(LEICHT.elixirDisziplin, SCHWER.elixirDisziplin, t),
    platzierungsFehler: misch(LEICHT.platzierungsFehler, SCHWER.platzierungsFehler, t),
    pushTiming: trophaeen >= PUSH_AB,
    deckQualitaet: misch(LEICHT.deckQualitaet, SCHWER.deckQualitaet, t),
  };
}
