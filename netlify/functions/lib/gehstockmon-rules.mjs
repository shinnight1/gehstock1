/* Generated from the shared browser rules by build.mjs. */
const SG = { rules: {} };
/* ------------------------------------------------------------------
   GehstockMon - Werte, Faehigkeiten, Gegner, Felder.

   Alles, was man zum Ausprobieren verstellen will, steht hier. Die
   Kampfregeln liegen in 2-kampf.js (ohne DOM, damit tools/test.mjs sie
   pruefen kann), die Oberflaeche in 3-ui.js.
   ------------------------------------------------------------------ */

(function (SG) {
  var R = SG.gehstockmon = SG.gehstockmon || {};
  var D = R.daten = {};

  /* Reihenfolge ist zugleich die Reihenfolge beim Weiterblaettern im
     Planeditor. '(keine Regel)' steht vorn, damit eine leere Zeile der
     Ausgangszustand ist und man sich nichts erst wegklicken muss. */
  D.BEDINGUNGEN = [
    { id: 'aus',            text: '(keine Regel)' },
    { id: 'immer',          text: 'immer' },
    { id: 'ich_schwach',    text: 'ich unter 40 %' },
    { id: 'freund_schwach', text: 'Verbündeter unter 40 %' },
    { id: 'feind_schwach',  text: 'Gegner unter 40 %' },
    { id: 'runde_1',        text: 'in Runde 1' },
    { id: 'ueberzahl',      text: 'Gegner in Überzahl' }
  ];

  D.AKTIONEN = [
    { id: 'vorderster',   text: 'vordersten Gegner angreifen' },
    { id: 'schwaechster', text: 'schwächsten Gegner angreifen' },
    { id: 'staerkster',   text: 'stärksten Gegner angreifen' },
    { id: 'faehigkeit',   text: 'Fähigkeit einsetzen' },
    { id: 'verteidigen',  text: 'verteidigen' }
  ];

  /* Vier Faehigkeiten, geteilt von beiden Seiten. Dass die Gegner
     dieselben Werkzeuge haben wie du, ist Absicht: sonst lernt man beim
     Lesen ihres Plans nichts ueber den eigenen. */
  D.FAEHIGKEITEN = {
    spott:      { name: 'Spott',      text: 'Zieht bis zum nächsten eigenen Zug alle Angriffe auf sich. Nur ein gezielter Schlag auf den Stärksten geht daran vorbei.' },
    hinrichten: { name: 'Hinrichten', text: 'Greift den schwächsten Gegner an. Doppelter Schaden, wenn der unter 40 % steht.' },
    flicken:    { name: 'Flicken',    text: 'Heilt dem am stärksten verletzten Verbündeten 32 Leben.' },
    stoeren:    { name: 'Stören',     text: 'Der stärkste Gegner richtet bei seinem nächsten Zug nur halben Schaden an.' }
  };

  /* Deine vier Kreaturen. mono ist der Platzhalter im Portraitfeld -
     sobald echte Bilder da sind, kommt statt dessen ein Emoji oder ein
     gezeichnetes Wappen hinein, der Aufbau bleibt gleich.

     Die Werte liegen absichtlich weit auseinander. Vier Kreaturen, die
     sich aehnlich spielen, machen jeden Plan austauschbar. */
  D.KREATUREN = [
    { id: 'bollwerk', name: 'Bollwerk', rolle: 'Wall',     mono: '🛡', hp: 130, ang:  8, tempo:  3, faeh: 'spott' },
    { id: 'klinge',   name: 'Klinge',   rolle: 'Schneide', mono: '⚔', hp:  62, ang: 23, tempo:  8, faeh: 'hinrichten' },
    { id: 'waerter',  name: 'Wärter',   rolle: 'Erhalt',   mono: '✚', hp:  86, ang:  7, tempo:  5, faeh: 'flicken' },
    { id: 'spaeher',  name: 'Späher',   rolle: 'Störung',  mono: '👁', hp:  70, ang: 13, tempo: 11, faeh: 'stoeren' }
  ];

  /* Startplan. Bewusst brauchbar, aber nicht optimal: Feld 1 gewinnt man
     damit, Feld 3 nicht mehr. Genau da soll das Basteln anfangen. */
  D.START_PLAN = {
    bollwerk: [ ['runde_1', 'faehigkeit'],        ['immer', 'vorderster'], ['aus', 'vorderster'] ],
    klinge:   [ ['feind_schwach', 'faehigkeit'],  ['immer', 'vorderster'], ['aus', 'vorderster'] ],
    waerter:  [ ['freund_schwach', 'faehigkeit'], ['immer', 'vorderster'], ['aus', 'vorderster'] ],
    spaeher:  [ ['immer', 'vorderster'],          ['aus', 'vorderster'],   ['aus', 'vorderster'] ]
  };

  D.SELTENHEITEN = [
    { name: 'Gewöhnlich', farbe: '#b8c5bc', rang: 1, text: 'Steinpanzer · geschnitzter Gehstock' },
    { name: 'Selten', farbe: '#50b8ff', rang: 2, text: 'Glutklingen · leuchtende Runen' },
    { name: 'Episch', farbe: '#c38bff', rang: 3, text: 'Kristallkrone · schwebende Magie' },
    { name: 'Legendär', farbe: '#ffca68', rang: 4, text: 'Goldrüstung · Drachenschwingen · Flammenaura' }
  ];
  D.KREATUREN.forEach(function (k, i) {
    k.seltenheit = i;
    k.bild = 'gm-' + k.id;
  });

  /* Die fuenf Felder. Jedes ist eine Aufgabe mit genau einer Lehre, und
     die Lehre steht im Klartext dabei - im Prototyp will man wissen,
     woran man gerade scheitert, nicht raten.

     Der gegnerische Plan liegt offen. Das ist der Kern des Spiels und
     keine Bequemlichkeit: du sollst seine Denkweise lesen, nicht seine
     Truppenstaerke. */
  D.FELDER = [
    {
      id: 1, name: 'Grenzstein',
      lehre: 'Der Kampf läuft ohne dich. Schau erst einmal zu.',
      feinde: [
        { name: 'Streuner', mono: '🐀', hp: 52, ang: 11, tempo: 6, faeh: 'stoeren',
          plan: [ ['immer', 'vorderster'] ] },
        { name: 'Streuner', mono: '🐀', hp: 52, ang: 11, tempo: 5, faeh: 'stoeren',
          plan: [ ['immer', 'vorderster'] ] }
      ]
    },
    {
      id: 2, name: 'Alte Furt',
      lehre: 'Zwei Pfleger halten die Reihe. Nimm sie zuerst heraus.',
      feinde: [
        { name: 'Balg',    mono: '🦎', hp: 120, ang: 19, tempo: 6, faeh: 'spott',
          plan: [ ['immer', 'vorderster'] ] },
        { name: 'Balg',    mono: '🦎', hp: 120, ang: 19, tempo: 5, faeh: 'spott',
          plan: [ ['immer', 'vorderster'] ] },
        { name: 'Pfleger', mono: '🌿', hp: 44, ang:  5, tempo: 7, faeh: 'flicken',
          plan: [ ['immer', 'faehigkeit'] ] },
        { name: 'Pfleger', mono: '🌿', hp: 44, ang:  5, tempo: 6, faeh: 'flicken',
          plan: [ ['immer', 'faehigkeit'] ] }
      ]
    },
    {
      id: 3, name: 'Schieferbruch',
      lehre: 'Einer schlägt härter als der Rest zusammen. Nimm ihm die Wucht.',
      feinde: [
        { name: 'Brecher',  mono: '🏹', hp: 105, ang: 46, tempo: 10, faeh: 'hinrichten',
          plan: [ ['immer', 'schwaechster'] ] },
        { name: 'Splitter', mono: '🪨', hp:  46, ang: 13, tempo:  8, faeh: 'hinrichten',
          plan: [ ['immer', 'schwaechster'] ] },
        { name: 'Splitter', mono: '🪨', hp:  46, ang: 13, tempo:  7, faeh: 'hinrichten',
          plan: [ ['immer', 'schwaechster'] ] }
      ]
    },
    {
      id: 4, name: 'Nebelsenke',
      lehre: 'Ihr Wall fängt alles ab. Schlag nach dem, was dahinter steht.',
      feinde: [
        { name: 'Bastion', mono: '🗿', hp: 230, ang:  6, tempo: 4, faeh: 'spott',
          plan: [ ['immer', 'faehigkeit'] ] },
        { name: 'Dorn',    mono: '🌵', hp:  58, ang: 24, tempo: 9, faeh: 'hinrichten',
          plan: [ ['feind_schwach', 'faehigkeit'], ['immer', 'schwaechster'] ] },
        { name: 'Dorn',    mono: '🌵', hp:  58, ang: 22, tempo: 8, faeh: 'hinrichten',
          plan: [ ['immer', 'schwaechster'] ] }
      ]
    },
    {
      id: 5, name: 'Der Horst',
      lehre: 'Ihr Plan steht offen da. Lies ihn, bevor du angreifst.',
      feinde: [
        { name: 'Warte',   mono: '🏚', hp:  84, ang: 12, tempo:  4, faeh: 'spott',
          plan: [ ['runde_1', 'faehigkeit'], ['ich_schwach', 'verteidigen'], ['immer', 'vorderster'] ] },
        { name: 'Sichel',  mono: '🦂', hp:  42, ang: 31, tempo: 12, faeh: 'hinrichten',
          plan: [ ['feind_schwach', 'faehigkeit'], ['immer', 'schwaechster'] ] },
        { name: 'Ätzer',   mono: '🦟', hp:  46, ang: 20, tempo: 10, faeh: 'stoeren',
          plan: [ ['runde_1', 'faehigkeit'], ['immer', 'staerkster'] ] },
        { name: 'Pfleger', mono: '🌿', hp:  35, ang:  7, tempo:  7, faeh: 'flicken',
          plan: [ ['freund_schwach', 'faehigkeit'], ['immer', 'vorderster'] ] }
      ]
    }
  ];
})(SG);

