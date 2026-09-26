/* Der Server der Seite - auf dem Handy (Termux) hinter Caddy, nur auf localhost.
   Welche Welt er nimmt, steht in ~/.config/gehstock1: mit redis-live das Redis
   auf dem Handy, sonst Upstash aus server.env. Legt nie eine Ersatzwelt an.

   Entwicklung am PC (leere Welt im Arbeitsspeicher, vorher npm run build):
     node tools/handy-server.mjs --dev [port] */
import http from 'node:http';
import { createReadStream } from 'node:fs';
import { realpath, stat, access, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { parseEnv } from 'node:util';
import { zugangLesen, zugangSetzen, weltPruefen, weltPruefenMit } from './handy-zugang.mjs';
import { lokalerClient, lokaleAdresse } from '../netlify/functions/lib/redis-lokal.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.wasm': 'application/wasm', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.txt': 'text/plain; charset=utf-8' };

function innerhalb(wurzel, datei) {
  const rel = path.relative(wurzel, datei);
  return rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel);
}

function bodyLesen(req, limit) {
  return new Promise((resolve, reject) => {
    const teile = [];
    let bytes = 0, zuGross = false;
    req.on('data', (teil) => {
      bytes += teil.length;
      if (bytes > limit) {
        if (!zuGross) { zuGross = true; teile.length = 0; reject(Object.assign(new Error(), { status: 413 })); }
      } else if (!zuGross) teile.push(teil);
    });
    req.on('end', () => { if (!zuGross) resolve(Buffer.concat(teile)); });
    req.on('error', reject);
    req.on('aborted', () => reject(new Error('aborted')));
  });
}

