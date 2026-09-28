/* ------------------------------------------------------------------
   Einstieg von Gehstock Ops.

   Startet die App, sobald die Seite steht. Scheitert schon der Start
   (fehlendes WebGL, ein Fehler beim Aufbau), zeigt der Ladebildschirm
   aus index.html eine verstaendliche Meldung mit Rueckweg.
   ------------------------------------------------------------------ */

import { App } from './app.js';

function starten() {
  const wurzel = document.getElementById('ops');
  try {
    const app = new App(wurzel);
    // Fuer automatische Tests im Browser (nur lesend verwendet).
    window.__ops = app;
    app.starten();
  } catch (e) {
    console.error(e);
    window.__opsGestartet = false;
    if (window.__opsFehlerAnzeigen) {
      window.__opsFehlerAnzeigen('Das Spiel konnte nicht starten (' + ((e && e.message) || e) + '). Bitte neu laden.');
    }
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', starten);
else starten();
