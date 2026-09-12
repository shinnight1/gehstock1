import {data as D,economy as E,arena as A,adventure as X} from './gehstockmon-rules.mjs';
const fail=(message)=>{throw new Error(message);};
export const activeArena=p=>p.arena&&p.arena.phase!=='finished';
export const activeDuel=p=>p.duel&&['choose','won'].includes(p.duel.phase);
export function expireAdventure(world,now){
  for(const p of Object.values(world.players)) {
    if(p.raidLock&&p.raidLock.until<=now)delete p.raidLock;
    if(activeDuel(p)&&p.duel.until<=now){p.duel.phase='finished';p.duel.winner='expired';p.duel.message='Der Überfall ist abgelaufen.';}
    if(activeArena(p)&&p.arena.kind==='raid'&&p.duel?.until<=now){p.arena=A.flee(p.arena);p.arena.winner='expired';p.arena.settled=true;p.arena.message='Der Überfall ist nach zehn Minuten abgelaufen. Kein Ei wurde gestohlen.';p.duel=null;}
  }
}
function log(world,p,id,defender,text,now){world.reports.push({id:'adventure-'+id+'-'+now,time:now,attackerId:id,defenderId:defender,territoryId:6,text:p.name+' '+text});world.reports=world.reports.slice(-150);}
function egg(p,territoryId,now){p.eggs.push({id:'reward-'+territoryId+'-'+now+'-'+(++p.eggSerial),territoryId,producedAt:now,startedAt:null,readyAt:null});}
export function finishEncounter(world,p,id,now){
  const b=p.arena;if(!b?.kind||b.phase!=='finished'||b.settled)return false;
  b.settled=true;
  if(b.kind==='trainer'){
    if(b.winner==='wir'&&!p.encounterClaims.includes(b.encounterId)){
      p.encounterClaims=p.encounterClaims.concat(b.encounterId).slice(-100);p.progress.trainerWins++;p.gold+=25;
      if(p.eggs.length<E.BAG_LIMIT){egg(p,b.territoryId,now);b.message='Training gewonnen! Ein Ei und 25 Gold gehören dir.';}
      else {p.rewardEggs=p.rewardEggs||{};p.rewardEggs[b.territoryId]=(p.rewardEggs[b.territoryId]||0)+1;b.message='Training gewonnen! 25 Gold; dein Ei wartet auf Platz in der Tasche.';}
    }else b.message='Das Training ist beendet. Du verlierst weder Gold noch Eier. Probiere andere Attacken.';
    return true;
  }
  if(b.kind==='raid'){
    const target=world.players[b.targetId],lock=target?.raidLock;
    if(b.winner==='wir'&&lock?.attackerId===id&&lock.until>now&&lock.battleId===b.id){
      const stolen=target.eggs.find(e=>e.id===lock.eggId);
      if(stolen&&p.eggs.length<E.BAG_LIMIT&&(stolen.startedAt===null||p.eggs.filter(e=>e.startedAt!==null).length<E.INCUBATORS)){
        target.eggs=target.eggs.filter(e=>e.id!==stolen.id);p.eggs.push({...stolen,id:'stolen-'+now+'-'+(++p.eggSerial)});target.raidShield=now+2*E.HOUR;
        b.message='Überfall gewonnen! Ein Ei aus '+target.name+'s Tasche gehört dir. Seine Brutzeit bleibt erhalten.';log(world,p,id,b.targetId,'erbeutet ein Ei von '+target.name+'.',now);
      }else b.message='Gewonnen, aber das Ei kann nicht übertragen werden. Kein Ei geht verloren.';
    }else b.message=b.winner==='wir'?'Der Überfall ist abgelaufen. Kein Ei wird übertragen.':'Die Verteidigung hält. Es wurde kein Ei gestohlen.';
    if(lock?.attackerId===id)delete target.raidLock;p.duel=null;return true;
  }
  return false;
}
export function deliverRewards(p,now){if(activeArena(p)||activeDuel(p))return;for(const [id,n]of Object.entries(p.rewardEggs||{})){const count=Math.min(n,E.BAG_LIMIT-p.eggs.length);for(let i=0;i<count;i++)egg(p,Number(id),now);p.rewardEggs[id]-=count;if(!p.rewardEggs[id])delete p.rewardEggs[id];}}
export async function adventureAction({world,p,id,body,now,draw,presence,validateSquad}){
  const op=body.op,extra={};
  if(!X.OPS.includes(op))return extra;
  if(activeArena(p))fail('Beende zuerst deinen Mon-Kampf.');
  if(activeDuel(p)&&!['raid_turn','raid_arena','raid_cancel'].includes(op))fail('Beende zuerst deinen Überfall.');
  async function position(pid){const data=await presence.getWithMetadata('presence-v1',{type:'json',consistency:'strong'}),v=data?.data?.players?.[pid];if(!v||now-v.updatedAt>=15000||v.spawnAt!==world.players[pid].lastJoinAt)fail('Die Kartenposition ist nicht aktuell. Warte kurz auf die Verbindung.');return v;}
  async function nearby(point,distance=8){const at=await position(id);if(Math.hypot(at.x-point.x,at.z-point.z)>distance)fail('Laufe zuerst näher heran.');return at;}
  if(op==='survey'){const at=await position(id);let best=0;D.BIOME.forEach((b,i)=>{if(Math.hypot(b.x-at.x,b.z-at.z)<Math.hypot(D.BIOME[best].x-at.x,D.BIOME[best].z-at.z))best=i;});if(!p.visited.includes(best+1))p.visited.push(best+1);extra.message=D.BIOME[best].terrain+' erkundet.';}
  if(op==='gather'||op==='trainer_start'){
    const encounter=X.encounters(now,world.territories).find(e=>e.id===body.encounterId);if(!encounter||encounter.kind!==(op==='gather'?'rune':'trainer'))fail('Diese Begegnung ist weitergezogen. Aktualisiere die Karte.');
    if(p.encounterClaims.includes(encounter.id))fail('Diese Begegnung hast du bereits abgeschlossen.');await nearby(encounter);
    if(op==='gather'){p.encounterClaims=p.encounterClaims.concat(encounter.id).slice(-100);p.progress.gathered++;p.gold+=10;extra.message='Rune gefunden! +10 Gold und Fortschritt für deine Quest.';}
    else {p.truppe=validateSquad(p,body.squad);p.arena=A.create(p.truppe.map(D.mon),['blattschleicher','tauhupfer'].slice(0,p.progress.trainerWins<3?1:2).map(D.mon),{id:body.requestId,territoryId:encounter.territoryId,now});Object.assign(p.arena,{kind:'trainer',encounterId:encounter.id,title:encounter.name});}
  }
  if(op==='quest_claim'){const quest=X.QUESTS.find(q=>q.id===body.questId);if(!quest||p.claimedQuests.includes(quest.id)||X.progress(p,quest)<quest.goal)fail('Diese Questbelohnung ist noch nicht verfügbar.');p.claimedQuests.push(quest.id);if(quest.gold)p.gold+=quest.gold;if(quest.skin&&!p.skins.includes(quest.skin))p.skins.push(quest.skin);extra.message=quest.skin?X.skin(quest.skin).name+' freigeschaltet!':'Quest geschafft! +'+quest.gold+' Gold.';}
  if(op==='shop_buy'||op==='equip'){
    if(p.raidLock?.until>now)fail('Während eines Überfalls bleibt deine Ausrüstung fest.');
    const skin=body.kind==='skin',list=skin?X.SKINS:body.kind==='weapon'?X.WEAPONS:[],item=list.find(v=>v.id===body.itemId),owned=skin?p.skins:p.weapons;if(!item)fail('Diese Ausrüstung gibt es nicht.');
    if(op==='shop_buy'){if(owned.includes(item.id))fail('Das besitzt du bereits.');if(!item.price||item.price>p.gold)fail(item.quest?'Erfülle zuerst die zugehörige Quest.':'Du hast noch nicht genug Gold.');p.gold-=item.price;owned.push(item.id);}
    else if(!owned.includes(item.id))fail('Schalte diese Ausrüstung zuerst frei.');p[skin?'skin':'weapon']=item.id;extra.message=item.name+' ausgerüstet.';
  }
  if(op==='raid_start'){
    const target=world.players[body.targetId];if(!target||body.targetId===id)fail('Wähle einen anderen Spieler.');
    if(X.protected(p,now)||X.protected(target,now))fail('Anfängerschutz: Beide Spieler brauchen 24 Stunden Spielalter und mindestens 6 Mons. Nach einem Diebstahl gelten 2 Stunden Schutz.');
    if(p.raidCooldown>now||target.raidLock?.until>now||activeArena(target)||activeDuel(target))fail('Dieser Überfall ist gerade nicht möglich.');
    if(p.eggs.length>=E.BAG_LIMIT)fail('Du brauchst einen freien Platz für ein erbeutetes Ei.');
    const targetPos=await position(body.targetId);await nearby(targetPos);const victimEgg=target.eggs.find(e=>e.startedAt!==null&&p.eggs.filter(e=>e.startedAt!==null).length<E.INCUBATORS)||target.eggs.find(e=>e.startedAt===null);if(!victimEgg)fail('Dieser Spieler trägt kein Ei, das in deine Brutstation passt.');
    p.raidCooldown=now+30*60000;p.duel={id:body.requestId,targetId:body.targetId,targetName:target.name,revision:0,round:1,phase:'choose',hp:100,enemyHp:100,weapon:p.weapon,enemyWeapon:target.weapon,enemySkin:target.skin,until:now+10*60000,message:'Gewinne zuerst das Waffenduell, danach den Mon-Kampf.'};target.raidLock={attackerId:id,eggId:victimEgg.id,until:p.duel.until};
  }
  if(op==='raid_turn'){
    const d=p.duel;if(!d||d.phase!=='choose'||d.id!==body.duelId||d.revision!==body.revision)fail('Rufe den aktuellen Duellstand ab.');if(!['strike','heavy','guard'].includes(body.move))fail('Wähle eine Waffenaktion.');
    const enemyMove=['strike','heavy','guard'][Math.min(2,Math.floor(draw*3))],hit=(weapon,move,guard)=>Math.round(X.weapon(weapon).attack*(move==='guard'?.4:move==='heavy'?1.4:1)*(guard?.35:1));
    const damage=hit(d.weapon,body.move,enemyMove==='guard'),counter=hit(d.enemyWeapon,enemyMove,body.move==='guard');d.enemyHp=Math.max(0,d.enemyHp-damage);if(d.enemyHp)d.hp=Math.max(0,d.hp-counter);d.revision++;d.round++;d.message='Dein Treffer: '+damage+' Schaden. Gegenangriff: '+(d.enemyHp?counter:0)+'.';
    if(!d.enemyHp){d.phase='won';d.message='Waffenduell gewonnen. Fordere jetzt seine Mons heraus, um ein Ei zu erbeuten.';}
    else if(!d.hp||d.round>20){d.phase='finished';d.message='Duell verloren. Deine Eier bleiben unberührt.';const t=world.players[d.targetId];if(t?.raidLock?.attackerId===id)delete t.raidLock;}
  }
  if(op==='raid_arena'){
    const d=p.duel,target=d&&world.players[d.targetId];if(!d||d.phase!=='won'||d.until<=now||target?.raidLock?.attackerId!==id)fail('Gewinne zuerst ein gültiges Waffenduell.');p.truppe=validateSquad(p,body.squad);
    p.arena=A.create(p.truppe.map(D.mon),target.truppe.map(D.mon),{id:body.requestId,territoryId:6,now});Object.assign(p.arena,{kind:'raid',targetId:d.targetId,title:'Überfall auf '+target.name});target.raidLock.battleId=p.arena.id;d.phase='arena';
  }
  if(op==='raid_cancel'){const d=p.duel,target=d&&world.players[d.targetId];if(target?.raidLock?.attackerId===id)delete target.raidLock;p.duel=null;extra.message='Zurückgezogen. Kein Ei wurde gestohlen.';}
  return extra;
}
