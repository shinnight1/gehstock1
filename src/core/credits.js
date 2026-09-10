/* ------------------------------------------------------------------
   Impressum und "Über uns".

   Die Namen stehen an genau einer Stelle. Einzelne Spiele koennen in
   ihrer Registrierung ein Feld `credit` mitbringen - das erscheint
   dann sowohl im Spiel als auch hier in der Liste, ohne dass jemand
   zwei Stellen pflegen muss.
   ------------------------------------------------------------------ */

(function (SG) {
  var UI = SG.ui;

  var C = SG.credits = {};

  C.team = [
    {
      name: 'Lucas',
      rolle: 'Haupt-Developer',
      text: 'Konzept, Aufbau und der allergrößte Teil des Codes — vom Kern über '
        + 'die Spiele bis zu beiden großen Tycoons.',
    },
    {
      name: 'Max',
      rolle: 'Krisenstab 03:12',
      text: 'Hat das Krisenspiel vollständig gebaut und mitgebracht. Es läuft als '
        + 'eigene Seite neben dem Hideout.',
    },
    {
      name: 'Karl',
      rolle: 'Idee zum Hafen-Tycoon',
      text: 'Von ihm stammt die Idee für den Hafen-Tycoon — Container, Kaimauern, '
        + 'Brücken und der ganze Rest.',
    },
  ];

  /* Ein Satz zur Technik, damit klar ist, warum es so gebaut ist */
  C.technik = [
    'Reines JavaScript, kein Framework und keine Abhängigkeit im Spiel.',
    'Jede Grafik wird im Browser gezeichnet, jeder Ton aus Oszillatoren erzeugt — '
      + 'es gibt keine Bild-, Schrift- oder Tondateien.',
    'Dieselbe Quelle wird zu zwei Ergebnissen gebaut: der Webseite und einer '
      + 'einzelnen HTML-Datei, die ohne Internet auskommt.',
  ];

  C.render = function (app) {
    UI.clear(app);

    app.appendChild(UI.el('div.topbar', null, [
      UI.el('button.back.btn.sm.ghost', {
        html: '‹ Zurück',
        on: { click: function () { SG.router.go('#/'); } },
      }),
      UI.el('div.spacer'),
      UI.el('div.brand-title', { text: 'Über uns' }),
      UI.el('div.spacer'),
    ]));

    var screen = UI.el('div.screen');
    var wrap = UI.el('div.wrap-780');
    screen.appendChild(wrap);
    app.appendChild(screen);

    UI.add(wrap, [
      UI.el('div.hero', null, [
        UI.el('div.big-ico', { text: '🦯' }),
        UI.el('h1', { text: 'Herr Gehstocks Hideout' }),
        UI.el('p', {
          text: SG.list().length + ' Spiele, drei Tycoons und ein Krisenstab. '
            + 'Gebaut fürs iPad, spielbar auch ohne Internet.',
        }),
      ]),
    ]);

    /* --- Wer was gemacht hat --- */
    wrap.appendChild(UI.el('div.sec-head', null, [
      UI.el('h2', { text: 'Wer daran gebaut hat' }),
    ]));

    C.team.forEach(function (p) {
      wrap.appendChild(UI.el('div.card', { style: { marginBottom: '10px' } }, [
        UI.el('div.row', { style: { alignItems: 'baseline', gap: '10px' } }, [
          UI.el('div', { text: p.name, style: { fontSize: '18px', fontWeight: '700' } }),
          UI.el('div.small', {
            text: p.rolle,
            style: { color: 'var(--gold)', fontWeight: '650' },
          }),
        ]),
        UI.el('p.small.muted', { style: { marginTop: '6px' }, text: p.text }),
      ]));
    });

    /* --- Beiträge an einzelnen Spielen --- */
    var mitCredit = SG.all().filter(function (g) { return g.credit; });
    if (mitCredit.length) {
      wrap.appendChild(UI.el('div.sec-head', null, [
        UI.el('h2', { text: 'Beiträge an einzelnen Spielen' }),
      ]));
      var liste = UI.el('div.card');
      mitCredit.forEach(function (g) {
        liste.appendChild(UI.el('div.item', null, [
          UI.el('div.thumb', { text: g.credit.icon || '★' }),
          UI.el('div.main', null, [
            UI.el('div.t', { text: g.name }),
            UI.el('div.d', { text: g.credit.text }),
          ]),
        ]));
      });
      wrap.appendChild(liste);
    }

    /* --- Technik --- */
    wrap.appendChild(UI.el('div.sec-head', null, [UI.el('h2', { text: 'Technik' })]));
    var tech = UI.el('div.card');
    C.technik.forEach(function (t) {
      tech.appendChild(UI.el('p.small.muted', { style: { marginBottom: '8px' }, text: t }));
    });
    tech.appendChild(UI.el('p.small.muted', {
      style: { marginBottom: '0' },
      text: 'Version ' + SG.version + ' · ' + (SG.offline ? 'Offline-Einzeldatei' : 'Webseite'),
    }));
    wrap.appendChild(tech);

    /* --- Impressum im engeren Sinn --- */
    wrap.appendChild(UI.el('div.sec-head', null, [UI.el('h2', { text: 'Impressum' })]));
    wrap.appendChild(UI.el('div.card', null, [
      UI.el('p.small.muted', {
        html: 'Privates, nicht kommerzielles Schulprojekt. Keine Werbung, '
          + 'keine Analyse, keine Weitergabe von Daten.',
      }),
      UI.el('p.small.muted', {
        style: { marginTop: '10px', marginBottom: '0' },
        html: '<b>Daten:</b> Alles, was das Hideout speichert — Spielstände, '
          + 'Bestwerte, Einstellungen — bleibt im Browser des jeweiligen Geräts. '
          + 'Es wird nichts an einen Server gesendet. Einzige Ausnahme ist der '
          + 'Online-Mehrspieler: dort laufen Raum-Code, Spielername und die '
          + 'Liste der Züge über ein Relais, und die Räume verfallen automatisch.',
      }),
    ]));

    wrap.appendChild(UI.el('div', { style: { height: '24px' } }));

    return { destroy: function () {} };
  };
})(SG);
