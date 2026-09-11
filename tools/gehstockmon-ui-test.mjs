/* Actual UI handlers, fake DOM and controlled clock; not a rendering/device test. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
class Element{
  constructor(tag){this.tagName=tag;this.children=[];this.events={};this.attrs={};this.hidden=false;this.disabled=false;this.className='';this.style={setProperty(){}};this.text='';this.value='';this.selected=false;this.classList={contains:c=>this.className.split(' ').includes(c),add:(...cs)=>{this.className=[...new Set(this.className.split(' ').concat(cs))].join(' ');},remove:(...cs)=>{this.className=this.className.split(' ').filter(c=>!cs.includes(c)).join(' ');},toggle:(c,yes)=>yes?this.classList.add(c):this.classList.remove(c)};}
  appendChild(e){e.parentNode=this;this.children.push(e);return e;}insertBefore(e,before){e.parentNode=this;this.children.splice(this.children.indexOf(before),0,e);}removeChild(e){this.children.splice(this.children.indexOf(e),1);e.parentNode=null;}remove(){this.parentNode?.removeChild(this);}
  get firstChild(){return this.children[0];}get lastChild(){return this.children.at(-1);}set textContent(v){this.text=String(v);this.children=[];}get textContent(){return this.text+this.children.map(c=>c.textContent).join('');}
  setAttribute(k,v){this.attrs[k]=String(v);}getAttribute(k){return this.attrs[k];}addEventListener(k,fn){this.events[k]=fn;}removeEventListener(k){delete this.events[k];}fire(k){if(!this.disabled)this.events[k]?.({target:this});}
  get visible(){return!this.hidden&&(!this.parentNode||this.parentNode.visible);}all(){return[this,...this.children.flatMap(e=>e.all())];}
  querySelectorAll(selector){return this.all().filter(e=>{if(selector[0]==='.')return e.classList.contains(selector.slice(1));const m=selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);if(m)return e.attrs[m[1]]!==undefined&&(m[2]===undefined||e.attrs[m[1]]===m[2]);return e.tagName===selector;});}querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
}
export async function checkUi(D,E,A,handler,code,clock,otherCode){
  const legacy={gold:999999,besitz:D.KATALOG.map(k=>k.id),geschafft:[1,2,3]};
  const values=new Map([['stand',legacy],['arena-v1',{invalid:'legacy fight'}],['online-squad',['moosling']]]),timers=new Map(),storage={get:(k,d)=>values.has(k)?structuredClone(values.get(k)):d,set:(k,v)=>values.set(k,structuredClone(v)),del:k=>values.delete(k)};
  let definition,timerId=0,blocked=false,pauses=[],latest,unreachable=true,loseResponse=false,requests=[],visiblePeers=[],worldFrame;
  const stage=new Element('div'),root=new Element('div');root.appendChild(stage);
  const world={setHeld(){},setSquad(){},setTerritories(){},setPeers:list=>visiblePeers=list,position:()=>({x:-10,z:17,heading:0}),select(){},follow(){},overview(){},distanceTo:()=>0,blockInput:yes=>{blocked=yes;},move(){},pause:yes=>pauses.push(yes),destroy(){}};
  const SG={gehstockmon:{daten:D,wirtschaft:E,arena:A,orte:D.BIOME,createWorld:(host,container,handlers)=>{worldFrame=handlers.frame;return world;}},util:{},storage,auth:{aktuell:{code,name:'UI Test'}},offline:false,env:{},assets:{},register:def=>{definition=def;}};
  const document={createElement:tag=>new Element(tag),addEventListener(){},removeEventListener(){},hidden:false};
  const listeners={};
  const context=vm.createContext({SG,document,window:{addEventListener:(k,fn)=>listeners[k]=fn,removeEventListener:k=>delete listeners[k]},Date:class extends Date{static now(){return clock.value;}},AbortController,setTimeout,clearTimeout,fetch:async(url,opts)=>{
    requests.push(JSON.parse(opts.body));if(unreachable)throw new TypeError('Server nicht erreichbar');
    const response=await handler(new Request('http://localhost'+url,opts));if(response.ok){const data=await response.clone().json();if(data.profile)latest=data;}
    if(loseResponse){loseResponse=false;throw new TypeError('Antwort verloren');}return response;
  }});
  for(const file of['src/core/ui.js','src/games/gehstockmon/2-online.js','src/games/gehstockmon/3-ui.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context);
  const mount=()=>definition.mount({stage,root,store:storage,onLeave(){},sfx(){},after:(fn,ms)=>{timers.set(++timerId,{fn,at:clock.value+ms});return timerId;},cancel:id=>timers.delete(id)});
  let game=mount();
  const find=fn=>{const e=root.all().find(e=>e.visible&&fn(e));assert.ok(e,'control exists');return e;};
  const click=text=>{const b=find(e=>e.tagName==='button'&&e.textContent===text);assert.equal(b.disabled,false,text+' enabled');b.fire('click');};
  const flush=async()=>{for(let i=0;i<16;i++)await new Promise(setImmediate);};
  function advance(ms){const end=clock.value+ms;let n=0;while(true){const due=[...timers].filter(([id,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;assert.ok(n++<10000);timers.delete(due[0]);clock.value=Math.max(clock.value,due[1].at);due[1].fn();}clock.value=end;}
  async function jump(until){clock.value=until;advance(1000);await flush();}
  function chooseMove(b){
    if(b.phase==='replace'){find(e=>e.attrs['aria-label']===b.teams[0].find(u=>u.hp>0).name+' einwechseln').fire('click');return;}
    const u=b.teams[0][b.active[0]],enemy=b.teams[1][b.active[1]];
    let move='strike';if(u.charges>0&&((u.role===2&&u.hp<u.maxHp*.67)||(u.role===1&&enemy.hp<=enemy.maxHp*.35)||(u.role===3&&!enemy.weakened)))move='special';else if(b.round>=u.powerReady)move='power';
    find(e=>e.classList.contains('gm-move-'+move)).fire('click');
  }
  assert.ok(blocked,'no movement before join');assert.equal(definition.onlineOnly,true);await flush();
  assert.ok(!root.querySelector('.gm-connection').hidden,'startup failure keeps game gated');
  assert.equal(game.state.besitz.length,4,'legacy local collection never imported');assert.equal(game.state.gold,180);
  unreachable=false;click('Erneut verbinden');await flush();assert.equal(requests.at(-1).op,'join');assert.equal(root.querySelector('.gm-connection').hidden,true);assert.equal(blocked,false);
  assert.ok(!root.textContent.includes('lokalen Kampagne'));assert.equal(latest.profile.gold,180);
  await handler(new Request('http://localhost/api/gehstockmon',{method:'POST',body:JSON.stringify({code:otherCode,name:'Mitspieler',op:'join'})}));
  await handler(new Request('http://localhost/api/gehstockmon',{method:'POST',body:JSON.stringify({code:otherCode,op:'presence',position:{x:-12,z:18,heading:0}})}));
  advance(2200);await flush();assert.equal(visiblePeers.length,1);assert.equal(visiblePeers[0].name,'Mitspieler');
  worldFrame(()=>({x:200,y:200,near:true,visible:true}),false,null,visiblePeers.map(info=>({id:info.id,position:info,info})));assert.equal(root.querySelector('.gm-peer-label').hidden,false);assert.equal(root.querySelector('.gm-peer-label').textContent,'Mitspieler');
  click('⚔ Arena betreten');await flush();assert.ok(blocked);assert.equal(pauses.at(-1),true);
  let b=latest.arena;for(let turn=0;b.phase!=='finished'&&turn<90;turn++){chooseMove(b);await flush();advance(5000);await flush();b=latest.arena;}
  assert.equal(b.winner,'wir');assert.equal(latest.territories[0].ownerId,latest.playerId);click('Zurück zur Karte');assert.equal(blocked,false);assert.equal(pauses.at(-1),false);
  click('⌖ Weltkarte');assert.ok(root.all().some(e=>e.classList.contains('gm-pin-owner')&&e.textContent==='Besitzer: UI Test'),'map names the territory owner');find(e=>e.attrs['aria-label']===D.FELDER[0].name+' auswählen').fire('click');
  const goldAfterWin=game.state.gold;advance(3000);assert.equal(game.state.gold,goldAfterWin,'client never grants rewards');
  await jump(latest.territories[0].eggAt+E.EGG_TIME);click('⚑ Außenposten');click('Außenposten verwalten');click('Eier abholen');await flush();assert.equal(game.state.eggs.length,1);
  click('◉ Eier');click('Ausbrüten · 1 Stunde');await flush();const egg=game.state.eggs[0];assert.ok(egg.readyAt>clock.value);await jump(egg.readyAt);click('Schlüpfen lassen');await flush();assert.equal(game.state.besitz.length,5);assert.equal(game.state.eggs.length,0);
  click('▦ Mons');find(e=>e.classList.contains('gm-party-card')).fire('click');const old=game.state.truppe.slice();click('2. Platz: '+D.mon(old[1]).name);await flush();assert.equal(game.state.truppe[1],old[0]);assert.equal(latest.profile.truppe[1],old[0],'squad saved on server immediately');
  click('×');find(e=>e.attrs['aria-label']===D.FELDER[1].name+' auswählen').fire('click');click('⚔ Arena betreten');await flush();
  game.destroy();timers.clear();while(stage.firstChild)stage.removeChild(stage.firstChild);game=mount();await flush();assert.equal(game.state.besitz.length,5);assert.equal(game.state.truppe[1],old[0]);assert.equal(root.querySelector('.gm-arena').hidden,false,'active server arena resumes on reload');
  const revision=latest.arena.revision,gold=game.state.gold;loseResponse=true;chooseMove(latest.arena);await flush();assert.ok(blocked);assert.equal(root.querySelector('.gm-connection').hidden,false);assert.ok(SG.gehstockmon.online.pending());
  assert.equal(latest.arena.revision,revision+1,'lost response action did run on server');assert.equal(game.state.gold,gold);
  click('Offene Aktion prüfen');await flush();assert.equal(latest.arena.revision,revision+1,'reconnect does not run action twice');assert.equal(SG.gehstockmon.online.pending(),null);assert.equal(root.querySelector('.gm-connection').hidden,true);
  await jump(clock.value+21*60000);find(e=>e.classList.contains('gm-move-strike')).fire('click');await flush();
  click('Kampfstand abrufen');await flush();click('Zurück zur Karte');assert.equal(blocked,false,'expired server fight can be exited');
  click('◉ Eier');await jump(clock.value+45000);assert.ok(root.all().some(e=>e.visible&&e.tagName==='h2'&&e.textContent==='Brutstation'),'passive update keeps drawer open');
  const storedGold=game.state.gold;unreachable=true;listeners.offline();assert.ok(blocked);await jump(clock.value+3*E.HOUR);assert.equal(game.state.gold,storedGold,'offline clock cannot advance progression');
  unreachable=false;listeners.online();await flush();assert.equal(root.querySelector('.gm-connection').hidden,true);assert.ok(game.state.gold>storedGold,'server settles income on reconnect');
  assert.deepEqual(values.get('stand'),legacy,'old local save left intact and unused');assert.deepEqual(values.get('arena-v1'),{invalid:'legacy fight'});assert.deepEqual(values.get('online-squad'),['moosling']);
  game.destroy();
  assert.equal(listeners.offline,undefined);assert.equal(listeners.online,undefined);
  // A direct offline-file route is gated too, even though the catalog hides it.
  timers.clear();while(stage.firstChild)stage.removeChild(stage.firstChild);SG.offline=true;const count=requests.length;game=mount();await flush();assert.equal(requests.length,count);assert.ok(blocked);assert.equal(root.querySelector('.gm-connection').hidden,false);game.destroy();
}
