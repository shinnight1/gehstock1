/* ------------------------------------------------------------------
   Effekte auf dem Spielfeld: Partikel, Ringe, Erschuetterung.

   Gespeist aus den Ereignissen der Simulation - die Sim meldet, was
   passiert ist, dieser Teil entscheidet, wie es aussieht. Die Sim
   selbst weiss von alldem nichts, und das ist der Grund, warum ein
   Match auf zwei Geraeten gleich ausgeht, auch wenn eines davon alle
   Effekte abgeschaltet hat.

   Alles laeuft in Bildschirmkoordinaten, nicht in Millitiles: ein
   Partikel, der einmal entstanden ist, gehoert nicht mehr zum
   Spielgeschehen und muss nicht mitscrollen oder mitskalieren.

   Fester Pool, keine Allokation im laufenden Bild.
   ------------------------------------------------------------------ */

import type { Ereignis } from '@arena/sim';
import { karteVon } from '@arena/sim';
import { FARBE } from './palette.js';
import { pxX, pxY, skalaBei } from './kamera.js';
import type { Kamera } from './kamera.js';

const MAX_PARTIKEL = 220;
const MAX_RINGE = 24;

interface Partikel {
  aktiv: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rest: number;
  gesamt: number;
  groesse: number;
  farbe: string;
  /** Fall nach unten, in Pixeln je Sekunde im Quadrat. */
  schwere: number;
}

interface Ring {
  aktiv: boolean;
  x: number;
  y: number;
  /** Endradius in Pixeln. */
  ziel: number;
  rest: number;
  gesamt: number;
  farbe: string;
  dicke: number;
}

export interface Effekte {
  /** Ereignisse eines Ticks in Effekte uebersetzen. */
  aufnehmen(liste: readonly Ereignis[], k: Kamera): void;
  /** Weiterrechnen und zeichnen. `dt` in Sekunden. */
  zeichnen(c: CanvasRenderingContext2D, dt: number): void;
  /** Staerke der Erschuetterung in Pixeln, klingt von selbst ab. */
  ruettelX(): number;
  ruettelY(): number;
  leeren(): void;
}

