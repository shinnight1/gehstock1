/* Handel und Gemeinschaft (27.09.2026): Kurierdienst, Markthalle mit
   Gebietsabgabe, Runenhandel beim Haendler und die Wochenbilanz. */
import assert from 'node:assert/strict';
import { data as D, economy as E, hours as H, adventure as X } from '../netlify/functions/lib/gehstockmon-rules.mjs';
import { createHandler } from '../netlify/functions/gehstockmon.mjs';

const at = (s) => Date.parse(s), mon = at('2026-09-21T08:00:00+02:00'), STUNDE = 3600000;
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
  const uhr = { t: start }, db = store(), presence = store(); let serial = 0, writes = 0;
  const schreiben = db.setJSON; db.setJSON = async (...a) => { writes++; return schreiben(...a); };
  const handler = createHandler({ store: db, presenceStore: presence, now: () => uhr.t, random });
  const call = async (code, op, extra = {}) => {
    const r = await handler(new Request('http://localhost/api/gehstockmon', { method: 'POST', body: JSON.stringify({ code, op, name: code === ca ? 'Anna' : 'Ben', requestId: 'handel-' + (++serial), ...extra }) }));
    return { status: r.status, ...await r.json() };
  };
  /* Stellt eine Figur direkt an einen Punkt - ob der Weg dorthin begehbar
     ist, prueft der Wegetest; hier geht es um die Regeln am Ziel. */
  const hinstellen = async (id, punkt) => {
    const p = db.data.players[id], alt = (await presence.getWithMetadata())?.data?.players || {};
    await presence.setJSON('presence-v1', { players: { ...alt, [id]: { id, name: p.name, x: punkt.x, z: punkt.z, heading: 0, activity: 'map', updatedAt: uhr.t,
      spawnAt: p.lastJoinAt, credit: 33, skin: p.skin, weapon: p.weapon, squad: p.truppe.slice(), protected: false, eier: p.eggs.length } } });
  };
  const a = await call(ca, 'join');
  return { uhr, db, call, hinstellen, id: a.playerId, p: () => db.data.players[a.playerId], writes: () => writes, a };
}
const tor = (w, id) => X.tor(X.layout(w.db.data.territories), id);
function auftrag(von, nach, eilig = false, nummer = 900) {
  const a = { id: 'k' + nummer, von, nach, ware: 'Proviant', eilig };
  a.lohn = X.kurierLohn(X.kurierRunde(a));
  return a;
}
function besitzen(w, ids, owner = w.id, now = w.uhr.t) {
  for (const i of ids) Object.assign(w.db.data.territories[i - 1], { ownerId: owner, ownerName: 'Anna', ...E.outpost(null, now) });
}

await test('The stored courier distances are the real walks around every wall, and pay runs from 12 to 35', () => {
  const layout = X.layout(D.FELDER.map((f) => ({ id: f.id, ownerId: null })));
  for (let a = 0; a <= D.FELDER.length; a++) for (let b = 0; b <= D.FELDER.length; b++) {
    if (a === b) continue;
    const von = X.kurierOrt(layout, a), weg = X.route(layout, von, X.kurierOrt(layout, b), 'kurier');
    assert.ok(weg, a + ' -> ' + b + ' is walkable');
    let s = 0, c = von; for (const q of weg) { s += Math.hypot(q.x - c.x, q.z - c.z); c = q; }
    assert.ok(Math.abs(s - X.kurierWeg(a, b)) <= 2, a + ' -> ' + b + ': measured ' + Math.round(s) + ', stored ' + X.kurierWeg(a, b));
  }
  const loehne = [];
  for (let v = 0; v <= 9; v++) for (let n = 1; n <= 9; n++) if (v !== n) loehne.push(X.kurierLohn(X.kurierRunde({ von: v, nach: n })));
  assert.equal(Math.min(...loehne), 12, 'the Tauwiese round trip is the cheapest');
  assert.equal(Math.max(...loehne), 35);
  /* Jobs never start or end at one's own outposts. */
  let seed = 7; const zufall = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296), eigene = [1, 2, 3, 4, 5, 6, 7];
  let eilig = 0, abHafen = 0;
  for (let i = 0; i < 400; i++) {
    const j = X.kurierAuftrag(zufall, eigene, i);
    assert.ok(!eigene.includes(j.nach) && !eigene.includes(j.von) && j.von !== j.nach && j.nach > 0);
    eilig += j.eilig; abHafen += j.von === 0;
  }
  assert.ok(eilig > 60 && eilig < 140, 'about one in four is urgent: ' + eilig);
  assert.ok(abHafen > 240 && abHafen < 320, 'most start at the office: ' + abHafen);
});

