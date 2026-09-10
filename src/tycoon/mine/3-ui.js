/* ------------------------------------------------------------------
   Mining-Tycoon - Bild und Oberflaeche

   Der Schacht wird im Querschnitt gezeichnet: oben das Foerdergeruest,
   darunter die Schichten in ihren Farben, an jeder Sohle die Geraete.
   Man sieht, wie tief man ist und was dort liegt - das ist die halbe
   Motivation, weiterzugraben.

   Antippen des Stosses foerdert von Hand. Am Anfang ist das der ganze
   Betrieb, spaeter nur noch ein Zubrot - so soll es sein.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var G = SG.gfx;
  var UI = SG.ui;
  var M = SG.tycoon.mine;
  var D = M.data;
  var S = M.sim;

  var TEMPI = [0, 1, 2, 4];

  var WELT_B = 900;

  /* ------------------------------------------------------------------
     Zeichnen
     ------------------------------------------------------------------ */

  var R = M.render = {};

  R.METER_PRO_PIXEL = 0.9;      // wie stark der Schacht gestaucht wird

  /* Bildhoehe eines Meters, damit auch ein tiefes Bergwerk aufs Bild passt */
  function skalaFuer(tiefe, hoehe) {
    var nutz = hoehe - 120;
    return U.clamp(nutz / Math.max(60, tiefe + 40), 0.06, 1.6);
  }

  R.zeichnen = function (c, s, breite, hoehe, zeit) {
    c.fillStyle = '#0a0d14';
    c.fillRect(0, 0, breite, hoehe);

    var mps = skalaFuer(s.tiefe, hoehe);       // Pixel je Meter
    var himmel = 74;                            // Hoehe der Tagesoberflaeche
    var mitte = breite / 2;
    var schachtB = Math.max(54, Math.min(120, breite * 0.13));

    /* --- Himmel --- */
    c.fillStyle = G.linear(c, 0, 0, 0, himmel, [0, '#16202e', 1, '#22303f']);
    c.fillRect(0, 0, breite, himmel);

    /* --- Schichten --- */
    var y = himmel;
    for (var i = 0; i < D.SCHICHTEN.length; i++) {
      var sch = D.SCHICHTEN[i];
      var vonTiefe = i === 0 ? 0 : D.SCHICHTEN[i - 1].bis;
      if (vonTiefe > s.tiefe + 60) break;
      var bisTiefe = Math.min(sch.bis, s.tiefe + 60);
      var h = (bisTiefe - vonTiefe) * mps;
      if (h <= 0) continue;

      c.fillStyle = sch.farbe;
      c.fillRect(0, y, breite, h);

      // Koernung, damit der Fels nicht wie eine Farbfläche wirkt
      c.fillStyle = 'rgba(0,0,0,.16)';
      for (var k = 0; k < Math.min(90, h * 1.2); k++) {
        var px = ((k * 137 + i * 61) % breite);
        var py = y + ((k * 89 + i * 37) % Math.max(1, h));
        c.fillRect(px, py, 3, 2);
      }

      // Trennlinie und Beschriftung
      c.fillStyle = 'rgba(0,0,0,.35)';
      c.fillRect(0, y, breite, 1.5);
      if (h > 16) {
        G.text(c, sch.icon + ' ' + sch.name, 10, y + 12, {
          font: G.font(11, 700), fill: 'rgba(255,255,255,.5)', baseline: 'middle',
        });
        G.text(c, D.formatTiefe(vonTiefe), breite - 10, y + 12, {
          font: G.font(10, 600), fill: 'rgba(255,255,255,.3)',
          align: 'right', baseline: 'middle',
        });
      }
      y += h;
    }

    /* --- Halde und Foerdergeruest --- */
    c.fillStyle = '#1d2735';
    c.fillRect(0, himmel - 8, breite, 8);

    var gY = himmel - 8;
    c.strokeStyle = '#6c7796';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(mitte - 26, gY);
    c.lineTo(mitte - 12, gY - 52);
    c.lineTo(mitte + 12, gY - 52);
    c.lineTo(mitte + 26, gY);
    c.moveTo(mitte - 19, gY - 26);
    c.lineTo(mitte + 19, gY - 26);
    c.stroke();
    // Seilscheibe, dreht sich, wenn gefoerdert wird
    var dreh = S.effektiv(s) > 0 && !s.pausiert ? zeit * 3 : 0;
    c.save();
    c.translate(mitte, gY - 54);
    c.rotate(dreh);
    c.strokeStyle = '#f0b429';
    c.lineWidth = 2.5;
    c.beginPath();
    c.arc(0, 0, 11, 0, Math.PI * 2);
    c.moveTo(-11, 0); c.lineTo(11, 0);
    c.moveTo(0, -11); c.lineTo(0, 11);
    c.stroke();
    c.restore();

    /* --- Schacht --- */
    var schachtH = s.tiefe * mps;
    c.fillStyle = '#0c0f16';
    c.fillRect(mitte - schachtB / 2, himmel, schachtB, schachtH);
    c.strokeStyle = 'rgba(240,180,41,.22)';
    c.lineWidth = 1.5;
    c.strokeRect(mitte - schachtB / 2, himmel, schachtB, schachtH);

    // Foerderkorb
    var korbT = (Math.sin(zeit * 0.8) * 0.5 + 0.5) * s.tiefe;
    var korbY = himmel + korbT * mps;
    c.fillStyle = '#f0b429';
    c.fillRect(mitte - 7, korbY - 5, 14, 10);
    c.strokeStyle = 'rgba(240,180,41,.5)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(mitte, himmel);
    c.lineTo(mitte, korbY);
    c.stroke();

    /* --- Sohlen --- */
    R.sohlenFelder = [];
    for (i = 0; i < s.sohlen.length; i++) {
      var so = s.sohlen[i];
      var sy = himmel + so.tiefe * mps;
      if (sy > hoehe + 20) continue;

      var strebB = Math.min(breite * 0.34, 210);
      var links = mitte - schachtB / 2 - strebB;
      var rechts = mitte + schachtB / 2;
      var sh = Math.max(14, Math.min(30, 22 * Math.min(1, mps * 2)));

      c.fillStyle = '#0e1219';
      c.fillRect(links, sy - sh / 2, strebB, sh);
      c.fillRect(rechts, sy - sh / 2, strebB, sh);
      c.strokeStyle = 'rgba(255,255,255,.09)';
      c.lineWidth = 1;
      c.strokeRect(links, sy - sh / 2, strebB, sh);
      c.strokeRect(rechts, sy - sh / 2, strebB, sh);

      R.sohlenFelder.push({
        index: i,
        x: links, y: sy - sh / 2, w: strebB * 2 + schachtB, h: sh,
      });

      if (sh >= 16) {
        // Geraete als kleine Zeichen in der Strebe
        var x = links + 6;
        for (var id in so.geraete) {
          var def = D.geraet(id);
          if (!def) continue;
          var txt = def.icon + (so.geraete[id] > 1 ? '·' + so.geraete[id] : '');
          G.text(c, txt, x, sy, {
            font: G.font(Math.round(sh * 0.55), 600), fill: '#c8cdd8', baseline: 'middle',
          });
          x += c.measureText(txt).width + 8;
          if (x > links + strebB - 10) break;
        }
        G.text(c, D.formatTiefe(so.tiefe), rechts + strebB - 6, sy, {
          font: G.font(Math.round(sh * 0.45), 600), fill: '#6c7796',
          align: 'right', baseline: 'middle',
        });
      }
    }

    /* --- Es wird geteuft --- */
    if (s.teufen) {
      var ty = himmel + s.tiefe * mps;
      var puls = 0.5 + Math.sin(zeit * 6) * 0.5;
      c.fillStyle = 'rgba(240,180,41,' + (0.25 + puls * 0.35) + ')';
      c.fillRect(mitte - schachtB / 2, ty, schachtB, 10);
      G.text(c, '⏬ ' + D.formatTiefe(s.tiefe) + ' → ' + D.formatTiefe(s.teufenZiel),
        mitte, ty + 24, {
          font: G.font(12, 700), fill: '#f0b429', align: 'center', baseline: 'middle',
        });
    }

    /* --- Der Stoss zum Antippen --- */
    var stossY = himmel + s.tiefe * mps + (s.teufen ? 30 : 12);
    if (stossY < hoehe - 24) {
      G.text(c, '⛏ Antippen zum Hauen', mitte, stossY + 12, {
        font: G.font(12, 600), fill: 'rgba(255,255,255,.42)',
        align: 'center', baseline: 'middle',
      });
    }
    R.stossFeld = { x: 0, y: himmel, w: breite, h: hoehe - himmel };
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
      gemeldeterRang: -1,
      pop: [],
      sohle: 0,
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
    var rTiefe = resItem('', '⬇', 'Tiefe');
    var rSchicht = resItem('', '🪨', 'Schicht');
    var rLeistung = resItem('', '⛏', 'Abbau t/Schicht');
    var rFoerder = resItem('', '🛗', 'Förderung t/Schicht');
    var rLager = resItem('', '📦', 'Halde');
    var rZufrieden = resItem('', '🦺', 'Belegschaft');
    var rZeit = resItem('', '📅', 'Zeit');
    var rRang = resItem('', '⛏', 'Rang');
    [rGeld, rTiefe, rSchicht, rLeistung, rFoerder, rLager, rZufrieden, rZeit, rRang]
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

    function dockBtn(icon, label, onClick) {
      var b = UI.el('button.dockbtn', {
        on: { click: function () { host.sfx('click'); onClick(b); } },
      }, [UI.el('div.ic', { text: icon }), UI.el('div.lb', { text: label })]);
      dock.appendChild(b);
      return b;
    }

    dockBtn('⛏', 'Geräte', function () { openGeraete(); });
    dockBtn('⏬', 'Schacht', function () { openSchacht(); });
    dockBtn('🛗', 'Förderung', function () { openFoerderung(); });
    dockBtn('🧯', 'Technik', function () { openTechnik(); });
    dockBtn('🔬', 'Forschung', function () { openForschung(); });
    dockBtn('👷', 'Personal', function () { openPersonal(); });
    dockBtn('📈', 'Markt', function () { openMarkt(); });
    dockBtn('📊', 'Statistik', function () { openStatistik(); });

    host.tool('📖 Anleitung', function () { zeigeAnleitung(true); });
    var bSave = host.tool('💾', function () { openSaves(); });

    host.beforeExit = function () {
      if (!st.s) return true;
      save(st.slot, true);
      if (!SG.settings.get('confirmExit')) return true;
      return host.confirm('Bergwerk verlassen?',
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
        UI.toast('Das Bergwerk lässt sich hier nicht sichern — bitte über '
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
      st.gemeldeterRang = s.hoechsterRang;
      st.sohle = Math.min(st.sohle, s.sohlen.length - 1);
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
                  ? D.formatTiefe(raw.tiefe || 0) + ' · ' + U.euro(raw.geld || 0, true)
                    + ' · Woche ' + (raw.woche || 1)
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
        text: 'Automatisch gesichert wird alle 20 Sekunden, außerdem beim Verlassen.',
      }));
      body.appendChild(UI.btn('Neu anfangen', function () {
        m.close();
        host.confirm('Von vorn anfangen?',
          'Der Stand in Platz ' + st.slot + ' wird überschrieben.', 'Neu starten', true)
          .then(function (ok) {
            if (!ok) return;
            st.s = S.create((Date.now() ^ (Math.random() * 1e9)) >>> 0);
            st.gemeldeterRang = 0;
            st.sohle = 0;
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

    /* ---------------------------------------------------------- Geraete */

    var kaufMenge = 1;

    function openGeraete() {
      drawer('Geräte', function (body, self) {
        var s = st.s;

        /* Auf welcher Sohle wird gekauft? */
        var wahl = UI.el('div.row.wrap', { style: { gap: '6px', marginBottom: '10px' } });
        s.sohlen.forEach(function (so, i) {
          var b = UI.btn(D.formatTiefe(so.tiefe), function () {
            st.sohle = i; self.rebuild();
          }, 'sm' + (st.sohle === i ? ' primary' : ' ghost'));
          wahl.appendChild(b);
        });
        body.appendChild(UI.el('div.small.muted', { text: 'Sohle' }));
        body.appendChild(wahl);

        var mengen = UI.el('div.row.wrap', { style: { gap: '6px', marginBottom: '12px' } });
        [1, 10, 'max'].forEach(function (m) {
          mengen.appendChild(UI.btn(m === 'max' ? 'max' : '×' + m, function () {
            kaufMenge = m; self.rebuild();
          }, 'sm' + (kaufMenge === m ? ' primary' : ' ghost')));
        });
        body.appendChild(mengen);

        var sohle = s.sohlen[st.sohle];
        if (!sohle) { body.appendChild(UI.empty('⛏', 'Keine Sohle')); return; }
        var haerte = D.schichtBei(sohle.tiefe).haerte;

        D.GERAETE.forEach(function (def) {
          var n = 0;
          for (var i = 0; i < s.sohlen.length; i++) n += s.sohlen[i].geraete[def.id] || 0;
          var hier = sohle.geraete[def.id] || 0;
          var menge = kaufMenge === 'max'
            ? Math.max(1, S.maxGeraete(s, def.id, 200)) : kaufMenge;
          var p = 0;
          for (i = 0; i < menge; i++) {
            p += Math.round(def.kosten * Math.pow(def.steigerung, n + i));
          }

          body.appendChild(zeile(def.icon,
            def.name + (hier ? ' · ' + hier + ' hier' : ''),
            def.text + '<br>Löst <b>' + U.num(def.leistung / haerte, 1)
            + ' t</b> je Schicht in dieser Schicht · ' + def.mann + ' Mann · '
            + def.strom + ' kW'
            + '<br>' + (menge > 1 ? menge + ' Stück: ' : '') + '<b>' + preis(p) + '</b>',
            kaufMenge === 'max' ? 'max ' + menge : 'Kaufen',
            s.geld >= p && menge > 0,
            function () { return S.geraetKaufen(s, st.sohle, def.id, menge); }));
        });
      });
    }

    /* ---------------------------------------------------------- Schacht */

    function openSchacht() {
      drawer('Schacht', function (body) {
        var s = st.s;
        var schicht = D.schichtBei(s.tiefe);
        var naechste = D.SCHICHTEN[D.schichtIndex(s.tiefe) + 1];

        body.appendChild(UI.kv([
          ['Tiefe', D.formatTiefe(s.tiefe)],
          ['Schicht', schicht.icon + ' ' + schicht.name],
          ['Härte', U.num(schicht.haerte, 2) + '×'],
          ['Sohlen', String(s.sohlen.length)],
        ]));
        body.appendChild(UI.el('p.small.muted', { text: schicht.text }));

        body.appendChild(UI.el('h4.pf-h', { text: 'Was hier liegt' }));
        var liste = UI.el('div.tagline');
        for (var id in schicht.anteile) {
          var r = D.rohstoff(id);
          liste.appendChild(UI.el('span.tag', {
            text: r.icon + ' ' + r.name + ' ' + Math.round(schicht.anteile[id] * 100) + ' %',
          }));
        }
        body.appendChild(liste);

        var fehlt = S.fehlendeTechnik(s);
        if (fehlt.length) {
          body.appendChild(UI.el('div.notice.warn', {
            html: '<b>Hier fehlt Technik.</b> ' + fehlt.map(function (f) {
              return D.technik(f.id).name + ' (Stufe ' + f.haben + ' von ' + f.braucht + ')';
            }).join(', ') + '. Die Leistung liegt bei nur '
              + U.num(S.technikFaktor(s) * 100) + ' %.',
          }));
        }

        body.appendChild(UI.el('h4.pf-h', { text: 'Tiefer teufen' }));
        if (s.teufen) {
          body.appendChild(UI.el('p.small.muted', {
            text: 'Der Schacht wird gerade auf ' + D.formatTiefe(s.teufenZiel)
              + ' vorgetrieben — noch ' + D.formatTiefe(s.teufenZiel - s.tiefe) + '.',
          }));
          body.appendChild(UI.bar((s.tiefe - (s.teufenZiel - D.SOHLE_ABSTAND))
            / D.SOHLE_ABSTAND));
        } else {
          var kosten = S.teufenKosten(s);
          body.appendChild(zeile('⏬', 'Um ' + D.SOHLE_ABSTAND + ' m tiefer',
            'Neue Sohle bei ' + D.formatTiefe(s.tiefe + D.SOHLE_ABSTAND) + '.'
            + (naechste && s.tiefe + D.SOHLE_ABSTAND > schicht.bis
              ? '<br><b>Dort beginnt: ' + naechste.icon + ' ' + naechste.name + '</b>'
                + (naechste.verlangt ? '<br>Verlangt: ' + Object.keys(naechste.verlangt)
                  .map(function (k) {
                    return D.technik(k).name + ' Stufe ' + naechste.verlangt[k];
                  }).join(', ') : '')
              : '')
            + '<br>Kosten: <b>' + preis(kosten) + '</b> · Tempo '
            + U.num(S.teufenTempo(s), 1) + ' m je Schicht',
            'Teufen', s.geld >= kosten, function () { return S.teufenStarten(s); }));
        }

        body.appendChild(UI.el('h4.pf-h', { text: 'Alle Schichten' }));
        D.SCHICHTEN.forEach(function (sch, i) {
          var von = i === 0 ? 0 : D.SCHICHTEN[i - 1].bis;
          var erreicht = s.tiefe >= von;
          var punkt = UI.el('div.thumb', { text: erreicht ? sch.icon : '🔒' });
          punkt.style.background = erreicht ? sch.farbe : '';
          body.appendChild(UI.el('div.item' + (erreicht ? '' : '.zu'), null, [
            punkt,
            UI.el('div.main', null, [
              UI.el('div.t', { text: sch.name }),
              UI.el('div.d', {
                text: D.formatTiefe(von) + ' bis '
                  + (sch.bis > 5000 ? 'tiefer' : D.formatTiefe(sch.bis))
                  + ' · ' + (erreicht ? sch.text : 'Noch nicht erreicht.'),
              }),
            ]),
          ]));
        });
      });
    }

    /* ---------------------------------------------------------- Foerderung */

    function openFoerderung() {
      drawer('Förderung', function (body) {
        var s = st.s;
        var jetzt = D.FOERDERUNG[s.foerderStufe];
        var eng = S.engpass(s) === 'foerder';

        body.appendChild(UI.el('p.small.muted', {
          text: 'Was unten gelöst wird, muss auch nach oben. Ist die Förderung '
            + 'zu klein, bleibt der Rest liegen — gefördert wird immer nur das '
            + 'Kleinere von beidem.',
        }));

        body.appendChild(UI.kv([
          ['Anlage', jetzt.icon + ' ' + jetzt.name],
          ['Schafft', U.num(S.foerderMenge(s)) + ' t je Schicht'],
          ['Abbau leistet', U.num(S.leistung(s)) + ' t je Schicht'],
          ['Engpass', eng ? 'Die Förderung' : 'Der Abbau', eng ? 'bad' : 'good'],
        ]));

        if (eng) {
          body.appendChild(UI.el('div.notice.warn', {
            html: '<b>Die Förderung bremst.</b> Jede weitere Maschine unten bringt '
              + 'gerade nichts.',
          }));
        }

        var p = S.foerderPreis(s);
        if (p === null) {
          body.appendChild(UI.el('p.small.muted', { text: 'Weiter geht es nicht.' }));
        } else {
          var n = D.FOERDERUNG[s.foerderStufe + 1];
          body.appendChild(zeile(n.icon, n.name,
            'Schafft <b>' + U.num(n.menge) + ' t</b> je Schicht · ' + n.strom + ' kW'
            + '<br>Kosten: <b>' + preis(p) + '</b>',
            'Ausbauen', s.geld >= p, function () { return S.foerderAusbauen(s); }));
        }

        body.appendChild(UI.el('h4.pf-h', { text: 'Ausbaustufen' }));
        D.FOERDERUNG.forEach(function (f, i) {
          body.appendChild(UI.el('div.item' + (i <= s.foerderStufe ? '' : '.zu'), null, [
            UI.el('div.thumb', { text: i <= s.foerderStufe ? f.icon : '🔒' }),
            UI.el('div.main', null, [
              UI.el('div.t', { text: f.name }),
              UI.el('div.d', { text: U.num(f.menge) + ' t je Schicht' }),
            ]),
          ]));
        });
      });
    }

    /* ---------------------------------------------------------- Technik */

    function openTechnik() {
      drawer('Technik', function (body) {
        var s = st.s;
        var schicht = D.schichtBei(s.tiefe);
        var verlangt = schicht.verlangt || {};

        body.appendChild(UI.el('p.small.muted', {
          text: 'Jede Schicht ab dem Kohleflöz verlangt etwas: erst Pumpen, dann '
            + 'Stützen, dann Luft, zuletzt Kühlung. Fehlt es, sinkt die Leistung '
            + 'und die Unfallgefahr steigt.',
        }));

        D.TECHNIK.forEach(function (def) {
          var n = s.technik[def.id] || 0;
          var p = S.technikPreis(s, def.id);
          var noetig = verlangt[def.id] || 0;
          var fehlt = n < noetig;
          body.appendChild(zeile(def.icon,
            def.name + ' · Stufe ' + n + '/' + def.stufen,
            def.text + '<br>' + def.strom + ' kW je Stufe'
            + (noetig ? '<br>Hier verlangt: <b class="' + (fehlt ? 'warn' : '') + '">Stufe '
              + noetig + '</b>' : '')
            + (n >= def.stufen ? '<br><b>Ausgebaut.</b>'
              : '<br>Kosten: <b>' + preis(p) + '</b>'),
            n >= def.stufen ? 'Fertig' : 'Ausbauen',
            n < def.stufen && s.geld >= p,
            function () { return S.technikAusbauen(s, def.id); }));
        });
      });
    }

    /* ---------------------------------------------------------- Forschung */

    function openForschung() {
      drawer('Forschung', function (body) {
        var s = st.s;
        D.FORSCHUNG.forEach(function (def) {
          var hat = S.hatForschung(s, def.id);
          var zu = def.braucht && !S.hatForschung(s, def.braucht);
          body.appendChild(zeile(def.icon, def.name,
            def.text
            + (zu ? '<br><b>Setzt voraus: ' + D.forschung(def.braucht).name + '</b>' : '')
            + (hat ? '<br><b>Erforscht.</b>' : '<br>Kosten: <b>' + preis(def.kosten) + '</b>'),
            hat ? '✓' : 'Forschen', !hat && !zu && s.geld >= def.kosten,
            function () { return S.forschen(s, def.id); }));
        });
      });
    }

    /* ---------------------------------------------------------- Personal */

    function openPersonal() {
      drawer('Personal', function (body, self) {
        var s = st.s;
        var bedarf = S.mannschaftBedarf(s);
        var faktor = S.mannschaftFaktor(s);

        body.appendChild(UI.kv([
          ['Gebraucht', bedarf + ' Mann'],
          ['Vorhanden', (s.personal.bergleute || 0) + ' angestellt, dazu '
            + S.FREIE_HAENDE + ' (du und dein Kompagnon)',
            faktor >= 1 ? 'good' : 'bad'],
          ['Maschinen laufen mit', U.num(faktor * 100) + ' %'],
          ['Löhne je Woche', U.euro(Math.round(S.lohnSumme(s)), true)],
          ['Zufriedenheit', Math.round(s.zufrieden) + ' %',
            s.zufrieden > 55 ? 'good' : (s.zufrieden > 35 ? '' : 'bad')],
        ]));

        D.PERSONAL.forEach(function (def) {
          var n = s.personal[def.id] || 0;
          var knoepfe = UI.el('div.side', { style: { display: 'flex', gap: '5px' } });
          [[-5, 'ghost'], [-1, 'ghost'], [1, 'primary'], [5, '']].forEach(function (k) {
            var b = UI.btn((k[0] > 0 ? '+' : '') + k[0], function () {
              S.einstellen(s, def.id, k[0]);
              host.sfx('click'); self.rebuild(); syncBar();
            }, 'sm ' + k[1]);
            if (k[0] < 0 && n + k[0] < 0) b.disabled = true;
            knoepfe.appendChild(b);
          });
          body.appendChild(UI.el('div.item', null, [
            UI.el('div.thumb', { text: def.icon }),
            UI.el('div.main', null, [
              UI.el('div.t', { text: def.name + ' · ' + n }),
              UI.el('div.d', {
                html: def.text + '<br>' + U.euro(def.lohn, true) + ' je Kopf und Woche',
              }),
            ]),
            knoepfe,
          ]));
        });
      });
    }

    /* ---------------------------------------------------------- Markt */

    function openMarkt() {
      drawer('Markt', function (body, self) {
        var s = st.s;

        body.appendChild(UI.toggleRow('Alles sofort verkaufen',
          'Aus ist es nur sinnvoll, wenn du auf bessere Preise warten willst.',
          function () { return s.autoVerkauf; },
          function (v) { s.autoVerkauf = v; }));

        body.appendChild(UI.kv([
          ['Auf Halde', U.num(Math.round(S.lagerMenge(s))) + ' t'],
          ['Wert der Halde', U.euro(Math.round(S.lagerWert(s)), true)],
        ]));

        body.appendChild(UI.btn('Alles verkaufen', function () {
          var e = S.allesVerkaufen(s);
          if (e <= 0) { UI.toast('Die Halde ist leer.', 'bad'); return; }
          host.sfx('cash');
          UI.toast(U.euro(Math.round(e), true) + ' erlöst.', 'good');
          self.rebuild(); syncBar();
        }, 'sm primary wide'));

        body.appendChild(UI.el('h4.pf-h', { text: 'Preise' }));
        D.ROHSTOFFE.forEach(function (r) {
          var menge = s.lager[r.id] || 0;
          var p = S.preis(s, r.id);
          var ab = p / r.wert - 1;
          var punkt = UI.el('div.thumb', { text: r.icon });
          punkt.style.background = r.farbe;
          punkt.style.color = '#0d1017';

          body.appendChild(UI.el('div.item', null, [
            punkt,
            UI.el('div.main', null, [
              UI.el('div.t', { text: r.name }),
              UI.el('div.d', {
                html: U.euro(Math.round(p)) + ' je Tonne · '
                  + '<b class="' + (ab >= 0 ? 'good' : 'bad') + '">'
                  + (ab >= 0 ? '+' : '') + U.num(ab * 100) + ' %</b> zum Normalwert'
                  + '<br>Auf Halde: ' + U.num(Math.round(menge)) + ' t',
              }),
            ]),
            UI.el('div.side', null, [
              UI.btn('Verkaufen', function () {
                var e = S.verkaufen(s, r.id);
                if (e <= 0) { UI.toast('Nichts davon da.', 'bad'); return; }
                host.sfx('cash');
                self.rebuild(); syncBar();
              }, 'sm' + (menge > 0 ? ' primary' : ' ghost')),
            ]),
          ]));
        });
      });
    }

    /* ---------------------------------------------------------- Statistik */

    function openStatistik() {
      drawer('Statistik', function (body) {
        var s = st.s;

        body.appendChild(UI.kv([
          ['Rang', D.RAENGE[s.rang].icon + ' ' + D.RAENGE[s.rang].name],
          ['Tiefe', D.formatTiefe(s.tiefe)],
          ['Insgesamt gefördert', U.num(Math.round(s.gefoerdert)) + ' t'],
          ['Erlös insgesamt', U.euro(Math.round(s.erloesGesamt), true)],
          ['Unfälle', String(s.unfaelle), s.unfaelle > 5 ? 'bad' : ''],
          ['Strombedarf', U.num(S.stromBedarf(s)) + ' kW'],
        ]));

        if (s.letzteWoche) {
          var w = s.letzteWoche;
          body.appendChild(UI.el('h4.pf-h', { text: 'Woche ' + w.woche }));
          body.appendChild(UI.kv([
            ['Erlöse', U.euro(Math.round(w.einnahmen), true)],
            ['Löhne', '− ' + U.euro(Math.round(w.lohn), true), 'bad'],
            ['Strom', '− ' + U.euro(Math.round(w.strom), true), 'bad'],
            ['Reparaturen', '− ' + U.euro(Math.round(w.reparatur), true), 'bad'],
            ['Steuer', '− ' + U.euro(Math.round(w.steuer), true), 'bad'],
            ['Ergebnis', U.eurSigned(Math.round(w.gewinn)), w.gewinn >= 0 ? 'good' : 'bad'],
          ]));
        }

        if (s.historie.length > 1) {
          body.appendChild(UI.el('h4.pf-h', { text: 'Gewinn je Woche' }));
          body.appendChild(UI.chart(s.historie.map(function (h) { return h.gewinn; }),
            { height: 110, color: '#3ddc84' }));
          body.appendChild(UI.el('h4.pf-h', { text: 'Tiefe' }));
          body.appendChild(UI.chart(s.historie.map(function (h) { return h.tiefe; }),
            { height: 90, color: '#4aa3ff' }));
        }

        body.appendChild(UI.el('h4.pf-h', { text: 'Nächster Rang' }));
        var n = D.RAENGE[s.rang + 1];
        if (!n) {
          body.appendChild(UI.el('p.small.muted', { text: 'Tiefer geht es nicht.' }));
        } else {
          body.appendChild(UI.kv([
            ['Tiefe', D.formatTiefe(s.tiefe) + ' / ' + D.formatTiefe(n.tiefe),
              s.tiefe >= n.tiefe ? 'good' : ''],
            ['Erlös insgesamt', U.euro(Math.round(s.erloesGesamt), true) + ' / '
              + U.euro(n.foerderung, true), s.erloesGesamt >= n.foerderung ? 'good' : ''],
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
        ['⛏', 'Hauen', 'Tippe auf den Stoß, um von Hand zu fördern. Am Anfang ist '
          + 'das dein ganzer Betrieb — später übernehmen Maschinen.'],
        ['⏬', 'Tiefer werden', 'Jede neue Sohle kostet Geld und Zeit. Dafür wird das '
          + 'Gestein wertvoller: Kohle, Eisen, Silber, Gold, Diamant.'],
        ['🛗', 'Der Engpass', 'Gefördert wird immer nur so viel, wie die Förderanlage '
          + 'nach oben schafft. Baue beides im Gleichschritt aus.'],
        ['🧯', 'Technik', 'Ab dem Kohleflöz läuft Wasser ein, später fehlt Luft und es '
          + 'wird heiß. Ohne die passende Technik sinkt die Leistung und es gibt Unfälle.'],
        ['📈', 'Markt', 'Preise schwanken täglich. Wer die Halde hält, kann teurer '
          + 'verkaufen — oder auf den Preisen sitzen bleiben.'],
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
        title: 'Mining-Tycoon', body: body,
        actions: [{ label: 'Glück auf', cls: 'primary' }],
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
      var schicht = D.schichtBei(s.tiefe);

      rGeld.set(U.euro(Math.round(s.geld), true));
      rGeld.tint(s.geld < 0 ? 'var(--red)' : '');
      rTiefe.set(D.formatTiefe(s.tiefe));
      rSchicht.icon(schicht.icon);
      rSchicht.set(schicht.name);
      rLeistung.set(U.short(Math.round(S.leistung(s))));
      rFoerder.set(U.short(Math.round(S.foerderMenge(s))));
      var eng = S.engpass(s) === 'foerder';
      rFoerder.tint(eng ? 'var(--red)' : '');
      rLeistung.tint(eng ? '' : 'var(--green)');
      rLager.set(U.short(Math.round(S.lagerMenge(s))) + ' t');
      rZufrieden.set(Math.round(s.zufrieden) + ' %');
      rZufrieden.tint(s.zufrieden > 55 ? 'var(--green)'
        : (s.zufrieden < 35 ? 'var(--red)' : ''));
      rZeit.set('Woche ' + s.woche + ' · Tag ' + s.tag);
      rRang.icon(D.RAENGE[s.rang].icon);
      rRang.set(D.RAENGE[s.rang].name);
      syncSpeeds();
    }

    /* ---------------------------------------------------------- Antippen */

    /* Handarbeit. Der Ertrag haengt an der besten Maschine, damit das
       Tippen nie voellig sinnlos wird - aber auch nie die Maschinen
       ersetzt. */
    function hauen(px, py) {
      var s = st.s;
      if (!s) return;
      var basis = 0.6;
      for (var i = 0; i < s.sohlen.length; i++) {
        for (var id in s.sohlen[i].geraete) {
          var def = D.geraet(id);
          if (def) basis = Math.max(basis, def.leistung * 0.08);
        }
      }
      var schicht = D.schichtBei(s.tiefe);
      var menge = basis / schicht.haerte;
      var wert = 0;
      for (var r in schicht.anteile) {
        s.lager[r] = (s.lager[r] || 0) + menge * schicht.anteile[r];
        wert += menge * schicht.anteile[r] * S.preis(s, r);
      }
      s.gefoerdert += menge;
      if (s.autoVerkauf) S.allesVerkaufen(s);

      st.pop.push({ x: px, y: py, t: 0, text: '+' + U.num(menge, 1) + ' t' });
      if (st.pop.length > 14) st.pop.shift();
      host.sfx('thud');
      host.buzz(6);
    }

    host.inputOn(stage.el, {
      onTap: function (px, py) { hauen(px, py); },
    });

    /* ---------------------------------------------------------- Schleife */

    function draw() {
      var s = st.s;
      if (!s) return;
      R.zeichnen(ctx, s, stage.w, stage.h, st.t);

      // Aufsteigende Mengen beim Hauen
      for (var i = st.pop.length - 1; i >= 0; i--) {
        var p = st.pop[i];
        p.t += 1 / 60;
        if (p.t > 1) { st.pop.splice(i, 1); continue; }
        G.text(ctx, p.text, p.x, p.y - p.t * 34, {
          font: G.font(14, 700),
          fill: 'rgba(240,180,41,' + (1 - p.t) + ')',
          align: 'center', baseline: 'middle',
        });
      }
    }

    var loop = host.loop({
      update: function (dt) {
        var s = st.s;
        if (!s) return;
        st.t += dt;
        S.step(s, dt);

        if (s.hoechsterRang > st.gemeldeterRang) {
          st.gemeldeterRang = s.hoechsterRang;
          host.setStat('rang', s.hoechsterRang);
          if (s.hoechsterRang > 0) {
            host.meilenstein('rang' + s.hoechsterRang, 40 + s.hoechsterRang * 30,
              D.RAENGE[s.hoechsterRang].name);
          }
        }
        host.setStat('tiefe', Math.round(s.tiefe));
        host.setStat('tonnen', Math.round(s.gefoerdert));
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
      st.gemeldeterRang = 0;
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
        var s = st.s;
        s.pausiert = false;
        s.tempo = 4;
        s.geld = 5e9;

        /* Bis in den Kimberlit graben und alles bauen, damit jede
           Schicht, jede Anforderung und jede Anlage einmal drankommt. */
        for (var i = 0; i < 4; i++) S.foerderAusbauen(s);
        ['wasser', 'stuetzen', 'luft', 'kuehlung'].forEach(function (t) {
          for (var k = 0; k < 4; k++) S.technikAusbauen(s, t);
        });
        D.FORSCHUNG.forEach(function (f) { S.forschen(s, f.id); });
        s.personal = { bergleute: 400, technik: 20, geologen: 8 };

        for (i = 0; i < 26; i++) {
          S.teufenStarten(s);
          s.tiefe = s.teufenZiel;
          s.teufen = false;
          s.sohlen.push({ tiefe: s.tiefe, geraete: {} });
        }
        for (i = 0; i < s.sohlen.length; i++) {
          S.geraetKaufen(s, i, 'lader', 3);
          S.geraetKaufen(s, i, 'schraem', 2);
        }

        var n = Math.max(400, schritte || 1200);
        for (i = 0; i < n; i++) {
          S.step(s, 1 / 30);
          if (i % 120 === 0) { draw(); syncBar(); }
        }

        var roh = S.serialize(s);
        var zurueck = S.deserialize(roh);
        if (!zurueck) throw new Error('Spielstand liess sich nicht laden');
        if (Math.round(zurueck.geld) !== Math.round(s.geld)) throw new Error('Kasse nach dem Laden');
        if (zurueck.sohlen.length !== s.sohlen.length) throw new Error('Sohlen nach dem Laden');
        if (Math.round(zurueck.tiefe) !== Math.round(s.tiefe)) throw new Error('Tiefe nach dem Laden');

        st.s = s;
        syncBar();
        draw();
      },
    };
  }

  /* ---------------------------------------------------------- Erfolge */

  SG.fortschritt.anhaengen([
    SG.fortschritt.E('mine_kohle', '⬛', 'Erste Kohle',
      'Grab im Mining-Tycoon bis ins Kohleflöz.', 60,
      function (u) { return u.zaehler('minetycoon', 'tiefe') >= 180; }, { spiel: 'minetycoon' }),
    SG.fortschritt.E('mine_gold', '🟡', 'Gold',
      'Erreiche die Edelmetallader in 620 Metern.', 140,
      function (u) { return u.zaehler('minetycoon', 'tiefe') >= 620; }, { spiel: 'minetycoon' }),
    SG.fortschritt.E('mine_diamant', '💎', 'Diamanten',
      'Erreiche den Kimberlitschlot in 1.050 Metern.', 280,
      function (u) { return u.zaehler('minetycoon', 'tiefe') >= 1050; }, { spiel: 'minetycoon' }),
    SG.fortschritt.E('mine_grund', '☢', 'Grundgebirge',
      'Grab tiefer als 1.350 Meter.', 420,
      function (u) { return u.zaehler('minetycoon', 'tiefe') >= 1350; }, { spiel: 'minetycoon' }),
    SG.fortschritt.E('mine_million', '🪨', 'Eine Million Tonnen',
      'Fördere insgesamt eine Million Tonnen.', 200,
      function (u) { return u.zaehler('minetycoon', 'tonnen') >= 1000000; },
      { spiel: 'minetycoon' }),
  ]);

  /* ---------------------------------------------------------- Anmeldung */

  SG.register({
    id: 'minetycoon',
    name: 'Mining-Tycoon',
    category: 'tycoon',
    desc: 'Von der Spitzhacke zum Bergbaukonzern — immer tiefer, immer wertvoller',
    tags: ['bergbau', 'mine', 'kohle', 'gold', 'diamant', 'graben', 'tycoon', 'rohstoffe'],
    heavy: false,
    credit: { icon: '💡', text: 'Idee von GenieKadaver' },
    scoreLabel: function (bests, stats) {
      if (!stats || stats.tiefe === undefined) return null;
      return D.formatTiefe(stats.tiefe);
    },
    preview: function (c, w, h) {
      // Querschnitt in Miniatur
      c.fillStyle = '#16202e';
      c.fillRect(0, 0, w, h * 0.2);
      var y = h * 0.2;
      var farben = ['#4a3a28', '#5a5344', '#6d6a5c', '#3a3630', '#4a3a34', '#4a4028'];
      for (var i = 0; i < farben.length; i++) {
        var hh = (h - h * 0.2) / farben.length;
        c.fillStyle = farben[i];
        c.fillRect(0, y, w, hh);
        c.fillStyle = 'rgba(0,0,0,.3)';
        c.fillRect(0, y, w, 1);
        y += hh;
      }
      // Schacht
      c.fillStyle = '#0c0f16';
      c.fillRect(w * 0.44, h * 0.2, w * 0.12, h * 0.8);
      c.strokeStyle = 'rgba(240,180,41,.35)';
      c.lineWidth = 1.2;
      c.strokeRect(w * 0.44, h * 0.2, w * 0.12, h * 0.8);
      // Sohlen
      c.fillStyle = '#0e1219';
      for (i = 1; i < 5; i++) {
        c.fillRect(w * 0.16, h * (0.2 + i * 0.16), w * 0.28, h * 0.045);
        c.fillRect(w * 0.56, h * (0.2 + i * 0.16), w * 0.28, h * 0.045);
      }
      // Foerdergeruest
      c.strokeStyle = '#8794b1';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(w * 0.42, h * 0.2);
      c.lineTo(w * 0.46, h * 0.06);
      c.lineTo(w * 0.54, h * 0.06);
      c.lineTo(w * 0.58, h * 0.2);
      c.stroke();
      G.circle(c, w * 0.5, h * 0.055, Math.max(3, h * 0.035), '#f0b429');
      G.text(c, '💎', w * 0.24, h * 0.82, {
        font: G.font(Math.round(h * 0.16)), align: 'center', baseline: 'middle',
      });
      G.text(c, '⛏', w * 0.78, h * 0.4, {
        font: G.font(Math.round(h * 0.16)), align: 'center', baseline: 'middle',
      });
    },
    mount: mount,
  });
})(SG);
