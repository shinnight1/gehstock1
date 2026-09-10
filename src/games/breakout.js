/* ------------------------------------------------------------------
   Blockbrecher

   24 gebaute Level, sechs Steinarten, acht Extras. Der Ball nimmt die
   Bewegung des Schlaegers als Drall mit - dadurch laesst sich der
   Winkel steuern, statt nur zu hoffen.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var G = SG.gfx;
  var UI = SG.ui;

  var COLS = 11, ROWS = 9;

  /* . leer  1-3 normal  H hart (2 Treffer)  S Stahl  X explosiv  P Extra */
  var LEVELS = [
    ['...........', '.111111111.', '.222222222.', '.333333333.', '...........', '...........', '...........', '...........', '...........'],
    ['..1111111..', '..2P2P2P2..', '..3333333..', '...........', '...HHHHH...', '...........', '...........', '...........', '...........'],
    ['1.1.1.1.1.1', '.2.2.2.2.2.', '1.1.1.1.1.1', '.3.3.3.3.3.', '1.P.1.P.1.1', '...........', '...........', '...........', '...........'],
    ['...SSSSS...', '..1111111..', '..2P222P2..', '..3333333..', '...........', '...........', '...........', '...........', '...........'],
    ['11111111111', '1.........1', '1.HHHHHHH.1', '1.H.....H.1', '1.H.PXP.H.1', '1.HHHHHHH.1', '1.........1', '11111111111', '...........'],
    ['.....1.....', '....121....', '...12321...', '..1234321..', '.123XPX321.', '...........', '...........', '...........', '...........'],
    ['3.3.3.3.3.3', '.H.H.H.H.H.', '2.2.2.2.2.2', '.S.S.S.S.S.', '1.1.P.1.1.1', '...........', '...........', '...........', '...........'],
    ['HHH.....HHH', 'H1H.....H1H', 'HHH.....HHH', '...12321...', '..1233321..', '.123P4321..', '...........', '...........', '...........'],
    ['11111111111', '22222222222', '33333333333', 'HHHHHHHHHHH', '...........', '.....P.....', '...........', '...........', '...........'],
    ['.S.......S.', '.S.11111.S.', '.S.2P2P2.S.', '.S.33333.S.', '.S.......S.', '.SSSSSSSSS.', '...........', '...........', '...........'],
    ['....XXX....', '...X111X...', '..X12321X..', '.X1233321X.', 'X123PPP321X', '...........', '...........', '...........', '...........'],
    ['1.2.3.H.3.2', '2.3.H.3.2.1', '3.H.3.2.1.2', 'H.3.2.1.2.3', '3.2.1.P.3.H', '...........', '...........', '...........', '...........'],
    ['HHHHHHHHHHH', '.1.1.1.1.1.', 'HHHHHHHHHHH', '.2.2.P.2.2.', 'HHHHHHHHHHH', '...........', '...........', '...........', '...........'],
    ['...........', '.SSS...SSS.', '.S1S...S1S.', '.SSS...SSS.', '...12321...', '..123P321..', '.12333321..', '...........', '...........'],
    ['1111111111.', '.1111111111', '1111111111.', '.11XPPX111.', '1111111111.', '...........', '...........', '...........', '...........'],
    ['..H.....H..', '..H.....H..', '..HHHHHHH..', '..H.....H..', '..H..P..H..', '..HHHHHHH..', '...........', '...........', '...........'],
    ['3333.3.3333', '2222.P.2222', '1111.3.1111', 'HHHH.2.HHHH', '.....1.....', '...........', '...........', '...........', '...........'],
    ['XPX.....XPX', '.1.......1.', '.2.HHHHH.2.', '.3.H123H.3.', '.1.HHHHH.1.', '...........', '...........', '...........', '...........'],
    ['SSSSSSSSSSS', '1111111111.', '.2222222222', '333333333..', '..HHHHHHHHH', '.....P.....', '...........', '...........', '...........'],
    ['.1.2.3.2.1.', '1.2.3.H.2.1', '.2.3.P.3.2.', '2.3.H.3.2.1', '.3.2.1.2.3.', '...........', '...........', '...........', '...........'],
    ['HH.......HH', 'H1H.....H1H', '.H2H...H2H.', '..H3H.H3H..', '...HXPXH...', '....HHH....', '...........', '...........', '...........'],
    ['11111.11111', '22222.22222', '33333.33333', 'HHHHH.HHHHH', '.....P.....', 'SSSSS.SSSSS', '...........', '...........', '...........'],
    ['.PXP...PXP.', '.111...111.', '.222...222.', '.333...333.', '.HHH...HHH.', '...12321...', '...........', '...........', '...........'],
    ['HHHHHHHHHHH', 'H.........H', 'H.SSSSSSS.H', 'H.S1P2P1S.H', 'H.SSSSSSS.H', 'H....X....H', 'HHHHHHHHHHH', '...........', '...........'],
  ];

  var BLOCK_COLOR = {
    '1': '#4aa3ff', '2': '#3ddc84', '3': '#a97bff',
    H: '#ff9c3f', S: '#6c7794', X: '#ff5f6b', P: '#f0b429',
  };

  var POWERS = [
    { id: 'wide', ic: '↔', name: 'Breiter Schläger', col: '#3ddc84' },
    { id: 'narrow', ic: '↕', name: 'Schmaler Schläger', col: '#ff5f6b', bad: true },
    { id: 'multi', ic: '⁂', name: 'Drei Bälle', col: '#f0b429' },
    { id: 'slow', ic: '🐌', name: 'Langsamer Ball', col: '#4aa3ff' },
    { id: 'fast', ic: '⚡', name: 'Schneller Ball', col: '#ff9c3f', bad: true },
    { id: 'laser', ic: '↑', name: 'Laser', col: '#a97bff' },
    { id: 'sticky', ic: '⊙', name: 'Klebeschläger', col: '#34d3d3' },
    { id: 'life', ic: '♥', name: 'Extraleben', col: '#ff7ac8' },
  ];

  function mount(host) {
    var st = {
      level: 0, score: 0, lives: 3,
      blocks: null,
      paddle: { x: 0.5, w: 0.16, vx: 0 },
      balls: [],
      drops: [],
      shots: [],
      power: {},          // id -> Restzeit
      stuck: true,
      over: false, cleared: false,
      speedMul: 1,
      t: 0,
      msg: '', msgT: 0,
    };

    var stage = host.canvas({ alpha: false });
    var ctx = stage.ctx;
    var parts = G.particles(280);
    var shake = G.shake();

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
      { icon: '↻', label: 'Neu ab Level 1', onClick: function () { reset(0); } },
      { icon: '?', label: 'Anleitung', onClick: function () { help(true); } },
    ]);

    /* ---------------------------------------------------------- Aufbau */

    function loadLevel(n) {
      var src = LEVELS[n % LEVELS.length];
      var extraHard = Math.floor(n / LEVELS.length);
      st.blocks = [];
      for (var y = 0; y < ROWS; y++) {
        for (var x = 0; x < COLS; x++) {
          var ch = (src[y] || '')[x] || '.';
          if (ch === '.') continue;
          var solid = ch === 'S';
          var hp = ch === 'H' ? 2 : 1;
          if (extraHard && !solid && hp === 1 && (x + y) % (4 - Math.min(2, extraHard)) === 0) hp = 2;
          st.blocks.push({
            x: x, y: y, ch: ch, hp: hp, maxHp: hp, solid: solid,
            power: ch === 'P', hit: 0, dead: false,
          });
        }
      }
      st.balls = [];
      st.drops = [];
      st.shots = [];
      st.power = {};
      st.paddle.w = 0.16;
      st.speedMul = 1 + Math.min(0.5, n * 0.03);
      st.stuck = true;
      newBall();
      st.cleared = false;
      sLevel.set(String(n + 1));
    }

    function newBall() {
      st.balls = [{
        x: st.paddle.x, y: 0.86,
        vx: 0, vy: 0, r: 0.013, stuck: true, offset: 0,
      }];
      st.stuck = true;
    }

    function launch() {
      var any = false;
      for (var i = 0; i < st.balls.length; i++) {
        var b = st.balls[i];
        if (!b.stuck) continue;
        b.stuck = false;
        var ang = -Math.PI / 2 + (Math.random() - 0.5) * 0.5;
        var sp = 0.72 * st.speedMul;
        b.vx = Math.cos(ang) * sp;
        b.vy = Math.sin(ang) * sp;
        any = true;
      }
      if (any) host.sfx('blip');
      st.stuck = false;
    }

    function reset(level) {
      st.level = level || 0;
      st.score = level ? st.score : 0;
      st.lives = 3;
      st.over = false;
      parts.clear();
      host.closeOverlay();
      loadLevel(st.level);
      syncBar();
      loop.resume(true);
    }

    function syncBar() {
      sScore.set(U.num(st.score));
      sLives.set(String(st.lives));
      var b = host.best();
      sBest.set(b === null ? '—' : U.num(b));
    }

    function flash(t) { st.msg = t; st.msgT = 1.5; }

    /* ---------------------------------------------------------- Physik */

    var VIEW = { x: 0, y: 0, w: 1, h: 1 };   // Spielflaeche in Pixeln

    function px(v) { return VIEW.x + v * VIEW.w; }
    function py(v) { return VIEW.y + v * VIEW.h; }

    function blockRect(b) {
      var bw = 1 / COLS, bh = 0.055;
      return { x: b.x * bw, y: 0.08 + b.y * bh, w: bw, h: bh };
    }

    function hitBlock(b, power) {
      if (b.dead) return;
      if (b.solid) {
        b.hit = 0.18;
        host.sfx('tick');
        return;
      }
      b.hp -= power ? 99 : 1;
      b.hit = 0.18;
      if (b.hp > 0) { host.sfx('thud'); st.score += 5; return; }

      b.dead = true;
      st.score += b.ch === 'H' ? 40 : 20;
      var r = blockRect(b);
      var cx = px(r.x + r.w / 2), cy = py(r.y + r.h / 2);
      parts.burst(cx, cy, 9, {
        color: [BLOCK_COLOR[b.ch] || '#fff', '#ffffff'],
        speed: 150, life: 0.5, size: 3.4, g: 420, kind: 1,
      });
      host.sfx('hit');

      if (b.ch === 'X') {
        // Explosion reisst Nachbarn mit
        shake.hit(9, 0.25);
        host.sfx('explode');
        parts.burst(cx, cy, 22, {
          color: ['#ff5f6b', '#ff9c3f', '#ffd166'], speed: 260, life: 0.6, size: 4, g: 200,
        });
        st.blocks.forEach(function (o) {
          if (o.dead || o === b) return;
          if (Math.abs(o.x - b.x) <= 1 && Math.abs(o.y - b.y) <= 1) hitBlock(o, true);
        });
      }

      if (b.power) dropPower(cx, cy);
      checkCleared();
    }

    function dropPower(x, y) {
      var p = POWERS[U.irand(0, POWERS.length - 1)];
      st.drops.push({ x: (x - VIEW.x) / VIEW.w, y: (y - VIEW.y) / VIEW.h, vy: 0.26, p: p });
    }

    function applyPower(p) {
      flash(p.name);
      host.sfx(p.bad ? 'error' : 'power');
      host.buzz(20);
      switch (p.id) {
        case 'wide': st.paddle.w = Math.min(0.3, st.paddle.w * 1.4); break;
        case 'narrow': st.paddle.w = Math.max(0.08, st.paddle.w * 0.7); break;
        case 'multi': {
          var src = st.balls.slice();
          src.forEach(function (b) {
            for (var i = 0; i < 2; i++) {
              var a = Math.atan2(b.vy, b.vx) + (i ? 0.5 : -0.5);
              var sp = Math.hypot(b.vx, b.vy) || 0.7;
              st.balls.push({ x: b.x, y: b.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: b.r, stuck: false });
            }
          });
          break;
        }
        case 'slow': st.balls.forEach(function (b) { b.vx *= 0.75; b.vy *= 0.75; }); break;
        case 'fast': st.balls.forEach(function (b) { b.vx *= 1.25; b.vy *= 1.25; }); break;
        case 'laser': st.power.laser = 12; break;
        case 'sticky': st.power.sticky = 14; break;
        case 'life': st.lives++; syncBar(); break;
      }
    }

    function checkCleared() {
      var left = 0;
      for (var i = 0; i < st.blocks.length; i++) {
        var b = st.blocks[i];
        if (!b.dead && !b.solid) left++;
      }
      if (left > 0) return;
      st.cleared = true;
      st.score += 200 + st.level * 25;
      host.sfx('win');
      flash('Level geschafft!');
      host.after(function () {
        if (!st.cleared) return;
        st.level++;
        loadLevel(st.level);
        syncBar();
      }, 1100);
    }

    function loseBall() {
      st.lives--;
      syncBar();
      shake.hit(10, 0.3);
      host.sfx('lose');
      host.buzz(50);
      st.power = {};
      st.paddle.w = 0.16;
      if (st.lives <= 0) {
        st.over = true;
        host.gameOver({
          title: 'Alle Bälle weg',
          sub: 'Level ' + (st.level + 1),
          score: st.score,
          onAgain: function () { reset(0); },
        });
        return;
      }
      newBall();
    }

    function step(dt) {
      st.t += dt;
      shake.update(dt);
      parts.update(dt);
      if (st.msgT > 0) st.msgT -= dt;
      if (st.over) return;

      for (var k in st.power) {
        st.power[k] -= dt;
        if (st.power[k] <= 0) delete st.power[k];
      }

      var pw = st.paddle.w;
      var pxs = st.paddle.x;
      var pyTop = 0.9;

      // Baelle
      for (var i = st.balls.length - 1; i >= 0; i--) {
        var b = st.balls[i];
        if (b.stuck) {
          b.x = U.clamp(pxs + (b.offset || 0), pw / 2, 1 - pw / 2);
          b.y = pyTop - b.r - 0.004;
          continue;
        }

        var steps = Math.max(1, Math.ceil(Math.hypot(b.vx, b.vy) * dt / 0.012));
        var sdt = dt / steps;
        for (var s = 0; s < steps; s++) {
          b.x += b.vx * sdt;
          b.y += b.vy * sdt;

          if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); host.sfx('tick'); }
          if (b.x > 1 - b.r) { b.x = 1 - b.r; b.vx = -Math.abs(b.vx); host.sfx('tick'); }
          if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy); host.sfx('tick'); }

          // Schlaeger
          if (b.vy > 0 && b.y + b.r >= pyTop && b.y - b.r < pyTop + 0.03) {
            if (b.x > pxs - pw / 2 - b.r && b.x < pxs + pw / 2 + b.r) {
              b.y = pyTop - b.r;
              var rel = U.clamp((b.x - pxs) / (pw / 2), -1, 1);
              var sp = Math.min(1.35, Math.hypot(b.vx, b.vy) * 1.012);
              var ang = -Math.PI / 2 + rel * 1.05 + st.paddle.vx * 0.22;
              ang = U.clamp(ang, -Math.PI + 0.35, -0.35);
              b.vx = Math.cos(ang) * sp;
              b.vy = Math.sin(ang) * sp;
              host.sfx('pop');
              if (st.power.sticky) { b.stuck = true; b.offset = b.x - pxs; }
            }
          }

          // Bloecke
          for (var q = 0; q < st.blocks.length; q++) {
            var bl = st.blocks[q];
            if (bl.dead) continue;
            var r = blockRect(bl);
            if (b.x + b.r < r.x || b.x - b.r > r.x + r.w) continue;
            if (b.y + b.r < r.y || b.y - b.r > r.y + r.h) continue;

            // Ueberlappung bestimmt die Reflexionsachse
            var ox = Math.min(b.x + b.r - r.x, r.x + r.w - (b.x - b.r));
            var oy = Math.min(b.y + b.r - r.y, r.y + r.h - (b.y - b.r));
            if (ox < oy) { b.vx = -b.vx; b.x += b.vx > 0 ? ox : -ox; }
            else { b.vy = -b.vy; b.y += b.vy > 0 ? oy : -oy; }
            hitBlock(bl, false);
            break;
          }

          if (b.y > 1.06) { st.balls.splice(i, 1); break; }
        }
      }

      if (!st.balls.length && !st.cleared) loseBall();

      // Extras
      for (i = st.drops.length - 1; i >= 0; i--) {
        var d = st.drops[i];
        d.y += d.vy * dt;
        if (d.y > 1.05) { st.drops.splice(i, 1); continue; }
        if (d.y > pyTop - 0.02 && d.y < pyTop + 0.04 &&
          Math.abs(d.x - pxs) < pw / 2 + 0.03) {
          applyPower(d.p);
          st.drops.splice(i, 1);
        }
      }

      // Laser
      for (i = st.shots.length - 1; i >= 0; i--) {
        var sh = st.shots[i];
        sh.y -= 1.4 * dt;
        if (sh.y < 0.02) { st.shots.splice(i, 1); continue; }
        var hitOne = false;
        for (q = 0; q < st.blocks.length; q++) {
          var b2 = st.blocks[q];
          if (b2.dead) continue;
          var rr = blockRect(b2);
          if (sh.x >= rr.x && sh.x <= rr.x + rr.w && sh.y >= rr.y && sh.y <= rr.y + rr.h) {
            hitBlock(b2, false);
            hitOne = true;
            break;
          }
        }
        if (hitOne) st.shots.splice(i, 1);
      }
      if (st.power.laser) {
        laserTimer -= dt;
        if (laserTimer <= 0) {
          laserTimer = 0.35;
          st.shots.push({ x: pxs - pw / 2 + 0.01, y: pyTop - 0.02 });
          st.shots.push({ x: pxs + pw / 2 - 0.01, y: pyTop - 0.02 });
          host.sfx('laser');
        }
      }

      // Tastatur (Entwicklung am Rechner, externe Tastatur am iPad)
      if (keys) {
        var ax = keys.axis('arrowleft', 'arrowright') + keys.axis('a', 'd');
        if (ax) {
          var nkx = U.clamp(st.paddle.x + ax * dt * 1.1, st.paddle.w / 2, 1 - st.paddle.w / 2);
          st.paddle.vx = (nkx - st.paddle.x) * 30;
          st.paddle.x = nkx;
        }
      }

      st.paddle.vx *= Math.exp(-8 * dt);
    }
    var laserTimer = 0;

    /* ---------------------------------------------------------- Zeichnen */

    function relayout(w, h) {
      var pad = 8;
      var aw = w - pad * 2, ah = h - pad * 2;
      // Seitenverhaeltnis 4:5 wirkt am besten
      var target = 0.82;
      if (aw / ah > target) { VIEW.h = ah; VIEW.w = ah * target; }
      else { VIEW.w = aw; VIEW.h = aw / target; }
      VIEW.x = (w - VIEW.w) / 2;
      VIEW.y = (h - VIEW.h) / 2;
    }
    stage.onResize = relayout;

    function draw() {
      var w = stage.w, h = stage.h;
      if (!VIEW.w || VIEW.w === 1) relayout(w, h);
      ctx.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0);
      ctx.fillStyle = '#0b0e15';
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      shake.apply(ctx);

      // Spielfeld
      G.fillRound(ctx, VIEW.x - 4, VIEW.y - 4, VIEW.w + 8, VIEW.h + 8, 10, '#141a27');
      ctx.fillStyle = '#0d121c';
      ctx.fillRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);

      // Bloecke
      var bw = VIEW.w / COLS, bh = VIEW.h * 0.055;
      for (var i = 0; i < st.blocks.length; i++) {
        var b = st.blocks[i];
        if (b.dead) continue;
        var r = blockRect(b);
        var x = px(r.x), y = py(r.y);
        var col = BLOCK_COLOR[b.ch] || '#888';
        if (b.ch === 'H' && b.hp === 1) col = U.shade(col, -0.35);
        if (b.hit > 0) col = U.mixHex(col, '#ffffff', b.hit * 3);
        G.fillRound(ctx, x + 1, y + 1, bw - 2, bh - 2, 3, col);
        ctx.globalAlpha = 0.28;
        G.fillRound(ctx, x + 2, y + 2, bw - 4, (bh - 4) * 0.45, 2, '#ffffff');
        ctx.globalAlpha = 1;
        if (b.ch === 'S') {
          ctx.strokeStyle = 'rgba(255,255,255,.25)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 3.5, y + 3.5, bw - 7, bh - 7);
        }
        if (b.ch === 'X') {
          G.text(ctx, '✳', x + bw / 2, y + bh / 2, {
            size: bh * 0.7, color: 'rgba(255,255,255,.75)', align: 'center', baseline: 'middle',
          });
        }
        if (b.power) {
          G.circle(ctx, x + bw / 2, y + bh / 2, bh * 0.2, 'rgba(255,255,255,.75)');
        }
        if (b.hit > 0) b.hit = Math.max(0, b.hit - 0.02);
      }

      // Schlaeger
      var pw = st.paddle.w * VIEW.w, ph = VIEW.h * 0.018;
      var pxp = px(st.paddle.x) - pw / 2, pyp = py(0.9);
      var pcol = st.power.sticky ? '#34d3d3' : (st.power.laser ? '#a97bff' : '#c8d4ea');
      G.fillRound(ctx, pxp, pyp, pw, ph, ph / 2, pcol);
      G.fillRound(ctx, pxp + 3, pyp + 1, pw - 6, ph * 0.4, ph / 3, 'rgba(255,255,255,.45)');
      if (st.power.laser) {
        G.fillRound(ctx, pxp - 1, pyp - ph * 0.7, 4, ph * 0.9, 1, '#a97bff');
        G.fillRound(ctx, pxp + pw - 3, pyp - ph * 0.7, 4, ph * 0.9, 1, '#a97bff');
      }

      // Schuesse
      st.shots.forEach(function (s) {
        G.fillRound(ctx, px(s.x) - 1.5, py(s.y), 3, VIEW.h * 0.03, 1.5, '#d5b8ff');
      });

      // Extras
      st.drops.forEach(function (d) {
        var dx = px(d.x), dy = py(d.y);
        G.fillRound(ctx, dx - 13, dy - 9, 26, 18, 6, d.p.col);
        G.text(ctx, d.p.ic, dx, dy + 1, {
          size: 12, weight: 700, color: '#12151d', align: 'center', baseline: 'middle',
        });
      });

      // Baelle
      st.balls.forEach(function (b) {
        var bx = px(b.x), by = py(b.y), br = b.r * VIEW.w;
        G.glow(ctx, bx, by, br * 3.4, 'rgba(255,255,255,.5)', 0.32);
        G.circle(ctx, bx, by, br, '#ffffff');
      });

      parts.draw(ctx);

      // Startaufforderung
      if (st.balls.length && st.balls[0].stuck && !st.over) {
        var a = 0.6 + Math.sin(st.t * 3) * 0.3;
        ctx.globalAlpha = a;
        G.text(ctx, 'Tippen zum Abschuss', px(0.5), py(0.72), {
          size: 15, weight: 650, color: '#c8d4ea', align: 'center', baseline: 'middle',
        });
        ctx.globalAlpha = 1;
      }

      if (st.msgT > 0) {
        ctx.globalAlpha = U.clamp(st.msgT / 0.5, 0, 1);
        G.text(ctx, st.msg, px(0.5), py(0.52), {
          size: 22, weight: 800, color: '#ffd166', align: 'center', baseline: 'middle',
          shadow: 'rgba(0,0,0,.6)', sy: 2,
        });
        ctx.globalAlpha = 1;
      }

      // Aktive Extras
      var ax = VIEW.x + 8, ay = VIEW.y + VIEW.h - 8;
      for (var k in st.power) {
        var p2 = POWERS.filter(function (o) { return o.id === k; })[0];
        if (!p2) continue;
        G.fillRound(ctx, ax, ay - 16, 40, 16, 5, p2.col);
        G.text(ctx, p2.ic + ' ' + Math.ceil(st.power[k]), ax + 20, ay - 8, {
          size: 10, weight: 700, color: '#12151d', align: 'center', baseline: 'middle',
        });
        ax += 46;
      }

      ctx.restore();
    }

    /* ---------------------------------------------------------- Schleife */

    loop = host.loop({ hz: 120, update: step, render: draw });

    host.input({
      onDown: function (p) { movePaddle(p.x); },
      onMove: function (p) { movePaddle(p.x); },
      onTap: function () { launch(); },
    });

    function movePaddle(sx) {
      var nx = U.clamp((sx - VIEW.x) / VIEW.w, st.paddle.w / 2, 1 - st.paddle.w / 2);
      st.paddle.vx = (nx - st.paddle.x) * 30;
      st.paddle.x = nx;
    }

    var keys = host.keys({
      onDown: function (k) { if (k === 'space' || k === 'arrowup') launch(); },
    });

    function help(force) {
      SG.tutorial.show({
        id: 'breakout', force: force, parent: host.root, title: 'Blockbrecher',
        pages: [{
          kicker: 'Blockbrecher', title: 'Alles kurz und klein',
          art: SG.tutorial.art.swipe,
          body: [
            { ic: '👆', text: 'Den Finger über den Bildschirm ziehen bewegt den <b>Schläger</b>.' },
            { ic: '⚡', text: 'Wo der Ball auftrifft, bestimmt den Winkel — und ein bewegter Schläger gibt <b>Drall</b> mit.' },
            { ic: '🎁', text: 'Steine mit weißem Punkt lassen ein <b>Extra</b> fallen. Nicht jedes ist gut.' },
            { ic: '✳', text: 'Rote Steine <b>explodieren</b> und reißen die Nachbarn mit. Graue Stahlsteine bleiben.' },
            { ic: '🏁', text: '24 Level. Danach geht es härter von vorn los.' },
          ],
        }],
      });
    }

    reset(0);
    loop.start();
    help(false);

    return {
      state: st,
      destroy: function () { keys.destroy(); },
      selftest: function (steps) {
        reset(0);
        relayout(900, 620);
        launch();
        var r = U.rng(808);
        for (var i = 0; i < (steps || 600); i++) {
          st.paddle.x = U.clamp(0.5 + Math.sin(i * 0.11) * 0.4, 0.1, 0.9);
          step(1 / 120);
          if (st.over) reset(0);
          if (!isFinite(st.paddle.x)) throw new Error('Schlägerposition ungültig');
          for (var q = 0; q < st.balls.length; q++) {
            if (!isFinite(st.balls[q].x) || !isFinite(st.balls[q].y)) {
              throw new Error('Ballposition ungültig');
            }
          }
        }
        // Alle Level muessen ladbar sein
        for (var n = 0; n < LEVELS.length; n++) {
          loadLevel(n);
          if (!st.blocks.length) throw new Error('Level ' + (n + 1) + ' ist leer');
          var breakable = 0;
          st.blocks.forEach(function (b) { if (!b.solid) breakable++; });
          if (!breakable) throw new Error('Level ' + (n + 1) + ' hat keine zerstörbaren Steine');
        }
        draw();
      },
    };
  }

  SG.register({
    id: 'breakout',
    name: 'Blockbrecher',
    category: 'arcade',
    desc: '24 Level, Extras, Explosionen',
    tags: ['breakout', 'arkanoid', 'ball', 'schlaeger'],
    preview: function (c, w, h) {
      var cols = 11, rows = 5;
      var bw = w * 0.86 / cols, bh = h * 0.09;
      var x0 = (w - bw * cols) / 2, y0 = h * 0.12;
      var pat = LEVELS[5];
      for (var y = 0; y < rows; y++) {
        for (var x = 0; x < cols; x++) {
          var ch = pat[y][x];
          if (ch === '.') continue;
          var col = BLOCK_COLOR[ch] || '#888';
          G.fillRound(c, x0 + x * bw + 1, y0 + y * bh + 1, bw - 2, bh - 2, 2, col);
          c.globalAlpha = .3;
          G.fillRound(c, x0 + x * bw + 2, y0 + y * bh + 2, bw - 4, (bh - 4) * .45, 2, '#fff');
          c.globalAlpha = 1;
        }
      }
      var pw = w * 0.19, ph = h * 0.035;
      G.fillRound(c, w / 2 - pw / 2, h * 0.85, pw, ph, ph / 2, '#c8d4ea');
      G.glow(c, w * 0.42, h * 0.74, 14, 'rgba(255,255,255,.5)', .35);
      G.circle(c, w * 0.42, h * 0.74, h * 0.028, '#ffffff');
    },
    mount: mount,
  });
})(SG);
