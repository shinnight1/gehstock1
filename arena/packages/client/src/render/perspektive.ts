/* ------------------------------------------------------------------
   Zeichen-Bausteine fuer die perspektivische Ansicht.

   Alles, was in der Arena Volumen hat, entsteht aus drei Formen:
   einer Bodenflaeche (Trapez), einer Bodenellipse (Schatten, Sockel,
   Radien) und einem aufrechten Quader. Sie hier zu buendeln haelt die
   Perspektivrechnung aus dem uebrigen Zeichencode heraus.
   ------------------------------------------------------------------ */

import { pxX, pxY, skalaBei, bodenStauchung, pxHoehe } from './kamera.js';
import type { Kamera } from './kamera.js';

/**
 * Pfad fuer ein achsenparalleles Rechteck der Simulation. Auf dem
 * Bildschirm wird daraus ein Trapez, weil die hintere Kante schmaler
 * projiziert wird als die vordere.
 */
export function bodenPfad(
  c: CanvasRenderingContext2D, k: Kamera,
  x1: number, y1: number, x2: number, y2: number,
): void {
  const hinten = Math.min(y1, y2);
  const vorne = Math.max(y1, y2);
  c.beginPath();
  c.moveTo(pxX(k, x1, hinten), pxY(k, hinten));
  c.lineTo(pxX(k, x2, hinten), pxY(k, hinten));
  c.lineTo(pxX(k, x2, vorne), pxY(k, vorne));
  c.lineTo(pxX(k, x1, vorne), pxY(k, vorne));
  c.closePath();
}

/** Kreisflaeche auf dem Boden. `flach` druckt sie zusaetzlich zusammen. */
export function bodenEllipse(
  c: CanvasRenderingContext2D, k: Kamera,
  x: number, y: number, radius: number, flach = 1,
): void {
  const rx = skalaBei(k, y) * radius;
  const ry = rx * bodenStauchung(k, y) * flach;
  c.beginPath();
  c.ellipse(pxX(k, x, y), pxY(k, y), rx, ry, 0, 0, Math.PI * 2);
}

/* ---------------------------- Schatten ----------------------------- */

let schattenBild: HTMLCanvasElement | null = null;

/**
 * Weicher Bodenschatten aus einem vorgerenderten Verlauf.
 *
 * Bewusst kein shadowBlur und kein filter: beides rechnet Safari pro
 * Aufruf neu und kostet auf dem iPad ein Vielfaches. Ein einmal
 * erzeugtes Sprite, das nur noch skaliert kopiert wird, ist praktisch
 * gratis - und genau das braucht jede Einheit auf dem Feld.
 */
