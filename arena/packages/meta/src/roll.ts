/* ------------------------------------------------------------------
   Das Roll-System.

   Gezogen wird in zwei Schritten: erst die Seltenheit, dann eine
   Karte daraus. Beides mit dem Roll-Generator aus dem Profil, nie mit
   dem Sim-RNG - was man zieht, darf nicht davon abhaengen, wie ein
   Match verlaufen ist.

   Die Pity-Zaehler sind das Versprechen an den Spieler: spaetestens
   beim 14. Roll ohne Episch kommt eines, spaetestens beim 70. ohne
   Legendaer kommt eines. Beide laufen getrennt, und beide sind im UI
   einsehbar - versteckte Wahrscheinlichkeiten sind genau das, was
   dieses Spiel nicht haben soll. Warum 14 und 70 und nicht 10 und 60,
   steht in balance.ts.

   Kein Echtgeld. Rolls entstehen ausschliesslich durch gespielte
   Matches.
   ------------------------------------------------------------------ */

import { ROLL, DECK, SAMMELKARTEN, rngInt } from '@arena/sim';
import type { Seltenheit } from '@arena/sim';
import type { Profil } from './profil.js';
import { splitterGeben } from './sammlung.js';

export interface RollErgebnis {
  kartenId: string;
  seltenheit: Seltenheit;
  /** Erste Ausgabe dieser Karte? */
  neu: boolean;
  /** Bei einem Duplikat: wie viele Splitter es gab. */
  splitter: number;
  /** Wurde die Seltenheit durch einen Pity-Zaehler erzwungen? */
  durchPity: null | 'episch' | 'legendaer';
}

/* Karten nach Seltenheit, einmal vorsortiert. Bei jedem Roll neu zu
   filtern waere bei 100000 Testrolls spuerbar. */
const NACH_SELTENHEIT = new Map<Seltenheit, string[]>();
for (const k of SAMMELKARTEN) {
  const liste = NACH_SELTENHEIT.get(k.seltenheit) ?? [];
  liste.push(k.id);
  NACH_SELTENHEIT.set(k.seltenheit, liste);
}

const REIHENFOLGE: readonly Seltenheit[] = [
  'gewoehnlich', 'selten', 'episch', 'legendaer',
];

/** Anteil einer Seltenheit in Zehntausendsteln. */
export function rate(s: Seltenheit): number {
  return ROLL.raten[s];
}

/**
 * Wie viele Rolls noch bis zur jeweiligen Garantie.
 *
 * Fuer die Anzeige "noch X bis Garantie". Null bedeutet: der naechste
 * Roll ist garantiert.
 */
export function pityStand(p: Profil): { episch: number; legendaer: number } {
  return {
    episch: Math.max(0, ROLL.pityEpisch - 1 - p.seitEpisch),
    legendaer: Math.max(0, ROLL.pityLegendaer - 1 - p.seitLegendaer),
  };
}

/** Seltenheit ziehen, Pity beachten. Mutiert die Zaehler nicht. */
function seltenheitZiehen(p: Profil): {
  seltenheit: Seltenheit; durchPity: RollErgebnis['durchPity'];
} {
  /* Legendaer zuerst pruefen: waere in einem Roll beides faellig,
     ist das seltenere Versprechen das wichtigere - und es erfuellt
     das andere gleich mit. */
  if (p.seitLegendaer + 1 >= ROLL.pityLegendaer) {
    return { seltenheit: 'legendaer', durchPity: 'legendaer' };
  }
  if (p.seitEpisch + 1 >= ROLL.pityEpisch) {
    /* Genau Episch, nicht Legendaer. Liesse man hier auch Legendaer
       zu, haenge dessen Rate an der Episch-Garantie mit - gemessen
       stieg sie dadurch von 1.5 auf 4.8 Prozent. Die beiden Zaehler
       muessen unabhaengig bleiben, sonst ist keine der beiden
       angezeigten Raten mehr haltbar. */
    return { seltenheit: 'episch', durchPity: 'episch' };
  }

  /* Gezogen wird mit den Basisraten, nicht mit den angezeigten - die
     Garantien oben heben das Ergebnis auf die angezeigten Werte an.
     Siehe die Herleitung in balance.ts. */
  const wurf = rngInt(p.rng, 10000);
  if (wurf < ROLL.basisRaten.legendaer) {
    return { seltenheit: 'legendaer', durchPity: null };
  }
  if (wurf < ROLL.basisRaten.legendaer + ROLL.basisRaten.episch) {
    return { seltenheit: 'episch', durchPity: null };
  }
  const rest = 10000 - ROLL.basisRaten.legendaer - ROLL.basisRaten.episch;
  const anteilSelten = Math.trunc(
    (ROLL.raten.selten * rest) / (ROLL.raten.gewoehnlich + ROLL.raten.selten),
  );
  const zweiter = wurf - ROLL.basisRaten.legendaer - ROLL.basisRaten.episch;
  return {
    seltenheit: zweiter < anteilSelten ? 'selten' : 'gewoehnlich',
    durchPity: null,
  };
}

