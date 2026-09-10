/* ------------------------------------------------------------------
   Platzierungshilfe: erlaubte Zone und Zielring.

   Sobald eine Karte gewaehlt ist, wird die Haelfte, auf die sie darf,
   sichtbar aufgehellt - samt der Viertel, die ein gefallener
   gegnerischer Seitenturm freigegeben hat. Ohne diese Anzeige muesste
   man die Regel auswendig kennen, und ein verworfener Zug kostet im
   Zweifel das Match.

   Der Ring unter dem Zeiger sagt dasselbe noch einmal fuer genau den
   Punkt, auf den der Finger zeigt: gruen heisst, hier geht es, rot
   heisst, hier nicht.
   ------------------------------------------------------------------ */

import { BREITE, HOEHE, FLUSS_OBEN, FLUSS_UNTEN, KOENIG_X } from '@arena/sim';
import type { Spieler, Flanke } from '@arena/sim';
import { FARBE } from './palette.js';
import { bodenPfad, bodenEllipse } from './perspektive.js';
import type { Kamera } from './kamera.js';

/**
 * Die erlaubte Flaeche aufhellen.
 *
 * Zauber duerfen ueberall hin - fuer sie wird nichts gezeichnet,
 * sonst suggeriert die Aufhellung eine Grenze, die es nicht gibt.
 */
export function zoneZeichnen(
  c: CanvasRenderingContext2D, k: Kamera, spieler: Spieler,
  offeneFlanken: readonly Flanke[], ueberall: boolean,
): void {
  if (ueberall) return;

  c.fillStyle = FARBE.zoneErlaubt;
  const eigeneVon = spieler === 0 ? FLUSS_UNTEN : 0;
  const eigeneBis = spieler === 0 ? HOEHE : FLUSS_OBEN;
  bodenPfad(c, k, 0, eigeneVon, BREITE, eigeneBis);
  c.fill();

  for (const flanke of offeneFlanken) {
    const von = flanke === 'links' ? 0 : KOENIG_X;
    const bis = flanke === 'links' ? KOENIG_X : BREITE;
    const y1 = spieler === 0 ? 0 : FLUSS_UNTEN;
    const y2 = spieler === 0 ? FLUSS_OBEN : HOEHE;
    bodenPfad(c, k, von, y1, bis, y2);
    c.fill();
  }

  // Kante an der Wasserlinie - die wichtigste Grenze des Spiels.
  c.strokeStyle = FARBE.zoneKante;
  c.lineWidth = 2;
  const kante = spieler === 0 ? FLUSS_UNTEN : FLUSS_OBEN;
  bodenPfad(c, k, 0, kante, BREITE, kante);
  c.stroke();
}

/** Ring unter dem Zeiger. `erlaubt` faerbt ihn gruen oder rot. */
export function zielringZeichnen(
  c: CanvasRenderingContext2D, k: Kamera,
  x: number, y: number, radius: number, erlaubt: boolean,
): void {
  c.fillStyle = erlaubt ? 'rgba(74, 222, 128, 0.22)' : 'rgba(248, 113, 113, 0.22)';
  bodenEllipse(c, k, x, y, radius, 0.55);
  c.fill();

  c.strokeStyle = erlaubt ? '#4ade80' : '#f87171';
  c.lineWidth = 2.5;
  bodenEllipse(c, k, x, y, radius, 0.55);
  c.stroke();
}

/**
 * Ring fuer einen abgeschickten, noch nicht ausgefuehrten Zug.
 *
 * Online liegen zwischen dem Tippen und dem Erscheinen der Einheit
 * rund zweihundert Millisekunden. Ohne Anzeige liest sich das wie ein
 * verschluckter Zug, und der Spieler tippt ein zweites Mal. Der Ring
 * pulsiert leicht, damit er sich vom festen Zielring unterscheidet -
 * er bedeutet "unterwegs", nicht "hier".
 */
export function wartetringZeichnen(
  c: CanvasRenderingContext2D, k: Kamera,
  x: number, y: number, radius: number, zeit: number,
): void {
  const puls = 0.75 + 0.25 * Math.sin(zeit * 9);
  c.globalAlpha = puls;
  c.strokeStyle = '#e2e8f0';
  c.lineWidth = 2;
  c.setLineDash([6, 5]);
  bodenEllipse(c, k, x, y, radius, 0.55);
  c.stroke();
  c.setLineDash([]);
  c.globalAlpha = 1;
}
