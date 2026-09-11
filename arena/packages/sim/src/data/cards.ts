/* ------------------------------------------------------------------
   Die 26 Karten.

   Alle Namen und Rollen sind eigene Erfindungen. Werte in Millitiles
   und Ticks (20 pro Sekunde): tempo 50 entspricht einem Tile je
   Sekunde, angriffsTakt 20 einem Schlag je Sekunde.

   ============================ ROLLEN ============================

   Tank            Steinwaechter, Frostkoloss
   Block           Schildwache (haelt auf, toetet nicht)
   Schwarm Boden   Rattenschar, Hundemeute, Speerwerferinnen
   Schwarm Luft    Sturmfalken, Klingenschwaermer
   Meuchler        Schattenklinge (ein Ziel, sehr schnell)
   Flaechenschaden Hammergarde, Flammenspeier, Glutschleuder,
                   Titanenfaust
   Luft schwer     Wolkenwal (nur Gebaeude), Sturmreiter (wehrt sich)
   Fernkampf       Bogenschuetzin, Blitzmagier
   Turmlaeufer     Steinwaechter, Sturmbock, Wolkenwal
   Gebaeude        Bollwerk (defensiv), Dornenwall (defensiv,
                   Flaeche), Krypta (Spawner Boden),
                   Nebelbrut (Spawner Luft)
   Zauber          Feuersturm (gross), Funkenregen (klein),
                   Frostschleier (Verlangsamung), Windstoss (schiebt)

   ========================= KONTER-MATRIX =========================

   Jede Rolle hat mindestens einen klaren Konter. Gelesen wird:
   "Was steht mir gegenueber -> was setze ich dagegen."

   Steinwaechter   -> Rattenschar, Hundemeute, Schattenklinge
                      (ignoriert Einheiten, dreht sich nicht um)
   Frostkoloss     -> Speerwerferinnen, Bollwerk, Schattenklinge
   Schildwache     -> Hammergarde, Titanenfaust (Flaeche geht durch),
                      Sturmbock (schiebt sie weg)
   Rattenschar     -> Funkenregen, Hammergarde, Flammenspeier,
                      Glutschleuder
   Hundemeute      -> Feuersturm, Hammergarde, Flammenspeier
   Speerwerferinnen-> Funkenregen, Blitzmagier, Hundemeute
   Klingenschwaermer-> Funkenregen, Flammenspeier, Glutschleuder,
                      Dornenwall (vier duenne Koerper, Flaeche raeumt)
   Schattenklinge  -> Rattenschar, Hundemeute (stirbt an vielen),
                      Funkenregen
   Hammergarde     -> Rattenschar (zu langsam fuer viele Ziele),
                      Bogenschuetzin (ausserhalb ihrer Reichweite)
   Flammenspeier   -> Sturmfalken, Blitzmagier, Funkenregen
   Glutschleuder   -> Schattenklinge, Sturmfalken (kommt schneller
                      heran, als sie nachladen kann)
   Titanenfaust    -> Wolkenwal, Sturmreiter (sie trifft nur Boden),
                      Steinwaechter (laeuft an ihr vorbei)
   Sturmfalken     -> Speerwerferinnen, Bogenschuetzin, Funkenregen,
                      Glutschleuder, Dornenwall
   Sturmreiter     -> Speerwerferinnen, Blitzmagier, Dornenwall
   Wolkenwal       -> Speerwerferinnen, Sturmfalken, Blitzmagier
                      (ignoriert Einheiten, wird von Luftabwehr zerlegt)
   Sturmbock       -> Schildwache, Rattenschar, Bollwerk
                      (geht nur auf Gebaeude, jeder Block haelt ihn)
   Bogenschuetzin  -> Feuersturm, Hundemeute, Blitzmagier
   Blitzmagier     -> Hundemeute, Rattenschar (stirbt an Naehe)
   Bollwerk        -> Feuersturm, Steinwaechter, Wolkenwal
   Dornenwall      -> Feuersturm, Steinwaechter, Titanenfaust
                      (steht fest und kann nicht ausweichen)
   Krypta          -> Feuersturm, Flammenspeier
   Nebelbrut       -> Feuersturm, Glutschleuder, Dornenwall
   Feuersturm      -> nichts direkt; Antwort ist Verteilen
   Funkenregen     -> nichts direkt; Antwort ist Verteilen
   Frostschleier   -> nichts direkt; Antwort ist frueher setzen
   Windstoss       -> nichts direkt; Antwort ist nachsetzen

   ======================== LUFT UND ABWEHR ========================

   Von 26 Karten fliegen sechs. Nach oben schiessen koennen neun:
   Speerwerferinnen, Bogenschuetzin, Blitzmagier, Flammenspeier,
   Glutschleuder, Dornenwall, Sturmfalken, Klingenschwaermer,
   Sturmreiter - dazu alle Zauber.

   Dieses Verhaeltnis ist gemessen und nicht geschaetzt. Beim Einbau
   der zehn neuen Karten kamen drei Flieger dazu, ohne dass die Abwehr
   mitwuchs. Ergebnis: die Nebelbrut stand bei 65 Prozent Siegquote,
   und die Sturmfalken stiegen von 52 auf 62,5 - ohne dass an ihnen
   eine einzige Zahl geaendert worden waere. Die ganze Achse gewann.

   Repariert wurde nicht Karte fuer Karte, sondern die Ursache:
   Glutschleuder und Dornenwall treffen seither auch Luft. Das hat die
   Haelfte aufgefangen und nebenbei zwei zu schwache Karten mittig
   gezogen.

   ====================== SCHWARM-BUDGET =========================

   Ein Schwarm bringt viele kleine Koerper und damit sehr viel
   Schaden je Elixir. Ohne Obergrenze schlaegt er alles, auch seine
   eigenen Konter. Richtwert fuer den Gesamtschaden je Sekunde einer
   ganzen Gruppe:

     2 Elixir  bis etwa  390   (Rattenschar 386, dafuer 72 HP je Stueck)
     3 Elixir  bis etwa  390   (Hundemeute 378, nur Boden)
     3 Elixir  bis etwa  300   (Speerwerferinnen 300, dafuer Reichweite)
     3 Elixir  bis etwa  220   (Sturmfalken 174, Klingenschwaermer 200,
                                dafuer Luft)

   Wer fliegt oder weit schiesst, bekommt weniger Schaden - die
   Faehigkeit ist Teil des Preises.

   Der Rohwert allein reicht dabei nicht als Massstab. Drei Einheiten
   mit Einzelschaden verschwenden einen Teil davon, weil sie im selben
   Moment auf dasselbe Ziel schiessen und es mehrfach ueberschiessen;
   gemessen kommen etwa 55 Prozent an.

   Die Regel dahinter: wer nur Gebaeude angreift, verliert gegen
   Schwaerme. Wer Flaechenschaden macht, gewinnt gegen Schwaerme,
   verliert aber gegen einzelne dicke Ziele. Luft ist stark, solange
   nichts nach oben schiesst.
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
    /* Sechs Koerper fuer zwei Elixir waren mit 59 Prozent Siegquote
       der zweithoechste Wert im Spiel.

       Am Schaden zu drehen brachte messbar nichts: 45 auf 38 verschob
       die Quote um weniger als das Rauschen. Der Wert der Karte liegt
       nicht darin, was sie austeilt, sondern darin, dass sechs Ziele
       auf dem Feld stehen und einzeln erschlagen werden muessen.

       Die Zaehigkeit ist der Hebel - aber nicht stufenlos. Ein
       Seitenturm macht 90 Schaden je Schuss. Mit 110 wie mit 80 HP
       ueberlebt eine Ratte auf Stufe 3 den ersten Schuss (80 mal 1,145
       sind 91,6) und lebt damit doppelt so lange unter Turmfeuer;
       gemessen sind beide Werte deshalb praktisch gleich stark. Erst
       unterhalb von 78,6 kippt es.

       Deshalb 72: auf Stufe 3 sind das 82,4, also ein Schuss, mit
       genug Abstand zur Kante. Das trifft auch, was auf der Karte
       steht - einzeln nichts wert.

       Nebenbefund, der fuer alle Karten gilt: Kartenlevel verschieben
       solche Schwellen. Auf Stufe 5 hat dieselbe Ratte 94,4 und
       ueberlebt den Schuss wieder. Eine Stufe ist hier also kein
       gleichmaessiges Plus, sondern kann eine Karte qualitativ
       aendern. */
    hp: 72, dmg: 45, angriffsTakt: sekunden(0.7), tempo: 130,
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
    /* Die staerkste Karte im Spiel, mit Abstand: 62 Prozent
       Siegquote ueber zweitausend Partien, stabil bei schwachem wie
       starkem Bot. Drei Koerper, die auf Entfernung Boden und Luft
       treffen - fuer drei Elixir war das die Antwort auf alles.

       Durchgemessen wurden vier Hebel:

         Schaden senken   Geht nicht. 100 gegen 200 HP heisst zwei
                          Schuss, 95 hiesse drei - genau daran haengt,
                          ob sie Sturmfalken herunterholen, und das
                          sollen sie laut Konter-Matrix.
         Reichweite       Bringt fast nichts: 5000 auf 3200 senkt die
                          Quote nur von 62 auf 60.
         Ein Koerper weg  Wirkt (52,5), aendert aber, was die Karte ist.
         Ein Elixir mehr  Wirkt genauso (52,5) und laesst sie voellig
                          unveraendert spielen.

       Also der Preis. Die HP gehen zusaetzlich auf ihren Wert vor der
       damaligen Erhoehung zurueck; sie waren nachweislich folgenlos
       fuer das Duell, das die Erhoehung begruendet hatte. Die
       Reichweite bleibt bei 4200 - auf Hoehe des Flammenspeiers und
       damit eine Fernwaffe, die man stellen muss. */
    elixir: 4, hp: 190, dmg: 100, angriffsTakt: sekunden(1), tempo: 80,
    reichweite: 4200, zieltAuf: 'beides', anzahl: 3, radius: 300,
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
    /* Schaden von 70 auf 58 gesenkt, ohne dass an der Karte selbst
       etwas falsch war: mit den neuen Fliegern stieg sie von 52 auf
       62,5 Prozent, allein weil die ganze Luftachse zulegte. Zwei
       neue Abwehrkarten haben davon die Haelfte aufgefangen, den Rest
       muss die Karte selbst tragen - 174 Schaden je Sekunde liegen
       jetzt sauber unter dem Luftbudget von 220. */
    hp: 200, dmg: 58, angriffsTakt: sekunden(1), tempo: 105,
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

  /* ================= Erweiterung: zehn weitere Karten ================

     Gebaut wurden Luecken, nicht Varianten. Was vorher fehlte:

       - ein billiger Block, der aufhaelt statt zu toeten
       - ein zweiter Luftschwarm
       - ein Rammbock, der Tuerme angeht und Einheiten ignoriert
       - ein Zauber, der schiebt statt Schaden zu machen
       - Flaechenschaden auf Distanz unterhalb des Flammenspeiers
       - ein Meuchler gegen einzelne dicke Ziele
       - ein zweites Verteidigungsgebaeude, mit Flaechenwirkung
       - ein schwerer Flieger, der sich auch gegen Einheiten wehrt
       - ein Spawner fuer Luft
       - ein langsamer Brecher als zweite Legendaere

     Die Werte folgen dem Schwarm-Budget weiter oben. Nach dem Einbau
     wurde mit `npm run turnier` gemessen; wo etwas danebenlag, steht
     die Begruendung an der Karte. */

  /* ------------------------- Block und Schwarm ----------------------- */
  karte({
    id: 'schildwache', name: 'Schildwache', seltenheit: 'gewoehnlich', elixir: 2,
    /* Von 780 auf 950 HP: 45,1 Prozent gemessen. Eine Karte, deren
       einziger Zweck Zeit ist, muss diese Zeit auch liefern. */
    hp: 950, dmg: 60, angriffsTakt: sekunden(1.2), tempo: 55,
    reichweite: 800, zieltAuf: 'boden', radius: 520,
    /* Viel HP fuer zwei Elixir, dafuer kaum Schaden. Ihre Aufgabe ist
       Zeit, nicht Toeten: sie stellt sich in den Weg, waehrend
       dahinter etwas anderes arbeitet. */
    text: 'Hält auf. Mehr kann sie nicht, mehr soll sie nicht.',
    farbe: '#7f8a96',
  }),
  karte({
    id: 'klingenschwaermer', name: 'Klingenschwärmer', seltenheit: 'gewoehnlich',
    elixir: 3, hp: 115, dmg: 45, angriffsTakt: sekunden(0.9), tempo: 115,
    reichweite: 650, zieltAuf: 'beides', ebene: 'luft', anzahl: 4, radius: 260,
    deployZeit: sekunden(0.8),
    /* Gemessen zuerst mit 55 Schaden: 59,7 Prozent, und damit ueber
       dem Budget von 220 Schaden je Sekunde fuer drei Elixir Luft -
       vier Koerper mal 61 waren 244. Mit 45 sind es 200, also knapp
       darunter, was richtig ist: vier Ziele sind mehr wert als drei. */
    text: 'Vier dünne Flieger. Zusammen gefährlich, einzeln nichts.',
    farbe: '#9fd15a',
  }),
  karte({
    id: 'sturmbock', name: 'Sturmbock', seltenheit: 'gewoehnlich', elixir: 4,
    /* Nachgezogen von 1500/320: mit 44,2 Prozent gemessen zu schwach.
       Wer nur Gebaeude angreift, braucht genug Panzer, um ueberhaupt
       anzukommen. */
    hp: 1850, dmg: 360, angriffsTakt: sekunden(1.6), tempo: 75,
    reichweite: 850, zieltAuf: 'nur_gebaeude', radius: 560,
    rueckstoss: 450,
    /* Schneller und billiger als der Steinwaechter, dafuer weniger
       zaeh. Sein Rueckstoss schiebt einen einzelnen Blocker beiseite -
       gegen einen Schwarm nuetzt ihm das nichts. */
    text: 'Rennt auf Türme zu und schiebt weg, was im Weg steht.',
    farbe: '#a8703f',
  }),
  karte({
    id: 'windstoss', name: 'Windstoß', seltenheit: 'gewoehnlich', elixir: 2,
    art: 'zauber', zauberRadius: 2600, zauberDmg: 150, zauberTurmDmg: 40,
    rueckstoss: 1600, deployZeit: 0,
    /* Gemessen 41,8 Prozent - fast so schwach wie der Frostschleier,
       und aus demselben Grund: ein Zauber, der nur Zeit kauft, ist
       das, womit ein Bot am wenigsten anfangen kann. Damit die Karte
       auch ohne kluges Timing etwas taugt, hat sie jetzt einen Boden
       aus Schaden - genug, um einen angeschlagenen Schwarm mitzunehmen,
       zu wenig, um den Funkenregen zu ersetzen. */
    /* Der erste Zauber, der nicht ueber Schaden wirkt, sondern Zeit
       kauft: ein zurueckgeworfener Schwarm braucht Sekunden zurueck,
       und Sekunden vor dem eigenen Turm sind teurer als Lebenspunkte. */
    text: 'Wirft zurück, was zu nah gekommen ist. Schaden fast keiner.',
    farbe: '#bcd9e8',
  }),

  /* --------------------- Fernkampf und Meuchler ---------------------- */
  karte({
    id: 'glutschleuder', name: 'Glutschleuder', seltenheit: 'selten', elixir: 3,
    /* Von 480/95 angehoben: 44,8 Prozent gemessen. Der Abstand zum
       Flammenspeier darf bleiben, aber nicht so gross sein, dass die
       Karte nie das Deck sieht. */
    hp: 560, dmg: 120, angriffsTakt: sekunden(1.4), tempo: 55,
    reichweite: 3600, zieltAuf: 'beides', schadensTyp: 'flaeche',
    flaechenRadius: 900, radius: 400,
    /* Flaechenschaden auf Distanz unterhalb des Flammenspeiers:
       kuerzer und schwaecher, dafuer ein Elixir billiger.

       Trifft auch Luft, und das ist kein Zierrat, sondern die
       Korrektur eines Fehlers: mit den drei neuen Fliegern stieg die
       Luftachse auf 60 bis 65 Prozent Siegquote, und die Sturmfalken
       kletterten auf 62,5, ohne dass an ihnen etwas geaendert worden
       waere. Jede einzelne Luftkarte zu schwaechen haette das Symptom
       behandelt; gefehlt hat Abwehr. */
    text: 'Wirft Glut in die Menge. Gegen Einzelne Verschwendung.',
    farbe: '#d98c3a',
  }),
  karte({
    id: 'schattenklinge', name: 'Schattenklinge', seltenheit: 'selten', elixir: 3,
    hp: 420, dmg: 230, angriffsTakt: sekunden(1.1), tempo: 125,
    reichweite: 650, zieltAuf: 'boden', radius: 320,
    deployZeit: sekunden(0.7),
    /* Sehr schnell, sehr hoher Einzelschaden, sehr duenn. Gegen einen
       Tank die beste Antwort im Spiel; gegen einen Schwarm stirbt sie
       vor dem zweiten Schlag. */
    text: 'Schnell und tödlich gegen Einzelne. Gegen viele verloren.',
    farbe: '#6d5a8f',
  }),
  karte({
    id: 'dornenwall', name: 'Dornenwall', seltenheit: 'selten', elixir: 4,
    hp: 1100, dmg: 110, angriffsTakt: sekunden(1.1), tempo: 0,
    reichweite: 3000, zieltAuf: 'beides', schadensTyp: 'flaeche',
    flaechenRadius: 800, radius: 600,
    lebensdauer: sekunden(30),
    /* Das zweite Verteidigungsgebaeude. Das Bollwerk haelt einen
       Angreifer fest, dieser hier raeumt seine Begleitung ab. Beide
       zusammen sind stark - acht Elixir in Gebaeuden heisst aber auch,
       dass vorne nichts passiert.

       Schiesst nach oben, aus demselben Grund wie die Glutschleuder:
       die Luftabwehr musste mit den neuen Fliegern mitwachsen. Ein
       Gebaeude, das Luft trifft, ist die Antwort auf einen Spawner,
       der Luft auswirft. */
    text: 'Steht, hält dreißig Sekunden und räumt ab, was sich nähert.',
    farbe: '#6f8f57',
  }),

  /* ----------------------- Luft und Beschwoerung --------------------- */
  karte({
    id: 'sturmreiter', name: 'Sturmreiter', seltenheit: 'episch', elixir: 5,
    hp: 1300, dmg: 260, angriffsTakt: sekunden(1.4), tempo: 70,
    reichweite: 900, zieltAuf: 'beides', ebene: 'luft', radius: 560,
    /* Der Wolkenwal geht nur auf Gebaeude und laesst sich von
       Luftabwehr zerlegen, ohne sich zu wehren. Dieser hier schlaegt
       zurueck - und geht dafuer schneller kaputt. */
    text: 'Schwerer Flieger, der sich wehrt. Trifft alles.',
    farbe: '#7a6ce0',
  }),
  karte({
    id: 'nebelbrut', name: 'Nebelbrut', seltenheit: 'episch', elixir: 5,
    hp: 820, dmg: 0, angriffsTakt: sekunden(1), tempo: 0,
    reichweite: 0, zieltAuf: 'boden', radius: 560,
    lebensdauer: sekunden(20), spawnTakt: sekunden(6),
    spawnKarte: 'nebelfalter', spawnAnzahl: 2,
    /* Gemessen 65,3 Prozent Siegquote - der hoechste Wert im ganzen
       Spiel und weit ausserhalb des Bandes. Ein Spawner, der Luft
       auswirft, trifft auf viel weniger Antworten als einer am Boden:
       sieben Wellen zu zwei Faltern fuer vier Elixir waren schlicht
       zu viel Material.

       Ein Elixir teurer, kuerzere Lebensdauer, langsamerer Takt: aus
       sieben Wellen werden drei. Nach dem ersten Durchgang lag sie
       noch bei 59,8 und musste ein zweites Mal herunter - ein
       Spawner skaliert eben nicht mit einer Zahl, sondern mit dem
       Produkt aus Dauer und Takt. */
    /* Wie die Krypta, nur nach oben. Der Unterschied ist nicht die
       Zahl, sondern wogegen der Gegner antworten muss: Luft braucht
       andere Karten als Boden, und wer beides abdeckt, hat weniger
       Platz fuer den Angriff. */
    text: 'Wirft alle vier Sekunden zwei Falter aus. Bis sie zerfällt.',
    farbe: '#8f7fb8',
  }),

  /* ------------------------------ Brecher ---------------------------- */
  karte({
    id: 'titanenfaust', name: 'Titanenfaust', seltenheit: 'legendaer', elixir: 6,
    hp: 2600, dmg: 520, angriffsTakt: sekunden(2.2), tempo: 40,
    reichweite: 1000, zieltAuf: 'boden', schadensTyp: 'flaeche',
    flaechenRadius: 1600, radius: 720,
    rueckstoss: 900, deployZeit: sekunden(1.2),
    /* Sechs Elixir ist der hoechste Preis im Spiel, und genau das ist
       die Karte: wer sie setzt, hat danach zwei Zuege lang nichts. Sie
       raeumt alles weg, was vor ihr steht - aber nur, was vor ihr
       steht, und sie ist langsam genug, dass man ihr ausweicht. */
    text: 'Ein Schlag räumt eine ganze Front. Zwischen den Schlägen wehrlos.',
    farbe: '#c05a43',
  }),

  /* Von der Nebelbrut ausgeworfen, nicht sammelbar - wie der
     Knochendiener bei der Krypta. */
  karte({
    id: 'nebelfalter', name: 'Nebelfalter', seltenheit: 'gewoehnlich', elixir: 0,
    /* Von 110/45 herunter. Die Nebelbrut blieb nach drei Aenderungen
       an ihr selbst bei 59 Prozent - weil ihr Wert nicht in ihr
       steckt, sondern in dem, was sie auswirft. An der falschen Zahl
       zu drehen kostet drei Durchgaenge; an der richtigen einen. */
    hp: 95, dmg: 32, angriffsTakt: sekunden(1), tempo: 110,
    reichweite: 620, zieltAuf: 'beides', ebene: 'luft', radius: 250,
    deployZeit: sekunden(0.4), sammelbar: false,
    text: 'Kommt aus der Nebelbrut.',
    farbe: '#b9a8d8',
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
