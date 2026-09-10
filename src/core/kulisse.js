/* ------------------------------------------------------------------
   Die Kulisse.

   Hinter allem dreht sich ein Gehstock in einer Weltkugel. Reine
   Zeichenarbeit auf einer Leinwand - kein Bild, keine Schriftdatei,
   damit die Offline-Einzeldatei ohne externe Verweise bleibt.

   Die Kugel besteht aus zwei Sorten Linien:

     Breitengrade  liegen fest. Unter der Drehung um die eigene Achse
                   aendern sie sich nicht, also werden sie einmal
                   gerechnet und bleiben so stehen.
     Laengengrade  sind Ellipsen, deren Breite mit der Drehung atmet
                   (r * sin). Genau daher kommt der Eindruck, dass
                   sich die Kugel dreht - mehr steckt nicht dahinter.

   Der Stock in der Mitte dreht sich mit, indem er in der Breite
   gestaucht wird. Ueber die Kante hinaus laeuft er nie, weil er
   kleiner ist als die Kugel.

   Sparsam bleibt das Ganze durch drei Dinge: hoechstens dreissig
   Bilder je Sekunde, eine gedeckelte Pixeldichte und ein Ruhezustand,
   sobald ein Spiel laeuft oder die Seite im Hintergrund liegt. Wer
   "Reduzierte Effekte" anhat, bekommt ein einziges stehendes Bild.
   ------------------------------------------------------------------ */

