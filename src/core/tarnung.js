/* ------------------------------------------------------------------
   Bildschirm-Beobachtung: Rest eines abgeschafften Hinweises.

   Hier lagen nacheinander zwei Dinge, die beide weg sind. Erst ein
   Vollbild-Tarnungsdeckel (Erdkunde-Referat), dann ein Pop-up oben
   links, das erschien, solange jemand ueber das Relais oder den
   Adminbereich auf den Bildschirm sah.

   Das Pop-up ist auf Anweisung des Aufsichtsrats entfernt worden. Wer
   beobachtet wird, merkt davon jetzt nichts mehr. Der Datenschutztext
   im Impressum sagt das inzwischen auch so - er versprach vorher einen
   Hinweis, den es nicht mehr gibt.

   Die Datei bleibt, weil core/boot.js, core/wache.js und
   core/spiegel.js weiterhin starten(), an(), aus() und istAn() rufen.
   Sie tun nichts mehr; wer das Geruest auch noch aufraeumen will, muss
   diese drei Stellen mitnehmen.
   ------------------------------------------------------------------ */

(function (SG) {
  var T = SG.tarnung = {};

  T.istAn = function () { return false; };
  T.MOTIVE = [];
  T.motivDa = function () { return false; };
  T.eigeneBilder = function () { return []; };

  T.bauen = function () { return null; };
  T.zeigen = function () { /* es gibt nichts mehr zu zeigen */ };
  T.an = function () { /* keine Vollbildtarnung mehr */ };
  T.aus = function () { /* keine Vollbildtarnung mehr */ };
  T.umschalten = function () { /* keine Vollbildtarnung mehr */ };

  T.starten = function () { /* kein Hinweis mehr - siehe oben */ };
})(SG);
