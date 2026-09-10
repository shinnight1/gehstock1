/* Gemeinsame, zeitbasierte Regeln für lokale Kampagne und Server. */
(function (SG) {
  var D = SG.gehstockmon.daten, E = SG.gehstockmon.wirtschaft = {};
  E.HOUR = 3600000; E.EGG_TIME = 2 * E.HOUR; E.HATCH_TIME = E.HOUR;
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
      incomeAt: Math.max(captured, number(t.incomeAt, captured)), eggAt: Math.max(captured, number(t.eggAt, captured)),
      eggStock: Math.min(E.STOCK_LIMIT, Math.floor(number(t.eggStock, 0))) };
  };
  var previous = D.neuerStand;
  D.neuerStand = function (save, now) {
    now = number(now, Date.now()); var st = previous(save), old = save || {};
    st.economyVersion = 1;
    st.gold = Math.floor(number(old.gold, st.essenz + 120));
    st.goldRemainder = Math.min(0.999999999, number(old.goldRemainder, 0));
    st.clockAt = number(old.clockAt, now); st.eggSerial = Math.floor(number(old.eggSerial, 0));
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
    var end = Math.max(post.incomeAt, now), earned = st.goldRemainder + (end - post.incomeAt) / E.HOUR * E.LEVELS[post.level].income;
    var whole = Math.floor(earned + 1e-8); st.gold += whole; st.goldRemainder = Math.max(0, earned - whole); post.incomeAt = end;
    var cycles = Math.max(0, Math.floor((now - post.eggAt) / E.EGG_TIME));
    if (cycles) { post.eggStock = Math.min(E.STOCK_LIMIT, post.eggStock + cycles); post.eggAt += cycles * E.EGG_TIME; }
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
  E.incubate = function (st, id, now) {
    var egg = st.eggs.find(function (e) { return e.id === id; });
    if (!egg) throw new Error('Dieses Ei ist nicht in deiner Bruttasche.');
    if (egg.startedAt !== null) throw new Error('Dieses Ei wird bereits ausgebrütet.');
    if (st.eggs.filter(function (e) { return e.startedAt !== null; }).length >= E.INCUBATORS) throw new Error('Alle drei Brutplätze sind belegt.');
    egg.startedAt = Math.max(now, st.clockAt); egg.readyAt = egg.startedAt + E.HATCH_TIME; return egg;
  };
  E.hatch = function (st, id, now, random) {
    var egg = st.eggs.find(function (e) { return e.id === id; });
    if (!egg || egg.readyAt === null || now < egg.readyAt) throw new Error('Das Ei ist noch nicht fertig ausgebrütet.');
    var pool = D.KATALOG.filter(function (k) { return st.besitz.indexOf(k.id) < 0; }), weights = [8, 5, 3, 1], chosen = null;
    if (pool.length) {
      var total = pool.reduce(function (sum, k) { return sum + weights[k.seltenheit]; }, 0), pick = Math.max(0, Math.min(0.9999999, Number.isFinite(random) ? random : Math.random())) * total;
      chosen = pool[pool.length - 1]; for (var i = 0; i < pool.length; i++) { pick -= weights[pool[i].seltenheit]; if (pick < 0) { chosen = pool[i]; break; } }
      st.besitz.push(chosen.id); st.beschwoerungen++;
    } else st.gold += 75;
    st.eggs = st.eggs.filter(function (e) { return e.id !== id; }); return chosen;
  };
  E.upgrade = function (st, post, now) {
    E.settle(st, post, now); var price = E.LEVELS[post.level].cost;
    if (!price) throw new Error('Deine Festung ist vollständig ausgebaut.');
    if (st.gold < price) throw new Error('Für den Ausbau brauchst du ' + price + ' Gold.');
    st.gold -= price; post.level++; return post.level;
  };
})(SG);
