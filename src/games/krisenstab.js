/* ------------------------------------------------------------------
   Krisenstab 03:12 - als eigene Seite mitgeliefert.

   Das Spiel kommt fertig von aussen: React, JSX ueber Babel und
   Tailwind, alles von CDNs nachgeladen. Damit passt es nicht in die
   Offline-Einzeldatei, die keinen einzigen externen Verweis enthalten
   darf. Es liegt deshalb unveraendert als krisenstab.html neben der
   Seite; hier steht nur die Kachel, die dorthin fuehrt.

   In der Offline-Datei taucht es gar nicht erst auf - siehe
   SG.list() im Katalog.
   ------------------------------------------------------------------ */

(function (SG) {
  var G = SG.gfx;
  var UI = SG.ui;

  var SEITE = 'krisenstab.html';

  SG.register({
    id: 'krisenstab',
    name: 'Krisenstab 03:12',
    category: 'story',
    desc: '28 Minuten bis zum Einschlag — neun Lagen, kein Zurück',
    tags: ['krise', 'entscheidung', 'lagezentrum', 'geschichte', 'ernst'],
    external: SEITE,      // oeffnet eine eigene Seite statt eines Spiels
    credit: { icon: '🕯', text: 'Made by Max — vollständig von ihm gebaut und mitgebracht.' },

    preview: function (c, w, h) {
      // Lagezentrum: dunkler Raum, Kartentisch, Uhr, ein Lichtkegel
      c.fillStyle = '#0c0a09';
      c.fillRect(0, 0, w, h);

      var g = G.radial(c, w * 0.5, h * 0.28, 4, w * 0.7,
        [0, 'rgba(245,158,11,.16)', 1, 'rgba(245,158,11,0)']);
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);

      // Kartentisch
      c.save();
      c.translate(w * 0.5, h * 0.72);
      c.transform(1, 0, -0.35, 0.42, 0, 0);
      G.fillRound(c, -w * 0.34, -h * 0.34, w * 0.68, h * 0.68, 6, '#1c1917');
      c.strokeStyle = 'rgba(120,113,108,.5)';
      c.lineWidth = 1;
      for (var i = 1; i < 5; i++) {
        c.beginPath();
        c.moveTo(-w * 0.34, -h * 0.34 + (h * 0.68 / 5) * i);
        c.lineTo(w * 0.34, -h * 0.34 + (h * 0.68 / 5) * i);
        c.stroke();
      }
      c.restore();

      // Zwei Marker auf dem Tisch
      G.circle(c, w * 0.42, h * 0.7, 3.2, '#f59e0b');
      G.circle(c, w * 0.58, h * 0.76, 3.2, '#ef4444');

      // Uhrzeit
      G.text(c, '03:12', w * 0.5, h * 0.26, {
        font: G.font(Math.round(h * 0.2), 700, true),
        fill: '#f59e0b', align: 'center', baseline: 'middle',
      });
      G.text(c, 'LAGEZENTRUM', w * 0.5, h * 0.42, {
        font: G.font(Math.round(h * 0.075), 600),
        fill: '#78716c', align: 'center', baseline: 'middle',
      });
    },

    /* Wird nur erreicht, wenn jemand die Adresse direkt aufruft -
       normalerweise faengt der Hub die Kachel vorher ab. */
    mount: function (host) {
      var sheet = host.sheet();
      UI.add(sheet, [
        UI.el('div.hero', null, [
          UI.el('div.big-ico', { text: '🕯' }),
          UI.el('h1', { text: 'Krisenstab 03:12' }),
          UI.el('p', {
            text: 'Dieses Spiel liegt als eigene Seite neben dem Hideout. '
              + 'Es braucht beim ersten Start eine Verbindung und ist in der '
              + 'Offline-Datei nicht enthalten.',
          }),
        ]),
        UI.el('div.center', null, [
          UI.el('a.btn.primary', {
            href: SEITE, html: 'Lagezentrum öffnen',
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
