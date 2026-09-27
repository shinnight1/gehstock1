/* ------------------------------------------------------------------
   Globale Einstellungen. Ton und Aufbau-Animation sind seit Stand 2
   standardmaessig an.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var store = SG.storage;

  var DEFAULTS = {
    sound: true,         // Toene an/aus
    volume: 0.6,
    haptics: true,       // Vibration, wo verfuegbar
    reduced: false,      // reduzierte Effekte fuer maximale Bildrate
    fullscreen: false,   // Vollbild beim Spielstart anfordern
    leftHanded: false,   // Bedienfelder spiegeln
    showFps: false,
    confirmExit: true,   // Nachfrage beim Verlassen laufender Tycoons
    aufbau: true,        // Aufbau-Animation nach jedem Anmelden (src/core/aufbau.js)

    /* Tarnung - siehe src/core/tarnung.js */
    tarnBild: 'bild',        // welches Motiv der Deckel zeigt
    tarnGeste: true,         // drei Finger, Ecke halten, Esc
    tarnHintergrund: true,   // beim Wegschalten der Seite tarnen
    tarnSpiegel: true,       // AirPlay-Meldung und Bildschirmmasse beachten
  };

  /* Einstellungen gehoeren zum Geraet, nicht zur Person: Ton, Vibration
     und Tarnung haengen davon ab, wo das Geraet gerade liegt. Deshalb im
     gemeinsamen Raum. Frueher stand hier store.get/set - gelesen wurde
     dann vor der Anmeldung aus dem gemeinsamen Raum, geschrieben nach
     der Anmeldung in den Benutzerraum, und nach jedem Neuladen war
     alles wieder beim alten. */
  var gespeichert = store.globalGet('settings', {}) || {};

  /* Gespeichert wird immer der ganze Satz, also auch Werte, die nie
     jemand angefasst hat. Damit die neuen Standards (Stand 2: Ton und
     Aufbau-Animation an) auch auf Geraeten ankommen, die schon einmal
     etwas gespeichert haben, fallen die alten Werte dieser beiden
     einmalig weg. Wer danach wieder ausschaltet, behaelt das. */
  var STAND = 2;
  if ((gespeichert._stand || 1) < STAND) {
    delete gespeichert.sound;
    delete gespeichert.aufbau;
    gespeichert._stand = STAND;
    store.globalSet('settings', U.assign({}, DEFAULTS, gespeichert));
  }

  var current = U.assign({}, DEFAULTS, gespeichert);
  var bus = U.emitter();

  var Set = SG.settings = {
    all: function () { return U.assign({}, current); },
    get: function (k) { return current[k]; },

    set: function (k, v) {
      if (current[k] === v) return;
      current[k] = v;
      store.globalSet('settings', current);
      apply();
      bus.emit('change', k, v);
      bus.emit('change:' + k, v);
    },

    toggle: function (k) { Set.set(k, !current[k]); return current[k]; },
    reset: function () {
      current = U.assign({}, DEFAULTS, { _stand: STAND });
      store.globalSet('settings', current);
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
