/* ------------------------------------------------------------------
   Rom-Event "ROMA È FINITA" auf dem Server

   Zeitplan, Wege und Belohnungsstufen stehen in den gemeinsamen Regeln
   (src/games/gehstockmon/2-rom.js, hier als X.ROM). Diese Datei haelt,
   was nur der Server wissen und entscheiden darf:

   1. Wer steuern darf. Starten und abbrechen kann nur der aktuelle CEO.
      Geprueft wird bei jeder Steueraktion neu gegen die Verwaltung auf dem
      Relais (Eintrag owner) - ein CEO-Wechsel wirkt damit sofort. Weil
      die Zugangscodes dort im Moment fuer jeden lesbar sind, braucht der
      echte Start zusaetzlich die Event-PIN. Deren Hash liegt nur auf dem
      Handy (~/.config/gehstock1/rom.env, gesetzt mit tools/rom-pin.mjs).

   2. Wo das Event steht. Ein kleines Dokument 'rom-event' mit den letzten
      Events, per Vergleich geschrieben: zehn gleichzeitige Starts ergeben
      genau ein Event.

   3. Was jeder beigetragen hat. Jeder Spieler hat ein eigenes Feld im
      Redis-Hash 'rom-b:<event>', wie bei der Anwesenheit. Eine Aktion
      liest und schreibt nur dieses Feld und kommt niemandem in die Quere;
      das grosse Weltdokument wird waehrend des Events nicht angefasst.
      Leiste und Lebenskraft des Bosses sind Summen ueber alle Felder.
      Speicher ohne Felder (Testzone, Tests) nehmen ein Dokument.

   4. Die Abrechnung. Genau einmal je Event, im Weltdokument, mit einem
      Merker im selben Schreibvorgang (world.rom.abgerechnet). Mehrere Tabs,
      wiederholte Anfragen und Neustarts zahlen darum nie doppelt.
   ------------------------------------------------------------------ */
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { data as D, economy as E, adventure as X, arena as A, hours as H } from './gehstockmon-rules.mjs';
import { anwesende } from './gehstockmon-anwesenheit.mjs';
import { tickern } from './gehstockmon-alltag.mjs';
import { activeArena, activeDuel, trainerTruppe, TRAINER_EINSTIEG } from './gehstockmon-adventure.mjs';
import { activeDungeon } from './gehstockmon-dungeons.mjs';
import { imDuellKampf } from './gehstockmon-duell.mjs';

const ROM = X.ROM, P = ROM.P;
export const DOKUMENT = 'rom-event';
const beitragSchluessel = (evId) => 'rom-b:' + evId;

export class RomFehler extends Error {
  constructor(text, status = 400) { super(text); this.status = status; this.romFehler = true; }
}
function fail(text, status) { throw new RomFehler(text, status); }
const clone = (v) => JSON.parse(JSON.stringify(v));
const pause = (n) => new Promise((ok) => setTimeout(ok, 10 + Math.random() * 30 * (n + 1)));
const uhrzeit = (t) => new Intl.DateTimeFormat('de-DE', { timeZone: H.ZONE, hour: '2-digit', minute: '2-digit' }).format(new Date(t));

/* ------------------------------------------------------------------ PIN */

export function pinVerschluesseln(pin, salz = randomBytes(16)) {
  const text = String(pin == null ? '' : pin);
  if (!/^\d{4,12}$/.test(text)) throw new Error('Die PIN braucht 4 bis 12 Ziffern.');
  return 'scrypt$' + salz.toString('hex') + '$' + scryptSync(text, salz, 32).toString('hex');
}
export function pinStimmt(pin, gespeichert) {
  const teile = String(gespeichert || '').split('$');
  if (teile.length !== 3 || teile[0] !== 'scrypt' || !teile[1] || !teile[2]) return false;
  const soll = Buffer.from(teile[2], 'hex');
  const ist = scryptSync(String(pin == null ? '' : pin).slice(0, 40), Buffer.from(teile[1], 'hex'), 32);
  return soll.length === ist.length && timingSafeEqual(soll, ist);
}

/* ---------------------------------------------------------- Leitung */

const normieren = (c) => String(c || '').replace(/\D/g, '').slice(0, 4);
/* Der CEO steht in der Verwaltung auf dem Relais - dieselbe Stelle, aus
   der auch jeder Browser liest. Immer frisch gelesen, nie zwischengespeichert. */
async function ceoCode(ctx) {
  const v = await ctx.verwaltung.get('verwaltung', { type: 'json' });
  const owner = normieren(v && v.daten && v.daten.owner);
  return owner.length === 4 ? owner : '';
}

/* --------------------------------------------------------- Dokument */

function dokSauber(d) {
  const x = d && typeof d === 'object' ? d : {};
  return { events: Array.isArray(x.events) ? x.events.filter((e) => e && typeof e.id === 'string').slice(-5) : [],
    wochen: x.wochen && typeof x.wochen === 'object' ? x.wochen : {},
    pin: { fehler: Math.max(0, Math.floor(Number(x.pin && x.pin.fehler) || 0)), bis: Number(x.pin && x.pin.bis) || 0 },
    log: Array.isArray(x.log) ? x.log.slice(-40) : [] };
}
const aktuell = (dok) => dok.events[dok.events.length - 1] || null;
async function dokLesen(db) {
  const e = await db.getWithMetadata(DOKUMENT, { type: 'json', consistency: 'strong' });
  return { dok: dokSauber(e && e.data), etag: e ? e.etag : null };
}
/* fn bekommt das Dokument und antwortet mit { schreiben, ... }. */
async function dokAendern(db, fn) {
  for (let versuch = 0; versuch < 8; versuch++) {
    const { dok, etag } = await dokLesen(db);
    const antwort = fn(dok) || {};
    if (!antwort.schreiben) return antwort;
    const w = await db.setJSON(DOKUMENT, dok, etag ? { onlyIfMatch: etag } : { onlyIfNew: true });
    if (w.modified) { merker.delete(db); return antwort; }
    await pause(versuch);
  }
  fail('Das Event wird gerade verändert. Bitte gleich noch einmal.', 409);
}

