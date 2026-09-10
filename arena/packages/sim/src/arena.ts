/* ------------------------------------------------------------------
   Geometrie der Arena.

   18 x 32 Tiles, Fluss quer durch die Mitte, zwei Bruecken. Das
   Koordinatensystem laeuft von oben nach unten: y = 0 ist die
   Grundlinie von Spieler 1, y = 32 die von Spieler 0. Spieler 0 ist
   im lokalen Spiel immer der Mensch; die Ansicht wird nicht gedreht,
   sondern der Renderer spiegelt nur, wenn noetig.

   Alle Werte hier sind Geometrie, kein Balancing. Was sich am
   Spielgefuehl schrauben laesst, steht in data/balance.ts.
   ------------------------------------------------------------------ */

import { MT, tile } from './fixed.js';
import type { Spieler, Flanke } from './types.js';

export const BREITE_TILES = 18;
export const HOEHE_TILES = 32;

export const BREITE = BREITE_TILES * MT;
export const HOEHE = HOEHE_TILES * MT;

/** Fluss: zwei Tiles hoch, exakt mittig. Ohne Bruecke unpassierbar. */
export const FLUSS_OBEN = tile(15);
export const FLUSS_UNTEN = tile(17);

/** Bruecken: je zwei Tiles breit, mittig ueber den Seitentuermen. */
export const BRUECKE_BREITE = tile(2);
const BRUECKE_LINKS_X = tile(3.5);
const BRUECKE_RECHTS_X = tile(14.5);

export const BRUECKEN: readonly { flanke: Flanke; x: number }[] = [
  { flanke: 'links', x: BRUECKE_LINKS_X },
  { flanke: 'rechts', x: BRUECKE_RECHTS_X },
];

/** Mittelpunkt einer Bruecke - Wegpunkt fuer die Bodeneinheiten. */
export const BRUECKE_Y = (FLUSS_OBEN + FLUSS_UNTEN) / 2;

/* Turmpositionen, gemessen fuer Spieler 0 (unten). Die Gegenseite
   entsteht durch Spiegelung an der Flussmitte. */
const KOENIG_Y_UNTEN = tile(28);
const SEITE_Y_UNTEN = tile(24);
export const KOENIG_X = tile(9);
export const SEITE_LINKS_X = BRUECKE_LINKS_X;
export const SEITE_RECHTS_X = BRUECKE_RECHTS_X;

/** Halbe Kantenlaenge der Tuerme - zugleich ihr Kollisionsradius. */
export const KOENIG_RADIUS = tile(2);
export const SEITE_RADIUS = tile(1.5);

/** Spiegelt eine y-Koordinate auf die Gegenseite. */
export function spiegelY(y: number): number {
  return HOEHE - y;
}

/** y-Position eines Turms fuer die angegebene Seite. */
export function turmY(spieler: Spieler, art: 'koenig' | 'seite'): number {
  const unten = art === 'koenig' ? KOENIG_Y_UNTEN : SEITE_Y_UNTEN;
  return spieler === 0 ? unten : spiegelY(unten);
}

/** Blickrichtung: +1 laeuft nach unten, -1 nach oben. */
export function vorwaerts(spieler: Spieler): 1 | -1 {
  return spieler === 0 ? -1 : 1;
}

export function istImFluss(y: number): boolean {
  return y > FLUSS_OBEN && y < FLUSS_UNTEN;
}

/** Bodeneinheiten kommen nur ueber die Bruecken ans andere Ufer. */
export function istBegehbar(x: number, y: number): boolean {
  if (x < 0 || x > BREITE || y < 0 || y > HOEHE) return false;
  if (!istImFluss(y)) return true;
  const halb = BRUECKE_BREITE / 2;
  for (const b of BRUECKEN) {
    if (x >= b.x - halb && x <= b.x + halb) return true;
  }
  return false;
}

/** Die Bruecke, die von (x,y) aus am naechsten liegt. */
export function naechsteBruecke(x: number): { flanke: Flanke; x: number } {
  const links = BRUECKEN[0]!;
  const rechts = BRUECKEN[1]!;
  return Math.abs(x - links.x) <= Math.abs(x - rechts.x) ? links : rechts;
}

/**
 * Darf `spieler` an dieser Stelle etwas absetzen?
 *
 * Grundsaetzlich nur die eigene Haelfte. Faellt ein gegnerischer
 * Seitenturm, oeffnet sich zusaetzlich das Viertel hinter ihm - das
 * ist die Belohnung dafuer, eine Flanke durchgebrochen zu haben.
 * `offeneFlanken` enthaelt die Flanken, deren gegnerischer Seitenturm
 * bereits zerstoert ist.
 */
export function darfPlatzieren(
  spieler: Spieler,
  x: number,
  y: number,
  offeneFlanken: readonly Flanke[],
): boolean {
  if (x < 0 || x > BREITE || y < 0 || y > HOEHE) return false;

  const eigeneHaelfte = spieler === 0 ? y >= FLUSS_UNTEN : y <= FLUSS_OBEN;
  if (eigeneHaelfte) return true;

  if (!offeneFlanken.length) return false;
  const flanke: Flanke = x < KOENIG_X ? 'links' : 'rechts';
  if (offeneFlanken.indexOf(flanke) < 0) return false;

  // Das freigeschaltete Viertel: gegnerische Haelfte, richtige Flanke.
  return spieler === 0 ? y <= FLUSS_OBEN : y >= FLUSS_UNTEN;
}
