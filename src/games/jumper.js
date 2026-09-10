/* ------------------------------------------------------------------
   Springer

   Endlos nach oben. Der Kaefer springt von selbst, gesteuert wird nur
   die Seite - durch Neigen des Fingers ueber den Bildschirm. Fuenf
   Plattformarten, Raketen, Trampoline und Gegner, die einen Hut
   verlangen.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var G = SG.gfx;

  var W = 400, H = 660;

  var P_NORMAL = 0, P_MOVE = 1, P_BREAK = 2, P_SPRING = 3, P_ROCKET = 4;
  var P_COL = ['#3ddc84', '#4aa3ff', '#c08a5a', '#3ddc84', '#3ddc84'];

  function mount(host) {
    var st = {
      x: W / 2, y: H - 120, vx: 0, vy: 0,
      cam: 0, best: 0,
      plats: [], enemies: [], coins: [],
      score: 0, height: 0,
      boost: 0, rocket: 0,
      over: false, dead: 0,
      t: 0, tilt: 0,
      highest: 0,
    };

    var stage = host.canvas({ alpha: false });
    var ctx = stage.ctx;
    var parts = G.particles(200);
    var shake = G.shake();

    var sScore = host.stat('Höhe', '0', 'gold');
    var sCoins = host.stat('Münzen', '0');
    var sBest = host.stat('Bestwert', '—');

    var loop;
    host.menuTool([
      { icon: '↻', label: 'Neues Spiel', onClick: reset },
      { icon: '?', label: 'Anleitung', onClick: function () { help(true); } },
    ]);

    /* Der Absprung gibt einen Tick mehr her als frueher (-600): zwischen
       zwei Plattformen liegen hoechstens 96 Pixel, mit -640 bleibt
       darueber immer etwas Luft. */
    var GRAV = 1250, JUMP = -640, MOVE = 480;

    function reset() {
      st.x = W / 2; st.y = H - 140; st.vx = 0; st.vy = JUMP;
      st.cam = 0; st.score = 0; st.height = 0;
      st.plats = []; st.enemies = []; st.coins = [];
      st.boost = 0; st.rocket = 0;
      st.over = false; st.dead = 0; st.highest = 0;
      st.coinCount = 0;

      // Startplattform garantiert unter der Figur
      st.plats.push({ x: W / 2 - 40, y: H - 90, w: 80, type: P_NORMAL, vx: 0, used: 0 });
      var y = H - 170;
      while (y > -400) {
        addPlatform(y);
        y -= 62 + Math.random() * 34;
      }
      parts.clear();
      host.closeOverlay();
      syncBar();
      loop.resume(true);
    }

    function addPlatform(y) {
      var diff = U.clamp(st.height / 4000, 0, 1);
      var r = Math.random();
      var type = P_NORMAL;
      if (r < 0.1 + diff * 0.16) type = P_MOVE;
      else if (r < 0.18 + diff * 0.28) type = P_BREAK;
      var w = 74 - diff * 18;
      var p = {
        x: 12 + Math.random() * (W - 24 - w),
        y: y, w: w, type: type,
        vx: type === P_MOVE ? (Math.random() < 0.5 ? -1 : 1) * (50 + diff * 70) : 0,
        used: 0, broken: 0,
      };
      // Aufsaetze
      var extra = Math.random();
      if (extra < 0.07) p.top = 'spring';
      else if (extra < 0.095) p.top = 'rocket';
      st.plats.push(p);

      if (Math.random() < 0.16) {
        st.coins.push({ x: p.x + p.w / 2, y: y - 34, got: false, ph: Math.random() * 6.28 });
      }
      if (st.height > 900 && Math.random() < 0.09 + diff * 0.1) {
        st.enemies.push({
          x: 30 + Math.random() * (W - 60), y: y - 60,
          vx: (Math.random() < 0.5 ? -1 : 1) * (30 + Math.random() * 50),
          dead: false, ph: Math.random() * 6.28,
        });
      }
    }

    function syncBar() {
      sScore.set(U.num(Math.floor(st.height)));
      sCoins.set(U.num(st.coinCount || 0));
      var b = host.best();
      sBest.set(b === null ? '—' : U.num(b));
    }

    function bounce(power) {
      st.vy = power;
      host.sfx('jump');
    }

    function die() {
      if (st.over) return;
      st.over = true;
      shake.hit(10, 0.3);
      host.sfx('lose');
      host.buzz(50);
      host.after(function () {
        if (!st.over) return;
        host.gameOver({
          title: 'Abgestürzt',
          sub: U.num(st.coinCount || 0) + ' Münzen gesammelt',
          score: Math.floor(st.height) + (st.coinCount || 0) * 25,
          scoreLabel: 'Punkte',
          onAgain: reset,
        });
      }, 700);
    }

    function step(dt) {
      st.t += dt;
      shake.update(dt);
      parts.update(dt);
      if (st.over) {
        st.dead += dt;
        st.vy += GRAV * dt;
        st.y += st.vy * dt;
        return;
      }

      // Seitwaertssteuerung
      var target = st.tilt * MOVE;
      if (keys) {
        var k = keys.axis('arrowleft', 'arrowright') + keys.axis('a', 'd');
        if (k) target = k * MOVE;
      }
      st.vx = U.damp(st.vx, target, 12, dt);
      st.x += st.vx * dt;
      if (st.x < -18) st.x += W + 36;
      if (st.x > W + 18) st.x -= W + 36;

      if (st.rocket > 0) {
        st.rocket -= dt;
        st.vy = -900;
        if (Math.random() < 0.7) {
          parts.spawn({
            x: st.x, y: st.y + 18, vx: (Math.random() - .5) * 70, vy: 180,
            life: 0.35, size: 4, color: Math.random() < .5 ? '#ff9c3f' : '#ffd166', g: 0, drag: 2,
          });
        }
      } else {
        st.vy += GRAV * dt;
      }
      st.y += st.vy * dt;

      // Kamera folgt nur nach oben
      var camTarget = st.y - H * 0.42;
      if (camTarget < st.cam) {
        st.height += (st.cam - camTarget) * 0.1;
        st.cam = camTarget;
        syncBar();
      }

      // Plattformen
      for (var i = st.plats.length - 1; i >= 0; i--) {
        var p = st.plats[i];
        if (p.vx) {
          p.x += p.vx * dt;
          if (p.x < 8) { p.x = 8; p.vx = -p.vx; }
          if (p.x + p.w > W - 8) { p.x = W - 8 - p.w; p.vx = -p.vx; }
        }
        if (p.broken) {
          p.broken += dt;
          p.y += 260 * dt;
        }
        if (p.y > st.cam + H + 60) {
          st.plats.splice(i, 1);
          continue;
        }
        // Landung nur beim Fallen
        if (st.vy > 0 && !p.broken && st.rocket <= 0) {
          var feet = st.y + 16;
          if (feet > p.y - 4 && feet < p.y + 14 &&
            st.x + 12 > p.x && st.x - 12 < p.x + p.w) {
            if (p.type === P_BREAK) {
              /* Die braune Plattform bricht weg, traegt den Absprung aber
                 noch mit: einmal geht sie, ein zweites Mal nicht. */
              bounce(JUMP);
              p.broken = 0.001;
              host.sfx('thud');
              parts.burst(p.x + p.w / 2, p.y, 8, {
                color: ['#c08a5a', '#8a5f3a'], speed: 90, life: 0.5, size: 3, g: 500, kind: 1,
              });
            } else if (p.top === 'spring') {
              bounce(JUMP * 1.75);
              p.top = null;
              host.sfx('power');
            } else if (p.top === 'rocket') {
              st.rocket = 1.6;
              p.top = null;
              host.sfx('power');
              host.buzz(30);
            } else {
              bounce(JUMP);
              p.used = 0.2;
            }
          }
        }
        if (p.used > 0) p.used -= dt;
      }

      // Nachschub
      var topY = st.cam - 100;
      var highest = 1e9;
      for (i = 0; i < st.plats.length; i++) highest = Math.min(highest, st.plats[i].y);
      while (highest > topY) {
        highest -= 62 + Math.random() * 34;
        addPlatform(highest);
      }

      // Muenzen
      for (i = st.coins.length - 1; i >= 0; i--) {
        var c = st.coins[i];
        if (c.y > st.cam + H + 60) { st.coins.splice(i, 1); continue; }
        if (Math.abs(c.x - st.x) < 22 && Math.abs(c.y - st.y) < 24) {
          st.coinCount = (st.coinCount || 0) + 1;
          st.coins.splice(i, 1);
          host.sfx('coin');
          parts.burst(c.x, c.y, 8, { color: ['#f0b429', '#ffd166'], speed: 100, life: 0.4, size: 3, g: 0, drag: 3 });
          syncBar();
        }
      }

      // Gegner
      for (i = st.enemies.length - 1; i >= 0; i--) {
        var e = st.enemies[i];
        if (e.y > st.cam + H + 60) { st.enemies.splice(i, 1); continue; }
        e.x += e.vx * dt;
        if (e.x < 24 || e.x > W - 24) e.vx = -e.vx;
        if (e.dead) continue;
        if (Math.abs(e.x - st.x) < 24 && Math.abs(e.y - st.y) < 24) {
          if (st.rocket > 0 || st.vy > 120) {
            e.dead = true;
            bounce(JUMP * 0.9);
            host.sfx('hit');
            parts.burst(e.x, e.y, 12, { color: ['#a97bff', '#ffffff'], speed: 130, life: 0.5, size: 3, g: 400 });
          } else {
            die();
            return;
          }
        }
      }

      if (st.y > st.cam + H + 40) die();
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
      ctx.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0);
      ctx.fillStyle = '#0d1220';
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      shake.apply(ctx);
      ctx.translate(VIEW.x, VIEW.y);
      ctx.scale(VIEW.s, VIEW.s);
      ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();

      ctx.fillStyle = G.linear(ctx, 0, 0, 0, H, [0, '#141d38', 1, '#0c1120']);
      ctx.fillRect(0, 0, W, H);

      // Hintergrundsterne mit Parallax
      var stars = G.cache('jp-stars', W, H, function (c) {
        var r = U.rng(303);
        for (var i = 0; i < 70; i++) {
          c.fillStyle = 'rgba(160,180,220,' + (0.12 + r() * 0.35).toFixed(2) + ')';
          c.fillRect(r() * W, r() * H, r() < .2 ? 2 : 1, r() < .2 ? 2 : 1);
        }
      });
      var off = U.mod(-st.cam * 0.22, H);
      ctx.drawImage(stars, 0, off - H);
      ctx.drawImage(stars, 0, off);

      ctx.translate(0, -st.cam);

      // Plattformen
      st.plats.forEach(function (p) {
        if (p.broken && p.broken > 1.2) return;
        var col = P_COL[p.type];
        ctx.globalAlpha = p.broken ? Math.max(0, 1 - p.broken) : 1;
        var squash = p.used > 0 ? p.used * 12 : 0;
        G.fillRound(ctx, p.x, p.y + squash, p.w, 13 - squash, 6, col);
        ctx.globalAlpha *= 0.35;
        G.fillRound(ctx, p.x + 3, p.y + 2 + squash, p.w - 6, 4, 2, '#ffffff');
        ctx.globalAlpha = p.broken ? Math.max(0, 1 - p.broken) : 1;
        if (p.top === 'spring') {
          ctx.fillStyle = '#c8d4ea';
          ctx.fillRect(p.x + p.w / 2 - 9, p.y - 12, 18, 12);
          ctx.fillStyle = '#8794b1';
          for (var q = 0; q < 3; q++) ctx.fillRect(p.x + p.w / 2 - 9, p.y - 11 + q * 4, 18, 2);
        } else if (p.top === 'rocket') {
          G.poly(ctx, [p.x + p.w / 2, p.y - 22, p.x + p.w / 2 + 8, p.y - 4, p.x + p.w / 2 - 8, p.y - 4], '#ff5f6b');
          ctx.fillStyle = '#c8d4ea';
          ctx.fillRect(p.x + p.w / 2 - 3, p.y - 14, 6, 10);
        }
        ctx.globalAlpha = 1;
      });

      // Muenzen
      st.coins.forEach(function (c) {
        var s = Math.abs(Math.cos(st.t * 3 + c.ph));
        ctx.fillStyle = '#f0b429';
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, 9 * (0.25 + s * 0.75), 9, 0, 0, 6.28);
        ctx.fill();
        if (s > 0.5) {
          G.text(ctx, '★', c.x, c.y + 1, {
            size: 9, color: '#8a6510', align: 'center', baseline: 'middle',
          });
        }
      });

      // Gegner
      st.enemies.forEach(function (e) {
        if (e.dead) return;
        var wob = Math.sin(st.t * 4 + e.ph) * 3;
        G.circle(ctx, e.x, e.y + wob, 15, '#a97bff');
        G.circle(ctx, e.x - 6, e.y - 4 + wob, 4.5, '#ffffff');
        G.circle(ctx, e.x + 6, e.y - 4 + wob, 4.5, '#ffffff');
        G.circle(ctx, e.x - 5, e.y - 4 + wob, 2, '#1a1c22');
        G.circle(ctx, e.x + 7, e.y - 4 + wob, 2, '#1a1c22');
        ctx.strokeStyle = '#6a3fb5';
        ctx.lineWidth = 2;
        for (var q = -1; q <= 1; q += 2) {
          ctx.beginPath();
          ctx.moveTo(e.x + q * 9, e.y - 11 + wob);
          ctx.lineTo(e.x + q * 15, e.y - 20 + wob);
          ctx.stroke();
        }
      });

      parts.draw(ctx);

      // Figur
      var bx = st.x, by = st.y;
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(U.clamp(st.vx / 1400, -0.28, 0.28));
      if (st.rocket > 0) {
        G.poly(ctx, [0, -30, 9, -12, -9, -12], '#ff5f6b');
      }
      G.fillRound(ctx, -14, -14, 28, 28, 10, '#3ddc84');
      G.fillRound(ctx, -10, -12, 20, 10, 6, '#7dffb0');
      G.circle(ctx, -5, -3, 4.2, '#ffffff');
      G.circle(ctx, 5, -3, 4.2, '#ffffff');
      G.circle(ctx, -4 + U.clamp(st.vx / 900, -1.6, 1.6), -3, 2, '#12151d');
      G.circle(ctx, 6 + U.clamp(st.vx / 900, -1.6, 1.6), -3, 2, '#12151d');
      // Beine
      ctx.strokeStyle = '#2aa864';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      var legs = st.vy < 0 ? -4 : 4;
      ctx.beginPath();
      ctx.moveTo(-7, 13); ctx.lineTo(-10, 19 + legs);
      ctx.moveTo(7, 13); ctx.lineTo(10, 19 + legs);
      ctx.stroke();
      ctx.restore();

      ctx.restore();

      // Kopie am Bildrand fuer den Durchgang
      if (st.x < 24 || st.x > W - 24) {
        // nur Andeutung: kleiner Pfeil
        ctx.save();
        ctx.translate(VIEW.x, VIEW.y);
        ctx.scale(VIEW.s, VIEW.s);
        ctx.globalAlpha = 0.5;
        G.text(ctx, st.x < 24 ? '›' : '‹', st.x < 24 ? W - 12 : 12, st.y - st.cam, {
          size: 26, weight: 800, color: '#3ddc84', align: 'center', baseline: 'middle',
        });
        ctx.globalAlpha = 1;
        ctx.restore();
      }
    }

    /* ---------------------------------------------------------- Steuerung */

    loop = host.loop({ hz: 60, update: step, render: draw });

    host.input({
      onDown: function (p) { setTilt(p.x); },
      onMove: function (p) { setTilt(p.x); },
      onUp: function () { st.tilt = 0; },
    });

    function setTilt(sx) {
      var rel = (sx - VIEW.x) / VIEW.w0();
      st.tilt = U.clamp((rel - 0.5) * 2.6, -1, 1);
    }
    VIEW.w0 = function () { return W * VIEW.s; };

    var keys = host.keys({});

    function help(force) {
      SG.tutorial.show({
        id: 'jumper', force: force, parent: host.root, title: 'Springer',
        pages: [{
          kicker: 'Springer', title: 'Immer weiter nach oben',
          art: SG.tutorial.art.swipe,
          body: [
            { ic: '👆', text: 'Finger <b>links oder rechts</b> auf dem Bildschirm halten — je weiter außen, desto schneller.' },
            { ic: '⤒', text: 'Gesprungen wird von selbst, sobald du auf einer Plattform landest.' },
            { ic: '🟫', text: '<b>Braune</b> Plattformen tragen einen Absprung und brechen dann weg, <b>blaue</b> wandern hin und her.' },
            { ic: '🚀', text: '<b>Sprungfeder</b> und <b>Rakete</b> bringen dich richtig hoch.' },
            { ic: '👾', text: 'Lila Gegner: von oben drauf oder mit Rakete durch — sonst ist Schluss.' },
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
        var r = U.rng(1234);
        for (var i = 0; i < (steps || 600); i++) {
          st.tilt = Math.sin(i * 0.05);
          step(1 / 60);
          if (st.over && st.dead > 1) reset();
          if (!isFinite(st.y) || !isFinite(st.x)) throw new Error('Position ungültig');
          if (st.plats.length < 3) throw new Error('Zu wenige Plattformen');
        }
        draw();
      },
    };
  }

  SG.register({
    id: 'jumper',
    name: 'Springer',
    category: 'casual',
    desc: 'Endlos hoch, Federn und Raketen',
    tags: ['doodle', 'springen', 'endlos', 'hoch'],
    preview: function (c, w, h) {
      c.fillStyle = G.linear(c, 0, 0, 0, h, [0, '#141d38', 1, '#0c1120']);
      c.fillRect(0, 0, w, h);
      var r = U.rng(5);
      for (var i = 0; i < 30; i++) {
        c.fillStyle = 'rgba(160,180,220,' + (0.15 + r() * 0.35).toFixed(2) + ')';
        c.fillRect(r() * w, r() * h, 1, 1);
      }
      var plats = [[0.12, 0.82, 0], [0.55, 0.7, 1], [0.24, 0.56, 2], [0.62, 0.42, 0], [0.3, 0.26, 0]];
      plats.forEach(function (p) {
        G.fillRound(c, w * p[0], h * p[1], w * 0.2, h * 0.045, 4, P_COL[p[2]]);
        c.globalAlpha = .35;
        G.fillRound(c, w * p[0] + 2, h * p[1] + 2, w * 0.2 - 4, h * 0.015, 2, '#fff');
        c.globalAlpha = 1;
      });
      // Feder
      c.fillStyle = '#c8d4ea';
      c.fillRect(w * 0.68, h * 0.38, w * 0.05, h * 0.04);
      // Figur
      var bx = w * 0.34, by = h * 0.45;
      G.fillRound(c, bx - h * 0.055, by - h * 0.055, h * 0.11, h * 0.11, h * 0.04, '#3ddc84');
      G.circle(c, bx - h * 0.02, by - h * 0.012, h * 0.017, '#fff');
      G.circle(c, bx + h * 0.02, by - h * 0.012, h * 0.017, '#fff');
      G.circle(c, bx - h * 0.017, by - h * 0.012, h * 0.008, '#12151d');
      G.circle(c, bx + h * 0.023, by - h * 0.012, h * 0.008, '#12151d');
      // Muenze
      c.fillStyle = '#f0b429';
      c.beginPath();
      c.ellipse(w * 0.5, h * 0.33, h * 0.02, h * 0.033, 0, 0, 6.28);
      c.fill();
    },
    mount: mount,
  });
})(SG);
