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
