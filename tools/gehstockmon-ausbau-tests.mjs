/* Der Ausbau vom 26. September 2026: behobene Fehler, Mehrfacheinsatz,
   feste Eier-Quoten mit Garantie, schimmernde Mons, Findelhaus und das
   Endgebiet. Aufruf: node tools/gehstockmon-ausbau-tests.mjs */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {data as D,economy as E,arena as A,adventure as X,hours as H} from '../netlify/functions/lib/gehstockmon-rules.mjs';
import {createHandler} from '../netlify/functions/gehstockmon.mjs';

const mon=Date.parse('2026-09-21T09:00:00+02:00');
let checks=0;async function test(name,fn){await fn();checks++;console.log('ok',name);}
function store(){let data=null,v=0;return{get data(){return data;},async getWithMetadata(){return data?{data:structuredClone(data),etag:String(v)}:null;},async setJSON(k,next,o={}){if(o.onlyIfNew&&data||o.onlyIfMatch!==undefined&&o.onlyIfMatch!==String(v))return{modified:false};data=structuredClone(next);v++;return{modified:true};}};}
const ALLE=[];for(let n=0;n<10000;n++){const code=String(n).padStart(4,'0'),text='code:'+code+':gehstock:hideout:2026:kellergewoelbe';let h=0x811c9dc5;for(const c of text){h^=c.charCodeAt(0);h=(h+(h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24))>>>0;}if(h%97===0)ALLE.push({code,rolle:['S','K','A'][Math.floor(h/97)%3]});}
const ca=ALLE[0].code,cb=ALLE[1].code,admin=ALLE.find(c=>c.rolle==='A').code;
function welt({zeit=mon,random}={}){
  const uhr={t:zeit},db=store(),presence=store();let serial=0;
  const handler=createHandler({store:db,presenceStore:presence,now:()=>uhr.t,...(random?{random}:{})});
  const call=async(code,op,extra={})=>{const r=await handler(new Request('http://localhost/api/gehstockmon',{method:'POST',body:JSON.stringify({code,op,name:code===ca?'Anna':'Ben',requestId:'ausbau-kennung-'+(++serial),...extra})}));return{status:r.status,...await r.json()};};
  /* Wie der Browser hinlaufen: 11 Schritte je Sekunde, alle drei Sekunden melden. */
  const laufen=async(code,start,ziel,territories)=>{
    const weg=X.route(X.layout(territories),start,ziel,null)||[ziel];let pos={...start};
    for(const z of weg)while(Math.hypot(z.x-pos.x,z.z-pos.z)>0.01){const d=Math.hypot(z.x-pos.x,z.z-pos.z),s=Math.min(d,30);pos={x:pos.x+(z.x-pos.x)/d*s,z:pos.z+(z.z-pos.z)/d*s};uhr.t+=3000;
      const r=await call(code,'presence',{position:{...pos,heading:0}});assert.equal(r.positionCorrected,undefined,'unterwegs korrigiert bei '+JSON.stringify(pos));}
    return pos;
  };
  return {uhr,db,presence,handler,call,laufen};
}