export async function serverErstellen({ dist, room, gehstockmon, bodyLimit = 8 * 1024 * 1024 }) {
  const wurzel = await realpath(dist);
  const routen = new Map([
    ['/api/room', room], ['/.netlify/functions/room', room],
    ['/api/gehstockmon', gehstockmon], ['/.netlify/functions/gehstockmon', gehstockmon],
  ]);
  return http.createServer({ requestTimeout: 30000, headersTimeout: 15000 }, async (req, res) => {
    const fail = (status) => {
      if (res.headersSent) { res.destroy(); return; }
      res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store', ...(status === 413 ? { Connection: 'close' } : {}) });
      res.end('HTTP ' + status);
    };
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    try {
      // Origin fest vorgeben: der Host-Header entscheidet nicht ueber interne Ziele.
      const url = new URL(req.url, 'http://localhost');
      const funktion = routen.get(url.pathname);
      if (funktion) {
        const abbruch = new AbortController();
        res.on('close', () => { if (!res.writableEnded) abbruch.abort(); });
        const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await bodyLesen(req, bodyLimit);
        const request = new Request(url, { method: req.method, headers: req.headers, body, signal: abbruch.signal });
        const antwort = await funktion(request);
        res.writeHead(antwort.status, { ...Object.fromEntries(antwort.headers), 'Cache-Control': 'no-store' });
        if (!antwort.body || req.method === 'HEAD') {
          await antwort.body?.cancel(); res.end();
        } else {
          const stream = Readable.fromWeb(antwort.body);
          stream.on('error', () => res.destroy());
          res.on('close', () => stream.destroy());
          stream.pipe(res);
        }
        return;
      }
      if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/.netlify/')) return fail(404);
      if (!['GET', 'HEAD'].includes(req.method)) return fail(405);
      let pfad;
      try { pfad = decodeURIComponent(url.pathname); } catch { return fail(400); }
      if (pfad.includes('\\') || pfad.includes('\0') || pfad.split('/').some((s) => s.startsWith('.'))) return fail(404);
      let datei = path.resolve(wurzel, '.' + pfad);
      if (!innerhalb(wurzel, datei)) return fail(404);
      if ((await stat(datei)).isDirectory()) datei = path.join(datei, 'index.html');
      datei = await realpath(datei);
      if (!innerhalb(wurzel, datei)) return fail(404);
      const info = await stat(datei);
      if (!info.isFile()) return fail(404);
      const headers = {
        'Content-Type': MIME[path.extname(datei).toLowerCase()] || 'application/octet-stream',
        'Content-Length': info.size,
        'Cache-Control': /^\/(assets\/|games\/arena\/bundle\/)/.test(pfad)
          ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate',
      };
      if (pfad.startsWith('/offline/')) headers['Content-Disposition'] = 'attachment';
      res.writeHead(200, headers);
      if (req.method === 'HEAD') { res.end(); return; }
      const stream = createReadStream(datei);
      stream.on('error', () => res.destroy());
      res.on('close', () => stream.destroy());
      stream.pipe(res);
    } catch (e) {
      fail(e.status || (['ENOENT', 'ENOTDIR'].includes(e.code) ? 404 : 500));
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const dev = process.argv[2] === '--dev';
  try {
    const dir = path.join(os.homedir(), '.config', 'gehstock1');
    let welt = null;
    if (dev) {
      /* Entwicklung: eigene, leere Welt im Arbeitsspeicher, nie die echte. */
      for (const k of ['REDIS_URL', 'REDIS_PASS', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN']) delete process.env[k];
      process.env.GEHSTOCK_SPEICHER = 'arbeitsspeicher';
    } else if (await access(path.join(dir, 'redis-live')).then(() => true, () => false)) {
      /* Das Redis auf dem Handy ist die Spielerwelt - direkt, ohne Upstash. */
      const env = parseEnv(await readFile(path.join(dir, 'redis.env'), 'utf8'));
      for (const k of ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN']) delete process.env[k];
      process.env.REDIS_URL = lokaleAdresse(env);
      const client = lokalerClient(process.env.REDIS_URL);
      welt = await weltPruefenMit(client);
      client.schliessen();
    } else {
      const zugang = await zugangLesen(process.argv[2] || path.join(dir, 'server.env'));
      zugangSetzen(zugang);
      welt = await weltPruefen(zugang);
    }
    const dist = path.join(ROOT, 'dist');
    await access(path.join(dist, 'index.html'));
    if (!dev) await access(path.join(dist, 'games', 'arena', 'index.html'));
    const [{ default: room }, { default: gehstockmon }] = await Promise.all([
      import('../netlify/functions/room.mjs'), import('../netlify/functions/gehstockmon.mjs'),
    ]);
    const port = Number((dev && process.argv[3]) || process.env.GEHSTOCK_PORT || process.env.PORT || (dev ? 8787 : 8080));
    if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('port');
    const server = await serverErstellen({ dist, room, gehstockmon });
    server.on('error', (e) => {
      console.error(e.code === 'EADDRINUSE' ? 'Port ' + port + ' belegt: laeuft der Server schon?' : 'Server konnte nicht starten.');
      process.exitCode = 1;
    });
    server.listen(port, '127.0.0.1', () => {
      if (dev) console.log('Entwicklung: leere Testwelt im Arbeitsspeicher. http://localhost:' + port);
      else {
        console.log('Verbunden: ' + welt.profile + ' Profile, ' + welt.spieler + ' GehstockMon-Spieler.');
        console.log('Hideout: http://localhost:' + port);
        console.log('Echte Spielerwelt. Termux offen lassen. Beenden: CTRL+C.');
      }
    });
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
      server.close();
      setTimeout(() => server.closeAllConnections(), 8000).unref();
    });
  } catch {
    console.error(dev ? 'Start gestoppt: erst bauen (npm run build).'
      : 'Start gestoppt: Zugang, bestehende Spielerwelt und vollstaendigen Build pruefen.');
    if (!dev) console.error('Keine neue oder lokale Ersatzwelt gestartet.');
    process.exitCode = 1;
  }
}
