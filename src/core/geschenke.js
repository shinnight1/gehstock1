/* ------------------------------------------------------------------
   Geben - der Adminreiter, der Leuten etwas schenkt.

   Mons, Aussenposten und Gold. Wer was bekommt, entscheidet ein Mensch;
   ausgefuehrt wird es auf dem Spielserver, weil die Spielerwelt dort
   liegt und nicht im Browser. Die Regeln dazu stehen in
   netlify/functions/lib/gehstockmon-schenken.mjs - dieselben, die auch
   tools/spieler-ausstatten.mjs benutzt.

   Zwei Dinge sind Absicht:

   1. Die Anfrage geht hier eigenhaendig raus und nicht ueber
      SG.gehstockmon.online. Dessen Anfrage traegt die Developer-Testzone
      mit sich, und in der ist ein Geschenk nach fuenf Minuten wieder
      weg - man haette Karl beschenkt und nichts waere passiert.

   2. Jede Schenkung steht danach im Buch, mit Geber und Beschenktem.
      Auch die an sich selbst. Gerade die.
   ------------------------------------------------------------------ */

(function (SG) {
  var UI = SG.ui;
  var A = SG.auth;

  var G = SG.geschenke = {};

  function spiel() { return SG.gehstockmon && SG.gehstockmon.daten; }

  G.senden = function (op, nutzlast) {
    if (SG.offline || SG.env.file) {
      return Promise.reject(new Error('Dafür braucht es die veröffentlichte Website.'));
    }
    if (!A.aktuell) return Promise.reject(new Error('Nicht angemeldet.'));
    return fetch('/api/gehstockmon', {
      method: 'POST', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({
        op: op, code: A.aktuell.code, name: A.aktuell.name || 'Admin',
      }, nutzlast || {})),
    }).then(function (res) {
      if ((res.headers.get('content-type') || '').indexOf('json') < 0) {
        throw new Error('Der Spielserver ist hier nicht erreichbar.');
      }
      return res.json().then(function (r) {
        if (!res.ok || r.error) throw new Error(r.error || 'Server nicht erreichbar.');
        return r;
      });
    });
  };

  /* ---------------------------------------------------------- Der Reiter */

  G.reiter = function (ziel, neu) {
    var D = spiel();
    if (!D) {
      ziel.appendChild(UI.empty('🎁', 'GehstockMon fehlt',
        'Ohne die Spieldaten lässt sich nichts verschenken.'));
      return;
    }

    ziel.appendChild(UI.el('p.small.muted', {
      text: 'Wähle eine Person aus und gib ihr Mons, Außenposten oder Gold. '
        + 'Das landet sofort in der echten Spielerwelt — nicht in der Testzone.',
    }));

    /* Wer gerade in der Developer-Testzone steckt, denkt leicht, das hier
       ginge auch dorthin. Tut es nicht - und ein Geschenk, das nach fuenf
       Minuten weg ist, faellt sonst erst dem Beschenkten auf. */
    if (SG.gehstockmon && SG.gehstockmon.adminOverride === true) {
      ziel.appendChild(UI.el('div.notice.warn', {
        html: '<b>Die Developer-Testzone ist offen.</b><br>Geschenke gehen '
          + 'trotzdem in die echte Spielerwelt. Die Testzone lässt sich nicht '
          + 'beschenken — ihr Stand verfällt nach fünf Minuten.',
      }));
    }

    var liste = A.liste();
    ziel.appendChild(UI.el('div.sec-head', null, [
      UI.el('h2', { text: 'An wen?' }),
      UI.el('span.count', { text: String(liste.length) }),
    ]));

    if (!liste.length) {
      ziel.appendChild(UI.el('p.small.muted', {
        text: 'Noch niemand angelegt. Unter Leute geht das.',
      }));
    }

    liste.forEach(function (e) {
      ziel.appendChild(UI.el('div.item.tap', {
        on: { click: function () { dialog(e, neu); } },
      }, [
        UI.el('div.thumb', { text: '🎁' }),
        UI.el('div.main', null, [
          UI.el('div.t', { text: e.name || 'ohne Namen' }),
          UI.el('div.d', {
            text: A.schoen(e.code)
              + (A.aktuell && A.aktuell.code === e.code ? ' · du selbst' : ''),
          }),
        ]),
        UI.el('div.side', null, [UI.el('div.s', { text: '›' })]),
      ]));
    });

    var buch = UI.el('div');
    ziel.appendChild(buch);
    buchZeigen(buch);
  };

  /* ------------------------------------------------------------- Das Buch */

  function buchZeigen(ziel) {
    UI.clear(ziel);
    ziel.appendChild(UI.el('div.sec-head', null, [
      UI.el('h2', { text: 'Zuletzt verschenkt' }),
    ]));
    var lade = UI.el('p.small.muted', { text: 'Wird geholt …' });
    ziel.appendChild(lade);

    G.senden('admin_log', {}).then(function (r) {
      UI.remove(lade);
      var eintraege = r.schenkungen || [];
      if (!eintraege.length) {
        ziel.appendChild(UI.el('p.small.muted', {
          text: 'Noch nichts verschenkt.',
        }));
        return;
      }
      eintraege.slice(0, 20).forEach(function (s) {
        ziel.appendChild(UI.el('div.item', null, [
          UI.el('div.thumb', { text: s.selbst ? '🪞' : '🎁' }),
          UI.el('div.main', null, [
            UI.el('div.t', {
              text: s.vonName + ' → ' + s.anName + (s.selbst ? ' (sich selbst)' : ''),
            }),
            UI.el('div.d', { text: was(s) + ' · ' + wann(s.t) + ' · ' + s.quelle }),
          ]),
        ]));
      });
    }, function (err) {
      UI.remove(lade);
      ziel.appendChild(UI.el('p.small.muted', { text: err.message }));
    });
  }

  function was(s) {
    var D = spiel(), teile = [];
    if (s.mons && s.mons.length) {
      teile.push(s.mons.map(function (id) {
        var k = D && D.mon(id);
        return k ? k.name : id;
      }).join(', '));
    }
    if (s.gebiete && s.gebiete.length) {
      teile.push(s.gebiete.map(function (id) {
        return D && D.FELDER[id - 1] ? D.FELDER[id - 1].name : 'Gebiet ' + id;
      }).join(', '));
    }
    if (s.gold) teile.push(s.gold + ' Gold');
    if (s.genommen && s.genommen.length) {
      teile.push('weggenommen von ' + s.genommen.map(function (g) { return g.name; }).join(', '));
    }
    return teile.join(' · ') || 'nichts';
  }

  function wann(t) {
    var d = new Date(t);
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
      + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  }

  /* ------------------------------------------------------------ Der Dialog */

  function dialog(person, neu) {
    var D = spiel();
    var mons = {}, gebiete = {};

    function schalter(ziel, text, an, um) {
      var b = UI.el('button.chip' + (an ? '.on' : ''), {
        type: 'button', text: text,
        on: {
          click: function () {
            var jetzt = !b.classList.contains('on');
            b.classList.toggle('on', jetzt);
            um(jetzt);
            SG.audio.play('click');
          },
        },
      });
      ziel.appendChild(b);
      return b;
    }

    var reihe = { display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' };

    var monfeld = UI.el('div', { style: reihe });
    D.KATALOG.slice().sort(function (a, b) {
      return a.seltenheit - b.seltenheit || a.name.localeCompare(b.name);
    }).forEach(function (k) {
      schalter(monfeld, k.name, false, function (an) {
        if (an) mons[k.id] = true; else delete mons[k.id];
      });
    });

    var gebietfeld = UI.el('div', { style: reihe });
    D.FELDER.forEach(function (f) {
      schalter(gebietfeld, f.id + ' · ' + f.name, false, function (an) {
        if (an) gebiete[f.id] = true; else delete gebiete[f.id];
      });
    });

    var goldfeld = UI.el('input', {
      type: 'number', min: '0', step: '10', value: '0', inputMode: 'numeric',
      style: {
        width: '100%', height: '48px', background: '#0b0e15',
        border: '1px solid var(--line)', borderRadius: '10px',
        color: 'var(--text)', padding: '0 12px', outline: 'none', fontSize: '17px',
        marginTop: '8px',
      },
    });

    var hinweis = UI.el('div.small', { style: { color: 'var(--red)', minHeight: '18px' } });

    var dlg = UI.modal({
      title: 'Geben an ' + (person.name || person.code),
      wide: true,
      body: [
        UI.el('div.notice', {
          html: '<b>' + (person.name || 'ohne Namen') + '</b><br>' + A.schoen(person.code)
            + '<br><span class="small">Wer noch nie gespielt hat, bekommt das '
            + 'Konto gleich mit angelegt.</span>',
        }),
        UI.el('div.sec-head', null, [UI.el('h2', { text: 'Mons' })]),
        monfeld,
        UI.el('div.sec-head', null, [UI.el('h2', { text: 'Außenposten' })]),
        UI.el('p.small.muted', {
          text: 'Das Gebiet wechselt mitsamt Goldeinkommen und Eierproduktion. '
            + 'Gehört es schon jemandem, fragt der Server noch einmal nach.',
        }),
        gebietfeld,
        UI.el('div.sec-head', null, [UI.el('h2', { text: 'Gold' })]),
        goldfeld,
        hinweis,
      ],
      actions: [
        { label: 'Abbrechen', cls: 'ghost' },
        {
          label: '🎁 Geben', cls: 'primary', keepOpen: true,
          onClick: function () { geben(false); },
        },
      ],
    });

    function geben(wegnehmen) {
      var gabe = {
        zielCode: person.code,
        zielName: person.name || '',
        mons: Object.keys(mons),
        gebiete: Object.keys(gebiete).map(Number),
        gold: Math.max(0, Math.floor(Number(goldfeld.value) || 0)),
        wegnehmen: wegnehmen === true,
        requestId: 'geschenk-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10),
      };
      if (!gabe.mons.length && !gabe.gebiete.length && !gabe.gold) {
        hinweis.textContent = 'Nichts ausgewählt.';
        return;
      }
      hinweis.textContent = '';
      G.senden('admin_grant', gabe).then(function (r) {
        var b = r.bericht || {};
        if (!b.mons.length && !b.gebiete.length && !b.gold) {
          hinweis.textContent = 'Das hat die Person schon alles.';
          return;
        }
        dlg.close();
        UI.toast('Gegeben an ' + (b.name || person.name || person.code) + '.', 'good');
        SG.protokoll.schreiben('geschenk',
          'GehstockMon: ' + was(r.schenkungen && r.schenkungen[0] ? r.schenkungen[0] : b)
          + ' an ' + (b.name || person.name || person.code),
          '', person.code);
        if (neu) neu();
      }, function (err) {
        /* Ein fremder Aussenposten ist kein Fehler, sondern eine Frage. */
        if (/^Gebiet \d+ .* gehört /.test(err.message)) {
          UI.confirm('Gehört schon jemandem', err.message
            + ' Soll es trotzdem übergeben werden?', 'Übergeben', true)
            .then(function (ok) { if (ok) geben(true); });
          return;
        }
        hinweis.textContent = err.message;
      });
    }
  }
})(SG);
