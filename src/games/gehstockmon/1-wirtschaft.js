/* Gemeinsame, zeitbasierte Regeln für lokale Kampagne und Server. */
(function (SG) {
  var D = SG.gehstockmon.daten, E = SG.gehstockmon.wirtschaft = {};
  E.HOUR = 3600000; E.EGG_TIME = 2 * E.HOUR; E.HATCH_TIME = E.HOUR;
  E.DAILY_GOLD = 150;
  E.STOCK_LIMIT = 3; E.BAG_LIMIT = 12; E.INCUBATORS = 3;
  E.LEVELS = [null,
    { name: 'Lager', income: 20, bonus: 0, cost: 120 },
    { name: 'Wachtposten', income: 35, bonus: 0.12, cost: 300 },
    { name: 'Festung', income: 55, bonus: 0.25, cost: null }
  ];
  function number(v, fallback) { return Number.isFinite(v) && v >= 0 ? v : fallback; }
  E.outpost = function (value, now) {
    var t = value || {}, captured = number(t.capturedAt, now);
    return { level: Math.max(1, Math.min(3, Math.floor(number(t.level, 1)))), capturedAt: captured,
      dailyAt: Math.max(captured, number(t.dailyAt, now)),
      incomeAt: Math.max(captured, number(t.incomeAt, captured)), eggAt: Math.max(captured, number(t.eggAt, captured)),
      eggStock: Math.min(E.STOCK_LIMIT, Math.floor(number(t.eggStock, 0))),
      weekendAt: Math.max(captured, number(t.weekendAt, SG.gehstockmon.zeiten.REWARDS_START)) };
  };
  var previous = D.neuerStand;
  D.neuerStand = function (save, now) {
    now = number(now, Date.now()); var st = previous(save), old = save || {};
    st.economyVersion = 2; st.dailyGoldPending = Math.floor(number(old.dailyGoldPending, 0));
    st.gold = Math.floor(number(old.gold, st.essenz + 120));
    st.goldRemainder = Math.min(0.999999999, number(old.goldRemainder, 0));
    st.clockAt = number(old.clockAt, now); st.eggSerial = Math.floor(number(old.eggSerial, 0));
    st.weekendEggs = {};
    D.FELDER.forEach(function (f) { var n = Math.floor(number(old.weekendEggs && old.weekendEggs[f.id], 0)); if (n) st.weekendEggs[f.id] = n; });
    st.eggs = []; var seen = {};
    (Array.isArray(old.eggs) ? old.eggs : []).slice(0, E.BAG_LIMIT).forEach(function (egg) {
      if (!egg || typeof egg.id !== 'string' || seen[egg.id] || !D.FELDER.some(function (f) { return f.id === egg.territoryId; })) return;
      seen[egg.id] = true;
      var start = number(egg.startedAt, null);
      var sauber = { id: egg.id, territoryId: egg.territoryId, producedAt: number(egg.producedAt, now), startedAt: start, readyAt: start === null ? null : start + E.HATCH_TIME };
      /* Ein Ei kann eine Mindest-Seltenheit tragen (etwa aus der Serien-Truhe)
         und sagen, woher es kommt. Beides ginge sonst beim naechsten Laden
         verloren. */
      var mindestens = Math.floor(Number(egg.mindestens) || 0);
      if (mindestens > 0) sauber.mindestens = Math.min(D.SELTENHEITEN.length - 1, mindestens);
      if (typeof egg.art === 'string' && /^[a-z]{1,16}$/.test(egg.art)) sauber.art = egg.art;
      st.eggs.push(sauber);
    });
    st.outposts = {};
    st.geschafft.forEach(function (id) { st.outposts[id] = E.outpost(old.outposts && old.outposts[id], now); });
    return st;
  };
  E.settle = function (st, post, now) {
    now = Math.max(st.clockAt || 0, now); st.clockAt = now;
    var end = Math.max(post.incomeAt, now), earned = st.goldRemainder + (SG.gehstockmon.zeiten.openTime(end) - SG.gehstockmon.zeiten.openTime(post.incomeAt)) / E.HOUR * E.LEVELS[post.level].income;
    var whole = Math.floor(earned + 1e-8); st.gold += whole; st.goldRemainder = Math.max(0, earned - whole); post.incomeAt = end;
    var H = SG.gehstockmon.zeiten;
    var days=Math.max(0,H.day(now)-H.day(post.dailyAt));
    if(days){st.dailyGoldPending=(st.dailyGoldPending||0)+days*E.DAILY_GOLD;post.dailyAt=now;}
    var produced = H.productionTime(post.eggAt), cycles = Math.max(0, Math.floor((H.productionTime(now) - produced) / E.EGG_TIME));
    if (cycles) { post.eggStock = Math.min(E.STOCK_LIMIT, post.eggStock + cycles); post.eggAt = H.productionAt(produced + cycles * E.EGG_TIME); }
  };
  E.deliverDaily = function(st){var n=st.dailyGoldPending||0;st.gold+=n;st.dailyGoldPending=0;return n;};
  E.nextEggAt = function (post) { var H = SG.gehstockmon.zeiten; return H.productionAt(H.productionTime(post.eggAt) + E.EGG_TIME); };
  E.weekend = function (st, post, id, now) {
    var reward = SG.gehstockmon.zeiten.weekends(Math.max(post.capturedAt, post.weekendAt), now);
    if (reward.count) { st.weekendEggs[id] = (st.weekendEggs[id] || 0) + reward.count * 2; post.weekendAt = reward.through; }
  };
  E.deliverWeekend = function (st, now) {
    var delivered = 0;
    Object.keys(st.weekendEggs).forEach(function (id) {
      var count = Math.min(st.weekendEggs[id], E.BAG_LIMIT - st.eggs.length);
      for (var i = 0; i < count; i++) st.eggs.push({ id: 'weekend-' + id + '-' + now + '-' + (++st.eggSerial), territoryId: Number(id), producedAt: now, startedAt: null, readyAt: null });
      st.weekendEggs[id] -= count; delivered += count; if (!st.weekendEggs[id]) delete st.weekendEggs[id];
    });
    return delivered;
  };
  E.tick = function (st, now) { Object.keys(st.outposts).forEach(function (id) { E.settle(st, st.outposts[id], now); }); };
  E.capture = function (st, id, now) {
    if (st.geschafft.indexOf(id) < 0) st.geschafft.push(id);
    st.outposts[id] = E.outpost(null, now); st.siege++; st.gold += 40;
  };
  E.collect = function (st, post, id, now) {
    E.settle(st, post, now);
    var count = Math.min(post.eggStock, E.BAG_LIMIT - st.eggs.length);
    if (!count) throw new Error(post.eggStock ? 'Deine Bruttasche ist voll (12 Eier).' : 'Hier ist noch kein Ei bereit.');
    for (var i = 0; i < count; i++) st.eggs.push({ id: 'egg-' + id + '-' + now + '-' + (++st.eggSerial), territoryId: id, producedAt: now, startedAt: null, readyAt: null });
    post.eggStock -= count; return count;
  };
  /* Wie viele Brutplaetze jemand hat, haengt am Leuchtturm und an gekauften
     Plaetzen - beides weiss nur der Aufrufer. Ohne Angabe bleiben es die drei
     festen. */
  E.incubate = function (st, id, now, plaetze) {
    var frei = Number.isFinite(plaetze) ? Math.max(E.INCUBATORS, plaetze) : E.INCUBATORS;
    var egg = st.eggs.find(function (e) { return e.id === id; });
    if (!egg) throw new Error('Dieses Ei ist nicht in deiner Bruttasche.');
    if (egg.startedAt !== null) throw new Error('Dieses Ei wird bereits ausgebrütet.');
    if (st.eggs.filter(function (e) { return e.startedAt !== null; }).length >= frei) throw new Error('Alle ' + frei + ' Brutplätze sind belegt.');
    egg.startedAt = Math.max(now, st.clockAt); egg.readyAt = egg.startedAt + E.HATCH_TIME; return egg;
  };
  /* Was aus einem Ei kommt, entscheidet allein die Seltenheit - mit festen
     Quoten fuer alle, egal was man schon hat. Innerhalb einer Seltenheit ist
     jedes Mon gleich wahrscheinlich. Frueher zog ein Mon, das man schon
     hatte, nur ein Drittel des Gewichts auf sich: die Quoten verschoben sich
     mit jeder Sammlung, und niemand wusste, was ein Ei eigentlich wert ist. */
  E.SCHLUPF_QUOTEN = [40, 25, 17, 11, 5, 1.6, 0.4];
  /* Der Garantie-Zaehler: spaetestens das zehnte Ei ohne Episches bringt ein
     Episches, spaetestens das vierzigste ohne Legendaeres ein Legendaeres.
     Damit ist auch ein schlechtes Ei ein Schritt nach vorn. */
  E.GARANTIEN = [{ ab: 3, nach: 10 }, { ab: 4, nach: 40 }];
  /* Eins von vierundsechzig Mons schluepft schimmernd - eine seltene
     Farbvariante, rein zum Ansehen. */
  E.SCHIMMER_CHANCE = 1 / 64;
  E.garantieStand = function (st) {
    var g = Array.isArray(st && st.garantie) ? st.garantie : [];
    return E.GARANTIEN.map(function (v, i) {
      var seit = Math.max(0, Math.min(v.nach - 1, Math.floor(Number(g[i]) || 0)));
      return { ab: v.ab, nach: v.nach, seit: seit, noch: v.nach - seit };
    });
  };
  E.schlupfChancen = function (st) {
    var summe = E.SCHLUPF_QUOTEN.reduce(function (s, v) { return s + v; }, 0);
    return D.SELTENHEITEN.map(function (r, i) {
      var alle = D.KATALOG.filter(function (k) { return k.seltenheit === i; });
      var offen = st && st.besitz ? alle.filter(function (k) { return st.besitz.indexOf(k.id) < 0; }).length : alle.length;
      return { name: r.name, farbe: r.farbe, offen: offen, anzahl: alle.length, anteil: (E.SCHLUPF_QUOTEN[i] || 0) / summe };
    }).filter(function (v) { return v.anteil > 0 && v.anzahl > 0; });
  };
  /* Mehrere unabhaengige Zufallszahlen aus einem Aufruf. Wer eine feste Zahl
     uebergibt (die Tests), bekommt sie als erste Ziehung und danach eine
     feste Folge - so bleibt jedes Ergebnis wiederholbar. */
  E.zufallsfolge = function (random) {
    if (typeof random === 'function') return function () { return Math.max(0, Math.min(0.9999999, Number(random()) || 0)); };
    var erste = Number.isFinite(random) ? Math.max(0, Math.min(0.9999999, random)) : Math.random();
    var saat = Math.floor(erste * 4294967296) >>> 0, zug = 0;
    return function () {
      if (zug++ === 0) return erste;
      saat = (Math.imul(saat ^ 0x9e3779b9, 1664525) + 1013904223) >>> 0;
      return saat / 4294967296;
    };
  };
  /* Ein Zwilling geht nicht verloren: Er steckt seine Kraft in das Mon, das
     schon da ist, und hebt es eine Runenstufe. Steht es schon auf der
     hoechsten, zerfaellt er zu Runen seiner eigenen Seltenheit - und die
     sind umso wertvoller, je seltener er war. */
  E.hatch = function (st, id, now, random) {
    var X = SG.gehstockmon.abenteuer, zufall = E.zufallsfolge(random);
    var egg = st.eggs.find(function (e) { return e.id === id; });
    if (!egg || egg.readyAt === null || now < egg.readyAt) throw new Error('Das Ei ist noch nicht fertig ausgebrütet.');
    var summe = E.SCHLUPF_QUOTEN.reduce(function (s, v) { return s + v; }, 0), wurf = zufall() * summe, rang = E.SCHLUPF_QUOTEN.length - 1;
    for (var i = 0; i < E.SCHLUPF_QUOTEN.length; i++) { wurf -= E.SCHLUPF_QUOTEN[i]; if (wurf < 0) { rang = i; break; } }
    var gewuerfelt = rang, stand = E.garantieStand(st), boden = Math.max(0, Math.floor(Number(egg.mindestens) || 0));
    E.GARANTIEN.forEach(function (g, i) { if (stand[i].seit >= g.nach - 1) boden = Math.max(boden, g.ab); });
    rang = Math.max(rang, Math.min(boden, D.SELTENHEITEN.length - 1));
    st.garantie = E.GARANTIEN.map(function (g, i) { return rang >= g.ab ? 0 : stand[i].seit + 1; });
    var pool = [];
    for (var r = rang; r >= 0 && !pool.length; r--) pool = D.KATALOG.filter(function (k) { return k.seltenheit === r; });
    var mon = pool[Math.min(pool.length - 1, Math.floor(zufall() * pool.length))];
    var ergebnis = { mon: mon, neu: st.besitz.indexOf(mon.id) < 0, stufe: 0, runen: 0, rang: mon.seltenheit,
      garantiert: mon.seltenheit > gewuerfelt, schimmernd: zufall() < E.SCHIMMER_CHANCE, schimmerNeu: false };
    st.eggs = st.eggs.filter(function (e) { return e.id !== id; });
    st.schimmernd = st.schimmernd || {};
    if (ergebnis.schimmernd && !st.schimmernd[mon.id]) { st.schimmernd[mon.id] = true; ergebnis.schimmerNeu = true; }
    if (ergebnis.neu) { st.besitz.push(mon.id); st.beschwoerungen++; return ergebnis; }
    st.monUpgrades = st.monUpgrades || {};
    var stufe = X.upgradeLevel(st.monUpgrades[mon.id]);
    if (stufe < X.UPGRADE_LIMIT) { st.monUpgrades[mon.id] = stufe + 1; ergebnis.stufe = stufe + 1; return ergebnis; }
    st.runes = st.runes || D.SELTENHEITEN.map(function () { return 0; });
    ergebnis.stufe = stufe; ergebnis.runen = X.UPGRADE_LIMIT;
    st.runes[mon.seltenheit] = Math.min(9999, (st.runes[mon.seltenheit] || 0) + ergebnis.runen);
    return ergebnis;
  };
  E.upgrade = function (st, post, now) {
    E.settle(st, post, now); var price = E.LEVELS[post.level].cost;
    if (!price) throw new Error('Deine Festung ist vollständig ausgebaut.');
    if (st.gold < price) throw new Error('Für den Ausbau brauchst du ' + price + ' Gold.');
    st.gold -= price; post.level++; return post.level;
  };
})(SG);
