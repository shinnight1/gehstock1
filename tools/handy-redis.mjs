/* ------------------------------------------------------------------
   Redis auf dem Handy, angesprochen wie Upstash.

   Der ganze Projektcode (lib/speicher.mjs, die Sicherungs- und
   Einspielwerkzeuge, der Handy-Server) spricht die REST-Schnittstelle
   von Upstash. Statt all das umzuschreiben, steht hier ein kleiner
   Uebersetzer davor: Er nimmt Upstash-Anfragen auf 127.0.0.1 an und
   reicht sie an den lokalen redis-server weiter. Fuer den Code aendert
   sich nur die Adresse in server.env.

   Nachgebaut wird, was @upstash/redis tatsaechlich schickt:
     POST /            ein Befehl        -> { result } oder { error }
     POST /pipeline    mehrere Befehle   -> [{ result } | { error }, ...]
     POST /multi-exec  mehrere, atomar
   Mit "Upstash-Encoding: base64" gehen Texte base64-kodiert zurueck,
   genau wie bei Upstash.

   Aufruf (startet tools/handy-dienste.sh):
     node tools/handy-redis.mjs [~/.config/gehstock1/redis.env]
   ------------------------------------------------------------------ */

import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { timingSafeEqual } from 'node:crypto';
import { parseEnv } from 'node:util';
import { pathToFileURL } from 'node:url';

/* Nur was das Projekt braucht. Alles andere - FLUSHALL, CONFIG, KEYS,
   SHUTDOWN - bleibt aussen vor, auch wenn jemand an den Token kommt. */
const ERLAUBT = new Set(['GET', 'SET', 'DEL', 'MGET', 'EXISTS', 'TYPE', 'STRLEN', 'SCAN',
  'HGET', 'HGETALL', 'HSET', 'HDEL', 'HLEN', 'EVAL', 'EVALSHA',
  'TTL', 'PTTL', 'EXPIRE', 'PEXPIRE', 'PING', 'DBSIZE']);

class RedisFehler extends Error {}

/* ------------------------------------------------ RESP, das Redis-Protokoll */

export function kodieren(args) {
  const teile = [Buffer.from('*' + args.length + '\r\n')];
  for (const a of args) {
    const b = Buffer.isBuffer(a) ? a : Buffer.from(String(a), 'utf8');
    teile.push(Buffer.from('$' + b.length + '\r\n'), b, Buffer.from('\r\n'));
  }
  return Buffer.concat(teile);
}

/* Liest einen Wert ab Position i. Gibt [wert, neuePosition] zurueck oder
   null, wenn die Antwort noch nicht vollstaendig angekommen ist. */
export function lesen(buf, i = 0) {
  if (i >= buf.length) return null;
  const zeilenende = buf.indexOf('\r\n', i);
  if (zeilenende < 0) return null;
  const typ = String.fromCharCode(buf[i]);
  const zeile = buf.toString('utf8', i + 1, zeilenende);
  const weiter = zeilenende + 2;
  switch (typ) {
    case '+': return [zeile, weiter];
    case '-': return [new RedisFehler(zeile), weiter];
    case ':': return [Number(zeile), weiter];
    case '$': {
      const n = Number(zeile);
      if (n < 0) return [null, weiter];
      if (buf.length < weiter + n + 2) return null;
      return [buf.subarray(weiter, weiter + n), weiter + n + 2];
    }
    case '*': {
      const n = Number(zeile);
      if (n < 0) return [null, weiter];
      const liste = [];
      let pos = weiter;
      for (let k = 0; k < n; k++) {
        const r = lesen(buf, pos);
        if (!r) return null;
        liste.push(r[0]); pos = r[1];
      }
      return [liste, pos];
    }
    default: throw new Error('Unbekannte Redis-Antwort: ' + typ);
  }
}

/* Eine Verbindung, Befehle der Reihe nach. Redis antwortet in derselben
   Reihenfolge, deshalb reicht eine Warteschlange. Reisst die Verbindung
   ab, bekommen alle Wartenden einen Fehler und der naechste Befehl baut
   sie neu auf. */
export function verbindung({ host = '127.0.0.1', port = 6379, passwort = '' } = {}) {
  let sock = null, puffer = Buffer.alloc(0);
  const wartend = [];

  function aufbauen() {
    sock = net.createConnection({ host, port });
    sock.setNoDelay(true);
    sock.on('data', (teil) => {
      puffer = puffer.length ? Buffer.concat([puffer, teil]) : teil;
      let pos = 0;
      for (;;) {
        let r;
        try { r = lesen(puffer, pos); }
        catch (e) { sock.destroy(e); return; }
        if (!r) break;
        pos = r[1];
        const w = wartend.shift();
        if (w) w(r[0]);
      }
      puffer = pos ? puffer.subarray(pos) : puffer;
    });
    const weg = () => {
      sock = null; puffer = Buffer.alloc(0);
      for (const w of wartend.splice(0)) w(new RedisFehler('ERR Verbindung zu Redis verloren'));
    };
    sock.on('close', weg);
    sock.on('error', () => {});
    if (passwort) senden(['AUTH', passwort]).then((a) => { if (a instanceof Error) sock?.destroy(); });
  }

  function senden(args) {
    return new Promise((ok) => { wartend.push(ok); sock.write(kodieren(args)); });
  }

  return {
    /* Liefert Antwort oder RedisFehler als Wert, wirft nie. */
    befehl(args) { if (!sock) aufbauen(); return senden(args); },
    schliessen() { sock?.end(); },
  };
}

/* ------------------------------------------------ Upstash-Uebersetzer */

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

export function gatewayErstellen({ token, redis, neueVerbindung, bodyLimit = 16 * 1024 * 1024 }) {
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

export async function redisEnvLesen(datei) {
  const env = parseEnv(await readFile(datei, 'utf8'));
  const cfg = {
    passwort: env.REDIS_PASS,
    token: env.GATEWAY_TOKEN,
    redisPort: Number(env.REDIS_PORT || 6379),
    gatewayPort: Number(env.GATEWAY_PORT || 8079),
  };
  if (!cfg.passwort || !cfg.token || cfg.token.length < 32) throw new Error('redis.env unvollstaendig');
  return cfg;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const datei = process.argv[2] || path.join(os.homedir(), '.config', 'gehstock1', 'redis.env');
  try {
    const cfg = await redisEnvLesen(datei);
    const neu = () => verbindung({ port: cfg.redisPort, passwort: cfg.passwort });
    const redis = neu();
    const ping = await redis.befehl(['PING']);
    if (ping instanceof Error) throw ping;
    const server = gatewayErstellen({ token: cfg.token, redis, neueVerbindung: neu });
    server.on('error', (e) => { console.error(e.code === 'EADDRINUSE' ? 'Port ' + cfg.gatewayPort + ' belegt.' : 'Uebersetzer startet nicht.'); process.exit(1); });
    server.listen(cfg.gatewayPort, '127.0.0.1', () => console.log('Redis-Uebersetzer auf 127.0.0.1:' + cfg.gatewayPort));
  } catch (e) {
    console.error('Redis-Uebersetzer gestoppt: ' + (e instanceof RedisFehler ? e.message : 'redis-server nicht erreichbar oder redis.env fehlt.'));
    process.exit(1);
  }
}
