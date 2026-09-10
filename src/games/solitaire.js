/* ------------------------------------------------------------------
   Solitär (Klondike)

   Ziehen mit dem Finger, Doppeltipp schickt eine Karte automatisch
   nach oben. Zieh-1 und Zieh-3, unbegrenztes Zuruecknehmen, und am
   Ende regnet es Karten.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var G = SG.gfx;
  var UI = SG.ui;

  var SUITS = ['c', 'd', 'h', 's'];          // Kreuz, Karo, Herz, Pik
  var SUIT_CH = { c: '♣', d: '♦', h: '♥', s: '♠' };
  var RANK_TXT = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'B', 'D', 'K'];

  function isRed(s) { return s === 'd' || s === 'h'; }

  function mount(host) {
    var store = host.store;
    var drawCount = store.get('draw', 1);

    var st = {
      stock: [], waste: [], found: [[], [], [], []], tab: [[], [], [], [], [], [], []],
      moves: 0, time: 0, running: false, score: 0,
      won: false, winT: 0,
      redeals: 0,
      drag: null,
      confetti: [],
      t: 0,
    };
    var undo = [];

    var stage = host.canvas({ alpha: false });
    var ctx = stage.ctx;
    var parts = G.particles(300);

    var sMoves = host.stat('Züge', '0');
    var sTime = host.stat('Zeit', '0:00');
    var sBest = host.stat('Bestzeit', '—');

    var undoBtn = host.tool('↺', function () { doUndo(); });
    host.tool('⤒', function () { autoAll(); });
    host.menuTool([
      { icon: '🂠', label: 'Neues Spiel', onClick: function () { confirmNew(); } },
      {
        icon: '3', label: 'Zieh-Modus wechseln',
        desc: drawCount === 1 ? 'Aktuell: eine Karte' : 'Aktuell: drei Karten',
        onClick: function () {
          drawCount = drawCount === 1 ? 3 : 1;
          store.set('draw', drawCount);
          host.toast(drawCount === 1 ? 'Zieh-1 (leichter)' : 'Zieh-3 (klassisch)');
          deal();
        },
      },
      { icon: '?', label: 'Anleitung', onClick: function () { help(true); } },
    ]);

    function mode() { return 'draw' + drawCount; }

    function syncBar() {
      sMoves.set(U.num(st.moves));
      sTime.set(U.time(st.time));
      var b = host.best(mode());
      sBest.set(b === null ? '—' : U.time(b));
      undoBtn.classList.toggle('off', !undo.length);
    }

    /* ---------------------------------------------------------- Geben */

    function deal() {
      var deck = [];
      for (var s = 0; s < 4; s++) {
        for (var r = 1; r <= 13; r++) deck.push({ r: r, s: SUITS[s], up: false });
      }
      U.shuffle(deck);

      st.stock = []; st.waste = [];
      st.found = [[], [], [], []];
      st.tab = [[], [], [], [], [], [], []];
      for (var i = 0; i < 7; i++) {
        for (var j = 0; j <= i; j++) {
          var c = deck.pop();
          c.up = (j === i);
          st.tab[i].push(c);
        }
      }
      st.stock = deck;
      st.moves = 0; st.time = 0; st.running = true;
      st.won = false; st.winT = 0; st.redeals = 0;
      st.drag = null;
      undo = [];
      parts.clear();
      host.closeOverlay();
      relayout(stage.w, stage.h);
      syncBar();
      loop.resume(true);
    }

    function confirmNew() {
      if (st.moves < 3) { deal(); return; }
      host.confirm('Neues Blatt?', 'Die aktuelle Partie geht verloren.', 'Neu geben')
        .then(function (ok) { if (ok) deal(); });
    }

    /* ---------------------------------------------------------- Regeln */

    function top(pile) { return pile.length ? pile[pile.length - 1] : null; }

    function canToFoundation(card, f) {
      var t = top(st.found[f]);
      if (!t) return card.r === 1;
      return t.s === card.s && card.r === t.r + 1;
    }

    function foundationFor(card) {
      for (var f = 0; f < 4; f++) if (canToFoundation(card, f)) return f;
      return -1;
    }

    function canToTableau(card, t) {
      var dest = top(st.tab[t]);
      if (!dest) return card.r === 13;
      return dest.up && isRed(dest.s) !== isRed(card.s) && card.r === dest.r - 1;
    }

    /* Ist ab index eine gueltige absteigende Wechselfolge? */
    function runOk(pile, idx) {
      for (var i = idx; i < pile.length; i++) {
        if (!pile[i].up) return false;
        if (i > idx) {
          var a = pile[i - 1], b = pile[i];
          if (b.r !== a.r - 1 || isRed(a.s) === isRed(b.s)) return false;
        }
      }
      return true;
    }

    function pushUndo(rec) {
      undo.push(rec);
      if (undo.length > 400) undo.shift();
    }

    function doUndo() {
      if (!undo.length) return;
      var m = undo.pop();
      if (m.kind === 'move') {
        var take = Math.min(m.n, m.to.length);
        var cards = m.to.splice(m.to.length - take, take);
        for (var i = 0; i < cards.length; i++) m.from.push(cards[i]);
        if (m.flipped) {
          var idx = m.from.length - cards.length - 1;
          if (idx >= 0) m.from[idx].up = false;
        }
        st.score -= m.pts || 0;
      } else if (m.kind === 'draw') {
        for (var q = 0; q < m.n && st.waste.length; q++) {
          var c = st.waste.pop();
          c.up = false;
          st.stock.push(c);
        }
      } else if (m.kind === 'redeal') {
        var n = Math.min(m.n === undefined ? st.stock.length : m.n, st.stock.length);
        for (var r = 0; r < n; r++) {
          var c2 = st.stock.pop();
          c2.up = true;
          st.waste.push(c2);
        }
        st.redeals--;
      }
      st.moves = Math.max(0, st.moves - 1);
      host.sfx('click');
      syncBar();
    }

    function move(from, to, n, pts) {
      var cards = from.splice(from.length - n, n);
      for (var i = 0; i < cards.length; i++) to.push(cards[i]);
      var flipped = false;
      var t = top(from);
      if (t && !t.up) { t.up = true; flipped = true; st.score += 5; }
      pushUndo({ kind: 'move', from: from, to: to, n: n, flipped: flipped, pts: pts || 0 });
      st.moves++;
      st.score += pts || 0;
      syncBar();
      checkWin();
    }

    function drawFromStock() {
      if (!st.stock.length) {
        if (!st.waste.length) return;
        /* Wichtig: die Stapel-Arrays behalten ihre Identität. Wuerden sie
           ausgetauscht, zeigten aeltere Undo-Eintraege ins Leere und
           Karten gingen verloren. */
        pushUndo({ kind: 'redeal', n: st.waste.length });
        while (st.waste.length) {
          var rc = st.waste.pop();
          rc.up = false;
          st.stock.push(rc);
        }
        st.redeals++;
        st.moves++;
        host.sfx('deal');
        syncBar();
        return;
      }
      var n = Math.min(drawCount, st.stock.length);
      for (var i = 0; i < n; i++) {
        var c = st.stock.pop();
        c.up = true;
        st.waste.push(c);
      }
      pushUndo({ kind: 'draw', n: n });
      st.moves++;
      host.sfx('card');
      syncBar();
    }

    /* Schickt automatisch alles nach oben, was passt */
    function autoAll() {
      var moved = 0;
      var guard = 0;
      while (guard++ < 200) {
        var did = false;
        // Aus dem Ablagestapel
        var w = top(st.waste);
        if (w) {
          var f = foundationFor(w);
          if (f >= 0) { move(st.waste, st.found[f], 1, 10); did = true; moved++; }
        }
        for (var i = 0; i < 7 && !did; i++) {
          var c = top(st.tab[i]);
          if (!c || !c.up) continue;
          var f2 = foundationFor(c);
          if (f2 >= 0) { move(st.tab[i], st.found[f2], 1, 10); did = true; moved++; }
        }
        if (!did) break;
      }
      if (moved) host.sfx('clear');
      else host.toast('Nichts zum Ablegen.', null, 1200);
    }

    function checkWin() {
      var n = 0;
      for (var f = 0; f < 4; f++) n += st.found[f].length;
      if (n < 52) return;
      st.won = true;
      st.running = false;
      st.winT = 0;
      host.sfx('win');
      host.stats('gewonnen', 1);
      host.after(function () {
        if (!st.won) return;
        host.gameOver({
          won: true,
          title: 'Ausgelegt!',
          sub: st.moves + ' Züge · ' + (drawCount === 1 ? 'Zieh-1' : 'Zieh-3'),
          score: Math.round(st.time),
          mode: mode(),
          higher: false,
          scoreLabel: 'Zeit',
          format: function (v) { return U.time(v); },
          onAgain: deal,
        });
      }, 2600);
    }

    /* ---------------------------------------------------------- Layout */

    var L = {
      cw: 60, ch: 84, gap: 8, x0: 0, y0: 0, tabY: 0, fan: 22, fanDown: 8,
    };

    function relayout(w, h) {
      var cols = 7;
      var gap = Math.max(5, w * 0.012);
      var cw = Math.min((w - gap * (cols + 1)) / cols, (h - gap * 3) / 3.4);
      cw = Math.max(38, Math.min(cw, 108));
      L.cw = cw;
      L.ch = cw * 1.4;
      L.gap = gap;
      L.x0 = (w - (cw * cols + gap * (cols - 1))) / 2;
      L.y0 = gap + 4;
      L.tabY = L.y0 + L.ch + gap * 2.2;
      L.fan = Math.min(L.ch * 0.30, Math.max(14, (h - L.tabY - L.ch - 10) / 12));
      L.fanDown = L.fan * 0.42;
    }
    stage.onResize = relayout;

    function pileX(i) { return L.x0 + i * (L.cw + L.gap); }

    function cardRect(pile, kind, idx) {
      // Liefert {x,y} fuer Karte idx im Stapel
      if (kind === 'stock') return { x: pileX(0), y: L.y0 };
      if (kind === 'waste') {
        var vis = Math.min(3, st.waste.length);
        var pos = idx - (st.waste.length - vis);
        return { x: pileX(1) + Math.max(0, pos) * L.cw * 0.28, y: L.y0 };
      }
      if (kind === 'found') return { x: pileX(3 + idx), y: L.y0 };
      // Tableau
      var y = L.tabY;
      for (var i = 0; i < idx; i++) y += pile[i].up ? L.fan : L.fanDown;
      return { x: pileX(kind), y: y };
    }

    /* ---------------------------------------------------------- Zeichnen */

    function drawCard(c, x, y, sel) {
      if (!c.up) {
        ctx.drawImage(G.cardBack(L.cw, L.ch, '#1e3a63'), x, y);
        return;
      }
      ctx.drawImage(G.cardFace(L.cw, L.ch, RANK_TXT[c.r], c.s), x, y);
      if (sel) {
        G.strokeRound(ctx, x + 1, y + 1, L.cw - 2, L.ch - 2, L.cw * 0.1, '#f0b429', 2.5);
      }
    }

    function emptySlot(x, y, label) {
      G.strokeRound(ctx, x + 1, y + 1, L.cw - 2, L.ch - 2, L.cw * 0.1, 'rgba(255,255,255,.16)', 1.5);
      if (label) {
        G.text(ctx, label, x + L.cw / 2, y + L.ch / 2, {
          size: L.cw * 0.42, color: 'rgba(255,255,255,.14)', align: 'center', baseline: 'middle',
        });
      }
    }

    function draw() {
      var w = stage.w, h = stage.h;
      if (!L.cw || !L.tabY) relayout(w, h);
      ctx.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0);
      ctx.fillStyle = '#0f2a1c';
      ctx.fillRect(0, 0, w, h);
      // Filzstruktur
      ctx.fillStyle = 'rgba(255,255,255,.02)';
      for (var i = 0; i < h; i += 4) ctx.fillRect(0, i, w, 1);

      // Vorrat
      var sx = pileX(0);
      if (st.stock.length) {
        drawCard({ up: false }, sx, L.y0);
        G.text(ctx, String(st.stock.length), sx + L.cw / 2, L.y0 + L.ch + 11, {
          size: 11, weight: 700, color: '#8794b1', align: 'center',
        });
      } else {
        emptySlot(sx, L.y0, '↻');
      }

      // Ablage
      if (!st.waste.length) emptySlot(pileX(1), L.y0);
      var visStart = Math.max(0, st.waste.length - 3);
      for (i = visStart; i < st.waste.length; i++) {
        var p = cardRect(st.waste, 'waste', i);
        var dragging = st.drag && st.drag.src === st.waste && i >= st.waste.length;
        drawCard(st.waste[i], p.x, p.y);
      }

      // Basen
      for (var f = 0; f < 4; f++) {
        var fx = pileX(3 + f);
        if (!st.found[f].length) emptySlot(fx, L.y0, SUIT_CH[SUITS[f]]);
        else drawCard(st.found[f][st.found[f].length - 1], fx, L.y0);
      }

      // Tableau
      for (var t = 0; t < 7; t++) {
        var pile = st.tab[t];
        if (!pile.length) emptySlot(pileX(t), L.tabY);
        for (i = 0; i < pile.length; i++) {
          var q = cardRect(pile, t, i);
          drawCard(pile[i], q.x, q.y);
        }
      }

      // Gezogener Stapel
      if (st.drag) {
        for (i = 0; i < st.drag.cards.length; i++) {
          drawCard(st.drag.cards[i],
            st.drag.x - L.cw / 2, st.drag.y - L.ch * 0.3 + i * L.fan, false);
        }
      }

      parts.draw(ctx);

      if (st.won) {
        ctx.fillStyle = 'rgba(0,0,0,.35)';
        ctx.fillRect(0, 0, w, h);
        G.text(ctx, 'Geschafft!', w / 2, h * 0.42, {
          size: 40, weight: 800, color: '#ffd166', align: 'center', baseline: 'middle',
          shadow: 'rgba(0,0,0,.5)', sy: 3,
        });
      }
    }

    /* ---------------------------------------------------------- Schleife */

    var loop = host.loop({
      hz: 60,
      update: function (dt) {
        st.t += dt;
        parts.update(dt);
        if (st.running && !st.won) { st.time += dt; sTime.set(U.time(st.time)); }
        if (st.won) {
          st.winT += dt;
          if (st.winT < 2.4 && Math.random() < 0.5) {
            parts.spawn({
              x: Math.random() * stage.w, y: -10,
              vx: (Math.random() - .5) * 60, vy: 90 + Math.random() * 160,
              life: 3.2, size: 5 + Math.random() * 5,
              color: U.pick(['#ff5f6b', '#4aa3ff', '#3ddc84', '#f0b429', '#a97bff']),
              g: 120, kind: 1,
            });
          }
        }
      },
      render: draw,
    });

    /* ---------------------------------------------------------- Eingabe */

    function hitTest(x, y) {
      // Von oben nach unten testen
      for (var t = 6; t >= 0; t--) {
        var pile = st.tab[t];
        for (var i = pile.length - 1; i >= 0; i--) {
          var p = cardRect(pile, t, i);
          var hEff = (i === pile.length - 1) ? L.ch : (pile[i].up ? L.fan : L.fanDown);
          if (U.inRect(x, y, p.x, p.y, L.cw, hEff)) {
            return { kind: 'tab', pile: pile, idx: i, t: t };
          }
        }
      }
      if (st.waste.length) {
        var wp = cardRect(st.waste, 'waste', st.waste.length - 1);
        if (U.inRect(x, y, wp.x, wp.y, L.cw, L.ch)) {
          return { kind: 'waste', pile: st.waste, idx: st.waste.length - 1 };
        }
      }
      for (var f = 0; f < 4; f++) {
        if (U.inRect(x, y, pileX(3 + f), L.y0, L.cw, L.ch)) {
          return { kind: 'found', pile: st.found[f], idx: st.found[f].length - 1, f: f };
        }
      }
      if (U.inRect(x, y, pileX(0), L.y0, L.cw, L.ch)) return { kind: 'stock' };
      return null;
    }

    function dropTarget(x, y) {
      for (var f = 0; f < 4; f++) {
        if (U.inRect(x, y, pileX(3 + f), L.y0, L.cw, L.ch)) return { kind: 'found', f: f };
      }
      for (var t = 0; t < 7; t++) {
        var pile = st.tab[t];
        var bottomY = L.tabY;
        for (var i = 0; i < pile.length; i++) bottomY += pile[i].up ? L.fan : L.fanDown;
        var hEff = Math.max(L.ch, bottomY - L.tabY + L.ch * 0.4);
        if (U.inRect(x, y, pileX(t), L.tabY, L.cw, hEff)) return { kind: 'tab', t: t };
      }
      return null;
    }

    host.input({
      tapMax: 10,
      onDown: function (p) {
        if (st.won) return;
        var hit = hitTest(p.x, p.y);
        if (!hit || hit.kind === 'stock') return;
        if (hit.kind === 'tab') {
          if (!hit.pile[hit.idx].up) return;
          if (!runOk(hit.pile, hit.idx)) return;
          var n = hit.pile.length - hit.idx;
          st.drag = {
            src: hit.pile, cards: hit.pile.splice(hit.idx, n),
            x: p.x, y: p.y, srcKind: 'tab', t: hit.t,
          };
        } else if (hit.kind === 'waste' || hit.kind === 'found') {
          if (!hit.pile.length) return;
          st.drag = {
            src: hit.pile, cards: hit.pile.splice(hit.pile.length - 1, 1),
            x: p.x, y: p.y, srcKind: hit.kind, f: hit.f,
          };
        }
      },
      onMove: function (p) {
        if (st.drag) { st.drag.x = p.x; st.drag.y = p.y; }
      },
      onUp: function (p) {
        if (!st.drag) return;
        var d = st.drag;
        st.drag = null;
        var tgt = dropTarget(p.x, p.y);
        var ok = false;
        if (tgt) {
          if (tgt.kind === 'found' && d.cards.length === 1 && canToFoundation(d.cards[0], tgt.f)) {
            // Karten zuerst zurueck, damit move() sauber protokolliert
            for (var i = 0; i < d.cards.length; i++) d.src.push(d.cards[i]);
            move(d.src, st.found[tgt.f], 1, 10);
            host.sfx('place');
            ok = true;
          } else if (tgt.kind === 'tab' && canToTableau(d.cards[0], tgt.t) && st.tab[tgt.t] !== d.src) {
            for (i = 0; i < d.cards.length; i++) d.src.push(d.cards[i]);
            move(d.src, st.tab[tgt.t], d.cards.length, 3);
            host.sfx('card');
            ok = true;
          }
        }
        if (!ok) {
          for (i = 0; i < d.cards.length; i++) d.src.push(d.cards[i]);
          host.sfx('error');
        }
      },
      onTap: function (x, y) {
        if (st.won) return;
        var hit = hitTest(x, y);
        if (!hit) return;
        if (hit.kind === 'stock') { drawFromStock(); return; }
      },
      onDoubleTap: function (x, y) {
        if (st.won) return;
        var hit = hitTest(x, y);
        if (!hit || hit.kind === 'stock' || !hit.pile.length) return;
        var card = hit.pile[hit.pile.length - 1];
        if (hit.kind === 'tab' && hit.idx !== hit.pile.length - 1) return;
        var f = foundationFor(card);
        if (f >= 0) {
          move(hit.pile, st.found[f], 1, 10);
          host.sfx('place');
        } else host.sfx('error');
      },
    });

    var keys = host.keys({
      onDown: function (k) {
        if (k === 'space') drawFromStock();
        else if (k === 'z' || k === 'u') doUndo();
        else if (k === 'a') autoAll();
      },
    });

    function help(force) {
      SG.tutorial.show({
        id: 'solitaire', force: force, parent: host.root, title: 'Solitär',
        pages: [{
          kicker: 'Solitär', title: 'Vier Stapel von Ass bis König',
          art: SG.tutorial.art.swipe,
          body: [
            { ic: '👆', text: 'Karten mit dem Finger <b>ziehen</b>. Ein <b>Doppeltipp</b> schickt sie automatisch nach oben, wenn sie passen.' },
            { ic: '♠', text: 'Oben rechts wachsen die vier Ablagen: gleiche Farbe, Ass zuerst, dann aufsteigend.' },
            { ic: '♦', text: 'Unten wird <b>abwechselnd rot und schwarz absteigend</b> gelegt. Auf ein leeres Feld darf nur ein <b>König</b>.' },
            { ic: '↻', text: 'Der Vorrat links wird durchgeblättert und darf beliebig oft neu gestartet werden.' },
            { ic: '⤒', text: 'Der Pfeil-Knopf oben räumt in einem Rutsch alles ab, was schon passt.' },
          ],
        }],
      });
    }

    deal();
    loop.start();
    help(false);

    return {
      state: st,
      destroy: function () { keys.destroy(); },
      selftest: function (steps) {
        deal();
        relayout(900, 620);
        // Alle 52 Karten muessen genau einmal vorkommen
        var seen = {};
        var count = 0;
        function scan(p) {
          p.forEach(function (c) {
            var k = c.r + c.s;
            if (seen[k]) throw new Error('Karte doppelt: ' + k);
            seen[k] = 1; count++;
          });
        }
        scan(st.stock); scan(st.waste);
        st.found.forEach(scan);
        st.tab.forEach(scan);
        if (count !== 52) throw new Error('Blatt hat ' + count + ' statt 52 Karten');

        // Zufaellig spielen: Ziehen, Automatik, Tableau-Zuege
        var r = U.rng(2024);
        for (var i = 0; i < (steps || 400); i++) {
          var a = r();
          if (a < 0.35) drawFromStock();
          else if (a < 0.5) autoAll();
          else {
            var from = r.int(7), to = r.int(7);
            var pile = st.tab[from];
            if (from !== to && pile.length) {
              for (var idx = 0; idx < pile.length; idx++) {
                if (pile[idx].up && runOk(pile, idx) && canToTableau(pile[idx], to)) {
                  move(pile, st.tab[to], pile.length - idx, 3);
                  break;
                }
              }
            }
          }
          if (totalCards() !== 52) {
            throw new Error('Nach Zug ' + i + ' sind ' + totalCards() + ' Karten im Spiel');
          }
          if (st.won) break;
        }
        // Zuruecknehmen darf den Kartenbestand nie veraendern
        for (i = 0; i < 60; i++) {
          doUndo();
          if (totalCards() !== 52) {
            throw new Error('Zurücknehmen verliert Karten (' + totalCards() + ')');
          }
        }
        draw();
      },
    };

    function totalCards() {
      var n = st.stock.length + st.waste.length;
      st.found.forEach(function (p) { n += p.length; });
      st.tab.forEach(function (p) { n += p.length; });
      return n;
    }
  }

  SG.register({
    id: 'solitaire',
    name: 'Solitär',
    category: 'karten',
    desc: 'Klondike, Zieh-1 oder Zieh-3',
    tags: ['patience', 'karten', 'klondike', 'klassiker'],
    scoreLabel: function (bests) {
      var v = bests.draw1 !== undefined ? bests.draw1 : bests.draw3;
      return v ? U.time(v) : null;
    },
    preview: function (c, w, h) {
      c.fillStyle = '#0f2a1c';
      c.fillRect(0, 0, w, h);
      var cw = w * 0.13, ch = cw * 1.4;
      var gap = w * 0.018;
      var x0 = (w - (cw * 7 + gap * 6)) / 2;
      // Obere Reihe
      c.drawImage(G.cardBack(cw, ch, '#1e3a63'), x0, 6);
      c.drawImage(G.cardFace(cw, ch, '7', 'h'), x0 + (cw + gap), 6);
      for (var f = 0; f < 4; f++) {
        var fx = x0 + (cw + gap) * (3 + f);
        if (f < 2) c.drawImage(G.cardFace(cw, ch, 'A', SUITS[f]), fx, 6);
        else {
          G.strokeRound(c, fx + 1, 7, cw - 2, ch - 2, cw * 0.1, 'rgba(255,255,255,.16)', 1.2);
          G.text(c, SUIT_CH[SUITS[f]], fx + cw / 2, 6 + ch / 2, {
            size: cw * 0.4, color: 'rgba(255,255,255,.16)', align: 'center', baseline: 'middle',
          });
        }
      }
      // Tableau
      var ty = 6 + ch + gap * 1.6;
      var demo = [
        [['K', 's']], [['-', ''], ['D', 'h']], [['-', ''], ['-', ''], ['9', 'c']],
        [['-', ''], ['B', 'd'], ['10', 's']], [['5', 'h']], [['-', ''], ['3', 'c']],
        [['8', 'd'], ['7', 's']],
      ];
      for (var t = 0; t < 7; t++) {
        var y = ty;
        for (var i = 0; i < demo[t].length; i++) {
          var card = demo[t][i];
          if (card[0] === '-') {
            c.drawImage(G.cardBack(cw, ch, '#1e3a63'), x0 + t * (cw + gap), y);
            y += ch * 0.16;
          } else {
            c.drawImage(G.cardFace(cw, ch, card[0], card[1]), x0 + t * (cw + gap), y);
            y += ch * 0.3;
          }
        }
      }
    },
    mount: mount,
  });
})(SG);
