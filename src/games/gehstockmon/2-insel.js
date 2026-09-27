/* ------------------------------------------------------------------
   GehstockMon - die Insel als Ganzes (27.09.2026): Inselwetter und die
   Erlasse des Buergermeisters.

   Beides wirkt eine Schulwoche lang auf dieselben Stellschrauben, und
   beides laeuft ueber X.effekt: Wer irgendwo Gold, Runen oder Zeiten
   berechnet, fragt dort nach dem Faktor der Woche. So steht an einer
   Stelle, was eine Woche veraendert, und nicht verstreut in jedem Zug.

   Codex hat die erste Fassung geprueft. Uebernommen:
   - Kein Wetter sperrt Wege (Sturm mit gesperrten Bruecken ist raus) oder
     versteckt Verteidigungen (Nebel liess sich per Screenshot umgehen).
   - Kein Wetter und kein Erlass beruehrt das Schluepfen - sonst horten
     alle ihre Eier fuer die guenstige Woche.
   - Jede Wirkung ist ein klarer Faktor; "doppelt so stark" heisst hier
     immer genau eine Zahl.

   Laeuft im Browser und auf dem Server, darum ohne DOM.
   ------------------------------------------------------------------ */
(function (SG) {
  var R = SG.gehstockmon, D = R.daten, E = R.wirtschaft, H = R.zeiten, X = R.abenteuer;

  /* ----------------------------------------------------------------
     Inselwetter: jede Woche ein Zustand, eine Woche im Voraus bekannt.
     ---------------------------------------------------------------- */
  X.WETTER = [
    { id: 'klar', name: 'Klarer Himmel', zeichen: '☀️', farbe: '#f0ca80',
      text: 'Nichts Besonderes - die Insel atmet durch.', effekte: {} },
    { id: 'duerre', name: 'Dürre', zeichen: '🌵', farbe: '#e0a45a',
      text: 'Die Gebiete bringen ein Fünftel weniger Gold. Wer im Hafen arbeitet oder Pakete trägt, bekommt 30 % mehr.',
      effekte: { gebietsgold: .8, tagwerk: 1.3, kurier: 1.3 } },
    { id: 'rueckenwind', name: 'Rückenwind', zeichen: '🍃', farbe: '#8fd18a',
      text: 'Streifzüge sind ein Viertel schneller zurück.', effekte: { streifzugDauer: .75 } },
    { id: 'runenregen', name: 'Runenregen', zeichen: '✨', farbe: '#c9b6ff',
      text: 'Verlorene Runen geben zwei statt einer, und wer auf Streifzug Runen sucht, findet die Hälfte mehr.',
      effekte: { runenFund: 2, streifzugRunen: 1.5 } },
    { id: 'heldenwoche', name: 'Heldenwoche', zeichen: '⚔️', farbe: '#f2705a',
      text: 'Der Zerhacker hat anderthalbmal so viel Lebenskraft - und lässt anderthalbmal so viel Beute fallen.',
      effekte: { zerhackerKraft: 1.5, zerhackerBeute: 1.5 } },
    { id: 'erntezeit', name: 'Erntezeit', zeichen: '🌾', farbe: '#e8d06a',
      text: 'Rohstoffstellen geben doppelt so viel Holz, Erz und Kristall.', effekte: { rohstoffStelle: 2 } },
    { id: 'marktwoche', name: 'Marktwoche', zeichen: '🏷️', farbe: '#89cce5',
      text: 'Der Händler kauft und verkauft doppelt so viel wie sonst - die Wochengrenzen im Runen- und Rohstoffhandel verdoppeln sich.',
      effekte: { handelDeckel: 2 } }
  ];
  X.wetterNach = function (id) { return X.WETTER.find(function (w) { return w.id === id; }) || X.WETTER[0]; };
  /* Jede Folge von sieben Wochen bringt jedes Wetter genau einmal, in einer
     aus der Folgennummer gemischten Reihenfolge. Am Uebergang zweier Folgen
     kommt dasselbe Wetter nie zweimal hintereinander. */
  function folge(n) {
    var ids = X.WETTER.map(function (w) { return w.id; }), saat = (Math.imul(n + 7, 2654435761) >>> 0) || 1;
    for (var i = ids.length - 1; i > 0; i--) {
      saat = (Math.imul(saat, 1664525) + 1013904223) >>> 0;
      var j = saat % (i + 1), t = ids[i]; ids[i] = ids[j]; ids[j] = t;
    }
    return ids;
  }
  X.wetterDerWoche = function (woche) {
    var n = X.WETTER.length, runde = Math.floor(woche / n), stelle = ((woche % n) + n) % n, ids = folge(runde);
    var vorher = folge(runde - 1);
    if (ids[0] === vorher[n - 1]) { var t = ids[0]; ids[0] = ids[1]; ids[1] = t; }
    return X.wetterNach(ids[stelle]);
  };
  X.wetter = function (now) { return X.wetterDerWoche(X.zerhackerWoche(now)); };
  X.wetterNaechste = function (now) { return X.wetterDerWoche(X.zerhackerWoche(now) + 1); };

  /* ----------------------------------------------------------------
     Erlasse: was der Buergermeister fuer seine Woche verspricht. Die Wahl
     selbst steht weiter unten; hier nur, was ein Erlass bewirkt. Keiner
     schaltet etwas ab (Codex: eine "Friedenswoche" nimmt anderen ein Spiel
     weg), und keiner belohnt es, mit Spenden zu warten.
     ---------------------------------------------------------------- */
  X.ERLASSE = [
    { id: 'kurierwoche', name: 'Kurierwoche', zeichen: '📦', text: 'Kuriere bekommen 25 % mehr Lohn.', effekte: { kurier: 1.25 } },
    { id: 'arenafest', name: 'Arenafest', zeichen: '🏟️', text: 'Siege in der Großen Arena bringen 25 % mehr Gold.', effekte: { arenaLohn: 1.25 } },
    { id: 'bauwoche', name: 'Bauwoche', zeichen: '🏗️', text: 'Die Gebietsabgabe steigt auf 15 % - die Insel baut schneller.', effekte: { abgabe: 1.5 } },
    { id: 'steuererleichterung', name: 'Steuererleichterung', zeichen: '💰', text: 'Die Gebietsabgabe sinkt auf 5 %.', effekte: { abgabe: .5 } },
    { id: 'erntedank', name: 'Erntedank', zeichen: '🌾', text: 'Rohstoffstellen geben die Hälfte mehr.', effekte: { rohstoffStelle: 1.5 } },
    { id: 'schutzwache', name: 'Schutzwache', zeichen: '🛡️', text: 'Wer überfallen wurde, hat vier statt zwei Stunden Ruhe, und zwischen zwei Überfällen liegen 45 statt 30 Minuten.',
      effekte: { raubSchutz: 2, raubPause: 1.5 } },
    { id: 'wetterschutz', name: 'Wetterschutz', zeichen: '☂️', text: 'Das Wetter wirkt nur halb so stark - im Guten wie im Schlechten.', effekte: {}, daempft: .5 }
  ];
  X.erlass = function (id) { return X.ERLASSE.find(function (e) { return e.id === id; }) || null; };
  /* Der Faktor der Woche fuer eine Stellschraube: erst das Wetter (vom
     Wetterschutz gedaempft), dann der Erlass. Ohne Wirkung 1. */
  X.effekt = function (now, erlassId, schluessel) {
    var w = X.wetter(now), e = X.erlass(erlassId), m = (w.effekte && w.effekte[schluessel]) || 1;
    if (e && e.daempft) m = 1 + (m - 1) * e.daempft;
    if (e && e.effekte && e.effekte[schluessel]) m *= e.effekte[schluessel];
    return m;
  };
  /* Alle Faktoren der Woche auf einmal - fuer die Anzeige im Browser. */
  X.EFFEKT_SCHLUESSEL = ['gebietsgold', 'tagwerk', 'kurier', 'streifzugDauer', 'runenFund', 'streifzugRunen', 'zerhackerKraft', 'zerhackerBeute',
    'rohstoffStelle', 'handelDeckel', 'arenaLohn', 'abgabe', 'raubSchutz', 'raubPause'];
  X.effekte = function (now, erlassId) {
    var out = {};
    X.EFFEKT_SCHLUESSEL.forEach(function (k) { var m = X.effekt(now, erlassId, k); if (m !== 1) out[k] = Math.round(m * 1000) / 1000; });
    return out;
  };
})(SG);
