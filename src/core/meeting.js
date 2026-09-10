/* ------------------------------------------------------------------
   Besprechungen.

   Ein Admin macht eine auf und laedt Leute ein. Wer eingeladen ist,
   sieht oben in der Leiste einen Knopf mit einer Eins und kommt damit
   an den Tisch.

   Am Tisch gibt es drei Dinge:

     Tisch        wer eingeladen ist und wer gerade da ist
     Route        wo man in der Pause langgeht, als Plan zum Antippen
     Stundenplan  damit man weiss, wann ueberhaupt Zeit ist

   Wo die Daten liegen: die Besprechung selbst und der Stundenplan
   stehen in SG.verwaltung - das ist ein Dokument, das ohnehin auf
   allen Geraeten gleich ist und sich in unter einer Sekunde
   verteilt. Der Chat haengt wie ueberall an einem Brett.

   Warum die Route nicht live mitwandert, waehrend jemand tippt: die
   Verwaltung wird als Ganzes geschrieben. Ein Punkt wird deshalb erst
   beim Loslassen verschickt, nicht bei jeder Bewegung.
   ------------------------------------------------------------------ */

(function (SG) {
  var UI = SG.ui;
  var U = SG.util;
  var A = SG.auth;
  var Rel = SG.relais;

  var M = SG.meeting = {};

  M.raum = function (id) { return 'meeting-' + id; };

  /* ------------------------------------------------------------------
     Der Schulplan

     Feste Orte mit Koordinaten in einem 100x100-Raster. Bewusst
     schematisch: es soll auf jedem Bildschirm gleich aussehen und
     ohne Bilddatei auskommen.
     ------------------------------------------------------------------ */

  M.ORTE = [
    { id: 'haupt', name: 'Haupteingang', x: 50, y: 88, ic: '🚪' },
    { id: 'hof', name: 'Pausenhof', x: 50, y: 62, ic: '🌳' },
    { id: 'mensa', name: 'Mensa', x: 20, y: 70, ic: '🍽' },
    { id: 'kiosk', name: 'Kiosk', x: 30, y: 46, ic: '🥨' },
    { id: 'sport', name: 'Sporthalle', x: 80, y: 72, ic: '🏀' },
    { id: 'biblio', name: 'Bibliothek', x: 76, y: 40, ic: '📚' },
    { id: 'aula', name: 'Aula', x: 50, y: 34, ic: '🎭' },
    { id: 'ctrakt', name: 'C-Trakt', x: 22, y: 22, ic: '🏫' },
    { id: 'ntrakt', name: 'Naturwissenschaften', x: 78, y: 18, ic: '🧪' },
    { id: 'rad', name: 'Fahrradständer', x: 12, y: 90, ic: '🚲' },
    { id: 'hinten', name: 'Hinterausgang', x: 88, y: 92, ic: '🚶' },
  ];

  M.ortVon = function (id) {
    for (var i = 0; i < M.ORTE.length; i++) if (M.ORTE[i].id === id) return M.ORTE[i];
    return null;
  };

  /* ------------------------------------------------------------------
     Daten
     ------------------------------------------------------------------ */

  function liste() {
    var d = SG.verwaltung.daten();
    if (!Array.isArray(d.meetings)) d.meetings = [];
    return d.meetings;
  }

  M.alle = function () { return liste(); };

  M.offene = function () {
    return liste().filter(function (m) { return m.offen; });
  };

  /* Besprechungen, zu denen ich eingeladen bin */
  M.meine = function () {
    var c = A.aktuell && A.aktuell.code;
    if (!c) return [];
    return M.offene().filter(function (m) {
      return (m.teilnehmer || []).indexOf(c) >= 0 || m.von === c;
    });
  };

  M.von = function (id) {
    return liste().filter(function (m) { return m.id === id; })[0] || null;
  };

  M.anlegen = function (titel, teilnehmer, wann) {
    var id = 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    SG.verwaltung.schreiben(function (d) {
      d.meetings = Array.isArray(d.meetings) ? d.meetings : [];
      d.meetings.unshift({
        id: id,
        titel: String(titel || 'Besprechung').slice(0, 60),
        von: A.aktuell.code,
        vonName: A.aktuell.name,
        wann: wann || '',
        t: Date.now(),
        offen: true,
        teilnehmer: (teilnehmer || []).slice(0, 20),
        route: [],
        notiz: '',
      });
      if (d.meetings.length > 20) d.meetings.length = 20;
    });
    SG.protokoll.schreiben('meeting', 'Besprechung eröffnet: ' + titel);
    (teilnehmer || []).forEach(function (c) {
      Rel.befehlSenden(c, 'meeting', 'Du bist zu „' + titel + '" eingeladen.',
        { id: id });
    });
    return id;
  };

  M.aendern = function (id, fn) {
    SG.verwaltung.schreiben(function (d) {
      (d.meetings || []).forEach(function (m) { if (m.id === id) fn(m); });
    });
  };

  M.schliessen = function (id) {
    var m = M.von(id);
    M.aendern(id, function (x) { x.offen = false; });
    SG.protokoll.schreiben('meeting', 'Besprechung beendet: ' + (m ? m.titel : id));
  };

  /* ------------------------------------------------------------------
     Stundenplan - einer für alle
     ------------------------------------------------------------------ */

  M.TAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];
  M.STUNDEN = 9;

  M.plan = function () {
    var d = SG.verwaltung.daten();
    if (!d.stundenplan || typeof d.stundenplan !== 'object') d.stundenplan = {};
    return d.stundenplan;
  };

  M.planSetzen = function (schluessel, fach, raum) {
    SG.verwaltung.schreiben(function (d) {
      d.stundenplan = d.stundenplan || {};
      if (!fach) delete d.stundenplan[schluessel];
      else d.stundenplan[schluessel] = { fach: fach, raum: raum || '' };
    });
  };

  /* ------------------------------------------------------------------
     Der Knopf in der Kopfzeile
     ------------------------------------------------------------------ */

  M.knopf = function () {
    var meine = M.meine();
    if (!meine.length) return null;
    var zahl = UI.el('span.meeting-zahl', { text: String(meine.length) });
    return UI.el('button.btn.sm.meeting-btn', {
      'aria-label': 'Besprechung',
      on: {
        click: function () {
          if (meine.length === 1) SG.router.go('#/meeting/' + meine[0].id);
          else auswahl(meine);
        },
      },
    }, [
      UI.el('span.ico', { text: '📋' }),
      UI.el('span.lbl', { text: 'Meeting' }),
      zahl,
    ]);
  };

  function auswahl(meine) {
    var body = UI.el('div');
    var dlg = UI.modal({ title: 'Besprechungen', body: body });
    meine.forEach(function (m) {
      body.appendChild(UI.el('div.item.tap', {
        on: {
          click: function () { dlg.close(); SG.router.go('#/meeting/' + m.id); },
        },
      }, [
        UI.el('div.thumb', { text: '📋' }),
        UI.el('div.main', null, [
          UI.el('div.t', { text: m.titel }),
          UI.el('div.d', {
            text: 'von ' + m.vonName + (m.wann ? ' · ' + m.wann : ''),
          }),
        ]),
        UI.el('div.side', null, [UI.el('div.s', { text: '›' })]),
      ]));
    });
  }

  /* ------------------------------------------------------------------
     Anlegen (Admin)
     ------------------------------------------------------------------ */

  M.anlegenDialog = function () {
    var titel = UI.el('input', {
      type: 'text', placeholder: 'Worum geht es?', maxLength: 60, className: 'feld',
    });
    var wann = UI.el('input', {
      type: 'text', placeholder: 'z. B. große Pause, Mittwoch', maxLength: 40,
      className: 'feld',
    });
    var gewaehlt = {};
    var leute = A.liste().filter(function (p) {
      return p.code !== (A.aktuell && A.aktuell.code);
    });

    var wahl = UI.el('div.meeting-wahl');
    leute.forEach(function (p) {
      var b = UI.el('button.meeting-person', {
        type: 'button',
        on: {
          click: function () {
            gewaehlt[p.code] = !gewaehlt[p.code];
            b.classList.toggle('an', gewaehlt[p.code]);
            SG.audio.play('click');
          },
        },
      }, [
        UI.el('span.mp-ic', { text: A.rolleIcon(p.rolle) }),
        UI.el('span.mp-n', { text: p.name || A.schoen(p.code) }),
      ]);
      wahl.appendChild(b);
    });

    var dlg = UI.modal({
      title: '📋 Besprechung eröffnen',
      wide: true,
      body: [
        UI.el('p.small.muted', { text: 'Titel' }),
        titel,
        UI.el('p.small.muted', { text: 'Wann (frei geschrieben)' }),
        wann,
        UI.el('div.sec-head', null, [UI.el('h2', { text: 'Wer wird eingeladen?' })]),
        leute.length ? wahl : UI.el('p.small.muted', {
          text: 'Es gibt noch niemanden außer dir. Lege erst Codes an.',
        }),
      ],
      actions: [
        { label: 'Abbrechen', cls: 'ghost' },
        {
          label: 'Eröffnen', cls: 'primary', keepOpen: true,
          onClick: function () {
            var t = (titel.value || '').trim();
            if (t.length < 3) { UI.toast('Bitte einen Titel angeben.', 'bad'); return; }
            var wer = Object.keys(gewaehlt).filter(function (c) { return gewaehlt[c]; });
            dlg.close();
            var id = M.anlegen(t, wer, (wann.value || '').trim());
            UI.toast(wer.length
              ? wer.length + ' eingeladen.'
              : 'Besprechung eröffnet.', 'good');
            SG.router.go('#/meeting/' + id);
          },
        },
      ],
    });
    setTimeout(function () { try { titel.focus(); } catch (e) { /* egal */ } }, 120);
  };

  /* ==================================================================
     Der Bildschirm
     ================================================================== */

  M.render = function (app, id) {
    UI.clear(app);
    var m = M.von(id);
    if (!m) {
      app.appendChild(UI.el('div.screen', null, [
        UI.empty('📋', 'Diese Besprechung gibt es nicht mehr', ''),
        UI.btn('Zurück', function () { SG.router.go('#/'); }, 'wide ghost'),
      ]));
      return { destroy: function () { } };
    }

    var darf = A.istAdmin() || m.von === A.aktuell.code
      || (m.teilnehmer || []).indexOf(A.aktuell.code) >= 0;
    if (!darf) { SG.router.go('#/'); return { destroy: function () { } }; }

    var reiter = 'tisch';
    var offen = null;
    var abmelder = [];

    app.appendChild(UI.el('div.topbar', null, [
      UI.el('button.back.btn.sm.ghost', {
        html: '‹ Zurück',
        on: { click: function () { SG.router.go('#/'); } },
      }),
      UI.el('div.spacer'),
      UI.el('div.brand-text', null, [
        UI.el('div.brand-title', { text: '📋 ' + m.titel }),
        UI.el('div.brand-sub', {
          text: 'von ' + m.vonName + (m.wann ? ' · ' + m.wann : '')
            + (m.offen ? '' : ' · beendet'),
        }),
      ]),
      UI.el('div.spacer'),
      A.istAdmin() && m.offen ? UI.el('button.btn.sm.ghost', {
        html: '<span class="ico">✓</span><span class="lbl">Beenden</span>',
        on: {
          click: function () {
            UI.confirm('Besprechung beenden?',
              'Sie verschwindet dann bei allen aus der Leiste.', 'Beenden')
              .then(function (ok) { if (ok) { M.schliessen(id); SG.router.go('#/'); } });
          },
        },
      }) : null,
    ]));

    var rahmen = UI.el('div.meeting');
    rahmen.appendChild(UI.tabs([
      { id: 'tisch', label: '🪑 Tisch' },
      { id: 'route', label: '🗺 Route' },
      { id: 'plan', label: '🕘 Stundenplan' },
      { id: 'chat', label: '💬 Chat' },
    ], function (r) { reiter = r; bauen(); }, reiter));

    var inhalt = UI.el('div.meeting-inhalt');
    rahmen.appendChild(inhalt);
    app.appendChild(rahmen);

    /* Aendert jemand die Route, soll sie hier mitwandern - aber der
       Reiter darf dabei nicht neu gebaut werden. Sonst waere eine
       halb getippte Notiz weg, sobald nebenan jemand einen Punkt
       setzt, und die Karte bekaeme bei jedem Tipp eine neue Leinwand. */
    var aufVerw = function () {
      m = M.von(id) || m;
      if (offen && offen.aktualisieren) offen.aktualisieren();
      else if (reiter !== 'chat') bauen();
    };
    SG.verwaltung.on('aenderung', aufVerw);

    bauen();

    function bauen() {
      if (offen && offen.destroy) { try { offen.destroy(); } catch (e) { /* egal */ } }
      offen = null;
      UI.clear(inhalt);
      if (reiter === 'tisch') offen = tisch(inhalt);
      else if (reiter === 'route') offen = route(inhalt);
      else if (reiter === 'plan') offen = plan(inhalt);
      else offen = chat(inhalt);
    }

    /* ---------------------------------------------------------- Tisch */

    function tisch(ziel) {
      var codes = [m.von].concat(m.teilnehmer || []);
      var cv = UI.el('canvas.meeting-tisch');
      ziel.appendChild(cv);

      var da = {};
      var aufPraesenz = function (liste2) {
        da = {};
        (liste2 || []).forEach(function (p) { da[p.code] = p; });
        malen();
      };
      Rel.on('praesenz', aufPraesenz);
      Rel.praesenzAn(true);
      Rel.starten();
      abmelder.push(function () {
        Rel.off('praesenz', aufPraesenz);
        Rel.praesenzAn(false);
      });

      function malen() {
        var r = cv.getBoundingClientRect();
        var w = Math.max(280, Math.round(r.width || 600));
        var h = Math.min(420, Math.round(w * 0.62));
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        cv.width = w * dpr; cv.height = h * dpr;
        cv.style.height = h + 'px';
        var c = cv.getContext('2d');
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        c.clearRect(0, 0, w, h);

        var mx = w / 2, my = h / 2;
        var rx = w * 0.28, ry = h * 0.22;
        /* Die Stuehle stehen auf einem Ring um den Tisch - aber so weit
           innen, dass der Name darunter noch auf die Leinwand passt.
           Ohne die Klammer war der unterste Name abgeschnitten. */
        var ringX = Math.min(rx + w * 0.11, w / 2 - 36);
        var ringY = Math.min(ry + h * 0.17, h / 2 - 42);

        // Tischplatte
        c.save();
        c.beginPath();
        c.ellipse(mx, my, rx, ry, 0, 0, Math.PI * 2);
        var g = c.createLinearGradient(0, my - ry, 0, my + ry);
        g.addColorStop(0, '#2a344b');
        g.addColorStop(1, '#191f2e');
        c.fillStyle = g;
        c.fill();
        c.strokeStyle = '#3d4a68';
        c.lineWidth = 2;
        c.stroke();
        c.restore();

        SG.gfx.text(c, m.titel, mx, my - 8, {
          size: 15, weight: 800, color: '#e9edf6', align: 'center', baseline: 'middle',
        });
        var anwesend = codes.filter(function (x) { return da[x]; }).length;
        SG.gfx.text(c, anwesend + ' von ' + codes.length + ' da', mx, my + 14, {
          size: 12, weight: 600, color: '#8794b1', align: 'center', baseline: 'middle',
        });

        // Stuehle rundherum
        codes.forEach(function (code, i) {
          var a = -Math.PI / 2 + (i / codes.length) * Math.PI * 2;
          var px = mx + Math.cos(a) * ringX;
          var py = my + Math.sin(a) * ringY;
          var p = da[code];
          var name = A.nameVon(code) || A.schoen(code);
          var rolle = (p && p.rolle) || (A.liste().filter(function (e) {
            return e.code === code;
          })[0] || {}).rolle || 'S';

          c.beginPath();
          c.arc(px, py, 22, 0, Math.PI * 2);
          c.fillStyle = p ? 'rgba(61,220,132,.16)' : 'rgba(255,255,255,.05)';
          c.fill();
          c.strokeStyle = p ? '#3ddc84' : '#2f3a55';
          c.lineWidth = 2;
          c.stroke();

          SG.gfx.text(c, A.rolleIcon(rolle), px, py, {
            size: 18, align: 'center', baseline: 'middle',
          });
          SG.gfx.text(c, name, px, py + 32, {
            size: 11.5, weight: 700, color: p ? '#e9edf6' : '#5f6a85',
            align: 'center', baseline: 'middle',
          });
          if (p && p.wo && py + 45 < h) {
            SG.gfx.text(c, p.wo, px, py + 45, {
              size: 10, color: '#5f6a85', align: 'center', baseline: 'middle',
            });
          }
        });
      }
      setTimeout(malen, 0);
      var aufGroesse = function () { malen(); };
      window.addEventListener('resize', aufGroesse);
      abmelder.push(function () { window.removeEventListener('resize', aufGroesse); });

      ziel.appendChild(UI.el('div.sec-head', null, [
        UI.el('h2', { text: 'Notiz für alle' }),
      ]));
      var notiz = UI.el('textarea', {
        placeholder: 'Was steht an?', rows: 3, maxLength: 400, className: 'feld hoch',
        value: m.notiz || '',
      });
      ziel.appendChild(notiz);
      var speichern = UI.btn('Notiz speichern', function () {
        M.aendern(id, function (x) { x.notiz = (notiz.value || '').slice(0, 400); });
        UI.toast('Gespeichert.', 'good');
      }, 'sm wide ghost');
      ziel.appendChild(speichern);

      return {
        aktualisieren: function () {
          malen();
          /* Die Notiz nur uebernehmen, wenn hier gerade niemand tippt. */
          if (document.activeElement !== notiz) notiz.value = m.notiz || '';
        },
      };
    }

    /* ---------------------------------------------------------- Route */

    function route(ziel) {
      ziel.appendChild(UI.el('p.small.muted', {
        text: 'Tippe die Orte in der Reihenfolge an, in der ihr sie ablaufen '
          + 'wollt. Der Weg wird gezeichnet, die Zeit grob geschätzt — '
          + 'gerechnet mit ruhigem Schritt.',
      }));

      var cv = UI.el('canvas.meeting-karte');
      ziel.appendChild(cv);

      var zeile = UI.el('div.route-liste');
      ziel.appendChild(zeile);

      var knoepfe = UI.el('div.row.wrap', { style: { gap: '8px', marginTop: '10px' } }, [
        UI.btn('Letzten Punkt zurück', function () {
          M.aendern(id, function (x) { (x.route || []).pop(); });
        }, 'sm ghost'),
        UI.btn('Route leeren', function () {
          M.aendern(id, function (x) { x.route = []; });
        }, 'sm bad'),
      ]);
      ziel.appendChild(knoepfe);

      function malen() {
        var r = cv.getBoundingClientRect();
        var w = Math.max(280, Math.round(r.width || 600));
        var h = Math.round(w * 0.72);
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        cv.width = w * dpr; cv.height = h * dpr;
        cv.style.height = h + 'px';
        var c = cv.getContext('2d');
        c.setTransform(dpr, 0, 0, dpr, 0, 0);

        var pad = 26;
        var gx = function (x) { return pad + (x / 100) * (w - pad * 2); };
        var gy = function (y) { return pad + (y / 100) * (h - pad * 2); };

        c.fillStyle = '#0b0e15';
        c.fillRect(0, 0, w, h);

        // Raster
        c.strokeStyle = 'rgba(255,255,255,.05)';
        c.lineWidth = 1;
        for (var i = 0; i <= 10; i++) {
          c.beginPath(); c.moveTo(gx(i * 10), gy(0)); c.lineTo(gx(i * 10), gy(100)); c.stroke();
          c.beginPath(); c.moveTo(gx(0), gy(i * 10)); c.lineTo(gx(100), gy(i * 10)); c.stroke();
        }

        // Gebaeudeumriss, nur angedeutet
        c.strokeStyle = 'rgba(74,163,255,.22)';
        c.lineWidth = 2;
        c.strokeRect(gx(8), gy(10), gx(92) - gx(8), gy(58) - gy(10));

        var route2 = m.route || [];

        // Weg
        if (route2.length > 1) {
          c.beginPath();
          route2.forEach(function (oid, k) {
            var o = M.ortVon(oid);
            if (!o) return;
            if (k === 0) c.moveTo(gx(o.x), gy(o.y));
            else c.lineTo(gx(o.x), gy(o.y));
          });
          c.strokeStyle = '#f0b429';
          c.lineWidth = 3;
          c.lineJoin = 'round';
          c.setLineDash([8, 6]);
          c.stroke();
          c.setLineDash([]);
        }

        // Orte
        M.ORTE.forEach(function (o) {
          var nr = route2.indexOf(o.id);
          var x = gx(o.x), y = gy(o.y);
          c.beginPath();
          c.arc(x, y, 17, 0, Math.PI * 2);
          c.fillStyle = nr >= 0 ? 'rgba(240,180,41,.20)' : 'rgba(255,255,255,.06)';
          c.fill();
          c.strokeStyle = nr >= 0 ? '#f0b429' : '#2f3a55';
          c.lineWidth = 2;
          c.stroke();
          SG.gfx.text(c, o.ic, x, y, { size: 15, align: 'center', baseline: 'middle' });
          SG.gfx.text(c, o.name, x, y + 27, {
            size: 10.5, weight: 600, color: nr >= 0 ? '#ffd166' : '#8794b1',
            align: 'center', baseline: 'middle',
          });
          if (nr >= 0) {
            c.beginPath();
            c.arc(x + 14, y - 14, 9, 0, Math.PI * 2);
            c.fillStyle = '#f0b429';
            c.fill();
            SG.gfx.text(c, String(nr + 1), x + 14, y - 14, {
              size: 11, weight: 800, color: '#1a1305', align: 'center', baseline: 'middle',
            });
          }
        });

        cv.__treffer = function (px, py) {
          for (var j = 0; j < M.ORTE.length; j++) {
            var o = M.ORTE[j];
            if (U.dist(px, py, gx(o.x), gy(o.y)) < 24) return o;
          }
          return null;
        };
      }

      cv.addEventListener('pointerdown', function (e) {
        var r = cv.getBoundingClientRect();
        var o = cv.__treffer && cv.__treffer(e.clientX - r.left, e.clientY - r.top);
        if (!o) return;
        SG.audio.play('click');
        SG.settings.buzz(10);
        M.aendern(id, function (x) {
          x.route = x.route || [];
          var i = x.route.indexOf(o.id);
          if (i >= 0) x.route.splice(i, 1);
          else x.route.push(o.id);
        });
      });

      function listeMalen() {
        UI.clear(zeile);
        var route2 = m.route || [];
        if (!route2.length) {
          zeile.appendChild(UI.el('div.small.muted.center', {
            text: 'Noch kein Weg geplant.',
          }));
          return;
        }
        var meter = 0;
        route2.forEach(function (oid, k) {
          var o = M.ortVon(oid);
          if (!o) return;
          if (k > 0) {
            var vor = M.ortVon(route2[k - 1]);
            if (vor) meter += U.dist(vor.x, vor.y, o.x, o.y) * 1.4;
          }
          zeile.appendChild(UI.el('div.route-punkt', null, [
            UI.el('span.rp-nr', { text: String(k + 1) }),
            UI.el('span.rp-ic', { text: o.ic }),
            UI.el('span.rp-n', { text: o.name }),
          ]));
        });
        var minuten = Math.max(1, Math.round(meter / 70));
        zeile.appendChild(UI.el('div.route-summe', {
          text: '≈ ' + Math.round(meter) + ' Meter · rund ' + minuten + ' '
            + U.plural(minuten, 'Minute', 'Minuten') + ' zu Fuß',
        }));
      }

      setTimeout(function () { malen(); listeMalen(); }, 0);
      var aufGroesse2 = function () { malen(); };
      window.addEventListener('resize', aufGroesse2);
      abmelder.push(function () { window.removeEventListener('resize', aufGroesse2); });

      return { aktualisieren: function () { malen(); listeMalen(); } };
    }

    /* ---------------------------------------------------------- Stundenplan */

    function plan(ziel) {
      ziel.appendChild(UI.el('p.small.muted', {
        text: 'Ein Plan für alle. Antippen ändert eine Stunde; die laufende '
          + 'ist hervorgehoben.',
      }));

      var p = M.plan();
      var jetzt = new Date();
      var heute = jetzt.getDay() - 1;          // 0 = Montag
      var stundeJetzt = stundeVon(jetzt);

      var tab = UI.el('div.plan-gitter');
      tab.style.gridTemplateColumns = '42px repeat(' + M.TAGE.length + ', 1fr)';

      tab.appendChild(UI.el('div.plan-ecke'));
      M.TAGE.forEach(function (t, i) {
        tab.appendChild(UI.el('div.plan-tag' + (i === heute ? '.heute' : ''), { text: t }));
      });

      for (var s = 1; s <= M.STUNDEN; s++) {
        tab.appendChild(UI.el('div.plan-stunde', { text: s + '.' }));
        for (var t2 = 0; t2 < M.TAGE.length; t2++) {
          tab.appendChild(zelle(t2, s));
        }
      }
      ziel.appendChild(tab);

      ziel.appendChild(UI.el('p.small.muted', {
        style: { marginTop: '10px' },
        text: 'Große Pause ist nach der 2. und nach der 4. Stunde eingezeichnet.',
      }));

      function zelle(tag, stunde) {
        var k = tag + ':' + stunde;
        var e = p[k];
        var istJetzt = tag === heute && stunde === stundeJetzt;
        var pause = stunde === 3 || stunde === 5;
        var el = UI.el('button.plan-zelle'
          + (e ? '.voll' : '')
          + (istJetzt ? '.jetzt' : '')
          + (pause ? '.pause' : ''), {
          type: 'button',
          on: { click: function () { bearbeiten(k, e, el); } },
        }, [
          UI.el('span.pz-fach', { text: e ? e.fach : '' }),
          e && e.raum ? UI.el('span.pz-raum', { text: e.raum }) : null,
        ]);
        return el;
      }

      function bearbeiten(k, e) {
        var fach = UI.el('input', {
          type: 'text', placeholder: 'Fach', maxLength: 16, className: 'feld',
          value: e ? e.fach : '',
        });
        var raum = UI.el('input', {
          type: 'text', placeholder: 'Raum', maxLength: 10, className: 'feld',
          value: e ? e.raum : '',
        });
        var dlg = UI.modal({
          title: M.TAGE[Number(k.split(':')[0])] + ' · ' + k.split(':')[1] + '. Stunde',
          body: [fach, raum],
          actions: [
            {
              label: 'Leeren', cls: 'ghost',
              onClick: function () { M.planSetzen(k, ''); },
            },
            {
              label: 'Übernehmen', cls: 'primary',
              onClick: function () {
                M.planSetzen(k, (fach.value || '').trim(), (raum.value || '').trim());
              },
            },
          ],
        });
        setTimeout(function () { try { fach.focus(); } catch (er) { /* egal */ } }, 120);
        return dlg;
      }

      /* Grobe Schulzeiten - reicht, um "gerade läuft" zu markieren */
      function stundeVon(d) {
        var min = d.getHours() * 60 + d.getMinutes();
        var start = 8 * 60;
        if (min < start) return 0;
        var n = Math.floor((min - start) / 45) + 1;
        return n >= 1 && n <= M.STUNDEN ? n : 0;
      }
    }

    /* ---------------------------------------------------------- Chat */

    function chat(ziel) {
      var box = UI.el('div.chat-schirm.im-reiter');
      ziel.appendChild(box);
      return SG.chat.ansicht(box, {
        brett: M.raum(id),
        platzhalter: 'Nachricht an die Runde…',
        loeschen: true,
        leerIcon: '📋',
        leerTitel: m.titel,
        leerText: 'Alles, was hier steht, sehen die Eingeladenen.',
      });
    }

    return {
      destroy: function () {
        SG.verwaltung.off('aenderung', aufVerw);
        abmelder.forEach(function (f) { try { f(); } catch (e) { /* egal */ } });
        if (offen && offen.destroy) offen.destroy();
      },
    };
  };
})(SG);
