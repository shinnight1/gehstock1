/* Die Datenbank fuer die Werkzeuge (Sichern, Einspielen, Ausstatten):
   das Redis auf dem Handy, wenn REDIS_URL oder REDIS_PASS gesetzt ist
   (node --env-file=~/.config/gehstock1/redis.env ...), sonst Upstash.
   Beide Clients haben dieselben Methoden. schliessen() nicht vergessen,
   sonst haelt die offene Verbindung das Werkzeug am Leben. */
import { lokalerClient, lokaleAdresse } from '../netlify/functions/lib/redis-lokal.mjs';

export async function datenbank(env = process.env) {
  const lokal = lokaleAdresse(env);
  if (lokal) return lokalerClient(lokal);
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  const { Redis } = await import('@upstash/redis');
  /* automaticDeserialization aus: Der Text soll byteweise so bleiben, wie er
     drinsteht - die Speicherschicht leitet ihren Stempel daraus ab. */
  const r = new Redis({ url, token, automaticDeserialization: false });
  r.schliessen = () => {};
  return r;
}
