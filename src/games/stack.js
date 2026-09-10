/* ------------------------------------------------------------------
   Turmstapler

   Ein Block schwingt am Kran hin und her, ein Tipp laesst ihn fallen.
   Was uebersteht, bricht ab - der Turm wird schmaler. Perfekte Treffer
   geben Breite zurueck. Ab Hoehe 20 kommt Wind dazu.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var G = SG.gfx;

  var W = 420, H = 700;          // Weltmass
  var BH = 26;                   // Blockhoehe
  var START_W = 190;

  function mount(host) {
    var st = {
      tower: [],            // [{x,w,hue}] von unten nach oben
      cur: null,            // aktueller Block
      falling: [],          // abgebrochene Stuecke
      height: 0, score: 0,
      combo: 0, best: 0,
      cam: 0, camTarget: 0,
      over: false, dead: 0,
      wind: 0, windT: 0,
      t: 0, flashT: 0, flashText: '',
      shakeAmt: 0,
    };

    var stage = host.canvas({ alpha: false });
    var ctx = stage.ctx;
    var parts = G.particles(200);
    var shake = G.shake();

    var sScore = host.stat('Höhe', '0', 'gold');
    var sCombo = host.stat('Serie', '0');
    var sBest = host.stat('Bestwert', '—');

    var loop;
    host.menuTool([
      { icon: '↻', label: 'Neues Spiel', onClick: reset },
      { icon: '?', label: 'Anleitung', onClick: function () { help(true); } },
    ]);

    function hueOf(n) { return (200 + n * 9) % 360; }

    function reset() {
      st.tower = [];
      st.tower.push({ x: (W - START_W) / 2, w: START_W, hue: hueOf(0) });
      st.falling = [];
      st.height = 0; st.score = 0; st.combo = 0;
      st.cam = 0; st.camTarget = 0;
      st.over = false; st.dead = 0;
      st.wind = 0; st.windT = 0;
      st.flashT = 0;
      spawn();
      parts.clear();
      host.closeOverlay();
      syncBar();
      loop.resume(true);
    }

    function spawn() {
      var top = st.tower[st.tower.length - 1];
      var speed = 105 + Math.min(210, st.height * 6.5);
      var fromLeft = st.tower.length % 2 === 0;
      st.cur = {
        x: fromLeft ? -top.w : W,
        w: top.w,
        dir: fromLeft ? 1 : -1,
        speed: speed,
        hue: hueOf(st.tower.length),
        y: topY() - BH,
      };
    }

    function topY() {
      return H - 60 - st.tower.length * BH;
    }

    function syncBar() {
      sScore.set(U.num(st.height));
      sCombo.set(U.num(st.combo));
      var b = host.best();
      sBest.set(b === null ? '—' : U.num(b));
    }

    function drop() {
      if (st.over || !st.cur) return;
      var top = st.tower[st.tower.length - 1];
      var c = st.cur;

      var left = Math.max(c.x, top.x);
      var right = Math.min(c.x + c.w, top.x + top.w);
      var overlap = right - left;

      if (overlap <= 0) {
        // Kompletter Fehlwurf
        st.falling.push({ x: c.x, y: c.y, w: c.w, hue: c.hue, vy: 0, vx: c.dir * 40, rot: 0, vr: c.dir * 3 });
        st.cur = null;
        gameOver();
        return;
      }

      var perfect = Math.abs(c.x - top.x) < 3.2;
      if (perfect) {
        st.combo++;
        // Ab drei perfekten Treffern waechst der Turm wieder
        var bonus = st.combo >= 3 ? Math.min(16, 3 + st.combo) : 0;
        var nw = Math.min(START_W, overlap + bonus);
        left = U.clamp(top.x - (nw - overlap) / 2, 0, W - nw);
        overlap = nw;
        st.score += 10 + st.combo * 5;
        host.sfx('coin');
        host.buzz(18);
        flash(st.combo >= 3 ? 'Perfekt ×' + st.combo : 'Perfekt!');
        parts.burst(left + overlap / 2, c.y + BH / 2, 12, {
          color: ['#ffd166', '#ffffff'], speed: 130, life: 0.5, size: 3, g: 200,
        });
      } else {
        st.combo = 0;
        st.score += 5;
        host.sfx('thud');
        // Abgebrochenes Stueck faellt
        if (c.x < left) {
          st.falling.push({ x: c.x, y: c.y, w: left - c.x, hue: c.hue, vy: 0, vx: -30, rot: 0, vr: -2.6 });
        }
        if (c.x + c.w > right) {
          st.falling.push({ x: right, y: c.y, w: c.x + c.w - right, hue: c.hue, vy: 0, vx: 30, rot: 0, vr: 2.6 });
        }
        shake.hit(4, 0.14);
      }

      st.tower.push({ x: left, w: overlap, hue: c.hue });
      st.height++;
      st.camTarget = Math.max(0, (st.tower.length - 9) * BH);
      syncBar();

      if (overlap < 8) {
        st.cur = null;
        gameOver();
        return;
      }
      spawn();
    }

    function flash(t) { st.flashText = t; st.flashT = 1.1; }

    function gameOver() {
      st.over = true;
      st.dead = 0;
      shake.hit(12, 0.35);
      host.sfx('lose');
      host.buzz(60);
      host.after(function () {
        if (!st.over) return;
        host.gameOver({
          title: 'Turm zu Ende',
          sub: st.height + ' Etagen gestapelt',
          score: st.score,
          onAgain: reset,
        });
      }, 900);
    }

    function step(dt) {
      st.t += dt;
      shake.update(dt);
      parts.update(dt);
      if (st.flashT > 0) st.flashT -= dt;

      // Wind ab Hoehe 20
      if (st.height >= 20) {
        st.windT += dt;
        st.wind = Math.sin(st.windT * 0.7) * Math.min(34, (st.height - 18) * 1.6);
      } else st.wind = 0;

      if (st.cur) {
        st.cur.x += st.cur.dir * (st.cur.speed + Math.abs(st.wind) * 0.4) * dt;
        st.cur.y = topY() - BH;
        var minX = -st.cur.w * 0.55, maxX = W - st.cur.w * 0.45;
        if (st.cur.x < minX) { st.cur.x = minX; st.cur.dir = 1; }
        if (st.cur.x > maxX) { st.cur.x = maxX; st.cur.dir = -1; }
      }

      for (var i = st.falling.length - 1; i >= 0; i--) {
        var f = st.falling[i];
        f.vy += 1500 * dt;
        f.y += f.vy * dt;
        f.x += f.vx * dt;
        f.rot += f.vr * dt;
        if (f.y > st.cam + H + 120) st.falling.splice(i, 1);
      }

      st.cam = U.damp(st.cam, st.camTarget, 6, dt);
      if (st.over) st.dead += dt;
    }

    /* ---------------------------------------------------------- Zeichnen */

    var VIEW = { x: 0, y: 0, s: 1 };

    function relayout(w, h) {
      VIEW.s = Math.min(w / W, h / H);
      VIEW.x = (w - W * VIEW.s) / 2;
      VIEW.y = (h - H * VIEW.s) / 2;
    }
    stage.onResize = relayout;

    function blockFill(hue, dark) {
      return U.hsl(hue, 58, dark ? 34 : 52);
    }

    function drawBlock(x, y, w, hue) {
      G.fillRound(ctx, x, y, w, BH - 2, 4, blockFill(hue));
      ctx.fillStyle = 'rgba(255,255,255,.22)';
      ctx.fillRect(x + 3, y + 3, Math.max(0, w - 6), 4);
      ctx.fillStyle = 'rgba(0,0,0,.2)';
      ctx.fillRect(x, y + BH - 6, w, 4);
    }

    function draw() {
      var w = stage.w, h = stage.h;
      if (VIEW.s === 1) relayout(w, h);
      ctx.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0);
      ctx.fillStyle = '#0b0e15';
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      shake.apply(ctx);
      ctx.translate(VIEW.x, VIEW.y);
      ctx.scale(VIEW.s, VIEW.s);
      ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();

      // Himmel wird mit der Hoehe dunkler
      var t = U.clamp(st.height / 60, 0, 1);
      ctx.fillStyle = G.linear(ctx, 0, 0, 0, H, [
        0, U.mixHex('#1b2a52', '#05070f', t),
        1, U.mixHex('#33507f', '#0d1428', t),
      ]);
      ctx.fillRect(0, 0, W, H);

      // Sterne ab mittlerer Hoehe
      if (t > 0.25) {
        var stars = G.cache('st-stars', W, H, function (c) {
          var r = U.rng(606);
          for (var i = 0; i < 70; i++) {
            c.fillStyle = 'rgba(255,255,255,' + (0.2 + r() * 0.6).toFixed(2) + ')';
            c.fillRect(r() * W, r() * H, r() < .15 ? 2 : 1, r() < .15 ? 2 : 1);
          }
        });
        ctx.globalAlpha = U.clamp((t - 0.25) * 2, 0, 1);
        ctx.drawImage(stars, 0, U.mod(st.cam * 0.1, H) - H);
        ctx.drawImage(stars, 0, U.mod(st.cam * 0.1, H));
        ctx.globalAlpha = 1;
      }

      ctx.translate(0, st.cam);

      // Boden
      ctx.fillStyle = '#1a2233';
      ctx.fillRect(0, H - 60, W, 200);
      ctx.fillStyle = '#243049';
      ctx.fillRect(0, H - 60, W, 5);

      // Turm
      for (var i = 0; i < st.tower.length; i++) {
        var b = st.tower[i];
        var y = H - 60 - (i + 1) * BH;
        if (y + BH < -st.cam - 40 || y > -st.cam + H + 40) continue;
        drawBlock(b.x, y, b.w, b.hue);
      }

      // Fallende Stuecke
      st.falling.forEach(function (f) {
        ctx.save();
        ctx.translate(f.x + f.w / 2, f.y + BH / 2);
        ctx.rotate(f.rot);
        drawBlock(-f.w / 2, -BH / 2, f.w, f.hue);
        ctx.restore();
      });

      // Aktueller Block am Kran
      if (st.cur) {
        var cy = st.cur.y;
        // Seil
        ctx.strokeStyle = 'rgba(200,214,234,.35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(st.cur.x + st.cur.w / 2, -st.cam - 40);
        ctx.lineTo(st.cur.x + st.cur.w / 2, cy);
        ctx.stroke();
        drawBlock(st.cur.x, cy, st.cur.w, st.cur.hue);

        // Zielhilfe
        var top = st.tower[st.tower.length - 1];
        ctx.strokeStyle = 'rgba(255,255,255,.16)';
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(top.x, cy - 6);
        ctx.lineTo(top.x, H - 60);
        ctx.moveTo(top.x + top.w, cy - 6);
        ctx.lineTo(top.x + top.w, H - 60);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      parts.draw(ctx);
      ctx.restore();

      // Anzeigen
      if (st.flashT > 0) {
        ctx.globalAlpha = U.clamp(st.flashT / 0.4, 0, 1);
        G.text(ctx, st.flashText, w / 2, h * 0.22, {
          size: 26, weight: 800, color: '#ffd166', align: 'center', baseline: 'middle',
          shadow: 'rgba(0,0,0,.5)', sy: 2,
        });
        ctx.globalAlpha = 1;
      }
      if (st.height >= 20) {
        var wx = w / 2 + st.wind * 1.6;
        ctx.globalAlpha = 0.5;
        G.text(ctx, st.wind > 0 ? '💨 →' : '← 💨', wx, 26, {
          size: 15, color: '#8794b1', align: 'center', baseline: 'middle',
        });
        ctx.globalAlpha = 1;
      }
      if (st.tower.length <= 2 && !st.over) {
        ctx.globalAlpha = 0.6 + Math.sin(st.t * 3) * 0.3;
        G.text(ctx, 'Tippen zum Fallenlassen', w / 2, h * 0.72, {
          size: 17, weight: 650, color: '#c8d4ea', align: 'center', baseline: 'middle',
        });
        ctx.globalAlpha = 1;
      }
    }

    /* ---------------------------------------------------------- Steuerung */

    loop = host.loop({ hz: 60, update: step, render: draw });

    host.input({ onTap: function () { drop(); } });

    var keys = host.keys({
      onDown: function (k) { if (k === 'space' || k === 'arrowdown') drop(); },
    });

    function help(force) {
      SG.tutorial.show({
        id: 'stack', force: force, parent: host.root, title: 'Turmstapler',
        pages: [{
          kicker: 'Turmstapler', title: 'Genau treffen',
          art: SG.tutorial.art.tap,
          body: [
            { ic: '👆', text: '<b>Tippen</b> lässt den schwebenden Block fallen.' },
            { ic: '✂', text: 'Was über den Block darunter hinausragt, <b>bricht ab</b>. Der Turm wird schmaler.' },
            { ic: '🎯', text: 'Drei <b>perfekte</b> Treffer in Folge geben wieder Breite zurück.' },
            { ic: '💨', text: 'Ab Etage 20 weht Wind und schiebt den Block.' },
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
        var r = U.rng(909);
        for (var i = 0; i < (steps || 600); i++) {
          if (!st.over && r() < 0.08) drop();
          step(1 / 60);
          if (st.over && st.dead > 1) reset();
          if (!st.tower.length) throw new Error('Turm verschwunden');
          for (var q = 0; q < st.tower.length; q++) {
            if (!isFinite(st.tower[q].x) || st.tower[q].w <= 0) {
              throw new Error('Ungültiger Block im Turm');
            }
          }
        }
        // Perfekter Treffer muss die Serie hochzaehlen
        reset();
        st.cur.x = st.tower[0].x;
        drop();
        if (st.combo !== 1) throw new Error('Perfekter Treffer nicht erkannt');
        draw();
      },
    };
  }

  SG.register({
    id: 'stack',
    name: 'Turmstapler',
    category: 'casual',
    desc: 'Blöcke exakt übereinander',
    tags: ['stapeln', 'timing', 'turm', 'reflex'],
    preview: function (c, w, h) {
      c.fillStyle = G.linear(c, 0, 0, 0, h, [0, '#1b2a52', 1, '#33507f']);
      c.fillRect(0, 0, w, h);
      var bw = w * 0.42, bh = h * 0.085;
      var x = w * 0.29;
      for (var i = 0; i < 7; i++) {
        var off = [0, 6, -4, 3, -6, 2, 0][i];
        var hue = (200 + i * 9) % 360;
        var y = h - h * 0.1 - (i + 1) * bh;
        G.fillRound(c, x + off, y, bw, bh - 2, 3, U.hsl(hue, 58, 52));
        c.fillStyle = 'rgba(255,255,255,.22)';
        c.fillRect(x + off + 3, y + 3, bw - 6, 3);
      }
      // Schwebender Block
      G.fillRound(c, w * 0.1, h * 0.16, bw, bh - 2, 3, U.hsl((200 + 7 * 9) % 360, 58, 52));
      c.strokeStyle = 'rgba(200,214,234,.35)';
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(w * 0.1 + bw / 2, 0);
      c.lineTo(w * 0.1 + bw / 2, h * 0.16);
      c.stroke();
      c.fillStyle = '#1a2233';
      c.fillRect(0, h - h * 0.1, w, h * 0.1);
    },
    mount: mount,
  });
})(SG);
