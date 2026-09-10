/* ------------------------------------------------------------------
   Geheimagenten-Tycoon - Missionsauswertung

   Eine Mission laeuft in Phasen ab. Vor jeder Phase steht die
   Erfolgsaussicht sichtbar auf dem Schirm, zwischendurch gibt es
   echte Entscheidungen. Kein blosser Timer, sondern eine Folge von
   Proben, bei denen man zusehen und eingreifen kann.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var A = SG.tycoon.spy;
  var D = A.data;
  var S = A.sim;

  var M = A.mission = {};

  function rngFor(s, run, salt) {
    return U.rng((s.seed + run.id * 7919 + run.phase * 131 + (salt || 0)) >>> 0);
  }

  /* Bester Agent des Teams fuer eine Faehigkeit */
  M.bestFor = function (s, team, skill) {
    var best = null, bv = -1;
    for (var i = 0; i < team.length; i++) {
      var v = S.skillValue(s, team[i], skill);
      if (v > bv) { bv = v; best = team[i]; }
    }
    return { agent: best, value: bv };
  };

  M.phaseChance = function (s, run, index) {
    var type = D.missionType(run.mission.type);
    var ph = type.phases[index];
    if (!ph) return 0;
    var team = S.teamOf(s, run);
    var b = M.bestFor(s, team, ph.skill);
    var dc = ph.dc + run.mission.diff * 4;
    var value = b.value + (team.length - 1) * 4 + run.bonus;
    return U.clamp(0.5 + (value - dc) / 90, 0.05, 0.96);
  };

  M.currentPhase = function (run) {
    var type = D.missionType(run.mission.type);
    return type.phases[run.phase] || null;
  };

  /* Loest die naechste Phase auf. Liefert einen Bericht. */
  M.step = function (s, run) {
    if (run.state === 'fertig') return null;
    if (run.choicePending) return null;

    var type = D.missionType(run.mission.type);
    var ph = type.phases[run.phase];
    if (!ph) { return M.complete(s, run); }

    var rng = rngFor(s, run, 3);
    var team = S.teamOf(s, run);
    if (!team.length) { run.state = 'fertig'; return M.complete(s, run); }

    // Vor der zweiten und dritten Phase kann eine Entscheidung kommen
    if ((run.phase === 1 || run.phase === 2) && !run.choiceDone && rng() < 0.75) {
      run.choiceDone = true;
      var pool = D.CHOICES;
      run.choicePending = pool[rng.int(pool.length)];
      run.state = 'wahl';
      return { kind: 'choice', choice: run.choicePending };
    }

    var b = M.bestFor(s, team, ph.skill);
    var agent = b.agent;
    var p = M.phaseChance(s, run, run.phase);
    var ok = rng() < p;

    // Glücksritter dreht einen Fehlschlag
    if (!ok && agent && agent.traits.indexOf('gluecksritter') >= 0 && !run.luckUsed[agent.id]) {
      run.luckUsed[agent.id] = true;
      ok = true;
      run.log.push({ kind: 'hi', text: agent.code + ' hat unverschämtes Glück.' });
    }

    run.results.push(ok);
    var skillDef = D.skill(ph.skill);

    if (ok) {
      run.log.push({
        kind: 'ok',
        text: skillDef.icon + ' ' + ph.name + ': ' + agent.code + ' schafft es. (' +
          Math.round(p * 100) + ' %)',
      });
      run.bonus += 3;
      run.heat += 2;
    } else {
      run.log.push({
        kind: 'no',
        text: skillDef.icon + ' ' + ph.name + ': ' + agent.code + ' scheitert. (' +
          Math.round(p * 100) + ' %)',
      });
      run.bonus -= 6;
      run.heat += 12;
      // Verletzungsgefahr bei koerperlichen Proben
      if (ph.skill === 'kampf' || ph.skill === 'schuss') {
        var hurt = 12 + rng.int(26);
        agent.injury = Math.min(100, agent.injury + hurt);
        run.log.push({ kind: 'no', text: agent.code + ' wird verletzt (' + hurt + ').' });
      }
    }

    // Stress steigt bei jeder Probe
    team.forEach(function (a) {
      var mul = a.traits.indexOf('nervoes') >= 0 ? 2 : 1;
      if (a.traits.indexOf('draufgaenger') >= 0) mul *= 1.3;
      a.stress = Math.min(100, a.stress + (ok ? 3 : 8) * mul);
    });

    run.phase++;
    if (run.phase >= type.phases.length) return M.complete(s, run);
    run.state = 'laufend';
    return { kind: 'phase', ok: ok, agent: agent, phase: ph, chance: p };
  };

  M.applyChoice = function (s, run, index) {
    var ch = run.choicePending;
    if (!ch) return null;
    var opt = ch.options[index];
    if (!opt) return null;
    run.choicePending = null;
    run.state = 'laufend';

    if (opt.cost) {
      if (s.cash < opt.cost) {
        run.log.push({ kind: 'no', text: 'Kein Geld für den Informanten — Angebot verfällt.' });
        return { kind: 'chosen', option: opt, paid: false };
      }
      S.spend(s, 'penalties', opt.cost);
    }

    var team = S.teamOf(s, run);
    var bonus = opt.bonus;
    if (opt.skill) {
      var b = M.bestFor(s, team, opt.skill);
      // Wer die passende Faehigkeit hat, holt mehr heraus
      bonus = Math.round(bonus * U.clamp(b.value / 50, 0.4, 1.8));
      run.log.push({
        kind: 'hi',
        text: '→ ' + opt.text + ' (' + D.skillName(opt.skill) + ' ' + b.value + ')',
      });
    } else {
      run.log.push({ kind: 'hi', text: '→ ' + opt.text });
    }
    run.bonus += bonus;
    run.heat += opt.heat;
    if (opt.time) run.extraTime = (run.extraTime || 0) + opt.time;
    return { kind: 'chosen', option: opt, bonus: bonus };
  };

  /* Abschluss und Abrechnung */
  M.complete = function (s, run) {
    if (run.state === 'fertig') return run.summary;
    run.state = 'fertig';

    var mission = run.mission;
    var type = D.missionType(mission.type);
    var team = S.teamOf(s, run);
    var fails = run.results.filter(function (r) { return !r; }).length;
    var total = run.results.length || 1;

    var grade;
    if (fails === 0) grade = 'voll';
    else if (fails === 1) grade = 'erfolg';
    else if (fails === 2) grade = 'teil';
    else grade = 'fehl';

    var payMul = { voll: 1.3, erfolg: 1.0, teil: 0.45, fehl: 0 }[grade];
    var client = D.clientById(mission.client);
    var fee = Math.round(mission.fee * payMul);
    if (fee > 0) S.earn(s, 'fees', fee);

    // Ruf und Auftraggeber
    var repDelta = { voll: 5, erfolg: 3, teil: -1, fehl: -6 }[grade] * client.repMul;
    s.reputation = U.clamp(s.reputation + repDelta, 0, 100);
    for (var i = 0; i < s.clients.length; i++) {
      if (s.clients[i].id === mission.client) {
        s.clients[i].standing = U.clamp(s.clients[i].standing + repDelta * 1.6, 0, 100);
      }
    }

    // Hitze in der Region
    var reg = null;
    for (i = 0; i < s.regions.length; i++) if (s.regions[i].id === mission.region) reg = s.regions[i];
    var heat = run.heat + (grade === 'fehl' ? 25 : 0);
    team.forEach(function (a) {
      if (a.traits.indexOf('grossmaul') >= 0) heat += 6;
      if (a.traits.indexOf('schattenlaeufer') >= 0) heat -= 4;
    });
    if (reg) {
      reg.heat = U.clamp(reg.heat + Math.max(0, heat), 0, 100);
      if (grade === 'voll' || grade === 'erfolg') {
        reg.influence = U.clamp(reg.influence + 4 + mission.diff, 0, 100);
      }
    }

    // Tarnidentitaeten verbrennen
    team.forEach(function (a) {
      if (grade === 'fehl' || (reg && reg.heat > 75)) {
        a.covers[mission.region] = 1;
      }
    });

    // Gegnerorganisation schwaechen
    if (mission.enemy && (grade === 'voll' || grade === 'erfolg')) {
      for (i = 0; i < s.enemies.length; i++) {
        if (s.enemies[i].id !== mission.enemy) continue;
        var dmg = 3 + mission.diff * (grade === 'voll' ? 1.4 : 0.9);
        s.enemies[i].power = U.clamp(s.enemies[i].power - dmg, 0, 100);
        s.enemies[i].known = U.clamp(s.enemies[i].known + 8, 0, 100);
        if (s.enemies[i].power <= 0) {
          S.pushAlert(s, 'good', '🏆', enemyName(mission.enemy) + ' ist zerschlagen!');
        }
      }
    }

    // Erfahrung
    var xpBase = 60 + mission.diff * 28;
    var xpMul = { voll: 1.4, erfolg: 1, teil: 0.6, fehl: 0.3 }[grade];
    team.forEach(function (a) {
      S.addXp(s, a, Math.round(xpBase * xpMul));
      a.missions++;
      a.loyalty = U.clamp(a.loyalty + (grade === 'fehl' ? -6 : 3), 0, 100);
    });
    s.xp += Math.round(xpBase * xpMul);

    // Gefangennahme
    var captured = null;
    if (grade === 'fehl') {
      var rng = rngFor(s, run, 77);
      if (rng() < 0.45 && team.length) {
        captured = team[rng.int(team.length)];
        captured.status = 'gefangen';
        s.captured.push({ agentId: captured.id, region: mission.region, day: s.day });
        // Befreiungsmission anbieten
        s.missions.unshift({
          id: s.nextMissionId++,
          type: 'befreiung',
          region: mission.region,
          client: 'privat',
          enemy: mission.enemy,
          diff: Math.min(10, mission.diff + 2),
          fee: 0,
          travel: mission.travel,
          expires: s.day + 8,
          title: 'Befreiung: ' + captured.code,
          rescueId: captured.id,
        });
        S.pushAlert(s, 'bad', '⛓', captured.code + ' wurde gefangen genommen! Eine Befreiung ist möglich.');
      }
    }

    // Befreiungsmission erfolgreich?
    if (type.special === 'rescue' && mission.rescueId &&
      (grade === 'voll' || grade === 'erfolg' || grade === 'teil')) {
      for (i = 0; i < s.agents.length; i++) {
        if (s.agents[i].id === mission.rescueId) {
          s.agents[i].status = 'verletzt';
          s.agents[i].injury = 55;
          S.pushAlert(s, 'good', '⛓', s.agents[i].code + ' ist wieder da.');
        }
      }
      s.captured = s.captured.filter(function (c) { return c.agentId !== mission.rescueId; });
    }

    // Team wieder freigeben
    team.forEach(function (a) {
      if (a.status === 'gefangen') return;
      a.status = a.injury > 30 ? 'verletzt' : 'bereit';
      // Gadgets verbrauchen
      for (var g = 0; g < a.gear.length; g++) {
        if (!a.gear[g]) continue;
        var def = D.gadgetById(a.gear[g]);
        if (!def) continue;
        a.gearUses = a.gearUses || {};
        a.gearUses[a.gear[g]] = (a.gearUses[a.gear[g]] || 0) + 1;
        if (a.gearUses[a.gear[g]] >= def.uses) {
          run.log.push({ kind: 'no', text: def.name + ' ist verbraucht.' });
          a.gearUses[a.gear[g]] = 0;
          a.gear[g] = null;
        }
      }
    });

    s.stats.missions++;
    if (grade === 'fehl') s.stats.lost++;
    else s.stats.won++;

    U.remove(s.active, run);

    run.summary = {
      grade: grade,
      gradeName: {
        voll: 'Voller Erfolg', erfolg: 'Erfolg', teil: 'Teilerfolg', fehl: 'Fehlschlag',
      }[grade],
      fee: fee,
      fails: fails,
      total: total,
      heat: Math.max(0, heat),
      captured: captured,
      xp: Math.round(xpBase * xpMul),
      region: mission.region,
      enemy: mission.enemy,
    };

    S.pushAlert(s, grade === 'fehl' ? 'bad' : (grade === 'teil' ? 'warn' : 'good'),
      type.icon, mission.title + ': ' + run.summary.gradeName +
      (fee ? ' (+' + U.euro(fee, true) + ')' : ''));

    return run.summary;
  };

  function enemyName(id) {
    for (var i = 0; i < D.ENEMIES.length; i++) if (D.ENEMIES[i].id === id) return D.ENEMIES[i].name;
    return id;
  }
  M.enemyName = enemyName;

  /* Bricht einen Einsatz ab (z. B. beim Verlassen des Spiels) */
  M.abort = function (s, run) {
    var team = S.teamOf(s, run);
    team.forEach(function (a) { if (a.status === 'einsatz') a.status = 'bereit'; });
    U.remove(s.active, run);
  };
})(SG);
