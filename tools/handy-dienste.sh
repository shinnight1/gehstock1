#!/data/data/com.termux/files/usr/bin/bash
# Startet DuckDNS-Aktualisierung und Caddy im Hintergrund, falls sie noch nicht
# laufen. Mehrfaches Aufrufen schadet nicht.
set -u
umask 077

repo="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
config_dir="$HOME/.config/gehstock1"

command -v termux-wake-lock >/dev/null && termux-wake-lock || true

if [[ -f "$config_dir/duckdns.env" ]]; then
  pid="$(cat "$config_dir/duckdns.pid" 2>/dev/null || true)"
  if [[ -z "$pid" ]] || ! kill -0 "$pid" 2>/dev/null; then
    nohup bash "$repo/tools/handy-duckdns.sh" >/dev/null 2>&1 &
    echo $! > "$config_dir/duckdns.pid"
    echo 'DuckDNS-Aktualisierung gestartet.'
  fi
fi

if [[ -f "$config_dir/redis.conf" ]]; then
  # shellcheck source=/dev/null
  . "$config_dir/redis.env"
  laeuft() { REDISCLI_AUTH="$REDIS_PASS" redis-cli -p "$REDIS_PORT" ping 2>/dev/null | grep -q PONG; }
  if ! laeuft; then
    redis-server "$config_dir/redis.conf" >/dev/null 2>&1 && echo 'Redis gestartet.'
    for _ in 1 2 3 4 5 6 7 8 9 10; do laeuft && break; sleep 1; done
  fi
  pid="$(cat "$config_dir/gateway.pid" 2>/dev/null || true)"
  if [[ -z "$pid" ]] || ! kill -0 "$pid" 2>/dev/null; then
    nohup node "$repo/tools/handy-redis.mjs" "$config_dir/redis.env" > "$config_dir/gateway.log" 2>&1 &
    echo $! > "$config_dir/gateway.pid"
    echo 'Redis-Uebersetzer gestartet.'
  fi
  # Der Server prueft beim Start sofort die Welt - der Uebersetzer muss dann antworten.
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    curl -s -o /dev/null -X POST "http://127.0.0.1:$GATEWAY_PORT/" && break
    sleep 1
  done
  if [[ -f "$config_dir/redis-live" ]]; then
    pid="$(cat "$config_dir/sicherung.pid" 2>/dev/null || true)"
    if [[ -z "$pid" ]] || ! kill -0 "$pid" 2>/dev/null; then
      nohup bash "$repo/tools/handy-sicherung.sh" > /dev/null 2>&1 &
      echo $! > "$config_dir/sicherung.pid"
      echo 'Naechtliche Sicherung eingeplant.'
    fi
  fi
fi

if [[ -f "$config_dir/Caddyfile" ]]; then
  # Caddys Verwaltungsschnittstelle antwortet nur, wenn Caddy schon laeuft.
  if ! curl -s -o /dev/null --max-time 2 http://localhost:2019/config/; then
    caddy start --config "$config_dir/Caddyfile" --adapter caddyfile \
      > "$config_dir/caddy.log" 2>&1 \
      && echo 'Caddy gestartet.' \
      || echo "Caddy startet nicht, siehe $config_dir/caddy.log"
  fi
fi

exit 0
