/* ------------------------------------------------------------------
   Tests fuer das Online-Match von Gehstock Ops (shooter/server/).

   Echte Verbindungen ueber localhost: ein kleiner HTTP-Server mit dem
   Online-Match, dazu Geraete als Node-WebSocket - roh (nur Protokoll)
   oder mit der echten Vorhersage (shooter/src/netz/online.js).

   Laeuft in tools/test.mjs mit (also auch vor jedem Handy-Update),
   einzeln: node tools/shooter-online-tests.mjs
   ------------------------------------------------------------------ */

import http from 'node:http';
import net from 'node:net';
import crypto from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { OpsOnline } from '../shooter/server/online.mjs';
import { OnlineSpiel } from '../shooter/src/netz/online.js';
import * as P from '../shooter/src/netz/protokoll.js';
import { kraehenfeld } from '../shooter/src/karte/kraehenfeld.js';
import { Welt } from '../shooter/src/sim/welt.js';
import { Navigation } from '../shooter/src/sim/navigation.js';
import { Simulation } from '../shooter/src/sim/simulation.js';
import { neuerBefehl, T_DUCKEN, T_FEUER, T_SPRINGEN, T_SPRINT, T_VISIER } from '../shooter/src/sim/befehl.js';
import { augenhoehe } from '../shooter/src/sim/bewegung.js';
import { yawZu } from '../shooter/src/sim/mathe.js';
import { LEBEN, TICK } from '../shooter/src/konfig.js';

function pruefe(b, text) {
  if (!b) throw new Error(text);
}

const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const STILL_TEST = 7100;          // etwas ueber der Stille, ab der das Geraet neu verbindet

async function bis(f, text, ms) {
  const t0 = Date.now();
  while (!f()) {
    if (Date.now() - t0 > (ms || 10000)) throw new Error('Zeit abgelaufen: ' + text);
    await warte(5);
  }
}

let karteWelt = null;
function welt() {
  if (!karteWelt) {
    const karte = kraehenfeld();
    karteWelt = { karte, welt: new Welt(karte.quader.filter((q) => q.kollision)) };
  }
  return karteWelt;
}

