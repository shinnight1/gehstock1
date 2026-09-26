#!/data/data/com.termux/files/usr/bin/bash
# Haelt die DuckDNS-Adresse auf der aktuellen Heim-IP. Laeuft als Schleife im
# Hintergrund, gestartet von tools/handy-dienste.sh.
set -u
umask 077

config_dir="$HOME/.config/gehstock1"
# shellcheck source=/dev/null
. "$config_dir/duckdns.env"
router="${HEIMROUTER:-192.168.2.1}"

while :; do
  # Nur im Heim-WLAN melden. Ueber mobile Daten wuerde DuckDNS sonst die IP des
  # Mobilfunknetzes eintragen, und die Seite waere weg, bis das WLAN zurueck ist.
  if curl -s -o /dev/null --max-time 5 "http://$router/"; then
    # Die URL mit Token geht ueber stdin an curl, nicht in die Prozessliste.
    antwort="$(printf 'url = "https://www.duckdns.org/update?domains=%s&token=%s&ip="\n' \
      "$DUCKDNS_DOMAIN" "$DUCKDNS_TOKEN" | curl -fsS --max-time 20 -K - 2>&1)" || true
  else
    antwort='kein Heim-WLAN, nichts gemeldet'
  fi
  printf '%s %s\n' "$(date '+%F %T')" "$antwort" > "$config_dir/duckdns.log"
  sleep 300
done