/* 30 eigenstaendige Mons, vier taktische Rollen. Seltenheit ist sichtbar,
   ersetzt aber keinen guten Plan. Bestehende Startwerte bleiben erhalten. */
(function (SG) {
  var D = SG.gehstockmon.daten;
  var extra = [
    ['moosling', 'Moosling', 0, 0, 'mossling', 'Ein Waldgeist mit einem Gehstock aus lebenden Wurzeln.'],
    ['glutfuchs', 'Glutfuchs', 1, 0, 'emberling', 'Sein Schweif glimmt noch lange nach dem letzten Schlag.'],
    ['nebelmolch', 'Nebelmolch', 2, 0, 'mistling', 'Sammelt heilenden Tau in seinem gewellten Gehstock.'],
    ['kieselkrabb', 'Kieselkrabb', 0, 0, 'kieselkrabb', 'Ein kleiner Fels mit Scheren und erstaunlich großer Geduld.'],
    ['wurzelzahn', 'Wurzelzahn', 1, 0, 'wurzelzahn', 'Pflügt durch die feindliche Reihe wie durch Waldboden.'],
    ['pilzhueter', 'Pilzhüter', 2, 0, 'pilzhueter', 'Seine Sporen flicken Risse in Haut und Stein.'],
    ['rostknirps', 'Rostknirps', 3, 0, 'rostknirps', 'Ein Klopfen mit dem Eisenstock bringt jeden Plan durcheinander.'],
    ['nachtflatter', 'Nachtflatter', 3, 0, 'nachtflatter', 'Hört die Schwachstelle, bevor der Gegner sie kennt.'],
    ['sumpfschnapper', 'Sumpfschnapper', 0, 1, 'sumpfschnapper', 'Korallenharter Panzer, ein Lächeln voller Zähne.'],
    ['donnerwidder', 'Donnerwidder', 1, 1, 'donnerwidder', 'Zwischen seinen Hörnern wartet ein Gewitter.'],
    ['frostklaue', 'Frostklaue', 1, 1, 'frostklaue', 'Die Kälte ihrer Klauen durchdringt jede Deckung.'],
    ['dornenwolf', 'Dornenwolf', 1, 1, 'dornenwolf', 'Jede Dorne trägt die Erinnerung an einen gewonnenen Kampf.'],
    ['kupferskorp', 'Kupferskorp', 0, 1, 'kupferskorp', 'Sieben Panzerplatten, keine offene Flanke.'],
    ['obsidianrabe', 'Obsidianrabe', 3, 1, 'obsidianrabe', 'Schwarzes Glas und ein Blick, der jede Absicht durchschaut.'],
    ['korallenwacht', 'Korallenwacht', 2, 1, 'korallenwacht', 'Ein wandelndes Riff, das seine Verbündeten beschützt.'],
    ['runengolem', 'Runengolem', 0, 2, 'runengolem', 'Uralte Runen halten seine schwebenden Steinplatten zusammen.'],
    ['mondhexe', 'Mondhexe', 2, 2, 'mondhexe', 'Webt im Mondlicht neue Kraft in ihre Truppe.'],
    ['aschenhydra', 'Aschenhydra', 1, 2, 'aschenhydra', 'Drei Köpfe. Eine Absicht. Kein sicherer Rückzug.'],
    ['sturmhorn', 'Sturmhorn', 0, 2, 'sturmhorn', 'Ein lebender Sturm hinter einer Wand aus Kristall.'],
    ['seelenqualle', 'Seelenqualle', 2, 2, 'seelenqualle', 'Ihr Licht führt verlorene Lebensenergie zurück.'],
    ['kristallspinne', 'Kristallspinne', 3, 2, 'kristallspinne', 'Spannt unsichtbare Fäden um die stärksten Gegner.'],
    ['sonnenkoenig', 'Sonnenkönig', 1, 3, 'sonnenkoenig', 'Sein Gehstock trägt das Feuer einer untergegangenen Sonne.'],
    ['leerenwyrm', 'Leerenwyrm', 3, 3, 'leerenwyrm', 'Zwischen seinen Schuppen verschwindet selbst das Licht.'],
    ['titanenkrone', 'Titanenkrone', 0, 3, 'titanenkrone', 'Ein Gebirge, das beschlossen hat, zurückzuschlagen.'],
    ['sternengeweih', 'Sternengeweih', 2, 3, 'sternengeweih', 'In seinem Geweih wachsen neue Sternbilder.'],
    ['weltenfresser', 'Weltenfresser', 1, 3, 'weltenfresser', 'Unter seiner Goldrüstung brennt das Herz eines Vulkans.']
  ];
  D.KATALOG = D.KREATUREN.map(function (k, i) { var c = Object.assign({}, k); c.typ = i; c.lore = D.SELTENHEITEN[i].text; return c; });
  extra.forEach(function (v) {
    var basis = D.KREATUREN[v[2]];
    D.KATALOG.push({ id: v[0], name: v[1], typ: v[2], seltenheit: v[3], bild: 'gm-' + v[4], lore: v[5], rolle: basis.rolle, hp: basis.hp, ang: basis.ang, tempo: basis.tempo, faeh: basis.faeh, mono: basis.mono });
  });
  D.mon = function (id) { return D.KATALOG.find(function (k) { return k.id === id; }) || null; };
  D.neuerStand = function (save) {
    var st = { plaene: {}, geschafft: [], besitz: ['bollwerk', 'klinge', 'waerter', 'spaeher'], truppe: ['bollwerk', 'klinge', 'waerter', 'spaeher'], essenz: 60, siege: 0, beschwoerungen: 0 };
    D.KATALOG.forEach(function (k) {
      var basis = D.KREATUREN[k.typ];
      var p = save && save.plaene && save.plaene[k.id];
      st.plaene[k.id] = D.START_PLAN[basis.id].map(function (r, i) {
        var v = p && p[i];
        return v && Array.isArray(v) && D.BEDINGUNGEN.some(function (b) { return b.id === v[0]; }) && D.AKTIONEN.some(function (a) { return a.id === v[1]; }) ? v.slice(0, 2) : r.slice();
      });
    });
    if (!save || typeof save !== 'object') return st;
    if (Array.isArray(save.geschafft)) st.geschafft = D.FELDER.map(function (f) { return f.id; }).filter(function (id) { return save.geschafft.indexOf(id) >= 0; });
    if (Array.isArray(save.besitz)) save.besitz.forEach(function (id) { if (D.mon(id) && st.besitz.indexOf(id) < 0) st.besitz.push(id); });
    if (Array.isArray(save.truppe) && save.truppe.length === 4 && new Set(save.truppe).size === 4 && save.truppe.every(function (id) { return st.besitz.indexOf(id) >= 0; })) st.truppe = save.truppe.slice();
    ['essenz', 'siege', 'beschwoerungen'].forEach(function (key) { if (Number.isFinite(save[key]) && save[key] >= 0) st[key] = Math.min(10000000, Math.floor(save[key])); });
    return st;
  };
  D.beschwoere = function (st, random) {
    if (st.essenz < 60) return null;
    var pool = D.KATALOG.filter(function (k) { return st.besitz.indexOf(k.id) < 0; });
    if (!pool.length) return null;
    var weights = [8, 5, 3, 1], total = pool.reduce(function (sum, k) { return sum + weights[k.seltenheit]; }, 0);
    var pick = Math.max(0, Math.min(0.9999999, Number.isFinite(random) ? random : Math.random())) * total;
    var chosen = pool[pool.length - 1];
    for (var i = 0; i < pool.length; i++) { pick -= weights[pool[i].seltenheit]; if (pick < 0) { chosen = pool[i]; break; } }
    st.essenz -= 60; st.besitz.push(chosen.id); st.beschwoerungen++; return chosen;
  };
})(SG);

