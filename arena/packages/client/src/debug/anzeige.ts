/* ------------------------------------------------------------------
   Diagnosefeld hinter ?debug=1.

   Der Text wird viermal pro Sekunde erneuert, nicht pro Bild: eine
   DOM-Schreibaktion in der Zeichenschleife kostet auf dem iPad mehr
   als das halbe Spielfeld.
   ------------------------------------------------------------------ */

export interface DebugAnzeige {
  setzen(zeilen: string[]): void;
  zerstoeren(): void;
}

const INTERVALL_MS = 250;

export function debugAnzeigeAnlegen(wurzel: HTMLElement): DebugAnzeige {
  const feld = document.createElement('div');
  feld.className = 'arena-debug';
  wurzel.appendChild(feld);

  let letzte = 0;

  return {
    setzen(zeilen: string[]): void {
      const jetzt = performance.now();
      if (jetzt - letzte < INTERVALL_MS) return;
      letzte = jetzt;
      feld.textContent = zeilen.join('\n');
    },
    zerstoeren() { feld.remove(); },
  };
}
