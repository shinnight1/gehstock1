/* Nur lokale Testdateien und simulierte Datenbankantworten. Keine echte Welt. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, stat, symlink, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { serverErstellen } from './handy-server.mjs';
import { zugangPruefen, zugangSpeichern, zugangLesen, zugangSetzen, weltPruefen } from './handy-zugang.mjs';

const zugang = { url: 'https://example-test.upstash.io', token: 'test-only-token-1234567890' };
const antwort = (verwaltung, welt) => Response.json([
  { result: JSON.stringify(verwaltung) }, { result: JSON.stringify(welt) },
]);

test('Zugang und Bestand werden ausschliesslich durch zwei GETs geprueft', async () => {
  const bestand = await weltPruefen(zugang, async (url, options) => {
    assert.equal(url, zugang.url + '/pipeline');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, 'Bearer ' + zugang.token);
    assert.deepEqual(JSON.parse(options.body), [
      ['GET', 'hgh:hgh-rooms:verwaltung'], ['GET', 'hgh:hgh-gehstockmon:world-v2'],
    ]);
    return antwort({ daten: { profile: [{}, {}] } }, { players: { a: {}, b: {}, c: {} } });
  });
  assert.deepEqual(bestand, { profile: 2, spieler: 3 });
});

test('Leere, unvollstaendige und nicht erreichbare Welten werden abgelehnt', async () => {
  for (const result of [
    antwort({ daten: { profile: [] } }, { players: {} }),
    antwort({ daten: { profile: [{}] } }, { players: {} }),
    Response.json([{ result: null }, { result: null }]),
    Response.json([{ error: 'denied' }, { result: '{}' }]),
    new Response('denied', { status: 401 }),
    new Response('kein JSON'),
  ]) await assert.rejects(weltPruefen(zugang, async () => result));
});

test('Token gehen ausschliesslich an eine HTTPS-Upstash-REST-Adresse', () => {
  assert.deepEqual(zugangPruefen(zugang.url + '/', zugang.token), zugang);
  for (const url of ['http://example-test.upstash.io', 'https://upstash.io.evil.test',
    'https://example-test.upstash.io.evil.test', 'https://user:pass@example-test.upstash.io',
    zugang.url + '/set/key/value', zugang.url + '?token=oops', zugang.url + '#x', 'file:///tmp']) {
    assert.throws(() => zugangPruefen(url, zugang.token));
  }
  assert.throws(() => zugangPruefen(zugang.url, ''));
  assert.throws(() => zugangPruefen(zugang.url, zugang.token + '\nINJECT=1'));
});

test('Zugangdatei wird vollstaendig ersetzt, ist lesbar und bleibt privat', async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'handy-zugang-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'config', 'server.env');
  await zugangSpeichern(file, zugang);
  assert.deepEqual(await zugangLesen(file), zugang);
  const neu = { ...zugang, token: zugang.token + '-neu' };
  await zugangSpeichern(file, neu);
  assert.deepEqual(await zugangLesen(file), neu);
  if (process.platform !== 'win32') assert.equal((await stat(file)).mode & 0o777, 0o600);
  await writeFile(file, 'KV_REST_API_URL="' + zugang.url + '"\nKV_REST_API_TOKEN="' + zugang.token + '"\n');
  assert.deepEqual(await zugangLesen(file), zugang);
  const result = spawnSync(process.execPath, ['tools/handy-zugang.mjs', file], {
    encoding: 'utf8', env: { ...process.env, UPSTASH_REDIS_REST_URL: 'http://invalid', UPSTASH_REDIS_REST_TOKEN: 'nicht-ausgeben-1234567890' },
  });
  assert.equal(result.status, 1);
  assert.doesNotMatch(result.stdout + result.stderr, /nicht-ausgeben/);
  assert.deepEqual(await zugangLesen(file), zugang, 'ungueltiger Zugang darf die alte Datei nicht ersetzen');
});

test('Expliziter Dateizugang ersetzt auch geerbte Zugangsdaten', () => {
  const keys = ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN'];
  const vorher = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    for (const key of keys) process.env[key] = 'veraltet';
    zugangSetzen(zugang);
    assert.equal(process.env.UPSTASH_REDIS_REST_URL, zugang.url);
    assert.equal(process.env.UPSTASH_REDIS_REST_TOKEN, zugang.token);
    assert.equal(process.env.KV_REST_API_URL, undefined);
    assert.equal(process.env.KV_REST_API_TOKEN, undefined);
  } finally {
    for (const key of keys) {
      if (vorher[key] === undefined) delete process.env[key]; else process.env[key] = vorher[key];
    }
  }
});

test('HTTP-Auslieferung: echte Adapter-Schnittstelle, Dateien und geschuetzte Pfade', async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'handy-http-'));
  const dist = path.join(dir, 'dist');
  await mkdir(path.join(dist, 'games', 'arena'), { recursive: true });
  await mkdir(path.join(dist, 'assets'));
  await mkdir(path.join(dist, 'offline'));
  await writeFile(path.join(dist, 'index.html'), '<h1>Hideout</h1>');
  await writeFile(path.join(dist, 'games', 'arena', 'index.html'), 'Arena');
  await writeFile(path.join(dist, 'assets', 'app.hash.js'), '/* bundle */');
  await writeFile(path.join(dist, 'offline', 'spiel.html'), 'Offline');
  await writeFile(path.join(dir, 'server.env'), 'geheim');
  await writeFile(path.join(dist, '.env'), 'auch geheim');
  const aufrufe = [];
  const handler = (name) => async (req) => {
    aufrufe.push({ name, method: req.method, body: await req.text(), url: req.url, header: req.headers.get('x-test') });
    if (new URL(req.url).search === '?fehler') throw new Error('SECRET-123');
    return Response.json({ name }, { status: 201, headers: { 'x-antwort': 'ja' } });
  };
  const server = await serverErstellen({ dist, room: handler('room'), gehstockmon: handler('mon'), bodyLimit: 128 });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port;
  let res = await fetch(base + '/');
  assert.equal(res.status, 200);
  assert.equal(await res.text(), '<h1>Hideout</h1>');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  res = await fetch(base + '/games/arena/');
  assert.equal(await res.text(), 'Arena');
  res = await fetch(base + '/assets/app.hash.js', { method: 'HEAD' });
  assert.equal(res.status, 200);
  assert.equal(await res.text(), '');
  assert.match(res.headers.get('cache-control'), /immutable/);
  res = await fetch(base + '/offline/spiel.html');
  assert.equal(res.headers.get('content-disposition'), 'attachment');
  await res.text();
  for (const route of ['/api/room', '/.netlify/functions/room', '/api/gehstockmon', '/.netlify/functions/gehstockmon']) {
    res = await fetch(base + route + '?probe=1', { method: 'POST', body: '{"op":"status"}', headers: { 'x-test': 'ja' } });
    assert.equal(res.status, 201);
    assert.equal(res.headers.get('x-antwort'), 'ja');
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.equal((await res.json()).name, route.endsWith('room') ? 'room' : 'mon');
    assert.equal(aufrufe.at(-1).body, '{"op":"status"}');
    assert.equal(aufrufe.at(-1).header, 'ja');
    assert.match(aufrufe.at(-1).url, /\?probe=1$/);
  }
  for (const route of ['/.env', '/%2eenv', '/%2e%2e%2fserver.env', '/..%5cserver.env', '/api/unbekannt', '/server.env']) {
    res = await fetch(base + route);
    assert.equal(res.status, 404, route);
    assert.doesNotMatch(await res.text(), /geheim/);
  }
  res = await fetch(base + '/%zz');
  assert.equal(res.status, 400);
  await res.text();
  res = await fetch(base + '/', { method: 'POST' });
  assert.equal(res.status, 405);
  await res.text();
  res = await fetch(base + '/api/room', { method: 'POST', body: 'a'.repeat(129) });
  assert.equal(res.status, 413);
  await res.text();
  assert.equal(aufrufe.length, 4, 'zu grosse Anfrage gelangt nicht zum Handler');
  res = await fetch(base + '/api/room?fehler', { method: 'POST' });
  assert.equal(res.status, 500);
  assert.doesNotMatch(await res.text(), /SECRET/);
  // Junctions funktionieren auch ohne Windows-Symlink-Privilegien.
  await symlink(dir, path.join(dist, 'ausserhalb'), process.platform === 'win32' ? 'junction' : 'dir');
  res = await fetch(base + '/ausserhalb/server.env');
  assert.equal(res.status, 404);
  await res.text();
});