/* --------------------------------------------------------- Beitraege */

const mitFeldern = (db) => !!db && typeof db.felder === 'function';
function beitragSauber(b) {
  const x = b && typeof b === 'object' ? clone(b) : {};
  const leer = ROM.leer();
  x.lire = ROM.PHASEN.map((ph, i) => Math.max(0, Math.floor(Number(x.lire && x.lire[i]) || 0)));
  for (const k of ['stern', 'schlaege', 'schaden', 'hp', 'kaeseGold']) x[k] = Math.max(0, Math.floor(Number(x[k]) || leer[k] || 0));
  x.eier = Array.isArray(x.eier) ? [...new Set(x.eier.map(Number).filter((k) => Number.isInteger(k) && k >= 0 && k < ROM.EIER.anzahl))] : [];
  return x;
}
async function alleBeitraege(db, evId) {
  if (mitFeldern(db)) return (await db.felder(beitragSchluessel(evId))) || {};
  const e = await db.getWithMetadata(beitragSchluessel(evId), { type: 'json', consistency: 'strong' });
  return (e && e.data) || {};
}
/* fn bekommt den eigenen Beitrag und gibt den neuen zurueck - oder null,
   wenn nichts zu schreiben ist (etwa eine schon bekannte Aktion). */
async function beitragAendern(db, evId, pid, fn) {
  const key = beitragSchluessel(evId);
  if (mitFeldern(db)) {
    for (let versuch = 0; versuch < 8; versuch++) {
      const gelesen = await db.feld(key, pid), alt = beitragSauber(gelesen);
      const neu = fn(clone(alt));
      if (!neu) return alt;
      const w = await db.feldSetzen(key, pid, neu, { onlyIfValue: gelesen });
      if (w.modified) return neu;
      await pause(versuch);
    }
    fail('Auf der Piazza ist gerade zu viel los. Bitte gleich noch einmal.', 409);
  }
  for (let versuch = 0; versuch < 8; versuch++) {
    const e = await db.getWithMetadata(key, { type: 'json', consistency: 'strong' });
    const alle = e ? clone(e.data) : {};
    const alt = beitragSauber(alle[pid]);
    const neu = fn(clone(alt));
    if (!neu) return alt;
    alle[pid] = neu;
    const w = await db.setJSON(key, alle, e ? { onlyIfMatch: e.etag } : { onlyIfNew: true });
    if (w.modified) return neu;
    await pause(versuch);
  }
  fail('Auf der Piazza ist gerade zu viel los. Bitte gleich noch einmal.', 409);
}

/* Ein kurzes Gedaechtnis wie bei der Anwesenheit: die Positionsmeldung
   aller Spieler fragt den Stand ab, gelesen wird er hoechstens einmal je
   Sekunde (ohne laufendes Event alle drei). */
const merker = new WeakMap();
function sichtbar(ev, now) {
  if (!ev) return false;
  if (ROM.nieGelaufen(ev)) return now - ROM.ende(ev) < 30000;
  return now - ROM.ende(ev) < ROM.NACHLAUF;
}
async function stand(ctx, now, frisch = false) {
  const m = merker.get(ctx.db);
  if (!frisch && m && now >= m.at && now - m.at < (m.ev && sichtbar(m.ev, now) ? 1000 : 3000)) return m;
  const { dok } = await dokLesen(ctx.db);
  const ev = aktuell(dok);
  const alle = ev && sichtbar(ev, now) ? await alleBeitraege(ctx.db, ev.id) : {};
  const neu = { at: now, dok, ev, alle };
  merker.set(ctx.db, neu);
  return neu;
}
function merkerNachtragen(db, evId, pid, beitrag) {
  const m = merker.get(db);
  if (m && m.ev && m.ev.id === evId) m.alle = { ...m.alle, [pid]: beitrag };
}

/* ---------------------------------------------------------- Sichten */

function eigenSicht(b, ev, now) {
  const x = beitragSauber(b);
  return { lire: ROM.lire(x), proPhase: x.lire, stern: x.stern, schlaege: x.schlaege, schaden: x.schaden,
    vorrat: ROM.vorrat(x, ev, now), zutaten: (x.zutaten || []).slice(-40), tanz: (x.tanz || []).slice(-20),
    gefechte: x.gefechte || { s: 0, n: 0 }, muenze: !!x.muenze, fang: x.fang || {},
    tPolonaise: x.tPolonaise || 0, tGefecht: x.tGefecht || 0, tStern: x.tStern || 0, tZutat: x.tZutat || 0,
    schlagStand: Number.isFinite(x.schlagStand) ? x.schlagStand : null, kaeseGold: x.kaeseGold, tKaese: x.tKaese || 0, eier: x.eier };
}
function sicht(ev, alle, id, now) {
  if (!ev || !sichtbar(ev, now)) return null;
  const lage = ROM.lage(alle, ev);
  return { id: ev.id, start: ev.start, faktor: ROM.faktor(ev), abgebrochenAm: ev.abgebrochenAm || null,
    von: (ev.von && ev.von.name) || 'CEO', vorschau: !!ev.vorschau, ueberraschungen: ev.ueberraschungen || {},
    bossBesiegtAm: Number.isFinite(ev.bossBesiegtAm) ? ev.bossBesiegtAm : null,
    teilnehmer: lage.teilnehmer, leiste: { wert: lage.leiste, ziel: lage.leisteZiel, voll: lage.leisteVoll },
    boss: { hp: lage.bossHp, max: lage.bossMax, besiegt: lage.bossBesiegt }, ich: eigenSicht(alle[id], ev, now), serverTime: now };
}
/* Fuer die Positionsmeldung: Fehler beim Lesen duerfen sie nie aufhalten. */
export async function romPresenz(ctx, id, now) {
  try { const s = await stand(ctx, now); return sicht(s.ev, s.alle, id, now); } catch { return null; }
}

