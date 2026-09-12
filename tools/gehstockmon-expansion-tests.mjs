/* Zeitgrenzen, Geometrie und Testzone mit ausschließlich lokalen Speichern. */
import assert from 'node:assert/strict';
import {data as D,economy as E,hours as H,adventure as X,arena as A} from '../netlify/functions/lib/gehstockmon-rules.mjs';
import {createHandler} from '../netlify/functions/gehstockmon.mjs';
const at=s=>Date.parse(s),fri=at('2026-09-18T12:30:00+02:00'),mon=at('2026-09-21T07:30:00+02:00');
let checks=0;async function test(name,fn){await fn();checks++;console.log('ok',name);}
function store(){let data=null,v=0;return{get data(){return data;},async getWithMetadata(){return data?{data:structuredClone(data),etag:String(v)}:null;},async setJSON(k,next,o){if(o.onlyIfNew&&data||o.onlyIfMatch!==undefined&&o.onlyIfMatch!==String(v))return{modified:false};data=structuredClone(next);v++;return{modified:true};}};}
await test('Income pauses every evening, night and weekend; daily awards are separate',()=>{
  const p=D.neuerStand(null,fri),post=E.outpost(null,fri);E.settle(p,post,at('2026-09-18T13:00:00+02:00'));assert.equal(p.gold,190);
  E.settle(p,post,at('2026-09-20T20:00:00+02:00'));assert.equal(p.gold,190);assert.equal(p.dailyGoldPending,300);
  E.settle(p,post,mon);assert.equal(p.gold,200);assert.equal(p.dailyGoldPending,450);assert.equal(E.deliverDaily(p),450);assert.equal(p.gold,650);assert.equal(E.deliverDaily(p),0);
  E.settle(p,post,fri);assert.equal(p.gold,650,'backwards clocks cannot pay again');
});
await test('Every opening boundary and both DST changes count only scheduled hours',()=>{
  for(const date of ['2026-09-14','2026-10-19','2027-03-22']){const start=at(date+'T00:00:00Z'),d=H.day(start);assert.equal((H.openTime(H.at(d+7,0))-H.openTime(H.at(d,0)))/E.HOUR,33);}
  const d=H.day(mon);for(let i=0;i<7;i++){const close=H.CLOSE[H.weekday(d+i)];assert.equal(H.openTime(H.at(d+i,7))-H.openTime(H.at(d+i,0)),0);if(close){assert.equal(H.openTime(H.at(d+i,close))-H.openTime(H.at(d+i,7)),(close-7)*E.HOUR);assert.equal(H.openTime(H.at(d+i+1,0))-H.openTime(H.at(d+i,close)),0);}}
});
await test('Midnight gold belongs to the owner at midnight and is delivered once at login',async()=>{
  let time=fri;const db=store(),presence=store(),handler=createHandler({store:db,presenceStore:presence,now:()=>time});let serial=0;
  async function call(code,op){const r=await handler(new Request('http://localhost/api/gehstockmon',{method:'POST',body:JSON.stringify({code,op,name:code,requestId:'daily-test-'+(++serial)})}));assert.equal(r.status,200);return r.json();}
  const a=await call('0141','join'),b=await call('0321','join');
  Object.assign(db.data.territories[0],{ownerId:a.playerId,...E.outpost(null,time)});
  time=mon;await call('0321','world');assert.equal(db.data.players[a.playerId].dailyGoldPending,450);assert.equal(db.data.players[a.playerId].gold,200);
  Object.assign(db.data.territories[0],{ownerId:b.playerId,...E.outpost(null,time)});
  const results=await Promise.all([call('0141','join'),call('0141','join')]);assert.equal(results.reduce((n,r)=>n+r.dailyDelivery,0),450);assert.equal((await call('0141','join')).profile.gold,650);assert.equal((await call('0321','join')).dailyDelivery,0);
});
await test('Legacy outposts start the new daily schedule without retroactive awards',()=>{
  const old={capturedAt:at('2026-01-01T00:00:00+01:00'),incomeAt:fri,eggAt:fri},p=D.neuerStand(null,fri),post=E.outpost(old,fri);E.settle(p,post,fri);assert.equal(p.dailyGoldPending,0);E.settle(p,post,mon);assert.equal(p.dailyGoldPending,450);
});
await test('Water and thick walls block movement; only bridges cross the river',()=>{
  const z=60,x=X.riverCenter(z);assert.equal(X.canTravel([],{x:x-12,z},{x:x+12,z},'me'),false);assert.equal(X.walkable({x:451,z:0}),false);
  for(const bz of D.WORLD.bridgeZ){const bx=X.riverCenter(bz);assert.equal(X.canTravel([],{x:bx-12,z:bz},{x:bx+12,z:bz},'me'),true);}
  const layout=X.layout(D.FELDER.map(f=>({id:f.id,ownerId:null}))),g=layout[0],edge=g.edges.find(e=>e!==g.gate.edge),mid={x:(edge.a.x+edge.b.x)/2,z:(edge.a.z+edge.b.z)/2};
  assert.equal(X.canTravel(layout,{x:mid.x,z:mid.z+2},mid,'me'),false,'wall volume cannot be entered before crossing the centerline');
});
await test('All ownership combinations keep every gate reachable through public grass',()=>{
  for(let mask=0;mask<512;mask++){const layout=X.layout(D.FELDER.map((f,i)=>({id:f.id,ownerId:mask>>i&1?'rival':null})));const from=X.outside(X.SPAWN,layout);for(const g of layout){const end={x:g.gate.x+g.gate.nx*4,z:g.gate.z+g.gate.nz*4};assert.ok(X.route(layout,from,end,'visitor'),'mask '+mask+', gate '+g.id);}}
});
await test('Two roaming trainers stay on dry public routes over an entire spawn hour',()=>{
  const ts=D.FELDER.map(f=>({id:f.id,ownerId:'owner'})),layout=X.layout(ts),list=X.encounters(mon,ts);assert.equal(list.filter(e=>e.kind==='trainer').length,2);
  for(const e of list.filter(e=>e.kind==='trainer')){assert.ok(Math.hypot(e.patrolX-e.homeX,e.patrolZ-e.homeZ)>20);let last=X.encounterPosition(e,mon);for(let t=mon;t<e.expiresAt;t+=1000){const p=X.encounterPosition(e,t);assert.ok(X.canTravel(layout,last,p,null));last=p;}}
});
await test('Top territories defeat starter squads and have explicit apocalypse defenders',()=>{
  assert.equal(D.SELTENHEITEN[2].name,'Außergewöhnlich');assert.ok(D.KATALOG.some(m=>m.seltenheit===2));assert.deepEqual(A.defenders(9).filter(m=>m.seltenheit===6).map(m=>m.id),['endrichter','nullwyrm']);
  for(const id of [8,9]){let battle=A.create(D.STARTER.map(D.mon),A.defenders(id),{territoryId:id,npcTerritory:true});for(let i=0;battle.phase!=='finished'&&i<100;i++)battle=A.turn(battle,battle.phase==='replace'?{kind:'switch',slot:battle.teams[0].findIndex(m=>m.hp>0)}:{kind:'move',move:'strike'});assert.equal(battle.winner,'sie');}
  assert.ok(D.mon('nullwyrm').worldSize>D.mon('moosling').worldSize*4);
});
await test('Sandbox purchases, fights, presence, retries and reload never access live stores',async()=>{
  const forbidden={getWithMetadata(){throw Error('live read');},setJSON(){throw Error('live write');}},handler=createHandler({store:forbidden,presenceStore:forbidden,now:()=>mon});let state=null,presence=null,serial=0;
  async function call(op,extra={}){const r=await handler(new Request('http://localhost/api/gehstockmon',{method:'POST',body:JSON.stringify({code:'0141',op,requestId:'sandbox-'+(++serial),adminOverride:true,adminCode:'3141',testState:state,testPresence:presence,...extra})}));assert.equal(r.status,200,await r.clone().text());const data=await r.json();state=data.testState;presence=data.testPresence;return data;}
  let r=await call('join');assert.equal(r.profile.gold,50000);const id=r.playerId;r=await call('shop_buy',{kind:'skin',itemId:'leerenreaper',requestId:'sandbox-purchase'});assert.equal(r.profile.gold,45000);assert.equal((await call('shop_buy',{kind:'skin',itemId:'leerenreaper',requestId:'sandbox-purchase'})).profile.gold,45000);
  await call('presence',{position:{...X.SPAWN,heading:0}});assert.ok(presence.players[id]);r=await call('arena_start',{territoryId:9,version:1,squad:['endrichter','nullwyrm','aetherdrache','chronoschreiter']});assert.equal(r.arena.teams[1][0].monId,'endrichter');
  state=null;presence=null;r=await call('join');assert.equal(r.profile.gold,50000);assert.equal(r.profile.skin,'wanderer');assert.equal(r.arena,null);
});
await test('An invalid testzone request during opening hours cannot fall through to real saves',async()=>{const db=store(),handler=createHandler({store:db,now:()=>mon});for(const code of ['0321','0141']){const r=await handler(new Request('http://localhost/api/gehstockmon',{method:'POST',body:JSON.stringify({code,op:'join',adminOverride:true,adminCode:code==='0141'?'wrong':'3141'})}));assert.equal(r.status,403);assert.equal(db.data,null);}});
console.log('\n'+checks+' expansion checks passed.');
