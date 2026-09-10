/* ------------------------------------------------------------------
   Startbildschirm: Suche, Filter, Kachelgitter, Einstellungen.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var UI = SG.ui;

  var Hub = SG.hub = {};

  var state = {
    query: '',
    filter: 'alle',
  };

  /* ---------------------------------------------------------- Kachel */

  function drawPreview(cv, def) {
    var r = cv.getBoundingClientRect();
    var w = Math.max(120, Math.round(r.width || 170));
    var h = Math.round(w * 10 / 16);
    var dpr = Math.min(window.devicePixelRatio || 1, 1.6);
    if (cv.width === Math.round(w * dpr)) return;
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    var c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = '#0b0e15';
    c.fillRect(0, 0, w, h);
    if (def.preview) {
      c.save();
      try { def.preview(c, w, h); }
      catch (e) { SG.noteError('preview:' + def.id, e); }
      c.restore();
    } else {
      SG.gfx.text(c, def.name, w / 2, h / 2, {
        size: 15, weight: 700, color: '#5f6a85', align: 'center', baseline: 'middle',
      });
    }
  }

  function tile(def) {
    var cv = UI.el('canvas');
    var best = SG.scores.label(def.id);
    var isFav = SG.scores.isFav(def.id);

    var favBtn = UI.el('button.fav' + (isFav ? '.on' : ''), {
      html: '★', 'aria-label': 'Favorit',
      on: {
        click: function (e) {
          e.stopPropagation();
          var on = SG.scores.toggleFav(def.id);
          favBtn.classList.toggle('on', on);
          SG.audio.play('click');
          UI.toast(on ? 'Zu Favoriten hinzugefügt' : 'Aus Favoriten entfernt', null, 1200);
        },
      },
    });

    var sperre = SG.auth.zugang(def.id);
    var wartung = SG.auth.inWartung(def.id);
    var kreis = SG.auth.nurKreis(def.id);

    var badges = UI.el('div.tile-badges');
    if (wartung) badges.appendChild(UI.el('span.badge.wartung', { text: '🔧 WARTUNG' }));
    else if (kreis) badges.appendChild(UI.el('span.badge.kreis', { text: '🔑 KREIS' }));
    if (def.online) badges.appendChild(UI.el('span.badge.online', { text: 'ONLINE' }));
    if (def.category === 'tycoon') badges.appendChild(UI.el('span.badge.tycoon', { text: 'TYCOON' }));
    if (def.external) badges.appendChild(UI.el('span.badge.online', { text: 'EIGENE SEITE' }));

    var el = UI.el('button.tile'
      + (sperre ? '.zu' : '')
      + (sperre && sperre.grund === 'gesperrt' ? '.durchgestrichen' : ''), {
      'aria-label': def.name + (sperre ? ' (gesperrt)' : ''),
      on: {
        click: function () {
          SG.audio.unlock();
          if (sperre) {
            SG.audio.play('error');
            UI.toast(sperre.text, 'bad', 2600);
            return;
          }
          SG.audio.play('select');
          // Eigenstaendige Spiele liegen als eigene Seite daneben
          if (def.external) { location.href = def.external; return; }
          SG.router.go('#/spiel/' + def.id);
        },
      },
    }, [
      cv, favBtn, badges,
      UI.el('div.tile-body', null, [
        UI.el('div.tile-name', { text: def.name }),
        UI.el('div.tile-meta', null, [
          UI.el('span', { text: def.desc || SG.catName(def.category) }),
        ]),
      ]),
    ]);

    if (best) {
      badges.appendChild(UI.el('span.badge.best', { text: best }));
    }

    el.__draw = function () { drawPreview(cv, def); };
    return el;
  }

  /* Stufenabzeichen oben rechts. Der Balken darunter fuellt sich mit
     der laufenden Stufe - so sieht man den Fortschritt, ohne dafuer
     erst irgendwo hineingehen zu muessen. */
  function stufenChip() {
    var stand = SG.fortschritt.stand();
    var balken = UI.el('i');
    balken.style.width = Math.round(stand.anteil * 100) + '%';

    var chip = UI.el('button.btn.sm.stufe-chip', {
      'aria-label': 'Profil · Stufe ' + stand.stufe,
      title: stand.rang.name + ' · ' + U.num(stand.xp) + ' XP',
      on: { click: function () { SG.router.go('#/profil'); } },
    }, [
      UI.el('span.ico', { text: stand.rang.icon }),
      UI.el('span.lbl', { text: 'Stufe ' + stand.stufe }),
      UI.el('span.stufe-bar', null, [balken]),
    ]);

    /* Waehrend man im Hub steht, kann Erfahrung dazukommen (ein Erfolg
       aus einer nachgereichten Pruefung). Dann soll der Balken mit. */
    var ab = function (s) {
      balken.style.width = Math.round(s.anteil * 100) + '%';
      chip.querySelector('.lbl').textContent = 'Stufe ' + s.stufe;
      chip.querySelector('.ico').textContent = s.rang.icon;
    };
    SG.fortschritt.on('aenderung', ab);
    chip.__ab = ab;
    return chip;
  }

  /* Der Zugang zur Lagezentrale. Absichtlich breit und anders als
     alles andere im Hub - er soll nicht wie eine weitere Kachel
     aussehen. Die Zahl rechts sind offene Vorgaenge. */
  function bndKnopf() {
    var zahl = UI.el('div.bnd-knopf-zahl');
    var el = UI.el('button.bnd-knopf', {
      'aria-label': 'Bundesnachrichtendienst',
      on: {
        click: function () {
          SG.audio.play('select');
          SG.router.go('#/bnd');
        },
      },
    }, [
      UI.el('div.bnd-knopf-wappen', { text: '🦅' }),
      UI.el('div.bnd-knopf-text', null, [
        UI.el('div.bk-t', { text: 'Bundesnachrichtendienst' }),
        UI.el('div.bk-d', { text: 'Lagezentrale · Zugang nur mit Dienstschlüssel' }),
      ]),
      zahl,
      UI.el('div.bnd-knopf-scan'),
    ]);

    function auffrischen() {
      var n = SG.bnd.offen();
      zahl.textContent = n ? String(n) : '';
      zahl.classList.toggle('an', n > 0);
      el.classList.toggle('alarm', n > 0);
    }
    auffrischen();
    /* Antraege und Zutrittsalarme kommen ueber die gemeinsame
       Verbindung herein - der Knopf soll die Zahl mitbekommen, ohne
       dass man neu laedt. */
    var ab1 = SG.relais.beobachten(SG.bnd.ANTRAEGE, auffrischen);
    var ab2 = SG.relais.beobachten(SG.verhoer.BRETT_FAELLE, auffrischen);
    SG.verwaltung.on('aenderung', auffrischen);
    el.__ab = function () {
      ab1();
      ab2();
      SG.verwaltung.off('aenderung', auffrischen);
    };
    return el;
  }

  /* ---------------------------------------------------------- Aufbau */

  Hub.render = function (root) {
    var app = root;
    UI.clear(app);

    /* --- Kopfzeile --- */
    var top = UI.el('div.topbar', null, [
      UI.el('div.brand', null, [
        UI.el('div.brand-mark'),
        UI.el('div.brand-text', null, [
          UI.el('div.brand-title', { text: 'Herr Gehstocks Hideout' }),
          UI.el('div.brand-sub', {
            text: SG.list().length + ' Spiele' + (SG.offline ? ' · Offline-Modus' : ''),
          }),
        ]),
      ]),
      UI.el('div.spacer'),
      UI.el('div.topbar-actions', null, [
        stufenChip(),
        SG.meeting.knopf(),
        SG.offline ? null : UI.el('button.btn.sm', {
          html: '<span class="ico">⤓</span><span class="lbl">Offline spielen</span>',
          on: { click: function () { SG.router.go('#/offline'); } },
        }),
        SG.auth.imKreis() ? UI.el('button.btn.sm.kreis', {
          html: '<span class="ico">🔑</span><span class="lbl">Kreis</span>',
          'aria-label': 'Innerer Kreis',
          on: { click: function () { SG.router.go('#/kreis'); } },
        }) : null,
        SG.auth.istAdmin() ? UI.el('button.btn.sm.gold', {
          html: '<span class="ico">🛡</span><span class="lbl">Admin</span>',
          'aria-label': 'Admin-Menü',
          on: { click: function () { SG.router.go('#/adminraum'); } },
        }) : null,
        UI.el('button.btn.sm.ghost', {
          html: '<span class="ico">ⓘ</span>',
          'aria-label': 'Über uns',
          on: { click: function () { SG.router.go('#/ueber'); } },
        }),
        UI.el('button.btn.sm.ghost', {
          html: '<span class="ico">⚙</span>',
          'aria-label': 'Einstellungen',
          on: { click: function () { Hub.settings(); } },
        }),
      ]),
    ]);
    app.appendChild(top);

    /* --- Inhalt --- */
    var screen = UI.el('div.screen');
    var wrap = UI.el('div.wrap-1000');
    screen.appendChild(wrap);
    app.appendChild(screen);

    var searchInput = UI.el('input', {
      type: 'search', placeholder: 'Spiel suchen…',
      value: state.query,
      autocapitalize: 'off', autocorrect: 'off', spellcheck: false,
      on: {
        input: function () { state.query = searchInput.value; renderGrid(); },
      },
    });

    var filters = UI.el('div.filters');
    var filterDefs = [{ id: 'alle', name: 'Alle', icon: '▦' }]
      .concat(SG.scores.favorites().length ? [{ id: 'fav', name: 'Favoriten', icon: '★' }] : [])
      .concat(SG.categories)
      .concat([{ id: 'online', name: 'Mehrspieler', icon: '🌐' }]);

    filterDefs.forEach(function (f) {
      var b = UI.el('button.chip' + (state.filter === f.id ? '.on' : ''), {
        html: '<span>' + f.icon + '</span> ' + f.name,
        on: {
          click: function () {
            state.filter = f.id;
            for (var i = 0; i < filters.children.length; i++) {
              filters.children[i].classList.remove('on');
            }
            b.classList.add('on');
            SG.audio.play('click');
            renderGrid();
          },
        },
      });
      filters.appendChild(b);
    });

    /* --- Der breite Knopf des Nachrichtendienstes ---
       Steht ueber allem anderen, mit einer Zahl, sobald etwas anliegt. */
    if (SG.auth.istBnd()) wrap.appendChild(bndKnopf());

    /* --- Gehstockflix --- */
    if (!SG.offline) wrap.appendChild(SG.flix.knopf());

    wrap.appendChild(UI.el('div.hub-tools', null, [
      UI.el('div.search', null, [UI.el('span.ico', { text: '⌕' }), searchInput]),
      filters,
    ]));

    var gridHost = UI.el('div');
    wrap.appendChild(gridHost);

    /* Hinweis, wenn Fortschritt fluechtig ist (Dateien-App) */
    if (SG.storage.volatile) {
      wrap.insertBefore(UI.el('div.notice.warn', {
        style: { marginBottom: '14px' },
        html: 'Dieses Gerät erlaubt hier kein dauerhaftes Speichern. ' +
          'Bestwerte und Tycoon-Stände gehen beim Schließen verloren — ' +
          'sichere sie über <b>Einstellungen → Spielstand-Code</b>.',
      }), wrap.firstChild.nextSibling);
    }

    var pending = [];

    function section(title, games, note) {
      if (!games.length) return null;
      var head = UI.el('div.sec-head', null, [
        UI.el('h2', { text: title }),
        UI.el('span.count', { text: games.length + (note ? ' · ' + note : '') }),
      ]);
      var g = UI.el('div.grid');
      games.forEach(function (def) {
        var t = tile(def);
        pending.push(t);
        g.appendChild(t);
      });
      return UI.el('div', null, [head, g]);
    }

    function renderGrid() {
      UI.clear(gridHost);
      pending = [];

      var q = state.query.trim();
      var list = q ? SG.search(q) : SG.list();

      if (state.filter === 'fav') {
        var favs = SG.scores.favorites();
        list = list.filter(function (g) { return favs.indexOf(g.id) >= 0; });
      } else if (state.filter === 'online') {
        list = list.filter(function (g) { return g.online; });
      } else if (state.filter !== 'alle') {
        list = list.filter(function (g) { return g.category === state.filter; });
      }

      if (!list.length) {
        gridHost.appendChild(UI.empty('🔍', 'Nichts gefunden',
          'Andere Suche oder Filter probieren.'));
        return;
      }

      if (q || state.filter !== 'alle') {
        var g = UI.el('div.grid');
        list.forEach(function (def) {
          var t = tile(def);
          pending.push(t);
          g.appendChild(t);
        });
        gridHost.appendChild(g);
      } else {
        var favIds = SG.scores.favorites();
        var recent = SG.scores.recent().filter(function (id) { return favIds.indexOf(id) < 0; });

        var s1 = section('Favoriten', favIds.map(function (id) { return SG.games[id]; }));
        if (s1) gridHost.appendChild(s1);

        var s2 = section('Zuletzt gespielt',
          recent.slice(0, 6).map(function (id) { return SG.games[id]; }));
        if (s2) gridHost.appendChild(s2);

        SG.categories.forEach(function (cat) {
          var s = section(cat.name, SG.byCategory(cat.id));
          if (s) gridHost.appendChild(s);
        });
      }

      // Vorschauen erst zeichnen, wenn das Layout steht
      requestAnimationFrame(function () {
        pending.forEach(function (t) { t.__draw(); });
      });
    }

    renderGrid();

    var onResize = U.debounce(function () {
      pending.forEach(function (t) {
        var cv = t.querySelector('canvas');
        if (cv) cv.width = 0;
        t.__draw();
      });
    }, 220);
    window.addEventListener('resize', onResize);

    return {
      destroy: function () {
        window.removeEventListener('resize', onResize);
        var chip = top.querySelector('.stufe-chip');
        if (chip && chip.__ab) SG.fortschritt.off('aenderung', chip.__ab);
        var bk = wrap.querySelector('.bnd-knopf');
        if (bk && bk.__ab) bk.__ab();
      },
    };
  };

  /* ---------------------------------------------------------- Einstellungen */

  Hub.settings = function () {
    var body = UI.el('div');
    var S = SG.settings;

    UI.add(body, [
      UI.toggleRow('Ton', 'Kurze Klänge im Spiel. In der Schule besser aus.',
        function () { return S.get('sound'); },
        function (v) { S.set('sound', v); if (v) SG.audio.unlock(); }),

      UI.toggleRow('Vibration', 'Kurzes Feedback bei Knöpfen, wo das Gerät es kann.',
        function () { return S.get('haptics'); },
        function (v) { S.set('haptics', v); }),

      UI.toggleRow('Reduzierte Effekte', 'Weniger Partikel und Animationen — höchste Bildrate.',
        function () { return S.get('reduced'); },
        function (v) { S.set('reduced', v); }),

      UI.toggleRow('Linkshänder-Steuerung', 'Bedienfelder spiegeln.',
        function () { return S.get('leftHanded'); },
        function (v) { S.set('leftHanded', v); }),

      UI.toggleRow('Bildrate anzeigen', 'Kleiner Zähler in der Spielleiste.',
        function () { return S.get('showFps'); },
        function (v) { S.set('showFps', v); }),

      UI.toggleRow('Nachfragen beim Verlassen', 'Warnt, bevor ein laufender Tycoon verlassen wird.',
        function () { return S.get('confirmExit'); },
        function (v) { S.set('confirmExit', v); }),

      UI.el('div.sec-head', null, [UI.el('h2', { text: 'Bildschirm-Beobachtung' })]),

      UI.el('div.notice', {
        html: '<b>👁 Automatische Warnung:</b> Ein auffälliges Pop-up oben links warnt dich sofort, '
          + 'sobald jemand über das Relais oder den Adminbereich auf deinen Bildschirm schaut.',
      }),

      UI.el('div.sec-head', null, [UI.el('h2', { text: 'Spielstände' })]),

      UI.el('p.small.muted', {
        text: 'Speicherort: ' + ({
          local: 'dauerhaft im Browser', session: 'nur bis zum Schließen des Tabs',
          memory: 'nur im Arbeitsspeicher',
        }[SG.storage.mode]) + ' · ' + U.num(SG.storage.size() / 1024, 1) + ' kB belegt',
      }),

      UI.el('div.row.wrap', { style: { gap: '8px', marginTop: '10px' } }, [
        UI.btn('Spielstand-Code anzeigen', function () { exportCode(); }, 'sm'),
        UI.btn('Code einspielen', function () { importCode(); }, 'sm'),
        UI.btn('Anleitungen zurücksetzen', function () {
          SG.tutorial.forgetAll();
          UI.toast('Anleitungen erscheinen wieder.', 'good');
        }, 'sm ghost'),
        UI.btn('Alle Bestwerte löschen', function () {
          UI.confirm('Bestwerte löschen?', 'Alle Rekorde und Statistiken werden entfernt. Tycoon-Stände bleiben.',
            'Löschen', true).then(function (ok) {
              if (!ok) return;
              SG.scores.resetAll();
              UI.toast('Bestwerte gelöscht.', 'good');
            });
        }, 'sm bad'),
      ]),

      UI.el('div.sec-head', null, [UI.el('h2', { text: 'Über' })]),
      UI.el('p.small.muted', {
        html: 'Herr Gehstocks Hideout · Version ' + SG.version +
          '<br>' + SG.list().length + ' Spiele · ' +
          (SG.offline ? 'Offline-Einzeldatei' : 'Webseite') +
          '<br>Alle Grafiken und Klänge entstehen im Browser — keine externen Dateien.',
      }),
    ]);

    UI.modal({ title: 'Einstellungen', body: body, wide: true });
  };

  function exportCode() {
    var code = SG.storage.exportCode();
    var ta = UI.el('textarea.code-box', { value: code, readonly: true });
    UI.modal({
      title: 'Spielstand-Code',
      body: [
        UI.el('p.small.muted', {
          text: 'Diesen Text irgendwo sichern (z. B. in Notizen). Damit lässt sich ' +
            'der gesamte Fortschritt später auf jedem Gerät wiederherstellen.',
        }),
        ta,
      ],
      actions: [
        {
          label: 'Kopieren', cls: 'primary', keepOpen: true, onClick: function () {
            ta.select();
            var ok = false;
            try { ok = document.execCommand('copy'); } catch (e) { /* egal */ }
            if (!ok && navigator.clipboard) {
              navigator.clipboard.writeText(code).then(function () {
                UI.toast('Kopiert.', 'good');
              }, function () { UI.toast('Bitte von Hand markieren und kopieren.', 'bad'); });
            } else UI.toast(ok ? 'Kopiert.' : 'Bitte von Hand kopieren.', ok ? 'good' : 'bad');
          },
        },
      ],
    });
    setTimeout(function () { ta.focus(); ta.select(); }, 80);
  }

  function importCode() {
    var ta = UI.el('textarea.code-box', { placeholder: 'Code hier einfügen…' });
    UI.modal({
      title: 'Spielstand einspielen',
      body: [
        UI.el('p.small.muted', {
          text: 'Achtung: vorhandene Stände mit gleichem Namen werden überschrieben.',
        }),
        ta,
      ],
      actions: [
        { label: 'Abbrechen', cls: 'ghost' },
        {
          label: 'Einspielen', cls: 'primary', onClick: function () {
            var r = SG.storage.importCode(ta.value);
            if (!r.ok) { UI.toast(r.msg, 'bad', 3000); return; }
            UI.toast(r.count + ' Einträge eingespielt.', 'good');
            setTimeout(function () { SG.router.reload(); }, 700);
          },
        },
      ],
    });
  }
})(SG);
