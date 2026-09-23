/* ------------------------------------------------------------------
   Prueft den Takt des Relais im Browser (src/core/relais.js).

   Seit September 2026 haelt der Server keine Anfrage mehr offen - der
   Browser wartet selbst zwischen zwei Fragen. Wie lange, entscheidet
   allein diese Schleife, und davon haengt ab, ob die Kontingente von
   Datenbank und Netlify einen Schultag ueberstehen. Deshalb wird der
   Takt hier mit gestellter Uhr nachgezaehlt:

     ruhig          3 s, 4,5 s, ... bis hoechstens 15 s
     etwas Neues    zurueck auf 2 s
     Spielraum      jede Sekunde
     verdeckt       einmal je Minute, beim Zurueckholen sofort
     Fehler         wachsende Pause bis 20 s

   Aufruf: node tools/relais-tests.mjs
   ------------------------------------------------------------------ */

import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

function aufbauen() {
  /* Gestellte Uhr: Zeitgeber laufen erst, wenn der Test vorspult. */
  let jetzt = 0, naechsteId = 1;
  const zeitgeber = new Map();
  const setTimeout = (fn, ms) => { const id = naechsteId++; zeitgeber.set(id, { fn, bei: jetzt + Math.max(0, ms || 0) }); return id; };
  const clearTimeout = (id) => { zeitgeber.delete(id); };

  /* Gestellter Server: jede Anfrage wird mitgeschrieben und bekommt, was
     der Test vorher in 'antworten' gelegt hat - sonst "nichts Neues". */
  const anfragen = [];
  const antworten = [];
  let festhalten = null;             // haelt die naechste Antwort zurueck
  const fetch = (url, opt) => {
    const body = JSON.parse(opt.body);
    const eintrag = { body, bei: jetzt, abgebrochen: false };
    if (opt.signal) opt.signal.addEventListener('abort', () => { eintrag.abgebrochen = true; });
    anfragen.push(eintrag);
    const antwort = antworten.length ? antworten.shift() : { version: 1, pv: 1, leer: true };
    const liefern = () => (antwort instanceof Error ? Promise.reject(antwort) : Promise.resolve({
      ok: true, status: 200,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve(antwort),
      text: () => Promise.resolve(''),
    }));
    if (festhalten) { const f = festhalten; festhalten = null; return new Promise((ok) => { f.los = () => ok(liefern()); }); }
    return liefern();
  };

  const hoerer = {};
  const document = {
    visibilityState: 'visible',
    addEventListener: (art, fn) => { (hoerer[art] || (hoerer[art] = [])).push(fn); },
  };
  const SG = {
    offline: false, env: {},
    noteError: (wo, e) => { throw e; },
    storage: { globalGet: () => 'gtestgeraet01', globalSet() {} },
    auth: { aktuell: { code: '0141', name: 'Test', rolle: 'S' } },
    verwaltung: { laden: () => Promise.resolve() },
  };
  const kontext = vm.createContext({
    SG, document, fetch, setTimeout, clearTimeout, AbortController,
    navigator: { userAgent: 'node', maxTouchPoints: 0 }, console, Promise, JSON, Date, Math, Object,
  });
  vm.runInContext(fs.readFileSync('src/core/util.js', 'utf8'), kontext);
  vm.runInContext(fs.readFileSync('src/core/relais.js', 'utf8'), kontext);

  const leeren = () => new Promise((ok) => setImmediate(ok));
  /* Spult die Uhr vor und laesst dazwischen alle Antworten ankommen. */
  async function vorspulen(ms) {
    const ziel = jetzt + ms;
    for (let runden = 0; ; runden++) {
      /* Wer ohne Pause fragt, kaeme hier nie heraus - so sah die alte
         Langabfrage aus Sicht des Browsers aus. */
      if (runden > 5000) throw new Error('Endlosschleife: das Relais fragt ohne Pause');
      await leeren(); await leeren();
      let erster = null;
      for (const [id, t] of zeitgeber) if (t.bei <= ziel && (!erster || t.bei < erster[1].bei)) erster = [id, t];
      if (!erster) break;
      zeitgeber.delete(erster[0]);
      jetzt = erster[1].bei;
      erster[1].fn();
    }
    jetzt = ziel;
    await leeren(); await leeren();
  }
  const syncs = () => anfragen.filter((a) => a.body.op === 'sync');
  const abstaende = () => syncs().map((a, i, l) => (i ? a.bei - l[i - 1].bei : a.bei));
  return {
    R: SG.relais, document, hoerer, anfragen, antworten, vorspulen, syncs, abstaende,
    festhalten: () => { festhalten = {}; return festhalten; },
    zeit: () => jetzt,
  };
}

let bestanden = 0;
async function pruefe(name, fn) {
  try { await fn(); console.log('  ok   ' + name); bestanden++; }
  catch (e) { console.log('  FEHL ' + name + '\n       ' + e.message); process.exitCode = 1; }
}

console.log('\nRelais: Takt im Browser\n');

