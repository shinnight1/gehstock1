/* Der Gluecksautomat beim Haendler (Zug 'automat_spielen', 2-automat.js):
   10 Gold je Spiel, 2 % Chance auf ein Ei, hoechstens zwei Eier am Tag.
   Aufruf: node tools/gehstockmon-automat-tests.mjs */
import assert from 'node:assert/strict';
import {data as D,economy as E,hours as H,adventure as X} from '../netlify/functions/lib/gehstockmon-rules.mjs';
import {createHandler} from '../netlify/functions/gehstockmon.mjs';

const mon=Date.parse('2026-09-21T09:00:00+02:00');
let checks=0;async function test(name,fn){await fn();checks++;console.log('ok',name);}
function store(){let data=null,v=0;return{get data(){return data;},async getWithMetadata(){return data?{data:structuredClone(data),etag:String(v)}:null;},async setJSON(k,next,o={}){if(o.onlyIfNew&&data||o.onlyIfMatch!==undefined&&o.onlyIfMatch!==String(v))return{modified:false};data=structuredClone(next);v++;return{modified:true};}};}
const CODES=[];for(let n=0;CODES.length<1;n++){const code=String(n).padStart(4,'0'),text='code:'+code+':gehstock:hideout:2026:kellergewoelbe';let h=0x811c9dc5;for(const c of text){h^=c.charCodeAt(0);h=(h+(h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24))>>>0;}if(h%97===0)CODES.push(code);}
const [ca]=CODES;
/* wurf ist die Zufallszahl, die der Server bei jedem Aufruf bekommt:
   unter 0,02 gewinnt, darueber nicht. */
function welt(){
  const uhr={t:mon},db=store(),zufall={wurf:.5};let serial=0;
  const handler=createHandler({store:db,presenceStore:store(),now:()=>uhr.t,random:()=>zufall.wurf});
  const call=async(op,extra={})=>{const r=await handler(new Request('http://localhost/api/gehstockmon',{method:'POST',body:JSON.stringify({code:ca,op,name:'Anna',requestId:'automat-'+(++serial),...extra})}));return{status:r.status,...await r.json()};};
  return {uhr,db,zufall,call};
}

await test('Rules: price, chance and the daily cap are fixed, and both sides know the move',()=>{
  assert.deepEqual([X.AUTOMAT.einsatz,X.AUTOMAT.chance,X.AUTOMAT.proTag],[10,.02,2]);
  assert.ok(X.STADT_OPS.includes('automat_spielen')&&X.SPIELZUEGE.includes('automat_spielen'));
  assert.equal(E.BILANZ_RAUS.automat,'Glücksautomat','the weekly ledger names it');
  assert.deepEqual(X.automatStand(null,mon),{gewinne:0,frei:2,spiele:0});
  const heute={automat:{tag:H.day(mon),gewinne:1,spiele:7}};
  assert.deepEqual(X.automatStand(heute,mon),{gewinne:1,frei:1,spiele:7});
  assert.equal(X.automatStand(heute,mon+86400000).frei,2,'a new day starts fresh');
  assert.deepEqual(D.neuerStand(heute,mon).automat,{tag:H.day(mon),gewinne:1,spiele:7},'it survives the round trip to the browser');
  assert.equal(D.neuerStand({automat:{tag:H.day(mon),gewinne:9}},mon).automat.gewinne,2,'garbage is clamped');
  assert.equal(D.neuerStand({},mon).automat,null);
});

await test('Reels: a win shows three eggs, a loss never shows three of a kind',()=>{
  assert.deepEqual(X.automatWalzen(true,Math.random),['eier','eier','eier']);
  let zweiEier=0;
  for(let i=0;i<20000;i++){
    const w=X.automatWalzen(false,Math.random);
    assert.equal(w.length,3);assert.ok(w.every(s=>X.AUTOMAT.symbole.includes(s)));
    assert.ok(!(w[0]===w[1]&&w[1]===w[2]),'no triple on a loss: '+w.join(','));
    if(w.filter(s=>s==='eier').length===2)zweiEier++;
  }
  /* Zwei Eier ohne Gewinn: 15 von 210 Verlustbildern, also rund 7 % - nicht mehr. */
  assert.ok(zweiEier/20000>.05&&zweiEier/20000<.09,'near misses only as often as chance brings them: '+zweiEier);
});

