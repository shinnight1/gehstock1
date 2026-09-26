# Projektregeln

Zwei Personen arbeiten parallel an diesem Projekt, jede mit einem eigenen Klon und
einem eigenen KI-Assistenten. Abgeglichen wird ausschließlich über das gemeinsame
GitHub-Repo `shinnight1/gehstock1`. Beide sind Git-Anfänger und erwarten, dass du
Git vollständig übernimmst, ohne sie zu fragen.

## Git

Vor jeder Bearbeitung einer Datei `git fetch` ausführen und mit
`git log --oneline HEAD..@{u}` prüfen, ob der Partner inzwischen gepusht hat. Wenn
ja: erst `git pull`, dann die geänderten Dateien lesen, dann arbeiten.

Nach jeder abgeschlossenen Änderung sofort `git add .`, `git commit` und
`git push`. Abgeschlossen heißt: ein sinnvoller Zwischenstand, nicht jede einzelne
Zeile. Commit-Nachricht auf Deutsch, ein Satz, fachlich formuliert
("Kontaktformular ergänzt") statt technisch ("index.html geändert").

Ein abgelehnter Push ist der Normalfall und bedeutet, dass der Partner in der
Zwischenzeit gepusht hat. Selbst erledigen: `git pull`, Merge auflösen, `git push`.

Bei einem Merge-Konflikt dem Ablauf in `.claude/skills/git-sync/SKILL.md` folgen.
Widersprechen sich die beiden Versionen inhaltlich, beide zeigen und den Nutzer
entscheiden lassen.

Liegen beim Sitzungsstart uncommittete Änderungen im Ordner, erst klären, ob sie
committet oder verworfen werden sollen, und danach ziehen.

**Harte Grenze:** `git push --force` und `git reset --hard` sind auf `main`
gesperrt. Sie sind der einzige Weg, auf dem die Arbeit des Partners wirklich
verlorengeht. Alte Stände holst du stattdessen über `git log` und `git reflog`,
einzelne Dateien mit `git checkout <commit> -- <pfad>`. Fällt dir kein anderer Weg
ein, frag den Nutzer.

## Arbeitsweise

Dateien punktuell ändern. Eine komplett neu geschriebene Datei kollidiert mit
praktisch jeder Änderung des Partners und ist die häufigste Konfliktursache bei
KI-Assistenten.

Es gibt bewusst keine Aufteilung nach Dateien. Beide arbeiten am gesamten Projekt.
Der Schutz vor Konflikten ist allein der Ablauf oben.

## Veröffentlichen

**Stand 26.09.2026: Die Seite läuft nur noch auf dem Handy** unter
`https://gehstock.duckdns.org`, die Spielerwelt liegt im Redis auf dem Handy statt
bei Upstash (Einrichtung, Update und Sicherungen: `docs/HANDY-SERVER.md`). Vercel
und `gehstock-mon.netlify.app` sind reine Weiterleitungen dorthin, Deno ist aus.
**Kein `vercel --prod`, `netlify deploy --prod` oder `deno deploy --prod` aus dem
Projekt** - das holte die alte Seite zurück, und die schriebe in Upstash, also in
eine veraltete Welt neben der echten. Eine Änderung erreicht die Seite so: pushen,
dann auf dem Handy `git pull`, `node tools/deploy-bauen.mjs` und den Server neu
starten. Die Abschnitte unten beschreiben den Zustand davor.

Die Seite liegt auf Vercel unter `gehstock1.vercel.app`. Veröffentlicht wird von
Hand aus dem Projektordner:

```sh
vercel --prod
```

Ein Push allein ändert an der Website nichts mehr. Wer will, dass er es wieder
tut, verbindet das Repository einmalig mit `vercel git connect`.

Vercel baut selbst; `vercel.json` trägt Build, Ausgabeordner und Kopfzeilen. Vor
einem Deploy, der die Seite verändert, `node tools/test.mjs` laufen lassen. Die
übrigen Build- und Testbefehle stehen in `ONLINE-START.md`.

Dieselbe Seite hört zusätzlich auf `gehstock-hideout.vercel.app`. Die Adresse hängt
am selben Vercel-Projekt, zeigt denselben Stand und dieselbe Spielerwelt und wird von
jedem `vercel --prod` mitgezogen. Sie ist der Ausweichweg für Netze, die den ersten
Namen sperren - etwa das Schul-WLAN. Beide Adressen bleiben gültig; keine ersetzt die
andere.

