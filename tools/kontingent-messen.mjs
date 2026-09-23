/* ------------------------------------------------------------------
   Was kostet eine Schulklasse? Gemessen mit dem echten Servercode.

   Hintergrund: Im September 2026 waren die Gratiskontingente von Upstash
   (500 000 Befehle im Monat) und Netlify (300 Credits) nach zwei bis vier
   Stunden Unterricht leer. Dieses Werkzeug laesst die echten Funktionen
   (netlify/functions/room.mjs und gehstockmon.mjs) gegen ein nachgebautes
   Upstash laufen, das jeden Befehl zaehlt, und spielt dazu Kinder nach,
   die sich verhalten wie der Browser: Hideout offen, GehstockMon mit
   Laufen und Stehen, dazu etwas Chat.

   Aufruf:
     node tools/kontingent-messen.mjs <fenster|spieler|beides> <kinder> <sekunden>

   Stellschrauben (Umgebung):
     LATENZ=30     ms je Datenbankbefehl (Netz zwischen Funktion und Upstash)
     CHAT=2        Chatnachrichten je Minute in der ganzen Klasse
     STAFFEL=10000 die Fenster oeffnen sich verteilt ueber so viele ms

   Gemessen Ende September 2026, 20 Kinder, 30 ms, jeweils je Kind:
                                vorher              nachher
     Hideout-Fenster (ruhig)    67 Befehle/min      5,6 Befehle/min
                                58 s Laufzeit/min   0,2 s Laufzeit/min
     GehstockMon-Spieler        88 Befehle/min      23,5 Befehle/min
     beides, Chat laeuft        166 Befehle/min     41 Befehle/min

   Das Werkzeug schreibt nichts ausser in seinen eigenen Speicher und
   braucht keine Zugangsdaten.
   ------------------------------------------------------------------ */

import http from 'node:http';
import { createHash } from 'node:crypto';

const LATENZ = Number(process.env.LATENZ ?? 30);
const CHAT = Number(process.env.CHAT ?? 2);
const STAFFEL = Number(process.env.STAFFEL ?? 10000);
const szenario = process.argv[2] || 'beides';
const n = Number(process.argv[3] || 10);
const dauer = Number(process.argv[4] || 120) * 1000;
if (!['fenster', 'spieler', 'beides'].includes(szenario) || !(n > 0) || !(dauer > 0)) {
  console.error('Aufruf: node tools/kontingent-messen.mjs <fenster|spieler|beides> <kinder> <sekunden>');
  process.exit(1);
}

/* ------------------------------------------------ nachgebautes Upstash */

const daten = new Map();
const zaehl = { gesamt: 0, je: {}, gelesen: 0, geschrieben: 0, konflikte: 0 };
const sha1 = (t) => createHash('sha1').update(t).digest('hex');
function befehl(b) {
  const name = String(b[0] || '').toUpperCase();
  zaehl.gesamt++; zaehl.je[name] = (zaehl.je[name] || 0) + 1;
  const wert = daten.get(b[1]);
  switch (name) {
    case 'GET':
      if (wert instanceof Map) throw new Error('WRONGTYPE Operation against a key holding the wrong kind of value');
      if (wert) zaehl.gelesen += wert.length;
      return wert ?? null;
    case 'SET': zaehl.geschrieben += String(b[2]).length; daten.set(b[1], String(b[2])); return 'OK';
    case 'DEL': return b.slice(1).filter((k) => daten.delete(k)).length;
    case 'SCAN': return ['0', [...daten.keys()]];
    case 'HGETALL': {
      if (!(wert instanceof Map)) return [];
      const aus = [];
      for (const [f, v] of wert) { aus.push(f, v); zaehl.gelesen += v.length; }
      return aus;
    }
    case 'HSET': {
      const h = wert instanceof Map ? wert : new Map();
      for (let i = 2; i + 1 < b.length; i += 2) { h.set(String(b[i]), String(b[i + 1])); zaehl.geschrieben += String(b[i + 1]).length; }
      daten.set(b[1], h);
      return 1;
    }
    case 'HDEL': return b.slice(2).filter((f) => wert instanceof Map && wert.delete(f)).length;
    case 'EVAL': {
      /* Das CAS-Skript aus lib/speicher.mjs, nachvollzogen. */
      const key = b[3], neu = String(b[4]), bedingung = b[5];
      const aktuell = daten.has(key) ? daten.get(key) : null;
      const passt = bedingung === '@neu' ? aktuell === null : aktuell !== null && sha1(aktuell) === bedingung;
      if (!passt) { zaehl.konflikte++; return 0; }
      zaehl.geschrieben += neu.length; daten.set(key, neu); return 1;
    }
    default: throw new Error('unbekannter Befehl ' + name);
  }
}
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (d) => { body += d; });
  req.on('end', () => setTimeout(() => {
    /* Wie Upstash: Texte kommen auf Wunsch base64-kodiert zurueck. */
    const b64 = String(req.headers['upstash-encoding'] || '').toLowerCase() === 'base64';
    const kod = (v) => (!b64 ? v : typeof v === 'string' ? (v === 'OK' ? v : Buffer.from(v).toString('base64')) : Array.isArray(v) ? v.map(kod) : v);
    let antwort;
    try {
      const roh = JSON.parse(body || '[]');
      antwort = Array.isArray(roh[0]) ? roh.map((c) => ({ result: kod(befehl(c)) })) : { result: kod(befehl(roh)) };
    } catch (e) { antwort = { error: e.message }; res.statusCode = 400; }
    setTimeout(() => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(antwort)); }, LATENZ / 2);
  }, LATENZ / 2));
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
process.env.UPSTASH_REDIS_REST_URL = 'http://127.0.0.1:' + server.address().port;
process.env.UPSTASH_REDIS_REST_TOKEN = 'nur-zum-messen';
delete process.env.KV_REST_API_URL; delete process.env.KV_REST_API_TOKEN;

