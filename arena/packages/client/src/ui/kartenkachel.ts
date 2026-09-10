/* ------------------------------------------------------------------
   Eine Karte als DOM-Kachel.

   Wird in Sammlung, Deckbau und im Roll-Ergebnis benutzt. Eine
   gemeinsame Bauweise statt drei aehnlicher: eine Karte muss ueberall
   gleich aussehen, sonst sucht man in jeder Ansicht neu.

   Das Bild ist vorerst eine Farbflaeche aus den Kartendaten. Liegt
   ein WebP unter assets/cards/<id>.webp, tritt es an dieselbe Stelle -
   die Kachel fragt danach und faellt still zurueck, wenn es fehlt.

   WebP statt PNG: eine Karte wird nie groesser als 62px hoch gezeigt
   (siehe .a-karte-bild in menu.css), das Rohmaterial aus der
   Bildgenerierung kam aber mit ueber 2 MB pro Datei. Herunterskaliert
   auf 512px und als WebP bei Qualitaet 0.85 kodiert sind es noch rund
   70-100 KB - Faktor 20 bis 30, ohne sichtbaren Qualitaetsverlust bei
   der tatsaechlichen Anzeigegroesse. iOS unterstuetzt WebP seit
   Version 14, das Spiel setzt ohnehin ein modernes Safari voraus.
   ------------------------------------------------------------------ */

import { karteVon, LEVEL } from '@arena/sim';
import type { Karte } from '@arena/sim';
import type { KartenBesitz } from '@arena/meta';
import { stufenFortschritt, kostenFuerStufe } from '@arena/meta';
import { SELTENHEIT_FARBE } from '../render/palette.js';
import { el } from './dom.js';
import { bildLaden } from '../assets/lader.js';

export interface KachelOptionen {
  besitz?: KartenBesitz | null;
  /** Ausgegraut darstellen - etwa im Deckbau, wenn schon im Deck. */
  gedaempft?: boolean;
  /** Rahmen hervorheben. */
  gewaehlt?: boolean;
  /** Splitterfortschritt und Level einblenden. */
  mitFortschritt?: boolean;
  tippen?: () => void;
}

export function kartenKachel(kartenId: string, o: KachelOptionen = {}): HTMLElement {
  const karte = karteVon(kartenId);
  if (!karte) return el('div.a-karte.a-fehlt', { text: kartenId });

  const besessen = !!o.besitz;
  /* Der erste Teil vor dem Punkt ist der Tagname - ohne das
     fuehrende 'div' entstuende ein Element namens <a-karte>, das der
     Browser zwar anlegt, aber keine Regel je trifft. */
  const klassen = ['div', 'a-karte'];
  if (!besessen) klassen.push('nicht-da');
  if (o.gedaempft) klassen.push('gedaempft');
  if (o.gewaehlt) klassen.push('gewaehlt');

  const kachel = el(klassen.join('.'), {
    stil: { borderColor: SELTENHEIT_FARBE[karte.seltenheit] },
    ...(o.tippen ? { tippen: o.tippen } : {}),
  }, [
    bildFlaeche(karte, besessen),
    el('div.a-karte-name', { text: karte.name }),
    el('div.a-karte-kosten', { text: String(karte.elixir) }),
    o.besitz && o.mitFortschritt ? fortschritt(o.besitz) : null,
    o.besitz ? el('div.a-karte-level', { text: 'Lv ' + o.besitz.level }) : null,
  ]);
  return kachel;
}

/**
 * Bildflaeche der Karte.
 *
 * Solange kein eigenes PNG vorliegt, steht dort die Grundfarbe aus
 * den Kartendaten. Unbesessene Karten werden zur Silhouette - man
 * soll sehen, dass es sie gibt, aber nicht, wie sie aussieht.
 */
function bildFlaeche(karte: Karte, besessen: boolean): HTMLElement {
  const flaeche = el('div.a-karte-bild', {
    stil: { background: besessen ? karte.farbe : '#1b2434' },
  });

  void bildLaden('cards/' + karte.id + '.webp').then((bild) => {
    if (!bild || !flaeche.isConnected) return;
    flaeche.style.backgroundImage = 'url(' + bild.src + ')';
    flaeche.style.backgroundSize = 'cover';
    flaeche.style.backgroundPosition = 'center';
    if (!besessen) flaeche.classList.add('silhouette');
  });

  if (!besessen) flaeche.appendChild(el('div.a-schloss', { text: '?' }));
  return flaeche;
}

function fortschritt(b: KartenBesitz): HTMLElement {
  const voll = b.level >= LEVEL.max;
  const noetig = kostenFuerStufe(b.level);
  return el('div.a-karte-fortschritt', {}, [
    el('div.a-fort-balken', {}, [
      el('div.a-fort-fuell', {
        stil: { width: (stufenFortschritt(b) / 10).toFixed(1) + '%' },
      }),
    ]),
    el('div.a-fort-text', {
      text: voll ? 'Höchststufe' : b.splitter + ' / ' + noetig,
    }),
  ]);
}
