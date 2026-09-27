/* Schatzkarten (27.09.2026): Fetzen aus dem Alltag, persoenliche Grabstelle,
   Wuenschelrute und ein Schatz je Woche. */
import assert from 'node:assert/strict';
import { data as D, economy as E, hours as H, adventure as X } from '../netlify/functions/lib/gehstockmon-rules.mjs';
import { createHandler } from '../netlify/functions/gehstockmon.mjs';

const at = (s) => Date.parse(s), STUNDE = 3600000;
const mon = at('2026-10-05T08:00:00+02:00');   // klarer Himmel
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
const ca = codeAt(0);
async function welt(start = mon, random = () => .5) {
  const uhr = { t: start }, db = store(), presence = store(); let serial = 0;
  const handler = createHandler({ store: db, presenceStore: presence, now: () => uhr.t, random });
  const call = async (op, extra = {}) => {
    const r = await handler(new Request('http://localhost/api/gehstockmon', { method: 'POST', body: JSON.stringify({ code: ca, op, name: 'Anna', requestId: 'schatz-test-' + (++serial), ...extra }) }));
    return { status: r.status, ...await r.json() };
  };
  const hinstellen = async (id, punkt) => {
    const p = db.data.players[id];
    await presence.setJSON('presence-v1', { players: { [id]: { id, name: p.name, x: punkt.x, z: punkt.z, heading: 0, activity: 'map', updatedAt: uhr.t,
      spawnAt: p.lastJoinAt, credit: 33, skin: p.skin, weapon: p.weapon, squad: p.truppe.slice(), protected: false, eier: p.eggs.length } } });
  };
  const a = await call('join');
  return { uhr, db, call, hinstellen, id: a.playerId, p: () => db.data.players[a.playerId], a };
}

await test('Fragments come for sure from everyday things, at most four, and none while a map is followed', () => {
  const p = D.neuerStand(null, mon);
  for (let i = 0; i < 2; i++) assert.equal(X.schatzFetzen(p, 'kurier'), false);
  assert.equal(X.schatzFetzen(p, 'kurier'), true, 'every third delivery');
  assert.equal(X.schatzFetzen(p, 'truhe'), true, 'every chest');
  assert.equal(X.schatzFetzen(p, 'streifzug'), true, 'every long trip');
  for (let i = 0; i < 3; i++) X.schatzFetzen(p, 'rohstoff');
  assert.equal(X.schatzFetzen(p, 'rohstoff'), true, 'every fourth node');
  assert.equal(p.schatz.fetzen, 4);
  assert.equal(X.schatzFetzen(p, 'truhe'), false, 'four is a whole map - no fifth');
  assert.equal(X.schatzFetzen(p, 'erfunden'), false);
  assert.equal(X.schatzLesbar(p, mon), true);
  p.schatz.karte = { x: 0, z: 0, gebiet: 1, seit: mon }; p.schatz.fetzen = 0;
  assert.equal(X.schatzFetzen(p, 'truhe'), false, 'nothing is collected while a map is being followed');
  /* Aus dem Speicher kommt nur Gueltiges zurueck. */
  const sauber = D.neuerStand({ ...p, schatz: { fetzen: 9, zaehler: { kurier: 2, erfunden: 5 }, karte: { x: 'weit' }, funde: -3 } }, mon).schatz;
  assert.deepEqual(sauber, { fetzen: 4, zaehler: { kurier: 2 }, woche: null, karte: null, funde: 0 });
});

await test('Every dig spot lies outside all walls, and the divining rod grows hotter step by step', () => {
  let seed = 3; const zufall = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
  for (let mask = 0; mask < 512; mask += 37) {
    const territories = D.FELDER.map((f, i) => ({ id: f.id, ownerId: mask >> i & 1 ? 'besitzer' : null })), layout = X.layout(territories);
    for (let i = 0; i < 12; i++) {
      const ort = X.schatzOrt(zufall, territories);
      assert.ok(X.walkable(ort) && !layout.some((g) => X.inside(ort, g)), 'mask ' + mask + ': spot reachable');
      assert.ok(ort.gebiet >= 1 && ort.gebiet <= 9);
    }
  }
  assert.deepEqual([200, 60, 30, 10, 3].map((d) => X.schatzRute(d).stufe), [0, 1, 2, 3, 4]);
});

