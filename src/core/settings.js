/* ------------------------------------------------------------------
   Globale Einstellungen. Ton ist bewusst standardmaessig aus -
   die Sammlung wird in der Schule benutzt.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var store = SG.storage;

  var DEFAULTS = {
    sound: false,        // Toene an/aus
    volume: 0.6,
    haptics: true,       // Vibration, wo verfuegbar
    reduced: false,      // reduzierte Effekte fuer maximale Bildrate
    fullscreen: false,   // Vollbild beim Spielstart anfordern
    leftHanded: false,   // Bedienfelder spiegeln
    showFps: false,
    confirmExit: true,   // Nachfrage beim Verlassen laufender Tycoons

    /* Tarnung - siehe src/core/tarnung.js */
    tarnBild: 'bild',        // welches Motiv der Deckel zeigt
    tarnGeste: true,         // drei Finger, Ecke halten, Esc
    tarnHintergrund: true,   // beim Wegschalten der Seite tarnen
    tarnSpiegel: true,       // AirPlay-Meldung und Bildschirmmasse beachten
  };

  var current = U.assign({}, DEFAULTS, store.get('settings', {}));
  var bus = U.emitter();

  var Set = SG.settings = {
    all: function () { return U.assign({}, current); },
    get: function (k) { return current[k]; },

    set: function (k, v) {
      if (current[k] === v) return;
      current[k] = v;
      store.set('settings', current);
      apply();
      bus.emit('change', k, v);
      bus.emit('change:' + k, v);
    },

    toggle: function (k) { Set.set(k, !current[k]); return current[k]; },
    reset: function () {
      current = U.assign({}, DEFAULTS);
      store.set('settings', current);
      apply();
      bus.emit('change', null, null);
    },
    on: bus.on,
    off: bus.off,
    defaults: DEFAULTS,
  };

  function apply() {
    if (typeof document === 'undefined' || !document.body) return;
    document.body.classList.toggle('reduced', !!current.reduced);
    document.body.classList.toggle('lefty', !!current.leftHanded);
  }

  Set._apply = apply;

  /* Kurze Vibration. iPadOS kann das nicht, Android schon - und vor der
     ersten Nutzergeste lehnt der Browser den Aufruf mit einer Konsolen-
     meldung ab, deshalb das Flag. */
  Set.gestured = false;
  Set.buzz = function (ms) {
    if (!current.haptics || !Set.gestured) return;
    try { if (navigator.vibrate) navigator.vibrate(ms || 12); } catch (e) { /* egal */ }
  };
})(SG);
