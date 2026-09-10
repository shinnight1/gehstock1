# GehstockMon - Konzept-One-Pager

> Stand: 2026-09-06 | Erzeugt mit /game-ideation | Reifegrad 0 -> 1
> Gebaut als Spiel in "Herr Gehstocks Hideout".
> Code: src/games/gehstockmon/ - Stil: src/styles/gehstockmon.css

## Fantasy

Ich sammle seltene Kreaturen, die mir gehoeren, stelle daraus eine Truppe zusammen,
und halte damit ein Stueck Land, das alle anderen sehen koennen.

Aesthetik-Ziel: Expression (Besitz, Auswahl) > Fantasy (ich bin wer, der Land haelt)
> Sensation (der Ziehungsmoment).

## Core Loop

Gebiet aussuchen -> Kampfplan dagegen bauen -> zusehen wie er haelt ->
Ressourcen und Kreaturen gewinnen -> mehr Gebiet.

## Twist

Zwoelf gesammelte Kreaturen halten dein Land, und wie sie kaempfen ist ein offenes
Regelwerk, das deine Gegner lesen und kontern koennen.

Warnung: im Zehn-Sekunden-Pitch faellt die zweite Haelfte weg. Dann heisst es
"Travian, aber die Armee sind gesammelte Viecher". Die Regelwerk-Ebene verkauft
sich beim Spielen, nicht im Pitch.

## Zielgruppe

- Primaer: Leute, die Freude daran haben, wenn ein System ohne sie korrekt laeuft.
  Clash-Spieler, die den Verteidigungsaufbau mehr mochten als den Angriff.
  Gambit- und Zachtronics-Koepfe. Grob 15 bis 25.
- Sekundaer: Sammler, die wegen der Kreaturen kommen und wegen der Karte bleiben.
- NICHT fuer: wer schnelle Haende sucht. Wer eine Geschichte will.
  Wer keine Wartezeit ertraegt (Timer sind gesetzt).

## Plattform und Sitzung

- Plattform: Web, Netlify, primaer iPad-Safari, Touch, als PWA installierbar
- Traeger: die bestehende Sammlung "Herr Gehstocks Hideout" statt einer eigenen Seite
- Backend: fuer den Ausschnitt keins. Fortschritt liegt lokal ueber host.store.
  Erst das Territorium spaeter braucht Supabase.
- Sitzungslaenge: 5 bis 15 Minuten, zwei bis drei Mal taeglich
- Monetarisierung: keine. Waehrung wird verdient, nie gekauft.

## Comp Set

1. Clash of Clans - aehnlich: asynchron angreifen gegen eine hinterlegte
   Verteidigung. Anders: deine Verteidigung ist ein lesbares Regelwerk statt
   einer Gebaeudeanordnung, und deine Einheiten sind gesammelt und einzeln.
   [vom Designer gespielt]
2. Travian / Tribal Wars - aehnlich: persistente geteilte Karte, Territorium,
   Timer, Kampfberichte, alles im Browser. Anders: Armee als Ensemble statt als
   Zahl, und Aufklaerung liest die Denkweise des Gegners statt seiner Truppenstaerke.
   [NICHT gespielt - Luecke]
3. Gladiabots - aehnlich: du programmierst Regeln und schaust zu. Anders: dort ist
   der Plan das ganze Spiel, hier ist er eine von drei Ebenen, eingebettet in
   Sammeln und Karte.
   [NICHT gespielt - Luecke]

## Verschachtelte Loops

- Micro (30 s): Kampfplan gegen ein konkretes Ziel bauen, ablaufen sehen
- Meso (5 min): Karte lesen, aufklaeren, Ziel waehlen, angreifen, Ergebnis verarbeiten
- Macro (Tag): Brut- und Bautimer setzen, ausloggen, zurueckkommen und lesen was passiert ist

Oekonomie: Gebiet erzeugt Ressourcen ueber Zeit (Wasserhahn) -> Ziehungen und
Bauzeiten (Abfluss) -> staerkere Truppe -> mehr Gebiet.

## Festgelegte Systeme

- Sozialmodell: asynchrones Territorium. Kein Realtime, keine Positionssynchronisation.
  Die Karte ist immer voll, weil jedes Feld jemandem gehoert, ob online oder nicht.