await test('Reading needs four fragments; digging needs the spot and pays runes, gold and resources once a week', async () => {
  const w = await welt();
  assert.match((await w.call('schatz_lesen')).error, /4 Kartenfetzen/);
  w.p().schatz.fetzen = 4;
  let r = await w.call('schatz_lesen'); assert.equal(r.status, 200, r.error);
  const karte = r.profile.schatz.karte;
  assert.ok(karte && karte.gebiet >= 1); assert.equal(r.profile.schatz.fetzen, 0);
  assert.match(r.message, new RegExp(D.FELDER[karte.gebiet - 1].name));
  assert.match((await w.call('schatz_lesen')).error, /schon eine Karte/);
  await w.hinstellen(w.id, { x: karte.x + 25, z: karte.z });
  r = await w.call('schatz_graben'); assert.equal(r.status, 400); assert.match(r.error, /Wünschelrute sagt: heiß/);
  const vorher = { gold: w.p().gold, runen: w.p().runes.slice(), lager: { ...w.p().lager } };
  await w.hinstellen(w.id, karte);
  r = await w.call('schatz_graben'); assert.equal(r.status, 200, r.error);
  const f = r.schatz;
  assert.ok(f.rang >= 2 && f.rang <= 4, 'extraordinary to legendary');
  assert.equal(w.p().runes[f.rang] - vorher.runen[f.rang], X.SCHATZ_RUNEN);
  assert.equal(w.p().gold - vorher.gold, X.SCHATZ_GOLD);
  assert.equal(w.p().lager[f.rohstoff] - vorher.lager[f.rohstoff], X.SCHATZ_ROHSTOFF);
  assert.equal(E.rohstoffVon(karte.gebiet).id, f.rohstoff, 'the resources of that biome');
  assert.equal(r.profile.schatz.funde, 1); assert.equal(r.profile.schatz.karte, null);
  assert.ok(w.db.data.ticker.some((t) => /hebt einen Schatz/.test(t.text)));
  assert.equal(E.bilanzSicht(w.p(), w.uhr.t).diese.rein.schatz, X.SCHATZ_GOLD);
  /* Eine Karte je Woche - die Fetzen bleiben, gelesen wird am Montag. */
  w.p().schatz.fetzen = 4;
  assert.match((await w.call('schatz_lesen')).error, /Diese Woche/);
  w.uhr.t = at('2026-10-12T08:00:00+02:00');
  assert.equal((await w.call('schatz_lesen')).status, 200);
});

await test('On the server, deliveries, long trips and resource nodes bring their fragments', async () => {
  const w = await welt();
  const auftrag = (n) => { const a = { id: 'k97' + n, von: 0, nach: 6, ware: 'Briefe', eilig: false }; a.lohn = X.kurierLohn(X.kurierRunde(a)); return a; };
  let r;
  for (let i = 0; i < 3; i++) {
    w.p().kurierBrett = [auftrag(i)];
    await w.hinstellen(w.id, X.STADT_TOR);
    assert.equal((await w.call('kurier_annehmen', { auftragId: 'k97' + i })).status, 200);
    await w.hinstellen(w.id, X.tor(X.layout(w.db.data.territories), 6));
    r = await w.call('kurier_abliefern'); assert.equal(r.status, 200, r.error);
  }
  assert.match(r.message, /Kartenfetzen/); assert.equal(r.profile.schatz.fetzen, 1);
  /* Ein Streifzug ueber die volle Dauer. */
  w.p().besitz.push('kieselkrabb');
  r = await w.call('streifzug_start', { monId: 'kieselkrabb', ziel: 'waren', dauer: 180 }); assert.equal(r.status, 200, r.error);
  w.uhr.t = w.p().streifzuege[0].fertigAt;
  r = await w.call('streifzug_abholen', { streifzugId: w.p().streifzuege[0].id }); assert.equal(r.status, 200, r.error);
  assert.match(r.message, /Kartenfetzen/); assert.equal(r.profile.schatz.fetzen, 2);
  /* Vier Rohstoffstellen. */
  const stellen = (await w.call('world')).rohstoffStellen.slice(0, 4);
  for (const s of stellen) { await w.hinstellen(w.id, s); r = await w.call('abbauen', { stelleId: s.id }); assert.equal(r.status, 200, r.error); }
  assert.equal(r.profile.schatz.fetzen, 3); assert.match(r.message, /Kartenfetzen/);
});

console.log('\n' + checks + ' Schatz-Pruefungen bestanden.');
