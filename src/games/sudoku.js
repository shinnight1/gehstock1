/* ------------------------------------------------------------------
   Sudoku

   Eigener Generator mit Eindeutigkeitspruefung, Notizen, Hinweisen
   mit Begruendung, Fehlerpruefung und Zeitmessung.

   Die Erzeugung laeuft zeitscheibengesteuert (SG.util.slice), damit
   die Oberflaeche auch auf dem iPad nie einfriert - Web-Worker sind
   unter file:// nicht verfuegbar.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var G = SG.gfx;
  var UI = SG.ui;

  /* ==================================================================
     Regel-Engine (auch ohne DOM benutzbar, siehe tools/test.mjs)
     ================================================================== */

  var R = SG.rules.sudoku = {};

  var ROW = new Uint8Array(81), COL = new Uint8Array(81), BOX = new Uint8Array(81);
  var PEERS = [];
  (function () {
    for (var i = 0; i < 81; i++) {
      ROW[i] = Math.floor(i / 9);
      COL[i] = i % 9;
      BOX[i] = Math.floor(ROW[i] / 3) * 3 + Math.floor(COL[i] / 3);
    }
    for (i = 0; i < 81; i++) {
      var p = [];
      for (var j = 0; j < 81; j++) {
        if (j === i) continue;
        if (ROW[j] === ROW[i] || COL[j] === COL[i] || BOX[j] === BOX[i]) p.push(j);
      }
      PEERS.push(p);
    }
  })();
  R.ROW = ROW; R.COL = COL; R.BOX = BOX; R.PEERS = PEERS;

  function bit(v) { return 1 << (v - 1); }
  function popcount(x) {
    x = x - ((x >> 1) & 0x55555555);
    x = (x & 0x33333333) + ((x >> 2) & 0x33333333);
    return (((x + (x >> 4)) & 0x0f0f0f0f) * 0x01010101) >> 24;
  }
  function lowestBit(x) { return 31 - Math.clz32(x & -x) + 1; }

  /* Kandidatenmasken aus einem Gitter (0 = leer) */
  R.masks = function (g) {
    var rows = new Int32Array(9), cols = new Int32Array(9), boxes = new Int32Array(9);
    for (var i = 0; i < 81; i++) {
      var v = g[i];
      if (!v) continue;
      var b = bit(v);
      rows[ROW[i]] |= b; cols[COL[i]] |= b; boxes[BOX[i]] |= b;
    }
    return { rows: rows, cols: cols, boxes: boxes };
  };

  R.candidates = function (g, i) {
    if (g[i]) return 0;
    var used = 0;
    var p = PEERS[i];
    for (var k = 0; k < p.length; k++) used |= g[p[k]] ? bit(g[p[k]]) : 0;
    return 0x1ff & ~used;
  };

  /* Zaehlt Loesungen bis maximal limit. Mit "minimale Kandidaten zuerst". */
  R.count = function (grid, limit) {
    var g = grid.slice();
    var found = 0;
    limit = limit || 2;

    function rec() {
      var bestI = -1, bestMask = 0, bestN = 10;
      for (var i = 0; i < 81; i++) {
        if (g[i]) continue;
        var m = R.candidates(g, i);
        var n = popcount(m);
        if (n === 0) return false;
        if (n < bestN) { bestN = n; bestI = i; bestMask = m; if (n === 1) break; }
      }
      if (bestI < 0) { found++; return found >= limit; }
      var mask = bestMask;
      while (mask) {
        var v = lowestBit(mask);
        mask &= mask - 1;
        g[bestI] = v;
        if (rec()) { g[bestI] = 0; return true; }
        g[bestI] = 0;
      }
      return false;
    }
    rec();
    return found;
  };

  R.solve = function (grid) {
    var g = grid.slice();
    function rec() {
      var bestI = -1, bestMask = 0, bestN = 10;
      for (var i = 0; i < 81; i++) {
        if (g[i]) continue;
        var m = R.candidates(g, i);
        var n = popcount(m);
        if (n === 0) return false;
        if (n < bestN) { bestN = n; bestI = i; bestMask = m; if (n === 1) break; }
      }
      if (bestI < 0) return true;
      var mask = bestMask;
      while (mask) {
        var v = lowestBit(mask);
        mask &= mask - 1;
        g[bestI] = v;
        if (rec()) return true;
        g[bestI] = 0;
      }
      return false;
    }
    return rec() ? g : null;
  };

  /* Vollstaendig gefuelltes, zufaelliges Gitter */
  R.full = function (rng) {
    var g = new Uint8Array(81);
    function rec(i) {
      if (i >= 81) return true;
      var m = R.candidates(g, i);
      var opts = [];
      while (m) { opts.push(lowestBit(m)); m &= m - 1; }
      rng.shuffle(opts);
      for (var k = 0; k < opts.length; k++) {
        g[i] = opts[k];
        if (rec(i + 1)) return true;
        g[i] = 0;
      }
      return false;
    }
    rec(0);
    return g;
  };

  /* Naechster logischer Schritt - fuer den Hinweis mit Begruendung */
  R.hint = function (g) {
    var i, m, n;
    // 1) Nacktes Single: nur ein Kandidat in der Zelle
    for (i = 0; i < 81; i++) {
      if (g[i]) continue;
      m = R.candidates(g, i);
      n = popcount(m);
      if (n === 1) {
        return {
          cell: i, value: lowestBit(m), kind: 'single',
          why: 'In dieser Zelle ist nur noch die ' + lowestBit(m) + ' möglich — ' +
            'alle anderen Ziffern stehen schon in Zeile, Spalte oder Block.',
        };
      }
    }
    // 2) Verstecktes Single: Ziffer passt in Einheit nur an eine Stelle
    var units = [];
    for (var u = 0; u < 9; u++) {
      var r = [], c = [], b = [];
      for (i = 0; i < 81; i++) {
        if (ROW[i] === u) r.push(i);
        if (COL[i] === u) c.push(i);
        if (BOX[i] === u) b.push(i);
      }
      units.push({ cells: r, name: 'Zeile ' + (u + 1) });
      units.push({ cells: c, name: 'Spalte ' + (u + 1) });
      units.push({ cells: b, name: 'Block ' + (u + 1) });
    }
    for (var k = 0; k < units.length; k++) {
      var cells = units[k].cells;
      for (var v = 1; v <= 9; v++) {
        var spot = -1, cnt = 0, taken = false;
        for (var q = 0; q < cells.length; q++) {
          var idx = cells[q];
          if (g[idx] === v) { taken = true; break; }
          if (g[idx]) continue;
          if (R.candidates(g, idx) & bit(v)) { spot = idx; cnt++; }
        }
        if (!taken && cnt === 1) {
          return {
            cell: spot, value: v, kind: 'hidden',
            why: 'In ' + units[k].name + ' passt die ' + v + ' nur noch in dieses Feld.',
          };
        }
      }
    }
    // 3) Notfall: aus der Loesung ableiten
    var sol = R.solve(g);
    if (!sol) return null;
    for (i = 0; i < 81; i++) {
      if (!g[i]) {
        return {
          cell: i, value: sol[i], kind: 'solve',
          why: 'Hier hilft nur weiterrechnen — die Lösung ist die ' + sol[i] + '.',
        };
      }
    }
    return null;
  };

  /* Erzeugt ein Raetsel. Generator, damit es in Haeppchen laufen kann. */
  R.generateSteps = function* (rng, targetGivens) {
    var full = R.full(rng);
    yield 0.15;
    var puzzle = full.slice();
    var order = U.range(81);
    rng.shuffle(order);
    var givens = 81;
    for (var k = 0; k < order.length; k++) {
      if (givens <= targetGivens) break;
      var i = order[k];
      if (!puzzle[i]) continue;
      var keep = puzzle[i];
      puzzle[i] = 0;
      if (R.count(puzzle, 2) !== 1) puzzle[i] = keep;
      else givens--;
      if ((k & 3) === 0) yield 0.15 + 0.85 * (k / order.length);
    }
    return { puzzle: puzzle, solution: full, givens: givens };
  };

  /* ==================================================================
     Spiel
     ================================================================== */

  var LEVELS = [
    { id: 'sehrleicht', name: 'Sehr leicht', givens: 50 },
    { id: 'leicht', name: 'Leicht', givens: 42 },
    { id: 'mittel', name: 'Mittel', givens: 34 },
    { id: 'schwer', name: 'Schwer', givens: 29 },
    { id: 'experte', name: 'Experte', givens: 25 },
  ];

  function mount(host) {
    var store = host.store;
    var level = store.get('level', 'mittel');

    var st = {
      puzzle: null, solution: null, grid: null,
      notes: null,           // 81 Bitmasken
      given: null,           // Boolean pro Zelle
      sel: -1,
      noteMode: false,
      time: 0, running: false,
      errors: 0, hints: 0,
      done: false,
      wrong: {},             // Zellen, die als falsch markiert sind
      flash: 0,
    };
    var undo = [];

    var stage = host.canvas({ alpha: false });
    var ctx = stage.ctx;

    /* ---------------------------------------------------------- Leiste */

    var sLevel = host.stat('Stufe', levelName(level));
    var sTime = host.stat('Zeit', '0:00');
    var sErr = host.stat('Fehler', '0');

    var noteBtn = host.tool('✎', function () {
      st.noteMode = !st.noteMode;
      noteBtn.setOn(st.noteMode);
      syncPad();
    });
    var undoBtn = host.tool('↺', function () { doUndo(); });
    host.tool('💡', function () { giveHint(); });
    host.menuTool([
      { icon: '▦', label: 'Schwierigkeit wählen', onClick: chooseLevel },
      { icon: '✓', label: 'Auf Fehler prüfen', desc: 'Falsche Zahlen kurz markieren', onClick: checkAll },
      { icon: '↻', label: 'Neues Rätsel', onClick: function () { newGame(level); } },
      { icon: '⌫', label: 'Alles zurücksetzen', desc: 'Nur die Vorgaben bleiben', onClick: clearAll },
      { icon: '?', label: 'Anleitung', onClick: function () { help(true); } },
    ]);

    function levelName(id) {
      for (var i = 0; i < LEVELS.length; i++) if (LEVELS[i].id === id) return LEVELS[i].name;
      return id;
    }

    /* ---------------------------------------------------------- Zahlenfeld */

    var pad = host.pad(
      [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (n) {
        return { name: 'n' + n, label: String(n), cls: 'sm' };
      }).concat([{ name: 'del', label: '⌫', cls: 'sm' }]),
      {
        pos: 'bottom',
        onPress: function (name) {
          if (name === 'del') setCell(0);
          else setCell(parseInt(name.slice(1), 10));
        },
      });

    function syncPad() {
      // Zahlen ausgrauen, die schon neunmal gesetzt sind
      var counts = new Array(10).fill(0);
      for (var i = 0; i < 81; i++) if (st.grid[i]) counts[st.grid[i]]++;
      for (var n = 1; n <= 9; n++) {
        var b = pad.btn('n' + n);
        if (b) b.style.opacity = counts[n] >= 9 ? '.35' : '';
      }
      pad.el.classList.toggle('notes', st.noteMode);
      for (n = 1; n <= 9; n++) {
        var b2 = pad.btn('n' + n);
        if (b2) b2.style.borderColor = st.noteMode ? 'var(--blue)' : '';
      }
    }

    /* ---------------------------------------------------------- Erzeugen */

    var genTask = null;

    function newGame(lv) {
      level = lv || level;
      store.set('level', level);
      sLevel.set(levelName(level));
      host.closeOverlay();

      var conf = LEVELS.filter(function (l) { return l.id === level; })[0] || LEVELS[2];
      var rng = U.rng((Date.now() ^ (Math.random() * 1e9)) >>> 0);

      st.done = true;   // waehrend der Erzeugung keine Eingaben
      st.running = false;
      var prog = 0;
      st.generating = true;

      if (genTask) genTask.cancel();
      genTask = U.slice(R.generateSteps(rng, conf.givens), 8, function (res) {
        st.generating = false;
        st.puzzle = res.puzzle;
        st.solution = res.solution;
        st.grid = Array.prototype.slice.call(res.puzzle);
        st.given = [];
        for (var i = 0; i < 81; i++) st.given[i] = res.puzzle[i] !== 0;
        st.notes = new Array(81).fill(0);
        st.sel = -1;
        st.time = 0; st.errors = 0; st.hints = 0;
        st.wrong = {};
        st.done = false;
        st.running = true;
        undo = [];
        sErr.set('0');
        sTime.set('0:00');
        syncPad();
      }, function (p) { prog = p; st.genProgress = p; });
      st.genProgress = 0;
    }

    /* ---------------------------------------------------------- Eingabe */

    function setCell(v) {
      if (st.done || st.generating) return;
      var i = st.sel;
      if (i < 0 || st.given[i]) { host.sfx('error'); return; }

      undo.push({ i: i, val: st.grid[i], note: st.notes[i] });
      if (undo.length > 60) undo.shift();

      if (st.noteMode && v) {
        st.notes[i] ^= bit(v);
        st.grid[i] = 0;
        host.sfx('tick');
      } else if (v === 0) {
        st.grid[i] = 0;
        st.notes[i] = 0;
        delete st.wrong[i];
        host.sfx('click');
      } else {
        st.grid[i] = v;
        st.notes[i] = 0;
        // Notizen der Nachbarn aufraeumen
        var p = PEERS[i];
        for (var k = 0; k < p.length; k++) st.notes[p[k]] &= ~bit(v);
        if (st.solution[i] !== v) {
          st.errors++;
          st.wrong[i] = 1.2;
          sErr.set(U.num(st.errors));
          host.sfx('error');
          host.buzz(20);
        } else {
          delete st.wrong[i];
          host.sfx('place');
        }
      }
      syncPad();
      checkDone();
    }

    function doUndo() {
      if (!undo.length || st.done) return;
      var u = undo.pop();
      st.grid[u.i] = u.val;
      st.notes[u.i] = u.note;
      delete st.wrong[u.i];
      st.sel = u.i;
      host.sfx('click');
      syncPad();
    }

    function clearAll() {
      host.confirm('Alles zurücksetzen?', 'Alle eigenen Eintragungen werden gelöscht.', 'Zurücksetzen')
        .then(function (ok) {
          if (!ok) return;
          for (var i = 0; i < 81; i++) {
            if (!st.given[i]) { st.grid[i] = 0; st.notes[i] = 0; }
          }
          st.wrong = {};
          undo = [];
          syncPad();
        });
    }

    function checkAll() {
      var n = 0;
      for (var i = 0; i < 81; i++) {
        if (st.grid[i] && !st.given[i] && st.grid[i] !== st.solution[i]) {
          st.wrong[i] = 2.2; n++;
        }
      }
      host.toast(n ? n + ' falsche ' + U.plural(n, 'Zahl', 'Zahlen') : 'Alles richtig bisher.',
        n ? 'bad' : 'good');
      host.sfx(n ? 'error' : 'blip');
    }

    function giveHint() {
      if (st.done || st.generating) return;
      var h = R.hint(st.grid);
      if (!h) { host.toast('Da stimmt etwas nicht — prüfe deine Zahlen.', 'bad'); return; }
      st.hints++;
      st.sel = h.cell;
      undo.push({ i: h.cell, val: st.grid[h.cell], note: st.notes[h.cell] });
      st.grid[h.cell] = h.value;
      st.notes[h.cell] = 0;
      delete st.wrong[h.cell];
      st.flash = 1;
      host.sfx('power');
      host.toast(h.why, null, 4200);
      syncPad();
      checkDone();
    }

    function checkDone() {
      for (var i = 0; i < 81; i++) if (st.grid[i] !== st.solution[i]) return;
      st.done = true;
      st.running = false;
      var score = Math.round(st.time);
      host.gameOver({
        won: true,
        title: 'Gelöst!',
        sub: levelName(level) + ' · ' + st.errors + ' Fehler · ' + st.hints + ' Hinweise',
        score: score,
        mode: level,
        higher: false,
        scoreLabel: 'Zeit',
        format: function (v) { return U.time(v); },
        onAgain: function () { newGame(level); },
      });
      host.stats('geloest', 1);
    }

    /* ---------------------------------------------------------- Zeichnen */

    var L = { x: 0, y: 0, size: 0, cell: 0 };

    function relayout(w, h) {
      var padPx = 12;
      var avail = Math.min(w - padPx * 2, h - padPx * 2 - 80);
      avail = Math.max(160, avail);
      L.size = Math.floor(avail / 9) * 9;
      L.cell = L.size / 9;
      L.x = Math.round((w - L.size) / 2);
      L.y = Math.round((h - 80 - L.size) / 2) + 4;
    }
    stage.onResize = relayout;

    function draw() {
      var w = stage.w, h = stage.h;
      if (!L.size) relayout(w, h);
      ctx.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0);
      ctx.fillStyle = '#0b0e15';
      ctx.fillRect(0, 0, w, h);

      if (st.generating) {
        G.text(ctx, 'Rätsel wird gebaut…', w / 2, h / 2 - 18, {
          size: 16, weight: 600, color: '#8794b1', align: 'center', baseline: 'middle',
        });
        G.progress(ctx, w / 2 - 90, h / 2 + 8, 180, 8, st.genProgress || 0);
        return;
      }
      if (!st.grid) return;

      var x0 = L.x, y0 = L.y, c = L.cell;

      G.fillRound(ctx, x0 - 6, y0 - 6, L.size + 12, L.size + 12, 10, '#161c2a');

      var selR = st.sel >= 0 ? ROW[st.sel] : -1;
      var selC = st.sel >= 0 ? COL[st.sel] : -1;
      var selB = st.sel >= 0 ? BOX[st.sel] : -1;
      var selV = st.sel >= 0 ? st.grid[st.sel] : 0;

      // Zellen
      for (var i = 0; i < 81; i++) {
        var r = ROW[i], cc = COL[i];
        var x = x0 + cc * c, y = y0 + r * c;
        var fill = '#1a2131';
        if (r === selR || cc === selC || BOX[i] === selB) fill = '#212a3d';
        if (selV && st.grid[i] === selV) fill = '#2c3a58';
        if (i === st.sel) fill = '#3c4d74';
        ctx.fillStyle = fill;
        ctx.fillRect(x, y, c, c);

        if (st.wrong[i] > 0) {
          ctx.save();
          ctx.globalAlpha = Math.min(1, st.wrong[i]) * 0.55;
          ctx.fillStyle = '#ff5f6b';
          ctx.fillRect(x, y, c, c);
          ctx.restore();
        }
      }

      // Linien
      for (var k = 0; k <= 9; k++) {
        var thick = k % 3 === 0;
        ctx.strokeStyle = thick ? '#4a5877' : '#2a3348';
        ctx.lineWidth = thick ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(Math.round(x0 + k * c) + .5, y0);
        ctx.lineTo(Math.round(x0 + k * c) + .5, y0 + L.size);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x0, Math.round(y0 + k * c) + .5);
        ctx.lineTo(x0 + L.size, Math.round(y0 + k * c) + .5);
        ctx.stroke();
      }

      // Zahlen und Notizen
      for (i = 0; i < 81; i++) {
        var rx = x0 + COL[i] * c, ry = y0 + ROW[i] * c;
        var v = st.grid[i];
        if (v) {
          var col = st.given[i] ? '#e9edf6' : (st.wrong[i] > 0 ? '#ffd6da' : '#7fc4ff');
          if (i === st.sel && st.flash > 0) col = '#ffd166';
          G.text(ctx, String(v), rx + c / 2, ry + c / 2 + 1, {
            size: c * 0.58, weight: st.given[i] ? 700 : 550, color: col,
            align: 'center', baseline: 'middle',
          });
        } else if (st.notes[i]) {
          for (var n = 1; n <= 9; n++) {
            if (!(st.notes[i] & bit(n))) continue;
            var nr = Math.floor((n - 1) / 3), nc2 = (n - 1) % 3;
            G.text(ctx, String(n),
              rx + c * (0.2 + nc2 * 0.3), ry + c * (0.22 + nr * 0.3),
              {
                size: c * 0.24, weight: 600,
                color: (selV === n) ? '#ffd166' : '#6b7a9c',
                align: 'center', baseline: 'middle',
              });
          }
        }
      }
    }

    /* ---------------------------------------------------------- Schleife */

    var loop = host.loop({
      hz: 30,
      update: function (dt) {
        if (st.running && !st.done) {
          st.time += dt;
          var s = U.time(st.time);
          sTime.set(s);
        }
        if (st.flash > 0) st.flash = Math.max(0, st.flash - dt * 1.5);
        for (var k in st.wrong) {
          st.wrong[k] -= dt;
          if (st.wrong[k] <= 0) delete st.wrong[k];
        }
      },
      render: draw,
      onPause: function () { st.running = false; },
      onResume: function () { if (!st.done && st.grid) st.running = true; },
    });

    host.input({
      onTap: function (x, y) {
        if (st.generating || !st.grid) return;
        var cx = Math.floor((x - L.x) / L.cell);
        var cy = Math.floor((y - L.y) / L.cell);
        if (cx < 0 || cx > 8 || cy < 0 || cy > 8) { st.sel = -1; return; }
        var i = cy * 9 + cx;
        st.sel = (st.sel === i) ? -1 : i;
        host.sfx('tick');
      },
      onLongPress: function (x, y) {
        var cx = Math.floor((x - L.x) / L.cell);
        var cy = Math.floor((y - L.y) / L.cell);
        if (cx < 0 || cx > 8 || cy < 0 || cy > 8) return;
        st.sel = cy * 9 + cx;
        st.noteMode = !st.noteMode;
        noteBtn.setOn(st.noteMode);
        syncPad();
      },
    });

    var keys = host.keys({
      onDown: function (k) {
        if (/^[1-9]$/.test(k)) setCell(parseInt(k, 10));
        else if (k === 'backspace' || k === 'delete' || k === '0') setCell(0);
        else if (k === 'n') { st.noteMode = !st.noteMode; noteBtn.setOn(st.noteMode); }
        else if (st.sel >= 0) {
          var r = ROW[st.sel], c = COL[st.sel];
          if (k === 'arrowleft') c = (c + 8) % 9;
          else if (k === 'arrowright') c = (c + 1) % 9;
          else if (k === 'arrowup') r = (r + 8) % 9;
          else if (k === 'arrowdown') r = (r + 1) % 9;
          else return;
          st.sel = r * 9 + c;
        }
      },
    });

    function chooseLevel() {
      var body = UI.el('div');
      LEVELS.forEach(function (l) {
        var b = host.best(l.id);
        body.appendChild(UI.el('div.item.tap' + (l.id === level ? '.sel' : ''), {
          on: { click: function () { m.close(); newGame(l.id); } },
        }, [
          UI.el('div.thumb', { text: l.givens }),
          UI.el('div.main', null, [
            UI.el('div.t', { text: l.name }),
            UI.el('div.d', { text: l.givens + ' vorgegebene Zahlen' }),
          ]),
          UI.el('div.side', null, [
            UI.el('div.p', { text: b === null ? '—' : U.time(b) }),
            UI.el('div.s', { text: 'Bestzeit' }),
          ]),
        ]));
      });
      var m = host.modal({ title: 'Schwierigkeit', body: body });
    }

    function help(force) {
      SG.tutorial.show({
        id: 'sudoku', force: force, parent: host.root, title: 'Sudoku',
        pages: [{
          kicker: 'Sudoku', title: 'Jede Ziffer genau einmal',
          art: SG.tutorial.art.tap,
          body: [
            { ic: '1', text: 'In jeder <b>Zeile</b>, jeder <b>Spalte</b> und jedem <b>3×3-Block</b> muss jede Ziffer von 1 bis 9 genau einmal stehen.' },
            { ic: '👆', text: 'Feld antippen, dann unten die Zahl wählen.' },
            { ic: '✎', text: 'Der <b>Stift</b> schaltet auf Notizen um — kleine Kandidaten ins Feld schreiben. Langes Tippen auf ein Feld schaltet ebenfalls um.' },
            { ic: '💡', text: 'Der <b>Hinweis</b> löst ein Feld und erklärt, warum.' },
            { ic: '⏱', text: 'Die Zeit läuft mit — Bestzeiten je Schwierigkeit.' },
          ],
        }],
      });
    }

    newGame(level);
    loop.start();
    help(false);

    return {
      state: st,
      destroy: function () { keys.destroy(); if (genTask) genTask.cancel(); },
      selftest: function () {
        // Erzeugung synchron durchziehen und logisch loesen
        var rng = U.rng(20240301);
        var it = R.generateSteps(rng, 34), res;
        do { res = it.next(); } while (!res.done);
        var p = res.value;
        if (R.count(p.puzzle, 2) !== 1) throw new Error('Rätsel nicht eindeutig');
        var solved = R.solve(p.puzzle);
        for (var i = 0; i < 81; i++) {
          if (solved[i] !== p.solution[i]) throw new Error('Lösung weicht ab');
        }
        // Ins laufende Spiel uebernehmen und ein paar Zuege machen
        st.generating = false;
        st.puzzle = p.puzzle;
        st.solution = p.solution;
        st.grid = Array.prototype.slice.call(p.puzzle);
        st.given = [];
        for (i = 0; i < 81; i++) st.given[i] = p.puzzle[i] !== 0;
        st.notes = new Array(81).fill(0);
        st.done = false;
        for (i = 0; i < 81; i++) {
          if (!st.given[i]) { st.sel = i; setCell(p.solution[i]); break; }
        }
        var h = R.hint(st.grid);
        if (!h) throw new Error('Kein Hinweis gefunden');
        draw();
      },
    };
  }

  SG.register({
    id: 'sudoku',
    name: 'Sudoku',
    category: 'puzzle',
    desc: 'Fünf Stufen, Notizen, Hinweise',
    tags: ['zahlen', 'logik', 'klassiker', 'raetsel'],
    scoreLabel: function (bests) {
      var v = bests.mittel;
      return v ? U.time(v) : null;
    },
    preview: function (c, w, h) {
      var size = Math.min(w, h) * 0.86;
      var x0 = (w - size) / 2, y0 = (h - size) / 2, cell = size / 9;
      G.fillRound(c, x0 - 4, y0 - 4, size + 8, size + 8, 6, '#161c2a');
      c.fillStyle = '#1a2131';
      c.fillRect(x0, y0, size, size);
      var demo = [
        5, 3, 0, 0, 7, 0, 0, 0, 0,
        6, 0, 0, 1, 9, 5, 0, 0, 0,
        0, 9, 8, 0, 0, 0, 0, 6, 0,
        8, 0, 0, 0, 6, 0, 0, 0, 3,
        4, 0, 0, 8, 0, 3, 0, 0, 1,
        7, 0, 0, 0, 2, 0, 0, 0, 6,
        0, 6, 0, 0, 0, 0, 2, 8, 0,
        0, 0, 0, 4, 1, 9, 0, 0, 5,
        0, 0, 0, 0, 8, 0, 0, 7, 9,
      ];
      for (var i = 0; i < 81; i++) {
        if (!demo[i]) continue;
        G.text(c, String(demo[i]),
          x0 + (i % 9) * cell + cell / 2, y0 + Math.floor(i / 9) * cell + cell / 2, {
          size: cell * 0.62, weight: 650, color: '#c8d4ea', align: 'center', baseline: 'middle',
        });
      }
      for (var k = 0; k <= 9; k++) {
        var t = k % 3 === 0;
        c.strokeStyle = t ? '#4a5877' : '#2a3348';
        c.lineWidth = t ? 1.6 : 0.8;
        c.beginPath(); c.moveTo(x0 + k * cell, y0); c.lineTo(x0 + k * cell, y0 + size); c.stroke();
        c.beginPath(); c.moveTo(x0, y0 + k * cell); c.lineTo(x0 + size, y0 + k * cell); c.stroke();
      }
    },
    mount: mount,
  });
})(SG);
