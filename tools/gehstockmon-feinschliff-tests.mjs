/* Feinschliff vom 27.09.2026: Nebelwald als echte Mittelstufe, Arena-Lohn
   nach Gegnerstaerke, halbes Tagesgeld ab dem dritten Gebiet und ein
   Blendstoss, den die KI nur noch einsetzt, wenn er etwas nimmt. */
import assert from 'node:assert/strict';
import { data as D, economy as E, arena as A, adventure as X } from '../netlify/functions/lib/gehstockmon-rules.mjs';
import { createHandler } from '../netlify/functions/gehstockmon.mjs';
import { stadtSettle } from '../netlify/functions/lib/gehstockmon-stadt.mjs';

const mon = Date.parse('2026-09-21T09:00:00+02:00');
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
const spiegeln = (s) => ({ ...s, teams: [s.teams[1], s.teams[0]], active: [s.active[1], s.active[0]] });
function kaempfen(s) {
  for (let n = 0; n < 500 && s.phase !== 'finished'; n++) {
    if (s.phase === 'replace') s = A.turn(s, { kind: 'switch', slot: s.teams[0].findIndex((u) => u.hp > 0) });
    else { const zug = A.ai(spiegeln(s)), m = A.moves(s.teams[0][s.active[0]], s.round).filter((x) => x.enabled);
      s = A.turn(s, { kind: 'move', move: m.some((x) => x.id === zug) ? zug : m[0].id }); }
  }
  return s.winner === 'wir' ? 1 : 0;
}
const staerke = (id) => { const s = A.create([D.mon('moosling')], A.defenders(id), { territoryId: id, npcTerritory: true, level: 1 }); return s.teams[1].reduce((a, u) => a + Math.sqrt(u.maxHp * u.ang), 0); };

await test('Nebelwald is a real step between the medium territories and Frostkrone', () => {
  assert.equal(D.FELDER[3].name, 'Nebelwald'); assert.equal(D.FELDER[3].difficulty, 'Schwer');
  const nebel = staerke(4);
  assert.ok(nebel > staerke(2) * 1.4 && nebel > staerke(3) * 1.4, 'clearly harder than both "Mittel" fields');
  assert.ok(nebel < staerke(5), 'but below Frostkrone');
  assert.equal(A.defenders(4)[0].typ, 0, 'a wall stands in front - the lesson of the field');
  /* Die Startertruppe kommt kaum noch durch, eine aussergewoehnliche Truppe schon. */
  const reihen = [D.STARTER, ['moosling', 'glutfuchs', 'nebelmolch', 'rostknirps'].reverse()];
  const starter = reihen.map((t) => kaempfen(A.create(t.map(D.mon), A.defenders(4), { territoryId: 4, npcTerritory: true, level: 1, id: 'n', now: 0 })));
  assert.ok(starter.reduce((a, b) => a + b, 0) < reihen.length, 'the starter squad no longer walks through');
  const stark = kaempfen(A.create(['bernsteinkaefer', 'donnerwidder', 'korallenwacht', 'obsidianrabe'].map(D.mon), A.defenders(4), { territoryId: 4, npcTerritory: true, level: 1, id: 'm', now: 0 }));
  assert.equal(stark, 1, 'four exceptional Mons take it');
});

