/* ------------------------------------------------------------------
   Die Arena als Blickfang im Hauptmenue.

   Das Menue zeigte bisher Zahlen und Kacheln - korrekt, aber es sah
   nach Einstellungen aus und nicht nach einem Spiel. Was fehlte, war
   das, worum es geht: das Feld selbst.

   Gezeichnet wird mit demselben Renderer wie im Match, aus einem
   echten Matchzustand. Kein gemaltes Bild, das irgendwann nicht mehr
   zum Spiel passt: aendert sich die Farbe des Rasens oder die Form
   der Tuerme, aendert sich das Menue mit.

   Einmal gebacken, nicht animiert. Ein Menue, das dauernd
   nachzeichnet, kostet Strom, ohne dass jemand hinsieht - und der
   Auftrag verlangt stabile Bildraten dort, wo es zaehlt, naemlich im
   Match. Neu gezeichnet wird nur, wenn sich die Groesse aendert.
   ------------------------------------------------------------------ */

import { matchAnlegen } from '@arena/sim';
import type { Turm } from '@arena/sim';
import { kameraAnlegen, kameraNeuBerechnen } from '../render/kamera.js';
import { feldBauen, obenVersatz } from '../render/feld.js';
import { wasserZeichnen } from '../render/wasser.js';
import { turmZeichnen } from '../render/turm.js';
import { bildLaden } from '../assets/lader.js';

export interface Menuszene {
  zerstoeren(): void;
}

/**
 * Hilfsgroesse fuer den ersten Kameradurchgang.
 *
 * Ein vollstaendiges Feld ist achtzehn mal zweiunddreissig Kacheln,
 * also hochkant - im Menue waere es ein schmaler Streifen. Gezeigt
 * wird deshalb nur das untere Stueck, und zwar buendig an der
 * Unterkante: der eigene Koenig gross im Vordergrund, dahinter die
 * eigenen Seitentuerme, darueber der Fluss.
 *
 * Bewusst die eigene Haelfte und nicht die gegnerische - das Menue
 * soll zeigen, was einem gehoert.
 *
 * Wie viel genau zu sehen ist, entscheidet nicht dieser Wert, sondern
 * das Seitenverhaeltnis des Kastens im CSS: sobald das Feld die
 * Breite fuellt, steht seine Hoehe fest. Dieser Wert bestimmt nur,
 * mit welcher gedachten Flaeche der erste Durchgang rechnet.
 */
const AUSSCHNITT = 0.58;

export function menuszeneAnlegen(eltern: HTMLElement, arena = 0): Menuszene {
  const canvas = document.createElement('canvas');
  canvas.className = 'a-szene';
  eltern.appendChild(canvas);

  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return { zerstoeren() { canvas.remove(); } };

  /* Ein Zustand ohne Decks: es geht nur um die Tuerme. Die Einheiten
     bleiben leer, und genau so soll die Szene aussehen - ein
     aufgeraeumtes Feld vor dem Anpfiff. */
  const stand = matchAnlegen({ seed: 1, decks: [[], []] });
  const tuerme: Turm[] = stand.tuerme;

  const kamera = kameraAnlegen(false);
  let letzteBreite = 0;
  let letzteHoehe = 0;

  function zeichnen(): void {
    const kasten = canvas.getBoundingClientRect();
    const breite = Math.max(1, Math.round(kasten.width));
    const hoehe = Math.max(1, Math.round(kasten.height));
    if (!breite || !hoehe) return;

    /* Auf zwei begrenzt: das Menue steht still, da bringt mehr Dichte
       nichts als Rechenzeit. */
    const dichte = Math.min(window.devicePixelRatio || 1, 2);
    if (breite === letzteBreite && hoehe === letzteHoehe) return;
    letzteBreite = breite;
    letzteHoehe = hoehe;

    canvas.width = Math.round(breite * dichte);
    canvas.height = Math.round(hoehe * dichte);
    ctx!.setTransform(dichte, 0, 0, dichte, 0, 0);

    /* Die Kamera haelt links und rechts Platz frei - im Match steht
       dort die Bedienung. Im Menue waere das ein schwebendes Feld
       zwischen zwei schwarzen Balken. Deshalb zwei Durchgaenge: der
       erste misst, wie breit das Feld bei dieser Flaeche wird, der
       zweite rechnet mit einer entsprechend groesseren Flaeche, sodass
       das Feld genau den Kasten fuellt. */
    const gesamt = Math.round(hoehe / AUSSCHNITT);
    kameraNeuBerechnen(kamera, breite, gesamt);
    const faktor = kamera.breitePx > 0 ? breite / kamera.breitePx : 1;
    kameraNeuBerechnen(kamera, breite * faktor, gesamt * faktor);

    ctx!.clearRect(0, 0, breite, hoehe);
    ctx!.save();
    /* Unten links buendig: der eigene Koenig steht im Vordergrund, das
       ferne Ende faellt oben aus dem Bild. */
    ctx!.translate(-kamera.x0, -(kamera.y0 + kamera.hoehePx - hoehe));
    const bild = feldBauen(kamera, dichte, arena);
    ctx!.drawImage(bild.unten, kamera.x0, kamera.y0, kamera.breitePx, kamera.hoehePx);
    wasserZeichnen(ctx!, kamera, 0, arena);

    const rand = obenVersatz(kamera);
    ctx!.drawImage(
      bild.oben, kamera.x0 - rand, kamera.y0 - rand,
      kamera.breitePx + rand * 2, kamera.hoehePx + rand * 2,
    );

    // Von hinten nach vorne, sonst steht der vordere Turm hinter dem hinteren.
    for (const t of [...tuerme].sort((a, b) => a.y - b.y)) {
      turmZeichnen(ctx!, kamera, t, 0, 0);
    }
    ctx!.restore();
  }

  /* Das Koenigsfoto kommt asynchron. Ohne diesen zweiten Anlauf
     stuenden im Menue zwei Steintuerme statt der Figuren - genau der
     Unterschied, um den es hier geht. */
  void bildLaden('king.png').then(() => {
    letzteBreite = 0;
    zeichnen();
  });

  const beobachter = new ResizeObserver(() => { zeichnen(); });
  beobachter.observe(canvas);
  zeichnen();

  return {
    zerstoeren() {
      beobachter.disconnect();
      canvas.remove();
    },
  };
}
