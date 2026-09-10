/* Regel-Engines ohne Browser testen: node tools/test.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { extraTests } from './extra-tests.mjs';

globalThis.window = globalThis;
globalThis.SG_BUILD = { offline: true, version: 'test' };
const stub = () => ({
  style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {} },
  getContext: () => null, appendChild() {}, removeChild() {}, setAttribute() {},
  addEventListener() {}, removeEventListener() {}, focus() {}, select() {},
});
globalThis.document = {
  createElement: stub, createTextNode: stub, addEventListener() {},
  removeEventListener() {}, readyState: 'complete', getElementById: () => null,
  head: { appendChild() {} }, body: stub(), hidden: false,
};
globalThis.requestAnimationFrame = (f) => setTimeout(() => f(Date.now()), 0);
globalThis.cancelAnimationFrame = clearTimeout;
Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'node', maxTouchPoints: 0 }, configurable: true });
Object.defineProperty(globalThis, 'performance', { value: { now: () => Date.now() }, configurable: true });
Object.defineProperty(globalThis, 'location', { value: { protocol: 'http:', hash: '', search: '' }, configurable: true });

const bundleDir = path.resolve('dist/assets');
const file = fs.readdirSync(bundleDir).find((f) => f.endsWith('.js'));
eval(fs.readFileSync(path.join(bundleDir, file), 'utf8'));

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ok   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '  -> ' + e.message); }
}
globalThis.test = test;

const U = SG.util;
console.log('\nRegel-Engines');

/* --- Vier gewinnt --- */
const C4 = SG.rules.connect4;
test('Vier gewinnt: senkrechter Sieg', () => {
  const g = C4.create(7, 6);
  [0, 1, 0, 1, 0, 1, 0].forEach((c) => C4.drop(g, c));
  if (g.winner !== 1) throw new Error('kein Sieg erkannt');
});
test('Vier gewinnt: KI blockt', () => {
  const g = C4.create(7, 6);
  [0, 6, 1, 6, 2].forEach((c) => C4.drop(g, c));
  const mv = C4.bestMove(g, 4, 2, U.rng(2));
  if (mv !== 3) throw new Error('spielte ' + mv);
});

/* --- Doppelkopf --- */
const DK = SG.rules.doppelkopf;
test('Doppelkopf: 48 Karten, 240 Augen', () => {
  const d = DK.deck();
  if (d.length !== 48) throw new Error(d.length + ' Karten');
  const sum = d.reduce((a, c) => a + DK.VALUE[c.r], 0);
  if (sum !== 240) throw new Error(sum + ' Augen');
});
test('Doppelkopf: Trumpfordnung', () => {
  const h10 = { s: 'h', r: 'T' }, cd = { s: 'c', r: 'D' }, cb = { s: 'c', r: 'B' }, da = { s: 'd', r: 'A' };
  if (!(DK.trumpRank(h10, 'normal') > DK.trumpRank(cd, 'normal'))) throw new Error('Dulle');
  if (!(DK.trumpRank(cd, 'normal') > DK.trumpRank(cb, 'normal'))) throw new Error('Dame/Bube');
  if (!(DK.trumpRank(cb, 'normal') > DK.trumpRank(da, 'normal'))) throw new Error('Bube/Karo-Ass');
  if (DK.isTrump({ s: 'h', r: 'A' }, 'normal')) throw new Error('Herz-Ass');
});
test('Doppelkopf: 200 Runden laufen sauber durch', () => {
  for (let i = 0; i < 200; i++) {
    const g = DK.newRound(50000 + i, i % 4);
    DK.assignParties(g);
    g.phase = 'spiel';
    g.turn = (g.dealer + 1) % 4;
    let guard = 0;
    while (g.phase === 'spiel' && guard++ < 60) {
      const rng = U.rng((g.seed + guard * 31) >>> 0);
      const card = DK.aiCard(g, g.turn, rng);
      if (!card) throw new Error('keine Karte in Runde ' + i);
      if (!DK.play(g, g.turn, card)) throw new Error('unerlaubter Zug in Runde ' + i);
    }
    if (g.phase !== 'ende') throw new Error('Runde ' + i + ' endet nicht');
    const sum = g.points.reduce((a, b) => a + b, 0);
    if (sum !== 240) throw new Error('Runde ' + i + ': ' + sum + ' Augen');
  }
});
test('Doppelkopf: Abrechnung', () => {
  const a = DK.settle({ rePoints: 130, kontraPoints: 110, reTricks: 7, kontraTricks: 5,
    reAnn: false, kontraAnn: false, reLevel: 0, kontraLevel: 0, solo: false, extras: {} });
  if (a.winner !== 're' || a.value !== 1) throw new Error('einfacher Sieg');
  const b = DK.settle({ rePoints: 120, kontraPoints: 120, reTricks: 6, kontraTricks: 6,
    reAnn: false, kontraAnn: false, reLevel: 0, kontraLevel: 0, solo: false, extras: {} });
  if (b.winner !== 'kontra') throw new Error('120:120');
  const c = DK.settle({ rePoints: 145, kontraPoints: 95, reTricks: 8, kontraTricks: 4,
    reAnn: true, kontraAnn: false, reLevel: 1, kontraLevel: 0, solo: false, extras: {} });
  if (c.winner !== 'kontra') throw new Error('verfehlte Ansage');
});

/* --- Sudoku --- */
const SU = SG.rules.sudoku;
test('Sudoku: Rätsel eindeutig lösbar', () => {
  const rng = U.rng(4242);
  const it = SU.generateSteps(rng, 34);
  let r; do { r = it.next(); } while (!r.done);
  if (SU.count(r.value.puzzle, 2) !== 1) throw new Error('nicht eindeutig');
});

/* --- Nonogramm --- */
const NO = SG.rules.nonogram;
test('Nonogramm: rein logisch lösbar', () => {
  const p = (() => { const it = NO.generateSteps(U.rng(77), 10, 10, 0.55); let r; do { r = it.next(); } while (!r.done); return r.value; })();
  if (!p) throw new Error('kein Rätsel');
  if (!NO.logicSolve(p.rowClues, p.colClues, p.w, p.h)) throw new Error('nicht lösbar');
});

/* --- Labyrinth --- */
const MZ = SG.rules.maze;
test('Labyrinth: vollständig begehbar', () => {
  for (let i = 0; i < 10; i++) {
    const m = MZ.build(U.rng(900 + i));
    let open = 0, first = null;
    for (let y = 0; y < m.grid.length; y++) {
      for (let x = 0; x < m.grid[y].length; x++) {
        if (m.grid[y][x] === 0) { open++; if (!first) first = [x, y]; }
      }
    }
    if (MZ.reachable(m.grid, first[0], first[1]).count !== open) throw new Error('zerfällt bei Seed ' + i);
  }
});

/* --- Wörter --- */
test('Wörtle: Listen sauber', () => {
  const s = SG.words.stats();
  if (s.loesung5 < 300) throw new Error('zu wenige 5er');
  SG.words.loesung5.forEach((w) => { if (w.length !== 5) throw new Error(w); });
  SG.words.loesung6.forEach((w) => { if (w.length !== 6) throw new Error(w); });
  const sc = SG.rules.woertle.score('AAAAA', 'ABEND');
  if (sc[0] !== 2 || sc[1] !== 0) throw new Error('Doppelbuchstaben');
});

extraTests(SG, U, test);

console.log('\n' + pass + ' bestanden, ' + fail + ' durchgefallen\n');
process.exit(fail ? 1 : 0);
