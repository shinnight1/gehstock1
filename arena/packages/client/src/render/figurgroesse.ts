/* ------------------------------------------------------------------
   Wie gross eine Figur gezeichnet wird.

   Bisher haing die Bildgroesse allein am Kollisionsradius aus
   cards.ts. Das ist bequem und falsch: der Radius sagt, wie eng
   Einheiten beieinander stehen duerfen und worauf gezielt wird - er
   ist eine Spielregel. Wie gross etwas aussieht, ist eine Frage des
   Massstabs.

   Beides zusammenzulegen hiess: ein Katapult war so gross wie die
   Frau, die es bedient, und ein Wal so gross wie ein Steinriese. Wer
   den Massstab richtigstellen wollte, haette am Radius drehen muessen
   und damit an Kollision, Zielerfassung und Balance.

   Deshalb steht hier ein reiner Bildfaktor. Er aendert nichts am
   Spiel; er wird ausschliesslich beim Zeichnen mit der Figurgroesse
   multipliziert.

   MASSSTAB

   1.0 ist ein erwachsener Mensch, also etwa ein Tile hoch - die
   Bogenschuetzin ist der Nullpunkt. Alles andere richtet sich daran
   aus:

     0.7 bis 0.8   Schwaerme: Ratten, Hunde, Falken, Falter
     1.0 bis 1.1   Menschen, auch gepanzert
     1.3 bis 1.5   Gebaeude, Reittiere, schwere Maschinen
     1.6 bis 1.8   Katapult und Riesen
     2.4           der Wolkenwal

   Die Schwaerme sind bewusst nicht so klein, wie sie sein muessten.
   Sechs massstabsgetreue Ratten waeren auf dem iPad sechs Punkte, und
   eine Karte, die man nicht erkennt, kann man nicht spielen. Der
   Massstab endet dort, wo die Lesbarkeit anfaengt.
   ------------------------------------------------------------------ */

/** Bildfaktor je Karte. Fehlt ein Eintrag, gilt 1. */
const SKALA: Readonly<Record<string, number>> = {
  /* --- Schwaerme: kleiner als ein Mensch, aber noch erkennbar --- */
  rattenschar: 0.7,
  hundemeute: 0.75,
  sturmfalken: 0.8,
  klingenschwaermer: 0.75,
  nebelfalter: 0.75,

  /* --- Menschen. Die Bogenschuetzin ist der Massstab. --- */
  bogenschuetzin: 1,
  blitzmagier: 1,
  schattenklinge: 1,
  knochendiener: 1,
  speerwerferinnen: 1.1,
  hammergarde: 1.05,
  schildwache: 1.05,
  flammenspeier: 1.1,

  /* --- Gebaeude und Reittiere --- */
  dornenwall: 1.25,
  bollwerk: 1.3,
  krypta: 1.35,
  nebelbrut: 1.4,
  sturmreiter: 1.5,

  /* --- Maschinen und Riesen --- */
  steinwaechter: 1.35,
  frostkoloss: 1.4,
  sturmbock: 1.4,
  titanenfaust: 1.65,
  /* Ein Katapult ist ein Geraet, das mehrere Leute bedienen. Es muss
     deutlich ueber jeden Menschen hinausragen, sonst liest es sich
     als Person mit Werkzeug. */
  glutschleuder: 1.75,

  /* Der Wal ist die Ausnahme, die den Massstab erst sichtbar macht:
     wenn er ueber das Feld zieht, soll klar sein, dass darunter alles
     andere klein ist. */
  wolkenwal: 2.4,
};

export function figurSkala(karte: string): number {
  return SKALA[karte] ?? 1;
}
