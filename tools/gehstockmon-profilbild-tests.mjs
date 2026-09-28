/* Profilbilder: Ablage im Relais, Mitreisen mit der Anwesenheit in GehstockMon
   und das Nachladen im Browser (src/core/profilbild.js). Nur Arbeitsspeicher. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';

for (const k of ['REDIS_URL', 'REDIS_PASS', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN']) delete process.env[k];
process.env.GEHSTOCK_SPEICHER = 'arbeitsspeicher';

const { default: room, profilbildKennung } = await import('../netlify/functions/room.mjs');
const { createHandler } = await import('../netlify/functions/gehstockmon.mjs');

let count = 0;
async function test(name, fn) { await fn(); console.log('ok', name); count++; }

/* Gueltige Codes je Rolle, gerechnet wie in src/core/auth.js. */
function streu(t) { let h = 0x811c9dc5; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0; } return h >>> 0; }
const codes = { S: [], K: [], A: [], falsch: [] };
for (let n = 0; n < 10000; n++) {
  const c = String(n).padStart(4, '0'), h = streu('code:' + c + ':gehstock:hideout:2026:kellergewoelbe');
  if (h % 97 === 0) codes[['S', 'K', 'A'][Math.floor(h / 97) % 3]].push(c); else if (codes.falsch.length < 3) codes.falsch.push(c);
}
const [anna, bo] = codes.S, kreis = codes.K[0], chefin = codes.A[0], falsch = codes.falsch[0];
const kennung = (code) => createHash('sha256').update('gehstockmon-player:' + code).digest('hex').slice(0, 24);

async function relais(body) {
  const res = await room(new Request('http://localhost/api/room', { method: 'POST', body: JSON.stringify(body) }));
  return { status: res.status, ...(await res.json()) };
}
const BILD = 'data:image/jpeg;base64,' + Buffer.alloc(3000, 7).toString('base64');

await test('Ein Profilbild braucht einen gueltigen Code und ein echtes, kleines Bild', async () => {
  assert.equal((await relais({ op: 'profilbild:put', code: falsch, data: BILD })).status, 403);
  for (const data of ['data:text/html;base64,PHNjcmlwdD4=', 'javascript:alert(1)', 'data:image/svg+xml;base64,PHN2Zz4=',
    'data:image/jpeg;base64,AAAA"><script>', '']) {
    const r = await relais({ op: 'profilbild:put', code: anna, data });
    assert.equal(r.status, 400, data); assert.equal(r.error, 'kein_bild');
  }
  const gross = await relais({ op: 'profilbild:put', code: anna, data: 'data:image/jpeg;base64,' + 'A'.repeat(70000) });
  assert.equal(gross.status, 400); assert.equal(gross.error, 'zu_gross');
  const r = await relais({ op: 'profilbild:put', code: anna, data: BILD });
  assert.equal(r.status, 200);
  assert.equal(r.id, kennung(anna)); assert.equal(profilbildKennung(anna), r.id);
  assert.ok(r.v > 0);
});

await test('Das eigene kommt zurueck, fremde gibt es gesammelt und nur mit Zugang', async () => {
  const mein = await relais({ op: 'profilbild:mein', code: anna });
  assert.equal(mein.data, BILD); assert.equal(mein.id, kennung(anna));
  const leer = await relais({ op: 'profilbild:mein', code: bo });
  assert.equal(leer.data, null); assert.equal(leer.v, 0); assert.equal(leer.id, kennung(bo));
  assert.equal((await relais({ op: 'profilbild:get', code: falsch, ids: [kennung(anna)] })).status, 403);
  const r = await relais({ op: 'profilbild:get', code: bo, ids: [kennung(anna), kennung(bo), 'kaputt', '../verwaltung', kennung(anna)] });
  assert.deepEqual(Object.keys(r.bilder).sort(), [kennung(anna), kennung(bo)].sort());
  assert.equal(r.bilder[kennung(anna)].data, BILD); assert.equal(r.bilder[kennung(anna)].v, mein.v);
  assert.equal(r.bilder[kennung(bo)], null);
  const viele = Array.from({ length: 60 }, (_, i) => i.toString(16).padStart(24, '0'));
  assert.equal(Object.keys((await relais({ op: 'profilbild:get', code: bo, ids: viele })).bilder).length, 40);
});

