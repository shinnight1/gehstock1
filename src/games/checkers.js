/* ------------------------------------------------------------------
   Dame

   Zwei Regelwerke:
     Deutsch        8×8, Steine schlagen auch rückwärts, Damen ziehen
                    beliebig weit, Schlagzwang.
     International  10×10, zusätzlich Mehrheitszwang - es muss immer
                    die längste Schlagfolge genommen werden.

   Gegen den Computer (vier Stufen), zu zweit am iPad oder online.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var G = SG.gfx;
  var UI = SG.ui;

  /* ==================================================================
     Regel-Engine
     ================================================================== */

  var R = SG.rules.checkers = {};

  var EMPTY = 0, MAN = 1, KING = 2;      // Betrag; Vorzeichen = Seite

  R.create = function (variant) {
    var v = R.VARIANTS[variant] || R.VARIANTS.de;
    var n = v.size;
    var b = new Int8Array(n * n);
    var rows = v.rows;
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if ((r + c) % 2 === 0) continue;         // nur dunkle Felder
        if (r < rows) b[r * n + c] = -MAN;       // Schwarz oben
        else if (r >= n - rows) b[r * n + c] = MAN;
      }
    }
    return {
      b: b, n: n, variant: variant || 'de',
      turn: 1,                 // 1 = Weiss (unten), -1 = Schwarz
      hist: [],
      noProgress: 0,
    };
  };

  R.VARIANTS = {
    de: { name: 'Deutsch', size: 8, rows: 3, mustMax: false, menBackCapture: true },
    intl: { name: 'International', size: 10, rows: 4, mustMax: true, menBackCapture: true },
  };

  function conf(s) { return R.VARIANTS[s.variant] || R.VARIANTS.de; }

  R.clone = function (s) {
    return {
      b: s.b.slice(), n: s.n, variant: s.variant, turn: s.turn,
      hist: [], noProgress: s.noProgress,
    };
  };

  var DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

  function inside(s, r, c) { return r >= 0 && c >= 0 && r < s.n && c < s.n; }
  function at(s, r, c) { return s.b[r * s.n + c]; }
  function set(s, r, c, v) { s.b[r * s.n + c] = v; }

  /* Alle Schlagfolgen einer Figur. Liefert Zuege mit Pfad und Beute. */
  function captureSeqs(s, r, c, side, piece, taken, path, out) {
    var cf = conf(s);
    var found = false;
    var isKing = piece === KING;

    for (var d = 0; d < 4; d++) {
      var dr = DIAG[d][0], dc = DIAG[d][1];
      if (!isKing && !cf.menBackCapture && dr !== -side) continue;

      if (isKing) {
        // Fern-Dame: ueber beliebig viele leere Felder, dann genau ein Gegner
        var rr = r + dr, cc = c + dc;
        while (inside(s, rr, cc) && at(s, rr, cc) === 0) { rr += dr; cc += dc; }
        if (!inside(s, rr, cc)) continue;
        var v = at(s, rr, cc);
        if (v === 0 || (v > 0) === (side > 0)) continue;
        if (taken.indexOf(rr * s.n + cc) >= 0) continue;
        // Landefelder hinter dem geschlagenen Stein
        var lr = rr + dr, lc = cc + dc;
        while (inside(s, lr, lc) && at(s, lr, lc) === 0) {
          found = true;
          var t2 = taken.concat([rr * s.n + cc]);
          var p2 = path.concat([lr * s.n + lc]);
          var prev = at(s, r, c);
          set(s, r, c, 0);
          var capVal = at(s, rr, cc);
          set(s, rr, cc, 0);
          set(s, lr, lc, prev);
          var more = captureSeqs(s, lr, lc, side, piece, t2, p2, out);
          set(s, lr, lc, 0);
          set(s, rr, cc, capVal);
          set(s, r, c, prev);
          if (!more) out.push({ from: path[0], path: p2, taken: t2 });
          lr += dr; lc += dc;
        }
      } else {
        var mr = r + dr, mc = c + dc;
        var jr = r + dr * 2, jc = c + dc * 2;
        if (!inside(s, jr, jc)) continue;
        var mv = at(s, mr, mc);
        if (mv === 0 || (mv > 0) === (side > 0)) continue;
        if (taken.indexOf(mr * s.n + mc) >= 0) continue;
        if (at(s, jr, jc) !== 0) continue;
        found = true;
        var t3 = taken.concat([mr * s.n + mc]);
        var p3 = path.concat([jr * s.n + jc]);
        var pv = at(s, r, c);
        set(s, r, c, 0);
        var cv = at(s, mr, mc);
        set(s, mr, mc, 0);
        set(s, jr, jc, pv);
        var more2 = captureSeqs(s, jr, jc, side, piece, t3, p3, out);
        set(s, jr, jc, 0);
        set(s, mr, mc, cv);
        set(s, r, c, pv);
        if (!more2) out.push({ from: path[0], path: p3, taken: t3 });
      }
    }
    return found;
  }

  R.moves = function (s, side) {
    side = side || s.turn;
    var cf = conf(s);
    var caps = [];
    var quiet = [];

    for (var r = 0; r < s.n; r++) {
      for (var c = 0; c < s.n; c++) {
        var v = at(s, r, c);
        if (!v || (v > 0) !== (side > 0)) continue;
        var piece = Math.abs(v);
        captureSeqs(s, r, c, side, piece, [], [r * s.n + c], caps);
      }
    }

    if (caps.length) {
      if (cf.mustMax) {
        var max = 0;
        for (var i = 0; i < caps.length; i++) max = Math.max(max, caps[i].taken.length);
        caps = caps.filter(function (m) { return m.taken.length === max; });
      }
      return caps;
    }

    for (r = 0; r < s.n; r++) {
      for (c = 0; c < s.n; c++) {
        var v2 = at(s, r, c);
        if (!v2 || (v2 > 0) !== (side > 0)) continue;
        var isKing = Math.abs(v2) === KING;
        for (var d = 0; d < 4; d++) {
          var dr = DIAG[d][0], dc = DIAG[d][1];
          if (!isKing && dr !== -side) continue;
          if (isKing) {
            var rr = r + dr, cc = c + dc;
            while (inside(s, rr, cc) && at(s, rr, cc) === 0) {
              quiet.push({ from: r * s.n + c, path: [r * s.n + c, rr * s.n + cc], taken: [] });
              rr += dr; cc += dc;
            }
          } else {
            var nr = r + dr, nc = c + dc;
            if (inside(s, nr, nc) && at(s, nr, nc) === 0) {
              quiet.push({ from: r * s.n + c, path: [r * s.n + c, nr * s.n + nc], taken: [] });
            }
          }
        }
      }
    }
    return quiet;
  };

  R.make = function (s, m) {
    var from = m.path[0];
    var to = m.path[m.path.length - 1];
    var piece = s.b[from];
    var side = piece > 0 ? 1 : -1;
    var undo = { m: m, piece: piece, captured: [], promoted: false, noProgress: s.noProgress };

    s.b[from] = 0;
    for (var i = 0; i < m.taken.length; i++) {
      undo.captured.push({ sq: m.taken[i], v: s.b[m.taken[i]] });
      s.b[m.taken[i]] = 0;
    }
    var lastRow = Math.floor(to / s.n);
    var promoteRow = side > 0 ? 0 : s.n - 1;
    if (Math.abs(piece) === MAN && lastRow === promoteRow) {
      s.b[to] = side * KING;
      undo.promoted = true;
    } else {
      s.b[to] = piece;
    }
    s.noProgress = (m.taken.length || Math.abs(piece) === MAN) ? 0 : s.noProgress + 1;
    s.turn = -side;
    s.hist.push(undo);
    return undo;
  };

  R.unmake = function (s) {
    var undo = s.hist.pop();
    if (!undo) return;
    var m = undo.m;
    var from = m.path[0];
    var to = m.path[m.path.length - 1];
    s.b[to] = 0;
    s.b[from] = undo.piece;
    for (var i = 0; i < undo.captured.length; i++) {
      s.b[undo.captured[i].sq] = undo.captured[i].v;
    }
    s.noProgress = undo.noProgress;
    s.turn = undo.piece > 0 ? 1 : -1;
  };

  R.status = function (s) {
    var moves = R.moves(s, s.turn);
    if (!moves.length) return s.turn > 0 ? 'schwarz' : 'weiss';   // wer nicht ziehen kann, verliert
    if (s.noProgress >= 50) return 'remis';
    var w = 0, b = 0;
    for (var i = 0; i < s.b.length; i++) {
      if (s.b[i] > 0) w++;
      else if (s.b[i] < 0) b++;
    }
    if (!w) return 'schwarz';
    if (!b) return 'weiss';
    return null;
  };

  R.evaluate = function (s) {
    var score = 0;
    for (var i = 0; i < s.b.length; i++) {
      var v = s.b[i];
      if (!v) continue;
      var r = Math.floor(i / s.n), c = i % s.n;
      var side = v > 0 ? 1 : -1;
      var val = Math.abs(v) === KING ? 320 : 100;
      // Vorruecken belohnen, Randfelder sind sicher
      if (Math.abs(v) === MAN) {
        var adv = side > 0 ? (s.n - 1 - r) : r;
        val += adv * 6;
      }
      if (c === 0 || c === s.n - 1) val += 8;
      if (r === 0 || r === s.n - 1) val += 5;
      score += side * val;
    }
    return score;
  };

  function negamax(s, depth, alpha, beta, ctx) {
    ctx.nodes++;
    if (ctx.nodes > ctx.maxNodes) { ctx.stop = true; return alpha; }
    var moves = R.moves(s, s.turn);
    if (!moves.length) return -20000 + ctx.rootDepth - depth;
    if (depth <= 0) {
      // Ruhesuche: bei offenen Schlagfolgen weiterrechnen
      if (moves[0].taken.length === 0 || depth < -3) return R.evaluate(s) * s.turn;
    }
    // Schlagfolgen zuerst
    moves.sort(function (a, b) { return b.taken.length - a.taken.length; });
    var best = -Infinity;
    for (var i = 0; i < moves.length; i++) {
      R.make(s, moves[i]);
      var v = -negamax(s, depth - 1, -beta, -alpha, ctx);
      R.unmake(s);
      if (ctx.stop) return alpha;
      if (v > best) best = v;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  R.bestMove = function (s, depth, maxNodes, rng) {
    var moves = R.moves(s, s.turn);
    if (!moves.length) return null;
    if (moves.length === 1) return moves[0];
    var ctx = { nodes: 0, maxNodes: maxNodes || 200000, stop: false, rootDepth: depth };
    moves.sort(function (a, b) { return b.taken.length - a.taken.length; });
    var alpha = -Infinity;
    var best = [moves[0]];
    for (var i = 0; i < moves.length; i++) {
      R.make(s, moves[i]);
      var v = -negamax(s, depth - 1, -Infinity, -alpha, ctx);
      R.unmake(s);
      if (v > alpha + 0.001) { alpha = v; best = [moves[i]]; }
      else if (Math.abs(v - alpha) < 0.001) best.push(moves[i]);
      if (ctx.stop) break;
    }
    return best[rng ? rng.int(best.length) : 0];
  };

  /* ==================================================================
     Spiel
     ================================================================== */

  var LEVELS = [
    { id: 1, name: 'Leicht', depth: 2, nodes: 20000, blunder: 0.3 },
    { id: 2, name: 'Mittel', depth: 4, nodes: 80000, blunder: 0.1 },
    { id: 3, name: 'Schwer', depth: 6, nodes: 250000, blunder: 0.02 },
    { id: 4, name: 'Meister', depth: 8, nodes: 700000, blunder: 0 },
  ];

  function mount(host) {
    var store = host.store;
    var variant = store.get('variant', 'de');
    var level = store.get('level', 2);

    var st = {
      s: null,
      mode: 'ai',
      mySide: 1,
      sel: -1,
      moves: [],
      partial: null,      // laufende Mehrfachschlagfolge
      lastMove: null,
      over: null,
      thinking: false,
      flip: false,
      anim: null,
      names: ['Weiß', 'Schwarz'],
      captured: [0, 0],
    };
    var room = null, pill = null, aiTimer = null;

    var stage = host.canvas({ alpha: false });
    var ctx = stage.ctx;
    var parts = G.particles(160);

    var sTurn = host.stat('Am Zug', 'Weiß', 'gold');
    var sMode = host.stat('Gegner', '');
    var sLeft = host.stat('Steine', '12 : 12');

    host.tool('↺', function () { undoMove(); });
    host.tool('⇅', function () { st.flip = !st.flip; });
    host.menuTool([
      { icon: '🎮', label: 'Modus wechseln', onClick: chooseMode },
      { icon: '🤖', label: 'Spielstärke', desc: LEVELS[level - 1].name, onClick: chooseLevel },
      { icon: '▦', label: 'Regelwerk', desc: R.VARIANTS[variant].name, onClick: chooseVariant },
      { icon: '♟', label: 'Neue Partie', onClick: newGame },
      { icon: '?', label: 'Anleitung', onClick: function () { help(true); } },
    ]);

    function newGame() {
      if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; }
      st.s = R.create(variant);
      st.sel = -1;
      st.moves = [];
      st.partial = null;
      st.lastMove = null;
      st.over = null;
      st.thinking = false;
      st.captured = [0, 0];
      parts.clear();
      host.closeOverlay();
      relayout(stage.w, stage.h);
      syncBar();
      maybeAI();
    }

    function syncBar() {
      var s = st.s;
      if (!s) return;
      sTurn.set(st.over ? st.over.short : (s.turn > 0 ? 'Weiß' : 'Schwarz'));
      sMode.set(st.mode === 'ai' ? LEVELS[level - 1].name
        : st.mode === 'local' ? 'zu zweit' : 'online');
      var w = 0, b = 0;
      for (var i = 0; i < s.b.length; i++) {
        if (s.b[i] > 0) w++;
        else if (s.b[i] < 0) b++;
      }
      sLeft.set(w + ' : ' + b);
    }

    function myTurn() {
      if (st.over || st.thinking) return false;
      if (st.mode === 'local') return true;
      return st.s.turn === st.mySide;
    }

    function doMove(m, fromNet) {
      // Erst ziehen, dann melden - sonst haengt der eigene Zug an der
      // Netzrunde und der Stein bewegt sich sichtbar zu spaet.
      if (!fromNet && st.mode === 'online') {
        room.send({ path: m.path, taken: m.taken });
      }
      applyMove(m);
    }

    function applyMove(m) {
      var s = st.s;
      R.make(s, m);
      st.lastMove = m;
      st.sel = -1;
      st.moves = [];
      st.partial = null;
      if (m.taken.length) {
        host.sfx('hit');
        host.buzz(18);
        var side = s.turn > 0 ? 1 : 0;   // Gegner hat gerade geschlagen
        st.captured[side] += m.taken.length;
        m.taken.forEach(function (sq) {
          var p = sqPos(sq);
          parts.burst(p.x + L.cell / 2, p.y + L.cell / 2, 8, {
            color: ['#c8d4ea', '#8794b1'], speed: 110, life: 0.5, size: 3, g: 240,
          });
        });
      } else host.sfx('place');
      syncBar();
      checkEnd();
      if (!st.over) maybeAI();
    }

    function checkEnd() {
      var res = R.status(st.s);
      if (!res) return;
      var titles = {
        weiss: 'Weiß gewinnt', schwarz: 'Schwarz gewinnt', remis: 'Remis',
      };
      var won = st.mode === 'ai'
        ? (res === (st.mySide > 0 ? 'weiss' : 'schwarz'))
        : res !== 'remis';
      st.over = { short: res === 'remis' ? 'Remis' : 'Ende', res: res, won: won };
      host.sfx(won ? 'win' : 'lose');
      host.after(function () {
        if (!st.over) return;
        host.gameOver({
          won: won,
          title: titles[res],
          sub: res === 'remis' ? '50 Züge ohne Fortschritt'
            : R.VARIANTS[variant].name + ' · ' + st.s.hist.length + ' Züge',
          againLabel: 'Neue Partie',
          onAgain: newGame,
          submit: false,
        });
        if (won && st.mode === 'ai') host.stats('siege', 1);
      }, 700);
    }

    function maybeAI() {
      if (st.mode !== 'ai' || st.over) return;
      if (st.s.turn === st.mySide) return;
      st.thinking = true;
      var lv = LEVELS[level - 1];
      aiTimer = host.after(function () {
        aiTimer = null;
        var rng = U.rng((Date.now() ^ st.s.hist.length * 7919) >>> 0);
        var m;
        if (lv.blunder && rng() < lv.blunder) {
          var all = R.moves(st.s, st.s.turn);
          m = all[rng.int(all.length)];
        } else {
          m = R.bestMove(st.s, lv.depth, lv.nodes, rng);
        }
        st.thinking = false;
        if (m) applyMove(m);
      }, 320 + Math.random() * 300);
    }

    function undoMove() {
      if (st.thinking || !st.s.hist.length) return;
      var n = (st.mode === 'ai' && st.s.turn === st.mySide) ? 2 : 1;
      for (var i = 0; i < n && st.s.hist.length; i++) R.unmake(st.s);
      st.over = null;
      st.sel = -1;
      st.moves = [];
      st.partial = null;
      st.lastMove = null;
      host.closeOverlay();
      host.sfx('click');
      syncBar();
    }

    /* ---------------------------------------------------------- Modus */

    function chooseMode() {
      SG.net.lobby(host, {
        game: 'checkers', seats: 2, title: 'Dame',
        aiLabel: 'Gegen den Computer',
        aiDesc: LEVELS[level - 1].name,
      }).then(function (res) {
        if (!res) return;
        if (room) { room.leave(); room = null; }
        if (pill) { pill.destroy(); pill = null; }
        st.mode = res.mode;
        if (res.mode === 'online') {
          host.keepAwake(true);   // Bildschleife im Onlinespiel nicht bei Fokusverlust anhalten
          room = res.room;
          st.mySide = room.seat === 0 ? 1 : -1;
          st.flip = st.mySide < 0;
          pill = SG.net.pill(host.stage, room);
          room.on('actions', function (fresh) {
            fresh.forEach(function (x) {
              var seatSide = x.seat === 0 ? 1 : -1;
              if (st.s.turn !== seatSide) return;
              var legal = R.moves(st.s, st.s.turn);
              for (var i = 0; i < legal.length; i++) {
                if (legal[i].path.join(',') === x.a.path.join(',')) {
                  applyMove(legal[i]);
                  return;
                }
              }
            });
          });
          room.on('players', function (ps) {
            st.names = [ps[0] ? ps[0].name : 'Weiß', ps[1] ? ps[1].name : 'Schwarz'];
          });
        } else if (res.mode === 'local') {
          st.mySide = 1; st.flip = false;
          st.names = ['Weiß', 'Schwarz'];
        } else {
          st.mySide = 1; st.flip = false;
          st.names = ['Du', 'Computer'];
        }
        newGame();
      });
    }

    function chooseLevel() {
      var body = UI.el('div');
      LEVELS.forEach(function (l) {
        body.appendChild(UI.el('div.item.tap' + (l.id === level ? '.sel' : ''), {
          on: {
            click: function () {
              m.close();
              level = l.id;
              store.set('level', l.id);
              if (st.mode !== 'ai') { st.mode = 'ai'; st.names = ['Du', 'Computer']; }
              newGame();
            },
          },
        }, [
          UI.el('div.thumb', { text: '⛃' }),
          UI.el('div.main', null, [
            UI.el('div.t', { text: l.name }),
            UI.el('div.d', { text: l.depth + ' Halbzüge tief' }),
          ]),
        ]));
      });
      var m = host.modal({ title: 'Spielstärke', body: body });
    }

    function chooseVariant() {
      var body = UI.el('div');
      Object.keys(R.VARIANTS).forEach(function (k) {
        var v = R.VARIANTS[k];
        body.appendChild(UI.el('div.item.tap' + (k === variant ? '.sel' : ''), {
          on: {
            click: function () {
              m.close();
              variant = k;
              store.set('variant', k);
              newGame();
            },
          },
        }, [
          UI.el('div.thumb', { text: v.size + '×' + v.size }),
          UI.el('div.main', null, [
            UI.el('div.t', { text: v.name }),
            UI.el('div.d', {
              text: v.size + '×' + v.size + ' Felder, ' + (v.size * v.rows / 2) + ' Steine je Seite' +
                (v.mustMax ? ' · Mehrheitszwang' : ' · Schlagzwang'),
            }),
          ]),
        ]));
      });
      var m = host.modal({ title: 'Regelwerk', body: body });
    }

    /* ---------------------------------------------------------- Zeichnen */

    var L = { x: 0, y: 0, cell: 50 };

    function relayout(w, h) {
      var s = st.s;
      if (!s) return;
      var pad = 10;
      var size = Math.min(w - pad * 2, h - pad * 2);
      L.cell = Math.floor(size / s.n);
      L.x = Math.round((w - L.cell * s.n) / 2);
      L.y = Math.round((h - L.cell * s.n) / 2);
    }
    stage.onResize = relayout;

    function sqPos(sq) {
      var s = st.s;
      var r = Math.floor(sq / s.n), c = sq % s.n;
      if (st.flip) { r = s.n - 1 - r; c = s.n - 1 - c; }
      return { x: L.x + c * L.cell, y: L.y + r * L.cell };
    }
    function sqAt(x, y) {
      var s = st.s;
      var c = Math.floor((x - L.x) / L.cell);
      var r = Math.floor((y - L.y) / L.cell);
      if (c < 0 || r < 0 || c >= s.n || r >= s.n) return -1;
      if (st.flip) { r = s.n - 1 - r; c = s.n - 1 - c; }
      return r * s.n + c;
    }

    function drawStone(x, y, size, v) {
      var white = v > 0;
      var king = Math.abs(v) === KING;
      var cx = x + size / 2, cy = y + size / 2;
      var r = size * 0.38;
      ctx.save();
      ctx.globalAlpha = 0.3;
      G.circle(ctx, cx, cy + r * 0.16, r, '#000000');
      ctx.globalAlpha = 1;
      var base = white ? '#f2ede0' : '#2a2c34';
      G.circle(ctx, cx, cy, r, base);
      ctx.strokeStyle = white ? '#b9b0a0' : '#12141a';
      ctx.lineWidth = Math.max(1.2, size * 0.03);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, 6.283);
      ctx.stroke();
      G.ring(ctx, cx, cy, r * 0.7, size * 0.035, white ? '#d9d2c2' : '#3b3e49');
      if (king) {
        var kr = r * 0.42;
        G.star(ctx, cx, cy, kr, kr * 0.45, 5, -Math.PI / 2, white ? '#c8971f' : '#f0b429');
      }
      ctx.restore();
    }

    function draw() {
      var w = stage.w, h = stage.h;
      var s = st.s;
      if (!s) return;
      if (!L.cell) relayout(w, h);
      ctx.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0);
      ctx.fillStyle = '#0b0e15';
      ctx.fillRect(0, 0, w, h);

      var c = L.cell;
      G.fillRound(ctx, L.x - 7, L.y - 7, c * s.n + 14, c * s.n + 14, 8, '#2b2016');

      for (var i = 0; i < s.n * s.n; i++) {
        var r = Math.floor(i / s.n), cc = i % s.n;
        var p = sqPos(i);
        var dark = (r + cc) % 2 === 1;
        ctx.fillStyle = dark ? '#6b4a2c' : '#d9c9a8';
        ctx.fillRect(p.x, p.y, c, c);
      }

      // Letzter Zug
      if (st.lastMove) {
        st.lastMove.path.forEach(function (sq) {
          var pp = sqPos(sq);
          ctx.fillStyle = 'rgba(240,180,41,.3)';
          ctx.fillRect(pp.x, pp.y, c, c);
        });
      }

      // Auswahl und Ziele
      if (st.sel >= 0) {
        var sp = sqPos(st.sel);
        ctx.fillStyle = 'rgba(74,163,255,.4)';
        ctx.fillRect(sp.x, sp.y, c, c);
      }
      st.moves.forEach(function (m) {
        var step = st.partial ? st.partial.path.length : 1;
        var target = m.path[step];
        if (target === undefined) return;
        var tp = sqPos(target);
        if (m.taken.length) {
          G.ring(ctx, tp.x + c / 2, tp.y + c / 2, c * 0.4, c * 0.08, 'rgba(255,95,107,.7)');
        } else {
          G.circle(ctx, tp.x + c / 2, tp.y + c / 2, c * 0.15, 'rgba(30,40,60,.45)');
        }
      });

      // Steine
      for (i = 0; i < s.b.length; i++) {
        if (!s.b[i]) continue;
        var q = sqPos(i);
        drawStone(q.x, q.y, c, s.b[i]);
      }

      parts.draw(ctx);

      if (st.thinking) {
        G.fillRound(ctx, w / 2 - 80, 6, 160, 22, 11, 'rgba(11,14,21,.85)');
        G.text(ctx, 'Computer rechnet…', w / 2, 17, {
          size: 12, weight: 650, color: '#c8d4ea', align: 'center', baseline: 'middle',
        });
      }
      // Schlagzwang-Hinweis
      var all = R.moves(s, s.turn);
      if (!st.over && all.length && all[0].taken.length && myTurn()) {
        G.text(ctx, 'Schlagzwang' + (conf(s).mustMax ? ' · längste Folge' : ''),
          w / 2, h - 8, {
          size: 12, weight: 700, color: '#ff9c3f', align: 'center', baseline: 'bottom',
        });
      }
    }

    /* ---------------------------------------------------------- Eingabe */

    var loop = host.loop({
      hz: 30,
      update: function (dt) { parts.update(dt); },
      render: draw,
    });

    function tap(sq) {
      if (!myTurn()) return;
      var s = st.s;

      // Mitten in einer Mehrfachschlagfolge
      if (st.partial) {
        var step = st.partial.path.length;
        var cands = st.moves.filter(function (m) { return m.path[step] === sq; });
        if (!cands.length) {
          // Auswahl abbrechen
          st.partial = null;
          st.sel = -1;
          st.moves = [];
          host.sfx('click');
          return;
        }
        st.partial = { path: st.partial.path.concat([sq]) };
        st.moves = cands;
        var done = cands.filter(function (m) { return m.path.length === st.partial.path.length; });
        if (done.length) { doMove(done[0]); return; }
        host.sfx('tick');
        return;
      }

      var all = R.moves(s, s.turn);
      var from = all.filter(function (m) { return m.path[0] === sq; });
      if (from.length) {
        st.sel = sq;
        st.moves = from;
        st.partial = { path: [sq] };
        host.sfx('tick');
        return;
      }
      // Direkt aufs Ziel getippt
      if (st.sel >= 0) {
        var direct = st.moves.filter(function (m) { return m.path[1] === sq; });
        if (direct.length) {
          if (direct[0].path.length === 2) { doMove(direct[0]); return; }
          st.partial = { path: [st.sel, sq] };
          st.moves = direct;
          host.sfx('tick');
          return;
        }
      }
      st.sel = -1;
      st.moves = [];
      st.partial = null;
    }

    host.input({
      onTap: function (x, y) {
        var q = sqAt(x, y);
        if (q >= 0) tap(q);
      },
    });

    function help(force) {
      SG.tutorial.show({
        id: 'checkers', force: force, parent: host.root, title: 'Dame',
        pages: [{
          kicker: 'Dame', title: 'Schlagen ist Pflicht',
          art: SG.tutorial.art.tap,
          body: [
            { ic: '👆', text: 'Stein antippen, dann auf das Zielfeld. Bei <b>Mehrfachschlägen</b> tippst du die Stationen nacheinander an.' },
            { ic: '⚔', text: '<b>Schlagzwang</b>: wenn du schlagen kannst, musst du. Im internationalen Regelwerk sogar die längste Folge.' },
            { ic: '↩', text: 'Einfache Steine ziehen nur vorwärts, <b>schlagen aber auch rückwärts</b>.' },
            { ic: '★', text: 'Auf der letzten Reihe wird ein Stein zur <b>Dame</b> und zieht danach beliebig weit diagonal.' },
            { ic: '🏁', text: 'Verloren hat, wer keine Steine mehr hat oder nicht mehr ziehen kann.' },
          ],
        }],
      });
    }

    newGame();
    loop.start();
    help(false);

    return {
      state: st,
      destroy: function () {
        if (aiTimer) clearTimeout(aiTimer);
        if (room) room.leave();
        if (pill) pill.destroy();
      },
      selftest: function () {
        // Grundaufstellung
        var s = R.create('de');
        var w = 0, b = 0;
        for (var i = 0; i < s.b.length; i++) {
          if (s.b[i] > 0) w++;
          else if (s.b[i] < 0) b++;
        }
        if (w !== 12 || b !== 12) throw new Error('Aufstellung: ' + w + '/' + b);
        var s10 = R.create('intl');
        var w10 = 0;
        for (i = 0; i < s10.b.length; i++) if (s10.b[i] > 0) w10++;
        if (w10 !== 20) throw new Error('International: ' + w10 + ' Steine');

        // Erste Zuege
        var mv = R.moves(s, 1);
        if (mv.length !== 7) throw new Error('Erster Zug: ' + mv.length + ' Möglichkeiten statt 7');

        // Schlagzwang
        var t = R.create('de');
        t.b.fill(0);
        t.b[5 * 8 + 2] = MAN;                    // Weiss auf c3
        t.b[4 * 8 + 3] = -MAN;                   // Schwarz auf d4
        t.turn = 1;
        var caps = R.moves(t, 1);
        if (!caps.length || !caps[0].taken.length) throw new Error('Schlagzwang greift nicht');
        if (caps.some(function (m) { return !m.taken.length; })) {
          throw new Error('Neben dem Schlag sind stille Züge erlaubt');
        }

        // Doppelschlag
        var d = R.create('de');
        d.b.fill(0);
        d.b[6 * 8 + 1] = MAN;      // b2
        d.b[5 * 8 + 2] = -MAN;     // c3
        d.b[3 * 8 + 4] = -MAN;     // e5
        d.turn = 1;
        var dm = R.moves(d, 1);
        var maxTake = 0;
        dm.forEach(function (m) { maxTake = Math.max(maxTake, m.taken.length); });
        if (maxTake !== 2) throw new Error('Doppelschlag nicht gefunden (max ' + maxTake + ')');

        // Umwandlung zur Dame
        var p = R.create('de');
        p.b.fill(0);
        p.b[1 * 8 + 2] = MAN;
        p.turn = 1;
        var pm = R.moves(p, 1);
        R.make(p, pm[0]);
        var promoted = false;
        for (i = 0; i < p.b.length; i++) if (p.b[i] === KING) promoted = true;
        if (!promoted) throw new Error('Keine Umwandlung zur Dame');

        // Zurücknehmen stellt die Stellung wieder her
        var u = R.create('de');
        var before = Array.prototype.join.call(u.b, ',');
        var um = R.moves(u, 1);
        R.make(u, um[0]);
        R.unmake(u);
        if (Array.prototype.join.call(u.b, ',') !== before) {
          throw new Error('Zurücknehmen verändert das Brett');
        }

        // Ganze Partie zwischen zwei KIs
        var g = R.create('de');
        var guard = 0;
        while (!R.status(g) && guard++ < 220) {
          var m2 = R.bestMove(g, 2, 20000, U.rng(guard));
          if (!m2) break;
          R.make(g, m2);
        }
        if (guard >= 220 && !R.status(g)) {
          // Kein Fehler - lange Partien sind moeglich
        }

        newGame();
        draw();
      },
    };
  }

  SG.register({
    id: 'checkers',
    name: 'Dame',
    category: 'karten',
    online: true,
    desc: 'Deutsch oder international',
    tags: ['dame', 'checkers', 'brett', 'mehrspieler', 'schlagzwang'],
    preview: function (c, w, h) {
      var n = 8;
      var size = Math.min(w, h) * 0.92;
      var cell = size / n;
      var x0 = (w - size) / 2, y0 = (h - size) / 2;
      G.fillRound(c, x0 - 4, y0 - 4, size + 8, size + 8, 5, '#2b2016');
      for (var i = 0; i < n * n; i++) {
        var r = Math.floor(i / n), cc = i % n;
        c.fillStyle = (r + cc) % 2 ? '#6b4a2c' : '#d9c9a8';
        c.fillRect(x0 + cc * cell, y0 + r * cell, cell, cell);
      }
      function stone(r, cc, v) {
        var x = x0 + cc * cell, y = y0 + r * cell;
        var cx = x + cell / 2, cy = y + cell / 2, rad = cell * 0.38;
        c.globalAlpha = .3;
        G.circle(c, cx, cy + rad * .16, rad, '#000');
        c.globalAlpha = 1;
        G.circle(c, cx, cy, rad, v > 0 ? '#f2ede0' : '#2a2c34');
        G.ring(c, cx, cy, rad * .7, cell * .035, v > 0 ? '#d9d2c2' : '#3b3e49');
        if (Math.abs(v) === 2) {
          G.star(c, cx, cy, rad * .42, rad * .19, 5, -Math.PI / 2, v > 0 ? '#c8971f' : '#f0b429');
        }
      }
      [[0, 1, -1], [0, 3, -1], [0, 5, -1], [1, 2, -1], [1, 6, -2],
        [6, 1, 1], [6, 5, 1], [7, 0, 2], [7, 4, 1], [5, 2, 1], [4, 5, -1]].forEach(function (s) {
        stone(s[0], s[1], s[2]);
      });
    },
    mount: mount,
  });
})(SG);
