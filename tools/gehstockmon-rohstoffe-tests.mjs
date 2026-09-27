/* Warenwirtschaft (27.09.2026): Holz, Erz und Kristall - Foerderung an den
   Aussenposten, Rohstoffstellen fuer alle, Ausbau, Hafenkran und Handel. */
import assert from 'node:assert/strict';
import { data as D, economy as E, hours as H, adventure as X } from '../netlify/functions/lib/gehstockmon-rules.mjs';
import { createHandler } from '../netlify/functions/gehstockmon.mjs';

const at = (s) => Date.parse(s), STUNDE = 3600000;
/* Eine Woche mit klarem Himmel, damit kein Wetter die Mengen verschiebt. */
const mon = at('2026-10-05T08:00:00+02:00');
assert.equal(X.wetter(mon).id, 'klar');
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
async function welt(start = mon, random = () => .5) {
  const uhr = { t: start }, db = store(), presence = store(); let serial = 0;
  const handler = createHandler({ store: db, presenceStore: presence, now: () => uhr.t, random });
  const call = async (code, op, extra = {}) => {
    const r = await handler(new Request('http://localhost/api/gehstockmon', { method: 'POST', body: JSON.stringify({ code, op, name: code === ca ? 'Anna' : 'Ben', requestId: 'rohstoff-test-' + (++serial), ...extra }) }));
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
function besitzen(w, ids, now = w.uhr.t) {
  for (const i of ids) Object.assign(w.db.data.territories[i - 1], { ownerId: w.id, ownerName: 'Anna', ...E.outpost(null, now) });
}

await test('Every resource comes from three biomes, and the nodes lie outside all walls, two per resource each hour', () => {
  const alle = new Set();
  for (const r of E.ROHSTOFFE) { assert.equal(r.gebiete.length, 3); r.gebiete.forEach((g) => { assert.ok(!alle.has(g)); alle.add(g); }); }
  assert.equal(alle.size, D.FELDER.length, 'every biome yields exactly one resource');
  for (let mask = 0; mask < 512; mask += 29) {
    const territories = D.FELDER.map((f, i) => ({ id: f.id, ownerId: mask >> i & 1 ? 'besitzer' : null })), layout = X.layout(territories);
    for (let h = 0; h < 12; h++) {
      const t = mon + h * STUNDE, stellen = X.rohstoffStellen(t, territories);
      assert.ok(stellen.length >= 5, 'mask ' + mask + ': ' + stellen.length + ' nodes');
      for (const s of stellen) {
        assert.equal(E.rohstoffVon(s.gebiet).id, s.rohstoff);
        assert.ok(X.walkable(s) && !layout.some((g) => X.inside(s, g)), 'node ' + s.id + ' is reachable');
      }
      for (const r of E.ROHSTOFFE) assert.ok(stellen.filter((s) => s.rohstoff === r.id).length <= 2);
      assert.deepEqual(X.rohstoffStellen(t, territories), stellen, 'the same hour gives the same nodes');
    }
  }
  assert.notDeepEqual(X.rohstoffStellen(mon, []).map((s) => s.id), X.rohstoffStellen(mon + STUNDE, []).map((s) => s.id));
});

await test('An outpost yields its biome resource each open hour, up to four, collected with the eggs', async () => {
  const w = await welt();
  besitzen(w, [1]);                                  // Mooswacht: Holz
  w.uhr.t = mon + 3 * STUNDE;
  let r = await w.call(ca, 'world');
  assert.equal(r.territories[0].rohstoffVorrat, 3);
  r = await w.call(ca, 'collect', { territoryId: 1 }); assert.equal(r.status, 200, r.error);
  assert.equal(r.profile.lager.holz, 3); assert.match(r.message, /3 Holz im Lager/); assert.match(r.message, /Ei/);
  /* Ueber Nacht nichts, und nie mehr als vier. */
  w.uhr.t = at('2026-10-06T08:00:00+02:00');         // Montag 11 bis 13 Uhr und Dienstag 7 bis 8 Uhr: drei Stunden
  r = await w.call(ca, 'world'); assert.equal(r.territories[0].rohstoffVorrat, 3);
  w.uhr.t += 4 * STUNDE; r = await w.call(ca, 'world'); assert.equal(r.territories[0].rohstoffVorrat, E.ROHSTOFF_VORRAT);
  /* Nur Rohstoffe, kein Ei: das Abholen klappt trotzdem. */
  w.p().eggs = []; w.db.data.territories[0].eggStock = 0;
  r = await w.call(ca, 'collect', { territoryId: 1 }); assert.equal(r.status, 200, r.error); assert.match(r.message, /^4 Holz im Lager/);
  r = await w.call(ca, 'collect', { territoryId: 1 }); assert.equal(r.status, 400); assert.match(r.error, /nichts bereit/);
});

await test('Anyone can mine a node once and only up close; the harvest week doubles it', async () => {
  const w = await welt();
  const stelle = w.a.rohstoffStellen[0];
  let r = await w.call(ca, 'abbauen', { stelleId: stelle.id }); assert.equal(r.status, 400); assert.match(r.error, /Kartenposition/);
  await w.hinstellen(w.id, { x: stelle.x + 30, z: stelle.z });
  r = await w.call(ca, 'abbauen', { stelleId: stelle.id }); assert.match(r.error, /näher heran/);
  await w.hinstellen(w.id, stelle);
  r = await w.call(ca, 'abbauen', { stelleId: stelle.id }); assert.equal(r.status, 200, r.error);
  assert.equal(r.profile.lager[stelle.rohstoff], X.ROHSTOFF_MENGE); assert.equal(r.profile.abgebaut, 1);
  assert.ok(!r.rohstoffStellen.some((s) => s.id === stelle.id), 'a mined node disappears for the miner');
  assert.match((await w.call(ca, 'abbauen', { stelleId: stelle.id })).error, /schon abgebaut/);
  const ernte = at('2026-10-19T09:00:00+02:00');
  assert.equal(X.wetter(ernte).id, 'erntezeit');
  const v = await welt(ernte), s2 = v.a.rohstoffStellen[0];
  await v.hinstellen(v.id, s2);
  r = await v.call(ca, 'abbauen', { stelleId: s2.id }); assert.equal(r.status, 200, r.error);
  assert.equal(r.profile.lager[s2.rohstoff], 2 * X.ROHSTOFF_MENGE);
});

await test('The watchtower needs wood, the fortress ore and crystal', async () => {
  const w = await welt();
  besitzen(w, [1]); w.p().gold = 1000;
  let r = await w.call(ca, 'upgrade', { territoryId: 1 }); assert.equal(r.status, 400); assert.match(r.error, /6 Holz/);
  w.p().lager.holz = 7;
  r = await w.call(ca, 'upgrade', { territoryId: 1 }); assert.equal(r.status, 200, r.error);
  assert.equal(r.territories[0].level, 2); assert.equal(r.profile.lager.holz, 1);
  w.p().lager.erz = 6; w.p().lager.kristall = 3;
  r = await w.call(ca, 'upgrade', { territoryId: 1 }); assert.match(r.error, /1 Kristall/);
  w.p().lager.kristall = 4;
  r = await w.call(ca, 'upgrade', { territoryId: 1 }); assert.equal(r.status, 200, r.error); assert.equal(r.territories[0].level, 3);
});

await test('The harbour crane takes gold and all three resources, then pays every courier a fifth more', async () => {
  const w = await welt();
  Object.assign(w.p(), { gold: 3000, lager: { holz: 70, erz: 40, kristall: 29 } });
  let r = await w.call(ca, 'bau_spenden', { bauId: 'hafenkran', betrag: 1500 }); assert.equal(r.status, 200, r.error);
  assert.match((await w.call(ca, 'bau_spenden', { bauId: 'hafenkran', betrag: 50 })).error, /nur noch Rohstoffe/);
  assert.match((await w.call(ca, 'bau_spenden', { bauId: 'markthalle', rohstoff: 'holz', menge: 5 })).error, /braucht kein Holz/);
  r = await w.call(ca, 'bau_spenden', { bauId: 'hafenkran', rohstoff: 'holz', menge: 70 }); assert.equal(r.status, 200, r.error);
  assert.equal(w.p().lager.holz, 10, 'only what the crane still needs is taken');
  assert.equal((await w.call(ca, 'bau_spenden', { bauId: 'hafenkran', rohstoff: 'erz', menge: 40 })).status, 200);
  r = await w.call(ca, 'bau_spenden', { bauId: 'hafenkran', rohstoff: 'kristall', menge: 29 }); assert.equal(r.status, 200);
  assert.equal(r.handel.bauten.find((b) => b.id === 'hafenkran').fertig, false, 'one crystal short');
  w.p().lager.kristall = 1;
  r = await w.call(ca, 'bau_spenden', { bauId: 'hafenkran', rohstoff: 'kristall', menge: 1 });
  assert.equal(r.handel.hafenkran, true); assert.ok(w.db.data.ticker.some((t) => /Hafenkran steht/.test(t.text)));
  const kran = r.handel.bauten.find((b) => b.id === 'hafenkran');
  assert.equal(kran.tafelRoh[0].name, 'Anna'); assert.equal(kran.tafelRoh[0].wert, 60 + 40 + 30);
  /* Ein Paket vom Nebelwald-Tor: Lohn mal 1,2 und ein Holz dazu. */
  const a = { id: 'k960', von: 4, nach: 8, ware: 'Seile', eilig: false }; a.lohn = X.kurierLohn(X.kurierRunde(a));
  w.p().kurierBrett = [a];
  const layout = () => X.layout(w.db.data.territories);
  await w.hinstellen(w.id, X.tor(layout(), 4));
  assert.equal((await w.call(ca, 'kurier_annehmen', { auftragId: 'k960' })).status, 200);
  await w.hinstellen(w.id, X.tor(layout(), 8));
  const gold = w.p().gold, holz = w.p().lager.holz;
  r = await w.call(ca, 'kurier_abliefern'); assert.equal(r.status, 200, r.error);
  assert.equal(w.p().gold - gold, Math.round(a.lohn * X.HAFENKRAN_KURIER)); assert.equal(w.p().lager.holz - holz, 1);
  assert.match(r.message, /und 1 Holz/);
});

await test('Resources trade at the market hall within the same weekly limits as runes', async () => {
  const w = await welt();
  w.p().gold = 2000; w.p().lager.erz = 12;
  assert.match((await w.call(ca, 'rohstoff_kaufen', { rohstoff: 'holz', menge: 5 })).error, /Markthalle/);
  w.db.data.bauten = { markthalle: { gold: X.bau('markthalle').ziel, abgabe: 0, spender: {}, fertigAm: w.uhr.t } };
  let r = await w.call(ca, 'rohstoff_kaufen', { rohstoff: 'holz', menge: 5 }); assert.equal(r.status, 200, r.error);
  assert.equal(w.p().lager.holz, 5); assert.equal(w.p().gold, 2000 - 40);
  r = await w.call(ca, 'rohstoff_verkaufen', { rohstoff: 'erz', menge: 10 }); assert.equal(r.status, 200, r.error);
  assert.equal(w.p().lager.erz, 2); assert.equal(w.p().gold, 2000 - 40 + 50);
  assert.equal(r.handel.runen.kaufFrei, X.RUNEN_KAUF_DECKEL - 40, 'runes and resources share one purse');
  assert.match((await w.call(ca, 'rohstoff_verkaufen', { rohstoff: 'erz', menge: 5 })).error, /So viel Erz/);
  assert.equal((await w.call(ca, 'rohstoff_kaufen', { rohstoff: 'holz', menge: 25 })).status, 400, 'at most twenty at once');
});

console.log('\n' + checks + ' Rohstoff-Pruefungen bestanden.');