await test('Abnehmen darf man das eigene, ein Admin jedes, sonst niemand', async () => {
  assert.equal((await relais({ op: 'profilbild:weg', code: bo, ziel: anna })).status, 403);
  assert.equal((await relais({ op: 'profilbild:weg', code: kreis, ziel: anna })).status, 403);
  assert.equal((await relais({ op: 'profilbild:mein', code: anna })).data, BILD);
  const weg = await relais({ op: 'profilbild:weg', code: chefin, ziel: anna });
  assert.equal(weg.status, 200); assert.equal(weg.id, kennung(anna));
  assert.equal((await relais({ op: 'profilbild:mein', code: anna })).data, null);
  await relais({ op: 'profilbild:put', code: bo, data: BILD });
  assert.equal((await relais({ op: 'profilbild:weg', code: bo })).status, 200);
  assert.equal((await relais({ op: 'profilbild:get', code: anna, ids: [kennung(bo)] })).bilder[kennung(bo)], null);
});

await test('Im Warteraum steht die Bildkennung, nie der Code', async () => {
  const neu = await relais({ op: 'create', game: 'connect4', seats: 3, name: 'Anna', zugang: anna });
  assert.equal(neu.status, 200);
  assert.equal(neu.players[0].bild, kennung(anna));
  const ohne = await relais({ op: 'join', code: neu.code, game: 'connect4', name: 'Gast' });
  assert.equal(ohne.players[1].bild, null);
  const erfunden = await relais({ op: 'join', code: neu.code, game: 'connect4', name: 'Mogel', zugang: falsch });
  assert.equal(erfunden.players[2].bild, null);
  assert.ok(!JSON.stringify(erfunden).includes(anna), 'kein Zugangscode im Raum');
});

/* GehstockMon: die Version reist mit der Anwesenheit, das Bild nicht. */
const stamp = Date.parse('2026-09-17T08:00:00+02:00');
function memory() { let data = null, version = 0; return { get data() { return data; }, async getWithMetadata() { return data ? { data: structuredClone(data), etag: String(version) } : null; }, async setJSON(key, next, opts) { await new Promise(setImmediate); if (opts.onlyIfNew && data || opts.onlyIfMatch !== undefined && opts.onlyIfMatch !== String(version)) return { modified: false }; data = structuredClone(next); version++; return { modified: true }; } }; }

await test('GehstockMon: die Spielerkennung ist die Bildkennung und die Version reist mit', async () => {
  const handler = createHandler({ store: memory(), presenceStore: memory(), now: () => stamp, random: () => 0 });
  let serial = 0;
  const gm = async (code, name, op, data = {}) => {
    const res = await handler(new Request('http://localhost/api/gehstockmon', { method: 'POST', body: JSON.stringify({ code, name, op, requestId: 'profilbild-test-' + (++serial), ...data }) }));
    return { status: res.status, ...(await res.json()) };
  };
  const a = await gm(anna, 'Anna', 'join'), b = await gm(bo, 'Bo', 'join');
  assert.equal(a.playerId, kennung(anna)); assert.equal(b.playerId, kennung(bo));
  const v = 1790000000000;
  assert.equal((await gm(anna, 'Anna', 'presence', { position: { ...a.spawn, heading: 0 }, bild: v })).status, 200);
  let sicht = await gm(bo, 'Bo', 'presence', { position: { ...b.spawn, heading: 0 } });
  const peer = sicht.peers.find((p) => p.id === a.playerId);
  assert.equal(peer.bild, v);
  assert.ok(!JSON.stringify(sicht).includes('base64'), 'das Bild selbst reist nicht mit');
  for (const kaputt of [-5, 1.5, '123', { x: 1 }]) {
    await gm(anna, 'Anna', 'presence', { position: { ...a.spawn, heading: 0 }, bild: kaputt });
    sicht = await gm(bo, 'Bo', 'presence', { position: { ...b.spawn, heading: 0 } });
    assert.equal(sicht.peers.find((p) => p.id === a.playerId).bild, undefined, JSON.stringify(kaputt));
  }
});

/* ------------------------------------------------------------------
   Das Modul im Browser - ohne DOM, nur Speicher, Relais und Uhr. */
