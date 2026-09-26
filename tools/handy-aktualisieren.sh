#!/data/data/com.termux/files/usr/bin/bash
# Aufruf: bash ~/gehstock1/tools/handy-aktualisieren.sh
# Holt den neuesten Stand von GitHub, baut die Seite neu und startet den Server
# neu - im Hintergrund, genau wie nach einem Handy-Neustart. Die Seite ist dabei
# nur fuer die Dauer des Neustarts weg (wenige Sekunden, mit neuen Paketen laenger).
set -euo pipefail
umask 077

# Alles steckt in main: git pull darf dieses Skript waehrend des Laufs ersetzen,
# bash hat es dann schon vollstaendig gelesen.
main() {
  repo="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
  config_dir="$HOME/.config/gehstock1"
  cd "$repo"

  stoppen() { pkill -f 'tools/handy-server.mjs' || true; sleep 1; }
  vorher="$(sha1sum package-lock.json arena/package-lock.json 2>/dev/null || true)"
  git pull --ff-only
  if [[ "$vorher" != "$(sha1sum package-lock.json arena/package-lock.json 2>/dev/null || true)" ]]; then
    # Neue Pakete: npm ci raeumt node_modules komplett aus, der Server muss vorher weg.
    echo 'Pakete haben sich geaendert, installiere neu ...'
    stoppen
    npm ci --no-audit --no-fund
    npm ci --prefix arena --no-audit --no-fund
  fi
  node tools/deploy-bauen.mjs >/dev/null
  echo 'Seite gebaut.'

  # Caddy packt Antworten (zstd/gzip). Aeltere Caddyfiles bekommen das nachgeruestet.
  if [[ -f "$config_dir/Caddyfile" ]] && ! grep -q 'encode' "$config_dir/Caddyfile"; then
    domain="$(grep -o '^[a-z0-9.-]*\.duckdns\.org' "$config_dir/Caddyfile" | head -1)"
    printf '{\n\thttp_port 8081\n\thttps_port 8443\n}\n\n%s {\n\tencode zstd gzip\n\treverse_proxy 127.0.0.1:8080\n}\n' \
      "$domain" > "$config_dir/Caddyfile"
    caddy reload --config "$config_dir/Caddyfile" --adapter caddyfile >/dev/null 2>&1 \
      && echo 'Caddy komprimiert jetzt.' || echo 'Caddy-Neuladen fehlgeschlagen - laeuft mit alter Einstellung weiter.'
  fi

  stoppen
  nohup bash "$HOME/start-gehstock1" > "$config_dir/server.log" 2>&1 &
  for _ in $(seq 1 30); do
    curl -s -o /dev/null http://127.0.0.1:8080/ && break
    sleep 1
  done
  if curl -s -o /dev/null http://127.0.0.1:8080/; then
    grep -E 'Verbunden|Sicherung' "$config_dir/server.log" || true
    echo 'Aktualisiert, Server laeuft im Hintergrund.'
  else
    echo 'Server startet nicht. Letzte Zeilen:'
    tail -5 "$config_dir/server.log"
    exit 1
  fi
}
main "$@"
