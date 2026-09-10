/* ------------------------------------------------------------------
   Spiel-Wirt.

   Jedes Spiel bekommt einen Host: Leiste, Buehne, Schleife, Eingabe,
   Bestwerte, Overlays. Der Host raeumt beim Verlassen alles wieder ab,
   damit nichts im Hintergrund weiterlaeuft.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var UI = SG.ui;

  SG.host = {};

  SG.host.create = function (def, parent, o) {
    o = o || {};
    var cleanups = [];
    var bus = U.emitter();
    var destroyed = false;

    var root = UI.el('div.gameview');
    var bar = UI.el('div.gamebar');
    var stage = UI.el('div.stage');

    var backBtn = UI.el('button.back', {
      html: '‹', 'aria-label': 'Zurück',
      on: { click: function () { H.exit(); } },
    });
    var title = UI.el('div.gtitle', { text: def.name });
    var stats = UI.el('div.stats');
    var tools = UI.el('div.tools');

    bar.appendChild(backBtn);
    bar.appendChild(title);
    bar.appendChild(stats);
    bar.appendChild(UI.el('div.spacer'));
    bar.appendChild(tools);

    root.appendChild(bar);
    root.appendChild(stage);
    parent.appendChild(root);

    var loops = [];
    var canvases = [];
    var inputs = [];
    var pads = [];

    var H = {
      def: def,
      id: def.id,
      root: root,
      bar: bar,
      stage: stage,
      /* Nach dem Abraeumen und waehrend des Selbsttests darf ein Spiel
         nichts mehr schreiben - verspaetete Zeitgeber wuerden sonst
         noch in die Einstellungen des Spielers hineinfunken. */
      store: (function (ns) {
        return {
          get: ns.get,
          set: function (k, v) {
            if (destroyed) return false;
            if (SG.selftest && SG.selftest.active) return false;
            return ns.set(k, v);
          },
          del: ns.del,
          keys: ns.keys,
          clear: ns.clear,
        };
      })(SG.storage.ns('g:' + def.id)),
      online: null,          // wird vom Netzmodul gesetzt
      onDestroy: function (fn) { cleanups.push(fn); },
      on: bus.on,
      off: bus.off,
      emit: bus.emit,
    };

    /* ---------------------------------------------------------- Leiste */

    H.setTitle = function (t) { title.textContent = t; };

    H.stat = function (key, value, cls) {
      var s = UI.stat(key, value, cls);
      stats.appendChild(s);
      return s;
    };

    H.clearStats = function () { UI.clear(stats); };

    H.tool = function (label, onClick, cls) {
      var b = UI.el('button.tool' + (cls ? '.' + cls.split(' ').join('.') : ''), {
        html: label,
        on: {
          click: function () {
            SG.audio.play('click');
            SG.settings.buzz(8);
            if (onClick) onClick(b);
          },
        },
      });
      tools.appendChild(b);
      b.setLabel = function (h) { b.innerHTML = h; };
      b.setOn = function (v) { b.classList.toggle('on', !!v); };
      return b;
    };

    /* Standard-Pausenknopf, der die Schleife steuert */
    H.pauseTool = function (loop, onPause) {
      var b = H.tool('❚❚', function () {
        var nowPaused = loop.toggle();
        b.setLabel(nowPaused ? '▶' : '❚❚');
        if (onPause) onPause(nowPaused);
        if (nowPaused) H.showPause(function () {
          loop.resume(true);
          b.setLabel('❚❚');
          if (onPause) onPause(false);
        });
      });
      return b;
    };

    /* Kleines Menue rechts oben */
    H.menuTool = function (items) {
      return H.tool('⋯', function () {
        var body = UI.el('div');
        items.forEach(function (it) {
          if (!it) return;
          body.appendChild(UI.el('div.item.tap', {
            on: { click: function () { m.close(); it.onClick(); } },
          }, [
            UI.el('div.thumb', { text: it.icon || '•' }),
            UI.el('div.main', null, [
              UI.el('div.t', { text: it.label }),
              it.desc ? UI.el('div.d', { text: it.desc }) : null,
            ]),
          ]));
        });
        var m = UI.modal({ title: 'Optionen', body: body, parent: root });
      });
    };

    /* ---------------------------------------------------------- Buehne */

    H.canvas = function (opts) {
      var c = SG.canvas.create(stage, opts || {});
      canvases.push(c);
      return c;
    };

    H.sheet = function (cls) {
      var s = UI.el('div.sheet' + (cls ? '.' + cls : ''));
      stage.appendChild(s);
      return s;
    };

    H.loop = function (opts) {
      var l = SG.loop.create(opts);
      loops.push(l);
      if (awake) { l.keepAwake = true; }
      return l;
    };

    /* Im Online-Spiel darf die Schleife beim Fokusverlust nicht anhalten -
       sonst friert der Zug des Gegners ein, sobald man am anderen Geraet
       tippt. Nur eine wirklich verdeckte Seite pausiert dann noch. */
    var awake = false;
    H.keepAwake = function (on) {
      awake = !!on;
      loops.forEach(function (l) {
        l.keepAwake = awake;
        if (awake) l.resume();
      });
    };

    H.input = function (opts) {
      var i = SG.input.attach(stage, opts);
      inputs.push(i);
      return i;
    };

    H.inputOn = function (el, opts) {
      var i = SG.input.attach(el, opts);
      inputs.push(i);
      return i;
    };

    H.pad = function (spec, opts) {
      var p = SG.input.pad(stage, spec, opts);
      pads.push(p);
      return p;
    };
    H.dpad = function (opts) {
      var p = SG.input.dpad(stage, opts);
      pads.push(p);
      return p;
    };
    H.stick = function (opts) {
      var p = SG.input.stick(stage, opts);
      pads.push(p);
      return p;
    };
    H.keys = function (opts) {
      var k = SG.input.keys(opts);
      pads.push(k);
      return k;
    };

    /* ---------------------------------------------------------- Zeitgeber

       Verzoegerte Aufrufe muessen mit dem Spiel verschwinden. Sonst zieht
       ein Zug der Computergegners noch seinen Ton hinterher, waehrend man
       schon wieder im Menue steht, und abgeraeumte Zustaende werden noch
       weitergerechnet. H.after raeumt automatisch ab. */

    var timers = [];

    H.after = function (fn, ms) {
      if (destroyed) return 0;
      var id = setTimeout(function () {
        var i = timers.indexOf(id);
        if (i >= 0) timers.splice(i, 1);
        if (destroyed) return;
        try { fn(); } catch (e) { SG.noteError('host.after:' + def.id, e); }
      }, ms || 0);
      timers.push(id);
      return id;
    };

    H.cancel = function (id) {
      clearTimeout(id);
      var i = timers.indexOf(id);
      if (i >= 0) timers.splice(i, 1);
    };

    cleanups.push(function () {
      timers.forEach(function (t) { clearTimeout(t); });
      timers.length = 0;
    });

    /* ---------------------------------------------------------- Klang & Meldungen */

    H.sfx = function (name) { SG.audio.play(name); };
    H.buzz = function (ms) { SG.settings.buzz(ms); };
    H.toast = function (msg, kind, ms) { return UI.toast(msg, kind, ms); };
    H.modal = function (opts) {
      opts = opts || {};
      opts.parent = opts.parent || root;
      return UI.modal(opts);
    };
    H.confirm = function (t, x, ok, danger) {
      return new Promise(function (res) {
        var done = false;
        UI.modal({
          parent: root, title: t,
          body: typeof x === 'string' ? UI.el('p', { text: x }) : x,
          actions: [
            { label: 'Abbrechen', cls: 'ghost', onClick: function () { done = true; res(false); } },
            { label: ok || 'Ja', cls: danger ? 'bad' : 'primary', onClick: function () { done = true; res(true); } },
          ],
          // Ein Knopfdruck schliesst den Dialog, bevor er sein Ergebnis
          // meldet. Ohne durchKnopf kaeme hier immer "abgebrochen" an -
          // und der Hafen liesse sich nicht verlassen.
          onClose: function (durchKnopf) { if (!done && !durchKnopf) res(false); },
        });
      });
    };

    /* ---------------------------------------------------------- Overlays */

    var overlayEl = null;

    H.overlay = function (build, opts) {
      // Ein abgeraeumtes Spiel darf nichts mehr einblenden - sonst
      // schlagen verspaetete Zeitgeber nach dem Verlassen noch zu.
      if (destroyed) return null;
      H.closeOverlay();
      opts = opts || {};
      overlayEl = UI.el('div.gover');
      var box = UI.el('div.gover-box');
      overlayEl.appendChild(box);
      stage.appendChild(overlayEl);
      if (opts.dismissable) {
        overlayEl.addEventListener('pointerdown', function (e) {
          if (e.target === overlayEl) H.closeOverlay();
        });
      }
      build(box, H.closeOverlay);
      return overlayEl;
    };

    H.closeOverlay = function () {
      if (overlayEl) { UI.remove(overlayEl); overlayEl = null; }
    };

    H.showPause = function (onResume, extra) {
      H.overlay(function (box) {
        UI.add(box, [
          UI.el('h2', { text: 'Pause' }),
          UI.el('div.sub', { text: def.name }),
          extra || null,
          UI.el('div.gover-actions', null, [
            UI.btn('Menü', function () { H.exit(); }, 'ghost'),
            UI.btn('Weiter', function () { H.closeOverlay(); if (onResume) onResume(); }, 'primary'),
          ]),
        ]);
      });
    };

    /* Standard-Abschluss mit Bestwert-Logik */
    H.gameOver = function (opts) {
      if (destroyed) return null;
      opts = opts || {};
      var res = null;
      if (typeof opts.score === 'number' && opts.submit !== false) {
        res = SG.scores.submit(def.id, opts.score, {
          mode: opts.mode, higher: opts.higher !== false,
        });
      }
      var best = res ? res.best : SG.scores.best(def.id, opts.mode);

      /* Erfahrung fuers ganze Haus. Der Fortschritt haengt am Zugangscode,
         nicht am Spiel - deshalb steht er hier und nicht in jedem Spiel. */
      if (opts.fortschritt !== false) {
        SG.fortschritt.rundeBeendet(def.id, {
          gewonnen: !!opts.won,
          rekord: !!(res && res.isBest),
        });
      }
      var fmt = opts.format || function (v) { return U.num(v); };

      SG.audio.play(opts.won ? 'win' : 'lose');

      H.overlay(function (box) {
        UI.add(box, [
          res && res.isBest && opts.score !== undefined
            ? UI.el('div.newbest', { text: 'Neuer Rekord' }) : null,
          UI.el('h2', { text: opts.title || (opts.won ? 'Geschafft!' : 'Vorbei') }),
          opts.sub ? UI.el('div.sub', { text: opts.sub }) : null,
          opts.score !== undefined ? UI.el('div.gover-score', null, [
            UI.el('div.b.gold', null, [
              UI.el('div.k', { text: opts.scoreLabel || 'Punkte' }),
              UI.el('div.v', { text: fmt(opts.score) }),
            ]),
            best !== null && best !== undefined ? UI.el('div.b', null, [
              UI.el('div.k', { text: 'Bestwert' }),
              UI.el('div.v', { text: fmt(best) }),
            ]) : null,
          ]) : null,
          opts.extra || null,
          UI.el('div.gover-actions', null, [
            UI.btn('Menü', function () { H.exit(); }, 'ghost'),
            UI.btn(opts.againLabel || 'Nochmal', function () {
              H.closeOverlay();
              if (opts.onAgain) opts.onAgain();
            }, 'primary'),
          ]),
        ]);
      });
      return res;
    };

    /* ---------------------------------------------------------- Bestwerte */

    H.best = function (mode) { return SG.scores.best(def.id, mode); };
    H.submit = function (v, opts) { return SG.scores.submit(def.id, v, opts); };
    H.stats = function (k, d) { return SG.scores.stat(def.id, k, d); };
    H.setStat = function (k, v) { return SG.scores.setStat(def.id, k, v); };

    /* Fuer Spiele ohne Ende: ein Meilenstein zaehlt einmal und gibt
       dann Erfahrung. Die Tycoons melden darueber ihre Raenge. */
    H.meilenstein = function (schluessel, xp, text) {
      return SG.fortschritt.meilenstein(def.id, schluessel, xp, text);
    };

    /* ---------------------------------------------------------- Verlassen */

    /* Letzter sicherer Moment zum Sichern.

       Auf dem iPad gibt es kein verlaessliches "unload": ein weggewischter
       Safari-Tab, ein Wechsel zur naechsten App oder das Ausschalten des
       Bildschirms feuern nur visibilitychange bzw. pagehide - und danach
       kann die Seite jederzeit ohne weitere Meldung entsorgt werden.
       Deshalb haengen sich die Tycoons hier ein und schreiben ihren Stand,
       sobald die Seite in den Hintergrund geht. */
    H.onLeave = function (fn) {
      var vis = function () { if (document.hidden) call('hidden'); };
      var hide = function () { call('pagehide'); };
      function call(why) {
        if (destroyed) return;
        try { fn(why); } catch (e) { SG.noteError('host.onLeave', e); }
      }
      document.addEventListener('visibilitychange', vis);
      window.addEventListener('pagehide', hide);
      window.addEventListener('freeze', hide);
      cleanups.push(function () {
        document.removeEventListener('visibilitychange', vis);
        window.removeEventListener('pagehide', hide);
        window.removeEventListener('freeze', hide);
      });
    };

    H.beforeExit = null;   // Spiele koennen hier eine Nachfrage einhaengen

    H.exit = function () {
      if (H.beforeExit) {
        var r = H.beforeExit();
        if (r && typeof r.then === 'function') {
          r.then(function (ok) { if (ok) SG.router.go('#/'); });
          return;
        }
        if (r === false) return;
      }
      SG.router.go('#/');
    };

    H.destroy = function () {
      if (destroyed) return;
      destroyed = true;
      loops.forEach(function (l) { try { l.destroy ? l.destroy() : l.stop(); } catch (e) { /* egal */ } });
      inputs.forEach(function (i) { try { i.detach(); } catch (e) { /* egal */ } });
      pads.forEach(function (p) { try { p.destroy(); } catch (e) { /* egal */ } });
      canvases.forEach(function (c) { try { c.destroy(); } catch (e) { /* egal */ } });
      cleanups.forEach(function (f) { try { f(); } catch (e) { SG.noteError('host.cleanup', e); } });
      bus.clear();
      UI.remove(root);
    };

    return H;
  };
})(SG);
