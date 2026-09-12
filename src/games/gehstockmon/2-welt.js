/* GehstockMon: echte 3D-Welt und Wiedergabe der gemeinsamen Kampfmaschine. */
(function (SG) {
  var R = SG.gehstockmon, X=R.abenteuer;
  R.orte = R.daten.BIOME;

  R.createWorld = function (host, container, handlers) {
    var T = window.THREE;
    if (!T) throw new Error('Die 3D-Engine konnte nicht geladen werden.');
    var renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    var canvas = renderer.domElement;
    canvas.className = 'gm-world-canvas';
    canvas.setAttribute('aria-label', '3D-Welt: ziehen zum Erkunden, tippen zum Laufen, zwei Finger zum Zoomen.');
    canvas.tabIndex = 0;
    container.appendChild(canvas);
    var scene = new T.Scene();
    scene.background = new T.Color('#345665');
    scene.fog = new T.FogExp2('#345665', 0.0011);
    var camera = new T.PerspectiveCamera(39, 1, 1, 2400);
    var focus = new T.Vector3(-8, 0, 6), desiredFocus = focus.clone();
    var yaw = 0.63, zoom = 38, desiredZoom = 38;
    var ambient = new T.HemisphereLight('#c5dfea', '#303b30', 1.6);
    scene.add(ambient);
    var sun = new T.DirectionalLight('#ffe2b2', 3);
    sun.position.set(-40, 70, 28);sun.castShadow=true;sun.shadow.mapSize.set(1536,1536);sun.shadow.bias=-.00025;sun.shadow.normalBias=.035;
    sun.shadow.camera.near=1;sun.shadow.camera.far=240;scene.add(sun);scene.add(sun.target);
    var rim = new T.DirectionalLight('#91b8da', .65);
    rim.position.set(25, 20, -35); scene.add(rim);
    var fixed = new T.Group(); scene.add(fixed);
    var materials = {}, geometries = {}, spriteTextures = {}, spriteMaterials = [], units = [], flags = [], effects = [], battle = false;
    var groundTextures = [], terrainMaterials = [], upgrades = new T.Group(), upgradeKey = '', gates=[], peers={}, trainers={}, encounterClock=0; scene.add(upgrades);
    var shadowTexture=R.contactShadow(T),shadowMaterial=new T.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false,toneMapped:false});
    geometries.shadow=new T.PlaneGeometry(1,1);
    for (var terrainKind = 0; terrainKind < R.orte.length; terrainKind++) {
      var terrainTexture = R.groundTexture(T, terrainKind);terrainTexture.anisotropy=4; groundTextures.push(terrainTexture);
      terrainMaterials.push(new T.MeshStandardMaterial({ map: terrainTexture, roughness: 1, metalness: 0, color: '#edf0e4' }));
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
      m.position.set(x, y, z); m.scale.set(sx, sy, sz);m.castShadow=sy>.5&&kind!=='land';m.receiveShadow=true; parent.add(m); return m;
    }
    function tree(x, z, size, spectral) {
      var biome=R.biomeAt(x,z);spectral=biome===3;
      var g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = x * 0.9; fixed.add(g);
      mesh(g, 'cylinder', '#514536', 0, size * 0.45, 0, size * 0.23, size * 0.9, size * 0.23);
      if(biome===2||biome===6||biome===8){var branch=mesh(g,'cylinder',biome===8?'#2c223c':'#796044',.4,size*.65,0,size*.14,size*.8,size*.14);branch.rotation.z=-.7;if(biome===8)mesh(g,'rock','#df4c83',0,size*1.3,0,.4,.8,.4,'#7e2348');return;}
      for (var j = 0; j < 3; j++) mesh(g, biome===1||biome===5?'sphere':'cone', biome===5?['#668754','#a4b86f','#d3c39a'][j]:biome===7?['#433953','#685771','#928295'][j]:biome===4?['#749692','#c4d9d6','#e1eeea'][j]:spectral ? ['#3a405f', '#4d5379', '#626b85'][j] : ['#224936', '#326449', '#4b8050'][j], 0, size * (0.85 + j * 0.3), 0, size * (1.05 - j * 0.22), size * 0.85, size * (1.05 - j * 0.22));
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
    function pathBetween(a,b){var dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz),m=mesh(fixed,'box','#9b9867',(a.x+b.x)/2,.025,(a.z+b.z)/2,4,.025,len);m.rotation.y=Math.atan2(dx,dz);}
    mesh(fixed,'box','#3c4844',0,-2.35,0,900,4,840);
    var land=mesh(fixed,'box','#739955',0,-.64,0,900,1.1,840);land.geometry=land.geometry.clone();var uv=land.geometry.getAttribute('uv');for(var ui=0;ui<uv.count;ui++)uv.setXY(ui,uv.getX(ui)*120,uv.getY(ui)*110);land.material=terrainMaterials[5];
    R.createBiomeGround(T,scene,terrainMaterials);var waters=R.createWater(T,scene);
    [-360,-120,120,360].forEach(function(z){pathBetween({x:-410,z:z},{x:410,z:z});});[-390,-120,120,390].forEach(function(x){pathBetween({x:x,z:-390},{x:x,z:390});});
    R.daten.WORLD.bridgeZ.forEach(function(z){var x=R.riverCenter(z),bridge=new T.Group();bridge.position.set(x,.12,z);fixed.add(bridge);mesh(bridge,'box','#806342',0,.15,0,22,.35,6.4);for(var side=-1;side<=1;side+=2){mesh(bridge,'box','#ba9565',0,1.1,side*3.1,22,.18,.16);for(var post=-10;post<=10;post+=5)mesh(bridge,'box','#765737',post,.7,side*3.1,.25,1.4,.25);}});
    for (var i = 0; i < R.orte.length; i++) {
      var o = R.orte[i];
      var clearing = mesh(fixed, 'land', o.farbe, o.x, 0.05, o.z, 18, 0.22, 17);
      clearing.geometry = clearing.geometry.clone(); var clearingUv = clearing.geometry.getAttribute('uv');
      for (var cu = 0; cu < clearingUv.count; cu++) clearingUv.setXY(cu, clearingUv.getX(cu) * 4, clearingUv.getY(cu) * 4);
      clearing.material = terrainMaterials[i];
      building(o.x, o.z - 2.8, 1, o.dach);
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
    for(var n=0;n<350;n++){var tx=Math.sin(n*83.17)*420,tz=Math.cos(n*47.31)*395;if(!X.walkable({x:tx,z:tz})||R.orte.some(function(o){return Math.hypot(o.x-tx,o.z-tz)<25;}))continue;tree(tx,tz,2+n%4*.7,false);if(n%3===0)mesh(fixed,'rock','#768479',tx+3,.6,tz+2,2,1.2,2);}
    building(0, 118, 2, '#366d79');
    var altar = mesh(fixed, 'ring', '#e4bd69', 0, 0.15, 125, 4, 4, 4, '#766132'); altar.rotation.x = Math.PI / 2;

    /* Clumps, flower patches, ruins and shoreline reeds add depth to the ground. */
    for (var tuft = 0; tuft < 2100; tuft++) {
      var tx = Math.sin(tuft * 83.17) * 440, tz = Math.cos(tuft * 47.31) * 408;
      if (!X.walkable({x:tx,z:tz}) || R.orte.some(function (o) { return Math.hypot(o.x-tx,o.z-tz)<7; })) continue;
      var kind=R.biomeAt(tx,tz),colors=kind===8?['#664354','#982f57','#38314d']:kind===7?['#6c648c','#84769b','#4b455e']:kind===6?['#c2a26e','#e0bc78','#b58b55']:kind===5?['#8f9e5e','#b5b878','#7c954f']:kind===4?['#c8dfdf','#e0eae8','#b6cfd4']:kind===2?['#56443d','#a04d32','#6e5748']:kind===3?['#607878','#647b91','#4d6169']:['#537343','#71884c','#3f673c'];
      var grass = mesh(fixed, 'cone', colors[tuft%3], tx, .24, tz, .20, .48 + tuft%3*.09, .12); grass.rotation.z = .22;grass.castShadow=false;
      if (tuft % 13 === 0) mesh(fixed, 'sphere', kind===4?'#e1ece7':kind===2?'#d87542':kind===3?'#99acc7':tuft%2 ? '#d3b269' : '#bccba1', tx, .35, tz, .25, .18, .25);
    }
    R.orte.forEach(function (o, i) {
      if(i===6||i===8){for(var r=0;r<7;r++){mesh(fixed,'rock',i===8?'#342638':'#c8a574',o.x+11+r*.7,.8+r*.6,o.z-7-r,3.8,3+r,3.4);mesh(fixed,'cylinder',i===8?'#56415c':'#a1987e',o.x-11+r*1.7,1.2,o.z-5,1,2.4+(r%2),1);}if(i===8){var voidRing=mesh(fixed,'ring','#ff4e86',o.x,.5,o.z+9,10,10,10,'#be2851');voidRing.rotation.x=Math.PI/2;}}
      if(i===7){for(var bolt=0;bolt<6;bolt++)mesh(fixed,'cone','#a9b4df',o.x-11+bolt*4,2,o.z-8,1,4+bolt%2,1,'#605ba4');}
      if(i%5===1){for(var reed=0;reed<8;reed++)mesh(fixed,'cone','#899860',o.x-13+reed*.8,.65,o.z-6,.2,1.3,.2);}
      if(i%5===4){for(var snow=0;snow<4;snow++)mesh(fixed,'rock','#c2d0cb',o.x+8+snow,1,o.z+5-snow,2.6,2,2.2);}
    });
    /* Statische Welt nach Material zusammenfassen: wenige Drawcalls auf dem iPad. */
    fixed.updateMatrixWorld(true);
    var batches = {}, old = [];
    fixed.traverse(function (m) {
      if (!m.isMesh) return;
      var id = m.material.uuid+':'+m.castShadow;
      if (!batches[id]) batches[id] = { material: m.material, shadow:m.castShadow, list: [] };
      var g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); g.applyMatrix4(m.matrixWorld); batches[id].list.push(g); old.push(m);
    });
    old.forEach(function (m) { m.parent.remove(m); if (Object.keys(geometries).every(function (key) { return geometries[key] !== m.geometry; })) m.geometry.dispose(); });
    Object.keys(batches).forEach(function (id) {
      var b = batches[id], merged = T.mergeGeometries(b.list, false);
      if (merged) { var m = new T.Mesh(merged, b.material);m.castShadow=b.shadow;m.receiveShadow=true; fixed.add(m); }
      b.list.forEach(function (g) { g.dispose(); });
    });
    var influence = R.createInfluence(T, scene), walls=R.createWalls(T,scene), selfId=null, route=[];
    function setTerritories(territories, playerId) {
      influence.set(territories, playerId);
      selfId=playerId;walls.set(territories,playerId);
      if(explorer&&walls.layout.some(function(g){return g.ownerId!==playerId&&X.inside(explorer.group.position,g);}))setPosition(X.outside(explorer.group.position,walls.layout));
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
      Object.keys(groups).forEach(function(id){var b=groups[id],g=T.mergeGeometries(b.list,false);if(g){var m=new T.Mesh(g,b.material);m.castShadow=true;m.receiveShadow=true;upgrades.add(m);}b.list.forEach(function(p){p.dispose();});});
    }

    /* Original generated portraits are the actual walking/battle sprites. */
    function spriteTexture(key, color, mon) {
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
      if(mon){R.drawAtlas(surface,'mons',mon.spriteIndex,function(){texture.needsUpdate=true;});texture.name='mon-'+mon.id;return texture;}
      if(key.indexOf('skin-')===0){R.drawAtlas(surface,'skins',Number(key.slice(5)),function(){texture.needsUpdate=true;});texture.name=key;texture.magFilter=T.NearestFilter;return texture;}
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
        ctx.clearRect(0,0,256,256);ctx.drawImage(img,0,0,256,256);texture.needsUpdate=true;
      };
      img.src = SG.assets[key] || SG.assets['gm-bollwerk'];
      return texture;
    }
    /* Der Spieler ist als einziges Wesen ein echtes Modell statt eines Bildes.
       Es steckt als Daten-URI im Bundle und wird aus dem Speicher ausgepackt,
       nie ueber das Netz geladen - sonst waere die Offline-Datei kaputt.
       Bis das Modell steht, und falls es klemmt, bleibt das Bild sichtbar. */
    /* Die Vorlage schaut quer zu ihrer eigenen Laufrichtung, deshalb die
       Vierteldrehung: das Spiel dreht die Figurengruppe nach atan2(dx, dz),
       und dazu muss das Modell bei null nach +z blicken. Sie geht nach links,
       nicht nach rechts - andersherum liefe die Figur rueckwaerts. */
    var MODELL_HOEHE = 2.9, MODELL_TEMPO = 1.55, MODELL_DREHUNG = -Math.PI / 2;
    var vorlage = null, wartend = [], figuren = [], modellFehlt = false;
    var modellSkala = 1, modellBoden = 0;

    function modellTextur() {
      var haut = new T.Texture(), bild = new Image();
      haut.flipY = false; haut.colorSpace = T.SRGBColorSpace;
      bild.onload = function () { if (!dead) { haut.image = bild; haut.needsUpdate = true; } };
      bild.src = SG.assets['gm-spieler-textur'] || '';
      return haut;
    }

    /* Die Vorlagen aus Tripo tragen ihre Fortbewegung in der Animation: die
       Huefte wandert im Laufschritt gut zweieinhalb Koerperlaengen nach vorn,
       im Stehen driftet sie langsam zur Seite. Wo das Spiel die Figur selbst
       ueber die Karte schiebt, liefe sie damit aus ihrem eigenen Ring und
       Schatten heraus. Herausgerechnet wird nur der geradlinige Anteil, das
       Wippen bleibt - und weil Anfang und Ende danach gleich stehen, schliesst
       sich die Schleife sauber.

       Die halbe Schrittweite im Abzug haelt die Figur dabei mittig ueber
       ihrem Kreis. Ohne sie friert die Bewegung auf ihrem Anfangswert ein,
       und der liegt einen halben Schritt hinter der Ruhelage - die Figur
       liefe sichtbar hinter ihrem eigenen Schatten her. */
    function ortsfest(clips) {
      clips.forEach(function (clip) {
        clip.tracks.forEach(function (spur) {
          if (spur.name.slice(-9) !== '.position') return;
          var werte = spur.values, anzahl = werte.length / 3;
          if (anzahl < 2) return;
          for (var achse = 0; achse < 3; achse++) {
            var drift = werte[(anzahl - 1) * 3 + achse] - werte[achse];
            if (Math.abs(drift) < 1e-6) continue;
            for (var i = 0; i < anzahl; i++) werte[i * 3 + achse] -= drift * (i / (anzahl - 1) - 0.5);
          }
        });
      });
      return clips;
    }

    function ladeModell() {
      var quelle = SG.assets['gm-spieler'];
      if (modellFehlt || vorlage) return;
      if (!quelle || !T.GLTFLoader) { modellFehlt = true; return; }
      vorlage = 'laedt';
      var roh = atob(quelle.slice(quelle.indexOf(',') + 1)), speicher = new Uint8Array(roh.length);
      for (var i = 0; i < roh.length; i++) speicher[i] = roh.charCodeAt(i);
      var haut = modellTextur();
      new T.GLTFLoader().parse(speicher.buffer, '', function (glb) {
        if (dead) return;
        glb.scene.traverse(function (teil) {
          if (!teil.isMesh) return;
          teil.castShadow = true; teil.frustumCulled = false;
          teil.material = new T.MeshStandardMaterial({ map: haut, roughness: 0.62, metalness: 0, side: T.FrontSide });
        });
        /* Der Massstab kommt aus dem Modell selbst, nicht aus einer Zahl im
           Blender-Skript: eine Skalierung am Skelett laesst das Netz
           auseinanderfliegen, weil die Bindematrizen davon nichts wissen. */
        var huelle = new T.Box3().setFromObject(glb.scene), hoch = huelle.max.y - huelle.min.y;
        modellSkala = hoch > 0.01 ? MODELL_HOEHE / hoch : 1;
        modellBoden = -huelle.min.y * modellSkala;
        vorlage = { szene: glb.scene, clips: ortsfest(glb.animations) };
        wartend.splice(0).forEach(anziehen);
      }, function (fehler) { vorlage = null; modellFehlt = true; wartend.length = 0;
        console.warn('GehstockMon: das Spielermodell liess sich nicht lesen, das Bild bleibt stehen.', fehler); });
    }

    /* Haengt das Modell in eine bereits bestehende Figurengruppe und laesst
       das Bild darunter verschwinden. Umgeschaltet wird spaeter allein nach
       der gelaufenen Strecke - das gilt fuer den Spieler wie fuer die
       anderen Leute in der Welt, ohne dass eine Stelle es melden muesste. */
    function anziehen(gruppe) {
      if (!vorlage || vorlage === 'laedt') { if (wartend.indexOf(gruppe) < 0) wartend.push(gruppe); ladeModell(); return; }
      var koerper = T.cloneSkinned(vorlage.szene);
      koerper.scale.setScalar(modellSkala);
      koerper.position.y = modellBoden;
      koerper.rotation.y = MODELL_DREHUNG;
      gruppe.add(koerper);
      if (gruppe.userData.portrait) gruppe.userData.portrait.visible = false;
      var mixer = new T.AnimationMixer(koerper), spuren = {};
      vorlage.clips.forEach(function (clip) {
        var takt = mixer.clipAction(clip);
        takt.setLoop(T.LoopRepeat, Infinity); takt.enabled = true;
        takt.setEffectiveWeight(clip.name === 'stehen' ? 1 : 0).play();
        if (clip.name === 'laufen') takt.setEffectiveTimeScale(MODELL_TEMPO);
        spuren[clip.name] = takt;
      });
      var figur = { gruppe: gruppe, koerper: koerper, mixer: mixer, spuren: spuren,
                    zuletzt: gruppe.position.clone(), anteil: 0 };
      gruppe.userData.figur = figur; figuren.push(figur);
      return figur;
    }

    /* Ueberblenden zwischen Stehen und Laufen. Der Anteil wandert weich, damit
       ein kurzes Stocken an einer Mauer die Beine nicht zucken laesst. */
    var schrittWeg = new T.Vector3();
    function figurenSchritt(dt) {
      for (var i = figuren.length - 1; i >= 0; i--) {
        var f = figuren[i];
        if (!f.gruppe.parent) { figuren.splice(i, 1); continue; }
        schrittWeg.subVectors(f.gruppe.position, f.zuletzt);
        var strecke = schrittWeg.length();
        f.zuletzt.copy(f.gruppe.position);
        var laeuft = dt > 0 && strecke / dt > 0.9;
        /* Blickrichtung aus der gelaufenen Strecke. Die eigene Figur dreht
           das Spiel schon an der Gruppe - fuer die kommt hier nur die
           Vierteldrehung heraus. Die anderen Leute in der Welt dreht
           niemand, und als Bild brauchten sie es auch nie. */
        if (laeuft) {
          var ziel = Math.atan2(schrittWeg.x, schrittWeg.z) - f.gruppe.rotation.y + MODELL_DREHUNG;
          var weg = (ziel - f.koerper.rotation.y + Math.PI) % (Math.PI * 2);
          if (weg < 0) weg += Math.PI * 2;
          f.koerper.rotation.y += (weg - Math.PI) * Math.min(1, dt * 12);
        }
        f.anteil += ((laeuft ? 1 : 0) - f.anteil) * Math.min(1, dt * 9);
        if (f.spuren.laufen) f.spuren.laufen.setEffectiveWeight(f.anteil);
        if (f.spuren.stehen) f.spuren.stehen.setEffectiveWeight(1 - f.anteil);
        f.mixer.update(dt);
      }
    }

    function creature(role, rarity, enemy, monId) {
      var g = new T.Group(), k = SG.gehstockmon.daten.mon(monId);
      var color = enemy ? '#f38976' : SG.gehstockmon.daten.SELTENHEITEN[rarity].farbe;
      var key = monId === 'player' ? 'gm-player-pixel' : k ? k.bild : SG.gehstockmon.daten.KREATUREN[role].bild;
      var material = new T.SpriteMaterial({ map: spriteTexture(key, color, k), transparent: true, depthWrite: false, toneMapped: false });
      spriteMaterials.push(material);
      var portrait = new T.Sprite(material), size = monId === 'player' ? 3.4 : k?k.worldSize:2.4;
      portrait.scale.set(size, size, 1); portrait.position.y = size * 0.52; g.add(portrait);
      { portrait.center.set(0.5, 0); portrait.position.y = 0; }
      var ring = mesh(g, 'ring', color, 0, 0.09, 0, 1.3, 1.3, 1.3); ring.rotation.x = Math.PI / 2;
      var shadow=new T.Mesh(geometries.shadow,shadowMaterial);shadow.rotation.x=-Math.PI/2;shadow.position.y=.02;shadow.scale.set(2.4,1.5,1);g.add(shadow);
      g.userData = { portrait: portrait, ring: ring, rarity: rarity };
      if (monId === 'player') anziehen(g);
      return g;
    }
    function addUnit(id, role, rarity, x, z, enemy, hp, monId) {
      var g = creature(role, rarity, enemy, monId); scene.add(g); g.position.set(x, 0.15, z);
      var bg = mesh(g, 'box', '#26373c', 0, 3.4, 0, 1.8, 0.15, 0.12);
      var bar = mesh(g, 'box', enemy ? '#f7836d' : '#81d2a3', 0, 3.4, 0.075, 1.72, 0.105, 0.03);
      bg.visible = /^(wir|sie)/.test(id); bar.visible = bg.visible;
      var u = { id: id, monId: monId, group: g, bar: bar, maxHp: hp || 100, hp: hp || 100, home: new T.Vector3(x, 0.15, z), pulse: 0, attack: null, enemy: enemy };
      units.push(u); return u;
    }
    var explorer = addUnit('explorer', 0, 0, 0, 125, false, 100, 'player');
    var stick = { x: 0, y: 0 }, destination = explorer.home.clone(), trail = [];
    for (var behind = 145; behind >= 0; behind--) trail.push(new T.Vector3(explorer.home.x - behind * 0.4, 0.15, explorer.home.z));
    function followOffsets(roster){var sum=0,previous=3.4;return roster.map(function(k){sum+=(previous+k.worldSize)*.45+.6;previous=k.worldSize;return Math.ceil(sum/.4);});}
    var squadOffsets=[],squadKey = '';
    function setSquad(roster) {
      var key = roster.map(function (k) { return k.id; }).join(','); if (key === squadKey) return; squadKey = key;squadOffsets=followOffsets(roster);
      units = units.filter(function (u) { if (u.id.indexOf('camp') === 0) { disposeUnit(u); return false; } return true; });
      roster.forEach(function (k, i) {
        addUnit('camp' + i, k.typ, k.seltenheit, explorer.group.position.x - (i + 1) * 1.8, explorer.group.position.z + 1.5, false, k.hp, k.id);
      });
    }
    setSquad(SG.gehstockmon.daten.STARTER.map(SG.gehstockmon.daten.mon));
    var selectionRing = mesh(scene, 'ring', '#ffd281', -14, 0.38, 12, 18.6, 18.6, 0.4, '#79613b'); selectionRing.rotation.x = Math.PI / 2;
    selectionRing.geometry=new T.TorusGeometry(.5,.009,6,48);
    var ray = new T.Raycaster(), pointer = new T.Vector2();
    var plane = new T.Mesh(new T.PlaneGeometry(900, 840), new T.MeshBasicMaterial({ visible: false }));
    plane.rotation.x = -Math.PI / 2; scene.add(plane); plane.updateMatrixWorld();
    function groundAt(x, y) {
      var rect = canvas.getBoundingClientRect();
      pointer.set((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1);
      ray.setFromCamera(pointer, camera);
      var hit = ray.intersectObject(plane); return hit.length ? hit[0].point : null;
    }
    function disposeUnit(u) {
      u.group.traverse(function (part) { if (part.isSprite) { part.material.dispose(); spriteMaterials = spriteMaterials.filter(function (m) { return m !== part.material; }); } });
      if (u.group.userData.figur) { u.group.userData.figur.mixer.stopAllAction(); figuren = figuren.filter(function (f) { return f.gruppe !== u.group; }); }
      scene.remove(u.group);
    }
    function removePeer(id){var p=peers[id];if(!p)return;(p.followers||[]).forEach(disposeUnit);disposeUnit(p);p.texture.dispose();delete peers[id];}
    function setPeers(list,serverTime){
      var keep={};list.slice().sort(function(a,b){return Math.hypot(a.x-explorer.group.position.x,a.z-explorer.group.position.z)-Math.hypot(b.x-explorer.group.position.x,b.z-explorer.group.position.z);}).slice(0,48).forEach(function(info){
        if(typeof info.id!=='string'||!Number.isFinite(info.x)||!Number.isFinite(info.z)||!Number.isFinite(info.updatedAt)||serverTime-info.updatedAt>=15000)return;
        keep[info.id]=true;var p=peers[info.id];
        if(!p){var g=creature(0,0,false,'player'),texture=g.userData.portrait.material.map.clone();texture.needsUpdate=true;g.userData.portrait.material.map=texture;
          g.name='peer-'+info.id;g.userData.peerId=info.id;g.userData.ring.material=mat('#89cce5');g.position.set(info.x,.15,info.z);scene.add(g);
          var initialTrail=[];for(var step=145;step>=0;step--)initialTrail.push(new T.Vector3(info.x-Math.sin(info.heading||0)*step*.4,.15,info.z-Math.cos(info.heading||0)*step*.4));
          p=peers[info.id]={group:g,texture:texture,from:g.position.clone(),to:g.position.clone(),elapsed:0,duration:1,updatedAt:0,followers:[],trail:initialTrail};
        }
        if(p.updatedAt!==info.updatedAt){p.from.copy(p.group.position);p.to.set(info.x,.15,info.z);p.duration=T.MathUtils.clamp((info.updatedAt-p.updatedAt)/1000,.15,3);p.elapsed=0;if(p.from.distanceTo(p.to)>45){p.group.position.copy(p.to);p.from.copy(p.to);}}
        var skin=info.skin||'wanderer';if(p.skin!==skin){p.texture.dispose();p.texture=spriteTexture(skin==='wanderer'?'gm-player-pixel':'skin-'+R.skinIndex(skin),'#ffffff').clone();p.texture.needsUpdate=true;p.group.userData.portrait.material.map=p.texture;p.skin=skin;}
        var squad=(info.squad||[]).filter(function(id){return !!R.daten.mon(id);}).slice(0,4),squadKey=squad.join(',');if(p.squadKey!==squadKey){p.followers.forEach(disposeUnit);p.followers=squad.map(function(id,i){var mon=R.daten.mon(id),g=creature(mon.typ,mon.seltenheit,false,id);g.name='peer-mon-'+info.id+'-'+id;g.position.copy(p.group.position);scene.add(g);return{group:g};});p.offsets=followOffsets(squad.map(R.daten.mon));p.squadKey=squadKey;}
p.updatedAt=info.updatedAt;p.age=Math.max(0,(serverTime-info.updatedAt)/1000);p.heading=info.heading||0;p.info=info;
      });Object.keys(peers).forEach(function(id){if(!keep[id])removePeer(id);});
    }
    function canStep(x,z){
      return X.canTravel(walls.layout,explorer.group.position,{x:x,z:z},selfId);
    }
    function setPosition(p){explorer.group.position.set(p.x,.15,p.z);clearInput();trail=[];for(var behind=145;behind>=0;behind--)trail.push(new T.Vector3(p.x-behind*.4*Math.cos(yaw),.15,p.z+behind*.4*Math.sin(yaw)));units.forEach(function(u){if(u.id.indexOf('camp')===0){var n=Number(u.id.slice(4));u.group.position.copy(trail[Math.max(0,trail.length-1-(squadOffsets[n]||7))]);}});}
    function walkToPoint(p){if(inputBlocked||battle)return;var g=walls.layout.find(function(g){return g.ownerId!==selfId&&X.inside(p,g);});if(g)p=walls.entrance(g.fields[0]);route=X.route(walls.layout,explorer.group.position,p,selfId)||[];if(route.length){var next=route.shift();destination.set(next.x,.15,next.z);}follow();}
    function setHeld(ids) {
      held = ids.slice();
      flags.forEach(function (f, i) { f.material = mat(held.indexOf(i + 1) >= 0 ? '#5baea1' : '#c35644'); });
    }
    function select(id, center) {
      selected = id; var o = R.orte[id - 1];
      selectionRing.position.set(o.x, 0.38, o.z);
      if (center) { following = false; desiredFocus.set(o.x, 0, o.z + 3); desiredZoom = 35; }
    }
    function overview() { following = false; desiredFocus.set(0, 0, 0); desiredZoom = 1120; }
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
    function clearInput() { pointers = {}; keys = {}; pinch = 0; prev = null; dragged = true; route=[];stick.x = 0; stick.y = 0; explorer.group.position.y = 0.15; destination.copy(explorer.group.position); }
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
      if (Object.keys(pointers).length > 1) { var d = distance(); if (pinch > 0 && d > 0) desiredZoom = T.MathUtils.clamp(desiredZoom * pinch / d, 20, 1250); pinch = d; dragged = true; return; }
      var dx = e.clientX - last.x, dy = e.clientY - last.y;
      if (prev && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) > 7) dragged = true;
      if (dragged) {
        following = false;
        var f = zoom / Math.max(400, height);
        desiredFocus.x -= (Math.cos(yaw) * dx + Math.sin(yaw) * dy) * f;
        desiredFocus.z -= (-Math.sin(yaw) * dx + Math.cos(yaw) * dy) * f;
        desiredFocus.x = T.MathUtils.clamp(desiredFocus.x, -440, 440); desiredFocus.z = T.MathUtils.clamp(desiredFocus.z, -410, 410);
      }
    });
    on(canvas, 'pointerup', function (e) {
      var tap = !dragged && Object.keys(pointers).length === 1;
      delete pointers[e.pointerId]; if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      if (!Object.keys(pointers).length) { pinch = 0; prev = null; }
      if (tap && !battle && !inputBlocked) {
        var pt = groundAt(e.clientX, e.clientY);
        if (!pt || !X.walkable(pt)) return;
        walkToPoint(pt);
        var nearest = -1, best = 9;
        R.orte.forEach(function (o, i) { var d = Math.hypot(o.x - pt.x, o.z - pt.z); if (d < best) { best = d; nearest = i; } });
        if (nearest >= 0) { select(nearest + 1, false); if (handlers.select) handlers.select(nearest + 1); }
      }
    });
    on(canvas, 'pointercancel', clearInput);
    on(canvas, 'lostpointercapture', function (e) { if (pointers[e.pointerId]) clearInput(); });
    on(window, 'blur', clearInput); on(document, 'visibilitychange', clearInput);
    on(canvas, 'wheel', function (e) { e.preventDefault(); desiredZoom = T.MathUtils.clamp(desiredZoom + e.deltaY * 0.03, 20, 1250); }, { passive: false });
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
        figurenSchritt(dt);
        waters.update(time);
        Object.keys(trainers).forEach(function(id){var p=trainers[id],at=X.encounterPosition(p.info,encounterClock+time*1000);p.group.position.set(at.x,.15+Math.abs(Math.sin(time*6))*.1,at.z);p.group.visible=!battle;});
        walls.update(dt,explorer.group.position);
        Object.keys(peers).forEach(function(id){var p=peers[id];p.age+=dt;if(p.age>=15){removePeer(id);return;}p.elapsed+=dt;p.group.position.lerpVectors(p.from,p.to,Math.min(1,p.elapsed/p.duration));
          if(p.trail[p.trail.length-1].distanceTo(p.group.position)>.38){p.trail.push(p.group.position.clone());if(p.trail.length>160)p.trail.shift();}
          p.followers.forEach(function(f,i){var at=p.trail[Math.max(0,p.trail.length-1-p.offsets[i])];f.group.position.lerp(at,Math.min(1,dt*7));f.group.position.y=.15+Math.sin(time*6+i)*.06;});
          var walking=p.elapsed<p.duration&&p.from.distanceTo(p.to)>.15;p.group.position.y=.15+(walking&&!p.group.userData.figur?Math.abs(Math.sin(time*10))*.12:0);
          var across=Math.cos(yaw)*Math.sin(p.heading)-Math.sin(yaw)*Math.cos(p.heading);if(Math.abs(across)>.1){p.texture.repeat.x=across>0?-1:1;p.texture.offset.x=across>0?1:0;}
        });
        if (keys.q) yaw += dt; if (keys.e) yaw -= dt;
        var vx = stick.x + (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
        var vz = stick.y + (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0);
        if ((vx || vz) && !battle && !inputBlocked) {
          route=[];
          var strength = Math.max(1, Math.hypot(vx, vz)); vx /= strength; vz /= strength;
          if (!following) follow();
          var nx = explorer.group.position.x + (Math.cos(yaw) * vx + Math.sin(yaw) * vz) * dt * 11;
          var nz = explorer.group.position.z + (-Math.sin(yaw) * vx + Math.cos(yaw) * vz) * dt * 11;
          if (X.onLand({x:nx,z:nz})) destination.set(nx, 0.15, nz);
        }
        if (!battle && !inputBlocked) {
          var dx = destination.x - explorer.group.position.x, dz = destination.z - explorer.group.position.z, dist = Math.hypot(dx, dz);
          if (dist > 0.1) {
            var move = Math.min(dist, dt * 11),nextX=explorer.group.position.x+dx/dist*move,nextZ=explorer.group.position.z+dz/dist*move;
            if(canStep(nextX,nextZ)){explorer.group.position.x=nextX;explorer.group.position.z=nextZ;}
            explorer.group.rotation.y = Math.atan2(dx, dz);
            explorer.group.position.y = 0.15 + (explorer.group.userData.figur ? 0 : Math.abs(Math.sin(time * 10)) * 0.12);
            var across = Math.cos(yaw) * dx - Math.sin(yaw) * dz;
            if (Math.abs(across) > dist * 0.12) {
              var playerMap = explorer.group.userData.portrait.material.map, right = across > 0;
              playerMap.repeat.x = right ? -1 : 1; playerMap.offset.x = right ? 1 : 0;
            }
          } else {
            explorer.group.position.y = 0.15;
            if(route.length){var next=route.shift();destination.set(next.x,.15,next.z);}
          }
        }
        if (following && !battle) desiredFocus.set(explorer.group.position.x, 0, explorer.group.position.z - 2);
        focus.lerp(desiredFocus, Math.min(1, dt * 6)); zoom += (desiredZoom - zoom) * Math.min(1, dt * 6);
        var tail = trail[trail.length - 1];
        if (tail.distanceTo(explorer.group.position) > 0.38) { trail.push(explorer.group.position.clone()); if (trail.length > 160) trail.shift(); }
        units.forEach(function (u) {
          if (!u.group.visible || u.id === 'explorer') return;
          if (u.id.indexOf('camp') === 0) {
            var number = Number(u.id.slice(4)), at = trail[Math.max(0, trail.length - 1 - (squadOffsets[number]||7))];
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
        sun.position.set(focus.x-40,70,focus.z+28);sun.target.position.set(focus.x,0,focus.z);
        var extent=Math.max(42,zoom*.75);if(Math.abs(sun.shadow.camera.right-extent)>2){sun.shadow.camera.left=sun.shadow.camera.bottom=-extent;sun.shadow.camera.right=sun.shadow.camera.top=extent;sun.shadow.camera.updateProjectionMatrix();}
        scene.fog.density=zoom>400?.00022:.0011;camera.lookAt(focus); camera.updateMatrixWorld(); renderer.render(scene, camera);
        if (handlers.frame) handlers.frame(project, battle, explorer.group.position,Object.keys(peers).map(function(id){return {id:id,position:peers[id].group.position,info:peers[id].info};}));
      }
    });
    loop.start();
    return {
      select: select, overview: overview, follow: follow, setHeld: setHeld, setSquad: setSquad, setTerritories: setTerritories, setPeers: setPeers, startBattle: startBattle, endBattle: endBattle, step: step, project: project,
      position:function(){return {x:explorer.group.position.x,z:explorer.group.position.z,heading:explorer.group.rotation.y};},
      setPosition:setPosition,walkToPoint:walkToPoint,entrance:walls.entrance,
      setAppearance:function(skin){if(explorer.skin===skin)return;explorer.skin=skin;explorer.group.userData.portrait.material.map=spriteTexture(skin==='wanderer'?'gm-player-pixel':'skin-'+R.skinIndex(skin),'#ffffff');explorer.group.userData.ring.material=mat(X.skin(skin).color);},
      setEncounters:function(list,serverTime){encounterClock=serverTime-time*1000;var keep={};list.filter(function(e){return e.kind==='trainer';}).forEach(function(e){keep[e.id]=true;var p=trainers[e.id];if(!p){var g=creature(0,0,false,'player'),texture=spriteTexture('skin-'+e.skinIndex,'#ffffff');g.userData.portrait.material.map=texture;g.userData.portrait.scale.set(4.5,4.5,1);g.name='trainer-'+e.id;scene.add(g);p=trainers[e.id]={group:g};}p.info=e;});Object.keys(trainers).forEach(function(id){if(!keep[id]){disposeUnit(trainers[id]);delete trainers[id];}});},
      zoom: function (delta) { desiredZoom = T.MathUtils.clamp(desiredZoom + delta, 20, 1250); },
      rotate: function (delta) { yaw += delta; },
      move: function (x, y) { if (inputBlocked || battle) return; stick.x = x; stick.y = y; },
      blockInput: function (yes) { inputBlocked = yes; if (yes) clearInput(); },
      walkTo: function (id) { walkToPoint(walls.entrance(id)); },
      distanceTo: function (id) { var o = walls.entrance(id); return Math.hypot(explorer.group.position.x - o.x, explorer.group.position.z - o.z); },
      pause: function (yes) { if (yes) loop.pause(true); else loop.resume(true); },
      destroy: function () {
        if (dead) return; dead = true; loop.destroy(); off.forEach(function (f) { f(); }); if (observer) observer.disconnect();
        Object.keys(peers).forEach(removePeer);Object.keys(trainers).forEach(function(id){disposeUnit(trainers[id]);});influence.destroy();walls.destroy();waters.destroy();shadowTexture.dispose();shadowMaterial.dispose();if(sun.shadow.map)sun.shadow.map.dispose();
        var seen = new Set(); scene.traverse(function (m) { if (m.geometry && !seen.has(m.geometry)) { seen.add(m.geometry); m.geometry.dispose(); } });
        Object.keys(geometries).forEach(function (key) { if (!seen.has(geometries[key])) geometries[key].dispose(); });
        Object.keys(materials).forEach(function (key) { materials[key].dispose(); }); plane.material.dispose();
        figuren.forEach(function (f) { f.mixer.stopAllAction(); }); figuren = []; wartend = [];
        if (vorlage && vorlage !== 'laedt') vorlage.szene.traverse(function (teil) { if (teil.isMesh && teil.material.map) teil.material.map.dispose(); });
        spriteMaterials.forEach(function (m) { m.dispose(); });
        Object.keys(spriteTextures).forEach(function (key) { spriteTextures[key].dispose(); });
        groundTextures.forEach(function(texture){texture.dispose();});terrainMaterials.forEach(function(material){material.dispose();});
        renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
      }
    };
  };
})(SG);
