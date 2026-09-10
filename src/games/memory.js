/* ------------------------------------------------------------------
   Memory

   Drei Groessen, allein gegen die eigene Bestzahl oder zu zweit am
   selben iPad. Die Symbole werden gezeichnet, nicht geladen - jedes
   Paar ist eine kleine Figur aus Grundformen.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var G = SG.gfx;
  var UI = SG.ui;

  var SIZES = [
    { id: 'k', name: 'Klein', cols: 4, rows: 3 },
    { id: 'm', name: 'Mittel', cols: 6, rows: 4 },
    { id: 'g', name: 'Groß', cols: 8, rows: 5 },
  ];

  var PALETTE = ['#ff5f6b', '#4aa3ff', '#3ddc84', '#f0b429', '#a97bff',
    '#34d3d3', '#ff9c3f', '#ff7ac8', '#9ad14b', '#c8d4ea',
    '#ff4f9a', '#5ce1e6', '#ffd166', '#8bd450', '#b98cff',
    '#ff8c6b', '#6bd6ff', '#e0e4ee', '#ffb3d1', '#7ee8a2'];

  /* 20 unterscheidbare Symbole aus Grundformen */
  function drawSymbol(c, kind, x, y, s, col) {
    c.save();
    c.translate(x, y);
    c.fillStyle = col;
    c.strokeStyle = col;
    c.lineWidth = Math.max(2, s * 0.13);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    var r = s * 0.5;
    switch (kind % 20) {
      case 0: G.circle(c, 0, 0, r, col); break;
      case 1: c.fillRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6); break;
      case 2: G.ngon(c, 0, 0, r, 3, -Math.PI / 2, col); break;
      case 3: G.star(c, 0, 0, r, r * 0.44, 5, -Math.PI / 2, col); break;
      case 4: G.ngon(c, 0, 0, r, 6, 0, col); break;
      case 5: {
        c.beginPath();
        c.moveTo(0, r * 0.7);
        c.bezierCurveTo(-r * 1.5, -r * 0.4, -r * 0.5, -r * 1.1, 0, -r * 0.35);
        c.bezierCurveTo(r * 0.5, -r * 1.1, r * 1.5, -r * 0.4, 0, r * 0.7);
        c.fill();
        break;
      }
      case 6: {
        c.beginPath();
        for (var i = 0; i < 4; i++) {
          var a = i * Math.PI / 2;
          c.moveTo(0, 0);
          c.arc(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45, r * 0.42, 0, 6.28);
        }
        c.fill();
        break;
      }
      case 7: G.ring(c, 0, 0, r * 0.72, s * 0.18, col); break;
      case 8: {
        c.beginPath();
        c.moveTo(-r, 0); c.lineTo(0, -r); c.lineTo(r, 0); c.lineTo(0, r);
        c.closePath(); c.fill();
        break;
      }
      case 9: {
        c.beginPath();
        c.moveTo(-r * 0.8, -r * 0.8); c.lineTo(r * 0.8, r * 0.8);
        c.moveTo(r * 0.8, -r * 0.8); c.lineTo(-r * 0.8, r * 0.8);
        c.stroke();
        break;
      }
      case 10: {
        c.beginPath();
        c.moveTo(0, -r); c.lineTo(0, r);
        c.moveTo(-r, 0); c.lineTo(r, 0);
        c.stroke();
        break;
      }
      case 11: {
        c.beginPath();
        c.arc(0, 0, r * 0.8, 0.5, Math.PI * 1.6);
        c.stroke();
        G.circle(c, Math.cos(0.5) * r * 0.8, Math.sin(0.5) * r * 0.8, s * 0.1, col);
        break;
      }
      case 12: G.ngon(c, 0, 0, r, 5, -Math.PI / 2, col); break;
      case 13: {
        c.beginPath();
        c.ellipse(0, 0, r, r * 0.5, 0, 0, 6.28);
        c.fill();
        break;
      }
      case 14: {
        // Blitz
        G.poly(c, [-r * 0.2, -r, r * 0.5, -r * 0.1, r * 0.05, -r * 0.1,
          r * 0.25, r, -r * 0.55, r * 0.05, -r * 0.05, r * 0.05], col);
        break;
      }
      case 15: {
        // Mond
        c.beginPath();
        c.arc(0, 0, r, 0.5, -0.5);
        c.arc(r * 0.45, 0, r * 0.85, -0.9, 0.9, true);
        c.closePath();
        c.fill();
        break;
      }
      case 16: {
        for (var q = 0; q < 3; q++) {
          G.circle(c, (q - 1) * r * 0.66, 0, r * 0.28, col);
        }
        break;
      }
      case 17: {
        c.beginPath();
        c.moveTo(-r, r * 0.6);
        c.quadraticCurveTo(0, -r * 1.3, r, r * 0.6);
        c.stroke();
        break;
      }
      case 18: {
        c.fillRect(-r * 0.25, -r, r * 0.5, r * 2);
        c.fillRect(-r, -r * 0.25, r * 2, r * 0.5);
        break;
      }
      default: {
        G.star(c, 0, 0, r, r * 0.7, 8, 0, col);
        break;
      }
    }
    c.restore();
  }

  function mount(host) {
    var store = host.store;
    var sizeId = store.get('size', 'm');
    var players = store.get('players', 1);

    var st = {
      cols: 0, rows: 0,
      cards: [],           // {kind, col, up, done, flip}
      open: [],
      moves: 0, time: 0, running: false,
      turn: 0, points: [0, 0],
      lock: 0,
      done: false,
      t: 0,
    };

    var stage = host.canvas({ alpha: false });
    var ctx = stage.ctx;
    var parts = G.particles(160);

    var sMoves = host.stat('Züge', '0');
    var sTime = host.stat('Zeit', '0:00');
    var sInfo = host.stat('Bestwert', '—', 'gold');

    host.tool('Neu', function () { deal(); });
    host.menuTool([
      { icon: '▦', label: 'Größe wählen', onClick: chooseSize },
      {
        icon: '👥', label: 'Spielerzahl',
        desc: players === 1 ? 'Aktuell: allein' : 'Aktuell: zu zweit',
        onClick: function () {
          players = players === 1 ? 2 : 1;
          store.set('players', players);
          host.toast(players === 1 ? 'Allein' : 'Zu zweit am selben iPad');
          deal();
        },
      },
      { icon: '?', label: 'Anleitung', onClick: function () { help(true); } },
    ]);

    function conf() {
      for (var i = 0; i < SIZES.length; i++) if (SIZES[i].id === sizeId) return SIZES[i];
      return SIZES[1];
    }

    function mode() { return sizeId; }

    function syncBar() {
      sMoves.set(U.num(st.moves));
      sTime.set(U.time(st.time));
      if (players === 2) {
        sInfo.set(st.points[0] + ' : ' + st.points[1]);
      } else {
        var b = host.best(mode());
        sInfo.set(b === null ? '—' : U.num(b) + ' Züge');
      }
    }

    function deal() {
      var c = conf();
      st.cols = c.cols; st.rows = c.rows;
      var total = c.cols * c.rows;
      if (total % 2) total--;
      var pairs = total / 2;
      var kinds = U.range(20);
      U.shuffle(kinds);
      var deck = [];
      for (var i = 0; i < pairs; i++) {
        var k = kinds[i % kinds.length];
        deck.push({ kind: k, col: PALETTE[k % PALETTE.length] });
        deck.push({ kind: k, col: PALETTE[k % PALETTE.length] });
      }
      U.shuffle(deck);
      st.cards = deck.map(function (d) {
        return { kind: d.kind, col: d.col, up: false, done: false, flip: 0, wob: 0 };
      });
      st.open = [];
      st.moves = 0; st.time = 0; st.running = true;
      st.turn = 0; st.points = [0, 0];
      st.lock = 0; st.done = false;
      // Kurz alle Karten zeigen
      st.peek = 1.1;
      parts.clear();
      host.closeOverlay();
      // Titelzeile
      host.setTitle(players === 2 ? 'Memory · Spieler ' + (st.turn + 1) : 'Memory');
      relayout(stage.w, stage.h);
      syncBar();
      loop.resume(true);
    }

    function flip(i) {
      if (st.done || st.lock > 0 || st.peek > 0) return;
      var c = st.cards[i];
      if (!c || c.done || c.up) return;
      c.up = true;
      c.flip = 0.001;
      st.open.push(i);
      host.sfx('card');

      if (st.open.length === 2) {
        st.moves++;
        syncBar();
        var a = st.cards[st.open[0]], b = st.cards[st.open[1]];
        if (a.kind === b.kind) {
          st.lock = 0.35;
          st.matched = true;
        } else {
          st.lock = 0.85;
          st.matched = false;
        }
      }
    }

    function resolveOpen() {
      var a = st.cards[st.open[0]], b = st.cards[st.open[1]];
      if (st.matched) {
        a.done = b.done = true;
        a.wob = b.wob = 0.5;
        st.points[st.turn]++;
        host.sfx('coin');
        host.buzz(20);
        [st.open[0], st.open[1]].forEach(function (i) {
          var p = cardPos(i);
          parts.burst(p.x + L.cw / 2, p.y + L.ch / 2, 9, {
            color: [st.cards[i].col, '#ffffff'], speed: 110, life: 0.5, size: 3, g: 220,
          });
        });
      } else {
        a.up = b.up = false;
        a.flip = b.flip = 0.001;
        host.sfx('click');
        if (players === 2) {
          st.turn = 1 - st.turn;
          host.setTitle('Memory · Spieler ' + (st.turn + 1));
        }
      }
      st.open = [];
      checkDone();
    }

    function checkDone() {
      for (var i = 0; i < st.cards.length; i++) if (!st.cards[i].done) return;
      st.done = true;
      st.running = false;
      host.sfx('win');
      host.stats('geloest', 1);
      if (players === 2) {
        var win = st.points[0] === st.points[1] ? 0 : (st.points[0] > st.points[1] ? 1 : 2);
        host.gameOver({
          won: true,
          title: win === 0 ? 'Unentschieden' : 'Spieler ' + win + ' gewinnt',
          sub: st.points[0] + ' : ' + st.points[1] + ' Paare',
          onAgain: deal,
          submit: false,
        });
      } else {
        host.gameOver({
          won: true,
          title: 'Alle Paare gefunden',
          sub: conf().name + ' · ' + U.time(st.time),
          score: st.moves,
          mode: mode(),
          higher: false,
          scoreLabel: 'Züge',
          onAgain: deal,
        });
      }
    }

    /* ---------------------------------------------------------- Zeichnen */

    var L = { cw: 60, ch: 80, gap: 8, x0: 0, y0: 0 };

    function relayout(w, h) {
      if (!st.cols) return;
      var gap = Math.max(5, Math.min(w, h) * 0.014);
      var cw = (w - gap * (st.cols + 1)) / st.cols;
      var ch = (h - gap * (st.rows + 1)) / st.rows;
      var size = Math.min(cw, ch / 1.28);
      L.cw = size;
      L.ch = size * 1.28;
      L.gap = gap;
      L.x0 = (w - (L.cw * st.cols + gap * (st.cols - 1))) / 2;
      L.y0 = (h - (L.ch * st.rows + gap * (st.rows - 1))) / 2;
    }
    stage.onResize = relayout;

    function cardPos(i) {
      return {
        x: L.x0 + (i % st.cols) * (L.cw + L.gap),
        y: L.y0 + Math.floor(i / st.cols) * (L.ch + L.gap),
      };
    }

    function draw() {
      var w = stage.w, h = stage.h;
      if (!L.x0 && !L.y0) relayout(w, h);
      ctx.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0);
      ctx.fillStyle = '#0b0e15';
      ctx.fillRect(0, 0, w, h);

      for (var i = 0; i < st.cards.length; i++) {
        var c = st.cards[i];
        var p = cardPos(i);
        var showFace = (c.up || c.done || st.peek > 0);

        // Umklappen: horizontal stauchen
        var f = c.flip > 0 ? c.flip : 0;
        var scale = f > 0 ? Math.abs(Math.cos(Math.min(1, f / 0.22) * Math.PI)) : 1;
        var half = f > 0 && f < 0.11;
        if (half) showFace = !showFace;

        var cw = L.cw * scale;
        var x = p.x + (L.cw - cw) / 2;
        var wob = c.wob > 0 ? Math.sin(c.wob * 22) * 3 * c.wob : 0;

        ctx.save();
        ctx.translate(0, wob);
        if (c.done) ctx.globalAlpha = 0.55;

        if (showFace) {
          G.fillRound(ctx, x, p.y, cw, L.ch, L.cw * 0.11, '#f4f6fb');
          G.strokeRound(ctx, x + 0.5, p.y + 0.5, cw - 1, L.ch - 1, L.cw * 0.11, '#c9cfdd', 1);
          if (scale > 0.35) {
            ctx.save();
            ctx.translate(x + cw / 2, p.y + L.ch / 2);
            ctx.scale(scale, 1);
            drawSymbol(ctx, c.kind, 0, 0, L.cw * 0.52, c.col);
            ctx.restore();
          }
          if (c.done) {
            G.strokeRound(ctx, x + 1.5, p.y + 1.5, cw - 3, L.ch - 3, L.cw * 0.11, '#3ddc84', 2);
          }
        } else {
          G.fillRound(ctx, x, p.y, cw, L.ch, L.cw * 0.11, '#22304f');
          G.strokeRound(ctx, x + 0.5, p.y + 0.5, cw - 1, L.ch - 1, L.cw * 0.11, '#33456e', 1.5);
          if (scale > 0.35) {
            ctx.save();
            ctx.translate(x + cw / 2, p.y + L.ch / 2);
            ctx.scale(scale, 1);
            ctx.strokeStyle = 'rgba(255,255,255,.1)';
            ctx.lineWidth = 2;
            for (var q = -3; q <= 3; q++) {
              ctx.beginPath();
              ctx.moveTo(q * L.cw * 0.22 - L.ch * 0.3, -L.ch / 2 + 4);
              ctx.lineTo(q * L.cw * 0.22 + L.ch * 0.3, L.ch / 2 - 4);
              ctx.stroke();
            }
            G.circle(ctx, 0, 0, L.cw * 0.16, 'rgba(240,180,41,.35)');
            ctx.restore();
          }
        }
        ctx.restore();
        ctx.globalAlpha = 1;
      }

      parts.draw(ctx);

      if (players === 2 && !st.done) {
        var txt = 'Spieler ' + (st.turn + 1) + ' ist dran';
        G.text(ctx, txt, w / 2, h - 10, {
          size: 14, weight: 700, color: st.turn === 0 ? '#4aa3ff' : '#ff9c3f',
          align: 'center', baseline: 'bottom',
        });
      }
      if (st.peek > 0) {
        G.text(ctx, 'Einprägen…', w / 2, 16, {
          size: 14, weight: 700, color: '#ffd166', align: 'center', baseline: 'top',
        });
      }
    }

    /* ---------------------------------------------------------- Schleife */

    var loop = host.loop({
      hz: 60,
      update: function (dt) {
        st.t += dt;
        parts.update(dt);
        if (st.peek > 0) {
          st.peek -= dt;
          if (st.peek <= 0) st.cards.forEach(function (c) { c.flip = 0.001; });
        }
        if (st.running && !st.done && st.peek <= 0) {
          st.time += dt;
          sTime.set(U.time(st.time));
        }
        for (var i = 0; i < st.cards.length; i++) {
          var c = st.cards[i];
          if (c.flip > 0) { c.flip += dt; if (c.flip > 0.22) c.flip = 0; }
          if (c.wob > 0) c.wob = Math.max(0, c.wob - dt * 1.6);
        }
        if (st.lock > 0) {
          st.lock -= dt;
          if (st.lock <= 0 && st.open.length === 2) resolveOpen();
        }
      },
      render: draw,
    });

    host.input({
      onTap: function (x, y) {
        for (var i = 0; i < st.cards.length; i++) {
          var p = cardPos(i);
          if (U.inRect(x, y, p.x, p.y, L.cw, L.ch)) { flip(i); return; }
        }
      },
    });

    function chooseSize() {
      var body = UI.el('div');
      SIZES.forEach(function (s) {
        var b = host.best(s.id);
        body.appendChild(UI.el('div.item.tap' + (s.id === sizeId ? '.sel' : ''), {
          on: { click: function () { m.close(); sizeId = s.id; store.set('size', s.id); deal(); } },
        }, [
          UI.el('div.thumb', { text: (s.cols * s.rows) / 2 }),
          UI.el('div.main', null, [
            UI.el('div.t', { text: s.name }),
            UI.el('div.d', { text: s.cols + '×' + s.rows + ' Karten · ' + (s.cols * s.rows) / 2 + ' Paare' }),
          ]),
          UI.el('div.side', null, [
            UI.el('div.p', { text: b === null ? '—' : U.num(b) }),
            UI.el('div.s', { text: 'beste Züge' }),
          ]),
        ]));
      });
      var m = host.modal({ title: 'Spielfeld', body: body });
    }

    function help(force) {
      SG.tutorial.show({
        id: 'memory', force: force, parent: host.root, title: 'Memory',
        pages: [{
          kicker: 'Memory', title: 'Paare merken',
          art: SG.tutorial.art.tap,
          body: [
            { ic: '👆', text: 'Zwei Karten <b>antippen</b>. Gleiche Symbole bleiben offen liegen.' },
            { ic: '👀', text: 'Zu Beginn werden alle Karten kurz gezeigt — gut hinschauen.' },
            { ic: '👥', text: 'Im Menü lässt sich auf <b>zwei Spieler</b> umschalten. Wer ein Paar findet, ist noch einmal dran.' },
            { ic: '🏆', text: 'Allein zählt die Zahl der Züge — je weniger, desto besser.' },
          ],
        }],
      });
    }

    deal();
    loop.start();
    help(false);

    return {
      state: st,
      selftest: function () {
        deal();
        relayout(900, 620);
        st.peek = 0;
        // Jede Sorte muss genau zweimal vorkommen
        var counts = {};
        st.cards.forEach(function (c) { counts[c.kind] = (counts[c.kind] || 0) + 1; });
        for (var k in counts) {
          if (counts[k] !== 2) throw new Error('Symbol ' + k + ' kommt ' + counts[k] + '-mal vor');
        }
        // Perfekt durchspielen
        var byKind = {};
        st.cards.forEach(function (c, i) { (byKind[c.kind] || (byKind[c.kind] = [])).push(i); });
        for (k in byKind) {
          flip(byKind[k][0]);
          flip(byKind[k][1]);
          st.lock = 0;
          if (st.open.length === 2) resolveOpen();
        }
        if (!st.done) throw new Error('Spielende nicht erkannt');
        // Symbole muessen alle zeichenbar sein
        var cv = G.newCanvas(60, 60);
        var c2 = cv.getContext('2d');
        for (var i = 0; i < 20; i++) drawSymbol(c2, i, 30, 30, 40, '#fff');
        draw();
      },
    };
  }

  SG.register({
    id: 'memory',
    name: 'Memory',
    category: 'karten',
    desc: 'Allein oder zu zweit am iPad',
    tags: ['paare', 'merken', 'gedaechtnis', 'klassiker'],
    preview: function (c, w, h) {
      c.fillStyle = '#0b0e15';
      c.fillRect(0, 0, w, h);
      var cols = 5, rows = 3;
      var gap = w * 0.02;
      var cw = (w - gap * (cols + 1)) / cols;
      var ch = Math.min(cw * 1.28, (h - gap * (rows + 1)) / rows);
      cw = ch / 1.28;
      var x0 = (w - (cw * cols + gap * (cols - 1))) / 2;
      var y0 = (h - (ch * rows + gap * (rows - 1))) / 2;
      var faces = [-1, 3, -1, -1, 7, -1, -1, 3, -1, -1, 14, -1, -1, -1, 7];
      for (var i = 0; i < cols * rows; i++) {
        var x = x0 + (i % cols) * (cw + gap), y = y0 + Math.floor(i / cols) * (ch + gap);
        if (faces[i] >= 0) {
          G.fillRound(c, x, y, cw, ch, cw * 0.11, '#f4f6fb');
          drawSymbol(c, faces[i], x + cw / 2, y + ch / 2, cw * 0.52, PALETTE[faces[i] % PALETTE.length]);
        } else {
          G.fillRound(c, x, y, cw, ch, cw * 0.11, '#22304f');
          G.strokeRound(c, x + .5, y + .5, cw - 1, ch - 1, cw * 0.11, '#33456e', 1.2);
          G.circle(c, x + cw / 2, y + ch / 2, cw * 0.16, 'rgba(240,180,41,.35)');
        }
      }
    },
    mount: mount,
  });
})(SG);
