# Projektregeln

An diesem Projekt arbeiten zwei Personen parallel, jede mit einer eigenen Claude-Code-Instanz auf einem eigenen Rechner. Abgeglichen wird über das gemeinsame GitHub-Repo.

## Git

- Vor der Arbeit: aktuellen Stand holen (`git pull`). Der SessionStart-Hook macht das automatisch.
- Nach jeder abgeschlossenen Änderung: `git add .`, `git commit -m "..."`, `git push`. Nicht bis zum Ende des Tages warten.
- Commit-Nachrichten auf Deutsch, ein Satz, fachlich formuliert.
- **Niemals `git push --force` oder `git reset --hard`.** Das ist der einzige Weg, wie die Arbeit des Partners verlorengehen kann. Falls es unumgänglich scheint: den Nutzer fragen.
- Wird ein Push abgelehnt oder tritt ein Merge-Konflikt auf: dem Skill `git-sync` folgen.
- Bei einem Konflikt niemals ungefragt eine Seite verwerfen. Widersprechen sich die Versionen inhaltlich, den Nutzer entscheiden lassen.

## Arbeitsweise

- Dateien punktuell ändern statt komplett neu schreiben. Neu geschriebene Dateien erzeugen unnötige Konflikte mit den Änderungen des Partners.
- **Keine Aufteilung nach Dateien.** Beide arbeiten am gesamten Projekt, jeder darf
  jede Datei anfassen. Das ist so gewollt.

| Datei | zuständig |
|---|---|
| alles | Louis und der Partner gemeinsam |

Weil die Aufteilung fehlt, ist der Schutz vor Konflikten allein der Ablauf: vor jeder
Bearbeitung `git pull`, nach jeder fertigen Änderung sofort `git push`, und Dateien
punktuell ändern statt komplett neu schreiben. Wer länger als nötig ungepusht
arbeitet, produziert Konflikte.
