/* Rundenkampf: genau ein aktives Mon pro Seite, jede Spieleraktion ist explizit. */
(function (SG) {
  var D = SG.gehstockmon.daten, A = SG.gehstockmon.arena = {};
  var stats = [[132,20,3],[88,29,8],[112,22,5],[96,25,11]];
  /* Drei Faehigkeiten je Rolle statt einer. Vorher spielte sich jedes Bollwerk
     wie jedes andere Bollwerk, nur mit anderen Zahlen - bei 57 Mons war das die
     groesste Schwaeche am Sammeln. Jetzt entscheidet die Aufstellung, welche
     drei Werkzeuge man im Kampf hat.

     Die erste jeder Rolle ist die alte: bestehende Spielstaende behalten damit
     ihre gewohnte Attacke, wo die Verteilung sie ohnehin dort hinlegt. */
  A.FAEHIGKEITEN = [
    [ { id:'schildstoss', name:'Schildstoß',   text:'Schaden und danach ein Schild',              faktor:.9 },
      { id:'steinwall',   name:'Steinwall',    text:'Kein Schaden, dafür starker Schild und Heilung', faktor:0 },
      { id:'dornenpanzer',name:'Dornenpanzer', text:'Schaden, und der nächste Treffer fällt auf den Angreifer zurück', faktor:.7 } ],
    [ { id:'sichelstreich',name:'Sichelstreich',text:'Stärker gegen geschwächte Ziele',            faktor:1.35 },
      { id:'doppelhieb',  name:'Doppelhieb',   text:'Zwei Treffer hintereinander',                faktor:.72 },
      { id:'aderlass',    name:'Aderlass',     text:'Schaden, und ein Teil davon heilt dich',     faktor:1.05 } ],
    /* nurVerletzt bekommt, was bei vollem Leben wirklich nichts tut. Frueher
       hing die Sperre an der Rolle, und damit waren auch Sammelruf und
       Laeuterung bei vollem Leben tot - obwohl ihr Schild und ihr geschaerfter
       Treffer genau dann am meisten wert sind. */
    [ { id:'lebensquell', name:'Lebensquell',  text:'Heilt 32 % deiner KP',                       faktor:0, nurVerletzt:true },
      { id:'sammelruf',   name:'Sammelruf',    text:'Heilt 18 % und gibt ein Schild',             faktor:0 },
      { id:'laeuterung',  name:'Läuterung',    text:'Heilt 22 % und schärft deinen nächsten Treffer', faktor:0 } ],
    [ { id:'runenstoerung',name:'Runenstörung',text:'Schwächt den nächsten Treffer des Gegners',  faktor:.8 },
      { id:'blendstoss',  name:'Blendstoß',    text:'Nimmt dem Gegner eine Fähigkeitsladung',     faktor:.6 },
      { id:'windschnitt', name:'Windschnitt',  text:'Geht durch Deckung und Schilde hindurch',    faktor:1.15 } ]
  ];
  A.faehigkeit = function (u) { return A.FAEHIGKEITEN[u.role][u.skill || 0] || A.FAEHIGKEITEN[u.role][0]; };
  /* Ob eine Faehigkeit bei vollem Leben verpufft. Dungeon und Arena fragen
     dieselbe Stelle, sonst gilt im einen Kampf eine andere Regel als im
     anderen - und genau das war der Fall: im Dungeon war jede Faehigkeit bis
     zum ersten Treffer gesperrt, auch die reinen Schadensfaehigkeiten. */
  A.nurBeiSchaden = function (u) { return !!A.faehigkeit(u).nurVerletzt; };
  /* Was eine Runenstufe bringt. Drei Prozent je Stufe auf KP und Angriff statt
     bisher zwei, also bis zu +15 %. Mehr geht nicht: bei +18 % schlaegt ein
     voll aufgewertetes Aussergewoehnliches ein frisches Episches, und damit
     waere die Seltenheit nichts mehr wert. Die Prozente sind deshalb nicht der
     Grund, Runen auszugeben - das sind die beiden Schwellen:

       ab Stufe 3  laedt der Kraftschlag eine Runde schneller
       ab Stufe 4  gibt es eine dritte Ladung der Faehigkeit

     Beides haengt nicht an den Grundwerten und ist im Kampf sofort zu spueren.
     Tempo bleibt unangetastet - wer zuerst schlaegt, entscheidet zu viel. */
  A.UPGRADE_BONUS = .03; A.LADUNG_AB = 4; A.LADUNGEN = 2; A.SCHNELL_AB = 3; A.POWER_PAUSE = 3;
  A.ladungen = function (mon) { return A.LADUNGEN + (SG.gehstockmon.abenteuer.upgradeLevel(mon.upgrade) >= A.LADUNG_AB ? 1 : 0); };
  A.powerPause = function (mon) { return A.POWER_PAUSE - (SG.gehstockmon.abenteuer.upgradeLevel(mon.upgrade) >= A.SCHNELL_AB ? 1 : 0); };
  /* Grundwerte mal Seltenheit, dann die Runenstufe, dann das Wesen. Das Wesen
     kam frueher gar nicht hier an - es wurde in X.mon auf die Grundwerte
     addiert, und die benutzt diese Rechnung nicht. Damit war jedes wilde Mon
     im Kampf genauso stark wie jedes ruhige. */
  A.stats = function (mon) {
    var s = stats[mon.typ],factor=[.78,1.16,1.38,1.64,1.98,2.4,3][mon.seltenheit],bonus=1+SG.gehstockmon.abenteuer.upgradeLevel(mon.upgrade)*A.UPGRADE_BONUS;
    var w = mon.wesenId ? SG.gehstockmon.abenteuer.wesen(mon.wesenId) : null;
    var hp = Math.floor(Math.round(s[0]*factor)*bonus), ang = Math.floor(Math.round(s[1]*factor)*bonus), tempo = s[2];
    if (w) { hp = Math.max(1, Math.round(hp*(1+w.hp))); ang = Math.max(1, Math.round(ang*(1+w.ang))); tempo = Math.max(1, tempo+w.tempo); }
    return { hp: hp, ang: ang, tempo: tempo };
  };
  A.moves = function (u, round) {
    var voll = u.maxCharges || A.LADUNGEN, pause = (u.powerPause || A.POWER_PAUSE) - 1, f = A.faehigkeit(u);
    /* Eine reine Heilung darf nur bei Schaden eingesetzt werden - sonst
       verpufft sie. Alles andere geht immer, solange eine Ladung da ist. */
    var heiler = A.nurBeiSchaden(u);
    return [
      { id: 'strike', name: 'Stockhieb', text: 'Zuverlässiger Angriff', damage: u.ang, enabled: true },
      { id: 'power', name: 'Kraftschlag', text: round < u.powerReady ? 'Bereit ab Runde ' + u.powerReady : 'Danach ' + pause + (pause === 1 ? ' Runde Pause' : ' Runden Pause'), damage: Math.round(u.ang * 1.55), enabled: round >= u.powerReady },
      { id: 'special', name: f.name, text: f.text + ' · ' + u.charges + '/' + voll, damage: Math.round(u.ang * f.faktor * (f.id === 'doppelhieb' ? 2 : 1)), enabled: u.charges > 0 && (!heiler || u.hp < u.maxHp) },
      { id: 'guard', name: 'Deckung', text: 'Nächster Treffer −60 %', damage: 0, enabled: true }
    ];
  };
  function unit(mon, side, i, bonus) {
    var s = A.stats(mon), hp = Math.round(s.hp * (1 + bonus)), laden = A.ladungen(mon), pause = A.powerPause(mon);
    return { uid: side + i, monId: mon.id, name: mon.name, role: mon.typ, skill: D.faehigkeitVon(mon), wesen: mon.wesen || null, maxHp: hp, hp: hp, ang: Math.round(s.ang * (1 + bonus / 2)), speed: s.tempo, powerReady: 1, charges: laden, maxCharges: laden, powerPause: pause, shield: 0, weakened: false, dornen: false, geschaerft: false, plan: mon.plan || null };
  }
  /* Ein gespeicherter Verteidiger, wie ihn die Welt haelt. Runenstufe, Wesen
     und Plan gehoeren dazu, und zwar ueberall gleich: die Grosse Arena hat
     sich ihre Gegner lange selbst zusammengebaut und dabei Wesen und Plan
     fallen lassen. Der Champion kaempfte dann nach der Faustregel statt nach
     dem Plan, den sein Besitzer gesetzt hatte. */
  A.ausSpeicher = function (e) {
    var X = SG.gehstockmon.abenteuer, w = X.wesen(e && e.wesen);
    return Object.assign({}, D.mon(e && (e.id || e.monId)) || D.KATALOG[0],
      { upgrade: X.upgradeLevel(e && e.upgrade), wesenId: w ? w.id : null, wesen: w ? w.name : null,
        plan: A.planGueltig(e && e.plan) ? e.plan : null });
  };
  A.defenders = function (fieldId, saved) {
    if (saved && saved.length) return saved.map(function (e) { return A.ausSpeicher(e); });
    var roster = [['moosling','rostknirps'], ['sumpfschnapper','nebelmolch','klinge'], ['kieselkrabb','glutfuchs','donnerwidder'], ['dornenwolf','pilzhueter','nachtflatter'], ['runengolem','frostklaue','seelenqualle','obsidianrabe']];
    /* Das Sonnengrab war ein Abklatsch des Horsts und damit die leichteste
       Stufe unter "Sehr schwer", die es je gab. Jetzt stehen dort vier
       Legendaere in allen vier Rollen - Wall, Schneide, Pfleger, Stoerung -,
       und der Pfleger macht daraus die eigentliche Aufgabe: ohne ihn zuerst
       zu brechen, heilt er alles wieder weg. */
    roster.push(['tauhupfer'],['grabesritter','sternengeweih','vulkanmantis','leerenwyrm'],['aetherdrache','chronoschreiter','grabesritter','frostorakel'],['endrichter','nullwyrm','chronoschreiter','aetherdrache']);
    var ids = roster[fieldId - 1].slice();
    /* Auch die Computergebiete kaempfen nach einem Plan. Ohne einen stand beim
       Aufklaeren neunmal "kein eigener Plan", und die ganze Aufklaerung lohnte
       sich erst gegen echte Spieler - von denen es wenige gibt. Jeder Plan
       passt zur Lehre seines Feldes, sodass man ihn lesen und kontern kann. */
    return ids.map(function (id) {
      var mon = D.mon(id);
      return mon ? Object.assign({}, mon, { plan: A.FELD_PLAENE[fieldId - 1] || null }) : mon;
    });
  };
  /* Ein Plan je Gebiet, gelesen wie die Lehre des Feldes:

       1 Grenzstein   schlaegt stur zu - hier lernt man nur zuzusehen
       2 Alte Furt    die Pfleger heilen, sobald es eng wird
       3 Schieferbruch der Brecher holt aus, sobald er kann
       4 Nebelsenke   deckt sich, wenn man selbst stark dasteht
       5 Der Horst    liest die Lage und wechselt zwischen Angriff und Schutz
       6 Tauwiese     ein sanfter Einstieg, fast ohne Gegenwehr
       7 Sonnengrab   heilt frueh und hartnaeckig - der Pfleger muss zuerst fallen
       8 Donnergrat   spart die Faehigkeit fuer den Moment der Schwaeche
       9 Weltenschlund schlaegt mit allem zu, was geladen ist */
  A.FELD_PLAENE = [
    [['immer','strike'],   ['aus','strike'],        ['aus','strike']],
    [['ich_schwach','special'], ['immer','strike'],  ['aus','strike']],
    [['kraft_bereit','power'],  ['immer','strike'],  ['aus','strike']],
    [['feind_stark','guard'],   ['ladung_da','special'], ['immer','strike']],
    [['ich_schwach','special'], ['feind_schwach','power'], ['immer','strike']],
    [['immer','strike'],   ['aus','strike'],        ['aus','strike']],
    [['ich_schwach','special'], ['geschuetzt','special'], ['immer','power']],
    [['feind_schwach','special'],['kraft_bereit','power'], ['immer','strike']],
    [['kraft_bereit','power'],  ['ladung_da','special'],  ['immer','strike']]
  ];
  A.create = function (roster, enemies, options) {
    var o = options || {};
    return { id: o.id || 'local', territoryId: o.territoryId || 1, territoryVersion: o.version || 1,
      level: o.level || 1, revision: 0, round: 1, phase: 'choose', winner: null, settled: false,
      aussenseiter: o.aussenseiter || 0,
      teams: [roster.map(function (k,i) { return unit(k,'wir',i,o.aussenseiter || 0); }), enemies.map(function (k,i) { return unit(k,'sie',i,SG.gehstockmon.wirtschaft.LEVELS[o.level || 1].bonus+(o.npcTerritory?(o.territoryId===9?.65:o.territoryId===8?.4:o.territoryId===7?.22:0):0)+(o.bonus||0)); })],
      active: [0,0], events: [], startedAt: o.now || Date.now(), lastActionAt: o.now || Date.now() };
  };
  function active(s, side) { return s.teams[side][s.active[side]]; }
  function record(s, text, actor, target, delta, kind) { s.events.push({ text: text, actor: actor && actor.uid, target: target && target.uid, delta: delta || 0, kind: kind || 'move', state: s.teams.map(function (team) { return team.map(function (u) { return u.hp; }); }), active: s.active.slice() }); }
  /* Das Rollen-Dreieck. Vorher entschieden nur KP, Angriff und Tempo - vier
     Rollen, die einander nichts anhaben konnten, und die Aufstellung war eine
     Zahlensumme. Jetzt hat jede Rolle eine, gegen die sie gut steht:

       Wall daempft die Schneide      Schneide zerlegt den Pfleger
       Pfleger haelt gegen Stoerung   Stoerung kommt am Wall vorbei

     Ein Viertel mehr oder weniger ist genug, um eine Aufstellung zu kippen,
     ohne dass ein falscher Konter den Kampf schon entscheidet. */
  A.DREIECK = .25;
  A.rollenFaktor = function (angreifer, verteidiger) {
    if (angreifer === 1 && verteidiger === 0) return 1 - A.DREIECK;
    if (angreifer === 1 && verteidiger === 2) return 1 + A.DREIECK;
    if (angreifer === 3 && verteidiger === 0) return 1 + A.DREIECK;
    if (angreifer === 3 && verteidiger === 2) return 1 - A.DREIECK;
    return 1;
  };
  function damage(s, actor, target, value, name, durchdringend) {
    if (actor.weakened) { value *= 0.65; actor.weakened = false; }
    if (actor.geschaerft) { value *= 1.3; actor.geschaerft = false; }
    value *= A.rollenFaktor(actor.role, target.role);
    if (!durchdringend) { value *= 1 - target.shield; target.shield = 0; }
    var n = Math.min(target.hp, Math.max(1, Math.round(value))); target.hp -= n;
    record(s, actor.name + ': ' + name + ' trifft für ' + n + ' Schaden.', actor, target, -n);
    /* Dornenpanzer wirft den naechsten Treffer anteilig zurueck. */
    if (target.dornen && target.hp > 0 && actor.hp > 0) {
      target.dornen = false;
      var zurueck = Math.min(actor.hp, Math.max(1, Math.round(n * 0.4)));
      actor.hp -= zurueck;
      record(s, target.name + ': Dornenpanzer wirft ' + zurueck + ' Schaden zurück.', target, actor, -zurueck);
    }
  }
  function heile(s, me, anteil) {
    var n = Math.min(me.maxHp - me.hp, Math.round(me.maxHp * anteil));
    if (n > 0) { me.hp += n; record(s, me.name + ' heilt ' + n + ' KP.', me, me, n); }
    return n;
  }
  function attack(s, side, move) {
    var me = active(s, side), other = active(s, 1-side); if (me.hp <= 0 || other.hp <= 0) return;
    me.shield = 0;
    if (move === 'guard') { me.shield = 0.6; record(s, me.name + ' geht in Deckung.', me); }
    else if (move === 'power') { me.powerReady = s.round + (me.powerPause || A.POWER_PAUSE); damage(s,me,other,me.ang*1.55,'Kraftschlag'); }
    else if (move === 'special') {
      me.charges--;
      var f = A.faehigkeit(me);
      if (f.id === 'schildstoss') { damage(s,me,other,me.ang*f.faktor,f.name); me.shield = 0.35; }
      else if (f.id === 'steinwall') { me.shield = 0.75; heile(s,me,0.1); record(s,me.name+' zieht den Steinwall hoch.',me); }
      else if (f.id === 'dornenpanzer') { damage(s,me,other,me.ang*f.faktor,f.name); me.dornen = true; }
      else if (f.id === 'sichelstreich') { damage(s,me,other,me.ang*(other.hp/other.maxHp<=0.35?1.9:f.faktor),f.name); }
      else if (f.id === 'doppelhieb') { damage(s,me,other,me.ang*f.faktor,f.name); if (other.hp > 0) damage(s,me,other,me.ang*f.faktor,f.name+' (zweiter Hieb)'); }
      else if (f.id === 'aderlass') { var vorher = other.hp; damage(s,me,other,me.ang*f.faktor,f.name); var traf = vorher - other.hp; var zurueck = Math.min(me.maxHp-me.hp,Math.round(traf*0.45)); if (zurueck > 0) { me.hp += zurueck; record(s,me.name+' saugt '+zurueck+' KP heraus.',me,me,zurueck); } }
      else if (f.id === 'lebensquell') { heile(s,me,0.32); }
      else if (f.id === 'sammelruf') { heile(s,me,0.18); me.shield = 0.35; record(s,me.name+' sammelt sich hinter einem Schild.',me); }
      else if (f.id === 'laeuterung') { heile(s,me,0.22); me.weakened = false; me.geschaerft = true; record(s,me.name+' schärft den nächsten Treffer.',me); }
      else if (f.id === 'runenstoerung') { damage(s,me,other,me.ang*f.faktor,f.name); if (other.hp > 0) other.weakened = true; }
      else if (f.id === 'blendstoss') { damage(s,me,other,me.ang*f.faktor,f.name); if (other.hp > 0 && other.charges > 0) { other.charges--; record(s,other.name+' verliert eine Ladung.',me,other); } }
      else if (f.id === 'windschnitt') { damage(s,me,other,me.ang*f.faktor,f.name,true); }
      else damage(s,me,other,me.ang*f.faktor,f.name);
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
  /* Der Kampfplan. Das war der eigentliche Einfall hinter GehstockMon - deine
     Truppe haelt dein Land nach Regeln, die du gesetzt hast, und ein Gegner
     kann sie beim Aufklaeren lesen und kontern. Er war beim Umbau auf den
     Einzelkampf verlorengegangen: seitdem kaempfte jede Verteidigung, auch die
     des Champions, nach derselben vierzeiligen Heuristik.

     Ein Plan sind drei Wenn-Dann-Zeilen je Mon, von oben nach unten geprueft.
     Greift keine, bleibt die alte Heuristik als Rueckfall - ein Mon ohne Plan
     kaempft also genau wie frueher. */
  A.PLAN_WENN = [
    { id:'aus',           text:'(keine Regel)' },
    { id:'immer',         text:'immer' },
    { id:'ich_schwach',   text:'ich unter 40 %' },
    { id:'ich_stark',     text:'ich über 70 %' },
    { id:'feind_schwach', text:'Gegner unter 40 %' },
    { id:'feind_stark',   text:'Gegner über 70 %' },
    { id:'runde_1',       text:'in Runde 1' },
    { id:'kraft_bereit',  text:'Kraftschlag geladen' },
    { id:'ladung_da',     text:'Fähigkeit hat Ladung' },
    { id:'geschuetzt',    text:'Gegner ist geschützt' }
  ];
  A.PLAN_DANN = [
    { id:'strike',  text:'Stockhieb' },
    { id:'power',   text:'Kraftschlag' },
    { id:'special', text:'Fähigkeit einsetzen' },
    { id:'guard',   text:'in Deckung gehen' }
  ];
  A.START_PLAN = [['runde_1','power'], ['feind_schwach','special'], ['immer','strike']];
  A.planGueltig = function (plan) {
    return Array.isArray(plan) && plan.length === A.START_PLAN.length && plan.every(function (zeile) {
      return Array.isArray(zeile) && zeile.length === 2
        && A.PLAN_WENN.some(function (w) { return w.id === zeile[0]; })
        && A.PLAN_DANN.some(function (d) { return d.id === zeile[1]; });
    });
  };
  A.planOder = function (plan) { return A.planGueltig(plan) ? plan.map(function (z) { return z.slice(0,2); }) : A.START_PLAN.map(function (z) { return z.slice(); }); };
  function trifftZu(wenn, me, other, round) {
    if (wenn === 'immer') return true;
    if (wenn === 'ich_schwach') return me.hp <= me.maxHp * 0.4;
    if (wenn === 'ich_stark') return me.hp > me.maxHp * 0.7;
    if (wenn === 'feind_schwach') return other.hp <= other.maxHp * 0.4;
    if (wenn === 'feind_stark') return other.hp > other.maxHp * 0.7;
    if (wenn === 'runde_1') return round === 1;
    if (wenn === 'kraft_bereit') return round >= me.powerReady;
    if (wenn === 'ladung_da') return me.charges > 0;
    if (wenn === 'geschuetzt') return other.shield > 0;
    return false;
  }
  A.ai = function(s) {
    var me=active(s,1), other=active(s,0);
    var moeglich = A.moves(me, s.round);
    function erlaubt(id) { var m = moeglich.find(function (v) { return v.id === id; }); return m && m.enabled; }
    /* Erst der Plan des Verteidigers, Zeile fuer Zeile. */
    if (A.planGueltig(me.plan)) {
      for (var i = 0; i < me.plan.length; i++) {
        var wenn = me.plan[i][0], dann = me.plan[i][1];
        if (wenn === 'aus' || !trifftZu(wenn, me, other, s.round)) continue;
        if (erlaubt(dann)) return dann;
      }
    }
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
    /* Der Verlauf wird mitgeschrieben, damit ein Kampf spaeter nachlesbar ist.
       Bisher hielt jeder Zug nur seine eigenen Zeilen - wer nachts angegriffen
       wurde, sah am Morgen einen einzigen Satz und nicht, woran es lag. Nur
       Texte, keine Zustandsbilder: der Bericht soll die Welt nicht aufblaehen. */
    s.verlauf = (original.verlauf || []).concat(s.events.map(function (e) { return e.text; })).slice(-120);
    s.revision++;return s;
  };
  A.flee = function(original) { var s=JSON.parse(JSON.stringify(original));s.phase='finished';s.winner='fled';s.revision++;s.events=[{text:'Du hast dich zurückgezogen. Das Gebiet bleibt beim Verteidiger.',kind:'flee'}];return s; };
})(SG);
