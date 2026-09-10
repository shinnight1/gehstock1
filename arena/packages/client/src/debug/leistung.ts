/* ------------------------------------------------------------------
   Bildrate messen und im Notfall die Aufloesung senken.

   Ziel sind stabile 60 FPS mit 40 Einheiten. Reicht es nicht, ist die
   Fuellrate der erste Verdaechtige - bei devicePixelRatio 2 rechnet
   das iPad die vierfache Pixelmenge. Faellt der Schnitt drei Sekunden
   lang unter 50 FPS, geht die Dichte eine Stufe herunter. Das ist
   deutlich besser als Ruckeln und faellt im Spiel kaum auf.

   Heruntergeschaltet wird hoechstens zweimal, und nie wieder hinauf:
   ein staendiges Hin und Her waere sichtbarer als die niedrigere
   Aufloesung.
   ------------------------------------------------------------------ */

export interface Leistung {
  /** Pro Bild aufrufen. dtMs ist der Abstand zum vorigen Bild. */
  messen(dtMs: number): void;
  fps(): number;
  stufe(): number;
  zuruecksetzen(): void;
}

const ZIEL_FPS = 50;
const FENSTER_MS = 3000;
const MAX_STUFEN = 2;

export function leistungUeberwachen(
  herunterschalten: (stufe: number) => void,
): Leistung {
  let schnitt = 60;
  let schlechtSeit = 0;
  let stufe = 0;

  return {
    messen(dtMs: number): void {
      if (dtMs <= 0 || dtMs > 500) return; // Tab-Wechsel nicht mitzaehlen
      const jetzt = 1000 / dtMs;
      // Gleitender Schnitt, traege genug gegen einzelne Aussetzer.
      schnitt += (jetzt - schnitt) * 0.05;

      if (stufe >= MAX_STUFEN) return;
      if (schnitt < ZIEL_FPS) {
        schlechtSeit += dtMs;
        if (schlechtSeit >= FENSTER_MS) {
          stufe++;
          schlechtSeit = 0;
          schnitt = 60; // Nach dem Schalten neu beurteilen
          herunterschalten(stufe);
        }
      } else {
        schlechtSeit = 0;
      }
    },
    fps: () => schnitt,
    stufe: () => stufe,
    zuruecksetzen() { schnitt = 60; schlechtSeit = 0; },
  };
}

/** Ist ?debug=1 gesetzt? Gilt auch fuer die Adresse des iframes. */
export function debugAn(): boolean {
  try {
    return new URLSearchParams(location.search).get('debug') === '1';
  } catch {
    return false;
  }
}
