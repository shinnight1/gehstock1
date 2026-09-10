# Projektregeln

Die Regeln für dieses Projekt stehen in [AGENTS.md](AGENTS.md). Lies die Datei zu
Beginn und halte dich daran. Sie gilt für jeden Assistenten, der hier arbeitet.

Zusätzlich für Claude Code:

- `/sync` am Anfang eines Chats holt den Stand des Partners und übergibt dir danach
  das komplette Git-Handling für den Rest der Unterhaltung.
- Bei einem Merge-Konflikt, einem abgelehnten Push oder wenn der Nutzer erwähnt,
  dass sein Partner gerade ebenfalls am Projekt arbeitet: Skill `git-sync`.
