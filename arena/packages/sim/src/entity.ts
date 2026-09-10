/* ------------------------------------------------------------------
   Anlegen und Aufraeumen: Match, Einheiten, Projektile.

   Die Felder werden einmal beim Matchstart gefuellt und danach nur
   noch umgewidmet. Im laufenden Spiel entsteht hier kein einziges
   neues Objekt - das ist der Unterschied zwischen gleichmaessigen
   60 Bildern und einem Ruckler, sobald der Muellsammler anspringt.
   ------------------------------------------------------------------ */

import { rngAusSeed } from './rng.js';
import type { Spieler, Flanke } from './types.js';
import { gegner } from './types.js';
import {
  MAX_EINHEITEN, MAX_PROJEKTILE,
} from './state.js';
import type {
  MatchState, Einheit, Projektil, Turm, SpielerState, Ereignis,
} from './state.js';
import {
  KOENIG_X, SEITE_LINKS_X, SEITE_RECHTS_X, KOENIG_RADIUS, SEITE_RADIUS, turmY,
} from './arena.js';
import { TURM, DECK, LEVEL, ELIXIR } from './data/balance.js';

function leereEinheit(): Einheit {
  return {
    aktiv: false, id: 0, spieler: 0, karte: '', level: 1,
    x: 0, y: 0, hp: 0, maxHp: 0,
    dmg: 0, angriffsTakt: 1, angriffCd: 0, tempo: 0, reichweite: 0,
    zieltAuf: 'boden', schadensTyp: 'einzel', ebene: 'boden',
    radius: 0, flaechenRadius: 0,
    istGebaeude: false, lebensdauerRest: -1,
    spawnCd: -1, spawnKarte: '', spawnAnzahl: 0,
    deployRest: 0, bremseRest: 0, bremsePromille: 1000,
    zielArt: 'keins', zielIndex: -1, zielId: 0,
    ueberFluss: false, brueckeX: 0,
    blickX: 0, blickY: 1, getroffenTick: -1000,
  };
}

function leeresProjektil(): Projektil {
  return {
    aktiv: false, spieler: 0, x: 0, y: 0, zielX: 0, zielY: 0,
    tempo: 0, dmg: 0, schadensTyp: 'einzel', flaechenRadius: 0,
    zieltAuf: 'beides', radius: 0, farbe: '#ffffff',
  };
}

function tuermeAnlegen(): Turm[] {
  const liste: Turm[] = [];
  for (const spieler of [0, 1] as const) {
    liste.push({
      spieler, art: 'koenig', flanke: null,
      x: KOENIG_X, y: turmY(spieler, 'koenig'),
      hp: TURM.koenig.hp, maxHp: TURM.koenig.hp, radius: KOENIG_RADIUS,
      dmg: TURM.koenig.dmg, angriffsTakt: TURM.koenig.angriffsTakt,
      angriffCd: 0, reichweite: TURM.koenig.reichweite,
      // Der Koenig schlaeft, bis er getroffen wird oder eine Flanke faellt.
      wach: false, zielIndex: -1, zielId: 0,
      getroffenTick: -1000, gefallenTick: -1,
    });
    const seiten: { flanke: Flanke; x: number }[] = [
      { flanke: 'links', x: SEITE_LINKS_X },
      { flanke: 'rechts', x: SEITE_RECHTS_X },
    ];
    for (const s of seiten) {
      liste.push({
        spieler, art: 'seite', flanke: s.flanke,
        x: s.x, y: turmY(spieler, 'seite'),
        hp: TURM.seite.hp, maxHp: TURM.seite.hp, radius: SEITE_RADIUS,
        dmg: TURM.seite.dmg, angriffsTakt: TURM.seite.angriffsTakt,
        angriffCd: 0, reichweite: TURM.seite.reichweite,
        wach: true, zielIndex: -1, zielId: 0,
        getroffenTick: -1000, gefallenTick: -1,
      });
    }
  }
  return liste;
}

export interface MatchAufbau {
  seed: number;
  /** Decks beider Spieler, je acht Karten-Ids. */
  decks: [string[], string[]];
  /** Kartenlevel je Spieler. Fehlt ein Eintrag, gilt Level 1. */
  level?: [Record<string, number>, Record<string, number>];
  /**
   * Einheitliche Level: beide Seiten spielen auf derselben Stufe.
   *
   * Voreinstellung bei Freundesduellen, und zwar mit Absicht - sonst
   * entscheidet, wer laenger gesammelt hat, statt wer besser spielt.
   * Trophaeen-Matches gegen den Bot laufen mit den echten Leveln.
   */
  einheitlicheLevel?: boolean;
}

function spielerAnlegen(
  deck: string[], level: Record<string, number>, einheitlich: boolean,
): SpielerState {
  const stufen: Record<string, number> = {};
  for (const id of deck) {
    stufen[id] = einheitlich ? LEVEL.einheitlich : (level[id] ?? 1);
  }
  return {
    // Startvorrat laut balance.ts - nicht bei null anfangen.
    elixir: ELIXIR.start, elixirRest: 0,
    deck: deck.slice(),
    level: stufen,
    hand: [],
    queue: [],
    offeneFlanken: [],
    tuermeZerstoert: 0,
  };
}

