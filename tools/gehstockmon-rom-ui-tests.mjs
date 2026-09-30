/* Rom-Event: die Bedienoberflaeche (src/games/gehstockmon/2-rom-ui.js) mit
   nachgebautem DOM und gestellter Uhr - kein Rendering, aber die echten
   Knoepfe, Anfragen, Phasenwechsel und das Aufraeumen.
   Aufruf: node tools/gehstockmon-rom-ui-tests.mjs */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { data as D, economy as E, adventure as X } from '../netlify/functions/lib/gehstockmon-rules.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROM = X.ROM;
let count = 0;
async function test(name, fn) { await fn(); console.log('ok', name); count++; }

class Element {
  constructor(tag) { this.tagName = tag; this.children = []; this.events = {}; this.attrs = {}; this.hidden = false; this.disabled = false; this.className = ''; this.text = ''; this.dataset = {}; this.parentNode = null;
    const self = this;
    this.style = { setProperty() {}, removeProperty() {} };
    this.classList = {
      contains: (c) => self.className.split(' ').includes(c),
      add: (...cs) => { self.className = [...new Set(self.className.split(' ').concat(cs))].filter(Boolean).join(' '); },
      remove: (...cs) => { self.className = self.className.split(' ').filter((c) => !cs.includes(c)).join(' '); },
      toggle: (c, an) => { const soll = an === undefined ? !self.classList.contains(c) : !!an; if (soll) self.classList.add(c); else self.classList.remove(c); return soll; },
    };
  }
  get childNodes() { return this.children; }
  get firstChild() { return this.children[0] || null; }
  get lastChild() { return this.children.at(-1) || null; }
  get offsetWidth() { return 0; }
  get isConnected() { return true; }
  appendChild(e) { if (e.parentNode) e.parentNode.removeChild(e); e.parentNode = this; this.children.push(e); return e; }
  insertBefore(e, vor) { if (e.parentNode) e.parentNode.removeChild(e); e.parentNode = this; const i = this.children.indexOf(vor); this.children.splice(i < 0 ? this.children.length : i, 0, e); return e; }
  removeChild(e) { const i = this.children.indexOf(e); if (i >= 0) this.children.splice(i, 1); e.parentNode = null; return e; }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  set textContent(v) { this.text = String(v); this.children = []; }
  get textContent() { return this.text + this.children.map((c) => c.textContent).join(''); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k]; }
  addEventListener(k, fn) { this.events[k] = fn; }
  removeEventListener(k) { delete this.events[k]; }
  fire(k) { if (this.disabled) return; const e = { target: this, stopPropagation() {} }; if (this.events[k]) this.events[k](e); if (k === 'click' && this.onclick) this.onclick(e); }
  get sichtbar() { return !this.hidden && (!this.parentNode || this.parentNode.sichtbar); }
  alle() { return [this, ...this.children.flatMap((c) => c.alle())]; }
  querySelectorAll(sel) { return this.alle().filter((e) => sel[0] === '.' && e.classList.contains(sel.slice(1))); }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}

