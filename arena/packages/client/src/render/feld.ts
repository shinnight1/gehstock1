/* ------------------------------------------------------------------
   Der unbewegliche Untergrund, in zwei Ebenen.

     unten  Rasen, Maehmuster, Ufer, Flussbett
     oben   Bruecken, Bande, Vignette

   Dazwischen laeuft pro Bild das animierte Wasser. Beide Ebenen
   werden einmal gezeichnet und danach nur noch kopiert - der
   Untergrund kostet damit zwei drawImage statt einiger hundert
   Pfade. Neu gebaut wird nur bei geaenderter Groesse oder Pixeldichte.
   ------------------------------------------------------------------ */

import {
  BREITE, HOEHE, HOEHE_TILES, FLUSS_OBEN, FLUSS_UNTEN, BRUECKEN, tile,
} from '@arena/sim';
import { FARBE } from './palette.js';
import { kameraLokal, pxX, pxY, skalaBei } from './kamera.js';
import type { Kamera } from './kamera.js';
import { bodenPfad } from './perspektive.js';
import { streuAusSeed } from './textur.js';
import { brueckeZeichnen, bandeZeichnen, vignette } from './bauten.js';

export interface Feldbild {
  unten: HTMLCanvasElement;
  oben: HTMLCanvasElement;
  breite: number;
  hoehe: number;
  dichte: number;
  gespiegelt: boolean;
}

/* Die obere Ebene ragt ueber das Feld hinaus - Bande und Bruecken
   haben Hoehe. Der Rand gibt ihnen Platz. */
const UEBERSTAND = 0.12;

export function feldPasst(
  bild: Feldbild | null, k: Kamera, dichte: number,
): bild is Feldbild {
  return !!bild
    && bild.breite === k.breitePx
    && bild.hoehe === k.hoehePx
    && bild.dichte === dichte
    && bild.gespiegelt === k.gespiegelt;
}

/** Wo die obere Ebene aufgelegt wird - sie ist groesser als das Feld. */
export function obenVersatz(k: Kamera): number {
  return Math.round(k.hoehePx * UEBERSTAND);
}

function ebeneAnlegen(k: Kamera, dichte: number, rand: number) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round((k.breitePx + rand * 2) * dichte));
  canvas.height = Math.max(1, Math.round((k.hoehePx + rand * 2) * dichte));
  const c = canvas.getContext('2d');
  if (!c) throw new Error('Canvas 2D nicht verfuegbar');
  c.setTransform(dichte, 0, 0, dichte, 0, 0);
  c.translate(rand, rand);
  return { canvas, c };
}

export function feldBauen(k: Kamera, dichte: number): Feldbild {
  const lokal = kameraLokal(k);
  const rand = obenVersatz(k);

  const u = ebeneAnlegen(k, dichte, 0);
  rasenZeichnen(u.c, lokal);
  maehmuster(u.c, lokal);
  rasenFlecken(u.c, lokal);
  laufwege(u.c, lokal);
  grasHalme(u.c, lokal);
  uferZeichnen(u.c, lokal);
  flussbett(u.c, lokal);

  const o = ebeneAnlegen(k, dichte, rand);
  for (const b of BRUECKEN) brueckeZeichnen(o.c, lokal, b.x);
  bandeZeichnen(o.c, lokal);
  vignette(o.c, lokal);

  return {
    unten: u.canvas, oben: o.canvas,
    breite: k.breitePx, hoehe: k.hoehePx, dichte, gespiegelt: k.gespiegelt,
  };
}

/* ------------------------------ Rasen ------------------------------ */

function rasenZeichnen(c: CanvasRenderingContext2D, k: Kamera): void {
  c.fillStyle = FARBE.rasen;
  bodenPfad(c, k, 0, 0, BREITE, HOEHE);
  c.fill();

  /* Die hintere Haelfte einen Hauch dunkler. Das ist kein Muster,
     sondern Distanz: was weiter weg liegt, bekommt weniger Licht -
     und man sieht ohne Nachdenken, wo die eigene Seite aufhoert. */
  c.fillStyle = FARBE.rasenOben;
  c.globalAlpha = 0.34;
  bodenPfad(c, k, 0, 0, BREITE, FLUSS_OBEN);
  c.fill();
  c.globalAlpha = 1;
}

/** Maehstreifen quer zur Spielrichtung, je zwei Tiles breit. */
function maehmuster(c: CanvasRenderingContext2D, k: Kamera): void {
  for (let t = 0; t < HOEHE_TILES; t += 2) {
    c.fillStyle = (t / 2) % 2 === 0 ? FARBE.rasenHell : FARBE.rasenDunkel;
    c.globalAlpha = 0.4;
    bodenPfad(c, k, 0, tile(t), BREITE, tile(Math.min(t + 2, HOEHE_TILES)));
    c.fill();
  }
  c.globalAlpha = 1;
}

/**
 * Grosse, weiche Farbflecken ueber dem Maehmuster.
 *
 * Streifen allein sind ein Muster, und ein Muster liest sich als
 * Tapete. Erst die unregelmaessigen Flecken darueber machen daraus
 * einen gewachsenen Rasen - hier heller, dort ausgetreten. Sie sind
 * gebacken, kosten also im laufenden Spiel nichts.
 */
