/* ------------------------------------------------------------------
   Angriffe, Schaden, Geschosse, Tod.

   Nahkampf trifft sofort, Fernkampf schickt ein Geschoss los. Die
   Grenze liegt bei FERN_AB: darunter waere ein Geschoss ohnehin im
   selben Tick da und wuerde nur Rechenzeit kosten.

   Geschosse fliegen auf einen Punkt, nicht auf ein Objekt. Stirbt
   das Ziel unterwegs, schlaegt der Pfeil trotzdem ein - das ist
   richtig so und macht Flaechenschaden berechenbar.
   ------------------------------------------------------------------ */

import { dist2, isqrt, schrittRichtung, clamp } from './fixed.js';
import type { Vek2 } from './fixed.js';
import { BREITE, HOEHE } from './arena.js';
import type { Spieler, Zielt, SchadensTyp } from './types.js';
import { gegner } from './types.js';
import type { MatchState, Einheit, Turm } from './state.js';
import {
  einheitFreigeben, projektilPlatz, projektilFreigeben, ereignis,
  koenigWecken, turmGefallen,
} from './entity.js';
import { kannTreffen, zielLebt, zielPunkt, turmZielSuchen } from './ziel.js';
import { karteVon } from './data/cards.js';

/** Ab dieser Reichweite fliegt ein Geschoss statt sofort zu treffen. */
const FERN_AB = 1600;
/** Geschosstempo in Millitiles pro Tick - acht Tiles je Sekunde. */
const GESCHOSS_TEMPO = 400;

const hilf: Vek2 = { x: 0, y: 0 };
const zielpunkt: Vek2 = { x: 0, y: 0 };

/**
 * Vorhalten: dorthin zielen, wo das Ziel beim Einschlag sein wird.
 *
 * Ohne das gehen Schuesse auf schnelle Einheiten reihenweise daneben -
 * der Pfeil fliegt auf einen Punkt, und ein Sturmfalke ist nach acht
 * Ticks Flugzeit laengst woanders. Beim ersten Durchlauf haben die
 * Speerwerferinnen deshalb gegen genau die Flieger verloren, die sie
 * kontern sollen.
 *
 * Geschaetzt wird linear ueber die aktuelle Blickrichtung. Das ist
 * nicht exakt - eine Einheit, die abbiegt, wird verfehlt - aber es
 * ist ganzzahlig, billig und trifft den geradlinigen Normalfall.
 */
function vorhalten(
  vonX: number, vonY: number, ziel: Einheit | null,
  zielX: number, zielY: number, raus: Vek2,
): void {
  raus.x = zielX;
  raus.y = zielY;
  if (!ziel || ziel.tempo <= 0 || ziel.istGebaeude) return;

  const flug = Math.trunc(isqrt(dist2(vonX, vonY, zielX, zielY)) / GESCHOSS_TEMPO);
  if (flug <= 0) return;

  const tempo = ziel.bremseRest > 0
    ? Math.trunc((ziel.tempo * ziel.bremsePromille) / 1000)
    : ziel.tempo;
  raus.x = zielX + Math.trunc((ziel.blickX * tempo * flug) / 1000);
  raus.y = zielY + Math.trunc((ziel.blickY * tempo * flug) / 1000);
}

/* --------------------------- Schaden ------------------------------- */

export function schadenAnEinheit(
  s: MatchState, index: number, dmg: number,
): void {
  const e = s.einheiten[index]!;
  if (!e.aktiv || e.hp <= 0 || dmg <= 0) return;
  e.hp -= dmg;
  e.getroffenTick = s.tick;
  if (e.hp <= 0) {
    ereignis(s, 'tod', e.spieler, e.x, e.y, e.radius, e.karte);
    einheitFreigeben(s, index);
  }
}

export function schadenAnTurm(s: MatchState, turm: Turm, dmg: number): void {
  if (turm.hp <= 0 || dmg <= 0) return;
  turm.hp -= dmg;
  turm.getroffenTick = s.tick;
  // Ein Treffer weckt den Koenig - auch wenn er nur gestreift wurde.
  if (turm.art === 'koenig') koenigWecken(s, turm.spieler);
  if (turm.hp <= 0) {
    turm.hp = 0;
    turmGefallen(s, turm);
  }
}

/**
 * Flaechenschaden um einen Punkt.
 *
 * Tuerme nehmen ihn ebenfalls, sonst koennte ein Wolkenwal neben dem
 * Turm einschlagen und ihn verfehlen.
 */
