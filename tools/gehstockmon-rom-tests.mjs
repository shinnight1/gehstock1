/* Das Rom-Event "ROMA È FINITA": Regeln, CEO-Rechte, Aktionen, Abrechnung.
   Nur Arbeitsspeicher - kein Test beruehrt die echte Spielerwelt.
   Aufruf: node tools/gehstockmon-rom-tests.mjs */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

for (const k of ['REDIS_URL', 'REDIS_PASS', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'GEHSTOCK_DEV', 'GEHSTOCK_ROM_PIN_HASH']) delete process.env[k];
process.env.GEHSTOCK_SPEICHER = 'arbeitsspeicher';

const { data: D, economy: E, adventure: X } = await import('../netlify/functions/lib/gehstockmon-rules.mjs');
const { createHandler } = await import('../netlify/functions/gehstockmon.mjs');
const { default: room } = await import('../netlify/functions/room.mjs');
const { pinVerschluesseln, pinStimmt, romEiRang, schnellkampf, ROM_EI } = await import('../netlify/functions/lib/gehstockmon-rom.mjs');
const { _redisStore } = await import('../netlify/functions/lib/speicher.mjs');
const { speicherClient } = await import('../netlify/functions/lib/redis-lokal.mjs');

const ROM = X.ROM;
let count = 0;
async function test(name, fn) { await fn(); console.log('ok', name); count++; }

/* Gueltige Codes je Rolle, gerechnet wie in src/core/auth.js. */
function streu(t) { let h = 0x811c9dc5; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0; } return h >>> 0; }
const codes = { S: [], K: [], A: [] };
for (let n = 0; n < 10000; n++) {
  const c = String(n).padStart(4, '0'), h = streu('code:' + c + ':gehstock:hideout:2026:kellergewoelbe');
  if (h % 97 === 0) codes[['S', 'K', 'A'][Math.floor(h / 97) % 3]].push(c);
}
const [ceo, admin, aufsicht, neuerCeo] = codes.A;
const [anna, bo, cy, dennis] = codes.S;
const kennung = (code) => createHash('sha256').update('gehstockmon-player:' + code).digest('hex').slice(0, 24);
const PIN = '4711', PIN_HASH = pinVerschluesseln(PIN);
/* Mittwoch, 30.09.2026, 8 Uhr: die Insel hat bis 14 Uhr offen. */
const MITTWOCH = Date.parse('2026-09-30T08:00:00+02:00');

/* Ein Dokumentspeicher ohne Felder, wie die Testzone ihn hat. */
function dokumentSpeicher() {
  const daten = new Map();
  return {
    daten,
    async get(key) { return daten.has(key) ? structuredClone(daten.get(key).wert) : null; },
    async getWithMetadata(key) { return daten.has(key) ? { data: structuredClone(daten.get(key).wert), etag: String(daten.get(key).v) } : null; },
    async setJSON(key, wert, opts) {
      await new Promise(setImmediate);
      const alt = daten.get(key);
      if (opts && ((opts.onlyIfNew && alt) || (opts.onlyIfMatch !== undefined && (!alt || opts.onlyIfMatch !== String(alt.v))))) return { modified: false };
      daten.set(key, { wert: structuredClone(wert), v: (alt ? alt.v : 0) + 1 });
      return { modified: true };
    },
    async delete(key) { daten.delete(key); },
  };
}

/* Eine frische Welt: Redis-Speicher mit Feldern (wie auf dem Handy), eine
   Verwaltung mit CEO und eine gestellte Uhr. */
function welt({ felder = true, pin = PIN_HASH, dev = false, zeit = MITTWOCH, owner = ceo, random = () => 0.5 } = {}) {
  const client = speicherClient();
  const f = { time: zeit, owner, aufsicht: '', random };
  f.store = felder ? _redisStore('hgh-gehstockmon', client) : dokumentSpeicher();
  f.presence = felder ? _redisStore('hgh-gehstockmon-presence', client) : dokumentSpeicher();
  f.verwaltung = { get: async () => ({ version: 1, daten: { owner: f.owner, aufsicht: f.aufsicht } }) };
  f.handler = createHandler({ store: f.store, presenceStore: f.presence, now: () => f.time, random: () => f.random(), verwStore: f.verwaltung, romPin: pin, romDev: dev });
  f.call = async (code, op, data = {}) => {
    const res = await f.handler(new Request('http://localhost/api/gehstockmon', { method: 'POST',
      body: JSON.stringify({ code, name: data.name || 'Spieler ' + code, op, ...data }) }));
    return { status: res.status, ...(await res.json()) };
  };
  let serie = 0;
  f.id = () => 'rom-test-' + (++serie) + '-' + Math.random().toString(36).slice(2);
  f.steuern = (code, aktion, data = {}) => f.call(code, 'rom_steuern', { aktion, aktionId: f.id(), pin: PIN, ...data });
  f.aktion = (code, art, data = {}) => f.call(code, 'rom_aktion', { art, aktionId: f.id(), ...data });
  /* Stellt die Figur direkt an einen Ort, wie es eine gueltige Positionsmeldung taete. */
  f.stellen = async (code, ort) => {
    const w = (await f.store.getWithMetadata('world-v2')).data, pid = kennung(code);
    const eintrag = { id: pid, name: w.players[pid].name, x: ort.x, z: ort.z, heading: 0, activity: 'map', updatedAt: f.time, spawnAt: w.players[pid].lastJoinAt, credit: 55, squad: [] };
    if (felder) await f.presence.feldSetzen('anwesenheit-v2', pid, eintrag);
    else { const alt = (await f.presence.getWithMetadata('presence-v1'))?.data || { players: {} }; alt.players[pid] = eintrag; await f.presence.setJSON('presence-v1', alt); }
  };
  f.welt = async () => (await f.store.getWithMetadata('world-v2')).data;
  f.ev = async () => (await f.store.getWithMetadata('rom-event'))?.data?.events?.at(-1) || null;
  return f;
}
async function mitSpielern(opts, liste = [anna, bo]) {
  const f = welt(opts);
  for (const code of liste) { const r = await f.call(code, 'join', { requestId: f.id() }); assert.equal(r.status, 200, r.error); }
  return f;
}
/* Springt an den Anfang einer Phase (ROM.P.wahnsinn bis ROM.P.trevi) eines Events. */
function zuPhase(f, ev, nr, plus = 1000) { f.time = ROM.plan(ev).phasen[nr].von + plus; }

/* ------------------------------------------------------------ Regeln */

await test('Zeitplan: Countdown, sechs Phasen mit Espresso-Overdrive, zusammen 14 Minuten; Zeitraffer teilt alles', () => {
  assert.equal(ROM.COUNTDOWN, 60000);
  assert.equal(ROM.GESAMT, 14 * 60000);
  assert.deepEqual(ROM.PHASEN.map((p) => p.id), ['wahnsinn', 'rebellion', 'invasion', 'imperator', 'turbo', 'trevi']);
  assert.equal(ROM.P.turbo, 4); assert.equal(ROM.P.trevi, 5); assert.equal(ROM.VORBEI, 6);
  const ev = { id: 'rom-a', start: 1000, faktor: 1 };
  assert.equal(ROM.phase(ev, 1000).nr, -1);
  assert.equal(ROM.phase(ev, 61000).nr, 0);
  assert.equal(ROM.phase(ev, 61000 + 120000).nr, 1);
  assert.equal(ROM.phase(ev, ROM.plan(ev).phasen[ROM.P.turbo].von).nr, ROM.P.turbo);
  assert.equal(ROM.phase(ev, 1000 + ROM.GESAMT - 1).nr, ROM.P.trevi);
  assert.equal(ROM.phase(ev, 1000 + ROM.GESAMT).nr, ROM.VORBEI);
  assert.ok(!ROM.laeuft(ev, 1000 + ROM.GESAMT));
  const schnell = { ...ev, faktor: 3 };
  assert.equal(ROM.plan(schnell).ende - 1000, ROM.GESAMT / 3);
  assert.equal(ROM.phase({ ...ev, faktor: 99 }, 1000 + ROM.GESAMT - 1).nr, ROM.P.trevi, 'unbekannter Zeitraffer zaehlt als 1');
  const abgebrochen = { ...ev, abgebrochenAm: 30000 };
  assert.ok(ROM.nieGelaufen(abgebrochen));
  assert.equal(ROM.phase(abgebrochen, 30000).nr, ROM.VORBEI);
});

