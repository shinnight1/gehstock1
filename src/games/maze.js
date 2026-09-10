/* ------------------------------------------------------------------
   Labyrinth-Fresser

   Vier Geister mit je eigenem Kopf: einer jagt direkt, einer schneidet
   den Weg ab, einer zielt ueber den Jaeger hinweg, einer wird schuechtern,
   wenn er zu nah kommt. Dazu Jagd- und Streuphasen, Kraftpillen und
   ein Tunnel.

   Die Labyrinthe entstehen symmetrisch im Browser - jede Runde ein
   neues, aber immer vollstaendig begehbar und ohne Sackgassen.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var G = SG.gfx;

  var MW = 19, MH = 21;        // Labyrinthmass (ungerade fuer saubere Gaenge)
  var WALL = 1, OPEN = 0;

  var DIRS = [
    { x: 0, y: -1, name: 'up' },
    { x: -1, y: 0, name: 'left' },
    { x: 0, y: 1, name: 'down' },
    { x: 1, y: 0, name: 'right' },
  ];

  /* ==================================================================
     Labyrintherzeugung: halbe Breite bauen, dann spiegeln.
     ================================================================== */

  var R = SG.rules.maze = {};

  R.build = function (rng) {
    var hw = Math.ceil(MW / 2);           // 10 Spalten inkl. Mittelspalte
    var g = [];
    var y, x;
    for (y = 0; y < MH; y++) {
      g.push([]);
      for (x = 0; x < hw; x++) g[y].push(WALL);
    }

    /* Gaenge auf ungeraden Koordinaten ausgraben */
    function carve(cx, cy) {
      g[cy][cx] = OPEN;
      var order = [0, 1, 2, 3];
      rng.shuffle(order);
      for (var i = 0; i < 4; i++) {
        var d = DIRS[order[i]];
        var nx = cx + d.x * 2, ny = cy + d.y * 2;
        if (nx < 1 || ny < 1 || nx > hw - 1 || ny > MH - 2) continue;
        if (g[ny][nx] === OPEN) continue;
        g[cy + d.y][cx + d.x] = OPEN;
        carve(nx, ny);
      }
    }
    carve(1, 1);

    /* Zusaetzliche Durchbrueche: Sackgassen sind in so einem Spiel toedlich */
    for (var pass = 0; pass < 3; pass++) {
      for (y = 1; y < MH - 1; y++) {
        for (x = 1; x < hw; x++) {
          if (g[y][x] !== WALL) continue;
          var openN = 0;
          for (var d2 = 0; d2 < 4; d2++) {
            var ax = x + DIRS[d2].x, ay = y + DIRS[d2].y;
            if (ax < 0 || ay < 0 || ax >= hw || ay >= MH) continue;
            if (g[ay][ax] === OPEN) openN++;
          }
          if (openN >= 2 && rng() < 0.32) g[y][x] = OPEN;
        }
      }
    }

    /* Mittelspalte oeffnen, damit beide Haelften verbunden sind */
    for (y = 1; y < MH - 1; y += 2) g[y][hw - 1] = OPEN;

    /* Spiegeln */
    var full = [];
    for (y = 0; y < MH; y++) {
      var row = [];
      for (x = 0; x < hw; x++) row.push(g[y][x]);
      for (x = hw - 2; x >= 0; x--) row.push(g[y][x]);
      full.push(row);
    }

    /* Tunnelzeile in der Mitte: Raender oeffnen */
    var ty = Math.floor(MH / 2);
    var found = -1;
    for (var off = 0; off < 4 && found < 0; off++) {
      for (var s = -1; s <= 1; s += 2) {
        var cand = ty + off * s;
        if (cand < 1 || cand >= MH - 1) continue;
        if (full[cand][1] === OPEN && full[cand][MW - 2] === OPEN) { found = cand; break; }
      }
    }
    if (found < 0) {
      found = ty;
      for (x = 1; x < MW - 1; x++) full[found][x] = OPEN;
    }
    full[found][0] = OPEN;
    full[found][MW - 1] = OPEN;

    /* Sackgassen aufloesen, wo es noch welche gibt */
    for (pass = 0; pass < 2; pass++) {
      for (y = 1; y < MH - 1; y++) {
        for (x = 1; x < MW - 1; x++) {
          if (full[y][x] !== OPEN) continue;
          var n = 0, wallDirs = [];
          for (d2 = 0; d2 < 4; d2++) {
            ax = x + DIRS[d2].x; ay = y + DIRS[d2].y;
            if (full[ay][ax] === OPEN) n++;
            else wallDirs.push(d2);
          }
          if (n === 1 && wallDirs.length) {
            var pick = wallDirs[rng.int(wallDirs.length)];
            var wx = x + DIRS[pick].x, wy = y + DIRS[pick].y;
            if (wx > 0 && wy > 0 && wx < MW - 1 && wy < MH - 1) full[wy][wx] = OPEN;
          }
        }
      }
    }

    return { grid: full, tunnelY: found };
  };

  /* Alle offenen Felder von einem Startpunkt aus erreichbar? */
  R.reachable = function (grid, sx, sy) {
    var seen = [];
    var y, x;
    for (y = 0; y < MH; y++) { seen.push([]); for (x = 0; x < MW; x++) seen[y].push(0); }
    var stack = [[sx, sy]];
    seen[sy][sx] = 1;
    var n = 1;
    while (stack.length) {
      var p = stack.pop();
      for (var d = 0; d < 4; d++) {
        var nx = U.mod(p[0] + DIRS[d].x, MW), ny = p[1] + DIRS[d].y;
        if (ny < 0 || ny >= MH) continue;
        if (grid[ny][nx] !== OPEN || seen[ny][nx]) continue;
        seen[ny][nx] = 1; n++;
        stack.push([nx, ny]);
      }
    }
    return { seen: seen, count: n };
  };

  /* ==================================================================
     Spiel
     ================================================================== */

  var GHOSTS = [
    { id: 'blinky', col: '#ff5f6b', name: 'Rot' },
    { id: 'pinky', col: '#ff9ad1', name: 'Rosa' },
    { id: 'inky', col: '#34d3d3', name: 'Türkis' },
    { id: 'clyde', col: '#ff9c3f', name: 'Orange' },
  ];

  /* Streuen / Jagen im Wechsel, wie im Vorbild */
  var PHASES = [7, 20, 7, 20, 5, 20, 5, 1e9];

  function mount(host) {
    var st = {
      grid: null, dots: null, dotCount: 0, tunnelY: 10,
      pac: null, ghosts: [],
      level: 1, score: 0, lives: 3,
      fright: 0, frightChain: 0,
      phase: 0, phaseT: 0,
      fruit: null, fruitT: 0,
      over: false, ready: 2, dying: 0, cleared: 0,
      t: 0,
    };

    var stage = host.canvas({ alpha: false });
    var ctx = stage.ctx;
    var parts = G.particles(200);

    var sScore = host.stat('Punkte', '0', 'gold');
    var sLevel = host.stat('Level', '1');
    var sLives = host.stat('Leben', '3', 'red');
    var sBest = host.stat('Bestwert', '—');

    var loop;
    host.tool('❚❚', function () {
      var p = loop.toggle();
      if (p) host.showPause(function () { loop.resume(true); });
    });
    host.menuTool([
      { icon: '↻', label: 'Neues Spiel', onClick: function () { reset(); } },
      { icon: '?', label: 'Anleitung', onClick: function () { help(true); } },
    ]);

    var wallLayer = null;

    /* ---------------------------------------------------------- Aufbau */

    function newMaze() {
      var rng = U.rng((Date.now() ^ (Math.random() * 1e9)) >>> 0);
      var m, tries = 0;
      do {
        m = R.build(rng);
        var start = findOpen(m.grid, Math.floor(MW / 2), MH - 3);
        var rr = R.reachable(m.grid, start[0], start[1]);
        var openCount = 0;
        for (var y = 0; y < MH; y++) {
          for (var x = 0; x < MW; x++) if (m.grid[y][x] === OPEN) openCount++;
        }
        if (rr.count === openCount && openCount > 90) break;
        tries++;
      } while (tries < 25);

      st.grid = m.grid;
      st.tunnelY = m.tunnelY;
      wallLayer = null;

      // Punkte verteilen
      st.dots = [];
      st.dotCount = 0;
      for (y = 0; y < MH; y++) {
        st.dots.push([]);
        for (x = 0; x < MW; x++) {
          if (st.grid[y][x] === OPEN) { st.dots[y].push(1); st.dotCount++; }
          else st.dots[y].push(0);
        }
      }
      // Vier Kraftpillen moeglichst weit aussen
      var corners = [[1, 1], [MW - 2, 1], [1, MH - 2], [MW - 2, MH - 2]];
      corners.forEach(function (c) {
        var p = findOpen(st.grid, c[0], c[1]);
        if (p) st.dots[p[1]][p[0]] = 2;
      });
    }

    function findOpen(grid, sx, sy) {
      for (var r = 0; r < 12; r++) {
        for (var dy = -r; dy <= r; dy++) {
          for (var dx = -r; dx <= r; dx++) {
            var x = sx + dx, y = sy + dy;
            if (x < 1 || y < 1 || x >= MW - 1 || y >= MH - 1) continue;
            if (grid[y][x] === OPEN) return [x, y];
          }
        }
      }
      return [1, 1];
    }

    function placeActors() {
      var p = findOpen(st.grid, Math.floor(MW / 2), MH - 3);
      st.pac = {
        x: p[0], y: p[1], px: p[0], py: p[1],
        dir: 3, want: 3, moving: 0, mouth: 0,
      };
      // Der Punkt unter dem Startfeld verschwindet - er muss auch aus dem
      // Zaehler heraus. Sonst bleibt dotCount fuer immer um eins zu hoch,
      // die Bedingung dotCount <= 0 wird nie wahr und die Ebene laesst sich
      // nicht abschliessen, obwohl das Feld leergefressen ist.
      if (st.dots[p[1]][p[0]]) st.dotCount--;
      st.dots[p[1]][p[0]] = 0;

      var home = findOpen(st.grid, Math.floor(MW / 2), Math.floor(MH / 2));
      st.ghosts = GHOSTS.map(function (g, i) {
        var q = findOpen(st.grid, home[0] + (i % 2 ? 1 : -1) * (1 + i), home[1] + (i > 1 ? 1 : -1));
        return {
          def: g, x: q[0], y: q[1], px: q[0], py: q[1],
          dir: i % 4, moving: 0,
          state: 'out', eaten: 0, wait: i * 1.6,
          scatter: [[MW - 2, 1], [1, 1], [MW - 2, MH - 2], [1, MH - 2]][i],
        };
      });
    }

    function reset(keepScore) {
      if (!keepScore) { st.score = 0; st.lives = 3; st.level = 1; }
      st.over = false;
      st.fright = 0; st.frightChain = 0;
      st.phase = 0; st.phaseT = 0;
      st.fruit = null; st.fruitT = 14;
      st.ready = 2; st.dying = 0; st.cleared = 0;
      newMaze();
      placeActors();
      parts.clear();
      host.closeOverlay();
      relayout(stage.w, stage.h);
      syncBar();
      loop.resume(true);
    }

    function nextLevel() {
      st.level++;
      st.cleared = 0;
      st.ready = 1.6;
      st.fright = 0;
      st.phase = 0; st.phaseT = 0;
      newMaze();
      placeActors();
      syncBar();
    }

    function syncBar() {
      sScore.set(U.num(st.score));
      sLevel.set(String(st.level));
      sLives.set(String(st.lives));
      var b = host.best();
      sBest.set(b === null ? '—' : U.num(b));
    }

    /* ---------------------------------------------------------- Bewegung */

    function open(x, y) {
      if (y < 0 || y >= MH) return false;
      x = U.mod(x, MW);
      return st.grid[y][x] === OPEN;
    }

    function canGo(x, y, d) {
      return open(x + DIRS[d].x, y + DIRS[d].y);
    }

    function speedOf(who) {
      if (who === 'pac') return 5.4 + Math.min(1.6, st.level * 0.12);
      return 4.9 + Math.min(1.9, st.level * 0.13);
    }

    function movePac(dt) {
      var p = st.pac;
      var sp = speedOf('pac');
      p.moving += sp * dt;
      p.mouth += dt * 11;

      while (p.moving >= 1) {
        p.moving -= 1;
        p.px = p.x; p.py = p.y;

        // Gewuenschte Richtung bevorzugen (Buffered Turn)
        if (canGo(p.x, p.y, p.want)) p.dir = p.want;
        if (!canGo(p.x, p.y, p.dir)) { p.moving = 0; break; }

        p.x = U.mod(p.x + DIRS[p.dir].x, MW);
        p.y += DIRS[p.dir].y;

        eatAt(p.x, p.y);
      }
      p.px = p.x; p.py = p.y;
    }

    function eatAt(x, y) {
      var d = st.dots[y][x];
      if (d === 1) {
        st.dots[y][x] = 0;
        st.dotCount--;
        st.score += 10;
        host.sfx('tick');
      } else if (d === 2) {
        st.dots[y][x] = 0;
        st.dotCount--;
        st.score += 50;
        st.fright = Math.max(2.5, 8 - st.level * 0.4);
        st.frightChain = 0;
        st.ghosts.forEach(function (g) {
          if (g.state === 'out') { g.state = 'fright'; g.dir = (g.dir + 2) % 4; }
        });
        host.sfx('power');
        host.buzz(30);
      }
      if (st.fruit && st.fruit.x === x && st.fruit.y === y) {
        st.score += st.fruit.pts;
        var fp = cellPx(x, y);
        parts.burst(fp.x, fp.y, 14, { color: ['#ff5f6b', '#ffd166'], speed: 120, life: 0.5, size: 3, g: 200 });
        st.fruit = null;
        host.sfx('coin');
      }
      syncBar();
      if (st.dotCount <= 0) {
        st.cleared = 1.4;
        st.score += 300 + st.level * 50;
        host.sfx('win');
      }
    }

    function ghostTarget(g, i) {
      var p = st.pac;
      if (g.state === 'eaten') return findOpen(st.grid, Math.floor(MW / 2), Math.floor(MH / 2));
      if (g.state === 'fright') return [U.irand(1, MW - 2), U.irand(1, MH - 2)];
      var scatterPhase = st.phase % 2 === 0;
      if (scatterPhase) return g.scatter;

      switch (g.def.id) {
        case 'blinky':
          return [p.x, p.y];
        case 'pinky':
          return [p.x + DIRS[p.dir].x * 4, p.y + DIRS[p.dir].y * 4];
        case 'inky': {
          var b = st.ghosts[0];
          var ax = p.x + DIRS[p.dir].x * 2, ay = p.y + DIRS[p.dir].y * 2;
          return [ax + (ax - b.x), ay + (ay - b.y)];
        }
        default: {
          var d = U.dist(g.x, g.y, p.x, p.y);
          return d > 6 ? [p.x, p.y] : g.scatter;
        }
      }
    }

    function moveGhost(g, i, dt) {
      if (g.wait > 0) { g.wait -= dt; return; }
      var sp = speedOf('ghost');
      if (g.state === 'fright') sp *= 0.62;
      if (g.state === 'eaten') sp *= 1.9;
      g.moving += sp * dt;

      while (g.moving >= 1) {
        g.moving -= 1;
        g.px = g.x; g.py = g.y;

        var target = ghostTarget(g, i);
        var best = -1, bestD = Infinity;
        for (var d = 0; d < 4; d++) {
          if (d === (g.dir + 2) % 4) continue;         // nicht umkehren
          if (!canGo(g.x, g.y, d)) continue;
          var nx = U.mod(g.x + DIRS[d].x, MW), ny = g.y + DIRS[d].y;
          var dd = U.dist2(nx, ny, target[0], target[1]);
          if (g.state === 'fright') dd = Math.random() * 1000;
          if (dd < bestD) { bestD = dd; best = d; }
        }
        if (best < 0) best = (g.dir + 2) % 4;           // Sackgasse: doch umkehren
        if (!canGo(g.x, g.y, best)) { g.moving = 0; break; }
        g.dir = best;
        g.x = U.mod(g.x + DIRS[best].x, MW);
        g.y += DIRS[best].y;

        if (g.state === 'eaten') {
          var home = findOpen(st.grid, Math.floor(MW / 2), Math.floor(MH / 2));
          if (Math.abs(g.x - home[0]) + Math.abs(g.y - home[1]) <= 1) {
            g.state = 'out';
            g.wait = 0.5;
          }
        }
      }
    }

    function collide() {
      var p = st.pac;
      for (var i = 0; i < st.ghosts.length; i++) {
        var g = st.ghosts[i];
        if (g.wait > 0) continue;
        if (g.x !== p.x || g.y !== p.y) continue;
        if (g.state === 'eaten') continue;
        if (g.state === 'fright') {
          st.frightChain++;
          var pts = 200 * Math.pow(2, Math.min(3, st.frightChain - 1));
          st.score += pts;
          g.state = 'eaten';
          var q = cellPx(g.x, g.y);
          parts.burst(q.x, q.y, 14, { color: [g.def.col, '#ffffff'], speed: 130, life: 0.5, size: 3, g: 0, drag: 3 });
          host.sfx('coin');
          syncBar();
        } else {
          die();
          return;
        }
      }
    }

    function die() {
      st.dying = 1.6;
      st.lives--;
      syncBar();
      host.sfx('lose');
      host.buzz(60);
      var q = cellPx(st.pac.x, st.pac.y);
      parts.burst(q.x, q.y, 22, { color: ['#f0b429', '#ffd166'], speed: 160, life: 0.7, size: 3.5, g: 180 });
    }

    function afterDeath() {
      if (st.lives <= 0) {
        st.over = true;
        host.gameOver({
          title: 'Gefangen',
          sub: 'Level ' + st.level,
          score: st.score,
          onAgain: function () { reset(); },
        });
        return;
      }
      placeActors();
      st.fright = 0;
      st.ready = 1.4;
    }

    /* ---------------------------------------------------------- Schritt */

    function step(dt) {
      st.t += dt;
      parts.update(dt);
      if (st.over) return;

      if (st.cleared > 0) {
        st.cleared -= dt;
        if (st.cleared <= 0) nextLevel();
        return;
      }
      if (st.dying > 0) {
        st.dying -= dt;
        if (st.dying <= 0) afterDeath();
        return;
      }
      if (st.ready > 0) { st.ready -= dt; return; }

      if (st.fright > 0) {
        st.fright -= dt;
        if (st.fright <= 0) {
          st.ghosts.forEach(function (g) { if (g.state === 'fright') g.state = 'out'; });
        }
      } else {
        st.phaseT += dt;
        if (st.phaseT >= PHASES[Math.min(st.phase, PHASES.length - 1)]) {
          st.phaseT = 0;
          st.phase++;
          st.ghosts.forEach(function (g) { if (g.state === 'out') g.dir = (g.dir + 2) % 4; });
        }
      }

      st.fruitT -= dt;
      if (st.fruitT <= 0 && !st.fruit && st.dotCount > 10) {
        var p = findOpen(st.grid, U.irand(2, MW - 3), U.irand(2, MH - 3));
        st.fruit = { x: p[0], y: p[1], pts: 100 * st.level, life: 9 };
        st.fruitT = 22;
      }
      if (st.fruit) {
        st.fruit.life -= dt;
        if (st.fruit.life <= 0) st.fruit = null;
      }

      movePac(dt);
      for (var i = 0; i < st.ghosts.length; i++) moveGhost(st.ghosts[i], i, dt);
      collide();
    }

    /* ---------------------------------------------------------- Zeichnen */

    var L = { x: 0, y: 0, cell: 20 };

    function relayout(w, h) {
      var pad = 10, reserve = 80;
      L.cell = Math.max(10, Math.floor(Math.min(
        (w - pad * 2) / MW, (h - pad * 2 - reserve) / MH)));
      L.x = Math.round((w - L.cell * MW) / 2);
      L.y = Math.round((h - reserve - L.cell * MH) / 2) + 6;
      wallLayer = null;
    }
    stage.onResize = relayout;

    function cellPx(x, y) {
      return { x: L.x + x * L.cell + L.cell / 2, y: L.y + y * L.cell + L.cell / 2 };
    }

    function buildWalls() {
      var c = L.cell;
      wallLayer = SG.canvas.layer(MW * c, MH * c, 1);
      var g2 = wallLayer.ctx;
      wallLayer.ensure(function (cc) {
        cc.strokeStyle = '#3a5fa8';
        cc.lineWidth = Math.max(2, c * 0.16);
        cc.lineCap = 'round';
        for (var y = 0; y < MH; y++) {
          for (var x = 0; x < MW; x++) {
            if (st.grid[y][x] !== WALL) continue;
            // Wandsegmente zu den Nachbarwaenden zeichnen -> zusammenhaengende Linien
            var cx = x * c + c / 2, cy = y * c + c / 2;
            var drew = false;
            for (var d = 0; d < 4; d++) {
              var nx = x + DIRS[d].x, ny = y + DIRS[d].y;
              if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue;
              if (st.grid[ny][nx] !== WALL) continue;
              cc.beginPath();
              cc.moveTo(cx, cy);
              cc.lineTo(cx + DIRS[d].x * c * 0.5, cy + DIRS[d].y * c * 0.5);
              cc.stroke();
              drew = true;
            }
            if (!drew) {
              cc.beginPath();
              cc.arc(cx, cy, c * 0.09, 0, 6.283);
              cc.fillStyle = '#3a5fa8';
              cc.fill();
            }
          }
        }
      });
    }

    function draw() {
      var w = stage.w, h = stage.h;
      if (!L.cell) relayout(w, h);
      ctx.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0);
      ctx.fillStyle = '#05070c';
      ctx.fillRect(0, 0, w, h);
      if (!st.grid) return;
      if (!wallLayer) buildWalls();

      var c = L.cell;
      ctx.drawImage(wallLayer.canvas, L.x, L.y);

      // Punkte
      for (var y = 0; y < MH; y++) {
        for (var x = 0; x < MW; x++) {
          var d = st.dots[y][x];
          if (!d) continue;
          var p = cellPx(x, y);
          if (d === 1) G.circle(ctx, p.x, p.y, c * 0.09, '#ffd9a0');
          else {
            var s = 0.2 + Math.sin(st.t * 6) * 0.045;
            G.circle(ctx, p.x, p.y, c * s, '#ffd166');
          }
        }
      }

      // Frucht
      if (st.fruit) {
        var fp = cellPx(st.fruit.x, st.fruit.y);
        G.circle(ctx, fp.x, fp.y, c * 0.3, '#ff5f6b');
        ctx.strokeStyle = '#3ddc84';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(fp.x, fp.y - c * 0.28);
        ctx.lineTo(fp.x + c * 0.16, fp.y - c * 0.44);
        ctx.stroke();
      }

      // Geister
      for (var i = 0; i < st.ghosts.length; i++) {
        var g = st.ghosts[i];
        var gp = cellPx(g.x, g.y);
        var r = c * 0.42;
        var col = g.def.col;
        if (g.state === 'fright') {
          col = st.fright < 2 && Math.floor(st.t * 8) % 2 ? '#ffffff' : '#3a5fa8';
        }
        if (g.state === 'eaten') {
          // nur Augen
          drawEyes(gp.x, gp.y, r, g.dir);
          continue;
        }
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(gp.x, gp.y - r * 0.12, r, Math.PI, 0);
        ctx.lineTo(gp.x + r, gp.y + r * 0.7);
        // Zackenrand
        var waves = 3;
        for (var k = 0; k < waves * 2; k++) {
          var t2 = 1 - (k + 1) / (waves * 2);
          var yy = gp.y + r * 0.7 - (k % 2 ? r * 0.26 : 0);
          ctx.lineTo(gp.x - r + 2 * r * t2, yy);
        }
        ctx.closePath();
        ctx.fill();
        if (g.state !== 'fright') drawEyes(gp.x, gp.y, r, g.dir);
        else {
          G.circle(ctx, gp.x - r * 0.34, gp.y - r * 0.18, r * 0.14, '#ffffff');
          G.circle(ctx, gp.x + r * 0.34, gp.y - r * 0.18, r * 0.14, '#ffffff');
        }
      }

      // Spielfigur
      if (st.dying <= 0) {
        var pp = cellPx(st.pac.x, st.pac.y);
        var mouth = Math.abs(Math.sin(st.pac.mouth)) * 0.72;
        var ang = [-Math.PI / 2, Math.PI, Math.PI / 2, 0][st.pac.dir];
        ctx.fillStyle = '#f0b429';
        ctx.beginPath();
        ctx.moveTo(pp.x, pp.y);
        ctx.arc(pp.x, pp.y, c * 0.42, ang + mouth / 2, ang - mouth / 2 + Math.PI * 2);
        ctx.closePath();
        ctx.fill();
      } else {
        var dp = cellPx(st.pac.x, st.pac.y);
        var t3 = 1 - st.dying / 1.6;
        ctx.fillStyle = '#f0b429';
        ctx.globalAlpha = 1 - t3;
        ctx.beginPath();
        ctx.moveTo(dp.x, dp.y);
        ctx.arc(dp.x, dp.y, c * 0.42, -Math.PI / 2 + t3 * Math.PI, -Math.PI / 2 - t3 * Math.PI + Math.PI * 2);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      parts.draw(ctx);

      // Hinweise
      if (st.ready > 0) {
        G.text(ctx, 'Bereit!', L.x + MW * c / 2, L.y + MH * c * 0.58, {
          size: c * 1.1, weight: 800, color: '#ffd166', align: 'center', baseline: 'middle',
        });
      }
      if (st.cleared > 0) {
        G.text(ctx, 'Level geschafft!', L.x + MW * c / 2, L.y + MH * c * 0.58, {
          size: c * 0.9, weight: 800, color: '#3ddc84', align: 'center', baseline: 'middle',
        });
      }
      if (st.fright > 0) {
        G.progress(ctx, L.x, L.y + MH * c + 6, MW * c, 4, st.fright / 8, '#4aa3ff', 'rgba(255,255,255,.08)');
      }
    }

    function drawEyes(x, y, r, dir) {
      var dx = DIRS[dir].x * r * 0.18, dy = DIRS[dir].y * r * 0.18;
      G.circle(ctx, x - r * 0.34, y - r * 0.2, r * 0.24, '#ffffff');
      G.circle(ctx, x + r * 0.34, y - r * 0.2, r * 0.24, '#ffffff');
      G.circle(ctx, x - r * 0.34 + dx, y - r * 0.2 + dy, r * 0.12, '#1a2740');
      G.circle(ctx, x + r * 0.34 + dx, y - r * 0.2 + dy, r * 0.12, '#1a2740');
    }

    /* ---------------------------------------------------------- Steuerung */

    loop = host.loop({ hz: 60, update: step, render: draw });

    var DIRMAP = { up: 0, left: 1, down: 2, right: 3 };

    host.input({
      swipeMin: 18,
      onSwipe: function (d) { if (st.pac) st.pac.want = DIRMAP[d]; },
    });

    var dpad = host.dpad({
      pos: SG.settings.get('leftHanded') ? 'br' : 'bl',
      onPress: function (n) { if (st.pac) st.pac.want = DIRMAP[n]; },
    });

    var keys = host.keys({
      onDown: function (k) {
        var m = {
          arrowup: 0, w: 0, arrowleft: 1, a: 1,
          arrowdown: 2, s: 2, arrowright: 3, d: 3,
        };
        if (m[k] !== undefined && st.pac) st.pac.want = m[k];
      },
    });

    function help(force) {
      SG.tutorial.show({
        id: 'maze', force: force, parent: host.root, title: 'Labyrinth-Fresser',
        pages: [{
          kicker: 'Labyrinth-Fresser', title: 'Alles wegfuttern',
          art: SG.tutorial.art.swipe,
          body: [
            { ic: '👆', text: '<b>Wischen</b> oder Steuerkreuz. Die Richtung wird gemerkt und an der nächsten Abzweigung genommen.' },
            { ic: '🟡', text: 'Die <b>großen Pillen</b> in den Ecken machen die Geister für ein paar Sekunden essbar — jeder weitere in Folge zählt doppelt.' },
            { ic: '👻', text: 'Jeder Geist denkt anders: einer verfolgt dich direkt, einer schneidet ab, einer zielt über dich hinweg, einer weicht aus, wenn er zu nah kommt.' },
            { ic: '🍒', text: 'Ab und zu erscheint eine <b>Frucht</b>. Sie bleibt nicht lange.' },
            { ic: '🌀', text: 'Der <b>Tunnel</b> an den Seiten bringt dich auf die andere Seite.' },
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
        // Erzeugte Labyrinthe muessen vollstaendig begehbar sein
        for (var n = 0; n < 6; n++) {
          var rng = U.rng(1000 + n);
          var m = R.build(rng);
          var openCount = 0, first = null;
          for (var y = 0; y < MH; y++) {
            for (var x = 0; x < MW; x++) {
              if (m.grid[y][x] === OPEN) { openCount++; if (!first) first = [x, y]; }
            }
          }
          if (openCount < 80) throw new Error('Labyrinth zu klein: ' + openCount + ' Felder');
          var rr = R.reachable(m.grid, first[0], first[1]);
          if (rr.count !== openCount) {
            throw new Error('Labyrinth zerfaellt: ' + rr.count + ' von ' + openCount);
          }
        }
        reset();
        relayout(900, 620);
        st.ready = 0;
        var r2 = U.rng(5);
        for (var i = 0; i < (steps || 600); i++) {
          if (r2() < 0.2) st.pac.want = r2.int(4);
          step(1 / 60);
          if (st.over) reset();
          if (st.pac.y < 0 || st.pac.y >= MH) throw new Error('Figur außerhalb des Labyrinths');
        }
        draw();
      },
    };
  }

  SG.register({
    id: 'maze',
    name: 'Labyrinth-Fresser',
    category: 'arcade',
    desc: 'Vier Geister mit eigenem Kopf',
    tags: ['pacman', 'geister', 'labyrinth', 'klassiker'],
    preview: function (c, w, h) {
      c.fillStyle = '#05070c';
      c.fillRect(0, 0, w, h);
      var cell = Math.min(w / 13, h / 9);
      var x0 = (w - cell * 13) / 2, y0 = (h - cell * 9) / 2;
      var rows = [
        '#############', '#...........#', '#.##.###.##.#', '#.#.......#.#',
        '#...#.#.#...#', '#.#.......#.#', '#.##.###.##.#', '#...........#',
        '#############',
      ];
      c.strokeStyle = '#3a5fa8';
      c.lineWidth = Math.max(2, cell * 0.16);
      c.lineCap = 'round';
      for (var y = 0; y < 9; y++) {
        for (var x = 0; x < 13; x++) {
          if (rows[y][x] !== '#') continue;
          var cx = x0 + x * cell + cell / 2, cy = y0 + y * cell + cell / 2;
          [[1, 0], [0, 1], [-1, 0], [0, -1]].forEach(function (d) {
            var nx = x + d[0], ny = y + d[1];
            if (nx < 0 || ny < 0 || nx > 12 || ny > 8) return;
            if (rows[ny][nx] !== '#') return;
            c.beginPath();
            c.moveTo(cx, cy);
            c.lineTo(cx + d[0] * cell * 0.5, cy + d[1] * cell * 0.5);
            c.stroke();
          });
        }
      }
      for (y = 0; y < 9; y++) {
        for (x = 0; x < 13; x++) {
          if (rows[y][x] !== '.') continue;
          G.circle(c, x0 + x * cell + cell / 2, y0 + y * cell + cell / 2, cell * 0.09, '#ffd9a0');
        }
      }
      // Figur
      var px = x0 + 6.5 * cell, py = y0 + 4.5 * cell;
      c.fillStyle = '#f0b429';
      c.beginPath();
      c.moveTo(px, py);
      c.arc(px, py, cell * 0.42, 0.35, -0.35 + Math.PI * 2);
      c.closePath();
      c.fill();
      // Geist
      var gx = x0 + 3.5 * cell, gy = y0 + 2.5 * cell, r = cell * 0.42;
      c.fillStyle = '#ff5f6b';
      c.beginPath();
      c.arc(gx, gy - r * 0.12, r, Math.PI, 0);
      c.lineTo(gx + r, gy + r * 0.7);
      for (var k = 0; k < 6; k++) {
        var t = 1 - (k + 1) / 6;
        c.lineTo(gx - r + 2 * r * t, gy + r * 0.7 - (k % 2 ? r * 0.26 : 0));
      }
      c.closePath();
      c.fill();
      G.circle(c, gx - r * 0.34, gy - r * 0.2, r * 0.24, '#fff');
      G.circle(c, gx + r * 0.34, gy - r * 0.2, r * 0.24, '#fff');
      G.circle(c, gx - r * 0.28, gy - r * 0.2, r * 0.12, '#1a2740');
      G.circle(c, gx + r * 0.4, gy - r * 0.2, r * 0.12, '#1a2740');
    },
    mount: mount,
  });
})(SG);
