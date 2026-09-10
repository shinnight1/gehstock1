/* ------------------------------------------------------------------
   Minensucher

   Der erste Tipp ist immer sicher (und oeffnet gleich eine Flaeche),
   Zahlen lassen sich per Tipp "aufloesen" (Chord), langes Tippen setzt
   eine Flagge. Vier Groessen mit eigenen Bestzeiten.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var G = SG.gfx;
  var UI = SG.ui;

  var LEVELS = [
    { id: 'klein', name: 'Klein', w: 9, h: 9, mines: 10 },
    { id: 'mittel', name: 'Mittel', w: 13, h: 11, mines: 25 },
    { id: 'gross', name: 'Groß', w: 18, h: 13, mines: 45 },
    { id: 'riesig', name: 'Riesig', w: 24, h: 16, mines: 85 },
  ];

  var NUMCOL = ['', '#5fa8ff', '#3ddc84', '#ff8f6b', '#ffd166', '#ff5f6b', '#34d3d3', '#a97bff', '#c8d4ea'];

  function mount(host) {
    var store = host.store;
    var levelId = store.get('level', 'mittel');
    var conf = byId(levelId);

    var st = {
      w: 0, h: 0, mines: 0,
      mine: null, open: null, flag: null, num: null,
      started: false, dead: false, won: false,
      time: 0, opened: 0, flags: 0,
      flagMode: false,
      boom: -1, reveal: 0,
      bump: {},        // Zellen mit kurzer Animation
    };

    var stage = host.canvas({ alpha: false });
    var ctx = stage.ctx;

    var sMines = host.stat('Minen', '0', 'gold');
    var sTime = host.stat('Zeit', '0:00');
    var sBest = host.stat('Bestzeit', '—');

    var flagBtn = host.tool('⚑', function () {
      st.flagMode = !st.flagMode;
      flagBtn.setOn(st.flagMode);
    });
    host.tool('Neu', function () { newGame(); });
    host.menuTool([
      { icon: '▦', label: 'Größe wählen', onClick: chooseLevel },
      { icon: '?', label: 'Anleitung', onClick: function () { help(true); } },
    ]);

    function byId(id) {
      for (var i = 0; i < LEVELS.length; i++) if (LEVELS[i].id === id) return LEVELS[i];
      return LEVELS[1];
    }

    /* ---------------------------------------------------------- Aufbau */

    function newGame(id) {
      if (id) { levelId = id; store.set('level', id); }
      conf = byId(levelId);
      st.w = conf.w; st.h = conf.h; st.mines = conf.mines;
      var n = st.w * st.h;
      st.mine = new Uint8Array(n);
      st.open = new Uint8Array(n);
      st.flag = new Uint8Array(n);
      st.num = new Uint8Array(n);
      st.started = false; st.dead = false; st.won = false;
      st.time = 0; st.opened = 0; st.flags = 0;
      st.boom = -1; st.reveal = 0;
      st.bump = {};
      host.closeOverlay();
      relayout(stage.w, stage.h);
      syncBar();
    }

    function syncBar() {
      sMines.set(U.num(st.mines - st.flags));
      sTime.set(U.time(st.time));
      var b = host.best(levelId);
      sBest.set(b === null ? '—' : U.time(b));
    }

    function idx(x, y) { return y * st.w + x; }
    function inside(x, y) { return x >= 0 && y >= 0 && x < st.w && y < st.h; }

    function forNeighbors(x, y, fn) {
      for (var dy = -1; dy <= 1; dy++) {
        for (var dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          var nx = x + dx, ny = y + dy;
          if (inside(nx, ny)) fn(nx, ny, idx(nx, ny));
        }
      }
    }

    /* Minen legen - der erste Klick und seine Nachbarn bleiben frei */
    function place(fx, fy) {
      var rng = U.rng((Date.now() ^ (Math.random() * 1e9)) >>> 0);
      var safe = {};
      safe[idx(fx, fy)] = 1;
      forNeighbors(fx, fy, function (nx, ny, i) { safe[i] = 1; });

      var spots = [];
      for (var i = 0; i < st.w * st.h; i++) if (!safe[i]) spots.push(i);
      rng.shuffle(spots);
      var count = Math.min(st.mines, spots.length);
      for (i = 0; i < count; i++) st.mine[spots[i]] = 1;
      st.mines = count;

      for (var y = 0; y < st.h; y++) {
        for (var x = 0; x < st.w; x++) {
          var k = idx(x, y);
          if (st.mine[k]) { st.num[k] = 9; continue; }
          var c = 0;
          forNeighbors(x, y, function (nx, ny, j) { if (st.mine[j]) c++; });
          st.num[k] = c;
        }
      }
      st.started = true;
      syncBar();
    }

    /* Flutfuellung ohne Rekursion - grosse Felder bleiben fluessig */
    function open(x, y) {
      var stack = [idx(x, y)];
      var seen = {};
      while (stack.length) {
        var k = stack.pop();
        if (seen[k]) continue;
        seen[k] = 1;
        if (st.open[k] || st.flag[k]) continue;
        st.open[k] = 1;
        st.opened++;
        st.bump[k] = 0.22;
        if (st.mine[k]) { st.boom = k; die(); return; }
        if (st.num[k] === 0) {
          var cx = k % st.w, cy = Math.floor(k / st.w);
          forNeighbors(cx, cy, function (nx, ny, j) {
            if (!st.open[j] && !st.flag[j]) stack.push(j);
          });
        }
      }
      checkWin();
    }

    /* Zahl "aufloesen": passende Flaggenzahl -> alle uebrigen oeffnen */
    function chord(x, y) {
      var k = idx(x, y);
      if (!st.open[k] || !st.num[k]) return false;
      var flags = 0, closed = [];
      forNeighbors(x, y, function (nx, ny, j) {
        if (st.flag[j]) flags++;
        else if (!st.open[j]) closed.push([nx, ny]);
      });
      if (flags !== st.num[k] || !closed.length) return false;
      host.sfx('click');
      for (var i = 0; i < closed.length; i++) {
        if (st.dead) break;
        open(closed[i][0], closed[i][1]);
      }
      return true;
    }

    function toggleFlag(x, y) {
      var k = idx(x, y);
      if (st.open[k]) return;
      st.flag[k] = st.flag[k] ? 0 : 1;
      st.flags += st.flag[k] ? 1 : -1;
      st.bump[k] = 0.2;
      host.sfx(st.flag[k] ? 'tick' : 'click');
      host.buzz(10);
      syncBar();
    }

    function die() {
      st.dead = true;
      st.reveal = 0;
      host.sfx('explode');
      host.buzz(60);
      host.after(function () {
        host.gameOver({
          title: 'Boom',
          sub: conf.name + ' · ' + U.pct(st.opened / (st.w * st.h - st.mines), 0) + ' aufgedeckt',
          onAgain: function () { newGame(); },
          submit: false,
        });
      }, 900);
    }

    function checkWin() {
      if (st.dead || st.won) return;
      if (st.opened < st.w * st.h - st.mines) return;
      st.won = true;
      // uebrige Felder automatisch markieren
      for (var i = 0; i < st.mine.length; i++) {
        if (st.mine[i] && !st.flag[i]) { st.flag[i] = 1; st.flags++; }
      }
      syncBar();
      host.sfx('win');
      host.stats('gewonnen', 1);
      host.gameOver({
        won: true,
        title: 'Feld geräumt!',
        sub: conf.name + ' · ' + st.mines + ' Minen',
        score: Math.round(st.time),
        mode: levelId,
        higher: false,
        scoreLabel: 'Zeit',
        format: function (v) { return U.time(v); },
        onAgain: function () { newGame(); },
      });
    }

    /* ---------------------------------------------------------- Zeichnen */

    var L = { x: 0, y: 0, cell: 20 };

    function relayout(w, h) {
      if (!st.w) return;
      var padPx = 10;
      var cw = (w - padPx * 2) / st.w;
      var ch = (h - padPx * 2) / st.h;
      L.cell = Math.max(14, Math.floor(Math.min(cw, ch)));
      L.x = Math.round((w - L.cell * st.w) / 2);
      L.y = Math.round((h - L.cell * st.h) / 2);
    }
    stage.onResize = relayout;

    function draw() {
      var w = stage.w, h = stage.h;
      ctx.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0);
      ctx.fillStyle = '#0b0e15';
      ctx.fillRect(0, 0, w, h);
      if (!st.w) return;
      if (!L.cell) relayout(w, h);

      var c = L.cell, g = Math.max(1, c * 0.05);
      var fs = c * 0.56;

      for (var y = 0; y < st.h; y++) {
        for (var x = 0; x < st.w; x++) {
          var k = idx(x, y);
          var px = L.x + x * c, py = L.y + y * c;
          var bump = st.bump[k] || 0;
          var inset = bump > 0 ? bump * 8 : 0;

          if (st.open[k]) {
            ctx.fillStyle = st.mine[k] ? (k === st.boom ? '#e04a35' : '#3a2030') : '#161d2c';
            ctx.fillRect(px, py, c - g, c - g);
            if (st.mine[k]) {
              G.circle(ctx, px + c / 2, py + c / 2, c * 0.22, '#ffdde1');
            } else if (st.num[k]) {
              G.text(ctx, String(st.num[k]), px + (c - g) / 2, py + (c - g) / 2 + 1, {
                size: fs, weight: 800, color: NUMCOL[st.num[k]],
                align: 'center', baseline: 'middle',
              });
            }
          } else {
            var shade = (x + y) % 2 ? '#2b3752' : '#293349';
            if (st.dead && st.mine[k] && st.reveal > 0) shade = '#4a2431';
            G.fillRound(ctx, px + inset / 2, py + inset / 2,
              c - g - inset, c - g - inset, Math.max(2, c * 0.14), shade);
            // Lichtkante
            ctx.fillStyle = 'rgba(255,255,255,.06)';
            ctx.fillRect(px + 1, py + 1, c - g - 2, Math.max(1, c * 0.08));

            if (st.flag[k]) {
              var fx2 = px + c * 0.32, fy2 = py + c * 0.2;
              ctx.strokeStyle = '#cfd6e8';
              ctx.lineWidth = Math.max(1.2, c * 0.06);
              ctx.beginPath();
              ctx.moveTo(fx2, fy2); ctx.lineTo(fx2, py + c * 0.76);
              ctx.stroke();
              G.poly(ctx, [fx2, fy2, fx2 + c * 0.3, fy2 + c * 0.12, fx2, fy2 + c * 0.26],
                st.won ? '#3ddc84' : '#ff5f6b');
            } else if (st.dead && st.mine[k] && st.reveal > 0) {
              ctx.save();
              ctx.globalAlpha = Math.min(1, st.reveal);
              G.circle(ctx, px + c / 2, py + c / 2, c * 0.2, '#ff9aa4');
              ctx.restore();
            }
          }
        }
      }
    }

    /* ---------------------------------------------------------- Schleife */

    var loop = host.loop({
      hz: 30,
      update: function (dt) {
        if (st.started && !st.dead && !st.won) {
          st.time += dt;
          sTime.set(U.time(st.time));
        }
        if (st.dead && st.reveal < 1) st.reveal = Math.min(1, st.reveal + dt * 1.4);
        for (var k in st.bump) {
          st.bump[k] -= dt;
          if (st.bump[k] <= 0) delete st.bump[k];
        }
      },
      render: draw,
    });

    function cellAt(x, y) {
      var cx = Math.floor((x - L.x) / L.cell);
      var cy = Math.floor((y - L.y) / L.cell);
      return inside(cx, cy) ? [cx, cy] : null;
    }

    host.input({
      onTap: function (x, y) {
        if (st.dead || st.won) return;
        var p = cellAt(x, y);
        if (!p) return;
        var k = idx(p[0], p[1]);
        if (st.flagMode) { toggleFlag(p[0], p[1]); return; }
        if (st.open[k]) { chord(p[0], p[1]); return; }
        if (st.flag[k]) return;
        if (!st.started) place(p[0], p[1]);
        host.sfx('place');
        open(p[0], p[1]);
      },
      onLongPress: function (x, y) {
        if (st.dead || st.won) return;
        var p = cellAt(x, y);
        if (!p) return;
        if (st.open[idx(p[0], p[1])]) chord(p[0], p[1]);
        else toggleFlag(p[0], p[1]);
      },
      onDoubleTap: function (x, y) {
        var p = cellAt(x, y);
        if (p) chord(p[0], p[1]);
      },
    });

    function chooseLevel() {
      var body = UI.el('div');
      LEVELS.forEach(function (l) {
        var b = host.best(l.id);
        body.appendChild(UI.el('div.item.tap' + (l.id === levelId ? '.sel' : ''), {
          on: { click: function () { m.close(); newGame(l.id); } },
        }, [
          UI.el('div.thumb', { text: '💣' }),
          UI.el('div.main', null, [
            UI.el('div.t', { text: l.name }),
            UI.el('div.d', { text: l.w + '×' + l.h + ' Felder · ' + l.mines + ' Minen' }),
          ]),
          UI.el('div.side', null, [
            UI.el('div.p', { text: b === null ? '—' : U.time(b) }),
            UI.el('div.s', { text: 'Bestzeit' }),
          ]),
        ]));
      });
      var m = host.modal({ title: 'Feldgröße', body: body });
    }

    function help(force) {
      SG.tutorial.show({
        id: 'minesweeper', force: force, parent: host.root, title: 'Minensucher',
        pages: [{
          kicker: 'Minensucher', title: 'Zahlen zählen Minen',
          art: SG.tutorial.art.tap,
          body: [
            { ic: '👆', text: '<b>Tippen</b> deckt ein Feld auf. Der erste Tipp ist immer sicher.' },
            { ic: '3', text: 'Eine Zahl sagt, wie viele der <b>acht Nachbarfelder</b> eine Mine enthalten.' },
            { ic: '⚑', text: '<b>Lange tippen</b> setzt eine Flagge. Oder oben den Flaggen-Knopf einschalten.' },
            { ic: '⚡', text: 'Auf eine Zahl tippen, deren Minen alle beflaggt sind, öffnet die restlichen Nachbarn auf einen Schlag.' },
          ],
        }],
      });
    }

    newGame(levelId);
    loop.start();
    help(false);

    return {
      state: st,
      selftest: function () {
        newGame('klein');
        place(4, 4);
        open(4, 4);
        // Alle sicheren Felder oeffnen - muss gewinnen, nie sterben
        for (var y = 0; y < st.h && !st.dead; y++) {
          for (var x = 0; x < st.w && !st.dead; x++) {
            if (!st.mine[idx(x, y)]) open(x, y);
          }
        }
        if (st.dead) throw new Error('Auf einer Mine gestorben, obwohl nur sichere Felder geöffnet wurden');
        if (!st.won) throw new Error('Gewinn nicht erkannt');
        newGame('mittel');
        place(2, 2); open(2, 2);
        toggleFlag(0, 0);
        chord(2, 2);
        draw();
      },
    };
  }

  SG.register({
    id: 'minesweeper',
    name: 'Minensucher',
    category: 'puzzle',
    desc: 'Vier Größen, sicherer erster Tipp',
    tags: ['minesweeper', 'minen', 'logik', 'klassiker'],
    scoreLabel: function (bests) {
      var v = bests.mittel;
      return v ? U.time(v) : null;
    },
    preview: function (c, w, h) {
      var cols = 10, rows = 6;
      var cell = Math.min(w / (cols + 1), h / (rows + 1));
      var x0 = (w - cell * cols) / 2, y0 = (h - cell * rows) / 2;
      var demo = [
        1, 1, 1, 0, 0, 0, 1, 1, 1, 0,
        1, 9, 1, 0, 1, 1, 2, 9, 2, 1,
        1, 1, 1, 0, 1, 9, 2, 2, 9, 1,
        0, 0, 0, 0, 1, 1, 1, 1, 1, 1,
        1, 1, 1, 0, 0, 0, 0, 0, 0, 0,
        1, 9, 1, 0, 1, 1, 1, 0, 0, 0,
      ];
      for (var i = 0; i < cols * rows; i++) {
        var x = x0 + (i % cols) * cell, y = y0 + Math.floor(i / cols) * cell;
        var v = demo[i];
        var openCell = i % 7 !== 3 && i % 5 !== 1;
        if (v === 9) {
          G.fillRound(c, x + 1, y + 1, cell - 2, cell - 2, 3, '#2b3752');
          c.strokeStyle = '#cfd6e8'; c.lineWidth = 1.2;
          c.beginPath(); c.moveTo(x + cell * .38, y + cell * .25);
          c.lineTo(x + cell * .38, y + cell * .78); c.stroke();
          G.poly(c, [x + cell * .38, y + cell * .25, x + cell * .72, y + cell * .38,
            x + cell * .38, y + cell * .5], '#ff5f6b');
        } else if (openCell) {
          c.fillStyle = '#161d2c';
          c.fillRect(x + 1, y + 1, cell - 2, cell - 2);
          if (v) {
            G.text(c, String(v), x + cell / 2, y + cell / 2, {
              size: cell * 0.56, weight: 800, color: NUMCOL[v], align: 'center', baseline: 'middle',
            });
          }
        } else {
          G.fillRound(c, x + 1, y + 1, cell - 2, cell - 2, 3, '#2b3752');
        }
      }
    },
    mount: mount,
  });
})(SG);