await test('Pizzen, Wagen, Legion und Boss laufen nur ueber begehbares, freies Land', () => {
  const layout = X.layout(D.FELDER.map((f) => ({ id: f.id, ownerId: null, level: 1 })));
  const frei = (p) => X.onLand(p) && X.walkable(p) && !layout.some((g) => X.inside(p, g));
  assert.ok(ROM.WEGE.length > 40);
  for (const w of ROM.WEGE) assert.ok(frei(w), 'Wegpunkt ' + w.x + '/' + w.z);
  const ev = { id: 'rom-wege', start: 0, faktor: 1 };
  const plan = ROM.plan(ev);
  for (let t = plan.phasen[0].von; t < plan.phasen[2].von; t += 700) for (const p of ROM.pizzen(ev, t)) assert.ok(frei(p), 'Pizza ' + p.id + ' bei ' + t);
  for (let t = 0; t < 90000; t += 500) {
    assert.ok(frei(ROM.wagenOrt(ev, t)), 'Wagen bei ' + t);
    assert.ok(frei(ROM.bossOrt(ev, t)), 'Boss bei ' + t);
    for (let i = 0; i < 6; i++) assert.ok(frei(ROM.legionaerOrt(ev, t, i)), 'Legionaer ' + i);
  }
  for (let t = plan.phasen[ROM.P.turbo].von; t < plan.phasen[ROM.P.turbo].bis; t += 300) for (const p of ROM.pizzen(ev, t)) assert.ok(frei(p), 'Turbo-Pizza ' + p.id + ' bei ' + t);
  assert.ok(frei(ROM.PIAZZA) && frei(ROM.TREVI));
  for (const tp of ROM.TANZPLAETZE) assert.ok(X.onLand(tp) && X.walkable(tp), 'Tanzplatz ' + tp.x + '/' + tp.z);
  assert.ok(ROM.TANZPLAETZE.length >= 8, 'die Kakerlaken tanzen ueberall');
  assert.equal(ROM.pizzen(ev, plan.phasen[0].von + 5).length, 8);
  assert.equal(ROM.pizzen(ev, plan.phasen[1].von + 5).length, 4);
  assert.equal(ROM.pizzen(ev, plan.phasen[2].von + 5).length, 0);
  assert.equal(ROM.pizzen(ev, plan.phasen[ROM.P.turbo].von + 5).length, 8, 'im Overdrive rasen sie wieder');
  const turbo = ROM.pizzen(ev, plan.phasen[ROM.P.turbo].von + 5)[0];
  assert.equal(ROM.pizza(ev, turbo.id, plan.phasen[ROM.P.turbo].von + ROM.PIZZA_ABSCHNITT_TURBO + 5), null, 'und sind viermal so schnell wieder weg');
  const p = ROM.pizzen(ev, plan.phasen[0].von + 5)[0];
  assert.deepEqual(ROM.pizza(ev, p.id, plan.phasen[0].von + 5), p, 'jede Pizza laesst sich ueber ihre Kennung nachrechnen');
  assert.equal(ROM.pizza(ev, p.id, plan.phasen[0].von + ROM.PIZZA_ABSCHNITT + 5), null, 'danach ist sie weg');
});

await test('Tanzfolgen sind auf jedem Geraet gleich und werden laenger', () => {
  const ev = { id: 'rom-tanz', start: 0 };
  assert.deepEqual(ROM.tanzFolge(ev, 3), ROM.tanzFolge({ id: 'rom-tanz', start: 5 }, 3));
  assert.equal(ROM.tanzFolge(ev, 0).length, 4);
  assert.equal(ROM.tanzFolge(ev, 6).length, 6);
  assert.equal(ROM.tanzFolge(ev, 50).length, 7);
  assert.notDeepEqual(ROM.tanzFolge(ev, 1).concat(ROM.tanzFolge(ev, 2)), ROM.tanzFolge({ id: 'rom-anders' }, 1).concat(ROM.tanzFolge({ id: 'rom-anders' }, 2)));
});

await test('Belohnungsstufen: Tourist, Gladiator, Held, Legende; Leiste, Boss, Kaese, Eier und Abbruch', () => {
  const b = (lire, schlaege = 0, mehr = {}) => ({ lire: [lire, 0, 0, 0, 0, 0], stern: 0, schlaege, ...mehr });
  const ev = { id: 'rom-l', start: 0 };
  assert.deepEqual(ROM.lohn(b(9), {}, ev).stufen, []);
  const tourist = ROM.lohn(b(10), {}, ev);
  assert.deepEqual(tourist.stufen, ['tourist']); assert.equal(tourist.gold, 300); assert.ok(tourist.romEi);
  const gladiator = ROM.lohn(b(40), {}, ev);
  assert.equal(gladiator.gold, 800); assert.deepEqual(gladiator.runen, { 3: 5 });
  const held = ROM.lohn(b(80), {}, ev);
  assert.equal(held.gold, 1400); assert.deepEqual(held.runen, { 3: 5, 5: 2 }); assert.deepEqual(held.titel, ['held_von_rom']); assert.ok(!held.perle);
  const legende = ROM.lohn(b(120, 5, { kaeseGold: 90, eier: [0, 1, 2] }), { leisteVoll: true, bossBesiegt: true }, ev);
  assert.equal(legende.gold, 300 + 500 + 600 + 800 + ROM.LEISTE.gold + ROM.BOSS_GOLD + 90);
  assert.deepEqual(legende.titel, ['held_von_rom', 'legende_von_rom', 'mozzarella_bezwinger']);
  assert.ok(legende.mozzarino && legende.perle); assert.equal(legende.eier, 3); assert.equal(legende.kaese, 90); assert.equal(legende.bossGold, ROM.BOSS_GOLD);
  assert.ok(!ROM.lohn(b(40, 4), { bossBesiegt: true }, ev).mozzarino, 'Mozzarino braucht fuenf Schlaege');
  assert.ok(!ROM.lohn(b(39, 9), { bossBesiegt: true }, ev).mozzarino, 'Mozzarino braucht den Gladiator');
  const nurKaese = ROM.lohn(b(0, 0, { kaeseGold: 40, eier: [4] }), {}, ev);
  assert.deepEqual(nurKaese.stufen, []); assert.equal(nurKaese.gold, 40); assert.equal(nurKaese.eier, 1, 'Kaesegold und Eier auch ohne Stufe');
  assert.equal(ROM.lire({ lire: [500, 500, 500, 500, 500, 500], stern: 5 }), ROM.LIRE_MAX, 'Lire sind gedeckelt');
  const abbruch = { ...ev, abgebrochenAm: ROM.plan(ev).phasen[1].von };
  assert.deepEqual(ROM.lohn(b(1), {}, abbruch).stufen, ['tourist'], 'nach einem Abbruch reicht eine Lira');
  assert.equal(ROM.lohn(b(1), { leisteVoll: false }, abbruch).gold, 300);
});

