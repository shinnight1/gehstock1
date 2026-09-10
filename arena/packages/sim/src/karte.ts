/* ------------------------------------------------------------------
   Die Datenstruktur einer Karte.

   Hier stehen keine Werte, nur die Form. Die Werte selbst liegen in
   data/cards.ts, damit sich das Balancing an einer Stelle drehen
   laesst, ohne dass die Spiellogik davon weiss.

   Zwei Umbenennungen gegenueber der Umgangssprache, beide aus einem
   Grund - Determinismus:

     angriffsGeschwindigkeit  ->  angriffsTakt in Ticks
     Geschwindigkeit          ->  tempo in Millitiles pro Tick

   Sekunden und Tiles-pro-Sekunde muessten sonst bei jedem Tick in
   Ticks umgerechnet werden, und jede dieser Divisionen ist eine
   Gelegenheit fuer Rundungsunterschiede zwischen zwei Geraeten.
   ------------------------------------------------------------------ */

import type { KartenArt, Zielt, Ebene, SchadensTyp, Seltenheit } from './types.js';
import { LEVEL } from './data/balance.js';
import { skaliere } from './fixed.js';

export interface Karte {
  id: string;
  name: string;
  art: KartenArt;
  seltenheit: Seltenheit;
  /** Kosten beim Ausspielen. Aendert sich nie mit dem Level. */
  elixir: number;

  /* ---- Einheiten und Gebaeude ---- */

  /** Trefferpunkte je Exemplar. */
  hp: number;
  /** Schaden je Angriff. */
  dmg: number;
  /** Ticks zwischen zwei Angriffen. */
  angriffsTakt: number;
  /** Millitiles pro Tick. 50 entspricht einem Tile je Sekunde. */
  tempo: number;
  /** Angriffsreichweite in Millitiles, gemessen von Rand zu Rand. */
  reichweite: number;
  zieltAuf: Zielt;
  schadensTyp: SchadensTyp;
  /** Wo sich die Einheit bewegt. Luft ignoriert Fluss und Kollision. */
  ebene: Ebene;
  /** Wie viele Exemplare ein Ausspielen erzeugt. */
  anzahl: number;
  /** Ticks vom Absetzen bis zur Handlungsfaehigkeit. */
  deployZeit: number;
  /** Kollisionsradius in Millitiles. */
  radius: number;

  /** Nur bei schadensTyp 'flaeche': Radius des Treffers. */
  flaechenRadius?: number;
  /** Gebaeude: Lebensdauer in Ticks. Danach zerfaellt es von selbst. */
  lebensdauer?: number;
  /** Spawner: alle wie viele Ticks kommt Nachschub. */
  spawnTakt?: number;
  /** Spawner: welche Karte wird erzeugt. */
  spawnKarte?: string;
  /** Spawner: wie viele je Welle. */
  spawnAnzahl?: number;

  /* ---- Zauber ---- */

  /** Wirkungsradius in Millitiles. */
  zauberRadius?: number;
  /** Schaden auf Einheiten. */
  zauberDmg?: number;
  /** Schaden auf Tuerme - meist deutlich geringer als auf Einheiten. */
  zauberTurmDmg?: number;
  /** Verlangsamung: Rest-Tempo in Promille, 650 bedeutet 65 Prozent. */
  bremsePromille?: number;
  /** Wie lange die Verlangsamung anhaelt, in Ticks. */
  bremseDauer?: number;
  /** Rueckstoss beim Treffer, in Millitiles. */
  rueckstoss?: number;

  /* ---- Anzeige ---- */

  /**
   * Steht die Karte in Sammlung, Deckbau und Rolls?
   *
   * Fehlt das Feld, gilt true. Auf false stehen nur Einheiten, die
   * ausschliesslich von Gebaeuden erzeugt werden - sie sind Teil des
   * Spiels, aber keine Karte, die man besitzen kann.
   */
  sammelbar?: boolean;
  /** Kurzer Satz fuer Sammlung und Deckbau. */
  text: string;
  /** Grundfarbe, wenn keine eigene Grafik vorliegt. */
  farbe: string;
}

/**
 * Ein Kartenwert auf ein Level gebracht.
 *
 * Nur hp und dmg skalieren - Elixirkosten, Tempo und Reichweite
 * bleiben gleich. Sonst wuerde ein hohes Level nicht staerker,
 * sondern anders spielen, und die Konter-Matrix haette pro Stufe
 * andere Ergebnisse.
 */
export function levelWert(basis: number, level: number): number {
  const stufe = Math.max(1, Math.min(level, LEVEL.max));
  return skaliere(basis, LEVEL.faktorPromille[stufe - 1]!);
}

export function kartenHp(karte: Karte, level: number): number {
  return levelWert(karte.hp, level);
}

export function kartenDmg(karte: Karte, level: number): number {
  return levelWert(karte.dmg, level);
}

/** Zauberschaden skaliert wie jeder andere Schaden mit dem Level. */
export function zauberSchaden(karte: Karte, level: number): {
  einheiten: number; tuerme: number;
} {
  return {
    einheiten: levelWert(karte.zauberDmg ?? 0, level),
    tuerme: levelWert(karte.zauberTurmDmg ?? 0, level),
  };
}
