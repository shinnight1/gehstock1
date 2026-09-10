/* ------------------------------------------------------------------
   Pruefsumme ueber den Matchzustand.

   Im Onlinemodus rechnen Server und beide Clients dieselbe Partie
   parallel. Das funktioniert, solange die Simulation deterministisch
   bleibt - und genau das prueft diese Datei nach: der Server schickt
   einmal pro Sekunde die Pruefsumme seines Zustands mit, der Client
   vergleicht sie mit seiner eigenen. Weichen sie ab, holt er sich
   einen Schnappschuss und setzt neu auf.

   Ohne diese Kontrolle waere eine Abweichung unsichtbar, bis einer
   der beiden Spieler eine Einheit sieht, die es beim anderen nicht
   gibt - und dann ist die Partie schon lange kaputt.

   Gehasht wird nur, was die Simulation selbst liest oder schreibt.
   Reine Anzeigefelder sind trotzdem dabei: sie werden ebenfalls
   deterministisch berechnet, und je mehr in die Summe eingeht, desto
   frueher faellt eine Abweichung auf.

   FNV-1a, 32 Bit. Nicht kryptographisch - es geht um Versehen, nicht
   um Angriffe. Wer manipulieren will, kommt an der Pruefung des
   Servers ohnehin nicht vorbei.
   ------------------------------------------------------------------ */

import type { MatchState } from './state.js';

const FNV_START = 0x811c9dc5;
const FNV_PRIM = 0x01000193;

function zahl(h: number, wert: number): number {
  /* Auf ganze Zahlen zwingen: die Sim rechnet in Millitiles, also
     ohnehin ganzzahlig - aber ein versehentlicher Bruch soll die
     Summe nicht von der Rundung des Ausgabegeraets abhaengig machen. */
  let v = Math.trunc(wert) | 0;
  for (let i = 0; i < 4; i++) {
    h = Math.imul(h ^ (v & 0xff), FNV_PRIM);
    v >>>= 8;
  }
  return h;
}

function text(h: number, wert: string): number {
  for (let i = 0; i < wert.length; i++) {
    h = Math.imul(h ^ (wert.charCodeAt(i) & 0xff), FNV_PRIM);
  }
  return Math.imul(h ^ 0xff, FNV_PRIM);
}

function jaNein(h: number, wert: boolean): number {
  return Math.imul(h ^ (wert ? 1 : 2), FNV_PRIM);
}

/**
 * Pruefsumme des gesamten Zustands.
 *
 * Zwei Zustaende mit derselben Summe sind mit an Sicherheit grenzender
 * Wahrscheinlichkeit gleich. Zwei mit verschiedener Summe sind
 * garantiert verschieden - und nur diese Richtung wird ausgewertet.
 */
export function pruefsumme(s: MatchState): number {
  let h = FNV_START;

  h = zahl(h, s.tick);
  h = text(h, s.phase);
  h = zahl(h, s.seed);
  h = zahl(h, s.rng.a);
  h = zahl(h, s.rng.b);
  h = zahl(h, s.rng.c);
  h = zahl(h, s.rng.d);
  h = zahl(h, s.naechsteId);
  h = text(h, s.ausgang ?? '-');

  /* Ueber den Feldindex, nicht ueber eine gefilterte Liste: die
     Belegung der Plaetze gehoert zum Zustand. Zwei Geraete mit
     denselben Einheiten auf verschiedenen Plaetzen wuerden sich
     spaeter unterschiedlich verhalten. */
  for (let i = 0; i < s.einheiten.length; i++) {
    const e = s.einheiten[i]!;
    h = jaNein(h, e.aktiv);
    if (!e.aktiv) continue;
    h = zahl(h, e.id);
    h = zahl(h, e.spieler);
    h = text(h, e.karte);
    h = zahl(h, e.level);
    h = zahl(h, e.x);
    h = zahl(h, e.y);
    h = zahl(h, e.hp);
    h = zahl(h, e.angriffCd);
    h = zahl(h, e.deployRest);
    h = zahl(h, e.bremseRest);
    h = zahl(h, e.bremsePromille);
    h = zahl(h, e.lebensdauerRest);
    h = zahl(h, e.spawnCd);
    h = text(h, e.zielArt);
    h = zahl(h, e.zielIndex);
    h = zahl(h, e.zielId);
    h = jaNein(h, e.ueberFluss);
    h = zahl(h, e.brueckeX);
  }

  for (let i = 0; i < s.projektile.length; i++) {
    const p = s.projektile[i]!;
    h = jaNein(h, p.aktiv);
    if (!p.aktiv) continue;
    h = zahl(h, p.spieler);
    h = zahl(h, p.x);
    h = zahl(h, p.y);
    h = zahl(h, p.zielX);
    h = zahl(h, p.zielY);
    h = zahl(h, p.dmg);
  }

  for (const t of s.tuerme) {
    h = zahl(h, t.hp);
    h = zahl(h, t.angriffCd);
    h = jaNein(h, t.wach);
    h = zahl(h, t.zielIndex);
    h = zahl(h, t.zielId);
    h = zahl(h, t.gefallenTick);
  }

  for (const p of s.spieler) {
    h = zahl(h, p.elixir);
    h = zahl(h, p.elixirRest);
    h = zahl(h, p.tuermeZerstoert);
    for (const id of p.hand) h = text(h, id);
    for (const id of p.queue) h = text(h, id);
    for (const f of p.offeneFlanken) h = text(h, f);
  }

  // Vorzeichenlos, damit die Summe als Zahl vergleichbar bleibt.
  return h >>> 0;
}
