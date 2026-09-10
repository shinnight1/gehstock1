/* Kleiner Entwicklungsserver.
 *
 * Liefert dist/ aus und bildet /api/room nach, damit alles Online-
 * seitige auch ohne Netlify getestet werden kann: Spielraeume, Chat,
 * Bilder, Umfragen, Verwaltung, Anwesenheit, Bildschirme, Protokoll,
 * Befehle.
 *
 * Gleiche Schnittstelle wie netlify/functions/room.mjs, nur im
 * Arbeitsspeicher - und ohne Warteschleife: hier wird ein Warter
 * direkt geweckt, sobald sich etwas aendert.
 *
 *   node tools/serve.mjs [port]
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHandler as createMonHandler } from '../netlify/functions/gehstockmon.mjs';
import { devStore as monStore } from './gehstockmon-dev-store.mjs';
const monHandler = createMonHandler({ store: monStore() });

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.argv[2] || process.env.PORT || 8787);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const POLL_MS = 7500;
const CHAT_MAX = 250;
const PROTO_MAX = 400;

/* ------------------------------------------------------------ Zustand */

const welt = {
  version: 1,
  pv: 1,
  kanaele: {},
  verw: 0,
  pix: 0,
  praesenz: {},
  spiegelAn: [],
  spiegelBis: {},
  spiegelV: {},
  befehle: [],
  bfId: 0,
};

const kanaele = new Map();      // name -> { version, nachrichten }
const rooms = new Map();
const bilder = new Map();       // id -> { data, mini, w, h }
const schirme = new Map();      // code -> { data, wo, name, t }
let verw = { version: 0, daten: {} };

/* Die gemeinsame Pixel-Weltkarte. Wie im Netlify-Relais: ein
   Dokument mit allen Feldern, dazu ein kurzes Protokoll, damit
   niemand fuer einen Punkt die ganze Karte laden muss. */
const PIX_LOG = 400;
const PIX_MAX = 60000;
let wplace = { version: 0, pixel: {}, log: [] };

function pixAntwort(since) {
  const log = wplace.log;
  const aeltester = log.length ? log[0].v : wplace.version + 1;
  if (since > 0 && since >= aeltester - 1 && since <= wplace.version) {
    const striche = [];
    for (const e of log) if (e.v > since) for (const p of e.s) striche.push(p);
    return { version: wplace.version, striche, teil: true };
  }
  return { version: wplace.version, pixel: wplace.pixel, teil: false };
}

let warter = [];                // offene sync-Anfragen

const GEHEIM = 'gehstock:hideout:2026:kellergewoelbe';
const RASTER = 97;

function streu(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
  }
  return h >>> 0;
}

function codeGueltig(code) {
  const c = String(code || '').replace(/\D/g, '');
  if (c.length !== 4) return false;
  return streu('code:' + c + ':' + GEHEIM) % RASTER === 0;
}

function kanalName(roh) {
  return String(roh || 'kreis').replace(/[^a-z0-9_:-]/gi, '').slice(0, 40) || 'kreis';
}

function kanalVon(name) {
  if (!kanaele.has(name)) kanaele.set(name, { version: 0, nachrichten: [] });
  return kanaele.get(name);
}

function putzen() {
  const jetzt = Date.now();
  for (const g of Object.keys(welt.praesenz)) {
    if (jetzt - (welt.praesenz[g].t || 0) > 90000) delete welt.praesenz[g];
  }
  welt.befehle = welt.befehle.filter((b) => jetzt - b.t < 5 * 60 * 1000);
  welt.spiegelAn = welt.spiegelAn.filter((c) => (welt.spiegelBis[c] || 0) > jetzt);
}

function bump(p) {
  putzen();
  if (p) welt.pv++; else welt.version++;
  wecken();
}

