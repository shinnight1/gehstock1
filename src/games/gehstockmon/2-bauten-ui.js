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
    /* Auf der Weltkarte ist der Platz nur ein paar Pixel gross - die sieben
       Pins laegen aufeinander. Dort steht die Arena in der Mitte und die
       Gebaeude im Kreis darum, jedes in der Richtung, in der es wirklich
       steht, aber mindestens RING Pixel weit und mit LUECKE Abstand
       zum Nachbarn, damit jeder Pin fuer sich antippbar bleibt. Der Name
       steht nach aussen (seite), weg von der Arena - darunter laege er auf
       dem Nachbarn; der Arena-Name steht unter ihr in der Mitte. */
    var RING = 74, LUECKE = 0.72;
    function seite(w) { var x = Math.cos(w), y = Math.sin(w); return x > 0.35 ? 'rechts' : x < -0.35 ? 'links' : y < 0 ? 'oben' : 'unten'; }
    function auffaechern(mitte, punkte) {
      var liste = punkte.map(function (q) { return { q: q, w: Math.atan2(q.y - mitte.y, q.x - mitte.x) }; })
        .sort(function (a, b) { return a.w - b.w; });
      /* Ein paar Runden Auseinanderschieben reichen fuer sechs Stueck. */
      for (var runde = 0; runde < 8; runde++) {
        for (var i = 0; i < liste.length; i++) {
          var a = liste[i], b = liste[(i + 1) % liste.length];
          var abstand = b.w - a.w + (i === liste.length - 1 ? Math.PI * 2 : 0);
          if (abstand < LUECKE) { var schub = (LUECKE - abstand) / 2; a.w -= schub; b.w += schub; }
        }
      }
      liste.forEach(function (v) {
        var d = Math.max(RING, Math.hypot(v.q.x - mitte.x, v.q.y - mitte.y));
        v.q.x = mitte.x + Math.cos(v.w) * d; v.q.y = mitte.y + Math.sin(v.w) * d; v.q.seite = seite(v.w);
      });
    }
    return {
      frame: function (project, hidden, overview) {
        var mitte = overview ? project({ x: X.ARENA_BAU.x, z: X.ARENA_BAU.z, y: 4 }) : null, ring = [];
        pins.forEach(function (p) {
          var pt = project({ x: p.b.x, z: p.b.z, y: p.b.hoehe });
          p.node.hidden = hidden || !pt.visible || !pt.near && !overview;
          p.pos = { x: pt.x, y: pt.y };
          if (mitte) { if (p.b.id === 'stadt') p.pos = { x: mitte.x, y: mitte.y }; else ring.push(p.pos); }
        });
        if (mitte) auffaechern(mitte, ring);
        pins.forEach(function (p) {
          p.node.style.transform = 'translate(' + p.pos.x + 'px,' + p.pos.y + 'px) translate(-50%,' + (mitte ? '-50%' : '-100%') + ')';
          var s = mitte ? p.pos.seite || 'mitte' : 'nah';
          if (p.seite !== s) { p.seite = s; p.node.setAttribute('data-seite', s); }
        });
      }
    };
  };
})(SG);
