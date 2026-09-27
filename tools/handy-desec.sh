#!/data/data/com.termux/files/usr/bin/bash
# Haelt die Zweitadresse bei deSEC (z. B. gehstock.dedyn.io) auf der aktuellen
# Heim-IP. Laeuft als Schleife im Hintergrund, gestartet von tools/handy-dienste.sh.
set -u
umask 077

config_dir="$HOME/.config/gehstock1"
# shellcheck source=/dev/null
. "$config_dir/desec.env"
router="${HEIMROUTER:-192.168.2.1}"

while :; do
  # Nur im Heim-WLAN melden, sonst landete die IP des Mobilfunknetzes im DNS.
  if curl -s -o /dev/null --max-time 5 "http://$router/"; then
    # update4 nimmt nur IPv4 an und setzt den A-Eintrag. myipv6= loescht AAAA:
    # ueber IPv6 gibt es keine Portumleitung, 443 kaeme nie bei Caddy an.
    # Name und Token gehen ueber stdin an curl, nicht in die Prozessliste.
    antwort="$(printf 'url = "https://update4.dedyn.io/?myipv6="\nuser = "%s:%s"\n' \
      "$DESEC_HOST" "$DESEC_TOKEN" | curl -fsS --max-time 20 -K - 2>&1)" || true
  else
    antwort='kein Heim-WLAN, nichts gemeldet'
  fi
  printf '%s %s\n' "$(date '+%F %T')" "$antwort" > "$config_dir/desec.log"
  sleep 300
done
