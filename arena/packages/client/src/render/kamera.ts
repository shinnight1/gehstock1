/* ------------------------------------------------------------------
   Perspektivische Kamera.

   Die Simulation rechnet flach: 18 x 32 Tiles, y = 0 hinten. Der
   Bildschirm zeigt das Feld dagegen als Trapez - hinten schmaler,
   die Reihen nach hinten enger. Genau das nimmt der Karton-Optik
   ihre Flachheit, und es passiert ausschliesslich hier. Die Sim
   erfaehrt davon nie etwas.

   Modell ist eine Lochkamera ueber einer Bodenebene:

     z(y)   Tiefe eines Bodenpunkts, vorne ZNAH, hinten ZNAH + HOEHE
     s(y)   Massstab an dieser Stelle, ZNAH / z(y)
     Bild-y proportional zu 1 / z(y)

   Daraus folgt ein angenehmer Nebeneffekt: die Hoehe eines aufrechten
   Objekts skaliert mit demselben s(y) wie seine Breite. Ein Turm
   zwei Tiles vor dem Bildrand ist also automatisch groesser als
   derselbe Turm am anderen Ende - ohne Sonderfall im Zeichencode.

   `gespiegelt` dreht das Feld vor der Projektion um 180 Grad. So
   sitzt die eigene Seite immer vorne, auch wenn man online als
   Spieler 1 spielt.
   ------------------------------------------------------------------ */

import { BREITE, HOEHE } from '@arena/sim';

/* Massstab an der Hinterkante, gemessen an der Vorderkante.
   0.78 ist der Kompromiss: darunter kippt die Ansicht ins
   Schraegbild und die hinteren Tuerme werden zu klein zum Zielen,
   darueber sieht das Feld wieder flach aus. */
const SKALA_HINTEN = 0.78;

/* Wie stark die Tiefe gestaucht wird.

   Nicht frei gewaehlt, sondern aus SKALA_HINTEN abgeleitet: setzt man
   die Kamerahoehe gleich der Tiefe der Vorderkante, sind die Tiles an
   der Vorderkante exakt quadratisch und werden nach hinten gleichmaessig
   flacher - bis auf SKALA_HINTEN. Genau so liest sich Perspektive
   richtig. Ein frei gewaehlter Wert wuerde die vorderen Reihen
   entweder hochkant ziehen oder plattdruecken. */
const STAUCHUNG = SKALA_HINTEN;

/* Anteil der Flaeche, den die Arena einnimmt. Nicht hoeher: der
   hintere Koenig steht nur vier Tiles vom Rand entfernt und ragt mit
   Figur und Lebensbalken deutlich ueber seine Standflaeche hinaus. */
const HOEHEN_ANTEIL = 0.9;
const BREITEN_ANTEIL = 0.97;

/* Tiefe der Vorderkante, hergeleitet aus SKALA_HINTEN:
   SKALA_HINTEN = ZNAH / (ZNAH + HOEHE). */
const ZNAH = (SKALA_HINTEN * HOEHE) / (1 - SKALA_HINTEN);
const ZFERN = ZNAH + HOEHE;
const V_VORNE = 1 / ZNAH;
const V_HINTEN = 1 / ZFERN;
const V_SPANNE = V_VORNE - V_HINTEN;

export interface Kamera {
  /** Umgebendes Rechteck der Arena in CSS-Pixeln. */
  x0: number;
  y0: number;
  /** Breite an der Vorderkante - zugleich die Breite des Rechtecks. */
  breitePx: number;
  hoehePx: number;
  /** CSS-Pixel pro Millitile an der Vorderkante. */
  kx: number;
  gespiegelt: boolean;
  /** Freie Flaeche links und rechts - Platz fuer das HUD. */
  randLinks: number;
  randRechts: number;
}

export function kameraAnlegen(gespiegelt = false): Kamera {
  return {
    x0: 0, y0: 0, breitePx: 0, hoehePx: 0, kx: 1,
    gespiegelt, randLinks: 0, randRechts: 0,
  };
}

export function kameraNeuBerechnen(k: Kamera, breite: number, hoehe: number): void {
  /* Die Arena muss in beide Richtungen passen. Die Hoehe ist wegen
     der Stauchung nicht mehr kx * HOEHE, sondern kx * HOEHE * STAUCHUNG. */
  const kxAusHoehe = (hoehe * HOEHEN_ANTEIL) / (HOEHE * STAUCHUNG);
  const kxAusBreite = (breite * BREITEN_ANTEIL) / BREITE;
  const kx = Math.min(kxAusHoehe, kxAusBreite);

  k.kx = kx;
  k.breitePx = Math.round(BREITE * kx);
  k.hoehePx = Math.round(HOEHE * kx * STAUCHUNG);
  k.x0 = Math.round((breite - k.breitePx) / 2);
  k.y0 = Math.round((hoehe - k.hoehePx) / 2);
  k.randLinks = k.x0;
  k.randRechts = breite - (k.x0 + k.breitePx);
}

