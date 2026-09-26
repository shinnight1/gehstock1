/* ------------------------------------------------------------------
   Ein Speicher, drei Wege darunter.

   Der Code kennt nur speicher(name). Was darunter liegt, entscheidet
   die Umgebung:

     REDIS_URL (oder REDIS_PASS)       ->  Redis auf dem Handy, direkt
     UPSTASH_REDIS_REST_URL/_TOKEN     ->  Redis bei Upstash (Rueckfallweg)
     GEHSTOCK_SPEICHER=arbeitsspeicher ->  nur im Arbeitsspeicher (Entwicklung)

   Ist nichts davon gesetzt, bricht der Zugriff ab. Frueher lief es dann
   still auf Netlify Blobs - also auf einer leeren Welt.

   Die Schnittstelle stammt aus der Netlify-Zeit und bleibt, weil der
   ganze Spielcode sie benutzt:

     get(key, { type: 'json' })             -> Wert oder null
     getWithMetadata(key, { type: 'json' }) -> { data, etag } oder null
     setJSON(key, wert)                     -> bedingungslos
     setJSON(key, wert, { onlyIfMatch })    -> { modified }
     setJSON(key, wert, { onlyIfNew })      -> { modified }
     delete(key)

   Nur Redis kann zusaetzlich Felder (ein Hash je Schluessel). Gebraucht
   wird das fuer die Anwesenheit in GehstockMon, siehe
   lib/gehstockmon-anwesenheit.mjs - wer es nutzt, prueft vorher, ob
   felder() da ist, und faellt sonst auf ein Dokument zurueck:

     felder(key)                   -> { feld: wert } (leer: {})
     feldSetzen(key, feld, wert)
     felderWeg(key, [feld, ...])
   ------------------------------------------------------------------ */

import { createHash } from 'node:crypto';

import { lokalerClient, lokaleAdresse, speicherClient } from './redis-lokal.mjs';

const upstashUrl = () => process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const upstashToken = () => process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
export function speicherArt() {
  if (lokaleAdresse()) return 'redis-lokal';
  if (upstashUrl() && upstashToken()) return 'upstash';
  if (process.env.GEHSTOCK_SPEICHER === 'arbeitsspeicher') return 'arbeitsspeicher';
  return null;
}

/* ------------------------------------------------------------------
   Der Stempel ist der Inhalt selbst

   Ein getrennter Versionszaehler waere die naheliegende Loesung und
   die schlechtere: fehlt er, weil ein Import ihn nicht mitgeschrieben
   hat, waere die Bedingung leer und aus dem Vergleich wuerde ein
   blindes Ueberschreiben. Genau der Fehler, der still Spielstaende
   frisst.

   Darum ist der Stempel der SHA1 des gespeicherten Textes. Er kann
   nicht fehlen, nicht veralten und nicht leer sein, und eine
   eingespielte Sicherung hat von sich aus den richtigen.
   ------------------------------------------------------------------ */
const stempelVon = (text) => createHash('sha1').update(text).digest('hex');

/* Vergleichen und Schreiben muessen ein Schritt sein. Zwei getrennte
   Befehle koennen sich ueberholen, und dann verliert ein Spieler
   seinen Kampf. Lua laeuft in Redis am Stueck durch. */
const CAS = `
local aktuell = redis.call('GET', KEYS[1])
if ARGV[2] == '@neu' then
  if aktuell then return 0 end
else
  if not aktuell then return 0 end
  if redis.sha1hex(aktuell) ~= ARGV[2] then return 0 end
end
redis.call('SET', KEYS[1], ARGV[1])
return 1
`;

let redisClient = null;
async function redis() {
  if (!redisClient) {
    const art = speicherArt();
    if (art === 'redis-lokal') redisClient = lokalerClient(lokaleAdresse());
    else if (art === 'arbeitsspeicher') redisClient = speicherClient();
    else if (art === 'upstash') {
      const { Redis } = await import('@upstash/redis');
      /* Ohne automaticDeserialization kaeme der Text anders zurueck, als er
         hineingegeben wurde - dann stimmt kein Hash mehr. Alles bleibt
         deshalb von Hand ein String. */
      redisClient = new Redis({ url: upstashUrl(), token: upstashToken(), automaticDeserialization: false });
    } else {
      throw new Error('Kein Speicher eingerichtet (REDIS_URL, UPSTASH_REDIS_REST_URL oder GEHSTOCK_SPEICHER).');
    }
  }
  return redisClient;
}

/* Alles eines Stores liegt unter einem gemeinsamen Namensraum, damit die
   drei Stores sich in einer Redis-Datenbank nicht ins Gehege kommen. */
