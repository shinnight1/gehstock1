/* ------------------------------------------------------------------
   Fortschritt: Erfahrung, Stufen, Erfolge.

   Bisher endete jedes Spiel bei sich selbst - ein Bestwert hier, ein
   Zaehler dort, und zwischen den Spielen gab es nichts. Hier liegt das
   Band darueber: eine Stufe, die fuer alles zaehlt, was jemand im
   Hideout tut, und eine Liste von Erfolgen, die quer ueber die Spiele
   geht.

   Erfahrung gibt es fuer
     - eine beendete Runde        (mit Tagesdeckel je Spiel)
     - einen Sieg                 (zusaetzlich)
     - einen neuen Bestwert       (zusaetzlich)
     - ein Spiel zum ersten Mal
     - jeden freigeschalteten Erfolg

   Der Tagesdeckel ist Absicht. Ohne ihn waere die schnellste Art,
   Stufen zu sammeln, dasselbe Spiel hundertmal in zehn Sekunden
   abzubrechen - und genau das soll es nicht sein.

   Alles haengt am Zugangscode: der Fortschritt gehoert der Person,
   nicht dem Geraet. SG.storage legt ihn dafuer schon unter
   hgh:u:<CODE>:… ab.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var store = SG.storage;

  var F = SG.fortschritt = {};

  var bus = U.emitter();
  F.on = bus.on;
  F.off = bus.off;

  var SCHLUESSEL = 'fortschritt';

  /* ---------------------------------------------------------- Werte */

  F.XP = {
    runde: 8,          // eine Runde zu Ende gespielt
    sieg: 18,          // zusaetzlich bei Sieg
    rekord: 45,        // zusaetzlich bei neuem Bestwert
    neuesSpiel: 30,    // ein Spiel zum ersten Mal beendet
  };

  F.TAGESDECKEL = 8;   // so viele Runden je Spiel und Tag geben Erfahrung

  /* Was die naechste Stufe kostet. Waechst schneller als linear, aber
     nicht so steil, dass Stufe 30 unerreichbar wird. */
  F.bedarf = function (stufe) {
    return Math.round(55 * Math.pow(stufe, 1.25)) + 45;
  };

  F.MAXSTUFE = 60;

  F.RAENGE = [
    { ab: 1, name: 'Gast', icon: '🚪' },
    { ab: 3, name: 'Stammgast', icon: '🪑' },
    { ab: 6, name: 'Kenner', icon: '🎯' },
    { ab: 10, name: 'Sammler', icon: '🗝' },
    { ab: 15, name: 'Veteran', icon: '🎖' },
    { ab: 21, name: 'Meister', icon: '🏅' },
    { ab: 28, name: 'Großmeister', icon: '👑' },
    { ab: 36, name: 'Legende', icon: '⭐' },
    { ab: 45, name: 'Gehstockträger', icon: '🦯' },
    { ab: 55, name: 'Herr Gehstocks Vertrauter', icon: '🎩' },
  ];

  F.rang = function (stufe) {
    var r = F.RAENGE[0];
    for (var i = 0; i < F.RAENGE.length; i++) {
      if (stufe >= F.RAENGE[i].ab) r = F.RAENGE[i];
    }
    return r;
  };

  /* Stufe, Rest und Bedarf aus der Gesamterfahrung */
  F.stufeAus = function (xp) {
    var s = 1;
    var rest = Math.max(0, xp | 0);
    while (s < F.MAXSTUFE) {
      var b = F.bedarf(s);
      if (rest < b) return { stufe: s, rest: rest, bedarf: b };
      rest -= b;
      s++;
    }
    return { stufe: F.MAXSTUFE, rest: 0, bedarf: 0, voll: true };
  };

  /* Gesamterfahrung, die eine Stufe voraussetzt - fuer die Anzeige */
  F.xpFuerStufe = function (stufe) {
    var summe = 0;
    for (var s = 1; s < stufe && s < F.MAXSTUFE; s++) summe += F.bedarf(s);
    return summe;
  };

  /* ---------------------------------------------------------- Speicher */

  function leer() {
    return {
      xp: 0,               // insgesamt verdient - faellt nie
      ausgegeben: 0,       // davon schon eingetauscht
      erfolge: {},         // id -> Zeitstempel
      runden: 0,
      rekorde: 0,
      siege: 0,
      spiele: {},          // Spiel-id -> beendete Runden
      gewonnen: {},        // Spiel-id -> gewonnene Runden
      tage: [],            // Datumsstempel, an denen gespielt wurde
      heute: { d: '', n: {} },
      gesehen: {},         // schon gemeldete Erfolge (fuer die Anzeige)
    };
  }

  var daten = null;

  function gesperrt() {
    return !!(SG.selftest && SG.selftest.active);
  }

  F.daten = function () {
    if (!daten) daten = U.assign(leer(), store.get(SCHLUESSEL, null) || {});
    return daten;
  };

  /* Nach einem Codewechsel gehoert der Fortschritt einer anderen Person */
  F.neuLaden = function () {
    daten = null;
    F.daten();
    bus.emit('aenderung', F.stand());
  };

  function merken() {
    if (gesperrt()) return;
    store.set(SCHLUESSEL, daten);
  }

  function heute() {
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  /* ---------------------------------------------------------- Stand */

  F.stand = function () {
    var d = F.daten();
    var s = F.stufeAus(d.xp);
    return {
      xp: d.xp,
      stufe: s.stufe,
      rest: s.rest,
      bedarf: s.bedarf,
      voll: !!s.voll,
      anteil: s.bedarf ? s.rest / s.bedarf : 1,
      rang: F.rang(s.stufe),
      runden: d.runden,
      rekorde: d.rekorde,
      siege: d.siege,
      tage: d.tage.length,
      erfolge: Object.keys(d.erfolge).length,
      erfolgeGesamt: F.ERFOLGE.length,
      ausgegeben: d.ausgegeben || 0,
      guthaben: Math.max(0, d.xp - (d.ausgegeben || 0)),
    };
  };

  F.stufe = function () { return F.stufeAus(F.daten().xp).stufe; };

  /* ------------------------------------------------------------------
     Erfahrung als Waehrung.

     Die Stufe haengt an der insgesamt verdienten Erfahrung - die faellt
     nie. Was man ausgibt, wird getrennt mitgezaehlt. Wer sich also auf
     der Weltkarte Pixel kauft, verliert kein Level, sondern nur sein
     Guthaben. Alles andere waere eine Strafe fuers Mitmachen.
     ------------------------------------------------------------------ */

  F.guthaben = function () {
    var d = F.daten();
    return Math.max(0, d.xp - (d.ausgegeben || 0));
  };

  F.ausgeben = function (betrag, grund) {
    betrag = Math.round(betrag);
    if (!betrag || betrag < 0) return false;
    if (gesperrt()) return false;
    if (F.guthaben() < betrag) return false;
    var d = F.daten();
    d.ausgegeben = (d.ausgegeben || 0) + betrag;
    merken();
    bus.emit('ausgabe', { betrag: betrag, grund: grund, guthaben: F.guthaben() });
    bus.emit('aenderung', F.stand());
    return true;
  };

  F.hat = function (erfolgId) { return !!F.daten().erfolge[erfolgId]; };

  F.verschiedeneSpiele = function () {
    return Object.keys(F.daten().spiele).length;
  };

  /* ---------------------------------------------------------- Vergeben */

  /* Traegt Erfahrung ein und meldet einen Stufenaufstieg.
     grund ist nur Text fuer die Einblendung. */
  F.geben = function (betrag, grund) {
    if (gesperrt()) return null;
    betrag = Math.round(betrag);
    if (!betrag || !isFinite(betrag)) return null;

    var d = F.daten();
    var vorher = F.stufeAus(d.xp).stufe;
    d.xp = Math.max(0, d.xp + betrag);
    var nachher = F.stufeAus(d.xp).stufe;
    merken();

    var auf = nachher > vorher;
    bus.emit('xp', { betrag: betrag, grund: grund, stufe: nachher, auf: auf });
    if (auf) bus.emit('stufe', { von: vorher, auf: nachher, rang: F.rang(nachher) });
    bus.emit('aenderung', F.stand());
    return { stufe: nachher, aufgestiegen: auf };
  };

  /* ---------------------------------------------------------- Ereignisse */

  /* Der Haupteingang: eine Runde ist zu Ende. Wird von host.gameOver
     gerufen, kann aber auch von Hand kommen (die Tycoons enden nie). */
  F.rundeBeendet = function (spielId, o) {
    if (gesperrt()) return null;
    o = o || {};
    var d = F.daten();
    var tag = heute();

    if (d.heute.d !== tag) d.heute = { d: tag, n: {} };
    if (d.tage.indexOf(tag) < 0) {
      d.tage.push(tag);
      if (d.tage.length > 400) d.tage.shift();
    }

    var erste = !d.spiele[spielId];
    d.spiele[spielId] = (d.spiele[spielId] || 0) + 1;
    d.runden++;
    if (o.gewonnen) { d.siege++; d.gewonnen[spielId] = (d.gewonnen[spielId] || 0) + 1; }
    if (o.rekord) d.rekorde++;

    var n = (d.heute.n[spielId] || 0) + 1;
    d.heute.n[spielId] = n;

    var xp = 0;
    var gruende = [];
    if (n <= F.TAGESDECKEL) {
      xp += F.XP.runde;
      gruende.push('Runde');
      if (o.gewonnen) { xp += F.XP.sieg; gruende.push('Sieg'); }
    }
    /* Ein Bestwert zaehlt immer - der laesst sich nicht am Fliessband
       herstellen, dafuer muss man wirklich besser werden. */
    if (o.rekord) { xp += F.XP.rekord; gruende.push('Rekord'); }
    if (erste) { xp += F.XP.neuesSpiel; gruende.push('Neues Spiel'); }

    merken();
    if (xp) F.geben(xp, gruende.join(' · '));
    F.pruefen({ spiel: spielId, gewonnen: !!o.gewonnen, rekord: !!o.rekord });
    return xp;
  };

  /* Fuer Spiele ohne Ende - die Tycoons melden Meilensteine selbst. */
  F.meilenstein = function (spielId, schluessel, xp, text) {
    if (gesperrt()) return null;
    var d = F.daten();
    var k = 'm:' + spielId + ':' + schluessel;
    if (d.erfolge[k]) return null;          // jeden nur einmal
    d.erfolge[k] = Date.now();
    merken();
    F.geben(xp || 40, text || 'Meilenstein');
    F.pruefen({ spiel: spielId });
    return true;
  };

  /* ---------------------------------------------------------- Erfolge */

  /* Zugriff auf alles, was eine Bedingung wissen muss. Liest nur. */
  function umfeld(ereignis) {
    var d = F.daten();
    return {
      ereignis: ereignis || {},
      runden: d.runden,
      rekorde: d.rekorde,
      siege: d.siege,
      tage: d.tage.length,
      stufe: F.stufeAus(d.xp).stufe,
      verschiedene: Object.keys(d.spiele).length,
      gespielt: function (id) { return d.spiele[id] || 0; },
      gewonnen: function (id) { return d.gewonnen[id] || 0; },
      partien: function (id) { return SG.scores.plays(id); },
      zaehler: function (id, k) { return SG.scores.stat(id, k); },
      best: function (id) {
        var b = SG.scores.allBest(id);
        var max = null;
        for (var k in b) {
          if (typeof b[k] !== 'number') continue;
          if (max === null || b[k] > max) max = b[k];
        }
        return max === null ? -Infinity : max;
      },
      bestKlein: function (id) {
        var b = SG.scores.allBest(id);
        var min = null;
        for (var k in b) {
          if (typeof b[k] !== 'number') continue;
          if (min === null || b[k] < min) min = b[k];
        }
        return min === null ? Infinity : min;
      },
      alleSpiele: function () {
        var liste = SG.list().filter(function (g) { return !g.external; });
        for (var i = 0; i < liste.length; i++) {
          if (!d.spiele[liste[i].id]) return false;
        }
        return liste.length > 0;
      },
      favoriten: function () { return SG.scores.favorites().length; },
      stunde: new Date().getHours(),
    };
  }

  /* Prueft alle noch offenen Erfolge. 70 Vergleiche kosten nichts. */
  F.pruefen = function (ereignis) {
    if (gesperrt()) return [];
    var d = F.daten();
    var u = umfeld(ereignis);
    var neu = [];

    for (var i = 0; i < F.ERFOLGE.length; i++) {
      var e = F.ERFOLGE[i];
      if (d.erfolge[e.id]) continue;
      var trifft = false;
      try { trifft = !!e.wenn(u); } catch (err) { SG.noteError('erfolg:' + e.id, err); }
      if (!trifft) continue;
      d.erfolge[e.id] = Date.now();
      neu.push(e);
    }

    if (!neu.length) return neu;

    merken();
    var summe = 0;
    for (i = 0; i < neu.length; i++) summe += neu[i].xp;
    /* Erst eintragen, dann Erfahrung geben - sonst koennte ein
       Stufen-Erfolg sich selbst ausloesen, waehrend er schon laeuft. */
    if (summe) F.geben(summe, neu.length === 1 ? neu[0].name : neu.length + ' Erfolge');
    for (i = 0; i < neu.length; i++) bus.emit('erfolg', neu[i]);
    bus.emit('aenderung', F.stand());

    /* Ein Erfolg kann den naechsten ausloesen (Erfolgssammler). Einmal
       nachfassen genuegt, eine Schleife waere hier nur ein Risiko. */
    if (!(ereignis && ereignis.nachfassen)) {
      F.pruefen(U.assign({}, ereignis || {}, { nachfassen: true }));
    }
    return neu;
  };

  F.erfolg = function (id) {
    for (var i = 0; i < F.ERFOLGE.length; i++) {
      if (F.ERFOLGE[i].id === id) return F.ERFOLGE[i];
    }
    return null;
  };

  F.erfolgZeit = function (id) { return F.daten().erfolge[id] || 0; };

  /* Erfolge eines Spiels, fuer die Kachel und den Profilbildschirm */
  F.erfolgeVon = function (spielId) {
    return F.ERFOLGE.filter(function (e) { return e.spiel === spielId; });
  };

  F.zaehlung = function (spielId) {
    var liste = spielId ? F.erfolgeVon(spielId) : F.ERFOLGE;
    var d = F.daten();
    var hat = 0;
    for (var i = 0; i < liste.length; i++) if (d.erfolge[liste[i].id]) hat++;
    return { hat: hat, gesamt: liste.length };
  };

  F.zuruecksetzen = function () {
    daten = leer();
    merken();
    bus.emit('aenderung', F.stand());
  };

  /* ------------------------------------------------------------------
     Die Liste.

     spiel: null      -> gilt fuer das ganze Hideout
     geheim: true     -> Bedingung wird erst nach dem Freischalten verraten
     ------------------------------------------------------------------ */

  function E(id, icon, name, text, xp, wenn, o) {
    var e = { id: id, icon: icon, name: name, text: text, xp: xp, wenn: wenn };
    if (o) U.assign(e, o);
    return e;
  }

  F.ERFOLGE = [

    /* ---------------------------------------------------- Rund ums Haus */

    E('start', '🚪', 'Reingekommen', 'Spiel eine Runde zu Ende.', 20,
      function (u) { return u.runden >= 1; }),
    E('runden10', '🔁', 'Warmgelaufen', 'Beende 10 Runden.', 30,
      function (u) { return u.runden >= 10; }),
    E('runden100', '💯', 'Hundert Runden', 'Beende 100 Runden.', 90,
      function (u) { return u.runden >= 100; }),
    E('runden500', '🏛', 'Dauergast', 'Beende 500 Runden.', 260,
      function (u) { return u.runden >= 500; }),

    E('spiele5', '🧭', 'Umgeschaut', 'Spiele 5 verschiedene Spiele.', 40,
      function (u) { return u.verschiedene >= 5; }),
    E('spiele15', '🗺', 'Neugierig', 'Spiele 15 verschiedene Spiele.', 110,
      function (u) { return u.verschiedene >= 15; }),
    E('spieleAlle', '🎪', 'Alles angefasst', 'Spiele jedes Spiel im Hideout mindestens einmal.', 320,
      function (u) { return u.alleSpiele(); }),

    E('tage3', '📅', 'Wiedergekommen', 'Spiele an 3 verschiedenen Tagen.', 45,
      function (u) { return u.tage >= 3; }),
    E('tage7', '🗓', 'Eine Woche', 'Spiele an 7 verschiedenen Tagen.', 120,
      function (u) { return u.tage >= 7; }),
    E('tage30', '🏆', 'Ein Monat', 'Spiele an 30 verschiedenen Tagen.', 380,
      function (u) { return u.tage >= 30; }),

    E('rekorde10', '📈', 'Rekordjäger', 'Stelle 10 persönliche Bestwerte auf.', 120,
      function (u) { return u.rekorde >= 10; }),
    E('rekorde50', '🥇', 'Kaum zu schlagen', 'Stelle 50 persönliche Bestwerte auf.', 300,
      function (u) { return u.rekorde >= 50; }),

    E('siege25', '⚔', 'Siegertyp', 'Gewinne 25 Partien.', 130,
      function (u) { return u.siege >= 25; }),

    E('favoriten', '⭐', 'Lieblinge', 'Markiere 5 Spiele als Favorit.', 40,
      function (u) { return u.favoriten() >= 5; }),

    E('stufe10', '🎖', 'Stufe zehn', 'Erreiche Stufe 10.', 100,
      function (u) { return u.stufe >= 10; }),
    E('stufe25', '👑', 'Stufe fünfundzwanzig', 'Erreiche Stufe 25.', 260,
      function (u) { return u.stufe >= 25; }),
    E('stufe40', '⭐', 'Stufe vierzig', 'Erreiche Stufe 40.', 500,
      function (u) { return u.stufe >= 40; }),

    E('nacht', '🌙', 'Nachtschicht', 'Beende nach 23 Uhr eine Runde.', 35,
      function (u) { return u.stunde >= 23 && u.runden >= 1 && !!u.ereignis.spiel; },
      { geheim: true }),
    E('frueh', '🌅', 'Vor dem Frühstück', 'Beende vor 7 Uhr eine Runde.', 35,
      function (u) { return u.stunde < 7 && u.runden >= 1 && !!u.ereignis.spiel; },
      { geheim: true }),

    /* ---------------------------------------------------- Arcade */

    E('tetris1', '🧱', 'Erste Reihen', 'Erreiche 2.000 Punkte in Tetris.', 45,
      function (u) { return u.best('tetris') >= 2000; }, { spiel: 'tetris' }),
    E('tetris2', '🏗', 'Bauarbeiter', 'Erreiche 10.000 Punkte in Tetris.', 110,
      function (u) { return u.best('tetris') >= 10000; }, { spiel: 'tetris' }),
    E('tetris3', '🌆', 'Der Turm steht', 'Erreiche 30.000 Punkte in Tetris.', 240,
      function (u) { return u.best('tetris') >= 30000; }, { spiel: 'tetris' }),

    E('snake1', '🐍', 'Angebissen', 'Erreiche 150 Punkte in Snake.', 45,
      function (u) { return u.best('snake') >= 150; }, { spiel: 'snake' }),
    E('snake2', '🐉', 'Lange Leitung', 'Erreiche 600 Punkte in Snake.', 130,
      function (u) { return u.best('snake') >= 600; }, { spiel: 'snake' }),

    E('breakout1', '🧱', 'Durchbruch', 'Erreiche 2.000 Punkte im Blockbrecher.', 45,
      function (u) { return u.best('breakout') >= 2000; }, { spiel: 'breakout' }),
    E('breakout2', '💥', 'Abrissbirne', 'Erreiche 12.000 Punkte im Blockbrecher.', 130,
      function (u) { return u.best('breakout') >= 12000; }, { spiel: 'breakout' }),

    E('invaders1', '👾', 'Erste Welle', 'Erreiche 1.500 Punkte bei Space Invaders.', 45,
      function (u) { return u.best('invaders') >= 1500; }, { spiel: 'invaders' }),
    E('invaders2', '🛸', 'Luftabwehr', 'Erreiche 8.000 Punkte bei Space Invaders.', 130,
      function (u) { return u.best('invaders') >= 8000; }, { spiel: 'invaders' }),

    E('asteroids1', '☄', 'Steinschlag', 'Erreiche 1.500 Punkte bei Asteroids.', 45,
      function (u) { return u.best('asteroids') >= 1500; }, { spiel: 'asteroids' }),
    E('asteroids2', '🚀', 'Freie Bahn', 'Erreiche 8.000 Punkte bei Asteroids.', 130,
      function (u) { return u.best('asteroids') >= 8000; }, { spiel: 'asteroids' }),

    E('maze1', '👻', 'Erste Runde', 'Erreiche 3.000 Punkte im Labyrinth.', 45,
      function (u) { return u.best('maze') >= 3000; }, { spiel: 'maze' }),
    E('maze2', '🍒', 'Gejagt und gefressen', 'Erreiche 15.000 Punkte im Labyrinth.', 140,
      function (u) { return u.best('maze') >= 15000; }, { spiel: 'maze' }),

    /* ---------------------------------------------------- Schnell & locker */

    E('flappy1', '🐤', 'Durchgeflattert', 'Schaffe 10 Röhren im Flatterflug.', 45,
      function (u) { return u.best('flappy') >= 10; }, { spiel: 'flappy' }),
    E('flappy2', '🦅', 'Segelflieger', 'Schaffe 35 Röhren im Flatterflug.', 140,
      function (u) { return u.best('flappy') >= 35; }, { spiel: 'flappy' }),

    E('jumper1', '🪜', 'Nach oben', 'Erreiche 800 Punkte beim Springer.', 45,
      function (u) { return u.best('jumper') >= 800; }, { spiel: 'jumper' }),
    E('jumper2', '🚀', 'Höhenflug', 'Erreiche 4.000 Punkte beim Springer.', 130,
      function (u) { return u.best('jumper') >= 4000; }, { spiel: 'jumper' }),

    E('hop1', '🐔', 'Erste Straße', 'Erreiche 50 Punkte auf der Hüpf-Straße.', 45,
      function (u) { return u.best('hop') >= 50; }, { spiel: 'hop' }),
    E('hop2', '🚚', 'Verkehrssicher', 'Erreiche 200 Punkte auf der Hüpf-Straße.', 130,
      function (u) { return u.best('hop') >= 200; }, { spiel: 'hop' }),

    E('stack1', '🏢', 'Gut gestapelt', 'Erreiche 150 Punkte beim Turmstapler.', 45,
      function (u) { return u.best('stack') >= 150; }, { spiel: 'stack' }),
    E('stack2', '🗼', 'Hoch hinaus', 'Erreiche 600 Punkte beim Turmstapler.', 130,
      function (u) { return u.best('stack') >= 600; }, { spiel: 'stack' }),

    E('bubble1', '🫧', 'Aufgeräumt', 'Erreiche 3.000 Punkte im Bubble Shooter.', 45,
      function (u) { return u.best('bubble') >= 3000; }, { spiel: 'bubble' }),
    E('bubble2', '🎯', 'Bankschuss', 'Erreiche 15.000 Punkte im Bubble Shooter.', 130,
      function (u) { return u.best('bubble') >= 15000; }, { spiel: 'bubble' }),

    /* ---------------------------------------------------- Rätsel */

    E('t2048a', '🔢', 'Fünftausend', 'Erreiche 5.000 Punkte bei 2048.', 45,
      function (u) { return u.best('2048') >= 5000; }, { spiel: '2048' }),
    E('t2048b', '🧮', 'Die Kachel', 'Erreiche 20.000 Punkte bei 2048.', 150,
      function (u) { return u.best('2048') >= 20000; }, { spiel: '2048' }),

    E('sudoku1', '✏', 'Erstes Rätsel', 'Löse ein Sudoku.', 45,
      function (u) { return u.gewonnen('sudoku') >= 1; }, { spiel: 'sudoku' }),
    E('sudoku2', '🖊', 'Zwanzig Rätsel', 'Löse 20 Sudokus.', 150,
      function (u) { return u.gewonnen('sudoku') >= 20; }, { spiel: 'sudoku' }),

    E('nonogram1', '🎨', 'Bild erkannt', 'Löse ein Nonogramm.', 45,
      function (u) { return u.gewonnen('nonogram') >= 1; }, { spiel: 'nonogram' }),
    E('nonogram2', '🖼', 'Galerie', 'Löse 15 Nonogramme.', 150,
      function (u) { return u.gewonnen('nonogram') >= 15; }, { spiel: 'nonogram' }),

    E('pipes1', '🔧', 'Dicht', 'Löse ein Rohrrätsel.', 45,
      function (u) { return u.gewonnen('pipes') >= 1; }, { spiel: 'pipes' }),
    E('pipes2', '🚰', 'Klempnermeister', 'Löse 25 Rohrrätsel.', 150,
      function (u) { return u.gewonnen('pipes') >= 25; }, { spiel: 'pipes' }),

    E('slide1', '🧩', 'Sortiert', 'Löse ein Schiebepuzzle.', 45,
      function (u) { return u.gewonnen('slide') >= 1; }, { spiel: 'slide' }),
    E('slide2', '⚡', 'Flinke Finger', 'Löse 20 Schiebepuzzles.', 150,
      function (u) { return u.gewonnen('slide') >= 20; }, { spiel: 'slide' }),

    E('minesweeper1', '🚩', 'Feld geräumt', 'Gewinne eine Partie Minensucher.', 45,
      function (u) { return u.gewonnen('minesweeper') >= 1; }, { spiel: 'minesweeper' }),
    E('minesweeper2', '💣', 'Ruhige Hand', 'Gewinne 15 Partien Minensucher.', 150,
      function (u) { return u.gewonnen('minesweeper') >= 15; }, { spiel: 'minesweeper' }),

    E('memory1', '🧠', 'Gutes Gedächtnis', 'Löse eine Runde Memory.', 45,
      function (u) { return u.gewonnen('memory') >= 1; }, { spiel: 'memory' }),
    E('memory2', '🎴', 'Alles gemerkt', 'Löse 20 Runden Memory.', 150,
      function (u) { return u.gewonnen('memory') >= 20; }, { spiel: 'memory' }),

    /* ---------------------------------------------------- Karten & Brett */

    E('solitaire1', '🃏', 'Ausgelegt', 'Gewinne eine Partie Solitär.', 45,
      function (u) { return u.gewonnen('solitaire') >= 1; }, { spiel: 'solitaire' }),
    E('solitaire2', '♠', 'Geduldsspiel', 'Gewinne 15 Partien Solitär.', 150,
      function (u) { return u.gewonnen('solitaire') >= 15; }, { spiel: 'solitaire' }),

    E('chess1', '♟', 'Schachmatt', 'Gewinne eine Partie Schach.', 60,
      function (u) { return u.gewonnen('chess') >= 1; }, { spiel: 'chess' }),
    E('chess2', '♚', 'Brettmeister', 'Gewinne 10 Partien Schach.', 180,
      function (u) { return u.gewonnen('chess') >= 10; }, { spiel: 'chess' }),

    E('checkers1', '🔴', 'Erste Dame', 'Gewinne eine Partie Dame.', 50,
      function (u) { return u.gewonnen('checkers') >= 1; }, { spiel: 'checkers' }),
    E('checkers2', '⚫', 'Schlagzwang', 'Gewinne 10 Partien Dame.', 150,
      function (u) { return u.gewonnen('checkers') >= 10; }, { spiel: 'checkers' }),

    E('connect41', '🔵', 'Vier in einer Reihe', 'Gewinne eine Partie Vier gewinnt.', 45,
      function (u) { return u.gewonnen('connect4') >= 1; }, { spiel: 'connect4' }),
    E('connect42', '🟡', 'Reihenweise', 'Gewinne 15 Partien Vier gewinnt.', 150,
      function (u) { return u.gewonnen('connect4') >= 15; }, { spiel: 'connect4' }),

    E('doppelkopf1', '👑', 'Alte gewinnen', 'Gewinne eine Runde Doppelkopf.', 60,
      function (u) { return u.gewonnen('doppelkopf') >= 1; }, { spiel: 'doppelkopf' }),
    E('doppelkopf2', '🦊', 'Fuchs gefangen', 'Gewinne 10 Runden Doppelkopf.', 180,
      function (u) { return u.gewonnen('doppelkopf') >= 10; }, { spiel: 'doppelkopf' }),

    E('eins1', '🎴', 'Eins!', 'Gewinne eine Partie Eins.', 45,
      function (u) { return u.gewonnen('eins') >= 1; }, { spiel: 'eins' }),
    E('eins2', '🌈', 'Farbenspiel', 'Gewinne 15 Partien Eins.', 150,
      function (u) { return u.gewonnen('eins') >= 15; }, { spiel: 'eins' }),

    E('woertle1', '🔤', 'Erstes Wort', 'Errate ein Wort bei Wörtle.', 45,
      function (u) { return u.gewonnen('woertle') >= 1; }, { spiel: 'woertle' }),
    E('woertle2', '📖', 'Wortschatz', 'Errate 20 Wörter bei Wörtle.', 150,
      function (u) { return u.gewonnen('woertle') >= 20; }, { spiel: 'woertle' }),
  ];

  /* Erfolge der Spiele selbst haengen sich hier an - jedes Tycoon-Modul
     bringt seine eigenen mit, damit die Liste dort steht, wo die Zahlen
     herkommen. */
  F.anhaengen = function (liste) {
    for (var i = 0; i < liste.length; i++) {
      if (!F.erfolg(liste[i].id)) F.ERFOLGE.push(liste[i]);
    }
  };

  F.E = E;
})(SG);
