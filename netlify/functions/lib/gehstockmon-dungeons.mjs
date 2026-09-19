import {data as D, arena as A, adventure as X} from './gehstockmon-rules.mjs';
import {wochenschritt, fehdeSchritt} from './gehstockmon-adventure.mjs';

const fail = message => { throw new Error(message); };
export const activeDungeon = (world, p) => {
  const room=world.dungeons?.[p.dungeonId];
  return !!room&&['lobby','battle'].includes(room.phase)&&room.players.some(m=>world.players[m.id]===p&&!m.left);
};
const living = room => room.players.filter(p => !p.left && p.hp > 0);

function finish(world, room, winner, now) {
  if (room.phase === 'finished') return;
  room.phase = 'finished'; room.winner = winner; room.finishedAt = now;
  const dungeon = X.DUNGEONS.find(d => d.id === room.dungeonId);
  for (const member of room.players) {
    member.reward = winner === 'players' && !member.left && member.contributions > 0 ? dungeon.reward : 0;
    const p = world.players[member.id];
    if (p && member.reward) {
      p.runes[dungeon.rarity] = Math.min(9999, p.runes[dungeon.rarity] + member.reward);
      wochenschritt(world, p, member.id, 'tiefe', now);
      fehdeSchritt(world, member.id, 'tiefe', now);
      /* Wer einen Boss zum ersten Mal legt, nimmt sein Fundstueck mit. */
      const fund = X.ruestungFuer(dungeon.id);
      if (fund && !(p.ruestungen || []).includes(fund.id)) {
        p.ruestungen = (p.ruestungen || []).concat(fund.id);
        if (!p.panzer) p.panzer = fund.id;
        member.fund = fund.name;
      }
    }
  }
  room.message = winner === 'players' ? 'Boss besiegt! Eure Runen wurden gutgeschrieben.' : winner === 'expired' ? 'Die Expedition ist abgelaufen. Es gibt keine Runen.' : 'Die Gruppe zieht sich zurück. Eure Mons erholen sich vollständig.';
  room.revision++;
}

/* Die Faehigkeit eines Mons, uebersetzt auf den Gruppenkampf gegen einen Boss.
   Vorher gab es hier fuer alle dieselbe Heilung, und die zwoelf Faehigkeiten
   aus der Arena galten im Dungeon nicht - man lernte ein System und traf im
   Dungeon ein anderes. Was sich nicht eins zu eins uebersetzen laesst, weil
   ein Boss keine Ladungen und keine Deckung hat, wird zum naechstliegenden
   Effekt: Blendstoss daempft seinen naechsten Schlag, Windschnitt geht durch
   seine Haerte. */
