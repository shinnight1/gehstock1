/* ------------------------------------------------------------------
   Spielt eine Sicherung in den Redis-Speicher ein.

   Aufruf:   node tools/welt-einspielen.mjs backup/2026-09-12-15-30
             node tools/welt-einspielen.mjs backup/... --probe

   --probe schreibt nichts, sondern zeigt nur, was geschrieben wuerde.

   Erwartet die beiden Zugaenge in der Umgebung:
       KV_REST_API_URL
       KV_REST_API_TOKEN

   Vorhandene Eintraege werden ueberschrieben. Das ist gewollt: die
   Sicherung ist die Wahrheit, der Zielspeicher wird angeglichen.
   ------------------------------------------------------------------ */

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { Redis } from '@upstash/redis';

const ordner = process.argv[2];
const probe = process.argv.includes('--probe');

if (!ordner) {
  console.log('Welcher Ordner? Beispiel:\n  node tools/welt-einspielen.mjs backup/2026-09-12-15-30');
  process.exit(1);
}
if (!probe && !(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)) {
  console.log('KV_REST_API_URL und KV_REST_API_TOKEN fehlen in der Umgebung.');
  process.exit(1);
}

/* automaticDeserialization aus, damit der Text byteweise so liegt, wie
   die Sicherung ihn enthaelt. Die Speicherschicht leitet ihren Stempel
   aus genau diesem Text ab - ein umformatierter Wert waere ein anderer
   Stempel und das erste Schreiben danach wuerde abgelehnt. */
const r = probe ? null : new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
  automaticDeserialization: false,
});

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

    const d = store + '|' + eintrag.key;
    if (probe) { console.log('  wuerde schreiben: ' + d + '  ' + (text.length / 1024).toFixed(1) + ' KB'); geschrieben++; continue; }
    try {
      await r.set(d, text);
      geschrieben++;
      console.log('  ' + eintrag.key + '  ' + (text.length / 1024).toFixed(1) + ' KB');
    } catch (e) { console.log('  FEHLER bei ' + eintrag.key + ': ' + e.message); fehler++; }
  }
}

console.log('\n' + geschrieben + (probe ? ' Eintraege waeren geschrieben' : ' Eintraege geschrieben') + ', ' + fehler + ' Fehler.');
if (fehler) process.exit(1);
