/* ------------------------------------------------------------------
   Space Invaders

   Formation aus drei Gegnertypen, die schneller wird, je weniger
   uebrig sind. Bunker broeckeln pixelweise, gelegentlich zieht ein
   Ufo durchs Bild. Wellen werden dichter und schneller.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var G = SG.gfx;

  var COLS = 11, ROWS = 5;

  /* Gegner als kleine Bitmuster, zwei Animationsphasen */
  var SPRITES = {
    a: [
      ['..X.....X..', '...X...X...', '..XXXXXXX..', '.XX.XXX.XX.', 'XXXXXXXXXXX',
        'X.XXXXXXX.X', 'X.X.....X.X', '...XX.XX...'],
      ['..X.....X..', 'X..X...X..X', 'X.XXXXXXX.X', 'XXX.XXX.XXX', 'XXXXXXXXXXX',
        '.XXXXXXXXX.', '..X.....X..', '.X.......X.'],
    ],
    b: [
      ['..XXXXXX..', '.XXXXXXXX.', 'XX.XXXX.XX', 'XXXXXXXXXX', '..XX..XX..',
        '.XX.XX.XX.', 'XX......XX', '..XX..XX..'],
      ['..XXXXXX..', '.XXXXXXXX.', 'XX.XXXX.XX', 'XXXXXXXXXX', '.XXX..XXX.',
        'XX.XXXX.XX', '.X......X.', 'XX......XX'],
    ],
    c: [
      ['....XX....', '...XXXX...', '..XXXXXX..', '.XX.XX.XX.', 'XXXXXXXXXX',
        '..X.XX.X..', '.X......X.', '..X....X..'],
      ['....XX....', '...XXXX...', '..XXXXXX..', '.XX.XX.XX.', 'XXXXXXXXXX',
        '.X.XXXX.X.', 'X........X', '.XX....XX.'],
    ],
  };
  var TYPE_COL = { a: '#ff5f6b', b: '#a97bff', c: '#3ddc84' };
  var TYPE_PTS = { a: 30, b: 20, c: 10 };

  function mount(host) {
    var st = {
      wave: 1, score: 0, lives: 3,
      aliens: [], dir: 1, dropped: false, stepT: 0, frame: 0,
      ship: { x: 0.5, w: 0.06 },
      shots: [], bombs: [],
      bunkers: [],
      ufo: null, ufoT: 12,
      over: false,
      t: 0, respawn: 0,
      autoFire: true, fireT: 0,
      msg: '', msgT: 0,
    };

    var stage = host.canvas({ alpha: false, maxDpr: 2 });
    var ctx = stage.ctx;
    var parts = G.particles(260);
    var shake = G.shake();

    var sScore = host.stat('Punkte', '0', 'gold');
    var sWave = host.stat('Welle', '1');
    var sLives = host.stat('Schiffe', '3', 'red');
    var sBest = host.stat('Bestwert', '—');

    var loop;
    var autoBtn = host.tool('Auto ⌁', function () {
      st.autoFire = !st.autoFire;
      autoBtn.setOn(st.autoFire);
    });
    autoBtn.setOn(true);
    host.tool('❚❚', function () {
      var p = loop.toggle();
      if (p) host.showPause(function () { loop.resume(true); });
    });
    host.menuTool([
      { icon: '↻', label: 'Neues Spiel', onClick: function () { reset(); } },
      { icon: '?', label: 'Anleitung', onClick: function () { help(true); } },
    ]);

    /* ---------------------------------------------------------- Aufbau */

    function makeWave(n) {
      st.aliens = [];
      var startY = 0.1 + Math.min(0.16, (n - 1) * 0.022);
      for (var r = 0; r < ROWS; r++) {
        for (var c = 0; c < COLS; c++) {
          var type = r === 0 ? 'a' : (r < 3 ? 'b' : 'c');
          st.aliens.push({
            col: c, row: r, type: type,
            x: 0.08 + c * 0.078, y: startY + r * 0.062,
            dead: false,
          });
        }
      }
      st.dir = 1;
      st.stepT = 0;
      st.bombs = [];
      st.ufo = null;
      st.ufoT = 10 + Math.random() * 8;
    }

    function makeBunkers() {
      st.bunkers = [];
      var count = 4;
      for (var i = 0; i < count; i++) {
        var cells = [];
        var bw = 9, bh = 6;
        for (var y = 0; y < bh; y++) {
          for (var x = 0; x < bw; x++) {
            // Bogen ausschneiden
            var inArch = y >= 4 && x >= 3 && x <= 5;
            var corner = (y === 0 && (x === 0 || x === bw - 1));
            cells.push(inArch || corner ? 0 : 1);
          }
        }
        st.bunkers.push({
          x: 0.13 + i * 0.25, y: 0.74, w: bw, h: bh, cells: cells,
        });
      }
    }

    function reset() {
      st.wave = 1; st.score = 0; st.lives = 3;
      st.over = false; st.respawn = 0;
      st.shots = [];
      st.ship.x = 0.5;
      makeWave(1);
      makeBunkers();
      parts.clear();
      host.closeOverlay();
      syncBar();
      loop.resume(true);
    }

    function syncBar() {
      sScore.set(U.num(st.score));
      sWave.set(String(st.wave));
      sLives.set(String(st.lives));
      var b = host.best();
      sBest.set(b === null ? '—' : U.num(b));
    }

    function flash(t) { st.msg = t; st.msgT = 1.6; }

    function alive() {
      var n = 0;
      for (var i = 0; i < st.aliens.length; i++) if (!st.aliens[i].dead) n++;
      return n;
    }

    /* ---------------------------------------------------------- Physik */

    function stepFormation() {
      var live = alive();
      var edge = false;
      for (var i = 0; i < st.aliens.length; i++) {
        var a = st.aliens[i];
        if (a.dead) continue;
        var nx = a.x + st.dir * 0.018;
        if (nx < 0.03 || nx > 0.94) edge = true;
      }
      if (edge) {
        st.dir *= -1;
        for (i = 0; i < st.aliens.length; i++) {
          if (!st.aliens[i].dead) st.aliens[i].y += 0.032;
        }
      } else {
        for (i = 0; i < st.aliens.length; i++) {
          if (!st.aliens[i].dead) st.aliens[i].x += st.dir * 0.018;
        }
      }
      st.frame ^= 1;
      host.sfx('tick');

      // Unterste Reihe erreicht die Bunker
      for (i = 0; i < st.aliens.length; i++) {
        if (!st.aliens[i].dead && st.aliens[i].y > 0.82) { hitShip(true); return; }
      }
    }

    function alienFire() {
      // Nur die jeweils unterste Person je Spalte schiesst
      var bottom = {};
      for (var i = 0; i < st.aliens.length; i++) {
        var a = st.aliens[i];
        if (a.dead) continue;
        if (!bottom[a.col] || a.y > bottom[a.col].y) bottom[a.col] = a;
      }
      var list = [];
      for (var k in bottom) list.push(bottom[k]);
      if (!list.length) return;
      var pick = list[U.irand(0, list.length - 1)];
      st.bombs.push({ x: pick.x, y: pick.y + 0.02, vy: 0.34 + st.wave * 0.018, kind: U.irand(0, 1) });
    }

    function fire() {
      if (st.over || st.respawn > 0) return;
      var mine = 0;
      for (var i = 0; i < st.shots.length; i++) mine++;
      if (mine >= 3) return;
      st.shots.push({ x: st.ship.x, y: 0.9 });
      host.sfx('laser');
    }

    function bunkerHit(bx, by, radius) {
      var hitAny = false;
      for (var i = 0; i < st.bunkers.length; i++) {
        var b = st.bunkers[i];
        var cw = 0.012, chh = 0.012;
        var left = b.x - (b.w * cw) / 2;
        if (bx < left - 0.02 || bx > left + b.w * cw + 0.02) continue;
        if (by < b.y - 0.02 || by > b.y + b.h * chh + 0.02) continue;
        for (var y = 0; y < b.h; y++) {
          for (var x = 0; x < b.w; x++) {
            if (!b.cells[y * b.w + x]) continue;
            var cx = left + x * cw + cw / 2;
            var cy = b.y + y * chh + chh / 2;
            if (U.dist(bx, by, cx, cy) < radius) {
              b.cells[y * b.w + x] = 0;
              hitAny = true;
            }
          }
        }
      }
      return hitAny;
    }

    function killAlien(a) {
      a.dead = true;
      st.score += TYPE_PTS[a.type] * st.wave;
      var p = toPx(a.x, a.y);
      parts.burst(p.x, p.y, 12, {
        color: [TYPE_COL[a.type], '#ffffff'], speed: 150, life: 0.45, size: 3, g: 60, drag: 4,
      });
      host.sfx('hit');
      syncBar();
      if (alive() === 0) nextWave();
    }

    function nextWave() {
      st.wave++;
      flash('Welle ' + st.wave);
      host.sfx('levelup');
      st.score += 100 * st.wave;
      makeWave(st.wave);
      if (st.wave % 3 === 0) makeBunkers();
      syncBar();
    }

    function hitShip(instant) {
      if (st.respawn > 0 || st.over) return;
      st.lives--;
      syncBar();
      shake.hit(14, 0.4);
      host.sfx('explode');
      host.buzz(60);
      var p = toPx(st.ship.x, 0.92);
      parts.burst(p.x, p.y, 26, {
        color: ['#4aa3ff', '#ffffff', '#ff9c3f'], speed: 210, life: 0.7, size: 4, g: 260,
      });
      if (st.lives <= 0 || instant) {
        st.over = true;
        host.gameOver({
          title: instant && st.lives > 0 ? 'Überrannt' : 'Alle Schiffe verloren',
          sub: 'Welle ' + st.wave,
          score: st.score,
          onAgain: reset,
        });
        return;
      }
      st.respawn = 1.4;
      st.bombs = [];
    }

    function step(dt) {
      st.t += dt;
      shake.update(dt);
      parts.update(dt);
      if (st.msgT > 0) st.msgT -= dt;
      if (st.over) return;
      if (st.respawn > 0) { st.respawn -= dt; return; }

      // Formationstakt
      var live = Math.max(1, alive());
      var total = COLS * ROWS;
      var speed = U.lerp(0.62, 0.055, 1 - live / total) / (1 + (st.wave - 1) * 0.12);
      st.stepT += dt;
      if (st.stepT >= speed) { st.stepT = 0; stepFormation(); }

      // Gegnerfeuer
      bombT -= dt;
      if (bombT <= 0) {
        bombT = Math.max(0.35, 1.6 - st.wave * 0.12) * (0.5 + Math.random());
        alienFire();
      }

      // Ufo
      if (!st.ufo) {
        st.ufoT -= dt;
        if (st.ufoT <= 0) {
          var fromLeft = Math.random() < 0.5;
          st.ufo = { x: fromLeft ? -0.05 : 1.05, vx: (fromLeft ? 1 : -1) * 0.19 };
          st.ufoT = 16 + Math.random() * 12;
          host.sfx('ship');
        }
      } else {
        st.ufo.x += st.ufo.vx * dt;
        if (st.ufo.x < -0.1 || st.ufo.x > 1.1) st.ufo = null;
      }

      // Automatisch feuern
      if (st.autoFire) {
        st.fireT -= dt;
        if (st.fireT <= 0) { fire(); st.fireT = 0.42; }
      }

      // Eigene Schuesse
      for (var i = st.shots.length - 1; i >= 0; i--) {
        var s = st.shots[i];
        s.y -= 1.15 * dt;
        if (s.y < 0.02) { st.shots.splice(i, 1); continue; }
        if (bunkerHit(s.x, s.y, 0.011)) { st.shots.splice(i, 1); continue; }
        if (st.ufo && Math.abs(s.x - st.ufo.x) < 0.035 && s.y < 0.09 && s.y > 0.03) {
          st.score += 150 + U.irand(0, 3) * 50;
          var up = toPx(st.ufo.x, 0.06);
          parts.burst(up.x, up.y, 20, { color: ['#f0b429', '#ffffff'], speed: 190, life: 0.6, size: 4 });
          st.ufo = null;
          st.shots.splice(i, 1);
          host.sfx('coin');
          syncBar();
          continue;
        }
        var hit = false;
        for (var q = 0; q < st.aliens.length; q++) {
          var a = st.aliens[q];
          if (a.dead) continue;
          if (Math.abs(s.x - a.x) < 0.03 && Math.abs(s.y - a.y) < 0.026) {
            killAlien(a);
            hit = true;
            break;
          }
        }
        if (hit) st.shots.splice(i, 1);
      }

      // Gegnerschuesse
      for (i = st.bombs.length - 1; i >= 0; i--) {
        var b = st.bombs[i];
        b.y += b.vy * dt;
        if (b.y > 1.02) { st.bombs.splice(i, 1); continue; }
        if (bunkerHit(b.x, b.y, 0.013)) { st.bombs.splice(i, 1); continue; }
        if (b.y > 0.88 && b.y < 0.95 && Math.abs(b.x - st.ship.x) < st.ship.w / 2 + 0.01) {
          st.bombs.splice(i, 1);
          hitShip(false);
          // hitShip ersetzt st.bombs durch eine leere Liste. Die Schleife
          // laeuft rueckwaerts und wuerde danach in einem Feld greifen, das
          // es nicht mehr gibt - deshalb hier heraus.
          break;
        }
      }

      if (keys) {
        var ax = keys.axis('arrowleft', 'arrowright') + keys.axis('a', 'd');
        if (ax) st.ship.x = U.clamp(st.ship.x + ax * dt * 0.85, 0.05, 0.95);
      }
    }
    var bombT = 1.4;

    /* ---------------------------------------------------------- Zeichnen */

    var VIEW = { x: 0, y: 0, w: 1, h: 1 };

    function relayout(w, h) {
      var pad = 8;
      var aw = w - pad * 2, ah = h - pad * 2;
      var target = 1.05;
      if (aw / ah > target) { VIEW.h = ah; VIEW.w = ah * target; }
      else { VIEW.w = aw; VIEW.h = aw / target; }
      VIEW.x = (w - VIEW.w) / 2;
      VIEW.y = (h - VIEW.h) / 2;
    }
    stage.onResize = relayout;

    function toPx(x, y) {
      return { x: VIEW.x + x * VIEW.w, y: VIEW.y + y * VIEW.h };
    }

    function drawSprite(rows, x, y, scale, color) {
      ctx.fillStyle = color;
      var cw = scale, ch = scale;
      var w = rows[0].length, h = rows.length;
      var ox = x - (w * cw) / 2, oy = y - (h * ch) / 2;
      for (var r = 0; r < h; r++) {
        var line = rows[r];
        var run = -1;
        for (var c = 0; c <= w; c++) {
          var on = c < w && line[c] === 'X';
          if (on && run < 0) run = c;
          if (!on && run >= 0) {
            ctx.fillRect(ox + run * cw, oy + r * ch, (c - run) * cw, ch);
            run = -1;
          }
        }
      }
    }

    function draw() {
      var w = stage.w, h = stage.h;
      if (VIEW.w === 1) relayout(w, h);
      ctx.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0);
      ctx.fillStyle = '#05070c';
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      shake.apply(ctx);

      // Sternenhimmel
      var starLayer = G.cache('inv-stars', Math.max(2, VIEW.w), Math.max(2, VIEW.h), function (c, cw, chh) {
        var r = U.rng(2024);
        for (var i = 0; i < 90; i++) {
          var a = 0.15 + r() * 0.5;
          c.fillStyle = 'rgba(200,214,234,' + a.toFixed(2) + ')';
          var s = r() < 0.15 ? 2 : 1;
          c.fillRect(r() * cw, r() * chh, s, s);
        }
      });
      ctx.drawImage(starLayer, VIEW.x, VIEW.y);

      var scale = VIEW.w * 0.0042;

      // Ufo
      if (st.ufo) {
        var up = toPx(st.ufo.x, 0.06);
        ctx.fillStyle = '#f0b429';
        ctx.fillRect(up.x - 16, up.y - 3, 32, 6);
        ctx.fillRect(up.x - 9, up.y - 8, 18, 5);
        ctx.fillStyle = '#241a04';
        for (var u = -2; u <= 2; u++) ctx.fillRect(up.x + u * 6 - 1, up.y + 3, 2, 3);
      }

      // Gegner
      for (var i = 0; i < st.aliens.length; i++) {
        var a = st.aliens[i];
        if (a.dead) continue;
        var p = toPx(a.x, a.y);
        drawSprite(SPRITES[a.type][st.frame], p.x, p.y, scale, TYPE_COL[a.type]);
      }

      // Bunker
      ctx.fillStyle = '#3ddc84';
      for (i = 0; i < st.bunkers.length; i++) {
        var b = st.bunkers[i];
        var cw = 0.012 * VIEW.w, chh = 0.012 * VIEW.h;
        var left = VIEW.x + (b.x - (b.w * 0.012) / 2) * VIEW.w;
        var top = VIEW.y + b.y * VIEW.h;
        for (var y = 0; y < b.h; y++) {
          for (var x = 0; x < b.w; x++) {
            if (!b.cells[y * b.w + x]) continue;
            ctx.fillRect(left + x * cw, top + y * chh, cw + 0.5, chh + 0.5);
          }
        }
      }

      // Schiff
      if (st.respawn <= 0 || Math.floor(st.t * 12) % 2) {
        var sp = toPx(st.ship.x, 0.92);
        var sw = st.ship.w * VIEW.w;
        ctx.fillStyle = st.respawn > 0 ? '#7fb4ff' : '#c8d4ea';
        ctx.fillRect(sp.x - sw / 2, sp.y, sw, sw * 0.28);
        ctx.fillRect(sp.x - sw * 0.28, sp.y - sw * 0.18, sw * 0.56, sw * 0.2);
        ctx.fillRect(sp.x - sw * 0.06, sp.y - sw * 0.36, sw * 0.12, sw * 0.2);
      }

      // Schuesse
      ctx.fillStyle = '#ffffff';
      st.shots.forEach(function (s) {
        var q = toPx(s.x, s.y);
        ctx.fillRect(q.x - 1.5, q.y, 3, VIEW.h * 0.028);
      });
      ctx.fillStyle = '#ff9c3f';
      st.bombs.forEach(function (bo) {
        var q = toPx(bo.x, bo.y);
        if (bo.kind) {
          ctx.fillRect(q.x - 2, q.y, 4, VIEW.h * 0.016);
          ctx.fillRect(q.x - 1, q.y + VIEW.h * 0.016, 2, VIEW.h * 0.012);
        } else {
          var wob = Math.sin(bo.y * 90) * 3;
          ctx.fillRect(q.x - 2 + wob, q.y, 4, VIEW.h * 0.026);
        }
      });

      parts.draw(ctx);

      // Bodenlinie
      ctx.fillStyle = '#2c3a58';
      ctx.fillRect(VIEW.x, VIEW.y + VIEW.h * 0.965, VIEW.w, 2);

      if (st.msgT > 0) {
        ctx.globalAlpha = U.clamp(st.msgT / 0.5, 0, 1);
        G.text(ctx, st.msg, VIEW.x + VIEW.w / 2, VIEW.y + VIEW.h * 0.42, {
          size: 26, weight: 800, color: '#ffd166', align: 'center', baseline: 'middle',
        });
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }

    /* ---------------------------------------------------------- Steuerung */

    loop = host.loop({ hz: 60, update: step, render: draw });

    host.input({
      onDown: function (p) { moveShip(p.x); },
      onMove: function (p) { moveShip(p.x); },
      onTap: function (x) { moveShip(x); fire(); },
    });

    function moveShip(sx) {
      st.ship.x = U.clamp((sx - VIEW.x) / VIEW.w, 0.05, 0.95);
    }

    var keys = host.keys({
      onDown: function (k) { if (k === 'space' || k === 'arrowup') fire(); },
    });

    function help(force) {
      SG.tutorial.show({
        id: 'invaders', force: force, parent: host.root, title: 'Space Invaders',
        pages: [{
          kicker: 'Space Invaders', title: 'Die Formation kommt näher',
          art: SG.tutorial.art.tap,
          body: [
            { ic: '👆', text: 'Den Finger über das Bild ziehen steuert das <b>Schiff</b>.' },
            { ic: '⌁', text: 'Der <b>Auto-Knopf</b> oben feuert von selbst. Aus lässt sich per Tippen einzeln schießen.' },
            { ic: '🛸', text: 'Das <b>Ufo</b> oben gibt bis zu 300 Extrapunkte.' },
            { ic: '🧱', text: 'Die <b>Bunker</b> halten Beschuss ab, bröckeln aber — auch durch eigene Schüsse.' },
            { ic: '⏩', text: 'Je weniger Gegner übrig sind, desto schneller wird die Formation.' },
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
        relayout(900, 620);
        var r = U.rng(1912);
        for (var i = 0; i < (steps || 600); i++) {
          st.ship.x = U.clamp(0.5 + Math.sin(i * 0.07) * 0.42, 0.05, 0.95);
          if (r() < 0.2) fire();
          step(1 / 60);
          if (st.over) reset();
        }
        // Wellenwechsel muss sauber funktionieren
        st.aliens.forEach(function (a) { a.dead = true; });
        var before = st.wave;
        killAllCheck();
        function killAllCheck() {
          if (alive() === 0) nextWave();
        }
        if (st.wave !== before + 1) throw new Error('Wellenwechsel fehlgeschlagen');
        if (alive() !== COLS * ROWS) throw new Error('Neue Welle unvollständig');
        draw();
      },
    };
  }

  SG.register({
    id: 'invaders',
    name: 'Space Invaders',
    category: 'arcade',
    desc: 'Formation, Bunker, Ufo',
    tags: ['weltraum', 'shooter', 'klassiker', 'aliens'],
    preview: function (c, w, h) {
      c.fillStyle = '#05070c';
      c.fillRect(0, 0, w, h);
      var r = U.rng(9);
      for (var i = 0; i < 40; i++) {
        c.fillStyle = 'rgba(200,214,234,' + (0.2 + r() * 0.4).toFixed(2) + ')';
        c.fillRect(r() * w, r() * h, 1, 1);
      }
      var scale = w * 0.0055;
      function sprite(rows, x, y, color) {
        c.fillStyle = color;
        var sw = rows[0].length, sh = rows.length;
        var ox = x - (sw * scale) / 2, oy = y - (sh * scale) / 2;
        for (var rr = 0; rr < sh; rr++) {
          for (var cc = 0; cc < sw; cc++) {
            if (rows[rr][cc] === 'X') c.fillRect(ox + cc * scale, oy + rr * scale, scale, scale);
          }
        }
      }
      var types = ['a', 'b', 'b', 'c'];
      for (var row = 0; row < 4; row++) {
        for (var col = 0; col < 6; col++) {
          sprite(SPRITES[types[row]][col % 2], w * (0.18 + col * 0.13), h * (0.16 + row * 0.14),
            TYPE_COL[types[row]]);
        }
      }
      c.fillStyle = '#3ddc84';
      for (var b = 0; b < 3; b++) {
        var bx = w * (0.22 + b * 0.28), by = h * 0.75;
        c.fillRect(bx - 14, by, 28, 10);
        c.fillRect(bx - 10, by - 5, 20, 5);
        c.clearRect(bx - 4, by + 4, 8, 6);
      }
      c.fillStyle = '#c8d4ea';
      c.fillRect(w * 0.5 - 14, h * 0.9, 28, 7);
      c.fillRect(w * 0.5 - 7, h * 0.9 - 5, 14, 5);
      c.fillRect(w * 0.5 - 2, h * 0.9 - 9, 4, 5);
    },
    mount: mount,
  });
})(SG);
