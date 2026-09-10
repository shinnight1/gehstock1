/* ------------------------------------------------------------------
   Vier gewinnt

   Gegen den Computer (vier Stufen), zu zweit am selben iPad oder
   online ueber einen Raum-Code.

   Die KI ist eine Alpha-Beta-Suche mit Stellungsbewertung; auf der
   hoechsten Stufe rechnet sie acht Zuege voraus und laesst sich kaum
   noch austricksen.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var G = SG.gfx;
  var UI = SG.ui;

  /* ==================================================================
     Regel-Engine
     ================================================================== */

  var R = SG.rules.connect4 = {};

  R.create = function (w, h) {
    return {
      w: w, h: h,
      cells: new Int8Array(w * h),   // 0 leer, 1 Spieler A, 2 Spieler B
      heights: new Int8Array(w),     // belegte Felder je Spalte
      turn: 1,
      moves: [],
      winner: 0,
      line: null,
    };
  };

  R.canDrop = function (g, col) {
    return col >= 0 && col < g.w && g.heights[col] < g.h;
  };

  R.drop = function (g, col) {
    if (!R.canDrop(g, col) || g.winner) return -1;
    var row = g.h - 1 - g.heights[col];
    g.cells[row * g.w + col] = g.turn;
    g.heights[col]++;
    g.moves.push(col);
    var line = R.lineAt(g, row, col);
    if (line) { g.winner = g.turn; g.line = line; }
    else if (g.moves.length === g.w * g.h) g.winner = 3;   // 3 = unentschieden
    else g.turn = g.turn === 1 ? 2 : 1;
    return row;
  };

  R.undo = function (g) {
    if (!g.moves.length) return;
    var col = g.moves.pop();
    g.heights[col]--;
    var row = g.h - 1 - g.heights[col];
    g.cells[row * g.w + col] = 0;
    g.winner = 0;
    g.line = null;
    g.turn = g.turn === 1 ? 2 : 1;
  };

  var DIRS4 = [[0, 1], [1, 0], [1, 1], [1, -1]];

  R.lineAt = function (g, row, col) {
    var p = g.cells[row * g.w + col];
    if (!p) return null;
    for (var d = 0; d < 4; d++) {
      var dr = DIRS4[d][0], dc = DIRS4[d][1];
      var cells = [[row, col]];
      var k;
      for (k = 1; k < 4; k++) {
        var r = row + dr * k, c = col + dc * k;
        if (r < 0 || c < 0 || r >= g.h || c >= g.w) break;
        if (g.cells[r * g.w + c] !== p) break;
        cells.push([r, c]);
      }
      for (k = 1; k < 4; k++) {
        var r2 = row - dr * k, c2 = col - dc * k;
        if (r2 < 0 || c2 < 0 || r2 >= g.h || c2 >= g.w) break;
        if (g.cells[r2 * g.w + c2] !== p) break;
        cells.push([r2, c2]);
      }
      if (cells.length >= 4) return cells;
    }
    return null;
  };

  /* Stellungsbewertung aus Sicht von Spieler `me` */
  function evaluate(g, me) {
    var opp = me === 1 ? 2 : 1;
    var score = 0;
    var w = g.w, h = g.h;
    // Mittelspalten sind mehr wert
    for (var c = 0; c < w; c++) {
      var dist = Math.abs(c - (w - 1) / 2);
      for (var r = 0; r < h; r++) {
        var v = g.cells[r * w + c];
        if (v === me) score += (3 - dist) * 2;
        else if (v === opp) score -= (3 - dist) * 2;
      }
    }
    // Alle Vierergruppen bewerten
    for (var r2 = 0; r2 < h; r2++) {
      for (var c2 = 0; c2 < w; c2++) {
        for (var d = 0; d < 4; d++) {
          var dr = DIRS4[d][0], dc = DIRS4[d][1];
          var er = r2 + dr * 3, ec = c2 + dc * 3;
          if (er < 0 || ec < 0 || er >= h || ec >= w) continue;
          var mine = 0, theirs = 0;
          for (var k = 0; k < 4; k++) {
            var v2 = g.cells[(r2 + dr * k) * w + (c2 + dc * k)];
            if (v2 === me) mine++;
            else if (v2 === opp) theirs++;
          }
          if (mine && theirs) continue;
          if (mine === 3) score += 60;
          else if (mine === 2) score += 12;
          else if (mine === 1) score += 2;
          else if (theirs === 3) score -= 70;
          else if (theirs === 2) score -= 14;
          else if (theirs === 1) score -= 2;
        }
      }
    }
    return score;
  }

  /* Alpha-Beta mit Zugordnung von der Mitte nach aussen */
  R.bestMove = function (g, depth, me, rng) {
    var order = [];
    for (var c = 0; c < g.w; c++) order.push(c);
    order.sort(function (a, b) {
      return Math.abs(a - (g.w - 1) / 2) - Math.abs(b - (g.w - 1) / 2);
    });

    var best = -Infinity, bestCols = [];
    for (var i = 0; i < order.length; i++) {
      var col = order[i];
      if (!R.canDrop(g, col)) continue;
      R.drop(g, col);
      var v;
      if (g.winner === me) v = 100000;
      else if (g.winner === 3) v = 0;
      else v = -search(g, depth - 1, -Infinity, Infinity, me === 1 ? 2 : 1, me);
      R.undo(g);
      if (v > best + 0.001) { best = v; bestCols = [col]; }
      else if (Math.abs(v - best) < 0.001) bestCols.push(col);
    }
    if (!bestCols.length) return -1;
    return bestCols[rng ? rng.int(bestCols.length) : 0];
  };

  function search(g, depth, alpha, beta, turn, me) {
    if (g.winner === me) return 100000 - g.moves.length;
    if (g.winner && g.winner !== 3) return -100000 + g.moves.length;
    if (g.winner === 3) return 0;
    if (depth <= 0) return evaluate(g, turn === me ? me : (me === 1 ? 2 : 1)) * (turn === me ? 1 : -1);

    var order = [];
    for (var c = 0; c < g.w; c++) order.push(c);
    order.sort(function (a, b) {
      return Math.abs(a - (g.w - 1) / 2) - Math.abs(b - (g.w - 1) / 2);
    });

    var best = -Infinity;
    var any = false;
    for (var i = 0; i < order.length; i++) {
      var col = order[i];
      if (!R.canDrop(g, col)) continue;
      any = true;
      R.drop(g, col);
      var v = -search(g, depth - 1, -beta, -alpha, turn === 1 ? 2 : 1, me);
      R.undo(g);
      if (v > best) best = v;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return any ? best : 0;
  }

  /* ==================================================================
     Spiel
     ================================================================== */

  var VARIANTS = [
    { id: '7x6', name: 'Klassisch', w: 7, h: 6 },
    { id: '8x7', name: 'Groß', w: 8, h: 7 },
  ];
  var LEVELS = [
    { id: 1, name: 'Leicht', depth: 1, blunder: 0.35 },
    { id: 2, name: 'Mittel', depth: 3, blunder: 0.12 },
    { id: 3, name: 'Schwer', depth: 5, blunder: 0.02 },
    { id: 4, name: 'Meister', depth: 7, blunder: 0 },
  ];

  var COL = ['', '#f0b429', '#ff5f6b'];

  function mount(host) {
    var store = host.store;
    var variantId = store.get('variant', '7x6');
    var level = store.get('level', 2);

    var st = {
      g: null,
      mode: 'ai',           // ai | local | online
      mySeat: 0,
      thinking: 0,
      anim: null,           // fallender Stein
      winT: 0,
      hoverCol: -1,
      names: ['Gelb', 'Rot'],
      t: 0,
    };
    var room = null;
    var pill = null;
    var aiTask = null;

    var stage = host.canvas({ alpha: false });
    var ctx = stage.ctx;
    var parts = G.particles(220);

    var sTurn = host.stat('Am Zug', '—', 'gold');
    var sMode = host.stat('Modus', '');
    var sScore = host.stat('Stand', '0 : 0');

    host.tool('Neu', function () { newRound(); });
    host.menuTool([
      { icon: '🎮', label: 'Modus wechseln', onClick: function () { chooseMode(); } },
      { icon: '🤖', label: 'Spielstärke', desc: LEVELS[level - 1].name, onClick: chooseLevel },
      { icon: '▦', label: 'Feldgröße', onClick: chooseVariant },
      { icon: '?', label: 'Anleitung', onClick: function () { help(true); } },
    ]);

    var wins = [0, 0];

    function variant() {
      for (var i = 0; i < VARIANTS.length; i++) if (VARIANTS[i].id === variantId) return VARIANTS[i];
      return VARIANTS[0];
    }

    function syncBar() {
      var g = st.g;
      if (!g) return;
      if (g.winner) {
        sTurn.set(g.winner === 3 ? 'Unentschieden' : st.names[g.winner - 1] + ' gewinnt');
      } else if (st.mode === 'online') {
        sTurn.set(g.turn - 1 === st.mySeat ? 'Du' : st.names[g.turn - 1]);
      } else if (st.mode === 'ai') {
        sTurn.set(g.turn === 1 ? 'Du' : 'Computer');
      } else {
        sTurn.set(st.names[g.turn - 1]);
      }
      sMode.set(st.mode === 'ai' ? 'gegen ' + LEVELS[level - 1].name
        : st.mode === 'local' ? 'zu zweit' : 'online');
      sScore.set(wins[0] + ' : ' + wins[1]);
    }

    /* ---------------------------------------------------------- Ablauf */

    function newRound(starter) {
      var v = variant();
      st.g = R.create(v.w, v.h);
      st.anim = null;
      st.winT = 0;
      st.hoverCol = -1;
      if (aiTask) { clearTimeout(aiTask); aiTask = null; }
      parts.clear();
      host.closeOverlay();
      relayout(stage.w, stage.h);
      syncBar();
      maybeAI();
    }

    function playCol(col, fromNet) {
      var g = st.g;
      if (!g || g.winner || st.anim) return false;
      if (!R.canDrop(g, col)) { host.sfx('error'); return false; }

      if (!fromNet && st.mode === 'online') {
        if (g.turn - 1 !== st.mySeat) { host.sfx('error'); return false; }
        // Sofort fallen lassen, dann verschicken. Auf die Antwort des
        // Relais zu warten hiesse, bei jedem Zug die halbe Netzrunde
        // zuzusehen - der Stein soll unter dem Finger fallen.
        room.send({ col: col });
      }

      var who = g.turn;
      var row = R.drop(g, col);
      st.anim = { col: col, row: row, who: who, t: 0 };
      host.sfx('drop');
      return true;
    }

    function finishDrop() {
      var g = st.g;
      st.anim = null;
      host.sfx('thud');
      host.buzz(12);
      if (g.winner) {
        st.winT = 0;
        if (g.winner !== 3) {
          wins[g.winner - 1]++;
          host.sfx('win');
          if (g.line) {
            g.line.forEach(function (p) {
              var q = cellPos(p[0], p[1]);
              parts.burst(q.x, q.y, 12, {
                color: [COL[g.winner], '#ffffff'], speed: 140, life: 0.7, size: 3.5, g: 260,
              });
            });
          }
        }
        syncBar();
        host.after(showResult, 900);
      } else {
        syncBar();
        maybeAI();
      }
    }

    function showResult() {
      var g = st.g;
      var won = st.mode === 'ai' ? g.winner === 1
        : st.mode === 'online' ? g.winner - 1 === st.mySeat : true;
      host.gameOver({
        won: g.winner !== 3 && won,
        title: g.winner === 3 ? 'Unentschieden'
          : (st.mode === 'ai'
            ? (g.winner === 1 ? 'Du gewinnst!' : 'Der Computer gewinnt')
            : st.names[g.winner - 1] + ' gewinnt'),
        sub: 'Stand ' + wins[0] + ' : ' + wins[1],
        againLabel: 'Nächste Runde',
        onAgain: function () { newRound(); },
        submit: false,
        extra: st.mode === 'ai' && g.winner === 1
          ? UI.el('div.small.muted', { text: 'Gegen ' + LEVELS[level - 1].name, style: { marginBottom: '12px' } })
          : null,
      });
      if (st.mode === 'ai' && g.winner === 1) host.stats('siege', 1);
    }

    function maybeAI() {
      if (st.mode !== 'ai') return;
      var g = st.g;
      if (!g || g.winner || g.turn !== 2) return;
      st.thinking = 1;
      var lv = LEVELS[level - 1];
      // Kurz "nachdenken" lassen, damit es sich nicht wie ein Reflex anfuehlt
      aiTask = host.after(function () {
        aiTask = null;
        var rng = U.rng((Date.now() ^ g.moves.length * 7919) >>> 0);
        var col;
        if (lv.blunder && rng() < lv.blunder) {
          var opts = [];
          for (var c = 0; c < g.w; c++) if (R.canDrop(g, c)) opts.push(c);
          col = opts[rng.int(opts.length)];
        } else {
          col = R.bestMove(g, lv.depth, 2, rng);
        }
        st.thinking = 0;
        if (col >= 0) playCol(col);
      }, 260 + Math.random() * 320);
    }

    /* ---------------------------------------------------------- Modus */

    function chooseMode() {
      SG.net.lobby(host, {
        game: 'connect4', seats: 2,
        title: 'Vier gewinnt',
        aiLabel: 'Gegen den Computer',
        aiDesc: LEVELS[level - 1].name + ' — sofort losspielen.',
      }).then(function (res) {
        if (!res) return;
        setMode(res);
      });
    }

    function setMode(res) {
      if (room) { room.leave(); room = null; }
      if (pill) { pill.destroy(); pill = null; }
      st.mode = res.mode;
      if (res.mode === 'online') {
          host.keepAwake(true);   // Bildschleife im Onlinespiel nicht bei Fokusverlust anhalten
        room = res.room;
        st.mySeat = room.seat;
        st.names = room.players.map(function (p) { return p.name; });
        if (st.names.length < 2) st.names = ['Spieler 1', 'Spieler 2'];
        pill = SG.net.pill(host.stage, room);
        room.on('actions', function (fresh) {
          fresh.forEach(function (a) {
            if (st.g.turn - 1 !== a.seat) return;   // Regelpruefung auch beim Empfaenger
            playCol(a.a.col, true);
          });
        });
        room.on('players', function (ps) {
          st.names = ps.map(function (p) { return p.name; });
          syncBar();
        });
      } else if (res.mode === 'local') {
        st.names = ['Gelb', 'Rot'];
      } else {
        st.names = ['Du', 'Computer'];
      }
      wins = [0, 0];
      newRound();
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
              if (st.mode !== 'ai') { st.mode = 'ai'; st.names = ['Du', 'Computer']; wins = [0, 0]; }
              newRound();
            },
          },
        }, [
          UI.el('div.thumb', { text: '🤖' }),
          UI.el('div.main', null, [
            UI.el('div.t', { text: l.name }),
            UI.el('div.d', { text: l.depth + ' Züge Vorausschau' + (l.blunder ? ' · macht Fehler' : '') }),
          ]),
        ]));
      });
      var m = host.modal({ title: 'Spielstärke', body: body });
    }

    function chooseVariant() {
      var body = UI.el('div');
      VARIANTS.forEach(function (v) {
        body.appendChild(UI.el('div.item.tap' + (v.id === variantId ? '.sel' : ''), {
          on: {
            click: function () {
              m.close();
              variantId = v.id;
              store.set('variant', v.id);
              newRound();
            },
          },
        }, [
          UI.el('div.thumb', { text: v.w + '×' + v.h }),
          UI.el('div.main', null, [
            UI.el('div.t', { text: v.name }),
            UI.el('div.d', { text: v.w + ' Spalten, ' + v.h + ' Reihen' }),
          ]),
        ]));
      });
      var m = host.modal({ title: 'Feldgröße', body: body });
    }

    /* ---------------------------------------------------------- Zeichnen */

    var L = { x: 0, y: 0, cell: 50, top: 0 };

    function relayout(w, h) {
      var g = st.g;
      if (!g) return;
      var pad = 12;
      var topGap = 46;
      L.cell = Math.max(24, Math.floor(Math.min(
        (w - pad * 2) / g.w, (h - pad * 2 - topGap) / g.h)));
      L.x = Math.round((w - L.cell * g.w) / 2);
      L.top = Math.round((h - topGap - L.cell * g.h) / 2) + topGap;
      L.y = L.top;
    }
    stage.onResize = relayout;

    function cellPos(row, col) {
      return { x: L.x + col * L.cell + L.cell / 2, y: L.y + row * L.cell + L.cell / 2 };
    }

    function draw() {
      var w = stage.w, h = stage.h;
      var g = st.g;
      if (!g) return;
      if (!L.cell) relayout(w, h);
      ctx.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0);
      ctx.fillStyle = '#0b0e15';
      ctx.fillRect(0, 0, w, h);

      var c = L.cell, r = c * 0.4;
      var bw = c * g.w, bh = c * g.h;

      // Vorschau des naechsten Steins
      var myTurn = (st.mode === 'ai' && g.turn === 1) ||
        (st.mode === 'local') ||
        (st.mode === 'online' && g.turn - 1 === st.mySeat);
      if (!g.winner && !st.anim && myTurn && st.hoverCol >= 0 && R.canDrop(g, st.hoverCol)) {
        ctx.globalAlpha = 0.55;
        G.circle(ctx, L.x + st.hoverCol * c + c / 2, L.top - c * 0.6, r, COL[g.turn]);
        ctx.globalAlpha = 1;
      }

      // Brett
      G.fillRound(ctx, L.x - 6, L.top - 6, bw + 12, bh + 12, 14, '#1d3a6e');
      G.fillRound(ctx, L.x - 3, L.top - 3, bw + 6, bh + 6, 12, '#25498a');

      for (var row = 0; row < g.h; row++) {
        for (var col = 0; col < g.w; col++) {
          var p = cellPos(row, col);
          var v = g.cells[row * g.w + col];
          if (st.anim && st.anim.col === col && st.anim.row === row) v = 0;
          if (!v) {
            G.circle(ctx, p.x, p.y, r, '#111725');
            ctx.globalAlpha = 0.25;
            G.circle(ctx, p.x, p.y - r * 0.2, r * 0.9, '#000000');
            ctx.globalAlpha = 1;
          } else {
            drawChip(p.x, p.y, r, v);
          }
        }
      }

      // Fallender Stein
      if (st.anim) {
        var a = st.anim;
        var fromY = L.top - c * 0.6;
        var toY = L.y + a.row * c + c / 2;
        var t = U.clamp(a.t / 0.30, 0, 1);
        var yy = U.lerp(fromY, toY, t * t);
        // Kleines Aufprallen
        if (t >= 1) yy = toY;
        drawChip(L.x + a.col * c + c / 2, yy, r, a.who);
      }

      // Siegeslinie
      if (g.line) {
        var pulse = 0.5 + Math.sin(st.t * 6) * 0.5;
        ctx.save();
        ctx.globalAlpha = 0.5 + pulse * 0.5;
        g.line.forEach(function (p2) {
          var q = cellPos(p2[0], p2[1]);
          G.ring(ctx, q.x, q.y, r + 3, 3.5, '#ffffff');
        });
        ctx.restore();
      }

      parts.draw(ctx);

      // Denkanzeige
      if (st.thinking) {
        G.text(ctx, 'Der Computer überlegt…', w / 2, L.top - c * 0.6, {
          size: 14, weight: 650, color: '#8794b1', align: 'center', baseline: 'middle',
        });
      }
    }

    function drawChip(x, y, r, who) {
      var base = COL[who];
      G.circle(ctx, x, y, r, base);
      ctx.globalAlpha = 0.28;
      G.circle(ctx, x - r * 0.25, y - r * 0.28, r * 0.42, '#ffffff');
      ctx.globalAlpha = 0.22;
      G.ring(ctx, x, y, r * 0.72, r * 0.16, '#000000');
      ctx.globalAlpha = 1;
    }

    /* ---------------------------------------------------------- Schleife */

    var loop = host.loop({
      hz: 60,
      update: function (dt) {
        st.t += dt;
        parts.update(dt);
        if (st.anim) {
          st.anim.t += dt;
          if (st.anim.t >= 0.30) finishDrop();
        }
      },
      render: draw,
    });

    function colAt(x) {
      var g = st.g;
      if (!g) return -1;
      var col = Math.floor((x - L.x) / L.cell);
      return (col >= 0 && col < g.w) ? col : -1;
    }

    host.input({
      onTap: function (x, y) {
        var col = colAt(x);
        if (col < 0) return;
        if (st.mode === 'ai' && st.g.turn !== 1) return;
        playCol(col);
      },
      onHover: function (x) { st.hoverCol = colAt(x); },
      onDown: function (p) { st.hoverCol = colAt(p.x); },
      onMove: function (p) { st.hoverCol = colAt(p.x); },
    });

    var keys = host.keys({
      onDown: function (k) {
        if (/^[1-8]$/.test(k)) playCol(parseInt(k, 10) - 1);
      },
    });

    function help(force) {
      SG.tutorial.show({
        id: 'connect4', force: force, parent: host.root, title: 'Vier gewinnt',
        pages: [{
          kicker: 'Vier gewinnt', title: 'Vier in einer Reihe',
          art: SG.tutorial.art.tap,
          body: [
            { ic: '👆', text: 'Auf eine <b>Spalte</b> tippen — der Stein fällt nach unten.' },
            { ic: '4', text: 'Wer zuerst <b>vier gleiche</b> waagerecht, senkrecht oder schräg hat, gewinnt.' },
            { ic: '🤖', text: 'Vier Spielstärken. „Meister" rechnet sieben Züge voraus.' },
            { ic: '🌐', text: 'Über <b>Modus wechseln</b> geht es zu zweit am iPad oder online per Raum-Code.' },
          ],
        }],
      });
    }

    newRound();
    loop.start();
    help(false);
    syncBar();

    return {
      state: st,
      destroy: function () {
        keys.destroy();
        if (aiTask) clearTimeout(aiTask);
        if (room) room.leave();
        if (pill) pill.destroy();
      },
      selftest: function () {
        // Gewinnerkennung
        var g = R.create(7, 6);
        R.drop(g, 0); R.drop(g, 1);
        R.drop(g, 0); R.drop(g, 1);
        R.drop(g, 0); R.drop(g, 1);
        R.drop(g, 0);
        if (g.winner !== 1) throw new Error('Senkrechter Sieg nicht erkannt');
        if (!g.line || g.line.length < 4) throw new Error('Siegeslinie fehlt');

        // Undo muss die Stellung exakt wiederherstellen
        var g2 = R.create(7, 6);
        var before = Array.prototype.slice.call(g2.cells);
        R.drop(g2, 3);
        R.undo(g2);
        for (var i = 0; i < before.length; i++) {
          if (g2.cells[i] !== before[i]) throw new Error('Undo stellt das Brett nicht wieder her');
        }
        if (g2.turn !== 1) throw new Error('Undo dreht den Zug nicht zurück');

        // KI muss einen Sieg in einem Zug finden
        var g3 = R.create(7, 6);
        R.drop(g3, 0); R.drop(g3, 6);
        R.drop(g3, 1); R.drop(g3, 6);
        R.drop(g3, 2); R.drop(g3, 5);
        var mv = R.bestMove(g3, 3, 1, U.rng(1));
        if (mv !== 3) throw new Error('KI findet den Sieg nicht (spielte ' + mv + ')');

        // KI muss einen gegnerischen Sieg verhindern:
        // Spieler 1 hat Spalte 0,1,2 in der untersten Reihe, Spieler 2 ist am Zug.
        var g4 = R.create(7, 6);
        R.drop(g4, 0); R.drop(g4, 6);
        R.drop(g4, 1); R.drop(g4, 6);
        R.drop(g4, 2);
        if (g4.turn !== 2) throw new Error('Testaufbau: Spieler 2 ist nicht am Zug');
        var mv2 = R.bestMove(g4, 4, 2, U.rng(2));
        if (mv2 !== 3) throw new Error('KI blockt den Sieg nicht (spielte ' + mv2 + ')');

        // Volles Brett endet unentschieden oder mit Sieg
        var g5 = R.create(7, 6);
        var rr = U.rng(5);
        var guard = 0;
        while (!g5.winner && guard++ < 100) {
          var opts = [];
          for (var c = 0; c < g5.w; c++) if (R.canDrop(g5, c)) opts.push(c);
          if (!opts.length) break;
          R.drop(g5, opts[rr.int(opts.length)]);
        }
        if (!g5.winner) throw new Error('Partie endet nicht');

        newRound();
        draw();
      },
    };
  }

  SG.register({
    id: 'connect4',
    name: 'Vier gewinnt',
    category: 'karten',
    online: true,
    desc: 'Gegen KI, zu zweit oder online',
    tags: ['vier', 'connect', 'brett', 'mehrspieler'],
    preview: function (c, w, h) {
      c.fillStyle = '#0b0e15';
      c.fillRect(0, 0, w, h);
      var cols = 7, rows = 6;
      var cell = Math.min((w * 0.82) / cols, (h * 0.86) / rows);
      var x0 = (w - cell * cols) / 2, y0 = (h - cell * rows) / 2;
      var r = cell * 0.4;
      G.fillRound(c, x0 - 5, y0 - 5, cell * cols + 10, cell * rows + 10, 10, '#1d3a6e');
      G.fillRound(c, x0 - 2, y0 - 2, cell * cols + 4, cell * rows + 4, 8, '#25498a');
      var board = [
        '.......', '.......', '...2...', '..21...', '.211.2.', '1122121',
      ];
      for (var row = 0; row < rows; row++) {
        for (var col = 0; col < cols; col++) {
          var x = x0 + col * cell + cell / 2, y = y0 + row * cell + cell / 2;
          var ch = board[row][col];
          if (ch === '.') {
            G.circle(c, x, y, r, '#111725');
          } else {
            var base = ch === '1' ? '#f0b429' : '#ff5f6b';
            G.circle(c, x, y, r, base);
            c.globalAlpha = .28;
            G.circle(c, x - r * .25, y - r * .28, r * .42, '#fff');
            c.globalAlpha = 1;
          }
        }
      }
    },
    mount: mount,
  });
})(SG);
