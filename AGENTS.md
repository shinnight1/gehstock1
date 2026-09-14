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

Eigene Logik steckt nicht darin: die beiden Serverfunktionen sind dieselben
Dateien wie bei Vercel, und über `UPSTASH_REDIS_REST_URL` hängt der Spiegel an
derselben Spielerwelt. Wer über ihn spielt, spielt mit allen anderen zusammen.

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

**Stand: der Spiegel hat noch keine Adresse.** Die App `gehstock-hideout` in der
Organisation `gehstcok` ist angelegt, baut durch und hängt über die gesetzten
Upstash-Variablen an der richtigen Spielerwelt. Nur bekommt sie keine Domain:
die Organisation hat gar keine, alle Revisionen stehen auf `PROD  no`, und unter
dem erwarteten Namen `gehstock-hideout.gehstcok.deno.net` gibt es zwar einen
DNS-Eintrag, aber kein passendes Zertifikat. Weder die Kommandozeile noch das
Dashboard bieten einen Weg, eine Revision in die Produktion zu befördern. Bis das
geklärt ist, ist der Spiegel nicht erreichbar und `deno deploy --prod` bringt
nichts.

Beide Auslieferungen sind getrennt. Ein `vercel --prod` allein ändert am Spiegel
nichts und umgekehrt - nach einer Änderung, die beide zeigen sollen, gehen beide
Befehle.

Die alte Adresse `gehstock.netlify.app` bleibt vorerst als Rückweg stehen. Dorthin
wird **nicht** mehr veröffentlicht: Beide Seiten haben eigene, getrennte
Spielerwelten, und ein Deploy dorthin lässt die Spielstände auseinanderlaufen.

## Berichten

Über Git redest du nur in einer Zeile. Nach einem Push hängst du ans Ende deiner
Antwort:

`↑ gepusht: <Commit-Nachricht>`

Hast du vorher etwas vom Partner geholt, davor:

`↓ geholt: <was er geändert hat, in fünf Wörtern>`

Ansonsten redest du mit dem Nutzer über die Website, nicht über Git.
