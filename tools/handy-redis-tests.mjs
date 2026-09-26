/* Prueft den direkten Redis-Zugang, Umzug und Sicherung ohne echtes Redis:
   Ein nachgebauter redis-server spricht das echte Protokoll.
   Aufruf: node --test tools/handy-redis-tests.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Redis } from '@upstash/redis';
import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { kodieren, lesen, verbindung, lokalerClient, speicherClient } from '../netlify/functions/lib/redis-lokal.mjs';
import { zugangPruefen, weltPruefenMit } from './handy-zugang.mjs';

/* ------------------------------------------------ nachgebautes Upstash
   Upstash-REST vor einem (nachgebauten) redis-server - so, wie der
   @upstash/redis-Client es erwartet. Dient als Quelle beim Umzug und als
   Ablage fuer die Sicherung ausser Haus. */
/* Nur was das Projekt braucht. Alles andere - FLUSHALL, CONFIG, KEYS,
   SHUTDOWN - bleibt aussen vor, auch wenn jemand an den Token kommt. */
const ERLAUBT = new Set(['GET', 'SET', 'DEL', 'MGET', 'EXISTS', 'TYPE', 'STRLEN', 'SCAN',
  'HGET', 'HGETALL', 'HSET', 'HDEL', 'HLEN', 'EVAL', 'EVALSHA',
  'TTL', 'PTTL', 'EXPIRE', 'PEXPIRE', 'PING', 'DBSIZE']);

function ausgeben(wert, base64) {
  if (wert === null || typeof wert === 'number') return wert;
  if (Buffer.isBuffer(wert)) return base64 ? wert.toString('base64') : wert.toString('utf8');
  if (Array.isArray(wert)) return wert.map((v) => ausgeben(v, base64));
  if (typeof wert === 'string') return base64 && wert !== 'OK' ? Buffer.from(wert).toString('base64') : wert;
  return wert;
}

function pruefen(befehl) {
  if (!Array.isArray(befehl) || !befehl.length) return 'ERR Befehl fehlt';
  const name = String(befehl[0]).toUpperCase();
  if (!ERLAUBT.has(name)) return 'ERR Befehl nicht erlaubt: ' + name;
  return null;
}

const antwort = (wert, base64) => (wert instanceof Error ? { error: wert.message } : { result: ausgeben(wert, base64) });
const alsText = (befehl) => befehl.map((a) => (typeof a === 'string' ? a : JSON.stringify(a)));

function gatewayErstellen({ token, redis, neueVerbindung, bodyLimit = 16 * 1024 * 1024 }) {
  const soll = Buffer.from('Bearer ' + token);
  const berechtigt = (kopf) => {
    const ist = Buffer.from(String(kopf || ''));
    return ist.length === soll.length && timingSafeEqual(ist, soll);
  };

  return http.createServer(async (req, res) => {
    const senden = (status, daten) => {
      res.writeHead(status, { 'Content-Type': 'application/json', 'upstash-sync-token': '' });
      res.end(JSON.stringify(daten));
    };
    if (req.method !== 'POST') return senden(405, { error: 'Nur POST' });
    if (!berechtigt(req.headers.authorization)) return senden(401, { error: 'Unauthorized' });
    const base64 = String(req.headers['upstash-encoding'] || '').toLowerCase() === 'base64';

    const teile = []; let bytes = 0;
    for await (const t of req) {
      bytes += t.length;
      if (bytes > bodyLimit) return senden(413, { error: 'Anfrage zu gross' });
      teile.push(t);
    }
    let body;
    try { body = JSON.parse(Buffer.concat(teile).toString('utf8')); }
    catch { return senden(400, { error: 'Kein JSON' }); }

    const pfad = new URL(req.url, 'http://x').pathname.replace(/\/+$/, '') || '/';
    if (pfad === '/') {
      const f = pruefen(body);
      if (f) return senden(400, { error: f });
      const a = antwort(await redis.befehl(alsText(body)), base64);
      return senden(a.error ? 400 : 200, a);
    }
    if (pfad === '/pipeline' || pfad === '/multi-exec') {
      if (!Array.isArray(body)) return senden(400, { error: 'Liste erwartet' });
      const fehler = body.map(pruefen).find(Boolean);
      if (fehler) return senden(400, { error: fehler });
      if (pfad === '/pipeline') {
        const ergebnisse = await Promise.all(body.map((b) => redis.befehl(alsText(b))));
        return senden(200, ergebnisse.map((e) => antwort(e, base64)));
      }
      /* MULTI/EXEC braucht eine eigene Leitung, sonst mischten sich
         gleichzeitige Anfragen in die Transaktion. */
      const v = neueVerbindung();
      try {
        await v.befehl(['MULTI']);
        for (const b of body) await v.befehl(alsText(b));
        const exec = await v.befehl(['EXEC']);
        if (exec instanceof Error || !Array.isArray(exec)) return senden(400, { error: exec?.message || 'EXEC abgebrochen' });
        return senden(200, exec.map((e) => antwort(e, base64)));
      } finally { v.schliessen(); }
    }
    senden(404, { error: 'Unbekannter Pfad' });
  });
}


