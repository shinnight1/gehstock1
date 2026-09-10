/* ------------------------------------------------------------------
   W-Places - die gemeinsame 2000 x 2000 Pixel-Fläche

   Eine riesige weiße Leinwand (2000x2000 Pixel), auf der alle gemeinsam
   zeichnen können — im Stil von r/place. Zweihundert Pixel am Tag gibt
   es geschenkt; wer mehr will, tauscht gesammelte Website-XP dagegen ein.

   Steuerung:
     - Ziehen verschiebt die Ansicht.
     - Zwei Finger oder Mausrad zoomen hinein und heraus.
     - Der Schalter „Malen" aktiviert das direkte Platzieren von Pixeln.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var G = SG.gfx;
  var UI = SG.ui;
  var W = SG.welt;
  var D = W.daten;
  var K = W.karte;
  var F = SG.fortschritt;

  var P = W.ui = {};

  /* ------------------------------------------------------------------
     Guthaben - hängt am Zugangscode
     ------------------------------------------------------------------ */

  var SCHLUESSEL = 'wplace:vorrat';

  /* Aus der verstrichenen Zeit so viele Pixel machen, wie in den Eimer
     passen. Gerechnet wird erst beim Nachsehen, nicht in einer Schleife -
     ein Vorrat, der nur beim Hinschauen stimmen muss, braucht keine Uhr,
     die im Hintergrund laeuft.

     'stand' ist der Zeitpunkt, ab dem die naechsten dreissig Sekunden
     laufen. Verbraucht wird nur die Zeit, die wirklich zu Pixeln
     geworden ist - der angefangene Rest bleibt stehen und verfaellt
     nicht. */
  function nachfuellen(v) {
    var jetzt = Date.now();
    if (!v.stand || v.stand > jetzt) v.stand = jetzt;   // Uhr zurueckgestellt
    if ((v.rest || 0) >= D.MAX_PIXEL) { v.stand = jetzt; return v; }

    var dazu = Math.floor((jetzt - v.stand) / D.NACHSCHUB_MS);
    if (dazu <= 0) return v;
    var vorher = v.rest || 0;
    v.rest = Math.min(D.MAX_PIXEL, vorher + dazu);
    v.stand += (v.rest - vorher) * D.NACHSCHUB_MS;
    if (v.rest >= D.MAX_PIXEL) v.stand = jetzt;
    SG.storage.set(SCHLUESSEL, v);
    return v;
  }

  P.vorrat = function () {
    var v = SG.storage.get(SCHLUESSEL, null);
    if (!v || typeof v !== 'object') {
      v = { rest: D.MAX_PIXEL, stand: Date.now(), gekauft: 0, gemalt: 0 };
      SG.storage.set(SCHLUESSEL, v);
    }
    if (v.tag !== undefined) {
      /* Stand aus der Zeit der Tagesration - einmal umstellen. Wer
         gestern 200 uebrig hatte, faengt heute mit einem vollen Eimer
         an, nicht mit einem uebervollen. */
      delete v.tag;
      v.rest = Math.min(v.rest || 0, D.MAX_PIXEL);
      v.stand = Date.now();
      SG.storage.set(SCHLUESSEL, v);
    }
    return nachfuellen(v);
  };

  /* Millisekunden bis zum naechsten Pixel. Null heisst: der Eimer ist
     voll, es laeuft nichts mehr nach. */
  P.bisNaechstem = function () {
    var v = P.vorrat();
    if ((v.rest || 0) >= D.MAX_PIXEL) return 0;
    return Math.max(0, D.NACHSCHUB_MS - (Date.now() - v.stand));
  };

  P.uebrig = function () {
    var v = P.vorrat();
    return (v.rest || 0) + (v.gekauft || 0);
  };

  /* Zieht ein Feld ab - erst die Tagesration, dann Gekauftes */
  P.abziehen = function (n) {
    var v = P.vorrat();
    var offen = n;
    var ausRation = Math.min(v.rest || 0, offen);
    v.rest -= ausRation;
    offen -= ausRation;
    var ausKauf = Math.min(v.gekauft || 0, offen);
    v.gekauft -= ausKauf;
    offen -= ausKauf;
    v.gemalt = (v.gemalt || 0) + (n - offen);
    SG.storage.set(SCHLUESSEL, v);
    return offen === 0;
  };

  P.gutschreiben = function (n) {
    var v = P.vorrat();
    v.gekauft = (v.gekauft || 0) + n;
    SG.storage.set(SCHLUESSEL, v);
  };

  /* ------------------------------------------------------------------
     Bildschirm
     ------------------------------------------------------------------ */

  function mount(host) {
    var st = {
      pixel: {},              // Feldnummer -> Farbe (1..32, 0=Weiß)
      version: 0,
      farbe: 8,               // gewählte Farbe (Standard: Rot)
      malen: false,           // Schalter: tippen malt statt zu verschieben
      zoom: 1.2,
      mx: D.BREITE / 2,       // Mittelpunkt in Pixelkoordinaten (1000)
      my: D.HOEHE / 2,        // Mittelpunkt (1000)
      warteschlange: [],      // noch nicht abgeschickte Striche
      schicktGerade: false,
      letzterOrt: '',
      t: 0,
      verbunden: false,
      abmelden: null,
    };

    var root = UI.el('div.tyc.wp');
    host.stage.appendChild(root);
    host.stage.style.touchAction = 'none';

    var top = UI.el('div.tyc-top');
    var res = UI.el('div.tyc-res');
    top.appendChild(res);

    var main = UI.el('div.tyc-main');
    var dock = UI.el('div.wp-dock');
    root.appendChild(top);
    root.appendChild(main);
    root.appendChild(dock);

    var stage = SG.canvas.create(main, { alpha: false });
    var ctx = stage.ctx;

    var fuss = UI.el('div.wp-fuss');
    main.appendChild(fuss);

    /* ---------------------------------------------------------- Kopf */

    function resItem(cls, icon, key) {
      var v = UI.el('div.v', { text: '—' });
      var el = UI.el('div.res' + (cls ? '.' + cls : ''), null, [
        UI.el('div.ic', { text: icon }),
        UI.el('div.tx', null, [UI.el('div.k', { text: key }), v]),
      ]);
      el.set = function (t) { if (v.textContent !== t) v.textContent = t; };
      el.tint = function (c) { v.style.color = c || ''; };
      return el;
    }

    var rVorrat = resItem('money', '🎨', 'Pixel übrig');
    var rHeute = resItem('', '⏳', 'Nachschub');
    var rXP = resItem('', '⭐', 'XP-Guthaben');
    var rGesamt = resItem('', '🖌', 'Bemalt');
    var rLeute = resItem('', '🛰', 'Verbindung');
    [rVorrat, rHeute, rXP, rGesamt, rLeute].forEach(function (e) { res.appendChild(e); });

    /* ---------------------------------------------------------- Leiste */

    var palette = UI.el('div.wp-palette');
    D.PALETTE.forEach(function (f) {
      var b = UI.el('button.wp-farbe' + (f.id === 0 ? '.radier' : ''), {
        title: f.name,
        'aria-label': f.name,
        on: {
          click: function () {
            st.farbe = f.id;
            syncPalette();
            host.sfx('click');
          },
        },
      });
      b.style.background = f.hex;
      b.dataset.id = String(f.id);
      palette.appendChild(b);
    });
    dock.appendChild(palette);

    function syncPalette() {
      for (var i = 0; i < palette.children.length; i++) {
        var b = palette.children[i];
        b.classList.toggle('on', Number(b.dataset.id) === st.farbe);
      }
    }
    syncPalette();

    var werkzeuge = UI.el('div.wp-werkzeuge');
    var bMalen = UI.el('button.btn.sm', {
      html: '<span class="ico">✏</span><span class="lbl">Malen</span>',
      on: {
        click: function () {
          st.malen = !st.malen;
          bMalen.classList.toggle('primary', st.malen);
          host.sfx('click');
          hinweis(st.malen
            ? 'Malen an — jeder Klick oder Wisch setzt ein Pixel.'
            : 'Malen aus — die Fläche lässt sich frei verschieben.');
        },
      },
    });
    werkzeuge.appendChild(bMalen);
    werkzeuge.appendChild(UI.btn('＋', function () { zoomen(1.6); }, 'sm ghost'));
    werkzeuge.appendChild(UI.btn('－', function () { zoomen(1 / 1.6); }, 'sm ghost'));
    werkzeuge.appendChild(UI.btn('🏠', function () {
      st.zoom = 1.1;
      st.mx = D.BREITE / 2;
      st.my = D.HOEHE / 2;
      begrenzen();
      host.sfx('click');
    }, 'sm ghost'));
    werkzeuge.appendChild(UI.btn('🔎 Zu Koordinate', function () { openOrte(); }, 'sm ghost'));
    werkzeuge.appendChild(UI.btn('⭐ Pixel kaufen', function () { openKaufen(); }, 'sm'));
    dock.appendChild(werkzeuge);

    host.tool('📖 Anleitung', function () { zeigeAnleitung(); });

    /* ---------------------------------------------------------- Leinwand-Geometrie */

    function sicht() {
      /* Wie viele Bildschirmpixel ein Canvas-Pixel groß ist */
      var grund = Math.min(stage.w / D.BREITE, stage.h / D.HOEHE);
      return Math.max(0.001, grund * st.zoom);
    }

    function begrenzen() {
      var f = sicht();
      var halbB = stage.w / 2 / f;
      var halbH = stage.h / 2 / f;
      if (D.BREITE <= halbB * 2) st.mx = D.BREITE / 2;
      else st.mx = U.clamp(st.mx, halbB, D.BREITE - halbB);
      if (D.HOEHE <= halbH * 2) st.my = D.HOEHE / 2;
      else st.my = U.clamp(st.my, halbH, D.HOEHE - halbH);
    }

    function zoomen(faktor, zx, zy) {
      var vorher = sicht();
      var altMx = st.mx, altMy = st.my;
      st.zoom = U.clamp(st.zoom * faktor, 0.8, 120);
      if (zx !== undefined && zy !== undefined) {
        /* Zoom auf den Finger / Mauszeiger ausrichten */
        var kx = altMx + (zx - stage.w / 2) / vorher;
        var ky = altMy + (zy - stage.h / 2) / vorher;
        var nachher = sicht();
        st.mx = kx - (zx - stage.w / 2) / nachher;
        st.my = ky - (zy - stage.h / 2) / nachher;
      }
      begrenzen();
      host.sfx('tick');
    }

    function zuKarte(px, py) {
      var f = sicht();
      return {
        x: Math.floor(st.mx + (px - stage.w / 2) / f),
        y: Math.floor(st.my + (py - stage.h / 2) / f),
      };
    }

    /* ---------------------------------------------------------- Malen */

    function setzen(kx, ky) {
      if (kx < 0 || kx >= D.BREITE || ky < 0 || ky >= D.HOEHE) return;
      var n = D.nummer(kx, ky);
      var alt = st.pixel[n];
      var neu = st.farbe;

      if ((neu === 0 || neu === 5) && alt === undefined) return;   // Weiß im Leeren
      if (alt === neu) return;                                      // bereits so

      if (!P.abziehen(1)) {
        host.sfx('error');
        hinweis('Keine Pixel mehr übrig. Alle ' + (D.NACHSCHUB_MS / 1000)
          + ' Sekunden kommt einer nach — oder du tauschst XP ein.');
        return;
      }

      /* Sofort lokal anzeigen, im Hintergrund über das Relais synchronisieren */
      if (neu === 0) delete st.pixel[n];
      else st.pixel[n] = neu;

      st.warteschlange.push({ n: n, c: neu });
      host.sfx('blip');
      host.buzz(5);
      syncBar();
      abschicken();
    }

    function abschicken() {
      if (st.schicktGerade || !st.warteschlange.length) return;
      if (!SG.relais.verfuegbar()) { st.warteschlange.length = 0; return; }
      st.schicktGerade = true;
      var stapel = st.warteschlange.splice(0, 200);
      SG.relais.pixSetzen(stapel).then(function () {
        st.schicktGerade = false;
        abschicken();
      }, function () {
        st.schicktGerade = false;
        st.warteschlange = stapel.concat(st.warteschlange);
        host.after(abschicken, 2500);
      });
    }

    /* ---------------------------------------------------------- Eingabe */

    var zieht = false, gezogen = false, startX = 0, startY = 0;
    var startMx = 0, startMy = 0, malStrich = false, letztesFeld = -1;

    host.inputOn(stage.el, {
      onDown: function (p) {
        zieht = true;
        gezogen = false;
        startX = p.x; startY = p.y;
        startMx = st.mx; startMy = st.my;
        malStrich = st.malen;
        letztesFeld = -1;
        if (malStrich) {
          var k = zuKarte(p.x, p.y);
          setzen(k.x, k.y);
          letztesFeld = D.nummer(k.x, k.y);
        }
      },
      onMove: function (p) {
        var k = zuKarte(p.x, p.y);
        var ort = ortText(k.x, k.y);
        if (ort !== st.letzterOrt) { st.letzterOrt = ort; fussSetzen(ort); }

        if (!zieht) return;
        if (malStrich) {
          var n = D.nummer(k.x, k.y);
          if (n !== letztesFeld) { setzen(k.x, k.y); letztesFeld = n; }
          return;
        }
        var dx = p.x - startX, dy = p.y - startY;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) gezogen = true;
        var f = sicht();
        st.mx = startMx - dx / f;
        st.my = startMy - dy / f;
        begrenzen();
      },
      onUp: function () { zieht = false; },
      onTap: function (px, py) {
        if (gezogen || malStrich) return;
        var k = zuKarte(px, py);
        zeigeFeld(k.x, k.y);
      },
      onPinch: function (z) {
        zieht = false;
        zoomen(z.dScale, z.cx, z.cy);
      },
      onWheel: function (deltaY, cx, cy) {
        var faktor = deltaY < 0 ? 1.25 : 1 / 1.25;
        zoomen(faktor, cx, cy);
      },
    });

    function ortText(kx, ky) {
      if (kx < 0 || kx >= D.BREITE || ky < 0 || ky >= D.HOEHE) return '';
      return 'X: ' + kx + '  Y: ' + ky;
    }

    function fussSetzen(text) {
      UI.clear(fuss);
      fuss.appendChild(UI.el('span', { text: text || '' }));
    }

    function hinweis(text) {
      UI.toast(text, 'info', 2600);
    }

    function zeigeFeld(kx, ky) {
      if (kx < 0 || kx >= D.BREITE || ky < 0 || ky >= D.HOEHE) return;
      var n = D.nummer(kx, ky);
      var farbe = D.farbe(st.pixel[n] || 0);
      UI.toast('X: ' + kx + ' · Y: ' + ky
        + (st.pixel[n] ? ' · ' + farbe.name : ' · Weiß (unbemalt)'), null, 2200);
    }

    /* ---------------------------------------------------------- Kaufen */

    function openKaufen() {
      var body = UI.el('div');
      var stand = F.stand();

      body.appendChild(UI.el('p.small.muted', {
        text: 'Erfahrung sammelst du überall im Hideout — mit jedem Spiel, Rekord '
          + 'und Erfolg. Hier kannst du sie in Pixel umtauschen. '
          + 'Deine Stufe und dein Rang bleiben dabei vollständig erhalten.',
      }));
      body.appendChild(UI.kv([
        ['XP-Guthaben', U.num(stand.guthaben)],
        ['Stufe', String(stand.stufe) + ' · ' + stand.rang.name],
        ['Pixel übrig', U.num(P.uebrig())],
      ]));

      D.PAKETE.forEach(function (paket) {
        var machbar = F.guthaben() >= paket.xp;
        body.appendChild(UI.el('div.item', null, [
          UI.el('div.thumb', { text: '🎨' }),
          UI.el('div.main', null, [
            UI.el('div.t', { text: paket.name }),
            UI.el('div.d', {
              html: U.num(paket.pixel) + ' Pixel für <b>' + U.num(paket.xp)
                + ' XP</b> · ' + U.num(paket.xp / paket.pixel, 2) + ' XP je Pixel',
            }),
          ]),
          UI.el('div.side', null, [
            UI.btn('Eintauschen', function () {
              if (!F.ausgeben(paket.xp, paket.pixel + ' Pixel')) {
                host.sfx('error');
                UI.toast('Dafür reicht das XP-Guthaben nicht.', 'bad');
                return;
              }
              P.gutschreiben(paket.pixel);
              host.sfx('cash');
              UI.toast(U.num(paket.pixel) + ' Pixel gutgeschrieben.', 'good');
              syncBar();
              m.close();
            }, 'sm' + (machbar ? ' primary' : ' ghost')),
          ]),
        ]));
      });

      var m = host.modal({ title: 'Pixel kaufen', body: body });
    }

    /* ---------------------------------------------------------- Orte / Navigation */

    function openOrte() {
      var body = UI.el('div');
      body.appendChild(UI.el('p.small.muted', {
        text: 'Springe zu einem Bereich auf der 2000×2000 Fläche.',
      }));

      D.ORTE.forEach(function (o) {
        body.appendChild(UI.el('div.item', null, [
          UI.el('div.thumb', { text: '📍' }),
          UI.el('div.main', null, [
            UI.el('div.t', { text: o.name }),
            UI.el('div.d', { text: 'X: ' + o.x + '  Y: ' + o.y }),
          ]),
          UI.el('div.side', null, [
            UI.btn('Hin', function () {
              st.mx = o.x;
              st.my = o.y;
              st.zoom = Math.max(st.zoom, 10);
              begrenzen();
              host.sfx('whoosh');
              m.close();
            }, 'sm primary'),
          ]),
        ]));
      });

      var m = host.modal({ title: 'Wohin springen?', body: body });
    }

    /* ---------------------------------------------------------- Anleitung */

    function zeigeAnleitung() {
      var body = UI.el('div');
      [
        ['⬜', '2000 × 2000 weiße Leinwand', 'Eine riesige, gemeinsame Fläche für alle — '
          + 'was du malst, sehen alle im Hideout in Echtzeit.'],
        ['✏', 'Malen', 'Aktiviere den Schalter „Malen", um Pixel zu setzen. '
          + 'Ohne Malmodus verschiebt ein Wisch nur die Ansicht.'],
        ['🎨', 'Fünfzig Pixel im Vorrat', 'Mehr als ' + D.MAX_PIXEL + ' passen nicht hinein. '
          + 'Alle ' + (D.NACHSCHUB_MS / 1000) + ' Sekunden kommt einer nach — ein leerer '
          + 'Vorrat ist nach ' + Math.round(D.MAX_PIXEL * D.NACHSCHUB_MS / 60000)
          + ' Minuten wieder voll.'],
        ['⭐', 'Mehr Pixel mit XP', 'Tausche Erfahrung aus beliebigen Spielen gegen Pixel ein. '
          + 'Deine Stufe und dein Rang bleiben dabei erhalten.'],
        ['🧽', 'Radieren', 'Die erste Farbe in der Palette radiert das Pixel wieder auf Weiß zurück.'],
      ].forEach(function (z) {
        body.appendChild(UI.el('div.item', null, [
          UI.el('div.thumb', { text: z[0] }),
          UI.el('div.main', null, [
            UI.el('div.t', { text: z[1] }),
            UI.el('div.d', { text: z[2] }),
          ]),
        ]));
      });
      host.modal({
        title: 'W-Places', body: body,
        actions: [{ label: 'Los geht’s', cls: 'primary' }],
      });
    }

    /* ---------------------------------------------------------- Relais */

    function kartenStand(res) {
      if (!res) return;
      if (res.teil && res.striche) {
        for (var i = 0; i < res.striche.length; i++) {
          var p = res.striche[i];
          if (p.c === 0) delete st.pixel[p.n];
          else st.pixel[p.n] = p.c;
        }
      } else if (res.pixel) {
        st.pixel = {};
        for (var n in res.pixel) st.pixel[Number(n)] = res.pixel[n];
      }
      if (typeof res.version === 'number') st.version = res.version;
      st.verbunden = true;
      syncBar();
    }

    if (SG.relais.verfuegbar()) {
      st.abmelden = SG.relais.pixBeobachten(kartenStand);
      SG.relais.starten();
      host.onDestroy(function () { if (st.abmelden) st.abmelden(); });
    }

    /* ---------------------------------------------------------- Kopf */

    function syncBar() {
      var v = P.vorrat();
      rVorrat.set(U.num(P.uebrig()));
      rVorrat.tint(P.uebrig() === 0 ? 'var(--red)' : '');
      var bis = P.bisNaechstem();
      rHeute.set(bis
        ? (v.rest || 0) + ' / ' + D.MAX_PIXEL + ' · in ' + Math.ceil(bis / 1000) + ' s'
        : 'voll · ' + D.MAX_PIXEL + ' / ' + D.MAX_PIXEL);
      rXP.set(U.num(F.guthaben()));
      rGesamt.set(U.short(Object.keys(st.pixel).length));
      if (!SG.relais.verfuegbar()) {
        rLeute.set('offline');
        rLeute.tint('var(--red)');
      } else {
        rLeute.set(st.verbunden ? 'verbunden' : 'verbinde…');
        rLeute.tint(st.verbunden ? 'var(--green)' : '');
      }
    }

    /* ---------------------------------------------------------- Zeichnen */

    function draw() {
      var f = sicht();
      var c = ctx;

      /* Dunkler Hintergrund der Arbeitsfläche */
      c.fillStyle = '#0a0e17';
      c.fillRect(0, 0, stage.w, stage.h);

      /* Bildschirmposition des 2000x2000 Zeichenblatts */
      var screenX = (0 - st.mx) * f + stage.w / 2;
      var screenY = (0 - st.my) * f + stage.h / 2;
      var screenW = D.BREITE * f;
      var screenH = D.HOEHE * f;

      /* Weißes Zeichenblatt */
      var destX = Math.max(0, screenX);
      var destY = Math.max(0, screenY);
      var destRight = Math.min(stage.w, screenX + screenW);
      var destBottom = Math.min(stage.h, screenY + screenH);
      var destW = destRight - destX;
      var destH = destBottom - destY;

      if (destW > 0 && destH > 0) {
        c.fillStyle = '#ffffff';
        c.fillRect(destX, destY, destW, destH);
      }

      /* Dezenter Rahmen um das gesamte Zeichenblatt */
      c.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      c.lineWidth = 1;
      c.strokeRect(screenX, screenY, screenW, screenH);

      /* Ausschnitt in Leinwand-Pixelkoordinaten */
      var x0 = st.mx - stage.w / 2 / f;
      var y0 = st.my - stage.h / 2 / f;

      var vonX = Math.max(0, Math.floor(x0));
      var vonY = Math.max(0, Math.floor(y0));
      var bisX = Math.min(D.BREITE - 1, Math.ceil(x0 + stage.w / f));
      var bisY = Math.min(D.HOEHE - 1, Math.ceil(y0 + stage.h / f));
      var sichtbar = (bisX - vonX + 1) * (bisY - vonY + 1);

      /* Bemalte Pixel rendern */
      if (sichtbar <= 40000) {
        for (var ky = vonY; ky <= bisY; ky++) {
          for (var kx = vonX; kx <= bisX; kx++) {
            var farbe = st.pixel[ky * D.BREITE + kx];
            if (!farbe) continue;
            var def = D.farbe(farbe);
            if (!def || !def.hex) continue;
            c.fillStyle = def.hex;
            c.fillRect(Math.floor((kx - x0) * f), Math.floor((ky - y0) * f),
              Math.ceil(f), Math.ceil(f));
          }
        }
      } else {
        /* Weit herausgezoomt: über die Liste der gesetzten Pixel iterieren */
        for (var n in st.pixel) {
          var nn = Number(n);
          var px = nn % D.BREITE, py = (nn / D.BREITE) | 0;
          if (px < vonX || px > bisX || py < vonY || py > bisY) continue;
          var d2 = D.farbe(st.pixel[n]);
          if (!d2 || !d2.hex) continue;
          c.fillStyle = d2.hex;
          c.fillRect(Math.floor((px - x0) * f), Math.floor((py - y0) * f),
            Math.max(1, Math.ceil(f)), Math.max(1, Math.ceil(f)));
        }
      }

      /* Pixelgitter einblenden, wenn tief genug hereingezoomt */
      if (f >= 7) {
        c.strokeStyle = 'rgba(0, 0, 0, 0.09)';
        c.lineWidth = 1;
        c.beginPath();
        for (kx = vonX; kx <= bisX + 1; kx++) {
          var sx = Math.floor((kx - x0) * f) + 0.5;
          var yStart = Math.max(0, Math.floor((vonY - y0) * f));
          var yEnd = Math.min(stage.h, Math.floor((bisY + 1 - y0) * f));
          c.moveTo(sx, yStart); c.lineTo(sx, yEnd);
        }
        for (ky = vonY; ky <= bisY + 1; ky++) {
          var sy = Math.floor((ky - y0) * f) + 0.5;
          var xStart = Math.max(0, Math.floor((vonX - x0) * f));
          var xEnd = Math.min(stage.w, Math.floor((bisX + 1 - x0) * f));
          c.moveTo(xStart, sy); c.lineTo(xEnd, sy);
        }
        c.stroke();
      }

      /* Goldener Rahmen im Malmodus */
      if (st.malen) {
        c.strokeStyle = 'rgba(240, 180, 41, .75)';
        c.lineWidth = 3;
        c.strokeRect(1, 1, stage.w - 2, stage.h - 2);
      }
    }

    var loop = host.loop({
      update: function (dt) { st.t += dt; },
      render: function () { draw(); },
    });

    /* ---------------------------------------------------------- Start */

    stage.onResize = function () {
      begrenzen();
      draw();
    };
    stage.resize();

    st.mx = D.BREITE / 2;
    st.my = D.HOEHE / 2;
    st.zoom = 1.1;
    begrenzen();
    syncBar();

    /* Der Vorrat rechnet sich beim Nachsehen aus, aber die Zahl soll
       auch von selbst weiterlaufen, waehrend jemand zuschaut. Einmal
       je Sekunde genuegt dafuer. */
    var uhr = setInterval(syncBar, 1000);
    host.onDestroy(function () { clearInterval(uhr); });
    fussSetzen('Ziehen verschiebt · zwei Finger oder Mausrad zoomen · „Malen" setzt Pixel');
    draw();

    if (!SG.relais.verfuegbar()) {
      host.after(function () {
        UI.toast(SG.offline
          ? 'W-Places lebt vom gemeinsamen Zeichnen — in der Offline-Datei ist es nur lokal.'
          : 'Auf dieser Seite läuft kein Relais. Es lässt sich malen, aber andere sehen es nicht.',
          'bad', 6000);
      }, 600);
    }

    var ersterBesuch = !SG.storage.get('wplace:gesehen', false);
    if (ersterBesuch) {
      SG.storage.set('wplace:gesehen', true);
      host.after(zeigeAnleitung, 400);
    }

    return {
      state: function () { return st; },

      selftest: function () {
        /* Garantiert genügend Test-Pixel für den Selbsttest */
        P.gutschreiben(10);
        var vorher = P.uebrig();
        st.farbe = 8;
        setzen(100, 100);
        setzen(101, 100);
        setzen(100, 100);              // dieselbe Farbe kostet nichts
        if (Object.keys(st.pixel).length < 2) throw new Error('Es wurde nichts gesetzt');
        if (P.uebrig() !== vorher - 2) {
          throw new Error('Der Vorrat stimmt nicht: ' + P.uebrig() + ' statt ' + (vorher - 2));
        }
        st.farbe = 0;
        setzen(100, 100);              // radieren
        if (st.pixel[D.nummer(100, 100)] !== undefined) {
          throw new Error('Radieren hat nicht gewirkt');
        }

        /* Umrechnung prüfen */
        var num = D.nummer(500, 500);
        if (D.zuX(num) !== 500 || D.zuY(num) !== 500) {
          throw new Error('Pixel-Nummerierung fehlerhaft');
        }

        for (var z = 0; z < 4; z++) { zoomen(1.6); draw(); }
        for (z = 0; z < 5; z++) { zoomen(1 / 1.6); draw(); }
        st.warteschlange.length = 0;
      },
    };
  }

  /* ---------------------------------------------------------- Erfolge */

  SG.fortschritt.anhaengen([
    SG.fortschritt.E('wp_erster', '🎨', 'Erster Strich',
      'Setze dein erstes Pixel auf der gemeinsamen Fläche.', 30,
      function () { return (SG.storage.get('wplace:vorrat', {}) || {}).gemalt >= 1; },
      { spiel: 'wplace' }),
    SG.fortschritt.E('wp_hundert', '🖌', 'Hundert Pixel',
      'Male insgesamt 100 Pixel.', 80,
      function () { return (SG.storage.get('wplace:vorrat', {}) || {}).gemalt >= 100; },
      { spiel: 'wplace' }),
    SG.fortschritt.E('wp_tausend', '🗺', 'Tausend Pixel',
      'Male insgesamt 1.000 Pixel.', 240,
      function () { return (SG.storage.get('wplace:vorrat', {}) || {}).gemalt >= 1000; },
      { spiel: 'wplace' }),
  ]);

  /* ---------------------------------------------------------- Anmeldung */

  SG.register({
    id: 'wplace',
    name: 'W-Places',
    category: 'gemeinsam',
    desc: 'Gemeinsame 2000×2000 Pixel-Fläche — alle malen auf demselben Canvas',
    tags: ['pixel', 'malen', 'gemeinsam', 'leinwand', 'wplace', 'place', 'canvas'],
    online: true,
    heavy: false,
    credit: { icon: '💡', text: 'Idee von GenieKadaver' },
    preview: function (c, w, h) {
      c.fillStyle = '#0a0e17';
      c.fillRect(0, 0, w, h);

      /* Weißes Blatt in der Mitte der Vorschaukachel */
      var rand = Math.round(w * 0.12);
      var bw = w - rand * 2, bh = h - rand * 2;
      c.fillStyle = '#ffffff';
      c.fillRect(rand, rand, bw, bh);
      c.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      c.strokeRect(rand, rand, bw, bh);

      /* Bunte Pixel-Muster */
      var rng = U.rng(1337);
      var farben = ['#ed1c24', '#f9dd3b', '#4093e4', '#13e67b', '#cb007a', '#ff7f27', '#000000'];
      var k = Math.max(3, Math.round(w / 30));
      for (var i = 0; i < 45; i++) {
        c.fillStyle = farben[Math.floor(rng() * farben.length)];
        c.fillRect(rand + Math.floor(rng() * (bw - k)), rand + Math.floor(rng() * (bh - k)), k, k);
      }
    },
    mount: mount,
  });
})(SG);