- Kampfformat: Kampfplaene (Gambits). Drei bis vier Wenn-Dann-Regeln, vorher gesetzt.
  Derselbe Plan verteidigt, wenn der Spieler offline ist. Eine Engine, kein KI-Code.
- Gegen Plan-Verfall wirken drei Systeme zusammen: Aufklaerung, Gelaende,
  begrenzte Plan-Slots.

## Timer-Regeln (nicht verhandelbar, sonst wird das Spiel feindselig)

1. Timer blockieren nie das Spielen. Sie laufen parallel zur Handlung.
2. Ansammlung bei etwa 8 Stunden deckeln. Nachts um drei einloggen bringt nichts.
3. Kein Ueberspringen. Nicht gegen Geld, nicht gegen Premiumwaehrung.
4. Abwesenheitsschutz. Wer zwoelf Stunden weg war, verliert nur einen gedeckelten
   Anteil. Die Zielgruppe geht zur Schule.

## FTUE-Staffelung

Grundregel: fuehre ein System nie ein, bevor der Spieler das Problem gespuert hat,
das es loest.

- Min 0-2: erste Ziehung geschenkt, drei Kreaturen, ein neutrales Feld, Plan schon
  fertig eingestellt. Aha-Moment: "die kaempfen fuer mich".
- Min 2-5: eine einzige Planregel selbst setzen. Aha-Moment: "ich kann denen sagen,
  was sie tun sollen".
- Min 5-10: Gelaende an genau einem Feld, das den funktionierenden Plan sichtbar
  bricht. Aha-Moment: "der Ort veraendert die Regeln".
- Ab Tag 2: Aufklaerung, ausgeloest durch eine Niederlage gegen einen Spieler, dessen
  Plan man haette lesen koennen.
- Spaeter: Plan-Slots begrenzen, sobald der Spieler ueberhaupt vier Plaene besitzt.

## Iceberg-Validierungsstand

- Context (Genre-Kenntnis): WEAK. Eins von vier Comps gespielt. Die Kerngattung
  (Territorial-Browsergame) ist unbekannt.
- Skill (Umsetzbarkeit): WEAK. Der Designer hat noch nie programmiert, in keiner
  Sprache. Der Stack (Supabase, Netlify, PWA) ist aus zwei Vorprojekten bekannt,
  die Spiellogik nicht. Code kommt von Claude, das verschiebt das Risiko von
  "kann er es bauen" zu "kann er es warten".
- Market Research: NONE. Auf Wunsch uebersprungen.
- External Validation: NONE. Niemand hat es gesehen oder gespielt.
- Intuition: LOW. Erstprojekt, bekommt im Modell das niedrigste Gewicht.

## Naechster Validierungsschritt

1. Hausaufgabe, circa 1,5 Stunden:
   - Gladiabots (~20 min) - testet das Micro-Verb in Reinform. Hoechste Prioritaet.
     Freier Teilersatz: Super Auto Pets im Browser.
   - Travian oder Tribal Wars (~30 min, freier Server, iPad-Browser) - die eigene
     Gattung kennenlernen.
   - PokeRogue (~20 min, kostenlos im Browser) - Browser-Collector 2026.
2. Danach: vertikaler Ausschnitt, circa eine Woche. Karte mit fuenf Feldern,
   vier Kreaturen, Planeditor, ein Kampf. Kein Gacha, keine Timer, keine
   Aufklaerung, kein Login.
3. Danach: Pitch-Test bei 5 bis 10 Leuten aus dem Discord.

## Groesstes Risiko

Das Micro-Verb. "Regelplan bauen und zusehen" ist fuer einen schmalen Kopf sehr
befriedigend und fuer die meisten trocken - und der Designer hat noch nie ein Spiel
gespielt, das das macht. Wenn dieser Verb nicht traegt, traegt nichts.

Zweitgroesstes Risiko: Grafik. Zwoelf Kreaturen brauchen zwoelf Bilder, und das ist
der einzige Teil des Projekts, den Claude nicht liefern kann.

## Scope

- Volle Vision: circa 8 bis 12 Personenmonate klassisch gerechnet.
- Kleinste spielbare Version: circa 1,5 bis 2 Personenmonate klassisch,
  mit Claude als Codeschreiber realistisch 6 bis 8 Wochen Abende.
