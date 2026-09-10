/* ------------------------------------------------------------------
   Wirtschafts-Tycoon - Oberflaeche

   Oben die Kennzahlen, in der Mitte der Schreibtisch zum Antippen,
   unten die Leiste mit Firmen, Boerse, Immobilien, Residenz, Luxus,
   Steuern und Statistik.

   Das Bild waechst mit: aus dem Schreibtisch im Hinterzimmer wird
   ueber die Raenge ein Bueroturm mit Skyline.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var G = SG.gfx;
  var UI = SG.ui;
  var B = SG.tycoon.biz;
  var D = B.data;
  var S = B.sim;

  var TEMPI = [0, 1, 2, 4];

  function mount(host) {
    var store = host.store;

    var st = {
      s: null,
      slot: store.get('slot', 1),
      drawer: null,
      lastSave: 0,
      saveWarned: false,
      kaufMenge: 1,          // 1 | 10 | 100 | 'max'
      pop: [],               // aufsteigende +Betraege am Schreibtisch
      puls: 0,
      t: 0,
    };

    var root = UI.el('div.tyc');
    host.stage.appendChild(root);
    host.stage.style.touchAction = 'none';

    var top = UI.el('div.tyc-top');
    var res = UI.el('div.tyc-res');
    var speeds = UI.el('div.speeds');
    top.appendChild(res);
    top.appendChild(speeds);

    var main = UI.el('div.tyc-main');
    var dock = UI.el('div.tyc-dock');
    root.appendChild(top);
    root.appendChild(main);
    root.appendChild(dock);

    var stage = SG.canvas.create(main, { alpha: false });
    var ctx = stage.ctx;

    var alertsEl = UI.el('div.tyc-alerts');
    main.appendChild(alertsEl);

    /* ---------------------------------------------------------- Kopfzeile */

    function resItem(cls, icon, key) {
      var v = UI.el('div.v', { text: '—' });
      var el = UI.el('div.res' + (cls ? '.' + cls : ''), null, [
        UI.el('div.ic', { text: icon }),
        UI.el('div.tx', null, [UI.el('div.k', { text: key }), v]),
      ]);
      el.set = function (t) { if (v.textContent !== t) v.textContent = t; };
      el.tint = function (c) { v.style.color = c || ''; };
      return el;
    }

    var rGeld = resItem('money', '€', 'Konto');
    var rProSek = resItem('', '⏱', 'Pro Sekunde');
    var rVermoegen = resItem('', '📊', 'Vermögen');
    var rAnsehen = resItem('', '👑', 'Ansehen');
    var rRang = resItem('', '🏅', 'Rang');
    var rSteuer = resItem('', '🧾', 'Steuern offen');
    var rDatum = resItem('', '📅', 'Zeit');
    [rGeld, rProSek, rVermoegen, rAnsehen, rRang, rSteuer, rDatum]
      .forEach(function (e) { res.appendChild(e); });

    TEMPI.forEach(function (sp) {
      var b = UI.el('button', {
        text: sp === 0 ? '❚❚' : sp + '×',
        on: {
          click: function () {
            if (!st.s) return;
            if (sp === 0) st.s.pausiert = true;
            else { st.s.pausiert = false; st.s.tempo = sp; }
            syncSpeeds();
            host.sfx('click');
          },
        },
      });
      b.dataset.sp = sp;
      speeds.appendChild(b);
    });

    function syncSpeeds() {
      for (var i = 0; i < speeds.children.length; i++) {
        var b = speeds.children[i];
        var sp = Number(b.dataset.sp);
        var on = st.s && (sp === 0 ? st.s.pausiert : (!st.s.pausiert && st.s.tempo === sp));
        b.classList.toggle('on', !!on);
      }
    }

    /* ---------------------------------------------------------- Leiste unten */

    function dockBtn(icon, label, onClick) {
      var b = UI.el('button.dockbtn', {
        on: { click: function () { host.sfx('click'); onClick(b); } },
      }, [UI.el('div.ic', { text: icon }), UI.el('div.lb', { text: label })]);
      dock.appendChild(b);
      return b;
    }

    dockBtn('🏢', 'Firmen', function () { openFirmen(); });
    dockBtn('📈', 'Börse', function () { openBoerse(); });
    dockBtn('🏘', 'Immobilien', function () { openImmobilien(); });
    dockBtn('🏡', 'Wohnen', function () { openResidenz(); });
    dockBtn('💎', 'Luxus', function () { openLuxus(); });
    var bSteuer = dockBtn('🧾', 'Steuern', function () { openSteuern(); });
    dockBtn('📊', 'Statistik', function () { openStats(); });

    host.tool('📖 Anleitung', function () { showTutorial(true); });
    var bSave = host.tool('💾', function () { openSaves(); });

    host.beforeExit = function () {
      if (!st.s) return true;
      save(st.slot, true);
      if (!SG.settings.get('confirmExit')) return true;
      return host.confirm('Firma verlassen?',
        'Der Stand wurde gerade gespeichert.', 'Verlassen');
    };
    host.onLeave(function () { save(st.slot, true); });

    var autosaveT = setInterval(function () { save(st.slot, true); }, 20000);
    host.onDestroy(function () { clearInterval(autosaveT); });

    /* ---------------------------------------------------------- Spielstand */

    function slotKey(n) { return 'slot' + n; }

    var flashT = 0;
    host.onDestroy(function () { clearTimeout(flashT); });

    function flashSaved() {
      if (!bSave) return;
      bSave.setLabel('✓');
      clearTimeout(flashT);
      flashT = setTimeout(function () { bSave.setLabel('💾'); }, 1200);
    }

    function save(n, silent) {
      if (!st.s) return false;
      if (SG.selftest && SG.selftest.active) return false;
      var ok = store.set(slotKey(n), S.serialize(st.s));
      store.set('slot', n);
      st.lastSave = Date.now();
      if (ok) flashSaved();
      if (!silent) {
        UI.toast(ok ? 'Gespeichert in Platz ' + n
          : 'Der Speicher ist voll — bitte den Spielstand-Code sichern.', ok ? 'good' : 'bad',
          ok ? undefined : 5200);
      } else if (!ok && !st.saveWarned) {
        st.saveWarned = true;
        UI.toast('Die Firma lässt sich hier nicht sichern — bitte über '
          + 'Einstellungen → Spielstand-Code sichern.', 'bad', 6000);
      }
      return ok;
    }

    function load(n) {
      var raw = store.get(slotKey(n), null);
      if (!raw) return false;
      var s = S.deserialize(raw);
      if (!s) return false;
      st.s = s;
      st.slot = n;
      store.set('slot', n);
      syncSpeeds();
      return true;
    }

    function sinceSave() {
      if (!st.lastSave) return 'noch nicht in dieser Sitzung';
      var x = Math.round((Date.now() - st.lastSave) / 1000);
      if (x < 5) return 'gerade eben';
      if (x < 90) return 'vor ' + x + ' Sekunden';
      return 'vor ' + Math.round(x / 60) + ' Minuten';
    }

    function openSaves() {
      var body = UI.el('div');
      for (var n = 1; n <= 3; n++) {
        (function (slot) {
          var raw = store.get(slotKey(slot), null);
          var row = UI.el('div.item' + (slot === st.slot ? '.sel' : ''), null, [
            UI.el('div.thumb', { text: String(slot) }),
            UI.el('div.main', null, [
              UI.el('div.t', { text: 'Platz ' + slot }),
              UI.el('div.d', {
                text: raw
                  ? 'Tag ' + raw.tag + ' · ' + U.euro(raw.geld || 0, true)
                    + ' · ' + D.KARRIERE[raw.karriere || 0].name
                  : 'leer',
              }),
            ]),
            UI.el('div.side', { style: { display: 'flex', gap: '6px' } }, [
              UI.btn('Speichern', function () { save(slot); m.close(); }, 'sm'),
              raw ? UI.btn('Laden', function () {
                m.close();
                if (load(slot)) UI.toast('Geladen.', 'good');
              }, 'sm ghost') : null,
            ]),
          ]);
          body.appendChild(row);
        })(n);
      }
      body.appendChild(UI.el('p.small.muted', {
        style: { marginTop: '10px' },
        text: 'Automatisch gesichert wird alle 20 Sekunden, außerdem beim Verlassen '
          + 'und sobald das iPad die Seite in den Hintergrund schiebt. '
          + 'Zuletzt gespeichert: ' + sinceSave() + '.',
      }));
      if (SG.storage.volatile) {
        body.appendChild(UI.el('div.notice.warn', {
          style: { marginTop: '8px' },
          html: '<b>Dieses Gerät speichert nicht dauerhaft.</b> Sichere den Fortschritt '
            + 'über <b>Einstellungen → Spielstand-Code</b>.',
        }));
      }
      body.appendChild(UI.btn('Neu anfangen', function () {
        m.close();
        host.confirm('Von vorn anfangen?',
          'Der Stand in Platz ' + st.slot + ' wird überschrieben.', 'Neu starten', true)
          .then(function (ok) {
            if (!ok) return;
            st.s = S.create((Date.now() ^ (Math.random() * 1e9)) >>> 0);
            save(st.slot, true);
            showTutorial(true);
          });
      }, 'sm bad wide'));
      var m = host.modal({ title: 'Spielstände', body: body });
    }

    /* ---------------------------------------------------------- Schublade */

    function drawer(title, build, actions) {
      if (st.drawer) st.drawer.close();
      st.drawer = UI.drawer({
        parent: root, title: title, build: build, actions: actions,
        onClose: function () { st.drawer = null; },
      });
      return st.drawer;
    }

    /* Eine Zeile im Laden: Symbol, Name, Beschreibung, Knopf */
    function zeile(icon, titel, unten, knopfText, machbar, onClick, extra) {
      var b = UI.btn(knopfText, function () {
        var fehler = onClick();
        if (fehler) { host.sfx('error'); UI.toast(fehler, 'bad', 2000); return; }
        host.sfx('cash');
        host.buzz(10);
        syncBar();
        if (st.drawer && st.drawer.rebuild) st.drawer.rebuild();
      }, 'sm' + (machbar ? ' primary' : ' ghost'));
      if (!machbar) b.disabled = true;
      return UI.el('div.item', null, [
        UI.el('div.thumb', { text: icon }),
        UI.el('div.main', null, [
          UI.el('div.t', { text: titel }),
          UI.el('div.d', { html: unten }),
          extra || null,
        ]),
        UI.el('div.side', null, [b]),
      ]);
    }

    /* Baut den Inhalt einer Schublade neu auf, ohne sie zu schliessen */
    function nachbauen(api, build) {
      api.rebuild = function () {
        UI.clear(api.body);
        build(api.body, api);
      };
      return api;
    }

    /* ---------------------------------------------------------- Firmen */

    function openFirmen() {
      var api = drawer('Firmen', function (body, self) { firmenInhalt(body, self); });
      nachbauen(api, function (body) { firmenInhalt(body, api); });
    }

    function firmenInhalt(body, self) {
      var s = st.s;
      var mengen = UI.el('div.row.wrap', { style: { gap: '6px', marginBottom: '12px' } });
      [1, 10, 100, 'max'].forEach(function (m) {
        mengen.appendChild(UI.btn(m === 'max' ? 'max' : '×' + m, function () {
          st.kaufMenge = m;
          self.rebuild();
        }, 'sm' + (st.kaufMenge === m ? ' primary' : ' ghost')));
      });
      body.appendChild(UI.el('p.small.muted', {
        text: 'Firmen bringen laufend Geld, ganz ohne Zutun. Jede Stufe kostet mehr '
          + 'als die vorige — alle ' + D.MEILENSTEIN + ' Stufen verdoppelt sich der Ertrag.',
      }));
      body.appendChild(mengen);

      D.FIRMEN.forEach(function (def, i) {
        var stufe = s.firmen[def.id] || 0;
        if (i > 0 && !(s.firmen[D.FIRMEN[i - 1].id] > 0) && !stufe) return;
        var menge = st.kaufMenge === 'max'
          ? Math.max(1, S.maxStufen(s, def.id)) : st.kaufMenge;
        var preis = D.firmenPreisMenge(def, stufe, menge);
        var ertrag = S.firmenErtrag(s, def.id);
        var bisMeilen = D.MEILENSTEIN - (stufe % D.MEILENSTEIN);
        var unten = def.text + '<br>'
          + (stufe
            ? '<b>Stufe ' + stufe + '</b> · ' + U.euro(ertrag, true) + ' / Sekunde'
              + ' · noch ' + bisMeilen + ' bis zur Verdopplung'
            : 'noch nicht gegründet');
        body.appendChild(zeile(def.icon, def.name, unten,
          (menge > 1 ? '×' + menge + ' · ' : '') + U.euro(preis, true),
          s.geld >= preis,
          function () { return S.firmaKaufen(s, def.id, menge); }));
      });
    }

    /* ---------------------------------------------------------- Boerse */

    function openBoerse() {
      var api = drawer('Börse', function (body, self) { boerseInhalt(body, self); });
      nachbauen(api, function (body) { boerseInhalt(body, api); });
    }

    function boerseInhalt(body, self) {
      var s = st.s;
      body.appendChild(UI.el('p.small.muted', {
        text: 'Kurse schwanken laufend. Manche Papiere zahlen täglich eine Dividende. '
          + 'Gewinne beim Verkauf zählen zum steuerpflichtigen Gewinn.',
      }));
      body.appendChild(UI.el('div.kv', null, [
        UI.el('div.kv-row', null, [
          UI.el('div.k', { text: 'Depotwert' }),
          UI.el('div.v', { text: U.euro(S.depotwert(s), true) }),
        ]),
      ]));

      s.aktien.forEach(function (a) {
        var def = D.aktie(a.id);
        var alt = a.verlauf.length > 1 ? a.verlauf[a.verlauf.length - 2] : a.kurs;
        var diff = alt ? (a.kurs - alt) / alt : 0;
        var wert = a.kurs * a.stueck;
        var gewinn = a.stueck ? (a.kurs - a.einstand) * a.stueck : 0;

        var chart = UI.chart(a.verlauf.slice(-20), { height: 34 });

        var kaufBtn = UI.btn('Kaufen', function () {
          mengeFragen('Wie viele ' + def.kuerzel + '?', a, true, self);
        }, 'sm primary');
        var verkBtn = UI.btn('Verkaufen', function () {
          mengeFragen('Wie viele ' + def.kuerzel + '?', a, false, self);
        }, 'sm ghost');
        if (s.geld < a.kurs) kaufBtn.disabled = true;
        if (!a.stueck) verkBtn.disabled = true;

        body.appendChild(UI.el('div.card', { style: { marginBottom: '10px' } }, [
          UI.el('div.row', { style: { alignItems: 'baseline', gap: '8px' } }, [
            UI.el('div', { style: { fontWeight: '650' }, text: def.name }),
            UI.el('div.small.muted', { text: def.kuerzel }),
            UI.el('div.spacer'),
            UI.el('div', {
              text: U.euro(a.kurs),
              style: { fontWeight: '700', color: 'var(--gold-2)' },
            }),
            UI.el('div.small', {
              text: (diff >= 0 ? '+' : '') + U.pct(diff, 1),
              style: { color: diff >= 0 ? 'var(--green)' : 'var(--red)' },
            }),
          ]),
          chart,
          UI.el('div.small.muted', { text: def.text }),
          a.stueck ? UI.el('div.small', {
            style: { marginTop: '4px' },
            html: '<b>' + U.num(a.stueck) + '</b> Stück · Wert ' + U.euro(wert, true)
              + ' · <span style="color:' + (gewinn >= 0 ? 'var(--green)' : 'var(--red)') + '">'
              + U.eurSigned(gewinn) + '</span>',
          }) : null,
          UI.el('div.row', { style: { gap: '6px', marginTop: '8px' } }, [kaufBtn, verkBtn]),
        ]));
      });
    }

    function mengeFragen(titel, a, kaufen, self) {
      var s = st.s;
      var max = kaufen ? Math.floor(s.geld / a.kurs) : a.stueck;
      if (max < 1) {
        UI.toast(kaufen ? 'Dafür reicht das Geld nicht.' : 'Nichts im Depot.', 'bad');
        return;
      }
      var feld = UI.el('input', {
        type: 'number', value: String(Math.min(max, kaufen ? 10 : max)), min: '1', max: String(max),
        style: {
          width: '100%', height: '46px', background: '#0b0e15',
          border: '1px solid var(--line)', borderRadius: '10px',
          color: 'var(--text)', padding: '0 12px', outline: 'none', fontSize: '17px',
        },
      });
      var body = UI.el('div', null, [
        UI.el('p.small.muted', {
          text: 'Kurs ' + U.euro(a.kurs) + ' · höchstens ' + U.num(max) + ' Stück',
        }),
        feld,
        UI.el('div.row.wrap', { style: { gap: '6px', marginTop: '10px' } }, [
          UI.btn('10', function () { feld.value = String(Math.min(10, max)); }, 'sm ghost'),
          UI.btn('100', function () { feld.value = String(Math.min(100, max)); }, 'sm ghost'),
          UI.btn('Alles', function () { feld.value = String(max); }, 'sm ghost'),
        ]),
      ]);
      host.modal({
        title: titel, body: body,
        actions: [
          { label: 'Abbrechen', cls: 'ghost' },
          {
            label: kaufen ? 'Kaufen' : 'Verkaufen', cls: 'primary',
            onClick: function () {
              var n = Math.min(max, Math.max(1, Math.floor(Number(feld.value) || 0)));
              var fehler = kaufen ? S.aktieKaufen(s, a.id, n) : S.aktieVerkaufen(s, a.id, n);
              if (fehler) { host.sfx('error'); UI.toast(fehler, 'bad'); return; }
              host.sfx('cash');
              syncBar();
              if (self && self.rebuild) self.rebuild();
            },
          },
        ],
      });
    }

    /* ---------------------------------------------------------- Immobilien */

    function openImmobilien() {
      var api = drawer('Immobilien', function (body, self) { immoInhalt(body, self); });
      nachbauen(api, function (body) { immoInhalt(body, api); });
    }

    function immoInhalt(body, self) {
      var s = st.s;
      body.appendChild(UI.el('p.small.muted', {
        text: 'Immobilien zahlen jeden Tag Miete. Der Unterhalt geht davon ab, '
          + 'beim Verkauf bleiben 92 Prozent des Kaufpreises.',
      }));
      body.appendChild(UI.el('div.kv', null, [
        UI.el('div.kv-row', null, [
          UI.el('div.k', { text: 'Miete je Tag' }),
          UI.el('div.v', { text: U.euro(S.mieteGesamt(s), true) }),
        ]),
        UI.el('div.kv-row', null, [
          UI.el('div.k', { text: 'Bestandswert' }),
          UI.el('div.v', { text: U.euro(S.immobilienwert(s), true) }),
        ]),
      ]));

      D.IMMOBILIEN.forEach(function (def, i) {
        var n = s.immobilien[def.id] || 0;
        if (i > 0 && !(s.immobilien[D.IMMOBILIEN[i - 1].id] > 0) && !n && s.geld < def.preis) return;
        var netto = def.miete * (1 - def.unterhalt);
        var unten = def.text + '<br>' + U.euro(netto) + ' netto je Tag'
          + (n ? ' · <b>' + n + ' im Bestand</b>' : '');
        var row = zeile(def.icon, def.name, unten, U.euro(def.preis, true),
          s.geld >= def.preis,
          function () { return S.immobilieKaufen(s, def.id); });
        if (n) {
          row.querySelector('.side').appendChild(UI.btn('Verkaufen', function () {
            S.immobilieVerkaufen(s, def.id);
            host.sfx('cash'); syncBar();
            if (self && self.rebuild) self.rebuild();
          }, 'sm ghost'));
        }
        body.appendChild(row);
      });
    }

    /* ---------------------------------------------------------- Residenz */

    function openResidenz() {
      var api = drawer('Wohnen', function (body, self) { residenzInhalt(body, self); });
      nachbauen(api, function (body) { residenzInhalt(body, api); });
    }

    function residenzInhalt(body) {
      var s = st.s;
      body.appendChild(UI.el('p.small.muted', {
        text: 'Wo du wohnst, bringt kein Geld — aber Ansehen. Und ohne Ansehen '
          + 'gibt es die oberen Ränge nicht. Der Unterhalt läuft täglich mit.',
      }));
      D.RESIDENZEN.forEach(function (def, i) {
        var jetzt = i === s.residenz;
        var frueher = i < s.residenz;
        var unten = def.text + '<br>Ansehen +' + def.ansehen
          + (def.unterhalt ? ' · Unterhalt ' + U.euro(def.unterhalt) + ' / Tag' : '');
        if (jetzt) {
          body.appendChild(UI.el('div.item.sel', null, [
            UI.el('div.thumb', { text: def.icon }),
            UI.el('div.main', null, [
              UI.el('div.t', { text: def.name }),
              UI.el('div.d', { html: unten }),
            ]),
            UI.el('div.side', null, [UI.el('div.small', {
              text: 'hier wohnst du', style: { color: 'var(--green)' },
            })]),
          ]));
          return;
        }
        if (frueher) return;
        body.appendChild(zeile(def.icon, def.name, unten, U.euro(def.preis, true),
          s.geld >= def.preis,
          function () { return S.residenzBeziehen(s, i); }));
      });
    }

    /* ---------------------------------------------------------- Luxus */

    function openLuxus() {
      var api = drawer('Luxus', function (body, self) { luxusInhalt(body, self); });
      nachbauen(api, function (body) { luxusInhalt(body, api); });
    }

    function luxusInhalt(body) {
      var s = st.s;
      body.appendChild(UI.el('p.small.muted', {
        text: 'Reine Statussymbole. Sie bringen Ansehen — und Ansehen bringt '
          + 'bessere Ränge und ein besseres Honorar für die eigene Arbeit.',
      }));
      D.LUXUS.forEach(function (def) {
        var hat = !!s.luxus[def.id];
        if (hat) {
          body.appendChild(UI.el('div.item.sel', null, [
            UI.el('div.thumb', { text: def.icon }),
            UI.el('div.main', null, [
              UI.el('div.t', { text: def.name }),
              UI.el('div.d', { text: def.text + ' · Ansehen +' + def.ansehen }),
            ]),
            UI.el('div.side', null, [UI.el('div.small', {
              text: '✓ gekauft', style: { color: 'var(--green)' },
            })]),
          ]));
          return;
        }
        body.appendChild(zeile(def.icon, def.name,
          def.text + '<br>Ansehen +' + def.ansehen,
          U.euro(def.preis, true), s.geld >= def.preis,
          function () { return S.luxusKaufen(s, def.id); }));
      });
    }

    /* ---------------------------------------------------------- Steuern */

    function openSteuern() {
      var api = drawer('Steuern', function (body, self) { steuerInhalt(body, self); });
      nachbauen(api, function (body) { steuerInhalt(body, api); });
    }

    function steuerInhalt(body, self) {
      var s = st.s;
      var satz = D.steuersatz(Math.max(0, s.gewinnSeitAbrechnung), S.rabatt(s));

      body.appendChild(UI.el('p.small.muted', {
        text: 'Jeden Monat kommt ein Steuerbescheid auf den Gewinn seit der letzten '
          + 'Abrechnung. Wer nicht zahlt, sammelt offene Forderungen an.',
      }));
      body.appendChild(UI.el('div.kv', null, [
        UI.el('div.kv-row', null, [
          UI.el('div.k', { text: 'Gewinn seit der letzten Abrechnung' }),
          UI.el('div.v', { text: U.euro(Math.max(0, s.gewinnSeitAbrechnung), true) }),
        ]),
        UI.el('div.kv-row', null, [
          UI.el('div.k', { text: 'Voraussichtlicher Satz' }),
          UI.el('div.v', { text: U.pct(satz) }),
        ]),
        UI.el('div.kv-row', null, [
          UI.el('div.k', { text: 'Letzter Bescheid' }),
          UI.el('div.v', { text: U.euro(s.letzteSteuer, true) }),
        ]),
        UI.el('div.kv-row', null, [
          UI.el('div.k', { text: 'Bisher gezahlt' }),
          UI.el('div.v', { text: U.euro(s.stat.steuern, true) }),
        ]),
      ]));

      if (s.steuerFaellig > 0) {
        body.appendChild(UI.el('div.notice.warn', {
          style: { margin: '10px 0' },
          html: '<b>Offen: ' + U.euro(s.steuerFaellig) + '</b><br>'
            + 'Solange etwas offen ist, schaut das Finanzamt genauer hin.',
        }));
        body.appendChild(UI.btn('Jetzt überweisen', function () {
          var fehler = S.steuerZahlen(s);
          if (fehler) { host.sfx('error'); UI.toast(fehler, 'bad'); return; }
          host.sfx('cash'); syncBar();
          if (self && self.rebuild) self.rebuild();
        }, 'wide primary'));
      } else {
        body.appendChild(UI.el('div.notice.good', {
          style: { margin: '10px 0' },
          text: 'Nichts offen. Sauber.',
        }));
      }

      body.appendChild(UI.el('div.sec-head', null, [UI.el('h2', { text: 'Beratung' })]));
      body.appendChild(UI.el('p.small.muted', {
        text: 'Jede Stufe senkt den Satz um drei Punkte, höchstens um '
          + U.pct(D.MAX_RABATT) + ' insgesamt. Alles völlig legal.',
      }));
      D.BERATUNG.forEach(function (def) {
        if (s.beratung[def.id]) {
          body.appendChild(UI.el('div.item.sel', null, [
            UI.el('div.thumb', { text: '📑' }),
            UI.el('div.main', null, [
              UI.el('div.t', { text: def.name }),
              UI.el('div.d', { text: def.text }),
            ]),
            UI.el('div.side', null, [UI.el('div.small', {
              text: '✓ beauftragt', style: { color: 'var(--green)' },
            })]),
          ]));
          return;
        }
        body.appendChild(zeile('📑', def.name, def.text + '<br>Satz −3 Punkte',
          U.euro(def.kosten, true), s.geld >= def.kosten,
          function () { return S.beratungKaufen(s, def.id); }));
      });
    }

    /* ---------------------------------------------------------- Statistik */

    function openStats() {
      drawer('Statistik', function (body) {
        var s = st.s;
        var rang = S.rang(s);
        var naechster = null;
        for (var i = 0; i < D.RAENGE.length; i++) {
          if (D.RAENGE[i].ab > S.vermoegen(s) || D.RAENGE[i].ansehen > S.ansehen(s)) {
            naechster = D.RAENGE[i]; break;
          }
        }

        body.appendChild(UI.el('div.kv', null, [
          zeileKV('Rang', rang.name),
          zeileKV('Vermögen', U.euro(S.vermoegen(s), true)),
          zeileKV('Konto', U.euro(s.geld, true)),
          zeileKV('Depot', U.euro(S.depotwert(s), true)),
          zeileKV('Immobilien', U.euro(S.immobilienwert(s), true)),
          zeileKV('Ansehen', String(S.ansehen(s))),
          zeileKV('Insgesamt verdient', U.euro(s.verdientGesamt, true)),
          zeileKV('Tipps am Schreibtisch', U.num(s.tipps)),
          zeileKV('Spieltage', U.num(s.tag)),
        ]));

        if (naechster) {
          body.appendChild(UI.el('div.notice', {
            style: { margin: '10px 0' },
            html: '<b>Nächster Rang: ' + naechster.name + '</b><br>'
              + 'Nötig: ' + U.euro(naechster.ab, true) + ' Vermögen'
              + (naechster.ansehen ? ' und ' + naechster.ansehen + ' Ansehen' : ''),
          }));
        }

        body.appendChild(UI.el('div.sec-head', null, [UI.el('h2', { text: 'Woher das Geld kam' })]));
        body.appendChild(UI.el('div.kv', null, [
          zeileKV('Firmen', U.euro(s.stat.firmenErtrag, true)),
          zeileKV('Mieten', U.euro(s.stat.mieten, true)),
          zeileKV('Dividenden', U.euro(s.stat.dividenden, true)),
          zeileKV('Steuern gezahlt', U.euro(s.stat.steuern, true)),
          zeileKV('Für Luxus ausgegeben', U.euro(s.stat.luxusAusgaben, true)),
        ]));

        body.appendChild(UI.el('div.sec-head', null, [UI.el('h2', { text: 'Zeitleiste' })]));
        var log = UI.el('div');
        s.meldungen.slice().reverse().slice(0, 25).forEach(function (m) {
          log.appendChild(UI.el('div.logline' + (m.art === 'gut' ? '.ok'
            : m.art === 'schlecht' ? '.no' : ''), null, [
            UI.el('div.tm', { text: 'T' + m.tag }),
            UI.el('div', { text: m.icon + ' ' + m.text }),
          ]));
        });
        body.appendChild(log);
      });
    }

    function zeileKV(k, v) {
      return UI.el('div.kv-row', null, [
        UI.el('div.k', { text: k }),
        UI.el('div.v', { text: v }),
      ]);
    }

    /* ---------------------------------------------------------- Anleitung */

    function showTutorial(force) {
      SG.tutorial.show({
        id: 'biz', force: force, parent: root, title: 'Wirtschafts-Tycoon',
        onDone: function () { if (st.s) st.s.pausiert = false; syncSpeeds(); },
        pages: [
          {
            kicker: 'Wirtschafts-Tycoon', title: 'Von der Aushilfe zum Imperium',
            art: function (c, w, h) {
              var rng = U.rng(3);
              for (var i = 0; i < 9; i++) {
                var bw = w / 9, x = i * bw, hh = h * (0.2 + rng() * 0.55);
                c.fillStyle = i % 2 ? '#161d2b' : '#131926';
                c.fillRect(x + 2, h - hh, bw - 4, hh);
              }
              c.strokeStyle = '#3ddc84'; c.lineWidth = 2.5;
              c.beginPath();
              c.moveTo(w * 0.06, h * 0.82);
              c.bezierCurveTo(w * 0.4, h * 0.78, w * 0.6, h * 0.3, w * 0.94, h * 0.16);
              c.stroke();
              G.circle(c, w * 0.94, h * 0.16, 4.5, '#3ddc84');
            },
            body: [
              'Du fängst mit einem Aushilfsjob an und einem leeren Konto.',
              'Am Ende gehören dir Firmen, Aktienpakete, halbe Straßenzüge und '
                + 'eine Insel. Dazwischen liegen viele Stunden — das ist Absicht.',
            ],
          },
          {
            kicker: 'Der Anfang', title: 'Antippen bringt Geld',
            art: function (c, w, h) {
              G.fillRound(c, w * 0.12, h * 0.62, w * 0.76, h * 0.3, 10, '#1b2233');
              G.glow(c, w / 2, h * 0.46, h * 0.3, '#f0b429', 0.25);
              G.circle(c, w / 2, h * 0.46, h * 0.17, '#f0b429');
              G.circle(c, w / 2, h * 0.46, h * 0.145, '#ffd166');
              G.text(c, '+5 €', w / 2, h * 0.46, {
                font: G.font(Math.round(h * 0.1), 700), fill: '#1a1204',
                align: 'center', baseline: 'middle',
              });
            },
            body: [
              'Tipp auf den goldenen Kreis in der Mitte. Jeder Tipp bringt Geld.',
              { ic: '🎓', text: 'Links daneben liegt die <b>Karriere</b>. Jede Stufe '
                + 'vervielfacht, was ein Tipp einbringt — von fünf Euro bis in die '
                + 'Hunderttausende.' },
            ],
          },
          {
            kicker: 'Passives Einkommen', title: 'Firmen arbeiten für dich',
            art: function (c, w, h) {
              var namen = ['📰', '🧺', '🏪', '☕', '🔧', '🏗'];
              for (var i = 0; i < 6; i++) {
                var x = w * (0.12 + (i % 3) * 0.28), y = h * (0.32 + Math.floor(i / 3) * 0.34);
                G.fillRound(c, x - w * 0.11, y - h * 0.12, w * 0.22, h * 0.24, 8, '#191f2e');
                G.text(c, namen[i], x, y, {
                  font: G.font(Math.round(h * 0.16), 400), align: 'center', baseline: 'middle',
                });
              }
            },
            body: [
              'Firmen bringen laufend Geld, ganz ohne Zutun — auch während du '
                + 'an der Börse bist.',
              { ic: '⭐', text: 'Alle <b>' + D.MEILENSTEIN + ' Stufen</b> verdoppelt '
                + 'sich der Ertrag einer Firma. Es lohnt sich, an einer dranzubleiben, '
                + 'statt überall eine Stufe zu kaufen.' },
            ],
          },
          {
            kicker: 'Anlegen', title: 'Börse und Immobilien',
            art: function (c, w, h) {
              c.strokeStyle = '#4aa3ff'; c.lineWidth = 2;
              c.beginPath();
              var pts = [0.5, 0.42, 0.55, 0.3, 0.38, 0.46, 0.22, 0.28, 0.18];
              for (var i = 0; i < pts.length; i++) {
                var x = w * (0.08 + i / (pts.length - 1) * 0.84);
                var y = h * (0.15 + pts[i] * 0.5);
                if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
              }
              c.stroke();
              for (i = 0; i < 4; i++) {
                G.fillRound(c, w * (0.1 + i * 0.22), h * 0.74, w * 0.16, h * 0.18, 5, '#212a3d');
              }
            },
            body: [
              'Aktien schwanken laufend, manche zahlen täglich Dividende. '
                + 'Immobilien zahlen jeden Tag Miete, abzüglich Unterhalt.',
              'Beides trägt dich durch eine Flaute, in der die Firmen einbrechen.',
            ],
          },
          {
            kicker: 'Die andere Seite', title: 'Das Finanzamt schaut zu',
            art: function (c, w, h) {
              G.fillRound(c, w * 0.28, h * 0.16, w * 0.44, h * 0.68, 8, '#e9edf6');
              c.fillStyle = '#8794b1';
              for (var i = 0; i < 7; i++) {
                c.fillRect(w * 0.34, h * (0.26 + i * 0.075), w * (i % 3 ? 0.3 : 0.2), 3);
              }
              G.text(c, '🧾', w * 0.74, h * 0.76, {
                font: G.font(Math.round(h * 0.22), 400), align: 'center', baseline: 'middle',
              });
            },
            body: [
              'Jeden Monat kommt ein Bescheid auf den Gewinn seit der letzten '
                + 'Abrechnung. Je mehr du verdienst, desto höher der Satz.',
              { ic: '📑', text: 'Steuerberater, Kanzlei, Holding und Stiftung senken '
                + 'den Satz um je drei Punkte — legal, aber nie auf null.' },
            ],
          },
          {
            kicker: 'Ganz nach oben', title: 'Ansehen zählt',
            art: function (c, w, h) {
              G.text(c, '🏝', w * 0.28, h * 0.5, {
                font: G.font(Math.round(h * 0.3), 400), align: 'center', baseline: 'middle',
              });
              G.text(c, '🛥', w * 0.55, h * 0.55, {
                font: G.font(Math.round(h * 0.24), 400), align: 'center', baseline: 'middle',
              });
              G.text(c, '👑', w * 0.78, h * 0.42, {
                font: G.font(Math.round(h * 0.26), 400), align: 'center', baseline: 'middle',
              });
            },
            body: [
              'Residenz und Luxus bringen kein Geld, sondern <b>Ansehen</b>.',
              'Ohne Ansehen gibt es die oberen Ränge nicht — egal wie voll '
                + 'das Konto ist. Und wer wer ist, wird für seine eigene Arbeit '
                + 'besser bezahlt.',
            ],
          },
        ],
      });
    }

    /* ---------------------------------------------------------- Kopf aktualisieren */

    function syncBar() {
      var s = st.s;
      if (!s) return;
      rGeld.set(U.euro(s.geld, true));
      rProSek.set(U.euro(S.ertragGesamt(s), true));
      rVermoegen.set(U.euro(S.vermoegen(s), true));
      rAnsehen.set(String(S.ansehen(s)));
      rRang.set(S.rang(s).name);
      rSteuer.set(s.steuerFaellig > 0 ? U.euro(s.steuerFaellig, true) : '—');
      rSteuer.tint(s.steuerFaellig > 0 ? 'var(--red)' : '');
      bSteuer.classList.toggle('warn', s.steuerFaellig > 0);
      var monat = Math.floor(s.tag / D.TAGE_PRO_MONAT) + 1;
      rDatum.set('Tag ' + s.tag + ' · Monat ' + monat);
    }

    var shownAlerts = 0;
    function syncAlerts() {
      var s = st.s;
      if (!s) return;
      while (shownAlerts < s.meldungen.length) {
        var m = s.meldungen[shownAlerts++];
        (function (mm) {
          var el = UI.el('div.alert.' + (mm.art === 'gut' ? 'good'
            : mm.art === 'schlecht' ? 'bad' : 'warn'), null, [
            UI.el('div.ic', { text: mm.icon }),
            UI.el('div.tx', { text: mm.text }),
          ]);
          alertsEl.appendChild(el);
          if (mm.art === 'schlecht') host.sfx('alert');
          host.after(function () {
            el.style.transition = 'opacity .3s ease';
            el.style.opacity = '0';
            host.after(function () { UI.remove(el); }, 320);
          }, 6500);
        })(m);
        while (alertsEl.children.length > 4) alertsEl.removeChild(alertsEl.firstChild);
      }
    }

    /* ---------------------------------------------------------- Zeichnen */

    function draw() {
      var s = st.s;
      var w = stage.w, h = stage.h;
      if (!s) return;

      // Hintergrund: Buero, das mit dem Rang waechst
      var stufe = 0;
      for (var i = 0; i < D.RAENGE.length; i++) {
        if (S.vermoegen(s) >= D.RAENGE[i].ab) stufe = i;
      }
      var himmel = G.linear(ctx, 0, 0, 0, h,
        [0, stufe >= 5 ? '#121a2c' : '#0d1017',
          1, stufe >= 3 ? '#1a2233' : '#10141d']);
      ctx.fillStyle = himmel;
      ctx.fillRect(0, 0, w, h);

      // Skyline hinter dem Fenster
      skyline(w, h, stufe);

      // Schreibtisch
      var tischH = Math.min(h * 0.3, 190);
      var tischY = h - tischH - 8;
      G.fillRound(ctx, w * 0.08, tischY, w * 0.84, tischH, 14, '#1b2233');
      ctx.fillStyle = 'rgba(255,255,255,.04)';
      ctx.fillRect(w * 0.08, tischY, w * 0.84, 3);

      // Bildschirm mit Kontostand
      var bw = Math.min(w * 0.5, 300), bh = bw * 0.42;
      var bx = w / 2 - bw / 2, by = tischY - bh - 6;
      G.fillRound(ctx, bx, by, bw, bh, 8, '#0a0d14');
      G.strokeRound(ctx, bx, by, bw, bh, 8, 'rgba(240,180,41,.35)', 1.5);
      G.fitText(ctx, U.euro(s.geld, true), bx + bw / 2, by + bh * 0.42, bw - 20, {
        font: G.font(Math.round(bh * 0.34), 700, true),
        fill: '#f0b429', align: 'center', baseline: 'middle',
      });
      G.text(ctx, S.rang(s).name, bx + bw / 2, by + bh * 0.76, {
        font: G.font(Math.round(bh * 0.15), 600),
        fill: '#8794b1', align: 'center', baseline: 'middle',
      });

      // Tippfeld
      var puls = 1 + Math.sin(st.puls * 9) * 0.03 * Math.max(0, st.puls);
      var kr = Math.min(w, h) * 0.11 * puls;
      var kx = w / 2, ky = tischY + tischH * 0.5;
      G.glow(ctx, kx, ky, kr * 1.8, '#f0b429', 0.16 + Math.max(0, st.puls) * 0.2);
      G.circle(ctx, kx, ky, kr, '#f0b429');
      G.circle(ctx, kx, ky, kr * 0.86, '#ffd166');
      G.text(ctx, '+' + U.euro(S.proTipp(s), true), kx, ky, {
        font: G.font(Math.round(kr * 0.36), 700),
        fill: '#1a1204', align: 'center', baseline: 'middle',
      });
      G.text(ctx, 'ARBEITEN', kx, ky + kr + 16, {
        font: G.font(12, 700), fill: '#8794b1', align: 'center', baseline: 'middle',
      });

      // Karriereknopf links neben dem Schreibtisch
      var naechste = D.KARRIERE[s.karriere + 1];
      var kb = karriereFeld();
      var bezahlbar = naechste && s.geld >= naechste.kosten;
      G.fillRound(ctx, kb.x, kb.y, kb.w, kb.h, 10, bezahlbar ? '#1c5f39' : '#212a3d');
      G.strokeRound(ctx, kb.x, kb.y, kb.w, kb.h, 10,
        bezahlbar ? '#3ddc84' : 'rgba(255,255,255,.08)', 1.2);
      G.fitText(ctx, naechste ? naechste.name : 'Am Ziel',
        kb.x + kb.w / 2, kb.y + kb.h / 2 - 9, kb.w - 14, {
          font: G.font(13, 650), fill: '#e9edf6', align: 'center', baseline: 'middle',
        });
      G.fitText(ctx, naechste ? U.euro(naechste.kosten, true) : D.KARRIERE[s.karriere].name,
        kb.x + kb.w / 2, kb.y + kb.h / 2 + 11, kb.w - 14, {
          font: G.font(12, 600), fill: bezahlbar ? '#c8f3da' : '#8794b1',
          align: 'center', baseline: 'middle',
        });

      // Aufsteigende Betraege
      for (i = st.pop.length - 1; i >= 0; i--) {
        var p = st.pop[i];
        ctx.globalAlpha = Math.max(0, p.leben);
        G.text(ctx, p.text, p.x, p.y, {
          font: G.font(16, 700), fill: '#3ddc84', align: 'center', baseline: 'middle',
        });
        ctx.globalAlpha = 1;
      }

      // Laufendes Ereignis
      if (s.ereignis) {
        var def = null;
        for (i = 0; i < D.EREIGNISSE.length; i++) {
          if (D.EREIGNISSE[i].id === s.ereignis.id) def = D.EREIGNISSE[i];
        }
        if (def) {
          var txt = def.name + ' · noch ' + s.ereignis.restTage + ' Tage';
          ctx.font = G.font(12, 650);
          var tw = ctx.measureText(txt).width + 22;
          G.fillRound(ctx, w / 2 - tw / 2, 10, tw, 26, 13,
            def.gut ? 'rgba(61,220,132,.16)' : 'rgba(255,95,107,.16)');
          G.text(ctx, txt, w / 2, 23, {
            font: G.font(12, 650), fill: def.gut ? '#c8f3da' : '#ffd3d7',
            align: 'center', baseline: 'middle',
          });
        }
      }
    }

    /* Trefferflaeche des Karriereknopfs. Wird aus den Buehnenmassen
       gerechnet, nicht beim Zeichnen gemerkt - sonst haengt die Bedienung
       daran, dass gerade ein Bild gezeichnet wurde. */
    function karriereFeld() {
      var w = stage.w, h = stage.h;
      var tischH = Math.min(h * 0.3, 190);
      var tischY = h - tischH - 8;
      var kbW = Math.min(w * 0.26, 170), kbH = 54;
      return { x: w * 0.1, y: tischY + tischH * 0.5 - kbH / 2, w: kbW, h: kbH };
    }

    function skyline(w, h, stufe) {
      var haeuser = 6 + stufe * 2;
      var basis = h * 0.62;
      var rng = U.rng(4242);
      for (var i = 0; i < haeuser; i++) {
        var bw2 = w / haeuser;
        var x = i * bw2;
        var hoehe = basis * (0.25 + rng() * (0.2 + stufe * 0.07));
        ctx.fillStyle = i % 2 ? '#161d2b' : '#131926';
        ctx.fillRect(x + 2, basis - hoehe, bw2 - 4, hoehe);
        // Fenster
        ctx.fillStyle = 'rgba(240,180,41,' + (0.05 + stufe * 0.025) + ')';
        for (var fy = basis - hoehe + 8; fy < basis - 8; fy += 12) {
          for (var fx = x + 8; fx < x + bw2 - 10; fx += 10) {
            if ((fx + fy) % 3) continue;
            ctx.fillRect(fx, fy, 4, 6);
          }
        }
      }
    }

    /* ---------------------------------------------------------- Schleife */

    var acc = 0;
    var loop = host.loop({
      hz: 30,
      update: function (dt) {
        var s = st.s;
        if (!s) return;
        st.t += dt;
        S.step(s, dt);
        syncAlerts();
        if (st.puls > 0) st.puls = Math.max(0, st.puls - dt * 3.5);
        for (var i = st.pop.length - 1; i >= 0; i--) {
          var p = st.pop[i];
          p.y -= dt * 46;
          p.leben -= dt * 1.1;
          if (p.leben <= 0) st.pop.splice(i, 1);
        }
        acc += dt;
        if (acc > 0.2) { acc = 0; syncBar(); }
      },
      render: draw,
    });

    /* ---------------------------------------------------------- Eingabe */

    host.inputOn(stage.el, {
      ignore: false,
      onTap: function (x, y) {
        var s = st.s;
        if (!s) return;

        // Karriere?
        var kb = karriereFeld();
        if (x >= kb.x && x <= kb.x + kb.w && y >= kb.y && y <= kb.y + kb.h) {
          var naechste = D.KARRIERE[s.karriere + 1];
          if (!naechste) { UI.toast('Weiter geht es nicht — du bist ganz oben.', null, 1800); return; }
          var fehler = S.karriereAufstieg(s);
          if (fehler) { host.sfx('error'); UI.toast(fehler, 'bad', 1800); return; }
          host.sfx('win'); host.buzz(24); syncBar();
          return;
        }

        // sonst: arbeiten
        var v = S.arbeiten(s);
        st.puls = 1;
        st.pop.push({ x: x + (Math.random() - 0.5) * 40, y: y - 12,
          text: '+' + U.euro(v, true), leben: 1 });
        if (st.pop.length > 24) st.pop.shift();
        host.sfx('click');
        host.buzz(6);
        syncBar();
      },
    });

    var keys = host.keys({
      onDown: function (k) {
        if (!st.s) return;
        if (k === 'space') { st.s.pausiert = !st.s.pausiert; syncSpeeds(); }
        else if (k === '1') { st.s.pausiert = false; st.s.tempo = 1; syncSpeeds(); }
        else if (k === '2') { st.s.pausiert = false; st.s.tempo = 2; syncSpeeds(); }
        else if (k === '3') { st.s.pausiert = false; st.s.tempo = 4; syncSpeeds(); }
      },
    });

    /* ---------------------------------------------------------- Start */

    if (!load(st.slot)) {
      st.s = S.create((Date.now() ^ (Math.random() * 1e9)) >>> 0);
    }
    showTutorial(false);
    syncSpeeds();
    syncBar();
    loop.start();

    if (SG.storage.volatile && !(SG.selftest && SG.selftest.active)) {
      var volT = setTimeout(function () {
        UI.toast('Dieses Gerät speichert nicht dauerhaft — die Firma hält nur, '
          + 'solange das Fenster offen ist.', 'bad', 6500);
      }, 1400);
      host.onDestroy(function () { clearTimeout(volT); });
    }

    return {
      state: st,
      destroy: function () {
        keys.destroy();
        if (st.drawer) st.drawer.close();
        save(st.slot, true);
        stage.destroy();
      },
      selftest: function (steps) {
        var s = S.create(4242);
        st.s = s;

        // Am Anfang traegt nur die eigene Arbeit
        if (S.ertragGesamt(s) !== 0) throw new Error('Startertrag ist nicht null');
        if (S.proTipp(s) <= 0) throw new Error('Ein Tipp bringt nichts ein');

        for (var i = 0; i < 40; i++) S.arbeiten(s);
        if (s.geld <= 0) throw new Error('Arbeiten bringt kein Geld');

        // Erste Firma muss aus eigener Kraft erreichbar sein
        var erste = D.FIRMEN[0];
        var tipps = 0;
        while (s.geld < erste.kosten && tipps++ < 400) S.arbeiten(s);
        if (s.geld < erste.kosten) {
          throw new Error('Die erste Firma ist nicht ertippbar (' + tipps + ' Tipps)');
        }
        if (S.firmaKaufen(s, erste.id, 1)) throw new Error('Firma lässt sich nicht kaufen');
        if (S.ertragGesamt(s) <= 0) throw new Error('Firma bringt nichts ein');

        // Durchrechnen
        var n = Math.min(steps || 600, 6000);
        for (i = 0; i < n; i++) {
          S.step(s, 0.1);
          if (!isFinite(s.geld)) throw new Error('Kasse ungültig');
          if (s.geld < -1e12) throw new Error('Kasse läuft ins Bodenlose');
        }
        if (s.tag <= 0) throw new Error('Die Zeit steht still');

        // Steuern muessen irgendwann anfallen
        s.gewinnSeitAbrechnung = 500000;
        var satz = D.steuersatz(500000, S.rabatt(s));
        if (satz <= 0 || satz > 0.5) throw new Error('Steuersatz unplausibel: ' + satz);

        // Speichern und Laden
        var back = S.deserialize(JSON.parse(JSON.stringify(S.serialize(s))));
        if (!back) throw new Error('Laden fehlgeschlagen');
        if (Math.round(back.geld) !== Math.round(s.geld)) throw new Error('Kasse nach dem Laden');
        if (back.firmen[erste.id] !== s.firmen[erste.id]) throw new Error('Firmen nach dem Laden');

        st.s = s;
        syncBar();
        draw();
      },
    };
  }

  SG.register({
    id: 'biztycoon',
    name: 'Wirtschafts-Tycoon',
    category: 'tycoon',
    desc: 'Vom Aushilfsjob zum Imperium — Firmen, Börse, Immobilien, Steuern',
    tags: ['wirtschaft', 'geld', 'aktien', 'immobilien', 'aufbau', 'tippen', 'business'],
    heavy: false,
    scoreLabel: function (bests, stats) {
      return stats && stats.rang ? String(stats.rang) : null;
    },
    preview: function (c, w, h) {
      c.fillStyle = '#0d1017';
      c.fillRect(0, 0, w, h);
      // Skyline
      var rng = U.rng(7);
      for (var i = 0; i < 9; i++) {
        var bw = w / 9;
        var x = i * bw;
        var hh = h * (0.25 + rng() * 0.45);
        c.fillStyle = i % 2 ? '#161d2b' : '#131926';
        c.fillRect(x + 1.5, h - hh, bw - 3, hh);
        c.fillStyle = 'rgba(240,180,41,.22)';
        for (var fy = h - hh + 6; fy < h - 6; fy += 9) {
          for (var fx = x + 5; fx < x + bw - 7; fx += 8) {
            if ((fx + fy) % 3) continue;
            c.fillRect(fx, fy, 3, 4);
          }
        }
      }
      // Steigende Kurve
      c.strokeStyle = '#3ddc84';
      c.lineWidth = 2.4;
      c.beginPath();
      var pts = [0.08, 0.2, 0.16, 0.3, 0.26, 0.44, 0.58, 0.52, 0.72, 0.88];
      for (i = 0; i < pts.length; i++) {
        var px = (i / (pts.length - 1)) * w;
        var py = h - h * 0.12 - pts[i] * h * 0.62;
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.stroke();
      G.circle(c, w * 0.94, h - h * 0.12 - 0.88 * h * 0.62, 4, '#3ddc84');
      // Euro
      G.text(c, '€', w * 0.5, h * 0.26, {
        font: G.font(Math.round(h * 0.3), 700), fill: 'rgba(240,180,41,.9)',
        align: 'center', baseline: 'middle',
      });
    },
    mount: mount,
  });
})(SG);