await test('Centurio Mozzarino: nur im Event, gleich stark wie der Aurorabaer, nie aus normalen Eiern', () => {
  const m = D.mon('mozzarino'), bar = D.mon('aurorabaer');
  assert.ok(m && !D.KATALOG.some((k) => k.id === 'mozzarino'));
  assert.equal(D.KATALOG.length, 57);
  assert.equal(m.seltenheit, bar.seltenheit); assert.equal(m.typ, bar.typ);
  assert.equal(m.hp, bar.hp); assert.equal(m.ang, bar.ang); assert.equal(m.tempo, bar.tempo);
  const p = D.neuerStand(null, MITTWOCH);
  let zufall = E.zufallsfolge(0.321);
  for (let i = 0; i < 3000; i++) {
    p.eggs = [{ id: 'e' + i, territoryId: 1, producedAt: 0, startedAt: 0, readyAt: 0, mindestens: 4 }];
    assert.notEqual(E.hatch(p, 'e' + i, 1, zufall).mon.id, 'mozzarino');
  }
  const q = D.neuerStand({ besitz: ['mozzarino'], rom: { held: 2, letztes: { ev: 'rom-x', lire: 50, stufen: ['tourist', 'quatsch'], ei: 'tasche' } } }, MITTWOCH);
  assert.ok(q.besitz.includes('mozzarino'), 'bleibt beim Laden in der Sammlung');
  assert.equal(q.rom.held, 2); assert.deepEqual(q.rom.letztes.stufen, ['tourist']);
  assert.equal(ROM.monGeben(q, 'mozzarino'), 'stufe');
  q.monUpgrades.mozzarino = X.UPGRADE_LIMIT;
  const vorher = q.runes[4];
  assert.equal(ROM.monGeben(q, 'mozzarino'), 'runen'); assert.equal(q.runes[4], vorher + X.UPGRADE_LIMIT);
});

await test('Rom-Ei: 89 % Legendaer, 10 % Mythisch, 1 % Apokalyptisch - fuer drei Namen nur Legendaer', () => {
  const zaehlen = (name) => {
    const n = [0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 10000; i++) n[romEiRang({ name }, () => (i + 0.5) / 10000)]++;
    return n;
  };
  assert.deepEqual(zaehlen('Anna').slice(4), [8900, 1000, 100]);
  assert.equal(ROM_EI.mythisch, 0.10); assert.equal(ROM_EI.apokalyptisch, 0.01);
  for (const name of ['Dennis', 'jamie', 'MAX', 'Max M.', ' Dennis K']) assert.deepEqual(zaehlen(name).slice(4), [10000, 0, 0], name);
  assert.deepEqual(zaehlen('Maximilian').slice(4), [8900, 1000, 100], 'nur der Name Max, nicht jeder, der so anfaengt');
  const p = D.neuerStand(null, MITTWOCH), gesehen = new Set();
  for (let i = 0; i < 400; i++) {
    p.eggs = [{ id: 'r' + i, territoryId: 1, producedAt: 0, startedAt: 0, readyAt: 0, mindestens: 4, art: 'rom', festRang: 4 }];
    const s = E.hatch(p, 'r' + i, 1, (i + 0.5) / 400);
    assert.equal(s.rang, 4); assert.ok(!s.garantiert); gesehen.add(s.mon.id);
  }
  assert.ok(gesehen.has('mozzarino'), 'aus dem Rom-Ei kann auch Mozzarino kommen');
  p.eggs = [{ id: 'apo', territoryId: 1, producedAt: 0, startedAt: 0, readyAt: 0, mindestens: 4, art: 'rom', festRang: 6 }];
  assert.equal(E.hatch(p, 'apo', 1, 0.5).rang, 6);
});

await test('Die Event-PIN liegt nur als Hash vor und laesst sich nicht erraten', () => {
  assert.ok(pinStimmt('4711', PIN_HASH));
  assert.ok(!pinStimmt('4712', PIN_HASH)); assert.ok(!pinStimmt('', PIN_HASH)); assert.ok(!pinStimmt('4711', ''));
  assert.ok(!PIN_HASH.includes('4711'));
  assert.throws(() => pinVerschluesseln('12'));
  assert.notEqual(pinVerschluesseln('4711'), PIN_HASH, 'jedes Mal ein neues Salz');
});

await test('Der Schnellkampf laeuft nach eigenem Plan durch und passt sich an', () => {
  const p = D.neuerStand(null, MITTWOCH);
  const k = schnellkampf(p, E.zufallsfolge(0.3));
  assert.ok(typeof k.sieg === 'boolean' && k.verlauf.length && k.sie[0].name.startsWith('Legionär'));
  let siege = 0;
  for (let i = 0; i < 30; i++) { const q = D.neuerStand({ besitz: D.KATALOG.map((m) => m.id) }, MITTWOCH); q.progress = { trainerWins: 10 }; if (schnellkampf(q, E.zufallsfolge(i / 30)).sieg) siege++; }
  assert.ok(siege >= 15, 'Legionaere liegen unter der eigenen Staerke (' + siege + '/30)');
});

/* ------------------------------------------------------ CEO-Rechte */

await test('Nur der aktuelle CEO mit PIN steuert - Spieler, Admins, Aufsichtsrat und gefaelschte Flags nicht', async () => {
  const f = await mitSpielern({});
  f.aufsicht = aufsicht;
  assert.equal((await f.steuern(anna, 'start')).status, 403, 'Spieler');
  assert.equal((await f.steuern(admin, 'start', { owner: true, isOwner: true, rolle: 'CEO', ceo: admin })).status, 403, 'Admin mit gefaelschtem Flag');
  assert.equal((await f.steuern(aufsicht, 'start')).status, 403, 'Aufsichtsrat');
  assert.equal((await f.steuern(admin, 'status')).status, 403, 'auch der Status nur fuer den CEO');
  assert.equal((await f.call('12', 'rom_steuern', { aktion: 'start', aktionId: f.id(), pin: PIN })).status, 401, 'ungueltiger Code');
  assert.equal((await f.steuern(ceo, 'start', { pin: '0000' })).status, 403, 'falsche PIN');
  assert.equal(await f.ev(), null, 'nichts gestartet');
  const ok = await f.steuern(ceo, 'start');
  assert.equal(ok.status, 200, ok.error); assert.ok(ok.gestartet);
  assert.equal((await f.ev()).von.id, kennung(ceo));
});

await test('Ohne CEO oder ohne PIN auf dem Server startet nichts; fuenf falsche PINs sperren', async () => {
  const f = await mitSpielern({ owner: '' });
  assert.equal((await f.steuern(ceo, 'start')).status, 403, 'kein CEO eingetragen');
  const g = await mitSpielern({ pin: '' });
  const r = await g.steuern(ceo, 'start');
  assert.equal(r.status, 503); assert.match(r.error, /rom-pin/);
  const h = await mitSpielern({});
  for (let i = 0; i < 4; i++) assert.equal((await h.steuern(ceo, 'start', { pin: '1111' })).status, 403);
  assert.equal((await h.steuern(ceo, 'start', { pin: '1111' })).status, 429, 'die fuenfte sperrt');
  assert.equal((await h.steuern(ceo, 'start')).status, 429, 'auch die richtige, solange gesperrt');
  h.time += 16 * 60000;
  assert.equal((await h.steuern(ceo, 'start')).status, 200, 'nach 15 Minuten wieder');
});

await test('CEO-Wechsel wirkt sofort: der alte kann nicht mehr abbrechen, der neue schon', async () => {
  const f = await mitSpielern({});
  assert.equal((await f.steuern(ceo, 'start')).status, 200);
  f.owner = neuerCeo;
  assert.equal((await f.steuern(ceo, 'abbruch')).status, 403);
  const r = await f.steuern(neuerCeo, 'abbruch');
  assert.equal(r.status, 200, r.error);
  assert.ok((await f.ev()).abgebrochenAm);
});

