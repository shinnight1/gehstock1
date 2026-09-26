import { speicher } from './lib/speicher.mjs';
import { createHash } from 'node:crypto';
import { data as D, economy as E, arena as A, hours as H, adventure as X } from './lib/gehstockmon-rules.mjs';
import {adventureAction,finishEncounter,expireAdventure,deliverRewards,activeArena,activeDuel,weltprojekte,wochenschritt,fehdeSchritt,zerhacker,wochenaufgabe,fehden} from './lib/gehstockmon-adventure.mjs';
import {activeDungeon,settleDungeons,dungeonResult,dungeonAction} from './lib/gehstockmon-dungeons.mjs';
import {stadtAction,arenaStand,championSold} from './lib/gehstockmon-stadt.mjs';
import {schenken,schenkungen} from './lib/gehstockmon-schenken.mjs';
import {lesen as anwesenheitLesen,schreiben as anwesenheitSchreiben} from './lib/gehstockmon-anwesenheit.mjs';
import {tickern,tickerSicht,alltagSicht,alltagAction,morgenbericht} from './lib/gehstockmon-alltag.mjs';

const KEY = 'world-v2';
const clone = (value) => JSON.parse(JSON.stringify(value));
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
const SANDBOX_IDLE = 5 * 60 * 1000;
function volatileStore() {
  let value = null, version = 0;
  return {
    async getWithMetadata() { return value ? { data: clone(value), etag: String(version) } : null; },
    async setJSON(key, next, options) {
      if ((options?.onlyIfMatch !== undefined && options.onlyIfMatch !== String(version)) || (options?.onlyIfNew && value)) return { modified: false };
      value = clone(next); version++; return { modified: true };
    },
  };
}
/* Dieselbe Liste, nach der der Browser seine Kennung anhaengt - sonst
   scheitert jeder Zug, den nur eine Seite kennt. */
const mutations = X.SPIELZUEGE;
/* Verschenken und Nachlesen sind Verwaltung, kein Spielzug: sie brauchen
   keinen eigenen Spielstand und richten sich nicht nach den Oeffnungszeiten. */
const ADMIN_OPS = ['admin_grant', 'admin_log'];
class GameError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
function adminBypass(body) {
  return body && body.adminOverride === true && body.adminCode === '3141' && roleForCode(body.code) === 'A';
}
function accessFor(timestamp, bypass) {
  const access = H.access(timestamp);
  if (bypass) return { ...access, open: true, adminOverride: true, closesAt: timestamp + 365 * 24 * 60 * 60 * 1000 };
  return access;
}
function requireOpen(timestamp, bypass = false) {
  const access = accessFor(timestamp, bypass);
  if (!access.open) { const error = new GameError('GehstockMon ist gerade geschlossen.', 423); error.access = access; throw error; }
  return access;
}
function validCode(value) {
  return roleForCode(value) !== null;
}
function roleForCode(value) {
  if (typeof value !== 'string' || !/^\d{4}$/.test(value)) return null;
  const text = 'code:' + value + ':gehstock:hideout:2026:kellergewoelbe'; let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0; }
  if (h % 97 !== 0) return null;
  return ['S', 'K', 'A'][Math.floor(h / 97) % 3];
}
function initialWorld(now) {
  return { version: 1, mapVersion: D.MAP_VERSION, players: {}, reports: [], territories: D.FELDER.map((f) => ({ id: f.id, ownerId: null,
    ownerName: ['Wilder Clan','Flusswächter','Aschenclan','Nebelwache','Die Krone'][(f.id - 1) % 5],
    defense: A.defenders(f.id).map((k) => ({ id: k.id })), version: 1, ...E.outpost(null, now) })) };
}
function migrateMap(world, now) {
  if (world.mapVersion === D.MAP_VERSION) return;
  if(world.mapVersion===3||world.mapVersion===4){world.mapVersion=D.MAP_VERSION;for(const p of Object.values(world.players)){p.spawn=X.outside(X.SPAWN,X.layout(world.territories));p.lastJoinAt=now;}return;}
  if(world.mapVersion===2){world.territories.push(...initialWorld(now).territories.slice(5));world.mapVersion=D.MAP_VERSION;return;}
  const old = clone(world.territories), biomeId = (id) => (id - 1) % 5 + 1;
  world.previousMap = { changedAt: now, territories: clone(old) };
  for (const p of Object.values(world.players)) {
    for (const egg of p.eggs || []) if (Number.isInteger(egg.territoryId) && egg.territoryId > 0) egg.territoryId = biomeId(egg.territoryId);
    Object.assign(p, D.neuerStand(p, now));
    if (p.arena && p.arena.phase !== 'finished') {
      p.arena = A.flee(p.arena); p.arena.winner = 'map_changed'; p.arena.settled = true;
      p.arena.message = 'Die Insel hat jetzt neun Biomgebiete. Wähle ein Gebiet auf der neuen Karte.';
    }
    if (p.arena) p.arena.territoryId = biomeId(p.arena.territoryId);
  }
  // Einkommen bis zur Umstellung bleibt erhalten; der bisherige Kartenstand ist archiviert.
  for (const t of old) if (t.ownerId && world.players[t.ownerId]) E.settle(world.players[t.ownerId], Object.assign(t, E.outpost(t, now)), now);
  world.territories = initialWorld(now).territories.map((base) => {
    const candidates = old.filter((t) => biomeId(t.id) === base.id && t.ownerId && world.players[t.ownerId]);
    candidates.sort((a,b) => b.capturedAt - a.capturedAt || b.level - a.level || a.id - b.id);
    const held = candidates[0];
    return held ? { ...held, id: base.id, version: Math.max(...old.filter(t=>biomeId(t.id)===base.id).map(t=>t.version||1)) + 1 } : base;
  });
  world.mapVersion = D.MAP_VERSION;
}
function migrateAndSettle(world, now) {
  migrateMap(world, now);
  for (const p of Object.values(world.players)) {
    Object.assign(p, D.neuerStand(p, now));
    if (p.arena && p.arena.phase !== 'finished' && now - p.arena.lastActionAt > 20 * 60000) {
      p.arena = A.flee(p.arena); p.arena.winner = 'expired'; p.arena.settled = true;
      p.arena.message = 'Der Kampf wurde nach 20 Minuten ohne Zug beendet.';
    }
  }
  for (const t of world.territories) {
    Object.assign(t, E.outpost(t, now));
    if (t.ownerId && world.players[t.ownerId]) { E.settle(world.players[t.ownerId], t, now); E.weekend(world.players[t.ownerId], t, t.id, now); }
  }
  for (const [id,p] of Object.entries(world.players)) {
    p.geschafft = world.territories.filter(t=>t.ownerId===id).map(t=>t.id);
    p.outposts = Object.fromEntries(world.territories.filter(t=>t.ownerId===id).map(t=>[t.id,E.outpost(t,now)]));
    /* Eine Besatzung auf Land, das einem nicht mehr gehoert, bindet vier Mons
       an einen Posten, den man ueber die Oberflaeche nicht mehr erreicht -
       sie liessen sich nie wieder einsetzen. Wer ein Gebiet verliert, verliert
       darum hier auch seine Besatzung, egal auf welchem Weg. */
    for (const key of Object.keys(p.posten || {})) if (!p.geschafft.includes(Number(key))) delete p.posten[key];
  }
  expireAdventure(world,now);
  settleDungeons(world,now);
  championSold(world,now);
  /* Die Wochenwechsel gehoeren vor das Schreiben. Bisher stiessen sie erst in
     publicResult an - also nachdem der Spielstand schon abgelegt war, und alles
     was sie dabei gutschrieben, war mit der Antwort wieder weg. */
  zerhacker(world,now);wochenaufgabe(world,now);fehden(world,now);
  verteidigungenPruefen(world);
}
/* Die gespeicherte Verteidigung soll immer das sein, was der Besitzer gerade
   aufgestellt hat. Sie an jeder einzelnen Stelle nachzuziehen ging schief:
   ein weggetauschtes Mon kaempfte auf seinem alten Posten weiter, obwohl es
   laengst einem anderen gehoerte. Darum wird sie hier einmal fuer alle
   Gebiete geprueft - und die Version nur erhoeht, wenn sich wirklich etwas
   geaendert hat, sonst liefe jedem Angreifer sein Kampf davon. */