await test('A newcomer finds five jobs; after that one more comes each open hour, and a full board holds its clock', async () => {
  const w = await welt();
  assert.equal(w.a.profile.kurierBrett.length, X.KURIER_VORRAT, 'the first visit finds a full board');
  /* w.p() jedes Mal neu: jeder Aufruf legt die Welt als neue Kopie ab. */
  w.p().kurierBrett = []; w.p().kurierAt = mon;
  w.uhr.t = mon + 59 * 60000; assert.equal((await w.call(ca, 'world')).profile.kurierBrett.length, 0);
  w.uhr.t = mon + STUNDE; assert.equal((await w.call(ca, 'world')).profile.kurierBrett.length, 1, 'one per open hour');
  /* Nachts und am Wochenende kommt nichts dazu: Freitag 12:00 bis Montag 7:30 sind 1,5 offene Stunden. */
  const fr = at('2026-09-25T12:00:00+02:00'); w.p().kurierBrett = []; w.p().kurierAt = fr; w.uhr.t = at('2026-09-28T07:30:00+02:00');
  assert.equal((await w.call(ca, 'world')).profile.kurierBrett.length, 1);
  /* Voll bleibt voll: wer eine Woche fehlt, findet fuenf - und keinen sechsten dahinter. */
  w.uhr.t += 7 * 86400000; let r = await w.call(ca, 'world');
  assert.equal(r.profile.kurierBrett.length, X.KURIER_VORRAT);
  await w.hinstellen(w.id, X.STADT_TOR);
  const erster = w.p().kurierBrett.find((a) => a.von === 0) || Object.assign(w.p().kurierBrett[0], { von: 0 });
  r = await w.call(ca, 'kurier_annehmen', { auftragId: erster.id }); assert.equal(r.status, 200, r.error);
  assert.equal(r.profile.kurierBrett.length, X.KURIER_VORRAT - 1);
  w.uhr.t += 59 * 60000; assert.equal((await w.call(ca, 'world')).profile.kurierBrett.length, X.KURIER_VORRAT - 1, 'the clock started when the board had room');
  w.uhr.t += 60000; assert.equal((await w.call(ca, 'world')).profile.kurierBrett.length, X.KURIER_VORRAT);
});

await test('Picking up needs the pickup spot, delivering needs the gate, and the wage follows the land', async () => {
  const w = await welt();
  w.p().kurierBrett = [auftrag(0, 2, false, 901), auftrag(0, 3, false, 902)];
  let r = await w.call(ca, 'kurier_annehmen', { auftragId: 'k901' });
  assert.equal(r.status, 400); assert.match(r.error, /Kartenposition/);
  await w.hinstellen(w.id, tor(w, 2));
  r = await w.call(ca, 'kurier_annehmen', { auftragId: 'k901' });
  assert.equal(r.status, 400); assert.match(r.error, /Stockhafen/, 'the parcel waits at the office');
  await w.hinstellen(w.id, X.STADT_TOR);
  r = await w.call(ca, 'kurier_annehmen', { auftragId: 'k901' }); assert.equal(r.status, 200, r.error);
  assert.equal(r.profile.kurier.nach, 2); assert.deepEqual(r.profile.kurierBrett.map((a) => a.id), ['k902']);
  r = await w.call(ca, 'kurier_annehmen', { auftragId: 'k902' }); assert.equal(r.status, 400); assert.match(r.error, /schon ein Paket/);
  r = await w.call(ca, 'kurier_abliefern'); assert.equal(r.status, 400); assert.match(r.error, /Tor von Flüsterufer/);
  const vorher = w.p().gold, lohn = auftrag(0, 2).lohn;
  await w.hinstellen(w.id, tor(w, 2));
  r = await w.call(ca, 'kurier_abliefern'); assert.equal(r.status, 200, r.error);
  assert.equal(w.p().gold - vorher, lohn, 'without land the full wage');
  assert.equal(r.profile.kurier, null); assert.equal(r.profile.kurierGesamt, 1);
  assert.equal(E.bilanzSicht(w.p(), w.uhr.t).diese.rein.kurier, lohn, 'and the ledger knows where it came from');
  assert.equal((await w.call(ca, 'kurier_abliefern')).status, 400, 'a parcel pays exactly once');
  /* Mit einem Gebiet die Haelfte - dasselbe Mass wie bei den Streifzuegen. */
  besitzen(w, [5]);
  await w.hinstellen(w.id, X.STADT_TOR);
  assert.equal((await w.call(ca, 'kurier_annehmen', { auftragId: 'k902' })).status, 200);
  await w.hinstellen(w.id, tor(w, 3));
  const davor = w.p().gold;
  r = await w.call(ca, 'kurier_abliefern'); assert.equal(r.status, 200, r.error);
  assert.equal(w.p().gold - davor, Math.round(auftrag(0, 3).lohn * .5));
  /* Abholen an einem Tor und zurueckgeben. */
  w.p().kurierBrett = [auftrag(4, 8, false, 903)];
  await w.hinstellen(w.id, X.STADT_TOR);
  assert.match((await w.call(ca, 'kurier_annehmen', { auftragId: 'k903' })).error, /Tor von Nebelwald/);
  await w.hinstellen(w.id, tor(w, 4));
  assert.equal((await w.call(ca, 'kurier_annehmen', { auftragId: 'k903' })).status, 200);
  r = await w.call(ca, 'kurier_abbrechen'); assert.equal(r.status, 200); assert.equal(r.profile.kurier, null);
  assert.equal(r.profile.kurierBrett.length, 0, 'a returned job is gone - no rerolling for a better one');
});