import { _redisStore, _stempelVon } from '../netlify/functions/lib/speicher.mjs';

/* ------------------------------------------------ nachgebauter redis-server */
function antwortKodieren(w) {
  if (w === null) return '$-1\r\n';
  if (w instanceof Error) return '-' + w.message + '\r\n';
  if (typeof w === 'number') return ':' + w + '\r\n';
  if (w && w.einfach) return '+' + w.einfach + '\r\n';
  if (Array.isArray(w)) return '*' + w.length + '\r\n' + w.map(antwortKodieren).join('');
  return '$' + Buffer.byteLength(String(w)) + '\r\n' + w + '\r\n';
}
function fakeRedis(passwort) {
  const daten = new Map();
  const sha1 = (t) => createHash('sha1').update(t).digest('hex');
  function ausfuehren(b, sitzung) {
    const name = b[0].toUpperCase();
    if (name === 'AUTH') { sitzung.ok = b[1] === passwort; return sitzung.ok ? { einfach: 'OK' } : new Error('WRONGPASS'); }
    if (passwort && !sitzung.ok) return new Error('NOAUTH Authentication required.');
    const w = daten.get(b[1]);
    switch (name) {
      case 'PING': return { einfach: 'PONG' };
      case 'GET': return w instanceof Map ? new Error('WRONGTYPE') : (w ?? null);
      case 'SET': daten.set(b[1], b[2]); return { einfach: 'OK' };
      case 'DEL': return b.slice(1).filter((k) => daten.delete(k)).length;
      case 'TYPE': return { einfach: w instanceof Map ? 'hash' : w === undefined ? 'none' : 'string' };
      case 'SCAN': {
        const muster = b[b.indexOf('match') >= 0 ? b.indexOf('match') + 1 : b.indexOf('MATCH') + 1] || '*';
        const re = new RegExp('^' + muster.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
        return ['0', [...daten.keys()].filter((k) => re.test(k))];
      }
      case 'HGETALL': return w instanceof Map ? [...w].flat() : [];
      case 'HSET': { const h = w instanceof Map ? w : new Map(); for (let i = 2; i + 1 < b.length; i += 2) h.set(b[i], b[i + 1]); daten.set(b[1], h); return 1; }
      case 'HDEL': return b.slice(2).filter((f) => w instanceof Map && w.delete(f)).length;
      case 'EVAL': {
        const key = b[3], neu = b[4], bedingung = b[5];
        const aktuell = daten.has(key) ? daten.get(key) : null;
        const passt = bedingung === '@neu' ? aktuell === null : aktuell !== null && sha1(aktuell) === bedingung;
        if (!passt) return 0;
        daten.set(key, neu); return 1;
      }
      case 'PTTL': return w === undefined ? -2 : -1;
      case 'PEXPIRE': return w === undefined ? 0 : 1;
      case 'FLUSHDB': daten.clear(); return { einfach: 'OK' };
      case 'MULTI': sitzung.multi = []; return { einfach: 'OK' };
      default: return new Error('ERR unknown command ' + name);
    }
  }
  const socks = new Set();
  const server = net.createServer((sock) => {
    socks.add(sock); sock.on('close', () => socks.delete(sock));
    const sitzung = {}; let puffer = Buffer.alloc(0);
    sock.on('data', (t) => {
      puffer = Buffer.concat([puffer, t]);
      for (;;) {
        const r = lesen(puffer);
        if (!r) break;
        puffer = puffer.subarray(r[1]);
        const b = r[0].map((x) => x.toString('utf8'));
        let aus;
        if (sitzung.multi && b[0].toUpperCase() === 'EXEC') { aus = sitzung.multi.map((c) => ausfuehren(c, sitzung)); sitzung.multi = null; }
        else if (sitzung.multi && b[0].toUpperCase() !== 'MULTI') { sitzung.multi.push(b); aus = { einfach: 'QUEUED' }; }
        else aus = ausfuehren(b, sitzung);
        sock.write(antwortKodieren(aus));
      }
    });
    sock.on('error', () => {});
  });
  return { server, daten, socks };
}

async function aufbauen() {
  const { server: rs, daten, socks } = fakeRedis('geheim');
  await new Promise((ok) => rs.listen(0, '127.0.0.1', ok));
  const port = rs.address().port;
  const neu = () => verbindung({ port, passwort: 'geheim' });
  const token = 'x'.repeat(40);
  const haupt = neu();
  const gw = gatewayErstellen({ token, redis: haupt, neueVerbindung: neu });
  await new Promise((ok) => gw.listen(0, '127.0.0.1', ok));
  const url = 'http://127.0.0.1:' + gw.address().port;
  const client = new Redis({ url, token, automaticDeserialization: false });
  const direkt = lokalerClient('redis://:geheim@127.0.0.1:' + port);
  return { daten, url, token, client, direkt, zu: () => { gw.close(); gw.closeAllConnections(); haupt.schliessen(); direkt.schliessen(); for (const s of socks) s.destroy(); rs.close(); } };
}

test('RESP: kodieren und stueckweise lesen', () => {
  assert.equal(kodieren(['SET', 'k', 'ä']).toString(), '*3\r\n$3\r\nSET\r\n$1\r\nk\r\n$2\r\nä\r\n');
  const roh = Buffer.from('*3\r\n$5\r\nhallo\r\n:42\r\n*2\r\n$-1\r\n+OK\r\n');
  for (let i = 0; i < roh.length; i++) assert.equal(lesen(roh.subarray(0, i)), null);
  const [wert, ende] = lesen(roh);
  assert.equal(ende, roh.length);
  assert.equal(wert[0].toString(), 'hallo');
  assert.equal(wert[1], 42);
  assert.deepEqual(wert[2], [null, 'OK']);
  assert.ok(lesen(Buffer.from('-ERR kaputt\r\n'))[0] instanceof Error);
});

async function speicherPruefen(client) {
  const store = _redisStore('hgh-test', client);
  const welt = { spieler: { a: { gold: 5, name: 'Größe ✓' } } };
  assert.equal((await store.setJSON('welt', welt, { onlyIfNew: true })).modified, true);
  assert.equal((await store.setJSON('welt', welt, { onlyIfNew: true })).modified, false);
  const gelesen = await store.getWithMetadata('welt');
  assert.deepEqual(gelesen.data, welt);
  assert.equal(gelesen.etag, _stempelVon(JSON.stringify(welt)));
  const neu = { ...welt, runde: 2 };
  assert.equal((await store.setJSON('welt', neu, { onlyIfMatch: gelesen.etag })).modified, true);
  assert.equal((await store.setJSON('welt', welt, { onlyIfMatch: gelesen.etag })).modified, false);
  assert.deepEqual(await store.get('welt'), neu);
  await store.feldSetzen('anwesenheit-v2', 'p1', { x: 1 });
  await store.feldSetzen('anwesenheit-v2', 'p2', { x: 2 });
  await store.felderWeg('anwesenheit-v2', ['p1']);
  assert.deepEqual(await store.felder('anwesenheit-v2'), { p2: { x: 2 } });
  assert.deepEqual((await store.list()).blobs.map((b) => b.key).sort(), ['anwesenheit-v2', 'welt']);
  await store.delete('welt');
  assert.equal(await store.get('welt'), null);
}

test('Speicherschicht direkt auf Redis: Stempel, Bedingung, Felder, Liste', async () => {
  const u = await aufbauen();
  try { await speicherPruefen(u.direkt); } finally { u.zu(); }
});

test('Speicherschicht ueber Upstash verhaelt sich genauso (Rueckfallweg)', async () => {
  const u = await aufbauen();
  try { await speicherPruefen(u.client); } finally { u.zu(); }
});

test('Speicherschicht im Arbeitsspeicher verhaelt sich genauso (Entwicklung)', async () => {
  await speicherPruefen(speicherClient());
});

test('Weltpruefung und Verbindungsabbruch', async () => {
  const u = await aufbauen();
  try {
    u.daten.set('hgh:hgh-rooms:verwaltung', JSON.stringify({ daten: { profile: [{}, {}] } }));
    await assert.rejects(weltPruefenMit(u.direkt));
    u.daten.set('hgh:hgh-gehstockmon:world-v2', JSON.stringify({ players: { a: {}, b: {}, c: {} } }));
    assert.deepEqual(await weltPruefenMit(u.direkt), { profile: 2, spieler: 3 });
    await assert.rejects(u.direkt.befehl(['NICHTDA']), /unknown command/);
  } finally { u.zu(); }
  const weg = lokalerClient('redis://:x@127.0.0.1:1');
  await assert.rejects(weg.get('a'), /Verbindung/);
});

test('Zugangsdatei: nur Upstash oder 127.0.0.1 mit Port', () => {
  const token = 'test-only-token-1234567890';
  assert.deepEqual(zugangPruefen('http://127.0.0.1:8079', token), { url: 'http://127.0.0.1:8079', token });
  for (const url of ['http://127.0.0.1', 'http://localhost:8079', 'http://192.168.2.172:8079',
    'https://example.upstash.io:8443', 'http://127.0.0.1:8079/pfad']) {
    assert.throws(() => zugangPruefen(url, token), undefined, url);
  }
});

test('Umzug kopiert Texte und Hashes vollstaendig und bricht nach dem Umschalten ab', async () => {
  const quelle = await aufbauen();
  const { server: ziel, daten: zielDaten, socks } = fakeRedis('zielpass');
  await new Promise((ok) => ziel.listen(0, '127.0.0.1', ok));
  const home = await mkdtemp(path.join(os.tmpdir(), 'umzug-'));
  const dir = path.join(home, '.config', 'gehstock1');
  try {
    quelle.daten.set('hgh:hgh-rooms:verwaltung', JSON.stringify({ daten: { profile: [{ n: 'Jörg' }] } }));
    quelle.daten.set('hgh:hgh-gehstockmon:world-v2', JSON.stringify({ players: { a: { gold: 1 } } }));
    quelle.daten.set('hgh:hgh-gehstockmon-presence:anwesenheit-v2', new Map([['a', '{"x":1}'], ['b', '{"x":2}']]));
    quelle.daten.set('fremd:schluessel', 'bleibt draussen');
    zielDaten.set('alt', 'wird geleert');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'upstash.env'), 'UPSTASH_REDIS_REST_URL="' + quelle.url + '"\nUPSTASH_REDIS_REST_TOKEN="' + quelle.token + '"\n');
    await writeFile(path.join(dir, 'redis.env'), 'REDIS_PASS=zielpass\nGATEWAY_TOKEN=' + 'z'.repeat(40) + '\nREDIS_PORT=' + ziel.address().port + '\n');
    const lauf = () => new Promise((ok) => {
      const p = spawn(process.execPath, ['tools/redis-umziehen.mjs'], { env: { ...process.env, HOME: home, USERPROFILE: home } });
      let aus = ''; p.stdout.on('data', (t) => { aus += t; }); p.stderr.on('data', (t) => { aus += t; });
      p.on('close', (code) => ok({ code, aus }));
    });
    const erst = await lauf();
    assert.equal(erst.code, 0, erst.aus);
    assert.match(erst.aus, /Alle 3 Schluessel stimmen/);
    assert.match(erst.aus, /1 Profile, 1 GehstockMon-Spieler/);
    assert.equal(zielDaten.has('alt'), false);
    assert.equal(zielDaten.has('fremd:schluessel'), false);
    assert.deepEqual([...zielDaten.get('hgh:hgh-gehstockmon-presence:anwesenheit-v2')], [['a', '{"x":1}'], ['b', '{"x":2}']]);
    assert.equal(zielDaten.get('hgh:hgh-rooms:verwaltung'), quelle.daten.get('hgh:hgh-rooms:verwaltung'));

    await writeFile(path.join(dir, 'redis-live'), '');
    zielDaten.set('hgh:hgh-gehstockmon:world-v2', 'lokal ist jetzt die Wahrheit');
    const danach = await lauf();
    assert.equal(danach.code, 1);
    assert.equal(zielDaten.get('hgh:hgh-gehstockmon:world-v2'), 'lokal ist jetzt die Wahrheit');
  } finally {
    quelle.zu(); for (const s of socks) s.destroy(); ziel.close();
    await rm(home, { recursive: true, force: true });
  }
});

