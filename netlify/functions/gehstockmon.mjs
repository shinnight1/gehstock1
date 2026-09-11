import { getStore } from '@netlify/blobs';
import { createHash } from 'node:crypto';
import { data as D, economy as E, arena as A, hours as H } from './lib/gehstockmon-rules.mjs';

const KEY = 'world-v2';
const clone = (value) => JSON.parse(JSON.stringify(value));
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
const mutations = ['arena_start', 'arena_turn', 'arena_flee', 'collect', 'incubate', 'hatch', 'upgrade', 'defend'];
class GameError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
function requireOpen(timestamp) {
  const access = H.access(timestamp);
  if (!access.open) { const error = new GameError('GehstockMon ist gerade geschlossen.', 423); error.access = access; throw error; }
  return access;
}
function validCode(value) {
  if (typeof value !== 'string' || !/^\d{4}$/.test(value)) return false;
  const text = 'code:' + value + ':gehstock:hideout:2026:kellergewoelbe'; let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0; }
  return h % 97 === 0;
}
function initialWorld(now) {
  return { version: 1, mapVersion: D.MAP_VERSION, players: {}, reports: [], territories: D.FELDER.map((f) => ({ id: f.id, ownerId: null,
    ownerName: ['Wilder Clan','Flusswächter','Aschenclan','Nebelwache','Die Krone'][(f.id - 1) % 5],
    defense: A.defenders(f.id).map((k) => ({ id: k.id })), version: 1, ...E.outpost(null, now) })) };
}
function migrateMap(world, now) {
  if (world.mapVersion === D.MAP_VERSION) return;
  const old = clone(world.territories), biomeId = (id) => (id - 1) % 5 + 1;
  world.previousMap = { changedAt: now, territories: clone(old) };
  for (const p of Object.values(world.players)) {
    for (const egg of p.eggs || []) if (Number.isInteger(egg.territoryId) && egg.territoryId > 0) egg.territoryId = biomeId(egg.territoryId);
    Object.assign(p, D.neuerStand(p, now));
    if (p.arena && p.arena.phase !== 'finished') {
      p.arena = A.flee(p.arena); p.arena.winner = 'map_changed'; p.arena.settled = true;
      p.arena.message = 'Die Insel hat jetzt fünf Biomgebiete. Wähle ein Gebiet auf der neuen Karte.';
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
  return { playerId: id, serverTime: now, access: H.access(now), mapVersion: world.mapVersion, profile: D.neuerStand(p, now), arena: p.arena || null,
    territories: world.territories.map((t) => ({ id: t.id, ownerId: t.ownerId, ownerName: world.players[t.ownerId]?.name || t.ownerName, version: t.version, level: t.level,
      defense: A.defenders(t.id, t.ownerId ? t.defense : null).map((k) => ({ id: k.id, name: k.name })),
      eggStock: t.ownerId === id ? t.eggStock : 0, eggAt: t.ownerId === id ? t.eggAt : null })),
    reports: world.reports.filter((r) => r.attackerId === id || r.defenderId === id).slice(-20), ...extra };
}

// Anwesenheit ist kurzlebig und unabhängig von Gold, Eiern und Kampfaktionen.
async function updatePresence(db, world, id, position, timestamp, clock) {
  const p = world.players[id];
  if (!p) throw new GameError('Betritt zuerst die Spielerwelt.',409);
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.z) || !Number.isFinite(position.heading)
      || Math.hypot(position.x/123,position.z/115)>1.01 || Math.abs(position.heading)>Math.PI+0.01) throw new GameError('Ungültige Kartenposition.');
  for (let attempt=0;attempt<8;attempt++) {
    const entry=await db.getWithMetadata('presence-v1',{type:'json',consistency:'strong'});
    const players=Object.fromEntries(Object.entries(entry?.data.players||{}).filter(([pid,v])=>world.players[pid]&&timestamp-v.updatedAt<15000));
    if (!players[id] || players[id].updatedAt<=timestamp) players[id] = { id, name:p.name, x:Math.round(position.x*100)/100, z:Math.round(position.z*100)/100,
      heading:position.heading, activity:p.arena&&p.arena.phase!=='finished'&&timestamp-p.arena.lastActionAt<20*60000?'arena':'map', updatedAt:timestamp };
    requireOpen(clock());
    const result=await db.setJSON('presence-v1',{players},entry?{onlyIfMatch:entry.etag}:{onlyIfNew:true});
    if(result.modified)return json({serverTime:timestamp,access:H.access(timestamp),peers:Object.values(players).filter(v=>v.id!==id)});
  }
  throw new GameError('Die Mitspieler werden gerade aktualisiert.',409);
}
function settleBattle(world, p, id, now, requestId) {
  const b = p.arena; if (b.phase !== 'finished' || b.settled) return;
  b.settled = true; const t = target(world, b.territoryId), defenderId = t.ownerId;
  if (b.winner === 'wir') {
    if (t.version !== b.territoryVersion || t.ownerId === id || protectedOwner(world, t, now)) {
      b.winner = 'stale'; b.message = 'Das Gebiet hat sich während des Kampfes verändert. Kläre es erneut auf; dieser Kampf kostet kein Gold.';
    } else {
      const defender = defenderId && world.players[defenderId];
      if (defender && now - defender.lastSeen >= 12 * E.HOUR) defender.lastOfflineLoss = now;
      const level = t.level; E.capture(p, t.id, now);
      Object.assign(t, E.outpost(null, now), { level, ownerId: id, ownerName: p.name, defense: p.truppe.map((mid) => ({ id: mid })), version: t.version + 1 });
      b.message = 'Gebiet erobert! +40 Gold. Dein Außenposten produziert jetzt Gold und alle 2 Stunden ein Ei.';
    }
  } else b.message = b.winner === 'fled' ? 'Zurückgezogen. Das Gebiet bleibt beim Verteidiger.' : 'Deine Truppe ist zurück im Lager. Versuche andere Attacken oder eine andere Aufstellung.';
  world.reports.push({ id: requestId, time: now, attackerId: id, defenderId, territoryId: t.id, winner: b.winner,
    text: p.name + (b.winner === 'wir' ? ' erobert ' : b.winner === 'fled' ? ' verlässt ' : ' scheitert an ') + D.FELDER[t.id - 1].name });
  world.reports = world.reports.slice(-150);
}

