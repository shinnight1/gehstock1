# Codex in diesem Projekt

Codex liest `AGENTS.md` im Projektordner von selbst. Damit kennt er die Git-Regeln,
ohne dass du etwas einrichtest.

`prompts/sync.md` ist zusätzlich der Befehl `/sync`, das Gegenstück zu dem, was
Claude Code aus `.claude/commands/` bekommt. Codex sucht seine Befehle in deinem
Benutzerordner, nicht im Projekt. Kopier die Datei einmal dorthin:

Windows

```
copy .codex\prompts\sync.md %USERPROFILE%\.codex\prompts\sync.md
```

macOS und Linux

```
cp .codex/prompts/sync.md ~/.codex/prompts/sync.md
```

Danach Codex neu starten. `/sync` holt dann den Stand des Partners, berichtet kurz
und übernimmt Git für den Rest der Unterhaltung.
