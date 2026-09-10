/* ------------------------------------------------------------------
   Die Anwendung: Profil halten, zwischen Bildschirmen wechseln.

   Ein Bildschirm baut sich in ein leeres Element, gibt ein Objekt mit
   `zerstoeren` zurueck und meldet sich nie selbst ab. Gewechselt wird
   ausschliesslich hier - so kann kein Bildschirm einen anderen
   ueberleben und im Hintergrund weiterlaufen.

   Das Profil liegt im Speicher und wird nach jeder Aenderung
   gesichert. Automatisch, nicht auf Zuruf: ein Roll, den man
   gesehen hat und der nach einem Neustart weg ist, ist schlimmer als
   jede Wartezeit.
   ------------------------------------------------------------------ */

import { karteVon, DECK } from '@arena/sim';
import {
  profilAnlegen, deckAuffuellen, erstpaketVergeben, speicherAnlegen,
  browserAblage, rollsZiehen, deckGueltig,
} from '@arena/meta';
import type { Profil, Speicher } from '@arena/meta';
import { klangAnlegen } from './audio/klang.js';
import type { Klang } from './audio/klang.js';

export interface Schirm {
  zerstoeren(): void;
}

export type SchirmName =
  'menu' | 'match' | 'online' | 'ende' | 'sammlung' | 'deck' | 'roll' | 'optionen';

export interface App {
  readonly profil: Profil;
  /** Aendert das Profil und sichert es. */
  aendern(was: (p: Profil) => void): void;
  /** Bildschirm wechseln. `daten` reicht Zustand an den neuen weiter. */
  gehe(ziel: SchirmName, daten?: unknown): void;
  /** Zuletzt uebergebene Daten - vom Ziel-Bildschirm gelesen. */
  daten(): unknown;
  /** Verlaesst das Spiel Richtung Hub. */
  verlassen(): void;
  /** Optionen, die nicht ins Profil gehoeren. */
  readonly optionen: Optionen;
  optionenSetzen(neu: Partial<Optionen>): void;
  /** Ton. Wird beim ersten Tipp von selbst freigegeben. */
  readonly klang: Klang;
  /**
   * Serveradresse aus mount(), falls die Hub-Seite eine gesetzt hat.
   *
   * Wird nie aus `location` hergeleitet: der Build darf nichts ueber
   * die Domain annehmen, unter der er eingebettet ist.
   */
  readonly serverUrl?: string | undefined;
}

export interface Optionen {
  sound: boolean;
  screenshake: boolean;
  /** Roll-Animation ueberspringen. */
  ohneAnimation: boolean;
  /** 0 = voll, 1 = mittel, 2 = sparsam. */
  grafik: number;
}

const OPTIONEN_SCHLUESSEL = 'arena.optionen.v1';

function optionenLaden(): Optionen {
  const grund: Optionen = {
    sound: true, screenshake: true, ohneAnimation: false, grafik: 0,
  };
  try {
    const text = globalThis.localStorage?.getItem(OPTIONEN_SCHLUESSEL);
    if (!text) return grund;
    const roh = JSON.parse(text) as Partial<Optionen>;
    return {
      sound: roh.sound !== false,
      screenshake: roh.screenshake !== false,
      ohneAnimation: roh.ohneAnimation === true,
      grafik: typeof roh.grafik === 'number' ? Math.max(0, Math.min(2, roh.grafik)) : 0,
    };
  } catch {
    return grund;
  }
}

function optionenSichern(o: Optionen): void {
  try {
    globalThis.localStorage?.setItem(OPTIONEN_SCHLUESSEL, JSON.stringify(o));
  } catch {
    /* Kein Speicher - dann gelten sie nur diese Sitzung. */
  }
}

export interface AppOptionen {
  onExit?: () => void;
  serverUrl?: string;
}

export type SchirmBauer = (wurzel: HTMLElement, app: App) => Schirm;

