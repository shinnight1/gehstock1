/* ------------------------------------------------------------------
   Ein Speicher, zwei Anbieter.

   Der Code kennt nur noch speicher(name). Was darunter liegt,
   entscheidet die Umgebung:

     KV_REST_API_URL gesetzt  ->  Redis (Vercel)
     sonst                    ->  Netlify Blobs

   Damit laeuft derselbe Stand auf beiden Plattformen. Waehrend des
   Umzugs ist das der Rueckfallweg: Netlify bleibt lauffaehig, ohne
   dass eine Zeile zurueckgedreht werden muss.

   Nachgebaut wird genau der Teil der Netlify-Schnittstelle, den das
   Projekt benutzt - nicht mehr:

     get(key, { type: 'json' })             -> Wert oder null
     getWithMetadata(key, { type: 'json' }) -> { data, etag } oder null
     setJSON(key, wert)                     -> bedingungslos
     setJSON(key, wert, { onlyIfMatch })    -> { modified }
     setJSON(key, wert, { onlyIfNew })      -> { modified }
     delete(key)
   ------------------------------------------------------------------ */

import { createHash } from 'node:crypto';

const redisAn = () => !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

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
    const { Redis } = await import('@upstash/redis');
    /* Ohne automaticDeserialization kaeme der Text anders zurueck, als er
       hineingegeben wurde - dann stimmt kein Hash mehr. Alles bleibt
       deshalb von Hand ein String. */
    redisClient = new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
      automaticDeserialization: false,
    });
  }
  return redisClient;
}

/* Alles eines Stores liegt unter einem gemeinsamen Namensraum, damit die
   drei Stores sich in einer Redis-Datenbank nicht ins Gehege kommen. */
function redisStore(name, verbindung = redis) {
  const d = (key) => name + '|' + key;

  async function text(key) {
    const r = await verbindung();
    const v = await r.get(d(key));
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
      if (!opts) { await r.set(d(key), neu); return { modified: true, etag: stempelVon(neu) }; }
      /* Ein leeres onlyIfMatch ist kein "egal", sondern ein Fehler weiter
         oben. Es darf nie zum bedingungslosen Schreiben werden. */
      const bedingung = opts.onlyIfNew ? '@neu' : String(opts.onlyIfMatch || '');
      if (bedingung !== '@neu' && !bedingung) return { modified: false, etag: stempelVon(neu) };
      const ok = await r.eval(CAS, [d(key)], [neu, bedingung]);
      return { modified: Number(ok) === 1, etag: stempelVon(neu) };
    },

    async delete(key) {
      const r = await verbindung();
      await r.del(d(key));
    },
  };
}

/* Netlify bringt alles Gebrauchte selbst mit und wird nur durchgereicht.
   Der Import liegt absichtlich in der Funktion: auf Vercel ist das Paket
   nicht installiert und darf beim Laden nicht gezogen werden. */
async function netlifyStore(name) {
  const { getStore } = await import('@netlify/blobs');
  return getStore({ name, consistency: 'strong' });
}

const offen = new Map();

export function speicher(name) {
  if (offen.has(name)) return offen.get(name);
  const store = redisAn() ? redisStore(name) : (() => {
    let echt = null;
    const hol = async () => (echt || (echt = await netlifyStore(name)));
    return {
      get: async (k, o) => (await hol()).get(k, o),
      getWithMetadata: async (k, o) => (await hol()).getWithMetadata(k, o),
      setJSON: async (k, v, o) => (await hol()).setJSON(k, v, o),
      delete: async (k) => (await hol()).delete(k),
    };
  })();
  offen.set(name, store);
  return store;
}

export const speicherArt = () => (redisAn() ? 'redis' : 'netlify-blobs');

/* Nur fuer tools/speicher-tests.mjs: erlaubt einen nachgebauten Client,
   damit das Zusammenspiel von Stempel und Bedingung ohne echtes Redis
   geprueft werden kann. */
export const _redisStore = (name, client) => redisStore(name, async () => client);
export const _stempelVon = stempelVon;
export const _CAS = CAS;
