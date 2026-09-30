/* Der Gluecksautomat beim Haendler (Zug 'automat_spielen', 2-automat.js):
   10 Gold je Spiel, drei gleiche Bilder gewinnen, hoechstens zwei Eier am
   Tag - und er bleibt ein Ort, an dem Gold verschwindet.
   Aufruf: node tools/gehstockmon-automat-tests.mjs */
import assert from 'node:assert/strict';
import {data as D,economy as E,hours as H,adventure as X} from '../netlify/functions/lib/gehstockmon-rules.mjs';
import {createHandler} from '../netlify/functions/gehstockmon.mjs';

const mon=Date.parse('2026-09-21T09:00:00+02:00');
let checks=0;async function test(name,fn){await fn();checks++;console.log('ok',name);}
function store(){let data=null,v=0;return{get data(){return data;},async getWithMetadata(){return data?{data:structuredClone(data),etag:String(v)}:null;},async setJSON(k,next,o={}){if(o.onlyIfNew&&data||o.onlyIfMatch!==undefined&&o.onlyIfMatch!==String(v))return{modified:false};data=structuredClone(next);v++;return{modified:true};}};}
const CODES=[];for(let n=0;CODES.length<1;n++){const code=String(n).padStart(4,'0'),text='code:'+code+':gehstock:hideout:2026:kellergewoelbe';let h=0x811c9dc5;for(const c of text){h^=c.charCodeAt(0);h=(h+(h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24))>>>0;}if(h%97===0)CODES.push(code);}
const [ca]=CODES;
/* wurf ist die Zufallszahl, die der Server bei jedem Aufruf bekommt. Die
   Bereiche folgen der Gewinnliste: Ei [0; 0,02), Gold bis 0,10, Holz bis
   0,15, Rune bis 0,19, Kristall bis 0,22, Perle bis 0,2205, dann nichts. */
const WURF={eier:.01,gold:.05,holz:.12,rune:.17,kristall:.2,perle:.2202,nichts:.5};
function welt(){
  const uhr={t:mon},db=store(),zufall={wurf:WURF.nichts};let serial=0;
  const handler=createHandler({store:db,presenceStore:store(),now:()=>uhr.t,random:()=>zufall.wurf});
  const call=async(op,extra={})=>{const r=await handler(new Request('http://localhost/api/gehstockmon',{method:'POST',body:JSON.stringify({code:ca,op,name:'Anna',requestId:'automat-'+(++serial),...extra})}));return{status:r.status,...await r.json()};};
  return {uhr,db,zufall,call};
}
async function spieler(){const w=welt(),a=await w.call('join');return {w,id:a.playerId,p:()=>w.db.data.players[a.playerId]};}

await test('Rules: price, cap and the prize table, and both sides know the move',()=>{
  assert.equal(X.AUTOMAT.einsatz,10);assert.equal(X.AUTOMAT.proTag,2);
  assert.ok(X.STADT_OPS.includes('automat_spielen')&&X.SPIELZUEGE.includes('automat_spielen'));
  assert.equal(E.BILANZ_RAUS.automat,'Glücksautomat');assert.equal(E.BILANZ_REIN.automat,'Glücksautomat');
  const symbole=X.AUTOMAT.gewinne.map(g=>g.symbol);
  assert.equal(new Set(symbole).size,symbole.length,'one prize per picture');
  assert.ok(symbole.every(s=>X.AUTOMAT.symbole.includes(s)),'every prize has its picture on the reels');
  for(const [sym,w] of Object.entries(WURF))assert.equal((X.automatZiehung(w,()=>true)||{symbol:'nichts'}).symbol,sym,'throw '+w);
  /* Was nicht erreichbar ist, wird zu nichts - die anderen Chancen bleiben gleich. */
  assert.equal(X.automatZiehung(WURF.eier,g=>g.symbol!=='eier'),null);
  assert.equal(X.automatZiehung(WURF.gold,g=>g.symbol!=='eier').symbol,'gold');
  assert.deepEqual(X.automatStand(null,mon),{gewinne:0,frei:2,spiele:0});
  const heute={automat:{tag:H.day(mon),gewinne:1,spiele:7}};
  assert.deepEqual(X.automatStand(heute,mon),{gewinne:1,frei:1,spiele:7});
  assert.equal(X.automatStand(heute,mon+86400000).frei,2,'a new day starts fresh');
  assert.deepEqual(D.neuerStand(heute,mon).automat,{tag:H.day(mon),gewinne:1,spiele:7},'it survives the round trip to the browser');
  assert.equal(D.neuerStand({automat:{tag:H.day(mon),gewinne:9}},mon).automat.gewinne,2,'garbage is clamped');
});

