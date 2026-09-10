/* ------------------------------------------------------------------
   Zustand einpacken und wieder auspacken.

   Gebraucht an drei Stellen im Onlinemodus: wenn ein Spieler mitten
   in einer laufenden Partie wieder dazukommt, wenn eine Pruefsumme
   nicht stimmt, und wenn ein Client nach einem Serverneustart neu
   aufsetzen muss.

   Eingepackt wird nur, was belegt ist. Der Zustand haelt 240
   Einheiten- und 160 Projektilplaetze bereit, von denen im Normalfall
   ein Zehntel benutzt ist; alle mitzuschicken waere ein Hundertfaches
   an Daten fuer nichts.

   Die Freilisten wandern vollstaendig mit. Sie sehen wie eine
   Nebensaechlichkeit aus, sind aber Teil des Zustands: welcher Platz
   als naechstes vergeben wird, entscheidet ueber die Reihenfolge
   aller kommenden Einheiten - und damit ueber jede Kollision, jede
   Zielwahl und am Ende ueber den Ausgang.

   Ausgepackt wird immer in einen frisch angelegten Zustand hinein.
   So sind alle Felder vorhanden und richtig geformt, auch die leeren
   Plaetze, die gar nicht uebertragen wurden.
   ------------------------------------------------------------------ */

import type { RngState } from './rng.js';
import type {
  MatchState, MatchPhase, Ausgang, Einheit, Projektil, Turm, SpielerState,
} from './state.js';
import type { MatchAufbau } from './entity.js';
import { matchAnlegen } from './entity.js';

export interface Schnappschuss {
  tick: number;
  phase: MatchPhase;
  seed: number;
  rng: RngState;
  naechsteId: number;
  ausgang: Ausgang | null;
  /** Belegte Einheitenplaetze, je mit ihrem Index im Feld. */
  einheiten: { i: number; e: Einheit }[];
  freieEinheiten: number[];
  projektile: { i: number; p: Projektil }[];
  freieProjektile: number[];
  tuerme: Turm[];
  spieler: [SpielerState, SpielerState];
}

export function zustandPacken(s: MatchState): Schnappschuss {
  const einheiten: { i: number; e: Einheit }[] = [];
  for (let i = 0; i < s.einheiten.length; i++) {
    const e = s.einheiten[i]!;
    if (e.aktiv) einheiten.push({ i, e: { ...e } });
  }

  const projektile: { i: number; p: Projektil }[] = [];
  for (let i = 0; i < s.projektile.length; i++) {
    const p = s.projektile[i]!;
    if (p.aktiv) projektile.push({ i, p: { ...p } });
  }

  return {
    tick: s.tick,
    phase: s.phase,
    seed: s.seed,
    rng: { ...s.rng },
    naechsteId: s.naechsteId,
    ausgang: s.ausgang,
    einheiten,
    freieEinheiten: s.freieEinheiten.slice(),
    projektile,
    freieProjektile: s.freieProjektile.slice(),
    tuerme: s.tuerme.map((t) => ({ ...t })),
    spieler: [spielerKopie(s.spieler[0]), spielerKopie(s.spieler[1])],
  };
}

/**
 * Zustand wiederherstellen.
 *
 * `aufbau` muss derselbe sein, mit dem die Partie begonnen hat - er
 * bestimmt die Groesse der Felder und die Decks. Was danach passiert
 * ist, steht im Schnappschuss und wird darueber gelegt.
 */
export function zustandEntpacken(aufbau: MatchAufbau, roh: Schnappschuss): MatchState {
  const s = matchAnlegen(aufbau);

  s.tick = roh.tick;
  s.phase = roh.phase;
  s.seed = roh.seed;
  s.rng.a = roh.rng.a;
  s.rng.b = roh.rng.b;
  s.rng.c = roh.rng.c;
  s.rng.d = roh.rng.d;
  s.naechsteId = roh.naechsteId;
  s.ausgang = roh.ausgang;

  /* Erst alles leeren, dann die belegten Plaetze setzen. Ein frisch
     angelegter Zustand hat keine Einheiten, aber ein Zustand, in den
     zweimal ausgepackt wird, koennte welche haben. */
  for (const e of s.einheiten) e.aktiv = false;
  for (const { i, e } of roh.einheiten) {
    const ziel = s.einheiten[i];
    if (ziel) Object.assign(ziel, e);
  }
  s.freieEinheiten.length = 0;
  for (const i of roh.freieEinheiten) s.freieEinheiten.push(i);

  for (const p of s.projektile) p.aktiv = false;
  for (const { i, p } of roh.projektile) {
    const ziel = s.projektile[i];
    if (ziel) Object.assign(ziel, p);
  }
  s.freieProjektile.length = 0;
  for (const i of roh.freieProjektile) s.freieProjektile.push(i);

  for (let i = 0; i < s.tuerme.length; i++) {
    const t = roh.tuerme[i];
    if (t) Object.assign(s.tuerme[i]!, t);
  }

  for (let i = 0; i < 2; i++) {
    const ziel = s.spieler[i]!;
    const quelle = roh.spieler[i]!;
    ziel.elixir = quelle.elixir;
    ziel.elixirRest = quelle.elixirRest;
    ziel.deck = quelle.deck.slice();
    ziel.level = { ...quelle.level };
    ziel.hand = quelle.hand.slice();
    ziel.queue = quelle.queue.slice();
    ziel.offeneFlanken = quelle.offeneFlanken.slice();
    ziel.tuermeZerstoert = quelle.tuermeZerstoert;
  }

  // Ereignisse werden nicht uebertragen: sie gelten nur fuer den Tick,
  // in dem sie entstanden sind, und der ist vorbei.
  s.ereignisse.length = 0;

  return s;
}

function spielerKopie(p: SpielerState): SpielerState {
  return {
    elixir: p.elixir,
    elixirRest: p.elixirRest,
    deck: p.deck.slice(),
    level: { ...p.level },
    hand: p.hand.slice(),
    queue: p.queue.slice(),
    offeneFlanken: p.offeneFlanken.slice(),
    tuermeZerstoert: p.tuermeZerstoert,
  };
}
