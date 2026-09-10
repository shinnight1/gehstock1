/* ------------------------------------------------------------------
   Rohre verbinden - zwei Raetselarten in einem Spiel

   "Netz":  Jedes Rohrstueck drehen, bis alle Enden am Kessel haengen.
            Erzeugt aus einem zufaelligen Spannbaum, also immer loesbar.
   "Fluss": Gleichfarbige Punkte mit Wegen verbinden, bis das ganze
            Feld gefuellt ist. Erzeugt durch zufaellige Wegzerlegung.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var G = SG.gfx;
  var UI = SG.ui;

  var UP = 1, RIGHT = 2, DOWN = 4, LEFT = 8;
  var DIRS = [
    { bit: UP, dx: 0, dy: -1, opp: DOWN },
    { bit: RIGHT, dx: 1, dy: 0, opp: LEFT },
    { bit: DOWN, dx: 0, dy: 1, opp: UP },
    { bit: LEFT, dx: -1, dy: 0, opp: RIGHT },
  ];

  var FLOW_COLORS = ['#ff5f6b', '#4aa3ff', '#3ddc84', '#f0b429', '#a97bff',
    '#34d3d3', '#ff9c3f', '#ff7ac8', '#9ad14b', '#c8d4ea'];

  /* ==================================================================
     Erzeugung
     ================================================================== */

  var R = SG.rules.pipes = {};

  /* --- Netz: zufaelliger Spannbaum ueber das Gitter --- */
  R.makeNet = function (rng, w, h) {
    var n = w * h;
    var mask = new Uint8Array(n);
    var seen = new Uint8Array(n);
    var source = rng.int(n);
    var stack = [source];
    seen[source] = 1;
    var count = 1;

    while (count < n) {
      if (!stack.length) {
        // Sollte nicht passieren, aber sicher ist sicher
        for (var i = 0; i < n; i++) if (!seen[i]) { stack.push(i); seen[i] = 1; count++; break; }
      }
      var cur = stack[stack.length - 1];
      var cx = cur % w, cy = Math.floor(cur / w);
      var opts = [];
      for (var d = 0; d < 4; d++) {
        var nx = cx + DIRS[d].dx, ny = cy + DIRS[d].dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        var ni = ny * w + nx;
        if (seen[ni]) continue;
        opts.push({ d: d, ni: ni });
      }
      if (!opts.length) { stack.pop(); continue; }
      var pick = opts[rng.int(opts.length)];
      mask[cur] |= DIRS[pick.d].bit;
      mask[pick.ni] |= DIRS[pick.d].opp;
      seen[pick.ni] = 1;
      count++;
      stack.push(pick.ni);
    }
    return { mask: mask, source: source, w: w, h: h };
  };

  R.rotate = function (m, times) {
    for (var t = 0; t < times; t++) {
      m = ((m << 1) | (m >> 3)) & 0x0f;
    }
    return m;
  };

  /* Alles verbunden und keine offenen Enden? */
  R.netSolved = function (mask, w, h, source) {
    var n = w * h;
    for (var i = 0; i < n; i++) {
      var cx = i % w, cy = Math.floor(i / w);
      for (var d = 0; d < 4; d++) {
        if (!(mask[i] & DIRS[d].bit)) continue;
        var nx = cx + DIRS[d].dx, ny = cy + DIRS[d].dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) return false;   // Rohr ins Nichts
        if (!(mask[ny * w + nx] & DIRS[d].opp)) return false;        // Gegenstueck fehlt
      }
    }
    // Erreichbarkeit vom Kessel
    var seen = new Uint8Array(n);
    var stack = [source];
    seen[source] = 1;
    var cnt = 1;
    while (stack.length) {
      var k = stack.pop();
      var kx = k % w, ky = Math.floor(k / w);
      for (var d2 = 0; d2 < 4; d2++) {
        if (!(mask[k] & DIRS[d2].bit)) continue;
        var mx = kx + DIRS[d2].dx, my = ky + DIRS[d2].dy;
        var mi = my * w + mx;
        if (!seen[mi]) { seen[mi] = 1; cnt++; stack.push(mi); }
      }
    }
    return cnt === n;
  };

  /* --- Fluss: Gitter in Wege zerlegen --- */
  R.makeFlow = function (rng, w, h, maxColors) {
    for (var attempt = 0; attempt < 40; attempt++) {
      var n = w * h;
      var owner = new Int8Array(n).fill(-1);
      var paths = [];
      var seeds = Math.min(maxColors, Math.max(3, Math.round(n / 9)));
      var free = U.range(n);
      rng.shuffle(free);

      for (var s = 0; s < seeds && s < free.length; s++) {
        var start = free[s];
        if (owner[start] >= 0) { s--; continue; }
        owner[start] = paths.length;
        paths.push([start]);
      }

      // Wege abwechselnd wachsen lassen
      var growing = true;
      while (growing) {
        growing = false;
        for (var p = 0; p < paths.length; p++) {
          var path = paths[p];
          var tail = path[path.length - 1];
          var tx = tail % w, ty = Math.floor(tail / w);
          var opts = [];
          for (var d = 0; d < 4; d++) {
            var nx = tx + DIRS[d].dx, ny = ty + DIRS[d].dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            var ni = ny * w + nx;
            if (owner[ni] >= 0) continue;
            opts.push(ni);
          }
          if (!opts.length) continue;
          // Sackgassen bevorzugen -> weniger Restluecken
          opts.sort(function (a, b) { return freeNeighbors(a) - freeNeighbors(b); });
          var pick = opts.length > 1 && rng() < 0.7 ? opts[0] : opts[rng.int(opts.length)];
          owner[pick] = p;
          path.push(pick);
          growing = true;
        }
      }

      function freeNeighbors(i) {
        var x = i % w, y = Math.floor(i / w), c = 0;
        for (var d2 = 0; d2 < 4; d2++) {
          var ax = x + DIRS[d2].dx, ay = y + DIRS[d2].dy;
          if (ax < 0 || ay < 0 || ax >= w || ay >= h) continue;
          if (owner[ay * w + ax] < 0) c++;
        }
        return c;
      }

      // Restzellen an einen anliegenden Wegkopf anhaengen
      var stuck = false;
      for (var pass = 0; pass < 4; pass++) {
        var left = 0;
        for (var i = 0; i < n; i++) {
          if (owner[i] >= 0) continue;
          left++;
          var ix = i % w, iy = Math.floor(i / w);
          var done = false;
          for (var d3 = 0; d3 < 4 && !done; d3++) {
            var jx = ix + DIRS[d3].dx, jy = iy + DIRS[d3].dy;
            if (jx < 0 || jy < 0 || jx >= w || jy >= h) continue;
            var ji = jy * w + jx;
            var o = owner[ji];
            if (o < 0) continue;
            var pp = paths[o];
            if (pp[pp.length - 1] === ji) { pp.push(i); owner[i] = o; done = true; }
            else if (pp[0] === ji) { pp.unshift(i); owner[i] = o; done = true; }
          }
        }
        if (!left) break;
        if (pass === 3) stuck = true;
      }
      if (stuck) continue;

      // Zu kurze oder triviale Wege verwerfen
      var ok = true;
      for (p = 0; p < paths.length; p++) {
        if (paths[p].length < 3) { ok = false; break; }
      }
      if (!ok) continue;
      if (paths.length > maxColors) continue;

      return { w: w, h: h, paths: paths };
    }
    return null;
  };

  /* ==================================================================
     Spiel
     ================================================================== */

  var NET_LEVELS = [
    { id: 'n5', name: 'Netz klein', w: 5, h: 5 },
    { id: 'n7', name: 'Netz mittel', w: 7, h: 7 },
    { id: 'n9', name: 'Netz groß', w: 9, h: 9 },
    { id: 'n12', name: 'Netz riesig', w: 12, h: 9 },
  ];
  var FLOW_LEVELS = [
    { id: 'f5', name: 'Fluss klein', w: 5, h: 5, colors: 4 },
    { id: 'f7', name: 'Fluss mittel', w: 7, h: 7, colors: 6 },
    { id: 'f9', name: 'Fluss groß', w: 9, h: 9, colors: 8 },
  ];

  function mount(host) {
    var store = host.store;
    var levelId = store.get('level', 'n7');

    var st = {
      mode: 'net',
      w: 0, h: 0,
      mask: null, source: 0, locked: null,
      paths: null, ends: null, owner: null, colorOf: null,
      moves: 0, time: 0, running: false, done: false,
      spin: {},        // Zellenindex -> Restwinkel fuer die Drehanimation
      pulse: 0,
    };

    var stage = host.canvas({ alpha: false });
    var ctx = stage.ctx;

    var sMode = host.stat('Rätsel', '');
    var sMoves = host.stat('Züge', '0');
    var sTime = host.stat('Zeit', '0:00');

    host.tool('Neu', function () { newGame(); });
    host.menuTool([
      { icon: '▦', label: 'Rätsel wählen', onClick: chooseLevel },
      { icon: '?', label: 'Anleitung', onClick: function () { help(true); } },
    ]);

    function findLevel(id) {
      var all = NET_LEVELS.concat(FLOW_LEVELS);
      for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
      return NET_LEVELS[1];
    }

    function newGame(id) {
      if (id) { levelId = id; store.set('level', id); }
      var lv = findLevel(levelId);
      st.mode = lv.id[0] === 'n' ? 'net' : 'flow';
      st.w = lv.w; st.h = lv.h;
      st.moves = 0; st.time = 0; st.done = false; st.running = true;
      st.spin = {};
      host.closeOverlay();
      sMode.set(lv.name);
      sMoves.set('0');
      sTime.set('0:00');

      var rng = U.rng((Date.now() ^ (Math.random() * 1e9)) >>> 0);

      if (st.mode === 'net') {
        var net = R.makeNet(rng, lv.w, lv.h);
        st.mask = net.mask.slice();
        st.solutionMask = net.mask.slice();
        st.source = net.source;
        // Verdrehen, aber nicht alles in Ausgangslage lassen
        var same = true;
        for (var i = 0; i < st.mask.length; i++) {
          var t = rng.int(4);
          if (t) same = false;
          st.mask[i] = R.rotate(st.mask[i], t);
        }
        if (same) st.mask[0] = R.rotate(st.mask[0], 1);
      } else {
        var f = R.makeFlow(rng, lv.w, lv.h, lv.colors);
        if (!f) { newGame(levelId); return; }
        st.paths = f.paths;
        st.ends = {};
        st.colorOf = new Int8Array(lv.w * lv.h).fill(-1);
        st.owner = new Int8Array(lv.w * lv.h).fill(-1);
        st.draw = [];       // aktuelle Spielerwege
        f.paths.forEach(function (p, ci) {
          st.ends[p[0]] = ci;
          st.ends[p[p.length - 1]] = ci;
          st.draw.push([]);
        });
      }
      relayout(stage.w, stage.h);
    }

    /* ---------------------------------------------------------- Netz */

    function turn(i) {
      if (st.done) return;
      st.mask[i] = R.rotate(st.mask[i], 1);
      st.spin[i] = (st.spin[i] || 0) + Math.PI / 2;
      st.moves++;
      sMoves.set(U.num(st.moves));
      host.sfx('rotate');
      if (R.netSolved(st.mask, st.w, st.h, st.source)) win();
    }

    /* ---------------------------------------------------------- Fluss */

    function cellOwner(i) {
      for (var c = 0; c < st.draw.length; c++) {
        if (st.draw[c].indexOf(i) >= 0) return c;
      }
      if (st.ends[i] !== undefined) return st.ends[i];
      return -1;
    }

    var drawColor = -1;

    function flowStart(i) {
      if (st.done) return;
      var e = st.ends[i];
      if (e !== undefined) {
        drawColor = e;
        st.draw[e] = [i];
        host.sfx('tick');
        return;
      }
      var o = cellOwner(i);
      if (o >= 0) {
        // Weg ab dieser Stelle kuerzen und weiterzeichnen
        drawColor = o;
        var idx = st.draw[o].indexOf(i);
        if (idx >= 0) st.draw[o].length = idx + 1;
        host.sfx('tick');
      }
    }

    function flowMove(i) {
      if (drawColor < 0 || st.done) return;
      var path = st.draw[drawColor];
      if (!path.length) return;
      var last = path[path.length - 1];
      if (i === last) return;

      // Rueckwaerts gehen kuerzt
      if (path.length > 1 && path[path.length - 2] === i) {
        path.pop();
        return;
      }
      // Nur orthogonale Nachbarn
      var lx = last % st.w, ly = Math.floor(last / st.w);
      var ix = i % st.w, iy = Math.floor(i / st.w);
      if (Math.abs(lx - ix) + Math.abs(ly - iy) !== 1) return;

      // Fremdes Endstueck blockiert
      var e = st.ends[i];
      if (e !== undefined && e !== drawColor) return;

      // Fremde Wege werden abgeschnitten
      for (var c = 0; c < st.draw.length; c++) {
        if (c === drawColor) continue;
        var k = st.draw[c].indexOf(i);
        if (k >= 0) st.draw[c].length = k;
      }
      if (path.indexOf(i) >= 0) return;

      path.push(i);
      st.moves++;
      sMoves.set(U.num(st.moves));

      // Anderes Ende erreicht -> fertig
      if (e === drawColor && path.length > 1) {
        host.sfx('blip');
        drawColor = -1;
        checkFlowDone();
      }
    }

    function flowEnd() {
      drawColor = -1;
      checkFlowDone();
    }

    function flowConnected(c) {
      var p = st.draw[c];
      if (p.length < 2) return false;
      var a = p[0], b = p[p.length - 1];
      return st.ends[a] === c && st.ends[b] === c && a !== b;
    }

    function checkFlowDone() {
      var filled = 0;
      for (var c = 0; c < st.draw.length; c++) {
        if (!flowConnected(c)) return;
        filled += st.draw[c].length;
      }
      if (filled < st.w * st.h) return;
      win();
    }

    function win() {
      st.done = true;
      st.running = false;
      st.pulse = 1;
      host.sfx('win');
      host.stats('geloest', 1);
      host.gameOver({
        won: true,
        title: 'Alles dicht!',
        sub: findLevel(levelId).name + ' · ' + U.time(st.time),
        score: st.moves,
        mode: levelId,
        higher: false,
        scoreLabel: 'Züge',
        onAgain: function () { newGame(); },
      });
    }

    /* ---------------------------------------------------------- Zeichnen */

    var L = { x: 0, y: 0, cell: 30 };

    function relayout(w, h) {
      if (!st.w) return;
      var padPx = 16;
      L.cell = Math.max(20, Math.floor(Math.min((w - padPx * 2) / st.w, (h - padPx * 2) / st.h)));
      L.x = Math.round((w - L.cell * st.w) / 2);
      L.y = Math.round((h - L.cell * st.h) / 2);
    }
    stage.onResize = relayout;

    /* Welche Zellen haengen am Kessel? */
    function connectedSet() {
      var n = st.w * st.h;
      var seen = new Uint8Array(n);
      var stack = [st.source];
      seen[st.source] = 1;
      while (stack.length) {
        var k = stack.pop();
        var kx = k % st.w, ky = Math.floor(k / st.w);
        for (var d = 0; d < 4; d++) {
          if (!(st.mask[k] & DIRS[d].bit)) continue;
          var nx = kx + DIRS[d].dx, ny = ky + DIRS[d].dy;
          if (nx < 0 || ny < 0 || nx >= st.w || ny >= st.h) continue;
          var ni = ny * st.w + nx;
          if (!(st.mask[ni] & DIRS[d].opp)) continue;
          if (!seen[ni]) { seen[ni] = 1; stack.push(ni); }
        }
      }
      return seen;
    }

    function drawNet() {
      var c = L.cell;
      var conn = connectedSet();
      var lw = Math.max(3, c * 0.17);

      for (var i = 0; i < st.mask.length; i++) {
        var x = L.x + (i % st.w) * c, y = L.y + Math.floor(i / st.w) * c;
        var cx = x + c / 2, cy = y + c / 2;
        var on = conn[i];

        G.fillRound(ctx, x + 1, y + 1, c - 2, c - 2, c * 0.12,
          on ? '#1d2739' : '#171d2b');

        ctx.save();
        ctx.translate(cx, cy);
        var sp = st.spin[i] || 0;
        if (sp) ctx.rotate(-sp);

        ctx.strokeStyle = on ? '#4aa3ff' : '#4b5570';
        ctx.lineWidth = lw;
        ctx.lineCap = 'round';
        var m = st.mask[i];
        ctx.beginPath();
        for (var d = 0; d < 4; d++) {
          if (!(m & DIRS[d].bit)) continue;
          ctx.moveTo(0, 0);
          ctx.lineTo(DIRS[d].dx * c * 0.5, DIRS[d].dy * c * 0.5);
        }
        ctx.stroke();

        // Endstuecke bekommen einen Knoten
        var bits = 0;
        for (d = 0; d < 4; d++) if (m & DIRS[d].bit) bits++;
        if (bits === 1) {
          G.circle(ctx, 0, 0, c * 0.16, on ? '#7fc4ff' : '#5f6a85');
        }
        if (i === st.source) {
          G.circle(ctx, 0, 0, c * 0.26, '#f0b429');
          G.circle(ctx, 0, 0, c * 0.13, '#241a04');
        }
        ctx.restore();
      }

      if (st.pulse > 0) {
        ctx.save();
        ctx.globalAlpha = st.pulse * 0.6;
        G.strokeRound(ctx, L.x - 4, L.y - 4, st.w * c + 8, st.h * c + 8, 10, '#3ddc84', 4);
        ctx.restore();
      }
    }

    function drawFlow() {
      var c = L.cell;
      // Untergrund
      for (var y = 0; y < st.h; y++) {
        for (var x = 0; x < st.w; x++) {
          ctx.fillStyle = (x + y) % 2 ? '#141a27' : '#171e2c';
          ctx.fillRect(L.x + x * c, L.y + y * c, c - 1, c - 1);
        }
      }
      // Wege
      var lw = c * 0.42;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (var ci = 0; ci < st.draw.length; ci++) {
        var p = st.draw[ci];
        if (p.length < 2) continue;
        ctx.strokeStyle = FLOW_COLORS[ci % FLOW_COLORS.length];
        ctx.globalAlpha = flowConnected(ci) ? 1 : 0.62;
        ctx.lineWidth = lw;
        ctx.beginPath();
        for (var k = 0; k < p.length; k++) {
          var px = L.x + (p[k] % st.w) * c + c / 2;
          var py = L.y + Math.floor(p[k] / st.w) * c + c / 2;
          if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // Endpunkte
      for (var key in st.ends) {
        var i = +key;
        var ex = L.x + (i % st.w) * c + c / 2;
        var ey = L.y + Math.floor(i / st.w) * c + c / 2;
        var col = FLOW_COLORS[st.ends[i] % FLOW_COLORS.length];
        G.circle(ctx, ex, ey, c * 0.3, col);
        ctx.save();
        ctx.globalAlpha = 0.35;
        G.circle(ctx, ex - c * 0.08, ey - c * 0.09, c * 0.11, '#ffffff');
        ctx.restore();
      }
    }

    function draw() {
      var w = stage.w, h = stage.h;
      if (!L.cell || !st.w) relayout(w, h);
      ctx.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0);
      ctx.fillStyle = '#0b0e15';
      ctx.fillRect(0, 0, w, h);
      if (!st.w) return;
      G.fillRound(ctx, L.x - 6, L.y - 6, st.w * L.cell + 12, st.h * L.cell + 12, 10, '#111725');
      if (st.mode === 'net') drawNet(); else drawFlow();
    }

    /* ---------------------------------------------------------- Schleife */

    var loop = host.loop({
      hz: 60,
      update: function (dt) {
        if (st.running && !st.done) { st.time += dt; sTime.set(U.time(st.time)); }
        if (st.pulse > 0) st.pulse = Math.max(0, st.pulse - dt * 0.8);
        for (var k in st.spin) {
          st.spin[k] = Math.max(0, st.spin[k] - dt * 11);
          if (st.spin[k] <= 0) delete st.spin[k];
        }
      },
      render: draw,
    });

    function cellAt(x, y) {
      var cx = Math.floor((x - L.x) / L.cell);
      var cy = Math.floor((y - L.y) / L.cell);
      if (cx < 0 || cy < 0 || cx >= st.w || cy >= st.h) return -1;
      return cy * st.w + cx;
    }

    host.input({
      onTap: function (x, y) {
        if (st.mode !== 'net') return;
        var i = cellAt(x, y);
        if (i >= 0) turn(i);
      },
      onDown: function (p) {
        if (st.mode !== 'flow') return;
        var i = cellAt(p.x, p.y);
        if (i >= 0) flowStart(i);
      },
      onMove: function (p) {
        if (st.mode !== 'flow') return;
        var i = cellAt(p.x, p.y);
        if (i >= 0) flowMove(i);
      },
      onUp: function () { if (st.mode === 'flow') flowEnd(); },
      tapMax: 10,
    });

    function chooseLevel() {
      var body = UI.el('div');
      body.appendChild(UI.el('div.sec-head', null, [UI.el('h2', { text: 'Netz — Rohre drehen' })]));
      NET_LEVELS.concat(FLOW_LEVELS).forEach(function (l, n) {
        if (n === NET_LEVELS.length) {
          body.appendChild(UI.el('div.sec-head', null, [UI.el('h2', { text: 'Fluss — Punkte verbinden' })]));
        }
        var b = host.best(l.id);
        body.appendChild(UI.el('div.item.tap' + (l.id === levelId ? '.sel' : ''), {
          on: { click: function () { m.close(); newGame(l.id); } },
        }, [
          UI.el('div.thumb', { text: l.id[0] === 'n' ? '⌗' : '⁙' }),
          UI.el('div.main', null, [
            UI.el('div.t', { text: l.name }),
            UI.el('div.d', { text: l.w + '×' + l.h + (l.colors ? ' · bis ' + l.colors + ' Farben' : '') }),
          ]),
          UI.el('div.side', null, [
            UI.el('div.p', { text: b === null ? '—' : U.num(b) }),
            UI.el('div.s', { text: 'beste Züge' }),
          ]),
        ]));
      });
      var m = host.modal({ title: 'Rätsel wählen', body: body });
    }

    function help(force) {
      SG.tutorial.show({
        id: 'pipes', force: force, parent: host.root, title: 'Rohre verbinden',
        pages: [
          {
            kicker: 'Netz', title: 'Alles an den Kessel',
            art: SG.tutorial.art.tap,
            body: [
              { ic: '👆', text: 'Auf ein Rohrstück tippen dreht es um <b>90°</b>.' },
              { ic: '🟡', text: 'Der <b>gelbe Kessel</b> ist die Quelle. Angeschlossene Rohre leuchten blau.' },
              { ic: '🎯', text: 'Fertig, wenn <b>jedes</b> Rohr am Kessel hängt und kein Ende ins Leere zeigt.' },
            ],
          },
          {
            kicker: 'Fluss', title: 'Farben verbinden',
            art: SG.tutorial.art.swipe,
            body: [
              { ic: '👆', text: 'Von einem farbigen Punkt <b>zum gleichfarbigen ziehen</b>.' },
              { ic: '🚫', text: 'Wege dürfen sich nicht kreuzen — ein fremder Weg wird abgeschnitten.' },
              { ic: '🎯', text: 'Fertig, wenn alle Paare verbunden sind <b>und das ganze Feld gefüllt ist</b>.' },
              { ic: '↩', text: 'Auf einen bestehenden Weg tippen und weiterziehen kürzt ihn.' },
            ],
          },
        ],
      });
    }

    newGame(levelId);
    loop.start();
    help(false);

    return {
      state: st,
      selftest: function () {
        // Netz: aus der Loesung heraus muss es sofort geloest sein
        var rng = U.rng(31337);
        var net = R.makeNet(rng, 7, 7);
        if (!R.netSolved(net.mask, 7, 7, net.source)) {
          throw new Error('Erzeugtes Netz ist nicht gelöst');
        }
        var m2 = net.mask.slice();
        m2[0] = R.rotate(m2[0], 1);
        if (m2[0] !== net.mask[0] && R.netSolved(m2, 7, 7, net.source)) {
          throw new Error('Verdrehtes Netz gilt faelschlich als gelöst');
        }
        // Vier Drehungen ergeben wieder dasselbe
        for (var i = 0; i < 16; i++) {
          if (R.rotate(i, 4) !== i) throw new Error('Drehung nicht zyklisch');
        }
        // Fluss: Zerlegung muss das Feld genau abdecken
        var f = R.makeFlow(U.rng(99), 7, 7, 6);
        if (!f) throw new Error('Kein Fluss-Rätsel erzeugt');
        var cover = new Uint8Array(49);
        f.paths.forEach(function (p) {
          p.forEach(function (k) {
            if (cover[k]) throw new Error('Zelle doppelt belegt');
            cover[k] = 1;
          });
        });
        for (i = 0; i < 49; i++) if (!cover[i]) throw new Error('Zelle nicht abgedeckt');

        // Im laufenden Spiel: Netz loesen
        newGame('n5');
        for (i = 0; i < st.mask.length; i++) {
          var guard = 0;
          while (st.mask[i] !== st.solutionMask[i] && guard++ < 4) {
            st.mask[i] = R.rotate(st.mask[i], 1);
          }
        }
        if (!R.netSolved(st.mask, st.w, st.h, st.source)) {
          throw new Error('Zurückgedrehtes Netz nicht gelöst');
        }
        draw();
      },
    };
  }

  SG.register({
    id: 'pipes',
    name: 'Rohre verbinden',
    category: 'puzzle',
    desc: 'Netz drehen oder Farben verbinden',
    tags: ['rohre', 'pipes', 'flow', 'verbinden', 'netz'],
    preview: function (c, w, h) {
      var n = 5;
      var cell = Math.min(w, h) * 0.82 / n;
      var x0 = (w - cell * n) / 2, y0 = (h - cell * n) / 2;
      G.fillRound(c, x0 - 5, y0 - 5, cell * n + 10, cell * n + 10, 8, '#111725');
      var masks = [
        6, 12, 10, 12, 8,
        3, 5, 5, 3, 9,
        6, 9, 15, 6, 9,
        5, 12, 5, 3, 8,
        3, 10, 12, 9, 0,
      ];
      var on = [1, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1, 0];
      for (var i = 0; i < n * n; i++) {
        var x = x0 + (i % n) * cell, y = y0 + Math.floor(i / n) * cell;
        var cx = x + cell / 2, cy = y + cell / 2;
        G.fillRound(c, x + 1, y + 1, cell - 2, cell - 2, cell * 0.12, on[i] ? '#1d2739' : '#171d2b');
        c.strokeStyle = on[i] ? '#4aa3ff' : '#4b5570';
        c.lineWidth = Math.max(2, cell * 0.16);
        c.lineCap = 'round';
        c.beginPath();
        for (var d = 0; d < 4; d++) {
          if (!(masks[i] & DIRS[d].bit)) continue;
          c.moveTo(cx, cy);
          c.lineTo(cx + DIRS[d].dx * cell * 0.5, cy + DIRS[d].dy * cell * 0.5);
        }
        c.stroke();
      }
      G.circle(c, x0 + cell * 2.5, y0 + cell * 2.5, cell * 0.26, '#f0b429');
    },
    mount: mount,
  });
})(SG);