export function appStarten(
  wurzel: HTMLElement,
  bauer: Record<SchirmName, SchirmBauer>,
  optionen: AppOptionen = {},
): { zerstoeren(): void } {
  const speicher: Speicher = speicherAnlegen(browserAblage());
  const seed = neuerSeed();
  let profil: Profil = speicher.laden(seed) ?? profilAnlegen(seed);

  /* Erster Start: Startpaket vergeben und gleich einloesen, damit
     sofort ein Deck steht. Der Spieler sieht die Karten spaeter im
     Roll-Bildschirm noch einmal - hier geht es nur darum, dass er
     ueberhaupt spielen kann. */
  if (erstpaketVergeben(profil)) {
    rollsZiehen(profil, DECK.groesse);
  }
  if (!deckGueltig(profil)) {
    deckAuffuellen(profil, (id) => karteVon(id)?.elixir ?? 9);
  }
  speicher.sichern(profil);

  const opt = optionenLaden();
  const klang = klangAnlegen(opt.sound);

  /* Safari gibt Ton erst nach einer echten Beruehrung frei. Ein
     Listener auf der Wurzel faengt die erste ab, egal auf welchem
     Bildschirm sie passiert, und traegt sich danach selbst aus. */
  const ersteBeruehrung = (): void => {
    klang.freigeben();
    wurzel.removeEventListener('pointerdown', ersteBeruehrung);
  };
  wurzel.addEventListener('pointerdown', ersteBeruehrung);

  let aktuell: Schirm | null = null;
  let uebergabe: unknown = null;

  const app: App = {
    get profil() { return profil; },
    get optionen() { return opt; },

    aendern(was) {
      was(profil);
      speicher.sichern(profil);
    },

    gehe(ziel, daten) {
      uebergabe = daten ?? null;
      wechseln(ziel);
    },

    daten() { return uebergabe; },

    verlassen() {
      if (optionen.onExit) { optionen.onExit(); return; }
      if (window.parent !== window) {
        try {
          window.parent.postMessage({ quelle: 'arena', typ: 'arena:exit' }, '*');
          return;
        } catch { /* blockiert - dann ueber den Verlauf */ }
      }
      if (window.history.length > 1) window.history.back();
      else location.href = '../../';
    },

    optionenSetzen(neu) {
      Object.assign(opt, neu);
      optionenSichern(opt);
      if (neu.sound !== undefined) klang.an(neu.sound);
    },

    get klang() { return klang; },
    get serverUrl() { return optionen.serverUrl; },
  };

  function wechseln(ziel: SchirmName): void {
    if (aktuell) {
      try { aktuell.zerstoeren(); } catch { /* Ein kaputter Bildschirm
        darf den naechsten nicht blockieren. */ }
      aktuell = null;
    }
    wurzel.textContent = '';
    aktuell = bauer[ziel](wurzel, app);
  }

  wechseln('menu');

  return {
    zerstoeren() {
      if (aktuell) {
        try { aktuell.zerstoeren(); } catch { /* egal */ }
        aktuell = null;
      }
      wurzel.removeEventListener('pointerdown', ersteBeruehrung);
      klang.zerstoeren();
      wurzel.textContent = '';
    },
  };
}

/**
 * Startwert fuer ein neues Profil.
 *
 * Die einzige Stelle im Projekt, an der echter Zufall hineindarf -
 * alles andere rechnet deterministisch weiter. crypto, wo vorhanden;
 * sonst die Uhr, was fuer eine Kennung reicht.
 */
function neuerSeed(): number {
  try {
    const feld = new Uint32Array(1);
    globalThis.crypto?.getRandomValues(feld);
    if (feld[0]) return feld[0]! & 0x7fffffff;
  } catch {
    /* Kein crypto - die Uhr tut es auch. */
  }
  return (Date.now() ^ Math.trunc(performance.now() * 1000)) & 0x7fffffff;
}
