/* Zurueck zum Start (Zug 'zum_start'): alle fuenf Minuten an den
   Startplatz, und die Wegpruefung laesst den Sprung gelten.
   Aufruf: node tools/gehstockmon-startsprung-tests.mjs */
import assert from 'node:assert/strict';
import {data as D,adventure as X} from '../netlify/functions/lib/gehstockmon-rules.mjs';
import {createHandler} from '../netlify/functions/gehstockmon.mjs';

const mon=Date.parse('2026-09-21T09:00:00+02:00');
let checks=0;async function test(name,fn){await fn();checks++;console.log('ok',name);}
function store(){let data=null,v=0;return{get data(){return data;},async getWithMetadata(){return data?{data:structuredClone(data),etag:String(v)}:null;},async setJSON(k,next,o={}){if(o.onlyIfNew&&data||o.onlyIfMatch!==undefined&&o.onlyIfMatch!==String(v))return{modified:false};data=structuredClone(next);v++;return{modified:true};}};}
const CODES=[];for(let n=0;CODES.length<2;n++){const code=String(n).padStart(4,'0'),text='code:'+code+':gehstock:hideout:2026:kellergewoelbe';let h=0x811c9dc5;for(const c of text){h^=c.charCodeAt(0);h=(h+(h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24))>>>0;}if(h%97===0)CODES.push(code);}
const [ca,cb]=CODES;
function welt(){
  const uhr={t:mon},db=store(),presence=store();let serial=0;
  const handler=createHandler({store:db,presenceStore:presence,now:()=>uhr.t,random:()=>0});
  const call=async(code,op,extra={})=>{const r=await handler(new Request('http://localhost/api/gehstockmon',{method:'POST',body:JSON.stringify({code,op,name:code===ca?'Anna':'Ben',requestId:'startsprung-'+(++serial),...extra})}));return{status:r.status,...await r.json()};};
  /* Wie der Browser hinlaufen: hoechstens 30 Schritte, alle drei Sekunden melden. */
  const laufen=async(code,start,ziel)=>{
    const weg=X.route(X.layout(db.data.territories),start,ziel,null)||[ziel];let pos={...start};
    for(const z of weg)while(Math.hypot(z.x-pos.x,z.z-pos.z)>0.01){const d=Math.hypot(z.x-pos.x,z.z-pos.z),s=Math.min(d,30);pos={x:pos.x+(z.x-pos.x)/d*s,z:pos.z+(z.z-pos.z)/d*s};uhr.t+=3000;
      const r=await call(code,'presence',{position:{...pos,heading:0}});assert.equal(r.positionCorrected,undefined,'unterwegs korrigiert bei '+JSON.stringify(pos));}
    return pos;
  };
  return {uhr,db,presence,call,laufen};
}
const weit=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);

await test('Beide Seiten kennen den Zug und die Wartezeit',()=>{
  assert.ok(X.SPIELZUEGE.includes('zum_start'),'der Browser haengt eine Aktionskennung an');
  assert.equal(X.START_SPRUNG_PAUSE,5*60000);
  assert.equal(X.startSprungAb({}),0);
  assert.equal(X.startSprungAb({startSprungAt:1000}),1000+5*60000);
  assert.equal(D.neuerStand({startSprungAt:mon},mon).startSprungAt,mon,'bleibt im Spielstand');
  assert.equal(D.neuerStand({startSprungAt:'x'},mon).startSprungAt,0);
});

await test('Der Sprung setzt die Figur an den Start, und von dort geht es ohne Korrektur weiter',async()=>{
  const w=welt(),a=await w.call(ca,'join');assert.equal(a.status,200);
  await w.call(ca,'presence',{position:{...a.spawn,heading:0}});
  const ziel={x:a.spawn.x+90,z:a.spawn.z+10};assert.ok(X.walkable(ziel));
  const fern=await w.laufen(ca,a.spawn,ziel);
  assert.ok(weit(fern,a.spawn)>60,'weit weg gelaufen');
  w.uhr.t+=2000;
  const r=await w.call(ca,'zum_start');
  assert.equal(r.status,200,r.error);
  const start=X.outside(X.SPAWN,X.layout(w.db.data.territories));
  assert.ok(weit(r.startSprung,start)<0.02,'am Startplatz');
  assert.equal(r.profile.startSprungAt,w.uhr.t,'die Wartezeit steht im Spielstand');
  /* Der Browser meldet jetzt den Startplatz - das muss ohne Korrektur durchgehen. */
  w.uhr.t+=3000;
  const da=await w.call(ca,'presence',{position:{...r.startSprung,heading:0}});
  assert.equal(da.status,200);assert.equal(da.positionCorrected,undefined);
  /* Zurueck an den alten Ort springen geht dagegen nicht. */
  w.uhr.t+=3000;
  const zurueck=await w.call(ca,'presence',{position:{...fern,heading:0}});
  assert.equal(zurueck.positionCorrected,true);
  assert.ok(weit(zurueck.position,start)<0.5,'bleibt am Start');
  /* Die anderen sehen die Figur am Start. */
  const b=await w.call(cb,'join');const sicht=await w.call(cb,'presence',{position:{...b.spawn,heading:0}});
  const anna=sicht.peers.find((p)=>p.id===a.playerId);assert.ok(anna&&weit(anna,start)<0.5,'fuer Ben am Start');
});

await test('Nur alle fuenf Minuten',async()=>{
  const w=welt(),a=await w.call(ca,'join');
  await w.call(ca,'presence',{position:{...a.spawn,heading:0}});
  assert.equal((await w.call(ca,'zum_start')).status,200);
  w.uhr.t+=4*60000;
  const zu=await w.call(ca,'zum_start');
  assert.equal(zu.status,409);assert.match(zu.error,/erst wieder in 1 Minuten/);
  w.uhr.t+=60000;
  assert.equal((await w.call(ca,'zum_start')).status,200);
});

await test('Eine wiederholte Anfrage springt nicht doppelt und kostet keine zweite Wartezeit',async()=>{
  const w=welt(),a=await w.call(ca,'join');
  await w.call(ca,'presence',{position:{...a.spawn,heading:0}});
  const erst=await w.call(ca,'zum_start',{requestId:'gleiche-kennung-1'});
  w.uhr.t+=5000;
  const nochmal=await w.call(ca,'zum_start',{requestId:'gleiche-kennung-1'});
  assert.equal(nochmal.status,200);assert.equal(nochmal.duplicate,true);
  assert.deepEqual(nochmal.startSprung,erst.startSprung);
  assert.equal(nochmal.profile.startSprungAt,erst.profile.startSprungAt);
});

await test('Nicht mitten im Mon-Kampf',async()=>{
  const w=welt(),a=await w.call(ca,'join');
  await w.call(ca,'presence',{position:{...a.spawn,heading:0}});
  w.db.data.players[a.playerId].arena={id:'kampf',phase:'choose'};
  const r=await w.call(ca,'zum_start');
  assert.equal(r.status,409);assert.match(r.error,/Mon-Kampf/);
  assert.equal(w.db.data.players[a.playerId].startSprungAt||0,0,'keine Wartezeit verbraucht');
});

console.log(checks+' Startsprung-Pruefungen bestanden.');