function verteidigungenPruefen(world) {
  for (const t of world.territories) {
    const p = t.ownerId && world.players[t.ownerId];
    if (!p) continue;
    const neu = verteidigung(p, t.id);
    if (JSON.stringify(neu) !== JSON.stringify(t.defense)) { t.defense = neu; t.version++; }
  }
}
/* Die gespeicherte Verteidigung eines Gebiets: seine eigene Besatzung, sonst
   das Kampfteam. Sie traegt Runenstufe, Wesen und Kampfplan mit - ohne die
   kaempfte jedes Gebiet nach derselben festen Heuristik, egal wem es gehoert. */
function verteidigung(p, territoryId) {
  return X.besatzung(p, territoryId).map((mid) => {
    const m = X.mon(p, mid);
    return { id: mid, upgrade: m.upgrade, wesen: m.wesenId || null, plan: A.planOder(p.plaene && p.plaene[mid]), ...(m.schimmernd ? { schimmernd: true } : {}) };
  });
}
/* Nach jeder Aenderung an Truppe, Besatzung oder Planen: alle eigenen Gebiete
   auf den neuen Stand bringen. */
function verteidigungenAuffrischen(world, p, id) {
  for (const t of world.territories) if (t.ownerId === id) {
    const neu = verteidigung(p, t.id);
    t.ownerName = p.name;
    /* Die Version steigt nur, wenn sich die Verteidigung wirklich aendert.
       Frueher stieg sie bei jedem Speichern: wer sein unveraendertes
       Kampfteam noch einmal bestaetigte, machte damit jeden laufenden Angriff
       auf seine Gebiete ungueltig - und das liess sich gezielt ausnutzen,
       weil jeder sieht, wer gerade kaempft. */
    if (JSON.stringify(neu) !== JSON.stringify(t.defense)) { t.defense = neu; t.version++; }
  }
}
function validateSquad(p, squad) {
  if (!Array.isArray(squad) || squad.length !== 4 || new Set(squad).size !== 4 || squad.some((id) => typeof id !== 'string' || !p.besitz.includes(id) || !D.mon(id))) throw new GameError('Wähle vier verschiedene Mons aus deiner Sammlung.');
  return squad.slice();
}
function target(world, id) {
  if (!Number.isInteger(id) || id < 1 || id > D.FELDER.length) throw new GameError('Dieses Gebiet gibt es nicht.');
  return world.territories[id - 1];
}
function protectedOwner(world, t, now) {
  const p = t.ownerId && world.players[t.ownerId];
  return !!(p && now - p.lastSeen >= 12 * E.HOUR && p.lastOfflineLoss > p.lastSeen);
}
function publicResult(world, id, now, extra = {}) {
  const p = world.players[id];
  return { playerId: id, serverTime: now, access: accessFor(now, extra.adminOverride === true), mapVersion: world.mapVersion, dailyDelivery:extra.joining?p.dailyDelivery||0:0,profile: D.neuerStand(p, now), arena: p.arena || null,duel:p.duel||null,spawn:p.spawn,encounters:X.encounters(now,world.territories).filter(e=>!p.encounterClaims.includes(e.id)),
    ...dungeonResult(world,p), ...weltprojekte(world,id,now), ...arenaStand(world,id,now), territories: world.territories.map((t) => ({ id: t.id, ownerId: t.ownerId, ownerName: world.players[t.ownerId]?.name || t.ownerName, version: t.version, level: t.level,
      /* Plan und Wesen gehoeren dazu: Aufklaeren soll zeigen, wie die Truppe
         kaempft. Frueher fehlten beide, und bei jedem Spielergebiet stand
         "kein eigener Plan", obwohl dort sehr wohl einer galt. */
      defense: A.defenders(t.id, t.ownerId ? t.defense : null).map((k) => ({ id: k.id, name: k.name, upgrade:k.upgrade||0,
        wesen: k.wesenId || null, plan: k.plan || null, ...(k.schimmernd ? { schimmernd: true } : {}) })),
      eggStock: t.ownerId === id ? t.eggStock : 0, eggAt: t.ownerId === id ? t.eggAt : null })),
    reports: world.reports.filter((r) => r.attackerId === id || r.defenderId === id).slice(-20),
    alltag: alltagSicht(p, now), ticker: tickerSicht(world), ...extra };
}

