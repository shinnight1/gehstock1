/* ------------------------------------------------------------------
   Flatterflug

   Ein Tipp gibt Auftrieb, sonst zieht die Schwerkraft. Der Himmel
   wechselt mit dem Punktestand die Tageszeit, ab und zu gibt es
   Medaillen - und wenn knapp Schluss ist, siehst du, wie knapp.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var G = SG.gfx;

  var W = 400, H = 640;        // Weltmass

  var SKIES = [
    { name: 'Morgen', top: '#2a3f6b', bot: '#7b6aa0', ground: '#3b5240', sun: '#ffd166' },
    { name: 'Mittag', top: '#2b6db5', bot: '#8fc7e8', ground: '#3f6b45', sun: '#fff3c4' },
    { name: 'Abend', top: '#3a2a5c', bot: '#d97a4e', ground: '#3a4a3a', sun: '#ff9c3f' },
    { name: 'Nacht', top: '#0d1330', bot: '#26325e', ground: '#22302c', sun: '#cfd6e8' },
  ];

  function mount(host) {
    var st = {
      bird: { y: H / 2, v: 0, rot: 0 },
      pipes: [],
      score: 0, best: 0,
      dist: 0,
      over: false, started: false, dead: 0,
      t: 0, sky: 0,
      nearMiss: 0,
      gapMin: 0,
    };

    var stage = host.canvas({ alpha: false });
    var ctx = stage.ctx;
    var parts = G.particles(160);
    var shake = G.shake();

    var sScore = host.stat('Punkte', '0', 'gold');
    var sBest = host.stat('Bestwert', '—');
    var sSky = host.stat('Himmel', 'Morgen');

    var loop;
    host.menuTool([
      { icon: '↻', label: 'Neues Spiel', onClick: reset },
      { icon: '?', label: 'Anleitung', onClick: function () { help(true); } },
    ]);

    var GAP = 150, PIPE_W = 62, SPEED = 128;

    function reset() {
      st.bird.y = H / 2; st.bird.v = 0; st.bird.rot = 0;
      st.pipes = [];
      st.score = 0; st.dist = 0;
      st.over = false; st.started = false; st.dead = 0;
      st.sky = 0; st.nearMiss = 0;
      for (var i = 0; i < 4; i++) addPipe(W + 120 + i * 190);
      parts.clear();
      host.closeOverlay();
      syncBar();
      loop.resume(true);
    }

    function addPipe(x) {
      var gap = Math.max(112, GAP - st.score * 1.1);
      var margin = 70;
      var cy = margin + gap / 2 + Math.random() * (H - 120 - margin * 2 - gap);
      st.pipes.push({ x: x, cy: cy, gap: gap, passed: false, wob: Math.random() * 6.28 });
    }

    function syncBar() {
      sScore.set(U.num(st.score));
      var b = host.best();
      sBest.set(b === null ? '—' : U.num(b));
      sSky.set(SKIES[st.sky].name);
    }

    function flap() {
      if (st.over) return;
      st.started = true;
      st.bird.v = -290;
      host.sfx('jump');
      parts.spawn({
        x: 90, y: st.bird.y + 12, vx: -60 - Math.random() * 40, vy: 30,
        life: 0.35, size: 3, color: 'rgba(255,255,255,.7)', g: 0, drag: 2,
      });
    }

    function die() {
      if (st.over) return;
      st.over = true;
      st.dead = 0;
      shake.hit(12, 0.35);
      host.sfx('explode');
      host.buzz(60);
      parts.burst(90, st.bird.y, 20, {
        color: ['#f0b429', '#ffd166', '#ffffff'], speed: 170, life: 0.7, size: 3.4, g: 500,
      });
      host.after(function () {
        if (!st.over) return;
        var medal = st.score >= 40 ? 'Platin' : st.score >= 25 ? 'Gold'
          : st.score >= 12 ? 'Silber' : st.score >= 5 ? 'Bronze' : null;
        host.gameOver({
          title: 'Abgestürzt',
          sub: medal ? 'Medaille: ' + medal : 'Noch keine Medaille — ab 5 Punkten gibt es Bronze.',
          score: st.score,
          onAgain: reset,
        });
      }, 800);
    }

    function step(dt) {
      st.t += dt;
      shake.update(dt);
      parts.update(dt);
      if (st.nearMiss > 0) st.nearMiss -= dt;

      if (st.over) { st.dead += dt; st.bird.v += 1400 * dt; st.bird.y += st.bird.v * dt; return; }
      if (!st.started) {
        st.bird.y = H / 2 + Math.sin(st.t * 3) * 12;
        return;
      }

      st.bird.v += 1250 * dt;
      st.bird.y += st.bird.v * dt;
      st.bird.rot = U.clamp(st.bird.v / 600, -0.5, 1.3);
      st.dist += SPEED * dt;

      if (st.bird.y > H - 92) { st.bird.y = H - 92; die(); return; }
      if (st.bird.y < -20) { st.bird.y = -20; st.bird.v = 0; }

      for (var i = st.pipes.length - 1; i >= 0; i--) {
        var p = st.pipes[i];
        p.x -= SPEED * dt;
        if (p.x + PIPE_W < -20) {
          st.pipes.splice(i, 1);
          var far = W;
          for (var q = 0; q < st.pipes.length; q++) far = Math.max(far, st.pipes[q].x);
          addPipe(far + 190);
          continue;
        }
        if (!p.passed && p.x + PIPE_W < 90) {
          p.passed = true;
          st.score++;
          var newSky = Math.min(SKIES.length - 1, Math.floor(st.score / 12));
          if (newSky !== st.sky) { st.sky = newSky; host.sfx('levelup'); }
          host.sfx('coin');
          syncBar();
        }
        // Kollision
        var bx = 90, br = 15;
        if (bx + br > p.x && bx - br < p.x + PIPE_W) {
          var top = p.cy - p.gap / 2, bot = p.cy + p.gap / 2;
          if (st.bird.y - br < top || st.bird.y + br > bot) { die(); return; }
          var margin = Math.min(st.bird.y - br - top, bot - (st.bird.y + br));
          if (margin < 12 && st.nearMiss <= 0) {
            st.nearMiss = 0.9;
            host.sfx('swipe');
          }
        }
      }
    }

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
      var sky = SKIES[st.sky];
      ctx.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0);
      ctx.fillStyle = sky.top;
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      shake.apply(ctx);
      ctx.translate(VIEW.x, VIEW.y);
      ctx.scale(VIEW.s, VIEW.s);
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      ctx.clip();

      // Himmel
      ctx.fillStyle = G.linear(ctx, 0, 0, 0, H, [0, sky.top, 1, sky.bot]);
      ctx.fillRect(0, 0, W, H);

      // Sonne/Mond
      G.glow(ctx, W * 0.76, H * 0.18, 90, sky.sun, 0.28);
      G.circle(ctx, W * 0.76, H * 0.18, 30, sky.sun);

      // Sterne bei Nacht
      if (st.sky === 3) {
        var stars = G.cache('fl-stars', W, H * 0.7, function (c) {
          var r = U.rng(88);
          for (var i = 0; i < 60; i++) {
            c.fillStyle = 'rgba(255,255,255,' + (0.2 + r() * 0.6).toFixed(2) + ')';
            c.fillRect(r() * W, r() * H * 0.7, 1.6, 1.6);
          }
        });
        ctx.drawImage(stars, 0, 0);
      }

      // Wolken (Parallax)
      var cloud = G.cache('fl-cloud', 140, 60, function (c) {
        c.fillStyle = 'rgba(255,255,255,.5)';
        G.circle(c, 40, 38, 22, 'rgba(255,255,255,.5)');
        G.circle(c, 66, 30, 28, 'rgba(255,255,255,.5)');
        G.circle(c, 96, 38, 20, 'rgba(255,255,255,.5)');
        c.fillRect(40, 38, 56, 20);
      });
      for (var i = 0; i < 4; i++) {
        var cx = U.mod(-st.dist * 0.22 + i * 190, W + 200) - 100;
        ctx.globalAlpha = 0.55;
        ctx.drawImage(cloud, cx, 60 + i * 47);
        ctx.globalAlpha = 1;
      }
      // Huegel
      var hill = G.cache('fl-hill', W, 120, function (c) {
        c.fillStyle = 'rgba(0,0,0,.22)';
        c.beginPath();
        c.moveTo(0, 120);
        for (var x = 0; x <= W; x += 20) {
          c.lineTo(x, 70 + Math.sin(x * 0.03) * 22 + Math.sin(x * 0.011) * 16);
        }
        c.lineTo(W, 120);
        c.closePath();
        c.fill();
      });
      ctx.drawImage(hill, U.mod(-st.dist * 0.35, W) - W, H - 190);
      ctx.drawImage(hill, U.mod(-st.dist * 0.35, W), H - 190);

      // Roehren
      st.pipes.forEach(function (p) {
        var top = p.cy - p.gap / 2, bot = p.cy + p.gap / 2;
        drawPipe(p.x, 0, PIPE_W, top, true);
        drawPipe(p.x, bot, PIPE_W, H - 88 - bot, false);
      });

      // Boden
      ctx.fillStyle = sky.ground;
      ctx.fillRect(0, H - 88, W, 88);
      ctx.fillStyle = 'rgba(0,0,0,.2)';
      for (i = 0; i < 20; i++) {
        var gx = U.mod(-st.dist + i * 26, W + 30) - 15;
        ctx.fillRect(gx, H - 88, 13, 8);
      }
      ctx.fillStyle = 'rgba(255,255,255,.08)';
      ctx.fillRect(0, H - 88, W, 3);

      parts.draw(ctx);

      // Vogel
      ctx.save();
      ctx.translate(90, st.bird.y);
      ctx.rotate(st.bird.rot);
      var flapPhase = st.over ? 0 : Math.sin(st.t * 18);
      // Koerper
      G.circle(ctx, 0, 0, 15, '#f0b429');
      G.circle(ctx, 0, 0, 15, null);
      ctx.fillStyle = '#e0a020';
      ctx.beginPath();
      ctx.ellipse(-2, 3, 13, 10, 0, 0, 6.28);
      ctx.fill();
      G.circle(ctx, 0, -2, 14, '#ffd166');
      // Fluegel
      ctx.fillStyle = '#e0a020';
      ctx.beginPath();
      ctx.ellipse(-3, 2 + flapPhase * 4, 9, 5 - flapPhase * 1.5, -0.3 + flapPhase * 0.4, 0, 6.28);
      ctx.fill();
      // Auge und Schnabel
      G.circle(ctx, 6, -5, 4.5, '#ffffff');
      G.circle(ctx, 7.5, -5, 2.2, '#1a1c22');
      ctx.fillStyle = '#ff9c3f';
      G.poly(ctx, [12, -1, 22, 2, 12, 6], '#ff9c3f');
      ctx.restore();

      // Anzeigen
      if (!st.started && !st.over) {
        ctx.globalAlpha = 0.6 + Math.sin(st.t * 3) * 0.3;
        G.text(ctx, 'Tippen zum Fliegen', W / 2, H * 0.34, {
          size: 22, weight: 700, color: '#ffffff', align: 'center', baseline: 'middle',
          shadow: 'rgba(0,0,0,.4)', sy: 2,
        });
        ctx.globalAlpha = 1;
      }
      if (st.nearMiss > 0) {
        ctx.globalAlpha = U.clamp(st.nearMiss / 0.4, 0, 1);
        G.text(ctx, 'Knapp!', 150, st.bird.y - 34, {
          size: 20, weight: 800, color: '#ffd166', shadow: 'rgba(0,0,0,.5)', sy: 2,
        });
        ctx.globalAlpha = 1;
      }

      G.text(ctx, String(st.score), W / 2, 68, {
        size: 46, weight: 800, color: '#ffffff', align: 'center', baseline: 'middle',
        shadow: 'rgba(0,0,0,.45)', sy: 3,
      });

      ctx.restore();
    }

    function drawPipe(x, y, w, h, isTop) {
      if (h <= 0) return;
      var body = G.linear(ctx, x, 0, x + w, 0, [0, '#2f8f4f', 0.35, '#4fc271', 0.7, '#2f8f4f', 1, '#1d6a38']);
      ctx.fillStyle = body;
      ctx.fillRect(x, y, w, h);
      var lipH = 22;
      var ly = isTop ? y + h - lipH : y;
      ctx.fillStyle = body;
      ctx.fillRect(x - 5, ly, w + 10, lipH);
      ctx.strokeStyle = 'rgba(0,0,0,.25)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 5, ly, w + 10, lipH);
      ctx.strokeRect(x, y, w, h);
    }

    /* ---------------------------------------------------------- Steuerung */

    loop = host.loop({ hz: 60, update: step, render: draw });

    host.input({ onTap: function () { flap(); }, onDown: function () { flap(); } });

    var keys = host.keys({
      onDown: function (k) { if (k === 'space' || k === 'arrowup' || k === 'w') flap(); },
    });

    function help(force) {
      SG.tutorial.show({
        id: 'flappy', force: force, parent: host.root, title: 'Flatterflug',
        pages: [{
          kicker: 'Flatterflug', title: 'Tippen hält oben',
          art: SG.tutorial.art.tap,
          body: [
            { ic: '👆', text: '<b>Jeder Tipp</b> gibt einen Flügelschlag. Ohne Tipp geht es abwärts.' },
            { ic: '🟩', text: 'Durch die Lücken fliegen — die Lücke wird mit jedem Punkt ein bisschen enger.' },
            { ic: '🏅', text: 'Ab 5 Punkten gibt es Bronze, ab 12 Silber, ab 25 Gold, ab 40 Platin.' },
            { ic: '🌗', text: 'Alle 12 Punkte wechselt die Tageszeit.' },
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
        relayout(600, 800);
        var r = U.rng(66);
        for (var i = 0; i < (steps || 600); i++) {
          if (r() < 0.14) flap();
          step(1 / 60);
          if (st.over && st.dead > 1) reset();
          if (!isFinite(st.bird.y)) throw new Error('Vogelposition ungültig');
          if (st.pipes.length < 1) throw new Error('Keine Röhren mehr');
        }
        draw();
      },
    };
  }

  SG.register({
    id: 'flappy',
    name: 'Flatterflug',
    category: 'casual',
    desc: 'Ein Tipp, ein Flügelschlag',
    tags: ['flappy', 'tippen', 'reflex', 'vogel'],
    preview: function (c, w, h) {
      c.fillStyle = G.linear(c, 0, 0, 0, h, [0, '#2b6db5', 1, '#8fc7e8']);
      c.fillRect(0, 0, w, h);
      G.glow(c, w * 0.8, h * 0.2, 40, '#fff3c4', .3);
      G.circle(c, w * 0.8, h * 0.2, 14, '#fff3c4');
      c.fillStyle = 'rgba(255,255,255,.5)';
      G.circle(c, w * 0.22, h * 0.24, 11, 'rgba(255,255,255,.5)');
      G.circle(c, w * 0.3, h * 0.2, 14, 'rgba(255,255,255,.5)');
      G.circle(c, w * 0.38, h * 0.25, 10, 'rgba(255,255,255,.5)');
      function pipe(x, gapY, gap) {
        var pw = w * 0.11;
        var body = G.linear(c, x, 0, x + pw, 0, [0, '#2f8f4f', 0.35, '#4fc271', 0.7, '#2f8f4f', 1, '#1d6a38']);
        c.fillStyle = body;
        c.fillRect(x, 0, pw, gapY - gap / 2);
        c.fillRect(x - 3, gapY - gap / 2 - 10, pw + 6, 10);
        c.fillRect(x, gapY + gap / 2, pw, h * 0.86 - (gapY + gap / 2));
        c.fillRect(x - 3, gapY + gap / 2, pw + 6, 10);
      }
      pipe(w * 0.5, h * 0.4, h * 0.34);
      pipe(w * 0.82, h * 0.58, h * 0.34);
      c.fillStyle = '#3f6b45';
      c.fillRect(0, h * 0.86, w, h * 0.14);
      var bx = w * 0.24, by = h * 0.5;
      G.circle(c, bx, by, h * 0.075, '#ffd166');
      c.fillStyle = '#e0a020';
      c.beginPath();
      c.ellipse(bx - 2, by + 3, h * 0.045, h * 0.026, -0.3, 0, 6.28);
      c.fill();
      G.circle(c, bx + h * 0.03, by - h * 0.025, h * 0.022, '#fff');
      G.circle(c, bx + h * 0.037, by - h * 0.025, h * 0.011, '#1a1c22');
      G.poly(c, [bx + h * 0.06, by - h * 0.005, bx + h * 0.11, by + h * 0.01, bx + h * 0.06, by + h * 0.03], '#ff9c3f');
    },
    mount: mount,
  });
})(SG);