### Der Spiegel bei Deno Deploy

`deno/server.js` liefert dieselbe Seite ein zweites Mal aus - bei Deno Deploy und
damit unter einer Adresse, die nicht auf `vercel.app` endet. Für Netze, die diese
Endung sperren, ist das der Weg hinein.

Eigene Logik steckt nicht darin: die Serverfunktionen sind dieselben Dateien
wie bei Vercel, und über `UPSTASH_REDIS_REST_URL` hängt der Spiegel an
derselben Spielerwelt. Wer über ihn spielt, spielt mit allen anderen zusammen.

Die beiden Endpunkte aus `api/` sind in `deno/server.js` noch einmal aufgeführt.
Kommt dort einer dazu, muss er hier mit - sonst fehlt er stillschweigend nur auf
dem Spiegel. Die Anmeldung läuft wieder im Browser und benötigt keinen `/api/auth`-Endpunkt.

Die Kopfzeilen stehen dort ein zweites Mal, weil Deno Deploy `vercel.json` nicht
lesen kann. Wer eine ändert, ändert sie an beiden Stellen. Eine `deno.json`
braucht es nicht: Deno nimmt die npm-Pakete aus `package.json` und dem
`node_modules` des Builds. Eine liegt bewusst auch nicht da - sie brächte die
Deno-Kommandozeile dazu, ihre eigenen Pakete im `node_modules` des Projekts zu
suchen, und dann läuft `deno deploy` nicht mehr.

Veröffentlicht wird von Hand, wie bei Vercel auch:

```sh
deno deploy --prod
```

Vorher lokal anschauen geht auch:

```sh
deno run --env-file=.env.local --allow-net --allow-read --allow-env --allow-sys deno/server.js
```

Achtung: mit `.env.local` hängt der Spiegel auch lokal an der **echten**
Spielerwelt. Was man dort anfasst, fassen alle mit an.

Der Spiegel liegt unter `hideout.gehstock.deno.net` - App `hideout` in der
Organisation `gehstock`. Welche das ist, steht in `deno.jsonc`.

Eine Warnung aus der Entstehung: die erste Organisation bekam nie ihre
Standard-Domain `<org>.deno.net`. Die Apps darin bauten und veröffentlichten
klaglos, blieben aber ohne Adresse - DNS zeigte hin, ein Zertifikat gab es nie,
und alle Revisionen standen auf `PROD  no`. Weder Kommandozeile noch Dashboard
konnten das nachholen. Wer in einer Organisation ohne Domain landet, legt eine
neue an, statt zu suchen.

Beide Auslieferungen sind getrennt. Ein `vercel --prod` allein ändert am Spiegel
nichts und umgekehrt - nach einer Änderung, die beide zeigen sollen, gehen beide
Befehle.

### Die Ausweichadresse bei Netlify

`gehstock-mon.netlify.app` liefert dieselbe Seite ein drittes Mal aus - für Netze,
die `vercel.app` sperren. Sie hängt über `UPSTASH_REDIS_REST_URL` und
`UPSTASH_REDIS_REST_TOKEN` an **derselben** Spielerwelt wie Vercel; wer dort
spielt, spielt mit allen zusammen.

Veröffentlicht wird von Hand, die Seite ist nicht mit dem Repo verbunden:

```sh
netlify deploy --prod
```

Tote Adressen, jede von einem Konto, dessen Kontingent aufgebraucht ist:
`gehstock.netlify.app`, `gehstock-hideout.netlify.app` und seit dem 23.09.2026
auch `gehstockmon.netlify.app`. Dorthin führt nichts mehr zurück - wer eine davon
im Verlauf hat, landet auf einer Fehlerseite und muss die neue Adresse bekommen.

Jeder Umzug braucht **zwei** Schritte, sonst läuft die neue Seite auf einer
eigenen, leeren Welt: `netlify env:set` für die beiden UPSTASH-Werte, und eine
eingespielte Sicherung (`tools/redis-sichern.mjs`, dann `tools/welt-einspielen.mjs`).
Ob es geklappt hat, sagt die Statusabfrage weiter unten in einem Aufruf.

## Wo die Daten liegen — und was bei einem Umzug zählt