await test('Balance: the machine swallows Gold, the side prizes are no cheap source, and an egg is no bargain',()=>{
  const A=X.AUTOMAT,G=A.gewinne,e=A.einsatz;
  const wert=(g)=>g.gold?g.gold:g.rohstoff?X.ROHSTOFF_PREISE[g.rohstoff]*g.menge:g.rune!==undefined?X.RUNEN_PREISE[g.rune]*g.menge:g.perle?X.SCHIMMERPERLE_PREIS:X.HAENDLER_EI_PREIS;
  const zurueck=(g)=>g.gold?g.gold:g.rohstoff?X.rohstoffAnkauf(g.rohstoff)*g.menge:g.rune!==undefined?X.runenAnkauf(g.rune)*g.menge:0;
  const quote=G.reduce((s,g)=>s+g.chance,0);
  assert.ok(quote>.15&&quote<.3,'roughly every fourth or fifth spin wins: '+quote);
  /* In Gold kommt - Gewinn plus Wiederverkauf beim Haendler - hoechstens 40 % zurueck. */
  const liquide=G.reduce((s,g)=>s+g.chance*zurueck(g),0);
  assert.ok(liquide<=.4*e,'no Gold can be made here: '+liquide.toFixed(2)+' of '+e);
  /* Ohne Ei (nach zwei am Tag) bleibt auch zum Haendlerpreis gerechnet weniger als 60 % - weiterspielen ist nur noch ein Abfluss. */
  const ohneEi=G.filter(g=>g.symbol!=='eier').reduce((s,g)=>s+g.chance*wert(g),0);
  assert.ok(ohneEi<.6*e,'without eggs it is a sink: '+ohneEi.toFixed(2));
  /* Holz, Kristall und Runen kosten hier mindestens das Fuenffache des Haendlerpreises. */
  for(const g of G.filter(g=>g.rohstoff||g.rune!==undefined)){
    const jeStueck=e/(g.chance*g.menge),preis=g.rohstoff?X.ROHSTOFF_PREISE[g.rohstoff]:X.RUNEN_PREISE[g.rune];
    assert.ok(jeStueck>=5*preis,g.symbol+' costs '+jeStueck.toFixed(0)+' Gold here, '+preis+' at the trader');
  }
  /* Ein Ei kostet im Schnitt mehr als beim Haendler. */
  assert.ok(e/G.find(g=>g.symbol==='eier').chance>X.HAENDLER_EI_PREIS);
});

await test('Reels: a win shows three of its picture, a loss never three of a kind',()=>{
  for(const g of X.AUTOMAT.gewinne)assert.deepEqual(X.automatWalzen(g,Math.random),[g.symbol,g.symbol,g.symbol]);
  let zweiGleiche=0;
  for(let i=0;i<20000;i++){
    const w=X.automatWalzen(null,Math.random);
    assert.equal(w.length,3);assert.ok(w.every(s=>X.AUTOMAT.symbole.includes(s)));
    assert.ok(!(w[0]===w[1]&&w[1]===w[2]),'no triple on a loss: '+w.join(','));
    if(w[0]===w[1]||w[1]===w[2]||w[0]===w[2])zweiGleiche++;
  }
  /* Zwei Gleiche: 90 von 210 Verlustbildern - nicht haeufiger, als der Zufall sie bringt. */
  assert.ok(zweiGleiche/20000>.39&&zweiGleiche/20000<.47,'near misses only as often as chance brings them: '+zweiGleiche);
});