// Anwesenheit ist kurzlebig und unabhängig von Gold, Eiern und Kampfaktionen.
/* Wie weit man zwischen zwei Meldungen laufen darf: 11 Schritte je Sekunde,
   angespart fuer hoechstens fuenf Sekunden. Frueher waren es drei (33) - der
   Browser musste beim Laufen deshalb alle zwei Sekunden melden, und wer
   allein auf der Insel war und nur alle sechs meldete, wurde beim Laufen
   immer wieder zurueckgesetzt. */
const LAUF_TEMPO = 11, LAUF_VORRAT = 55;
/* Mitspieler zeigt nur, wer sich in den letzten 15 Sekunden gemeldet hat.
   Der eigene letzte Stand dagegen verfaellt nicht: er ist der Ort, an dem
   man weiterspielt - nach dem Neuladen, nach einem langen Dungeon, einem
   gesperrten Tablet oder der Nacht. Frueher galt er zehn Minuten, und
   'join' setzte jeden an den Start zurueck: wer neu lud, die Verbindung
   kurz verlor oder das Tablet waehrend eines Gruppen-Dungeons sperrte,
   stand danach wieder in der Inselmitte. Aufgeraeumt wird ein Eintrag erst
   nach einem Monat ohne Meldung. */
const SICHTBAR_MS = 15000, ORT_BEHALTEN_MS = 30 * 24 * 60 * 60 * 1000;
/* Der zuletzt gemeldete Ort, wenn man dort noch stehen darf. Nach einer
   Kartenaenderung kann er im Wasser oder im Arenarund liegen - dann zaehlt
   er nicht, sonst saesse die Figur dort fest. */
function letzterStand(eintrag, timestamp) {
  return eintrag && Number.isFinite(eintrag.x) && Number.isFinite(eintrag.z)
    && timestamp - eintrag.updatedAt < ORT_BEHALTEN_MS && X.walkable(eintrag) ? eintrag : null;
}
/* Wo man beim Betreten der Welt steht: am zuletzt gemeldeten Ort. Liegt er
   inzwischen hinter fremden Mauern, geht es vor deren Tor - genau wie die
   Wegpruefung es auch taete. Wer noch nie gemeldet war, beginnt am Start. */
function startpunkt(eintrag, world, id, timestamp) {
  const layout = X.layout(world.territories), ort = letzterStand(eintrag, timestamp);
  if (!ort) return X.outside(X.SPAWN, layout);
  const punkt = { x: ort.x, z: ort.z };
  return layout.some((g) => g.ownerId !== id && X.inside(punkt, g)) ? X.outside(punkt, layout) : punkt;
}
/* Nur fuer 'join': der eigene Eintrag aus der Anwesenheit. Faellt sie aus,
   beginnt man eben am Start - betreten laesst sich die Welt trotzdem. */
async function eigenerEintrag(db, id) {
  try { return (await anwesenheitLesen(db)).eintraege[id] || null; } catch (err) { return null; }
}
async function updatePresence(db, world, id, position, timestamp, clock, bypass = false) {
  const p = world.players[id];
  if (!p) throw new GameError('Betritt zuerst die Spielerwelt.',409);
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.z) || !Number.isFinite(position.heading)
      || !X.onLand(position) || Math.abs(position.heading)>Math.PI+0.01) throw new GameError('Ungültige Kartenposition.');
  for (let attempt=0;attempt<8;attempt++) {
    const stand=await anwesenheitLesen(db,timestamp,attempt?0:1000);
    const players=Object.fromEntries(Object.entries(stand.eintraege).filter(([pid,v])=>world.players[pid]&&timestamp-v.updatedAt<ORT_BEHALTEN_MS));
    const weg=stand.gemerkt?[]:Object.keys(stand.eintraege).filter((pid)=>pid!==id&&!players[pid]);
    const peers=()=>Object.values(players).filter(v=>v.id!==id&&timestamp-v.updatedAt<SICHTBAR_MS).map(({credit,spawnAt,...peer})=>peer);
    /* Weiter geht es immer vom zuletzt gemeldeten Ort - auch nach 'join',
       denn der setzt den Startpunkt auf genau diesen Ort. */
    const layout=X.layout(world.territories),previous=letzterStand(players[id],timestamp);
    let from=previous||p.spawn||X.outside(X.SPAWN,layout);
    if(layout.some(g=>g.ownerId!==id&&X.inside(from,g)))from=X.outside(from,layout);
    const credit=previous?Math.min(LAUF_VORRAT,(previous.credit||0)+Math.max(0,timestamp-previous.updatedAt)/1000*LAUF_TEMPO):LAUF_VORRAT,distance=Math.hypot(position.x-from.x,position.z-from.z);
    const route=distance<=credit+.05?X.route(layout,from,position,id,credit+.05):null;
    if(!route)return json({serverTime:timestamp,access:accessFor(timestamp,bypass),position:{x:from.x,z:from.z,heading:from.heading||0},positionCorrected:true,peers:peers()});
    let traveled=0,cursor=from;for(const point of route){traveled+=Math.hypot(point.x-cursor.x,point.z-cursor.z);cursor=point;}
    const eintrag=!players[id]||players[id].updatedAt<=timestamp?{ id, name:p.name, x:Math.round(position.x*100)/100, z:Math.round(position.z*100)/100,
      heading:position.heading, activity:activeArena(p)||activeDuel(p)||activeDungeon(world,p)?'arena':'map', updatedAt:timestamp,spawnAt:p.lastJoinAt,credit:Math.max(0,credit-traveled),skin:p.skin,weapon:p.weapon,squad:p.truppe.slice(),protected:X.protected(p,timestamp),eier:p.eggs.length,champion:world.champion?.id===id }:null;
    requireOpen(clock(), bypass);
    if(await anwesenheitSchreiben(db,stand,id,eintrag,weg))return json({serverTime:timestamp,access:accessFor(timestamp,bypass),peers:peers()});
    await pause(attempt);
  }
  throw new GameError('Die Mitspieler werden gerade aktualisiert.',409);
}
/* Nach einem verlorenen Wettlauf ums Schreiben nicht sofort wieder los:
   dieselben zwei trafen sich sonst gleich noch einmal. Zufaellig gestreut,
   und mit jedem Versuch etwas laenger. */
