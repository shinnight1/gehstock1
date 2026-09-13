import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createAuth } from '../netlify/functions/lib/auth-service.mjs';
import { protect } from '../netlify/functions/lib/auth-gateway.mjs';
import { legacyCodes, roleForCode, serviceKey } from '../netlify/functions/lib/auth-codes.mjs';
import { createRoomHandler } from '../netlify/functions/room.mjs';
import { createHandler } from '../netlify/functions/gehstockmon.mjs';
import { memoryStore } from './auth-memory-store.mjs';

let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log('ok ' + name); }
const admin = legacyCodes.find(c => roleForCode(c) === 'A'), player = legacyCodes.find(c => roleForCode(c) === 'S');
const other = legacyCodes.find(c => roleForCode(c) === 'A' && c !== admin);
function fixture() {
  const sessions = memoryStore(), rooms = memoryStore(); let time = Date.parse('2026-09-17T08:00:00+02:00');
  const service = createAuth({ sessions, rooms, now: () => time });
  return { service, rooms, sessions, advance(n) { time += n; }, room: protect(createRoomHandler(rooms), { service }) };
}
async function call(handler, body, token, ip = 'test') {
  const res = await handler(new Request('http://localhost/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip, ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) }));
  return { status: res.status, ...(await res.json()) };
}
const login = (f, code, ip = code) => call(f.service.endpoint, { op: 'login', code }, null, ip);

await test('All existing credentials keep exactly their old role; malformed credentials fail', async () => {
  const f = fixture();
  for (const code of legacyCodes) { const r = await login(f, code); assert.equal(r.status, 200); assert.equal(r.profile.code, code); assert.equal(r.profile.rolle, roleForCode(code)); }
  for (const code of ['bad', '0000', admin + 'x', Number(admin), null]) assert.equal((await login(f, code, 'invalid')).status, 401);
});
await test('Anonymous reads and forged browser roles cannot access the relay or create credentials', async () => {
  const f = fixture(), p = await login(f, player);
  assert.equal((await call(f.room, { op: 'verw:read', code: admin, rolle: 'A' })).status, 401);
  assert.equal((await call(f.service.endpoint, { op: 'create', role: 'A', name: 'Intruder', rolle: 'A' }, p.token)).status, 403);
  assert.equal((await call(f.room, { op: 'befehl', art: 'bann', rolle: 'A', code: admin }, p.token)).status, 403);
  assert.equal((await call(f.room, { op: 'schirm:get', code: admin }, p.token)).status, 403);
});
await test('Public profiles, presence, keys and chat references hide foreign codes and round-trip safely', async () => {
  const f = fixture();
  await f.rooms.setJSON('verwaltung', { version: 1, daten: { owner: admin, profile: [{ code: admin, name: 'Admin', rolle: 'S' }, { code: player, name: 'Player', rolle: 'S' }], banne: { [other]: { grund: 'Test' } } } });
  const p = await login(f, player), out = JSON.stringify(p.verw);
  assert.ok(!out.includes('"' + admin + '"')); assert.ok(!out.includes('"' + other + '"'));
  assert.equal(p.verw.daten.profile[0].rolle, 'A');
  const user = await f.service.authenticate(new Request('http://localhost', { headers: { Authorization: 'Bearer ' + p.token } }));
  const original = { code: admin, channel: 'dm:' + admin + ':' + player, byCode: { [admin]: 'value' }, data: 'data:image/png;base64,+' + admin + '/' };
  const encoded = await f.service.transform(original, user); assert.notEqual(encoded.code, admin); assert.equal(encoded.data, original.data);
  assert.deepEqual(await f.service.transform(encoded, user, true), original);
  assert.equal((await f.service.transform({ code: admin, game: 'chess', players: [] }, user)).code, admin, 'a public room invitation is not rewritten');
  assert.equal((await f.service.transform({ raum: { code: admin, since: 1 } }, user)).raum.code, admin);
  await assert.rejects(f.service.transform({ zusatz: { code: admin } }, user, true), /Spielerkennung/);
  await assert.rejects(f.service.transform({ zusatz: { code: '0000' } }, user, true), /Spielerkennung/);
  const echoed = await f.service.transform({ text: '0000 ' + admin }, user);
  assert.equal(echoed.text, '•••• ••••', 'echoed text reveals neither code validity nor a public-ID mapping');
  assert.deepEqual(await f.service.transform({ pixel: { '1234,1234': [1, 2] } }, user), { pixel: { '1234,1234': [1, 2] } });
  assert.equal((await login(f, encoded.code)).status, 401, 'public IDs are not credentials');
  const response = await call(f.room, { op: 'verw:read' }, p.token);
  assert.equal(response.daten.owner, p.verw.daten.owner);
});
await test('Existing player IDs and game saves stay unchanged; no session or a foreign code cannot touch the game', async () => {
  const f = fixture(), store = memoryStore();
  const inner = createHandler({ store, now: () => Date.parse('2026-09-17T08:00:00+02:00') }), mon = protect(inner, { service: f.service, kind: 'mon' });
  const before = await call(inner, { op: 'join', code: player, name: 'Existing' });
  assert.equal((await call(mon, { op: 'join', code: player })).status, 401);
  const p = await login(f, player);
  const after = await call(mon, { op: 'join', code: player }, p.token);
  assert.equal(after.playerId, before.playerId); assert.deepEqual(after.profile.besitz, before.profile.besitz);
  assert.equal((await call(mon, { op: 'join', code: admin, adminOverride: true, adminCode: '3141' }, p.token)).status, 403);
});
await test('Server limits attempts atomically; logout, expiration and bans invalidate sessions', async () => {
  const f = fixture();
  const results = await Promise.all(Array.from({ length: 14 }, () => login(f, '0000', 'same')));
  assert.equal(results.filter(r => r.status === 401).length, 12); assert.equal(results.filter(r => r.status === 429).length, 2);
  const p = await login(f, player), a = await login(f, admin);
  assert.equal((await call(f.service.endpoint, { op: 'logout' }, p.token)).status, 200);
  assert.equal((await call(f.room, { op: 'verw:read' }, p.token)).status, 401);
  f.advance(8 * 3600000 + 1); assert.equal((await call(f.room, { op: 'verw:read' }, a.token)).status, 401);
  const fresh = await login(f, player); await f.rooms.setJSON('verwaltung', { version: 1, daten: { banne: { [player]: { grund: 'Test' } } } });
  assert.equal((await call(f.room, { op: 'verw:read' }, fresh.token)).status, 403);
  assert.equal((await login(f, player)).status, 403);
});
await test('Only admins allocate codes, concurrent allocations differ, and owners remain protected', async () => {
  const f = fixture(), a = await login(f, admin);
  const made = await Promise.all(['One', 'Two'].map(name => call(f.service.endpoint, { op: 'create', role: 'S', name }, a.token)));
  assert.ok(made.every(r => r.status === 200)); assert.notEqual(made[0].code, made[1].code);
  await f.rooms.setJSON('verwaltung', { version: 1, daten: { owner: admin, profile: [{ code: admin, name: 'Owner', rolle: 'A' }, { code: other, name: 'Other', rolle: 'A' }], banne: {} } });
  const b = await login(f, other), desired = structuredClone(b.verw.daten); desired.banne[admin] = { grund: 'Fake' };
  assert.equal((await call(f.room, { op: 'verw:write', version: 1, daten: desired }, b.token)).status, 403);
  const p = await login(f, player);
  await call(f.room, { op: 'verw:write', daten: { owner: player, bnd: [player], profile: [{ code: player, name: 'Name', rolle: 'A' }] } }, p.token);
  const stored = await f.rooms.get('verwaltung'); assert.equal(stored.daten.owner, admin); assert.equal(stored.daten.profile.find(p => p.code === player).rolle, 'S'); assert.ok(!stored.daten.bnd?.includes(player));
});
await test('BND keys are checked on the server and never sent to ordinary players', async () => {
  const f = fixture(); await f.rooms.setJSON('verwaltung', { version: 1, daten: { bnd: [player] } });
  const p = await login(f, player), a = await login(f, admin);
  assert.equal((await call(f.service.endpoint, { op: 'bnd-key', code: admin }, p.token)).status, 403);
  assert.equal((await call(f.service.endpoint, { op: 'bnd-check', value: 'wrong' }, p.token)).status, 403);
  assert.equal((await call(f.service.endpoint, { op: 'bnd-check', value: serviceKey(player) }, p.token)).status, 200);
  assert.equal((await call(f.service.endpoint, { op: 'bnd-key', code: player }, a.token)).value, serviceKey(player));
});
await test('Browser assets contain neither credential derivation nor offline authentication fallback', async () => {
  const paths = fs.readdirSync('dist/assets').filter(p => p.endsWith('.js')).map(p => 'dist/assets/' + p).concat(fs.readdirSync('dist/offline').filter(p => p.endsWith('.html')).map(p => 'dist/offline/' + p));
  for (const path of paths) { const text = fs.readFileSync(path, 'utf8'); assert.ok(!text.includes('gehstock:hideout:2026:kellergewoelbe'), path); assert.ok(!text.includes('A.vorrat ='), path); }
  const f = fixture(), state = {}, SG = { util: {}, env: {}, offline: false, storage: { globalDel() {}, globalSet() {}, globalGet: (_, fallback) => fallback, setUser(code) { state.user = code; } }, relais: {}, verwaltung: { sitzung(res) { state.verw = res; }, daten() { return state.verw?.daten || {}; }, schreiben(fn) { state.verw ||= { daten: {} }; fn(state.verw.daten); } } };
  const context = vm.createContext({ SG, AbortController, setTimeout, clearTimeout, fetch: (url, options) => f.service.endpoint(new Request('http://localhost' + url, options)) });
  vm.runInContext(fs.readFileSync('src/core/auth.js', 'utf8'), context);
  assert.equal(SG.auth.pruefen, undefined); assert.equal(SG.auth.vorrat, undefined);
  await assert.rejects(SG.auth.anmelden('0000')); assert.equal(SG.auth.aktuell, null);
  await SG.auth.anmelden(player, 'Existing'); assert.equal(state.user, player); assert.equal(SG.auth.aktuell.rolle, 'S'); assert.ok(SG.auth.headers().Authorization);
  SG.auth.abmelden(); assert.equal(SG.auth.verbunden(), false);
  SG.offline = true; await assert.rejects(SG.auth.anmelden(player), /Internetverbindung/);
});
console.log('\n' + passed + ' server authentication checks passed.');