async function aufbauen(opt) {
  const ops = new OpsOnline({ log: () => {}, ...(opt || {}) });
  const server = http.createServer((req, res) => {
    res.end(JSON.stringify(ops.status()));
  });
  server.on('upgrade', (req, socket, head) => {
    socket.on('error', () => socket.destroy());
    if (req.url === P.PFAD) ops.upgrade(req, socket, head);
    else socket.destroy();
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  return {
    ops, port,
    adresse: 'ws://127.0.0.1:' + port + P.PFAD,
    async zu() {
      ops.schliessen();
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
    },
  };
}

/* Geraet, das nur das Protokoll spricht. */
function roh(adresse, name, o) {
  const opt = o || {};
  const c = { ws: new WebSocket(adresse), id: -1, roster: null, z: null, typen: [], zu: 0, zustaende: 0 };
  c.ws.binaryType = 'arraybuffer';
  c.ws.onopen = () => {
    const s = new P.Schreiber();
    P.halloSchreiben(s, name, opt.waffe || 'sturmgewehr', opt.schluessel);
    if (opt.version !== undefined) s.dv.setUint16(1, opt.version);
    c.ws.send(s.kopie());
  };
  c.ws.onmessage = (e) => {
    const l = new P.Leser(e.data);
    const typ = l.u8();
    c.typen.push(typ);
    if (typ === P.S_WILLKOMMEN) { l.u16(); c.id = l.u8(); l.u32(); c.schluessel = l.text(); }
    else if (typ === P.S_ROSTER) c.roster = P.rosterLesen(l, { plaetze: [] });
    else if (typ === P.S_ZUSTAND) { c.z = P.zustandLesen(l, P.neuerZustand()); c.zustaende++; }
  };
  c.ws.onclose = (e) => { c.zu = e.code || 1; };
  return c;
}

function menschen(roster) {
  return roster.plaetze.filter((p) => p.mensch);
}

/* Roher WebSocket-Handschlag, um Rahmen von Hand zu schicken. */
async function tcp(port) {
  const sock = net.connect(port, '127.0.0.1');
  await new Promise((r) => sock.once('connect', r));
  const key = crypto.randomBytes(16).toString('base64');
  sock.write('GET ' + P.PFAD + ' HTTP/1.1\r\nHost: 127.0.0.1:' + port + '\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
    + 'Sec-WebSocket-Key: ' + key + '\r\nSec-WebSocket-Version: 13\r\n\r\n');
  const t = { sock, daten: Buffer.alloc(0), zu: false };
  sock.on('data', (d) => { t.daten = Buffer.concat([t.daten, d]); });
  sock.on('close', () => { t.zu = true; });
  sock.on('error', () => { t.zu = true; });
  await bis(() => t.daten.includes('\r\n\r\n'), 'Handschlag');
  pruefe(t.daten.toString('latin1').startsWith('HTTP/1.1 101'), 'kein 101');
  t.daten = t.daten.subarray(t.daten.indexOf('\r\n\r\n') + 4);
  return t;
}

function rahmen(art, nutz, fin, maskiert) {
  const m = crypto.randomBytes(4);
  const kopf = Buffer.from([(fin === false ? 0 : 0x80) | art, (maskiert === false ? 0 : 0x80) | nutz.length]);
  const n = Buffer.from(nutz);
  if (maskiert !== false) for (let i = 0; i < n.length; i++) n[i] ^= m[i & 3];
  return maskiert === false ? Buffer.concat([kopf, n]) : Buffer.concat([kopf, m, n]);
}

export async function shooterOnlineTests(test) {
  await test('Ops online: Protokoll überträgt Befehle und Zustände verlustfrei', async () => {
    const s = new P.Schreiber(8);
    const b = P.befehlQuantisieren({ yaw: 12.345, pitch: -0.3333, vor: 0.77, seit: -1.4, tasten: T_FEUER | T_SPRINT | 64 });
    P.eingabeSchreiben(s, 4000000000, 123.5, [b, b], 2);
    const l = new P.Leser(s.kopie());
    pruefe(l.u8() === P.C_EINGABE && l.u32() === 4000000000 && l.f32() === 123.5 && l.u8() === 2, 'Kopf');
    const c = P.befehlLesen(l, neuerBefehl());
    pruefe(c.yaw === b.yaw && c.pitch === b.pitch && c.vor === b.vor && c.seit === b.seit && c.tasten === b.tasten, 'Befehl nicht gleich');
    pruefe(b.seit === -1 && b.tasten === (T_FEUER | T_SPRINT) && Math.abs(b.yaw) <= Math.PI, 'Befehl nicht gerundet');

    const { karte, welt: w } = welt();
    const nav = new Navigation(w, karte.grenzen);
    const sim = new Simulation({ karte, welt: w, nav, seed: 5, online: true, ohneVorlauf: true });
    for (let i = 0; i < 120; i++) sim.schritt(TICK);
    const a = sim.akteure[4];
    a.waffe.rueckHoch = 1.2345678901;
    const z = new P.Schreiber();
    P.zustandKopfSchreiben(z, sim, 777);
    let m = 0;
    const meldungen = new P.Schreiber();
    for (const e of sim.meldungen) if (P.meldungSchreiben(meldungen, e)) m++;
    z.u8(m);
    z.anhaengen(meldungen.ansicht());
    P.eigenSchreiben(z, a, 99);
    const g = new P.Leser(z.kopie());
    pruefe(g.u8() === P.S_ZUSTAND, 'Typ');
    const r = P.zustandLesen(g, P.neuerZustand());
    pruefe(g.rest() === 0, 'Reste in der Nachricht');
    pruefe(r.takt === 777 && r.ack === 99 && r.eigenId === 4 && r.n === 6 && r.m === m, 'Kopf des Zustands');
    for (let i = 0; i < 6; i++) {
      const q = sim.akteure[i], d = r.akteure[i];
      pruefe(Math.abs(q.x - d.x) < 1e-4 && Math.abs(q.z - d.z) < 1e-4 && d.lebt === q.lebt && d.waffe === q.waffe.id, 'Figur ' + i);
    }
    pruefe(r.eigen.x === a.x && r.eigen.vz === a.vz && r.eigen.waffe.rueckHoch === a.waffe.rueckHoch
      && r.eigen.waffe.magazin === a.waffe.magazin, 'eigene Figur nicht exakt');
    let kaputt = false;
    try { P.zustandLesen(new P.Leser(z.kopie().subarray(0, 40)), P.neuerZustand()); } catch (e) { kaputt = true; }
    pruefe(kaputt, 'abgeschnittene Nachricht wird nicht erkannt');
  });

  await test('Ops online: zwei Spieler in verschiedenen Teams, Bots füllen auf, wer geht, wird zum Bot', async () => {
    const S = await aufbauen();
    try {
      const a = roh(S.adresse, 'Anna');
      await bis(() => a.id >= 0 && a.roster, 'Anna drin');
      const b = roh(S.adresse, 'Ben');
      await bis(() => b.id >= 0 && b.roster, 'Ben drin');
      await bis(() => a.roster && menschen(a.roster).length === 2, 'Roster bei Anna');
      const m = menschen(a.roster);
      pruefe(m[0].team !== m[1].team, 'beide im selben Team');
      pruefe(a.roster.plaetze.length === 6 && a.roster.plaetze.filter((p) => p.team === 0).length === 3, 'nicht drei gegen drei');
      pruefe(S.ops.status().spieler === 2, 'Status zaehlt falsch');
      await bis(() => a.zustaende > 2, 'Zustaende kommen');
      b.ws.close();
      await bis(() => S.ops.status().spieler === 1 && menschen(a.roster).length === 1, 'Ben wird zum Bot');
      pruefe(a.roster.plaetze.find((p) => p.id === b.id).name !== 'Ben', 'Bot heisst noch wie Ben');
      a.ws.close();
      await bis(() => S.ops.status().spieler === 0 && S.ops.timer === null, 'Takt steht ohne Spieler');
    } finally {
      await S.zu();
    }
  });

  await test('Ops online: sechs passen hinein, der siebte bekommt „voll“, ein alter Stand wird abgewiesen', async () => {
    const S = await aufbauen();
    try {
      const alle = [];
      for (let i = 0; i < 6; i++) {
        alle.push(roh(S.adresse, i < 2 ? 'Max' : 'Spieler\u0007 ' + i));
        await bis(() => alle[i].id >= 0, 'Spieler ' + i);
      }
      await bis(() => alle[0].roster && menschen(alle[0].roster).length === 6, 'alle sechs im Roster');
      const r = alle[0].roster;
      pruefe(new Set(alle.map((c) => c.id)).size === 6, 'Plaetze doppelt vergeben');
      pruefe(menschen(r).filter((p) => p.team === 0).length === 3, 'Teams nicht 3:3');
      const namen = menschen(r).map((p) => p.name);
      pruefe(namen.includes('Max') && namen.includes('Max 2'), 'Namen nicht eindeutig: ' + namen.join(','));
      pruefe(namen.every((n) => !/[\u0000-\u001f]/.test(n)), 'Steuerzeichen im Namen');
      const sieben = roh(S.adresse, 'Sieben');
      await bis(() => sieben.zu, 'Siebter wird getrennt');
      pruefe(sieben.typen.includes(P.S_VOLL) && sieben.zu === 4002, 'kein "voll" (' + sieben.zu + ')');
      const alt = roh(S.adresse, 'Alt', { version: P.VERSION + 1 });
      await bis(() => alt.zu, 'alter Stand wird getrennt');
      pruefe(alt.typen.includes(P.S_ALT) && alt.zu === 4001, 'kein "alt"');
      pruefe(S.ops.status().spieler === 6, 'Abgewiesene zaehlen mit');
      for (const c of alle) c.ws.close();
      await bis(() => S.ops.status().spieler === 0, 'alle weg');
    } finally {
      await S.zu();
    }
  });

  await test('Ops online: die Vorhersage auf dem Gerät rechnet Bit für Bit wie der Server', async () => {
    // Schneller als in Echtzeit - dafuer Drossel und Nachrichtenzahl hoch
    const S = await aufbauen({ ohneVorlauf: true, kontingentMax: 100000, nachrichtenRate: 100000, nachrichtenVorrat: 100000 });
    try {
      const { karte, welt: w } = welt();
      const spiel = new OnlineSpiel({ karte, welt: w, name: 'Test', waffe: 'mp', adresse: S.adresse });
      spiel.verbinden();
      await bis(() => spiel.zustand === 'drin', 'verbunden');
      // Bots stehen still, damit niemand die Testfigur umschiesst.
      for (const b of S.ops.raum.sim.akteure) if (b.bot) b.ki = null;
      const bef = neuerBefehl();
      let yaw = spiel.ich.yaw;
      for (let n = 1; n <= 480; n++) {
        yaw += 0.013;
        bef.yaw = yaw;
        bef.pitch = Math.sin(n / 40) * 0.3;
        bef.vor = n % 200 < 150 ? 1 : -0.6;
        bef.seit = Math.sin(n / 25) * 0.7;
        bef.tasten = 0;
        if (n % 70 === 0) bef.tasten |= T_SPRINGEN;
        if (n > 40 && n < 160) bef.tasten |= T_SPRINT;
        if (n > 170 && n < 300) bef.tasten |= T_FEUER | T_VISIER;
        if (n > 320 && n < 380) bef.tasten |= T_DUCKEN;
        spiel.schritt(bef);
        if (n % 12 === 0) {
          await warte(2);
          spiel.bild(0.016);
        }
      }
      spiel.abschicken();
      await bis(() => spiel.ack === spiel.nr, 'alle Befehle bestaetigt');
      await warte(80);
      const ich = spiel.ich;
      const srv = S.ops.raum.sim.akteure[spiel.eigenId];
      pruefe(srv.lebt && ich.lebt, 'Testfigur tot');
      pruefe(spiel.korrekturen === 0, spiel.korrekturen + ' Korrekturen');
      pruefe(ich.x === srv.x && ich.y === srv.y && ich.z === srv.z, 'Lage weicht ab: ' + Math.hypot(ich.x - srv.x, ich.z - srv.z));
      pruefe(ich.waffe.magazin === srv.waffe.magazin && ich.waffe.schuesse === srv.waffe.schuesse
        && ich.waffe.schuesse > 10, 'Waffe weicht ab');
      spiel.trennen();
    } finally {
      await S.zu();
    }
  });

  await test('Ops online: Treffer zählen, wo der Schütze den Gegner gesehen hat – höchstens 250 ms zurück', async () => {
    const S = await aufbauen({ ohneVorlauf: true, kontingentMax: 100000 });
    try {
      const a = roh(S.adresse, 'Schuetze');
      const b = roh(S.adresse, 'Ziel');
      await bis(() => a.id >= 0 && b.id >= 0, 'beide drin');
      const ops = S.ops;
      clearInterval(ops.timer);            // Takt von Hand
      ops.timer = null;
      const raum = ops.raum;
      const sim = raum.sim;
      for (const x of sim.akteure) if (x.bot) { x.ki = null; x.lebt = false; x.respawnIn = 999; }
      const A = sim.akteure[a.id], B = sim.akteure[b.id];
      const sp = raum.spieler.get(a.id);
      // Offene Linie auf dem Gelaende (z = 6.5)
      const setze = (f, x, z) => { f.x = x; f.z = z; f.y = 0; f.vx = f.vy = f.vz = 0; f.lebt = true; f.schutz = 0; f.leben = LEBEN.max; };
      setze(A, -8, 6.5);
      setze(B, 4, 6.5);
      pruefe(sim.welt.sichtFrei(A.x, 1.6, A.z, 4, 1.2, 6.5) && sim.welt.sichtFrei(A.x, 1.6, A.z, 4, 1.2, 8.2), 'keine freie Linie');
      A.waffe.visier = 1;
      A.waffe.bloom = 0;
      const zielen = (x, z) => {
        const auge = A.y + augenhoehe(A);
        const bef = neuerBefehl();
        bef.yaw = yawZu(x - A.x, z - A.z);
        bef.pitch = Math.atan2(B.y + 1.2 - auge, Math.hypot(x - A.x, z - A.z));
        bef.tasten = T_FEUER | T_VISIER;
        return P.befehlQuantisieren(bef);
      };
      const schuss = (sicht, x, z) => {
        B.leben = LEBEN.max;
        A.waffe.abkling = 0;
        A.waffe.rueckHoch = 0;
        A.waffe.rueckSeite = 0;
        A.waffe.bloom = 0;
        A.waffe.magazin = A.waffe.def.magazin;
        A.tastenVorher = 0;
        const s = new P.Schreiber();
        P.eingabeSchreiben(s, sp.ack + 1, sicht, [zielen(x, z)], 1);
        const l = new P.Leser(s.kopie());
        l.u8();
        raum.eingabe(sp, l);
        A.tastenVorher = 0;
        return B.leben < LEBEN.max;
      };
      for (let i = 0; i < 20; i++) raum.schritt();
      B.z = 8.2;                           // jetzt steht B knapp zwei Meter weiter
      for (let i = 0; i < 8; i++) raum.schritt();
      const damals = raum.takt - 10;     // gut 160 ms her: B stand noch bei z = 6.5
      pruefe(schuss(damals, 4, 6.5), 'kein Treffer, obwohl B dort gesehen wurde');
      pruefe(!schuss(raum.takt, 4, 6.5), 'Treffer ins Leere (B steht laengst woanders)');
      pruefe(schuss(raum.takt, 4, 8.2), 'kein Treffer auf die aktuelle Lage');
      // Laenger als 250 ms her: nicht mehr zurueckgespult
      for (let i = 0; i < 30; i++) raum.schritt();
      pruefe(!schuss(raum.takt - 25, 4, 6.5), 'zu weit zurueckgespult');
      pruefe(B.z === 8.2 && B.x === 4, 'Rueckspulen hat B nicht zurueckgestellt');
      a.ws.close();
      b.ws.close();
    } finally {
      await S.zu();
    }
  });

  await test('Ops online: Runden laufen durch – Ende, Pause, neue Runde mit Teamausgleich', async () => {
    const S = await aufbauen({ ohneVorlauf: true, dauer: 0.4, rundenPause: 0.25 });
    try {
      const c = [roh(S.adresse, 'Eins'), roh(S.adresse, 'Zwei'), roh(S.adresse, 'Drei')];
      await bis(() => c.every((x) => x.id >= 0) && c[0].roster && menschen(c[0].roster).length === 3, 'drei drin');
      const teams = menschen(c[0].roster).map((p) => p.team);
      pruefe(Math.abs(teams.filter((t) => t === 0).length - teams.filter((t) => t === 1).length) === 1, 'nicht 2:1');
      // Wer allein im Team ist, geht - dann steht es 2:0 ...
      const r = c[0].roster;
      const allein = menschen(r).find((p) => menschen(r).filter((q) => q.team === p.team).length === 1);
      const geht = c.find((x) => x.id === allein.id);
      geht.ws.close();
      const bleiben = c.filter((x) => x !== geht);
      await bis(() => menschen(bleiben[0].roster).length === 2 && bleiben[0].z, 'einer weg');
      const runde0 = bleiben[0].z.runde;
      // ... und die naechste Runde gleicht aus.
      await bis(() => bleiben[0].z && bleiben[0].z.runde >= runde0 + 2, 'neue Runden');
      const m = menschen(bleiben[0].roster);
      pruefe(m[0].team !== m[1].team, 'kein Teamausgleich zur neuen Runde');
      pruefe(bleiben[0].z.punkte[0] + bleiben[0].z.punkte[1] <= 2, 'Punkte nicht zurueckgesetzt');
      for (const x of bleiben) x.ws.close();
    } finally {
      await S.zu();
    }
  });

  await test('Ops online: kaputte Nachrichten trennen nur den Absender, zerteilte Rahmen und Ping gehen', async () => {
    const S = await aufbauen();
    try {
      const gut = roh(S.adresse, 'Gut');
      await bis(() => gut.id >= 0, 'Gut drin');
      // Zerteilte Nachricht (HALLO in zwei Stuecken) und ein Ping dazwischen
      const t = await tcp(S.port);
      const hallo = Buffer.from(P.halloSchreiben(new P.Schreiber(), 'Stueck', 'mp'));
      t.sock.write(rahmen(2, hallo.subarray(0, 3), false));
      t.sock.write(rahmen(9, Buffer.from('hi')));
      t.sock.write(rahmen(0, hallo.subarray(3), true));
      await bis(() => t.daten.includes(Buffer.from([0x8a, 2])) && t.daten.includes(Buffer.from([0x82])), 'Pong und Willkommen');
      const w = t.daten.indexOf(Buffer.from([P.S_WILLKOMMEN, 0, P.VERSION]));
      pruefe(w >= 2 && t.daten[w - 2] === 0x82, 'kein Willkommen nach zerteilter Nachricht');
      // Unmaskierter Rahmen: Protokollfehler, Verbindung zu
      t.sock.write(rahmen(2, Buffer.from([P.C_ECHO, 1, 2]), true, false));
      await bis(() => t.zu, 'unmaskiert nicht getrennt');
      // Unsinn nach dem Hallo, zu grosse Nachricht
      const u = roh(S.adresse, 'Unsinn');
      await bis(() => u.id >= 0, 'Unsinn drin');
      u.ws.send(new Uint8Array([99, 1, 2, 3]));
      await bis(() => u.zu, 'Unsinn nicht getrennt');
      pruefe(u.zu === 1008, 'falscher Code ' + u.zu);
      const g = roh(S.adresse, 'Gross');
      await bis(() => g.id >= 0, 'Gross drin');
      g.ws.send(new Uint8Array(5000));
      await bis(() => g.zu, 'zu grosse Nachricht nicht getrennt');
      pruefe(g.zu === 1009, 'falscher Code ' + g.zu);
      // Kaputte Zahl im Befehl
      const k = roh(S.adresse, 'Kaputt');
      await bis(() => k.id >= 0, 'Kaputt drin');
      const s = new P.Schreiber();
      P.eingabeSchreiben(s, 1, 0, [neuerBefehl()], 1);
      const b = s.kopie();
      new DataView(b.buffer).setFloat32(10, NaN);
      k.ws.send(b);
      await bis(() => k.zu, 'NaN nicht getrennt');
      // Der Gute merkt davon nichts
      const vorher = gut.zustaende;
      await bis(() => gut.zustaende > vorher + 3, 'Gut bekommt weiter Zustaende');
      pruefe(!gut.zu, 'Gut wurde getrennt');
      gut.ws.close();
      await bis(() => S.ops.status().spieler === 0, 'alle weg');
    } finally {
      await S.zu();
    }
  });

  await test('Ops online: zu schnell geschickte Befehle verfallen (kein Speedhack), Stau nach Aussetzern trennt nicht', async () => {
    const S = await aufbauen({ ohneVorlauf: true });
    try {
      const a = roh(S.adresse, 'Hase');
      await bis(() => a.id >= 0 && a.zustaende > 0, 'drin');
      for (const b of S.ops.raum.sim.akteure) if (b.bot) b.ki = null;
      const A = S.ops.raum.sim.akteure[a.id];
      const x0 = A.x, z0 = A.z;
      const s = new P.Schreiber();
      const befehle = [];
      for (let i = 0; i < 8; i++) befehle.push(P.befehlQuantisieren({ yaw: 0, pitch: 0, vor: 1, seit: 0, tasten: 0 }));
      // 1200 Befehle (20 Sekunden Laufen) auf einmal: angenommen werden nur
      // die vier Sekunden Vorrat, der Rest verfaellt.
      for (let i = 0; i < 150; i++) a.ws.send(P.eingabeSchreiben(s, 1 + i * 8, 0, befehle, 8).slice());
      await bis(() => S.ops.raum.spieler.get(a.id).ack === 1200, 'alle angekommen');
      const weg = Math.hypot(A.x - x0, A.z - z0);
      pruefe(S.ops.raum.spieler.get(a.id).gedrosselt > 900, 'nichts gedrosselt');
      pruefe(weg < 30, 'zu weit gelaufen: ' + weg.toFixed(1) + ' m (ohne Grenze gut 100 m)');
      // Ein Stau von 300 Nachrichten (zehn Sekunden Funkloch) trennt nicht
      for (let i = 0; i < 300; i++) a.ws.send(P.eingabeSchreiben(s, 1201 + i * 2, 0, befehle, 2).slice());
      await bis(() => S.ops.raum.spieler.get(a.id).ack === 1800, 'Stau angekommen');
      await warte(100);
      pruefe(!a.zu, 'nach einem Stau getrennt (' + a.zu + ')');
      a.ws.close();
    } finally {
      await S.zu();
    }
  });

  await test('Ops online: wer die Leitung verliert, bekommt mit dem Schlüssel Platz und Punkte zurück, „Tschüss“ hält nichts frei', async () => {
    const S = await aufbauen({ reservierung: 1500 });
    try {
      const a = roh(S.adresse, 'Anna');
      await bis(() => a.id >= 0 && a.schluessel, 'Anna drin');
      const b = roh(S.adresse, 'Ben');
      await bis(() => b.id >= 0 && b.roster, 'Ben drin');
      const raum = S.ops.raum;
      const A = raum.sim.akteure[a.id];
      const team = A.team;
      A.abschuesse = 5; A.tode = 2;
      // Funkloch: die Leitung reisst ohne Tschuess ab
      a.ws.close();
      await bis(() => S.ops.status().spieler === 1, 'Anna raus');
      pruefe(raum.reserviert.has(a.schluessel), 'kein Platz freigehalten');
      pruefe(!raum.sim.akteure[a.id].fern && raum.sim.akteure[a.id].name !== 'Anna', 'der Platz ist nicht zum Bot geworden');
      // Wer neu dazukommt, bekommt den freigehaltenen Platz nicht
      const c = roh(S.adresse, 'Carl');
      await bis(() => c.id >= 0, 'Carl drin');
      pruefe(c.id !== a.id, 'Carl sitzt auf dem freigehaltenen Platz');
      // Mit dem Schluessel zurueck: gleicher Platz, gleiches Team, alte Punkte
      const a2 = roh(S.adresse, 'Anna', { schluessel: a.schluessel });
      await bis(() => a2.id >= 0, 'Anna wieder drin');
      pruefe(a2.id === a.id && a2.schluessel === a.schluessel, 'nicht derselbe Platz');
      pruefe(A.fern && A.team === team && A.name === 'Anna' && A.abschuesse === 5 && A.tode === 2, 'Punkte oder Team verloren');
      pruefe(S.ops.status().spieler === 3 && !raum.reserviert.size, 'Zahl oder Reservierung falsch');
      // Die alte Leitung haengt noch halb offen: sie weicht der neuen
      const a3 = roh(S.adresse, 'Anna', { schluessel: a.schluessel });
      await bis(() => a3.id >= 0 && a2.zu, 'alte Leitung nicht ersetzt');
      pruefe(a2.zu === 4003 && a3.id === a.id && A.abschuesse === 5, 'falsch ersetzt (' + a2.zu + ')');
      pruefe(S.ops.status().spieler === 3, 'doppelt gezaehlt');
      // Absichtlich gehen: nichts wird freigehalten
      a3.ws.send(P.tschuessSchreiben(new P.Schreiber()).slice());
      await bis(() => a3.zu && S.ops.status().spieler === 2, 'Tschuess');
      pruefe(a3.zu === 1000 && !raum.reserviert.size, 'nach Tschuess freigehalten');
      // Die Reservierung laeuft ab
      b.ws.close();
      await bis(() => raum.reserviert.has(b.schluessel), 'Ben freigehalten');
      await warte(1600);
      const b2 = roh(S.adresse, 'Ben', { schluessel: b.schluessel });
      await bis(() => b2.id >= 0, 'Ben wieder drin');
      pruefe(b2.schluessel !== b.schluessel && !raum.reserviert.size, 'abgelaufene Reservierung gilt noch');
      c.ws.close(); b2.ws.close();
    } finally {
      await S.zu();
    }
  });

  await test('Ops online: das Gerät verbindet sich nach einem Abriss und nach einem Serverneustart selbst wieder', async () => {
    const S = await aufbauen({ ohneVorlauf: true });
    let S2 = null;
    try {
      const { karte, welt: w } = welt();
      const stati = [];
      const spiel = new OnlineSpiel({ karte, welt: w, name: 'Zaeh', waffe: 'mp', adresse: S.adresse, beiStatus: (z) => stati.push(z) });
      spiel.verbinden();
      await bis(() => spiel.zustand === 'drin', 'verbunden');
      const id = spiel.eigenId;
      S.ops.raum.sim.akteure[id].abschuesse = 3;
      // 1. Die Leitung reisst (wie ein Funkloch): gleicher Platz, alte Punkte
      spiel.ws.close();
      await bis(() => spiel.zustand === 'wieder', 'merkt den Abriss nicht');
      await bis(() => spiel.zustand === 'drin', 'nicht wieder verbunden');
      pruefe(spiel.eigenId === id && S.ops.raum.sim.akteure[id].abschuesse === 3 && S.ops.status().spieler === 1, 'nicht derselbe Platz');
      // 2. Die Seite hing (Hintergrund, Haenger): Liegengebliebenes bekommt
      //    erst Nachfrist, der Waechter schlaegt nicht sofort an ...
      spiel.stille = 6000;
      spiel.bildUhr = performance.now() - 9000;
      spiel.bild(0.016);
      pruefe(spiel.zustand === 'drin', 'Waechter schlaegt nach einem Haenger der Seite zu frueh an');
      // ... ruckelt sie aber dauernd, zaehlen die Haenger trotzdem mit.
      spiel.ws.onmessage = null;
      for (let i = 0; i < 20 && spiel.zustand === 'drin'; i++) {
        spiel.bildUhr = performance.now() - 3000;
        spiel.bild(0.016);
      }
      pruefe(spiel.zustand === 'wieder', 'dauerndes Ruckeln haelt den Waechter ewig auf');
      await bis(() => spiel.zustand === 'drin', 'nach Ruckeln nicht wieder verbunden');
      // 3. Halb offene Leitung: nichts kommt mehr an, der Browser merkt es nicht
      const tot = spiel.ws;
      tot.onmessage = null;
      spiel.stille = STILL_TEST;
      spiel.bild(0.016);
      pruefe(spiel.zustand === 'wieder', 'Waechter schlaegt nicht an');
      await bis(() => spiel.zustand === 'drin', 'nach Waechter nicht wieder verbunden');
      pruefe(spiel.eigenId === id && S.ops.status().spieler === 1, 'Waechter: nicht derselbe Platz');
      // 4. Der Server startet neu (jeder Push auf main): das Geraet kommt wieder
      await S.zu();
      await bis(() => spiel.zustand === 'wieder', 'merkt den Neustart nicht');
      await warte(300);
      S2 = await aufbauen({ ohneVorlauf: true });
      spiel.o.adresse = S2.adresse;       // anderer Port, sonst gleich
      await bis(() => spiel.zustand === 'drin', 'nach Neustart nicht wieder verbunden', 15000);
      pruefe(S2.ops.status().spieler === 1 && spiel.ich === spiel.spiegel.akteure[spiel.eigenId], 'neue Runde ohne eigene Figur');
      // Weiterspielen geht: Befehle werden bestaetigt
      const bef = neuerBefehl();
      bef.vor = 1;
      for (let n = 0; n < 30; n++) spiel.schritt(bef);
      spiel.abschicken();
      await bis(() => spiel.ack === spiel.nr, 'Befehle nach Neustart nicht bestaetigt');
      pruefe(stati.filter((z) => z === 'wieder').length === 4 && !stati.includes('weg') && !stati.includes('fehler'), 'Zustaende: ' + stati.join(','));
      spiel.trennen();
      await bis(() => S2.ops.status().spieler === 0, 'Trennen');
      pruefe(!S2.ops.raum.reserviert.size, 'nach Trennen freigehalten');
    } finally {
      await S.zu().catch(() => {});
      if (S2) await S2.zu();
    }
  });

  await test('Ops online: bleibt der Server weg, meldet das Gerät nach den Versuchen „Verbindung weg“ statt zu hängen', async () => {
    const S = await aufbauen({ ohneVorlauf: true });
    const { karte, welt: w } = welt();
    const stati = [];
    const spiel = new OnlineSpiel({ karte, welt: w, name: 'Weg', waffe: 'mp', adresse: S.adresse,
      neuVerbinden: [30, 60, 90], beiStatus: (z) => stati.push(z) });
    spiel.verbinden();
    await bis(() => spiel.zustand === 'drin', 'verbunden');
    await S.zu();
    // Drei Versuche gegen einen geschlossenen Port, dann ist Schluss
    await bis(() => spiel.zustand === 'weg', 'gibt nie auf', 5000);
    pruefe(!spiel.ws && spiel.versuch === 3, 'Leitung haengt noch oder falsch gezaehlt (' + spiel.versuch + ')');
    pruefe(stati.join(',') === 'verbinde,warte,drin,wieder,weg', 'Zustaende: ' + stati.join(','));
    // Der erste Versuch ohne Server scheitert schnell mit "fehler"
    const neu = new OnlineSpiel({ karte, welt: w, name: 'Neu', waffe: 'mp', adresse: S.adresse, beiStatus: (z) => stati.push(z) });
    const t0 = Date.now();
    neu.verbinden();
    await bis(() => neu.zustand === 'fehler', 'erster Versuch haengt', 8000);
    pruefe(Date.now() - t0 < 5000 && !neu.ws, 'dauert ' + (Date.now() - t0) + ' ms');
  });
}

/* Einzeln ausfuehrbar */
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  let ok = 0, schlecht = 0;
  const test = async (name, fn) => {
    const t0 = performance.now();
    try {
      await fn();
      ok++;
      console.log('  ok   ' + name + '  (' + Math.round(performance.now() - t0) + ' ms)');
    } catch (e) {
      schlecht++;
      console.log('  FAIL ' + name + '  -> ' + e.message);
    }
  };
  console.log('\nGehstock Ops online');
  await shooterOnlineTests(test);
  console.log('\n' + ok + ' bestanden, ' + schlecht + ' durchgefallen\n');
  process.exit(schlecht ? 1 : 0);
}
