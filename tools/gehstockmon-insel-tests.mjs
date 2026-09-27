/* Die Insel als Ganzes (27.09.2026): Inselwetter und die Wochenfaktoren,
   ueber die Wetter und Erlasse wirken. */
import assert from 'node:assert/strict';
import { data as D, economy as E, hours as H, adventure as X } from '../netlify/functions/lib/gehstockmon-rules.mjs';
import { createHandler } from '../netlify/functions/gehstockmon.mjs';

const at = (s) => Date.parse(s), STUNDE = 3600000, TAG = 86400000;
let checks = 0;
async function test(name, fn) { await fn(); checks++; console.log('ok', name); }
function store() {
  let data = null, v = 0;
  return { get data() { return data; }, async getWithMetadata() { return data ? { data: structuredClone(data), etag: String(v) } : null; },
    async setJSON(k, next, o = {}) { if (o.onlyIfNew && data || o.onlyIfMatch !== undefined && o.onlyIfMatch !== String(v)) return { modified: false }; data = structuredClone(next); v++; return { modified: true }; } };
}
function codeAt(index) {
  const codes = [];
  for (let n = 0; n < 10000; n++) {
    const code = String(n).padStart(4, '0'), text = 'code:' + code + ':gehstock:hideout:2026:kellergewoelbe';
    let h = 0x811c9dc5; for (const c of text) { h ^= c.charCodeAt(0); h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0; }
    if (h % 97 === 0) codes.push(code);
  }
  return codes[index];
}
const ca = codeAt(0), cb = codeAt(1);
async function welt(start, random = () => .5) {
  const uhr = { t: start }, db = store(), presence = store(); let serial = 0;
  const handler = createHandler({ store: db, presenceStore: presence, now: () => uhr.t, random });
  const call = async (code, op, extra = {}) => {
    const r = await handler(new Request('http://localhost/api/gehstockmon', { method: 'POST', body: JSON.stringify({ code, op, name: code === ca ? 'Anna' : 'Ben', requestId: 'insel-test-' + (++serial), ...extra }) }));
    return { status: r.status, ...await r.json() };
  };
  const hinstellen = async (id, punkt) => {
    const p = db.data.players[id], alt = (await presence.getWithMetadata())?.data?.players || {};
    await presence.setJSON('presence-v1', { players: { ...alt, [id]: { id, name: p.name, x: punkt.x, z: punkt.z, heading: 0, activity: 'map', updatedAt: uhr.t,
      spawnAt: p.lastJoinAt, credit: 33, skin: p.skin, weapon: p.weapon, squad: p.truppe.slice(), protected: false, eier: p.eggs.length } } });
  };
  const a = await call(ca, 'join');
  return { uhr, db, call, hinstellen, id: a.playerId, p: () => db.data.players[a.playerId], a };
}
/* Eine Zeit mitten in einer Wochennummer (Dienstagmittag). */
const inWoche = (w) => w * 7 * TAG - 3 * TAG + 1.5 * TAG;
function wocheMit(id, ab = 2960) { for (let w = ab; w < ab + 30; w++) if (X.wetterDerWoche(w).id === id) return w; throw new Error(id); }

await test('Seven weeks bring each weather once, and no weather repeats from one week to the next', () => {
  let vorher = null;
  for (let w = 2800; w < 3400; w++) {
    const id = X.wetterDerWoche(w).id;
    assert.notEqual(id, vorher, 'week ' + w + ' repeats ' + id);
    vorher = id;
    if (w % X.WETTER.length === 0) {
      const block = new Set(); for (let i = 0; i < X.WETTER.length; i++) block.add(X.wetterDerWoche(w + i).id);
      assert.equal(block.size, X.WETTER.length, 'every weather once from week ' + w);
    }
  }
  const t = at('2026-09-29T10:00:00+02:00');
  assert.equal(X.wetter(t).id, X.wetterDerWoche(X.zerhackerWoche(t)).id);
  assert.equal(X.wetterNaechste(t).id, X.wetterDerWoche(X.zerhackerWoche(t) + 1).id);
});

await test('Decrees multiply, and the weather shield halves the weather in both directions', () => {
  const t = inWoche(wocheMit('duerre'));
  assert.equal(X.effekt(t, null, 'gebietsgold'), .8);
  assert.ok(Math.abs(X.effekt(t, 'wetterschutz', 'gebietsgold') - .9) < 1e-9);
  assert.ok(Math.abs(X.effekt(t, 'wetterschutz', 'kurier') - 1.15) < 1e-9);
  assert.ok(Math.abs(X.effekt(t, 'kurierwoche', 'kurier') - 1.3 * 1.25) < 1e-9);
  assert.deepEqual(X.effekte(t, null), { gebietsgold: .8, tagwerk: 1.3, kurier: 1.3 });
  assert.equal(X.effekt(inWoche(wocheMit('klar')), 'bauwoche', 'abgabe'), 1.5);
  assert.equal(X.effekt(inWoche(wocheMit('klar')), null, 'arenaLohn'), 1, 'no weather, no decree: plain values');
});

