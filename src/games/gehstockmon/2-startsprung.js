/* ------------------------------------------------------------------
   Zurueck zum Start.

   Wer sich auf der Insel verlaufen hat oder schnell wieder in die Mitte
   will, springt unter "Spielerwelt" an den Startplatz - einmal alle
   dreissig Minuten. Umgesetzt wird die Figur vom Server (Zug 'zum_start'
   in netlify/functions/gehstockmon.mjs): die Wegpruefung liesse einen so
   weiten Satz sonst nicht gelten und stellte die Figur zurueck.

   Diese Datei gilt fuer Browser und Server gleich (build.mjs erzeugt
   daraus gehstockmon-rules.mjs).
   ------------------------------------------------------------------ */
(function (SG) {
  var R = SG.gehstockmon, D = R.daten, X = R.abenteuer;

  X.START_SPRUNG_PAUSE = 30 * 60000;
  X.SPIELZUEGE.push('zum_start');

  /* Ab wann es wieder geht; 0 heisst: sofort. */
  X.startSprungAb = function (p) {
    var at = p && p.startSprungAt;
    return Number.isFinite(at) && at > 0 ? at + X.START_SPRUNG_PAUSE : 0;
  };

  /* Der Zeitpunkt des letzten Sprungs gehoert zum Spielstand - ohne das
     fiele er beim Aufbereiten fuer den Browser heraus, und der Knopf
     wuesste nichts von der Wartezeit. */
  var vorher = D.neuerStand;
  D.neuerStand = function (save, now) {
    var p = vorher(save, now), at = save && save.startSprungAt;
    p.startSprungAt = Number.isFinite(at) && at > 0 ? at : 0;
    return p;
  };
})(SG);
