/* Die Insel als Ganzes im Browser: das Wetter der Woche mit Vorhersage und
   das Rathaus mit Buergermeisterwahl. Die Regeln stehen in 2-insel.js,
   eingehaengt wird das Ganze von 2-abenteuer-ui.js (wie Handel und Dungeons). */
(function (SG) {
  var R = SG.gehstockmon, D = R.daten, X = R.abenteuer;
  R.mountInsel = function (c) {
    var el = c.el, button = c.button, drawer = c.drawer, insel = null;
    function titel(text, bild) { var h = el('h3', text), sym = R.symbol && R.symbol(bild, 'gm-titel-symbol'); if (sym) h.insertBefore(sym, h.firstChild); return h; }
    function prozent(m) { var p = Math.round((m - 1) * 100); return (p > 0 ? '+' : '−') + Math.abs(p) + ' %'; }
    /* Was die Faktoren der Woche fuer einen bedeuten, in einer Zeile je Wirkung. */
    var WIRKUNG = {
      gebietsgold: 'Gold aus Gebieten', tagwerk: 'Tagwerk-Lohn', kurier: 'Kurierlohn', streifzugDauer: 'Dauer der Streifzüge',
      runenFund: 'Runen je verlorener Rune', streifzugRunen: 'Runen von Streifzügen', zerhackerKraft: 'Lebenskraft des Zerhackers',
      zerhackerBeute: 'Beute vom Zerhacker', rohstoffStelle: 'Ertrag der Rohstoffstellen', handelDeckel: 'Wochengrenzen beim Händler',
      arenaLohn: 'Gold für Arenasiege', abgabe: 'Gebietsabgabe', raubSchutz: 'Ruhe nach einem Überfall', raubPause: 'Pause zwischen zwei Überfällen'
    };
    function wirkungen() {
      var e = (insel && insel.effekte) || {}, keys = Object.keys(e);
      if (!keys.length) return el('p', 'Diese Woche gelten die normalen Werte.', 'gm-plan-hinweis');
      var liste = el('ul', undefined, 'gm-wirkungen');
      keys.forEach(function (k) { liste.appendChild(el('li', (WIRKUNG[k] || k) + ': ' + prozent(e[k]))); });
      return liste;
    }
    function wetterFenster() {
      if (!insel || !c.open('Inselwetter', 'wetter')) return;
      var w = insel.wetter, n = insel.naechste;
      var karte = el('article', undefined, 'gm-quest-card gm-wetter-karte');
      karte.style.setProperty('--wetter', w.farbe || '#f0ca80');
      karte.appendChild(el('h3', w.zeichen + ' Diese Woche: ' + w.name));
      karte.appendChild(el('p', w.text));
      drawer.appendChild(karte);
      if (insel.erlass) {
        drawer.appendChild(titel('Erlass des Bürgermeisters', 'rathaus'));
        drawer.appendChild(el('p', insel.erlass.zeichen + ' ' + insel.erlass.name + ': ' + insel.erlass.text));
      }
      drawer.appendChild(el('h3', 'Was das diese Woche heißt'));
      drawer.appendChild(wirkungen());
      drawer.appendChild(el('h3', 'Vorhersage'));
      drawer.appendChild(el('p', 'Nächste Woche: ' + n.zeichen + ' ' + n.name + ' - ' + n.text));
      drawer.appendChild(el('p', 'Das Wetter wechselt jeden Montag und steht eine Woche vorher fest. In sieben Wochen kommt jedes einmal. Aufs Schlüpfen wirkt keins.', 'gm-plan-hinweis'));
    }
    function kacheln(marke) {
      var out = { wetter: null };
      if (insel && insel.wetter) out.wetter = marke('Wetter', insel.wetter.zeichen + ' ' + insel.wetter.name, insel.wetter.farbe || '#f0ca80', wetterFenster, 'wetter');
      return out;
    }
    return {
      wetter: wetterFenster, kacheln: kacheln,
      apply: function (res) { if (res && res.insel) insel = res.insel; },
      insel: function () { return insel; }
    };
  };
})(SG);
