/* ------------------------------------------------------------------
   Geheimagenten-Tycoon - Darstellung

   Zwei Ansichten: die Weltkarte mit den Regionen und das Hauptquartier
   im Schnitt über drei Etagen. Beides prozedural gezeichnet.

   Die Karte ist eine echte: Küstenlinien in Grad, flach projiziert.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var G = SG.gfx;
  var A = SG.tycoon.spy;
  var D = A.data;
  var S = A.sim;

  var Rd = A.render = {};

  /* ------------------------------------------------------------------
     Die Weltkarte

     Kuestenlinien als Laenge/Breite in Grad, nicht als Anteile der
     Flaeche. Das hat zwei Gruende: die Zahlen lassen sich gegen einen
     Atlas pruefen, und der Ausschnitt bleibt aenderbar, ohne dass jeder
     Punkt neu gerechnet werden muss.

     Der Ausschnitt laesst die Antarktis und die leere Polkappe weg -
     zwischen 84 Grad Nord und 56 Grad Sued liegt alles, was im Spiel
     vorkommt. Projiziert wird flach (Plattkarte): Laengengrade sind
     gleich breit, Breitengrade gleich hoch. Fuer eine Lagekarte ist
     das genau richtig; Groenland faellt dabei zu gross aus, das ist
     bei dieser Projektion so und stoert hier nicht.
     ------------------------------------------------------------------ */

  var AUSSCHNITT = { west: -180, ost: 180, nord: 84, sued: -56 };

  function px(lon, w) {
    return ((lon - AUSSCHNITT.west) / (AUSSCHNITT.ost - AUSSCHNITT.west)) * w;
  }
  function py(lat, h) {
    return ((AUSSCHNITT.nord - lat) / (AUSSCHNITT.nord - AUSSCHNITT.sued)) * h;
  }

  /* Jede Landmasse ein Streckenzug: lon, lat, lon, lat, ... */
  var LAND = [
    /* Nordamerika */
    [-168, 66, -164, 60, -158, 58, -152, 59, -147, 61, -140, 60, -135, 57,
      -131, 53, -127, 50, -124, 46, -122, 40, -119, 34, -117, 32, -114, 31,
      -110, 31, -106, 31, -103, 29, -99, 27, -97, 26, -94, 29, -91, 29,
      -89, 29, -85, 30, -83, 29, -81, 25, -81, 29, -80, 32, -77, 34, -75, 36,
      -74, 39, -71, 41, -70, 43, -67, 45, -64, 46, -60, 47, -56, 51, -60, 54,
      -64, 57, -68, 58, -71, 56, -77, 55, -79, 52, -82, 55, -87, 57, -92, 58,
      -95, 61, -95, 65, -92, 68, -97, 69, -103, 68, -110, 68, -115, 69,
      -120, 70, -125, 70, -131, 70, -136, 69, -141, 70, -148, 71, -155, 71,
      -161, 70, -165, 68],
    /* Mittelamerika */
    [-97, 16, -94, 16, -92, 15, -89, 14, -87, 13, -85, 11, -83, 9, -80, 9,
      -78, 9, -80, 11, -83, 12, -86, 14, -88, 16, -88, 18, -87, 21, -90, 21,
      -92, 19, -95, 18],
    /* Suedamerika */
    [-78, 9, -75, 11, -71, 12, -66, 11, -62, 10, -60, 8, -55, 6, -51, 4,
      -50, 0, -48, -1, -44, -2, -40, -3, -37, -5, -35, -8, -38, -12, -39, -16,
      -41, -22, -45, -24, -48, -26, -52, -32, -57, -35, -57, -38, -62, -39,
      -64, -42, -65, -45, -68, -48, -68, -52, -70, -55, -74, -53, -75, -49,
      -74, -44, -73, -40, -73, -36, -71, -33, -70, -25, -70, -18, -75, -15,
      -77, -12, -79, -7, -81, -5, -80, -2, -78, 1, -77, 4, -76, 6],
    /* Afrika */
    [-17, 15, -16, 12, -13, 9, -8, 5, -3, 5, 1, 6, 4, 6, 9, 4, 9, 2, 12, -1,
      13, -5, 12, -9, 12, -17, 15, -22, 17, -28, 18, -34, 22, -34, 25, -34,
      29, -31, 32, -29, 33, -26, 35, -24, 36, -21, 40, -16, 41, -11, 40, -6,
      39, -4, 41, -2, 44, 2, 46, 5, 51, 11, 48, 12, 44, 12, 43, 11, 40, 15,
      37, 18, 36, 22, 34, 28, 33, 31, 30, 31, 25, 32, 19, 30, 15, 32, 11, 34,
      10, 37, 8, 37, 3, 36, -1, 35, -5, 35, -6, 36, -9, 33, -13, 28, -16, 21],
    /* Eurasien */
    [-9, 43, -9, 38, -6, 36, -2, 36, 0, 39, 3, 42, 5, 43, 7, 44, 10, 44,
      12, 42, 15, 40, 18, 40, 16, 42, 13, 45, 15, 44, 18, 43, 19, 41, 21, 39,
      23, 38, 24, 40, 26, 39, 26, 41, 29, 41, 33, 42, 36, 41, 36, 36, 35, 33,
      34, 31, 34, 29, 37, 25, 40, 21, 43, 13, 45, 13, 48, 14, 52, 16, 55, 17,
      57, 20, 59, 23, 57, 25, 55, 25, 51, 26, 48, 29, 50, 30, 52, 28, 56, 26,
      61, 25, 66, 25, 68, 23, 70, 21, 73, 16, 74, 15, 76, 9, 78, 8, 80, 13,
      82, 17, 85, 20, 87, 21, 89, 22, 92, 21, 94, 18, 97, 16, 98, 12, 100, 7,
      103, 1, 104, 9, 107, 11, 109, 15, 108, 19, 110, 21, 113, 22, 117, 24,
      120, 26, 122, 30, 121, 35, 119, 39, 122, 40, 124, 40, 126, 40, 126, 37,
      127, 35, 129, 35, 129, 38, 128, 41, 131, 43, 135, 48, 138, 54, 142, 59,
      148, 59, 155, 57, 160, 60, 163, 61, 170, 60, 177, 65, 180, 66, 175, 70,
      165, 70, 155, 71, 145, 72, 135, 72, 128, 73, 115, 73, 105, 76, 100, 77,
      95, 76, 90, 75, 82, 73, 73, 72, 69, 73, 60, 71, 55, 68, 50, 68, 45, 66,
      41, 66, 40, 64, 37, 65, 33, 68, 30, 67, 29, 66, 31, 63, 30, 60, 28, 59,
      24, 59, 21, 57, 21, 55, 19, 54, 14, 54, 11, 54, 9, 54, 8, 55, 8, 53,
      4, 52, 3, 51, 2, 51, 0, 49, -2, 49, -5, 48, -2, 47, -1, 46, -1, 44,
      -2, 43, -8, 43],
    /* Skandinavien */
    [5, 58, 5, 61, 7, 63, 11, 65, 14, 67, 18, 69, 23, 71, 28, 71, 31, 70,
      30, 67, 29, 66, 31, 63, 30, 60, 27, 60, 24, 60, 23, 60, 21, 63, 22, 65,
      19, 64, 17, 62, 17, 60, 16, 58, 14, 56, 13, 55, 12, 56, 11, 58, 8, 58],
    /* Grossbritannien */
    [-5, 50, -3, 51, 0, 51, 1, 52, 0, 53, -1, 54, 0, 54, -2, 56, -3, 58,
      -5, 58, -6, 57, -5, 56, -3, 55, -4, 54, -3, 54, -5, 53, -4, 52, -5, 51],
    /* Irland */
    [-10, 52, -9, 51, -7, 52, -6, 52, -6, 54, -6, 55, -8, 55, -10, 54],
    /* Island */
    [-24, 65, -22, 66, -18, 66, -14, 66, -14, 65, -18, 64, -22, 64],
    /* Groenland */
    [-73, 78, -60, 82, -45, 83, -30, 82, -22, 76, -25, 70, -35, 66, -44, 60,
      -50, 62, -55, 67, -60, 70, -68, 76],
    /* Japan */
    [130, 31, 131, 34, 134, 34, 137, 34, 140, 35, 141, 38, 141, 41, 139, 40,
      137, 37, 136, 36, 133, 36, 131, 35, 129, 33],
    [140, 42, 141, 45, 144, 44, 145, 43, 143, 42],
    /* Sumatra, Java, Borneo, Sulawesi, Neuguinea */
    [95, 6, 98, 4, 101, 2, 104, -2, 106, -6, 103, -6, 100, -3, 97, 1],
    [105, -6, 110, -6, 114, -8, 114, -9, 109, -8, 105, -7],
    [109, 2, 113, 3, 117, 4, 119, 1, 117, -3, 114, -4, 110, -3, 109, 0],
    [119, 1, 122, 1, 125, 1, 125, -2, 122, -5, 120, -5, 120, -2],
    [131, -1, 136, -2, 141, -3, 145, -5, 148, -9, 143, -9, 138, -8, 134, -5,
      131, -3],
    /* Philippinen */
    [120, 18, 122, 18, 122, 14, 125, 12, 126, 9, 126, 7, 123, 6, 121, 8,
      120, 14],
    /* Australien */
    [114, -22, 113, -26, 115, -32, 118, -35, 123, -34, 129, -32, 134, -33,
      138, -35, 141, -38, 145, -38, 148, -37, 150, -35, 153, -28, 153, -25,
      149, -21, 146, -19, 143, -14, 142, -11, 141, -13, 137, -12, 136, -15,
      133, -12, 130, -12, 127, -14, 124, -16, 122, -18, 118, -20],
    /* Tasmanien */
    [145, -41, 148, -41, 148, -43, 146, -43],
    /* Neuseeland */
    [173, -35, 175, -36, 178, -38, 177, -40, 174, -41, 173, -38],
    [172, -41, 174, -42, 173, -45, 170, -46, 167, -46, 166, -45, 169, -43],
    /* Madagaskar */
    [44, -12, 50, -15, 50, -19, 47, -25, 45, -25, 43, -22, 43, -17],
    /* Sri Lanka */
    [80, 9, 82, 8, 82, 6, 80, 6],
    /* Kuba */
    [-85, 22, -80, 23, -75, 20, -78, 20, -82, 21],
  ];

  /* Binnenmeere. Sie liegen mitten in einer Landmasse und lassen sich
     als Loch im Streckenzug nicht sauber zeichnen - also kommen sie
     danach in Ozeanfarbe obendrauf. */
  var BINNEN = [
    /* Schwarzes Meer */
    [28, 41, 33, 42, 38, 44, 41, 43, 40, 45, 38, 46, 34, 46, 31, 46, 29, 45],
    /* Kaspisches Meer */
    [47, 45, 51, 45, 53, 42, 54, 41, 53, 37, 50, 37, 49, 40, 48, 42],
    /* Grosse Seen */
    [-92, 47, -85, 48, -82, 45, -79, 43, -76, 44, -80, 42, -83, 41, -87, 42,
      -88, 45],
    /* Hudson Bay */
    [-95, 61, -88, 60, -82, 56, -78, 53, -80, 60, -85, 63, -92, 64],
  ];

  function pfad(c, poly, w, h) {
    c.beginPath();
    c.moveTo(px(poly[0], w), py(poly[1], h));
    for (var i = 2; i < poly.length; i += 2) {
      c.lineTo(px(poly[i], w), py(poly[i + 1], h));
    }
    c.closePath();
  }

  /* ------------------------------------------------------------------
     Weltkarte
     ------------------------------------------------------------------ */

  Rd.mapLayer = function (w, h) {
    return G.cache('spy-map:' + Math.round(w) + 'x' + Math.round(h), w, h, function (c) {
      // Ozean
      c.fillStyle = G.linear(c, 0, 0, 0, h, [0, '#081524', 1, '#0b1c2f']);
      c.fillRect(0, 0, w, h);

      /* Gradnetz: alle 30 Grad Laenge, alle 20 Grad Breite. Aequator
         und Wendekreise sind eine Spur heller - das gibt der Karte
         einen Massstab, ohne dass Zahlen danebenstehen muessen. */
      c.lineWidth = 1;
      for (var lon = -150; lon <= 150; lon += 30) {
        c.strokeStyle = lon === 0 ? 'rgba(120,170,230,.14)' : 'rgba(120,170,230,.06)';
        c.beginPath();
        c.moveTo(px(lon, w), 0);
        c.lineTo(px(lon, w), h);
        c.stroke();
      }
      for (var lat = 80; lat >= -40; lat -= 20) {
        c.strokeStyle = lat === 0 ? 'rgba(120,170,230,.14)' : 'rgba(120,170,230,.06)';
        c.beginPath();
        c.moveTo(0, py(lat, h));
        c.lineTo(w, py(lat, h));
        c.stroke();
      }

      /* Landmassen. Erst ein weicher Saum nach aussen, dann die Flaeche -
         so heben sich die Kuesten vom Wasser ab, ohne dass eine zweite
         Linie noetig waere. */
      c.save();
      c.shadowColor = 'rgba(90,150,220,.5)';
      c.shadowBlur = Math.max(3, w * 0.006);
      LAND.forEach(function (poly) {
        pfad(c, poly, w, h);
        c.fillStyle = '#1b2b40';
        c.fill();
      });
      c.restore();

      LAND.forEach(function (poly) {
        pfad(c, poly, w, h);
        c.fillStyle = '#1b2b40';
        c.fill();
        c.strokeStyle = 'rgba(150,195,245,.3)';
        c.lineWidth = 1.1;
        c.stroke();
      });

      // Binnenmeere zurueck auf Wasserfarbe
      BINNEN.forEach(function (poly) {
        pfad(c, poly, w, h);
        c.fillStyle = '#0b1c2f';
        c.fill();
        c.strokeStyle = 'rgba(150,195,245,.22)';
        c.lineWidth = 1;
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
