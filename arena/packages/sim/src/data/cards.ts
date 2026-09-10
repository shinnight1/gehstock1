/* ------------------------------------------------------------------
   Die 16 Karten.

   Alle Namen und Rollen sind eigene Erfindungen. Werte in Millitiles
   und Ticks (20 pro Sekunde): tempo 50 entspricht einem Tile je
   Sekunde, angriffsTakt 20 einem Schlag je Sekunde.

   ============================ ROLLEN ============================

   Tank            Steinwaechter, Frostkoloss
   Schwarm         Rattenschar, Hundemeute, Speerwerferinnen
   Flaechenschaden Hammergarde, Flammenspeier
   Luft            Sturmfalken, Wolkenwal
   Fernkampf       Bogenschuetzin, Blitzmagier
   Gebaeude        Bollwerk (defensiv), Krypta (Spawner)
   Zauber          Feuersturm (gross), Funkenregen (klein),
                   Frostschleier (Verlangsamung)

   ========================= KONTER-MATRIX =========================

   Jede Rolle hat mindestens einen klaren Konter. Gelesen wird:
   "Was steht mir gegenueber -> was setze ich dagegen."

   Steinwaechter   -> Rattenschar, Hundemeute   (ignoriert Einheiten,
                      dreht sich nicht um; Schwaerme fressen ihn auf)
   Frostkoloss     -> Speerwerferinnen, Bollwerk
   Rattenschar     -> Funkenregen, Hammergarde, Flammenspeier
   Hundemeute      -> Feuersturm, Hammergarde, Flammenspeier
   Speerwerferinnen-> Funkenregen, Blitzmagier, Hundemeute
   Hammergarde     -> Rattenschar (zu langsam fuer viele Ziele),
                      Bogenschuetzin (ausserhalb ihrer Reichweite)
   Flammenspeier   -> Sturmfalken, Blitzmagier, Funkenregen
   Sturmfalken     -> Speerwerferinnen, Bogenschuetzin, Funkenregen
   Wolkenwal       -> Speerwerferinnen, Sturmfalken, Blitzmagier
                      (ignoriert Einheiten, wird von Luftabwehr zerlegt)
   Bogenschuetzin  -> Feuersturm, Hundemeute, Blitzmagier
   Blitzmagier     -> Hundemeute, Rattenschar (stirbt an Naehe)
   Bollwerk        -> Feuersturm, Steinwaechter, Wolkenwal
   Krypta          -> Feuersturm, Flammenspeier
   Feuersturm      -> nichts direkt; Antwort ist Verteilen
   Funkenregen     -> nichts direkt; Antwort ist Verteilen
   Frostschleier   -> nichts direkt; Antwort ist frueher setzen

   ====================== SCHWARM-BUDGET =========================

   Ein Schwarm bringt viele kleine Koerper und damit sehr viel
   Schaden je Elixir. Ohne Obergrenze schlaegt er alles, auch seine
   eigenen Konter - genau das war beim ersten Durchlauf der Fall:
   Sturmfalken haben die Speerwerferinnen gelegt, die sie eigentlich
   vom Himmel holen sollen. Seither gilt als Richtwert fuer den
   Gesamtschaden je Sekunde einer ganzen Gruppe:

     2 Elixir  bis etwa  390   (Rattenschar 386, dafuer 110 HP je Stueck)
     3 Elixir  bis etwa  390   (Hundemeute 378, nur Boden)
     3 Elixir  bis etwa  300   (Speerwerferinnen 300, dafuer Reichweite)
     3 Elixir  bis etwa  220   (Sturmfalken 210, dafuer Luft)

   Wer fliegt oder weit schiesst, bekommt weniger Schaden - die
   Faehigkeit ist Teil des Preises.

   Der Rohwert allein reicht dabei nicht als Massstab. Drei Einheiten
   mit Einzelschaden verschwenden einen Teil davon, weil sie im selben
   Moment auf dasselbe Ziel schiessen und es mehrfach ueberschiessen;
   gemessen kommen etwa 55 Prozent an. Deshalb liegen die
   Speerwerferinnen leicht ueber dem Richtwert - sonst verlieren sie
   gegen genau die Flieger, die sie kontern sollen.

   Die Regel dahinter: wer nur Gebaeude angreift, verliert gegen
   Schwaerme. Wer Flaechenschaden macht, gewinnt gegen Schwaerme,
   verliert aber gegen einzelne dicke Ziele. Luft ist stark, solange
   nichts nach oben schiesst - deshalb koennen sechs der sechzehn
   Karten Luft treffen.
   ------------------------------------------------------------------ */

import type { Karte } from '../karte.js';
import { sekunden } from './balance.js';

/* Defaults, damit jede Karte nur noch nennt, was sie ausmacht.
   Ohne sie waeren 16 Definitionen zu je 20 Zeilen kaum lesbar - und
   Werte, die alle teilen, muessten 16-mal gepflegt werden. */
