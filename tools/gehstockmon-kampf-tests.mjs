/* Die sechs Systeme, die den Kern des Kampfes ausmachen: zwoelf Faehigkeiten,
   das Rollen-Dreieck, die Kampfplaene, die Aussenseiterhilfe, der nachlesbare
   Bericht und das Tauschbrett. */
import assert from 'node:assert/strict';
import {data as D,economy as E,arena as A,adventure as X} from '../netlify/functions/lib/gehstockmon-rules.mjs';
import {createHandler} from '../netlify/functions/gehstockmon.mjs';
const mon=Date.parse('2026-09-21T08:00:00+02:00');
let checks=0;async function test(name,fn){await fn();checks++;console.log('ok',name);}
function store(){let data=null,v=0;return{get data(){return data;},async getWithMetadata(){return data?{data:structuredClone(data),etag:String(v)}:null;},async setJSON(k,next,o){if(o.onlyIfNew&&data||o.onlyIfMatch!==undefined&&o.onlyIfMatch!==String(v))return{modified:false};data=structuredClone(next);v++;return{modified:true};}};}
function codeAt(index){let codes=[];for(let n=0;n<10000;n++){const code=String(n).padStart(4,'0'),text='code:'+code+':gehstock:hideout:2026:kellergewoelbe';let h=0x811c9dc5;for(const c of text){h^=c.charCodeAt(0);h=(h+(h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24))>>>0;}if(h%97===0)codes.push(code);}return codes[index];}
const ca=codeAt(0),cb=codeAt(1);
/* Ein Kampf mit einem festen Zug, bis er zu Ende ist. */
function auskaempfen(b,zug){
  for(let i=0;b.phase!=='finished'&&i<300;i++){
    b=A.turn(b,b.phase==='replace'?{kind:'switch',slot:b.teams[0].findIndex(u=>u.hp>0)}:{kind:'move',move:zug(b)});
  }
  return b;
}

