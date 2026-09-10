/* ------------------------------------------------------------------
   Admin-Raum.

   Vier Reiter hinter einer Tuer, die nur Admins aufgeht:

     💬 Raum         eigener Chat, in dem nur Admins schreiben
     📜 Protokoll    was passiert ist - geloescht, gesperrt, angesehen
     📨 Anträge      was der BND beantragt hat, mit Annehmen/Ablehnen
     👁 Bildschirme  wer gerade was im Hideout macht

   Das Protokoll laesst sich nicht aendern und nicht loeschen. Ein
   Protokoll, das man frisieren kann, ist keines.
   ------------------------------------------------------------------ */

(function (SG) {
  var UI = SG.ui;
  var U = SG.util;
  var A = SG.auth;
  var Rel = SG.relais;

  var AR = SG.adminraum = {};

  AR.render = function (app) {
    UI.clear(app);
    if (!A.istAdmin()) { SG.router.go('#/'); return { destroy: function () { } }; }

    var reiter = SG.storage.get('adminraum:reiter', 'raum');
    var offen = null;                 // aktuelle Unteransicht
    var abmelder = [];

    app.appendChild(UI.el('div.topbar', null, [
      UI.el('button.back.btn.sm.ghost', {
        html: '‹ Zurück',
        on: { click: function () { SG.router.go('#/'); } },
      }),
      UI.el('div.spacer'),
      UI.el('div.brand-title', { text: '🛡 Admin-Raum' }),
      UI.el('div.spacer'),
      UI.frischKnopf(function () { bauen(); zahlSetzen(); }),
      UI.el('button.btn.sm.ghost', {
        html: '<span class="ico">⚙</span><span class="lbl">Verwaltung</span>',
        on: { click: function () { SG.admin.oeffnen(); } },
      }),
    ]));

    var rahmen = UI.el('div.adminraum');
    var tabs = UI.tabs([
      { id: 'raum', label: '💬 Raum' },
      { id: 'proto', label: '📜 Protokoll' },
      { id: 'antrag', label: '📨 Anträge' },
      { id: 'schirm', label: '👁 Bildschirme' },
    ], function (id) {
      reiter = id;
      SG.storage.set('adminraum:reiter', id);
      bauen();
    }, reiter);
    rahmen.appendChild(tabs);

    var inhalt = UI.el('div.adminraum-inhalt');
    rahmen.appendChild(inhalt);
    app.appendChild(rahmen);

    /* Ohne Relais ist hier alles leer - und zwar nicht, weil nichts
       passiert waere, sondern weil es niemanden gibt, der es
       aufschreibt. Das gehoert dazugesagt. */
    if (!Rel.verfuegbar()) {
      rahmen.insertBefore(UI.el('div.notice.warn', {
        style: { margin: '10px 0' },
        text: SG.offline
          ? 'Ohne Verbindung: Chat, Protokoll, Anträge und Bildschirme laufen '
            + 'über das Relais und sind in der Offline-Datei nicht dabei.'
          : 'Auf dieser Seite läuft kein Relais — die Netlify-Funktion fehlt. '
            + 'Chat, Protokoll, Anträge und Bildschirme bleiben deshalb leer.',
      }), inhalt);
    }

    /* Die Zahl offener Antraege gehoert an den Reiter - sonst muss man
       hineinsehen, um zu merken, dass etwas liegt. */
    abmelder.push(Rel.beobachten(SG.bnd.ANTRAEGE, function () {
      zahlSetzen();
      if (reiter === 'antrag') bauen();
    }));

    function zahlSetzen() {
      var k = Rel.kanal(SG.bnd.ANTRAEGE);
      var n = (k.nachrichten || []).filter(function (m) {
        return m.zusatz && m.status === undefined && !m.weg;
      }).length;
      var btn = tabs.children[2];
      if (btn) btn.textContent = '📨 Anträge' + (n ? ' (' + n + ')' : '');
    }

    bauen();
    zahlSetzen();

    function bauen() {
      if (offen && offen.destroy) { try { offen.destroy(); } catch (e) { /* egal */ } }
      offen = null;
      UI.clear(inhalt);
      if (reiter === 'raum') offen = raum(inhalt);
      else if (reiter === 'proto') offen = AR.protokollAnsicht(inhalt);
      else if (reiter === 'antrag') offen = antraege(inhalt);
      else offen = SG.spiegel.tafel(inhalt);
    }

    /* ---------------------------------------------------------- Raum */

    function raum(ziel) {
      var box = UI.el('div.chat-schirm.im-reiter');
      ziel.appendChild(box);
      return SG.chat.ansicht(box, {
        brett: 'admin',
        platzhalter: 'Nachricht an die Admins…',
        loeschen: true,
        leerIcon: '🛡',
        leerTitel: 'Admin-Raum',
        leerText: 'Hier lesen nur Admins mit. Bilder und Abstimmungen gehen auch.',
      });
    }

    /* ---------------------------------------------------------- Antraege */

    function antraege(ziel) {
      ziel.appendChild(UI.el('p.small.muted', {
        text: 'Anträge des Nachrichtendienstes. Bei „Annehmen" einer Sperrung '
          + 'ist der Zugang sofort dicht — auch mitten im Spiel.',
      }));
      var kasten = UI.el('div.antrag-liste');
      ziel.appendChild(kasten);

      function malen() {
        UI.clear(kasten);
        var k = Rel.kanal(SG.bnd.ANTRAEGE);
        var liste = (k.nachrichten || []).filter(function (m) { return m.zusatz && !m.weg; });
        if (!liste.length) {
          kasten.appendChild(UI.empty('📨', 'Keine Anträge',
            'Der BND stellt Anträge über die Akte einer Person.'));
          return;
        }
        var offene = liste.filter(function (m) { return m.status === undefined; });
        var alte = liste.filter(function (m) { return m.status !== undefined; });
        if (offene.length) {
          kasten.appendChild(UI.el('div.sec-head', null, [
            UI.el('h2', { text: 'Offen' }),
            UI.el('span.count', { text: String(offene.length) }),
          ]));
          offene.slice().reverse().forEach(function (m) {
            kasten.appendChild(SG.bnd.antragKarte(m, true));
          });
        }
        if (alte.length) {
          kasten.appendChild(UI.el('div.sec-head', null, [
            UI.el('h2', { text: 'Erledigt' }),
          ]));
          alte.slice().reverse().forEach(function (m) {
            kasten.appendChild(SG.bnd.antragKarte(m, false));
          });
        }
      }
      malen();
      var ab = Rel.beobachten(SG.bnd.ANTRAEGE, malen);
      return { destroy: ab };
    }

    return {
      destroy: function () {
        abmelder.forEach(function (f) { try { f(); } catch (e) { /* egal */ } });
        if (offen && offen.destroy) offen.destroy();
      },
    };
  };

  /* ==================================================================
     Protokollansicht - auch der BND benutzt sie
     ================================================================== */

  AR.protokollAnsicht = function (wurzel, filter) {
    var P = SG.protokoll;
    var kopf = UI.el('div.row.wrap', { style: { gap: '6px', marginBottom: '8px' } });
    var liste = UI.el('div.proto-liste');
    var suche = UI.el('input', {
      type: 'search', placeholder: 'Im Protokoll suchen…', className: 'feld',
    });
    UI.add(wurzel, [
      UI.el('p.small.muted', {
        text: 'Nur anhängen: Einträge lassen sich nicht ändern und nicht löschen. '
          + 'Die ältesten fallen heraus, wenn es zu lang wird.',
      }),
      suche, kopf, liste,
    ]);

    var nurArt = '';
    [
      { id: '', label: 'Alles' },
      { id: 'loeschen', label: '🗑 Gelöscht' },
      { id: 'bann', label: '⛔ Sperren' },
      { id: 'bnd', label: '🕵 BND' },
      { id: 'schirm', label: '👁 Bildschirm' },
      { id: 'code', label: '🎫 Codes' },
    ].forEach(function (f) {
      var b = UI.btn(f.label, function () {
        nurArt = f.id;
        [].forEach.call(kopf.children, function (x) {
          x.classList.remove('primary'); x.classList.add('ghost');
        });
        b.classList.remove('ghost'); b.classList.add('primary');
        malen();
      }, 'sm' + (f.id === nurArt ? ' primary' : ' ghost'));
      kopf.appendChild(b);
    });

    suche.addEventListener('input', malen);

    var daten = [];

    function malen() {
      UI.clear(liste);
      var q = (suche.value || '').trim().toLowerCase();
      var gefiltert = daten.filter(function (m) {
        if (m.weg) return false;
        if (filter && !filter(m)) return false;
        var art = (m.zusatz && m.zusatz.art) || 'info';
        if (nurArt && art !== nurArt) return false;
        if (!q) return true;
        return (m.text + ' ' + m.von + ' ' + art).toLowerCase().indexOf(q) >= 0;
      });

      if (!gefiltert.length) {
        liste.appendChild(UI.empty('📜', 'Nichts protokolliert',
          'Sobald etwas passiert, steht es hier.'));
        return;
      }

      var letzterTag = '';
      gefiltert.slice().reverse().forEach(function (m) {
        var d = new Date(m.t);
        var tag = d.toLocaleDateString('de-DE', {
          weekday: 'short', day: 'numeric', month: 'long',
        });
        if (tag !== letzterTag) {
          letzterTag = tag;
          liste.appendChild(UI.el('div.proto-tag', { text: tag }));
        }
        var art = P.art((m.zusatz && m.zusatz.art) || 'info');
        liste.appendChild(UI.el('div.proto-zeile', null, [
          UI.el('div.proto-ic', { text: art.icon }),
          UI.el('div.proto-haupt', null, [
            UI.el('div.proto-text', { text: m.text }),
            UI.el('div.proto-meta', {
              text: A.rolleIcon(m.rolle) + ' ' + m.von + ' · '
                + String(d.getHours()).padStart(2, '0') + ':'
                + String(d.getMinutes()).padStart(2, '0')
                + (m.zusatz && m.zusatz.ziel
                  ? ' · betrifft ' + (A.nameVon(m.zusatz.ziel) || A.bndKennung(m.zusatz.ziel))
                  : '')
                + (m.zusatz && m.zusatz.wo ? ' · ' + m.zusatz.wo : ''),
            }),
          ]),
        ]));
      });
    }

    var ab = Rel.beobachten(P.BRETT, function (nachrichten) {
      daten = nachrichten || [];
      malen();
    });
    Rel.starten();
    daten = Rel.kanal(P.BRETT).nachrichten || [];
    malen();

    return { destroy: ab };
  };
})(SG);
