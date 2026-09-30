/* ------------------------------------------------------------------
   Rom-Event: Kulisse und Figuren in der 3D-Welt

   Haengt sich ueber R.weltErweiterungen in 2-welt.js. Alles wird erst
   gebaut, wenn zum ersten Mal ein Event auftaucht, und beim Beenden der
   Welt wieder freigegeben. Figuren sind Sprites mit Bildern, die hier auf
   einer Leinwand gemalt werden - es braucht keine einzige Bilddatei.

   Wo eine Figur steht, rechnet X.ROM aus der Serveruhr: dieselbe Pizza
   steht auf jedem Geraet an derselben Stelle, und der Server prueft die
   Naehe gegen genau diese Rechnung.

   Obergrenzen fuer iPad und Handy: 8 Pizzen, Wagen mit 6 Legionaeren,
   12 Kakerlaken und eine Reiseleiterin auf der Piazza, dazu je 3 an den
   Tanzplaetzen (ROM.TANZPLAETZE), ein Boss, hoechstens 140 Partikel
   (im ruhigen Modus 40).
   ------------------------------------------------------------------ */
(function (SG) {
  var R = SG.gehstockmon, X = R.abenteuer;
  R.weltErweiterungen = R.weltErweiterungen || [];

  /* ------------------------------------------------ Gemalte Bilder */
  function leinwand(T, b, h, malen) {
    var c = document.createElement('canvas'); c.width = b; c.height = h;
    var g = c.getContext('2d'); malen(g, b, h);
    var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 2;
    t.userData = { seite: b / h };
    return t;
  }
  function kreis(g, x, y, r, farbe) { g.fillStyle = farbe; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  function oval(g, x, y, rx, ry, farbe, winkel) { g.fillStyle = farbe; g.beginPath(); g.ellipse(x, y, rx, ry, winkel || 0, 0, Math.PI * 2); g.fill(); }
  function linie(g, pkte, farbe, breite) { g.strokeStyle = farbe; g.lineWidth = breite; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(pkte[0], pkte[1]); for (var i = 2; i < pkte.length; i += 2) g.lineTo(pkte[i], pkte[i + 1]); g.stroke(); }
  function augen(g, x, y, abstand, r, wut) {
    [-1, 1].forEach(function (s) {
      kreis(g, x + s * abstand, y, r, '#ffffff'); kreis(g, x + s * abstand + 1, y + 1, r * 0.5, '#1d1410');
      if (wut) linie(g, [x + s * abstand - r, y - r - 2 - (s > 0 ? 3 : 0), x + s * abstand + r, y - r - 2 - (s > 0 ? 0 : 3)], '#1d1410', 3);
    });
  }
  /* Eine Pizza von oben mit Rand, Sosse, Kaese und Belag. */
  function pizzaScheibe(g, x, y, r, sorte) {
    kreis(g, x, y, r, '#d38f45'); kreis(g, x, y, r * 0.84, '#cf3a25');
    for (var i = 0; i < 9; i++) { var a = i * 2.4, d = r * (0.2 + (i % 3) * 0.2); oval(g, x + Math.cos(a) * d, y + Math.sin(a) * d, r * 0.2, r * 0.14, '#ffe6a3', a); }
    var belag = ['#9c2a20', '#7a5230', '#2f2a26', '#9c2a20'][sorte || 0];
    for (var k = 0; k < 6; k++) { var b = k * 1.05 + 0.4, e = r * (0.35 + (k % 2) * 0.25); kreis(g, x + Math.cos(b) * e, y + Math.sin(b) * e, r * 0.1, belag); }
    for (var l = 0; l < 3; l++) oval(g, x + Math.cos(l * 2.1) * r * 0.5, y + Math.sin(l * 2.1) * r * 0.5, r * 0.09, r * 0.05, '#3b8c36', l);
  }
  var MALER = {
    pizza: function (g, b, h, bild) {
      var s = bild % 2 ? 1 : -1, sorte = Math.floor(bild / 2);
      linie(g, [52, 118, 46 + s * 10, 150], '#2a1c12', 7); linie(g, [76, 118, 82 - s * 10, 150], '#2a1c12', 7);
      oval(g, 44 + s * 10, 152, 11, 6, '#b62f24'); oval(g, 84 - s * 10, 152, 11, 6, '#b62f24');
      linie(g, [14, 70, 2, 70 - s * 18], '#2a1c12', 6); linie(g, [114, 70, 126, 70 + s * 18], '#2a1c12', 6);
      pizzaScheibe(g, 64, 66, 56, sorte);
      augen(g, 64, 52, 17, 10, sorte === 1);
      oval(g, 64, 84, 11, 8 + (bild % 2) * 3, '#5a1410');
    },
    legionaer: function (g, b, h, bild) {
      var s = bild % 2 ? 1 : -1;
      linie(g, [50, 140, 44 + s * 8, 170], '#2a1c12', 7); linie(g, [78, 140, 84 - s * 8, 170], '#2a1c12', 7);
      g.fillStyle = '#d38f45'; g.beginPath(); g.moveTo(20, 44); g.lineTo(108, 44); g.lineTo(64, 150); g.closePath(); g.fill();
      g.fillStyle = '#cf3a25'; g.beginPath(); g.moveTo(28, 52); g.lineTo(100, 52); g.lineTo(64, 138); g.closePath(); g.fill();
      oval(g, 50, 80, 9, 6, '#ffe6a3', 0.4); kreis(g, 74, 96, 7, '#9c2a20'); kreis(g, 58, 112, 6, '#9c2a20');
      kreis(g, 64, 40, 30, '#e3b440'); g.fillStyle = '#1d1410'; g.fillRect(30, 38, 68, 6);
      g.fillStyle = '#c1271d'; g.beginPath(); g.ellipse(64, 12, 30, 10, 0, Math.PI, 0); g.fill();
      augen(g, 64, 66, 13, 7, true);
      kreis(g, 104, 104, 20, '#c1271d'); kreis(g, 104, 104, 8, '#e3b440');
      linie(g, [18, 170, 18, 20], '#6d4a2a', 5); g.fillStyle = '#d7d7d7'; g.beginPath(); g.arc(18, 22, 12, 0, Math.PI * 2); g.fill();
    },
    kakerlake: function (g, b, h, pose) {
      /* pose 0..3 wie ROM.POSEN, 4 und 5 zwei Tanzschritte */
      var neig = [0, 0.25, 0, -0.25, 0.12, -0.12][pose], knie = pose === 2 ? 14 : 0;
      g.save(); g.translate(64, 96 + knie); g.rotate(neig);
      [-1, 1].forEach(function (s) { for (var i = 0; i < 3; i++) linie(g, [s * 14, -10 + i * 16, s * (34 + i * 3), 2 + i * 18 - knie * 0.3], '#3b2415', 4); });
      oval(g, 0, 8, 22, 36, '#6b3b1f'); oval(g, -6, 0, 8, 22, '#8d5530');
      var arme = [[-38, -56, 38, -56], [-30, -10, 44, -30], [-40, -6, 40, -6], [-44, -30, 30, -10], [-40, -40, 34, -14], [-34, -14, 40, -40]][pose];
      linie(g, [-14, -22, arme[0], arme[1]], '#3b2415', 5); linie(g, [14, -22, arme[2], arme[3]], '#3b2415', 5);
      oval(g, arme[0], arme[1], 7, 10, '#e2a03a', 0.5); oval(g, arme[2], arme[3], 7, 10, '#3fa05a', -0.5);
      kreis(g, 0, -36, 16, '#7a4424'); augen(g, 0, -38, 7, 5, false);
      linie(g, [-6, -50, -18, -80], '#3b2415', 3); linie(g, [6, -50, 18, -80], '#3b2415', 3);
      oval(g, 0, -52, 42, 9, '#f2c230'); oval(g, 0, -62, 16, 14, '#f2c230'); g.fillStyle = '#c92a2a'; g.fillRect(-16, -58, 32, 6);
      g.restore();
    },
    fuehrerin: function (g) {
      MALER.kakerlake(g, 128, 160, 4);
      linie(g, [104, 150, 104, 10], '#6d4a2a', 4);
      g.fillStyle = '#ffffff'; g.fillRect(106, 10, 20, 28); g.fillStyle = '#1b8a3c'; g.fillRect(106, 10, 7, 28); g.fillStyle = '#c92a2a'; g.fillRect(119, 10, 7, 28);
      g.fillStyle = '#1d1410'; g.fillRect(48, 54, 32, 7);
    },
    boss: function (g) {
      oval(g, 128, 300, 80, 12, 'rgba(0,0,0,0.25)');
      g.fillStyle = '#c1271d'; g.beginPath(); g.moveTo(40, 120); g.lineTo(216, 120); g.lineTo(236, 300); g.lineTo(20, 300); g.closePath(); g.fill();
      pizzaScheibe(g, 128, 190, 96, 0);
      g.fillStyle = '#fff6df'; g.beginPath(); g.moveTo(50, 150); g.quadraticCurveTo(128, 230, 210, 140); g.lineTo(220, 170); g.quadraticCurveTo(128, 270, 40, 180); g.closePath(); g.fill();
      linie(g, [60, 170, 196, 160], '#e9dcc0', 4); linie(g, [56, 196, 204, 186], '#e9dcc0', 4);
      augen(g, 128, 150, 30, 15, true);
      g.fillStyle = '#2a1712'; g.beginPath(); g.moveTo(84, 184); g.quadraticCurveTo(128, 160, 172, 184); g.quadraticCurveTo(128, 176, 84, 184); g.fill();
      oval(g, 128, 202, 16, 10, '#5a1410');
      for (var i = 0; i < 9; i++) { var a = Math.PI + 0.25 + i * 0.33; oval(g, 128 + Math.cos(a) * 88, 110 + Math.sin(a) * 40, 16, 8, i % 2 ? '#3b8c36' : '#56a84a', a + Math.PI / 2); }
      linie(g, [228, 260, 238, 70], '#8a6a2a', 7); kreis(g, 238, 60, 22, '#d7d7d7'); kreis(g, 238, 60, 6, '#8a6a2a');
      kreis(g, 26, 236, 30, '#e3b440'); g.fillStyle = '#7a1510'; g.font = 'bold 18px system-ui,sans-serif'; g.textAlign = 'center'; g.fillText('SPQR', 26, 242);
    },
    fleischball: function (g, b, h, bild) {
      var s = bild % 2 ? 1 : -1;
      linie(g, [48, 100, 42 + s * 8, 124], '#2a1c12', 6); linie(g, [80, 100, 86 - s * 8, 124], '#2a1c12', 6);
      kreis(g, 64, 64, 46, '#7a3d22'); for (var i = 0; i < 7; i++) kreis(g, 64 + Math.cos(i) * 28, 64 + Math.sin(i * 1.7) * 26, 8, '#5d2c17');
      augen(g, 64, 52, 15, 9, false); oval(g, 64, 80, 12, 5, '#3a140b');
    },
    vespa: function (g) {
      kreis(g, 30, 96, 18, '#1d1d1d'); kreis(g, 98, 96, 18, '#1d1d1d'); kreis(g, 30, 96, 7, '#bdbdbd'); kreis(g, 98, 96, 7, '#bdbdbd');
      g.fillStyle = '#7fd0b8'; g.beginPath(); g.moveTo(14, 90); g.quadraticCurveTo(20, 50, 60, 64); g.lineTo(112, 64); g.quadraticCurveTo(122, 90, 110, 92); g.closePath(); g.fill();
      linie(g, [20, 70, 12, 30], '#4a4a4a', 5); linie(g, [4, 30, 20, 30], '#4a4a4a', 5);
      pizzaScheibe(g, 80, 38, 24, 2); augen(g, 80, 32, 8, 5, false);
    },
    nonna: function (g) {
      kreis(g, 128, 60, 44, '#c9c6c2'); kreis(g, 128, 150, 104, '#e8b996');
      oval(g, 128, 64, 112, 42, '#d9d6d2');
      kreis(g, 84, 140, 26, '#ffffff'); kreis(g, 172, 140, 26, '#ffffff'); linie(g, [110, 140, 146, 140], '#6d6d6d', 5);
      g.strokeStyle = '#6d6d6d'; g.lineWidth = 5; g.beginPath(); g.arc(84, 140, 26, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(172, 140, 26, 0, Math.PI * 2); g.stroke();
      kreis(g, 86, 142, 9, '#3a2a20'); kreis(g, 170, 142, 9, '#3a2a20');
      kreis(g, 70, 190, 18, 'rgba(230,110,110,0.5)'); kreis(g, 186, 190, 18, 'rgba(230,110,110,0.5)');
      oval(g, 128, 210, 36, 26, '#6a1c18'); oval(g, 128, 222, 22, 10, '#c9494f');
    },
    sonne: function (g) {
      pizzaScheibe(g, 128, 128, 120, 0);
      g.fillStyle = '#111'; g.fillRect(56, 88, 60, 30); g.fillRect(140, 88, 60, 30); g.fillRect(110, 94, 36, 8);
      oval(g, 128, 168, 34, 14, '#5a1410');
    },
    muenze: function (g) { kreis(g, 32, 32, 30, '#b8860b'); kreis(g, 32, 32, 25, '#f5c542'); g.fillStyle = '#b8860b'; g.font = 'bold 26px system-ui,sans-serif'; g.textAlign = 'center'; g.fillText('L', 32, 42); }
  };
  var GROESSE = { pizza: [128, 160], legionaer: [128, 176], kakerlake: [128, 160], fuehrerin: [128, 160], boss: [256, 320], fleischball: [128, 128], vespa: [128, 120], nonna: [256, 256], sonne: [256, 256], muenze: [64, 64] };

  R.weltErweiterungen.push(function (w) {
    var T = w.T, ROM = X.ROM, scene = w.scene;
    var ev = null, lage = null, gebaut = false, ruhig = false, zielId = null, gesammelt = {}, poseBis = 0, pose = 0, zeitquelle = null;
    function uhr(sonst) { return zeitquelle ? zeitquelle() : sonst !== undefined ? sonst : w.uhr(); }
    var eigen = { geo: [], mat: [], tex: [] };
    var gruppe = new T.Group(); gruppe.name = 'rom-event'; gruppe.visible = false; scene.add(gruppe);
    var texCache = {}, blasenCache = {};
    var lichtAn = null, lichtUhr = 0, trefferZeit = 0, lastHaltung = -1;

    function g(x) { eigen.geo.push(x); return x; }
    function m(x) { eigen.mat.push(x); return x; }
    function bild(name, n) {
      var key = name + ':' + (n || 0);
      if (!texCache[key]) {
        var gr = GROESSE[name];
        texCache[key] = leinwand(T, gr[0], gr[1], function (ctx, b, h) { MALER[name](ctx, b, h, n || 0); });
        eigen.tex.push(texCache[key]);
      }
      return texCache[key];
    }
    function sprite(tex, hoehe, eltern) {
      var s = new T.Sprite(m(new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })));
      s.center.set(0.5, 0); s.scale.set(hoehe * tex.userData.seite, hoehe, 1); s.userData.hoehe = hoehe;
      (eltern || gruppe).add(s); return s;
    }
    function textBild(text, farbe, grund) {
      var key = text + '|' + farbe + '|' + grund;
      if (blasenCache[key]) return blasenCache[key];
      var probe = document.createElement('canvas').getContext('2d'); probe.font = 'bold 30px system-ui,sans-serif';
      var b = Math.min(512, Math.ceil(probe.measureText(text).width) + 44);
      var t = leinwand(T, b, 84, function (ctx) {
        ctx.fillStyle = grund || '#ffffff'; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 3;
        ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(3, 3, b - 6, 56, 18); else ctx.rect(3, 3, b - 6, 56); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(b / 2 - 12, 58); ctx.lineTo(b / 2, 80); ctx.lineTo(b / 2 + 12, 58); ctx.fill();
        ctx.fillStyle = farbe || '#1d1410'; ctx.font = 'bold 30px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, b / 2, 31);
      });
      eigen.tex.push(t); blasenCache[key] = t; return t;
    }
    function blase(s, text, hoehe, farbe, grund) {
      if (!text) { s.visible = false; return; }
      var t = textBild(text, farbe, grund);
      if (s.material.map !== t) { s.material.map = t; s.material.needsUpdate = true; }
      s.scale.set(hoehe * t.userData.seite, hoehe, 1); s.visible = true;
    }
    function mesh(eltern, geometrie, farbe, x, y, z, glanz) {
      var mt = m(new T.MeshStandardMaterial({ color: farbe, roughness: 0.75, metalness: 0.05, emissive: glanz || '#000000', emissiveIntensity: glanz ? 0.9 : 0 }));
      var me = new T.Mesh(geometrie, mt); me.position.set(x || 0, y || 0, z || 0); me.castShadow = true; me.receiveShadow = true; eltern.add(me); return me;
    }

    /* --------------------------------------------------- Kulisse */
    var teile = { partikel: [] };
    /* Der Three.js-Build des Hideouts (src/vendor/three-entry.js) kennt kein
       InstancedMesh. Gleichartige Teile werden darum zu einer einzigen
       Geometrie verschmolzen - fuer die Grafikkarte genauso ein Aufruf. */
    var OBEN = null;
    function transformation(x, y, z, drehY, sx, sy, sz) {
      OBEN = OBEN || new T.Vector3(0, 1, 0);
      return new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromAxisAngle(OBEN, drehY || 0), new T.Vector3(sx || 1, sy || 1, sz || 1));
    }
    function verschmelzen(stuecke) {
      var liste = stuecke.map(function (st) {
        var neu = st.geo.clone(); neu.applyMatrix4(st.m);
        if (st.farbe) {
          var n = neu.attributes.position.count, f = new Float32Array(n * 3), c = new T.Color(st.farbe);
          for (var i = 0; i < n; i++) { f[i * 3] = c.r; f[i * 3 + 1] = c.g; f[i * 3 + 2] = c.b; }
          neu.setAttribute('color', new T.Float32BufferAttribute(f, 3));
        }
        return neu;
      });
      var ganz = T.mergeGeometries(liste, false);
      liste.forEach(function (x) { x.dispose(); });
      return g(ganz);
    }
    function scheibe(r, von, laenge) { return g(new T.CylinderGeometry(r, r, 0.08, 40, 1, false, von || 0, laenge || Math.PI * 2)); }
    function bauen() {
      if (gebaut) return; gebaut = true;
      teile.kulisse = new T.Group(); gruppe.add(teile.kulisse);
      /* Saeulen entlang der Wege und um die Piazza */
      var orte = [];
      for (var x = -16; x <= 16; x += 8) { orte.push([x, 20]); orte.push([x, 40]); }
      for (var i = 0; i < 6; i++) { var a = i / 6 * Math.PI * 2 + 0.3; orte.push([ROM.PIAZZA.x + Math.cos(a) * 16, ROM.PIAZZA.z + Math.sin(a) * 16]); }
      var schaft = new T.CylinderGeometry(0.55, 0.7, 7, 10), kapitell = new T.BoxGeometry(1.8, 0.55, 1.8), stuecke = [];
      orte.forEach(function (o) {
        stuecke.push({ geo: schaft, m: transformation(o[0], 3.5, o[1]) }, { geo: kapitell, m: transformation(o[0], 7.2, o[1]) }, { geo: kapitell, m: transformation(o[0], 0.28, o[1]) });
      });
      var saeulen = new T.Mesh(verschmelzen(stuecke), m(new T.MeshStandardMaterial({ color: '#efe8da', roughness: 0.6 })));
      saeulen.castShadow = true; teile.kulisse.add(saeulen);
      schaft.dispose(); kapitell.dispose();
      /* Wimpel zwischen den Saeulen in Gruen, Weiss und Rot */
      var dreieck = new T.BufferGeometry(); dreieck.setAttribute('position', new T.Float32BufferAttribute([-0.45, 0, 0, 0.45, 0, 0, 0, -0.9, 0], 3)); dreieck.computeVertexNormals();
      var paare = [[0, 2], [2, 4], [4, 6], [6, 8], [1, 3], [3, 5], [5, 7], [7, 9]], farben = ['#1b8a3c', '#ffffff', '#c92a2a'], wimpel = [], k = 0;
      paare.forEach(function (p) {
        var a0 = orte[p[0]], a1 = orte[p[1]];
        for (var j = 1; j <= 7; j++) {
          var t = j / 8;
          wimpel.push({ geo: dreieck, farbe: farben[k++ % 3], m: transformation(a0[0] + (a1[0] - a0[0]) * t, 7.1 - Math.sin(t * Math.PI) * 1.2, a0[1] + (a1[1] - a0[1]) * t, Math.atan2(a1[0] - a0[0], a1[1] - a0[1]) + Math.PI / 2) });
        }
      });
      teile.kulisse.add(new T.Mesh(verschmelzen(wimpel), m(new T.MeshBasicMaterial({ vertexColors: true, side: T.DoubleSide }))));
      dreieck.dispose();
      /* Aus der Arena wird das Kolosseum: zwei Reihen Boegen, oben eine Ruine. */
      var K = ROM.KOLOSSEUM, segmente = 36, pfeiler = new T.BoxGeometry(1.7, 6, 1.7), balken = new T.BoxGeometry(1, 1.1, 1.8);
      var tor = Math.atan2(1, 0), sehne = 2 * K.radius * Math.sin(Math.PI / segmente), steine = [], n = 0;
      for (var sg = 0; sg < segmente; sg++) {
        var w1 = sg / segmente * Math.PI * 2;
        if (Math.abs(Math.atan2(Math.sin(w1 - tor), Math.cos(w1 - tor))) < 0.3) continue;
        var px = K.x + Math.cos(w1) * K.radius, pz = K.z + Math.sin(w1) * K.radius, oben = n++ % 5 !== 2 && w1 < Math.PI * 1.3;
        var mw = w1 + Math.PI / segmente, mx = K.x + Math.cos(mw) * K.radius, mz = K.z + Math.sin(mw) * K.radius;
        steine.push({ geo: pfeiler, m: transformation(px, 3, pz, -w1) }, { geo: balken, m: transformation(mx, 6.2, mz, -mw, 1, 1, sehne) });
        if (oben) steine.push({ geo: pfeiler, m: transformation(px, 9, pz, -w1) }, { geo: balken, m: transformation(mx, 12.2, mz, -mw, 1, 1, sehne) });
      }
      var kolosseum = new T.Mesh(verschmelzen(steine), m(new T.MeshStandardMaterial({ color: '#dcc39a', roughness: 0.9 })));
      kolosseum.castShadow = true; teile.kulisse.add(kolosseum);
      pfeiler.dispose(); balken.dispose();
      /* Der Trevi-Brunnen am Nordrand der Piazza */
      var tr = ROM.TREVI; teile.trevi = new T.Group(); teile.trevi.position.set(tr.x, 0, tr.z); teile.kulisse.add(teile.trevi);
      mesh(teile.trevi, g(new T.BoxGeometry(17, 9, 2)), '#e7dcc6', 0, 4.5, 4);
      mesh(teile.trevi, g(new T.BoxGeometry(18.5, 1.2, 2.6)), '#d8caa9', 0, 9.4, 4);
      [-5, 0, 5].forEach(function (x2) { mesh(teile.trevi, g(new T.BoxGeometry(3, 5, 0.6)), '#b9aa8b', x2, 4, 2.8); });
      mesh(teile.trevi, g(new T.ConeGeometry(1.2, 3.4, 8)), '#e3c46a', 0, 3.2, 2.2);
      mesh(teile.trevi, g(new T.SphereGeometry(0.8, 10, 8)), '#e3c46a', 0, 5.4, 2.2);
      /* Becken und Wasser als Halbkreis zur Piazza hin (in CylinderGeometry ist z = r mal cos). */
      mesh(teile.trevi, g(new T.CylinderGeometry(7.2, 7.4, 1, 28, 1, true, Math.PI / 2, Math.PI)), '#d8caa9', 0, 0.5, 2.5);
      var wasser = new T.Mesh(g(new T.CylinderGeometry(7, 7, 0.1, 28, 1, false, Math.PI / 2, Math.PI)), m(new T.MeshStandardMaterial({ color: '#56c7ea', emissive: '#1b6f8f', emissiveIntensity: 0.6, transparent: true, opacity: 0.85 })));
      wasser.position.set(0, 0.7, 2.5); teile.trevi.add(wasser);
      /* Die Piazza: Pflaster, Lichterketten, Cafe-Tische */
      var pflaster = leinwand(T, 256, 256, function (ctx) {
        ctx.fillStyle = '#b89e7c'; ctx.fillRect(0, 0, 256, 256);
        for (var yy = 0; yy < 256; yy += 16) for (var xx = (yy / 16) % 2 ? 0 : -8; xx < 256; xx += 16) { ctx.fillStyle = ['#c9b08c', '#a88f6e', '#bfa37f'][(xx + yy) % 3 === 0 ? 0 : (xx * 7 + yy) % 2 ? 1 : 2]; ctx.fillRect(xx + 1, yy + 1, 14, 14); }
      });
      pflaster.wrapS = pflaster.wrapT = T.RepeatWrapping; pflaster.repeat.set(4, 4); eigen.tex.push(pflaster);
      var stein2 = m(new T.MeshStandardMaterial({ color: '#a88f6e', roughness: 0.95 }));
      var boden = new T.Mesh(scheibe(ROM.PIAZZA.radius), [stein2, m(new T.MeshStandardMaterial({ map: pflaster, roughness: 0.95 })), stein2]);
      boden.position.set(ROM.PIAZZA.x, 0.06, ROM.PIAZZA.z); boden.receiveShadow = true; teile.kulisse.add(boden);
      var kugel0 = new T.SphereGeometry(0.22, 6, 4), birnen = [];
      for (var n2 = 0; n2 < 48; n2++) {
        var kette = Math.floor(n2 / 12), t2 = (n2 % 12 + 0.5) / 12, w2 = kette * Math.PI / 4;
        var ax = ROM.PIAZZA.x + Math.cos(w2) * 13, az = ROM.PIAZZA.z + Math.sin(w2) * 13, bx = ROM.PIAZZA.x - Math.cos(w2) * 13, bz = ROM.PIAZZA.z - Math.sin(w2) * 13;
        birnen.push({ geo: kugel0, m: transformation(ax + (bx - ax) * t2, 7 - Math.sin(t2 * Math.PI) * 2.2, az + (bz - az) * t2) });
      }
      teile.kulisse.add(new T.Mesh(verschmelzen(birnen), m(new T.MeshBasicMaterial({ color: '#ffe79a' }))));
      kugel0.dispose();
      [[18, 30], [42, 32], [40, 46]].forEach(function (p) {
        mesh(teile.kulisse, g(new T.CylinderGeometry(1, 1, 0.15, 12)), '#f4efe6', p[0], 1.1, p[1]);
        mesh(teile.kulisse, g(new T.CylinderGeometry(0.1, 0.1, 3.4, 6)), '#6b6b6b', p[0], 1.7, p[1]);
        var schirm = mesh(teile.kulisse, g(new T.ConeGeometry(2.2, 0.9, 12)), ['#1b8a3c', '#ffffff', '#c92a2a'][Math.abs(p[0] + p[1]) % 3], p[0], 3.5, p[1]);
        schirm.castShadow = true;
      });
      /* Wegweiser, mit denen die Pizzen diskutieren */
      teile.schilder = [[-4, 26, 'ROMA →'], [20, 18, 'COLOSSEO'], [44, 42, 'PIAZZA']].map(function (sch) {
        mesh(teile.kulisse, g(new T.CylinderGeometry(0.15, 0.15, 4, 6)), '#6d4a2a', sch[0], 2, sch[1]);
        var tafel = sprite(textBild(sch[2], '#ffffff', '#2f6e3a'), 1.6, teile.kulisse); tafel.position.set(sch[0], 3.4, sch[1]);
        var antwort = sprite(textBild('…', '#1d1410', '#ffffff'), 1.4); antwort.position.set(sch[0], 5.4, sch[1]); antwort.visible = false;
        return { x: sch[0], z: sch[1], antwort: antwort };
      });
      teile.kulisse.position.y = -10;

      /* --------------------------------------------------- Figuren */
      teile.pizzen = []; for (var p1 = 0; p1 < 8; p1++) { var ps = sprite(bild('pizza', 0), 3.4); ps.visible = false; var bl = sprite(textBild('…'), 1.1); bl.visible = false; teile.pizzen.push({ s: ps, blase: bl, bild: -1 }); }
      teile.zielring = new T.Mesh(g(new T.TorusGeometry(2.2, 0.16, 6, 28)), m(new T.MeshBasicMaterial({ color: '#ffe066' }))); teile.zielring.rotation.x = Math.PI / 2; teile.zielring.visible = false; gruppe.add(teile.zielring);
      /* Der Pizza-Triumphwagen: eine haushohe Pizza als Rad, zwei Fleischbaellchen davor */
      teile.wagen = new T.Group(); gruppe.add(teile.wagen);
      var radTex = bild('sonne', 0);
      var rad = new T.Mesh(g(new T.CylinderGeometry(4.2, 4.2, 0.9, 30)), [m(new T.MeshStandardMaterial({ color: '#d38f45', roughness: 0.9 })), m(new T.MeshStandardMaterial({ map: radTex })), m(new T.MeshStandardMaterial({ map: radTex }))]);
      rad.rotation.z = Math.PI / 2; rad.position.y = 4.4; rad.castShadow = true; teile.wagen.add(rad); teile.rad = rad;
      teile.baelle = [0, 1].map(function () { return sprite(bild('fleischball', 0), 2.6, teile.wagen); });
      teile.legion = []; for (var l1 = 0; l1 < 6; l1++) { var ls = sprite(bild('legionaer', 0), 3.6); ls.visible = false; teile.legion.push(ls); }
      /* Die Sombrero-Reisegruppe */
      teile.tassen = new T.Group(); gruppe.add(teile.tassen);
      for (var c1 = 0; c1 < 6; c1++) {
        var cw = c1 / 6 * Math.PI * 2, cx = ROM.PIAZZA.x + Math.cos(cw) * 6, cz = ROM.PIAZZA.z + Math.sin(cw) * 6;
        mesh(teile.tassen, g(new T.CylinderGeometry(1.4, 1.6, 0.25, 16)), '#ffffff', cx, 0.15, cz);
        mesh(teile.tassen, g(new T.CylinderGeometry(1, 0.8, 1.4, 16)), '#fbfbfb', cx, 0.95, cz);
        mesh(teile.tassen, g(new T.CylinderGeometry(0.92, 0.92, 0.05, 16)), '#4a2a16', cx, 1.62, cz);
      }
      teile.kakerlaken = []; for (var k1 = 0; k1 < 12; k1++) { var ks = sprite(bild('kakerlake', 4), 2.5); ks.visible = false; teile.kakerlaken.push(ks); }
      /* Und weil Rom kaputt ist, tanzen sie ueberall: je drei an jedem Tanzplatz. */
      teile.tanzende = [];
      ROM.TANZPLAETZE.forEach(function (tp, j) {
        for (var k2 = 0; k2 < 3; k2++) { var ts = sprite(bild('kakerlake', 4), 2.3); ts.visible = false; ts.userData.platz = tp; ts.userData.nr = j * 3 + k2; teile.tanzende.push(ts); }
      });
      teile.fuehrerin = sprite(bild('fuehrerin', 0), 2.9); teile.fuehrerin.visible = false;
      teile.fuehrerinBlase = sprite(textBild('ROMA 3 GIORNI!'), 1.2); teile.fuehrerinBlase.visible = false;
      teile.sombrero = new T.Group(); gruppe.add(teile.sombrero);
      mesh(teile.sombrero, g(new T.CylinderGeometry(6, 6, 0.4, 24)), '#f2c230', 0, 0, 0);
      mesh(teile.sombrero, g(new T.ConeGeometry(2.6, 4.2, 18)), '#f2c230', 0, 2.1, 0);
      mesh(teile.sombrero, g(new T.CylinderGeometry(2.3, 2.3, 0.6, 18)), '#c92a2a', 0, 0.9, 0);
      /* Imperatore Mozzarellus auf seinem Espresso-Streitwagen */
      teile.boss = new T.Group(); gruppe.add(teile.boss);
      mesh(teile.boss, g(new T.BoxGeometry(5, 2.2, 3.4)), '#5a3420', 0, 1.6, 0);
      mesh(teile.boss, g(new T.CylinderGeometry(1.6, 1.6, 0.4, 16)), '#2a1a12', 0, 2.8, 0);
      [-1.9, 1.9].forEach(function (z2) { var r2 = mesh(teile.boss, g(new T.CylinderGeometry(1.2, 1.2, 0.4, 14)), '#e3b440', -1.4, 1.2, z2); r2.rotation.x = Math.PI / 2; });
      teile.bossBild = sprite(bild('boss', 0), 11, teile.boss); teile.bossBild.position.y = 2.4;
      teile.vespas = [0, 1].map(function () { return sprite(bild('vespa', 0), 2.8, teile.boss); });
      teile.haltung = sprite(textBild('🧀 Käsepanzer', '#1d1410', '#fff3c4'), 1.8, teile.boss); teile.haltung.position.y = 14.2;
      teile.lorbeer = new T.Mesh(g(new T.TorusGeometry(2.2, 0.35, 6, 20)), m(new T.MeshStandardMaterial({ color: '#3b8c36' }))); teile.lorbeer.visible = false; gruppe.add(teile.lorbeer);
      teile.fallschirm = []; for (var f1 = 0; f1 < 4; f1++) { var fs = sprite(bild('legionaer', 1), 3); fs.visible = false; teile.fallschirm.push(fs); }
      teile.pfuetze = new T.Mesh(scheibe(1), m(new T.MeshStandardMaterial({ color: '#fff4cf', roughness: 0.4 }))); teile.pfuetze.visible = false; gruppe.add(teile.pfuetze);
      /* Ueberraschungen und Finale */
      teile.nonna = sprite(bild('nonna', 0), 30); teile.nonna.visible = false;
      teile.nonnaBlase = sprite(textBild('MANGIA!', '#c92a2a', '#ffffff'), 5); teile.nonnaBlase.visible = false;
      teile.stampede = []; for (var v1 = 0; v1 < 5; v1++) { var vs = sprite(bild('vespa', 0), 3); vs.visible = false; teile.stampede.push(vs); }
      teile.himmelspizza = sprite(bild('sonne', 0), 40); teile.himmelspizza.center.set(0.5, 0.5); teile.himmelspizza.visible = false;
      /* Partikel aus einem Topf: Wasser, Muenzen, Nudeln, Feuerwerk, Kaese */
      teile.partikel = [];
      var kugel = g(new T.SphereGeometry(0.22, 6, 4)), stab = g(new T.CylinderGeometry(0.07, 0.07, 1.2, 4)), partikelScheibe = g(new T.CylinderGeometry(0.35, 0.35, 0.08, 10));
      teile.pgeo = { kugel: kugel, stab: stab, scheibe: partikelScheibe, ei: g(new T.SphereGeometry(0.45, 10, 8)) };
      teile.pmat = {};
      ['#8fdcf5', '#f5c542', '#f1d27a', '#1b8a3c', '#ffffff', '#c92a2a', '#fff4cf', '#d63b27', '#6b3b1f'].forEach(function (f) { teile.pmat[f] = m(new T.MeshBasicMaterial({ color: f })); });
    }

    /* -------------------------------------------------- Partikel */
    function partikel(art, farbe, x, y, z, vx, vy, vz, leben, schwer) {
      var max = ruhig ? 40 : 140;
      /* Eier kommen immer durch - die sind zum Fangen da. */
      if (teile.partikel.length >= max && art !== 'ei') return;
      var me = new T.Mesh(teile.pgeo[art], teile.pmat[farbe]); me.position.set(x, y, z);
      if (art === 'stab') me.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      if (art === 'ei') me.scale.set(1, 1.35, 1);
      gruppe.add(me);
      teile.partikel.push({ m: me, vx: vx, vy: vy, vz: vz, leben: leben, schwer: schwer === undefined ? 9 : schwer, dreh: Math.random() * 6 - 3 });
    }
    function partikelSchritt(dt) {
      teile.partikel = teile.partikel.filter(function (p) {
        p.leben -= dt; p.vy -= p.schwer * dt;
        p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt; p.m.rotation.y += p.dreh * dt;
        if (p.leben <= 0 || p.m.position.y < -1) { gruppe.remove(p.m); return false; }
        return true;
      });
    }
    function allePartikelWeg() { teile.partikel.forEach(function (p) { gruppe.remove(p.m); }); teile.partikel = []; }

    /* ---------------------------------------------------- Takt */
    var LICHT = { abend: ['#4a3342', '#ffd6b8', '#ffb46b', 3], boss: ['#4d2b2f', '#ffd0b0', '#ff9e6b', 2.9], turbo: ['#3b2130', '#ffe0c0', '#ff7a2e', 3.1], fest: ['#2c2446', '#e6c8ff', '#ffc98a', 2.6] };
    var P = ROM.P, VORBEI = ROM.VORBEI;
    var SPRUECHE = ['Ananas? MAI!', 'Mamma mia!', 'Dov’è il Colosseo?', 'Ich bin eine Quattro Stagioni!', 'Wo ist mein Basilikum?', 'Wer hat mich halbiert?'];
    var ANTWORTEN = ['Io sono un cartello.', 'Links. Immer links.', 'Keine Pizzen hier!', '…'];
    function aus(liste) { liste.forEach(function (s) { s.visible = false; }); }
    function sichtbarkeit(nr) {
      teile.wagen.visible = nr === P.rebellion; teile.tassen.visible = nr === P.invasion || nr === P.turbo; teile.sombrero.visible = nr === P.invasion; teile.boss.visible = nr === P.imperator;
      if (nr !== P.turbo) teile.tassen.position.y = 0;
      if (nr !== P.rebellion) aus(teile.legion);
      if (nr !== P.invasion) { teile.fuehrerin.visible = false; teile.fuehrerinBlase.visible = false; }
      if (!ROM.PIZZA_ANZAHL[nr]) { teile.pizzen.forEach(function (p) { p.s.visible = false; p.blase.visible = false; }); teile.zielring.visible = false; teile.schilder.forEach(function (s) { s.antwort.visible = false; }); }
      if (nr !== P.imperator) { aus(teile.fallschirm); teile.lorbeer.visible = false; }
      if (nr !== P.trevi) teile.himmelspizza.visible = false;
    }
    function pizzenSchritt(jetzt, zeit, nr) {
      var liste = ROM.pizzen(ev, jetzt), beine = nr === P.turbo ? 18 : 6;
      teile.pizzen.forEach(function (eintrag, i) {
        var pz = liste[i];
        if (!pz) { eintrag.s.visible = false; eintrag.blase.visible = false; return; }
        var schritt = Math.floor(zeit * beine) % 2, b = pz.sorte * 2 + schritt;
        if (eintrag.bild !== b) { eintrag.s.material.map = bild('pizza', b); eintrag.s.material.needsUpdate = true; eintrag.bild = b; }
        eintrag.s.visible = true; eintrag.s.position.set(pz.x, 0.15 + Math.abs(Math.sin(zeit * 9 + i)) * 0.35, pz.z);
        eintrag.s.material.opacity = gesammelt[pz.id] ? 0.45 : 1; eintrag.id = pz.id;
        /* An einem Wegweiser wird diskutiert. */
        var schild = teile.schilder.find(function (s) { return Math.hypot(s.x - pz.x, s.z - pz.z) < 7; });
        if (schild) {
          blase(eintrag.blase, SPRUECHE[Math.floor(ROM.wurf(ev, 'spruch:' + pz.id) * SPRUECHE.length)], 1.1);
          eintrag.blase.position.set(pz.x, 4.4, pz.z);
          blase(schild.antwort, ANTWORTEN[Math.floor(ROM.wurf(ev, 'antwort:' + pz.id) * ANTWORTEN.length)], 1.2);
        } else eintrag.blase.visible = false;
        if (!ruhig && Math.random() < 0.02) partikel('kugel', Math.random() < 0.5 ? '#d63b27' : '#f1d27a', pz.x, 1.2, pz.z, (Math.random() - 0.5) * 3, 3, (Math.random() - 0.5) * 3, 1.2);
      });
      teile.schilder.forEach(function (s) { if (!liste.some(function (pz) { return Math.hypot(s.x - pz.x, s.z - pz.z) < 7; })) s.antwort.visible = false; });
      var ziel = zielId && liste.find(function (pz) { return pz.id === zielId; });
      teile.zielring.visible = !!ziel;
      if (ziel) { teile.zielring.position.set(ziel.x, 0.25, ziel.z); teile.zielring.rotation.z = zeit * 2; }
    }
    function wagenSchritt(jetzt, zeit) {
      var o = ROM.wagenOrt(ev, jetzt);
      teile.wagen.position.set(o.x, 0, o.z); teile.wagen.rotation.y = o.heading - Math.PI / 2;
      teile.rad.rotation.x -= 0.05;
      teile.baelle.forEach(function (b, i) { b.position.set(6.5, Math.abs(Math.sin(zeit * 8 + i)) * 0.6, i ? 1.6 : -1.6); if (b.material.map !== bild('fleischball', Math.floor(zeit * 6) % 2)) { b.material.map = bild('fleischball', Math.floor(zeit * 6) % 2); b.material.needsUpdate = true; } });
      /* Die Legion stolpert: alle sieben Sekunden faellt einer um, einer laeuft immer verkehrt. */
      var fall = Math.floor(zeit / 7) % 6, faellt = (zeit % 7) < 1.2;
      teile.legion.forEach(function (s, i) {
        var l = ROM.legionaerOrt(ev, jetzt, i); s.visible = true;
        var b = Math.floor(zeit * 5 + i) % 2; if (s.material.map !== bild('legionaer', b)) { s.material.map = bild('legionaer', b); s.material.needsUpdate = true; }
        var quer = i === 5 ? Math.sin(zeit * 1.3) * 3 : 0;
        s.position.set(l.x + Math.cos(l.heading) * quer, 0.15 + Math.abs(Math.sin(zeit * 8 + i)) * 0.25, l.z - Math.sin(l.heading) * quer);
        s.material.rotation = i === fall && faellt ? Math.PI / 2 : (i === 5 ? Math.sin(zeit * 4) * 0.2 : 0);
      });
    }
    /* Die Kakerlaken tanzen das ganze Event ueber: zwoelf auf der Piazza,
       der Rest an den Tanzplaetzen der Insel. Zeigt die Sombrero-Invasion
       eine Tanzfolge vor, macht die ganze Insel dieselbe Pose. */
    function kakerlakenSchritt(jetzt, zeit, nr) {
      var p = ROM.PIAZZA, zt = zeit * (nr === P.turbo ? 2.6 : 1), zeigt = jetzt < poseBis;
      function tanzbild(s, i) {
        var b = zeigt ? pose : (Math.floor(zt * 2 + (i % 2)) % 2) + 4;
        if (s.userData.b !== b) { s.material.map = bild('kakerlake', b); s.material.needsUpdate = true; s.userData.b = b; }
      }
      teile.kakerlaken.forEach(function (s, i) {
        s.visible = true; tanzbild(s, i);
        if (nr === P.trevi) {
          /* Im Finale tanzen sie auf dem Beckenrand des Brunnens. */
          var fw = Math.PI + (i + 0.5) / 12 * Math.PI;
          s.position.set(ROM.TREVI.x + Math.cos(fw) * 7.2, 1.1 + Math.abs(Math.sin(zt * 6 + i)) * 0.5, ROM.TREVI.z + 2.5 - Math.sin(fw) * 7.2);
          return;
        }
        if (i < 6) {
          /* Stehen die Espressotassen da, tanzen sechs auf ihnen, sonst im Kreis. */
          var aufTassen = nr === P.invasion || nr === P.turbo, cw = i / 6 * Math.PI * 2 + (aufTassen ? 0 : zt * 0.3);
          s.position.set(p.x + Math.cos(cw) * 6, (aufTassen ? 1.65 : 0.15) + Math.abs(Math.sin(zt * 4 + i)) * 0.6, p.z + Math.sin(cw) * 6);
        } else {
          var pw = zt * 0.5 - (i - 6) * 0.28;
          s.position.set(p.x + Math.cos(pw) * 11, 0.15 + Math.abs(Math.sin(zt * 7 + i)) * 0.35, p.z + Math.sin(pw) * 11);
        }
      });
      teile.tanzende.forEach(function (s) {
        var tp = s.userData.platz, n = s.userData.nr, a = (n % 3) / 3 * Math.PI * 2 + zt * (n % 2 ? 0.9 : -0.9);
        s.visible = true; tanzbild(s, n);
        s.position.set(tp.x + Math.cos(a) * tp.r, 0.15 + Math.abs(Math.sin(zt * 5 + n)) * 0.5, tp.z + Math.sin(a) * tp.r);
      });
      if (nr === P.invasion) {
        var fw2 = zt * 0.5 + 0.35;
        teile.fuehrerin.visible = true; teile.fuehrerin.position.set(p.x + Math.cos(fw2) * 11, 0.15, p.z + Math.sin(fw2) * 11);
        blase(teile.fuehrerinBlase, Math.floor(zeit / 6) % 2 ? 'POLONAISE! Alle hinter mir!' : 'ROMA 3 GIORNI!', 1.2);
        teile.fuehrerinBlase.position.set(teile.fuehrerin.position.x, 4.1, teile.fuehrerin.position.z);
        teile.sombrero.position.set(X.LEUCHTTURM.x, w.leuchtturmHoehe(), X.LEUCHTTURM.z); teile.sombrero.rotation.y = zeit * 0.4;
      }
    }
    /* Espresso-Overdrive: die Tassen huepfen und spritzen, Tomaten fliegen. */
    function turboSchritt(jetzt, zeit) {
      var p = ROM.PIAZZA;
      teile.tassen.position.y = Math.abs(Math.sin(zeit * 10)) * 0.4;
      if (!ruhig || Math.random() < 0.3) {
        var cw = Math.floor(Math.random() * 6) / 6 * Math.PI * 2;
        partikel('kugel', '#6b3b1f', p.x + Math.cos(cw) * 6, 1.8, p.z + Math.sin(cw) * 6, (Math.random() - 0.5) * 4, 8 + Math.random() * 4, (Math.random() - 0.5) * 4, 1.4);
        if (Math.random() < 0.5) { var sp = w.spieler(); partikel('scheibe', '#d63b27', sp.x + (Math.random() - 0.5) * 26, 16, sp.z + (Math.random() - 0.5) * 26, 0, -6, 0, 2.5, 6); }
      }
    }
    function bossSchritt(jetzt, zeit, dt) {
      var o = ROM.bossOrt(ev, jetzt), boss = lage && lage.boss, anteil = boss && boss.max ? boss.hp / boss.max : 1, besiegt = !!(boss && boss.besiegt);
      teile.boss.position.set(o.x, 0, o.z); teile.boss.rotation.y = o.heading - Math.PI / 2;
      teile.vespas.forEach(function (v, i) { v.position.set(4.6, Math.abs(Math.sin(zeit * 9 + i)) * 0.3, i ? 1.5 : -1.5); });
      var h = ROM.haltung(ev, jetzt), hi = ROM.HALTUNGEN.indexOf(h);
      if (hi !== lastHaltung) { lastHaltung = hi; blase(teile.haltung, h.zeichen + ' ' + h.name, 1.8, '#1d1410', '#fff3c4'); }
      var wackeln = !ruhig && zeit - trefferZeit < 0.3 ? Math.sin(zeit * 60) * 0.3 : 0;
      if (besiegt) {
        /* Er schmilzt zu einem Kaesebrunnen. */
        teile.bossBild.scale.y = Math.max(0.5, teile.bossBild.scale.y - dt * 4); teile.bossBild.material.opacity = Math.max(0, teile.bossBild.material.opacity - dt * 0.4);
        teile.pfuetze.visible = true; teile.pfuetze.position.set(o.x, 0.12, o.z); teile.pfuetze.scale.setScalar(Math.min(7, teile.pfuetze.scale.x + dt * 3));
        teile.haltung.visible = false;
        if (Math.random() < 0.3) partikel('scheibe', '#d63b27', o.x + (Math.random() - 0.5) * 30, 25, o.z + (Math.random() - 0.5) * 30, 0, 0, 0, 4, 4);
      } else {
        teile.bossBild.scale.set(11 * teile.bossBild.material.map.userData.seite, 11, 1); teile.bossBild.material.opacity = 1; teile.bossBild.position.x = wackeln;
        teile.pfuetze.visible = false; teile.pfuetze.scale.setScalar(1); teile.haltung.visible = true;
      }
      /* Unter der Haelfte springt Verstaerkung mit Pizzakarton-Fallschirmen ab. */
      teile.fallschirm.forEach(function (s, i) {
        if (besiegt || anteil > 0.5) { s.visible = false; return; }
        var zyklus = (zeit + i * 1.5) % 6, y = Math.max(0.15, 26 - zyklus * 6);
        s.visible = true; s.position.set(o.x + Math.cos(i * 1.6) * 8, y, o.z + Math.sin(i * 1.6) * 8);
      });
      teile.lorbeer.visible = !besiegt && anteil <= 0.25;
      if (teile.lorbeer.visible) { var lw = zeit * 3; teile.lorbeer.position.set(o.x + Math.cos(lw) * 9, 6, o.z + Math.sin(lw) * 9); teile.lorbeer.rotation.set(Math.PI / 2, 0, zeit * 12); }
    }
    function ueberraschungenSchritt(jetzt, zeit) {
      var u = ev.ueberraschungen || {}, d = function (id) { return u[id] && jetzt >= u[id] && jetzt - u[id] < ROM.dauer(ev, 20000); };
      /* Nonna Colossale steigt hinter dem Kolosseum auf. */
      var n = u.nonna && jetzt - u.nonna, nd = ROM.dauer(ev, 12000);
      if (n !== undefined && n >= 0 && n < nd) {
        var hoch = Math.min(1, n / 1500, (nd - n) / 1500), K = ROM.KOLOSSEUM;
        teile.nonna.visible = true; teile.nonna.position.set(K.x - 12, -30 + hoch * 30, K.z - 30);
        teile.nonnaBlase.visible = hoch > 0.9; teile.nonnaBlase.position.set(K.x - 12, 31, K.z - 30);
      } else { teile.nonna.visible = false; teile.nonnaBlase.visible = false; }
      /* Vespa-Stampede quer ueber den Startplatz */
      teile.stampede.forEach(function (s, i) {
        if (!d('vespa')) { s.visible = false; return; }
        var x = -40 + ((zeit * 22 + i * 21) % 110);
        s.visible = true; s.position.set(x, 0.15 + Math.abs(Math.sin(zeit * 10 + i)) * 0.4, 24 + i * 4);
      });
      /* Spaghetti-Regen um die eigene Figur */
      if (d('spaghetti') && !ruhig && Math.random() < 0.5) { var sp = w.spieler(); partikel('stab', '#f1d27a', sp.x + (Math.random() - 0.5) * 30, 18, sp.z + (Math.random() - 0.5) * 30, 0, 0, 0, 3, 5); }
    }
    function finaleSchritt(jetzt, zeit) {
      var tr = ROM.TREVI;
      teile.himmelspizza.visible = true; teile.himmelspizza.position.set(ROM.PIAZZA.x, 60, ROM.PIAZZA.z); teile.himmelspizza.material.rotation = zeit * 0.3;
      if (!ruhig || Math.random() < 0.3) {
        partikel('kugel', '#8fdcf5', tr.x + (Math.random() - 0.5) * 6, 1, tr.z + 1, (Math.random() - 0.5) * 4, 14 + Math.random() * 6, -2 - Math.random() * 3, 2.2);
        if (Math.random() < 0.4) partikel('scheibe', '#f5c542', tr.x + (Math.random() - 0.5) * 30, 22, tr.z - 12 + (Math.random() - 0.5) * 30, 0, 0, 0, 3.5, 6);
        if (Math.random() < 0.25) partikel('stab', '#f1d27a', ROM.PIAZZA.x + (Math.random() - 0.5) * 24, 20, ROM.PIAZZA.z + (Math.random() - 0.5) * 24, (Math.random() - 0.5) * 6, 4, (Math.random() - 0.5) * 6, 3, 7);
      }
      /* Feuerwerk in Gruen, Weiss und Rot - weiche Kugeln, keine grellen Blitze */
      if (Math.floor(zeit / 1.6) !== teile.letztesFeuerwerk) {
        teile.letztesFeuerwerk = Math.floor(zeit / 1.6);
        var fx = ROM.PIAZZA.x + (Math.random() - 0.5) * 30, fz = ROM.PIAZZA.z + (Math.random() - 0.5) * 20, farbe = ['#1b8a3c', '#ffffff', '#c92a2a'][teile.letztesFeuerwerk % 3];
        for (var i = 0; i < (ruhig ? 8 : 22); i++) { var a = i / 22 * Math.PI * 2, b = Math.random() * Math.PI; partikel('kugel', farbe, fx, 30, fz, Math.cos(a) * Math.sin(b) * 9, Math.cos(b) * 9, Math.sin(a) * Math.sin(b) * 9, 1.6, 3); }
      }
    }
    /* Nach dem Ende saugt die Himmelspizza alles ein und fliegt davon. */
    function abspannSchritt(jetzt, seit) {
      var k = Math.min(1, seit / 6000);
      teile.himmelspizza.visible = true;
      teile.himmelspizza.position.set(ROM.PIAZZA.x, 60 + Math.max(0, k - 0.6) * 250, ROM.PIAZZA.z);
      teile.himmelspizza.material.rotation += 0.05 + k * 0.3;
      teile.kulisse.position.y = -k * 12; teile.kulisse.scale.setScalar(Math.max(0.01, 1 - k * 0.6));
      teile.boss.visible = teile.wagen.visible = teile.tassen.visible = teile.sombrero.visible = false; teile.tassen.position.y = 0;
      aus(teile.kakerlaken); aus(teile.tanzende); aus(teile.legion); aus(teile.fallschirm); teile.fuehrerin.visible = teile.fuehrerinBlase.visible = false;
      teile.pizzen.forEach(function (p) { p.s.visible = p.blase.visible = false; });
      teile.pfuetze.visible = teile.lorbeer.visible = teile.zielring.visible = false;
      aus(teile.stampede); teile.nonna.visible = teile.nonnaBlase.visible = false;
      teile.schilder.forEach(function (s) { s.antwort.visible = false; });
      return k >= 1;
    }
    function lichtPflegen(name, jetzt) {
      if (lichtAn === name && jetzt - lichtUhr < 2000) return;
      lichtAn = name; lichtUhr = jetzt; w.licht(name ? LICHT[name] : null);
    }
    function verbergen(jetzt) {
      gruppe.visible = false; allePartikelWeg();
      /* Ein Kampf kann die Gruppe bereits ausblenden. Das Licht und die
         Partikel gehoeren trotzdem noch zum beendeten Event. */
      if (lichtAn) lichtPflegen(null, jetzt);
    }

    var api = {
      name: 'rom',
      /* Der Stand vom Server (Sicht aus lib/gehstockmon-rom.mjs) oder null. */
      setEvent: function (sicht) {
        if (sicht && (!ev || ev.id !== sicht.id)) {
          gesammelt = {}; zielId = null; lastHaltung = -1; poseBis = 0; trefferZeit = 0;
          allePartikelWeg(); teile.letztesFeuerwerk = undefined;
          /* Auch ein direkt gestartetes Folgeevent hat einen leeren Countdown,
             selbst wenn das vorige ohne Abspann aus dem Serverstand fiel. */
          gruppe.children.forEach(function (s) { if (s !== teile.kulisse) s.visible = false; });
          if (teile.bossBild) { teile.bossBild.scale.y = 11; teile.bossBild.material.opacity = 1; teile.pfuetze.scale.setScalar(1); }
        }
        ev = sicht || null; lage = sicht || null;
        if (ev && sicht.ich) (sicht.ich.zutaten || []).forEach(function (id) { gesammelt[id] = true; });
      },
      tippen: function (pt) {
        if (!ev) return;
        /* Schnappen lassen sich nur die Pizzen der ersten beiden Phasen - die
           im Espresso-Overdrive rasen nur vorbei. */
        var ph = ROM.phase(ev, uhr());
        if (!ph || (ph.nr !== P.wahnsinn && ph.nr !== P.rebellion)) return;
        var liste = ROM.pizzen(ev, uhr()), beste = null, abstand = 5;
        liste.forEach(function (pz) { var d = Math.hypot(pz.x - pt.x, pz.z - pt.z); if (d < abstand && !gesammelt[pz.id]) { abstand = d; beste = pz; } });
        zielId = beste ? beste.id : null;
      },
      ziel: function (id) { zielId = id || null; },
      zielId: function () { return zielId; },
      gesammelt: function (id) { gesammelt[id] = true; if (zielId === id) zielId = null; },
      naechstePizza: function (von) {
        if (!ev) return null;
        var beste = null, abstand = Infinity;
        ROM.pizzen(ev, uhr()).forEach(function (pz) { if (gesammelt[pz.id]) return; var d = Math.hypot(pz.x - von.x, pz.z - von.z); if (d < abstand) { abstand = d; beste = pz; } });
        return beste;
      },
      pose: function (i) { pose = i; poseBis = uhr() + 800; },
      treffer: function () {
        trefferZeit = performance.now() / 1000;
        if (!gebaut) return;
        var o = teile.boss.position;
        for (var i = 0; i < (ruhig ? 4 : 12); i++) partikel('kugel', '#fff4cf', o.x, 7, o.z, (Math.random() - 0.5) * 10, 6 + Math.random() * 5, (Math.random() - 0.5) * 10, 1.2);
      },
      ruhig: function (ja) { ruhig = !!ja; },
      /* Ein Ei springt aus dem Trevi-Brunnen (die Anzeige legt es zum Fangen hin). */
      eiSprung: function () {
        if (!gebaut) return;
        var tr = ROM.TREVI;
        for (var i = 0; i < 3; i++) partikel('ei', '#fff4cf', tr.x + (Math.random() - 0.5) * 4, 2, tr.z + 2, (Math.random() - 0.5) * 6, 12 + Math.random() * 4, -3 - Math.random() * 3, 2.4);
      },
      /* Die Uhr der Welt steht, solange keine Bilder kommen (verdeckter Tab,
         Ruckeln: core/loop.js kappt lange Bildabstaende). Pizzen, Boss und
         Server muessen aber dieselbe Zeit sehen - darum reicht die Anzeige
         ihre Serveruhr herein. */
      zeitquelle: function (fn) { zeitquelle = typeof fn === 'function' ? fn : null; },
      update: function (dt, jetzt) {
        jetzt = uhr(jetzt);
        if (!ev) { verbergen(jetzt); return; }
        var ph = ROM.phase(ev, jetzt), zeit = performance.now() / 1000;
        if (!ph) return;
        var seit = ph.nr === VORBEI ? jetzt - ph.von : 0;
        if (ph.nr === VORBEI && (seit > 8000 || ROM.nieGelaufen(ev))) { verbergen(jetzt); return; }
        bauen(); gruppe.visible = !w.kampf();
        if (ph.nr === VORBEI) { if (abspannSchritt(jetzt, seit)) verbergen(jetzt); partikelSchritt(dt); return; }
        teile.kulisse.scale.setScalar(1);
        /* Im Countdown wachsen Saeulen, Kolosseum und Brunnen aus dem Boden. */
        var k = ph.nr < 0 ? Math.max(0, Math.min(1, (jetzt - ev.start) / ROM.dauer(ev, ROM.COUNTDOWN))) : 1;
        teile.kulisse.position.y = -10 * Math.pow(1 - k, 2);
        lichtPflegen(ph.nr === P.imperator ? 'boss' : ph.nr === P.turbo ? 'turbo' : ph.nr === P.trevi ? 'fest' : 'abend', jetzt);
        sichtbarkeit(ph.nr);
        if (ROM.PIZZA_ANZAHL[ph.nr]) pizzenSchritt(jetzt, zeit, ph.nr);
        if (ph.nr === P.rebellion) wagenSchritt(jetzt, zeit);
        kakerlakenSchritt(jetzt, zeit, ph.nr);
        if (ph.nr === P.imperator) bossSchritt(jetzt, zeit, dt);
        if (ph.nr === P.turbo) turboSchritt(jetzt, zeit);
        if (ph.nr === P.trevi) finaleSchritt(jetzt, zeit);
        /* Eine kurz vor dem Phasenwechsel gestartete Ueberraschung laeuft
           bis zu ihrem eigenen Ende weiter und wird danach ausgeblendet. */
        if (ph.nr >= 0) ueberraschungenSchritt(jetzt, zeit);
        partikelSchritt(dt);
      },
      destroy: function () {
        allePartikelWeg(); scene.remove(gruppe);
        if (lichtAn) w.licht(null);
        eigen.geo.forEach(function (x) { x.dispose(); }); eigen.mat.forEach(function (x) { x.dispose(); }); eigen.tex.forEach(function (x) { x.dispose(); });
        eigen = { geo: [], mat: [], tex: [] }; texCache = {}; blasenCache = {}; ev = null;
      },
      /* Fuer die Pruefung am Entwicklungsserver: wie viel gerade in der Szene haengt. */
      zaehler: function () { return { sichtbar: gruppe.visible, partikel: gebaut ? teile.partikel.length : 0, texturen: eigen.tex.length }; }
    };
    return api;
  });
})(SG);