await test('A ladder win pays by the strength of the opponent', async () => {
  assert.deepEqual([X.arenaLohn('leichter'), X.arenaLohn('ausgeglichen'), X.arenaLohn('schwerer')], [15, 45, 70]);
  assert.equal(X.arenaLohn(undefined), X.ARENA_LOHN, 'a fight started before the change pays the old amount');
  for (const [stufe, lohn] of [['leichter', 15], ['ausgeglichen', 45], ['schwerer', 70]]) {
    const p = { ...D.neuerStand(null, mon), gold: 0, arena: { kind: 'rang', winner: 'wir', phase: 'finished', einstufung: stufe, gegnerName: 'Pim' } };
    const world = { players: { me: p }, reports: [], territories: [] };
    stadtSettle(world, p, 'me', mon);
    assert.equal(p.gold, lohn, stufe + ' pays ' + lohn);
    assert.match(p.arena.message, new RegExp('\\+' + lohn + ' Gold'));
  }
  const p = { ...D.neuerStand(null, mon), gold: 0, arena: { kind: 'rang', winner: 'sie', phase: 'finished', einstufung: 'schwerer', gegnerName: 'Hald' } };
  stadtSettle({ players: { me: p }, reports: [], territories: [] }, p, 'me', mon);
  assert.equal(p.gold, X.ARENA_TROST, 'a loss keeps its consolation, whoever it was against');
  /* Und der Server haelt die Stufe beim Start fest: eine starke Truppe gegen Pim ist "leichter". */
  const db = store(), presence = store(); let serial = 0;
  const handler = createHandler({ store: db, presenceStore: presence, now: () => mon });
  const call = async (op, extra = {}) => { const r = await handler(new Request('http://localhost/api/gehstockmon', { method: 'POST', body: JSON.stringify({ code: ca, op, name: 'Anna', requestId: 'feinschliff-' + (++serial), ...extra }) })); return { status: r.status, ...await r.json() }; };
  const a = await call('join'), stark = ['endrichter', 'nullwyrm', 'risskaiser', 'aetherdrache'];
  db.data.players[a.playerId].besitz.push(...stark); db.data.players[a.playerId].truppe = stark.slice();
  const pl = db.data.players[a.playerId];
  await presence.setJSON('presence-v1', { players: { [a.playerId]: { id: a.playerId, name: 'Anna', x: X.STADT_TOR.x, z: X.STADT_TOR.z, heading: 0, activity: 'map', updatedAt: mon, spawnAt: pl.lastJoinAt, credit: 33, skin: pl.skin, weapon: pl.weapon, squad: stark, protected: false, eier: 0 } } }, {});
  const r = await call('arena_rang', { targetId: 'haus-1' });
  assert.equal(r.status, 200, r.error); assert.equal(r.arena.einstufung, 'leichter');
  const liste = (await call('world')).turnier.gegner.find((g) => g.id === 'haus-1');
  assert.equal(liste.einstufung, 'leichter', 'the list shows the same class the fight pays by');
});

await test('The daily gold follows the income share: half from the third territory on', async () => {
  const db = store(), presence = store(); let serial = 0, uhr = mon;
  const handler = createHandler({ store: db, presenceStore: presence, now: () => uhr });
  const call = async (op, extra = {}) => { const r = await handler(new Request('http://localhost/api/gehstockmon', { method: 'POST', body: JSON.stringify({ code: ca, op, name: 'Anna', requestId: 'tagesgeld-' + (++serial), ...extra }) })); return { status: r.status, ...await r.json() }; };
  const a = await call('join');
  for (const i of [0, 1, 2]) Object.assign(db.data.territories[i], { ownerId: a.playerId, ownerName: 'Anna', ...E.outpost(null, mon) });
  db.data.players[a.playerId].dailyGoldPending = 0;
  uhr = mon + 86400000;
  await call('world');
  /* Je Gebiet geht ein Zehntel als Abgabe in die Markthalle (E.ABGABE). */
  const netto = [E.DAILY_GOLD, E.DAILY_GOLD, E.DAILY_GOLD / 2].reduce((s, v) => s + v - Math.round(v * E.ABGABE), 0);
  assert.equal(netto, 337);
  assert.equal(db.data.players[a.playerId].dailyGoldPending, netto, 'two full, the third half, each less the levy');
  const r = await call('join');
  assert.equal(r.dailyDelivery, netto, 'and that is what arrives');
});

await test('The AI uses Blendstoss only when the other side has a charge to lose', () => {
  const blend = A.FAEHIGKEITEN[3].findIndex((f) => f.id === 'blendstoss');
  const s = A.create([D.mon('bollwerk')], [D.mon('kristallspinne')], { id: 'b', now: 0 });
  s.teams[1][0].skill = blend; s.round = 2; s.teams[1][0].powerReady = 9;
  s.teams[0][0].charges = 0;
  assert.notEqual(A.ai(s), 'special', 'nothing to take - no Blendstoss');
  s.teams[0][0].charges = 1;
  assert.equal(A.ai(s), 'special', 'a charge to take - Blendstoss');
  assert.ok(A.FAEHIGKEITEN[3][blend].faktor < A.FAEHIGKEITEN[3][0].faktor, 'it still hits softer than Runenstoerung');
});

console.log('\n' + checks + ' Feinschliff-Pruefungen bestanden.');
