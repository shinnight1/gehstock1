/* Schatzkarten im Browser: Fetzen sammeln, Karte lesen, mit der
   Wuenschelrute suchen und graben. Die Regeln stehen in 2-schatz.js.
   Eingehaengt von 2-abenteuer-ui.js (wie Handel und Rohstoffe). */
(function (SG) {
  var R = SG.gehstockmon, D = R.daten, X = R.abenteuer;
  R.mountSchatz = function (c) {
    var el = c.el, button = c.button, drawer = c.drawer, rute = null, zuletzt = null;
    function state() { return c.state(); }
    function stand() { return X.schatzStand(state()); }
    function titel(text, bild) { var h = el('h3', text), sym = R.symbol && R.symbol(bild, 'gm-titel-symbol'); if (sym) h.insertBefore(sym, h.firstChild); return h; }
    function position() { var w = c.world(); return w && w.position ? w.position() : null; }
    function abstand() { var s = stand(), p = position(); return s.karte && p ? Math.hypot(p.x - s.karte.x, p.z - s.karte.z) : Infinity; }
    function run(op, data) {
      c.request(op, data).then(function (res) { c.apply(res); if (op === 'schatz_lesen') fenster(); else c.closeDrawer(); if (res.message) c.notify(res.message); })
        .catch(function (error) { c.error(error); });
    }
    function graben() { if (!c.busy()) run('schatz_graben', {}); }
    function fenster() {
      if (!c.open('Schatzkarte', 'schatz')) return;
      var s = stand(), jetzt = c.now();
      drawer.appendChild(el('p', 'Vier Kartenfetzen ergeben eine Karte. Sie führt zu einer Stelle, die nur für dich gilt - niemand kommt dir zuvor. Eine Karte je Woche lässt sich lesen.', 'gm-beginner-tip'));
      if (s.karte) {
        var feld = D.FELDER[s.karte.gebiet - 1], r = X.schatzRute(abstand());
        drawer.appendChild(titel('Deine Karte', 'schatzkarte'));
        drawer.appendChild(el('p', 'Die Karte zeigt eine Stelle bei ' + feld.name + ' (' + D.BIOME[s.karte.gebiet - 1].terrain + '), außerhalb der Mauern. Lauf hin - die Wünschelrute über deiner Figur sagt dir, wie nah du bist.'));
        drawer.appendChild(el('p', 'Die Wünschelrute sagt gerade: ' + r.zeichen + ' ' + r.text + '.'));
        if (r.stufe >= 4) { var g = button('Graben', graben, 'gm-button gm-primary'); g.disabled = c.busy(); drawer.appendChild(g); }
        else drawer.appendChild(button('Nach ' + feld.name + ' laufen', function () {
          /* Erst zum Tor des Gebiets - von dort ist die Stelle nicht weit. */
          c.closeDrawer(); var w = c.world();
          if (w && w.walkTo) w.walkTo(s.karte.gebiet);
          c.notify('Du läufst Richtung ' + feld.name + '. Achte auf die Wünschelrute.');
        }, 'gm-button gm-primary'));
      } else {
        drawer.appendChild(titel('Kartenfetzen · ' + s.fetzen + '/' + X.SCHATZ_FETZEN, 'schatzkarte'));
        var spur = el('span', undefined, 'gm-projekt-spur gm-bau-spur'), f = el('i');
        f.style.width = Math.round(100 * s.fetzen / X.SCHATZ_FETZEN) + '%'; f.style.background = '#e8c77a'; spur.appendChild(f); drawer.appendChild(spur);
        if (s.fetzen >= X.SCHATZ_FETZEN) {
          if (s.woche === X.zerhackerWoche(jetzt)) drawer.appendChild(el('p', 'Die Karte ist vollständig. Diese Woche hast du schon einen Schatz gehoben - lesen kannst du sie ab Montag.'));
          else { var lesen = button('Karte lesen', function () { run('schatz_lesen', {}); }, 'gm-button gm-primary'); lesen.disabled = c.busy(); drawer.appendChild(lesen); }
        }
        drawer.appendChild(el('h3', 'Woher die Fetzen kommen'));
        var liste = el('ul', undefined, 'gm-wirkungen');
        Object.keys(X.SCHATZ_QUELLEN).forEach(function (q) {
          var n = X.SCHATZ_QUELLEN[q], z = (s.zaehler && s.zaehler[q]) || 0;
          liste.appendChild(el('li', (X.SCHATZ_NAME[q] || q) + (n > 1 ? ' (' + z + '/' + n + ')' : '')));
        });
        drawer.appendChild(liste);
      }
      drawer.appendChild(el('p', 'Im Schatz: ' + X.SCHATZ_RUNEN + ' Runen (Außergewöhnlich bis Legendär), ' + X.SCHATZ_GOLD + ' Gold und ' + X.SCHATZ_ROHSTOFF + ' Rohstoffe des Bioms. Gehoben: ' + (s.funde || 0) + '.', 'gm-plan-hinweis'));
    }
    function kacheln(marke) {
      var s = stand(), out = { schatz: null };
      if (s.karte) out.schatz = marke('Schatzkarte', '🧭 ' + D.FELDER[s.karte.gebiet - 1].name, '#e8c77a', fenster, 'schatzkarte');
      else if (X.schatzLesbar(state(), c.now())) out.schatz = marke('Schatzkarte', '🗺️ Karte bereit!', '#81d2a3', fenster, 'schatzkarte');
      else if (s.fetzen > 0) out.schatz = marke('Schatzkarte', s.fetzen + '/' + X.SCHATZ_FETZEN + ' Fetzen', '#e8c77a', fenster, 'schatzkarte');
      return out;
    }
    /* Die Wuenschelrute schwebt ueber der eigenen Figur, solange man sucht -
       angetippt graebt sie, sobald es "Hier graben!" heisst. */
    function frame(project, hidden) {
      var s = stand(), p = position();
      if (!s.karte || !p) { if (rute) { rute.remove(); rute = null; } return; }
      if (!rute) { rute = button('', function () { if (X.schatzRute(abstand()).stufe >= 4) graben(); else fenster(); }, 'gm-rute'); c.layer.appendChild(rute); }
      var r = X.schatzRute(abstand()), pt = project({ x: p.x, z: p.z, y: 7 });
      if (zuletzt !== r.stufe) { zuletzt = r.stufe; rute.textContent = r.zeichen + ' ' + r.text; rute.className = 'gm-rute stufe-' + r.stufe; }
      rute.hidden = hidden || !pt.visible;
      rute.style.transform = 'translate(' + pt.x + 'px,' + pt.y + 'px) translate(-50%,-100%)';
    }
    return { fenster: fenster, kacheln: kacheln, frame: frame, clear: function () { if (rute) { rute.remove(); rute = null; } } };
  };
})(SG);
