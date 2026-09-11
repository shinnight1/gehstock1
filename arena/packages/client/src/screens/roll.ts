/* ------------------------------------------------------------------
   Roll-Bildschirm samt Animation.

   Vier Phasen, zusammen rund dreieinhalb Sekunden:

     Aufladen  0.6 s  Der Knopf zieht Licht aus den Bildschirmraendern
     Flug      1.2 s  Ein Lichtobjekt schiesst durch das Bild, die
                      Farbe wird erst auf halber Strecke sichtbar
     Aufprall  0.5 s  Partikelexplosion in der Seltenheitsfarbe
     Reveal    1.2 s  Karte dreht sich auf, Name und Werte blenden ein

   Jederzeit per Tipp ueberspringbar - dann steht sofort das Ergebnis
   da, nie eine halbe Animation.

   Technisch bewusst zweigeteilt: Karten und Layout sind DOM und
   werden ueber CSS-Transforms bewegt, nur die Partikel laufen auf
   einem eigenen Canvas. Animiert werden ausschliesslich `transform`
   und `opacity` - alles andere, besonders Filter und Schatten,
   bricht auf iOS-Safari die Bildrate.
   ------------------------------------------------------------------ */

import { ROLL, karteVon } from '@arena/sim';
import type { Seltenheit } from '@arena/sim';
import { rollsZiehen, pityStand, hoechsteSeltenheit, besitzVon } from '@arena/meta';
import type { RollErgebnis } from '@arena/meta';
import { el, kopf } from '../ui/dom.js';
import { kartenKachel } from '../ui/kartenkachel.js';
import { SELTENHEIT_FARBE } from '../render/palette.js';
import { partikelfeldAnlegen } from '../render/rollpartikel.js';
import type { Partikelfeld } from '../render/rollpartikel.js';
import type { App, Schirm } from '../app.js';

const PHASEN = { aufladen: 0.6, flug: 1.2, aufprall: 0.5, reveal: 1.2 };

/**
 * Wie wuchtig der Einschlag je Seltenheit ausfaellt.
 *
 * Die Abstufung ist der eigentliche Inhalt der Animation: sie muss
 * lange bevor die Karte lesbar ist verraten, was gleich daliegt.
 * Deshalb wachsen Funkenzahl, Zahl der Schockwellen und der
 * Bildschirmblitz gemeinsam - und nur die beiden oberen Stufen
 * bekommen ueberhaupt einen Strahlenkranz.
 */
const WUCHT = {
  gewoehnlich: { funken: 70, wellen: 1, kranz: 0, blitz: 0.45, welle: 260 },
  selten: { funken: 110, wellen: 2, kranz: 0, blitz: 0.6, welle: 340 },
  episch: { funken: 170, wellen: 3, kranz: 320, blitz: 0.78, welle: 440 },
  legendaer: { funken: 230, wellen: 4, kranz: 480, blitz: 0.95, welle: 560 },
} as const;

/* Tonhoehe je Seltenheit. Man hoert, was gezogen wurde, bevor die
   Karte sich fertig gedreht hat - das ist die halbe Spannung. */
const TONHOEHE: Record<Seltenheit, number> = {
  gewoehnlich: 1, selten: 1.2, episch: 1.5, legendaer: 2,
};
const NAME: Record<Seltenheit, string> = {
  gewoehnlich: 'Gewöhnlich', selten: 'Selten',
  episch: 'Episch', legendaer: 'Legendär',
};

