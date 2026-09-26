/* ------------------------------------------------------------------
   Prueft die Speicherschicht gegen ein nachgebautes Redis.

   Getestet wird das, was im Fehlerfall still Spielstaende frisst:
   verliert der zweite von zwei gleichzeitigen Schreibern, oder
   ueberschreibt er den ersten?

   Das Lua aus speicher.mjs wird hier nicht interpretiert, sondern
   nachvollzogen - dieselbe Reihenfolge, dieselben Bedingungen.
   ------------------------------------------------------------------ */

import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

process.env.UPSTASH_REDIS_REST_URL = 'https://test.invalid';
process.env.UPSTASH_REDIS_REST_TOKEN = 'test';
delete process.env.REDIS_URL; delete process.env.REDIS_PASS;

const sha1 = (t) => createHash('sha1').update(t).digest('hex');

/* Nachbau von redis.call GET/SET plus des CAS-Skripts. */
const daten = new Map();
const fakeRedis = {
  get: async (k) => (daten.has(k) ? daten.get(k) : null),
  set: async (k, v) => { daten.set(k, v); return 'OK'; },
  del: async (...ks) => { ks.forEach((k) => daten.delete(k)); return ks.length; },
  eval: async (_skript, keys, argv) => {
    const aktuell = daten.has(keys[0]) ? daten.get(keys[0]) : null;
    if (argv[1] === '@neu') { if (aktuell !== null) return 0; }
    else {
      if (aktuell === null) return 0;
      if (sha1(aktuell) !== argv[1]) return 0;
    }
    daten.set(keys[0], argv[0]);
    return 1;
  },
};

const { _redisStore, speicherArt } = await import('../netlify/functions/lib/speicher.mjs');
const speicher = (name) => _redisStore(name, fakeRedis);

let bestanden = 0;
async function pruefe(name, fn) {
  try { await fn(); console.log('  ok   ' + name); bestanden++; }
  catch (e) { console.log('  FEHL ' + name + '\n       ' + e.message); process.exitCode = 1; }
}

console.log('\nSpeicherschicht\n');

await pruefe('erkennt Upstash an der Umgebung', () => {
  assert.equal(speicherArt(), 'upstash');
});

await pruefe('schreiben und lesen laeuft rund', async () => {
  const st = speicher('test-a');
  assert.equal(await st.get('k'), null);
  await st.setJSON('k', { gold: 5 });
  assert.deepEqual(await st.get('k'), { gold: 5 });
});

await pruefe('getWithMetadata liefert Daten und einen Stempel', async () => {
  const st = speicher('test-a');
  const e = await st.getWithMetadata('k');
  assert.deepEqual(e.data, { gold: 5 });
  assert.equal(typeof e.etag, 'string');
  assert.ok(e.etag.length > 10, 'Stempel darf nicht leer sein');
});

await pruefe('der Stempel folgt dem Inhalt', async () => {
  const st = speicher('test-a');
  const vorher = (await st.getWithMetadata('k')).etag;
  await st.setJSON('k', { gold: 6 });
  assert.notEqual((await st.getWithMetadata('k')).etag, vorher);
});

await pruefe('onlyIfNew schreibt nur ins Leere', async () => {
  const st = speicher('test-b');
  assert.equal((await st.setJSON('neu', { a: 1 }, { onlyIfNew: true })).modified, true);
  assert.equal((await st.setJSON('neu', { a: 2 }, { onlyIfNew: true })).modified, false);
  assert.deepEqual(await st.get('neu'), { a: 1 });
});

await pruefe('onlyIfMatch nimmt den richtigen Stempel an', async () => {
  const st = speicher('test-b');
  const e = await st.getWithMetadata('neu');
  assert.equal((await st.setJSON('neu', { a: 9 }, { onlyIfMatch: e.etag })).modified, true);
  assert.deepEqual(await st.get('neu'), { a: 9 });
});

await pruefe('onlyIfMatch weist einen veralteten Stempel ab', async () => {
  const st = speicher('test-b');
  const alt = await st.getWithMetadata('neu');
  await st.setJSON('neu', { a: 10 });
  assert.equal((await st.setJSON('neu', { a: 99 }, { onlyIfMatch: alt.etag })).modified, false);
  assert.deepEqual(await st.get('neu'), { a: 10 }, 'der alte Stand darf nicht gewinnen');
});

await pruefe('ein leerer Stempel schreibt NICHT blind', async () => {
  const st = speicher('test-b');
  const vorher = await st.get('neu');
  assert.equal((await st.setJSON('neu', { kaputt: true }, { onlyIfMatch: '' })).modified, false);
  assert.deepEqual(await st.get('neu'), vorher, 'leerer Stempel darf nie durchgehen');
});

await pruefe('zwei gleichzeitige Schreiber: einer verliert', async () => {
  const st = speicher('test-c');
  await st.setJSON('welt', { zug: 0 });
  const a = await st.getWithMetadata('welt');
  const b = await st.getWithMetadata('welt');           // beide lesen denselben Stand
  const erst = await st.setJSON('welt', { zug: 1 }, { onlyIfMatch: a.etag });
  const dann = await st.setJSON('welt', { zug: 2 }, { onlyIfMatch: b.etag });
  assert.equal(erst.modified, true);
  assert.equal(dann.modified, false, 'der zweite darf den ersten nicht ueberschreiben');
  assert.deepEqual(await st.get('welt'), { zug: 1 });
});

