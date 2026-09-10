/* ------------------------------------------------------------------
   Deterministischer Zufall (xorshift128).

   Der Zustand ist ein einfaches Objekt aus vier 32-Bit-Zahlen und
   liegt direkt im MatchState. So laesst sich ein Match als Ganzes
   kopieren oder serialisieren, ohne dass Zufall daneben herlaeuft.

   ECMAScript schreibt die Semantik von ^, <<, >>> und | exakt vor -
   anders als bei Math.sin und Verwandten gibt es hier keinen
   Engine-Spielraum. Der Generator liefert in Safari dieselbe Folge
   wie in Node.

   Der Roll-RNG ist bewusst NICHT dieser hier (siehe
   /packages/meta/roll.ts): der Ausgang einer Ziehung darf sich nicht
   daraus ergeben, wie viele Einheiten in einem Match gestorben sind.
   ------------------------------------------------------------------ */

export interface RngState {
  a: number;
  b: number;
  c: number;
  d: number;
}

/**
 * Zustand aus einem einzelnen Seed aufbauen (splitmix32).
 * Ein schwacher Seed wie 1 wuerde xorshift sonst lange nachhaengen.
 */
export function rngAusSeed(seed: number): RngState {
  let z = seed >>> 0;
  const misch = (): number => {
    z = (z + 0x9e3779b9) >>> 0;
    let t = z;
    t = Math.imul(t ^ (t >>> 16), 0x21f0aaad) >>> 0;
    t = Math.imul(t ^ (t >>> 15), 0x735a2d97) >>> 0;
    return (t ^ (t >>> 15)) >>> 0;
  };
  const s: RngState = { a: misch(), b: misch(), c: misch(), d: misch() };
  // Der Nullzustand ist ein Fixpunkt - xorshift kaeme nie wieder heraus.
  if ((s.a | s.b | s.c | s.d) === 0) s.a = 0x9e3779b9;
  return s;
}

export function rngKopie(s: RngState): RngState {
  return { a: s.a, b: s.b, c: s.c, d: s.d };
}

/** Naechste 32-Bit-Zahl. Mutiert den Zustand. */
export function rngNext(s: RngState): number {
  const t = s.d;
  const x = s.a;
  s.d = s.c;
  s.c = s.b;
  s.b = x;
  const y = (t ^ (t << 11)) >>> 0;
  s.a = (y ^ x ^ (y >>> 8) ^ (x >>> 19)) >>> 0;
  return s.a;
}

/**
 * Ganzzahl aus [0, max). Verwirft die oberste, unvollstaendige Kachel
 * des Zahlenraums, damit kein Rest-Bias entsteht - die Roll-Raten
 * sollen bis auf ein Promille stimmen.
 */
export function rngInt(s: RngState, max: number): number {
  if (max <= 1) return 0;
  const grenze = 4294967296 - (4294967296 % max);
  let n = rngNext(s);
  while (n >= grenze) n = rngNext(s);
  return n % max;
}

/** Ganzzahl aus [min, max], beide Enden eingeschlossen. */
export function rngBereich(s: RngState, min: number, max: number): number {
  return min + rngInt(s, max - min + 1);
}

/**
 * Trifft mit Wahrscheinlichkeit zaehler/nenner zu.
 * Bewusst ohne Fliesskomma: 0.3 ist in Binaer nicht darstellbar, und
 * ein Vergleich gegen einen gerundeten Wert waere schwer zu testen.
 */
export function rngChance(s: RngState, zaehler: number, nenner: number): boolean {
  if (zaehler <= 0) return false;
  if (zaehler >= nenner) return true;
  return rngInt(s, nenner) < zaehler;
}

/** Element aus einer Liste. Leere Liste ergibt undefined. */
export function rngAuswahl<T>(s: RngState, liste: readonly T[]): T | undefined {
  if (!liste.length) return undefined;
  return liste[rngInt(s, liste.length)];
}

/** Fisher-Yates an Ort und Stelle - fuer das Mischen des Decks. */
export function rngMische<T>(s: RngState, liste: T[]): void {
  for (let i = liste.length - 1; i > 0; i--) {
    const j = rngInt(s, i + 1);
    const tmp = liste[i]!;
    liste[i] = liste[j]!;
    liste[j] = tmp;
  }
}
