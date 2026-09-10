/* ------------------------------------------------------------------
   Die Konter-Matrix, maschinenlesbar.

   Dieselbe Aussage wie der Kommentar in cards.ts, nur in einer Form,
   die der Bot lesen kann. Beide muessen zusammenpassen - die Tests in
   test/konter.test.ts pruefen die Wirkung, diese Tabelle steuert die
   Entscheidung.

   Gelesen wird: "gegen diese Karte helfen jene". Die Reihenfolge in
   der Liste ist die Praeferenz - vorne steht die sauberste Antwort.
   ------------------------------------------------------------------ */

export const KONTER: Readonly<Record<string, readonly string[]>> = {
  steinwaechter: ['rattenschar', 'hundemeute', 'bollwerk'],
  frostkoloss: ['speerwerferinnen', 'bollwerk', 'bogenschuetzin'],
  rattenschar: ['funkenregen', 'hammergarde', 'flammenspeier'],
  hundemeute: ['hammergarde', 'flammenspeier', 'feuersturm'],
  speerwerferinnen: ['funkenregen', 'hundemeute', 'blitzmagier'],
  hammergarde: ['rattenschar', 'bogenschuetzin', 'speerwerferinnen'],
  flammenspeier: ['sturmfalken', 'blitzmagier', 'funkenregen'],
  sturmfalken: ['speerwerferinnen', 'bogenschuetzin', 'funkenregen'],
  wolkenwal: ['speerwerferinnen', 'sturmfalken', 'blitzmagier'],
  bogenschuetzin: ['hundemeute', 'feuersturm', 'blitzmagier'],
  blitzmagier: ['hundemeute', 'rattenschar', 'feuersturm'],
  bollwerk: ['feuersturm', 'steinwaechter', 'wolkenwal'],
  krypta: ['feuersturm', 'flammenspeier', 'hammergarde'],
  knochendiener: ['funkenregen', 'hammergarde', 'flammenspeier'],
};

/**
 * Wie gut `antwort` gegen `bedrohung` ist.
 *
 * 1000 fuer die erste Empfehlung, absteigend fuer die folgenden, 0
 * wenn die Karte gar nicht in der Liste steht. Als Ganzzahl, damit
 * der Bot Teil der deterministischen Simulation bleiben kann.
 */
export function konterWert(bedrohung: string, antwort: string): number {
  const liste = KONTER[bedrohung];
  if (!liste) return 0;
  const platz = liste.indexOf(antwort);
  if (platz < 0) return 0;
  return 1000 - platz * 250;
}

/** Die beste Antwort aus einer Hand. Leer, wenn keine passt. */
export function besterKonter(
  bedrohung: string, hand: readonly string[],
): { kartenId: string; wert: number } | null {
  let beste: string | null = null;
  let bester = 0;
  for (const id of hand) {
    const w = konterWert(bedrohung, id);
    // Strikt groesser: bei Gleichstand gewinnt der frühere Handplatz.
    if (w > bester) { bester = w; beste = id; }
  }
  return beste ? { kartenId: beste, wert: bester } : null;
}