export function flaechenSchaden(
  s: MatchState, spieler: Spieler, x: number, y: number,
  radius: number, dmg: number, zieltAuf: Zielt, turmDmg = dmg,
): void {
  const feind = gegner(spieler);
  for (let i = 0; i < s.einheiten.length; i++) {
    const z = s.einheiten[i]!;
    if (!z.aktiv || z.spieler !== feind || z.hp <= 0) continue;
    if (!kannTreffen(zieltAuf, z.ebene, z.istGebaeude)) continue;
    const grenze = radius + z.radius;
    if (dist2(x, y, z.x, z.y) > grenze * grenze) continue;
    schadenAnEinheit(s, i, dmg);
  }
  if (turmDmg <= 0) return;
  for (const t of s.tuerme) {
    if (t.spieler !== feind || t.hp <= 0) continue;
    const grenze = radius + t.radius;
    if (dist2(x, y, t.x, t.y) > grenze * grenze) continue;
    schadenAnTurm(s, t, turmDmg);
  }
}

/* -------------------------- Geschosse ------------------------------ */

function geschossStarten(
  s: MatchState, spieler: Spieler, x: number, y: number,
  zielX: number, zielY: number, dmg: number, typ: SchadensTyp,
  flaechenRadius: number, zieltAuf: Zielt, farbe: string,
): void {
  const platz = projektilPlatz(s);
  if (platz < 0) {
    // Kein Geschoss frei - dann trifft es eben sofort.
    if (typ === 'flaeche') {
      flaechenSchaden(s, spieler, zielX, zielY, flaechenRadius, dmg, zieltAuf);
    }
    return;
  }
  const p = s.projektile[platz]!;
  p.aktiv = true;
  p.spieler = spieler;
  p.x = x;
  p.y = y;
  p.zielX = zielX;
  p.zielY = zielY;
  p.tempo = GESCHOSS_TEMPO;
  p.dmg = dmg;
  p.schadensTyp = typ;
  p.flaechenRadius = flaechenRadius;
  p.zieltAuf = zieltAuf;
  p.radius = 120;
  p.farbe = farbe;
}

/** Ein Einschlag: Flaechenschaden oder das naechste Ziel am Punkt. */
function einschlag(s: MatchState, index: number): void {
  const p = s.projektile[index]!;
  if (p.schadensTyp === 'flaeche') {
    flaechenSchaden(
      s, p.spieler, p.zielX, p.zielY, p.flaechenRadius, p.dmg, p.zieltAuf,
    );
    ereignis(s, 'treffer', p.spieler, p.zielX, p.zielY, p.flaechenRadius, '');
    projektilFreigeben(s, index);
    return;
  }

  /* Einzelschaden trifft, was am Einschlagpunkt steht. Ohne dieses
     kleine Suchfenster wuerde ein Pfeil an einer Einheit vorbeigehen,
     die sich seit dem Abschuss einen Schritt bewegt hat. */
  const fenster = 900;
  const feind = gegner(p.spieler);
  let beste = -1;
  let besteD = Infinity;
  for (let i = 0; i < s.einheiten.length; i++) {
    const z = s.einheiten[i]!;
    if (!z.aktiv || z.spieler !== feind || z.hp <= 0) continue;
    if (!kannTreffen(p.zieltAuf, z.ebene, z.istGebaeude)) continue;
    const grenze = fenster + z.radius;
    const d = dist2(p.zielX, p.zielY, z.x, z.y);
    if (d > grenze * grenze) continue;
    if (d < besteD) { besteD = d; beste = i; }
  }
  if (beste >= 0) {
    schadenAnEinheit(s, beste, p.dmg);
    ereignis(s, 'treffer', p.spieler, p.zielX, p.zielY, 0, '');
    projektilFreigeben(s, index);
    return;
  }

  for (const t of s.tuerme) {
    if (t.spieler !== feind || t.hp <= 0) continue;
    const grenze = fenster + t.radius;
    if (dist2(p.zielX, p.zielY, t.x, t.y) > grenze * grenze) continue;
    schadenAnTurm(s, t, p.dmg);
    ereignis(s, 'treffer', p.spieler, p.zielX, p.zielY, 0, '');
    break;
  }
  projektilFreigeben(s, index);
}

