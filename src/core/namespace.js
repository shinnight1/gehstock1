/* ------------------------------------------------------------------
   Globaler Namensraum.
   Alle Dateien tragen sich hier ein - es gibt bewusst keine ES-Module,
   weil WebKit unter file:// keine Modul-Imports zulaesst.
   ------------------------------------------------------------------ */

(function (w) {
  var build = w.SG_BUILD
    || { offline: false, version: 'dev', offlineFile: null, nojs: 0 };

  var SG = w.SG = {
    name: 'Herr Gehstocks Hideout',
    version: build.version,
    offline: !!build.offline,
    offlineFile: build.offlineFile,

    /* Wie viele Spiele der Dateien-Modus mitbringt. Die Zahl kommt aus
       dem Bau, damit kein Text sie noch einmal behaupten muss. */
    nojsSpiele: build.nojs || 0,

    games: {},          // id -> Spieldefinition
    order: [],          // Reihenfolge der Registrierung
    rules: {},          // reine Regel-Engines (auch in Node testbar)
    tycoon: {},         // Tycoon-Module
    errors: [],         // gesammelte Laufzeitfehler

    /* Umgebung */
    env: {
      touch: false,
      file: false,
      standalone: false,
      dpr: 1,
      ios: false,
    },
  };

  /* --- Umgebung erkennen (defensiv, laeuft auch in Node fuer Tests) --- */
  try {
    SG.env.file = w.location && w.location.protocol === 'file:';
    SG.env.touch = ('ontouchstart' in w) || (w.navigator && w.navigator.maxTouchPoints > 0);
    SG.env.dpr = Math.min(w.devicePixelRatio || 1, 3);
    var ua = (w.navigator && w.navigator.userAgent) || '';
    SG.env.ios = /iPad|iPhone|iPod/.test(ua) ||
      (/Macintosh/.test(ua) && w.navigator && w.navigator.maxTouchPoints > 1);
    SG.env.standalone = !!(w.navigator && w.navigator.standalone) ||
      !!(w.matchMedia && w.matchMedia('(display-mode: standalone)').matches);
  } catch (e) { /* egal */ }

  /* Merkzeichen fuer das Stylesheet: hier laufen Skripte. Damit bleibt die
     Notfall-Anleitung im Startbildschirm auch dann verborgen, wenn der Start
     einmal laenger als drei Sekunden dauert. */
  try {
    var de = w.document && w.document.documentElement;
    if (de) de.className = de.className ? de.className + ' js' : 'js';
  } catch (e) { /* egal */ }

  /* Offline gilt auch, wenn die Einzeldatei ueber file:// laeuft */
  if (SG.env.file) SG.offline = true;

  /* --- Fehler sammeln, damit der Selbsttest sie sehen kann --- */
  SG.noteError = function (where, err) {
    var msg = err && err.stack ? err.stack : String(err);
    SG.errors.push({ where: where, msg: msg, t: Date.now() });
    if (SG.errors.length > 60) SG.errors.shift();
    try { console.error('[' + where + ']', err); } catch (e) { /* egal */ }
  };

  if (w.addEventListener) {
    w.addEventListener('error', function (e) {
      SG.noteError('window', e.error || e.message);
    });
    w.addEventListener('unhandledrejection', function (e) {
      SG.noteError('promise', e.reason);
    });
  }

  /* Kleiner Schutzschild: Aufrufe, die nie die App abschiessen sollen. */
  SG.safe = function (where, fn) {
    return function () {
      try { return fn.apply(this, arguments); }
      catch (err) { SG.noteError(where, err); return undefined; }
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
