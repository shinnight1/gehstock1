/* Die zehn neuen Faehigkeiten (27.09.2026): Jede tut, was ihr Text sagt - in
   Arena, Duell und Dungeon -, sie wachsen mit der Seltenheit, und keine faellt
   gegenueber den alten ihrer Rolle grob aus dem Rahmen. */
import assert from 'node:assert/strict';
import { data as D, economy as E, arena as A } from '../netlify/functions/lib/gehstockmon-rules.mjs';
import { _faehigkeitEinsetzen } from '../netlify/functions/lib/gehstockmon-dungeons.mjs';

let checks = 0;
function test(name, fn) { fn(); checks++; console.log('ok', name); }

/* Ein Kampf, in dem das erste Mon der eigenen Seite genau die gesuchte
   Faehigkeit traegt - der Traeger ist ein episches Mon seiner Rolle. */
const TRAEGER = ['runengolem', 'aschenhydra', 'waerter', 'kristallspinne'];
function index(id) { for (let r = 0; r < 4; r++) { const i = A.FAEHIGKEITEN[r].findIndex((f) => f.id === id); if (i >= 0) return { rolle: r, i }; } throw new Error(id); }
function kampf(id, gegner = ['bollwerk'], team = []) {
  const { rolle, i } = index(id);
  const s = A.create([D.mon(TRAEGER[rolle]), ...team.map(D.mon)], gegner.map(D.mon), { id: 't', now: 0 });
  s.teams[0][0].skill = i;
  return s;
}
const sonder = (s) => A.turn(s, { kind: 'move', move: 'special' });
const stock = (s) => A.turn(s, { kind: 'move', move: 'strike' });

test('Zehn neue Faehigkeiten, alle skaliert und mit Text aus ihren eigenen Werten', () => {
  const neu = A.FAEHIGKEITEN.flat().filter((f) => f.skaliert);
  assert.equal(neu.length, 10);
  for (const f of neu) {
    assert.equal(typeof f.text, 'function');
    assert.match(f.text(1), /\d/, f.id + ' nennt Zahlen');
  }
});

test('Erdstoss schiebt den Kraftschlag des Gegners hinaus', () => {
  const s = sonder(kampf('erdstoss'));
  assert.ok(s.teams[1][0].powerReady >= 3);
});

test('Vergeltung trifft umso haerter, je mehr KP fehlen', () => {
  const voll = kampf('vergeltung'), angeschlagen = kampf('vergeltung');
  angeschlagen.teams[0][0].hp = Math.round(angeschlagen.teams[0][0].maxHp * .2);
  const schaden = (s) => s.teams[1][0].hp - sonder(s).teams[1][0].hp;
  assert.ok(schaden(angeschlagen) > schaden(voll) * 1.8);
});

test('Sturmangriff kostet eigene KP, trifft haerter als der Stockhieb und toetet nie den Angreifer', () => {
  const a = kampf('sturmangriff'), b = kampf('sturmangriff');
  const nachSturm = sonder(a), nachStock = stock(b);
  assert.ok(a.teams[1][0].hp - nachSturm.teams[1][0].hp > b.teams[1][0].hp - nachStock.teams[1][0].hp);
  assert.ok(nachSturm.events.some((e) => e.kind === 'rueckstoss'));
  /* Der Gegner faellt am Sturmangriff selbst - so zaehlt nur der Rueckstoss. */
  const knapp = kampf('sturmangriff'); knapp.teams[0][0].hp = 2; knapp.teams[1][0].hp = 1;
  assert.equal(sonder(knapp).teams[0][0].hp, 1, 'der Rueckstoss laesst immer 1 KP');
});

test('Klingenwirbel laesst den Gegner in seinen naechsten Zuegen bluten', () => {
  let s = sonder(kampf('klingenwirbel', ['runengolem']));
  assert.equal(s.teams[1][0].blutung, 3 - (s.events.some((e) => e.kind === 'blutung') ? 1 : 0));
  s = stock(s);
  assert.ok(s.events.some((e) => e.kind === 'blutung'), 'die Blutung tickt');
});

