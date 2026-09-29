/* ------------------------------------------------------------------
   Lasttest fuer das Online-Match von Gehstock Ops.

   Wie viel Rechenzeit kostet eine volle Online-Runde (sechs Menschen,
   dazu keine Bots mehr - oder weniger Menschen plus Bots)? Laeuft auf
   dem Handy selbst und fasst nichts Echtes an: ein eigener Server im
   Kindprozess auf einem freien Port, davor N Spieler, die sich wie echte
   Geraete verhalten (30 Nachrichten pro Sekunde mit je zwei Befehlen:
   laufen, drehen, springen, schiessen).

   Gemessen werden die Rechenlast des Serverprozesses (Anteil eines
   Kerns), die Dauer eines Simulationsschritts und die Datenmenge je
   Spieler. Nicht enthalten: Caddy, WLAN und Internet.

   Aufruf (Termux oder PC):
     node tools/shooter-lasttest.mjs [spieler=6] [sekunden=30]
   ------------------------------------------------------------------ */

import http from 'node:http';
import { fork } from 'node:child_process';
import { monitorEventLoopDelay, performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

const schlaf = (ms) => new Promise((ok) => setTimeout(ok, ms));

/* ================================================ Serverseite (Kindprozess) */
if (process.argv[2] === '--server') {
  const { OpsOnline } = await import('../shooter/server/online.mjs');
  const P = await import('../shooter/src/netz/protokoll.js');
  const ops = new OpsOnline({ log: () => {} });
  const server = http.createServer((req, res) => res.end(JSON.stringify(ops.status())));
  server.on('upgrade', (req, socket, head) => {
    socket.on('error', () => socket.destroy());
    if (req.url === P.PFAD) ops.upgrade(req, socket, head);
    else socket.destroy();
  });
  server.listen(0, '127.0.0.1', () => process.send({ port: server.address().port }));
  const schleife = monitorEventLoopDelay({ resolution: 5 });
  let cpu0 = null, t0 = 0;
  const schritte = [];
  process.on('message', (m) => {
    if (m === 'start') {
      // Jeden Simulationsschritt stoppen
      const raum = ops.raum;
      const schritt = raum.schritt.bind(raum);
      raum.schritt = () => {
        const a = performance.now();
        schritt();
        schritte.push(performance.now() - a);
      };
      schleife.enable();
      cpu0 = process.cpuUsage();
      t0 = performance.now();
    } else if (m === 'stopp') {
      const cpu = process.cpuUsage(cpu0);
      const dauer = (performance.now() - t0) * 1000;
      schritte.sort((a, b) => a - b);
      const mittel = schritte.reduce((s, x) => s + x, 0) / Math.max(1, schritte.length);
      process.send({
        cpu: (cpu.user + cpu.system) / dauer,
        schritte: schritte.length,
        mittel,
        p99: schritte[Math.floor(schritte.length * 0.99)] || 0,
        max: schritte[schritte.length - 1] || 0,
        schleifeP99: schleife.percentile(99) / 1e6,
        menschen: ops.status().spieler,
      });
      ops.schliessen();
      server.close();
      setTimeout(() => process.exit(0), 200);
    }
  });
} else {
  /* ============================================== Spielerseite */
  const P = await import('../shooter/src/netz/protokoll.js');
  const { T_FEUER, T_SPRINGEN, T_SPRINT, T_VISIER } = await import('../shooter/src/sim/befehl.js');
  const anzahl = Math.max(1, Math.min(6, Number(process.argv[2]) || 6));
  const sekunden = Math.max(5, Number(process.argv[3]) || 30);

  const kind = fork(fileURLToPath(import.meta.url), ['--server']);
  const port = await new Promise((ok) => kind.once('message', (m) => ok(m.port)));
  const adresse = 'ws://127.0.0.1:' + port + P.PFAD;
  console.log('\nGehstock Ops online: ' + anzahl + ' Spieler, ' + sekunden + ' s\n');

  const spieler = [];
  for (let i = 0; i < anzahl; i++) {
    const s = { ws: new WebSocket(adresse), bytes: 0, zustaende: 0, drin: false, nr: 0, yaw: Math.random() * 6 };
    s.ws.binaryType = 'arraybuffer';
    s.ws.onopen = () => s.ws.send(P.halloSchreiben(new P.Schreiber(), 'Last ' + (i + 1), ['sturmgewehr', 'mp', 'schrotflinte'][i % 3]).slice());
    s.ws.onmessage = (e) => {
      s.bytes += e.data.byteLength;
      const typ = new Uint8Array(e.data)[0];
      if (typ === P.S_WILLKOMMEN) s.drin = true;
      else if (typ === P.S_ZUSTAND) s.zustaende++;
    };
    spieler.push(s);
    await schlaf(100);
  }
  while (!spieler.every((s) => s.drin)) await schlaf(50);

  // Wie ein Geraet: alle 33 ms zwei Befehle
  const schreiber = new P.Schreiber();
  const befehle = [{ yaw: 0, pitch: 0, vor: 0, seit: 0, tasten: 0 }, { yaw: 0, pitch: 0, vor: 0, seit: 0, tasten: 0 }];
  let takt = 0;
  const senden = setInterval(() => {
    takt++;
    for (const s of spieler) {
      for (const b of befehle) {
        s.yaw += (Math.random() - 0.5) * 0.08;
        b.yaw = s.yaw;
        b.pitch = Math.sin(takt / 30) * 0.2;
        b.vor = 1;
        b.seit = Math.sin(takt / 20 + s.yaw);
        b.tasten = (takt % 90 < 30 ? T_FEUER | T_VISIER : takt % 90 < 60 ? T_SPRINT : 0) | (takt % 45 === 0 ? T_SPRINGEN : 0);
        P.befehlQuantisieren(b);
      }
      s.ws.send(P.eingabeSchreiben(schreiber, s.nr + 1, 0, befehle, 2).slice());
      s.nr += 2;
    }
  }, 1000 / 30);

  await schlaf(2000);                      // einschwingen
  for (const s of spieler) { s.bytes = 0; s.zustaende = 0; }
  kind.send('start');
  await schlaf(sekunden * 1000);
  const erg = await new Promise((ok) => { kind.once('message', ok); kind.send('stopp'); });
  clearInterval(senden);
  for (const s of spieler) s.ws.close();

  const proSpieler = spieler.reduce((n, s) => n + s.bytes, 0) / spieler.length / sekunden;
  const zustaende = spieler.reduce((n, s) => n + s.zustaende, 0) / spieler.length / sekunden;
  console.log('  Rechenlast Server   : ' + (erg.cpu * 100).toFixed(1) + ' % eines Kerns');
  console.log('  Simulationsschritt  : Mittel ' + erg.mittel.toFixed(3) + ' ms, 99 % unter ' + erg.p99.toFixed(3) + ' ms, max ' + erg.max.toFixed(2) + ' ms (' + erg.schritte + ' Schritte)');
  console.log('  Ereignisschleife    : 99 % der Verzoegerungen unter ' + erg.schleifeP99.toFixed(1) + ' ms');
  console.log('  Zustaende je Spieler: ' + zustaende.toFixed(1) + ' pro Sekunde');
  console.log('  Daten je Spieler    : ' + (proSpieler / 1024).toFixed(1) + ' kB/s zum Geraet');
  console.log('  Menschen in der Runde: ' + erg.menschen + '\n');
  process.exit(0);
}