/* ------------------------------------------------------ Schnellkampf */

const LEGIONAERE = ['Legionär Peperoni', 'Centurio Quattro Formaggi', 'Optio Funghi', 'Tribun Tonno'];
const spiegeln = (s) => ({ ...s, teams: [s.teams[1], s.teams[0]], active: [s.active[1], s.active[0]] });
/* Die eigene Truppe kaempft nach dem eigenen Kampfplan gegen Legionaere,
   die sich wie die Wandertrainer an ihre Staerke anpassen - etwas darunter.
   Einsteiger bekommen den Einsteiger-Gegner. Der ganze Kampf laeuft in
   einem Zug durch; der Browser spielt ihn nur ab. */
export function schnellkampf(p, zufall) {
  const wir = p.truppe.map((mid) => {
    const m = X.mon(p, mid);
    return A.ausSpeicher({ id: mid, upgrade: m && m.upgrade, wesen: m && m.wesenId, plan: A.eigenerPlan(p.plaene && p.plaene[mid]) });
  });
  const einsteiger = ((p.progress && p.progress.trainerWins) || 0) < TRAINER_EINSTIEG;
  const sie = einsteiger ? [D.mon('blattschleicher')] : trainerTruppe(p, 0.9, zufall);
  let s = A.create(wir, sie, { id: 'rom', now: 0 });
  s.teams[1].forEach((u, i) => { u.name = LEGIONAERE[i % LEGIONAERE.length]; });
  for (let n = 0; n < 240 && s.phase !== 'finished'; n++) {
    if (s.phase === 'replace') { s = A.turn(s, { kind: 'switch', slot: s.teams[0].findIndex((u) => u.hp > 0) }); continue; }
    const zug = A.ai(spiegeln(s)), moeglich = A.moves(s.teams[0][s.active[0]], s.round).filter((m) => m.enabled);
    s = A.turn(s, { kind: 'move', move: moeglich.some((m) => m.id === zug) ? zug : moeglich[0].id });
  }
  return { sieg: s.winner === 'wir', runden: s.round, verlauf: (s.verlauf || []).slice(-40),
    wir: s.teams[0].map((u) => ({ name: u.name, monId: u.monId })), sie: s.teams[1].map((u) => ({ name: u.name, monId: u.monId })) };
}

/* ---------------------------------------------------------- Aktionen */

const ORTSAKTIONEN = ['zutat', 'gefecht', 'polonaise', 'schlag'];
async function position(ctx, world, id, now) {
  const v = (await anwesende(ctx.presence))[id];
  if (!v || now - v.updatedAt >= 15000 || v.spawnAt !== world.players[id].lastJoinAt) fail('Die Kartenposition ist nicht aktuell. Warte kurz auf die Verbindung.', 409);
  return v;
}
/* Lire in die laufende Phase - gedeckelt je Phase und insgesamt. */
function lireGeben(b, nr, n) {
  const frei = Math.min(ROM.PHASEN[nr].lire - (b.lire[nr] || 0), ROM.LIRE_MAX - ROM.lire(b));
  const plus = Math.max(0, Math.min(Math.floor(n), frei));
  b.lire[nr] += plus;
  return plus;
}
const abstand = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const sekunden = (ms) => Math.max(1, Math.ceil(ms / 1000));
const ZUTATEN = ['🍅 Tomate', '🧀 Mozzarella', '🌿 Basilikum', '🍄 Pilz', '🫒 Olive', '🥓 Salami'];
const voll = (text) => text + ' Die Lire dieser Phase hast du aber schon voll.';

