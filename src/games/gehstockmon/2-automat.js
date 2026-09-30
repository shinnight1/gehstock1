/* ------------------------------------------------------------------
   Der Gluecksautomat beim Haendler: drei Walzen, ein Spiel kostet 10 Gold,
   drei Eier auf den Walzen bringen ein Ei. Die Chance steht fest bei 2 %,
   und mehr als zwei Eier am Tag gibt er nicht her - danach ist er fuer heute
   leergespielt und nimmt auch kein Gold mehr an. Ein Spiel ohne Aussicht auf
   Gewinn waere nur noch eine Falle.

   Ob gewonnen ist, entscheidet der Server mit einem einzigen Wurf. Die
   Walzen zeigen danach nur das Ergebnis: drei Eier beim Gewinn, sonst drei
   Bilder, die nie alle gleich sind - drei Gleiche, die nichts bringen,
   saehen nach Betrug aus. Zwei Eier und ein anderes Bild kommen genau so oft,
   wie der Zufall sie bringt, nicht haeufiger.

   Im Schnitt kostet ein Ei hier 500 Gold, beim Haendler nebenan 350. Der
   Automat ist also kein Sparweg, sondern der einzige Weg zu einem zweiten
   und dritten Ei am Tag - und ein Ort, an dem Gold verschwindet.

   Diese Datei gilt fuer Browser und Server gleich (build.mjs erzeugt
   daraus gehstockmon-rules.mjs).
   ------------------------------------------------------------------ */
(function (SG) {
  var R = SG.gehstockmon, D = R.daten, E = R.wirtschaft, H = R.zeiten, X = R.abenteuer;

  /* Die Bilder auf den Walzen sind die Medaillons aus src/assets/gm-icon-*.webp. */
  X.AUTOMAT = { einsatz: 10, chance: 0.02, proTag: 2, gewinn: 'eier',
    symbole: ['eier', 'gold', 'rune', 'kristall', 'holz', 'perle'] };
  X.AUTOMAT_OPS = ['automat_spielen'];
  X.STADT_OPS.push.apply(X.STADT_OPS, X.AUTOMAT_OPS);
  X.SPIELZUEGE.push.apply(X.SPIELZUEGE, X.AUTOMAT_OPS);
  E.BILANZ_RAUS.automat = 'Glücksautomat';

  /* Was heute noch geht. Der Tag ist der deutsche Kalendertag wie beim Haendler. */
  X.automatStand = function (p, now) {
    var a = p && p.automat, heute = a && a.tag === H.day(now);
    var gewinne = heute ? a.gewinne : 0;
    return { gewinne: gewinne, frei: Math.max(0, X.AUTOMAT.proTag - gewinne), spiele: heute ? a.spiele : 0 };
  };

  /* Die drei Walzen zum Ergebnis. zufall liefert Zahlen in [0, 1). */
  X.automatWalzen = function (gewonnen, zufall) {
    var s = X.AUTOMAT.symbole;
    if (gewonnen) return [X.AUTOMAT.gewinn, X.AUTOMAT.gewinn, X.AUTOMAT.gewinn];
    for (var i = 0; i < 50; i++) {
      var w = [0, 1, 2].map(function () { return s[Math.min(s.length - 1, Math.floor(zufall() * s.length))]; });
      if (!(w[0] === w[1] && w[1] === w[2])) return w;
    }
    return [s[0], s[1], s[2]];
  };

  /* Der Stand des Automaten gehoert zum Spielstand - ohne das fiele er beim
     Aufbereiten fuer den Browser heraus, und die Anzeige wuesste nichts von
     den Gewinnen des Tages. */
  function ganz(n, max) { n = Math.floor(Number(n)); return Number.isFinite(n) && n >= 0 ? Math.min(max, n) : 0; }
  var vorher = D.neuerStand;
  D.neuerStand = function (save, now) {
    var p = vorher(save, now), a = save && save.automat;
    p.automat = a && Number.isFinite(a.tag) ? { tag: Math.floor(a.tag), gewinne: ganz(a.gewinne, X.AUTOMAT.proTag), spiele: ganz(a.spiele, 99999) } : null;
    return p;
  };
})(SG);
