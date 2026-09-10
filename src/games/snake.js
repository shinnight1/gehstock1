/* ------------------------------------------------------------------
   Snake

   Weich interpoliert zwischen den Feldern, mit Richtungspuffer (zwei
   Wischer hintereinander gehen nicht verloren), Bonusfruechten mit
   Zeitlimit und optionalem Wand-Durchgang.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var G = SG.gfx;
  var UI = SG.ui;

  var SIZES = [
    { id: 'klein', name: 'Klein', w: 12, h: 12 },
    { id: 'mittel', name: 'Mittel', w: 18, h: 14 },
    { id: 'gross', name: 'Groß', w: 26, h: 18 },
  ];

  var DIRV = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };

  function mount(host) {
    var store = host.store;
    var sizeId = store.get('size', 'mittel');
    var wrap = store.get('wrap', false);

    var st = {
      w: 0, h: 0,
      body: [],          // [{x,y}], Kopf zuerst
      dir: [1, 0], queue: [],
      food: null, bonus: null, bonusT: 0,
      grow: 0,
      step: 0.16, acc: 0,
      score: 0, eaten: 0,
      over: false, dead: 0,
      t: 0,
    };

    var stage = host.canvas({ alpha: false });
    var ctx = stage.ctx;
    var parts = G.particles(160);
    var shake = G.shake();

    var sScore = host.stat('Punkte', '0', 'gold');
    var sLen = host.stat('Länge', '3');
    var sBest = host.stat('Bestwert', '—');

    var loop;
    host.tool('❚❚', function () {
      var p = loop.toggle();
      if (p) host.showPause(function () { loop.resume(true); });
    });
    host.menuTool([
      { icon: '▦', label: 'Feldgröße', onClick: chooseSize },
      {
        icon: '⇄', label: 'Wände durchlässig',
        desc: wrap ? 'Aktuell: an' : 'Aktuell: aus',
        onClick: function () {
          wrap = !wrap;
          store.set('wrap', wrap);
          host.toast(wrap ? 'Wände sind jetzt durchlässig.' : 'Wände sind tödlich.');
          reset();
        },
      },
      { icon: '?', label: 'Anleitung', onClick: function () { help(true); } },
    ]);

    function conf() {
      for (var i = 0; i < SIZES.length; i++) if (SIZES[i].id === sizeId) return SIZES[i];
      return SIZES[1];
    }

    function mode() { return sizeId + (wrap ? '-wrap' : ''); }

    function syncBar() {
      sScore.set(U.num(st.score));
      sLen.set(U.num(st.body.length));
      var b = host.best(mode());
      sBest.set(b === null ? '—' : U.num(b));
    }

    /* ---------------------------------------------------------- Spiel */

    function reset() {
      var c = conf();
      st.w = c.w; st.h = c.h;
      st.body = [];
      var cy = Math.floor(c.h / 2);
      for (var i = 0; i < 3; i++) st.body.push({ x: Math.floor(c.w / 2) - i, y: cy });
      st.dir = [1, 0];
      st.queue = [];
      st.grow = 0;
      st.step = 0.155;
      st.acc = 0;
      st.score = 0; st.eaten = 0;
      st.over = false; st.dead = 0;
      st.bonus = null; st.bonusT = 0;
      placeFood();
      parts.clear();
      host.closeOverlay();
      relayout(stage.w, stage.h);
      syncBar();
      loop.resume(true);
    }

    function occupied(x, y) {
      for (var i = 0; i < st.body.length; i++) {
        if (st.body[i].x === x && st.body[i].y === y) return true;
      }
      return false;
    }

    function freeCell() {
      var tries = 0;
      while (tries++ < 800) {
        var x = U.irand(0, st.w - 1), y = U.irand(0, st.h - 1);
        if (!occupied(x, y) && !(st.food && st.food.x === x && st.food.y === y)) {
          return { x: x, y: y };
        }
      }
      return null;
    }

    function placeFood() { st.food = freeCell(); }

    function turn(d) {
      var v = DIRV[d];
      if (!v) return;
      var last = st.queue.length ? st.queue[st.queue.length - 1] : st.dir;
      if (v[0] === -last[0] && v[1] === -last[1]) return;   // keine 180-Grad-Wende
      if (v[0] === last[0] && v[1] === last[1]) return;
      if (st.queue.length < 2) st.queue.push(v);
    }

    function stepGame() {
      if (st.over) return;
      if (st.queue.length) st.dir = st.queue.shift();

      var head = st.body[0];
      var nx = head.x + st.dir[0], ny = head.y + st.dir[1];

      if (wrap) {
        nx = U.mod(nx, st.w);
        ny = U.mod(ny, st.h);
      } else if (nx < 0 || ny < 0 || nx >= st.w || ny >= st.h) {
        return die();
      }

      // Der Schwanz weicht, ausser die Schlange waechst
      for (var i = 0; i < st.body.length - (st.grow > 0 ? 0 : 1); i++) {
        if (st.body[i].x === nx && st.body[i].y === ny) return die();
      }

      st.body.unshift({ x: nx, y: ny });
      if (st.grow > 0) st.grow--;
      else st.body.pop();

      if (st.food && nx === st.food.x && ny === st.food.y) {
        eat(1);
        placeFood();
        // ab und zu eine Bonusfrucht
        if (st.eaten % 5 === 0 && !st.bonus) {
          st.bonus = freeCell();
          st.bonusT = 7;
        }
      } else if (st.bonus && nx === st.bonus.x && ny === st.bonus.y) {
        eat(2);
        st.bonus = null;
      }
    }

    function eat(kind) {
      var pts = kind === 2 ? Math.max(20, Math.round(60 * (st.bonusT / 7))) : 10;
      st.score += pts;
      st.eaten++;
      st.grow += kind === 2 ? 3 : 1;
      st.step = Math.max(0.055, 0.155 - st.eaten * 0.0022);
      host.sfx(kind === 2 ? 'coin' : 'pop');
      host.buzz(kind === 2 ? 22 : 10);
      var p = cellCenter(st.body[0].x, st.body[0].y);
      parts.burst(p.x, p.y, kind === 2 ? 16 : 8, {
        color: kind === 2 ? ['#f0b429', '#ffd166'] : ['#ff5f6b', '#ff9c3f'],
        speed: 120, life: 0.5, size: 3, g: 120, drag: 3,
      });
      syncBar();
    }

    function die() {
      st.over = true;
      st.dead = 0;
      shake.hit(12, 0.4);
      host.sfx('explode');
      host.buzz(70);
      var p = cellCenter(st.body[0].x, st.body[0].y);
      parts.burst(p.x, p.y, 26, {
        color: ['#3ddc84', '#ffffff'], speed: 180, life: 0.7, size: 4, g: 300,
      });
      host.after(function () {
        if (!st.over) return;
        host.gameOver({
          title: 'Gebissen',
          sub: 'Länge ' + st.body.length + ' · ' + conf().name + (wrap ? ' · durchlässig' : ''),
          score: st.score,
          mode: mode(),
          onAgain: reset,
        });
      }, 700);
    }

    /* ---------------------------------------------------------- Zeichnen */

    var L = { x: 0, y: 0, cell: 20 };

    function relayout(w, h) {
      if (!st.w) return;
      var padPx = 12, reserve = 80;
      L.cell = Math.max(8, Math.floor(Math.min(
        (w - padPx * 2) / st.w, (h - padPx * 2 - reserve) / st.h)));
      L.x = Math.round((w - L.cell * st.w) / 2);
      L.y = Math.round((h - reserve - L.cell * st.h) / 2) + 6;
    }
    stage.onResize = relayout;

    function cellCenter(x, y) {
      return { x: L.x + x * L.cell + L.cell / 2, y: L.y + y * L.cell + L.cell / 2 };
    }

    function draw(alpha) {
      var w = stage.w, h = stage.h;
      if (!L.cell) relayout(w, h);
      ctx.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0);
      ctx.fillStyle = '#0b0e15';
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      shake.apply(ctx);

      var c = L.cell;
      var bw = c * st.w, bh = c * st.h;

      G.fillRound(ctx, L.x - 5, L.y - 5, bw + 10, bh + 10, 10,
        wrap ? '#1b2a24' : '#141a27');
      ctx.fillStyle = '#0d121c';
      ctx.fillRect(L.x, L.y, bw, bh);

      // Schachbrettmuster
      ctx.fillStyle = 'rgba(255,255,255,.018)';
      for (var y = 0; y < st.h; y++) {
        for (var x = (y % 2); x < st.w; x += 2) {
          ctx.fillRect(L.x + x * c, L.y + y * c, c, c);
        }
      }

      // Futter
      if (st.food) {
        var f = cellCenter(st.food.x, st.food.y);
        var pulse = 1 + Math.sin(st.t * 5) * 0.07;
        G.circle(ctx, f.x, f.y, c * 0.32 * pulse, '#ff5f6b');
        G.circle(ctx, f.x - c * 0.09, f.y - c * 0.1, c * 0.09, 'rgba(255,255,255,.55)');
      }
      if (st.bonus) {
        var b = cellCenter(st.bonus.x, st.bonus.y);
        var t = st.bonusT / 7;
        G.star(ctx, b.x, b.y, c * 0.4 * (0.85 + Math.sin(st.t * 9) * 0.12), c * 0.17, 5,
          st.t * 1.6, '#f0b429');
        G.arcProgress(ctx, b.x, b.y, c * 0.52, 2.5, t, '#ffd166', 'rgba(255,255,255,.1)');
      }

      // Schlange
      var interp = st.over ? 1 : U.clamp(st.acc / st.step, 0, 1);
      var n = st.body.length;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (var i = n - 1; i >= 0; i--) {
        var seg = st.body[i];
        var pos = cellCenter(seg.x, seg.y);
        var px = pos.x, py = pos.y;

        // Kopf gleitet zum naechsten Feld
        if (i === 0 && !st.over) {
          var tx = seg.x + st.dir[0], ty = seg.y + st.dir[1];
          if (wrap) { tx = U.mod(tx, st.w); ty = U.mod(ty, st.h); }
          var far = Math.abs(tx - seg.x) > 1 || Math.abs(ty - seg.y) > 1;
          if (!far) {
            var tp = cellCenter(tx, ty);
            px = U.lerp(px, tp.x, interp * 0.85);
            py = U.lerp(py, tp.y, interp * 0.85);
          }
        }

        var frac = 1 - i / Math.max(1, n);
        var size = c * (0.78 + frac * 0.12);
        var col = i === 0 ? '#7dffb0' : U.mixHex('#3ddc84', '#177a45', i / Math.max(1, n));
        if (st.over) col = U.mixHex(col, '#5a2630', Math.min(1, st.dead * 1.6));

        G.fillRound(ctx, px - size / 2, py - size / 2, size, size, size * 0.32, col);

        if (i === 0) {
          // Augen in Blickrichtung
          var ex = st.dir[0], ey = st.dir[1];
          var offx = -ey * c * 0.16, offy = ex * c * 0.16;
          var fwd = c * 0.16;
          G.circle(ctx, px + ex * fwd + offx, py + ey * fwd + offy, c * 0.085, '#0d1017');
          G.circle(ctx, px + ex * fwd - offx, py + ey * fwd - offy, c * 0.085, '#0d1017');
        }
      }

      parts.draw(ctx);
      ctx.restore();

      if (SG.settings.get('showFps')) {
        G.text(ctx, loop.fps + ' fps', 8, h - 8, { size: 11, color: '#5f6a85' });
      }
    }

    /* ---------------------------------------------------------- Schleife */

    loop = host.loop({
      hz: 60,
      update: function (dt) {
        st.t += dt;
        shake.update(dt);
        parts.update(dt);
        if (st.over) { st.dead += dt; return; }
        if (st.bonus) {
          st.bonusT -= dt;
          if (st.bonusT <= 0) st.bonus = null;
        }
        st.acc += dt;
        while (st.acc >= st.step && !st.over) {
          st.acc -= st.step;
          stepGame();
        }
      },
      render: draw,
    });

    host.input({
      swipeMin: 20,
      onSwipe: function (dir) { turn(dir); },
      onTap: function () { /* Tippen macht nichts - vermeidet Fehlbedienung */ },
    });

    var dpad = host.dpad({
      pos: SG.settings.get('leftHanded') ? 'br' : 'bl',
      onPress: function (n) { turn(n); },
    });

    var keys = host.keys({
      onDown: function (k) {
        var m = {
          arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right',
          arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down',
        };
        if (m[k]) turn(m[k]);
      },
    });

    function chooseSize() {
      var body = UI.el('div');
      SIZES.forEach(function (s) {
        var b = host.best(s.id + (wrap ? '-wrap' : ''));
        body.appendChild(UI.el('div.item.tap' + (s.id === sizeId ? '.sel' : ''), {
          on: {
            click: function () {
              m.close();
              sizeId = s.id;
              store.set('size', s.id);
              reset();
            },
          },
        }, [
          UI.el('div.thumb', { text: '🐍' }),
          UI.el('div.main', null, [
            UI.el('div.t', { text: s.name }),
            UI.el('div.d', { text: s.w + '×' + s.h + ' Felder' }),
          ]),
          UI.el('div.side', null, [
            UI.el('div.p', { text: b === null ? '—' : U.num(b) }),
            UI.el('div.s', { text: 'Rekord' }),
          ]),
        ]));
      });
      var m = host.modal({ title: 'Feldgröße', body: body });
    }

    function help(force) {
      SG.tutorial.show({
        id: 'snake', force: force, parent: host.root, title: 'Snake',
        pages: [{
          kicker: 'Snake', title: 'Fressen, wachsen, ausweichen',
          art: SG.tutorial.art.swipe,
          body: [
            { ic: '👆', text: '<b>Wischen</b> oder das Steuerkreuz unten links ändert die Richtung.' },
            { ic: '🍎', text: 'Jede Frucht macht die Schlange länger und ein bisschen schneller.' },
            { ic: '⭐', text: 'Alle fünf Früchte erscheint eine <b>Bonusfrucht</b> — je schneller du sie holst, desto mehr Punkte.' },
            { ic: '💥', text: 'Wand oder eigener Körper bedeuten das Ende. Im Menü lassen sich die Wände durchlässig schalten.' },
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
        var r = U.rng(2211);
        var dirs = ['left', 'right', 'up', 'down'];
        for (var i = 0; i < (steps || 600); i++) {
          if (r() < 0.25) turn(dirs[r.int(4)]);
          stepGame();
          if (st.over) reset();
          if (st.body.length < 3) throw new Error('Schlange zu kurz');
        }
        // Kein Segment darf ausserhalb liegen
        for (i = 0; i < st.body.length; i++) {
          var s = st.body[i];
          if (s.x < 0 || s.y < 0 || s.x >= st.w || s.y >= st.h) {
            throw new Error('Segment außerhalb des Feldes');
          }
        }
        draw(0);
      },
    };
  }

  SG.register({
    id: 'snake',
    name: 'Snake',
    category: 'arcade',
    desc: 'Drei Größen, Bonusfrüchte',
    tags: ['schlange', 'klassiker', 'wischen'],
    preview: function (c, w, h) {
      var cols = 12, rows = 8;
      var cell = Math.min(w / (cols + 1), h / (rows + 1));
      var x0 = (w - cell * cols) / 2, y0 = (h - cell * rows) / 2;
      c.fillStyle = '#0d121c';
      c.fillRect(x0, y0, cell * cols, cell * rows);
      c.fillStyle = 'rgba(255,255,255,.02)';
      for (var y = 0; y < rows; y++) {
        for (var x = (y % 2); x < cols; x += 2) c.fillRect(x0 + x * cell, y0 + y * cell, cell, cell);
      }
      var body = [[7, 3], [6, 3], [5, 3], [4, 3], [4, 4], [4, 5], [5, 5], [6, 5]];
      for (var i = body.length - 1; i >= 0; i--) {
        var px = x0 + body[i][0] * cell + cell / 2, py = y0 + body[i][1] * cell + cell / 2;
        var size = cell * 0.82;
        G.fillRound(c, px - size / 2, py - size / 2, size, size, size * 0.32,
          i === 0 ? '#7dffb0' : U.mixHex('#3ddc84', '#177a45', i / body.length));
        if (i === 0) {
          G.circle(c, px + cell * 0.16, py - cell * 0.14, cell * 0.09, '#0d1017');
          G.circle(c, px + cell * 0.16, py + cell * 0.14, cell * 0.09, '#0d1017');
        }
      }
      var f = { x: x0 + 9.5 * cell, y: y0 + 2.5 * cell };
      G.circle(c, f.x, f.y, cell * 0.32, '#ff5f6b');
      G.star(c, x0 + 2.5 * cell, y0 + 6.5 * cell, cell * 0.38, cell * 0.16, 5, -1.2, '#f0b429');
    },
    mount: mount,
  });
})(SG);
