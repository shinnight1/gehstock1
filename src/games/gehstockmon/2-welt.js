/* GehstockMon: echte 3D-Welt und Wiedergabe der gemeinsamen Kampfmaschine. */
(function (SG) {
  var R = SG.gehstockmon;
  R.orte = [
    { x: -14, z: 12, farbe: '#547d4b', dach: '#a24e34', biom: 'Mooswacht', terrain: 'Wiesenland' },
    { x: 12, z: 13, farbe: '#3e7772', dach: '#497f92', biom: 'Flüsterfluss', terrain: 'Flussufer' },
    { x: 20, z: -9, farbe: '#796452', dach: '#a95037', biom: 'Aschenklippen', terrain: 'Felsland' },
    { x: -4, z: -17, farbe: '#586584', dach: '#65518c', biom: 'Geisterwald', terrain: 'Nebelwald' },
    { x: -25, z: -7, farbe: '#7a6652', dach: '#b98841', biom: 'Der schwarze Horst', terrain: 'Hochland' }
  ];

  for (var region = 0; region < 20; region++) {
    var angle = (region % 10) * Math.PI / 5 + (region >= 10 ? 0.24 : 0), radius = region >= 10 ? 103 : 66;
    var source = R.orte[region % 5];
    R.orte.push({ x: Math.cos(angle) * radius, z: Math.sin(angle) * radius * 0.9, farbe: source.farbe, dach: source.dach, biom: SG.gehstockmon.daten.FELDER[region + 5].name, terrain: source.terrain });
  }

  R.createWorld = function (host, container, handlers) {
    var T = window.THREE;
    if (!T) throw new Error('Die 3D-Engine konnte nicht geladen werden.');
    var renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    var canvas = renderer.domElement;
    canvas.className = 'gm-world-canvas';
    canvas.setAttribute('aria-label', '3D-Welt: ziehen zum Erkunden, tippen zum Laufen, zwei Finger zum Zoomen.');
    canvas.tabIndex = 0;
    container.appendChild(canvas);
    var scene = new T.Scene();
    scene.background = new T.Color('#172d3a');
    scene.fog = new T.FogExp2('#243a43', 0.0018);
    var camera = new T.PerspectiveCamera(39, 1, 1, 650);
    var focus = new T.Vector3(-8, 0, 6), desiredFocus = focus.clone();
    var yaw = 0.63, zoom = 38, desiredZoom = 38;
    var ambient = new T.HemisphereLight('#c0e7ed', '#31312b', 2.3);
    scene.add(ambient);
    var sun = new T.DirectionalLight('#ffe1aa', 3.3);
    sun.position.set(-30, 55, 25); scene.add(sun);
    var rim = new T.DirectionalLight('#90b8ff', 1.6);
    rim.position.set(25, 20, -35); scene.add(rim);
    var fixed = new T.Group(); scene.add(fixed);
    var materials = {}, geometries = {}, spriteTextures = {}, spriteMaterials = [], units = [], flags = [], effects = [], battle = false;
    var groundTextures = [], terrainMaterials = [], upgrades = new T.Group(), upgradeKey = ''; scene.add(upgrades);
    for (var terrainKind = 0; terrainKind < 5; terrainKind++) {
      var terrainTexture = R.groundTexture(T, terrainKind); groundTextures.push(terrainTexture);
      terrainMaterials.push(new T.MeshStandardMaterial({ map: terrainTexture, roughness: 1, metalness: 0, color: '#e2e4d2' }));
    }
    var time = 0, width = 1, height = 1, dead = false, contextLost = false;
    var selected = 1, held = [], active = null, following = true, inputBlocked = false;
    function mat(color, glow) {
      var key = color + ':' + (glow || '');
      if (!materials[key]) materials[key] = new T.MeshStandardMaterial({ color: color, roughness: 0.82, metalness: glow ? 0.4 : 0.08, emissive: glow || '#000000', emissiveIntensity: glow ? 0.8 : 0 });
      return materials[key];
    }
    function geo(kind) {
      if (!geometries[kind]) geometries[kind] = kind === 'box' ? new T.BoxGeometry(1, 1, 1) : kind === 'sphere' ? new T.SphereGeometry(0.5, 10, 7) : kind === 'cone' ? new T.ConeGeometry(0.5, 1, 7) : kind === 'rock' ? new T.IcosahedronGeometry(0.5, 0) : kind === 'ring' ? new T.TorusGeometry(0.5, 0.045, 5, 26) : new T.CylinderGeometry(0.5, 0.5, 1, kind === 'land' ? 96 : 10);
      return geometries[kind];
    }
    function mesh(parent, kind, color, x, y, z, sx, sy, sz, glow) {
      var m = new T.Mesh(geo(kind), mat(color, glow));
      m.position.set(x, y, z); m.scale.set(sx, sy, sz); parent.add(m); return m;
    }
    function tree(x, z, size, spectral) {
      var g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = x * 0.9; fixed.add(g);
      mesh(g, 'cylinder', '#514536', 0, size * 0.45, 0, size * 0.23, size * 0.9, size * 0.23);
      for (var j = 0; j < 3; j++) mesh(g, 'cone', spectral ? ['#3a405f', '#4d5379', '#626b85'][j] : ['#224936', '#326449', '#4b8050'][j], 0, size * (0.85 + j * 0.3), 0, size * (1.05 - j * 0.22), size * 0.85, size * (1.05 - j * 0.22));
    }
    function building(x, z, level, color) {
      var g = new T.Group(); g.position.set(x, 0.1, z); fixed.add(g);
      mesh(g, 'box', '#6d6f63', 0, 0.3, 0, 4.4, 0.6, 4);
      mesh(g, 'box', '#c0b292', 0, 1.5, 0, 3.6, 2.6, 3.2);
      var roof = mesh(g, 'cone', color, 0, 3.8, 0, 6, 2.2, 5.5); roof.rotation.y = Math.PI / 4;
      mesh(g, 'box', '#342f29', 0, 0.9, 1.63, 0.8, 1.7, 0.1);
      mesh(g, 'box', '#ffcb73', -1, 1.8, 1.64, 0.55, 0.7, 0.08, '#d47d22');
      mesh(g, 'box', '#ffcb73', 1, 1.8, 1.64, 0.55, 0.7, 0.08, '#d47d22');
      if (level > 1) {
        mesh(g, 'cylinder', '#8e8c7a', -2, 2.3, -1.6, 1.7, 4.5, 1.7);
        mesh(g, 'cone', color, -2, 5, -1.6, 2.4, 1.7, 2.4);
      }
      if (level > 3) {
        mesh(g, 'cylinder', '#8e8c7a', 2, 3, -1.6, 1.8, 6, 1.8);
        mesh(g, 'cone', '#dcb463', 2, 6.7, -1.6, 2.6, 1.9, 2.6);
      }
      return g;
    }
    function pathBetween(a, b) {
      var dx = b.x - a.x, dz = b.z - a.z, len = Math.sqrt(dx * dx + dz * dz);
      var m = mesh(fixed, 'box', '#a8976e', (a.x + b.x) / 2, 0.23, (a.z + b.z) / 2, 2.3, 0.12, len);
      m.rotation.y = Math.atan2(dx, dz);
    }
    mesh(fixed, 'land', '#233e47', 0, -3.5, 0, 280, 1, 265);
    mesh(fixed, 'land', '#3c4844', 0, -2.35, 0, 255, 4, 240);
    var land = mesh(fixed, 'land', '#3d6348', 0, -0.55, 0, 253, 1.1, 238);
    land.geometry = land.geometry.clone(); var uv = land.geometry.getAttribute('uv');
    for (var ui = 0; ui < uv.count; ui++) uv.setXY(ui, uv.getX(ui) * 42, uv.getY(ui) * 42);
    land.material = terrainMaterials[0];
    var water = mesh(fixed, 'box', '#3f8895', 6, 0.035, 8, 3.4, 0.16, 210); water.rotation.y = -0.22;
    for (var p = 0; p < R.orte.length; p++) {
      var start = p < 5 ? 0 : p < 15 ? 5 : 15, count = p < 5 ? 5 : 10;
      pathBetween(R.orte[p], R.orte[start + (p - start + 1) % count]);
      if (p >= 15 && p % 2 === 0) pathBetween(R.orte[p], R.orte[p - 10]);
      if (p >= 5 && p < 15 && p % 2 === 0) pathBetween(R.orte[p], R.orte[p % 5]);
    }
    pathBetween({ x: 0, z: 0 }, R.orte[0]);
    for (var i = 0; i < R.orte.length; i++) {
      var o = R.orte[i];
      var clearing = mesh(fixed, 'land', o.farbe, o.x, 0.05, o.z, 18, 0.22, 17);
      clearing.geometry = clearing.geometry.clone(); var clearingUv = clearing.geometry.getAttribute('uv');
      for (var cu = 0; cu < clearingUv.count; cu++) clearingUv.setXY(cu, clearingUv.getX(cu) * 4, clearingUv.getY(cu) * 4);
      clearing.material = terrainMaterials[i % 5];
      building(o.x, o.z - 2.8, 1, o.dach);
      for (var k = -3; k <= 3; k++) {
        if (Math.abs(k) < 2) continue;
        mesh(fixed, 'box', '#838779', o.x + k * 1.65, 0.8, o.z + 3.4, 1.4, 1.5, 0.85);
        mesh(fixed, 'box', '#a1a190', o.x + k * 1.65, 1.65, o.z + 3.4, 1.55, 0.35, 1);
      }
      for (var j = 0; j < 7; j++) {
        var angle = j * 0.88 + i;
        tree(o.x + Math.cos(angle) * 8, o.z + Math.sin(angle) * 7.8, 2.2 + (j % 3) * 0.5, i % 5 === 3);
      }
      mesh(fixed, 'cylinder', '#554638', o.x + 3.9, 3, o.z, 0.17, 6, 0.17);
      var flag = mesh(scene, 'box', '#c35644', o.x + 4.6, 5.2, o.z, 1.45, 0.95, 0.1);
      flags.push(flag);
      if (i % 5 === 2 || i % 5 === 4) for (var c = 0; c < 5; c++) {
        var crystal = mesh(fixed, 'cone', i % 5 === 4 ? '#e6bd60' : '#ea7652', o.x - 5 + c, 1.1, o.z - 5.5 + (c % 2), 1.1, 2.3 + (c % 2), 1, i % 5 === 4 ? '#bf8a2f' : '#a8341c');
        crystal.rotation.z = (c - 2) * 0.12;
      }
    }
    for (var n = 0; n < 170; n++) {
      var a = n * 2.399, r = n < 95 ? 116 + (n % 4) * 1.4 : 35 + (n % 60) * 1.15;
      tree(Math.cos(a) * r, Math.sin(a) * r * 0.88, 2 + (n % 3) * 0.7, n % 9 === 0);
      mesh(fixed, 'rock', '#768479', Math.cos(a) * (r + 3), 0.8, Math.sin(a) * (r + 3) * 0.88, 2 + n % 3, 2, 2);
    }
    building(0, 0, 2, '#366d79');
    var altar = mesh(fixed, 'ring', '#e4bd69', 0, 0.15, 6, 4, 4, 4, '#766132'); altar.rotation.x = Math.PI / 2;

    /* Clumps, flower patches, ruins and shoreline reeds add depth to the ground. */
    for (var tuft = 0; tuft < 1400; tuft++) {
      var tx = Math.sin(tuft * 83.17) * 117, tz = Math.cos(tuft * 47.31) * 108;
      if (Math.hypot(tx / 123, tz / 115) > .97 || R.orte.some(function (o) { return Math.hypot(o.x-tx,o.z-tz)<7; })) continue;
      var grass = mesh(fixed, 'cone', ['#537343','#71884c','#3f673c'][tuft%3], tx, .24, tz, .20, .48 + tuft%3*.09, .12); grass.rotation.z = .22;
      if (tuft % 13 === 0) mesh(fixed, 'sphere', tuft%2 ? '#d3b269' : '#bccba1', tx, .35, tz, .25, .18, .25);
    }
    R.orte.forEach(function (o, i) {
      if(i%5===2){for(var r=0;r<4;r++){mesh(fixed,'rock','#81776b',o.x+11+r*.7,.8+r*.3,o.z-7-r,2.8,2+r,2.4);mesh(fixed,'cylinder','#a1987e',o.x-11+r*1.7,1.2,o.z-5,1,2.4+(r%2),1);}}
      if(i%5===1){mesh(fixed,'land','#438b95',o.x-10,.12,o.z-8,7,.1,4);for(var reed=0;reed<8;reed++)mesh(fixed,'cone','#899860',o.x-13+reed*.8,.65,o.z-6,.2,1.3,.2);}
      if(i%5===4){for(var snow=0;snow<4;snow++)mesh(fixed,'rock','#c2d0cb',o.x+8+snow,1,o.z+5-snow,2.6,2,2.2);}
    });
    /* Statische Welt nach Material zusammenfassen: wenige Drawcalls auf dem iPad. */
    fixed.updateMatrixWorld(true);
    var batches = {}, old = [];
    fixed.traverse(function (m) {
      if (!m.isMesh) return;
      var id = m.material.uuid;
      if (!batches[id]) batches[id] = { material: m.material, list: [] };
      var g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); g.applyMatrix4(m.matrixWorld); batches[id].list.push(g); old.push(m);
    });
    old.forEach(function (m) { m.parent.remove(m); if (Object.keys(geometries).every(function (key) { return geometries[key] !== m.geometry; })) m.geometry.dispose(); });
    Object.keys(batches).forEach(function (id) {
      var b = batches[id], merged = T.mergeGeometries(b.list, false);
      if (merged) { var m = new T.Mesh(merged, b.material); fixed.add(m); }
      b.list.forEach(function (g) { g.dispose(); });
    });
    var influence = R.createInfluence(T, scene);
    function setTerritories(territories, playerId) {
      influence.set(territories, playerId);
      var key=territories.map(function(t){return t.level;}).join(',');if(key===upgradeKey)return;upgradeKey=key;
      upgrades.children.slice().forEach(function(m){upgrades.remove(m);m.geometry.dispose();});
      territories.forEach(function(t,i){var o=R.orte[i];if(t.level<2)return;
        mesh(upgrades,'box','#77847b',o.x-5,1.4,o.z,1,2.8,6);mesh(upgrades,'box','#77847b',o.x+5,1.4,o.z,1,2.8,6);
        mesh(upgrades,'cylinder','#a0a594',o.x-4,2.5,o.z-5,2.4,5,2.4);mesh(upgrades,'cone',o.dach,o.x-4,5.4,o.z-5,3.2,1.6,3.2);
        if(t.level===3){mesh(upgrades,'cylinder','#9b9c8b',o.x+4,3.2,o.z-5,2.8,6.4,2.8);mesh(upgrades,'cone','#d4b464',o.x+4,7,o.z-5,3.6,2,3.6);
          for(var crenel=0;crenel<5;crenel++){mesh(upgrades,'box','#bcc1a5',o.x-5,3.1,o.z-2+crenel,1.3,.7,.6);mesh(upgrades,'box','#bcc1a5',o.x+5,3.1,o.z-2+crenel,1.3,.7,.6);}
          mesh(upgrades,'box','#dfbd69',o.x,3.6,o.z-4.5,4,.7,.9,'#79613b');}
      });
      upgrades.updateMatrixWorld(true);var groups={};upgrades.children.slice().forEach(function(m){var id=m.material.uuid;if(!groups[id])groups[id]={material:m.material,list:[]};var g=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();g.applyMatrix4(m.matrixWorld);groups[id].list.push(g);upgrades.remove(m);});
      Object.keys(groups).forEach(function(id){var b=groups[id],g=T.mergeGeometries(b.list,false);if(g)upgrades.add(new T.Mesh(g,b.material));b.list.forEach(function(p){p.dispose();});});
    }

    /* Original generated portraits are the actual walking/battle sprites. */
    function spriteTexture(key, color) {
      var cacheKey = key + color;
      if (spriteTextures[cacheKey]) return spriteTextures[cacheKey];
      var surface = document.createElement('canvas'); surface.width = 256; surface.height = 256;
      var ctx = surface.getContext('2d'), texture = new T.CanvasTexture(surface);
      texture.colorSpace = T.SRGBColorSpace; spriteTextures[cacheKey] = texture;
      var pixelPlayer = key === 'gm-player-pixel';
      if (pixelPlayer) {
        texture.minFilter = T.NearestFilter; texture.magFilter = T.NearestFilter; texture.generateMipmaps = false;
        texture.name = key; ctx.imageSmoothingEnabled = false;
      }
      var img = new Image();
      img.onload = function () {
        if (dead) return;
        if (pixelPlayer) {
          ctx.clearRect(0, 0, 256, 256);
          var scale = Math.min(256 / img.naturalWidth, 256 / img.naturalHeight), w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
          ctx.drawImage(img, Math.round((256 - w) / 2), 256 - h, w, h);
          /* The pixel asset uses magenta as a colour key, including interior gaps. */
          var pixels = ctx.getImageData(0, 0, 256, 256), rgba = pixels.data;
          for (var i = 0; i < rgba.length; i += 4) if (rgba[i] - rgba[i + 1] > 35 && rgba[i + 2] - rgba[i + 1] > 35) rgba[i + 3] = 0;
          ctx.putImageData(pixels, 0, 0); texture.needsUpdate = true; return;
        }
        ctx.clearRect(0, 0, 256, 256); ctx.save(); ctx.beginPath();
        ctx.moveTo(22, 5); ctx.lineTo(234, 5); ctx.quadraticCurveTo(251, 5, 251, 22);
        ctx.lineTo(251, 234); ctx.quadraticCurveTo(251, 251, 234, 251); ctx.lineTo(22, 251);
        ctx.quadraticCurveTo(5, 251, 5, 234); ctx.lineTo(5, 22); ctx.quadraticCurveTo(5, 5, 22, 5);
        ctx.closePath(); ctx.clip(); ctx.drawImage(img, 0, 0, 256, 256); ctx.restore();
        ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.stroke(); texture.needsUpdate = true;
      };
      img.src = SG.assets[key] || SG.assets['gm-bollwerk'];
      return texture;
    }
    function creature(role, rarity, enemy, monId) {
      var g = new T.Group(), k = SG.gehstockmon.daten.mon(monId);
      var color = enemy ? '#f38976' : SG.gehstockmon.daten.SELTENHEITEN[rarity].farbe;
      var key = monId === 'player' ? 'gm-player-pixel' : k ? k.bild : SG.gehstockmon.daten.KREATUREN[role].bild;
      var material = new T.SpriteMaterial({ map: spriteTexture(key, color), transparent: true, depthWrite: false, toneMapped: false });
      spriteMaterials.push(material);
      var portrait = new T.Sprite(material), size = monId === 'player' ? 3.4 : 2.1 + rarity * 0.17;
      portrait.scale.set(size, size, 1); portrait.position.y = size * 0.52; g.add(portrait);
      if (monId === 'player') { portrait.center.set(0.5, 0); portrait.position.y = 0; }
      var ring = mesh(g, 'ring', color, 0, 0.09, 0, 1.3, 1.3, 1.3); ring.rotation.x = Math.PI / 2;
      mesh(g, 'cylinder', '#283f37', 0, 0.04, 0, 1.45, 0.045, 0.9);
      g.userData = { portrait: portrait, ring: ring, rarity: rarity }; return g;
    }
    function addUnit(id, role, rarity, x, z, enemy, hp, monId) {
      var g = creature(role, rarity, enemy, monId); scene.add(g); g.position.set(x, 0.15, z);
      var bg = mesh(g, 'box', '#26373c', 0, 3.4, 0, 1.8, 0.15, 0.12);
      var bar = mesh(g, 'box', enemy ? '#f7836d' : '#81d2a3', 0, 3.4, 0.075, 1.72, 0.105, 0.03);
      bg.visible = /^(wir|sie)/.test(id); bar.visible = bg.visible;
      var u = { id: id, monId: monId, group: g, bar: bar, maxHp: hp || 100, hp: hp || 100, home: new T.Vector3(x, 0.15, z), pulse: 0, attack: null, enemy: enemy };
      units.push(u); return u;
    }
    var explorer = addUnit('explorer', 0, 0, -10, 17, false, 100, 'player');
    var stick = { x: 0, y: 0 }, destination = explorer.home.clone(), trail = [];
    for (var behind = 35; behind >= 0; behind--) trail.push(new T.Vector3(explorer.home.x - behind * 0.4, 0.15, explorer.home.z));
    var squadKey = '';
    function setSquad(roster) {
      var key = roster.map(function (k) { return k.id; }).join(','); if (key === squadKey) return; squadKey = key;
      units = units.filter(function (u) { if (u.id.indexOf('camp') === 0) { disposeUnit(u); return false; } return true; });
      roster.forEach(function (k, i) {
        addUnit('camp' + i, k.typ, k.seltenheit, explorer.group.position.x - (i + 1) * 1.8, explorer.group.position.z + 1.5, false, k.hp, k.id);
      });
    }
    setSquad(SG.gehstockmon.daten.KATALOG.slice(0, 4));
    var selectionRing = mesh(scene, 'ring', '#ffd281', -14, 0.38, 12, 18.6, 18.6, 0.4, '#79613b'); selectionRing.rotation.x = Math.PI / 2;
    var ray = new T.Raycaster(), pointer = new T.Vector2();
    var plane = new T.Mesh(new T.PlaneGeometry(300, 300), new T.MeshBasicMaterial({ visible: false }));
    plane.rotation.x = -Math.PI / 2; scene.add(plane); plane.updateMatrixWorld();
    function groundAt(x, y) {
      var rect = canvas.getBoundingClientRect();
      pointer.set((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1);
      ray.setFromCamera(pointer, camera);
      var hit = ray.intersectObject(plane); return hit.length ? hit[0].point : null;
    }
    function disposeUnit(u) {
      u.group.traverse(function (part) { if (part.isSprite) { part.material.dispose(); spriteMaterials = spriteMaterials.filter(function (m) { return m !== part.material; }); } });
      scene.remove(u.group);
    }
    function setHeld(ids) {
      held = ids.slice();
      flags.forEach(function (f, i) { f.material = mat(held.indexOf(i + 1) >= 0 ? '#5baea1' : '#c35644'); });
    }
    function select(id, center) {
      selected = id; var o = R.orte[id - 1];
      selectionRing.position.set(o.x, 0.38, o.z);
      if (center) { following = false; desiredFocus.set(o.x, 0, o.z + 3); desiredZoom = 35; }
    }
    function overview() { following = false; desiredFocus.set(0, 0, 0); desiredZoom = 225; }
    function follow() {
      following = true; desiredZoom = 38; desiredFocus.set(explorer.group.position.x, 0, explorer.group.position.z - 2);
      if (handlers.explore) handlers.explore();
    }
    function startBattle(result, fieldId, roster) {
      endBattle(); clearInput(); battle = true;
      var o = R.orte[fieldId - 1]; active = result;
      units.forEach(function (u) { u.group.visible = false; });
      result.einheiten.forEach(function (e) {
        var index = Number(e.uid.slice(3)), enemy = e.seite === 'sie';
        var entry = !enemy && roster ? roster[index] : null;
        var role = entry ? entry.typ : ({ spott: 0, hinrichten: 1, flicken: 2, stoeren: 3 }[e.faeh]);
        var rarity = entry ? entry.seltenheit : Math.min(3, Math.floor((fieldId - 1) / 1.5));
        addUnit(e.uid, role, rarity, o.x - 4.5 + index * 3.0, o.z + (enemy ? 0.7 : 7), enemy, e.maxHp, entry ? entry.id : e.monId || ({ spott: 'bollwerk', hinrichten: 'klinge', flicken: 'waerter', stoeren: 'spaeher' }[e.faeh]));
      });
      desiredFocus.set(o.x, 0, o.z + 3.4); desiredZoom = 28;
    }
    function endBattle() {
      units = units.filter(function (u) { if (/^(wir|sie)/.test(u.id)) { disposeUnit(u); return false; } u.group.visible = true; return true; });
      battle = false; active = null;
      effects.forEach(function (fx) { scene.remove(fx.m); }); effects = [];
    }
    function step(s) {
      var attacker = units.find(function (u) { return u.id === s.actor; });
      var target = null;
      s.zustand.forEach(function (z) {
        var unit = units.find(function (u) { return u.id === z.uid; });
        if (!unit) return;
        var delta = z.hp - unit.hp;
        if (delta !== 0) {
          target = unit; unit.pulse = 0.65;
          if (handlers.damage) handlers.damage(unit.home, delta);
          burst(unit.home, delta > 0 ? '#81efbd' : '#ffad69');
        }
        unit.hp = z.hp; unit.bar.scale.x = Math.max(0.001, 1.72 * z.hp / unit.maxHp);
      });
      if (attacker && attacker.hp > 0) {
        attacker.attack = { time: 0, to: target && target !== attacker ? target.home.clone() : attacker.home.clone(), heal: target && target.hp > 0 && s.text.indexOf('flickt') >= 0 };
        if (!target) burst(attacker.home, '#cba1ff');
      }
    }
    function burst(at, color) {
      for (var i = 0; i < 7; i++) {
        var m = mesh(scene, 'rock', color, at.x, 1.3, at.z, 0.17, 0.17, 0.17, color);
        effects.push({ m: m, life: 0.6, vx: Math.cos(i * 0.9) * 2, vz: Math.sin(i * 0.9) * 2, vy: 2.5 + i % 3 });
      }
    }
    var pointers = {}, dragged = false, pinch = 0, prev = null, keys = {}, off = [];
    function on(el, event, fn, opts) { el.addEventListener(event, fn, opts); off.push(function () { el.removeEventListener(event, fn, opts); }); }
    function clearInput() { pointers = {}; keys = {}; pinch = 0; prev = null; dragged = true; stick.x = 0; stick.y = 0; explorer.group.position.y = 0.15; destination.copy(explorer.group.position); }
    function distance() { var pts = Object.keys(pointers).map(function (k) { return pointers[k]; }); return pts.length < 2 ? 0 : Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y); }
    on(canvas, 'pointerdown', function (e) {
      if (contextLost || inputBlocked) return;
      canvas.focus({ preventScroll: true }); pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId); prev = { x: e.clientX, y: e.clientY };
      if (Object.keys(pointers).length === 1) dragged = false; else { dragged = true; pinch = distance(); }
    });
    on(canvas, 'pointermove', function (e) {
      if (!pointers[e.pointerId]) return;
      var last = pointers[e.pointerId]; pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (Object.keys(pointers).length > 1) { var d = distance(); if (pinch > 0 && d > 0) desiredZoom = T.MathUtils.clamp(desiredZoom * pinch / d, 20, 245); pinch = d; dragged = true; return; }
      var dx = e.clientX - last.x, dy = e.clientY - last.y;
      if (prev && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) > 7) dragged = true;
      if (dragged) {
        following = false;
        var f = zoom / Math.max(400, height);
        desiredFocus.x -= (Math.cos(yaw) * dx + Math.sin(yaw) * dy) * f;
        desiredFocus.z -= (-Math.sin(yaw) * dx + Math.cos(yaw) * dy) * f;
        desiredFocus.x = T.MathUtils.clamp(desiredFocus.x, -125, 125); desiredFocus.z = T.MathUtils.clamp(desiredFocus.z, -115, 115);
      }
    });
    on(canvas, 'pointerup', function (e) {
      var tap = !dragged && Object.keys(pointers).length === 1;
      delete pointers[e.pointerId]; if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      if (!Object.keys(pointers).length) { pinch = 0; prev = null; }
      if (tap && !battle && !inputBlocked) {
        var pt = groundAt(e.clientX, e.clientY);
        if (!pt || Math.hypot(pt.x / 126, pt.z / 118) > 0.97) return;
        destination.set(pt.x, 0.15, pt.z); follow();
        var nearest = -1, best = 9;
        R.orte.forEach(function (o, i) { var d = Math.hypot(o.x - pt.x, o.z - pt.z); if (d < best) { best = d; nearest = i; } });
        if (nearest >= 0) { select(nearest + 1, false); if (handlers.select) handlers.select(nearest + 1); }
      }
    });
    on(canvas, 'pointercancel', clearInput);
    on(canvas, 'lostpointercapture', function (e) { if (pointers[e.pointerId]) clearInput(); });
    on(window, 'blur', clearInput); on(document, 'visibilitychange', clearInput);
    on(canvas, 'wheel', function (e) { e.preventDefault(); desiredZoom = T.MathUtils.clamp(desiredZoom + e.deltaY * 0.03, 20, 245); }, { passive: false });
    on(canvas, 'contextmenu', function (e) { e.preventDefault(); });
    on(canvas, 'keydown', function (e) { if (!inputBlocked && /^(Arrow(Up|Down|Left|Right)|[wasdqe])$/i.test(e.key)) { keys[e.key.toLowerCase()] = true; e.preventDefault(); } });
    on(window, 'keyup', function (e) { delete keys[e.key.toLowerCase()]; });
    on(canvas, 'webglcontextlost', function (e) { e.preventDefault(); contextLost = true; clearInput(); if (handlers.contextLost) handlers.contextLost(); });
    on(canvas, 'webglcontextrestored', function () { contextLost = false; if (handlers.contextRestored) handlers.contextRestored(); });
    function resize() {
      var rect = container.getBoundingClientRect(); width = Math.max(1, rect.width); height = Math.max(1, rect.height);
      renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
    }
    var observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    if (observer) observer.observe(container); on(window, 'resize', resize); resize();
    function project(at) {
      var p = new T.Vector3(at.x, at.y || 0, at.z).project(camera);
      return { x: (p.x + 1) * width / 2, y: (-p.y + 1) * height / 2, near: Math.hypot(at.x - focus.x, at.z - focus.z) < 32, visible: p.z > -1 && p.z < 1 && Math.abs(p.x) < 1.15 && Math.abs(p.y) < 1.15 };
    }
    var loop = host.loop({
      update: function (dt) {
        if (dead || contextLost) return; time += dt;
        if (keys.q) yaw += dt; if (keys.e) yaw -= dt;
        var vx = stick.x + (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
        var vz = stick.y + (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0);
        if ((vx || vz) && !battle && !inputBlocked) {
          var strength = Math.max(1, Math.hypot(vx, vz)); vx /= strength; vz /= strength;
          if (!following) follow();
          var nx = explorer.group.position.x + (Math.cos(yaw) * vx + Math.sin(yaw) * vz) * dt * 11;
          var nz = explorer.group.position.z + (-Math.sin(yaw) * vx + Math.cos(yaw) * vz) * dt * 11;
          if (Math.hypot(nx / 123, nz / 115) < 1) destination.set(nx, 0.15, nz);
        }
        if (!battle && !inputBlocked) {
          var dx = destination.x - explorer.group.position.x, dz = destination.z - explorer.group.position.z, dist = Math.hypot(dx, dz);
          if (dist > 0.1) {
            var move = Math.min(dist, dt * 11); explorer.group.position.x += dx / dist * move; explorer.group.position.z += dz / dist * move;
            explorer.group.rotation.y = Math.atan2(dx, dz); explorer.group.position.y = 0.15 + Math.abs(Math.sin(time * 10)) * 0.12;
            var across = Math.cos(yaw) * dx - Math.sin(yaw) * dz;
            if (Math.abs(across) > dist * 0.12) {
              var playerMap = explorer.group.userData.portrait.material.map, right = across > 0;
              playerMap.repeat.x = right ? -1 : 1; playerMap.offset.x = right ? 1 : 0;
            }
          } else {
            explorer.group.position.y = 0.15;
          }
        }
        if (following && !battle) desiredFocus.set(explorer.group.position.x, 0, explorer.group.position.z - 2);
        focus.lerp(desiredFocus, Math.min(1, dt * 6)); zoom += (desiredZoom - zoom) * Math.min(1, dt * 6);
        var tail = trail[trail.length - 1];
        if (tail.distanceTo(explorer.group.position) > 0.38) { trail.push(explorer.group.position.clone()); if (trail.length > 70) trail.shift(); }
        units.forEach(function (u) {
          if (!u.group.visible || u.id === 'explorer') return;
          if (u.id.indexOf('camp') === 0) {
            var number = Number(u.id.slice(4)), at = trail[Math.max(0, trail.length - 1 - (number + 1) * 5)];
            u.group.position.lerp(at, Math.min(1, dt * 7)); u.group.position.y = 0.15 + Math.sin(time * 6 + number) * 0.065; return;
          }
          if (u.hp <= 0) { u.group.scale.lerp(new T.Vector3(0.15, 0.15, 0.15), dt * 5); u.group.position.y = 0.1; return; }
          u.group.position.y = u.home.y + Math.sin(time * 2.5 + u.home.x) * 0.045;
          u.group.rotation.y = u.enemy ? Math.PI : 0;
          u.group.userData.ring.rotation.z = time * 0.35;
          if (u.attack) {
            u.attack.time += dt; var t = Math.min(1, u.attack.time / 0.55), lunge = Math.sin(t * Math.PI) * (u.attack.heal ? 0.12 : 0.68);
            u.group.position.x = u.home.x + (u.attack.to.x - u.home.x) * lunge;
            u.group.position.z = u.home.z + (u.attack.to.z - u.home.z) * lunge;
            u.group.position.y += Math.sin(t * Math.PI) * 0.5;
            if (t >= 1) u.attack = null;
          } else { u.group.position.x = u.home.x; u.group.position.z = u.home.z; }
        });
        effects = effects.filter(function (fx) {
          fx.life -= dt; fx.m.position.x += fx.vx * dt; fx.m.position.z += fx.vz * dt; fx.m.position.y += fx.vy * dt; fx.vy -= 9 * dt;
          fx.m.scale.setScalar(Math.max(0.005, fx.life * 0.28));
          if (fx.life <= 0) { scene.remove(fx.m); return false; } return true;
        });
      },
      render: function () {
        if (dead || contextLost || document.hidden) return;
        camera.position.set(focus.x + Math.sin(yaw) * zoom * 0.75, zoom * 0.86, focus.z + Math.cos(yaw) * zoom * 0.75);
        camera.lookAt(focus); camera.updateMatrixWorld(); renderer.render(scene, camera);
        if (handlers.frame) handlers.frame(project, battle, explorer.group.position);
      }
    });
    loop.start();
    return {
      select: select, overview: overview, follow: follow, setHeld: setHeld, setSquad: setSquad, setTerritories: setTerritories, startBattle: startBattle, endBattle: endBattle, step: step, project: project,
      zoom: function (delta) { desiredZoom = T.MathUtils.clamp(desiredZoom + delta, 20, 245); },
      rotate: function (delta) { yaw += delta; },
      move: function (x, y) { if (inputBlocked || battle) return; stick.x = x; stick.y = y; },
      blockInput: function (yes) { inputBlocked = yes; if (yes) clearInput(); },
      walkTo: function (id) { if (inputBlocked || battle) return; var o = R.orte[id - 1]; destination.set(o.x, 0.15, o.z + 6); follow(); },
      distanceTo: function (id) { var o = R.orte[id - 1]; return Math.hypot(explorer.group.position.x - o.x, explorer.group.position.z - o.z); },
      pause: function (yes) { if (yes) loop.pause(true); else loop.resume(true); },
      destroy: function () {
        if (dead) return; dead = true; loop.destroy(); off.forEach(function (f) { f(); }); if (observer) observer.disconnect();
        influence.destroy();
        var seen = new Set(); scene.traverse(function (m) { if (m.geometry && !seen.has(m.geometry)) { seen.add(m.geometry); m.geometry.dispose(); } });
        Object.keys(geometries).forEach(function (key) { if (!seen.has(geometries[key])) geometries[key].dispose(); });
        Object.keys(materials).forEach(function (key) { materials[key].dispose(); }); plane.material.dispose();
        spriteMaterials.forEach(function (m) { m.dispose(); });
        Object.keys(spriteTextures).forEach(function (key) { spriteTextures[key].dispose(); });
        groundTextures.forEach(function(texture){texture.dispose();});terrainMaterials.forEach(function(material){material.dispose();});
        renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
      }
    };
  };
})(SG);