await test('A losing spin costs 10 Gold, gives nothing and lands in the weekly ledger',async()=>{
  const w=welt(),a=await w.call('join'),id=a.playerId,vorher=w.db.data.players[id].gold;
  const r=await w.call('automat_spielen');
  assert.equal(r.status,200,r.error);
  assert.equal(r.automat.gewonnen,false);assert.equal(r.automat.walzen.length,3);
  assert.equal(w.db.data.players[id].gold,vorher-10);
  assert.equal(w.db.data.players[id].eggs.length,0,'no egg');
  assert.equal(w.db.data.players[id].bilanz.raus.automat,10);
  assert.equal(r.profile.automat.spiele,1);assert.match(r.message,/Leider nichts/);
});

await test('A winning spin puts an egg in the bag and tells the island',async()=>{
  const w=welt(),a=await w.call('join'),id=a.playerId;
  w.zufall.wurf=.01;
  const r=await w.call('automat_spielen');
  assert.equal(r.status,200,r.error);
  assert.deepEqual(r.automat,{walzen:['eier','eier','eier'],gewonnen:true});
  const eier=w.db.data.players[id].eggs;
  assert.equal(eier.length,1);assert.equal(eier[0].art,'automat');assert.equal(eier[0].readyAt,null,'it still has to be hatched');
  assert.equal(r.profile.eggs[0].art,'automat','the browser sees where it came from');
  assert.ok(r.ticker.some(e=>/Anna gewinnt am Glücksautomaten ein Ei/.test(e.text)));
});

await test('Two eggs a day at most - then the machine takes no more Gold, and the next day it runs again',async()=>{
  const w=welt(),a=await w.call('join'),id=a.playerId;
  w.zufall.wurf=.01;
  assert.equal((await w.call('automat_spielen')).status,200);
  w.zufall.wurf=.5;
  assert.equal((await w.call('automat_spielen')).status,200,'losses in between are fine');
  w.zufall.wurf=.01;
  assert.equal((await w.call('automat_spielen')).status,200);
  const gold=w.db.data.players[id].gold;
  const gesperrt=await w.call('automat_spielen');
  assert.notEqual(gesperrt.status,200);assert.match(gesperrt.error,/heute schon 2 Eier/);
  assert.equal(w.db.data.players[id].gold,gold,'a locked machine costs nothing');
  assert.equal(w.db.data.players[id].eggs.length,2);
  w.uhr.t+=86400000;
  assert.equal((await w.call('automat_spielen')).status,200,'a new day, a new chance');
  assert.equal(w.db.data.players[id].eggs.length,3);
});

await test('Without 10 Gold or with a full bag the machine refuses and keeps everything',async()=>{
  const w=welt(),a=await w.call('join'),id=a.playerId;
  w.db.data.players[id].gold=9;
  let r=await w.call('automat_spielen');
  assert.notEqual(r.status,200);assert.match(r.error,/kostet 10 Gold/);
  assert.equal(w.db.data.players[id].gold,9);
  w.db.data.players[id].gold=500;
  w.db.data.players[id].eggs=Array.from({length:E.BAG_LIMIT},(_,i)=>({id:'voll-'+i,territoryId:1,producedAt:mon,startedAt:null,readyAt:null}));
  r=await w.call('automat_spielen');
  assert.notEqual(r.status,200);assert.match(r.error,/Bruttasche ist voll/);
  assert.equal(w.db.data.players[id].gold,500);
});

console.log('\n'+checks+' Automaten-Pruefungen bestanden.');
