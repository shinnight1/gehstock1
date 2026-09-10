/* ------------------------------------------------------------------
   Spielschleife mit festem Simulationstakt.

   update() laeuft immer mit derselben Schrittweite (Physik bleibt
   reproduzierbar), render() laeuft einmal pro Bild mit einem
   Interpolationsfaktor. Bei verstecktem Tab wird pausiert statt
   nachgeholt - sonst springt das Spiel nach dem Zurueckkehren.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;

  SG.loop = {};

  SG.loop.create = function (o) {
    var hz = o.hz || 60;
    var step = 1 / hz;
    var maxSteps = o.maxSteps || 5;
    var update = o.update || function () {};
    var render = o.render || function () {};
    var onPause = o.onPause || null;
    var onResume = o.onResume || null;

    var raf = 0, last = 0, acc = 0;
    var running = false, paused = false, manual = false;
    var fpsT = 0, fpsN = 0;

    var L = {
      fps: 0,
      time: 0,          // Spielzeit in Sekunden (ohne Pausen)
      frames: 0,
      speed: 1,         // Zeitraffer, z. B. fuer Tycoons

      get running() { return running; },
      get paused() { return paused; },
    };

    function frame(t) {
      if (!running) return;
      raf = requestAnimationFrame(frame);

      if (!last) last = t;
      var real = (t - last) / 1000;
      last = t;

      // Nach langem Ausbleiben (Tabwechsel) nicht nachrechnen
      if (real > 0.25) real = step;

      fpsN++;
      fpsT += real;
      if (fpsT >= 0.5) { L.fps = Math.round(fpsN / fpsT); fpsN = 0; fpsT = 0; }

      if (!paused) {
        acc += real * L.speed;
        var n = 0;
        while (acc >= step && n < maxSteps) {
          try { update(step); }
          catch (e) { SG.noteError('loop.update', e); paused = true; break; }
          L.time += step;
          acc -= step;
          n++;
        }
        if (n >= maxSteps) acc = 0;   // Aufholen aufgeben statt einzufrieren
      }

      L.frames++;
      try { render(paused ? 0 : acc / step, real); }
      catch (e) { SG.noteError('loop.render', e); }
    }

    L.start = function () {
      if (running) return L;
      running = true; paused = manual; last = 0; acc = 0;
      raf = requestAnimationFrame(frame);
      return L;
    };

    L.stop = function () {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      return L;
    };

    L.pause = function (byUser) {
      if (byUser) manual = true;
      if (paused) return L;
      paused = true;
      if (onPause) { try { onPause(); } catch (e) { SG.noteError('loop.onPause', e); } }
      return L;
    };

    L.resume = function (byUser) {
      if (byUser) manual = false;
      if (!paused) return L;
      if (manual && !byUser) return L;    // vom Nutzer pausiert: nicht automatisch fortsetzen
      paused = false; last = 0; acc = 0;
      if (onResume) { try { onResume(); } catch (e) { SG.noteError('loop.onResume', e); } }
      return L;
    };

    L.toggle = function () { return paused ? (L.resume(true), false) : (L.pause(true), true); };

    L.setSpeed = function (s) { L.speed = s; return L; };

    /* Headless: n feste Schritte rechnen, ohne zu zeichnen (Selbsttest) */
    L.tick = function (n) {
      for (var i = 0; i < (n || 1); i++) {
        update(step);
        L.time += step;
      }
      return L;
    };

    /* Ein Bild zeichnen, ohne die Schleife zu starten */
    L.drawOnce = function () { render(0, 0); return L; };

    /* --- Automatisches Pausieren ---

       Beim Verlassen des Fensters anzuhalten spart Akku und verhindert,
       dass ein Spiel im Hintergrund weiterlaeuft. Im Online-Spiel ist das
       aber falsch: wer gerade am anderen Geraet zieht, nimmt dem ersten
       den Fokus - und dort bliebe der Zug des Gegners einfach stehen, bis
       man das Fenster wieder antippt. Genau das fuehlt sich wie mehrere
       Sekunden Verzoegerung an. Mit L.keepAwake zaehlt deshalb nur noch,
       ob die Seite wirklich verdeckt ist. */
    L.keepAwake = false;

    function onVis() {
      if (document.hidden) L.pause();
      else L.resume();
    }
    function onBlur() { if (!L.keepAwake) L.pause(); }
    function onFocus() { L.resume(); }

    /* Die Tarnung haelt IMMER an, auch im Online-Spiel: waehrend der
       Deckel liegt, soll nichts weiterticken, was man hinterher nicht
       mehr aufholen kann. */
    function onTarn(e) { if (e && e.detail) L.pause(); else L.resume(); }

    if (o.autoPause !== false) {
      document.addEventListener('visibilitychange', onVis);
      window.addEventListener('blur', onBlur);
      window.addEventListener('focus', onFocus);
      window.addEventListener('hgh:tarnung', onTarn);
    }

    L.destroy = function () {
      L.stop();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('hgh:tarnung', onTarn);
    };

    return L;
  };

  /* ------------------------------------------------------------------
     Getakteter Zaehler: liefert true, sobald ein Intervall voll ist.
     Fuer "alle 0,4 s ein Gegner", ohne setInterval.
     ------------------------------------------------------------------ */

  SG.loop.timer = function (interval) {
    var t = 0, iv = interval;
    return {
      set: function (v) { iv = v; },
      reset: function (v) { t = v === undefined ? 0 : v; },
      /* Gibt zurueck, wie oft das Intervall in dt voll wurde */
      step: function (dt) {
        t += dt;
        var n = 0;
        while (t >= iv) { t -= iv; n++; if (n > 8) { t = 0; break; } }
        return n;
      },
      /* Anteil bis zum naechsten Ausloesen, 0..1 */
      frac: function () { return U.clamp(t / iv, 0, 1); },
      left: function () { return Math.max(0, iv - t); },
    };
  };

  /* Countdown, der genau einmal ausloest */
  SG.loop.delay = function (sec, fn) {
    var t = sec, done = false;
    return {
      step: function (dt) {
        if (done) return false;
        t -= dt;
        if (t <= 0) { done = true; if (fn) fn(); return true; }
        return false;
      },
      left: function () { return Math.max(0, t); },
      frac: function () { return U.clamp(1 - t / sec, 0, 1); },
      done: function () { return done; },
      reset: function (s) { t = s === undefined ? sec : s; done = false; },
    };
  };
})(SG);
