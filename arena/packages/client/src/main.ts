/* ------------------------------------------------------------------
   Einstiegspunkt und Einbettungs-Schnittstelle.

   Zwei Wege hinein:

   1. Als eigene Seite unter /games/arena/ - dann findet der Bootstrap
      unten das Wurzelelement selbst und startet.
   2. Als Modul in der Hub-Seite:
        import { mount, unmount } from '.../arena.js';
        mount(element, { serverUrl, onExit });

   In beiden Faellen wird nichts ausserhalb des uebergebenen Elements
   angefasst: keine Regel auf body, keine globalen Ereignisse, kein
   Wissen ueber die Domain der Hub-Seite.
   ------------------------------------------------------------------ */

import './style.css';
import './menu.css';
import { appStarten } from './app.js';
import type { AppOptionen, SchirmName, SchirmBauer } from './app.js';
import { menuBauen } from './screens/menu.js';
import { matchBauen } from './screens/match.js';
import { endeBauen } from './screens/ende.js';
import { sammlungBauen } from './screens/sammlung.js';
import { deckBauen } from './screens/deck.js';
import { rollBauen } from './screens/roll.js';
import { optionenBauen } from './screens/optionen.js';
import { onlineBauen } from './screens/online.js';

const BAUER: Record<SchirmName, SchirmBauer> = {
  menu: menuBauen,
  match: matchBauen,
  online: onlineBauen,
  ende: endeBauen,
  sammlung: sammlungBauen,
  deck: deckBauen,
  roll: rollBauen,
  optionen: optionenBauen,
};

let laufend: { app: { zerstoeren(): void }; wurzel: HTMLElement; eigen: boolean } | null = null;

export function mount(element: HTMLElement, optionen: AppOptionen = {}): void {
  unmount();

  /* Die eigene Wurzel traegt alle Regeln. Bekommen wir ein fremdes
     Element, legen wir eine eigene darin an, statt dessen Klassen zu
     ueberschreiben. */
  const eigen = !element.classList.contains('arena-wurzel');
  const wurzel = eigen ? document.createElement('div') : element;
  if (eigen) {
    wurzel.className = 'arena-wurzel';
    // Wenn das Elternelement statisch positioniert ist, haette
    // position:absolute keinen Bezug - relative genuegt und ist die
    // einzige Eigenschaft, die wir am fremden Element setzen.
    if (getComputedStyle(element).position === 'static') {
      element.style.position = 'relative';
    }
    element.appendChild(wurzel);
  }

  const app = appStarten(wurzel, BAUER, optionen);
  laufend = { app, wurzel, eigen };
  melden('arena:bereit');
}

export function unmount(): void {
  if (!laufend) return;
  laufend.app.zerstoeren();
  if (laufend.eigen) laufend.wurzel.remove();
  laufend = null;
}

/** Nachricht an das umgebende Fenster, falls wir in einem iframe stecken. */
function melden(typ: string): void {
  if (window.parent === window) return;
  try {
    // Kein fester Empfaenger: die Hub-Seite darf auf jeder Domain liegen.
    window.parent.postMessage({ quelle: 'arena', typ }, '*');
  } catch {
    /* Ein blockiertes postMessage ist kein Grund, das Spiel anzuhalten. */
  }
}

/* --------------------------- Bootstrap ---------------------------- */

const wurzel = document.getElementById('arena-wurzel');
if (wurzel) {
  const serverUrl = new URLSearchParams(location.search).get('server') ?? '';
  /* Im Standalone-Betrieb darf die Serveradresse per Adresszeile
     gesetzt werden - so laesst sich vom iPad gegen einen beliebigen
     Rechner im WLAN testen, ohne neu zu bauen. */
  mount(wurzel, serverUrl ? { serverUrl } : {});
}
