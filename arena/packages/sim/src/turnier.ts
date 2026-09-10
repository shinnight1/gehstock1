/* ------------------------------------------------------------------
   Decks gegeneinander ausrechnen.

   Bis hierher war die Balance eine Vermutung. Die einzelnen Konter
   sind je durch einen Test abgesichert - Sturmfalken schlagen
   Rattenschar, Funkenregen raeumt Schwaerme - aber ob ein ganzes Deck
   gegen ein anderes fair steht, wusste niemand. Diese Datei macht
   daraus eine Zahl.

   Gespielt wird Bot gegen Bot, beide mit demselben Profil. Das ist
   die einzige Art, wie der Vergleich das Deck misst und nicht den
   Spieler: sitzt auf einer Seite ein besserer Spieler, sagt das
   Ergebnis nichts ueber die Karten.

   ZWEI VERZERRUNGEN, DIE HERAUSGERECHNET WERDEN MUESSEN

   Erstens die Seite. Spieler 0 greift von unten an, Spieler 1 von
   oben. Das Feld ist gespiegelt, aber die Reihenfolge, in der die
   Simulation Einheiten durchgeht, ist es nicht.

   Zweitens die Zugreihenfolge. Handelt Bot 0 vor Bot 1, sieht Bot 1
   dessen Zug bereits und darf darauf antworten - ein kleiner, aber
   echter Vorteil.

   Beides wird dadurch neutralisiert, dass jedes Deck die Haelfte
   seiner Partien auf jeder Seite spielt. Ob das reicht, prueft der
   Spiegeltest: laesst man ein Deck gegen sich selbst antreten, muss
   fifty-fifty herauskommen. Tut es das nicht, ist der Vergleich
   kaputt und jede andere Zahl daraus wertlos.

   WAS DIE ZAHLEN NICHT SAGEN

   Der Bot ist kein Mensch. Er haelt kein Elixir fuer den naechsten
   Zyklus zurueck, er baut keinen Doppelpush auf, er blufft nicht.
   Ein Deck, das auf solche Zuege ausgelegt ist, sieht hier
   schlechter aus, als es ist. Die Zahlen taugen dafuer, Ausreisser
   zu finden - eine Karte mit 62 Prozent ist zu stark, egal wie gut
   der Bot spielt. Sie taugen nicht als letztes Wort.
   ------------------------------------------------------------------ */

import { matchAnlegen } from './entity.js';
import type { MatchAufbau } from './entity.js';
import { tick, matchZeit } from './match.js';
import { botAnlegen, botTick } from './bot/bot.js';
import { botProfil } from './bot/profil.js';
import type { BotProfil } from './bot/profil.js';
import { rngAusSeed, rngInt } from './rng.js';
import type { RngState } from './rng.js';
import { MATCH, DECK, TICKS_PRO_SEKUNDE } from './data/balance.js';
import type { Ausgang } from './state.js';

/** Sicherheitsnetz: laenger als Countdown, Spielzeit und Verlaengerung. */
const MAX_TICKS = MATCH.countdown + MATCH.dauer + MATCH.overtime + TICKS_PRO_SEKUNDE * 5;

export interface PartieErgebnis {
  ausgang: Ausgang;
  /** Zerstoerte Tuerme je Spieler. */
  tuerme: [number, number];
  /** Gespielte Sekunden seit dem Anpfiff. */
  sekunden: number;
}

export interface TurnierOptionen {
  /** Wie viele Partien. Mehr Partien, engeres Vertrauensband. */
  partien?: number;
  /** Startwert. Derselbe Wert ergibt dasselbe Ergebnis. */
  seed?: number;
  /**
   * Trophaeenstand, aus dem beide Botprofile entstehen.
   *
   * Beide Seiten bekommen dasselbe - sonst misst der Vergleich den
   * Bot und nicht das Deck.
   */
  trophaeen?: number;
  /**
   * Hin- und Rueckrunde mit demselben Startwert spielen.
   *
   * Voreingestellt an, und das ist der bessere Weg: dasselbe Match
   * wird einmal mit A auf Seite 0 und einmal mit A auf Seite 1
   * gerechnet. Damit ist die Seitenverzerrung nicht statistisch
   * ausgemittelt, sondern exakt aufgehoben - was ein Deck aus der
   * Sitzordnung zieht, zieht das andere im selben Zug ebenso.
   *
   * Aus fuehrt zu unabhaengigen Startwerten. Das braucht mehr Partien
   * fuer dieselbe Genauigkeit, ist aber die einzige Einstellung, in
   * der ein Spiegelduell ueberhaupt etwas messen kann: mit Paarung
   * kommt dort zwangslaeufig genau 50 Prozent heraus, weil beide
   * Partien eines Paares dieselbe sind.
   */
  paarweise?: boolean;
}

