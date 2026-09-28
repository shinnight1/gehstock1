/* Buergermeisterwahl (27.09.2026): Wahlrecht, geheime Stimmen, Auszaehlung
   am Montag und die Wirkung des Erlasses. */
import assert from 'node:assert/strict';
import { data as D, economy as E, hours as H, adventure as X } from '../netlify/functions/lib/gehstockmon-rules.mjs';
import { createHandler } from '../netlify/functions/gehstockmon.mjs';

const at = (s) => Date.parse(s), TAG = 86400000;
const mo = at('2026-10-05T08:00:00+02:00'), naechsterMo = at('2026-10-12T08:00:00+02:00');
let checks = 0;
async function test(name, fn) { await fn(); checks++; console.log('ok', name); }
/* Die Huerden gelten nur, wenn die Wahl nicht fuer alle offen ist. */
async function mitHuerden(fn) { const vorher = X.WAHL.offen; X.WAHL.offen = false; try { await fn(); } finally { X.WAHL.offen = vorher; } }
function store() {
  let data = null, v = 0;
  return { get data() { return data; }, async getWithMetadata() { return data ? { data: structuredClone(data), etag: String(v) } : null; },
    async setJSON(k, next, o = {}) { if (o.onlyIfNew && data || o.onlyIfMatch !== undefined && o.onlyIfMatch !== String(v)) return { modified: false }; data = structuredClone(next); v++; return { modified: true }; } };
}
function codes(n) {
  const out = [];
  for (let i = 0; i < 10000 && out.length < n; i++) {
    const code = String(i).padStart(4, '0'), text = 'code:' + code + ':gehstock:hideout:2026:kellergewoelbe';
    let h = 0x811c9dc5; for (const c of text) { h ^= c.charCodeAt(0); h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0; }
    if (h % 97 === 0) out.push(code);
  }
  return out;
}
const [ca, cb, cc] = codes(3), NAMEN = { [ca]: 'Anna', [cb]: 'Ben', [cc]: 'Cleo' };
async function welt(start = mo) {
  const uhr = { t: start }, db = store(), presence = store(); let serial = 0;
  const handler = createHandler({ store: db, presenceStore: presence, now: () => uhr.t, random: () => .5 });
  const call = async (code, op, extra = {}) => {
    const r = await handler(new Request('http://localhost/api/gehstockmon', { method: 'POST', body: JSON.stringify({ code, op, name: NAMEN[code], requestId: 'wahl-test-' + (++serial), ...extra }) }));
    return { status: r.status, ...await r.json() };
  };
  const ids = {};
  for (const c of [ca, cb, cc]) ids[c] = (await call(c, 'join')).playerId;
  /* Alle drei sind lange genug dabei: Rang Faehrtenleser, drei Schultage, zwei Wochen alt. */
  for (const c of [ca, cb, cc]) Object.assign(db.data.players[ids[c]], { joinedAt: start - 14 * TAG, aktivTage: [H.day(start) - 3, H.day(start) - 2, H.day(start) - 1],
    progress: { ...db.data.players[ids[c]].progress, trainerWins: 16 } });
  return { uhr, db, call, ids, p: (c) => db.data.players[ids[c]] };
}

await test('Only experienced, regular players may vote, and running needs more', () => mitHuerden(() => {
  const p = D.neuerStand(null, mo);
  p.joinedAt = mo - 10 * TAG; p.aktivTage = [H.day(mo) - 2, H.day(mo) - 1, H.day(mo)];
  let r = X.wahlRecht(p, mo);
  assert.equal(r.stimme, false); assert.match(r.fehlt.join(' '), /Späher/);
  p.progress.trainerWins = 6;                          // 60 Erfahrung
  r = X.wahlRecht(p, mo); assert.equal(r.stimme, true); assert.equal(r.kandidat, false); assert.match(r.kandidatFehlt.join(' '), /Fährtenleser/);
  p.progress.trainerWins = 15; assert.equal(X.wahlRecht(p, mo).kandidat, true);
  p.aktivTage = [H.day(mo) - 20, H.day(mo) - 1, H.day(mo)];
  assert.equal(X.wahlRecht(p, mo).stimme, false, 'days older than two weeks do not count');
  p.aktivTage = [H.day(mo) - 2, H.day(mo) - 1, H.day(mo)]; p.joinedAt = mo - TAG;
  r = X.wahlRecht(p, mo); assert.equal(r.stimme, false); assert.match(r.fehlt.join(' '), /drei Tage alt/);
  /* Jeder Tag zaehlt einmal. */
  const q = D.neuerStand(null, mo); X.aktivMerken(q, mo); X.aktivMerken(q, mo + 3600000); X.aktivMerken(q, mo + TAG);
  assert.equal(q.aktivTage.length, 2);
}));

