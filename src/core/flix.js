/* ------------------------------------------------------------------
   Gehstockflix.

   Noch ohne Videos - das kommt spaeter. Was schon steht: der Knopf und
   der Vorspann.

   Der Vorspann ist der bekannte Buchstabenaufbau, nur mit einem G:
   erst ein Lichtblitz, dann faechern sich senkrechte Streifen auf,
   fahren zusammen und lassen dabei die Form des Buchstabens stehen.
   Alles auf Canvas gezeichnet, kein Bild und keine Schriftdatei - die
   Offline-Einzeldatei duldet ja beides nicht.

   Wie die Form entsteht: der Buchstabe wird einmal in einen zweiten,
   unsichtbaren Canvas gezeichnet und dient danach als Maske. Die
   Streifen werden durch diese Maske gezeichnet ('destination-in'),
   deshalb sehen sie am Ende exakt wie das G aus.
   ------------------------------------------------------------------ */

(function (SG) {
  var UI = SG.ui;
  var U = SG.util;

  var F = SG.flix = {};

  var ROT = '#e50914';
  var ROT_HELL = '#ff3b47';

  /* ------------------------------------------------------------------
     Der Knopf im Hub
     ------------------------------------------------------------------ */

  F.knopf = function () {
    return UI.el('button.flix-knopf', {
      'aria-label': 'Gehstockflix',
      on: {
        click: function () {
          SG.audio.play('select');
          SG.router.go('#/flix');
        },
      },
    }, [
      UI.el('div.flix-g', { text: 'G' }),
      UI.el('div.flix-text', null, [
        UI.el('div.fx-t', { text: 'GEHSTOCKFLIX' }),
        UI.el('div.fx-d', { text: 'Videos für die Pause · noch leer' }),
      ]),
      UI.el('div.flix-pfeil', { text: '▶' }),
    ]);
  };

  /* ------------------------------------------------------------------
     Der Bildschirm
     ------------------------------------------------------------------ */

  F.render = function (app) {
    UI.clear(app);
    var lebt = true;
    var vorspann = null;

    /* Einmal je Sitzung reicht - sonst nervt er beim dritten Mal. */
    if (!F.gesehen) {
      F.gesehen = true;
      vorspann = spielen(app, function () {
        if (lebt) katalog();
      });
    } else {
      katalog();
    }

    function katalog() {
      UI.clear(app);
      app.appendChild(UI.el('div.topbar.flix-topbar', null, [
        UI.el('button.back.btn.sm.ghost', {
          html: '‹ Zurück',
          on: { click: function () { SG.router.go('#/'); } },
        }),
        UI.el('div.spacer'),
        UI.el('div.flix-marke', { text: 'GEHSTOCKFLIX' }),
        UI.el('div.spacer'),
        UI.el('button.btn.sm.ghost', {
          html: '<span class="ico">↻</span>',
          'aria-label': 'Vorspann noch einmal',
          on: {
            click: function () {
              F.gesehen = false;
              SG.router.reload();
            },
          },
        }),
      ]));

      var schirm = UI.el('div.screen');
      var wrap = UI.el('div.wrap-1000');
      schirm.appendChild(wrap);
      app.appendChild(schirm);

      /* Ein Regal, damit man sieht, wie es aussehen wird - die Faecher
         sind absichtlich leer. */
      ['Zuletzt hinzugefügt', 'Aus der Pause', 'Meine Liste'].forEach(function (titel) {
        wrap.appendChild(UI.el('div.flix-reihe', null, [
          UI.el('div.flix-reihe-titel', { text: titel }),
          UI.el('div.flix-regal', null, [0, 1, 2, 3, 4, 5].map(function () {
            return UI.el('div.flix-platz');
          })),
        ]));
      });

      wrap.appendChild(UI.el('div.notice', {
        style: { marginTop: '18px' },
        html: '<b>Noch keine Videos.</b><br>Der Vorspann und das Regal stehen — '
          + 'was hineinkommt und woher, machen wir als Nächstes.',
      }));
    }

    return {
      destroy: function () {
        lebt = false;
        if (vorspann && vorspann.destroy) vorspann.destroy();
      },
    };
  };

  /* ------------------------------------------------------------------
     Der Vorspann
     ------------------------------------------------------------------ */

  function spielen(app, fertig) {
    var wrap = UI.el('div.flix-vorspann');
    var cv = UI.el('canvas.flix-leinwand');
    wrap.appendChild(cv);
    wrap.appendChild(UI.el('div.flix-tipp', { text: 'Tippen zum Überspringen' }));
    app.appendChild(wrap);

    var W = 900, H = 506;             // 16:9
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = W * dpr; cv.height = H * dpr;
    var c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);

    /* Maske: das G einmal vorzeichnen */
    var maske = document.createElement('canvas');
    maske.width = W; maske.height = H;
    var mc = maske.getContext('2d');
    mc.fillStyle = '#fff';
    mc.textAlign = 'center';
    mc.textBaseline = 'middle';
    mc.font = '900 ' + Math.round(H * 0.86) + 'px Georgia, "Times New Roman", serif';
    mc.fillText('G', W / 2, H * 0.52);

    /* Streifen: jeder hat eine eigene Startposition und Geschwindigkeit */
    var N = 42;
    var streifen = [];
    for (var i = 0; i < N; i++) {
      streifen.push({
        x: (i / N) * W,
        b: W / N + 0.6,
        ziel: 0,
        start: (Math.random() - 0.5) * H * 1.6,
        ton: 0.55 + Math.random() * 0.45,
        verzug: Math.random() * 0.22,
      });
    }

    var puffer = document.createElement('canvas');
    puffer.width = W; puffer.height = H;
    var pc = puffer.getContext('2d');

    var t0 = 0, raf = 0, vorbei = false;
    var DAUER = 3400;

    function bild(zeit) {
      if (!t0) t0 = zeit;
      var t = zeit - t0;
      zeichnen(t);
      if (t < DAUER && !vorbei) raf = requestAnimationFrame(bild);
      else ende();
    }

    function zeichnen(t) {
      c.fillStyle = '#000';
      c.fillRect(0, 0, W, H);

      /* 1. Blitz (0-260 ms) */
      if (t < 260) {
        var b = 1 - t / 260;
        c.fillStyle = 'rgba(255,255,255,' + (b * b * 0.85) + ')';
        c.fillRect(0, 0, W, H);
      }

      /* 2. Streifen fahren zusammen (200-1500 ms) */
      var p = U.clamp((t - 200) / 1300, 0, 1);

      /* Alles in den Zwischencanvas, damit die Maske greift. Er wird
         einmal angelegt und je Bild geleert - eine neue Leinwand pro
         Bild kostet auf dem iPad spuerbar. */
      pc.clearRect(0, 0, W, H);

      streifen.forEach(function (s) {
        var q = U.clamp((p - s.verzug) / (1 - s.verzug), 0, 1);
        var e = U.easeInOut(q);
        var mitte = H / 2 + s.start * (1 - e);
        var hoehe = H * (1.9 - 0.9 * e);
        /* Der Verlauf muss auf demselben Stueck liegen wie das Rechteck.
           Sass er daneben, klemmte Canvas die Farbe auf den letzten
           Haltepunkt - und der ist durchsichtig. */
        var g = pc.createLinearGradient(0, mitte - hoehe / 2, 0, mitte + hoehe / 2);
        var a = 0.2 + 0.8 * s.ton;
        var rot = Math.round(120 + 109 * s.ton);
        g.addColorStop(0, 'rgba(' + rot + ',9,20,0)');
        g.addColorStop(0.5, 'rgba(' + rot + ',9,20,' + a + ')');
        g.addColorStop(1, 'rgba(' + rot + ',9,20,0)');
        pc.fillStyle = g;
        pc.fillRect(s.x, mitte - hoehe / 2, s.b, hoehe);
      });

      /* 3. Ab der Haelfte durch die Buchstabenform beschneiden */
      if (p > 0.42) {
        var m = U.clamp((p - 0.42) / 0.4, 0, 1);
        pc.save();
        pc.globalAlpha = m;
        pc.globalCompositeOperation = 'destination-in';
        pc.drawImage(maske, 0, 0);
        pc.restore();
      }

      c.drawImage(puffer, 0, 0);

      /* 4. Der fertige Buchstabe (ab 1400 ms) */
      if (t > 1400) {
        var f = U.clamp((t - 1400) / 500, 0, 1);
        c.save();
        c.globalAlpha = f;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.font = '900 ' + Math.round(H * 0.86) + 'px Georgia, "Times New Roman", serif';
        var gg = c.createLinearGradient(0, H * 0.1, 0, H * 0.9);
        gg.addColorStop(0, ROT_HELL);
        gg.addColorStop(1, '#8b0009');
        c.fillStyle = gg;
        c.fillText('G', W / 2, H * 0.52);
        c.restore();
      }

      /* 5. Der Schriftzug (ab 2000 ms) */
      if (t > 2000) {
        var s2 = U.clamp((t - 2000) / 600, 0, 1);
        c.save();
        c.globalAlpha = U.easeOutCubic(s2);
        SG.gfx.text(c, 'GEHSTOCKFLIX', W / 2, H * 0.93, {
          size: 26, weight: 800, color: ROT, align: 'center', baseline: 'middle',
        });
        c.restore();
      }

      /* Etwas Korn, damit es nicht wie ein Rechteck aussieht */
      if (t > 260 && Math.random() < 0.5) {
        c.save();
        c.globalAlpha = 0.05;
        c.fillStyle = '#fff';
        c.fillRect(0, Math.random() * H, W, 1);
        c.restore();
      }
    }

    function ende() {
      if (vorbei) return;
      vorbei = true;
      if (raf) cancelAnimationFrame(raf);
      wrap.classList.add('weg');
      setTimeout(function () { UI.remove(wrap); fertig(); }, 300);
    }

    wrap.addEventListener('pointerdown', ende);
    raf = requestAnimationFrame(bild);
    setTimeout(ende, DAUER + 900);

    return { destroy: function () { vorbei = true; if (raf) cancelAnimationFrame(raf); } };
  }
})(SG);
