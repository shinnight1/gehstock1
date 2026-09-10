/* ------------------------------------------------------------------
   Bewegung, Wegpunkte und Kollision.

   Kein A*. Bodeneinheiten brauchen genau eine Entscheidung: liegt
   mein Ziel jenseits des Flusses, laufe ich zuerst zur naechsten
   Bruecke, danach zum Ziel. Das ist die gesamte Wegfindung - mehr
   gibt die Karte nicht her, und alles Groessere waere pro Tick fuer
   40 Einheiten zu teuer.

   Luft ignoriert Fluss und Kollision und fliegt geradeaus.

   Die Kollisionsaufloesung ist weich: Einheiten schieben sich
   auseinander, statt sich zu blockieren. Harte Kollision fuehrt bei
   Schwaermen sofort zu Stau an der Bruecke - und ein Stau sieht wie
   ein Fehler aus, auch wenn er physikalisch stimmt.
   ------------------------------------------------------------------ */

import { schrittRichtung, dist2, isqrt, clamp } from './fixed.js';
import type { Vek2 } from './fixed.js';
import {
  BREITE, HOEHE, FLUSS_OBEN, FLUSS_UNTEN, BRUECKE_Y, naechsteBruecke, istImFluss,
} from './arena.js';
import type { MatchState, Einheit } from './state.js';
import { KAMPF } from './data/balance.js';
import { zielLebt, zielPunkt } from './ziel.js';

/* Wiederverwendete Arbeitsobjekte. In der Bewegungsschleife darf
   nichts alloziert werden - sie laeuft 20-mal je Sekunde ueber jede
   Einheit. */
const schritt: Vek2 = { x: 0, y: 0 };

/** Liegt der Punkt auf der Haelfte von `spieler`? */
function eigeneHaelfte(spieler: number, y: number): boolean {
  return spieler === 0 ? y >= FLUSS_UNTEN : y <= FLUSS_OBEN;
}

/**
 * Wohin die Einheit als Naechstes laufen soll.
 *
 * Ergebnis in `schritt` als Zielpunkt, nicht als Richtung - die
 * Umrechnung macht der Aufrufer.
 */
function wegpunkt(s: MatchState, e: Einheit, raus: Vek2): void {
  let zielX = e.x;
  let zielY = e.y;

  if (zielLebt(s, e)) {
    const p = zielPunkt(s, e);
    zielX = p.x;
    zielY = p.y;
  } else {
    // Ohne Ziel laeuft die Einheit stur nach vorn.
    zielX = e.x;
    zielY = e.spieler === 0 ? 0 : HOEHE;
  }

  if (e.ebene === 'luft') {
    raus.x = zielX;
    raus.y = zielY;
    return;
  }

  /* Der Fluss trennt. Steht das Ziel drueben, fuehrt der Weg ueber
     die Bruecke - erst zu ihr hin, dann hinueber, dann weiter. */
  const zielDrueben = eigeneHaelfte(e.spieler, zielY) !== eigeneHaelfte(e.spieler, e.y);
  const nochDiesseits = eigeneHaelfte(e.spieler, e.y);

  if (!zielDrueben || e.ueberFluss) {
    raus.x = zielX;
    raus.y = zielY;
    return;
  }

  if (e.brueckeX === 0) e.brueckeX = naechsteBruecke(e.x).x;

  if (nochDiesseits) {
    /* Erst auf Bruecken-Hoehe kommen, dann hinueber. Ohne den
       Zwischenschritt laufen Einheiten schraeg gegen das Ufer. */
    const uferAbstand = e.spieler === 0 ? e.y - FLUSS_UNTEN : FLUSS_OBEN - e.y;
    const nahAmUfer = uferAbstand < 3000;
    raus.x = e.brueckeX;
    raus.y = nahAmUfer ? BRUECKE_Y : (e.spieler === 0 ? FLUSS_UNTEN : FLUSS_OBEN);
    // Nah genug an der Bruecke - jetzt darf es hinuebergehen.
    if (Math.abs(e.x - e.brueckeX) < 500 && nahAmUfer) {
      raus.y = e.spieler === 0 ? FLUSS_OBEN - 500 : FLUSS_UNTEN + 500;
    }
    return;
  }

  // Drueben angekommen.
  e.ueberFluss = true;
  raus.x = zielX;
  raus.y = zielY;
}

/**
 * Eine Einheit einen Tick weit bewegen.
 *
 * Steht das Ziel in Reichweite, bleibt sie stehen und schlaegt zu -
 * das entscheidet kampf.ts, hier wird nur nicht mehr gelaufen.
 */
