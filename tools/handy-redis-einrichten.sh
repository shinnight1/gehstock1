#!/data/data/com.termux/files/usr/bin/bash
# Aufruf: bash tools/handy-redis-einrichten.sh
# Richtet Redis auf dem Handy ein und kopiert die Spielerwelt probeweise hinein.
# Der Server bleibt dabei auf Upstash - umgeschaltet wird erst mit
# tools/handy-redis-umschalten.sh.
set +x
set -euo pipefail
umask 077

repo="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
config_dir="$HOME/.config/gehstock1"
cd "$repo"

if [[ -f "$config_dir/redis-live" ]]; then
  echo 'Das Handy laeuft schon auf dem lokalen Redis. Nichts zu tun.'
  exit 0
fi
[[ -f "$config_dir/server.env" ]] || { echo 'Zuerst tools/handy-einrichten.sh ausfuehren.'; exit 1; }

command -v redis-server >/dev/null || pkg install -y redis
command -v pkill >/dev/null || pkg install -y procps
npm ci --no-audit --no-fund >/dev/null

# Der Upstash-Zugang wird aufgehoben: Er bleibt Quelle fuer den Umzug
# und spaeter Ablage fuer die Sicherungen ausser Haus.
if [[ ! -f "$config_dir/upstash.env" ]]; then
  grep -q 'upstash\.io' "$config_dir/server.env" || { echo 'server.env zeigt nicht auf Upstash.'; exit 1; }
  cp "$config_dir/server.env" "$config_dir/upstash.env"
  chmod 600 "$config_dir/upstash.env"
fi

if [[ ! -f "$config_dir/redis.env" ]]; then
  geheim() { node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("hex"))'; }
  printf 'REDIS_PASS=%s\nGATEWAY_TOKEN=%s\nREDIS_PORT=6379\nGATEWAY_PORT=8079\n' "$(geheim)" "$(geheim)" \
    > "$config_dir/redis.env"
  chmod 600 "$config_dir/redis.env"
fi
# shellcheck source=/dev/null
. "$config_dir/redis.env"

mkdir -p "$config_dir/redis"
conf="$config_dir/redis.conf"
schreiben() {
  {
    printf 'bind 127.0.0.1\nport %s\nprotected-mode yes\nrequirepass %s\n' "$REDIS_PORT" "$REDIS_PASS"
    printf 'dir %s\ndbfilename dump.rdb\n' "$config_dir/redis"
    # Jede Sekunde auf den Speicher schreiben, dazu regelmaessige Abzuege.
    printf 'appendonly yes\nappendfsync everysec\nsave 3600 1 300 100 60 10000\n'
    printf 'daemonize yes\npidfile %s\nlogfile %s\n' "$config_dir/redis.pid" "$config_dir/redis.log"
    printf '%s' "${1:-}"
  } > "$conf"
  chmod 600 "$conf"
}
schreiben
laeuft() { REDISCLI_AUTH="$REDIS_PASS" redis-cli -p "$REDIS_PORT" ping 2>/dev/null | grep -q PONG; }
if ! laeuft; then
  redis-server "$conf" || true
  sleep 2
  # Manche ARM-Kernel meldet Redis als fehlerhaft und startet dann nicht.
  if ! laeuft && grep -q 'ARM64-COW-BUG' "$config_dir/redis.log" 2>/dev/null; then
    schreiben $'ignore-warnings ARM64-COW-BUG\n'
    redis-server "$conf" || true
    sleep 2
  fi
fi
laeuft || { echo "Redis startet nicht. Letzte Zeilen aus $config_dir/redis.log:"; tail -5 "$config_dir/redis.log"; exit 1; }
echo "Redis laeuft ($(redis-server --version | cut -d' ' -f3))."

bash "$repo/tools/handy-dienste.sh"

echo 'Probeumzug: Upstash wird nur gelesen ...'
node tools/redis-umziehen.mjs

echo
echo 'Probe bestanden. Der Server laeuft weiter auf Upstash.'
echo 'Umschalten erst, wenn die anderen Adressen abgeschaltet sind:'
echo '  bash tools/handy-redis-umschalten.sh'
