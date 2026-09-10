# GehstockMon: Arena und Außenposten

Stand: 9. September 2026. Diese Spielfassung ersetzt den automatischen Plankampf und das Beschwören gegen Essenz.

## Spielen

Laufe mit der Pixel-Figur an ein fremdes Gebiet und betrete seine Arena. Ein Mon je Seite ist aktiv. Wähle jede Runde eine Attacke oder wechsle dein Mon. Kraftschlag pausiert anschließend zwei Runden; jede Spezialattacke hat zwei Ladungen pro Kampf. Nach einem K. o. ist der Ersatzwechsel kostenlos. Die vier Teamplätze bestimmen die Startaufstellung.

Ein vollständiger Sieg erobert das Gebiet und gibt einmalig 40 Gold. Flucht, Niederlage und abgelaufene Online-Kämpfe vergeben keine Eroberung. Online-Kämpfe lassen sich nach dem Neuladen fortsetzen. Wenn ein anderer Spieler währenddessen das Gebiet oder seine Verteidigung verändert, muss es neu angegriffen werden.

## Eier und Gold

- Ein eigener Außenposten produziert alle **2 Stunden ein Ei**, bis zu drei vor Ort.
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