test('Blutrausch gibt beim Niederstrecken Ladung und Heilung zurueck', () => {
  const s = kampf('blutrausch', ['bollwerk', 'moosling']);
  s.teams[1][0].hp = 1; s.teams[0][0].hp = Math.round(s.teams[0][0].maxHp * .5);
  const vorher = s.teams[0][0].charges, danach = sonder(s);
  assert.equal(danach.teams[0][0].charges, vorher, 'die Ladung kam zurueck');
  assert.ok(danach.teams[0][0].hp > s.teams[0][0].hp);
});

test('Regeneration heilt sofort und in den naechsten Zuegen, nur verletzt einsetzbar', () => {
  const s = kampf('regeneration');
  assert.equal(A.moves(s.teams[0][0], 1).find((m) => m.id === 'special').enabled, false, 'bei vollem Leben gesperrt');
  s.teams[0][0].hp = Math.round(s.teams[0][0].maxHp * .4);
  let t = sonder(s); const nachEinsatz = t.teams[0][0].hp;
  assert.ok(nachEinsatz > s.teams[0][0].hp);
  t = A.turn(t, { kind: 'move', move: 'guard' });
  assert.ok(t.events.some((e) => e.delta > 0 && e.target === 'wir0'), 'heilt im naechsten Zug weiter');
});

test('Heilkreis heilt auch ein verletztes Mon auf der Bank', () => {
  const s = kampf('heilkreis', ['bollwerk'], ['moosling']);
  s.teams[0][1].hp = Math.round(s.teams[0][1].maxHp * .5);
  const t = sonder(s);
  assert.ok(t.teams[0][1].hp > s.teams[0][1].hp);
});

test('Laehmstich sperrt Kraftschlag und Faehigkeit, auch fuer die KI', () => {
  const t = sonder(kampf('laehmstich', ['aschenhydra']));
  const gegner = t.teams[1][0];
  const zuege = A.moves(gegner, t.round);
  assert.equal(zuege.find((m) => m.id === 'power').enabled, false);
  assert.equal(zuege.find((m) => m.id === 'special').enabled, false);
  /* A.ai spielt immer Seite 1 - hier also genau den gelaehmten Gegner. */
  assert.ok(['strike', 'guard'].includes(A.ai(t)), 'die KI greift nicht zur gesperrten Faehigkeit');
  assert.ok(t.events.some((e) => /gelähmt und schlägt nur zu/.test(e.text)), 'wer es trotzdem versucht, schlaegt nur zu');
});

test('Zeitsprung laedt den Kraftschlag sofort wieder', () => {
  let s = A.turn(kampf('zeitsprung', ['runengolem']), { kind: 'move', move: 'power' });
  assert.ok(s.teams[0][0].powerReady > s.round);
  s = sonder(s);
  assert.ok(s.teams[0][0].powerReady <= s.round, 'gleich in der naechsten Runde bereit');
});

test('Runenraub nimmt dem Gegner eine Ladung und gibt sie dem Dieb', () => {
  const s = kampf('runenraub', ['runengolem']), vorher = [s.teams[0][0].charges, s.teams[1][0].charges];
  s.teams[1][0].plan = [['immer', 'strike'], ['aus', 'strike'], ['aus', 'strike']]; // der Gegner schlaegt nur zu
  const t = sonder(s);
  assert.equal(t.teams[1][0].charges, vorher[1] - 1);
  assert.equal(t.teams[0][0].charges, vorher[0], 'eingesetzt und zurueckgestohlen');
});

test('Die neuen wachsen mit der Seltenheit, die alten nicht', () => {
  const einheit = (monId, skill) => { const u = A.create([D.mon(monId)], [D.mon('bollwerk')], {}).teams[0][0]; u.skill = skill; return u; };
  const neu = index('sturmangriff').i, alt = index('aderlass').i;
  const gewoehnlich = einheit('glutfuchs', neu), apokalyptisch = einheit('nullwyrm', neu);
  assert.equal(A.skala(gewoehnlich), .85); assert.equal(A.skala(apokalyptisch), 1.15);
  assert.ok(A.faehigkeitFaktor(apokalyptisch) > A.faehigkeitFaktor(gewoehnlich));
  assert.notEqual(A.faehigkeitText(gewoehnlich), A.faehigkeitText(apokalyptisch), 'der Text zeigt die eigenen Werte');
  assert.equal(A.skala(einheit('nullwyrm', alt)), 1, 'alte bleiben, wie sie waren');
});

