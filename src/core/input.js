/* ------------------------------------------------------------------
   Eingabe: Zeiger, Gesten, Bildschirmtasten, Tastatur.

   Alles ueber Pointer Events, damit Maus und Finger denselben Weg
   nehmen. touch-action:none in der CSS plus preventDefault verhindern
   Scroll-Wippen, Doppeltipp-Zoom und die 300-ms-Verzoegerung.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var Input = SG.input = {};

  /* ---------------------------------------------------------- Gesten */

  Input.attach = function (el, o) {
    o = o || {};
    var tapMax = o.tapMax || 14;         // Bewegungstoleranz fuer einen Tipp
    var tapTime = o.tapTime || 320;
    var swipeMin = o.swipeMin || 26;
    var swipeTime = o.swipeTime || 500;
    var longMs = o.longPress || 480;

    var pointers = {};                    // id -> Zeigerzustand
    var count = 0;
    var lastTap = 0, lastTapX = 0, lastTapY = 0;
    var longTimer = 0;
    var pinch = null;

    /* Liegt die Geste ueber einem echten Bedienelement, haelt sich die
       Gestenschicht komplett heraus - sonst verschluckt preventDefault
       die Klicks auf Knoepfe innerhalb des Bereichs. */
    var IGNORE = o.ignore === undefined
      ? 'button, a, input, textarea, select, label, .btn, .pbtn, .no-gesture'
      : o.ignore;

    function skip(ev) {
      if (!IGNORE) return false;
      var t = ev.target;
      return !!(t && t.closest && t.closest(IGNORE));
    }

    function rect() { return el.getBoundingClientRect(); }

    function local(ev, p) {
      var r = rect();
      var sx = el.width && r.width ? (el.clientWidth || r.width) / r.width : 1;
      p.x = (ev.clientX - r.left) * sx;
      p.y = (ev.clientY - r.top) * sx;
      return p;
    }

    function down(ev) {
      if (ev.pointerType === 'mouse' && ev.button !== 0) return;
      if (skip(ev)) return;
      ev.preventDefault();
      try { el.setPointerCapture(ev.pointerId); } catch (e) { /* egal */ }

      var p = { id: ev.pointerId, x: 0, y: 0, x0: 0, y0: 0, dx: 0, dy: 0, t: Date.now(), moved: false, type: ev.pointerType };
      local(ev, p);
      p.x0 = p.x; p.y0 = p.y;
      pointers[ev.pointerId] = p;
      count++;

      if (count === 2 && o.onPinch) {
        var ids = Object.keys(pointers);
        var a = pointers[ids[0]], b = pointers[ids[1]];
        pinch = {
          d0: U.dist(a.x, a.y, b.x, b.y) || 1,
          last: 1,
          cx: (a.x + b.x) / 2,
          cy: (a.y + b.y) / 2,
        };
      }

      if (o.onLongPress) {
        clearTimeout(longTimer);
        longTimer = setTimeout(function () {
          var q = pointers[ev.pointerId];
          if (q && !q.moved && count === 1) {
            q.consumed = true;
            SG.settings.buzz(18);
            o.onLongPress(q.x, q.y, q);
          }
        }, longMs);
      }

      if (o.onDown) o.onDown(p, ev);
    }

    function move(ev) {
      var p = pointers[ev.pointerId];
      if (!p) {
        if (o.onHover) {
          var h = local(ev, { x: 0, y: 0 });
          o.onHover(h.x, h.y, ev);
        }
        return;
      }
      ev.preventDefault();
      var px = p.x, py = p.y;
      local(ev, p);
      p.dx = p.x - px; p.dy = p.y - py;
      if (!p.moved && U.dist(p.x, p.y, p.x0, p.y0) > tapMax) {
        p.moved = true;
        clearTimeout(longTimer);
      }

      if (pinch && count >= 2 && o.onPinch) {
        var ids = Object.keys(pointers);
        var a = pointers[ids[0]], b = pointers[ids[1]];
        if (a && b) {
          var d = U.dist(a.x, a.y, b.x, b.y) || 1;
          var cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
          var scale = d / pinch.d0;
          o.onPinch({
            scale: scale,
            dScale: scale / pinch.last,
            cx: cx, cy: cy,
            dcx: cx - pinch.cx, dcy: cy - pinch.cy,
          });
          pinch.last = scale;
          pinch.cx = cx; pinch.cy = cy;
        }
        return;
      }

      if (o.onMove) o.onMove(p, ev);
    }

    function up(ev) {
      var p = pointers[ev.pointerId];
      if (!p) return;
      ev.preventDefault();
      clearTimeout(longTimer);
      local(ev, p);
      delete pointers[ev.pointerId];
      count = Math.max(0, count - 1);
      if (count < 2) pinch = null;

      var dt = Date.now() - p.t;
      var dx = p.x - p.x0, dy = p.y - p.y0;
      var dist = Math.sqrt(dx * dx + dy * dy);

      if (o.onUp) o.onUp(p, ev);
      if (p.consumed) return;

      if (!p.moved && dt < tapTime && dist <= tapMax) {
        var now = Date.now();
        if (o.onDoubleTap && now - lastTap < 320 && U.dist(p.x, p.y, lastTapX, lastTapY) < 40) {
          lastTap = 0;
          o.onDoubleTap(p.x, p.y, p);
          return;
        }
        lastTap = now; lastTapX = p.x; lastTapY = p.y;
        if (o.onTap) o.onTap(p.x, p.y, p);
        return;
      }

      if (o.onSwipe && dist >= swipeMin && dt <= swipeTime) {
        var dir;
        if (Math.abs(dx) > Math.abs(dy)) dir = dx > 0 ? 'right' : 'left';
        else dir = dy > 0 ? 'down' : 'up';
        o.onSwipe(dir, dx, dy, dist / (dt / 1000), p);
      }
    }

    function cancel(ev) {
      clearTimeout(longTimer);
      if (pointers[ev.pointerId]) {
        if (o.onUp) o.onUp(pointers[ev.pointerId], ev);
        delete pointers[ev.pointerId];
        count = Math.max(0, count - 1);
      }
      if (count < 2) pinch = null;
    }

    function wheel(ev) {
      if (!o.onWheel) return;
      ev.preventDefault();
      var r = rect();
      o.onWheel(ev.deltaY, ev.clientX - r.left, ev.clientY - r.top, ev);
    }

    function ctx(ev) { ev.preventDefault(); }

    el.addEventListener('pointerdown', down, { passive: false });
    el.addEventListener('pointermove', move, { passive: false });
    el.addEventListener('pointerup', up, { passive: false });
    el.addEventListener('pointercancel', cancel, { passive: false });
    el.addEventListener('lostpointercapture', cancel, { passive: false });
    el.addEventListener('wheel', wheel, { passive: false });
    el.addEventListener('contextmenu', ctx);

    return {
      pointers: pointers,
      count: function () { return count; },
      detach: function () {
        clearTimeout(longTimer);
        el.removeEventListener('pointerdown', down);
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', cancel);
        el.removeEventListener('lostpointercapture', cancel);
        el.removeEventListener('wheel', wheel);
        el.removeEventListener('contextmenu', ctx);
      },
    };
  };

  /* ---------------------------------------------------------- Bildschirmtasten */

  /* spec: [{ name:'left', label:'◀', cls:'sm', repeat:true }, ...] */
  Input.pad = function (parent, spec, o) {
    o = o || {};
    var wrap = document.createElement('div');
    wrap.className = 'pad ' + (o.pos || 'bottom');
    if (o.style) wrap.setAttribute('style', o.style);

    var down = {};
    var pressed = {};
    var els = {};
    var repeaters = {};

    spec.forEach(function (s) {
      if (s.spacer) {
        var sp = document.createElement('div');
        sp.style.width = (s.spacer === true ? 20 : s.spacer) + 'px';
        wrap.appendChild(sp);
        return;
      }
      var b = document.createElement('button');
      b.className = 'pbtn ' + (s.cls || '');
      b.innerHTML = s.label;
      b.setAttribute('aria-label', s.aria || s.name);
      els[s.name] = b;

      var press = function (ev) {
        ev.preventDefault();
        if (down[s.name]) return;
        down[s.name] = true;
        pressed[s.name] = true;
        b.classList.add('down');
        SG.settings.buzz(8);
        if (o.onPress) o.onPress(s.name);
        if (s.repeat) {
          repeaters[s.name] = setTimeout(function tick() {
            if (!down[s.name]) return;
            pressed[s.name] = true;
            if (o.onPress) o.onPress(s.name, true);
            repeaters[s.name] = setTimeout(tick, s.rate || 70);
          }, s.delay || 260);
        }
        try { b.setPointerCapture(ev.pointerId); } catch (e) { /* egal */ }
      };
      var release = function (ev) {
        if (ev) ev.preventDefault();
        if (!down[s.name]) return;
        down[s.name] = false;
        b.classList.remove('down');
        clearTimeout(repeaters[s.name]);
        if (o.onRelease) o.onRelease(s.name);
      };

      b.addEventListener('pointerdown', press, { passive: false });
      b.addEventListener('pointerup', release, { passive: false });
      b.addEventListener('pointercancel', release, { passive: false });
      b.addEventListener('lostpointercapture', release, { passive: false });
      b.addEventListener('contextmenu', function (e) { e.preventDefault(); });

      wrap.appendChild(b);
    });

    parent.appendChild(wrap);

    return {
      el: wrap,
      btn: function (n) { return els[n]; },
      down: function (n) { return !!down[n]; },
      /* Einmaliges Auslesen (Flanke) */
      pressed: function (n) {
        if (pressed[n]) { pressed[n] = false; return true; }
        return false;
      },
      clear: function () { pressed = {}; },
      show: function (v) { wrap.style.display = v === false ? 'none' : ''; },
      destroy: function () {
        for (var k in repeaters) clearTimeout(repeaters[k]);
        if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      },
    };
  };

  /* Vier-Wege-Kreuz */
  Input.dpad = function (parent, o) {
    o = o || {};
    var wrap = document.createElement('div');
    wrap.className = 'pad ' + (o.pos || 'bl');
    var grid = document.createElement('div');
    grid.className = 'dpad';
    wrap.appendChild(grid);

    var down = {}, pressed = {}, timers = {};
    var dirs = [
      { n: 'up', c: 'u', l: '▲' },
      { n: 'left', c: 'l', l: '◀' },
      { n: 'right', c: 'r', l: '▶' },
      { n: 'down', c: 'd', l: '▼' },
    ];
    dirs.forEach(function (d) {
      var b = document.createElement('button');
      b.className = 'pbtn ' + d.c;
      b.innerHTML = d.l;
      b.setAttribute('aria-label', d.n);
      var press = function (ev) {
        ev.preventDefault();
        if (down[d.n]) return;
        down[d.n] = true; pressed[d.n] = true;
        b.classList.add('down');
        SG.settings.buzz(8);
        if (o.onPress) o.onPress(d.n);
        if (o.repeat) {
          timers[d.n] = setTimeout(function tick() {
            if (!down[d.n]) return;
            pressed[d.n] = true;
            if (o.onPress) o.onPress(d.n, true);
            timers[d.n] = setTimeout(tick, o.rate || 90);
          }, o.delay || 220);
        }
        try { b.setPointerCapture(ev.pointerId); } catch (e) { /* egal */ }
      };
      var rel = function (ev) {
        if (ev) ev.preventDefault();
        down[d.n] = false;
        pressed[d.n] = pressed[d.n];
        b.classList.remove('down');
        clearTimeout(timers[d.n]);
      };
      b.addEventListener('pointerdown', press, { passive: false });
      b.addEventListener('pointerup', rel, { passive: false });
      b.addEventListener('pointercancel', rel, { passive: false });
      b.addEventListener('lostpointercapture', rel, { passive: false });
      grid.appendChild(b);
    });

    parent.appendChild(wrap);
    return {
      el: wrap,
      down: function (n) { return !!down[n]; },
      pressed: function (n) { if (pressed[n]) { pressed[n] = false; return true; } return false; },
      show: function (v) { wrap.style.display = v === false ? 'none' : ''; },
      destroy: function () {
        for (var k in timers) clearTimeout(timers[k]);
        if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      },
    };
  };

  /* Analogstick fuer Asteroids & Co. */
  Input.stick = function (parent, o) {
    o = o || {};
    var wrap = document.createElement('div');
    wrap.className = 'pad ' + (o.pos || 'bl');
    var st = document.createElement('div');
    st.className = 'stick';
    var knob = document.createElement('div');
    knob.className = 'knob';
    st.appendChild(knob);
    wrap.appendChild(st);
    parent.appendChild(wrap);

    var state = { x: 0, y: 0, active: false, mag: 0, angle: 0 };
    var id = null, R = 44;

    function set(ev) {
      var r = st.getBoundingClientRect();
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      var dx = ev.clientX - cx, dy = ev.clientY - cy;
      var d = Math.sqrt(dx * dx + dy * dy);
      var k = d > R ? R / d : 1;
      var kx = dx * k, ky = dy * k;
      knob.style.transform = 'translate(' + kx + 'px,' + ky + 'px)';
      state.x = kx / R; state.y = ky / R;
      state.mag = Math.min(1, d / R);
      state.angle = Math.atan2(dy, dx);
    }

    st.addEventListener('pointerdown', function (ev) {
      ev.preventDefault();
      id = ev.pointerId;
      state.active = true;
      try { st.setPointerCapture(id); } catch (e) { /* egal */ }
      set(ev);
    }, { passive: false });

    st.addEventListener('pointermove', function (ev) {
      if (ev.pointerId !== id) return;
      ev.preventDefault();
      set(ev);
    }, { passive: false });

    var end = function (ev) {
      if (ev.pointerId !== id) return;
      id = null;
      state.active = false; state.x = 0; state.y = 0; state.mag = 0;
      knob.style.transform = '';
    };
    st.addEventListener('pointerup', end, { passive: false });
    st.addEventListener('pointercancel', end, { passive: false });
    st.addEventListener('lostpointercapture', end, { passive: false });

    return {
      el: wrap,
      state: state,
      show: function (v) { wrap.style.display = v === false ? 'none' : ''; },
      destroy: function () { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); },
    };
  };

  /* ---------------------------------------------------------- Tastatur */

  /* Fuer die Entwicklung am Rechner und externe Tastaturen am iPad */
  Input.keys = function (o) {
    o = o || {};
    var down = {}, pressed = {};
    /* Aeltere Browser und manche Automatisierungen melden "Left" statt
       "ArrowLeft" - beides auf denselben Namen bringen. */
    var ALIAS = {
      left: 'arrowleft', right: 'arrowright', up: 'arrowup', down: 'arrowdown',
      esc: 'escape', spacebar: 'space', ' ': 'space', del: 'delete',
    };
    function norm(e) {
      var k = String(e.key || '').toLowerCase();
      return ALIAS[k] || k;
    }
    function kd(e) {
      if (e.metaKey || e.ctrlKey) return;
      var k = norm(e);
      if (o.prevent !== false && PREVENT[k]) e.preventDefault();
      if (!down[k]) pressed[k] = true;
      down[k] = true;
      if (o.onDown) o.onDown(k, e);
    }
    function ku(e) {
      var k = norm(e);
      down[k] = false;
      if (o.onUp) o.onUp(k, e);
    }
    var PREVENT = {
      arrowup: 1, arrowdown: 1, arrowleft: 1, arrowright: 1, space: 1,
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return {
      down: function (k) { return !!down[k]; },
      any: function () {
        for (var i = 0; i < arguments.length; i++) if (down[arguments[i]]) return true;
        return false;
      },
      pressed: function (k) { if (pressed[k]) { pressed[k] = false; return true; } return false; },
      axis: function (neg, pos) { return (down[pos] ? 1 : 0) - (down[neg] ? 1 : 0); },
      clear: function () { down = {}; pressed = {}; },
      destroy: function () {
        window.removeEventListener('keydown', kd);
        window.removeEventListener('keyup', ku);
      },
    };
  };
})(SG);