const G = {
  art: 'einheit' as const,
  hp: 0, dmg: 0, angriffsTakt: sekunden(1), tempo: 0, reichweite: 0,
  zieltAuf: 'boden' as const, schadensTyp: 'einzel' as const,
  ebene: 'boden' as const, anzahl: 1, deployZeit: sekunden(1), radius: 400,
};

function karte(k: Partial<Karte> & Pick<Karte,
  'id' | 'name' | 'seltenheit' | 'elixir' | 'text' | 'farbe'>): Karte {
  return { ...G, ...k } as Karte;
}

export const KARTEN: readonly Karte[] = [
  /* ------------------------------ Tanks ----------------------------- */
  karte({
    id: 'steinwaechter', name: 'Steinwächter', seltenheit: 'selten', elixir: 5,
    hp: 3200, dmg: 240, angriffsTakt: sekunden(1.5), tempo: 45,
    reichweite: 900, zieltAuf: 'nur_gebaeude', radius: 700,
    deployZeit: sekunden(1),
    text: 'Läuft stur auf Türme zu und lässt alles andere links liegen.',
    farbe: '#8d99ab',
  }),
  karte({
    id: 'frostkoloss', name: 'Frostkoloss', seltenheit: 'gewoehnlich', elixir: 4,
    hp: 1900, dmg: 180, angriffsTakt: sekunden(1.2), tempo: 60,
    reichweite: 900, zieltAuf: 'boden', radius: 620,
    text: 'Hält viel aus und schlägt zurück — aber nur nach unten.',
    farbe: '#5aa9d6',
  }),

  /* ----------------------------- Schwaerme --------------------------- */
  karte({
    id: 'rattenschar', name: 'Rattenschar', seltenheit: 'gewoehnlich', elixir: 2,
    hp: 110, dmg: 45, angriffsTakt: sekunden(0.7), tempo: 130,
    reichweite: 650, zieltAuf: 'boden', anzahl: 6, radius: 260,
    deployZeit: sekunden(0.8),
    text: 'Sechs Stück, schnell und billig. Einzeln nichts wert.',
    farbe: '#a3927a',
  }),
  karte({
    id: 'hundemeute', name: 'Hundemeute', seltenheit: 'gewoehnlich', elixir: 3,
    hp: 220, dmg: 85, angriffsTakt: sekunden(0.9), tempo: 110,
    reichweite: 700, zieltAuf: 'boden', anzahl: 4, radius: 320,
    deployZeit: sekunden(0.8),
    text: 'Vier schnelle Beißer. Reißt einen Tank in Sekunden herunter.',
    farbe: '#c07a4a',
  }),
  karte({
    id: 'speerwerferinnen', name: 'Speerwerferinnen', seltenheit: 'gewoehnlich',
    elixir: 3, hp: 210, dmg: 100, angriffsTakt: sekunden(1), tempo: 80,
    reichweite: 5000, zieltAuf: 'beides', anzahl: 3, radius: 300,
    text: 'Drei Werferinnen, treffen auch Fliegendes.',
    farbe: '#b8935e',
  }),

  /* -------------------------- Flaechenschaden ------------------------ */
  karte({
    id: 'hammergarde', name: 'Hammergarde', seltenheit: 'selten', elixir: 4,
    hp: 900, dmg: 210, angriffsTakt: sekunden(1.7), tempo: 55,
    reichweite: 900, zieltAuf: 'boden', schadensTyp: 'flaeche',
    flaechenRadius: 1400, radius: 480,
    text: 'Ein Schlag, viele Treffer. Gegen einzelne Ziele zu langsam.',
    farbe: '#9b7bc9',
  }),
  karte({
    id: 'flammenspeier', name: 'Flammenspeier', seltenheit: 'episch', elixir: 4,
    hp: 700, dmg: 150, angriffsTakt: sekunden(1.3), tempo: 60,
    reichweite: 4200, zieltAuf: 'beides', schadensTyp: 'flaeche',
    flaechenRadius: 1100, radius: 440,
    text: 'Fegt Schwärme aus der Distanz weg, am Boden wie in der Luft.',
    farbe: '#e2703a',
  }),

  /* ------------------------------- Luft ------------------------------ */
  karte({
    id: 'sturmfalken', name: 'Sturmfalken', seltenheit: 'gewoehnlich', elixir: 3,
    hp: 200, dmg: 70, angriffsTakt: sekunden(1), tempo: 105,
    reichweite: 700, zieltAuf: 'beides', ebene: 'luft', anzahl: 3, radius: 300,
    deployZeit: sekunden(0.8),
    text: 'Drei Flieger. Kommen über Fluss und Mauern hinweg.',
    farbe: '#6fb8e8',
  }),
  karte({
    id: 'wolkenwal', name: 'Wolkenwal', seltenheit: 'legendaer', elixir: 5,
    hp: 2000, dmg: 400, angriffsTakt: sekunden(2), tempo: 45,
    reichweite: 800, zieltAuf: 'nur_gebaeude', ebene: 'luft',
    schadensTyp: 'flaeche', flaechenRadius: 1200, radius: 700,
    deployZeit: sekunden(1),
    text: 'Zieht unbeirrt zum nächsten Turm. Nur Luftabwehr hält ihn auf.',
    farbe: '#7f6ae0',
  }),

  /* ----------------------------- Fernkampf --------------------------- */
  karte({
    id: 'bogenschuetzin', name: 'Bogenschützin', seltenheit: 'gewoehnlich',
    elixir: 3, hp: 480, dmg: 140, angriffsTakt: sekunden(1.1), tempo: 70,
    reichweite: 5500, zieltAuf: 'beides', radius: 340,
    text: 'Größte Reichweite im Deck. Verträgt keinen Nahkampf.',
    farbe: '#d4b06a',
  }),
  karte({
    id: 'blitzmagier', name: 'Blitzmagier', seltenheit: 'episch', elixir: 4,
    hp: 560, dmg: 190, angriffsTakt: sekunden(1.4), tempo: 65,
    reichweite: 5000, zieltAuf: 'beides', radius: 360, rueckstoss: 700,
    text: 'Schlägt Getroffene ein Stück zurück und bricht damit Angriffe.',
    farbe: '#59d3f0',
  }),

  /* ----------------------------- Gebaeude ---------------------------- */
  karte({
    id: 'bollwerk', name: 'Bollwerk', seltenheit: 'selten', elixir: 4,
    art: 'gebaeude', hp: 1400, dmg: 160, angriffsTakt: sekunden(0.8),
    reichweite: 5500, zieltAuf: 'boden', radius: 700,
    lebensdauer: sekunden(30), deployZeit: sekunden(1),
    text: 'Zieht Angreifer auf sich und schießt zurück. Hält 30 Sekunden.',
    farbe: '#7d8a9c',
  }),
  karte({
    id: 'krypta', name: 'Krypta', seltenheit: 'selten', elixir: 4,
    art: 'gebaeude', hp: 900, radius: 700,
    lebensdauer: sekunden(40), deployZeit: sekunden(1),
    spawnTakt: sekunden(4.5), spawnKarte: 'knochendiener', spawnAnzahl: 2,
    text: 'Schickt alle viereinhalb Sekunden zwei Diener los. 40 Sekunden lang.',
    farbe: '#6b7c6a',
  }),

  /* --------------------- Nur aus der Krypta -------------------------- */
  /* Keine Sammelkarte: sie taucht weder in Rolls noch im Deckbau auf,
     ist aber eine vollwertige Einheit auf dem Feld. Der Spawner
     braucht ein Ziel mit anzahl 1, sonst legt eine Welle gleich einen
     ganzen Schwarm. */
  karte({
    id: 'knochendiener', name: 'Knochendiener', seltenheit: 'gewoehnlich',
    elixir: 0, sammelbar: false,
    hp: 130, dmg: 70, angriffsTakt: sekunden(0.6), tempo: 100,
    reichweite: 650, zieltAuf: 'boden', radius: 270,
    deployZeit: sekunden(0.4),
    text: 'Kommt aus der Krypta und sonst nirgendwo her.',
    farbe: '#c9c3b0',
  }),

  /* ------------------------------ Zauber ----------------------------- */
  karte({
    id: 'feuersturm', name: 'Feuersturm', seltenheit: 'episch', elixir: 4,
    art: 'zauber', zauberRadius: 2500, zauberDmg: 600, zauberTurmDmg: 180,
    deployZeit: 0,
    text: 'Großer Einschlag. Räumt eine ganze Gruppe ab.',
    farbe: '#f0603c',
  }),
  karte({
    id: 'funkenregen', name: 'Funkenregen', seltenheit: 'gewoehnlich', elixir: 2,
    art: 'zauber', zauberRadius: 1800, zauberDmg: 280, zauberTurmDmg: 80,
    deployZeit: 0,
    text: 'Klein und billig. Genau richtig gegen Schwärme.',
    farbe: '#f5c542',
  }),
  karte({
    id: 'frostschleier', name: 'Frostschleier', seltenheit: 'selten', elixir: 3,
    art: 'zauber', zauberRadius: 2800, zauberDmg: 90, zauberTurmDmg: 30,
    bremsePromille: 550, bremseDauer: sekunden(4), deployZeit: 0,
    text: 'Halbiert Tempo und Schlagzahl im Wirkbereich, vier Sekunden lang.',
    farbe: '#8fd9f2',
  }),
];

const NACH_ID = new Map<string, Karte>();
for (const k of KARTEN) NACH_ID.set(k.id, k);

export function karteVon(id: string): Karte | undefined {
  return NACH_ID.get(id);
}

/** Wirft, wenn die Karte fehlt. Fuer Stellen, an denen sie da sein muss. */
export function karteSicher(id: string): Karte {
  const k = NACH_ID.get(id);
  if (!k) throw new Error('Unbekannte Karte: ' + id);
  return k;
}

/** Alle Karten, die man besitzen kann - Grundlage fuer Rolls und Deckbau. */
export const SAMMELKARTEN: readonly Karte[] = KARTEN.filter(
  (k) => k.sammelbar !== false,
);

export const KARTEN_IDS: readonly string[] = SAMMELKARTEN.map((k) => k.id);