test('Im Dungeon wirkt jede neue Faehigkeit, ohne zu werfen', () => {
  for (const f of A.FAEHIGKEITEN.flat().filter((x) => x.skaliert)) {
    const { rolle, i } = index(f.id), mon = D.mon(TRAEGER[rolle]), st = A.stats(mon);
    const member = { id: 'm', name: 'Ich', monId: mon.id, role: rolle, skill: i, maxHp: st.hp, hp: Math.round(st.hp * .5), attack: st.ang, powerReady: 5, schild: 0 };
    const room = { round: 1, players: [member], boss: { name: 'Boss', role: 0, maxHp: 5000, hp: 5000, attack: 50 } };
    const log = [];
    _faehigkeitEinsetzen(room, member, log);
    const wirkt = room.boss.hp < 5000 || member.hp > Math.round(st.hp * .5) || room.boss.geschwaecht || room.boss.gelaehmt || member.geschaerft;
    assert.ok(wirkt, f.id + ' hat im Dungeon eine Wirkung');
    assert.ok(log.length, f.id + ' schreibt ins Protokoll');
  }
});

/* Grobe Balance-Wache. Die Feineinstellung stammt aus einer grossen Simulation
   (je Rolle 120 Aufstellungen, jede Paarung in beiden Richtungen: alle neuen
   lagen bei 46-54 %, im Bereich der alten). Hier nur so viele Kaempfe, dass
   eine Faehigkeit auffaellt, die nach einer Aenderung grob aus dem Rahmen
   faellt: unter 30 oder ueber 70 %. */
test('Keine neue Faehigkeit faellt gegenueber den alten ihrer Rolle grob aus dem Rahmen', () => {
  const zufall = E.zufallsfolge(0.137);
  const spiegeln = (s) => ({ ...s, teams: [s.teams[1], s.teams[0]], active: [s.active[1], s.active[0]] });
  function kaempfen(s) {
    for (let n = 0; n < 500 && s.phase !== 'finished'; n++) {
      if (s.phase === 'replace') s = A.turn(s, { kind: 'switch', slot: s.teams[0].findIndex((u) => u.hp > 0) });
      else {
        const zug = A.ai(spiegeln(s)), moeglich = A.moves(s.teams[0][s.active[0]], s.round).filter((m) => m.enabled);
        s = A.turn(s, { kind: 'move', move: moeglich.some((m) => m.id === zug) ? zug : moeglich[0].id });
      }
    }
    return s.winner === 'wir' ? 1 : s.winner === 'sie' ? 0 : .5;
  }
  const pool = D.KATALOG.filter((k) => k.seltenheit >= 2 && k.seltenheit <= 4);
  for (let rolle = 0; rolle < 4; rolle++) {
    const liste = A.FAEHIGKEITEN[rolle], punkte = liste.map(() => 0), spiele = liste.map(() => 0);
    for (let n = 0; n < 8; n++) {
      const team = [];
      while (team.length < 3) { const k = pool[Math.floor(zufall() * pool.length)]; if (k.id !== TRAEGER[rolle] && !team.includes(k)) team.push(k); }
      const stelle = Math.floor(zufall() * 4); team.splice(stelle, 0, D.mon(TRAEGER[rolle]));
      for (let a = 0; a < liste.length; a++) for (let b = 0; b < liste.length; b++) {
        if (a === b) continue;
        const s = A.create(team, team, { id: 'b', now: 0 });
        s.teams[0][stelle].skill = a; s.teams[1][stelle].skill = b;
        const erg = kaempfen(s); punkte[a] += erg; spiele[a]++; punkte[b] += 1 - erg; spiele[b]++;
      }
    }
    liste.forEach((f, i) => {
      if (!f.skaliert) return;
      const quote = punkte[i] / spiele[i];
      assert.ok(quote > .3 && quote < .7, f.id + ' gewinnt ' + Math.round(quote * 100) + ' % gegen die anderen seiner Rolle');
    });
  }
});

console.log(checks + ' Attacken-Pruefungen bestanden.');