await test('In a drought week territories earn a fifth less, the harbour and the couriers a third more', async () => {
  const mon = at('2026-10-12T08:00:00+02:00');
  assert.equal(X.wetter(mon).id, 'duerre');
  const w = await welt(mon);
  Object.assign(w.db.data.territories[5], { ownerId: w.id, ownerName: 'Anna', ...E.outpost(null, mon) });   // Tauwiese, Lager: 20 Gold je Stunde
  const start = w.p().gold;
  w.uhr.t = mon + STUNDE; await w.call(cb, 'join');
  /* 20 × 0,8 = 16, davon 10 % Abgabe: 14 auf dem Konto, die Reste warten. */
  assert.equal(w.p().gold - start, 14);
  assert.equal(E.bilanzSicht(w.p(), w.uhr.t).diese.rein.gebiete, 15, 'the ledger shows the gross yield, 14 + 1 for the hall');
  /* Ohne Gebiet ins Tagwerk: 80 × 1,3. */
  delete w.db.data.territories[5].ownerId; w.db.data.territories[5].ownerId = null;
  await w.hinstellen(w.id, X.STADT_TOR); w.p().tagwerkAt = X.schonReif(w.uhr.t, X.TAGWERK_ZEIT, 1);
  let r = await w.call(ca, 'tagwerk'); assert.equal(r.status, 200, r.error); assert.match(r.message, /\+104 Gold/);
  assert.equal(r.stadt.tagwerkLohn, 104, 'the harbour window shows the drought wage');
  /* Ein Paket: der Lohn mal 1,3. */
  const a = { id: 'k950', von: 0, nach: 6, ware: 'Honig', eilig: false }; a.lohn = X.kurierLohn(X.kurierRunde(a));
  w.p().kurierBrett = [a];
  assert.equal((await w.call(ca, 'kurier_annehmen', { auftragId: 'k950' })).status, 200);
  await w.hinstellen(w.id, X.tor(X.layout(w.db.data.territories), 6));
  const davor = w.p().gold; r = await w.call(ca, 'kurier_abliefern');
  assert.equal(r.status, 200, r.error); assert.equal(w.p().gold - davor, Math.round(a.lohn * 1.3));
  assert.deepEqual(r.insel.effekte, { gebietsgold: .8, tagwerk: 1.3, kurier: 1.3 });
});

await test('In the hero week the Zerhacker is half again as tough, tailwind shortens trips, the market week doubles trade limits', async () => {
  const held = at('2026-09-28T08:00:00+02:00');
  assert.equal(X.wetter(held).id, 'heldenwoche');
  let w = await welt(held);
  assert.equal(w.a.zerhacker.maxHp, Math.round(X.zerhackerKraft(1) * 1.5));
  const wind = at('2026-09-21T09:00:00+02:00');
  assert.equal(X.wetter(wind).id, 'rueckenwind');
  w = await welt(wind);
  w.p().besitz.push('nachtflatter');
  let r = await w.call(ca, 'streifzug_start', { monId: 'nachtflatter', ziel: 'runen', dauer: 180 }); assert.equal(r.status, 200, r.error);
  assert.equal(w.p().streifzuege[0].fertigAt, H.productionAt(H.openTime(wind) + 135 * 60000), '180 minutes become 135');
  const markt = at('2026-11-02T09:00:00+02:00');
  assert.equal(X.wetter(markt).id, 'marktwoche');
  w = await welt(markt);
  w.db.data.bauten = { markthalle: { gold: X.bau('markthalle').ziel, abgabe: 0, spender: {}, fertigAt: markt, fertigAm: markt } };
  r = await w.call(ca, 'world');
  assert.equal(r.handel.runen.kaufFrei, 2 * X.RUNEN_KAUF_DECKEL); assert.equal(r.handel.runen.verkaufFrei, 2 * X.RUNEN_VERKAUF_DECKEL);
});

await test('Monday brings the new weather into the ticker and the morning report, and the week view shows the forecast', async () => {
  const fr = at('2026-10-09T11:00:00+02:00'), mo = at('2026-10-12T08:00:00+02:00');
  const w = await welt(fr);
  w.uhr.t = mo;
  const r = await w.call(ca, 'join');
  assert.equal(r.insel.wetter.id, 'duerre'); assert.equal(r.insel.naechste.id, X.wetterNaechste(mo).id);
  assert.ok(r.ticker.some((e) => /Neue Woche, neues Wetter: Dürre/.test(e.text)), 'the ticker announces it');
  assert.ok(r.morgenbericht && r.morgenbericht.zeilen.some((z) => /Diese Woche: Dürre/.test(z.text)), 'and the morning report');
  assert.equal(w.db.data.insel.woche, X.zerhackerWoche(mo));
  /* Ein zweiter Aufruf in derselben Woche kuendigt nichts erneut an. */
  const vorher = w.db.data.ticker.length; await w.call(cb, 'join');
  assert.equal(w.db.data.ticker.filter((e) => /neues Wetter: Dürre/.test(e.text)).length, 1);
  assert.ok(w.db.data.ticker.length >= vorher);
});

console.log('\n' + checks + ' Insel-Pruefungen bestanden.');
