/* ------------------------------------------------------------------
   Der Takt: ein Tick, immer in derselben Reihenfolge.

   Die Reihenfolge ist der Kern des Determinismus. Wer sie aendert,
   aendert das Spiel - zwei Geraete mit unterschiedlicher Reihenfolge
   laufen binnen Sekunden auseinander. Sie steht deshalb an genau
   einer Stelle, hier:

     1  Ereignisse des Vortakts verwerfen
     2  Phase fortschreiben
     3  Commands dieses Ticks ausfuehren
     4  Elixir
     5  Bremsen abbauen
     6  Zeitgeber: Deploy, Lebensdauer, Spawner
     7  Ziele suchen
     8  Bewegen
     9  Kollision aufloesen
    10  Einheiten angreifen
    11  Tuerme schiessen
    12  Geschosse fliegen und einschlagen
    13  Sieg pruefen

   Warum Ziele vor der Bewegung: eine Einheit soll in dem Tick, in dem
   ihr Ziel stirbt, schon das neue anlaufen - nicht erst im naechsten.
   Warum Kollision nach der Bewegung: sonst schoebe man Einheiten
   auseinander, die sich gleich darauf wieder ueberlappen.
   ------------------------------------------------------------------ */

import type { MatchState, Ausgang } from './state.js';
import type { Command } from './commands.js';
import { commandsAnwenden } from './commands.js';
import { elixirTick, handAusteilen } from './hand.js';
import { bewegen, kollisionAufloesen } from './bewegung.js';
import { zielSuchen } from './ziel.js';
import { angreifen, tuermeSchiessen, geschosseBewegen } from './kampf.js';
import { bremsenTicken } from './zauber.js';
import { spawnerWelle } from './spawn.js';
import { einheitFreigeben, ereignis, koenigVon } from './entity.js';
import { karteVon } from './data/cards.js';
import { MATCH } from './data/balance.js';

/** Ticks seit dem Anpfiff. Waehrend des Countdowns negativ oder null. */
export function matchZeit(s: MatchState): number {
  return Math.max(0, s.tick - MATCH.countdown);
}

/** Verbleibende Ticks im laufenden Abschnitt. */
export function restZeit(s: MatchState): number {
  if (s.phase === 'countdown') return MATCH.countdown - s.tick;
  if (s.phase === 'overtime') {
    return Math.max(0, MATCH.dauer + MATCH.overtime - matchZeit(s));
  }
  return Math.max(0, MATCH.dauer - matchZeit(s));
}

/* --------------------------- Zeitgeber ----------------------------- */

function zeitgeber(s: MatchState): void {
  for (let i = 0; i < s.einheiten.length; i++) {
    const e = s.einheiten[i]!;
    if (!e.aktiv) continue;

    if (e.deployRest > 0) {
      e.deployRest--;
      continue;
    }

    if (e.lebensdauerRest > 0) {
      e.lebensdauerRest--;
      if (e.lebensdauerRest === 0) {
        // Ein Gebaeude am Ende seiner Zeit zerfaellt, es stirbt nicht.
        ereignis(s, 'tod', e.spieler, e.x, e.y, e.radius, e.karte);
        einheitFreigeben(s, i);
        continue;
      }
    }

    if (e.spawnCd > 0) {
      e.spawnCd--;
      if (e.spawnCd === 0) {
        spawnerWelle(s, i);
        // Naechste Welle: der Takt steht in den Kartendaten, nicht im
        // Zustand - eine zweite Wahrheit waere eine zweite Fehlerquelle.
        e.spawnCd = karteVon(e.karte)?.spawnTakt ?? -1;
      }
    }
  }
}

/* ---------------------------- Ausgang ------------------------------ */

function koenigTot(s: MatchState, spieler: 0 | 1): boolean {
  return koenigVon(s, spieler).hp <= 0;
}

function beenden(s: MatchState, ausgang: Ausgang): void {
  s.phase = 'ende';
  s.ausgang = ausgang;
}

function siegPruefen(s: MatchState): void {
  if (s.phase === 'ende') return;

  // Ein gefallener Koenig entscheidet sofort, unabhaengig von der Uhr.
  if (koenigTot(s, 0)) { beenden(s, 'sieg1'); return; }
  if (koenigTot(s, 1)) { beenden(s, 'sieg0'); return; }

  const zeit = matchZeit(s);

  if (s.phase === 'overtime') {
    /* In der Verlaengerung entscheidet der erste Turm. Fallen in
       demselben Tick beide, bleibt es unentschieden - das ist
       seltener als ein Bug, aber es muss eine Antwort geben. */
    const a = s.spieler[0].tuermeZerstoert;
    const b = s.spieler[1].tuermeZerstoert;
    if (a !== b) { beenden(s, a > b ? 'sieg0' : 'sieg1'); return; }
    if (zeit >= MATCH.dauer + MATCH.overtime) beenden(s, 'unentschieden');
    return;
  }

  if (zeit >= MATCH.dauer) {
    const a = s.spieler[0].tuermeZerstoert;
    const b = s.spieler[1].tuermeZerstoert;
    if (a > b) { beenden(s, 'sieg0'); return; }
    if (b > a) { beenden(s, 'sieg1'); return; }
    // Gleichstand: Verlaengerung mit dreifachem Elixir.
    s.phase = 'overtime';
  }
}

/* ----------------------------- Tick -------------------------------- */

/**
 * Einen Tick simulieren.
 *
 * `commands` darf alle bekannten Zuege enthalten; ausgefuehrt werden
 * nur die, deren tick auf den aktuellen faellt.
 */
export function tick(s: MatchState, commands: readonly Command[] = []): void {
  if (s.phase === 'ende') return;

  s.ereignisse.length = 0;

  if (s.phase === 'countdown') {
    if (s.tick === 0) handAusteilen(s);
    s.tick++;
    if (s.tick >= MATCH.countdown) s.phase = 'laeuft';
    return;
  }

  commandsAnwenden(s, commands);
  elixirTick(s);
  bremsenTicken(s);
  zeitgeber(s);

  for (const e of s.einheiten) {
    if (!e.aktiv || e.deployRest > 0) continue;
    zielSuchen(s, e);
  }

  for (const e of s.einheiten) {
    if (!e.aktiv) continue;
    bewegen(s, e);
  }

  kollisionAufloesen(s);

  for (const e of s.einheiten) {
    if (!e.aktiv) continue;
    angreifen(s, e);
  }

  tuermeSchiessen(s);
  geschosseBewegen(s);

  s.tick++;
  siegPruefen(s);
}

/** Mehrere Ticks am Stueck - fuer Tests und Bot-Simulationen. */
export function ticks(s: MatchState, anzahl: number, commands: readonly Command[] = []): void {
  for (let i = 0; i < anzahl && s.phase !== 'ende'; i++) tick(s, commands);
}
