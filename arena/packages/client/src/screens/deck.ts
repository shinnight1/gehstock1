/* ------------------------------------------------------------------
   Deckbau.

   Oben die acht Plaetze, darunter alles, was man besitzt. Tippen legt
   hinein oder nimmt heraus. Fertig ist das Deck erst mit acht Karten -
   ohne das startet kein Match, und der Knopf sagt auch warum.

   Angezeigt werden nur besessene Karten. Ein Deckbau, in dem man
   Karten sieht, die man nicht setzen kann, ist eine Werbeflaeche und
   kein Werkzeug.
   ------------------------------------------------------------------ */

import { karteVon, DECK } from '@arena/sim';
import { besessene, besitzVon, deckGueltig } from '@arena/meta';
import { el, kopf } from '../ui/dom.js';
import { kartenKachel } from '../ui/kartenkachel.js';
import type { App, Schirm } from '../app.js';

export function deckBauen(wurzel: HTMLElement, app: App): Schirm {
  const seite = el('div.a-schirm.a-deckbau');
  wurzel.appendChild(seite);

  function schnitt(): string {
    const deck = app.profil.deck;
    if (!deck.length) return '–';
    const summe = deck.reduce((n, id) => n + (karteVon(id)?.elixir ?? 0), 0);
    return (summe / deck.length).toFixed(2).replace('.', ',');
  }

  function aufbauen(): void {
    seite.textContent = '';
    const p = app.profil;
    const fertig = deckGueltig(p);

    seite.appendChild(kopf('Deck', () => app.gehe('menu'),
      el('span.a-zaehler', { text: p.deck.length + ' / ' + DECK.groesse })));

    // Die acht Plaetze. Leere bleiben als Luecke sichtbar.
    const plaetze = el('div.a-deck-plaetze');
    for (let i = 0; i < DECK.groesse; i++) {
      const id = p.deck[i];
      if (id) {
        plaetze.appendChild(kartenKachel(id, {
          besitz: besitzVon(p, id),
          tippen: () => {
            app.aendern((prof) => {
              const stelle = prof.deck.indexOf(id);
              if (stelle >= 0) prof.deck.splice(stelle, 1);
            });
            aufbauen();
          },
        }));
      } else {
        plaetze.appendChild(el('div.a-platz-leer', { text: '+' }));
      }
    }
    seite.appendChild(plaetze);

    seite.appendChild(el('div.a-deck-info', {}, [
      el('span', { text: 'Elixir im Schnitt: ' + schnitt() }),
      el('button.a-klein' + (fertig ? '' : '.warnt'), {
        text: fertig ? 'Fertig' : 'Noch ' + (DECK.groesse - p.deck.length) + ' Karten',
        tippen: () => { if (fertig) app.gehe('menu'); },
      }),
    ]));

    seite.appendChild(el('div.a-gruppe', { text: 'Deine Karten' }));

    const eigene = besessene(p);
    if (!eigene.length) {
      seite.appendChild(el('div.a-hinweis', {
        text: 'Du besitzt noch keine Karten. Löse deine Rolls ein.',
      }));
      return;
    }

    const raster = el('div.a-raster');
    /* Nach Elixir sortiert, nicht nach Seltenheit: beim Deckbau
       entscheidet man ueber Kosten, nicht ueber Sammelwert. */
    for (const id of eigene.slice().sort(
      (a, b) => (karteVon(a)?.elixir ?? 0) - (karteVon(b)?.elixir ?? 0),
    )) {
      const drin = p.deck.includes(id);
      raster.appendChild(kartenKachel(id, {
        besitz: besitzVon(p, id),
        gedaempft: drin,
        gewaehlt: drin,
        tippen: () => {
          app.aendern((prof) => {
            const stelle = prof.deck.indexOf(id);
            if (stelle >= 0) prof.deck.splice(stelle, 1);
            else if (prof.deck.length < DECK.groesse) prof.deck.push(id);
          });
          aufbauen();
        },
      }));
    }
    seite.appendChild(raster);
  }

  aufbauen();
  return { zerstoeren() { seite.remove(); } };
}
