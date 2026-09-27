/* Warenwirtschaft im Browser: die Rohstoffstellen auf der Karte und die
   Lagerzeile, die andere Fenster zeigen. Die Regeln stehen in 2-rohstoffe.js
   und 1-wirtschaft.js (E.ROHSTOFFE). Eingehaengt von 2-abenteuer-ui.js. */
(function (SG) {
  var R = SG.gehstockmon, E = R.wirtschaft, X = R.abenteuer;
  /* "12 Holz · 3 Erz · 0 Kristall" - fuer jedes Fenster, das den Vorrat zeigt. */
  R.lagerText = function (s) {
    var lager = (s && s.lager) || {};
    return E.ROHSTOFFE.map(function (r) { return (lager[r.id] || 0) + ' ' + r.name; }).join(' · ');
  };
  R.mountRohstoffe = function (c) {
    var el = c.el, button = c.button, stellen = [], pins = [];
    function position() { var w = c.world(); return w && w.position ? w.position() : null; }
    function nah(s) { var p = position(); return !!p && Math.hypot(p.x - s.x, p.z - s.z) <= X.ROHSTOFF_NAEHE - 2; }
    function name(s) { var r = E.rohstoff(s.rohstoff); return (r ? r.name : 'Rohstoff') + 'stelle'; }
    /* Antippen: davor abbauen, sonst hinlaufen - ohne Umweg ueber ein Fenster. */
    function tippen(s) {
      if (c.busy()) return;
      if (!nah(s)) { var w = c.world(); if (w && w.walkToPoint) w.walkToPoint(s); c.notify('Du läufst zur ' + name(s) + '. Tippe dort noch einmal darauf.'); return; }
      c.request('abbauen', { stelleId: s.id }).then(function (res) { c.apply(res); if (res.message) c.notify(res.message); }).catch(function (error) { c.error(error); });
    }
    function zeichnen() {
      pins.forEach(function (p) { p.node.remove(); });
      pins = stellen.map(function (s) {
        var sym = R.symbol && R.symbol(s.rohstoff, 'gm-pin-symbol'), node = button(sym ? '' : '◆', function () { tippen(s); }, 'gm-encounter-pin gm-rohstoff-pin ' + s.rohstoff + (sym ? ' gm-mit-symbol' : ''));
        if (sym) node.appendChild(sym);
        node.title = name(s); node.setAttribute('aria-label', name(s));
        node.appendChild(el('span', name(s)));
        c.layer.appendChild(node);
        return { node: node, s: s };
      });
    }
    return {
      apply: function (res) { if (res && Array.isArray(res.rohstoffStellen)) { stellen = res.rohstoffStellen; zeichnen(); } },
      stellen: function () { return stellen; },
      tippen: tippen, name: name,
      clear: function () { stellen = []; zeichnen(); },
      frame: function (project, hidden, overview) {
        pins.forEach(function (p) {
          var pt = project({ x: p.s.x, z: p.s.z, y: 1.5 });
          p.node.hidden = hidden || !pt.visible || !pt.near && !overview;
          p.node.style.transform = 'translate(' + pt.x + 'px,' + pt.y + 'px) translate(-50%,-100%)';
        });
      }
    };
  };
})(SG);
