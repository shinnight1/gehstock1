import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { data as D, economy as E, arena as A, hours as H, adventure as X } from '../netlify/functions/lib/gehstockmon-rules.mjs';
import { createHandler } from '../netlify/functions/gehstockmon.mjs';
import { schenken, schenkungen, spielerId } from '../netlify/functions/lib/gehstockmon-schenken.mjs';
let passed=0,sequence=0;
async function test(name,fn){await fn();passed++;console.log('ok',name);}
export function memoryStore(){let data=null,version=0;return{get data(){return data;},async getWithMetadata(){return data?{data:structuredClone(data),etag:String(version)}:null;},async setJSON(key,next,opts){await new Promise(setImmediate);if((opts.onlyIfNew&&data)||(opts.onlyIfMatch!==undefined&&opts.onlyIfMatch!==String(version)))return{modified:false};data=structuredClone(next);version++;return{modified:true};}};}
function codeAt(index){let codes=[];for(let n=0;n<10000;n++){const code=String(n).padStart(4,'0'),text='code:'+code+':gehstock:hideout:2026:kellergewoelbe';let h=0x811c9dc5;for(const c of text){h^=c.charCodeAt(0);h=(h+(h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24))>>>0;}if(h%97===0)codes.push(code);}return codes[index];}
const ca=codeAt(0),cb=codeAt(1),stamp=Date.parse('2026-09-17T07:00:00+02:00');
async function call(handler,code,op,data={}){const response=await handler(new Request('http://localhost/api/gehstockmon',{method:'POST',body:JSON.stringify({code,name:code===ca?'Test A':'Test B',op,requestId:'request-'+(++sequence),...data})}));return{status:response.status,...await response.json()};}
function action(b){const u=b.teams[0][b.active[0]],e=b.teams[1][b.active[1]];if(b.phase==='replace')return{kind:'switch',slot:b.teams[0].findIndex((k)=>k.hp>0)};if(u.charges>0&&((u.role===2&&u.hp<u.maxHp*.67)||(u.role===1&&e.hp<=e.maxHp*.35)||(u.role===3&&!e.weakened)))return{kind:'move',move:'special'};return{kind:'move',move:b.round>=u.powerReady?'power':'strike'};}
async function win(handler,code,territoryId=1){let r=await call(handler,code,'world');r=await call(handler,code,'arena_start',{territoryId,version:r.territories[territoryId-1].version,squad:r.profile.truppe});assert.equal(r.status,200);for(let i=0;r.arena.phase!=='finished'&&i<80;i++){r=await call(handler,code,'arena_turn',{battleId:r.arena.id,revision:r.arena.revision,action:action(r.arena)});assert.equal(r.status,200,r.error);}assert.equal(r.arena.winner,'wir');return r;}

await test('57 distinct images, nine biomes and chosen 2h/1h timers',()=>{assert.equal(D.KATALOG.length,57);assert.equal(new Set(D.KATALOG.map(k=>k.id)).size,57);assert.equal(D.FELDER.length,9);assert.equal(new Set(D.BIOME.map(b=>b.terrain)).size,9);for(const k of D.KATALOG)assert.ok(fs.existsSync('src/assets/'+k.bild+'.webp')||fs.existsSync('src/assets/'+k.bild+'.png'),k.bild);assert.equal(E.EGG_TIME,7200000);assert.equal(E.HATCH_TIME,3600000);});
await test('Old saves keep collection and migrate currency once',()=>{const old={essenz:240,geschafft:[1,3],besitz:['moosling']};const p=D.neuerStand(old,stamp);assert.equal(p.gold,360);assert.ok(p.besitz.includes('moosling'));assert.equal(p.outposts[1].eggAt,stamp);p.gold=10;assert.equal(D.neuerStand(p,stamp+100).gold,10);assert.equal(D.neuerStand(p,stamp+100).outposts[1].eggAt,stamp);});
await test('Income, exact egg threshold, fractional time and backwards clocks',()=>{const p=D.neuerStand(null,stamp);E.capture(p,1,stamp);const post=p.outposts[1],gold=p.gold;E.tick(p,stamp+E.EGG_TIME-1);assert.equal(post.eggStock,0);E.tick(p,stamp+E.EGG_TIME);assert.equal(post.eggStock,1);assert.equal(p.gold,gold+40);E.tick(p,stamp);E.tick(p,stamp+E.EGG_TIME);assert.equal(p.gold,gold+40);E.tick(p,stamp+20*E.HOUR);assert.equal(post.eggStock,3);assert.equal(post.eggAt,stamp+8*E.HOUR);});
await test('Upgrade settles elapsed time at old income and changes defense',()=>{const p=D.neuerStand(null,stamp);E.capture(p,1,stamp);const before=p.gold,post=p.outposts[1];E.upgrade(p,post,stamp+E.HOUR);assert.equal(p.gold,before+20-120);assert.equal(post.level,2);E.tick(p,stamp+2*E.HOUR);assert.equal(p.gold,before+20-120+35);assert.equal(E.LEVELS[2].bonus,.12);});
await test('Egg collection, incubation slots and hatching cannot skip time',()=>{const p=D.neuerStand(null,stamp);E.capture(p,1,stamp);E.tick(p,stamp+6*E.HOUR);assert.equal(E.collect(p,p.outposts[1],1,stamp+6*E.HOUR),3);for(const egg of p.eggs)E.incubate(p,egg.id,stamp+6*E.HOUR);const id=p.eggs[0].id;assert.throws(()=>E.hatch(p,id,stamp+7*E.HOUR-1,.2),/noch nicht/);const schlupf=E.hatch(p,id,stamp+7*E.HOUR,.2);assert.ok(schlupf.mon);assert.equal(schlupf.neu,true);assert.equal(p.besitz.length,5);assert.throws(()=>E.hatch(p,id,stamp+7*E.HOUR,.2));assert.equal(p.eggs.length,2);});
await test('A second copy raises the rune level and only becomes runes at the cap',()=>{
  /* Die Ziehungen stehen fest: gewoehnlich, immer dasselbe Mon, das kein Startmon ist, und nie schimmernd.
     Einmal neu, danach lauter Zwillinge. */
  const pool=D.KATALOG.filter(k=>k.seltenheit===0),ziel=pool.find(k=>!D.STARTER.includes(k.id)),stelle=(pool.indexOf(ziel)+.5)/pool.length;
  const p=D.neuerStand(null,stamp),egg=(n)=>{p.eggs=[{id:'egg'+n,territoryId:1,startedAt:stamp,readyAt:stamp+E.HOUR,producedAt:stamp}];const folge=[0,stelle,.9];return E.hatch(p,'egg'+n,stamp+E.HOUR,()=>folge.length?folge.shift():.9);};
  const erst=egg('neu');assert.equal(erst.neu,true);assert.equal(erst.mon.id,ziel.id);const doppelt=erst.mon;
  for(let stufe=1;stufe<=X.UPGRADE_LIMIT;stufe++){const r=egg(stufe);assert.equal(r.neu,false);assert.equal(r.mon.id,doppelt.id);assert.equal(r.stufe,stufe);assert.equal(p.monUpgrades[doppelt.id],stufe);}
  const runen=p.runes[doppelt.seltenheit],voll=egg('voll');
  assert.equal(voll.stufe,X.UPGRADE_LIMIT);assert.equal(voll.runen,X.UPGRADE_LIMIT);
  assert.equal(p.runes[doppelt.seltenheit],runen+X.UPGRADE_LIMIT,'a twin at the cap pays its own rarity in runes');
  assert.equal(p.besitz.length,5,'no phantom entry in the collection');});