function wecken() {
  const liste = warter;
  warter = [];
  for (const w of liste) {
    clearTimeout(w.timer);
    const a = pruefen(w.msg);
    if (a) { send(w.res, 200, a); continue; }
    /* Fuer diesen war nichts dabei - er wartet weiter. Wichtig: die Uhr
       neu stellen. Ohne das haette er gar keine mehr und bliebe fuer
       immer offen; nach ein paar Runden waeren alle Verbindungen des
       Browsers belegt und die Seite laedt nicht mehr. */
    warten(w);
  }
}

function warten(w) {
  const rest = Math.max(200, w.bis - Date.now());
  w.timer = setTimeout(() => {
    warter = warter.filter((x) => x !== w);
    send(w.res, 200, { version: welt.version, pv: welt.pv, leer: true });
  }, rest);
  warter.push(w);
}

/* ------------------------------------------------------------ sync */

function pruefen(msg) {
  const ich = msg.ich && typeof msg.ich === 'object' ? msg.ich : null;
  const geraet = String(msg.geraet || '');
  const antwort = { version: welt.version, pv: welt.pv };
  let etwas = false;

  const wKan = (msg.kanaele && typeof msg.kanaele === 'object') ? msg.kanaele : {};
  const kOut = {};
  for (const name of Object.keys(wKan)) {
    const k = kanalName(name);
    if ((welt.kanaele[k] || 0) > (Number(wKan[name]) || 0)) {
      kOut[k] = kanalVon(k);
      etwas = true;
    }
  }
  if (Object.keys(kOut).length) antwort.kanaele = kOut;

  if (msg.verw !== undefined && welt.verw > (Number(msg.verw) || 0)) {
    antwort.verw = verw;
    etwas = true;
  }

  if (msg.pix !== undefined && welt.pix > (Number(msg.pix) || 0)) {
    antwort.pix = pixAntwort(Number(msg.pix) || 0);
    etwas = true;
  }

  if (msg.raum && msg.raum.code) {
    const c = String(msg.raum.code).toUpperCase();
    if ((welt.kanaele['raum:' + c] || 0) > (Number(msg.raum.since) || 0)) {
      const r = rooms.get(c);
      antwort.raum = r ? publicRoom(r) : { closed: true, reason: 'room_gone' };
      etwas = true;
    }
  }

  const bf = welt.befehle.filter((b) => {
    if (b.id <= (Number(msg.befehl) || 0)) return false;
    if (b.ziel === '*') return true;
    if (ich && b.ziel === String(ich.code)) return true;
    return b.ziel === geraet;
  });
  if (bf.length) { antwort.befehle = bf; etwas = true; }

  if (msg.praesenz && welt.pv > (Number(msg.psince) || 0)) {
    antwort.praesenz = Object.keys(welt.praesenz).map((g) => welt.praesenz[g]);
    antwort.spiegelAn = welt.spiegelAn;
    antwort.spiegelV = welt.spiegelV;
    etwas = true;
  }

  const wSchirm = (msg.schirme && typeof msg.schirme === 'object') ? msg.schirme : {};
  for (const c of Object.keys(wSchirm)) {
    if ((welt.spiegelV[c] || 0) > (Number(wSchirm[c]) || 0)) {
      antwort.schirme = antwort.schirme || {};
      const b = schirme.get(c);
      if (b) antwort.schirme[c] = b;
      etwas = true;
    }
  }

  const beobachtet = !!(ich && welt.spiegelAn.indexOf(String(ich.code)) >= 0);
  antwort.spiegelMich = beobachtet;
  if (beobachtet && !msg._nichtErsteRunde) etwas = true;

  if (etwas || welt.version > (Number(msg.since) || 0)) return antwort;
  msg._nichtErsteRunde = true;
  return null;
}