(function (SG) {
  var G = SG.gfx;

  var K = SG.kulisse = {};

  var cv = null, c = null;
  var w = 0, h = 0, dpr = 1;
  var raf = 0, letztes = 0, t = 0;
  var ruht = false, versteckt = false, laeuft = false;
  var TAKT = 1000 / 30;

  function reduziert() {
    return !!(SG.settings && SG.settings.get('reduced'));
  }

  /* ---------------------------------------------------------- Aufbau */

  K.start = function () {
    if (cv || typeof document === 'undefined') return;
    cv = document.createElement('canvas');
    cv.id = 'sg-kulisse';
    cv.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(cv, document.body.firstChild);
    c = cv.getContext('2d');

    messen();
    window.addEventListener('resize', messen);
    document.addEventListener('visibilitychange', sichtbarkeit);
    window.addEventListener('hgh:tarnung', tarnung);
    if (SG.settings && SG.settings.on) SG.settings.on('change:reduced', neuStarten);

    neuStarten();
  };

  /* Ruhen heisst: stehenbleiben, nicht verschwinden. Waehrend eines
     Spiels liegt ohnehin ein voller Bildschirm darueber - da kostet
     jedes weitere Bild nur Akku. */
  K.ruhen = function (an) {
    an = !!an;
    if (ruht === an) return;
    ruht = an;
    pruefen();
  };

  K.stop = function () {
    if (!cv) return;
    anhalten();
    window.removeEventListener('resize', messen);
    document.removeEventListener('visibilitychange', sichtbarkeit);
    window.removeEventListener('hgh:tarnung', tarnung);
    if (cv.parentNode) cv.parentNode.removeChild(cv);
    cv = null; c = null;
  };

  function sichtbarkeit() { versteckt = !!document.hidden; pruefen(); }
  function tarnung(e) { versteckt = !!(e && e.detail) || !!document.hidden; pruefen(); }

  function neuStarten() {
    anhalten();
    if (reduziert()) { zeichnen(0); return; }
    pruefen();
  }

  function pruefen() {
    if (reduziert()) return;
    if (ruht || versteckt) anhalten();
    else los();
  }

  function los() {
    if (laeuft || !c) return;
    laeuft = true;
    letztes = 0;
    raf = requestAnimationFrame(bild);
  }

  function anhalten() {
    laeuft = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function bild(zeit) {
    if (!laeuft) return;
    raf = requestAnimationFrame(bild);
    if (!letztes) letztes = zeit;
    var dt = zeit - letztes;
    if (dt < TAKT) return;               // hoechstens dreissig Bilder
    letztes = zeit;
    t += Math.min(dt, 100) / 1000;
    zeichnen(t);
  }

  function messen() {
    if (!cv) return;
    /* Die Kulisse liegt weit hinten - hier reicht wenig Pixeldichte,
       und auf dem iPad spart genau das am meisten. */
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    w = Math.max(1, window.innerWidth);
    h = Math.max(1, window.innerHeight);
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    cv.style.width = w + 'px';
    cv.style.height = h + 'px';
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!laeuft) zeichnen(t);
  }

  /* ---------------------------------------------------------- Bild */

  function zeichnen(zeit) {
    if (!c) return;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);

    var cx = w / 2;
    var cy = h * 0.47;
    var R = Math.min(w, h) * (w < 560 ? 0.4 : 0.33);

    /* Ein Hauch Licht hinter der Kugel, sonst schwebt sie im Nichts */
    G.glow(c, cx, cy, R * 1.9, '#f0b429', 0.11);

    kugel(c, cx, cy, R, zeit * 0.28);
    stock(c, cx, cy, R, zeit);
  }

  function kugel(c2, cx, cy, R, dreh) {
    c2.save();
    c2.lineWidth = 1.3;

    /* Rand */
    c2.strokeStyle = 'rgba(240,180,41,.34)';
    c2.beginPath();
    c2.arc(cx, cy, R, 0, 6.283);
    c2.stroke();

    /* Breitengrade - stehen fest, weil die Drehung um die Hochachse
       geht. Die Neigung macht aus dem Kreis eine flache Ellipse. */
    var NEIG = 0.3;
    for (var i = -3; i <= 3; i++) {
      var lat = (i / 4) * (Math.PI / 2);
      var rx = R * Math.cos(lat);
      var y = cy - R * Math.sin(lat) * NEIG * 2.2;
      var ry = Math.max(0.6, rx * NEIG);
      c2.strokeStyle = 'rgba(240,180,41,' + (i === 0 ? 0.26 : 0.15) + ')';
      c2.beginPath();
      c2.ellipse(cx, y, rx, ry, 0, 0, 6.283);
      c2.stroke();
    }

    /* Laengengrade - ihre Breite atmet mit der Drehung. Genau das
       liest das Auge als "die Kugel dreht sich". */
    for (var k = 0; k < 6; k++) {
      var phi = dreh + (k / 6) * Math.PI;
      var breite = Math.abs(Math.sin(phi)) * R;
      if (breite < 1) continue;
      /* Was hinten durchlaeuft, ist blasser als was vorn steht. */
      var vorn = Math.cos(phi) > 0 ? 0.24 : 0.12;
      c2.strokeStyle = 'rgba(240,180,41,' + vorn + ')';
      c2.beginPath();
      c2.ellipse(cx, cy, breite, R, 0, 0, 6.283);
      c2.stroke();
    }
    c2.restore();
  }

  function stock(c2, cx, cy, R, zeit) {
    var dreh = zeit * 0.42;
    /* Stauchen statt drehen: der Stock steht aufrecht und wendet sich
       um die eigene Hochachse. Unter 0.06 bleibt ein schmaler Strich
       stehen, damit er beim Kanten nicht ganz verschwindet. */
    var breit = Math.cos(dreh);
    var q = Math.max(0.06, Math.abs(breit));
    var hoehe = R * 1.15;

    c2.save();
    c2.translate(cx, cy);
    c2.rotate(Math.sin(zeit * 0.22) * 0.06);
    c2.scale(breit < 0 ? -q : q, 1);
    c2.globalAlpha = 0.6;
    G.gehstock(c2, 0, 0, hoehe, {
      dicke: hoehe * 0.085,
      radius: hoehe * 0.19,
      bieg: Math.sin(zeit * 0.5) * hoehe * 0.05,
      color: 'rgba(240,180,41,.7)',
    });
    c2.restore();
  }
})(SG);
