/* ------------------------------------------------------------------
   Die Kroenung.

   Einmal, im Augenblick, in dem ein neuer Owner feststeht: der
   Lichtschacht faehrt herunter, die Krone faellt und federt ein, das
   Siegel zeichnet sich herum, der Name laeuft aus der Sperrung
   zusammen. Rund viereinhalb Sekunden; Tippen bricht sofort ab.

   Sie laeuft bei dem, der die Ernennung ausspricht, und nur dann - es
   ist kein Zustand, der irgendwo gemerkt wuerde, sondern die Antwort
   auf eine Handlung. Beim Oeffnen des Reiters passiert nichts.

   Der Ton kommt aus SG.audio und damit wie alles andere aus
   Oszillatoren: whoosh zum Schacht, thud und power zum Aufschlag, win
   zur Fanfare. Keine Tondateien.

   Das Bild steht in styles/kroenung.css. Hier liegt nur der Ablauf.
   ------------------------------------------------------------------ */

(function (SG) {
  var UI = SG.ui;

  var K = SG.kroenung = {};

  /* Die Zeitpunkte aus dem Stylesheet, in Millisekunden. Sie stehen
     hier ein zweites Mal, weil Ton und Funken sich nicht an eine
     CSS-Animation haengen lassen. Wer am Stylesheet dreht, dreht auch
     hier. */
  var T_SCHACHT = 300;
  var T_AUFSCHLAG = 1400;
  var T_FANFARE = 2500;
  var T_ENDE = 3900;
  var T_ENDE_RUHIG = 2600;
  var T_AUSBLENDEN = 500;

  var offen = null;

  /* Wie beim Umzugs-Intro: die Einstellung der Seite und der Wunsch
     des Geraets zaehlen beide. */
  function ruhigGewuenscht() {
    try {
      if (SG.settings.get('reduced')) return true;
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { return false; }
  }

  function ton(name) {
    try { SG.audio.play(name); } catch (e) { /* ohne Ton geht es auch */ }
  }

  /* ------------------------------------------------------------------
     Die Funken

     Ein Ausbruch aus der Mitte, rein aus der Zeit gerechnet: es gibt
     keinen Zustand, der weglaufen koennte, und jedes Standbild ist ein
     gueltiges Bild. Die Leinwand raeumt sich selbst ab, sobald der
     letzte Funke aus ist.
     ------------------------------------------------------------------ */

  function funken(cv, start) {
    var cx = cv.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    /* Vor dem ersten Anstrich kann die Leinwand noch keine Groesse
       haben - dann gilt das Fenster. */
    var w = cv.clientWidth || window.innerWidth || 320;
    var h = cv.clientHeight || window.innerHeight || 480;
    var raf = 0;
    var teilchen = null;

    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);

    function saen() {
      teilchen = [];
      for (var i = 0; i < 38; i++) {
        var a = Math.random() * Math.PI * 2;
        var v = 62 + Math.random() * 210;
        teilchen.push({
          x: w / 2, y: h / 2,
          vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40,
          r: 1.1 + Math.random() * 2.4,
          leben: 0.75 + Math.random() * 0.7,
        });
      }
    }

    function bild(t) {
      var dt = 1 / 60;
      cx.clearRect(0, 0, w, h);
      if (t < start) { raf = requestAnimationFrame(bild); return; }
      if (!teilchen) saen();
      var lebt = false;
      for (var i = 0; i < teilchen.length; i++) {
        var p = teilchen[i];
        p.leben -= dt;
        if (p.leben <= 0) continue;
        lebt = true;
        p.vy += 210 * dt;             /* Schwerkraft */
        p.vx *= 0.975; p.vy *= 0.975; /* Luft */
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        cx.globalAlpha = Math.max(0, Math.min(1, p.leben * 1.5));
        cx.fillStyle = p.r > 2.2 ? '#ffd166' : '#f0b429';
        cx.beginPath();
        cx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        cx.fill();
      }
      cx.globalAlpha = 1;
      if (lebt || !teilchen) raf = requestAnimationFrame(bild);
    }

    raf = requestAnimationFrame(bild);
    return function () { cancelAnimationFrame(raf); };
  }

  /* ------------------------------------------------------------------
     Der Auftritt

     o.name    wer gekroent wird
     fertig    wird einmal gerufen, wenn das Bild weg ist - egal ob
               abgewartet oder uebersprungen
     ------------------------------------------------------------------ */

  K.zeigen = function (o, fertig) {
    o = o || {};
    function schluss() { if (fertig) { var f = fertig; fertig = null; f(); } }
    if (offen) { schluss(); return; }

    var ruhig = ruhigGewuenscht();
    var uhren = [];
    function spaeter(ms, f) { uhren.push(setTimeout(f, ms)); }

    var el = UI.el('div.kr' + (ruhig ? '.ruhig' : ''), { role: 'status' });
    el.innerHTML = ''
      + '<canvas class="kr-cv" aria-hidden="true"></canvas>'
      + '<div class="kr-blitz" aria-hidden="true"></div>'
      + '<div class="kr-mitte" aria-hidden="true">'
        + '<div class="kr-horizont"></div>'
        + '<div class="kr-schacht"></div>'
        + '<div class="kr-welle"></div>'
        + '<div class="kr-welle zwei"></div>'
        + '<svg class="kr-siegel" viewBox="0 0 220 220">'
          + '<defs><path id="kr-bogen" fill="none"'
            + ' d="M110,110 m-76,0 a76,76 0 1,1 152,0"></path></defs>'
          + '<circle class="striche" cx="110" cy="110" r="96"></circle>'
          + '<circle class="bahn" cx="110" cy="110" r="100"></circle>'
          + '<text><textPath href="#kr-bogen" startOffset="50%"'
            + ' text-anchor="middle">GS-CEO-01</textPath></text>'
        + '</svg>'
        + '<div class="kr-krone">👑</div>'
      + '</div>'
      + '<div class="kr-text">'
        + '<p class="kr-name"></p>'
        + '<div class="kr-rang"><i></i><span>CHIEF EXECUTIVE OFFICER</span><i></i></div>'
      + '</div>'
      + '<div class="kr-fuss">GESCHÄFTSFÜHRUNG ÜBERTRAGEN</div>'
      + '<button class="kr-skip" type="button">Überspringen</button>';

    /* Der Name kommt von einer Person und wird deshalb gesetzt, nicht
       in die Vorlage geschrieben. */
    el.querySelector('.kr-name').textContent = o.name || 'Ohne Namen';

    document.body.appendChild(el);
    offen = el;

    var stopFunken = ruhig
      ? null
      : funken(el.querySelector('.kr-cv'), performance.now() + T_AUFSCHLAG);

    if (!ruhig) {
      spaeter(T_SCHACHT, function () { ton('whoosh'); });
      spaeter(T_AUFSCHLAG, function () { ton('thud'); });
      spaeter(T_AUFSCHLAG + 90, function () { ton('power'); });
    }
    spaeter(ruhig ? 260 : T_FANFARE, function () { ton('win'); });
    spaeter(ruhig ? T_ENDE_RUHIG : T_ENDE, schliessen);

    function schliessen() {
      uhren.forEach(function (u) { clearTimeout(u); });
      uhren.length = 0;
      if (!el.parentNode) { schluss(); return; }
      el.classList.add('zu');
      setTimeout(function () {
        if (stopFunken) stopFunken();
        UI.remove(el);
        if (offen === el) offen = null;
        schluss();
      }, T_AUSBLENDEN);
    }

    el.addEventListener('click', schliessen);
  };
})(SG);
