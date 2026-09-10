/* ------------------------------------------------------------------
   Der Bot.

   Er sieht genau das, was ein Mensch auch sieht: was auf dem Feld
   steht, wie viel Elixir er selbst hat, wie es um die Tuerme steht.
   Die gegnerische Hand kennt er nicht, Extra-Elixir bekommt er nicht.

   Sein Ablauf pro Tick ist kurz:

     1  Reaktionszeit abwarten
     2  Ist eine Bedrohung auf meiner Haelfte? -> kontern
     3  Sonst: lohnt ein Angriff? -> setzen
     4  Sonst: warten

   Wie gut jeder dieser Schritte ausfaellt, steuert das Profil. Ein
   schwacher Bot reagiert spaet, greift oft zur falschen Karte und
   setzt ungenau; ein starker wartet auf Elixirvorteil und trifft.

   Der Bot ist Teil der Simulation und benutzt deren RNG. Zwei
   Geraete, die dasselbe Match nachrechnen, bekommen denselben Bot.
   ------------------------------------------------------------------ */

import { clamp } from '../fixed.js';
import { rngInt, rngChance } from '../rng.js';
import { BREITE, HOEHE, FLUSS_OBEN, FLUSS_UNTEN, naechsteBruecke } from '../arena.js';
import type { Spieler } from '../types.js';
import { gegner } from '../types.js';
import type { MatchState } from '../state.js';
import { karteVon } from '../data/cards.js';
import { besterKonter } from '../data/konter.js';
import { ELIXIR } from '../data/balance.js';
import type { BotProfil } from './profil.js';
import { fuehreZugAus } from '../commands.js';

export interface BotZustand {
  spieler: Spieler;
  profil: BotProfil;
  /** Ticks, bis der Bot wieder handeln darf. */
  wartet: number;
  /** Wie viele Einheiten der Gegner beim letzten Blick hatte. */
  gesehen: number;
}

export function botAnlegen(spieler: Spieler, profil: BotProfil): BotZustand {
  return { spieler, profil, wartet: profil.reaktion, gesehen: 0 };
}

/** Die gefaehrlichste gegnerische Einheit auf der eigenen Haelfte. */
function groessteBedrohung(s: MatchState, ich: Spieler): {
  karte: string; x: number; y: number;
} | null {
  const feind = gegner(ich);
  let besteId = '';
  let besterWert = 0;
  let bx = 0;
  let by = 0;

  for (const e of s.einheiten) {
    if (!e.aktiv || e.spieler !== feind || e.hp <= 0) continue;
    // Nur was schon herueben ist oder gleich herueben sein wird.
    const drueben = ich === 0 ? e.y > FLUSS_OBEN : e.y < FLUSS_UNTEN;
    if (!drueben) continue;

    /* Bewertung: verbleibende Trefferpunkte plus ein Aufschlag fuer
       alles, was auf Gebaeude zielt - ein Tank, der stur zum Turm
       laeuft, ist gefaehrlicher als ein gleich dicker, der unterwegs
       stehen bleibt. */
    let wert = e.hp;
    if (e.zieltAuf === 'nur_gebaeude') wert += 800;
    if (e.ebene === 'luft') wert += 400;
    if (wert > besterWert) {
      besterWert = wert;
      besteId = e.karte;
      bx = e.x;
      by = e.y;
    }
  }

  return besteId ? { karte: besteId, x: bx, y: by } : null;
}

/** Streuung auf einen Wert legen. */
function ungenau(s: MatchState, wert: number, fehler: number): number {
  if (fehler <= 0) return wert;
  return wert + rngInt(s.rng, fehler * 2 + 1) - fehler;
}

/** Irgendeine bezahlbare Karte der Hand. */
function irgendeine(s: MatchState, ich: Spieler, nurEinheiten = false): string | null {
  const p = s.spieler[ich];
  const moeglich = p.hand.filter((id) => {
    const k = karteVon(id);
    if (!k || k.elixir > p.elixir) return false;
    return !nurEinheiten || k.art !== 'zauber';
  });
  if (!moeglich.length) return null;
  return moeglich[rngInt(s.rng, moeglich.length)]!;
}