const pause = (attempt) => new Promise((ok) => setTimeout(ok, 10 + Math.random() * 30 * (attempt + 1)));
/* ------------------------------------------------------------------
   Eine blosse Abfrage schreibt nicht

   Jedes Kind fragt alle 30 Sekunden die Welt ab ('world'), im Dungeon alle
   zweieinhalb. Bisher wurde danach jedes Mal das ganze Weltdokument
   zurueckgeschrieben - obwohl sich dabei fast nie etwas aendert, ausser
   Uhrzeiten: bis wann das Gold eines Aussenpostens verbucht ist, der
   angebrochene Goldrest, der Zeitstempel "zuletzt gesehen". Das kostete
   einen Datenbankbefehl und das ganze Dokument an Datenmenge, und die
   Schreibvorgaenge kamen den echten Spielzuegen in die Quere.

   Diese Felder ergeben sich beim naechsten Mal genauso aus dem
   gespeicherten Stand (E.settle rechnet vom letzten Buchungszeitpunkt bis
   jetzt, egal wie oft dazwischen gerechnet wurde). Hat sich nur so etwas
   geaendert, bleibt das Schreiben aus. Alles andere - ein fertiges Ei, ein
   Wochenwechsel, ein abgelaufener Kampf, ein neuer Name - wird wie bisher
   geschrieben. "Zuletzt gesehen" wird spaetestens alle drei Minuten
   gespeichert; der Abwesenheitsschutz rechnet in Stunden.
   ------------------------------------------------------------------ */
const ZULETZT_GESEHEN_MS = 3 * 60 * 1000;
const NUR_UHR = [/^version$/, /^champion\.soldAt$/, /^territories\.\d+\.incomeAt$/,
  /^players\.[^.]+\.(gold|goldRemainder|clockAt)$/, /^players\.[^.]+\.outposts\.\d+\.incomeAt$/];
function unterschiede(a, b, pfad, aus) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)
      || (Array.isArray(a) && a.length !== b.length)) { aus.push(pfad); return aus.length < 40; }
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (!unterschiede(a[k], b[k], pfad ? pfad + '.' + k : k, aus)) return false;
  }
  return true;
}
function nurUhrGestellt(vorher, welt, id, jetzt) {
  const alt = vorher.players && vorher.players[id];
  if (!alt || !(jetzt - (alt.lastSeen || 0) < ZULETZT_GESEHEN_MS)) return false;
  const pfade = [];
  if (!unterschiede(vorher, welt, '', pfade)) return false;
  return pfade.every((pfad) => pfad === 'players.' + id + '.lastSeen' || NUR_UHR.some((muster) => muster.test(pfad)));
}
function settleBattle(world, p, id, now, requestId) {
  if(finishEncounter(world,p,id,now))return;
  const b = p.arena; if (b.phase !== 'finished' || b.settled) return;
  b.settled = true; const t = target(world, b.territoryId), defenderId = t.ownerId;
  if (b.winner === 'wir') {
    if (t.version !== b.territoryVersion || t.ownerId === id || protectedOwner(world, t, now)) {
      b.winner = 'stale'; b.message = 'Das Gebiet hat sich während des Kampfes verändert. Kläre es erneut auf; dieser Kampf kostet kein Gold.';
    } else {
      const defender = defenderId && world.players[defenderId];
      if (defender && now - defender.lastSeen >= 12 * E.HOUR) defender.lastOfflineLoss = now;
      const level = t.level; E.capture(p, t.id, now); fehdeSchritt(world, id, 'gebiet', now);
      /* Der Verlierer zieht seine Besatzung ab - die vier stehen ihm sofort
         wieder fuer andere Posten zur Verfuegung. */
      if (defender && defender.posten) delete defender.posten[t.id];
      Object.assign(t, E.outpost(null, now), { level, ownerId: id, ownerName: p.name, defense: verteidigung(p, t.id), version: t.version + 1 });
      b.message = 'Gebiet erobert! +40 Gold. Dein Außenposten produziert jetzt Gold und alle 2 Stunden ein Ei.';
      /* Wer verliert, bekommt seine Revanche - wer sie gerade genommen hat,
         hat sie eingeloest. */
      const warRache = !!b.revanche;
      if (p.revanche) delete p.revanche[t.id];
      if (defender) { defender.revanche = defender.revanche || {}; defender.revanche[t.id] = { gegner: id, name: p.name, bis: now + X.REVANCHE_DAUER }; }
      if (warRache) b.message = 'Revanche geglückt! ' + b.message;
      tickern(world, warRache
        ? '🔥 Revanche! ' + p.name + ' holt sich ' + D.FELDER[t.id - 1].name + (defender ? ' von ' + defender.name : '') + ' zurück'
        : '⚔️ ' + p.name + ' erobert ' + D.FELDER[t.id - 1].name + (defender ? ' von ' + defender.name : ''), warRache ? 'revanche' : 'eroberung', now, id);
    }
  } else b.message = b.winner === 'fled' ? 'Zurückgezogen. Das Gebiet bleibt beim Verteidiger.' : 'Deine Truppe ist zurück im Lager. Versuche andere Attacken oder eine andere Aufstellung.';
  world.reports.push({ id: requestId, time: now, attackerId: id, defenderId, territoryId: t.id, winner: b.winner,
    text: p.name + (b.winner === 'wir' ? ' erobert ' : b.winner === 'fled' ? ' verlässt ' : ' scheitert an ') + D.FELDER[t.id - 1].name,
    /* Der ganze Kampf zum Nachlesen - vor allem fuer den Verteidiger, der
       nicht dabei war. Beide Aufstellungen stehen dabei, sonst ist der
       Verlauf spaeter nicht mehr zu deuten. */
    runden: b.round, angreifer: b.teams[0].map((u) => u.name), verteidiger: b.teams[1].map((u) => u.name),
    verlauf: (b.verlauf || []).slice(-60) });
  world.reports = world.reports.slice(-150);
}