await test('Zehn gleichzeitige Starts ergeben genau ein Event; derselbe Klick zweimal bleibt eins', async () => {
  for (const felder of [true, false]) {
    const f = await mitSpielern({ felder });
    const antworten = await Promise.all(Array.from({ length: 10 }, () => f.steuern(ceo, 'start')));
    assert.equal(antworten.filter((r) => r.status === 200).length, 1, antworten.map((r) => r.status + ' ' + (r.error || '')).join(' | '));
    assert.ok(antworten.filter((r) => r.status !== 200).every((r) => r.status === 409));
    const g = await mitSpielern({ felder });
    const id = g.id(), a = await g.call(ceo, 'rom_steuern', { aktion: 'start', aktionId: id, pin: PIN });
    const b = await g.call(ceo, 'rom_steuern', { aktion: 'start', aktionId: id, pin: PIN });
    assert.equal(a.status, 200); assert.equal(b.status, 200); assert.equal(a.gestartet, b.gestartet);
    assert.equal((await g.store.getWithMetadata('rom-event')).data.events.length, 1);
  }
});

await test('Oeffnungszeiten und Wochengrenze gelten fuer den echten Start', async () => {
  const f = await mitSpielern({});
  f.time = Date.parse('2026-09-30T16:00:00+02:00');
  assert.equal((await f.steuern(ceo, 'start')).status, 423, 'geschlossen');
  f.time = Date.parse('2026-09-28T12:50:00+02:00');
  assert.equal((await f.steuern(ceo, 'start')).status, 409, 'Montag 12:50 - die Zeit reicht nicht bis 13 Uhr');
  f.time = Date.parse('2026-09-30T08:00:00+02:00');
  const erst = await f.steuern(ceo, 'start');
  assert.equal(erst.status, 200);
  f.time += 30000;
  assert.equal((await f.steuern(ceo, 'abbruch')).status, 200, 'im Countdown abgebrochen');
  f.time += 1000;
  assert.equal((await f.steuern(ceo, 'start')).status, 200, 'die Woche bleibt dabei frei');
  f.time += ROM.GESAMT + 5000;
  const zweit = await f.steuern(ceo, 'start');
  assert.equal(zweit.status, 409); assert.match(zweit.error, /Woche/);
  f.time = Date.parse('2026-10-05T08:00:00+02:00');
  assert.equal((await f.steuern(ceo, 'start')).status, 200, 'naechste Woche wieder');
  const status = await f.steuern(ceo, 'status');
  assert.equal(status.status, 200); assert.equal(status.steuerung.startbar, false);
});

await test('Das Rom-Event beachtet ein manuell geschlossenes und geoeffnetes Insel-Tor', async () => {
  const f = await mitSpielern({});
  await f.store.setJSON('tor', { modus: 'zu' }); f.time += 6000;
  const zu = await f.steuern(ceo, 'status');
  assert.equal(zu.status, 200); assert.equal(zu.steuerung.startbar, false);
  assert.equal((await f.steuern(ceo, 'start')).status, 423, 'tagsueber bei geschlossenem Tor kein Event');
  assert.equal(await f.ev(), null);
  f.time = Date.parse('2026-10-03T22:00:00+02:00');
  await f.store.setJSON('tor', { modus: 'auf' });
  const auf = await f.steuern(ceo, 'status');
  assert.equal(auf.status, 200); assert.equal(auf.steuerung.startbar, true);
  assert.equal((await f.steuern(ceo, 'start')).status, 200, 'am Wochenende bei geoeffnetem Tor erlaubt');
});

await test('Am Entwicklungsserver: kein PIN, keine Oeffnungszeit, keine Wochengrenze, Zeitraffer', async () => {
  const f = await mitSpielern({ dev: true, pin: '' });
  f.time = Date.parse('2026-10-03T22:00:00+02:00');
  const r = await f.call(ceo, 'rom_steuern', { aktion: 'start', aktionId: f.id(), faktor: 6 });
  assert.equal(r.status, 200, r.error);
  assert.equal((await f.ev()).faktor, 6);
  f.time += ROM.GESAMT / 6 + 5000;
  assert.equal((await f.call(ceo, 'rom_steuern', { aktion: 'start', aktionId: f.id() })).status, 200, 'gleich noch einmal');
  assert.equal((await f.call(admin, 'rom_steuern', { aktion: 'start', aktionId: f.id() })).status, 403, 'CEO bleibt Pflicht');
  const p = await f.call(ceo, 'rom_steuern', { aktion: 'start', aktionId: f.id(), faktor: 6 });
  assert.equal(p.status, 409, 'eins nach dem anderen');
  const echt = await mitSpielern({});
  assert.equal((await echt.steuern(ceo, 'start', { faktor: 6 })).status, 200);
  assert.equal((await echt.ev()).faktor, 1, 'auf der echten Seite gibt es keinen Zeitraffer');
});

/* ------------------------------------------------------------ Ablauf */

await test('Neu laden und spaet dazukommen: jeder bekommt denselben Stand mit der Positionsmeldung', async () => {
  const f = await mitSpielern({});
  await f.steuern(ceo, 'start');
  const ev = await f.ev();
  const erster = await f.call(anna, 'presence', { position: { ...X.SPAWN, heading: 0 } });
  assert.equal(erster.rom.id, ev.id);
  zuPhase(f, ev, 2, 5000);
  assert.equal((await f.call(anna, 'join', { requestId: f.id() })).status, 200, 'neu laden');
  const nochmal = await f.call(anna, 'presence', { position: { ...X.SPAWN, heading: 0 } });
  assert.equal(nochmal.rom.id, ev.id); assert.equal(nochmal.rom.start, ev.start, 'Neuladen startet nichts neu');
  assert.equal((await f.call(cy, 'join', { requestId: f.id() })).status, 200, 'spaet dazu');
  const spaet = await f.call(cy, 'presence', { position: { ...X.SPAWN, heading: 0 } });
  assert.equal(spaet.rom.id, ev.id);
  assert.equal(ROM.phase(spaet.rom, spaet.serverTime).nr, 2);
  f.time = ROM.ende(ev) + ROM.NACHLAUF + 1000;
  const vorbei = await f.call(anna, 'presence', { position: { ...X.SPAWN, heading: 0 } });
  assert.equal(vorbei.rom, undefined, 'lange nach dem Ende kommt nichts mehr mit');
});

await test('Pizzen schnappen: nur in der Naehe, jede einmal, Aktionskennung zaehlt einmal', async () => {
  const f = await mitSpielern({});
  await f.steuern(ceo, 'start');
  const ev = await f.ev();
  assert.equal((await f.aktion(anna, 'zutat', { pizzaId: '0-0-0' })).status, 409, 'im Countdown noch nicht');
  zuPhase(f, ev, 0, 2000);
  const pizza = ROM.pizzen(ev, f.time)[0];
  await f.stellen(anna, { x: pizza.x + 30, z: pizza.z });
  assert.equal((await f.aktion(anna, 'zutat', { pizzaId: pizza.id })).status, 409, 'zu weit weg');
  await f.stellen(anna, pizza);
  const id = f.id();
  const a = await f.call(anna, 'rom_aktion', { art: 'zutat', pizzaId: pizza.id, aktionId: id });
  assert.equal(a.status, 200, a.error); assert.equal(a.ergebnis.lire, 1); assert.equal(a.rom.ich.lire, 1);
  const b = await f.call(anna, 'rom_aktion', { art: 'zutat', pizzaId: pizza.id, aktionId: id });
  assert.equal(b.status, 200); assert.ok(b.ergebnis.doppelt); assert.equal(b.rom.ich.lire, 1, 'nicht doppelt');
  f.time += 3000; await f.stellen(anna, ROM.pizza(ev, pizza.id, f.time));
  assert.equal((await f.aktion(anna, 'zutat', { pizzaId: pizza.id })).status, 409, 'dieselbe Pizza nur einmal');
  assert.equal((await f.aktion(anna, 'zutat', { pizzaId: '9-9-9' })).status, 409, 'erfundene Pizza');
  const w = await f.welt();
  assert.ok(!w.rom, 'die Spielerwelt wird waehrend des Events nicht angefasst');
});

