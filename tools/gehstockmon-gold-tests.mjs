/* Goldwaren (27.09.2026): Eierhaendler, Runenschmiede, Wesen praegen und
   Schimmerperle. Jede Ware kostet, was sie verspricht, liefert, was sie
   verspricht, und laesst sich nicht ueber ihre Grenze hinaus nutzen. */
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
const [ca] = CODES;
async function welt(random = () => .5) {
  const uhr = { t: mon }, db = store(), presence = store(); let serial = 0;
  const handler = createHandler({ store: db, presenceStore: presence, now: () => uhr.t, random });
  const call = async (op, extra = {}) => { const r = await handler(new Request('http://localhost/api/gehstockmon', { method: 'POST', body: JSON.stringify({ code: ca, op, name: 'Anna', requestId: 'gold-test-' + (++serial), ...extra }) })); return { status: r.status, ...await r.json() }; };
  const a = await call('join');
  return { uhr, db, call, id: a.playerId, p: () => db.data.players[a.playerId] };
}

await test('The trader sells one normal egg a day for its price, and never into a full bag', async () => {
  const w = await welt();
  let r = await w.call('ei_kaufen');
  assert.equal(r.status, 400, 'a newcomer cannot afford it yet'); assert.match(r.error, /kostet/);
  w.p().gold = 1000;
  r = await w.call('ei_kaufen'); assert.equal(r.status, 200, r.error);
  assert.equal(r.profile.gold, 1000 - X.HAENDLER_EI_PREIS);
  const ei = r.profile.eggs.find((e) => e.art === 'handel');
  assert.ok(ei, 'the egg is in the bag and says where it came from');
  assert.equal(ei.startedAt, null); assert.equal(ei.mindestens, undefined, 'a normal egg, no guarantee');
  r = await w.call('ei_kaufen'); assert.equal(r.status, 400); assert.match(r.error, /heute schon/);
  w.uhr.t += 86400000; w.p().eggs = Array.from({ length: E.BAG_LIMIT }, (_, i) => ({ id: 'voll-' + i, territoryId: 1, producedAt: w.uhr.t, startedAt: null, readyAt: null }));
  r = await w.call('ei_kaufen'); assert.equal(r.status, 400); assert.match(r.error, /Bruttasche ist voll/);
  w.p().eggs.pop();
  r = await w.call('ei_kaufen'); assert.equal(r.status, 200, 'the next day it sells again: ' + r.error);
});

await test('The rune forge splits one rune into two below and fuses three into one above, for gold', async () => {
  const w = await welt(); w.p().gold = 5000; w.p().runes = [5, 0, 0, 0, 0, 2, 0];
  let r = await w.call('runen_zerlegen', { rang: 5 }); assert.equal(r.status, 200, r.error);
  assert.deepEqual(r.profile.runes, [5, 0, 0, 0, 2, 1, 0], 'one Mythisch became two Legendaer');
  assert.equal(r.profile.gold, 5000 - X.schmiedeKosten('zerlegen', 5));
  r = await w.call('runen_verschmelzen', { rang: 0 }); assert.equal(r.status, 200, r.error);
  assert.deepEqual(r.profile.runes, [2, 1, 0, 0, 2, 1, 0], 'three Gewoehnlich became one Selten');
  assert.equal(r.profile.gold, 5000 - X.schmiedeKosten('zerlegen', 5) - X.schmiedeKosten('verschmelzen', 0));
  assert.equal((await w.call('runen_verschmelzen', { rang: 0 })).status, 400, 'two are not enough to fuse');
  assert.equal((await w.call('runen_zerlegen', { rang: 0 })).status, 400, 'nothing lies below Gewoehnlich');
  assert.equal((await w.call('runen_verschmelzen', { rang: 6 })).status, 400, 'nothing lies above Apokalyptisch');
  assert.equal((await w.call('runen_zerlegen', { rang: 3 })).status, 400, 'no Episch rune to split');
  /* Hin und zurueck verliert immer: aus drei werden eine und daraus zwei -
     eine Schleife, die Runen vermehrt, gibt es nicht. */
  w.p().runes = [3, 0, 0, 0, 0, 0, 0];
  await w.call('runen_verschmelzen', { rang: 0 });
  r = await w.call('runen_zerlegen', { rang: 1 }); assert.equal(r.status, 200, r.error);
  assert.deepEqual(r.profile.runes, [2, 0, 0, 0, 0, 0, 0], 'three in, two back');
  w.p().gold = 0; w.p().runes = [0, 0, 0, 0, 0, 1, 0];
  const arm = await w.call('runen_zerlegen', { rang: 5 }); assert.equal(arm.status, 400); assert.match(arm.error, /verlangt/);
});