/* ------------------------------------------------------------------
   Noch einmal fragen, bevor man aufgibt

   Eine Datenbank am Kontingentende sagt nicht durchgehend nein, sondern
   lehnt einen Teil der Befehle ab ("max requests limit exceeded").
   Fuer den Spieler sah das aus wie ein Totalausfall: Ein Spielzug
   braucht mehrere Befehle, einer davon fiel fast immer durch, und die
   Seite meldete "Verbindung zur Spielerwelt verloren".

   Zwei kurze Nachfragen holen die meisten davon herein. Sie gelten nur
   fuer Absagen, die von selbst vorbeigehen - Kontingent, abgerissene
   Leitung, Zeitueberschreitung. Ein echter Fehler (falsches Passwort,
   kaputtes Kommando) wird sofort weitergereicht, sonst verschleppte das
   Wiederholen nur die Diagnose.

   Auch das Schreiben darf wiederholt werden: Es traegt seinen Stempel
   mit sich. Kommt es doch zweimal an, laeuft der zweite Versuch ins
   Leere, statt etwas zu ueberschreiben. */
const VORUEBERGEHEND = /max requests|rate limit|too many|ECONNRESET|ETIMEDOUT|fetch failed|network|socket|timeout|502|503|504/i;
const PAUSEN = [120, 350];

async function nochmal(was) {
  for (let i = 0; ; i++) {
    try { return await was(); }
    catch (e) {
      const text = String((e && e.message) || e);
      if (i >= PAUSEN.length || !VORUEBERGEHEND.test(text)) throw e;
      await new Promise((ok) => setTimeout(ok, PAUSEN[i]));
    }
  }
}

function redisStore(name, verbindung = redis) {
  // Namensraum der bestehenden Vercel-Spielerwelt beibehalten.
  const prefix = 'hgh:' + name + ':';
  const d = (key) => prefix + key;

  async function text(key) {
    const r = await verbindung();
    const v = await nochmal(() => r.get(d(key)));
    if (v === null || v === undefined) return null;
    return typeof v === 'string' ? v : JSON.stringify(v);
  }

  return {
    async get(key) {
      const t = await text(key);
      if (t === null) return null;
      try { return JSON.parse(t); } catch { return null; }
    },

    async getWithMetadata(key) {
      const t = await text(key);
      if (t === null) return null;
      let data;
      try { data = JSON.parse(t); } catch { return null; }
      return { data, etag: stempelVon(t) };
    },

    async setJSON(key, wert, opts) {
      const r = await verbindung();
      const neu = JSON.stringify(wert);
      if (!opts) { await nochmal(() => r.set(d(key), neu)); return { modified: true, etag: stempelVon(neu) }; }
      /* Ein leeres onlyIfMatch ist kein "egal", sondern ein Fehler weiter
         oben. Es darf nie zum bedingungslosen Schreiben werden. */
      const bedingung = opts.onlyIfNew ? '@neu' : String(opts.onlyIfMatch || '');
      if (bedingung !== '@neu' && !bedingung) return { modified: false, etag: stempelVon(neu) };
      const ok = await nochmal(() => r.eval(CAS, [d(key)], [neu, bedingung]));
      return { modified: Number(ok) === 1, etag: stempelVon(neu) };
    },

    async list() {
      const r = await verbindung(); let cursor = '0', found = [];
      do { const [next, keys] = await nochmal(() => r.scan(cursor, { match: prefix + '*', count: 500 })); cursor = String(next); found.push(...keys); } while (cursor !== '0');
      return { blobs: found.filter(k => !k.endsWith(':v')).map(k => ({ key: k.slice(prefix.length) })) };
    },

    async delete(key) {
      const r = await verbindung();
      await nochmal(() => r.del(d(key), d(key) + ':v'));
    },

    /* Ohne automaticDeserialization kommt HGETALL als flache Liste
       [feld, wert, feld, wert, ...] zurueck; aeltere Clients liefern ein
       Objekt. Beides wird verstanden. */
    async felder(key) {
      const r = await verbindung();
      const roh = await nochmal(() => r.hgetall(d(key)));
      const paare = Array.isArray(roh)
        ? Array.from({ length: Math.floor(roh.length / 2) }, (_, i) => [roh[2 * i], roh[2 * i + 1]])
        : Object.entries(roh || {});
      const aus = {};
      for (const [feld, wert] of paare) {
        try { aus[feld] = typeof wert === 'string' ? JSON.parse(wert) : wert; } catch { /* kaputtes Feld auslassen */ }
      }
      return aus;
    },

    async feldSetzen(key, feld, wert) {
      const r = await verbindung();
      await nochmal(() => r.hset(d(key), { [feld]: JSON.stringify(wert) }));
    },

    async felderWeg(key, felder) {
      if (!felder || !felder.length) return;
      const r = await verbindung();
      await nochmal(() => r.hdel(d(key), ...felder));
    },
  };
}

const offen = new Map();

export function speicher(name) {
  if (!offen.has(name)) offen.set(name, redisStore(name));
  return offen.get(name);
}

/* Nur fuer tools/speicher-tests.mjs: erlaubt einen nachgebauten Client,
   damit das Zusammenspiel von Stempel und Bedingung ohne echtes Redis
   geprueft werden kann. */
export const _redisStore = (name, client) => redisStore(name, async () => client);
export const _stempelVon = stempelVon;
export const _CAS = CAS;

// Beide Aufrufer verwenden dieselbe, bereits befüllte Welt.
export const getStore = (input) => speicher(typeof input === 'string' ? input : input.name);
