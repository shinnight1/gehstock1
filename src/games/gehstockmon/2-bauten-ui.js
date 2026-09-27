/* Die Gebaeude am Arenaplatz als Pins ueber der Karte - dasselbe Muster wie
   die Dungeon-Eingaenge: sichtbar in der Naehe und auf der Weltkarte, ein
   Tipp oeffnet das Fenster des Gebaeudes. Was ein Gebaeude kann, steht in
   seinem Fenster; die Liste selbst in X.GEBAEUDE (1-zusatz.js), das Modell
   in 2-welt.js. */
(function (SG) {
  var R = SG.gehstockmon, X = R.abenteuer;
  R.mountBauten = function (c) {
    var el = c.el, button = c.button, pins = [];
    /* Die Arena selbst bekommt ihren Pin ueber dem Torhaus. */
    var liste = [{ id: 'stadt', name: X.STADT.name, bild: 'arena', x: X.ARENA_BAU.x, z: X.ARENA_BAU.z + X.ARENA_BAU.radius + 0.6, hoehe: 15 }]
      .concat(X.GEBAEUDE.map(function (b) { return { id: b.id, name: b.name, bild: b.bild, x: b.x, z: b.z, hoehe: 8 }; }));
    liste.forEach(function (b) {
      var sym = R.symbol && R.symbol(b.bild, 'gm-pin-symbol');
      var node = button(sym ? '' : '⌂', function () { var f = c.oeffnen[b.id]; if (f) f(); }, 'gm-encounter-pin gm-bau-pin' + (b.id === 'stadt' ? ' gm-bau-arena' : '') + (sym ? ' gm-mit-symbol' : ''));
      if (sym) node.appendChild(sym);
      node.title = b.name; node.setAttribute('aria-label', b.name);
      node.appendChild(el('span', b.name));
      c.layer.appendChild(node);
      pins.push({ node: node, b: b });
    });
    return {
      /* Auf der Weltkarte stuenden sieben Pins auf einem Fleck - dort zeigt
         nur die Arena ihren, die Gebaeude erst aus der Naehe. */
      frame: function (project, hidden, overview) {
        pins.forEach(function (p) {
          var pt = project({ x: p.b.x, z: p.b.z, y: p.b.hoehe });
          p.node.hidden = hidden || !pt.visible || (overview ? p.b.id !== 'stadt' : !pt.near);
          p.node.style.transform = 'translate(' + pt.x + 'px,' + pt.y + 'px) translate(-50%,-100%)';
        });
      }
    };
  };
})(SG);