function umgebung({ musikDatei = false, tonAn = true } = {}) {
  const uhr = { jetzt: Date.parse('2026-09-30T09:00:00+02:00') }, timers = new Map();
  let timerId = 0;
  const anfragen = [], toene = [];
  let antwort = null;
  const root = new Element('div');
  const SG = {
    ui: { clear(e) { e.children.slice().forEach((c) => e.removeChild(c)); } },
    storage: { get: (k, d) => d, set() {} },
    assets: musikDatei ? { 'gm-rom-musik': 'musik.mp3' } : {},
    audio: { play() {}, unlock() {}, note: (n) => 440 * Math.pow(2, n / 12), tone: (o) => toene.push(o),
      kontext: () => (tonAn ? { ctx: { state: 'running', currentTime: 0 }, ziel: {} } : null) },
    gehstockmon: { daten: D, wirtschaft: E, abenteuer: X, online: { request: (op, daten) => { anfragen.push({ op, ...daten }); return Promise.resolve(antwort ? antwort(op, daten) : { serverTime: uhr.jetzt }); } } },
  };
  const context = vm.createContext({ SG, window: {}, document: { createElement: (t) => new Element(t) }, Date, Math, JSON, Promise, Object, Array, String, Number, isFinite, console });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/games/gehstockmon/2-rom-ui.js'), 'utf8'), context);
  const el = (tag, text, cls) => { const e = new Element(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const button = (text, fn, cls) => { const b = el('button', text, cls || 'gm-button'); b.type = 'button'; b.addEventListener('click', fn); return b; };
  const st = { value: D.neuerStand(null, uhr.jetzt) };
  const welt = { ort: { x: 0, z: 30 }, position() { return { ...this.ort, heading: 0 }; }, walkToPoint(p) { this.ziel = p; } };
  const env = { uhr, timers, anfragen, toene, root, SG, welt, st, gemeldet: null, weltAnfragen: 0,
    setAntwort(fn) { antwort = fn; },
    c: null };
  env.c = { el, button, root, world: () => welt, now: () => uhr.jetzt, notify: (t) => { env.meldung = t; }, state: () => st.value, busy: () => false, imKampf: () => false,
    apply: () => { env.weltAnfragen++; }, eier() {}, after: (fn, ms) => { timers.set(++timerId, { fn, at: uhr.jetzt + ms }); return timerId; }, cancel: (id) => timers.delete(id),
    gemeldet: () => env.gemeldet, sofortMelden: () => { env.sofort = (env.sofort || 0) + 1; } };
  env.rom = SG.gehstockmon.mountRom(env.c);
  env.box = root.children[0];
  /* Uhr vorstellen und faellige Zeitgeber abarbeiten. */
  env.vor = async (ms) => {
    const ziel = uhr.jetzt + ms;
    for (;;) {
      const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at).find(([, t]) => t.at <= ziel);
      if (!next) break;
      timers.delete(next[0]); uhr.jetzt = Math.max(uhr.jetzt, next[1].at); next[1].fn();
      await new Promise(setImmediate);
    }
    uhr.jetzt = ziel;
  };
  env.knoepfe = () => env.box.querySelector('.gm-rom-knoepfe').children;
  env.knopf = (teil) => env.box.alle().find((e) => e.tagName === 'button' && e.sichtbar && e.textContent.includes(teil));
  return env;
}
function sicht(ev, ich = {}, mehr = {}) {
  return { id: ev.id, start: ev.start, faktor: 1, abgebrochenAm: ev.abgebrochenAm || null, von: 'Chefin', vorschau: false, ueberraschungen: {}, teilnehmer: 1,
    leiste: { wert: 0, ziel: 75, voll: false }, boss: { hp: 0, max: 0, besiegt: false },
    ich: { lire: 0, proPhase: [0, 0, 0, 0, 0], stern: 0, schlaege: 0, schaden: 0, vorrat: 3, zutaten: [], tanz: [], gefechte: { s: 0, n: 0 }, muenze: false, fang: {}, tPolonaise: 0, tGefecht: 0, tStern: 0, tZutat: 0, schlagStand: null, ...ich },
    serverTime: 0, ...mehr };
}

await test('Ohne Event bleibt alles verborgen, mit Event erscheint der Countdown', async () => {
  const u = umgebung();
  assert.ok(u.box.hidden);
  const ev = { id: 'rom-ui-1', start: u.uhr.jetzt };
  u.rom.presenz(sicht(ev), u.uhr.jetzt);
  assert.ok(!u.box.hidden);
  assert.match(u.box.querySelector('.gm-rom-titel').textContent, /Rom zieht ein/);
  assert.match(u.box.querySelector('.gm-rom-zeit').textContent, /^1:00$/);
  assert.ok(u.box.querySelector('.gm-rom-aktionen').hidden, 'im Countdown noch keine Knoepfe');
  u.rom.presenz(null, u.uhr.jetzt);
  assert.ok(u.box.hidden, 'kommt kein Stand mehr mit, verschwindet das Event');
  u.rom.destroy();
});

await test('Phase 1: Pizza-Knopf bleibt dasselbe Element, auch ueber viele Takte', async () => {
  const u = umgebung();
  const ev = { id: 'rom-ui-2', start: u.uhr.jetzt - ROM.COUNTDOWN - 1000 };
  u.rom.presenz(sicht(ev), u.uhr.jetzt);
  await u.vor(300);
  assert.match(u.box.querySelector('.gm-rom-titel').textContent, /Rom verliert den Verstand/);
  const knopf = u.knopf('Zur nächsten Pizza');
  assert.ok(knopf);
  await u.vor(3000);
  assert.equal(u.knopf('Zur nächsten Pizza'), knopf, 'kein Neuaufbau zwischen Antippen und Loslassen');
  assert.equal(u.box.querySelector('.gm-rom-balken').hidden, false, 'Mamma-Mia-Leiste sichtbar');
  u.rom.destroy();
});

await test('Phase 2: erst zur Legion laufen, dann stellen - mit frisch gemeldetem Ort', async () => {
  const u = umgebung();
  const ev = { id: 'rom-ui-3', start: u.uhr.jetzt - ROM.COUNTDOWN - ROM.PHASEN[0].dauer - 1000 };
  u.welt.ort = { x: -60, z: 80 };
  u.rom.presenz(sicht(ev), u.uhr.jetzt);
  await u.vor(300);
  const hin = u.knopf('Zur Pizza-Legion');
  assert.ok(hin, 'weit weg: erst hinlaufen');
  hin.fire('click');
  assert.ok(u.welt.ziel, 'die Figur laeuft los');
  u.welt.ort = ROM.wagenOrt(ev, u.uhr.jetzt);
  await u.vor(300);
  const stellen = u.knopf('Legionär stellen');
  assert.ok(stellen);
  stellen.fire('click');
  assert.equal(u.anfragen.length, 0, 'ohne frische Meldung erst den Ort melden');
  assert.equal(u.sofort, 1);
  u.gemeldet = { ...u.welt.ort, t: Date.now() };
  await u.vor(300);
  assert.equal(u.anfragen.at(-1).art, 'gefecht', 'nach der Meldung geht der Kampf raus');
  u.rom.destroy();
});

await test('Phase 3: Tanzfolge ansehen, nachtippen, genau eine Anfrage je Runde', async () => {
  const u = umgebung();
  const ev = { id: 'rom-ui-4', start: u.uhr.jetzt - ROM.COUNTDOWN - ROM.PHASEN[0].dauer - ROM.PHASEN[1].dauer - 100 };
  u.rom.presenz(sicht(ev), u.uhr.jetzt);
  await u.vor(300);
  const tanz = u.box.querySelector('.gm-rom-tanz');
  assert.ok(!tanz.hidden);
  const tasten = tanz.querySelectorAll('.gm-rom-taste');
  assert.equal(tasten.length, 4);
  assert.ok(tasten.every((t) => t.disabled), 'waehrend des Vorzeigens gesperrt');
  const runde = ROM.tanzRunde(ev, u.uhr.jetzt), folge = ROM.tanzFolge(ev, runde);
  await u.vor(2600 + folge.length * 250);
  assert.ok(tasten.every((t) => !t.disabled), 'danach frei');
  for (const pose of folge) tanz.querySelectorAll('.gm-rom-taste')[pose].fire('click');
  const tanzAnfragen = u.anfragen.filter((a) => a.art === 'tanz');
  assert.equal(tanzAnfragen.length, 1);
  assert.deepEqual(Array.from(tanzAnfragen[0].folge), folge); assert.equal(tanzAnfragen[0].runde, runde);
  tanz.querySelectorAll('.gm-rom-taste')[0].fire('click');
  assert.equal(u.anfragen.filter((a) => a.art === 'tanz').length, 1, 'weiteres Tippen schickt nichts mehr');
  u.rom.destroy();
});

await test('Phase 4: Zuschlagen am Boss, Haltung und Rolle stehen dabei', async () => {
  const u = umgebung();
  const p = ROM.plan({ id: 'x', start: 0 });
  const ev = { id: 'rom-ui-5', start: u.uhr.jetzt - (p.phasen[3].von - 0) - 500 };
  u.welt.ort = ROM.bossOrt(ev, u.uhr.jetzt);
  u.setAntwort((op, d) => ({ serverTime: u.uhr.jetzt, rom: sicht(ev, { lire: 2, proPhase: [0, 0, 0, 2, 0], schlaege: 1 }, { boss: { hp: 4000, max: 5000, besiegt: false } }), ergebnis: { art: d.art, lire: 2, text: 'Treffer!' } }));
  u.rom.presenz(sicht(ev, {}, { boss: { hp: 5000, max: 5000, besiegt: false } }), u.uhr.jetzt);
  await u.vor(300);
  assert.match(u.box.querySelector('.gm-rom-haltung').textContent, /Deine Truppe passt/, 'die Start-Truppe hat jede Rolle');
  u.gemeldet = { ...u.welt.ort, t: Date.now() };
  u.knopf('Zuschlagen').fire('click');
  assert.equal(u.anfragen.at(-1).art, 'schlag', 'mit frisch gemeldetem Ort geht der Schlag sofort raus');
  await u.vor(100);
  assert.match(u.box.querySelector('.gm-rom-lire-zahl').textContent, /2 Lire/);
  assert.match(u.box.querySelector('.gm-rom-balken').textContent, /4000 \/ 5000/);
  u.rom.destroy();
});

await test('Phase 5 und Abschluss: Muenze, dann ehrliche Auskunft zur Belohnung', async () => {
  const u = umgebung();
  const p = ROM.plan({ id: 'x', start: 0 });
  const ev = { id: 'rom-ui-6', start: u.uhr.jetzt - p.phasen[4].von - 500 };
  u.rom.presenz(sicht(ev), u.uhr.jetzt);
  await u.vor(300);
  u.knopf('Münze in den Trevi werfen').fire('click');
  assert.equal(u.anfragen.at(-1).art, 'muenze');
  /* Zu wenig Lire: keine Gutschrift, auf die man warten muesste. */
  u.rom.presenz(sicht(ev, { lire: 5, proPhase: [0, 0, 0, 0, 5] }), u.uhr.jetzt);
  await u.vor(ROM.PHASEN[4].dauer + 5000);
  const ende = u.box.querySelector('.gm-rom-ende');
  assert.ok(!ende.hidden);
  assert.match(ende.textContent, /reicht es noch nicht/);
  assert.equal(u.anfragen.filter((a) => a.op === 'world').length, 0, 'kein Warten auf eine Abrechnung ohne Lohn');
  u.rom.destroy();
});

await test('Abschluss mit Lohn: Abrechnung wird geholt und danach aufgelistet', async () => {
  const u = umgebung();
  const p = ROM.plan({ id: 'x', start: 0 });
  const ev = { id: 'rom-ui-7', start: u.uhr.jetzt - p.ende - 4000 };
  u.setAntwort((op) => { if (op === 'world') u.st.value.rom.letztes = { ev: ev.id, t: 1, lire: 45, gold: 500, runen: { 3: 3 }, stufen: ['tourist', 'gladiator'], titel: [], ei: 'tasche', mozzarino: 'neu', leiste: false, boss: true, abgebrochen: false }; return { serverTime: u.uhr.jetzt }; });
  u.rom.presenz(sicht(ev, { lire: 45, proPhase: [20, 25, 0, 0, 0], schlaege: 6 }, { boss: { hp: 0, max: 5000, besiegt: true } }), u.uhr.jetzt);
  const ende = u.box.querySelector('.gm-rom-ende');
  assert.match(ende.textContent, /wird gerade gutgeschrieben/);
  assert.equal(u.anfragen.filter((a) => a.op === 'world').length, 1, 'der Browser holt die Abrechnung selbst');
  await u.vor(100);
  u.rom.apply({});
  await u.vor(300);
  assert.match(ende.textContent, /Rom-Ei, fertig ausgebrütet/);
  assert.match(ende.textContent, /Centurio Mozzarino \(Legendär\) ist jetzt in deiner Sammlung/);
  assert.match(ende.textContent, /500 Gold/);
  u.knopf('Schließen').fire('click');
  assert.ok(ende.hidden);
  await u.vor(60000);
  assert.ok(ende.hidden, 'geschlossen bleibt geschlossen');
  assert.equal(u.anfragen.filter((a) => a.op === 'world').length, 1, 'nach der Gutschrift keine weiteren Weltabfragen');
  u.rom.destroy();
});

await test('Ohne Musikdatei spielt die eingebaute Tarantella, zum Ende und beim Verlassen ist Ruhe', async () => {
  const u = umgebung();
  const ev = { id: 'rom-ui-8', start: u.uhr.jetzt - ROM.COUNTDOWN - 1000 };
  u.rom.presenz(sicht(ev), u.uhr.jetzt);
  await u.vor(2000);
  const zuerst = u.toene.length;
  assert.ok(zuerst > 3, 'die Ersatzmusik laeuft (' + zuerst + ' Toene)');
  u.rom.destroy();
  const danach = u.toene.length;
  await u.vor(3000);
  assert.equal(u.toene.length, danach, 'nach dem Verlassen kein Ton mehr');
  assert.equal(u.timers.size, 0, 'keine Zeitgeber bleiben liegen');
  assert.equal(u.root.children.length, 0, 'die Anzeige ist aus dem Spiel entfernt');
  const leise = umgebung({ tonAn: false });
  leise.rom.presenz(sicht({ id: 'rom-ui-9', start: leise.uhr.jetzt - ROM.COUNTDOWN - 1000 }), leise.uhr.jetzt);
  await leise.vor(2000);
  assert.equal(leise.toene.length, 0, 'Ton aus: keine Musik, aber alles andere laeuft');
  assert.ok(leise.knopf('Zur nächsten Pizza'));
  leise.rom.destroy();
});

console.log(count + ' Rom-Oberflaechentests bestanden.');