await test('Every move the browser sends as a game move carries the id the server demands',async()=>{
  const w=welt(),a=await w.call(ca,'join');
  Object.assign(w.db.data.territories[0],{ownerId:a.playerId,ownerName:'Anna',...E.outpost(null,mon)});
  const values=new Map(),gesendet=[];
  const SG={gehstockmon:{daten:D,wirtschaft:E,arena:A,abenteuer:X},storage:{get:(k,d)=>values.has(k)?structuredClone(values.get(k)):d,set:(k,v)=>values.set(k,structuredClone(v)),del:k=>values.delete(k)},auth:{aktuell:{code:ca,name:'Anna'}},offline:false,env:{}};
  const context=vm.createContext({SG,window:{},crypto:globalThis.crypto,AbortController,setTimeout,clearTimeout,Date,
    fetch:async(url,opts)=>{gesendet.push(JSON.parse(opts.body));return w.handler(new Request('http://localhost'+url,opts));}});
  vm.runInContext(fs.readFileSync('src/games/gehstockmon/2-online.js','utf8'),context);
  const R=SG.gehstockmon.online,truppe=a.profile.truppe;
  /* Genau die drei, die frueher mit "Aktionskennung fehlt" scheiterten. */
  let r=await R.request('plan',{monId:truppe[0],plan:[['ich_schwach','guard'],['immer','strike'],['aus','strike']]});
  assert.match(r.message,/nach deinem Plan/);
  r=await R.request('besatzung',{territoryId:1,squad:truppe});assert.match(r.message,/eigene Besatzung/);
  r=await R.request('besatzung',{territoryId:1,squad:null});assert.match(r.message,/Kampfteam/);
  r=await R.request('besatzung_auto',{});assert.match(r.message,/eigene Besatzung/);
  /* Und grundsaetzlich: jeder Spielzug geht mit Kennung raus. */
  for(const op of X.SPIELZUEGE){gesendet.length=0;try{await R.request(op,{});}catch(e){assert.doesNotMatch(e.message,/Aktionskennung/,op);}
    assert.ok(gesendet.length&&typeof gesendet[0].requestId==='string','the browser marks '+op+' as a game move');}
});

await test('Scouting a player territory shows the plan and nature its defenders really use',async()=>{
  const w=welt(),a=await w.call(ca,'join');await w.call(cb,'join');
  Object.assign(w.db.data.territories[5],{ownerId:a.playerId,ownerName:'Anna',...E.outpost(null,mon)});
  const p=w.db.data.players[a.playerId];p.wesen[p.truppe[0]]='wild';
  const plan=[['immer','guard'],['aus','strike'],['aus','strike']];
  assert.equal((await w.call(ca,'plan',{monId:p.truppe[0],plan})).status,200);
  const sicht=(await w.call(cb,'world')).territories[5];
  assert.deepEqual(sicht.defense[0].plan,plan,'the saved plan is visible');
  assert.equal(sicht.defense[0].wesen,'wild','and so is the nature');
  const imBrowser=A.defenders(6,sicht.defense);
  assert.ok(A.planGueltig(imBrowser[0].plan),'the scouting view reads a plan, not "Faustregel"');
  assert.ok(A.planGueltig(imBrowser[1].plan),'a Mon without an own plan shows the start plan it fights with');
});

await test('Confirming an unchanged squad no longer voids an attack on your territory',async()=>{
  const w=welt({random:()=>.5}),a=await w.call(ca,'join'),b=await w.call(cb,'join');
  Object.assign(w.db.data.territories[5],{ownerId:a.playerId,ownerName:'Anna',...E.outpost(null,mon)});
  const stark=['endrichter','nullwyrm','risskaiser','aetherdrache'];
  w.db.data.players[b.playerId].besitz.push(...stark);
  const version=(await w.call(cb,'world')).territories[5].version;
  let r=await w.call(cb,'arena_start',{territoryId:6,version,squad:stark});assert.equal(r.status,200,r.error);
  const truppe=(await w.call(ca,'world')).profile.truppe;
  assert.equal((await w.call(ca,'defend',{squad:truppe})).status,200);
  let bt=r.arena;
  for(let i=0;bt.phase!=='finished'&&i<200;i++){const u=bt.teams[0][bt.active[0]];
    r=await w.call(cb,'arena_turn',{battleId:bt.id,revision:bt.revision,action:bt.phase==='replace'?{kind:'switch',slot:bt.teams[0].findIndex(x=>x.hp>0)}:{kind:'move',move:bt.round>=u.powerReady?'power':'strike'}});bt=r.arena;}
  assert.equal(bt.winner,'wir','the attack counts');
  assert.equal(r.territories[5].ownerId,b.playerId,'and the territory changes hands');
});

