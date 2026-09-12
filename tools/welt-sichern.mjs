/* ------------------------------------------------------------------
   Sichert alle dauerhaften Serverdaten in einen Ordner.

   Zwei Speicher tragen Daten, die niemand nachbauen kann:

       hgh-gehstockmon   world-v2      Spieler, Gold, Mons, Gebiete
       hgh-rooms         kanal:*       Chatbretter und Protokoll
                         verwaltung    Rollen der Spieler
                         wplace        gemeinsame Pixel-Weltkarte
                         bild:*        hochgeladene Bilder
                         welt          Versionszaehler der obigen

   Kurzlebig und bewusst nicht gesichert: room:* (20 Minuten),
   schirm:* (Bildschirmuebertragung), presence-v1 (15 Sekunden).

   Das Skript liest nur. Es veraendert nichts auf dem Server.
   ------------------------------------------------------------------ */

import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const STORES = ['hgh-gehstockmon', 'hgh-rooms', 'hgh-gehstockmon-presence'];
const FLUECHTIG = [/^room:/, /^schirm:/, /^presence-v1$/];

function cli(args) {
  return new Promise((ok, fehler) => {
    execFile('npx', ['netlify', ...args], { shell: true, maxBuffer: 256 * 1024 * 1024 },
      (e, out, err) => (e ? fehler(new Error((err || e.message).trim())) : ok(out)));
  });
}

/* Die CLI hat ihr Listenformat schon zweimal geaendert. Darum alle
   bekannten Formen abklopfen, statt auf eine zu wetten. */
function keysAus(text) {
  let roh;
  try { roh = JSON.parse(text); } catch { return null; }
  const liste = Array.isArray(roh) ? roh : (roh.blobs || roh.objects || roh.keys || []);
  return liste.map((v) => (typeof v === 'string' ? v : v && v.key)).filter(Boolean);
}

const ziel = path.join('backup', new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-'));
let geholt = 0, uebersprungen = 0, bytes = 0;

for (const store of STORES) {
  let keys;
  try { keys = keysAus(await cli(['blobs:list', store, '--json'])); }
  catch (e) { console.log('! ' + store + ' nicht lesbar: ' + e.message.split('\n')[0]); continue; }
  if (!keys) { console.log('! ' + store + ': Liste unlesbar'); continue; }

  await mkdir(path.join(ziel, store), { recursive: true });
  console.log('\n' + store + ' - ' + keys.length + ' Schluessel');

  /* Schluessel wie 'kanal:kreis' oder 'bild:a1b2' sind keine gueltigen
     Dateinamen. Sie werden entschaerft, und weil sich daraus der
     Originalname nicht zurueckrechnen laesst, merkt sich eine Liste die
     Zuordnung. Ohne die waere die Sicherung nicht einspielbar. */
  const verzeichnis = [];

  for (const key of keys) {
    if (FLUECHTIG.some((r) => r.test(key))) { uebersprungen++; continue; }
    const name = key.replace(/[^a-zA-Z0-9._-]/g, '_') + '.json';
    try {
      const inhalt = await cli(['blobs:get', store, key]);
      await writeFile(path.join(ziel, store, name), inhalt);
      verzeichnis.push({ key, datei: name, bytes: Buffer.byteLength(inhalt) });
      geholt++; bytes += Buffer.byteLength(inhalt);
      console.log('  ' + key + '  ' + (Buffer.byteLength(inhalt) / 1024).toFixed(1) + ' KB');
    } catch (e) { console.log('  FEHLER bei ' + key + ': ' + e.message.split('\n')[0]); }
  }

  await writeFile(path.join(ziel, store, '_schluessel.json'), JSON.stringify(verzeichnis, null, 2));
}

console.log('\n' + geholt + ' Dateien gesichert, ' + uebersprungen + ' kurzlebige uebersprungen.');
console.log('Gesamt: ' + (bytes / 1024 / 1024).toFixed(2) + ' MB in ' + ziel);
if (!geholt) console.log('\nNichts geholt. Zuerst: npx netlify login  und  npx netlify link');