/* Each turn, egg and upgrade is authoritative and atomically persisted. */
export function createHandler({ store, presenceStore, now = Date.now, random = Math.random } = {}) {
  return async function handle(request) {
    if (request.method !== 'POST') return json({ error: 'POST erforderlich.' }, 405);
    try {
      if (Number(request.headers.get('content-length') || 0) > 24000) throw new GameError('Anfrage zu groß.', 413);
      const raw = await request.text(); if (raw.length > 24000) throw new GameError('Anfrage zu groß.', 413);
      let body; try { body = JSON.parse(raw); } catch { throw new GameError('Ungültige Anfrage.'); }
      if (!body || !validCode(body.code)) throw new GameError('Bitte melde dich im Hideout an.', 401);
      if (!['join','world','presence',...mutations].includes(body.op)) throw new GameError('Diese Spielaktion wird nicht mehr unterstützt. Lade das Spiel neu.');
      if (mutations.includes(body.op) && (typeof body.requestId !== 'string' || body.requestId.length < 8 || body.requestId.length > 80)) throw new GameError('Aktionskennung fehlt.');
      const id = createHash('sha256').update('gehstockmon-player:' + body.code).digest('hex').slice(0, 24), timestamp = now();
      requireOpen(timestamp);
      const name = typeof body.name === 'string' ? body.name.trim().replace(/[\u0000-\u001f]/g, '').slice(0, 30) : '';
      const db = store || getStore({ name: 'hgh-gehstockmon', consistency: 'strong' }), draw = random();
      if (body.op === 'presence') {
        const entry=await db.getWithMetadata(KEY,{type:'json',consistency:'strong'});
        if(!entry)throw new GameError('Betritt zuerst die Spielerwelt.',409);
        return await updatePresence(presenceStore||getStore({name:'hgh-gehstockmon-presence',consistency:'strong'}),entry.data,id,body.position,timestamp,now);
      }
      for (let attempt = 0; attempt < 8; attempt++) {
        const entry = await db.getWithMetadata(KEY, { type: 'json', consistency: 'strong' });
        const world = entry ? clone(entry.data) : initialWorld(timestamp);
        migrateAndSettle(world, timestamp);
        if (!world.players[id]) {
          if (body.op !== 'join') throw new GameError('Betritt zuerst die Spielerwelt.', 409);
          if (Object.keys(world.players).length >= 110) throw new GameError('Diese Welt ist voll.', 409);
          world.players[id] = { ...D.neuerStand(null, timestamp), name: name || 'Wanderer', lastSeen: timestamp, lastOfflineLoss: 0 };
        }
        const p = world.players[id]; p.name = name || p.name; p.lastSeen = timestamp;
        const receipts = p.actionReceipts || [], receipt = receipts.find((r) => r.id === body.requestId && r.op === body.op);
        if (receipt) return json(publicResult(world, id, timestamp, { ...receipt.extra, duplicate: true }));
        let extra = {};
        try {
          if (body.op === 'arena_start' || body.op === 'defend') {
            if (p.arena && p.arena.phase !== 'finished') throw new GameError('Beende zuerst deinen aktuellen Arenakampf.', 409);
            p.truppe = validateSquad(p, body.squad);
          }
          if (body.op === 'defend') {
            for (const t of world.territories) if (t.ownerId === id) { t.defense = p.truppe.map((mid) => ({ id: mid })); t.ownerName = p.name; t.version++; }
            extra.message = 'Deine Truppe verteidigt jetzt alle deine Außenposten.';
          }
          if (body.op === 'arena_start') {
            const t = target(world, body.territoryId);
            if (t.ownerId === id) throw new GameError('Dieses Gebiet gehört dir bereits.');
            if (t.version !== body.version) throw new GameError('Die Verteidigung hat sich verändert. Aktualisiere die Spielerwelt.', 409);
            if (protectedOwner(world, t, timestamp)) throw new GameError('Abwesenheitsschutz: Dieser Spieler hat bereits ein Gebiet verloren.', 409);
            p.arena = A.create(p.truppe.map(D.mon), A.defenders(t.id, t.ownerId ? t.defense : null), { id: body.requestId, territoryId: t.id, version: t.version, level: t.level, now: timestamp });
          }
          if (body.op === 'arena_turn' || body.op === 'arena_flee') {
            const b = p.arena;
            if (!b || b.id !== body.battleId || b.revision !== body.revision || b.phase === 'finished') throw new GameError('Der Kampfstand hat sich verändert. Rufe den aktuellen Stand ab.', 409);
            if (!body.action || typeof body.action !== 'object') { if (body.op === 'arena_turn') throw new GameError('Wähle eine Attacke oder ein Mon.'); }
            p.arena = body.op === 'arena_flee' ? A.flee(b) : A.turn(b, body.action);
            p.arena.lastActionAt = timestamp; settleBattle(world, p, id, timestamp, body.requestId);
          }
          if (body.op === 'collect' || body.op === 'upgrade') {
            const t = target(world, body.territoryId);
            if (t.ownerId !== id) throw new GameError('Dieser Außenposten gehört dir nicht.', 403);
            if (body.op === 'collect') extra.message = E.collect(p,t,t.id,timestamp) + ' Ei(er) in deiner Bruttasche.';
            else { E.upgrade(p,t,timestamp); t.version++; extra.message = E.LEVELS[t.level].name + ' fertig: mehr Einkommen und stärkere Verteidigung.'; }
          }
          if (body.op === 'incubate') { E.incubate(p,body.eggId,timestamp); extra.message = 'Die Brutzeit hat begonnen: 1 Stunde.'; }
          if (body.op === 'hatch') { const mon = E.hatch(p,body.eggId,timestamp,draw); extra.monId = mon && mon.id; extra.message = mon ? mon.name + ' ist geschlüpft!' : 'Sammlung vollständig! Das Ei bringt dir 75 Gold.'; }
          const weekendEggs = E.deliverWeekend(p, timestamp);
          if (weekendEggs) extra.weekendDelivery = weekendEggs;
        } catch (err) { if (err instanceof GameError) throw err; throw new GameError(err.message); }
        if (mutations.includes(body.op)) p.actionReceipts = receipts.concat({ id: body.requestId, op: body.op, extra }).slice(-40);
        world.version++;
        requireOpen(now());
        const write = await db.setJSON(KEY, world, entry ? { onlyIfMatch: entry.etag } : { onlyIfNew: true });
        if (write.modified) return json(publicResult(world, id, timestamp, extra));
      }
      throw new GameError('Die Welt wird gerade verändert. Bitte versuche es erneut.', 409);
    } catch (err) {
      if (err instanceof GameError) return json({ error: err.message, ...(err.access ? { access: err.access, serverTime: err.access.serverTime } : {}) }, err.status);
      console.error('GehstockMon storage failure:', err.message); return json({ error: 'Die Spielerwelt ist vorübergehend nicht erreichbar.' }, 503);
    }
  };
}
export default createHandler();
