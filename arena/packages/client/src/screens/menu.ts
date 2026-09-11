/* ------------------------------------------------------------------
   Hauptmenue.

   Aufgebaut wie ein Spiel und nicht wie eine Einstellungsseite:

     oben    Trophaeenstand und offene Rolls als Plaketten
     mitte   die Arena selbst, darueber die Fortschrittsleiste
     darunter der grosse Knopf zum Spielen
     unten   feste Leiste mit Sammlung, Deck, Rolls, Optionen

   Der Blickfang in der Mitte ist kein gemaltes Bild, sondern das
   echte Spielfeld, gezeichnet vom Renderer des Matches (siehe
   menuszene.ts). Es kann also gar nicht veralten.

   Die Spalte ist auf gut fuenfhundert Pixel begrenzt. Ueber die
   ganze Breite gezogen sah das Menue auf einem Rechner leer aus - ein
   Spiel dieser Art ist hochkant gedacht, auch wenn das Match quer
   laeuft.

   Kein Kaufknopf, keine Waehrung, kein Angebot. Rolls entstehen
   ausschliesslich durch gespielte Matches.
   ------------------------------------------------------------------ */

import { arenaFuer, ARENEN, DECK } from '@arena/sim';
import { deckGueltig, sammlungsStand } from '@arena/meta';
import { KARTEN_IDS } from '@arena/sim';
import { el, zahl } from '../ui/dom.js';
import { menuszeneAnlegen } from './menuszene.js';
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

  const buehne = el('div.a-schaukasten-feld');

  /* Eine eigene Spalte statt einer Regel auf alle Kinder: die truege
     nur so weit, bis irgendein Kind seinen eigenen Rand setzt - und
     genau das tun Statistik und Fussleiste. */
  const spalte = el('div.a-menu-spalte', {}, [
    el('div.a-oben', {}, [
      el('button.a-zurueck', {
        text: '‹', attr: { 'aria-label': 'Zurück zur Übersicht' },
        tippen: () => app.verlassen(),
      }),
      plakette('a-p-tro', symbolPokal(), zahl(p.trophaeen), 'Trophäen'),
      plakette('a-p-roll' + (p.rolls > 0 ? '.voll' : ''), symbolRoll(),
        String(p.rolls), p.rolls === 1 ? 'Roll' : 'Rolls'),
    ]),

    el('div.a-schaukasten', {}, [
      buehne,
      el('div.a-schaukasten-schild', {}, [
        el('div.a-arena-name', { text: arena.name }),
        el('div.a-balken', {}, [
          el('div.a-balken-fuell', { stil: { width: (fortschritt * 100).toFixed(1) + '%' } }),
        ]),
        el('div.a-arena-rest', {
          text: naechste
            ? 'noch ' + zahl(naechste.ab - p.trophaeen) + ' bis ' + naechste.name
            : 'höchste Arena erreicht',
        }),
      ]),
    ]),

    el('div.a-knopfreihe', {}, [
      el('button.a-tafel' + (spielbar ? '' : '.warnt'), {
        tippen: () => app.gehe(spielbar ? 'match' : 'deck'),
      }, [
        el('span.a-tafel-gross', { text: spielbar ? 'Kampf' : 'Deck füllen' }),
        el('span.a-tafel-klein', {
          text: spielbar ? 'gegen den Bot' : p.deck.length + ' von ' + DECK.groesse,
        }),
      ]),
      spielbar ? el('button.a-tafel.zweit', { tippen: () => app.gehe('online') }, [
        el('span.a-tafel-gross', { text: 'Freund' }),
        el('span.a-tafel-klein', { text: 'mit Code' }),
      ]) : null,
    ]),

    statistik(p.siege, p.niederlagen, p.unentschieden, p.bestwert),
    historie(p.historie),

    el('div.a-leiste', {}, [
      leistenKnopf('Sammlung', stand.besessen + '/' + stand.gesamt, symbolSammlung(),
        () => app.gehe('sammlung')),
      leistenKnopf('Deck', spielbar ? 'fertig' : 'unvollständig', symbolDeck(),
        () => app.gehe('deck'), !spielbar),
      leistenKnopf('Rolls', p.rolls > 0 ? String(p.rolls) : '–', symbolRoll(),
        () => app.gehe('roll'), false, p.rolls > 0),
      leistenKnopf('Optionen', 'Ton, Grafik', symbolZahnrad(), () => app.gehe('optionen')),
    ]),
  ]);

  const seite = el('div.a-schirm.a-menu', {}, [spalte]);
  wurzel.appendChild(seite);
  // Das Menue zeigt die Arena, in der man gerade steht.
  const szene = menuszeneAnlegen(buehne, arena.id);

  return {
    zerstoeren() {
      szene.zerstoeren();
      seite.remove();
    },
  };
}