function browser() {
  const werte = new Map(), posts = [], hoerer = {};
  const SG = {
    util: { emitter() { const m = {}; return { on: (k, f) => (m[k] = m[k] || []).push(f), off() {}, emit: (k, ...a) => (m[k] || []).forEach((f) => f(...a)) }; } },
    ui: {},
    storage: { get: (k, d) => (werte.has(k) ? structuredClone(werte.get(k)) : d), set: (k, v) => werte.set(k, structuredClone(v)), del: (k) => werte.delete(k), on: (k, f) => { hoerer[k] = f; } },
    auth: { aktuell: { code: anna, name: 'Anna' } },
    relais: { online: true, verfuegbar() { return this.online; }, antwort: null, post(body) { posts.push(body); return Promise.resolve().then(() => SG.relais.antwort(body)); } },
    noteError(w, e) { throw e; },
  };
  vm.runInContext(fs.readFileSync('src/core/profilbild.js', 'utf8'), vm.createContext({ SG, setTimeout, clearTimeout, Promise, Date }));
  return { SG, PB: SG.profilbild, posts, werte, hoerer };
}
const warten = (ms) => new Promise((ok) => setTimeout(ok, ms));
const holen = (PB, id, v) => new Promise((ok) => PB.holen(id, v, ok));

await test('Browser: was die Insel gleichzeitig braucht, kommt mit einer Anfrage', async () => {
  const { SG, PB, posts } = browser();
  const a = 'a'.repeat(24), b = 'b'.repeat(24), c = 'c'.repeat(24);
  SG.relais.antwort = (body) => ({ bilder: { [a]: { data: 'A1', v: 5 }, [b]: null } });
  const beide = Promise.all([holen(PB, a, 5), holen(PB, b, 7), holen(PB, a, 5)]);
  assert.equal(await holen(PB, c, 0), null, 'Version 0: keins, nicht fragen');
  assert.deepEqual([...await beide], ['A1', null, 'A1']);
  assert.equal(posts.length, 1);
  assert.deepEqual([...posts[0].ids].sort(), [a, b]); assert.equal(posts[0].code, anna); assert.equal(posts[0].op, 'profilbild:get');
  /* Die Anwesenheit meldet alle paar Sekunden dieselbe Version - gefragt wird trotzdem nur einmal,
     auch wenn der Server inzwischen keins mehr hat (ein Admin hat es abgenommen). */
  for (let i = 0; i < 5; i++) { assert.equal(await holen(PB, a, 5), 'A1'); assert.equal(await holen(PB, b, 7), null); }
  assert.equal(await holen(PB, a), 'A1', 'ohne Version reicht, was da ist');
  assert.equal(posts.length, 1);
  SG.relais.antwort = () => ({ bilder: { [a]: { data: 'A2', v: 9 } } });
  assert.equal(await holen(PB, a, 9), 'A2', 'neue Version wird geholt');
  assert.equal(posts.length, 2);
  /* Faellt die Verbindung aus, wird eine Weile nicht nachgefragt. */
  SG.relais.antwort = () => { throw new Error('Load failed'); };
  assert.equal(await holen(PB, c, 3), null);
  assert.equal(await holen(PB, c, 3), null);
  assert.equal(posts.length, 3);
});

await test('Browser: ein neues Bild zaehlt fuer die anderen erst, wenn der Server es hat', async () => {
  const { SG, PB, posts, werte, hoerer } = browser();
  SG.relais.online = false;
  const geaendert = [];
  PB.on('aenderung', (d) => geaendert.push(d));
  assert.equal(await PB.setzen('data:image/jpeg;base64,QUJD'), false);
  assert.equal(PB.eigenes(), 'data:image/jpeg;base64,QUJD');
  assert.equal(PB.version(), 0, 'noch nicht beim Server - die Anwesenheit schickt nichts');
  assert.equal(posts.length, 0);
  SG.relais.online = true;
  SG.relais.antwort = (body) => { assert.equal(body.op, 'profilbild:put'); assert.equal(body.code, anna); return { id: kennung(anna), v: 777 }; };
  hoerer.user();                 // neu angemeldet: das Ausstehende geht hoch
  await warten(1700);
  assert.equal(posts.length, 1);
  assert.equal(PB.version(), 777);
  assert.equal(PB.id, kennung(anna));
  assert.equal(await holen(PB, kennung(anna), 777), 'data:image/jpeg;base64,QUJD', 'das eigene kommt aus dem Geraet');
  assert.equal(posts.length, 1);
  /* Ein Admin hat es abgenommen: beim naechsten Abgleich verschwindet es auch hier. */
  SG.relais.antwort = (body) => { assert.equal(body.op, 'profilbild:mein'); return { id: kennung(anna), v: 0, data: null }; };
  assert.equal(await PB.abgleichen(), true);
  assert.equal(PB.eigenes(), null); assert.equal(PB.version(), 0);
  assert.equal(werte.size, 0);
  assert.ok(geaendert.length >= 3);
});

console.log(count + ' Profilbild-Pruefungen bestanden.');