export function bewegen(s: MatchState, e: Einheit): void {
  if (e.istGebaeude || e.tempo <= 0) return;
  if (e.deployRest > 0) return;

  if (zielLebt(s, e)) {
    const p = zielPunkt(s, e);
    const abstand2 = dist2(e.x, e.y, p.x, p.y);
    const reichweite = e.reichweite + p.radius;
    if (abstand2 <= reichweite * reichweite) {
      // In Reichweite - stehen bleiben, aber das Ziel ansehen.
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const laenge = isqrt(dx * dx + dy * dy);
      if (laenge > 0) {
        e.blickX = Math.trunc((dx * 1000) / laenge);
        e.blickY = Math.trunc((dy * 1000) / laenge);
      }
      return;
    }
  }

  wegpunkt(s, e, schritt);
  const dx = schritt.x - e.x;
  const dy = schritt.y - e.y;
  if (dx === 0 && dy === 0) return;

  const tempo = e.bremseRest > 0
    ? Math.trunc((e.tempo * e.bremsePromille) / 1000)
    : e.tempo;
  if (tempo <= 0) return;

  schrittRichtung(dx, dy, tempo, schritt);
  const neuX = e.x + schritt.x;
  const neuY = e.y + schritt.y;

  /* Bodeneinheiten duerfen nicht ins Wasser. Wer es doch versucht -
     etwa nach einem Rueckstoss - bleibt an der Uferkante stehen. */
  if (e.ebene === 'boden' && istImFluss(neuY) && !aufBruecke(neuX)) {
    e.x = clamp(neuX, 0, BREITE);
    return;
  }

  e.x = clamp(neuX, 0, BREITE);
  e.y = clamp(neuY, 0, HOEHE);

  const laenge = isqrt(schritt.x * schritt.x + schritt.y * schritt.y);
  if (laenge > 0) {
    e.blickX = Math.trunc((schritt.x * 1000) / laenge);
    e.blickY = Math.trunc((schritt.y * 1000) / laenge);
  }

  if (!e.ueberFluss && !eigeneHaelfte(e.spieler, e.y) && !istImFluss(e.y)) {
    e.ueberFluss = true;
  }
}

function aufBruecke(x: number): boolean {
  const b = naechsteBruecke(x);
  return Math.abs(x - b.x) <= 1000;
}

/* --------------------- Kollisionsaufloesung ------------------------ */

/**
 * Ueberlappende Bodeneinheiten auseinanderschieben.
 *
 * Jedes Paar wird genau einmal betrachtet (j laeuft ab i+1) und beide
 * werden um die halbe Ueberlappung verschoben, gedaempft ueber
 * KAMPF.schiebenPromille. Ueber mehrere Ticks loest sich ein Knaeuel
 * damit weich auf, statt in einem Tick auseinanderzuspringen.
 *
 * Luft nimmt daran nicht teil - Flieger duerfen sich ueberlagern.
 */
export function kollisionAufloesen(s: MatchState): void {
  const liste = s.einheiten;
  for (let i = 0; i < liste.length; i++) {
    const a = liste[i]!;
    if (!a.aktiv || a.ebene !== 'boden' || a.istGebaeude) continue;
    for (let j = i + 1; j < liste.length; j++) {
      const b = liste[j]!;
      if (!b.aktiv || b.ebene !== 'boden') continue;

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const summe = a.radius + b.radius;
      const d2 = dx * dx + dy * dy;
      if (d2 >= summe * summe) continue;

      if (d2 === 0) {
        /* Exakt uebereinander - eine Richtung ist nicht bestimmbar.
           Der hoehere Index weicht nach rechts aus; das ist beliebig,
           aber auf jedem Geraet dieselbe Willkuer. */
        b.x += 1;
        continue;
      }

      const d = isqrt(d2);
      const ueberlappung = summe - d;
      const schub = Math.trunc((ueberlappung * KAMPF.schiebenPromille) / 1000);
      if (schub <= 0) continue;

      const sx = Math.trunc((dx * schub) / d / 2);
      const sy = Math.trunc((dy * schub) / d / 2);

      // Gebaeude stehen fest und werden nicht geschoben.
      if (!b.istGebaeude) {
        b.x = clamp(b.x + sx, 0, BREITE);
        b.y = clamp(b.y + sy, 0, HOEHE);
      }
      a.x = clamp(a.x - sx, 0, BREITE);
      a.y = clamp(a.y - sy, 0, HOEHE);
    }
  }
}