/* ----------------------------- Bausteine ---------------------------- */

/** Gerahmter Wert oben, wie eine Anzeige am Spielfeldrand. */
function plakette(
  klasse: string, symbol: Node, wert: string, wofuer: string,
): HTMLElement {
  return el('div.a-plakette.' + klasse.replace(/^\./, ''), {}, [
    symbol,
    el('div.a-p-text', {}, [
      el('div.a-p-wert', { text: wert }),
      el('div.a-p-wofuer', { text: wofuer }),
    ]),
  ]);
}

function leistenKnopf(
  titel: string, unter: string, symbol: Node, tippen: () => void,
  warnen = false, hervor = false,
): HTMLElement {
  return el('button.a-l-knopf' + (warnen ? '.warnt' : '') + (hervor ? '.hervor' : ''),
    { tippen }, [
      symbol,
      el('span.a-l-titel', { text: titel }),
      el('span.a-l-unter', { text: unter }),
    ]);
}

/* Eigene Zeichen, keine Schriftsymbole: Emoji sehen auf jedem System
   anders aus, und ein fremdes Symbolpaket waere eine Abhaengigkeit
   fuer vier Bilder. */
function svg(pfade: string, klasse = ''): HTMLElement {
  const e = document.createElement('div');
  e.className = 'a-symbol ' + klasse;
  e.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + pfade + '</svg>';
  return e;
}

function symbolPokal(): HTMLElement {
  return svg('<path d="M7 4h10v3a5 5 0 0 1-10 0V4Z"/>'
    + '<path d="M17 5h2a3 3 0 0 1-3 3M7 5H5a3 3 0 0 0 3 3"/>'
    + '<path d="M10 12h4l1 5h-6l1-5ZM8 19h8v2H8z"/>', 'gold');
}

function symbolRoll(): HTMLElement {
  // Ein Stern, der aus sich heraus leuchtet - das Zeichen fuer Rolls.
  return svg('<path d="M12 2.5 14.4 9H21l-5.3 3.9 2 6.6L12 15.6 6.3 19.5l2-6.6L3 9h6.6L12 2.5Z"/>',
    'violett');
}

function symbolSammlung(): HTMLElement {
  return svg('<path d="M4 5h6v6H4zM14 5h6v6h-6zM4 13h6v6H4zM14 13h6v6h-6z"/>');
}

function symbolDeck(): HTMLElement {
  return svg('<path d="M8 3h9a2 2 0 0 1 2 2v11H8V3Z"/><path d="M5 6h2v13h9v2H5V6Z"/>');
}

function symbolZahnrad(): HTMLElement {
  return svg('<path d="M12 8.5A3.5 3.5 0 1 0 12 15.5 3.5 3.5 0 0 0 12 8.5Z"/>'
    + '<path d="M11 2h2l.4 2.6 1.9.8 2.2-1.5 1.4 1.4-1.5 2.2.8 1.9L21 11v2l-2.6.4'
    + '-.8 1.9 1.5 2.2-1.4 1.4-2.2-1.5-1.9.8L13 22h-2l-.4-2.6-1.9-.8-2.2 1.5'
    + '-1.4-1.4 1.5-2.2-.8-1.9L3 13v-2l2.6-.4.8-1.9-1.5-2.2 1.4-1.4 2.2 1.5'
    + '1.9-.8L11 2Z"/>');
}

/* ------------------------------ Zahlen ------------------------------ */

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