await pruefe('ein eingespieltes Backup ist sofort beschreibbar', async () => {
  /* Das Einspielskript schreibt nur den Text, keinen Stempel. Der erste
     Spielzug danach muss trotzdem durchgehen. */
  const st = speicher('hgh-gehstockmon');
  daten.set('hgh:hgh-gehstockmon:world-v2', JSON.stringify({ version: 1, players: { x: { gold: 7 } } }));
  const e = await st.getWithMetadata('world-v2');
  assert.equal(e.data.players.x.gold, 7);
  const w = await st.setJSON('world-v2', { version: 2, players: {} }, { onlyIfMatch: e.etag });
  assert.equal(w.modified, true, 'nach dem Einspielen muss der erste Zug klappen');
});

await pruefe('Stores kommen sich nicht ins Gehege', async () => {
  const a = speicher('store-1'), b = speicher('store-2');
  await a.setJSON('gleich', { wer: 'a' });
  await b.setJSON('gleich', { wer: 'b' });
  assert.deepEqual(await a.get('gleich'), { wer: 'a' });
  assert.deepEqual(await b.get('gleich'), { wer: 'b' });
});

await pruefe('loeschen entfernt den Eintrag', async () => {
  const st = speicher('test-a');
  await st.setJSON('weg', { x: 1 });
  await st.delete('weg');
  assert.equal(await st.get('weg'), null);
});

/* Eine Datenbank am Kontingentende lehnt einen Teil der Befehle ab. Genau
   dann darf die Speicherschicht nicht aufgeben - sonst meldet die Seite
   "Verbindung zur Spielerwelt verloren", obwohl der naechste Versuch
   durchgegangen waere. */
await pruefe('Abgelehnte Befehle werden wiederholt, echte Fehler nicht', async () => {
  const { _redisStore } = await import('../netlify/functions/lib/speicher.mjs');
  let versuche = 0;
  const wackelig = {
    get: async (k) => { versuche++; if (versuche < 3) throw new Error('Command failed: ERR max requests limit exceeded. Limit: 500000'); return daten.get(k) || null; },
    set: async (k, v) => { daten.set(k, v); return 'OK'; },
    eval: fakeRedis.eval, del: fakeRedis.del, scan: async () => ['0', []],
  };
  daten.set('hgh:wackelig:welt', JSON.stringify({ da: true }));
  const st = _redisStore('wackelig', wackelig);
  assert.deepEqual(await st.get('welt'), { da: true }, 'nach zwei Absagen kommt der Wert');
  assert.equal(versuche, 3, 'genau zwei Nachfragen, nicht mehr');

  /* Ein echter Fehler soll sofort durchschlagen und nicht dreimal dauern. */
  let echte = 0;
  const kaputt = { ...wackelig, get: async () => { echte++; throw new Error('WRONGPASS invalid password'); } };
  await assert.rejects(_redisStore('kaputt', kaputt).get('welt'), /WRONGPASS/);
  assert.equal(echte, 1, 'kein Wiederholen bei einem echten Fehler');
});

/* Felder (Hash) fuer die Anwesenheit in GehstockMon. Der echte Client
   liefert HGETALL ohne automatische Umwandlung als flache Liste
   [feld, wert, feld, wert] - genau so antwortet der Nachbau hier. */
await pruefe('Felder: jeder schreibt nur sein eigenes, alle lesen alle', async () => {
  const hashes = new Map();
  const mitHash = {
    ...fakeRedis,
    hgetall: async (k) => [...(hashes.get(k) || new Map())].flat(),
    hset: async (k, kv) => { const h = hashes.get(k) || new Map(); for (const [f, v] of Object.entries(kv)) h.set(f, v); hashes.set(k, h); return 1; },
    hdel: async (k, ...fs) => { const h = hashes.get(k); fs.forEach((f) => h && h.delete(f)); return fs.length; },
  };
  const st = _redisStore('feld-test', mitHash);
  assert.deepEqual(await st.felder('anwesenheit'), {}, 'leer ist ein leeres Objekt, nicht null');
  await Promise.all([st.feldSetzen('anwesenheit', 'a', { x: 1 }), st.feldSetzen('anwesenheit', 'b', { x: 2 })]);
  assert.deepEqual(await st.felder('anwesenheit'), { a: { x: 1 }, b: { x: 2 } }, 'zwei gleichzeitige Schreiber, keiner verliert');
  await st.felderWeg('anwesenheit', ['a']);
  assert.deepEqual(await st.felder('anwesenheit'), { b: { x: 2 } });
  assert.ok(hashes.has('hgh:feld-test:anwesenheit'), 'liegt im Namensraum des Stores');
  /* Aeltere Clients liefern ein Objekt statt der Liste. */
  const alt = _redisStore('feld-test', { ...mitHash, hgetall: async () => ({ b: JSON.stringify({ x: 2 }) }) });
  assert.deepEqual(await alt.felder('anwesenheit'), { b: { x: 2 } });
});

console.log('\n' + bestanden + ' bestanden' + (process.exitCode ? ', Fehler siehe oben' : ', 0 durchgefallen') + '\n');
