/* ------------------------------------------------------------------
   Sichert die Spielerwelt aus Redis in einen Ordner.

   Das Gegenstueck zu tools/welt-sichern.mjs, das noch aus der
   Netlify-Zeit stammt und ueber deren Kommandozeile geht. Seit dem
   Umzug liegen die Daten in Redis (Upstash), und dorthin fuehrt die
   alte Sicherung nicht mehr.

   Gesichert wird alles, was niemand nachbauen kann:

       hgh-gehstockmon   world-v2      Spieler, Gold, Mons, Gebiete
       hgh-rooms         verwaltung    Profile, Rollen, Sperren
                         kanal:*       Chatbretter und Protokoll
                         wplace        die gemeinsame Pixelkarte
                         bild:*        hochgeladene Bilder

   Kurzlebiges bleibt draussen: room:* (20 Minuten), schirm:*,
   presence-v1 (15 Sekunden).

   Das Ergebnis hat dasselbe Format wie welt-sichern.mjs und laesst
   sich mit tools/welt-einspielen.mjs zurueckspielen - auch in eine
   andere Datenbank. Das ist der Weg, wenn der Anbieter wechselt.

   Aufruf:
     vercel env pull .env.local
     node --env-file=.env.local tools/redis-sichern.mjs

   Das Skript liest nur. Es veraendert nichts.
   ------------------------------------------------------------------ */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Redis } from '@upstash/redis';

const STORES = ['hgh-gehstockmon', 'hgh-rooms', 'hgh-gehstockmon-presence'];
const FLUECHTIG = [/^room:/, /^schirm:/, /^presence-v1$/, /:v$/];

const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
if (!url || !token) {
  console.log('Die Redis-Zugangsdaten fehlen. Erst "vercel env pull .env.local",');
  console.log('dann "node --env-file=.env.local tools/redis-sichern.mjs".');
  process.exit(1);
}

/* automaticDeserialization aus: Der Text soll byteweise so herauskommen,
   wie er drinsteht. Die Speicherschicht leitet ihren Stempel aus genau
   diesem Text ab - ein umformatierter Wert waere ein anderer Stempel. */
const r = new Redis({ url, token, automaticDeserialization: false });

/* Eine Datenbank am Kontingentende lehnt einen Teil der Befehle ab
   ("max requests limit exceeded"). Genau dann braucht man die Sicherung
   am dringendsten - sie darf am ersten Fehlschlag nicht aufgeben, sondern
   fragt mit wachsender Pause nach. */
async function zaeh(was, beschreibung, versuche = 6) {
  for (let i = 0; i < versuche; i++) {
    try { return await was(); }
    catch (e) {
      const letzte = i === versuche - 1;
      console.log('  ' + (letzte ? 'FEHLER' : 'erneut') + ' bei ' + beschreibung + ': ' + String(e && e.message || e).split('\n')[0]);
      if (letzte) throw e;
      await new Promise((ok) => setTimeout(ok, 500 * (i + 1)));
    }
  }
}

const ziel = path.join('backup', new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-'));
let geholt = 0, uebersprungen = 0, bytes = 0;
const fehlend = [];

for (const store of STORES) {
  const prefix = 'hgh:' + store + ':';
  let cursor = '0', keys = [];
  do {
    const [next, gefunden] = await zaeh(() => r.scan(cursor, { match: prefix + '*', count: 500 }), 'Liste ' + store);
    cursor = String(next);
    keys.push(...gefunden);
  } while (cursor !== '0');

  const eigene = keys.map((k) => k.slice(prefix.length)).filter((k) => !FLUECHTIG.some((v) => v.test(k)));
  uebersprungen += keys.length - eigene.length;
  if (!eigene.length) { console.log('\n' + store + ' - nichts zu sichern'); continue; }

  await mkdir(path.join(ziel, store), { recursive: true });
  console.log('\n' + store + ' - ' + eigene.length + ' Schluessel');

  /* Schluessel wie 'kanal:kreis' sind keine gueltigen Dateinamen. Sie
     werden entschaerft, und weil sich daraus der Originalname nicht
     zurueckrechnen laesst, merkt sich eine Liste die Zuordnung. Ohne die
     waere die Sicherung nicht einspielbar. */
  const verzeichnis = [];
  for (const key of eigene) {
    let wert = null;
    try { wert = await zaeh(() => r.get(prefix + key), key); }
    catch (e) { fehlend.push(store + '/' + key + ' (' + String(e && e.message || e).split('\n')[0] + ')'); continue; }
    /* Ein leerer Wert ist hier kein Grund zum Weitergehen: Der Schluessel
       stand gerade noch in der Liste. Entweder wurde er in derselben Sekunde
       geloescht, oder die Datenbank hat die Antwort verschluckt - beides
       gehoert gemeldet, sonst fehlt er spaeter unbemerkt in der Sicherung. */
    if (wert === null || wert === undefined) { fehlend.push(store + '/' + key + ' (leer zurueckgekommen)'); continue; }
    const inhalt = typeof wert === 'string' ? wert : JSON.stringify(wert);
    const name = key.replace(/[^a-zA-Z0-9._-]/g, '_') + '.json';
    await writeFile(path.join(ziel, store, name), inhalt);
    verzeichnis.push({ key, datei: name, bytes: Buffer.byteLength(inhalt) });
    geholt++; bytes += Buffer.byteLength(inhalt);
    console.log('  ' + key + '  ' + (Buffer.byteLength(inhalt) / 1024).toFixed(1) + ' KB');
  }
  await writeFile(path.join(ziel, store, '_schluessel.json'), JSON.stringify(verzeichnis, null, 2));
}

console.log('\n' + geholt + ' Dateien gesichert, ' + uebersprungen + ' kurzlebige uebersprungen.');
console.log('Gesamt: ' + (bytes / 1024 / 1024).toFixed(2) + ' MB in ' + ziel);

if (fehlend.length) {
  console.log('\n!! UNVOLLSTAENDIG - ' + fehlend.length + ' Schluessel fehlen:');
  fehlend.forEach((v) => console.log('   ' + v));
  console.log('\nDiese Sicherung nicht als vollstaendig ansehen. Noch einmal laufen');
  console.log('lassen; bleibt es dabei, lehnt die Datenbank gerade Befehle ab');
  console.log('(Kontingent) - dann spaeter erneut versuchen.');
  process.exit(1);
}

console.log('\nZurueckspielen (auch in eine andere Datenbank):');
console.log('  node --env-file=.env.local tools/welt-einspielen.mjs ' + ziel);