await test('Parallele Aktionen desselben Spielers verlieren keine Lire oder Aktionskennungen', async () => {
  for (const felder of [true, false]) {
    const f = await mitSpielern({ felder });
    await f.steuern(ceo, 'start');
    const ev = await f.ev(); zuPhase(f, ev, ROM.P.trevi);
    const muenzeId = f.id(), fangId = f.id();
    const antworten = await Promise.all([
      f.aktion(anna, 'muenze', { aktionId: muenzeId }),
      f.aktion(anna, 'fang', { aktionId: fangId, fang: 'muenzen', anzahl: 5 }),
    ]);
    assert.ok(antworten.every((r) => r.status === 200), JSON.stringify(antworten));
    const beitrag = felder ? await f.store.feld('rom-b:' + ev.id, kennung(anna))
      : (await f.store.getWithMetadata('rom-b:' + ev.id)).data[kennung(anna)];
    assert.equal(ROM.lire(beitrag), 8, 'Muenze und Fang bleiben beide erhalten');
    assert.ok(beitrag.muenze); assert.equal(beitrag.fang.muenzen, 5);
    assert.ok(beitrag.ids.some((v) => v.id === muenzeId) && beitrag.ids.some((v) => v.id === fangId));
    const wieder = await f.aktion(anna, 'muenze', { aktionId: muenzeId });
    assert.equal(wieder.status, 200); assert.ok(wieder.ergebnis.doppelt);
    assert.equal((await f.aktion(anna, 'muenze')).status, 409, 'auch nach parallelem Fang nur eine Muenze');
  }
});

await test('Parallele Wiederholungen derselben Aktion werden genau einmal gezaehlt', async () => {
  const f = await mitSpielern({});
  await f.steuern(ceo, 'start');
  const ev = await f.ev(); zuPhase(f, ev, ROM.P.trevi);
  const aktionId = f.id();
  const antworten = await Promise.all(Array.from({ length: 6 }, () =>
    f.aktion(anna, 'fang', { aktionId, fang: 'muenzen', anzahl: 5 })));
  assert.ok(antworten.every((r) => r.status === 200), JSON.stringify(antworten));
  assert.equal(antworten.filter((r) => !r.ergebnis.doppelt).length, 1);
  const beitrag = await f.store.feld('rom-b:' + ev.id, kennung(anna));
  assert.equal(ROM.lire(beitrag), 5); assert.equal(beitrag.ids.length, 1);
});

await test('Aktionen warten, solange ein eigener Kampf laeuft', async () => {
  const f = await mitSpielern({});
  await f.steuern(ceo, 'start');
  const ev = await f.ev();
  zuPhase(f, ev, ROM.P.trevi, 1000);
  const w = (await f.store.getWithMetadata('world-v2'));
  const daten = w.data; daten.players[kennung(anna)].arena = { phase: 'choose', lastActionAt: f.time };
  await f.store.setJSON('world-v2', daten);
  f.time += 6000;
  const r = await f.aktion(anna, 'muenze');
  assert.equal(r.status, 409); assert.match(r.error, /Kampf/);
  assert.equal((await f.aktion(bo, 'muenze')).status, 200);
});

await test('Legion, Tanz und Polonaise zaehlen nur in ihrer Phase und mit Pausen', async () => {
  const f = await mitSpielern({});
  await f.steuern(ceo, 'start');
  const ev = await f.ev();
  zuPhase(f, ev, 1, 1000);
  await f.stellen(anna, ROM.wagenOrt(ev, f.time));
  const kampf = await f.aktion(anna, 'gefecht');
  assert.equal(kampf.status, 200, kampf.error);
  assert.ok(kampf.ergebnis.kampf.verlauf.length); assert.equal(kampf.ergebnis.lire, kampf.ergebnis.sieg ? 4 : 1);
  f.time += 5000; await f.stellen(anna, ROM.wagenOrt(ev, f.time));
  assert.equal((await f.aktion(anna, 'gefecht')).status, 429, 'die Truppe verschnauft');
  assert.equal((await f.aktion(anna, 'tanz', { runde: 0, folge: [0, 0, 0, 0] })).status, 409, 'noch kein Tanz');
  zuPhase(f, ev, 2, 1000);
  const runde = ROM.tanzRunde(ev, f.time), folge = ROM.tanzFolge(ev, runde);
  const t = await f.aktion(anna, 'tanz', { runde, folge });
  assert.equal(t.status, 200); assert.ok(t.ergebnis.richtig); assert.equal(t.ergebnis.lire, 2);
  assert.equal((await f.aktion(anna, 'tanz', { runde, folge })).status, 409, 'jede Runde nur einmal');
  const falsch = await f.aktion(bo, 'tanz', { runde, folge: folge.map((v) => (v + 1) % 4) });
  assert.equal(falsch.status, 200); assert.equal(falsch.ergebnis.lire, 0);
  assert.equal((await f.aktion(bo, 'tanz', { runde, folge })).status, 409, 'kein zweiter Versuch in derselben Runde');
  await f.stellen(anna, { x: ROM.PIAZZA.x + 40, z: ROM.PIAZZA.z });
  assert.equal((await f.aktion(anna, 'polonaise')).status, 409, 'nur auf der Piazza');
  await f.stellen(anna, ROM.PIAZZA);
  assert.equal((await f.aktion(anna, 'polonaise')).status, 200);
  assert.equal((await f.aktion(anna, 'polonaise')).status, 429);
});

await test('Mozzarellus: Schlagvorrat, Haltungen, gemeinsamer Sieg, danach keine Schlaege mehr', async () => {
  const f = await mitSpielern({});
  await f.steuern(ceo, 'start');
  const ev = await f.ev();
  zuPhase(f, ev, 3, 500);
  let geschlagen = 0, letzte = null, sieg = null;
  for (let i = 0; i < 400 && !sieg; i++) {
    for (const code of [anna, bo]) {
      await f.stellen(code, ROM.bossOrt(ev, f.time));
      const r = await f.aktion(code, 'schlag');
      if (r.status === 200) { geschlagen++; letzte = r; if (r.rom.boss.besiegt) { sieg = r; break; } }
      else assert.ok([429, 409].includes(r.status), r.error);
    }
    f.time += 2000;
    if (ROM.phase(ev, f.time).nr !== 3) break;
  }
  assert.ok(sieg, 'zwei Einsteiger schaffen ihn in der Zeit (' + geschlagen + ' Schlaege, ' + JSON.stringify(letzte && letzte.rom.boss) + ')');
  assert.ok(sieg.ergebnis.letzter);
  await f.stellen(anna, ROM.bossOrt(ev, f.time));
  const danach = await f.aktion(anna, 'schlag');
  assert.equal(danach.status, 409); assert.match(danach.error, /geschmolzen/);
  const g = await mitSpielern({});
  await g.steuern(ceo, 'start');
  const ev2 = await g.ev();
  zuPhase(g, ev2, 3, 500);
  await g.stellen(anna, ROM.bossOrt(ev2, g.time));
  for (let i = 0; i < 3; i++) assert.equal((await g.aktion(anna, 'schlag')).status, 200, 'drei gesammelte Schlaege');
  assert.equal((await g.aktion(anna, 'schlag')).status, 429, 'dann ist der Vorrat leer');
  g.time += 6000; await g.stellen(anna, ROM.bossOrt(ev2, g.time));
  assert.equal((await g.aktion(anna, 'schlag')).status, 200, 'nach sechs Sekunden wieder einer');
});

