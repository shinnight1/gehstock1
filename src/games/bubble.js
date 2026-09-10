/* ------------------------------------------------------------------
   Bubble Shooter

   Sechseckraster, acht Farben. Drei gleiche in Beruehrung platzen,
   alles was dadurch den Halt verliert, faellt hinterher. Die Zielhilfe
   rechnet den Bandenschuss an den Seitenwaenden mit.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var G = SG.gfx;

  var COLS = 11;                 // Bubbles in geraden Zeilen
  var MAXROWS = 14;
  var COLORS = ['#ff5f6b', '#4aa3ff', '#3ddc84', '#f0b429', '#a97bff', '#34d3d3', '#ff9c3f', '#ff7ac8'];

  function mount(host) {
    var st = {
      grid: [],            // grid[row][col] = Farbindex oder -1
      rowOffset: 0,        // 0 = gerade Zeile oben, 1 = versetzt
      cur: -1, next: -1,
      shot: null,
      aim: -Math.PI / 2,
      level: 1, score: 0, shots: 0,
      colorsInPlay: 4,
      pops: [], drops: [],
      over: false, won: 0,
      t: 0, danger: 0,
      shotsUntilRow: 8,
    };

    var stage = host.canvas({ alpha: false });
    var ctx = stage.ctx;
    var parts = G.particles(240);
    var shake = G.shake();

    var sScore = host.stat('Punkte', '0', 'gold');
    var sLevel = host.stat('Level', '1');
    var sRow = host.stat('Nächste Reihe', '8');
    var sBest = host.stat('Bestwert', '—');

    var loop;
    host.menuTool([
      { icon: '↻', label: 'Neu ab Level 1', onClick: function () { reset(1); } },
      { icon: '?', label: 'Anleitung', onClick: function () { help(true); } },
    ]);

    /* ---------------------------------------------------------- Raster */

    function colsIn(row) { return ((row + st.rowOffset) % 2 === 0) ? COLS : COLS - 1; }

    function makeRow(row, density) {
      var arr = [];
      for (var c = 0; c < colsIn(row); c++) {
        arr.push(Math.random() < density ? U.irand(0, st.colorsInPlay - 1) : -1);
      }
      return arr;
    }

    function reset(level) {
      st.level = level || 1;
      if (level === 1) st.score = 0;
      st.colorsInPlay = Math.min(COLORS.length, 3 + Math.floor(st.level / 2));
      st.grid = [];
      st.rowOffset = 0;
      var rows = Math.min(9, 4 + Math.floor(st.level / 2));
      for (var r = 0; r < rows; r++) {
        st.grid.push(makeRow(r, r < rows - 1 ? 1 : 0.6));
      }
      st.shots = 0;
      st.shotsUntilRow = Math.max(4, 9 - Math.floor(st.level / 3));
      st.shot = null;
      st.pops = []; st.drops = [];
      st.over = false; st.won = 0;
      st.cur = pickColor();
      st.next = pickColor();
      parts.clear();
      host.closeOverlay();
      relayout(stage.w, stage.h);
      syncBar();
      loop.resume(true);
    }

    /* Nur Farben nachlegen, die noch im Feld sind - sonst wird es unfair */
    function pickColor() {
      var present = {};
      var any = false;
      for (var r = 0; r < st.grid.length; r++) {
        for (var c = 0; c < st.grid[r].length; c++) {
          if (st.grid[r][c] >= 0) { present[st.grid[r][c]] = 1; any = true; }
        }
      }
      if (!any) return U.irand(0, st.colorsInPlay - 1);
      var list = Object.keys(present).map(Number);
      return list[U.irand(0, list.length - 1)];
    }

    function syncBar() {
      sScore.set(U.num(st.score));
      sLevel.set(String(st.level));
      sRow.set(String(Math.max(0, st.shotsUntilRow - (st.shots % 99))));
      var b = host.best();
      sBest.set(b === null ? '—' : U.num(b));
    }

    /* ---------------------------------------------------------- Geometrie */

    var L = { x: 0, y: 0, r: 18, dx: 36, dy: 31 };

    function relayout(w, h) {
      var margin = 10;
      var avail = Math.min(w - margin * 2, (h - 120) * 0.86);
      L.dx = avail / COLS;
      L.r = L.dx / 2 - 1;
      L.dy = L.dx * 0.866;
      L.x = (w - L.dx * COLS) / 2;
      L.y = 14;
      L.shooterY = Math.min(h - 62, L.y + L.dy * MAXROWS + 60);
    }
    stage.onResize = relayout;

    function cellPos(row, col) {
      var off = (colsIn(row) === COLS) ? 0 : L.dx / 2;
      return {
        x: L.x + off + col * L.dx + L.dx / 2,
        y: L.y + row * L.dy + L.r + 2,
      };
    }

    /* Sechs Nachbarn im versetzten Raster */
    function neighbors(row, col) {
      var shifted = colsIn(row) !== COLS;    // versetzte Zeile
      var d = shifted
        ? [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, 1]]
        : [[0, -1], [0, 1], [-1, -1], [-1, 0], [1, -1], [1, 0]];
      var out = [];
      for (var i = 0; i < 6; i++) {
        var r = row + d[i][0], c = col + d[i][1];
        if (r < 0 || r >= st.grid.length) continue;
        if (c < 0 || c >= st.grid[r].length) continue;
        out.push([r, c]);
      }
      return out;
    }

    function cluster(row, col, sameColor) {
      var color = st.grid[row][col];
      var seen = {};
      var stack = [[row, col]];
      var out = [];
      seen[row + ':' + col] = 1;
      while (stack.length) {
        var p = stack.pop();
        out.push(p);
        var ns = neighbors(p[0], p[1]);
        for (var i = 0; i < ns.length; i++) {
          var k = ns[i][0] + ':' + ns[i][1];
          if (seen[k]) continue;
          var v = st.grid[ns[i][0]][ns[i][1]];
          if (v < 0) continue;
          if (sameColor && v !== color) continue;
          seen[k] = 1;
          stack.push(ns[i]);
        }
      }
      return out;
    }

    /* Alles, was nicht mehr an der Decke haengt */
    function floating() {
      var attached = {};
      var stack = [];
      for (var c = 0; c < st.grid[0].length; c++) {
        if (st.grid[0][c] >= 0) { attached['0:' + c] = 1; stack.push([0, c]); }
      }
      while (stack.length) {
        var p = stack.pop();
        var ns = neighbors(p[0], p[1]);
        for (var i = 0; i < ns.length; i++) {
          var k = ns[i][0] + ':' + ns[i][1];
          if (attached[k]) continue;
          if (st.grid[ns[i][0]][ns[i][1]] < 0) continue;
          attached[k] = 1;
          stack.push(ns[i]);
        }
      }
      var loose = [];
      for (var r = 0; r < st.grid.length; r++) {
        for (c = 0; c < st.grid[r].length; c++) {
          if (st.grid[r][c] >= 0 && !attached[r + ':' + c]) loose.push([r, c]);
        }
      }
      return loose;
    }

    /* ---------------------------------------------------------- Schuss */

    function shoot() {
      if (st.shot || st.over || st.won) return;
      var sx = stage.w / 2, sy = L.shooterY;
      st.shot = {
        x: sx, y: sy,
        vx: Math.cos(st.aim) * 780,
        vy: Math.sin(st.aim) * 780,
        color: st.cur,
      };
      st.cur = st.next;
      st.next = pickColor();
      st.shots++;
      host.sfx('pop');
    }

    function snap(x, y, color) {
      // Nachste freie Rasterstelle suchen
      var best = null, bestD = Infinity;
      for (var r = 0; r < MAXROWS; r++) {
        while (st.grid.length <= r) st.grid.push(makeRow(st.grid.length, 0));
        for (var c = 0; c < colsIn(r); c++) {
          if (st.grid[r][c] >= 0) continue;
          // Nur Plaetze mit Nachbarn oder in der obersten Zeile
          var ok = r === 0;
          if (!ok) {
            var ns = neighbors(r, c);
            for (var i = 0; i < ns.length; i++) {
              if (st.grid[ns[i][0]][ns[i][1]] >= 0) { ok = true; break; }
            }
          }
          if (!ok) continue;
          var p = cellPos(r, c);
          var d = U.dist2(x, y, p.x, p.y);
          if (d < bestD) { bestD = d; best = [r, c]; }
        }
      }
      if (!best) { st.shot = null; return; }

      st.grid[best[0]][best[1]] = color;
      st.shot = null;
      resolve(best[0], best[1]);
    }

    function resolve(row, col) {
      var group = cluster(row, col, true);
      if (group.length >= 3) {
        var pts = group.length * 10 + (group.length - 3) * 15;
        st.score += pts;
        group.forEach(function (p) {
          var q = cellPos(p[0], p[1]);
          st.pops.push({ x: q.x, y: q.y, color: st.grid[p[0]][p[1]], t: 0 });
          parts.burst(q.x, q.y, 7, {
            color: [COLORS[st.grid[p[0]][p[1]]], '#ffffff'],
            speed: 130, life: 0.45, size: 3, g: 260,
          });
          st.grid[p[0]][p[1]] = -1;
        });
        host.sfx('clear');
        host.buzz(20);
        shake.hit(4, 0.15);

        var loose = floating();
        if (loose.length) {
          st.score += loose.length * 25;
          loose.forEach(function (p) {
            var q = cellPos(p[0], p[1]);
            st.drops.push({ x: q.x, y: q.y, color: st.grid[p[0]][p[1]], vy: 30 + Math.random() * 60, vx: (Math.random() - .5) * 60 });
            st.grid[p[0]][p[1]] = -1;
          });
          host.sfx('coin');
        }
      } else {
        host.sfx('thud');
      }

      // Neue Reihe von oben
      if (st.shots > 0 && st.shots % st.shotsUntilRow === 0) {
        addTopRow();
      }

      syncBar();
      checkEnd();
    }

    function addTopRow() {
      st.rowOffset = (st.rowOffset + 1) % 2;
      var row = [];
      for (var c = 0; c < colsIn(0); c++) row.push(U.irand(0, st.colorsInPlay - 1));
      st.grid.unshift(row);
      host.sfx('alert');
      shake.hit(6, 0.2);
      // Zeilen unten abschneiden, falls leer
      while (st.grid.length > MAXROWS + 2) st.grid.pop();
    }

    function checkEnd() {
      var any = false, deepest = -1;
      for (var r = 0; r < st.grid.length; r++) {
        for (var c = 0; c < st.grid[r].length; c++) {
          if (st.grid[r][c] >= 0) { any = true; deepest = Math.max(deepest, r); }
        }
      }
      if (!any) {
        st.won = 1.6;
        st.score += 500 + st.level * 100;
        host.sfx('win');
        syncBar();
        return;
      }
      var limit = Math.floor((L.shooterY - L.y - 40) / L.dy);
      st.danger = deepest >= limit - 1 ? 1 : 0;
      if (deepest >= limit) {
        st.over = true;
        host.sfx('lose');
        host.gameOver({
          title: 'Zu tief gerutscht',
          sub: 'Level ' + st.level,
          score: st.score,
          onAgain: function () { reset(1); },
        });
      }
    }

    /* ---------------------------------------------------------- Schritt */

    function step(dt) {
      st.t += dt;
      shake.update(dt);
      parts.update(dt);

      for (var i = st.pops.length - 1; i >= 0; i--) {
        st.pops[i].t += dt;
        if (st.pops[i].t > 0.25) st.pops.splice(i, 1);
      }
      for (i = st.drops.length - 1; i >= 0; i--) {
        var d = st.drops[i];
        d.vy += 1400 * dt;
        d.y += d.vy * dt;
        d.x += d.vx * dt;
        if (d.y > stage.h + 40) st.drops.splice(i, 1);
      }

      if (st.won > 0) {
        st.won -= dt;
        if (st.won <= 0) { reset(st.level + 1); }
        return;
      }
      if (st.over) return;

      if (st.shot) {
        var steps = 4;
        for (var s = 0; s < steps; s++) {
          var sdt = dt / steps;
          st.shot.x += st.shot.vx * sdt;
          st.shot.y += st.shot.vy * sdt;
          if (st.shot.x < L.x + L.r) { st.shot.x = L.x + L.r; st.shot.vx = Math.abs(st.shot.vx); host.sfx('tick'); }
          if (st.shot.x > L.x + L.dx * COLS - L.r) {
            st.shot.x = L.x + L.dx * COLS - L.r;
            st.shot.vx = -Math.abs(st.shot.vx);
            host.sfx('tick');
          }
          if (st.shot.y < L.y + L.r) { snap(st.shot.x, st.shot.y, st.shot.color); return; }

          // Treffer auf bestehende Bubble
          var hit = false;
          for (var r = 0; r < st.grid.length && !hit; r++) {
            for (var c = 0; c < st.grid[r].length; c++) {
              if (st.grid[r][c] < 0) continue;
              var p = cellPos(r, c);
              if (U.dist2(st.shot.x, st.shot.y, p.x, p.y) < (L.r * 1.85) * (L.r * 1.85)) {
                snap(st.shot.x, st.shot.y, st.shot.color);
                hit = true;
                break;
              }
            }
          }
          if (hit) return;
          if (st.shot.y > stage.h + 40) { st.shot = null; return; }
        }
      }
    }

    /* ---------------------------------------------------------- Zeichnen */

    function drawBubble(x, y, color, r, alpha) {
      ctx.globalAlpha = alpha === undefined ? 1 : alpha;
      G.circle(ctx, x, y, r, COLORS[color]);
      ctx.globalAlpha = (alpha === undefined ? 1 : alpha) * 0.45;
      G.circle(ctx, x - r * 0.28, y - r * 0.3, r * 0.28, '#ffffff');
      ctx.globalAlpha = (alpha === undefined ? 1 : alpha) * 0.22;
      G.ring(ctx, x, y, r * 0.86, r * 0.16, '#000000');
      ctx.globalAlpha = 1;
    }

    function draw() {
      var w = stage.w, h = stage.h;
      if (!L.shooterY) relayout(w, h);
      ctx.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0);
      ctx.fillStyle = '#0b0e15';
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      shake.apply(ctx);

      // Spielfeld
      var fieldW = L.dx * COLS;
      G.fillRound(ctx, L.x - 4, L.y - 8, fieldW + 8, L.shooterY - L.y - 6, 10, '#131926');

      // Grenzlinie
      var limitY = L.y + Math.floor((L.shooterY - L.y - 40) / L.dy) * L.dy;
      ctx.strokeStyle = st.danger ? 'rgba(255,95,107,.6)' : 'rgba(255,255,255,.12)';
      ctx.setLineDash([6, 5]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(L.x, limitY);
      ctx.lineTo(L.x + fieldW, limitY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Zielhilfe
      if (!st.shot && !st.over && st.won <= 0) {
        var px = w / 2, py = L.shooterY;
        var vx = Math.cos(st.aim), vy = Math.sin(st.aim);
        ctx.strokeStyle = 'rgba(255,255,255,.28)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 7]);
        ctx.beginPath();
        ctx.moveTo(px, py);
        var bounces = 0;
        for (var i = 0; i < 260 && bounces < 3; i++) {
          px += vx * 9; py += vy * 9;
          if (px < L.x + L.r) { px = L.x + L.r; vx = -vx; bounces++; }
          if (px > L.x + fieldW - L.r) { px = L.x + fieldW - L.r; vx = -vx; bounces++; }
          ctx.lineTo(px, py);
          if (py < L.y + L.r) break;
          var stop = false;
          for (var r2 = 0; r2 < st.grid.length && !stop; r2++) {
            for (var c2 = 0; c2 < st.grid[r2].length; c2++) {
              if (st.grid[r2][c2] < 0) continue;
              var q = cellPos(r2, c2);
              if (U.dist2(px, py, q.x, q.y) < (L.r * 1.8) * (L.r * 1.8)) { stop = true; break; }
            }
          }
          if (stop) break;
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Bubbles
      for (var r = 0; r < st.grid.length; r++) {
        for (var c = 0; c < st.grid[r].length; c++) {
          if (st.grid[r][c] < 0) continue;
          var p = cellPos(r, c);
          if (p.y > L.shooterY + 20) continue;
          drawBubble(p.x, p.y, st.grid[r][c], L.r);
        }
      }

      // Platzende
      st.pops.forEach(function (o) {
        var t = o.t / 0.25;
        drawBubble(o.x, o.y, o.color, L.r * (1 + t * 0.6), 1 - t);
      });
      st.drops.forEach(function (o) { drawBubble(o.x, o.y, o.color, L.r); });

      parts.draw(ctx);

      // Schuss
      if (st.shot) drawBubble(st.shot.x, st.shot.y, st.shot.color, L.r);

      // Kanone
      var sx = w / 2, sy = L.shooterY;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(st.aim + Math.PI / 2);
      G.fillRound(ctx, -7, -L.r * 1.5, 14, L.r * 1.5, 6, '#3a4666');
      ctx.restore();
      G.circle(ctx, sx, sy, L.r * 1.25, '#232c40');
      if (!st.shot) drawBubble(sx, sy, st.cur, L.r);

      // Naechste Kugel
      G.text(ctx, 'nächste', sx + L.r * 3, sy - 6, {
        size: 10, weight: 700, color: '#5f6a85', align: 'center',
      });
      drawBubble(sx + L.r * 3, sy + 8, st.next, L.r * 0.62);

      if (st.won > 0) {
        G.text(ctx, 'Level geschafft!', w / 2, h * 0.4, {
          size: 26, weight: 800, color: '#3ddc84', align: 'center', baseline: 'middle',
        });
      }

      ctx.restore();
    }

    /* ---------------------------------------------------------- Steuerung */

    loop = host.loop({ hz: 60, update: step, render: draw });

    function aimAt(x, y) {
      var sx = stage.w / 2, sy = L.shooterY;
      var a = Math.atan2(y - sy, x - sx);
      // Nicht nach unten zielen
      st.aim = U.clamp(a, -Math.PI + 0.22, -0.22);
    }

    host.input({
      onDown: function (p) { aimAt(p.x, p.y); },
      onMove: function (p) { aimAt(p.x, p.y); },
      onUp: function (p) { if (p.moved) shoot(); },
      onTap: function (x, y) { aimAt(x, y); shoot(); },
    });

    var keys = host.keys({
      onDown: function (k) {
        if (k === 'space') shoot();
        else if (k === 'arrowleft') st.aim = U.clamp(st.aim - 0.06, -Math.PI + 0.22, -0.22);
        else if (k === 'arrowright') st.aim = U.clamp(st.aim + 0.06, -Math.PI + 0.22, -0.22);
      },
    });

    function help(force) {
      SG.tutorial.show({
        id: 'bubble', force: force, parent: host.root, title: 'Bubble Shooter',
        pages: [{
          kicker: 'Bubble Shooter', title: 'Drei gleiche platzen',
          art: SG.tutorial.art.tap,
          body: [
            { ic: '👆', text: '<b>Ziehen</b> richtet die Kanone, loslassen schießt. Kurzes Tippen zielt und schießt in einem.' },
            { ic: '3', text: 'Berühren sich <b>drei oder mehr</b> gleiche Farben, platzen sie.' },
            { ic: '⬇', text: 'Was danach nicht mehr an der Decke hängt, <b>fällt herunter</b> — dafür gibt es die meisten Punkte.' },
            { ic: '↩', text: 'An den Seitenwänden lässt sich <b>über Bande</b> schießen. Die gestrichelte Linie rechnet das mit.' },
            { ic: '⚠', text: 'Alle paar Schüsse kommt oben eine neue Reihe. Unter der gestrichelten Linie ist Schluss.' },
          ],
        }],
      });
    }

    reset(1);
    loop.start();
    help(false);

    return {
      state: st,
      destroy: function () { keys.destroy(); },
      selftest: function (steps) {
        reset(1);
        relayout(700, 800);
        var r = U.rng(1717);
        for (var i = 0; i < (steps || 600); i++) {
          if (!st.shot && !st.over && st.won <= 0) {
            st.aim = -Math.PI + 0.3 + r() * (Math.PI - 0.6);
            shoot();
          }
          step(1 / 60);
          if (st.over) reset(1);
          for (var q = 0; q < st.grid.length; q++) {
            if (st.grid[q].length !== colsIn(q)) {
              throw new Error('Zeilenbreite passt nicht zum Raster');
            }
          }
        }
        // Nachbarschaft muss symmetrisch sein
        for (var row = 1; row < 4; row++) {
          for (var col = 1; col < 4; col++) {
            var ns = neighbors(row, col);
            for (var k = 0; k < ns.length; k++) {
              var back = neighbors(ns[k][0], ns[k][1]);
              var found = false;
              for (var m = 0; m < back.length; m++) {
                if (back[m][0] === row && back[m][1] === col) found = true;
              }
              if (!found) throw new Error('Nachbarschaft nicht symmetrisch');
            }
          }
        }
        draw();
      },
    };
  }

  SG.register({
    id: 'bubble',
    name: 'Bubble Shooter',
    category: 'casual',
    desc: 'Bandenschuss mit Zielhilfe',
    tags: ['bubble', 'kugeln', 'schiessen', 'farben'],
    preview: function (c, w, h) {
      c.fillStyle = '#131926';
      c.fillRect(0, 0, w, h);
      var cols = 9;
      var dx = w / (cols + 0.5), r = dx / 2 - 1, dy = dx * 0.866;
      var pat = [
        [0, 1, 2, 0, 3, 1, 2, 0, 4],
        [1, 1, 0, 3, 3, 2, 0, 4],
        [2, 0, 0, 3, 1, 1, 4, 2, 0],
        [4, 2, 1, 1, 0, 3, 2],
      ];
      for (var row = 0; row < pat.length; row++) {
        var off = row % 2 ? dx / 2 : 0;
        for (var col = 0; col < pat[row].length; col++) {
          var x = off + col * dx + dx / 2, y = 8 + row * dy + r;
          G.circle(c, x, y, r, COLORS[pat[row][col]]);
          c.globalAlpha = .45;
          G.circle(c, x - r * .28, y - r * .3, r * .28, '#fff');
          c.globalAlpha = 1;
        }
      }
      // Kanone
      var sx = w / 2, sy = h - r - 6;
      c.save();
      c.translate(sx, sy);
      c.rotate(-0.35);
      G.fillRound(c, -5, -r * 1.5, 10, r * 1.5, 4, '#3a4666');
      c.restore();
      G.circle(c, sx, sy, r * 1.25, '#232c40');
      G.circle(c, sx, sy, r, COLORS[2]);
      c.globalAlpha = .45;
      G.circle(c, sx - r * .28, sy - r * .3, r * .28, '#fff');
      c.globalAlpha = 1;
      c.strokeStyle = 'rgba(255,255,255,.3)';
      c.setLineDash([4, 5]);
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(sx, sy);
      c.lineTo(sx + h * 0.42, sy - h * 0.55);
      c.stroke();
      c.setLineDash([]);
    },
    mount: mount,
  });
})(SG);