function ausfuehren({ art, b, ev, ph, now, body, ort, p, lage, ctx, alle, id }) {
  const nr = ph.nr;
  if (art === 'zutat') {
    if (nr > P.rebellion) fail('Die Pizzen sind weitergezogen.', 409);
    const pizzaId = String(body.pizzaId || '').slice(0, 30);
    if ((b.zutaten || []).includes(pizzaId)) fail('Diese Pizza hast du schon erwischt.', 409);
    const warten = ROM.dauer(ev, 2500) - (now - (b.tZutat || 0));
    if (warten > 0) fail('Nicht so hastig - gleich die nächste Pizza.', 429);
    const pz = ROM.pizza(ev, pizzaId, ort.updatedAt) || ROM.pizza(ev, pizzaId, now);
    if (!pz) fail('Diese Pizza ist schon davongerannt.', 409);
    if (abstand(ort, pz) > ROM.PIZZA_NAEHE) fail('Lauf näher an die Pizza heran.', 409);
    b.zutaten = (b.zutaten || []).concat(pizzaId).slice(-60); b.tZutat = now;
    const plus = lireGeben(b, nr, 1), was = ZUTATEN[Math.floor(ROM.wurf(ev, 'zutat:' + pizzaId + ':' + id) * ZUTATEN.length)];
    return { art, lire: plus, text: plus ? was + ' geschnappt! Die Pizza schreit „MAMMA MIA!“ und flüchtet.' : voll(was + ' geschnappt!') };
  }
  if (art === 'gefecht') {
    if (nr !== P.rebellion) fail('Die Legion marschiert gerade nicht.', 409);
    const warten = ROM.dauer(ev, 20000) - (now - (b.tGefecht || 0));
    if (warten > 0) fail('Deine Truppe verschnauft noch ' + sekunden(warten) + ' Sekunden.', 429);
    if (!Array.isArray(p.truppe) || !p.truppe.length) fail('Stelle zuerst eine Truppe auf.', 409);
    if (abstand(ort, ROM.wagenOrt(ev, ort.updatedAt)) > ROM.WAGEN.reichweite) fail('Lauf näher an die Pizza-Legion heran.', 409);
    const kampf = schnellkampf(p, E.zufallsfolge(ctx.random));
    b.tGefecht = now; b.gefechte = { s: ((b.gefechte && b.gefechte.s) || 0) + (kampf.sieg ? 1 : 0), n: ((b.gefechte && b.gefechte.n) || 0) + (kampf.sieg ? 0 : 1) };
    const plus = lireGeben(b, nr, kampf.sieg ? 4 : 1);
    return { art, lire: plus, sieg: kampf.sieg, kampf,
      text: kampf.sieg ? 'Sieg! ' + kampf.sie[0].name + ' zerfällt in Pizzastücke.' : kampf.sie[0].name + ' tanzt dich aus und rennt davon. Trost-Lira!' };
  }
  if (art === 'tanz') {
    if (nr !== P.invasion) fail('Die Kakerlaken tanzen gerade nicht.', 409);
    const runde = Math.floor(Number(body.runde)), jetzt = ROM.tanzRunde(ev, now);
    if (!Number.isInteger(runde) || runde < jetzt - 1 || runde > jetzt) fail('Diese Tanzrunde ist schon vorbei.', 409);
    if ((b.tanz || []).includes(runde)) fail('Diese Runde hast du schon getanzt - gleich kommt die nächste!', 409);
    b.tanz = (b.tanz || []).concat(runde).slice(-40);
    const soll = ROM.tanzFolge(ev, runde), ist = Array.isArray(body.folge) ? body.folge.slice(0, 10).map(Number) : [];
    const richtig = ist.length === soll.length && soll.every((v, i) => v === ist[i]);
    const plus = richtig ? lireGeben(b, nr, ROM.tanzLire(soll)) : 0;
    return { art, lire: plus, richtig, text: richtig ? (plus ? '¡Perfecto! Die Reisegruppe jubelt.' : voll('¡Perfecto!')) : 'Daneben - alle Kakerlaken stolpern übereinander.' };
  }
  if (art === 'polonaise') {
    if (nr !== P.invasion) fail('Gerade gibt es keine Polonaise.', 409);
    if (abstand(ort, ROM.PIAZZA) > ROM.POLONAISE.radius) fail('Stell dich zur Polonaise auf die Piazza.', 409);
    const warten = ROM.dauer(ev, ROM.POLONAISE.takt) - 500 - (now - (b.tPolonaise || 0));
    if (warten > 0) fail('Die Polonaise dreht noch ihre Runde.', 429);
    b.tPolonaise = now;
    const plus = lireGeben(b, nr, ROM.POLONAISE.lire);
    return { art, lire: plus, text: plus ? 'Du tanzt eine Runde Polonaise mit.' : voll('Du tanzt eine Runde Polonaise mit.') };
  }
  if (art === 'schlag') {
    if (nr !== P.imperator) fail('Mozzarellus ist gerade nicht da.', 409);
    if (lage.bossBesiegt) fail('Mozzarellus ist schon geschmolzen!', 409);
    if (!Array.isArray(p.truppe) || !p.truppe.length) fail('Stelle zuerst eine Truppe auf.', 409);
    if (ROM.vorrat(b, ev, now) < 1) fail('Deine Truppe holt Luft - gleich wieder.', 429);
    if (abstand(ort, ROM.bossOrt(ev, ort.updatedAt)) > ROM.BOSS.reichweite) fail('Lauf näher an Mozzarellus heran.', 409);
    const haltung = ROM.haltung(ev, now), passend = !!ROM.rollen(p)[haltung.rolle];
    const schaden = ROM.schaden(p, ev, now, lage.leisteVoll);
    /* Wer zum ersten Mal zuschlaegt, macht ihn staerker - um so viel, wie
       er selbst in rund zwoelf Schlaegen schafft (wie beim Zerhacker). */
    if (!b.hp) b.hp = ROM.BOSS.anteil * ROM.schlagwert(p);
    b.schaden += schaden; b.schlaege += 1; ROM.schlagVerbrauchen(b, ev, now);
    let plus = lireGeben(b, nr, ROM.BOSS.lire);
    const danach = ROM.lage({ ...alle, [id]: b }, ev);
    if (danach.bossBesiegt && !b.letzter) { b.letzter = true; plus += lireGeben(b, nr, ROM.BOSS.letzter); }
    return { art, lire: plus, schaden, passend, haltung: haltung.id, letzter: !!b.letzter && danach.bossBesiegt,
      text: danach.bossBesiegt ? 'DER LETZTE SCHLAG! Mozzarellus schmilzt!' : 'Treffer! ' + schaden + ' Schaden' + (passend ? ' - deine Truppe kontert den ' + haltung.name + '.' : '.') };
  }
  if (art === 'muenze') {
    if (nr !== P.trevi) fail('Der Trevi-Brunnen ist noch nicht so weit.', 409);
    if (b.muenze) fail('Deine Münze liegt schon im Brunnen.', 409);
    b.muenze = true;
    const plus = lireGeben(b, nr, ROM.MUENZE);
    return { art, lire: plus, text: 'Plopp - deine Münze liegt im Trevi-Brunnen. Du kommst sicher wieder nach Rom.' };
  }
  if (art === 'fang') {
    const was = String(body.fang || ''), max = ROM.FANG[was];
    if (!max) fail('Das gibt es hier nicht zu fangen.', 409);
    if (was === 'muenzen') { if (nr !== P.trevi) fail('Noch regnet es keine Münzen.', 409); }
    else if (was === 'turbo') { if (nr !== P.turbo) fail('Der Espresso-Overdrive ist vorbei.', 409); }
    else {
      const u = ROM.UEBERRASCHUNGEN.find((v) => v.id === was), seit = ev.ueberraschungen && ev.ueberraschungen[was];
      if (!u || !seit || now < seit || now > seit + ROM.dauer(ev, u.dauer) + 3000) fail('Die Überraschung ist schon vorbei.', 409);
    }
    b.fang = b.fang || {};
    const n = Math.max(0, Math.min(max - (b.fang[was] || 0), Math.floor(Number(body.anzahl)) || 0, 5));
    if (!n) return { art, lire: 0, text: 'Mehr passt nicht in deine Taschen.' };
    b.fang[was] = (b.fang[was] || 0) + n;
    const plus = lireGeben(b, nr, n);
    return { art, lire: plus, text: plus ? '+' + plus + ' Lire gefangen!' : voll('Gefangen!') };
  }
  if (art === 'stern') {
    /* Sternschnuppen gibt es das ganze Event ueber, auch schon im Countdown. */
    if (b.stern >= ROM.STERN.max) fail('Mehr Sternschnuppen gibt es für dich nicht.', 409);
    if (now - (b.tStern || 0) < ROM.dauer(ev, ROM.STERN.abstand)) fail('Die nächste Sternschnuppe kommt gleich.', 429);
    if (ROM.lire(b) >= ROM.LIRE_MAX) return { art, lire: 0, text: 'Deine Lire sind voll.' };
    b.stern += 1; b.tStern = now;
    return { art, lire: 1, text: 'Sternschnuppe gefangen! Wünsch dir was.' };
  }
  if (art === 'kaese') {
    /* Zwei Gold je echter Sekunde, solange es nach Mozzarellus' Sieg Kaese
       regnet. Gezaehlt wird ab der letzten Meldung, hoechstens acht Sekunden. */
    if (nr !== P.imperator) fail('Gerade regnet es keinen Käse.', 409);
    const von = Number.isFinite(ev.bossBesiegtAm) ? ev.bossBesiegtAm : lage.bossBesiegt ? now : null;
    if (von === null) fail('Erst muss Mozzarellus schmelzen.', 409);
    const bis = ROM.plan(ev).phasen[P.imperator].bis, ab = Math.max(von, b.tKaese || 0, now - ROM.KAESE.hoechstens);
    const sekundenZahl = Math.max(0, Math.floor((Math.min(now, bis) - ab) / 1000));
    const gold = sekundenZahl * ROM.KAESE.goldProSekunde;
    b.tKaese = Math.max(b.tKaese || 0, ab + sekundenZahl * 1000);
    b.kaeseGold = (b.kaeseGold || 0) + gold;
    return { art, lire: 0, gold, text: gold ? '🧀 +' + gold + ' Gold aus dem Käseregen' : '' };
  }
  if (art === 'ei') {
    if (nr !== P.trevi) fail('Die Eier sind noch im Brunnen.', 409);
    const k = Math.floor(Number(body.ei));
    if (!Number.isInteger(k) || k < 0 || k >= ROM.EIER.anzahl) fail('Dieses Ei gibt es nicht.', 409);
    if (now < ROM.eiZeit(ev, k) - 1500) fail('Dieses Ei ist noch im Brunnen.', 409);
    b.eier = b.eier || [];
    if (b.eier.includes(k)) fail('Dieses Ei hast du schon.', 409);
    b.eier.push(k);
    const plus = lireGeben(b, nr, 1);
    return { art, lire: plus, ei: k, text: '🥚 Ei aus dem Trevi gefangen! (' + b.eier.length + '/' + ROM.EIER.anzahl + ')' };
  }
  fail('Diese Event-Aktion gibt es nicht.', 400);
}

