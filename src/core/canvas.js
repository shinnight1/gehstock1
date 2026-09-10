/* ------------------------------------------------------------------
   Verwaltete Canvas-Flaeche.

   Kuemmert sich um Pixeldichte (auf dem iPad ist devicePixelRatio 2),
   Groessenaenderungen und Drehung. Gezeichnet wird immer in CSS-Pixeln,
   die Skalierung passiert einmal im Kontext.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;

  var Canvas = SG.canvas = {};

  Canvas.create = function (parent, opts) {
    opts = opts || {};
    var el = document.createElement('canvas');
    el.style.touchAction = 'none';
    if (opts.className) el.className = opts.className;
    parent.appendChild(el);

    var ctx = el.getContext('2d', {
      alpha: opts.alpha !== false,
      desynchronized: opts.desynchronized !== false,
    });

    var api = {
      el: el,
      ctx: ctx,
      w: 1, h: 1, dpr: 1,
      onResize: opts.onResize || null,
    };

    var pending = 0;

    function measure() {
      var r = parent.getBoundingClientRect();
      var cssW = Math.max(1, Math.round(r.width));
      var cssH = Math.max(1, Math.round(r.height));

      // Pixeldichte deckeln: bei partikelreichen Spielen spart 1.5 spuerbar Fuellrate
      var cap = opts.maxDpr || (SG.settings.get('reduced') ? 1.25 : 2);
      var dpr = Math.min(window.devicePixelRatio || 1, cap);

      // Sehr grosse Flaechen zusaetzlich begrenzen (Speicher auf dem iPad)
      var maxPix = opts.maxPixels || 4.2e6;
      if (cssW * cssH * dpr * dpr > maxPix) {
        dpr = Math.max(1, Math.sqrt(maxPix / (cssW * cssH)));
      }

      var bw = Math.round(cssW * dpr), bh = Math.round(cssH * dpr);
      if (el.width !== bw || el.height !== bh) {
        el.width = bw;
        el.height = bh;
      }
      el.style.width = cssW + 'px';
      el.style.height = cssH + 'px';

      api.w = cssW; api.h = cssH; api.dpr = dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = opts.smooth !== false;

      if (api.onResize) {
        try { api.onResize(cssW, cssH, dpr); } catch (e) { SG.noteError('canvas.resize', e); }
      }
    }

    function schedule() {
      if (pending) return;
      pending = requestAnimationFrame(function () { pending = 0; measure(); });
    }

    var ro = null;
    if (window.ResizeObserver) {
      ro = new ResizeObserver(schedule);
      ro.observe(parent);
    }
    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', schedule);

    api.resize = measure;
    api.schedule = schedule;

    /* Setzt den Transform zurueck und loescht die Flaeche */
    api.clear = function (color) {
      ctx.setTransform(api.dpr, 0, 0, api.dpr, 0, 0);
      if (color) { ctx.fillStyle = color; ctx.fillRect(0, 0, api.w, api.h); }
      else ctx.clearRect(0, 0, api.w, api.h);
    };

    /* Koordinaten eines Zeigers in Canvas-CSS-Pixeln */
    api.pos = function (ev, out) {
      var r = el.getBoundingClientRect();
      var o = out || {};
      o.x = (ev.clientX - r.left) * (api.w / r.width);
      o.y = (ev.clientY - r.top) * (api.h / r.height);
      return o;
    };

    api.destroy = function () {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('orientationchange', schedule);
      if (pending) cancelAnimationFrame(pending);
      if (el.parentNode) el.parentNode.removeChild(el);
      api.ctx = null;
    };

    measure();
    return api;
  };

  /* ------------------------------------------------------------------
     Statische Ebene: einmal zeichnen, danach nur noch drawImage.
     Fuer Labyrinthe, Terminaluntergrund, Kartenraster.
     ------------------------------------------------------------------ */

  Canvas.layer = function (w, h, dpr) {
    var d = dpr || 1;
    var cv = SG.gfx.newCanvas(w * d, h * d);
    var c = cv.getContext('2d');
    c.setTransform(d, 0, 0, d, 0, 0);
    return {
      canvas: cv,
      ctx: c,
      w: w, h: h, dpr: d,
      dirty: true,
      /* Neu zeichnen, falls noetig */
      ensure: function (draw) {
        if (!this.dirty) return;
        c.setTransform(d, 0, 0, d, 0, 0);
        c.clearRect(0, 0, w, h);
        draw(c, w, h);
        this.dirty = false;
      },
      invalidate: function () { this.dirty = true; },
      blit: function (target, x, y) {
        target.drawImage(cv, x || 0, y || 0, w, h);
      },
    };
  };

  /* ------------------------------------------------------------------
     Sichtfenster mit Verschieben und Zwei-Finger-Zoom.
     Wird von beiden Tycoons benutzt.
     ------------------------------------------------------------------ */

  Canvas.viewport = function (o) {
    o = o || {};
    var vp = {
      x: o.x || 0, y: o.y || 0,     // Weltkoordinate links oben
      scale: o.scale || 1,
      min: o.min || 0.35,
      max: o.max || 3,
      worldW: o.worldW || 1000,
      worldH: o.worldH || 1000,
      viewW: 1, viewH: 1,
      margin: o.margin === undefined ? 80 : o.margin,
    };

    vp.setView = function (w, h) { vp.viewW = w; vp.viewH = h; vp.clamp(); };

    vp.toScreen = function (wx, wy, out) {
      var r = out || {};
      r.x = (wx - vp.x) * vp.scale;
      r.y = (wy - vp.y) * vp.scale;
      return r;
    };
    vp.toWorld = function (sx, sy, out) {
      var r = out || {};
      r.x = sx / vp.scale + vp.x;
      r.y = sy / vp.scale + vp.y;
      return r;
    };

    vp.pan = function (dx, dy) {
      vp.x -= dx / vp.scale;
      vp.y -= dy / vp.scale;
      vp.clamp();
    };

    /* Zoomt um einen Bildschirmpunkt herum */
    vp.zoomAt = function (sx, sy, factor) {
      var before = vp.toWorld(sx, sy);
      vp.scale = U.clamp(vp.scale * factor, vp.min, vp.max);
      var after = vp.toWorld(sx, sy);
      vp.x += before.x - after.x;
      vp.y += before.y - after.y;
      vp.clamp();
    };

    vp.clamp = function () {
      var m = vp.margin / vp.scale;
      var visW = vp.viewW / vp.scale, visH = vp.viewH / vp.scale;
      if (visW >= vp.worldW + m * 2) vp.x = (vp.worldW - visW) / 2;
      else vp.x = U.clamp(vp.x, -m, vp.worldW - visW + m);
      if (visH >= vp.worldH + m * 2) vp.y = (vp.worldH - visH) / 2;
      else vp.y = U.clamp(vp.y, -m, vp.worldH - visH + m);
    };

    vp.centerOn = function (wx, wy) {
      vp.x = wx - vp.viewW / (2 * vp.scale);
      vp.y = wy - vp.viewH / (2 * vp.scale);
      vp.clamp();
    };

    vp.fit = function (pad) {
      var p = pad || 20;
      vp.scale = U.clamp(
        Math.min((vp.viewW - p * 2) / vp.worldW, (vp.viewH - p * 2) / vp.worldH),
        vp.min, vp.max);
      vp.centerOn(vp.worldW / 2, vp.worldH / 2);
    };

    /* Sichtbarer Weltausschnitt - fuer Culling */
    vp.bounds = function (out) {
      var r = out || {};
      r.x0 = vp.x; r.y0 = vp.y;
      r.x1 = vp.x + vp.viewW / vp.scale;
      r.y1 = vp.y + vp.viewH / vp.scale;
      return r;
    };

    vp.apply = function (c) {
      c.translate(-vp.x * vp.scale, -vp.y * vp.scale);
      c.scale(vp.scale, vp.scale);
    };

    return vp;
  };
})(SG);