await test('A losing spin costs 10 Gold, gives nothing and lands in the weekly ledger',async()=>{
  const {w,p}=await spieler(),vorher=p().gold;
  const r=await w.call('automat_spielen');
  assert.equal(r.status,200,r.error);
  assert.equal(r.automat.gewonnen,false);assert.equal(r.automat.gewinn,null);
  assert.equal(p().gold,vorher-10);assert.equal(p().eggs.length,0);
  assert.equal(p().bilanz.raus.automat,10);assert.match(r.message,/Leider nichts/);
});

await test('Every prize arrives where it belongs',async()=>{
  const {w,p}=await spieler(),start={gold:p().gold,holz:p().lager.holz||0,kristall:p().lager.kristall||0,rune:p().runes[1]||0};
  const spiel=async(sym)=>{w.zufall.wurf=WURF[sym];const r=await w.call('automat_spielen');assert.equal(r.status,200,r.error);assert.deepEqual(r.automat.walzen,[sym,sym,sym]);assert.equal(r.automat.gewinn,sym);return r;};
  await spiel('gold');assert.equal(p().gold,start.gold+10,'minus 10, plus 20');assert.equal(p().bilanz.rein.automat,20);
  await spiel('holz');assert.equal(p().lager.holz,start.holz+3);
  await spiel('rune');assert.equal(p().runes[1],start.rune+1,'a rare rune');
  await spiel('kristall');assert.equal(p().lager.kristall,start.kristall+2);
  let r=await spiel('eier');
  assert.equal(p().eggs.length,1);assert.equal(p().eggs[0].art,'automat');assert.equal(p().eggs[0].readyAt,null,'it still has to be hatched');
  assert.ok(r.ticker.some(e=>/Anna gewinnt am Glücksautomaten ein Ei/.test(e.text)));
  r=await spiel('perle');
  assert.equal(p().schimmerperle,true);assert.ok(r.ticker.some(e=>/Schimmerperle/.test(e.text)));
  /* Mit einer Perle in der Hand gibt es keine zweite - der Wurf bringt dann nichts. */
  const gold=p().gold;w.zufall.wurf=WURF.perle;r=await w.call('automat_spielen');
  assert.equal(r.status,200);assert.equal(r.automat.gewonnen,false);assert.equal(p().gold,gold-10);
});

await test('Two eggs a day at most - after that the other prizes keep running, and the next day eggs are back',async()=>{
  const {w,p}=await spieler();
  w.zufall.wurf=WURF.eier;
  for(let i=0;i<2;i++)assert.equal((await w.call('automat_spielen')).status,200);
  assert.equal(p().eggs.length,2);
  let r=await w.call('automat_spielen');
  assert.equal(r.status,200,'the machine still runs');assert.equal(r.automat.gewonnen,false,'but the egg is out');
  assert.equal(p().eggs.length,2);
  w.zufall.wurf=WURF.gold;r=await w.call('automat_spielen');assert.equal(r.automat.gewinn,'gold','gold still wins');
  w.uhr.t+=86400000;w.zufall.wurf=WURF.eier;
  assert.equal((await w.call('automat_spielen')).automat.gewinn,'eier','a new day, a new egg');
  assert.equal(p().eggs.length,3);
});

await test('A full bag only takes the egg out, and without 10 Gold nothing happens',async()=>{
  const {w,p}=await spieler();
  p().eggs=Array.from({length:E.BAG_LIMIT},(_,i)=>({id:'voll-'+i,territoryId:1,producedAt:mon,startedAt:null,readyAt:null}));
  w.zufall.wurf=WURF.eier;let r=await w.call('automat_spielen');
  assert.equal(r.status,200);assert.equal(r.automat.gewonnen,false);assert.equal(p().eggs.length,E.BAG_LIMIT);
  w.zufall.wurf=WURF.holz;r=await w.call('automat_spielen');assert.equal(r.automat.gewinn,'holz');
  p().gold=9;r=await w.call('automat_spielen');
  assert.notEqual(r.status,200);assert.match(r.error,/kostet 10 Gold/);assert.equal(p().gold,9);
});

console.log('\n'+checks+' Automaten-Pruefungen bestanden.');