await test('A real change to the defence still makes a running attack start over',async()=>{
  const w=welt({random:()=>.5}),a=await w.call(ca,'join'),b=await w.call(cb,'join');
  Object.assign(w.db.data.territories[5],{ownerId:a.playerId,ownerName:'Anna',...E.outpost(null,mon)});
  const stark=['endrichter','nullwyrm','risskaiser','aetherdrache'];
  w.db.data.players[b.playerId].besitz.push(...stark);
  w.db.data.players[a.playerId].besitz.push('kieselkrabb');
  const version=(await w.call(cb,'world')).territories[5].version;
  let r=await w.call(cb,'arena_start',{territoryId:6,version,squad:stark});
  const truppe=(await w.call(ca,'world')).profile.truppe;
  assert.equal((await w.call(ca,'defend',{squad:['kieselkrabb'].concat(truppe.slice(1))})).status,200);
  let bt=r.arena;
  for(let i=0;bt.phase!=='finished'&&i<200;i++){const u=bt.teams[0][bt.active[0]];
    r=await w.call(cb,'arena_turn',{battleId:bt.id,revision:bt.revision,action:bt.phase==='replace'?{kind:'switch',slot:bt.teams[0].findIndex(x=>x.hp>0)}:{kind:'move',move:bt.round>=u.powerReady?'power':'strike'}});bt=r.arena;}
  assert.equal(bt.winner,'stale');assert.equal(r.territories[5].ownerId,a.playerId);
});

await test('A landless newcomer finds a Findelhaus egg at once, then one each open hour up to two',async()=>{
  const w=welt(),a=await w.call(ca,'join');
  await w.laufen(ca,a.spawn,X.STADT_TOR,a.territories);
  let r=await w.call(ca,'findelei');assert.equal(r.status,200,r.error);
  assert.equal(r.profile.eggs.length,1,'the first egg is there right away');
  r=await w.call(ca,'findelei');assert.equal(r.status,400);assert.match(r.error,/kein Ei bereit/);
  /* Drei geoeffnete Stunden spaeter liegen zwei bereit, nicht drei. */
  w.uhr.t+=3*E.HOUR;await w.call(ca,'presence',{position:{...X.STADT_TOR,heading:0}});
  r=await w.call(ca,'world');assert.equal(r.stadt.findelei,2);assert.equal(r.stadt.findeleiMax,2);
  assert.equal((await w.call(ca,'findelei')).status,200);assert.equal((await w.call(ca,'findelei')).status,200);
  assert.equal((await w.call(ca,'findelei')).status,400,'the third one has to wait');
  /* Mit einem Aussenposten schliesst das Findelhaus. */
  Object.assign(w.db.data.territories[0],{ownerId:a.playerId,ownerName:'Anna',...E.outpost(null,w.uhr.t)});
  w.uhr.t+=3000;await w.call(ca,'presence',{position:{...X.STADT_TOR,heading:0}});
  r=await w.call(ca,'findelei');assert.equal(r.status,400);assert.match(r.error,/ohne Gebiet/);
});

await test('The test zone starts with full Findelhaus and Tagwerk stocks, even when the island is closed',async()=>{
  const samstag=Date.parse('2026-09-26T12:00:00+02:00'),w=welt({zeit:samstag});
  const r=await w.call(admin,'join',{adminOverride:true,adminCode:'3141'});
  assert.equal(r.status,200,r.error);assert.equal(r.sandbox,true);
  assert.equal(r.stadt.findelei,X.FINDELEI_VORRAT);assert.equal(r.stadt.tagwerk,X.TAGWERK_VORRAT);
});

await test('The same Mon may stand in the squad and on several outposts at once',()=>{
  const p=D.neuerStand(null,mon);p.besitz=p.besitz.concat(['kieselkrabb','wurzelzahn','pilzhueter','nachtflatter']);
  assert.equal(X.truppePruefen(p,p.truppe),null,'the squad itself');
  p.posten={1:p.truppe.slice(),2:p.truppe.slice()};
  const sauber=D.neuerStand(p,mon);
  assert.deepEqual(sauber.posten[1],p.truppe);assert.deepEqual(sauber.posten[2],p.truppe,'overlapping garrisons survive loading');
  assert.deepEqual(X.einsatzOrte(sauber,p.truppe[0]),['kampfteam',1,2]);
  assert.match(X.tauschErlaubt(sauber,p.truppe[0],'kieselkrabb')||'',/Kampfteam, Mooswacht und Flüsterufer/,'trading still names every post');
});

