/* ------------------------------------------------------------------
   Island Quest - Bild und Oberflaeche

   Die Insel liegt als Raster da. Ein Tipp auf ein freies Feld oeffnet
   die Bauliste - und die zeigt gleich, was dieses Feld hergibt: ein
   Holzfaeller mitten im Wald bringt das Dreifache, ein Fischer ohne
   Wasser gar nichts. Deshalb steht der Lagebonus direkt am Knopf.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var G = SG.gfx;
  var UI = SG.ui;
  var I = SG.tycoon.insel;
  var D = I.data;
  var S = I.sim;

  var TEMPI = [0, 1, 2, 4];

  /* ------------------------------------------------------------------
     Zeichnen
     ------------------------------------------------------------------ */

  var R = I.render = {};

  /* Feldgroesse und Rand, damit das Raster mittig sitzt */
  function raster(breite, hoehe) {
    var f = Math.floor(Math.min((breite - 24) / D.BREITE, (hoehe - 24) / D.HOEHE));
    f = Math.max(18, f);
    return {
      f: f,
      ox: Math.round((breite - f * D.BREITE) / 2),
      oy: Math.round((hoehe - f * D.HOEHE) / 2),
    };
  }
  R.raster = raster;

  R.zeichnen = function (c, s, breite, hoehe, zeit, auswahl) {
    c.fillStyle = '#0a1220';
    c.fillRect(0, 0, breite, hoehe);

    var g = raster(breite, hoehe);
    var karte = S.karte(s, s.aktiv);
    if (!karte) return g;

    /* Wasser mit ein paar Wellen, damit es nicht tot wirkt */
    for (var y = 0; y < D.HOEHE; y++) {
      for (var x = 0; x < D.BREITE; x++) {
        var boden = karte[y][x];
        var def = D.BODEN[boden];
        var px = g.ox + x * g.f;
        var py = g.oy + y * g.f;

        c.fillStyle = def.farbe;
        c.fillRect(px, py, g.f, g.f);

        if (boden === 'wasser') {
          c.fillStyle = 'rgba(255,255,255,.05)';
          var w = Math.sin(zeit * 1.4 + x * 0.7 + y * 0.9) * 0.5 + 0.5;
          c.fillRect(px + g.f * 0.18, py + g.f * (0.35 + w * 0.2), g.f * 0.36, 1.5);
          c.fillRect(px + g.f * 0.52, py + g.f * (0.62 - w * 0.16), g.f * 0.26, 1.5);
        } else {
          /* Feine Koernung je Feld - immer dieselbe, damit es nicht flimmert */
          c.fillStyle = 'rgba(0,0,0,.12)';
          var k = (x * 7 + y * 13) % 5;
          c.fillRect(px + 2 + k * 3, py + 3 + ((x + y) % 4) * 3, 2, 2);
          c.fillRect(px + g.f - 6 - k * 2, py + g.f - 7, 2, 2);
        }

        c.strokeStyle = 'rgba(0,0,0,.22)';
        c.lineWidth = 1;
        c.strokeRect(px + 0.5, py + 0.5, g.f - 1, g.f - 1);

        /* Gelaende-Zeichen auf freien Feldern, blass */
        var bau = S.bau(s, s.aktiv, x, y);
        if (!bau && boden !== 'wasser' && g.f >= 26) {
          G.text(c, def.icon, px + g.f / 2, py + g.f / 2, {
            font: G.font(Math.round(g.f * 0.44)),
            align: 'center', baseline: 'middle',
          });
          c.fillStyle = 'rgba(0,0,0,.18)';
          c.fillRect(px + 1, py + 1, g.f - 2, g.f - 2);
        }

        if (bau) {
          var bdef = D.gebaeude(bau);
          G.fillRound(c, px + 2, py + 2, g.f - 4, g.f - 4, 4, 'rgba(10,14,22,.55)');
          G.strokeRound(c, px + 2, py + 2, g.f - 4, g.f - 4, 4, 'rgba(240,180,41,.35)', 1);
          G.text(c, bdef.icon, px + g.f / 2, py + g.f / 2, {
            font: G.font(Math.round(g.f * 0.52)),
            align: 'center', baseline: 'middle',
          });
        }
      }
    }

    /* Auswahlrahmen im Baumodus */
    if (auswahl && auswahl.x >= 0) {
      var ax = g.ox + auswahl.x * g.f;
      var ay = g.oy + auswahl.y * g.f;
      var puls = 0.5 + Math.sin(zeit * 5) * 0.5;
      c.strokeStyle = auswahl.ok
        ? 'rgba(61,220,132,' + (0.6 + puls * 0.4) + ')'
        : 'rgba(255,95,107,' + (0.6 + puls * 0.4) + ')';
      c.lineWidth = 2.5;
      c.strokeRect(ax + 1.5, ay + 1.5, g.f - 3, g.f - 3);
    }

    /* Ein Schiff, solange eine Fahrt laeuft */
    if (s.fahrt) {
      var t = 1 - s.fahrt.rest / Math.max(1, s.fahrt.gesamt);
      var sx = g.ox + 10 + t * (g.f * D.BREITE - 20);
      var sy = g.oy + g.f * D.HOEHE + 14;
      if (sy < hoehe - 6) {
        G.text(c, '⛵', sx, sy, {
          font: G.font(20), align: 'center', baseline: 'middle',
        });
        G.text(c, 'noch ' + s.fahrt.rest + ' Tage nach '
          + D.insel(s.fahrt.ziel).name, g.ox, sy, {
          font: G.font(12, 600), fill: '#8794b1', baseline: 'middle',
        });
      }
    }

    return g;
  };

  /* ------------------------------------------------------------------
     Oberflaeche
     ------------------------------------------------------------------ */

  function mount(host) {
    var store = host.store;

    var st = {
      s: null,
      slot: store.get('slot', 1),
      drawer: null,
      lastSave: 0,
      saveWarned: false,
      t: 0,
      gemeldeteStufe: -1,
      bauModus: null,          // gewaehltes Gebaeude
      zeiger: { x: -1, y: -1, ok: false },
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

    var bauLeiste = UI.el('div.tyc-hint');
    bauLeiste.style.display = 'none';
    main.appendChild(bauLeiste);

    function resItem(cls, icon, key) {
      var v = UI.el('div.v', { text: '—' });
      var el = UI.el('div.res' + (cls ? '.' + cls : ''), null, [
        UI.el('div.ic', { text: icon }),
        UI.el('div.tx', null, [UI.el('div.k', { text: key }), v]),
      ]);
      el.set = function (t) { if (v.textContent !== t) v.textContent = t; };
      el.tint = function (c) { v.style.color = c || ''; };
      el.icon = function (t) { el.firstChild.textContent = t; };
      return el;
    }

    var rBewohner = resItem('', '🧑', 'Bewohner');
    var rNahrung = resItem('', '🍞', 'Nahrung');
    var rLaune = resItem('', '😊', 'Stimmung');
    var rArbeit = resItem('', '🔨', 'Arbeitskraft');
    var rHolz = resItem('', '🪵', 'Holz');
    var rStein = resItem('', '🪨', 'Stein');
    var rWerkzeug = resItem('', '🛠', 'Werkzeug');
    var rMuenzen = resItem('money', '🪙', 'Münzen');
    var rInsel = resItem('', '🏝', 'Insel');
    var rZeit = resItem('', '📅', 'Tag');
    var rStufe = resItem('', '🪵', 'Rang');
    [rBewohner, rNahrung, rLaune, rArbeit, rHolz, rStein, rWerkzeug, rMuenzen,
      rInsel, rZeit, rStufe].forEach(function (e) { res.appendChild(e); });

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

    function dockBtn(icon, label, onClick) {
      var b = UI.el('button.dockbtn', {
        on: { click: function () { host.sfx('click'); onClick(b); } },
      }, [UI.el('div.ic', { text: icon }), UI.el('div.lb', { text: label })]);
      dock.appendChild(b);
      return b;
    }

    dockBtn('🔨', 'Bauen', function () { openBauen(); });
    dockBtn('📦', 'Lager', function () { openLager(); });
    dockBtn('🗺', 'Inseln', function () { openInseln(); });
    var bFahrt = dockBtn('⛵', 'Expedition', function () { openExpedition(); });
    dockBtn('📊', 'Statistik', function () { openStatistik(); });

    host.tool('📖 Anleitung', function () { zeigeAnleitung(true); });
    var bSave = host.tool('💾', function () { openSaves(); });

    host.beforeExit = function () {
      if (!st.s) return true;
      save(st.slot, true);
      if (!SG.settings.get('confirmExit')) return true;
      return host.confirm('Insel verlassen?',
        'Der Stand wurde gerade gespeichert.', 'Verlassen');
    };
    host.onLeave(function () { save(st.slot, true); });

    var autosaveT = setInterval(function () { save(st.slot, true); }, 20000);
    host.onDestroy(function () { clearInterval(autosaveT); });

    /* ---------------------------------------------------------- Stand */

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
          : 'Der Speicher ist voll — bitte den Spielstand-Code sichern.',
          ok ? 'good' : 'bad', ok ? undefined : 5200);
      } else if (!ok && !st.saveWarned) {
        st.saveWarned = true;
        UI.toast('Die Inseln lassen sich hier nicht sichern — bitte über '
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
      st.gemeldeteStufe = s.hoechsteStufe;
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
                text: raw
                  ? Math.floor(raw.bewohner || 0) + ' Bewohner · '
                    + (raw.entdeckt || []).length + ' Inseln · Tag ' + (raw.tag || 1)
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
      body.appendChild(UI.btn('Neu anfangen', function () {
        m.close();
        host.confirm('Von vorn anfangen?',
          'Der Stand in Platz ' + st.slot + ' wird überschrieben.', 'Neu starten', true)
          .then(function (ok) {
            if (!ok) return;
            S.kartenLeeren();
            st.s = S.create((Date.now() ^ (Math.random() * 1e9)) >>> 0);
            st.gemeldeteStufe = 0;
            save(st.slot, true);
            zeigeAnleitung(true);
          });
      }, 'sm bad wide'));
      var m = host.modal({ title: 'Spielstände', body: body });
    }

    /* ---------------------------------------------------------- Schublade */

    function drawer(title, build) {
      if (st.drawer) st.drawer.close();
      st.drawer = UI.drawer({
        parent: root, title: title, build: build,
        onClose: function () { st.drawer = null; },
      });
      st.drawer.rebuild = function () {
        UI.clear(st.drawer.body);
        build(st.drawer.body, st.drawer);
      };
      return st.drawer;
    }

    function kostenText(kosten) {
      var teile = [];
      for (var id in kosten) {
        var w = D.ware(id);
        var da = (st.s.lager[id] || 0) >= kosten[id];
        teile.push('<b class="' + (da ? '' : 'warn') + '">' + w.icon + ' '
          + kosten[id] + '</b>');
      }
      return teile.join(' · ');
    }

    /* ---------------------------------------------------------- Bauen */

    function openBauen(x, y) {
      var feldX = x, feldY = y;
      drawer(feldX === undefined ? 'Bauen' : 'Bauen auf Feld ' + (feldX + 1) + '/' + (feldY + 1),
        function (body) {
          var s = st.s;

          if (feldX === undefined) {
            body.appendChild(UI.el('p.small.muted', {
              text: 'Wähle ein Gebäude und tippe danach auf ein freies Feld. '
                + 'Der grüne Rahmen zeigt, wo es hindarf.',
            }));
          } else {
            var boden = S.feld(s, s.aktiv, feldX, feldY);
            body.appendChild(UI.el('p.small.muted', {
              text: 'Untergrund: ' + D.BODEN[boden].icon + ' ' + D.BODEN[boden].name + '.',
            }));
          }

          D.GEBAEUDE.forEach(function (def) {
            var lage = feldX === undefined ? 1 : S.lage(s, s.aktiv, feldX, feldY, def);
            var fehler = feldX === undefined ? null
              : S.darfBauen(s, s.aktiv, feldX, feldY, def);
            var bezahlbar = S.kannZahlen(s, def.kosten);

            var zeilen = [def.text];
            if (def.erzeugt) {
              var e = [];
              for (var w in def.erzeugt) {
                e.push(D.ware(w).icon + ' ' + U.num(def.erzeugt[w] * lage, 1));
              }
              zeilen.push('Erzeugt je Tag: ' + e.join(', ')
                + (lage > 1.02 ? ' <b class="good">(+' + U.num((lage - 1) * 100)
                  + ' % durch die Lage)</b>' : ''));
            }
            if (def.braucht) {
              var v = [];
              for (w in def.braucht) v.push(D.ware(w).icon + ' ' + def.braucht[w]);
              zeilen.push('Braucht je Tag: ' + v.join(', '));
            }
            if (def.bewohner > 0) zeilen.push(def.bewohner + ' Arbeitskräfte');
            if (def.bewohner < 0) zeilen.push('Wohnraum für ' + (-def.bewohner));
            zeilen.push('Kosten: ' + kostenText(def.kosten));
            if (fehler) zeilen.push('<b class="warn">' + fehler + '</b>');

            var knopf = UI.btn(feldX === undefined ? 'Wählen' : 'Bauen', function () {
              if (feldX === undefined) {
                st.bauModus = def;
                bauLeisteZeigen();
                if (st.drawer) st.drawer.close();
                UI.toast('Tippe auf ein freies Feld.', 'info');
                return;
              }
              var f = S.bauen(s, s.aktiv, feldX, feldY, def.id);
              if (f) { host.sfx('error'); UI.toast(f, 'bad', 2600); return; }
              host.sfx('build');
              host.buzz(12);
              syncBar();
              if (st.drawer) st.drawer.close();
            }, 'sm' + (!fehler && bezahlbar ? ' primary' : ' ghost'));
            if (fehler || !bezahlbar) knopf.disabled = feldX !== undefined;

            body.appendChild(UI.el('div.item', null, [
              UI.el('div.thumb', { text: def.icon }),
              UI.el('div.main', null, [
                UI.el('div.t', { text: def.name }),
                UI.el('div.d', { html: zeilen.join('<br>') }),
              ]),
              UI.el('div.side', null, [knopf]),
            ]));
          });
        });
    }

    function bauLeisteZeigen() {
      if (!st.bauModus) { bauLeiste.style.display = 'none'; return; }
      UI.clear(bauLeiste);
      bauLeiste.style.display = '';
      bauLeiste.appendChild(UI.el('span', {
        text: st.bauModus.icon + ' ' + st.bauModus.name + ' — Feld antippen',
      }));
      bauLeiste.appendChild(UI.btn('Abbrechen', function () {
        st.bauModus = null;
        st.zeiger.x = -1;
        bauLeisteZeigen();
      }, 'sm ghost'));
    }

    /* Ein bestehendes Gebaeude antippen */
    function openFeld(x, y) {
      var s = st.s;
      var bauId = S.bau(s, s.aktiv, x, y);
      if (!bauId) { openBauen(x, y); return; }

      var def = D.gebaeude(bauId);
      var lage = S.lage(s, s.aktiv, x, y, def);
      var body = UI.el('div');
      var zeilen = [];
      if (def.erzeugt) {
        var e = [];
        for (var w in def.erzeugt) e.push(D.ware(w).icon + ' ' + U.num(def.erzeugt[w] * lage, 1));
        zeilen.push(['Erzeugt je Tag', e.join(', ')]);
      }
      if (def.braucht) {
        var v = [];
        for (w in def.braucht) v.push(D.ware(w).icon + ' ' + def.braucht[w]);
        zeilen.push(['Braucht je Tag', v.join(', ')]);
      }
      if (lage > 1.02) zeilen.push(['Lagebonus', '+' + U.num((lage - 1) * 100) + ' %', 'good']);
      if (def.bewohner > 0) zeilen.push(['Arbeitskräfte', String(def.bewohner)]);
      if (def.bewohner < 0) zeilen.push(['Wohnraum', String(-def.bewohner)]);
      body.appendChild(UI.kv(zeilen));
      body.appendChild(UI.el('p.small.muted', { text: def.text }));

      var m = host.modal({
        title: def.icon + ' ' + def.name,
        body: body,
        actions: [
          { label: 'Abreißen', cls: 'bad', onClick: function () {
            var f = S.abreissen(s, s.aktiv, x, y);
            if (f) { UI.toast(f, 'bad'); return; }
            host.sfx('thud');
            UI.toast('Abgerissen — die Hälfte kam zurück.', 'good');
            syncBar();
          } },
          { label: 'Schließen', cls: 'primary' },
        ],
      });
      return m;
    }

    /* ---------------------------------------------------------- Lager */

    function openLager() {
      drawer('Lager', function (body) {
        var s = st.s;
        var bilanz = S.tagesBilanz(s);
        var grenze = S.lagerGrenze(s);

        body.appendChild(UI.el('p.small.muted', {
          text: 'Das Lager fasst ' + U.num(grenze) + ' je Ware. Was darüber liegt, '
            + 'verdirbt — oder wird verkauft, wenn ein Markt steht.',
        }));

        D.WAREN.forEach(function (w) {
          var da = s.lager[w.id] || 0;
          var ein = bilanz.ein[w.id] || 0;
          var aus = bilanz.aus[w.id] || 0;
          var netto = ein - aus;
          if (!da && !ein && !aus) return;

          var balken = w.geld ? null : UI.bar(da / grenze,
            da > grenze * 0.95 ? 'bad' : '');

          body.appendChild(UI.el('div.item', null, [
            UI.el('div.thumb', { text: w.icon }),
            UI.el('div.main', null, [
              UI.el('div.t', { text: w.name + ' · ' + U.num(Math.floor(da)) }),
              UI.el('div.d', {
                html: w.geld ? 'Erlös aus dem Markt.'
                  : 'je Tag <b class="' + (netto >= 0 ? 'good' : 'bad') + '">'
                    + (netto >= 0 ? '+' : '') + U.num(netto, 1) + '</b>'
                    + (aus ? ' (erzeugt ' + U.num(ein, 1) + ', verbraucht '
                      + U.num(aus, 1) + ')' : ''),
              }),
              balken,
            ]),
          ]));
        });
      });
    }

    /* ---------------------------------------------------------- Inseln */

    function openInseln() {
      drawer('Inseln', function (body, self) {
        var s = st.s;
        D.INSELN.forEach(function (def) {
          var da = s.entdeckt.indexOf(def.id) >= 0;
          var aktiv = s.aktiv === def.id;
          var bauten = da && s.inseln[def.id]
            ? Object.keys(s.inseln[def.id].bauten).length : 0;

          body.appendChild(UI.el('div.item' + (aktiv ? '.sel' : '') + (da ? '' : '.zu'), null, [
            UI.el('div.thumb', { text: da ? def.icon : '❔' }),
            UI.el('div.main', null, [
              UI.el('div.t', { text: da ? def.name : 'Unbekanntes Eiland' }),
              UI.el('div.d', {
                text: da
                  ? bauten + ' Gebäude' + (def.gabe
                    ? ' · reich an ' + D.ware(def.gabe).name : '')
                  : (def.fahrt ? def.fahrt + ' Tage Fahrt · noch nicht erkundet'
                    : 'noch nicht erkundet'),
              }),
            ]),
            UI.el('div.side', null, [
              da ? UI.btn(aktiv ? 'Hier' : 'Hinsehen', function () {
                s.aktiv = def.id;
                host.sfx('select');
                self.rebuild();
                syncBar();
              }, 'sm' + (aktiv ? ' ghost' : ' primary')) : null,
            ]),
          ]));
        });
      });
    }

    /* ---------------------------------------------------------- Expedition */

    function openExpedition() {
      drawer('Expedition', function (body) {
        var s = st.s;

        if (s.fahrt) {
          var ziel = D.insel(s.fahrt.ziel);
          body.appendChild(UI.el('div.item', null, [
            UI.el('div.thumb', { text: '⛵' }),
            UI.el('div.main', null, [
              UI.el('div.t', { text: 'Unterwegs nach ' + ziel.name }),
              UI.el('div.d', { text: 'Noch ' + s.fahrt.rest + ' von '
                + s.fahrt.gesamt + ' Tagen.' }),
              UI.bar(1 - s.fahrt.rest / s.fahrt.gesamt),
            ]),
          ]));
          return;
        }

        if (!S.zaehlen(s, 'hafen')) {
          body.appendChild(UI.empty('⚓', 'Kein Hafen',
            'Ohne Hafen am Wasser fährt kein Schiff. Er kostet Bretter, '
            + 'Ziegel und Werkzeug.'));
        }

        body.appendChild(UI.el('p.small.muted', {
          text: 'Jede Fahrt kostet Vorräte und dauert. Ein Leuchtturm verkürzt sie.',
        }));

        D.INSELN.forEach(function (def) {
          if (!def.ausruest) return;
          if (s.entdeckt.indexOf(def.id) >= 0) return;
          var fehler = S.fahrtMoeglich(s, def.id);
          var unbekannt = fehler && fehler.indexOf('Erst muss') === 0;

          body.appendChild(UI.el('div.item', null, [
            UI.el('div.thumb', { text: unbekannt ? '🔒' : def.icon }),
            UI.el('div.main', null, [
              UI.el('div.t', { text: unbekannt ? 'Weiter draußen' : def.name }),
              UI.el('div.d', {
                html: (unbekannt ? 'Erst die näheren Inseln.' : def.text)
                  + '<br>Fahrt: <b>' + S.fahrtDauer(s, def.id) + ' Tage</b>'
                  + '<br>Ausrüstung: ' + kostenText(def.ausruest)
                  + (fehler && !unbekannt ? '<br><b class="warn">' + fehler + '</b>' : ''),
              }),
            ]),
            UI.el('div.side', null, [
              UI.btn('Auslaufen', function () {
                var f = S.fahrtStarten(s, def.id);
                if (f) { host.sfx('error'); UI.toast(f, 'bad', 2600); return; }
                host.sfx('whoosh');
                syncBar();
                if (st.drawer && st.drawer.rebuild) st.drawer.rebuild();
              }, 'sm' + (fehler ? ' ghost' : ' primary')),
            ]),
          ]));
        });
      });
    }

    /* ---------------------------------------------------------- Statistik */

    function openStatistik() {
      drawer('Statistik', function (body) {
        var s = st.s;
        var bilanz = S.tagesBilanz(s);

        body.appendChild(UI.kv([
          ['Rang', D.STUFEN[s.stufe].icon + ' ' + D.STUFEN[s.stufe].name],
          ['Bewohner', Math.floor(s.bewohner) + ' von ' + S.wohnraum(s) + ' Plätzen',
            s.bewohner >= S.wohnraum(s) ? 'bad' : 'good'],
          ['Arbeitskraft', U.num(S.arbeitsFaktor(s) * 100) + ' %',
            S.arbeitsFaktor(s) >= 1 ? 'good' : 'bad'],
          ['Stimmung', Math.round(s.laune) + ' %',
            s.laune > 60 ? 'good' : (s.laune < 35 ? 'bad' : '')],
          ['Nahrung je Tag', U.num((bilanz.ein.nahrung || 0) - (bilanz.aus.nahrung || 0), 1),
            (bilanz.ein.nahrung || 0) >= (bilanz.aus.nahrung || 0) ? 'good' : 'bad'],
          ['Gebäude', String(S.alleBauten(s).length)],
          ['Inseln', s.entdeckt.length + ' von ' + D.INSELN.length],
          ['Tag', String(s.tag)],
        ]));

        body.appendChild(UI.el('h4.pf-h', { text: 'Nächster Rang' }));
        var n = D.STUFEN[s.stufe + 1];
        if (!n) {
          body.appendChild(UI.el('p.small.muted', { text: 'Weiter geht es nicht.' }));
        } else {
          body.appendChild(UI.kv([
            ['Bewohner', Math.floor(s.bewohner) + ' / ' + n.bewohner,
              s.bewohner >= n.bewohner ? 'good' : ''],
            ['Inseln', s.entdeckt.length + ' / ' + n.inseln,
              s.entdeckt.length >= n.inseln ? 'good' : ''],
          ]));
        }

        body.appendChild(UI.el('h4.pf-h', { text: 'Meldungen' }));
        var log = UI.el('div.logbox');
        s.meldungen.slice(0, 30).forEach(function (m) {
          log.appendChild(UI.el('div.logline' + (m.art ? '.' + m.art : ''), null, [
            UI.el('span.tm', { text: m.icon }),
            UI.el('span', { text: m.text }),
          ]));
        });
        if (!s.meldungen.length) log.appendChild(UI.el('div.logline', { text: 'Noch nichts.' }));
        body.appendChild(log);
      });
    }

    /* ---------------------------------------------------------- Anleitung */

    function zeigeAnleitung(erzwingen) {
      if (!erzwingen && st.s && st.s.tutorialGesehen) return;
      if (st.s) st.s.tutorialGesehen = true;
      var body = UI.el('div');
      [
        ['🔨', 'Die Lage zählt', 'Ein Holzfäller im Wald bringt weit mehr als einer '
          + 'auf der Wiese, ein Fischer muss ans Wasser. Der Bauplan zeigt den '
          + 'Bonus, bevor du baust.'],
        ['🪚', 'Ketten', 'Holz wird zu Brettern, Erz und Holz zu Metall, Bretter und '
          + 'Metall zu Werkzeug. Ohne Werkzeug fährt kein Schiff.'],
        ['🍞', 'Leute', 'Bewohner brauchen Wohnraum und Essen. Fehlt eines, sinkt die '
          + 'Stimmung — und mit ihr die Leistung aller Betriebe.'],
        ['⛵', 'Neue Inseln', 'Ein Hafen am Wasser schickt Expeditionen los. Jede Insel '
          + 'hat ihren eigenen Boden und bringt etwas mit, das es sonst kaum gibt.'],
      ].forEach(function (z) {
        body.appendChild(UI.el('div.item', null, [
          UI.el('div.thumb', { text: z[0] }),
          UI.el('div.main', null, [
            UI.el('div.t', { text: z[1] }),
            UI.el('div.d', { text: z[2] }),
          ]),
        ]));
      });
      host.modal({
        title: 'Island Quest', body: body,
        actions: [{ label: 'Land in Sicht', cls: 'primary' }],
      });
    }

    /* ---------------------------------------------------------- Meldungen */

    function alertsTakt() {
      var s = st.s;
      if (!s) return;
      var m = s.meldungen[0];
      if (!m || m.__gezeigt) return;
      m.__gezeigt = true;
      var el = UI.el('div.alert' + (m.art ? '.' + m.art : ''), null, [
        UI.el('div.ic', { text: m.icon }),
        UI.el('div.tx', { text: m.text }),
      ]);
      alertsEl.appendChild(el);
      if (m.art === 'gut') host.sfx('coin');
      else if (m.art === 'schlecht') host.sfx('error');
      host.after(function () {
        el.style.opacity = '0';
        host.after(function () { UI.remove(el); }, 400);
      }, 4200);
      while (alertsEl.children.length > 3) UI.remove(alertsEl.firstChild);
    }

    /* ---------------------------------------------------------- Kopf */

    function syncBar() {
      var s = st.s;
      if (!s) return;
      var bilanz = S.tagesBilanz(s);
      var platz = S.wohnraum(s);

      rBewohner.set(Math.floor(s.bewohner) + ' / ' + platz);
      rBewohner.tint(s.bewohner >= platz ? 'var(--red)' : '');
      var nahrung = (bilanz.ein.nahrung || 0) - (bilanz.aus.nahrung || 0);
      rNahrung.set(U.num(Math.floor(s.lager.nahrung || 0)) + ' ('
        + (nahrung >= 0 ? '+' : '') + U.num(nahrung, 1) + ')');
      rNahrung.tint(nahrung < 0 ? 'var(--red)' : 'var(--green)');
      rLaune.set(Math.round(s.laune) + ' %');
      rLaune.tint(s.laune > 60 ? 'var(--green)' : (s.laune < 35 ? 'var(--red)' : ''));
      rArbeit.set(U.num(S.arbeitsFaktor(s) * 100) + ' %');
      rArbeit.tint(S.arbeitsFaktor(s) < 1 ? 'var(--red)' : '');
      rHolz.set(U.short(Math.floor(s.lager.holz || 0)));
      rStein.set(U.short(Math.floor(s.lager.stein || 0)));
      rWerkzeug.set(U.short(Math.floor(s.lager.werkzeug || 0)));
      rMuenzen.set(U.short(Math.floor(s.lager.muenzen || 0)));
      var ins = D.insel(s.aktiv);
      rInsel.icon(ins.icon);
      rInsel.set(ins.name);
      rZeit.set('Tag ' + s.tag);
      rStufe.icon(D.STUFEN[s.stufe].icon);
      rStufe.set(D.STUFEN[s.stufe].name);

      var mark = bFahrt.querySelector('.dotmark');
      if (s.fahrt && !mark) bFahrt.appendChild(UI.el('span.dotmark'));
      if (!s.fahrt && mark) UI.remove(mark);

      syncSpeeds();
    }

    /* ---------------------------------------------------------- Antippen */

    function feldBei(px, py) {
      var g = R.raster(stage.w, stage.h);
      var x = Math.floor((px - g.ox) / g.f);
      var y = Math.floor((py - g.oy) / g.f);
      if (x < 0 || x >= D.BREITE || y < 0 || y >= D.HOEHE) return null;
      return { x: x, y: y };
    }

    host.inputOn(stage.el, {
      onTap: function (px, py) {
        var s = st.s;
        if (!s) return;
        var f = feldBei(px, py);
        if (!f) return;

        if (st.bauModus) {
          var fehler = S.bauen(s, s.aktiv, f.x, f.y, st.bauModus.id);
          if (fehler) { host.sfx('error'); UI.toast(fehler, 'bad', 2600); return; }
          host.sfx('build');
          host.buzz(12);
          /* Im Baumodus bleiben - man setzt selten nur eines */
          if (!S.kannZahlen(s, st.bauModus.kosten)) {
            st.bauModus = null;
            bauLeisteZeigen();
            UI.toast('Material aufgebraucht.', 'info');
          }
          syncBar();
          return;
        }
        openFeld(f.x, f.y);
      },
      onMove: function (p) {
        if (!st.bauModus || !st.s) { st.zeiger.x = -1; return; }
        var f = feldBei(p.x, p.y);
        if (!f) { st.zeiger.x = -1; return; }
        st.zeiger.x = f.x;
        st.zeiger.y = f.y;
        st.zeiger.ok = !S.darfBauen(st.s, st.s.aktiv, f.x, f.y, st.bauModus)
          && S.kannZahlen(st.s, st.bauModus.kosten);
      },
    });

    /* ---------------------------------------------------------- Schleife */

    function draw() {
      var s = st.s;
      if (!s) return;
      R.zeichnen(ctx, s, stage.w, stage.h, st.t,
        st.bauModus && st.zeiger.x >= 0 ? st.zeiger : null);
    }

    var loop = host.loop({
      update: function (dt) {
        var s = st.s;
        if (!s) return;
        st.t += dt;
        S.step(s, dt);

        if (s.hoechsteStufe > st.gemeldeteStufe) {
          st.gemeldeteStufe = s.hoechsteStufe;
          host.setStat('rang', s.hoechsteStufe);
          if (s.hoechsteStufe > 0) {
            host.meilenstein('rang' + s.hoechsteStufe, 40 + s.hoechsteStufe * 30,
              D.STUFEN[s.hoechsteStufe].name);
          }
        }
        host.setStat('inseln', s.entdeckt.length);
        host.setStat('bewohner', Math.floor(s.bewohner));
      },
      render: function () {
        draw();
        syncBar();
        alertsTakt();
      },
    });
    host.pauseTool(loop);

    /* ---------------------------------------------------------- Start */

    if (!load(st.slot)) {
      st.s = S.create((Date.now() ^ (Math.random() * 1e9)) >>> 0);
      st.gemeldeteStufe = 0;
      host.after(function () { zeigeAnleitung(); }, 400);
    }
    syncBar();
    draw();

    if (SG.storage.volatile && !(SG.selftest && SG.selftest.active)) {
      UI.toast('Dieses Gerät speichert nicht dauerhaft — Spielstand-Code nutzen.',
        'bad', 5000);
    }

    return {
      state: function () { return st.s; },

      selftest: function (schritte) {
        /* Bewusst von vorn: ein geladener Stand koennte schon jedes Feld
           bebaut haben, und dann prueft der Test nichts mehr. */
        S.kartenLeeren();
        var s = S.create(20240610);
        st.s = s;
        s.pausiert = false;
        s.tempo = 4;

        /* Grosszuegig Material, dann auf jedes passende Feld etwas
           bauen - so kommt jede Bauregel und jede Kette einmal dran. */
        D.WAREN.forEach(function (w) { s.lager[w.id] = 5000; });

        var gebaut = 0;
        for (var y = 0; y < D.HOEHE; y++) {
          for (var x = 0; x < D.BREITE; x++) {
            for (var i = 0; i < D.GEBAEUDE.length; i++) {
              var def = D.GEBAEUDE[(i + x + y) % D.GEBAEUDE.length];
              if (!S.darfBauen(s, 'heim', x, y, def)) {
                S.bauen(s, 'heim', x, y, def.id);
                gebaut++;
                break;
              }
            }
          }
        }
        if (!gebaut) throw new Error('Auf der Startinsel liess sich nichts bauen');

        s.bewohner = 80;
        var n = Math.max(300, schritte || 900);
        for (i = 0; i < n; i++) {
          S.step(s, 1 / 30);
          if (i % 120 === 0) { draw(); syncBar(); }
        }

        /* Eine Fahrt muss auch gehen */
        s.lager.nahrung = 5000;
        s.lager.werkzeug = 500;
        s.lager.stoff = 500;
        if (S.zaehlen(s, 'hafen')) {
          S.fahrtStarten(s, 'kiefern');
          for (i = 0; i < 400; i++) S.step(s, 1 / 30);
        }

        var roh = S.serialize(s);
        var zurueck = S.deserialize(roh);
        if (!zurueck) throw new Error('Spielstand liess sich nicht laden');
        if (zurueck.entdeckt.length !== s.entdeckt.length) {
          throw new Error('Inseln nach dem Laden');
        }
        if (Object.keys(zurueck.inseln.heim.bauten).length
            !== Object.keys(s.inseln.heim.bauten).length) {
          throw new Error('Gebäude nach dem Laden');
        }

        st.s = s;
        syncBar();
        draw();
      },
    };
  }

  /* ---------------------------------------------------------- Erfolge */

  SG.fortschritt.anhaengen([
    SG.fortschritt.E('insel_dorf', '🏠', 'Erstes Dorf',
      'Bring die Ankerbucht in Island Quest auf 60 Bewohner.', 70,
      function (u) { return u.zaehler('inseltycoon', 'bewohner') >= 60; },
      { spiel: 'inseltycoon' }),
    SG.fortschritt.E('insel_zweite', '⛵', 'Land in Sicht',
      'Entdecke eine zweite Insel.', 90,
      function (u) { return u.zaehler('inseltycoon', 'inseln') >= 2; },
      { spiel: 'inseltycoon' }),
    SG.fortschritt.E('insel_vier', '🗺', 'Inselgruppe',
      'Entdecke vier Inseln.', 180,
      function (u) { return u.zaehler('inseltycoon', 'inseln') >= 4; },
      { spiel: 'inseltycoon' }),
    SG.fortschritt.E('insel_goldriff', '✨', 'Goldriff',
      'Erreiche das Goldriff — die letzte Insel.', 400,
      function (u) { return u.zaehler('inseltycoon', 'inseln') >= 7; },
      { spiel: 'inseltycoon' }),
    SG.fortschritt.E('insel_reich', '👑', 'Archipelreich',
      'Führe tausend Menschen über die Inseln.', 320,
      function (u) { return u.zaehler('inseltycoon', 'bewohner') >= 1100; },
      { spiel: 'inseltycoon' }),
  ]);

  /* ---------------------------------------------------------- Anmeldung */

  SG.register({
    id: 'inseltycoon',
    name: 'Island Quest',
    category: 'tycoon',
    desc: 'Sammeln, bauen, aufbrechen — sieben Inseln, eine Versorgungskette',
    tags: ['insel', 'aufbau', 'siedlung', 'erkundung', 'strategie', 'island', 'schiff'],
    heavy: false,
    credit: { icon: '💡', text: 'Idee von GenieKadaver' },
    scoreLabel: function (bests, stats) {
      if (!stats || stats.rang === undefined) return null;
      return D.STUFEN[Math.min(stats.rang, D.STUFEN.length - 1)].name;
    },
    preview: function (c, w, h) {
      c.fillStyle = '#12324a';
      c.fillRect(0, 0, w, h);

      /* Eine kleine Insel in Feldern */
      var f = Math.max(6, Math.floor(Math.min(w, h) / 9));
      var bx = Math.floor((w - f * 8) / 2);
      var by = Math.floor((h - f * 6) / 2);
      var muster = [
        '  ....  ',
        ' .wwgg. ',
        '.wwggff.',
        '.wgggff.',
        ' .ggss. ',
        '  ....  ',
      ];
      var farben = { '.': '#b8a06a', w: '#245231', g: '#3f6b3a', f: '#5c5f6b', s: '#7b7f8c' };
      for (var y = 0; y < muster.length; y++) {
        for (var x = 0; x < 8; x++) {
          var ch = muster[y][x];
          if (ch === ' ') continue;
          c.fillStyle = farben[ch];
          c.fillRect(bx + x * f, by + y * f, f - 1, f - 1);
        }
      }
      // Ein paar Gebaeude
      G.text(c, '🛖', bx + f * 3.5, by + f * 3.5, {
        font: G.font(Math.round(f * 0.9)), align: 'center', baseline: 'middle',
      });
      G.text(c, '⚓', bx + f * 1.5, by + f * 2.5, {
        font: G.font(Math.round(f * 0.8)), align: 'center', baseline: 'middle',
      });
      G.text(c, '⛵', w * 0.86, h * 0.22, {
        font: G.font(Math.round(h * 0.2)), align: 'center', baseline: 'middle',
      });
    },
    mount: mount,
  });
})(SG);
