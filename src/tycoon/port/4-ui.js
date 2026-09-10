/* ------------------------------------------------------------------
   Hafen-Tycoon - Oberflaeche

   Kopfleiste mit Kennzahlen, Karte mit Verschieben und Zwei-Finger-
   Zoom, Bauleiste unten und Schubladen fuer Flotte, Personal,
   Vertraege, Forschung, Bank und Statistik.

   Die Anleitung erscheint beim ersten Start automatisch, laesst sich
   überspringen und ist danach jederzeit über den Knopf oben erreichbar.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var G = SG.gfx;
  var UI = SG.ui;
  var P = SG.tycoon.port;
  var D = P.data;
  var S = P.sim;
  var Rd = P.render;

  var SPEEDS = [0, 1, 2, 4];

  function mount(host) {
    var store = host.store;

    var st = {
      s: null,
      slot: store.get('slot', 1),
      tool: null,           // aktives Baugebaeude
      abriss: false,        // Abrissmodus: Antippen entfernt Gebaeude
      ghost: null,
      selected: null,
      drawer: null,
      lastSave: 0,          // Uhrzeit der letzten Sicherung (Date.now)
      saveWarned: false,    // Warnung wegen fehlgeschlagener Sicherung schon gezeigt?
      hintT: 0,
      hint: '',
    };

    /* ---------------------------------------------------------- Aufbau */

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

    var vp = SG.canvas.viewport({ min: 0.35, max: 2.2, margin: 60 });

    var hintEl = UI.el('div.tyc-hint');
    hintEl.style.display = 'none';
    main.appendChild(hintEl);

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

    var rCash = resItem('money', '€', 'Konto');
    var rFlow = resItem('', '↕', 'Pro Tag');
    var rTeu = resItem('', '▦', 'TEU gesamt');
    var rShips = resItem('', '🚢', 'Am Kai');
    var rLevel = resItem('', '⭐', 'Level');
    var rRep = resItem('', '👍', 'Ruf');
    var rDate = resItem('', '📅', 'Datum');
    [rCash, rFlow, rTeu, rShips, rLevel, rRep, rDate].forEach(function (e) { res.appendChild(e); });

    SPEEDS.forEach(function (sp) {
      var b = UI.el('button', {
        text: sp === 0 ? '❚❚' : sp + '×',
        on: {
          click: function () {
            if (!st.s) return;
            if (sp === 0) st.s.paused = true;
            else { st.s.paused = false; st.s.speed = sp; }
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
        var on = st.s && (sp === 0 ? st.s.paused : (!st.s.paused && st.s.speed === sp));
        b.classList.toggle('on', !!on);
      }
    }

    /* ---------------------------------------------------------- Bauleiste */

    function dockBtn(icon, label, onClick, id) {
      var b = UI.el('button.dockbtn', {
        on: { click: function () { host.sfx('click'); onClick(b); } },
      }, [
        UI.el('div.ic', { text: icon }),
        UI.el('div.lb', { text: label }),
      ]);
      b.dataset.id = id || label;
      dock.appendChild(b);
      return b;
    }

    var bBuild = dockBtn('🏗', 'Bauen', function () { openBuild(); });
    dockBtn('🚚', 'Flotte', function () { openFleet(); });
    dockBtn('👷', 'Personal', function () { openStaff(); });
    dockBtn('📜', 'Verträge', function () { openContracts(); });
    dockBtn('🔬', 'Forschung', function () { openResearch(); });
    dockBtn('🌊', 'Baggern', function () { openDredge(); });
    dockBtn('🏦', 'Bank', function () { openBank(); });
    dockBtn('📊', 'Statistik', function () { openStats(); });
    var bStop = dockBtn('✖', 'Abbrechen', function () { setTool(null); });
    bStop.style.display = 'none';

    /* ---------------------------------------------------------- Werkzeuge */

    host.tool('📖 Anleitung', function () { showTutorial(true); });
    var bSave = host.tool('💾', function () { openSaves(); });

    host.beforeExit = function () {
      if (!st.s) return true;
      save(st.slot, true);
      if (!SG.settings.get('confirmExit')) return true;
      return host.confirm('Hafen verlassen?',
        'Der Stand wurde gerade gespeichert und wartet auf dich.', 'Verlassen');
    };

    /* Wird die Seite in den Hintergrund geschoben oder geschlossen, ist das
       der letzte Moment, in dem noch geschrieben werden kann. */
    host.onLeave(function () { save(st.slot, true); });

    /* Autosave nach der Uhr und bewusst neben der Bildschleife: die haelt an,
       sobald das Fenster den Fokus verliert, und die Spielzeit steht bei Pause
       ohnehin still - gebaut und umgeplant wird aber genau dann. */
    var autosaveT = setInterval(function () { save(st.slot, true); }, 20000);
    host.onDestroy(function () { clearInterval(autosaveT); });

    /* ---------------------------------------------------------- Spielstand */

    function slotKey(n) { return 'slot' + n; }

    var flashT = 0;
    host.onDestroy(function () { clearTimeout(flashT); });

    /* Kurze Rueckmeldung am Diskettenknopf, damit man sieht, dass etwas passiert */
    function flashSaved() {
      if (!bSave) return;
      bSave.setLabel('✓');
      clearTimeout(flashT);
      flashT = setTimeout(function () { bSave.setLabel('💾'); }, 1200);
    }

    function save(n, silent) {
      if (!st.s) return false;
      // Waehrend des Selbsttests nichts anfassen
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
        // Ein stilles Autosave darf nicht stumm scheitern
        st.saveWarned = true;
        UI.toast('Der Hafen lässt sich hier nicht sichern — bitte über '
          + 'Einstellungen → Spielstand-Code sichern.', 'bad', 6000);
      }
      return ok;
    }

    /* "vor 12 Sekunden" fuer die Spielstand-Liste */
    function sinceSave() {
      if (!st.lastSave) return 'noch nicht in dieser Sitzung';
      var s = Math.round((Date.now() - st.lastSave) / 1000);
      if (s < 5) return 'gerade eben';
      if (s < 90) return 'vor ' + s + ' Sekunden';
      return 'vor ' + Math.round(s / 60) + ' Minuten';
    }

    function load(n) {
      var raw = store.get(slotKey(n), null);
      if (!raw) return false;
      var s = S.deserialize(raw);
      if (!s) return false;
      st.s = s;
      st.slot = n;
      store.set('slot', n);
      fitView();
      syncSpeeds();
      return true;
    }

    function slotInfo(n) {
      var raw = store.get(slotKey(n), null);
      if (!raw) return null;
      var map = null;
      for (var i = 0; i < D.MAPS.length; i++) if (D.MAPS[i].id === raw.mapId) map = D.MAPS[i];
      return {
        map: map ? map.name : raw.mapId,
        day: Math.floor((raw.time || 0) / 24),
        cash: raw.cash || 0,
        level: raw.level || 1,
        teu: (raw.stats && raw.stats.teu) || 0,
      };
    }

    function openSaves() {
      var body = UI.el('div');
      for (var n = 1; n <= 3; n++) {
        (function (slot) {
          var info = slotInfo(slot);
          var row = UI.el('div.item' + (slot === st.slot ? '.sel' : ''), null, [
            UI.el('div.thumb', { text: String(slot) }),
            UI.el('div.main', null, [
              UI.el('div.t', { text: 'Platz ' + slot }),
              UI.el('div.d', {
                text: info
                  ? info.map + ' · Tag ' + info.day + ' · Level ' + info.level + ' · ' + U.euro(info.cash, true)
                  : 'leer',
              }),
            ]),
          ]);
          var acts = UI.el('div.side', { style: { display: 'flex', gap: '6px' } }, [
            UI.btn('Speichern', function () { save(slot); m.close(); }, 'sm'),
            info ? UI.btn('Laden', function () {
              m.close();
              if (load(slot)) UI.toast('Geladen.', 'good');
            }, 'sm ghost') : null,
          ]);
          row.appendChild(acts);
          body.appendChild(row);
        })(n);
      }
      body.appendChild(UI.el('p.small.muted', {
        style: { marginTop: '10px' },
        text: 'Automatisch gesichert wird alle 20 Sekunden in den aktuellen Platz, '
          + 'außerdem beim Verlassen und sobald das iPad die Seite in den Hintergrund '
          + 'schiebt. Zuletzt gespeichert: ' + sinceSave() + '.',
      }));
      if (SG.storage.volatile) {
        body.appendChild(UI.el('div.notice.warn', {
          style: { marginTop: '8px' },
          html: '<b>Dieses Gerät speichert nicht dauerhaft.</b> Der Hafen hält nur, '
            + 'solange das Fenster offen bleibt. Dauerhaft wird es über '
            + '<b>Zum Home-Bildschirm</b> — oder sichere den Fortschritt über '
            + '<b>Einstellungen → Spielstand-Code</b>.',
        }));
      }
      body.appendChild(UI.btn('Neues Spiel starten', function () {
        m.close();
        chooseMap();
      }, 'sm bad wide'));
      var m = host.modal({ title: 'Spielstände', body: body });
    }

    /* ---------------------------------------------------------- Karten */

    function chooseMap() {
      var body = UI.el('div');
      var best = store.get('bestLevel', 1);
      D.MAPS.forEach(function (map) {
        var locked = map.level > best;
        body.appendChild(UI.el('div.item' + (locked ? '.locked' : '.tap'), {
          on: {
            click: function () {
              if (locked) {
                UI.toast('Erreiche zuerst Terminal-Level ' + map.level + ' in einem anderen Hafen.', 'bad', 3000);
                return;
              }
              m.close();
              st.s = S.create(map.id);
              fitView();
              syncSpeeds();
              save(st.slot, true);
              showTutorial(false);
            },
          },
        }, [
          UI.el('div.thumb', { text: locked ? '🔒' : '⚓' }),
          UI.el('div.main', null, [
            UI.el('div.t', { text: map.name }),
            UI.el('div.d', { text: map.desc }),
            UI.tags([
              { text: map.w + '×' + map.h + ' Felder' },
              { text: map.baseDepth + ' m Wassertiefe' },
              { text: U.euro(map.start, true) + ' Startkapital', cls: 'y' },
              locked ? { text: 'ab Level ' + map.level, cls: 'r' } : null,
            ]),
          ]),
        ]));
      });
      var m = host.modal({ title: 'Hafen wählen', body: body, closable: !!st.s });
    }

    /* ---------------------------------------------------------- Bauen */

    /* id ist eine Gebaeudekennung, 'abriss' fuer den Abrissmodus oder
       null fuer "nichts ausgewaehlt". */
    function setTool(id) {
      st.tool = id === 'abriss' ? null : id;
      st.abriss = id === 'abriss';
      st.ghost = null;
      bBuild.classList.toggle('on', !!id);
      bStop.style.display = id ? '' : 'none';
      if (st.abriss) {
        showHint('<b>Abrissmodus</b> — Gebäude antippen, um es zu entfernen. '
          + 'Du bekommst 35 % zurück. ✖ beendet den Modus.');
      } else if (id) {
        var def = D.byId(id);
        showHint('<b>' + def.name + '</b> platzieren — tippen zum Bauen, ✖ beendet den Baumodus.');
      } else hideHint();
    }

    /* Reisst ein Gebaeude ab und meldet, was es eingebracht hat. */
    function abreissen(b, ohneNachfrage) {
      var s = st.s;
      var def = D.byId(b.def);
      if (!def) return;
      var zurueck = Math.round(def.cost * 0.35);

      function machen() {
        S.demolish(s, b);
        st.selected = null;
        host.sfx('thud');
        host.buzz(14);
        UI.toast(def.name + ' abgerissen · ' + U.euro(zurueck, true) + ' zurück', 'good', 1800);
        syncBar();
      }

      // Im Abrissmodus wird nur bei teuren Bauten nachgefragt - sonst
      // waere das Aufraeumen einer Reihe eine Dialogorgie.
      if (ohneNachfrage && def.cost < 200000) { machen(); return; }
      host.confirm('Abreißen?',
        def.name + ' wird entfernt. Du bekommst ' + U.euro(zurueck) + ' zurück.',
        'Abreißen', true).then(function (ok) { if (ok) machen(); });
    }

    function openBuild() {
      var s = st.s;
      var body = UI.el('div');
      var groups = [
        { name: 'Kai und Brücken', kinds: ['quay', 'crane'] },
        { name: 'Lagerflächen', kinds: ['yard'] },
        { name: 'Gebäude', kinds: ['infra'] },
      ];
      groups.forEach(function (grp) {
        body.appendChild(UI.el('div.sec-head', null, [UI.el('h2', { text: grp.name })]));
        D.BUILDINGS.forEach(function (def) {
          if (grp.kinds.indexOf(def.kind) < 0) return;
          var locked = (def.needLevel && s.level < def.needLevel) ||
            (def.needTech && s.tech.indexOf(def.needTech) < 0);
          var poor = s.cash < def.cost;
          var have = S.list(s, def.id).length;
          body.appendChild(UI.el('div.item' + (locked ? '.locked' : '.tap'), {
            on: {
              click: function () {
                if (locked) {
                  UI.toast(def.needTech && s.tech.indexOf(def.needTech) < 0
                    ? 'Dafür fehlt noch die Forschung.'
                    : 'Erst ab Terminal-Level ' + def.needLevel + '.', 'bad');
                  return;
                }
                if (poor) { UI.toast('Nicht genug Geld.', 'bad'); return; }
                m.close();
                setTool(def.id);
              },
            },
          }, [
            UI.el('div.thumb', { text: def.icon }),
            UI.el('div.main', null, [
              UI.el('div.t', null, [
                document.createTextNode(def.name),
                have ? UI.el('span.tag', { text: have + '×' }) : null,
              ]),
              UI.el('div.d', { text: def.desc }),
              UI.tags([
                { text: def.w + '×' + def.h + ' Felder' },
                { text: U.euro(def.upkeep) + '/Tag Unterhalt' },
                def.power ? { text: def.power + ' kW', cls: 'y' } : null,
                def.staff ? { text: D.staffById(def.staff).name, cls: 'b' } : null,
              ]),
            ]),
            UI.el('div.side', null, [
              UI.el('div.p', {
                text: U.euro(def.cost, true),
                style: { color: poor ? 'var(--red)' : '' },
              }),
              UI.el('div.s', { text: locked ? 'gesperrt' : '' }),
            ]),
          ]));
        });
      });

      body.appendChild(UI.el('div.sec-head', null, [UI.el('h2', { text: 'Abreißen' })]));
      body.appendChild(UI.el('p.small.muted', {
        text: 'Du bekommst 35 % der Baukosten zurück. Einzeln geht es auch über '
          + 'Antippen eines Gebäudes.',
      }));
      body.appendChild(UI.el('div.item.tap', {
        on: { click: function () { m.close(); setTool('abriss'); } },
      }, [
        UI.el('div.thumb', { text: '🧨' }),
        UI.el('div.main', null, [
          UI.el('div.t', { text: 'Abrissmodus' }),
          UI.el('div.d', { text: 'Danach jedes Gebäude durch Antippen entfernen.' }),
        ]),
        UI.el('div.side', null, [UI.el('div.s', { text: '›' })]),
      ]));

      var m = host.modal({ title: 'Bauen', body: body, wide: true });
    }

    function tryBuild(tx, ty) {
      var s = st.s;
      var def = D.byId(st.tool);
      if (!def) return;
      var err = S.place(s, st.tool, tx, ty);
      if (err) {
        host.sfx('error');
        UI.toast(err, 'bad', 1800);
        return;
      }
      host.sfx('build');
      host.buzz(16);
      Rd.groundLayer(s);   // Cache bleibt gueltig
      // Fortlaufendes Bauen: Werkzeug bleibt aktiv
    }

    /* ---------------------------------------------------------- Schubladen */

    function drawer(title, build, actions) {
      if (st.drawer) st.drawer.close();
      st.drawer = UI.drawer({
        parent: root, title: title, build: build, actions: actions,
        onClose: function () { st.drawer = null; },
      });
      return st.drawer;
    }

    function openFleet() {
      drawer('Flotte', function (body, api) {
        var s = st.s;
        var rate = S.vehicleRate(s);
        var crane = S.craneRate(s);
        body.appendChild(UI.el('div.card', null, [
          UI.kv([
            ['Brücken-Leistung', Math.round(crane.rate) + ' Bew./h'],
            ['Fahrzeug-Leistung', Math.round(rate) + ' Bew./h',
              rate < crane.rate ? 'r' : 'g'],
            ['Engpass', rate < crane.rate ? 'Fahrzeuge' : 'Brücken'],
          ]),
          UI.el('p.small.muted', {
            text: rate < crane.rate
              ? 'Die Brücken warten auf Fahrzeuge. Kaufe mehr Van-Carrier oder Traktoren.'
              : 'Die Fahrzeuge sind schnell genug. Mehr Leistung bringen zusätzliche Brücken.',
          }),
        ]));

        D.VEHICLES.forEach(function (v) {
          var have = s.vehicles[v.id] || 0;
          var locked = (v.needLevel && s.level < v.needLevel) ||
            (v.needTech && s.tech.indexOf(v.needTech) < 0);
          body.appendChild(UI.el('div.item' + (locked ? '.locked' : ''), null, [
            UI.el('div.thumb', { text: v.icon }),
            UI.el('div.main', null, [
              UI.el('div.t', null, [
                document.createTextNode(v.name),
                have ? UI.el('span.tag.g', { text: have + '×' }) : null,
              ]),
              UI.el('div.d', { text: v.desc }),
              UI.tags([
                v.rate ? { text: v.rate + ' Bew./h' } : null,
                { text: U.euro(v.upkeep) + '/Tag' },
                v.diesel ? { text: v.diesel + ' l/h', cls: 'r' } : null,
                v.power ? { text: v.power + ' kW', cls: 'y' } : null,
                locked ? { text: v.needTech ? 'Forschung fehlt' : 'ab Level ' + v.needLevel, cls: 'r' } : null,
              ]),
            ]),
            UI.el('div.side', { style: { display: 'flex', flexDirection: 'column', gap: '5px' } }, [
              UI.el('div.p', { text: U.euro(v.cost, true) }),
              UI.el('div', { style: { display: 'flex', gap: '5px' } }, [
                UI.btn('−', function () {
                  var e = S.sellVehicle(s, v.id, 1);
                  if (e) UI.toast(e, 'bad'); else { host.sfx('cash'); api.close(); openFleet(); }
                }, 'sm ghost'),
                UI.btn('+', function () {
                  if (locked) { UI.toast('Noch nicht verfügbar.', 'bad'); return; }
                  var e = S.buyVehicle(s, v.id, 1);
                  if (e) UI.toast(e, 'bad'); else { host.sfx('cash'); api.close(); openFleet(); }
                }, 'sm primary'),
              ]),
            ]),
          ]));
        });
      });
    }

    function openStaff() {
      drawer('Personal', function (body, api) {
        var s = st.s;
        var staff = S.staffing(s);
        var sh = D.SHIFTS[s.shift - 1];

        body.appendChild(UI.el('div.card', null, [
          UI.el('div.row', null, [
            UI.el('div', { style: { flex: '1' } }, [
              UI.el('b', { text: 'Stimmung' }),
              UI.el('div.small.muted', {
                text: s.morale > 70 ? 'Alle ziehen mit.'
                  : s.morale > 45 ? 'Es läuft, aber es knirscht.'
                    : 'Schlechte Laune — Streikgefahr!',
              }),
            ]),
            UI.el('div', { style: { fontSize: '22px', fontWeight: '750' }, text: Math.round(s.morale) + '%' }),
          ]),
          UI.bar(s.morale / 100, s.morale > 60 ? 'green' : s.morale > 40 ? '' : 'red'),
        ]));

        body.appendChild(UI.el('div.sec-head', null, [UI.el('h2', { text: 'Schichtmodell' })]));
        D.SHIFTS.forEach(function (opt) {
          body.appendChild(UI.el('div.item.tap' + (opt.id === s.shift ? '.sel' : ''), {
            on: {
              click: function () {
                s.shift = opt.id;
                host.sfx('click');
                api.close();
                openStaff();
              },
            },
          }, [
            UI.el('div.thumb', { text: opt.id + '×' }),
            UI.el('div.main', null, [
              UI.el('div.t', { text: opt.name }),
              UI.el('div.d', { text: opt.desc + ' Lohnfaktor ' + opt.wageMul.toFixed(2) + '×' }),
            ]),
          ]));
        });

        body.appendChild(UI.el('div.sec-head', null, [UI.el('h2', { text: 'Belegschaft' })]));
        D.STAFF.forEach(function (role) {
          var info = staff[role.id];
          var wage = Math.round(role.wage * sh.wageMul);
          body.appendChild(UI.el('div.item', null, [
            UI.el('div.thumb', { text: role.icon }),
            UI.el('div.main', null, [
              UI.el('div.t', null, [
                document.createTextNode(role.name),
                info.need > info.have ? UI.el('span.tag.r', { text: 'zu wenige' }) : null,
              ]),
              UI.el('div.d', { text: role.desc }),
              UI.el('div.small.muted', {
                text: info.have + ' beschäftigt · ' + info.need + ' gebraucht · '
                  + U.euro(wage) + ' pro Tag und Kopf',
              }),
              UI.bar(info.ratio, info.ratio >= 1 ? 'green' : 'red'),
            ]),
            UI.el('div.side', { style: { display: 'flex', gap: '5px' } }, [
              UI.btn('−', function () {
                S.hire(s, role.id, -1);
                host.sfx('click');
                api.close(); openStaff();
              }, 'sm ghost'),
              UI.btn('+', function () {
                S.hire(s, role.id, 1);
                host.sfx('click');
                api.close(); openStaff();
              }, 'sm primary'),
            ]),
          ]));
        });
      });
    }

    function openContracts() {
      drawer('Verträge', function (body, api) {
        var s = st.s;
        var max = 2 + Math.floor(s.level / 3);

        body.appendChild(UI.el('div.sec-head', null, [
          UI.el('h2', { text: 'Laufend' }),
          UI.el('span.count', { text: s.contracts.length + ' von ' + max }),
        ]));
        if (!s.contracts.length) {
          body.appendChild(UI.el('p.small.muted', { text: 'Noch kein Vertrag angenommen.' }));
        }
        s.contracts.forEach(function (c) {
          var cls = D.shipClass(c.shipClass);
          body.appendChild(UI.el('div.item', null, [
            UI.el('div.thumb', { text: '📜' }),
            UI.el('div.main', null, [
              UI.el('div.t', { text: S.lineName(c.line) }),
              UI.el('div.d', {
                text: cls.name + ' · ' + U.num(c.done) + ' von ' + U.num(c.volume) + ' TEU · noch ' + c.daysLeft + ' Tage',
              }),
              UI.bar(c.done / c.volume, c.done >= c.volume ? 'green' : ''),
              UI.tags([
                { text: U.euro(c.tariff) + '/TEU', cls: 'y' },
                { text: 'Strafe ' + U.euro(c.penalty, true), cls: 'r' },
              ]),
            ]),
          ]));
        });

        body.appendChild(UI.el('div.sec-head', null, [UI.el('h2', { text: 'Angebote' })]));
        s.offers.forEach(function (c) {
          var cls = D.shipClass(c.shipClass);
          var good = c.tariff > D.ECON.baseTariff;
          body.appendChild(UI.el('div.item.tap', {
            on: {
              click: function () {
                var e = S.acceptOffer(s, c.id);
                if (e) UI.toast(e, 'bad');
                else { host.sfx('cash'); UI.toast('Vertrag angenommen.', 'good'); }
                api.close();
                openContracts();
              },
            },
          }, [
            UI.el('div.thumb', { text: '✍' }),
            UI.el('div.main', null, [
              UI.el('div.t', { text: S.lineName(c.line) }),
              UI.el('div.d', {
                text: U.num(c.volume) + ' TEU in ' + c.days + ' Tagen · vorwiegend ' + cls.name,
              }),
              UI.tags([
                { text: U.euro(c.tariff) + '/TEU', cls: good ? 'g' : 'y' },
                { text: 'Strafe ' + U.euro(c.penalty, true), cls: 'r' },
                { text: 'Wert ' + U.euro(c.volume * c.tariff, true) },
              ]),
            ]),
            UI.el('div.side', null, [UI.el('div.s', { text: 'annehmen ›' })]),
          ]));
        });
        if (!s.offers.length) {
          body.appendChild(UI.el('p.small.muted', { text: 'Gerade liegt nichts vor. Alle paar Tage kommen neue Angebote.' }));
        }
      });
    }

    function openResearch() {
      drawer('Forschung', function (body, api) {
        var s = st.s;
        if (s.research) {
          var t = D.techById(s.research.id);
          body.appendChild(UI.el('div.card', null, [
            UI.el('b', { text: 'Läuft: ' + t.name }),
            UI.el('div.small.muted', { text: 'Noch ' + Math.ceil(s.research.daysLeft) + ' Tage' }),
            UI.bar(1 - s.research.daysLeft / s.research.total),
          ]));
        }
        D.TECH.forEach(function (t) {
          var done = s.tech.indexOf(t.id) >= 0;
          var missing = t.needs.filter(function (n) { return s.tech.indexOf(n) < 0; });
          var locked = missing.length > 0;
          body.appendChild(UI.el('div.item' + (done ? '' : (locked ? '.locked' : '.tap')), {
            on: {
              click: function () {
                if (done || locked) return;
                var e = S.startResearch(s, t.id);
                if (e) UI.toast(e, 'bad');
                else { host.sfx('power'); UI.toast('Forschung gestartet.', 'good'); }
                api.close();
                openResearch();
              },
            },
          }, [
            UI.el('div.thumb', { text: done ? '✓' : t.icon }),
            UI.el('div.main', null, [
              UI.el('div.t', { text: t.name }),
              UI.el('div.d', { text: t.desc }),
              UI.tags([
                { text: t.days + ' Tage' },
                locked ? {
                  text: 'braucht ' + missing.map(function (n) { return D.techById(n).name; }).join(', '),
                  cls: 'r',
                } : null,
                done ? { text: 'erforscht', cls: 'g' } : null,
              ]),
            ]),
            UI.el('div.side', null, [
              UI.el('div.p', { text: done ? '—' : U.euro(t.cost, true) }),
            ]),
          ]));
        });
      });
    }

    function openDredge() {
      var s = st.s;
      var body = UI.el('div');
      body.appendChild(UI.el('p.small.muted', {
        text: 'Größere Schiffe brauchen tieferes Wasser. Ein Panamax braucht 12 m, '
          + 'ein Neo-Panamax 15,2 m, ein ULCS 16,5 m.',
      }));
      body.appendChild(UI.el('div.card', null, [
        UI.kv([
          ['Aktuelle Tiefe', s.depth.toFixed(1) + ' m'],
          ['Maximal möglich', D.ECON.maxDepth.toFixed(1) + ' m'],
        ]),
      ]));
      D.SHIP_CLASSES.forEach(function (c) {
        body.appendChild(UI.el('div.row', {
          style: { justifyContent: 'space-between', fontSize: '13px', padding: '3px 0' },
        }, [
          UI.el('span', { text: c.name + ' · ' + c.draft + ' m' }),
          UI.el('span', {
            text: s.depth >= c.draft ? '✓ passt' : '✗ zu flach',
            style: { color: s.depth >= c.draft ? 'var(--green)' : 'var(--red)' },
          }),
        ]));
      });
      [0.5, 1, 2].forEach(function (m2) {
        var cost = S.dredgeCost(s, m2);
        body.appendChild(UI.btn(
          '+' + m2.toFixed(1) + ' m baggern — ' + U.euro(cost, true),
          function () {
            var e = S.dredge(s, m2);
            if (e) UI.toast(e, 'bad', 2600);
            else {
              host.sfx('build');
              UI.toast('Fahrwasser vertieft auf ' + s.depth.toFixed(1) + ' m.', 'good');
              G.dropCache('port-ground');
              m.close();
            }
          }, 'sm wide'));
      });
      var m = host.modal({ title: 'Fahrwasser baggern', body: body });
    }

    function openBank() {
      var s = st.s;
      var body = UI.el('div');
      body.appendChild(UI.el('div.card', null, [
        UI.kv([
          ['Konto', U.euro(Math.round(s.cash)), s.cash < 0 ? 'r' : 'g'],
          ['Kredit', U.euro(Math.round(s.loan)), s.loan > 0 ? 'r' : ''],
          ['Zinssatz', U.pct(D.ECON.loanRate, 1)],
          ['Rahmen', U.euro(D.ECON.loanMax, true)],
        ]),
      ]));
      [100000, 250000, 500000, 1000000].forEach(function (amt) {
        body.appendChild(UI.btn('Kredit aufnehmen: ' + U.euro(amt, true), function () {
          var e = S.takeLoan(s, amt);
          if (e) UI.toast(e, 'bad');
          else { host.sfx('cash'); m.close(); }
        }, 'sm wide'));
      });
      if (s.loan > 0) {
        body.appendChild(UI.el('div', { style: { height: '8px' } }));
        [100000, 250000, s.loan].forEach(function (amt) {
          body.appendChild(UI.btn('Zurückzahlen: ' + U.euro(Math.round(amt), true), function () {
            var e = S.repayLoan(s, amt);
            if (e) UI.toast(e, 'bad');
            else { host.sfx('cash'); m.close(); }
          }, 'sm ghost wide'));
        });
      }
      var m = host.modal({ title: 'Bank', body: body });
    }

    function openStats() {
      drawer('Statistik', function (body) {
        var s = st.s;
        var hist = s.stats.history.slice(-60);
        var cap = S.yardCapacity(s);
        var used = S.yardUsed(s);
        var power = S.power(s);
        var crane = S.craneRate(s);

        body.appendChild(UI.el('div.sec-head', null, [UI.el('h2', { text: 'Tagesgewinn' })]));
        body.appendChild(UI.chart([
          { data: hist.map(function (h) { return h.profit; }), color: '#3ddc84', fill: 'rgba(61,220,132,.25)' },
        ], { zero: true, height: 110 }));
        body.appendChild(UI.el('div.chart-legend', null, [
          UI.el('span', { html: '<i style="background:#3ddc84"></i>Gewinn je Tag' }),
        ]));

        body.appendChild(UI.el('div.sec-head', null, [UI.el('h2', { text: 'Umschlag' })]));
        body.appendChild(UI.chart([
          { data: hist.map(function (h) { return h.teu; }), color: '#4aa3ff', fill: 'rgba(74,163,255,.25)' },
        ], { height: 90 }));

        body.appendChild(UI.el('div.sec-head', null, [UI.el('h2', { text: 'Betrieb' })]));
        body.appendChild(UI.el('div.card', null, [
          UI.kv([
            ['Brückenleistung', Math.round(crane.rate) + ' Bew./h'],
            ['Fahrzeugleistung', Math.round(S.vehicleRate(st.s)) + ' Bew./h'],
            ['Gate', Math.round(S.gateRate(s)) + ' Lkw/h'],
            ['Bahn', Math.round(S.railRate(s)) + ' Boxen/h'],
            ['Strom', Math.round(power.demand) + ' von ' + Math.round(power.supply) + ' kW',
              power.ok ? 'g' : 'r'],
            ['Schiffe abgefertigt', U.num(s.stats.shipsDone)],
            ['Kranbewegungen', U.num(s.stats.moves)],
          ]),
        ]));

        body.appendChild(UI.el('div.sec-head', null, [UI.el('h2', { text: 'Yard' })]));
        var kinds = [
          ['normal', 'Standard'], ['reefer', 'Reefer'],
          ['hazmat', 'Gefahrgut'], ['empty', 'Leercontainer'],
        ];
        kinds.forEach(function (k) {
          var c = cap[k[0]], u = used[k[0]];
          body.appendChild(UI.el('div', { style: { margin: '8px 0' } }, [
            UI.el('div.row', { style: { justifyContent: 'space-between', fontSize: '13px' } }, [
              UI.el('span', { text: k[1] }),
              UI.el('span.num', { text: U.num(u) + ' / ' + U.num(c) }),
            ]),
            UI.bar(c ? u / c : 0, c && u / c > 0.9 ? 'red' : ''),
          ]));
        });

        body.appendChild(UI.el('div.sec-head', null, [UI.el('h2', { text: 'Buchhaltung gesamt' })]));
        var L = s.ledger;
        body.appendChild(UI.el('div.card', null, [
          UI.kv([
            ['Umschlagerlöse', U.euro(Math.round(L.tariff), true), 'g'],
            ['Lagergebühren', U.euro(Math.round(L.storage), true), 'g'],
            ['Lkw & Bahn', U.euro(Math.round(L.gate + L.rail), true), 'g'],
            ['Bunker & Boni', U.euro(Math.round(L.bunker + L.bonus), true), 'g'],
            ['Löhne', '−' + U.euro(Math.round(L.wages), true), 'r'],
            ['Strom & Diesel', '−' + U.euro(Math.round(L.power + L.diesel), true), 'r'],
            ['Unterhalt', '−' + U.euro(Math.round(L.upkeep), true), 'r'],
            ['Zinsen & Steuern', '−' + U.euro(Math.round(L.interest + L.tax), true), 'r'],
            ['Strafen', '−' + U.euro(Math.round(L.penalty), true), 'r'],
          ]),
        ]));

        body.appendChild(UI.el('div.sec-head', null, [UI.el('h2', { text: 'Ziele' })]));
        s.goals.forEach(function (g) {
          var def = null;
          for (var i = 0; i < D.GOALS.length; i++) if (D.GOALS[i].id === g.id) def = D.GOALS[i];
          if (!def) return;
          body.appendChild(UI.el('div.row', {
            style: { gap: '8px', fontSize: '13px', padding: '4px 0', opacity: g.done ? '.55' : '1' },
          }, [
            UI.el('span', { text: g.done ? '✓' : '○', style: { color: g.done ? 'var(--green)' : 'var(--dim)' } }),
            UI.el('span', { text: def.text, style: { flex: '1' } }),
            UI.el('span.num', { text: '+' + U.euro(def.reward, true) }),
          ]));
        });
      });
    }

    /* ---------------------------------------------------------- Auswahl */

    function openInspect(b) {
      var s = st.s;
      var def = D.byId(b.def);
      if (!def) return;
      var body = UI.el('div');
      body.appendChild(UI.el('p.small.muted', { text: def.desc }));
      var rows = [
        ['Größe', def.w + '×' + def.h + ' Felder'],
        ['Unterhalt', U.euro(def.upkeep) + ' pro Tag'],
      ];
      if (def.moves) rows.push(['Leistung', def.moves + ' Bewegungen/h']);
      if (def.slots) rows.push(['Stellplätze', U.num(def.slots)]);
      if (def.power) rows.push(['Strombedarf', def.power + ' kW']);
      if (def.supply) rows.push(['Stromabgabe', def.supply + ' kW']);
      if (b.down > 0) rows.push(['Zustand', 'außer Betrieb (' + Math.ceil(b.down) + ' h)', 'r']);
      body.appendChild(UI.kv(rows));

      host.modal({
        title: def.name,
        body: body,
        actions: [
          { label: 'Schließen', cls: 'ghost' },
          {
            label: 'Abreißen (+' + U.euro(Math.round(def.cost * 0.35), true) + ')', cls: 'bad',
            onClick: function () { abreissen(b, false); },
          },
        ],
      });
    }

    function openShip(ship) {
      var cls = D.shipClass(ship.cls);
      var body = UI.el('div');
      body.appendChild(UI.el('p.small.muted', { text: cls.desc }));
      body.appendChild(UI.kv([
        ['Reederei', S.lineName(ship.line)],
        ['Klasse', cls.name + ' · ' + U.num(cls.teu) + ' TEU'],
        ['Länge / Tiefgang', cls.len + ' m · ' + cls.draft + ' m'],
        ['Ladung an Bord', U.num(ship.teu) + ' TEU'],
        ['Zu laden', U.num(ship.toLoad) + ' TEU'],
        ['Tarif', U.euro(ship.tariff) + ' je TEU', 'gold'],
        ['Liegezeitfenster', Math.round(ship.window) + ' h'],
        ['Bisher am Kai', Math.round(ship.workT) + ' h',
          ship.workT > ship.window ? 'r' : ''],
      ]));
      body.appendChild(UI.el('div.sec-head', null, [UI.el('h2', { text: 'Manifest' })]));
      ship.manifest.forEach(function (m) {
        var cd = null;
        for (var i = 0; i < D.CARGO.length; i++) if (D.CARGO[i].id === m.kind) cd = D.CARGO[i];
        if (!cd || m.teu <= 0) return;
        body.appendChild(UI.el('div.row', {
          style: { justifyContent: 'space-between', fontSize: '13px', padding: '3px 0' },
        }, [
          UI.el('span', { text: cd.icon + '  ' + cd.name }),
          UI.el('span.num', { text: U.num(m.teu) + ' TEU · ' + cd.tariff.toFixed(2) + '×' }),
        ]));
      });
      host.modal({ title: ship.name, body: body });
    }

    /* ---------------------------------------------------------- Hinweise */

    function showHint(html) {
      hintEl.innerHTML = html;
      hintEl.style.display = '';
    }
    function hideHint() { hintEl.style.display = 'none'; }

    var shownAlerts = 0;
    function syncAlerts() {
      var s = st.s;
      if (!s) return;
      while (shownAlerts < s.alerts.length) {
        var a = s.alerts[shownAlerts++];
        (function (al) {
          var el = UI.el('div.alert.' + al.kind, null, [
            UI.el('div.ic', { text: al.icon }),
            UI.el('div.tx', { text: al.text }),
          ]);
          alertsEl.appendChild(el);
          if (al.kind === 'bad') host.sfx('alert');
          setTimeout(function () {
            el.style.transition = 'opacity .3s ease';
            el.style.opacity = '0';
            setTimeout(function () { UI.remove(el); }, 320);
          }, 6500);
        })(a);
        while (alertsEl.children.length > 5) alertsEl.removeChild(alertsEl.firstChild);
      }
    }

    /* ---------------------------------------------------------- Anleitung */

    function showTutorial(force) {
      SG.tutorial.show({
        id: 'port', force: force, parent: root, title: 'Hafen-Tycoon',
        onDone: function () { if (st.s) st.s.paused = false; syncSpeeds(); },
        pages: [
          {
            kicker: 'Hafen-Tycoon', title: 'Worum es geht',
            art: function (c, w, h) {
              var y = h * 0.62;
              c.fillStyle = '#123049';
              c.fillRect(0, 0, w, y);
              c.fillStyle = '#1c212c';
              c.fillRect(0, y, w, h - y);
              c.fillStyle = '#4b5361';
              c.fillRect(0, y, w, 4);
              // Schiff
              c.fillStyle = '#2b6db5';
              c.fillRect(w * 0.12, y - 26, w * 0.4, 20);
              var cols = ['#4aa3ff', '#3ddc84', '#f0b429', '#ff5f6b'];
              for (var i = 0; i < 16; i++) {
                c.fillStyle = cols[i % 4];
                c.fillRect(w * 0.13 + i * (w * 0.023), y - 32, w * 0.018, 5);
              }
              // Bruecke
              c.strokeStyle = '#f0b429';
              c.lineWidth = 3;
              c.beginPath();
              c.moveTo(w * 0.3, y); c.lineTo(w * 0.3, y - 52);
              c.moveTo(w * 0.42, y); c.lineTo(w * 0.42, y - 52);
              c.moveTo(w * 0.36, y - 52); c.lineTo(w * 0.1, y - 52);
              c.stroke();
              // Yard
              for (i = 0; i < 30; i++) {
                c.fillStyle = cols[i % 4];
                c.fillRect(w * 0.58 + (i % 10) * 9, y + 14 + Math.floor(i / 10) * 7, 7, 5);
              }
            },
            body: [
              { ic: '🚢', text: 'Schiffe kommen an, du fertigst sie ab. Jeder Container bringt Geld — <b>je schneller, desto mehr</b>.' },
              { ic: '⛓', text: 'Alles hängt an einer Kette: <b>Liegeplatz → Brücke → Fahrzeuge → Yard → Gate</b>. Der schwächste Punkt bremst alles.' },
              { ic: '🎯', text: 'Oben siehst du immer dein nächstes Ziel. Erfüllte Ziele bringen Geld.' },
            ],
          },
          {
            kicker: 'Erste Schritte', title: 'So kommst du in Gang',
            art: SG.tutorial.art.tap,
            body: [
              { ic: '1', text: 'Unten auf <b>Bauen</b> → <b>Kaimauer</b>. Sie kommt genau auf die Wasserkante. Vier Felder sind 100 m Liegeplatz.' },
              { ic: '2', text: 'Dann eine <b>Containerbrücke</b> auf die Kaimauer setzen — ohne Brücke wird nicht gelöscht.' },
              { ic: '3', text: 'Ein <b>Yard-Block</b> aufs Land. Ist das Yard voll, steht der Kai still.' },
              { ic: '4', text: 'Ein <b>Lkw-Gate</b>, damit die Container das Terminal wieder verlassen.' },
              { ic: '5', text: 'Unter <b>Flotte</b> ein paar Terminaltraktoren kaufen und unter <b>Personal</b> Leute einstellen.' },
            ],
          },
          {
            kicker: 'Bedienung', title: 'Karte und Knöpfe',
            art: SG.tutorial.art.pinch,
            body: [
              { ic: '👆', text: '<b>Ziehen</b> verschiebt die Karte, <b>zwei Finger</b> zoomen.' },
              { ic: '👉', text: 'Ein Gebäude oder Schiff antippen zeigt Einzelheiten — beim Gebäude auch den Abriss.' },
              { ic: '🧨', text: 'Zum Aufräumen gibt es unter <b>Bauen</b> den <b>Abrissmodus</b>: '
                + 'danach entfernt ein Tipp jedes Gebäude, 35 % kommen zurück.' },
              { ic: '⏩', text: 'Oben rechts stellst du die <b>Geschwindigkeit</b> ein: Pause, 1×, 2×, 4×.' },
              { ic: '📖', text: 'Diese Anleitung erreichst du jederzeit über den Knopf <b>Anleitung</b> oben.' },
            ],
          },
          {
            kicker: 'Worauf achten', title: 'Die häufigsten Stolpersteine',
            art: function (c, w, h) {
              var items = ['⚡', '👷', '▦', '🌊'];
              var labels = ['Strom', 'Personal', 'Yard voll', 'zu flach'];
              items.forEach(function (ic, i) {
                var x = w * (0.18 + i * 0.215);
                G.circle(c, x, h * 0.42, Math.min(26, w * 0.06), 'rgba(240,180,41,.15)');
                G.text(c, ic, x, h * 0.42, {
                  size: Math.min(26, w * 0.055), align: 'center', baseline: 'middle', color: '#fff',
                });
                G.text(c, labels[i], x, h * 0.72, {
                  size: 11, align: 'center', baseline: 'middle', color: '#8794b1',
                });
              });
            },
            body: [
              { ic: '⚡', text: 'Brücken und Kühlcontainer brauchen <b>Strom</b>. Fehlt er, arbeitet alles langsamer — baue ein Umspannwerk.' },
              { ic: '👷', text: 'Jedes Gerät braucht <b>Personal</b>. Unter „Personal" siehst du rot, wo Leute fehlen.' },
              { ic: '▦', text: 'Ist das <b>Yard voll</b>, kann kein Container mehr vom Schiff. Mehr Yard oder mehr Gate/Bahn.' },
              { ic: '🌊', text: 'Große Schiffe brauchen <b>Tiefgang</b>. Unter „Baggern" vertiefst du das Fahrwasser.' },
              { ic: '📜', text: '<b>Verträge</b> bringen mehr Schiffe und bessere Tarife — aber Strafe, wenn du sie nicht schaffst.' },
            ],
          },
        ],
      });
    }

    /* ---------------------------------------------------------- Zeichnen */

    function fitView() {
      var size = Rd.worldSize(st.s);
      vp.worldW = size.w;
      vp.worldH = size.h;
      vp.setView(stage.w, stage.h);
      vp.scale = U.clamp(stage.w / size.w, vp.min, vp.max);
      vp.centerOn(size.w / 2, st.s.waterRows * Rd.TILE + stage.h * 0.25 / vp.scale);
    }

    stage.onResize = function (w, h) {
      vp.setView(w, h);
    };

    function draw() {
      var s = st.s;
      ctx.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0);
      ctx.fillStyle = '#080b11';
      ctx.fillRect(0, 0, stage.w, stage.h);
      if (!s) return;

      Rd.draw({ ctx: ctx, vp: vp, s: s, ghost: st.ghost, selected: st.selected });

      // Ziel oben
      var goal = S.currentGoal(s);
      if (goal && !st.tool) {
        var txt = 'Ziel: ' + goal.text;
        ctx.save();
        var w = Math.min(stage.w - 24, ctx.measureText(txt).width + 300);
        G.fillRound(ctx, stage.w / 2 - w / 2, stage.h - 30, w, 24, 12, 'rgba(11,14,21,.85)');
        G.text(ctx, txt, stage.w / 2, stage.h - 18, {
          size: 12.5, weight: 600, color: '#c8d4ea', align: 'center', baseline: 'middle',
        });
        ctx.restore();
      }

      // Ereignisse links unten
      if (s.events.length) {
        var y = 10;
        s.events.forEach(function (ev) {
          var def = S.eventDef(ev.id);
          if (!def) return;
          G.fillRound(ctx, 10, y, 172, 22, 11, 'rgba(11,14,21,.88)');
          G.text(ctx, def.icon + ' ' + def.name, 18, y + 11, {
            size: 11.5, weight: 650, baseline: 'middle',
            color: def.kind === 'good' ? '#3ddc84' : def.kind === 'warn' ? '#f0b429' : '#ff5f6b',
          });
          G.progress(ctx, 18, y + 18, 156, 2, 1 - ev.left / ev.total, '#4aa3ff', 'rgba(255,255,255,.1)');
          y += 27;
        });
      }
    }

    function syncBar() {
      var s = st.s;
      if (!s) return;
      rCash.set(U.euro(Math.round(s.cash), true));
      rCash.tint(s.cash < 0 ? 'var(--red)' : '');

      var hist = s.stats.history;
      var flow = hist.length ? hist[hist.length - 1].profit : 0;
      rFlow.set((flow >= 0 ? '+' : '') + U.euro(flow, true));
      rFlow.tint(flow >= 0 ? 'var(--green)' : 'var(--red)');

      rTeu.set(U.short(s.stats.teu));
      var atBerth = 0, waiting = 0;
      s.ships.forEach(function (sh) {
        if (sh.state === 'laden' || sh.state === 'anlegen') atBerth++;
        else if (sh.state === 'warten') waiting++;
      });
      rShips.set(atBerth + (waiting ? ' (+' + waiting + ')' : ''));
      rLevel.set(String(s.level));
      rRep.set(Math.round(s.reputation) + '%');
      var d = U.gameDate(Math.floor(s.time / 24), 2026);
      rDate.set(U.dateShort(d) + ' · ' + String(Math.floor(s.time % 24)).padStart(2, '0') + ' Uhr');
    }

    /* ---------------------------------------------------------- Schleife */

    var acc = 0;
    var loop = host.loop({
      hz: 10,
      update: function (dt) {
        var s = st.s;
        if (!s) return;
        S.step(s, dt);
        syncAlerts();

        acc += dt;
        if (acc > 0.25) { acc = 0; syncBar(); }
      },
      render: draw,
      onPause: function () { },
    });

    /* ---------------------------------------------------------- Eingabe */

    var tmp = {};
    var panning = false;

    host.inputOn(stage.el, {
      ignore: false,
      onDown: function (p) {
        panning = false;
      },
      onMove: function (p) {
        if (Math.abs(p.dx) > 0.5 || Math.abs(p.dy) > 0.5) {
          panning = true;
          vp.pan(p.dx, p.dy);
        }
      },
      onPinch: function (e) {
        panning = true;
        vp.zoomAt(e.cx, e.cy, e.dScale);
        vp.pan(e.dcx, e.dcy);
      },
      onWheel: function (dy, x, y) {
        vp.zoomAt(x, y, dy > 0 ? 0.9 : 1.11);
      },
      onHover: function (x, y) {
        if (!st.tool || !st.s) return;
        updateGhost(x, y);
      },
      onTap: function (x, y) {
        if (!st.s || panning) return;
        var w = vp.toWorld(x, y, tmp);
        var tx = Math.floor(w.x / Rd.TILE);
        var ty = Math.floor(w.y / Rd.TILE);

        if (st.tool) {
          updateGhost(x, y);
          if (st.ghost) tryBuild(st.ghost.x, st.ghost.y);
          return;
        }

        // Schiff getroffen?
        for (var i = st.s.ships.length - 1; i >= 0; i--) {
          var r = Rd.shipRect(st.s, st.s.ships[i]);
          if (U.inRect(w.x, w.y, r.x, r.y - 8, r.w, r.h + 16)) {
            openShip(st.s.ships[i]);
            return;
          }
        }

        if (tx < 0 || ty < 0 || tx >= st.s.w || ty >= st.s.h) { st.selected = null; return; }
        var b = S.buildingAt(st.s, tx, ty);
        // Bruecken liegen auf der Kaizeile
        if (b && b.def === 'quay' && b.crane) {
          var cr = S.byId(st.s, b.crane);
          if (cr) b = cr;
        }
        if (b) {
          st.selected = b;
          if (st.abriss) { abreissen(b, true); return; }
          host.sfx('tick');
          openInspect(b);
        } else st.selected = null;
      },
    });

    function updateGhost(sx, sy) {
      var def = D.byId(st.tool);
      if (!def) { st.ghost = null; return; }
      var w = vp.toWorld(sx, sy, tmp);
      var tx = Math.floor(w.x / Rd.TILE - def.w / 2 + 0.5);
      var ty = def.kind === 'quay' || def.kind === 'crane'
        ? st.s.waterRows
        : Math.floor(w.y / Rd.TILE - def.h / 2 + 0.5);
      tx = U.clamp(tx, 0, st.s.w - def.w);
      ty = U.clamp(ty, 0, st.s.h - def.h);
      st.ghost = { id: st.tool, x: tx, y: ty, ok: !S.canPlace(st.s, def, tx, ty) };
    }

    var keys = host.keys({
      onDown: function (k) {
        if (k === 'escape') setTool(null);
        else if (k === 'space') { st.s.paused = !st.s.paused; syncSpeeds(); }
        else if (k === '1') { st.s.paused = false; st.s.speed = 1; syncSpeeds(); }
        else if (k === '2') { st.s.paused = false; st.s.speed = 2; syncSpeeds(); }
        else if (k === '3') { st.s.paused = false; st.s.speed = 4; syncSpeeds(); }
      },
    });

    /* ---------------------------------------------------------- Start */

    if (!load(st.slot)) {
      st.s = S.create(D.MAPS[0].id);
      fitView();
      showTutorial(false);
    } else {
      showTutorial(false);
    }
    syncSpeeds();
    syncBar();
    loop.start();

    /* Einmal deutlich sagen, wenn hier nichts liegen bleibt - ein Tycoon
       ohne Spielstand ist sonst eine boese Ueberraschung nach zwei Stunden. */
    if (SG.storage.volatile && !(SG.selftest && SG.selftest.active)) {
      var volT = setTimeout(function () {
        UI.toast('Dieses Gerät speichert nicht dauerhaft — der Hafen hält nur, '
          + 'solange das Fenster offen ist.', 'bad', 6500);
      }, 1400);
      host.onDestroy(function () { clearTimeout(volT); });
    }

    return {
      state: st,
      vp: vp,          // Ansichtsfenster - fuer Tests, die auf Felder zielen
      destroy: function () {
        keys.destroy();
        if (st.drawer) st.drawer.close();
        save(st.slot, true);
        stage.destroy();
      },
      selftest: function (steps) {
        // Frisches Terminal aufbauen und laufen lassen
        var s = S.create('nordhafen', 12345);
        st.s = s;

        // Balance-Probe: mit dem Startkapital muss der Mindestaufbau
        // bezahlbar sein, sonst kommt niemand ins Spiel hinein.
        var minCost = D.byId('quay').cost + D.byId('crane1').cost
          + D.byId('yard').cost + D.byId('gate').cost;
        if (s.cash < minCost) {
          throw new Error('Startkapital ' + Math.round(s.cash) + ' € reicht nicht für den '
            + 'Mindestaufbau (' + minCost + ' €)');
        }
        // Ohne eigenes Umspannwerk muss die erste Brücke trotzdem laufen
        if (S.power(s).supply < D.byId('crane1').power) {
          throw new Error('Ohne Umspannwerk steht die erste Brücke still');
        }

        S.takeLoan(s, 1500000);   // fuer den restlichen Ausbau im Test
        var err;
        err = S.place(s, 'quay', 4, s.waterRows);
        if (err) throw new Error('Kaimauer: ' + err);
        err = S.place(s, 'quay', 8, s.waterRows);
        if (err) throw new Error('Zweite Kaimauer: ' + err);
        err = S.place(s, 'crane1', 5, s.waterRows);
        if (err) throw new Error('Brücke: ' + err);
        err = S.place(s, 'yard', 4, s.waterRows + 3);
        if (err) throw new Error('Yard: ' + err);
        err = S.place(s, 'gate', 12, s.waterRows + 3);
        if (err) throw new Error('Gate: ' + err);
        err = S.place(s, 'power', 16, s.waterRows + 3);
        if (err) throw new Error('Umspannwerk: ' + err);
        if (S.place(s, 'yard', 4, s.waterRows + 3) === null) {
          throw new Error('Überlappendes Bauen wurde erlaubt');
        }
        if (S.place(s, 'quay', 4, s.waterRows + 5) === null) {
          throw new Error('Kaimauer an Land wurde erlaubt');
        }
        S.buyVehicle(s, 'truck', 4);
        S.hire(s, 'kran', 2);
        S.hire(s, 'yard', 4);

        var berths = S.berths(s);
        if (berths.length !== 1) throw new Error('Liegeplätze: ' + berths.length + ' statt 1');
        if (berths[0].meters !== 200) throw new Error('Liegeplatzlänge ' + berths[0].meters + ' m');
        if (!berths[0].cranes.length) throw new Error('Brücke nicht dem Liegeplatz zugeordnet');

        // Ein Schiff erzwingen und die Simulation laufen lassen
        S.spawnShip(s, U.rng(7), 'feeder');
        var guard = 0;
        while (s.stats.shipsDone < 1 && guard++ < 4000) {
          S.step(s, 0.1);
          if (!isFinite(s.cash)) throw new Error('Kontostand ungültig');
        }
        if (s.stats.shipsDone < 1) throw new Error('Kein Schiff abgefertigt');
        if (s.stats.teu <= 0) throw new Error('Kein Umschlag verbucht');
        if (s.ledger.tariff <= 0) throw new Error('Keine Erlöse gebucht');

        // Weiterlaufen lassen, damit Ereignisse und Tageswechsel greifen
        for (var i = 0; i < (steps || 600); i++) {
          S.step(s, 0.1);
        }
        if (s.stats.history.length < 1) throw new Error('Keine Tagesbilanz');

        // Speichern und Laden muessen den Stand erhalten
        var raw = JSON.parse(JSON.stringify(S.serialize(s)));
        var back = S.deserialize(raw);
        if (!back) throw new Error('Laden fehlgeschlagen');
        if (Math.round(back.cash) !== Math.round(s.cash)) throw new Error('Kontostand nach dem Laden anders');
        if (back.buildings.length !== s.buildings.length) throw new Error('Gebäude nach dem Laden anders');
        if (S.list(back, 'quay').length !== S.list(s, 'quay').length) {
          throw new Error('Kaimauern nach dem Laden anders');
        }

        // Abrissprobe
        var q = S.list(s, 'quay')[0];
        S.demolish(s, q);
        if (S.buildingAt(s, q.x, q.y)) throw new Error('Abriss hat das Feld nicht geräumt');

        fitView();
        draw();
        syncBar();
      },
    };
  }

  SG.register({
    id: 'porttycoon',
    name: 'Hafen-Tycoon',
    category: 'tycoon',
    credit: { icon: '⚓', text: 'Idee von Karl.' },
    desc: 'Containerterminal aufbauen und führen',
    tags: ['hafen', 'container', 'wirtschaft', 'aufbau', 'tycoon', 'schiffe'],
    heavy: true,
    scoreLabel: function (bests, stats) { return null; },
    preview: function (c, w, h) {
      var y = h * 0.55;
      c.fillStyle = G.linear(c, 0, 0, 0, y, [0, '#0a1c2e', 1, '#173f66']);
      c.fillRect(0, 0, w, y);
      c.fillStyle = '#1c212c';
      c.fillRect(0, y, w, h - y);
      c.fillStyle = '#4b5361';
      c.fillRect(0, y, w, 3);

      // Schiff
      c.fillStyle = '#2b6db5';
      c.beginPath();
      c.moveTo(w * 0.08, y - 26);
      c.lineTo(w * 0.5, y - 26);
      c.lineTo(w * 0.56, y - 16);
      c.lineTo(w * 0.5, y - 6);
      c.lineTo(w * 0.08, y - 6);
      c.closePath();
      c.fill();
      var cols = ['#4aa3ff', '#3ddc84', '#f0b429', '#ff5f6b', '#a97bff'];
      for (var i = 0; i < 18; i++) {
        c.fillStyle = cols[i % 5];
        c.fillRect(w * 0.09 + i * (w * 0.024), y - 32, w * 0.019, 5);
      }
      c.fillStyle = '#e9edf6';
      c.fillRect(w * 0.46, y - 36, 8, 10);

      // Containerbruecke
      c.strokeStyle = '#f0b429';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(w * 0.3, y); c.lineTo(w * 0.3, y - 48);
      c.moveTo(w * 0.42, y); c.lineTo(w * 0.42, y - 48);
      c.moveTo(w * 0.36, y - 48); c.lineTo(w * 0.06, y - 48);
      c.moveTo(w * 0.36, y - 48); c.lineTo(w * 0.5, y - 48);
      c.stroke();
      c.fillStyle = '#c8901c';
      c.fillRect(w * 0.34, y - 54, 10, 6);

      // Yard
      for (i = 0; i < 60; i++) {
        c.fillStyle = cols[i % 5];
        var bx = w * 0.06 + (i % 12) * (w * 0.055);
        var by = y + 12 + Math.floor(i / 12) * 7;
        if (by > h - 6) break;
        c.fillRect(bx, by, w * 0.045, 5);
        c.fillStyle = 'rgba(0,0,0,.28)';
        c.fillRect(bx, by + 5, w * 0.045, 1.4);
      }
    },
    mount: mount,
  });
})(SG);
