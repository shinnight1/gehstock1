/* Titel (27.09.2026): rein kosmetisch, erreicht ueber vorhandene Zaehler,
   sichtbar unter dem Namen auf der Insel und in der Arena-Liste. */
import assert from 'node:assert/strict';
import { data as D, economy as E, adventure as X } from '../netlify/functions/lib/gehstockmon-rules.mjs';
import { createHandler } from '../netlify/functions/gehstockmon.mjs';

const mon = Date.parse('2026-09-21T09:00:00+02:00');
let checks = 0;
async function test(name, fn) { await fn(); checks++; console.log('ok', name); }
function store() {
  let data = null, v = 0;
  return { get data() { return data; }, async getWithMetadata() { return data ? { data: structuredClone(data), etag: String(v) } : null; },
    async setJSON(k, next, o = {}) { if (o.onlyIfNew && data || o.onlyIfMatch !== undefined && o.onlyIfMatch !== String(v)) return { modified: false }; data = structuredClone(next); v++; return { modified: true }; } };
}
const CODES = [];
for (let n = 0; n < 10000 && CODES.length < 2; n++) {
  const code = String(n).padStart(4, '0'), text = 'code:' + code + ':gehstock:hideout:2026:kellergewoelbe';
  let h = 0x811c9dc5; for (const c of text) { h ^= c.charCodeAt(0); h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0; }
  if (h % 97 === 0) CODES.push(code);
}
const [ca, cb] = CODES;
async function welt() {
  const uhr = { t: mon }, db = store(), presence = store(); let serial = 0;
  const handler = createHandler({ store: db, presenceStore: presence, now: () => uhr.t, random: () => .5 });
  const call = async (code, op, extra = {}) => { const r = await handler(new Request('http://localhost/api/gehstockmon', { method: 'POST', body: JSON.stringify({ code, op, name: code === ca ? 'Anna' : 'Ben', requestId: 'titel-test-' + (++serial), ...extra }) })); return { status: r.status, ...await r.json() }; };
  const a = await call(ca, 'join'), b = await call(cb, 'join');
  return { uhr, db, call, a, b, p: (id) => db.data.players[id] };
}

await test('Titles are cosmetic, distinct and measured by counters that already exist', () => {
  assert.ok(X.TITEL.length >= 6);
  assert.equal(new Set(X.TITEL.map((t) => t.id)).size, X.TITEL.length);
  const leer = D.neuerStand(null, mon);
  assert.deepEqual(X.titelErreicht(leer), [], 'a newcomer has none');
  for (const t of X.TITEL) assert.ok(t.ziel > t.wert(leer), t.id + ' needs real play');
});

await test('A title can only be worn once it is earned, and everyone then sees it', async () => {
  const w = await welt();
  let r = await w.call(ca, 'titel_waehlen', { titel: 'brutmeister' });
  assert.equal(r.status, 400); assert.match(r.error, /100 Eier ausgebrütet/, 'the refusal says what is missing');
  w.p(w.a.playerId).progress.hatched = 100;
  r = await w.call(ca, 'titel_waehlen', { titel: 'brutmeister' });
  assert.equal(r.status, 200, r.error); assert.equal(r.profile.titel, 'brutmeister');
  assert.equal(X.titelName(r.profile), 'Brutmeister');
  /* Auf der Insel: Ben sieht Annas Titel neben ihrem Namen. */
  await w.call(ca, 'presence', { position: { ...w.a.spawn, heading: 0 } });
  const blick = await w.call(cb, 'presence', { position: { ...w.b.spawn, heading: 0 } });
  const anna = blick.peers.find((v) => v.name === 'Anna');
  assert.ok(anna, 'Anna is on the island'); assert.equal(anna.titel, 'Brutmeister');
  /* In der Arena-Liste ebenso. */
  const liste = (await w.call(cb, 'world')).turnier.gegner.find((g) => g.id === w.a.playerId);
  assert.equal(liste.titel, 'Brutmeister');
  r = await w.call(ca, 'titel_waehlen', { titel: null });
  assert.equal(r.profile.titel, null, 'and it can be taken off again');
  assert.equal((await w.call(ca, 'titel_waehlen', { titel: 'kaiser' })).status, 400, 'unknown titles do not exist');
});

await test('Crossing a threshold announces the new title with the move that earned it', async () => {
  const w = await welt(), p = w.p(w.a.playerId);
  p.progress.hatched = 99;
  p.eggs = [{ id: 'reif-1', territoryId: 1, producedAt: mon - E.HATCH_TIME, startedAt: mon - E.HATCH_TIME, readyAt: mon }];
  const r = await w.call(ca, 'hatch', { eggId: 'reif-1' });
  assert.equal(r.status, 200, r.error);
  assert.deepEqual(r.neueTitel, ['Brutmeister'], 'the hundredth egg earns it');
  const danach = await w.call(ca, 'world');
  assert.equal(danach.neueTitel, undefined, 'and it is announced only once');
});

console.log('\n' + checks + ' Titel-Pruefungen bestanden.');
