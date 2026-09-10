/* ------------------------------------------------------------------
   W-Places - Leinwand-Untergrund

   Die Zeichenfläche ist eine 2000x2000 große weiße Fläche.
   Das Untergrund-Modul stellt sicher, dass der weiße Untergrund
   einmalig als saubere Bildquelle bereitsteht oder direkt im UI
   gerendert werden kann.
   ------------------------------------------------------------------ */

(function (SG) {
  var W = SG.welt;
  var D = W.daten;

  var K = W.karte = {};

  var leinwand = null;

  K.bauen = function () {
    var cv = SG.gfx.newCanvas(D.BREITE, D.HOEHE);
    var c = cv.getContext('2d');
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, D.BREITE, D.HOEHE);

    /* Ein ganz feines, dezentes Schachbrettmuster für die Grundorientierung */
    c.fillStyle = '#fafbfc';
    var schach = 50;
    for (var y = 0; y < D.HOEHE; y += schach) {
      for (var x = 0; x < D.BREITE; x += schach) {
        if (((x / schach) + (y / schach)) % 2 === 1) {
          c.fillRect(x, y, schach, schach);
        }
      }
    }

    leinwand = cv;
    return cv;
  };

  K.bild = function () {
    if (!leinwand) K.bauen();
    return leinwand;
  };

  K.vergessen = function () { leinwand = null; };
})(SG);
