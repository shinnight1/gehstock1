/* Streifzuege (27.09.2026): nur Mons ohne Dienst, Uhr nach Oeffnungszeit,
   Ergebnis beim Start ausgewuerfelt, Gold nach Landbesitz gestaffelt, und
   solange ein Mon unterwegs ist, kaempft, verteidigt und tauscht es nicht. */
import assert from 'node:assert/strict';
import { data as D, economy as E, hours as H, adventure as X } from '../netlify/functions/lib/gehstockmon-rules.mjs';
import { createHandler } from '../netlify/functions/gehstockmon.mjs';

/* Eine Woche mit klarem Himmel: Rueckenwind verkuerzte sonst jeden Weg. */
const mon = Date.parse('2026-10-05T09:00:00+02:00');
assert.equal(X.wetter(mon).id, 'klar');
let checks = 0;
async function test(name, fn) { await fn(); checks++; console.log('ok', name); }
function store() {
  let data = null, v = 0;
  return { get data() { return data; }, async getWithMetadata() { return data ? { data: structuredClone(data), etag: String(v) } : null; },
    async setJSON(k, next, o = {}) { if (o.onlyIfNew && data || o.onlyIfMatch !== undefined && o.onlyIfMatch !== String(v)) return { modified: false }; data = structuredClone(next); v++; return { modified: true }; } };
}
let ca = null;
for (let n = 0; n < 10000 && !ca; n++) {
  const code = String(n).padStart(4, '0'), text = 'code:' + code + ':gehstock:hideout:2026:kellergewoelbe';
  let h = 0x811c9dc5; for (const c of text) { h ^= c.charCodeAt(0); h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0; }
  if (h % 97 === 0) ca = code;
}
async function welt(start = mon, random = () => .5) {
  const uhr = { t: start }, db = store(), presence = store(); let serial = 0;
  const handler = createHandler({ store: db, presenceStore: presence, now: () => uhr.t, random });
  const call = async (op, extra = {}) => { const r = await handler(new Request('http://localhost/api/gehstockmon', { method: 'POST', body: JSON.stringify({ code: ca, op, name: 'Anna', requestId: 'streifzug-' + (++serial), ...extra }) })); return { status: r.status, ...await r.json() }; };
  const a = await call('join');
  const p = () => db.data.players[a.playerId];
  /* Vier freie Mons dazu: je eins jeder Rolle, nirgends im Dienst. */
  p().besitz.push('kieselkrabb', 'wurzelzahn', 'pilzhueter', 'nachtflatter');
  return { uhr, db, call, a, p };
}

await test('A matching role brings half again as much, rare runes come in half, and longer trips pay a little more per hour', () => {
  const r = (id, d) => X.streifzugVorschau(D.mon(id), 'runen', d, 0);
  assert.equal(r('nachtflatter', 180).passt, true, 'a disruptor is made for rune hunting');
  assert.ok(Math.abs(r('nachtflatter', 180).runen - 1.5 * r('kieselkrabb', 180).runen) < 1e-9);
  assert.ok(Math.abs(r('grabesritter', 180).runen - .5 * r('kieselkrabb', 180).runen) < 1e-9, 'legendary runes come at half the count');
  assert.equal(r('grabesritter', 180).runenRang, D.mon('grabesritter').seltenheit, 'and in the rarity of the Mon');
  const jeStunde = (d) => X.streifzugVorschau(D.mon('kieselkrabb'), 'waren', d, 0).gold / (d / 60);
  assert.ok(jeStunde(180) > jeStunde(45), 'long trips are a little better per hour');
  assert.ok(jeStunde(180) <= 20, 'but never more than a camp (20 Gold/h)');
  const g = (n) => X.streifzugVorschau(D.mon('kieselkrabb'), 'waren', 180, n).gold;
  assert.deepEqual([g(0), g(1), g(2), g(3)], [60, 30, 30, 15], 'full gold without land, half with one or two, a quarter from three');
  /* Wer nichts findet, bringt Kleingeld mit. */
  const leer = X.streifzugWuerfeln({ runen: .2, runenRang: 0, gold: 0, ei: .05 }, () => .99);
  assert.deepEqual(leer, { runen: 0, rang: 0, gold: X.STREIFZUG_KLEINGELD, ei: false });
});

await test('Only Mons without duty may go, two at a time, with a valid goal and duration', async () => {
  const w = await welt();
  const kampf = w.p().truppe[0];
  let r = await w.call('streifzug_start', { monId: kampf, ziel: 'runen', dauer: 90 });
  assert.equal(r.status, 400); assert.match(r.error, /im Kampfteam/);
  assert.equal((await w.call('streifzug_start', { monId: 'nachtflatter', ziel: 'fliegen', dauer: 90 })).status, 400, 'unknown goal');
  assert.equal((await w.call('streifzug_start', { monId: 'nachtflatter', ziel: 'runen', dauer: 60 })).status, 400, 'unknown duration');
  r = await w.call('streifzug_start', { monId: 'nachtflatter', ziel: 'runen', dauer: 90 }); assert.equal(r.status, 200, r.error);
  assert.match(r.message, /Zurück um 10:30/, 'the message says when it is back');
  assert.equal((await w.call('streifzug_start', { monId: 'nachtflatter', ziel: 'waren', dauer: 45 })).status, 400, 'the same Mon cannot go twice');
  r = await w.call('streifzug_start', { monId: 'kieselkrabb', ziel: 'waren', dauer: 45 }); assert.equal(r.status, 200, r.error);
  r = await w.call('streifzug_start', { monId: 'pilzhueter', ziel: 'nester', dauer: 45 });
  assert.equal(r.status, 400); assert.match(r.error, /schon 2 Mons/);
});

