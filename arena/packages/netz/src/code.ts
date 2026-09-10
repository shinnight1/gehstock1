/* ------------------------------------------------------------------
   Raumcodes.

   Sechs Ziffern, weil sie sich ueber den Tisch zurufen lassen. Kein
   Buchstabe: "B" und "8" oder "O" und "0" ueber ein Mikro zu
   unterscheiden ist genau die Art von Reibung, die man beim Spielen
   mit Freunden nicht will.

   Der Code ist kein Geheimnis und soll keines sein. Er verhindert
   nicht, dass jemand fremde Raeume durchprobiert - dagegen hilft,
   dass ein Raum nur eine Viertelstunde lebt und beim zweiten Spieler
   dichtmacht. Wer trotzdem hineinstolpert, findet ein Kartenspiel.

   Erzeugt wird nicht aus der Simulation heraus: die hat ihren eigenen
   Zufall, und der gehoert zur Partie. Ein Raumcode, der den
   Match-Zufall verschoebe, waere ein Fehler, den niemand findet.
   ------------------------------------------------------------------ */

const STELLEN = 6;
const KLEINSTE = 100_000;
const GROESSTE = 999_999;

/**
 * Neuer Code, der noch nicht vergeben ist.
 *
 * `belegt` entscheidet, ob ein Vorschlag schon laeuft. Nach genug
 * Fehlversuchen gibt die Funktion auf und liefert null - bei einer
 * Million moeglicher Codes heisst das, dass der Server ohnehin am
 * Ende ist.
 */
export function codeErzeugen(
  belegt: (code: string) => boolean,
  zufall: () => number = Math.random,
  versuche = 50,
): string | null {
  for (let i = 0; i < versuche; i++) {
    const wert = KLEINSTE + Math.floor(zufall() * (GROESSTE - KLEINSTE + 1));
    const code = String(Math.min(wert, GROESSTE));
    if (!belegt(code)) return code;
  }
  return null;
}

/** Nur Ziffern, genau sechs. Alles andere wird gar nicht erst gesucht. */
export function codeGueltig(code: unknown): code is string {
  return typeof code === 'string'
    && code.length === STELLEN
    && /^[0-9]{6}$/.test(code);
}

/**
 * Eingabe aufraeumen, bevor sie geprueft wird.
 *
 * Wer einen Code abliest, tippt gern Leerzeichen oder Bindestriche
 * mit. Das ist kein Fehler des Spielers.
 */
export function codeSaeubern(roh: string): string {
  return roh.replace(/[^0-9]/g, '').slice(0, STELLEN);
}

/**
 * Sitzungstoken fuer die Rueckkehr nach einem Verbindungsabriss.
 *
 * Anders als der Raumcode muss der schwer zu raten sein: mit ihm
 * uebernimmt man einen Platz in einer laufenden Partie.
 */
export function tokenErzeugen(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string; getRandomValues?: <T>(a: T) => T } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  if (g.crypto?.getRandomValues) {
    const feld = g.crypto.getRandomValues(new Uint32Array(4));
    return Array.from(feld, (n) => n.toString(16).padStart(8, '0')).join('');
  }
  // Sollte auf keiner Zielplattform vorkommen - aber lieber schwach
  // als abgestuerzt.
  return Date.now().toString(16) + Math.random().toString(16).slice(2);
}
