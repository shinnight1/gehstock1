/* Nach einem Dungeon kam man nicht mehr vom Fleck (28.09.2026). Geprueft wird:
   das Dungeon-Fenster geht in jedem Fall wieder zu, und alle wurden einmal an
   den Start gestellt - ohne dass jemand danach festsitzt.
   Aufruf: node tools/gehstockmon-festsitzen-tests.mjs */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {data as D,arena as A,adventure as X} from '../netlify/functions/lib/gehstockmon-rules.mjs';
import {createHandler} from '../netlify/functions/gehstockmon.mjs';

let checks=0;async function test(name,fn){await fn();checks++;console.log('ok',name);}

/* ---------------------------------------------- Das Dungeon-Fenster */
class Element{
  constructor(tag){this.tagName=tag;this.children=[];this.events={};this.attrs={};this.hidden=false;this.disabled=false;this.className='';this.style={setProperty(){}};this.text='';this.value='';}
  appendChild(e){e.parentNode=this;this.children.push(e);return e;}
  set textContent(v){this.text=String(v);this.children=[];}get textContent(){return this.text+this.children.map(c=>c.textContent).join('');}
  setAttribute(k,v){this.attrs[k]=String(v);}addEventListener(k,fn){this.events[k]=fn;}
  all(){return[this,...this.children.flatMap(e=>e.all())];}
}
function dungeonUi(werte=new Map()){
  const zu={offen:0,zu:0},box=new Element('div');
  const el=(tag,text,cls)=>{const e=new Element(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
  const button=(text,fn,cls)=>{const b=el('button',text,cls);b.addEventListener('click',fn);return b;};
  const SG={gehstockmon:{daten:D,arena:A,abenteuer:X,online:{pending:()=>null}},assets:{},
    ui:{el:(tag)=>new Element(tag),clear:(e)=>{e.children=[];}},
    storage:{get:(k,d)=>werte.has(k)?structuredClone(werte.get(k)):d,set:(k,v)=>werte.set(k,structuredClone(v))}};
  vm.runInContext(fs.readFileSync('src/games/gehstockmon/2-dungeon-ui.js','utf8'),vm.createContext({SG}));
  const ui=SG.gehstockmon.mountDungeons({el,button,arenaBox:box,layer:new Element('div'),busy:()=>false,now:()=>0,playerId:()=>'ich',
    state:()=>({besitz:[],truppe:[],runes:[0,0,0,0,0,0,0]}),openCombat:()=>zu.offen++,closeCombat:()=>zu.zu++,request:()=>Promise.reject(new Error('offline')),apply(){},notify(){},error(){}});
  const knopf=(text)=>box.all().find(e=>e.tagName==='button'&&e.textContent===text);
  return {ui,zu,knopf,werte};
}
const raum=(phase)=>({id:'raum-1',dungeonId:X.DUNGEONS[0].id,leaderId:'ich',phase,players:[{id:'ich',name:'Anna',monId:D.KATALOG[0].id,hp:5,maxHp:10,ready:true,role:D.KATALOG[0].typ,skill:0,heals:1,maxHeals:2,powerReady:1,powerPause:3}],actions:{},message:'Ende',round:3,deadline:0});

await test('Ein beendeter Dungeon geht mit "Zurück zur Karte" zu und bleibt auch nach dem Neuladen zu',()=>{
  const a=dungeonUi();
  a.ui.apply({dungeon:raum('finished')});assert.equal(a.ui.active(),true);a.ui.show();assert.equal(a.zu.offen,1);
  a.knopf('Zurück zur Karte').events.click();
  assert.equal(a.zu.zu,1);assert.equal(a.ui.active(),false);
  const b=dungeonUi(a.werte);b.ui.apply({dungeon:raum('finished')});
  assert.equal(b.ui.active(),false,'nach dem Neuladen nicht wieder ueber der Karte');
});

await test('Raeumt der Server den Dungeon weg, waehrend das Fenster offen ist, geht es von selbst zu',()=>{
  const a=dungeonUi();
  a.ui.apply({dungeon:raum('finished')});a.ui.show();
  const zurueck=a.knopf('Zurück zur Karte');
  a.ui.apply({dungeon:null});
  assert.equal(a.zu.zu,1,'Fenster zu, Joystick wieder da');assert.equal(a.ui.active(),false);
  /* Der alte Knopf darf trotzdem nicht mehr abstuerzen (frueher: room.phase auf null). */
  assert.doesNotThrow(()=>zurueck.events.click());
});

await test('Ein laufender Dungeon bleibt offen',()=>{
  const a=dungeonUi();
  a.ui.apply({dungeon:raum('battle')});a.ui.show();
  a.ui.apply({dungeon:raum('battle')});
  assert.equal(a.zu.zu,0);assert.equal(a.ui.active(),true);
});

/* ---------------------------------------------- Alle an den Start */
const mon=Date.parse('2026-09-21T09:00:00+02:00');
function store(){let data=null,v=0;return{get data(){return data;},async getWithMetadata(){return data?{data:structuredClone(data),etag:String(v)}:null;},async setJSON(k,next,o={}){if(o.onlyIfNew&&data||o.onlyIfMatch!==undefined&&o.onlyIfMatch!==String(v))return{modified:false};data=structuredClone(next);v++;return{modified:true};}};}
const CODES=[];for(let n=0;CODES.length<3;n++){const code=String(n).padStart(4,'0'),text='code:'+code+':gehstock:hideout:2026:kellergewoelbe';let h=0x811c9dc5;for(const c of text){h^=c.charCodeAt(0);h=(h+(h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24))>>>0;}if(h%97===0)CODES.push(code);}
const [ca,cb,cc]=CODES;
function welt(){
  const uhr={t:mon},db=store(),presence=store();let serial=0;
  const handler=createHandler({store:db,presenceStore:presence,now:()=>uhr.t,random:()=>0});
  const call=async(code,op,extra={})=>{const r=await handler(new Request('http://localhost/api/gehstockmon',{method:'POST',body:JSON.stringify({code,op,name:code===ca?'Anna':code===cb?'Ben':'Cem',requestId:'festsitzen-'+(++serial),...extra})}));return{status:r.status,...await r.json()};};
  const laufen=async(code,start,ziel)=>{
    const weg=X.route(X.layout(db.data.territories),start,ziel,null)||[ziel];let pos={...start};
    for(const z of weg)while(Math.hypot(z.x-pos.x,z.z-pos.z)>0.01){const d=Math.hypot(z.x-pos.x,z.z-pos.z),s=Math.min(d,30);pos={x:pos.x+(z.x-pos.x)/d*s,z:pos.z+(z.z-pos.z)/d*s};uhr.t+=3000;
      const r=await call(code,'presence',{position:{...pos,heading:0}});assert.equal(r.positionCorrected,undefined);}
    return pos;
  };
  return {uhr,db,call,laufen};
}
const weit=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);

await test('Eine neue Welt stellt niemanden zurueck',async()=>{
  const w=welt(),a=await w.call(ca,'join');
  await w.call(ca,'presence',{position:{...a.spawn,heading:0}});
  const fern=await w.laufen(ca,a.spawn,{x:a.spawn.x+40,z:a.spawn.z+5});
  w.uhr.t+=3000;
  const r=await w.call(ca,'presence',{position:{...fern,heading:0}});
  assert.equal(r.positionCorrected,undefined);
});

await test('Die bestehende Welt stellt einmal alle an den Start - auch wer nah am Start stand',async()=>{
  const w=welt(),a=await w.call(ca,'join'),b=await w.call(cb,'join');
  await w.call(ca,'presence',{position:{...a.spawn,heading:0}});await w.call(cb,'presence',{position:{...b.spawn,heading:0}});
  const annaWeit=await w.laufen(ca,a.spawn,{x:a.spawn.x+90,z:a.spawn.z+10});
  const benNah=await w.laufen(cb,b.spawn,{x:b.spawn.x+12,z:b.spawn.z+4});
  /* So sah die Welt vor dieser Aenderung aus: ohne den Vermerk. */
  delete w.db.data.einmalig['2026-09-28-alle-zum-start'];
  w.uhr.t+=60000;
  /* Irgendein Zug schreibt die Welt und damit den Vermerk - hier betritt Cem die Insel.
     Anna und Ben laden nicht neu, sie melden nur weiter ihre Position. */
  assert.equal((await w.call(cc,'join')).status,200);
  assert.ok(w.db.data.einmalig['2026-09-28-alle-zum-start'],'Vermerk gesetzt');
  const start=X.outside(X.SPAWN,X.layout(w.db.data.territories));
  for(const p of Object.values(w.db.data.players))assert.ok(weit(p.spawn,start)<0.02);
  w.uhr.t+=6000;
  /* Ben stand in Laufweite des Starts - er wird trotzdem umgestellt. */
  for(const [code,alt] of [[ca,annaWeit],[cb,benNah]]){
    const r=await w.call(code,'presence',{position:{...alt,heading:0}});
    assert.equal(r.positionCorrected,true,'umgestellt');assert.ok(weit(r.position,start)<0.02,'an den Start');
    w.uhr.t+=3000;
    const da=await w.call(code,'presence',{position:{...r.position,heading:0}});
    assert.equal(da.positionCorrected,undefined,'vom Start aus angenommen');
    /* Und von dort laeuft man ganz normal weiter. */
    w.uhr.t+=3000;
    const weiter=await w.call(code,'presence',{position:{x:r.position.x+20,z:r.position.z,heading:0}});
    assert.equal(weiter.positionCorrected,undefined,'kann sich bewegen');
  }
  /* Wer die Welt neu betritt, beginnt nach dem Zurueckstellen am Start, danach wieder dort, wo er war. */
  const wieder=await w.call(cb,'join');assert.ok(weit(wieder.spawn,{x:start.x+20,z:start.z})<0.02,'der neue Ort gilt');
});

console.log(checks+' Festsitzen-Pruefungen bestanden.');