function sync(res, msg) {
  const ich = msg.ich && typeof msg.ich === 'object' ? msg.ich : null;
  const geraet = String(msg.geraet || '');
  if (geraet && ich && codeGueltig(ich.code)) {
    const alt = welt.praesenz[geraet];
    const neu = {
      code: String(ich.code).slice(0, 4),
      name: String(ich.name || '').slice(0, 24),
      rolle: String(ich.rolle || 'S').slice(0, 1),
      wo: String(msg.wo || '').slice(0, 40),
      geraet: geraet,
      art: String(msg.art || '').slice(0, 24),
      t: Date.now(),
    };
    /* Wecken nur, wenn sich wirklich etwas geaendert hat. Ein blosses
       Auffrischen des Zeitstempels muss niemanden stoeren. */
    const anders = !alt || alt.wo !== neu.wo || alt.code !== neu.code
      || alt.name !== neu.name || alt.rolle !== neu.rolle;
    if (anders) { welt.praesenz[geraet] = neu; bump(true); }
    else if (Date.now() - alt.t > 45000) { welt.praesenz[geraet] = neu; putzen(); }
  }

  const sofort = pruefen(msg);
  if (sofort) return send(res, 200, sofort);

  warten({ res, msg, timer: null, bis: Date.now() + POLL_MS });

  /* Bricht der Client ab (Seitenwechsel, anstossen()), soll der Warter
     nicht bis zum Ende der Uhr liegen bleiben. */
  res.on('close', () => {
    const w = warter.filter((x) => x.res === res)[0];
    if (w) { clearTimeout(w.timer); warter = warter.filter((x) => x !== w); }
  });
  return undefined;
}

/* ------------------------------------------------------------ Kanaele */

function chatPost(res, msg) {
  const brett = kanalName(msg.brett);
  const text = String(msg.text || '').slice(0, 1000);
  const hatBild = msg.bild && typeof msg.bild === 'object';
  const hatUmfrage = msg.umfrage && typeof msg.umfrage === 'object';
  const hatZusatz = msg.zusatz && typeof msg.zusatz === 'object';
  if (!text.trim() && !hatBild && !hatUmfrage && !hatZusatz) {
    return send(res, 400, { error: 'leer' });
  }
  const k = kanalVon(brett);
  k.version++;
  const n = {
    id: k.version,
    von: String(msg.von || 'Unbekannt').slice(0, 24),
    code: codeGueltig(msg.code) ? String(msg.code) : '',
    rolle: String(msg.rolle || 'S').slice(0, 1),
    text,
    t: Date.now(),
  };
  if (hatBild) {
    n.bild = { id: String(msg.bild.id || ''), w: Number(msg.bild.w) || 0, h: Number(msg.bild.h) || 0 };
  }
  if (hatUmfrage) {
    n.umfrage = {
      frage: String(msg.umfrage.frage || '').slice(0, 200),
      optionen: (msg.umfrage.optionen || []).slice(0, 8).map((o) => String(o || '').slice(0, 80)),
      mehrfach: !!msg.umfrage.mehrfach,
      offen: msg.umfrage.offen !== false,
      stimmen: {},
    };
  }
  if (hatZusatz) n.zusatz = msg.zusatz;
  k.nachrichten.push(n);
  const grenze = brett === 'protokoll' ? PROTO_MAX : CHAT_MAX;
  if (k.nachrichten.length > grenze) k.nachrichten = k.nachrichten.slice(-grenze);
  welt.kanaele[brett] = (welt.kanaele[brett] || 0) + 1;
  bump(false);
  return send(res, 200, { version: k.version, nachrichten: k.nachrichten, neu: n });
}

function chatVote(res, msg) {
  const brett = kanalName(msg.brett);
  const code = String(msg.code || '');
  if (!codeGueltig(code)) return send(res, 403, { error: 'kein_code' });
  const k = kanalVon(brett);
  const n = k.nachrichten.find((x) => x.id === (Number(msg.id) || 0));
  if (n && n.umfrage && n.umfrage.offen) {
    const wahl = Array.isArray(msg.wahl) ? msg.wahl.map(Number) : [Number(msg.wahl)];
    const g = wahl.filter((i) => i >= 0 && i < n.umfrage.optionen.length);
    if (!g.length) delete n.umfrage.stimmen[code];
    else n.umfrage.stimmen[code] = n.umfrage.mehrfach ? g : [g[0]];
    k.version++;
    welt.kanaele[brett] = (welt.kanaele[brett] || 0) + 1;
    bump(false);
  }
  return send(res, 200, { version: k.version, nachrichten: k.nachrichten });
}

