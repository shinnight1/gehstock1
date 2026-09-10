/* ------------------------------------------------------------------
   Spiele-Katalog.

   Jede Spieldatei ruft am Ende SG.register(...) auf. Der Hub baut sich
   allein daraus - neue Spiele brauchen keine weitere Verdrahtung.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;

  SG.categories = [
    { id: 'arcade', name: 'Arcade', icon: '👾' },
    { id: 'casual', name: 'Schnell & locker', icon: '⚡' },
    { id: 'puzzle', name: 'Rätsel', icon: '🧩' },
    { id: 'karten', name: 'Karten & Brett', icon: '🃏' },
    { id: 'tycoon', name: 'Tycoon', icon: '🏗️' },
    { id: 'story', name: 'Geschichte', icon: '📖' },
    { id: 'gemeinsam', name: 'Gemeinsam', icon: '🌍' },
  ];

  /* def:
       id          eindeutiger Schluessel (auch Speicherpraefix)
       name        Anzeigename
       category    siehe oben
       desc        ein Satz fuer die Kachel
       tags        Suchbegriffe
       online      true, wenn es einen Online-Modus gibt
       heavy       true, wenn das Spiel rechenintensiv ist (Pixeldichte sinkt)
       preview     (ctx,w,h) => zeichnet die Kachelvorschau
       mount       (host) => Controller mit optionalem selftest()
       scoreLabel  (bests, stats) => Text fuer die Kachel
  */
  SG.register = function (def) {
    if (!def || !def.id) throw new Error('Spiel ohne id');
    if (SG.games[def.id]) throw new Error('Doppelte Spiel-id: ' + def.id);
    def.category = def.category || 'arcade';
    def.tags = def.tags || [];
    SG.games[def.id] = def;
    SG.order.push(def.id);
    return def;
  };

  /* Spiele, die als eigene Seite danebenliegen, gibt es in der
     Offline-Einzeldatei nicht - dort fehlt die Seite schlicht. */
  SG.list = function () {
    return SG.order.map(function (id) { return SG.games[id]; })
      .filter(function (g) { return !((g.external || g.onlineOnly) && SG.offline); });
  };

  /* Alle Eintraege, auch die ausgeblendeten - fuer den Router */
  SG.all = function () {
    return SG.order.map(function (id) { return SG.games[id]; });
  };

  SG.byCategory = function (cat) {
    return SG.list().filter(function (g) { return g.category === cat; });
  };

  SG.search = function (q) {
    var s = String(q || '').trim().toLowerCase();
    if (!s) return SG.list();
    return SG.list().filter(function (g) {
      if (g.name.toLowerCase().indexOf(s) >= 0) return true;
      if ((g.desc || '').toLowerCase().indexOf(s) >= 0) return true;
      for (var i = 0; i < g.tags.length; i++) {
        if (g.tags[i].toLowerCase().indexOf(s) >= 0) return true;
      }
      return false;
    });
  };

  SG.catName = function (id) {
    for (var i = 0; i < SG.categories.length; i++) {
      if (SG.categories[i].id === id) return SG.categories[i].name;
    }
    return id;
  };
})(SG);
