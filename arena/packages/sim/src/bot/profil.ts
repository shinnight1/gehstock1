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
import { ARENEN, TICKS_PRO_SEKUNDE } from '../data/balance.js';

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

/** Trophaeenstand, ab dem der Bot sein Maximum erreicht. */
const MAX_TROPHAEEN = ARENEN[ARENEN.length - 1]!.ab + 500;

function misch(leicht: number, schwer: number, t: number): number {
  return Math.round(leicht + (schwer - leicht) * t);
}

/**
 * Botprofil zu einem Trophaeenstand.
 *
 * `t` laeuft von 0 bei null Trophaeen bis 1 am oberen Ende. Der
 * Verlauf ist bewusst leicht beschleunigt: die ersten Arenen sollen
 * nachgiebig bleiben, weil dort die Decks noch duenn sind.
 */
export function botProfil(trophaeen: number): BotProfil {
  const roh = Math.max(0, Math.min(1, trophaeen / MAX_TROPHAEEN));
  const t = roh * roh * (3 - 2 * roh); // weiche Kurve, an beiden Enden flach

  return {
    reaktion: misch(LEICHT.reaktion, SCHWER.reaktion, t),
    konterGenauigkeit: misch(LEICHT.konterGenauigkeit, SCHWER.konterGenauigkeit, t),
    elixirDisziplin: misch(LEICHT.elixirDisziplin, SCHWER.elixirDisziplin, t),
    platzierungsFehler: misch(LEICHT.platzierungsFehler, SCHWER.platzierungsFehler, t),
    pushTiming: trophaeen >= PUSH_AB,
    deckQualitaet: misch(LEICHT.deckQualitaet, SCHWER.deckQualitaet, t),
  };
}
