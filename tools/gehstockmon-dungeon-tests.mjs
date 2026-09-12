/* Mehrspieler, Wiederholungen, Balance und Migration mit lokalen CAS-Speichern. */
import assert from 'node:assert/strict';
import {data as D, adventure as X, arena as A, economy as E} from '../netlify/functions/lib/gehstockmon-rules.mjs';
import {createHandler} from '../netlify/functions/gehstockmon.mjs';
const stamp=Date.parse('2026-09-17T08:00:00+02:00');let serial=0,checks=0;
const codes=[];for(let n=0;codes.length<5;n++){const code=String(n).padStart(4,'0');let h=0x811c9dc5;for(const c of 'code:'+code+':gehstock:hideout:2026:kellergewoelbe'){h^=c.charCodeAt(0);h=(h+(h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24))>>>0;}if(h%97===0)codes.push(code);}
function memory(){let data=null,version=0;return {get data(){return data;},async getWithMetadata(){return data?{data:structuredClone(data),etag:String(version)}:null;},async setJSON(k,next,o){await new Promise(setImmediate);if(o.onlyIfNew&&data||o.onlyIfMatch!==undefined&&o.onlyIfMatch!==String(version))return{modified:false};data=structuredClone(next);version++;return{modified:true};}};}
async function test(name,fn){await fn();checks++;console.log('ok',name);}
async function call(f,i,op,data={}){const res=await f.handler(new Request('http://localhost/api/gehstockmon',{method:'POST',body:JSON.stringify({code:codes[i],name:'Player '+i,op,requestId:'dungeon-test-'+(++serial),...data})}));return{status:res.status,...await res.json()};}
const ok=r=>{assert.equal(r.status,200,r.error);return r;};
async function fixture(){const f={db:memory(),presence:memory(),time:stamp,players:[]};f.handler=createHandler({store:f.db,presenceStore:f.presence,now:()=>f.time});for(let i=0;i<5;i++)f.players.push(ok(await call(f,i,'join')));return f;}
const player=(f,i)=>f.db.data.players[f.players[i].playerId];
async function entrance(f,i,d=0){const dungeon=X.DUNGEONS[d];if(d===0)return ok(await call(f,i,'presence',{position:{x:dungeon.x,z:dungeon.z,heading:0}}));
  // Seed an already validated arrival for higher-tier combat fixtures; all real routes are tested separately.
  await entrance(f,i);f.presence.data.players[f.players[i].playerId].x=dungeon.x;f.presence.data.players[f.players[i].playerId].z=dungeon.z;
}
async function group(f,n=2,d=0,monId='glutfuchs'){
  for(let i=0;i<n;i++){if(!player(f,i).besitz.includes(monId))player(f,i).besitz.push(monId);await entrance(f,i,d);}
  let r=ok(await call(f,0,'dungeon_create',{dungeonId:X.DUNGEONS[d].id,monId}));const roomId=r.dungeon.id;
  for(let i=1;i<n;i++)ok(await call(f,i,'dungeon_join',{roomId,monId}));
  for(let i=0;i<n;i++)ok(await call(f,i,'dungeon_ready',{roomId,monId,ready:true}));
  return ok(await call(f,0,'dungeon_start',{roomId}));
}
async function play(f,r,n){for(let turn=0;r.dungeon.phase==='battle'&&turn<40;turn++){
  const room=r.dungeon;for(let i=0;i<n;i++){const me=room.players.find(m=>m.id===f.players[i].playerId);if(me.hp<=0||me.left)continue;
    const move=me.heals&&me.hp<me.maxHp*.55?'heal':room.round>=me.powerReady?'power':'strike';
    r=ok(await call(f,i,'dungeon_turn',{roomId:room.id,round:room.round,move}));
  }
}return r;}