function faehigkeitEinsetzen(room, member, log) {
  const f = A.FAEHIGKEITEN[member.role][member.skill || 0] || A.FAEHIGKEITEN[member.role][0];
  const treffer = (faktor, name) => {
    const roh = member.attack * faktor * A.rollenFaktor(member.role, room.boss.role);
    const n = Math.max(1, Math.round(roh));
    room.boss.hp = Math.max(0, room.boss.hp - n);
    log.push(member.name + ': ' + name + ' trifft für ' + n + ' Schaden.');
    return n;
  };
  const heilen = (anteil) => {
    const n = Math.min(member.maxHp - member.hp, Math.round(member.maxHp * anteil));
    if (n > 0) { member.hp += n; log.push(member.name + ': ' + f.name + ' heilt ' + n + ' KP.'); }
    else log.push(member.name + ' setzt ' + f.name + ' ein.');
  };
  if (f.id === 'schildstoss') { treffer(f.faktor, f.name); member.schild = .35; }
  else if (f.id === 'steinwall') { member.schild = .75; heilen(.1); }
  else if (f.id === 'dornenpanzer') { treffer(f.faktor, f.name); member.dornen = true; }
  else if (f.id === 'sichelstreich') { treffer(room.boss.hp <= room.boss.maxHp * .35 ? 1.9 : f.faktor, f.name); }
  else if (f.id === 'doppelhieb') { treffer(f.faktor, f.name); if (room.boss.hp > 0) treffer(f.faktor, f.name + ' (zweiter Hieb)'); }
  else if (f.id === 'aderlass') { const n = treffer(f.faktor, f.name); const zurueck = Math.min(member.maxHp - member.hp, Math.round(n * .45)); if (zurueck > 0) { member.hp += zurueck; log.push(member.name + ' saugt ' + zurueck + ' KP heraus.'); } }
  else if (f.id === 'lebensquell') heilen(.32);
  else if (f.id === 'sammelruf') { heilen(.18); member.schild = .35; }
  else if (f.id === 'laeuterung') { heilen(.22); member.geschaerft = true; }
  else if (f.id === 'runenstoerung') { treffer(f.faktor, f.name); room.boss.geschwaecht = true; }
  /* Ein Boss hat keine Ladungen, die Blendstoss ihm nehmen koennte. Beide auf
     dieselbe einrundige Schwaechung zu legen machte ihn aber zur strikt
     schlechteren Runenstoerung - gleicher Effekt, weniger Schaden. Er blendet
     darum laenger: zwei Runden statt einer. */
  else if (f.id === 'blendstoss') { treffer(f.faktor, f.name); room.boss.blendung = 2; }
  else if (f.id === 'windschnitt') { treffer(f.faktor * 1.15, f.name); }
  else treffer(f.faktor, f.name);
}
function resolveRound(world, room, now) {
  const team = living(room), log = [];
  for (const member of team) {
    const move = room.actions[member.id] || 'guard';
    if (!room.actions[member.id]) member.missed++; else { member.missed = 0; member.contributions++; }
    if (member.missed >= 3) { member.left = true; log.push(member.name + ' hat die Verbindung verloren.'); continue; }
    member.guarding = move === 'guard';
    if (move === 'guard') member.schild = 0;
    if (move === 'heal') { member.heals--; faehigkeitEinsetzen(room, member, log); }
    else if (move !== 'guard') {
      let roh = member.attack * (move === 'power' ? 1.55 : 1) * A.rollenFaktor(member.role, room.boss.role);
      if (member.geschaerft) { roh *= 1.3; member.geschaerft = false; }
      const damage = Math.max(1, Math.round(roh));
      if (move === 'power') member.powerReady = room.round + (member.powerPause || A.POWER_PAUSE);
      room.boss.hp = Math.max(0, room.boss.hp - damage); log.push(member.name + ': ' + damage + ' Schaden.');
    }
  }
  room.log = log;
  if (room.boss.hp <= 0) { finish(world, room, 'players', now); return; }
  const survivors=living(room), targets=room.round%3===0?survivors:[survivors.find(m=>m.id===room.targetId)||survivors[0]].filter(Boolean);
  for (const member of targets) {
    let roh = room.boss.attack * (room.round % 3 === 0 ? 1.35 : 1) * (member.guarding ? .4 : 1);
    roh *= A.rollenFaktor(room.boss.role, member.role);
    if (room.boss.geschwaecht || room.boss.blendung > 0) roh *= .65;
    /* Ein Schild aus der eigenen Faehigkeit haelt genau einen Schlag. */
    if (member.schild) { roh *= 1 - member.schild; member.schild = 0; }
    const hit = Math.max(1, Math.round(roh));
    member.hp = Math.max(0, member.hp - hit);
    room.log.push(member.name + ' erleidet ' + hit + ' Schaden.');
    if (member.dornen && member.hp > 0) {
      member.dornen = false;
      const zurueck = Math.max(1, Math.round(hit * .4));
      room.boss.hp = Math.max(0, room.boss.hp - zurueck);
      room.log.push(member.name + ': Dornenpanzer wirft ' + zurueck + ' Schaden zurück.');
    }
  }
  room.boss.geschwaecht = false;
  if (room.boss.blendung > 0) room.boss.blendung--;
  if (room.boss.hp <= 0) { finish(world, room, 'players', now); return; }
  if (!living(room).length || room.round >= 30) { finish(world, room, 'boss', now); return; }
  room.round++; room.revision++; room.actions = {}; room.deadline = now + 45000;
  const next=living(room)[(room.round-1)%living(room).length];room.targetId=next.id;
  room.message = room.round % 3 === 0 ? 'Der Boss lädt einen schweren Angriff auf alle auf. Deckung kann helfen!' : 'Der Boss nimmt '+next.name+' ins Visier. Wählt eure Aktionen gemeinsam.';
}

export function settleDungeons(world, now) {
  world.dungeons ||= {};
  for (const [key, room] of Object.entries(world.dungeons)) {
    if (room.phase === 'finished') { if (now - room.finishedAt > 3600000) delete world.dungeons[key]; continue; }
    if (now >= room.expiresAt) { finish(world, room, 'expired', now); continue; }
    if (room.phase === 'battle' && now >= room.deadline) resolveRound(world, room, now);
  }
}