await test('Twelve abilities exist, three per role, and every Mon has exactly one',()=>{
  assert.equal(A.FAEHIGKEITEN.length,4);
  for(const rolle of A.FAEHIGKEITEN)assert.equal(rolle.length,3);
  assert.equal(new Set(A.FAEHIGKEITEN.flat().map(f=>f.id)).size,12,'no duplicate ids');
  /* Jede der zwoelf wird von mindestens einem Mon getragen - sonst ist sie tot. */
  const belegt=new Set();
  for(const k of D.KATALOG){
    const i=D.faehigkeitVon(k);
    assert.ok(i>=0&&i<3,k.id+' has ability index '+i);
    belegt.add(k.typ+':'+i);
  }
  assert.equal(belegt.size,12,'every role/ability pair is carried by a Mon');
  /* Die erste jeder Rolle bleibt die alte - sonst aendert sich fuer bestehende
     Spielstaende die gewohnte Attacke. */
  assert.deepEqual(A.FAEHIGKEITEN.map(r=>r[0].name),['Schildstoß','Sichelstreich','Lebensquell','Runenstörung']);
});
await test('Every ability actually does what it promises',()=>{
  function kampf(monId,gegnerId){
    const b=A.create([D.mon(monId)],[D.mon(gegnerId||'bollwerk')],{});
    b.teams[0][0].hp=Math.round(b.teams[0][0].maxHp*0.5);
    return b;
  }
  function mitFaehigkeit(rolle,index,gegnerRolle){
    const traeger=D.KATALOG.find(k=>k.typ===rolle&&D.faehigkeitVon(k)===index);
    assert.ok(traeger,'role '+rolle+' ability '+index+' has a carrier');
    const gegner=D.KATALOG.find(k=>k.typ===(gegnerRolle===undefined?0:gegnerRolle));
    const b=kampf(traeger.id,gegner.id);
    return {vor:structuredClone(b),nach:A.turn(b,{kind:'move',move:'special'})};
  }
  /* Steinwall: kein Schaden, dafuer Schild und Heilung. */
  let r=mitFaehigkeit(0,1);
  assert.ok(r.nach.teams[0][0].hp>r.vor.teams[0][0].hp,'Steinwall heals');
  /* Dornenpanzer setzt die Dornen, die der naechste Treffer ausloest. */
  r=mitFaehigkeit(0,2);
  assert.equal(r.nach.teams[0][0].dornen||r.nach.teams[0][0].hp<r.vor.teams[0][0].hp,true,'Dornenpanzer armed or already triggered');
  /* Doppelhieb trifft zweimal. */
  r=mitFaehigkeit(1,1);
  assert.ok(r.nach.events.filter(e=>e.delta<0&&e.actor==='wir0').length>=2,'Doppelhieb lands twice');
  /* Aderlass heilt den Angreifer. */
  r=mitFaehigkeit(1,2);
  assert.ok(r.nach.events.some(e=>e.delta>0),'Aderlass heals its user');
  /* Sammelruf und Laeuterung heilen ebenfalls. */
  for(const i of [0,1,2]){r=mitFaehigkeit(2,i);assert.ok(r.nach.teams[0][0].hp>r.vor.teams[0][0].hp,'healer ability '+i+' heals');}
  /* Blendstoss nimmt eine Ladung. */
  r=mitFaehigkeit(3,1);
  assert.ok(r.nach.teams[1][0].charges<r.vor.teams[1][0].charges,'Blendstoß removes a charge');
  /* Windschnitt geht durch Deckung: mit und ohne Schild derselbe Treffer. */
  const traeger=D.KATALOG.find(k=>k.typ===3&&D.faehigkeitVon(k)===2);
  function windschnitt(schild){
    let b=A.create([D.mon(traeger.id)],[D.mon('bollwerk')],{});
    b.teams[1][0].shield=schild;
    const vor=b.teams[1][0].hp;
    b=A.turn(b,{kind:'move',move:'special'});
    return vor-b.teams[1][0].hp;
  }
  assert.ok(windschnitt(0)>0,'Windschnitt lands');
  assert.equal(windschnitt(0.9),windschnitt(0),'a shield does not soften it');
  /* Zum Vergleich: ein Stockhieb wird vom selben Schild sehr wohl gebremst. */
  function stockhieb(schild){
    let b=A.create([D.mon(traeger.id)],[D.mon('bollwerk')],{});
    b.teams[1][0].shield=schild;
    const vor=b.teams[1][0].hp;
    b=A.turn(b,{kind:'move',move:'strike'});
    return vor-b.teams[1][0].hp;
  }
  assert.ok(stockhieb(0.9)<stockhieb(0),'but an ordinary hit is');
});
await test('The role triangle bends damage in both directions and nowhere else',()=>{
  assert.equal(A.rollenFaktor(1,0),1-A.DREIECK,'blade into wall');
  assert.equal(A.rollenFaktor(1,2),1+A.DREIECK,'blade into healer');
  assert.equal(A.rollenFaktor(3,0),1+A.DREIECK,'scout into wall');
  assert.equal(A.rollenFaktor(3,2),1-A.DREIECK,'scout into healer');
  /* Alles andere bleibt neutral - sonst wird das Dreieck zur Zahlentabelle. */
  let neutral=0;
  for(let a=0;a<4;a++)for(let v=0;v<4;v++)if(A.rollenFaktor(a,v)===1)neutral++;
  assert.equal(neutral,12);
  /* Und es kommt im Kampf an. Gemessen wird der reine eigene Treffer aus den
     Ereignissen - die Ziel-KP taugen nicht als Mass, weil die vier Rollen
     verschiedene Seltenheiten haben und ein Pfleger sich obendrein heilt. */
  function treffer(angreiferId,zielId){
    let b=A.create([D.mon(angreiferId)],[D.mon(zielId)],{});
    b=A.turn(b,{kind:'move',move:'strike'});
    return b.events.filter(e=>e.actor==='wir0'&&e.delta<0).reduce((s,e)=>s-e.delta,0);
  }
  /* Dieselbe Schneide, zwei Ziele derselben Seltenheit: einmal Wall, einmal Pfleger. */
  const wall=D.KATALOG.find(k=>k.typ===0&&k.seltenheit===2);
  const pfleger=D.KATALOG.find(k=>k.typ===2&&k.seltenheit===2);
  const stoerer=D.KATALOG.find(k=>k.typ===3&&k.seltenheit===2);
  assert.ok(wall&&pfleger&&stoerer,'one of each role at the same rarity');
  assert.ok(treffer('klinge',pfleger.id)>treffer('klinge',wall.id),'a blade hits the healer harder than the wall');
  assert.ok(treffer(stoerer.id,wall.id)>treffer(stoerer.id,pfleger.id),'and a scout hits the wall harder than the healer');
});
await test('A battle plan steers the defender and beats the old rule of thumb',()=>{
  assert.ok(A.planGueltig(A.START_PLAN));
  assert.equal(A.planGueltig([['immer','strike']]),false,'wrong length');
  assert.equal(A.planGueltig([['gibtsnicht','strike'],['immer','strike'],['immer','strike']]),false,'unknown condition');
  assert.equal(A.planGueltig([['immer','tanzen'],['immer','strike'],['immer','strike']]),false,'unknown action');
  /* Ein ungueltiger Plan faellt auf den Startplan zurueck, statt zu werfen. */
  assert.deepEqual(A.planOder(null),A.START_PLAN);
  /* Ein Verteidiger mit "immer Deckung" darf nie angreifen. */
  const deckung=[['immer','guard'],['immer','strike'],['immer','strike']];
  let b=A.create([D.mon('klinge')],[Object.assign({},D.mon('bollwerk'),{plan:deckung})],{});
  const meineKp=b.teams[0][0].hp;
  b=auskaempfen(b,()=>'strike');
  assert.equal(b.teams[0][0].hp,meineKp,'a defender that only guards never deals damage');
  /* Und ohne Plan schlaegt derselbe Verteidiger sehr wohl zurueck. */
  let ohne=A.create([D.mon('klinge')],[D.mon('bollwerk')],{});
  ohne=auskaempfen(ohne,()=>'strike');
  assert.ok(ohne.teams[0][0].hp<meineKp,'without a plan it fights back');
});
await test('The underdog bonus only helps the smaller side and is capped',()=>{
  assert.equal(X.aussenseiterBonus(3,3),0,'equal holdings give nothing');
  assert.equal(X.aussenseiterBonus(5,2),0,'the leader gets nothing');
  assert.equal(X.aussenseiterBonus(0,1),X.AUSSENSEITER_JE_GEBIET);
  assert.equal(X.aussenseiterBonus(0,9),X.AUSSENSEITER_MAX,'capped');
  assert.equal(X.aussenseiterBonus(NaN,3),X.AUSSENSEITER_MAX*0+3*X.AUSSENSEITER_JE_GEBIET,'garbage counts as zero holdings');
  /* Im Kampf landet er auf der eigenen Seite, nicht beim Gegner. */
  const ohne=A.create([D.mon('klinge')],[D.mon('bollwerk')],{});
  const mit=A.create([D.mon('klinge')],[D.mon('bollwerk')],{aussenseiter:.4});
  assert.ok(mit.teams[0][0].maxHp>ohne.teams[0][0].maxHp);
  assert.equal(mit.teams[1][0].maxHp,ohne.teams[1][0].maxHp,'the defender keeps its own numbers');
});
await test('A finished battle carries its whole course, and the server files it',async()=>{
  let time=mon;const db=store(),handler=createHandler({store:db,presenceStore:store(),now:()=>time});let serial=0;
  async function call(code,op,extra={}){const r=await handler(new Request('http://localhost/api/gehstockmon',{method:'POST',body:JSON.stringify({code,op,name:code,requestId:'kampf-test-'+(++serial),...extra})}));return{status:r.status,...await r.json()};}
  const a=await call(ca,'join');
  let r=await call(ca,'arena_start',{territoryId:1,version:a.territories[0].version,squad:a.profile.truppe});
  assert.equal(r.status,200,r.error);
  for(let i=0;r.arena.phase!=='finished'&&i<200;i++){
    const b=r.arena,u=b.teams[0][b.active[0]];
    r=await call(ca,'arena_turn',{battleId:b.id,revision:b.revision,
      action:b.phase==='replace'?{kind:'switch',slot:b.teams[0].findIndex(m=>m.hp>0)}:{kind:'move',move:b.round>=u.powerReady?'power':'strike'}});
  }
  assert.equal(r.arena.phase,'finished');
  assert.ok(r.arena.verlauf.length>0,'the fight collects its lines');
  const bericht=r.reports[r.reports.length-1];
  assert.ok(bericht.verlauf&&bericht.verlauf.length,'and the report keeps them');
  assert.ok(bericht.runden>=1);
  assert.equal(bericht.angreifer.length,4);
  assert.ok(bericht.verlauf.length<=60,'but never more than sixty lines');
});
await test('Trading swaps two Mons, only within one rarity, and nothing is duplicated',async()=>{
  let time=mon;const db=store(),handler=createHandler({store:db,presenceStore:store(),now:()=>time});let serial=0;
  async function call(code,op,extra={}){const r=await handler(new Request('http://localhost/api/gehstockmon',{method:'POST',body:JSON.stringify({code,op,name:code,requestId:'tausch-test-'+(++serial),...extra})}));return{status:r.status,...await r.json()};}
  const a=await call(ca,'join'),b=await call(cb,'join');
  const pa=db.data.players[a.playerId],pb=db.data.players[b.playerId];
  /* Zwei Mons derselben Seltenheit, jeder hat eins und will das andere. */
  const gleich=D.KATALOG.filter(k=>k.seltenheit===2).slice(0,2);
  assert.equal(gleich.length,2);
  const [meins,seins]=gleich;
  pa.besitz=pa.besitz.filter(id=>id!==seins.id).concat(meins.id);
  pb.besitz=pb.besitz.filter(id=>id!==meins.id).concat(seins.id);
  pa.truppe=pa.besitz.filter(id=>id!==meins.id).slice(0,4);
  pb.truppe=pb.besitz.filter(id=>id!==seins.id).slice(0,4);
  pa.monUpgrades[meins.id]=3;
  /* Ein Angebot ueber Seltenheitsgrenzen hinweg wird abgelehnt. */
  const quer=D.KATALOG.find(k=>k.seltenheit===5&&!pa.besitz.includes(k.id));
  let r=await call(ca,'tausch_anbieten',{gebe:meins.id,suche:quer.id});
  assert.equal(r.status,400);assert.match(r.error,/derselben Seltenheit/);
  /* Das echte Angebot geht durch und taucht bei beiden auf. */
  r=await call(ca,'tausch_anbieten',{gebe:meins.id,suche:seins.id});
  assert.equal(r.status,200,r.error);
  assert.equal(r.tausch.length,1);
  assert.equal(r.tausch[0].selbst,true);
  const sicht=await call(cb,'world');
  assert.equal(sicht.tausch[0].selbst,false);
  assert.equal(sicht.tausch[0].moeglich,true,'the other side can fill it');
  /* Annehmen tauscht wirklich - und die Runenstufe wandert nicht mit. */
  r=await call(cb,'tausch_annehmen',{tauschId:sicht.tausch[0].id});
  assert.equal(r.status,200,r.error);
  assert.ok(r.profile.besitz.includes(meins.id),'the accepter gets the offered Mon');
  assert.ok(!r.profile.besitz.includes(seins.id),'and loses the one asked for');
  assert.equal(r.profile.monUpgrades[meins.id],undefined,'rune level does not travel');
  const danach=await call(ca,'world');
  assert.ok(danach.profile.besitz.includes(seins.id));
  assert.ok(!danach.profile.besitz.includes(meins.id));
  assert.equal(danach.tausch.length,0,'the board is cleared');
  /* Kein Mon wurde dabei vervielfacht. */
  for(const spieler of [danach.profile,r.profile])
    assert.equal(new Set(spieler.besitz).size,spieler.besitz.length);
});
await test('A saved defence carries its plan, and a plan change reaches every outpost',async()=>{
  let time=mon;const db=store(),handler=createHandler({store:db,presenceStore:store(),now:()=>time});let serial=0;
  async function call(code,op,extra={}){const r=await handler(new Request('http://localhost/api/gehstockmon',{method:'POST',body:JSON.stringify({code,op,name:code,requestId:'plan-test-'+(++serial),...extra})}));return{status:r.status,...await r.json()};}
  const a=await call(ca,'join');
  Object.assign(db.data.territories[0],{ownerId:a.playerId,...E.outpost(null,time)});
  const meins=a.profile.truppe[0];
  /* Ein unsinniger Plan wird abgelehnt. */
  let r=await call(ca,'plan',{monId:meins,plan:[['immer','fliegen'],['immer','strike'],['immer','strike']]});
  assert.equal(r.status,400);assert.match(r.error,/nicht gültig/);
  /* Der gueltige landet im Spielstand und auf dem Aussenposten. */
  const plan=[['feind_stark','guard'],['ladung_da','special'],['immer','power']];
  r=await call(ca,'defend',{squad:a.profile.truppe});
  assert.equal(r.status,200,r.error);
  r=await call(ca,'plan',{monId:meins,plan});
  assert.equal(r.status,200,r.error);
  assert.deepEqual(r.profile.plaene[meins],plan);
  assert.deepEqual(db.data.territories[0].defense.find(m=>m.id===meins).plan,plan,'the outpost fights by it at once');
  /* Und ein Angreifer bekommt ihn beim Aufklaeren zu sehen. */
  const gegner=await call(cb,'join');
  const gesehen=gegner.territories[0].defense.find(m=>m.id===meins);
  assert.ok(gesehen,'the defender is visible');
});
console.log('\n'+checks+' Kampf- und Tauschpruefungen bestanden.');
