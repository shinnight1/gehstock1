/* ------------------------------------------------------------------
   GehstockMon - Schatzkarten (27.09.2026).

   Vier Kartenfetzen ergeben eine Karte. Sie liest man, und sie fuehrt zu
   einer Grabstelle, die nur fuer einen selbst gilt: kein Wettlauf, wer
   zuerst da ist. Die Karte nennt das Biom, eine Wuenschelrute sagt beim
   Laufen "kalt", "warm", "heiss" - gesucht ist man in zwei bis fuenf
   Minuten, also in einer Pause.

   Codex hat die erste Fassung geprueft. Uebernommen:
   - Die Fetzen kommen sicher aus dem, was man ohnehin tut, nicht aus einem
     seltenen Zufall (bei 10 % Chance waeren es vierzig Aktionen je Karte).
   - Fortschritt verfaellt nicht, aber gelesen wird hoechstens eine Karte je
     Woche.
   - Der Fund sind Runen, Gold und Rohstoffe - kein garantiertes episches
     Ei, das haette die Truhenserie entwertet.
   ------------------------------------------------------------------ */
(function (SG) {
  var R = SG.gehstockmon, D = R.daten, E = R.wirtschaft, H = R.zeiten, X = R.abenteuer;
  X.SCHATZ_OPS = ['schatz_lesen', 'schatz_graben'];
  X.OPS.push.apply(X.OPS, X.SCHATZ_OPS);
  X.SPIELZUEGE.push.apply(X.SPIELZUEGE, X.SCHATZ_OPS);

  X.SCHATZ_FETZEN = 4;
  /* Woher die Fetzen kommen: jede Quelle zaehlt fuer sich, und alle n Mal
     gibt es einen Fetzen. Die Truhe jeden Tag, ein langer Streifzug jedes
     Mal - so hat jede Spielweise ihren Weg zur Karte. */
  X.SCHATZ_QUELLEN = { truhe: 1, streifzug: 1, kurier: 3, rohstoff: 4, trainer: 3 };
  X.SCHATZ_NAME = { truhe: 'Tagestruhe', streifzug: 'lange Streifzüge', kurier: 'jede dritte Lieferung', rohstoff: 'jede vierte Rohstoffstelle', trainer: 'jeder dritte Trainersieg' };
  X.schatzStand = function (p) {
    var s = p && p.schatz;
    return s && typeof s === 'object' ? s : { fetzen: 0, zaehler: {}, woche: null, karte: null, funde: 0 };
  };
  /* Zaehlt eine Taetigkeit. Zurueck kommt true, wenn daraus ein Fetzen wurde. */
  X.schatzFetzen = function (p, quelle) {
    var n = X.SCHATZ_QUELLEN[quelle]; if (!p || !n) return false;
    var s = X.schatzStand(p); p.schatz = s;
    if (s.karte || s.fetzen >= X.SCHATZ_FETZEN) return false;
    s.zaehler = s.zaehler || {}; s.zaehler[quelle] = (s.zaehler[quelle] || 0) + 1;
    if (s.zaehler[quelle] < n) return false;
    s.zaehler[quelle] = 0; s.fetzen = Math.min(X.SCHATZ_FETZEN, s.fetzen + 1);
    return true;
  };
  X.schatzLesbar = function (p, now) { var s = X.schatzStand(p); return !s.karte && s.fetzen >= X.SCHATZ_FETZEN && s.woche !== X.zerhackerWoche(now); };
  /* Die Grabstelle: in einem Biom, ausserhalb aller Mauern, gut erreichbar. */
  X.schatzOrt = function (zufall, territories) {
    var layout = X.layout(territories || []);
    for (var versuch = 0; versuch < 200; versuch++) {
      var gebiet = 1 + Math.floor(zufall() * D.FELDER.length), mitte = D.BIOME[gebiet - 1];
      var w = zufall() * Math.PI * 2, d = 50 + zufall() * 26, p = { x: mitte.x + Math.cos(w) * d, z: mitte.z + Math.sin(w) * d };
      if (X.walkable(p) && !layout.some(function (g) { return X.inside(p, g); }) && X.canTravel(layout, p, p, 'public'))
        return { x: Math.round(p.x * 10) / 10, z: Math.round(p.z * 10) / 10, gebiet: gebiet };
    }
    return { x: X.STADT_TOR.x, z: X.STADT_TOR.z + 20, gebiet: 6 };
  };
  /* Die Wuenschelrute: wie weit ist es noch? */
  X.SCHATZ_NAEHE = 6;
  X.schatzRute = function (abstand) {
    if (abstand <= X.SCHATZ_NAEHE) return { stufe: 4, text: 'Hier graben!', zeichen: '✨' };
    if (abstand <= 18) return { stufe: 3, text: 'ganz heiß', zeichen: '🔥' };
    if (abstand <= 40) return { stufe: 2, text: 'heiß', zeichen: '♨️' };
    if (abstand <= 80) return { stufe: 1, text: 'warm', zeichen: '🌡️' };
    return { stufe: 0, text: 'kalt', zeichen: '❄️' };
  };
  /* Der Fund: drei Runen einer gewuerfelten Seltenheit, Gold und Rohstoffe
     des Bioms. */
  X.SCHATZ_GOLD = 100; X.SCHATZ_RUNEN = 3; X.SCHATZ_ROHSTOFF = 5;
  X.schatzFund = function (zufall, gebiet) {
    var w = zufall(), rang = w < .5 ? 2 : w < .85 ? 3 : 4;
    return { gold: X.SCHATZ_GOLD, runen: X.SCHATZ_RUNEN, rang: rang, rohstoff: E.rohstoffVon(gebiet).id, menge: X.SCHATZ_ROHSTOFF };
  };
  X.TITEL.push({ id: 'schatzsucher', name: 'Schatzsucher', was: 'Schätze gehoben', ziel: 5, wert: function (p) { return (p.schatz && p.schatz.funde) || 0; } });

  function ganz(n, max) { n = Math.floor(Number(n)); return Number.isFinite(n) && n >= 0 ? Math.min(max, n) : 0; }
  var vorher = D.neuerStand;
  D.neuerStand = function (save, now) {
    var p = vorher(save, now), s = save && save.schatz;
    var sauber = { fetzen: 0, zaehler: {}, woche: null, karte: null, funde: 0 };
    if (s && typeof s === 'object') {
      sauber.fetzen = ganz(s.fetzen, X.SCHATZ_FETZEN);
      Object.keys(X.SCHATZ_QUELLEN).forEach(function (q) { var n = ganz(s.zaehler && s.zaehler[q], 99); if (n) sauber.zaehler[q] = n; });
      sauber.woche = Number.isFinite(s.woche) ? Math.floor(s.woche) : null;
      var k = s.karte;
      if (k && Number.isFinite(k.x) && Number.isFinite(k.z) && ganz(k.gebiet, D.FELDER.length) > 0)
        sauber.karte = { x: k.x, z: k.z, gebiet: ganz(k.gebiet, D.FELDER.length), seit: Number(k.seit) || 0 };
      sauber.funde = ganz(s.funde, 1e6);
    }
    p.schatz = sauber;
    return p;
  };
})(SG);