/**
 * Eine einzelne Partie, Bot gegen Bot.
 *
 * Einheitliche Level, immer: sonst entschiede die Sammlung mit, und
 * gemessen werden soll die Karte, nicht ihr Ausbaustand.
 */
export function partie(
  deck0: readonly string[], deck1: readonly string[],
  seed: number, profil: BotProfil,
): PartieErgebnis {
  const aufbau: MatchAufbau = {
    seed,
    decks: [deck0.slice(), deck1.slice()],
    einheitlicheLevel: true,
  };
  const s = matchAnlegen(aufbau);
  const bot0 = botAnlegen(0, profil);
  const bot1 = botAnlegen(1, profil);

  while (!s.ausgang && s.tick < MAX_TICKS) {
    botTick(s, bot0);
    botTick(s, bot1);
    tick(s);
  }

  return {
    ausgang: s.ausgang ?? 'unentschieden',
    tuerme: [s.spieler[0].tuermeZerstoert, s.spieler[1].tuermeZerstoert],
    sekunden: Math.round(matchZeit(s) / TICKS_PRO_SEKUNDE),
  };
}

export interface DuellErgebnis {
  partien: number;
  siegeA: number;
  siegeB: number;
  unentschieden: number;
  /** Siegquote von A, Unentschieden als halber Sieg gezaehlt. */
  quote: number;
  /** Halbe Breite des 95-Prozent-Vertrauensbands, in Prozentpunkten. */
  unsicherheit: number;
  /** Turmvorsprung von A je Partie, im Schnitt. */
  turmVorsprung: number;
  /** Durchschnittliche Spieldauer in Sekunden. */
  dauer: number;
}

/**
 * Zwei Decks gegeneinander.
 *
 * Deck A spielt jede zweite Partie auf der anderen Seite. Deshalb
 * sollte `partien` gerade sein - bei ungerader Zahl bekaeme eine
 * Seite eine Partie mehr, und genau das soll der Aufbau vermeiden.
 */
export function duell(
  deckA: readonly string[], deckB: readonly string[], o: TurnierOptionen = {},
): DuellErgebnis {
  const partien = Math.max(2, (o.partien ?? 200) & ~1);
  const profil = botProfil(o.trophaeen ?? 2000);
  const basis = o.seed ?? 1;
  const paarweise = o.paarweise !== false;

  let siegeA = 0;
  let siegeB = 0;
  let remis = 0;
  let turmSumme = 0;
  let sekundenSumme = 0;

  for (let i = 0; i < partien; i++) {
    // Gerade Nummern: A sitzt auf Seite 0. Ungerade: auf Seite 1.
    const aLinks = i % 2 === 0;
    const e = partie(
      aLinks ? deckA : deckB,
      aLinks ? deckB : deckA,
      basis * 7919 + (paarweise ? i >> 1 : i),
      profil,
    );

    const aTuerme = aLinks ? e.tuerme[0] : e.tuerme[1];
    const bTuerme = aLinks ? e.tuerme[1] : e.tuerme[0];
    turmSumme += aTuerme - bTuerme;
    sekundenSumme += e.sekunden;

    if (e.ausgang === 'unentschieden') remis++;
    else if ((e.ausgang === 'sieg0') === aLinks) siegeA++;
    else siegeB++;
  }

  const quote = (siegeA + remis / 2) / partien;
  return {
    partien,
    siegeA,
    siegeB,
    unentschieden: remis,
    quote,
    unsicherheit: vertrauensband(quote, partien),
    turmVorsprung: turmSumme / partien,
    dauer: sekundenSumme / partien,
  };
}

/**
 * Halbe Breite des 95-Prozent-Bands, in Prozentpunkten.
 *
 * Steht in jeder Ausgabe, weil die Zahl ohne sie zum Fehlschluss
 * einlaedt: 54 Prozent aus 100 Partien sind kein Ungleichgewicht,
 * sondern Rauschen. Erst wenn der Abstand zu 50 groesser ist als
 * dieses Band, lohnt es, an einer Karte zu drehen.
 */