await test('Ein zeitgleicher erster Angriff belebt einen bereits besiegten Boss nicht wieder', async () => {
  const f = await mitSpielern({});
  await f.steuern(ceo, 'start');
  const ev = await f.ev(); zuPhase(f, ev, 3, 60000);
  await f.store.feldSetzen('rom-b:' + ev.id, kennung(anna), {
    ...ROM.leer(), hp: 3000, schaden: 4990, schlaege: 10,
  });
  /* Beide Anfragen sehen denselben Zustand kurz vor dem letzten Schlag. */
  await f.call(anna, 'presence', { position: { ...X.SPAWN, heading: 0 } });
  for (const code of [anna, bo]) await f.stellen(code, ROM.bossOrt(ev, f.time));
  const antworten = await Promise.all([f.aktion(anna, 'schlag'), f.aktion(bo, 'schlag')]);
  assert.ok(antworten.every((r) => r.status === 200), JSON.stringify(antworten));
  assert.ok(antworten.some((r) => r.ergebnis.letzter), 'der Sieg wurde bereits bestaetigt');
  const alle = await f.store.felder('rom-b:' + ev.id), lage = ROM.lage(alle, ev);
  assert.ok(lage.bossBesiegt); assert.equal(lage.bossHp, 0); assert.equal(lage.bossSchaden, lage.bossMax);
  f.time += 2000;
  const nachher = await f.aktion(anna, 'schlag');
  assert.equal(nachher.status, 409); assert.match(nachher.error, /geschmolzen/);
  f.time = ROM.ende(ev) + 4000; await f.call(anna, 'world');
  assert.equal((await f.welt()).players[kennung(anna)].rom.boss, 1, 'Sieg bleibt auch bei der Abrechnung erhalten');
});

/* ------------------------------------------------------- Abrechnung */

async function spielDurch(f, ev, code, lire) {
  /* Schreibt einen Beitrag direkt, als haette der Spieler so gespielt. */
  const b = { lire: [Math.min(20, lire), Math.min(30, Math.max(0, lire - 20)), Math.min(30, Math.max(0, lire - 50)), Math.min(40, Math.max(0, lire - 80)), 0, 0], stern: 0, schlaege: 0, schaden: 0, hp: 0, n: code };
  if (typeof f.store.feldSetzen === 'function') await f.store.feldSetzen('rom-b:' + ev.id, kennung(code), b);
  else { const e = await f.store.getWithMetadata('rom-b:' + ev.id); const alle = e ? e.data : {}; alle[kennung(code)] = b; await f.store.setJSON('rom-b:' + ev.id, alle); }
}

await test('Abrechnung genau einmal: Gold, Runen, Rom-Ei, Bericht - auch bei gleichzeitigen Abfragen', async () => {
  for (const felder of [true, false]) {
    const f = await mitSpielern({ felder }, [anna, bo, cy]);
    await f.steuern(ceo, 'start');
    const ev = await f.ev();
    await spielDurch(f, ev, anna, 45); await spielDurch(f, ev, bo, 5);
    const vorher = await f.welt(), goldAnna = vorher.players[kennung(anna)].gold, goldBo = vorher.players[kennung(bo)].gold;
    f.time = ROM.ende(ev) + 1000;
    await f.call(anna, 'world');
    assert.ok(!(await f.welt()).rom, 'erst drei Sekunden nach dem Ende');
    f.time = ROM.ende(ev) + 4000;
    await Promise.all([f.call(anna, 'world'), f.call(bo, 'world'), f.call(anna, 'world'), f.call(cy, 'world')]);
    await f.call(anna, 'world');
    const w = await f.welt(), a = w.players[kennung(anna)], b = w.players[kennung(bo)];
    assert.equal(a.gold, goldAnna + 800, 'Tourist und Gladiator, genau einmal');
    assert.equal(b.gold, goldBo, 'unter zehn Lire gibt es nichts');
    assert.equal(a.eggs.filter((e) => e.art === 'rom').length, 1);
    assert.equal(a.runes[3], 5);
    assert.equal(a.rom.letztes.ev, ev.id); assert.equal(a.rom.letztes.ei, 'tasche');
    assert.ok(w.rom.abgerechnet[ev.id]);
    assert.equal(w.reports.filter((r) => r.id === 'rom-' + ev.id + '-' + kennung(anna)).length, 1);
    assert.ok(w.ticker.some((t) => t.text.includes('ROMA')));
    assert.equal(a.bilanz.rein.rom, 800, 'steht in der Wochenbilanz');
    const profil = await f.call(anna, 'world');
    assert.equal(profil.profile.rom.letztes.gold, 800, 'der Browser sieht die Zusammenfassung');
  }
});

await test('Abbruch: nach dem Countdown wird das Verdiente ausgezahlt, im Countdown nichts', async () => {
  const f = await mitSpielern({});
  await f.steuern(ceo, 'start');
  const ev = await f.ev();
  zuPhase(f, ev, 1, 1000);
  await spielDurch(f, ev, anna, 3);
  assert.equal((await f.steuern(ceo, 'abbruch')).status, 200);
  const gold = (await f.welt()).players[kennung(anna)].gold;
  f.time += 5000;
  await f.call(anna, 'world');
  const a = (await f.welt()).players[kennung(anna)];
  assert.equal(a.gold, gold + 300, 'drei Lire reichen nach einem Abbruch fuer den Touristen');
  assert.ok(a.rom.letztes.abgebrochen);
  const g = await mitSpielern({});
  await g.steuern(ceo, 'start');
  const ev2 = await g.ev();
  await spielDurch(g, ev2, anna, 50);
  g.time += 10000;
  await g.steuern(ceo, 'abbruch');
  const goldG = (await g.welt()).players[kennung(anna)].gold;
  g.time += 5000;
  await g.call(anna, 'world');
  const w = await g.welt();
  assert.equal(w.players[kennung(anna)].gold, goldG, 'im Countdown abgebrochen: nichts');
  assert.ok(w.rom.abgerechnet[ev2.id]);
});

await test('Boss besiegt: Mozzarino fuer Gladiatoren mit fuenf Schlaegen, Titel, volle Tasche', async () => {
  const f = await mitSpielern({}, [anna, bo]);
  await f.steuern(ceo, 'start');
  const ev = await f.ev();
  const w0 = (await f.store.getWithMetadata('world-v2')).data;
  w0.players[kennung(bo)].eggs = Array.from({ length: E.BAG_LIMIT }, (_, i) => ({ id: 'voll' + i, territoryId: 1, producedAt: 0, startedAt: null, readyAt: null }));
  await f.store.setJSON('world-v2', w0);
  const stark = { lire: [20, 30, 30, 40, 0, 0], stern: 0, schlaege: 6, schaden: 999999, hp: 3000, letzter: true, n: 'A' };
  await f.store.feldSetzen('rom-b:' + ev.id, kennung(anna), stark);
  await f.store.feldSetzen('rom-b:' + ev.id, kennung(bo), { ...stark, schlaege: 1, schaden: 0, hp: 3000, letzter: false });
  f.time = ROM.ende(ev) + 4000;
  await f.call(anna, 'world');
  const w = await f.welt(), a = w.players[kennung(anna)], b = w.players[kennung(bo)];
  assert.ok(a.besitz.includes('mozzarino')); assert.equal(a.rom.letztes.mozzarino, 'neu');
  assert.ok(!b.besitz.includes('mozzarino'), 'ein Schlag reicht nicht fuer Mozzarino');
  assert.equal(b.rom.boss, 1, 'aber fuer den Titel');
  assert.equal(a.rom.held, 1);
  assert.equal(b.rom.letztes.ei, 'warte'); assert.equal(b.sonderEier.filter((e) => e.art === 'rom').length, 1);
  assert.ok(X.titelErreicht(a).includes('held_von_rom') && X.titelErreicht(a).includes('mozzarella_bezwinger'));
  assert.equal(a.rom.letztes.perle, 'neu', '120 Lire: Legende von Rom mit Schimmerperle');
  assert.ok(a.schimmerperle); assert.equal(a.rom.legende, 1); assert.ok(X.titelErreicht(a).includes('legende_von_rom'));
  assert.equal(a.rom.letztes.bossGold, ROM.BOSS_GOLD);
  const q = D.neuerStand(structuredClone(a), f.time);
  assert.equal(q.rom.legende, 1, 'der Titel bleibt beim Laden'); assert.equal(q.rom.letztes.perle, 'neu');
});

