/* ------------------------------------------------------------------
   Der Kontostand eines Spielers.

   Alles, was ein Match ueberdauert, steht hier: welche Karten man
   besitzt, wie viele Splitter und welches Level sie haben, wie viele
   Rolls offen sind, wie die Pity-Zaehler stehen, wie viele Trophaeen
   man hat und wie die letzten Partien ausgingen.

   Das Package ist isomorph. Derselbe Code laeuft im Browser gegen
   localStorage und spaeter im Server gegen dessen Speicher - ein Roll
   muss auf beiden Seiten dasselbe Ergebnis liefern koennen, sonst
   liesse sich serverseitiges Ziehen nicht gegen den Client pruefen.

   Der Roll-RNG steckt im Profil und ist ausdruecklich nicht der
   Sim-RNG. Was man zieht, darf nicht davon abhaengen, wie ein Match
   verlaufen ist.
   ------------------------------------------------------------------ */

import { KARTEN_IDS, LEVEL, ROLL, TROPHAEEN } from '@arena/sim';
import type { RngState } from '@arena/sim';
import { rngAusSeed } from '@arena/sim';

/** Was man von einer einzelnen Karte besitzt. */
export interface KartenBesitz {
  /** 1 bis LEVEL.max. */
  level: number;
  /** Angesammelte Splitter fuer die naechste Stufe. */
  splitter: number;
}

export interface MatchNotiz {
  /** Zeitpunkt in Millisekunden - nur zum Anzeigen, nie fuer Logik. */
  zeit: number;
  ausgang: 'sieg' | 'niederlage' | 'unentschieden';
  /** Trophaeenaenderung, mit Vorzeichen. */
  trophaeen: number;
  /** Wie viele Tuerme man selbst zerstoert hat, und wie viele der Gegner. */
  tuerme: [number, number];
}

export interface Profil {
  /** Format der Struktur. Steigt, wenn sich das Schema aendert. */
  version: number;
  /** Zufaellige, dauerhafte Kennung. Ersetzt spaeter kein Konto. */
  id: string;
  name: string;

  /** Besitz je Karten-Id. Fehlt eine Karte, besitzt man sie nicht. */
  karten: Record<string, KartenBesitz>;
  /** Das aktuelle Deck, acht Karten-Ids. */
  deck: string[];

  /** Offene Rolls. Stapelbar, ohne Obergrenze. */
  rolls: number;
  /** Zaehler seit dem letzten Episch-oder-besser. */
  seitEpisch: number;
  /** Zaehler seit dem letzten Legendaer. */
  seitLegendaer: number;
  /** Wie viele Rolls insgesamt gezogen wurden - nur zur Anzeige. */
  rollsGesamt: number;

  trophaeen: number;
  /** Hoechststand - Trophaeen koennen fallen, das hier nicht. */
  bestwert: number;
  siege: number;
  niederlagen: number;
  unentschieden: number;
  /** Die letzten Partien, neueste zuerst. */
  historie: MatchNotiz[];

  /** Zustand des Roll-Generators. Wandert mit dem Profil. */
  rng: RngState;

  /** Wurde das Startpaket schon vergeben? */
  erstpaketVergeben: boolean;
}

export const PROFIL_VERSION = 1;

/** Zufaellige Kennung aus einem Zufallswert. Kein Sicherheitsmerkmal. */
function kennung(zufall: number): string {
  const zeichen = 'abcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  let z = zufall >>> 0;
  for (let i = 0; i < 10; i++) {
    s += zeichen[z % zeichen.length];
    z = Math.trunc(z / zeichen.length) + 7919;
  }
  return s;
}

/**
 * Frisches Profil.
 *
 * `seed` bestimmt Kennung und Roll-Generator. Der Aufrufer zieht ihn
 * aus der Uhr oder aus crypto - das ist die einzige Stelle im ganzen
 * Projekt, an der echter Zufall hineindarf.
 */
