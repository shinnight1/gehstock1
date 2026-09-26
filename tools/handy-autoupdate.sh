#!/data/data/com.termux/files/usr/bin/bash
# Laeuft im Hintergrund (gestartet von handy-dienste.sh): schaut alle zwei
# Minuten auf GitHub nach und spielt einen neuen Stand von main selbst ein -
# ueber tools/handy-aktualisieren.sh, also nur, wenn Tests, Build und Start
# klappen. Ein abgelehnter Stand wird erst mit dem naechsten Push neu versucht.
set -u
umask 077

repo="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
config_dir="$HOME/.config/gehstock1"

while :; do
  sleep 120
  cd "$repo" || continue
  git fetch -q origin 2>/dev/null || continue
  neu="$(git rev-parse origin/main)"
  [[ "$neu" == "$(git rev-parse HEAD)" ]] && continue
  [[ "$neu" == "$(cat "$config_dir/update-abgelehnt" 2>/dev/null)" ]] && continue
  { date '+%F %T'; bash "$repo/tools/handy-aktualisieren.sh"; } > "$config_dir/update.log" 2>&1
done