export function geschosseBewegen(s: MatchState): void {
  for (let i = 0; i < s.projektile.length; i++) {
    const p = s.projektile[i]!;
    if (!p.aktiv) continue;
    const dx = p.zielX - p.x;
    const dy = p.zielY - p.y;
    if (dx * dx + dy * dy <= p.tempo * p.tempo) {
      p.x = p.zielX;
      p.y = p.zielY;
      einschlag(s, i);
      continue;
    }
    schrittRichtung(dx, dy, p.tempo, hilf);
    p.x += hilf.x;
    p.y += hilf.y;
  }
}

/* --------------------------- Angriffe ------------------------------ */

/** Rueckstoss auf eine getroffene Einheit, weg vom Angreifer. */
function rueckstossen(
  ziel: Einheit, vonX: number, vonY: number, staerke: number,
): void {
  const dx = ziel.x - vonX;
  const dy = ziel.y - vonY;
  const laenge = isqrt(dx * dx + dy * dy);
  if (laenge === 0) return;
  ziel.x = clamp(ziel.x + Math.trunc((dx * staerke) / laenge), 0, BREITE);
  ziel.y = clamp(ziel.y + Math.trunc((dy * staerke) / laenge), 0, HOEHE);
}

/** Einen Angriff einer Einheit ausfuehren, wenn sie kann und darf. */
export function angreifen(s: MatchState, e: Einheit): void {
  if (e.deployRest > 0 || e.dmg <= 0) return;

  if (e.angriffCd > 0) {
    e.angriffCd--;
    if (e.angriffCd > 0) return;
  }

  if (!zielLebt(s, e)) return;
  const p = zielPunkt(s, e);
  const reichweite = e.reichweite + p.radius;
  if (dist2(e.x, e.y, p.x, p.y) > reichweite * reichweite) return;

  /* Verlangsamung wirkt auch auf die Schlagzahl, und zwar ueber den
     Takt statt ueber den Abbau: bei 550 Promille dauert der naechste
     Schlag rund das Doppelte. Am Zaehler zu drehen waere ungenauer
     und bei kurzen Takten schnell wirkungslos. */
  e.angriffCd = e.bremseRest > 0 && e.bremsePromille > 0
    ? Math.trunc((e.angriffsTakt * 1000) / e.bremsePromille)
    : e.angriffsTakt;
  const karte = karteVon(e.karte);
  const farbe = karte?.farbe ?? '#ffffff';

  if (e.reichweite >= FERN_AB) {
    const ziel = e.zielArt === 'einheit' ? s.einheiten[e.zielIndex]! : null;
    vorhalten(e.x, e.y, ziel, p.x, p.y, zielpunkt);
    geschossStarten(
      s, e.spieler, e.x, e.y, zielpunkt.x, zielpunkt.y, e.dmg,
      e.schadensTyp, e.flaechenRadius, e.zieltAuf, farbe,
    );
    return;
  }

  // Nahkampf trifft sofort.
  if (e.schadensTyp === 'flaeche') {
    flaechenSchaden(
      s, e.spieler, p.x, p.y, e.flaechenRadius, e.dmg, e.zieltAuf,
    );
    ereignis(s, 'treffer', e.spieler, p.x, p.y, e.flaechenRadius, e.karte);
    return;
  }

  if (e.zielArt === 'turm') {
    schadenAnTurm(s, s.tuerme[e.zielIndex]!, e.dmg);
  } else {
    const ziel = s.einheiten[e.zielIndex]!;
    schadenAnEinheit(s, e.zielIndex, e.dmg);
    if (karte?.rueckstoss && ziel.aktiv) {
      rueckstossen(ziel, e.x, e.y, karte.rueckstoss);
    }
  }
  ereignis(s, 'treffer', e.spieler, p.x, p.y, 0, e.karte);
}

/** Tuerme suchen ihr Ziel und schiessen. */
export function tuermeSchiessen(s: MatchState): void {
  for (let i = 0; i < s.tuerme.length; i++) {
    const t = s.tuerme[i]!;
    if (t.hp <= 0) continue;
    if (t.angriffCd > 0) t.angriffCd--;
    turmZielSuchen(s, t, i);
    if (!t.wach || t.zielIndex < 0 || t.angriffCd > 0) continue;

    const z = s.einheiten[t.zielIndex]!;
    if (!z.aktiv || z.id !== t.zielId) continue;
    t.angriffCd = t.angriffsTakt;
    vorhalten(t.x, t.y, z, z.x, z.y, zielpunkt);
    geschossStarten(
      s, t.spieler, t.x, t.y, zielpunkt.x, zielpunkt.y, t.dmg,
      'einzel', 0, 'beides', '#e8eef7',
    );
  }
}
