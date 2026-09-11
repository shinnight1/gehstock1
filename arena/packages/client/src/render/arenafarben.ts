/* ------------------------------------------------------------------
   Jede Arena sieht anders aus.

   Bisher war jedes Feld dasselbe gruene Rechteck - eine neue Arena
   war nur ein anderer Name unter der Fortschrittsleiste. Damit fehlte
   dem Aufstieg das, was ihn spuerbar macht: dass man ankommt.

   Geaendert werden ausschliesslich Farben, nicht die Geometrie. Das
   Feld ist ueberall achtzehn mal zweiunddreissig Kacheln, die
   Bruecken liegen ueberall gleich. Alles andere waere kein Anstrich,
   sondern eine zweite Arena mit eigener Balance - und dann muesste
   jede Karte fuer jede Arena neu gemessen werden.

   Die Farben liegen hier und nicht in @arena/sim. Die Simulation darf
   nichts ueber Aussehen wissen; sie kennt die Arena nur als Namen und
   Haertegrad.
   ------------------------------------------------------------------ */

import { FARBE } from './palette.js';

/** Die Farben, aus denen Untergrund und Fluss gebaut werden. */
export interface FeldFarben {
  rasen: string;
  rasenHell: string;
  rasenDunkel: string;
  rasenOben: string;
  rasenTupfen: string;
  rasenSchatten: string;
  erde: string;
  sand: string;
  wasserTief: string;
  wasser: string;
  wasserHell: string;
  wasserGlanz: string;
  wasserSchaum: string;
}

const GRUND: FeldFarben = {
  rasen: FARBE.rasen,
  rasenHell: FARBE.rasenHell,
  rasenDunkel: FARBE.rasenDunkel,
  rasenOben: FARBE.rasenOben,
  rasenTupfen: FARBE.rasenTupfen,
  rasenSchatten: FARBE.rasenSchatten,
  erde: FARBE.erde,
  sand: FARBE.sand,
  wasserTief: FARBE.wasserTief,
  wasser: FARBE.wasser,
  wasserHell: FARBE.wasserHell,
  wasserGlanz: FARBE.wasserGlanz,
  wasserSchaum: FARBE.wasserSchaum,
};

/* Die Reihenfolge erzaehlt eine Reise: aus der trockenen Grube ueber
   einen steinigen Hof in den Frost, dann durch Asche auf den Gipfel.
   Jede Stufe ist eine Stufe kaelter oder haerter als die davor. */
const SAETZE: Record<number, Partial<FeldFarben>> = {
  // Sandgrube - ausgetrocknet, staubig, warmes Wasser.
  0: {
    rasen: '#6f7a3c',
    rasenHell: '#7f8a45',
    rasenDunkel: '#5e6833',
    rasenOben: '#57612f',
    erde: '#8a6c3e',
    sand: '#c2a86e',
    wasserTief: '#2a5a52',
    wasser: '#3a7d6c',
    wasserHell: '#55a692',
  },

  // Bruchsteinhof - Gras zwischen Schotter, kuehler und grauer.
  1: {
    rasen: '#41694c',
    rasenHell: '#4b7756',
    rasenDunkel: '#375b42',
    rasenOben: '#2f5039',
    erde: '#5f5a52',
    sand: '#8c8578',
    wasserTief: '#14405d',
    wasser: '#1e5b7d',
    wasserHell: '#3781a4',
  },

  // Frostkanal - Raureif auf dem Gras, Eis im Fluss.
  2: {
    rasen: '#42707a',
    rasenHell: '#4f818b',
    rasenDunkel: '#376069',
    rasenOben: '#2f545d',
    rasenTupfen: 'rgba(226, 245, 255, 0.09)',
    erde: '#5b6672',
    sand: '#9fb0bd',
    wasserTief: '#1d4a72',
    wasser: '#2f74a6',
    wasserHell: '#62b2d8',
    wasserGlanz: 'rgba(226, 248, 255, 0.55)',
    wasserSchaum: 'rgba(240, 252, 255, 0.72)',
  },

  // Aschewall - verbrannter Grund, gluehendes Rinnsal.
  3: {
    rasen: '#4a4450',
    rasenHell: '#565060',
    rasenDunkel: '#3d3843',
    rasenOben: '#332f3a',
    rasenTupfen: 'rgba(255, 190, 140, 0.06)',
    rasenSchatten: 'rgba(0, 0, 0, 0.12)',
    erde: '#4e4239',
    sand: '#7a6a5c',
    wasserTief: '#5a1f14',
    wasser: '#8e3517',
    wasserHell: '#d1671f',
    wasserGlanz: 'rgba(255, 214, 150, 0.5)',
    wasserSchaum: 'rgba(255, 232, 190, 0.6)',
  },

  // Sturmspitze - Hochgebirge bei Gewitterlicht.
  4: {
    rasen: '#33505c',
    rasenHell: '#3d5f6c',
    rasenDunkel: '#2b4450',
    rasenOben: '#233a45',
    rasenTupfen: 'rgba(200, 225, 255, 0.07)',
    erde: '#46505c',
    sand: '#7e8b99',
    wasserTief: '#131f3e',
    wasser: '#22345e',
    wasserHell: '#4059a0',
    wasserGlanz: 'rgba(190, 205, 255, 0.45)',
    wasserSchaum: 'rgba(222, 232, 255, 0.6)',
  },
};

/**
 * Farbsatz einer Arena. Unbekannte Nummern bekommen den Grundsatz -
 * kommen spaeter Arenen dazu, sehen sie erst einmal normal aus,
 * statt dass irgendwo undefined landet.
 */
export function arenaFarben(id: number): FeldFarben {
  const satz = SAETZE[id];
  return satz ? { ...GRUND, ...satz } : GRUND;
}
