# GehstockMon: Arena und Außenposten

Stand: 11. September 2026. Diese Spielfassung ersetzt den automatischen Plankampf und das Beschwören gegen Essenz.

## Öffnungszeiten und Wochenende

Es gilt ausschließlich deutsche Ortszeit (`Europe/Berlin`), einschließlich Sommer- und Winterzeit. Montag, Dienstag und Freitag ist GehstockMon von 7 bis 13 Uhr geöffnet, Mittwoch von 7 bis 14 Uhr und Donnerstag von 7 bis 15 Uhr. Samstag und Sonntag bleibt es vollständig geschlossen. Der Beginn ist eingeschlossen, die Schlusszeit ausgeschlossen: um 13:00 Uhr ist ein 7–13-Uhr-Tag bereits gesperrt.

Der Server prüft alle Aktionen, Weltabrufe und Anwesenheitsmeldungen vor dem Lesen der Welt und erneut vor dem Speichern. Geschlossene Anfragen erhalten HTTP 423 samt nächster Öffnung und verändern keinen Spielstand. Eine geänderte Geräteuhr umgeht die Sperre nicht. Die Oberfläche sperrt auch laufende Kämpfe zur Schlusszeit, zeigt den Wochenplan und verbindet sich zur nächsten Öffnung automatisch. Unbestätigte Aktionen bleiben bis zur nächsten Öffnung abrufbar; die bisherige Ablaufregel für inaktive Kämpfe bleibt bestehen.

Ab dem Wochenende 12./13. September 2026 bringt jeder bereits zu Wochenendbeginn gehaltene Außenposten genau zwei Wochenend-Eier. Die normale Eierproduktion pausiert Samstag und Sonntag; angebrochene Produktionszeiten und vorhandene Eier bleiben erhalten. Gold und begonnene Brutzeiten laufen weiter.

Beim nächsten Eintritt nach einem abgeschlossenen Wochenende werden die Eier automatisch in die Bruttasche gelegt. Überzählige Eier bleiben in einer separaten Reserve, auch nach Gebietsverlust, und rücken nach, sobald ein Brut-Ei schlüpft. Mehrere verpasste Wochenenden werden nachgeholt. Der Server führt pro Außenposten einen atomar gespeicherten Abrechnungsstand; Neuladen und parallele Anfragen vergeben keine doppelten Eier. Vor dem genannten ersten Wochenende werden keine rückwirkenden Prämien berechnet.

## Fünf Biome und Mitspieler

Die große Insel enthält fünf eroberbare Gebiete: Mooswacht (Smaragdwald), Flüsterufer (Flussland), Aschenklippen (Vulkanland), Nebelwald (Geisterwald) und Frostkrone (Schneegebirge). Boden, Vegetation und Farben unterscheiden sich über die gesamten Biomflächen. Fluss, Brücken, weiche Kontaktschatten und gerichtete Schatten ergänzen die Landschaft.

Jede Festung hat ein zweiteiliges Tor. Es öffnet sich, wenn sich ihr Besitzer nähert. Andere Spieler bleiben vor dem verschlossenen Eingang und können die Gebietsarena betreten. Bei Besitzwechsel verlassen bisherige Besitzer die Festung. Die Kartenübersicht zeigt den Besitzernamen direkt unter dem Gebietsnamen.

Andere aktive Spieler erscheinen als Pixel-Figuren mit Namen; ein Schwert kennzeichnet einen laufenden Arenakampf. Die Positionen werden etwa alle zwei Sekunden ausgetauscht und zwischen den Meldungen interpoliert. Nach 15 Sekunden ohne Lebenszeichen verschwindet eine Figur. Die Anzeige zeichnet höchstens die 48 nächsten Mitspieler, die Spielerliste zeigt alle gemeldeten Teilnehmer. Anwesenheitsdaten liegen getrennt von Fortschritt und Kampfaktionen und können kein Gold oder Gebiet vergeben.

Neue Spieler beginnen mit Moosling, Glutfuchs, Nebelmolch und Rostknirps, alle gewöhnlich. Seltenere Mons haben mehr KP und Angriff; die Rollen behalten ihre eigenen Fähigkeiten und ihr Tempo. Mooswacht lässt sich mit der Starttruppe erobern. Bestehende Sammlungen und Aufstellungen werden nicht auf die neue Starttruppe zurückgesetzt.

