/* ------------------------------------------------------------------
   Einheiten aus Karten erzeugen.

   Eine Karte kann mehrere Exemplare bringen. Sie werden in einer
   festen Formation um den Zielpunkt gesetzt, nicht zufaellig: der
   Spieler soll wissen, wo seine sechs Ratten landen, und zwei
   Geraete muessen dieselbe Anordnung berechnen.

   Die Formationstabelle ersetzt Winkelfunktionen. sin und cos sind
   zwischen Engines nicht bitgenau vorgeschrieben (siehe fixed.ts),
   deshalb stehen die Versaetze hier als feste Ganzzahlen.
   ------------------------------------------------------------------ */

import { clamp } from './fixed.js';
import { BREITE, HOEHE } from './arena.js';
import type { Spieler } from './types.js';
import type { MatchState } from './state.js';
import { einheitPlatz, ereignis } from './entity.js';
import { karteVon } from './data/cards.js';
import { kartenHp, kartenDmg } from './karte.js';
import { KAMPF } from './data/balance.js';

/* Versaetze in Millitiles, je nach Gruppengroesse. Die Werte sind
   auf einen Radius von etwa 600 gerechnet und werden mit dem
   Einheitenradius skaliert. */
const FORMATION: readonly (readonly [number, number][])[] = [
  [],                                                   // 0
  [[0, 0]],                                             // 1
  [[-700, 0], [700, 0]],                                // 2
  [[0, -700], [-700, 500], [700, 500]],                 // 3
  [[-700, -700], [700, -700], [-700, 700], [700, 700]], // 4
  [[0, -900], [-800, -200], [800, -200], [-500, 800], [500, 800]],
  [[-700, -800], [700, -800], [-1000, 0], [1000, 0], [-500, 800], [500, 800]],
];

function versatz(anzahl: number, i: number): readonly [number, number] {
  const tabelle = FORMATION[Math.min(anzahl, FORMATION.length - 1)];
  if (!tabelle || !tabelle[i]) return [0, 0];
  return tabelle[i]!;
}

/**
 * Eine Karte absetzen. Gibt die Anzahl tatsaechlich erzeugter
 * Einheiten zurueck - bei vollem Feld koennen es weniger sein.
 *
 * Zauber gehoeren nicht hierher; die wirken sofort (siehe zauber.ts).
 */
export function karteSetzen(
  s: MatchState, spieler: Spieler, kartenId: string, level: number,
  x: number, y: number,
): number {
  const karte = karteVon(kartenId);
  if (!karte || karte.art === 'zauber') return 0;

  const hp = kartenHp(karte, level);
  const dmg = kartenDmg(karte, level);
  const istBau = karte.art === 'gebaeude';
  let gesetzt = 0;

  for (let i = 0; i < karte.anzahl; i++) {
    const platz = einheitPlatz(s);
    if (platz < 0) break;

    const [vx, vy] = versatz(karte.anzahl, i);
    // Formationswerte gelten fuer Radius 600 und wachsen mit der Einheit.
    const skala = karte.anzahl > 1 ? Math.trunc((karte.radius * 1000) / 600) : 0;
    const ex = clamp(x + Math.trunc((vx * skala) / 1000), 0, BREITE);
    const ey = clamp(y + Math.trunc((vy * skala) / 1000), 0, HOEHE);

    const e = s.einheiten[platz]!;
    e.aktiv = true;
    e.id = s.naechsteId++;
    e.spieler = spieler;
    e.karte = kartenId;
    e.level = level;
    e.x = ex;
    e.y = ey;
    e.hp = hp;
    e.maxHp = hp;
    e.dmg = dmg;
    e.angriffsTakt = karte.angriffsTakt;
    e.angriffCd = 0;
    e.tempo = karte.tempo;
    e.reichweite = karte.reichweite;
    e.zieltAuf = karte.zieltAuf;
    e.schadensTyp = karte.schadensTyp;
    e.ebene = karte.ebene;
    e.radius = karte.radius;
    e.flaechenRadius = karte.flaechenRadius ?? 0;

    e.istGebaeude = istBau;
    e.lebensdauerRest = istBau ? (karte.lebensdauer ?? -1) : -1;
    e.spawnCd = karte.spawnTakt ? karte.spawnTakt : -1;
    e.spawnKarte = karte.spawnKarte ?? '';
    e.spawnAnzahl = karte.spawnAnzahl ?? 0;

    e.deployRest = karte.deployZeit || KAMPF.deployStandard;
    e.bremseRest = 0;
    e.bremsePromille = 1000;
    e.zielArt = 'keins';
    e.zielIndex = -1;
    e.zielId = 0;
    e.ueberFluss = false;
    e.brueckeX = 0;
    e.blickX = 0;
    e.blickY = spieler === 0 ? -1000 : 1000;
    e.getroffenTick = -1000;

    gesetzt++;
  }

  if (gesetzt > 0) {
    ereignis(s, 'deploy', spieler, x, y, karte.radius, kartenId);
  }
  return gesetzt;
}

/**
 * Nachschub eines Spawners.
 *
 * Die Welle erscheint knapp vor dem Gebaeude in Laufrichtung, damit
 * sie nicht im Bauwerk steckt und sofort losziehen kann.
 */
export function spawnerWelle(s: MatchState, index: number): void {
  const bau = s.einheiten[index]!;
  if (!bau.aktiv || !bau.spawnKarte || bau.spawnAnzahl <= 0) return;

  const karte = karteVon(bau.spawnKarte);
  if (!karte) return;

  const vorwaerts = bau.spieler === 0 ? -1 : 1;
  const y = clamp(bau.y + vorwaerts * (bau.radius + 400), 0, HOEHE);

  /* spawnAnzahl zaehlt Exemplare, nicht Kartenausspielungen. Eine
     Karte mit anzahl 6 wuerde sonst pro Welle 6 mal 2 Ratten legen. */
  const proSetzen = Math.max(1, karte.anzahl);
  const wellen = Math.max(1, Math.ceil(bau.spawnAnzahl / proSetzen));
  for (let i = 0; i < wellen; i++) {
    const x = clamp(bau.x + (i === 0 ? 0 : (i % 2 === 1 ? 500 : -500)), 0, BREITE);
    karteSetzen(s, bau.spieler, bau.spawnKarte, bau.level, x, y);
  }
}
