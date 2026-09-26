/* Die Aenderungen vom 27. September 2026: Trainer auf dem eigenen Niveau,
   halber Ertrag ab dem dritten Gebiet, die dauerhafte Arena-Bilanz und
   Kampfverlaeufe ausserhalb des Weltdokuments. Nur lokale Speicher. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { data as D, economy as E, arena as A, adventure as X } from '../netlify/functions/lib/gehstockmon-rules.mjs';
import { trainerTruppe, TRAINER_FAKTOR } from '../netlify/functions/lib/gehstockmon-adventure.mjs';
import { stadtSettle, arenaEinstufung, arenaEmpfehlung } from '../netlify/functions/lib/gehstockmon-stadt.mjs';
import { createHandler, _verlaeufe } from '../netlify/functions/gehstockmon.mjs';
import { _redisStore } from '../netlify/functions/lib/speicher.mjs';
import { speicherClient } from '../netlify/functions/lib/redis-lokal.mjs';

let checks = 0;
async function test(name, fn) { await fn(); checks++; console.log('ok', name); }
const offen = Date.parse('2026-09-23T10:00:00+02:00');

function spieler(truppe, stufe) {
  const p = D.neuerStand(null, offen);
  p.besitz = [...new Set([...p.besitz, ...truppe])]; p.truppe = truppe.slice();
  truppe.forEach((id, i) => { const s = Array.isArray(stufe) ? stufe[i] : stufe; if (s) p.monUpgrades[id] = s; });
  return p;
}
const rang = (r) => D.KATALOG.filter((k) => k.seltenheit === r).slice(0, 4).map((k) => k.id);

await test('Trainer bleiben unter der eigenen Staerke, Seltenheit und Runenstufe', () => {
  const zufall = E.zufallsfolge(0.31);
  for (const [r, stufe] of [[0, 0], [1, 1], [2, 2], [3, 3], [4, 5], [5, 4], [6, 5]]) {
    const p = spieler(rang(r), stufe);
    const eigene = p.truppe.map((id) => X.mon(p, id)), staerke = A.staerke(eigene);
    for (const faktor of TRAINER_FAKTOR) {
      const team = trainerTruppe(p, faktor, zufall);
      assert.ok(team.length >= 1 && team.length <= 4, 'Rang ' + r + ': Truppengroesse');
      for (const m of team) {
        assert.ok(m.seltenheit <= r, 'Rang ' + r + ': nie seltener als die eigene Truppe');
        assert.ok(X.upgradeLevel(m.upgrade) <= stufe, 'Rang ' + r + ': nie hoeher gestuft');
      }
      assert.ok(A.staerke(team) <= staerke * faktor * 1.03 + 1, 'Rang ' + r + ': hoechstens 3 % ueber dem Ziel');
    }
  }
});

await test('Ab der zweiten Seltenheit tritt der Trainer mit voller Truppe und nah am Ziel an', () => {
  const zufall = E.zufallsfolge(0.77);
  for (const r of [2, 3, 4]) {
    const p = spieler(rang(r), 2), staerke = A.staerke(p.truppe.map((id) => X.mon(p, id)));
    const team = trainerTruppe(p, 1, zufall);
    assert.equal(team.length, 4);
    assert.ok(A.staerke(team) >= staerke * 0.88, 'Rang ' + r + ': nicht viel schwaecher als gleich stark');
  }
});

await test('Trainer ohne Truppe fallen auf die Einsteigergegner zurueck', () => {
  const p = D.neuerStand(null, offen); p.truppe = [];
  assert.deepEqual(trainerTruppe(p, 1, Math.random).map((m) => m.id), ['blattschleicher', 'tauhupfer']);
});

await test('Die zwei ertragreichsten Gebiete zahlen voll, jedes weitere die Haelfte', () => {
  const t = [
    { id: 1, ownerId: 'a', level: 1, capturedAt: 1 }, { id: 2, ownerId: 'a', level: 3, capturedAt: 5 },
    { id: 3, ownerId: 'a', level: 3, capturedAt: 2 }, { id: 4, ownerId: 'a', level: 2, capturedAt: 3 },
    { id: 5, ownerId: 'b', level: 1, capturedAt: 4 }, { id: 6, ownerId: null, level: 1 },
  ];
  assert.deepEqual(E.ertragsAnteile(t), { 1: 0.5, 2: 1, 3: 1, 4: 0.5, 5: 1 });
  const p = D.neuerStand(null, offen), voll = E.outpost(null, offen), halb = E.outpost(null, offen), q = D.neuerStand(null, offen);
  const gold = p.gold;
  E.settle(p, voll, offen + 2 * E.HOUR); E.settle(q, halb, offen + 2 * E.HOUR, 0.5);
  assert.equal(p.gold - gold, 2 * E.LEVELS[1].income);
  assert.equal(q.gold - gold, E.LEVELS[1].income);
});

await test('Die Arena-Bilanz zaehlt weiter, auch wenn der Titelkampf die Rangsiege nullt', () => {
  const p = D.neuerStand(null, offen), welt = { players: { ich: p }, reports: [], ticker: [] };
  p.arena = { kind: 'rang', phase: 'finished', winner: 'wir', gegnerName: 'Pim' };
  stadtSettle(welt, p, 'ich', offen);
  assert.equal(p.arenaSiege, 1); assert.equal(p.arenaSiegeGesamt, 1);
  p.arenaSiege = 0;
  const neu = D.neuerStand(p, offen);
  assert.equal(neu.arenaSiegeGesamt, 1, 'die Bilanz ueberlebt das Normalisieren');
  assert.equal(D.neuerStand({ arenaSiege: 2 }, offen).arenaSiegeGesamt, 2, 'alte Staende starten mit ihren Rangsiegen');
});

await test('Arena-Einstufung und Einsteiger-Empfehlung', () => {
  assert.equal(arenaEinstufung(100, 80), 'leichter');
  assert.equal(arenaEinstufung(100, 100), 'ausgeglichen');
  assert.equal(arenaEinstufung(100, 120), 'schwerer');
  const gegner = [{ id: 'a', staerke: 50 }, { id: 'b', staerke: 80 }, { id: 'c', staerke: 130 }];
  assert.equal(arenaEmpfehlung(100, gegner), 'b', 'der staerkste unter 85 %');
  assert.equal(arenaEmpfehlung(40, gegner), 'a', 'sonst der schwaechste');
});

/* ------------------------------------------------ Kampfverlaeufe */
function redisSpeicher() { const client = speicherClient(); return { client, store: _redisStore('hgh-gehstockmon', client) }; }

