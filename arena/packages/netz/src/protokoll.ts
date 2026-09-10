/* ------------------------------------------------------------------
   Das Protokoll zwischen Client und Server.

   WARUM COMMAND-RELAY UND NICHT ZUSTANDSSTROM

   Der naheliegende Weg waere, dass der Server zwanzigmal pro Sekunde
   seinen Zustand verschickt und die Clients ihn nur anzeigen. Genau
   das steht auch im Auftrag. Hier steht etwas anderes, und zwar aus
   einem Grund, den es vorher nicht gab: die Simulation ist
   deterministisch geworden. Sie rechnet in ganzen Zahlen, wuerfelt aus
   einem mitgefuehrten Zustand und kennt keine Uhr. Zwei Geraete mit
   demselben Aufbau und derselben Befehlsfolge kommen Tick fuer Tick
   auf dasselbe Ergebnis - das ist getestet.

   Damit reicht es, die Befehle zu verteilen statt der Ergebnisse:

     Zustandsstrom   40 Einheiten mal 20 Bilder je Sekunde, mehrere
                     Kilobyte pro Sekunde und Spieler, dazu
                     Interpolation und deren Artefakte.
     Befehlsstrom    ein paar Dutzend Byte pro Kartenzug. In einer
                     ganzen Partie weniger als ein Zustandsbild.

   Der Server bleibt trotzdem autoritaer, und das ist der Punkt: er
   rechnet dieselbe Partie mit, prueft jeden Befehl mit derselben
   Funktion wie der Client (pruefeZug) und entscheidet allein, welcher
   Befehl in welchem Tick gilt. Ein manipulierter Client kann sich
   kein Elixir erfinden - sein Befehl wird verworfen, und die anderen
   beiden Rechner fuehren ihn nie aus.

   Auseinanderlaufen faellt auf, statt unbemerkt zu bleiben: der
   Server schickt einmal pro Sekunde die Pruefsumme seines Zustands
   mit. Stimmt sie beim Client nicht, holt der sich einen
   Schnappschuss und setzt neu auf. Damit gilt weiterhin die Regel aus
   dem Auftrag - der Serverzustand ueberschreibt den lokalen, nie
   umgekehrt.

   EINGABEVERZUG

   Ein Zug wirkt nicht sofort, sondern in `VERZUG_TICKS` Ticks. Nur so
   koennen ihn beide Seiten im selben Tick ausfuehren, ohne dass einer
   zurueckrechnen muss. 200 ms sind fuer ein Spiel, in dem eine
   Einheit fuenf Sekunden ueber die Bruecke laeuft, nicht zu spueren -
   und der Ring unter dem Finger erscheint sofort, weil er nur gemalt
   und nicht simuliert wird.
   ------------------------------------------------------------------ */

import type { MatchAufbau, Schnappschuss, Ablehnung, Ausgang } from '@arena/sim';

/** Version des Protokolls. Passt sie nicht, wird die Verbindung abgelehnt. */
export const PROTOKOLL_VERSION = 1;

/**
 * Ticks zwischen Absenden und Wirkung eines Zuges.
 *
 * Muss groesser sein als die halbe Rundreise der langsamsten
 * Verbindung, sonst kommt der Befehl beim Server an, wenn sein
 * Zieltick schon vorbei ist. Vier Ticks sind 200 ms - genug fuer
 * WLAN und Mobilfunk, wenig genug, um beim Spielen nicht aufzufallen.
 */
export const VERZUG_TICKS = 4;

/** Wie oft der Server seine Pruefsumme mitschickt, in Ticks. */
export const PRUEF_TAKT = 20;

/** Sekunden, die ein getrennter Spieler zum Wiederkommen hat. */
export const WIEDER_FENSTER_S = 30;

/** Minuten, nach denen ein unbenutzter Raum verfaellt. */
export const RAUM_VERFALL_MIN = 15;

/* ------------------------- Client an Server ------------------------ */

/** Ein Zug, wie ihn der Client anmeldet. */
export interface ZugAnmeldung {
  kartenId: string;
  x: number;
  y: number;
  /** Tick, in dem der Zug wirken soll. Der Server prueft ihn. */
  tick: number;
}

