/* ------------------------------------------------------------------
   Arena - Echtzeit-Kartenspiel, als eigene Seite mitgeliefert.

   Das Spiel ist ein eigenstaendiges Projekt: Vite, TypeScript und ein
   Canvas-Renderer mit perspektivischer Ansicht. Damit passt es nicht
   in die esbuild-Pipeline der Hideout-Seite und liegt stattdessen
   fertig gebaut unter games/arena/ daneben - dieselbe Loesung wie
   beim Krisenstab.

   Der Quelltext liegt im Projektordner unter arena/. Gebaut wird
   beides zusammen mit:  node tools/deploy-bauen.mjs

   In der Offline-Einzeldatei taucht das Spiel nicht auf, siehe
   SG.list() im Katalog - dort fehlt die Seite schlicht.
   ------------------------------------------------------------------ */

(function (SG) {
  var G = SG.gfx;
  var UI = SG.ui;

  var SEITE = 'games/arena/index.html';

  /* Farben aus der Palette des Spiels, damit Kachel und Arena
     zusammenpassen. Wer dort etwas aendert, sollte hier nachziehen. */
  var RASEN = '#3a6b41';
  var RASEN_HELL = '#437a49';
  var WASSER = '#1b5f8b';
  var WASSER_HELL = '#2f86b8';
  var HOLZ = '#9a7549';
  var STEIN = '#dfe6ef';
  var STEIN_DUNKEL = '#8d99ab';
  var BLAU = '#3b82f6';
  var ROT = '#ef4444';

  SG.register({
    id: 'arena',
    name: 'Arena',
    category: 'karten',
    desc: 'Echtzeit-Duell: Deck, Elixir, zwei Brücken — wer zuerst den Turm knackt',
    tags: ['echtzeit', 'karten', 'deck', 'elixir', 'türme', 'duell', 'strategie'],
    external: SEITE,

    /* Kachelvorschau: das Spielfeld aus derselben Blickrichtung wie im
       Spiel - hinten schmaler, Fluss quer, zwei Brücken, je ein Turm
       pro Seite. Wer die Kachel sieht, weiß, was ihn erwartet. */
    preview: function (c, w, h) {
      c.fillStyle = '#080b12';
      c.fillRect(0, 0, w, h);

      // Feld als Trapez - hinten 76 % der vorderen Breite.
      var randY = h * 0.06;
      var vorne = w * 0.86;
      var hinten = vorne * 0.76;
      var mx = w / 2;
      var oy = randY;
      var uy = h - randY;

      var links = function (t) { return mx - (hinten + (vorne - hinten) * t) / 2; };
      var rechts = function (t) { return mx + (hinten + (vorne - hinten) * t) / 2; };
      var yBei = function (t) { return oy + (uy - oy) * t; };

      G.poly(c, [
        [links(0), oy], [rechts(0), oy], [rechts(1), uy], [links(1), uy],
      ], RASEN, true);

      // Mähstreifen
      c.save();
      c.beginPath();
      c.moveTo(links(0), oy);
      c.lineTo(rechts(0), oy);
      c.lineTo(rechts(1), uy);
      c.lineTo(links(1), uy);
      c.closePath();
      c.clip();
      c.fillStyle = RASEN_HELL;
      c.globalAlpha = 0.4;
      for (var i = 0; i < 8; i += 2) {
        var t0 = i / 8;
        var t1 = (i + 1) / 8;
        G.poly(c, [
          [links(t0), yBei(t0)], [rechts(t0), yBei(t0)],
          [rechts(t1), yBei(t1)], [links(t1), yBei(t1)],
        ], RASEN_HELL, true);
      }
      c.globalAlpha = 1;
      c.restore();

      // Fluss quer durch die Mitte
      var fa = 0.44;
      var fb = 0.56;
      G.poly(c, [
        [links(fa), yBei(fa)], [rechts(fa), yBei(fa)],
        [rechts(fb), yBei(fb)], [links(fb), yBei(fb)],
      ], WASSER, true);
      c.globalAlpha = 0.75;
      G.line(c, links(0.48) + w * 0.04, yBei(0.48), rechts(0.48) - w * 0.04,
        yBei(0.48), WASSER_HELL, Math.max(1, h * 0.012));
      c.globalAlpha = 1;

      // Zwei Brücken
      var bruecke = function (t) {
        var breite = (rechts(0.5) - links(0.5)) * 0.13;
        var x = links(0.5) + (rechts(0.5) - links(0.5)) * t;
        c.fillStyle = HOLZ;
        c.fillRect(x - breite / 2, yBei(fa) - h * 0.02,
          breite, yBei(fb) - yBei(fa) + h * 0.04);
      };
      bruecke(0.2);
      bruecke(0.8);

      // Je ein Turm pro Seite, in Parteifarbe abgesetzt
      var turm = function (t, farbe) {
        var x = mx;
        var y = yBei(t);
        var breite = w * (0.1 + 0.03 * t);
        var hoehe = breite * 1.15;
        // Sockel
        G.fillRound(c, x - breite * 0.72, y - breite * 0.16,
          breite * 1.44, breite * 0.38, breite * 0.1, farbe);
        // Körper
        c.fillStyle = STEIN;
        c.fillRect(x - breite / 2, y - hoehe, breite, hoehe);
        c.fillStyle = STEIN_DUNKEL;
        c.fillRect(x + breite * 0.16, y - hoehe, breite * 0.34, hoehe);
        // Zinnen
        c.fillStyle = STEIN_DUNKEL;
        for (var z = 0; z < 3; z++) {
          c.fillRect(x - breite / 2 + (breite / 3) * z + breite * 0.04,
            y - hoehe - breite * 0.16, breite * 0.22, breite * 0.16);
        }
        // Schießscharte
        c.fillStyle = farbe;
        c.fillRect(x - breite * 0.13, y - hoehe * 0.66, breite * 0.26, hoehe * 0.34);
      };
      turm(0.16, ROT);
      turm(0.92, BLAU);
    },

    /* Wird nur erreicht, wenn jemand die Adresse von Hand eingibt -
       aus dem Hub führt die Kachel direkt auf die Seite. */
    mount: function (host) {
      var sheet = host.sheet();
      UI.add(sheet, [
        UI.el('div.hero', null, [
          UI.el('div.big-ico', { text: '⚔️' }),
          UI.el('h1', { text: 'Arena' }),
          UI.el('p', {
            text: 'Dieses Spiel liegt als eigene Seite neben dem Hideout. '
              + 'Es braucht beim ersten Start eine Verbindung und ist in der '
              + 'Offline-Datei nicht enthalten. Querformat.',
          }),
        ]),
        UI.el('div.center', null, [
          UI.el('a.btn.primary', {
            href: SEITE, html: 'Arena öffnen',
            style: { textDecoration: 'none' },
          }),
        ]),
      ]);
      return {
        state: { extern: true },
        destroy: function () {},
      };
    },
  });
})(SG);
