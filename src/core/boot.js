/* ------------------------------------------------------------------
   Start. Diese Datei wird als letzte gebuendelt - hier sind alle
   Spiele bereits registriert.
   ------------------------------------------------------------------ */

(function (SG) {
  var UI = SG.ui;

  function hideSplash() {
    // Der Dateien-Modus (Spiele ohne Skripte) wird nicht mehr gebraucht,
    // sobald wir hier ankommen - er darf raus.
    var n = document.getElementById('sg-nojs');
    if (n && n.parentNode) n.parentNode.removeChild(n);

    var s = document.getElementById('sg-boot');
    if (!s) return;
    s.classList.add('gone');
    setTimeout(function () { if (s.parentNode) s.parentNode.removeChild(s); }, 320);
  }

  function iosHardening() {
    // Zwei-Finger-Zoom und Doppeltipp-Zoom unterbinden (iPadOS ignoriert
    // user-scalable=no in neueren Versionen).
    ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (n) {
      document.addEventListener(n, function (e) { e.preventDefault(); }, { passive: false });
    });

    var lastTouch = 0;
    document.addEventListener('touchend', function (e) {
      var now = Date.now();
      if (now - lastTouch <= 320) e.preventDefault();
      lastTouch = now;
    }, { passive: false });

    // Kein Gummiband-Scrollen ausserhalb scrollbarer Bereiche
    document.addEventListener('touchmove', function (e) {
      var el = e.target;
      while (el && el !== document.body) {
        if (el.scrollHeight > el.clientHeight + 1) {
          var style = window.getComputedStyle(el).overflowY;
          if (style === 'auto' || style === 'scroll') return;
        }
        el = el.parentNode;
      }
      if (e.cancelable) e.preventDefault();
    }, { passive: false });
  }

  function unlockAudioOnce() {
    var fn = function () {
      SG.settings.gestured = true;
      SG.audio.unlock();
      document.removeEventListener('pointerdown', fn);
      document.removeEventListener('touchstart', fn);
    };
    document.addEventListener('pointerdown', fn);
    document.addEventListener('touchstart', fn);
  }

  function start() {
    var app = document.getElementById('app');
    if (!app) return;

    SG.settings._apply();
    iosHardening();
    unlockAudioOnce();

    if (SG.selftest.wanted()) {
      hideSplash();
      SG.selftest.run({ steps: SG.selftest.steps() || undefined }).then(function (r) {
        console.log('Selbsttest:', r.passed + '/' + r.total + ' bestanden');
      });
      return;
    }

    /* Die Kulisse liegt hinter allem und ist schon vor der Tuer da -
       die Kugel soll gleich beim ersten Blick stehen. */
    SG.kulisse.start();

    /* Die Tarnung wird als Erstes gebaut. Sie muss auch dann schon
       liegen koennen, wenn noch niemand angemeldet ist. */
    SG.tarnung.starten();

    /* Die Tuer vor dem Hub. Es gibt kein Fortsetzen mehr: der Code wird
       bei jedem Seitenaufruf neu verlangt (siehe auth.js). Innerhalb
       der Seite - Kachel antippen, ins Spiel und zurueck - passiert
       nichts, weil dabei nicht neu geladen wird.

       Vorher wird die Verwaltung einmal geholt, denn die Sperrliste
       muss vor der Codeeingabe dasein. Damit die Tuer bei lahmem Netz
       nicht wartet, laeuft daneben eine kurze Uhr. */
    SG.auth.fortsetzen();
    hideSplash();

    var getuert = false;
    function tuerAuf() {
      if (getuert) return;
      getuert = true;
      /* Schon vor der Tuer lauschen: die Tuer selbst braucht die
         Verbindung, um Fehlversuche zu melden und zu erfahren, ob der
         Dienst dieses Geraet wieder freigegeben hat. */
      SG.verwaltung.starten();
      SG.gate.render(app, function () {
        SG.wache.starten();
        SG.spiegel.starten();
        SG.verhoer.alarmWachen();
        SG.ansage.pruefen();
        SG.router.init(app);
        console.log('%c' + SG.name, 'color:#f0b429;font-weight:700',
          '· angemeldet als ' + (SG.auth.aktuell.name || SG.auth.aktuell.code));
      });
    }

    SG.verwaltung.laden().then(tuerAuf, tuerAuf);
    setTimeout(tuerAuf, 2500);

    console.log('%c' + SG.name, 'color:#f0b429;font-weight:700',
      '· ' + SG.list().length + ' Spiele · Version ' + SG.version +
      (SG.offline ? ' · Offline' : ''));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})(SG);