/** Sim-y nach Ansicht-y - hier und nur hier wird gespiegelt. */
function ansichtY(k: Kamera, mtY: number): number {
  return k.gespiegelt ? HOEHE - mtY : mtY;
}

function ansichtX(k: Kamera, mtX: number): number {
  return k.gespiegelt ? BREITE - mtX : mtX;
}

/**
 * Massstab an einer Tiefe. Gilt fuer Breite UND Hoehe eines
 * aufrechten Objekts - siehe Herleitung im Kopf der Datei.
 */
export function skalaBei(k: Kamera, mtY: number): number {
  const z = ZNAH + (HOEHE - ansichtY(k, mtY));
  return (k.kx * ZNAH) / z;
}

export function pxY(k: Kamera, mtY: number): number {
  const z = ZNAH + (HOEHE - ansichtY(k, mtY));
  return k.y0 + (k.hoehePx * (1 / z - V_HINTEN)) / V_SPANNE;
}

export function pxX(k: Kamera, mtX: number, mtY: number): number {
  const mitte = k.x0 + k.breitePx / 2;
  return mitte + (ansichtX(k, mtX) - BREITE / 2) * skalaBei(k, mtY);
}

/**
 * Stauchung der Bodenebene an dieser Tiefe: 1 an der Vorderkante,
 * SKALA_HINTEN ganz hinten. Ein Kreis auf dem Boden wird damit zur
 * Ellipse mit ry = rx * bodenStauchung.
 */
export function bodenStauchung(k: Kamera, mtY: number): number {
  return skalaBei(k, mtY) / k.kx;
}

/**
 * Hoehe eines aufrechten Objekts in Pixeln. `mtHoehe` ist die
 * Bauhoehe in Millitiles, gemessen am Fusspunkt (mtX, mtY).
 */
export function pxHoehe(k: Kamera, mtY: number, mtHoehe: number): number {
  return skalaBei(k, mtY) * mtHoehe;
}

/** Laenge in der Bodenebene, etwa ein Radius. */
export function pxLaenge(k: Kamera, mtY: number, mt: number): number {
  return skalaBei(k, mtY) * mt;
}

/* --------------------------- Umkehrung ---------------------------- */

/** Bildschirm-y zurueck in Sim-y. Erste Haelfte der Touch-Umrechnung. */
export function mtY(k: Kamera, py: number): number {
  const anteil = (py - k.y0) / k.hoehePx;
  const v = V_HINTEN + anteil * V_SPANNE;
  // Ausserhalb des Feldes kann v null oder negativ werden.
  if (v <= 0) return k.gespiegelt ? HOEHE : 0;
  const y = HOEHE - (1 / v - ZNAH);
  return Math.round(k.gespiegelt ? HOEHE - y : y);
}

/** Bildschirm-x zurueck in Sim-x. Braucht das bereits ermittelte mtY. */
export function mtX(k: Kamera, px: number, simY: number): number {
  const mitte = k.x0 + k.breitePx / 2;
  const s = skalaBei(k, simY);
  if (s <= 0) return 0;
  const x = (px - mitte) / s + BREITE / 2;
  return Math.round(k.gespiegelt ? BREITE - x : x);
}

/** Liegt der Bildschirmpunkt auf dem Spielfeld? Prueft das Trapez, nicht den Kasten. */
export function trifftArena(k: Kamera, px: number, py: number): boolean {
  if (py < k.y0 || py > k.y0 + k.hoehePx) return false;
  const y = mtY(k, py);
  const halb = (BREITE / 2) * skalaBei(k, y);
  const mitte = k.x0 + k.breitePx / 2;
  return px >= mitte - halb && px <= mitte + halb;
}

/**
 * Kopie mit Nullursprung.
 *
 * Der Untergrund wird einmal in ein eigenes Canvas gezeichnet und
 * danach nur noch kopiert. Damit dieser Zeichencode nichts von der
 * Lage der Arena auf dem Bildschirm wissen muss, bekommt er diese
 * verschobene Kamera - dieselbe Projektion, Ursprung oben links.
 */
export function kameraLokal(k: Kamera): Kamera {
  return { ...k, x0: 0, y0: 0 };
}