/* Eine Aktion eines Spielers. Schreibt nur seinen eigenen Beitrag. */
export async function romAktion(ctx, { body, id, world, p, now }) {
  const art = String(body.art || '');
  const aktionId = typeof body.aktionId === 'string' && body.aktionId.length >= 8 && body.aktionId.length <= 80 ? body.aktionId : fail('Aktionskennung fehlt.');
  if (!p) fail('Betritt zuerst die Spielerwelt.', 409);
  const s = await stand(ctx, now), ev = s.ev;
  if (!ev || !ROM.laeuft(ev, now)) fail('Gerade läuft kein Rom-Event.', 409);
  const ph = ROM.phase(ev, now);
  if (ph.nr < 0 && art !== 'stern') fail('Rom kommt gleich - noch ' + sekunden(ph.bis - now) + ' Sekunden.', 409);
  if (activeArena(p) || activeDuel(p) || activeDungeon(world, p) || imDuellKampf(world, p, id)) fail('Beende zuerst deinen Kampf - das Event wartet auf dich.', 409);
  const ort = ORTSAKTIONEN.includes(art) ? await position(ctx, world, id, now) : null;
  const lage = ROM.lage(s.alle, ev);
  let ergebnis = null, doppelt = false;
  const neu = await beitragAendern(ctx.db, ev.id, id, (b) => {
    const bekannt = (b.ids || []).find((v) => v.id === aktionId);
    if (bekannt) { ergebnis = { ...bekannt.erg, doppelt: true }; doppelt = true; return null; }
    ergebnis = ausfuehren({ art, b, ev, ph, now, body, ort, p, lage, ctx, alle: s.alle, id });
    b.n = String(p.name || '').slice(0, 30);
    /* Fuer eine wiederholte Anfrage reicht das Ergebnis ohne Kampfverlauf. */
    const { kampf, ...kurz } = ergebnis;
    b.ids = (b.ids || []).concat({ id: aktionId, erg: kurz }).slice(-30);
    b.t = now;
    return b;
  });
  merkerNachtragen(ctx.db, ev.id, id, neu);
  let evJetzt = ev;
  const alleJetzt = { ...s.alle, [id]: neu };
  /* Ueber eine Schwelle der Leiste? Dann einmal fuer alle die Ueberraschung. */
  if (!doppelt && ph.nr >= 0 && ph.nr <= P.invasion && ergebnis.lire > 0) {
    const danach = ROM.lage(alleJetzt, ev), schon = ev.ueberraschungen || {};
    const faellig = ROM.UEBERRASCHUNGEN.filter((u) => !schon[u.id] && danach.leiste >= u.anteil * danach.leisteZiel);
    if (faellig.length) {
      const r = await dokAendern(ctx.db, (dok) => {
        const e = aktuell(dok);
        if (!e || e.id !== ev.id) return { schreiben: false };
        e.ueberraschungen = e.ueberraschungen || {};
        let neuGesetzt = false;
        for (const u of faellig) if (!e.ueberraschungen[u.id]) { e.ueberraschungen[u.id] = now; neuGesetzt = true; }
        return { schreiben: neuGesetzt, ev: e };
      });
      if (r.ev) evJetzt = r.ev;
    }
  }
  /* Mozzarellus ist geschmolzen: den Zeitpunkt einmal fuer alle festhalten -
     ab dann regnet es Kaese (ROM.kaeseFenster). */
  if (ph.nr === P.imperator && !Number.isFinite(evJetzt.bossBesiegtAm) && ROM.lage(alleJetzt, evJetzt).bossBesiegt) {
    const r = await dokAendern(ctx.db, (dok) => {
      const e = aktuell(dok);
      if (!e || e.id !== ev.id || Number.isFinite(e.bossBesiegtAm)) return { schreiben: false, ev: e && e.id === ev.id ? e : null };
      e.bossBesiegtAm = now;
      return { schreiben: true, ev: e };
    });
    if (r.ev) evJetzt = r.ev;
  }
  return { serverTime: now, rom: sicht(evJetzt, alleJetzt, id, now), ergebnis };
}

