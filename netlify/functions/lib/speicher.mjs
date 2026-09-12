/* Ein Speicher, zwei Haeuser.

   Auf Netlify sind es die Blobs, auf Vercel ist es Redis. Welches gilt,
   entscheidet allein die Umgebung: liegen die Redis-Zugangsdaten vor,
   wird Redis benutzt, sonst Netlify. Der uebrige Code merkt davon nichts -
   get, getWithMetadata, setJSON und delete verhalten sich gleich,
   einschliesslich der bedingten Schreibvorgaenge (onlyIfMatch/onlyIfNew),
   auf denen die Spielerwelt beruht. */
import { getStore as netlifyStore } from '@netlify/blobs';

const URL_ = () => process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN_ = () => process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

let redis = null;
async function verbinde() {
  if (!redis) {
    const { Redis } = await import('@upstash/redis');
    redis = new Redis({ url: URL_(), token: TOKEN_() });
  }
  return redis;
}

/* Schreiben nur, wenn die Version noch stimmt - in einem Rutsch, damit
   zwei gleichzeitige Zuege sich nicht gegenseitig ueberholen. Genau
   dafuer stand bei Netlify das ETag. */
const CAS = `
local da = redis.call('EXISTS', KEYS[1])
local v = redis.call('GET', KEYS[2])
if v == false then v = '0' end
if ARGV[2] == 'neu' and da == 1 then return 0 end
if ARGV[2] ~= 'neu' and ARGV[2] ~= 'egal' and v ~= ARGV[2] then return 0 end
local n = tonumber(v) + 1
redis.call('SET', KEYS[1], ARGV[1])
redis.call('SET', KEYS[2], tostring(n))
return n
`;

function redisStore({ name }) {
  const raum = 'hgh:' + name + ':';
  const d = (key) => raum + key;
  const v = (key) => raum + key + ':v';
  return {
    async get(key) {
      const r = await verbinde();
      const wert = await r.get(d(key));
      return wert === undefined ? null : wert;
    },
    async getWithMetadata(key) {
      const r = await verbinde();
      const [wert, version] = await r.mget(d(key), v(key));
      if (wert === null || wert === undefined) return null;
      return { data: wert, etag: String(version === null || version === undefined ? 0 : version) };
    },
    async setJSON(key, wert, optionen = {}) {
      const r = await verbinde();
      const modus = optionen.onlyIfNew ? 'neu'
        : optionen.onlyIfMatch !== undefined ? String(optionen.onlyIfMatch)
        : 'egal';
      const n = Number(await r.eval(CAS, [d(key), v(key)], [JSON.stringify(wert), modus]));
      return { modified: n > 0, etag: String(n) };
    },
    async delete(key) {
      const r = await verbinde();
      await r.del(d(key), v(key));
    },
    async list() {
      const r = await verbinde();
      let cursor = '0', gefunden = [];
      do {
        const [weiter, teil] = await r.scan(cursor, { match: raum + '*', count: 500 });
        cursor = String(weiter);
        gefunden = gefunden.concat(teil);
      } while (cursor !== '0');
      return { blobs: gefunden.filter((k) => !k.endsWith(':v')).map((k) => ({ key: k.slice(raum.length) })) };
    },
  };
}

export function getStore(eingabe) {
  const wahl = typeof eingabe === 'string' ? { name: eingabe } : eingabe;
  return URL_() && TOKEN_() ? redisStore(wahl) : netlifyStore(wahl);
}