export function profilAnlegen(seed: number, name = 'Spieler'): Profil {
  return {
    version: PROFIL_VERSION,
    id: kennung(seed),
    name,
    karten: {},
    deck: [],
    rolls: 0,
    seitEpisch: 0,
    seitLegendaer: 0,
    rollsGesamt: 0,
    trophaeen: 0,
    bestwert: 0,
    siege: 0,
    niederlagen: 0,
    unentschieden: 0,
    historie: [],
    rng: rngAusSeed(seed ^ 0x5f3759df),
    erstpaketVergeben: false,
  };
}

/* ---------------------------- Besitz -------------------------------- */

export function besitzt(p: Profil, kartenId: string): boolean {
  return !!p.karten[kartenId];
}

export function besitzVon(p: Profil, kartenId: string): KartenBesitz | null {
  return p.karten[kartenId] ?? null;
}

export function levelVon(p: Profil, kartenId: string): number {
  return p.karten[kartenId]?.level ?? 1;
}

/** Alle besessenen Karten-Ids, in der Reihenfolge des Katalogs. */
export function besessene(p: Profil): string[] {
  return KARTEN_IDS.filter((id) => besitzt(p, id));
}

/** Kartenlevel als flache Tabelle - so erwartet die Sim sie. */
export function levelTabelle(p: Profil): Record<string, number> {
  const t: Record<string, number> = {};
  for (const id of Object.keys(p.karten)) t[id] = p.karten[id]!.level;
  return t;
}

/* --------------------------- Trophaeen ------------------------------ */

export type Ausgang = 'sieg' | 'niederlage' | 'unentschieden';

/** Trophaeenaenderung fuer einen Ausgang. */
export function trophaeenFuer(ausgang: Ausgang): number {
  if (ausgang === 'sieg') return TROPHAEEN.sieg;
  if (ausgang === 'niederlage') return TROPHAEEN.niederlage;
  return TROPHAEEN.unentschieden;
}

/**
 * Ein beendetes Match verbuchen.
 *
 * Trophaeen, Statistik, Historie und Rolls in einem Schritt - so kann
 * kein Aufrufer die Haelfte davon vergessen. Gibt zurueck, was sich
 * geaendert hat, damit der Match-Ende-Bildschirm es anzeigen kann.
 */
export function matchVerbuchen(
  p: Profil, ausgang: Ausgang, tuerme: [number, number], zeit: number,
): { trophaeen: number; rolls: number; neueTrophaeen: number } {
  const aenderung = trophaeenFuer(ausgang);
  const vorher = p.trophaeen;
  p.trophaeen = Math.max(TROPHAEEN.min, p.trophaeen + aenderung);
  if (p.trophaeen > p.bestwert) p.bestwert = p.trophaeen;

  if (ausgang === 'sieg') p.siege++;
  else if (ausgang === 'niederlage') p.niederlagen++;
  else p.unentschieden++;

  /* Auch eine Niederlage bringt einen Roll. Wer verliert, hat schon
     die Trophaeen verloren - ihm zusaetzlich den Fortschritt zu
     streichen, macht aus einer Pechstraehne einen Grund aufzuhoeren. */
  const rolls = ROLL.proMatch + (ausgang === 'sieg' ? ROLL.bonusSieg : 0);
  p.rolls += rolls;

  p.historie.unshift({
    zeit,
    ausgang,
    // Die tatsaechliche Aenderung, nicht der Nennwert - unten gedeckelt.
    trophaeen: p.trophaeen - vorher,
    tuerme,
  });
  if (p.historie.length > TROPHAEEN.historie) {
    p.historie.length = TROPHAEEN.historie;
  }

  return { trophaeen: p.trophaeen - vorher, rolls, neueTrophaeen: p.trophaeen };
}

/* ---------------------------- Deck ---------------------------------- */

/** Ist das Deck spielbar? Acht Karten, alle im Besitz, keine doppelt. */
export function deckGueltig(p: Profil): boolean {
  if (p.deck.length !== 8) return false;
  if (new Set(p.deck).size !== p.deck.length) return false;
  return p.deck.every((id) => besitzt(p, id));
}

/**
 * Deck notfalls auffuellen.
 *
 * Nach einem Roll kann ein Deck unvollstaendig sein - etwa direkt
 * nach dem Startpaket. Statt den Spieler in den Deckbau zu zwingen,
 * bevor er ueberhaupt etwas gesehen hat, wird hier aufgefuellt: erst
 * bereinigen, was er nicht besitzt, dann die billigsten besessenen
 * Karten dazu, damit das Ergebnis auch spielbar ist.
 */