const room = (await import('../netlify/functions/room.mjs')).default;
const { createHandler } = await import('../netlify/functions/gehstockmon.mjs');

/* Eine Stunde, in der GehstockMon geoeffnet hat. */
const OFFEN = Date.parse('2026-09-23T10:00:00+02:00'), START = Date.now();
const gm = createHandler({ now: () => OFFEN + (Date.now() - START) });

/* Gueltige Codes wie in src/core/auth.js */
const CODES = [];
for (let z = 0; z < 10000 && CODES.length < n; z++) {
  const c = String(z).padStart(4, '0'), t = 'code:' + c + ':gehstock:hideout:2026:kellergewoelbe';
  let h = 0x811c9dc5;
  for (const ch of t) { h ^= ch.charCodeAt(0); h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0; }
  if (h % 97 === 0) CODES.push(c);
}
if (CODES.length < n) { console.error('Hoechstens ' + CODES.length + ' Kinder.'); process.exit(1); }

const schlaf = (ms) => new Promise((ok) => setTimeout(ok, ms));
let anfragen = 0, laufzeit = 0, korrekturen = 0;
const fehler = {};
async function rufe(handler, pfad, body) {
  const t = Date.now(); anfragen++;
  const res = await handler(new Request('http://x' + pfad, { method: 'POST', body: JSON.stringify(body) }));
  const j = await res.json().catch(() => ({}));
  laufzeit += Date.now() - t;
  if (j && j.error) fehler[j.error] = (fehler[j.error] || 0) + 1;
  if (j && j.positionCorrected) korrekturen++;
  return j;
}

/* Ein Hideout-Fenster mit offenem Chatbrett, Takt wie src/core/relais.js. */
async function fenster(i, bis) {
  await schlaf(Math.random() * STAFFEL);
  const ich = { code: CODES[i], name: 'Kind' + i, rolle: 'S' };
  let since = 0, psince = 0, verw = 0, kv = 0, ruhe = 2000;
  while (Date.now() < bis) {
    const r = await rufe(room, '/api/room', { op: 'sync', kurz: true, geraet: 'g' + i, art: 'iPad', ich, wo: '#/', since, psince, befehl: 0, kanaele: { kreis: kv }, verw });
    since = Math.max(since, r.version || 0); psince = Math.max(psince, r.pv || 0);
    if (r.verw && r.verw.version) verw = r.verw.version;
    if (r.kanaele && r.kanaele.kreis) kv = r.kanaele.kreis.version;
    ruhe = r.kanaele || r.verw || r.befehle ? 2000 : Math.min(15000, Math.round(ruhe * 1.5));
    await schlaf(Math.min(ruhe, Math.max(0, bis - Date.now())));
  }
}

