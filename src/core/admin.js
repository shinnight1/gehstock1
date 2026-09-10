/* ------------------------------------------------------------------
   Admin-Bereich.

   Fuenf Reiter:
     Leute     Codes anlegen, Profile oeffnen, BND-Freigabe, sperren
     Spiele    Wartung und "nur innerer Kreis" je Spiel
     Ansage    eine Meldung, die oben im Hub steht
     Sperren   wer gesperrt ist und wie man es wieder aufhebt
     Sitzung   wer man ist, Werkzeuge, abmelden

   Alles hier liegt in SG.verwaltung und damit auf dem Relais: was ein
   Admin aendert, ist in unter einer Sekunde auf allen Geraeten da.

   Der Chat der Admins, das Protokoll, die Antraege des BND und die
   Bildschirme liegen nebenan im Admin-Raum (#/adminraum) - das ist
   ein ganzer Bildschirm und passt nicht mehr in einen Dialog.
   ------------------------------------------------------------------ */

(function (SG) {
  var UI = SG.ui;
  var A = SG.auth;

  var Adm = SG.admin = {};

  Adm.oeffnen = function (reiter) {
    if (!A.istAdmin()) return;
    reiter = reiter || 'leute';

    var body = UI.el('div');
    var inhalt = UI.el('div');
    var m = null;

    body.appendChild(UI.tabs([
      { id: 'leute', label: '👥 Leute' },
      { id: 'spiele', label: '🎲 Spiele' },
      { id: 'ansage', label: '📣 Ansage' },
      { id: 'banne', label: '⛔ Sperren' },
      { id: 'sitzung', label: '🛡 Sitzung' },
    ], function (id) {
      reiter = id;
      UI.clear(inhalt);
      bauen(inhalt);
    }, reiter));
    body.appendChild(inhalt);
    bauen(inhalt);

    m = UI.modal({ title: 'Admin', body: body, wide: true });

    function neu() {
      if (m) m.close();
      Adm.oeffnen(reiter);
    }

    function bauen(ziel) {
      if (reiter === 'leute') leute(ziel);
      else if (reiter === 'spiele') spiele(ziel);
      else if (reiter === 'ansage') ansage(ziel);
      else if (reiter === 'banne') banne(ziel);
      else sitzung(ziel);
    }

    /* ---------------------------------------------------------- Leute */

    function leute(ziel) {
      ziel.appendChild(UI.el('div.row.wrap', { style: { gap: '8px' } }, [
        UI.btn('+ Neuer Code', function () { codeErstellen(); }, 'primary'),
      ]));

      var liste = A.liste();
      ziel.appendChild(UI.el('div.sec-head', null, [
        UI.el('h2', { text: 'Profile' }),
        UI.el('span.count', { text: String(liste.length) }),
      ]));

      if (!liste.length) {
        ziel.appendChild(UI.el('p.small.muted', {
          text: 'Noch niemand angelegt. Beim Erstellen gibst du Name und Rolle '
            + 'gleich mit — dann steht der Name bei der Anmeldung schon da.',
        }));
        return;
      }

      liste.forEach(function (e) {
        var gesperrt = A.sperren(e.code);
        ziel.appendChild(UI.el('div.item.tap', {
          on: { click: function () { profil(e); } },
        }, [
          UI.el('div.thumb', { text: A.istOwner(e.code) ? '👑' : A.rolleIcon(e.rolle) }),
          UI.el('div.main', null, [
            UI.el('div.t', { text: e.name || 'ohne Namen' }),
            UI.el('div.d', {
              text: A.schoen(e.code) + ' · '
                + (A.istOwner(e.code) ? 'Owner' : A.rolleName(e.rolle))
                + (gesperrt.length ? ' · ' + gesperrt.length + ' gesperrt' : ''),
            }),
          ]),
          UI.el('div.side', null, [UI.el('div.s', { text: '›' })]),
        ]));
      });
    }

    /* Name und Rolle werden zusammen mit dem Code festgelegt */
    function codeErstellen() {
      var rolle = A.SPIELER;
      var nf = UI.el('input', {
        type: 'text', placeholder: 'Name der Person', maxLength: 20,
        style: {
          width: '100%', height: '48px', background: '#0b0e15',
          border: '1px solid var(--line)', borderRadius: '10px',
          color: 'var(--text)', padding: '0 12px', outline: 'none', fontSize: '17px',
        },
      });
      var hinweis = UI.el('div.small', { style: { color: 'var(--red)', minHeight: '18px' } });

      var wahl = UI.el('div.rollenwahl');
      A.ROLLEN.slice().reverse().forEach(function (r) {
        var b = UI.el('button.rollebtn' + (r.id === rolle ? '.an' : ''), {
          on: {
            click: function () {
              rolle = r.id;
              [].forEach.call(wahl.children, function (x) { x.classList.remove('an'); });
              b.classList.add('an');
              SG.audio.play('click');
            },
          },
        }, [
          UI.el('div.ri', { text: r.icon }),
          UI.el('div.rn', { text: r.name }),
          UI.el('div.rt', { text: r.text }),
        ]);
        wahl.appendChild(b);
      });

      var dlg = UI.modal({
        title: 'Neuer Code',
        body: [
          UI.el('p.small.muted', { text: 'Für wen ist der Code?' }),
          nf, hinweis,
          UI.el('div.sec-head', null, [UI.el('h2', { text: 'Rolle' })]),
          wahl,
        ],
        actions: [
          { label: 'Abbrechen', cls: 'ghost' },
          {
            label: 'Code erstellen', cls: 'primary', keepOpen: true,
            onClick: function () {
              var name = (nf.value || '').trim();
              if (name.length < 2) {
                hinweis.textContent = 'Bitte einen Namen eingeben.';
                try { nf.focus(); } catch (e) { /* egal */ }
                return;
              }
              var code = A.erzeugen(rolle);
              if (!code) {
                hinweis.textContent = 'Für diese Rolle ist kein Code mehr frei.';
                return;
              }
              A.nameSetzen(code, name);
              A.merken(code, name, rolle);
              SG.protokoll.schreiben('code',
                'Code für ' + name + ' erstellt (' + A.rolleName(rolle) + ')', '', code);
              dlg.close();
              codeZeigen(code, name, rolle);
            },
          },
        ],
      });
      setTimeout(function () { try { nf.focus(); } catch (e) { /* egal */ } }, 120);
    }

    function codeZeigen(code, name, rolle) {
      var einladung = A.einladung(code, name);
      UI.modal({
        title: 'Code für ' + name,
        body: [
          UI.el('p.small.muted.center', { text: A.rolleName(rolle) + ' · zum Weitergeben:' }),
          UI.el('div.room-code', { text: A.schoen(code) }),
          UI.el('div.notice', {
            html: '<b>Besser noch:</b> gib <b>' + einladung + '</b> weiter. '
              + 'Dann kennt auch ein fremdes Gerät gleich den Namen — '
              + 'die Tür nimmt beides an.',
          }),
          rolle === A.ADMIN ? UI.el('div.notice.warn', {
            style: { marginTop: '10px' },
            text: 'Wer diesen Code hat, kann selbst Codes erstellen, Spiele sperren '
              + 'und Ansagen schreiben.',
          }) : null,
        ],
        actions: [
          {
            label: 'Einladung kopieren', cls: 'ghost', keepOpen: true,
            onClick: function () { kopieren(einladung); },
          },
          { label: 'Fertig', cls: 'primary', onClick: neu },
        ],
      });
    }

    function kopieren(text) {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(function () {
          UI.toast('Kopiert.', 'good');
        }, function () { UI.toast('Bitte von Hand abschreiben.', 'bad'); });
      } else UI.toast('Bitte von Hand abschreiben.', null);
    }

    /* ---------------------------------------------------------- Ein Profil */

    function profil(e) {
      var body2 = UI.el('div');
      var bann = A.gebannt(e.code);
      var darf = A.darfGegen(e.code);
      var owner = A.istOwner(e.code);

      body2.appendChild(UI.el('div.notice', {
        html: '<b>' + (owner ? '👑 ' : '') + A.rolleIcon(e.rolle) + ' '
          + (e.name || 'ohne Namen') + '</b><br>'
          + A.schoen(e.code) + ' · ' + A.rolleName(e.rolle)
          + (owner ? ' · Owner' : ''),
      }));

      /* Umbenennen darf, wer auch sonst an diesen Code heranreicht.
         Der Name steht ueberall: im Chat, im Protokoll, an der Tuer. */
      if (darf) {
        body2.appendChild(UI.btn('✏️ Umbenennen', function () {
          umbenennen(e);
        }, 'wide ghost'));
        body2.appendChild(UI.el('div', { style: { height: '10px' } }));
      }

      /* Wer geschuetzt ist, wird hier nur angesehen - kein Bann, keine
         Spielsperre, kein Loeschen, keine Freigaben. */
      if (!darf) {
        body2.appendChild(UI.el('div.notice.warn', {
          html: '<b>🔒 Geschützt</b><br>' + A.schutzGrund(e.code),
        }));
        UI.modal({
          title: 'Profil', body: body2, wide: true,
          actions: [{ label: 'Fertig', cls: 'primary', onClick: neu }],
        });
        return;
      }

      if (bann) {
        body2.appendChild(UI.el('div.notice.warn', {
          style: { marginTop: '10px' },
          html: '<b>⛔ Gesperrt</b> von ' + bann.von + '<br>' + bann.grund,
        }));
        body2.appendChild(UI.btn('Sperre aufheben', function () {
          A.bannLoesen(e.code);
          SG.protokoll.schreiben('entbann',
            'Sperre für ' + (e.name || e.code) + ' aufgehoben', '', e.code);
          UI.toast('Sperre aufgehoben.', 'good');
          neu();
        }, 'wide primary'));
      } else {
        body2.appendChild(UI.btn('⛔ Zugang sperren', function () {
          bannDialog(e);
        }, 'wide bad'));
      }

      /* --- Nachrichtendienst --- */
      body2.appendChild(UI.el('div.sec-head', null, [
        UI.el('h2', { text: 'Nachrichtendienst' }),
      ]));
      var bndAn = A.hatBnd(e.code);
      var schluesselZeile = UI.el('div.notice', {
        style: { marginTop: '8px', display: bndAn ? '' : 'none' },
        html: 'Dienstschlüssel: <b>' + A.bndSchluessel(e.code) + '</b><br>'
          + '<span class="small">Braucht diese Person beim Betreten der '
          + 'Lagezentrale. Er ergibt sich aus dem Code und ändert sich nie.</span>',
      });
      body2.appendChild(UI.toggleRow('🕵 BND-Freigabe',
        'Zusätzlich zur Rolle. Öffnet die Lagezentrale.',
        function () { return A.hatBnd(e.code); },
        function (v) {
          A.bndSetzen(e.code, v);
          schluesselZeile.style.display = v ? '' : 'none';
          SG.protokoll.schreiben('rolle',
            (v ? 'BND-Freigabe erteilt an ' : 'BND-Freigabe entzogen: ')
            + (e.name || e.code), '', e.code);
        }));
      body2.appendChild(schluesselZeile);

      body2.appendChild(UI.el('div.sec-head', null, [
        UI.el('h2', { text: 'Für diese Person gesperrt' }),
      ]));
      body2.appendChild(UI.el('p.small.muted', {
        text: 'Angetippte Spiele sind gesperrt. Im Hub erscheinen sie '
          + 'durchgestrichen und lassen sich nicht starten.',
      }));

      var gitter = UI.el('div.sperrgitter');
      SG.all().forEach(function (g) {
        var an = A.sperren(e.code).indexOf(g.id) >= 0;
        var knopf = UI.el('button.sperrbtn' + (an ? '.an' : ''), {
          on: {
            click: function () {
              var jetzt = A.sperreUmschalten(e.code, g.id);
              knopf.classList.toggle('an', jetzt);
              SG.audio.play('click');
            },
          },
        }, [
          UI.el('div.sn', { text: g.name }),
          UI.el('div.ss', { text: an ? 'gesperrt' : 'frei' }),
        ]);
        gitter.appendChild(knopf);
      });
      body2.appendChild(gitter);

      UI.modal({
        title: 'Profil', body: body2, wide: true,
        actions: [
          {
            label: 'Alles freigeben', cls: 'ghost',
            onClick: function () { A.sperrenSetzen(e.code, []); neu(); },
          },
          {
            label: 'Löschen', cls: 'bad',
            onClick: function () {
              UI.confirm('Profil löschen?',
                'Der Code verschwindet aus der Liste und alle Spielsperren dafür '
                + 'werden aufgehoben. Damit er auch nicht mehr hereinkommt, '
                + 'muss er zusätzlich gesperrt werden — dafür gibt es oben '
                + 'den roten Knopf.', 'Löschen', true)
                .then(function (ok) {
                  if (!ok) return;
                  A.vergessen(e.code);
                  SG.protokoll.schreiben('codeweg',
                    'Profil ' + (e.name || e.code) + ' gelöscht', '', e.code);
                  neu();
                });
            },
          },
          { label: 'Fertig', cls: 'primary', onClick: neu },
        ],
      });
    }

    /* ---------------------------------------------------------- Sperren

       Ein Bann trifft den Code selbst: er kommt nicht mehr durch die
       Tuer, und wer schon drin ist, fliegt sofort heraus - auch mitten
       im Spiel (siehe wache.js). Aufheben geht jederzeit hier. */

    function umbenennen(e) {
      var nf = UI.el('input', {
        type: 'text', value: e.name || '', placeholder: 'Neuer Name',
        maxLength: 20, className: 'feld',
      });
      var hinweis = UI.el('div.small', {
        style: { color: 'var(--red)', minHeight: '18px' },
      });
      var dlg = UI.modal({
        title: 'Umbenennen',
        body: [
          UI.el('p.small.muted', {
            text: 'Der Name steht überall, wo diese Person auftaucht — im Chat, '
              + 'im Protokoll und an der Tür. Der Code bleibt derselbe.',
          }),
          nf, hinweis,
        ],
        actions: [
          { label: 'Abbrechen', cls: 'ghost' },
          {
            label: 'Speichern', cls: 'primary', keepOpen: true,
            onClick: function () {
              var name = (nf.value || '').trim();
              if (name.length < 2) {
                hinweis.textContent = 'Bitte einen Namen eingeben.';
                try { nf.focus(); } catch (er) { /* egal */ }
                return;
              }
              var alt = e.name || A.schoen(e.code);
              if (name === alt) { dlg.close(); return; }
              if (!A.nameSetzen(e.code, name)) {
                hinweis.textContent = A.schutzGrund(e.code);
                return;
              }
              SG.protokoll.schreiben('name',
                alt + ' heißt jetzt ' + name, '', e.code);
              dlg.close();
              UI.toast('Umbenannt.', 'good');
              neu();
            },
          },
        ],
      });
      setTimeout(function () { try { nf.focus(); } catch (er) { /* egal */ } }, 120);
    }

    function bannDialog(e) {
      var grund = UI.el('textarea', {
        placeholder: 'Warum? Steht später auf dem Sperrbildschirm.',
        rows: 3, maxLength: 300, className: 'feld hoch',
      });
      var dlg = UI.modal({
        title: '⛔ ' + (e.name || A.schoen(e.code)) + ' sperren',
        body: [
          UI.el('p.small.muted', {
            text: 'Der Zugang ist danach sofort dicht — auch bei jemandem, '
              + 'der gerade spielt. Aufheben geht jederzeit.',
          }),
          grund,
        ],
        actions: [
          { label: 'Abbrechen', cls: 'ghost' },
          {
            label: 'Sperren', cls: 'bad', keepOpen: true,
            onClick: function () {
              var t = (grund.value || '').trim() || 'Ohne Angabe';
              dlg.close();
              A.bannSetzen(e.code, t, A.aktuell.name);
              SG.relais.befehlSenden(e.code, 'bann', 'Zugang gesperrt');
              SG.protokoll.schreiben('bann',
                (e.name || e.code) + ' gesperrt: ' + t, '', e.code);
              UI.toast('Gesperrt.', 'good');
              neu();
            },
          },
        ],
      });
      setTimeout(function () { try { grund.focus(); } catch (er) { /* egal */ } }, 120);
    }

    function banne(ziel) {
      var alle = A.banne();
      var codes = Object.keys(alle);
      var geraete = SG.verhoer.geraeteBanne();
      var gids = Object.keys(geraete);

      ziel.appendChild(UI.el('p.small.muted', {
        text: 'Gesperrte Zugänge und Geräte. Ein Bann wirkt auf allen Geräten und '
          + 'sofort — wer gerade spielt, landet innerhalb einer Sekunde auf dem '
          + 'Sperrbildschirm.',
      }));

      /* Geraetesperren kommen aus einem Verhoer an der Tuer: dort hat
         jemand ohne Code geraten, es gibt also niemanden zu sperren -
         nur den Kasten, an dem er sitzt. */
      if (gids.length) {
        ziel.appendChild(UI.el('div.sec-head', null, [
          UI.el('h2', { text: 'Gesperrte Geräte' }),
          UI.el('span.count', { text: String(gids.length) }),
        ]));
        gids.forEach(function (g) {
          var b = geraete[g];
          ziel.appendChild(UI.el('div.item', null, [
            UI.el('div.thumb.rot', { text: '🚪' }),
            UI.el('div.main', null, [
              UI.el('div.t', { text: 'Gerät ' + SG.verhoer.kurz(g) }),
              UI.el('div.d', {
                text: b.grund + ' · von ' + b.von + ' · '
                  + new Date(b.t).toLocaleDateString('de-DE'),
              }),
            ]),
            UI.el('div.side', null, [
              UI.btn('Aufheben', function () {
                SG.verhoer.geraetEntbannen(g);
                SG.protokoll.schreiben('entbann',
                  'Gerätesperre ' + SG.verhoer.kurz(g) + ' aufgehoben');
                UI.toast('Sperre aufgehoben.', 'good');
                neu();
              }, 'sm ghost'),
            ]),
          ]));
        });
      }

      if (!codes.length && !gids.length) {
        ziel.appendChild(UI.empty('✅', 'Niemand gesperrt',
          'Sperren lassen sich im Profil einer Person setzen — oder über '
          + 'einen angenommenen Antrag des Nachrichtendienstes.'));
        return;
      }

      if (codes.length) {
        ziel.appendChild(UI.el('div.sec-head', null, [
          UI.el('h2', { text: 'Gesperrte Zugänge' }),
          UI.el('span.count', { text: String(codes.length) }),
        ]));
      }

      codes.forEach(function (c) {
        var b = alle[c];
        var name = A.nameVon(c) || A.schoen(c);
        ziel.appendChild(UI.el('div.item', null, [
          UI.el('div.thumb.rot', { text: '⛔' }),
          UI.el('div.main', null, [
            UI.el('div.t', { text: name }),
            UI.el('div.d', {
              text: b.grund + ' · von ' + b.von + ' · '
                + new Date(b.t).toLocaleDateString('de-DE'),
            }),
          ]),
          UI.el('div.side', null, [
            UI.btn('Aufheben', function () {
              A.bannLoesen(c);
              SG.protokoll.schreiben('entbann',
                'Sperre für ' + name + ' aufgehoben', '', c);
              UI.toast('Sperre aufgehoben.', 'good');
              neu();
            }, 'sm ghost'),
          ]),
        ]));
      });
    }

    /* ---------------------------------------------------------- Spiele */

    function spiele(ziel) {
      ziel.appendChild(UI.el('p.small.muted', {
        text: 'Zweimal antippen schaltet durch: erst Wartung, dann nur innerer '
          + 'Kreis, dann wieder frei. Ein Spiel in Wartung lässt sich von '
          + 'niemandem starten — außer von dir, damit du prüfen kannst, ob es '
          + 'wieder läuft.',
      }));

      var wartungN = Object.keys(A.wartung()).length;
      var kreisN = A.kreisSpiele().length;
      ziel.appendChild(UI.el('div.kv', null, [
        UI.el('div.kv-row', null, [
          UI.el('div.k', { text: '🔧 In Wartung' }),
          UI.el('div.v', { text: String(wartungN) }),
        ]),
        UI.el('div.kv-row', null, [
          UI.el('div.k', { text: '🔑 Nur innerer Kreis' }),
          UI.el('div.v', { text: String(kreisN) }),
        ]),
      ]));

      var gitter = UI.el('div.sperrgitter');
      SG.all().forEach(function (g) {
        var knopf = UI.el('button.sperrbtn');
        function malen() {
          var w = A.inWartung(g.id), k = A.nurKreis(g.id);
          knopf.classList.toggle('wartung', w);
          knopf.classList.toggle('kreis', !w && k);
          UI.clear(knopf);
          UI.add(knopf, [
            UI.el('div.sn', { text: g.name }),
            UI.el('div.ss', { text: w ? '🔧 Wartung' : (k ? '🔑 innerer Kreis' : 'frei für alle') }),
          ]);
        }
        knopf.addEventListener('click', function () {
          var w = A.inWartung(g.id), k = A.nurKreis(g.id);
          if (!w && !k) A.wartungSetzen(g.id, true);
          else if (w) { A.wartungSetzen(g.id, false); A.kreisUmschalten(g.id); }
          else A.kreisUmschalten(g.id);
          malen();
          SG.audio.play('click');
        });
        malen();
        gitter.appendChild(knopf);
      });
      ziel.appendChild(gitter);
    }

    /* ---------------------------------------------------------- Ansage */

    function ansage(ziel) {
      var jetzige = A.ansage();

      ziel.appendChild(UI.el('p.small.muted', {
        text: 'Eine Ansage steht ganz oben im Hub, mit deinem Namen darunter. '
          + 'Wer sie wegklickt, sieht sie nicht wieder — eine feste Ansage '
          + 'bleibt dagegen stehen.',
      }));

      if (jetzige) {
        ziel.appendChild(UI.el('div.sec-head', null, [UI.el('h2', { text: 'Läuft gerade' })]));
        ziel.appendChild(UI.el('div.ansage.' + jetzige.art, null, [
          UI.el('div.an-text', { text: jetzige.text }),
          UI.el('div.an-von', {
            text: A.rolleIcon(jetzige.rolle) + ' ' + jetzige.von,
          }),
        ]));
        ziel.appendChild(UI.btn('Ansage entfernen', function () {
          A.ansageSetzen(null);
          UI.toast('Ansage entfernt.', 'good');
          neu();
        }, 'wide bad'));
      }

      var art = 'info';
      var tf = UI.el('textarea', {
        placeholder: 'Was sollen alle wissen?', maxLength: 240, rows: 3,
        style: {
          width: '100%', background: '#0b0e15', border: '1px solid var(--line)',
          borderRadius: '10px', color: 'var(--text)', padding: '10px 12px',
          outline: 'none', fontSize: '16px', fontFamily: 'inherit', resize: 'vertical',
        },
      });

      var arten = UI.el('div.row.wrap', { style: { gap: '6px', marginTop: '10px' } });
      [
        { id: 'info', label: 'ℹ Hinweis' },
        { id: 'warnung', label: '⚠ Warnung' },
        { id: 'fest', label: '📌 Fest angeheftet' },
      ].forEach(function (a) {
        var b = UI.btn(a.label, function () {
          art = a.id;
          [].forEach.call(arten.children, function (x) { x.classList.remove('primary'); x.classList.add('ghost'); });
          b.classList.remove('ghost'); b.classList.add('primary');
        }, 'sm' + (a.id === art ? ' primary' : ' ghost'));
        arten.appendChild(b);
      });

      ziel.appendChild(UI.el('div.sec-head', null, [UI.el('h2', { text: 'Neue Ansage' })]));
      ziel.appendChild(tf);
      ziel.appendChild(arten);
      ziel.appendChild(UI.el('div', { style: { height: '12px' } }));
      ziel.appendChild(UI.btn('Ansage senden', function () {
        var t = (tf.value || '').trim();
        if (t.length < 3) { UI.toast('Bitte etwas schreiben.', 'bad'); return; }
        A.ansageSetzen(t, art);
        SG.protokoll.schreiben('ansage', 'Ansage gesetzt (' + art + '): ' + t);
        UI.toast('Ansage steht.', 'good');
        neu();
      }, 'wide primary'));
    }

    /* ---------------------------------------------------------- Sitzung */

    /* ---------------------------------------------------------- Owner

       Ueber allen Admins steht einer, an den keiner herankommt. Solange
       niemand eingetragen ist, nimmt sich der erste Admin die Rolle;
       danach gibt nur der Owner selbst sie weiter. */

    function owner(ziel) {
      if (A.ownerFrei()) {
        ziel.appendChild(UI.el('div.notice.warn', {
          html: '<b>Noch kein Owner.</b><br>Ein Owner steht über allen Admins: '
            + 'niemand kann ihn sperren, löschen oder umbenennen. Solange die '
            + 'Rolle frei ist, kann jeder Admin sie sich nehmen.',
        }));
        ziel.appendChild(UI.el('div', { style: { height: '8px' } }));
        ziel.appendChild(UI.btn('👑 Owner werden', function () {
          UI.confirm('Owner werden?',
            'Danach kann dir kein Admin mehr etwas anhaben — und nur du '
            + 'selbst kannst die Rolle weitergeben.', 'Owner werden')
            .then(function (ok) {
              if (!ok) return;
              if (!A.ownerSetzen(A.aktuell.code)) {
                UI.toast('Ging nicht — es gibt schon einen Owner.', 'bad');
                return;
              }
              SG.protokoll.schreiben('owner',
                (A.aktuell.name || A.aktuell.code) + ' ist jetzt Owner', '',
                A.aktuell.code);
              UI.toast('Du bist jetzt Owner.', 'good');
              neu();
            });
        }, 'wide primary'));
        return;
      }

      var name = A.nameVon(A.owner()) || A.schoen(A.owner());

      if (!A.binOwner()) {
        ziel.appendChild(UI.el('div.notice', {
          html: '<b>👑 ' + name + '</b><br>An den Owner kommt kein Admin heran. '
            + 'Weitergeben kann die Rolle nur er selbst.',
        }));
        return;
      }

      ziel.appendChild(UI.el('div.notice', {
        html: '<b>👑 Du bist Owner.</b><br>Kein Admin kann dich sperren, löschen '
          + 'oder umbenennen. Umgekehrt bist du der Einzige, der gegen andere '
          + 'Admins vorgehen darf.',
      }));
      ziel.appendChild(UI.el('div', { style: { height: '8px' } }));
      ziel.appendChild(UI.btn('Owner übergeben', function () {
        ownerUebergeben();
      }, 'wide ghost'));
    }

    /* Weitergeben geht nur an einen Admin - ein Spieler koennte mit der
       Rolle nichts anfangen und waere bloss unangreifbar. */
    function ownerUebergeben() {
      var admins = A.liste().filter(function (e) {
        return e.rolle === A.ADMIN && e.code !== A.aktuell.code;
      });
      if (!admins.length) {
        UI.toast('Es gibt sonst keinen Admin.', 'bad');
        return;
      }
      var body2 = UI.el('div');
      body2.appendChild(UI.el('p.small.muted', {
        text: 'Danach bist du ein Admin wie jeder andere — und der Neue kann '
          + 'auch gegen dich vorgehen. Rückgängig macht das nur er.',
      }));
      var dlg = UI.modal({ title: 'Owner übergeben', body: body2 });
      admins.forEach(function (e) {
        body2.appendChild(UI.el('div.item.tap', {
          on: {
            click: function () {
              dlg.close();
              UI.confirm('An ' + (e.name || A.schoen(e.code)) + ' übergeben?',
                'Du gibst die Rolle ab und kannst sie nicht zurückholen.',
                'Übergeben', true).then(function (ok) {
                  if (!ok) return;
                  if (!A.ownerSetzen(e.code)) {
                    UI.toast('Ging nicht.', 'bad');
                    return;
                  }
                  SG.protokoll.schreiben('owner',
                    'Owner übergeben an ' + (e.name || e.code), '', e.code);
                  UI.toast('Übergeben.', 'good');
                  neu();
                });
            },
          },
        }, [
          UI.el('div.thumb', { text: '🛡' }),
          UI.el('div.main', null, [
            UI.el('div.t', { text: e.name || 'ohne Namen' }),
            UI.el('div.d', { text: A.schoen(e.code) }),
          ]),
          UI.el('div.side', null, [UI.el('div.s', { text: '›' })]),
        ]));
      });
    }

    function sitzung(ziel) {
      ziel.appendChild(UI.el('div.notice', {
        html: '<b>' + A.rolleIcon(A.aktuell.rolle) + ' '
          + (A.aktuell.name || 'Admin') + '</b><br>'
          + A.schoen(A.aktuell.code) + ' · ' + A.rolleName(A.aktuell.rolle),
      }));
      ziel.appendChild(UI.el('p.small.muted', {
        style: { marginTop: '12px' },
        text: SG.verwaltung.online
          ? 'Profile, Sperren, Wartung, Ansagen und BND-Freigaben liegen auf dem '
            + 'Relais. Was du hier änderst, ist in unter einer Sekunde auf allen '
            + 'Geräten da — ohne Neuladen.'
          : 'Kein Relais erreichbar. Alles, was du hier änderst, gilt nur auf '
            + 'diesem Gerät, bis die Verbindung wieder steht.',
      }));

      ziel.appendChild(UI.el('div.sec-head', null, [
        UI.el('h2', { text: 'Owner' }),
      ]));
      owner(ziel);

      ziel.appendChild(UI.el('div.sec-head', null, [
        UI.el('h2', { text: 'Werkzeuge' }),
      ]));
      ziel.appendChild(UI.btn('🛡 Admin-Raum öffnen', function () {
        if (m) m.close();
        SG.router.go('#/adminraum');
      }, 'wide primary'));
      ziel.appendChild(UI.el('div', { style: { height: '8px' } }));
      ziel.appendChild(UI.btn('📋 Besprechung eröffnen', function () {
        if (m) m.close();
        SG.meeting.anlegenDialog();
      }, 'wide ghost'));
      ziel.appendChild(UI.el('div', { style: { height: '8px' } }));
      ziel.appendChild(UI.btn('🔧 Entwicklerkonsole', function () {
        if (m) m.close();
        SG.router.go('#/dev');
      }, 'wide ghost'));


      ziel.appendChild(UI.btn('Abmelden', function () {
        UI.confirm('Abmelden?', 'Beim nächsten Start ist wieder der Code nötig. '
          + 'Dein Spielstand bleibt erhalten.', 'Abmelden').then(function (ok) {
            if (!ok) return;
            A.abmelden();
            location.reload();
          });
      }, 'wide ghost'));
    }
  };
})(SG);