/**
 * Die teuerste bezahlbare Karte - fuer den Angriff eines starken Bots.
 *
 * Wer angreift, will moeglichst viel Material auf einmal ueber die
 * Bruecke schicken. Vier einzelne Zweierkarten nacheinander werden
 * einzeln abgeraeumt; eine Fuenferkarte ueberlebt die erste Antwort.
 */
function teuerste(s: MatchState, ich: Spieler): string | null {
  const p = s.spieler[ich];
  let beste: string | null = null;
  let preis = -1;
  for (const id of p.hand) {
    const k = karteVon(id);
    if (!k || k.art === 'zauber' || k.elixir > p.elixir) continue;
    if (k.elixir > preis) { preis = k.elixir; beste = id; }
  }
  return beste;
}

/** Wo eine Verteidigung hin soll: zwischen Bedrohung und eigenem Turm. */
function abwehrPunkt(
  s: MatchState, ich: Spieler, zielX: number, zielY: number, fehler: number,
): { x: number; y: number } {
  const rueckwaerts = ich === 0 ? 1 : -1;
  const x = ungenau(s, zielX, fehler);
  const y = ungenau(s, zielY + rueckwaerts * 2200, fehler);
  return {
    x: clamp(x, 500, BREITE - 500),
    y: clamp(y, ich === 0 ? FLUSS_UNTEN : 500, ich === 0 ? HOEHE - 500 : FLUSS_OBEN),
  };
}

/** Wo ein Angriff starten soll: hinter der eigenen Linie, an einer Bruecke. */
function angriffsPunkt(
  s: MatchState, ich: Spieler, fehler: number,
): { x: number; y: number } {
  const bruecke = rngInt(s.rng, 2) === 0
    ? naechsteBruecke(0).x
    : naechsteBruecke(BREITE).x;
  const tiefe = ich === 0 ? FLUSS_UNTEN + 3500 : FLUSS_OBEN - 3500;
  return {
    x: clamp(ungenau(s, bruecke, fehler), 500, BREITE - 500),
    y: clamp(ungenau(s, tiefe, fehler), ich === 0 ? FLUSS_UNTEN : 500,
      ich === 0 ? HOEHE - 500 : FLUSS_OBEN),
  };
}

/**
 * Einen Tick Bot.
 *
 * Wird nach den Commands und vor der Simulation gerufen; ein
 * gesetzter Zug wirkt also im selben Tick.
 */
