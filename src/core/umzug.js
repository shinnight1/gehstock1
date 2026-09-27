/* ------------------------------------------------------------------
   Das Umzugs-Intro.

   Einmal je Person, beim ersten Besuch nach dem Umzug auf den eigenen
   Server: vier kurze Schritte, was sich geaendert hat und warum. Louis
   fuehrt durch, die Datenwege sind gezeichnet - Pakete laufen, das alte
   Kontingent laeuft voll, das neue nicht.

   Alles Bewegte ist eine Leinwand, der Text bleibt echtes HTML - so ist
   er scharf und lesbar. Die Pakete werden rein aus der Zeit gerechnet
   (Paket k startet bei k * Abstand), es gibt also keinen Zustand, der
   weglaufen koennte, und jedes Standbild ist ein gueltiges Bild. Mit
   "Reduzierte Effekte" oder dem Bewegungswunsch des Geraets steht jede
   Szene still.

   Gemerkt wird je Person: SG.storage liegt nach der Anmeldung im Raum
   des Zugangscodes. Offline gibt es nichts anzukuendigen - dort fehlt
   der Server, und das Bild ist nicht in der Datei.
   ------------------------------------------------------------------ */

(function (SG) {
  var UI = SG.ui;

  var U = SG.umzug = {};

  /* Ein neuer Schluessel zeigt das Intro allen noch einmal. */
  var SCHLUESSEL = 'neu:umzug-2026-09';

  var F = {
    knoten: '#16171a',
    kante: '#2e3035',
    licht: 'rgba(255,255,255,.16)',
    spur: 'rgba(255,255,255,.09)',
    text: '#eef0f4',
    leise: '#93969e',
    gold: '#f0b429',
    eis: '#9fd3ff',
    rot: '#ff5f6b',
    orange: '#ff9c3f',
  };
  var MONO = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace';
  var SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

  /* Was ueber die Leitung geht, heisst im Hideout wirklich so. */
  var OPS = ['sync', 'welt', 'pos', 'zug', 'chat'];

  var ICONS = {
    unendlich: '<path d="M12 12c-1.6-2.2-3-3.5-5-3.5a3.5 3.5 0 0 0 0 7c2 0 3.4-1.3 5-3.5zm0 0c1.6 2.2 3 3.5 5 3.5a3.5 3.5 0 0 0 0-7c-2 0-3.4 1.3-5 3.5z"/>',
    blitz: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    speicher: '<ellipse cx="12" cy="5.5" rx="7" ry="2.8"/><path d="M5 5.5v13c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-13"/><path d="M5 12c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8"/>',
    netz: '<path d="M12 3 5 6v5c0 4.5 3 8.4 7 10 4-1.6 7-5.5 7-10V6z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    schloss: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  };

  /* Zahlen aus dem Lasttest auf dem Server (tools/handy-lasttest.mjs,
     26.09.2026, 10 Spieler) - siehe AGENTS.md. */
  var VORTEILE = [
    { ic: 'unendlich', t: 'Kein Kontingent mehr',
      d: 'Früher war nach ein paar Stunden Schluss. Jetzt gibt es keine Obergrenze, die leerlaufen kann.' },
    { ic: 'blitz', t: 'Kurze Wege',
      d: 'Server und Spielerwelt liegen auf demselben Gerät. Auf dem Server gemessen, mit 10 Spielern gleichzeitig: Welt laden 156 ms, eigene Position 26 ms.' },
    { ic: 'speicher', t: 'Jede Nacht gesichert',
      d: '14 Tage Sicherungen auf dem Server, dazu jede Nacht eine Kopie außer Haus.' },
    { ic: 'netz', t: 'Updates mit Sicherheitsnetz',
      d: 'Eine neue Version geht nur live, wenn alle Tests bestehen. Sonst bleibt der bisherige Stand.' },
    { ic: 'schloss', t: 'Verschlüsselt, eine Adresse',
      d: 'HTTPS mit Let’s-Encrypt-Zertifikat unter gehstock.duckdns.org. Die alten Adressen leiten dorthin um.' },
  ];

  var SZENEN = [
    {
      tag: 'Übertragung',
      titel: 'Das Hideout ist umgezogen.',
      satz: 'Weg von Netlify, hin zu unserem eigenen Server. In vier kurzen Schritten: was sich geändert hat und warum dir kein Kontingent mehr den Tag verdirbt.',
      terminal: [
        ['verbinde mit gehstock.duckdns.org', 'ok'],
        ['zertifikat: let’s encrypt', 'gültig'],
        ['neuer server erkannt', 'bereit'],
      ],
      malen: szeneStart,
      ruhe: 1.4,
    },
    {
      tag: 'Vorher',
      titel: 'Früher: geliehener Platz mit Kontingent.',
      satz: 'Die Seite lief bei Netlify, die Spielerwelt lag bei Upstash. Beides kostenlos, aber nur bis zu einer festen Menge im Monat. Eine Schulklasse hat sie an einem Vormittag aufgebraucht. Danach stand alles still.',
      zitat: 'So lief das bisher.',
      malen: szeneVorher,
      ruhe: 6.3,
    },
    {
      tag: 'Jetzt',
      titel: 'Jetzt: unser eigener Server.',
      satz: 'Seite, Spielserver und Spielerwelt laufen auf einem Gerät, das uns gehört. Keine Abfrage muss mehr zu einem fremden Anbieter und zurück, und niemand zählt mit.',
      zitat: 'Und so läuft es jetzt.',
      malen: szeneJetzt,
      ruhe: 2.4,
    },
    {
      tag: 'Was du davon hast',
      titel: 'Was du davon hast',
      liste: VORTEILE,
      zitat: 'Viel Spaß beim Spielen!',
      malen: szeneVorteile,
      ruhe: 3,
      weiter: 'Los geht’s',
    },
  ];

  var offen = null;

  /* ============================================================ Zeichnen */

  function klemme(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function rund(c, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  /* Pakete einer Strecke, rein aus der Zeit: Paket k startet bei
     k * abstand (+ versatz) und ist `span` Sekunden unterwegs. */
  function pakete(t, abstand, span, versatz) {
    var aus = [];
    var t2 = t - (versatz || 0);
    for (var k = Math.max(0, Math.ceil((t2 - span) / abstand)); k * abstand <= t2; k++) {
      aus.push({ k: k, start: k * abstand + (versatz || 0), alter: t2 - k * abstand });
    }
    return aus;
  }

  /* Ein Knoten: dunkle Flaeche, feine Kante, oben die Lichtkante. */
  function knoten(c, k, farbe) {
    rund(c, k.x, k.y, k.w, k.h, 10);
    c.fillStyle = F.knoten;
    c.fill();
    c.lineWidth = 1;
    c.strokeStyle = farbe || F.kante;
    c.stroke();
    c.beginPath();
    c.moveTo(k.x + 10, k.y + 0.5);
    c.lineTo(k.x + k.w - 10, k.y + 0.5);
    c.strokeStyle = F.licht;
    c.stroke();
  }

  /* Name und Unterzeile: unter dem Knoten, oder mit seitlich rechts daneben. */
  function beschriftung(c, k, name, unter, fs, farbe, seitlich) {
    var x = seitlich ? k.x + k.w + 14 : k.x + k.w / 2;
    var y = seitlich ? k.y + k.h / 2 - (unter ? fs * 0.8 : fs / 2) : k.y + k.h + 8;
    c.textAlign = seitlich ? 'left' : 'center';
    c.textBaseline = 'top';
    c.fillStyle = farbe || F.text;
    c.font = '600 ' + fs + 'px ' + SANS;
    c.fillText(name, x, y);
    if (unter) {
      c.fillStyle = F.leise;
      c.font = (fs - 2.5) + 'px ' + MONO;
      c.fillText(unter.toUpperCase(), x, y + fs + 3);
    }
  }

  function symbol(c, art, cx, cy, g, farbe) {
    c.save();
    c.strokeStyle = farbe;
    c.lineWidth = 1.6;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.beginPath();
    if (art === 'geraet') {
      rund(c, cx - g * 0.34, cy - g * 0.48, g * 0.68, g * 0.96, g * 0.12);
      c.stroke();
      c.beginPath();
      c.arc(cx, cy + g * 0.34, g * 0.045, 0, Math.PI * 2);
      c.stroke();
    } else if (art === 'wolke') {
      c.moveTo(cx - 0.46 * g, cy + 0.24 * g);
      c.bezierCurveTo(cx - 0.62 * g, cy + 0.24 * g, cx - 0.62 * g, cy - 0.06 * g, cx - 0.4 * g, cy - 0.06 * g);
      c.bezierCurveTo(cx - 0.38 * g, cy - 0.34 * g, cx - 0.02 * g, cy - 0.4 * g, cx + 0.08 * g, cy - 0.18 * g);
      c.bezierCurveTo(cx + 0.2 * g, cy - 0.32 * g, cx + 0.46 * g, cy - 0.24 * g, cx + 0.42 * g, cy - 0.02 * g);
      c.bezierCurveTo(cx + 0.62 * g, cy, cx + 0.62 * g, cy + 0.24 * g, cx + 0.44 * g, cy + 0.24 * g);
      c.closePath();
      c.stroke();
    } else if (art === 'datenbank') {
      var rx = g * 0.4, ry = g * 0.13, oben = cy - g * 0.34, unten = cy + g * 0.34;
      c.ellipse(cx, oben, rx, ry, 0, 0, Math.PI * 2);
      c.stroke();
      c.beginPath();
      c.moveTo(cx - rx, oben);
      c.lineTo(cx - rx, unten);
      c.ellipse(cx, unten, rx, ry, 0, Math.PI, 0, true);
      c.lineTo(cx + rx, oben);
      c.stroke();
      c.beginPath();
      c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI);
      c.stroke();
    } else if (art === 'globus') {
      c.arc(cx, cy, g * 0.42, 0, Math.PI * 2);
      c.stroke();
      c.beginPath();
      c.ellipse(cx, cy, g * 0.17, g * 0.42, 0, 0, Math.PI * 2);
      c.stroke();
      c.beginPath();
      c.moveTo(cx - g * 0.42, cy);
      c.lineTo(cx + g * 0.42, cy);
      c.stroke();
    }
    c.restore();
  }

  /* Eine Leitung von p1 nach p2 mit laufenden Strichen - die Pfeile, die
     sich bewegen. Gezeichnet wird immer in Flussrichtung. */
  function spur(c, p1, p2, farbe, t) {
    c.beginPath();
    c.moveTo(p1[0], p1[1]);
    c.lineTo(p2[0], p2[1]);
    c.strokeStyle = F.spur;
    c.lineWidth = 1;
    c.stroke();
    c.save();
    c.setLineDash([3, 9]);
    c.lineDashOffset = -t * 26;
    c.globalAlpha = 0.55;
    c.strokeStyle = farbe;
    c.beginPath();
    c.moveTo(p1[0], p1[1]);
    c.lineTo(p2[0], p2[1]);
    c.stroke();
    c.restore();
  }

  /* Pfeilspitze bei p, zeigt in Richtung d (Einheitsvektor). */
  function spitze(c, p, d, farbe) {
    var s = 4.5, nx = -d[1] * s * 0.8, ny = d[0] * s * 0.8;
    c.beginPath();
    c.moveTo(p[0] - d[0] * s + nx, p[1] - d[1] * s + ny);
    c.lineTo(p[0], p[1]);
    c.lineTo(p[0] - d[0] * s - nx, p[1] - d[1] * s - ny);
    c.strokeStyle = farbe;
    c.lineWidth = 1.4;
    c.stroke();
  }

  /* Breit stehen die Stationen nebeneinander, schmal und hoch (Handy)
     untereinander. a ist die Laufrichtung der Daten, q die Querlage. */
  function achse(hoch) {
    return hoch
      ? function (a, q) { return [q, a]; }
      : function (a, q) { return [a, q]; };
  }
  function hochkant(w, h) { return w < 560 && h > w * 1.05; }

  function paket(c, x, y, farbe, alpha, text, fs, hoch) {
    if (alpha <= 0) return;
    var bw = hoch ? 6 : 10, bh = hoch ? 10 : 6;
    c.save();
    c.fillStyle = farbe;
    c.globalAlpha = alpha * 0.2;
    rund(c, x - bw / 2 - 4, y - bh / 2 - 3, bw + 8, bh + 6, 5);
    c.fill();
    c.globalAlpha = alpha;
    rund(c, x - bw / 2, y - bh / 2, bw, bh, 2);
    c.fill();
    if (text) {
      c.globalAlpha = alpha * 0.8;
      c.font = (fs - 3) + 'px ' + MONO;
      if (hoch) {
        c.textAlign = 'right';
        c.textBaseline = 'middle';
        c.fillText(text, x - 9, y);
      } else {
        c.textAlign = 'center';
        c.textBaseline = 'bottom';
        c.fillText(text, x, y - 7);
      }
    }
    c.restore();
  }

  function kreuz(c, x, y, alpha) {
    if (alpha <= 0) return;
    c.save();
    c.globalAlpha = alpha;
    c.strokeStyle = F.rot;
    c.lineWidth = 2;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(x - 4.5, y - 4.5);
    c.lineTo(x + 4.5, y + 4.5);
    c.moveTo(x + 4.5, y - 4.5);
    c.lineTo(x - 4.5, y + 4.5);
    c.stroke();
    c.restore();
  }

  /* Ein Kontingent-Balken. wert(anteil) liefert den Text rechts. */
  function balken(c, x, y, w, anteil, titel, wert, fs, t) {
    var h = 6;
    var farbe = anteil >= 1 ? F.rot : anteil > 0.72 ? F.orange : F.eis;
    c.font = (fs - 3) + 'px ' + MONO;
    c.textBaseline = 'bottom';
    c.textAlign = 'left';
    c.fillStyle = F.leise;
    c.fillText(titel, x, y - 4);
    c.textAlign = 'right';
    if (anteil >= 1) {
      c.save();
      c.globalAlpha = 0.55 + 0.45 * Math.abs(Math.sin(t * 5));
      c.fillStyle = F.rot;
      c.fillText('LEER', x + w, y - 4);
      c.restore();
    } else {
      c.fillStyle = F.text;
      c.fillText(wert(anteil), x + w, y - 4);
    }
    rund(c, x, y, w, h, 3);
    c.fillStyle = 'rgba(255,255,255,.07)';
    c.fill();
    if (anteil > 0) {
      rund(c, x, y, Math.max(h, w * Math.min(1, anteil)), h, 3);
      c.fillStyle = farbe;
      c.fill();
    }
  }

  function stempel(c, x, y, fs, alpha) {
    c.save();
    c.translate(x, y);
    c.rotate(-0.06);
    c.globalAlpha = alpha;
    c.font = '800 ' + (fs + 1) + 'px ' + MONO;
    var text = 'KONTINGENT LEER';
    var tw = c.measureText(text).width;
    rund(c, -tw / 2 - 10, -fs * 0.9, tw + 20, fs * 1.8, 6);
    c.fillStyle = 'rgba(255,95,107,.12)';
    c.fill();
    c.strokeStyle = F.rot;
    c.lineWidth = 1.5;
    c.stroke();
    c.fillStyle = F.rot;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(text, 0, 1);
    c.restore();
  }

  function schrift(w) { return klemme(w / 58, 10.5, 13); }

  /* ------------------------------------------------------ Szene: Einstieg */

  function szeneStart(c, w, h, t) {
    var mx = w / 2, my = h / 2;
    var maxR = Math.sqrt(w * w + h * h) * 0.55;
    c.lineWidth = 1;
    for (var i = 0; i < 3; i++) {
      var f = (t * 0.35 + i / 3) % 1;
      c.beginPath();
      c.arc(mx, my, 40 + f * maxR, 0, Math.PI * 2);
      c.strokeStyle = 'rgba(240,180,41,' + (0.16 * (1 - f)).toFixed(3) + ')';
      c.stroke();
    }
    for (var j = 0; j < 14; j++) {
      var y = h * (0.08 + 0.84 * j / 13);
      var links = j % 2 === 0;
      var tempo = 0.35 + (j * 37 % 10) / 30;
      var f2 = (t * tempo + j * 0.13) % 1;
      var x = links ? f2 * mx * 0.9 : w - f2 * mx * 0.9;
      var len = 18 + (j * 13 % 20);
      c.globalAlpha = Math.sin(f2 * Math.PI);
      c.strokeStyle = j % 3 === 0 ? 'rgba(240,180,41,.4)' : 'rgba(159,211,255,.25)';
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + (links ? -len : len), y);
      c.stroke();
    }
    c.globalAlpha = 1;
  }

  /* -------------------------------------------------------- Szene: Vorher */

  function szeneVorher(c, w, h, t) {
    var fs = schrift(w);
    var hoch = hochkant(w, h);
    var nw, nh, mitte, A, B, C;
    if (hoch) {
      nw = klemme(w * 0.2, 54, 90);
      nh = nw * 0.7;
      mitte = Math.max(nw / 2 + 26, w * 0.24);
      var luft = Math.max(28, (h - 72 - 3 * nh) / 2);
      A = { x: mitte - nw / 2, y: 24, w: nw, h: nh };
      B = { x: mitte - nw / 2, y: 24 + nh + luft, w: nw, h: nh };
      C = { x: mitte - nw / 2, y: 24 + 2 * (nh + luft), w: nw, h: nh };
    } else {
      nw = klemme(Math.min(w * 0.19, h * 0.4), 60, 140);
      nh = nw * 0.66;
      mitte = klemme(h * 0.42, nh / 2 + fs * 3.2, h);
      A = { x: Math.max(6, w * 0.13 - nw / 2), y: mitte - nh / 2, w: nw, h: nh };
      B = { x: w * 0.5 - nw / 2, y: mitte - nh / 2, w: nw, h: nh };
      C = { x: Math.min(w - 6 - nw, w * 0.87 - nw / 2), y: mitte - nh / 2, w: nw, h: nh };
    }
    var P = achse(hoch);
    var anf = function (k) { return hoch ? k.y : k.x; };
    var ende = function (k) { return hoch ? k.y + k.h : k.x + k.w; };
    var vor = hoch ? [0, 1] : [1, 0], zurueck = hoch ? [0, -1] : [-1, 0];
    var qHin = mitte - 7, qHer = mitte + 7;

    /* Ein Monat im Zeitraffer: acht Sekunden. Upstash ist nach 4,8 s
       leer, Netlify nach 5,4 s - danach prallt jedes Paket ab. */
    var T = 8, tc = t % T;
    var leerB = 5.4, leerC = 4.8;
    var blende = tc > 7.4 ? (T - tc) / 0.6 : tc < 0.4 ? tc / 0.4 : 1;
    var eisHalb = 'rgba(159,211,255,.6)';

    spur(c, P(ende(A), qHin), P(anf(B), qHin), F.eis, t);
    spur(c, P(ende(B), qHin), P(anf(C), qHin), F.eis, t);
    spur(c, P(anf(C), qHer), P(ende(B), qHer), F.eis, t);
    spur(c, P(anf(B), qHer), P(ende(A), qHer), F.eis, t);
    spitze(c, P(anf(B) - 3, qHin), vor, eisHalb);
    spitze(c, P(anf(C) - 3, qHin), vor, eisHalb);
    spitze(c, P(ende(B) + 3, qHer), zurueck, eisHalb);
    spitze(c, P(ende(A) + 3, qHer), zurueck, eisHalb);

    var a0 = ende(A), a1 = anf(C);
    var dauer = 2.6;
    var sB = (anf(B) - a0) / (a1 - a0);
    function abprall(a, seit) {
      var al = (1 - seit / 0.7) * blende;
      var p = P(a - 7, qHin), x = P(a - 7, qHin - 13);
      paket(c, p[0], p[1], F.rot, al, '', fs, hoch);
      kreuz(c, x[0], x[1], al);
    }
    pakete(tc, 0.42, dauer + 0.8).forEach(function (p) {
      var s = p.alter / dauer;
      var tB = p.start + sB * dauer;
      var tC = p.start + dauer;
      if (tB >= leerB && tc >= tB) { abprall(anf(B), tc - tB); return; }
      if (tB < leerB && tC >= leerC && tc >= tC) { abprall(anf(C), tc - tC); return; }
      if (s > 1) return;
      var q = P(a0 + (a1 - a0) * s, qHin);
      paket(c, q[0], q[1], F.eis, blende, p.k % 3 === 0 ? OPS[p.k % OPS.length] : '', fs, hoch);
    });
    pakete(tc, 0.42, dauer, 0.2).forEach(function (p) {
      if (p.start >= leerC) return;          // Upstash antwortet nicht mehr
      var s = p.alter / dauer;
      if (s > 1) return;
      var q = P(a1 - (a1 - a0) * s, qHer);
      paket(c, q[0], q[1], F.eis, 0.75 * blende, '', fs, hoch);
    });

    var vollB = tc >= leerB, vollC = tc >= leerC;
    knoten(c, A);
    knoten(c, B, vollB ? F.rot : null);
    knoten(c, C, vollC ? F.rot : null);
    var g = nh * 0.52;
    symbol(c, 'geraet', A.x + A.w / 2, A.y + A.h / 2, g, F.leise);
    symbol(c, 'wolke', B.x + B.w / 2, B.y + B.h / 2, g * 1.2, vollB ? F.rot : F.leise);
    symbol(c, 'datenbank', C.x + C.w / 2, C.y + C.h / 2, g, vollC ? F.rot : F.leise);
    beschriftung(c, A, 'Dein Gerät', 'iPad · Handy · PC', fs, null, hoch);
    beschriftung(c, B, 'Netlify', 'Seite + Server', fs, null, hoch);
    beschriftung(c, C, 'Upstash', 'Spielerwelt', fs, null, hoch);

    /* Die Balken: breit unter den Knoten, hochkant rechts neben ihnen. */
    var anteil = function (leer) { return Math.min(1, Math.pow(tc / leer, 1.45)); };
    var mw, mB, mC;
    if (hoch) {
      var mx = A.x + A.w + 14;
      mw = Math.min(190, w - mx - 12);
      mB = [mx, B.y + B.h / 2 + fs + 24];
      mC = [mx, C.y + C.h / 2 + fs + 24];
    } else {
      mw = Math.min(nw * 1.35, (C.x - B.x) - 16);
      var my = mitte + nh / 2 + 2 * fs + 30;
      mB = [B.x + B.w / 2 - mw / 2, my];
      mC = [C.x + C.w / 2 - mw / 2, my];
    }
    c.save();
    c.globalAlpha = blende;
    balken(c, mB[0], mB[1], mw, anteil(leerB), 'LAUFZEIT',
      function (a) { return Math.round(a * 100) + ' %'; }, fs, t);
    balken(c, mC[0], mC[1], mw, anteil(leerC), 'BEFEHLE',
      function (a) {
        return mw > 150 ? Math.round(a * 500000).toLocaleString('de-DE') + ' / 500.000'
          : Math.round(a * 100) + ' %';
      }, fs, t);
    if (vollB) {
      var sx = hoch ? (A.x + A.w + 14 + w) / 2 : (B.x + C.x + C.w) / 2;
      var sy = hoch ? (A.y + A.h + B.y) / 2 : Math.max(fs * 1.4, mitte - nh / 2 - fs * 1.7 - 6);
      stempel(c, sx, sy, fs, (0.7 + 0.3 * Math.sin(tc * 8)) * blende);
    }
    c.restore();
  }

  /* --------------------------------------------------------- Szene: Jetzt */

  function szeneJetzt(c, w, h, t) {
    var fs = schrift(w);
    var hoch = hochkant(w, h);
    var nw, nh, sw, sh, mitte, A, I, S;
    if (hoch) {
      nw = klemme(w * 0.2, 54, 90);
      nh = nw * 0.7;
      sw = klemme(w * 0.66, 150, 240);
      sh = sw * 0.58;
      mitte = w / 2;
      var unten = 2 * fs + 44;       // Beschriftung und Balken unter dem Server
      var luft = Math.max(26, (h - 40 - 2 * nh - sh - unten) / 2);
      A = { x: mitte - nw / 2, y: 20, w: nw, h: nh };
      I = { x: mitte - nw / 2, y: 20 + nh + luft, w: nw, h: nh };
      S = { x: mitte - sw / 2, y: 20 + 2 * nh + 2 * luft, w: sw, h: sh };
    } else {
      nw = klemme(Math.min(w * 0.17, h * 0.36), 56, 120);
      nh = nw * 0.66;
      sw = klemme(Math.min(w * 0.3, h * 0.62), 104, 220);
      sh = sw * 0.72;
      mitte = klemme(h * 0.42, sh / 2 + fs, h);
      A = { x: Math.max(6, w * 0.12 - nw / 2), y: mitte - nh / 2, w: nw, h: nh };
      I = { x: w * 0.42 - nw / 2, y: mitte - nh / 2, w: nw, h: nh };
      S = { x: Math.min(w - 6 - sw, w * 0.8 - sw / 2), y: mitte - sh / 2, w: sw, h: sh };
    }
    var P = achse(hoch);
    var anf = function (k) { return hoch ? k.y : k.x; };
    var ende = function (k) { return hoch ? k.y + k.h : k.x + k.w; };
    var vor = hoch ? [0, 1] : [1, 0], zurueck = hoch ? [0, -1] : [-1, 0];
    var qHin = mitte - 7, qHer = mitte + 7;
    var goldHalb = 'rgba(240,180,41,.7)';

    spur(c, P(ende(A), qHin), P(anf(I), qHin), F.gold, t * 1.6);
    spur(c, P(ende(I), qHin), P(anf(S), qHin), F.gold, t * 1.6);
    spur(c, P(anf(S), qHer), P(ende(I), qHer), F.gold, t * 1.6);
    spur(c, P(anf(I), qHer), P(ende(A), qHer), F.gold, t * 1.6);
    spitze(c, P(anf(I) - 3, qHin), vor, goldHalb);
    spitze(c, P(anf(S) - 3, qHin), vor, goldHalb);
    spitze(c, P(ende(I) + 3, qHer), zurueck, goldHalb);
    spitze(c, P(ende(A) + 3, qHer), zurueck, goldHalb);

    var a0 = ende(A), a1 = anf(S);
    var dauer = 1.3, innen = 0.36;
    var reihe = [0, 0, 0];   // wie hell jede Zeile im Server gerade ist
    pakete(t, 0.21, dauer + innen).forEach(function (p) {
      var s = p.alter / dauer;
      if (s <= 1) {
        var q = P(a0 + (a1 - a0) * s, qHin);
        paket(c, q[0], q[1], F.gold, 1, p.k % 3 === 0 ? OPS[p.k % OPS.length] : '', fs, hoch);
      } else {
        var z = (p.alter - dauer) / innen;
        var r = Math.min(2, Math.floor(z * 3));
        reihe[r] = Math.max(reihe[r], 1 - (z * 3 - r));
      }
    });
    pakete(t, 0.21, dauer, 0.1).forEach(function (p) {
      var s = p.alter / dauer;
      if (s > 1) return;
      var q = P(a1 - (a1 - a0) * s, qHer);
      paket(c, q[0], q[1], F.gold, 0.7, '', fs, hoch);
    });

    knoten(c, A);
    knoten(c, I);
    symbol(c, 'geraet', A.x + A.w / 2, A.y + A.h / 2, nh * 0.52, F.leise);
    symbol(c, 'globus', I.x + I.w / 2, I.y + I.h / 2, nh * 0.6, F.leise);
    beschriftung(c, A, 'Dein Gerät', 'iPad · Handy · PC', fs, null, hoch);
    beschriftung(c, I, 'Internet', 'HTTPS', fs, null, hoch);

    /* Der eigene Server: drei Stufen, die aufleuchten, wenn ein Paket
       durchlaeuft - Caddy nimmt an, der Server rechnet, Redis merkt. */
    knoten(c, S, 'rgba(240,180,41,.45)');
    var pad = 9, rh = (S.h - pad * 2) / 3;
    var namen = ['CADDY · HTTPS', 'SERVER', 'REDIS · WELT'];
    for (var i = 0; i < 3; i++) {
      var ry = S.y + pad + i * rh;
      if (i > 0) {
        c.beginPath();
        c.moveTo(S.x + 8, ry + 0.5);
        c.lineTo(S.x + S.w - 8, ry + 0.5);
        c.strokeStyle = 'rgba(255,255,255,.06)';
        c.lineWidth = 1;
        c.stroke();
      }
      var hell = reihe[i];
      c.beginPath();
      c.arc(S.x + 16, ry + rh / 2, 3.2, 0, Math.PI * 2);
      c.fillStyle = hell > 0.02 ? 'rgba(240,180,41,' + (0.35 + 0.65 * hell).toFixed(3) + ')' : 'rgba(240,180,41,.22)';
      c.fill();
      c.font = (fs - 2.5) + 'px ' + MONO;
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.fillStyle = hell > 0.3 ? F.text : F.leise;
      c.fillText(namen[i], S.x + 27, ry + rh / 2 + 0.5);
    }
    beschriftung(c, S, 'Eigener Server', 'gehört uns', fs, F.gold);

    /* Das Kontingent, das nie voll wird: ein Glanz laeuft durch. */
    var mw = Math.min(S.w, w - S.x - 6);
    var mx = S.x + S.w / 2 - mw / 2;
    var my = S.y + S.h + 2 * fs + 30;
    c.font = (fs - 3) + 'px ' + MONO;
    c.textBaseline = 'bottom';
    c.textAlign = 'left';
    c.fillStyle = F.leise;
    c.fillText('KONTINGENT', mx, my - 4);
    c.textAlign = 'right';
    c.fillStyle = F.gold;
    c.fillText('∞  KEIN LIMIT', mx + mw, my - 4);
    rund(c, mx, my, mw, 6, 3);
    c.fillStyle = 'rgba(240,180,41,.12)';
    c.fill();
    var gx = mx + ((t * 0.45) % 1.4 - 0.2) * mw;
    var glanz = c.createLinearGradient(gx - 40, 0, gx + 40, 0);
    glanz.addColorStop(0, 'rgba(240,180,41,0)');
    glanz.addColorStop(0.5, 'rgba(240,180,41,.85)');
    glanz.addColorStop(1, 'rgba(240,180,41,0)');
    c.save();
    rund(c, mx, my, mw, 6, 3);
    c.clip();
    c.fillStyle = glanz;
    c.fillRect(gx - 40, my, 80, 6);
    c.restore();
  }

  /* ------------------------------------------------------ Szene: Vorteile */

  function szeneVorteile(c, w, h, t) {
    var n = Math.max(6, Math.round(w / 70));
    for (var i = 0; i < n; i++) {
      var x = (i + 0.5) * w / n;
      var dauer = 3.2 + (i * 7 % 5) * 0.4;
      pakete(t, 1.1 + (i % 3) * 0.35, dauer, i * 0.37).forEach(function (p) {
        var s = p.alter / dauer;
        if (s > 1) return;
        paket(c, x, h + 10 - s * (h + 20), F.gold, 0.18 * Math.sin(s * Math.PI));
      });
    }
  }

  /* ============================================================ Ablauf */

  function ruhigGewuenscht() {
    try {
      if (SG.settings.get('reduced')) return true;
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { return false; }
  }

  function gesehen() {
    try { return !!SG.storage.get(SCHLUESSEL, null); } catch (e) { return false; }
  }

  function merken() {
    try { SG.storage.set(SCHLUESSEL, Date.now()); } catch (e) { /* egal */ }
  }

  function imVerhoer() {
    return !!(SG.verhoer && SG.verhoer.eigenePerson && SG.verhoer.eigenePerson());
  }

  /* Nach der Anmeldung: einmal je Person, und nur im Hub - wer direkt in
     ein Spiel springt, bekommt es beim ersten Blick auf den Hub. */
  U.vielleicht = function () {
    if (SG.offline || !SG.assets || !SG.assets['ui-louis']) return;
    if (!SG.auth.aktuell || gesehen()) return;

    function imHub() { return SG.router.parse().kind === 'hub'; }
    function spaeter() {
      setTimeout(function () {
        if (!offen && !gesehen() && !imVerhoer() && imHub()) U.zeigen();
      }, 700);
    }
    function aufAdresse() {
      if (!imHub()) return;
      window.removeEventListener('hashchange', aufAdresse);
      spaeter();
    }
    if (imHub()) spaeter();
    else window.addEventListener('hashchange', aufAdresse);
  };

  /* Baut das Intro einmal auf. Eingebettet steht es auf "Über uns" in
     einem Rahmen: ohne Überspringen, am Ende wieder von vorn, und in
     Bewegung nur, solange es zu sehen ist. Sonst liegt es als Vorhang
     über allem, und beiEnde wird beim letzten "Weiter" gerufen. */
  var laufendeNummer = 0;

  function aufbauen(eingebettet, beiEnde) {
    var bild = SG.assets['ui-louis'];
    var st = {
      i: 0, t0: 0, raf: 0, tipp: 0, w: 1, h: 1,
      ruhig: ruhigGewuenscht(), aktiv: false, sichtbar: true,
    };

    /* ---------------------------------------------------- Aufbau */

    var live = UI.el('span.umz-live');
    var punkte = SZENEN.map(function () { return UI.el('i'); });
    var skip = eingebettet ? null : UI.el('button.umz-skip', { type: 'button', text: 'Überspringen' });

    var term = UI.el('div.umz-term', { 'aria-hidden': 'true' });
    var titel = UI.el('h2.umz-titel');
    titel.id = 'umz-titel-' + (++laufendeNummer);
    var satz = UI.el('p.umz-satz');

    var cv = UI.el('canvas.umz-cv', { 'aria-hidden': 'true' });
    var cx = cv.getContext('2d');

    var hero = UI.el('div.umz-hero', null, [
      UI.el('div.umz-foto', null, [
        UI.el('img', { src: bild, alt: 'Louis vor einem Regenbogen im Park' }),
        UI.el('span.umz-badge', { text: 'Live' }),
        UI.el('span.umz-schild', { text: 'Louis · erklärt kurz' }),
      ]),
    ]);

    var liste = UI.el('div.umz-liste', null, [
      UI.el('div.umz-liste-in', null, VORTEILE.map(function (v, k) {
        return UI.el('div.umz-vorteil', { style: { animationDelay: (k * 90) + 'ms' } }, [
          UI.el('span.ic', {
            html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '
              + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[v.ic] + '</svg>',
          }),
          UI.el('div', null, [UI.el('b', { text: v.t }), UI.el('span', { text: v.d })]),
        ]);
      })),
    ]);

    var zitat = UI.el('div.umz-zitat');
    var pip = UI.el('div.umz-pip', null, [
      UI.el('div.umz-pip-bild', null, [UI.el('img', { src: bild, alt: '' })]),
      UI.el('div.umz-pip-text', null, [
        UI.el('div.umz-pip-name', null, [
          UI.el('span', { text: 'Louis' }),
          UI.el('span.umz-welle', { 'aria-hidden': 'true' },
            [UI.el('i'), UI.el('i'), UI.el('i'), UI.el('i')]),
        ]),
        zitat,
      ]),
    ]);
    var weiter = UI.el('button.btn.primary.umz-weiter', { type: 'button', text: 'Weiter' });

    var el = UI.el('div.umz' + (eingebettet ? '.umz-einbett' : '') + (st.ruhig ? '.ruhig' : ''),
      eingebettet
        ? { role: 'region', 'aria-label': 'Präsentation: der Umzug auf den eigenen Server' }
        : { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titel.id },
      [
        UI.el('header.umz-kopf', null, [live, UI.el('div.umz-punkte', null, punkte), skip]),
        UI.el('div.umz-text', null, [term, titel, satz]),
        UI.el('div.umz-buehne', null, [
          cv,
          UI.el('div.umz-ecken', { 'aria-hidden': 'true' },
            [UI.el('span'), UI.el('span'), UI.el('span'), UI.el('span')]),
          hero,
          liste,
        ]),
        UI.el('footer.umz-fuss', null, [pip, weiter]),
      ]);

    /* ---------------------------------------------------- Leinwand */

    function groesse() {
      var r = cv.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, st.ruhig ? 1.25 : 2);
      st.w = Math.max(1, r.width);
      st.h = Math.max(1, r.height);
      var bw = Math.round(st.w * dpr), bh = Math.round(st.h * dpr);
      if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function zeichnen(t) {
      cx.clearRect(0, 0, st.w, st.h);
      cx.save();
      try { SZENEN[st.i].malen(cx, st.w, st.h, t); }
      catch (e) { if (SG.noteError) SG.noteError('umzug', e); }
      cx.restore();
    }

    function schleife() {
      st.raf = 0;
      if (!st.aktiv || !st.sichtbar) return;
      zeichnen((performance.now() - st.t0) / 1000);
      st.raf = requestAnimationFrame(schleife);
    }

    function antreiben() {
      if (st.aktiv && st.sichtbar && !st.ruhig && !st.raf) st.raf = requestAnimationFrame(schleife);
    }

    function aufGroesse() {
      groesse();
      if (st.ruhig) zeichnen(SZENEN[st.i].ruhe);
    }

    /* Eingebettet laeuft die Leinwand nur, solange man sie sieht. */
    var beobachter = null;
    if (eingebettet && typeof IntersectionObserver === 'function') {
      beobachter = new IntersectionObserver(function (eintraege) {
        st.sichtbar = eintraege[eintraege.length - 1].isIntersecting;
        if (!st.sichtbar) return;
        aufGroesse();
        antreiben();
      });
    }

    /* ---------------------------------------------------- Terminal */

    function tippen(zeilen) {
      var token = ++st.tipp;
      term.textContent = '';
      var zi = 0;
      function naechste() {
        if (token !== st.tipp || zi >= zeilen.length) return;
        var z = zeilen[zi++];
        var befehl = UI.el('span.umz-cmd');
        var ok = UI.el('span.umz-ok');
        var caret = UI.el('span.umz-caret');
        term.appendChild(UI.el('div.umz-zeile', null, [UI.el('span.umz-prompt', { text: '>' }), befehl, ok, caret]));
        var text = ' ' + z[0];
        if (st.ruhig) {
          befehl.textContent = text;
          ok.textContent = ' … ' + z[1];
          caret.remove();
          naechste();
          return;
        }
        var n = 0;
        (function schritt() {
          if (token !== st.tipp) return;
          n++;
          befehl.textContent = text.slice(0, n);
          if (n < text.length) { setTimeout(schritt, 22); return; }
          setTimeout(function () {
            if (token !== st.tipp) return;
            ok.textContent = ' … ' + z[1];
            if (zi < zeilen.length) caret.remove();
            setTimeout(naechste, 240);
          }, 320);
        })();
      }
      naechste();
    }

    /* ---------------------------------------------------- Szenen */

    function szene(i, fokus) {
      st.i = i;
      st.t0 = performance.now();
      var s = SZENEN[i];
      live.textContent = s.tag;
      punkte.forEach(function (p, k) { p.classList.toggle('an', k <= i); });
      hero.hidden = i !== 0;
      liste.hidden = !s.liste;
      term.hidden = !s.terminal;
      if (s.terminal) tippen(s.terminal);
      else { st.tipp++; term.textContent = ''; }
      titel.textContent = s.titel;
      titel.classList.remove('glitch');
      void titel.offsetWidth;
      titel.classList.add('glitch');
      satz.textContent = s.satz || '';
      satz.hidden = !s.satz;
      pip.hidden = !s.zitat;
      if (s.zitat) {
        zitat.textContent = '„' + s.zitat + '“';
        pip.classList.remove('rein');
        void pip.offsetWidth;
        pip.classList.add('rein');
      }
      var letzte = i === SZENEN.length - 1;
      weiter.textContent = letzte ? (eingebettet ? 'Von vorn' : s.weiter) : 'Weiter';
      groesse();
      if (st.ruhig) zeichnen(s.ruhe);
      if (fokus) {
        try { weiter.focus({ preventScroll: true }); } catch (e) { /* egal */ }
      }
    }

    weiter.addEventListener('click', function () {
      if (SG.audio) SG.audio.play('click');
      if (st.i < SZENEN.length - 1) szene(st.i + 1, true);
      else if (beiEnde) beiEnde();
      else szene(0, true);
    });

    function starten() {
      st.aktiv = true;
      window.addEventListener('resize', aufGroesse);
      if (beobachter) beobachter.observe(el);
      szene(0, !eingebettet);
      antreiben();
    }

    function stoppen() {
      st.aktiv = false;
      if (st.raf) cancelAnimationFrame(st.raf);
      st.raf = 0;
      st.tipp++;
      window.removeEventListener('resize', aufGroesse);
      if (beobachter) beobachter.disconnect();
    }

    return { el: el, skip: skip, starten: starten, stoppen: stoppen };
  }

  U.zeigen = function () {
    if (offen || SG.offline || !SG.assets || !SG.assets['ui-louis']) return;
    var ctl = aufbauen(false, function () { schliessen(true); });
    offen = ctl;

    function schliessen(fertig) {
      if (offen !== ctl) return;
      offen = null;
      if (fertig) merken();
      ctl.stoppen();
      window.removeEventListener('hashchange', aufWeg);
      ctl.el.classList.add('zu');
      setTimeout(function () { if (ctl.el.parentNode) ctl.el.parentNode.removeChild(ctl.el); }, 320);
      if (SG.kulisse && SG.kulisse.ruhen) SG.kulisse.ruhen(SG.router.parse().kind === 'game');
    }

    /* Muss jemand anderswohin (etwa in eine Befragung), geht das Intro
       zu, ohne als gesehen zu gelten. */
    function aufWeg() {
      if (SG.router.parse().kind !== 'hub') schliessen(false);
    }

    ctl.skip.addEventListener('click', function () { schliessen(true); });
    document.body.appendChild(ctl.el);
    if (SG.kulisse && SG.kulisse.ruhen) SG.kulisse.ruhen(true);
    window.addEventListener('hashchange', aufWeg);
    ctl.starten();
  };

  /* Fuer "Über uns": dasselbe Intro in einem Rahmen. Liefert ein Objekt mit
     destroy() fuer den Router; offline gibt es nichts einzubetten. */
  U.einbetten = function (host) {
    if (SG.offline || !SG.assets || !SG.assets['ui-louis']) return null;
    var ctl = aufbauen(true, null);
    host.appendChild(ctl.el);
    ctl.starten();
    return { destroy: ctl.stoppen };
  };
})(SG);