/* Each turn, egg and upgrade is authoritative and atomically persisted. */
export function createHandler({ store, presenceStore, now = Date.now, random = Math.random, sandbox = false } = {}) {
  let sharedSandbox = null;
  /* Kurzes Gedaechtnis fuer die Anwesenheit, siehe unten bei op 'presence'. */
  let weltMerker = null;
  const WELT_FRISCH = 5000;
  async function presenzWelt(db, id, jetzt) {
    const frisch = weltMerker && jetzt - weltMerker.at < WELT_FRISCH && weltMerker.data.players[id];
    if (frisch) return weltMerker.data;
    const entry = await db.getWithMetadata(KEY, { type: 'json', consistency: 'strong' });
    if (!entry) throw new GameError('Betritt zuerst die Spielerwelt.', 409);
    weltMerker = { data: entry.data, at: jetzt };
    return entry.data;
  }
  function sandboxHandler(timestamp) {
    if (!sharedSandbox || timestamp - sharedSandbox.lastUsed >= SANDBOX_IDLE) {
      sharedSandbox = { lastUsed: timestamp, handler: createHandler({ store: volatileStore(), presenceStore: volatileStore(), now, random, sandbox: true }) };
    }
    sharedSandbox.lastUsed = timestamp;
    return sharedSandbox.handler;
  }
  return async function handle(request) {
    if (request.method !== 'POST') return json({ error: 'POST erforderlich.' }, 405);
    try {
      if (Number(request.headers.get('content-length') || 0) > 240000) throw new GameError('Anfrage zu groß.', 413);
      const raw = await request.text(); if (raw.length > 240000) throw new GameError('Anfrage zu groß.', 413);
      let body; try { body = JSON.parse(raw); } catch { throw new GameError('Ungültige Anfrage.'); }
      if (!body || !validCode(body.code)) throw new GameError('Bitte melde dich im Hideout an.', 401);
      if (!['join','world','presence',...ADMIN_OPS,...mutations].includes(body.op)) throw new GameError('Diese Spielaktion wird nicht mehr unterstützt. Lade das Spiel neu.');
      if (mutations.includes(body.op) && (typeof body.requestId !== 'string' || body.requestId.length < 8 || body.requestId.length > 80)) throw new GameError('Aktionskennung fehlt.');
      const id = createHash('sha256').update('gehstockmon-player:' + body.code).digest('hex').slice(0, 24), timestamp = now();
      const bypass = adminBypass(body);
      // Alle Admins teilen sich eine flüchtige Mehrspieler-Testwelt im Arbeitsspeicher.
      // Keine echte Datenbank und keine echte Anwesenheit werden gelesen/geschrieben.
      if(bypass&&!sandbox){
        const isolated=sandboxHandler(timestamp);
        const result=await isolated(new Request(request.url,{method:'POST',body:JSON.stringify(body)})),payload=await result.json();
        return json({...payload,sandbox:true},result.status);
      }
      const verwaltung = ADMIN_OPS.includes(body.op);
      if (verwaltung && roleForCode(body.code) !== 'A') throw new GameError('Das darf nur ein Administrator.', 403);
      if (body.op === 'admin_grant' && !validCode(body.zielCode)) throw new GameError('Diesen Zugangscode gibt es nicht.');
      requireOpen(timestamp, bypass || verwaltung);
      if(body.adminOverride===true&&!bypass)throw new GameError('Die Testzone benötigt ein echtes Admin-Konto und den richtigen Testcode.',403);
      const name = typeof body.name === 'string' ? body.name.trim().replace(/[\u0000-\u001f]/g, '').slice(0, 30) : '';
      const db = store || speicher('hgh-gehstockmon'), draw = random();
      if (body.op === 'presence') {
        /* Anwesenheit liest die Spielerwelt nur, um Namen, Skin, Truppe und
           die Gebietsgrenzen zu kennen - geschrieben wird dort nichts. Das
           war trotzdem der groesste Posten in der Datenbank: das ganze
           Weltdokument, dreissigmal je Minute und Spieler.

           Ein paar Sekunden alt darf es dafuer sein. Eine warme Funktion
           haelt es deshalb kurz fest; erst wenn der Spieler darin fehlt
           (er ist gerade erst beigetreten), wird sofort neu gelesen. */
        const welt=await presenzWelt(db,id,timestamp);
        return await updatePresence(presenceStore||speicher('hgh-gehstockmon-presence'),welt,id,body.position,timestamp,now,bypass);
      }
      const zuletzt = body.op === 'join' ? await eigenerEintrag(presenceStore || speicher('hgh-gehstockmon-presence'), id) : null;
      for (let attempt = 0; attempt < 8; attempt++) {
        const entry = await db.getWithMetadata(KEY, { type: 'json', consistency: 'strong' });
        const world = entry ? clone(entry.data) : initialWorld(timestamp);
        migrateAndSettle(world, timestamp);
        /* Verwaltung laeuft vor allem anderen ab: Der Admin muss die
           Spielerwelt nie selbst betreten haben, um sie zu verwalten. */
        if (body.op === 'admin_log') return json({ serverTime: timestamp, schenkungen: schenkungen(world) });
        if (body.op === 'admin_grant') {
          let bericht;
          try {
            bericht = schenken(world, { code: body.zielCode, name: body.zielName, mons: body.mons || [], gebiete: body.gebiete || [], gold: body.gold || 0, eier: body.eier || 0,
              now: timestamp, wegnehmen: body.wegnehmen === true, quelle: 'Adminmenü', id: body.requestId,
              von: { id, name: name || 'Admin' } });
          } catch (err) { throw new GameError(err.message); }
          if (!bericht.mons.length && !bericht.gebiete.length && !bericht.gold && !bericht.eier) return json({ serverTime: timestamp, bericht, schenkungen: schenkungen(world) });
          const geschrieben = await db.setJSON(KEY, world, entry ? { onlyIfMatch: entry.etag } : { onlyIfNew: true });
          if (geschrieben.modified) return json({ serverTime: timestamp, bericht, schenkungen: schenkungen(world) });
          await pause(attempt);
          continue;
        }
        if (!world.players[id]) {
          if (body.op !== 'join') throw new GameError('Betritt zuerst die Spielerwelt.', 409);
          if (Object.keys(world.players).length >= 110) throw new GameError('Diese Welt ist voll.', 409);
          world.players[id] = { ...D.neuerStand(null, timestamp), name: name || 'Wanderer', lastSeen: timestamp, lastOfflineLoss: 0 };
          if(sandbox){
            /* Alles ausser dem jeweils letzten Mon einer Seltenheit, dazu drei
               Eier in der Tasche. Ein volles Regal war zum Testen unbrauchbar:
               Wer schon alles hat, bekommt aus einem Ei nur noch Gold - Bruten,
               Schluepfen und die Chancenanzeige liessen sich gar nicht
               ausprobieren. Sieben Luecken reichen dafuer und lassen trotzdem
               jede starke Truppe zu. */
            const luecken=D.SELTENHEITEN.map((_,rang)=>D.KATALOG.filter(k=>k.seltenheit===rang).pop()).filter(Boolean).map(k=>k.id);
            world.players[id].besitz=D.KATALOG.map(k=>k.id).filter(mid=>!luecken.includes(mid));
            world.players[id].gold=50000;
            /* Tagwerk und Findelhaus sind sofort voll. Ausserhalb der
               Oeffnungszeiten reift dort nichts nach, und die Testzone
               vergisst sich nach fuenf Minuten - ohne volle Vorraete liessen
               sich beide in der Testzone nie ausprobieren. */
            world.players[id].tagwerkAt=X.schonReif(timestamp,X.TAGWERK_ZEIT,X.TAGWERK_VORRAT);
            world.players[id].findeleiAt=X.schonReif(timestamp,X.FINDELEI_ZEIT,X.FINDELEI_VORRAT);
            /* Zwei davon sind schon durch. Die Testzone vergisst sich nach
               fuenf Minuten Ruhe - eine Stunde Brutzeit abzuwarten geht darin
               gar nicht, und ohne fertiges Ei liesse sich das Schluepfen nie
               ausprobieren. Das dritte bleibt roh, damit auch der Brutplatz
               drankommt. */
            world.players[id].eggs=[1,2,3].map((n)=>({id:'testzone-ei-'+n,territoryId:n,producedAt:timestamp,
              startedAt:n<3?timestamp-E.HATCH_TIME:null,readyAt:n<3?timestamp:null}));
          }
        }
        const p = world.players[id], zuletztDa = p.lastSeen || 0; p.name = name || p.name; p.lastSeen = timestamp;
        /* Beim ersten Kontakt der Woche beginnt die Zerhacker-Uhr. Sie stand
           frueher in weltprojekte und damit hinter dem Schreiben: der Stand
           wurde jedes Mal neu gesetzt und nie abgelegt, der Beutel blieb auf
           null, und der Wochenboss war schlicht unerreichbar. */
        X.zerhackerUhrStellen(p, timestamp);
        if(body.op==='join'){p.dailyDelivery=E.deliverDaily(p);p.lastJoinAt=timestamp;p.spawn=startpunkt(zuletzt,world,id,timestamp);}
        const receipts = p.actionReceipts || [], receipt = receipts.find((r) => r.id === body.requestId && r.op === body.op);
        if (receipt) return json(publicResult(world, id, timestamp, { ...receipt.extra, duplicate: true, adminOverride: bypass }));
        let extra = {joining:body.op==='join'};
        try {
          if(activeArena(p)&&mutations.includes(body.op)&&!['arena_turn','arena_flee'].includes(body.op))throw new GameError('Beende zuerst deinen Mon-Kampf.',409);
          if(activeDuel(p)&&mutations.includes(body.op)&&!['raid_turn','raid_arena','raid_cancel'].includes(body.op))throw new GameError('Beende zuerst deinen Überfall.',409);
          if(activeDungeon(world,p)&&mutations.includes(body.op)&&!X.DUNGEON_OPS.includes(body.op))throw new GameError('Beende zuerst deine Dungeon-Expedition.',409);
          if(p.raidLock?.until>timestamp&&(['arena_start','trainer_start','raid_start','defend'].includes(body.op)||(['hatch','incubate'].includes(body.op)&&body.eggId===p.raidLock.eggId)))throw new GameError('Deine Verteidigung hält gerade einen Überfall ab. Dieses Ei bleibt bis zum Ergebnis reserviert.',409);
          if(X.DUNGEON_OPS.includes(body.op)||body.op==='mon_upgrade')Object.assign(extra,await dungeonAction({world,p,id,body,now:timestamp,presence:presenceStore||speicher('hgh-gehstockmon-presence')}));
          else if(X.STADT_OPS.includes(body.op))Object.assign(extra,await stadtAction({world,p,id,body,now:timestamp,presence:presenceStore||speicher('hgh-gehstockmon-presence')}));
          else if(X.ALLTAG_OPS.includes(body.op))Object.assign(extra,alltagAction({world,p,id,body,now:timestamp}));
          else if(X.OPS.includes(body.op))Object.assign(extra,await adventureAction({world,p,id,body,now:timestamp,draw,presence:presenceStore||speicher('hgh-gehstockmon-presence'),validateSquad}));
          if (body.op === 'arena_start' || body.op === 'defend') {
            if (p.arena && p.arena.phase !== 'finished') throw new GameError('Beende zuerst deinen aktuellen Arenakampf.', 409);
            const fehler = X.truppePruefen(p, body.squad, 'kampfteam');
            if (fehler) throw new GameError(fehler);
            p.truppe = body.squad.slice();
          }
          if (body.op === 'defend') {
            verteidigungenAuffrischen(world, p, id);
            extra.message = 'Dein Kampfteam steht. Außenposten ohne eigene Besatzung halten damit ihre Stellung.';
          }
          if (body.op === 'besatzung_auto') {
            /* Neun Posten von Hand zu besetzen sind sechsunddreissig
               Auswahlen. Hier verteilt das Spiel die freien Mons selbst -
               und laesst alles stehen, was schon gesetzt ist. */
            const meine = world.territories.filter((t) => t.ownerId === id);
            if (!meine.length) throw new GameError('Du hältst noch keinen Außenposten.');
            if (meine.every((t) => X.posten(p, t.id))) throw new GameError('Alle deine Außenposten haben schon eine eigene Besatzung.');
            const plan = X.autoBesetzen(p, meine.map((t) => ({ id: t.id, level: t.level })));
            if (!plan.length) throw new GameError('Für eine Besatzung brauchst du vier Mons.');
            for (const eintrag of plan) p.posten[eintrag.id] = eintrag.squad.slice();
            verteidigungenAuffrischen(world, p, id);
            extra.message = plan.length === 1
              ? D.FELDER[plan[0].id - 1].name + ' hat jetzt eine eigene Besatzung.'
              : plan.length + ' Außenposten haben jetzt eigene Besatzungen.';
          }
          if (body.op === 'besatzung') {
            const t = target(world, body.territoryId);
            if (t.ownerId !== id) throw new GameError('Dieser Außenposten gehört dir nicht.', 403);
            if (body.squad === null) {
              /* Abziehen: das Gebiet faellt auf das Kampfteam zurueck und die
                 vier Mons stehen wieder zur Verfuegung. */
              delete p.posten[t.id];
              extra.message = D.FELDER[t.id - 1].name + ' wird wieder vom Kampfteam gehalten.';
            } else {
              const fehler = X.truppePruefen(p, body.squad, t.id);
              if (fehler) throw new GameError(fehler);
              p.posten[t.id] = body.squad.slice();
              extra.message = D.FELDER[t.id - 1].name + ' hat jetzt eine eigene Besatzung.';
            }
            verteidigungenAuffrischen(world, p, id);
          }
          if (body.op === 'arena_start') {
            const t = target(world, body.territoryId);
            if (t.ownerId === id) throw new GameError('Dieses Gebiet gehört dir bereits.');
            if (t.version !== body.version) throw new GameError('Die Verteidigung hat sich verändert. Aktualisiere die Spielerwelt.', 409);
            if (protectedOwner(world, t, timestamp)) throw new GameError('Abwesenheitsschutz: Dieser Spieler hat bereits ein Gebiet verloren.', 409);
            /* Wer weniger Land haelt als sein Ziel, schlaegt haerter zu. */
            const meine = world.territories.filter((v) => v.ownerId === id).length;
            const seine = t.ownerId ? world.territories.filter((v) => v.ownerId === t.ownerId).length : 0;
            const aussenseiter = X.aussenseiterBonus(meine, seine), rache = X.revancheBonus(p, t, timestamp);
            p.arena = A.create(p.truppe.map(mid=>X.mon(p,mid)), A.defenders(t.id, t.ownerId ? t.defense : null), { id: body.requestId, territoryId: t.id, version: t.version, level: t.level, npcTerritory: !t.ownerId, aussenseiter: aussenseiter + rache, now: timestamp });
            if (rache) { p.arena.revanche = true; extra.revanche = 'Revanche: +' + Math.round(rache * 100) + ' % KP und Angriff gegen ' + t.ownerName + '.'; }
            if (aussenseiter) extra.message = 'Außenseiterhilfe: +' + Math.round(aussenseiter * 100) + ' % KP und Angriff, weil ' + t.ownerName + ' mehr Gebiete hält als du.';
            if (extra.revanche) extra.message = extra.revanche + (extra.message ? ' ' + extra.message : '');
          }
          if (body.op === 'arena_turn' || body.op === 'arena_flee') {
            const b = p.arena;
            if (!b || b.id !== body.battleId || b.revision !== body.revision || b.phase === 'finished') throw new GameError('Der Kampfstand hat sich verändert. Rufe den aktuellen Stand ab.', 409);
            if (!body.action || typeof body.action !== 'object') { if (body.op === 'arena_turn') throw new GameError('Wähle eine Attacke oder ein Mon.'); }
            p.arena = body.op === 'arena_flee' ? A.flee(b) : A.turn(b, body.action);
            p.arena.lastActionAt = timestamp; settleBattle(world, p, id, timestamp, body.requestId);
          }
          if (body.op === 'plan') {
            const mon = D.mon(body.monId);
            if (!mon || !p.besitz.includes(mon.id)) throw new GameError('Wähle ein Mon aus deiner Sammlung.');
            if (!A.planGueltig(body.plan)) throw new GameError('Dieser Kampfplan ist nicht gültig.');
            p.plaene = p.plaene || {}; p.plaene[mon.id] = body.plan.map((z) => z.slice(0, 2));
            /* Der Plan gilt sofort auf jedem Aussenposten, auf dem das Mon steht. */
            verteidigungenAuffrischen(world, p, id);
            extra.monId = mon.id;
            extra.message = mon.name + ' kämpft jetzt nach deinem Plan - auch wenn du offline bist.';
          }
          if (body.op === 'collect' || body.op === 'upgrade') {
            const t = target(world, body.territoryId);
            if (t.ownerId !== id) throw new GameError('Dieser Außenposten gehört dir nicht.', 403);
            if (body.op === 'collect') extra.message = E.collect(p,t,t.id,timestamp) + ' Ei(er) in deiner Bruttasche.';
            else { E.upgrade(p,t,timestamp); p.progress.upgrades++;t.version++; extra.message = E.LEVELS[t.level].name + ' fertig: mehr Einkommen und stärkere Verteidigung.'; }
          }
          if (body.op === 'incubate') { E.incubate(p,body.eggId,timestamp,X.brutplaetze(world.leuchtturm,p)); extra.message = 'Die Brutzeit hat begonnen: 1 Stunde.'; }
          if (body.op === 'hatch') {
            /* Seltenheit, Mon, Schimmer und Wesen sind vier eigene Ziehungen.
               Frueher bestimmte eine einzige Zahl Mon und Wesen zugleich, und
               dasselbe Mon kam damit fast immer mit demselben Wesen. */
            const schlupf = E.hatch(p,body.eggId,timestamp,random), mon = schlupf.mon;
            p.progress.hatched++; wochenschritt(world, p, id, 'eier', timestamp); fehdeSchritt(world, id, 'ei', timestamp); X.alltagSchritt(p, 'ei', timestamp);
            X.wesenZuweisen(p, mon.id, random()); extra.monId = mon.id;
            extra.schlupf = { monId: mon.id, neu: schlupf.neu, stufe: schlupf.stufe, runen: schlupf.runen, rang: schlupf.rang,
              garantiert: schlupf.garantiert, schimmernd: schlupf.schimmernd, schimmerNeu: schlupf.schimmerNeu };
            /* Ein Zwilling ist kein Trostpreis: entweder hebt er die Runenstufe
               des Mons, das schon da ist, oder er zerfaellt zu Runen. */
            extra.message = (schlupf.schimmerNeu ? '✨ Schimmernd! ' : '') + (schlupf.neu
              ? mon.name + ' ist geschlüpft' + (X.wesenVon(p, mon.id) ? ' - ein ' + X.wesenVon(p, mon.id).name + 'es Wesen!' : '!')
              : schlupf.runen
                ? 'Ein zweiter ' + mon.name + '! Er steht schon auf Runenstufe 5 - sein Zwilling zerfällt zu ' + schlupf.runen + ' ' + D.SELTENHEITEN[mon.seltenheit].name + '-Runen.'
                : 'Ein zweiter ' + mon.name + '! Beide werden eins: Runenstufe ' + schlupf.stufe + '/' + X.UPGRADE_LIMIT + ', jetzt +' + Math.round(schlupf.stufe * A.UPGRADE_BONUS * 100) + ' % KP und Angriff.');
            /* Steht das Mon in einer Verteidigung, kaempft es dort sofort mit
               der neuen Stufe - sonst haette der Zwilling auf dem eigenen Land
               keine Wirkung. */
            if (!schlupf.neu && (schlupf.stufe || schlupf.schimmerNeu)) verteidigungenAuffrischen(world, p, id);
            /* Was selten ist, erfahren alle: ab Episch, und jeder Schimmer. */
            if (schlupf.rang >= 3 || schlupf.schimmernd) {
              const zeichen = ['', '', '', '💜', '🌟', '💠', '☄️'][schlupf.rang] || '🎉';
              tickern(world, (schlupf.schimmernd ? '✨' : zeichen) + ' ' + p.name + ' hat ' + (schlupf.schimmernd ? 'einen schimmernden ' : '') + mon.name
                + ' ausgebrütet (' + D.SELTENHEITEN[schlupf.rang].name + (schlupf.garantiert ? ', Garantie' : '') + ')', 'schlupf', timestamp, id);
            }
          }
          deliverRewards(p,timestamp); X.sonderEierLiefern(p);
          const weekendEggs = activeArena(p)||activeDuel(p)?0:E.deliverWeekend(p, timestamp);
          if (weekendEggs) extra.weekendDelivery = weekendEggs;
          /* Wer nach mehr als zwanzig Minuten zurueckkommt, bekommt den
             Morgenbericht: was seit dem letzten Besuch passiert ist. */
          if (body.op === 'join' && zuletztDa && timestamp - zuletztDa > 20 * 60000) {
            const bericht = morgenbericht(world, p, id, zuletztDa, timestamp, { tagesgold: p.dailyDelivery || 0, wochenende: weekendEggs || 0 });
            if (bericht) extra.morgenbericht = bericht;
          }
        } catch (err) { if (err instanceof GameError) throw err; throw new GameError(err.message); }
        if (mutations.includes(body.op)) p.actionReceipts = receipts.concat({ id: body.requestId, op: body.op, extra }).slice(-40);
        if (body.op === 'world' && entry && nurUhrGestellt(entry.data, world, id, timestamp)) return json(publicResult(world, id, timestamp, { ...extra, adminOverride: bypass }));
        world.version++;
        requireOpen(now(), bypass);
        const write = await db.setJSON(KEY, world, entry ? { onlyIfMatch: entry.etag } : { onlyIfNew: true });
        if (write.modified) return json(publicResult(world, id, timestamp, { ...extra, adminOverride: bypass }));
        await pause(attempt);
      }
      throw new GameError('Die Welt wird gerade verändert. Bitte versuche es erneut.', 409);
    } catch (err) {
      if (err instanceof GameError) return json({ error: err.message, ...(err.access ? { access: err.access, serverTime: err.access.serverTime } : {}) }, err.status);
      console.error('GehstockMon storage failure:', err.message); return json({ error: 'Die Spielerwelt ist vorübergehend nicht erreichbar.' }, 503);
    }
  };
}
export default createHandler();
