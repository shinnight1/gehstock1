#!/data/data/com.termux/files/usr/bin/bash
# Laeuft im Hintergrund (gestartet von handy-dienste.sh), sobald das Handy auf
# dem lokalen Redis laeuft: einmal am Tag sichern, 14 Tage aufheben und eine
# gepackte Kopie ausser Haus zu Upstash legen. Geht das Handy verloren, bleibt
# die Kopie bei Upstash.
set -u
umask 077

repo="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
config_dir="$HOME/.config/gehstock1"
ziel="$config_dir/sicherungen/taeglich"
mkdir -p "$ziel"

sleep 600
while :; do
  {
    date '+%F %T'
    (cd "$ziel" && env -u UPSTASH_REDIS_REST_URL -u UPSTASH_REDIS_REST_TOKEN -u KV_REST_API_URL -u KV_REST_API_TOKEN \
      node --env-file="$config_dir/server.env" "$repo/tools/redis-sichern.mjs" | tail -3) \
      && node "$repo/tools/handy-auslagern.mjs"
    ls -1d "$ziel"/backup/*/ 2>/dev/null | sort | head -n -14 | xargs -r rm -rf
  } > "$config_dir/sicherung.log" 2>&1
  sleep 86400
done
