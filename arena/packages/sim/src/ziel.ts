/* ------------------------------------------------------------------
   Zielauswahl.

   Zwei Regeln entscheiden alles:

   1. Wer "nur_gebaeude" angreift, sieht Einheiten nicht. Er laeuft
      immer zum naechsten Turm oder Gebaeude, egal was ihm im Weg
      steht. Das macht Tanks berechenbar und gibt Schwaermen ihre
      Daseinsberechtigung.

   2. Alle anderen greifen an, was in den Aggro-Radius kommt, und
      behalten ihr Ziel, solange es im Verfolgungsradius bleibt. Ohne
      dieses Festhalten wuerde eine Einheit zwischen zwei gleich weit
      entfernten Gegnern hin und her springen und nie zuschlagen.

   Bei gleichem Abstand gewinnt der niedrigere Feldindex. Das ist
   keine Feinheit, sondern Pflicht: zwei Geraete muessen dieselbe
   Entscheidung treffen.
   ------------------------------------------------------------------ */

import { dist2, isqrt } from './fixed.js';
import type { Zielt, Ebene, Spieler } from './types.js';
import { gegner } from './types.js';
import type { MatchState, Einheit, Turm } from './state.js';
import { KAMPF } from './data/balance.js';

/** Darf `zieltAuf` ein Ziel auf dieser Ebene treffen? */
export function kannTreffen(zieltAuf: Zielt, ziel: Ebene, istBau: boolean): boolean {
  if (zieltAuf === 'nur_gebaeude') return istBau;
  if (zieltAuf === 'beides') return true;
  if (zieltAuf === 'luft') return ziel === 'luft';
  // 'boden' trifft alles am Boden, Bauwerke eingeschlossen.
  return ziel === 'boden';
}

/** Quadrat des Abstands von Rand zu Rand, nie kleiner als null. */
function randAbstand2(
  ax: number, ay: number, ar: number,
  bx: number, by: number, br: number,
): number {
  const d2 = dist2(ax, ay, bx, by);
  const summe = ar + br;
  if (d2 <= summe * summe) return 0;
  /* isqrt statt Math.sqrt: die exakte Ganzzahlwurzel liefert auf
     jeder Engine dasselbe Bit. Math.sqrt darf hier nicht stehen,
     auch wenn es schneller waere. */
  const rand = isqrt(d2) - summe;
  return rand * rand;
}

/** Steht das gemerkte Ziel noch? */
export function zielLebt(s: MatchState, e: Einheit): boolean {
  if (e.zielArt === 'keins' || e.zielIndex < 0) return false;
  if (e.zielArt === 'turm') {
    const t = s.tuerme[e.zielIndex];
    return !!t && t.hp > 0;
  }
  const z = s.einheiten[e.zielIndex];
  return !!z && z.aktiv && z.id === e.zielId && z.hp > 0;
}

/** Position und Radius des gemerkten Ziels. Nur nach zielLebt() rufen. */
export function zielPunkt(s: MatchState, e: Einheit): {
  x: number; y: number; radius: number;
} {
  if (e.zielArt === 'turm') {
    const t = s.tuerme[e.zielIndex]!;
    return { x: t.x, y: t.y, radius: t.radius };
  }
  const z = s.einheiten[e.zielIndex]!;
  return { x: z.x, y: z.y, radius: z.radius };
}

/**
 * Naechsten gegnerischen Turm suchen, den `zieltAuf` treffen darf.
 * Tuerme zaehlen immer als Bauwerk am Boden.
 */
function naechsterTurm(
  s: MatchState, x: number, y: number, spieler: Spieler, zieltAuf: Zielt,
): number {
  const feind = gegner(spieler);
  let besterIndex = -1;
  let besteDistanz = Infinity;
  for (let i = 0; i < s.tuerme.length; i++) {
    const t = s.tuerme[i]!;
    if (t.spieler !== feind || t.hp <= 0) continue;
    if (!kannTreffen(zieltAuf, 'boden', true)) continue;
    const d = dist2(x, y, t.x, t.y);
    if (d < besteDistanz) { besteDistanz = d; besterIndex = i; }
  }
  return besterIndex;
}

/**
 * Naechste gegnerische Einheit innerhalb `reichweite2` (quadriert).
 * Gebaeude zaehlen mit - sie sollen Angreifer auf sich ziehen.
 */
