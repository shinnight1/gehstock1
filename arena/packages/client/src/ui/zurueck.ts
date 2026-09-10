/* ------------------------------------------------------------------
   Rueckweg aus der Arena.

   Drei Lagen, je nachdem wie das Spiel eingebunden ist:

     1. Als Modul mit mount(el, { onExit })  -> onExit wird gerufen
     2. In einem iframe                      -> postMessage nach oben
     3. Als eigene Seite                      -> zurueck im Verlauf

   Der Verlauf ist der wichtige Fall: er kommt ohne jede Annahme
   darueber aus, unter welcher Adresse die Hub-Seite liegt. Nur wenn
   es keinen Verlauf gibt - jemand hat die Adresse direkt eingegeben -
   greift ein Pfad, und der laesst sich per ?zurueck= setzen.
   ------------------------------------------------------------------ */

const NOTAUSGANG = '../../';

export interface ZurueckKnopf {
  zerstoeren(): void;
}

export function zurueckKnopfAnlegen(
  wurzel: HTMLElement, onExit?: () => void,
): ZurueckKnopf {
  const knopf = document.createElement('button');
  knopf.type = 'button';
  knopf.className = 'arena-zurueck';
  knopf.textContent = '‹ Zurück';
  knopf.setAttribute('aria-label', 'Zurück zur Übersicht');

  /* Pointer statt Click: auf dem iPad kostet click rund 300 ms
     Wartezeit, weil Safari erst auf einen Doppeltipp prueft. */
  const gehen = (e: Event): void => {
    e.preventDefault();
    if (onExit) { onExit(); return; }
    if (window.parent !== window) {
      try {
        window.parent.postMessage({ quelle: 'arena', typ: 'arena:exit' }, '*');
        return;
      } catch {
        /* Blockiert - dann eben ueber den Verlauf. */
      }
    }
    if (window.history.length > 1) { window.history.back(); return; }
    let ziel = NOTAUSGANG;
    try {
      const gewuenscht = new URLSearchParams(location.search).get('zurueck');
      // Nur relative Pfade zulassen - keine fremde Adresse von aussen.
      if (gewuenscht && !/^[a-z]+:|^\/\//i.test(gewuenscht)) ziel = gewuenscht;
    } catch {
      /* Adresszeile unlesbar - Notausgang genuegt. */
    }
    location.href = ziel;
  };

  knopf.addEventListener('pointerup', gehen);
  wurzel.appendChild(knopf);

  return {
    zerstoeren() {
      knopf.removeEventListener('pointerup', gehen);
      knopf.remove();
    },
  };
}