await test('Kaeseregen: nach Mozzarellus zwei Gold je Sekunde, hoechstens acht Sekunden am Stueck, nur in seiner Phase', async () => {
  const f = await mitSpielern({}, [anna, bo, cy]);
  await f.steuern(ceo, 'start');
  const ev = await f.ev();
  zuPhase(f, ev, ROM.P.imperator, 1000);
  const vorher = await f.aktion(anna, 'kaese');
  assert.equal(vorher.status, 409, 'solange Mozzarellus steht, regnet es nichts'); assert.match(vorher.error, /schmelzen/);
  await f.store.feldSetzen('rom-b:' + ev.id, kennung(cy), { ...ROM.leer(), hp: 3000, schaden: 999999, schlaege: 6, letzter: true });
  f.time += 1500; // der Server merkt sich den Stand eine Sekunde lang
  const erste = await f.aktion(anna, 'kaese');
  assert.equal(erste.status, 200, erste.error); assert.equal(erste.ergebnis.gold, 0, 'die erste Meldung setzt die Uhr');
  const besiegt = (await f.ev()).bossBesiegtAm;
  assert.equal(besiegt, f.time, 'der Server merkt sich, wann es losging');
  assert.equal(erste.rom.bossBesiegtAm, besiegt);
  f.time += 4000;
  const zwei = await f.aktion(anna, 'kaese');
  assert.equal(zwei.ergebnis.gold, 8, 'vier Sekunden, acht Gold');
  f.time += 4500;
  assert.equal((await f.aktion(anna, 'kaese')).ergebnis.gold, 8, 'halbe Sekunden bleiben fuer das naechste Mal');
  f.time += 30000;
  const lange = await f.aktion(anna, 'kaese');
  assert.equal(lange.ergebnis.gold, 16, 'wer weg war, bekommt hoechstens acht Sekunden');
  assert.equal(lange.rom.ich.kaeseGold, 8 + 8 + 16);
  const bo1 = await f.aktion(bo, 'kaese');
  assert.equal(bo1.ergebnis.gold, 16, 'wer spaet kommt, zaehlt ab seiner ersten Meldung zurueck, hoechstens acht Sekunden');
  f.time = ROM.plan(ev).phasen[ROM.P.imperator].bis - 1000;
  assert.equal((await f.aktion(bo, 'kaese')).ergebnis.gold, 16);
  zuPhase(f, ev, ROM.P.turbo, 3000);
  const danach = await f.aktion(bo, 'kaese');
  assert.equal(danach.status, 409, 'nach der Phase ist Schluss');
  const vorherGold = (await f.welt()).players[kennung(bo)].gold;
  f.time = ROM.ende(ev) + 4000;
  await f.call(bo, 'world');
  const b = (await f.welt()).players[kennung(bo)];
  assert.equal(b.gold, vorherGold + 32, 'Kaesegold gibt es auch ohne Tourist-Stufe');
  assert.equal(b.rom.letztes.kaese, 32);
});

await test('Trevi-Eier: sechs Stueck, jedes erst ab seiner Zeit und nur einmal, alle kommen an', async () => {
  const f = await mitSpielern({}, [anna, bo]);
  await f.steuern(ceo, 'start');
  const ev = await f.ev();
  zuPhase(f, ev, ROM.P.imperator, 1000);
  assert.equal((await f.aktion(anna, 'ei', { ei: 0 })).status, 409, 'nur waehrend der Brunnen explodiert');
  zuPhase(f, ev, ROM.P.trevi, 500);
  assert.equal((await f.aktion(anna, 'ei', { ei: 0 })).status, 409, 'das erste Ei ist noch im Brunnen');
  const zeiten = Array.from({ length: ROM.EIER.anzahl }, (_, k) => ROM.eiZeit(ev, k));
  const phase = ROM.plan(ev).phasen[ROM.P.trevi];
  assert.ok(zeiten.every((t, k) => t > phase.von && t < phase.bis && (!k || t > zeiten[k - 1])), 'ueber die ganze Explosion verteilt');
  f.time = zeiten[2] + 100;
  assert.equal((await f.aktion(anna, 'ei', { ei: 3 })).status, 409, 'Ei 4 kommt spaeter');
  f.time = zeiten[5] + 100;
  for (let k = 0; k < 6; k++) {
    const r = await f.aktion(anna, 'ei', { ei: k });
    assert.equal(r.status, 200, r.error); assert.equal(r.ergebnis.lire, 1);
  }
  assert.equal((await f.aktion(anna, 'ei', { ei: 2 })).status, 409, 'jedes Ei nur einmal');
  assert.equal((await f.aktion(anna, 'ei', { ei: 6 })).status, 409, 'ein siebtes gibt es nicht');
  assert.deepEqual((await f.aktion(bo, 'ei', { ei: 5 })).rom.ich.eier, [5]);
  const w0 = await f.welt(), eierVorher = w0.players[kennung(anna)].eggs.length;
  f.time = ROM.ende(ev) + 4000;
  await f.call(anna, 'world');
  const a = (await f.welt()).players[kennung(anna)];
  assert.deepEqual(a.rom.letztes.stufen, [], 'sechs Lire reichen nicht fuer den Touristen - die Eier gibt es trotzdem');
  const trevi = a.eggs.filter((e) => e.art === 'trevi').length + (a.sonderEier || []).filter((e) => e.art === 'trevi').length;
  assert.equal(trevi + a.rom.letztes.eier.gold, 6);
  assert.equal(a.rom.letztes.eier.tasche + a.rom.letztes.eier.warte + a.rom.letztes.eier.gold, 6);
  assert.ok(a.eggs.length >= eierVorher);
  assert.ok(a.eggs.filter((e) => e.art === 'trevi').every((e) => !e.festRang && !e.mindestens), 'ganz normale Eier');
});

await test('Espresso-Overdrive und Sternschnuppen: Turbo-Fang nur in seiner Phase, Sterne das ganze Event', async () => {
  const f = await mitSpielern({});
  await f.steuern(ceo, 'start');
  const ev = await f.ev();
  f.time = ev.start + 5000;
  const stern = await f.aktion(anna, 'stern');
  assert.equal(stern.status, 200, 'Sternschnuppen schon im Countdown'); assert.equal(stern.ergebnis.lire, 1);
  assert.equal((await f.aktion(anna, 'fang', { fang: 'turbo', anzahl: 5 })).status, 409, 'im Countdown noch nichts sonst');
  zuPhase(f, ev, ROM.P.imperator, 1000);
  assert.equal((await f.aktion(anna, 'fang', { fang: 'turbo', anzahl: 5 })).status, 409, 'Turbo gibt es nur im Overdrive');
  assert.equal((await f.aktion(anna, 'stern')).status, 200, 'und Sterne auch beim Boss');
  zuPhase(f, ev, ROM.P.turbo, 1000);
  const t = await f.aktion(anna, 'fang', { fang: 'turbo', anzahl: 5 });
  assert.equal(t.status, 200, t.error); assert.equal(t.ergebnis.lire, 5);
  assert.equal((await f.aktion(anna, 'zutat', { pizzaId: ROM.pizzen(ev, f.time)[0].id })).status, 409, 'die Turbo-Pizzen rasen nur vorbei');
  zuPhase(f, ev, ROM.P.trevi, 1000);
  assert.equal((await f.aktion(anna, 'fang', { fang: 'turbo', anzahl: 5 })).status, 409);
});

