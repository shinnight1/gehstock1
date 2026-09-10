/* ------------------------------------------------------------------
   2048

   Wischen schiebt alle Steine. Gleiche Zahlen verschmelzen.
   Mit echten Bewegungs- und Verschmelz-Animationen, Undo und
   vier Feldgroessen.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var G = SG.gfx;
  var UI = SG.ui;

  var SIZES = [3, 4, 5, 6];
  var ANIM = 0.11;      // Sekunden fuer eine Bewegung
  var POP = 0.14;

  /* Farbe und Textfarbe je Wert */
  function look(v) {
    switch (v) {
      case 2: return ['#39415a', '#e9edf6'];
      case 4: return ['#46506e', '#e9edf6'];
      case 8: return ['#d98a4a', '#12151d'];
      case 16: return ['#e0793a', '#12151d'];
      case 32: return ['#e4623a', '#fff'];
      case 64: return ['#e04a35', '#fff'];
      case 128: return ['#e8c05a', '#12151d'];
      case 256: return ['#e9bb45', '#12151d'];
      case 512: return ['#eab535', '#12151d'];
      case 1024: return ['#f0b429', '#12151d'];
      case 2048: return ['#ffd166', '#12151d'];
      case 4096: return ['#3ddc84', '#0d1017'];
      case 8192: return ['#34d3d3', '#0d1017'];
      default: return ['#a97bff', '#fff'];
    }
  }

  function makeState(n) {
    return {
      n: n,
      grid: null,       // n*n Array mit Kachelobjekten oder null
      tiles: [],
      score: 0,
      moves: 0,
      won: false,
      keepGoing: false,
      over: false,
      anim: 0,          // 0..1 Fortschritt der laufenden Bewegung
      animating: false,
    };
  }

  function mount(host) {
    var store = host.store;
    var n = store.get('size', 4);
    var st = makeState(n);
    var rng = U.rng((Date.now() ^ 0x2048) >>> 0);
    var idc = 0;
    var undo = [];
    var UNDO_MAX = 5;

    var stage = host.canvas({ alpha: false });
    var ctx = stage.ctx;

    /* ---------------------------------------------------------- Leiste */

    var sScore = host.stat('Punkte', '0', 'gold');
    var sBest = host.stat('Bestwert', '0');
    var sMoves = host.stat('Züge', '0');

    var undoBtn = host.tool('↺ <span class="num">5</span>', function () { doUndo(); });
    host.tool('Neu', function () { confirmNew(); });
    host.menuTool([
      {
        icon: '▦', label: 'Feldgröße', desc: 'Aktuell ' + st.n + '×' + st.n,
        onClick: chooseSize,
      },
      { icon: '?', label: 'Anleitung', onClick: showHelp },
    ]);

    function syncBar() {
      sScore.set(U.num(st.score));
      var b = host.best(String(st.n));
      sBest.set(b === null ? '—' : U.num(b));
      sMoves.set(U.num(st.moves));
      undoBtn.setLabel('↺ <span class="num">' + undo.length + '</span>');
      undoBtn.classList.toggle('off', undo.length === 0);
    }

    /* ---------------------------------------------------------- Spielfeld */

    function idx(r, c) { return r * st.n + c; }

    function reset(size) {
      st = makeState(size || st.n);
      st.grid = new Array(st.n * st.n);
      st.tiles = [];
      undo = [];
      spawn(); spawn();
      syncBar();
    }

    function newTile(r, c, v) {
      var t = {
        id: ++idc, v: v, r: r, c: c,
        sr: r, sc: c, tr: r, tc: c,
        appear: 1, pop: 0, dead: false, ghostOf: 0,
      };
      st.tiles.push(t);
      st.grid[idx(r, c)] = t;
      return t;
    }

    function spawn() {
      var free = [];
      for (var i = 0; i < st.grid.length; i++) if (!st.grid[i]) free.push(i);
      if (!free.length) return null;
      var k = free[rng.int(free.length)];
      return newTile(Math.floor(k / st.n), k % st.n, rng() < 0.9 ? 2 : 4);
    }

    function snapshot() {
      return {
        cells: st.tiles.filter(function (t) { return !t.dead; })
          .map(function (t) { return { r: t.r, c: t.c, v: t.v }; }),
        score: st.score, moves: st.moves, won: st.won, keepGoing: st.keepGoing,
      };
    }

    function restore(s) {
      st.grid = new Array(st.n * st.n);
      st.tiles = [];
      s.cells.forEach(function (c) { newTile(c.r, c.c, c.v); });
      st.tiles.forEach(function (t) { t.appear = 0; });
      st.score = s.score; st.moves = s.moves;
      st.won = s.won; st.keepGoing = s.keepGoing;
      st.over = false;
      st.animating = false; st.anim = 0;
    }

    /* Ein Zug. dir: 0 links, 1 hoch, 2 rechts, 3 runter */
    function move(dir) {
      if (st.animating || st.over) return false;

      var prev = snapshot();
      var n = st.n;
      var moved = false;
      var gained = 0;

      // Reihenfolge so waehlen, dass zuerst die Kacheln an der Zielkante dran sind
      var order = [];
      for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) order.push([r, c]);
      if (dir === 2) order.sort(function (a, b) { return b[1] - a[1]; });
      else if (dir === 0) order.sort(function (a, b) { return a[1] - b[1]; });
      else if (dir === 3) order.sort(function (a, b) { return b[0] - a[0]; });
      else order.sort(function (a, b) { return a[0] - b[0]; });

      var dr = dir === 1 ? -1 : (dir === 3 ? 1 : 0);
      var dc = dir === 0 ? -1 : (dir === 2 ? 1 : 0);

      var next = new Array(n * n);
      var mergedInto = {};

      st.tiles.forEach(function (t) {
        t.sr = t.r; t.sc = t.c; t.dead = false; t.pop = 0;
      });

      order.forEach(function (p) {
        var t = st.grid[idx(p[0], p[1])];
        if (!t) return;
        var cr = p[0], cc = p[1];
        var nr = cr, nc = cc;
        while (true) {
          var tr = nr + dr, tc = nc + dc;
          if (tr < 0 || tr >= n || tc < 0 || tc >= n) break;
          var occ = next[idx(tr, tc)];
          if (!occ) { nr = tr; nc = tc; continue; }
          if (occ.v === t.v && !mergedInto[occ.id]) {
            // verschmelzen
            nr = tr; nc = tc;
            t.tr = nr; t.tc = nc;
            t.dead = true;
            mergedInto[occ.id] = true;
            occ.v *= 2;
            occ.pop = POP;
            gained += occ.v;
            if (occ.v === 2048 && !st.won) st.won = true;
            moved = true;
            return;
          }
          break;
        }
        t.tr = nr; t.tc = nc;
        if (nr !== cr || nc !== cc) moved = true;
        next[idx(nr, nc)] = t;
      });

      if (!moved) {
        host.sfx('error');
        return false;
      }

      undo.push(prev);
      if (undo.length > UNDO_MAX) undo.shift();

      st.score += gained;
      st.moves++;
      st.grid = next;
      st.animating = true;
      st.anim = 0;
      st.pendingSpawn = true;
      host.sfx(gained ? 'place' : 'move');
      if (gained >= 128) host.buzz(14);
      syncBar();
      return true;
    }

    function finishMove() {
      st.tiles = st.tiles.filter(function (t) { return !t.dead; });
      st.tiles.forEach(function (t) { t.r = t.tr; t.c = t.tc; t.sr = t.r; t.sc = t.c; });
      st.animating = false;
      st.anim = 0;

      if (st.pendingSpawn) {
        st.pendingSpawn = false;
        var t = spawn();
        if (t) t.appear = 1;
      }

      if (st.won && !st.keepGoing) {
        st.keepGoing = true;
        host.sfx('win');
        host.overlay(function (box) {
          UI.add(box, [
            UI.el('div.newbest', { text: '2048 erreicht' }),
            UI.el('h2', { text: 'Geschafft!' }),
            UI.el('div.sub', { text: 'Du hast die 2048 gebaut. Weiter geht trotzdem.' }),
            UI.el('div.gover-score', null, [
              UI.el('div.b.gold', null, [
                UI.el('div.k', { text: 'Punkte' }),
                UI.el('div.v', { text: U.num(st.score) }),
              ]),
            ]),
            UI.el('div.gover-actions', null, [
              UI.btn('Neues Spiel', function () { host.closeOverlay(); reset(); }, 'ghost'),
              UI.btn('Weiterspielen', function () { host.closeOverlay(); }, 'primary'),
            ]),
          ]);
        });
        host.submit(st.score, { mode: String(st.n) });
        syncBar();
        return;
      }

      if (!canMove()) gameOver();
    }

    function canMove() {
      var n = st.n;
      for (var i = 0; i < st.grid.length; i++) if (!st.grid[i]) return true;
      for (var r = 0; r < n; r++) {
        for (var c = 0; c < n; c++) {
          var v = st.grid[idx(r, c)].v;
          if (c + 1 < n && st.grid[idx(r, c + 1)].v === v) return true;
          if (r + 1 < n && st.grid[idx(r + 1, c)].v === v) return true;
        }
      }
      return false;
    }

    function best() {
      var m = 0;
      st.tiles.forEach(function (t) { if (t.v > m) m = t.v; });
      return m;
    }

    function gameOver() {
      st.over = true;
      host.gameOver({
        title: 'Kein Zug mehr möglich',
        sub: 'Größter Stein: ' + U.num(best()) + ' · ' + st.n + '×' + st.n,
        score: st.score,
        mode: String(st.n),
        onAgain: function () { reset(); },
        extra: undo.length ? UI.el('div', { style: { marginBottom: '14px' } }, [
          UI.btn('Letzten Zug zurücknehmen', function () {
            host.closeOverlay();
            doUndo();
          }, 'ghost wide'),
        ]) : null,
      });
    }

    function doUndo() {
      if (!undo.length || st.animating) return;
      restore(undo.pop());
      host.closeOverlay();
      host.sfx('click');
      syncBar();
    }

    function confirmNew() {
      if (st.moves < 3) { reset(); return; }
      host.confirm('Neues Spiel?', 'Der aktuelle Stand geht verloren.', 'Neu starten')
        .then(function (ok) { if (ok) { host.closeOverlay(); reset(); } });
    }

    function chooseSize() {
      var body = UI.el('div');
      SIZES.forEach(function (s) {
        var b = host.best(String(s));
        body.appendChild(UI.el('div.item.tap' + (s === st.n ? '.sel' : ''), {
          on: {
            click: function () {
              m.close();
              store.set('size', s);
              host.closeOverlay();
              reset(s);
            },
          },
        }, [
          UI.el('div.thumb', { text: s + '×' + s }),
          UI.el('div.main', null, [
            UI.el('div.t', { text: s + '×' + s }),
            UI.el('div.d', {
              text: s === 3 ? 'Sehr eng — schnell vorbei.'
                : s === 4 ? 'Das Original.'
                  : s === 5 ? 'Viel Platz, lange Partien.' : 'Riesig, sehr entspannt.',
            }),
          ]),
          UI.el('div.side', null, [
            UI.el('div.p', { text: b === null ? '—' : U.num(b) }),
            UI.el('div.s', { text: 'Rekord' }),
          ]),
        ]));
      });
      var m = host.modal({ title: 'Feldgröße', body: body });
    }

    function showHelp() {
      SG.tutorial.show({
        id: '2048', force: true, parent: host.root,
        title: '2048',
        pages: [{
          kicker: '2048', title: 'So wird gespielt',
          art: SG.tutorial.art.swipe,
          body: [
            { ic: '👆', text: '<b>Wische</b> in eine Richtung — alle Steine rutschen bis zum Rand.' },
            { ic: '🔗', text: 'Treffen <b>zwei gleiche Zahlen</b> aufeinander, verschmelzen sie zur doppelten.' },
            { ic: '🎯', text: 'Ziel ist der Stein <b>2048</b>. Danach darfst du weiterspielen.' },
            { ic: '↺', text: 'Der <b>Undo-Knopf</b> nimmt bis zu fünf Züge zurück.' },
            { ic: '💡', text: 'Tipp: halte den größten Stein immer in derselben Ecke.' },
          ],
        }],
      });
    }

    /* ---------------------------------------------------------- Zeichnen */

    var layout = { x: 0, y: 0, size: 0, cell: 0, gap: 0 };

    function relayout(w, h) {
      var pad = 14;
      var avail = Math.min(w - pad * 2, h - pad * 2);
      avail = Math.max(120, avail);
      layout.size = avail;
      layout.x = (w - avail) / 2;
      layout.y = (h - avail) / 2;
      layout.gap = Math.max(4, avail * 0.018);
      layout.cell = (avail - layout.gap * (st.n + 1)) / st.n;
    }

    stage.onResize = function (w, h) { relayout(w, h); };

    function cellPos(r, c) {
      return {
        x: layout.x + layout.gap + c * (layout.cell + layout.gap),
        y: layout.y + layout.gap + r * (layout.cell + layout.gap),
      };
    }

    function draw() {
      var w = stage.w, h = stage.h;
      if (!layout.size || layout.cellN !== st.n) { relayout(w, h); layout.cellN = st.n; }
      ctx.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0);

      // Hintergrund
      ctx.fillStyle = '#0b0e15';
      ctx.fillRect(0, 0, w, h);

      var r0 = layout.cell * 0.14;
      G.fillRound(ctx, layout.x, layout.y, layout.size, layout.size, r0 + 6, '#161c2a');

      // Leere Felder
      for (var r = 0; r < st.n; r++) {
        for (var c = 0; c < st.n; c++) {
          var p = cellPos(r, c);
          G.fillRound(ctx, p.x, p.y, layout.cell, layout.cell, r0, '#1e253a');
        }
      }

      var t = st.animating ? U.easeOut(U.clamp(st.anim / ANIM, 0, 1)) : 1;

      // Erst die verschwindenden, dann die bleibenden Steine
      var list = st.tiles.slice().sort(function (a, b) { return (a.dead ? 0 : 1) - (b.dead ? 0 : 1); });

      for (var i = 0; i < list.length; i++) {
        var tile = list[i];
        var pr = st.animating ? U.lerp(tile.sr, tile.tr, t) : tile.r;
        var pc = st.animating ? U.lerp(tile.sc, tile.tc, t) : tile.c;
        var px = layout.x + layout.gap + pc * (layout.cell + layout.gap);
        var py = layout.y + layout.gap + pr * (layout.cell + layout.gap);

        var s = 1;
        if (tile.appear > 0) s = U.easeOutBack(1 - tile.appear);
        if (tile.pop > 0) s = 1 + Math.sin((1 - tile.pop / POP) * Math.PI) * 0.14;
        s = U.clamp(s, 0.02, 1.2);

        var sz = layout.cell * s;
        var ox = px + (layout.cell - sz) / 2;
        var oy = py + (layout.cell - sz) / 2;

        var lk = look(tile.v);
        G.fillRound(ctx, ox, oy, sz, sz, r0 * s, lk[0]);

        if (tile.v >= 1024) {
          ctx.save();
          ctx.globalAlpha = 0.5;
          G.strokeRound(ctx, ox + 1, oy + 1, sz - 2, sz - 2, r0 * s, '#ffffff', 1.5);
          ctx.restore();
        }

        var label = String(tile.v);
        var fs = layout.cell * (label.length >= 5 ? 0.26 : label.length >= 4 ? 0.32
          : label.length >= 3 ? 0.38 : 0.46) * s;
        G.text(ctx, label, ox + sz / 2, oy + sz / 2, {
          size: fs, weight: 800, color: lk[1], align: 'center', baseline: 'middle',
        });
      }
    }

    /* ---------------------------------------------------------- Schleife */

    var loop = host.loop({
      hz: 60,
      update: function (dt) {
        if (st.animating) {
          st.anim += dt;
          if (st.anim >= ANIM) finishMove();
        }
        for (var i = 0; i < st.tiles.length; i++) {
          var t = st.tiles[i];
          if (t.appear > 0) t.appear = Math.max(0, t.appear - dt / 0.16);
          if (t.pop > 0) t.pop = Math.max(0, t.pop - dt);
        }
      },
      render: draw,
    });

    /* ---------------------------------------------------------- Eingabe */

    var DIRS = { left: 0, up: 1, right: 2, down: 3 };

    host.input({
      swipeMin: 22,
      onSwipe: function (dir) { move(DIRS[dir]); },
    });

    var keys = host.keys({
      onDown: function (k) {
        var map = {
          arrowleft: 0, a: 0, arrowup: 1, w: 1, arrowright: 2, d: 2, arrowdown: 3, s: 3,
        };
        if (map[k] !== undefined) move(map[k]);
        if (k === 'z' || k === 'u') doUndo();
      },
    });

    /* ---------------------------------------------------------- Start */

    reset(n);
    loop.start();
    SG.tutorial.show({
      id: '2048', parent: host.root, title: '2048',
      pages: [{
        kicker: '2048', title: 'Wischen, verschmelzen, wachsen',
        art: SG.tutorial.art.swipe,
        body: [
          { ic: '👆', text: '<b>Wische</b> in eine Richtung — alle Steine rutschen bis zum Rand.' },
          { ic: '🔗', text: 'Zwei <b>gleiche Zahlen</b> verschmelzen zur doppelten.' },
          { ic: '🎯', text: 'Ziel: der Stein <b>2048</b>.' },
        ],
      }],
    });

    return {
      state: st,
      destroy: function () { keys.destroy(); },
      selftest: function (steps) {
        var r = U.rng(4242);
        for (var i = 0; i < (steps || 600); i++) {
          if (st.over) reset();
          move(r.int(4));
          if (st.animating) { st.anim = ANIM; finishMove(); }
        }
        draw();
      },
    };
  }

  SG.register({
    id: '2048',
    name: '2048',
    category: 'puzzle',
    desc: 'Wischen, verschmelzen, 2048 bauen',
    tags: ['zahlen', 'wischen', 'klassiker', 'merge'],
    scoreLabel: function (bests) {
      var v = bests['4'];
      return v ? U.num(v) : null;
    },
    preview: function (c, w, h) {
      var pad = h * 0.09;
      var size = Math.min(w, h) - pad * 2;
      var x0 = (w - size) / 2, y0 = (h - size) / 2;
      var gap = size * 0.035, cell = (size - gap * 5) / 4;
      G.fillRound(c, x0, y0, size, size, 8, '#161c2a');
      var vals = [0, 2, 4, 0, 4, 8, 16, 2, 8, 32, 64, 4, 2, 128, 256, 8];
      for (var i = 0; i < 16; i++) {
        var r = Math.floor(i / 4), cc = i % 4;
        var x = x0 + gap + cc * (cell + gap), y = y0 + gap + r * (cell + gap);
        var v = vals[i];
        if (!v) { G.fillRound(c, x, y, cell, cell, 4, '#1e253a'); continue; }
        var lk = look(v);
        G.fillRound(c, x, y, cell, cell, 4, lk[0]);
        G.text(c, String(v), x + cell / 2, y + cell / 2, {
          size: cell * (v >= 100 ? 0.36 : 0.46), weight: 800, color: lk[1],
          align: 'center', baseline: 'middle',
        });
      }
    },
    mount: mount,
  });
})(SG);
