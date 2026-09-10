/* ------------------------------------------------------------------
   Kleiner Zufallsgenerator nur fuer die Optik.

   Grastupfen, Steinfugen und Uferkanten brauchen Streuung, sollen
   aber bei jedem Neuaufbau des Untergrunds gleich aussehen - sonst
   springt das Muster bei jeder Groessenaenderung.

   Das ist ausdruecklich NICHT der Sim-RNG. Was hier gezogen wird,
   darf das Spielgeschehen nicht beruehren.
   ------------------------------------------------------------------ */

export interface Streu {
  /** Naechste Zahl in [0, 1). */
  zahl(): number;
  /** Naechste Zahl in [min, max). */
  bereich(min: number, max: number): number;
}

export function streuAusSeed(seed: number): Streu {
  let z = (seed >>> 0) || 0x9e3779b9;
  const next = (): number => {
    // xorshift32 - fuer Deko reicht das voellig.
    z ^= z << 13; z >>>= 0;
    z ^= z >>> 17;
    z ^= z << 5; z >>>= 0;
    return z / 4294967296;
  };
  return {
    zahl: next,
    bereich: (min, max) => min + next() * (max - min),
  };
}
