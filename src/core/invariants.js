/* ------------------------------------------------------------------
   Invarianten.

   Der Selbsttest merkt bisher nur, wenn ein Spiel abstuerzt oder NaN im
   Zustand landet. Die meisten echten Fehler sehen anders aus: eine
   Schlange, die zweimal auf demselben Feld liegt, ein Zaehler, der nicht
   mehr zum Brett passt, ein Schiebepuzzle, in dem eine Kachel doppelt
   vorkommt. Hier steht deshalb je Spiel, was im Zustand immer gelten
   muss - geprueft wird das nach jedem Testlauf.

   Eine Regel gibt einen Text zurueck, wenn sie verletzt ist, sonst nichts.
   ------------------------------------------------------------------ */

(function (SG) {
  var I = SG.invariants = {};

  function anzahl(arr, fn) {
    var n = 0;
    for (var i = 0; i < arr.length; i++) if (fn(arr[i], i)) n++;
    return n;
  }

  I.rules = {

    '2048': function (s) {
      var belegt = 0;
      for (var i = 0; i < s.grid.length; i++) {
        var v = s.grid[i];
        if (!v) continue;
        belegt++;
        if (v < 2 || (v & (v - 1)) !== 0) return 'Feldwert ' + v + ' ist keine Zweierpotenz';
      }
      if (belegt > 16) return 'mehr als 16 belegte Felder';
      if (s.score < 0) return 'Punktzahl negativ';
      if (!s.over && belegt === 0) return 'Brett leer, aber Spiel laeuft';
    },

    tetris: function (s) {
      var breite = s.grid[0].length;
      var y, x;
      for (y = 0; y < s.grid.length; y++) {
        if (s.grid[y].length !== breite) return 'Zeile ' + y + ' hat abweichende Breite';
      }
      if (s.score < 0 || s.lines < 0) return 'negative Punkte oder Reihen';
      if (s.level < 1) return 'Level unter 1';

      /* Eine volle Reihe darf nicht liegen bleiben. Waehrend der
         Raeumanimation ist sie erlaubt - danach nicht mehr. */
      if (!s.clearing && !s.over) {
        for (y = 0; y < s.grid.length; y++) {
          var voll = true;
          for (x = 0; x < breite; x++) if (!s.grid[y][x]) { voll = false; break; }
          if (voll) return 'volle Reihe ' + y + ' wurde nicht geraeumt';
        }
      }

      // Der fallende Stein darf nicht in bereits liegenden Steinen stecken
      if (!s.over && s.shape) {
        for (y = 0; y < s.shape.length; y++) {
          for (x = 0; x < s.shape[y].length; x++) {
            if (!s.shape[y][x]) continue;
            var gx = s.px + x, gy = s.py + y;
            if (gx < 0 || gx >= breite) return 'Stein ragt seitlich aus dem Feld';
            if (gy >= s.grid.length) return 'Stein ragt unten aus dem Feld';
            if (gy >= 0 && s.grid[gy][gx]) return 'Stein steckt in liegenden Steinen';
          }
        }
      }
      if (s.next.length < 1) return 'Vorschau ist leer';
    },

    snake: function (s) {
      var gesehen = {};
      for (var i = 0; i < s.body.length; i++) {
        var b = s.body[i];
        if (b.x < 0 || b.y < 0 || b.x >= s.w || b.y >= s.h) return 'Segment ausserhalb des Feldes';
        var k = b.x + ':' + b.y;
        // Beim Wachsen liegt der Schwanz kurz doppelt - erst ab zwei Treffern zaehlt es
        if (gesehen[k]) gesehen[k]++; else gesehen[k] = 1;
        if (gesehen[k] > 2) return 'Segment ' + k + ' liegt dreifach';
      }
      if (!s.over) {
        var kopf = s.body[0];
        for (var j = 1; j < s.body.length; j++) {
          if (s.body[j].x === kopf.x && s.body[j].y === kopf.y && s.grow <= 0) {
            return 'Kopf steckt im eigenen Koerper, Spiel laeuft aber weiter';
          }
        }
      }
      if (s.food.x < 0 || s.food.x >= s.w || s.food.y < 0 || s.food.y >= s.h) {
        return 'Futter ausserhalb des Feldes';
      }
      if (s.dir[0] === 0 && s.dir[1] === 0) return 'Richtung ist null';
    },

    minesweeper: function (s) {
      var offen = 0, flaggen = 0;
      for (var i = 0; i < s.mine.length; i++) {
        if (s.open[i]) offen++;
        if (s.flag[i]) flaggen++;
        if (s.open[i] && s.flag[i]) return 'Feld ' + i + ' ist offen und beflaggt';
        if (s.open[i] && s.mine[i] && !s.dead) return 'Mine offen, Spiel laeuft aber weiter';
      }
      if (offen !== s.opened) return 'Zaehler opened=' + s.opened + ', tatsaechlich ' + offen;
      if (flaggen !== s.flags) return 'Zaehler flags=' + s.flags + ', tatsaechlich ' + flaggen;
      var minen = anzahl(s.mine, function (v) { return !!v; });
      if (s.started && minen !== s.mines) return minen + ' Minen statt ' + s.mines;
      if (s.won && offen !== s.w * s.h - s.mines) return 'Sieg, aber nicht alles aufgedeckt';
    },

    slide: function (s) {
      var n = s.n * s.n;
      var gesehen = new Array(n);
      for (var i = 0; i < s.tiles.length; i++) {
        var v = s.tiles[i];
        if (v < 0 || v >= n) return 'Kachelwert ' + v + ' ausserhalb 0..' + (n - 1);
        if (gesehen[v]) return 'Kachel ' + v + ' kommt doppelt vor';
        gesehen[v] = true;
      }
      if (s.tiles.length !== n) return s.tiles.length + ' Kacheln statt ' + n;
      if (s.tiles[s.gap] !== 0) return 'Luecke zeigt nicht auf das leere Feld';
      if (s.moves < 0) return 'Zugzahl negativ';
    },

    memory: function (s) {
      if (s.cards.length !== s.cols * s.rows) {
        return s.cards.length + ' Karten statt ' + (s.cols * s.rows);
      }
      var proSorte = {};
      for (var i = 0; i < s.cards.length; i++) {
        var c = s.cards[i];
        proSorte[c.kind] = (proSorte[c.kind] || 0) + 1;
        if (c.done && !c.up) return 'Karte ' + i + ' ist gefunden, liegt aber verdeckt';
      }
      for (var k in proSorte) {
        if (proSorte[k] !== 2) return 'Sorte ' + k + ' kommt ' + proSorte[k] + '-mal vor';
      }
      if (s.open.length > 2) return s.open.length + ' Karten gleichzeitig offen';
      var fertig = anzahl(s.cards, function (c) { return c.done; });
      if (fertig % 2) return 'ungerade Zahl gefundener Karten';
      if (s.done && fertig !== s.cards.length) return 'als fertig gemeldet, aber Karten offen';
    },

    maze: function (s) {
      function begehbar(x, y) {
        if (y < 0 || y >= s.grid.length) return false;
        var reihe = s.grid[y];
        if (x < 0 || x >= reihe.length) return false;
        return reihe[x] !== 1;
      }
      if (!begehbar(s.pac.x, s.pac.y)) return 'Spielfigur steht in der Wand';
      for (var i = 0; i < s.ghosts.length; i++) {
        var g = s.ghosts[i];
        if (g.state !== 'heim' && !begehbar(g.x, g.y)) {
          return 'Geist ' + i + ' steht in der Wand';
        }
      }
      var punkte = 0;
      for (var y = 0; y < s.dots.length; y++) {
        for (var x = 0; x < s.dots[y].length; x++) if (s.dots[y][x]) punkte++;
      }
      if (punkte !== s.dotCount) return 'Punktzaehler ' + s.dotCount + ', tatsaechlich ' + punkte;
      if (s.lives < 0) return 'negative Leben';
    },

    solitaire: function (s) {
      var n = s.stock.length + s.waste.length;
      var i;
      for (i = 0; i < s.found.length; i++) n += s.found[i].length;
      for (i = 0; i < s.tab.length; i++) n += s.tab[i].length;
      if (s.drag && s.drag.cards) n += s.drag.cards.length;
      if (n !== 52) return n + ' Karten statt 52';
      for (i = 0; i < s.found.length; i++) {
        for (var j = 1; j < s.found[i].length; j++) {
          if (s.found[i][j].r !== s.found[i][j - 1].r + 1) return 'Ablage ' + i + ' nicht aufsteigend';
        }
      }
    },

    sudoku: function (s) {
      for (var i = 0; i < 81; i++) {
        var v = s.grid[i];
        if (v < 0 || v > 9 || v !== Math.floor(v)) return 'Zellwert ' + v + ' ungueltig';
        if (s.given[i] && v !== s.puzzle[i]) return 'Vorgabe ' + i + ' wurde ueberschrieben';
      }
      if (s.done) {
        for (i = 0; i < 81; i++) {
          if (s.grid[i] !== s.solution[i]) return 'als geloest gemeldet, Feld ' + i + ' stimmt nicht';
        }
      }
    },

    nonogram: function (s) {
      if (s.rowClues.length !== s.h) return 'Zeilenhinweise passen nicht zur Hoehe';
      if (s.colClues.length !== s.w) return 'Spaltenhinweise passen nicht zur Breite';
      for (var i = 0; i < s.cells.length; i++) {
        if (s.cells[i] > 2) return 'Zellzustand ' + s.cells[i] + ' ungueltig';
      }
      if (s.done) {
        for (i = 0; i < s.sol.length; i++) {
          if (!!s.sol[i] !== (s.cells[i] === 1)) return 'als geloest gemeldet, Feld ' + i + ' stimmt nicht';
        }
      }
    },

    woertle: function (s) {
      if (s.guesses.length !== s.states.length) return 'Rateworte und Bewertungen unterschiedlich lang';
      if (s.row !== s.guesses.length) return 'Zeile ' + s.row + ', aber ' + s.guesses.length + ' Rateworte';
      for (var i = 0; i < s.guesses.length; i++) {
        if (s.guesses[i].length !== s.len) return 'Ratewort ' + i + ' hat falsche Laenge';
        if (s.states[i].length !== s.len) return 'Bewertung ' + i + ' hat falsche Laenge';
      }
      if (s.cur.length > s.len) return 'Eingabe laenger als das Wort';
      if (s.won && s.guesses[s.guesses.length - 1] !== s.target) return 'Sieg ohne passendes Wort';
    },

    bubble: function (s) {
      // -1 ist das Leerzeichen des Rasters, Farben laufen von 0 bis 7.
      for (var y = 0; y < s.grid.length; y++) {
        var reihe = s.grid[y];
        for (var x = 0; x < reihe.length; x++) {
          var v = reihe[x];
          if (v === -1 || v === null || v === undefined) continue;
          if (v < 0 || v > 7) return 'Blasenfarbe ' + v + ' ungueltig';
          if (v >= s.colorsInPlay) {
            return 'Blase mit Farbe ' + v + ', im Spiel sind nur ' + s.colorsInPlay;
          }
        }
      }
      if (s.cur < 0 || s.cur >= s.colorsInPlay) return 'Schussfarbe ' + s.cur + ' ungueltig';
      if (s.next < 0 || s.next >= s.colorsInPlay) return 'Vorschaufarbe ' + s.next + ' ungueltig';
      if (s.score < 0) return 'Punktzahl negativ';
      if (s.pops.length > 400 || s.drops.length > 400) return 'Effektlisten laufen voll';
      // Feld leer, aber weder gewonnen noch vorbei: dann geht es nicht weiter.
      var blasen = 0;
      for (y = 0; y < s.grid.length; y++) {
        for (var x2 = 0; x2 < s.grid[y].length; x2++) if (s.grid[y][x2] >= 0) blasen++;
      }
      if (blasen === 0 && s.won <= 0 && !s.over && !s.shot) {
        return 'keine Blasen mehr, Ebene gilt aber nicht als geschafft';
      }
    },

    breakout: function (s) {
      if (s.lives < 0) return 'negative Leben';
      if (s.balls.length > 30) return s.balls.length + ' Baelle gleichzeitig';
      for (var i = 0; i < s.balls.length; i++) {
        var b = s.balls[i];
        var v = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
        if (!isFinite(v)) return 'Ballgeschwindigkeit ungueltig';
        // Ein Ball auf dem Schlaeger ruht mit Absicht, bis abgeschossen wird.
        if (!b.stuck && v < 0.01) return 'Ball steht still';
      }
      if (!s.over && !s.cleared && s.balls.length === 0 && s.lives > 0 && !s.stuck) {
        return 'kein Ball im Spiel, obwohl es weitergeht';
      }
      var offen = 0;
      for (i = 0; i < s.blocks.length; i++) {
        if (s.blocks[i].hp < 0) return 'Block mit negativer Haerte';
        if (!s.blocks[i].dead && !s.blocks[i].solid) offen++;
      }
      // Kein zerstoerbarer Block mehr da, aber die Ebene gilt nicht als
      // geschafft: dann haengt das Spiel an einer unzerstoerbaren Wand fest.
      if (offen === 0 && !s.cleared && !s.over) {
        return 'alle Bloecke weg, Ebene gilt aber nicht als geschafft';
      }
    },

    invaders: function (s) {
      if (s.lives < 0) return 'negative Leben';
      if (s.shots.length > 60 || s.bombs.length > 200) return 'Geschosslisten laufen voll';
      var lebend = anzahl(s.aliens, function (a) { return a && a.alive; });
      if (!s.over && lebend === 0 && s.wave < 1) return 'keine Gegner, aber keine neue Welle';
    },

    asteroids: function (s) {
      if (s.lives < 0) return 'negative Leben';
      if (s.rocks.length > 200) return s.rocks.length + ' Brocken';
      if (s.shots.length > 60) return 'zu viele Schuesse';
      if (!isFinite(s.ship.x) || !isFinite(s.ship.y)) return 'Schiffsposition ungueltig';
    },

    flappy: function (s) {
      if (s.pipes.length > 40) return 'Roehrenliste laeuft voll';
      if (!isFinite(s.bird.y)) return 'Vogelposition ungueltig';
      if (s.score < 0) return 'Punktzahl negativ';
    },

    jumper: function (s) {
      if (s.plats.length > 200) return 'Plattformliste laeuft voll';
      if (s.coins.length > 200) return 'Muenzliste laeuft voll';
      if (!isFinite(s.y) || !isFinite(s.x)) return 'Position ungueltig';
      if (s.score < 0) return 'Punktzahl negativ';
    },

    hop: function (s) {
      if (s.lanes.length > 200) return 'Spurenliste laeuft voll';
      if (!isFinite(s.px) || !isFinite(s.py)) return 'Position ungueltig';
      if (s.score < 0) return 'Punktzahl negativ';
    },

    stack: function (s) {
      if (s.tower.length > 400) return 'Turmliste laeuft voll';
      if (s.falling.length > 200) return 'Trueemmerliste laeuft voll';
      if (s.score < 0) return 'Punktzahl negativ';
      if (s.height < 0) return 'negative Hoehe';
    },

    pipes: function (s) {
      if (s.moves < 0) return 'Zugzahl negativ';
      if (s.mode === 'net' && s.mask && s.mask.length !== s.w * s.h) {
        return 'Netzmaske passt nicht zum Feld';
      }
    },
  };

  /* Prueft ein Spiel. Gibt null zurueck, wenn alles stimmt. */
  I.check = function (id, state) {
    var fn = I.rules[id];
    if (!fn || !state) return null;
    try {
      return fn(state) || null;
    } catch (e) {
      return 'Invariantenpruefung selbst gescheitert: ' + (e && e.message);
    }
  };
})(SG);