export function dungeonResult(world, p) {
  const room=world.dungeons?.[p.dungeonId],member=room?.players.find(m=>world.players[m.id]===p);
  return {
    dungeon: member?.left?{...room,phase:'finished',winner:'left',message:'Du hast drei Runden verpasst und die Expedition verlassen. Deine Mons sind wieder erholt.'}:room||null,
    dungeonLobbies: Object.values(world.dungeons || {}).filter(r => r.phase === 'lobby').map(r => ({id:r.id, dungeonId:r.dungeonId, leaderName:r.players.find(m => m.id === r.leaderId)?.name, count:r.players.length, expiresAt:r.expiresAt}))
  };
}

export async function dungeonAction({world, p, id, body, now, presence}) {
  const op = body.op;
  if (op === 'mon_upgrade') {
    if (p.raidLock?.until > now) fail('Deine Mons verteidigen gerade einen Überfall.');
    const mon = D.mon(body.monId);
    if (!mon || !p.besitz.includes(mon.id)) fail('Wähle ein Mon aus deiner Sammlung.');
    const level = X.upgradeLevel(p.monUpgrades[mon.id]);
    if (body.level !== level) fail('Der Runenstand hat sich verändert. Aktualisiere deine Sammlung.');
    if (level >= X.UPGRADE_LIMIT) fail('Dieses Mon hat die maximale Runenstufe erreicht.');
    const cost = level + 1;
    if (p.runes[mon.seltenheit] < cost) fail('Du brauchst mehr Runen derselben Seltenheit.');
    p.runes[mon.seltenheit] -= cost; p.monUpgrades[mon.id] = level + 1;
    for (const t of world.territories) if (t.ownerId === id && t.defense.some(m => m.id === mon.id)) { t.defense.forEach(m => { if (m.id === mon.id) m.upgrade = level + 1; }); t.version++; }
    /* Die Prozente kommen aus A.UPGRADE_BONUS. Hier stand eine eigene Zwei,
       die seit dem Rebalance auf drei Prozent nicht mehr gestimmt hat. */
    const schwelle = level + 1 === A.SCHNELL_AB ? ' Ab jetzt lädt der Kraftschlag eine Runde schneller.'
      : level + 1 === A.LADUNG_AB ? ' Ab jetzt hat die Fähigkeit eine dritte Ladung.' : '';
    return {monId:mon.id, message:mon.name + ' erreicht Runenstufe ' + (level + 1) + '/' + X.UPGRADE_LIMIT
      + '. KP und Angriff: +' + Math.round((level + 1) * A.UPGRADE_BONUS * 100) + ' %.' + schwelle};
  }
  let room = world.dungeons?.[p.dungeonId];
  async function nearby(dungeon) {
    const entry = await presence.getWithMetadata('presence-v1', {type:'json',consistency:'strong'}), at = entry?.data?.players?.[id];
    if (!at || now - at.updatedAt >= 15000 || at.spawnAt !== p.lastJoinAt) fail('Warte auf eine aktuelle Kartenposition.');
    if (Math.hypot(at.x - dungeon.x, at.z - dungeon.z) > 8) fail('Laufe zuerst zum Dungeon-Eingang.');
  }
  function member(monId) {
    if (!p.besitz.includes(monId) || !D.mon(monId)) fail('Wähle ein eigenes Mon für die Expedition.');
    const mon = X.mon(p,monId), stats = A.stats(mon);
    /* Rolle, Faehigkeit und Runenwerte kommen aus derselben Quelle wie in der
       Arena - sonst kaempft dasselbe Mon hier anders als dort. */
    return {id, name:p.name, monId, upgrade:mon.upgrade, role:mon.typ, skill:D.faehigkeitVon(mon),
      maxHp:stats.hp, hp:stats.hp, attack:stats.ang, ready:false, powerReady:1,
      powerPause:A.powerPause(mon), heals:A.ladungen(mon), maxHeals:A.ladungen(mon),
      schild:0, dornen:false, geschaerft:false,
      contributions:0, missed:0};
  }
  if (op === 'dungeon_create' || op === 'dungeon_join') {
    if (activeDungeon(world,p) || p.raidLock?.until > now) fail('Beende zuerst deine aktuelle Expedition oder Verteidigung.');
    let dungeon;
    if (op === 'dungeon_create') dungeon = X.DUNGEONS.find(d => d.id === body.dungeonId);
    else { room = world.dungeons?.[body.roomId]; dungeon = X.DUNGEONS.find(d => d.id === room?.dungeonId); if (!room || room.phase !== 'lobby' || room.players.length >= 4 || room.players.some(m => m.id === id)) fail('Diese Gruppe ist nicht mehr verfügbar.'); }
    if (!dungeon) fail('Diesen Dungeon gibt es nicht.');
    await nearby(dungeon);
    const entrant = member(body.monId);
    if (op === 'dungeon_create') {
      const roomId = id + '-' + body.requestId;
      if (world.dungeons[roomId]) fail('Diese Expedition wurde schon erstellt.');
      room = {id:roomId, dungeonId:dungeon.id, leaderId:id, phase:'lobby', players:[], actions:{}, revision:0, createdAt:now, expiresAt:now+300000, message:'Wählt je ein Mon und macht euch bereit. Bis zu vier Spieler können teilnehmen.'};
      world.dungeons[roomId] = room;
    }
    room.players.push(entrant); room.revision++; p.dungeonId = room.id;
    return {message:'Du bist in der Dungeon-Gruppe. Andere Spieler können am Eingang beitreten.'};
  }
  if (!room || room.id !== body.roomId || !activeDungeon(world,p)) fail('Rufe deine aktuelle Expedition ab.');
  const me = room.players.find(m => m.id === id && !m.left);
  if (!me) fail('Du gehörst nicht mehr zu dieser Expedition.');
  if (op === 'dungeon_leave') {
    if (room.phase === 'lobby') {
      room.players = room.players.filter(m => m.id !== id);
      if (room.leaderId === id) room.leaderId = room.players[0]?.id;
      if (!room.players.length) finish(world,room,'boss',now);
    } else {
      me.left = true; delete room.actions[id];
      if (!living(room).length) finish(world,room,'boss',now);
      else if (living(room).every(m => room.actions[m.id])) resolveRound(world,room,now);
    }
    delete p.dungeonId; room.revision++; return {message:'Du hast die Expedition verlassen.'};
  }
  if (op === 'dungeon_ready') {
    if (room.phase !== 'lobby') fail('Die Expedition läuft bereits.');
    Object.assign(me,member(body.monId),{ready:body.ready === true}); room.revision++;
  }
  if (op === 'dungeon_start') {
    if (room.phase !== 'lobby' || room.leaderId !== id || !room.players.every(m => m.ready)) fail('Nur die Gruppenleitung kann starten, wenn alle bereit sind.');
    const dungeon = X.DUNGEONS.find(d => d.id === room.dungeonId), boss = D.mon(dungeon.bossId), stats = A.stats({...boss,seltenheit:dungeon.rarity});
    const hp = Math.round(stats.hp * (2.2 + (room.players.length - 1) * 1.7));
    /* Der Boss traegt seine Rolle mit: damit gilt das Rollen-Dreieck auch hier,
       und wer die richtige Truppe mitbringt, merkt es. */
    room.boss = {monId:boss.id,name:boss.name,role:boss.typ,maxHp:hp,hp,attack:Math.round(stats.ang * (.55 + dungeon.rarity * .1)),geschwaecht:false};
    room.phase = 'battle'; room.round = 1; room.deadline = now + 45000; room.expiresAt = now + 1200000; room.revision++;
    room.targetId=room.players[0].id;
    room.message = 'Gemeinsam gegen ' + boss.name + '! Ziel: '+room.players[0].name+'. Jede dritte Runde trifft der Boss alle stärker.';
  }
  if (op === 'dungeon_turn') {
    if (room.phase !== 'battle' || body.round !== room.round || me.hp <= 0 || room.actions[id]) fail('Die Runde hat sich verändert oder deine Aktion steht bereits fest.');
    if (!['strike','power','guard','heal'].includes(body.move)) fail('Wähle eine Dungeon-Aktion.');
    /* Die Faehigkeit haengt an ihren Ladungen, nicht am eigenen Schaden. Die
       alte Sperre stammte aus der Zeit, als sie fuer alle dasselbe geheilt
       hat: seit die zwoelf Faehigkeiten auch hier gelten, war damit jede
       Schadensfaehigkeit bis zum ersten Treffer gesperrt - und in Runde 1 ist
       jeder auf vollem Leben. Nur eine reine Heilung verpufft dann wirklich. */
    if (body.move === 'power' && room.round < me.powerReady || body.move === 'heal' && (me.heals <= 0 || A.nurBeiSchaden(me) && me.hp >= me.maxHp)) fail('Diese Aktion ist noch nicht verfügbar.');
    room.actions[id] = body.move; room.revision++;
    if (living(room).every(m => room.actions[m.id])) resolveRound(world,room,now);
  }
  return {};
}
