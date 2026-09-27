#!/data/data/com.termux/files/usr/bin/bash
# Aufruf: bash tools/handy-zweitadresse.sh gehstock.ddnss.de
# Einmalig nach tools/handy-dauerbetrieb.sh: richtet eine zweite Adresse bei
# ddnss.de ein, fuer den Fall, dass ein Filter duckdns.org sperrt.
# Die DuckDNS-Adresse bleibt, Caddy bedient danach beide Namen.
# Vorher auf https://ddnss.de ein Konto anlegen und den Host erstellen.
# Kein Key in Argumenten oder Quellcode.
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

host="${1:-}"
if [[ -z "$host" ]]; then
  IFS= read -r -p 'Host (z. B. gehstock.ddnss.de): ' host </dev/tty
fi
host="${host,,}"
if [[ ! "$host" =~ ^[a-z0-9-]+(\.[a-z0-9-]+)+$ ]]; then
  echo "Ungueltiger Host: $host"
  exit 1
fi

echo 'Update-Key von ddnss.de einfuegen (nach dem Login oben unter "Update Key").'
echo 'Beim Einfuegen bleibt die Eingabe unsichtbar. Danach Enter druecken.'
IFS= read -r -s -p 'Update-Key: ' key </dev/tty
printf '\n'
if [[ ! "$key" =~ ^[A-Za-z0-9]+$ ]]; then
  echo 'Der Key besteht nur aus Buchstaben und Ziffern. Nochmal kopieren.'
  exit 1
fi
antwort="$(printf 'url = "https://ip4.ddnss.de/upd.php?key=%s&host=%s"\n' \
  "$key" "$host" | curl -fsS --max-time 20 -K - 2>&1 | sed 's/<[^>]*>//g' | tr -s ' \n' ' ')" || true
printf 'ZWEIT_HOST=%q\nZWEIT_KEY=%q\n' "$host" "$key" > "$config_dir/zweitadresse.env"
unset key
chmod 600 "$config_dir/zweitadresse.env"

# Oeffentliches DNS gegen die Heim-IP pruefen. Resolver merken sich ein
# "gibt es nicht" bis zu einer halben Stunde, darum hier nur eine Warnung:
# ob alles stimmt, zeigt am Ende das Zertifikat.
ip="$(curl -fsS --max-time 10 https://api4.ipify.org || true)"
dns=''
for _ in $(seq 12); do
  for r in 'https://dns.google/resolve' 'https://cloudflare-dns.com/dns-query'; do
    dns="$(curl -fsS --max-time 10 -H 'accept: application/dns-json' "$r?name=$host&type=A" \
      | grep -o '"data":"[0-9.]*"' | head -1 | cut -d'"' -f4 || true)"
    [[ -n "$ip" && "$dns" == "$ip" ]] && break 2
  done
  sleep 5
done
if [[ -n "$ip" && "$dns" == "$ip" ]]; then
  echo "ddnss.de angenommen: $host zeigt auf $ip."
else
  echo "Achtung: $host zeigt im DNS noch auf '${dns:-nichts}', Heim-IP '${ip:-unbekannt}'."
  echo "Antwort von ddnss.de: ${antwort:0:200}"
fi

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

# Startet die Aktualisierung der Zweitadresse und, falls noetig, Caddy.
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
