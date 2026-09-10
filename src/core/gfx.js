/* ------------------------------------------------------------------
   Zeichenhelfer fuer Canvas 2D.

   Alles ist prozedural - es gibt keine Bilddateien. Wiederkehrende
   Motive landen in einem Offscreen-Cache, damit pro Bild nur noch
   ein drawImage noetig ist.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var G = SG.gfx = {};

  /* ---------------------------------------------------------- Pfade */

  G.roundRect = function (c, x, y, w, h, r) {
    if (w < 0) { x += w; w = -w; }
    if (h < 0) { y += h; h = -h; }
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    if (c.roundRect) { c.roundRect(x, y, w, h, r); return; }
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.arcTo(x + w, y, x + w, y + r, r);
    c.lineTo(x + w, y + h - r);
    c.arcTo(x + w, y + h, x + w - r, y + h, r);
    c.lineTo(x + r, y + h);
    c.arcTo(x, y + h, x, y + h - r, r);
    c.lineTo(x, y + r);
    c.arcTo(x, y, x + r, y, r);
    c.closePath();
  };

  G.fillRound = function (c, x, y, w, h, r, fill) {
    G.roundRect(c, x, y, w, h, r);
    if (fill) c.fillStyle = fill;
    c.fill();
  };

  G.strokeRound = function (c, x, y, w, h, r, stroke, lw) {
    G.roundRect(c, x, y, w, h, r);
    if (stroke) c.strokeStyle = stroke;
    c.lineWidth = lw || 1;
    c.stroke();
  };

  G.circle = function (c, x, y, r, fill) {
    c.beginPath();
    c.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
    if (fill) { c.fillStyle = fill; c.fill(); }
  };

  G.ring = function (c, x, y, r, lw, stroke, from, to) {
    c.beginPath();
    c.arc(x, y, Math.max(0, r), from === undefined ? 0 : from, to === undefined ? Math.PI * 2 : to);
    c.lineWidth = lw;
    c.strokeStyle = stroke;
    c.stroke();
  };

  G.poly = function (c, pts, fill, close) {
    c.beginPath();
    for (var i = 0; i < pts.length; i += 2) {
      if (i === 0) c.moveTo(pts[0], pts[1]);
      else c.lineTo(pts[i], pts[i + 1]);
    }
    if (close !== false) c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
  };

  G.ngon = function (c, x, y, r, n, rot, fill) {
    c.beginPath();
    for (var i = 0; i < n; i++) {
      var a = (rot || 0) + (i / n) * Math.PI * 2;
      var px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
  };

  G.star = function (c, x, y, rOut, rIn, points, rot, fill) {
    c.beginPath();
    var n = points * 2;
    for (var i = 0; i < n; i++) {
      var r = i % 2 ? rIn : rOut;
      var a = (rot || -Math.PI / 2) + (i / n) * Math.PI * 2;
      var px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
  };

  G.line = function (c, x1, y1, x2, y2, color, lw) {
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.strokeStyle = color;
    c.lineWidth = lw || 1;
    c.stroke();
  };

  /* Gestrichelte Linie ohne setLineDash-Zustand zu hinterlassen */
  G.dashed = function (c, x1, y1, x2, y2, color, lw, dash) {
    c.save();
    c.setLineDash(dash || [6, 5]);
    G.line(c, x1, y1, x2, y2, color, lw);
    c.restore();
  };

  /* ---------------------------------------------------------- Text */

  G.font = function (size, weight, mono) {
    return (weight || 500) + ' ' + size + 'px ' + (mono
      ? 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
      : '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif');
  };

  G.text = function (c, str, x, y, o) {
    o = o || {};
    c.font = G.font(o.size || 14, o.weight || 500, o.mono);
    c.textAlign = o.align || 'left';
    c.textBaseline = o.baseline || 'alphabetic';
    if (o.shadow) {
      c.fillStyle = o.shadow;
      c.fillText(str, x + (o.sx || 0), y + (o.sy || 1.5));
    }
    c.fillStyle = o.color || '#fff';
    c.fillText(str, x, y);
  };

  /* Verkleinert die Schrift, bis der Text passt */
  G.fitText = function (c, str, x, y, maxW, o) {
    o = o || {};
    var size = o.size || 14;
    do {
      c.font = G.font(size, o.weight || 500, o.mono);
      if (c.measureText(str).width <= maxW || size <= 7) break;
      size -= 1;
    } while (true);
    c.textAlign = o.align || 'left';
    c.textBaseline = o.baseline || 'alphabetic';
    c.fillStyle = o.color || '#fff';
    c.fillText(str, x, y);
    return size;
  };

  /* Umbruch in Zeilen, gibt die Anzahl gezeichneter Zeilen zurueck */
  G.wrap = function (c, str, x, y, maxW, lineH, o) {
    o = o || {};
    c.font = G.font(o.size || 14, o.weight || 500, o.mono);
    c.textAlign = o.align || 'left';
    c.textBaseline = o.baseline || 'top';
    c.fillStyle = o.color || '#fff';
    var words = String(str).split(/\s+/), line = '', n = 0;
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + ' ' + words[i] : words[i];
      if (c.measureText(test).width > maxW && line) {
        c.fillText(line, x, y + n * lineH); n++; line = words[i];
        if (o.maxLines && n >= o.maxLines) { line = ''; break; }
      } else line = test;
    }
    if (line) { c.fillText(line, x, y + n * lineH); n++; }
    return n;
  };

  /* ---------------------------------------------------------- Verlaeufe */

  G.linear = function (c, x0, y0, x1, y1, stops) {
    var g = c.createLinearGradient(x0, y0, x1, y1);
    for (var i = 0; i < stops.length; i += 2) g.addColorStop(stops[i], stops[i + 1]);
    return g;
  };

  G.radial = function (c, x, y, r0, r1, stops) {
    var g = c.createRadialGradient(x, y, r0, x, y, r1);
    for (var i = 0; i < stops.length; i += 2) g.addColorStop(stops[i], stops[i + 1]);
    return g;
  };

  /* Weicher Lichtschein ohne teure Schatten-Filter */
  G.glow = function (c, x, y, r, color, alpha) {
    var g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.save();
    c.globalAlpha = alpha === undefined ? 0.5 : alpha;
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
    c.restore();
  };

  /* ---------------------------------------------------------- Offscreen-Cache */

  var cacheMap = {};
  var cacheOrder = [];
  var CACHE_MAX = 140;

  G.newCanvas = function (w, h) {
    var cv;
    if (typeof document !== 'undefined') {
      cv = document.createElement('canvas');
    } else {
      cv = { width: 0, height: 0, getContext: function () { return null; } };
    }
    cv.width = Math.max(1, Math.ceil(w));
    cv.height = Math.max(1, Math.ceil(h));
    return cv;
  };

  /* Zeichnet einmal und liefert danach immer dasselbe Canvas. */
  G.cache = function (key, w, h, draw) {
    var hit = cacheMap[key];
    if (hit && hit.width === Math.ceil(w) && hit.height === Math.ceil(h)) return hit;
    var cv = G.newCanvas(w, h);
    var c = cv.getContext('2d');
    if (c) draw(c, cv.width, cv.height);
    cacheMap[key] = cv;
    cacheOrder.push(key);
    while (cacheOrder.length > CACHE_MAX) {
      var old = cacheOrder.shift();
      if (old !== key) delete cacheMap[old];
    }
    return cv;
  };

  G.dropCache = function (prefix) {
    for (var k in cacheMap) {
      if (!prefix || k.indexOf(prefix) === 0) delete cacheMap[k];
    }
    cacheOrder = cacheOrder.filter(function (k) { return !!cacheMap[k]; });
  };

  /* ---------------------------------------------------------- Partikel */

  G.particles = function (max) {
    var pool = U.pool(function () {
      return { x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 3, color: '#fff', g: 0, spin: 0, rot: 0, kind: 0 };
    }, function (p) { p.life = 0; }, max || 0);

    return {
      list: pool.live,
      count: pool.count,
      clear: pool.clear,

      spawn: function (o) {
        if (SG.settings.get('reduced') && pool.count() > 40) return null;
        if (pool.count() > (max || 320)) return null;
        var p = pool.get();
        p.x = o.x; p.y = o.y;
        p.vx = o.vx || 0; p.vy = o.vy || 0;
        p.life = p.max = o.life || 0.6;
        p.size = o.size || 3;
        p.color = o.color || '#fff';
        p.g = o.g === undefined ? 0 : o.g;
        p.drag = o.drag === undefined ? 0 : o.drag;
        p.spin = o.spin || 0;
        p.rot = o.rot || 0;
        p.kind = o.kind || 0;   // 0 Kreis, 1 Quadrat, 2 Funke
        return p;
      },

      burst: function (x, y, n, o) {
        o = o || {};
        var cnt = SG.settings.get('reduced') ? Math.ceil(n / 3) : n;
        for (var i = 0; i < cnt; i++) {
          var a = o.angle === undefined ? Math.random() * Math.PI * 2
            : o.angle + (Math.random() - .5) * (o.spread || Math.PI * 2);
          var sp = (o.speed || 90) * (0.45 + Math.random() * 0.8);
          this.spawn({
            x: x, y: y,
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
            life: (o.life || 0.6) * (0.6 + Math.random() * 0.7),
            size: (o.size || 3) * (0.6 + Math.random() * 0.8),
            color: Array.isArray(o.color) ? U.pick(o.color) : (o.color || '#fff'),
            g: o.g === undefined ? 260 : o.g,
            drag: o.drag || 0,
            spin: (Math.random() - .5) * 12,
            rot: Math.random() * 6.28,
            kind: o.kind || 0,
          });
        }
      },

      update: function (dt) {
        var l = pool.live;
        for (var i = l.length - 1; i >= 0; i--) {
          var p = l[i];
          p.life -= dt;
          if (p.life <= 0) { pool.release(p); continue; }
          p.vy += p.g * dt;
          if (p.drag) { var d = Math.exp(-p.drag * dt); p.vx *= d; p.vy *= d; }
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.rot += p.spin * dt;
        }
      },

      draw: function (c) {
        var l = pool.live;
        for (var i = 0; i < l.length; i++) {
          var p = l[i];
          var a = U.clamp(p.life / p.max, 0, 1);
          c.globalAlpha = a;
          c.fillStyle = p.color;
          if (p.kind === 1) {
            c.save();
            c.translate(p.x, p.y);
            c.rotate(p.rot);
            c.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
            c.restore();
          } else if (p.kind === 2) {
            c.strokeStyle = p.color;
            c.lineWidth = Math.max(1, p.size * 0.4);
            c.beginPath();
            c.moveTo(p.x, p.y);
            c.lineTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02);
            c.stroke();
          } else {
            c.beginPath();
            c.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
            c.fill();
          }
        }
        c.globalAlpha = 1;
      },
    };
  };

  /* ---------------------------------------------------------- Kamerawackeln */

  G.shake = function () {
    var t = 0, amp = 0, seed = U.rng(7);
    return {
      hit: function (a, dur) {
        if (SG.settings.get('reduced')) return;
        amp = Math.max(amp, a);
        t = Math.max(t, dur || 0.28);
      },
      update: function (dt) { t = Math.max(0, t - dt); if (t <= 0) amp = 0; },
      apply: function (c) {
        if (t <= 0) return;
        var k = amp * (t / 0.28);
        c.translate((seed() - .5) * k, (seed() - .5) * k);
      },
      active: function () { return t > 0; },
    };
  };

  /* ---------------------------------------------------------- Spielkarten */

  var SUITS = {
    s: { ch: '♠', red: false, name: 'Pik' },
    h: { ch: '♥', red: true, name: 'Herz' },
    d: { ch: '♦', red: true, name: 'Karo' },
    c: { ch: '♣', red: false, name: 'Kreuz' },
  };
  G.SUITS = SUITS;

  /* Zeichnet eine Spielkarte (in einem Cache-Canvas, also billig) */
  G.cardFace = function (w, h, rank, suit, opts) {
    opts = opts || {};
    var key = 'card:' + w + 'x' + h + ':' + rank + suit + (opts.dim ? 'd' : '');
    return G.cache(key, w, h, function (c) {
      var s = SUITS[suit] || SUITS.s;
      var col = s.red ? '#c62438' : '#17181c';
      G.fillRound(c, 0.5, 0.5, w - 1, h - 1, Math.max(3, w * 0.1), '#f7f4ec');
      G.strokeRound(c, 0.5, 0.5, w - 1, h - 1, Math.max(3, w * 0.1), '#c9c3b4', 1);
      var pad = Math.max(3, w * 0.09);
      var fs = Math.max(9, w * 0.30);
      G.text(c, rank, pad, pad + fs * 0.82, { size: fs, weight: 800, color: col });
      G.text(c, s.ch, pad, pad + fs * 1.72, { size: fs * 0.72, weight: 700, color: col });
      G.text(c, s.ch, w / 2, h * 0.60, { size: w * 0.52, weight: 700, color: col, align: 'center', baseline: 'middle' });
      c.save();
      c.translate(w - pad, h - pad);
      c.rotate(Math.PI);
      G.text(c, rank, 0, fs * 0.82, { size: fs, weight: 800, color: col });
      c.restore();
      if (opts.dim) { c.fillStyle = 'rgba(10,12,18,.45)'; G.roundRect(c, 0, 0, w, h, Math.max(3, w * 0.1)); c.fill(); }
    });
  };

  G.cardBack = function (w, h, tint) {
    var key = 'cardback:' + w + 'x' + h + ':' + (tint || '');
    return G.cache(key, w, h, function (c) {
      var r = Math.max(3, w * 0.1);
      G.fillRound(c, 0.5, 0.5, w - 1, h - 1, r, tint || '#1e3a63');
      c.save();
      G.roundRect(c, 2, 2, w - 4, h - 4, r - 1);
      c.clip();
      c.strokeStyle = 'rgba(255,255,255,.09)';
      c.lineWidth = 2;
      for (var i = -h; i < w; i += 7) {
        c.beginPath(); c.moveTo(i, 0); c.lineTo(i + h, h); c.stroke();
      }
      c.restore();
      G.strokeRound(c, 1.5, 1.5, w - 3, h - 3, r, 'rgba(255,255,255,.22)', 1.5);
    });
  };

  /* ---------------------------------------------------------- Muster */

  G.checkerPattern = function (c, size, a, b) {
    var cv = G.cache('chk:' + size + a + b, size * 2, size * 2, function (x) {
      x.fillStyle = a; x.fillRect(0, 0, size * 2, size * 2);
      x.fillStyle = b;
      x.fillRect(0, 0, size, size);
      x.fillRect(size, size, size, size);
    });
    return c.createPattern(cv, 'repeat');
  };

  G.stripePattern = function (c, size, a, b) {
    var cv = G.cache('stripe:' + size + a + b, size, size, function (x) {
      x.fillStyle = a; x.fillRect(0, 0, size, size);
      x.strokeStyle = b; x.lineWidth = size / 3;
      x.beginPath(); x.moveTo(-size, size); x.lineTo(size, -size);
      x.moveTo(0, size * 2); x.lineTo(size * 2, 0); x.stroke();
    });
    return c.createPattern(cv, 'repeat');
  };

  /* Feines Rauschen gegen Farbbanding in grossen Verlaeufen */
  G.grain = function (c, w, h, alpha) {
    var cv = G.cache('grain64', 64, 64, function (x) {
      var img = x.createImageData(64, 64), r = U.rng(99);
      for (var i = 0; i < img.data.length; i += 4) {
        var v = 128 + (r() - .5) * 40;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      x.putImageData(img, 0, 0);
    });
    c.save();
    c.globalAlpha = alpha === undefined ? 0.035 : alpha;
    c.globalCompositeOperation = 'overlay';
    var p = c.createPattern(cv, 'repeat');
    c.fillStyle = p;
    c.fillRect(0, 0, w, h);
    c.restore();
  };

  /* ---------------------------------------------------------- Sonstiges */

  /* Abgerundeter Fortschrittsbalken */
  G.progress = function (c, x, y, w, h, t, fg, bg) {
    G.fillRound(c, x, y, w, h, h / 2, bg || 'rgba(255,255,255,.12)');
    if (t > 0) G.fillRound(c, x, y, Math.max(h, w * U.clamp(t, 0, 1)), h, h / 2, fg || '#f0b429');
  };

  /* Kreisfoermiger Fortschritt */
  G.arcProgress = function (c, x, y, r, lw, t, fg, bg) {
    G.ring(c, x, y, r, lw, bg || 'rgba(255,255,255,.12)');
    if (t > 0) {
      c.beginPath();
      c.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * U.clamp(t, 0, 1));
      c.lineWidth = lw; c.strokeStyle = fg || '#f0b429'; c.lineCap = 'round';
      c.stroke();
      c.lineCap = 'butt';
    }
  };

  /* ------------------------------------------------------------------
     Der Gehstock

     Das Zeichen des Hauses: ein Griff, der sich nach links ueberschlaegt,
     und ein langer Schaft. Dieselbe Form wie das Zeichen ueber der Tuer,
     nur gezeichnet statt aus Raendern gebaut - so laesst sie sich drehen,
     biegen und beliebig gross ziehen.

       x, y   Mitte der Form
       h      Gesamthoehe
       o.bieg Seitlicher Versatz in der Mitte des Schafts. Damit sieht
              der Stock verdreht aus, ohne dass etwas gerechnet werden
              muss - eine Quadratkurve genuegt.
     ------------------------------------------------------------------ */

  G.gehstock = function (c, x, y, h, o) {
    o = o || {};
    var d = o.dicke === undefined ? h * 0.13 : o.dicke;
    var r = o.radius === undefined ? h * 0.2 : o.radius;
    var tail = o.tail === undefined ? h * 0.14 : o.tail;
    var bieg = o.bieg || 0;
    var oben = y - h / 2;
    var unten = y + h / 2;
    var hx = x - r;                 // linkes Ende des Griffs
    var sx = x + r;                 // Achse des Schafts

    c.save();
    c.strokeStyle = o.color || '#f0b429';
    c.lineWidth = d;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(hx, oben + r + tail);
    c.lineTo(hx, oben + r);
    c.arc(x, oben + r, r, Math.PI, 0, false);
    if (bieg) c.quadraticCurveTo(sx + bieg, (oben + r + unten) / 2, sx, unten);
    else c.lineTo(sx, unten);
    c.stroke();
    c.restore();
  };

  /* Kleines Symbol aus Grundformen - fuer Kacheln und Listen */
  G.icon = function (c, kind, x, y, s, color) {
    c.save();
    c.translate(x, y);
    c.fillStyle = color || '#fff';
    c.strokeStyle = color || '#fff';
    c.lineWidth = Math.max(1, s * 0.12);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    switch (kind) {
      case 'play':
        c.beginPath(); c.moveTo(-s * .3, -s * .45); c.lineTo(s * .45, 0); c.lineTo(-s * .3, s * .45);
        c.closePath(); c.fill(); break;
      case 'pause':
        c.fillRect(-s * .35, -s * .45, s * .25, s * .9);
        c.fillRect(s * .1, -s * .45, s * .25, s * .9); break;
      case 'star':
        G.star(c, 0, 0, s * .5, s * .22, 5, -Math.PI / 2, color); break;
      case 'lock':
        G.fillRound(c, -s * .35, -s * .1, s * .7, s * .55, s * .1, color);
        c.beginPath(); c.arc(0, -s * .12, s * .24, Math.PI, 0); c.stroke(); break;
      case 'check':
        c.beginPath(); c.moveTo(-s * .35, 0); c.lineTo(-s * .08, s * .3); c.lineTo(s * .38, -s * .32);
        c.stroke(); break;
      case 'cross':
        c.beginPath(); c.moveTo(-s * .32, -s * .32); c.lineTo(s * .32, s * .32);
        c.moveTo(s * .32, -s * .32); c.lineTo(-s * .32, s * .32); c.stroke(); break;
      case 'gear':
        G.ngon(c, 0, 0, s * .45, 8, 0, color);
        c.globalCompositeOperation = 'destination-out';
        G.circle(c, 0, 0, s * .18, '#000');
        c.globalCompositeOperation = 'source-over';
        break;
    }
    c.restore();
  };
})(SG);
