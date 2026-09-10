/* ------------------------------------------------------------------
   Flughafen-Tycoon - Bild

   Der Flughafen wird nicht auf ein Raster gesetzt, sondern aus dem
   Zustand gezeichnet: so viele Bahnen, wie gebaut sind, so lang, wie
   sie verlaengert wurden, so viele Gates am Terminal, wie es gibt.
   Wer etwas baut, sieht es sofort liegen - das ist der halbe Reiz.

   Gezeichnet wird in einem festen Weltmass von 1000 x 620, das der
   Renderer auf die Leinwand skaliert. Damit muss keine einzige Zahl
   weiter unten von der Fenstergroesse wissen.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var G = SG.gfx;
  var A = SG.tycoon.air;
  var D = A.data;
  var S = A.sim;

  var R = A.render = {};

  var WELT_B = 1000;
  var WELT_H = 620;

  R.WELT_B = WELT_B;
  R.WELT_H = WELT_H;

  /* ---------------------------------------------------------- Geometrie */

  /* Jede Bahn liegt waagerecht. Die erste oben, weitere darunter. */
  R.bahnBox = function (s, i) {
    var oben = 46;
    var hoehe = 34;
    var abstand = 52;
    var laenge = D.BAHN_STUFEN[s.bahnen[i].stufe].laenge;
    var breite = 300 + (laenge - 1400) / 4000 * 560;
    return { x: 70, y: oben + i * abstand, w: breite, h: hoehe };
  };

  R.terminalBox = function (s) {
    var breite = 320 + s.terminal * 130;
    return { x: 90, y: 452, w: Math.min(760, breite), h: 74 };
  };

  /* Gates stehen in einer Reihe oberhalb des Terminals. Passen nicht
     alle in eine Reihe, wird eine zweite darueber angefangen. */
  R.REIHEN = 3;

  R.gateBox = function (s, i) {
    var t = R.terminalBox(s);
    /* Hoechstens drei Reihen. Kommen mehr Gates dazu, ruecken sie enger
       zusammen, statt nach oben ins Gras zu wachsen. */
    var proReihe = Math.max(4, Math.min(20,
      Math.max(Math.floor(t.w / 52), Math.ceil(s.gates.length / R.REIHEN))));
    var reihe = Math.floor(i / proReihe);
    var spalte = i % proReihe;
    var b = t.w / proReihe;
    return {
      x: t.x + spalte * b + 4,
      y: t.y - 44 - reihe * 52,
      w: b - 8,
      h: 34,
    };
  };

  /* Wo ein Flugzeug an diesem Gate steht */
  function gatePunkt(s, i) {
    var g = R.gateBox(s, i);
    return { x: g.x + g.w / 2, y: g.y + g.h / 2 };
  }

  /* ---------------------------------------------------------- Positionen */

  /* Rechnet aus Phase und Phasenzeit eine Position im Weltmass.
     Bewusst ohne echtes Rollwegnetz: eine gerade Linie zwischen zwei
     Punkten sieht in dieser Groesse genauso richtig aus und kostet
     nichts. */
  R.flugPunkt = function (s, f) {
    var bahn = R.bahnBox(s, 0);
    var mitteY = bahn.y + bahn.h / 2;

    if (f.phase === 'anflug') {
      var t = U.clamp(f.t / 8, 0, 1);
      return { x: -120 + t * (bahn.x + 40 + 120), y: mitteY - 30 + t * 30, w: 1, r: 0 };
    }
    if (f.phase === 'landung') {
      var t2 = U.clamp(f.t / 2, 0, 1);
      return { x: bahn.x + 40 + t2 * (bahn.w - 80), y: mitteY, w: 1, r: 0 };
    }
    if (f.phase === 'rollen') {
      var p = gatePunkt(s, f.gate === null ? 0 : f.gate);
      var t3 = U.clamp(f.t / 4, 0, 1);
      var vx = bahn.x + bahn.w - 40;
      return {
        x: vx + (p.x - vx) * t3,
        y: mitteY + (p.y - mitteY) * t3,
        w: 1, r: Math.PI / 2 * t3,
      };
    }
    if (f.phase === 'gate') {
      var pg = gatePunkt(s, f.gate === null ? 0 : f.gate);
      return { x: pg.x, y: pg.y, w: 1, r: Math.PI / 2 };
    }
    if (f.phase === 'abrollen') {
      var pa = gatePunkt(s, f.gate === null ? 0 : f.gate);
      var t4 = U.clamp(f.t / 5, 0, 1);
      var zx = bahn.x + 50;
      return {
        x: pa.x + (zx - pa.x) * t4,
        y: pa.y + (mitteY - pa.y) * t4,
        w: 1, r: Math.PI / 2 * (1 - t4),
      };
    }
    // start
    var t5 = U.clamp(f.t / 3, 0, 1);
    var e = t5 * t5;
    return {
      x: bahn.x + 50 + e * (bahn.w + 220),
      y: mitteY - e * 34,
      w: 1 + e * 0.25, r: 0,
    };
  };

  /* ---------------------------------------------------------- Zeichnen */

  /* Ein kleines Flugzeug von oben. Gezeichnet, nicht als Bild - die
     Offline-Datei kennt keine Grafikdateien. */
  function flugzeug(c, x, y, groesse, rot, farbe, skala) {
    var l = (11 + groesse * 4) * (skala || 1);
    var b = (8 + groesse * 3.4) * (skala || 1);

    c.save();
    c.translate(x, y);
    c.rotate(rot || 0);

    // Schatten
    c.fillStyle = 'rgba(0,0,0,.28)';
    c.beginPath();
    c.ellipse(2.5, 3, l * 0.5, b * 0.28, 0, 0, Math.PI * 2);
    c.fill();

    // Tragflaechen
    c.fillStyle = farbe;
    c.beginPath();
    c.moveTo(l * 0.08, 0);
    c.lineTo(-l * 0.1, -b);
    c.lineTo(-l * 0.24, -b);
    c.lineTo(-l * 0.06, 0);
    c.lineTo(-l * 0.24, b);
    c.lineTo(-l * 0.1, b);
    c.closePath();
    c.fill();

    // Hoehenleitwerk
    c.beginPath();
    c.moveTo(-l * 0.42, 0);
    c.lineTo(-l * 0.52, -b * 0.42);
    c.lineTo(-l * 0.6, -b * 0.42);
    c.lineTo(-l * 0.56, 0);
    c.lineTo(-l * 0.6, b * 0.42);
    c.lineTo(-l * 0.52, b * 0.42);
    c.closePath();
    c.fill();

    // Rumpf
    c.beginPath();
    c.ellipse(-l * 0.1, 0, l * 0.55, b * 0.26, 0, 0, Math.PI * 2);
    c.fill();

    // Nase
    c.fillStyle = 'rgba(255,255,255,.55)';
    c.beginPath();
    c.ellipse(l * 0.36, 0, l * 0.1, b * 0.2, 0, 0, Math.PI * 2);
    c.fill();

    c.restore();
  }
  R.flugzeug = flugzeug;

  function bahnZeichnen(c, box, laenge, aktiv) {
    // Asphalt
    G.fillRound(c, box.x, box.y, box.w, box.h, 3, aktiv ? '#2b3040' : '#242938');
    c.fillStyle = 'rgba(255,255,255,.05)';
    c.fillRect(box.x, box.y, box.w, 2);

    // Mittelstreifen
    c.save();
    c.strokeStyle = 'rgba(255,255,255,.38)';
    c.lineWidth = 2;
    c.setLineDash([16, 14]);
    c.beginPath();
    c.moveTo(box.x + 26, box.y + box.h / 2);
    c.lineTo(box.x + box.w - 26, box.y + box.h / 2);
    c.stroke();
    c.restore();

    // Schwellenmarkierung an beiden Enden
    c.fillStyle = 'rgba(255,255,255,.5)';
    for (var k = 0; k < 4; k++) {
      c.fillRect(box.x + 6, box.y + 5 + k * 7, 12, 4);
      c.fillRect(box.x + box.w - 18, box.y + 5 + k * 7, 12, 4);
    }

    // Laengenschild
    G.text(c, D.formatBahn(laenge), box.x + box.w + 10, box.y + box.h / 2, {
      font: G.font(12, 600), fill: '#6c7796', baseline: 'middle',
    });
  }

  function terminalZeichnen(c, s) {
    var t = R.terminalBox(s);
    G.fillRound(c, t.x, t.y, t.w, t.h, 8,
      G.linear(c, 0, t.y, 0, t.y + t.h, [0, '#2e3852', 1, '#212a3d']));
    G.strokeRound(c, t.x, t.y, t.w, t.h, 8, 'rgba(255,255,255,.09)', 1);

    // Fensterband
    c.fillStyle = 'rgba(240,180,41,.2)';
    for (var x = t.x + 12; x < t.x + t.w - 12; x += 13) {
      c.fillRect(x, t.y + 12, 7, 9);
    }
    // Dach
    c.fillStyle = 'rgba(255,255,255,.05)';
    c.fillRect(t.x + 8, t.y + t.h - 20, t.w - 16, 10);

    G.text(c, D.TERMINALS[s.terminal].name, t.x + t.w / 2, t.y + t.h - 15, {
      font: G.font(12, 700), fill: '#93a0bd', align: 'center', baseline: 'middle',
    });
  }

  function gateZeichnen(c, s, i, blinkt) {
    var g = R.gateBox(s, i);
    var art = D.gateArt(s.gates[i].art);
    var belegt = s.gates[i].belegt !== null;

    G.fillRound(c, g.x, g.y, g.w, g.h, 5, belegt ? '#33405e' : '#232c40');
    G.strokeRound(c, g.x, g.y, g.w, g.h, 5,
      belegt ? 'rgba(240,180,41,.45)' : 'rgba(255,255,255,.07)', 1);

    // Fluggastbruecke zum Terminal, nur bei echten Gates
    if (art.id !== 'position') {
      var t = R.terminalBox(s);
      c.strokeStyle = 'rgba(255,255,255,.13)';
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(g.x + g.w / 2, g.y + g.h);
      c.lineTo(g.x + g.w / 2, Math.min(t.y, g.y + g.h + 22));
      c.stroke();
    }

    G.text(c, String(i + 1), g.x + 6, g.y + g.h / 2, {
      font: G.font(11, 700), fill: belegt ? '#f0b429' : '#5f6a85', baseline: 'middle',
    });
    G.text(c, ['', 'S', 'M', 'L', 'XL'][art.groesse - 1] || '', g.x + g.w - 6, g.y + g.h / 2, {
      font: G.font(10, 600), fill: '#5f6a85', align: 'right', baseline: 'middle',
    });

    if (blinkt && !belegt) {
      c.fillStyle = 'rgba(61,220,132,.14)';
      G.fillRound(c, g.x, g.y, g.w, g.h, 5, 'rgba(61,220,132,.14)');
    }
  }

  /* Nebengebaeude: eine Reihe kleiner Bloecke unten */
  function anlagenZeichnen(c, s) {
    var x = 96;
    var y = 552;
    for (var i = 0; i < D.ANLAGEN.length; i++) {
      var def = D.ANLAGEN[i];
      var n = S.anlage(s, def.id);
      if (!n) continue;
      var b = 30 + Math.min(3, n) * 9;
      if (x + b > WELT_B - 60) break;

      G.fillRound(c, x, y, b, 40, 5, '#242c40');
      G.strokeRound(c, x, y, b, 40, 5, 'rgba(255,255,255,.06)', 1);
      G.text(c, def.icon, x + b / 2, y + 16, {
        font: G.font(15), align: 'center', baseline: 'middle',
      });
      G.text(c, String(n), x + b / 2, y + 31, {
        font: G.font(10, 700), fill: '#6c7796', align: 'center', baseline: 'middle',
      });
      x += b + 7;
    }
  }

  /* ---------------------------------------------------------- Hauptbild */

  R.zeichnen = function (c, s, breite, hoehe, zeit) {
    var skala = Math.min(breite / WELT_B, hoehe / WELT_H);
    var ox = (breite - WELT_B * skala) / 2;
    var oy = (hoehe - WELT_H * skala) / 2;

    /* Himmel und Gelaende. Die Farbe folgt der Uhrzeit - morgens kuehl,
       mittags hell, nachts fast schwarz. */
    var tag = U.clamp(Math.sin((s.uhr - 6) / 24 * Math.PI * 2) * 0.5 + 0.5, 0, 1);
    var hell = 0.24 + tag * 0.5;
    c.fillStyle = U.mixHex('#0a0d14', '#1a2434', hell);
    c.fillRect(0, 0, breite, hoehe);

    c.save();
    c.translate(ox, oy);
    c.scale(skala, skala);

    /* Auf das Gelaende beschneiden. Anfliegende Maschinen starten
       ausserhalb des Weltmasses - ohne Schnitt schweben sie ueber der
       Kopfzeile. */
    c.beginPath();
    c.rect(0, 0, WELT_B, WELT_H);
    c.clip();

    // Gras
    c.fillStyle = U.mixHex('#101a14', '#1c2c1e', hell);
    c.fillRect(0, 0, WELT_B, WELT_H);

    // Vorfeld - reicht bis ueber die oberste Gate-Reihe
    var obersteReihe = Math.min(R.REIHEN, Math.ceil(s.gates.length
      / Math.max(1, Math.ceil(s.gates.length / R.REIHEN)))) - 1;
    var vorfeldOben = Math.min(392, R.terminalBox(s).y - 52 - obersteReihe * 52 - 14);
    G.fillRound(c, 60, vorfeldOben, WELT_B - 120, WELT_H - vorfeldOben - 30, 10,
      U.mixHex('#161b26', '#212734', hell));

    // Bahnen
    for (var i = 0; i < s.bahnen.length; i++) {
      bahnZeichnen(c, R.bahnBox(s, i), D.BAHN_STUFEN[s.bahnen[i].stufe].laenge, i === 0);
    }

    // Rollweg zwischen Bahnen und Vorfeld
    var letzte = R.bahnBox(s, s.bahnen.length - 1);
    c.strokeStyle = U.mixHex('#20263a', '#39415c', hell);
    c.lineWidth = 14;
    c.beginPath();
    var rollY = Math.min(letzte.y + letzte.h + 26, vorfeldOben - 12);
    c.moveTo(90, rollY);
    c.lineTo(WELT_B - 120, rollY);
    c.stroke();
    c.strokeStyle = 'rgba(240,180,41,.22)';
    c.lineWidth = 1.5;
    c.setLineDash([9, 9]);
    c.beginPath();
    c.moveTo(90, rollY);
    c.lineTo(WELT_B - 120, rollY);
    c.stroke();
    c.setLineDash([]);

    terminalZeichnen(c, s);

    var eng = S.gatesFrei(s) === 0;
    for (i = 0; i < s.gates.length; i++) gateZeichnen(c, s, i, eng);

    anlagenZeichnen(c, s);

    // Flugzeuge
    for (i = 0; i < s.fluege.length; i++) {
      var f = s.fluege[i];
      var m = D.musterVon(f.muster);
      var p = R.flugPunkt(s, f);
      var farbe = f.warte > 15 ? '#ff9c3f' : (m.id === 'fracht' ? '#8794b1' : '#dbe3f2');
      flugzeug(c, p.x, p.y, m.groesse, p.r, farbe, p.w);
    }

    // Wartende Flugzeuge in der Schleife bekommen einen Kringel
    var warteN = 0;
    for (i = 0; i < s.fluege.length; i++) {
      if (s.fluege[i].phase === 'anflug' && s.fluege[i].warte > 4) warteN++;
    }
    if (warteN) {
      var r = 44 + Math.sin(zeit * 2) * 3;
      c.strokeStyle = 'rgba(255,156,63,.5)';
      c.lineWidth = 2;
      c.setLineDash([7, 9]);
      c.beginPath();
      c.ellipse(-30, 70, r * 1.5, r, 0, 0, Math.PI * 2);
      c.stroke();
      c.setLineDash([]);
      G.text(c, warteN + ' in der Warteschleife', 30, 130, {
        font: G.font(12, 700), fill: '#ff9c3f', baseline: 'middle',
      });
    }

    // Windsack als kleines Lebenszeichen
    windsack(c, WELT_B - 52, 44, zeit, D.wetter(s.wetter));

    c.restore();

    return { skala: skala, ox: ox, oy: oy };
  };

  function windsack(c, x, y, zeit, wetter) {
    var wind = wetter.id === 'sturm' ? 1 : (wetter.id === 'wind' ? 0.8 : 0.35);
    c.strokeStyle = '#4a5470';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x, y + 46);
    c.stroke();

    var schwung = Math.sin(zeit * 3) * 3 * wind;
    var laenge = 12 + wind * 16;
    c.save();
    c.translate(x, y + 4);
    for (var i = 0; i < 3; i++) {
      c.fillStyle = i % 2 ? '#e9edf6' : '#ff5f6b';
      c.beginPath();
      c.moveTo(i * laenge / 3, -4 - i * 0.4);
      c.lineTo((i + 1) * laenge / 3, -3.4 - i * 0.4 + schwung * (i + 1) * 0.3);
      c.lineTo((i + 1) * laenge / 3, 3.4 + i * 0.4 + schwung * (i + 1) * 0.3);
      c.lineTo(i * laenge / 3, 4 + i * 0.4);
      c.closePath();
      c.fill();
    }
    c.restore();
  }

  /* Welche Gate-Kachel liegt unter diesem Punkt? Fuer Antippen. */
  R.gateBei = function (s, wx, wy) {
    for (var i = 0; i < s.gates.length; i++) {
      var g = R.gateBox(s, i);
      if (wx >= g.x && wx <= g.x + g.w && wy >= g.y && wy <= g.y + g.h) return i;
    }
    return -1;
  };
})(SG);
