/* ------------------------------------------------------------------
   Geheimagenten-Tycoon - Simulation

   Zeitmass: ein Spieltag dauert bei 1x zwoelf Sekunden. Missionen
   laufen ueber mehrere Stunden bis Tage, die Auswertung selbst ist
   ein eigener, interaktiver Ablauf (siehe 3-mission.js).
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var A = SG.tycoon.spy;
  var D = A.data;

  var S = A.sim = {};

  var DAYS_PER_SECOND = 1 / 12;    // 1x: zwoelf Sekunden je Tag

  S.DAYS_PER_SECOND = DAYS_PER_SECOND;

  /* ------------------------------------------------------------------
     Aufbau
     ------------------------------------------------------------------ */

  S.create = function (seed) {
    var rng = U.rng((seed || ((Date.now() ^ (Math.random() * 1e9)) >>> 0)) >>> 0);
    var s = {
      version: 1,
      seed: rng.seedOf(),
      day: 0,
      time: 0,                 // Tage seit Start (mit Nachkommastellen)
      cash: D.ECON.start,
      xp: 0,
      level: 1,
      reputation: 40,

      rooms: [],
      grid: null,              // floors × w × h

      agents: [],
      recruits: [],
      nextAgentId: 1,

      missions: [],            // verfuegbare Auftraege
      active: [],              // laufende Einsaetze
      nextMissionId: 1,

      gadgets: {},             // id -> Anzahl
      tech: [],
      research: null,

      regions: D.REGIONS.map(function (r) {
        return {
          id: r.id, heat: 0, influence: r.minLevel <= 1 ? 25 : 0,
          unlocked: r.minLevel <= 1, threat: 20 + Math.round(rng() * 20),
        };
      }),

      enemies: D.ENEMIES.map(function (e) {
        return { id: e.id, power: 100, known: 0, moleRisk: 0 };
      }),

      clients: D.CLIENTS.map(function (c) {
        return { id: c.id, standing: 50 };
      }),

      story: D.STORY.map(function (g) { return { id: g.id, done: false }; }),
      alerts: [],
      log: [],

      stats: { won: 0, lost: 0, missions: 0, earned: 0, spent: 0, history: [] },
      ledger: { fees: 0, business: 0, salaries: 0, upkeep: 0, gadgets: 0, research: 0,
        bribes: 0, penalties: 0, tax: 0 },
      dayLedger: null,

      paused: false,
      speed: 1,
      captured: [],            // gefangene Agenten
    };

    s.grid = [];
    for (var f = 0; f < D.HQ.floors; f++) {
      s.grid.push(new Int16Array(D.HQ.w * D.HQ.h));
    }
    s.dayLedger = U.assign({}, s.ledger);

    // Kommandozentrale steht von Anfang an
    S.build(s, 'zentrale', 0, 0, 0, true);

    // Startmannschaft
    for (var i = 0; i < 3; i++) s.agents.push(S.makeAgent(s, rng, 1));
    S.refreshRecruits(s, rng);
    S.refreshMissions(s, rng);
    return s;
  };

  /* ------------------------------------------------------------------
     Hauptquartier
     ------------------------------------------------------------------ */

  S.roomAt = function (s, floor, x, y) {
    var v = s.grid[floor][y * D.HQ.w + x];
    return v ? S.roomByNum(s, v) : null;
  };

  S.roomByNum = function (s, n) {
    for (var i = 0; i < s.rooms.length; i++) if (s.rooms[i].n === n) return s.rooms[i];
    return null;
  };

  S.canBuild = function (s, id, floor, x, y) {
    var def = D.roomById(id);
    if (!def) return 'Unbekannter Raum.';
    if (floor < 0 || floor >= D.HQ.floors) return 'Diese Etage gibt es nicht.';
    if (floor > 0 && s.level < 3 + (floor - 1) * 3) {
      return 'Etage ' + (floor + 1) + ' wird ab Agentur-Level ' + (3 + (floor - 1) * 3) + ' freigeschaltet.';
    }
    if (x < 0 || y < 0 || x + def.w > D.HQ.w || y + def.h > D.HQ.h) return 'Passt nicht ins Raster.';
    if (def.unique && S.hasRoom(s, id)) return 'Diesen Raum gibt es nur einmal.';
    for (var yy = y; yy < y + def.h; yy++) {
      for (var xx = x; xx < x + def.w; xx++) {
        if (s.grid[floor][yy * D.HQ.w + xx]) return 'Da steht schon etwas.';
      }
    }
    return null;
  };

  S.build = function (s, id, floor, x, y, free) {
    var def = D.roomById(id);
    var why = S.canBuild(s, id, floor, x, y);
    if (why) return why;
    if (!free && s.cash < def.cost) return 'Nicht genug Geld.';
    if (!free) s.cash -= def.cost;

    var n = 1;
    for (var i = 0; i < s.rooms.length; i++) n = Math.max(n, s.rooms[i].n + 1);
    var room = { id: id, n: n, floor: floor, x: x, y: y, w: def.w, h: def.h };
    s.rooms.push(room);
    for (var yy = y; yy < y + def.h; yy++) {
      for (var xx = x; xx < x + def.w; xx++) {
        s.grid[floor][yy * D.HQ.w + xx] = n;
      }
    }
    return null;
  };

  S.demolish = function (s, room) {
    if (!room) return;
    var def = D.roomById(room.id);
    if (def && def.unique) return;
    for (var yy = room.y; yy < room.y + room.h; yy++) {
      for (var xx = room.x; xx < room.x + room.w; xx++) {
        if (s.grid[room.floor][yy * D.HQ.w + xx] === room.n) {
          s.grid[room.floor][yy * D.HQ.w + xx] = 0;
        }
      }
    }
    U.remove(s.rooms, room);
    s.cash += Math.round((def ? def.cost : 0) * 0.4);
  };

  S.hasRoom = function (s, id) {
    for (var i = 0; i < s.rooms.length; i++) if (s.rooms[i].id === id) return true;
    return false;
  };

  S.countRoom = function (s, id) {
    var n = 0;
    for (var i = 0; i < s.rooms.length; i++) if (s.rooms[i].id === id) n++;
    return n;
  };

  /* Summierte Raumwirkungen */
  S.effects = function (s) {
    var e = {
      missionSlots: 1, recruitSlots: 3, recruitQuality: 0, trainSlots: 0,
      research: 0, craft: 0, hackBonus: 0, heal: 1, intel: 0, briefing: 0,
      income: 0, heatDecay: 0, travel: 1, combatBonus: 0, stressRelief: 1,
      security: 0,
    };
    for (var i = 0; i < s.rooms.length; i++) {
      var def = D.roomById(s.rooms[i].id);
      if (!def || !def.effect) continue;
      for (var k in def.effect) {
        if (k === 'travel') e.travel = Math.min(e.travel, def.effect[k]);
        else e[k] = (e[k] || 0) + def.effect[k];
      }
    }
    if (s.tech.indexOf('satellit') >= 0) e.briefing += 1;
    return e;
  };

  S.upkeep = function (s) {
    var total = 0;
    for (var i = 0; i < s.rooms.length; i++) {
      var def = D.roomById(s.rooms[i].id);
      if (def) total += def.upkeep;
    }
    return total;
  };

  /* ------------------------------------------------------------------
     Agenten
     ------------------------------------------------------------------ */

  S.makeAgent = function (s, rng, quality) {
    quality = quality || 1;
    var base = 22 + quality * 6;
    var skills = {};
    D.SKILLS.forEach(function (sk) {
      skills[sk.id] = Math.round(U.clamp(rng.normal(base, 11), 8, 78));
    });
    // Ein bis zwei Spitzenwerte
    var picks = rng.shuffle(D.SKILLS.slice()).slice(0, 1 + rng.int(2));
    picks.forEach(function (sk) {
      skills[sk.id] = Math.round(U.clamp(skills[sk.id] + 14 + rng() * 16, 10, 92));
    });

    var traits = [];
    var pool = D.TRAITS.filter(function (t) { return !t.hidden; });
    if (rng() < 0.72) traits.push(rng.pick(pool.filter(function (t) { return t.good; })).id);
    if (rng() < 0.34) traits.push(rng.pick(pool.filter(function (t) { return !t.good; })).id);

    var salaryFactor = 1;
    D.SKILLS.forEach(function (sk) { salaryFactor += skills[sk.id] / 340; });

    return {
      id: s.nextAgentId++,
      name: rng.pick(D.FIRST) + ' ' + rng.pick(D.LAST),
      code: rng.pick(D.CODENAMES),
      skills: skills,
      traits: traits,
      level: 1, xp: 0,
      loyalty: Math.round(50 + rng() * 40),
      stress: 0,
      injury: 0,
      status: 'bereit',      // bereit | einsatz | verletzt | training | gefangen
      busyUntil: 0,
      gear: [null, null],
      covers: {},            // regionId -> 1 wenn verbrannt
      salary: Math.round(D.ECON.salary * salaryFactor),
      missions: 0,
      mole: false,
    };
  };

  S.refreshRecruits = function (s, rng) {
    rng = rng || U.rng((s.seed + s.day * 17) >>> 0);
    var e = S.effects(s);
    var n = e.recruitSlots;
    s.recruits = [];
    for (var i = 0; i < n; i++) {
      s.recruits.push(S.makeAgent(s, rng, 1 + e.recruitQuality + Math.floor(s.level / 3)));
    }
  };

  S.hire = function (s, id) {
    var idx = -1;
    for (var i = 0; i < s.recruits.length; i++) if (s.recruits[i].id === id) idx = i;
    if (idx < 0) return 'Bewerber nicht gefunden.';
    if (s.agents.length >= 4 + s.level) return 'Mehr Agenten kannst du gerade nicht führen.';
    if (s.cash < D.ECON.recruitCost) return 'Nicht genug Geld für die Einstellung.';
    s.cash -= D.ECON.recruitCost;
    var a = s.recruits.splice(idx, 1)[0];

    // Kleine Chance, dass ein Maulwurf eingeschleust wurde
    var rng = U.rng((s.seed + a.id * 91) >>> 0);
    var risk = 0.05 + s.enemies.reduce(function (m, e) { return m + e.moleRisk; }, 0) / 400;
    if (rng() < risk) {
      a.mole = true;
      a.traits.push('doppelagent');
    }
    s.agents.push(a);
    return null;
  };

  S.fire = function (s, agent) {
    U.remove(s.agents, agent);
  };

  /* Wirksamer Wert einer Faehigkeit inklusive Ausruestung und Raeumen */
  S.skillValue = function (s, agent, skill) {
    var v = agent.skills[skill] || 0;
    var e = S.effects(s);

    if (agent.traits.indexOf('perfektionist') >= 0) v *= 1.1;
    if (skill === 'kampf' && agent.traits.indexOf('draufgaenger') >= 0) v *= 1.15;
    if (skill === 'tarnung' && agent.traits.indexOf('schattenlaeufer') >= 0) v *= 1.2;
    if ((skill === 'technik' || skill === 'hacking') &&
      agent.traits.indexOf('techniknarr') >= 0) v *= 1.2;
    if (skill === 'hacking') v *= 1 + e.hackBonus;
    if (skill === 'kampf' || skill === 'schuss') v *= 1 + e.combatBonus;

    // Ausruestung
    for (var i = 0; i < agent.gear.length; i++) {
      var g = D.gadgetById(agent.gear[i]);
      if (g && g.bonus[skill]) v += g.bonus[skill];
    }

    // Stress und Verletzung
    var stressFactor = agent.traits.indexOf('eiskalt') >= 0 ? 0.4 : 1;
    v *= 1 - (agent.stress / 100) * 0.35 * stressFactor;
    v *= 1 - (agent.injury / 100) * 0.4;

    v *= 1 + (agent.level - 1) * 0.06;
    return Math.max(1, Math.round(v));
  };

  S.available = function (s) {
    return s.agents.filter(function (a) { return a.status === 'bereit'; });
  };

  S.addXp = function (s, agent, xp) {
    if (s.tech.indexOf('ausbildung') >= 0) xp = Math.round(xp * 1.5);
    agent.xp += xp;
    var need = agent.level * 220;
    while (agent.xp >= need) {
      agent.xp -= need;
      agent.level++;
      // Beim Stufenaufstieg steigen zwei Werte
      var rng = U.rng((s.seed + agent.id * 31 + agent.level) >>> 0);
      var picks = rng.shuffle(D.SKILLS.slice()).slice(0, 2);
      picks.forEach(function (sk) {
        agent.skills[sk.id] = Math.min(99, agent.skills[sk.id] + 3 + rng.int(4));
      });
      pushAlert(s, 'good', '⭐', agent.code + ' ist auf Stufe ' + agent.level + ' aufgestiegen.');
      need = agent.level * 220;
    }
  };

  /* ------------------------------------------------------------------
     Missionen (Angebote)
     ------------------------------------------------------------------ */

  S.refreshMissions = function (s, rng) {
    rng = rng || U.rng((s.seed + s.day * 7919) >>> 0);
    var open = s.regions.filter(function (r) { return r.unlocked; });
    if (!open.length) return;
    var want = 3 + Math.min(5, Math.floor(s.level / 2)) + (s.tech.indexOf('satellit') >= 0 ? 2 : 0);

    // Alte Angebote laufen ab
    s.missions = s.missions.filter(function (m) { return m.expires > s.day; });

    while (s.missions.length < want) {
      var reg = rng.pick(open);
      var types = D.MISSION_TYPES.filter(function (t) { return !t.special; });
      var type = rng.pick(types);
      var diff = U.clamp(1 + Math.floor(s.level / 2) + rng.int(3) - 1, 1, 10);
      var client = rng.pick(D.CLIENTS);
      var enemy = rng() < 0.45 ? rng.pick(s.enemies) : null;

      var fee = Math.round(D.ECON.baseFee * (0.7 + diff * 0.32) *
        D.clientById(client.id).payMul * (0.85 + rng() * 0.4));

      s.missions.push({
        id: s.nextMissionId++,
        type: type.id,
        region: reg.id,
        client: client.id,
        enemy: enemy ? enemy.id : null,
        diff: diff,
        fee: fee,
        travel: Math.round((6 + rng.int(30)) * S.effects(s).travel),
        expires: s.day + 3 + rng.int(6),
        title: missionTitle(rng, type, reg),
      });
    }
  };

  var TITLE_A = ['Operation', 'Unternehmen', 'Projekt', 'Vorgang'];
  var TITLE_B = ['Nachtfalter', 'Silberdraht', 'Kaltes Licht', 'Glasauge', 'Roter Faden',
    'Steinbruch', 'Windstille', 'Schwarzes Buch', 'Leiser Regen', 'Eisblume',
    'Weißer Rabe', 'Hohle Nadel', 'Tiefer Schacht', 'Letzte Fähre'];

  function missionTitle(rng, type, reg) {
    return rng.pick(TITLE_A) + ' ' + rng.pick(TITLE_B);
  }

  /* Grobe Erfolgsaussicht eines Teams fuer eine Mission */
  S.estimate = function (s, mission, team) {
    var type = D.missionType(mission.type);
    var total = 0;
    for (var i = 0; i < type.phases.length; i++) {
      var ph = type.phases[i];
      var dc = ph.dc + mission.diff * 4;
      var best = 0;
      for (var k = 0; k < team.length; k++) {
        best = Math.max(best, S.skillValue(s, team[k], ph.skill));
      }
      // Teamgroesse hilft ein wenig
      best += (team.length - 1) * 4;
      var p = U.clamp(0.5 + (best - dc) / 90, 0.05, 0.96);
      total += p;
    }
    return total / type.phases.length;
  };

  /* ------------------------------------------------------------------
     Einsatz starten und abwickeln
     ------------------------------------------------------------------ */

  S.startMission = function (s, mission, team) {
    var type = D.missionType(mission.type);
    if (team.length < type.team[0]) return 'Mindestens ' + type.team[0] + ' Agenten nötig.';
    if (team.length > type.team[1]) return 'Höchstens ' + type.team[1] + ' Agenten.';
    var slots = S.effects(s).missionSlots;
    if (s.active.length >= slots) return 'Alle Einsatzplätze belegt (' + slots + ').';

    for (var i = 0; i < team.length; i++) {
      if (team[i].status !== 'bereit') return team[i].code + ' ist nicht einsatzbereit.';
    }
    U.remove(s.missions, mission);
    team.forEach(function (a) { a.status = 'einsatz'; });

    var run = {
      id: mission.id,
      mission: mission,
      team: team.map(function (a) { return a.id; }),
      arriveAt: s.time + mission.travel / 24,
      state: 'anreise',
      phase: 0,
      log: [],
      results: [],
      bonus: 0,
      heat: 0,
      choicePending: null,
      luckUsed: {},
    };
    s.active.push(run);
    return null;
  };

  S.teamOf = function (s, run) {
    return run.team.map(function (id) {
      for (var i = 0; i < s.agents.length; i++) if (s.agents[i].id === id) return s.agents[i];
      return null;
    }).filter(Boolean);
  };

  /* ------------------------------------------------------------------
     Tagesablauf
     ------------------------------------------------------------------ */

  S.step = function (s, dt) {
    if (s.paused) return;
    var days = dt * DAYS_PER_SECOND * s.speed;
    if (days <= 0) return;

    var prev = Math.floor(s.time);
    s.time += days;
    var now = Math.floor(s.time);

    // Anreise abwickeln
    for (var i = 0; i < s.active.length; i++) {
      var run = s.active[i];
      if (run.state === 'anreise' && s.time >= run.arriveAt) {
        run.state = 'bereit';
        pushAlert(s, 'warn', '📍', 'Team ist angekommen: ' + run.mission.title);
      }
    }

    if (now > prev) {
      for (var d = prev; d < now; d++) endOfDay(s);
    }
  };

  function endOfDay(s) {
    s.day++;
    var rng = U.rng((s.seed + s.day * 4093) >>> 0);
    var e = S.effects(s);

    // Gehaelter und Unterhalt
    var salaries = 0;
    s.agents.forEach(function (a) { salaries += a.salary; });
    spend(s, 'salaries', salaries);
    spend(s, 'upkeep', S.upkeep(s));
    if (e.income) earn(s, 'business', e.income);

    // Erholung
    s.agents.forEach(function (a) {
      a.stress = Math.max(0, a.stress - e.stressRelief - (a.traits.indexOf('nervoes') >= 0 ? 0 : 1));
      if (a.injury > 0) {
        a.injury = Math.max(0, a.injury - 6 * e.heal);
        if (a.injury <= 0 && a.status === 'verletzt') {
          a.status = 'bereit';
          pushAlert(s, 'good', '⚕', a.code + ' ist wieder einsatzbereit.');
        }
      }
      if (a.status === 'training' && s.day >= a.busyUntil) {
        a.status = 'bereit';
      }
      // Spieler kosten gelegentlich Geld
      if (a.traits.indexOf('spieler') >= 0 && rng() < 0.08) {
        var loss = 8000 + rng.int(20000);
        spend(s, 'penalties', loss);
        pushAlert(s, 'warn', '🎲', a.code + ' hat Spielschulden gemacht: ' + U.euro(loss, true));
      }
      // Loyalitaet
      if (s.cash < 0) a.loyalty = Math.max(0, a.loyalty - 3);
      else a.loyalty = Math.min(100, a.loyalty + 0.4);
      if (a.loyalty < 12 && rng() < 0.12) {
        pushAlert(s, 'bad', '🚪', a.code + ' hat gekündigt.');
        U.remove(s.agents, a);
      }
    });

    // Hitze faellt
    s.regions.forEach(function (r) {
      r.heat = Math.max(0, r.heat - (D.ECON.heatDecay + e.heatDecay));
      if (r.heat > D.ECON.heatRisk && rng() < 0.10) {
        var fine = 30000 + rng.int(70000);
        spend(s, 'penalties', fine);
        r.heat = Math.max(0, r.heat - 18);
        s.reputation = Math.max(0, s.reputation - 4);
        pushAlert(s, 'bad', '🚨', 'Ermittlungen in ' + D.regionById(r.id).name +
          ': ' + U.euro(fine, true) + ' Strafe.');
      }
      // Einfluss der Gegner wirkt auf die Bedrohung
      r.threat = U.clamp(r.threat + (rng() - 0.45) * 2, 5, 100);
    });

    // Gegner werden staerker, wenn man sie in Ruhe laesst
    s.enemies.forEach(function (en) {
      if (en.power <= 0) return;
      en.power = U.clamp(en.power + 0.35 - s.reputation / 260, 0, 100);
      en.moleRisk = U.clamp(en.moleRisk + 0.25 - (e.security ? 0.5 : 0), 0, 40);
    });

    // Maulwurf-Schaden
    var moles = s.agents.filter(function (a) { return a.mole; });
    if (moles.length) {
      var found = e.security > 0 && rng() < (0.06 + e.security * 0.06 +
        (s.tech.indexOf('gegenspionage') >= 0 ? 0.12 : 0));
      if (found) {
        var m = moles[0];
        m.mole = false;
        U.remove(m.traits, 'doppelagent');
        U.remove(s.agents, m);
        pushAlert(s, 'good', '🛡', m.code + ' war ein Maulwurf und wurde enttarnt!');
        s.enemies.forEach(function (en) { en.moleRisk = Math.max(0, en.moleRisk - 10); });
      } else if (rng() < 0.18) {
        var stolen = Math.round(10000 + rng.int(40000));
        spend(s, 'penalties', stolen);
        s.enemies.forEach(function (en) { if (en.power > 0) en.power = Math.min(100, en.power + 0.8); });
        pushAlert(s, 'bad', '🕵', 'Informationen sind abgeflossen — ' + U.euro(stolen, true) + ' Schaden.');
      }
    }

    // Forschung
    if (s.research) {
      if (S.hasRoom(s, 'labor')) s.research.daysLeft -= 1;
      if (s.research.daysLeft <= 0) {
        s.tech.push(s.research.id);
        var t = D.techById(s.research.id);
        pushAlert(s, 'good', '🔬', 'Forschung fertig: ' + (t ? t.name : ''));
        s.research = null;
      }
    }

    // Neue Auftraege und Bewerber
    if (s.day % 2 === 0) S.refreshMissions(s, rng);
    if (s.day % 6 === 0) S.refreshRecruits(s, rng);

    // Regionen freischalten
    s.regions.forEach(function (r) {
      var def = D.regionById(r.id);
      if (!r.unlocked && s.level >= def.minLevel) {
        r.unlocked = true;
        pushAlert(s, 'good', '🌍', def.name + ' ist jetzt erreichbar.');
      }
    });

    // Tagesbilanz
    var profit = 0;
    for (var k in s.ledger) {
      var delta = s.ledger[k] - s.dayLedger[k];
      if (k === 'fees' || k === 'business') profit += delta;
      else profit -= delta;
    }
    s.stats.history.push({ day: s.day, profit: Math.round(profit), cash: Math.round(s.cash) });
    if (s.stats.history.length > 120) s.stats.history.shift();
    s.dayLedger = U.assign({}, s.ledger);

    // Steuer
    if (s.day % 30 === 0) {
      var sum = 0;
      s.stats.history.slice(-30).forEach(function (h) { sum += h.profit; });
      if (sum > 0) {
        var tax = Math.round(sum * D.ECON.monthlyTax);
        spend(s, 'tax', tax);
        pushAlert(s, 'warn', '🧾', 'Monatsabgaben: ' + U.euro(tax, true));
      }
    }

    // Stufe
    var lv = D.levelFor(s.xp);
    if (lv > s.level) {
      s.level = lv;
      pushAlert(s, 'good', '⭐', 'Agentur-Level ' + lv + ' erreicht.');
    }
    checkStory(s);
  }

  /* ------------------------------------------------------------------
     Aktionen
     ------------------------------------------------------------------ */

  S.startResearch = function (s, id) {
    if (!S.hasRoom(s, 'labor')) return 'Dafür brauchst du erst ein Labor.';
    if (s.research) return 'Es läuft schon eine Forschung.';
    if (s.tech.indexOf(id) >= 0) return 'Schon erforscht.';
    var t = D.techById(id);
    if (!t) return 'Unbekannt.';
    for (var i = 0; i < t.needs.length; i++) {
      if (s.tech.indexOf(t.needs[i]) < 0) return 'Voraussetzung fehlt.';
    }
    if (s.cash < t.cost) return 'Nicht genug Geld.';
    s.cash -= t.cost;
    s.ledger.research += t.cost;
    s.research = { id: id, daysLeft: t.days, total: t.days };
    return null;
  };

  S.buyGadget = function (s, id, black) {
    var g = D.gadgetById(id);
    if (!g) return 'Unbekannt.';
    if (g.tech && s.tech.indexOf(g.tech) < 0 && !black) {
      return 'Dafür fehlt die Forschung — oder du kaufst es teuer auf dem Schwarzmarkt.';
    }
    if (!black && !S.hasRoom(s, 'werkstatt')) return 'Ohne Werkstatt lässt sich nichts bauen.';
    var cost = Math.round(g.cost * (black ? D.ECON.marketMul : 1));
    if (s.cash < cost) return 'Nicht genug Geld.';
    s.cash -= cost;
    s.ledger.gadgets += cost;
    s.gadgets[id] = (s.gadgets[id] || 0) + 1;
    if (black) {
      var r = s.regions[0];
      r.heat = Math.min(100, r.heat + 5);
    }
    return null;
  };

  S.equip = function (s, agent, slot, gadgetId) {
    if (agent.status !== 'bereit') return 'Nur einsatzbereite Agenten lassen sich ausrüsten.';
    var old = agent.gear[slot];
    if (old) s.gadgets[old] = (s.gadgets[old] || 0) + 1;
    if (gadgetId) {
      if (!s.gadgets[gadgetId]) return 'Davon hast du keines mehr.';
      s.gadgets[gadgetId]--;
      if (!s.gadgets[gadgetId]) delete s.gadgets[gadgetId];
    }
    agent.gear[slot] = gadgetId || null;
    return null;
  };

  S.train = function (s, agent, skill) {
    if (!S.hasRoom(s, 'training')) return 'Dafür brauchst du einen Trainingsraum.';
    if (agent.status !== 'bereit') return agent.code + ' ist nicht verfügbar.';
    var busy = s.agents.filter(function (a) { return a.status === 'training'; }).length;
    if (busy >= S.effects(s).trainSlots) return 'Alle Trainingsplätze belegt.';
    if (s.cash < D.ECON.trainCost) return 'Nicht genug Geld.';
    s.cash -= D.ECON.trainCost;
    agent.skills[skill] = Math.min(99, agent.skills[skill] + 2 + Math.floor(Math.random() * 3));
    agent.status = 'training';
    agent.busyUntil = s.day + 2;
    return null;
  };

  S.bribe = function (s, regionId) {
    var r = null;
    for (var i = 0; i < s.regions.length; i++) if (s.regions[i].id === regionId) r = s.regions[i];
    if (!r) return 'Region unbekannt.';
    if (r.heat < 5) return 'Hier ist es ruhig genug.';
    var cost = Math.round(D.ECON.bribeBase * (1 + r.heat / 60));
    if (s.cash < cost) return 'Das kostet ' + U.euro(cost) + '.';
    s.cash -= cost;
    s.ledger.bribes += cost;
    r.heat = Math.max(0, r.heat - 30);
    return null;
  };

  S.bribeCost = function (s, r) {
    return Math.round(D.ECON.bribeBase * (1 + r.heat / 60));
  };

  /* ------------------------------------------------------------------
     Buchhaltung und Meldungen
     ------------------------------------------------------------------ */

  function earn(s, key, amount) {
    if (!isFinite(amount) || amount <= 0) return;
    s.cash += amount;
    s.ledger[key] = (s.ledger[key] || 0) + amount;
    s.stats.earned += amount;
  }
  function spend(s, key, amount) {
    if (!isFinite(amount) || amount <= 0) return;
    s.cash -= amount;
    s.ledger[key] = (s.ledger[key] || 0) + amount;
    s.stats.spent += amount;
  }
  S.earn = earn;
  S.spend = spend;

  function pushAlert(s, kind, icon, text) {
    s.alerts.push({ kind: kind, icon: icon, text: text, day: s.day });
    if (s.alerts.length > 40) s.alerts.shift();
  }
  S.pushAlert = pushAlert;

  function checkStory(s) {
    var snap = {
      cash: s.cash, agents: s.agents, tech: s.tech, level: s.level,
      stats: s.stats, enemies: s.enemies, regions: s.regions, rooms: s.rooms,
      hasRoom: function (id) { return S.hasRoom(s, id); },
    };
    for (var i = 0; i < s.story.length; i++) {
      if (s.story[i].done) continue;
      var def = null;
      for (var k = 0; k < D.STORY.length; k++) if (D.STORY[k].id === s.story[i].id) def = D.STORY[k];
      if (!def) break;
      var ok = false;
      try { ok = def.check(snap); } catch (e) { ok = false; }
      if (!ok) break;
      s.story[i].done = true;
      s.cash += def.reward;
      pushAlert(s, 'good', '🏅', 'Auftrag erfüllt: ' + def.title + ' (+' + U.euro(def.reward, true) + ')');
    }
  }

  S.currentStory = function (s) {
    for (var i = 0; i < s.story.length; i++) {
      if (!s.story[i].done) {
        for (var k = 0; k < D.STORY.length; k++) if (D.STORY[k].id === s.story[i].id) return D.STORY[k];
      }
    }
    return null;
  };

  /* ------------------------------------------------------------------
     Speichern
     ------------------------------------------------------------------ */

  S.serialize = function (s) {
    var o = U.assign({}, s);
    o.grid = s.grid.map(function (g) { return Array.prototype.slice.call(g); });
    // Laufende Einsaetze speichern die Agenten nur als Nummern
    o.active = s.active.map(function (r) {
      var c = U.assign({}, r);
      c.team = r.team.slice();
      return c;
    });
    return o;
  };

  S.deserialize = function (o) {
    if (!o || !o.agents) return null;
    var s = U.assign({}, o);
    s.grid = (o.grid || []).map(function (g) { return Int16Array.from(g); });
    var fresh = S.create(o.seed);
    for (var k in fresh) if (s[k] === undefined) s[k] = fresh[k];
    if (!s.dayLedger) s.dayLedger = U.assign({}, s.ledger);
    return s;
  };
})(SG);