/* Bis zu so vielen eigenen Karten gilt der Anfaengerschutz. Genau
   die Deckgroesse - danach ist ein Deck spielbar und Duplikate sind
   kein Problem mehr, sondern der normale Weg zu hoeheren Leveln. */
const SCHUTZ_BIS = DECK.groesse;

/**
 * Karte waehlen - mit Anfaengerschutz.
 *
 * Wer noch kein volles Deck besitzt, bekommt etwas Neues. Zuerst wird
 * innerhalb der gezogenen Seltenheit gesucht; ist dort alles schon
 * vorhanden, wird auf eine beliebige neue Karte ausgewichen. Der
 * zweite Schritt ist noetig, weil es nur eine legendaere Karte gibt:
 * ohne ihn blieb jeder zweite Legendaer-Roll im Startpaket ein
 * Duplikat, und rund jeder dritte Neustart kam nicht auf acht
 * verschiedene Karten - konnte also kein Match beginnen.
 *
 * Der Schutz endet, sobald ein Deck zusammen ist. Danach sind
 * Duplikate kein Unfall, sondern der Weg zu hoeheren Leveln.
 */
function karteWaehlen(p: Profil, auswahl: readonly string[]): string {
  if (!auswahl.length) return SAMMELKARTEN[0]!.id;

  const eigene = Object.keys(p.karten).length;
  if (eigene >= SCHUTZ_BIS) return auswahl[rngInt(p.rng, auswahl.length)]!;

  const neue = auswahl.filter((id) => !p.karten[id]);
  if (neue.length) return neue[rngInt(p.rng, neue.length)]!;

  const irgendeineNeue = SAMMELKARTEN
    .filter((k) => !p.karten[k.id])
    .map((k) => k.id);
  if (irgendeineNeue.length) {
    return irgendeineNeue[rngInt(p.rng, irgendeineNeue.length)]!;
  }
  return auswahl[rngInt(p.rng, auswahl.length)]!;
}

/**
 * Einen Roll ziehen und im Profil verbuchen.
 *
 * Zieht einen Roll vom Vorrat ab. Ist keiner da, gibt die Funktion
 * null zurueck und aendert nichts.
 */
export function rollZiehen(p: Profil): RollErgebnis | null {
  if (p.rolls <= 0) return null;
  p.rolls--;
  p.rollsGesamt++;

  const { seltenheit, durchPity } = seltenheitZiehen(p);

  // Zaehler fortschreiben, bevor die Karte gewaehlt wird.
  if (seltenheit === 'legendaer') {
    p.seitLegendaer = 0;
    p.seitEpisch = 0;
  } else if (seltenheit === 'episch') {
    p.seitEpisch = 0;
    p.seitLegendaer++;
  } else {
    p.seitEpisch++;
    p.seitLegendaer++;
  }

  const auswahl = NACH_SELTENHEIT.get(seltenheit) ?? [];
  const kartenId = karteWaehlen(p, auswahl);

  const vorhanden = p.karten[kartenId];
  if (!vorhanden) {
    p.karten[kartenId] = { level: 1, splitter: 0 };
    return { kartenId, seltenheit, neu: true, splitter: 0, durchPity };
  }

  const splitter = ROLL.duplikatSplitter[seltenheit];
  const gegeben = splitterGeben(p, kartenId, splitter);
  return { kartenId, seltenheit, neu: false, splitter: gegeben, durchPity };
}

/** Mehrere Rolls am Stueck. Bricht ab, sobald der Vorrat leer ist. */
export function rollsZiehen(p: Profil, anzahl: number): RollErgebnis[] {
  const raus: RollErgebnis[] = [];
  for (let i = 0; i < anzahl; i++) {
    const r = rollZiehen(p);
    if (!r) break;
    raus.push(r);
  }
  return raus;
}

/**
 * Das Startpaket vergeben.
 *
 * Zehn Rolls beim allerersten Start, damit sofort ein spielbares Deck
 * entsteht. Ohne das saesse man vor einer leeren Sammlung und koennte
 * kein Match beginnen - der schlechteste denkbare erste Eindruck.
 */
export function erstpaketVergeben(p: Profil): boolean {
  if (p.erstpaketVergeben) return false;
  p.erstpaketVergeben = true;
  p.rolls += ROLL.erstpaket;
  return true;
}

/** Die hoechste Seltenheit einer Ziehung - fuer die Farbe im Zehnerflug. */
export function hoechsteSeltenheit(liste: readonly RollErgebnis[]): Seltenheit {
  let beste: Seltenheit = 'gewoehnlich';
  for (const r of liste) {
    if (REIHENFOLGE.indexOf(r.seltenheit) > REIHENFOLGE.indexOf(beste)) {
      beste = r.seltenheit;
    }
  }
  return beste;
}
