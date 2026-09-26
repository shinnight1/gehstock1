#!/data/data/com.termux/files/usr/bin/bash
# Aufruf: bash tools/handy-redis-umschalten.sh
# Stellt den Handy-Server endgueltig auf das lokale Redis um: Server stoppen,
# Upstash ein letztes Mal frisch kopieren, server.env auf den Uebersetzer
# zeigen lassen. Ab dann ist das Redis auf dem Handy die Wahrheit.
set +x
set -euo pipefail
umask 077

repo="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
config_dir="$HOME/.config/gehstock1"
cd "$repo"

[[ -f "$config_dir/redis.env" ]] || { echo 'Zuerst tools/handy-redis-einrichten.sh ausfuehren.'; exit 1; }
[[ -f "$config_dir/redis-live" ]] && { echo 'Schon umgeschaltet.'; exit 0; }
# shellcheck source=/dev/null
. "$config_dir/redis.env"

echo 'Stoppe den Server, damit waehrend des Kopierens niemand schreibt ...'
pkill -f 'tools/handy-server.mjs' || true
sleep 2
bash "$repo/tools/handy-dienste.sh"

node tools/redis-umziehen.mjs

# Letzte Upstash-Sicherung vor dem Umschalten, falls je jemand zurueck will.
mkdir -p "$config_dir/sicherungen/vor-umschalten"
(cd "$config_dir/sicherungen/vor-umschalten" \
  && env -u UPSTASH_REDIS_REST_URL -u UPSTASH_REDIS_REST_TOKEN -u KV_REST_API_URL -u KV_REST_API_TOKEN \
     node --env-file="$config_dir/upstash.env" "$repo/tools/redis-sichern.mjs" >/dev/null)

tmp="$config_dir/server.env.neu"
printf 'UPSTASH_REDIS_REST_URL="http://127.0.0.1:%s"\nUPSTASH_REDIS_REST_TOKEN="%s"\n' "$GATEWAY_PORT" "$GATEWAY_TOKEN" > "$tmp"
chmod 600 "$tmp"
mv "$tmp" "$config_dir/server.env"
date '+%F %T' > "$config_dir/redis-live"

echo
echo 'Umgeschaltet. Das Redis auf dem Handy ist jetzt die Spielerwelt.'
echo 'Upstash bleibt unveraendert als Stand von eben und nimmt ab jetzt nur die naechtlichen Sicherungen auf.'
echo 'Server starten: bash ~/start-gehstock1'
