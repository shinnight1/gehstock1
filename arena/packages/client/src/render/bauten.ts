/* ------------------------------------------------------------------
   Bauwerke des Untergrunds: Bruecken, Bande, Vignette.

   Alles, was auf dem Rasen steht statt Teil von ihm zu sein, aber
   sich nie bewegt. Wird zusammen mit dem Rasen einmal gebacken
   (siehe feld.ts) und danach nur noch kopiert.
   ------------------------------------------------------------------ */

import { BREITE, HOEHE, FLUSS_OBEN, FLUSS_UNTEN, BRUECKE_BREITE, tile } from '@arena/sim';
import { FARBE, MATERIAL } from './palette.js';
import { pxX, pxY, skalaBei, pxHoehe } from './kamera.js';
import type { Kamera } from './kamera.js';
import { quader } from './perspektive.js';

/* ----------------------------- Bruecke ----------------------------- */

export function brueckeZeichnen(c: CanvasRenderingContext2D, k: Kamera, mitteX: number): void {
  /* Deutlich ueber die Ufer hinaus: eine Bruecke, die genau am Wasser
     endet, sieht aus wie ein Floss - und sie ist die wichtigste Stelle
     der Karte, sie muss sofort als Weg lesbar sein. */
  const hinten = FLUSS_OBEN - tile(0.5);
  const vorne = FLUSS_UNTEN + tile(0.5);
  const tiefe = vorne - hinten;
  const mitteY = (hinten + vorne) / 2;
  const hoehe = tile(0.32);

  quader(c, k, mitteX, mitteY, BRUECKE_BREITE, tiefe, hoehe, MATERIAL.holz);

  /* Planken nur angedeutet. Enge Querstreben auf einem schmalen
     Steg sehen aus wie eine Leiter; das Holz braucht Struktur, nicht
     Sprossen. */
  c.strokeStyle = FARBE.holzFuge;
  c.globalAlpha = 0.45;
  const planken = 5;
  for (let i = 1; i < planken; i++) {
    const y = hinten + (tiefe * i) / planken;
    const hoch = pxHoehe(k, y, hoehe);
    c.lineWidth = Math.max(1, skalaBei(k, y) * tile(0.04));
    c.beginPath();
    c.moveTo(pxX(k, mitteX - BRUECKE_BREITE / 2, y), pxY(k, y) - hoch);
    c.lineTo(pxX(k, mitteX + BRUECKE_BREITE / 2, y), pxY(k, y) - hoch);
    c.stroke();
  }
  c.globalAlpha = 1;

  // Gelaender als schmale Quader auf beiden Seiten.
  const gelaender = tile(0.14);
  for (const seite of [-1, 1]) {
    quader(
      c, k, mitteX + seite * (BRUECKE_BREITE / 2 - gelaender / 2), mitteY,
      gelaender, tiefe, tile(0.2), MATERIAL.holz, hoehe,
    );
  }
}

/* ------------------------------ Bande ------------------------------ */

/**
 * Mauer rund um das Feld. Sie schliesst das Spielfeld sichtbar ab,
 * statt es an der Kante ausfransen zu lassen, und gibt dem Ganzen
 * eine Standflaeche.
 */
export function bandeZeichnen(c: CanvasRenderingContext2D, k: Kamera): void {
  const dicke = tile(0.45);
  const hoehe = tile(0.55);

  // Seitenwaende laufen in die Tiefe und sind deshalb keine Quader.
  const seiten = [{ x: 0, richtung: -1 }, { x: BREITE, richtung: 1 }];
  for (const s of seiten) {
    const aussen = s.x + dicke * s.richtung;
    const obenHinten = pxY(k, 0) - pxHoehe(k, 0, hoehe);
    const obenVorne = pxY(k, HOEHE) - pxHoehe(k, HOEHE, hoehe);

    c.fillStyle = FARBE.bandeVorne;
    c.beginPath();
    c.moveTo(pxX(k, s.x, 0), obenHinten);
    c.lineTo(pxX(k, s.x, HOEHE), obenVorne);
    c.lineTo(pxX(k, s.x, HOEHE), pxY(k, HOEHE));
    c.lineTo(pxX(k, s.x, 0), pxY(k, 0));
    c.closePath();
    c.fill();

    c.fillStyle = FARBE.bandeOben;
    c.beginPath();
    c.moveTo(pxX(k, s.x, 0), obenHinten);
    c.lineTo(pxX(k, aussen, 0), obenHinten);
    c.lineTo(pxX(k, aussen, HOEHE), obenVorne);
    c.lineTo(pxX(k, s.x, HOEHE), obenVorne);
    c.closePath();
    c.fill();
  }

  // Hintere und vordere Kante als Quader.
  const voll = BREITE + dicke * 2;
  quader(c, k, BREITE / 2, -dicke / 2, voll, dicke, hoehe, MATERIAL.bande);
  quader(c, k, BREITE / 2, HOEHE + dicke / 2, voll, dicke, hoehe, MATERIAL.bande);
}

/* ---------------------------- Vignette ----------------------------- */

/**
 * Abdunklung zu den Raendern. Zieht den Blick in die Mitte und nimmt
 * der Flaeche das Gleichmaessige. Einmal gebacken statt pro Bild - ein
 * Verlauf ueber die ganze Flaeche kostet auf dem iPad sonst spuerbar
 * Zeit.
 */
export function vignette(c: CanvasRenderingContext2D, k: Kamera): void {
  const w = k.breitePx;
  const h = k.hoehePx;
  const g = c.createRadialGradient(
    w / 2, h * 0.52, h * 0.3, w / 2, h * 0.52, h * 0.8,
  );
  g.addColorStop(0, 'rgba(0, 0, 0, 0)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0.34)');
  c.fillStyle = g;
  c.fillRect(-w, -h, w * 3, h * 3);
}