await test('An urgent parcel pays half again inside its deadline and the normal wage after it', async () => {
  const w = await welt();
  const eil = auftrag(0, 7, true, 904), spaet = auftrag(0, 7, true, 905);
  w.p().kurierBrett = [eil, spaet];
  await w.hinstellen(w.id, X.STADT_TOR);
  assert.equal((await w.call(ca, 'kurier_annehmen', { auftragId: 'k904' })).status, 200);
  assert.equal(w.p().kurier.frist, w.uhr.t + X.kurierFrist(eil));
  w.uhr.t += X.kurierFrist(eil) - 1000; await w.hinstellen(w.id, tor(w, 7));
  let vorher = w.p().gold, r = await w.call(ca, 'kurier_abliefern');
  assert.equal(r.status, 200, r.error); assert.equal(w.p().gold - vorher, Math.round(eil.lohn * X.KURIER_EIL)); assert.equal(r.kurier.eil, true);
  await w.hinstellen(w.id, X.STADT_TOR);
  assert.equal((await w.call(ca, 'kurier_annehmen', { auftragId: 'k905' })).status, 200);
  w.uhr.t += X.kurierFrist(spaet) + 1000; await w.hinstellen(w.id, tor(w, 7));
  vorher = w.p().gold; r = await w.call(ca, 'kurier_abliefern');
  assert.equal(w.p().gold - vorher, spaet.lohn, 'late is still paid, just without the bonus'); assert.match(r.message, /Eilfrist war vorbei/);
});

await test('A tenth of all territory gold goes into the market hall while it is built, and none once it stands', async () => {
  const w = await welt();
  besitzen(w, [6]);                         // Tauwiese, Lager: 20 Gold je offene Stunde
  const start = w.p().gold;
  w.uhr.t = mon + STUNDE; let r = await w.call(cb, 'join');
  assert.equal(w.p().gold - start, 18, 'nine tenths arrive');
  assert.equal(w.db.data.bauten.markthalle.gold, 2); assert.equal(w.db.data.bauten.markthalle.abgabe, 2);
  const b = E.bilanzSicht(w.p(), w.uhr.t).diese;
  assert.equal(b.rein.gebiete, 20, 'the ledger shows the full yield'); assert.equal(b.raus.abgabe, 2, 'and the levy as an expense');
  assert.equal(r.handel.abgabe, E.ABGABE);
  /* Bis Dienstag 8 Uhr: noch fuenf offene Stunden (Montag 9-13, Dienstag 7-8)
     zu 20 Gold, davon 10 in die Halle, dazu das Tagesgeld: 150, davon 15. */
  w.uhr.t = at('2026-09-22T08:00:00+02:00'); await w.call(cb, 'world');
  assert.equal(w.p().dailyGoldPending, 135); assert.equal(w.db.data.bauten.markthalle.abgabe, 2 + 10 + 15);
  /* Steht die Halle, geht die Abgabe in den Hafenkran; braucht kein Bau mehr Gold, ruht sie. */
  w.db.data.bauten.markthalle.gold = X.bau('markthalle').ziel; w.db.data.bauten.markthalle.fertigAm = w.uhr.t;
  w.db.data.bauten.hafenkran.gold = X.bau('hafenkran').ziel;
  const davor = w.p().gold; w.uhr.t += STUNDE; r = await w.call(cb, 'world');
  assert.equal(w.p().gold - davor, 20); assert.equal(r.handel.abgabe, 0);
});

