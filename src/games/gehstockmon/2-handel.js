/* ------------------------------------------------------------------
   GehstockMon - Handel und Gemeinschaft (27.09.2026).

   Drei Dinge, die zusammengehoeren:
   - der Kurierdienst: Pakete zu fremden Aussenposten tragen, gegen Gold;
   - die Markthalle: der zweite Gemeinschaftsbau nach dem Leuchtturm,
     bezahlt aus Spenden und der Gebietsabgabe (E.ABGABE);
   - der Runenhandel beim Haendler, den die Markthalle freischaltet.
   Die Wochenbilanz selbst steht in 1-wirtschaft.js (E.buchen).

   Laeuft im Browser und auf dem Server (build.mjs haengt die Datei an die
   gemeinsamen Regeln), darum ohne DOM.
   ------------------------------------------------------------------ */
(function (SG) {
  var R = SG.gehstockmon, D = R.daten, E = R.wirtschaft, H = R.zeiten, X = R.abenteuer;
  X.HANDEL_OPS = ['kurier_annehmen', 'kurier_abliefern', 'kurier_abbrechen', 'bau_spenden', 'runen_kaufen', 'runen_verkaufen'];
  X.SPIELZUEGE.push.apply(X.SPIELZUEGE, X.HANDEL_OPS);

  /* ----------------------------------------------------------------
     Kurierdienst

     Im Kontor am Arenaplatz liegen Auftraege: ein Paket am Kontor oder am
     Tor eines Aussenpostens abholen und zum Tor eines anderen tragen. Wer
     ankommt, wird bezahlt. Jede geoeffnete Stunde kommt ein Auftrag dazu,
     bis zu fuenf warten - wer nur einmal am Tag hereinschaut, findet also
     einen vollen Stapel. Solange der Stapel voll ist, steht die Uhr.

     Codex hat die erste Fassung (alle 30 Minuten, drei warten) geprueft:
     sie speicherte nur neunzig Minuten und belohnte, wer jede Pause kommt.
     Bezahlt wird der kuerzeste Weg um alle Mauern herum, gemessen als
     Runde vom Kontor ueber Abholung und Ziel zurueck - nicht die Luftlinie
     und nicht, was jemand an Umwegen laeuft. Gold gibt es gestaffelt wie
     bei den Streifzuegen: ohne Gebiet voll, mit einem oder zwei die Haelfte,
     ab drei ein Viertel.

     Jeder vierte Auftrag ist eilig: wer ihn in der Frist abliefert, bekommt
     die Haelfte mehr. Danach gilt der normale Lohn - verloren geht nichts.
     ---------------------------------------------------------------- */
  X.KURIER_ZEIT = 60 * 60000; X.KURIER_VORRAT = 5;
  X.KURIER_EIL = 1.5; X.KURIER_EIL_ANTEIL = .25;
  /* Wie nah man am Tor stehen muss - das Tor selbst ist gut acht Schritte breit. */
  X.KURIER_NAEHE = 14;
  X.KURIER_WAREN = ['Proviant', 'Werkzeug', 'Heilkräuter', 'Laternenöl', 'Briefe', 'Seile', 'Gewürze', 'Runenstaub', 'Decken', 'Honig'];
  /* Wegstrecken um alle Mauern herum, gemessen mit X.route auf der Karte ohne
     Spielergebiete: Zeile und Spalte 0 ist das Kontor (X.STADT_TOR), 1-9 die
     Tore der Gebiete. tools/gehstockmon-handel-tests.mjs misst nach - aendert
     sich die Karte, schlaegt der Test an. Fest hinterlegt, weil eine einzige
     Wegsuche auf dem Handy-Server bis zu 50 ms braucht. */
  X.KURIER_WEGE = [
    [0, 95, 217, 218, 97, 198, 57, 265, 124, 208],
    [95, 0, 300, 310, 167, 224, 103, 359, 130, 284],
    [217, 300, 0, 122, 262, 396, 206, 270, 340, 345],
    [218, 310, 122, 0, 197, 338, 216, 149, 305, 253],
    [97, 167, 262, 197, 0, 142, 147, 198, 115, 124],
    [198, 224, 396, 338, 142, 0, 248, 293, 95, 141],
    [57, 103, 206, 216, 147, 248, 0, 298, 166, 259],
    [265, 359, 270, 149, 198, 293, 298, 0, 313, 169],
    [124, 130, 340, 305, 115, 95, 166, 313, 0, 186],
    [208, 284, 345, 253, 124, 141, 259, 169, 186, 0]
  ];
  X.kurierWeg = function (von, nach) { var z = X.KURIER_WEGE[von]; return z && Number.isFinite(z[nach]) ? z[nach] : 0; };
  /* Die ganze Runde: vom Kontor zur Abholung, von dort zum Ziel, zurueck. */
  X.kurierRunde = function (a) { return X.kurierWeg(0, a.von) + X.kurierWeg(a.von, a.nach) + X.kurierWeg(a.nach, 0); };
  /* 12 Gold fuer die kuerzeste Runde (Tauwiese und zurueck), 35 fuer die laengsten. */
  X.kurierLohn = function (runde) { return Math.max(12, Math.min(35, Math.round(6 + runde * 0.05))); };
  /* Eilig heisst: eine Minute Luft plus anderthalbmal die Laufzeit (9 Schritte
     je Sekunde, etwas langsamer als moeglich). */
  X.kurierFrist = function (a) { return 60000 + Math.round(X.kurierWeg(a.von, a.nach) / 9 * 1500); };
  /* Wo abgeholt und abgeliefert wird: das Kontor oder vor dem Tor eines
     Gebiets. Gehoeren zwei benachbarte Gebiete demselben, teilen sie sich ein
     Tor - dann zaehlt das gemeinsame. */
  X.tor = function (layout, id) {
    var g = (layout || []).find(function (v) { return v.fields.indexOf(id) >= 0; });
    return g ? { x: g.gate.x + g.gate.nx * 4, z: g.gate.z + g.gate.nz * 4 } : null;
  };
  X.kurierOrt = function (layout, ort) { return ort ? X.tor(layout, ort) : { x: X.STADT_TOR.x, z: X.STADT_TOR.z }; };
  X.kurierOrtName = function (ort) { return ort ? D.FELDER[ort - 1].name : X.STADT.name; };
  /* Ein neuer Auftrag. Abholen und Abliefern nur an fremden Posten - wer
     fast die ganze Insel haelt, bekommt Ziele aus allen. */
  X.kurierAuftrag = function (zufall, eigene, nummer) {
    var alle = D.FELDER.map(function (f) { return f.id; });
    var fremd = alle.filter(function (id) { return (eigene || []).indexOf(id) < 0; });
    if (fremd.length < 2) fremd = alle;
    var von = zufall() < 0.7 ? 0 : fremd[Math.floor(zufall() * fremd.length)];
    var ziele = fremd.filter(function (id) { return id !== von; }), nach = ziele[Math.floor(zufall() * ziele.length)];
    var a = { id: 'k' + nummer, von: von, nach: nach, ware: X.KURIER_WAREN[Math.floor(zufall() * X.KURIER_WAREN.length)] };
    a.lohn = X.kurierLohn(X.kurierRunde(a)); a.eilig = zufall() < X.KURIER_EIL_ANTEIL;
    return a;
  };
  function reifeAuftraege(p, now) {
    var stand = p && p.kurierAt;
    if (!Number.isFinite(stand)) return 0;
    return Math.max(0, Math.min(X.KURIER_VORRAT, Math.floor((H.openTime(now) - H.openTime(stand)) / X.KURIER_ZEIT)));
  }
  /* Legt faellige Auftraege aufs Brett. Zurueck kommt, wie viele neu sind. */
  X.kurierNachfuellen = function (p, now, zufall, eigene) {
    var neu = 0;
    while (p.kurierBrett.length < X.KURIER_VORRAT && reifeAuftraege(p, now) > 0) {
      p.kurierSerie = (p.kurierSerie || 0) + 1;
      p.kurierBrett.push(X.kurierAuftrag(zufall, eigene, p.kurierSerie));
      var voll = H.openTime(now) - X.KURIER_VORRAT * X.KURIER_ZEIT;
      p.kurierAt = H.productionAt(Math.max(H.openTime(p.kurierAt), voll) + X.KURIER_ZEIT);
      neu++;
    }
    return neu;
  };
  /* Wann der naechste Auftrag kommt - fuer die Anzeige. Bei vollem Brett keiner. */
  X.kurierWartezeit = function (p, now) {
    if (!p || (p.kurierBrett || []).length >= X.KURIER_VORRAT || !Number.isFinite(p.kurierAt)) return 0;
    var offen = H.openTime(now) - H.openTime(p.kurierAt), bis = (Math.floor(Math.max(0, offen) / X.KURIER_ZEIT) + 1) * X.KURIER_ZEIT;
    return Math.max(0, H.productionAt(H.openTime(p.kurierAt) + bis) - now);
  };
  /* Was ein Auftrag jemandem mit so vielen Gebieten bringt. */
  /* faktor: Wetter und Erlass der Woche (X.effekt 'kurier'), sonst 1. */
  X.kurierBetrag = function (a, gebiete, eil, faktor) {
    return Math.round(a.lohn * (eil ? X.KURIER_EIL : 1) * X.streifzugGoldAnteil(gebiete) * (Number.isFinite(faktor) ? faktor : 1));
  };

  /* ----------------------------------------------------------------
     Gemeinschaftsbauten nach dem Leuchtturm

     Die Insel baut ein Bauwerk nach dem anderen. Bezahlt wird aus Spenden
     und aus der Gebietsabgabe; die Spender stehen auf der Tafel. Solange
     kein Bau offen ist, ruht die Abgabe.

     Die Markthalle kostet 6.000 Gold. Ohne Spenden braeuchte sie 60.000
     Gold Gebietsertrag - bei vollem Land etwa vier Schulwochen; jede Spende
     macht es schneller. Sie schaltet den Runenhandel beim Haendler frei.
     ---------------------------------------------------------------- */
  X.BAUTEN = [
    { id: 'markthalle', name: 'Markthalle', ziel: 6000, mindestens: 10,
      was: 'Schaltet den Runenhandel beim Händler frei: Runen jeder Seltenheit kaufen und verkaufen.' }
  ];
  X.bau = function (id) { return X.BAUTEN.find(function (b) { return b.id === id; }) || null; };
  X.bauFertig = function (stand, id) { var def = X.bau(id), b = stand && stand[id]; return !!(def && b && b.gold >= def.ziel); };
  /* Der Bau, an dem die Insel gerade arbeitet - der erste, der noch fehlt. */
  X.offenerBau = function (stand) { return X.BAUTEN.find(function (b) { return !X.bauFertig(stand, b.id); }) || null; };

  /* ----------------------------------------------------------------
     Runenhandel beim Haendler

     Feste Preise statt eines Kurses: Codex hat gezeigt, dass ein Kurs nach
     Bestand sich mit Zweitkonten verschieben laesst und wer billig kauft und
     teuer verkauft, bis zu neun Prozent verdient. Der Haendler kauft zu 70 %
     zurueck. Hin und zurueck verliert man immer, auch ueber die Schmiede:
     eine Rune kaufen und zerlegen kostet mindestens 24 Gold mehr, als die
     zwei kleineren beim Verkauf bringen.

     Zwei Grenzen je Woche. Verkaufen hoechstens fuer 500 Gold, sonst werden
     seltene Streifzug-Runen zur Goldquelle. Kaufen hoechstens fuer 1.000
     Gold - sonst verwandelt sich Gebietsgold ohne Umweg in Runenstufen, und
     wer am meisten Land haelt, zieht auch im Kampf davon. Gezaehlt wird in
     der Wochenbilanz (Runenverkauf und Runenkauf).
     ---------------------------------------------------------------- */
  X.RUNEN_PREISE = [8, 15, 25, 45, 80, 140, 240];
  X.RUNEN_ANKAUF = 0.7;
  X.RUNEN_VERKAUF_DECKEL = 500; X.RUNEN_KAUF_DECKEL = 1000;
  X.runenAnkauf = function (rang) { return Math.floor((X.RUNEN_PREISE[rang] || 0) * X.RUNEN_ANKAUF); };
  /* faktor: die Marktwoche verdoppelt beide Grenzen (X.effekt 'handelDeckel'). */
  X.runenHandelStand = function (p, now, faktor) {
    var b = E.bilanzSicht(p, now).diese, f = Number.isFinite(faktor) ? faktor : 1;
    return { verkauft: b.rein.handel || 0, gekauft: b.raus.handel || 0,
      verkaufFrei: Math.max(0, Math.round(X.RUNEN_VERKAUF_DECKEL * f) - (b.rein.handel || 0)), kaufFrei: Math.max(0, Math.round(X.RUNEN_KAUF_DECKEL * f) - (b.raus.handel || 0)) };
  };

  /* Wer am meisten austraegt, bekommt einen Titel dafuer. */
  X.TITEL.push({ id: 'eilbote', name: 'Eilbote', was: 'Pakete abgeliefert', ziel: 40, wert: function (p) { return p.kurierGesamt || 0; } });

  /* Neue Felder im Spielstand. */
  function ganz(n, max) { n = Math.floor(Number(n)); return Number.isFinite(n) && n >= 0 ? Math.min(max, n) : 0; }
  function auftragSauber(a) {
    if (!a || typeof a.id !== 'string' || !/^k\d{1,9}$/.test(a.id)) return null;
    var von = ganz(a.von, D.FELDER.length), nach = ganz(a.nach, D.FELDER.length);
    if (!nach || von === nach || X.KURIER_WAREN.indexOf(a.ware) < 0) return null;
    var sauber = { id: a.id, von: von, nach: nach, ware: a.ware, lohn: Math.max(12, Math.min(35, ganz(a.lohn, 35))), eilig: a.eilig === true };
    return sauber;
  }
  var vorher = D.neuerStand;
  D.neuerStand = function (save, now) {
    var p = vorher(save, now), old = save || {}, jetzt = Number.isFinite(now) ? now : Date.now();
    /* Wer zum ersten Mal kommt, findet einen vollen Stapel vor. */
    p.kurierAt = Number.isFinite(old.kurierAt) ? old.kurierAt : X.schonReif(jetzt, X.KURIER_ZEIT, X.KURIER_VORRAT);
    p.kurierSerie = ganz(old.kurierSerie, 1e9);
    var gesehen = {};
    p.kurierBrett = (Array.isArray(old.kurierBrett) ? old.kurierBrett : []).map(auftragSauber)
      .filter(function (a) { if (!a || gesehen[a.id]) return false; gesehen[a.id] = true; return true; }).slice(0, X.KURIER_VORRAT);
    var k = auftragSauber(old.kurier);
    p.kurier = k && Number.isFinite(old.kurier.seit) ? Object.assign(k, { seit: old.kurier.seit, frist: k.eilig && Number.isFinite(old.kurier.frist) ? old.kurier.frist : null }) : null;
    p.kurierGesamt = ganz(old.kurierGesamt, 1e6);
    return p;
  };
})(SG);
