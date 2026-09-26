/* ------------------------------------------------------------------
   Sichert die Spielerwelt aus Redis in einen Ordner.

   Gesichert wird alles, was niemand nachbauen kann:

       hgh-gehstockmon   world-v2      Spieler, Gold, Mons, Gebiete
       hgh-rooms         verwaltung    Profile, Rollen, Sperren
                         kanal:*       Chatbretter und Protokoll
                         wplace        die gemeinsame Pixelkarte
                         bild:*        hochgeladene Bilder

   Kurzlebiges bleibt draussen: room:* (20 Minuten), schirm:*,
   presence-v1 und anwesenheit-v2 (wer gerade wo auf der Insel steht).
   anwesenheit-v2 ist ein Hash, kein Text - ein GET darauf schluege fehl.

   Das Ergebnis laesst sich mit tools/welt-einspielen.mjs zurueckspielen -
   auch in eine andere Datenbank.

   Aufruf auf dem Handy (die naechtliche Sicherung macht das von selbst):
     node --env-file=$HOME/.config/gehstock1/redis.env tools/redis-sichern.mjs
   Mit einer Datei voller UPSTASH_-Werte sichert es stattdessen Upstash.

   Das Skript liest nur. Es veraendert nichts.
   ------------------------------------------------------------------ */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { datenbank } from './datenbank.mjs';

const STORES = ['hgh-gehstockmon', 'hgh-rooms', 'hgh-gehstockmon-presence'];
const FLUECHTIG = [/^room:/, /^schirm:/, /^presence-v1$/, /^anwesenheit-v2$/, /:v$/];

const r = await datenbank();
if (!r) {
  console.log('Die Zugangsdaten fehlen: --env-file=$HOME/.config/gehstock1/redis.env mitgeben.');
  process.exit(1);
}

/* Eine Datenbank am Kontingentende lehnt einen Teil der Befehle ab
   ("max requests limit exceeded"). Genau dann braucht man die Sicherung
   am dringendsten - sie darf am ersten Fehlschlag nicht aufgeben, sondern
   fragt mit wachsender Pause nach. */
async function zaeh(was, beschreibung, versuche = 12) {
  for (let i = 0; i < versuche; i++) {
    try { return await was(); }
    catch (e) {
      const letzte = i === versuche - 1;
      /* Bei einer Datenbank, die nur noch jeden dritten Befehl annimmt,
         ist Geduld die ganze Kunst: Zwoelf Versuche mit wachsender Pause
         holen einen Schluessel mit an Sicherheit grenzender
         Wahrscheinlichkeit herein. Die Sicherung darf dauern - sie ist
         das Einzige, was zwischen einem schlechten Tag und einem
         verlorenen Spielstand steht. */
      if (!letzte && i % 3 === 2) console.log('  weiter bei ' + beschreibung + ' (Versuch ' + (i + 2) + ')');
      if (letzte) console.log('  FEHLER bei ' + beschreibung + ': ' + String(e && e.message || e).split('\n')[0]);
      if (letzte) throw e;
      await new Promise((ok) => setTimeout(ok, Math.min(5000, 400 * Math.pow(1.5, i))));
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
r.schliessen();
console.log('Gesamt: ' + (bytes / 1024 / 1024).toFixed(2) + ' MB in ' + ziel);

if (fehlend.length) {
  console.log('\n!! UNVOLLSTAENDIG - ' + fehlend.length + ' Schluessel fehlen:');
  fehlend.forEach((v) => console.log('   ' + v));
  console.log('\nDiese Sicherung nicht als vollstaendig ansehen. Noch einmal laufen');
  console.log('lassen; bleibt es dabei, lehnt die Datenbank gerade Befehle ab');
  console.log('(Kontingent) - dann spaeter erneut versuchen.');
  process.exit(1);
}

/* Die Zieldatei nennt bewusst keinen festen Namen: Wer umzieht, hat den
   Zugang zur neuen Datenbank meist in einer eigenen Datei. Ein fester
   Vorschlag wie .env.local schriebe dann still in die falsche Datenbank. */
console.log('\nZurueckspielen (auch in eine andere Datenbank) - mit der Datei, in der');
console.log('der Zugang zur ZIEL-Datenbank steht:');
console.log('  node --env-file=<zugang-zur-zieldatenbank> tools/welt-einspielen.mjs ' + ziel);
