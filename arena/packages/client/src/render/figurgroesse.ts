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

   Die Bogenschuetzin ist der Nullpunkt: 1,2 Tiles hoch, ein
   erwachsener Mensch. Daran richtet sich alles aus.

     0,95 Tiles   Schwaerme: Ratten, Klingenschwaermer, Falter
     1,05          Hunde, Falken, Knochendiener
     1,2           Menschen
     1,6           schwere Panzerung
     2,0 bis 2,5   Gebaeude, Reittiere, Maschinen, Riesen
     2,9 bis 3,0   Titanenfaust und Wolkenwal

   Die Spanne ist mit Absicht eng, gut das Dreifache vom kleinsten
   zum groessten. Ein erster Versuch ging vom halben Menschen bis zum
   fuenffachen, und beide Enden waren falsch: die Schwaerme
   verschwanden auf dem Feld, und der Wal deckte zu, was unter ihm
   passierte. Massstabstreue nuetzt nichts, wenn man die Karte nicht
   mehr erkennt oder nichts anderes mehr sieht.

   Deshalb heisst die Regel hier nicht "so gross wie in echt",
   sondern: das Kleinste muss lesbar bleiben, das Groesste darf nichts
   verdecken. Dazwischen soll man den Unterschied sehen.
   ------------------------------------------------------------------ */

/** Bildfaktor je Karte. Fehlt ein Eintrag, gilt 1. */
const SKALA: Readonly<Record<string, number>> = {
  /* --- Schwaerme. Klar kleiner als ein Mensch, aber nie ein Punkt. --- */
  rattenschar: 1.26,
  hundemeute: 1.13,
  sturmfalken: 1.21,
  klingenschwaermer: 1.26,
  nebelfalter: 1.31,

  /* --- Menschen. Die Bogenschuetzin ist der Massstab. --- */
  bogenschuetzin: 1.22,
  blitzmagier: 1.15,
  schattenklinge: 1.29,
  knochendiener: 1.34,
  speerwerferinnen: 1.32,
  hammergarde: 1.15,
  schildwache: 1.06,
  flammenspeier: 1.18,

  /* --- Gebaeude und Reittiere --- */
  dornenwall: 1.15,
  bollwerk: 1.08,
  krypta: 1.13,
  nebelbrut: 1.29,
  sturmreiter: 1.35,

  /* --- Maschinen und Riesen --- */
  steinwaechter: 1.23,
  frostkoloss: 1.34,
  sturmbock: 1.35,
  titanenfaust: 1.39,
  /* Ein Katapult ist ein Geraet, das mehrere Leute bedienen. Es muss
     deutlich ueber jeden Menschen hinausragen, sonst liest es sich
     als Person mit Werkzeug. */
  glutschleuder: 1.81,

  /* Der Wal ist das Groesste im Spiel, aber nur zweieinhalbmal ein
     Mensch. Vorher war er fuenfmal so gross und schob sich als
     Flaeche ueber das Feld - man sah nicht mehr, was darunter
     kaempfte. Gross sein heisst hier: der Groesste, nicht im Weg. */
  wolkenwal: 1.48,
};

export function figurSkala(karte: string): number {
  return SKALA[karte] ?? 1;
}
