/* ------------------------------------------------------------------
   Hafen-Tycoon - Simulation

   Der Takt liegt bei 10 Schritten je Sekunde und ist bewusst von der
   Bildrate getrennt. Eine Spielstunde dauert bei 1x zwei Sekunden.

   Kern ist eine Kette von Engpaessen:
     Liegeplatz -> Brücke -> Fahrzeuge -> Yard-Platz -> Gate/Bahn
   Wer an einer Stelle spart, merkt es sofort an der nächsten.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var P = SG.tycoon.port;
  var D = P.data;

  var S = P.sim = {};

  var HOURS_PER_SECOND = 0.5;      // 1x: zwei Sekunden je Spielstunde

  /* ------------------------------------------------------------------
     Aufbau
     ------------------------------------------------------------------ */

  S.create = function (mapId, seed) {
    var map = null;
    for (var i = 0; i < D.MAPS.length; i++) if (D.MAPS[i].id === mapId) map = D.MAPS[i];
    if (!map) map = D.MAPS[0];

    var s = {
      version: 1,
      mapId: map.id,
      seed: (seed || ((Date.now() ^ (Math.random() * 1e9)) >>> 0)) >>> 0,
      w: map.w, h: map.h, waterRows: map.waterRows,
      depth: map.baseDepth,
      dredged: 0,

      time: 8,              // Spielstunden seit Start (Beginn 8 Uhr)
      day: 0,
      cash: map.start,
      loan: 0,
      reputation: 50,
      level: 1,
      morale: 70,
      shift: 2,

      grid: new Int16Array(map.w * map.h),   // Index+1 des Gebaeudes, 0 = frei
      buildings: [],
      vehicles: {},         // id -> Anzahl
      crew: U.assign({}, D.ECON.startCrew),

      ships: [],            // wartend, am Kai, ablegend
      nextShipId: 1,
      yard: { normal: 0, reefer: 0, hazmat: 0, empty: 0 },
      boxes: [],            // Container im Yard: {kind, days, teu, dest}

      contracts: [],
      offers: [],
      tech: [],
      research: null,       // { id, daysLeft }
      events: [],
      goals: [],
      alerts: [],

      stats: {
        teu: 0, shipsDone: 0, moves: 0, byClass: {},
        revenue: 0, costs: 0, days: 0,
        history: [],        // je Tag: {teu, profit, cash}
      },
      ledger: { tariff: 0, storage: 0, gate: 0, rail: 0, bunker: 0, bonus: 0,
        wages: 0, power: 0, diesel: 0, upkeep: 0, interest: 0, penalty: 0, tax: 0 },
      dayLedger: null,

      paused: false,
      speed: 1,
      tutorialDone: false,
    };
    s.dayLedger = U.assign({}, s.ledger);
    resetGoals(s);
    refreshOffers(s, U.rng(s.seed));
    return s;
  };

  function resetGoals(s) {
    s.goals = D.GOALS.map(function (g) { return { id: g.id, done: false }; });
  }

  /* ------------------------------------------------------------------
     Bauen
     ------------------------------------------------------------------ */

  S.inBounds = function (s, x, y, w, h) {
    return x >= 0 && y >= 0 && x + w <= s.w && y + h <= s.h;
  };

  S.tileFree = function (s, x, y) {
    return s.grid[y * s.w + x] === 0;
  };

  S.buildingAt = function (s, x, y) {
    var v = s.grid[y * s.w + x];
    return v ? s.buildings[v - 1] : null;
  };

  /* Darf das Gebaeude hier stehen? Liefert null oder einen Grund. */
  S.canPlace = function (s, def, x, y) {
    if (!S.inBounds(s, x, y, def.w, def.h)) return 'Passt nicht aufs Gelände.';
    var quayRow = s.waterRows;

    if (def.kind === 'quay') {
      if (y !== quayRow) return 'Kaimauern gehören genau an die Wasserkante.';
    } else if (def.kind === 'crane') {
      if (y !== quayRow) return 'Brücken stehen auf der Kaimauer.';
      for (var cx = x; cx < x + def.w; cx++) {
        var b = S.buildingAt(s, cx, quayRow);
        if (!b || b.def !== 'quay') return 'Hier fehlt die Kaimauer.';
        if (b.crane) return 'Auf diesem Abschnitt steht schon eine Brücke.';
      }
      return null;   // Bruecken stehen auf der Kaimauer, nicht daneben
    } else {
      if (y <= quayRow) return 'Auf dem Wasser lässt sich nicht bauen.';
    }

    for (var yy = y; yy < y + def.h; yy++) {
      for (var xx = x; xx < x + def.w; xx++) {
        if (!S.tileFree(s, xx, yy)) return 'Da steht schon etwas.';
      }
    }
    return null;
  };

  S.place = function (s, defId, x, y) {
    var def = D.byId(defId);
    if (!def) return 'Unbekanntes Gebäude.';
    if (def.needLevel && s.level < def.needLevel) return 'Erst ab Terminal-Level ' + def.needLevel + '.';
    if (def.needTech && s.tech.indexOf(def.needTech) < 0) return 'Dafür fehlt noch die Forschung.';
    var why = S.canPlace(s, def, x, y);
    if (why) return why;
    if (s.cash < def.cost) return 'Nicht genug Geld.';

    s.cash -= def.cost;

    if (def.kind === 'crane') {
      // Die Bruecke haengt an der Kaimauer darunter
      var b = S.buildingAt(s, x, s.waterRows);
      var obj = {
        def: defId, x: x, y: y, w: def.w, h: def.h,
        health: 1, down: 0, id: s.buildings.length + 1, isCrane: true,
        quay: b ? b.id : 0,
      };
      s.buildings.push(obj);
      for (var cx = x; cx < x + def.w; cx++) {
        var q = S.buildingAt(s, cx, s.waterRows);
        if (q) q.crane = obj.id;
      }
      return null;
    }

    var o = {
      def: defId, x: x, y: y, w: def.w, h: def.h,
      health: 1, down: 0, id: s.buildings.length + 1,
    };
    s.buildings.push(o);
    for (var yy = y; yy < y + def.h; yy++) {
      for (var xx = x; xx < x + def.w; xx++) {
        s.grid[yy * s.w + xx] = o.id;
      }
    }
    return null;
  };

  S.demolish = function (s, b) {
    if (!b) return;
    var def = D.byId(b.def);
    /* Achtung: b.isCrane markiert die Brücke selbst, b.crane steht auf
       einer Kaimauer und verweist auf die Brücke darauf. */
    if (b.isCrane) {
      for (var cx = b.x; cx < b.x + b.w; cx++) {
        var q = S.buildingAt(s, cx, s.waterRows);
        if (q && q.crane === b.id) q.crane = 0;
      }
    } else {
      for (var yy = b.y; yy < b.y + b.h; yy++) {
        for (var xx = b.x; xx < b.x + b.w; xx++) {
          if (s.grid[yy * s.w + xx] === b.id) s.grid[yy * s.w + xx] = 0;
        }
      }
      // Bruecken auf dieser Kaimauer fallen mit
      if (b.def === 'quay' && b.crane) {
        var cr = S.byId(s, b.crane);
        if (cr) S.demolish(s, cr);
      }
    }
    b.removed = true;
    s.cash += Math.round(def ? def.cost * 0.35 : 0);
  };

  S.byId = function (s, id) {
    for (var i = 0; i < s.buildings.length; i++) {
      if (s.buildings[i].id === id && !s.buildings[i].removed) return s.buildings[i];
    }
    return null;
  };

  S.list = function (s, defId) {
    var out = [];
    for (var i = 0; i < s.buildings.length; i++) {
      var b = s.buildings[i];
      if (b.removed) continue;
      if (!defId || b.def === defId) out.push(b);
    }
    return out;
  };

  S.listKind = function (s, kind) {
    var out = [];
    for (var i = 0; i < s.buildings.length; i++) {
      var b = s.buildings[i];
      if (b.removed) continue;
      var d = D.byId(b.def);
      if (d && d.kind === kind) out.push(b);
    }
    return out;
  };

  /* ------------------------------------------------------------------
     Abgeleitete Kennzahlen
     ------------------------------------------------------------------ */

  /* Liegeplaetze: zusammenhaengende Kaimauern bilden einen Liegeplatz */
  S.berths = function (s) {
    var quays = S.list(s, 'quay').sort(function (a, b) { return a.x - b.x; });
    var out = [];
    var cur = null;
    for (var i = 0; i < quays.length; i++) {
      var q = quays[i];
      if (cur && q.x === cur.x + cur.len) {
        cur.len += q.w;
        cur.parts.push(q);
      } else {
        cur = { x: q.x, len: q.w, parts: [q] };
        out.push(cur);
      }
    }
    out.forEach(function (b) {
      b.meters = b.len * D.TILE_M;
      b.cranes = [];
      b.parts.forEach(function (q) {
        if (q.crane) {
          var c = S.byId(s, q.crane);
          if (c && b.cranes.indexOf(c) < 0) b.cranes.push(c);
        }
      });
    });
    return out;
  };

  S.mapOf = function (s) {
    for (var i = 0; i < D.MAPS.length; i++) if (D.MAPS[i].id === s.mapId) return D.MAPS[i];
    return D.MAPS[0];
  };

  S.power = function (s) {
    /* Etwas Strom kommt aus dem oeffentlichen Netz, damit die erste
       Bruecke auch ohne eigenes Umspannwerk laeuft. */
    var supply = S.mapOf(s).baseSupply || 0;
    var demand = 0;
    S.list(s).forEach(function (b) {
      var d = D.byId(b.def);
      if (!d) return;
      if (d.supply) supply += d.supply;
      if (d.power) demand += d.power;
    });
    for (var vid in s.vehicles) {
      var vd = D.vehicleById(vid);
      if (vd && vd.power) demand += vd.power * s.vehicles[vid];
    }
    return { supply: supply, demand: demand, ok: supply >= demand };
  };

  S.yardCapacity = function (s) {
    var cap = { normal: 0, reefer: 0, hazmat: 0, empty: 0 };
    var extra = s.tech.indexOf('stack5') >= 0 ? 2 : 0;
    S.listKind(s, 'yard').forEach(function (b) {
      var d = D.byId(b.def);
      var n = Math.round(d.slots * (d.stack + extra) / d.stack);
      if (d.reefer) cap.reefer += n;
      else if (d.hazmat) cap.hazmat += n;
      else if (d.empty) cap.empty += n;
      else cap.normal += n;
    });
    return cap;
  };

  S.yardUsed = function (s) {
    return {
      normal: s.yard.normal, reefer: s.yard.reefer,
      hazmat: s.yard.hazmat, empty: s.yard.empty,
    };
  };

  /* Wie viele Bewegungen je Stunde schafft der Kai insgesamt? */
  S.craneRate = function (s) {
    var mul = s.tech.indexOf('dual') >= 0 ? 1.2 : 1;
    var total = 0, count = 0;
    S.listKind(s, 'crane').forEach(function (b) {
      if (b.down > 0) return;
      var d = D.byId(b.def);
      total += d.moves * mul * b.health;
      count++;
    });
    return { rate: total, count: count };
  };

  S.vehicleRate = function (s) {
    var mul = 1;
    var road = S.list(s, 'road').length;
    mul += Math.min(0.25, road * 0.004);
    var total = 0;
    for (var vid in s.vehicles) {
      var d = D.vehicleById(vid);
      if (!d || d.tug) continue;
      total += (d.rate || 0) * s.vehicles[vid] * mul;
    }
    return total;
  };

  S.gateRate = function (s) {
    var mul = s.tech.indexOf('customs') >= 0 ? 1.4 : 1;
    var total = 0;
    S.list(s, 'gate').forEach(function (b) {
      total += D.byId('gate').truckRate * mul * b.health;
    });
    return total;
  };

  S.railRate = function (s) {
    var total = 0;
    S.list(s, 'rail').forEach(function (b) {
      total += D.byId('rail').railRate * b.health;
    });
    return total;
  };

  /* Personalbedarf gegen vorhandenes Personal */
  S.staffing = function (s) {
    var need = { kran: 0, yard: 0, planer: 0, zoll: 0, technik: 0 };
    S.list(s).forEach(function (b) {
      var d = D.byId(b.def);
      if (d && d.staff) need[d.staff] += (d.kind === 'crane' ? 1 : 1);
    });
    for (var vid in s.vehicles) {
      var vd = D.vehicleById(vid);
      if (vd && vd.staff) need[vd.staff] += s.vehicles[vid];
    }
    var out = {};
    var worst = 1;
    for (var k in need) {
      var have = s.crew[k] || 0;
      var ratio = need[k] === 0 ? 1 : Math.min(1, have / need[k]);
      out[k] = { need: need[k], have: have, ratio: ratio };
      if (need[k] > 0) worst = Math.min(worst, ratio);
    }
    out.overall = worst;
    return out;
  };

  /* Wirksame Betriebsstunden am Tag durch das Schichtmodell */
  S.shiftFactor = function (s) {
    var sh = D.SHIFTS[s.shift - 1] || D.SHIFTS[1];
    return sh.hours / 24;
  };

  S.effects = function (s) {
    var e = {
      craneMul: 1, gateMul: 1, arrivalMul: 1, tariffMul: 1,
      craneStop: false, cranesDown: 0,
    };
    s.events.forEach(function (ev) {
      var def = eventDef(ev.id);
      if (!def) return;
      var f = def.effect || {};
      if (f.craneMul) e.craneMul *= f.craneMul;
      if (f.gateMul) e.gateMul *= f.gateMul;
      if (f.arrivalMul) e.arrivalMul *= f.arrivalMul;
      if (f.tariffMul) e.tariffMul *= f.tariffMul;
      if (f.craneStop) e.craneStop = true;
    });
    return e;
  };

  function eventDef(id) {
    for (var i = 0; i < D.EVENTS.length; i++) if (D.EVENTS[i].id === id) return D.EVENTS[i];
    return null;
  }
  S.eventDef = eventDef;

  /* ------------------------------------------------------------------
     Schiffe
     ------------------------------------------------------------------ */

  function makeManifest(rng, teu, level) {
    var out = [];
    var left = teu;
    D.CARGO.forEach(function (c, i) {
      var share = c.share * (0.7 + rng() * 0.6);
      var n = Math.round(teu * share);
      if (i === D.CARGO.length - 1) n = Math.max(0, left);
      n = Math.min(n, left);
      left -= n;
      if (n > 0) out.push({ kind: c.id, teu: n });
    });
    if (left > 0 && out.length) out[0].teu += left;
    return out;
  }

  S.spawnShip = function (s, rng, forceClass) {
    var classes = D.SHIP_CLASSES.filter(function (c) { return c.minLevel <= s.level; });
    if (!classes.length) classes = [D.SHIP_CLASSES[0]];
    var cls = forceClass ? D.shipClass(forceClass) : classes[rng.int(classes.length)];

    // Vertraege erhoehen die Wahrscheinlichkeit ihrer Klasse
    if (!forceClass && s.contracts.length && rng() < 0.6) {
      var c = s.contracts[rng.int(s.contracts.length)];
      var cc = D.shipClass(c.shipClass);
      if (cc.minLevel <= s.level) cls = cc;
    }

    var lines = D.LINES.filter(function (l) { return l.minLevel <= s.level; });
    var line = lines[rng.int(lines.length)];
    var load = Math.round(cls.teu * (0.35 + rng() * 0.5));
    var contract = null;
    for (var i = 0; i < s.contracts.length; i++) {
      if (s.contracts[i].line === line.id) contract = s.contracts[i];
    }

    var ship = {
      id: s.nextShipId++,
      cls: cls.id, line: line.id,
      name: shipName(rng, line),
      teu: load,
      manifest: makeManifest(rng, load, s.level),
      unloaded: 0, loaded: 0,
      toLoad: Math.round(load * (0.5 + rng() * 0.4)),
      state: 'warten',        // warten | anlegen | laden | ablegen | weg
      berth: -1,
      arrived: s.time,
      /* Das Zeitfenster geht von einem gut ausgebauten Terminal aus:
         rund 70 Bewegungen je Stunde. Wer weniger hat, zahlt Liegegeld. */
      window: 8 + Math.round(load * 1.6 / 70) + rng.int(8),
      waited: 0,
      workT: 0,
      tariff: contract ? contract.tariff : Math.round(D.ECON.baseTariff * (0.85 + rng() * 0.35)),
      contract: contract ? contract.id : null,
      progress: 0,
      x: -0.1 - rng() * 0.3,
    };
    s.ships.push(ship);
    return ship;
  };

  var SHIP_WORDS_A = ['Nordlicht', 'Seestern', 'Albatros', 'Windsbraut', 'Poseidon',
    'Fortuna', 'Meridian', 'Kormoran', 'Anker', 'Atlantik', 'Baltica', 'Hanse',
    'Orion', 'Neptun', 'Delphin', 'Möwe', 'Sturmvogel', 'Kompass'];
  var SHIP_WORDS_B = ['Express', 'Trader', 'Carrier', 'Voyager', 'Pioneer',
    'Spirit', 'Star', 'Bridge', 'Runner', 'Line'];

  function shipName(rng, line) {
    return rng.pick(SHIP_WORDS_A) + ' ' + rng.pick(SHIP_WORDS_B);
  }

  /* Freien Liegeplatz suchen, der lang und tief genug ist */
  S.findBerth = function (s, ship) {
    var cls = D.shipClass(ship.cls);
    if (cls.draft > s.depth) return -1;
    var berths = S.berths(s);
    for (var i = 0; i < berths.length; i++) {
      var b = berths[i];
      if (b.meters < cls.len) continue;
      if (!b.cranes.length) continue;
      var busy = false;
      for (var k = 0; k < s.ships.length; k++) {
        var o = s.ships[k];
        if (o !== ship && o.berth === i && (o.state === 'laden' || o.state === 'anlegen')) busy = true;
      }
      if (!busy) return i;
    }
    return -1;
  };

  /* ------------------------------------------------------------------
     Yard
     ------------------------------------------------------------------ */

  function yardKindOf(cargo) {
    if (cargo === 'reefer') return 'reefer';
    if (cargo === 'hazmat') return 'hazmat';
    if (cargo === 'emptybox') return 'empty';
    return 'normal';
  }

  S.yardFree = function (s, kind) {
    var cap = S.yardCapacity(s);
    return Math.max(0, cap[kind] - s.yard[kind]);
  };

  /* Legt Container ins Yard. Gibt es keine passende Sonderflaeche
     (Reefer, Gefahrgut, Leerdepot), landen sie notdürftig auf der
     normalen Fläche - sonst käme ein Terminal ohne Reefer-Block nie
     mit einem Schiff fertig. Der Tarif dafür wird andernorts gekürzt. */
  function addBox(s, cargo, n) {
    var kind = yardKindOf(cargo);
    var free = S.yardFree(s, kind);
    var fallback = false;
    if (free <= 0 && kind !== 'normal') {
      kind = 'normal';
      free = S.yardFree(s, kind);
      fallback = true;
    }
    var take = Math.min(n, free);
    if (take <= 0) return 0;
    s.yard[kind] += take;
    s.boxes.push({ kind: kind, cargo: cargo, teu: take, days: 0, improvised: fallback });
    return take;
  }

  /* Wie viele Exportcontainer liegen schon bereit? */
  function exportWaiting(s) {
    var n = 0;
    for (var i = 0; i < s.boxes.length; i++) {
      if (s.boxes[i].cargo === 'export') n += s.boxes[i].teu;
    }
    return n;
  }

  /* Nimmt Container aus dem Yard. Mit prefer wird zuerst die passende
     Sorte gesucht (Exportkisten fuer die Beladung), sonst der Reihe nach. */
  function removeBox(s, n, prefer) {
    var moved = 0;
    if (prefer) {
      for (var i = 0; i < s.boxes.length && moved < n; i++) {
        var p = s.boxes[i];
        if (p.cargo !== prefer) continue;
        var t = Math.min(p.teu, n - moved);
        p.teu -= t;
        s.yard[p.kind] -= t;
        moved += t;
        if (p.teu <= 0) { s.boxes.splice(i, 1); i--; }
      }
      return moved;
    }
    while (moved < n && s.boxes.length) {
      var b = s.boxes[0];
      var take = Math.min(b.teu, n - moved);
      b.teu -= take;
      s.yard[b.kind] -= take;
      moved += take;
      if (b.teu <= 0) s.boxes.shift();
    }
    return moved;
  }

  /* ------------------------------------------------------------------
     Schritt
     ------------------------------------------------------------------ */

  S.step = function (s, dt) {
    if (s.paused) return;
    var hours = dt * HOURS_PER_SECOND * s.speed;
    if (hours <= 0) return;

    var rng = U.rng((s.seed + Math.floor(s.time * 97)) >>> 0);
    var prevDay = Math.floor(s.time / 24);
    s.time += hours;
    var newDay = Math.floor(s.time / 24);

    var eff = S.effects(s);
    var staff = S.staffing(s);
    var power = S.power(s);
    var shiftF = S.shiftFactor(s);
    var powerF = power.ok ? 1 : Math.max(0.25, power.supply / Math.max(1, power.demand));

    /* --- Schiffe anlanden --- */
    stepArrivals(s, rng, hours, eff);

    /* --- Kai --- */
    var craneInfo = S.craneRate(s);
    var craneCap = craneInfo.rate * eff.craneMul * staff.kran.ratio * powerF * shiftF;
    if (eff.craneStop) craneCap = 0;
    var vehCap = S.vehicleRate(s) * staff.yard.ratio * shiftF;
    var effRate = Math.min(craneCap, vehCap * 1.15);
    var rehandle = s.tech.indexOf('tos') >= 0 ? 0.85 : 1;
    effRate *= rehandle;

    stepShips(s, hours, effRate, eff);

    /* --- Hinterland ---
       Das Gate arbeitet in beide Richtungen: es holt Importcontainer ab
       und liefert Exportcontainer an, damit auch beladen werden kann. */
    var gate = S.gateRate(s) * eff.gateMul * staff.zoll.ratio * shiftF;
    var rail = S.railRate(s) * staff.yard.ratio * shiftF;
    var capacity = (gate + rail) * hours;
    var wantExport = 0;
    for (var si = 0; si < s.ships.length; si++) {
      var sp = s.ships[si];
      if (sp.state === 'laden' || sp.state === 'anlegen' || sp.state === 'warten') {
        wantExport += Math.max(0, sp.toLoad - sp.loaded);
      }
    }
    var inShare = wantExport > 0 ? 0.45 : 0;
    var out = Math.round(capacity * (1 - inShare));
    var incoming = Math.round(capacity * inShare);

    if (out > 0) {
      var moved = removeBox(s, out);
      var railShare = rail / Math.max(0.001, gate + rail);
      var byRail = Math.round(moved * railShare);
      var byTruck = moved - byRail;
      earn(s, 'gate', byTruck * D.ECON.truckRevenue);
      earn(s, 'rail', byRail * D.ECON.railRevenue);
    }
    if (incoming > 0) {
      var room = Math.min(incoming, wantExport - exportWaiting(s));
      if (room > 0) addBox(s, 'export', room);
    }

    /* --- Lagergebuehr und Alterung --- */
    var shed = S.list(s, 'shed').length;
    for (var i = 0; i < s.boxes.length; i++) {
      var b = s.boxes[i];
      b.days += hours / 24;
      if (b.days > D.ECON.freeDays) {
        earn(s, 'storage', b.teu * D.ECON.storageFee * (hours / 24) * (1 + shed * D.byId('shed').storeBonus));
      }
    }

    /* --- Laufende Kosten --- */
    stepCosts(s, hours, power, staff);

    /* --- Ereignisse --- */
    stepEvents(s, rng, hours);

    /* --- Forschung --- */
    if (s.research) {
      s.research.daysLeft -= hours / 24;
      if (s.research.daysLeft <= 0) {
        s.tech.push(s.research.id);
        var t = D.techById(s.research.id);
        pushAlert(s, 'good', '🔬', 'Forschung fertig: ' + (t ? t.name : ''));
        s.research = null;
      }
    }

    /* --- Tageswechsel --- */
    if (newDay > prevDay) {
      for (var d = prevDay; d < newDay; d++) endOfDay(s, rng);
    }

    /* --- Level und Ziele --- */
    var lv = D.levelFor(s.stats.teu);
    if (lv > s.level) {
      s.level = lv;
      pushAlert(s, 'good', '⭐', 'Terminal-Level ' + lv + ' erreicht!');
      refreshOffers(s, rng);
    }
    checkGoals(s);
  };

  function stepArrivals(s, rng, hours, eff) {
    var berths = S.berths(s).length;
    if (!berths) return;
    var base = 0.055 * berths * (1 + s.level * 0.16) * (0.6 + s.reputation / 130);
    base *= eff.arrivalMul;
    s.contracts.forEach(function (c) { base *= 1 + c.volume / 2600; });
    var expected = base * hours;
    if (rng() < expected) S.spawnShip(s, rng);
  }

  function stepShips(s, hours, rate, eff) {
    var working = [];
    for (var i = 0; i < s.ships.length; i++) {
      var sh = s.ships[i];
      if (sh.state === 'laden') working.push(sh);
    }

    // Bewegungen auf die arbeitenden Schiffe verteilen
    var perShip = working.length ? (rate * hours) / working.length : 0;

    for (i = s.ships.length - 1; i >= 0; i--) {
      var ship = s.ships[i];
      var cls = D.shipClass(ship.cls);

      if (ship.state === 'warten') {
        ship.waited += hours;
        ship.x = Math.min(-0.02, ship.x + hours * 0.004);
        var b = S.findBerth(s, ship);
        if (b >= 0) {
          ship.berth = b;
          ship.state = 'anlegen';
          var tugs = s.vehicles.tug || 0;
          ship.dockT = (cls.len > 200 && tugs < 1) ? 3 : 1;
        } else if (ship.waited > ship.window * 2.2) {
          // Zu lange gewartet - das Schiff faehrt weiter
          s.ships.splice(i, 1);
          s.reputation = Math.max(0, s.reputation - 4);
          pushAlert(s, 'bad', '🚢', ship.name + ' ist abgedreht — zu lange keinen Liegeplatz.');
        }
        continue;
      }

      if (ship.state === 'anlegen') {
        ship.dockT -= hours;
        ship.x = U.clamp(ship.x + hours * 0.12, -0.4, 0);
        if (ship.dockT <= 0) {
          ship.state = 'laden';
          ship.x = 0;
          if (S.list(s, 'bunker').length) earn(s, 'bunker', D.ECON.bunkerFee);
        }
        continue;
      }

      if (ship.state === 'laden') {
        ship.workT += hours;
        var moves = perShip;
        // Entladen zuerst, dann laden
        var done = 0;
        while (done < moves && ship.unloaded < ship.teu) {
          var mf = null;
          for (var k = 0; k < ship.manifest.length; k++) {
            if (ship.manifest[k].teu > 0) { mf = ship.manifest[k]; break; }
          }
          if (!mf) break;
          var chunk = Math.min(mf.teu, Math.ceil(moves - done), 30);
          var placed = addBox(s, mf.kind, chunk);
          if (placed <= 0) {
            // Yard voll: der Kai steht
            if (!ship.yardWarn) {
              ship.yardWarn = true;
              pushAlert(s, 'bad', '▦', 'Das Yard ist voll — die Abfertigung stockt.');
            }
            break;
          }
          mf.teu -= placed;
          ship.unloaded += placed;
          done += placed;
          s.stats.moves += placed;
          var cargoDef = null;
          for (var q = 0; q < D.CARGO.length; q++) if (D.CARGO[q].id === mf.kind) cargoDef = D.CARGO[q];
          earn(s, 'tariff', placed * ship.tariff * (cargoDef ? cargoDef.tariff : 1) * eff.tariffMul);
          s.stats.teu += placed;
        }
        // Beladen aus dem Yard - bevorzugt mit den angelieferten Exportkisten
        while (done < moves && ship.loaded < ship.toLoad) {
          var want = Math.min(ship.toLoad - ship.loaded, Math.ceil(moves - done), 30);
          var got = removeBox(s, want, 'export');
          if (got <= 0) got = removeBox(s, want);
          if (got <= 0) break;
          ship.loaded += got;
          done += got;
          s.stats.moves += got;
          earn(s, 'tariff', got * ship.tariff * 0.85 * eff.tariffMul);
          s.stats.teu += got;
        }

        ship.progress = (ship.unloaded + ship.loaded) / Math.max(1, ship.teu + ship.toLoad);

        if (ship.unloaded >= ship.teu && ship.loaded >= ship.toLoad) {
          finishShip(s, ship);
        } else if (ship.workT > ship.window * 2.5) {
          // Notausgang: das Schiff legt unfertig ab, damit der
          // Liegeplatz nicht dauerhaft blockiert bleibt.
          ship.toLoad = ship.loaded;
          ship.teu = ship.unloaded;
          ship.manifest = [];
          s.reputation = Math.max(0, s.reputation - 6);
          pushAlert(s, 'bad', '🚢', ship.name + ' legt unfertig ab — der Umschlag war zu langsam.');
          finishShip(s, ship);
        } else if (ship.workT > ship.window) {
          // Liegezeit ueberschritten
          var over = hours;
          spend(s, 'penalty', over * D.ECON.demurrage);
        }
        continue;
      }

      if (ship.state === 'ablegen') {
        ship.x += hours * 0.16;
        if (ship.x > 1.3) s.ships.splice(i, 1);
      }
    }
  }

  function finishShip(s, ship) {
    ship.state = 'ablegen';
    s.stats.shipsDone++;
    s.stats.byClass[ship.cls] = (s.stats.byClass[ship.cls] || 0) + 1;
    var early = ship.window - ship.workT;
    if (early > 0) {
      // Der Bonus bleibt unter einem Sechstel der Umschlagerloese dieses Schiffs
      var cap = (ship.unloaded + ship.loaded) * ship.tariff * 0.16;
      var bonus = Math.round(Math.min(early * D.ECON.dispatchBonus, cap));
      earn(s, 'bonus', bonus);
      s.reputation = Math.min(100, s.reputation + 1.4);
      pushAlert(s, 'good', '⏱', ship.name + ' vorzeitig fertig (+' + U.euro(bonus, true) + ')');
    } else {
      s.reputation = Math.max(0, s.reputation - 1.2);
      pushAlert(s, 'warn', '⏱', ship.name + ' lag zu lange am Kai.');
    }
    // Vertragsfortschritt
    if (ship.contract) {
      for (var i = 0; i < s.contracts.length; i++) {
        if (s.contracts[i].id === ship.contract) {
          s.contracts[i].done += ship.unloaded + ship.loaded;
        }
      }
    }
  }

  function stepCosts(s, hours, power, staff) {
    var map = null;
    for (var i = 0; i < D.MAPS.length; i++) if (D.MAPS[i].id === s.mapId) map = D.MAPS[i];
    var wageMul = (map && map.wageMul) || 1;
    var sh = D.SHIFTS[s.shift - 1] || D.SHIFTS[1];

    var wages = 0;
    for (var k in s.crew) {
      var def = D.staffById(k);
      if (def) wages += def.wage * s.crew[k] * wageMul * sh.wageMul;
    }
    spend(s, 'wages', wages * (hours / 24));

    var upkeep = 0;
    S.list(s).forEach(function (b) {
      var d = D.byId(b.def);
      if (d) upkeep += d.upkeep;
    });
    for (var vid in s.vehicles) {
      var vd = D.vehicleById(vid);
      if (vd) upkeep += vd.upkeep * s.vehicles[vid];
    }
    var maintFactor = S.list(s, 'workshop').length ? 0.78 : 1;
    spend(s, 'upkeep', upkeep * (hours / 24) * maintFactor);

    spend(s, 'power', power.demand * hours * D.ECON.powerPrice);

    var dieselMul = s.tech.indexOf('edrive') >= 0 ? 0.5 : 1;
    var diesel = 0;
    for (vid in s.vehicles) {
      var v2 = D.vehicleById(vid);
      if (v2 && v2.diesel) diesel += v2.diesel * s.vehicles[vid];
    }
    spend(s, 'diesel', diesel * hours * D.ECON.dieselPrice * dieselMul * S.shiftFactor(s));

    if (s.loan > 0) {
      spend(s, 'interest', s.loan * D.ECON.loanRate * (hours / 24 / 365));
    }
  }

  function stepEvents(s, rng, hours) {
    for (var i = s.events.length - 1; i >= 0; i--) {
      s.events[i].left -= hours;
      if (s.events[i].left <= 0) {
        var d = eventDef(s.events[i].id);
        if (d && d.effect && d.effect.craneDown) {
          S.listKind(s, 'crane').forEach(function (c) { c.down = 0; });
        }
        s.events.splice(i, 1);
      }
    }

    var chance = 0.006 * hours * (1 + s.level * 0.05);
    if (rng() > chance) return;

    var pool = D.EVENTS.filter(function (e) {
      if (e.needsLowMorale && s.morale > 45) return false;
      for (var k = 0; k < s.events.length; k++) if (s.events[k].id === e.id) return false;
      return true;
    });
    if (!pool.length) return;
    var ev = rng.weighted(pool, 'weight');
    var dur = ev.dur[0] + rng() * (ev.dur[1] - ev.dur[0]);
    s.events.push({ id: ev.id, left: dur, total: dur });

    if (ev.effect.instantCost) {
      var c = ev.effect.instantCost[0] + rng() * (ev.effect.instantCost[1] - ev.effect.instantCost[0]);
      spend(s, 'penalty', c);
    }
    if (ev.effect.craneDown) {
      var cranes = S.listKind(s, 'crane');
      if (cranes.length) {
        var pick = cranes[rng.int(cranes.length)];
        var repair = S.list(s, 'workshop').length ? 0.5 : 1;
        var mFactor = s.tech.indexOf('maint') >= 0 ? 0.5 : 1;
        pick.down = dur * repair * mFactor;
      }
    }
    if (ev.effect.inspection) {
      var ok = s.morale > 55 && S.list(s, 'workshop').length > 0;
      if (ok) {
        s.reputation = Math.min(100, s.reputation + 5);
        pushAlert(s, 'good', '🔍', 'Inspektion bestanden — der Ruf steigt.');
      } else {
        spend(s, 'penalty', 45000);
        pushAlert(s, 'bad', '🔍', 'Inspektion beanstandet — 45.000 € Auflagen.');
      }
    }
    pushAlert(s, ev.kind === 'good' ? 'good' : (ev.kind === 'warn' ? 'warn' : 'bad'),
      ev.icon, ev.name + ': ' + ev.desc);
  }

  function endOfDay(s, rng) {
    s.day++;
    s.stats.days++;

    // Stimmung
    var sh = D.SHIFTS[s.shift - 1] || D.SHIFTS[1];
    var target = 62 - (sh.id - 2) * 12;
    S.list(s, 'canteen').forEach(function () { target += D.byId('canteen').morale; });
    var staff = S.staffing(s);
    target -= (1 - staff.overall) * 40;
    if (s.cash < 0) target -= 20;
    s.morale = U.clamp(s.morale + (target - s.morale) * 0.25, 0, 100);

    // Ruf sinkt langsam ohne Aktivitaet
    s.reputation = U.clamp(s.reputation + (s.stats.shipsDone > 0 ? 0.1 : -0.2), 0, 100);

    // Tagesbilanz
    var dayProfit = 0;
    for (var k in s.ledger) {
      var delta = s.ledger[k] - s.dayLedger[k];
      if (['tariff', 'storage', 'gate', 'rail', 'bunker', 'bonus'].indexOf(k) >= 0) dayProfit += delta;
      else dayProfit -= delta;
    }
    s.stats.history.push({
      day: s.day,
      teu: s.stats.teu,
      profit: Math.round(dayProfit),
      cash: Math.round(s.cash),
    });
    if (s.stats.history.length > 120) s.stats.history.shift();
    s.dayLedger = U.assign({}, s.ledger);

    // Vertraege pruefen
    for (var i = s.contracts.length - 1; i >= 0; i--) {
      var c = s.contracts[i];
      c.daysLeft--;
      if (c.daysLeft <= 0) {
        if (c.done >= c.volume) {
          var bonus = Math.round(c.volume * c.tariff * 0.12);
          earn(s, 'bonus', bonus);
          s.reputation = Math.min(100, s.reputation + 6);
          pushAlert(s, 'good', '📜', 'Vertrag mit ' + lineName(c.line) + ' erfüllt (+' + U.euro(bonus, true) + ')');
        } else {
          spend(s, 'penalty', c.penalty);
          s.reputation = Math.max(0, s.reputation - 8);
          pushAlert(s, 'bad', '📜', 'Vertrag mit ' + lineName(c.line) + ' verfehlt — ' + U.euro(c.penalty, true) + ' Strafe.');
        }
        s.contracts.splice(i, 1);
      }
    }

    // Alle paar Tage neue Angebote
    if (s.day % 4 === 0) refreshOffers(s, rng);

    // Quartalssteuer
    if (s.day % 90 === 0) {
      var profit = 0;
      s.stats.history.slice(-90).forEach(function (h) { profit += h.profit; });
      if (profit > 0) {
        var tax = profit * D.ECON.taxRate;
        spend(s, 'tax', tax);
        pushAlert(s, 'warn', '🧾', 'Quartalssteuer: ' + U.euro(Math.round(tax), true));
      }
    }
  }

  function lineName(id) {
    for (var i = 0; i < D.LINES.length; i++) if (D.LINES[i].id === id) return D.LINES[i].name;
    return id;
  }
  S.lineName = lineName;

  /* ------------------------------------------------------------------
     Vertraege
     ------------------------------------------------------------------ */

  function refreshOffers(s, rng) {
    rng = rng || U.rng((s.seed + s.day * 31) >>> 0);
    var lines = D.LINES.filter(function (l) { return l.minLevel <= s.level; });
    s.offers = [];
    var n = 2 + Math.min(3, Math.floor(s.level / 3));
    for (var i = 0; i < n; i++) {
      var line = lines[rng.int(lines.length)];
      var classes = D.SHIP_CLASSES.filter(function (c) { return c.minLevel <= s.level; });
      var cls = classes[rng.int(classes.length)];
      var days = 20 + rng.int(45);
      var volume = Math.round(cls.teu * (0.6 + rng() * 1.4) * (days / 30));
      var quality = 0.85 + rng() * 0.45 + s.reputation / 400;
      var tariff = Math.round(D.ECON.baseTariff * quality);
      s.offers.push({
        id: 'c' + (s.day * 10 + i) + '_' + rng.int(9999),
        line: line.id,
        shipClass: cls.id,
        volume: volume,
        days: days, daysLeft: days,
        tariff: tariff,
        penalty: Math.round(volume * tariff * 0.22),
        done: 0,
      });
    }
  }
  S.refreshOffers = refreshOffers;

  S.acceptOffer = function (s, id) {
    for (var i = 0; i < s.offers.length; i++) {
      if (s.offers[i].id !== id) continue;
      if (s.contracts.length >= 2 + Math.floor(s.level / 3)) {
        return 'Mehr Verträge schaffst du gerade nicht.';
      }
      s.contracts.push(s.offers[i]);
      s.offers.splice(i, 1);
      return null;
    }
    return 'Angebot nicht mehr verfügbar.';
  };

  /* ------------------------------------------------------------------
     Aktionen
     ------------------------------------------------------------------ */

  S.buyVehicle = function (s, id, n) {
    var d = D.vehicleById(id);
    if (!d) return 'Unbekannt.';
    if (d.needLevel && s.level < d.needLevel) return 'Erst ab Level ' + d.needLevel + '.';
    if (d.needTech && s.tech.indexOf(d.needTech) < 0) return 'Dafür fehlt die Forschung.';
    n = n || 1;
    if (s.cash < d.cost * n) return 'Nicht genug Geld.';
    s.cash -= d.cost * n;
    s.vehicles[id] = (s.vehicles[id] || 0) + n;
    return null;
  };

  S.sellVehicle = function (s, id, n) {
    n = n || 1;
    if (!s.vehicles[id] || s.vehicles[id] < n) return 'So viele hast du nicht.';
    var d = D.vehicleById(id);
    s.vehicles[id] -= n;
    if (!s.vehicles[id]) delete s.vehicles[id];
    s.cash += Math.round(d.cost * 0.45 * n);
    return null;
  };

  S.hire = function (s, role, n) {
    n = n === undefined ? 1 : n;
    s.crew[role] = Math.max(0, (s.crew[role] || 0) + n);
    return null;
  };

  S.startResearch = function (s, id) {
    if (s.research) return 'Es läuft schon eine Forschung.';
    if (s.tech.indexOf(id) >= 0) return 'Schon erforscht.';
    var t = D.techById(id);
    if (!t) return 'Unbekannt.';
    for (var i = 0; i < t.needs.length; i++) {
      if (s.tech.indexOf(t.needs[i]) < 0) return 'Voraussetzung fehlt.';
    }
    if (s.cash < t.cost) return 'Nicht genug Geld.';
    s.cash -= t.cost;
    s.research = { id: id, daysLeft: t.days, total: t.days };
    return null;
  };

  S.dredge = function (s, meters) {
    var target = Math.min(D.ECON.maxDepth, s.depth + meters);
    var delta = target - s.depth;
    if (delta <= 0) return 'Tiefer geht es hier nicht.';
    var berthTiles = 0;
    S.list(s, 'quay').forEach(function (q) { berthTiles += q.w; });
    if (!berthTiles) return 'Bagger erst, wenn es eine Kaimauer gibt.';
    var cost = Math.round(D.ECON.dredgeCost * delta * Math.max(4, berthTiles));
    if (s.cash < cost) return 'Das kostet ' + U.euro(cost) + ' — so viel hast du nicht.';
    s.cash -= cost;
    s.depth = target;
    s.dredged += delta;
    return null;
  };

  S.dredgeCost = function (s, meters) {
    var berthTiles = 0;
    S.list(s, 'quay').forEach(function (q) { berthTiles += q.w; });
    return Math.round(D.ECON.dredgeCost * meters * Math.max(4, berthTiles));
  };

  S.takeLoan = function (s, amount) {
    if (s.loan + amount > D.ECON.loanMax) return 'Die Bank gibt nicht mehr.';
    s.loan += amount;
    s.cash += amount;
    return null;
  };

  S.repayLoan = function (s, amount) {
    amount = Math.min(amount, s.loan, s.cash);
    if (amount <= 0) return 'Nichts zurückzuzahlen.';
    s.loan -= amount;
    s.cash -= amount;
    return null;
  };

  /* ------------------------------------------------------------------
     Buchhaltung und Meldungen
     ------------------------------------------------------------------ */

  function earn(s, key, amount) {
    if (!isFinite(amount) || amount <= 0) return;
    s.cash += amount;
    s.ledger[key] = (s.ledger[key] || 0) + amount;
    s.stats.revenue += amount;
  }
  function spend(s, key, amount) {
    if (!isFinite(amount) || amount <= 0) return;
    s.cash -= amount;
    s.ledger[key] = (s.ledger[key] || 0) + amount;
    s.stats.costs += amount;
  }
  S.earn = earn;
  S.spend = spend;

  function pushAlert(s, kind, icon, text) {
    s.alerts.push({ kind: kind, icon: icon, text: text, t: 6, time: s.time });
    if (s.alerts.length > 30) s.alerts.shift();
  }
  S.pushAlert = pushAlert;

  function checkGoals(s) {
    var snap = {
      counts: {
        quay: S.list(s, 'quay').length,
        crane: S.listKind(s, 'crane').length,
      },
      stats: s.stats, contracts: s.contracts, level: s.level,
      tech: s.tech, depth: s.depth, cash: s.cash, loan: s.loan,
    };
    /* Die Ziele sind eine Kette: es zaehlt immer nur das naechste offene.
       Sonst waeren gleich zu Beginn welche erfuellt, die noch gar nicht
       an der Reihe sind. */
    for (var i = 0; i < s.goals.length; i++) {
      if (s.goals[i].done) continue;
      var def = null;
      for (var k = 0; k < D.GOALS.length; k++) if (D.GOALS[k].id === s.goals[i].id) def = D.GOALS[k];
      if (!def) break;
      var ok = false;
      try { ok = def.check(snap); } catch (e) { ok = false; }
      if (!ok) break;
      s.goals[i].done = true;
      s.cash += def.reward;
      pushAlert(s, 'good', '🎯', 'Ziel geschafft: ' + def.text + ' (+' + U.euro(def.reward, true) + ')');
    }
  }

  S.currentGoal = function (s) {
    for (var i = 0; i < s.goals.length; i++) {
      if (!s.goals[i].done) {
        for (var k = 0; k < D.GOALS.length; k++) if (D.GOALS[k].id === s.goals[i].id) return D.GOALS[k];
      }
    }
    return null;
  };

  /* ------------------------------------------------------------------
     Speichern
     ------------------------------------------------------------------ */

  S.serialize = function (s) {
    var o = U.assign({}, s);
    o.grid = Array.prototype.slice.call(s.grid);
    return o;
  };

  S.deserialize = function (o) {
    if (!o || !o.mapId) return null;
    var s = U.assign({}, o);
    s.grid = Int16Array.from(o.grid || []);
    // Fehlende Felder aus einer aelteren Fassung ergaenzen
    var fresh = S.create(o.mapId, o.seed);
    for (var k in fresh) if (s[k] === undefined) s[k] = fresh[k];
    if (!s.dayLedger) s.dayLedger = U.assign({}, s.ledger);
    return s;
  };

  S.HOURS_PER_SECOND = HOURS_PER_SECOND;
})(SG);
