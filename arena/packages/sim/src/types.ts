/* ------------------------------------------------------------------
   Grundtypen der Simulation.

   Alle Laengen sind Millitiles (siehe fixed.ts), alle Zeiten sind
   Ticks. In diesem Package kommt kein Wert in Sekunden, Pixeln oder
   Millisekunden vor - solche Einheiten gehoeren in Renderer und UI.
   ------------------------------------------------------------------ */

/** 0 = untere Seite (im lokalen Spiel der Mensch), 1 = obere Seite. */
export type Spieler = 0 | 1;

export function gegner(s: Spieler): Spieler {
  return s === 0 ? 1 : 0;
}

/** Welche Ziele eine Einheit ueberhaupt angreifen kann. */
export type Zielt = 'boden' | 'luft' | 'beides' | 'nur_gebaeude';

/** Wo sich eine Einheit bewegt. Luft ignoriert Fluss und Kollision. */
export type Ebene = 'boden' | 'luft';

export type SchadensTyp = 'einzel' | 'flaeche';

export type Seltenheit = 'gewoehnlich' | 'selten' | 'episch' | 'legendaer';

/** Was ein Kartenslot beim Ausspielen erzeugt. */
export type KartenArt = 'einheit' | 'gebaeude' | 'zauber';

/** Turmsorten. Der Koenig wird erst nach einem Treffer aktiv. */
export type TurmArt = 'koenig' | 'seite';

/** Seite eines Seitenturms - bestimmt zugleich das freigeschaltete Viertel. */
export type Flanke = 'links' | 'rechts';