test('Sicherung ausser Haus: ablegen und unveraendert zurueckholen', async () => {
  const lager = await aufbauen();
  const home = await mkdtemp(path.join(os.tmpdir(), 'auslagern-'));
  const dir = path.join(home, '.config', 'gehstock1');
  const sich = path.join(dir, 'sicherungen', 'taeglich', 'backup', '2026-09-26-18-00', 'hgh-rooms');
  try {
    await mkdir(sich, { recursive: true });
    const text = JSON.stringify({ daten: { profile: [{ n: 'Ärger' }] } });
    await writeFile(path.join(sich, 'kanal_kreis.json'), text);
    await writeFile(path.join(sich, '_schluessel.json'), JSON.stringify([{ key: 'kanal:kreis', datei: 'kanal_kreis.json', bytes: 1 }]));
    await writeFile(path.join(dir, 'upstash.env'), 'UPSTASH_REDIS_REST_URL="' + lager.url + '"\nUPSTASH_REDIS_REST_TOKEN="' + lager.token + '"\n');
    const lauf = (...args) => new Promise((ok) => {
      const p = spawn(process.execPath, [path.resolve('tools/handy-auslagern.mjs'), ...args], { cwd: home, env: { ...process.env, HOME: home, USERPROFILE: home } });
      let aus = ''; p.stdout.on('data', (t) => { aus += t; }); p.stderr.on('data', (t) => { aus += t; });
      p.on('close', (code) => ok({ code, aus }));
    });
    const ab = await lauf();
    assert.equal(ab.code, 0, ab.aus);
    assert.equal([...lager.daten.keys()].filter((k) => k.startsWith('sicherung:handy:')).length, 1);
    const zurueck = await lauf('--holen');
    assert.equal(zurueck.code, 0, zurueck.aus);
    const ordner = zurueck.aus.match(/nach (\S+)/)[1];
    const verzeichnis = JSON.parse(await readFile(path.join(home, ordner, 'hgh-rooms', '_schluessel.json'), 'utf8'));
    assert.equal(verzeichnis[0].key, 'kanal:kreis');
    assert.equal(await readFile(path.join(home, ordner, 'hgh-rooms', verzeichnis[0].datei), 'utf8'), text);
  } finally { lager.zu(); await rm(home, { recursive: true, force: true }); }
});
