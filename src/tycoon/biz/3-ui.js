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
      brancheReiter: 'alle', // Reiter in der Firmenschublade
      ansehenReiter: 'wohnen',
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
    var rSchuld = resItem('', '🏦', 'Schulden');
    rSchuld.style.display = 'none';
    var rDatum = resItem('', '📅', 'Zeit');
    [rGeld, rProSek, rVermoegen, rAnsehen, rRang, rSteuer, rSchuld, rDatum]
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
    dockBtn('🧭', 'Branchen', function () { openBranchen(); });
    dockBtn('📈', 'Börse', function () { openBoerse(); });
    dockBtn('🏘', 'Immobilien', function () { openImmobilien(); });
    var bBank = dockBtn('🏦', 'Bank', function () { openBank(); });
    dockBtn('👑', 'Ansehen', function () { openAnsehen(); });
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

    /* Branchenfarbe an ein Element haengen. Alles Farbige in einer Karte
       zieht sie von dort - eine Branche sieht ueberall gleich aus. */
    function euroFein(n) {
      return Math.abs(n) < 10 ? U.num(n, 2) + String.fromCharCode(160) + String.fromCharCode(8364)
        : U.euro(n, true);
    }

    function farbig(el, br) {
      if (!br) return el;
      el.style.setProperty('--bf', br.farbe);
      el.style.setProperty('--bfd', U.mixHex(br.farbe, '#212a3d', 0.78));
      return el;
    }

    /* Einmal handeln: Fehler melden oder Klang, Kopfzeile und Schublade
       nachziehen. Jeder Knopf in den Schubladen laeuft hier durch. */
    function handeln(fn, self) {
      var fehler = fn();
      if (fehler) { host.sfx('error'); UI.toast(fehler, 'bad', 2200); return false; }
      host.sfx('cash');
      host.buzz(10);
      syncBar();
      if (self && self.rebuild) self.rebuild();
      return true;
    }

    /* Kleines Schild fuer einen Faktor: "Konjunktur +12 %" */
    function modChip(name, faktor) {
      var p = (faktor - 1) * 100;
      var cls = p > 0.5 ? '.up' : (p < -0.5 ? '.down' : '');
      return UI.el('div.biz-mod' + cls, {
        text: name + ' ' + (p >= 0 ? '+' : '') + U.num(p, 0) + ' %',
      });
    }

    /* Sichtbar ist, was man besitzt - und was man sich einmal fast
       leisten konnte. Dadurch taucht auf jeder Preisstufe eine kleine
       Auswahl aus mehreren Branchen gleichzeitig auf. */
    function sichtbar(s, i) {
      if ((s.firmen[D.FIRMEN[i].id] || 0) > 0) return true;
      if (i === 0) return true;
      return Math.max(s.verdientGesamt, s.geld) >= D.FIRMEN[i].kosten * 0.4;
    }

    function openFirmen() {
      var api = drawer('Firmen', function (body, self) { firmenInhalt(body, self); });
      nachbauen(api, function (body) { firmenInhalt(body, api); });
    }

    function firmenInhalt(body, self) {
      var s = st.s;
      var lage = S.lage(s);
      var i;

      var offen = {};
      for (i = 0; i < D.FIRMEN.length; i++) if (sichtbar(s, i)) offen[D.FIRMEN[i].branche] = true;
      var reiter = [{ id: 'alle', label: 'Alle' }];
      D.BRANCHEN.forEach(function (b) {
        if (offen[b.id]) reiter.push({ id: b.id, label: b.icon + ' ' + b.name });
      });
      if (st.brancheReiter !== 'alle' && !offen[st.brancheReiter]) st.brancheReiter = 'alle';
      if (reiter.length > 2) {
        body.appendChild(UI.tabs(reiter, function (id) {
          st.brancheReiter = id;
          self.rebuild();
        }, st.brancheReiter));
      }

      var mengen = UI.el('div.row.wrap', { style: { gap: '6px', marginBottom: '12px' } });
      [1, 10, 100, 'max'].forEach(function (m) {
        mengen.appendChild(UI.btn(m === 'max' ? 'max' : '×' + m, function () {
          st.kaufMenge = m;
          self.rebuild();
        }, 'sm' + (st.kaufMenge === m ? ' primary' : ' ghost')));
      });
      body.appendChild(mengen);

      var gezeigt = 0;
      for (i = 0; i < D.FIRMEN.length; i++) {
        var def = D.FIRMEN[i];
        if (!sichtbar(s, i)) continue;
        if (st.brancheReiter !== 'alle' && def.branche !== st.brancheReiter) continue;
        body.appendChild(firmenKarte(def, lage, self));
        gezeigt++;
      }
      if (!gezeigt) {
        body.appendChild(UI.empty('🏢', 'Nichts in Sicht',
          'In dieser Branche ist noch nichts zu haben.'));
      }
    }

    function firmenKarte(def, lage, self) {
      var s = st.s;
      var br = D.branche(def.branche);
      var stufe = s.firmen[def.id] || 0;
      var l = lage[def.branche] || { konj: 1, saettigung: 1, ereignis: 1 };

      var menge = st.kaufMenge === 'max'
        ? Math.max(1, S.maxStufen(s, def.id)) : st.kaufMenge;
      var preis = D.firmenPreisMenge(def, stufe, menge);
      var machbar = s.geld >= preis;

      var karte = farbig(UI.el('div.biz-firma' + (stufe ? '' : '.neu')), br);

      karte.appendChild(UI.el('div.biz-kopf', null, [
        UI.el('div.ic', { text: def.icon }),
        UI.el('div.nm', null, [
          UI.el('div.t', null, [def.name, br ? UI.el('span.biz-chip', { text: br.name }) : null]),
          UI.el('div.s', { text: def.text }),
        ]),
        stufe ? UI.el('div.biz-stufe', { text: 'Stufe ' + stufe }) : null,
      ]));

      if (stufe) {
        var eff = S.firmenErtragEff(s, def.id, lage) * S.faktor(s, 'firmen');
        karte.appendChild(UI.el('div.biz-zahlen', null, [
          UI.el('div.gross', { text: euroFein(eff) + ' / s' }),
          UI.el('div.klein', { text: 'unverändert wären es ' + euroFein(S.firmenErtrag(s, def.id)) }),
        ]));

        var mods = UI.el('div.biz-mods');
        mods.appendChild(modChip('Konjunktur', l.konj));
        if (l.saettigung < 0.995) mods.appendChild(modChip('Marktsättigung', l.saettigung));
        if (Math.abs((l.ereignis || 1) - 1) > 0.001) mods.appendChild(modChip('Ereignis', l.ereignis));
        if (def.zulieferer) {
          var zb = D.branche(def.zulieferer);
          mods.appendChild(modChip('Zulieferer ' + (zb ? zb.name : ''), S.lieferBonus(s, def)));
        }
        karte.appendChild(mods);

        var rest = stufe % D.MEILENSTEIN;
        karte.appendChild(UI.el('div.biz-fort', null, [
          UI.el('i', { style: { width: (rest / D.MEILENSTEIN * 100) + '%' } }),
        ]));
        karte.appendChild(UI.el('div.klein', {
          style: { marginTop: '4px', fontSize: '11px', color: 'var(--dim)' },
          text: 'noch ' + (D.MEILENSTEIN - rest) + ' Stufen bis zur nächsten Verdopplung',
        }));
      } else {
        var hinweis = euroFein(def.ertrag) + ' je Sekunde und Stufe';
        if (def.zulieferer) {
          var zb2 = D.branche(def.zulieferer);
          hinweis += ' · kauft bei ' + (zb2 ? zb2.name : def.zulieferer) + ' ein';
        }
        karte.appendChild(UI.el('div.biz-zahlen', null, [
          UI.el('div.klein', { text: hinweis }),
        ]));
      }

      var kaufBtn = UI.btn((menge > 1 ? '×' + menge + ' · ' : '') + U.euro(preis, true), function () {
        handeln(function () { return S.firmaKaufen(s, def.id, menge); }, self);
      }, 'sm' + (machbar ? ' primary' : ' ghost'));
      if (!machbar) kaufBtn.disabled = true;

      var fuss = UI.el('div.biz-fuss', null, [kaufBtn]);
      if (stufe) {
        fuss.appendChild(UI.btn('−1', function () {
          handeln(function () { return S.firmaVerkaufen(s, def.id, 1); }, self);
        }, 'sm ghost eng'));
      }
      karte.appendChild(fuss);

      if (stufe) {
        var haben = s.ausbau[def.id] || 0;
        var reihe = UI.el('div.biz-ausbau');
        for (var k = 0; k < D.AUSBAU.length; k++) {
          reihe.appendChild(UI.el('div.stufe' + (k < haben ? '.on' : ''), {
            text: D.ausbauName(def.branche, k),
          }));
        }
        karte.appendChild(reihe);

        var naechster = S.ausbauNaechster(s, def.id);
        if (naechster) {
          var apreis = D.ausbauPreis(def, haben);
          var frei = stufe >= naechster.abStufe;
          var ab = UI.btn(frei
            ? D.ausbauName(def.branche, haben) + ' · ' + U.euro(apreis, true)
              + '  <span style="opacity:.7">×' + naechster.faktor + '</span>'
            : D.ausbauName(def.branche, haben) + ' ab Stufe ' + naechster.abStufe,
            function () { handeln(function () { return S.ausbauKaufen(s, def.id); }, self); },
            'sm wide' + (frei && s.geld >= apreis ? ' primary' : ' ghost'));
          if (!frei || s.geld < apreis) ab.disabled = true;
          ab.style.marginTop = '7px';
          karte.appendChild(ab);
        }
      }

      return karte;
    }

    /* ---------------------------------------------------------- Branchen */

    function openBranchen() {
      var api = drawer('Branchen', function (body, self) { branchenInhalt(body, self); });
      nachbauen(api, function (body) { branchenInhalt(body, api); });
    }

    function branchenInhalt(body, self) {
      var s = st.s;
      var lage = S.lage(s);

      body.appendChild(UI.el('p.small.muted', {
        text: 'Jede Branche hat ihre eigene Konjunktur und ihren eigenen Markt. '
          + 'Wer alles in eine Branche steckt, fährt jede Welle voll mit und stößt '
          + 'irgendwann an die Marktgrenze.',
      }));

      D.BRANCHEN.forEach(function (br) {
        var l = lage[br.id];
        var karte = farbig(UI.el('div.biz-branche' + (l.firmen ? '' : '.aus')), br);

        var ertrag = 0;
        D.firmenDerBranche(br.id).forEach(function (f) {
          ertrag += S.firmenErtragEff(s, f.id, lage);
        });
        ertrag *= S.faktor(s, 'firmen');

        karte.appendChild(UI.el('div.biz-bkopf', null, [
          UI.el('div.ic', { text: br.icon }),
          UI.el('div.nm', { text: br.name }),
          UI.el('div.wert', {
            text: l.firmen ? euroFein(ertrag) + ' / s' : '—',
            style: { color: l.firmen ? 'var(--green)' : 'var(--dim)' },
          }),
        ]));
        karte.appendChild(UI.el('div.small.muted', {
          style: { marginTop: '2px' }, text: br.text,
        }));

        var reihe = [];
        for (var d = -30; d <= 0; d++) reihe.push(S.konjunktur(s, br.id, d));
        karte.appendChild(UI.chart(reihe, { height: 38, color: br.farbe }));

        var messe = UI.el('div.biz-messe');
        var kp = (l.konj - 1) * 100;
        messe.appendChild(UI.el('div.zeile', null, [
          UI.el('span', { text: 'Konjunktur (30 Tage, letzter Punkt heute)' }),
          UI.el('b', {
            text: (kp >= 0 ? '+' : '') + U.num(kp, 0) + ' %',
            style: { color: kp >= 0 ? 'var(--green)' : 'var(--red)' },
          }),
        ]));

        if (l.firmen) {
          var aus = l.markt > 0 ? l.roh / l.markt : 0;
          messe.appendChild(UI.el('div.zeile', null, [
            UI.el('span', { text: 'Marktauslastung' }),
            UI.el('b', { text: U.num(aus * 100, 0) + ' %' }),
          ]));
          messe.appendChild(UI.el('div.balken', null, [
            UI.el('i' + (aus > 2 ? '.bad' : (aus > 1 ? '.warn' : '')), {
              style: { width: (U.clamp(aus, 0, 1) * 100) + '%' },
            }),
          ]));
          if (l.saettigung < 0.995) {
            messe.appendChild(UI.el('div.zeile', null, [
              UI.el('span', {
                text: 'Übersättigt — der Ertrag wird gedrückt',
                style: { color: 'var(--red)' },
              }),
              UI.el('b', {
                text: '−' + U.num((1 - l.saettigung) * 100, 0) + ' %',
                style: { color: 'var(--red)' },
              }),
            ]));
          }
          messe.appendChild(UI.el('div.zeile', null, [
            UI.el('span', { text: 'Betriebe · Marktvolumen' }),
            UI.el('b', { text: l.firmen + ' · ' + euroFein(l.markt) + ' / s' }),
          ]));
        }
        karte.appendChild(messe);

        var preis = S.marktPreis(s, br.id);
        if (preis !== null) {
          var kampagnen = s.markt[br.id] || 0;
          var b = UI.btn('📣 Werbekampagne · ' + U.euro(preis, true), function () {
            handeln(function () { return S.marktKaufen(s, br.id); }, self);
          }, 'sm wide' + (s.geld >= preis ? ' primary' : ' ghost'));
          if (s.geld < preis) b.disabled = true;
          karte.appendChild(b);
          karte.appendChild(UI.el('div.small.muted', {
            style: { marginTop: '5px', fontSize: '11px' },
            text: 'Hebt den Markt dauerhaft um '
              + Math.round((D.MARKT_SCHUB - 1) * 100) + ' Prozent'
              + (kampagnen ? ' · bisher ' + kampagnen + ' Kampagnen' : '')
              + ' · gilt als Betriebsausgabe und senkt die Steuer.',
          }));
        } else {
          karte.appendChild(UI.el('div.small.muted', {
            text: 'Noch kein eigener Betrieb in dieser Branche.',
          }));
        }
        body.appendChild(karte);
      });
    }

    /* ---------------------------------------------------------- Bank */

    function betragsfeld(max) {
      max = Math.floor(Math.max(0, max));
      var feld = UI.el('input', {
        type: 'number', value: String(max), min: '0', max: String(max),
        style: {
          width: '100%', height: '46px', background: '#0b0e15',
          border: '1px solid var(--line)', borderRadius: '10px',
          color: 'var(--text)', padding: '0 12px', outline: 'none', fontSize: '17px',
        },
      });
      var knoepfe = UI.el('div.row.wrap', { style: { gap: '6px', margin: '8px 0 10px' } }, [
        UI.btn('Viertel', function () { feld.value = String(Math.floor(max / 4)); }, 'sm ghost'),
        UI.btn('Hälfte', function () { feld.value = String(Math.floor(max / 2)); }, 'sm ghost'),
        UI.btn('Alles', function () { feld.value = String(max); }, 'sm ghost'),
      ]);
      return {
        el: UI.el('div', null, [feld, knoepfe]),
        wert: function () { return U.clamp(Math.floor(Number(feld.value) || 0), 0, max); },
      };
    }

    function openBank() {
      var api = drawer('Bank', function (body, self) { bankInhalt(body, self); });
      nachbauen(api, function (body) { bankInhalt(body, api); });
    }

    function bankInhalt(body, self) {
      var s = st.s;
      var rahmen = S.kreditRahmen(s);
      var schuld = s.schuld || 0;

      body.appendChild(UI.el('div.biz-gross-dazu', {
        text: schuld > 0 ? 'Offene Schuld' : 'Freier Kreditrahmen',
      }));
      body.appendChild(UI.el('div.biz-gross.' + (schuld > 0 ? 'schuld' : 'frei'), {
        text: U.euro(schuld > 0 ? schuld : rahmen, true),
      }));

      body.appendChild(UI.el('div.kv', { style: { marginTop: '12px' } }, [
        zeileKV('Sicherheiten', U.euro(S.sicherheiten(s), true)),
        zeileKV('davon Firmenwert', U.euro(S.firmenwert(s), true)),
        zeileKV('Rahmen noch frei', U.euro(rahmen, true)),
        zeileKV('Zins je Tag', U.num(D.KREDIT.zinsTag * 100, 2) + ' % · '
          + U.euro(S.zinsTag(s), true)),
        zeileKV('Zinsen insgesamt', U.euro(s.stat.zinsen || 0, true)),
      ]));

      body.appendChild(UI.el('p.small.muted', {
        text: 'Die Bank beleiht Firmen, Depot, Immobilien und Wohnsitz mit '
          + U.pct(D.KREDIT.quote) + '. Zinsen laufen täglich, mindern aber den '
          + 'steuerpflichtigen Gewinn. Reicht die Kasse nicht, wachsen sie in die '
          + 'Schuld hinein — und ab ' + U.pct(D.KREDIT.notgrenze)
          + ' der Sicherheiten verwertet die Bank selbst: erst Depot, dann Immobilien.',
      }));

      if (schuld > S.sicherheiten(s) * D.KREDIT.notgrenze * 0.75) {
        body.appendChild(UI.el('div.notice.warn', {
          style: { margin: '10px 0' },
          html: '<b>Der Kredit wird knapp gedeckt.</b><br>'
            + 'Noch eine Flaute, und die Bank greift ins Depot.',
        }));
      }

      if (rahmen >= 1) {
        var feld = betragsfeld(rahmen);
        body.appendChild(UI.el('div.sec-head', null, [UI.el('h2', { text: 'Kredit aufnehmen' })]));
        body.appendChild(feld.el);
        body.appendChild(UI.btn('Aufnehmen', function () {
          handeln(function () { return S.kreditAufnehmen(s, feld.wert()); }, self);
        }, 'wide primary'));
      } else if (schuld <= 0) {
        body.appendChild(UI.el('div.notice', {
          style: { margin: '10px 0' },
          text: 'Ohne Sicherheiten gibt die Bank nichts. Ein erster Betrieb genügt schon.',
        }));
      }

      if (schuld > 0) {
        var feld2 = betragsfeld(Math.min(schuld, s.geld));
        body.appendChild(UI.el('div.sec-head', null, [UI.el('h2', { text: 'Tilgen' })]));
        body.appendChild(feld2.el);
        body.appendChild(UI.btn('Tilgen', function () {
          handeln(function () { return S.kreditTilgen(s, feld2.wert()); }, self);
        }, 'wide'));
      }
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

    /* ---------------------------------------------------------- Ansehen */

    /* Wohnsitz und Luxus stehen zusammen in einer Schublade: beide zahlen
       auf dieselbe Zahl ein, und die entscheidet ueber die oberen Raenge. */
    function openAnsehen() {
      var api = drawer('Ansehen', function (body, self) { ansehenInhalt(body, self); });
      nachbauen(api, function (body) { ansehenInhalt(body, api); });
    }

    function ansehenInhalt(body, self) {
      var s = st.s;
      var reiter = st.ansehenReiter || 'wohnen';

      body.appendChild(UI.tabs([
        { id: 'wohnen', label: '🏡 Wohnen' },
        { id: 'luxus', label: '💎 Luxus' },
      ], function (id) { st.ansehenReiter = id; self.rebuild(); }, reiter));

      var rang = S.rang(s);
      var naechster = null;
      for (var i = 0; i < D.RAENGE.length; i++) {
        if (D.RAENGE[i].ab > S.vermoegen(s) || D.RAENGE[i].ansehen > S.ansehen(s)) {
          naechster = D.RAENGE[i]; break;
        }
      }
      body.appendChild(UI.el('div.kv', null, [
        zeileKV('Ansehen', String(S.ansehen(s))),
        zeileKV('Rang', rang.name),
        naechster ? zeileKV('Für ' + naechster.name + ' nötig', naechster.ansehen + ' Ansehen') : null,
      ]));

      if (reiter === 'wohnen') residenzInhalt(body);
      else luxusInhalt(body);
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
        var rest = D.STEUER_FRIST - (s.steuerOffenMonate || 0);
        body.appendChild(UI.el('div.notice.' + (rest <= 1 ? 'bad' : 'warn'), {
          style: { margin: '10px 0' },
          html: '<b>Offen: ' + U.euro(s.steuerFaellig) + '</b><br>'
            + (s.steuerOffenMonate
              ? 'Seit ' + s.steuerOffenMonate + ' ' + U.plural(s.steuerOffenMonate, 'Monat', 'Monaten')
                + ' überfällig. Jeden Monat kommen 5 Prozent Säumniszuschlag dazu'
                + (rest > 0
                  ? ', und in ' + rest + ' ' + U.plural(rest, 'Monat', 'Monaten')
                    + ' zieht das Finanzamt Depot und Immobilien ein.'
                  : '. Die Vollstreckung läuft bereits.')
              : 'Solange etwas offen ist, schaut das Finanzamt genauer hin.'),
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
        var i;
        var naechster = null;
        for (i = 0; i < D.RAENGE.length; i++) {
          if (D.RAENGE[i].ab > S.vermoegen(s) || D.RAENGE[i].ansehen > S.ansehen(s)) {
            naechster = D.RAENGE[i]; break;
          }
        }

        /* Vermoegenskurve. Ein Punkt je Spieltag, hoechstens die letzten
           sechzig - mehr sagt auf dem kleinen Bild nichts mehr aus. */
        if (s.verlauf && s.verlauf.length > 2) {
          var werte = s.verlauf.slice(-60).map(function (p) { return p.v; });
          body.appendChild(UI.el('div.small.muted', { text: 'Vermögen der letzten '
            + Math.min(60, s.verlauf.length) + ' Tage' }));
          body.appendChild(UI.chart(werte, { height: 96, color: '#3ddc84', fill: 'rgba(61,220,132,.28)' }));
        }

        body.appendChild(UI.el('div.kv', null, [
          zeileKV('Rang', rang.name),
          zeileKV('Vermögen', U.euro(S.vermoegen(s), true)),
          zeileKV('Konto', U.euro(s.geld, true)),
          zeileKV('Firmenwert', U.euro(S.firmenwert(s), true)),
          zeileKV('Depot', U.euro(S.depotwert(s), true)),
          zeileKV('Immobilien', U.euro(S.immobilienwert(s), true)),
          (s.schuld > 0 ? zeileKV('Schulden', '− ' + U.euro(s.schuld, true)) : null),
          zeileKV('Ansehen', String(S.ansehen(s))),
          zeileKV('Insgesamt verdient', U.euro(s.verdientGesamt, true)),
          zeileKV('Tipps am Schreibtisch', U.num(s.tipps)),
          zeileKV('Spieltage', U.num(s.tag)),
        ]));

        if (naechster) {
          body.appendChild(UI.el('div.notice', {
            style: { margin: '10px 0' },
            html: '<b>Nächster Rang: ' + naechster.name + '</b><br>' + fehltText(naechster),
          }));
        }

        /* Welche Branche traegt das Geschaeft? Ein Balken sagt das
           schneller als zehn Zeilen Zahlen. */
        var summe = 0, teile = [];
        for (i = 0; i < D.BRANCHEN.length; i++) {
          var br = D.BRANCHEN[i];
          var wert = (s.stat.branchen && s.stat.branchen[br.id]) || 0;
          if (wert > 0) { teile.push({ br: br, wert: wert }); summe += wert; }
        }
        if (summe > 0) {
          teile.sort(function (a, b) { return b.wert - a.wert; });
          body.appendChild(UI.el('div.sec-head', null, [
            UI.el('h2', { text: 'Woher der Firmenertrag kam' }),
          ]));
          var balken = UI.el('div.biz-anteile');
          var legende = UI.el('div.biz-legende');
          teile.forEach(function (t) {
            balken.appendChild(UI.el('i', {
              style: { width: (t.wert / summe * 100) + '%', background: t.br.farbe },
            }));
            var punkt = UI.el('i');
            punkt.style.background = t.br.farbe;
            legende.appendChild(UI.el('span', null, [
              punkt, t.br.name + ' ' + anteilText(t.wert / summe),
            ]));
          });
          body.appendChild(balken);
          body.appendChild(legende);
        }

        body.appendChild(UI.el('div.sec-head', null, [UI.el('h2', { text: 'Woher das Geld kam' })]));
        body.appendChild(UI.el('div.kv', null, [
          zeileKV('Firmen', U.euro(s.stat.firmenErtrag, true)),
          zeileKV('Mieten', U.euro(s.stat.mieten, true)),
          zeileKV('Dividenden', U.euro(s.stat.dividenden, true)),
          zeileKV('Steuern gezahlt', U.euro(s.stat.steuern, true)),
          zeileKV('Zinsen gezahlt', U.euro(s.stat.zinsen || 0, true)),
          zeileKV('Werbung', U.euro(s.stat.werbung || 0, true)),
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

    /* Nur nennen, was wirklich noch fehlt. Eine Bedingung, die laengst
       erfuellt ist, liest sich sonst wie eine Huerde. */
    function fehltText(rang) {
      var s = st.s, fehlt = [];
      if (S.vermoegen(s) < rang.ab) fehlt.push(U.euro(rang.ab, true) + ' Vermögen');
      if (S.ansehen(s) < rang.ansehen) fehlt.push(rang.ansehen + ' Ansehen');
      return fehlt.length ? 'Es fehlt noch: ' + fehlt.join(' und ') + '.' : 'Gleich so weit.';
    }

    function anteilText(anteil) {
      var p = anteil * 100;
      return (p > 0 && p < 0.5 ? '<1' : U.num(p, 0)) + ' %';
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
              { ic: '🔧', text: 'Ab Stufe ' + D.AUSBAU[0].abStufe + ' lässt sich eine Firma '
                + '<b>ausbauen</b>. Drei Ausbaustufen wirken auf den ganzen Betrieb — '
                + 'zusammen das Neunfache.' },
            ],
          },
          {
            kicker: 'Der Kern des Spiels', title: 'Branchen und Zulieferer',
            art: function (c, w, h) {
              var farben = ['#8bc34a', '#ff8f5e', '#7c6cff', '#4aa3ff', '#ffd166'];
              for (var i = 0; i < 5; i++) {
                var x = w * (0.09 + i * 0.185);
                var hh = h * (0.18 + Math.abs(Math.sin(i * 1.7)) * 0.4);
                G.fillRound(c, x, h * 0.72 - hh, w * 0.13, hh, 5, farben[i]);
              }
              c.strokeStyle = 'rgba(255,255,255,.35)';
              c.lineWidth = 2;
              c.beginPath();
              for (var k = 0; k <= 40; k++) {
                var px = w * (0.06 + k / 40 * 0.88);
                var py = h * 0.28 + Math.sin(k / 40 * Math.PI * 3) * h * 0.1;
                if (k === 0) c.moveTo(px, py); else c.lineTo(px, py);
              }
              c.stroke();
            },
            body: [
              'Jede Firma gehört zu einer <b>Branche</b>. Jede Branche hat ihre '
                + 'eigene Konjunktur — Technologie schwankt wild, Gesundheit kaum.',
              { ic: '🔗', text: 'Manche Firmen kaufen bei einer anderen Branche ein. '
                + 'Wer den <b>Zulieferer selbst besitzt</b>, verdient bis zu '
                + Math.round(D.LIEFER_MAX * 100) + ' Prozent mehr. Eine Bäckerei '
                + 'neben dem eigenen Gutshof rechnet sich doppelt.' },
              { ic: '📣', text: 'Und jeder Markt ist endlich: Wer alles in eine Branche '
                + 'stapelt, verkauft irgendwann unter Wert. Eine Werbekampagne hebt '
                + 'den Markt — oder man geht einfach in die nächste Branche.' },
            ],
          },
          {
            kicker: 'Fremdes Geld', title: 'Die Bank leiht, die Bank holt',
            art: function (c, w, h) {
              G.fillRound(c, w * 0.2, h * 0.42, w * 0.6, h * 0.36, 6, '#e9edf6');
              c.fillStyle = '#8794b1';
              for (var i = 0; i < 5; i++) {
                c.fillRect(w * (0.25 + i * 0.11), h * 0.46, w * 0.045, h * 0.28);
              }
              G.poly(c, [
                [w * 0.15, h * 0.42], [w * 0.5, h * 0.2], [w * 0.85, h * 0.42],
              ], '#f0b429', true);
              G.text(c, '€', w * 0.5, h * 0.86, {
                font: G.font(Math.round(h * 0.18), 700), fill: '#3ddc84',
                align: 'center', baseline: 'middle',
              });
            },
            body: [
              'Die Bank beleiht Firmen, Depot und Immobilien mit '
                + Math.round(D.KREDIT.quote * 100) + ' Prozent. Geliehenes Geld '
                + 'kauft die nächste Firma sofort statt in zehn Minuten.',
              { ic: '⚠', text: 'Zinsen laufen <b>jeden Tag</b>. Ist die Kasse leer, '
                + 'wachsen sie in die Schuld hinein — und ab '
                + Math.round(D.KREDIT.notgrenze * 100) + ' Prozent der Sicherheiten '
                + 'verkauft die Bank Depot und Immobilien selbst.' },
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
      rProSek.set(euroFein(S.ertragGesamt(s)));
      rVermoegen.set(U.euro(S.vermoegen(s), true));
      rAnsehen.set(String(S.ansehen(s)));
      rRang.set(S.rang(s).name);
      rSteuer.set(s.steuerFaellig > 0 ? U.euro(s.steuerFaellig, true) : '—');
      rSteuer.tint(s.steuerFaellig > 0 ? 'var(--red)' : '');
      bSteuer.classList.toggle('warn', s.steuerFaellig > 0);

      var schuld = s.schuld || 0;
      var eng = schuld > 0 && schuld > S.sicherheiten(s) * D.KREDIT.notgrenze * 0.75;
      rSchuld.style.display = schuld > 0 ? '' : 'none';
      rSchuld.set(U.euro(schuld, true));
      rSchuld.tint(eng ? 'var(--red)' : (schuld > 0 ? 'var(--gold)' : ''));
      bBank.classList.toggle('warn', eng);

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

    /* Das Bild erzaehlt denselben Weg wie die Zahlen: erst ein
       Schreibtisch vor einer flachen Vorstadt, spaeter ein Bueroturm
       ueber einer Skyline, die in den Farben der eigenen Branchen
       leuchtet. Dazu laeuft ein Tageslauf mit - ein Spieltag ist eine
       Umdrehung von Morgen bis Nacht. */
    function draw() {
      var s = st.s;
      var w = stage.w, h = stage.h;
      if (!s) return;
      var i;

      var stufe = 0;
      for (i = 0; i < D.RAENGE.length; i++) {
        if (S.vermoegen(s) >= D.RAENGE[i].ab) stufe = i;
      }

      var tz = (s.zeit % D.SEK_PRO_TAG) / D.SEK_PRO_TAG;
      var licht = U.clamp(Math.sin((tz - 0.22) * Math.PI * 2) * 0.5 + 0.5, 0, 1);
      var abend = U.clamp(1 - Math.abs(tz - 0.72) * 7, 0, 1);

      var oben = U.mixHex('#070a12', '#25406b', licht);
      var unten = U.mixHex('#0a0e17', '#4a5d82', Math.pow(licht, 0.7));
      unten = U.mixHex(unten, '#8a4a3c', abend * 0.55);
      ctx.fillStyle = G.linear(ctx, 0, 0, 0, h * 0.72, [0, oben, 1, unten]);
      ctx.fillRect(0, 0, w, h);

      // Sterne, solange es dunkel ist
      if (licht < 0.5) {
        var rngS = U.rng(99);
        ctx.fillStyle = 'rgba(255,255,255,' + ((0.5 - licht) * 1.4).toFixed(3) + ')';
        for (i = 0; i < 46; i++) {
          ctx.fillRect(Math.round(rngS() * w), Math.round(rngS() * h * 0.5), 1.6, 1.6);
        }
      }

      // Sonne und Mond ziehen ueber denselben Bogen
      var bx = w * (0.1 + tz * 0.8);
      var by = h * 0.46 - Math.sin(tz * Math.PI) * h * 0.3;
      if (licht > 0.12) {
        G.glow(ctx, bx, by, h * 0.16, '#ffd166', 0.22 * licht);
        G.circle(ctx, bx, by, h * 0.035, '#ffe7a8');
      } else {
        var mx = w * (0.9 - tz * 0.8);
        G.circle(ctx, mx, h * 0.2, h * 0.026, 'rgba(226,234,255,.85)');
      }

      skyline(w, h, stufe, licht);

      // Der Raum: alles unterhalb der Fensterkante gehoert zum Schreibtisch
      var tischH = Math.min(h * 0.3, 190);
      var tischY = h - tischH - 8;
      ctx.fillStyle = G.linear(ctx, 0, tischY - 40, 0, h, [0, 'rgba(8,11,17,0)', 1, '#080b11']);
      ctx.fillRect(0, tischY - 40, w, h - tischY + 40);

      G.fillRound(ctx, w * 0.06, tischY, w * 0.88, tischH, 16, '#1b2233');
      ctx.fillStyle = 'rgba(255,255,255,.05)';
      ctx.fillRect(w * 0.06, tischY, w * 0.88, 3);

      // Bildschirm mit Kontostand und Vermoegenskurve
      var bw = Math.min(w * 0.5, 320), bh = bw * 0.44;
      var bxx = w / 2 - bw / 2, byy = tischY - bh - 8;
      G.fillRound(ctx, bxx, byy, bw, bh, 9, '#0a0d14');
      G.strokeRound(ctx, bxx, byy, bw, bh, 9, 'rgba(240,180,41,.35)', 1.5);
      kurveImBildschirm(bxx + 8, byy + bh * 0.52, bw - 16, bh * 0.36);
      G.fitText(ctx, U.euro(s.geld, true), bxx + bw / 2, byy + bh * 0.3, bw - 22, {
        font: G.font(Math.round(bh * 0.3), 700, true),
        fill: '#f0b429', align: 'center', baseline: 'middle',
      });
      G.text(ctx, S.rang(s).name, bxx + bw / 2, byy + bh * 0.87, {
        font: G.font(Math.round(bh * 0.14), 600),
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

      // Laufende Ereignisse, bis zu zwei nebeneinander unter der Kopfzeile
      var aktiv = S.aktiveEreignisse(s);
      var y = 10;
      for (i = 0; i < aktiv.length && i < 2; i++) {
        var def = aktiv[i];
        var txt = def.name + ' · noch ' + s.ereignisse[i].restTage + ' Tage';
        ctx.font = G.font(12, 650);
        var tw = ctx.measureText(txt).width + 22;
        G.fillRound(ctx, 12, y, tw, 26, 13,
          def.gut ? 'rgba(61,220,132,.2)' : 'rgba(255,95,107,.2)');
        G.text(ctx, txt, 12 + tw / 2, y + 13, {
          font: G.font(12, 650), fill: def.gut ? '#c8f3da' : '#ffd3d7',
          align: 'center', baseline: 'middle',
        });
        y += 30;
      }

      // Schulden mahnen sichtbar, nicht nur in der Kopfzeile
      if (s.schuld > 0) {
        G.text(ctx, '🏦 ' + U.euro(s.schuld, true) + ' Schulden', 12, h - 10, {
          font: G.font(11.5, 650), fill: 'rgba(255,95,107,.8)',
          align: 'left', baseline: 'bottom',
        });
      }
    }

    /* Kleine Vermoegenskurve auf dem Bildschirm. Bewusst ohne Achsen -
       sie soll nur zeigen, ob es hoch oder runter geht. */
    function kurveImBildschirm(x, y, w, h) {
      var s = st.s;
      var reihe = (s.verlauf || []).slice(-40);
      if (reihe.length < 3) return;
      var mn = Infinity, mx = -Infinity, i;
      for (i = 0; i < reihe.length; i++) {
        if (reihe[i].v < mn) mn = reihe[i].v;
        if (reihe[i].v > mx) mx = reihe[i].v;
      }
      if (!(mx > mn)) return;
      ctx.save();
      ctx.beginPath();
      for (i = 0; i < reihe.length; i++) {
        var px = x + (i / (reihe.length - 1)) * w;
        var py = y + h - (reihe[i].v - mn) / (mx - mn) * h;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = 'rgba(61,220,132,.75)';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.restore();
    }

    /* Trefferflaeche des Karriereknopfs. Wird aus den Buehnenmassen
       gerechnet, nicht beim Zeichnen gemerkt - sonst haengt die Bedienung
       daran, dass gerade ein Bild gezeichnet wurde. */
    function karriereFeld() {
      var w = stage.w, h = stage.h;
      var tischH = Math.min(h * 0.3, 190);
      var tischY = h - tischH - 8;
      var kbW = Math.min(w * 0.26, 170), kbH = 54;
      return { x: w * 0.09, y: tischY + tischH * 0.5 - kbH / 2, w: kbW, h: kbH };
    }

    /* Zwei Haeuserreihen hintereinander. Die vordere leuchtet in den
       Farben der Branchen, in denen tatsaechlich Betriebe stehen - wer
       sein Geld aus der Technik holt, sieht das an der Skyline. */
    function skyline(w, h, stufe, licht) {
      var s = st.s;
      var lage = S.lage(s);
      var farben = [];
      for (var b = 0; b < D.BRANCHEN.length; b++) {
        var br = D.BRANCHEN[b];
        if (lage[br.id] && lage[br.id].firmen) farben.push(br.farbe);
      }
      var basis = h * 0.64;

      reihe(basis - h * 0.03, 5 + stufe, 0.16 + stufe * 0.035, '#10151f', 0.35);
      reihe(basis, 7 + stufe * 2, 0.22 + stufe * 0.06, '#161d2b', 1);

      function reihe(grund, anzahl, hoch, grundfarbe, vorne) {
        var rng = U.rng(4242 + Math.round(anzahl));
        var x = -8;
        for (var i = 0; i < anzahl && x < w; i++) {
          var bw = w / anzahl * (0.55 + rng() * 0.95);
          var hoehe = grund * (0.22 + rng() * hoch);
          var farbe = grundfarbe;
          if (vorne === 1 && farben.length) {
            farbe = U.mixHex(grundfarbe, farben[i % farben.length], 0.1 + licht * 0.16);
          }
          ctx.fillStyle = farbe;
          ctx.fillRect(x + 2, grund - hoehe, bw - 4, hoehe);
          if (vorne === 1 && rng() < 0.3) {
            ctx.fillRect(x + bw * 0.5 - 1, grund - hoehe - 14, 2, 14);
          }

          // Fenster: nachts hell, tagsueber kaum zu sehen
          var glanz = (0.06 + stufe * 0.02) + (1 - licht) * 0.35 * vorne;
          ctx.fillStyle = 'rgba(240,180,41,' + Math.min(0.6, glanz).toFixed(3) + ')';
          for (var fy = grund - hoehe + 9; fy < grund - 9; fy += 13) {
            for (var fx = x + 9; fx < x + bw - 11; fx += 11) {
              if (rng() < 0.42) continue;
              ctx.fillRect(fx, fy, 4, 6);
            }
          }
          x += bw + 3;
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
    desc: 'Vom Aushilfsjob zum Imperium — elf Branchen, Lieferketten, Börse, Bank und Finanzamt',
    tags: ['wirtschaft', 'geld', 'aktien', 'immobilien', 'aufbau', 'tippen', 'business',
      'branchen', 'konjunktur', 'kredit'],
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
