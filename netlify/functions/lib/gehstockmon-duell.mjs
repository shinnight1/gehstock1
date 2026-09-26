/* ------------------------------------------------------------------
   Das Live-Duell, Serverseite. Die Kampfregeln stehen in
   src/games/gehstockmon/2-duell.js; hier stehen Einladung, Zuege,
   Zeitablauf, Aufgabe, Belohnung und was jede Seite sehen darf.

   Ein Duell liegt in world.duelle, beide Spieler zeigen mit duellId
   darauf. Der Zug des Gegners bleibt verborgen, bis die Runde gerechnet
   ist - sonst liesse sich einfach abwarten und kontern.
   ------------------------------------------------------------------ */
import { data as D, arena as A, adventure as X } from './gehstockmon-rules.mjs';
import { anwesende } from './gehstockmon-anwesenheit.mjs';
import { tickern } from './gehstockmon-alltag.mjs';

const fail = (message) => { throw new Error(message); };
const kaempft = (p) => (p.arena && p.arena.phase !== 'finished') || (p.duel && ['choose', 'won'].includes(p.duel.phase));

export function aktivesDuell(world, p, id) {
  const d = p && world.duelle && world.duelle[p.duellId];
  return d && (d.phase === 'einladung' || d.phase === 'kampf') && (d.a === id || d.b === id) ? d : null;
}
export function imDuellKampf(world, p, id) { const d = aktivesDuell(world, p, id); return !!d && d.phase === 'kampf'; }

function beenden(world, d, sieger, grund, now) {
  d.phase = 'ende'; d.grund = grund; d.endeAm = now; d.sieger = sieger;
  if (d.belohnt || !d.kampf) return;
  d.belohnt = true;
  const pa = world.players[d.a], pb = world.players[d.b], L = X.DUELL.lohn;
  if (sieger === 'patt') {
    for (const p of [pa, pb]) if (p) p.gold += L.patt;
    tickern(world, '⚔️ Live-Duell: ' + d.namen[0] + ' und ' + d.namen[1] + ' trennen sich unentschieden', 'duell', now);
  } else {
    const gewinner = sieger === 0 ? pa : pb, verlierer = sieger === 0 ? pb : pa;
    if (gewinner) { gewinner.gold += L.sieg; gewinner.arenaRuhm = X.ruhm(gewinner) + X.DUELL.ruhm; gewinner.duellSiege = (gewinner.duellSiege || 0) + 1; }
    if (verlierer) verlierer.gold += L.trost;
    tickern(world, '⚔️ Live-Duell: ' + d.namen[sieger] + ' besiegt ' + d.namen[1 - sieger] + (grund === 'aufgabe' ? ' (Aufgabe)' : grund === 'zeit' ? ' (Zeit)' : ''), 'duell', now);
  }
  for (const [p, pid] of [[pa, d.a], [pb, d.b]]) if (p) X.alltagSchritt(p, 'duell', now);
}

function rundeRechnen(world, d, now, zeitUm) {
  const s = d.kampf;
  if (zeitUm) [0, 1].forEach((seite) => { if (s.warten[seite]) s.verpasst[seite] = s.aktionen[seite] ? 0 : s.verpasst[seite] + 1; });
  const raus = [0, 1].filter((seite) => s.verpasst[seite] >= X.DUELL.verpasstMax);
  if (raus.length) { beenden(world, d, raus.length === 2 ? 'patt' : 1 - raus[0], 'zeit', now); return; }
  const neu = A.duellRunde(s, s.aktionen);
  neu.verpasst = s.verpasst.slice(); neu.deadline = now + X.DUELL.runde;
  d.kampf = neu;
  if (neu.phase === 'ende') beenden(world, d, neu.winner, 'ko', now);
}

/* Bei jeder Anfrage: abgelaufene Einladungen schliessen, verstrichene
   Runden rechnen, alte Duelle wegraeumen. */
export function duelleAbrechnen(world, now) {
  if (!world.duelle) return;
  for (const [key, d] of Object.entries(world.duelle)) {
    if (d.phase === 'einladung' && now >= d.einladungBis) { d.phase = 'ende'; d.grund = 'abgelaufen'; d.endeAm = now; }
    else if (d.phase === 'kampf' && now >= d.kampf.deadline) rundeRechnen(world, d, now, true);
    if (d.phase === 'ende' && now - d.endeAm > X.DUELL.nachlauf) delete world.duelle[key];
  }
}

