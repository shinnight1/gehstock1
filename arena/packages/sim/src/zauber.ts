/* ------------------------------------------------------------------
   Zauber.

   Sie wirken sofort am Zielpunkt, ohne Einheit und ohne Flugzeit.
   Zwei Besonderheiten:

   1. Zauber machen an Tuermen deutlich weniger Schaden als an
      Einheiten. Sonst waere der schnellste Weg zum Sieg, vier Mal
      einen Feuersturm auf denselben Turm zu werfen - kein Spiel,
      sondern eine Rechenaufgabe.

   2. Sie treffen Boden und Luft gleichermassen. Ein Zauber, der
      Fliegendes verfehlt, waere gegen halbe Decks wertlos.
   ------------------------------------------------------------------ */

import { dist2 } from './fixed.js';
import type { Spieler } from './types.js';
import { gegner } from './types.js';
import type { MatchState } from './state.js';
import { ereignis } from './entity.js';
import { schadenAnEinheit, schadenAnTurm } from './kampf.js';
import { karteVon } from './data/cards.js';
import { zauberSchaden } from './karte.js';

/**
 * Einen Zauber ausloesen. Gibt false, wenn die Karte kein Zauber ist.
 */
export function zauberWirken(
  s: MatchState, spieler: Spieler, kartenId: string, level: number,
  x: number, y: number,
): boolean {
  const karte = karteVon(kartenId);
  if (!karte || karte.art !== 'zauber') return false;

  const radius = karte.zauberRadius ?? 0;
  const schaden = zauberSchaden(karte, level);
  const feind = gegner(spieler);

  for (let i = 0; i < s.einheiten.length; i++) {
    const z = s.einheiten[i]!;
    if (!z.aktiv || z.spieler !== feind || z.hp <= 0) continue;
    const grenze = radius + z.radius;
    if (dist2(x, y, z.x, z.y) > grenze * grenze) continue;

    /* Erst bremsen, dann Schaden: stirbt die Einheit am Schaden, ist
       die Bremse ohnehin gegenstandslos - andersherum wuerde eine
       Bremse auf einer bereits freigegebenen Einheit landen. */
    if (karte.bremsePromille && karte.bremseDauer) {
      z.bremseRest = karte.bremseDauer;
      z.bremsePromille = karte.bremsePromille;
    }
    schadenAnEinheit(s, i, schaden.einheiten);
  }

  if (schaden.tuerme > 0) {
    for (const t of s.tuerme) {
      if (t.spieler !== feind || t.hp <= 0) continue;
      const grenze = radius + t.radius;
      if (dist2(x, y, t.x, t.y) > grenze * grenze) continue;
      schadenAnTurm(s, t, schaden.tuerme);
    }
  }

  ereignis(s, 'zauber', spieler, x, y, radius, kartenId);
  return true;
}

/** Laufende Verlangsamungen abbauen. Einmal je Tick. */
export function bremsenTicken(s: MatchState): void {
  for (const e of s.einheiten) {
    if (!e.aktiv || e.bremseRest <= 0) continue;
    e.bremseRest--;
    if (e.bremseRest === 0) e.bremsePromille = 1000;
  }
}