export function effekteAnlegen(mitRuetteln: boolean): Effekte {
  const partikel: Partikel[] = [];
  for (let i = 0; i < MAX_PARTIKEL; i++) {
    partikel.push({
      aktiv: false, x: 0, y: 0, vx: 0, vy: 0,
      rest: 0, gesamt: 1, groesse: 2, farbe: '#fff', schwere: 0,
    });
  }
  const ringe: Ring[] = [];
  for (let i = 0; i < MAX_RINGE; i++) {
    ringe.push({ aktiv: false, x: 0, y: 0, ziel: 0, rest: 0, gesamt: 1, farbe: '#fff', dicke: 2 });
  }

  let ruettelRest = 0;
  let ruettelStaerke = 0;
  let versatzX = 0;
  let versatzY = 0;

  const freierPartikel = (): Partikel | null => {
    for (const p of partikel) if (!p.aktiv) return p;
    return null;
  };

  const freierRing = (): Ring | null => {
    for (const r of ringe) if (!r.aktiv) return r;
    return null;
  };

  function funken(
    x: number, y: number, anzahl: number, farbe: string,
    wucht: number, schwere: number, dauer: number,
  ): void {
    for (let i = 0; i < anzahl; i++) {
      const p = freierPartikel();
      if (!p) return;
      const winkel = (i / anzahl) * Math.PI * 2 + Math.random() * 0.5;
      const tempo = wucht * (0.35 + Math.random() * 0.85);
      p.aktiv = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(winkel) * tempo;
      /* Nach oben etwas gestaucht: aus der Draufsicht sieht eine
         gleichmaessige Kugel wie eine Scheibe aus, das liest sich
         flacher und passt zur Perspektive des Feldes. */
      p.vy = Math.sin(winkel) * tempo * 0.55 - wucht * 0.25;
      p.gesamt = dauer * (0.7 + Math.random() * 0.6);
      p.rest = p.gesamt;
      p.groesse = 1.5 + Math.random() * 2.5;
      p.farbe = farbe;
      p.schwere = schwere;
    }
  }

  function ring(x: number, y: number, ziel: number, farbe: string, dauer: number, dicke: number): void {
    const r = freierRing();
    if (!r) return;
    r.aktiv = true;
    r.x = x;
    r.y = y;
    r.ziel = ziel;
    r.gesamt = dauer;
    r.rest = dauer;
    r.farbe = farbe;
    r.dicke = dicke;
  }

  return {
    aufnehmen(liste, k) {
      for (const e of liste) {
        const x = pxX(k, e.x, e.y);
        const y = pxY(k, e.y);
        const s = skalaBei(k, e.y);
        const karte = e.karte ? karteVon(e.karte) : undefined;
        const farbe = karte?.farbe ?? FARBE.seiteHell[e.spieler];

        if (e.art === 'tod') {
          /* Der auffaelligste Effekt im Spiel, und das mit Absicht:
             ein Tod ist die wichtigste Information auf dem Feld -
             daran erkennt man, ob eine Verteidigung aufgeht. */
          funken(x, y, 12, farbe, s * 2600, s * 4200, 0.5);
          funken(x, y, 5, '#ffffff', s * 1800, s * 3000, 0.28);
          ring(x, y, s * e.radius * 2.2, farbe, 0.32, 2);
        } else if (e.art === 'treffer') {
          if (e.radius > 0) {
            // Flaechentreffer: Ring in Wirkgroesse statt Funken.
            ring(x, y, s * e.radius, farbe, 0.26, 2.5);
            funken(x, y, 6, farbe, s * 1800, s * 2600, 0.3);
          } else {
            funken(x, y, 3, '#ffffff', s * 1400, s * 2400, 0.2);
          }
        } else if (e.art === 'zauber') {
          ring(x, y, s * e.radius, farbe, 0.5, 3.5);
          funken(x, y, 22, farbe, s * 3200, s * 2200, 0.6);
        } else if (e.art === 'deploy') {
          ring(x, y, s * e.radius * 2, FARBE.seiteHell[e.spieler], 0.4, 2);
        } else if (e.art === 'turmfall') {
          funken(x, y, 30, FARBE.steinVorne, s * 3400, s * 5200, 0.9);
          funken(x, y, 14, FARBE.seite[e.spieler], s * 2600, s * 4200, 0.7);
          ring(x, y, s * e.radius * 3, '#ffffff', 0.55, 4);
          if (mitRuetteln) {
            ruettelStaerke = 9;
            ruettelRest = 0.45;
          }
        }
      }
    },

    zeichnen(c, dt) {
      if (ruettelRest > 0) {
        ruettelRest -= dt;
        const anteil = Math.max(0, ruettelRest / 0.45);
        const staerke = ruettelStaerke * anteil * anteil;
        versatzX = (Math.random() - 0.5) * staerke * 2;
        versatzY = (Math.random() - 0.5) * staerke * 2;
      } else {
        versatzX = 0;
        versatzY = 0;
      }

      for (const r of ringe) {
        if (!r.aktiv) continue;
        r.rest -= dt;
        if (r.rest <= 0) { r.aktiv = false; continue; }
        const t = 1 - r.rest / r.gesamt;
        // Schnell auf, langsam aus - so liest sich ein Aufschlag.
        const radius = r.ziel * (1 - (1 - t) * (1 - t));
        c.globalAlpha = (1 - t) * 0.85;
        c.strokeStyle = r.farbe;
        c.lineWidth = r.dicke;
        c.beginPath();
        // Flach, weil er auf dem Boden liegt.
        c.ellipse(r.x, r.y, radius, radius * 0.5, 0, 0, Math.PI * 2);
        c.stroke();
      }

      for (const p of partikel) {
        if (!p.aktiv) continue;
        p.rest -= dt;
        if (p.rest <= 0) { p.aktiv = false; continue; }
        p.vy += p.schwere * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const anteil = p.rest / p.gesamt;
        c.globalAlpha = anteil;
        c.fillStyle = p.farbe;
        const g = p.groesse * anteil;
        c.fillRect(p.x - g / 2, p.y - g / 2, g, g);
      }
      c.globalAlpha = 1;
    },

    ruettelX: () => versatzX,
    ruettelY: () => versatzY,

    leeren() {
      for (const p of partikel) p.aktiv = false;
      for (const r of ringe) r.aktiv = false;
      ruettelRest = 0;
    },
  };
}