await test('Egg quotas are the same for everyone, whatever they already own',()=>{
  const summe=E.SCHLUPF_QUOTEN.reduce((s,v)=>s+v,0);
  assert.ok(Math.abs(summe-100)<1e-9,'the quotas add up to 100 %');
  const leer=D.neuerStand(null,mon),voll=D.neuerStand({besitz:D.KATALOG.map(k=>k.id)},mon);
  assert.deepEqual(E.schlupfChancen(leer).map(c=>c.anteil),E.schlupfChancen(voll).map(c=>c.anteil),'the table does not depend on the collection');
  /* Mit derselben Zufallsfolge schluepft bei beiden dieselbe Seltenheit - Ei fuer Ei. */
  let s1=11,s2=11;const z1=()=>((s1=(Math.imul(s1,1103515245)+12345)>>>0)/4294967296),z2=()=>((s2=(Math.imul(s2,1103515245)+12345)>>>0)/4294967296);
  const raenge=(p,z)=>Array.from({length:500},(_,i)=>{p.eggs=[{id:'e'+i,territoryId:1,startedAt:mon,readyAt:mon,producedAt:mon}];return E.hatch(p,'e'+i,mon,z).rang;});
  assert.deepEqual(raenge(leer,z1),raenge(voll,z2));
  /* Ueber viele Eier treffen die Anteile die Tabelle (die Garantie hebt Episch und Legendaer etwas an). */
  const p=D.neuerStand(null,mon),zaehler=D.SELTENHEITEN.map(()=>0);let s=5;const z=()=>((s=(Math.imul(s,1103515245)+12345)>>>0)/4294967296);
  for(let i=0;i<20000;i++){p.eggs=[{id:'q'+i,territoryId:1,startedAt:mon,readyAt:mon,producedAt:mon}];zaehler[E.hatch(p,'q'+i,mon,z).rang]++;}
  assert.ok(Math.abs(zaehler[0]/20000-.40)<.02,'Gewöhnlich about 40 %: '+zaehler[0]);
  assert.ok(Math.abs(zaehler[1]/20000-.25)<.02,'Selten about 25 %: '+zaehler[1]);
  assert.ok(zaehler[6]>0,'Apokalyptisch does happen: '+zaehler[6]);
});

await test('The pity counter guarantees Episch within ten eggs and Legendär within forty',()=>{
  const p=D.neuerStand(null,mon),immerGewoehnlich=()=>0,raenge=[];
  for(let i=1;i<=40;i++){p.eggs=[{id:'g'+i,territoryId:1,startedAt:mon,readyAt:mon,producedAt:mon}];const r=E.hatch(p,'g'+i,mon,immerGewoehnlich);raenge.push(r.rang);
    if(i%10===0&&i<40)assert.ok(r.garantiert&&r.rang>=3,'egg '+i+' is Episch by guarantee');}
  assert.equal(raenge.filter(r=>r===0).length,36,'the rest stays as rolled');
  assert.equal(raenge[39],4,'the fortieth is Legendär');
  assert.deepEqual(E.garantieStand(p).map(g=>g.noch),[10,40],'both counters start over');
  /* Ein Ei mit Mindest-Seltenheit (aus der Serien-Truhe) hebt den Wurf ebenfalls - und uebersteht das Laden. */
  const q=D.neuerStand({eggs:[{id:'serie',territoryId:6,startedAt:mon,producedAt:mon,mindestens:4,art:'serie'}]},mon);
  assert.equal(q.eggs[0].mindestens,4);assert.equal(q.eggs[0].art,'serie');
  assert.ok(E.hatch(q,'serie',mon+E.HOUR,immerGewoehnlich).rang>=4);
});

