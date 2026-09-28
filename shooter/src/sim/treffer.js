/* ------------------------------------------------------------------
   Trefferzonen der Figuren und Schadensberechnung.

   Jede Figur hat drei achsenparallele Zonen: Kopf, Rumpf, Beine. Sie
   wachsen mit der aktuellen Hoehe mit - wer geduckt ist, ist kleiner.
   Die Zonen sind etwas schmaler als die Kollisionsbox, damit ein Treffer
   auch nach Treffer aussieht.
   ------------------------------------------------------------------ */

import { FIGUR } from '../konfig.js';
import { klemme, mische } from './mathe.js';
import { strahlQuader } from './welt.js';

export const ZONE_KOPF = 1;
export const ZONE_RUMPF = 2;
export const ZONE_BEINE = 3;

const KOPF = 0.14;
const RUMPF = 0.25;
const BEINE = 0.2;

/* Strahl gegen die Zonen einer Figur. Gibt die Entfernung zurueck und
   schreibt die getroffene Zone nach aus.zone. ix/iy/iz sind die
   Kehrwerte der Richtung (schon vorbereitet, 1e30 statt Unendlich). */
export function strahlFigur(a, ox, oy, oz, ix, iy, iz, maxT, aus) {
  const s = a.hoehe / FIGUR.hoehe;
  const y0 = a.y;
  const kopfUnten = y0 + 1.52 * s;
  const kopfOben = y0 + a.hoehe;
  const rumpfUnten = y0 + 0.92 * s;
  let best = maxT;
  let zone = 0;
  let t = strahlQuader(ox, oy, oz, ix, iy, iz,
    a.x - KOPF, kopfUnten, a.z - KOPF, a.x + KOPF, kopfOben, a.z + KOPF);
  if (t < best) { best = t; zone = ZONE_KOPF; }
  t = strahlQuader(ox, oy, oz, ix, iy, iz,
    a.x - RUMPF, rumpfUnten, a.z - RUMPF, a.x + RUMPF, kopfUnten, a.z + RUMPF);
  if (t < best) { best = t; zone = ZONE_RUMPF; }
  t = strahlQuader(ox, oy, oz, ix, iy, iz,
    a.x - BEINE, y0, a.z - BEINE, a.x + BEINE, rumpfUnten, a.z + BEINE);
  if (t < best) { best = t; zone = ZONE_BEINE; }
  aus.zone = zone;
  return zone ? best : Infinity;
}

/* Schaden einer Kugel auf Entfernung d in einer Zone. */
export function schadenBerechnen(def, d, zone) {
  const r = def.reichweite;
  const t = klemme((d - r.voll) / Math.max(0.001, r.min - r.voll), 0, 1);
  let s = mische(def.schaden, def.schadenMin, t);
  if (zone === ZONE_KOPF) s *= def.kopf;
  else if (zone === ZONE_BEINE) s *= def.bein;
  return s;
}
