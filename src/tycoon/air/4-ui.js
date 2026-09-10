/* ------------------------------------------------------------------
   Flughafen-Tycoon - Oberflaeche

   Oben die Kennzahlen, in der Mitte der Flughafen von oben, unten die
   Leiste: Bahnen, Gates, Anlagen, Ausbau, Linien, Personal, Finanzen,
   Statistik.

   Der Bildschirm zeigt bewusst wenig Text und viel Flughafen. Wer
   wissen will, warum gerade nichts landet, sieht es am Bild: keine
   Bahn frei, kein Gate frei, oder ein Kringel voller Warteschleife.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var G = SG.gfx;
  var UI = SG.ui;
  var A = SG.tycoon.air;
  var D = A.data;
  var S = A.sim;
  var R = A.render;

  var TEMPI = [0, 1, 2, 4];

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
      el.icon = function (t) { el.firstChild.textContent = t; };
      return el;
    }

    var rGeld = resItem('money', '€', 'Konto');
    var rPax = resItem('', '🧍', 'Passagiere/Jahr');
    var rRuf = resItem('', '⭐', 'Ruf');
    var rPuenkt = resItem('', '⏱', 'Pünktlichkeit');
    var rBewegung = resItem('', '🛫', 'Bewegungen/h');
    var rGates = resItem('', '🚪', 'Gates frei');
    var rWetter = resItem('', '☀', 'Wetter');
    var rZeit = resItem('', '📅', 'Zeit');
    var rStufe = resItem('', '🌾', 'Rang');
    [rGeld, rPax, rRuf, rPuenkt, rBewegung, rGates, rWetter, rZeit, rStufe]
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

    /* ---------------------------------------------------------- Leiste */

    function dockBtn(icon, label, onClick) {
      var b = UI.el('button.dockbtn', {
        on: { click: function () { host.sfx('click'); onClick(b); } },
      }, [UI.el('div.ic', { text: icon }), UI.el('div.lb', { text: label })]);
      dock.appendChild(b);
      return b;
    }

    dockBtn('🛬', 'Bahnen', function () { openBahnen(); });
    dockBtn('🚪', 'Gates', function () { openGates(); });
    dockBtn('🏗', 'Anlagen', function () { openAnlagen(); });
    dockBtn('📡', 'Ausbau', function () { openAusbau(); });
    var bLinien = dockBtn('🤝', 'Linien', function () { openLinien(); });
    dockBtn('👷', 'Personal', function () { openPersonal(); });
    dockBtn('💶', 'Finanzen', function () { openFinanzen(); });
    dockBtn('📊', 'Statistik', function () { openStatistik(); });

    host.tool('📖 Anleitung', function () { zeigeAnleitung(true); });
    var bSave = host.tool('💾', function () { openSaves(); });

    host.beforeExit = function () {
      if (!st.s) return true;
      save(st.slot, true);
      if (!SG.settings.get('confirmExit')) return true;
      return host.confirm('Flughafen verlassen?',
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
          : 'Der Speicher ist voll — bitte den Spielstand-Code sichern.',
          ok ? 'good' : 'bad', ok ? undefined : 5200);
      } else if (!ok && !st.saveWarned) {
        st.saveWarned = true;
        UI.toast('Der Flughafen lässt sich hier nicht sichern — bitte über '
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
                  ? D.STUFEN[raw.stufe || 0].name + ' · ' + U.euro(raw.geld || 0, true)
                    + ' · Jahr ' + (raw.jahr || 1)
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
          + 'und sobald das iPad die Seite in den Hintergrund schiebt.',
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

    /* Eine Zeile mit Knopf. Gibt der Rueckruf einen Text zurueck, ist
       das die Fehlermeldung; sonst hat es geklappt. */
    function zeile(icon, titel, unten, knopfText, machbar, onClick, extra) {
      var b = UI.btn(knopfText, function () {
        var fehler = onClick();
        if (fehler) { host.sfx('error'); UI.toast(fehler, 'bad', 2400); return; }
        host.sfx('build');
        host.buzz(12);
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

    function preis(n) { return U.euro(n, true); }

    /* ---------------------------------------------------------- Bahnen */

    function openBahnen() {
      drawer('Start- und Landebahnen', function (body) {
        var s = st.s;

        body.appendChild(UI.el('p.small.muted', {
          text: 'Die Bahnlänge entscheidet, welche Flugzeuge hier überhaupt landen '
            + 'dürfen. Jede zusätzliche Bahn erhöht die Zahl der Bewegungen pro Stunde.',
        }));

        for (var i = 0; i < s.bahnen.length; i++) {
          (function (idx) {
            var b = s.bahnen[idx];
            var stufe = D.BAHN_STUFEN[b.stufe];
            var naechste = D.BAHN_STUFEN[b.stufe + 1];
            var erlaubt = [];
            for (var k = 0; k < D.MUSTER.length; k++) {
              if (D.MUSTER[k].bahn <= stufe.laenge) erlaubt.push(D.MUSTER[k].kurz);
            }
            body.appendChild(zeile('🛬', 'Bahn ' + (idx + 1) + ' · ' + stufe.name,
              'Erlaubt: ' + (erlaubt.join(', ') || 'nichts') + '<br>'
              + (naechste ? 'Verlängerung auf ' + naechste.name + ': <b>'
                + preis(naechste.kosten) + '</b>' : 'Maximale Länge erreicht.'),
              naechste ? 'Verlängern' : '—',
              !!naechste && s.geld >= naechste.kosten,
              function () { return S.bahnVerlaengern(s, idx); }));
          })(i);
        }

        if (s.bahnen.length < 3) {
          var p = S.bahnPreis(s);
          body.appendChild(zeile('➕', 'Neue Bahn bauen',
            'Eine zweite Bahn verdoppelt die Kapazität — und die Baukosten sind '
            + 'einmalig.<br>Kosten: <b>' + preis(p) + '</b>',
            'Bauen', s.geld >= p, function () { return S.bahnBauen(s); }));
        }

        body.appendChild(UI.el('h4.pf-h', { text: 'Kapazität gerade jetzt' }));
        body.appendChild(UI.kv([
          ['Bewegungen je Stunde', U.num(S.kapazitaet(s))],
          ['davon frei', U.num(s.bewegungenFrei)],
          ['Wetter', D.wetter(s.wetter).icon + ' ' + D.wetter(s.wetter).name],
          ['Längste Bahn', D.formatBahn(S.bahnLaenge(s))],
          ['Größte Klasse', ['—', 'Turboprop', 'Regionaljet', 'Standardrumpf',
            'Großraum', 'Doppeldecker'][S.groessteKlasse(s)]],
        ]));
      });
    }

    /* ---------------------------------------------------------- Gates */

    function openGates() {
      drawer('Terminal und Gates', function (body) {
        var s = st.s;
        var plaetze = S.gatePlaetze(s);

        body.appendChild(UI.el('p.small.muted', {
          text: 'Ein Flugzeug braucht ein Gate, das mindestens so groß ist wie es '
            + 'selbst. Ist keines frei, kreist es — und irgendwann weicht es aus.',
        }));

        body.appendChild(UI.kv([
          ['Terminal', D.TERMINALS[s.terminal].name],
          ['Gate-Plätze', s.gates.length + ' von ' + plaetze + ' belegt'],
          ['Passagiere je Tag verkraftbar', U.num(Math.round(S.terminalKapazitaet(s)))],
        ]));

        var tp = S.terminalPreis(s);
        if (tp !== null) {
          body.appendChild(zeile('🏢', D.TERMINALS[s.terminal + 1].name + ' bauen',
            'Schafft Platz für ' + D.TERMINALS[s.terminal + 1].plaetze
            + ' weitere Gates und '
            + U.num(D.TERMINALS[s.terminal + 1].kapazitaet) + ' Passagiere am Tag.'
            + '<br>Kosten: <b>' + preis(tp) + '</b>',
            'Bauen', s.geld >= tp, function () { return S.terminalBauen(s); }));
        }

        body.appendChild(UI.el('h4.pf-h', { text: 'Neues Gate' }));
        D.GATE_ARTEN.forEach(function (art) {
          var p = S.gatePreis(s, art.id);
          var voll = s.gates.length >= plaetze;
          body.appendChild(zeile(art.icon, art.name,
            art.text + '<br>Für Klasse bis <b>'
            + ['Turboprop', 'Regionaljet', 'Standardrumpf', 'Großraum', 'Doppeldecker'][art.groesse - 1]
            + '</b> · Unterhalt ' + U.euro(art.unterhalt, true) + '/Monat'
            + '<br>Kosten: <b>' + preis(p) + '</b>',
            voll ? 'Kein Platz' : 'Bauen', !voll && s.geld >= p,
            function () { return S.gateBauen(s, art.id); }));
        });

        body.appendChild(UI.el('h4.pf-h', { text: 'Vorhandene Gates' }));
        var raster = UI.el('div.row.wrap', { style: { gap: '6px' } });
        s.gates.forEach(function (g, i) {
          var art = D.gateArt(g.art);
          var b = UI.btn((i + 1) + ' · ' + art.name.replace('Gate ', ''),
            function () {
              host.confirm('Gate ' + (i + 1) + ' abreißen?',
                'Du bekommst 30 % der Baukosten zurück.', 'Abreißen', true)
                .then(function (ok) {
                  if (!ok) return;
                  var fehler = S.gateAbreissen(s, i);
                  if (fehler) { UI.toast(fehler, 'bad'); return; }
                  host.sfx('thud');
                  syncBar();
                  if (st.drawer && st.drawer.rebuild) st.drawer.rebuild();
                });
            }, 'sm ghost');
          if (g.belegt !== null) b.classList.add('busy');
          raster.appendChild(b);
        });
        body.appendChild(raster);
      });
    }

    /* ---------------------------------------------------------- Anlagen */

    function openAnlagen() {
      drawer('Anlagen', function (body) {
        var s = st.s;
        body.appendChild(UI.el('p.small.muted', {
          text: 'Alles, was neben der Bahn steht. Jede Stufe bringt etwas weniger '
            + 'als die vorige — breit bauen lohnt sich mehr als hoch.',
        }));

        D.ANLAGEN.forEach(function (def) {
          var n = S.anlage(s, def.id);
          var p = S.anlagePreis(s, def.id);
          var voll = n >= def.stufen;
          body.appendChild(zeile(def.icon,
            def.name + (n ? ' · Stufe ' + n + '/' + def.stufen : ''),
            def.text + '<br>Unterhalt ' + U.euro(def.unterhalt, true) + '/Monat'
            + (voll ? '<br><b>Ausgebaut.</b>' : '<br>Kosten: <b>' + preis(p) + '</b>'),
            voll ? 'Fertig' : (n ? 'Ausbauen' : 'Bauen'),
            !voll && s.geld >= p,
            function () { return S.anlageBauen(s, def.id); }));
        });
      });
    }

    /* ---------------------------------------------------------- Ausbau */

    function openAusbau() {
      drawer('Ausbau', function (body) {
        var s = st.s;
        body.appendChild(UI.el('p.small.muted', {
          text: 'Einmalige Investitionen. Sie kosten viel und wirken dauerhaft.',
        }));

        D.AUSBAU.forEach(function (def) {
          var hat = S.hatAusbau(s, def.id);
          var gesperrt = def.braucht && !S.hatAusbau(s, def.braucht);
          body.appendChild(zeile(def.icon, def.name,
            def.text
            + (gesperrt ? '<br><b>Setzt voraus: ' + D.ausbau(def.braucht).name + '</b>' : '')
            + (hat ? '<br><b>Vorhanden.</b>' : '<br>Kosten: <b>' + preis(def.kosten) + '</b>'),
            hat ? '✓' : 'Kaufen',
            !hat && !gesperrt && s.geld >= def.kosten,
            function () { return S.ausbauKaufen(s, def.id); }));
        });
      });
    }

    /* ---------------------------------------------------------- Linien */

    function openLinien() {
      drawer('Fluggesellschaften', function (body) {
        var s = st.s;

        var offen = s.angebote.filter(function (id) { return !s.linien[id]; });
        if (offen.length) {
          body.appendChild(UI.el('h4.pf-h', { text: 'Anfragen' }));
          offen.forEach(function (id) {
            var def = D.linie(id);
            if (!def) return;
            var fehlt = null;
            if (S.bahnLaenge(s) < def.mindestBahn) {
              fehlt = 'Bahn zu kurz (braucht ' + D.formatBahn(def.mindestBahn) + ')';
            } else if (def.brauchtAusbau && !S.hatAusbau(s, def.brauchtAusbau)) {
              fehlt = 'Es fehlt: ' + D.ausbau(def.brauchtAusbau).name;
            } else if (def.brauchtAnlage && !S.anlage(s, def.brauchtAnlage)) {
              fehlt = 'Es fehlt: ' + D.anlage(def.brauchtAnlage).name;
            }
            body.appendChild(zeile(def.icon, def.name,
              def.text + '<br>' + def.fluege + ' Flüge am Tag · Entgelttarif '
              + U.num(def.tarif * 100) + ' %'
              + (fehlt ? '<br><b class="warn">' + fehlt + '</b>' : ''),
              'Annehmen', !fehlt, function () { return S.vertragAnnehmen(s, id); }));
          });
        }

        body.appendChild(UI.el('h4.pf-h', { text: 'Im Flugplan' }));
        var welche = Object.keys(s.linien);
        if (!welche.length) {
          body.appendChild(UI.empty('🛫', 'Noch niemand',
            'Ohne Fluggesellschaft landet hier nichts.'));
        }
        welche.forEach(function (id) {
          var def = D.linie(id);
          var lst = s.linien[id];
          if (!def) return;
          var zufrieden = Math.round(lst.zufrieden);
          var farbe = zufrieden > 60 ? 'good' : (zufrieden > 30 ? '' : 'bad');
          var balken = UI.el('div.row', { style: { marginTop: '6px', alignItems: 'center', gap: '8px' } }, [
            UI.bar(zufrieden / 100, farbe),
            UI.el('span.small.muted', { text: zufrieden + ' %' }),
          ]);
          body.appendChild(zeile(def.icon, def.name,
            'Zufriedenheit — sinkt bei Verspätungen, steigt bei Pünktlichkeit.<br>'
            + 'Geplant ' + def.fluege + ' Flüge/Tag, tatsächlich '
            + U.num(S.fluegeProTag(s, id), 1),
            'Kündigen', true,
            function () { return S.vertragKuendigen(s, id); }, balken));
        });

        var moeglich = S.moegliche(s).filter(function (d) {
          return offen.indexOf(d.id) < 0;
        });
        if (moeglich.length) {
          body.appendChild(UI.el('h4.pf-h', { text: 'Beobachten den Standort' }));
          moeglich.forEach(function (def) {
            body.appendChild(UI.el('div.item', null, [
              UI.el('div.thumb', { text: def.icon }),
              UI.el('div.main', null, [
                UI.el('div.t', { text: def.name }),
                UI.el('div.d', {
                  text: 'Meldet sich von selbst, wenn der Ruf stimmt. Braucht '
                    + D.formatBahn(def.mindestBahn) + ' Bahn.',
                }),
              ]),
            ]));
          });
        }

        var gesperrt = D.LINIEN.filter(function (d) {
          return !s.linien[d.id] && s.ruf < d.mindestRuf;
        });
        if (gesperrt.length) {
          body.appendChild(UI.el('h4.pf-h', { text: 'Noch außer Reichweite' }));
          gesperrt.forEach(function (def) {
            body.appendChild(UI.el('div.item', null, [
              UI.el('div.thumb', { text: '🔒' }),
              UI.el('div.main', null, [
                UI.el('div.t', { text: def.name }),
                UI.el('div.d', { text: 'Ab Ruf ' + def.mindestRuf + ' — aktuell ' + Math.round(s.ruf) + '.' }),
              ]),
            ]));
          });
        }
      });
    }

    /* ---------------------------------------------------------- Personal */

    function openPersonal() {
      drawer('Personal', function (body, self) {
        var s = st.s;

        body.appendChild(UI.el('p.small.muted', {
          text: 'Gehälter kommen monatlich. Zu wenig Personal bremst den ganzen '
            + 'Flughafen, zu viel frisst den Gewinn.',
        }));

        D.PERSONAL.forEach(function (def) {
          var n = s.personal[def.id] || 0;
          var minus = UI.btn('−', function () {
            S.einstellen(s, def.id, -1);
            host.sfx('click'); self.rebuild(); syncBar();
          }, 'sm ghost');
          var plus = UI.btn('+', function () {
            S.einstellen(s, def.id, 1);
            host.sfx('click'); self.rebuild(); syncBar();
          }, 'sm primary');
          var plus5 = UI.btn('+5', function () {
            S.einstellen(s, def.id, 5);
            host.sfx('click'); self.rebuild(); syncBar();
          }, 'sm');
          if (!n) minus.disabled = true;

          body.appendChild(UI.el('div.item', null, [
            UI.el('div.thumb', { text: def.icon }),
            UI.el('div.main', null, [
              UI.el('div.t', { text: def.name + ' · ' + n }),
              UI.el('div.d', {
                html: def.text + '<br>'
                  + U.euro(Math.round(def.gehalt * D.LOHN_STUFEN[s.lohn].f), true)
                  + ' je Kopf und Monat',
              }),
            ]),
            UI.el('div.side', { style: { display: 'flex', gap: '5px' } },
              [minus, plus, plus5]),
          ]));
        });

        body.appendChild(UI.el('h4.pf-h', { text: 'Lohnniveau' }));
        body.appendChild(UI.segRow('Bezahlung',
          'Über Tarif kostet mehr, hält aber die Leute bei Laune.',
          D.LOHN_STUFEN.map(function (l, i) { return { label: l.name, value: i }; }),
          function () { return s.lohn; },
          function (v) { s.lohn = v; self.rebuild(); syncBar(); }));

        var z = S.zufriedenheit(s);
        body.appendChild(UI.kv([
          ['Zufriedenheit', z + ' %', z > 55 ? 'good' : (z > 35 ? '' : 'bad')],
          ['Gehälter im Monat', U.euro(Math.round(gehaltSumme(s)), true)],
          ['Abfertigungstempo', U.num(S.bodenTempo(s) * 100) + ' %'],
        ]));
        if (z < 40) {
          body.appendChild(UI.el('div.notice.warn', {
            text: 'Unter 40 % Zufriedenheit wird gestreikt. Mehr Lohn oder mehr Leute.',
          }));
        }
      });
    }

    function gehaltSumme(s) {
      var g = 0;
      var f = D.LOHN_STUFEN[s.lohn].f;
      for (var id in s.personal) {
        var p = D.personal(id);
        if (p) g += p.gehalt * s.personal[id] * f;
      }
      return g;
    }

    /* ---------------------------------------------------------- Finanzen */

    function openFinanzen() {
      drawer('Finanzen', function (body, self) {
        var s = st.s;

        body.appendChild(UI.el('h4.pf-h', { text: 'Passagierentgelt' }));
        body.appendChild(UI.el('p.small.muted', {
          text: 'Was jede Fluggesellschaft je abfliegendem Passagier zahlt. Hohe '
            + 'Entgelte bringen mehr pro Kopf — aber die Linien streichen Flüge.',
        }));

        var wert = UI.el('div.tyc-hint', {
          text: s.entgelt + ' € je Passagier',
        });
        var schieber = UI.el('input', {
          type: 'range', min: String(D.ENTGELT_MIN), max: String(D.ENTGELT_MAX),
          step: '1', value: String(s.entgelt),
          style: { width: '100%' },
          on: {
            input: function () {
              S.entgeltSetzen(s, Number(schieber.value));
              wert.textContent = s.entgelt + ' € je Passagier';
              vorschau.textContent = entgeltVorschau(s);
              syncBar();
            },
          },
        });
        var vorschau = UI.el('div.small.muted', { text: entgeltVorschau(s) });
        body.appendChild(wert);
        body.appendChild(schieber);
        body.appendChild(vorschau);

        body.appendChild(UI.el('h4.pf-h', { text: 'Kredit' }));
        body.appendChild(UI.kv([
          ['Schulden', U.euro(Math.round(s.schulden), true)],
          ['Zins je Monat', U.euro(Math.round(s.schulden * D.KREDIT_ZINS), true)],
          ['Noch möglich', U.euro(S.kreditRahmen(s), true)],
        ]));

        var reihe = UI.el('div.row.wrap', { style: { gap: '6px' } });
        [1000000, 5000000, 20000000].forEach(function (b) {
          reihe.appendChild(UI.btn('+' + U.short(b), function () {
            var fehler = S.aufnehmen(s, b);
            if (fehler) { UI.toast(fehler, 'bad'); host.sfx('error'); return; }
            host.sfx('cash'); self.rebuild(); syncBar();
          }, 'sm'));
        });
        reihe.appendChild(UI.btn('Alles tilgen', function () {
          var fehler = S.tilgen(s, s.schulden);
          if (fehler) { UI.toast(fehler, 'bad'); return; }
          host.sfx('cash'); self.rebuild(); syncBar();
        }, 'sm ghost'));
        body.appendChild(reihe);

        body.appendChild(UI.el('h4.pf-h', { text: 'Laufender Monat' }));
        body.appendChild(kassenTabelle(s.einnahmen, s.kosten));

        if (s.letzterMonat) {
          var lm = s.letzterMonat;
          body.appendChild(UI.el('h4.pf-h', {
            text: 'Abschluss ' + U.MONTHS[lm.monat] + ' (Jahr ' + lm.jahr + ')',
          }));
          body.appendChild(UI.kv([
            ['Umsatz', U.euro(Math.round(lm.umsatz), true)],
            ['Gewinn nach Steuer', U.euro(Math.round(lm.gewinn), true),
              lm.gewinn >= 0 ? 'good' : 'bad'],
            ['Passagiere', U.num(lm.pax)],
            ['Bewegungen', U.num(lm.bewegungen)],
          ]));
        }
      });
    }

    function entgeltVorschau(s) {
      var f = Math.pow(D.ENTGELT_START / Math.max(1, s.entgelt), 0.5);
      return 'Die Linien fliegen dann etwa ' + U.num(f * 100) + ' % ihrer geplanten Flüge.';
    }

    function kassenTabelle(ein, aus) {
      return UI.kv([
        ['Landeentgelte', U.euro(Math.round(ein.landung), true)],
        ['Passagierentgelte', U.euro(Math.round(ein.passagier), true)],
        ['Handel', U.euro(Math.round(ein.handel), true)],
        ['Parken', U.euro(Math.round(ein.parken), true)],
        ['Kerosin', U.euro(Math.round(ein.sprit), true)],
        ['Fracht', U.euro(Math.round(ein.fracht), true)],
        ['Unterhalt', '− ' + U.euro(Math.round(aus.unterhalt), true), 'bad'],
        ['Gehälter', '− ' + U.euro(Math.round(aus.gehalt), true), 'bad'],
        ['Zinsen', '− ' + U.euro(Math.round(aus.zins), true), 'bad'],
        ['Strafen', '− ' + U.euro(Math.round(aus.strafe), true), 'bad'],
        ['Steuer', '− ' + U.euro(Math.round(aus.steuer), true), 'bad'],
      ]);
    }

    /* ---------------------------------------------------------- Statistik */

    function openStatistik() {
      drawer('Statistik', function (body) {
        var s = st.s;

        body.appendChild(UI.kv([
          ['Rang', D.STUFEN[s.stufe].icon + ' ' + D.STUFEN[s.stufe].name],
          ['Passagiere im Jahr (hochgerechnet)', U.num(S.paxProJahr(s))],
          ['Passagiere insgesamt', U.num(s.paxGesamt)],
          ['Ruf', U.num(Math.round(s.ruf)) + ' / 100'],
          ['Pünktlichkeit', U.num(Math.round(s.puenktlich)) + ' %'],
          ['Ausgewichene Flüge', U.num(s.ausfallGesamt),
            s.ausfallGesamt > 20 ? 'bad' : ''],
          ['Kapazität', U.num(S.kapazitaet(s)) + ' Bewegungen/h'],
          ['Gates', s.gates.length + ' (' + S.gatesFrei(s) + ' frei)'],
          ['Bahnen', s.bahnen.length + ' · längste ' + D.formatBahn(S.bahnLaenge(s))],
        ]));

        if (s.historie.length > 1) {
          body.appendChild(UI.el('h4.pf-h', { text: 'Gewinn je Monat' }));
          body.appendChild(UI.chart([{
            data: s.historie.map(function (h) { return h.gewinn; }),
            color: '#3ddc84',
          }], { height: 110 }));

          body.appendChild(UI.el('h4.pf-h', { text: 'Passagiere je Monat' }));
          body.appendChild(UI.chart([{
            data: s.historie.map(function (h) { return h.pax; }),
            color: '#4aa3ff',
          }], { height: 110 }));
        }

        body.appendChild(UI.el('h4.pf-h', { text: 'Nächster Rang' }));
        var n = D.STUFEN[s.stufe + 1];
        if (!n) {
          body.appendChild(UI.el('p.small.muted', {
            text: 'Höher geht es nicht. Der Flughafen ist ein Drehkreuz.',
          }));
        } else {
          body.appendChild(UI.kv([
            ['Passagiere im Jahr', U.num(S.paxProJahr(s)) + ' / ' + U.num(n.paxJahr),
              S.paxProJahr(s) >= n.paxJahr ? 'good' : ''],
            ['Ruf', Math.round(s.ruf) + ' / ' + n.ruf, s.ruf >= n.ruf ? 'good' : ''],
            ['Bahnlänge', D.formatBahn(S.bahnLaenge(s)) + ' / ' + D.formatBahn(n.bahn),
              S.bahnLaenge(s) >= n.bahn ? 'good' : ''],
            ['Gates', s.gates.length + ' / ' + n.gates,
              s.gates.length >= n.gates ? 'good' : ''],
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
        if (!s.meldungen.length) {
          log.appendChild(UI.el('div.logline', { text: 'Noch nichts passiert.' }));
        }
        body.appendChild(log);
      });
    }

    /* ---------------------------------------------------------- Anleitung */

    function zeigeAnleitung(erzwingen) {
      if (!erzwingen && st.s && st.s.tutorialGesehen) return;
      if (st.s) st.s.tutorialGesehen = true;

      var body = UI.el('div');
      [
        ['🛬', 'Bahn und Gates', 'Ein Flug braucht beides: eine freie Bahn zum Landen '
          + 'und ein Gate, das groß genug ist. Fehlt eines, kreist er — und weicht '
          + 'irgendwann aus. Das kostet Geld und Ruf.'],
        ['🤝', 'Fluggesellschaften', 'Sie fragen von selbst an, sobald der Ruf stimmt '
          + 'und die Bahn lang genug ist. Wer pünktlich abfertigt, behält sie.'],
        ['💶', 'Entgelte', 'Du legst fest, was die Linien je Passagier zahlen. Hoch '
          + 'bringt mehr pro Kopf, aber weniger Flüge. Der Rest verdient sich mit '
          + 'Läden, Parken und Kerosin.'],
        ['👷', 'Personal', 'Lotsen machen Bewegungen möglich, Bodenpersonal macht sie '
          + 'schnell. Beides kostet monatlich.'],
        ['📅', 'Zeit', 'Eine Stunde Flugbetrieb dauert zwei Sekunden. Abrechnung gibt '
          + 'es am Monatsende — bis zum ersten Gewinn dauert es.'],
      ].forEach(function (z) {
        body.appendChild(UI.el('div.item', null, [
          UI.el('div.thumb', { text: z[0] }),
          UI.el('div.main', null, [
            UI.el('div.t', { text: z[1] }),
            UI.el('div.d', { text: z[2] }),
          ]),
        ]));
      });
      host.modal({ title: 'Flughafen-Tycoon', body: body, actions: [{ label: 'Los geht’s', cls: 'primary' }] });
    }

    /* ---------------------------------------------------------- Meldungen */

    function alertsTakt() {
      var s = st.s;
      if (!s) return;
      // Neueste Meldung einmal einblenden
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

      rGeld.set(U.euro(Math.round(s.geld), true));
      rGeld.tint(s.geld < 0 ? 'var(--red)' : '');
      rPax.set(U.short(S.paxProJahr(s)));
      rRuf.set(Math.round(s.ruf) + ' / 100');
      rRuf.tint(s.ruf > 55 ? 'var(--green)' : (s.ruf < 20 ? 'var(--red)' : ''));
      rPuenkt.set(Math.round(s.puenktlich) + ' %');
      rPuenkt.tint(s.puenktlich > 85 ? 'var(--green)'
        : (s.puenktlich < 60 ? 'var(--red)' : ''));
      rBewegung.set(s.bewegungenFrei + ' / ' + S.kapazitaet(s));
      var frei = S.gatesFrei(s);
      rGates.set(frei + ' / ' + s.gates.length);
      rGates.tint(frei === 0 ? 'var(--red)' : '');

      var w = D.wetter(s.wetter);
      rWetter.icon(w.icon);
      rWetter.set(w.name);

      var std = Math.floor(s.uhr);
      rZeit.set(('0' + std).slice(-2) + ':' + ('0' + Math.floor((s.uhr - std) * 60)).slice(-2)
        + ' · ' + s.tag + '. ' + U.MONTHS_S[s.monat]);
      rStufe.icon(D.STUFEN[s.stufe].icon);
      rStufe.set(D.STUFEN[s.stufe].name);

      var offeneAnfragen = s.angebote.filter(function (id) { return !s.linien[id]; }).length;
      var mark = bLinien.querySelector('.dotmark');
      if (offeneAnfragen && !mark) bLinien.appendChild(UI.el('span.dotmark'));
      if (!offeneAnfragen && mark) UI.remove(mark);

      syncSpeeds();
    }

    /* ---------------------------------------------------------- Zeichnen */

    function draw() {
      var s = st.s;
      if (!s) return;
      R.zeichnen(ctx, s, stage.w, stage.h, st.t);
    }

    /* ---------------------------------------------------------- Antippen */

    host.inputOn(stage.el, {
      onTap: function (px, py) {
        var s = st.s;
        if (!s) return;
        var skala = Math.min(stage.w / R.WELT_B, stage.h / R.WELT_H);
        var ox = (stage.w - R.WELT_B * skala) / 2;
        var oy = (stage.h - R.WELT_H * skala) / 2;
        var wx = (px - ox) / skala;
        var wy = (py - oy) / skala;

        var g = R.gateBei(s, wx, wy);
        if (g >= 0) {
          var art = D.gateArt(s.gates[g].art);
          var belegt = s.gates[g].belegt;
          UI.toast('Gate ' + (g + 1) + ' · ' + art.name
            + (belegt === null ? ' · frei' : ' · belegt'), 'info');
          host.sfx('blip');
          return;
        }
        openGates();
      },
    });

    /* ---------------------------------------------------------- Schleife */

    var loop = host.loop({
      update: function (dt) {
        var s = st.s;
        if (!s) return;
        st.t += dt;
        S.step(s, dt);

        /* Rang gestiegen? Das ist im Hideout eine Stufe wert. */
        if (s.hoechsteStufe > st.gemeldeteStufe) {
          st.gemeldeteStufe = s.hoechsteStufe;
          host.setStat('rang', s.hoechsteStufe);
          host.setStat('pax', s.paxGesamt);
          if (s.hoechsteStufe > 0) {
            host.meilenstein('rang' + s.hoechsteStufe, 40 + s.hoechsteStufe * 30,
              D.STUFEN[s.hoechsteStufe].name);
          }
        }
        host.setStat('pax', s.paxGesamt);
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

      /* Fuer den Selbsttest: ein paar Tage im Zeitraffer, damit Fluege,
         Monatsabschluss und Wetter wirklich einmal durchlaufen. */
      selftest: function (schritte) {
        var s = st.s;
        s.pausiert = false;
        s.tempo = 4;

        /* Bauen, damit auch die grossen Muster vorkommen */
        s.geld = 900000000;
        S.bahnVerlaengern(s, 0);
        S.bahnVerlaengern(s, 0);
        S.bahnVerlaengern(s, 0);
        S.bahnBauen(s);
        S.terminalBauen(s);
        S.gateBauen(s, 'mittel');
        S.gateBauen(s, 'gross');
        S.anlageBauen(s, 'laden');
        S.anlageBauen(s, 'parken');
        S.anlageBauen(s, 'feuerwehr');
        S.anlageBauen(s, 'fracht');
        S.ausbauKaufen(s, 'zoll');
        S.vertragAnnehmen(s, 'nordluft');
        S.vertragAnnehmen(s, 'billigflug');
        S.entgeltSetzen(s, 14);

        var n = Math.max(400, schritte || 1200);
        for (var i = 0; i < n; i++) {
          S.step(s, 1 / 30);
          if (i % 90 === 0) { draw(); syncBar(); }
        }

        /* Sichern und zuruecklesen - der Stand muss die Reise ueberleben */
        var roh = S.serialize(s);
        var zurueck = S.deserialize(roh);
        if (!zurueck) throw new Error('Spielstand liess sich nicht laden');
        if (Math.round(zurueck.geld) !== Math.round(s.geld)) {
          throw new Error('Kasse nach dem Laden');
        }
        if (zurueck.gates.length !== s.gates.length) throw new Error('Gates nach dem Laden');
        if (zurueck.bahnen.length !== s.bahnen.length) throw new Error('Bahnen nach dem Laden');

        st.s = s;
        syncBar();
        draw();
      },
    };
  }

  /* ---------------------------------------------------------- Erfolge */

  SG.fortschritt.anhaengen([
    SG.fortschritt.E('air_start', '🛩', 'Erster Flugplan',
      'Nimm im Flughafen-Tycoon die erste Fluggesellschaft unter Vertrag.', 50,
      function (u) { return u.gespielt('airtycoon') >= 1 || u.partien('airtycoon') >= 1; },
      { spiel: 'airtycoon' }),
    SG.fortschritt.E('air_regional', '✈', 'Regionalflughafen',
      'Erreiche den Rang Regionalflughafen.', 90,
      function (u) { return u.zaehler('airtycoon', 'rang') >= 1; }, { spiel: 'airtycoon' }),
    SG.fortschritt.E('air_international', '🌍', 'Internationaler Flughafen',
      'Erreiche den Rang Internationaler Flughafen.', 220,
      function (u) { return u.zaehler('airtycoon', 'rang') >= 3; }, { spiel: 'airtycoon' }),
    SG.fortschritt.E('air_drehkreuz', '🌐', 'Drehkreuz',
      'Bau den Flughafen bis zum Drehkreuz aus.', 500,
      function (u) { return u.zaehler('airtycoon', 'rang') >= 5; }, { spiel: 'airtycoon' }),
    SG.fortschritt.E('air_million', '🧍', 'Eine Million Passagiere',
      'Fertige insgesamt eine Million Passagiere ab.', 180,
      function (u) { return u.zaehler('airtycoon', 'pax') >= 1000000; }, { spiel: 'airtycoon' }),
  ]);

  /* ---------------------------------------------------------- Anmeldung */

  SG.register({
    id: 'airtycoon',
    name: 'Flughafen-Tycoon',
    category: 'tycoon',
    desc: 'Vom Landeplatz zum Drehkreuz — Bahnen, Gates, Linien, Entgelte',
    tags: ['flughafen', 'flugzeug', 'aufbau', 'wirtschaft', 'airport', 'tycoon', 'gates'],
    heavy: false,
    credit: { icon: '💡', text: 'Idee von GenieKadaver' },
    scoreLabel: function (bests, stats) {
      if (!stats || stats.rang === undefined) return null;
      return D.STUFEN[Math.min(stats.rang, D.STUFEN.length - 1)].name;
    },
    preview: function (c, w, h) {
      c.fillStyle = '#0d1017';
      c.fillRect(0, 0, w, h);

      // Gras
      c.fillStyle = '#16241a';
      c.fillRect(0, h * 0.34, w, h * 0.66);

      // Bahn
      c.fillStyle = '#2b3040';
      c.fillRect(w * 0.06, h * 0.42, w * 0.88, h * 0.15);
      c.save();
      c.strokeStyle = 'rgba(255,255,255,.42)';
      c.lineWidth = 1.6;
      c.setLineDash([7, 6]);
      c.beginPath();
      c.moveTo(w * 0.12, h * 0.495);
      c.lineTo(w * 0.88, h * 0.495);
      c.stroke();
      c.restore();

      // Terminal mit Gates
      c.fillStyle = '#2e3852';
      G.fillRound(c, w * 0.14, h * 0.74, w * 0.72, h * 0.16, 4, '#2e3852');
      c.fillStyle = 'rgba(240,180,41,.35)';
      for (var x = w * 0.18; x < w * 0.82; x += w * 0.06) {
        c.fillRect(x, h * 0.77, w * 0.03, h * 0.045);
      }
      c.fillStyle = '#232c40';
      for (var i = 0; i < 4; i++) {
        G.fillRound(c, w * (0.17 + i * 0.18), h * 0.63, w * 0.13, h * 0.08, 3, '#232c40');
      }

      // Himmel-Flieger
      A.render.flugzeug(c, w * 0.62, h * 0.495, 3, 0, '#dbe3f2', h / 60);
      A.render.flugzeug(c, w * 0.24, h * 0.2, 4, 0.12, 'rgba(219,227,242,.75)', h / 72);

      G.text(c, '✈', w * 0.9, h * 0.16, {
        font: G.font(Math.round(h * 0.18)), fill: 'rgba(240,180,41,.85)',
        align: 'center', baseline: 'middle',
      });
    },
    mount: mount,
  });
})(SG);