await test('A shiny hatch is kept, shown in the defence, and a shiny twin makes the owned Mon shiny',async()=>{
  let folge=[];const w=welt({random:()=>folge.length?folge.shift():.99}),a=await w.call(ca,'join');
  const p=w.db.data.players[a.playerId];
  /* Jede Anfrage zieht zuerst eine Zahl fuer sich; danach Seltenheit (Selten), Mon, Schimmer (ja) und Wesen (treu). */
  folge=[.5,.45,.5,0,.99];
  p.eggs=[{id:'glanz',territoryId:1,producedAt:mon,startedAt:mon-E.HATCH_TIME,readyAt:mon}];
  const r=await w.call(ca,'hatch',{eggId:'glanz'});
  assert.equal(r.status,200,r.error);assert.equal(r.schlupf.schimmernd,true);assert.match(r.message,/Schimmernd/);
  assert.equal(r.profile.schimmernd[r.monId],true,'the collection remembers it');
  assert.equal(r.profile.wesen[r.monId],'treu','the nature comes from its own draw, not from the one that picked the Mon');
  /* Im Kampfteam und damit in der Verteidigung traegt es seinen Schimmer. */
  Object.assign(w.db.data.territories[0],{ownerId:a.playerId,ownerName:'Anna',...E.outpost(null,mon)});
  const truppe=[r.monId].concat(r.profile.truppe.filter(id=>id!==r.monId).slice(0,3));
  const d=await w.call(ca,'defend',{squad:truppe});
  assert.equal(d.territories[0].defense.find(m=>m.id===r.monId).schimmernd,true);
  /* Ein schimmernder Zwilling faerbt das Mon, das schon da ist. */
  const q=D.neuerStand(null,mon),pool=D.KATALOG.filter(k=>k.seltenheit===0),stelle=(pool.findIndex(k=>k.id==='moosling')+.5)/pool.length;
  q.eggs=[{id:'zwilling',territoryId:1,startedAt:mon,readyAt:mon,producedAt:mon}];
  const zweite=[0,stelle,0],z=E.hatch(q,'zwilling',mon,()=>zweite.length?zweite.shift():.9);
  assert.equal(z.neu,false);assert.equal(z.schimmerNeu,true);assert.equal(q.schimmernd.moosling,true);
});

await test('The Zerhacker is sized for the players who are actually around this week',async()=>{
  const w=welt(),a=await w.call(ca,'join');
  for(let i=0;i<10;i++)w.db.data.players['alt'+i]={...D.neuerStand(null,mon-30*86400000),name:'Alt '+i,lastSeen:mon-30*86400000,lastOfflineLoss:0};
  const r=await w.call(ca,'world');
  assert.equal(r.zerhacker.maxHp,X.zerhackerKraft(1),'ten long-gone accounts do not make it stronger');
});

await test('The endgame territory can be taken by the best possible team, but not by four legendaries',()=>{
  let saat=3;const zufall=()=>((saat=(Math.imul(saat,1664525)+1013904223)>>>0)/4294967296);
  const siege=(ids,n)=>{let s=0;for(let k=0;k<n;k++){let b=A.create(ids.map(id=>({...D.mon(id),upgrade:5})),A.defenders(9,null),{territoryId:9,level:1,npcTerritory:true});
    for(let i=0;b.phase!=='finished'&&i<400;i++){if(b.phase==='replace'){const l=b.teams[0].map((u,j)=>u.hp>0?j:-1).filter(j=>j>=0);b=A.turn(b,{kind:'switch',slot:l[Math.floor(zufall()*l.length)]});continue;}
      const m=A.moves(b.teams[0][b.active[0]],b.round).filter(x=>x.enabled);b=A.turn(b,{kind:'move',move:m[Math.floor(zufall()*m.length)].id});}
    if(b.winner==='wir')s++;}return s;};
  assert.ok(siege(['endrichter','nullwyrm','risskaiser','chronoschreiter'],200)>=20,'the best team wins at least now and then');
  assert.equal(siege(['titanenkrone','sonnenkoenig','sternengeweih','leerenwyrm'],200),0,'four legendaries never do');
});

