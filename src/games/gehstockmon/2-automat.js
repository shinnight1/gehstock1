/* ------------------------------------------------------------------
   Der Gluecksautomat beim Haendler: drei Walzen, ein Spiel kostet 10 Gold,
   drei gleiche Bilder gewinnen. Die Gewinnchancen stehen bewusst nirgends
   im Spiel (Wunsch von Louis, 30.09.2026) - nur hier.

   Ob und was gewonnen ist, entscheidet der Server mit einem einzigen Wurf.
   Die Walzen zeigen danach nur das Ergebnis: beim Gewinn dreimal dessen
   Bild, sonst drei Bilder, die nie alle gleich sind - drei Gleiche, die
   nichts bringen, saehen nach Betrug aus. Zwei Gleiche und ein anderes
   kommen genau so oft, wie der Zufall sie bringt, nicht haeufiger.

   Die Gewinne und warum sie so hoch sind (Einsatz 10 Gold, Werte zum
   Haendlerpreis, Rueckkauf beim Haendler: Runen 70 %, Rohstoffe 50 %):

     Bild      Gewinn               Chance   Wert je Spiel
     Ei        ein Ei (2 am Tag)    2 %      7,0  (Ei beim Haendler 350)
     Gold      20 Gold              8 %      1,6
     Holz      3 Holz               5 %      1,2
     Rune      1 seltene Rune       4 %      0,6
     Kristall  2 Kristall           3 %      0,7
     Perle     Schimmerperle        0,05 %   1,0  (2000, reine Optik)

   Rund jedes fuenfte Spiel gewinnt etwas. Zurueck in Gold - Gewinn plus
   Wiederverkauf - kommen nur rund 3 von 10: der Automat bleibt ein Ort,
   an dem Gold verschwindet, und niemand kann damit Gold machen. Die
   kleinen Gewinne sind Beigaben, keine Bezugsquelle: Holz kostet hier im
   Schnitt 67 Gold das Stueck, beim Haendler 8. Das prueft
   tools/gehstockmon-automat-tests.mjs.

   Was jemand gerade nicht bekommen kann - ein Ei nach zwei am Tag oder bei
   voller Bruttasche, eine Schimmerperle, wenn er schon eine hat -, faellt
   aus der Ziehung. Seine Chance wird dann zu "nichts" und nicht auf die
   anderen verteilt: jeder Gewinn bleibt immer gleich wahrscheinlich.

   Diese Datei gilt fuer Browser und Server gleich (build.mjs erzeugt
   daraus gehstockmon-rules.mjs).
   ------------------------------------------------------------------ */
(function (SG) {
  var R = SG.gehstockmon, D = R.daten, E = R.wirtschaft, H = R.zeiten, X = R.abenteuer;

  /* Die Bilder auf den Walzen sind die Medaillons aus src/assets/gm-icon-*.webp.
     Die Reihenfolge der Gewinne legt die Wurfbereiche fest - nicht umsortieren. */
  X.AUTOMAT = { einsatz: 10, proTag: 2,
    symbole: ['eier', 'gold', 'holz', 'rune', 'kristall', 'perle'],
    gewinne: [
      { symbol: 'eier', chance: .02, name: 'ein Ei',
        meldung: 'Drei Eier! Ein Ei liegt in deiner Bruttasche.' },
      { symbol: 'gold', chance: .08, gold: 20, name: '20 Gold',
        meldung: 'Drei Goldmünzen! +20 Gold.' },
      { symbol: 'holz', chance: .05, rohstoff: 'holz', menge: 3, name: '3 Holz',
        meldung: 'Dreimal Holz! +3 Holz im Lager.' },
      { symbol: 'rune', chance: .04, rune: 1, menge: 1, name: '1 seltene Rune',
        meldung: 'Drei Runen! +1 seltene Rune.' },
      { symbol: 'kristall', chance: .03, rohstoff: 'kristall', menge: 2, name: '2 Kristall',
        meldung: 'Dreimal Kristall! +2 Kristall im Lager.' },
      { symbol: 'perle', chance: .0005, perle: true, name: 'Schimmerperle',
        meldung: 'Drei Perlen! Eine Schimmerperle - dein nächstes Mon schlüpft schimmernd.' }
    ] };
  X.AUTOMAT_OPS = ['automat_spielen'];
  X.STADT_OPS.push.apply(X.STADT_OPS, X.AUTOMAT_OPS);
  X.SPIELZUEGE.push.apply(X.SPIELZUEGE, X.AUTOMAT_OPS);
  E.BILANZ_RAUS.automat = 'Glücksautomat';
  E.BILANZ_REIN.automat = 'Glücksautomat';

  /* Was heute noch geht. gewinne zaehlt die Eier des Tages; der Tag ist der
     deutsche Kalendertag wie beim Haendler. */
  X.automatStand = function (p, now) {
    var a = p && p.automat, heute = a && a.tag === H.day(now);
    var gewinne = heute ? a.gewinne : 0;
    return { gewinne: gewinne, frei: Math.max(0, X.AUTOMAT.proTag - gewinne), spiele: heute ? a.spiele : 0 };
  };
  /* Ob ein Ei gerade drin ist: noch nicht zwei am Tag und Platz in der Tasche. */
  X.automatEiMoeglich = function (p, now) {
    return X.automatStand(p, now).frei > 0 && !!p && Array.isArray(p.eggs) && p.eggs.length < E.BAG_LIMIT;
  };
  X.automatErreichbar = function (g, p, now) {
    if (g.symbol === 'eier') return X.automatEiMoeglich(p, now);
    if (g.perle) return !(p && p.schimmerperle);
    return true;
  };

  /* Der Wurf (eine Zahl in [0, 1)) gegen die feste Tabelle. Landet er auf
     einem Gewinn, der gerade nicht erreichbar ist, gibt es nichts. */
  X.automatZiehung = function (wurf, erreichbar) {
    var unten = 0, liste = X.AUTOMAT.gewinne;
    for (var i = 0; i < liste.length; i++) {
      if (wurf < unten + liste[i].chance) return erreichbar(liste[i]) ? liste[i] : null;
      unten += liste[i].chance;
    }
    return null;
  };

  /* Die drei Walzen zum Ergebnis. zufall liefert Zahlen in [0, 1). */
  X.automatWalzen = function (gewinn, zufall) {
    var s = X.AUTOMAT.symbole;
    if (gewinn) return [gewinn.symbol, gewinn.symbol, gewinn.symbol];
    for (var i = 0; i < 50; i++) {
      var w = [0, 1, 2].map(function () { return s[Math.min(s.length - 1, Math.floor(zufall() * s.length))]; });
      if (!(w[0] === w[1] && w[1] === w[2])) return w;
    }
    return [s[0], s[1], s[2]];
  };

  /* Der Stand des Automaten gehoert zum Spielstand - ohne das fiele er beim
     Aufbereiten fuer den Browser heraus, und die Anzeige wuesste nichts von
     den Eiern des Tages. */
  function ganz(n, max) { n = Math.floor(Number(n)); return Number.isFinite(n) && n >= 0 ? Math.min(max, n) : 0; }
  var vorher = D.neuerStand;
  D.neuerStand = function (save, now) {
    var p = vorher(save, now), a = save && save.automat;
    p.automat = a && Number.isFinite(a.tag) ? { tag: Math.floor(a.tag), gewinne: ganz(a.gewinne, X.AUTOMAT.proTag), spiele: ganz(a.spiele, 99999) } : null;
    return p;
  };
})(SG);