await test('Enough eggs still complete the collection, and nothing ever yields flat gold',()=>{
  let seed=7;const zufall=()=>((seed=(seed*1103515245+12345)>>>0)/4294967296);
  const p=D.neuerStand(null,stamp),gold=p.gold;
  for(let i=0;i<4000&&new Set(p.besitz).size<D.KATALOG.length;i++){p.eggs=[{id:'egg'+i,territoryId:1,startedAt:stamp,readyAt:stamp+E.HOUR,producedAt:stamp}];E.hatch(p,'egg'+i,stamp+E.HOUR,zufall());}
  assert.equal(new Set(p.besitz).size,D.KATALOG.length);assert.equal(p.gold,gold,'a twin pays in rune levels, never in gold');});
await test('Bought incubator slots stack on top of the lighthouse slot',()=>{
  const p=D.neuerStand(null,stamp);assert.equal(X.brutplaetze(null,p),E.INCUBATORS);
  assert.equal(X.brutplaetze({gold:X.LEUCHTTURM.ziel},p),E.INCUBATORS+1);
  p.brutplaetze=X.BRUTPLATZ_PREISE.length;
  assert.equal(X.brutplaetze({gold:X.LEUCHTTURM.ziel},p),E.INCUBATORS+1+X.BRUTPLATZ_PREISE.length);
  p.eggs=Array.from({length:8},(_,i)=>({id:'e'+i,territoryId:1,startedAt:null,readyAt:null,producedAt:stamp}));
  for(let i=0;i<6;i++)E.incubate(p,'e'+i,stamp,X.brutplaetze(null,p));
  assert.throws(()=>E.incubate(p,'e6',stamp,X.brutplaetze(null,p)),/6 Brutplätze/);});
