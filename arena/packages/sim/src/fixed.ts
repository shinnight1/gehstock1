/* ------------------------------------------------------------------
   Festkomma-Mathematik der Simulation.

   Warum ueberhaupt Festkomma? Die Sim muss im Browser (Safari /
   JavaScriptCore) und in Node (V8) Bit fuer Bit dasselbe rechnen -
   sonst laufen zwei Clients auseinander. Fliesskomma-Addition und
   -Multiplikation sind nach IEEE-754 exakt vorgeschrieben und damit
   unkritisch. Nicht vorgeschrieben sind die transzendenten Funktionen:
   Math.sin, Math.cos, Math.atan2, Math.pow und Math.exp duerfen sich
   zwischen Engines um das letzte Bit unterscheiden. Ein einziges
   solches Bit reicht, um nach 3600 Ticks ein anderes Spiel zu haben.

   Regel fuer /packages/sim: keine Trigonometrie, kein pow, kein exp.
   Alle Positionen, Geschwindigkeiten und Radien sind ganze Zahlen in
   Millitiles. Winkel gibt es nur im Renderer.
   ------------------------------------------------------------------ */

/** Ein Tile in Millitiles. Aufloesung der gesamten Sim. */
export const MT = 1000;

/** Tiles (auch gebrochen) in Millitiles. Nur beim Einlesen von Daten. */
export function tile(n: number): number {
  return Math.round(n * MT);
}

/** Millitiles zurueck in Tiles - ausschliesslich fuer den Renderer. */
export function inTiles(mt: number): number {
  return mt / MT;
}

export function clamp(wert: number, min: number, max: number): number {
  return wert < min ? min : wert > max ? max : wert;
}

export function sign(n: number): -1 | 0 | 1 {
  return n < 0 ? -1 : n > 0 ? 1 : 0;
}

/**
 * Ganzzahlige Quadratwurzel, exakt: das groesste x mit x*x <= n.
 *
 * Math.sqrt dient nur als Startwert. Selbst wenn eine Engine dort um
 * ein Bit danebenliegt, holen die beiden Korrekturschleifen das
 * Ergebnis auf denselben exakten Wert zurueck - identisch in jeder
 * Engine. Gueltig fuer n < 2^52, weit ueber allem, was hier vorkommt.
 */
export function isqrt(n: number): number {
  if (n <= 0) return 0;
  let x = Math.floor(Math.sqrt(n));
  while (x > 0 && x * x > n) x--;
  while ((x + 1) * (x + 1) <= n) x++;
  return x;
}

/** Quadrat der Distanz. Fuer Vergleiche - spart die Wurzel. */
export function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

/** Distanz in Millitiles, exakt gerundet nach unten. */
export function dist(ax: number, ay: number, bx: number, by: number): number {
  return isqrt(dist2(ax, ay, bx, by));
}

/**
 * Richtung (dx,dy) auf die Laenge `schritt` bringen.
 *
 * Ergebnis wird in `raus` geschrieben statt zurueckgegeben: die
 * Bewegungsschleife laeuft ueber alle Einheiten pro Tick, hier darf
 * nichts alloziert werden.
 */
export interface Vek2 { x: number; y: number }

export function schrittRichtung(dx: number, dy: number, schritt: number, raus: Vek2): void {
  const laenge = isqrt(dx * dx + dy * dy);
  if (laenge === 0) { raus.x = 0; raus.y = 0; return; }
  // Erst multiplizieren, dann teilen - sonst frisst die Ganzzahldivision
  // die Richtung bei kleinen Schritten auf.
  raus.x = Math.trunc((dx * schritt) / laenge);
  raus.y = Math.trunc((dy * schritt) / laenge);
}

/** Lineare Interpolation auf Ganzzahlen, `t` als Promille (0..1000). */
export function lerpMille(a: number, b: number, t: number): number {
  return a + Math.trunc(((b - a) * t) / 1000);
}

/**
 * Prozentwert anwenden, kaufmaennisch gerundet.
 * Fuer Kartenlevel: +7 % HP je Stufe, ohne Fliesskomma-Drift.
 */
export function skaliere(basis: number, promille: number): number {
  return Math.round((basis * promille) / 1000);
}