await test('Rom-Ei schluepfen: Seltenheit vom Server, fuer Dennis nur Legendaer', async () => {
  for (const [name, wurf, rang] of [['Anna', 0.005, 6], ['Anna', 0.05, 5], ['Anna', 0.5, 4], ['Dennis', 0.005, 4]]) {
    const f = await mitSpielern({ random: () => wurf }, []);
    assert.equal((await f.call(dennis, 'join', { requestId: f.id(), name })).status, 200);
    const w = (await f.store.getWithMetadata('world-v2')).data, p = w.players[kennung(dennis)];
    p.eggs = [{ id: 'rom-ei', territoryId: 1, producedAt: f.time, startedAt: f.time - E.HATCH_TIME, readyAt: f.time, mindestens: 4, art: 'rom' }];
    await f.store.setJSON('world-v2', w);
    const r = await f.call(dennis, 'hatch', { requestId: f.id(), eggId: 'rom-ei', name });
    assert.equal(r.status, 200, r.error);
    assert.equal(r.schlupf.rang, rang, name + ' ' + wurf);
  }
});

await test('Die Vorschau laeuft in der Testzone und beruehrt die echte Welt nicht', async () => {
  const f = await mitSpielern({});
  const r = await f.call(ceo, 'rom_steuern', { aktion: 'start', aktionId: f.id(), faktor: 3, adminOverride: true, adminCode: '3141' });
  assert.equal(r.status, 200, r.error); assert.ok(r.sandbox);
  assert.equal(await f.ev(), null, 'kein Event in der echten Welt');
  assert.equal((await f.call(admin, 'rom_steuern', { aktion: 'start', aktionId: f.id(), adminOverride: true, adminCode: '3141' })).status, 403, 'auch dort nur der CEO');
  const echt = await f.call(anna, 'presence', { position: { ...X.SPAWN, heading: 0 } });
  assert.equal(echt.rom, undefined);
});

await test('Vorschau zuerst starten, danach Insel betreten und mitspielen: Dokumente bleiben getrennt', async () => {
  const f = welt(), sandbox = { adminOverride: true, adminCode: '3141' };
  const start = await f.call(ceo, 'rom_steuern', { ...sandbox, aktion: 'start', aktionId: f.id(), faktor: 3 });
  assert.equal(start.status, 200, start.error); assert.ok(start.sandbox);
  const join = await f.call(ceo, 'join', { ...sandbox, requestId: f.id() });
  assert.equal(join.status, 200, join.error); assert.ok(join.profile && join.sandbox);
  const weltstand = await f.call(ceo, 'world', sandbox);
  assert.equal(weltstand.status, 200, weltstand.error); assert.ok(weltstand.profile);
  const status = await f.call(ceo, 'rom_steuern', { ...sandbox, aktion: 'status' });
  assert.equal(status.status, 200, status.error); assert.equal(status.steuerung.event.id, start.gestartet);
  f.time = ROM.plan(status.steuerung.event).phasen[0].von + 1000;
  const aktion = await f.call(ceo, 'rom_aktion', { ...sandbox, art: 'stern', aktionId: f.id() });
  assert.equal(aktion.status, 200, aktion.error); assert.equal(aktion.ergebnis.lire, 1);
  assert.equal(aktion.rom.id, start.gestartet); assert.equal(aktion.rom.ich.stern, 1);
  assert.equal(await f.ev(), null, 'kein Event in der echten Welt');
  assert.equal(await f.store.getWithMetadata('world-v2'), null, 'auch keine Spieler in der echten Welt');
});

/* ------------------------------------------------- Leitung im Relais */

async function relais(body) {
  const res = await room(new Request('http://localhost/api/room', { method: 'POST', body: JSON.stringify(body) }));
  return { status: res.status, ...(await res.json()) };
}
async function verwaltung() { return (await relais({ op: 'verw:read' })).daten || {}; }
async function schreiben(code, fn) { const d = await verwaltung(); fn(d); return relais({ op: 'verw:write', code, daten: d }); }

await test('Relais: CEO und Aufsichtsrat setzt nur, wer darf - am Browser vorbei geht nichts', async () => {
  await schreiben(admin, (d) => { d.owner = admin; d.aufsichtUmstellung = 1; });
  assert.equal((await verwaltung()).owner, admin, 'Anfang: beide Stuehle frei, ein Admin nimmt den CEO');
  await schreiben(ceo, (d) => { d.owner = ceo; });
  assert.equal((await verwaltung()).owner, admin, 'ein anderer Admin kann ihn nicht an sich ziehen');
  await schreiben(anna, (d) => { d.owner = anna; d.aufsicht = anna; });
  assert.equal((await verwaltung()).owner, admin, 'Spieler schon gar nicht');
  await schreiben(ceo, (d) => { d.aufsicht = ceo; });
  assert.equal((await verwaltung()).aufsicht, ceo, 'freier Aufsichtsrat');
  await schreiben(admin, (d) => { d.aufsicht = admin; });
  assert.equal((await verwaltung()).aufsicht, ceo, 'den Aufsichtsrat nimmt ihm keiner ab');
  await schreiben(ceo, (d) => { d.owner = neuerCeo; });
  assert.equal((await verwaltung()).owner, neuerCeo, 'der Aufsichtsrat setzt den CEO ein');
  await schreiben(neuerCeo, (d) => { d.owner = admin; });
  assert.equal((await verwaltung()).owner, admin, 'der CEO gibt seinen Stuhl weiter');
  await schreiben(admin, (d) => { d.owner = ''; });
  assert.equal((await verwaltung()).owner, admin, 'leeren kann nur der Aufsichtsrat');
  await schreiben(ceo, (d) => { d.owner = ''; });
  assert.equal((await verwaltung()).owner, '', 'der Aufsichtsrat setzt ab');
  await schreiben(admin, (d) => { d.owner = admin; });
  assert.equal((await verwaltung()).owner, '', 'mit Aufsichtsrat besetzt nur er den freien Stuhl');
  await schreiben(ceo, (d) => { d.owner = ceo; });
  assert.equal((await verwaltung()).owner, '', 'nie beide Stuehle bei einem');
  await schreiben(admin, (d) => { d.ansage = { id: 'a1', text: 'Hallo', art: 'info' }; });
  assert.equal((await verwaltung()).ansage.text, 'Hallo', 'alles andere schreibt ein Admin wie bisher');
});

await test('Ohne eingesetzten Speicher liest das Event den CEO aus der echten Verwaltung', async () => {
  await schreiben(ceo, (d) => { d.owner = neuerCeo; });
  const client = speicherClient();
  const store = _redisStore('hgh-gehstockmon', client), presence = _redisStore('hgh-gehstockmon-presence', client);
  const handler = createHandler({ store, presenceStore: presence, now: () => MITTWOCH, romPin: PIN_HASH, romDev: false });
  const call = async (code, aktion) => (await handler(new Request('http://x/api/gehstockmon', { method: 'POST', body: JSON.stringify({ op: 'rom_steuern', code, aktion, aktionId: 'rom-echt-' + code, pin: PIN }) }))).status;
  assert.equal(await call(ceo, 'status'), 403, 'der Aufsichtsrat ist nicht der CEO');
  assert.equal(await call(neuerCeo, 'start'), 200);
});

console.log(count + ' Rom-Tests bestanden.');