/* ---------------------------------------------------------- Steuerung */

function steuerSicht(ctx, s, now) {
  const ev = s.ev, zugang = ctx.access || H.access(now), frei = ctx.dev || ctx.sandbox;
  const woche = E.woche(now), wocheBelegt = !frei && !!s.dok.wochen[woche];
  const reicht = frei || (zugang.open && zugang.closesAt - now >= ROM.GESAMT + ROM.PUFFER);
  const laeuft = !!ev && ROM.laeuft(ev, now);
  let grund = null;
  if (laeuft) grund = 'Es läuft schon ein Rom-Event.';
  else if (!frei && !zugang.open) grund = 'GehstockMon ist geschlossen. Das Event startet nur während der Öffnungszeiten.';
  else if (!reicht) grund = 'Bis zum Schließen um ' + uhrzeit(zugang.closesAt) + ' Uhr reicht die Zeit nicht mehr für ' + Math.round(ROM.GESAMT / 60000) + ' Minuten Rom.';
  else if (wocheBelegt) grund = 'Das Rom-Event dieser Woche ist schon gelaufen. Nächste Woche wieder!';
  else if (!frei && !ctx.pin) grund = 'Auf dem Server ist noch keine Event-PIN gesetzt. Einmal auf dem Handy in Termux: node ~/gehstock1/tools/rom-pin.mjs';
  const lage = ev ? ROM.lage(s.alle, ev) : null;
  return { serverTime: now, startbar: !grund, grund, dev: !!ctx.dev, vorschau: !!ctx.sandbox, pinNoetig: !frei, zeitraffer: frei ? ROM.ZEITRAFFER : [1],
    gesperrtBis: s.dok.pin.bis > now ? s.dok.pin.bis : 0,
    event: ev && sichtbar(ev, now) ? { id: ev.id, start: ev.start, faktor: ROM.faktor(ev), abgebrochenAm: ev.abgebrochenAm || null, von: ev.von && ev.von.name,
      vorschau: !!ev.vorschau, teilnehmer: lage.teilnehmer, leiste: { wert: lage.leiste, ziel: lage.leisteZiel, voll: lage.leisteVoll },
      boss: { hp: lage.bossHp, max: lage.bossMax, besiegt: lage.bossBesiegt }, ueberraschungen: ev.ueberraschungen || {} } : null };
}
async function pinPruefen(ctx, pin, now) {
  const stimmt = pinStimmt(pin, ctx.pin);
  const r = await dokAendern(ctx.db, (dok) => {
    if (dok.pin.bis > now) return { schreiben: false, gesperrt: dok.pin.bis };
    if (stimmt) return dok.pin.fehler ? (dok.pin = { fehler: 0, bis: 0 }, { schreiben: true }) : { schreiben: false };
    dok.pin.fehler += 1;
    if (dok.pin.fehler >= 5) dok.pin = { fehler: 0, bis: now + 15 * 60000 };
    return { schreiben: true, falsch: true, gesperrt: dok.pin.bis > now ? dok.pin.bis : 0 };
  });
  if (r.gesperrt) fail('Zu viele falsche PINs. Wieder möglich ab ' + uhrzeit(r.gesperrt) + ' Uhr.', 429);
  if (r.falsch || !stimmt) fail('Die Event-PIN stimmt nicht.', 403);
}
/* Starten, abbrechen, nachsehen - nur der CEO. */
export async function romSteuern(ctx, { body, code, id, name, now }) {
  if (ctx.rolle(code) !== 'A') fail('Das Rom-Event steuert nur der CEO.', 403);
  const ceo = await ceoCode(ctx);
  if (!ceo || ceo !== normieren(code)) fail('Das Rom-Event steuert nur der aktuelle CEO.', 403);
  const aktion = String(body.aktion || 'status');
  if (aktion === 'status') return { steuerung: steuerSicht(ctx, await stand(ctx, now, true), now) };
  if (aktion !== 'start' && aktion !== 'abbruch') fail('Diese Steueraktion gibt es nicht.');
  const aktionId = typeof body.aktionId === 'string' && body.aktionId.length >= 8 && body.aktionId.length <= 80 ? body.aktionId : fail('Aktionskennung fehlt.');
  const frei = ctx.dev || ctx.sandbox;
  if (!frei) {
    if (!ctx.pin) fail('Auf dem Server ist noch keine Event-PIN gesetzt. Einmal auf dem Handy in Termux: node ~/gehstock1/tools/rom-pin.mjs', 503);
    await pinPruefen(ctx, body.pin, now);
  }
  if (aktion === 'start') {
    const faktor = frei && ROM.ZEITRAFFER.includes(Number(body.faktor)) ? Number(body.faktor) : 1;
    if (!frei) {
      const zugang = ctx.access || H.access(now);
      if (!zugang.open) fail('GehstockMon ist gerade geschlossen - das Event startet nur während der Öffnungszeiten.', 423);
      if (zugang.closesAt - now < ROM.GESAMT + ROM.PUFFER) fail('Bis zum Schließen um ' + uhrzeit(zugang.closesAt) + ' Uhr reicht die Zeit nicht mehr für ' + Math.round(ROM.GESAMT / 60000) + ' Minuten Rom.', 409);
    }
    const r = await dokAendern(ctx.db, (dok) => {
      const letztes = aktuell(dok);
      if (letztes && letztes.startId === aktionId) return { schreiben: false, ev: letztes };
      if (letztes && ROM.laeuft(letztes, now)) fail('Es läuft schon ein Rom-Event.', 409);
      const woche = E.woche(now);
      if (!frei && dok.wochen[woche]) fail('Das Rom-Event dieser Woche ist schon gelaufen. Nächste Woche wieder!', 409);
      const ev = { id: 'rom-' + now.toString(36) + '-' + randomBytes(3).toString('hex'), start: now, faktor,
        von: { id, name: String(name || 'CEO').slice(0, 30) }, startId: aktionId, vorschau: !!ctx.sandbox, woche, ueberraschungen: {} };
      const weg = dok.events.slice(0, Math.max(0, dok.events.length - 4)).map((e) => e.id);
      dok.events = dok.events.concat(ev).slice(-5);
      if (!frei) {
        const wochen = {};
        for (const [w, e] of Object.entries(dok.wochen)) if (Number(w) >= woche - 8) wochen[w] = e;
        dok.wochen = { ...wochen, [woche]: ev.id };
      }
      dok.log = dok.log.concat({ t: now, was: 'start', wer: String(name || '').slice(0, 30), ev: ev.id }).slice(-40);
      return { schreiben: true, ev, weg };
    });
    /* Beitraege von Events, die aus der Liste gefallen sind, werden nicht mehr gebraucht. */
    for (const alt of r.weg || []) { try { await ctx.db.delete(beitragSchluessel(alt)); } catch { /* nur Platz */ } }
    return { steuerung: steuerSicht(ctx, await stand(ctx, now, true), now), gestartet: r.ev.id };
  }
  await dokAendern(ctx.db, (dok) => {
    const ev = aktuell(dok);
    if (ev && ev.abbruchId === aktionId) return { schreiben: false };
    if (!ev || !ROM.laeuft(ev, now)) fail('Es läuft gerade kein Rom-Event.', 409);
    ev.abgebrochenAm = now; ev.abbruchId = aktionId;
    /* Im Countdown abgebrochen: es ist nichts passiert, die Woche bleibt frei. */
    if (ROM.nieGelaufen(ev) && dok.wochen[ev.woche] === ev.id) delete dok.wochen[ev.woche];
    dok.log = dok.log.concat({ t: now, was: 'abbruch', wer: String(name || '').slice(0, 30), ev: ev.id }).slice(-40);
    return { schreiben: true };
  });
  return { steuerung: steuerSicht(ctx, await stand(ctx, now, true), now) };
}

