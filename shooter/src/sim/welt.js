/* ------------------------------------------------------------------
   Kollisionswelt: achsenparallele Quader.

   Die ganze Karte besteht fuer die Simulation aus Quadern - Boden,
   Mauern, Container, Kisten, Stufen. Das reicht fuer eine Trainings-
   anlage und macht Kollision und Strahltest schnell und verlaesslich:
   keine Dreiecke, keine Sonderfaelle an schraegen Flaechen.

   Gespeichert in einem Float64Array (minX, minY, minZ, maxX, maxY, maxZ
   je Quader). Bei rund 200 Quadern ist der schlichte Durchlauf schneller
   als jede Baumstruktur - gemessen in tools/shooter-tests.mjs.
   ------------------------------------------------------------------ */

export class Welt {
  /* quader: Liste von { min: [x,y,z], max: [x,y,z] } */
  constructor(quader) {
    this.n = quader.length;
    this.b = new Float64Array(this.n * 6);
    for (let i = 0; i < this.n; i++) {
      const q = quader[i];
      const o = i * 6;
      this.b[o] = Math.min(q.min[0], q.max[0]);
      this.b[o + 1] = Math.min(q.min[1], q.max[1]);
      this.b[o + 2] = Math.min(q.min[2], q.max[2]);
      this.b[o + 3] = Math.max(q.min[0], q.max[0]);
      this.b[o + 4] = Math.max(q.min[1], q.max[1]);
      this.b[o + 5] = Math.max(q.min[2], q.max[2]);
    }
    // Ergebnis des letzten Strahltests
    this.nx = 0;
    this.ny = 0;
    this.nz = 0;
    this.quader = -1;
  }

  /* Ueberschneidet der Quader einen Weltquader? Beruehren zaehlt nicht:
     wer genau auf dem Boden steht oder flach an einer Wand lehnt,
     steckt nicht darin. Gibt den Index oder -1 zurueck. */
  ueberlappt(minX, minY, minZ, maxX, maxY, maxZ) {
    const b = this.b;
    for (let i = 0, o = 0; i < this.n; i++, o += 6) {
      if (minX < b[o + 3] && maxX > b[o] &&
          minY < b[o + 4] && maxY > b[o + 1] &&
          minZ < b[o + 5] && maxZ > b[o + 2]) return i;
    }
    return -1;
  }

  /* Strahl ab (ox,oy,oz) in normierter Richtung (dx,dy,dz), hoechstens
     maxT weit. Gibt die Entfernung zum ersten Treffer zurueck oder
     Infinity. Die Flaechennormale steht danach in nx/ny/nz.

     Beginnt der Strahl in einem Quader, gilt das als Treffer bei 0 -
     so schiesst nie jemand aus einer Wand heraus. */
  strahl(ox, oy, oz, dx, dy, dz, maxT) {
    const b = this.b;
    const ix = dx !== 0 ? 1 / dx : 1e30;
    const iy = dy !== 0 ? 1 / dy : 1e30;
    const iz = dz !== 0 ? 1 / dz : 1e30;
    let best = maxT;
    let bestI = -1;
    let achse = 0;
    for (let i = 0, o = 0; i < this.n; i++, o += 6) {
      let t1 = (b[o] - ox) * ix;
      let t2 = (b[o + 3] - ox) * ix;
      let tmin = t1 < t2 ? t1 : t2;
      let tmax = t1 < t2 ? t2 : t1;
      let a = 0;
      t1 = (b[o + 1] - oy) * iy;
      t2 = (b[o + 4] - oy) * iy;
      let lo = t1 < t2 ? t1 : t2;
      let hi = t1 < t2 ? t2 : t1;
      if (lo > tmin) { tmin = lo; a = 1; }
      if (hi < tmax) tmax = hi;
      if (tmax < tmin) continue;
      t1 = (b[o + 2] - oz) * iz;
      t2 = (b[o + 5] - oz) * iz;
      lo = t1 < t2 ? t1 : t2;
      hi = t1 < t2 ? t2 : t1;
      if (lo > tmin) { tmin = lo; a = 2; }
      if (hi < tmax) tmax = hi;
      if (tmax < tmin || tmax < 0) continue;
      const t = tmin < 0 ? 0 : tmin;
      if (t < best) {
        best = t;
        bestI = i;
        achse = tmin < 0 ? -1 : a;
      }
    }
    this.quader = bestI;
    this.nx = 0; this.ny = 0; this.nz = 0;
    if (bestI < 0) return Infinity;
    if (achse === 0) this.nx = dx > 0 ? -1 : 1;
    else if (achse === 1) this.ny = dy > 0 ? -1 : 1;
    else if (achse === 2) this.nz = dz > 0 ? -1 : 1;
    else { this.nx = -dx; this.ny = -dy; this.nz = -dz; }
    return best;
  }

  /* Freie Sicht zwischen zwei Punkten? */
  sichtFrei(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const l = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (l < 1e-6) return true;
    return this.strahl(ax, ay, az, dx / l, dy / l, dz / l, l) >= l;
  }
}

/* Strahl gegen einen einzelnen Quader (fuer Trefferzonen der Figuren).
   Gibt die Eintrittsentfernung zurueck oder Infinity. */
export function strahlQuader(ox, oy, oz, ix, iy, iz, minX, minY, minZ, maxX, maxY, maxZ) {
  let t1 = (minX - ox) * ix;
  let t2 = (maxX - ox) * ix;
  let tmin = t1 < t2 ? t1 : t2;
  let tmax = t1 < t2 ? t2 : t1;
  t1 = (minY - oy) * iy;
  t2 = (maxY - oy) * iy;
  let lo = t1 < t2 ? t1 : t2;
  let hi = t1 < t2 ? t2 : t1;
  if (lo > tmin) tmin = lo;
  if (hi < tmax) tmax = hi;
  if (tmax < tmin) return Infinity;
  t1 = (minZ - oz) * iz;
  t2 = (maxZ - oz) * iz;
  lo = t1 < t2 ? t1 : t2;
  hi = t1 < t2 ? t2 : t1;
  if (lo > tmin) tmin = lo;
  if (hi < tmax) tmax = hi;
  if (tmax < tmin || tmax < 0) return Infinity;
  return tmin < 0 ? 0 : tmin;
}
