/* ------------------------------------------------------------------
   Nonogramm (Picross)

   Die Raetsel entstehen im Browser und werden mit einem Zeilenloeser
   geprueft: nur Muster, die sich rein logisch - ohne Raten - aufloesen
   lassen, kommen ins Spiel.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var G = SG.gfx;
  var UI = SG.ui;

  var UNKNOWN = 0, FILL = 1, EMPTY = 2;

  /* ==================================================================
     Regel-Engine
     ================================================================== */

  var R = SG.rules.nonogram = {};

  R.cluesOf = function (line) {
    var out = [], run = 0;
    for (var i = 0; i < line.length; i++) {
      if (line[i]) run++;
      else if (run) { out.push(run); run = 0; }
    }
    if (run) out.push(run);
    return out.length ? out : [0];
  };

  /* Alle gueltigen Belegungen einer Zeile aufzaehlen und schneiden.
     Liefert null, wenn es keine Loesung gibt. */
  R.lineSolve = function (clues, cells) {
    var len = cells.length;
    var andMask = null, orMask = null;
    var budget = 30000;

    var arr = new Uint8Array(len);

    function place(ci, pos) {
      if (budget-- <= 0) return;
      if (ci >= clues.length || (clues.length === 1 && clues[0] === 0)) {
        for (var i = pos; i < len; i++) {
          if (cells[i] === FILL) return;
          arr[i] = 0;
        }
        record();
        return;
      }
      var run = clues[ci];
      var rest = 0;
      for (var k = ci + 1; k < clues.length; k++) rest += clues[k] + 1;
      var maxStart = len - rest - run;
      for (var s = pos; s <= maxStart; s++) {
        // Alles vor s muss leer sein duerfen
        var ok = true;
        for (var j = pos; j < s; j++) {
          if (cells[j] === FILL) { ok = false; break; }
        }
        if (!ok) break;
        for (j = s; j < s + run; j++) {
          if (cells[j] === EMPTY) { ok = false; break; }
        }
        if (ok && s + run < len && cells[s + run] === FILL) ok = false;
        if (!ok) continue;
        for (j = pos; j < s; j++) arr[j] = 0;
        for (j = s; j < s + run; j++) arr[j] = 1;
        if (s + run < len) arr[s + run] = 0;
        place(ci + 1, Math.min(len, s + run + 1));
        if (budget <= 0) return;
      }
    }

    function record() {
      if (!andMask) {
        andMask = arr.slice();
        orMask = arr.slice();
        return;
      }
      for (var i = 0; i < len; i++) {
        if (!arr[i]) andMask[i] = 0;
        if (arr[i]) orMask[i] = 1;
      }
    }

    place(0, 0);
    if (!andMask) return null;
    var out = new Uint8Array(len);
    for (var i = 0; i < len; i++) {
      if (andMask[i]) out[i] = FILL;
      else if (!orMask[i]) out[i] = EMPTY;
      else out[i] = UNKNOWN;
    }
    return out;
  };

  /* Versucht, das Raetsel rein mit Zeilenlogik zu loesen. */
  R.logicSolve = function (rowClues, colClues, w, h) {
    var g = new Uint8Array(w * h);
    var changed = true, rounds = 0;
    var line = new Uint8Array(Math.max(w, h));

    while (changed && rounds < 60) {
      changed = false;
      rounds++;
      var y, x, i, res;

      for (y = 0; y < h; y++) {
        for (x = 0; x < w; x++) line[x] = g[y * w + x];
        res = R.lineSolve(rowClues[y], line.subarray(0, w));
        if (!res) return null;
        for (x = 0; x < w; x++) {
          if (res[x] !== UNKNOWN && g[y * w + x] !== res[x]) { g[y * w + x] = res[x]; changed = true; }
        }
      }
      for (x = 0; x < w; x++) {
        for (y = 0; y < h; y++) line[y] = g[y * w + x];
        res = R.lineSolve(colClues[x], line.subarray(0, h));
        if (!res) return null;
        for (y = 0; y < h; y++) {
          if (res[y] !== UNKNOWN && g[y * w + x] !== res[y]) { g[y * w + x] = res[y]; changed = true; }
        }
      }
    }
    for (var k = 0; k < g.length; k++) if (g[k] === UNKNOWN) return null;
    return g;
  };

  /* Erzeugt ein rein logisch loesbares Raetsel. */
  R.generateSteps = function* (rng, w, h, density) {
    for (var attempt = 0; attempt < 60; attempt++) {
      var sol = new Uint8Array(w * h);
      // Bloecke statt reinem Rauschen -> huebschere und loesbarere Muster
      for (var i = 0; i < w * h; i++) sol[i] = rng() < density ? 1 : 0;
      for (var pass = 0; pass < 2; pass++) {
        for (var y = 0; y < h; y++) {
          for (var x = 0; x < w; x++) {
            var n = 0, c = 0;
            for (var dy = -1; dy <= 1; dy++) {
              for (var dx = -1; dx <= 1; dx++) {
                var nx = x + dx, ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
                n++; c += sol[ny * w + nx];
              }
            }
            if (c * 2 > n + 1) sol[y * w + x] = 1;
            else if (c * 2 < n - 1) sol[y * w + x] = 0;
          }
        }
      }
      // Leere Zeilen/Spalten vermeiden
      var empty = 0;
      for (y = 0; y < h; y++) {
        var any = false;
        for (x = 0; x < w; x++) if (sol[y * w + x]) any = true;
        if (!any) empty++;
      }
      if (empty > h / 3) continue;

      var rowClues = [], colClues = [];
      for (y = 0; y < h; y++) {
        var line = [];
        for (x = 0; x < w; x++) line.push(sol[y * w + x]);
        rowClues.push(R.cluesOf(line));
      }
      for (x = 0; x < w; x++) {
        line = [];
        for (y = 0; y < h; y++) line.push(sol[y * w + x]);
        colClues.push(R.cluesOf(line));
      }

      yield attempt / 60;

      var solved = R.logicSolve(rowClues, colClues, w, h);
      if (!solved) continue;
      var ok = true;
      for (i = 0; i < w * h; i++) {
        if ((solved[i] === FILL ? 1 : 0) !== sol[i]) { ok = false; break; }
      }
      if (!ok) continue;
      return { sol: sol, rowClues: rowClues, colClues: colClues, w: w, h: h };
    }
    return null;
  };

  /* ==================================================================
     Spiel
     ================================================================== */

  var LEVELS = [
    { id: 'k5', name: 'Klein', w: 5, h: 5, d: 0.58 },
    { id: 'm10', name: 'Mittel', w: 10, h: 10, d: 0.55 },
    { id: 'g15', name: 'Groß', w: 15, h: 15, d: 0.52 },
  ];

  function mount(host) {
    var store = host.store;
    var levelId = store.get('level', 'm10');

    var st = {
      w: 0, h: 0,
      sol: null, cells: null,
      rowClues: [], colClues: [],
      time: 0, running: false, done: false,
      errors: 0,
      generating: true, prog: 0,
      paint: 0, paintTo: 0,
      wrong: {},
      markMode: false,
    };

    var stage = host.canvas({ alpha: false });
    var ctx = stage.ctx;

    var sSize = host.stat('Größe', '');
    var sTime = host.stat('Zeit', '0:00');
    var sErr = host.stat('Fehler', '0');

    var markBtn = host.tool('✕', function () {
      st.markMode = !st.markMode;
      markBtn.setOn(st.markMode);
    });
    host.tool('Neu', function () { newGame(); });
    host.menuTool([
      { icon: '▦', label: 'Größe wählen', onClick: chooseLevel },
      { icon: '🧹', label: 'Kreuze entfernen', onClick: clearMarks },
      { icon: '?', label: 'Anleitung', onClick: function () { help(true); } },
    ]);

    function conf() {
      for (var i = 0; i < LEVELS.length; i++) if (LEVELS[i].id === levelId) return LEVELS[i];
      return LEVELS[1];
    }

    var task = null;

    function newGame(id) {
      if (id) { levelId = id; store.set('level', id); }
      var c = conf();
      st.generating = true; st.prog = 0; st.done = false; st.running = false;
      st.errors = 0; st.time = 0; st.wrong = {};
      sErr.set('0'); sTime.set('0:00');
      sSize.set(c.w + '×' + c.h);
      host.closeOverlay();

      var rng = U.rng((Date.now() ^ (Math.random() * 1e9)) >>> 0);
      if (task) task.cancel();
      task = U.slice(R.generateSteps(rng, c.w, c.h, c.d), 8, function (res) {
        if (!res) {
          host.toast('Rätsel konnte nicht gebaut werden — neuer Versuch.', 'bad');
          newGame();
          return;
        }
        st.generating = false;
        st.w = res.w; st.h = res.h;
        st.sol = res.sol;
        st.rowClues = res.rowClues;
        st.colClues = res.colClues;
        st.cells = new Uint8Array(res.w * res.h);
        st.running = true;
        relayout(stage.w, stage.h);
      }, function (p) { st.prog = p; });
    }

    function clearMarks() {
      for (var i = 0; i < st.cells.length; i++) if (st.cells[i] === EMPTY) st.cells[i] = UNKNOWN;
      host.sfx('click');
    }

    function setCell(i, v) {
      if (st.done || st.generating) return;
      if (st.cells[i] === v) return;
      if (v === FILL && !st.sol[i]) {
        st.errors++;
        sErr.set(U.num(st.errors));
        st.wrong[i] = 1.1;
        st.cells[i] = EMPTY;      // Fehler wird automatisch zum Kreuz
        host.sfx('error');
        host.buzz(24);
        return;
      }
      st.cells[i] = v;
      host.sfx(v === FILL ? 'tick' : 'click');
      checkDone();
    }

    function checkDone() {
      for (var i = 0; i < st.cells.length; i++) {
        if (st.sol[i] && st.cells[i] !== FILL) return;
      }
      st.done = true;
      st.running = false;
      host.sfx('win');
      host.stats('geloest', 1);
      host.gameOver({
        won: true,
        title: 'Bild fertig!',
        sub: st.w + '×' + st.h + ' · ' + st.errors + ' Fehler',
        score: Math.round(st.time),
        mode: levelId,
        higher: false,
        scoreLabel: 'Zeit',
        format: function (v) { return U.time(v); },
        onAgain: function () { newGame(); },
      });
    }

    /* ---------------------------------------------------------- Zeichnen */

    var L = { x: 0, y: 0, cell: 20, padL: 0, padT: 0 };

    function maxClues(list) {
      var m = 1;
      for (var i = 0; i < list.length; i++) m = Math.max(m, list[i].length);
      return m;
    }

    function relayout(w, h) {
      if (!st.w) return;
      var rc = maxClues(st.rowClues), cc = maxClues(st.colClues);
      // Zellgroesse so, dass Gitter + Hinweisfelder passen
      var cell = Math.floor(Math.min(
        (w - 20) / (st.w + rc * 0.62),
        (h - 20) / (st.h + cc * 0.62)));
      cell = U.clamp(cell, 12, 56);
      L.cell = cell;
      L.padL = Math.ceil(rc * cell * 0.62);
      L.padT = Math.ceil(cc * cell * 0.62);
      L.x = Math.round((w - (L.padL + st.w * cell)) / 2) + L.padL;
      L.y = Math.round((h - (L.padT + st.h * cell)) / 2) + L.padT;
    }
    stage.onResize = relayout;

    /* Ist eine Zeile/Spalte fertig? Dann Hinweise ausgrauen. */
    function lineDone(clues, get, len) {
      var line = [];
      for (var i = 0; i < len; i++) line.push(get(i) === FILL ? 1 : 0);
      var c = R.cluesOf(line);
      if (c.length !== clues.length) return false;
      for (i = 0; i < c.length; i++) if (c[i] !== clues[i]) return false;
      return true;
    }

    function draw() {
      var w = stage.w, h = stage.h;
      ctx.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0);
      ctx.fillStyle = '#0b0e15';
      ctx.fillRect(0, 0, w, h);

      if (st.generating) {
        G.text(ctx, 'Rätsel wird geprüft…', w / 2, h / 2 - 18, {
          size: 16, weight: 600, color: '#8794b1', align: 'center', baseline: 'middle',
        });
        G.progress(ctx, w / 2 - 90, h / 2 + 8, 180, 8, st.prog);
        return;
      }
      if (!st.cells) return;
      if (!L.padL) relayout(w, h);

      var c = L.cell;
      var fs = Math.max(8, c * 0.42);

      // Hinweisflaechen
      G.fillRound(ctx, L.x - L.padL - 4, L.y - 4, L.padL + 4, st.h * c + 8, 6, '#141a27');
      G.fillRound(ctx, L.x - 4, L.y - L.padT - 4, st.w * c + 8, L.padT + 4, 6, '#141a27');

      // Zellen
      for (var y = 0; y < st.h; y++) {
        for (var x = 0; x < st.w; x++) {
          var i = y * st.w + x;
          var px = L.x + x * c, py = L.y + y * c;
          var v = st.cells[i];
          var band = (Math.floor(x / 5) + Math.floor(y / 5)) % 2;
          ctx.fillStyle = v === FILL ? '#e9edf6' : (band ? '#1b2230' : '#161c29');
          ctx.fillRect(px, py, c - 1, c - 1);
          if (v === EMPTY) {
            ctx.strokeStyle = '#4d5a78';
            ctx.lineWidth = Math.max(1, c * 0.07);
            var m = c * 0.3;
            ctx.beginPath();
            ctx.moveTo(px + m, py + m); ctx.lineTo(px + c - 1 - m, py + c - 1 - m);
            ctx.moveTo(px + c - 1 - m, py + m); ctx.lineTo(px + m, py + c - 1 - m);
            ctx.stroke();
          }
          if (st.wrong[i] > 0) {
            ctx.save();
            ctx.globalAlpha = Math.min(1, st.wrong[i]);
            ctx.fillStyle = '#ff5f6b';
            ctx.fillRect(px, py, c - 1, c - 1);
            ctx.restore();
          }
        }
      }

      // Gitterlinien
      for (var k = 0; k <= st.w; k++) {
        var thick = k % 5 === 0;
        ctx.strokeStyle = thick ? '#54628a' : '#2a3348';
        ctx.lineWidth = thick ? 1.6 : 0.8;
        ctx.beginPath();
        ctx.moveTo(Math.round(L.x + k * c) - .5, L.y - L.padT);
        ctx.lineTo(Math.round(L.x + k * c) - .5, L.y + st.h * c);
        ctx.stroke();
      }
      for (k = 0; k <= st.h; k++) {
        thick = k % 5 === 0;
        ctx.strokeStyle = thick ? '#54628a' : '#2a3348';
        ctx.lineWidth = thick ? 1.6 : 0.8;
        ctx.beginPath();
        ctx.moveTo(L.x - L.padL, Math.round(L.y + k * c) - .5);
        ctx.lineTo(L.x + st.w * c, Math.round(L.y + k * c) - .5);
        ctx.stroke();
      }

      // Hinweise
      for (y = 0; y < st.h; y++) {
        var cl = st.rowClues[y];
        var done = lineDone(cl, (function (yy) {
          return function (i2) { return st.cells[yy * st.w + i2]; };
        })(y), st.w);
        for (var q = 0; q < cl.length; q++) {
          if (cl[q] === 0) continue;
          G.text(ctx, String(cl[q]),
            L.x - (cl.length - q) * c * 0.62 + c * 0.31,
            L.y + y * c + c / 2, {
            size: fs, weight: 700, align: 'center', baseline: 'middle',
            color: done ? '#4b5570' : '#c3cee6',
          });
        }
      }
      for (x = 0; x < st.w; x++) {
        cl = st.colClues[x];
        done = lineDone(cl, (function (xx) {
          return function (i2) { return st.cells[i2 * st.w + xx]; };
        })(x), st.h);
        for (q = 0; q < cl.length; q++) {
          if (cl[q] === 0) continue;
          G.text(ctx, String(cl[q]),
            L.x + x * c + c / 2,
            L.y - (cl.length - q) * c * 0.62 + c * 0.31, {
            size: fs, weight: 700, align: 'center', baseline: 'middle',
            color: done ? '#4b5570' : '#c3cee6',
          });
        }
      }
    }

    /* ---------------------------------------------------------- Schleife */

    var loop = host.loop({
      hz: 30,
      update: function (dt) {
        if (st.running && !st.done) { st.time += dt; sTime.set(U.time(st.time)); }
        for (var k in st.wrong) {
          st.wrong[k] -= dt;
          if (st.wrong[k] <= 0) delete st.wrong[k];
        }
      },
      render: draw,
    });

    function cellAt(x, y) {
      if (!st.cells) return -1;
      var cx = Math.floor((x - L.x) / L.cell);
      var cy = Math.floor((y - L.y) / L.cell);
      if (cx < 0 || cy < 0 || cx >= st.w || cy >= st.h) return -1;
      return cy * st.w + cx;
    }

    var painting = false, paintValue = 0, lastCell = -1;

    host.input({
      onDown: function (p) {
        var i = cellAt(p.x, p.y);
        if (i < 0) return;
        var cur = st.cells[i];
        if (st.markMode) paintValue = cur === EMPTY ? UNKNOWN : EMPTY;
        else paintValue = cur === FILL ? UNKNOWN : FILL;
        painting = true;
        lastCell = i;
        setCell(i, paintValue);
      },
      onMove: function (p) {
        if (!painting) return;
        var i = cellAt(p.x, p.y);
        if (i < 0 || i === lastCell) return;
        lastCell = i;
        // Beim Ziehen nur setzen, nie versehentlich loeschen
        if (paintValue === UNKNOWN) setCell(i, UNKNOWN);
        else if (st.cells[i] === UNKNOWN) setCell(i, paintValue);
      },
      onUp: function () { painting = false; lastCell = -1; },
      onLongPress: function (x, y) {
        var i = cellAt(x, y);
        if (i < 0) return;
        painting = false;
        setCell(i, st.cells[i] === EMPTY ? UNKNOWN : EMPTY);
      },
      tapMax: 8,
    });

    function chooseLevel() {
      var body = UI.el('div');
      LEVELS.forEach(function (l) {
        var b = host.best(l.id);
        body.appendChild(UI.el('div.item.tap' + (l.id === levelId ? '.sel' : ''), {
          on: { click: function () { m.close(); newGame(l.id); } },
        }, [
          UI.el('div.thumb', { text: l.w }),
          UI.el('div.main', null, [
            UI.el('div.t', { text: l.name }),
            UI.el('div.d', { text: l.w + '×' + l.h + ' Felder' }),
          ]),
          UI.el('div.side', null, [
            UI.el('div.p', { text: b === null ? '—' : U.time(b) }),
            UI.el('div.s', { text: 'Bestzeit' }),
          ]),
        ]));
      });
      var m = host.modal({ title: 'Rätselgröße', body: body });
    }

    function help(force) {
      SG.tutorial.show({
        id: 'nonogram', force: force, parent: host.root, title: 'Nonogramm',
        pages: [{
          kicker: 'Nonogramm', title: 'Zahlen malen ein Bild',
          art: SG.tutorial.art.tap,
          body: [
            { ic: '3', text: 'Die Zahlen an Zeile und Spalte sagen, wie lang die <b>zusammenhängenden Blöcke</b> sind — in dieser Reihenfolge, mit mindestens einer Lücke dazwischen.' },
            { ic: '👆', text: '<b>Tippen</b> füllt ein Feld. <b>Ziehen</b> füllt gleich mehrere.' },
            { ic: '✕', text: '<b>Lange tippen</b> (oder den ✕-Knopf einschalten) markiert Felder als sicher leer.' },
            { ic: '⚠', text: 'Ein falsch gefülltes Feld zählt als Fehler und wird automatisch zum Kreuz.' },
            { ic: '✓', text: 'Fertige Zeilen und Spalten grauen ihre Zahlen aus.' },
          ],
        }],
      });
    }

    newGame();
    loop.start();
    help(false);

    return {
      state: st,
      destroy: function () { if (task) task.cancel(); },
      selftest: function () {
        var rng = U.rng(777);
        var it = R.generateSteps(rng, 10, 10, 0.55), res;
        do { res = it.next(); } while (!res.done);
        var p = res.value;
        if (!p) throw new Error('Kein Rätsel erzeugt');
        var solved = R.logicSolve(p.rowClues, p.colClues, p.w, p.h);
        if (!solved) throw new Error('Rätsel ist nicht rein logisch lösbar');
        for (var i = 0; i < p.w * p.h; i++) {
          if ((solved[i] === FILL ? 1 : 0) !== p.sol[i]) throw new Error('Lösung weicht ab');
        }
        st.generating = false;
        st.w = p.w; st.h = p.h; st.sol = p.sol;
        st.rowClues = p.rowClues; st.colClues = p.colClues;
        st.cells = new Uint8Array(p.w * p.h);
        st.done = false;
        for (i = 0; i < st.cells.length; i++) if (p.sol[i]) setCell(i, FILL);
        if (!st.done) throw new Error('Gewinn nicht erkannt');
        draw();
      },
    };
  }

  SG.register({
    id: 'nonogram',
    name: 'Nonogramm',
    category: 'puzzle',
    desc: 'Zahlenrätsel, das ein Bild malt',
    tags: ['picross', 'logik', 'bilderraetsel', 'griddler'],
    scoreLabel: function (bests) {
      var v = bests.m10;
      return v ? U.time(v) : null;
    },
    preview: function (c, w, h) {
      var n = 8;
      var cell = Math.min((w * 0.62) / n, (h * 0.7) / n);
      var x0 = w * 0.34, y0 = h * 0.28;
      var pat = [
        0, 0, 1, 1, 1, 1, 0, 0,
        0, 1, 1, 0, 0, 1, 1, 0,
        1, 1, 0, 1, 1, 0, 1, 1,
        1, 1, 0, 0, 0, 0, 1, 1,
        1, 1, 1, 0, 0, 1, 1, 1,
        0, 1, 1, 1, 1, 1, 1, 0,
        0, 0, 1, 1, 1, 1, 0, 0,
        0, 0, 0, 1, 1, 0, 0, 0,
      ];
      for (var i = 0; i < n * n; i++) {
        var x = x0 + (i % n) * cell, y = y0 + Math.floor(i / n) * cell;
        c.fillStyle = pat[i] ? '#e9edf6' : ((Math.floor((i % n) / 4) + Math.floor(Math.floor(i / n) / 4)) % 2 ? '#1b2230' : '#161c29');
        c.fillRect(x, y, cell - 1, cell - 1);
      }
      for (var k = 0; k <= n; k++) {
        var t = k % 4 === 0;
        c.strokeStyle = t ? '#54628a' : '#2a3348';
        c.lineWidth = t ? 1.2 : 0.6;
        c.beginPath(); c.moveTo(x0 + k * cell - .5, y0); c.lineTo(x0 + k * cell - .5, y0 + n * cell); c.stroke();
        c.beginPath(); c.moveTo(x0, y0 + k * cell - .5); c.lineTo(x0 + n * cell, y0 + k * cell - .5); c.stroke();
      }
      var rows = [[4], [2, 2], [2, 2, 2], [2, 2], [3, 3], [6], [4], [2]];
      for (var y2 = 0; y2 < n; y2++) {
        var cl = rows[y2];
        for (var q = 0; q < cl.length; q++) {
          G.text(c, String(cl[q]), x0 - (cl.length - q) * cell * 0.62 + cell * 0.31,
            y0 + y2 * cell + cell / 2, {
            size: cell * 0.5, weight: 700, color: '#c3cee6', align: 'center', baseline: 'middle',
          });
        }
      }
    },
    mount: mount,
  });
})(SG);