Bei der einmaligen Umstellung von 25 auf fünf Gebiete werden die bisherigen Außenposten nach Biom zusammengeführt. Der zuletzt eroberte besetzte Außenposten bestimmt den Besitzer; bei gleicher Zeit entscheidet zuerst die Ausbaustufe, dann die kleinere Gebietsnummer. Sein Ausbau und Produktionsstand werden übernommen. Fälliges Einkommen aller alten Außenposten wird bis zur Umstellung ausgezahlt. Bereits eingesammelte Eier behalten ihre Brutzeiten und werden ihrem Biom zugeordnet. Laufende Kämpfe enden ohne Eroberungsprämie. Der vorige Kartenstand bleibt intern als `previousMap` erhalten.

## Spielen

Laufe mit der Pixel-Figur an ein fremdes Gebiet und betrete seine Arena. Ein Mon je Seite ist aktiv. Wähle jede Runde eine Attacke oder wechsle dein Mon. Kraftschlag pausiert anschließend zwei Runden; jede Spezialattacke hat zwei Ladungen pro Kampf. Nach einem K. o. ist der Ersatzwechsel kostenlos. Die vier Teamplätze bestimmen die Startaufstellung.

Ein vollständiger Sieg erobert das Gebiet und gibt einmalig 40 Gold. Flucht, Niederlage und abgelaufene Online-Kämpfe vergeben keine Eroberung. Online-Kämpfe lassen sich nach dem Neuladen fortsetzen. Wenn ein anderer Spieler währenddessen das Gebiet oder seine Verteidigung verändert, muss es neu angegriffen werden.

## Eier und Gold

- Ein eigener Außenposten produziert unter der Woche alle **2 Stunden ein Ei**, bis zu drei vor Ort. Am Wochenende gelten die zwei Wochenend-Eier je Außenposten.
- Eier werden abgeholt und danach für **1 Stunde** in einen Brutplatz gelegt.
- Drei Brutplätze, zwölf Eier in der Tasche. Abgeholte Eier bleiben bei Gebietsverlust erhalten.
- Es schlüpft jeweils ein noch fehlendes Mon. Bei vollständiger Sammlung liefert ein weiteres Ei 75 Gold.
- Einkommen läuft auch während der Abwesenheit; angebrochene Stunden bleiben erhalten.

| Stufe | Außenposten | Gold je Stunde | Bonus auf Verteidiger-KP | Ausbaukosten |
| --- | --- | ---: | ---: | ---: |
| 1 | Lager | 20 | 0 % | 120 Gold |
| 2 | Wachtposten | 35 | 12 % | 300 Gold |
| 3 | Festung | 55 | 25 % | vollständig |

Der Angriff der Verteidiger steigt zusätzlich um die Hälfte des KP-Bonus. Ausbauten erscheinen als Mauern, Türme und befestigte Tore auf der Karte. Gold bis zum Ausbauzeitpunkt wird zum bisherigen Tarif berechnet.

## Bestehende Spielstände

Mons, Truppe und eroberte Gebiete bleiben erhalten. Vorhandene Essenz wird bei der erstmaligen Migration zusammen mit 120 Startgold in den neuen Goldbestand übernommen. Frühere Kampfpläne bleiben im Spielstand, werden in der neuen Arena aber nicht verwendet. Die Produktion alter Gebiete beginnt beim ersten Laden dieser Fassung; es entsteht kein rückwirkender Vorrat seit dem ursprünglichen Prototyp.

GehstockMon startet ausschließlich in der gemeinsamen Spielerwelt. Der bestehende Online-Fortschritt bleibt erhalten. Frühere lokale Kampagnen werden nicht mehr geladen; ihre gespeicherten Daten werden nicht gelöscht und nicht in die Spielerwelt übertragen. Neue Spieler beginnen mit vier Mons. Aufstellungen werden sofort auf dem Server für Angriff und Verteidigung gespeichert.

Aktionen und Zeitstempel werden auf dem Server geprüft und atomar gespeichert. Bei Verbindungsverlust pausiert das Spiel bis zur Wiederverbindung. Die Oberfläche kann unbestätigte Aktionen über „Offene Aktion prüfen“ abrufen. Ein laufender Arenakampf wird beim Öffnen automatisch fortgesetzt. In der Offline-Einzeldatei ist GehstockMon ausgeblendet.

## Überprüfung

`node tools/deploy-bauen.mjs` baut Hideout und die separate bestehende Arena-Seite. `node tools/test.mjs` prüft die bisherigen Spielregeln, `node tools/gehstockmon-tests.mjs` die neuen Regeln, Online-Aktionen und UI-Abläufe, `node tools/gehstockmon-world-tests.mjs` die Three-Szene, Bewegung, Grenzen und Ausbauten. Die automatischen Szenen- und UI-Prüfungen ersetzen keinen Gerätetest auf dem iPad.