/**
 * Ein Match aufbauen. Der Zustand ist danach vollstaendig - alle
 * Felder sind gefuellt, es wird spaeter nichts mehr nachgelegt.
 *
 * Hand und Warteschlange bleiben leer; sie fuellt deck.ts beim ersten
 * Tick, damit die Reihenfolge aus dem Match-RNG kommt und nicht aus
 * der Aufrufreihenfolge hier.
 */
export function matchAnlegen(aufbau: MatchAufbau): MatchState {
  const einheitlich = aufbau.einheitlicheLevel ?? false;
  const level = aufbau.level ?? [{}, {}];

  const einheiten: Einheit[] = new Array(MAX_EINHEITEN);
  const freieEinheiten: number[] = new Array(MAX_EINHEITEN);
  for (let i = 0; i < MAX_EINHEITEN; i++) {
    einheiten[i] = leereEinheit();
    // Rueckwaerts, damit der niedrigste Index zuerst vergeben wird.
    freieEinheiten[i] = MAX_EINHEITEN - 1 - i;
  }

  const projektile: Projektil[] = new Array(MAX_PROJEKTILE);
  const freieProjektile: number[] = new Array(MAX_PROJEKTILE);
  for (let i = 0; i < MAX_PROJEKTILE; i++) {
    projektile[i] = leeresProjektil();
    freieProjektile[i] = MAX_PROJEKTILE - 1 - i;
  }

  return {
    tick: 0,
    phase: 'countdown',
    seed: aufbau.seed,
    rng: rngAusSeed(aufbau.seed),
    einheiten,
    freieEinheiten,
    projektile,
    freieProjektile,
    tuerme: tuermeAnlegen(),
    spieler: [
      spielerAnlegen(aufbau.decks[0], level[0], einheitlich),
      spielerAnlegen(aufbau.decks[1], level[1], einheitlich),
    ],
    naechsteId: 1,
    ausgang: null,
    ereignisse: [],
  };
}

/* --------------------------- Einheiten ----------------------------- */

/**
 * Freien Platz holen. Gibt -1 zurueck, wenn das Feld voll ist - dann
 * wird die Einheit schlicht nicht erzeugt. Ein Absturz waere hier
 * die schlechtere Antwort: DECK.groesse Karten koennen bei extremen
 * Schwaermen theoretisch an die Grenze stossen, und ein fehlender
 * Skelettkrieger ist verschmerzbar.
 */
export function einheitPlatz(s: MatchState): number {
  const i = s.freieEinheiten.pop();
  return i === undefined ? -1 : i;
}

export function einheitFreigeben(s: MatchState, index: number): void {
  const e = s.einheiten[index]!;
  if (!e.aktiv) return;
  e.aktiv = false;
  e.zielArt = 'keins';
  e.zielIndex = -1;
  s.freieEinheiten.push(index);
}

export function projektilPlatz(s: MatchState): number {
  const i = s.freieProjektile.pop();
  return i === undefined ? -1 : i;
}

export function projektilFreigeben(s: MatchState, index: number): void {
  const p = s.projektile[index]!;
  if (!p.aktiv) return;
  p.aktiv = false;
  s.freieProjektile.push(index);
}

/* --------------------------- Ereignisse ---------------------------- */

export function ereignis(
  s: MatchState, art: Ereignis['art'], spieler: Spieler,
  x: number, y: number, radius: number, karte: string,
): void {
  s.ereignisse.push({ art, spieler, x, y, radius, karte });
}

/* ----------------------------- Tuerme ------------------------------ */

/** Der Koenig-Turm eines Spielers. Es gibt immer genau einen. */
export function koenigVon(s: MatchState, spieler: Spieler): Turm {
  for (const t of s.tuerme) if (t.spieler === spieler && t.art === 'koenig') return t;
  throw new Error('Koenig fehlt - der Aufbau ist kaputt');
}

/** Weckt den Koenig. Ohne Wirkung, wenn er schon wach ist. */
export function koenigWecken(s: MatchState, spieler: Spieler): void {
  const k = koenigVon(s, spieler);
  if (k.wach || k.hp <= 0) return;
  k.wach = true;
  // Er braucht einen Moment, bis er zum ersten Mal schiesst.
  k.angriffCd = TURM.koenig.aufwachVerzoegerung;
}

/** Meldet einen gefallenen Turm: Flanke oeffnen, Koenig wecken. */
export function turmGefallen(s: MatchState, turm: Turm): void {
  turm.gefallenTick = s.tick;
  const angreifer = gegner(turm.spieler);
  s.spieler[angreifer].tuermeZerstoert++;
  if (turm.art === 'seite' && turm.flanke) {
    const offen = s.spieler[angreifer].offeneFlanken;
    if (offen.indexOf(turm.flanke) < 0) offen.push(turm.flanke);
    // Ein gefallener Seitenturm weckt den eigenen Koenig.
    koenigWecken(s, turm.spieler);
  }
  ereignis(s, 'turmfall', turm.spieler, turm.x, turm.y, turm.radius, turm.art);
}

export { DECK };
