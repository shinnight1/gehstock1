/* Das Inseltor (Zug 'admin_tor'): der CEO und der Aufsichtsrat machen die
   Spielerwelt auf und zu, sonst niemand.
   Aufruf: node tools/gehstockmon-inseltor-tests.mjs */
import assert from 'node:assert/strict';
import {createHandler} from '../netlify/functions/gehstockmon.mjs';

const mon=Date.parse('2026-09-21T09:00:00+02:00');   // Montag, mitten in der Schulzeit
const sam=Date.parse('2026-09-26T11:00:00+02:00');   // Samstag, normal geschlossen
let checks=0;async function test(name,fn){await fn();checks++;console.log('ok',name);}

/* Wie der Speicher im Betrieb: get, getWithMetadata und setJSON. Die
   knapperen Attrappen der anderen Testdateien koennen kein get - das
   Tor braucht es. */
function store(anfang=null){
  let data=anfang,v=0;
  return {get data(){return data;},
    async get(){return data?structuredClone(data):null;},
    async getWithMetadata(){return data?{data:structuredClone(data),etag:String(v)}:null;},
    async setJSON(k,next,o={}){if(o.onlyIfNew&&data||o.onlyIfMatch!==undefined&&o.onlyIfMatch!==String(v))return{modified:false};data=structuredClone(next);v++;return{modified:true};}};
}
/* Ein Speicher mit mehreren Schluesseln - der Spielserver legt Welt und
   Tor nebeneinander ab. */
function mehrfach(){
  const m=new Map();let v=0;
  return {roh:m,
    async get(k){return m.has(k)?structuredClone(m.get(k)):null;},
    async getWithMetadata(k){return m.has(k)?{data:structuredClone(m.get(k)),etag:String(v)}:null;},
    async setJSON(k,next,o={}){if(o.onlyIfNew&&m.has(k)||o.onlyIfMatch!==undefined&&o.onlyIfMatch!==String(v))return{modified:false};m.set(k,structuredClone(next));v++;return{modified:true};}};
}

/* Drei gueltige Admin-Codes: CEO, Aufsichtsrat und ein gewoehnlicher. */
const ADMINS=[];
for(let n=0;ADMINS.length<3&&n<10000;n++){
  const code=String(n).padStart(4,'0'),text='code:'+code+':gehstock:hideout:2026:kellergewoelbe';
  let h=0x811c9dc5;for(const c of text){h^=c.charCodeAt(0);h=(h+(h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24))>>>0;}
  if(h%97===0&&['S','K','A'][Math.floor(h/97)%3]==='A')ADMINS.push(code);
}
const [CEO,AUFSICHT,ADMIN]=ADMINS;
assert.equal(ADMINS.length,3,'drei Admin-Codes gefunden');

function welt({verwaltung={owner:CEO,aufsicht:AUFSICHT},t=mon}={}){
  const uhr={t},db=mehrfach(),presence=store(),verw=store(verwaltung);let serial=0;
  const handler=createHandler({store:db,presenceStore:presence,verwStore:verw,now:()=>uhr.t,random:()=>0});
  const call=async(code,op,extra={})=>{
    const r=await handler(new Request('http://localhost/api/gehstockmon',{method:'POST',
      body:JSON.stringify({code,op,name:'Test',requestId:'tor-'+(++serial),...extra})}));
    return{status:r.status,...await r.json()};
  };
  return {uhr,db,call};
}

await test('Ohne Eintrag gelten die Schulzeiten',async()=>{
  const w=welt();
  const r=await w.call(ADMIN,'admin_tor');
  assert.equal(r.status,200);
  assert.equal(r.tor,'auto','Lesen darf jeder Admin');
  assert.equal(r.access.open,true,'Montag um neun ist offen');
});

await test('Ein gewoehnlicher Admin darf das Tor nicht stellen',async()=>{
  const w=welt();
  const r=await w.call(ADMIN,'admin_tor',{modus:'zu'});
  assert.equal(r.status,403);
  assert.match(r.error,/CEO oder der Aufsichtsrat/);
  assert.equal((await w.call(ADMIN,'admin_tor')).tor,'auto','nichts veraendert');
});

await test('Ein Spielercode kommt gar nicht erst durch',async()=>{
  const w=welt();
  const nichtAdmin=(()=>{for(let n=0;n<10000;n++){const code=String(n).padStart(4,'0'),
    text='code:'+code+':gehstock:hideout:2026:kellergewoelbe';let h=0x811c9dc5;
    for(const c of text){h^=c.charCodeAt(0);h=(h+(h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24))>>>0;}
    if(h%97===0&&['S','K','A'][Math.floor(h/97)%3]==='S')return code;}})();
  const r=await w.call(nichtAdmin,'admin_tor',{modus:'zu'});
  assert.equal(r.status,403);
  assert.match(r.error,/Administrator/);
});

await test('Der CEO schliesst die Insel, und niemand kommt mehr herein',async()=>{
  const w=welt();
  const zu=await w.call(CEO,'admin_tor',{modus:'zu'});
  assert.equal(zu.status,200);assert.equal(zu.tor,'zu');assert.equal(zu.access.open,false);
  const rein=await w.call(ADMIN,'join');
  assert.equal(rein.status,423,'geschlossen trotz Schulzeit');
  assert.match(rein.error,/Insel ist geschlossen/);
});

await test('Der Aufsichtsrat macht sie wieder auf',async()=>{
  const w=welt();
  await w.call(CEO,'admin_tor',{modus:'zu'});
  w.uhr.t+=30000;                                  // ueber das kurze Gedaechtnis hinaus
  const auf=await w.call(AUFSICHT,'admin_tor',{modus:'auto'});
  assert.equal(auf.status,200);assert.equal(auf.tor,'auto');
  w.uhr.t+=30000;
  assert.equal((await w.call(ADMIN,'join')).status,200,'wieder offen');
});

await test('Offen gestellt gilt auch am Samstag',async()=>{
  const w=welt({t:sam});
  assert.equal((await w.call(ADMIN,'join')).status,423,'Wochenende ist sonst zu');
  const auf=await w.call(CEO,'admin_tor',{modus:'auf'});
  assert.equal(auf.status,200);assert.equal(auf.access.open,true);
  w.uhr.t+=30000;
  assert.equal((await w.call(ADMIN,'join')).status,200,'das Tor sticht die Schulzeiten');
});

await test('Das Tor haelt ueber das kurze Gedaechtnis hinaus',async()=>{
  const w=welt();
  await w.call(CEO,'admin_tor',{modus:'zu'});
  w.uhr.t+=60000;                                  // Merker laengst abgelaufen
  assert.equal((await w.call(ADMIN,'join')).status,423,'aus dem Speicher gelesen');
  assert.equal(w.db.roh.get('tor').modus,'zu','steht im Speicher');
  assert.equal(w.db.roh.get('tor').von,'Test','mit Namen');
});

await test('Ohne lesbare Verwaltung sagt der Server nein',async()=>{
  const w=welt({verwaltung:null});
  const r=await w.call(CEO,'admin_tor',{modus:'zu'});
  assert.equal(r.status,403,'im Zweifel nicht erlauben');
});

console.log('\n'+checks+' Pruefungen bestanden.');
