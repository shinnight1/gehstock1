/* ------------------------------------------------------------------
   Splitter und Kartenlevel.

   Ein Duplikat wird zu Splittern, Splitter werden zu Leveln. Die
   Kosten stehen in balance.ts: 2, 4, 8, 16 fuer die Stufen 2 bis 5.

   Aufgestiegen wird nicht automatisch. Der Spieler soll den Moment
   sehen - ein Level, das im Hintergrund passiert, faellt niemandem
   auf und fuehlt sich nach nichts an. Die Sammlung zeigt deshalb
   einen Knopf, sobald genug Splitter da sind.
   ------------------------------------------------------------------ */

import { LEVEL } from '@arena/sim';
import type { Profil, KartenBesitz } from './profil.js';

/** Splitter fuer den Sprung von `level` auf die naechste Stufe. */
export function kostenFuerStufe(level: number): number {
  if (level >= LEVEL.max) return Infinity;
  return LEVEL.splitterProStufe[level - 1] ?? Infinity;
}

/** Wie viele Splitter noch fehlen. Infinity, wenn die Karte am Ende ist. */
export function fehlendeSplitter(b: KartenBesitz): number {
  const noetig = kostenFuerStufe(b.level);
  if (!Number.isFinite(noetig)) return Infinity;
  return Math.max(0, noetig - b.splitter);
}

export function kannAufsteigen(b: KartenBesitz): boolean {
  return fehlendeSplitter(b) === 0;
}

/**
 * So oft aufsteigen, wie die Splitter reichen.
 *
 * Mehrfach in einem Schritt ist Absicht: wer lange nicht in die
 * Sammlung geschaut hat, soll nicht viermal denselben Knopf druecken
 * muessen. Gibt die Zahl der gewonnenen Stufen zurueck.
 */
export function aufsteigen(p: Profil, kartenId: string): number {
  const b = p.karten[kartenId];
  if (!b) return 0;
  let stufen = 0;
  while (b.level < LEVEL.max) {
    const noetig = kostenFuerStufe(b.level);
    if (b.splitter < noetig) break;
    b.splitter -= noetig;
    b.level++;
    stufen++;
  }
  return stufen;
}

/**
 * Splitter gutschreiben, ohne aufzusteigen.
 *
 * Getrennt vom Aufstieg, damit der Roll-Bildschirm den Zugewinn
 * zeigen kann, bevor sich das Level aendert.
 */
export function splitterGeben(p: Profil, kartenId: string, anzahl: number): number {
  const b = p.karten[kartenId];
  if (!b || anzahl <= 0) return 0;
  /* Am Maximum verfallen weitere Splitter. Sie zu sammeln waere eine
     Zahl, die nie wieder etwas bewirkt - besser ehrlich anzeigen,
     dass die Karte fertig ist. */
  if (b.level >= LEVEL.max) return 0;
  b.splitter += anzahl;
  return anzahl;
}

/** Fortschritt zur naechsten Stufe in Promille - fuer den Balken. */
export function stufenFortschritt(b: KartenBesitz): number {
  const noetig = kostenFuerStufe(b.level);
  if (!Number.isFinite(noetig)) return 1000;
  return Math.min(1000, Math.trunc((b.splitter * 1000) / noetig));
}

/** Wie viele Karten insgesamt besessen werden, und wie viele es gibt. */
export function sammlungsStand(
  p: Profil, alleIds: readonly string[],
): { besessen: number; gesamt: number; stufenSumme: number } {
  let besessen = 0;
  let stufenSumme = 0;
  for (const id of alleIds) {
    const b = p.karten[id];
    if (!b) continue;
    besessen++;
    stufenSumme += b.level;
  }
  return { besessen, gesamt: alleIds.length, stufenSumme };
}
