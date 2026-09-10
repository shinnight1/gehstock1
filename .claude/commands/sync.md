---
description: Einmal am Anfang des Chats. Holt den Stand vom Partner und übernimmt danach das komplette Git-Handling im Hintergrund.
allowed-tools: Bash(git fetch:*), Bash(git status:*), Bash(git log:*), Bash(git diff:*), Bash(git pull:*), Bash(git add:*), Bash(git commit:*), Bash(git push:*), Bash(git branch:*), Read
---

# Kontext

- Eigener Ordner: !`git status --short || echo "kein Git-Repo"`
- Aktueller Branch: !`git branch --show-current`
- Neue Commits vom Partner: !`git fetch --quiet 2>/dev/null; git log --oneline HEAD..@{u} 2>/dev/null || echo "keine oder kein Remote-Branch gesetzt"`
- Dateien, die der Partner geändert hat: !`git diff --stat HEAD..@{u} 2>/dev/null || echo "-"`
- Letzte eigene Commits: !`git log --oneline -5`

# Teil 1: Jetzt sofort

1. **Uncommittete Änderungen prüfen.** Zeigt `git status --short` Einträge, ziehe **nicht** automatisch. Sag mir, was da liegt, und frag, ob committet oder verworfen werden soll. Erst danach weiter.

2. **Stand holen.** Gibt es neue Commits vom Partner, führe `git pull` aus. Bei einem Merge-Konflikt: Skill `git-sync` befolgen.

3. **Die Änderungen tatsächlich lesen.** Öffne die Dateien, die der Partner angefasst hat. Commit-Nachrichten reichen nicht.

4. **Kurz berichten**, maximal fünf Zeilen, ohne Vorrede: Was hat der Partner geändert? Betrifft es Dateien, an denen ich zuletzt war? Ist etwas halbfertig oder kaputt? Ist nichts Neues da, sag das in einem Satz.

# Teil 2: Für den Rest dieser Unterhaltung

Ab jetzt übernimmst du Git vollständig. Ich will damit nichts mehr zu tun haben und arbeite so, als wäre es eine ganz normale lokale Datei. Diese Regeln gelten bis zum Ende der Unterhaltung:

**Vor jeder Bearbeitung einer Datei:**
Führe `git fetch --quiet` aus und prüfe mit `git log --oneline HEAD..@{u}`, ob der Partner inzwischen etwas gepusht hat. Wenn ja: erst `git pull`, die betroffenen Dateien lesen, dann arbeiten. Damit fällt niemandem auf, dass zwei Leute an derselben Sache sitzen.

**Nach jeder abgeschlossenen Änderung:**
Sofort `git add .`, `git commit -m "..."` und `git push` — ohne mich vorher zu fragen. Commit-Nachricht auf Deutsch, ein kurzer Satz, fachlich formuliert ("Kontaktformular ergänzt"), nicht technisch ("index.html geändert"). Abgeschlossen heißt: ein sinnvoller Zwischenstand, nicht jede einzelne Zeile.

**Wenn der Push abgelehnt wird:**
Das ist der Normalfall, kein Grund mich zu stören. `git pull`, Merge auflösen, `git push`. Erledige das selbst. Melde dich nur, wenn sich die beiden Versionen inhaltlich widersprechen und du nicht entscheiden kannst, welche gelten soll — dann zeig mir beide und frag.

**Wenn ich etwas kaputtgemacht habe und es zurückwill:**
Nicht mit `git reset --hard` arbeiten. Alten Stand über `git log` oder `git reflog` finden und die betroffene Datei gezielt zurückholen.

**Absolut verboten:**
`git push --force`, `git push -f`, `git reset --hard` auf dem gemeinsamen Branch. Das ist der einzige Weg, wie die Arbeit meines Partners wirklich verlorengehen kann. Falls dir kein anderer Weg einfällt: fragen, nicht machen.

**Wie du davon berichtest:**
Kein Git-Geschwafel. Kündige nichts an, erkläre keine Befehle, zeig keine Ausgaben. Wenn du gepusht hast, hängst du ans Ende deiner Antwort **eine** Zeile:

`↑ gepusht: <Commit-Nachricht>`

Hast du vor dem Arbeiten etwas vom Partner geholt, davor **eine** Zeile:

`↓ geholt: <was er geändert hat, in fünf Wörtern>`

Mehr nicht. Ansonsten redest du mit mir über die Website, nicht über Git.

**Bestätige Teil 2 mit genau einem Satz**, dann fangen wir an.
