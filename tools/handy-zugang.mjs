/* Zugang fuer den Handy-Server. Prueft nur GETs, legt keine Welt an. */
import { readFile, mkdir, writeFile, rename, rm, chmod } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';

export function zugangPruefen(url, token) {
  let parsed;
  try { parsed = new URL(String(url || '').trim()); } catch { throw new Error('Die Datenbankadresse fehlt oder ist ungueltig.'); }
  // Erlaubt sind Upstash selbst oder der Redis-Uebersetzer auf dem Handy (tools/handy-redis.mjs).
  const upstash = parsed.protocol === 'https:' && /^[a-z0-9-]+\.upstash\.io$/.test(parsed.hostname) && !parsed.port;
  const lokal = parsed.protocol === 'http:' && parsed.hostname === '127.0.0.1' && /^\d{4,5}$/.test(parsed.port);
  if (!(upstash || lokal)
      || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') {
    throw new Error('Bitte die HTTPS-REST-Adresse deiner Upstash-Datenbank verwenden.');
  }
  token = String(token || '').trim();
  if (!/^[A-Za-z0-9_+=\/-]{20,}$/.test(token)) throw new Error('Der Token fehlt oder enthaelt ungueltige Zeichen.');
  return { url: parsed.origin, token };
}

export async function zugangLesen(datei) {
  const env = parseEnv(await readFile(datei, 'utf8'));
  return zugangPruefen(env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL,
    env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN);
}

export function zugangSetzen({ url, token }) {
  // Eine alte Shell-Umgebung darf nicht unbemerkt eine andere Welt auswaehlen.
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
  process.env.UPSTASH_REDIS_REST_URL = url;
  process.env.UPSTASH_REDIS_REST_TOKEN = token;
}

export async function weltPruefen(zugang, abrufen = fetch) {
  const antwort = await abrufen(zugang.url + '/pipeline', {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(20000),
    headers: { Authorization: 'Bearer ' + zugang.token, 'Content-Type': 'application/json' },
    body: JSON.stringify([
      ['GET', 'hgh:hgh-rooms:verwaltung'],
      ['GET', 'hgh:hgh-gehstockmon:world-v2'],
    ]),
  });
  if (!antwort.ok) throw new Error('Datenbank nicht erreichbar oder Zugang abgelehnt.');
  const daten = await antwort.json();
  if (!Array.isArray(daten) || daten.length !== 2 || daten.some((d) => d.error || typeof d.result !== 'string')) {
    throw new Error('Die bisherige Spielerwelt konnte nicht vollstaendig gelesen werden.');
  }
  const [verwaltung, welt] = daten.map((d) => JSON.parse(d.result));
  const profile = Array.isArray(verwaltung?.daten?.profile) ? verwaltung.daten.profile.length : 0;
  const spieler = welt?.players && typeof welt.players === 'object' && !Array.isArray(welt.players)
    ? Object.keys(welt.players).length : 0;
  if (!profile || !spieler) throw new Error('Keine bestehenden Profile oder Spielstaende gefunden. Einrichtung gestoppt.');
  return { profile, spieler };
}

export async function zugangSpeichern(datei, zugang) {
  await mkdir(path.dirname(datei), { recursive: true, mode: 0o700 });
  const tmp = datei + '.neu-' + process.pid;
  const text = 'UPSTASH_REDIS_REST_URL=' + JSON.stringify(zugang.url) + '\n'
    + 'UPSTASH_REDIS_REST_TOKEN=' + JSON.stringify(zugang.token) + '\n';
  try {
    await writeFile(tmp, text, { mode: 0o600, flag: 'wx' });
    await rename(tmp, datei);
    await chmod(datei, 0o600);
  } finally { await rm(tmp, { force: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    if (!process.argv[2]) throw new Error('Zieldatei fehlt.');
    const zugang = zugangPruefen(process.env.UPSTASH_REDIS_REST_URL, process.env.UPSTASH_REDIS_REST_TOKEN);
    const welt = await weltPruefen(zugang);
    await zugangSpeichern(path.resolve(process.argv[2]), zugang);
    console.log('Zugang geprueft: ' + welt.profile + ' Profile, ' + welt.spieler + ' GehstockMon-Spieler.');
    console.log('Zugang nur auf diesem Geraet gespeichert.');
  } catch {
    // Fremde Fehlermeldungen koennten Token, Antwortdaten oder persoenliche Daten enthalten.
    console.error('Einrichtung gestoppt: URL und Token muessen zusammengehoeren und die bestehende Spielerwelt erreichen.');
    console.error('Auch Internetverbindung und Datenbankkontingent pruefen. Keine Spielstaende wurden geaendert.');
    process.exitCode = 1;
  }
}