await test('Everyone gets the same three daily tasks, and they change with the school day',()=>{
  const heute=X.tagesaufgaben(mon);
  assert.equal(heute.length,3);assert.equal(new Set(heute.map(t=>t.id)).size,3,'three different tasks');
  assert.deepEqual(X.tagesaufgaben(mon+5*3600000).map(t=>t.id),heute.map(t=>t.id),'the whole day keeps its tasks');
  let anders=false;for(let d=1;d<10;d++)if(X.tagesaufgaben(mon+d*86400000).map(t=>t.id).join()!==heute.map(t=>t.id).join())anders=true;
  assert.ok(anders,'other days bring other tasks');
});

await test('Hatching and exploring count towards the daily tasks, and the chest opens only once all three are done',async()=>{
  const w=welt({random:()=>.45}),a=await w.call(ca,'join'),p=()=>w.db.data.players[a.playerId];
  p().eggs=[{id:'heute',territoryId:1,producedAt:mon,startedAt:mon-E.HATCH_TIME,readyAt:mon}];
  let r=await w.call(ca,'hatch',{eggId:'heute'});assert.equal(r.status,200,r.error);
  assert.equal(p().alltag.zaehler.ei,1,'a hatch counts');
  await w.call(ca,'presence',{position:{...a.spawn,heading:0}});
  r=await w.call(ca,'survey');assert.equal(r.status,200,r.error);
  assert.equal(p().alltag.zaehler.erkunden,1,'exploring counts');
  assert.equal((await w.call(ca,'survey')).status,200);assert.equal(p().alltag.zaehler.erkunden,1,'the same biome twice is still one');
  r=await w.call(ca,'tagestruhe');assert.equal(r.status,400);assert.match(r.error,/alle drei/);
  for(const t of X.tagesaufgaben(w.uhr.t))for(let i=0;i<t.ziel;i++)X.alltagSchritt(p(),t.id,w.uhr.t,t.id==='erkunden'?i+5:1);
  const gold=p().gold,eier=p().eggs.length;
  r=await w.call(ca,'tagestruhe');assert.equal(r.status,200,r.error);
  assert.equal(r.profile.gold,gold+X.SERIE.gold);assert.equal(r.profile.eggs.length,eier+1,'the chest holds an egg');
  assert.equal(r.alltag.truhe,true);assert.equal(r.alltag.serie,1);
  r=await w.call(ca,'tagestruhe');assert.equal(r.status,400);assert.match(r.error,/schon geöffnet/);
});

await test('The streak counts school days, jumps the weekend, pays special eggs and breaks on a missed day',async()=>{
  const w=welt({zeit:Date.parse('2026-09-21T08:00:00+02:00')}),a=await w.call(ca,'join'),p=()=>w.db.data.players[a.playerId];
  const truhe=async(tag)=>{w.uhr.t=Date.parse(tag+'T08:00:00+02:00');await w.call(ca,'world');
    for(const t of X.tagesaufgaben(w.uhr.t))for(let i=0;i<t.ziel;i++)X.alltagSchritt(p(),t.id,w.uhr.t,t.id==='erkunden'?i+1:1);
    const r=await w.call(ca,'tagestruhe');assert.equal(r.status,200,tag+': '+r.error);return r;};
  const tage=['2026-09-21','2026-09-22','2026-09-23','2026-09-24','2026-09-25','2026-09-28'];
  let r;for(let i=0;i<tage.length;i++){r=await truhe(tage[i]);assert.equal(r.truhe.serie,i+1,tage[i]+' continues the streak');
    if(i+1===5){assert.equal(r.truhe.eiMindestens,3,'day five brings an Episch egg');assert.equal(r.profile.eggs.at(-1).mindestens,3);
      assert.ok(r.ticker.some(e=>/Serie seit 5 Schultagen/.test(e.text)),'day five is news for everyone');}}
  assert.equal(r.truhe.gold,X.SERIE.gold+5*X.SERIE.jeTag,'gold grows with the streak');
  /* Dienstag verpasst: am Mittwoch faengt sie von vorn an. */
  r=await truhe('2026-09-30');assert.equal(r.truhe.serie,1,'a missed school day breaks it');
});

