/* ------------------------------------------------------------------
   Gehstock Ops - 3D-Ego-Shooter, als eigene Seite mitgeliefert.

   Das Spiel ist ein eigenes kleines Teilprojekt unter shooter/ (three.js,
   eigener esbuild-Lauf) und liegt fertig gebaut unter games/shooter/.
   build.mjs baut es mit. Code und Grafik laedt der Browser erst, wenn
   jemand die Kachel oeffnet - die Hideout-Seite wird davon nicht
   schwerer.

   In der Offline-Einzeldatei fehlt die Kachel ganz: build.mjs laesst
   diese Datei dort weg (NUR_ONLINE_JS), und SG.list() blendet eigene
   Seiten offline ohnehin aus.
   ------------------------------------------------------------------ */

(function (SG) {
  var G = SG.gfx;
  var UI = SG.ui;

  var SEITE = 'games/shooter/index.html';

  var BLAU = '#3b82f6';
  var ROT = '#ef4444';
  var GOLD = '#e5b94c';

  SG.register({
    id: 'shooter',
    name: 'Gehstock Ops',
    category: 'arcade',
    desc: '3D-Shooter: Team-Deathmatch drei gegen drei auf dem Übungsgelände',
    tags: ['shooter', 'ego', '3d', 'fps', 'team', 'deathmatch', 'bots', 'action', 'ops'],
    external: SEITE,
    bildKachel: true,

    /* Kachel: Blick durch das Visier auf den Containerhof, davor der
       Schriftzug. Gezeichnet, kein Bild - kostet nichts beim Laden. */
    preview: function (c, w, h) {
      // Himmel und Boden
      c.fillStyle = G.linear(c, 0, 0, 0, h, [0, '#26384a', 0.55, '#5a6f7d', 0.56, '#3a3f3a', 1, '#232622']);
      c.fillRect(0, 0, w, h);

      // Umfassungsmauer am Horizont
      c.fillStyle = '#4a5157';
      c.fillRect(0, h * 0.44, w, h * 0.12);
      c.fillStyle = '#3c4247';
      c.fillRect(0, h * 0.53, w, h * 0.03);

      // Container, gestaffelt
      var cont = function (x, y, bw, bh, farbe, dunkel) {
        c.fillStyle = farbe;
        c.fillRect(x, y, bw, bh);
        c.fillStyle = dunkel;
        for (var i = 0; i < 9; i++) c.fillRect(x + (bw / 9) * i, y, Math.max(1, bw / 40), bh);
        c.fillRect(x, y, bw, Math.max(1, bh * 0.06));
      };
      cont(w * 0.02, h * 0.36, w * 0.3, h * 0.24, '#8a5634', '#6b4128');
      cont(w * 0.64, h * 0.34, w * 0.34, h * 0.27, '#4d6338', '#3c4d2c');
      cont(w * 0.34, h * 0.42, w * 0.2, h * 0.16, '#5e6c74', '#4a565c');

      // Gegner als Silhouette mit roter Weste
      var gx = w * 0.56, gy = h * 0.6, s = h * 0.0042;
      c.fillStyle = '#20241f';
      c.fillRect(gx - 7 * s, gy - 34 * s, 14 * s, 16 * s);
      c.fillRect(gx - 6 * s, gy - 18 * s, 5 * s, 18 * s);
      c.fillRect(gx + 1 * s, gy - 18 * s, 5 * s, 18 * s);
      c.fillStyle = ROT;
      c.fillRect(gx - 7 * s, gy - 32 * s, 14 * s, 9 * s);
      c.fillStyle = '#7a2320';
      c.fillRect(gx - 5 * s, gy - 44 * s, 10 * s, 5 * s);
      c.fillStyle = '#c9a27b';
      c.fillRect(gx - 4 * s, gy - 40 * s, 8 * s, 6 * s);
      c.fillStyle = '#1b1d1b';
      c.fillRect(gx - 16 * s, gy - 29 * s, 14 * s, 3 * s);

      // Fadenkreuz um den Gegner
      var cx = gx, cy = gy - 30 * s, r = h * 0.12;
      c.strokeStyle = 'rgba(255,255,255,0.9)';
      c.lineWidth = Math.max(1.5, h * 0.012);
      c.beginPath();
      c.moveTo(cx - r, cy); c.lineTo(cx - r * 0.35, cy);
      c.moveTo(cx + r * 0.35, cy); c.lineTo(cx + r, cy);
      c.moveTo(cx, cy - r); c.lineTo(cx, cy - r * 0.35);
      c.moveTo(cx, cy + r * 0.35); c.lineTo(cx, cy + r);
      c.stroke();

      // Waffe des Spielers von rechts unten
      G.poly(c, [w * 0.74, h, w * 0.86, h * 0.72, w * 0.95, h * 0.74, w * 0.9, h], '#1c1f22', true);
      G.poly(c, [w * 0.85, h * 0.74, w * 0.9, h * 0.66, w * 0.93, h * 0.67, w * 0.9, h * 0.75], '#2b3035', true);

      // Abdunkeln unten fuer den Schriftzug
      c.fillStyle = G.linear(c, 0, h * 0.62, 0, h, [0, 'rgba(8,10,14,0)', 1, 'rgba(8,10,14,0.92)']);
      c.fillRect(0, h * 0.62, w, h * 0.38);

      G.text(c, 'GEHSTOCK OPS', w * 0.06, h * 0.86, {
        size: Math.round(h * 0.15), weight: 800, color: '#f2f4f6', baseline: 'middle',
      });
      c.fillStyle = BLAU;
      c.fillRect(w * 0.06, h * 0.94, w * 0.1, Math.max(2, h * 0.018));
      c.fillStyle = GOLD;
      c.fillRect(w * 0.17, h * 0.94, w * 0.05, Math.max(2, h * 0.018));
      c.fillStyle = ROT;
      c.fillRect(w * 0.23, h * 0.94, w * 0.1, Math.max(2, h * 0.018));
    },

    /* Nur erreichbar, wenn jemand die Adresse von Hand eingibt - aus dem
       Hub fuehrt die Kachel direkt auf die Seite. */
    mount: function (host) {
      var sheet = host.sheet();
      UI.add(sheet, [
        UI.el('div.hero', null, [
          UI.el('div.big-ico', { text: '🎯' }),
          UI.el('h1', { text: 'Gehstock Ops' }),
          UI.el('p', {
            text: 'Dieser 3D-Shooter liegt als eigene Seite neben dem Hideout. '
              + 'Er braucht beim ersten Start eine Verbindung und ist in der '
              + 'Offline-Datei nicht enthalten. Am besten im Querformat.',
          }),
        ]),
        UI.el('div.center', null, [
          UI.el('a.btn.primary', {
            href: SEITE, html: 'Gehstock Ops öffnen',
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