Spielerwelt, Verwaltung, Chatbretter und Pixelkarte liegen in **einer**
Redis-Datenbank (Upstash), die am Vercel-Projekt hängt. Die Hoster sind
austauschbar, die Datenbank ist es nicht: Wer eine neue Adresse aufsetzt, muss
ihr genau zwei Werte mitgeben, sonst läuft sie auf einer eigenen, leeren Welt —
und das merkt niemand, bis jemand seinen Spielstand sucht.

```
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

Die Werte holt `vercel env pull .env.local --environment=production`. Ob eine
Auslieferung wirklich an der gemeinsamen Datenbank hängt, sagt sie selbst:

```sh
curl -sS -X POST https://<adresse>/api/room -H 'Content-Type: application/json' -d '{"op":"status"}'
```

Antwortet sie `"speicher":"redis"` und dieselbe Profilzahl wie die anderen
Adressen, ist es dieselbe Welt. Steht dort `netlify-blobs` oder null Profile,
fehlen die beiden Werte.

Vor jedem Umzug eine Sicherung ziehen — sie lässt sich mit
`tools/welt-einspielen.mjs` auch in eine *andere* Datenbank zurückspielen:

```sh
node --env-file=.env.local tools/redis-sichern.mjs
```

### Warum kostenlose Kontingente leerlaufen — und was dagegen gebaut ist

Bis zum 23.09.2026 hielt jedes offene Fenster eine Serverfunktion ununterbrochen
am Laufen (das Relais wartete bis zu 7,5 s auf Neuigkeiten, der Browser fragte
ohne Pause nach), und GehstockMon meldete die Position stur alle zwei Sekunden.
Eine Klasse mit 30 Kindern verbrauchte so rund 300 000 Upstash-Befehle und über
300 Netlify-Credits **pro Stunde**. Beide Gratiskontingente waren nach ein bis
zwei Stunden Unterricht leer — ein Anbieterwechsel hat jeweils nur die Uhr
zurückgesetzt.

Seitdem gilt:

- Das Hideout fragt kurz (`kurz: true`) und wartet im Browser: 2 s nach Neuem,
  wachsend bis 15 s, im Spielraum 1 s, verdeckter Tab 60 s
  (`src/core/relais.js`, geprüft von `tools/relais-tests.mjs`).
- Die Arena fragt ihren Raum direkt und rührt `welt` nicht mehr an; im Duell
  fragt sie alle 0,6 s. Vorher weckte jeder Arena-Zug alle offenen Fenster.
- GehstockMon meldet die Position nach Bewegung: laufend alle 3 s, stehend alle
  5 s (andere da) oder 8 s (allein). Jeder Spieler hat in Redis ein eigenes
  Feld (`anwesenheit-v2`, ein Hash) — Schreibkonflikte gibt es dort nicht mehr.
- Eine bloße Weltabfrage schreibt die Welt nicht zurück, wenn sich nur Uhrzeiten
  geändert haben (Goldbuchung, „zuletzt gesehen“).

Gemessen mit `tools/kontingent-messen.mjs` (echter Servercode, 20 Kinder mit
Hideout und GehstockMon, Chat läuft): **166 → 37** Datenbankbefehle und
**63 → 1,3** Sekunden Funktionslaufzeit je Kind und Minute. Hochgerechnet auf 30
Kinder reicht das Gratiskontingent von Upstash damit für etwa 7–8 Stunden
Unterricht im Monat (vorher 1,7), das von Netlify für rund 18 (vorher unter
einer). Einen ganzen Monat trägt es also weiterhin nicht. Dafür gibt es bei
Upstash „Pay as you go“ (0,20 $ je 100 000 Befehle, mit einstellbarer
Budgetgrenze) — oder eine eigene Datenbank je Anlass.

Regeln für Änderungen:

- Keine Anfrage, die auf Neuigkeiten wartet. Netlify rechnet die Laufzeit ab.
- Wer einen Takt ändert oder einen neuen einführt, misst vorher und nachher
  mit `node tools/kontingent-messen.mjs beides 20 120`.
- Jeder Produktions-Deploy kostet bei Netlify 15 der 300 Credits im Monat.
  Änderungen sammeln, statt jede einzeln zu veröffentlichen.

## Berichten

Über Git redest du nur in einer Zeile. Nach einem Push hängst du ans Ende deiner
Antwort:

`↑ gepusht: <Commit-Nachricht>`

Hast du vorher etwas vom Partner geholt, davor:

`↓ geholt: <was er geändert hat, in fünf Wörtern>`

Ansonsten redest du mit dem Nutzer über die Website, nicht über Git.