await test('A chest egg waits for room in a full bag and moves in when a slot frees up',async()=>{
  const w=welt({random:()=>.45}),a=await w.call(ca,'join'),p=()=>w.db.data.players[a.playerId];
  p().eggs=Array.from({length:E.BAG_LIMIT},(_,i)=>({id:'voll'+i,territoryId:1,producedAt:mon,startedAt:i?null:mon-E.HATCH_TIME,readyAt:i?null:mon}));
  for(const t of X.tagesaufgaben(mon))for(let i=0;i<t.ziel;i++)X.alltagSchritt(p(),t.id,mon,t.id==='erkunden'?i+1:1);
  let r=await w.call(ca,'tagestruhe');assert.equal(r.status,200,r.error);assert.equal(r.truhe.wartet,true);
  assert.equal(r.profile.sonderEier.length,1);assert.equal(r.profile.eggs.length,E.BAG_LIMIT);
  r=await w.call(ca,'hatch',{eggId:'voll0'});assert.equal(r.status,200,r.error);
  assert.equal(r.profile.sonderEier.length,0);assert.ok(r.profile.eggs.some(e=>e.art==='truhe'),'the waiting egg moved into the bag');
});

await test('The island ticker reports rare hatches and conquests to everyone, tagged with the actor',async()=>{
  let folge=[];const w=welt({random:()=>folge.length?folge.shift():.5}),a=await w.call(ca,'join'),b=await w.call(cb,'join');
  const p=()=>w.db.data.players[a.playerId];
  p().eggs=[{id:'selten',territoryId:1,producedAt:mon,startedAt:mon-E.HATCH_TIME,readyAt:mon}];
  folge=[.5,.97,.5,.9,.5];/* Anfrage, Seltenheit (Legendaer), Mon, kein Schimmer, Wesen */
  let r=await w.call(ca,'hatch',{eggId:'selten'});assert.equal(r.status,200,r.error);assert.equal(r.schlupf.rang,4);
  const sicht=await w.call(cb,'world'),eintrag=sicht.ticker.at(-1);
  assert.match(eintrag.text,/Anna hat .* ausgebrütet \(Legendär\)/);assert.equal(eintrag.wer,a.playerId);
  /* Gewoehnliches bleibt still. */
  p().eggs=[{id:'alltag',territoryId:1,producedAt:mon,startedAt:mon-E.HATCH_TIME,readyAt:mon}];folge=[.5,.1,.5,.9,.5];
  assert.equal((await w.call(ca,'hatch',{eggId:'alltag'})).status,200);assert.equal((await w.call(cb,'world')).ticker.length,sicht.ticker.length);
  /* Eine Eroberung von einem Spieler. */
  Object.assign(w.db.data.territories[5],{ownerId:b.playerId,ownerName:'Ben',...E.outpost(null,mon)});
  const stark=['endrichter','nullwyrm','risskaiser','aetherdrache'];p().besitz.push(...stark);
  r=await w.call(ca,'arena_start',{territoryId:6,version:(await w.call(ca,'world')).territories[5].version,squad:stark});
  let bt=r.arena;for(let i=0;bt.phase!=='finished'&&i<200;i++){const u=bt.teams[0][bt.active[0]];
    r=await w.call(ca,'arena_turn',{battleId:bt.id,revision:bt.revision,action:bt.phase==='replace'?{kind:'switch',slot:bt.teams[0].findIndex(x=>x.hp>0)}:{kind:'move',move:bt.round>=u.powerReady?'power':'strike'}});bt=r.arena;}
  assert.equal(bt.winner,'wir');assert.match(r.ticker.at(-1).text,/Anna erobert Tauwiese von Ben/);
  assert.ok(r.ticker.length<=12,'the view stays short');
});

console.log('\n'+checks+' Ausbau-Pruefungen bestanden.');