/** Was ein Spieler an den Tisch mitbringt. */
export interface Anmeldung {
  name: string;
  deck: string[];
  level: Record<string, number>;
}

export type VonClient =
  | { t: 'raumNeu'; version: number; anmeldung: Anmeldung; einheitlicheLevel: boolean }
  | { t: 'raumBei'; version: number; code: string; anmeldung: Anmeldung }
  | { t: 'wiederAn'; version: number; code: string; token: string }
  | { t: 'bereit'; wert: boolean }
  | { t: 'zug'; zug: ZugAnmeldung }
  | { t: 'schnappschussBitte' }
  | { t: 'verlassen' }
  | { t: 'ping'; zeit: number };

/* ------------------------- Server an Client ------------------------ */

/** Warum etwas nicht geht. Maschinenlesbar, damit der Client uebersetzt. */
export type Fehlergrund =
  | 'version'
  | 'raumUnbekannt'
  | 'raumVoll'
  | 'raumLaeuft'
  | 'deckUngueltig'
  | 'tokenUnbekannt'
  | 'schonDrin'
  | 'kaputt';

export interface Sitzplatz {
  name: string;
  bereit: boolean;
  /** Ist gerade jemand verbunden? Bei false laeuft das Rueckkehrfenster. */
  da: boolean;
}

export type VomServer =
  /** Platz bekommen. `du` sagt, welcher Spieler man ist. */
  | {
    t: 'raum'; code: string; du: 0 | 1; token: string;
    plaetze: [Sitzplatz | null, Sitzplatz | null]; einheitlicheLevel: boolean;
  }
  | { t: 'fehler'; grund: Fehlergrund }
  /** Anpfiff. Der Aufbau ist auf beiden Seiten Wort fuer Wort derselbe. */
  | { t: 'start'; aufbau: MatchAufbau; du: 0 | 1 }
  /**
   * Bestaetigte Zuege eines Ticks.
   *
   * Kommt auch dann, wenn nichts gespielt wurde - der Client weiss
   * damit, bis zu welchem Tick er rechnen darf. Ohne diese Freigabe
   * liefe er dem Server davon und muesste staendig zurueckrechnen.
   */
  | { t: 'zuege'; bisTick: number; liste: { spieler: 0 | 1; zug: ZugAnmeldung }[] }
  /** Pruefsumme des Serverzustands am Ende von `tick`. */
  | { t: 'pruef'; tick: number; summe: number }
  | { t: 'schnappschuss'; aufbau: MatchAufbau; stand: Schnappschuss }
  /** Eigener Zug abgelehnt - der Client nimmt seine Vorschau zurueck. */
  | { t: 'abgelehnt'; grund: Ablehnung | 'zuSpaet'; kartenId: string; tick: number }
  | { t: 'ende'; ausgang: Ausgang; tuerme: [number, number]; grund: 'regulaer' | 'aufgabe' }
  /** Gegenseite ist weg. `sekunden` ist das verbleibende Rueckkehrfenster. */
  | { t: 'weg'; spieler: 0 | 1; sekunden: number }
  | { t: 'zurueck'; spieler: 0 | 1 }
  | { t: 'pong'; zeit: number; serverTick: number };

/* ----------------------------- Helfer ------------------------------ */

/**
 * Nachricht lesen, ohne dem Absender zu glauben.
 *
 * Alles, was ueber das Netz kommt, ist erst einmal unbekannter Text.
 * Faellt hier etwas durch, wird die Verbindung nicht bedient - das ist
 * billiger als jede Einzelpruefung weiter innen.
 */
export function nachrichtLesen<T>(roh: string, maxLaenge = 200_000): T | null {
  if (roh.length > maxLaenge) return null;
  try {
    const wert = JSON.parse(roh) as unknown;
    if (!wert || typeof wert !== 'object') return null;
    if (typeof (wert as { t?: unknown }).t !== 'string') return null;
    return wert as T;
  } catch {
    return null;
  }
}