function chatDel(res, msg) {
  const brett = kanalName(msg.brett);
  const k = kanalVon(brett);
  const n = k.nachrichten.find((x) => x.id === (Number(msg.id) || 0));
  if (!n || n.weg) return send(res, 200, { ok: false });
  const entfernt = { von: n.von, text: n.text, bild: !!n.bild, umfrage: !!n.umfrage };
  n.weg = { von: String(msg.von || 'Admin').slice(0, 24), t: Date.now() };
  n.text = '';
  delete n.bild;
  delete n.umfrage;
  k.version++;
  welt.kanaele[brett] = (welt.kanaele[brett] || 0) + 1;
  bump(false);
  return send(res, 200, { version: k.version, nachrichten: k.nachrichten, entfernt });
}

const PATCH_ERLAUBT = ['status', 'erledigtVon', 'erledigtT', 'notiz', 'offen'];

function chatPatch(res, msg) {
  const brett = kanalName(msg.brett);
  const k = kanalVon(brett);
  const n = k.nachrichten.find((x) => x.id === (Number(msg.id) || 0));
  const feld = msg.feld && typeof msg.feld === 'object' ? msg.feld : {};
  if (n) {
    for (const f of PATCH_ERLAUBT) {
      if (!(f in feld)) continue;
      if (f === 'offen') { if (n.umfrage) n.umfrage.offen = !!feld.offen; }
      else n[f] = feld[f];
    }
    k.version++;
    welt.kanaele[brett] = (welt.kanaele[brett] || 0) + 1;
    bump(false);
  }
  return send(res, 200, { version: k.version, nachrichten: k.nachrichten });
}

/* ------------------------------------------------------------ Raeume */

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function newCode() {
  let c;
  do {
    c = '';
    for (let i = 0; i < 6; i++) c += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  } while (rooms.has(c));
  return c;
}

function publicRoom(room) {
  return {
    code: room.code,
    seed: room.seed,
    version: room.version,
    log: room.log,
    started: room.started,
    meta: room.meta || {},
    players: room.players.map((p) => ({
      id: p.id, name: p.name, seat: p.seat, connected: Date.now() - p.seen < 30000,
    })),
  };
}

function raumBump(code, room) {
  if (room) welt.kanaele['raum:' + code] = room.version;
  else delete welt.kanaele['raum:' + code];
  bump(false);
}

