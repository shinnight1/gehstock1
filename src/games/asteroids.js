/* ------------------------------------------------------------------
   Asteroids

   Traegheit statt Direktsteuerung: das Schiff behaelt seinen Schwung.
   Brocken zerfallen in drei Stufen, Ufos zielen mit, Hyperraum bringt
   dich weg - manchmal auch mitten hinein.

   Steuerung: linker Stick dreht und schiebt, rechts tippen feuert.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var G = SG.gfx;

  var W = 1000, H = 700;      // Weltmass, wird auf die Flaeche skaliert

  function mount(host) {
    var st = {
      ship: { x: W / 2, y: H / 2, vx: 0, vy: 0, a: -Math.PI / 2, alive: true, shield: 3, thrust: 0 },
      rocks: [], shots: [], ufos: [], ufoShots: [],
      wave: 1, score: 0, lives: 3,
      over: false, respawn: 0, t: 0,
      ufoT: 22,
      hyper: 0,
      msg: '', msgT: 0,
    };

    var stage = host.canvas({ alpha: false });
    var ctx = stage.ctx;
    var parts = G.particles(320);
    var shake = G.shake();

    var sScore = host.stat('Punkte', '0', 'gold');
    var sWave = host.stat('Welle', '1');
    var sLives = host.stat('Schiffe', '3', 'red');
    var sBest = host.stat('Bestwert', '—');

    var loop;
    host.tool('❚❚', function () {
      var p = loop.toggle();
      if (p) host.showPause(function () { loop.resume(true); });
    });
    host.menuTool([
      { icon: '↻', label: 'Neues Spiel', onClick: reset },
      { icon: '?', label: 'Anleitung', onClick: function () { help(true); } },
    ]);

    /* ---------------------------------------------------------- Objekte */

    function makeRock(x, y, size) {
      var r = [24, 46, 78][size];
      var pts = [];
      var n = 9 + U.irand(0, 3);
      for (var i = 0; i < n; i++) {
        var a = (i / n) * Math.PI * 2;
        var rad = r * (0.72 + Math.random() * 0.45);
        pts.push(Math.cos(a) * rad, Math.sin(a) * rad);
      }
      var sp = (28 + Math.random() * 42) * (1 + (2 - size) * 0.35) * (1 + st.wave * 0.05);
      var dir = Math.random() * Math.PI * 2;
      return {
        x: x, y: y, r: r * 0.82, size: size,
        vx: Math.cos(dir) * sp, vy: Math.sin(dir) * sp,
        a: Math.random() * 6.28, va: (Math.random() - 0.5) * 1.4,
        pts: pts,
      };
    }

    function spawnWave(n) {
      st.rocks = [];
      var count = 3 + n;
      for (var i = 0; i < count; i++) {
        var x, y, tries = 0;
        do {
          x = Math.random() * W;
          y = Math.random() * H;
          tries++;
        } while (tries < 40 && U.dist(x, y, st.ship.x, st.ship.y) < 220);
        st.rocks.push(makeRock(x, y, 2));
      }
      st.ufos = [];
      st.ufoShots = [];
      st.ufoT = 20 - Math.min(12, n * 1.2);
    }

    function reset() {
      st.wave = 1; st.score = 0; st.lives = 3;
      st.over = false; st.respawn = 0;
      st.shots = [];
      resetShip();
      spawnWave(1);
      parts.clear();
      host.closeOverlay();
      syncBar();
      loop.resume(true);
    }

    function resetShip() {
      var s = st.ship;
      s.x = W / 2; s.y = H / 2; s.vx = 0; s.vy = 0; s.a = -Math.PI / 2;
      s.alive = true; s.shield = 2.5;
    }

    function syncBar() {
      sScore.set(U.num(st.score));
      sWave.set(String(st.wave));
      sLives.set(String(st.lives));
      var b = host.best();
      sBest.set(b === null ? '—' : U.num(b));
    }

    function flash(t) { st.msg = t; st.msgT = 1.6; }

    function wrap(o) {
      if (o.x < -40) o.x += W + 80;
      if (o.x > W + 40) o.x -= W + 80;
      if (o.y < -40) o.y += H + 80;
      if (o.y > H + 40) o.y -= H + 80;
    }

    function fire() {
      if (!st.ship.alive || st.over) return;
      if (st.shots.length >= 5) return;
      var s = st.ship;
      st.shots.push({
        x: s.x + Math.cos(s.a) * 16,
        y: s.y + Math.sin(s.a) * 16,
        vx: s.vx + Math.cos(s.a) * 520,
        vy: s.vy + Math.sin(s.a) * 520,
        life: 1.15,
      });
      host.sfx('laser');
    }

    function hyperspace() {
      if (!st.ship.alive || st.hyper > 0 || st.over) return;
      st.hyper = 1.2;
      var p = { x: st.ship.x, y: st.ship.y };
      parts.burst(p.x, p.y, 18, { color: ['#a97bff', '#ffffff'], speed: 200, life: 0.5, size: 3, g: 0, drag: 3 });
      st.ship.x = 60 + Math.random() * (W - 120);
      st.ship.y = 60 + Math.random() * (H - 120);
      st.ship.vx *= 0.2; st.ship.vy *= 0.2;
      host.sfx('whoosh');
      // Kleines Risiko: direkt in einen Brocken springen
      for (var i = 0; i < st.rocks.length; i++) {
        var r = st.rocks[i];
        if (U.dist(r.x, r.y, st.ship.x, st.ship.y) < r.r + 14) { die(); return; }
      }
      st.ship.shield = 1.2;
    }

    function splitRock(idx) {
      var r = st.rocks[idx];
      st.score += [100, 50, 20][r.size];
      parts.burst(r.x, r.y, 10 + r.size * 5, {
        color: ['#c8d4ea', '#8794b1'], speed: 90 + r.size * 40, life: 0.6, size: 2.5, g: 0, drag: 1.6,
      });
      st.rocks.splice(idx, 1);
      if (r.size > 0) {
        for (var i = 0; i < 2; i++) {
          var nr = makeRock(r.x, r.y, r.size - 1);
          nr.vx += r.vx * 0.4;
          nr.vy += r.vy * 0.4;
          st.rocks.push(nr);
        }
      }
      host.sfx('hit');
      shake.hit(4 + r.size * 2, 0.2);
      syncBar();
      if (!st.rocks.length) {
        st.wave++;
        flash('Welle ' + st.wave);
        host.sfx('levelup');
        st.score += 150;
        host.after(function () { if (!st.over) spawnWave(st.wave); }, 900);
      }
    }

    function die() {
      if (!st.ship.alive || st.ship.shield > 0) return;
      st.ship.alive = false;
      st.lives--;
      syncBar();
      shake.hit(16, 0.5);
      host.sfx('explode');
      host.buzz(70);
      parts.burst(st.ship.x, st.ship.y, 30, {
        color: ['#4aa3ff', '#ffffff', '#ff9c3f'], speed: 220, life: 0.9, size: 3.5, g: 0, drag: 1.1,
      });
      if (st.lives <= 0) {
        st.over = true;
        host.gameOver({
          title: 'Schiff zerstört',
          sub: 'Welle ' + st.wave,
          score: st.score,
          onAgain: reset,
        });
        return;
      }
      st.respawn = 1.6;
    }

    function spawnUfo() {
      var big = Math.random() < 0.55;
      var fromLeft = Math.random() < 0.5;
      st.ufos.push({
        x: fromLeft ? -30 : W + 30,
        y: 60 + Math.random() * (H - 120),
        vx: (fromLeft ? 1 : -1) * (big ? 90 : 135),
        vy: 0, big: big, r: big ? 22 : 14,
        fireT: 1.2, wobble: Math.random() * 6.28,
      });
      host.sfx('ship');
    }

    /* ---------------------------------------------------------- Schritt */

    function step(dt) {
      st.t += dt;
      shake.update(dt);
      parts.update(dt);
      if (st.msgT > 0) st.msgT -= dt;
      if (st.hyper > 0) st.hyper -= dt;
      if (st.over) return;

      var s = st.ship;

      if (!s.alive) {
        st.respawn -= dt;
        if (st.respawn <= 0) {
          // Nur zurueckkommen, wenn die Mitte halbwegs frei ist
          var clear = true;
          for (var i = 0; i < st.rocks.length; i++) {
            if (U.dist(st.rocks[i].x, st.rocks[i].y, W / 2, H / 2) < 150) clear = false;
          }
          if (clear) resetShip();
          else st.respawn = 0.4;
        }
      } else {
        // Steuerung
        var turn = 0, thrust = 0;
        if (stick.state.active) {
          var m = stick.state.mag;
          if (m > 0.2) {
            var target = stick.state.angle;
            var diff = U.angleDiff(s.a, target);
            turn = U.clamp(diff * 6, -4.2, 4.2);
            thrust = U.clamp((m - 0.2) / 0.8, 0, 1);
          }
        }
        if (keys) {
          var kt = keys.axis('arrowleft', 'arrowright') + keys.axis('a', 'd');
          if (kt) turn = kt * 3.6;
          if (keys.any('arrowup', 'w')) thrust = 1;
        }
        s.a += turn * dt;
        s.thrust = U.damp(s.thrust, thrust, 12, dt);

        if (thrust > 0.05) {
          var acc = 330 * thrust;
          s.vx += Math.cos(s.a) * acc * dt;
          s.vy += Math.sin(s.a) * acc * dt;
          if (Math.random() < thrust * 0.8) {
            parts.spawn({
              x: s.x - Math.cos(s.a) * 14, y: s.y - Math.sin(s.a) * 14,
              vx: -Math.cos(s.a) * 140 + (Math.random() - .5) * 60,
              vy: -Math.sin(s.a) * 140 + (Math.random() - .5) * 60,
              life: 0.32, size: 2.6, color: Math.random() < 0.5 ? '#ff9c3f' : '#ffd166', g: 0, drag: 3,
            });
          }
        }
        var drag = Math.exp(-0.32 * dt);
        s.vx *= drag; s.vy *= drag;
        var sp = Math.hypot(s.vx, s.vy);
        if (sp > 460) { s.vx *= 460 / sp; s.vy *= 460 / sp; }
        s.x += s.vx * dt; s.y += s.vy * dt;
        wrap(s);
        if (s.shield > 0) s.shield -= dt;
      }

      // Schuesse
      for (var q = st.shots.length - 1; q >= 0; q--) {
        var sh = st.shots[q];
        sh.life -= dt;
        if (sh.life <= 0) { st.shots.splice(q, 1); continue; }
        sh.x += sh.vx * dt; sh.y += sh.vy * dt;
        wrap(sh);
        var hit = false;
        for (i = st.rocks.length - 1; i >= 0; i--) {
          if (U.dist(sh.x, sh.y, st.rocks[i].x, st.rocks[i].y) < st.rocks[i].r) {
            splitRock(i);
            hit = true;
            break;
          }
        }
        if (!hit) {
          for (i = st.ufos.length - 1; i >= 0; i--) {
            var uf = st.ufos[i];
            if (U.dist(sh.x, sh.y, uf.x, uf.y) < uf.r) {
              st.score += uf.big ? 200 : 500;
              parts.burst(uf.x, uf.y, 18, { color: ['#ff5f6b', '#ffd166'], speed: 180, life: 0.6, size: 3, g: 0, drag: 2 });
              st.ufos.splice(i, 1);
              host.sfx('explode');
              syncBar();
              hit = true;
              break;
            }
          }
        }
        if (hit) st.shots.splice(q, 1);
      }

      // Brocken
      for (i = 0; i < st.rocks.length; i++) {
        var r = st.rocks[i];
        r.x += r.vx * dt; r.y += r.vy * dt; r.a += r.va * dt;
        wrap(r);
        if (s.alive && s.shield <= 0 && U.dist(r.x, r.y, s.x, s.y) < r.r + 11) die();
      }

      // Ufos
      st.ufoT -= dt;
      if (st.ufoT <= 0 && st.ufos.length < 2) {
        spawnUfo();
        st.ufoT = 18 + Math.random() * 14;
      }
      for (i = st.ufos.length - 1; i >= 0; i--) {
        var u = st.ufos[i];
        u.wobble += dt * 1.6;
        u.vy = Math.sin(u.wobble) * 60;
        u.x += u.vx * dt; u.y += u.vy * dt;
        if (u.x < -60 || u.x > W + 60) { st.ufos.splice(i, 1); continue; }
        u.fireT -= dt;
        if (u.fireT <= 0 && s.alive) {
          u.fireT = u.big ? 1.5 : 0.95;
          var ang = u.big
            ? Math.random() * 6.28
            : Math.atan2(s.y - u.y, s.x - u.x) + (Math.random() - 0.5) * 0.22;
          st.ufoShots.push({
            x: u.x, y: u.y,
            vx: Math.cos(ang) * 300, vy: Math.sin(ang) * 300, life: 2.2,
          });
          host.sfx('blip');
        }
        if (s.alive && s.shield <= 0 && U.dist(u.x, u.y, s.x, s.y) < u.r + 11) die();
      }
      // Dauerfeuer bei gehaltenem Knopf
      if (pad) {
        holdT -= dt;
        if (pad.down('fire') && holdT <= 0) { fire(); holdT = 0.17; }
      }

      for (i = st.ufoShots.length - 1; i >= 0; i--) {
        var us = st.ufoShots[i];
        us.life -= dt;
        us.x += us.vx * dt; us.y += us.vy * dt;
        wrap(us);
        if (us.life <= 0) { st.ufoShots.splice(i, 1); continue; }
        if (s.alive && s.shield <= 0 && U.dist(us.x, us.y, s.x, s.y) < 12) {
          st.ufoShots.splice(i, 1);
          die();
        }
      }
    }

    var holdT = 0;

    /* ---------------------------------------------------------- Zeichnen */

    var VIEW = { x: 0, y: 0, s: 1 };

    function relayout(w, h) {
      VIEW.s = Math.min(w / W, h / H);
      VIEW.x = (w - W * VIEW.s) / 2;
      VIEW.y = (h - H * VIEW.s) / 2;
    }
    stage.onResize = relayout;

    function draw() {
      var w = stage.w, h = stage.h;
      if (VIEW.s === 1) relayout(w, h);
      ctx.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0);
      ctx.fillStyle = '#05070c';
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      shake.apply(ctx);
      ctx.translate(VIEW.x, VIEW.y);
      ctx.scale(VIEW.s, VIEW.s);

      // Rahmen
      ctx.strokeStyle = 'rgba(74,163,255,.16)';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, W, H);

      var stars = G.cache('ast-stars', W, H, function (c) {
        var r = U.rng(4242);
        for (var i = 0; i < 130; i++) {
          c.fillStyle = 'rgba(200,214,234,' + (0.12 + r() * 0.4).toFixed(2) + ')';
          var s2 = r() < 0.12 ? 2 : 1;
          c.fillRect(r() * W, r() * H, s2, s2);
        }
      });
      ctx.drawImage(stars, 0, 0);

      // Brocken
      ctx.strokeStyle = '#c8d4ea';
      ctx.lineWidth = 2;
      for (var i = 0; i < st.rocks.length; i++) {
        var r = st.rocks[i];
        ctx.save();
        ctx.translate(r.x, r.y);
        ctx.rotate(r.a);
        ctx.beginPath();
        for (var k = 0; k < r.pts.length; k += 2) {
          if (k === 0) ctx.moveTo(r.pts[0], r.pts[1]);
          else ctx.lineTo(r.pts[k], r.pts[k + 1]);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(40,50,72,.55)';
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // Ufos
      st.ufos.forEach(function (u) {
        var k2 = u.r;
        ctx.strokeStyle = u.big ? '#ff9c3f' : '#ff5f6b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(u.x, u.y, k2, k2 * 0.42, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(u.x, u.y - k2 * 0.35, k2 * 0.5, k2 * 0.34, 0, Math.PI, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(u.x - k2, u.y); ctx.lineTo(u.x + k2, u.y);
        ctx.stroke();
      });

      // Schuesse
      ctx.fillStyle = '#ffffff';
      st.shots.forEach(function (s2) { G.circle(ctx, s2.x, s2.y, 2.6, '#ffffff'); });
      st.ufoShots.forEach(function (s2) { G.circle(ctx, s2.x, s2.y, 3, '#ff9c3f'); });

      parts.draw(ctx);

      // Schiff
      var s = st.ship;
      if (s.alive) {
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.a);
        if (s.thrust > 0.06) {
          ctx.strokeStyle = '#ff9c3f';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-8, -5);
          ctx.lineTo(-14 - s.thrust * 10 * (0.7 + Math.random() * 0.6), 0);
          ctx.lineTo(-8, 5);
          ctx.stroke();
        }
        ctx.strokeStyle = '#e9edf6';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(16, 0);
        ctx.lineTo(-11, -10);
        ctx.lineTo(-6, 0);
        ctx.lineTo(-11, 10);
        ctx.closePath();
        ctx.fillStyle = 'rgba(30,42,66,.8)';
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        if (s.shield > 0) {
          ctx.globalAlpha = 0.3 + Math.sin(st.t * 14) * 0.2;
          G.ring(ctx, s.x, s.y, 22, 2, '#4aa3ff');
          ctx.globalAlpha = 1;
        }
      }

      ctx.restore();

      if (st.msgT > 0) {
        ctx.globalAlpha = U.clamp(st.msgT / 0.5, 0, 1);
        G.text(ctx, st.msg, w / 2, h * 0.32, {
          size: 26, weight: 800, color: '#ffd166', align: 'center', baseline: 'middle',
        });
        ctx.globalAlpha = 1;
      }
    }

    /* ---------------------------------------------------------- Steuerung */

    loop = host.loop({ hz: 60, update: step, render: draw });

    var lefty = SG.settings.get('leftHanded');
    var stick = host.stick({ pos: lefty ? 'br' : 'bl' });
    var pad = host.pad([
      { name: 'fire', label: '⌁', cls: 'lg' },
      { name: 'hyper', label: '✳', cls: '' },
    ], {
      pos: lefty ? 'bl' : 'br',
      onPress: function (n) {
        if (n === 'fire') fire();
        else hyperspace();
      },
    });

    var keys = host.keys({
      onDown: function (k) {
        if (k === 'space') fire();
        else if (k === 'h' || k === 'shift') hyperspace();
      },
    });

    function help(force) {
      SG.tutorial.show({
        id: 'asteroids', force: force, parent: host.root, title: 'Asteroids',
        pages: [{
          kicker: 'Asteroids', title: 'Schwung nimmt man mit',
          art: SG.tutorial.art.pinch,
          body: [
            { ic: '🕹', text: 'Der <b>Stick</b> dreht das Schiff in die gezogene Richtung und schiebt es an.' },
            { ic: '⌁', text: 'Der große Knopf <b>feuert</b> — gedrückt halten geht auch.' },
            { ic: '✳', text: '<b>Hyperraum</b> setzt dich sofort woanders hin. Selten landet man dabei in einem Brocken.' },
            { ic: '🪨', text: 'Große Brocken zerfallen in mittlere, mittlere in kleine. Kleine geben am wenigsten Punkte, sind aber am schnellsten.' },
            { ic: '🛸', text: 'Das kleine Ufo <b>zielt</b> auf dich und ist 500 Punkte wert.' },
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
        var r = U.rng(31);
        for (var i = 0; i < (steps || 600); i++) {
          if (r() < 0.15) fire();
          if (r() < 0.01) hyperspace();
          st.ship.a += (r() - 0.5) * 0.4;
          step(1 / 60);
          if (st.over) reset();
          if (!isFinite(st.ship.x) || !isFinite(st.ship.vx)) {
            throw new Error('Schiffszustand ungültig');
          }
        }
        // Brocken zerteilen sich in kleinere Stufen
        var before = st.rocks.length;
        if (before) {
          var size = st.rocks[0].size;
          splitRock(0);
          if (size > 0 && st.rocks.length !== before + 1) {
            throw new Error('Brocken hat sich nicht korrekt geteilt');
          }
        }
        draw();
      },
    };
  }

  SG.register({
    id: 'asteroids',
    name: 'Asteroids',
    category: 'arcade',
    desc: 'Trägheit, Ufos, Hyperraum',
    tags: ['weltraum', 'brocken', 'klassiker', 'physik'],
    preview: function (c, w, h) {
      c.fillStyle = '#05070c';
      c.fillRect(0, 0, w, h);
      var r = U.rng(77);
      for (var i = 0; i < 46; i++) {
        c.fillStyle = 'rgba(200,214,234,' + (0.15 + r() * 0.45).toFixed(2) + ')';
        c.fillRect(r() * w, r() * h, 1, 1);
      }
      function rock(x, y, rad) {
        c.save();
        c.translate(x, y);
        c.rotate(r() * 6.28);
        c.beginPath();
        var n = 10;
        for (var k = 0; k < n; k++) {
          var a = (k / n) * Math.PI * 2;
          var rr = rad * (0.72 + r() * 0.45);
          if (k === 0) c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
          else c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        c.closePath();
        c.fillStyle = 'rgba(40,50,72,.6)';
        c.fill();
        c.strokeStyle = '#c8d4ea';
        c.lineWidth = 1.6;
        c.stroke();
        c.restore();
      }
      rock(w * 0.22, h * 0.28, h * 0.17);
      rock(w * 0.76, h * 0.34, h * 0.12);
      rock(w * 0.62, h * 0.75, h * 0.09);
      c.save();
      c.translate(w * 0.42, h * 0.6);
      c.rotate(-0.5);
      c.strokeStyle = '#e9edf6';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(14, 0); c.lineTo(-10, -9); c.lineTo(-5, 0); c.lineTo(-10, 9);
      c.closePath();
      c.fillStyle = 'rgba(30,42,66,.85)';
      c.fill();
      c.stroke();
      c.strokeStyle = '#ff9c3f';
      c.beginPath();
      c.moveTo(-7, -4); c.lineTo(-18, 0); c.lineTo(-7, 4);
      c.stroke();
      c.restore();
      G.circle(c, w * 0.55, h * 0.45, 2.4, '#fff');
      G.circle(c, w * 0.63, h * 0.38, 2.4, '#fff');
    },
    mount: mount,
  });
})(SG);
