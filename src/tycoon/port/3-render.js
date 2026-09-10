/* ------------------------------------------------------------------
   Hafen-Tycoon - Darstellung

   Alles wird prozedural gezeichnet. Der statische Untergrund (Wasser,
   Raster, Kaikante) liegt in einer eigenen Ebene und wird nur neu
   gezeichnet, wenn sich Zoom oder Karte aendern - pro Bild bleibt dann
   nur noch ein drawImage plus die beweglichen Dinge.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var G = SG.gfx;
  var P = SG.tycoon.port;
  var D = P.data;
  var S = P.sim;

  var Rd = P.render = {};

  var TILE = 22;          // Weltgroesse eines Feldes in Pixeln

  Rd.TILE = TILE;

  Rd.worldSize = function (s) {
    return { w: s.w * TILE, h: s.h * TILE };
  };

  /* ------------------------------------------------------------------
     Untergrund
     ------------------------------------------------------------------ */

  Rd.groundLayer = function (s) {
    var key = 'port-ground:' + s.mapId + ':' + s.w + 'x' + s.h + ':' + Math.round(s.depth * 10);
    return G.cache(key, s.w * TILE, s.h * TILE, function (c, w, h) {
      var quayY = s.waterRows * TILE;

      // Wasser mit Tiefenverlauf
      var deep = '#0a1c2e';
      var shallow = U.mixHex('#123049', '#1b4463', U.clamp((s.depth - 10) / 8, 0, 1));
      c.fillStyle = G.linear(c, 0, 0, 0, quayY, [0, deep, 1, shallow]);
      c.fillRect(0, 0, w, quayY);

      // Wellenlinien
      var r = U.rng(1234);
      c.strokeStyle = 'rgba(255,255,255,.05)';
      c.lineWidth = 1;
      for (var i = 0; i < 60; i++) {
        var y = r() * quayY;
        var x = r() * w;
        var len = 20 + r() * 60;
        c.beginPath();
        c.moveTo(x, y);
        c.quadraticCurveTo(x + len / 2, y - 3, x + len, y);
        c.stroke();
      }

      // Tiefenangabe
      G.text(c, s.depth.toFixed(1) + ' m Wassertiefe', 10, 18, {
        size: 13, weight: 700, color: 'rgba(200,220,240,.45)',
      });

      // Land
      c.fillStyle = '#1c212c';
      c.fillRect(0, quayY, w, h - quayY);

      // Kaikante
      c.fillStyle = '#39404f';
      c.fillRect(0, quayY, w, 3);
      c.fillStyle = 'rgba(255,255,255,.06)';
      c.fillRect(0, quayY, w, 1);

      // Raster
      c.strokeStyle = 'rgba(255,255,255,.028)';
      c.lineWidth = 1;
      for (var x2 = 0; x2 <= s.w; x2++) {
        c.beginPath();
        c.moveTo(x2 * TILE + .5, quayY);
        c.lineTo(x2 * TILE + .5, h);
        c.stroke();
      }
      for (var y2 = s.waterRows; y2 <= s.h; y2++) {
        c.beginPath();
        c.moveTo(0, y2 * TILE + .5);
        c.lineTo(w, y2 * TILE + .5);
        c.stroke();
      }

      // Etwas Struktur auf dem Asphalt
      var r2 = U.rng(77);
      c.fillStyle = 'rgba(255,255,255,.015)';
      for (i = 0; i < 400; i++) {
        c.fillRect(r2() * w, quayY + r2() * (h - quayY), 2 + r2() * 6, 2);
      }
    });
  };

  /* ------------------------------------------------------------------
     Gebaeude
     ------------------------------------------------------------------ */

  function drawYardBoxes(c, x, y, w, h, fill, def, s) {
    // Fuellstand als gestapelte Container andeuten
    var kind = def.reefer ? 'reefer' : def.hazmat ? 'hazmat' : def.empty ? 'empty' : 'normal';
    var cap = S.yardCapacity(s)[kind] || 1;
    var used = s.yard[kind] || 0;
    var ratio = U.clamp(used / Math.max(1, cap), 0, 1);

    var cols = Math.max(1, Math.floor(w / 7));
    var rows = Math.max(1, Math.floor(h / 5));
    var total = cols * rows;
    var show = Math.round(total * ratio);
    var colors = def.reefer ? ['#34d3d3', '#2aa8a8']
      : def.hazmat ? ['#ff9c3f', '#c9762c']
        : def.empty ? ['#7b8394', '#5d6472']
          : ['#4aa3ff', '#3ddc84', '#f0b429', '#ff5f6b', '#a97bff'];
    var r = U.rng(x * 31 + y * 17);
    for (var i = 0; i < show; i++) {
      var cx = x + 2 + (i % cols) * 7;
      var cy = y + 2 + Math.floor(i / cols) * 5;
      if (cy + 4 > y + h) break;
      c.fillStyle = colors[Math.floor(r() * colors.length)];
      c.fillRect(cx, cy, 5.6, 3.4);
      c.fillStyle = 'rgba(0,0,0,.25)';
      c.fillRect(cx, cy + 3.4, 5.6, 0.9);
    }
  }

  function drawBuilding(c, s, b, zoom) {
    var def = D.byId(b.def);
    if (!def) return;
    var x = b.x * TILE, y = b.y * TILE;
    var w = b.w * TILE, h = b.h * TILE;

    if (def.kind === 'crane') {
      drawCrane(c, s, b, def, x, y, w);
      return;
    }

    if (def.road) {
      c.fillStyle = '#2f3542';
      c.fillRect(x, y, w, h);
      c.fillStyle = 'rgba(255,255,255,.1)';
      c.fillRect(x + w * .45, y + 2, w * .1, h - 4);
      return;
    }

    // Grundflaeche
    var base = def.color;
    c.fillStyle = U.shade(base, -0.55);
    c.fillRect(x, y, w, h);
    c.fillStyle = U.shade(base, -0.3);
    c.fillRect(x + 1, y + 1, w - 2, h - 2);

    if (def.kind === 'yard') {
      c.fillStyle = '#161b25';
      c.fillRect(x + 2, y + 2, w - 4, h - 4);
      drawYardBoxes(c, x + 2, y + 2, w - 4, h - 4, base, def, s);
      // Fahrgassen
      c.strokeStyle = 'rgba(255,255,255,.07)';
      c.lineWidth = 1;
      c.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
    } else if (def.kind === 'quay') {
      c.fillStyle = '#4b5361';
      c.fillRect(x, y, w, h);
      c.fillStyle = '#5d6675';
      c.fillRect(x, y, w, 3);
      // Poller
      for (var i = 0; i < b.w; i++) {
        G.circle(c, x + i * TILE + TILE / 2, y + h * 0.6, 2.2, '#20242e');
      }
    } else {
      // Dach mit Symbol
      c.fillStyle = U.shade(base, -0.15);
      c.fillRect(x + 2, y + 2, w - 4, h - 4);
      c.fillStyle = 'rgba(0,0,0,.25)';
      c.fillRect(x + 2, y + h - 5, w - 4, 3);
      if (zoom > 0.55) {
        G.text(c, def.icon, x + w / 2, y + h / 2, {
          size: Math.min(w, h) * 0.5, color: 'rgba(255,255,255,.85)',
          align: 'center', baseline: 'middle',
        });
      }
    }

    if (b.down > 0) {
      c.fillStyle = 'rgba(255,95,107,.35)';
      c.fillRect(x, y, w, h);
      if (zoom > 0.5) {
        G.text(c, '⚠', x + w / 2, y + h / 2, {
          size: Math.min(w, h) * 0.6, color: '#fff', align: 'center', baseline: 'middle',
        });
      }
    }
  }

  function drawCrane(c, s, b, def, x, y, w) {
    var quayY = s.waterRows * TILE;
    var legH = TILE * 1.4;
    var boomLen = def.reach * 2.1;

    // Beine
    c.strokeStyle = b.down > 0 ? '#8a3b45' : U.shade(def.color, -0.25);
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(x + 3, quayY + 2);
    c.lineTo(x + 3, quayY - legH);
    c.moveTo(x + w - 3, quayY + 2);
    c.lineTo(x + w - 3, quayY - legH);
    c.stroke();

    // Ausleger nach vorn (aufs Wasser)
    c.strokeStyle = b.down > 0 ? '#a34a55' : def.color;
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(x + w / 2, quayY - legH);
    c.lineTo(x + w / 2 - boomLen, quayY - legH);
    c.stroke();
    // Gegenausleger
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(x + w / 2, quayY - legH);
    c.lineTo(x + w / 2 + boomLen * 0.4, quayY - legH);
    c.stroke();
    // Maschinenhaus
    c.fillStyle = U.shade(def.color, -0.15);
    c.fillRect(x + w / 2 - 5, quayY - legH - 7, 10, 7);

    if (b.down > 0) {
      G.text(c, '⚠', x + w / 2, quayY - legH - 14, {
        size: 12, color: '#ff5f6b', align: 'center', baseline: 'middle',
      });
    }
  }

  /* ------------------------------------------------------------------
     Schiffe
     ------------------------------------------------------------------ */

  function shipRect(s, ship) {
    var cls = D.shipClass(ship.cls);
    var lenTiles = cls.len / D.TILE_M;
    var w = lenTiles * TILE;
    var h = Math.max(14, TILE * (0.9 + lenTiles * 0.035));
    var berths = S.berths(s);
    var bx = 0;
    if (ship.berth >= 0 && berths[ship.berth]) {
      bx = berths[ship.berth].x * TILE;
    } else {
      bx = (s.w * TILE) * 0.12 + (ship.id % 5) * 40;
    }
    var quayY = s.waterRows * TILE;
    var y = quayY - h - 4;
    if (ship.state === 'warten') {
      y = quayY * (0.18 + (ship.id % 4) * 0.13);
      bx = (s.w * TILE) * (0.1 + ((ship.id * 37) % 60) / 100);
    }
    var x = bx + ship.x * w * 1.4;
    return { x: x, y: y, w: w, h: h, cls: cls };
  }
  Rd.shipRect = shipRect;

  function drawShip(c, s, ship, zoom) {
    var r = shipRect(s, ship);
    var cls = r.cls;

    // Rumpf
    c.fillStyle = U.shade(cls.color, -0.5);
    c.beginPath();
    c.moveTo(r.x, r.y);
    c.lineTo(r.x + r.w - r.h * 0.55, r.y);
    c.lineTo(r.x + r.w, r.y + r.h * 0.5);
    c.lineTo(r.x + r.w - r.h * 0.55, r.y + r.h);
    c.lineTo(r.x, r.y + r.h);
    c.closePath();
    c.fill();
    c.fillStyle = U.shade(cls.color, -0.3);
    c.fillRect(r.x + 2, r.y + 2, r.w - r.h * 0.6, r.h * 0.34);

    // Container an Deck, entsprechend der Restladung
    var left = 0;
    for (var i = 0; i < ship.manifest.length; i++) left += ship.manifest[i].teu;
    var ratio = U.clamp(left / Math.max(1, ship.teu), 0, 1);
    var cols = Math.max(1, Math.floor((r.w - r.h * 0.7) / 6));
    var show = Math.round(cols * ratio);
    var rr = U.rng(ship.id * 991);
    var colors = ['#4aa3ff', '#3ddc84', '#f0b429', '#ff5f6b', '#a97bff', '#34d3d3'];
    for (i = 0; i < show; i++) {
      var stackH = 1 + Math.floor(rr() * 3);
      for (var k = 0; k < stackH; k++) {
        c.fillStyle = colors[Math.floor(rr() * colors.length)];
        c.fillRect(r.x + 3 + i * 6, r.y + r.h * 0.42 - k * 4, 5, 3.4);
      }
    }

    // Bruecke am Heck
    c.fillStyle = '#e9edf6';
    c.fillRect(r.x + r.w - r.h * 0.75, r.y - r.h * 0.35, r.h * 0.35, r.h * 0.4);

    if (zoom > 0.5) {
      G.text(c, ship.name, r.x + 4, r.y - 6, {
        size: 10, weight: 700, color: 'rgba(255,255,255,.85)',
        shadow: 'rgba(0,0,0,.7)', sy: 1,
      });
    }

    // Fortschritt
    if (ship.state === 'laden') {
      G.progress(c, r.x, r.y + r.h + 3, r.w, 4, ship.progress, '#3ddc84', 'rgba(0,0,0,.45)');
      var late = ship.workT > ship.window;
      if (late) {
        G.text(c, 'Liegezeit überschritten', r.x + 4, r.y + r.h + 16, {
          size: 9.5, weight: 700, color: '#ff5f6b',
        });
      }
    } else if (ship.state === 'warten') {
      G.text(c, 'wartet ' + Math.round(ship.waited) + ' h', r.x + 4, r.y + r.h + 12, {
        size: 9.5, weight: 600, color: 'rgba(255,255,255,.6)',
      });
    }
  }

  /* ------------------------------------------------------------------
     Gesamtbild
     ------------------------------------------------------------------ */

  /* o = { ctx, vp, s, ghost, selected, hoverTile } */
  Rd.draw = function (o) {
    var c = o.ctx, vp = o.vp, s = o.s;
    var zoom = vp.scale;

    c.save();
    vp.apply(c);

    var ground = Rd.groundLayer(s);
    c.drawImage(ground, 0, 0);

    var bounds = vp.bounds();

    // Gebaeude (Kai zuerst, dann Rest, Bruecken zuletzt)
    var list = S.list(s);
    var order = { quay: 0, yard: 1, infra: 1, crane: 3 };
    list.sort(function (a, b) {
      var da = D.byId(a.def), db = D.byId(b.def);
      return (order[da ? da.kind : 'infra'] || 1) - (order[db ? db.kind : 'infra'] || 1);
    });
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      var bx = b.x * TILE, by = b.y * TILE;
      if (bx + b.w * TILE < bounds.x0 - 60 || bx > bounds.x1 + 60) continue;
      if (by + b.h * TILE < bounds.y0 - 60 || by > bounds.y1 + 60) continue;
      drawBuilding(c, s, b, zoom);
    }

    // Schiffe
    for (i = 0; i < s.ships.length; i++) {
      drawShip(c, s, s.ships[i], zoom);
    }

    // Auswahl
    if (o.selected) {
      var sel = o.selected;
      c.strokeStyle = '#ffd166';
      c.lineWidth = 2 / zoom;
      c.strokeRect(sel.x * TILE - 1, sel.y * TILE - 1, sel.w * TILE + 2, sel.h * TILE + 2);
    }

    // Bau-Vorschau
    if (o.ghost) {
      var g = o.ghost;
      var def = D.byId(g.id);
      if (def) {
        var gx = g.x * TILE, gy = g.y * TILE;
        var gw = def.w * TILE, gh = def.h * TILE;
        c.globalAlpha = 0.55;
        c.fillStyle = g.ok ? def.color : '#ff5f6b';
        c.fillRect(gx, gy, gw, gh);
        c.globalAlpha = 1;
        c.strokeStyle = g.ok ? '#3ddc84' : '#ff5f6b';
        c.lineWidth = 2 / zoom;
        c.strokeRect(gx, gy, gw, gh);
        if (def.kind === 'crane') {
          c.globalAlpha = 0.4;
          drawCrane(c, s, { x: g.x, y: g.y, w: def.w, down: 0 }, def, gx, gy, gw);
          c.globalAlpha = 1;
        }
      }
    }

    c.restore();
  };

  /* Kleine Uebersichtskarte fuer die Kopfzeile */
  Rd.minimap = function (c, s, x, y, w, h) {
    G.fillRound(c, x, y, w, h, 4, '#0d1420');
    var sx = w / s.w, sy = h / s.h;
    c.fillStyle = '#16324c';
    c.fillRect(x, y, w, s.waterRows * sy);
    S.list(s).forEach(function (b) {
      var d = D.byId(b.def);
      c.fillStyle = d ? d.color : '#888';
      c.fillRect(x + b.x * sx, y + b.y * sy, Math.max(1, b.w * sx), Math.max(1, b.h * sy));
    });
    s.ships.forEach(function (sh) {
      var r = shipRect(s, sh);
      c.fillStyle = D.shipClass(sh.cls).color;
      c.fillRect(x + (r.x / TILE) * sx, y + (r.y / TILE) * sy,
        Math.max(2, (r.w / TILE) * sx), 2);
    });
  };
})(SG);
