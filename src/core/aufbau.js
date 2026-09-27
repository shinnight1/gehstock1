/* ------------------------------------------------------------------
   Die Aufbau-Animation.

   Nach dem Anmelden baut sich der Hub im Licht auf: Aus dem Schwarz
   waechst ein kupferner Lichtstrich, flammt auf und faellt wieder
   zusammen. Beim grossen Schlag im Soundtrack steht die ganze Seite als
   gluehender Bauplan da, die Teile rasten im Takt ein, und aus dem
   Bauplan wird die echte Seite.

   Der Bauplan ist die echte Seite: Jedes Element des Hubs (Leiste, Suche,
   Chips, Kacheln, Schrift) wird vermessen und als Umriss gezeichnet. Darum
   liegt der Bauplan am Ende genau auf der Seite, die darunter auftaucht.
   Jedes Teil wird einmal vorgezeichnet; danach werden pro Bild nur noch
   diese kleinen Bilder verschoben - das haelt auch ein Schul-iPad aus.

   Die Uhr ist der Ton: Laeuft er, zaehlt seine Zeit, sonst die des
   Browsers. So bleiben Bild und Schlag auch bei Rucklern beieinander.
   Die Zeitmarken stammen aus der Tonspur (src/assets/ui-aufbau-ton.mp3):
     0 - 6,5 s    leises Anschwellen    Punkt, dann waechst der Strich
     6,6 - 7,3 s  heller Riser          Aufflammen, Streifen, Vorschau
     7,5 - 8,2 s  Atempause             zurueck zum duennen Strich
     8,5 s        der Schlag            der ganze Bauplan steht
     ab 8,5 s     Puls                  Teile rasten im Halbtakt ein
     11,5 s       Ausklang              die echte Seite taucht auf
   ------------------------------------------------------------------ */

