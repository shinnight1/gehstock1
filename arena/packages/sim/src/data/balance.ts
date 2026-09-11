/* ------------------------------------------------------------------
   Alle Stellschrauben des Spiels an einem Ort.

   Regel: in der Spiellogik steht keine einzige Zahl, die sich am
   Spielgefuehl bemerkbar macht. Wer balancen will, aendert diese
   Datei und sonst nichts.

   Zeiten sind Ticks (20 pro Sekunde), Laengen Millitiles
   (1000 = ein Tile).
   ------------------------------------------------------------------ */

/** Simulationstakt. 20 Hz ist der Kompromiss aus Praezision und Netz-
    last: bei 30 Hz waeren die Lockstep-Pakete ohne spuerbaren Gewinn
    um die Haelfte haeufiger, bei 10 Hz ruckelt die Zielerfassung. */
export const TICKS_PRO_SEKUNDE = 20;

export function sekunden(s: number): number {
  return Math.round(s * TICKS_PRO_SEKUNDE);
}

/* ------------------------------ Elixir ------------------------------ */

export const ELIXIR = {
  /** Startvorrat. 5 erlaubt sofort einen mittleren Zug, aber keinen Tank. */
  start: 5,
  /** Obergrenze. Deckelt Horten und macht Ueberlauf zum Fehler. */
  cap: 10,
  /** Ticks fuer einen Punkt bei einfachem Tempo: 2.8 s. */
  ticksProPunkt: sekunden(2.8),
  /** Tempo-Stufen. Der Zaehler laeuft ganzzahlig, damit doppeltes und
      dreifaches Elixir exakt reproduzierbar bleiben. */
  tempoNormal: 1,
  tempoDoppelt: 2,
  tempoDreifach: 3,
} as const;

/* --------------------------- Match-Ablauf --------------------------- */

export const MATCH = {
  /** Regulaere Spielzeit: 3 Minuten. */
  dauer: sekunden(180),
  /** Ab hier doppeltes Elixir - die letzten 60 Sekunden. */
  doppeltAb: sekunden(120),
  /** Verlaengerung: 2 Minuten, dreifaches Elixir, erster Turmtreffer
      entscheidet. */
  overtime: sekunden(120),
  /** Countdown vor dem Anpfiff, damit beide Seiten ankommen. */
  countdown: sekunden(3),
} as const;

/* ------------------------------ Tuerme ------------------------------ */

/* Turmwerte bewusst hier und nicht in cards.ts: Tuerme sind keine
   Karten und sollen sich unabhaengig vom Kartenlevel balancen lassen. */
export const TURM = {
  koenig: {
    hp: 4008,
    dmg: 109,
    /** Ticks zwischen zwei Schuessen: 1.0 s. */
    angriffsTakt: sekunden(1.0),
    /* Von 7000 auf 5600 gesenkt. Sieben Kacheln reichten weit ueber
       den Fluss: ein Angriff stand schon unter Beschuss, bevor er die
       Bruecke verlassen hatte, und Fernkaempfer konnten den Turm nie
       aus sicherem Abstand angehen. Mit 5,6 Kacheln deckt der Koenig
       seinen Hof, nicht die halbe Karte. */
    reichweite: 5600,
    /** Ticks, bis der Koenig nach dem Aufwachen zum ersten Mal schiesst. */
    aufwachVerzoegerung: sekunden(1.0),
  },
  seite: {
    hp: 2534,
    dmg: 90,
    /** 0.8 s - schneller als der Koenig, dafuer schwaecher pro Schuss. */
    angriffsTakt: sekunden(0.8),
    /* Von 7500 auf 6000. Der Seitenturm hatte mehr Reichweite als der
       Koenig, ohne dass es dafuer einen Grund gab - vermutlich ein
       vertauschtes Zahlenpaar. Er bleibt der weiter reichende von
       beiden, aber nicht mehr um anderthalb Kacheln. */
    reichweite: 6000,
  },
} as const;

/* --------------------------- Deck und Hand --------------------------- */

export const DECK = {
  groesse: 8,
  handGroesse: 4,
} as const;

/* --------------------------- Kartenlevel ---------------------------- */

/* Level 1-5. Pro Stufe +7 % auf HP und Schaden, Elixirkosten bleiben
   gleich - Level soll sich lohnen, ohne die Kostenkurve zu kippen.
   7 % sind flach genug, dass Level 5 gegen Level 1 (+31 %) noch
   spielbar ist, und steil genug, dass Aufwerten sich anfuehlt. */
export const LEVEL = {
  max: 5,
  /** Splitter fuer den Sprung auf Level 2, 3, 4, 5. */
  splitterProStufe: [2, 4, 8, 16] as const,
  /** Multiplikator je Level als Promille (Level 1 = 1000). */
  faktorPromille: [1000, 1070, 1145, 1225, 1311] as const,
  /** Im Modus "Einheitliche Level" gilt fuer beide Seiten diese Stufe.
      Grund: sonst entscheidet Spielzeit statt Koennen. Bei Freundes-
      duellen ist der Modus deshalb voreingestellt. */
  einheitlich: 3,
} as const;

/* ------------------------------ Rolls ------------------------------- */

