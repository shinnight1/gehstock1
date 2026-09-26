/* ------------------------------------------------------------------
   Sicherung ausser Haus: legt die neueste Tagessicherung des Handys
   gepackt bei Upstash ab und holt sie bei Bedarf zurueck.

   Upstash ist nach dem Umzug nicht mehr die Spielerwelt, aber ein
   guter Ort fuer eine Kopie: nicht auf dem Handy, und ein Tag kostet
   genau einen Befehl. Sieben Plaetze, einer je Wochentag, werden
   reihum ueberschrieben:  sicherung:handy:0 ... sicherung:handy:6

   Aufruf (Termux):
     node tools/handy-auslagern.mjs              neueste Sicherung ablegen
     node tools/handy-auslagern.mjs --holen      neueste Kopie zurueckholen

   --holen schreibt einen Ordner im Format von redis-sichern.mjs, der
   sich mit tools/welt-einspielen.mjs einspielen laesst.
   ------------------------------------------------------------------ */

import os from 'node:os';
import path from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { Redis } from '@upstash/redis';
import { zugangLesen } from './handy-zugang.mjs';

const dir = path.join(os.homedir(), '.config', 'gehstock1');
const holen = process.argv.includes('--holen');

try {
  const zugang = await zugangLesen(path.join(dir, 'upstash.env'));
  const up = new Redis({ url: zugang.url, token: zugang.token, automaticDeserialization: false });

  if (!holen) {
    const basis = path.join(dir, 'sicherungen', 'taeglich', 'backup');
    const neueste = (await readdir(basis)).sort().pop();
    if (!neueste) throw new Error('Noch keine Tagessicherung vorhanden.');
    const stores = {};
    for (const store of (await readdir(path.join(basis, neueste), { withFileTypes: true })).filter((d) => d.isDirectory())) {
      const verzeichnis = JSON.parse(await readFile(path.join(basis, neueste, store.name, '_schluessel.json'), 'utf8'));
      stores[store.name] = [];
      for (const e of verzeichnis) {
        stores[store.name].push({ key: e.key, text: await readFile(path.join(basis, neueste, store.name, e.datei), 'utf8') });
      }
    }
    const paket = gzipSync(JSON.stringify({ erstellt: new Date().toISOString(), sicherung: neueste, stores })).toString('base64');
    await up.set('sicherung:handy:' + new Date().getDay(), paket);
    console.log('Ausser Haus abgelegt: ' + neueste + ' (' + (paket.length / 1024).toFixed(0) + ' KB gepackt)');
  } else {
    const pakete = [];
    for (let tag = 0; tag < 7; tag++) {
      const roh = await up.get('sicherung:handy:' + tag);
      if (roh) pakete.push(JSON.parse(gunzipSync(Buffer.from(String(roh), 'base64')).toString('utf8')));
    }
    if (!pakete.length) throw new Error('Bei Upstash liegt keine Handy-Sicherung.');
    const neueste = pakete.sort((a, b) => (a.erstellt < b.erstellt ? 1 : -1))[0];
    const ziel = path.join('backup', 'von-upstash-' + neueste.erstellt.slice(0, 16).replace(/[:T]/g, '-'));
    for (const [store, eintraege] of Object.entries(neueste.stores)) {
      await mkdir(path.join(ziel, store), { recursive: true });
      const verzeichnis = eintraege.map((e) => ({ key: e.key, datei: e.key.replace(/[^a-zA-Z0-9._-]/g, '_') + '.json', bytes: Buffer.byteLength(e.text) }));
      for (let i = 0; i < eintraege.length; i++) await writeFile(path.join(ziel, store, verzeichnis[i].datei), eintraege[i].text);
      await writeFile(path.join(ziel, store, '_schluessel.json'), JSON.stringify(verzeichnis, null, 2));
    }
    console.log('Geholt: Sicherung vom ' + neueste.erstellt + ' nach ' + ziel);
    console.log('Einspielen: node --env-file=' + path.join(dir, 'server.env') + ' tools/welt-einspielen.mjs ' + ziel);
  }
} catch (e) {
  console.log('Sicherung ausser Haus fehlgeschlagen: ' + String(e && e.message || e).split('\n')[0].replace(/Bearer \S+/g, 'Bearer ***'));
  process.exit(1);
}
