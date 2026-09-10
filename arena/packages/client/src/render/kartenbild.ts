/* ------------------------------------------------------------------
   Kartenbilder fuer die Hand: einmal auf Anzeigegroesse gebacken.

   Die Dateien unter assets/cards/ sind freigestellte Figuren mit
   512x512 Pixeln. Sie in jedem Bild viermal auf sechzig Pixel
   herunterzurechnen waere die teuerste Zeile im ganzen HUD - eine
   Verkleinerung um den Faktor acht kostet auf dem iPad mehr als das
   halbe Spielfeld. Stattdessen entsteht je Karte genau eine Kachel in
   der Groesse, in der sie auf dem Schirm landet. Danach ist Zeichnen
   ein einziges drawImage ohne Skalierung.

   Gebacken wird in Geraetepixeln, nicht in CSS-Pixeln: der Kontext
   ist mit der Pixeldichte vorskaliert (siehe flaeche.ts), eine in
   CSS-Groesse gebackene Kachel waere auf dem iPad sichtbar weich.
   Aendern sich Groesse oder Dichte, wird neu gebacken - je Karte
   liegt immer nur eine Kachel im Speicher, hoechstens sechzehn also.

   Die Figuren stehen auf durchsichtigem Grund. Deshalb wird nicht
   beschnitten, sondern eingepasst: nichts wird abgeschnitten, und die
   Figur steht auf der Unterkante ihres Feldes statt in der Luft.
   ------------------------------------------------------------------ */

import { bildJetzt, bildZugeschnitten } from '../assets/lader.js';

interface Kachel {
  flaeche: HTMLCanvasElement;
  breite: number;
  hoehe: number;
}

const kacheln = new Map<string, Kachel>();

/**
 * Fertige Kachel fuer eine Karte, oder null solange das Bild fehlt.
 *
 * Der Aufrufer zeichnet dann seine Ersatzform - es gibt kein Warten
 * und kein await im Renderpfad.
 */
export function kartenbildJetzt(
  id: string, breite: number, hoehe: number, dichte: number, farbe: string,
): HTMLCanvasElement | null {
  const pb = Math.max(1, Math.round(breite * dichte));
  const ph = Math.max(1, Math.round(hoehe * dichte));

  const fertig = kacheln.get(id);
  if (fertig && fertig.breite === pb && fertig.hoehe === ph) return fertig.flaeche;

  const bild = bildJetzt('cards/' + id + '.webp');
  if (!bild || !bild.naturalWidth) return null;

  /* Erst den durchsichtigen Rand weg. Ohne das steht die Figur in
     ihrem Feld zu klein und zu hoch, weil die Dateien rundherum Luft
     haben. */
  const figur = bildZugeschnitten(bild) ?? bild;
  const qb = figur instanceof HTMLImageElement ? figur.naturalWidth : figur.width;
  const qh = figur instanceof HTMLImageElement ? figur.naturalHeight : figur.height;
  if (!qb || !qh) return null;

  const flaeche = document.createElement('canvas');
  flaeche.width = pb;
  flaeche.height = ph;
  const c = flaeche.getContext('2d');
  if (!c) return null;

  const r = pb * 0.1;
  rundPfad(c, 0, 0, pb, ph, r);
  c.clip();

  /* Verlauf in der Kartenfarbe: oben aufgehellt, unten abgedunkelt.
     Das gibt der Figur einen Grund, vor dem sie steht, und die Karte
     bleibt auch dann unterscheidbar, wenn zwei Figuren aehnlich
     aussehen. */
  const verlauf = c.createLinearGradient(0, 0, 0, ph);
  verlauf.addColorStop(0, mischen(farbe, 0xff, 0xff, 0xff, 0.34));
  verlauf.addColorStop(1, mischen(farbe, 0x0b, 0x12, 0x20, 0.5));
  c.fillStyle = verlauf;
  c.fillRect(0, 0, pb, ph);

  const rand = pb * 0.04;
  const skala = Math.min((pb - rand * 2) / qb, (ph - rand * 2) / qh);
  const zb = qb * skala;
  const zh = qh * skala;
  // Auf der Unterkante aufsetzen, nicht mittig schweben.
  c.drawImage(figur, (pb - zb) / 2, ph - rand - zh, zb, zh);

  kacheln.set(id, { flaeche, breite: pb, hoehe: ph });
  return flaeche;
}

/** Mischt `#rrggbb` gegen eine Zielfarbe. `anteil` 0 laesst sie unveraendert. */
function mischen(hex: string, zr: number, zg: number, zb: number, anteil: number): string {
  const wert = parseInt(hex.slice(1), 16);
  if (!Number.isFinite(wert)) return hex;
  const r = Math.round(((wert >> 16) & 0xff) * (1 - anteil) + zr * anteil);
  const g = Math.round(((wert >> 8) & 0xff) * (1 - anteil) + zg * anteil);
  const b = Math.round((wert & 0xff) * (1 - anteil) + zb * anteil);
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

function rundPfad(
  c: CanvasRenderingContext2D, x: number, y: number,
  w: number, h: number, r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + rr, y);
  c.lineTo(x + w - rr, y);
  c.quadraticCurveTo(x + w, y, x + w, y + rr);
  c.lineTo(x + w, y + h - rr);
  c.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  c.lineTo(x + rr, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - rr);
  c.lineTo(x, y + rr);
  c.quadraticCurveTo(x, y, x + rr, y);
  c.closePath();
}