export function deckAuffuellen(p: Profil, kosten: (id: string) => number): void {
  const gesehen = new Set<string>();
  p.deck = p.deck.filter((id) => {
    if (!besitzt(p, id) || gesehen.has(id)) return false;
    gesehen.add(id);
    return true;
  });

  if (p.deck.length >= 8) {
    p.deck.length = 8;
    return;
  }

  const rest = besessene(p)
    .filter((id) => !gesehen.has(id))
    .sort((a, b) => kosten(a) - kosten(b));
  for (const id of rest) {
    if (p.deck.length >= 8) break;
    p.deck.push(id);
  }
}

/* -------------------------- Wiederherstellen ------------------------ */

/**
 * Ein geladenes Profil pruefen und auffuellen.
 *
 * Gespeicherte Staende sind Fremdkoerper: sie koennen aus einer
 * aelteren Fassung stammen, von Hand veraendert oder halb geschrieben
 * sein. Jedes Feld wird deshalb einzeln geprueft, statt dem Objekt zu
 * vertrauen. Was fehlt, wird ergaenzt; was Unsinn ist, faellt weg.
 */
export function profilPruefen(roh: unknown, seed: number): Profil {
  const frisch = profilAnlegen(seed);
  if (!roh || typeof roh !== 'object') return frisch;
  const q = roh as Partial<Profil>;

  const zahl = (wert: unknown, ersatz: number, min = 0): number =>
    typeof wert === 'number' && Number.isFinite(wert) ? Math.max(min, Math.trunc(wert)) : ersatz;

  const karten: Record<string, KartenBesitz> = {};
  if (q.karten && typeof q.karten === 'object') {
    for (const id of KARTEN_IDS) {
      const b = (q.karten as Record<string, unknown>)[id];
      if (!b || typeof b !== 'object') continue;
      const bb = b as Partial<KartenBesitz>;
      karten[id] = {
        level: Math.min(LEVEL.max, Math.max(1, zahl(bb.level, 1, 1))),
        splitter: zahl(bb.splitter, 0),
      };
    }
  }

  const historie: MatchNotiz[] = Array.isArray(q.historie)
    ? q.historie.filter((n): n is MatchNotiz =>
      !!n && typeof n === 'object'
      && (n as MatchNotiz).ausgang !== undefined).slice(0, TROPHAEEN.historie)
    : [];

  return {
    version: PROFIL_VERSION,
    id: typeof q.id === 'string' && q.id ? q.id : frisch.id,
    name: typeof q.name === 'string' && q.name ? q.name.slice(0, 24) : frisch.name,
    karten,
    deck: Array.isArray(q.deck) ? q.deck.filter((x) => typeof x === 'string') : [],
    rolls: zahl(q.rolls, 0),
    seitEpisch: zahl(q.seitEpisch, 0),
    seitLegendaer: zahl(q.seitLegendaer, 0),
    rollsGesamt: zahl(q.rollsGesamt, 0),
    trophaeen: zahl(q.trophaeen, 0),
    bestwert: zahl(q.bestwert, 0),
    siege: zahl(q.siege, 0),
    niederlagen: zahl(q.niederlagen, 0),
    unentschieden: zahl(q.unentschieden, 0),
    historie,
    rng: gueltigerRng(q.rng) ?? frisch.rng,
    erstpaketVergeben: q.erstpaketVergeben === true,
  };
}

function gueltigerRng(roh: unknown): RngState | null {
  if (!roh || typeof roh !== 'object') return null;
  const r = roh as Partial<RngState>;
  const ok = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  if (!ok(r.a) || !ok(r.b) || !ok(r.c) || !ok(r.d)) return null;
  // Der Nullzustand ist ein Fixpunkt - daraus kaeme der Generator nie heraus.
  if ((r.a | r.b | r.c | r.d) === 0) return null;
  return { a: r.a >>> 0, b: r.b >>> 0, c: r.c >>> 0, d: r.d >>> 0 };
}