export function vertrauensband(quote: number, partien: number): number {
  if (partien <= 0) return 100;
  return 1.96 * Math.sqrt(Math.max(quote * (1 - quote), 0.0001) / partien) * 100;
}

export interface KartenWertung {
  karte: string;
  /** Partien, in denen die Karte im Deck lag. */
  partien: number;
  siege: number;
  quote: number;
  unsicherheit: number;
}

export interface KartenOptionen extends TurnierOptionen {
  /** Wie viele Karten ein Deck hat. Vorgabe: die Decksgroesse des Spiels. */
  deckGroesse?: number;
}

/**
 * Siegquote je Karte, gemittelt ueber viele zufaellige Decks.
 *
 * Der aussagekraeftigere der beiden Modi. Ein Duell sagt, welches von
 * zwei Decks besser ist; das hier sagt, welche Karte ueberall dort,
 * wo sie auftaucht, den Ausschlag gibt - und das ist die Frage, die
 * man beim Balancieren wirklich hat.
 *
 * Die Decks werden aus einem eigenen Zufallsgenerator gezogen, nicht
 * aus dem der Partie. Der gehoert zum Match und darf nicht davon
 * abhaengen, wie viele Decks vorher gewuerfelt wurden.
 *
 * Was die Zahl nicht trennt: eine Karte, die zufaellig oft neben
 * einer sehr starken liegt, erbt deren Quote. Ueber genug zufaellige
 * Decks mittelt sich das heraus - bei zweihundert Partien noch nicht,
 * bei zweitausend schon.
 */
export function kartenWertung(
  alle: readonly string[], o: KartenOptionen = {},
): KartenWertung[] {
  const partien = Math.max(2, (o.partien ?? 400) & ~1);
  const groesse = o.deckGroesse ?? DECK.groesse;
  const profil = botProfil(o.trophaeen ?? 2000);
  const wuerfel: RngState = rngAusSeed(o.seed ?? 1);

  const gespielt = new Map<string, number>();
  const gewonnen = new Map<string, number>();
  for (const id of alle) { gespielt.set(id, 0); gewonnen.set(id, 0); }

  for (let i = 0; i < partien; i += 2) {
    const deckA = zufallsDeck(wuerfel, alle, groesse);
    const deckB = zufallsDeck(wuerfel, alle, groesse);
    const seed = rngInt(wuerfel, 0x7fffffff);

    /* Jedes Paar zweimal, mit getauschten Seiten. Sonst schlaegt die
       Seitenverzerrung auf die Kartenwertung durch. */
    for (const aLinks of [true, false]) {
      const e = partie(
        aLinks ? deckA : deckB, aLinks ? deckB : deckA, seed, profil,
      );
      const aGewinnt = e.ausgang === 'unentschieden'
        ? null
        : (e.ausgang === 'sieg0') === aLinks;

      for (const id of deckA) {
        gespielt.set(id, gespielt.get(id)! + 1);
        if (aGewinnt === true) gewonnen.set(id, gewonnen.get(id)! + 1);
        else if (aGewinnt === null) gewonnen.set(id, gewonnen.get(id)! + 0.5);
      }
      for (const id of deckB) {
        gespielt.set(id, gespielt.get(id)! + 1);
        if (aGewinnt === false) gewonnen.set(id, gewonnen.get(id)! + 1);
        else if (aGewinnt === null) gewonnen.set(id, gewonnen.get(id)! + 0.5);
      }
    }
  }

  const wertung: KartenWertung[] = [];
  for (const id of alle) {
    const n = gespielt.get(id)!;
    const w = gewonnen.get(id)!;
    const quote = n > 0 ? w / n : 0.5;
    wertung.push({
      karte: id, partien: n, siege: w, quote,
      unsicherheit: vertrauensband(quote, n),
    });
  }
  wertung.sort((a, b) => b.quote - a.quote);
  return wertung;
}

/** Zufaelliges Deck ohne Doppelte. */
function zufallsDeck(
  wuerfel: RngState, alle: readonly string[], groesse: number,
): string[] {
  const rest = alle.slice();
  const deck: string[] = [];
  while (deck.length < groesse && rest.length > 0) {
    deck.push(rest.splice(rngInt(wuerfel, rest.length), 1)[0]!);
  }
  return deck;
}
