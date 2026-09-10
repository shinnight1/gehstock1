/* ------------------------------------------------------------------
   Hauptmenue.

   Oben der Trophaeenstand mit der Arena, in der man steht, und dem
   Weg zur naechsten. Darunter der grosse Knopf zum Spielen, dann die
   Nebenwege. Die Rolls stehen mit Zahl daneben - offene Rolls sind
   der Grund, warum man zurueckkommt, und muessen ohne Suchen zu
   sehen sein.

   Kein Kaufknopf, keine Waehrung, kein Angebot. Rolls entstehen
   ausschliesslich durch gespielte Matches.
   ------------------------------------------------------------------ */

import { arenaFuer, ARENEN, DECK } from '@arena/sim';
import { deckGueltig, sammlungsStand } from '@arena/meta';
import { KARTEN_IDS } from '@arena/sim';
import { el, zahl } from '../ui/dom.js';
import type { App, Schirm } from '../app.js';

export function menuBauen(wurzel: HTMLElement, app: App): Schirm {
  const p = app.profil;
  const arena = arenaFuer(p.trophaeen);
  const naechste = ARENEN.find((a) => a.ab > p.trophaeen);
  const stand = sammlungsStand(p, KARTEN_IDS);
  const spielbar = deckGueltig(p);

  const fortschritt = naechste
    ? Math.max(0, Math.min(1, (p.trophaeen - arena.ab) / (naechste.ab - arena.ab)))
    : 1;

  const seite = el('div.a-schirm.a-menu', {}, [
    el('div.a-kopfzeile', {}, [
      el('button.a-zurueck', {
        text: '‹', attr: { 'aria-label': 'Zurück zur Übersicht' },
        tippen: () => app.verlassen(),
      }),
      el('div.a-marke', { text: 'ARENA' }),
      el('div.a-rolls-oben', {}, [
        el('span.a-rolls-zahl', { text: String(p.rolls) }),
        el('span.a-rolls-wort', { text: p.rolls === 1 ? 'Roll' : 'Rolls' }),
      ]),
    ]),

    el('div.a-trophaeen', {}, [
      el('div.a-tro-zeile', {}, [
        el('span.a-tro-zahl', { text: zahl(p.trophaeen) }),
        el('span.a-tro-wort', { text: 'Trophäen' }),
      ]),
      el('div.a-arena-name', {
        text: naechste
          ? arena.name + ' · noch ' + zahl(naechste.ab - p.trophaeen) + ' bis ' + naechste.name
          : arena.name + ' · höchste Arena',
      }),
      el('div.a-balken', {}, [
        el('div.a-balken-fuell', { stil: { width: (fortschritt * 100).toFixed(1) + '%' } }),
      ]),
    ]),

    el('div.a-hauptknopf-reihe', {}, [
      el('button.a-gross', {
        text: spielbar ? 'Spielen' : 'Deck vervollständigen',
        tippen: () => app.gehe(spielbar ? 'match' : 'deck'),
      }),
      /* Das Freundesduell steht kleiner darunter: es braucht einen
         zweiten Spieler und einen erreichbaren Server, taugt also
         nicht als Einstieg. */
      spielbar ? el('button.a-gross.zweit', {
        text: 'Gegen einen Freund',
        tippen: () => app.gehe('online'),
      }) : null,
    ]),

    el('div.a-kacheln', {}, [
      kachel('Sammlung', stand.besessen + ' von ' + stand.gesamt + ' Karten',
        () => app.gehe('sammlung')),
      kachel('Deck', spielbar ? p.deck.length + ' Karten' : 'unvollständig',
        () => app.gehe('deck'), !spielbar),
      kachel('Rolls', p.rolls > 0
        ? p.rolls + (p.rolls === 1 ? ' offener Roll' : ' offene Rolls')
        : 'Spiel ein Match', () => app.gehe('roll'), false, p.rolls > 0),
      kachel('Optionen', 'Ton, Grafik, Daten', () => app.gehe('optionen')),
    ]),

    statistik(p.siege, p.niederlagen, p.unentschieden, p.bestwert),
    historie(p.historie),
  ]);

  wurzel.appendChild(seite);
  return { zerstoeren() { seite.remove(); } };
}

function kachel(
  titel: string, unter: string, tippen: () => void,
  warnen = false, hervor = false,
): HTMLElement {
  return el('button.a-kachel' + (warnen ? '.warnt' : '') + (hervor ? '.hervor' : ''),
    { tippen }, [
      el('div.a-kachel-titel', { text: titel }),
      el('div.a-kachel-unter', { text: unter }),
    ]);
}

function statistik(
  siege: number, niederlagen: number, remis: number, best: number,
): HTMLElement {
  const gesamt = siege + niederlagen + remis;
  const quote = gesamt > 0 ? Math.round((siege / gesamt) * 100) : 0;
  return el('div.a-statistik', {}, [
    zelle(String(siege), 'Siege'),
    zelle(String(niederlagen), 'Niederlagen'),
    zelle(gesamt > 0 ? quote + ' %' : '–', 'Siegquote'),
    zelle(zahl(best), 'Bestwert'),
  ]);
}

function zelle(wert: string, wofuer: string): HTMLElement {
  return el('div.a-stat', {}, [
    el('div.a-stat-wert', { text: wert }),
    el('div.a-stat-wofuer', { text: wofuer }),
  ]);
}

/** Die letzten Partien als Streifen. Leer, wenn noch nichts gespielt wurde. */
function historie(liste: readonly { ausgang: string; trophaeen: number }[]): HTMLElement {
  if (!liste.length) {
    return el('div.a-historie-leer', {
      text: 'Noch kein Match gespielt. Jedes beendete Match bringt einen Roll, ein Sieg zwei.',
    });
  }
  return el('div.a-historie', {},
    liste.slice(0, DECK.groesse * 3).map((n) => el(
      'span.a-h-punkt.' + (n.ausgang === 'sieg' ? 'sieg'
        : n.ausgang === 'niederlage' ? 'nieder' : 'remis'),
      {
        attr: {
          title: (n.trophaeen >= 0 ? '+' : '') + n.trophaeen + ' Trophäen',
        },
      },
    )));
}
