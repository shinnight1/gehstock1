/* ------------------------------------------------------------------
   Impressum und "Über uns".

   Die einzige Seite, die bewusst anders aussieht als der Rest: das Büro
   der Geschäftsführung - dunkles Nussholz, Messing, Serifenschrift. Das
   Holz ist kein Foto, sondern gestrecktes Rauschen (src/styles/ueber.css).

   Die Namen stehen an genau einer Stelle, in C.team. Die Porträts liegen
   als ui-team-*.webp daneben und kommen nicht in die Offline-Datei - dort
   steht statt des Bildes der Anfangsbuchstabe.
   ------------------------------------------------------------------ */

(function (SG) {
  var UI = SG.ui;

  var C = SG.credits = {};

  C.team = [
    {
      name: 'Louis',
      rolle: 'Chief Executive Officer',
      bild: 'ui-team-louis',
      gross: true,
      text: 'GehstockMon ist seins: handgemacht entwickelt, von der gemeinsamen '
        + 'Spielerwelt über die Insel bis zum letzten der 57 Mons. Die Arena hat '
        + 'er ebenfalls gebaut, und den Umzug auf den eigenen Server hat er umgesetzt.',
    },
    {
      name: 'Lucas',
      rolle: 'Quality Assurance · Führungsebene',
      zusatz: 'Ehemaliger CEO',
      bild: 'ui-team-lucas',
      text: 'Hat das Hideout aufgebaut: Konzept, Kern und der allergrößte Teil des '
        + 'Codes, von den Spielen bis zu den großen Tycoons. In der Führungsebene '
        + 'ist er heute für die Qualität zuständig.',
    },
  ];

  C.stellen = {
    titel: 'Wir suchen Verstärkung',
    text: 'Das Hideout wächst, und dafür brauchen wir mehr Leute. Ob du Spiele '
      + 'bauen, neue Stände testen oder mit Ideen und Grafik helfen willst: melde dich.',
    bereiche: ['Spieleentwicklung', 'Tests & Feedback', 'Ideen & Grafik'],
    kontakt: 'Anfragen an Louis',
  };

  C.technik = [
    'Ohne Framework: JavaScript im Browser, die Arena in TypeScript. Nur '
      + 'GehstockMon bringt eine 3D-Bibliothek mit.',
    'Die klassischen Spiele und Tycoons zeichnen jede Grafik selbst und erzeugen '
      + 'jeden Ton aus Oszillatoren.',
    'Aus derselben Quelle entstehen die Webseite und eine einzelne HTML-Datei, '
      + 'die ohne Internet auskommt.',
    'Seit dem 26. September 2026 läuft alles auf unserem eigenen Server. Eine '
      + 'neue Version geht nur live, wenn alle Tests bestehen.',
  ];

  C.impressum = 'Privates, nicht kommerzielles Schulprojekt. Keine Werbung, kein '
    + 'Verkauf von Daten.';

  /* Was wirklich wo liegt - bitte nachziehen, wenn sich daran etwas aendert. */
  C.daten = [
    ['Im Browser.', 'Bestwerte, Einstellungen und die Stände der Offline-Spiele '
      + 'bleiben auf deinem Gerät.'],
    ['Auf unserem Server.', 'Dein Name mit Zugangscode und Rolle, dein '
      + 'GehstockMon-Spielstand, Chat-Nachrichten und Bilder, die Pixelkarte und ein '
      + 'Protokoll der Anmeldungen und Admin-Aktionen. Solange du online bist, sieht '
      + 'der Server, in welchem Bereich du gerade bist.'],
    ['Geräte.', 'Zu jeder Anmeldung wird die Geräteart gespeichert, zu falschen Codes '
      + 'zusätzlich Bildschirmgröße, Sprache und Zeitzone.'],
    ['Bildschirme.', 'Admins können ansehen, was das Hideout gerade auf deinem '
      + 'Bildschirm zeichnet. Andere Apps sieht niemand, und oben links erscheint '
      + 'dann ein Hinweis.'],
    ['Sicherung.', 'Jede Nacht: 14 Tage auf dem Server, dazu eine Kopie bei Upstash.'],
  ];

  /* ---------------------------------------------------------- Bausteine */

  function ornament() {
    return UI.el('div.uu-orn', { 'aria-hidden': 'true' }, [UI.el('i')]);
  }

  function portraet(p) {
    var quelle = SG.assets && SG.assets[p.bild];
    return UI.el('div.uu-rahmen', null, [
      quelle
        ? UI.el('img', { src: quelle, alt: p.name + ', ' + p.rolle, loading: 'lazy' })
        : UI.el('span.uu-monogramm', { text: p.name.charAt(0), 'aria-hidden': 'true' }),
    ]);
  }

  function person(p, k) {
    return UI.el('article.uu-person' + (p.gross ? '.gross' : ''), {
      style: { animationDelay: (120 + k * 140) + 'ms' },
    }, [
      UI.el('div.uu-bild', null, [
        portraet(p),
        UI.el('div.uu-schild', null, [
          UI.el('b', { text: p.name }),
          UI.el('span', { text: p.rolle }),
        ]),
      ]),
      p.zusatz ? UI.el('div.uu-zusatz', { text: p.zusatz }) : null,
      UI.el('p.uu-text', { text: p.text }),
    ]);
  }

  /* ---------------------------------------------------------- Seite */

  C.render = function (app) {
    UI.clear(app);

    app.appendChild(UI.el('div.topbar.uu-top', null, [
      UI.el('button.back.btn.sm.ghost', {
        html: '‹ Zurück',
        on: { click: function () { SG.router.go('#/'); } },
      }),
      UI.el('div.spacer'),
      UI.el('div.uu-top-titel', { text: 'Über uns' }),
      UI.el('div.spacer'),
    ]));

    var screen = UI.el('div.screen.uu-screen');
    var wrap = UI.el('div.uu-wrap');
    screen.appendChild(wrap);
    app.appendChild(screen);

    /* --- Kopf --- */
    wrap.appendChild(UI.el('header.uu-kopf', null, [
      UI.el('div.uu-wappen', { 'aria-hidden': 'true' }, [UI.el('i')]),
      UI.el('div.uu-eyebrow', { text: 'Impressum & Führung' }),
      UI.el('h1.uu-h1', { text: 'Herr Gehstocks Hideout' }),
      UI.el('p.uu-lead', {
        text: SG.list().length + ' Spiele unter einem Dach, mit GehstockMon und der '
          + 'Arena als Aushängeschildern. Gebaut fürs iPad, betrieben auf unserem '
          + 'eigenen Server.',
      }),
    ]));

    /* --- Die Geschäftsführung --- */
    wrap.appendChild(ornament());
    wrap.appendChild(UI.el('section.uu-fuehrung', null, [
      UI.el('div.uu-eyebrow', { text: 'Die Geschäftsführung' }),
      UI.el('div.uu-team', null, C.team.map(person)),
    ]));

    /* --- Die Präsentation vom Umzug: dasselbe Intro wie nach dem Login --- */
    var praesentation = null;
    if (!SG.offline && SG.umzug && SG.umzug.einbetten) {
      var bildschirm = UI.el('div.uu-bildschirm');
      wrap.appendChild(ornament());
      wrap.appendChild(UI.el('section.uu-praes', null, [
        UI.el('div.uu-eyebrow', { text: 'Präsentation' }),
        UI.el('h2.uu-h2', { text: 'Warum wir umgezogen sind' }),
        UI.el('p.uu-lead.klein', {
          text: 'Dieselbe Präsentation, die beim ersten Einloggen nach dem Umzug '
            + 'läuft, hier zum Durchklicken.',
        }),
        bildschirm,
      ]));
      praesentation = SG.umzug.einbetten(bildschirm);
    }

    /* --- Stellenausschreibung --- */
    wrap.appendChild(ornament());
    wrap.appendChild(UI.el('section.uu-stellen', null, [
      UI.el('div.uu-siegel', { 'aria-hidden': 'true', text: 'HGH' }),
      UI.el('div.uu-eyebrow', { text: 'Stellenausschreibung' }),
      UI.el('h2.uu-h2', { text: C.stellen.titel }),
      UI.el('p.uu-text', { text: C.stellen.text }),
      UI.el('div.uu-bereiche', null, C.stellen.bereiche.map(function (b) {
        return UI.el('span', { text: b });
      })),
      UI.el('div.uu-kontakt', null, [
        UI.el('span', { text: C.stellen.kontakt }),
        UI.el('small', { text: 'Louis · Chief Executive Officer' }),
      ]),
    ]));

    /* --- Technik und Impressum im Kleingedruckten --- */
    wrap.appendChild(ornament());
    wrap.appendChild(UI.el('section.uu-klein', null, [
      UI.el('div', null, [UI.el('div.uu-eyebrow', { text: 'Technik' })]
        .concat(C.technik.map(function (t) { return UI.el('p', { text: t }); }))
        .concat([UI.el('p.uu-version', {
          text: 'Version ' + SG.version + ' · ' + (SG.offline ? 'Offline-Einzeldatei' : 'Webseite'),
        })])),
      UI.el('div', null, [
        UI.el('div.uu-eyebrow', { text: 'Impressum' }),
        UI.el('p', { text: C.impressum }),
      ].concat(C.daten.map(function (d) {
        return UI.el('p', null, [UI.el('b', { text: d[0] + ' ' }), document.createTextNode(d[1])]);
      }))),
    ]));

    return {
      destroy: function () { if (praesentation) praesentation.destroy(); },
    };
  };
})(SG);
