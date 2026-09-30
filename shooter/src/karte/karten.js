/* ------------------------------------------------------------------
   Alle Karten an einer Stelle.

   Die Reihenfolge ist zugleich die Nummer im Netz (Protokoll) und die
   Folge der Online-Runden: nach jeder Runde kommt die naechste Karte.
   Neue Karten darum nur hinten anhaengen.
   ------------------------------------------------------------------ */

import { birkenhain } from './birkenhain.js';
import { kraehenfeld } from './kraehenfeld.js';
import { moewenkai } from './moewenkai.js';
import { sandgrube } from './sandgrube.js';

export const KARTEN = {
  kraehenfeld: { id: 'kraehenfeld', name: 'Übungsgelände Krähenfeld', kurz: 'Krähenfeld', text: 'Containerhof · Appellplatz · Werkhalle', bauen: kraehenfeld },
  moewenkai: { id: 'moewenkai', name: 'Hafen Möwenkai', kurz: 'Möwenkai', text: 'Kaikante · Containerlager · Lagerhaus', bauen: moewenkai },
  birkenhain: { id: 'birkenhain', name: 'Dorf Birkenhain', kurz: 'Birkenhain', text: 'Hauptstraße · Marktplatz · Scheune', bauen: birkenhain },
  sandgrube: { id: 'sandgrube', name: 'Wüstenposten Sandgrube', kurz: 'Sandgrube', text: 'Pipeline · Ruinen · Bunker', bauen: sandgrube },
};

export const KARTEN_REIHE = ['kraehenfeld', 'moewenkai', 'birkenhain', 'sandgrube'];

/* Karte frisch bauen (jedes Mal ein neues Objekt). */
export function karteBauen(id) {
  const d = KARTEN[id] || KARTEN.kraehenfeld;
  const k = d.bauen();
  k.id = d.id;
  k.kurz = d.kurz;
  return k;
}

export function karteNr(id) {
  const i = KARTEN_REIHE.indexOf(id);
  return i < 0 ? 0 : i;
}

export function karteVon(nr) {
  return KARTEN_REIHE[nr] || KARTEN_REIHE[0];
}
