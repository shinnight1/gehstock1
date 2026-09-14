/* Exercise real Three.js scene construction and movement without a browser. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { data as D, fight, adventure as X } from '../netlify/functions/lib/gehstockmon-rules.mjs';
let scene, camera, loop, listeners = new Map(), disposed = false, loopDestroyed = false;
let keyedPixels;
function surface() { return { setPointerCapture() {}, hasPointerCapture() { return false; }, className: '', style: {}, setAttribute() {}, appendChild() {}, remove() {}, focus() {}, tabIndex: 0, addEventListener(name, fn) { listeners.set(name, fn); }, removeEventListener(name, fn) { if (listeners.get(name) === fn) listeners.delete(name); }, getBoundingClientRect() { return { x: 0, y: 0, left: 0, top: 0, width: 1180, height: 768 }; }, getContext() { return { clearRect() {}, save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, quadraticCurveTo() {}, closePath() {}, clip() {}, drawImage() {}, stroke() {}, createRadialGradient(){return{addColorStop(){}};}, fillRect() {}, createImageData(w,h) { return { data: new Uint8ClampedArray(w*h*4) }; }, getImageData() { return { data: new Uint8ClampedArray([255, 0, 255, 255, 40, 95, 84, 255, 160, 98, 30, 255]) }; }, putImageData(pixels) { keyedPixels = pixels.data; } }; } }; }
class FakeRenderer { constructor() { this.domElement = surface(); this.shadowMap={}; } setPixelRatio() {} setSize() {} render(s, c) { scene = s; camera = c; } dispose() { disposed = true; } forceContextLoss() {} }
class FakeImage { constructor() { this.naturalWidth = 256; this.naturalHeight = 256; } set src(value) { this.url=value; this.onload?.(); } }
class FakeGLTFLoader {
  parse(source, path, done) {
    const root=new THREE.Group();root.name='exact-skin-'+source.skin;
    const body=new THREE.Mesh(new THREE.BoxGeometry(1,2,1),new THREE.MeshStandardMaterial());body.position.y=1;root.add(body);
    done({scene:root,animations:[]});
  }
}
const fakeFetch=async(url)=>({ok:true,arrayBuffer:async()=>({skin:String(url).slice(6)})});
/* Nur die Namen, die der gebaute Browser-Bundle wirklich auf window.THREE legt.
   Mit dem vollen Three.js besteht ein Test, den der Browser danach mit
   "T.Matrix4 is not a constructor" abbricht. */
const exposed = [...fs.readFileSync('src/vendor/three-entry.js', 'utf8').matchAll(/{([^}]*)}/g)]
  .flatMap((m) => m[1].split(',').map((name) => name.trim().split(/\s+as\s+/).pop())).filter(Boolean)
  .reduce((all, name) => { all[name] = name === 'mergeGeometries' ? mergeGeometries : name === 'GLTFLoader' ? FakeGLTFLoader : name === 'cloneSkinned' ? cloneSkinned : THREE[name]; return all; }, {});
