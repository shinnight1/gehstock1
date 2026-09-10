Einmal am Anfang des Chats. Holt den Stand des Partners und übernimmt danach das
komplette Git-Handling im Hintergrund.

# Teil 1: Jetzt sofort

Lies zuerst `AGENTS.md` im Projektordner. Führe dann aus:

```bash
git status --short
git branch --show-current
git fetch --quiet
git log --oneline HEAD..@{u}
git diff --stat HEAD..@{u}
```

1. **Uncommittete Änderungen prüfen.** Zeigt `git status --short` Einträge, ziehe
   nicht automatisch. Sag mir, was da liegt, und frag, ob committet oder verworfen
   werden soll. Erst danach weiter.

2. **Stand holen.** Gibt es neue Commits vom Partner, führe `git pull` aus. Bei
   einem Merge-Konflikt folge `.claude/skills/git-sync/SKILL.md`.

3. **Die Änderungen tatsächlich lesen.** Öffne die Dateien, die der Partner
   angefasst hat. Commit-Nachrichten reichen nicht.

4. **Kurz berichten**, höchstens fünf Zeilen, ohne Vorrede: Was hat der Partner
   geändert? Betrifft es Dateien, an denen ich zuletzt war? Ist etwas halbfertig
   oder kaputt? Ist nichts Neues da, sag das in einem Satz.

# Teil 2: Für den Rest dieser Unterhaltung

Ab jetzt übernimmst du Git vollständig. Ich arbeite so, als wäre es eine ganz
normale lokale Datei. Es gelten die Regeln aus `AGENTS.md`, insbesondere:

- Vor jeder Bearbeitung einer Datei `git fetch` und prüfen, ob der Partner gepusht
  hat. Wenn ja: erst `git pull`, betroffene Dateien lesen, dann arbeiten.
- Nach jeder abgeschlossenen Änderung sofort `git add .`, `git commit` und
  `git push`, ohne mich vorher zu fragen.
- Ein abgelehnter Push ist der Normalfall: `git pull`, Merge auflösen, `git push`.
  Melde dich nur, wenn sich die Versionen inhaltlich widersprechen.
- `git push --force` und `git reset --hard` sind gesperrt.
- Jeder Push geht sofort live. Lass vor einem Push, der die Seite verändert,
  `node tools/test.mjs` laufen.

Kein Git-Geschwafel. Nach einem Push hängst du eine Zeile ans Ende deiner Antwort:

`↑ gepusht: <Commit-Nachricht>`

Hast du vorher etwas geholt, davor:

`↓ geholt: <was er geändert hat, in fünf Wörtern>`

Bestätige Teil 2 mit genau einem Satz, dann fangen wir an.
