---
name: git-sync
description: Sicherer Git-Ablauf für ein Projekt, an dem zwei Personen parallel mit Claude Code arbeiten. Regelt Pull vor der Arbeit, Commit und Push danach, und das Auflösen von Merge-Konflikten ohne Datenverlust. Nutze diesen Skill immer, wenn ein Push abgelehnt wird, ein Merge-Konflikt auftritt, der Nutzer wissen will ob er den aktuellen Stand hat, Änderungen hochgeladen werden sollen, oder wenn er sagt dass sein Partner ebenfalls gerade am Projekt arbeitet — auch dann, wenn das Wort "Git" gar nicht vorkommt.
---

# Git-Sync für zwei Personen

Zwei Leute arbeiten an denselben Dateien, jeder mit eigener Claude-Code-Instanz auf eigenem Rechner. Abgeglichen wird über ein gemeinsames GitHub-Repo. Dieser Skill beschreibt den Ablauf, der verhindert, dass jemand die Arbeit des anderen verliert.

## Grundregeln

1. **Niemals `git push --force`, `git push -f` oder `git reset --hard` auf gemeinsamen Branches.** Das sind die einzigen Befehle, die die Arbeit des Partners wirklich zerstören können. Wenn dir kein anderer Weg einfällt, frag den Nutzer, statt zu forcen.
2. **Nie ungefragt Änderungen des Partners verwerfen.** Bei jedem Konflikt gilt: im Zweifel beide Versionen behalten und den Nutzer entscheiden lassen.
3. **Kleine Commits, oft pushen.** Je länger ungepushte Arbeit liegt, desto größer der Konflikt.

## Ablauf am Anfang der Session

Der SessionStart-Hook holt den aktuellen Stand normalerweise schon automatisch. Wenn du unsicher bist, ob der Stand aktuell ist:

```bash
git status
git pull
```

Liegen uncommittete Änderungen im Ordner, **nicht** einfach pullen. Erst mit dem Nutzer klären, ob die committet oder verworfen werden sollen.

## Ablauf am Ende einer Aufgabe

Immer wenn eine abgeschlossene Änderung fertig ist — nicht erst am Ende des Tages:

```bash
git add .
git commit -m "kurze Beschreibung was geändert wurde"
git push
```

Commit-Nachricht auf Deutsch, ein Satz, beschreibt was fachlich passiert ist ("Kontaktformular ergänzt"), nicht welche Datei angefasst wurde.

## Wenn der Push abgelehnt wird

Fehlermeldung in etwa: `Updates were rejected because the remote contains work that you do not have locally.`

Das ist der Normalfall, kein Fehler. Es bedeutet: der Partner hat in der Zwischenzeit gepusht. Ablauf:

```bash
git pull
```

Dann einer von zwei Fällen:

**Fall A — Git merged automatisch.** Meldung wie `Merge made by the 'ort' strategy`. Nichts weiter zu tun:

```bash
git push
```

**Fall B — Merge-Konflikt.** Siehe nächster Abschnitt.

## Merge-Konflikt auflösen

Git markiert die betroffenen Stellen direkt in der Datei:

```
<<<<<<< HEAD
eigene Version
=======
Version des Partners
>>>>>>> main
```

Vorgehen:

1. `git status` zeigt, welche Dateien betroffen sind.
2. Jede betroffene Stelle einzeln ansehen. **Beide Versionen lesen und verstehen, bevor du etwas löschst.**
3. Entscheiden:
   - Ergänzen sich die beiden Änderungen (z.B. jeder hat eine andere Funktion hinzugefügt)? Dann beide behalten und sauber zusammenführen.
   - Widersprechen sie sich (z.B. verschiedene Überschriften an derselben Stelle)? Dann **den Nutzer fragen**, welche gelten soll. Nicht selbst raten.
4. Die Markierungszeilen `<<<<<<<`, `=======` und `>>>>>>>` restlos entfernen.
5. Prüfen, dass die Datei danach noch gültig ist (HTML/JS/CSS syntaktisch korrekt).
6. Abschließen:

```bash
git add .
git commit -m "Merge-Konflikt in <Datei> aufgelöst"
git push
```

Wenn du dich beim Auflösen verrannt hast, ist nichts verloren:

```bash
git merge --abort
```

Damit ist der Zustand wie vor dem Pull, und ihr könnt neu ansetzen.

## Wenn der Nutzer glaubt, seine Arbeit sei weg

Sie ist es fast sicher nicht. Der Commit hängt weiter in der History.

```bash
git log --oneline --all -20
git reflog -20
```

Damit findest du den fraglichen Commit. Einzelne Datei aus einem alten Stand zurückholen:

```bash
git checkout <commit-hash> -- pfad/zur/datei
```

Erst danach, und nur wenn wirklich nötig, über weitergehende Schritte nachdenken — und die dem Nutzer vorher erklären.

## Konflikte von vornherein vermeiden

Wenn der Nutzer erzählt, dass sein Partner parallel arbeitet, weise auf die Aufteilung nach Dateien hin: jeder ist für bestimmte Dateien zuständig, in fremden Dateien wird nicht editiert. Das ist wirksamer als jede Konfliktlösung.

Besonders wichtig bei KI-Assistenten: Dateien möglichst punktuell ändern statt komplett neu zu schreiben. Eine komplett neu geschriebene Datei kollidiert mit praktisch jeder Änderung des Partners.
