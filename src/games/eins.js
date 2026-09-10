/* ------------------------------------------------------------------
   Eins

   Kartenspiel für 2 bis 6 Personen: gleiche Farbe oder gleiche Zahl
   ablegen, wer zuerst keine Karte mehr hat, gewinnt die Runde.

   Enthalten sind alle Aktionskarten (Aussetzen, Richtungswechsel,
   Zwei ziehen, Farbwahl, Vier ziehen), die Eins-Ansage mit Strafe und
   wahlweise die Stapelregel, bei der Zieh-Karten weitergereicht werden.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var G = SG.gfx;
  var UI = SG.ui;

  /* ==================================================================
     Regel-Engine
     ================================================================== */

  var R = SG.rules.eins = {};

  var COLORS = ['r', 'g', 'b', 'y'];
  var COLOR_HEX = { r: '#e8404a', g: '#37b05a', b: '#3a7bd5', y: '#f0b429', w: '#2b2f3a' };
  var COLOR_NAME = { r: 'Rot', g: 'Grün', b: 'Blau', y: 'Gelb' };
  R.COLORS = COLORS;
  R.COLOR_HEX = COLOR_HEX;
  R.COLOR_NAME = COLOR_NAME;

  /* Kartentypen: '0'..'9', 'skip', 'rev', 'd2', 'wild', 'wd4' */
  R.deck = function () {
    var out = [];
    var id = 0;
    COLORS.forEach(function (c) {
      out.push({ c: c, t: '0', id: id++ });
      for (var n = 1; n <= 9; n++) {
        out.push({ c: c, t: String(n), id: id++ });
        out.push({ c: c, t: String(n), id: id++ });
      }
      ['skip', 'rev', 'd2'].forEach(function (t) {
        out.push({ c: c, t: t, id: id++ });
        out.push({ c: c, t: t, id: id++ });
      });
    });
    for (var i = 0; i < 4; i++) {
      out.push({ c: 'w', t: 'wild', id: id++ });
      out.push({ c: 'w', t: 'wd4', id: id++ });
    }
    return out;
  };

  R.label = function (card) {
    return {
      skip: '⊘', rev: '⇄', d2: '+2', wild: '★', wd4: '+4',
    }[card.t] || card.t;
  };

  R.cardName = function (card) {
    var t = {
      skip: 'Aussetzen', rev: 'Richtungswechsel', d2: 'Zwei ziehen',
      wild: 'Farbwahl', wd4: 'Vier ziehen',
    }[card.t] || card.t;
    return (card.c === 'w' ? '' : COLOR_NAME[card.c] + ' ') + t;
  };

  R.points = function (card) {
    if (card.t === 'wild' || card.t === 'wd4') return 50;
    if (card.t === 'skip' || card.t === 'rev' || card.t === 'd2') return 20;
    return parseInt(card.t, 10) || 0;
  };

  R.newGame = function (seed, players, opts) {
    opts = opts || {};
    var rng = U.rng(seed >>> 0);
    var deck = rng.shuffle(R.deck());
    var hands = [];
    for (var p = 0; p < players; p++) {
      hands.push(deck.splice(0, 7));
    }
    // Erste Ablagekarte darf keine Aktionskarte sein
    var first = null;
    while (deck.length) {
      var c = deck.shift();
      if (c.c !== 'w' && c.t.length === 1 && !isNaN(parseInt(c.t, 10))) { first = c; break; }
      deck.push(c);
    }
    return {
      seed: seed,
      players: players,
      hands: hands,
      draw: deck,
      pile: [first],
      color: first.c,
      turn: 0,
      dir: 1,
      pending: 0,          // aufgelaufene Zieh-Karten
      pendingType: null,   // 'd2' oder 'wd4'
      said: [],            // wer hat "Eins" gesagt
      over: false,
      winner: -1,
      stacking: opts.stacking !== false,
      log: [],
      lastPlay: null,
    };
  };

  R.playable = function (g, card) {
    var top = g.pile[g.pile.length - 1];
    if (g.pending > 0) {
      if (!g.stacking) return false;
      // Auf +2 darf +2, auf +4 darf +4
      if (g.pendingType === 'd2') return card.t === 'd2' || card.t === 'wd4';
      return card.t === 'wd4';
    }
    if (card.c === 'w') return true;
    if (card.c === g.color) return true;
    if (card.t === top.t && top.c !== 'w') return true;
    return false;
  };

  R.legal = function (g, seat) {
    return g.hands[seat].filter(function (c) { return R.playable(g, c); });
  };

  function refill(g) {
    if (g.draw.length) return;
    // Ablagestapel bis auf die oberste Karte neu mischen
    var top = g.pile.pop();
    var rest = g.pile.splice(0, g.pile.length);
    rest.forEach(function (c) { if (c.c === 'w') c.chosen = null; });
    var rng = U.rng((g.seed + g.pile.length + rest.length * 31) >>> 0);
    g.draw = rng.shuffle(rest);
    g.pile = [top];
  }

  R.drawCards = function (g, seat, n) {
    var got = [];
    for (var i = 0; i < n; i++) {
      refill(g);
      if (!g.draw.length) break;
      var c = g.draw.shift();
      g.hands[seat].push(c);
      got.push(c);
    }
    // Wer zieht, hat nicht mehr eine Karte
    var idx = g.said.indexOf(seat);
    if (idx >= 0 && g.hands[seat].length > 1) g.said.splice(idx, 1);
    return got;
  };

  function advance(g, steps) {
    g.turn = U.mod(g.turn + g.dir * (steps === undefined ? 1 : steps), g.players);
  }

  /* Karte spielen. wildColor nur bei Farbwahl noetig. */
  R.play = function (g, seat, cardId, wildColor) {
    if (g.over || g.turn !== seat) return false;
    var hand = g.hands[seat];
    var idx = -1;
    for (var i = 0; i < hand.length; i++) if (hand[i].id === cardId) { idx = i; break; }
    if (idx < 0) return false;
    var card = hand[idx];
    if (!R.playable(g, card)) return false;

    hand.splice(idx, 1);
    g.pile.push(card);
    g.lastPlay = { seat: seat, card: card };

    if (card.c === 'w') {
      g.color = wildColor && COLORS.indexOf(wildColor) >= 0 ? wildColor : COLORS[0];
      card.chosen = g.color;
    } else {
      g.color = card.c;
    }

    if (!hand.length) {
      g.over = true;
      g.winner = seat;
      return true;
    }

    switch (card.t) {
      case 'skip':
        advance(g, 2);
        g.log.push('Aussetzen');
        break;
      case 'rev':
        if (g.players === 2) { advance(g, 2); }
        else { g.dir = -g.dir; advance(g, 1); }
        g.log.push('Richtungswechsel');
        break;
      case 'd2':
        g.pending += 2;
        g.pendingType = 'd2';
        advance(g, 1);
        break;
      case 'wd4':
        g.pending += 4;
        g.pendingType = 'wd4';
        advance(g, 1);
        break;
      default:
        advance(g, 1);
    }
    return true;
  };

  /* Ziehen (freiwillig oder als Strafe fuer aufgelaufene Zieh-Karten) */
  R.takeTurn = function (g, seat) {
    if (g.over || g.turn !== seat) return null;
    if (g.pending > 0) {
      var got = R.drawCards(g, seat, g.pending);
      g.log.push(g.pending + ' Karten gezogen');
      g.pending = 0;
      g.pendingType = null;
      advance(g, 1);
      return { drawn: got, forced: true };
    }
    var one = R.drawCards(g, seat, 1);
    if (one.length && R.playable(g, one[0])) {
      return { drawn: one, canPlay: one[0] };
    }
    advance(g, 1);
    return { drawn: one };
  };

  R.sayEins = function (g, seat) {
    if (g.said.indexOf(seat) < 0) g.said.push(seat);
  };

  /* Wer eine Karte hat und nichts gesagt hat, zieht zwei */
  R.catchEins = function (g, seat) {
    if (g.hands[seat].length !== 1) return false;
    if (g.said.indexOf(seat) >= 0) return false;
    R.drawCards(g, seat, 2);
    g.log.push('Eins nicht gesagt: zwei Karten');
    return true;
  };

  R.score = function (g) {
    var pts = 0;
    for (var p = 0; p < g.players; p++) {
      if (p === g.winner) continue;
      g.hands[p].forEach(function (c) { pts += R.points(c); });
    }
    return pts;
  };

  /* ---------------------------------------------------------- KI */

  R.aiMove = function (g, seat, rng) {
    var legal = R.legal(g, seat);
    if (!legal.length) return null;

    // Farbe, die man selbst am haeufigsten hat
    function bestColor() {
      var count = { r: 0, g: 0, b: 0, y: 0 };
      g.hands[seat].forEach(function (c) { if (c.c !== 'w') count[c.c]++; });
      var best = COLORS[0];
      COLORS.forEach(function (c) { if (count[c] > count[best]) best = c; });
      return best;
    }

    var nextSeat = U.mod(seat + g.dir, g.players);
    var nextCount = g.hands[nextSeat].length;

    function rank(c) {
      var v = 0;
      if (c.t === 'wd4') v = nextCount <= 2 ? 95 : 20;
      else if (c.t === 'd2') v = nextCount <= 2 ? 90 : 62;
      else if (c.t === 'skip') v = nextCount <= 2 ? 85 : 58;
      else if (c.t === 'rev') v = 55;
      else if (c.t === 'wild') v = 25;
      else v = 40 + parseInt(c.t, 10);
      // Eigene Hauptfarbe behalten
      if (c.c === bestColor()) v += 6;
      return v + rng() * 4;
    }

    var pick = U.maxBy(legal, rank);
    return { card: pick, color: pick.c === 'w' ? bestColor() : null };
  };

  /* ==================================================================
     Spiel
     ================================================================== */

  function mount(host) {
    var store = host.store;
    var playerCount = store.get('players', 4);
    var stacking = store.get('stacking', true);

    var st = {
      g: null,
      mode: 'ai',
      mySeat: 0,
      names: [],
      sel: -1,
      totals: store.get('totals', [0, 0, 0, 0, 0, 0]),
      einsWindow: 0,
      einsSeat: -1,
      anim: null,
      thinking: false,
      t: 0,
    };
    var room = null, pill = null, timer = null;

    var stage = host.canvas({ alpha: false });
    var ctx = stage.ctx;
    var parts = G.particles(200);

    var sTurn = host.stat('Am Zug', '—', 'gold');
    var sColor = host.stat('Farbe', '—');
    var sPending = host.stat('Strafe', '—', 'red');

    var einsBtn = host.tool('Eins!', function () { sayEins(); });
    einsBtn.classList.add('off');
    host.menuTool([
      { icon: '🎮', label: 'Modus wechseln', onClick: chooseMode },
      { icon: '👥', label: 'Spielerzahl', desc: playerCount + ' Spieler', onClick: choosePlayers },
      {
        icon: '⛓', label: 'Stapelregel',
        desc: stacking ? 'An — Zieh-Karten weiterreichen' : 'Aus',
        onClick: function () {
          stacking = !stacking;
          store.set('stacking', stacking);
          host.toast(stacking ? 'Stapelregel an' : 'Stapelregel aus');
          newRound();
        },
      },
      { icon: '🃏', label: 'Neue Runde', onClick: function () { newRound(); } },
      { icon: '📊', label: 'Punkteliste', onClick: showTotals },
      { icon: '?', label: 'Anleitung', onClick: function () { help(true); } },
    ]);

    function defaultNames(n) {
      var pool = ['Du', 'Anna', 'Bert', 'Clara', 'David', 'Emma'];
      var out = [];
      for (var i = 0; i < n; i++) out.push(pool[i]);
      return out;
    }

    function newRound(seed) {
      if (timer) { clearTimeout(timer); timer = null; }
      var s = seed !== undefined ? seed : ((Date.now() ^ (Math.random() * 1e9)) >>> 0);
      st.g = R.newGame(s, playerCount, { stacking: stacking });
      st.sel = -1;
      st.anim = null;
      st.einsWindow = 0;
      st.einsSeat = -1;
      if (!st.names.length || st.names.length !== playerCount) st.names = defaultNames(playerCount);
      host.closeOverlay();
      relayout(stage.w, stage.h);
      syncBar();
      step();
    }

    function syncBar() {
      var g = st.g;
      if (!g) return;
      sTurn.set(g.over ? st.names[g.winner] + ' gewinnt' : st.names[g.turn]);
      sColor.set(g.color === 'w' ? '—' : COLOR_NAME[g.color]);
      sPending.set(g.pending ? '+' + g.pending : '—');
      var mine = g.hands[st.mySeat] || [];
      einsBtn.classList.toggle('off', !(mine.length === 1 && g.said.indexOf(st.mySeat) < 0));
    }

    function isHuman(seat) {
      if (st.mode === 'online') return room && seat < room.players.length;
      return seat === st.mySeat;
    }
    function controlledLocally() {
      return st.mode !== 'online' || (room && room.isHost);
    }

    function step() {
      var g = st.g;
      if (!g || g.over) return;
      if (isHuman(g.turn)) { syncBar(); return; }
      if (!controlledLocally()) return;

      st.thinking = true;
      timer = host.after(function () {
        st.thinking = false;
        var seat = g.turn;
        var rng = U.rng((g.seed + g.pile.length * 131 + seat * 17) >>> 0);

        // Vergessene Eins-Ansage bestrafen
        for (var p = 0; p < g.players; p++) {
          if (p === seat) continue;
          if (g.hands[p].length === 1 && g.said.indexOf(p) < 0 && rng() < 0.55) {
            sendAction({ t: 'catch', seat: p });
            return;
          }
        }

        var mv = R.aiMove(g, seat, rng);
        if (mv) {
          if (g.hands[seat].length === 2 && rng() < 0.9) {
            sendAction({ t: 'eins', seat: seat });
          }
          sendAction({ t: 'play', seat: seat, id: mv.card.id, color: mv.color });
        } else {
          sendAction({ t: 'draw', seat: seat });
        }
      }, 420 + Math.random() * 340);
    }

    function sendAction(a) {
      // Erst anwenden, dann melden. Das Relais spiegelt die Aktion
      // zurueck, aber der Netzclient filtert die eigene wieder heraus.
      if (st.mode === 'online') room.send(a);
      applyAction(a);
    }

    function applyAction(a) {
      var g = st.g;
      if (!g) return;
      if (a.t === 'play') {
        var hand = g.hands[a.seat];
        var card = null;
        for (var i = 0; i < hand.length; i++) if (hand[i].id === a.id) card = hand[i];
        if (!card) return;
        var was = hand.length;
        if (!R.play(g, a.seat, a.id, a.color)) { host.sfx('error'); return; }
        host.sfx(card.t === 'wd4' || card.t === 'd2' ? 'alert' : 'card');
        st.sel = -1;
        if (was === 2 && g.said.indexOf(a.seat) < 0) {
          // Fenster fuer die Eins-Ansage
          st.einsWindow = 3;
          st.einsSeat = a.seat;
        }
        if (g.over) { finishRound(); return; }
      } else if (a.t === 'draw') {
        var res = R.takeTurn(g, a.seat);
        host.sfx('deal');
        if (res && res.canPlay && a.seat === st.mySeat) {
          UI.toast('Gezogen: ' + R.cardName(res.canPlay) + ' — du darfst sie legen.', null, 2400);
        } else if (res && res.canPlay && !isHuman(a.seat)) {
          // KI legt die gezogene Karte direkt
          var rng = U.rng((g.seed + g.pile.length * 977) >>> 0);
          var col = res.canPlay.c === 'w' ? COLORS[rng.int(4)] : null;
          R.play(g, a.seat, res.canPlay.id, col);
          if (g.over) { finishRound(); return; }
        }
      } else if (a.t === 'eins') {
        R.sayEins(g, a.seat);
        if (st.einsSeat === a.seat) { st.einsWindow = 0; st.einsSeat = -1; }
        host.sfx('blip');
        UI.toast(st.names[a.seat] + ': Eins!', null, 1400);
      } else if (a.t === 'catch') {
        if (R.catchEins(g, a.seat)) {
          host.sfx('error');
          UI.toast(st.names[a.seat] + ' hat „Eins" vergessen — zwei Karten.', 'bad', 2400);
        }
        st.einsWindow = 0; st.einsSeat = -1;
      }
      syncBar();
      step();
    }

    function sayEins() {
      var g = st.g;
      if (!g || g.hands[st.mySeat].length !== 1) return;
      sendAction({ t: 'eins', seat: st.mySeat });
    }

    function finishRound() {
      var g = st.g;
      var pts = R.score(g);
      st.totals[g.winner] += pts;
      store.set('totals', st.totals);
      host.sfx('win');
      if (g.winner === st.mySeat) host.stats('siege', 1);

      var body = UI.el('div');
      body.appendChild(UI.el('p.small.muted', {
        text: 'Punkte aus den Händen der anderen: ' + pts,
      }));
      for (var i = 0; i < g.players; i++) {
        body.appendChild(UI.el('div.row', {
          style: { justifyContent: 'space-between', fontSize: '13.5px', padding: '3px 0' },
        }, [
          UI.el('span', {
            text: st.names[i] + (i === g.winner ? '  🏆' : '  (' + g.hands[i].length + ' Karten)'),
            style: { color: i === st.mySeat ? 'var(--gold)' : '' },
          }),
          UI.el('span.num', { text: String(st.totals[i]) }),
        ]));
      }

      host.gameOver({
        won: g.winner === st.mySeat,
        title: st.names[g.winner] + ' gewinnt die Runde',
        sub: '+' + pts + ' Punkte',
        extra: body,
        againLabel: 'Nächste Runde',
        onAgain: function () { newRound(); },
        submit: false,
      });
    }

    function showTotals() {
      var body = UI.el('div');
      var rows = [];
      for (var i = 0; i < playerCount; i++) {
        rows.push(UI.el('tr' + (i === st.mySeat ? '.hi' : ''), null, [
          UI.el('td', { text: st.names[i] || ('Spieler ' + (i + 1)) }),
          UI.el('td.num', { text: String(st.totals[i]) }),
        ]));
      }
      body.appendChild(UI.el('table.tbl', null, [
        UI.el('thead', null, [UI.el('tr', null, [
          UI.el('th', { text: 'Spieler' }), UI.el('th.num', { text: 'Punkte' }),
        ])]),
        UI.el('tbody', null, rows),
      ]));
      body.appendChild(UI.btn('Zurücksetzen', function () {
        st.totals = [0, 0, 0, 0, 0, 0];
        store.set('totals', st.totals);
        UI.toast('Punkte zurückgesetzt.');
      }, 'sm ghost wide'));
      host.modal({ title: 'Punkteliste', body: body });
    }

    /* ---------------------------------------------------------- Modus */

    function chooseMode() {
      SG.net.lobby(host, {
        game: 'eins', seats: playerCount, title: 'Eins',
        modes: ['ai', 'online'],
        aiLabel: 'Gegen den Computer',
        aiDesc: (playerCount - 1) + ' Mitspieler.',
        autoStart: false,
      }).then(function (res) {
        if (!res) return;
        if (room) { room.leave(); room = null; }
        if (pill) { pill.destroy(); pill = null; }
        st.mode = res.mode;
        if (res.mode === 'online') {
          host.keepAwake(true);   // Bildschleife im Onlinespiel nicht bei Fokusverlust anhalten
          room = res.room;
          st.mySeat = room.seat;
          pill = SG.net.pill(host.stage, room);
          setNames();
          room.on('players', setNames);
          room.on('actions', function (fresh) {
            fresh.forEach(function (x) {
              if (x.a.t === 'round') newRound(x.a.seed);
              else applyAction(x.a);
            });
          });
          if (room.isHost) {
            var seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
            room.send({ t: 'round', seed: seed });
            // Der Host wartet nicht auf sein eigenes Echo - das wird
            // im Netzclient als eigene Aktion herausgefiltert.
            newRound(seed);
          }
        } else {
          st.mySeat = 0;
          st.names = defaultNames(playerCount);
          newRound();
        }
      });

      function setNames() {
        var ps = room.players;
        st.names = [];
        for (var i = 0; i < playerCount; i++) {
          st.names.push(ps[i] ? ps[i].name : 'Computer ' + (i + 1));
        }
        syncBar();
      }
    }

    function choosePlayers() {
      var body = UI.el('div');
      [2, 3, 4, 5, 6].forEach(function (n) {
        body.appendChild(UI.el('div.item.tap' + (n === playerCount ? '.sel' : ''), {
          on: {
            click: function () {
              m.close();
              playerCount = n;
              store.set('players', n);
              st.names = defaultNames(n);
              newRound();
            },
          },
        }, [
          UI.el('div.thumb', { text: String(n) }),
          UI.el('div.main', null, [
            UI.el('div.t', { text: n + ' Spieler' }),
            UI.el('div.d', { text: n === 2 ? 'Richtungswechsel wirkt wie Aussetzen.' : (n - 1) + ' Mitspieler' }),
          ]),
        ]));
      });
      var m = host.modal({ title: 'Spielerzahl', body: body });
    }

    /* ---------------------------------------------------------- Zeichnen */

    var L = { cw: 54, ch: 78, handY: 0 };

    function relayout(w, h) {
      L.cw = U.clamp(Math.min(w / 11, h / 7), 34, 72);
      L.ch = L.cw * 1.45;
      L.handY = h - L.ch - 10;
    }
    stage.onResize = relayout;

    function handRects() {
      var g = st.g;
      if (!g) return [];
      var hand = g.hands[st.mySeat] || [];
      var n = hand.length;
      if (!n) return [];
      var maxW = stage.w - 16;
      var step = Math.min(L.cw + 6, maxW / n);
      var total = step * (n - 1) + L.cw;
      var x0 = (stage.w - total) / 2;
      var out = [];
      for (var i = 0; i < n; i++) {
        out.push({ card: hand[i], x: x0 + i * step, y: L.handY, w: L.cw, h: L.ch, i: i });
      }
      return out;
    }

    function drawCard(x, y, w, h, card, dim) {
      var col = card.c === 'w' ? '#2b2f3a' : COLOR_HEX[card.c];
      var r = w * 0.12;
      G.fillRound(ctx, x, y, w, h, r, '#f4f2ec');
      G.fillRound(ctx, x + w * 0.06, y + h * 0.05, w * 0.88, h * 0.9, r * 0.8, col);
      // Ellipse in der Mitte
      ctx.save();
      ctx.translate(x + w / 2, y + h / 2);
      ctx.rotate(-0.5);
      ctx.fillStyle = 'rgba(255,255,255,.92)';
      ctx.beginPath();
      ctx.ellipse(0, 0, w * 0.36, h * 0.29, 0, 0, 6.283);
      ctx.fill();
      ctx.restore();

      var lbl = R.label(card);
      var col2 = card.c === 'w' ? '#2b2f3a' : col;
      if (card.t === 'wild' || card.t === 'wd4') {
        // Vier Farbfelder
        var q = w * 0.14;
        var cx = x + w / 2, cy = y + h / 2;
        ctx.fillStyle = COLOR_HEX.r; ctx.fillRect(cx - q, cy - q, q, q);
        ctx.fillStyle = COLOR_HEX.g; ctx.fillRect(cx, cy - q, q, q);
        ctx.fillStyle = COLOR_HEX.b; ctx.fillRect(cx - q, cy, q, q);
        ctx.fillStyle = COLOR_HEX.y; ctx.fillRect(cx, cy, q, q);
        if (card.t === 'wd4') {
          G.text(ctx, '+4', cx, cy + h * 0.30, {
            size: w * 0.3, weight: 800, color: '#fff', align: 'center', baseline: 'middle',
            shadow: 'rgba(0,0,0,.6)', sy: 1,
          });
        }
      } else {
        G.text(ctx, lbl, x + w / 2, y + h / 2, {
          size: w * (lbl.length > 1 ? 0.4 : 0.52), weight: 800, color: col2,
          align: 'center', baseline: 'middle',
        });
      }
      G.text(ctx, lbl, x + w * 0.14, y + h * 0.18, {
        size: w * 0.22, weight: 800, color: '#fff', align: 'center', baseline: 'middle',
      });
      G.text(ctx, lbl, x + w * 0.86, y + h * 0.82, {
        size: w * 0.22, weight: 800, color: '#fff', align: 'center', baseline: 'middle',
      });
      if (dim) {
        ctx.fillStyle = 'rgba(8,10,16,.55)';
        G.roundRect(ctx, x, y, w, h, r);
        ctx.fill();
      }
    }

    function drawBack(x, y, w, h) {
      var r = w * 0.12;
      G.fillRound(ctx, x, y, w, h, r, '#f4f2ec');
      G.fillRound(ctx, x + w * 0.06, y + h * 0.05, w * 0.88, h * 0.9, r * 0.8, '#2b2f3a');
      ctx.save();
      ctx.translate(x + w / 2, y + h / 2);
      ctx.rotate(-0.5);
      ctx.fillStyle = '#e8404a';
      ctx.beginPath();
      ctx.ellipse(0, 0, w * 0.36, h * 0.28, 0, 0, 6.283);
      ctx.fill();
      ctx.restore();
      G.text(ctx, 'Eins', x + w / 2, y + h / 2, {
        size: w * 0.26, weight: 800, color: '#fff', align: 'center', baseline: 'middle',
      });
    }

    function seatPos(seat) {
      var g = st.g;
      var rel = U.mod(seat - st.mySeat, g.players);
      var w = stage.w, h = L.handY;
      if (rel === 0) return { x: w / 2, y: h - 10 };
      var slots = g.players - 1;
      var frac = (rel - 0.5) / slots;
      // Halbkreis oben
      var ang = Math.PI * (1 - frac);
      var rx = w * 0.38, ry = h * 0.34;
      return { x: w / 2 - Math.cos(ang) * rx, y: h * 0.42 - Math.sin(ang) * ry };
    }

    function draw() {
      var w = stage.w, h = stage.h;
      var g = st.g;
      if (!L.handY) relayout(w, h);
      ctx.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0);
      ctx.fillStyle = '#141a2a';
      ctx.fillRect(0, 0, w, h);
      if (!g) return;

      // Farbring in der aktuellen Farbe
      var midX = w / 2, midY = L.handY * 0.5;
      if (g.color !== 'w') {
        G.glow(ctx, midX, midY, L.cw * 3, COLOR_HEX[g.color], 0.22);
      }

      // Nachziehstapel
      var dx = midX - L.cw * 1.25, dy = midY - L.ch / 2;
      drawBack(dx, dy, L.cw, L.ch);
      G.text(ctx, String(g.draw.length), dx + L.cw / 2, dy + L.ch + 12, {
        size: 11, weight: 700, color: '#8794b1', align: 'center',
      });

      // Ablagestapel
      var px = midX + L.cw * 0.25, py = midY - L.ch / 2;
      var showCount = Math.min(3, g.pile.length);
      for (var i = g.pile.length - showCount; i < g.pile.length; i++) {
        var off = (g.pile.length - 1 - i) * 3;
        var card = g.pile[i];
        drawCard(px - off, py - off, L.cw, L.ch, card, false);
      }
      // Gewaehlte Farbe markieren
      var top = g.pile[g.pile.length - 1];
      if (top.c === 'w' && g.color !== 'w') {
        G.circle(ctx, px + L.cw / 2, py + L.ch + 12, 8, COLOR_HEX[g.color]);
      }

      // Strafe
      if (g.pending > 0) {
        G.fillRound(ctx, midX - 50, midY + L.ch * 0.62, 100, 26, 13, 'rgba(232,64,74,.9)');
        G.text(ctx, '+' + g.pending + ' zu ziehen', midX, midY + L.ch * 0.62 + 13, {
          size: 12.5, weight: 800, color: '#fff', align: 'center', baseline: 'middle',
        });
      }

      // Mitspieler
      for (var seat = 0; seat < g.players; seat++) {
        if (seat === st.mySeat) continue;
        var p = seatPos(seat);
        var isTurn = g.turn === seat && !g.over;
        var bw = 104, bh = 44;
        G.fillRound(ctx, p.x - bw / 2, p.y - bh / 2, bw, bh, 10,
          isTurn ? 'rgba(240,180,41,.22)' : 'rgba(11,16,28,.7)');
        if (isTurn) G.strokeRound(ctx, p.x - bw / 2, p.y - bh / 2, bw, bh, 10, '#f0b429', 2);
        G.text(ctx, st.names[seat] || ('Spieler ' + (seat + 1)), p.x, p.y - 6, {
          size: 12.5, weight: 700, color: '#e9edf6', align: 'center', baseline: 'middle',
        });
        var cnt = g.hands[seat].length;
        var said = g.said.indexOf(seat) >= 0;
        G.text(ctx, cnt + ' ' + U.plural(cnt, 'Karte', 'Karten') + (cnt === 1 && said ? ' · Eins!' : ''),
          p.x, p.y + 11, {
          size: 10.5, color: cnt === 1 ? '#ff9c3f' : '#9fb3a6', align: 'center', baseline: 'middle',
        });
      }

      // Richtungspfeil
      G.text(ctx, g.dir > 0 ? '↻' : '↺', midX, midY - L.ch * 0.75, {
        size: 22, color: 'rgba(255,255,255,.35)', align: 'center', baseline: 'middle',
      });

      // Eigene Hand
      var rects = handRects();
      for (i = 0; i < rects.length; i++) {
        var rc = rects[i];
        var ok = R.playable(g, rc.card) && g.turn === st.mySeat && !g.over;
        var lift = st.sel === i ? 16 : 0;
        drawCard(rc.x, rc.y - lift, rc.w, rc.h, rc.card, !ok);
        if (st.sel === i) {
          G.strokeRound(ctx, rc.x - 2, rc.y - lift - 2, rc.w + 4, rc.h + 4, rc.w * 0.12, '#ffd166', 2.5);
        }
      }

      // Hinweiszeile
      var hint;
      if (g.over) hint = st.names[g.winner] + ' hat gewonnen';
      else if (g.turn === st.mySeat) {
        hint = g.pending > 0
          ? 'Du musst ' + g.pending + ' ziehen — oder ' + (g.stacking ? 'weiterreichen' : 'ziehen')
          : (R.legal(g, st.mySeat).length ? 'Karte antippen, dann noch einmal zum Ablegen'
            : 'Keine passende Karte — tippe auf den Nachziehstapel');
      } else hint = st.names[g.turn] + ' ist dran…';
      G.text(ctx, hint, w / 2, L.handY - 12, {
        size: 12.5, weight: 600, color: '#9fb3a6', align: 'center', baseline: 'middle',
      });

      // Eins-Fenster
      if (st.einsWindow > 0 && st.einsSeat === st.mySeat) {
        var frac = st.einsWindow / 3;
        G.fillRound(ctx, w / 2 - 70, 8, 140, 26, 13, 'rgba(255,156,63,.92)');
        G.text(ctx, 'Sag „Eins!"', w / 2, 21, {
          size: 13, weight: 800, color: '#241a04', align: 'center', baseline: 'middle',
        });
        G.progress(ctx, w / 2 - 60, 36, 120, 4, frac, '#ff9c3f', 'rgba(255,255,255,.15)');
      }

      parts.draw(ctx);
    }

    /* ---------------------------------------------------------- Schleife */

    var loop = host.loop({
      hz: 30,
      update: function (dt) {
        st.t += dt;
        parts.update(dt);
        if (st.einsWindow > 0) {
          st.einsWindow -= dt;
          if (st.einsWindow <= 0 && st.einsSeat >= 0) {
            var seat = st.einsSeat;
            st.einsSeat = -1;
            if (controlledLocally()) sendAction({ t: 'catch', seat: seat });
          }
        }
      },
      render: draw,
    });

    host.input({
      onTap: function (x, y) {
        var g = st.g;
        if (!g || g.over || g.turn !== st.mySeat) return;

        // Nachziehstapel
        var midX = stage.w / 2, midY = L.handY * 0.5;
        var dx = midX - L.cw * 1.25, dy = midY - L.ch / 2;
        if (U.inRect(x, y, dx, dy, L.cw, L.ch)) {
          sendAction({ t: 'draw', seat: st.mySeat });
          return;
        }

        var rects = handRects();
        for (var i = rects.length - 1; i >= 0; i--) {
          var r = rects[i];
          if (U.inRect(x, y, r.x, r.y - (st.sel === i ? 16 : 0), r.w, r.h + 16)) {
            if (!R.playable(g, r.card)) {
              host.sfx('error');
              UI.toast('Diese Karte passt nicht.', 'bad', 1300);
              return;
            }
            if (st.sel !== i) { st.sel = i; host.sfx('tick'); return; }
            if (r.card.c === 'w') { askColor(r.card); return; }
            sendAction({ t: 'play', seat: st.mySeat, id: r.card.id, color: null });
            return;
          }
        }
        st.sel = -1;
      },
    });

    function askColor(card) {
      var body = UI.el('div.row', { style: { justifyContent: 'center', gap: '10px' } });
      COLORS.forEach(function (c) {
        body.appendChild(UI.el('button', {
          style: {
            width: '64px', height: '64px', borderRadius: '14px',
            background: COLOR_HEX[c], border: '2px solid rgba(255,255,255,.25)',
            color: '#fff', fontWeight: '700', fontSize: '13px',
          },
          text: COLOR_NAME[c],
          on: {
            click: function () {
              m.close();
              sendAction({ t: 'play', seat: st.mySeat, id: card.id, color: c });
            },
          },
        }));
      });
      var m = host.modal({ title: 'Farbe wählen', body: body, closable: false });
    }

    function help(force) {
      SG.tutorial.show({
        id: 'eins', force: force, parent: host.root, title: 'Eins',
        pages: [{
          kicker: 'Eins', title: 'Farbe oder Zahl',
          art: function (c, w, h) {
            var cw = Math.min(44, w / 9), chh = cw * 1.45;
            var demo = [{ c: 'r', t: '7' }, { c: 'b', t: '7' }, { c: 'b', t: 'd2' }, { c: 'w', t: 'wd4' }];
            var x0 = w / 2 - (demo.length * (cw + 6)) / 2;
            demo.forEach(function (d, i) {
              var x = x0 + i * (cw + 6), y = h / 2 - chh / 2;
              var col = d.c === 'w' ? '#2b2f3a' : COLOR_HEX[d.c];
              G.fillRound(c, x, y, cw, chh, cw * 0.12, '#f4f2ec');
              G.fillRound(c, x + cw * 0.06, y + chh * 0.05, cw * 0.88, chh * 0.9, cw * 0.1, col);
              G.text(c, R.label(d), x + cw / 2, y + chh / 2, {
                size: cw * 0.42, weight: 800, color: '#fff', align: 'center', baseline: 'middle',
              });
            });
          },
          body: [
            { ic: '🎨', text: 'Lege eine Karte mit <b>gleicher Farbe</b> oder <b>gleichem Symbol</b> ab.' },
            { ic: '⊘', text: '<b>Aussetzen</b> überspringt den Nächsten, <b>⇄</b> dreht die Richtung, <b>+2</b> und <b>+4</b> lassen ziehen.' },
            { ic: '★', text: 'Die <b>Farbwahl</b> darfst du immer legen und suchst dir die neue Farbe aus.' },
            { ic: '1', text: 'Wenn du noch <b>eine Karte</b> hast, drücke schnell auf „Eins!" — sonst gibt es zwei Strafkarten.' },
            { ic: '⛓', text: 'Mit der <b>Stapelregel</b> (im Menü) darfst du eine +2 mit einer eigenen +2 weiterreichen.' },
          ],
        }],
      });
    }

    newRound();
    loop.start();
    help(false);

    return {
      state: st,
      destroy: function () {
        if (timer) clearTimeout(timer);
        if (room) room.leave();
        if (pill) pill.destroy();
      },
      selftest: function () {
        // Kartensatz
        var d = R.deck();
        if (d.length !== 108) throw new Error('Kartensatz hat ' + d.length + ' Karten');
        var wild = d.filter(function (c) { return c.t === 'wild'; }).length;
        var wd4 = d.filter(function (c) { return c.t === 'wd4'; }).length;
        if (wild !== 4 || wd4 !== 4) throw new Error('Falsche Anzahl Farbwahlkarten');
        var zeros = d.filter(function (c) { return c.t === '0'; }).length;
        if (zeros !== 4) throw new Error('Es muss genau vier Nullen geben');

        // Ablegeregeln
        var g = R.newGame(4711, 4, { stacking: true });
        if (g.pile[0].c === 'w') throw new Error('Erste Karte darf keine Farbwahl sein');
        var top = g.pile[0];
        if (!R.playable(g, { c: top.c, t: '5', id: -1 })) throw new Error('Gleiche Farbe muss gehen');
        if (!R.playable(g, { c: 'w', t: 'wild', id: -2 })) throw new Error('Farbwahl muss immer gehen');

        // Zwei Spieler: Richtungswechsel wirkt wie Aussetzen
        var g2 = R.newGame(99, 2, {});
        g2.hands[0] = [{ c: g2.color, t: 'rev', id: 900 }, { c: g2.color, t: '3', id: 901 }];
        g2.turn = 0;
        R.play(g2, 0, 900, null);
        if (g2.turn !== 0) throw new Error('Richtungswechsel bei zwei Spielern setzt nicht aus');

        // Volle Partien mit KI
        for (var round = 0; round < 40; round++) {
          var gg = R.newGame(20000 + round, 2 + (round % 5), { stacking: round % 2 === 0 });
          var guard = 0;
          while (!gg.over && guard++ < 2000) {
            var rng = U.rng((gg.seed + guard) >>> 0);
            var mv = R.aiMove(gg, gg.turn, rng);
            if (mv) {
              if (!R.play(gg, gg.turn, mv.card.id, mv.color)) {
                throw new Error('KI spielt eine unerlaubte Karte');
              }
            } else {
              R.takeTurn(gg, gg.turn);
            }
            var totalCards = gg.draw.length + gg.pile.length;
            for (var p = 0; p < gg.players; p++) totalCards += gg.hands[p].length;
            if (totalCards !== 108) {
              throw new Error('Karten verloren: ' + totalCards + ' statt 108');
            }
          }
          if (!gg.over) throw new Error('Partie ' + round + ' endet nicht');
          if (gg.hands[gg.winner].length !== 0) throw new Error('Gewinner hat noch Karten');
        }

        newRound(555);
        draw();
      },
    };
  }

  SG.register({
    id: 'eins',
    name: 'Eins',
    category: 'karten',
    online: true,
    desc: '2 bis 6 Spieler, alle Aktionskarten',
    tags: ['uno', 'karten', 'mehrspieler', 'ablegen'],
    preview: function (c, w, h) {
      c.fillStyle = '#141a2a';
      c.fillRect(0, 0, w, h);
      var cw = Math.min(w * 0.17, h * 0.4), chh = cw * 1.45;
      var demo = [{ c: 'r', t: '7' }, { c: 'g', t: 'skip' }, { c: 'b', t: 'd2' },
        { c: 'y', t: '3' }, { c: 'w', t: 'wd4' }];
      var x0 = (w - (demo.length * cw * 0.62 + cw * 0.38)) / 2;
      demo.forEach(function (d, i) {
        var x = x0 + i * cw * 0.62;
        var y = h / 2 - chh / 2 + Math.sin(i * 0.9) * 4;
        var col = d.c === 'w' ? '#2b2f3a' : COLOR_HEX[d.c];
        c.save();
        c.translate(x + cw / 2, y + chh / 2);
        c.rotate((i - 2) * 0.07);
        G.fillRound(c, -cw / 2, -chh / 2, cw, chh, cw * 0.12, '#f4f2ec');
        G.fillRound(c, -cw / 2 + cw * 0.06, -chh / 2 + chh * 0.05, cw * 0.88, chh * 0.9, cw * 0.1, col);
        c.save();
        c.rotate(-0.5);
        c.fillStyle = 'rgba(255,255,255,.9)';
        c.beginPath();
        c.ellipse(0, 0, cw * 0.34, chh * 0.27, 0, 0, 6.283);
        c.fill();
        c.restore();
        G.text(c, R.label(d), 0, 0, {
          size: cw * (R.label(d).length > 1 ? 0.34 : 0.46), weight: 800,
          color: d.c === 'w' ? '#2b2f3a' : col, align: 'center', baseline: 'middle',
        });
        c.restore();
      });
    },
    mount: mount,
  });
})(SG);
