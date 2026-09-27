#!/data/data/com.termux/files/usr/bin/bash
# Aufruf: bash tools/handy-zweitadresse.sh gehstock
# Einmalig nach tools/handy-dauerbetrieb.sh: richtet eine zweite Adresse bei deSEC
# ein (gehstock.dedyn.io), fuer den Fall, dass ein Filter duckdns.org sperrt.
# Die DuckDNS-Adresse bleibt, Caddy bedient danach beide Namen.
# Vorher auf https://desec.io ein Konto mit dem Namen anlegen und einen Token
# erstellen. Kein Token in Argumenten oder Quellcode.
set +x
set -euo pipefail
umask 077

repo="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
config_dir="$HOME/.config/gehstock1"
caddyfile="$config_dir/Caddyfile"
router="${HEIMROUTER:-192.168.2.1}"

if [[ ! -f "$caddyfile" ]]; then
  echo 'Zuerst tools/handy-dauerbetrieb.sh ausfuehren.'
  exit 1
fi
if ! curl -s -o /dev/null --max-time 5 "http://$router/"; then
  echo 'Das Handy muss im Heim-WLAN sein, sonst meldet es die falsche IP.'
  exit 1
fi

name="${1:-}"
if [[ -z "$name" ]]; then
  IFS= read -r -p 'deSEC-Name (z. B. gehstock): ' name </dev/tty
fi
name="${name%.dedyn.io}"
if [[ ! "$name" =~ ^[a-z0-9-]+$ ]]; then
  echo "Ungueltiger Name: $name"
  exit 1
fi
host="$name.dedyn.io"

echo 'Token von desec.io einfuegen (Token management > neuer Token, das "secret").'
echo 'Beim Einfuegen bleibt die Eingabe unsichtbar. Danach Enter druecken.'
IFS= read -r -s -p 'deSEC-Token: ' token </dev/tty
printf '\n'
antwort="$(printf 'url = "https://update4.dedyn.io/?myipv6="\nuser = "%s:%s"\n' \
  "$host" "$token" | curl -fsS --max-time 20 -K - 2>&1)" || true
if [[ "$antwort" != good ]]; then
  echo "deSEC lehnt ab ($antwort). Name und Token pruefen."
  exit 1
fi
printf 'DESEC_HOST=%q\nDESEC_TOKEN=%q\n' "$host" "$token" > "$config_dir/desec.env"
unset token
chmod 600 "$config_dir/desec.env"
echo "deSEC angenommen: $host zeigt auf $(curl -fsS --max-time 10 https://checkipv4.dedyn.io/ || echo '?')"

# Den Namen neben den bisherigen in die Adresszeile von Caddy schreiben.
if grep -qF "$host" "$caddyfile"; then
  echo "$host steht schon im Caddyfile."
else
  cp "$caddyfile" "$caddyfile.vorher"
  sed -i -E "0,/^([a-z0-9][a-z0-9., -]*[a-z0-9]) \{\$/s//\1, $host {/" "$caddyfile"
  if ! grep -qF "$host" "$caddyfile" \
    || ! caddy validate --config "$caddyfile" --adapter caddyfile >/dev/null 2>&1; then
    mv "$caddyfile.vorher" "$caddyfile"
    echo 'Caddyfile liess sich nicht anpassen, alter Stand ist zurueck.'
    exit 1
  fi
  rm -f "$caddyfile.vorher"
  if curl -s -o /dev/null --max-time 2 http://localhost:2019/config/; then
    caddy reload --config "$caddyfile" --adapter caddyfile >/dev/null
  fi
  echo "Caddy bedient jetzt auch $host."
fi

# Startet die deSEC-Schleife und, falls noetig, Caddy.
bash "$repo/tools/handy-dienste.sh"

# Caddy holt das Zertifikat selbst. Geprueft wird direkt am Handy, weil nicht
# jeder Router Anfragen aus dem Heimnetz an die eigene Adresse zurueckreicht.
echo 'Warte auf das Zertifikat (bis zu drei Minuten) ...'
for _ in $(seq 36); do
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 \
    --resolve "$host:8443:127.0.0.1" "https://$host:8443/" || true)"
  if [[ "$code" =~ ^[23] ]]; then
    echo "Fertig: https://$host laeuft."
    exit 0
  fi
  sleep 5
done
echo "Noch kein Zertifikat fuer $host. In ein paar Minuten dasselbe Skript nochmal starten."
exit 1
