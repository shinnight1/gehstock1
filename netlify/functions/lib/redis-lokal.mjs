/* ------------------------------------------------------------------
   Redis direkt, ohne Umweg ueber HTTP.

   Auf dem Handy laufen Server und redis-server im selben Geraet. Statt
   jeden Befehl als HTTP-Anfrage im Upstash-Format zu verpacken, spricht
   der Server hier das Redis-Protokoll (RESP) selbst - ohne Abhaengigkeit,
   es sind nur ein paar Zeilen.

   lokalerClient() bietet dieselben Methoden wie der Upstash-Client, soweit
   das Projekt sie braucht. Damit bleiben lib/speicher.mjs und die
   Werkzeuge unabhaengig davon, welcher Speicher darunter liegt.

   speicherClient() ist dasselbe ohne Redis, nur im Arbeitsspeicher: fuer
   den Entwicklungsserver und die Tests. Er kennt nur das eine Lua-Skript,
   das die Speicherschicht benutzt.
   ------------------------------------------------------------------ */

import net from 'node:net';
import { createHash } from 'node:crypto';

export class RedisFehler extends Error {}

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
   sie neu auf. befehl() wirft nie, ein Redis-Fehler kommt als Wert. */
export function verbindung({ host = '127.0.0.1', port = 6379, passwort = '' } = {}) {
  let sock = null, puffer = Buffer.alloc(0);
  const wartend = [];

  function aufbauen() {
    const s = net.createConnection({ host, port });
    sock = s;
    s.setNoDelay(true);
    s.on('data', (teil) => {
      puffer = puffer.length ? Buffer.concat([puffer, teil]) : teil;
      let pos = 0;
      for (;;) {
        let r;
        try { r = lesen(puffer, pos); }
        catch (e) { s.destroy(e); return; }
        if (!r) break;
        pos = r[1];
        const w = wartend.shift();
        if (w) w(r[0]);
      }
      puffer = pos ? puffer.subarray(pos) : puffer;
    });
    s.on('close', () => {
      if (sock === s) { sock = null; puffer = Buffer.alloc(0); }
      for (const w of wartend.splice(0)) w(new RedisFehler('ERR Verbindung zu Redis verloren'));
    });
    s.on('error', () => {});
    if (passwort) senden(['AUTH', passwort]).then((a) => { if (a instanceof Error) s.destroy(); });
  }

  function senden(args) {
    return new Promise((ok) => { wartend.push(ok); sock.write(kodieren(args)); });
  }

  return {
    befehl(args) { if (!sock) aufbauen(); return senden(args); },
    schliessen() { sock?.end(); },
  };
}

/* redis://:passwort@127.0.0.1:6379 */
export function adresseLesen(url) {
  const u = new URL(url);
  if (u.protocol !== 'redis:') throw new Error('REDIS_URL muss mit redis:// beginnen.');
  return { host: u.hostname || '127.0.0.1', port: Number(u.port || 6379), passwort: decodeURIComponent(u.password || '') };
}

/* REDIS_URL, oder die Werte aus ~/.config/gehstock1/redis.env. */
export function lokaleAdresse(env = process.env) {
  if (env.REDIS_URL) return env.REDIS_URL;
  if (env.REDIS_PASS) return 'redis://:' + encodeURIComponent(env.REDIS_PASS) + '@127.0.0.1:' + (env.REDIS_PORT || 6379);
  return null;
}

const text = (w) => (Buffer.isBuffer(w) ? w.toString('utf8') : w);
const tief = (w) => (Array.isArray(w) ? w.map(tief) : text(w));

export function lokalerClient(url) {
  const v = verbindung(adresseLesen(url));
  const roh = async (args) => {
    const a = await v.befehl(args);
    if (a instanceof Error) throw a;
    return tief(a);
  };
  return {
    befehl: roh,
    get: (k) => roh(['GET', k]),
    set: (k, w) => roh(['SET', k, w]),
    del: (...keys) => roh(['DEL', ...keys]),
    type: (k) => roh(['TYPE', k]),
    pttl: (k) => roh(['PTTL', k]),
    ping: () => roh(['PING']),
    eval: (skript, keys, args) => roh(['EVAL', skript, keys.length, ...keys, ...args]),
    scan: (cursor, { match = '*', count = 100 } = {}) => roh(['SCAN', cursor, 'MATCH', match, 'COUNT', count]),
    hgetall: async (k) => {
      const flach = await roh(['HGETALL', k]);
      const aus = {};
      for (let i = 0; i + 1 < flach.length; i += 2) aus[flach[i]] = flach[i + 1];
      return aus;
    },
    hset: (k, felder) => roh(['HSET', k, ...Object.entries(felder).flat()]),
    hdel: (k, ...felder) => roh(['HDEL', k, ...felder]),
    schliessen: () => v.schliessen(),
  };
}

/* ------------------------------------------------ nur im Arbeitsspeicher */

export function speicherClient() {
  const daten = new Map();
  const sha1 = (t) => createHash('sha1').update(t).digest('hex');
  const muster = (m) => new RegExp('^' + m.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
  return {
    daten,
    get: async (k) => { const w = daten.get(k); if (w instanceof Map) throw new Error('WRONGTYPE'); return w ?? null; },
    set: async (k, w) => { daten.set(k, String(w)); return 'OK'; },
    del: async (...keys) => keys.filter((k) => daten.delete(k)).length,
    /* Nur das Vergleichen-und-Schreiben aus lib/speicher.mjs. */
    eval: async (skript, [key], [neu, bedingung]) => {
      const aktuell = daten.has(key) ? daten.get(key) : null;
      const passt = bedingung === '@neu' ? aktuell === null : aktuell !== null && sha1(aktuell) === bedingung;
      if (!passt) return 0;
      daten.set(key, neu); return 1;
    },
    scan: async (cursor, { match = '*' } = {}) => ['0', [...daten.keys()].filter((k) => muster(match).test(k))],
    hgetall: async (k) => Object.fromEntries(daten.get(k) instanceof Map ? daten.get(k) : []),
    hset: async (k, felder) => {
      const h = daten.get(k) instanceof Map ? daten.get(k) : new Map();
      for (const [f, w] of Object.entries(felder)) h.set(f, String(w));
      daten.set(k, h); return 1;
    },
    hdel: async (k, ...felder) => felder.filter((f) => daten.get(k) instanceof Map && daten.get(k).delete(f)).length,
  };
}
