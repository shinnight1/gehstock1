/* ------------------------------------------------------------------
   Sammlung.

   Alle Karten im Raster, besessene farbig, unbesessene als Silhouette
   mit Fragezeichen. Wer genug Splitter hat, sieht einen Knopf und
   kann sofort aufwerten - der Moment gehoert sichtbar hierher und
   nicht in einen Automatismus im Hintergrund.

   Sortiert wird nach Seltenheit und dann nach Elixirkosten. Nicht
   nach Besitz: das Raster soll immer gleich aussehen, damit man eine
   Karte am Platz wiederfindet.
   ------------------------------------------------------------------ */

import { KARTEN_IDS, karteVon, LEVEL } from '@arena/sim';
import type { Seltenheit } from '@arena/sim';
import { besitzVon, kannAufsteigen, aufsteigen, sammlungsStand } from '@arena/meta';
import { el, kopf } from '../ui/dom.js';
import { kartenKachel } from '../ui/kartenkachel.js';
import { SELTENHEIT_FARBE } from '../render/palette.js';
import type { App, Schirm } from '../app.js';

const RANG: Record<Seltenheit, number> = {
  gewoehnlich: 0, selten: 1, episch: 2, legendaer: 3,
};

const NAME: Record<Seltenheit, string> = {
  gewoehnlich: 'Gewöhnlich',
  selten: 'Selten',
  episch: 'Episch',
  legendaer: 'Legendär',
};

export function sammlungBauen(wurzel: HTMLElement, app: App): Schirm {
  const seite = el('div.a-schirm.a-sammlung');
  wurzel.appendChild(seite);

  function aufbauen(): void {
    seite.textContent = '';
    const p = app.profil;
    const stand = sammlungsStand(p, KARTEN_IDS);

    seite.appendChild(kopf('Sammlung', () => app.gehe('menu'),
      el('span.a-zaehler', { text: stand.besessen + ' / ' + stand.gesamt })));

    const sortiert = KARTEN_IDS.slice().sort((a, b) => {
      const ka = karteVon(a)!;
      const kb = karteVon(b)!;
      if (RANG[ka.seltenheit] !== RANG[kb.seltenheit]) {
        return RANG[ka.seltenheit] - RANG[kb.seltenheit];
      }
      return ka.elixir - kb.elixir;
    });

    let letzte: Seltenheit | null = null;
    let raster: HTMLElement | null = null;

    for (const id of sortiert) {
      const karte = karteVon(id)!;
      if (karte.seltenheit !== letzte) {
        letzte = karte.seltenheit;
        seite.appendChild(el('div.a-gruppe', {
          text: NAME[letzte],
          stil: { color: SELTENHEIT_FARBE[letzte] },
        }));
        raster = el('div.a-raster');
        seite.appendChild(raster);
      }
      const besitz = besitzVon(p, id);
      raster!.appendChild(kartenKachel(id, {
        besitz,
        mitFortschritt: true,
        tippen: () => zeigen(id),
      }));
    }
  }

  /** Einzelansicht als Blatt von unten. */
  function zeigen(id: string): void {
    const karte = karteVon(id)!;
    const besitz = besitzVon(app.profil, id);
    const blatt = el('div.a-blatt');

    const schliessen = (): void => { blatt.remove(); };

    blatt.appendChild(el('div.a-blatt-hintergrund', { tippen: schliessen }));
    const inhalt = el('div.a-blatt-inhalt', {}, [
      el('div.a-blatt-kopf', {}, [
        el('h2', { text: karte.name }),
        el('span.a-seltenheit', {
          text: NAME[karte.seltenheit],
          stil: { color: SELTENHEIT_FARBE[karte.seltenheit] },
        }),
      ]),
      el('p.a-blatt-text', { text: karte.text }),
      werteListe(id),
      besitz
        ? aufwertKnopf(id, () => { schliessen(); aufbauen(); })
        : el('div.a-hinweis', { text: 'Noch nicht in deiner Sammlung. Rolls bringen neue Karten.' }),
      el('button.a-schliessen', { text: 'Schließen', tippen: schliessen }),
    ]);
    blatt.appendChild(inhalt);
    seite.appendChild(blatt);
  }

  function werteListe(id: string): HTMLElement {
    const k = karteVon(id)!;
    const zeilen: [string, string][] = [['Elixir', String(k.elixir)]];

    if (k.art === 'zauber') {
      zeilen.push(['Wirkung', 'Zauber']);
      if (k.zauberDmg) zeilen.push(['Schaden', String(k.zauberDmg)]);
      if (k.zauberTurmDmg) zeilen.push(['Schaden an Türmen', String(k.zauberTurmDmg)]);
      if (k.bremsePromille) {
        zeilen.push(['Verlangsamt auf', Math.round(k.bremsePromille / 10) + ' %']);
      }
    } else {
      if (k.anzahl > 1) zeilen.push(['Anzahl', String(k.anzahl)]);
      zeilen.push(['Trefferpunkte', String(k.hp)]);
      if (k.dmg) zeilen.push(['Schaden', String(k.dmg)]);
      if (k.dmg) zeilen.push(['Schlag alle', (k.angriffsTakt / 20).toFixed(1) + ' s']);
      if (k.tempo) zeilen.push(['Tempo', (k.tempo / 50).toFixed(1) + ' Tiles/s']);
      zeilen.push(['Reichweite', (k.reichweite / 1000).toFixed(1) + ' Tiles']);
      zeilen.push(['Trifft', {
        boden: 'Boden', luft: 'Luft', beides: 'Boden und Luft',
        nur_gebaeude: 'nur Gebäude',
      }[k.zieltAuf]]);
      if (k.schadensTyp === 'flaeche') zeilen.push(['Schadensart', 'Fläche']);
      if (k.ebene === 'luft') zeilen.push(['Bewegt sich', 'fliegend']);
      if (k.lebensdauer) zeilen.push(['Hält', (k.lebensdauer / 20).toFixed(0) + ' s']);
    }

    return el('div.a-werte', {}, zeilen.map(([was, wert]) => el('div.a-wert', {}, [
      el('span.a-wert-was', { text: was }),
      el('span.a-wert-zahl', { text: wert }),
    ])));
  }

  function aufwertKnopf(id: string, danach: () => void): HTMLElement {
    const besitz = besitzVon(app.profil, id)!;
    if (besitz.level >= LEVEL.max) {
      return el('div.a-hinweis', { text: 'Diese Karte ist auf der Höchststufe.' });
    }
    if (!kannAufsteigen(besitz)) {
      return el('div.a-hinweis', {
        text: 'Noch nicht genug Splitter für Stufe ' + (besitz.level + 1) + '.',
      });
    }
    return el('button.a-gross.a-aufwerten', {
      text: 'Auf Stufe ' + (besitz.level + 1) + ' bringen',
      tippen: () => {
        app.aendern((p) => { aufsteigen(p, id); });
        danach();
      },
    });
  }

  aufbauen();
  return { zerstoeren() { seite.remove(); } };
}