/* Raten in Zehntausendsteln, damit nirgends mit Fliesskomma verglichen
   werden muss. Summe muss exakt 10000 ergeben - dafuer gibt es einen
   Test.

   ==================== WARUM ZWEI RATENSAETZE ====================

   `raten` ist, was der Spieler im Info-Fenster liest und was am Ende
   tatsaechlich herauskommt. `basisRaten` ist, womit gezogen wird.

   Beide auseinanderzuhalten ist noetig, weil eine Pity-Garantie die
   Rate zwangslaeufig anhebt: eine Garantie beim n-ten Roll erzwingt
   allein schon eine Rate von etwa 1/n. Bei der urspruenglich
   geplanten Garantie beim 10. Roll waeren das rund 10 Prozent Episch
   gewesen - die versprochenen 6.5 Prozent sind damit unerreichbar,
   ganz egal wie klein man die Grundrate macht. Gemessen: mit
   Basisrate 2 von 10000 kamen immer noch 8.35 Prozent heraus.

   Deshalb sind die Garantien auf 14 und 70 gerueckt und die
   Basisraten so kalibriert, dass unter dem Strich genau die
   angezeigten Raten stehen. Nachgemessen ueber 800000 Ziehungen:
   6.48 Prozent Episch, 1.503 Prozent Legendaer.

   Wer die Garantien aendert, muss die Basisraten neu kalibrieren -
   der Verteilungstest schlaegt sonst an. */
export const ROLL = {
  /** Was angezeigt wird und effektiv herauskommt. Summe 10000. */
  raten: {
    gewoehnlich: 7000, // 70.0 %
    selten: 2200,      // 22.0 %
    episch: 650,       //  6.5 %
    legendaer: 150,    //  1.5 %
  },
  /** Womit gezogen wird, bevor die Garantien greifen. */
  basisRaten: {
    episch: 96,
    legendaer: 15,
  },
  /** Spaetestens beim n-ten Roll ohne Episch-oder-besser ist Episch fix. */
  pityEpisch: 14,
  /** Spaetestens beim n-ten Roll ohne Legendaer ist Legendaer fix. */
  pityLegendaer: 70,
  /** Rolls fuer ein beendetes Match, plus Bonus fuer den Sieg. Auch bei
      Niederlage gibt es einen - Frust soll nicht doppelt bestrafen. */
  proMatch: 1,
  bonusSieg: 1,
  /** Startpaket beim allerersten Oeffnen, damit sofort ein Deck steht. */
  erstpaket: 10,
  /** Splitter fuer ein Duplikat, nach Seltenheit. Seltene Karten fallen
      seltener, also muss ein Duplikat dort mehr wert sein. */
  duplikatSplitter: {
    gewoehnlich: 4,
    selten: 2,
    episch: 1,
    legendaer: 1,
  },
} as const;

/* ---------------------- Trophaeen und Arenen ------------------------ */

export const TROPHAEEN = {
  sieg: 30,
  niederlage: -25,
  unentschieden: 0,
  /** Nach unten gedeckelt, nach oben offen. */
  min: 0,
  /** Laenge der angezeigten Match-Historie. */
  historie: 20,
} as const;

/* Arenen schalten keine Karten frei - das macht das Roll-System.
   Sie bestimmen Optik und Bot-Staerke. */
export interface Arena {
  readonly id: number;
  readonly name: string;
  /** Ab dieser Trophaeenzahl gilt die Arena. */
  readonly ab: number;
  /**
   * Botstaerke am unteren Rand dieser Arena, 0 bis 1.
   *
   * Vorher haing die Staerke allein an einer weichen Kurve ueber alle
   * Trophaeen. Bei 300 - dem Eintritt in die zweite Arena - lag sie
   * damit bei 2,8 Prozent zwischen leicht und schwer: der Gegner
   * spielte praktisch genauso schlecht wie in der ersten. Eine neue
   * Arena muss sich aber anfuehlen wie eine neue Arena.
   *
   * Innerhalb einer Arena wird von hier bis zum Wert der naechsten
   * ueberblendet. Der Verlauf bleibt also stetig - der Sprung liegt
   * nicht an der Grenze, sondern im steilen Anstieg davor.
   */
  readonly haerte: number;
}

export const ARENEN: readonly Arena[] = [
  { id: 0, name: 'Sandgrube', ab: 0, haerte: 0 },
  { id: 1, name: 'Bruchsteinhof', ab: 300, haerte: 0.32 },
  { id: 2, name: 'Frostkanal', ab: 800, haerte: 0.52 },
  { id: 3, name: 'Aschewall', ab: 1500, haerte: 0.72 },
  { id: 4, name: 'Sturmspitze', ab: 2500, haerte: 0.88 },
];

export function arenaFuer(trophaeen: number): Arena {
  let treffer = ARENEN[0]!;
  for (const a of ARENEN) if (trophaeen >= a.ab) treffer = a;
  return treffer;
}

/* ------------------------- Kampf und Bewegung ----------------------- */

export const KAMPF = {
  /** Radius, in dem eine Einheit von ihrem Weg abkommt und angreift. */
  aggroRadius: 5500,
  /** Wie weit eine Einheit ihr Ziel verfolgt, bevor sie zurueck auf den
      Weg geht. Verhindert, dass Schwaerme quer ueber die Karte laufen. */
  verfolgungsRadius: 7500,
  /** Staerke der weichen Kollisionsaufloesung pro Tick, in Promille der
      Ueberlappung. 250 fuehlt sich weich an, ohne dass Einheiten
      ineinander stecken bleiben. */
  schiebenPromille: 250,
  /** Wie lange eine Einheit nach dem Absetzen unverwundbar aufbaut. */
  deployStandard: sekunden(1.0),
} as const;