export function rollBauen(wurzel: HTMLElement, app: App): Schirm {
  const seite = el('div.a-schirm.a-roll');
  wurzel.appendChild(seite);

  const ruhig = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const ohneAnimation = ruhig || app.optionen.ohneAnimation;

  let partikel: Partikelfeld | null = null;
  let anforderung = 0;
  let laeuft = false;
  let ueberspringen = false;

  function aufbauen(): void {
    stoppen();
    seite.textContent = '';
    const p = app.profil;
    const pity = pityStand(p);

    seite.appendChild(kopf('Rolls', () => app.gehe('menu'),
      el('button.a-info', { text: 'i', attr: { 'aria-label': 'Raten anzeigen' },
        tippen: infoZeigen })));

    seite.appendChild(el('div.a-roll-mitte', {}, [
      el('div.a-roll-zahl', { text: String(p.rolls) }),
      el('div.a-roll-wort', {
        text: p.rolls === 1 ? 'offener Roll' : 'offene Rolls',
      }),
      el('div.a-pity', {}, [
        pityZeile('Episch', pity.episch, SELTENHEIT_FARBE.episch),
        pityZeile('Legendär', pity.legendaer, SELTENHEIT_FARBE.legendaer),
      ]),
    ]));

    const knoepfe = el('div.a-roll-knoepfe', {}, [
      el('button.a-gross' + (p.rolls < 1 ? '.aus' : ''), {
        text: 'Einzeln ziehen',
        tippen: () => { if (p.rolls >= 1) ziehen(1); },
      }),
      el('button.a-gross.zehn' + (p.rolls < 10 ? '.aus' : ''), {
        text: '10 ziehen',
        tippen: () => { if (p.rolls >= 10) ziehen(10); },
      }),
    ]);
    seite.appendChild(knoepfe);

    if (p.rolls < 1) {
      seite.appendChild(el('div.a-hinweis', {
        text: 'Keine Rolls offen. Jedes beendete Match bringt einen, ein Sieg zwei.',
      }));
    }
  }

  function pityZeile(was: string, offen: number, farbe: string): HTMLElement {
    return el('div.a-pity-zeile', {}, [
      el('span.a-pity-punkt', { stil: { background: farbe } }),
      el('span.a-pity-text', {
        text: offen === 0
          ? was + ': nächster Roll garantiert'
          : was + ': noch ' + offen + ' bis Garantie',
      }),
    ]);
  }

  /* -------------------------- Info-Fenster ------------------------- */

  function infoZeigen(): void {
    const p = app.profil;
    const pity = pityStand(p);
    const blatt = el('div.a-blatt');
    const zu = (): void => { blatt.remove(); };
    blatt.appendChild(el('div.a-blatt-hintergrund', { tippen: zu }));
    blatt.appendChild(el('div.a-blatt-inhalt', {}, [
      el('h2', { text: 'Wie die Ziehung funktioniert' }),
      el('div.a-werte', {}, (['gewoehnlich', 'selten', 'episch', 'legendaer'] as const)
        .map((s) => el('div.a-wert', {}, [
          el('span.a-wert-was', { text: NAME[s], stil: { color: SELTENHEIT_FARBE[s] } }),
          el('span.a-wert-zahl', { text: (ROLL.raten[s] / 100).toFixed(1) + ' %' }),
        ]))),
      el('p.a-blatt-text', {
        text: 'Spätestens beim ' + ROLL.pityEpisch + '. Roll ohne Episch kommt ein '
          + 'Episches, spätestens beim ' + ROLL.pityLegendaer + '. ohne Legendär ein '
          + 'Legendäres. Beide Zähler laufen getrennt.',
      }),
      el('div.a-werte', {}, [
        el('div.a-wert', {}, [
          el('span.a-wert-was', { text: 'Noch bis Episch' }),
          el('span.a-wert-zahl', { text: String(pity.episch) }),
        ]),
        el('div.a-wert', {}, [
          el('span.a-wert-was', { text: 'Noch bis Legendär' }),
          el('span.a-wert-zahl', { text: String(pity.legendaer) }),
        ]),
        el('div.a-wert', {}, [
          el('span.a-wert-was', { text: 'Bisher gezogen' }),
          el('span.a-wert-zahl', { text: String(p.rollsGesamt) }),
        ]),
      ]),
      el('p.a-blatt-text.a-leise', {
        text: 'Ein Duplikat wird zu Splittern. Rolls gibt es nur durch gespielte '
          + 'Matches — nichts hier lässt sich kaufen.',
      }),
      el('button.a-schliessen', { text: 'Schließen', tippen: zu }),
    ]));
    seite.appendChild(blatt);
  }

  /* --------------------------- Ziehen ------------------------------ */

  function ziehen(anzahl: number): void {
    let ergebnisse: RollErgebnis[] = [];
    app.aendern((p) => { ergebnisse = rollsZiehen(p, anzahl); });
    if (!ergebnisse.length) { aufbauen(); return; }

    if (ohneAnimation) { ergebnisZeigen(ergebnisse); return; }
    animieren(ergebnisse);
  }

  /* -------------------------- Animation ---------------------------- */

  function animieren(ergebnisse: RollErgebnis[]): void {
    stoppen();
    seite.textContent = '';
    ueberspringen = false;

    const buehne = el('div.a-buehne');
    seite.appendChild(buehne);
    partikel = partikelfeldAnlegen(buehne);

    const flieger = el('div.a-flieger');
    buehne.appendChild(flieger);
    const blitz = el('div.a-blitz');
    buehne.appendChild(blitz);

    const hoechste = hoechsteSeltenheit(ergebnisse);
    const farbe = SELTENHEIT_FARBE[hoechste];
    const gross = hoechste === 'episch' || hoechste === 'legendaer';
    app.klang.spiel('rollAufladen');
    let flugKlangKam = false;

    /* Ein Tipp irgendwohin bricht ab. Der Hinweis steht klein am Rand -
       wer die Animation kennt, will sie nicht jedes Mal sehen. */
    const abbrechen = (): void => { ueberspringen = true; };
    buehne.addEventListener('pointerup', abbrechen);
    buehne.appendChild(el('div.a-skip', { text: 'Tippen zum Überspringen' }));

    const gesamt = PHASEN.aufladen + PHASEN.flug + PHASEN.aufprall;
    let zeit = 0;
    let letzterStempel = 0;
    let explodiert = false;
    laeuft = true;

    const kasten = (): { b: number; h: number } => {
      const r = buehne.getBoundingClientRect();
      return { b: r.width, h: r.height };
    };

    const schritt = (stempel: number): void => {
      if (!laeuft) return;
      const dt = letzterStempel ? Math.min(0.05, (stempel - letzterStempel) / 1000) : 0.016;
      letzterStempel = stempel;
      zeit += dt;

      const { b, h } = kasten();
      const mx = b / 2;
      const my = h / 2;

      if (ueberspringen) { fertig(ergebnisse); return; }

      if (zeit < PHASEN.aufladen) {
        // Phase 1: Licht wird vom Rand hereingezogen.
        const t = zeit / PHASEN.aufladen;
        buehne.style.setProperty('--dunkel', String(t * 0.75));
        for (let i = 0; i < 3; i++) {
          const rand = Math.random();
          const vonX = rand < 0.5 ? (Math.random() < 0.5 ? 0 : b) : Math.random() * b;
          const vonY = rand < 0.5 ? Math.random() * h : (Math.random() < 0.5 ? 0 : h);
          partikel!.funke(vonX, vonY, (mx - vonX) * 1.6, (my - vonY) * 1.6, '#dbeafe', 0.6);
        }
      } else if (zeit < PHASEN.aufladen + PHASEN.flug) {
        // Phase 2: Flug. Die Farbe wird erst ab der Haelfte sichtbar.
        const t = (zeit - PHASEN.aufladen) / PHASEN.flug;
        if (!flugKlangKam) {
          flugKlangKam = true;
          app.klang.spiel('rollFlug', TONHOEHE[hoechste]);
        }
        const weg = gross ? doppelDurchflug(t) : einDurchflug(t);
        const fx = weg * b;
        const fy = my + Math.sin(t * Math.PI * (gross ? 2 : 1)) * h * 0.12;
        flieger.style.transform = 'translate(' + fx + 'px,' + fy + 'px) scale('
          + (gross ? 1.5 : 1) + ')';
        flieger.style.opacity = '1';
        flieger.style.background = t < 0.5 ? '#e8eef7' : farbe;
        const spurBreite = (gross ? 30 : 17) * (t < 0.5 ? 0.6 : 1);
        partikel!.spur(fx, fy, t < 0.5 ? '#e8eef7' : farbe, spurBreite);

        /* Ab der Haelfte sprueht das Objekt seitlich Funken ab. Das
           ist der Moment, in dem die Farbe erscheint - und die Funken
           machen daraus ein Ereignis statt eines Farbwechsels. Nur
           fuer die hohen Seltenheiten, damit der Unterschied zaehlt. */
        if (gross && t > 0.45) {
          for (let i = 0; i < 2; i++) {
            const streu = (Math.random() - 0.5) * 2;
            partikel!.funke(fx, fy, streu * 260, (Math.random() - 0.3) * 300, farbe, 0.45);
          }
        }
      } else if (zeit < gesamt) {
        // Phase 3: Aufprall.
        if (!explodiert) {
          explodiert = true;
          const w = WUCHT[hoechste];
          app.klang.spiel('rollAufprall', TONHOEHE[hoechste]);
          flieger.style.opacity = '0';

          /* Erst weiss, dann farbig: der erste Moment ist reine
             Helligkeit, die Farbe kommt einen Wimpernschlag spaeter.
             Umgekehrt sieht es aus, als waere jemand mit dem Pinsel
             ausgerutscht. */
          partikel!.explosion(mx, my, Math.round(w.funken * 0.35), '#ffffff', 760);
          partikel!.explosion(mx, my, w.funken, farbe, 460);

          /* Mehrere Wellen, zeitlich versetzt. Eine einzelne liest
             sich als Kreis, drei als Druck. */
          for (let i = 0; i < w.wellen; i++) {
            const verzug = i * 90;
            window.setTimeout(() => {
              partikel?.schockwelle(mx, my, w.welle * (1 + i * 0.45), farbe, 0.5 + i * 0.1);
            }, verzug);
          }
          if (w.kranz > 0) {
            partikel!.strahlenkranz(mx, my, farbe, w.kranz, PHASEN.aufprall + 1.4);
          }

          blitz.style.background = farbe;
          blitz.animate(
            [{ opacity: w.blitz }, { opacity: 0 }],
            { duration: 260 + w.wellen * 60, easing: 'ease-out' },
          );

          /* Erschuetterung ab episch, beim Legendaeren staerker. Nur
             transform - ein bewegter Schatten kostet auf dem iPad die
             Bildrate. */
          const ruettelt = hoechste === 'legendaer' || hoechste === 'episch';
          if (ruettelt && app.optionen.screenshake) {
            const kraft = hoechste === 'legendaer' ? 9 : 5;
            buehne.animate([
              { transform: 'translate(0,0)' },
              { transform: `translate(${-kraft}px,${kraft * 0.6}px)` },
              { transform: `translate(${kraft * 0.8}px,${-kraft * 0.5}px)` },
              { transform: `translate(${-kraft * 0.4}px,${kraft * 0.25}px)` },
              { transform: 'translate(0,0)' },
            ], { duration: 200 + kraft * 20, easing: 'ease-out' });
          }
        }
      } else {
        fertig(ergebnisse);
        return;
      }

      partikel!.bild(dt);
      anforderung = requestAnimationFrame(schritt);
    };

    anforderung = requestAnimationFrame(schritt);
  }

  /** Ein Durchflug von links nach rechts, in der Mitte am schnellsten. */
  function einDurchflug(t: number): number {
    return t * t * (3 - 2 * t);
  }

  /** Zwei Durchfluege - das Signal fuer Episch und Legendaer. */
  function doppelDurchflug(t: number): number {
    if (t < 0.45) return (t / 0.45) * 1.15 - 0.1;
    if (t < 0.55) return 1.05 - ((t - 0.45) / 0.1) * 1.15;
    return -0.1 + ((t - 0.55) / 0.45) * 0.6;
  }

  function fertig(ergebnisse: RollErgebnis[]): void {
    stoppen();
    ergebnisZeigen(ergebnisse);
  }

  /* -------------------------- Ergebnis ----------------------------- */

  function ergebnisZeigen(ergebnisse: RollErgebnis[]): void {
    stoppen();
    seite.textContent = '';

    seite.appendChild(kopf('Ergebnis', () => aufbauen()));

    const raster = el('div.a-raster.a-ergebnis');
    for (const r of ergebnisse) {
      const karte = karteVon(r.kartenId);
      const kachel = kartenKachel(r.kartenId, {
        besitz: besitzVon(app.profil, r.kartenId),
      });
      if (r.neu) kachel.appendChild(el('div.a-neu', { text: 'NEU' }));
      else if (r.splitter > 0) {
        kachel.appendChild(el('div.a-splitter', { text: '+' + r.splitter }));
      }
      if (r.durchPity) kachel.appendChild(el('div.a-garantie', { text: 'Garantie' }));
      if (karte && !ohneAnimation) {
        window.setTimeout(
          () => app.klang.spiel('rollReveal', TONHOEHE[karte.seltenheit]),
          ergebnisse.indexOf(r) * 90,
        );
      }
      if (!ohneAnimation) {
        /* Kartenrueckseite dreht sich auf. Nur transform - ein Flip
           ueber width oder ein Filter waere auf dem iPad sofort
           sichtbar langsamer. */
        kachel.animate([
          { transform: 'rotateY(90deg) scale(0.8)', opacity: 0 },
          { transform: 'rotateY(0deg) scale(1)', opacity: 1 },
        ], {
          duration: PHASEN.reveal * 1000 * 0.6,
          delay: ergebnisse.indexOf(r) * 90,
          easing: 'cubic-bezier(.2,.9,.3,1)',
          fill: 'backwards',
        });
      }
      if (karte) {
        kachel.style.setProperty('--glanz', SELTENHEIT_FARBE[karte.seltenheit]);
      }
      raster.appendChild(kachel);
    }
    seite.appendChild(raster);

    seite.appendChild(el('div.a-roll-knoepfe', {}, [
      el('button.a-gross', { text: 'Weiter', tippen: aufbauen }),
      el('button.a-klein', { text: 'Zum Deck', tippen: () => app.gehe('deck') }),
    ]));
  }

  function stoppen(): void {
    laeuft = false;
    if (anforderung) cancelAnimationFrame(anforderung);
    anforderung = 0;
    partikel?.zerstoeren();
    partikel = null;
  }

  aufbauen();
  return {
    zerstoeren() {
      stoppen();
      seite.remove();
    },
  };
}