/* Ein Kind in GehstockMon: 20 s laufen, 30 s stehen, Takt wie 3-ui.js. */
const beigetreten = {};
async function spieler(i, bis) {
  const code = CODES[i], start = beigetreten[i].spawn;
  let x = start.x, richtung = 1, letzteWelt = Date.now(), letzteMeldung = 0, gemeldet = x;
  while (Date.now() < bis) {
    const laeuft = (Math.floor((Date.now() - START) / 1000) + i * 7) % 50 < 20;
    if (laeuft) { x += richtung * 5.5; if (Math.abs(x - start.x) > 12) richtung = -richtung; }
    const takt = Math.abs(x - gemeldet) > 0.3 ? 3000 : (n > 1 ? 5000 : 8000);
    if (Date.now() - letzteMeldung >= takt) {
      letzteMeldung = Date.now();
      const r = await rufe(gm, '/api/gehstockmon', { op: 'presence', code, position: { x, z: start.z, heading: richtung > 0 ? 1.57 : -1.57 } });
      if (r.positionCorrected && r.position) x = r.position.x;
      gemeldet = x;
    }
    if (Date.now() - letzteWelt > 30000) { letzteWelt = Date.now(); await rufe(gm, '/api/gehstockmon', { op: 'world', code }); }
    await schlaf(500);
  }
}

async function plaudern(bis) {
  while (CHAT > 0 && Date.now() < bis) {
    await schlaf(60000 / CHAT);
    if (Date.now() >= bis) break;
    const k = Math.floor(Math.random() * n);
    await rufe(room, '/api/room', { op: 'chat:post', brett: 'kreis', text: 'hallo', von: 'Kind' + k, code: CODES[k], rolle: 'S' });
  }
}

/* Beitreten vorab und nacheinander - gemessen wird der laufende Betrieb. */
if (szenario !== 'fenster') {
  for (let i = 0; i < n; i++) {
    for (let v = 0; v < 5 && !beigetreten[i]; v++) {
      const j = await rufe(gm, '/api/gehstockmon', { op: 'join', code: CODES[i], name: 'Kind' + i });
      if (j.spawn) beigetreten[i] = j;
    }
    if (!beigetreten[i]) { console.error('Beitritt fehlgeschlagen: ' + JSON.stringify(fehler)); process.exit(1); }
  }
}
Object.assign(zaehl, { gesamt: 0, je: {}, gelesen: 0, geschrieben: 0, konflikte: 0 });
anfragen = 0; laufzeit = 0; korrekturen = 0; for (const k of Object.keys(fehler)) delete fehler[k];

const t0 = Date.now(), bis = t0 + dauer, jobs = [];
for (let i = 0; i < n; i++) {
  if (szenario !== 'spieler') jobs.push(fenster(i, bis));
  if (szenario !== 'fenster') jobs.push(spieler(i, bis));
}
if (szenario !== 'spieler') jobs.push(plaudern(bis));
await Promise.all(jobs);

const min = (Date.now() - t0) / 60000;
const jeKind = (x) => x / n / min;
const befehleStunde = jeKind(zaehl.gesamt) * 60;
const credits = 30 * 60 * (jeKind(anfragen) * 2 / 10000 + jeKind(laufzeit) / 1000 / 3600 * 10);
console.log(szenario + ', ' + n + ' Kinder, ' + (min * 60).toFixed(0) + ' s, Latenz ' + LATENZ + ' ms, Chat ' + CHAT + '/min - je Kind:');
console.log('  Anfragen            ' + jeKind(anfragen).toFixed(1) + ' pro Minute');
console.log('  Funktionslaufzeit   ' + (jeKind(laufzeit) / 1000).toFixed(2) + ' s pro Minute');
console.log('  Datenbankbefehle    ' + jeKind(zaehl.gesamt).toFixed(1) + ' pro Minute  ' + JSON.stringify(zaehl.je));
console.log('  Datenmenge          ' + (jeKind(zaehl.gelesen) / 1024).toFixed(0) + ' KB gelesen, ' + (jeKind(zaehl.geschrieben) / 1024).toFixed(0) + ' KB geschrieben pro Minute');
console.log('  Schreibkonflikte    ' + zaehl.konflikte + ', Positionskorrekturen ' + korrekturen);
if (Object.keys(fehler).length) console.log('  Fehlerantworten     ' + JSON.stringify(fehler));
console.log('Hochgerechnet auf 30 Kinder:');
console.log('  Upstash gratis (500 000 Befehle)   reicht fuer ' + (500000 / (befehleStunde * 30)).toFixed(1) + ' Stunden');
console.log('  Netlify gratis (300 Credits)       reicht fuer ' + (300 / credits).toFixed(1) + ' Stunden (1 GB Funktionsspeicher, ohne Deploys)');
server.close();
process.exit(0);