await test('A new nature costs by rarity, is always a different one, and reaches the defence at once', async () => {
  const w = await welt(() => .99);
  const p = w.p(), monId = p.truppe[0], rang = D.mon(monId).seltenheit;
  Object.assign(w.db.data.territories[0], { ownerId: w.id, ownerName: 'Anna', ...E.outpost(null, mon) });
  p.gold = 3000; p.wesen[monId] = X.WESEN[X.WESEN.length - 1].id;
  const version = (await w.call('world')).territories[0].version;
  const r = await w.call('wesen_praegen', { monId }); assert.equal(r.status, 200, r.error);
  assert.equal(r.profile.gold, 3000 - X.wesenPreis(rang));
  const neu = w.p().wesen[monId];
  assert.notEqual(neu, X.WESEN[X.WESEN.length - 1].id, 'a roll at the very end still lands on a different nature');
  const verteidiger = r.territories[0].defense.find((m) => m.id === monId);
  assert.equal(verteidiger.wesen, neu, 'the outpost fights with the new nature');
  assert.ok(r.territories[0].version > version, 'and a running attack on it has to start over');
  assert.equal((await w.call('wesen_praegen', { monId: 'nullwyrm' })).status, 400, 'only for Mons you own');
  w.p().gold = 0;
  assert.equal((await w.call('wesen_praegen', { monId })).status, 400, 'not without the gold');
  assert.ok(X.wesenPreis(6) > X.wesenPreis(0), 'rarer Mons cost more');
});

await test('A shimmer pearl makes the next hatch shimmer, waits if that Mon already shimmers, and is kept only once', async () => {
  const w = await welt(() => .5);
  /* Mit .5 faellt jedes Ei gleich: Selten, dasselbe Mon, kein Zufallsschimmer. */
  const pool = D.KATALOG.filter((k) => k.seltenheit === 1), erwartet = pool[Math.floor(.5 * pool.length)].id;
  w.p().gold = 5000;
  let r = await w.call('schimmerperle_kaufen'); assert.equal(r.status, 200, r.error);
  assert.equal(r.profile.schimmerperle, true); assert.equal(r.profile.gold, 5000 - X.SCHIMMERPERLE_PREIS);
  assert.equal((await w.call('schimmerperle_kaufen')).status, 400, 'one pearl at a time');
  const reif = (n) => ({ id: 'reif-' + n, territoryId: 1, producedAt: w.uhr.t - E.HATCH_TIME, startedAt: w.uhr.t - E.HATCH_TIME, readyAt: w.uhr.t });
  /* Schimmert das Mon schon, bleibt die Perle liegen. */
  w.p().besitz.push(erwartet); w.p().schimmernd = { [erwartet]: true }; w.p().eggs = [reif(1)];
  r = await w.call('hatch', { eggId: 'reif-1' }); assert.equal(r.status, 200, r.error);
  assert.equal(r.monId, erwartet); assert.equal(r.profile.schimmerperle, true, 'the pearl waits for a Mon that does not shimmer yet');
  /* Sonst wirkt sie und ist weg. */
  w.p().schimmernd = {}; w.p().eggs = [reif(2)];
  r = await w.call('hatch', { eggId: 'reif-2' }); assert.equal(r.status, 200, r.error);
  assert.equal(r.schlupf.schimmernd, true); assert.equal(r.schlupf.schimmerNeu, true);
  assert.equal(r.profile.schimmernd[erwartet], true, 'the Mon shimmers for good');
  assert.equal(r.profile.schimmerperle, false, 'and the pearl is used up');
  w.p().eggs = [reif(3)]; w.p().schimmernd = {};
  r = await w.call('hatch', { eggId: 'reif-3' });
  assert.equal(r.schlupf.schimmernd, false, 'without a pearl the next one is ordinary again');
});

await test('Every new ware is a game move the browser marks, and the help names them all', async () => {
  for (const op of ['ei_kaufen', 'runen_zerlegen', 'runen_verschmelzen', 'schimmerperle_kaufen', 'wesen_praegen'])
    assert.ok(X.SPIELZUEGE.includes(op), op + ' needs a request id');
  const fs = await import('node:fs');
  const hilfe = fs.readFileSync('src/games/gehstockmon/3-ui.js', 'utf8');
  assert.match(hilfe, /'Goldwaren'/);
});

console.log('\n' + checks + ' Goldwaren-Pruefungen bestanden.');