await test('Verlaeufe wandern aus der Welt in eigene Felder und werden mit dem Bericht aufgeraeumt', async () => {
  const { client, store } = redisSpeicher();
  const vorher = { reports: [{ id: 'alt', attackerId: 'x', defenderId: 'y', hatVerlauf: true }] };
  const welt = { reports: [
    { id: 'r1', attackerId: 'a', defenderId: 'b', text: 'A erobert', runden: 3, verlauf: ['Zeile 1', 'Zeile 2'] },
    { id: 'r2', attackerId: 'c', defenderId: null, text: 'C scheitert', runden: 2 },
  ] };
  await _verlaeufe.auslagern(store, welt);
  assert.equal(welt.reports[0].verlauf, undefined, 'der Verlauf ist aus dem Dokument');
  assert.equal(welt.reports[0].hatVerlauf, true);
  assert.equal(welt.reports[1].hatVerlauf, undefined, 'Berichte ohne Verlauf bleiben, wie sie sind');
  assert.deepEqual(await store.feld(_verlaeufe.VERLAEUFE, 'r1'), { a: 'a', d: 'b', verlauf: ['Zeile 1', 'Zeile 2'] });
  await store.feldSetzen(_verlaeufe.VERLAEUFE, 'alt', { a: 'x', d: 'y', verlauf: ['weg'] });
  await _verlaeufe.aufraeumen(store, vorher, welt);
  assert.equal(await store.feld(_verlaeufe.VERLAEUFE, 'alt'), null, 'herausgefallene Berichte verlieren ihren Verlauf');
  assert.ok(client.daten.get('hgh:hgh-gehstockmon:kampfverlaeufe').has('r1'));
});

