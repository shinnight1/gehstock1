/* ------------------------------------------------------------------
   Match-Ende.

   Drei Dinge in dieser Reihenfolge: wie es ausging, was es an
   Trophaeen gekostet oder gebracht hat, und was man jetzt tun kann.

   Die Trophaeenzahl zaehlt sichtbar hoch. Das ist kein Selbstzweck -
   eine Zahl, die einfach dasteht, liest man nicht, eine die laeuft,
   schon. Bei abgeschalteten Animationen steht sie sofort da.

   Der Weg zum Roll-Bildschirm steht hier gleichberechtigt neben
   "Nochmal": ein verdienter Roll soll nicht erst im Hauptmenue
   auffallen.
   ------------------------------------------------------------------ */

import { arenaFuer } from '@arena/sim';
import { el, zahl } from '../ui/dom.js';
import type { App, Schirm } from '../app.js';

export interface EndeDaten {
  ausgang: 'sieg' | 'niederlage' | 'unentschieden';
  /** Trophaeenaenderung, mit Vorzeichen. */
  aenderung: number;
  /** Stand vor dem Match - Ausgangspunkt fuer das Hochzaehlen. */
  vorher: number;
  nachher: number;
  rolls: number;
  tuerme: [number, number];
  /** Zusatzzeile, wenn das Ergebnis eine Erklaerung braucht. */
  hinweis?: string;
  /** Kein Trophaeenblock - Freundesduelle zaehlen nicht auf die Wertung. */
  ohneWertung?: boolean;
}

const TITEL = {
  sieg: 'Gewonnen',
  niederlage: 'Verloren',
  unentschieden: 'Unentschieden',
};

export function endeBauen(wurzel: HTMLElement, app: App): Schirm {
  const d = app.daten() as EndeDaten | null;
  if (!d) {
    // Direkt aufgerufen, ohne Match davor - dann zurueck ins Menue.
    app.gehe('menu');
    return { zerstoeren() { /* nichts aufzuraeumen */ } };
  }

  const arena = arenaFuer(d.nachher);
  const zahlFeld = el('div.a-ende-tro', { text: zahl(d.vorher) });
  let anforderung = 0;

  const seite = el('div.a-schirm.a-ende.' + d.ausgang, {}, [
    el('div.a-ende-titel', { text: TITEL[d.ausgang] }),
    el('div.a-ende-tuerme', {
      text: 'Türme ' + d.tuerme[0] + ' : ' + d.tuerme[1],
    }),

    d.hinweis ? el('div.a-ende-hinweis', { text: d.hinweis }) : null,

    /* Im Freundesduell steht hier nichts: es zaehlt nicht auf die
       Trophaeen, und eine grosse Null waere kein Ergebnis, sondern
       eine Enttaeuschung. */
    d.ohneWertung
      ? el('div.a-ende-block', {}, [
        el('div.a-ende-arena', { text: 'Freundesduell — zählt nicht auf die Wertung' }),
      ])
      : el('div.a-ende-block', {}, [
        zahlFeld,
        /* Null ist weder Gewinn noch Verlust und darf nicht gruen sein.
           Der Fall kommt oefter vor, als man denkt: wer bei null steht
           und verliert, faellt nicht weiter - die Untergrenze faengt
           ihn ab. */
        el('div.a-ende-diff.' + (d.aenderung > 0 ? 'plus'
          : d.aenderung < 0 ? 'minus' : 'neutral'), {
          text: d.aenderung === 0
            ? (d.ausgang === 'niederlage'
              ? 'Keine Trophäen verloren — tiefer geht es nicht'
              : 'Unentschieden, keine Änderung')
            : (d.aenderung > 0 ? '+' : '') + d.aenderung + ' Trophäen',
        }),
        el('div.a-ende-arena', { text: arena.name }),
      ]),

    el('div.a-ende-rolls', {
      text: d.rolls === 1 ? '+1 Roll verdient' : '+' + d.rolls + ' Rolls verdient',
    }),

    el('div.a-ende-knoepfe', {}, [
      el('button.a-gross', { text: 'Roll einlösen', tippen: () => app.gehe('roll') }),
      el('button.a-gross.zweit', {
        text: 'Nochmal',
        tippen: () => app.gehe(d.ohneWertung ? 'online' : 'match'),
      }),
      el('button.a-klein', { text: 'Hauptmenü', tippen: () => app.gehe('menu') }),
    ]),
  ]);

  wurzel.appendChild(seite);
  app.klang.spiel(d.ausgang === 'sieg' ? 'sieg'
    : d.ausgang === 'niederlage' ? 'niederlage' : 'tipp');

  /* Hochzaehlen. Ueber die Uhr, nicht ueber eine feste Schrittzahl:
     bei einer Aenderung von 30 sollen es dreissig Schritte sein, bei
     einer von 5 fuenf - sonst laeuft die Zahl bei kleinen Aenderungen
     unangenehm langsam. */
  const ruhig = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  if (ruhig || app.optionen.ohneAnimation || d.aenderung === 0) {
    zahlFeld.textContent = zahl(d.nachher);
  } else {
    const dauer = Math.min(900, Math.abs(d.aenderung) * 28);
    const start = performance.now();
    const schritt = (jetzt: number): void => {
      const t = Math.min(1, (jetzt - start) / dauer);
      // Am Ende auslaufen lassen.
      const weich = 1 - (1 - t) * (1 - t);
      zahlFeld.textContent = zahl(Math.round(d.vorher + (d.nachher - d.vorher) * weich));
      if (t < 1) anforderung = requestAnimationFrame(schritt);
    };
    anforderung = requestAnimationFrame(schritt);
  }

  return {
    zerstoeren() {
      if (anforderung) cancelAnimationFrame(anforderung);
      seite.remove();
    },
  };
}
