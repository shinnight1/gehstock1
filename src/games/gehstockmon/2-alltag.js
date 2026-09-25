/* ------------------------------------------------------------------
   GehstockMon - der Alltag auf der Insel.

   Was jeden Schultag wiederkommt: Garantie-Zaehler und schimmernde Mons,
   die Tagesaufgaben mit ihrer Serie, die Revanche und der Insel-Ticker.
   Laeuft im Browser und auf dem Server (build.mjs haengt die Datei an die
   gemeinsamen Regeln), darum ohne DOM.

   Die Datei laedt im Browser vor 2-arena.js - sie darf die Arena erst in
   Funktionen ansprechen, nicht beim Laden.
   ------------------------------------------------------------------ */
(function (SG) {
  var R = SG.gehstockmon, D = R.daten, E = R.wirtschaft, H = R.zeiten, X = R.abenteuer;

  /* Neue Felder im Spielstand. D.neuerStand baut den Stand bei jedem Laden
     neu auf und laesst weg, was es nicht kennt - ohne diese Zeilen kaeme im
     Browser weder der Garantie-Zaehler noch der Schimmer an. */
  var vorher = D.neuerStand;
  D.neuerStand = function (save, now) {
    var p = vorher(save, now), old = save || {};
    p.garantie = E.garantieStand(old).map(function (g) { return g.seit; });
    p.schimmernd = {};
    p.besitz.forEach(function (id) { if (old.schimmernd && old.schimmernd[id] === true) p.schimmernd[id] = true; });
    return p;
  };
})(SG);
