/* Stockhafen: Grosse Arena, Champion, Hafenarbeit - und die Geometrie, die
   dafuer sorgt, dass das Arenarund ein Hindernis bleibt und trotzdem jeder
   Weg der Insel offen steht. */
import assert from 'node:assert/strict';
import {data as D,economy as E,arena as A,hours as H,adventure as X} from '../netlify/functions/lib/gehstockmon-rules.mjs';
import {createHandler} from '../netlify/functions/gehstockmon.mjs';
const at=s=>Date.parse(s),mon=at('2026-09-21T08:00:00+02:00');
let checks=0;async function test(name,fn){await fn();checks++;console.log('ok',name);}
function store(){let data=null,v=0;return{get data(){return data;},async getWithMetadata(){return data?{data:structuredClone(data),etag:String(v)}:null;},async setJSON(k,next,o){if(o.onlyIfNew&&data||o.onlyIfMatch!==undefined&&o.onlyIfMatch!==String(v))return{modified:false};data=structuredClone(next);v++;return{modified:true};}};}
function codeAt(index){let codes=[];for(let n=0;n<10000;n++){const code=String(n).padStart(4,'0'),text='code:'+code+':gehstock:hideout:2026:kellergewoelbe';let h=0x811c9dc5;for(const c of text){h^=c.charCodeAt(0);h=(h+(h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24))>>>0;}if(h%97===0)codes.push(code);}return codes[index];}
const ca=codeAt(0),cb=codeAt(1);
/* Ein brauchbarer Zug fuer die Testkaempfe: Kraftschlag, sobald er geladen ist. */
function zug(b){if(b.phase==='replace')return{kind:'switch',slot:b.teams[0].findIndex(m=>m.hp>0)};
  const u=b.teams[0][b.active[0]];return{kind:'move',move:b.round>=u.powerReady?'power':'strike'};}
/* Stellt eine Figur direkt an einen Punkt. Ob der Weg dorthin begehbar ist,
   prueft der Geometrietest weiter oben - hier geht es um die Stadtlogik. */
async function hinstellen(presence,db,id,punkt,zeit){
  const p=db.data.players[id];
  await presence.setJSON('presence-v1',{players:{[id]:{id,name:p.name,x:punkt.x,z:punkt.z,heading:0,activity:'map',updatedAt:zeit,spawnAt:p.lastJoinAt,credit:33,skin:p.skin,weapon:p.weapon,squad:p.truppe.slice(),protected:false,eier:p.eggs.length}}},{});
}