/* Fünf Einstiegsreviere und zwanzig weitere Gebiete in einer großen Welt. */
(function (SG) {
  var D = SG.gehstockmon.daten;
  var names = ['Wurzelhafen', 'Dornental', 'Eisenfurt', 'Falkenwacht', 'Mondhain', 'Glutkessel', 'Runenpass', 'Schattensteg', 'Kristallbucht', 'Sturmwarte', 'Knochenkliff', 'Bernsteinwall', 'Nachtquell', 'Himmelsbruch', 'Titanenpfad', 'Sternenruh', 'Kronenfels', 'Aschenzunge', 'Leerenpforte', 'Weltenkrone'];
  var original = D.FELDER.slice();
  names.forEach(function (name, i) {
    var base = original[(i + 1) % 5];
    D.FELDER.push({ id: i + 6, name: name, lehre: base.lehre, feinde: JSON.parse(JSON.stringify(base.feinde)), vorlage: base.id });
  });
})(SG);

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

/* Rundenkampf: genau ein aktives Mon pro Seite, jede Spieleraktion ist explizit. */
(function (SG) {
  var D = SG.gehstockmon.daten, A = SG.gehstockmon.arena = {};
  var stats = [[132,20,3],[88,29,8],[112,22,5],[96,25,11]];
  var specials = ['Schildstoß', 'Sichelstreich', 'Lebensquell', 'Runenstörung'];
  A.stats = function (mon) { var s = stats[mon.typ]; return { hp: s[0], ang: s[1], tempo: s[2] }; };
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
    var ids = roster[(fieldId - 1) % 5].slice();
    if (fieldId > 15) ids[ids.length - 1] = ['titanenkrone','sonnenkoenig','sternengeweih','leerenwyrm','weltenfresser'][(fieldId - 1) % 5];
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

/* ------------------------------------------------------------------
   GehstockMon - Kampfmaschine.

   Reine Regeln, kein DOM. Rein gehen zwei Truppen mit ihren Plaenen,
   heraus kommt eine Liste von Schritten, die 3-ui.js abspielt. Liegt
   unter SG.rules, damit tools/test.mjs sie ohne Browser durchrechnen
   kann.

   Wichtigste Entscheidung: der Kampf ist VOLLSTAENDIG DETERMINISTISCH.
   Kein Zufall, keine Streuung beim Schaden. In einem Spiel, in dem man
   Regeln schreibt, muss eine Niederlage am Plan liegen und nicht am
   Wuerfel - sonst lernt man aus ihr nichts.
   ------------------------------------------------------------------ */

(function (SG) {
  var K = SG.rules.gehstockmon = {};

  var MAX_RUNDEN = 12;      /* danach Patt, zaehlt als Niederlage */
  var HEILUNG    = 32;
  var SCHWACH    = 0.4;     /* Schwelle fuer "unter 40 %" */

  K.MAX_RUNDEN = MAX_RUNDEN;

  function lebt(e) { return e.hp > 0; }

  function lebende(liste, seite) {
    var out = [];
    for (var i = 0; i < liste.length; i++) {
      if (!lebt(liste[i])) continue;
      if (seite && liste[i].seite !== seite) continue;
      out.push(liste[i]);
    }
    return out;
  }

  /* Baut aus einer Datenzeile eine Kampfeinheit. Die Marken sind der
     ganze veraenderliche Zustand: spott zieht Angriffe auf sich,
     stoeren halbiert den naechsten eigenen Schlag, verteidigt halbiert
     eingehenden Schaden. Alle drei laufen bis zum naechsten eigenen Zug
     ihres Traegers. */
  function baue(roh, seite, i, plan) {
    var p = plan || roh.plan || [];
    var aktiv = [];
    for (var n = 0; n < p.length; n++) if (p[n][0] !== 'aus') aktiv.push(p[n]);
    return {
      uid: seite + i, seite: seite,
      name: roh.name, mono: roh.mono, monId: roh.id || null,
      maxHp: roh.hp, hp: roh.hp, ang: roh.ang, tempo: roh.tempo,
      faeh: roh.faeh, plan: aktiv, gefallen: false, pause: 0,
      marken: { spott: 0, stoeren: 0, verteidigt: 0 }
    };
  }

  /* Prueft eine Bedingung. Bewusst ohne verdeckte Information: alles,
     was eine Regel abfragen kann, sieht der Spieler auch. */
  function trifftZu(bed, ich, alle, runde) {
    var meine = lebende(alle, ich.seite);
    var feinde = [], i;
    var alleLeben = lebende(alle);
    for (i = 0; i < alleLeben.length; i++) {
      if (alleLeben[i].seite !== ich.seite) feinde.push(alleLeben[i]);
    }
    if (bed === 'immer') return true;
    if (bed === 'ich_schwach') return ich.hp / ich.maxHp < SCHWACH;
    if (bed === 'runde_1') return runde === 1;
    if (bed === 'ueberzahl') return feinde.length > meine.length;
    if (bed === 'freund_schwach') {
      for (i = 0; i < meine.length; i++) {
        if (meine[i] !== ich && meine[i].hp / meine[i].maxHp < SCHWACH) return true;
      }
      return false;
    }
    if (bed === 'feind_schwach') {
      for (i = 0; i < feinde.length; i++) {
        if (feinde[i].hp / feinde[i].maxHp < SCHWACH) return true;
      }
      return false;
    }
    return false;
  }

  /* Zielwahl. Ein aktiver Spott ueberschreibt jede Absicht - das ist der
     Grund, warum Feld 4 mit dem Standardplan nicht zu gewinnen ist. */
  function waehleZiel(alle, ich, art) {
    var alleLeben = lebende(alle), feinde = [], i;
    for (i = 0; i < alleLeben.length; i++) {
      if (alleLeben[i].seite !== ich.seite) feinde.push(alleLeben[i]);
    }
    if (!feinde.length) return null;
    /* Spott zieht alles auf sich - ausser dem gezielten Schlag auf den
       Staerksten. Ohne diese Luecke waere ein Wall eine Mauer ohne Tuer,
       und Feld 4 waere mit keinem Plan zu gewinnen. So ist der Wall eine
       Aufgabe: erkennen, dass man am ihm vorbeizielen muss. */
    if (art !== 'staerkster') {
      for (i = 0; i < feinde.length; i++) if (feinde[i].marken.spott > 0) return feinde[i];
    }
    var best = feinde[0];
    for (i = 1; i < feinde.length; i++) {
      if (art === 'schwaechster' && feinde[i].hp < best.hp) best = feinde[i];
      else if (art === 'staerkster' && feinde[i].ang > best.ang) best = feinde[i];
    }
    if (art !== 'schwaechster' && art !== 'staerkster') return feinde[0];
    return best;
  }

  /* Zwei Halbierungen koennen sich stapeln: der Schlaeger ist gestoert
     UND das Ziel verteidigt. Gewollt, damit sich beides zusammen lohnt. */
  function schadenAn(ziel, roh) {
    var s = ziel.marken.verteidigt ? Math.round(roh / 2) : roh;
    ziel.hp = Math.max(0, ziel.hp - s);
    return s;
  }

  function nutzeFaehigkeit(alle, ich) {
    var ziel, i;

    if (ich.faeh === 'spott') {
      ich.marken.spott = 1;
      return ich.name + ' stellt sich vor die Reihe.';
    }

    if (ich.faeh === 'hinrichten') {
      ziel = waehleZiel(alle, ich, 'schwaechster');
      if (!ziel) return ich.name + ' findet kein Ziel.';
      var doppelt = ziel.hp / ziel.maxHp < SCHWACH;
      var roh = doppelt ? ich.ang * 2 : ich.ang;
      if (ich.marken.stoeren) { roh = Math.round(roh / 2); ich.marken.stoeren = 0; }
      var s = schadenAn(ziel, roh);
      return ich.name + ' richtet ' + ziel.name + ' hin: ' + s +
        (doppelt ? ' Schaden, doppelt.' : ' Schaden.');
    }

    if (ich.faeh === 'flicken') {
      var meine = lebende(alle, ich.seite);
      ziel = meine[0];
      for (i = 1; i < meine.length; i++) {
        if ((meine[i].maxHp - meine[i].hp) > (ziel.maxHp - ziel.hp)) ziel = meine[i];
      }
      if (!ziel || ziel.hp === ziel.maxHp) return ich.name + ' hat niemanden zu flicken.';
      var vorher = ziel.hp;
      ziel.hp = Math.min(ziel.maxHp, ziel.hp + HEILUNG);
      return ich.name + ' flickt ' + ziel.name + ': +' + (ziel.hp - vorher) + ' Leben.';
    }

    if (ich.faeh === 'stoeren') {
      ziel = waehleZiel(alle, ich, 'staerkster');
      if (!ziel) return ich.name + ' findet kein Ziel.';
      ziel.marken.stoeren = 1;
      return ich.name + ' stört ' + ziel.name + '. Nächster Schlag halbiert.';
    }

    return ich.name + ' zögert.';
  }

  function greifeAn(alle, ich, art) {
    var ziel = waehleZiel(alle, ich, art);
    if (!ziel) return ich.name + ' findet kein Ziel.';
    var roh = ich.ang, gestoert = false;
    if (ich.marken.stoeren) { roh = Math.round(roh / 2); ich.marken.stoeren = 0; gestoert = true; }
    var s = schadenAn(ziel, roh);
    return ich.name + ' trifft ' + ziel.name + ': ' + s + ' Schaden.' +
      (gestoert ? ' (gestört)' : '');
  }

  /* ----------------------------------------------------------------
     Der Kampf.

     kaempfe(meine, plaene, feinde) ->
       { schritte: [{runde, seite, text, zustand}], sieger: 'wir'|'sie'|'patt' }

     zustand ist eine Momentaufnahme aller Lebenspunkte nach dem Schritt.
     Kostet etwas Speicher und erspart der Oberflaeche jede eigene
     Simulation: sie spult nur die Liste ab.
     ---------------------------------------------------------------- */
  K.kaempfe = function (meineRoh, plaene, feindRoh) {
    var alle = [], i;
    for (i = 0; i < meineRoh.length; i++) {
      alle.push(baue(meineRoh[i], 'wir', i, plaene ? plaene[meineRoh[i].id] : null));
    }
    for (i = 0; i < feindRoh.length; i++) alle.push(baue(feindRoh[i], 'sie', i, null));

    var schritte = [];
    function momentaufnahme() {
      var m = [];
      for (var n = 0; n < alle.length; n++) m.push({ uid: alle[n].uid, hp: alle[n].hp });
      return m;
    }
    function notiere(runde, seite, text, actor) {
      schritte.push({ runde: runde, seite: seite, text: text, actor: actor || null, zustand: momentaufnahme() });
    }

    var sieger = 'patt';

    for (var runde = 1; runde <= MAX_RUNDEN; runde++) {
      /* Zugreihenfolge wird zu Rundenbeginn festgelegt. Wer schneller
         ist, kommt zuerst; bei Gleichstand unsere Seite. */
      var reihe = lebende(alle).slice().sort(function (a, b) {
        if (b.tempo !== a.tempo) return b.tempo - a.tempo;
        return a.seite === 'wir' ? -1 : 1;
      });

      for (var r = 0; r < reihe.length; r++) {
        var ich = reihe[r];
        if (!lebt(ich)) continue;

        /* Marken, die bis zum eigenen Zug laufen, verfallen hier. */
        ich.marken.spott = 0;
        ich.marken.verteidigt = 0;
        /* Abklingzeit ebenfalls. Ohne sie heilen sich zwei Heiler
           gegenseitig endlos und jeder Kampf endet im Patt - das war in
           der ersten Fassung tatsaechlich so. */
        if (ich.pause > 0) ich.pause--;

        var regel = null;
        for (var p = 0; p < ich.plan.length; p++) {
          if (trifftZu(ich.plan[p][0], ich, alle, runde)) { regel = ich.plan[p]; break; }
        }
        /* Ohne passende Regel wird draufgehauen. Ein Plan, der nichts
           trifft, soll die Kreatur nicht einfrieren lassen. */
        var aktion = regel ? regel[1] : 'vorderster';

        var text;
        if (aktion === 'faehigkeit') {
          if (ich.pause > 0) {
            /* Noch nicht bereit. Statt die Runde zu verschenken wird
               angegriffen - eine Kreatur, die dasteht, waere nur
               aergerlich, nicht lehrreich. */
            text = greifeAn(alle, ich, 'vorderster') + ' (Fähigkeit noch nicht bereit)';
          } else {
            text = nutzeFaehigkeit(alle, ich);
            /* Eine Faehigkeit, die ins Leere lief (nichts zu heilen,
               kein Ziel), darf die Abklingzeit nicht kosten. Sonst
               bestraft das Spiel eine Regel, die gar nicht gegriffen hat. */
            if (text.indexOf('niemanden') < 0 && text.indexOf('kein Ziel') < 0) ich.pause = 2;
          }
        }
        else if (aktion === 'verteidigen') {
          ich.marken.verteidigt = 1;
          text = ich.name + ' geht in Deckung.';
        } else text = greifeAn(alle, ich, aktion);

        notiere(runde, ich.seite, text, ich.uid);

        /* Gefallene sofort melden, sonst wundert man sich beim Zusehen. */
        for (var g = 0; g < alle.length; g++) {
          if (!lebt(alle[g]) && !alle[g].gefallen) {
            alle[g].gefallen = true;
            notiere(runde, alle[g].seite, alle[g].name + ' fällt.');
          }
        }

        if (!lebende(alle, 'sie').length) { sieger = 'wir'; break; }
        if (!lebende(alle, 'wir').length) { sieger = 'sie'; break; }
      }
      if (sieger !== 'patt') break;
    }

    return { schritte: schritte, sieger: sieger, einheiten: alle };
  };
})(SG);

export const data = SG.gehstockmon.daten;
export const economy = SG.gehstockmon.wirtschaft;
export const arena = SG.gehstockmon.arena;
export const fight = SG.rules.gehstockmon.kaempfe;
