/* ------------------------------------------------------------------
   Tetris

   Vollstaendige moderne Regeln: 7-Bag-Zufall, SRS-Drehung mit
   Wall-Kicks, Halten, Geisterstein, Lock-Delay mit Reset, T-Spin-
   Erkennung, Back-to-Back und Combo.

   Steuerung auf dem iPad: seitwaerts ziehen bewegt den Stein Feld fuer
   Feld, Tippen dreht, nach unten wischen ist ein Hard Drop, langsam
   nach unten ziehen ist Soft Drop. Zusaetzlich Knoepfe unten.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var G = SG.gfx;
  var UI = SG.ui;

  var COLS = 10, ROWS = 20, HIDDEN = 2;

  var SHAPES = {
    I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
    O: [[1, 1], [1, 1]],
    S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
  };
  var ORDER = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
  var COLORS = {
    I: '#3fd0d8', J: '#4a7dff', L: '#ff9c3f', O: '#f5d13f',
    S: '#3ddc84', T: '#b071ff', Z: '#ff5f6b',
  };

  /* Wall-Kicks in Bildschirmkoordinaten (y zeigt nach unten) */
  var KICK_JLSTZ = {
    '0>1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '1>0': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    '1>2': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    '2>1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '2>3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    '3>2': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '3>0': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '0>3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  };
  var KICK_I = {
    '0>1': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
    '1>0': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
    '1>2': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
    '2>1': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
    '2>3': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
    '3>2': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
    '3>0': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
    '0>3': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  };

  /* Fallgeschwindigkeit in Sekunden pro Zeile */
  function gravity(level) {
    var t = Math.pow(0.8 - (level - 1) * 0.007, level - 1);
    return Math.max(0.0016, t);
  }

  function rotCW(m) {
    var n = m.length, r = [];
    for (var y = 0; y < n; y++) {
      r.push([]);
      for (var x = 0; x < n; x++) r[y].push(m[n - 1 - x][y]);
    }
    return r;
  }

  function mount(host) {
    var st = {
      grid: null,
      piece: null, px: 0, py: 0, rot: 0, shape: null,
      hold: null, holdUsed: false,
      bag: [], next: [],
      score: 0, lines: 0, level: 1,
      combo: -1, b2b: false,
      dropTimer: 0, lockTimer: 0, lockResets: 0,
      clearing: null, clearT: 0,
      over: false, paused: false,
      lastKick: 0, lastWasRotate: false,
      msg: '', msgT: 0,
      shakeAmt: 0,
    };

    var stage = host.canvas({ alpha: false });
    var ctx = stage.ctx;
    var shake = G.shake();
    var parts = G.particles(220);

    var sScore = host.stat('Punkte', '0', 'gold');
    var sLines = host.stat('Reihen', '0');
    var sLevel = host.stat('Level', '1');
    var sBest = host.stat('Bestwert', '—');

    var loop;
    host.tool('❚❚', function () { togglePause(); });
    host.menuTool([
      { icon: '↻', label: 'Neues Spiel', onClick: function () { reset(); } },
      { icon: '?', label: 'Anleitung', onClick: function () { help(true); } },
    ]);

    function togglePause() {
      if (st.over) return;
      var p = loop.toggle();
      if (p) host.showPause(function () { loop.resume(true); });
    }

    /* ---------------------------------------------------------- Steine */

    function refill() {
      var b = ORDER.slice();
      U.shuffle(b);
      st.bag = st.bag.concat(b);
    }
    function pull() {
      if (st.bag.length < 8) refill();
      return st.bag.shift();
    }

    function spawn(kind) {
      st.piece = kind || st.next.shift();
      while (st.next.length < 5) st.next.push(pull());
      st.shape = SHAPES[st.piece].map(function (r) { return r.slice(); });
      st.rot = 0;
      st.px = Math.floor((COLS - st.shape.length) / 2);
      st.py = HIDDEN - (st.piece === 'I' ? 1 : (st.piece === 'O' ? 0 : 1));
      st.holdUsed = false;
      st.lockTimer = 0; st.lockResets = 0;
      st.lastWasRotate = false;
      if (collide(st.shape, st.px, st.py)) gameOver();
    }

    function collide(shape, px, py) {
      for (var y = 0; y < shape.length; y++) {
        for (var x = 0; x < shape.length; x++) {
          if (!shape[y][x]) continue;
          var gx = px + x, gy = py + y;
          if (gx < 0 || gx >= COLS || gy >= ROWS + HIDDEN) return true;
          if (gy >= 0 && st.grid[gy][gx]) return true;
        }
      }
      return false;
    }

    function move(dx, dy) {
      if (collide(st.shape, st.px + dx, st.py + dy)) return false;
      st.px += dx; st.py += dy;
      if (dx) st.lastWasRotate = false;
      resetLock();
      return true;
    }

    function resetLock() {
      if (!grounded()) { st.lockTimer = 0; return; }
      if (st.lockResets < 15) { st.lockTimer = 0; st.lockResets++; }
    }

    function grounded() { return collide(st.shape, st.px, st.py + 1); }

    function rotate(dir) {
      if (st.piece === 'O') return false;
      var from = st.rot;
      var to = U.mod(st.rot + dir, 4);
      var s = st.shape;
      var times = dir > 0 ? 1 : 3;
      for (var i = 0; i < times; i++) s = rotCW(s);

      var table = st.piece === 'I' ? KICK_I : KICK_JLSTZ;
      var kicks = table[from + '>' + to] || [[0, 0]];
      for (i = 0; i < kicks.length; i++) {
        var kx = kicks[i][0], ky = kicks[i][1];
        if (!collide(s, st.px + kx, st.py + ky)) {
          st.shape = s;
          st.rot = to;
          st.px += kx; st.py += ky;
          st.lastKick = i;
          st.lastWasRotate = true;
          resetLock();
          host.sfx('rotate');
          return true;
        }
      }
      host.sfx('error');
      return false;
    }

    function holdPiece() {
      if (st.holdUsed || st.over) return;
      var cur = st.piece;
      if (st.hold) {
        var h = st.hold;
        st.hold = cur;
        spawn(h);
      } else {
        st.hold = cur;
        spawn();
      }
      st.holdUsed = true;
      host.sfx('whoosh');
    }

    function hardDrop() {
      var n = 0;
      while (move(0, 1)) n++;
      st.score += n * 2;
      shake.hit(6, 0.16);
      host.sfx('drop');
      host.buzz(16);
      lock();
    }

    /* T-Spin: T-Stein, letzte Aktion war eine Drehung, 3 der 4
       Diagonalfelder um das Zentrum sind belegt. */
    function tspin() {
      if (st.piece !== 'T' || !st.lastWasRotate) return 0;
      var cx = st.px + 1, cy = st.py + 1;
      var corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
      var filled = 0, frontFilled = 0;
      var front = [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]][st.rot];
      for (var i = 0; i < 4; i++) {
        var gx = cx + corners[i][0], gy = cy + corners[i][1];
        var solid = gx < 0 || gx >= COLS || gy >= ROWS + HIDDEN ||
          (gy >= 0 && st.grid[gy][gx]);
        if (solid) filled++;
      }
      for (i = 0; i < 2; i++) {
        var fx = cx + front[i][0], fy = cy + front[i][1];
        if (fx < 0 || fx >= COLS || fy >= ROWS + HIDDEN || (fy >= 0 && st.grid[fy][fx])) frontFilled++;
      }
      if (filled < 3) return 0;
      return frontFilled === 2 ? 2 : 1;    // 2 = voller T-Spin, 1 = Mini
    }

    function lock() {
      var spin = tspin();
      for (var y = 0; y < st.shape.length; y++) {
        for (var x = 0; x < st.shape.length; x++) {
          if (!st.shape[y][x]) continue;
          var gy = st.py + y, gx = st.px + x;
          if (gy >= 0) st.grid[gy][gx] = st.piece;
        }
      }

      var full = [];
      for (y = 0; y < ROWS + HIDDEN; y++) {
        var all = true;
        for (x = 0; x < COLS; x++) if (!st.grid[y][x]) { all = false; break; }
        if (all) full.push(y);
      }

      if (full.length) {
        score(full.length, spin);
        st.clearing = full;
        st.clearT = 0;
        // Partikel auf den vollen Reihen
        full.forEach(function (row) {
          for (var i = 0; i < COLS; i++) {
            var p = cellPos(i, row);
            parts.burst(p.x + L.cell / 2, p.y + L.cell / 2, 3, {
              color: [COLORS[st.grid[row][i]] || '#fff', '#ffffff'],
              speed: 130, life: 0.5, size: 3, g: 320,
            });
          }
        });
        shake.hit(full.length >= 4 ? 14 : 6, 0.3);
        host.sfx(full.length >= 4 ? 'power' : 'clear');
        host.buzz(full.length >= 4 ? 40 : 18);
      } else {
        if (spin) {
          st.b2b = st.b2b;
          flash(spin === 2 ? 'T-Spin' : 'T-Spin Mini');
          st.score += (spin === 2 ? 400 : 100) * st.level;
        } else {
          st.combo = -1;
        }
        host.sfx('place');
        spawn();
      }
      syncBar();
    }

    function score(n, spin) {
      var base;
      var name = '';
      if (spin === 2) {
        base = [0, 800, 1200, 1600, 1600][n];
        name = ['', 'T-Spin Single', 'T-Spin Double', 'T-Spin Triple', 'T-Spin'][n];
      } else if (spin === 1) {
        base = [0, 200, 400, 600, 600][n];
        name = 'T-Spin Mini';
      } else {
        base = [0, 100, 300, 500, 800][n];
        name = ['', 'Single', 'Double', 'Triple', 'TETRIS'][n];
      }
      var difficult = n === 4 || spin > 0;
      var mult = 1;
      if (difficult && st.b2b) { mult = 1.5; name = 'B2B ' + name; }
      st.b2b = difficult;

      st.combo++;
      var comboPts = st.combo > 0 ? 50 * st.combo * st.level : 0;

      st.score += Math.round(base * st.level * mult) + comboPts;
      st.lines += n;
      var newLevel = Math.floor(st.lines / 10) + 1;
      if (newLevel > st.level) {
        st.level = newLevel;
        flash('Level ' + st.level);
        host.sfx('levelup');
      } else {
        flash(name + (st.combo > 0 ? '  ×' + (st.combo + 1) : ''));
      }
    }

    function flash(t) { st.msg = t; st.msgT = 1.4; }

    function finishClear() {
      st.clearing.sort(function (a, b) { return a - b; });
      st.clearing.forEach(function (row) {
        st.grid.splice(row, 1);
        st.grid.unshift(new Array(COLS).fill(null));
      });
      st.clearing = null;
      spawn();
    }

    function gameOver() {
      st.over = true;
      loop.pause();
      host.gameOver({
        title: 'Turm eingestürzt',
        sub: st.lines + ' Reihen · Level ' + st.level,
        score: st.score,
        onAgain: function () { reset(); },
      });
    }

    function syncBar() {
      sScore.set(U.num(st.score));
      sLines.set(U.num(st.lines));
      sLevel.set(String(st.level));
      var b = host.best();
      sBest.set(b === null ? '—' : U.num(b));
    }

    function reset() {
      st.grid = [];
      for (var y = 0; y < ROWS + HIDDEN; y++) st.grid.push(new Array(COLS).fill(null));
      st.hold = null; st.holdUsed = false;
      st.bag = []; st.next = [];
      refill();
      while (st.next.length < 5) st.next.push(pull());
      st.score = 0; st.lines = 0; st.level = 1;
      st.combo = -1; st.b2b = false;
      st.dropTimer = 0; st.clearing = null;
      st.over = false;
      st.msg = ''; st.msgT = 0;
      parts.clear();
      host.closeOverlay();
      spawn();
      syncBar();
      loop.resume(true);
    }

    /* ---------------------------------------------------------- Zeichnen */

    var L = { x: 0, y: 0, cell: 20, panelW: 0, side: true };

    function relayout(w, h) {
      var landscape = w > h * 1.15;
      L.side = landscape;
      var padPx = 10;
      // Im Hochformat brauchen die Anzeigeleiste (62 px) und die
      // Bedienknoepfe darunter (rund 86 px) zusammen Platz.
      var reserve = landscape ? 0 : 160;
      var cellH = (h - padPx * 2 - (landscape ? 0 : reserve)) / ROWS;
      var cellW = (w - padPx * 2 - (landscape ? 220 : 0)) / COLS;
      L.cell = Math.max(10, Math.floor(Math.min(cellW, cellH)));
      var bw = L.cell * COLS, bh = L.cell * ROWS;
      if (landscape) {
        L.panelW = Math.min(190, Math.max(110, L.cell * 4.6));
        L.x = Math.round((w - bw - L.panelW - 16) / 2 + L.panelW + 16);
        L.y = Math.round((h - bh) / 2);
      } else {
        L.panelW = 0;
        L.x = Math.round((w - bw) / 2);
        L.y = Math.round((h - bh - reserve) / 2) + 4;
      }
    }
    stage.onResize = relayout;

    function cellPos(cx, cy) {
      return { x: L.x + cx * L.cell, y: L.y + (cy - HIDDEN) * L.cell };
    }

    function block(x, y, size, color, alpha) {
      ctx.globalAlpha = alpha === undefined ? 1 : alpha;
      var r = Math.max(1.5, size * 0.14);
      G.fillRound(ctx, x + 1, y + 1, size - 2, size - 2, r, color);
      ctx.globalAlpha = (alpha === undefined ? 1 : alpha) * 0.35;
      G.fillRound(ctx, x + 2, y + 2, size - 4, (size - 4) * 0.42, r * 0.8, '#ffffff');
      ctx.globalAlpha = 1;
    }

    function drawMini(kind, x, y, size) {
      if (!kind) return;
      var s = SHAPES[kind];
      var n = s.length;
      // Begrenzungsrahmen der belegten Zellen
      var minX = n, maxX = -1, minY = n, maxY = -1;
      for (var yy = 0; yy < n; yy++) {
        for (var xx = 0; xx < n; xx++) {
          if (!s[yy][xx]) continue;
          minX = Math.min(minX, xx); maxX = Math.max(maxX, xx);
          minY = Math.min(minY, yy); maxY = Math.max(maxY, yy);
        }
      }
      var wCells = maxX - minX + 1, hCells = maxY - minY + 1;
      var ox = x - (wCells * size) / 2, oy = y - (hCells * size) / 2;
      for (yy = minY; yy <= maxY; yy++) {
        for (xx = minX; xx <= maxX; xx++) {
          if (!s[yy][xx]) continue;
          block(ox + (xx - minX) * size, oy + (yy - minY) * size, size, COLORS[kind]);
        }
      }
    }

    function draw() {
      var w = stage.w, h = stage.h;
      if (!L.cell) relayout(w, h);
      ctx.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0);
      ctx.fillStyle = '#0b0e15';
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      shake.apply(ctx);

      var c = L.cell;
      var bw = c * COLS, bh = c * ROWS;

      // Spielfeld
      G.fillRound(ctx, L.x - 4, L.y - 4, bw + 8, bh + 8, 8, '#141a27');
      ctx.fillStyle = '#0d121c';
      ctx.fillRect(L.x, L.y, bw, bh);

      ctx.strokeStyle = 'rgba(255,255,255,.035)';
      ctx.lineWidth = 1;
      for (var i = 1; i < COLS; i++) {
        ctx.beginPath();
        ctx.moveTo(L.x + i * c + .5, L.y); ctx.lineTo(L.x + i * c + .5, L.y + bh); ctx.stroke();
      }
      for (i = 1; i < ROWS; i++) {
        ctx.beginPath();
        ctx.moveTo(L.x, L.y + i * c + .5); ctx.lineTo(L.x + bw, L.y + i * c + .5); ctx.stroke();
      }

      // Liegende Steine
      var clearSet = {};
      if (st.clearing) st.clearing.forEach(function (r) { clearSet[r] = 1; });
      for (var y = HIDDEN; y < ROWS + HIDDEN; y++) {
        for (var x = 0; x < COLS; x++) {
          var v = st.grid[y][x];
          if (!v) continue;
          var p = cellPos(x, y);
          if (clearSet[y]) {
            var t = U.clamp(st.clearT / 0.22, 0, 1);
            ctx.save();
            ctx.globalAlpha = 1 - t;
            var sh = c * (1 - t * 0.75);
            block(p.x + (c - sh) / 2, p.y + (c - sh) / 2, sh, '#ffffff');
            ctx.restore();
          } else {
            block(p.x, p.y, c, COLORS[v]);
          }
        }
      }

      if (!st.over && st.piece && !st.clearing) {
        // Geisterstein
        var gy = st.py;
        while (!collide(st.shape, st.px, gy + 1)) gy++;
        for (y = 0; y < st.shape.length; y++) {
          for (x = 0; x < st.shape.length; x++) {
            if (!st.shape[y][x]) continue;
            var gp = cellPos(st.px + x, gy + y);
            if (gy + y < HIDDEN) continue;
            ctx.globalAlpha = 0.22;
            G.strokeRound(ctx, gp.x + 2, gp.y + 2, c - 4, c - 4, c * 0.14, COLORS[st.piece], 2);
            ctx.globalAlpha = 1;
          }
        }
        // Aktiver Stein
        var lockGlow = grounded() ? U.clamp(st.lockTimer / 0.5, 0, 1) : 0;
        for (y = 0; y < st.shape.length; y++) {
          for (x = 0; x < st.shape.length; x++) {
            if (!st.shape[y][x]) continue;
            if (st.py + y < HIDDEN) continue;
            var pp = cellPos(st.px + x, st.py + y);
            block(pp.x, pp.y, c, lockGlow > 0
              ? U.mixHex(COLORS[st.piece], '#ffffff', lockGlow * 0.5)
              : COLORS[st.piece]);
          }
        }
      }

      parts.draw(ctx);

      // Seitenleisten
      if (L.side) {
        var px = L.x - L.panelW - 16, pw = L.panelW;
        panel(px, L.y, pw, 'Halten', function (bx, by, bw2, bh2) {
          ctx.globalAlpha = st.holdUsed ? 0.35 : 1;
          drawMini(st.hold, bx + bw2 / 2, by + bh2 / 2, c * 0.62);
          ctx.globalAlpha = 1;
        }, c * 2.6);

        var ny = L.y + c * 2.6 + 42 + 14;
        panel(px, ny, pw, 'Als Nächstes', function (bx, by, bw2, bh2) {
          for (var k = 0; k < st.next.length; k++) {
            drawMini(st.next[k], bx + bw2 / 2, by + bh2 * (k + 0.5) / st.next.length,
              c * (k === 0 ? 0.62 : 0.44));
          }
        }, c * 8.4);
      } else {
        // Querleiste unter dem Feld
        var by2 = L.y + bh + 10;
        G.fillRound(ctx, L.x, by2, bw, 62, 10, '#141a27');
        G.text(ctx, 'HALTEN', L.x + 12, by2 + 16, { size: 9, weight: 800, color: '#5f6a85' });
        ctx.globalAlpha = st.holdUsed ? 0.35 : 1;
        drawMini(st.hold, L.x + 40, by2 + 38, c * 0.46);
        ctx.globalAlpha = 1;
        G.line(ctx, L.x + 78, by2 + 10, L.x + 78, by2 + 52, 'rgba(255,255,255,.1)', 1);
        G.text(ctx, 'ALS NÄCHSTES', L.x + 90, by2 + 16, { size: 9, weight: 800, color: '#5f6a85' });
        for (var k2 = 0; k2 < Math.min(4, st.next.length); k2++) {
          drawMini(st.next[k2], L.x + 118 + k2 * 46, by2 + 38, c * 0.4);
        }
      }

      // Meldung
      if (st.msgT > 0) {
        var a = U.clamp(st.msgT / 0.4, 0, 1);
        ctx.globalAlpha = a;
        G.text(ctx, st.msg, L.x + bw / 2, L.y + bh * 0.34, {
          size: Math.max(18, c * 1.05), weight: 800, color: '#ffd166',
          align: 'center', baseline: 'middle', shadow: 'rgba(0,0,0,.65)', sy: 2,
        });
        ctx.globalAlpha = 1;
      }

      ctx.restore();

      if (SG.settings.get('showFps')) {
        G.text(ctx, loop.fps + ' fps', 8, h - 8, { size: 11, color: '#5f6a85' });
      }
    }

    function panel(x, y, w, title, body, bodyH) {
      G.text(ctx, title.toUpperCase(), x + 4, y + 12, { size: 9.5, weight: 800, color: '#5f6a85' });
      G.fillRound(ctx, x, y + 20, w, bodyH, 10, '#141a27');
      body(x, y + 20, w, bodyH);
    }

    /* ---------------------------------------------------------- Schleife */

    loop = host.loop({
      hz: 60,
      update: function (dt) {
        if (st.over) return;
        shake.update(dt);
        parts.update(dt);
        if (st.msgT > 0) st.msgT -= dt;

        if (st.clearing) {
          st.clearT += dt;
          if (st.clearT >= 0.22) finishClear();
          return;
        }
        if (!st.piece) return;

        var g = gravity(st.level);
        if (softDrop) g = Math.min(g, 0.03);

        st.dropTimer += dt;
        while (st.dropTimer >= g) {
          st.dropTimer -= g;
          if (!collide(st.shape, st.px, st.py + 1)) {
            st.py++;
            st.lastWasRotate = false;
            if (softDrop) st.score += 1;
          } else break;
        }

        if (grounded()) {
          st.lockTimer += dt;
          if (st.lockTimer >= 0.5) lock();
        } else {
          st.lockTimer = 0;
          st.lockResets = 0;
        }
      },
      render: draw,
      onPause: function () { softDrop = false; },
    });

    /* ---------------------------------------------------------- Eingabe */

    var softDrop = false;
    var dragAccum = 0, dragY = 0, dragging = false;

    host.input({
      swipeMin: 34,
      tapMax: 12,
      onDown: function (p) {
        dragging = true; dragAccum = 0; dragY = 0;
      },
      onMove: function (p) {
        if (!dragging || st.over || !st.piece) return;
        dragAccum += p.dx;
        dragY += p.dy;
        var step = Math.max(18, L.cell * 0.85);
        while (dragAccum >= step) { move(1, 0); dragAccum -= step; host.sfx('move'); }
        while (dragAccum <= -step) { move(-1, 0); dragAccum += step; host.sfx('move'); }
        softDrop = dragY > step * 0.6 && Math.abs(p.dy) > 0;
      },
      onUp: function () { dragging = false; softDrop = false; },
      onTap: function () { if (!st.over) rotate(1); },
      onSwipe: function (dir, dx, dy, speed) {
        if (st.over) return;
        if (dir === 'down' && speed > 700) hardDrop();
        else if (dir === 'up') holdPiece();
      },
    });

    var pad = host.pad([
      { name: 'ccw', label: '⟲', cls: 'sm' },
      { name: 'cw', label: '⟳', cls: 'sm' },
      { name: 'hold', label: '⇩ Halten', cls: 'sm label' },
      { name: 'drop', label: '⤓ Drop', cls: 'sm label' },
    ], {
      pos: 'bottom',
      onPress: function (n) {
        if (st.over) return;
        if (n === 'ccw') rotate(-1);
        else if (n === 'cw') rotate(1);
        else if (n === 'hold') holdPiece();
        else if (n === 'drop') hardDrop();
      },
    });

    var keys = host.keys({
      onDown: function (k) {
        if (st.over) return;
        if (k === 'arrowleft') move(-1, 0);
        else if (k === 'arrowright') move(1, 0);
        else if (k === 'arrowup' || k === 'x') rotate(1);
        else if (k === 'y' || k === 'z' || k === 'control') rotate(-1);
        else if (k === 'space') hardDrop();
        else if (k === 'c' || k === 'shift') holdPiece();
        else if (k === 'p' || k === 'escape') togglePause();
      },
    });

    function help(force) {
      SG.tutorial.show({
        id: 'tetris', force: force, parent: host.root, title: 'Tetris',
        pages: [{
          kicker: 'Tetris', title: 'Reihen füllen, Reihen räumen',
          art: SG.tutorial.art.swipe,
          body: [
            { ic: '👆', text: '<b>Seitwärts ziehen</b> bewegt den Stein Feld für Feld.' },
            { ic: '⟳', text: '<b>Tippen</b> dreht im Uhrzeigersinn. Unten gibt es auch Knöpfe für beide Richtungen.' },
            { ic: '⤓', text: '<b>Schnell nach unten wischen</b> lässt den Stein sofort fallen (Hard Drop).' },
            { ic: '⇩', text: '<b>Nach oben wischen</b> legt den Stein ins Depot — später holst du ihn zurück.' },
            { ic: '4', text: 'Vier Reihen auf einmal ist ein <b>Tetris</b> und gibt am meisten Punkte. Zwei schwierige Räumungen hintereinander geben zusätzlich 50 %.' },
          ],
        }],
      });
    }

    reset();
    loop.start();
    help(false);

    return {
      state: st,
      destroy: function () { keys.destroy(); },
      selftest: function (steps) {
        reset();
        var r = U.rng(4711);
        for (var i = 0; i < (steps || 600); i++) {
          var a = r.int(10);
          if (a === 0) rotate(1);
          else if (a === 1) rotate(-1);
          else if (a === 2) move(-1, 0);
          else if (a === 3) move(1, 0);
          else if (a === 4) holdPiece();
          else if (a === 5 && !st.over) hardDrop();
          loop.tick(3);
          if (st.over) reset();
        }
        if (st.grid.length !== ROWS + HIDDEN) throw new Error('Feldhöhe verändert');
        draw();
      },
    };
  }

  SG.register({
    id: 'tetris',
    name: 'Tetris',
    category: 'arcade',
    desc: 'SRS, Halten, T-Spins, Hard Drop',
    tags: ['bloecke', 'klassiker', 'reihen', 'stapeln'],
    heavy: false,
    preview: function (c, w, h) {
      var cols = 8, rows = 10;
      var cell = Math.min(w / (cols + 5), h / rows);
      var x0 = (w - cell * cols) / 2, y0 = (h - cell * rows) / 2;
      c.fillStyle = '#0d121c';
      c.fillRect(x0, y0, cell * cols, cell * rows);
      var field = [
        '........', '........', '...T....', '..TTT...', '........',
        'I.......', 'I....SS.', 'IJJ.SS..', 'IJLLLZZ.', 'JJLOOZZ.',
      ];
      for (var y = 0; y < rows; y++) {
        for (var x = 0; x < cols; x++) {
          var ch = field[y][x];
          if (ch === '.') continue;
          var col = COLORS[ch] || '#888';
          var px = x0 + x * cell, py = y0 + y * cell;
          G.fillRound(c, px + 1, py + 1, cell - 2, cell - 2, Math.max(1, cell * .14), col);
          c.globalAlpha = .3;
          G.fillRound(c, px + 2, py + 2, cell - 4, (cell - 4) * .42, cell * .1, '#fff');
          c.globalAlpha = 1;
        }
      }
      c.strokeStyle = 'rgba(255,255,255,.06)';
      c.lineWidth = 1;
      c.strokeRect(x0 + .5, y0 + .5, cell * cols - 1, cell * rows - 1);
    },
    mount: mount,
  });
})(SG);
