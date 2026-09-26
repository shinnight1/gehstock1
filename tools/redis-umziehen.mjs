/* ------------------------------------------------------------------
   Kopiert die Spielerwelt von Upstash in das Redis auf dem Handy.

   Upstash wird nur gelesen. Das Ziel wird vorher geleert und danach
   Schluessel fuer Schluessel mit der Quelle verglichen (SHA1 des Inhalts).
   Stimmt ein einziger Wert nicht, endet das Skript mit Fehler.

   Aufruf (Termux):
     node tools/redis-umziehen.mjs

   Quelle:  ~/.config/gehstock1/upstash.env  (von handy-redis-einrichten.sh)
   Ziel:    ~/.config/gehstock1/redis.env

   Laeuft das Handy schon auf dem lokalen Redis (Datei redis-live), ist
   das lokale Redis die Wahrheit - dann bricht das Skript ab, statt sie
   mit einem aelteren Upstash-Stand zu ueberschreiben.
   ------------------------------------------------------------------ */

import os from 'node:os';
import path from 'node:path';
import { access, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Redis } from '@upstash/redis';
import { parseEnv } from 'node:util';
import { verbindung, adresseLesen, lokaleAdresse } from '../netlify/functions/lib/redis-lokal.mjs';
import { zugangLesen } from './handy-zugang.mjs';

const dir = path.join(os.homedir(), '.config', 'gehstock1');
const sha1 = (t) => createHash('sha1').update(t).digest('hex');

async function zaeh(was) {
  for (let i = 0; ; i++) {
    try { return await was(); }
    catch (e) { if (i >= 8) throw e; await new Promise((ok) => setTimeout(ok, 400 * 1.5 ** i)); }
  }
}
async function lokal(v, args) {
  const a = await v.befehl(args);
  if (a instanceof Error) throw a;
  return a;
}
const paare = (roh) => (Array.isArray(roh)
  ? Array.from({ length: roh.length / 2 }, (_, i) => [String(roh[2 * i]), String(roh[2 * i + 1])])
  : Object.entries(roh || {}).map(([f, w]) => [f, typeof w === 'string' ? w : JSON.stringify(w)]));
const hashStempel = (p) => sha1(JSON.stringify([...p].sort((a, b) => (a[0] < b[0] ? -1 : 1))));

try {
  if (await access(path.join(dir, 'redis-live')).then(() => true, () => false)) {
    console.log('Abbruch: Das Handy laeuft schon auf dem lokalen Redis. Upstash ist nicht mehr die Wahrheit.');
    process.exit(1);
  }
  const quelle = await zugangLesen(path.join(dir, 'upstash.env'));
  const ziel = lokaleAdresse(parseEnv(await readFile(path.join(dir, 'redis.env'), 'utf8')));
  if (!ziel) throw new Error('redis.env unvollstaendig');
  const up = new Redis({ url: quelle.url, token: quelle.token, automaticDeserialization: false });
  const v = verbindung(adresseLesen(ziel));

  console.log('Lese Schluesselliste aus Upstash ...');
  let cursor = '0'; const keys = [];
  do {
    const [next, gefunden] = await zaeh(() => up.scan(cursor, { match: 'hgh:*', count: 500 }));
    cursor = String(next); keys.push(...gefunden);
  } while (cursor !== '0');
  const eindeutig = [...new Set(keys)].sort();
  if (!eindeutig.includes('hgh:hgh-rooms:verwaltung') || !eindeutig.includes('hgh:hgh-gehstockmon:world-v2')) {
    throw new Error('Verwaltung oder GehstockMon-Welt fehlen in Upstash - nichts kopiert.');
  }

  /* Erst alles lesen, dann schreiben: Faellt Upstash mittendrin aus,
     bleibt das lokale Redis unberuehrt. */
  const inhalt = [];
  for (const key of eindeutig) {
    const typ = String(await zaeh(() => up.type(key)));
    const pttl = Number(await zaeh(() => up.pttl(key)));
    if (typ === 'string') {
      const w = await zaeh(() => up.get(key));
      if (w === null) continue; // eben abgelaufen
      inhalt.push({ key, typ, wert: typeof w === 'string' ? w : JSON.stringify(w), pttl });
    } else if (typ === 'hash') {
      inhalt.push({ key, typ, felder: paare(await zaeh(() => up.hgetall(key))), pttl });
    } else if (typ !== 'none') {
      throw new Error('Unerwarteter Typ ' + typ + ' bei ' + key + ' - nichts kopiert.');
    }
  }
  console.log(inhalt.length + ' Schluessel gelesen. Schreibe ins lokale Redis ...');

  await lokal(v, ['FLUSHDB']);
  let bytes = 0;
  for (const e of inhalt) {
    if (e.typ === 'string') { await lokal(v, ['SET', e.key, e.wert]); bytes += Buffer.byteLength(e.wert); }
    else if (e.felder.length) await lokal(v, ['HSET', e.key, ...e.felder.flat()]);
    if (e.pttl > 0) await lokal(v, ['PEXPIRE', e.key, String(e.pttl)]);
  }

  let falsch = 0;
  for (const e of inhalt) {
    if (e.typ === 'string') {
      const w = await lokal(v, ['GET', e.key]);
      if (!w || sha1(w.toString('utf8')) !== sha1(e.wert)) { falsch++; console.log('  ABWEICHUNG: ' + e.key); }
    } else if (e.felder.length) {
      const w = paare((await lokal(v, ['HGETALL', e.key])).map(String));
      if (hashStempel(w) !== hashStempel(e.felder)) { falsch++; console.log('  ABWEICHUNG: ' + e.key); }
    }
  }
  const verwaltung = JSON.parse((await lokal(v, ['GET', 'hgh:hgh-rooms:verwaltung'])).toString('utf8'));
  const welt = JSON.parse((await lokal(v, ['GET', 'hgh:hgh-gehstockmon:world-v2'])).toString('utf8'));
  v.schliessen();

  console.log((bytes / 1024 / 1024).toFixed(2) + ' MB kopiert.');
  console.log('Lokal: ' + (verwaltung?.daten?.profile?.length || 0) + ' Profile, '
    + Object.keys(welt?.players || {}).length + ' GehstockMon-Spieler.');
  if (falsch) { console.log(falsch + ' Schluessel weichen ab. Umzug NICHT verwenden.'); process.exit(1); }
  console.log('Alle ' + inhalt.length + ' Schluessel stimmen mit Upstash ueberein.');
} catch (e) {
  console.log('Umzug gestoppt: ' + String(e && e.message || e).split('\n')[0].replace(/Bearer \S+/g, 'Bearer ***'));
  console.log('Upstash wurde nur gelesen und ist unveraendert.');
  process.exit(1);
}