await pruefe('fragt kurz und sofort, dann in wachsenden Pausen bis 15 s', async () => {
  const t = aufbauen();
  t.R.starten();
  await t.vorspulen(120000);
  const s = t.syncs();
  assert.equal(s[0].bei, 0, 'die erste Runde laeuft sofort');
  assert.ok(s.every((a) => a.body.kurz === true), 'jede Runde fragt kurz');
  assert.deepEqual(t.abstaende().slice(1, 7), [3000, 4500, 6750, 10125, 15000, 15000]);
  assert.ok(s.length <= 13, 'zwei Minuten Ruhe kosten hoechstens 13 Anfragen, waren ' + s.length);
});

await pruefe('etwas Neues macht den Takt wieder schnell', async () => {
  const t = aufbauen();
  t.R.beobachten('kreis');
  t.R.starten();
  await t.vorspulen(60000);
  const vorher = t.syncs().length;
  t.antworten.push({ version: 2, pv: 1, kanaele: { kreis: { version: 1, nachrichten: [{ id: 1, text: 'hi' }] } } });
  await t.vorspulen(15000);
  const nachNeuem = t.syncs().slice(vorher);
  assert.equal(nachNeuem[1].bei - nachNeuem[0].bei, 2000, 'nach Inhalt 2 s Pause');
  assert.equal(nachNeuem[2].bei - nachNeuem[1].bei, 3000, 'danach wieder wachsend');
});

await pruefe('im Spielraum jede Sekunde, danach wieder ruhig', async () => {
  const t = aufbauen();
  t.R.starten();
  await t.vorspulen(60000);
  const vorher = t.syncs().length;
  t.R.raumBeobachten('ABCDEF', 0, () => {});
  await t.vorspulen(5000);
  const imRaum = t.syncs().slice(vorher);
  assert.equal(imRaum[0].body.raum.code, 'ABCDEF');
  assert.ok(imRaum[0].bei - t.syncs()[vorher - 1].bei < 15000, 'das Betreten fragt sofort');
  assert.deepEqual(imRaum.slice(1).map((a, i) => a.bei - imRaum[i].bei).slice(0, 3), [1000, 1000, 1000]);
  t.R.raumEnde();
  const n = t.syncs().length;
  await t.vorspulen(20000);
  assert.ok(t.syncs().length - n <= 5, 'ohne Raum wieder langsam');
});

await pruefe('verdeckter Tab fragt einmal je Minute, beim Zurueckholen sofort', async () => {
  const t = aufbauen();
  t.R.starten();
  await t.vorspulen(30000);
  t.document.visibilityState = 'hidden';
  await t.vorspulen(20000);           // die laufende Pause endet noch
  const n = t.syncs().length;
  await t.vorspulen(180000);
  assert.ok(t.syncs().length - n <= 3, 'drei Minuten verdeckt: hoechstens drei Anfragen, waren ' + (t.syncs().length - n));
  const m = t.syncs().length;
  const zurueck = t.zeit();
  t.document.visibilityState = 'visible';
  t.hoerer.visibilitychange.forEach((fn) => fn());
  await t.vorspulen(1000);
  assert.equal(t.syncs().length, m + 1, 'wieder vorn: sofort gefragt');
  assert.ok(t.syncs()[m].bei - zurueck < 1000);
});

await pruefe('Neues waehrend einer Anfrage bricht sie nicht ab, sondern haengt eine an', async () => {
  const t = aufbauen();
  t.R.starten();
  await t.vorspulen(10000);
  const halt = t.festhalten();
  await t.vorspulen(15000);           // die naechste Runde startet und haengt
  const offen = t.syncs().length;
  t.R.ortSetzen('#/chat');
  t.R.ortSetzen('#/chat/kreis');
  await t.vorspulen(100);
  assert.equal(t.syncs().length, offen, 'keine zweite Anfrage parallel');
  assert.equal(t.syncs()[offen - 1].abgebrochen, false, 'die laufende wird nicht abgebrochen');
  halt.los();
  await t.vorspulen(10);
  assert.equal(t.syncs().length, offen + 1, 'direkt nach der Antwort kommt die naechste');
  assert.equal(t.syncs()[offen].body.wo, '#/chat/kreis', 'mit dem neuen Ort');
});

await pruefe('Fehler: Pause waechst bis 20 s, Erfolg beruhigt wieder', async () => {
  const t = aufbauen();
  for (let i = 0; i < 12; i++) t.antworten.push(new Error('Failed to fetch'));
  t.R.starten();
  await t.vorspulen(150000);
  const a = t.abstaende();
  assert.equal(a[1], 800);
  assert.equal(Math.max(...a.slice(1, 12)), 20000, 'hoechstens 20 s');
  assert.equal(t.R.online, true, 'nach den Fehlern wieder verbunden');
});

console.log('\n' + bestanden + ' bestanden' + (process.exitCode ? ', Fehler siehe oben' : ', 0 durchgefallen') + '\n');
