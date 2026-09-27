/* ------------------------------------------------------------------
   GehstockMon - Warenwirtschaft (27.09.2026).

   Holz, Erz und Kristall (E.ROHSTOFFE in 1-wirtschaft.js). Sie kommen von
   drei Seiten:
   - Aussenposten foerdern den Rohstoff ihres Bioms (abgeholt mit den Eiern);
   - Rohstoffstellen auf der Insel kann jeder abbauen, auch ohne Gebiet;
   - wer ein Paket an einem Aussenposten abholt, bekommt beim Abliefern eine
     Einheit von dessen Rohstoff dazu.
   Gebraucht werden sie fuer den Ausbau der Aussenposten, fuer den Hafenkran
   und im Handel mit dem Haendler (nach der Markthalle).

   Codex hat die erste Fassung verworfen, weil drei Spieler acht der neun
   Gebiete halten: Pflichtrohstoffe aus Gebieten waeren ihr Vetorecht ueber
   alle Bauten. Darum gibt es jeden Rohstoff auch an oeffentlichen Stellen
   und beim Haendler, und es gibt keinen Weg, Rohstoffe an andere Spieler zu
   geben - sonst schoebe ein Zweitkonto seine Ernte aufs Hauptkonto.
   ------------------------------------------------------------------ */
(function (SG) {
  var R = SG.gehstockmon, D = R.daten, E = R.wirtschaft, H = R.zeiten, X = R.abenteuer;
  X.ROHSTOFF_OPS = ['abbauen', 'rohstoff_kaufen', 'rohstoff_verkaufen'];
  X.SPIELZUEGE.push.apply(X.SPIELZUEGE, X.ROHSTOFF_OPS);
  X.HANDEL_OPS.push.apply(X.HANDEL_OPS, X.ROHSTOFF_OPS);

  /* Je Stunde sechs Stellen, von jedem Rohstoff zwei in zwei seiner drei
     Biome, ausserhalb der Mauern. Zwei Einheiten je Stelle, in der Erntezeit
     doppelt so viel. Wie bei den Runen: jede Stelle einmal je Spieler. */
  X.ROHSTOFF_STELLEN = 2; X.ROHSTOFF_MENGE = 2; X.ROHSTOFF_NAEHE = 8;
  X.rohstoffStellen = function (now, territories) {
    var epoche = Math.floor(now / X.SPAWN_TIME), saat = (Math.imul(epoche, 104729) + 7331) >>> 0, layout = X.layout(territories || []), out = [];
    function zufall() { saat = (Math.imul(saat, 1664525) + 1013904223) >>> 0; return saat / 4294967296; }
    E.ROHSTOFFE.forEach(function (r) {
      var gebiete = r.gebiete.slice();
      for (var n = 0; n < X.ROHSTOFF_STELLEN && gebiete.length; n++) {
        var gebiet = gebiete.splice(Math.floor(zufall() * gebiete.length), 1)[0], mitte = D.BIOME[gebiet - 1], punkt = null;
        for (var versuch = 0; versuch < 40 && !punkt; versuch++) {
          var w = zufall() * Math.PI * 2, d = 54 + zufall() * 18, p = { x: mitte.x + Math.cos(w) * d, z: mitte.z + Math.sin(w) * d };
          if (X.walkable(p) && !layout.some(function (g) { return X.inside(p, g); }) && X.canTravel(layout, p, p, 'public')) punkt = p;
        }
        if (punkt) out.push({ id: epoche + ':' + r.id + ':' + gebiet, rohstoff: r.id, gebiet: gebiet, x: Math.round(punkt.x * 10) / 10, z: Math.round(punkt.z * 10) / 10,
          menge: X.ROHSTOFF_MENGE, expiresAt: (epoche + 1) * X.SPAWN_TIME });
      }
    });
    return out;
  };

  /* Handel mit dem Haendler, erst wenn die Markthalle steht - dieselben
     Wochengrenzen wie bei den Runen (Runen und Rohstoffe zusammen). Er
     verkauft zum vollen Preis und kauft zur Haelfte zurueck. */
  X.ROHSTOFF_PREISE = { holz: 8, erz: 10, kristall: 12 };
  X.rohstoffAnkauf = function (id) { return Math.floor((X.ROHSTOFF_PREISE[id] || 0) / 2); };
  /* Wer ein Paket an einem Aussenposten abholt, traegt dessen Ware mit. */
  X.KURIER_ROHSTOFF = 1;

  /* Der zweite Gemeinschaftsbau: der Hafenkran. Er braucht Gold und alle
     drei Rohstoffe und macht die Kuriere fuer immer schneller reich. Er
     steht gleichzeitig mit der Markthalle offen; die Gebietsabgabe geht in
     den ersten Bau, der noch Gold braucht. */
  X.HAFENKRAN_KURIER = 1.2;
  X.BAUTEN.push({ id: 'hafenkran', name: 'Hafenkran', ziel: 1500, mindestens: 10, rohstoffe: { holz: 60, erz: 40, kristall: 30 },
    was: 'Kuriere bekommen 20 % mehr Lohn - für immer.' });
  X.bauGoldFertig = function (stand, id) { var def = X.bau(id), b = stand && stand[id]; return !!(def && b && b.gold >= def.ziel); };
  X.bauFertig = function (stand, id) {
    var def = X.bau(id), b = stand && stand[id];
    if (!def || !b || b.gold < def.ziel) return false;
    return Object.keys(def.rohstoffe || {}).every(function (r) { return ((b.rohstoffe && b.rohstoffe[r]) || 0) >= def.rohstoffe[r]; });
  };
  /* Wohin die Gebietsabgabe fliesst: in den ersten Bau, der noch Gold braucht. */
  X.bauFuerGold = function (stand) { return X.BAUTEN.find(function (b) { return !X.bauGoldFertig(stand, b.id); }) || null; };

  /* Rohstoffsammler: ein Titel fuer die, die am meisten abbauen. */
  X.TITEL.push({ id: 'rohstoffsammler', name: 'Bergmann', was: 'Rohstoffstellen abgebaut', ziel: 60, wert: function (p) { return p.abgebaut || 0; } });

  function ganz(n, max) { n = Math.floor(Number(n)); return Number.isFinite(n) && n >= 0 ? Math.min(max, n) : 0; }
  var vorher = D.neuerStand;
  D.neuerStand = function (save, now) {
    var p = vorher(save, now), old = save || {};
    p.rohstoffClaims = Array.isArray(old.rohstoffClaims) ? old.rohstoffClaims.filter(function (v) { return typeof v === 'string'; }).slice(-60) : [];
    p.abgebaut = ganz(old.abgebaut, 1e6);
    return p;
  };
})(SG);