await test('A world poll that only moves income and levy still writes nothing', async () => {
  const w = await welt();
  besitzen(w, [1]); w.db.data.territories[0].level = 3; w.uhr.t += 1000; await w.call(ca, 'world');   // Festung: 55 Gold je Stunde
  const n = w.writes(); w.uhr.t += 30000; const erste = await w.call(ca, 'world');
  w.uhr.t += 140000; const zweite = await w.call(ca, 'world');
  assert.equal(w.writes(), n, 'gold, ledger and levy count on without a write');
  assert.ok(zweite.profile.gold > erste.profile.gold);
});

await test('Donations build the hall, the last coin finishes it, and everyone hears about it', async () => {
  const w = await welt();
  w.p().gold = 7000;
  assert.match((await w.call(ca, 'bau_spenden', { bauId: 'markthalle', betrag: 5 })).error, /Mindestens 10/);
  assert.match((await w.call(ca, 'bau_spenden', { bauId: 'markthalle', betrag: 9000 })).error, /So viel Gold/);
  let r = await w.call(ca, 'bau_spenden', { bauId: 'markthalle', betrag: 5995 }); assert.equal(r.status, 200, r.error);
  assert.equal(w.p().gold, 1005); assert.equal(r.handel.bauten[0].eigen, 5995); assert.equal(r.handel.bauten[0].tafel[0].name, 'Anna');
  r = await w.call(ca, 'bau_spenden', { bauId: 'markthalle', betrag: 250 }); assert.equal(r.status, 200, r.error);
  assert.equal(w.p().gold, 1000, 'only what was missing is taken'); assert.equal(r.handel.bauten[0].fertig, true);
  assert.match(r.message, /steht/); assert.ok(w.db.data.ticker.some((t) => /Markthalle steht/.test(t.text)));
  assert.equal(E.bilanzSicht(w.p(), w.uhr.t).diese.raus.spende, 6000);
  assert.match((await w.call(ca, 'bau_spenden', { bauId: 'markthalle', betrag: 50 })).error, /steht bereits/);
});

await test('Runes trade only once the hall stands, at fixed prices and within weekly limits', async () => {
  /* Hin und zurueck verliert man immer, auch ueber die Schmiede. */
  for (let r = 0; r < X.RUNEN_PREISE.length; r++) {
    assert.ok(X.runenAnkauf(r) < X.RUNEN_PREISE[r]);
    if (r > 0) assert.ok(X.RUNEN_PREISE[r] + X.schmiedeKosten('zerlegen', r) > 2 * X.runenAnkauf(r - 1), 'buy and split ' + r);
    if (r < X.RUNEN_PREISE.length - 1) assert.ok(3 * X.RUNEN_PREISE[r] + X.schmiedeKosten('verschmelzen', r) > X.runenAnkauf(r + 1), 'buy and merge ' + r);
  }
  const w = await welt();
  w.p().gold = 5000; w.p().runes[6] = 5; w.p().runes[3] = 1;
  assert.match((await w.call(ca, 'runen_kaufen', { rang: 4 })).error, /Markthalle/);
  /* Die Halle steht. Ohne Gebietsbesitzer war sie noch nie gespeichert - sie entsteht beim ersten Gebrauch. */
  w.db.data.bauten = { markthalle: { gold: X.bau('markthalle').ziel, abgabe: 0, spender: {}, fertigAm: w.uhr.t } };
  for (let i = 0; i < 12; i++) assert.equal((await w.call(ca, 'runen_kaufen', { rang: 4 })).status, 200);
  assert.equal(w.p().runes[4], 12); assert.equal(w.p().gold, 5000 - 960);
  let r = await w.call(ca, 'runen_kaufen', { rang: 4 }); assert.equal(r.status, 400); assert.match(r.error, /nur noch Runen für 40 Gold/);
  assert.equal((await w.call(ca, 'runen_kaufen', { rang: 0 })).status, 200, 'a cheap one still fits under the limit');
  r = await w.call(ca, 'runen_verkaufen', { rang: 6 }); assert.equal(r.status, 200); assert.equal(r.handel.runen.verkaufFrei, 500 - 168);
  assert.equal((await w.call(ca, 'runen_verkaufen', { rang: 6 })).status, 200);
  r = await w.call(ca, 'runen_verkaufen', { rang: 6 }); assert.equal(r.status, 400, 'the third would pass 500 Gold');
  assert.equal((await w.call(ca, 'runen_verkaufen', { rang: 3 })).status, 200);
  assert.match((await w.call(ca, 'runen_verkaufen', { rang: 5 })).error, /keine Mythisch-Rune/);
  /* Am Montag geht es von vorn los. */
  w.uhr.t = at('2026-09-28T08:00:00+02:00');
  assert.equal((await w.call(ca, 'runen_verkaufen', { rang: 6 })).status, 200);
  r = await w.call(ca, 'runen_kaufen', { rang: 4 }); assert.equal(r.status, 200);
  assert.equal(r.handel.runen.kaufFrei, X.RUNEN_KAUF_DECKEL - 80);
});