await test('The arena ring blocks every step through it while the town around it stays open',()=>{
  assert.equal(X.walkable(X.ARENA_BAU),false,'the middle of the ring is solid');
  assert.equal(X.walkable(X.STADT_TOR),true,'the gate forecourt is walkable');
  assert.equal(X.inStadt(X.STADT_TOR),true,'and it counts as being in town');
  /* Ein gerader Weg quer durch die Mitte muss scheitern, der Bogen aussen herum gelingen. */
  const B=X.ARENA_BAU,west={x:B.x-B.radius-6,z:B.z},ost={x:B.x+B.radius+6,z:B.z};
  assert.equal(X.canTravel([],west,ost,'me'),false,'no straight line through the arena');
  const weg=X.route([],west,ost,'me');
  assert.ok(weg,'but a route exists around it');
  let p=west;for(const q of weg){assert.ok(X.canTravel([],p,q,'me'));p=q;}
  /* Jeder Punkt des Weges liegt ausserhalb des Rundes. */
  for(const q of weg)assert.equal(X.imArenaBau(q),false);
});
await test('Every gate stays reachable from spawn for all ownership masks, arena included',()=>{
  for(let mask=0;mask<512;mask+=37){
    const layout=X.layout(D.FELDER.map((f,i)=>({id:f.id,ownerId:mask>>i&1?'rival':null})));
    const from=X.outside(X.SPAWN,layout);
    assert.equal(layout.some(g=>X.inside(X.STADT_TOR,g)),false,'mask '+mask+': the town never lands inside a territory');
    assert.ok(X.route(layout,from,X.STADT_TOR,'visitor'),'mask '+mask+': the town is reachable');
    for(const g of layout){const end={x:g.gate.x+g.gate.nx*4,z:g.gate.z+g.gate.nz*4};assert.ok(X.route(layout,from,end,'visitor'),'mask '+mask+', gate '+g.id);}
  }
});
await test('Rune levels stay under the next rarity and unlock the two thresholds',()=>{
  /* Die Prozente duerfen keine Seltenheitsstufe ueberbruecken - das ist die
     Grenze, an der der Bonus haengt. */
  for(let role=0;role<4;role++)for(let rarity=0;rarity<6;rarity++){
    const voll=A.stats({typ:role,seltenheit:rarity,upgrade:X.UPGRADE_LIMIT});
    const naechste=A.stats({typ:role,seltenheit:rarity+1,upgrade:0});
    assert.ok(voll.hp<naechste.hp&&voll.ang<naechste.ang,'rarity '+rarity+' role '+role);
  }
  const roh=D.mon('moosling');
  assert.equal(A.ladungen({...roh,upgrade:A.LADUNG_AB-1}),A.LADUNGEN);
  assert.equal(A.ladungen({...roh,upgrade:A.LADUNG_AB}),A.LADUNGEN+1);
  assert.equal(A.powerPause({...roh,upgrade:A.SCHNELL_AB-1}),A.POWER_PAUSE);
  assert.equal(A.powerPause({...roh,upgrade:A.SCHNELL_AB}),A.POWER_PAUSE-1);
  /* Die Werte muessen auch wirklich im Kampf ankommen. */
  let b=A.create([{...roh,upgrade:X.UPGRADE_LIMIT}],[{...roh,upgrade:0}],{});
  assert.equal(b.teams[0][0].maxCharges,A.LADUNGEN+1);
  assert.equal(b.teams[1][0].maxCharges,A.LADUNGEN);
  b=A.turn(b,{kind:'move',move:'power'});
  assert.equal(b.teams[0][0].powerReady,1+A.POWER_PAUSE-1,'a level 5 Mon reloads one round earlier');
});
await test('Territory 7 is a real step up: four legendaries, a healer and its own bonus',()=>{
  const feld7=A.defenders(7);
  assert.equal(feld7.length,4);
  assert.ok(feld7.every(m=>m.seltenheit===4),'all four are legendary');
  assert.deepEqual(feld7.map(m=>m.typ).sort(),[0,1,2,3],'one of every role, healer included');
  /* Gegen die Startertruppe darf es nicht zu gewinnen sein - genau wie 8 und 9. */
  for(const id of [7,8,9]){
    let b=A.create(D.STARTER.map(D.mon),A.defenders(id),{territoryId:id,npcTerritory:true});
    for(let i=0;b.phase!=='finished'&&i<200;i++)b=A.turn(b,b.phase==='replace'?{kind:'switch',slot:b.teams[0].findIndex(m=>m.hp>0)}:{kind:'move',move:'strike'});
    assert.notEqual(b.winner,'wir','field '+id+' must not fall to starters');
  }
  /* Und schwerer als das Feld davor: mehr Gesamt-KP auf der Gegenseite. */
  const kp=id=>A.create(D.STARTER.map(D.mon),A.defenders(id),{territoryId:id,npcTerritory:true}).teams[1].reduce((s,u)=>s+u.maxHp,0);
  assert.ok(kp(7)>kp(6),'harder than the Tauwiese before it');
  assert.ok(kp(7)<kp(8),'but still below the Donnergrat');
});
await test('The house holds the title until a player takes it, and the ladder gates the challenge',async()=>{
  let time=mon;const db=store(),presence=store(),handler=createHandler({store:db,presenceStore:presence,now:()=>time});let serial=0;
  async function call(code,op,extra={}){const r=await handler(new Request('http://localhost/api/gehstockmon',{method:'POST',body:JSON.stringify({code,op,name:code,requestId:'stadt-test-'+(++serial),...extra})}));return{status:r.status,...await r.json()};}
  const a=await call(ca,'join');
  assert.equal(a.turnier.champion.haus,true,'the house holds the belt from the first minute');
  assert.equal(a.turnier.champion.name,X.HAUSMEISTER.name);
  assert.equal(a.turnier.ruhm,X.RUHM_START);
  assert.ok(a.turnier.gegner.length>=X.ARENA_GEGNER.length,'house challengers are always on the list');
  /* Ohne Ranglistensiege kein Titelkampf, und ohne Stadtposition gar nichts. */
  let r=await call(ca,'champion_fordern');
  assert.equal(r.status,400);assert.match(r.error,/Kartenposition/);
  await hinstellen(presence,db,a.playerId,X.STADT_TOR,time);
  r=await call(ca,'champion_fordern');
  assert.equal(r.status,400);assert.match(r.error,/Ranglistensiege/);
  /* Ein Ranglistenkampf gegen einen Gegner des Hauses. */
  r=await call(ca,'arena_rang',{targetId:'haus-1'});
  assert.equal(r.status,200,r.error);
  assert.equal(r.arena.kind,'rang');
  const ruhmVorher=a.turnier.ruhm;
  for(let i=0;r.arena.phase!=='finished'&&i<200;i++)r=await call(ca,'arena_turn',{battleId:r.arena.id,revision:r.arena.revision,action:zug(r.arena)});
  assert.equal(r.arena.phase,'finished');
  assert.notEqual(r.turnier.ruhm,ruhmVorher,'a ladder fight always moves the score');
  /* Die Pause greift sofort. */
  const zweiter=await call(ca,'arena_rang',{targetId:'haus-1'});
  assert.equal(zweiter.status,400);assert.match(zweiter.error,/Ranglistenkampf/);
  /* Der Gegner hat davon nichts gemerkt: er war nie verbunden. */
  const b=await call(cb,'join');
  assert.equal(b.turnier.champion.haus,true);
});
await test('Winning the title moves the belt, freezes the squad and pays a daily wage',async()=>{
  let time=mon;const db=store(),presence=store(),handler=createHandler({store:db,presenceStore:presence,now:()=>time});let serial=0;
  async function call(code,op,extra={}){const r=await handler(new Request('http://localhost/api/gehstockmon',{method:'POST',body:JSON.stringify({code,op,name:code,requestId:'titel-test-'+(++serial),...extra})}));return{status:r.status,...await r.json()};}
  const a=await call(ca,'join');
  await hinstellen(presence,db,a.playerId,X.STADT_TOR,time);
  /* Direkt qualifizieren und den Hausmeister mit einer Truppe schlagen, die
     ihm gewachsen ist. */
  const p=db.data.players[a.playerId];
  p.besitz=D.KATALOG.map(k=>k.id);p.truppe=['endrichter','nullwyrm','chronoschreiter','aetherdrache'];
  p.arenaSiege=X.TITEL_SIEGE;
  let r=await call(ca,'champion_fordern');
  assert.equal(r.status,200,r.error);
  assert.equal(r.arena.kind,'champion');
  for(let i=0;r.arena.phase!=='finished'&&i<200;i++)r=await call(ca,'arena_turn',{battleId:r.arena.id,revision:r.arena.revision,action:zug(r.arena)});
  assert.equal(r.arena.winner,'wir','an apocalyptic squad beats the house master');
  assert.equal(r.turnier.champion.selbst,true);
  assert.equal(r.turnier.champion.haus,false);
  assert.deepEqual(r.turnier.champion.squad.map(e=>e.id),p.truppe,'the winning line-up is what defends the belt');
  assert.equal(r.turnier.siege,0,'the ladder resets after a title fight');
  assert.ok(r.turnier.chronik.length>=1,'the house holder is written into the chronicle');
  /* Der Sold kommt mit dem Tageswechsel und wird beim Eintreten ausgezahlt. */
  const goldVorher=r.profile.gold;
  time=mon+2*86400000;
  const spaeter=await call(ca,'join');
  assert.equal(spaeter.profile.gold-goldVorher>=2*X.CHAMPION_SOLD,true,'two days of champion wages arrive at once');
  /* Wer den Titel haelt, kann sich nicht selbst fordern. */
  await hinstellen(presence,db,a.playerId,X.STADT_TOR,time);
  const selbst=await call(ca,'champion_fordern');
  assert.equal(selbst.status,400);assert.match(selbst.error,/bereits/);
});
await test('Without a territory the harbour keeps a player going, and an outpost closes it',async()=>{
  let time=mon;const db=store(),presence=store(),handler=createHandler({store:db,presenceStore:presence,now:()=>time});let serial=0;
  async function call(code,op,extra={}){const r=await handler(new Request('http://localhost/api/gehstockmon',{method:'POST',body:JSON.stringify({code,op,name:code,requestId:'hafen-test-'+(++serial),...extra})}));return{status:r.status,...await r.json()};}
  const a=await call(ca,'join');
  assert.equal(a.stadt.ohneGebiet,true);
  await hinstellen(presence,db,a.playerId,X.STADT_TOR,time);
  /* Am ersten Tag ist noch nichts reif: beide Uhren starten beim Eintritt. */
  assert.equal(a.stadt.tagwerk,0);
  let r=await call(ca,'tagwerk');
  assert.equal(r.status,400);assert.match(r.error,/keine Arbeit/);
  /* Nach zwei geoeffneten Stunden liegt ein Auftrag bereit. */
  time=mon+2*E.HOUR;
  await hinstellen(presence,db,a.playerId,X.STADT_TOR,time);
  const vorher=(await call(ca,'world')).profile.gold;
  r=await call(ca,'tagwerk');
  assert.equal(r.status,200,r.error);
  assert.equal(r.profile.gold,vorher+X.TAGWERK_LOHN);
  /* Nach vier Stunden gibt das Findelhaus ein Ei - der einzige Nachschub ohne Land. */
  time=mon+4*E.HOUR;
  await hinstellen(presence,db,a.playerId,X.STADT_TOR,time);
  const eier=(await call(ca,'world')).profile.eggs.length;
  r=await call(ca,'findelei');
  assert.equal(r.status,200,r.error);
  assert.equal(r.profile.eggs.length,eier+1);
  /* Wer ein Gebiet haelt, bekommt beides nicht mehr. */
  Object.assign(db.data.territories[0],{ownerId:a.playerId,...E.outpost(null,time)});
  await hinstellen(presence,db,a.playerId,X.STADT_TOR,time);
  const gesperrt=await call(ca,'tagwerk');
  assert.equal(gesperrt.status,400);assert.match(gesperrt.error,/ohne Gebiet/);
  assert.equal((await call(ca,'world')).stadt.ohneGebiet,false);
});
await test('Bought incubator slots are paid for once and actually free a slot',async()=>{
  let time=mon;const db=store(),presence=store(),handler=createHandler({store:db,presenceStore:presence,now:()=>time});let serial=0;
  async function call(code,op,extra={}){const r=await handler(new Request('http://localhost/api/gehstockmon',{method:'POST',body:JSON.stringify({code,op,name:code,requestId:'brut-test-'+(++serial),...extra})}));return{status:r.status,...await r.json()};}
  const a=await call(ca,'join');
  assert.equal(a.stadt.brutplaetze,E.INCUBATORS);
  assert.equal(a.stadt.preis,X.BRUTPLATZ_PREISE[0]);
  let r=await call(ca,'brutplatz_kaufen');
  assert.equal(r.status,400,'not enough gold at the start');
  const p=db.data.players[a.playerId];p.gold=10000;
  /* Vier Eier in die Tasche, drei davon in die Brut - dann ist Schluss. */
  p.eggs=[1,2,3,4].map(n=>({id:'ei-'+n,territoryId:1,producedAt:time,startedAt:null,readyAt:null}));
  for(const n of [1,2,3]){const ok=await call(ca,'incubate',{eggId:'ei-'+n});assert.equal(ok.status,200,ok.error);}
  const voll=await call(ca,'incubate',{eggId:'ei-4'});
  assert.equal(voll.status,400);assert.match(voll.error,/Brutplätze sind belegt/);
  const gold=(await call(ca,'world')).profile.gold;
  r=await call(ca,'brutplatz_kaufen');
  assert.equal(r.status,200,r.error);
  assert.equal(r.profile.gold,gold-X.BRUTPLATZ_PREISE[0]);
  assert.equal(r.stadt.brutplaetze,E.INCUBATORS+1);
  const jetzt=await call(ca,'incubate',{eggId:'ei-4'});
  assert.equal(jetzt.status,200,jetzt.error);
  /* Der Preis steigt mit jedem Platz, und irgendwann ist Schluss. */
  for(let i=1;i<X.BRUTPLATZ_PREISE.length;i++){const kauf=await call(ca,'brutplatz_kaufen');assert.equal(kauf.status,200,kauf.error);}
  const ende=await call(ca,'brutplatz_kaufen');
  assert.equal(ende.status,400);assert.match(ende.error,/Mehr Brutplaetze/);
});
await test('A twin from an egg raises the rune level and reaches the saved defence',async()=>{
  let time=mon;const db=store(),presence=store(),handler=createHandler({store:db,presenceStore:presence,now:()=>time,random:()=>0});let serial=0;
  async function call(code,op,extra={}){const r=await handler(new Request('http://localhost/api/gehstockmon',{method:'POST',body:JSON.stringify({code,op,name:code,requestId:'zwilling-'+(++serial),...extra})}));return{status:r.status,...await r.json()};}
  const a=await call(ca,'join');
  const p=db.data.players[a.playerId];
  /* Ziehung 0 trifft immer das erste Mon des Katalogs - einmal neu, danach Zwillinge. */
  const ziel=D.KATALOG[0];
  p.besitz=Array.from(new Set(p.besitz.concat(ziel.id)));
  p.truppe=[ziel.id].concat(p.besitz.filter(id=>id!==ziel.id).slice(0,3));
  Object.assign(db.data.territories[0],{ownerId:a.playerId,defense:p.truppe.map(id=>({id})),...E.outpost(null,time)});
  p.eggs=[{id:'zwilling',territoryId:1,producedAt:time,startedAt:time-E.HATCH_TIME,readyAt:time}];
  const r=await call(ca,'hatch',{eggId:'zwilling'});
  assert.equal(r.status,200,r.error);
  assert.equal(r.schlupf.neu,false);
  assert.equal(r.schlupf.monId,ziel.id);
  assert.equal(r.schlupf.stufe,1);
  assert.match(r.message,/Ein zweiter/);
  assert.equal(r.profile.monUpgrades[ziel.id],1);
  const verteidiger=r.territories[0].defense.find(m=>m.id===ziel.id);
  assert.equal(verteidiger.upgrade,1,'the saved defence fights with the new level right away');
});
/* Die Grosse Arena baute ihre Gegner frueher selbst zusammen und nahm dabei
   nur die Runenstufe mit. Wesen und Kampfplan blieben liegen - der Champion
   kaempfte nach der Faustregel statt nach dem Plan seines Besitzers, obwohl
   der Planeditor genau das verspricht. */