function codeAt(index) {
  const codes = [];
  for (let n = 0; n < 10000 && codes.length <= index; n++) {
    const code = String(n).padStart(4, '0'), text = 'code:' + code + ':gehstock:hideout:2026:kellergewoelbe';
    let h = 0x811c9dc5;
    for (const c of text) { h ^= c.charCodeAt(0); h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0; }
    if (h % 97 === 0) codes.push(code);
  }
  return codes[index];
}
const spielerId = (code) => createHash('sha256').update('gehstockmon-player:' + code).digest('hex').slice(0, 24);

await test('Den Verlauf bekommen nur Angreifer und Verteidiger, und zwar ueber kampfbericht', async () => {
  const { store } = redisSpeicher();
  const [ca, cb, cc] = [codeAt(0), codeAt(1), codeAt(2)];
  await store.feldSetzen(_verlaeufe.VERLAEUFE, 'kampf-1', { a: spielerId(ca), d: spielerId(cb), verlauf: ['Pim greift an.', 'Ende.'] });
  const handler = createHandler({ store, presenceStore: _redisStore('hgh-gehstockmon-presence', speicherClient()), now: () => offen, random: () => 0.5 });
  const frage = async (code, berichtId) => {
    const res = await handler(new Request('http://x/api/gehstockmon', { method: 'POST', body: JSON.stringify({ op: 'kampfbericht', code, berichtId }) }));
    return { status: res.status, body: await res.json() };
  };
  const a = await frage(ca, 'kampf-1'), b = await frage(cb, 'kampf-1'), c = await frage(cc, 'kampf-1'), weg = await frage(ca, 'gibt-es-nicht');
  assert.equal(a.status, 200); assert.deepEqual(a.body.verlauf, ['Pim greift an.', 'Ende.']);
  assert.equal(b.status, 200, 'auch der Verteidiger');
  assert.equal(c.status, 404, 'Unbeteiligte nicht');
  assert.equal(weg.status, 404);
});

await test('Alte Berichte mit Verlauf wandern beim ersten Schreiben aus, die Welt schrumpft', async () => {
  const { client, store } = redisSpeicher();
  const code = codeAt(3), id = spielerId(code);
  const zeilen = Array.from({ length: 60 }, (_, i) => 'Runde ' + i + ': Glutfuchs trifft Moosling für 23 Schaden.');
  const reports = Array.from({ length: 150 }, (_, i) => ({ id: 'k' + i, time: offen - i * 60000, attackerId: i % 2 ? id : 'fremd', defenderId: 'fremd2',
    territoryId: 1 + (i % 9), winner: 'sie', text: 'X scheitert an Y', runden: 12, angreifer: ['a', 'b'], verteidiger: ['c', 'd'], verlauf: zeilen }));
  const leer = createHandler({ store, presenceStore: _redisStore('hgh-gehstockmon-presence', speicherClient()), now: () => offen, random: () => 0.5 });
  const beitreten = () => leer(new Request('http://x/api/gehstockmon', { method: 'POST', body: JSON.stringify({ op: 'join', code, name: 'Tester' }) }));
  assert.equal((await beitreten()).status, 200);
  const welt = await store.get('world-v2');
  welt.reports = reports;
  await store.setJSON('world-v2', welt);
  const vorher = JSON.stringify(welt).length;
  const antwort = await (await beitreten()).json();
  const nachher = await store.get('world-v2');
  assert.equal(nachher.reports.filter((r) => r.verlauf).length, 0, 'kein Verlauf mehr im Dokument');
  assert.equal(nachher.reports.filter((r) => r.hatVerlauf).length, 150);
  assert.equal(client.daten.get('hgh:hgh-gehstockmon:kampfverlaeufe').size, 150);
  assert.ok(JSON.stringify(nachher).length < vorher * 0.35, 'die Welt ist weniger als ein Drittel so gross');
  assert.ok(antwort.reports.length && antwort.reports.every((r) => r.hatVerlauf && !r.verlauf), 'der Client bekommt Berichte ohne Verlauf');
  const zurueck = await (await leer(new Request('http://x/api/gehstockmon', { method: 'POST', body: JSON.stringify({ op: 'kampfbericht', code, berichtId: antwort.reports[0].id }) }))).json();
  assert.deepEqual(zurueck.verlauf, zeilen, 'und holt ihn sich auf Nachfrage');
});

console.log(checks + ' Balance-Pruefungen bestanden.');
