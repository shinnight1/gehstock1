/* ------------------------------------------------------------------
   Entwicklerkonsole.

   Den Selbsttest gab es schon - aber nur ueber ?selftest=1, und er
   schrieb sein Ergebnis in die Browserkonsole. Auf einem iPad kommt
   man da nicht heran. Hier laeuft derselbe Test mit einer Anzeige,
   und daneben steht alles, was man beim Suchen eines Fehlers wissen
   will: Verbindung, Speicher, gesammelte Ausnahmen, Bauversion.

   Nur fuer Admins, erreichbar unter #/dev.
   ------------------------------------------------------------------ */

(function (SG) {
  var UI = SG.ui;
  var U = SG.util;
  var A = SG.auth;
  var Rel = SG.relais;

  var D = SG.dev = {};

  D.render = function (app) {
    UI.clear(app);
    if (!A.istAdmin()) { SG.router.go('#/'); return { destroy: function () { } }; }

    var reiter = 'test';
    var lebt = true;
    var offen = null;

    app.appendChild(UI.el('div.topbar', null, [
      UI.el('button.back.btn.sm.ghost', {
        html: '‹ Zurück',
        on: { click: function () { SG.router.go('#/'); } },
      }),
      UI.el('div.spacer'),
      UI.el('div.brand-title', { text: '🔧 Entwicklerkonsole' }),
      UI.el('div.spacer'),
      UI.el('div.dev-version', { text: 'Version ' + SG.version }),
    ]));

    var schirm = UI.el('div.screen');
    var wrap = UI.el('div.wrap-1000');
    schirm.appendChild(wrap);
    app.appendChild(schirm);

    wrap.appendChild(UI.tabs([
      { id: 'test', label: '🧪 Selbsttest' },
      { id: 'netz', label: '📡 Verbindung' },
      { id: 'fehler', label: '⚠ Ausnahmen' },
      { id: 'speicher', label: '💾 Speicher' },
    ], function (id) { reiter = id; bauen(); }, reiter));

    var inhalt = UI.el('div.dev-inhalt');
    wrap.appendChild(inhalt);
    bauen();

    function bauen() {
      if (offen && offen.destroy) { try { offen.destroy(); } catch (e) { /* egal */ } }
      offen = null;
      UI.clear(inhalt);
      if (reiter === 'test') selbsttest(inhalt);
      else if (reiter === 'netz') netz(inhalt);
      else if (reiter === 'fehler') fehler(inhalt);
      else speicher(inhalt);
    }

    /* ================================================================
       Selbsttest
       ================================================================ */

    function selbsttest(ziel) {
      var schritte = SG.storage.get('dev:schritte', 2000);

      ziel.appendChild(UI.el('p.small.muted', {
        text: 'Startet jedes Spiel unsichtbar, füttert es mit Eingaben, rechnet '
          + 'es durch und prüft dabei die Invarianten aus invariants.js — '
          + 'nicht nur am Ende, sondern in acht Etappen. Gemeldet werden '
          + 'Ausnahmen, NaN im Zustand, verletzte Regeln und Aufräumfehler.',
      }));

      ziel.appendChild(UI.segRow('Schritte je Spiel',
        'Mehr Schritte finden seltene Zustände — dauert entsprechend länger.',
        [
          { value: 600, label: '600 · schnell' },
          { value: 2000, label: '2000 · normal' },
          { value: 8000, label: '8000 · gründlich' },
          { value: 20000, label: '20000 · lang' },
        ],
        function () { return schritte; },
        function (v) { schritte = Number(v); SG.storage.set('dev:schritte', schritte); }));

      var startBtn = UI.btn('▶ Selbsttest starten', function () { los(); }, 'wide primary');
      ziel.appendChild(UI.el('div', { style: { height: '10px' } }));
      ziel.appendChild(startBtn);

      var balken = UI.el('div.dev-balken', null, [UI.el('i')]);
      var stand = UI.el('div.small.muted.center', { style: { marginTop: '8px' } });
      var ergebnis = UI.el('div.dev-ergebnis');
      UI.add(ziel, [balken, stand, ergebnis]);

      /* Der letzte Lauf bleibt stehen, solange man in der Konsole ist -
         sonst muss man nach jedem Reiterwechsel neu testen. */
      if (D.letzterLauf) zeigen(D.letzterLauf);

      function los() {
        if (D.laeuft) return;
        D.laeuft = true;
        startBtn.classList.add('off');
        startBtn.innerHTML = '… läuft';
        UI.clear(ergebnis);
        balken.classList.add('an');
        balken.firstChild.style.width = '0%';
        stand.textContent = 'Startet…';

        /* Der Router muss stillstehen: der Test baut jedes Spiel selbst
           auf und wieder ab. */
        SG.router.suspend(true);

        SG.selftest.laufen({
          steps: schritte,
          onFortschritt: function (fertig, gesamt, name) {
            if (!lebt) return;
            balken.firstChild.style.width = Math.round(fertig / gesamt * 100) + '%';
            stand.textContent = fertig + ' / ' + gesamt + ' · ' + (name || '');
          },
        }).then(function (r) {
          SG.router.suspend(false);
          D.laeuft = false;
          D.letzterLauf = r;
          if (!lebt) return;
          startBtn.classList.remove('off');
          startBtn.innerHTML = '▶ Selbsttest erneut starten';
          balken.classList.remove('an');
          balken.firstChild.style.width = '100%';
          stand.textContent = '';
          zeigen(r);
        }, function (e) {
          SG.router.suspend(false);
          D.laeuft = false;
          if (!lebt) return;
          startBtn.classList.remove('off');
          startBtn.innerHTML = '▶ Selbsttest starten';
          stand.textContent = 'Abgebrochen: ' + String(e);
        });
      }

      function zeigen(r) {
        UI.clear(ergebnis);
        var durch = (r.results || []).filter(function (x) { return !x.ok; });

        ergebnis.appendChild(UI.el('div.dev-zahlen', null, [
          zahl(String(r.passed), 'bestanden', 'gruen'),
          zahl(String(r.total - r.passed), 'durchgefallen',
            r.total === r.passed ? '' : 'rot'),
          zahl(String(r.total), 'geprüft', ''),
        ]));

        if (!durch.length) {
          ergebnis.appendChild(UI.el('div.notice', {
            html: '<b>Alles sauber.</b> Keine Ausnahme, kein NaN, keine verletzte '
              + 'Invariante, kein Aufräumfehler.',
          }));
        }

        (r.results || []).forEach(function (x) {
          ergebnis.appendChild(UI.el('div.dev-zeile' + (x.ok ? '' : '.schlecht'), null, [
            UI.el('div.dz-ic', { text: x.ok ? '✔' : '✖' }),
            UI.el('div.dz-haupt', null, [
              UI.el('div.dz-name', { text: x.name }),
              x.note ? UI.el('div.dz-fehler', { text: x.note }) : null,
            ]),
            UI.el('div.dz-zeit', { text: x.ms ? x.ms + ' ms' : '' }),
          ]));
        });
      }
    }

    function zahl(v, k, cls) {
      return UI.el('div.bnd-zahl' + (cls ? '.' + cls : ''), null, [
        UI.el('div.v', { text: v }),
        UI.el('div.k', { text: k }),
      ]);
    }

    /* ================================================================
       Verbindung
       ================================================================ */

    function netz(ziel) {
      var stand = UI.el('div');
      ziel.appendChild(stand);

      function malen() {
        UI.clear(stand);
        stand.appendChild(UI.kv([
          ['Relais erreichbar', Rel.verfuegbar() ? 'ja' : 'nein'],
          ['Letzte Runde geglückt', Rel.online ? 'ja' : 'nein'],
          ['Gerätekennung', Rel.geraet],
          ['Geräteart', Rel.geraeteArt],
          ['Aufenthalt', Rel.wo || '—'],
          ['Wird beobachtet', Rel.beobachtetMich ? 'ja' : 'nein'],
          ['Verwaltung', SG.verwaltung.online ? 'vom Relais' : 'nur lokal'],
          ['Offline-Build', SG.offline ? 'ja' : 'nein'],
        ]));
      }
      malen();

      ziel.appendChild(UI.el('div.sec-head', null, [
        UI.el('h2', { text: 'Laufzeit messen' }),
      ]));
      ziel.appendChild(UI.el('p.small.muted', {
        text: 'Schickt zehn kleine Anfragen und misst, wie lange sie brauchen. '
          + 'Das ist die halbe Strecke — bis eine Nachricht bei den anderen '
          + 'ankommt, dauert es ungefähr genauso lang noch einmal.',
      }));

      var mess = UI.el('div.dev-mess');
      var btn = UI.btn('📡 Zehnmal messen', function () { messen(); }, 'wide');
      UI.add(ziel, [btn, mess]);

      function messen() {
        if (!Rel.verfuegbar()) { UI.toast('Kein Relais erreichbar.', 'bad'); return; }
        UI.clear(mess);
        btn.classList.add('off');
        var zeiten = [];
        var i = 0;
        (function runde() {
          if (!lebt || i >= 10) return fertig();
          i++;
          var t0 = Date.now();
          Rel.post({ op: 'chat:read', brett: 'dev-ping' }, 10000).then(function () {
            zeiten.push(Date.now() - t0);
            malenMess(zeiten);
            setTimeout(runde, 120);
          }, function () {
            zeiten.push(-1);
            malenMess(zeiten);
            setTimeout(runde, 400);
          });
        })();

        function fertig() {
          btn.classList.remove('off');
          var gut = zeiten.filter(function (z) { return z >= 0; });
          if (!gut.length) { mess.textContent = 'Keine Antwort.'; return; }
          var schnitt = Math.round(gut.reduce(function (a, b) { return a + b; }, 0) / gut.length);
          var max = Math.max.apply(null, gut);
          mess.appendChild(UI.el('div.dev-zahlen', null, [
            zahl(schnitt + ' ms', 'im Schnitt', schnitt < 400 ? 'gruen' : 'rot'),
            zahl(max + ' ms', 'am längsten', max < 900 ? 'gruen' : 'rot'),
            zahl(gut.length + '/10', 'angekommen', gut.length === 10 ? 'gruen' : 'rot'),
          ]));
        }

        function malenMess(z) {
          var alt = mess.querySelector('.dev-balkenreihe');
          if (alt) UI.remove(alt);
          var reihe = UI.el('div.dev-balkenreihe');
          var groesste = Math.max(200, Math.max.apply(null, z.map(function (x) {
            return x < 0 ? 0 : x;
          })));
          z.forEach(function (x) {
            var s = UI.el('i');
            s.style.height = x < 0 ? '100%' : Math.max(4, x / groesste * 100) + '%';
            reihe.appendChild(UI.el('div.dev-saeule' + (x < 0 ? '.weg' : ''), {
              title: x < 0 ? 'keine Antwort' : x + ' ms',
            }, [s, UI.el('span', { text: x < 0 ? '—' : String(x) })]));
          });
          mess.insertBefore(reihe, mess.firstChild);
        }
      }

      ziel.appendChild(UI.el('div.sec-head', null, [
        UI.el('h2', { text: 'Beobachtete Bretter' }),
      ]));
      var kanaele = UI.el('div');
      ziel.appendChild(kanaele);
      var namen = ['kreis', 'admin', 'protokoll', 'antraege',
        SG.verhoer.BRETT_FEHL, SG.verhoer.BRETT_FAELLE];
      namen.forEach(function (n) {
        var k = Rel.kanal(n);
        kanaele.appendChild(UI.el('div.dev-zeile', null, [
          UI.el('div.dz-ic', { text: k.refs > 0 ? '👁' : '·' }),
          UI.el('div.dz-haupt', null, [
            UI.el('div.dz-name', { text: n }),
            UI.el('div.dz-fehler', {
              text: 'Version ' + k.version + ' · '
                + (k.nachrichten || []).length + ' Nachrichten'
                + (k.refs > 0 ? ' · wird beobachtet' : ''),
            }),
          ]),
        ]));
      });

      ziel.appendChild(UI.el('div', { style: { height: '10px' } }));
      ziel.appendChild(UI.btn('Verwaltung neu laden', function () {
        SG.verwaltung.laden().then(function () {
          malen();
          UI.toast('Neu geladen.', 'good');
        });
      }, 'wide ghost'));
    }

    /* ================================================================
       Ausnahmen
       ================================================================ */

    function fehler(ziel) {
      ziel.appendChild(UI.el('p.small.muted', {
        text: 'Alles, was seit dem Laden schiefgegangen ist. Wird auch dann '
          + 'gesammelt, wenn das Spiel weiterlief.',
      }));

      if (!SG.errors.length) {
        ziel.appendChild(UI.empty('✅', 'Keine Ausnahmen',
          'Seit dem Laden der Seite ist nichts danebengegangen.'));
      } else {
        SG.errors.slice().reverse().forEach(function (e) {
          var d = new Date(e.t);
          ziel.appendChild(UI.el('div.dev-zeile.schlecht', null, [
            UI.el('div.dz-ic', { text: '✖' }),
            UI.el('div.dz-haupt', null, [
              UI.el('div.dz-name', {
                text: e.where + ' · '
                  + String(d.getHours()).padStart(2, '0') + ':'
                  + String(d.getMinutes()).padStart(2, '0') + ':'
                  + String(d.getSeconds()).padStart(2, '0'),
              }),
              UI.el('pre.dz-stack', { text: e.msg }),
            ]),
          ]));
        });
      }

      ziel.appendChild(UI.el('div', { style: { height: '12px' } }));
      ziel.appendChild(UI.el('div.row.wrap', { style: { gap: '8px' } }, [
        UI.btn('Liste leeren', function () {
          SG.errors.length = 0;
          bauen();
        }, 'sm ghost'),
        UI.btn('Testausnahme werfen', function () {
          SG.noteError('dev.test', new Error('Absichtlich geworfen — alles in Ordnung.'));
          bauen();
        }, 'sm ghost'),
      ]));
    }

    /* ================================================================
       Speicher
       ================================================================ */

    function speicher(ziel) {
      var art = {
        local: 'dauerhaft im Browser', session: 'nur bis zum Schließen des Tabs',
        memory: 'nur im Arbeitsspeicher',
      }[SG.storage.mode];

      ziel.appendChild(UI.kv([
        ['Ablage', art],
        ['Flüchtig', SG.storage.volatile ? 'ja — Stände gehen verloren' : 'nein'],
        ['Belegt', U.num(SG.storage.size() / 1024, 1) + ' kB'],
        ['Quota erschöpft', SG.storage.isFull() ? 'ja' : 'nein'],
        ['Benutzerraum', SG.storage.user ? 'hgh:u:' + SG.storage.user : 'gemeinsam'],
        ['Schlüssel', String(SG.storage.keys().length)],
      ]));

      ziel.appendChild(UI.el('div.sec-head', null, [
        UI.el('h2', { text: 'Schlüssel im Benutzerraum' }),
      ]));
      var liste = UI.el('div.dev-schluessel');
      SG.storage.keys().sort().forEach(function (k) {
        var v = SG.storage.raw(k);
        liste.appendChild(UI.el('div.dev-zeile', null, [
          UI.el('div.dz-ic', { text: '·' }),
          UI.el('div.dz-haupt', null, [
            UI.el('div.dz-name', { text: k }),
            UI.el('div.dz-fehler', { text: U.trunc(String(v), 110) }),
          ]),
          UI.el('div.dz-zeit', { text: Math.round((v || '').length / 1024 * 10) / 10 + ' kB' }),
        ]));
      });
      ziel.appendChild(liste);
    }

    return {
      destroy: function () {
        lebt = false;
        SG.router.suspend(false);
        if (offen && offen.destroy) offen.destroy();
      },
    };
  };
})(SG);