- Vertikaler Ausschnitt (nur das Kampfgefuehl testen): circa 1 Woche.
- Verhaeltnis Vision zu kleinster Version rund 6:1. Unter der 10:1-Grenze,
  die Vision ist also keine Fantasie.
- Alle Zahlen sind geschaetzt, nicht gemessen.

## OFFEN

- Sitzungsablauf. Der Designer konnte eine vollstaendige Sitzung noch nicht in
  30 Sekunden erzaehlen. Das ist der schaerfste offene Punkt.
- Grafikstil. Drei Wege: Blender-Renders, gekauftes Asset-Pack, oder ein Stil ohne
  Kreaturenbilder (Karten mit Typografie, Silhouetten, Wappen). Bestimmt den
  gesamten visuellen Aufbau, muss frueh entschieden werden.
- Kreaturen-Roster. Anzahl, Typentabelle, Werte-Kurven. Existiert noch nicht.
- Territorialregeln. Wie beansprucht man, wie viel kann man verlieren, wie lang
  ist das Schutzfenster nach einer Niederlage.
- Snowballing. Klassisches Genre-Problem: Fruehstarter werden uneinholbar.
  Ungeloest. Saison-Resets waeren der Standardweg, wurden aber nicht gewaehlt.


---

# Was sich beim Bauen geaendert hat

Der Ausschnitt ist gebaut und spielbar. Drei Dinge stellten sich beim
Durchrechnen als falsch heraus - alle drei haetten sich am Papier nicht
zeigen koennen.

**1. Spott war eine Mauer ohne Tuer.**
Urspruenglich zog Spott jeden Angriff auf sich, ausnahmslos. Damit war die
Lehre von Feld 4 ("schlag nach dem, was dahinter steht") mit keinem Plan
umsetzbar. Jetzt geht genau eine Aktion daran vorbei: der gezielte Schlag
auf den Staerksten. Der Wall ist damit eine Aufgabe statt einer Wand.

**2. Heilung ohne Grenze macht jeden Kampf unentschieden.**
Zwei Heiler heilten sich gegenseitig endlos - Feld 5 endete bei jedem
denkbaren Wert im Patt. Seitdem braucht jede Faehigkeit nach dem Einsatz
eine Runde Pause. Das aendert nebenbei den Rhythmus zum Guten: ein Plan
muss jetzt auch beantworten, was die Kreatur in der Pausenrunde tut.

**3. Drei von fuenf Feldern lehrten nichts.**
Die Felder 2, 3 und 5 waren mit dem Startplan zu gewinnen. Ein Feld, das
man ohne Nachdenken haelt, hat seine Lehre verloren, ohne dass es
auffaellt. Feld 3 wurde neu entworfen (ein Brecher statt drei Splitter,
Lehre jetzt: nimm dem Staerksten die Wucht), Feld 2 bekam einen zweiten
Pfleger, Feld 5 wurde toetbar gemacht.

Abgesichert ist das durch Regressionstests in tools/extra-tests.mjs: sie
pruefen nicht nur, dass nichts abstuerzt, sondern dass Feld 1 mit dem
Startplan zu gewinnen ist und die Felder 2 bis 5 es nicht sind. Wer kuenftig
an den Werten dreht und eine Lehre kaputtmacht, erfaehrt es sofort.

## Stand der Felder

| Feld | Lehre | Startplan | Richtiger Plan |
|---|---|---|---|
| 1 Grenzstein | Der Kampf laeuft ohne dich | gewinnt (R3) | - |
| 2 Alte Furt | Nimm die Pfleger zuerst | Patt (verloren) | gewinnt in R9 |
| 3 Schieferbruch | Nimm dem Staerksten die Wucht | verliert | gewinnt in R8 |
| 4 Nebelsenke | Ziel am Wall vorbei | verliert | gewinnt in R8 |
| 5 Der Horst | Lies ihren Plan | verliert | gewinnt in R7 |

## Was noch fehlt

- Kreaturenbilder. Aktuell stehen Emoji als Platzhalter in `mono`.
- Territorium, Ziehungen, Timer, Aufklaerung als eigenes System. Der
  Ausschnitt zeigt die Aufklaerung nur dadurch, dass der gegnerische Plan
  offen dasteht.
- Ein Grund, warum man dieselben fuenf Felder ein zweites Mal spielt.
