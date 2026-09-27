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
      drawer.appendChild(button('Zum Rathaus', rathausFenster, 'gm-button'));
      drawer.appendChild(el('h3', 'Was das diese Woche heißt'));
      drawer.appendChild(wirkungen());
      drawer.appendChild(el('h3', 'Vorhersage'));
      drawer.appendChild(el('p', 'Nächste Woche: ' + n.zeichen + ' ' + n.name + ' - ' + n.text));
      drawer.appendChild(el('p', 'Das Wetter wechselt jeden Montag und wirkt nie aufs Schlüpfen.', 'gm-plan-hinweis'));
    }
    /* ---------------- Rathaus ---------------- */
    function run(op, data) {
      c.request(op, data).then(function (res) { c.apply(res); rathausFenster(); if (res.message) c.notify(res.message); }).catch(function (error) { c.error(error); });
    }
    function erlassZeile(e) { return e ? e.zeichen + ' ' + e.name + ' - ' + e.text : ''; }
    function rathausFenster() {
      var r = insel && insel.rathaus; if (!r || !c.open('Rathaus', 'rathaus')) return;
      drawer.appendChild(el('p', 'Jede Woche wählt die Insel einen Bürgermeister, dessen Erlass die ganze nächste Woche gilt. Gewählt wird bis zum Wochenende, ausgezählt am Montag.', 'gm-beginner-tip'));
      drawer.appendChild(titel('Diese Woche', 'rathaus'));
      drawer.appendChild(el('p', r.amt ? '👑 ' + (r.amt.selbst ? 'Du bist' : r.amt.name + ' ist') + ' Bürgermeister dieser Woche (' + r.amt.stimmen + (r.amt.stimmen === 1 ? ' Stimme' : ' Stimmen') + '). Erlass: ' + erlassZeile(r.amt.erlass)
        : 'Diese Woche regiert niemand - es gilt kein Erlass.'));
      drawer.appendChild(titel('Die Wahl für nächste Woche', 'wahl'));
      drawer.appendChild(el('p', r.kandidaten.length ? r.abgegeben + (r.abgegeben === 1 ? ' Stimme' : ' Stimmen') + ' abgegeben.' : 'Noch kandidiert niemand.', 'gm-plan-hinweis'));
      if (!r.recht.stimme) drawer.appendChild(el('p', 'Wählen kannst du, sobald du ' + r.recht.fehlt.join(', ') + ' hast.'));
      r.kandidaten.forEach(function (k) {
        var karte = el('article', undefined, 'gm-quest-card gm-kandidat' + (r.meineStimme === k.id ? ' gewaehlt' : ''));
        karte.appendChild(el('h3', k.name + (k.selbst ? ' (du)' : '')));
        karte.appendChild(el('p', 'Verspricht: ' + erlassZeile(k.erlass)));
        var b = button(r.meineStimme === k.id ? 'Deine Stimme ✓' : 'Wählen', function () { run('waehlen', { kandidatId: k.id }); }, 'gm-button' + (r.meineStimme === k.id ? '' : ' gm-primary'));
        b.disabled = c.busy() || !r.recht.stimme || r.meineStimme === k.id; karte.appendChild(b);
        drawer.appendChild(karte);
      });
      /* Selbst kandidieren - mit einem Versprechen aus der Liste. */
      var ich = r.kandidaten.find(function (k) { return k.selbst; });
      drawer.appendChild(el('h3', ich ? 'Deine Kandidatur' : 'Selbst kandidieren'));
      if (!r.recht.kandidat) { drawer.appendChild(el('p', 'Kandidieren kannst du, sobald du ' + r.recht.kandidatFehlt.join(', ') + ' hast.')); }
      else {
        var wahl = el('select'); wahl.setAttribute('aria-label', 'Dein Wahlversprechen');
        X.ERLASSE.forEach(function (e) { var o = el('option', e.zeichen + ' ' + e.name); o.value = e.id; wahl.appendChild(o); });
        wahl.value = ich && ich.erlass ? ich.erlass.id : X.ERLASSE[0].id;
        var text = el('p', '', 'gm-plan-hinweis');
        function zeigen() { var e = X.erlass(wahl.value); text.textContent = e ? e.text : ''; }
        wahl.addEventListener('change', zeigen); zeigen();
        drawer.appendChild(wahl); drawer.appendChild(text);
        var los = button(ich ? 'Versprechen ändern' : 'Kandidieren', function () { run('kandidieren', { erlass: wahl.value }); }, 'gm-button gm-primary');
        los.disabled = c.busy(); drawer.appendChild(los);
        if (ich) { var weg = button('Kandidatur zurückziehen', function () { run('kandidieren', { erlass: null }); }, 'gm-button gm-secondary'); weg.disabled = c.busy(); drawer.appendChild(weg); }
      }
      if (r.chronik && r.chronik.length) {
        drawer.appendChild(el('h3', 'Die Chronik'));
        var liste = el('ol', undefined, 'gm-tafel');
        r.chronik.forEach(function (v) { liste.appendChild(el('li', v.name + ' · ' + v.erlass + ' · ' + v.stimmen + (v.stimmen === 1 ? ' Stimme' : ' Stimmen'))); });
        drawer.appendChild(liste);
      }
    }
    function kacheln(marke) {
      var out = { wetter: null, rathaus: null }, r = insel && insel.rathaus;
      if (insel && insel.wetter) out.wetter = marke('Wetter', insel.wetter.zeichen + ' ' + insel.wetter.name, insel.wetter.farbe || '#f0ca80', wetterFenster, 'wetter');
      /* Das Rathaus zeigt sich, sobald es etwas zu sehen gibt: ein Amt oder eine Wahl. */
      if (r && r.amt) out.rathaus = marke('Bürgermeister', '👑 ' + r.amt.name, '#f0ca80', rathausFenster, 'rathaus');
      else if (r && r.kandidaten.length) out.rathaus = marke('Wahl', r.kandidaten.length + (r.kandidaten.length === 1 ? ' Kandidat' : ' Kandidaten'), '#c9b6ff', rathausFenster, 'wahl');
      return out;
    }
    /* Das Rathaus am Arenaplatz oeffnet sich ueber diesen Weg (2-bauten-ui.js). */
    R.rathausOeffnen = rathausFenster;
    return {
      wetter: wetterFenster, rathaus: rathausFenster, kacheln: kacheln,
      apply: function (res) { if (res && res.insel) insel = res.insel; },
      insel: function () { return insel; }
    };
  };
})(SG);
