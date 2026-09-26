#!/data/data/com.termux/files/usr/bin/bash
# Aufruf: bash ~/gehstock1/tools/handy-aktualisieren.sh
# Holt den neuesten Stand von GitHub, prueft ihn, baut die Seite neu und startet
# den Server neu - im Hintergrund, genau wie nach einem Handy-Neustart.
# Laeuft auch von selbst: tools/handy-autoupdate.sh ruft es auf, sobald auf
# GitHub etwas Neues liegt.
#
# Live geht nur, was die Tests besteht, sich bauen laesst und danach startet.
# Scheitert einer dieser Schritte, bleibt der bisherige Stand stehen und der
# neue wird in update-abgelehnt vermerkt, damit er nicht staendig neu versucht wird.
set -euo pipefail
umask 077

# Alles steckt in main: git merge darf dieses Skript waehrend des Laufs ersetzen,
# bash hat es dann schon vollstaendig gelesen.
main() {
  repo="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
  config_dir="$HOME/.config/gehstock1"
  cd "$repo"

  # Nie zwei Updates gleichzeitig (Hand und Automatik).
  sperre="$config_dir/update.lock"
  if ! mkdir "$sperre" 2>/dev/null; then
    if [[ -n "$(find "$sperre" -maxdepth 0 -mmin +30 2>/dev/null)" ]]; then rmdir "$sperre"; mkdir "$sperre"
    else echo 'Es laeuft schon ein Update.'; exit 0; fi
  fi
  trap 'rmdir "$sperre" 2>/dev/null || true' EXIT

  stoppen() { pkill -f 'tools/handy-server.mjs' || true; sleep 1; }
  starten() {
    nohup bash "$HOME/start-gehstock1" > "$config_dir/server.log" 2>&1 &
    for _ in $(seq 1 30); do curl -s -o /dev/null http://127.0.0.1:8080/ && return 0; sleep 1; done
    return 1
  }
  pakete() { sha1sum package-lock.json arena/package-lock.json 2>/dev/null || true; }
  installieren() { npm ci --no-audit --no-fund >/dev/null && npm ci --prefix arena --no-audit --no-fund >/dev/null; }

  alt="$(git rev-parse HEAD)"
  pakete_alt="$(pakete)"
  # Nach einem abgelehnten Stand steht der Klon abgekoppelt auf dem alten.
  git checkout -q main
  git fetch -q origin
  neu="$(git rev-parse origin/main)"
  if [[ "$neu" == "$alt" ]]; then echo 'Schon auf dem neuesten Stand.'; return 0; fi
  git merge -q --ff-only origin/main
  echo "Neuer Stand: $(git log -1 --format='%h %s')"

  zurueck() {
    echo "ABGELEHNT ($1). Der bisherige Stand bleibt live."
    echo "$neu" > "$config_dir/update-abgelehnt"
    git checkout -q --detach "$alt"
    [[ "$(pakete)" != "$pakete_alt" ]] && { stoppen; installieren; }
    rm -rf dist.neu
    if [[ -d dist.vorher ]]; then rm -rf dist; mv dist.vorher dist; fi
    curl -s -o /dev/null http://127.0.0.1:8080/ || { stoppen; starten || true; }
    exit 1
  }

  if [[ "$(pakete)" != "$pakete_alt" ]]; then
    # npm ci raeumt node_modules komplett aus, der Server muss vorher weg.
    echo 'Pakete haben sich geaendert, installiere neu ...'
    stoppen
    installieren || zurueck 'Pakete liessen sich nicht installieren'
  fi

  node tools/test.mjs > "$config_dir/update-tests.log" 2>&1 || zurueck 'Tests durchgefallen, siehe update-tests.log'
  node --test tools/handy-tests.mjs tools/handy-redis-tests.mjs >> "$config_dir/update-tests.log" 2>&1 \
    || zurueck 'Handy-Tests durchgefallen, siehe update-tests.log'
  echo 'Tests bestanden.'

  # Gebaut wird daneben: die laufende Seite behaelt ihre Dateien, bis getauscht wird.
  rm -rf dist.neu dist.vorher
  HIDEOUT_DIST="$repo/dist.neu" node tools/deploy-bauen.mjs > "$config_dir/update-build.log" 2>&1 \
    || zurueck 'Build gescheitert, siehe update-build.log'
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
  [[ -d dist ]] && mv dist dist.vorher
  mv dist.neu dist
  if ! starten; then
    tail -5 "$config_dir/server.log"
    stoppen
    zurueck 'Server startete mit dem neuen Stand nicht'
  fi
  rm -rf dist.vorher "$config_dir/update-abgelehnt"
  grep -E 'Verbunden' "$config_dir/server.log" || true
  echo 'Aktualisiert, Server laeuft im Hintergrund.'
}
main "$@"