export async function duellAction({ world, p, id, body, now, presence }) {
  const op = body.op, extra = {};
  world.duelle = world.duelle || {};
  if (op === 'duell_fordern') {
    const ziel = world.players[body.targetId];
    if (!ziel || body.targetId === id) fail('Wähle einen anderen Spieler.');
    if (aktivesDuell(world, p, id)) fail('Du stehst schon in einem Duell.');
    if (aktivesDuell(world, ziel, body.targetId)) fail(ziel.name + ' steht gerade in einem anderen Duell.');
    if (kaempft(ziel)) fail(ziel.name + ' kämpft gerade.');
    if (!Array.isArray(p.truppe) || p.truppe.length !== 4 || !Array.isArray(ziel.truppe) || ziel.truppe.length !== 4) fail('Für ein Duell braucht jede Seite ein Kampfteam aus vier Mons.');
    const da = (await anwesende(presence))[body.targetId];
    if (!da || now - da.updatedAt >= 15000) fail(ziel.name + ' ist gerade nicht auf der Insel.');
    const duellId = id.slice(0, 8) + '-' + body.requestId;
    world.duelle[duellId] = { id: duellId, a: id, b: body.targetId, namen: [p.name, ziel.name], phase: 'einladung', erstellt: now, einladungBis: now + X.DUELL.einladung };
    p.duellId = duellId; ziel.duellId = duellId;
    extra.message = ziel.name + ' wurde zum Live-Duell gefordert. Warte auf die Antwort …';
    return extra;
  }
  const d = world.duelle[body.duellId], seite = d ? (d.a === id ? 0 : d.b === id ? 1 : -1) : -1;
  if (!d || seite < 0) fail('Dieses Duell gibt es nicht mehr.');
  if (op === 'duell_antwort') {
    if (d.phase !== 'einladung' || seite !== 1) fail('Diese Herausforderung gibt es nicht mehr.');
    if (body.annehmen !== true) { d.phase = 'ende'; d.grund = 'abgelehnt'; d.endeAm = now; extra.message = 'Herausforderung abgelehnt.'; return extra; }
    const pa = world.players[d.a];
    if (!pa || kaempft(pa) || kaempft(p)) fail('Einer von euch kämpft gerade. Versucht es gleich noch einmal.');
    d.kampf = A.duellStart(pa.truppe.map((mid) => X.mon(pa, mid)), p.truppe.map((mid) => X.mon(p, mid)), now);
    d.kampf.deadline = now + X.DUELL.runde; d.phase = 'kampf';
    extra.message = 'Das Duell gegen ' + d.namen[0] + ' beginnt!';
    return extra;
  }
  if (op === 'duell_zug') {
    if (d.phase !== 'kampf') fail('Dieses Duell läuft nicht mehr.');
    const s = d.kampf;
    if (body.revision !== s.revision) fail('Die Runde hat sich verändert. Rufe den aktuellen Stand ab.');
    if (!s.warten[seite]) fail('Warte, bis dein Gegner sein nächstes Mon geschickt hat.');
    if (s.aktionen[seite]) fail('Dein Zug für diese Runde steht schon.');
    const a = body.aktion;
    if (!A.duellGueltig(s, seite, a)) fail('Dieser Zug geht gerade nicht.');
    s.aktionen[seite] = a.kind === 'move' ? { kind: 'move', move: a.move } : { kind: 'switch', slot: a.slot };
    s.verpasst[seite] = 0;
    if ([0, 1].every((x) => !s.warten[x] || s.aktionen[x])) rundeRechnen(world, d, now, false);
    return extra;
  }
  if (op === 'duell_aufgeben') {
    if (d.phase === 'ende') fail('Dieses Duell ist schon vorbei.');
    if (d.phase === 'einladung') { d.phase = 'ende'; d.grund = seite === 0 ? 'zurueckgezogen' : 'abgelehnt'; d.endeAm = now; extra.message = 'Duell abgesagt.'; }
    else { beenden(world, d, 1 - seite, 'aufgabe', now); extra.message = 'Du hast aufgegeben.'; }
    return extra;
  }
  return extra;
}

/* Ein Duell aus der Sicht einer Seite: die eigene Truppe immer vorn. */
function sicht(d, seite, zuschauer) {
  const v = { id: d.id, phase: d.phase, zuschauer: !!zuschauer, namen: seite ? [d.namen[1], d.namen[0]] : d.namen.slice(),
    einladungBis: d.einladungBis, grund: d.grund || null, endeAm: d.endeAm || null,
    eingeladen: !zuschauer && d.phase === 'einladung' && seite === 1, wartetAufAntwort: !zuschauer && d.phase === 'einladung' && seite === 0 };
  if (d.phase === 'ende' && d.sieger !== undefined) v.ergebnis = d.sieger === 'patt' ? 'patt' : d.sieger === seite ? 'sieg' : 'niederlage';
  if (d.kampf) {
    const s = d.kampf, o = seite ? [1, 0] : [0, 1];
    v.kampf = { teams: o.map((i) => s.teams[i]), active: o.map((i) => s.active[i]), round: s.round, revision: s.revision, deadline: s.deadline,
      warten: o.map((i) => s.warten[i]), gewaehlt: o.map((i) => !!s.aktionen[i]), verpasst: o.map((i) => s.verpasst[i]),
      events: (s.events || []).map((e) => ({ ...e, state: e.state ? o.map((i) => e.state[i]) : e.state, active: e.active ? o.map((i) => e.active[i]) : e.active })),
      verlauf: (s.verlauf || []).slice(-10) };
  }
  return v;
}
export function duellSicht(world, p, id, zuschauId) {
  const d = world.duelle && world.duelle[p.duellId];
  const eigenes = d && (d.a === id || d.b === id) ? sicht(d, d.a === id ? 0 : 1, false) : null;
  const laufend = Object.values(world.duelle || {}).filter((x) => x.phase === 'kampf' && x.a !== id && x.b !== id)
    .map((x) => ({ id: x.id, namen: x.namen, runde: x.kampf.round }));
  const z = zuschauId && world.duelle && world.duelle[zuschauId];
  return { duell: eigenes, duelleLaufend: laufend, zuschauDuell: z && z.a !== id && z.b !== id ? sicht(z, 0, true) : null };
}
/* Fuer die Anwesenheit: eine offene Einladung, die schnell ankommen muss. */
export function duellEinladung(world, p, id, now) {
  const d = world.duelle && world.duelle[p && p.duellId];
  return d && d.phase === 'einladung' && d.b === id && now < d.einladungBis ? { id: d.id, von: d.namen[0], bis: d.einladungBis } : null;
}
