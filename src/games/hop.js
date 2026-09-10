/* ------------------------------------------------------------------
   Hüpf-Straße

   Immer weiter nach vorn: Strassen mit Autos, Fluesse mit Baumstaemmen,
   Bahnstrecken mit Vorwarnung. Die Welt entsteht endlos vor dir, und
   ein Adler holt dich, wenn du zu lange zurueckbleibst.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var G = SG.gfx;

  var LANES_W = 15;            // Spielfeldbreite in Feldern
  var GRASS = 0, ROAD = 1, WATER = 2, RAIL = 3;

  var CAR_COLORS = ['#ff5f6b', '#4aa3ff', '#f0b429', '#a97bff', '#3ddc84', '#ff9c3f'];

  function mount(host) {
    var st = {
      lanes: [],           // Index = Zeile (0 = Start), waechst nach vorn
      first: 0,            // Index der ersten gespeicherten Zeile
      px: Math.floor(LANES_W / 2), py: 0,
      ax: 0, ay: 0,        // Anzeige-Position (weich)
      hop: 0, hopFrom: null,
      onLog: null, logOff: 0,
      score: 0, coins: 0,
      cam: 0,
      over: false, dead: 0, deadKind: '',
      idle: 0, t: 0,
    };

    var stage = host.canvas({ alpha: false });
    var ctx = stage.ctx;
    var parts = G.particles(180);
    var shake = G.shake();

    var sScore = host.stat('Strecke', '0', 'gold');
    var sCoins = host.stat('Münzen', '0');
    var sBest = host.stat('Bestwert', '—');

    var loop;
    host.menuTool([
      { icon: '↻', label: 'Neues Spiel', onClick: reset },
      { icon: '?', label: 'Anleitung', onClick: function () { help(true); } },
    ]);

    var rng = U.rng(1);

    /* ---------------------------------------------------------- Welt */

    function makeLane(idx) {
      var diff = U.clamp(idx / 260, 0, 1);
      var r = rng();
      var type = GRASS;
      if (idx < 4) type = GRASS;
      else if (r < 0.40) type = ROAD;
      else if (r < 0.62) type = WATER;
      else if (r < 0.70) type = RAIL;

      var lane = { idx: idx, type: type, objs: [], speed: 0, dir: 1, timer: 0 };

      if (type === ROAD) {
        lane.dir = rng() < 0.5 ? -1 : 1;
        lane.speed = (1.5 + rng() * 2.2 + diff * 2.4);
        var gap = 4.5 + rng() * 3;
        for (var x = 0; x < LANES_W + 6; x += gap) {
          lane.objs.push({
            x: x - 3, w: 1.6 + (rng() < 0.25 ? 1.2 : 0),
            col: CAR_COLORS[rng.int(CAR_COLORS.length)],
          });
        }
      } else if (type === WATER) {
        lane.dir = rng() < 0.5 ? -1 : 1;
        lane.speed = 1 + rng() * 1.6 + diff * 1.1;
        var gap2 = 3.6 + rng() * 2.4;
        for (var x2 = 0; x2 < LANES_W + 6; x2 += gap2) {
          lane.objs.push({ x: x2 - 3, w: 2 + rng.int(3) });
        }
      } else if (type === RAIL) {
        lane.dir = rng() < 0.5 ? -1 : 1;
        lane.speed = 13 + diff * 5;
        lane.timer = 2 + rng() * 4;
        lane.warn = 0;
        lane.train = null;
      } else {
        // Baeume als Hindernisse
        var count = rng.int(4);
        var used = {};
        for (var i = 0; i < count; i++) {
          var tx = rng.int(LANES_W);
          if (idx < 3 && Math.abs(tx - Math.floor(LANES_W / 2)) < 2) continue;
          used[tx] = 1;
        }
        for (var k in used) lane.objs.push({ x: +k, w: 1, tree: true });
        if (rng() < 0.22) {
          var cx = rng.int(LANES_W);
          if (!used[cx]) lane.coin = cx;
        }
      }
      return lane;
    }

    function laneAt(idx) {
      while (st.lanes.length <= idx - st.first) {
        st.lanes.push(makeLane(st.first + st.lanes.length));
      }
      return st.lanes[idx - st.first];
    }

    function reset() {
      rng = U.rng((Date.now() ^ (Math.random() * 1e9)) >>> 0);
      st.lanes = [];
      st.first = 0;
      st.px = Math.floor(LANES_W / 2); st.py = 0;
      st.ax = st.px; st.ay = 0;
      st.hop = 0; st.hopFrom = null;
      st.onLog = null;
      st.score = 0; st.coins = 0;
      st.cam = 0;
      st.over = false; st.dead = 0; st.idle = 0;
      for (var i = 0; i < 24; i++) laneAt(i);
      parts.clear();
      host.closeOverlay();
      syncBar();
      loop.resume(true);
    }

    function syncBar() {
      sScore.set(U.num(st.score));
      sCoins.set(U.num(st.coins));
      var b = host.best();
      sBest.set(b === null ? '—' : U.num(b));
    }

    function move(dx, dy) {
      if (st.over || st.hop > 0) return;
      var nx = st.px + dx, ny = st.py + dy;
      if (nx < 0 || nx >= LANES_W) return;
      if (ny < st.first) return;
      var lane = laneAt(ny);
      // Baeume blockieren
      for (var i = 0; i < lane.objs.length; i++) {
        var o = lane.objs[i];
        if (o.tree && Math.floor(o.x) === nx) { host.sfx('error'); return; }
      }
      st.hopFrom = { x: st.ax, y: st.ay };
      st.px = nx; st.py = ny;
      st.hop = 0.13;
      st.onLog = null;
      st.idle = 0;
      host.sfx('move');
      if (dy > 0 && st.py > st.score) {
        st.score = st.py;
        syncBar();
      }
      if (lane.coin === nx) {
        lane.coin = -1;
        st.coins++;
        host.sfx('coin');
        syncBar();
      }
      // Alte Zeilen wegwerfen
      while (st.py - st.first > 40) {
        st.lanes.shift();
        st.first++;
      }
    }

    function die(kind) {
      if (st.over) return;
      st.over = true;
      st.deadKind = kind;
      st.dead = 0;
      shake.hit(12, 0.35);
      host.sfx(kind === 'water' ? 'thud' : 'explode');
      host.buzz(60);
      var p = worldPos(st.ax, st.ay);
      parts.burst(p.x, p.y, 18, {
        color: kind === 'water' ? ['#4aa3ff', '#ffffff'] : ['#ff5f6b', '#ffd166'],
        speed: 150, life: 0.6, size: 3.5, g: 400,
      });
      host.after(function () {
        if (!st.over) return;
        host.gameOver({
          title: {
            car: 'Überfahren', train: 'Vom Zug erwischt',
            water: 'Untergegangen', eagle: 'Der Adler war schneller',
          }[kind] || 'Vorbei',
          sub: st.coins + ' Münzen gesammelt',
          score: st.score + st.coins * 3,
          scoreLabel: 'Punkte',
          onAgain: reset,
        });
      }, 800);
    }

    function step(dt) {
      st.t += dt;
      shake.update(dt);
      parts.update(dt);
      if (st.over) { st.dead += dt; return; }

      if (st.hop > 0) {
        st.hop -= dt;
        if (st.hop <= 0) { st.hop = 0; st.hopFrom = null; }
      }

      // Fahrzeuge und Staemme bewegen
      var from = st.first, to = st.py + 16;
      for (var idx = from; idx <= to; idx++) {
        var lane = laneAt(idx);
        if (lane.type === ROAD || lane.type === WATER) {
          for (var i = 0; i < lane.objs.length; i++) {
            var o = lane.objs[i];
            o.x += lane.dir * lane.speed * dt;
            if (lane.dir > 0 && o.x > LANES_W + 3) o.x -= LANES_W + 8;
            if (lane.dir < 0 && o.x + o.w < -3) o.x += LANES_W + 8;
          }
        } else if (lane.type === RAIL) {
          if (lane.train) {
            lane.train.x += lane.dir * lane.speed * dt;
            if (lane.dir > 0 && lane.train.x > LANES_W + 8) lane.train = null;
            if (lane.dir < 0 && lane.train.x + lane.train.w < -8) lane.train = null;
          } else {
            lane.timer -= dt;
            if (lane.timer <= 1.1) lane.warn = 1;
            if (lane.timer <= 0) {
              lane.train = { x: lane.dir > 0 ? -9 : LANES_W + 1, w: 8 };
              lane.warn = 0;
              lane.timer = 4 + rng() * 5;
              host.sfx('alert');
            }
          }
        }
      }

      // Weiche Anzeige-Position
      var t = st.hop > 0 ? 1 - st.hop / 0.13 : 1;
      var targetX = st.px, targetY = st.py;
      if (st.onLog) targetX = st.onLog.x + st.logOff;
      if (st.hopFrom) {
        st.ax = U.lerp(st.hopFrom.x, targetX, U.easeOut(t));
        st.ay = U.lerp(st.hopFrom.y, targetY, U.easeOut(t));
      } else {
        st.ax = targetX;
        st.ay = targetY;
      }

      // Kamera
      var camTarget = st.py - 3;
      st.cam = U.damp(st.cam, camTarget, 7, dt);

      // Gefahren nur pruefen, wenn wir stehen
      if (st.hop <= 0) {
        var cur = laneAt(st.py);
        if (cur.type === ROAD) {
          for (i = 0; i < cur.objs.length; i++) {
            var c = cur.objs[i];
            if (st.px + 0.75 > c.x && st.px + 0.25 < c.x + c.w) { die('car'); return; }
          }
        } else if (cur.type === RAIL) {
          if (cur.train && st.px + 0.7 > cur.train.x && st.px + 0.3 < cur.train.x + cur.train.w) {
            die('train'); return;
          }
        } else if (cur.type === WATER) {
          if (!st.onLog) {
            var found = null;
            for (i = 0; i < cur.objs.length; i++) {
              var lg = cur.objs[i];
              if (st.px + 0.5 >= lg.x && st.px + 0.5 <= lg.x + lg.w) { found = lg; break; }
            }
            if (found) {
              st.onLog = found;
              st.logOff = st.px - found.x;
              host.sfx('land');
            } else { die('water'); return; }
          }
          if (st.onLog) {
            st.px = st.onLog.x + st.logOff;
            st.ax = st.px;
            if (st.px < -0.6 || st.px > LANES_W - 0.4) { die('water'); return; }
          }
        } else {
          st.onLog = null;
        }
      }

      // Adler holt Zauderer
      st.idle += dt;
      if (st.py < st.cam - 1.5) {
        eagleT += dt;
        if (eagleT > 2.4) { die('eagle'); return; }
      } else eagleT = 0;
    }
    var eagleT = 0;

    /* ---------------------------------------------------------- Zeichnen */

    var L = { cell: 44, x: 0, y: 0 };

    function relayout(w, h) {
      L.cell = Math.max(22, Math.min(w / LANES_W, h / 9));
      L.x = (w - L.cell * LANES_W) / 2;
      L.y = h;
    }
    stage.onResize = relayout;

    function worldPos(x, y) {
      return {
        x: L.x + x * L.cell + L.cell / 2,
        y: L.y - (y - st.cam) * L.cell - L.cell * 2.2,
      };
    }

    function draw() {
      var w = stage.w, h = stage.h;
      if (!L.cell) relayout(w, h);
      L.y = h;
      ctx.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0);
      ctx.fillStyle = '#0b0e15';
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      shake.apply(ctx);

      var c = L.cell;
      var firstVisible = Math.floor(st.cam) - 3;
      var lastVisible = Math.ceil(st.cam + h / c) + 2;

      for (var idx = Math.max(st.first, firstVisible); idx <= lastVisible; idx++) {
        var lane = laneAt(idx);
        var p = worldPos(0, idx);
        var ly = p.y - c / 2;
        if (ly > h + c || ly + c < -c) continue;

        // Untergrund
        var bg = lane.type === ROAD ? (idx % 2 ? '#2b2f38' : '#31353f')
          : lane.type === WATER ? (idx % 2 ? '#14395c' : '#173f66')
            : lane.type === RAIL ? '#3a3327'
              : (idx % 2 ? '#1f3d2a' : '#22432e');
        ctx.fillStyle = bg;
        ctx.fillRect(L.x, ly, c * LANES_W, c);

        if (lane.type === ROAD) {
          ctx.fillStyle = 'rgba(255,255,255,.22)';
          for (var d = 0; d < LANES_W; d += 2) {
            ctx.fillRect(L.x + d * c + c * 0.25, ly + c * 0.47, c * 0.5, 2);
          }
        } else if (lane.type === RAIL) {
          ctx.fillStyle = '#5a4c36';
          ctx.fillRect(L.x, ly + c * 0.3, c * LANES_W, c * 0.06);
          ctx.fillRect(L.x, ly + c * 0.62, c * LANES_W, c * 0.06);
          ctx.fillStyle = 'rgba(0,0,0,.3)';
          for (d = 0; d < LANES_W * 2; d++) {
            ctx.fillRect(L.x + d * c * 0.5, ly + c * 0.24, c * 0.12, c * 0.5);
          }
          if (lane.warn) {
            var blink = Math.floor(st.t * 8) % 2;
            ctx.fillStyle = blink ? '#ff5f6b' : 'rgba(255,95,107,.25)';
            ctx.fillRect(L.x, ly, c * LANES_W, 3);
            ctx.fillRect(L.x, ly + c - 3, c * LANES_W, 3);
          }
        } else if (lane.type === WATER) {
          ctx.fillStyle = 'rgba(255,255,255,.05)';
          for (d = 0; d < LANES_W; d++) {
            var wob = Math.sin(st.t * 2 + d * 0.7 + idx) * 2;
            ctx.fillRect(L.x + d * c + c * 0.2, ly + c * 0.5 + wob, c * 0.35, 2);
          }
        }

        // Objekte
        for (var i = 0; i < lane.objs.length; i++) {
          var o = lane.objs[i];
          var ox = L.x + o.x * c;
          if (o.tree) {
            drawTree(ox + c / 2, ly + c * 0.55, c);
          } else if (lane.type === ROAD) {
            drawCar(ox, ly + c * 0.16, o.w * c, c * 0.68, o.col, lane.dir);
          } else {
            drawLog(ox, ly + c * 0.2, o.w * c, c * 0.6);
          }
        }
        if (lane.type === RAIL && lane.train) {
          drawTrain(L.x + lane.train.x * c, ly + c * 0.1, lane.train.w * c, c * 0.8, lane.dir);
        }
        if (lane.coin >= 0 && lane.coin !== undefined) {
          var cp = worldPos(lane.coin, idx);
          var s = Math.abs(Math.cos(st.t * 3 + idx));
          ctx.fillStyle = '#f0b429';
          ctx.beginPath();
          ctx.ellipse(cp.x, cp.y, c * 0.18 * (0.3 + s * 0.7), c * 0.18, 0, 0, 6.28);
          ctx.fill();
        }
      }

      parts.draw(ctx);

      // Figur
      if (st.dead < 0.3 || st.deadKind === 'water') {
        var pp = worldPos(st.ax, st.ay);
        var hopLift = st.hop > 0 ? Math.sin((1 - st.hop / 0.13) * Math.PI) * c * 0.3 : 0;
        var sink = st.over && st.deadKind === 'water' ? Math.min(1, st.dead * 2) * c * 0.5 : 0;
        drawChicken(pp.x, pp.y - hopLift + sink, c, st.over && st.deadKind === 'car');
      }

      // Adlerwarnung
      if (st.py < st.cam - 0.5 && !st.over) {
        var a = 0.4 + Math.sin(st.t * 8) * 0.35;
        ctx.globalAlpha = a;
        G.text(ctx, '🦅 Beeilung!', w / 2, 30, {
          size: 18, weight: 800, color: '#ff5f6b', align: 'center', baseline: 'middle',
        });
        ctx.globalAlpha = 1;
      }

      ctx.restore();
    }

    function drawTree(x, y, c) {
      ctx.fillStyle = '#5a4028';
      ctx.fillRect(x - c * 0.07, y - c * 0.05, c * 0.14, c * 0.4);
      G.circle(ctx, x, y - c * 0.18, c * 0.28, '#2f7a45');
      G.circle(ctx, x - c * 0.15, y - c * 0.05, c * 0.2, '#2a6b3d');
      G.circle(ctx, x + c * 0.15, y - c * 0.05, c * 0.2, '#348a4e');
    }

    function drawCar(x, y, w, h, col, dir) {
      G.fillRound(ctx, x, y + h * 0.2, w, h * 0.7, h * 0.2, col);
      G.fillRound(ctx, x + w * 0.2, y, w * 0.55, h * 0.55, h * 0.18, U.shade(col, -0.25));
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.fillRect(x + w * 0.26, y + h * 0.08, w * 0.42, h * 0.3);
      ctx.fillStyle = '#1a1c22';
      G.circle(ctx, x + w * 0.22, y + h * 0.88, h * 0.14, '#1a1c22');
      G.circle(ctx, x + w * 0.78, y + h * 0.88, h * 0.14, '#1a1c22');
      // Scheinwerfer
      ctx.fillStyle = '#ffe9a8';
      var hx = dir > 0 ? x + w - 3 : x;
      ctx.fillRect(hx, y + h * 0.35, 3, h * 0.2);
    }

    function drawLog(x, y, w, h) {
      G.fillRound(ctx, x, y, w, h, h * 0.35, '#6b4a2c');
      G.fillRound(ctx, x + 2, y + 2, w - 4, h * 0.35, h * 0.2, '#835c38');
      ctx.strokeStyle = 'rgba(0,0,0,.3)';
      ctx.lineWidth = 1.5;
      for (var i = 1; i < Math.floor(w / (h * 0.9)); i++) {
        ctx.beginPath();
        ctx.moveTo(x + i * h * 0.9, y + 3);
        ctx.lineTo(x + i * h * 0.9, y + h - 3);
        ctx.stroke();
      }
    }

    function drawTrain(x, y, w, h, dir) {
      G.fillRound(ctx, x, y, w, h, h * 0.18, '#c8d4ea');
      G.fillRound(ctx, x + 4, y + 4, w - 8, h * 0.42, h * 0.12, '#2c3a58');
      ctx.fillStyle = '#ffe9a8';
      var hx = dir > 0 ? x + w - 6 : x + 2;
      ctx.fillRect(hx, y + h * 0.3, 5, h * 0.3);
      ctx.fillStyle = '#1a1c22';
      for (var i = 0; i < 4; i++) {
        G.circle(ctx, x + w * (0.15 + i * 0.24), y + h * 0.95, h * 0.12, '#1a1c22');
      }
    }

    function drawChicken(x, y, c, flat) {
      var s = flat ? 0.5 : 1;
      ctx.save();
      ctx.translate(x, y);
      if (flat) ctx.scale(1.25, 0.45);
      // Koerper
      G.fillRound(ctx, -c * 0.22, -c * 0.3, c * 0.44, c * 0.46, c * 0.14, '#f4f6fb');
      // Kopf
      G.circle(ctx, 0, -c * 0.36, c * 0.16, '#ffffff');
      // Kamm
      G.circle(ctx, -c * 0.04, -c * 0.5, c * 0.05, '#ff5f6b');
      G.circle(ctx, c * 0.04, -c * 0.5, c * 0.05, '#ff5f6b');
      // Schnabel
      G.poly(ctx, [c * 0.13, -c * 0.36, c * 0.26, -c * 0.32, c * 0.13, -c * 0.29], '#ff9c3f');
      // Auge
      G.circle(ctx, c * 0.06, -c * 0.39, c * 0.032, '#12151d');
      // Beine
      ctx.strokeStyle = '#ff9c3f';
      ctx.lineWidth = Math.max(1.5, c * 0.05);
      ctx.beginPath();
      ctx.moveTo(-c * 0.08, c * 0.16); ctx.lineTo(-c * 0.08, c * 0.26);
      ctx.moveTo(c * 0.08, c * 0.16); ctx.lineTo(c * 0.08, c * 0.26);
      ctx.stroke();
      ctx.restore();
    }

    /* ---------------------------------------------------------- Steuerung */

    loop = host.loop({ hz: 60, update: step, render: draw });

    host.input({
      swipeMin: 22,
      onTap: function () { move(0, 1); },
      onSwipe: function (dir) {
        if (dir === 'up') move(0, 1);
        else if (dir === 'down') move(0, -1);
        else if (dir === 'left') move(-1, 0);
        else move(1, 0);
      },
    });

    var pad = host.pad([
      { name: 'left', label: '◀', cls: 'sm' },
      { name: 'fwd', label: '▲', cls: '' },
      { name: 'right', label: '▶', cls: 'sm' },
    ], {
      pos: 'bottom',
      onPress: function (n) {
        if (n === 'left') move(-1, 0);
        else if (n === 'right') move(1, 0);
        else move(0, 1);
      },
    });

    var keys = host.keys({
      onDown: function (k) {
        if (k === 'arrowup' || k === 'w' || k === 'space') move(0, 1);
        else if (k === 'arrowdown' || k === 's') move(0, -1);
        else if (k === 'arrowleft' || k === 'a') move(-1, 0);
        else if (k === 'arrowright' || k === 'd') move(1, 0);
      },
    });

    function help(force) {
      SG.tutorial.show({
        id: 'hop', force: force, parent: host.root, title: 'Hüpf-Straße',
        pages: [{
          kicker: 'Hüpf-Straße', title: 'Ein Feld nach dem anderen',
          art: SG.tutorial.art.swipe,
          body: [
            { ic: '👆', text: '<b>Tippen</b> hüpft nach vorn, <b>Wischen</b> in jede Richtung.' },
            { ic: '🚗', text: 'Autos sind tödlich. Schaue auf die Lücken, nicht auf die Autos.' },
            { ic: '🪵', text: 'Im Wasser musst du auf einem <b>Baumstamm</b> landen — der trägt dich mit, bis zum Rand.' },
            { ic: '🚂', text: 'Blinkende Schienen heißen: gleich kommt ein <b>Zug</b>. Der ist schnell.' },
            { ic: '🦅', text: 'Zu lange stehenbleiben lohnt sich nicht — dann kommt der Adler.' },
          ],
        }],
      });
    }

    reset();
    loop.start();
    help(false);

    return {
      state: st,
      destroy: function () { keys.destroy(); },
      selftest: function (steps) {
        reset();
        relayout(900, 620);
        var r = U.rng(4321);
        for (var i = 0; i < (steps || 600); i++) {
          if (st.hop <= 0 && !st.over) {
            var a = r();
            if (a < 0.6) move(0, 1);
            else if (a < 0.75) move(-1, 0);
            else if (a < 0.9) move(1, 0);
          }
          step(1 / 60);
          if (st.over && st.dead > 1) reset();
          if (!isFinite(st.px) || !isFinite(st.cam)) throw new Error('Position ungültig');
          if (st.py < st.first) throw new Error('Figur hinter dem Weltrand');
        }
        // Zeilen muessen alle Typen abdecken koennen
        var types = {};
        for (i = 0; i < 200; i++) types[makeLane(i + 10).type] = 1;
        if (!types[ROAD] || !types[WATER]) throw new Error('Weltgenerator liefert keine Vielfalt');
        draw();
      },
    };
  }

  SG.register({
    id: 'hop',
    name: 'Hüpf-Straße',
    category: 'casual',
    desc: 'Straßen, Flüsse, Züge',
    tags: ['crossy', 'huepfen', 'strasse', 'endlos'],
    preview: function (c, w, h) {
      var rows = 6;
      var cell = h / rows;
      var types = [GRASS, ROAD, ROAD, WATER, GRASS, ROAD];
      for (var i = 0; i < rows; i++) {
        var t = types[i];
        c.fillStyle = t === ROAD ? (i % 2 ? '#2b2f38' : '#31353f')
          : t === WATER ? '#173f66' : (i % 2 ? '#1f3d2a' : '#22432e');
        c.fillRect(0, i * cell, w, cell);
        if (t === ROAD) {
          c.fillStyle = 'rgba(255,255,255,.22)';
          for (var d = 0; d < w; d += cell * 1.6) c.fillRect(d, i * cell + cell * 0.47, cell * 0.5, 2);
        }
      }
      // Auto
      function car(x, y, cw, col) {
        G.fillRound(c, x, y + cell * 0.2, cw, cell * 0.5, 5, col);
        G.fillRound(c, x + cw * 0.2, y + cell * 0.05, cw * 0.55, cell * 0.35, 4, U.shade(col, -0.25));
        G.circle(c, x + cw * 0.22, y + cell * 0.72, cell * 0.09, '#1a1c22');
        G.circle(c, x + cw * 0.78, y + cell * 0.72, cell * 0.09, '#1a1c22');
      }
      car(w * 0.1, cell * 1, cell * 1.3, '#ff5f6b');
      car(w * 0.6, cell * 2, cell * 1.3, '#4aa3ff');
      car(w * 0.35, cell * 5, cell * 1.3, '#f0b429');
      // Baumstamm
      G.fillRound(c, w * 0.15, cell * 3.2, cell * 2, cell * 0.5, cell * 0.2, '#6b4a2c');
      // Baum
      c.fillStyle = '#5a4028';
      c.fillRect(w * 0.8, cell * 4.4, cell * 0.14, cell * 0.4);
      G.circle(c, w * 0.8 + cell * 0.07, cell * 4.4, cell * 0.28, '#2f7a45');
      // Huhn
      var x0 = w * 0.5, y0 = cell * 4.6;
      G.fillRound(c, x0 - cell * 0.22, y0 - cell * 0.3, cell * 0.44, cell * 0.46, cell * 0.14, '#f4f6fb');
      G.circle(c, x0, y0 - cell * 0.36, cell * 0.16, '#fff');
      G.circle(c, x0 - cell * 0.04, y0 - cell * 0.5, cell * 0.05, '#ff5f6b');
      G.poly(c, [x0 + cell * 0.13, y0 - cell * 0.36, x0 + cell * 0.26, y0 - cell * 0.32,
        x0 + cell * 0.13, y0 - cell * 0.29], '#ff9c3f');
      G.circle(c, x0 + cell * 0.06, y0 - cell * 0.39, cell * 0.032, '#12151d');
    },
    mount: mount,
  });
})(SG);
