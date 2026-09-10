/* ------------------------------------------------------------------
   Geheimagenten-Tycoon - Darstellung

   Zwei Ansichten: die Weltkarte mit den Regionen und das Hauptquartier
   im Schnitt über drei Etagen. Beides prozedural gezeichnet.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var G = SG.gfx;
  var A = SG.tycoon.spy;
  var D = A.data;
  var S = A.sim;

  var Rd = A.render = {};

  /* Grobe Kontinentumrisse in Anteilen der Kartenflaeche */
  var LAND = [
    [0.10, 0.18, 0.24, 0.15, 0.31, 0.21, 0.28, 0.33, 0.23, 0.38, 0.19, 0.47, 0.14, 0.40, 0.09, 0.29],
    [0.25, 0.52, 0.31, 0.50, 0.34, 0.60, 0.32, 0.72, 0.28, 0.81, 0.245, 0.70, 0.235, 0.60],
    [0.44, 0.20, 0.53, 0.17, 0.57, 0.26, 0.53, 0.34, 0.46, 0.33, 0.43, 0.26],
    [0.46, 0.37, 0.56, 0.34, 0.59, 0.45, 0.56, 0.57, 0.50, 0.67, 0.455, 0.58, 0.44, 0.47],
    [0.56, 0.16, 0.72, 0.12, 0.86, 0.19, 0.90, 0.30, 0.82, 0.39, 0.73, 0.44, 0.66, 0.39, 0.60, 0.31],
    [0.80, 0.63, 0.89, 0.60, 0.91, 0.71, 0.85, 0.76, 0.79, 0.71],
    [0.37, 0.05, 0.49, 0.03, 0.53, 0.10, 0.44, 0.13, 0.37, 0.09],
  ];

  /* ------------------------------------------------------------------
     Weltkarte
     ------------------------------------------------------------------ */

  Rd.mapLayer = function (w, h) {
    return G.cache('spy-map:' + Math.round(w) + 'x' + Math.round(h), w, h, function (c) {
      // Ozean
      c.fillStyle = G.linear(c, 0, 0, 0, h, [0, '#0a1424', 1, '#0d1b2e']);
      c.fillRect(0, 0, w, h);

      // Gitternetz
      c.strokeStyle = 'rgba(120,160,220,.07)';
      c.lineWidth = 1;
      for (var i = 1; i < 12; i++) {
        c.beginPath();
        c.moveTo((w / 12) * i, 0);
        c.lineTo((w / 12) * i, h);
        c.stroke();
      }
      for (i = 1; i < 8; i++) {
        c.beginPath();
        c.moveTo(0, (h / 8) * i);
        c.lineTo(w, (h / 8) * i);
        c.stroke();
      }

      // Landmassen
      LAND.forEach(function (poly) {
        var pts = [];
        for (var k = 0; k < poly.length; k += 2) {
          pts.push(poly[k] * w, poly[k + 1] * h);
        }
        c.beginPath();
        c.moveTo(pts[0], pts[1]);
        for (k = 2; k < pts.length; k += 2) c.lineTo(pts[k], pts[k + 1]);
        c.closePath();
        c.fillStyle = '#1c2a3f';
        c.fill();
        c.strokeStyle = 'rgba(140,180,240,.22)';
        c.lineWidth = 1.2;
        c.stroke();
      });

      // Rauschen fuer die Optik
      G.grain(c, w, h, 0.03);
    });
  };

  Rd.regionPos = function (region, w, h) {
    var def = D.regionById(region.id);
    return { x: def.x * w, y: def.y * h };
  };

  /* o = { ctx, s, w, h, t, selected, hoverId } */
  Rd.drawMap = function (o) {
    var c = o.ctx, s = o.s, w = o.w, h = o.h;
    c.drawImage(Rd.mapLayer(w, h), 0, 0);

    // Verbindungslinien zwischen freigeschalteten Regionen
    c.strokeStyle = 'rgba(74,163,255,.12)';
    c.lineWidth = 1;
    var open = s.regions.filter(function (r) { return r.unlocked; });
    for (var i = 0; i < open.length; i++) {
      for (var k = i + 1; k < open.length; k++) {
        var a = Rd.regionPos(open[i], w, h), b = Rd.regionPos(open[k], w, h);
        if (U.dist(a.x, a.y, b.x, b.y) > w * 0.28) continue;
        c.beginPath();
        c.moveTo(a.x, a.y);
        c.lineTo(b.x, b.y);
        c.stroke();
      }
    }

    // Auftraege als Marker
    var byRegion = {};
    s.missions.forEach(function (m) {
      (byRegion[m.region] || (byRegion[m.region] = [])).push(m);
    });

    s.regions.forEach(function (r) {
      var p = Rd.regionPos(r, w, h);
      var def = D.regionById(r.id);
      var open2 = r.unlocked;

      if (!open2) {
        G.circle(c, p.x, p.y, 7, 'rgba(90,104,132,.4)');
        G.text(c, '🔒', p.x, p.y, {
          size: 9, align: 'center', baseline: 'middle', color: '#5f6a85',
        });
        return;
      }

      // Hitze als roter Hof
      if (r.heat > 5) {
        G.glow(c, p.x, p.y, 16 + r.heat * 0.34, '#ff5f6b', U.clamp(r.heat / 190, 0.05, 0.5));
      }
      // Einfluss als gruener Ring
      G.arcProgress(c, p.x, p.y, 13, 2.6, r.influence / 100, '#3ddc84', 'rgba(255,255,255,.12)');

      var sel = o.selected === r.id;
      G.circle(c, p.x, p.y, sel ? 8 : 6, sel ? '#ffd166' : '#4aa3ff');
      G.circle(c, p.x, p.y, sel ? 3.4 : 2.6, '#0b0e15');

      var list = byRegion[r.id] || [];
      if (list.length) {
        var pulse = 0.6 + Math.sin(o.t * 3 + p.x) * 0.4;
        G.fillRound(c, p.x + 9, p.y - 17, 17, 14, 7, 'rgba(240,180,41,' + (0.55 + pulse * 0.4).toFixed(2) + ')');
        G.text(c, String(list.length), p.x + 17.5, p.y - 10, {
          size: 10, weight: 800, color: '#241a04', align: 'center', baseline: 'middle',
        });
      }

      G.text(c, def.name, p.x, p.y + 22, {
        size: 10.5, weight: 650, align: 'center', baseline: 'middle',
        color: sel ? '#ffd166' : 'rgba(200,214,234,.75)',
        shadow: 'rgba(0,0,0,.8)', sy: 1,
      });
    });

    // Laufende Einsaetze als wandernde Punkte
    s.active.forEach(function (run) {
      var r = null;
      for (var i2 = 0; i2 < s.regions.length; i2++) {
        if (s.regions[i2].id === run.mission.region) r = s.regions[i2];
      }
      if (!r) return;
      var p = Rd.regionPos(r, w, h);
      var t = run.state === 'anreise'
        ? U.clamp(1 - (run.arriveAt - s.time) / Math.max(0.01, run.mission.travel / 24), 0, 1)
        : 1;
      var hq = { x: w * 0.47, y: h * 0.30 };
      var x = U.lerp(hq.x, p.x, t), y = U.lerp(hq.y, p.y, t);
      G.circle(c, x, y, 4, '#ffd166');
      c.strokeStyle = 'rgba(255,209,102,.35)';
      c.setLineDash([3, 4]);
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(hq.x, hq.y);
      c.lineTo(x, y);
      c.stroke();
      c.setLineDash([]);
    });

    // Hauptquartier
    var hq = { x: w * 0.47, y: h * 0.30 };
    G.star(c, hq.x, hq.y, 9, 4, 5, -Math.PI / 2, '#ffd166');
  };

  /* ------------------------------------------------------------------
     Hauptquartier
     ------------------------------------------------------------------ */

  Rd.hqLayout = function (w, h) {
    var floors = D.HQ.floors;
    var pad = 12;
    var gap = 10;
    var floorH = (h - pad * 2 - gap * (floors - 1)) / floors;
    var cell = Math.min((w - pad * 2) / D.HQ.w, floorH / D.HQ.h);
    var gw = cell * D.HQ.w, gh = cell * D.HQ.h;
    return {
      cell: cell, gw: gw, gh: gh,
      x: (w - gw) / 2,
      y0: pad,
      step: gh + gap,
    };
  };

  Rd.drawHQ = function (o) {
    var c = o.ctx, s = o.s, w = o.w, h = o.h;
    var L = Rd.hqLayout(w, h);

    c.fillStyle = '#0b0f18';
    c.fillRect(0, 0, w, h);

    for (var f = 0; f < D.HQ.floors; f++) {
      var fy = L.y0 + f * L.step;
      var locked = f > 0 && s.level < 3 + (f - 1) * 3;

      // Erdreich / Rahmen
      G.fillRound(c, L.x - 8, fy - 8, L.gw + 16, L.gh + 16, 8, locked ? '#131722' : '#1a2130');
      c.fillStyle = '#0d121c';
      c.fillRect(L.x, fy, L.gw, L.gh);

      // Raster
      c.strokeStyle = 'rgba(255,255,255,.045)';
      c.lineWidth = 1;
      for (var gx = 0; gx <= D.HQ.w; gx++) {
        c.beginPath();
        c.moveTo(L.x + gx * L.cell + .5, fy);
        c.lineTo(L.x + gx * L.cell + .5, fy + L.gh);
        c.stroke();
      }
      for (var gy = 0; gy <= D.HQ.h; gy++) {
        c.beginPath();
        c.moveTo(L.x, fy + gy * L.cell + .5);
        c.lineTo(L.x + L.gw, fy + gy * L.cell + .5);
        c.stroke();
      }

      G.text(c, 'Etage ' + (f + 1), L.x - 6, fy - 12, {
        size: 10.5, weight: 700, color: locked ? '#4b5570' : '#8794b1',
      });
      if (locked) {
        G.text(c, '🔒 ab Level ' + (3 + (f - 1) * 3), L.x + L.gw - 6, fy - 12, {
          size: 10.5, weight: 700, color: '#4b5570', align: 'right',
        });
        c.fillStyle = 'rgba(8,11,17,.55)';
        c.fillRect(L.x, fy, L.gw, L.gh);
      }
    }

    // Raeume
    s.rooms.forEach(function (room) {
      var def = D.roomById(room.id);
      if (!def) return;
      var fy = L.y0 + room.floor * L.step;
      var x = L.x + room.x * L.cell, y = fy + room.y * L.cell;
      var rw = room.w * L.cell, rh = room.h * L.cell;

      G.fillRound(c, x + 1, y + 1, rw - 2, rh - 2, 4, U.shade(def.color, -0.55));
      G.fillRound(c, x + 2, y + 2, rw - 4, rh - 4, 3, U.shade(def.color, -0.35));
      G.text(c, def.icon, x + rw / 2, y + rh / 2 - (rw > 60 ? 6 : 0), {
        size: Math.min(rw, rh) * 0.44, align: 'center', baseline: 'middle', color: '#fff',
      });
      if (rw > 60) {
        G.fitText(c, def.name, x + rw / 2, y + rh - 6, rw - 8, {
          size: 9.5, weight: 650, color: 'rgba(255,255,255,.8)', align: 'center',
        });
      }
      if (o.selected === room) {
        G.strokeRound(c, x, y, rw, rh, 4, '#ffd166', 2);
      }
    });

    // Bau-Vorschau
    if (o.ghost) {
      var def2 = D.roomById(o.ghost.id);
      if (def2) {
        var fy2 = L.y0 + o.ghost.floor * L.step;
        var gx2 = L.x + o.ghost.x * L.cell, gy2 = fy2 + o.ghost.y * L.cell;
        c.globalAlpha = 0.55;
        G.fillRound(c, gx2, gy2, def2.w * L.cell, def2.h * L.cell, 4,
          o.ghost.ok ? def2.color : '#ff5f6b');
        c.globalAlpha = 1;
        G.strokeRound(c, gx2, gy2, def2.w * L.cell, def2.h * L.cell, 4,
          o.ghost.ok ? '#3ddc84' : '#ff5f6b', 2);
      }
    }
  };

  Rd.hqCellAt = function (s, x, y, w, h) {
    var L = Rd.hqLayout(w, h);
    for (var f = 0; f < D.HQ.floors; f++) {
      var fy = L.y0 + f * L.step;
      if (y < fy || y > fy + L.gh) continue;
      var cx = Math.floor((x - L.x) / L.cell);
      var cy = Math.floor((y - fy) / L.cell);
      if (cx < 0 || cy < 0 || cx >= D.HQ.w || cy >= D.HQ.h) return null;
      return { floor: f, x: cx, y: cy };
    }
    return null;
  };

  /* ------------------------------------------------------------------
     Kleinteile
     ------------------------------------------------------------------ */

  /* Faehigkeitsprofil eines Agenten als Balkengruppe */
  Rd.skillBars = function (c, s, agent, x, y, w) {
    var rowH = 15;
    D.SKILLS.forEach(function (sk, i) {
      var v = S.skillValue(s, agent, sk.id);
      var yy = y + i * rowH;
      G.text(c, sk.icon, x, yy + 7, { size: 11, baseline: 'middle' });
      G.text(c, sk.name, x + 16, yy + 7, {
        size: 10.5, color: '#8794b1', baseline: 'middle',
      });
      var bx = x + 78, bw = w - 78 - 26;
      G.progress(c, bx, yy + 3, bw, 7, v / 100,
        v > 66 ? '#3ddc84' : v > 40 ? '#f0b429' : '#ff9c3f', 'rgba(255,255,255,.08)');
      G.text(c, String(v), x + w, yy + 7, {
        size: 10.5, weight: 700, color: '#c8d4ea', align: 'right', baseline: 'middle',
      });
    });
    return D.SKILLS.length * rowH;
  };
})(SG);