function rasenFlecken(c: CanvasRenderingContext2D, k: Kamera): void {
  const streu = streuAusSeed(0xf1ec);
  for (let i = 0; i < 44; i++) {
    const y = streu.bereich(0, HOEHE);
    const x = streu.bereich(0, BREITE);
    const radius = skalaBei(k, y) * tile(streu.bereich(0.7, 2.1));
    const px = pxX(k, x, y);
    const py = pxY(k, y);
    const hell = streu.zahl() > 0.5;
    const g = c.createRadialGradient(px, py, 0, px, py, radius);
    g.addColorStop(0, hell ? 'rgba(96, 146, 88, 0.22)' : 'rgba(30, 62, 42, 0.2)');
    g.addColorStop(1, hell ? 'rgba(96, 146, 88, 0)' : 'rgba(30, 62, 42, 0)');
    c.fillStyle = g;
    c.beginPath();
    // Flach wie alles, was auf dem Boden liegt.
    c.ellipse(px, py, radius, radius * 0.6, 0, 0, Math.PI * 2);
    c.fill();
  }
}

/**
 * Ausgetretene Bahnen entlang der beiden Lanes.
 *
 * Zwei Aufgaben auf einmal: das Feld bekommt eine Geschichte - hier
 * ist offenbar schon oft gelaufen worden -, und die Wege zeigen ohne
 * ein einziges UI-Element, wohin Bodeneinheiten marschieren. Wer die
 * Arena zum ersten Mal sieht, weiss sofort, dass es zwei Bahnen und
 * zwei Bruecken gibt.
 */
function laufwege(c: CanvasRenderingContext2D, k: Kamera): void {
  const streu = streuAusSeed(0x1a4e);
  for (const b of BRUECKEN) {
    /* Kein Polygon, sondern viele weiche Flecken entlang der Bahn.
       Ein Polygon haette eine saubere Kante, und eine saubere Kante
       liest sich als aufgemalter Streifen statt als Weg, den jemand
       ausgetreten hat. */
    const tupfen = 70;
    for (let i = 0; i < tupfen; i++) {
      const y = (HOEHE * i) / (tupfen - 1);
      const x = b.x + tile(streu.bereich(-0.32, 0.32));
      const radius = skalaBei(k, y) * tile(streu.bereich(0.5, 0.95));
      const px = pxX(k, x, y);
      const py = pxY(k, y);
      const g = c.createRadialGradient(px, py, 0, px, py, radius);
      g.addColorStop(0, 'rgba(136, 114, 74, 0.19)');
      g.addColorStop(0.6, 'rgba(136, 114, 74, 0.1)');
      g.addColorStop(1, 'rgba(132, 112, 74, 0)');
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(px, py, radius, radius * 0.62, 0, 0, Math.PI * 2);
      c.fill();
    }
  }
}

/**
 * Grasnarbe aus einzelnen Halmen.
 *
 * Ohne sie bleibt der Rasen eine Flaeche aus zwei Farben und wirkt
 * wie Karton. Die Halme wachsen mit der Tiefe mit, sonst saehe das
 * Muster hinten grob und vorne fein aus - genau umgekehrt zur
 * Perspektive.
 */
function grasHalme(c: CanvasRenderingContext2D, k: Kamera): void {
  const streu = streuAusSeed(0x5eed);
  for (let i = 0; i < 1400; i++) {
    const y = streu.bereich(0, HOEHE);
    const x = streu.bereich(0, BREITE);
    const laenge = skalaBei(k, y) * tile(streu.bereich(0.06, 0.14));
    const px = pxX(k, x, y);
    const py = pxY(k, y);
    c.fillStyle = streu.zahl() > 0.45 ? FARBE.rasenTupfen : FARBE.rasenSchatten;
    c.fillRect(px, py - laenge, Math.max(1, laenge * 0.45), Math.max(1, laenge));
  }
}

/* ------------------------- Ufer und Fluss -------------------------- */

/** Erdstreifen an beiden Ufern, mit unruhiger Kante zum Rasen. */
function uferZeichnen(c: CanvasRenderingContext2D, k: Kamera): void {
  const streu = streuAusSeed(0x11fe);
  const kanten = [
    { kante: FLUSS_OBEN, richtung: -1 },
    { kante: FLUSS_UNTEN, richtung: 1 },
  ];
  for (const eintrag of kanten) {
    const kante = eintrag.kante;
    const tiefe = tile(0.55) * eintrag.richtung;
    c.fillStyle = FARBE.erde;
    c.beginPath();
    const schritte = 26;
    for (let i = 0; i <= schritte; i++) {
      const x = (BREITE * i) / schritte;
      const y = kante + tiefe * streu.bereich(0.45, 1);
      const px = pxX(k, x, y);
      const py = pxY(k, y);
      if (i === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    for (let i = schritte; i >= 0; i--) {
      const x = (BREITE * i) / schritte;
      c.lineTo(pxX(k, x, kante), pxY(k, kante));
    }
    c.closePath();
    c.fill();

    // Heller Sandsaum direkt an der Wasserlinie.
    c.fillStyle = FARBE.sand;
    c.globalAlpha = 0.45;
    bodenPfad(c, k, 0, kante, BREITE, kante - tile(0.14) * eintrag.richtung);
    c.fill();
    c.globalAlpha = 1;
  }
}

/** Dunkles Flussbett. Das bewegte Wasser kommt pro Bild darueber. */
function flussbett(c: CanvasRenderingContext2D, k: Kamera): void {
  c.fillStyle = FARBE.wasserTief;
  bodenPfad(c, k, 0, FLUSS_OBEN, BREITE, FLUSS_UNTEN);
  c.fill();
}