function raum(res, op, msg) {
  if (op === 'create') {
    const code = newCode();
    const p = {
      id: 'p' + Math.random().toString(36).slice(2, 9),
      token: Math.random().toString(36).slice(2),
      name: String(msg.name || 'Spieler').slice(0, 14), seat: 0, seen: Date.now(),
    };
    const room = {
      code, game: msg.game, seats: Math.max(2, Math.min(8, msg.seats || 2)),
      seed: (Math.random() * 0x7fffffff) | 0,
      version: 1, log: [], started: false, players: [p], meta: msg.opts || {},
      created: Date.now(), updated: Date.now(),
    };
    rooms.set(code, room);
    raumBump(code, room);
    return send(res, 200, Object.assign(publicRoom(room), {
      playerId: p.id, token: p.token, seat: 0, isHost: true,
    }));
  }

  const code = String(msg.code || '').toUpperCase();
  const room = rooms.get(code);
  if (!room) return send(res, 404, { error: 'room_not_found' });

  if (op === 'join') {
    if (msg.game && room.game !== msg.game) return send(res, 409, { error: 'game_mismatch' });
    if (room.players.length >= room.seats) return send(res, 409, { error: 'room_full' });
    const p = {
      id: 'p' + Math.random().toString(36).slice(2, 9),
      token: Math.random().toString(36).slice(2),
      name: String(msg.name || 'Spieler').slice(0, 14),
      seat: room.players.length, seen: Date.now(),
    };
    room.players.push(p);
    room.version++;
    room.updated = Date.now();
    raumBump(code, room);
    return send(res, 200, Object.assign(publicRoom(room), {
      playerId: p.id, token: p.token, seat: p.seat, isHost: false,
    }));
  }

  const me = room.players.find((p) => p.id === msg.playerId && p.token === msg.token);
  if (!me) return send(res, 403, { error: 'bad_token' });

  if (op === 'resume') {
    return send(res, 200, Object.assign(publicRoom(room), { seat: me.seat, isHost: me.seat === 0 }));
  }

  if (op === 'ping') { me.seen = Date.now(); return send(res, 200, { ok: true }); }

  if (op === 'start') {
    me.seen = Date.now();
    room.started = true;
    room.meta = Object.assign(room.meta || {}, msg.meta || {});
    room.version++;
    room.updated = Date.now();
    raumBump(code, room);
    return send(res, 200, publicRoom(room));
  }

  if (op === 'act') {
    me.seen = Date.now();
    room.log.push({ seat: me.seat, a: msg.action, t: Date.now() });
    room.version++;
    room.updated = Date.now();
    raumBump(code, room);
    return send(res, 200, publicRoom(room));
  }

  if (op === 'leave') {
    room.players = room.players.filter((p) => p.id !== me.id);
    room.version++;
    if (!room.players.length) { rooms.delete(code); raumBump(code, null); }
    else raumBump(code, room);
    return send(res, 200, { ok: true });
  }

  if (op === 'poll') {
    // Alter Client - einmal antworten, damit er nicht in einer Schleife haengt
    return send(res, 200, publicRoom(room));
  }

  return send(res, 400, { error: 'bad_op' });
}

/* ------------------------------------------------------------ Verteiler */

function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(body);
}