/* ---------------------------------------------------------- Rom-Ei */

/* Was aus einem Rom-Ei schluepft: 89 % Legendaer, 10 % Mythisch, 1 %
   Apokalyptisch. Gewuerfelt wird erst beim Schluepfen, damit vorher
   nirgends etwas darueber steht.
   Auf Wunsch von Louis (30.09.2026): Dennis, Jamie und Max ziehen aus dem
   Rom-Ei nur Legendaere - erkannt am Namen wie bei den Geschenk-Eiern
   (OHNE_EIER in gehstockmon.mjs). */
export const ROM_EI = { mythisch: 0.10, apokalyptisch: 0.01 };
const NUR_LEGENDAER = /^(dennis|jamie|max)\b/i;
export function romEiRang(p, zufall) {
  if (NUR_LEGENDAER.test(String((p && p.name) || '').trim())) return 4;
  const w = Math.max(0, Math.min(0.9999999, Number(zufall()) || 0));
  return w < ROM_EI.apokalyptisch ? 6 : w < ROM_EI.apokalyptisch + ROM_EI.mythisch ? 5 : 4;
}
function romEiGeben(p, ev, pid, now) {
  const ei = { id: 'rom-' + ev.id + '-' + pid, territoryId: D.FELDER[0].id, producedAt: now, startedAt: now - E.HATCH_TIME, readyAt: now, mindestens: 4, art: 'rom' };
  if ((p.eggs || []).some((e) => e.id === ei.id) || (p.sonderEier || []).some((e) => e.id === ei.id)) return 'tasche';
  if (p.eggs.length < E.BAG_LIMIT) { p.eggs.push(ei); return 'tasche'; }
  if ((p.sonderEier || []).length < 20) { p.sonderEier = (p.sonderEier || []).concat({ ...ei, fertig: true }); return 'warte'; }
  E.buchen(p, X.HAENDLER_EI_PREIS, 'rom', now);
  return 'gold';
}

/* ---------------------------------------------------------- Abrechnung */

