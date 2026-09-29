/* ------------------------------------------------------------------
   Kleine Rechenhilfen fuer die Simulation.

   Bewusst ohne three.js: die Simulation soll genauso im Browser wie in
   Node laufen - fuer die Tests und spaeter fuer einen Server, der das
   Match verbindlich rechnet.

   Blickrichtung: yaw 0 schaut nach -Z (Norden), positiver yaw dreht nach
   links (gegen den Uhrzeigersinn von oben), positiver pitch schaut nach
   oben. Das entspricht der Kamera von three.js mit Reihenfolge 'YXZ'.
   ------------------------------------------------------------------ */

export const GRAD = Math.PI / 180;

export function klemme(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

export function mische(a, b, t) {
  return a + (b - a) * t;
}

/* Naehert v um hoechstens schritt an ziel an. */
export function naehere(v, ziel, schritt) {
  if (v < ziel) return Math.min(ziel, v + schritt);
  if (v > ziel) return Math.max(ziel, v - schritt);
  return v;
}

/* Kuerzester Winkelunterschied von a nach b, Ergebnis in (-PI, PI]. */
export function winkelDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  else if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

export function winkelNorm(a) {
  return winkelDiff(0, a);
}

/* Blickrichtung aus yaw/pitch in ein Ziel-Objekt {x,y,z} schreiben. */
export function richtung(yaw, pitch, aus) {
  const cp = Math.cos(pitch);
  aus.x = -Math.sin(yaw) * cp;
  aus.y = Math.sin(pitch);
  aus.z = -Math.cos(yaw) * cp;
  return aus;
}

/* yaw, unter dem man von (ax,az) nach (bx,bz) schaut. */
export function yawZu(dx, dz) {
  return Math.atan2(-dx, -dz);
}

/* Reproduzierbarer Zufall (mulberry32). Gleicher Startwert, gleiches
   Match - wichtig fuer Tests und fuer eine spaetere Serverfassung. */
export function zufallsquelle(start) {
  let s = start >>> 0;
  const f = function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.zwischen = (a, b) => a + (b - a) * f();
  f.ganz = (n) => Math.floor(f() * n);
  f.vorzeichen = () => (f() < 0.5 ? -1 : 1);
  f.setzen = (n) => { s = n >>> 0; };
  return f;
}

/* Startwert aus mehreren ganzen Zahlen - fuer Zufall, der auf zwei
   Rechnern gleich ausfallen muss (Schuss n einer Figur: Geraet und
   Server streuen ihn gleich). */
export function startwert(a, b, c) {
  let h = Math.imul((a | 0) ^ 0x9E3779B9, 0x85EBCA6B);
  h = Math.imul(h ^ (h >>> 13) ^ (b | 0), 0xC2B2AE35);
  h = Math.imul(h ^ (h >>> 16) ^ Math.imul(c | 0, 0x27D4EB2F), 0x165667B1);
  return (h ^ (h >>> 15)) >>> 0;
}

/* Richtung innerhalb eines Kegels streuen.

   (yaw, pitch) ist die Mitte, winkel der Abstand zur Mitte in Bogenmass,
   phi die Drehung um die Mitte. Die Basis ist exakt: rechts = Ableitung
   nach yaw (normiert), oben = Ableitung nach pitch. */
export function kegelRichtung(yaw, pitch, winkel, phi, aus) {
  const sy = Math.sin(yaw), cy = Math.cos(yaw);
  const sp = Math.sin(pitch), cp = Math.cos(pitch);
  // vorne, rechts, oben
  const fx = -sy * cp, fy = sp, fz = -cy * cp;
  const rx = cy, rz = -sy;
  const ux = sy * sp, uy = cp, uz = cy * sp;
  const sw = Math.sin(winkel), cw = Math.cos(winkel);
  const a = Math.cos(phi) * sw, b = Math.sin(phi) * sw;
  aus.x = fx * cw + rx * a + ux * b;
  aus.y = fy * cw + uy * b;
  aus.z = fz * cw + rz * a + uz * b;
  return aus;
}
