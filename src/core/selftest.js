/* ------------------------------------------------------------------
   Selbsttest.

   Aufruf: index.html?selftest=1  (funktioniert auch in der Offline-Datei)

   Jedes Spiel wird in einen unsichtbaren Bereich gehaengt, mit
   synthetischen Eingaben gefuettert und einige hundert Simulations-
   schritte weit gerechnet. Danach wird geprueft:
     - keine Ausnahme
     - keine NaN im Zustand
     - alles wieder abgeraeumt
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var UI = SG.ui;

  var T = SG.selftest = {};

  /* Solange der Selbsttest laeuft, darf kein Spiel etwas in den
     Speicher schreiben - sonst waeren nach einem Testlauf die
     Tycoon-Spielstaende des Spielers ueberschrieben. */
  T.active = false;

  function hasNaN(obj, depth, seen) {
    depth = depth || 0;
    if (depth > 4) return false;
    seen = seen || [];
    if (typeof obj === 'number') return !isFinite(obj);
    if (!obj || typeof obj !== 'object') return false;
    if (seen.indexOf(obj) >= 0) return false;
    seen.push(obj);
    if (Array.isArray(obj)) {
      for (var i = 0; i < Math.min(obj.length, 200); i++) {
        if (hasNaN(obj[i], depth + 1, seen)) return true;
      }
      return false;
    }
    var n = 0;
    for (var k in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
      if (++n > 120) break;
      if (typeof obj[k] === 'function') continue;
      if (hasNaN(obj[k], depth + 1, seen)) return true;
    }
    return false;
  }

  /* Ein Bild abwarten.

     In einem versteckten Tab pausiert der Browser requestAnimationFrame
     komplett und drosselt setTimeout auf eine Sekunde - dort wuerde der
     Test minutenlang kriechen. Ein MessageChannel wird nicht gedrosselt
     und liefert dort sofort den naechsten Durchlauf; sichtbar bleibt es
     bei einem echten Bild, damit das Layout wirklich steht. */
  function frame() {
    return new Promise(function (r) {
      var done = false;
      var fin = function () { if (!done) { done = true; r(); } };
      try {
        var mc = new MessageChannel();
        mc.port1.onmessage = fin;
        mc.port2.postMessage(0);
      } catch (e) { setTimeout(fin, 30); }
      requestAnimationFrame(fin);
    });
  }

  T.runOne = function (def, box, steps) {
    var t0 = U.now();
    var errBefore = SG.errors.length;
    var host = null, ctrl = null;
    var res = { id: def.id, name: def.name, ok: false, ms: 0, note: '' };
    T.active = true;

    return Promise.resolve()
      .then(function () {
        host = SG.host.create(def, box);
        ctrl = def.mount(host) || {};
        return frame();
      })
      .then(function () {
        // Vorschau muss ebenfalls fehlerfrei zeichnen
        if (def.preview) {
          var cv = SG.gfx.newCanvas(240, 150);
          def.preview(cv.getContext('2d'), 240, 150);
        }
        if (!ctrl.selftest) return null;
        /* In Etappen laufen lassen und dazwischen die Spielregeln als
           Invarianten pruefen - ein Fehler, der sich zwei Zuege spaeter
           von selbst wieder aufloest, faellt am Ende sonst nicht auf. */
        var gesamt = steps || 600;
        var etappen = gesamt > 1200 ? 8 : 1;
        var proEtappe = Math.ceil(gesamt / etappen);
        var kette = Promise.resolve();
        for (var e = 0; e < etappen; e++) {
          kette = kette.then(function () {
            return Promise.resolve(ctrl.selftest(proEtappe)).then(function () {
              var fehler = SG.invariants.check(def.id, ctrl.state);
              if (fehler) throw new Error(fehler);
            });
          });
        }
        return kette;
      })
      .then(function () { return frame(); })
      .then(function () { return frame(); })
      .then(function () {
        if (ctrl.state && hasNaN(ctrl.state)) {
          throw new Error('NaN im Spielzustand');
        }
        var verletzt = SG.invariants.check(def.id, ctrl.state);
        if (verletzt) throw new Error(verletzt);
        var newErrs = SG.errors.slice(errBefore);
        if (newErrs.length) {
          throw new Error(newErrs[0].where + ': ' + String(newErrs[0].msg).split('\n')[0]);
        }
        res.ok = true;
        res.note = ctrl.selftest ? 'geprüft' : 'nur Start geprüft';
      })
      .catch(function (e) {
        res.ok = false;
        res.note = String((e && e.message) || e).slice(0, 160);
      })
      .then(function () {
        try { if (ctrl && ctrl.destroy) ctrl.destroy(); } catch (e) { /* egal */ }
        try { if (host) host.destroy(); } catch (e) { /* egal */ }
        T.active = false;
        res.ms = Math.round(U.now() - t0);
        return res;
      });
  };

  /* ------------------------------------------------------------------
     Der Lauf ohne Anzeige

     Frueher steckte die Schleife mitten in der Vollbildansicht von
     T.run. Die Entwicklerkonsole braucht aber dieselbe Pruefung mit
     einer eigenen Anzeige - deshalb steht der Lauf jetzt hier fuer
     sich, und T.run zeichnet nur noch, was dabei herauskommt.

     opts.onFortschritt(fertig, gesamt, name, ergebnis)
     ------------------------------------------------------------------ */

  T.laufen = function (opts) {
    opts = opts || {};

    // Unsichtbar, aber vermessbar - Layout muss echt sein
    var box = UI.el('div', {
      style: {
        position: 'absolute', left: '-10000px', top: '0',
        width: '900px', height: '620px', overflow: 'hidden',
      },
    });
    document.body.appendChild(box);

    var list = SG.list();
    var results = [];
    var i = 0;

    function next() {
      if (i >= list.length) return Promise.resolve();
      var def = list[i++];
      return T.runOne(def, box, opts.steps).then(function (r) {
        results.push(r);
        if (opts.onFortschritt) {
          try { opts.onFortschritt(results.length, list.length, def.name, r); }
          catch (e) { /* die Anzeige darf den Lauf nicht kippen */ }
        }
        return next();
      });
    }

    return next().then(function () {
      UI.remove(box);
      var bad = results.filter(function (x) { return !x.ok; });
      return {
        done: true,
        total: list.length,
        passed: list.length - bad.length,
        failed: bad.length,
        results: results,
        errors: SG.errors.slice(0, 20),
      };
    });
  };

  T.run = function (opts) {
    opts = opts || {};
    SG.router.suspend(true);

    var app = document.getElementById('app');
    UI.clear(app);

    var out = UI.el('div.screen');
    var wrap = UI.el('div.wrap-1000');
    out.appendChild(wrap);
    app.appendChild(out);

    var head = UI.el('div', null, [
      UI.el('h1', { text: 'Selbsttest', style: { marginBottom: '4px' } }),
      UI.el('p.small.muted', {
        text: SG.list().length + ' Spiele · ' + (SG.offline ? 'Offline-Einzeldatei' : 'Webseite') +
          ' · Version ' + SG.version,
      }),
    ]);
    wrap.appendChild(head);

    var summary = UI.el('div.notice', { text: 'läuft…' });
    wrap.appendChild(summary);

    var table = UI.el('table.tbl');
    table.appendChild(UI.el('thead', null, [UI.el('tr', null, [
      UI.el('th', { text: '' }),
      UI.el('th', { text: 'Spiel' }),
      UI.el('th', { text: 'Ergebnis' }),
      UI.el('th.num', { text: 'ms' }),
    ])]));
    var tbody = UI.el('tbody');
    table.appendChild(tbody);
    wrap.appendChild(UI.el('div.card', { style: { marginTop: '14px' } }, [table]));

    var gesamt = SG.list().length;

    return T.laufen({
      steps: opts.steps,
      onFortschritt: function (fertig, alle, name, r) {
        tbody.appendChild(UI.el('tr' + (r.ok ? '' : '.hi'), null, [
          UI.el('td', { text: r.ok ? '✓' : '✕', style: { color: r.ok ? '#3ddc84' : '#ff5f6b' } }),
          UI.el('td', { text: r.name }),
          UI.el('td', { text: r.note, style: { color: r.ok ? 'var(--muted)' : '#ff9c3f' } }),
          UI.el('td.num', { text: String(r.ms) }),
        ]));
      },
    }).then(function (erg) {
      var bad = erg.results.filter(function (x) { return !x.ok; });
      summary.textContent = bad.length
        ? bad.length + ' von ' + gesamt + ' Spielen mit Problem: ' +
          bad.map(function (b) { return b.name; }).join(', ')
        : 'Alle ' + gesamt + ' Spiele bestanden.';
      summary.className = 'notice' + (bad.length ? ' bad' : '');

      wrap.appendChild(UI.el('div', { style: { marginTop: '16px' } }, [
        UI.btn('Zum Hub', function () {
          SG.router.suspend(false);
          SG.router.go('#/');
          SG.router.reload();
        }, 'primary'),
      ]));

      // Fuer automatisiertes Auslesen von aussen
      window.__SG_SELFTEST__ = erg;
      return erg;
    });
  };

  T.wanted = function () {
    try {
      return /(\?|&)selftest=1/.test(location.search) || /selftest/.test(location.hash);
    } catch (e) { return false; }
  };

  /* ?selftest=1&steps=8000 fuer den langen Lauf. Seltene Zustaende - eine
     volle Reihe, ein leergeraeumtes Brett, die zwanzigste Welle - zeigen
     sich erst nach ein paar tausend Schritten. */
  T.steps = function () {
    try {
      var m = /(\?|&)steps=(\d+)/.exec(location.search);
      return m ? Math.min(200000, Number(m[2])) : 0;
    } catch (e) { return 0; }
  };
})(SG);