await test('Common starters can capture their first biome; stronger Mons can clear all five',()=>{const starters=D.neuerStand().truppe.map(D.mon);assert.ok(starters.every(k=>k.seltenheit===0));assert.ok(A.stats(D.mon('glutfuchs')).ang<A.stats(D.mon('sonnenkoenig')).ang);for(const f of D.FELDER.slice(0,5)){const team=f.id===1?starters:['titanenkrone','sonnenkoenig','sternengeweih','leerenwyrm'].map(D.mon);let b=A.create(team,A.defenders(f.id),{territoryId:f.id,level:1});for(let i=0;b.phase!=='finished'&&i<80;i++)b=A.turn(b,action(b));assert.equal(b.winner,'wir',f.name);}const old=['bollwerk','klinge','waerter','spaeher'];assert.deepEqual(D.neuerStand({besitz:old,truppe:old}).besitz,old);});
await test('Invalid moves are immutable; power cooldown blocks repeated use',()=>{let b=A.create(D.KATALOG.slice(0,4),A.defenders(1),{}),before=JSON.stringify(b);assert.throws(()=>A.turn(b,{kind:'move',move:'delete-enemy'}));assert.equal(JSON.stringify(b),before);b=A.turn(b,{kind:'move',move:'power'});assert.throws(()=>A.turn(b,{kind:'move',move:'power'}),/nicht verfügbar/);assert.equal(b.revision,1);});
await test('Fainted enemies do not retaliate and forced switching is free',()=>{let b=A.create([D.mon('spaeher'),D.mon('klinge')],[D.mon('bollwerk')],{});b.teams[1][0].hp=1;const hp=b.teams[0][0].hp;b=A.turn(b,{kind:'move',move:'strike'});assert.equal(b.winner,'wir');assert.equal(b.teams[0][0].hp,hp);b=A.create([D.mon('bollwerk'),D.mon('klinge')],[D.mon('spaeher')],{});b.teams[0][0].hp=1;b=A.turn(b,{kind:'move',move:'strike'});assert.equal(b.phase,'replace');const round=b.round;b=A.turn(b,{kind:'switch',slot:1});assert.equal(b.round,round);assert.equal(b.teams[0][1].hp,b.teams[0][1].maxHp);});
await test('Invalid authentication and legacy summon cannot mutate the world',async()=>{const store=memoryStore(),h=createHandler({store,now:()=>stamp});assert.equal((await call(h,'bad','join')).status,401);assert.equal(store.data,null);assert.equal((await call(h,ca,'summon')).status,400);assert.equal(store.data,null);});
await test('Server advances individual turns, resumes, and awards conquest exactly once',async()=>{const store=memoryStore(),h=createHandler({store,now:()=>stamp});await call(h,ca,'join');let r=await call(h,ca,'arena_start',{territoryId:1,version:1,squad:D.neuerStand().truppe});assert.equal(r.profile.gold,180);assert.equal(r.territories[0].ownerId,null);const turn={battleId:r.arena.id,revision:0,action:{kind:'move',move:'power'},requestId:'same-turn-0001'};r=await call(h,ca,'arena_turn',turn);const replay=await call(h,ca,'arena_turn',turn);assert.equal(replay.arena.revision,r.arena.revision);assert.equal(replay.duplicate,true);assert.equal((await call(h,ca,'arena_turn',{...turn,requestId:'stale-turn-0002'})).status,409);const resumed=await call(h,ca,'join');assert.equal(resumed.arena.revision,1);while(r.arena.phase!=='finished'){r=await call(h,ca,'arena_turn',{battleId:r.arena.id,revision:r.arena.revision,action:action(r.arena),requestId:'finish-'+r.arena.revision});}assert.equal(r.arena.winner,'wir');assert.equal(r.profile.gold,220);assert.equal(r.territories[0].ownerId,r.playerId);assert.equal((await call(h,ca,'world')).profile.gold,220);});
await test('Flee and idle expiry never conquer or award gold',async()=>{let time=stamp;const h=createHandler({store:memoryStore(),now:()=>time});await call(h,ca,'join');let r=await call(h,ca,'arena_start',{territoryId:1,version:1,squad:D.neuerStand().truppe});r=await call(h,ca,'arena_flee',{battleId:r.arena.id,revision:0});assert.equal(r.arena.winner,'fled');assert.equal(r.profile.gold,180);r=await call(h,ca,'arena_start',{territoryId:1,version:1,squad:D.neuerStand().truppe});time+=21*60000;r=await call(h,ca,'world');assert.equal(r.arena.winner,'expired');assert.equal(r.territories[0].ownerId,null);});
await test('Server eggs, timed hatching and upgrade retries are authoritative',async()=>{let time=stamp;const store=memoryStore(),h=createHandler({store,now:()=>time,random:()=>.45});await call(h,ca,'join');let r=await win(h,ca);time+=E.EGG_TIME;r=await call(h,ca,'collect',{territoryId:1,requestId:'collect-once-0001'});assert.equal(r.profile.eggs.length,1);assert.equal((await call(h,ca,'collect',{territoryId:1,requestId:'collect-once-0001'})).profile.eggs.length,1);const egg=r.profile.eggs[0];await call(h,ca,'incubate',{eggId:egg.id});assert.equal((await call(h,ca,'hatch',{eggId:egg.id})).status,400);time+=E.HATCH_TIME;r=await call(h,ca,'hatch',{eggId:egg.id,requestId:'hatch-once-0001'});assert.ok(r.monId);assert.equal(r.profile.besitz.length,5);assert.equal((await call(h,ca,'hatch',{eggId:egg.id,requestId:'hatch-once-0001'})).profile.besitz.length,5);r=await call(h,ca,'upgrade',{territoryId:1,requestId:'upgrade-once-001'});const gold=r.profile.gold;assert.equal(r.territories[0].level,2);const retry=await call(h,ca,'upgrade',{territoryId:1,requestId:'upgrade-once-001'});assert.equal(retry.profile.gold,gold);assert.equal(retry.territories[0].level,2);await call(h,cb,'join');assert.equal((await call(h,cb,'upgrade',{territoryId:1})).status,403);});
await test('Competing final turns award only one conquest',async()=>{const store=memoryStore(),h=createHandler({store,now:()=>stamp});const pa=await call(h,ca,'join'),pb=await call(h,cb,'join');for(const code of[ca,cb])await call(h,code,'arena_start',{territoryId:1,version:1,squad:D.neuerStand().truppe});for(const p of Object.values(store.data.players)){p.arena.teams[1].forEach((u,i)=>u.hp=i===0?1:0);p.arena.teams[0][0].speed=100;}const results=await Promise.all([ca,cb].map((code,i)=>{const p=store.data.players[i===0?pa.playerId:pb.playerId];return call(h,code,'arena_turn',{battleId:p.arena.id,revision:0,action:{kind:'move',move:'strike'}});}));assert.deepEqual(results.map(r=>r.arena.winner).sort(),['stale','wir']);assert.equal(Object.values(store.data.players).reduce((s,p)=>s+p.gold,0),400);});
await test('Client recovers response loss without a second action and isolates accounts',async()=>{const store=memoryStore(),h=createHandler({store,now:()=>stamp});await call(h,ca,'join');await call(h,cb,'join');const values=new Map();let lose=true;const SG={gehstockmon:{abenteuer:X},env:{},auth:{aktuell:{code:ca}},storage:{get:(k,d)=>values.has(k)?structuredClone(values.get(k)):d,set:(k,v)=>values.set(k,structuredClone(v)),del:k=>values.delete(k)}};const context=vm.createContext({SG,window:{},AbortController,setTimeout,clearTimeout,fetch:async(url,opts)=>{const r=await h(new Request('http://localhost'+url,opts));if(lose){lose=false;throw new TypeError('response lost');}return r;}});const source=fs.readFileSync('src/games/gehstockmon/2-online.js','utf8');vm.runInContext(source,context);await assert.rejects(SG.gehstockmon.online.request('arena_start',{territoryId:1,version:1,squad:D.neuerStand().truppe}),/Antwort unbestätigt/);assert.ok(SG.gehstockmon.online.pending());SG.auth.aktuell.code=cb;assert.equal(SG.gehstockmon.online.pending(),null);SG.auth.aktuell.code=ca;vm.runInContext(source,context);const r=await SG.gehstockmon.online.request('resume');assert.equal(r.duplicate,true);assert.equal(r.arena.revision,0);assert.equal(r.profile.gold,180);assert.equal(SG.gehstockmon.online.pending(),null);});
await test('Online-only UI: auto-join, server progression, reload, peers and lost-response recovery',async()=>{/* .45 schluepft ein seltenes Mon - neu, weil alle Startmons gewoehnlich sind. */const {checkUi}=await import('./gehstockmon-ui-test.mjs');let time={value:stamp};await checkUi(D,E,A,createHandler({store:memoryStore(),presenceStore:memoryStore(),now:()=>time.value,random:()=>.45}),ca,time,cb);});
await test('Two players share ownership, attack saved defenses and retain independent collections',async()=>{const store=memoryStore(),h=createHandler({store,now:()=>stamp});const pa=await call(h,ca,'join');await call(h,cb,'join');const conquered=await win(h,ca);let other=await call(h,cb,'world');assert.equal(other.territories[0].ownerId,pa.playerId);assert.equal(other.profile.gold,180);assert.equal(other.territories[0].version,conquered.territories[0].version);other=await call(h,cb,'arena_start',{territoryId:1,version:other.territories[0].version,squad:other.profile.truppe});assert.equal(other.status,200);assert.deepEqual(other.arena.teams[1].map(u=>u.monId),pa.profile.truppe);for(let i=0;other.arena.phase!=='finished'&&i<80;i++)other=await call(h,cb,'arena_turn',{battleId:other.arena.id,revision:other.arena.revision,action:action(other.arena)});assert.equal(other.status,200);assert.equal(other.arena.winner,'wir');const first=await call(h,ca,'world');assert.equal(first.territories[0].ownerId,other.playerId);assert.equal(first.profile.besitz.length,4);assert.equal(first.territories[0].eggStock,0);assert.equal(first.reports.at(-1).defenderId,pa.playerId);});
await test('Offline catalog hides online-only games while preserving offline games',()=>{const SG={util:{},games:{},order:[],offline:false};vm.runInNewContext(fs.readFileSync('src/core/registry.js','utf8'),{SG});SG.register({id:'gehstockmon',onlineOnly:true});SG.register({id:'puzzle'});assert.equal(SG.list().length,2);SG.offline=true;assert.equal(SG.list().length,1);assert.equal(SG.list()[0].id,'puzzle');});
await test('Map migration preserves eggs, collection and earned income and chooses one owner per biome',async()=>{
  const store=memoryStore(),h=createHandler({store,now:()=>stamp});const a=await call(h,ca,'join'),b=await call(h,cb,'join');
  const old=Array.from({length:25},(_,i)=>({...structuredClone(store.data.territories[i%5]),id:i+1,...E.outpost(null,stamp-E.HOUR)}));
  Object.assign(old[0],{ownerId:a.playerId,ownerName:'First',capturedAt:stamp-2*E.HOUR});
  Object.assign(old[5],{ownerId:b.playerId,ownerName:'Second',capturedAt:stamp-E.HOUR,level:2});
  store.data.territories=old;delete store.data.mapVersion;
  const p=store.data.players[a.playerId];p.besitz=['bollwerk','klinge','waerter','spaeher'];p.truppe=p.besitz.slice();p.eggs=[{id:'legacy-egg',territoryId:24,producedAt:stamp-E.HOUR,startedAt:stamp-E.HOUR,readyAt:stamp}];
  p.arena=A.create(p.truppe.map(D.mon),A.defenders(1),{territoryId:21,now:stamp});
  const migrated=await call(h,ca,'world');assert.equal(migrated.territories.length,9);assert.equal(migrated.territories[0].ownerId,b.playerId);assert.equal(migrated.territories[0].level,2);assert.equal(migrated.profile.gold,180);assert.deepEqual(migrated.profile.besitz,p.besitz);assert.equal(migrated.profile.eggs[0].territoryId,4);assert.equal(migrated.profile.eggs[0].readyAt,stamp);assert.equal(migrated.arena.winner,'map_changed');assert.equal(migrated.arena.territoryId,1);assert.equal(store.data.previousMap.territories.length,25);
  const repeated=await call(h,ca,'world');assert.equal(repeated.profile.gold,migrated.profile.gold);assert.equal((await call(h,ca,'arena_start',{territoryId:24,version:1,squad:p.truppe})).status,400);
});
await test('Presence shares positions, expires departures and cannot change progression or impersonate players',async()=>{
  let time=stamp;const store=memoryStore(),presence=memoryStore(),h=createHandler({store,presenceStore:presence,now:()=>time});
  assert.equal((await call(h,ca,'presence',{position:{x:0,z:0,heading:0}})).status,409);
  const a=await call(h,ca,'join'),b=await call(h,cb,'join'),snapshot=JSON.stringify(store.data);
  const pair=await Promise.all([call(h,ca,'presence',{position:{...a.spawn,heading:1},playerId:b.playerId}),call(h,cb,'presence',{position:{...b.spawn,heading:-1}})]);
  assert.ok(pair.every(r=>r.status===200));assert.equal(Object.keys(presence.data.players).length,2);
  let r=await call(h,ca,'presence',{position:{...a.spawn,heading:1}});assert.equal(r.peers.length,1);assert.equal(r.peers[0].id,b.playerId);assert.deepEqual(r.peers[0].squad,b.profile.truppe,'presence includes only the authoritative squad');assert.equal(r.peers[0].x,b.spawn.x);assert.ok(!('code' in r.peers[0])&&!('profile' in r.peers[0]));assert.equal(JSON.stringify(store.data),snapshot);
  assert.equal((await call(h,ca,'presence',{position:{x:9999,z:1,heading:0}})).status,400);assert.equal((await call(h,ca,'presence',{position:{x:'0',z:1,heading:0}})).status,400);
  time+=15001;r=await call(h,ca,'presence',{position:{...a.spawn,heading:1}});assert.equal(r.peers.length,0);
  /* Unsichtbar ist B sofort, gespeichert bleibt sein letzter Stand aber - dort macht er weiter, wenn er zurueckkommt. Aufgeraeumt wird erst nach einem Monat Stille. */
  assert.equal(Object.keys(presence.data.players).length,2);
  time+=10*60*1000;r=await call(h,ca,'presence',{position:{...a.spawn,heading:1}});assert.equal(r.peers.length,0);assert.equal(Object.keys(presence.data.players).length,2);
  time+=35*24*60*60*1000;r=await call(h,ca,'presence',{position:{...a.spawn,heading:1}});assert.equal(r.status,200);assert.equal(Object.keys(presence.data.players).length,1);
});
await test('Presence in per-player fields: nobody blocks anybody, and the list is read at most once a second',async()=>{
  /* So liegt die Anwesenheit in Redis: ein Feld je Spieler (siehe lib/gehstockmon-anwesenheit.mjs). */
  let time=stamp,reads=0;const felder=new Map();
  const presence={
    async felder(key){reads++;await new Promise(setImmediate);return Object.fromEntries([...(felder.get(key)||new Map())].map(([k,v])=>[k,structuredClone(v)]));},
    async feldSetzen(key,feld,wert){await new Promise(setImmediate);const h=felder.get(key)||new Map();h.set(feld,structuredClone(wert));felder.set(key,h);},
    async felderWeg(key,weg){const h=felder.get(key);for(const f of weg)if(h)h.delete(f);},
    async getWithMetadata(){throw new Error('no document with fields');},async setJSON(){throw new Error('no document with fields');},
  };
  const store=memoryStore(),h=createHandler({store,presenceStore:presence,now:()=>time}),codes=Array.from({length:8},(_,i)=>codeAt(i)),joined=[];
  for(const c of codes)joined.push(await call(h,c,'join'));
  const all=await Promise.all(codes.map((c,i)=>call(h,c,'presence',{position:{...joined[i].spawn,heading:0}})));
  assert.ok(all.every(r=>r.status===200),'eight at once, nobody hears "Die Mitspieler werden gerade aktualisiert"');
  assert.equal(felder.get('anwesenheit-v2').size,8);
  time+=500;reads=0;
  const r=await call(h,codes[0],'presence',{position:{...joined[0].spawn,heading:0}});
  assert.equal(r.peers.length,7);assert.equal(reads,0,'half a second later the remembered list is enough');
  time+=1000;await call(h,codes[1],'presence',{position:{...joined[1].spawn,heading:0}});assert.equal(reads,1,'after a second it is read again');
  time+=15001;const later=await call(h,codes[0],'presence',{position:{...joined[0].spawn,heading:0}});
  assert.equal(later.peers.length,0,'fifteen seconds of silence hide the others');
  assert.equal(felder.get('anwesenheit-v2').size,8,'but their last positions stay as starting points');
  time+=10*60*1000;const back=await call(h,codes[0],'presence',{position:{...joined[0].spawn,heading:0}});
  assert.equal(back.status,200);
  assert.equal(felder.get('anwesenheit-v2').size,8,'ten minutes later the others still keep their last positions - they continue there when they come back');
  /* Aktionen lesen dieselben Felder: ohne frische Position keine Arbeit im Hafen, mit einer am Stadttor schon. */
  const p=store.data.players[joined[2].playerId];
  const ohne=await call(h,codes[2],'tagwerk');assert.match(ohne.error||'',/Kartenposition/);
  await presence.feldSetzen('anwesenheit-v2',joined[2].playerId,{id:joined[2].playerId,name:p.name,x:X.STADT_TOR.x,z:X.STADT_TOR.z,heading:0,activity:'map',updatedAt:time,spawnAt:p.lastJoinAt,credit:55,skin:p.skin,squad:p.truppe.slice(),eier:0});
  const mit=await call(h,codes[2],'tagwerk');assert.doesNotMatch(mit.error||'',/Kartenposition|Stockhafen/);
});
await test('A plain world poll writes only when more than the clocks changed, and no gold gets lost',async()=>{
  let time=Date.parse('2026-09-17T09:00:00+02:00'),writes=0;const store=memoryStore(),presence=memoryStore(),h=createHandler({store,presenceStore:presence,now:()=>time});
  const schreiben=store.setJSON;store.setJSON=async(...args)=>{writes++;return schreiben(...args);};
  const a=await call(h,ca,'join'),w=store.data,t=w.territories[1];
  t.ownerId=a.playerId;t.ownerName='Test A';t.level=3;await schreiben('world-v2',w,{});
  time+=1000;await call(h,ca,'world');                        // die neue Besitzlage wird einmal abgelegt
  writes=0;time+=30000;const poll=await call(h,ca,'world');
  assert.equal(writes,0,'thirty seconds later only the gold clock moved - nothing is written');
  time+=140000;const zweite=await call(h,ca,'world');assert.equal(writes,0,'still nothing to store before three minutes');
  assert.ok(zweite.profile.gold>poll.profile.gold,'the income keeps counting without being stored');
  /* Ein echter Schreibgrund zur selben Zeit muss auf dasselbe Gold kommen. */
  await call(h,ca,'world',{name:'Test A neu'});assert.equal(writes,1,'a new name is written');
  assert.equal(store.data.players[a.playerId].gold,zweite.profile.gold,'stored gold equals what the polls showed');
  writes=0;time+=3*60*1000;await call(h,ca,'world');assert.equal(writes,1,'"last seen" is stored at least every three minutes');
});
await test('A short absence keeps the walked position instead of resetting to the spawn',async()=>{
  let time=stamp;const store=memoryStore(),presence=memoryStore(),h=createHandler({store,presenceStore:presence,now:()=>time});
  const a=await call(h,ca,'join'),layout=X.layout(store.data.territories),id=a.playerId,start=a.spawn;
  const punkt=(w,d)=>({x:Math.round((start.x+Math.sin(w)*d)*100)/100,z:Math.round((start.z+Math.cos(w)*d)*100)/100});
  let w=0;for(;w<Math.PI*2;w+=Math.PI/36){const p1=punkt(w,25),p2=punkt(w,50);if(X.onLand(p1)&&X.onLand(p2)&&X.route(layout,start,p1,id,25.1)&&X.route(layout,p1,p2,id,25.1))break;}
  assert.ok(w<Math.PI*2,'a straight walkable line leaves the spawn');
  assert.equal((await call(h,ca,'presence',{position:{...start,heading:0}})).positionCorrected,undefined);
  time+=3000;assert.equal((await call(h,ca,'presence',{position:{...punkt(w,25),heading:w}})).positionCorrected,undefined);
  time+=3000;assert.equal((await call(h,ca,'presence',{position:{...punkt(w,50),heading:w}})).positionCorrected,undefined);
  /* Zwanzig Sekunden in einer anderen App. Frueher war der eigene Stand dann verfallen, und der naechste Schritt zaehlte vom Start aus. */
  time+=20000;assert.equal((await call(h,ca,'presence',{position:{...punkt(w,50),heading:w}})).positionCorrected,undefined);
  /* Laufen darf man trotzdem nur so weit, wie die Zeit hergibt: fuenf Sekunden Vorrat, nicht zwanzig. */
  time+=20000;const weit=await call(h,ca,'presence',{position:{...punkt(w,-20),heading:w}});assert.equal(weit.positionCorrected,true);
});
await test('Reloading, a reconnect, a long dungeon and the next morning all continue where you stood',async()=>{
  let time=stamp;const store=memoryStore(),presence=memoryStore(),h=createHandler({store,presenceStore:presence,now:()=>time});
  const a=await call(h,ca,'join'),layout=X.layout(store.data.territories),id=a.playerId,start=a.spawn;
  const punkt=(w,d)=>({x:Math.round((start.x+Math.sin(w)*d)*100)/100,z:Math.round((start.z+Math.cos(w)*d)*100)/100});
  let w=0;for(;w<Math.PI*2;w+=Math.PI/36){const p1=punkt(w,25),p2=punkt(w,50);if(X.onLand(p1)&&X.onLand(p2)&&X.route(layout,start,p1,id,25.1)&&X.route(layout,p1,p2,id,25.1))break;}
  assert.ok(w<Math.PI*2,'a straight walkable line leaves the spawn');
  const schritt=async(p)=>(await call(h,ca,'presence',{position:{...p,heading:w}})).positionCorrected;
  await schritt(start);time+=3000;await schritt(punkt(w,25));time+=3000;assert.equal(await schritt(punkt(w,50)),undefined);
  /* Neu laden (oder nach einem Aussetzer neu verbinden): dort weiter, wo man zuletzt gemeldet war. Frueher ging es zurueck an den Start. */
  time+=5000;const neu=await call(h,ca,'join');
  assert.deepEqual(neu.spawn,punkt(w,50),'a reload starts at the last reported position');
  time+=3000;assert.equal(await schritt(punkt(w,45)),undefined,'and walking on from there is accepted');
  /* Das Tablet war waehrend eines Gruppen-Dungeons elf Minuten gesperrt. Frueher war der Stand dann verfallen, und der naechste Schritt zaehlte vom Start aus. */
  time+=11*60*1000;assert.equal(await schritt(punkt(w,40)),undefined,'eleven minutes without a report keep the position');
  /* Am naechsten Morgen: dieselbe Stelle. */
  time=H.access(H.access(time).closesAt).nextOpenAt+60000;const morgen=await call(h,ca,'join');
  assert.deepEqual(morgen.spawn,punkt(w,40),'the next morning starts where the day ended');
  /* Wer noch nie gemeldet war, beginnt am Start. */
  const b=await call(h,cb,'join');assert.deepEqual(b.spawn,X.outside(X.SPAWN,X.layout(store.data.territories)));
});
await test('A last position behind walls that changed hands starts in front of their gate',async()=>{
  let time=stamp;const store=memoryStore(),presence=memoryStore(),h=createHandler({store,presenceStore:presence,now:()=>time});
  const a=await call(h,ca,'join'),b=await call(h,cb,'join'),feld=3,innen={x:D.BIOME[feld-1].x,z:D.BIOME[feld-1].z};
  /* A stand zuletzt mitten in seinem Aussenposten. Waehrend er weg war, hat B ihn erobert. */
  await presence.setJSON('presence-v1',{players:{[a.playerId]:{id:a.playerId,name:'Test A',...innen,heading:0,activity:'map',updatedAt:time,spawnAt:0,credit:55}}},{onlyIfNew:true});
  Object.assign(store.data.territories[feld-1],{ownerId:b.playerId,ownerName:'Test B'});
  time+=60000;const zurueck=await call(h,ca,'join');
  const mauer=X.layout(store.data.territories).find(g=>g.fields.includes(feld));
  assert.ok(!X.inside(zurueck.spawn,mauer),'never inside walls that belong to someone else');
  assert.ok(Math.hypot(zurueck.spawn.x-mauer.gate.x,zurueck.spawn.z-mauer.gate.z)<10,'but right in front of their gate, not back at the start');
  time+=3000;assert.equal((await call(h,ca,'presence',{position:{...zurueck.spawn,heading:0}})).positionCorrected,undefined,'and the path check agrees');
});
await test('Berlin opening boundaries include Friday, block weekends and follow daylight saving',()=>{
  for(const [day,close] of [[14,13],[15,13],[16,14],[17,15],[18,13]]) {
    const start=Date.parse('2026-09-'+day+'T07:00:00+02:00'),end=start+(close-7)*E.HOUR;
    assert.equal(H.access(start-1).open,false);assert.equal(H.access(start).open,true);assert.equal(H.access(end-1).open,true);assert.equal(H.access(end).open,false);
  }
  for(const date of ['2026-09-19T00:00:00+02:00','2026-09-20T12:00:00+02:00','2026-09-21T06:59:59+02:00'])assert.equal(H.access(Date.parse(date)).open,false);
  for(const [closed,open] of [['2026-10-24T12:00:00+02:00','2026-10-26T07:00:00+01:00'],['2027-03-27T12:00:00+01:00','2027-03-29T07:00:00+02:00']])assert.equal(H.access(Date.parse(closed)).nextOpenAt,Date.parse(open));
});
await test('Closed server rejects every operation and spoofed client clocks without changing stores',async()=>{
  let time=Date.parse('2026-09-18T12:59:59+02:00');const store=memoryStore(),presence=memoryStore(),h=createHandler({store,presenceStore:presence,now:()=>time});await call(h,ca,'join');
  const before=JSON.stringify(store.data);time+=1000;
  for(const op of ['join','world','presence','arena_start','arena_turn','arena_flee','collect','incubate','hatch','upgrade','defend',...X.OPS]) {
    const r=await call(h,ca,op,{serverTime:stamp,now:stamp,position:{x:0,z:0,heading:0}});assert.equal(r.status,423,op);assert.equal(r.access.open,false);assert.equal(r.profile,undefined);
  }
  assert.equal(JSON.stringify(store.data),before);assert.equal(presence.data,null);
  time=Date.parse('2026-09-21T07:00:00+02:00');assert.equal((await call(h,ca,'join')).status,200);
  const lateStore=memoryStore();let checks=0;const late=createHandler({store:lateStore,now:()=>Date.parse('2026-09-21T12:59:59.999+02:00')+(checks++?1:0)});
  assert.equal((await call(late,ca,'join')).status,423);assert.equal(lateStore.data,null,'a request crossing closing time cannot commit');
});
await test('Admin developer code opens one shared, temporary multiplayer testzone',async()=>{
  const time=Date.parse('2026-09-19T12:00:00+02:00'),store=memoryStore(),presence=memoryStore(),h=createHandler({store,presenceStore:presence,now:()=>time}),secondAdmin='0585';
  const normal=await call(h,cb,'join',{adminOverride:true,adminCode:'3141'});assert.equal(normal.status,423);assert.equal(store.data,null);
  const typo=await call(h,ca,'join',{adminOverride:true,adminCode:'3140'});assert.equal(typo.status,423);assert.equal(store.data,null);
  const admin=await call(h,ca,'join',{adminOverride:true,adminCode:'3141'}),teammate=await call(h,secondAdmin,'join',{adminOverride:true,adminCode:'3141'});
  assert.equal(admin.status,200);assert.equal(teammate.status,200);assert.equal(admin.access.open,true);assert.equal(admin.access.adminOverride,true);
  /* Zum Testen gehoert auch das Bruten: sieben Luecken in der Sammlung und drei Eier in der Tasche. */
  assert.equal(admin.profile.besitz.length,D.KATALOG.length-D.SELTENHEITEN.length,'aus jeder Seltenheit fehlt eines');
  assert.equal(E.schlupfChancen(admin.profile).length,D.SELTENHEITEN.length,'die Chancenanzeige hat etwas zu zeigen');
  assert.equal(admin.profile.eggs.length,3);assert.ok(D.STARTER.every(id=>admin.profile.besitz.includes(id)),'die Truppe gehoert ihm');
  assert.equal(admin.profile.eggs.filter(e=>e.readyAt!==null&&e.readyAt<=time).length,2,'zwei Eier sind sofort schluepfbereit');
  const geschluepft=await call(h,ca,'hatch',{adminOverride:true,adminCode:'3141',eggId:'testzone-ei-1'});
  assert.equal(geschluepft.status,200,geschluepft.error);assert.ok(geschluepft.monId,'in der Testzone kommt ein Mon, kein Gold');
  assert.equal(admin.profile.gold,50000);
  const fight=await call(h,ca,'arena_start',{adminOverride:true,adminCode:'3141',territoryId:1,version:1,squad:D.neuerStand().truppe});assert.equal(fight.status,200);
  await call(h,ca,'presence',{adminOverride:true,adminCode:'3141',position:{x:admin.spawn.x,z:admin.spawn.z,heading:0}});
  const together=await call(h,secondAdmin,'presence',{adminOverride:true,adminCode:'3141',position:{x:teammate.spawn.x,z:teammate.spawn.z,heading:0}});
  assert.equal(together.peers.length,1);assert.equal(together.peers[0].id,admin.playerId);assert.equal(together.peers[0].activity,'arena');
  const seenBack=await call(h,ca,'presence',{adminOverride:true,adminCode:'3141',position:{x:admin.spawn.x,z:admin.spawn.z,heading:0}});assert.equal(seenBack.peers[0].id,teammate.playerId);
  assert.equal(store.data,null,'Testzone schreibt niemals in den Spielspeicher');assert.equal(presence.data,null,'Testzone schreibt niemals in die echte Anwesenheit');
  assert.equal((await call(h,ca,'world')).status,423,'ohne Testzone bleibt die Insel zu');
});
await test('Each completed weekend gives two eggs per held post once, preserving overflow and ownership rewards',async()=>{
  let time=Date.parse('2026-09-11T07:00:00+02:00');const store=memoryStore(),h=createHandler({store,now:()=>time});const a=await call(h,ca,'join');await call(h,cb,'join');
  const p=store.data.players[a.playerId];for(const t of store.data.territories)Object.assign(t,{ownerId:a.playerId,...E.outpost(null,time)});
  p.eggs=Array.from({length:11},(_,i)=>({id:'saved-'+i,territoryId:1,producedAt:time,startedAt:time,readyAt:time+E.HOUR}));
  time=Date.parse('2026-09-14T07:00:00+02:00');const results=await Promise.all([call(h,ca,'join'),call(h,ca,'join')]);
  assert.equal(results.reduce((sum,r)=>sum+(r.weekendDelivery||0),0),1);let r=await call(h,ca,'world');assert.equal(r.profile.eggs.length,12);assert.equal(Object.values(r.profile.weekendEggs).reduce((a,b)=>a+b,0),17);assert.equal(r.profile.eggs[0].readyAt,Date.parse('2026-09-11T08:00:00+02:00'));
  r=await call(h,ca,'hatch',{eggId:'saved-0',requestId:'weekend-hatch-once'});assert.equal(r.weekendDelivery,1);assert.equal(r.profile.eggs.length,12);assert.equal(Object.values(r.profile.weekendEggs).reduce((a,b)=>a+b,0),16);
  const retry=await call(h,ca,'hatch',{eggId:'saved-0',requestId:'weekend-hatch-once'});assert.equal(retry.duplicate,true);assert.deepEqual(retry.profile.weekendEggs,r.profile.weekendEggs);
  const other=await call(h,cb,'world');assert.equal(other.profile.eggs.length,0);assert.deepEqual(other.profile.weekendEggs,{});
  // Previously earned gifts belong to the old owner even if a territory changes later.
  store.data.territories[0].ownerId=other.playerId;Object.assign(store.data.territories[0],E.outpost(null,time));
  time=Date.parse('2026-09-28T07:00:00+02:00');r=await call(h,ca,'join');assert.equal(Object.values(r.profile.weekendEggs).reduce((a,b)=>a+b,0),48);
  const b=await call(h,cb,'join');assert.equal(b.profile.eggs.length,4);assert.equal((await call(h,cb,'join')).profile.eggs.length,4);
});
await test('Weekend replaces normal egg production, retains partial cycles and ignores DST length',()=>{
  for(const [friday,monday] of [['2026-09-18T12:00:00+02:00','2026-09-21T07:00:00+02:00'],['2026-10-23T12:00:00+02:00','2026-10-26T07:00:00+01:00'],['2027-03-26T12:00:00+01:00','2027-03-29T07:00:00+02:00']]) {
    const start=Date.parse(friday),end=Date.parse(monday),p=D.neuerStand(null,start),post=E.outpost(null,start);E.settle(p,post,end);assert.equal(post.eggStock,0);assert.equal(E.nextEggAt(post),end+E.HOUR);E.weekend(p,post,1,end);assert.equal(p.weekendEggs[1],2);E.weekend(p,post,1,end);assert.equal(p.weekendEggs[1],2);E.settle(p,post,end+E.HOUR);assert.equal(post.eggStock,1);
  }
  assert.equal(H.weekends(Date.parse('2026-09-12T01:00:00+02:00'),Date.parse('2026-09-14T07:00:00+02:00')).count,0,'ownership must precede the weekend');
  assert.equal(H.weekends(0,Date.parse('2026-09-14T07:00:00+02:00')).count,1,'no rewards before introduction');
});
await test('The gift tool hands over Mons and territories and leaves another player untouched',async()=>{
  const store=memoryStore(),h=createHandler({store,now:()=>stamp});const a=await call(h,ca,'join'),b=await call(h,cb,'join');
  assert.equal(a.playerId,spielerId(ca),'Werkzeug und Server leiten dieselbe Spielerkennung ab');
  const eintrag=await store.getWithMetadata('world-v2'),welt=structuredClone(eintrag.data);
  welt.territories[6].ownerId=b.playerId;
  assert.throws(()=>schenken(welt,{code:ca,gebiete:[7],now:stamp}),/Test B/,'fremde Gebiete nur mit --wegnehmen');
  const bericht=schenken(welt,{code:ca,mons:['sturmhorn','seelenqualle','obsidianrabe','mondhexe'],gebiete:[2,4,5],now:stamp});
  assert.deepEqual(bericht.gebiete,[2,4,5]);assert.equal((await store.setJSON('world-v2',welt,{onlyIfMatch:eintrag.etag})).modified,true);
  const r=await call(h,ca,'world');for(const id of ['sturmhorn','seelenqualle','obsidianrabe','mondhexe'])assert.ok(r.profile.besitz.includes(id),id);
  assert.deepEqual(r.profile.geschafft,[2,4,5]);assert.deepEqual(r.territories.filter(t=>t.ownerId===a.playerId).map(t=>t.id),[2,4,5]);
  assert.deepEqual(r.territories[1].defense.map(d=>d.id),r.profile.truppe,'der Außenposten verteidigt sich mit seiner Truppe');
  assert.deepEqual((await call(h,cb,'world')).profile.geschafft,[7],'das Gebiet des Partners bleibt seins');
  const nochmal=schenken(structuredClone(welt),{code:ca,mons:['sturmhorn'],gebiete:[2],now:stamp});
  assert.deepEqual([nochmal.mons,nochmal.gebiete],[[],[]],'ein zweiter Lauf ändert nichts');
});
await test('Only an admin hands out Mons and territories, also outside opening hours, and every gift is written down',async()=>{
  const store=memoryStore(),h=createHandler({store,now:()=>stamp});
  assert.equal((await call(h,cb,'admin_grant',{zielCode:cb,mons:['mondhexe']})).status,403,'ein Spieler darf nicht verschenken');
  assert.equal((await call(h,cb,'admin_log')).status,403);
  assert.equal((await call(h,ca,'admin_grant',{zielCode:'1234',mons:['mondhexe']})).status,400,'den Code gibt es nicht');
  // Der Admin hat die Spielerwelt nie betreten - verwalten kann er sie trotzdem.
  let r=await call(h,ca,'admin_grant',{zielCode:cb,zielName:'Test B',mons:['mondhexe','sturmhorn'],gebiete:[3]});
  assert.equal(r.status,200,r.error);assert.deepEqual([r.bericht.mons,r.bericht.gebiete],[['mondhexe','sturmhorn'],[3]]);
  const beschenkt=await call(h,cb,'join');
  assert.ok(beschenkt.profile.besitz.includes('mondhexe'));assert.deepEqual(beschenkt.profile.geschafft,[3]);
  assert.equal(beschenkt.territories[2].ownerName,'Test B');
  let buch=(await call(h,ca,'admin_log')).schenkungen;
  assert.equal(buch.length,1);assert.equal(buch[0].anName,'Test B');assert.equal(buch[0].vonName,'Test A');assert.equal(buch[0].selbst,false);
  assert.deepEqual([buch[0].mons,buch[0].gebiete],[['mondhexe','sturmhorn'],[3]]);
  // Sich selbst beschenken geht - und steht als solches im Buch.
  await call(h,ca,'admin_grant',{zielCode:ca,zielName:'Test A',mons:['leerenwyrm']});
  buch=(await call(h,ca,'admin_log')).schenkungen;
  assert.equal(buch.length,2);assert.equal(buch[0].selbst,true,'jüngste Schenkung zuerst');
  // Ein zweites Mal dasselbe schenken ändert nichts und schreibt nichts.
  r=await call(h,ca,'admin_grant',{zielCode:cb,mons:['mondhexe'],gebiete:[3]});
  assert.deepEqual([r.bericht.mons,r.bericht.gebiete],[[],[]]);assert.equal(r.schenkungen.length,2);
  // Fremde Gebiete nur ausdrücklich.
  assert.equal((await call(h,ca,'admin_grant',{zielCode:ca,gebiete:[3]})).error,'Gebiet 3 (Aschenklippen) gehört Test B.');
  assert.equal((await call(h,ca,'admin_grant',{zielCode:ca,gebiete:[3],wegnehmen:true})).status,200);
  // Geschlossen ist die Insel nur für Spielzüge.
  const zu=createHandler({store,now:()=>Date.parse('2026-09-18T13:00:00+02:00')});
  assert.equal((await call(zu,ca,'world')).status,423);
  assert.equal((await call(zu,ca,'admin_grant',{zielCode:cb,mons:['nachtflatter']})).status,200);
  assert.equal((await call(zu,ca,'admin_log')).status,200);
});
await test('The admin gift tab and the server agree on every field',async()=>{
  const store=memoryStore(),h=createHandler({store,now:()=>stamp});
  const SG={ui:{el:()=>({}),empty:()=>({}),modal:()=>({close(){}}),toast:()=>{},confirm:()=>Promise.resolve(false),clear:()=>{},remove:()=>{}},
    auth:{aktuell:{code:ca,name:'Test A'},liste:()=>[],schoen:(c)=>c},env:{},offline:false,audio:{play(){}},protokoll:{schreiben(){}},gehstockmon:{}};
  const fetchStub=async(url,opts)=>{const res=await h(new Request('http://localhost'+url,{method:opts.method,body:opts.body}));
    return {ok:res.ok,status:res.status,headers:{get:(k)=>res.headers.get(k)},json:()=>res.json()};};
  vm.runInContext(fs.readFileSync('src/core/geschenke.js','utf8'),vm.createContext({SG,fetch:fetchStub,Promise,Object,Math,Date,Number,String,JSON,console}));
  const G=SG.geschenke;
  assert.deepEqual((await G.senden('admin_log',{})).schenkungen,[]);
  const r=await G.senden('admin_grant',{zielCode:cb,zielName:'Test B',mons:['sturmhorn'],gebiete:[2],gold:500,eier:2,wegnehmen:false,requestId:'geschenk-0001'});
  assert.deepEqual([r.bericht.mons,r.bericht.gebiete,r.bericht.gold,r.bericht.eier,r.bericht.neu],[['sturmhorn'],[2],500,2,true]);
  const buch=(await G.senden('admin_log',{})).schenkungen;
  assert.equal(buch.length,1);assert.equal(buch[0].vonName,'Test A');assert.equal(buch[0].quelle,'Adminmenü');assert.equal(buch[0].eier,2);
  await assert.rejects(G.senden('admin_grant',{zielCode:ca,zielName:'Test A',mons:[],gebiete:[2],gold:0,requestId:'geschenk-0002'}),
    (e)=>/^Gebiet \d+ .* gehört /.test(e.message),'die Oberfläche erkennt genau diesen Wortlaut wieder');
  SG.auth.aktuell={code:cb,name:'Test B'};
  await assert.rejects(G.senden('admin_grant',{zielCode:cb,mons:['endrichter'],gebiete:[],gold:0,requestId:'geschenk-0003'}),/nur ein Administrator/);
});
await test('Gifted eggs land raw in the bag, respect the twelve-egg limit and are written down',async()=>{
  const store=memoryStore(),h=createHandler({store,now:()=>stamp});
  let r=await call(h,ca,'admin_grant',{zielCode:cb,zielName:'Test B',eier:3});
  assert.equal(r.status,200,r.error);assert.equal(r.bericht.eier,3);assert.equal(r.bericht.eierAbgelehnt,0);
  const b=await call(h,cb,'join');
  assert.equal(b.profile.eggs.length,3);
  assert.ok(b.profile.eggs.every(e=>e.startedAt===null&&e.readyAt===null),'roh, nicht vorgebrütet');
  assert.equal(new Set(b.profile.eggs.map(e=>e.id)).size,3,'jedes Ei hat seine eigene Kennung');
  assert.ok(b.profile.eggs.every(e=>D.FELDER.some(f=>f.id===e.territoryId)),'Herkunftsgebiet gibt es');
  // Die Tasche fasst zwölf: was nicht hineinpasst, wird gemeldet statt still verworfen.
  r=await call(h,ca,'admin_grant',{zielCode:cb,eier:20});
  assert.equal(r.bericht.eier,E.BAG_LIMIT-3);assert.equal(r.bericht.eierAbgelehnt,20-(E.BAG_LIMIT-3));
  assert.equal((await call(h,cb,'world')).profile.eggs.length,E.BAG_LIMIT);
  // Volle Tasche: gar nichts mehr, und das steht auch nicht im Buch.
  const vorher=(await call(h,ca,'admin_log')).schenkungen.length;
  r=await call(h,ca,'admin_grant',{zielCode:cb,eier:5});
  assert.equal(r.bericht.eier,0);assert.equal(r.bericht.eierAbgelehnt,5);
  const buch=(await call(h,ca,'admin_log')).schenkungen;
  assert.equal(buch.length,vorher,'ein wirkungsloses Geschenk kommt nicht ins Buch');
  assert.equal(buch[0].eier,E.BAG_LIMIT-3,'das Buch nennt die Zahl der Eier');
  // Ein geschenktes Ei lässt sich ganz normal ausbrüten.
  const ei=(await call(h,cb,'world')).profile.eggs[0].id;
  assert.equal((await call(h,cb,'incubate',{eggId:ei})).status,200);
});
console.log('\n'+passed+' GehstockMon regression checks passed.');
