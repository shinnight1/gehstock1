/* ------------------------------------------------------------------
   Schiebepuzzle

   3x3 bis 5x5. Gemischt wird durch zufaellige gueltige Zuege, damit
   jedes Raetsel garantiert loesbar ist. Man kann eine ganze Reihe
   auf einmal schieben, und es gibt zwei Ansichten: Zahlen oder ein
   prozedural gezeichnetes Muster.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var G = SG.gfx;
  var UI = SG.ui;

  var SIZES = [3, 4, 5];

  /* Prozedurales "Bild" - jedes Puzzle sieht anders aus, ohne Bilddatei */
  function pattern(size, seed) {
    return G.cache('slidepat:' + size + ':' + seed, size, size, function (c, w, h) {
      var r = U.rng(seed);
      var hue = r.int(360);
      c.fillStyle = U.hsl(hue, 42, 16);
      c.fillRect(0, 0, w, h);
      for (var i = 0; i < 34; i++) {
        var x = r() * w, y = r() * h, rad = (0.06 + r() * 0.26) * w;
        c.globalAlpha = 0.22 + r() * 0.4;
        var hh = (hue + r.int(120) - 60 + 360) % 360;
        G.circle(c, x, y, rad, U.hsl(hh, 60, 30 + r() * 40));
      }
      c.globalAlpha = 1;
      for (i = 0; i < 8; i++) {
        c.strokeStyle = U.hsl((hue + 180) % 360, 70, 60, 0.24);
        c.lineWidth = 1 + r() * 5;
        c.beginPath();
        c.moveTo(r() * w, r() * h);
        c.quadraticCurveTo(r() * w, r() * h, r() * w, r() * h);
        c.stroke();
      }
      G.grain(c, w, h, 0.05);
    });
  }

  function mount(host) {
    var store = host.store;
    var n = store.get('size', 4);
    var mode = store.get('mode', 'zahlen');

    var st = {
      n: n,
      tiles: null,       // Index -> Kachelnummer (0 = Luecke)
      gap: 0,
      moves: 0,
      time: 0,
      running: false,
      done: false,
      anim: [],          // laufende Bewegungen
      seed: 1,
      solvedFlash: 0,
    };

    var stage = host.canvas({ alpha: false });
    var ctx = stage.ctx;

    var sMoves = host.stat('Züge', '0');
    var sTime = host.stat('Zeit', '0:00');
    var sBest = host.stat('Rekord', '—');

    host.tool('Neu', function () { newGame(); });
    host.menuTool([
      { icon: '▦', label: 'Größe wählen', onClick: chooseSize },
      {
        icon: '🎨', label: 'Ansicht wechseln',
        desc: mode === 'zahlen' ? 'Aktuell: Zahlen' : 'Aktuell: Muster',
        onClick: function () {
          mode = mode === 'zahlen' ? 'muster' : 'zahlen';
          store.set('mode', mode);
          host.toast(mode === 'zahlen' ? 'Zahlen' : 'Muster');
        },
      },
      { icon: '👁', label: 'Lösung zeigen', desc: 'Kurz einblenden', onClick: peek },
      { icon: '?', label: 'Anleitung', onClick: function () { help(true); } },
    ]);

    function syncBar() {
      sMoves.set(U.num(st.moves));
      sTime.set(U.time(st.time));
      var b = host.best(String(st.n));
      sBest.set(b === null ? '—' : U.num(b) + ' Züge');
    }

    /* ---------------------------------------------------------- Aufbau */

    function newGame(size) {
      st.n = size || st.n;
      store.set('size', st.n);
      var count = st.n * st.n;
      st.tiles = new Array(count);
      for (var i = 0; i < count - 1; i++) st.tiles[i] = i + 1;
      st.tiles[count - 1] = 0;
      st.gap = count - 1;
      st.seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;

      // Mischen durch zufaellige gueltige Zuege -> immer loesbar
      var rng = U.rng(st.seed);
      var last = -1;
      var shuffles = st.n * st.n * 22;
      for (i = 0; i < shuffles; i++) {
        var opts = neighbors(st.gap).filter(function (k) { return k !== last; });
        var pick = opts[rng.int(opts.length)];
        last = st.gap;
        st.tiles[st.gap] = st.tiles[pick];
        st.tiles[pick] = 0;
        st.gap = pick;
      }
      if (isSolved()) newGame(st.n);   // extrem unwahrscheinlich, aber sicher ist sicher

      st.moves = 0; st.time = 0; st.done = false; st.running = true;
      st.anim = [];
      st.solvedFlash = 0;
      host.closeOverlay();
      relayout(stage.w, stage.h);
      syncBar();
    }

    function neighbors(k) {
      var x = k % st.n, y = Math.floor(k / st.n), out = [];
      if (x > 0) out.push(k - 1);
      if (x < st.n - 1) out.push(k + 1);
      if (y > 0) out.push(k - st.n);
      if (y < st.n - 1) out.push(k + st.n);
      return out;
    }

    function isSolved() {
      for (var i = 0; i < st.tiles.length - 1; i++) if (st.tiles[i] !== i + 1) return false;
      return st.tiles[st.tiles.length - 1] === 0;
    }

    /* Schiebt eine ganze Reihe/Spalte bis zur Luecke */
    function push(k) {
      if (st.done || st.anim.length) return false;
      var gx = st.gap % st.n, gy = Math.floor(st.gap / st.n);
      var x = k % st.n, y = Math.floor(k / st.n);
      if (x !== gx && y !== gy) return false;
      if (k === st.gap) return false;

      var path = [];
      if (y === gy) {
        var dir = x < gx ? 1 : -1;
        for (var cx = gx - dir; dir > 0 ? cx >= x : cx <= x; cx -= dir) path.push(y * st.n + cx);
      } else {
        var dy = y < gy ? 1 : -1;
        for (var cy = gy - dy; dy > 0 ? cy >= y : cy <= y; cy -= dy) path.push(cy * st.n + x);
      }

      // Von der Luecke weg aufloesen
      var from = st.gap;
      path.forEach(function (src) {
        var val = st.tiles[src];
        st.tiles[from] = val;
        st.tiles[src] = 0;
        st.anim.push({ v: val, from: src, to: from, t: 0 });
        from = src;
      });
      st.gap = from;
      st.moves += path.length;
      host.sfx('move');
      syncBar();
      return true;
    }

    function finishAnim() {
      st.anim.length = 0;
      if (isSolved() && !st.done) {
        st.done = true;
        st.running = false;
        st.solvedFlash = 1;
        host.stats('geloest', 1);
        host.gameOver({
          won: true,
          title: 'Sortiert!',
          sub: st.n + '×' + st.n + ' · ' + U.time(st.time),
          score: st.moves,
          mode: String(st.n),
          higher: false,
          scoreLabel: 'Züge',
          onAgain: function () { newGame(); },
        });
      }
    }

    function peek() {
      st.peek = 1.6;
      host.sfx('blip');
    }

    /* ---------------------------------------------------------- Zeichnen */

    var L = { x: 0, y: 0, size: 0, cell: 0 };

    function relayout(w, h) {
      var padPx = 16;
      var avail = Math.max(140, Math.min(w - padPx * 2, h - padPx * 2));
      L.size = avail;
      L.cell = avail / st.n;
      L.x = (w - avail) / 2;
      L.y = (h - avail) / 2;
    }
    stage.onResize = relayout;

    function tileColor(v) {
      var t = (v - 1) / Math.max(1, st.n * st.n - 2);
      return U.hsl(212 - t * 34, 30 + t * 22, 26 + t * 16);
    }

    function drawTile(v, x, y, size, gapPx) {
      if (!v) return;
      var r = size * 0.11;
      if (mode === 'muster') {
        var img = pattern(512, st.seed);
        var cellSrc = 512 / st.n;
        var sx = ((v - 1) % st.n) * cellSrc, sy = Math.floor((v - 1) / st.n) * cellSrc;
        ctx.save();
        G.roundRect(ctx, x, y, size - gapPx, size - gapPx, r);
        ctx.clip();
        ctx.drawImage(img, sx, sy, cellSrc, cellSrc, x, y, size - gapPx, size - gapPx);
        ctx.restore();
        G.strokeRound(ctx, x + .5, y + .5, size - gapPx - 1, size - gapPx - 1, r, 'rgba(255,255,255,.16)', 1);
        // kleine Nummer in der Ecke als Hilfe
        G.text(ctx, String(v), x + 6, y + size * 0.22, {
          size: size * 0.17, weight: 800, color: 'rgba(255,255,255,.85)',
          shadow: 'rgba(0,0,0,.7)', sy: 1,
        });
      } else {
        G.fillRound(ctx, x, y, size - gapPx, size - gapPx, r, tileColor(v));
        ctx.save();
        ctx.globalAlpha = .16;
        G.fillRound(ctx, x + 2, y + 2, size - gapPx - 4, (size - gapPx) * 0.4, r * 0.7, '#ffffff');
        ctx.restore();
        G.text(ctx, String(v), x + (size - gapPx) / 2, y + (size - gapPx) / 2 + 1, {
          size: size * (st.n >= 5 ? 0.33 : 0.38), weight: 800, color: '#e9edf6',
          align: 'center', baseline: 'middle',
        });
      }
    }

    function draw() {
      var w = stage.w, h = stage.h;
      if (!L.size) relayout(w, h);
      ctx.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0);
      ctx.fillStyle = '#0b0e15';
      ctx.fillRect(0, 0, w, h);

      var c = L.cell, gapPx = Math.max(3, c * 0.045);
      G.fillRound(ctx, L.x - 6, L.y - 6, L.size + 12, L.size + 12, 12, '#161c2a');

      // Zielmuster einblenden
      if (st.peek > 0 && mode === 'muster') {
        ctx.save();
        ctx.globalAlpha = Math.min(1, st.peek) * 0.85;
        G.roundRect(ctx, L.x, L.y, L.size, L.size, 10);
        ctx.clip();
        ctx.drawImage(pattern(512, st.seed), L.x, L.y, L.size, L.size);
        ctx.restore();
        return;
      }

      var moving = {};
      st.anim.forEach(function (a) { moving[a.v] = a; });

      for (var i = 0; i < st.tiles.length; i++) {
        var v = st.tiles[i];
        if (!v || moving[v]) continue;
        var x = L.x + (i % st.n) * c, y = L.y + Math.floor(i / st.n) * c;
        drawTile(v, x, y, c, gapPx);
      }

      st.anim.forEach(function (a) {
        var t = U.easeOut(U.clamp(a.t / 0.13, 0, 1));
        var fx = L.x + (a.from % st.n) * c, fy = L.y + Math.floor(a.from / st.n) * c;
        var tx = L.x + (a.to % st.n) * c, ty = L.y + Math.floor(a.to / st.n) * c;
        drawTile(a.v, U.lerp(fx, tx, t), U.lerp(fy, ty, t), c, gapPx);
      });

      if (st.peek > 0 && mode === 'zahlen') {
        ctx.save();
        ctx.globalAlpha = Math.min(1, st.peek) * 0.9;
        G.fillRound(ctx, L.x, L.y, L.size, L.size, 10, 'rgba(11,14,21,.92)');
        for (i = 0; i < st.n * st.n - 1; i++) {
          var px = L.x + (i % st.n) * c, py = L.y + Math.floor(i / st.n) * c;
          drawTile(i + 1, px, py, c, gapPx);
        }
        ctx.restore();
      }

      if (st.solvedFlash > 0) {
        ctx.save();
        ctx.globalAlpha = st.solvedFlash * 0.5;
        G.strokeRound(ctx, L.x - 4, L.y - 4, L.size + 8, L.size + 8, 12, '#3ddc84', 4);
        ctx.restore();
      }
    }

    /* ---------------------------------------------------------- Schleife */

    var loop = host.loop({
      hz: 60,
      update: function (dt) {
        if (st.running && !st.done) { st.time += dt; sTime.set(U.time(st.time)); }
        if (st.peek > 0) st.peek = Math.max(0, st.peek - dt);
        if (st.solvedFlash > 0) st.solvedFlash = Math.max(0, st.solvedFlash - dt * 0.7);
        if (st.anim.length) {
          var done = true;
          for (var i = 0; i < st.anim.length; i++) {
            st.anim[i].t += dt;
            if (st.anim[i].t < 0.13) done = false;
          }
          if (done) finishAnim();
        }
      },
      render: draw,
    });

    host.input({
      onTap: function (x, y) {
        var cx = Math.floor((x - L.x) / L.cell);
        var cy = Math.floor((y - L.y) / L.cell);
        if (cx < 0 || cy < 0 || cx >= st.n || cy >= st.n) return;
        push(cy * st.n + cx);
      },
      onSwipe: function (dir) {
        // Wischen bewegt die Kachel neben der Luecke in Gegenrichtung
        var gx = st.gap % st.n, gy = Math.floor(st.gap / st.n);
        var k = -1;
        if (dir === 'left' && gx < st.n - 1) k = st.gap + 1;
        else if (dir === 'right' && gx > 0) k = st.gap - 1;
        else if (dir === 'up' && gy < st.n - 1) k = st.gap + st.n;
        else if (dir === 'down' && gy > 0) k = st.gap - st.n;
        if (k >= 0) push(k);
      },
    });

    var keys = host.keys({
      onDown: function (k) {
        var gx = st.gap % st.n, gy = Math.floor(st.gap / st.n);
        if (k === 'arrowleft' && gx < st.n - 1) push(st.gap + 1);
        else if (k === 'arrowright' && gx > 0) push(st.gap - 1);
        else if (k === 'arrowup' && gy < st.n - 1) push(st.gap + st.n);
        else if (k === 'arrowdown' && gy > 0) push(st.gap - st.n);
      },
    });

    function chooseSize() {
      var body = UI.el('div');
      SIZES.forEach(function (s) {
        var b = host.best(String(s));
        body.appendChild(UI.el('div.item.tap' + (s === st.n ? '.sel' : ''), {
          on: { click: function () { m.close(); newGame(s); } },
        }, [
          UI.el('div.thumb', { text: s + '×' + s }),
          UI.el('div.main', null, [
            UI.el('div.t', { text: (s * s - 1) + 'er-Puzzle' }),
            UI.el('div.d', { text: s === 3 ? 'Schnell gelöst.' : s === 4 ? 'Der Klassiker.' : 'Für Geduldige.' }),
          ]),
          UI.el('div.side', null, [
            UI.el('div.p', { text: b === null ? '—' : U.num(b) }),
            UI.el('div.s', { text: 'beste Züge' }),
          ]),
        ]));
      });
      var m = host.modal({ title: 'Puzzlegröße', body: body });
    }

    function help(force) {
      SG.tutorial.show({
        id: 'slide', force: force, parent: host.root, title: 'Schiebepuzzle',
        pages: [{
          kicker: 'Schiebepuzzle', title: 'Ordnung schaffen',
          art: SG.tutorial.art.tap,
          body: [
            { ic: '👆', text: 'Auf eine Kachel <b>in der Reihe oder Spalte der Lücke</b> tippen — alle dazwischen rutschen mit.' },
            { ic: '🔢', text: 'Ziel: 1 bis ' + (st.n * st.n - 1) + ' der Reihe nach, Lücke unten rechts.' },
            { ic: '🎨', text: 'Im Menü lässt sich auf ein <b>Muster</b> statt Zahlen umschalten — deutlich kniffliger.' },
            { ic: '🔀', text: 'Gemischt wird nur mit gültigen Zügen, jedes Puzzle ist also lösbar.' },
          ],
        }],
      });
    }

    newGame(n);
    loop.start();
    help(false);

    return {
      state: st,
      destroy: function () { keys.destroy(); },
      selftest: function () {
        newGame(4);
        if (isSolved()) throw new Error('Nach dem Mischen bereits gelöst');
        var r = U.rng(11);
        for (var i = 0; i < 200; i++) {
          st.anim.length = 0;
          var ns = neighbors(st.gap);
          push(ns[r.int(ns.length)]);
        }
        st.anim.length = 0;
        // Lueckenposition muss konsistent bleiben
        if (st.tiles[st.gap] !== 0) throw new Error('Lücke ist nicht leer');
        var seen = {};
        for (i = 0; i < st.tiles.length; i++) {
          if (seen[st.tiles[i]]) throw new Error('Kachel doppelt: ' + st.tiles[i]);
          seen[st.tiles[i]] = 1;
        }
        draw();
      },
    };
  }

  SG.register({
    id: 'slide',
    name: 'Schiebepuzzle',
    category: 'puzzle',
    desc: 'Zahlen oder Muster sortieren',
    tags: ['15er', 'schieben', 'ordnen', 'klassiker'],
    scoreLabel: function (bests) {
      var v = bests['4'];
      return v ? U.num(v) + ' Züge' : null;
    },
    preview: function (c, w, h) {
      var size = Math.min(w, h) * 0.84;
      var x0 = (w - size) / 2, y0 = (h - size) / 2, cell = size / 4;
      G.fillRound(c, x0 - 4, y0 - 4, size + 8, size + 8, 8, '#161c2a');
      var order = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 14, 0];
      for (var i = 0; i < 16; i++) {
        var v = order[i];
        if (!v) continue;
        var x = x0 + (i % 4) * cell, y = y0 + Math.floor(i / 4) * cell;
        var t = (v - 1) / 14;
        G.fillRound(c, x + 2, y + 2, cell - 4, cell - 4, 5, U.hsl(212 - t * 34, 30 + t * 22, 26 + t * 16));
        G.text(c, String(v), x + cell / 2, y + cell / 2, {
          size: cell * 0.4, weight: 800, color: '#e9edf6', align: 'center', baseline: 'middle',
        });
      }
    },
    mount: mount,
  });
})(SG);
