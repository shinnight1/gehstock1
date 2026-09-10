/* ------------------------------------------------------------------
   Balance messen, statt sie zu vermuten.

     npm run turnier                       Kartenwertung, 400 Partien
     npm run turnier -- karten 2000        genauer
     npm run turnier -- karten 2000 300    mit schwachem Bot
     npm run turnier -- duell A B          zwei benannte Decks
     npm run turnier -- spiegel            prueft, ob das Spiel eine
                                           Seite bevorzugt

   Der letzte Wert ist jeweils der Trophaeenstand, aus dem beide
   Botprofile entstehen. Ihn zu variieren ist die wichtigste
   Gegenprobe: verschiebt sich die Rangfolge zwischen einem schwachen
   und einem starken Bot deutlich, misst man den Bot und nicht die
   Karten.

   Die Rechnerei steht in packages/sim/src/turnier.ts. Hier steht nur,
   wie man sie aufruft und wie das Ergebnis aussieht.

   Zu jeder Quote gehoert das Vertrauensband. Ohne das verleitet die
   Zahl zum Fehlschluss: 54 Prozent aus hundert Partien sind kein
   Ungleichgewicht, sondern Rauschen. Deshalb steht hinter jeder Zeile,
   ob der Abstand zu fuenfzig ueberhaupt etwas bedeutet.
   ------------------------------------------------------------------ */

import { duell, kartenWertung } from '@arena/sim';
import type { DuellErgebnis, KartenWertung } from '@arena/sim';
import { KARTEN_IDS, karteVon, DECK } from '@arena/sim';

/* Benannte Decks zum Vergleichen. Wer eigene ausprobieren will, traegt
   sie hier ein - eine Datei zu bearbeiten ist ehrlicher als acht
   Kartennamen auf der Kommandozeile zu tippen. */
const DECKS: Record<string, string[]> = {
  guenstig: [
    'rattenschar', 'hundemeute', 'bogenschuetzin', 'steinwaechter',
    'funkenregen', 'speerwerferinnen', 'hammergarde', 'bollwerk',
  ],
  teuer: [
    'frostkoloss', 'sturmfalken', 'flammenspeier', 'blitzmagier',
    'feuersturm', 'krypta', 'wolkenwal', 'frostschleier',
  ],
  schwarm: [
    'rattenschar', 'hundemeute', 'knochendiener', 'krypta',
    'funkenregen', 'bogenschuetzin', 'bollwerk', 'speerwerferinnen',
  ],
  luft: [
    'sturmfalken', 'wolkenwal', 'blitzmagier', 'bogenschuetzin',
    'speerwerferinnen', 'frostschleier', 'funkenregen', 'bollwerk',
  ],
};

const AUS = process.stdout;
const grau = (t: string): string => `[90m${t}[0m`;
const fett = (t: string): string => `[1m${t}[0m`;

/** Quote mit Band, und ein Urteil dazu. */
function quoteZeile(quote: number, band: number): string {
  const prozent = (quote * 100).toFixed(1).padStart(5) + ' %';
  const spanne = grau('±' + band.toFixed(1));
  const abstand = Math.abs(quote * 100 - 50);
  const urteil = abstand <= band
    ? grau('ausgeglichen')
    : abstand <= band * 2
      ? '[33mschief[0m'
      : '[31mdeutlich schief[0m';
  return `${prozent}  ${spanne}  ${urteil}`;
}

function duellAusgeben(a: string, b: string, e: DuellErgebnis): void {
  AUS.write(`\n${fett(a)} gegen ${fett(b)}   ${e.partien} Partien\n`);
  AUS.write(`  Siegquote ${a}   ${quoteZeile(e.quote, e.unsicherheit)}\n`);
  AUS.write(grau(`  ${e.siegeA} Siege, ${e.siegeB} Niederlagen, `
    + `${e.unentschieden} unentschieden\n`));
  AUS.write(grau(`  Turmvorsprung ${e.turmVorsprung >= 0 ? '+' : ''}`
    + `${e.turmVorsprung.toFixed(2)} je Partie, Dauer ${e.dauer.toFixed(0)} s\n`));
}

