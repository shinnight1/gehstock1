/* ------------------------------------------------------------------
   Geheimagenten-Tycoon - Oberflaeche

   Zwei Ansichten (Weltkarte und Hauptquartier), Schubladen fuer
   Auftraege, Agenten, Bau, Labor, Gegner und Statistik - und der
   Einsatzbildschirm, auf dem die Mission Phase fuer Phase abläuft.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var G = SG.gfx;
  var UI = SG.ui;
  var A = SG.tycoon.spy;
  var D = A.data;
  var S = A.sim;
  var M = A.mission;
  var Rd = A.render;

  var SPEEDS = [0, 1, 2, 4];

  function mount(host) {
    var store = host.store;

    var st = {
      s: null,
      slot: store.get('slot', 1),
      view: 'map',            // map | hq
      tool: null,             // Raum im Baumodus
      ghost: null,
      selectedRoom: null,
      selectedRegion: null,
      drawer: null,
      lastSave: 0,          // Uhrzeit der letzten Sicherung (Date.now)
      saveWarned: false,
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

    var rCash = resItem('money', '€', 'Kasse');
    var rFlow = resItem('', '↕', 'Pro Tag');
    var rAgents = resItem('', '🕴', 'Agenten');
    var rMission = resItem('', '🎯', 'Einsätze');
    var rLevel = resItem('', '⭐', 'Level');
    var rRep = resItem('', '👍', 'Ansehen');
    var rDay = resItem('', '📅', 'Tag');
    [rCash, rFlow, rAgents, rMission, rLevel, rRep, rDay].forEach(function (e) { res.appendChild(e); });

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

    /* ---------------------------------------------------------- Leiste unten */

    function dockBtn(icon, label, onClick) {
      var b = UI.el('button.dockbtn', {
        on: { click: function () { host.sfx('click'); onClick(b); } },
      }, [UI.el('div.ic', { text: icon }), UI.el('div.lb', { text: label })]);
      dock.appendChild(b);
      return b;
    }

    var bView = dockBtn('🏢', 'Hauptquartier', function () { toggleView(); });
    dockBtn('🎯', 'Aufträge', function () { openMissions(); });
    dockBtn('🕴', 'Agenten', function () { openAgents(); });
    var bBuild = dockBtn('🏗', 'Bauen', function () { openBuild(); });
    dockBtn('🧪', 'Labor', function () { openLab(); });
    dockBtn('🕵', 'Gegner', function () { openEnemies(); });
    dockBtn('📊', 'Statistik', function () { openStats(); });
    var bStop = dockBtn('✖', 'Abbrechen', function () { setTool(null); });
    bStop.style.display = 'none';

    host.tool('📖 Anleitung', function () { showTutorial(true); });
    var bSave = host.tool('💾', function () { openSaves(); });

    host.beforeExit = function () {
      if (!st.s) return true;
      save(st.slot, true);
      if (!SG.settings.get('confirmExit')) return true;
      return host.confirm('Agentur verlassen?',
        'Der Stand wurde gerade gesichert.', 'Verlassen');
    };

    /* Letzter sicherer Moment: Seite geht in den Hintergrund oder wird
       geschlossen. Auf dem iPad kommt danach oft nichts mehr. */
    host.onLeave(function () { save(st.slot, true); });

    /* Autosave nach der Uhr, neben der Bildschleife - die pausiert, sobald
       das Fenster den Fokus verliert. */
    var autosaveT = setInterval(function () { save(st.slot, true); }, 20000);
    host.onDestroy(function () { clearInterval(autosaveT); });

    function toggleView() {
      st.view = st.view === 'map' ? 'hq' : 'map';
      bView.querySelector('.ic').textContent = st.view === 'map' ? '🏢' : '🌍';
      bView.querySelector('.lb').textContent = st.view === 'map' ? 'Hauptquartier' : 'Weltkarte';
      if (st.view === 'map') setTool(null);
      host.sfx('whoosh');
    }

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
        UI.toast('Die Agentur lässt sich hier nicht sichern — bitte über '
          + 'Einstellungen → Spielstand-Code sichern.', 'bad', 6000);
      }
      return ok;
    }

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
      syncSpeeds();
      return true;
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
                text: raw ? 'Tag ' + raw.day + ' · Level ' + raw.level + ' · ' +
                  U.euro(raw.cash || 0, true) + ' · ' + (raw.agents || []).length + ' Agenten'
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
        text: 'Automatisch gesichert wird alle 20 Sekunden in den aktuellen Platz, '
          + 'außerdem beim Verlassen und sobald das iPad die Seite in den Hintergrund '
          + 'schiebt. Zuletzt gespeichert: ' + sinceSave() + '.',
      }));
      if (SG.storage.volatile) {
        body.appendChild(UI.el('div.notice.warn', {
          style: { marginTop: '8px' },
          html: '<b>Dieses Gerät speichert nicht dauerhaft.</b> Die Agentur hält nur, '
            + 'solange das Fenster offen bleibt. Dauerhaft wird es über '
            + '<b>Zum Home-Bildschirm</b> — oder sichere den Fortschritt über '
            + '<b>Einstellungen → Spielstand-Code</b>.',
        }));
      }
      body.appendChild(UI.btn('Neue Agentur gründen', function () {
        m.close();
        host.confirm('Neu anfangen?', 'Der aktuelle Stand in Platz ' + st.slot + ' wird überschrieben.',
          'Neu starten', true).then(function (ok) {
            if (!ok) return;
            st.s = S.create();
            save(st.slot, true);
            showTutorial(true);
          });
      }, 'sm bad wide'));
      var m = host.modal({ title: 'Spielstände', body: body });
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

    /* ---------------------------------------------------------- Auftraege */

    function openMissions() {
      drawer('Aufträge', function (body, api) {
        var s = st.s;
        var e = S.effects(s);

        if (s.active.length) {
          body.appendChild(UI.el('div.sec-head', null, [UI.el('h2', { text: 'Läuft gerade' })]));
          s.active.forEach(function (run) {
            var type = D.missionType(run.mission.type);
            var ready = run.state !== 'anreise';
            body.appendChild(UI.el('div.item' + (ready ? '.tap' : ''), {
              on: {
                click: function () {
                  if (!ready) { UI.toast('Das Team ist noch auf der Anreise.'); return; }
                  api.close();
                  openMissionRun(run);
                },
              },
            }, [
              UI.el('div.thumb', { text: type.icon }),
              UI.el('div.main', null, [
                UI.el('div.t', { text: run.mission.title }),
                UI.el('div.d', {
                  text: ready ? 'Vor Ort — Einsatz kann beginnen'
                    : 'Anreise, noch ' + U.dur((run.arriveAt - s.time) * 24),
                }),
                UI.bar(ready ? 1 : U.clamp(1 - (run.arriveAt - s.time) /
                  Math.max(0.01, run.mission.travel / 24), 0, 1), ready ? 'green' : ''),
              ]),
              UI.el('div.side', null, [UI.el('div.s', { text: ready ? 'starten ›' : '' })]),
            ]));
          });
        }

        body.appendChild(UI.el('div.sec-head', null, [
          UI.el('h2', { text: 'Angebote' }),
          UI.el('span.count', { text: s.active.length + '/' + e.missionSlots + ' Einsatzplätze' }),
        ]));

        if (!s.missions.length) {
          body.appendChild(UI.el('p.small.muted', { text: 'Gerade liegt nichts vor. Alle zwei Tage kommen neue Aufträge.' }));
        }

        s.missions.forEach(function (m) {
          var type = D.missionType(m.type);
          var reg = D.regionById(m.region);
          var client = D.clientById(m.client);
          body.appendChild(UI.el('div.item.tap', {
            on: { click: function () { api.close(); openBriefing(m); } },
          }, [
            UI.el('div.thumb', { text: type.icon }),
            UI.el('div.main', null, [
              UI.el('div.t', { text: m.title }),
              UI.el('div.d', { text: type.name + ' · ' + reg.name + ' · ' + client.name }),
              UI.tags([
                { text: 'Stufe ' + m.diff, cls: m.diff > 6 ? 'r' : m.diff > 3 ? 'y' : 'g' },
                { text: type.team[0] + '–' + type.team[1] + ' Agenten' },
                { text: U.dur(m.travel) + ' Anreise' },
                m.enemy ? { text: M.enemyName(m.enemy), cls: 'r' } : null,
                { text: 'läuft ab an Tag ' + m.expires },
              ]),
            ]),
            UI.el('div.side', null, [
              UI.el('div.p', { text: m.fee ? U.euro(m.fee, true) : '—' }),
              UI.el('div.s', { text: 'Honorar' }),
            ]),
          ]));
        });
      });
    }

    /* ---------------------------------------------------------- Einsatzplanung */

    function openBriefing(mission) {
      var s = st.s;
      var type = D.missionType(mission.type);
      var reg = D.regionById(mission.region);
      var regState = null;
      for (var i = 0; i < s.regions.length; i++) if (s.regions[i].id === mission.region) regState = s.regions[i];
      var team = [];

      var body = UI.el('div');
      body.appendChild(UI.el('p.small.muted', { text: type.desc }));
      body.appendChild(UI.kv([
        ['Region', reg.name],
        ['Hitze vor Ort', Math.round(regState.heat) + ' %', regState.heat > 60 ? 'r' : ''],
        ['Auftraggeber', D.clientById(mission.client).name],
        ['Schwierigkeit', 'Stufe ' + mission.diff],
        ['Honorar', mission.fee ? U.euro(mission.fee) : 'kein Honorar', 'gold'],
        ['Anreise', U.dur(mission.travel)],
        mission.enemy ? ['Gegner', M.enemyName(mission.enemy), 'r'] : null,
      ]));

      body.appendChild(UI.el('div.sec-head', null, [UI.el('h2', { text: 'Phasen' })]));
      type.phases.forEach(function (ph) {
        body.appendChild(UI.el('div.row', {
          style: { justifyContent: 'space-between', fontSize: '13px', padding: '3px 0' },
        }, [
          UI.el('span', { text: D.skill(ph.skill).icon + '  ' + ph.name }),
          UI.el('span.small.muted', { text: D.skillName(ph.skill) + ' · Ziel ' + (ph.dc + mission.diff * 4) }),
        ]));
      });

      body.appendChild(UI.el('div.sec-head', null, [
        UI.el('h2', { text: 'Team' }),
        UI.el('span.count', { text: type.team[0] + ' bis ' + type.team[1] + ' Agenten' }),
      ]));

      var chanceEl = UI.el('div.card', { style: { marginBottom: '10px' } });
      body.appendChild(chanceEl);

      var listEl = UI.el('div');
      body.appendChild(listEl);

      function refresh() {
        UI.clear(chanceEl);
        var p = team.length ? S.estimate(s, mission, team) : 0;
        var briefing = S.effects(s).briefing > 0;
        UI.add(chanceEl, [
          UI.el('div.row', null, [
            UI.el('div', { style: { flex: '1' } }, [
              UI.el('b', { text: 'Erfolgsaussicht' }),
              UI.el('div.small.muted', {
                text: briefing ? 'Das Archiv liefert genaue Werte.'
                  : 'Ohne Archiv nur eine grobe Schätzung.',
              }),
            ]),
            UI.el('div', {
              style: { fontSize: '22px', fontWeight: '750',
                color: p > 0.7 ? 'var(--green)' : p > 0.45 ? 'var(--gold)' : 'var(--red)' },
              text: team.length ? (briefing ? Math.round(p * 100) + ' %'
                : (p > 0.75 ? 'gut' : p > 0.5 ? 'machbar' : p > 0.3 ? 'riskant' : 'schlecht')) : '—',
            }),
          ]),
          UI.bar(p, p > 0.7 ? 'green' : p > 0.45 ? '' : 'red'),
        ]);

        UI.clear(listEl);
        var pool = s.agents.slice();
        pool.sort(function (a, b) {
          return (a.status === 'bereit' ? 0 : 1) - (b.status === 'bereit' ? 0 : 1);
        });
        pool.forEach(function (a) {
          var inTeam = team.indexOf(a) >= 0;
          var free = a.status === 'bereit';
          var burned = a.covers[mission.region];
          listEl.appendChild(UI.el('div.item' + (free ? '.tap' : '.locked') + (inTeam ? '.sel' : ''), {
            on: {
              click: function () {
                if (!free) { UI.toast(a.code + ' ist ' + statusText(a) + '.', 'bad'); return; }
                if (inTeam) U.remove(team, a);
                else {
                  if (team.length >= type.team[1]) { UI.toast('Das Team ist voll.', 'bad'); return; }
                  team.push(a);
                }
                host.sfx('tick');
                refresh();
              },
            },
          }, [
            UI.el('div.thumb', { text: inTeam ? '✓' : '🕴' }),
            UI.el('div.main', null, [
              UI.el('div.t', null, [
                document.createTextNode(a.code),
                UI.el('span.tag', { text: 'Stufe ' + a.level }),
                burned ? UI.el('span.tag.r', { text: 'Tarnung verbrannt' }) : null,
              ]),
              UI.el('div.d', { text: a.name + ' · ' + statusText(a) }),
              UI.el('div.small.muted', {
                text: type.phases.map(function (ph) {
                  return D.skill(ph.skill).icon + ' ' + S.skillValue(s, a, ph.skill);
                }).join('   '),
              }),
              a.stress > 40 || a.injury > 0 ? UI.tags([
                a.stress > 40 ? { text: 'Stress ' + Math.round(a.stress), cls: 'y' } : null,
                a.injury > 0 ? { text: 'verletzt ' + Math.round(a.injury), cls: 'r' } : null,
              ]) : null,
            ]),
          ]));
        });
      }
      refresh();

      var m = host.modal({
        title: mission.title, body: body, wide: true,
        actions: [
          { label: 'Später', cls: 'ghost' },
          {
            label: 'Einsatz starten', cls: 'primary',
            keepOpen: true,
            onClick: function () {
              var err = S.startMission(s, mission, team);
              if (err) { UI.toast(err, 'bad', 2600); return; }
              m.close();
              host.sfx('power');
              UI.toast('Team ist unterwegs.', 'good');
            },
          },
        ],
      });
    }

    function statusText(a) {
      return {
        bereit: 'einsatzbereit', einsatz: 'im Einsatz', verletzt: 'verletzt',
        training: 'im Training', gefangen: 'gefangen',
      }[a.status] || a.status;
    }

    /* ---------------------------------------------------------- Einsatz */

    function openMissionRun(run) {
      var s = st.s;
      s.paused = true;
      syncSpeeds();
      var type = D.missionType(run.mission.type);

      var logBox = UI.el('div.logbox');
      var phasesEl = UI.el('div');
      var actionEl = UI.el('div');

      var body = UI.el('div', null, [
        UI.el('p.small.muted', { text: type.desc }),
        phasesEl,
        UI.el('div.sec-head', null, [UI.el('h2', { text: 'Protokoll' })]),
        logBox,
        actionEl,
      ]);

      var m = host.modal({
        title: run.mission.title, body: body, wide: true, closable: false,
      });

      function renderPhases() {
        UI.clear(phasesEl);
        type.phases.forEach(function (ph, i) {
          var done = i < run.results.length;
          var ok = run.results[i];
          var now = i === run.phase && run.state !== 'fertig';
          var chance = now ? M.phaseChance(s, run, i) : null;
          phasesEl.appendChild(UI.el('div.phase' + (done ? (ok ? '.done' : '.fail') : (now ? '.now' : '')), null, [
            UI.el('div.st', { text: done ? (ok ? '✓' : '✕') : (now ? '▶' : '·') }),
            UI.el('div.nm', { text: D.skill(ph.skill).icon + ' ' + ph.name }),
            UI.el('div.ch', {
              text: now ? Math.round(chance * 100) + ' %' : (done ? '' : D.skillName(ph.skill)),
            }),
          ]));
        });
      }

      function renderLog() {
        UI.clear(logBox);
        run.log.forEach(function (l) {
          logBox.appendChild(UI.el('div.logline.' + l.kind, null, [UI.el('div', { text: l.text })]));
        });
        logBox.scrollTop = logBox.scrollHeight;
      }

      function renderActions() {
        UI.clear(actionEl);
        if (run.state === 'fertig') {
          var sum = run.summary;
          actionEl.appendChild(UI.el('div.card', { style: { marginTop: '12px' } }, [
            UI.el('b', {
              text: sum.gradeName,
              style: {
                color: sum.grade === 'fehl' ? 'var(--red)'
                  : sum.grade === 'teil' ? 'var(--gold)' : 'var(--green)',
                fontSize: '17px',
              },
            }),
            UI.kv([
              ['Phasen geschafft', (sum.total - sum.fails) + ' von ' + sum.total],
              ['Honorar', sum.fee ? U.euro(sum.fee) : 'keines', sum.fee ? 'g' : 'r'],
              ['Erfahrung', '+' + sum.xp + ' je Agent'],
              ['Hitze in der Region', '+' + Math.round(sum.heat), 'r'],
            ]),
          ]));
          actionEl.appendChild(UI.btn('Bericht schließen', function () {
            m.close();
            s.paused = false;
            syncSpeeds();
          }, 'primary wide'));
          return;
        }

        if (run.choicePending) {
          var ch = run.choicePending;
          actionEl.appendChild(UI.el('div.card', { style: { marginTop: '12px' } }, [
            UI.el('b', { text: 'Entscheidung' }),
            UI.el('p.small', { text: ch.text, style: { marginTop: '4px' } }),
          ]));
          ch.options.forEach(function (opt, i) {
            actionEl.appendChild(UI.btn(
              opt.text + (opt.skill ? '  (' + D.skillName(opt.skill) + ')' : '') +
              (opt.cost ? '  · ' + U.euro(opt.cost, true) : ''),
              function () {
                M.applyChoice(s, run, i);
                host.sfx('click');
                renderPhases(); renderLog(); renderActions();
              }, 'sm wide'));
          });
          return;
        }

        actionEl.appendChild(UI.btn('Nächste Phase', function () {
          var r = M.step(s, run);
          host.sfx(r && r.kind === 'phase' ? (r.ok ? 'blip' : 'error') : 'click');
          if (r && r.kind === 'phase') host.buzz(r.ok ? 12 : 30);
          renderPhases(); renderLog(); renderActions();
        }, 'primary wide'));

        actionEl.appendChild(UI.btn('Alles durchlaufen lassen', function () {
          var guard = 0;
          while (run.state !== 'fertig' && !run.choicePending && guard++ < 20) {
            M.step(s, run);
          }
          renderPhases(); renderLog(); renderActions();
        }, 'sm ghost wide'));
      }

      renderPhases(); renderLog(); renderActions();
    }

    /* ---------------------------------------------------------- Agenten */

    function openAgents() {
      drawer('Agenten', function (body, api) {
        var s = st.s;
        var e = S.effects(s);

        body.appendChild(UI.el('div.sec-head', null, [
          UI.el('h2', { text: 'Im Dienst' }),
          UI.el('span.count', { text: s.agents.length + ' von ' + (4 + s.level) }),
        ]));

        s.agents.forEach(function (a) {
          var box = UI.el('div.item.tap', {
            on: { click: function () { api.close(); openAgent(a); } },
          }, [
            UI.el('div.thumb', { text: a.status === 'gefangen' ? '⛓' : '🕴' }),
            UI.el('div.main', null, [
              UI.el('div.t', null, [
                document.createTextNode(a.code),
                UI.el('span.tag', { text: 'Stufe ' + a.level }),
              ]),
              UI.el('div.d', { text: a.name + ' · ' + statusText(a) + ' · ' + U.euro(a.salary) + '/Tag' }),
              UI.tags(a.traits.map(function (t) {
                var td = D.traitById(t);
                return td ? { text: td.icon + ' ' + td.name, cls: td.good ? 'g' : 'r' } : null;
              })),
              a.stress > 30 || a.injury > 0 ? UI.tags([
                a.stress > 30 ? { text: 'Stress ' + Math.round(a.stress), cls: 'y' } : null,
                a.injury > 0 ? { text: 'Verletzung ' + Math.round(a.injury), cls: 'r' } : null,
              ]) : null,
            ]),
          ]);
          body.appendChild(box);
        });

        body.appendChild(UI.el('div.sec-head', null, [
          UI.el('h2', { text: 'Bewerber' }),
          UI.el('span.count', { text: U.euro(D.ECON.recruitCost, true) + ' je Einstellung' }),
        ]));
        if (!S.hasRoom(s, 'rekrut')) {
          body.appendChild(UI.el('p.small.muted', {
            text: 'Mit einem Rekrutierungsbüro werden es mehr und bessere Bewerber.',
          }));
        }
        s.recruits.forEach(function (a) {
          body.appendChild(UI.el('div.item.tap', {
            on: {
              click: function () {
                var err = S.hire(s, a.id);
                if (err) { UI.toast(err, 'bad'); return; }
                host.sfx('cash');
                UI.toast(a.code + ' ist an Bord.', 'good');
                api.close();
                openAgents();
              },
            },
          }, [
            UI.el('div.thumb', { text: '👤' }),
            UI.el('div.main', null, [
              UI.el('div.t', { text: a.code }),
              UI.el('div.d', { text: a.name + ' · ' + U.euro(a.salary) + '/Tag' }),
              UI.el('div.small.muted', {
                text: D.SKILLS.map(function (sk) {
                  return sk.icon + ' ' + a.skills[sk.id];
                }).join('  '),
              }),
              UI.tags(a.traits.map(function (t) {
                var td = D.traitById(t);
                return td && !td.hidden ? { text: td.icon + ' ' + td.name, cls: td.good ? 'g' : 'r' } : null;
              })),
            ]),
            UI.el('div.side', null, [UI.el('div.s', { text: 'einstellen ›' })]),
          ]));
        });
      });
    }

    function openAgent(a) {
      var s = st.s;
      var body = UI.el('div');

      var cv = UI.el('canvas', { style: { width: '100%', height: '96px' } });
      body.appendChild(cv);
      setTimeout(function () {
        var r = cv.getBoundingClientRect();
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        cv.width = r.width * dpr; cv.height = 96 * dpr;
        var c = cv.getContext('2d');
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        c.clearRect(0, 0, r.width, 96);
        Rd.skillBars(c, s, a, 4, 2, r.width - 8);
      }, 30);

      body.appendChild(UI.kv([
        ['Klarname', a.name],
        ['Stufe', String(a.level) + '  (' + a.xp + '/' + (a.level * 220) + ' XP)'],
        ['Status', statusText(a)],
        ['Gehalt', U.euro(a.salary) + ' pro Tag'],
        ['Loyalität', Math.round(a.loyalty) + ' %', a.loyalty < 30 ? 'r' : 'g'],
        ['Stress', Math.round(a.stress) + ' %', a.stress > 60 ? 'r' : ''],
        ['Verletzung', Math.round(a.injury) + ' %', a.injury > 0 ? 'r' : ''],
        ['Einsätze', String(a.missions)],
      ]));

      var burned = Object.keys(a.covers);
      if (burned.length) {
        body.appendChild(UI.el('div.sec-head', null, [UI.el('h2', { text: 'Verbrannte Tarnung' })]));
        body.appendChild(UI.tags(burned.map(function (r) {
          return { text: D.regionById(r).name, cls: 'r' };
        })));
      }

      body.appendChild(UI.el('div.sec-head', null, [UI.el('h2', { text: 'Ausrüstung' })]));
      [0, 1].forEach(function (slot) {
        var cur = a.gear[slot];
        var g = cur ? D.gadgetById(cur) : null;
        body.appendChild(UI.el('div.item.tap', {
          on: { click: function () { m.close(); pickGadget(a, slot); } },
        }, [
          UI.el('div.thumb', { text: g ? g.icon : '＋' }),
          UI.el('div.main', null, [
            UI.el('div.t', { text: g ? g.name : 'Platz ' + (slot + 1) + ' frei' }),
            UI.el('div.d', { text: g ? g.desc : 'Antippen zum Ausrüsten' }),
          ]),
        ]));
      });

      if (S.hasRoom(s, 'training') && a.status === 'bereit') {
        body.appendChild(UI.el('div.sec-head', null, [UI.el('h2', { text: 'Training' })]));
        body.appendChild(UI.el('p.small.muted', {
          text: U.euro(D.ECON.trainCost) + ' und zwei Tage je Einheit.',
        }));
        var row = UI.el('div.row.wrap', { style: { gap: '6px' } });
        D.SKILLS.forEach(function (sk) {
          row.appendChild(UI.btn(sk.icon + ' ' + sk.name, function () {
            var err = S.train(s, a, sk.id);
            if (err) UI.toast(err, 'bad');
            else { host.sfx('power'); UI.toast(a.code + ' trainiert ' + sk.name + '.', 'good'); m.close(); }
          }, 'sm ghost'));
        });
        body.appendChild(row);
      }

      var m = host.modal({
        title: a.code, body: body, wide: true,
        actions: [
          { label: 'Schließen', cls: 'ghost' },
          {
            label: 'Entlassen', cls: 'bad',
            onClick: function () {
              host.confirm('Entlassen?', a.code + ' verlässt die Agentur.', 'Entlassen', true)
                .then(function (ok) { if (ok) { S.fire(s, a); host.sfx('thud'); } });
            },
          },
        ],
      });
    }

    function pickGadget(agent, slot) {
      var s = st.s;
      var body = UI.el('div');
      body.appendChild(UI.el('div.item.tap', {
        on: {
          click: function () {
            S.equip(s, agent, slot, null);
            m.close();
            openAgent(agent);
          },
        },
      }, [
        UI.el('div.thumb', { text: '✖' }),
        UI.el('div.main', null, [UI.el('div.t', { text: 'Nichts ausrüsten' })]),
      ]));
      var any = false;
      for (var id in s.gadgets) {
        (function (gid) {
          var g = D.gadgetById(gid);
          if (!g || !s.gadgets[gid]) return;
          any = true;
          body.appendChild(UI.el('div.item.tap', {
            on: {
              click: function () {
                var err = S.equip(s, agent, slot, gid);
                if (err) { UI.toast(err, 'bad'); return; }
                host.sfx('tick');
                m.close();
                openAgent(agent);
              },
            },
          }, [
            UI.el('div.thumb', { text: g.icon }),
            UI.el('div.main', null, [
              UI.el('div.t', null, [
                document.createTextNode(g.name),
                UI.el('span.tag', { text: s.gadgets[gid] + '×' }),
              ]),
              UI.el('div.d', { text: g.desc }),
            ]),
          ]));
        })(id);
      }
      if (!any) {
        body.appendChild(UI.el('p.small.muted', {
          text: 'Keine Gadgets im Lager. Im Labor forschen und in der Werkstatt bauen — oder auf dem Schwarzmarkt kaufen.',
        }));
      }
      var m = host.modal({ title: 'Ausrüstung wählen', body: body });
    }

    /* ---------------------------------------------------------- Bauen */

    function setTool(id) {
      st.tool = id;
      st.ghost = null;
      bBuild.classList.toggle('on', !!id);
      bStop.style.display = id ? '' : 'none';
      if (id) {
        if (st.view !== 'hq') toggleView();
        var def = D.roomById(id);
        hintEl.innerHTML = '<b>' + def.name + '</b> setzen — Feld antippen, ✖ beendet den Baumodus.';
        hintEl.style.display = '';
      } else hintEl.style.display = 'none';
    }

    function openBuild() {
      var s = st.s;
      var body = UI.el('div');
      D.ROOMS.forEach(function (def) {
        if (def.unique && S.hasRoom(s, def.id)) return;
        var poor = s.cash < def.cost;
        var have = S.countRoom(s, def.id);
        body.appendChild(UI.el('div.item.tap', {
          on: {
            click: function () {
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
              { text: U.euro(def.upkeep) + '/Tag' },
            ]),
          ]),
          UI.el('div.side', null, [
            UI.el('div.p', {
              text: U.euro(def.cost, true),
              style: { color: poor ? 'var(--red)' : '' },
            }),
          ]),
        ]));
      });
      var m = host.modal({ title: 'Hauptquartier ausbauen', body: body, wide: true });
    }

    /* ---------------------------------------------------------- Labor */

    function openLab() {
      drawer('Labor & Werkstatt', function (body, api) {
        var s = st.s;

        if (s.research) {
          var t = D.techById(s.research.id);
          body.appendChild(UI.el('div.card', null, [
            UI.el('b', { text: 'Läuft: ' + t.name }),
            UI.el('div.small.muted', { text: 'Noch ' + Math.ceil(s.research.daysLeft) + ' Tage' }),
            UI.bar(1 - s.research.daysLeft / s.research.total),
          ]));
        } else if (!S.hasRoom(s, 'labor')) {
          body.appendChild(UI.el('div.notice.warn', { text: 'Ohne Labor lässt sich nichts erforschen.' }));
        }

        body.appendChild(UI.el('div.sec-head', null, [UI.el('h2', { text: 'Forschung' })]));
        D.TECH.forEach(function (t) {
          var done = s.tech.indexOf(t.id) >= 0;
          var missing = t.needs.filter(function (n) { return s.tech.indexOf(n) < 0; });
          body.appendChild(UI.el('div.item' + (done ? '' : (missing.length ? '.locked' : '.tap')), {
            on: {
              click: function () {
                if (done || missing.length) return;
                var err = S.startResearch(s, t.id);
                if (err) UI.toast(err, 'bad');
                else { host.sfx('power'); api.close(); openLab(); }
              },
            },
          }, [
            UI.el('div.thumb', { text: done ? '✓' : t.icon }),
            UI.el('div.main', null, [
              UI.el('div.t', { text: t.name }),
              UI.el('div.d', { text: t.desc }),
              UI.tags([
                { text: t.days + ' Tage' },
                missing.length ? {
                  text: 'braucht ' + missing.map(function (n) { return D.techById(n).name; }).join(', '),
                  cls: 'r',
                } : null,
              ]),
            ]),
            UI.el('div.side', null, [UI.el('div.p', { text: done ? '—' : U.euro(t.cost, true) })]),
          ]));
        });

        body.appendChild(UI.el('div.sec-head', null, [UI.el('h2', { text: 'Gadgets' })]));
        if (!S.hasRoom(s, 'werkstatt')) {
          body.appendChild(UI.el('p.small.muted', {
            text: 'Ohne Werkstatt geht nur der Schwarzmarkt — teurer und macht Hitze.',
          }));
        }
        D.GADGETS.forEach(function (g) {
          var have = s.gadgets[g.id] || 0;
          var researched = !g.tech || s.tech.indexOf(g.tech) >= 0;
          var canCraft = researched && S.hasRoom(s, 'werkstatt');
          body.appendChild(UI.el('div.item', null, [
            UI.el('div.thumb', { text: g.icon }),
            UI.el('div.main', null, [
              UI.el('div.t', null, [
                document.createTextNode(g.name),
                have ? UI.el('span.tag.g', { text: have + '×' }) : null,
              ]),
              UI.el('div.d', { text: g.desc }),
              UI.tags([
                { text: g.uses + ' Einsätze' },
                !researched ? { text: 'nicht erforscht', cls: 'r' } : null,
              ]),
            ]),
            UI.el('div.side', { style: { display: 'flex', flexDirection: 'column', gap: '5px' } }, [
              UI.btn(U.euro(g.cost, true), function () {
                var err = S.buyGadget(s, g.id, false);
                if (err) UI.toast(err, 'bad', 2400);
                else { host.sfx('build'); api.close(); openLab(); }
              }, 'sm' + (canCraft ? ' primary' : ' ghost')),
              UI.btn('SM ' + U.euro(g.cost * D.ECON.marketMul, true), function () {
                var err = S.buyGadget(s, g.id, true);
                if (err) UI.toast(err, 'bad', 2400);
                else { host.sfx('cash'); UI.toast('Auf dem Schwarzmarkt gekauft — das fällt auf.', 'bad'); api.close(); openLab(); }
              }, 'sm ghost'),
            ]),
          ]));
        });
      });
    }

    /* ---------------------------------------------------------- Gegner */

    function openEnemies() {
      drawer('Gegenspieler', function (body) {
        var s = st.s;
        D.ENEMIES.forEach(function (def) {
          var en = null;
          for (var i = 0; i < s.enemies.length; i++) if (s.enemies[i].id === def.id) en = s.enemies[i];
          if (!en) return;
          body.appendChild(UI.el('div.card', { style: { marginBottom: '10px' } }, [
            UI.el('div.row', null, [
              UI.el('div.thumb', { text: def.icon }),
              UI.el('div', { style: { flex: '1' } }, [
                UI.el('b', { text: def.name }),
                UI.el('div.small.muted', { text: def.desc }),
              ]),
            ]),
            UI.el('div.small.muted', { style: { marginTop: '8px' }, text: 'Einfluss' }),
            UI.bar(en.power / 100, en.power > 60 ? 'red' : en.power > 30 ? '' : 'green'),
            UI.kv([
              ['Einfluss', Math.round(en.power) + ' %', en.power <= 0 ? 'g' : 'r'],
              ['Aufgeklärt', Math.round(en.known) + ' %'],
              ['Maulwurf-Risiko', Math.round(en.moleRisk) + ' %', en.moleRisk > 20 ? 'r' : ''],
            ]),
          ]));
        });

        body.appendChild(UI.el('div.sec-head', null, [UI.el('h2', { text: 'Regionen' })]));
        s.regions.forEach(function (r) {
          var def = D.regionById(r.id);
          if (!r.unlocked) return;
          body.appendChild(UI.el('div.item', null, [
            UI.el('div.thumb', { text: '📍' }),
            UI.el('div.main', null, [
              UI.el('div.t', { text: def.name }),
              UI.el('div.small.muted', { text: 'Hitze ' + Math.round(r.heat) + ' % · Einfluss ' + Math.round(r.influence) + ' %' }),
              UI.bar(r.heat / 100, r.heat > 60 ? 'red' : ''),
            ]),
            UI.el('div.side', null, [
              r.heat > 5 ? UI.btn('Bestechen ' + U.euro(S.bribeCost(st.s, r), true), function () {
                var err = S.bribe(st.s, r.id);
                if (err) UI.toast(err, 'bad');
                else { host.sfx('cash'); UI.toast('Die Wogen sind geglättet.', 'good'); }
                if (st.drawer) st.drawer.close();
                openEnemies();
              }, 'sm ghost') : null,
            ]),
          ]));
        });
      });
    }

    /* ---------------------------------------------------------- Statistik */

    function openStats() {
      drawer('Statistik', function (body) {
        var s = st.s;
        var hist = s.stats.history.slice(-60);

        body.appendChild(UI.el('div.sec-head', null, [UI.el('h2', { text: 'Tagesgewinn' })]));
        body.appendChild(UI.chart([
          { data: hist.map(function (h) { return h.profit; }), color: '#3ddc84', fill: 'rgba(61,220,132,.25)' },
        ], { zero: true, height: 110 }));

        body.appendChild(UI.el('div.sec-head', null, [UI.el('h2', { text: 'Einsätze' })]));
        body.appendChild(UI.el('div.card', null, [
          UI.kv([
            ['Erfolgreich', String(s.stats.won), 'g'],
            ['Gescheitert', String(s.stats.lost), 'r'],
            ['Quote', s.stats.missions ? U.pct(s.stats.won / s.stats.missions) : '—'],
            ['Agentur-Erfahrung', U.num(s.xp)],
            ['Nächste Stufe bei', U.num(D.nextLevelXp(s.level))],
          ]),
        ]));

        body.appendChild(UI.el('div.sec-head', null, [UI.el('h2', { text: 'Kasse' })]));
        var L = s.ledger;
        body.appendChild(UI.el('div.card', null, [
          UI.kv([
            ['Honorare', U.euro(Math.round(L.fees), true), 'g'],
            ['Tarnfirma', U.euro(Math.round(L.business), true), 'g'],
            ['Gehälter', '−' + U.euro(Math.round(L.salaries), true), 'r'],
            ['Unterhalt', '−' + U.euro(Math.round(L.upkeep), true), 'r'],
            ['Forschung & Gadgets', '−' + U.euro(Math.round(L.research + L.gadgets), true), 'r'],
            ['Bestechung', '−' + U.euro(Math.round(L.bribes), true), 'r'],
            ['Strafen & Abgaben', '−' + U.euro(Math.round(L.penalties + L.tax), true), 'r'],
          ]),
        ]));

        body.appendChild(UI.el('div.sec-head', null, [UI.el('h2', { text: 'Kampagne' })]));
        s.story.forEach(function (g) {
          var def = null;
          for (var i = 0; i < D.STORY.length; i++) if (D.STORY[i].id === g.id) def = D.STORY[i];
          if (!def) return;
          body.appendChild(UI.el('div.row', {
            style: { gap: '8px', fontSize: '13px', padding: '4px 0', opacity: g.done ? '.55' : '1' },
          }, [
            UI.el('span', { text: g.done ? '✓' : '○', style: { color: g.done ? 'var(--green)' : 'var(--dim)' } }),
            UI.el('span', { text: def.title + ': ' + def.text, style: { flex: '1' } }),
            UI.el('span.num', { text: '+' + U.euro(def.reward, true) }),
          ]));
        });

        body.appendChild(UI.el('div.sec-head', null, [UI.el('h2', { text: 'Meldungen' })]));
        var box = UI.el('div.logbox');
        s.alerts.slice().reverse().slice(0, 40).forEach(function (a) {
          box.appendChild(UI.el('div.logline.' +
            (a.kind === 'good' ? 'ok' : a.kind === 'bad' ? 'no' : 'hi'), null, [
            UI.el('div.tm', { text: 'T' + a.day }),
            UI.el('div', { text: a.icon + ' ' + a.text }),
          ]));
        });
        body.appendChild(box);
      });
    }

    /* ---------------------------------------------------------- Anleitung */

    function showTutorial(force) {
      SG.tutorial.show({
        id: 'spy', force: force, parent: root, title: 'Geheimagenten-Tycoon',
        onDone: function () { if (st.s) st.s.paused = false; syncSpeeds(); },
        pages: [
          {
            kicker: 'Geheimagenten-Tycoon', title: 'Du führst die Agentur',
            art: function (c, w, h) {
              c.fillStyle = '#0a1424';
              c.fillRect(0, 0, w, h);
              var pts = [[0.2, 0.35], [0.45, 0.3], [0.62, 0.45], [0.78, 0.35], [0.5, 0.65]];
              c.strokeStyle = 'rgba(74,163,255,.25)';
              c.lineWidth = 1;
              pts.forEach(function (a, i) {
                pts.forEach(function (b, k) {
                  if (k <= i) return;
                  c.beginPath();
                  c.moveTo(a[0] * w, a[1] * h);
                  c.lineTo(b[0] * w, b[1] * h);
                  c.stroke();
                });
              });
              pts.forEach(function (p, i) {
                G.circle(c, p[0] * w, p[1] * h, i === 1 ? 9 : 6, i === 1 ? '#ffd166' : '#4aa3ff');
              });
              G.text(c, 'Hauptquartier', pts[1][0] * w, pts[1][1] * h - 18, {
                size: 10, color: '#ffd166', align: 'center',
              });
            },
            body: [
              { ic: '🎯', text: 'Du nimmst <b>Aufträge</b> an, stellst ein Team zusammen und schickst es los.' },
              { ic: '🕴', text: 'Agenten haben sechs <b>Fähigkeiten</b>. Für jede Missionsphase zählt eine andere.' },
              { ic: '🏢', text: 'Im <b>Hauptquartier</b> baust du Räume, die alles besser machen: Labor, Trainingsraum, Werkstatt und mehr.' },
            ],
          },
          {
            kicker: 'Einsatz', title: 'So läuft eine Mission',
            art: function (c, w, h) {
              var names = ['Anmarsch', 'Schloss', 'Alarm', 'Flucht'];
              var st2 = ['✓', '✓', '✕', '▶'];
              var cols = ['#3ddc84', '#3ddc84', '#ff5f6b', '#f0b429'];
              names.forEach(function (n, i) {
                var y = 18 + i * 34;
                G.fillRound(c, w * 0.12, y, w * 0.76, 26, 6, 'rgba(33,42,61,.8)');
                G.text(c, st2[i], w * 0.17, y + 13, {
                  size: 13, color: cols[i], align: 'center', baseline: 'middle',
                });
                G.text(c, n, w * 0.23, y + 13, {
                  size: 12, color: '#c8d4ea', baseline: 'middle',
                });
                if (i === 3) {
                  G.text(c, '68 %', w * 0.82, y + 13, {
                    size: 12, weight: 700, color: '#f0b429', align: 'right', baseline: 'middle',
                  });
                }
              });
            },
            body: [
              { ic: '1', text: 'Jede Mission hat vier <b>Phasen</b>. Vor jeder steht die Erfolgsaussicht auf dem Schirm.' },
              { ic: '2', text: 'Es zählt immer der <b>beste Agent im Team</b> für die jeweilige Fähigkeit — ein großes Team hilft zusätzlich.' },
              { ic: '3', text: 'Zwischendurch gibt es <b>Entscheidungen</b>: leise vorgehen, hacken, bestechen. Jede hat Folgen für Erfolg und Hitze.' },
              { ic: '4', text: 'Alle vier geschafft heißt <b>voller Erfolg</b>. Ab drei Fehlschlägen ist die Mission gescheitert — und ein Agent kann gefangen werden.' },
            ],
          },
          {
            kicker: 'Gefahren', title: 'Hitze, Stress und Maulwürfe',
            art: function (c, w, h) {
              var items = ['🔥', '😰', '🕵', '⛓'];
              var labels = ['Hitze', 'Stress', 'Maulwurf', 'Gefangen'];
              items.forEach(function (ic, i) {
                var x = w * (0.18 + i * 0.215);
                G.circle(c, x, h * 0.42, Math.min(26, w * 0.06), 'rgba(255,95,107,.15)');
                G.text(c, ic, x, h * 0.42, {
                  size: Math.min(24, w * 0.05), align: 'center', baseline: 'middle', color: '#fff',
                });
                G.text(c, labels[i], x, h * 0.72, {
                  size: 11, align: 'center', baseline: 'middle', color: '#8794b1',
                });
              });
            },
            body: [
              { ic: '🔥', text: 'Jeder Einsatz erhöht die <b>Hitze</b> in der Region. Zu viel davon bringt Ermittlungen und Strafen. Eine Tarnfirma und Bestechung helfen.' },
              { ic: '😰', text: '<b>Stress</b> und <b>Verletzungen</b> senken die Werte. Kantine und Krankenstation bringen die Leute schneller zurück.' },
              { ic: '🕵', text: 'Gegnerorganisationen schleusen <b>Maulwürfe</b> ein. Eine Sicherheitsanlage deckt sie auf.' },
              { ic: '⛓', text: 'Gefangene Agenten kannst du mit einer <b>Befreiungsmission</b> zurückholen.' },
            ],
          },
          {
            kicker: 'Bedienung', title: 'Die Knöpfe',
            art: SG.tutorial.art.tap,
            body: [
              { ic: '🌍', text: 'Unten links wechselst du zwischen <b>Weltkarte</b> und <b>Hauptquartier</b>.' },
              { ic: '📍', text: 'Auf der Karte zeigt ein gelbes Kästchen die Zahl der Aufträge in dieser Region. Region antippen für Einzelheiten.' },
              { ic: '🏗', text: 'Im Hauptquartier: <b>Bauen</b> wählen, Raum aussuchen, freies Feld antippen.' },
              { ic: '⏩', text: 'Oben rechts die <b>Geschwindigkeit</b>. Während einer Missionsauswertung pausiert das Spiel von selbst.' },
              { ic: '📖', text: 'Diese Anleitung findest du jederzeit über den Knopf <b>Anleitung</b> oben.' },
            ],
          },
        ],
      });
    }

    /* ---------------------------------------------------------- Zeichnen */

    function draw() {
      var s = st.s;
      ctx.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0);
      ctx.fillStyle = '#080b11';
      ctx.fillRect(0, 0, stage.w, stage.h);
      if (!s) return;

      if (st.view === 'map') {
        Rd.drawMap({
          ctx: ctx, s: s, w: stage.w, h: stage.h, t: st.t,
          selected: st.selectedRegion,
        });
      } else {
        Rd.drawHQ({
          ctx: ctx, s: s, w: stage.w, h: stage.h,
          selected: st.selectedRoom, ghost: st.ghost,
        });
      }

      // Kampagnenziel
      var goal = S.currentStory(s);
      if (goal && !st.tool) {
        var txt = goal.title + ': ' + goal.text;
        var bw = Math.min(stage.w - 24, 460);
        G.fillRound(ctx, stage.w / 2 - bw / 2, stage.h - 30, bw, 24, 12, 'rgba(11,14,21,.85)');
        G.fitText(ctx, txt, stage.w / 2, stage.h - 18, bw - 16, {
          size: 12.5, weight: 600, color: '#c8d4ea', align: 'center', baseline: 'middle',
        });
      }

      // Laufende Einsaetze links oben
      if (s.active.length && st.view === 'map') {
        var y = 10;
        s.active.forEach(function (run) {
          var type = D.missionType(run.mission.type);
          var ready = run.state !== 'anreise';
          G.fillRound(ctx, 10, y, 190, 24, 12, 'rgba(11,14,21,.9)');
          G.fitText(ctx, type.icon + ' ' + run.mission.title, 18, y + 12, 150, {
            size: 11.5, weight: 650, baseline: 'middle',
            color: ready ? '#3ddc84' : '#8794b1',
          });
          if (ready) {
            G.text(ctx, '▶', 190, y + 12, {
              size: 12, color: '#3ddc84', align: 'right', baseline: 'middle',
            });
          }
          y += 28;
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
      var ready = S.available(s).length;
      rAgents.set(ready + '/' + s.agents.length);
      rMission.set(s.active.length + '/' + S.effects(s).missionSlots);
      rLevel.set(String(s.level));
      rRep.set(Math.round(s.reputation) + '%');
      rDay.set(String(s.day));
    }

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

    /* ---------------------------------------------------------- Schleife */

    var acc = 0;
    var loop = host.loop({
      hz: 10,
      update: function (dt) {
        st.t += dt;
        var s = st.s;
        if (!s) return;
        S.step(s, dt);
        syncAlerts();
        acc += dt;
        if (acc > 0.25) { acc = 0; syncBar(); }
      },
      render: draw,
    });

    /* ---------------------------------------------------------- Eingabe */

    host.inputOn(stage.el, {
      ignore: false,
      onHover: function (x, y) {
        if (st.view === 'hq' && st.tool) updateGhost(x, y);
      },
      onMove: function (p) {
        if (st.view === 'hq' && st.tool) updateGhost(p.x, p.y);
      },
      onTap: function (x, y) {
        var s = st.s;
        if (!s) return;

        if (st.view === 'hq') {
          var cell = Rd.hqCellAt(s, x, y, stage.w, stage.h);
          if (!cell) return;
          if (st.tool) {
            updateGhost(x, y);
            if (!st.ghost) return;
            var err = S.build(s, st.tool, st.ghost.floor, st.ghost.x, st.ghost.y);
            if (err) { host.sfx('error'); UI.toast(err, 'bad', 2200); return; }
            host.sfx('build');
            host.buzz(16);
            return;
          }
          var room = S.roomAt(s, cell.floor, cell.x, cell.y);
          if (room) {
            st.selectedRoom = room;
            openRoom(room);
          } else st.selectedRoom = null;
          return;
        }

        // Weltkarte
        var best = null, bd = 30;
        s.regions.forEach(function (r) {
          if (!r.unlocked) return;
          var p = Rd.regionPos(r, stage.w, stage.h);
          var d = U.dist(x, y, p.x, p.y);
          if (d < bd) { bd = d; best = r; }
        });
        if (best) {
          st.selectedRegion = best.id;
          openRegion(best);
        } else st.selectedRegion = null;
      },
    });

    function updateGhost(x, y) {
      var def = D.roomById(st.tool);
      if (!def) { st.ghost = null; return; }
      var cell = Rd.hqCellAt(st.s, x, y, stage.w, stage.h);
      if (!cell) { st.ghost = null; return; }
      var gx = U.clamp(cell.x - Math.floor(def.w / 2), 0, D.HQ.w - def.w);
      var gy = U.clamp(cell.y - Math.floor(def.h / 2), 0, D.HQ.h - def.h);
      st.ghost = {
        id: st.tool, floor: cell.floor, x: gx, y: gy,
        ok: !S.canBuild(st.s, st.tool, cell.floor, gx, gy),
      };
    }

    function openRoom(room) {
      var def = D.roomById(room.id);
      if (!def) return;
      var body = UI.el('div');
      body.appendChild(UI.el('p.small.muted', { text: def.desc }));
      body.appendChild(UI.kv([
        ['Etage', String(room.floor + 1)],
        ['Größe', def.w + '×' + def.h],
        ['Unterhalt', U.euro(def.upkeep) + ' pro Tag'],
      ]));
      host.modal({
        title: def.name, body: body,
        actions: [
          { label: 'Schließen', cls: 'ghost' },
          def.unique ? null : {
            label: 'Abreißen (+' + U.euro(Math.round(def.cost * 0.4), true) + ')', cls: 'bad',
            onClick: function () {
              host.confirm('Abreißen?', def.name + ' wird entfernt.', 'Abreißen', true)
                .then(function (ok) {
                  if (!ok) return;
                  S.demolish(st.s, room);
                  st.selectedRoom = null;
                  host.sfx('thud');
                });
            },
          },
        ].filter(Boolean),
      });
    }

    function openRegion(r) {
      var s = st.s;
      var def = D.regionById(r.id);
      var body = UI.el('div');
      body.appendChild(UI.kv([
        ['Hitze', Math.round(r.heat) + ' %', r.heat > 60 ? 'r' : ''],
        ['Einfluss', Math.round(r.influence) + ' %', 'g'],
        ['Bedrohungslage', Math.round(r.threat) + ' %'],
      ]));
      body.appendChild(UI.bar(r.heat / 100, r.heat > 60 ? 'red' : ''));
      body.appendChild(UI.el('p.small.muted', {
        style: { marginTop: '8px' },
        text: r.heat > 60
          ? 'Hier ist es zu heiß. Ermittlungen drohen — bestechen oder eine Weile Ruhe geben.'
          : 'Die Lage ist beherrschbar.',
      }));

      var here = s.missions.filter(function (m) { return m.region === r.id; });
      if (here.length) {
        body.appendChild(UI.el('div.sec-head', null, [UI.el('h2', { text: 'Aufträge hier' })]));
        here.forEach(function (m) {
          var type = D.missionType(m.type);
          body.appendChild(UI.el('div.item.tap', {
            on: { click: function () { mo.close(); openBriefing(m); } },
          }, [
            UI.el('div.thumb', { text: type.icon }),
            UI.el('div.main', null, [
              UI.el('div.t', { text: m.title }),
              UI.el('div.d', { text: type.name + ' · Stufe ' + m.diff }),
            ]),
            UI.el('div.side', null, [UI.el('div.p', { text: U.euro(m.fee, true) })]),
          ]));
        });
      }

      var mo = host.modal({
        title: def.name, body: body,
        actions: [
          { label: 'Schließen', cls: 'ghost' },
          r.heat > 5 ? {
            label: 'Bestechen ' + U.euro(S.bribeCost(s, r), true), cls: 'primary',
            onClick: function () {
              var err = S.bribe(s, r.id);
              if (err) UI.toast(err, 'bad');
              else { host.sfx('cash'); UI.toast('Hitze gesenkt.', 'good'); }
            },
          } : null,
        ].filter(Boolean),
      });
    }

    var keys = host.keys({
      onDown: function (k) {
        if (k === 'escape') setTool(null);
        else if (k === 'space') { st.s.paused = !st.s.paused; syncSpeeds(); }
        else if (k === 'tab') toggleView();
      },
    });

    /* ---------------------------------------------------------- Start */

    if (!load(st.slot)) {
      st.s = S.create();
    }
    showTutorial(false);
    syncSpeeds();
    syncBar();
    loop.start();

    if (SG.storage.volatile && !(SG.selftest && SG.selftest.active)) {
      var volT = setTimeout(function () {
        UI.toast('Dieses Gerät speichert nicht dauerhaft — die Agentur hält nur, '
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

        // Startlage
        if (s.agents.length !== 3) throw new Error('Startteam hat ' + s.agents.length + ' Agenten');
        if (!S.hasRoom(s, 'zentrale')) throw new Error('Kommandozentrale fehlt');
        if (!s.missions.length) throw new Error('Keine Startaufträge');

        // Bauen
        var err = S.build(s, 'labor', 0, 4, 0);
        if (err) throw new Error('Labor: ' + err);
        if (S.build(s, 'labor', 0, 4, 0) === null) throw new Error('Überlappender Bau erlaubt');
        if (S.build(s, 'zentrale', 0, 0, 2) === null) throw new Error('Zweite Zentrale erlaubt');
        var lab = S.roomAt(s, 0, 4, 0);
        if (!lab) throw new Error('Labor nicht im Raster');
        S.demolish(s, lab);
        if (S.roomAt(s, 0, 4, 0)) throw new Error('Abriss räumt das Feld nicht');
        S.build(s, 'labor', 0, 4, 0);

        // Balance-Probe: Startkapital muss fuer Labor plus die
        // guenstigste Forschung reichen.
        var minTech = Math.min.apply(null, D.TECH.map(function (t) { return t.cost; }));
        if (D.ECON.start < D.roomById('labor').cost + minTech) {
          throw new Error('Startkapital reicht nicht für Labor und erste Forschung');
        }

        // Forschung (der Test hat oben Geld fuer Abriss und Neubau verbraucht)
        s.cash += 200000;
        err = S.startResearch(s, 'maske');
        if (err) throw new Error('Forschung: ' + err);
        for (var d = 0; d < 12; d++) S.step(s, 12);   // zwoelf Sekunden = ein Tag
        if (s.tech.indexOf('maske') < 0) throw new Error('Forschung wurde nicht fertig');

        // Mission komplett durchspielen
        var mission = s.missions[0];
        var team = S.available(s).slice(0, D.missionType(mission.type).team[0]);
        if (!team.length) throw new Error('Kein Agent verfügbar');
        var before = s.cash;
        err = S.startMission(s, mission, team);
        if (err) throw new Error('Missionsstart: ' + err);
        if (!s.active.length) throw new Error('Einsatz nicht gestartet');
        var run = s.active[0];
        var guard = 0;
        while (run.state === 'anreise' && guard++ < 400) S.step(s, 1);
        if (run.state === 'anreise') throw new Error('Team kommt nicht an');
        guard = 0;
        while (run.state !== 'fertig' && guard++ < 30) {
          if (run.choicePending) M.applyChoice(s, run, 0);
          else M.step(s, run);
        }
        if (run.state !== 'fertig') throw new Error('Mission endet nicht');
        if (!run.summary) throw new Error('Kein Missionsbericht');
        if (s.stats.missions !== 1) throw new Error('Mission nicht gezählt');
        team.forEach(function (a) {
          if (a.status === 'einsatz') throw new Error(a.code + ' hängt im Einsatz fest');
        });

        // Einstellen und Ausruesten
        if (s.recruits.length) {
          s.cash += 100000;
          var rid = s.recruits[0].id;
          err = S.hire(s, rid);
          if (err) throw new Error('Einstellen: ' + err);
        }
        s.cash += 200000;
        S.build(s, 'werkstatt', 0, 0, 2);
        err = S.buyGadget(s, 'dietrich', false);
        if (err) throw new Error('Gadget: ' + err);
        var a0 = s.agents[0];
        err = S.equip(s, a0, 0, 'dietrich');
        if (err && a0.status === 'bereit') throw new Error('Ausrüsten: ' + err);

        // Laenger laufen lassen
        for (var i = 0; i < (steps || 400); i++) {
          S.step(s, 0.1);
          if (!isFinite(s.cash)) throw new Error('Kasse ungültig');
        }
        if (s.day < 1) throw new Error('Keine Tage vergangen');
        if (!s.stats.history.length) throw new Error('Keine Tagesbilanz');

        // Speichern und Laden
        var raw = JSON.parse(JSON.stringify(S.serialize(s)));
        var back = S.deserialize(raw);
        if (!back) throw new Error('Laden fehlgeschlagen');
        if (Math.round(back.cash) !== Math.round(s.cash)) throw new Error('Kasse nach dem Laden anders');
        if (back.agents.length !== s.agents.length) throw new Error('Agenten nach dem Laden anders');
        if (back.rooms.length !== s.rooms.length) throw new Error('Räume nach dem Laden anders');

        draw();
        syncBar();
      },
    };
  }

  SG.register({
    id: 'spytycoon',
    name: 'Geheimagenten-Tycoon',
    category: 'tycoon',
    desc: 'Agentur führen, Missionen planen',
    tags: ['spion', 'agenten', 'missionen', 'tycoon', 'aufbau', 'strategie'],
    heavy: true,
    preview: function (c, w, h) {
      c.fillStyle = '#0a1424';
      c.fillRect(0, 0, w, h);
      // Gitternetz
      c.strokeStyle = 'rgba(120,160,220,.08)';
      c.lineWidth = 1;
      for (var i = 1; i < 8; i++) {
        c.beginPath(); c.moveTo((w / 8) * i, 0); c.lineTo((w / 8) * i, h); c.stroke();
        c.beginPath(); c.moveTo(0, (h / 6) * i); c.lineTo(w, (h / 6) * i); c.stroke();
      }
      // Kontinente
      var land = [
        [0.08, 0.2, 0.26, 0.16, 0.32, 0.26, 0.24, 0.44, 0.12, 0.36],
        [0.4, 0.22, 0.56, 0.18, 0.62, 0.34, 0.54, 0.6, 0.44, 0.44],
        [0.66, 0.16, 0.9, 0.2, 0.94, 0.36, 0.76, 0.46, 0.66, 0.3],
        [0.78, 0.66, 0.92, 0.64, 0.94, 0.78, 0.8, 0.82],
      ];
      land.forEach(function (poly) {
        c.beginPath();
        c.moveTo(poly[0] * w, poly[1] * h);
        for (var k = 2; k < poly.length; k += 2) c.lineTo(poly[k] * w, poly[k + 1] * h);
        c.closePath();
        c.fillStyle = '#1c2a3f';
        c.fill();
        c.strokeStyle = 'rgba(140,180,240,.25)';
        c.lineWidth = 1;
        c.stroke();
      });
      // Marker
      var pins = [[0.22, 0.32, '#4aa3ff'], [0.48, 0.3, '#ffd166'], [0.6, 0.44, '#ff5f6b'],
        [0.8, 0.34, '#3ddc84'], [0.85, 0.72, '#4aa3ff']];
      pins.forEach(function (p, i) {
        if (i === 1) {
          G.glow(c, p[0] * w, p[1] * h, 22, '#ffd166', .35);
          G.star(c, p[0] * w, p[1] * h, 8, 3.6, 5, -Math.PI / 2, p[2]);
        } else {
          if (p[2] === '#ff5f6b') G.glow(c, p[0] * w, p[1] * h, 18, '#ff5f6b', .3);
          G.arcProgress(c, p[0] * w, p[1] * h, 9, 2, 0.6, '#3ddc84', 'rgba(255,255,255,.12)');
          G.circle(c, p[0] * w, p[1] * h, 4.5, p[2]);
        }
      });
      // Verbindungen
      c.strokeStyle = 'rgba(255,209,102,.35)';
      c.setLineDash([3, 4]);
      c.lineWidth = 1.2;
      [[0, 1], [1, 2], [1, 3]].forEach(function (pair) {
        c.beginPath();
        c.moveTo(pins[pair[0]][0] * w, pins[pair[0]][1] * h);
        c.lineTo(pins[pair[1]][0] * w, pins[pair[1]][1] * h);
        c.stroke();
      });
      c.setLineDash([]);
    },
    mount: mount,
  });
})(SG);
