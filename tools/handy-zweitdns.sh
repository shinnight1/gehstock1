#!/data/data/com.termux/files/usr/bin/bash
# Haelt die Zweitadresse bei ddnss.de (z. B. gehstock.ddnss.de) auf der aktuellen
# Heim-IP. Laeuft als Schleife im Hintergrund, gestartet von tools/handy-dienste.sh.
set -u
umask 077

config_dir="$HOME/.config/gehstock1"
# shellcheck source=/dev/null
. "$config_dir/zweitadresse.env"
router="${HEIMROUTER:-192.168.2.1}"

while :; do
  # Nur im Heim-WLAN melden, sonst landete die IP des Mobilfunknetzes im DNS.
  if curl -s -o /dev/null --max-time 5 "http://$router/"; then
    # ip4.ddnss.de setzt nur den A-Eintrag. Ueber IPv6 gibt es keine
    # Portumleitung, 443 kaeme nie bei Caddy an.
    # Die URL mit Key geht ueber stdin an curl, nicht in die Prozessliste.
    antwort="$(printf 'url = "https://ip4.ddnss.de/upd.php?key=%s&host=%s"\n' \
      "$ZWEIT_KEY" "$ZWEIT_HOST" | curl -fsS --max-time 20 -K - 2>&1 \
      | sed 's/<[^>]*>//g' | tr -s ' \n' ' ' | cut -c1-200)"
  else
    antwort='kein Heim-WLAN, nichts gemeldet'
  fi
  printf '%s %s\n' "$(date '+%F %T')" "$antwort" > "$config_dir/zweitadresse.log"
  sleep 300
done
