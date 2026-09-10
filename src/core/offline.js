/* ------------------------------------------------------------------
   "Offline spielen".

   Es gibt zwei Wege ohne Internet, und welcher taugt, haengt vom Geraet ab:

   - Auf dem iPad ist es "Zum Home-Bildschirm". Nur dort startet WebKit die
     Seite wirklich als App: Skripte laufen, und der Speicher bleibt erhalten.
   - Die heruntergeladene Einzeldatei laeuft auf Mac, PC und Android sofort
     im Browser. Auf dem iPad landet sie in der Dateien-Vorschau, und die
     fuehrt grundsaetzlich keine Skripte aus - daran laesst sich von hier
     aus nichts aendern, also wird es ehrlich dazugeschrieben.

   Der empfohlene Weg steht deshalb je nach Geraet oben.
   ------------------------------------------------------------------ */

(function (SG) {
  var UI = SG.ui;

  var Off = SG.offlineScreen = {};

  Off.render = function (app) {
    UI.clear(app);

    app.appendChild(UI.el('div.topbar', null, [
      UI.el('button.back.btn.sm.ghost', {
        html: '‹ Zurück',
        on: { click: function () { SG.router.go('#/'); } },
      }),
      UI.el('div.spacer'),
      UI.el('div.brand-title', { text: 'Offline spielen' }),
      UI.el('div.spacer'),
    ]));

    var screen = UI.el('div.screen');
    var wrap = UI.el('div.wrap-780');
    screen.appendChild(wrap);
    app.appendChild(screen);

    var file = SG.offlineFile || 'offline/Herr-Gehstocks-Hideout-Offline.html';
    var fileName = file.split('/').pop();
    var ios = SG.env.ios;

    /* ------------------------------------------------ Weg 1: Home-Bildschirm */

    function homeCard() {
      var card = UI.el('div.card.way');

      UI.add(card, [
        UI.el('div.way-head', null, [
          UI.el('div.way-ic', { text: '📲' }),
          UI.el('div', null, [
            UI.el('h3', { text: 'Auf den Home-Bildschirm legen' }),
            UI.el('div.way-sub', {
              text: ios ? 'Der Weg, der auf dem iPad wirklich funktioniert'
                : 'Startet wie eine App, ganz ohne Internet',
            }),
          ]),
          ios ? UI.el('div.way-tag', { text: 'Empfohlen' }) : null,
        ]),

        UI.el('div.steps', null, [
          UI.el('div.step', null, [
            UI.el('div.n'),
            UI.el('div.t', null, [
              UI.el('b', { text: 'Diese Seite in Safari geöffnet lassen' }),
              UI.el('span', { text: 'Einmal mit Internet — danach nie wieder.' }),
            ]),
          ]),
          UI.el('div.step', null, [
            UI.el('div.n'),
            UI.el('div.t', null, [
              UI.el('b', { text: 'Unten auf „Teilen" tippen' }),
              UI.el('span', { text: 'Das Rechteck mit dem Pfeil nach oben, in der Safari-Leiste.' }),
            ]),
          ]),
          UI.el('div.step', null, [
            UI.el('div.n'),
            UI.el('div.t', null, [
              UI.el('b', { text: '„Zum Home-Bildschirm" wählen' }),
              UI.el('span', { text: 'In der Liste etwas nach unten wischen, dann oben rechts auf „Hinzufügen".' }),
            ]),
          ]),
          UI.el('div.step', null, [
            UI.el('div.n'),
            UI.el('div.t', null, [
              UI.el('b', { text: 'Über das neue Symbol starten' }),
              UI.el('span', {
                text: 'Alle ' + SG.list().length + ' Spiele laufen dann auch im Flugmodus — '
                  + 'und die Spielstände bleiben erhalten.',
              }),
            ]),
          ]),
        ]),

        UI.el('div.notice.good', {
          style: { marginTop: '14px' },
          html: '<b>Warum dieser Weg:</b> nur so speichert das iPad Bestwerte und '
            + 'Tycoon-Stände dauerhaft. Eine zusätzliche App wird auch dafür nicht gebraucht.',
        }),
      ]);

      return card;
    }

    /* ------------------------------------------------ Weg 2: Einzeldatei */

    function fileCard() {
      /* Ein echtes <a download> - das ist der Weg, den iPad-Safari
         zuverlaessig in die Dateien-App leitet. */
      var link = UI.el('a.btn.primary', {
        href: file,
        download: fileName,
        html: '<span class="ico">⤓</span> Datei herunterladen',
        style: { textDecoration: 'none' },
        on: {
          click: function () {
            SG.audio.play('cash');
            setTimeout(function () {
              UI.toast('Wenn nichts passiert: lange auf den Knopf tippen → „Verknüpfte Datei laden".', null, 5200);
            }, 2600);
          },
        },
      });

      var card = UI.el('div.card.way');

      UI.add(card, [
        UI.el('div.way-head', null, [
          UI.el('div.way-ic', { text: '📄' }),
          UI.el('div', null, [
            UI.el('h3', { text: 'Als einzelne Datei herunterladen' }),
            UI.el('div.way-sub', {
              text: ios ? SG.nojsSpiele + ' Spiele schon beim Antippen in der Dateien-App'
                : 'Eine Datei, alle Spiele, kein Netz',
            }),
          ]),
          ios ? null : UI.el('div.way-tag', { text: 'Empfohlen' }),
        ]),

        UI.el('p.small.muted', {
          style: { margin: '2px 0 14px' },
          text: 'Eine einzige HTML-Datei mit allen ' + SG.list().length + ' Spielen und '
            + 'beiden Tycoons. Nichts wird nachgeladen, nichts installiert. '
            + 'Praktisch zum Weitergeben per AirDrop, USB-Stick oder E-Mail.',
        }),

        UI.el('div.center', { style: { marginBottom: '14px' } }, [link]),

        ios
          ? UI.el('div.notice.good', {
            html: '<b>Antippen genügt für ' + SG.nojsSpiele + ' Spiele.</b> Die Vorschau '
              + 'der Dateien-App führt keine Skripte aus — deshalb steckt in der Datei '
              + 'ein zweiter, skriptfreier Teil: Hideout-Tycoon, Keller-Abenteuer, '
              + 'Minensucher, Nonogramm, Sudoku, Memory, Labyrinth, Drei gewinnt, Quiz, '
              + 'Schiffe versenken, Wortgitter, Wortraten und Kopfrechnen laufen dort '
              + 'über reines HTML und CSS.',
          })
          : UI.el('div.notice.good', {
            html: '<b>So geht es:</b> Datei doppelklicken oder per Rechtsklick → '
              + '<b>Öffnen mit</b> → Safari, Chrome oder Edge. Sie läuft sofort, '
              + 'auch ohne Verbindung.',
          }),

        /* Fuer die volle Sammlung braucht es einen Betrachter, der Skripte
           ausfuehrt. Das steht hier ehrlich, statt es zu verschweigen. */
        ios ? UI.el('div.steps', { style: { marginTop: '4px' } }, [
          UI.el('div.step', null, [
            UI.el('div.n'),
            UI.el('div.t', null, [
              UI.el('b', { text: 'Herunterladen und in der Dateien-App antippen' }),
              UI.el('span', {
                text: fileName + ' liegt danach im Ordner „Downloads". '
                  + 'Ein Tipp genügt — das Menü mit ' + SG.nojsSpiele + ' Spielen '
                  + 'erscheint sofort, ohne Netz.',
              }),
            ]),
          ]),
          UI.el('div.step', null, [
            UI.el('div.n'),
            UI.el('div.t', null, [
              UI.el('b', {
                text: 'Für alle ' + SG.list().length + ' Spiele: gedrückt halten '
                  + '→ „Öffnen mit"',
              }),
              UI.el('span', {
                text: 'Dafür einmal eine HTML-Viewer-App aus dem App Store (nach '
                  + '„HTML Viewer" suchen, es gibt mehrere kostenlose). Dann laufen auch '
                  + 'Tetris, 2048 und alle Tycoons aus der Datei heraus.',
              }),
            ]),
          ]),
        ]) : null,

        UI.el('div.notice', {
          style: { marginTop: '10px' },
          html: ios
            ? '<b>Zu den Spielständen:</b> aus einer Datei heraus erlaubt iPadOS oft kein '
              + 'dauerhaftes Speichern. Bestwerte und Tycoon-Stände halten dann nur, '
              + 'solange die Datei offen ist — sichere sie über den Spielstand-Code. '
              + 'Wer dauerhaft speichern will, nimmt den Home-Bildschirm-Weg.'
            : '<b>Am Mac, PC oder Android-Tablet</b> läuft die Datei sofort im Browser — '
              + 'dort ist das der bequemste Weg.',
        }),
      ]);

      return card;
    }

    /* ------------------------------------------------ Zusammenbauen */

    UI.add(wrap, [
      UI.el('div.hero', null, [
        UI.el('div.big-ico', { text: '✈' }),
        UI.el('h1', { text: 'Ohne Internet spielen' }),
        UI.el('p', {
          text: ios
            ? 'Alle ' + SG.list().length + ' Spiele samt beiden Tycoons laufen auch ganz '
              + 'ohne Verbindung. Dafür gibt es zwei Wege: einen ohne jede Zusatz-App, '
              + 'und einen, der als Datei in der Dateien-App bleibt.'
            : 'Alle ' + SG.list().length + ' Spiele samt beiden Tycoons laufen auch ganz '
              + 'ohne Verbindung — als eine einzige Datei oder als Symbol auf dem '
              + 'Home-Bildschirm.',
        }),
      ]),
    ]);

    if (SG.env.standalone) {
      wrap.appendChild(UI.el('div.notice.good', {
        style: { marginBottom: '16px' },
        html: '<b>Du bist schon startklar.</b> Das Hideout läuft gerade vom '
          + 'Home-Bildschirm. Ab jetzt startet es auch im Flugmodus, und deine '
          + 'Spielstände bleiben erhalten.',
      }));
    }

    var cards = ios ? [homeCard(), fileCard()] : [fileCard(), homeCard()];
    cards.forEach(function (c) {
      wrap.appendChild(c);
      wrap.appendChild(UI.el('div', { style: { height: '16px' } }));
    });

    if (SG.storage.volatile) {
      wrap.appendChild(UI.el('div.notice.warn', {
        html: '<b>Achtung, dieses Gerät speichert gerade nicht dauerhaft.</b> '
          + 'Bestwerte und Tycoon-Stände halten nur, solange das Fenster offen bleibt. '
          + 'Sichere sie über den Spielstand-Code.',
      }));
      wrap.appendChild(UI.el('div.center', { style: { margin: '12px 0 16px' } }, [
        UI.btn('Spielstand-Code sichern', function () { SG.hub.settings(); }, 'sm'),
      ]));
    }

    UI.add(wrap, [
      UI.el('div.notice', {
        html: '<b>Was offline fehlt:</b> GehstockMon mit seiner gemeinsamen Spielerwelt und der Online-Mehrspieler über Raum-Codes. '
          + 'Die übrigen enthaltenen Spiele lassen sich allein, gegen den Computer oder zu zweit '
          + 'am selben iPad spielen.',
      }),
      UI.el('div', { style: { height: '20px' } }),
    ]);

    return { destroy: function () {} };
  };
})(SG);
