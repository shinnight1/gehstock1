/* ------------------------------------------------------------------
   Dezente Zielhilfe fuer Touch.

   Mit dem Finger zielt man grober als mit der Maus. Die Hilfe greift
   darum nur bei Touch und nur, wenn eingeschaltet:
     - Reibung: liegt das Fadenkreuz auf oder dicht neben einem
       sichtbaren Gegner, dreht der Blick langsamer - man rutscht nicht
       so leicht darueber hinweg.
     - leichter Zug: beim Laufen, Schiessen oder frisch ins Visier
       genommen wird der Blick sanft (wenige Grad pro Sekunde) zum Ziel
       gezogen - nie ein Einrasten, nie durch Waende.
   ------------------------------------------------------------------ */

import { augenhoehe } from '../sim/bewegung.js';
import { GRAD, klemme, winkelDiff, yawZu } from '../sim/mathe.js';

export class Zielhilfe {
  constructor() {
    this.visierVorher = false;
    this.impuls = 0;
    this.ziel = -1;
  }

  aktualisieren(sim, eingabe, dt, an) {
    eingabe.reibung = 1;
    this.ziel = -1;
    const s = sim && sim.spieler;
    const zielt = eingabe.zielt();
    if (zielt && !this.visierVorher) this.impuls = 1;
    this.visierVorher = zielt;
    this.impuls = Math.max(0, this.impuls - dt / 0.25);
    if (!an || !s || !s.lebt || sim.phase !== 'laeuft' || eingabe.modus !== 'touch') return;

    const auge = s.y + augenhoehe(s);
    let best = null, bestW = Infinity, bestYaw = 0, bestPitch = 0, bestR = 0;
    for (const e of sim.akteure) {
      if (!e.lebt || e.team === s.team) continue;
      const dx = e.x - s.x, dz = e.z - s.z;
      const d = Math.hypot(dx, dz);
      if (d > 45 || d < 0.5) continue;
      const zy = e.y + e.hoehe * 0.62;
      const wYaw = yawZu(dx, dz);
      const wPitch = Math.atan2(zy - auge, d);
      const dy = winkelDiff(eingabe.yaw, wYaw);
      const dp = wPitch - eingabe.pitch;
      const w = Math.hypot(dy, dp);
      const r = Math.atan2(0.35, d);
      if (w > r + 6 * GRAD || w >= bestW) continue;
      if (!sim.welt.sichtFrei(s.x, auge, s.z, e.x, zy, e.z)) continue;
      best = e;
      bestW = w;
      bestYaw = dy;
      bestPitch = dp;
      bestR = r;
    }
    if (!best) return;
    this.ziel = best.id;

    const nah = bestR + 1.5 * GRAD;
    eingabe.reibung = bestW <= nah ? 0.55 : 0.55 + 0.45 * klemme((bestW - nah) / (4.5 * GRAD), 0, 1);

    const bewegt = Math.abs(eingabe.stickX) + Math.abs(eingabe.stickY) > 0.2;
    const feuert = eingabe.feuerFinger > 0;
    if ((bewegt || feuert || this.impuls > 0) && bestW > bestR * 0.3) {
      const rate = (3 + this.impuls * 22) * GRAD * dt;
      const zug = Math.min(bestW, rate) / bestW;
      eingabe.yaw += bestYaw * zug;
      eingabe.pitch += bestPitch * zug;
    }
  }
}