function handleRoom(req, res, body) {
  let msg;
  try { msg = JSON.parse(body || '{}'); } catch { return send(res, 400, { error: 'bad_json' }); }
  const op = String(msg.op || '');

  if (op === 'sync') return sync(res, msg);

  if (op === 'chat:post') return chatPost(res, msg);
  if (op === 'chat:vote') return chatVote(res, msg);
  if (op === 'chat:del') return chatDel(res, msg);
  if (op === 'chat:patch') return chatPatch(res, msg);
  if (op === 'chat:read') {
    const k = kanalVon(kanalName(msg.brett));
    return send(res, 200, { version: k.version, nachrichten: k.nachrichten });
  }

  if (op === 'log') {
    const e = msg.eintrag || {};
    return chatPost(res, {
      brett: 'protokoll', von: msg.von, code: msg.code, rolle: msg.rolle,
      text: String(e.text || ''),
      zusatz: { art: String(e.art || 'info'), ziel: String(e.ziel || ''), wo: String(e.wo || '') },
    });
  }

  if (op === 'bild:put') {
    if (!msg.data) return send(res, 400, { error: 'zu_gross' });
    const id = Math.random().toString(36).slice(2, 14);
    bilder.set(id, { data: msg.data, mini: msg.mini || '', w: msg.w || 0, h: msg.h || 0 });
    return send(res, 200, { id });
  }
  if (op === 'bild:get') {
    const b = bilder.get(String(msg.id || ''));
    if (!b) return send(res, 404, { error: 'kein_bild' });
    return send(res, 200, msg.mini ? { data: b.mini || b.data } : { data: b.data, w: b.w, h: b.h });
  }

  if (op === 'schirm:will') {
    const bis = Date.now() + 60000;
    for (const c of (msg.codes || []).slice(0, 12)) {
      const k = String(c).replace(/\D/g, '').slice(0, 4);
      if (!codeGueltig(k)) continue;
      welt.spiegelBis[k] = bis;
      if (welt.spiegelAn.indexOf(k) < 0) welt.spiegelAn.push(k);
    }
    bump(true);
    return send(res, 200, { ok: true });
  }
  if (op === 'schirm:put') {
    const c = String(msg.code || '').replace(/\D/g, '').slice(0, 4);
    if (!codeGueltig(c)) return send(res, 403, { error: 'kein_code' });
    schirme.set(c, {
      code: c, data: String(msg.data || ''), wo: String(msg.wo || ''),
      name: String(msg.name || ''), w: msg.w || 0, h: msg.h || 0, t: Date.now(),
    });
    welt.spiegelV[c] = (welt.spiegelV[c] || 0) + 1;
    bump(true);
    return send(res, 200, { ok: true });
  }
  if (op === 'schirm:get') {
    return send(res, 200, schirme.get(String(msg.code || '')) || { leer: true });
  }

  if (op === 'befehl') {
    welt.bfId++;
    welt.befehle.push({
      id: welt.bfId, ziel: String(msg.ziel || '*'), art: String(msg.art || ''),
      von: String(msg.von || ''), text: String(msg.text || ''),
      daten: msg.daten || null, t: Date.now(),
    });
    bump(false);
    return send(res, 200, { ok: true, id: welt.bfId });
  }

  if (op === 'verw:write') {
    verw = { version: verw.version + 1, daten: msg.daten || {}, t: Date.now() };
    welt.verw = verw.version;
    bump(false);
    return send(res, 200, verw);
  }
  if (op === 'verw:read') return send(res, 200, verw);

  if (op === 'pix:write') {
    const roh = Array.isArray(msg.striche) ? msg.striche.slice(0, 400) : [];
    const striche = [];
    for (const p of roh) {
      const n = Number(p && p.n);
      const c = Number(p && p.c);
      if (!Number.isInteger(n) || n < 0 || n >= 720 * 360) continue;
      if (!Number.isInteger(c) || c < 0 || c > 32) continue;
      striche.push({ n, c });
    }
    if (!striche.length) return send(res, 400, { error: 'leer' });
    for (const p of striche) {
      if (p.c === 0) delete wplace.pixel[p.n];
      else if (Object.keys(wplace.pixel).length < PIX_MAX
               || wplace.pixel[p.n] !== undefined) wplace.pixel[p.n] = p.c;
    }
    wplace.version++;
    wplace.log.push({
      v: wplace.version, s: striche,
      von: String(msg.von || '').slice(0, 24),
      code: String(msg.code || '').slice(0, 4), t: Date.now(),
    });
    if (wplace.log.length > PIX_LOG) wplace.log = wplace.log.slice(-PIX_LOG);
    welt.pix = wplace.version;
    bump(false);
    return send(res, 200, { ok: true, version: wplace.version });
  }
  if (op === 'pix:read') return send(res, 200, pixAntwort(Number(msg.since) || 0));

  return raum(res, op, msg);
}

/* ------------------------------------------------------------ Server */

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    });
    return res.end();
  }

  if (url.pathname === '/api/room' || url.pathname === '/.netlify/functions/room') {
    let body = '';
    req.on('data', (d) => { body += d; });
    req.on('end', () => handleRoom(req, res, body));
    return undefined;
  }

  if (url.pathname === '/api/gehstockmon' || url.pathname === '/.netlify/functions/gehstockmon') {
    let body = '', tooLarge = false;
    req.on('data', (d) => { body += d; if (body.length > 24000 && !tooLarge) { tooLarge = true; res.writeHead(413, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Anfrage zu groß.' })); } });
    req.on('end', async () => {
      if (tooLarge) return;
      try {
        const response = await monHandler(new Request('http://localhost' + url.pathname, { method: req.method, headers: req.headers, body: req.method === 'POST' ? body : undefined }));
        res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(await response.text());
      } catch (error) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Lokaler Spielserver nicht erreichbar.' })); }
    });
    return undefined;
  }

  let p = decodeURIComponent(url.pathname);
  if (p === '/' || p === '') p = '/index.html';
  const file = path.join(DIST, p);
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('404');
  }
  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  return fs.createReadStream(file).pipe(res);
});

server.listen(PORT, () => {
  console.log('Herr Gehstocks Hideout laeuft auf http://localhost:' + PORT);
  console.log('Selbsttest:  http://localhost:' + PORT + '/?selftest=1');
});