await test('A Mon on a trip neither fights, defends, joins a dungeon nor hangs on the trading board', async () => {
  const w = await welt();
  assert.equal((await w.call('streifzug_start', { monId: 'nachtflatter', ziel: 'runen', dauer: 180 })).status, 200);
  const squad = w.p().truppe.slice(0, 3).concat('nachtflatter');
  let r = await w.call('defend', { squad }); assert.equal(r.status, 400); assert.match(r.error, /auf Streifzug/);
  r = await w.call('tausch_anbieten', { gebe: 'nachtflatter', suche: 'rostknirps' });
  assert.equal(r.status, 400); assert.match(r.error, /Streifzug/);
  assert.equal(X.truppePruefen(w.p(), squad), 'Nachtflatter ist gerade auf Streifzug.');
  assert.ok(!(X.staerksteTruppe(w.p()) || []).includes('nachtflatter'), 'auto-garrisons leave it alone');
  assert.deepEqual(X.einsatzOrte(w.p(), 'nachtflatter'), ['streifzug'], 'the collection shows where it is');
});

await test('The clock runs on open time, the result is fixed at the start and paid exactly on return', async () => {
  /* Montag 12:30 los, 90 Minuten: 30 bis Schulschluss, 60 am Dienstag ab 7 Uhr. */
  const w = await welt(Date.parse('2026-10-05T12:30:00+02:00'));
  let r = await w.call('streifzug_start', { monId: 'pilzhueter', ziel: 'nester', dauer: 90 });
  assert.equal(r.status, 200, r.error); assert.match(r.message, /morgen um 08:00/);
  const zug = w.p().streifzuege[0];
  assert.equal(zug.fertigAt, Date.parse('2026-10-06T08:00:00+02:00'));
  const vorher = { gold: w.p().gold, eier: w.p().eggs.length, runen: w.p().runes.slice() }, e = zug.ergebnis;
  w.uhr.t = Date.parse('2026-10-06T07:59:00+02:00');
  r = await w.call('streifzug_abholen', { streifzugId: zug.id });
  assert.equal(r.status, 400); assert.match(r.error, /Noch unterwegs/);
  w.uhr.t = Date.parse('2026-10-06T08:00:00+02:00');
  r = await w.call('streifzug_abholen', { streifzugId: zug.id }); assert.equal(r.status, 200, r.error);
  assert.equal(w.p().gold - vorher.gold >= e.gold, true, 'the rolled gold arrives (plus whatever else the day brought)');
  assert.equal(w.p().eggs.filter((x) => x.art === 'streifzug').length, e.ei ? 1 : 0, 'the rolled egg arrives, marked as a trip egg');
  assert.equal(w.p().runes[e.rang] - vorher.runen[e.rang], e.runen);
  assert.equal(w.p().streifzuege.length, 0); assert.equal(w.p().streifzuegeGesamt, 1);
  assert.equal((await w.call('streifzug_abholen', { streifzugId: zug.id })).status, 400, 'and only once');
});

await test('An egg from a trip lands in the bag; the morning report says who is back', async () => {
  const w = await welt(mon, () => 0);
  /* Mit fester Ziehung 0 ergibt die zweite Ziehung der Folge den Ei-Wurf - hier
     wird das Ergebnis gezielt gesetzt, gewuerfelt ist schon getestet. */
  assert.equal((await w.call('streifzug_start', { monId: 'pilzhueter', ziel: 'nester', dauer: 45 })).status, 200);
  w.p().streifzuege[0].ergebnis = { runen: 0, rang: 0, gold: 0, ei: true };
  w.uhr.t = mon + 3 * 3600000;
  const bericht = (await w.call('join')).morgenbericht;
  assert.ok(bericht && bericht.zeilen.some((z) => /Streifzug ist zurück/.test(z.text)), 'the report mentions the return');
  const r = await w.call('streifzug_abholen', { streifzugId: w.p().streifzuege[0].id });
  assert.equal(r.status, 200, r.error); assert.match(r.message, /ein Ei/);
  assert.ok(r.profile.eggs.some((x) => x.art === 'streifzug'));
});

await test('Twenty-five trips earn the Streifzuegler title', () => {
  const t = X.TITEL.find((v) => v.id === 'streifzuegler');
  assert.ok(t); assert.equal(t.wert({ streifzuegeGesamt: 25 }) >= t.ziel, true);
});

console.log('\n' + checks + ' Streifzug-Pruefungen bestanden.');