await test('Candidates promise a decree, votes stay secret, and Monday the most votes win', async () => {
  const w = await welt();
  let r = await w.call(ca, 'kandidieren', { erlass: 'kurierwoche' }); assert.equal(r.status, 200, r.error);
  assert.ok(w.db.data.ticker.some((t) => /Anna kandidiert fürs Rathaus/.test(t.text)));
  assert.equal((await w.call(cb, 'kandidieren', { erlass: 'bauwoche' })).status, 200);
  assert.equal((await w.call(cc, 'waehlen', { kandidatId: w.ids[ca] })).status, 200);
  assert.equal((await w.call(ca, 'waehlen', { kandidatId: w.ids[ca] })).status, 200);
  r = await w.call(cb, 'waehlen', { kandidatId: w.ids[cb] }); assert.equal(r.status, 200);
  const sicht = r.insel.rathaus;
  assert.equal(sicht.abgegeben, 3); assert.equal(sicht.meineStimme, w.ids[cb]);
  assert.ok(sicht.kandidaten.every((k) => k.stimmen === undefined), 'no counts before Monday');
  assert.deepEqual(sicht.kandidaten.map((k) => k.name), ['Anna', 'Ben'], 'in the order they stood');
  assert.match((await w.call(cc, 'waehlen', { kandidatId: w.ids[cc] })).error, /nicht auf dem Wahlzettel/);
  w.uhr.t = naechsterMo;
  r = await w.call(cc, 'join');
  assert.equal(r.insel.rathaus.amt.name, 'Anna'); assert.equal(r.insel.rathaus.amt.stimmen, 2);
  assert.equal(r.insel.erlass.id, 'kurierwoche'); assert.deepEqual(r.insel.rathaus.kandidaten, []);
  assert.equal(r.insel.rathaus.chronik[0].name, 'Anna');
  assert.ok(w.db.data.ticker.some((t) => /Anna ist Bürgermeister dieser Woche \(2 Stimmen\)/.test(t.text)));
  /* Der Erlass wirkt: Kurierwoche mal Duerre. */
  assert.ok(Math.abs(r.insel.effekte.kurier - 1.3 * 1.25) < 1e-9);
  /* Titel unter dem Namen, in der Arena-Liste - und nur in der Amtswoche. */
  assert.equal(r.turnier.gegner.find((g) => g.name === 'Anna').titel, 'Bürgermeister');
  w.uhr.t = naechsterMo + 7 * TAG;
  r = await w.call(cc, 'join');
  assert.equal(r.insel.rathaus.amt, null, 'without an election nobody rules'); assert.equal(r.insel.erlass, null);
  assert.notEqual(r.turnier.gegner.find((g) => g.name === 'Anna').titel, 'Bürgermeister');
});

await test('A tie goes to who stood first; withdrawing frees the votes; the ineligible can neither vote nor run', () => mitHuerden(async () => {
  const w = await welt();
  assert.equal((await w.call(cb, 'kandidieren', { erlass: 'arenafest' })).status, 200);
  assert.equal((await w.call(ca, 'kandidieren', { erlass: 'schutzwache' })).status, 200);
  assert.equal((await w.call(ca, 'waehlen', { kandidatId: w.ids[ca] })).status, 200);
  assert.equal((await w.call(cb, 'waehlen', { kandidatId: w.ids[cb] })).status, 200);
  /* Cleo verliert das Wahlrecht, sobald ihr Rang fehlt. */
  w.p(cc).progress.trainerWins = 0;
  assert.match((await w.call(cc, 'waehlen', { kandidatId: w.ids[ca] })).error, /Späher/);
  assert.match((await w.call(cc, 'kandidieren', { erlass: 'bauwoche' })).error, /Fährtenleser/);
  w.uhr.t = naechsterMo;
  let r = await w.call(ca, 'join');
  assert.equal(r.insel.rathaus.amt.name, 'Ben', 'one vote each - Ben stood first');
  /* Schutzwache in dieser Woche? Nein - Arenafest wirkt jetzt. */
  assert.equal(r.insel.effekte.arenaLohn, 1.25);
  /* Neue Woche, neue Wahl: wer zurueckzieht, gibt die Stimmen frei. */
  assert.equal((await w.call(ca, 'kandidieren', { erlass: 'bauwoche' })).status, 200);
  assert.equal((await w.call(cb, 'waehlen', { kandidatId: w.ids[ca] })).status, 200);
  r = await w.call(ca, 'kandidieren', { erlass: null }); assert.equal(r.status, 200, r.error);
  assert.equal(r.insel.rathaus.abgegeben, 0); assert.deepEqual(r.insel.rathaus.kandidaten, []);
}));

await test('While the election is open, a brand-new player may vote and run', async () => {
  assert.equal(X.WAHL.offen, true);
  const w = await welt();
  Object.assign(w.p(cc), { joinedAt: mo, aktivTage: [], progress: { ...w.p(cc).progress, trainerWins: 0 } });
  let r = await w.call(cc, 'kandidieren', { erlass: 'bauwoche' }); assert.equal(r.status, 200, r.error);
  r = await w.call(cc, 'waehlen', { kandidatId: w.ids[cc] }); assert.equal(r.status, 200, r.error);
  assert.deepEqual(r.insel.rathaus.recht, { stimme: true, kandidat: true, fehlt: [], kandidatFehlt: [] });
});

await test('Decrees reach the levy and the raid rest', async () => {
  const w = await welt();
  assert.equal((await w.call(ca, 'kandidieren', { erlass: 'bauwoche' })).status, 200);
  assert.equal((await w.call(cb, 'waehlen', { kandidatId: w.ids[ca] })).status, 200);
  w.uhr.t = naechsterMo;
  const r = await w.call(ca, 'join');
  assert.equal(r.handel.abgabe, .15, 'the building week raises the levy to 15 %');
  assert.equal(X.effekt(naechsterMo, 'schutzwache', 'raubSchutz'), 2);
  assert.equal(X.effekt(naechsterMo, 'schutzwache', 'raubPause'), 1.5);
});

console.log('\n' + checks + ' Wahl-Pruefungen bestanden.');