await test('Rarity base values rise clearly; every rune level is capped and preserves rarity gaps for each role',()=>{
  const old=[.78,1,1.09,1.18,1.38,1.65,2];
  for(let role=0;role<4;role++)for(let rarity=0;rarity<7;rarity++){
    const mon={typ:role,seltenheit:rarity},base=A.stats(mon),max=A.stats({...mon,upgrade:5});
    for(const value of [-4,0,1,2,3,4,5,6,999999,Infinity,NaN]){const s=A.stats({...mon,upgrade:value});assert.ok(s.hp>=base.hp&&s.hp<=base.hp*1.1);assert.ok(s.ang>=base.ang&&s.ang<=base.ang*1.1);assert.equal(s.tempo,base.tempo);}
    if(rarity<6){const next=A.stats({...mon,seltenheit:rarity+1});assert.ok(max.hp<next.hp&&max.ang<next.ang,'upgrades never bridge a rarity tier for the same role');}
    if(rarity>0)assert.ok(base.hp>Math.round([132,88,112,96][role]*old[rarity]));
  }
  const p=D.neuerStand({runes:[-3,Infinity,1.5,1e9],monUpgrades:{glutfuchs:999,unknown:5}});assert.deepEqual(p.runes,[0,0,1,9999,0,0,0]);assert.equal(p.monUpgrades.unknown,undefined);
});
await test('Compact noncircular island has curved biome outlines, dry reachable dungeon entrances and grass corridors',()=>{
  assert.ok(D.WORLD.halfWidth*D.WORLD.halfDepth<450*420*.4);assert.ok(X.coast().length>=16);
  const radii=X.coast().map(p=>Math.hypot(p.x,p.z));assert.ok(Math.max(...radii)/Math.min(...radii)>1.3);
  for(let i=0;i<9;i++){const outline=X.biomeOutline(i);assert.equal(outline.length,64);assert.ok(X.polygonContains(D.BIOME[i],outline));}
  for(const owner of [null,'all']){const layout=X.layout(D.FELDER.map(f=>({id:f.id,ownerId:owner})));for(const d of X.DUNGEONS){assert.ok(X.canTravel(layout,d,d,'visitor'));assert.ok(!layout.some(g=>X.inside(d,g)));const route=X.route(layout,X.SPAWN,d,'visitor');assert.ok(route);let p=X.SPAWN;for(const q of route){assert.ok(X.canTravel(layout,p,q,'visitor'));p=q;}}}
  assert.equal(X.onLand({x:275,z:230}),false);assert.equal(X.walkable({x:X.riverCenter(50),z:50}),false);
});
await test('Map version 4 migrates all nine territories without losing eggs, owners, upgrades or collections',async()=>{
  const f=await fixture(),p=player(f,0);f.db.data.mapVersion=4;p.monUpgrades.glutfuchs=3;p.runes[0]=7;p.eggs=[{id:'egg-nine',territoryId:9,producedAt:stamp,startedAt:null,readyAt:null}];Object.assign(f.db.data.territories[8],{ownerId:f.players[0].playerId,...E.outpost(null,stamp)});
  const r=ok(await call(f,0,'world'));assert.equal(r.mapVersion,5);assert.equal(r.territories[8].ownerId,r.playerId);assert.equal(r.profile.eggs[0].territoryId,9);assert.equal(r.profile.runes[0],7);assert.equal(r.profile.monUpgrades.glutfuchs,3);assert.ok(X.walkable(r.spawn));
});
await test('Dungeon entry requires fresh nearby presence and an owned Mon; lobbies admit at most four people',async()=>{
  const f=await fixture();assert.equal((await call(f,0,'dungeon_create',{dungeonId:'dungeon-0',monId:'glutfuchs'})).status,400);await entrance(f,0);
  assert.equal((await call(f,0,'dungeon_create',{dungeonId:'dungeon-0',monId:'endrichter'})).status,400);
  assert.equal((await call(f,0,'dungeon_create',{dungeonId:'dungeon-6',monId:'glutfuchs'})).status,400);
  const r=ok(await call(f,0,'dungeon_create',{dungeonId:'dungeon-0',monId:'glutfuchs'})),roomId=r.dungeon.id;
  for(let i=1;i<5;i++)await entrance(f,i);
  const joins=await Promise.all([1,2,3,4].map(i=>call(f,i,'dungeon_join',{roomId,monId:'glutfuchs'})));assert.equal(joins.filter(r=>r.status===200).length,3);assert.equal(f.db.data.dungeons[roomId].players.length,4);
  assert.equal((await call(f,0,'dungeon_start',{roomId})).status,400);
  assert.equal((await call(f,0,'arena_start',{territoryId:1,version:1,squad:player(f,0).truppe})).status,409);
});
await test('Two real participants submit simultaneously, see the same round and cannot submit twice',async()=>{
  const f=await fixture();let r=await group(f);const roomId=r.dungeon.id,hp=r.dungeon.boss.hp;
  r=ok(await call(f,0,'dungeon_turn',{roomId,round:1,move:'power',requestId:'same-dungeon-turn'}));assert.equal(r.dungeon.round,1);assert.equal(r.dungeon.boss.hp,hp);
  const retry=ok(await call(f,0,'dungeon_turn',{roomId,round:1,move:'power',requestId:'same-dungeon-turn'}));assert.equal(retry.duplicate,true);
  assert.equal((await call(f,0,'dungeon_turn',{roomId,round:1,move:'strike'})).status,400);
  r=ok(await call(f,1,'dungeon_turn',{roomId,round:1,move:'strike'}));assert.equal(r.dungeon.round,2);assert.ok(r.dungeon.boss.hp<hp);
  assert.equal((await call(f,0,'dungeon_turn',{roomId,round:2,move:'power'})).status,400);
  const replies=await Promise.all([0,1].map(i=>call(f,i,'dungeon_turn',{roomId,round:2,move:'strike'})));replies.forEach(ok);
  const a=ok(await call(f,0,'world')),b=ok(await call(f,1,'world'));assert.deepEqual(a.dungeon,b.dungeon);assert.equal(a.dungeon.round,3);
  const reconnect=ok(await call(f,1,'join'));assert.equal(reconnect.dungeon.id,roomId);assert.equal(reconnect.dungeon.round,3);
});
await test('A beginner pair can beat the first dungeon; rewards are once per contributor even on concurrent polls',async()=>{
  const f=await fixture();let r=await group(f);r=await play(f,r,2);assert.equal(r.dungeon.winner,'players',JSON.stringify(r.dungeon));
  for(let i=0;i<2;i++)assert.equal(player(f,i).runes[0],2);assert.equal(player(f,2).runes[0],0);
  await Promise.all([0,1,0,1].map(i=>call(f,i,'world')));for(let i=0;i<2;i++)assert.equal(player(f,i).runes[0],2);
  assert.equal((await call(f,0,'dungeon_turn',{roomId:r.dungeon.id,round:r.dungeon.round,move:'strike'})).status,400);
});
await test('Harder dungeon tiers have stronger bosses, scale with group size and pay only their matching rune',async()=>{
  let prior=0;
  for(let d=0;d<7;d++){const f=await fixture();let r=await group(f,2,d,'endrichter');assert.ok(r.dungeon.boss.hp*r.dungeon.boss.attack>prior);prior=r.dungeon.boss.hp*r.dungeon.boss.attack;
    const boss=f.db.data.dungeons[r.dungeon.id].boss;boss.hp=1; // Isolate reward routing from balance simulation.
    r=await play(f,ok(await call(f,0,'world')),2);assert.equal(r.dungeon.winner,'players');for(let i=0;i<2;i++)assert.deepEqual(player(f,i).runes,D.SELTENHEITEN.map((_,j)=>j===d?X.DUNGEONS[d].reward:0));
  }
  const a=await fixture(),b=await fixture();assert.ok((await group(b,4)).dungeon.boss.maxHp>(await group(a,1)).dungeon.boss.maxHp);
});
await test('A common solo Mon can clear the beginner dungeon and four top Mons can beat the final boss',async()=>{
  for(const [count,tier,mon] of [[1,0,'glutfuchs'],[4,6,'endrichter']]){const f=await fixture();const r=await play(f,await group(f,count,tier,mon),count);assert.equal(r.dungeon.winner,'players','tier '+tier+' must be beatable with an appropriate team');}
});
await test('Runes enforce rarity, growing costs, stale-level checks, cap and consistent saved defense stats',async()=>{
  const f=await fixture(),id=f.players[0].playerId;pSetup();function pSetup(){const p=player(f,0);p.besitz.push('sumpfschnapper');p.runes=[15,0,100,100,100,100,100];f.db.data.territories[0].ownerId=id;f.db.data.territories[0].defense=[{id:'glutfuchs'}];}
  assert.equal((await call(f,0,'mon_upgrade',{monId:'sumpfschnapper',level:0,rarity:2,cost:0})).status,400);
  for(let level=0;level<5;level++){
    const requestId='upgrade-level-'+level;let r=ok(await call(f,0,'mon_upgrade',{monId:'glutfuchs',level,requestId}));assert.equal(r.profile.monUpgrades.glutfuchs,level+1);const remaining=r.profile.runes[0];r=ok(await call(f,0,'mon_upgrade',{monId:'glutfuchs',level,requestId}));assert.equal(r.profile.runes[0],remaining);assert.equal(r.territories[0].defense[0].upgrade,level+1);
  }
  assert.equal(player(f,0).runes[0],0);assert.equal((await call(f,0,'mon_upgrade',{monId:'glutfuchs',level:5})).status,400);
  const r=ok(await call(f,1,'arena_start',{territoryId:1,version:f.db.data.territories[0].version,squad:player(f,1).truppe}));assert.equal(r.arena.teams[1][0].maxHp,A.stats(X.mon(player(f,0),'glutfuchs')).hp);
});
await test('Concurrent upgrades cannot double-spend and only saved upgrades reach arena snapshots',async()=>{
  const f=await fixture();player(f,0).runes[0]=1;const results=await Promise.all([0,1].map(()=>call(f,0,'mon_upgrade',{monId:'glutfuchs',level:0})));assert.equal(results.filter(r=>r.status===200).length,1);assert.equal(player(f,0).runes[0],0);
  const r=ok(await call(f,0,'arena_start',{territoryId:1,version:1,squad:player(f,0).truppe,monUpgrades:{glutfuchs:999},upgrade:999}));const unit=r.arena.teams[0].find(m=>m.monId==='glutfuchs');assert.equal(unit.maxHp,A.stats(X.mon(player(f,0),'glutfuchs')).hp);
  assert.equal((await call(f,0,'mon_upgrade',{monId:'glutfuchs',level:1})).status,409);
});
await test('Absent players auto-guard, leave after three missed rounds, and cannot receive victory rewards',async()=>{
  const f=await fixture();let r=await group(f,2,0,'endrichter'),roomId=r.dungeon.id;f.db.data.dungeons[roomId].boss.hp=999999;
  for(let i=0;i<3;i++){r=ok(await call(f,0,'dungeon_turn',{roomId,round:r.dungeon.round,move:'strike'}));f.time+=46000;r=ok(await call(f,0,'world'));}
  assert.equal(r.dungeon.players[1].left,true);const absent=ok(await call(f,1,'world'));assert.equal(absent.dungeon.phase,'finished');ok(await call(f,1,'arena_start',{territoryId:1,version:1,squad:absent.profile.truppe}));f.db.data.dungeons[roomId].boss.hp=1;r=ok(await call(f,0,'dungeon_turn',{roomId,round:r.dungeon.round,move:'strike'}));assert.equal(r.dungeon.winner,'players');assert.equal(player(f,1).runes[0],0);assert.equal(player(f,0).runes[0],2);
});
await test('Lobby leadership transfers, finished losses grant nothing, and expiry unblocks other play',async()=>{
  const f=await fixture();await entrance(f,0);await entrance(f,1);let r=ok(await call(f,0,'dungeon_create',{dungeonId:'dungeon-0',monId:'glutfuchs'}));const roomId=r.dungeon.id;
  ok(await call(f,1,'dungeon_join',{roomId,monId:'glutfuchs'}));ok(await call(f,0,'dungeon_leave',{roomId}));r=ok(await call(f,1,'world'));assert.equal(r.dungeon.leaderId,r.playerId);
  f.time+=301000;r=ok(await call(f,1,'world'));assert.equal(r.dungeon.winner,'expired');assert.deepEqual(r.profile.runes,[0,0,0,0,0,0,0]);ok(await call(f,1,'arena_start',{territoryId:1,version:1,squad:r.profile.truppe}));
  const g=await fixture();r=await group(g,1,6);r=await play(g,r,1);assert.equal(r.dungeon.winner,'boss');assert.deepEqual(r.profile.runes,[0,0,0,0,0,0,0]);
});
await test('Testzone dungeons and upgrades stay in the temporary capsule and never touch live stores',async()=>{
  const forbidden={async getWithMetadata(){throw Error('live read');},async setJSON(){throw Error('live write');}},handler=createHandler({store:forbidden,presenceStore:forbidden,now:()=>stamp});let state=null,presence=null;
  async function invoke(op,data={}){const res=await handler(new Request('http://localhost/api/gehstockmon',{method:'POST',body:JSON.stringify({code:'0141',op,requestId:'test-capsule-'+(++serial),adminOverride:true,adminCode:'3141',testState:state,testPresence:presence,...data})}));assert.equal(res.status,200,await res.clone().text());const r=await res.json();state=r.testState;presence=r.testPresence;return r;}
  let r=await invoke('join');await invoke('presence',{position:{x:0,z:40,heading:0}});r=await invoke('dungeon_create',{dungeonId:'dungeon-0',monId:'endrichter'});const roomId=r.dungeon.id;await invoke('dungeon_ready',{roomId,monId:'endrichter',ready:true});r=await invoke('dungeon_start',{roomId});
  while(r.dungeon.phase==='battle')r=await invoke('dungeon_turn',{roomId,round:r.dungeon.round,move:'strike'});assert.equal(r.profile.runes[0],2);r=await invoke('mon_upgrade',{monId:'glutfuchs',level:0});assert.equal(r.profile.monUpgrades.glutfuchs,1);
  state=presence=null;r=await invoke('join');assert.equal(r.profile.runes[0],0);assert.equal(r.profile.monUpgrades.glutfuchs,undefined);assert.equal(r.dungeon,null);
});
console.log('\n'+checks+' dungeon and balance checks passed.');
