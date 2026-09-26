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

## Wo die Seite läuft

Seit dem 26.09.2026 läuft die Seite **nur noch auf einem Android-Handy** (Galaxy A25,
Termux) unter `https://gehstock.duckdns.org`. Die Spielerwelt liegt im Redis auf
demselben Handy. Aufbau, Einrichtung, Sicherungen und Grenzen: `docs/HANDY-SERVER.md`.

```
Internet → Router (80→8081, 443→8443) → Caddy (HTTPS) → tools/handy-server.mjs (127.0.0.1:8080)
                                                           → Redis (127.0.0.1:6379)
```

Vercel, Netlify und Deno gibt es nicht mehr. `gehstock1.vercel.app`,
`gehstock-hideout.vercel.app` und `gehstock-mon.netlify.app` sind reine
Weiterleitungen aufs Handy. Nichts davon wieder veröffentlichen: eine alte
Auslieferung schriebe in Upstash, also in eine veraltete Welt neben der echten.

**Ein Push auf `main` geht von selbst live**, spätestens nach etwa drei Minuten:
Das Handy schaut alle zwei Minuten auf GitHub nach (`tools/handy-autoupdate.sh`)
und spielt den neuen Stand über `tools/handy-aktualisieren.sh` ein. Live geht er
nur, wenn `node tools/test.mjs` und die Handy-Tests bestehen, der Build klappt und
der Server damit startet - sonst bleibt der bisherige Stand stehen, und der
Grund steht auf dem Handy in `~/.config/gehstock1/update.log`. Darum gilt mehr
denn je: nur pushen, was fertig ist, und vorher selbst `node tools/test.mjs` und
`npm run test:handy` laufen lassen. Während eines Updates ist die Seite ein paar
Sekunden weg; gebaut wird daneben (`dist.neu`), getauscht erst am Ende.

Lokal entwickeln: `npm run build`, dann `npm run dev` (http://localhost:8787, eine
leere Testwelt nur im Arbeitsspeicher - nie die echte).

## Wo die Daten liegen

`netlify/functions/lib/speicher.mjs` entscheidet anhand der Umgebung (der Ordnername
stammt aus der Netlify-Zeit und bleibt, damit niemandes Änderungen kollidieren):

| Umgebung | Speicher |
|---|---|
| `REDIS_URL` oder `REDIS_PASS` | Redis auf dem Handy, direkt (`lib/redis-lokal.mjs`) |
| `UPSTASH_REDIS_REST_URL` + `_TOKEN` | Upstash - nur noch Rückfallweg und Ablage der Sicherungen |
| `GEHSTOCK_SPEICHER=arbeitsspeicher` | Entwicklung und Tests |
| nichts | Abbruch statt einer stillen, leeren Welt |

Ob die laufende Seite an der echten Welt hängt:

```sh
curl -sS -X POST https://gehstock.duckdns.org/api/room -H 'Content-Type: application/json' -d '{"op":"status"}'
```

`"speicher":"redis-lokal"` und die gewohnte Profilzahl heißt: alles richtig.

Das Handy sichert jede Nacht selbst (14 Tage auf dem Handy, dazu eine gepackte
Kopie bei Upstash). Vor jedem Eingriff in die Daten trotzdem von Hand sichern:

```sh
node --env-file=$HOME/.config/gehstock1/redis.env tools/redis-sichern.mjs
```

### Warum der Server kurz fragt statt wartet

Bis zum 23.09.2026 hielt jedes offene Fenster eine Serverfunktion am Laufen, und
eine Schulklasse leerte die Gratiskontingente von Upstash und Netlify in ein bis
zwei Stunden. Seitdem fragt das Hideout kurz (`kurz: true`) und wartet im Browser:
2 s nach Neuem, wachsend bis 15 s, im Spielraum 1 s, verdeckter Tab 60 s
(`src/core/relais.js`, geprüft von `tools/relais-tests.mjs`). GehstockMon meldet
die Position laufend alle 3 s, stehend alle 5-8 s, jeder Spieler in einem eigenen
Redis-Feld (`anwesenheit-v2`). Eine bloße Weltabfrage schreibt nicht zurück, wenn
sich nur Uhrzeiten geändert haben.

Kontingente gibt es auf dem Handy nicht mehr, die Takte bleiben trotzdem: sie
schonen Akku, WLAN und Upload. Wer einen Takt ändert, misst vorher und nachher
auf dem Handy mit `node tools/handy-lasttest.mjs 10 120` (Stand 26.09.2026 mit
10 Spielern: 11 % eines Kerns, Position im Median 26 ms, Welt laden 156 ms).

## Berichten

Über Git redest du nur in einer Zeile. Nach einem Push hängst du ans Ende deiner
Antwort:

`↑ gepusht: <Commit-Nachricht>`

Hast du vorher etwas vom Partner geholt, davor:

`↓ geholt: <was er geändert hat, in fünf Wörtern>`

Ansonsten redest du mit dem Nutzer über die Website, nicht über Git.
