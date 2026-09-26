/* ------------------------------------------------------------------
   Lasttest fuer das Handy: Wie kommt es mit N gleichzeitigen Spielern klar?

   Laeuft auf dem Handy selbst und fasst die echte Spielerwelt nicht an:
   Ein zweiter redis-server ohne Speicherung (Port 6390) bekommt eine
   Kopie der GehstockMon-Welt, davor laufen derselbe Uebersetzer und
   derselbe Server wie im Betrieb - nur auf eigenen Ports. Die Spieler
   verhalten sich wie tools/kontingent-messen.mjs (Hideout offen,
   GehstockMon mit Laufen und Stehen, etwas Chat) und gehen echt ueber
   HTTP. Gemessen werden Antwortzeiten und die Rechenlast des Servers.

   Nicht enthalten: Caddy, WLAN und Internet - also nur, was das Handy
   selbst leisten muss.

   Aufruf (Termux):
     node tools/handy-lasttest.mjs [spieler=10] [sekunden=120]
   ------------------------------------------------------------------ */

import os from 'node:os';
import path from 'node:path';
import { fork, spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { verbindung, gatewayErstellen, redisEnvLesen } from './handy-redis.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const schlaf = (ms) => new Promise((ok) => setTimeout(ok, ms));
/* Eine Stunde, in der GehstockMon geoeffnet hat - der Test laeuft auch am Wochenende. */
const OFFEN = Date.parse('2026-09-23T10:00:00+02:00');

/* ================================================ Serverseite (Kindprozess) */
if (process.argv[2] === '--server') {
  const { redisPort, redisPass } = JSON.parse(process.argv[3]);
  const token = randomBytes(24).toString('hex');
  const neu = () => verbindung({ port: redisPort, passwort: redisPass });
  const gw = gatewayErstellen({ token, redis: neu(), neueVerbindung: neu });
  await new Promise((ok) => gw.listen(0, '127.0.0.1', ok));
  process.env.UPSTASH_REDIS_REST_URL = 'http://127.0.0.1:' + gw.address().port;
  process.env.UPSTASH_REDIS_REST_TOKEN = token;
  delete process.env.KV_REST_API_URL; delete process.env.KV_REST_API_TOKEN;

  const { serverErstellen } = await import('./handy-server.mjs');
  const room = (await import('../netlify/functions/room.mjs')).default;
  const { createHandler } = await import('../netlify/functions/gehstockmon.mjs');
  const start = Date.now();
  const gehstockmon = createHandler({ now: () => OFFEN + (Date.now() - start) });
  const server = await serverErstellen({ dist: path.join(ROOT, 'dist'), room, gehstockmon });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));

  const schleife = monitorEventLoopDelay({ resolution: 10 });
  let cpu0, t0;
  process.on('message', (m) => {
    if (m === 'start') { cpu0 = process.cpuUsage(); t0 = process.hrtime.bigint(); schleife.reset(); schleife.enable(); }
    if (m === 'ende') {
      const cpu = process.cpuUsage(cpu0), dauerUs = Number(process.hrtime.bigint() - t0) / 1000;
      process.send({ cpu: (cpu.user + cpu.system) / dauerUs, rss: process.memoryUsage().rss,
        lag99: schleife.percentile(99) / 1e6, lagMax: schleife.max / 1e6 });
      setTimeout(() => process.exit(0), 100);
    }
  });
  process.send({ port: server.address().port });
} else {
  /* ============================================== Spielerseite (Hauptprozess) */
  const n = Number(process.argv[2] || 10), dauer = Number(process.argv[3] || 120) * 1000;
  const cfg = await redisEnvLesen(path.join(os.homedir(), '.config', 'gehstock1', 'redis.env'));
  /* LASTTEST_REDIS_PORT/_PASS: vorhandenen Test-Redis nutzen (fuer Pruefungen am PC). */
  const fremd = Number(process.env.LASTTEST_REDIS_PORT || 0);
  const testPort = fremd || 6390, testPass = fremd ? process.env.LASTTEST_REDIS_PASS : randomBytes(16).toString('hex');
  let redis = null, server = null;
  const aufraeumen = () => { server?.kill(); redis?.kill(); };
  process.on('exit', aufraeumen);

  try {
    /* Wegwerf-Redis: keine Datei, kein AOF, verschwindet mit dem Test. */
    if (!fremd) {
      redis = spawn('redis-server', ['--port', String(testPort), '--bind', '127.0.0.1', '--requirepass', testPass,
        '--save', '', '--appendonly', 'no', '--daemonize', 'no'], { stdio: 'ignore' });
      redis.on('error', () => {});
    }
    const test = verbindung({ port: testPort, passwort: testPass });
    for (let i = 0; i < 20; i++) { if ((await test.befehl(['PING'])) === 'PONG') break; await schlaf(250); }

    /* Nur die GehstockMon-Welt kopieren: Ihre Groesse bestimmt die Rechenarbeit.
       Die echte Welt wird dabei nur gelesen. */
    const echt = verbindung({ port: cfg.redisPort, passwort: cfg.passwort });
    const welt = await echt.befehl(['GET', 'hgh:hgh-gehstockmon:world-v2']);
    echt.schliessen();
    if (welt instanceof Error) throw welt;
    if (Buffer.isBuffer(welt)) await test.befehl(['SET', 'hgh:hgh-gehstockmon:world-v2', welt]);
    console.log('Kopie der GehstockMon-Welt: ' + (Buffer.isBuffer(welt) ? Math.round(welt.length / 1024) + ' KB' : 'keine, leere Welt'));
    test.schliessen();

    server = fork(fileURLToPath(import.meta.url), ['--server', JSON.stringify({ redisPort: testPort, redisPass: testPass })]);
    const nachricht = () => new Promise((ok) => server.once('message', ok));
    const { port } = await nachricht();
    const basis = 'http://127.0.0.1:' + port;

    const CODES = [];
    for (let z = 0; z < 10000 && CODES.length < n; z++) {
      const c = String(z).padStart(4, '0'), t = 'code:' + c + ':gehstock:hideout:2026:kellergewoelbe';
      let h = 0x811c9dc5;
      for (const ch of t) { h ^= ch.charCodeAt(0); h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0; }
      if (h % 97 === 0) CODES.push(c);
    }

    const zeiten = {}, fehler = {};
    let messen = false;
    async function rufe(pfad, body, art) {
      const t = performance.now();
      let j = {};
      try {
        const res = await fetch(basis + pfad, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        j = await res.json().catch(() => ({}));
        if (!res.ok && !j.error) j.error = 'HTTP ' + res.status;
      } catch (e) { j = { error: 'keine Antwort' }; }
      if (messen) {
        (zeiten[art] ||= []).push(performance.now() - t);
        if (j.error) fehler[j.error] = (fehler[j.error] || 0) + 1;
      }
      return j;
    }

    const beigetreten = {};
    for (let i = 0; i < n; i++) {
      for (let v = 0; v < 5 && !beigetreten[i]; v++) {
        const j = await rufe('/api/gehstockmon', { op: 'join', code: CODES[i], name: 'Test' + i }, 'join');
        if (j.spawn) beigetreten[i] = j;
      }
      if (!beigetreten[i]) throw new Error('Testspieler ' + i + ' kam nicht in die Welt');
    }

    const bis = Date.now() + dauer;
    async function fenster(i) {
      await schlaf(Math.random() * 10000);
      const ich = { code: CODES[i], name: 'Test' + i, rolle: 'S' };
      let since = 0, psince = 0, verw = 0, kv = 0, ruhe = 2000;
      while (Date.now() < bis) {
        const r = await rufe('/api/room', { op: 'sync', kurz: true, geraet: 'g' + i, art: 'iPad', ich, wo: '#/', since, psince, befehl: 0, kanaele: { kreis: kv }, verw }, 'Hideout-Abgleich');
        since = Math.max(since, r.version || 0); psince = Math.max(psince, r.pv || 0);
        if (r.verw && r.verw.version) verw = r.verw.version;
        if (r.kanaele && r.kanaele.kreis) kv = r.kanaele.kreis.version;
        ruhe = r.kanaele || r.verw || r.befehle ? 2000 : Math.min(15000, Math.round(ruhe * 1.5));
        await schlaf(Math.min(ruhe, Math.max(0, bis - Date.now())));
      }
    }
    async function spieler(i) {
      const code = CODES[i], s = beigetreten[i].spawn;
      let x = s.x, richtung = 1, letzteWelt = Date.now(), letzteMeldung = 0, gemeldet = x;
      while (Date.now() < bis) {
        const laeuft = (Math.floor(Date.now() / 1000) + i * 7) % 50 < 20;
        if (laeuft) { x += richtung * 5.5; if (Math.abs(x - s.x) > 12) richtung = -richtung; }
        const takt = Math.abs(x - gemeldet) > 0.3 ? 3000 : 5000;
        if (Date.now() - letzteMeldung >= takt) {
          letzteMeldung = Date.now();
          const r = await rufe('/api/gehstockmon', { op: 'presence', code, position: { x, z: s.z, heading: richtung > 0 ? 1.57 : -1.57 } }, 'GehstockMon-Position');
          if (r.positionCorrected && r.position) x = r.position.x;
          gemeldet = x;
        }
        if (Date.now() - letzteWelt > 30000) { letzteWelt = Date.now(); await rufe('/api/gehstockmon', { op: 'world', code }, 'GehstockMon-Welt laden'); }
        await schlaf(500);
      }
    }
    async function plaudern() {
      while (Date.now() < bis) {
        await schlaf(30000);
        if (Date.now() >= bis) break;
        const k = Math.floor(Math.random() * n);
        await rufe('/api/room', { op: 'chat:post', brett: 'kreis', text: 'hallo', von: 'Test' + k, code: CODES[k], rolle: 'S' }, 'Chat');
      }
    }

    console.log(n + ' Testspieler in der Welt. Messe ' + dauer / 1000 + ' Sekunden ...');
    server.send('start'); messen = true;
    const jobs = [plaudern()];
    for (let i = 0; i < n; i++) jobs.push(fenster(i), spieler(i));
    await Promise.all(jobs);
    messen = false;
    server.send('ende');
    const last = await nachricht();

    const q = (a, p) => a[Math.min(a.length - 1, Math.floor(a.length * p))];
    let alle = [];
    console.log('\nAntwortzeiten (ms)            Anzahl   Median   95 %    langsamste');
    for (const [art, a] of Object.entries(zeiten)) {
      a.sort((x, y) => x - y); alle = alle.concat(a);
      console.log('  ' + art.padEnd(26) + String(a.length).padStart(7) + String(Math.round(q(a, 0.5))).padStart(9)
        + String(Math.round(q(a, 0.95))).padStart(8) + String(Math.round(a[a.length - 1])).padStart(12));
    }
    alle.sort((x, y) => x - y);
    console.log('\nAnfragen pro Sekunde   ' + (alle.length / (dauer / 1000)).toFixed(1));
    console.log('Rechenlast Server      ' + Math.round(last.cpu * 100) + ' % eines Kerns (das Handy hat ' + os.cpus().length + ')');
    console.log('Arbeitsspeicher        ' + Math.round(last.rss / 1024 / 1024) + ' MB');
    console.log('Stau im Server         99 % unter ' + Math.round(last.lag99) + ' ms, schlimmster ' + Math.round(last.lagMax) + ' ms');
    console.log('Fehler                 ' + (Object.keys(fehler).length ? JSON.stringify(fehler) : 'keine'));
    console.log('\nDie echte Spielerwelt wurde nur gelesen. Test-Redis und Testserver sind wieder beendet.');
  } catch (e) {
    console.log('Lasttest abgebrochen: ' + String(e && e.message || e).split('\n')[0]);
    process.exitCode = 1;
  } finally { aufraeumen(); }
}