function naechsteEinheit(
  s: MatchState, x: number, y: number, spieler: Spieler,
  zieltAuf: Zielt, reichweite2: number,
): number {
  const feind = gegner(spieler);
  let besterIndex = -1;
  let besteDistanz = reichweite2;
  for (let i = 0; i < s.einheiten.length; i++) {
    const z = s.einheiten[i]!;
    if (!z.aktiv || z.spieler !== feind || z.hp <= 0) continue;
    if (!kannTreffen(zieltAuf, z.ebene, z.istGebaeude)) continue;
    const d = randAbstand2(x, y, 0, z.x, z.y, z.radius);
    // Strikt kleiner: bei Gleichstand behaelt der niedrigere Index.
    if (d < besteDistanz) { besteDistanz = d; besterIndex = i; }
  }
  return besterIndex;
}

/**
 * Ziel einer Einheit neu bestimmen.
 *
 * Reihenfolge: bestehendes Ziel behalten, wenn es noch lebt und nicht
 * zu weit weg ist; sonst im Aggro-Radius suchen; sonst den naechsten
 * Turm nehmen, auf den dann zugelaufen wird.
 */
export function zielSuchen(s: MatchState, e: Einheit): void {
  // Gebaeude laufen nicht - sie schiessen nur, was in Reichweite kommt.
  const suchRadius = e.istGebaeude
    ? e.reichweite
    : KAMPF.aggroRadius;

  if (e.zieltAuf === 'nur_gebaeude') {
    const bau = naechsteEinheit(s, e.x, e.y, e.spieler, e.zieltAuf, suchRadius * suchRadius);
    if (bau >= 0) {
      e.zielArt = 'einheit';
      e.zielIndex = bau;
      e.zielId = s.einheiten[bau]!.id;
      return;
    }
    const t = naechsterTurm(s, e.x, e.y, e.spieler, e.zieltAuf);
    e.zielArt = t >= 0 ? 'turm' : 'keins';
    e.zielIndex = t;
    e.zielId = 0;
    return;
  }

  if (zielLebt(s, e)) {
    const p = zielPunkt(s, e);
    const d = randAbstand2(e.x, e.y, 0, p.x, p.y, p.radius);
    const grenze = KAMPF.verfolgungsRadius;
    if (d <= grenze * grenze) return;
  }

  const nah = naechsteEinheit(s, e.x, e.y, e.spieler, e.zieltAuf, suchRadius * suchRadius);
  if (nah >= 0) {
    e.zielArt = 'einheit';
    e.zielIndex = nah;
    e.zielId = s.einheiten[nah]!.id;
    return;
  }

  if (e.istGebaeude) {
    // Ein Gebaeude ohne Ziel wartet einfach.
    e.zielArt = 'keins';
    e.zielIndex = -1;
    return;
  }

  const t = naechsterTurm(s, e.x, e.y, e.spieler, e.zieltAuf);
  e.zielArt = t >= 0 ? 'turm' : 'keins';
  e.zielIndex = t;
  e.zielId = 0;
}

/** Ziel eines Turms: die naechste gegnerische Einheit in Reichweite. */
export function turmZielSuchen(s: MatchState, t: Turm, index: number): void {
  void index;
  if (t.hp <= 0 || !t.wach) { t.zielIndex = -1; return; }

  // Bestehendes Ziel behalten, solange es in Reichweite bleibt.
  if (t.zielIndex >= 0) {
    const z = s.einheiten[t.zielIndex];
    if (z && z.aktiv && z.id === t.zielId && z.hp > 0) {
      const d = randAbstand2(t.x, t.y, t.radius, z.x, z.y, z.radius);
      if (d <= t.reichweite * t.reichweite) return;
    }
  }

  const feind = gegner(t.spieler);
  let besterIndex = -1;
  let besteDistanz = t.reichweite * t.reichweite;
  for (let i = 0; i < s.einheiten.length; i++) {
    const z = s.einheiten[i]!;
    if (!z.aktiv || z.spieler !== feind || z.hp <= 0) continue;
    // Tuerme treffen alles, auch Luft.
    const d = randAbstand2(t.x, t.y, t.radius, z.x, z.y, z.radius);
    if (d < besteDistanz) { besteDistanz = d; besterIndex = i; }
  }
  t.zielIndex = besterIndex;
  t.zielId = besterIndex >= 0 ? s.einheiten[besterIndex]!.id : 0;
}
