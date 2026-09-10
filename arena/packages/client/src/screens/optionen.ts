/* ------------------------------------------------------------------
   Optionen.

   Wenige Schalter, alle mit sichtbarer Wirkung. "Animationen
   ueberspringen" ist der wichtigste: er macht aus der Roll-Sequenz
   einen sofortigen Reveal und ist damit die Antwort auf jedes
   Geraet, das die Animation nicht fluessig schafft.

   Ganz unten der Weg, alles zu loeschen. Bewusst mit Rueckfrage und
   bewusst nicht versteckt - es ist der eigene Spielstand, und wer ihn
   loswerden will, soll das ohne Umwege koennen.
   ------------------------------------------------------------------ */

import { el, kopf, zahl } from '../ui/dom.js';
import type { App, Schirm } from '../app.js';

export function optionenBauen(wurzel: HTMLElement, app: App): Schirm {
  const seite = el('div.a-schirm.a-optionen');
  wurzel.appendChild(seite);

  function aufbauen(): void {
    seite.textContent = '';
    const o = app.optionen;
    const p = app.profil;

    seite.appendChild(kopf('Optionen', () => app.gehe('menu')));

    seite.appendChild(el('div.a-gruppe', { text: 'Darstellung' }));
    seite.appendChild(schalter('Ton', o.sound, (an) => {
      app.optionenSetzen({ sound: an });
      aufbauen();
    }));
    seite.appendChild(schalter('Bildschirmwackeln', o.screenshake, (an) => {
      app.optionenSetzen({ screenshake: an });
      aufbauen();
    }));
    seite.appendChild(schalter('Animationen überspringen', o.ohneAnimation, (an) => {
      app.optionenSetzen({ ohneAnimation: an });
      aufbauen();
    }, 'Rolls zeigen sofort das Ergebnis, ohne Flug und Aufprall.'));

    seite.appendChild(el('div.a-gruppe', { text: 'Grafik' }));
    seite.appendChild(el('div.a-wahl', {}, ['Voll', 'Mittel', 'Sparsam'].map(
      (name, i) => el('button.a-wahl-knopf' + (o.grafik === i ? '.an' : ''), {
        text: name,
        tippen: () => { app.optionenSetzen({ grafik: i }); aufbauen(); },
      }),
    )));
    seite.appendChild(el('div.a-hinweis.a-leise', {
      text: 'Das Spiel senkt die Auflösung ohnehin selbst, wenn die Bildrate '
        + 'länger unter 50 fällt. Diese Einstellung setzt den Startwert.',
    }));

    seite.appendChild(el('div.a-gruppe', { text: 'Dein Stand' }));
    seite.appendChild(el('div.a-werte', {}, [
      wert('Kennung', p.id),
      wert('Trophäen', zahl(p.trophaeen)),
      wert('Bestwert', zahl(p.bestwert)),
      wert('Rolls gezogen', zahl(p.rollsGesamt)),
      wert('Karten', String(Object.keys(p.karten).length)),
    ]));

    seite.appendChild(el('button.a-klein.a-gefahr', {
      text: 'Alles zurücksetzen',
      tippen: bestaetigen,
    }));
  }

  function bestaetigen(): void {
    const blatt = el('div.a-blatt');
    const zu = (): void => { blatt.remove(); };
    blatt.appendChild(el('div.a-blatt-hintergrund', { tippen: zu }));
    blatt.appendChild(el('div.a-blatt-inhalt', {}, [
      el('h2', { text: 'Wirklich alles löschen?' }),
      el('p.a-blatt-text', {
        text: 'Karten, Level, Trophäen und Rolls sind danach weg. '
          + 'Das lässt sich nicht rückgängig machen.',
      }),
      el('button.a-gross.a-gefahr', {
        text: 'Ja, löschen',
        tippen: () => {
          try { globalThis.localStorage?.clear(); } catch { /* kein Speicher */ }
          location.reload();
        },
      }),
      el('button.a-schliessen', { text: 'Abbrechen', tippen: zu }),
    ]));
    seite.appendChild(blatt);
  }

  aufbauen();
  return { zerstoeren() { seite.remove(); } };
}

function schalter(
  titel: string, an: boolean, setzen: (an: boolean) => void, unter?: string,
): HTMLElement {
  return el('div.a-schalter' + (an ? '.an' : ''), {
    tippen: () => setzen(!an),
    attr: { role: 'switch', 'aria-checked': an ? 'true' : 'false', tabindex: '0' },
  }, [
    el('div.a-schalter-text', {}, [
      el('div.a-schalter-titel', { text: titel }),
      unter ? el('div.a-schalter-unter', { text: unter }) : null,
    ]),
    el('div.a-schalter-knebel', {}, [el('div.a-knebel')]),
  ]);
}

function wert(was: string, inhalt: string): HTMLElement {
  return el('div.a-wert', {}, [
    el('span.a-wert-was', { text: was }),
    el('span.a-wert-zahl', { text: inhalt }),
  ]);
}