await test('The weekly ledger rolls over on Monday, keeps one week back and cleans up stored values', async () => {
  const p = D.neuerStand(null, mon);
  E.buchen(p, 80, 'tagwerk', mon); E.buchen(p, -350, 'eier', mon); E.buchen(p, 0, 'arena', mon);
  let s = E.bilanzSicht(p, mon);
  assert.deepEqual(s.diese, { rein: { tagwerk: 80 }, raus: { eier: 350 } }); assert.equal(s.vorige, null);
  const naechste = mon + 7 * 86400000;
  E.buchen(p, 25, 'trainer', naechste);
  s = E.bilanzSicht(p, naechste);
  assert.deepEqual(s.diese.rein, { trainer: 25 }); assert.deepEqual(s.vorige.rein, { tagwerk: 80 });
  assert.equal(E.bilanzSicht(p, naechste + 14 * 86400000).vorige, null, 'two weeks on, nothing is left');
  const sauber = D.neuerStand({ ...p, bilanz: { woche: E.woche(naechste), rein: { trainer: 25, erfunden: 99, arena: -5 }, raus: { eier: 'viel' } } }, naechste);
  assert.deepEqual(sauber.bilanz.rein, { trainer: 25 }); assert.deepEqual(sauber.bilanz.raus, {});
  /* Auf dem Server bucht jede Quelle mit: Tagwerk in der Stadt, der Eierhaendler. */
  const w = await welt();
  await w.hinstellen(w.id, X.STADT_TOR);
  w.p().tagwerkAt = X.schonReif(w.uhr.t, X.TAGWERK_ZEIT, 1); w.p().gold = 1000;
  assert.equal((await w.call(ca, 'tagwerk')).status, 200);
  assert.equal((await w.call(ca, 'ei_kaufen')).status, 200);
  const b = E.bilanzSicht(w.p(), w.uhr.t).diese;
  assert.equal(b.rein.tagwerk, X.TAGWERK_LOHN); assert.equal(b.raus.eier, X.HAENDLER_EI_PREIS);
});

await test('The morning report mentions a parcel still carried and sums up last week on Monday', async () => {
  const w = await welt(at('2026-09-25T11:00:00+02:00'));
  E.buchen(w.p(), 400, 'arena', w.uhr.t); E.buchen(w.p(), -100, 'wesen', w.uhr.t);
  w.p().kurier = { ...auftrag(0, 9, false, 906), seit: w.uhr.t, frist: null };
  w.uhr.t = at('2026-09-28T08:00:00+02:00');
  const bericht = (await w.call(ca, 'join')).morgenbericht;
  assert.ok(bericht, 'there is a report');
  const texte = bericht.zeilen.map((z) => z.text).join('\n');
  assert.match(texte, /trägst noch Proviant nach Weltenschlund/);
  assert.match(texte, /Letzte Woche: \+400 Gold eingenommen, −100 ausgegeben · das meiste aus Große Arena/);
});

console.log('\n' + checks + ' Handels-Pruefungen bestanden.');
