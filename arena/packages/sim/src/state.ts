/* ------------------------------------------------------------------
   Der Zustand eines Matches.

   Alles, was die Simulation braucht, haengt an einem einzigen Objekt.
   Das ist Absicht: so laesst sich ein Match kopieren, serialisieren
   und Zug um Zug mit einem zweiten vergleichen - die Grundlage jedes
   Determinismus-Tests.

   Einheiten und Projektile liegen in festen Feldern mit einer Liste
   freier Plaetze. Im laufenden Spiel wird damit nichts mehr alloziert:
   ein gestorbener Schwarm gibt seine Plaetze zurueck, der naechste
   nimmt sie wieder. Iteriert wird immer ueber den Feldindex von 0 an
   aufwaerts - eine Reihenfolge, die auf jedem Geraet dieselbe ist.
   ------------------------------------------------------------------ */

import type { RngState } from './rng.js';
import type { Spieler, Zielt, Ebene, SchadensTyp, TurmArt, Flanke } from './types.js';

/** Obergrenzen der Felder. Grosszuegig - Schwaerme kosten schnell viel. */
export const MAX_EINHEITEN = 240;
export const MAX_PROJEKTILE = 160;

/** Worauf eine Einheit gerade zielt. */
export type ZielArt = 'keins' | 'einheit' | 'turm';

export interface Einheit {
  aktiv: boolean;
  /** Fortlaufend und einmalig. Erkennt wiederverwendete Plaetze. */
  id: number;
  spieler: Spieler;
  karte: string;
  level: number;

  x: number;
  y: number;
  hp: number;
  maxHp: number;

  dmg: number;
  /** Ticks zwischen zwei Angriffen. */
  angriffsTakt: number;
  /** Ticks bis zum naechsten Angriff. */
  angriffCd: number;
  tempo: number;
  reichweite: number;
  zieltAuf: Zielt;
  schadensTyp: SchadensTyp;
  ebene: Ebene;
  radius: number;
  flaechenRadius: number;

  /** Gebaeude stehen still und ziehen Angreifer auf sich. */
  istGebaeude: boolean;
  /** Restliche Lebensdauer eines Gebaeudes in Ticks, sonst -1. */
  lebensdauerRest: number;
  /** Ticks bis zur naechsten Spawnwelle, sonst -1. */
  spawnCd: number;
  /** Was ein Spawner erzeugt. */
  spawnKarte: string;
  spawnAnzahl: number;

  /** Ticks bis zur Handlungsfaehigkeit nach dem Absetzen. */
  deployRest: number;
  /** Verbleibende Ticks einer Verlangsamung. */
  bremseRest: number;
  /** Rest-Tempo in Promille, solange bremseRest laeuft. */
  bremsePromille: number;

  zielArt: ZielArt;
  zielIndex: number;
  /** id des Ziels - schuetzt vor einem inzwischen neu belegten Platz. */
  zielId: number;

  /** Ist die Bruecke bereits ueberquert? Steuert den Wegpunkt. */
  ueberFluss: boolean;
  /** Auf welche Bruecke die Einheit zulaeuft. */
  brueckeX: number;

  /* Fuer den Renderer: Blickrichtung und letzter Treffer. Die Sim
     selbst liest beides nie - sie stehen hier, weil sie sonst in
     einer zweiten Struktur mitgefuehrt werden muessten, die bei
     jedem Tod neu zu pflegen waere. */
  blickX: number;
  blickY: number;
  /** Tick des letzten erlittenen Treffers. */
  getroffenTick: number;
}

export interface Turm {
  spieler: Spieler;
  art: TurmArt;
  /** Nur bei Seitentuermen gesetzt. Bestimmt das freigeschaltete Viertel. */
  flanke: Flanke | null;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  radius: number;
  dmg: number;
  angriffsTakt: number;
  angriffCd: number;
  reichweite: number;
  /** Der Koenig schlaeft, bis er Schaden nimmt oder eine Flanke faellt. */
  wach: boolean;
  zielIndex: number;
  zielId: number;
  getroffenTick: number;
  /** Tick des Einsturzes - der Renderer braucht ihn fuer die Animation. */
  gefallenTick: number;
}

export interface Projektil {
  aktiv: boolean;
  spieler: Spieler;
  x: number;
  y: number;
  /** Zielpunkt. Geschosse fliegen auf einen Ort, nicht auf ein Objekt -
      sonst verschwaende ein Treffer, dessen Ziel vorher stirbt. */
  zielX: number;
  zielY: number;
  tempo: number;
  dmg: number;
  schadensTyp: SchadensTyp;
  flaechenRadius: number;
  zieltAuf: Zielt;
  /** Optische Groesse - reine Renderer-Angabe. */
  radius: number;
  farbe: string;
}

/** Was ein Spieler an Vorrat und Karten hat. */
export interface SpielerState {
  /** Ganze Elixirpunkte, 0 bis ELIXIR.cap. */
  elixir: number;
  /** Zaehler zum naechsten Punkt, 0 bis ELIXIR.ticksProPunkt. */
  elixirRest: number;
  /** Die acht Karten des Decks, in Reihenfolge der Zyklus-Warteschlange. */
  deck: string[];
  /** Kartenlevel je Karten-Id. */
  level: Record<string, number>;
  /** Die vier Karten auf der Hand. */
  hand: string[];
  /** Warteschlange - vorne steht die naechste Karte. */
  queue: string[];
  /** Flanken, deren gegnerischer Seitenturm gefallen ist. */
  offeneFlanken: Flanke[];
  /** Wie viele gegnerische Tuerme dieser Spieler zerstoert hat. */
  tuermeZerstoert: number;
}

export type MatchPhase = 'countdown' | 'laeuft' | 'overtime' | 'ende';

export type Ausgang = 'sieg0' | 'sieg1' | 'unentschieden';

export interface MatchState {
  /** Vergangene Ticks seit Matchbeginn. */
  tick: number;
  phase: MatchPhase;
  /** Seed des Matches - gehoert zum Zustand, damit er mitwandert. */
  seed: number;
  rng: RngState;

  einheiten: Einheit[];
  /** Freie Plaetze im Einheitenfeld, oberster zuerst. */
  freieEinheiten: number[];
  projektile: Projektil[];
  freieProjektile: number[];

  tuerme: Turm[];
  spieler: [SpielerState, SpielerState];

  /** Naechste zu vergebende Einheiten-id. */
  naechsteId: number;
  ausgang: Ausgang | null;

  /* Ereignisse eines Ticks - der Renderer liest sie aus und leert sie
     nicht; das macht die Sim beim naechsten Tick selbst. Sie stehen
     bewusst im State und nicht in einem Callback: ein Callback waere
     eine Verbindung nach draussen, und die Sim soll keine haben. */
  ereignisse: Ereignis[];
}

/** Was in diesem Tick passiert ist. Rein zum Anzeigen und Vertonen. */
export interface Ereignis {
  art: 'deploy' | 'treffer' | 'tod' | 'turmfall' | 'zauber';
  spieler: Spieler;
  x: number;
  y: number;
  /** Bei 'zauber' der Wirkradius, bei 'tod' der Einheitenradius. */
  radius: number;
  karte: string;
}
