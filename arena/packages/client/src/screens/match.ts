/* ------------------------------------------------------------------
   Match-Bildschirm.

   Duenn: er baut die Bruecke zwischen Profil und Simulation. Deck und
   Kartenlevel kommen aus dem Profil, die Botstaerke aus den
   Trophaeen, und wenn das Match entschieden ist, wird es genau einmal
   verbucht und der Ende-Bildschirm bekommt die Zahlen.

   Das Verbuchen gehoert hierher und nicht in die Simulation: die
   weiss nichts von Trophaeen, und das soll so bleiben.
   ------------------------------------------------------------------ */

import { karteVon, botProfil, botDeck, matchAnlegen, KARTEN_IDS, DECK } from '@arena/sim';
import type { Ausgang } from '@arena/sim';
import { levelTabelle, matchVerbuchen, deckGueltig } from '@arena/meta';
import { spielStarten } from '../spiel.js';
import type { Spiel } from '../spiel.js';
import type { App, Schirm } from '../app.js';
import type { EndeDaten } from './ende.js';

export function matchBauen(wurzel: HTMLElement, app: App): Schirm {
  const p = app.profil;
  if (!deckGueltig(p)) {
    app.gehe('deck');
    return { zerstoeren() { /* nichts aufzuraeumen */ } };
  }

  const seed = (Date.now() ^ (p.rollsGesamt * 2654435761)) & 0x7fffffff;

  /* Das Botdeck haengt an seiner Stufe: ein schwacher Bot bekommt
     eine zusammengewuerfelte Auswahl, ein starker ein stimmiges Deck.
     Gezogen wird aus einem Wegwerf-Zustand, damit der Match-RNG davon
     unberuehrt bleibt. */
  const profil = botProfil(p.trophaeen);
  const wegwerf = matchAnlegen({ seed, decks: [[], []] });
  const gegner = botDeck(wegwerf, KARTEN_IDS, profil.deckQualitaet, DECK.groesse);

  let fertig = false;

  const spiel: Spiel = spielStarten(wurzel, {
    seed,
    deck: p.deck.slice(),
    level: levelTabelle(p),
    gegnerDeck: gegner,
    trophaeen: p.trophaeen,
    /* Trophaeen-Matches gegen den Bot laufen mit den echten Leveln -
       einheitliche Level sind fuer Freundesduelle gedacht, wo sonst
       Spielzeit statt Koennen entscheidet. */
    einheitlicheLevel: false,
    screenshake: app.optionen.screenshake,
    onKlang: (art, hoehe) => app.klang.spiel(art as never, hoehe),
    onExit: () => app.gehe('menu'),
    onEnde: (ausgang: Ausgang, tuerme) => {
      if (fertig) return;
      fertig = true;

      const meiner = ausgang === 'sieg0' ? 'sieg'
        : ausgang === 'sieg1' ? 'niederlage' : 'unentschieden';
      const vorher = app.profil.trophaeen;
      let ergebnis = { trophaeen: 0, rolls: 0, neueTrophaeen: vorher };
      app.aendern((prof) => {
        ergebnis = matchVerbuchen(prof, meiner, tuerme, Date.now());
      });

      /* Kurz stehen lassen, bevor der Bildschirm wechselt. Ein
         sofortiger Schnitt verschluckt den Moment, in dem der Turm
         faellt - und genau der ist das Ergebnis. */
      window.setTimeout(() => {
        const daten: EndeDaten = {
          ausgang: meiner,
          aenderung: ergebnis.trophaeen,
          vorher,
          nachher: ergebnis.neueTrophaeen,
          rolls: ergebnis.rolls,
          tuerme,
        };
        app.gehe('ende', daten);
      }, 1400);
    },
  });

  // Karten ohne Eintrag im Katalog kaeme die Sim nicht durch.
  for (const id of p.deck) {
    if (!karteVon(id)) { app.gehe('deck'); break; }
  }

  return { zerstoeren() { spiel.zerstoeren(); } };
}