await test('A ladder opponent fights with the nature and the plan its owner saved',async()=>{
  let time=mon;const db=store(),presence=store(),handler=createHandler({store:db,presenceStore:presence,now:()=>time});let serial=0;
  async function call(code,op,extra={}){const r=await handler(new Request('http://localhost/api/gehstockmon',{method:'POST',body:JSON.stringify({code,op,name:code,requestId:'plan-arena-'+(++serial),...extra})}));return{status:r.status,...await r.json()};}
  const a=await call(ca,'join'),b=await call(cb,'join');
  await hinstellen(presence,db,a.playerId,X.STADT_TOR,time);
  /* Der Verteidiger setzt ein Wesen und einen Plan, der sich am Verhalten
     ablesen laesst: er geht immer in Deckung. */
  const pb=db.data.players[b.playerId];
  pb.wesen={};pb.truppe.forEach(id=>{pb.wesen[id]='wild';});
  const deckung=[['immer','guard'],['aus','strike'],['aus','strike']];
  for(const id of pb.truppe)assert.equal((await call(cb,'plan',{monId:id,plan:deckung})).status,200);
  const liste=await call(ca,'world');
  const gegner=liste.turnier.gegner.find(g=>g.id===b.playerId);
  assert.ok(gegner,'the other player is on the ladder');
  assert.equal(gegner.squad[0].wesen,'wild','the stored line-up carries the nature');
  assert.deepEqual(gegner.squad[0].plan,deckung,'and the plan');
  let r=await call(ca,'arena_rang',{targetId:b.playerId});
  assert.equal(r.status,200,r.error);
  /* Im Kampf steht beides wirklich drin. */
  const feind=r.arena.teams[1][0];
  assert.equal(feind.wesen,X.wesen('wild').name,'the opponent shows its nature in the fight');
  assert.deepEqual(feind.plan,deckung,'and carries its plan into the fight');
  const mit=A.stats(X.mon(pb,pb.truppe[0]));
  assert.equal(feind.maxHp,mit.hp,'and fights with the numbers the nature gives it');
  /* Und der Plan wirkt: der Gegner deckt sich, statt zurueckzuschlagen. */
  r=await call(ca,'arena_turn',{battleId:r.arena.id,revision:r.arena.revision,action:{kind:'move',move:'strike'}});
  assert.ok(r.arena.events.some(e=>/Deckung/.test(e.text)),'he guards, as his plan says: '+r.arena.events.map(e=>e.text).join(' | '));
});

console.log('\n'+checks+' Stockhafen checks passed.');