/* Ein ganz normales Ei aus dem Trevi-Brunnen - roh, es will ausgebruetet werden. */
function treviEiGeben(p, ev, pid, k, now) {
  const ei = { id: 'trevi-' + ev.id + '-' + pid + '-' + k, territoryId: D.FELDER[0].id, producedAt: now, startedAt: null, readyAt: null, art: 'trevi' };
  if ((p.eggs || []).some((e) => e.id === ei.id) || (p.sonderEier || []).some((e) => e.id === ei.id)) return 'tasche';
  if (p.eggs.length < E.BAG_LIMIT) { p.eggs.push(ei); return 'tasche'; }
  if ((p.sonderEier || []).length < 20) { p.sonderEier = (p.sonderEier || []).concat(ei); return 'warte'; }
  E.buchen(p, X.HAENDLER_EI_PREIS, 'rom', now);
  return 'gold';
}
function berichtText(l) {
  const teile = [];
  if (l.gold) teile.push(l.gold + ' Gold');
  for (const [rang, n] of Object.entries(l.runen || {})) teile.push(n + ' ' + D.SELTENHEITEN[rang].name + '-Runen');
  if (l.ei === 'tasche') teile.push('ein Rom-Ei');
  if (l.ei === 'warte') teile.push('ein Rom-Ei (wartet auf Platz)');
  if (l.ei === 'gold') teile.push('350 Gold statt des Rom-Eis (Tasche voll)');
  if (l.mozzarino === 'neu') teile.push('Centurio Mozzarino');
  if (l.mozzarino === 'stufe') teile.push('eine Runenstufe für Centurio Mozzarino');
  if (l.mozzarino === 'runen') teile.push('5 Legendär-Runen von Centurio Mozzarino');
  const eier = (l.eier.tasche || 0) + (l.eier.warte || 0);
  if (eier) teile.push(eier + (eier === 1 ? ' Ei' : ' Eier') + ' aus dem Trevi-Brunnen');
  if (l.eier.gold) teile.push(l.eier.gold * X.HAENDLER_EI_PREIS + ' Gold für Trevi-Eier ohne Platz');
  if (l.perle === 'neu') teile.push('eine Schimmerperle');
  return '🇮🇹 Rom-Event: ' + l.lire + ' Lire' + (teile.length ? ' · ' + teile.join(', ') : '') + '.';
}
function auszahlen(world, ev, alle, now) {
  const lage = ROM.lage(alle, ev);
  let anzahl = 0;
  for (const [pid, b] of Object.entries(alle)) {
    const p = world.players[pid];
    if (!p || !b) continue;
    const lohn = ROM.lohn(beitragSauber(b), lage, ev);
    /* Kaesegold und Trevi-Eier zaehlen auch unterhalb des Touristen. */
    if (!lohn.stufen.length && !lohn.titel.length && !lohn.eier && !lohn.kaese) continue;
    anzahl++;
    const letztes = { ev: ev.id, t: now, lire: lohn.lire, gold: lohn.gold, runen: lohn.runen, stufen: lohn.stufen, titel: lohn.titel,
      ei: null, mozzarino: null, perle: null, eier: { tasche: 0, warte: 0, gold: 0 }, kaese: lohn.kaese, bossGold: lohn.bossGold,
      leiste: lohn.leiste, boss: lohn.boss, abgebrochen: lohn.abgebrochen, vorschau: !!ev.vorschau };
    if (lohn.gold) E.buchen(p, lohn.gold, 'rom', now);
    p.runes = Array.isArray(p.runes) ? p.runes : D.SELTENHEITEN.map(() => 0);
    for (const [rang, n] of Object.entries(lohn.runen)) p.runes[rang] = Math.min(9999, (p.runes[rang] || 0) + n);
    if (lohn.romEi) letztes.ei = romEiGeben(p, ev, pid, now);
    if (lohn.mozzarino) letztes.mozzarino = ROM.monGeben(p, ROM.MOZZARINO.id);
    for (let k = 0; k < lohn.eier; k++) letztes.eier[treviEiGeben(p, ev, pid, k, now)]++;
    if (lohn.perle) {
      if (p.schimmerperle) { E.buchen(p, ROM.PERLE_GOLD, 'rom', now); letztes.perle = 'gold'; }
      else { p.schimmerperle = true; letztes.perle = 'neu'; }
    }
    p.rom = p.rom && typeof p.rom === 'object' ? p.rom : {};
    if (lohn.titel.includes('held_von_rom')) p.rom.held = (p.rom.held || 0) + 1;
    if (lohn.titel.includes('mozzarella_bezwinger')) p.rom.boss = (p.rom.boss || 0) + 1;
    if (lohn.titel.includes('legende_von_rom')) p.rom.legende = (p.rom.legende || 0) + 1;
    p.rom.letztes = letztes;
    world.reports.push({ id: 'rom-' + ev.id + '-' + pid, time: now, attackerId: pid, defenderId: null, territoryId: 1, text: berichtText(letztes) });
  }
  world.reports = world.reports.slice(-150);
  tickern(world, '🇮🇹 ROMA È FINITA ist vorbei: ' + lage.teilnehmer + ' in Rom, ' + anzahl + ' mit Belohnung - '
    + (lage.bossBesiegt ? 'Imperatore Mozzarellus ist geschmolzen!' : 'Mozzarellus ist auf der Vespa entkommen.'), 'boss', now);
  world.rom.archiv = (Array.isArray(world.rom.archiv) ? world.rom.archiv : []).concat({ id: ev.id, start: ev.start, ende: ROM.ende(ev),
    von: (ev.von && ev.von.name) || 'CEO', teilnehmer: lage.teilnehmer, belohnt: anzahl, boss: lage.bossBesiegt, leiste: lage.leisteVoll, abgebrochen: !!ev.abgebrochenAm }).slice(-10);
}
/* Laeuft bei jedem Weltzugriff mit. Rechnet jedes beendete Event genau
   einmal ab - drei Sekunden nach dem Ende, damit eine Aktion, die kurz vor
   Schluss noch unterwegs war, mitzaehlt. */
export async function romAbrechnen(ctx, world, now) {
  let s;
  try { s = await stand(ctx, now); } catch { return false; }
  const offen = s.dok.events.filter((ev) => now >= ROM.ende(ev) + 3000);
  if (!offen.length) return false;
  world.rom = world.rom && typeof world.rom === 'object' ? world.rom : {};
  const erledigt = world.rom.abgerechnet && typeof world.rom.abgerechnet === 'object' ? world.rom.abgerechnet : {};
  let geaendert = false;
  for (const ev of offen) {
    if (erledigt[ev.id]) continue;
    if (!ROM.nieGelaufen(ev)) auszahlen(world, ev, await alleBeitraege(ctx.db, ev.id), now);
    erledigt[ev.id] = now; geaendert = true;
  }
  if (geaendert) world.rom.abgerechnet = Object.fromEntries(Object.entries(erledigt).sort((a, b) => b[1] - a[1]).slice(0, 20));
  return geaendert;
}
