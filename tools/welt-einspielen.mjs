/* ------------------------------------------------------------------
   Spielt eine Sicherung in den Redis-Speicher ein.

   Aufruf:   node tools/welt-einspielen.mjs backup/2026-09-12-15-30
             node tools/welt-einspielen.mjs backup/... --probe

   --probe schreibt nichts, sondern zeigt nur, was geschrieben wuerde.

   Ziel ist das Redis auf dem Handy:
     node --env-file=$HOME/.config/gehstock1/redis.env tools/welt-einspielen.mjs <ordner>
   Mit den UPSTASH_-Werten in der Umgebung stattdessen Upstash.

   Vorhandene Eintraege werden ueberschrieben. Das ist gewollt: die
   Sicherung ist die Wahrheit, der Zielspeicher wird angeglichen.
   ------------------------------------------------------------------ */

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { datenbank } from './datenbank.mjs';

const ordner = process.argv[2];
const probe = process.argv.includes('--probe');

if (!ordner) {
  console.log('Welcher Ordner? Beispiel:\n  node tools/welt-einspielen.mjs backup/2026-09-12-15-30');
  process.exit(1);
}
const r = probe ? null : await datenbank();
if (!probe && !r) {
  console.log('Die Zugangsdaten fehlen: --env-file=$HOME/.config/gehstock1/redis.env mitgeben.');
  process.exit(1);
}

let stores;
try { stores = (await readdir(ordner, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name); }
catch { console.log('Ordner nicht gefunden: ' + ordner); process.exit(1); }

let geschrieben = 0, fehler = 0;

for (const store of stores) {
  let verzeichnis;
  try { verzeichnis = JSON.parse(await readFile(path.join(ordner, store, '_schluessel.json'), 'utf8')); }
  catch { console.log('! ' + store + ': _schluessel.json fehlt, uebersprungen'); continue; }

  console.log('\n' + store + ' - ' + verzeichnis.length + ' Eintraege');

  for (const eintrag of verzeichnis) {
    let text;
    try { text = await readFile(path.join(ordner, store, eintrag.datei), 'utf8'); }
    catch { console.log('  FEHLT: ' + eintrag.datei); fehler++; continue; }

    /* Lieber hier abbrechen als eine kaputte Welt einspielen. */
    try { JSON.parse(text); }
    catch { console.log('  KEIN JSON: ' + eintrag.datei); fehler++; continue; }

    const d = 'hgh:' + store + ':' + eintrag.key;
    if (probe) { console.log('  wuerde schreiben: ' + d + '  ' + (text.length / 1024).toFixed(1) + ' KB'); geschrieben++; continue; }
    try {
      await r.set(d, text);
      geschrieben++;
      console.log('  ' + eintrag.key + '  ' + (text.length / 1024).toFixed(1) + ' KB');
    } catch (e) { console.log('  FEHLER bei ' + eintrag.key + ': ' + e.message); fehler++; }
  }
}

console.log('\n' + geschrieben + (probe ? ' Eintraege waeren geschrieben' : ' Eintraege geschrieben') + ', ' + fehler + ' Fehler.');
r?.schliessen();
if (fehler) process.exit(1);
