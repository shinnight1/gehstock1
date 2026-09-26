#!/data/data/com.termux/files/usr/bin/bash
# Aufruf: bash tools/handy-einrichten.sh https://DEINE-DATENBANK.upstash.io
# Kein Token in Argumenten, Quellcode, Terminalprotokoll oder Shell-History.
set +x
set -euo pipefail
umask 077

repo="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
config_dir="$HOME/.config/gehstock1"
config="$config_dir/server.env"
cd "$repo"

if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
  echo 'Bitte zuerst ausfuehren: pkg install nodejs-lts npm -y'
  exit 1
fi
node -e 'if (Number(process.versions.node.split(".")[0]) < 22) process.exit(1)' || {
  echo 'Node.js 22 oder neuer wird benoetigt.'; exit 1;
}

url="${1:-}"
if [[ -z "$url" ]]; then
  IFS= read -r -p 'Production-Wert von UPSTASH_REDIS_REST_URL: ' url </dev/tty
fi
echo 'Production-Token aus demselben Netlify-Projekt kopieren.'
echo 'Beim Einfuegen bleibt die Eingabe unsichtbar. Danach Enter druecken.'
IFS= read -r -s -p 'Token: ' token </dev/tty
printf '\n'
UPSTASH_REDIS_REST_URL="$url" UPSTASH_REDIS_REST_TOKEN="$token" \
  node tools/handy-zugang.mjs "$config"
unset token

echo 'Pakete und vollstaendige Website inklusive Arena vorbereiten ...'
npm ci --no-audit --no-fund
npm ci --prefix arena --no-audit --no-fund
node tools/deploy-bauen.mjs

echo 'Vorhandene Spielerwelt sichern (nur lesen) ...'
# Die neue Datei bestimmt die Datenbank, nicht eventuell alte Shell-Variablen.
# Ein eigener Ordner pro Lauf verhindert das Ueberschreiben frueherer Backups.
mkdir -p "$config_dir/sicherungen"
sicherung="$(mktemp -d "$config_dir/sicherungen/lauf-XXXXXXXX")"
(
  cd "$sicherung"
  env -u UPSTASH_REDIS_REST_URL -u UPSTASH_REDIS_REST_TOKEN \
      -u KV_REST_API_URL -u KV_REST_API_TOKEN \
      node --env-file="$config" "$repo/tools/redis-sichern.mjs"
)
echo "Sicherung liegt in: $sicherung"

# Fuer den naechsten Start braucht es nur noch: bash ~/start-gehstock1
{
  printf '#!/data/data/com.termux/files/usr/bin/bash\nset -e\numask 077\n'
  printf 'command -v termux-wake-lock >/dev/null && termux-wake-lock || true\n'
  printf 'cd -- %q\n' "$repo"
  printf 'exec node tools/handy-server.mjs %q\n' "$config"
} > "$HOME/start-gehstock1"
chmod 700 "$HOME/start-gehstock1"
echo 'Einrichtung fertig. Der Server startet jetzt auf http://localhost:8080'
bash "$HOME/start-gehstock1"
