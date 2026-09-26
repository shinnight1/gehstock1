#!/data/data/com.termux/files/usr/bin/bash
# Aufruf: bash tools/handy-dauerbetrieb.sh gehstock
# Einmalig nach tools/handy-einrichten.sh: DuckDNS-Aktualisierung, Caddy und
# Autostart nach einem Handy-Neustart. Kein Token in Argumenten oder Quellcode.
set +x
set -euo pipefail
umask 077

repo="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
config_dir="$HOME/.config/gehstock1"
config="$config_dir/server.env"

if [[ ! -f "$config" ]]; then
  echo 'Zuerst tools/handy-einrichten.sh ausfuehren.'
  exit 1
fi
command -v caddy >/dev/null || pkg install -y caddy

domain="${1:-}"
if [[ -z "$domain" ]]; then
  IFS= read -r -p 'DuckDNS-Name (z. B. gehstock): ' domain </dev/tty
fi
domain="${domain%.duckdns.org}"
if [[ ! "$domain" =~ ^[a-z0-9-]+$ ]]; then
  echo "Ungueltiger DuckDNS-Name: $domain"
  exit 1
fi

echo 'Token von duckdns.org kopieren (steht oben auf der Seite).'
echo 'Beim Einfuegen bleibt die Eingabe unsichtbar. Danach Enter druecken.'
IFS= read -r -s -p 'DuckDNS-Token: ' token </dev/tty
printf '\n'
antwort="$(printf 'url = "https://www.duckdns.org/update?domains=%s&token=%s&ip="\n' \
  "$domain" "$token" | curl -fsS --max-time 20 -K - 2>&1)" || true
if [[ "$antwort" != OK ]]; then
  echo "DuckDNS lehnt ab ($antwort). Name und Token pruefen."
  exit 1
fi
printf 'DUCKDNS_DOMAIN=%q\nDUCKDNS_TOKEN=%q\n' "$domain" "$token" > "$config_dir/duckdns.env"
unset token
chmod 600 "$config_dir/duckdns.env"
echo "DuckDNS angenommen: $domain.duckdns.org"

# Termux darf keine Ports unter 1024 oeffnen. Der Router leitet deshalb
# 80 auf 8081 und 443 auf 8443 um; Caddy reicht an Node auf 8080 weiter.
if [[ ! -f "$config_dir/Caddyfile" ]]; then
  printf '{\n\thttp_port 8081\n\thttps_port 8443\n}\n\n%s.duckdns.org {\n\tencode zstd gzip\n\treverse_proxy 127.0.0.1:8080\n}\n' \
    "$domain" > "$config_dir/Caddyfile"
fi
caddy validate --config "$config_dir/Caddyfile" --adapter caddyfile >/dev/null

# Handstart und Autostart nutzen denselben Weg ueber handy-dienste.sh.
{
  printf '#!/data/data/com.termux/files/usr/bin/bash\nset -e\numask 077\n'
  printf 'command -v termux-wake-lock >/dev/null && termux-wake-lock || true\n'
  printf 'bash %q\n' "$repo/tools/handy-dienste.sh"
  printf 'cd -- %q\n' "$repo"
  printf 'exec node tools/handy-server.mjs %q\n' "$config"
} > "$HOME/start-gehstock1"
chmod 700 "$HOME/start-gehstock1"

mkdir -p "$HOME/.termux/boot"
{
  printf '#!/data/data/com.termux/files/usr/bin/bash\n'
  printf 'termux-wake-lock\n'
  printf '# WLAN nach dem Hochfahren abwarten.\nsleep 30\n'
  printf 'nohup bash %q > %q 2>&1 &\n' "$HOME/start-gehstock1" "$config_dir/server.log"
} > "$HOME/.termux/boot/gehstock1"
chmod 700 "$HOME/.termux/boot/gehstock1"

bash "$repo/tools/handy-dienste.sh"

echo
echo 'Fertig. Noch von Hand in Android zu erledigen:'
echo "1. App Termux:Boot aus derselben Quelle wie Termux installieren (${TERMUX_APK_RELEASE:-Quelle unbekannt}) und einmal oeffnen."
echo '2. Einstellungen > Apps > Termux > Akku > Nicht eingeschraenkt. Dasselbe fuer Termux:Boot.'
echo 'Den Server startest du wie bisher mit: bash ~/start-gehstock1'