for (const [name, value] of Object.entries(exposed)) assert.notEqual(value, undefined, 'src/vendor/three-entry.js reicht ' + name + ' nicht an den Browser weiter');
const window = { ...surface(), THREE: { ...exposed, WebGLRenderer: FakeRenderer }, devicePixelRatio: 3 };
const document = { ...surface(), hidden: false, createElement: surface };
const SG = { gehstockmon: { daten: D,abenteuer:X }, assets: Object.fromEntries(D.KATALOG.map((k) => [k.bild, 'data:image/webp;base64,AA=='])) };
SG.assets['gm-player-pixel'] = 'data:image/webp;base64,AA==';
SG.modelle=Object.fromEntries(X.SKINS.map((skin)=>[skin.id,{modell:'model:'+skin.id,textur:'texture:'+skin.id}]));
const ctx = vm.createContext({ SG, window, document, Image: FakeImage, fetch:fakeFetch, console, Set, ResizeObserver: class { observe() {} disconnect() {} } });
vm.runInContext(fs.readFileSync('src/games/gehstockmon/2-figuren.js','utf8'),ctx);
vm.runInContext(fs.readFileSync('src/games/gehstockmon/2-landschaft.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync('src/games/gehstockmon/2-revier.js','utf8'),ctx);
vm.runInContext(fs.readFileSync('src/games/gehstockmon/2-umgebung.js','utf8'),ctx);
vm.runInContext(fs.readFileSync('src/games/gehstockmon/2-welt.js', 'utf8'), ctx);
const host = { loop(options) { loop = options; return { start() {}, pause() {}, resume() {}, destroy() { loopDestroyed = true; } }; } };
const world = SG.gehstockmon.createWorld(host, surface(), {});
loop.render(); assert.ok(scene.isScene); assert.ok(camera.isPerspectiveCamera);
assert.equal(SG.gehstockmon.orte.length, 9);
for(const skin of X.SKINS){assert.ok(fs.existsSync('src/assets/gm-modell-'+skin.id+'.glb'),skin.id+' has a 3D model');assert.ok(fs.existsSync('src/assets/gm-modell-'+skin.id+'-textur.webp'),skin.id+' has a model texture');}
for(let i=0;i<9;i++){const ground=scene.getObjectByName('biome-ground-'+i);assert.ok(ground?.receiveShadow);assert.equal(ground.material.map.name,'ground-'+i);}
assert.ok(scene.children.some(l=>l.isDirectionalLight&&l.castShadow),'sun casts real shadows');
const river=scene.getObjectByName('meandering-river');assert.ok(river);assert.ok(river.geometry.attributes.normal.getY(0)>.99,'water faces upward');assert.ok(scene.getObjectByName('ocean'));
const original = scene.children.find((g) => g.type === 'Group' && g.children.some((c) => c.isSprite));
assert.ok(original, 'player uses actual image sprite');
const playerSprite = original.children.find((c) => c.isSprite), playerTexture = playerSprite.material.map;
assert.equal(playerTexture.name, 'gm-player-pixel'); assert.ok(fs.existsSync('src/assets/gm-player-pixel.webp'));
assert.equal(playerTexture.magFilter, THREE.NearestFilter); assert.equal(playerTexture.minFilter, THREE.NearestFilter);
assert.equal(playerTexture.generateMipmaps, false); assert.equal(playerSprite.center.y, 0, 'pixel character anchored at feet');
assert.deepEqual([...keyedPixels], [255, 0, 255, 0, 40, 95, 84, 255, 160, 98, 30, 255], 'background transparent while teal clothing and gold stay opaque');
let sprites = 0, meshes = 0; scene.traverse((o) => { if (o.isSprite) sprites++; if (o.isMesh) meshes++; });
assert.equal(sprites, 5, 'one character and four follower portraits'); assert.ok(meshes < 220, 'terrain, borders and sprites stay batched: ' + meshes);
const cells=SG.gehstockmon.influenceCells();assert.equal(cells.length,9);
const area=(p)=>Math.abs(p.reduce((sum,a,i)=>{const b=p[(i+1)%p.length];return sum+a.x*b.z-b.x*a.z;},0)/2);
assert.ok(cells.reduce((sum,c)=>sum+area(c),0)<area(X.coast())*.45,'most of the compact island remains public grass');
assert.ok(scene.getObjectByName('natural-island'));assert.ok(cells.every(c=>c.length>4),'irregular territory polygons');
for(let i=0;i<9;i++)assert.ok(scene.getObjectByName('biome-fringe-'+i),'biomes blend into the grass');
assert.ok(camera.near>=1,'depth precision for large map');
const territoryStates=D.FELDER.map((f)=>({id:f.id,ownerId:f.id===1?'player':null,level:1}));
world.setTerritories(territoryStates,'player');
let beforeUpgrade=0;scene.traverse((m)=>{if(m.isMesh)beforeUpgrade+=m.geometry.attributes.position.count;});
territoryStates[0].level=3;world.setTerritories(territoryStates,'player');
let afterUpgrade=0;scene.traverse((m)=>{if(m.isMesh)afterUpgrade+=m.geometry.attributes.position.count;});assert.ok(afterUpgrade>beforeUpgrade,'upgrade adds walls and towers');
world.setTerritories(territoryStates,'player');let repeatedUpgrade=0;scene.traverse((m)=>{if(m.isMesh)repeatedUpgrade+=m.geometry.attributes.position.count;});assert.equal(repeatedUpgrade,afterUpgrade,'refresh does not duplicate upgrade geometry');
for (let i = 0; i < 120; i++) loop.update(1 / 60);
const idleFollowers = scene.children.filter((g) => g !== original && g.type === 'Group' && g.children.some((c) => c.isSprite));
assert.ok(idleFollowers.every((g, i) => idleFollowers.every((other, j) => i === j || g.position.distanceTo(other.position) > 1.5)), 'idle portraits stay separated');
const before = original.position.clone(); world.move(1, 0); for (let i = 0; i < 120; i++) loop.update(1 / 60); world.move(0, 0); loop.render();
assert.ok(original.position.distanceTo(before) > 12, 'joystick moves player through real world');
assert.equal(playerTexture.repeat.x, -1, 'character faces right while moving right');
world.move(-1, 0); for (let i = 0; i < 12; i++) loop.update(1 / 60); world.move(0, 0);
assert.equal(playerTexture.repeat.x, 1, 'character faces left while moving left');
const followers = scene.children.filter((g) => g !== original && g.type === 'Group' && g.children.some((c) => c.isSprite));
assert.ok(followers.every((g) => g.position.distanceTo(original.position) < 30), 'image companions follow the character');
world.overview(); world.walkTo(5);
for (let i = 0; i < 5000; i++) {
  loop.update(1 / 60); loop.render();
  if (i > 120) { const p = world.project(original.position); assert.ok(p.visible && p.x > 118 && p.x < 1062 && p.y > 76 && p.y < 691, 'camera keeps walking player in view'); }
}
assert.ok(world.distanceTo(5) < 10, 'far biome is reachable');
world.walkTo(1); for (let i = 0; i < 20; i++) loop.update(1 / 60);
world.blockInput(true); const stoppedAt = original.position.clone(); world.move(1, 1);
for (let i = 0; i < 120; i++) loop.update(1 / 60);
assert.ok(original.position.distanceTo(stoppedAt) < 0.01, 'opening a menu stops automatic walking and ignores movement');
world.blockInput(false); for (let i = 0; i < 120; i++) loop.update(1 / 60);
assert.ok(original.position.distanceTo(stoppedAt) < 0.01, 'closing a menu does not resume stale input');
const roster = [D.mon('weltenfresser'), D.mon('waerter'), D.mon('bollwerk'), D.mon('spaeher')]; world.setSquad(roster); loop.render();
// Owner gates open; adjacent territories merge and changed ownership ejects the visitor.
world.rotate(-.63);var layout=X.layout(territoryStates),g=layout.find(g=>g.fields.includes(1)),entry=world.entrance(1);world.setPosition(entry);
for(let i=0;i<120;i++)loop.update(1/60);const gate=scene.getObjectByName('territory-gate-'+g.id);assert.ok(gate.position.y>8,'owner gate lifts');
world.walkToPoint({x:g.gate.x-g.gate.nx*4,z:g.gate.z-g.gate.nz*4});for(let i=0;i<120;i++)loop.update(1/60);assert.ok(X.inside(world.position(),g),'owner enters through gate');
territoryStates[0].ownerId='other';world.setTerritories(territoryStates,'player');assert.ok(!X.inside(world.position(),g),'ownership change moves visitor outside');
const adjacent=territoryStates.find(t=>t.id!==1&&X.layout(territoryStates.map(v=>({...v,ownerId:v.id===1||v.id===t.id?'shared':null}))).length===8);assert.ok(adjacent);territoryStates[0].ownerId=adjacent.ownerId='player';world.setTerritories(territoryStates,'player');assert.equal(scene.getObjectByName('territory-walls').children.filter(m=>m.name.startsWith('territory-gate-')).length,8,'neighbors have one shared gate and perimeter');
// Remote players load the exact equipped 3D model, including different and cached skins.
world.setPeers([{id:'friend',name:'Friend',squad:['moosling','nullwyrm'],skin:'knochenkoenig',x:10,z:10,heading:1,updatedAt:10000,activity:'map'},{id:'scout',name:'Scout',squad:[],skin:'wanderer',x:12,z:10,heading:0,updatedAt:10000,activity:'map'}],10000);
await new Promise(setImmediate);
const peer=scene.getObjectByName('peer-friend'),scout=scene.getObjectByName('peer-scout'),peerModel=peer.getObjectByName('exact-skin-knochenkoenig'),scoutModel=scout.getObjectByName('exact-skin-wanderer');assert.ok(peerModel);assert.ok(scoutModel);assert.equal(peerModel.children[0].material.map.image.url,'texture:knochenkoenig');assert.equal(scoutModel.children[0].material.map.image.url,'texture:wanderer');assert.equal(peer.userData.portrait.visible,false);assert.equal(scout.userData.portrait.visible,false);
assert.ok(scene.getObjectByName('peer-mon-friend-nullwyrm'));assert.ok(scene.getObjectByName('peer-mon-friend-moosling'));const small=scene.getObjectByName('peer-mon-friend-moosling').userData.portrait.scale.y,large=scene.getObjectByName('peer-mon-friend-nullwyrm').userData.portrait.scale.y;assert.ok(large>small*4,'remote followers use species sizes');const peerTexture=peer.userData.portrait.material.map;assert.notEqual(peerTexture,playerTexture);
world.setPeers([{id:'friend',name:'Friend',squad:['moosling','nullwyrm'],skin:'drachenritter',x:20,z:10,heading:-1,updatedAt:12000,activity:'map'},{id:'cached',name:'Cached',squad:[],skin:'knochenkoenig',x:22,z:10,heading:0,updatedAt:12000,activity:'map'}],12000);
await new Promise(setImmediate);const dragonModel=peer.getObjectByName('exact-skin-drachenritter');assert.ok(dragonModel,'skin changes use the matching full model');assert.equal(dragonModel.children[0].material.map.image.url,'texture:drachenritter');assert.equal(peer.getObjectByName('exact-skin-knochenkoenig'),undefined);assert.ok(scene.getObjectByName('peer-cached').getObjectByName('exact-skin-knochenkoenig'),'cached skins attach to newly seen players');
for(let i=0;i<60;i++)loop.update(1/60);assert.ok(peer.position.x>10&&peer.position.x<20,'remote movement is interpolated');
let releasedPeer=false;peerTexture.addEventListener('dispose',()=>releasedPeer=true);world.setPeers([],13000);assert.ok(releasedPeer);assert.equal(scene.getObjectByName('peer-friend'),undefined);assert.equal(scene.getObjectByName('peer-cached'),undefined);assert.equal(scene.getObjectByName('peer-mon-friend-nullwyrm'),undefined);
world.setPeers([{id:'stale',name:'Gone',x:1,z:1,heading:0,updatedAt:14000}],14000);for(let i=0;i<960;i++)loop.update(1/60);assert.equal(scene.getObjectByName('peer-stale'),undefined,'departed player expires');
const currentTrainer=X.encounters(10000,territoryStates).find(e=>e.kind==='trainer');world.setEncounters([currentTrainer],10000);const trainer=scene.getObjectByName('trainer-'+currentTrainer.id);assert.ok(trainer);loop.update(.1);const trainerStart=trainer.position.clone();for(let i=0;i<300;i++)loop.update(1/60);assert.ok(trainer.position.distanceTo(trainerStart)>1,'trainer actually walks through the 3D scene');assert.ok(trainer.userData.portrait.scale.y>playerSprite.scale.y);world.setEncounters([],16000);assert.equal(scene.getObjectByName('trainer-'+currentTrainer.id),undefined);
world.setPosition({x:X.riverCenter(60)-9,z:60});world.move(1,0);for(let i=0;i<180;i++)loop.update(1/60);world.move(0,0);assert.ok(world.position().x<X.riverCenter(60)-5.25,'joystick stops at the riverbank');
const result = fight(D.KREATUREN, D.START_PLAN, D.FELDER[0].feinde); world.startBattle(result, 1, D.KATALOG.slice(0, 4));
for (const step of result.schritte) { world.step(step); for (let i = 0; i < 40; i++) loop.update(1 / 60); loop.render(); }
world.endBattle();
function settledZoom(){for(let i=0;i<240;i++)loop.update(1/60);loop.render();return camera.position.y/.86;}
world.overview();assert.ok(Math.abs(settledZoom()-760)<.001,'overview respects zoom limit');
world.zoom(1e6);assert.ok(Math.abs(settledZoom()-760)<.001,'buttons cannot exceed zoom limit');
listeners.get('wheel')({preventDefault(){},deltaY:1e8});assert.ok(Math.abs(settledZoom()-760)<.001,'mouse wheel cannot exceed zoom limit');
listeners.get('pointerdown')({pointerId:1,clientX:100,clientY:100});
listeners.get('pointerdown')({pointerId:2,clientX:500,clientY:100});
listeners.get('pointermove')({pointerId:2,clientX:101,clientY:100});
assert.ok(Math.abs(settledZoom()-760)<.001,'pinch cannot exceed zoom limit');
listeners.get('pointerup')({pointerId:1});listeners.get('pointerup')({pointerId:2});
world.zoom(-1e6);assert.ok(Math.abs(settledZoom()-20)<.001,'close zoom stays available');
const surroundings=['coastal-shallows','offshore-rocks-0','offshore-rocks-1','offshore-rocks-2','shore-breakers','ocean-swells'].map(name=>{const m=scene.getObjectByName(name);assert.ok(m,name);return m;});
const swell=surroundings.at(-1),wavePosition=swell.position.clone();loop.update(1);assert.ok(swell.position.distanceTo(wavePosition)>.001,'ocean waves move');
let releasedScenery=0;surroundings.forEach(m=>{m.geometry.addEventListener('dispose',()=>releasedScenery++);m.material.addEventListener('dispose',()=>releasedScenery++);});

const textures = new Set(), spriteMaterials = new Set(), releasedTextures = new Set(), releasedMaterials = new Set();
scene.traverse((o) => { if (o.isSprite) { textures.add(o.material.map); spriteMaterials.add(o.material); } });
textures.forEach((t) => t.addEventListener('dispose', () => releasedTextures.add(t)));
spriteMaterials.forEach((m) => m.addEventListener('dispose', () => releasedMaterials.add(m)));
world.destroy(); assert.equal(releasedScenery,12);assert.ok(surroundings.every(m=>!m.parent)); assert.ok(disposed); assert.ok(loopDestroyed); assert.equal(listeners.size, 0);
assert.equal(releasedTextures.size, textures.size, 'portrait textures released when leaving game');
assert.equal(releasedMaterials.size, spriteMaterials.size, 'portrait materials released when leaving game');
console.log('3D scene, merged terrain, image followers, joystick movement, outer territory, battle animation and disposal verified.');