export function botTick(s: MatchState, b: BotZustand): void {
  if (s.phase !== 'laeuft' && s.phase !== 'overtime') return;
  if (b.wartet > 0) { b.wartet--; return; }

  const ich = b.spieler;
  const p = s.spieler[ich];
  const bedrohung = groessteBedrohung(s, ich);

  if (bedrohung) {
    const konter = besterKonter(bedrohung.karte, p.hand);
    /* Nur mit der Genauigkeit des Profils greift er zur richtigen
       Karte. Sonst nimmt er die billigste - das ist nicht dumm, aber
       eben auch nicht die Antwort. */
    const nimmtKonter = konter
      && rngChance(s.rng, b.profil.konterGenauigkeit, 1000);
    /* Trifft er den Konter nicht, greift er blind in die Hand. Frueher
       stand hier "die billigste Karte" - das war als Fehlgriff zu gut:
       eine billige Verteidigung ist oft genau richtig, und der schwache
       Bot gewann damit fast so viele Partien wie der starke. */
    const id = nimmtKonter ? konter.kartenId : irgendeine(s, ich);
    if (!id) { b.wartet = 4; return; }

    const karte = karteVon(id);
    if (!karte || karte.elixir > p.elixir) { b.wartet = 4; return; }

    const ziel = karte.art === 'zauber'
      ? { x: bedrohung.x, y: bedrohung.y }
      : abwehrPunkt(s, ich, bedrohung.x, bedrohung.y, b.profil.platzierungsFehler);

    fuehreZugAus(s, {
      typ: 'playCard', spieler: ich, kartenId: id,
      tick: s.tick, x: ziel.x, y: ziel.y,
    });
    b.wartet = b.profil.reaktion;
    return;
  }

  /* Kein Angriff auf mich. Ob er selbst angreift, haengt an der
     Elixirdisziplin: ein disziplinierter Bot wartet, bis er fast voll
     ist, ein undisziplinierter gibt sofort aus. */
  const schwelle = 3 + Math.trunc((b.profil.elixirDisziplin * 5) / 1000);
  const dringend = b.profil.pushTiming && s.tick > 0 && p.elixir >= ELIXIR.cap - 1;
  if (p.elixir < schwelle && !dringend) { b.wartet = 6; return; }

  /* Zauber nicht ins Leere werfen. Ohne Ziel sind sie verschwendet,
     und ein Bot, der Feuerstuerme auf leeres Gras wirft, wirkt
     kaputt - nicht schwach. */
  const kandidaten = p.hand.filter((id) => {
    const k = karteVon(id);
    return !!k && k.art !== 'zauber' && k.elixir <= p.elixir;
  });
  if (!kandidaten.length) { b.wartet = 6; return; }

  /* Ein disziplinierter Bot schickt sein teuerstes Stueck los, ein
     undisziplinierter irgendwas. */
  const gezielt = rngChance(s.rng, b.profil.elixirDisziplin, 1000);
  const id = (gezielt ? teuerste(s, ich) : null)
    ?? kandidaten[rngInt(s.rng, kandidaten.length)]!;
  const ziel = angriffsPunkt(s, ich, b.profil.platzierungsFehler);
  fuehreZugAus(s, {
    typ: 'playCard', spieler: ich, kartenId: id,
    tick: s.tick, x: ziel.x, y: ziel.y,
  });
  b.wartet = b.profil.reaktion;
}

/**
 * Ein Deck fuer den Bot bauen.
 *
 * `deckQualitaet` entscheidet, wie stimmig es ausfaellt: ein starker
 * Bot bekommt eine ausgewogene Mischung mit Antworten auf Luft und
 * Schwaerme, ein schwacher eine zufaellige Auswahl, die auch mal
 * vier Zauber enthaelt.
 */
export function botDeck(
  s: MatchState, alle: readonly string[], qualitaet: number, groesse: number,
): string[] {
  const rest = alle.slice();
  const deck: string[] = [];

  /* Ein stimmiges Deck braucht diese Rollen. Die Reihenfolge ist die
     Wichtigkeit: ohne Antwort auf Luft verliert man gegen halbe
     Decks, ohne Flaechenschaden gegen jeden Schwarm. */
  const geruest = [
    ['speerwerferinnen', 'bogenschuetzin', 'flammenspeier'],
    ['hammergarde', 'flammenspeier', 'funkenregen'],
    ['steinwaechter', 'frostkoloss', 'wolkenwal'],
    ['rattenschar', 'hundemeute', 'sturmfalken'],
    ['funkenregen', 'feuersturm', 'frostschleier'],
    ['bollwerk', 'krypta', 'frostkoloss'],
  ];

  for (const rolle of geruest) {
    if (deck.length >= groesse) break;
    if (!rngChance(s.rng, qualitaet, 1000)) continue;
    for (const id of rolle) {
      const i = rest.indexOf(id);
      if (i < 0) continue;
      deck.push(id);
      rest.splice(i, 1);
      break;
    }
  }

  while (deck.length < groesse && rest.length) {
    const i = rngInt(s.rng, rest.length);
    deck.push(rest[i]!);
    rest.splice(i, 1);
  }
  return deck;
}