function schattenSprite(): HTMLCanvasElement {
  if (schattenBild) return schattenBild;
  const groesse = 64;
  const flaeche = document.createElement('canvas');
  flaeche.width = groesse;
  flaeche.height = groesse;
  const c = flaeche.getContext('2d')!;
  const g = c.createRadialGradient(
    groesse / 2, groesse / 2, 0, groesse / 2, groesse / 2, groesse / 2,
  );
  g.addColorStop(0, 'rgba(0, 0, 0, 0.62)');
  g.addColorStop(0.5, 'rgba(0, 0, 0, 0.38)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  c.fillStyle = g;
  c.fillRect(0, 0, groesse, groesse);
  schattenBild = flaeche;
  return flaeche;
}

/* Schatten liegen flacher, als es die Geometrie verlangt. Ein exakt
   projizierter Kreis wirkt an der Vorderkante wie eine Pfuetze; 0.5
   liest sich als Schatten unter einem stehenden Ding. */
const SCHATTEN_FLACH = 0.5;

export function schatten(
  c: CanvasRenderingContext2D, k: Kamera,
  x: number, y: number, radius: number, staerke = 1,
): void {
  const rx = skalaBei(k, y) * radius * 1.35;
  const ry = rx * bodenStauchung(k, y) * SCHATTEN_FLACH;
  const px = pxX(k, x, y);
  const py = pxY(k, y);
  const alt = c.globalAlpha;
  c.globalAlpha = alt * staerke;
  // Leicht nach hinten versetzt - das Licht kommt von vorne oben.
  c.drawImage(schattenSprite(), px - rx, py - ry * 1.25, rx * 2, ry * 2);
  c.globalAlpha = alt;
}

/* ----------------------------- Quader ------------------------------ */

export interface QuaderFarben {
  /** Deckflaeche - bekommt das meiste Licht. */
  oben: string;
  /** Die dem Betrachter zugewandte Wand. */
  vorne: string;
  /** Die seitliche Wand, im Schatten. */
  seite: string;
}

/* Schmales Licht auf der vorderen Oberkante. Eine gefuellte Flaeche
   ohne Kante liest sich als Farbfleck; erst die Lichtkante macht
   daraus einen Koerper mit Materialstaerke. */
const KANTENLICHT = 'rgba(255, 255, 255, 0.28)';

/**
 * Aufrechter Block mit Deckflaeche und zwei Waenden.
 *
 * Sichtbar ist immer die Deckflaeche und die vordere Wand; von den
 * beiden Seitenwaenden hoechstens eine - welche, entscheidet die Lage
 * zur Blickachse in der Feldmitte. Ueberlappen koennen sich die
 * Flaechen dabei nicht, die Zeichenreihenfolge ist also frei.
 *
 * `basis` ist die Hoehe des Fusspunkts ueber dem Boden - damit lassen
 * sich Bloecke stapeln, etwa Zinnen auf einem Turm.
 */
export function quader(
  c: CanvasRenderingContext2D, k: Kamera,
  x: number, y: number, breite: number, tiefe: number, hoehe: number,
  farben: QuaderFarben, basis = 0,
): void {
  const links = x - breite / 2;
  const rechts = x + breite / 2;
  const hinten = y - tiefe / 2;
  const vorne = y + tiefe / 2;

  const hochHinten = pxHoehe(k, hinten, hoehe);
  const hochVorne = pxHoehe(k, vorne, hoehe);
  const fussHinten = pxHoehe(k, hinten, basis);
  const fussVorne = pxHoehe(k, vorne, basis);

  const yHinten = pxY(k, hinten) - fussHinten;
  const yVorne = pxY(k, vorne) - fussVorne;
  const xLinksHinten = pxX(k, links, hinten);
  const xRechtsHinten = pxX(k, rechts, hinten);
  const xLinksVorne = pxX(k, links, vorne);
  const xRechtsVorne = pxX(k, rechts, vorne);

  // Deckflaeche
  c.fillStyle = farben.oben;
  c.beginPath();
  c.moveTo(xLinksHinten, yHinten - hochHinten);
  c.lineTo(xRechtsHinten, yHinten - hochHinten);
  c.lineTo(xRechtsVorne, yVorne - hochVorne);
  c.lineTo(xLinksVorne, yVorne - hochVorne);
  c.closePath();
  c.fill();

  // Vordere Wand
  c.fillStyle = farben.vorne;
  c.beginPath();
  c.moveTo(xLinksVorne, yVorne - hochVorne);
  c.lineTo(xRechtsVorne, yVorne - hochVorne);
  c.lineTo(xRechtsVorne, yVorne);
  c.lineTo(xLinksVorne, yVorne);
  c.closePath();
  c.fill();

  // Lichtkante zwischen Deckflaeche und vorderer Wand.
  c.strokeStyle = KANTENLICHT;
  c.lineWidth = Math.max(0.75, (xRechtsVorne - xLinksVorne) * 0.022);
  c.beginPath();
  c.moveTo(xLinksVorne, yVorne - hochVorne);
  c.lineTo(xRechtsVorne, yVorne - hochVorne);
  c.stroke();

  // Die Seitenwand, die zur Blickachse zeigt.
  const mitte = k.x0 + k.breitePx / 2;
  const zeigtNachLinks = pxX(k, x, y) > mitte;
  c.fillStyle = farben.seite;
  c.beginPath();
  if (zeigtNachLinks) {
    c.moveTo(xLinksHinten, yHinten - hochHinten);
    c.lineTo(xLinksVorne, yVorne - hochVorne);
    c.lineTo(xLinksVorne, yVorne);
    c.lineTo(xLinksHinten, yHinten);
  } else {
    c.moveTo(xRechtsHinten, yHinten - hochHinten);
    c.lineTo(xRechtsVorne, yVorne - hochVorne);
    c.lineTo(xRechtsVorne, yVorne);
    c.lineTo(xRechtsHinten, yHinten);
  }
  c.closePath();
  c.fill();
}

/**
 * Fugen auf der vorderen Wand eines Quaders.
 *
 * Ohne sie ist eine Turmwand eine graue Flaeche in der Groesse einer
 * Handflaeche - genau das, was nach Karton aussieht. Vier bis fuenf
 * Lagen geben ihr Massstab, ohne dass daraus ein Muster wird.
 */
export function mauerwerk(
  c: CanvasRenderingContext2D, k: Kamera,
  x: number, y: number, breite: number, tiefe: number, hoehe: number,
  basis: number, lagen: number, farbe: string,
): void {
  const vorne = y + tiefe / 2;
  const links = pxX(k, x - breite / 2, vorne);
  const rechts = pxX(k, x + breite / 2, vorne);
  const boden = pxY(k, vorne);

  c.strokeStyle = farbe;
  c.lineWidth = Math.max(0.75, (rechts - links) * 0.02);
  for (let i = 1; i < lagen; i++) {
    const h = basis + (hoehe * i) / lagen;
    const yy = boden - pxHoehe(k, vorne, h);
    c.beginPath();
    c.moveTo(links, yy);
    c.lineTo(rechts, yy);
    c.stroke();

    // Versetzte Stossfuge, damit kein Streifenmuster entsteht.
    const mitte = links + (rechts - links) * (i % 2 === 0 ? 0.36 : 0.64);
    const naechste = boden - pxHoehe(k, vorne, basis + (hoehe * (i + 1)) / lagen);
    c.beginPath();
    c.moveTo(mitte, yy);
    c.lineTo(mitte, Math.max(naechste, yy - (yy - naechste)));
    c.stroke();
  }
}
