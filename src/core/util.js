/* ------------------------------------------------------------------
   Kleine Helfer: Mathematik, Zufall, Formatierung, Ereignisse.
   Absichtlich allokationsarm - vieles davon laeuft in Spiel-Hot-Loops.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util = {};

  /* ---------------------------------------------------------- Mathematik */

  U.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  U.lerp = function (a, b, t) { return a + (b - a) * t; };
  U.inv = function (a, b, v) { return b === a ? 0 : (v - a) / (b - a); };
  U.round = function (v, d) { var p = Math.pow(10, d || 0); return Math.round(v * p) / p; };
  U.sign = function (v) { return v < 0 ? -1 : (v > 0 ? 1 : 0); };
  U.dist = function (ax, ay, bx, by) { var dx = bx - ax, dy = by - ay; return Math.sqrt(dx * dx + dy * dy); };
  U.dist2 = function (ax, ay, bx, by) { var dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; };
  U.mod = function (a, n) { return ((a % n) + n) % n; };
  U.angleDiff = function (a, b) { return U.mod(b - a + Math.PI, Math.PI * 2) - Math.PI; };

  /* Bewegt v Richtung t, hoechstens um step */
  U.approach = function (v, t, step) {
    if (v < t) return Math.min(v + step, t);
    if (v > t) return Math.max(v - step, t);
    return t;
  };

  /* Zeitunabhaengige Daempfung (statt v *= 0.9 pro Frame) */
  U.damp = function (v, t, rate, dt) { return t + (v - t) * Math.exp(-rate * dt); };

  U.easeOut = function (t) { return 1 - (1 - t) * (1 - t); };
  U.easeIn = function (t) { return t * t; };
  U.easeInOut = function (t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
  U.easeOutCubic = function (t) { return 1 - Math.pow(1 - t, 3); };
  U.easeOutBack = function (t) {
    var c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  };
  U.easeOutElastic = function (t) {
    if (t === 0 || t === 1) return t;
    var c4 = (2 * Math.PI) / 3;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  };

  /* Rechteck-Ueberlappung */
  U.hit = function (ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  };
  U.inRect = function (px, py, x, y, w, h) {
    return px >= x && px <= x + w && py >= y && py <= y + h;
  };

  /* ---------------------------------------------------------- Zufall */

  /* Deterministischer Generator (mulberry32) - fuer Level und Tests */
  U.rng = function (seed) {
    var a = (seed >>> 0) || 1;
    var f = function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.int = function (n) { return Math.floor(f() * n); };
    f.range = function (a2, b2) { return a2 + f() * (b2 - a2); };
    f.irange = function (a2, b2) { return a2 + Math.floor(f() * (b2 - a2 + 1)); };
    f.pick = function (arr) { return arr[Math.floor(f() * arr.length)]; };
    f.chance = function (p) { return f() < p; };
    f.shuffle = function (arr) {
      for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(f() * (i + 1)), t2 = arr[i];
        arr[i] = arr[j]; arr[j] = t2;
      }
      return arr;
    };
    /* Gewichtete Auswahl: items = [{w:zahl, ...}] */
    f.weighted = function (items, key) {
      var k = key || 'w', total = 0, i;
      for (i = 0; i < items.length; i++) total += items[i][k] || 0;
      if (total <= 0) return items[0];
      var r = f() * total;
      for (i = 0; i < items.length; i++) {
        r -= items[i][k] || 0;
        if (r <= 0) return items[i];
      }
      return items[items.length - 1];
    };
    /* Normalverteilung (Box-Muller), gekappt */
    f.normal = function (mean, sd) {
      var u = 1 - f(), v = f();
      var n = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
      return mean + U.clamp(n, -3, 3) * sd;
    };
    f.seedOf = function () { return a; };
    return f;
  };

  /* Nicht-deterministischer Standardgenerator */
  U.rnd = U.rng((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0);

  U.pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  U.shuffle = function (arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)), t = arr[i];
      arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };
  U.irand = function (a, b) { return a + Math.floor(Math.random() * (b - a + 1)); };

  /* Tageszahl - fuer den taeglichen Woertle-Modus */
  U.dayIndex = function (d) {
    var t = d || new Date();
    return Math.floor(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()) / 86400000);
  };

  /* ---------------------------------------------------------- Formatierung */

  var nf0, nf1, nf2;
  try {
    nf0 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
    nf1 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    nf2 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } catch (e) { /* Fallback unten */ }

  function group(n) {
    var s = String(Math.abs(Math.round(n))), out = '';
    for (var i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 === 0) out += '.';
      out += s[i];
    }
    return (n < 0 ? '-' : '') + out;
  }

  U.num = function (n, d) {
    if (!isFinite(n)) return '0';
    if (d === 1) return nf1 ? nf1.format(n) : (Math.round(n * 10) / 10).toFixed(1).replace('.', ',');
    if (d === 2) return nf2 ? nf2.format(n) : n.toFixed(2).replace('.', ',');
    return nf0 ? nf0.format(Math.round(n)) : group(n);
  };

  /* Kompakt: 1,2 Mio. - fuer enge Leisten */
  U.short = function (n) {
    var a = Math.abs(n);
    if (a >= 1e9) return U.num(n / 1e9, 1) + ' Mrd.';
    if (a >= 1e6) return U.num(n / 1e6, 1) + ' Mio.';
    if (a >= 1e4) return U.num(n / 1e3, 0) + ' Tsd.';
    return U.num(n);
  };

  U.euro = function (n, compact) {
    var v = compact ? U.short(n) : U.num(n);
    return v + ' €';
  };
  U.eurSigned = function (n) { return (n > 0 ? '+' : '') + U.euro(n, true); };
  U.pct = function (v, d) { return U.num(v * 100, d === undefined ? 0 : d) + ' %'; };

  /* mm:ss bzw. h:mm:ss */
  U.time = function (sec) {
    sec = Math.max(0, Math.floor(sec));
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    var p = function (x) { return x < 10 ? '0' + x : String(x); };
    return h > 0 ? h + ':' + p(m) + ':' + p(s) : m + ':' + p(s);
  };

  /* Dauer in Worten: "3 Tage 4 Std." */
  U.dur = function (hours) {
    if (hours < 1) return Math.max(1, Math.round(hours * 60)) + ' Min.';
    if (hours < 24) return U.num(hours, hours < 10 ? 1 : 0) + ' Std.';
    var d = Math.floor(hours / 24), h = Math.round(hours % 24);
    return d + ' Tg.' + (h ? ' ' + h + ' Std.' : '');
  };

  var MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  var MONTHS_S = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun',
    'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  var DAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  U.MONTHS = MONTHS; U.MONTHS_S = MONTHS_S; U.DAYS = DAYS;

  /* Spielzeit als Datum: startet am 1. Maerz eines Jahres */
  U.gameDate = function (dayNum, startYear) {
    var d = new Date(Date.UTC(startYear || 2026, 2, 1));
    d.setUTCDate(d.getUTCDate() + Math.floor(dayNum));
    return d;
  };
  U.dateShort = function (d) {
    return d.getUTCDate() + '. ' + MONTHS_S[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
  };

  U.plural = function (n, one, many) { return n === 1 ? one : (many || one + 'e'); };
  U.cap = function (s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; };

  /* Kurzt Text mit Auslassungszeichen */
  U.trunc = function (s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; };

  /* ---------------------------------------------------------- Datenhelfer */

  U.clone = function (o) {
    if (o === null || typeof o !== 'object') return o;
    if (Array.isArray(o)) {
      var a = new Array(o.length);
      for (var i = 0; i < o.length; i++) a[i] = U.clone(o[i]);
      return a;
    }
    var r = {};
    for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) r[k] = U.clone(o[k]);
    return r;
  };

  U.assign = function (t) {
    for (var i = 1; i < arguments.length; i++) {
      var s = arguments[i];
      if (!s) continue;
      for (var k in s) if (Object.prototype.hasOwnProperty.call(s, k)) t[k] = s[k];
    }
    return t;
  };

  U.sum = function (arr, f) {
    var t = 0;
    for (var i = 0; i < arr.length; i++) t += f ? f(arr[i], i) : arr[i];
    return t;
  };
  U.maxBy = function (arr, f) {
    var best = null, bv = -Infinity;
    for (var i = 0; i < arr.length; i++) { var v = f(arr[i]); if (v > bv) { bv = v; best = arr[i]; } }
    return best;
  };
  U.minBy = function (arr, f) {
    var best = null, bv = Infinity;
    for (var i = 0; i < arr.length; i++) { var v = f(arr[i]); if (v < bv) { bv = v; best = arr[i]; } }
    return best;
  };
  U.countBy = function (arr, f) {
    var n = 0;
    for (var i = 0; i < arr.length; i++) if (f(arr[i], i)) n++;
    return n;
  };
  U.remove = function (arr, item) {
    var i = arr.indexOf(item);
    if (i >= 0) arr.splice(i, 1);
    return i >= 0;
  };
  U.range = function (n) { var a = new Array(n); for (var i = 0; i < n; i++) a[i] = i; return a; };

  U.uid = (function () {
    var n = 0;
    return function (p) { n++; return (p || 'id') + '_' + n.toString(36) + Date.now().toString(36).slice(-4); };
  })();

  /* ---------------------------------------------------------- Base64 (Unicode-fest) */

  U.b64enc = function (str) {
    try {
      var bytes = new TextEncoder().encode(str);
      var bin = '';
      for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      return btoa(bin);
    } catch (e) { return btoa(unescape(encodeURIComponent(str))); }
  };
  U.b64dec = function (b64) {
    try {
      var bin = atob(b64.replace(/\s+/g, ''));
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new TextDecoder().decode(bytes);
    } catch (e) { return decodeURIComponent(escape(atob(b64))); }
  };

  /* ---------------------------------------------------------- Ereignisse */

  U.emitter = function () {
    var map = {};
    return {
      on: function (k, fn) { (map[k] || (map[k] = [])).push(fn); return fn; },
      off: function (k, fn) { if (map[k]) U.remove(map[k], fn); },
      emit: function (k) {
        var l = map[k];
        if (!l) return;
        var args = Array.prototype.slice.call(arguments, 1);
        for (var i = 0; i < l.length; i++) {
          try { l[i].apply(null, args); } catch (e) { SG.noteError('emit:' + k, e); }
        }
      },
      clear: function () { map = {}; },
    };
  };

  /* ---------------------------------------------------------- Objekt-Pool */

  /* Verhindert Allokationen pro Frame (Partikel, Geschosse, Container ...) */
  U.pool = function (factory, reset, size) {
    var free = [], live = [];
    for (var i = 0; i < (size || 0); i++) free.push(factory());
    return {
      live: live,
      get: function () {
        var o = free.length ? free.pop() : factory();
        live.push(o);
        return o;
      },
      release: function (o) {
        var i = live.indexOf(o);
        if (i < 0) return;
        live.splice(i, 1);
        if (reset) reset(o);
        free.push(o);
      },
      /* Rueckwaerts durchlaufen und filtern - keine neuen Arrays */
      sweep: function (keep) {
        for (var j = live.length - 1; j >= 0; j--) {
          if (!keep(live[j])) {
            var o = live[j];
            live.splice(j, 1);
            if (reset) reset(o);
            free.push(o);
          }
        }
      },
      clear: function () {
        while (live.length) {
          var o = live.pop();
          if (reset) reset(o);
          free.push(o);
        }
      },
      count: function () { return live.length; },
    };
  };

  /* ---------------------------------------------------------- Zeitscheiben */

  /* Fuehrt einen Generator in Haeppchen aus, damit die Oberflaeche nicht
     einfriert. Ersatz fuer Web-Worker, die unter file:// fehlen. */
  U.slice = function (gen, budgetMs, onDone, onProgress) {
    var it = gen, stopped = false;
    function step() {
      if (stopped) return;
      var t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      var res;
      do {
        res = it.next();
        if (res.done) { if (onDone) onDone(res.value); return; }
        if (onProgress && res.value !== undefined) onProgress(res.value);
      } while ((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0 < (budgetMs || 8));
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(step);
      else setTimeout(step, 0);
    }
    step();
    return { cancel: function () { stopped = true; } };
  };

  U.throttle = function (fn, ms) {
    var last = 0, timer = 0, lastArgs = null;
    return function () {
      lastArgs = arguments;
      var now = Date.now();
      if (now - last >= ms) { last = now; fn.apply(null, lastArgs); }
      else if (!timer) {
        timer = setTimeout(function () {
          timer = 0; last = Date.now(); fn.apply(null, lastArgs);
        }, ms - (now - last));
      }
    };
  };

  U.debounce = function (fn, ms) {
    var t = 0;
    return function () {
      var args = arguments;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(null, args); }, ms);
    };
  };

  U.now = function () {
    return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
  };

  /* ---------------------------------------------------------- Farben */

  U.hsl = function (h, s, l, a) {
    return 'hsla(' + Math.round(h) + ',' + Math.round(s) + '%,' + Math.round(l) + '%,' +
      (a === undefined ? 1 : U.round(a, 3)) + ')';
  };
  U.rgba = function (r, g, b, a) {
    return 'rgba(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ',' + (a === undefined ? 1 : U.round(a, 3)) + ')';
  };
  /* Mischt zwei #rrggbb-Farben */
  U.mixHex = function (a, b, t) {
    var pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    var r = Math.round(U.lerp((pa >> 16) & 255, (pb >> 16) & 255, t));
    var g = Math.round(U.lerp((pa >> 8) & 255, (pb >> 8) & 255, t));
    var bl = Math.round(U.lerp(pa & 255, pb & 255, t));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
  };
  U.shade = function (hex, amt) {
    return U.mixHex(hex, amt > 0 ? '#ffffff' : '#000000', Math.abs(amt));
  };

  /* Farbpalette der App - auch fuer Canvas-Zeichnungen */
  U.C = {
    bg: '#0b0e15', panel: '#191f2e', panel2: '#212a3d', line: '#2f3a55',
    text: '#e9edf6', muted: '#8794b1', dim: '#5f6a85',
    gold: '#f0b429', gold2: '#ffd166', green: '#3ddc84', red: '#ff5f6b',
    blue: '#4aa3ff', purple: '#a97bff', cyan: '#34d3d3', orange: '#ff9c3f',
    water: '#123049', water2: '#0d2338', quay: '#4a5163', asphalt: '#242a36',
  };
})(SG);
