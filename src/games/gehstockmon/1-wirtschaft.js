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
      st.eggs.push({ id: egg.id, territoryId: egg.territoryId, producedAt: number(egg.producedAt, now), startedAt: start, readyAt: start === null ? null : start + E.HATCH_TIME });
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
  /* Was aus einem Ei kommt, entscheidet die Seltenheit - und das, was in der
     Sammlung noch fehlt. Ein Mon, das man schon hat, kann wiederkommen, zieht
     dabei aber nur noch einen Bruchteil des Gewichts auf sich: am Anfang ist
     fast jedes Ei ein neues Gesicht, gegen Ende sind es lauter Zwillinge.
     Deshalb rechnet die Anzeige mit demselben Vorrat wie das Schluepfen
     selbst, statt feste Prozente hinzuschreiben, die nach dem dritten Ei
     nicht mehr stimmen. */
  E.SCHLUPF_GEWICHTE = [8, 5, 3.8, 3, 1, .25, .05];
  E.DOPPEL_GEWICHT = .35;
  E.schlupfVorrat = function (st) {
    return D.KATALOG.map(function (k) {
      var doppelt = st.besitz.indexOf(k.id) >= 0;
      return { mon: k, doppelt: doppelt, gewicht: E.SCHLUPF_GEWICHTE[k.seltenheit] * (doppelt ? E.DOPPEL_GEWICHT : 1) };
    });
  };
  E.schlupfChancen = function (st) {
    var vorrat = E.schlupfVorrat(st);
    var summe = vorrat.reduce(function (s, v) { return s + v.gewicht; }, 0);
    return D.SELTENHEITEN.map(function (r, i) {
      var teil = vorrat.filter(function (v) { return v.mon.seltenheit === i; });
      var gewicht = teil.reduce(function (s, v) { return s + v.gewicht; }, 0);
      var neu = teil.filter(function (v) { return !v.doppelt; });
      return { name: r.name, farbe: r.farbe, offen: neu.length,
        anteil: summe ? gewicht / summe : 0,
        neuAnteil: summe ? neu.reduce(function (s, v) { return s + v.gewicht; }, 0) / summe : 0 };
    }).filter(function (v) { return v.anteil > 0; });
  };
  /* Ein Zwilling geht nicht verloren: Er steckt seine Kraft in das Mon, das
     schon da ist, und hebt es eine Runenstufe. Steht es schon auf der
     hoechsten, zerfaellt er zu Runen seiner eigenen Seltenheit - und die
     sind umso wertvoller, je seltener er war. */
  E.hatch = function (st, id, now, random) {
    var X = SG.gehstockmon.abenteuer;
    var egg = st.eggs.find(function (e) { return e.id === id; });
    if (!egg || egg.readyAt === null || now < egg.readyAt) throw new Error('Das Ei ist noch nicht fertig ausgebrütet.');
    var vorrat = E.schlupfVorrat(st), chosen = vorrat[vorrat.length - 1];
    var total = vorrat.reduce(function (sum, v) { return sum + v.gewicht; }, 0);
    var pick = Math.max(0, Math.min(0.9999999, Number.isFinite(random) ? random : Math.random())) * total;
    for (var i = 0; i < vorrat.length; i++) { pick -= vorrat[i].gewicht; if (pick < 0) { chosen = vorrat[i]; break; } }
    st.eggs = st.eggs.filter(function (e) { return e.id !== id; });
    var mon = chosen.mon;
    if (!chosen.doppelt) { st.besitz.push(mon.id); st.beschwoerungen++; return { mon: mon, neu: true, stufe: 0, runen: 0 }; }
    st.monUpgrades = st.monUpgrades || {};
    var stufe = X.upgradeLevel(st.monUpgrades[mon.id]);
    if (stufe < X.UPGRADE_LIMIT) { st.monUpgrades[mon.id] = stufe + 1; return { mon: mon, neu: false, stufe: stufe + 1, runen: 0 }; }
    st.runes = st.runes || D.SELTENHEITEN.map(function () { return 0; });
    var runen = X.UPGRADE_LIMIT;
    st.runes[mon.seltenheit] = Math.min(9999, (st.runes[mon.seltenheit] || 0) + runen);
    return { mon: mon, neu: false, stufe: stufe, runen: runen };
  };
  E.upgrade = function (st, post, now) {
    E.settle(st, post, now); var price = E.LEVELS[post.level].cost;
    if (!price) throw new Error('Deine Festung ist vollständig ausgebaut.');
    if (st.gold < price) throw new Error('Für den Ausbau brauchst du ' + price + ' Gold.');
    st.gold -= price; post.level++; return post.level;
  };
})(SG);
