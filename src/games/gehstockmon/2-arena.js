/* Rundenkampf: genau ein aktives Mon pro Seite, jede Spieleraktion ist explizit. */
(function (SG) {
  var D = SG.gehstockmon.daten, A = SG.gehstockmon.arena = {};
  var stats = [[132,20,3],[88,29,8],[112,22,5],[96,25,11]];
  var specials = ['Schildstoß', 'Sichelstreich', 'Lebensquell', 'Runenstörung'];
  A.stats = function (mon) { var s = stats[mon.typ],factor=[.78,1,1.18,1.38,1.65,2][mon.seltenheit]; return { hp: Math.round(s[0]*factor), ang: Math.round(s[1]*factor), tempo: s[2] }; };
  A.moves = function (u, round) {
    return [
      { id: 'strike', name: 'Stockhieb', text: 'Zuverlässiger Angriff', damage: u.ang, enabled: true },
      { id: 'power', name: 'Kraftschlag', text: round < u.powerReady ? 'Bereit ab Runde ' + u.powerReady : 'Danach 2 Runden Pause', damage: Math.round(u.ang * 1.55), enabled: round >= u.powerReady },
      { id: 'special', name: specials[u.role], text: ['Schaden + Schild', 'Stärker gegen geschwächte Ziele', 'Heilt 32 % deiner KP', 'Schwächt den nächsten Treffer'][u.role] + ' · ' + u.charges + '/2', damage: u.role === 2 ? 0 : Math.round(u.ang * [0.9,1.35,0,0.8][u.role]), enabled: u.charges > 0 && (u.role !== 2 || u.hp < u.maxHp) },
      { id: 'guard', name: 'Deckung', text: 'Nächster Treffer −60 %', damage: 0, enabled: true }
    ];
  };
  function unit(mon, side, i, bonus) {
    var s = A.stats(mon), hp = Math.round(s.hp * (1 + bonus));
    return { uid: side + i, monId: mon.id, name: mon.name, role: mon.typ, maxHp: hp, hp: hp, ang: Math.round(s.ang * (1 + bonus / 2)), speed: s.tempo, powerReady: 1, charges: 2, shield: 0, weakened: false };
  }
  A.defenders = function (fieldId, saved) {
    if (saved && saved.length) return saved.map(function (e) { return D.mon(e.id || e.monId) || D.KATALOG[0]; });
    var roster = [['moosling','rostknirps'], ['sumpfschnapper','nebelmolch','klinge'], ['kieselkrabb','glutfuchs','donnerwidder'], ['dornenwolf','pilzhueter','nachtflatter'], ['runengolem','frostklaue','seelenqualle','obsidianrabe']];
    roster.push(['tauhupfer'],['grabesritter','vulkanmantis','frostorakel','gewittergreif'],['aetherdrache','chronoschreiter','grabesritter','frostorakel'],['endrichter','nullwyrm','chronoschreiter','aetherdrache']);
    var ids = roster[fieldId - 1].slice();
    return ids.map(D.mon);
  };
  A.create = function (roster, enemies, options) {
    var o = options || {};
    return { id: o.id || 'local', territoryId: o.territoryId || 1, territoryVersion: o.version || 1,
      level: o.level || 1, revision: 0, round: 1, phase: 'choose', winner: null, settled: false,
      teams: [roster.map(function (k,i) { return unit(k,'wir',i,0); }), enemies.map(function (k,i) { return unit(k,'sie',i,SG.gehstockmon.wirtschaft.LEVELS[o.level || 1].bonus); })],
      active: [0,0], events: [], startedAt: o.now || Date.now(), lastActionAt: o.now || Date.now() };
  };
  function active(s, side) { return s.teams[side][s.active[side]]; }
  function record(s, text, actor, target, delta, kind) { s.events.push({ text: text, actor: actor && actor.uid, target: target && target.uid, delta: delta || 0, kind: kind || 'move', state: s.teams.map(function (team) { return team.map(function (u) { return u.hp; }); }), active: s.active.slice() }); }
  function damage(s, actor, target, value, name) {
    if (actor.weakened) { value *= 0.65; actor.weakened = false; }
    value *= 1 - target.shield; target.shield = 0;
    var n = Math.min(target.hp, Math.max(1, Math.round(value))); target.hp -= n;
    record(s, actor.name + ': ' + name + ' trifft für ' + n + ' Schaden.', actor, target, -n);
  }
  function attack(s, side, move) {
    var me = active(s, side), other = active(s, 1-side); if (me.hp <= 0 || other.hp <= 0) return;
    me.shield = 0;
    if (move === 'guard') { me.shield = 0.6; record(s, me.name + ' geht in Deckung.', me); }
    else if (move === 'power') { me.powerReady = s.round + 3; damage(s,me,other,me.ang*1.55,'Kraftschlag'); }
    else if (move === 'special') {
      me.charges--;
      if (me.role === 2) { var healing = Math.min(me.maxHp-me.hp,Math.round(me.maxHp*0.32)); me.hp += healing; record(s,me.name+' heilt '+healing+' KP.',me,me,healing); }
      else {
        damage(s,me,other,me.ang*(me.role===0?0.9:me.role===1?(other.hp/other.maxHp<=0.35?1.9:1.35):0.8),specials[me.role]);
        if(me.role===0) me.shield=0.35; if(me.role===3 && other.hp>0) other.weakened=true;
      }
    } else damage(s,me,other,me.ang,'Stockhieb');
  }
  function finish(s) {
    if (!s.teams[1].some(function (u) { return u.hp > 0; })) { s.winner='wir'; s.phase='finished'; }
    else if (!s.teams[0].some(function (u) { return u.hp > 0; })) { s.winner='sie'; s.phase='finished'; }
    if (s.phase === 'finished') return;
    if (active(s,1).hp<=0) { s.active[1]=s.teams[1].findIndex(function(u){return u.hp>0;}); record(s,active(s,1).name+' wird in die Arena geschickt.',active(s,1),null,0,'send'); }
    s.phase=active(s,0).hp<=0?'replace':'choose';
    if(s.round>60){s.phase='finished';s.winner='patt';record(s,'Nach 60 Runden hält die Verteidigung stand.');}
  }
  A.ai = function(s) {
    var me=active(s,1), other=active(s,0);
    if(me.charges>0 && ((me.role===2 && me.hp<me.maxHp*0.65)||(me.role===1 && other.hp<other.maxHp*0.35)||(me.role===3 && !other.weakened)||(me.role===0 && s.round%3===1)))return 'special';
    return s.round>=me.powerReady?'power':'strike';
  };
  A.turn = function (original, action) {
    if(!original || original.phase==='finished') throw new Error('Dieser Kampf ist bereits beendet.');
    var s=JSON.parse(JSON.stringify(original)); s.events=[]; var me=active(s,0), enemy=active(s,1);
    if(action.kind==='switch') {
      if(!Number.isInteger(action.slot)||!s.teams[0][action.slot]||s.teams[0][action.slot].hp<=0||action.slot===s.active[0]) throw new Error('Wähle ein anderes kampffähiges Mon.');
      var forced=s.phase==='replace', enemyMove=A.ai(s); me.shield=0; s.active[0]=action.slot; s.phase='choose';
      record(s,active(s,0).name+' wird in die Arena geschickt.',active(s,0),null,0,'send');
      if(!forced){attack(s,1,enemyMove);s.round++;finish(s);}
    } else {
      if(s.phase==='replace')throw new Error('Schicke zuerst ein neues Mon in die Arena.');
      var move=A.moves(me,s.round).find(function(m){return m.id===action.move && m.enabled;});
      if(action.kind!=='move'||!move)throw new Error('Diese Attacke ist gerade nicht verfügbar.');
      var ai=A.ai(s), enemyUid=enemy.uid, meUid=me.uid;
      var first=move.id==='guard'||me.speed>=enemy.speed?0:1;
      [first,1-first].forEach(function(side){
        var actor=active(s,side), target=active(s,1-side);
        if(actor.hp>0 && target.hp>0 && actor.uid===(side===0?meUid:enemyUid))attack(s,side,side===0?move.id:ai);
      });
      [0,1].forEach(function(side){if(active(s,side).hp<=0)record(s,active(s,side).name+' ist kampfunfähig.',active(s,side),null,0,'faint');});
      s.round++;finish(s);
    }
    s.revision++;return s;
  };
  A.flee = function(original) { var s=JSON.parse(JSON.stringify(original));s.phase='finished';s.winner='fled';s.revision++;s.events=[{text:'Du hast dich zurückgezogen. Das Gebiet bleibt beim Verteidiger.',kind:'flee'}];return s; };
})(SG);