function kartenAusgeben(w: KartenWertung[]): void {
  AUS.write(`\n${fett('Siegquote je Karte')}   `
    + grau(`${w[0]?.partien ?? 0} Partien je Karte, `
      + `Deck aus ${DECK.groesse} von ${KARTEN_IDS.length}`) + '\n\n');

  const breite = Math.max(...w.map((k) => (karteVon(k.karte)?.name ?? k.karte).length));
  for (const k of w) {
    const karte = karteVon(k.karte);
    const name = (karte?.name ?? k.karte).padEnd(breite);
    const kosten = grau(String(karte?.elixir ?? '?'));
    AUS.write(`  ${name}  ${kosten}  ${quoteZeile(k.quote, k.unsicherheit)}\n`);
  }

  /* Zusammenfassung: was ausserhalb seines eigenen Bandes liegt, ist
     einen Blick wert. Alles andere ist Rauschen und sollte in Ruhe
     gelassen werden - Balancieren nach Zufallszahlen macht es
     schlimmer, nicht besser. */
  const auffaellig = w.filter((k) => Math.abs(k.quote * 100 - 50) > k.unsicherheit);
  AUS.write('\n');
  if (auffaellig.length === 0) {
    AUS.write(grau('  Nichts liegt ausserhalb seines Vertrauensbands.\n'));
  } else {
    AUS.write(`  ${fett('Auffaellig:')} `
      + auffaellig.map((k) => (karteVon(k.karte)?.name ?? k.karte)
        + ' (' + (k.quote * 100).toFixed(0) + ')').join(', ') + '\n');
  }
}

/* ------------------------------- Lauf ------------------------------ */

const [modus = 'karten', ...rest] = process.argv.slice(2);
const beginn = Date.now();

if (modus === 'duell') {
  const a = rest[0] ?? 'guenstig';
  const b = rest[1] ?? 'teuer';
  const partien = Number(rest[2] ?? 200);
  const deckA = DECKS[a];
  const deckB = DECKS[b];
  if (!deckA || !deckB) {
    AUS.write(`Unbekanntes Deck. Es gibt: ${Object.keys(DECKS).join(', ')}\n`);
    process.exit(1);
  }
  duellAusgeben(a, b, duell(deckA, deckB, { partien, seed: 1 }));
} else if (modus === 'spiegel') {
  /* Ohne Paarung, sonst misst es nichts: mit Paarung ist die
     Rueckrunde dieselbe Partie, und es kaeme zwangslaeufig genau
     fuenfzig heraus. */
  const partien = Number(rest[0] ?? 400);
  AUS.write(fett('\nSpiegelduelle - bevorzugt das Spiel eine Seite?\n'));
  for (const [name, deck] of Object.entries(DECKS)) {
    const e = duell(deck, deck, { partien, seed: 4242, paarweise: false });
    AUS.write(`  ${name.padEnd(10)} ${quoteZeile(e.quote, e.unsicherheit)}\n`);
  }
} else if (modus === 'alle') {
  // Jedes benannte Deck gegen jedes andere.
  const partien = Number(rest[0] ?? 200);
  const namen = Object.keys(DECKS);
  for (let i = 0; i < namen.length; i++) {
    for (let j = i + 1; j < namen.length; j++) {
      duellAusgeben(
        namen[i]!, namen[j]!,
        duell(DECKS[namen[i]!]!, DECKS[namen[j]!]!, { partien, seed: 1 }),
      );
    }
  }
} else {
  const partien = Number(rest[0] ?? 400);
  const trophaeen = Number(rest[1] ?? 2000);
  AUS.write(grau(`
Botstaerke: ${trophaeen} Trophaeen
`));
  kartenAusgeben(kartenWertung(KARTEN_IDS, { partien, seed: 1, trophaeen }));
}

AUS.write(grau(`\n${((Date.now() - beginn) / 1000).toFixed(1)} s\n`));