(function (SG) {
  var UI = SG.ui;

  var A = SG.aufbau = {};

  /* Ein neuer Schluessel zeigt die Animation allen noch einmal. */
  var SCHLUESSEL = 'neu:aufbau-2026-09';

  var T = { punkt: 0.3, riser: 6.55, gipfel: 7.3, pause: 7.6, schlag: 8.5, fest: 11.5, ende: 12.4 };

  /* Kupfer in drei Stufen, dazu das kuehle Licht der Geisterlinse */
  var K = {
    kern: '255,248,225',
    hell: '255,218,168',
    kupfer: '255,174,106',
    tief: '188,104,52',
    kuehl: '160,184,255',
  };

  /* Was vom Hub zum Bauplan wird: Selektor, Art und Rang. Rang 1 sind die
     Hauptbauteile, die hell strahlen; alles andere bleibt zurueckhaltend -
     erst diese Rangfolge macht aus Neonkonturen einen Bauplan mit Tiefe. */
  var TEILE = [
    ['.topbar', 'kasten', 0],
    ['.brand-mark', 'kasten', 1],
    ['.topbar .btn', 'kasten', 0],
    ['.brand-title', 'text', 0],
    ['.brand-sub', 'text', 0],
    ['.flix-knopf', 'kasten', 1],
    ['.search', 'kasten', 0],
    ['.chip', 'kasten', 0],
    ['.sec-head h2', 'text', 0],
    ['.sec-head .count', 'text', 0],
    ['.tile', 'kasten', 1],
    ['.tile canvas', 'platine', 0],
    ['.tile-name', 'text', 0],
    ['.tile-meta', 'text', 0],
  ];

  var RAND = 24;          // Platz fuer den eingebackenen Lichthof um jedes Teil
  var laeuft = null;

  /* ============================================================ Helfer */

  function klemme(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function glatt(x) { x = klemme(x, 0, 1); return x * x * (3 - 2 * x); }
  function aus(x) { x = klemme(x, 0, 1); return 1 - Math.pow(1 - x, 3); }
  /* schiesst ein Stueck ueber das Ziel und rastet dann ein */
  function rast(x) { x = klemme(x, 0, 1); var c = 1.6; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); }
  function zufall(s) {
    s = (s % 2147483646) + 1;
    return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  }
  function rgba(f, a) { return 'rgba(' + f + ',' + klemme(a, 0, 1).toFixed(3) + ')'; }

  function pfad(c, x, y, w, h, r) {
    r = klemme(r, 0, Math.min(w, h) / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  /* ============================================================ Bauplan */

  function vermessen(W, H) {
    var app = document.getElementById('app');
    var teile = [];
    if (!app) return teile;
    TEILE.forEach(function (d) {
      var liste = app.querySelectorAll(d[0]);
      for (var i = 0; i < liste.length && teile.length < 220; i++) {
        var el = liste[i], r = null;
        if (d[1] === 'text') {
          /* Die Laenge des Textes, aber nie ueber seinen Kasten hinaus -
             abgeschnittener Text ("...") ragte sonst aus der Kachel. */
          var kasten = el.getBoundingClientRect();
          try {
            var bereich = document.createRange();
            bereich.selectNodeContents(el);
            r = bereich.getBoundingClientRect();
          } catch (e) { r = null; }
          if (!r || r.width < 2) {
            r = kasten;
          } else {
            var li = Math.max(r.left, kasten.left), re = Math.min(r.right, kasten.right);
            var ob = Math.max(r.top, kasten.top), un = Math.min(r.bottom, kasten.bottom);
            r = { left: li, top: ob, right: re, bottom: un, width: re - li, height: un - ob };
          }
        } else {
          r = el.getBoundingClientRect();
        }
        if (r.width < 4 || r.height < 2) continue;
        if (r.bottom < 0 || r.top > H || r.right < 0 || r.left > W) continue;
        var radius = 0;
        if (d[1] !== 'text') {
          try { radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0; } catch (e) { /* egal */ }
        }
        teile.push({
          art: d[1], rang: d[2], x: r.left, y: r.top, w: r.width, h: r.height, r: radius,
          samen: (teile.length + 1) * 7919 + 13,
        });
      }
    });
    return teile;
  }

  /* Wann jedes Teil einrastet: im Halbtakt nach dem Schlag, von der
     Lichtlinie nach aussen, innerhalb einer Stufe von links nach rechts. */
  function takten(teile, W, H) {
    var mitte = H / 2;
    teile.forEach(function (p) {
      var cy = p.y + p.h / 2, cx = p.x + p.w / 2;
      var abstand = Math.abs(cy - mitte) / (H / 2);
      var stufe = Math.min(5, Math.floor(abstand * 6));
      p.einrasten = T.schlag + 0.5 * stufe + (cx / W) * 0.12;
      p.richtung = cy < mitte ? 1 : -1;     // erst zur Linie hin gestaucht
      p.gewicht = 0.5 + 0.5 * Math.exp(-Math.pow((cy - mitte) / (H * 0.3), 2));
      p.vorschau = Math.exp(-Math.pow((cy - mitte) / (H * 0.16), 2));
    });
  }

  /* Umriss wie im Video: ein weicher Lichthof (einmal mit shadowBlur
     eingebacken - ctx.filter kennt Safari auf aelteren iPads nicht), darauf
     ein kupferner Saum und ein cremig-heller Kern, knapp innen eine zweite
     Linie und warmes Glas in der Flaeche. */
  function umriss(c, x, y, w, h, r, dpr, rang) {
    var haupt = rang === 1;
    /* Flaechenlicht gibt den Hauptbauteilen Koerper - mehr weisse Linien
       wuerden nur den Neon-Eindruck verstaerken */
    var g = c.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, rgba(K.kupfer, haupt ? 0.32 : 0.16));
    g.addColorStop(0.5, rgba(K.tief, 0.04));
    g.addColorStop(1, rgba(K.kupfer, haupt ? 0.14 : 0.08));
    pfad(c, x, y, w, h, r);
    c.fillStyle = g;
    c.fill();
    c.save();
    c.shadowColor = rgba(K.kupfer, haupt ? 0.85 : 0.55);
    c.shadowBlur = 12 * dpr;
    pfad(c, x, y, w, h, r);
    c.lineWidth = 3; c.strokeStyle = rgba(K.kupfer, haupt ? 0.4 : 0.26); c.stroke();
    c.restore();
    pfad(c, x, y, w, h, r);
    c.lineWidth = 1.4; c.strokeStyle = rgba(K.kern, haupt ? 0.95 : 0.55); c.stroke();
    if (w > 16 && h > 16) {
      pfad(c, x + 2, y + 2, w - 4, h - 4, Math.max(0, r - 2));
      c.lineWidth = 1; c.strokeStyle = rgba(K.kupfer, haupt ? 0.38 : 0.22); c.stroke();
    }
  }

  /* Schrift wird zu Leiterbahnen: Balken in der Laenge des Textes, in
     ein bis vier Stuecke geteilt. */
  function schrift(c, x, y, w, h, samen, dpr) {
    var z = zufall(samen);
    var bh = klemme(h * 0.38, 2, 7);
    var by = y + (h - bh) / 2;
    var stuecke = w > 120 ? 3 + Math.floor(z() * 2) : w > 50 ? 2 : 1;
    var luecke = 5, px = x;
    for (var i = 0; i < stuecke && px < x + w - 3; i++) {
      var rest = x + w - px;
      var bw = i === stuecke - 1 ? rest : Math.min(rest, (w / stuecke) * (0.7 + z() * 0.5));
      c.save();
      c.shadowColor = rgba(K.kupfer, 0.7);
      c.shadowBlur = 6 * dpr;
      pfad(c, px, by, bw, bh, bh / 2);
      c.fillStyle = rgba(K.kupfer, 0.2); c.fill();
      c.restore();
      pfad(c, px, by, bw, bh, bh / 2);
      c.lineWidth = 1; c.strokeStyle = rgba(K.kern, 0.6); c.stroke();
      px += bw + luecke;
    }
  }

  /* Die Kachelvorschau wird zur Platine: Leitbahnen, ein Chip mit
     Streifen und zwei Anschlussringe. */
  function platine(c, x, y, w, h, samen, dpr) {
    var z = zufall(samen);
    /* Nebenleitungen fein und leise, Hauptbauteile kraeftig - erst diese
       Rangfolge gibt dem Bauplan Tiefe */
    function linie(x1, y1, x2, y2) {
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2);
      c.lineWidth = 0.8; c.strokeStyle = rgba(K.kupfer, 0.35); c.stroke();
    }
    var reihen = 3 + Math.floor(z() * 3);
    for (var i = 1; i < reihen; i++) {
      var yy = Math.round(y + h * i / reihen) + 0.5;
      linie(x + 5, yy, x + w - 5, yy);
    }
    var spalten = 2 + Math.floor(z() * 3);
    for (var j = 1; j < spalten; j++) {
      var xx = Math.round(x + w * j / spalten + (z() - 0.5) * 10) + 0.5;
      linie(xx, y + 5, xx, y + h - 5);
    }
    var bw = w * (0.28 + z() * 0.18), bh = h * (0.36 + z() * 0.2);
    var bx = x + 6 + (w - bw - 12) * z(), by = y + 6 + (h - bh - 12) * z();
    pfad(c, bx, by, bw, bh, 3);
    c.fillStyle = rgba(K.kupfer, 0.16); c.fill();
    c.save();
    c.shadowColor = rgba(K.kupfer, 0.8);
    c.shadowBlur = 8 * dpr;
    c.lineWidth = 1.6; c.strokeStyle = rgba(K.kern, 0.9); c.stroke();
    c.restore();
    var streifen = 4 + Math.floor(z() * 4);
    for (var s = 1; s < streifen; s++) {
      var sy = Math.round(by + bh * s / streifen) + 0.5;
      linie(bx + 3, sy, bx + bw - 3, sy);
    }
    for (var k = 0; k < 2; k++) {
      var rx = x + 10 + z() * (w - 20), ry = y + 10 + z() * (h - 20), rr = 2.5 + z() * 2.5;
      c.beginPath(); c.arc(rx, ry, rr, 0, Math.PI * 2);
      c.lineWidth = 1.2; c.strokeStyle = rgba(K.kern, 0.7); c.stroke();
    }
  }

  function vorzeichnen(p, dpr) {
    var w = p.w + RAND * 2, h = p.h + RAND * 2;
    var cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.ceil(w * dpr));
    cv.height = Math.max(1, Math.ceil(h * dpr));
    var c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.globalCompositeOperation = 'lighter';
    if (p.art === 'text') {
      schrift(c, RAND, RAND, p.w, p.h, p.samen, dpr);
    } else {
      umriss(c, RAND, RAND, p.w, p.h, p.r, dpr, p.rang);
      if (p.art === 'platine') platine(c, RAND, RAND, p.w, p.h, p.samen, dpr);
    }
    p.bild = cv;
  }

  /* ============================================================ Zeitkurven */

  function helligkeit(t) {
    if (t < T.punkt) return 0;
    if (t < 0.9) return 0.32 * glatt((t - T.punkt) / 0.6);
    if (t < T.riser) return 0.32 + 0.26 * glatt((t - 0.9) / (T.riser - 0.9)) + 0.03 * Math.sin(t * 5);
    if (t < T.gipfel) return 0.58 + 1.1 * Math.pow((t - T.riser) / (T.gipfel - T.riser), 2);
    if (t < T.pause) return 1.68 - 1.36 * glatt((t - T.gipfel) / (T.pause - T.gipfel));
    if (t < 8.2) return 0.32;
    if (t < T.schlag) return 0.32 + 0.35 * glatt((t - 8.2) / 0.3);
    var nach = 0.62 + 1.4 * Math.exp(-(t - T.schlag) * 3);
    return nach * (1 - glatt((t - T.fest) / 0.8));
  }

  /* halbe Laenge des Strichs, gemessen an der Breite */
  function laenge(t) {
    if (t < 0.9) return 0.015;
    if (t < T.riser) return 0.015 + 0.37 * aus((t - 0.9) / (T.riser - 0.9));
    if (t < T.gipfel) return 0.385 + 0.25 * glatt((t - T.riser) / (T.gipfel - T.riser));
    if (t < T.schlag) return 0.635 - 0.13 * glatt((t - T.gipfel) / 0.5);
    return 0.62;
  }

  function streifen(t) {
    if (t > 6.75 && t < T.pause) {
      return glatt((t - 6.75) / 0.5) * (1 - glatt((t - T.gipfel) / (T.pause - T.gipfel)));
    }
    if (t >= T.schlag) return Math.exp(-(t - T.schlag) * 2.6);
    return 0;
  }

  function geist(t) {
    if (t < 6.6 || t > T.fest + 0.8) return 0;
    if (t < T.schlag) return glatt((t - 6.6) / 0.6) * (t > T.pause ? 0.6 : 1);
    return Math.exp(-(t - T.schlag) * 1.2);
  }

  /* ============================================================ Malen */

  function grundMalen(c, st, t) {
    var a = 1 - glatt((t - T.fest) / 0.75);
    c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, st.w, st.h);
    if (a > 0) {
      c.fillStyle = 'rgba(3,2,1,' + a.toFixed(3) + ')';
      c.fillRect(0, 0, st.w, st.h);
    }
  }

  function teileMalen(c, st, t) {
    var vorschau = 0;
    if (t > 6.95 && t < T.pause) {
      vorschau = glatt((t - 6.95) / 0.35) * (1 - glatt((t - T.gipfel) / (T.pause - T.gipfel)));
    }
    var nachSchlag = t >= T.schlag;
    if (!nachSchlag && vorschau <= 0.001) return;
    var weg = 1 - glatt((t - (T.fest + 0.3)) / (T.ende - T.fest - 0.3));
    var kante = 0.25 * glatt((t - T.fest) / 0.3) * (1 - glatt((t - T.fest - 0.3) / 0.4));
    var schein = nachSchlag ? Math.exp(-(t - T.schlag) * 2.2) : 0;
    c.globalCompositeOperation = 'lighter';
    for (var i = 0; i < st.teile.length; i++) {
      var p = st.teile[i];
      var a, dy, blitz = 0;
      if (!nachSchlag) {
        a = 0.55 * vorschau * p.vorschau;
        dy = p.richtung * 14;
      } else {
        /* Ab dem Schlag steht der ganze Bauplan hell da; das Einrasten
           zeigt sich in der Bewegung und einem kurzen Nachleuchten. */
        var vor = t < p.einrasten;
        var e = rast((t - p.einrasten) / 0.34);
        dy = p.richtung * 18 * (1 - e);
        blitz = vor ? 0 : Math.exp(-(t - p.einrasten) * 5.5) * weg;
        a = ((vor ? 0.85 : 0.95) + 0.15 * schein) * weg + kante;
      }
      if (a <= 0.004) continue;
      var x = p.x - RAND, y = p.y - RAND + dy, w = p.w + RAND * 2, h = p.h + RAND * 2;
      c.globalAlpha = Math.min(1, a);
      c.drawImage(p.bild, x, y, w, h);
      /* Nachleuchten beim Einrasten: dasselbe Teil noch einmal additiv */
      if (blitz > 0.05) {
        c.globalAlpha = Math.min(1, 0.6 * blitz);
        c.drawImage(p.bild, x, y, w, h);
      }
    }
    c.globalAlpha = 1;
  }

  function lichtMalen(c, st, t) {
    var W = st.w, H = st.h, cx = W / 2, cy = H / 2;
    var I = helligkeit(t), L = laenge(t) * W, V = streifen(t);
    if (I <= 0.002) return;
    c.globalCompositeOperation = 'lighter';

    /* weiter Dunst um die Linie */
    c.save();
    c.translate(cx, cy);
    c.scale(Math.max(1, L * 1.1), H * 0.22);
    var d = c.createRadialGradient(0, 0, 0, 0, 0, 1);
    d.addColorStop(0, rgba(K.kupfer, 0.16 * I));
    d.addColorStop(0.5, rgba(K.tief, 0.05 * I));
    d.addColorStop(1, rgba(K.tief, 0));
    c.fillStyle = d;
    c.fillRect(-1, -1, 2, 2);
    c.restore();

    /* der Strich: Kupfer links, weiss in der Mitte, kuehl nach rechts */
    var lg = c.createLinearGradient(cx - L, 0, cx + L, 0);
    lg.addColorStop(0, rgba(K.kupfer, 0));
    lg.addColorStop(0.3, rgba(K.kupfer, 0.35 * I));
    lg.addColorStop(0.5, rgba(K.kern, 0.95 * I));
    lg.addColorStop(0.62, rgba(K.hell, 0.5 * I));
    lg.addColorStop(0.82, rgba(K.kuehl, 0.22 * I));
    lg.addColorStop(1, rgba(K.kuehl, 0));
    c.fillStyle = lg;
    var dicke = 1 + 1.2 * Math.min(1.5, I);
    c.fillRect(cx - L, cy - dicke / 2, L * 2, dicke);

    /* weicher Saum um den Strich: eine flache Ellipse statt eines Balkens,
       sonst sieht er aus wie ein doppeltes Lineal */
    c.save();
    c.translate(cx, cy);
    c.scale(Math.max(1, L), 7 + 5 * Math.min(1.5, I));
    var saum = c.createRadialGradient(0, 0, 0, 0, 0, 1);
    saum.addColorStop(0, rgba(K.hell, 0.35 * I));
    saum.addColorStop(0.5, rgba(K.kupfer, 0.12 * I));
    saum.addColorStop(1, rgba(K.kupfer, 0));
    c.fillStyle = saum;
    c.fillRect(-1, -1, 2, 2);
    c.restore();

    /* der Glutpunkt: anamorph in die Breite gezogen, mit weissem Kern */
    var rx = 16 + 22 * Math.min(1.6, I), ry = 3 + 3 * Math.min(1.6, I);
    c.save();
    c.translate(cx, cy);
    c.scale(rx, ry);
    var sg = c.createRadialGradient(0, 0, 0, 0, 0, 1);
    sg.addColorStop(0, rgba(K.kern, Math.min(1, 1.1 * I)));
    sg.addColorStop(0.35, rgba(K.hell, 0.6 * I));
    sg.addColorStop(1, rgba(K.kupfer, 0));
    c.fillStyle = sg;
    c.fillRect(-1, -1, 2, 2);
    c.restore();
    var kern = c.createRadialGradient(cx, cy, 0, cx, cy, 2.5 + 2 * Math.min(1.6, I));
    kern.addColorStop(0, rgba('255,255,255', Math.min(1, I)));
    kern.addColorStop(1, rgba(K.kern, 0));
    c.fillStyle = kern;
    c.fillRect(cx - 6, cy - 6, 12, 12);

    /* Lichtspitzen beim Aufflammen und beim Schlag: heller Kern mit
       breitem weichem Schein, ueber die Breite verteilt */
    if (V > 0.01) {
      var xs = [0, -12, 15, -240, -120, 170, 310];
      for (var k = 0; k < xs.length; k++) {
        var hs = H * (k === 0 ? 0.34 : 0.2 / (1 + k * 0.2)) * V;
        var sx = cx + xs[k] * (W / 1300);
        var staerke = V * (k === 0 ? 1 : 0.8);
        var vg = c.createLinearGradient(0, cy - hs, 0, cy + hs);
        vg.addColorStop(0, rgba(K.hell, 0));
        vg.addColorStop(0.5, rgba(K.kern, 0.9 * staerke));
        vg.addColorStop(1, rgba(K.hell, 0));
        c.fillStyle = vg;
        c.fillRect(sx - 0.75, cy - hs, 1.5, hs * 2);
        c.save();
        c.translate(sx, cy);
        c.scale(6, Math.max(1, hs * 0.8));
        var hg = c.createRadialGradient(0, 0, 0, 0, 0, 1);
        hg.addColorStop(0, rgba(K.kupfer, 0.24 * staerke));
        hg.addColorStop(1, rgba(K.kupfer, 0));
        c.fillStyle = hg;
        c.fillRect(-1, -1, 2, 2);
        c.restore();
      }
    }

    /* Geisterlinse rechts, treibt langsam nach aussen */
    var g = geist(t);
    if (g > 0.01) {
      var gx = cx + W * (0.32 + 0.06 * klemme((t - 6.6) / 2, 0, 1));
      c.save();
      c.translate(gx, cy);
      c.scale(W * 0.05, H * 0.2);
      var gg = c.createRadialGradient(0, 0, 0, 0, 0, 1);
      gg.addColorStop(0, rgba(K.kuehl, 0.08 * g));
      gg.addColorStop(0.7, rgba(K.kupfer, 0.05 * g));
      gg.addColorStop(1, rgba(K.kupfer, 0));
      c.fillStyle = gg;
      c.fillRect(-1, -1, 2, 2);
      c.restore();
    }
  }

  /* Der Schlag: eine breite, flache Lichtellipse auf der Linie wie in der
     Vorlage, dazu ein schwacher warmer Schimmer ueber den ganzen Schirm. */
  function blitzMalen(c, st, t) {
    if (t < T.schlag) return;
    var f = Math.exp(-(t - T.schlag) * 2);
    if (f < 0.01) return;
    var W = st.w, H = st.h;
    c.globalCompositeOperation = 'lighter';
    c.save();
    c.translate(W / 2, H / 2);
    c.scale(W * 0.4, H * 0.075);
    var e = c.createRadialGradient(0, 0, 0, 0, 0, 1);
    e.addColorStop(0, rgba(K.kern, 0.9 * f));
    e.addColorStop(0.4, rgba(K.hell, 0.3 * f));
    e.addColorStop(1, rgba(K.kupfer, 0));
    c.fillStyle = e;
    c.fillRect(-1, -1, 2, 2);
    c.restore();
    var g = c.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
    g.addColorStop(0, rgba(K.kupfer, 0.12 * f));
    g.addColorStop(1, rgba(K.tief, 0));
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
  }

  function bild(st, t) {
    var c = st.c, dpr = st.dpr;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    grundMalen(c, st, t);
    /* ganz leichter Kamerazug: der Bauplan zieht sich bis zum Einrasten
       auf seine echte Groesse zurueck */
    var z = t >= T.schlag ? 1 + 0.035 * (1 - aus((t - T.schlag) / (T.fest - T.schlag))) : 1.035;
    c.setTransform(dpr * z, 0, 0, dpr * z, dpr * st.w / 2 * (1 - z), dpr * st.h / 2 * (1 - z));
    teileMalen(c, st, t);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    lichtMalen(c, st, t);
    blitzMalen(c, st, t);
    c.globalCompositeOperation = 'source-over';
  }

  /* ============================================================ Ton */

  function tonLaden(fertig) {
    var k = SG.audio && SG.audio.kontext ? SG.audio.kontext() : null;
    var url = SG.assets && SG.assets['ui-aufbau-ton'];
    if (!k || !url || !window.fetch) { fertig(null); return; }
    var erledigt = false;
    var uhr = setTimeout(function () { if (!erledigt) { erledigt = true; fertig(null); } }, 3500);
    function ende(ton) { if (erledigt) return; erledigt = true; clearTimeout(uhr); fertig(ton); }
    fetch(url)
      .then(function (r) { return r.arrayBuffer(); })
      .then(function (b) {
        /* Safari kennt decodeAudioData nur mit Rueckruf */
        return new Promise(function (ok, nein) { k.ctx.decodeAudioData(b, ok, nein); });
      })
      .then(function (puffer) { ende({ k: k, puffer: puffer }); })
      .catch(function () { ende(null); });
  }

  function tonStarten(st, ton) {
    var ctx = ton.k.ctx;
    var quelle = ctx.createBufferSource();
    quelle.buffer = ton.puffer;
    var g = ctx.createGain();
    quelle.connect(g);
    g.connect(ton.k.ziel);
    var beginn = ctx.currentTime + 0.06;
    g.gain.setValueAtTime(1, beginn);
    g.gain.setValueAtTime(1, beginn + T.fest - 0.1);
    g.gain.linearRampToValueAtTime(0, beginn + T.ende - 0.2);
    quelle.start(beginn);
    st.ton = { ctx: ctx, quelle: quelle, gain: g, beginn: beginn };
  }

  /* ============================================================ Ablauf */

  function zeit(st) {
    if (st.sprung) return st.sprung.ab + (performance.now() - st.sprung.um) / 1000 * 1.6;
    if (st.ton && st.ton.ctx.state === 'running') return st.ton.ctx.currentTime - st.ton.beginn;
    return (performance.now() - st.t0) / 1000;
  }

  function ueberspringen(st) {
    if (st.sprung || st.vorbei || !st.teile) return;
    var t = zeit(st);
    if (t >= T.fest) return;
    st.sprung = { ab: T.fest, um: performance.now() };
    if (st.ton) {
      try {
        var n = st.ton.ctx.currentTime, gw = st.ton.gain.gain;
        gw.cancelScheduledValues(n);
        gw.setValueAtTime(gw.value, n);
        gw.linearRampToValueAtTime(0, n + 0.35);
      } catch (e) { /* egal */ }
    }
  }

  function beenden(st) {
    if (st.vorbei) return;
    st.vorbei = true;
    cancelAnimationFrame(st.raf);
    clearTimeout(st.warte);
    window.removeEventListener('resize', st.aufGroesse);
    window.removeEventListener('keydown', st.aufTaste, true);
    if (st.ton) { try { st.ton.quelle.stop(); } catch (e) { /* egal */ } }
    if (st.el.parentNode) st.el.parentNode.removeChild(st.el);
    st.teile = null;          // die vorgezeichneten Teile freigeben
    if (laeuft === st) laeuft = null;
    if (SG.kulisse && SG.kulisse.ruhen) SG.kulisse.ruhen(SG.router.parse().kind === 'game');
    if (st.merken) { try { SG.storage.set(SCHLUESSEL, Date.now()); } catch (e) { /* egal */ } }
    if (st.weiter) {
      try { st.weiter(); } catch (e) { if (SG.noteError) SG.noteError('aufbau.weiter', e); }
    }
  }

  function schleife(st) {
    if (st.vorbei) return;
    var t = zeit(st);
    if (t >= T.ende) { beenden(st); return; }
    if (st.skip && t > 1.2) st.skip.style.opacity = '1';
    try { bild(st, t); }
    catch (e) { if (SG.noteError) SG.noteError('aufbau', e); beenden(st); return; }
    st.raf = requestAnimationFrame(function () { schleife(st); });
  }

  function aufbauen(opts) {
    var cv = UI.el('canvas');
    cv.width = 1;
    cv.height = 1;
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    var skip = opts.standbild === undefined
      ? UI.el('button', { type: 'button', text: 'Überspringen' })
      : null;
    if (skip) {
      skip.style.cssText = 'position:absolute;right:calc(16px + env(safe-area-inset-right,0px));'
        + 'bottom:calc(16px + env(safe-area-inset-bottom,0px));padding:8px 12px;border-radius:9px;'
        + 'background:rgba(0,0,0,.35);color:rgba(255,220,180,.8);border:1px solid rgba(255,190,130,.3);'
        + 'font:600 12.5px var(--ui);opacity:0;transition:opacity .6s ease;cursor:pointer';
    }
    /* Bis vermessen ist, deckt die Ebene selbst schwarz ab; danach zeichnet
       die Leinwand den Grund, damit die Seite am Ende durchscheinen kann. */
    var el = UI.el('div', { 'aria-hidden': 'true' }, [cv, skip]);
    el.style.cssText = 'position:fixed;inset:0;z-index:1000;background:#030201;touch-action:none;'
      + '-webkit-user-select:none;user-select:none';
    return {
      el: el, cv: cv, c: cv.getContext('2d'), skip: skip, dpr: 1, w: 1, h: 1,
      teile: null, weiter: opts.weiter, merken: !!opts.merken, t0: 0, raf: 0,
    };
  }

  /* Die Groesse erst jetzt nehmen: ein Tab im Hintergrund meldet manchmal
     0 x 0, und mit einer leeren Leinwand bliebe die Animation unsichtbar. */
  function groesseSetzen(st) {
    var W = window.innerWidth || document.documentElement.clientWidth || 1024;
    var H = window.innerHeight || document.documentElement.clientHeight || 768;
    /* 1,5 statt 2: das Leuchten ist ohnehin weich, und auf dem iPad spart
       das rund 44 % Speicher fuer Leinwand und vorgezeichnete Teile */
    st.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    st.w = W;
    st.h = H;
    st.cv.width = Math.round(W * st.dpr);
    st.cv.height = Math.round(H * st.dpr);
    st.el.style.background = 'transparent';
  }

  function vorbereiten(st) {
    groesseSetzen(st);
    st.teile = vermessen(st.w, st.h);
    takten(st.teile, st.w, st.h);
    st.teile.forEach(function (p) { vorzeichnen(p, st.dpr); });
  }

  A.zeigen = function (opts) {
    opts = opts || {};
    if (laeuft) return;
    var st = aufbauen(opts);
    laeuft = st;
    document.body.appendChild(st.el);
    if (SG.kulisse && SG.kulisse.ruhen) SG.kulisse.ruhen(true);

    /* Nur bei echtem Drehen oder Umbauen des Fensters abbrechen - der
       Bauplan passte dann nicht mehr auf die Seite. Kleine Zuckungen der
       Safari-Leisten stoeren nicht. */
    st.aufGroesse = function () {
      var W = window.innerWidth, H = window.innerHeight;
      if (!st.teile || !W || !H) return;
      if (Math.abs(W - st.w) > 60 || Math.abs(H - st.h) > 60) beenden(st);
    };
    st.aufTaste = function (e) {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        ueberspringen(st);
      }
    };
    window.addEventListener('resize', st.aufGroesse);
    window.addEventListener('keydown', st.aufTaste, true);
    st.el.addEventListener('pointerdown', function () { ueberspringen(st); });

    /* Die Kacheln fahren beim Aufbau des Hubs kurz ein. Erst wenn sie
       stehen, wird vermessen - solange ist der Schirm ohnehin schwarz. */
    st.warte = setTimeout(function () {
      if (st.vorbei) return;
      /* Geht beim Vorbereiten etwas schief, darf der schwarze Schirm nicht
         stehen bleiben - dann eben ohne Animation weiter zur Seite. */
      try {
        vorbereiten(st);
        bild(st, 0);          // schwarz, solange der Ton laedt
      } catch (e) {
        if (SG.noteError) SG.noteError('aufbau.vorbereiten', e);
        beenden(st);
        return;
      }
      tonLaden(function (ton) {
        if (st.vorbei) return;
        if (ton) {
          try { tonStarten(st, ton); } catch (e) { st.ton = null; }
        }
        st.t0 = performance.now() + (st.ton ? 60 : 0);
        st.raf = requestAnimationFrame(function () { schleife(st); });
      });
    }, 320);
  };

  /* Ein einzelnes Bild zur Zeit t, ohne Ton und ohne Ablauf - zum
     Vergleichen mit der Vorlage. Liefert eine Funktion zum Entfernen. */
  A.standbild = function (t) {
    if (laeuft) return function () {};
    var st = aufbauen({ standbild: t });
    laeuft = st;
    document.body.appendChild(st.el);
    vorbereiten(st);
    bild(st, t);
    return function () {
      if (st.el.parentNode) st.el.parentNode.removeChild(st.el);
      if (laeuft === st) laeuft = null;
    };
  };

  /* ============================================================ Auslöser */

  function ruhig() {
    try {
      if (SG.settings.get('reduced')) return true;
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { return false; }
  }

  function gesehen() {
    try { return !!SG.storage.get(SCHLUESSEL, null); } catch (e) { return true; }
  }

  /* Nach dem Anmelden: einmal nach dem Update, danach nur mit der
     Einstellung. weiter() kommt immer - mit oder ohne Animation. */
  A.vielleicht = function (weiter) {
    weiter = weiter || function () {};
    var soll = false;
    try { soll = !!SG.settings.get('aufbau') || !gesehen(); } catch (e) { soll = false; }
    var haft = SG.verhoer && SG.verhoer.eigenePerson && SG.verhoer.eigenePerson();
    if (!soll || ruhig() || haft || SG.router.parse().kind !== 'hub') { weiter(); return; }
    A.zeigen({ weiter: weiter, merken: true });
  };
})(SG);
