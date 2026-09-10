/* ------------------------------------------------------------------
   Chatbretter.

   Ein Brett ist eine Liste von Nachrichten auf dem Relais. Was darin
   steht, ist dem Server egal - deshalb reicht dieselbe Ansicht fuer
   alles: den inneren Kreis, den Admin-Raum, das Protokoll, die
   Antraege und eine BND-Befragung.

   Eine Nachricht kann sein:
     Text       das Uebliche
     Bild       nur ein Verweis; Vorschau und Vollbild liegen getrennt
     Umfrage    Frage, Optionen, Stimmen je Code
     Karte      etwas Besonderes (Antrag, Protokolleintrag) in 'zusatz'

   Geloescht wird nicht spurlos: es bleibt ein Hinweis stehen, wer
   geloescht hat. Eine Nachricht, die einfach verschwindet, sieht aus
   wie ein Fehler - und im Protokoll soll ja stehen, was weg ist.
   ------------------------------------------------------------------ */

(function (SG) {
  var UI = SG.ui;
  var U = SG.util;
  var A = SG.auth;
  var Rel = SG.relais;

  var C = SG.chat = {};

  C.verfuegbar = function () { return Rel.verfuegbar(); };

  /* ------------------------------------------------------------------
     Bilder vorbereiten

     Zwei Groessen: eine winzige Vorschau fuer die Liste und das grosse
     Bild fuers Antippen. Die Vorschau haelt das Brett leicht - sonst
     muesste bei jeder neuen Nachricht alles noch einmal ueber die
     Leitung.
     ------------------------------------------------------------------ */

  function ausDatei(datei, maxKante, guete) {
    return new Promise(function (fertig, schief) {
      if (!datei || !/^image\//.test(datei.type || '')) {
        schief(new Error('kein_bild'));
        return;
      }
      var url;
      try { url = URL.createObjectURL(datei); } catch (e) { schief(e); return; }
      var img = new Image();
      img.onload = function () {
        var w = img.naturalWidth || img.width;
        var h = img.naturalHeight || img.height;
        var f = Math.min(1, maxKante / Math.max(w, h));
        var zw = Math.max(1, Math.round(w * f));
        var zh = Math.max(1, Math.round(h * f));
        var cv = document.createElement('canvas');
        cv.width = zw; cv.height = zh;
        var c = cv.getContext('2d');
        c.fillStyle = '#ffffff';
        c.fillRect(0, 0, zw, zh);
        c.drawImage(img, 0, 0, zw, zh);
        var out;
        try { out = cv.toDataURL('image/jpeg', guete); }
        catch (e) { try { URL.revokeObjectURL(url); } catch (e2) { /* egal */ } schief(e); return; }
        try { URL.revokeObjectURL(url); } catch (e) { /* egal */ }
        fertig({ data: out, w: zw, h: zh, echtW: w, echtH: h });
      };
      img.onerror = function () {
        try { URL.revokeObjectURL(url); } catch (e) { /* egal */ }
        schief(new Error('kein_bild'));
      };
      img.src = url;
    });
  }

  C.bildVorbereiten = function (datei) {
    return Promise.all([
      ausDatei(datei, 1280, 0.72),
      ausDatei(datei, 240, 0.5),
    ]).then(function (beide) {
      return { voll: beide[0], mini: beide[1] };
    });
  };

  /* ------------------------------------------------------------------
     Ansicht

     opts:
       brett        Name auf dem Relais
       schreiben    darf hier geschrieben werden?
       loeschen     darf hier geloescht werden? (Admin)
       bilder       Bildknopf zeigen?
       umfragen     Umfrageknopf zeigen?
       karte        Funktion(nachricht) -> Element fuer besondere Karten
       leerIcon/leerTitel/leerText
       aufNeu       Funktion(nachricht) bei jeder neuen fremden Nachricht
     ------------------------------------------------------------------ */

  C.ansicht = function (wurzel, opts) {
    opts = opts || {};
    var brett = opts.brett || 'kreis';
    /* 'absender' setzt Name und Rolle von Hand - gebraucht an der Tuer,
       wo noch niemand angemeldet ist. */
    var ich = opts.absender || A.aktuell || { code: '', name: '', rolle: 'S' };

    var liste = UI.el('div.chatliste');
    wurzel.appendChild(liste);

    var leiste = null, feld = null;
    if (opts.schreiben !== false) {
      feld = UI.el('textarea.chat-feld', {
        placeholder: opts.platzhalter || 'Nachricht…', maxLength: 1000, rows: 1,
      });
      var knoepfe = [];
      if (opts.bilder !== false) {
        knoepfe.push(UI.el('button.chat-extra', {
          html: '🖼', 'aria-label': 'Bild senden', type: 'button',
          on: { click: function () { bildWaehlen(); } },
        }));
      }
      if (opts.umfragen !== false) {
        knoepfe.push(UI.el('button.chat-extra', {
          html: '📊', 'aria-label': 'Umfrage', type: 'button',
          on: { click: function () { umfrageDialog(); } },
        }));
      }
      var senden = UI.el('button.chat-senden', { html: '➤', 'aria-label': 'Senden' });
      leiste = UI.el('div.chat-leiste', null, knoepfe.concat([feld, senden]));
      wurzel.appendChild(leiste);

      senden.addEventListener('click', abschicken);
      feld.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); abschicken(); }
      });
      feld.addEventListener('input', function () {
        feld.style.height = 'auto';
        feld.style.height = Math.min(120, feld.scrollHeight) + 'px';
      });
    }

    if (!C.verfuegbar()) {
      liste.appendChild(UI.empty('🌐', 'Kein Chat ohne Verbindung',
        SG.offline
          ? 'Der Chat läuft über das Relais und ist in der Offline-Datei nicht dabei.'
          : 'Auf dieser Seite läuft kein Relais — die Netlify-Funktion fehlt.'));
      if (leiste) leiste.style.display = 'none';
      return { destroy: function () { } };
    }

    var laden = UI.el('div.chat-laedt', { text: 'Verbinde…' });
    liste.appendChild(laden);

    var gezeichnet = {};      // id -> Element
    var erstesMal = true;

    function amEnde() {
      return liste.scrollTop + liste.clientHeight >= liste.scrollHeight - 80;
    }

    function zeichne(nachrichten) {
      var unten = amEnde() || erstesMal;
      UI.remove(laden);
      var leerEl = liste.querySelector('.empty');

      if (!nachrichten.length) {
        if (!leerEl) {
          liste.appendChild(UI.empty(opts.leerIcon || '💬',
            opts.leerTitel || 'Noch nichts hier',
            opts.leerText || 'Schreib die erste Nachricht.'));
        }
        return;
      }
      if (leerEl) UI.remove(leerEl);

      nachrichten.forEach(function (m) {
        var alt = gezeichnet[m.id];
        var neu = zeile(m);
        if (alt) {
          liste.replaceChild(neu, alt);
        } else {
          liste.appendChild(neu);
          if (!erstesMal && m.code !== ich.code && opts.aufNeu) opts.aufNeu(m);
        }
        gezeichnet[m.id] = neu;
      });

      if (unten) liste.scrollTop = liste.scrollHeight;
      erstesMal = false;
    }

    /* ---------------------------------------------------------- Zeile */

    function zeile(m) {
      var selbst = m.code ? m.code === ich.code : m.von === ich.name;

      if (m.weg) {
        return UI.el('div.chat-msg.chat-weg', null, [
          UI.el('div.chat-text', {
            text: '🗑 Nachricht von ' + m.von + ' wurde von ' + m.weg.von + ' gelöscht',
          }),
        ]);
      }

      var inhalt = [];
      inhalt.push(UI.el('div.chat-kopf', {
        text: kopfText(m),
      }));

      if (opts.karte && m.zusatz) {
        var k = opts.karte(m);
        if (k) inhalt.push(k);
      }

      if (m.text) inhalt.push(UI.el('div.chat-text', { text: m.text }));
      if (m.bild) inhalt.push(bildBlock(m));
      if (m.umfrage) inhalt.push(umfrageBlock(m));

      var el = UI.el('div.chat-msg' + (selbst ? '.selbst' : ''), null, inhalt);

      /* Loeschen: langes Druecken oder Rechtsklick. Absichtlich kein
         sichtbarer Knopf an jeder Nachricht - der stuende im Weg. */
      if (opts.loeschen && A.istAdmin()) {
        var timer = 0;
        var start = function () {
          clearTimeout(timer);
          timer = setTimeout(function () { menue(m); }, 550);
        };
        var stopp = function () { clearTimeout(timer); };
        el.addEventListener('pointerdown', start);
        el.addEventListener('pointerup', stopp);
        el.addEventListener('pointerleave', stopp);
        el.addEventListener('pointercancel', stopp);
        el.addEventListener('contextmenu', function (e) {
          e.preventDefault();
          menue(m);
        });
        el.classList.add('chat-haltbar');
      }
      return el;
    }

    function kopfText(m) {
      var extra = A.hatBnd(m.code) ? ' 🕵' : '';
      return A.rolleIcon(m.rolle) + extra + ' ' + m.von + ' · ' + zeit(m.t);
    }

    function zeit(t) {
      var d = new Date(t || Date.now());
      var hh = String(d.getHours()).padStart(2, '0');
      var mm = String(d.getMinutes()).padStart(2, '0');
      var heute = new Date();
      var selberTag = d.toDateString() === heute.toDateString();
      return (selberTag ? '' : (d.getDate() + '.' + (d.getMonth() + 1) + '. ')) + hh + ':' + mm;
    }

    /* ---------------------------------------------------------- Bild */

    function bildBlock(m) {
      var box = UI.el('div.chat-bild');
      var seite = m.bild.w && m.bild.h ? (m.bild.h / m.bild.w) : 0.66;
      box.style.paddingBottom = Math.min(140, Math.max(40, seite * 100)) + '%';
      var img = UI.el('img', { alt: 'Bild von ' + m.von });
      box.appendChild(img);
      Rel.bildHolen(m.bild.id, true).then(function (d) {
        img.src = d;
        box.classList.add('da');
      }, function () {
        box.classList.add('kaputt');
        box.appendChild(UI.el('div.chat-bild-fehler', { text: 'Bild nicht mehr da' }));
      });
      box.addEventListener('click', function (e) {
        e.stopPropagation();
        vollbild(m);
      });
      return box;
    }

    function vollbild(m) {
      var img = UI.el('img.voll-bild', { alt: '' });
      var deckel = UI.el('div.bild-voll', null, [
        img,
        UI.el('div.bild-voll-fuss', { text: m.von + ' · ' + zeit(m.t) }),
      ]);
      deckel.addEventListener('click', function () { UI.remove(deckel); });
      document.body.appendChild(deckel);
      Rel.bildHolen(m.bild.id, true).then(function (d) { if (!img.src) img.src = d; });
      Rel.bildHolen(m.bild.id, false).then(function (d) { img.src = d; }, function () {
        UI.toast('Das Bild ist nicht mehr da.', 'bad');
      });
    }

    /* ---------------------------------------------------------- Umfrage */

    function umfrageBlock(m) {
      var u = m.umfrage;
      var stimmen = u.stimmen || {};
      var meine = stimmen[ich.code] || [];

      var gesamt = 0;
      var proOption = u.optionen.map(function () { return []; });
      for (var c in stimmen) {
        if (!Object.prototype.hasOwnProperty.call(stimmen, c)) continue;
        gesamt++;
        (stimmen[c] || []).forEach(function (i) {
          if (proOption[i]) proOption[i].push(c);
        });
      }

      var box = UI.el('div.umfrage' + (u.offen ? '' : '.zu'));
      box.appendChild(UI.el('div.umfrage-frage', { text: u.frage }));

      u.optionen.forEach(function (text, i) {
        var n = proOption[i].length;
        var anteil = gesamt ? n / gesamt : 0;
        var gewaehlt = meine.indexOf(i) >= 0;
        var namen = proOption[i].map(function (c) {
          return A.nameVon(c) || c;
        }).join(', ');

        var balken = UI.el('i');
        balken.style.width = Math.round(anteil * 100) + '%';

        var zeileEl = UI.el('button.umfrage-opt' + (gewaehlt ? '.an' : ''), {
          type: 'button',
          disabled: !u.offen,
          on: {
            click: function (e) {
              e.stopPropagation();
              if (!u.offen) return;
              stimmen2(m, i, u, meine);
            },
          },
        }, [
          UI.el('div.umfrage-balken', null, [balken]),
          UI.el('div.umfrage-zeile', null, [
            UI.el('span.umfrage-haken', { text: gewaehlt ? '●' : '○' }),
            UI.el('span.umfrage-text', { text: text }),
            UI.el('span.umfrage-zahl', { text: String(n) }),
          ]),
          namen ? UI.el('div.umfrage-namen', { text: namen }) : null,
        ]);
        box.appendChild(zeileEl);
      });

      box.appendChild(UI.el('div.umfrage-fuss', {
        text: (u.offen ? '' : 'Geschlossen · ')
          + gesamt + ' ' + U.plural(gesamt, 'Stimme', 'Stimmen')
          + (u.mehrfach ? ' · Mehrfachauswahl' : ''),
      }));

      var darfSchliessen = A.istAdmin() || m.code === ich.code;
      if (u.offen && darfSchliessen) {
        box.appendChild(UI.btn('Abstimmung schließen', function () {
          Rel.aendern(brett, m.id, { offen: false });
          protokoll('umfrage-zu', 'Umfrage geschlossen: ' + u.frage, brett);
        }, 'sm ghost wide'));
      }
      return box;
    }

    function stimmen2(m, i, u, meine) {
      var neu;
      if (u.mehrfach) {
        neu = meine.slice();
        var p = neu.indexOf(i);
        if (p >= 0) neu.splice(p, 1); else neu.push(i);
      } else {
        neu = meine.length === 1 && meine[0] === i ? [] : [i];
      }
      SG.audio.play('click');
      Rel.stimmen(brett, m.id, neu).catch(function () {
        UI.toast('Stimme kam nicht durch.', 'bad');
      });
    }

    function umfrageDialog() {
      var frage = UI.el('input', {
        type: 'text', placeholder: 'Worüber wird abgestimmt?', maxLength: 200,
        className: 'feld',
      });
      var optBox = UI.el('div.umfrage-bau');
      var felder = [];

      function optionHinzu(wert) {
        if (felder.length >= 8) return;
        var f = UI.el('input', {
          type: 'text', placeholder: 'Antwort ' + (felder.length + 1),
          maxLength: 80, className: 'feld', value: wert || '',
        });
        felder.push(f);
        optBox.appendChild(f);
        return f;
      }
      optionHinzu(); optionHinzu();

      var mehrfach = false;
      var mfRow = UI.toggleRow('Mehrfachauswahl', 'Jeder darf mehrere Antworten wählen.',
        function () { return mehrfach; }, function (v) { mehrfach = v; });

      UI.modal({
        title: '📊 Neue Abstimmung',
        body: [
          UI.el('p.small.muted', { text: 'Frage' }),
          frage,
          UI.el('div.sec-head', null, [UI.el('h2', { text: 'Antworten' })]),
          optBox,
          UI.btn('+ Antwort', function () {
            var f = optionHinzu();
            if (f) f.focus();
          }, 'sm ghost'),
          mfRow,
        ],
        actions: [
          { label: 'Abbrechen', cls: 'ghost' },
          {
            label: 'Abstimmung starten', cls: 'primary', keepOpen: true,
            onClick: function (dlg) {
              var f = (frage.value || '').trim();
              var opt = felder.map(function (x) { return (x.value || '').trim(); })
                .filter(Boolean);
              if (f.length < 2) { UI.toast('Bitte eine Frage eingeben.', 'bad'); return; }
              if (opt.length < 2) { UI.toast('Mindestens zwei Antworten.', 'bad'); return; }
              dlg.close();
              Rel.senden(brett, {
                umfrage: { frage: f, optionen: opt, mehrfach: mehrfach, offen: true },
              }).then(function () {
                protokoll('umfrage', 'Umfrage gestartet: ' + f, brett);
              }, function () { UI.toast('Kam nicht durch.', 'bad'); });
            },
          },
        ],
      });
      setTimeout(function () { try { frage.focus(); } catch (e) { /* egal */ } }, 120);
    }

    /* ---------------------------------------------------------- Menue */

    function menue(m) {
      SG.settings.buzz(12);
      UI.modal({
        title: 'Nachricht von ' + m.von,
        body: [
          UI.el('p.small.muted', {
            text: m.text ? U.trunc(m.text, 160)
              : (m.bild ? '🖼 Bild' : (m.umfrage ? '📊 ' + m.umfrage.frage : '—')),
          }),
        ],
        actions: [
          { label: 'Abbrechen', cls: 'ghost' },
          {
            label: 'Löschen', cls: 'bad',
            onClick: function () {
              Rel.loeschen(brett, m.id).then(function (res) {
                if (res && res.entfernt) {
                  protokoll('loeschen',
                    'Nachricht von ' + m.von + ' gelöscht'
                    + (res.entfernt.text ? ': „' + U.trunc(res.entfernt.text, 120) + '“'
                      : (res.entfernt.bild ? ' (Bild)' : '')),
                    brett, m.code);
                  UI.toast('Gelöscht.', 'good');
                }
              }, function () { UI.toast('Ging nicht.', 'bad'); });
            },
          },
        ],
      });
    }

    function protokoll(art, text, wo, ziel) {
      if (SG.protokoll) SG.protokoll.schreiben(art, text, wo, ziel);
    }

    /* ---------------------------------------------------------- Senden */

    function abschicken() {
      var t = (feld.value || '').trim();
      if (!t) return;
      feld.value = '';
      feld.style.height = '';
      Rel.senden(brett, { text: t }, opts.absender).catch(function () {
        UI.toast('Nachricht kam nicht durch.', 'bad');
        feld.value = t;
      });
    }

    function bildWaehlen() {
      /* Der Stern steht bewusst getrennt: der Kommentar-Abzug im Build
         ist zeilenweise und haelt "image/" plus Stern sonst fuer den
         Anfang eines Blockkommentars. */
      var eingabe = UI.el('input', {
        type: 'file', accept: 'image/' + '*',
        style: { display: 'none' },
      });
      document.body.appendChild(eingabe);
      eingabe.addEventListener('change', function () {
        var datei = eingabe.files && eingabe.files[0];
        UI.remove(eingabe);
        if (!datei) return;
        bildSenden(datei);
      });
      eingabe.click();
    }

    function bildSenden(datei) {
      var hinweis = UI.toast('Bild wird vorbereitet…', null, 60000);
      C.bildVorbereiten(datei).then(function (b) {
        hinweis.textContent = 'Bild wird gesendet…';
        return Rel.bildHochladen(b.voll.data, b.mini.data, b.voll.w, b.voll.h)
          .then(function (res) {
            return Rel.senden(brett, {
              bild: { id: res.id, w: b.voll.w, h: b.voll.h },
            });
          });
      }).then(function () {
        UI.remove(hinweis);
        UI.toast('Bild gesendet.', 'good');
      }, function (e) {
        UI.remove(hinweis);
        UI.toast('Bild ging nicht durch: ' + Rel.klartext(e), 'bad', 3600);
      });
    }

    /* ---------------------------------------------------------- Anschluss */

    var abmelden = Rel.beobachten(brett, function (nachrichten) {
      zeichne(nachrichten);
    });
    Rel.starten();

    // Falls schon etwas im Speicher liegt, sofort zeigen
    var k = Rel.kanal(brett);
    if (k.nachrichten && k.nachrichten.length) zeichne(k.nachrichten);

    return {
      liste: liste,
      destroy: function () { abmelden(); },
    };
  };

  /* ------------------------------------------------------------------
     Ganzer Bildschirm - fuer #/kreis und die anderen Bretter
     ------------------------------------------------------------------ */

  C.bildschirm = function (app, opts) {
    UI.clear(app);
    opts = opts || {};

    app.appendChild(UI.el('div.topbar', null, [
      /* Ohne Rueckweg, wenn der Raum verschlossen ist - ein Knopf
         'Zurueck' waere ein Ausgang, den es nicht geben soll. */
      opts.ohneZurueck ? UI.el('div.chat-schloss', { text: '🔒' })
        : UI.el('button.back.btn.sm.ghost', {
          html: '‹ Zurück',
          on: { click: function () { SG.router.go(opts.zurueck || '#/'); } },
        }),
      UI.el('div.spacer'),
      UI.el('div.brand-title', { text: opts.titel || 'Chat' }),
      UI.el('div.spacer'),
      opts.werkzeug || null,
    ]));

    var schirm = UI.el('div.screen.chat-schirm');
    app.appendChild(schirm);

    var v = C.ansicht(schirm, opts);
    return { destroy: function () { v.destroy(); } };
  };
})(SG);
