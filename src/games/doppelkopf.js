/* ------------------------------------------------------------------
   Doppelkopf

   48 Karten (9, 10, Bube, Dame, König, Ass in vier Farben, jede zweimal).

   Enthalten:
     - Normalspiel mit Re/Kontra über die Kreuz-Damen
     - Hochzeit mit Klärungsstich in den ersten drei Stichen
     - Solos: Damen-, Buben-, Farb- und Fleischloses Solo
     - Vorbehaltsrunde vor dem Spiel
     - Ansagen Re/Kontra sowie keine 90 / 60 / 30 / schwarz
     - Sonderpunkte: Doppelkopf, Karlchen, Fuchs gefangen
     - Turnierliste über mehrere Runden

   Mitspieler sind KI-Gegner; online übernimmt der Host ihre Züge und
   verteilt sie über den Raum, damit alle dasselbe sehen.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var G = SG.gfx;
  var UI = SG.ui;

  /* ==================================================================
     Regel-Engine
     ================================================================== */

  var R = SG.rules.doppelkopf = {};

  var SUITS = ['c', 's', 'h', 'd'];
  var SUIT_NAME = { c: 'Kreuz', s: 'Pik', h: 'Herz', d: 'Karo' };
  var SUIT_CH = { c: '♣', s: '♠', h: '♥', d: '♦' };
  var RANKS = ['9', 'K', 'B', 'D', 'T', 'A'];        // T = Zehn
  var RANK_TXT = { '9': '9', K: 'K', B: 'B', D: 'D', T: '10', A: 'A' };
  var VALUE = { '9': 0, K: 4, B: 2, D: 3, T: 10, A: 11 };

  R.SUITS = SUITS;
  R.SUIT_CH = SUIT_CH;
  R.RANK_TXT = RANK_TXT;
  R.VALUE = VALUE;

  R.deck = function () {
    var out = [];
    var id = 0;
    for (var k = 0; k < 2; k++) {
      for (var s = 0; s < 4; s++) {
        for (var r = 0; r < RANKS.length; r++) {
          out.push({ s: SUITS[s], r: RANKS[r], id: id++ });
        }
      }
    }
    return out;
  };

  /* Spielarten */
  R.GAMES = {
    normal: { name: 'Normalspiel', solo: false },
    hochzeit: { name: 'Hochzeit', solo: false },
    damen: { name: 'Damen-Solo', solo: true },
    buben: { name: 'Buben-Solo', solo: true },
    fleischlos: { name: 'Fleischloses Solo', solo: true },
    soloC: { name: 'Kreuz-Solo', solo: true, suit: 'c' },
    soloS: { name: 'Pik-Solo', solo: true, suit: 's' },
    soloH: { name: 'Herz-Solo', solo: true, suit: 'h' },
    soloD: { name: 'Karo-Solo', solo: true, suit: 'd' },
  };

  /* Trumpfrang: hoeher ist staerker, -1 bedeutet Fehlfarbe */
  R.trumpRank = function (card, game) {
    var g = R.GAMES[game] || R.GAMES.normal;

    if (game === 'fleischlos') return -1;

    if (game === 'damen') return card.r === 'D' ? 90 - SUITS.indexOf(card.s) : -1;
    if (game === 'buben') return card.r === 'B' ? 80 - SUITS.indexOf(card.s) : -1;

    // Normalspiel, Hochzeit und Farbsoli
    if (card.s === 'h' && card.r === 'T') return 100;
    if (card.r === 'D') return 90 - SUITS.indexOf(card.s);
    if (card.r === 'B') return 80 - SUITS.indexOf(card.s);

    var trumpSuit = g.suit || 'd';
    if (card.s === trumpSuit) {
      return { A: 70, T: 69, K: 68, '9': 67 }[card.r];
    }
    return -1;
  };

  R.isTrump = function (card, game) { return R.trumpRank(card, game) >= 0; };

  /* Farbklasse: 'T' fuer Trumpf, sonst die Kartenfarbe */
  R.classOf = function (card, game) {
    return R.isTrump(card, game) ? 'T' : card.s;
  };

  /* Rang innerhalb einer Fehlfarbe */
  R.suitRank = function (card) {
    return { A: 6, T: 5, K: 4, D: 3, B: 2, '9': 1 }[card.r];
  };

  /* Vergleich zweier Karten derselben Klasse */
  R.stronger = function (a, b, game) {
    var ta = R.trumpRank(a, game), tb = R.trumpRank(b, game);
    if (ta >= 0 && tb >= 0) return ta > tb;
    if (ta >= 0) return true;
    if (tb >= 0) return false;
    if (a.s !== b.s) return false;             // andere Fehlfarbe sticht nicht
    return R.suitRank(a) > R.suitRank(b);
  };

  /* Gewinner eines vollen Stichs. Bei gleichen Karten gewinnt die erste. */
  R.trickWinner = function (trick, game) {
    var best = 0;
    for (var i = 1; i < trick.length; i++) {
      var c = trick[i].card, b = trick[best].card;
      var cls = R.classOf(trick[0].card, game);
      var cCls = R.classOf(c, game);
      if (cCls !== cls && cCls !== 'T') continue;      // bedient nicht und ist kein Trumpf
      if (cls !== 'T' && cCls === 'T') { best = i; continue; }
      if (cCls !== cls) continue;
      if (R.stronger(c, b, game)) best = i;
    }
    return best;
  };

  R.trickValue = function (trick) {
    var v = 0;
    for (var i = 0; i < trick.length; i++) v += VALUE[trick[i].card.r];
    return v;
  };

  /* Erlaubte Karten: Farbzwang */
  R.legal = function (hand, trick, game) {
    if (!trick.length) return hand.slice();
    var lead = R.classOf(trick[0].card, game);
    var follow = hand.filter(function (c) { return R.classOf(c, game) === lead; });
    return follow.length ? follow : hand.slice();
  };

  R.hasClubQueen = function (hand) {
    for (var i = 0; i < hand.length; i++) {
      if (hand[i].s === 'c' && hand[i].r === 'D') return true;
    }
    return false;
  };

  R.countClubQueens = function (hand) {
    var n = 0;
    for (var i = 0; i < hand.length; i++) {
      if (hand[i].s === 'c' && hand[i].r === 'D') n++;
    }
    return n;
  };

  /* Sortierung fuer die Hand: erst Trumpf absteigend, dann Farben */
  R.sortHand = function (hand, game) {
    return hand.slice().sort(function (a, b) {
      var ta = R.trumpRank(a, game), tb = R.trumpRank(b, game);
      if (ta >= 0 && tb < 0) return -1;
      if (tb >= 0 && ta < 0) return 1;
      if (ta >= 0) return tb - ta;
      if (a.s !== b.s) return SUITS.indexOf(a.s) - SUITS.indexOf(b.s);
      return R.suitRank(b) - R.suitRank(a);
    });
  };

  /* ------------------------------------------------------------------
     Abrechnung
     ------------------------------------------------------------------ */

  /* o = { rePoints, kontraPoints, reTricks, kontraTricks, reAnn, kontraAnn,
          reLevel, kontraLevel, solo, extras:{re:n, kontra:n} } */
  R.settle = function (o) {
    var reNeed = 121 + (o.reLevel > 0 ? 30 * o.reLevel : 0);
    var kontraNeed = 120 + (o.kontraLevel > 0 ? 30 * o.kontraLevel : 0);
    if (o.reLevel >= 4) reNeed = 240;
    if (o.kontraLevel >= 4) kontraNeed = 240;

    var reOk = o.rePoints >= reNeed && (o.reLevel < 4 || o.kontraTricks === 0);
    var kontraOk = o.kontraPoints >= kontraNeed && (o.kontraLevel < 4 || o.reTricks === 0);

    var winner;
    if (reOk && !kontraOk) winner = 're';
    else if (kontraOk && !reOk) winner = 'kontra';
    else if (!reOk && !kontraOk) {
      // Beide haben ihr Ziel verfehlt: wer hoeher angesagt hat, verliert.
      // (Ohne Ansagen kann dieser Fall gar nicht eintreten - 240 Augen
      //  werden immer verteilt.)
      var reLvl = (o.reAnn ? 1 : 0) + o.reLevel;
      var koLvl = (o.kontraAnn ? 1 : 0) + o.kontraLevel;
      if (reLvl !== koLvl) winner = reLvl > koLvl ? 'kontra' : 're';
      else winner = o.rePoints > o.kontraPoints ? 're' : 'kontra';
    } else {
      winner = o.rePoints >= reNeed ? 're' : 'kontra';
    }

    var loserPoints = winner === 're' ? o.kontraPoints : o.rePoints;
    var loserTricks = winner === 're' ? o.kontraTricks : o.reTricks;

    var lines = [];
    var value = 1;
    lines.push({ t: 'Gewonnen', p: 1 });
    if (loserPoints < 90) { value++; lines.push({ t: 'Keine 90', p: 1 }); }
    if (loserPoints < 60) { value++; lines.push({ t: 'Keine 60', p: 1 }); }
    if (loserPoints < 30) { value++; lines.push({ t: 'Keine 30', p: 1 }); }
    if (loserTricks === 0) { value++; lines.push({ t: 'Schwarz', p: 1 }); }
    if (winner === 'kontra' && !o.solo) { value++; lines.push({ t: 'Gegen die Alten', p: 1 }); }
    if (o.reAnn) { value += 2; lines.push({ t: 'Ansage Re', p: 2 }); }
    if (o.kontraAnn) { value += 2; lines.push({ t: 'Ansage Kontra', p: 2 }); }
    if (o.reLevel > 0) {
      value += o.reLevel;
      lines.push({ t: 'Re-Ansagen (' + o.reLevel + ')', p: o.reLevel });
    }
    if (o.kontraLevel > 0) {
      value += o.kontraLevel;
      lines.push({ t: 'Kontra-Ansagen (' + o.kontraLevel + ')', p: o.kontraLevel });
    }

    var extraRe = (o.extras && o.extras.re) || 0;
    var extraKontra = (o.extras && o.extras.kontra) || 0;
    var netExtra = winner === 're' ? extraRe - extraKontra : extraKontra - extraRe;
    if (extraRe || extraKontra) {
      lines.push({ t: 'Sonderpunkte', p: netExtra });
    }
    value += netExtra;
    if (value < 1) value = 1;

    return {
      winner: winner, value: value, lines: lines,
      reNeed: reNeed, kontraNeed: kontraNeed,
      loserPoints: loserPoints,
    };
  };

  /* ==================================================================
     Spielzustand
     ================================================================== */

  R.newRound = function (seed, dealer) {
    var rng = U.rng(seed >>> 0);
    var deck = rng.shuffle(R.deck());
    var hands = [[], [], [], []];
    for (var i = 0; i < 48; i++) hands[i % 4].push(deck[i]);
    return {
      seed: seed,
      dealer: dealer || 0,
      hands: hands,
      game: 'normal',
      soloist: -1,
      party: [0, 0, 0, 0],       // 1 = Re, 2 = Kontra
      partyKnown: [false, false, false, false],
      marriage: -1,
      marriageOpen: false,
      phase: 'vorbehalt',        // vorbehalt | spiel | ende
      vorbehalt: [],             // Antworten der Spieler
      asking: 0,
      turn: 0,
      lead: 0,
      trick: [],
      tricks: [],                // {cards:[{seat,card}], winner, value}
      won: [[], [], [], []],     // gewonnene Stiche je Spieler
      points: [0, 0, 0, 0],
      ann: { re: false, kontra: false, reLevel: 0, kontraLevel: 0 },
      annBy: [],
      extras: { re: 0, kontra: 0 },
      log: [],
    };
  };

  R.assignParties = function (g) {
    if (g.game === 'normal') {
      for (var i = 0; i < 4; i++) {
        g.party[i] = R.hasClubQueen(g.hands[i]) ? 1 : 2;
      }
      // Hat jemand beide Kreuz-Damen, ist es eine Hochzeit
      for (i = 0; i < 4; i++) {
        if (R.countClubQueens(g.hands[i]) === 2) {
          g.game = 'hochzeit';
          g.marriage = i;
          g.marriageOpen = true;
          for (var k = 0; k < 4; k++) g.party[k] = k === i ? 1 : 2;
          break;
        }
      }
    } else if (R.GAMES[g.game].solo) {
      for (i = 0; i < 4; i++) g.party[i] = i === g.soloist ? 1 : 2;
    }
  };

  /* Klaerungsstich der Hochzeit */
  R.clarifyMarriage = function (g, winnerSeat, trickIndex) {
    if (!g.marriageOpen) return;
    if (trickIndex >= 3) {
      g.marriageOpen = false;
      // Ohne Klaerung wird die Hochzeit zum Solo
      for (var i = 0; i < 4; i++) g.party[i] = i === g.marriage ? 1 : 2;
      g.log.push('Hochzeit ungeklärt — der Alleinspieler spielt allein.');
      return;
    }
    if (winnerSeat === g.marriage) return;
    g.party[winnerSeat] = 1;
    g.marriageOpen = false;
    g.log.push('Hochzeit geklärt: Platz ' + (winnerSeat + 1) + ' gehört zu Re.');
  };

  R.play = function (g, seat, card) {
    if (g.phase !== 'spiel') return false;
    if (g.turn !== seat) return false;
    var hand = g.hands[seat];
    var idx = -1;
    for (var i = 0; i < hand.length; i++) {
      if (hand[i].id === card.id) { idx = i; break; }
    }
    if (idx < 0) return false;
    var legal = R.legal(hand, g.trick, g.game);
    var ok = false;
    for (i = 0; i < legal.length; i++) if (legal[i].id === card.id) ok = true;
    if (!ok) return false;

    hand.splice(idx, 1);
    g.trick.push({ seat: seat, card: card });

    if (g.trick.length < 4) {
      g.turn = (seat + 1) % 4;
      return true;
    }

    // Stich auswerten
    var wi = R.trickWinner(g.trick, g.game);
    var winner = g.trick[wi].seat;
    var value = R.trickValue(g.trick);
    var rec = { cards: g.trick.slice(), winner: winner, value: value };
    g.tricks.push(rec);
    g.won[winner].push(rec);
    g.points[winner] += value;

    // Sonderpunkte
    var side = function (s) { return g.party[s] === 1 ? 're' : 'kontra'; };
    if (value >= 40) {
      g.extras[side(winner)]++;
      g.log.push('Doppelkopf für ' + (side(winner) === 're' ? 'Re' : 'Kontra') + ' (' + value + ' Augen).');
    }
    for (i = 0; i < g.trick.length; i++) {
      var t = g.trick[i];
      if (t.card.s === 'd' && t.card.r === 'A' && g.party[t.seat] !== g.party[winner]) {
        g.extras[side(winner)]++;
        g.log.push('Fuchs gefangen.');
      }
    }
    if (g.tricks.length === 12) {
      var last = g.trick[wi].card;
      if (last.s === 'c' && last.r === 'B') {
        g.extras[side(winner)]++;
        g.log.push('Karlchen macht den letzten Stich.');
      }
    }

    R.clarifyMarriage(g, winner, g.tricks.length - 1);

    g.trick = [];
    g.lead = winner;
    g.turn = winner;

    if (g.tricks.length === 12) {
      g.phase = 'ende';
      g.result = R.finish(g);
    }
    return true;
  };

  R.finish = function (g) {
    var rePoints = 0, kontraPoints = 0, reTricks = 0, kontraTricks = 0;
    for (var i = 0; i < 4; i++) {
      if (g.party[i] === 1) { rePoints += g.points[i]; reTricks += g.won[i].length; }
      else { kontraPoints += g.points[i]; kontraTricks += g.won[i].length; }
    }
    var res = R.settle({
      rePoints: rePoints, kontraPoints: kontraPoints,
      reTricks: reTricks, kontraTricks: kontraTricks,
      reAnn: g.ann.re, kontraAnn: g.ann.kontra,
      reLevel: g.ann.reLevel, kontraLevel: g.ann.kontraLevel,
      solo: R.GAMES[g.game].solo || g.game === 'hochzeit' && !hasPartner(g),
      extras: g.extras,
    });
    res.rePoints = rePoints;
    res.kontraPoints = kontraPoints;
    res.reTricks = reTricks;
    res.kontraTricks = kontraTricks;

    // Punkte je Spieler
    var reCount = 0;
    for (i = 0; i < 4; i++) if (g.party[i] === 1) reCount++;
    res.perSeat = [0, 0, 0, 0];
    for (i = 0; i < 4; i++) {
      var isRe = g.party[i] === 1;
      var won = (res.winner === 're') === isRe;
      var mult = (isRe && reCount === 1) || (!isRe && reCount === 3) ? 3 : 1;
      res.perSeat[i] = (won ? 1 : -1) * res.value * mult;
    }
    return res;
  };

  function hasPartner(g) {
    var n = 0;
    for (var i = 0; i < 4; i++) if (g.party[i] === 1) n++;
    return n > 1;
  }

  /* Bis wann darf angesagt werden? Karten, die der Spieler schon gelegt hat. */
  R.playedCount = function (g, seat) {
    var n = 0;
    for (var i = 0; i < g.tricks.length; i++) {
      for (var k = 0; k < g.tricks[i].cards.length; k++) {
        if (g.tricks[i].cards[k].seat === seat) n++;
      }
    }
    for (i = 0; i < g.trick.length; i++) if (g.trick[i].seat === seat) n++;
    return n;
  };

  /* level 0 = Re/Kontra, 1 = keine 90, 2 = keine 60, 3 = keine 30, 4 = schwarz */
  R.canAnnounce = function (g, seat, level) {
    if (g.phase !== 'spiel') return false;
    var isRe = g.party[seat] === 1;
    var cur = isRe ? (g.ann.re ? g.ann.reLevel + 1 : 0) : (g.ann.kontra ? g.ann.kontraLevel + 1 : 0);
    if (level !== cur) return false;
    return R.playedCount(g, seat) <= level + 1;
  };

  R.announce = function (g, seat, level) {
    if (!R.canAnnounce(g, seat, level)) return false;
    var isRe = g.party[seat] === 1;
    if (level === 0) {
      if (isRe) g.ann.re = true; else g.ann.kontra = true;
    } else {
      if (isRe) g.ann.reLevel = level; else g.ann.kontraLevel = level;
    }
    g.partyKnown[seat] = true;
    g.annBy.push({ seat: seat, level: level, isRe: isRe });
    g.log.push((isRe ? 'Re' : 'Kontra') +
      (level ? ' · ' + ['', 'keine 90', 'keine 60', 'keine 30', 'schwarz'][level] : '') +
      ' von Platz ' + (seat + 1));
    return true;
  };

  /* ------------------------------------------------------------------
     Mitspieler-Logik
     ------------------------------------------------------------------ */

  /* Bewertet ein Blatt, um ueber Vorbehalt und Ansagen zu entscheiden */
  R.handStrength = function (hand, game) {
    var s = 0;
    for (var i = 0; i < hand.length; i++) {
      var t = R.trumpRank(hand[i], game);
      if (t >= 90) s += 4;
      else if (t >= 77) s += 2.2;
      else if (t >= 0) s += 0.9;
      if (hand[i].r === 'A') s += 1.1;
      if (hand[i].r === 'T') s += 0.5;
    }
    return s;
  };

  R.chooseVorbehalt = function (hand, rng) {
    // Sehr trumpfarm oder extrem trumpfstark -> Solo lohnt sich
    var trumps = hand.filter(function (c) { return R.isTrump(c, 'normal'); }).length;
    var damen = hand.filter(function (c) { return c.r === 'D'; }).length;
    var buben = hand.filter(function (c) { return c.r === 'B'; }).length;
    if (damen >= 5) return 'damen';
    if (buben >= 5) return 'buben';
    for (var i = 0; i < 4; i++) {
      var s = SUITS[i];
      var n = hand.filter(function (c) {
        return c.s === s || c.r === 'D' || c.r === 'B' || (c.s === 'h' && c.r === 'T');
      }).length;
      var high = hand.filter(function (c) { return c.r === 'D' || c.r === 'B'; }).length;
      if (n >= 11 && high >= 5) return 'solo' + s.toUpperCase();
    }
    if (trumps <= 2) return 'fleischlos';
    return null;
  };

  /* Waehlt eine Karte fuer einen KI-Platz. Deterministisch ueber rng. */
  R.aiCard = function (g, seat, rng) {
    var hand = g.hands[seat];
    var legal = R.legal(hand, g.trick, g.game);
    if (legal.length === 1) return legal[0];

    var trick = g.trick;
    var myParty = g.party[seat];

    // Wer fuehrt den Stich gerade an?
    var leaderIdx = trick.length ? R.trickWinner(trick, g.game) : -1;
    var leaderSeat = leaderIdx >= 0 ? trick[leaderIdx].seat : -1;
    var partnerLeads = leaderSeat >= 0 && g.party[leaderSeat] === myParty && leaderSeat !== seat;
    var trickPts = R.trickValue(trick);

    function val(c) { return VALUE[c.r]; }
    function beats(c) {
      if (leaderIdx < 0) return true;
      var lead = R.classOf(trick[0].card, g.game);
      var cCls = R.classOf(c, g.game);
      if (lead !== 'T' && cCls === 'T') return true;
      if (cCls !== lead) return false;
      return R.stronger(c, trick[leaderIdx].card, g.game);
    }

    var winners = legal.filter(beats);
    var losers = legal.filter(function (c) { return !beats(c); });

    // Anspiel
    if (!trick.length) {
      // Mit hohem Trumpf ziehen, wenn genug davon da ist
      var trumps = legal.filter(function (c) { return R.isTrump(c, g.game); });
      var high = trumps.filter(function (c) { return R.trumpRank(c, g.game) >= 88; });
      if (high.length && rng() < 0.7) {
        return U.maxBy(high, function (c) { return R.trumpRank(c, g.game); });
      }
      // Sonst ein Ass einer kurzen Fehlfarbe
      var aces = legal.filter(function (c) { return c.r === 'A' && !R.isTrump(c, g.game); });
      if (aces.length) {
        return U.minBy(aces, function (c) {
          return legal.filter(function (d) { return d.s === c.s; }).length;
        });
      }
      return U.minBy(legal, function (c) { return val(c) + R.suitRank(c) * 0.1; });
    }

    // Partner fuehrt: Punkte draufgeben, wenn er sicher steht
    if (partnerLeads) {
      var lastToPlay = trick.length === 3;
      if (lastToPlay || trickPts >= 10) {
        var fat = losers.length ? losers : legal;
        return U.maxBy(fat, function (c) { return val(c) - (R.isTrump(c, g.game) ? 3 : 0); });
      }
      return U.minBy(legal, function (c) { return val(c); });
    }

    // Gegner fuehrt: lohnt sich das Stechen?
    if (winners.length) {
      var worth = trickPts >= 10 || trick.length === 3 || rng() < 0.35;
      if (worth) {
        // Mit der kleinsten ausreichenden Karte stechen
        return U.minBy(winners, function (c) {
          var t = R.trumpRank(c, g.game);
          return (t >= 0 ? t : R.suitRank(c)) + val(c) * 0.15;
        });
      }
    }
    // Sonst billig abwerfen
    var pool = losers.length ? losers : legal;
    return U.minBy(pool, function (c) {
      return val(c) * 2 + (R.isTrump(c, g.game) ? 8 : 0) + R.suitRank(c) * 0.2;
    });
  };

  R.aiAnnounce = function (g, seat, rng) {
    var hand = g.hands[seat];
    var isRe = g.party[seat] === 1;
    var cur = isRe ? (g.ann.re ? g.ann.reLevel + 1 : 0) : (g.ann.kontra ? g.ann.kontraLevel + 1 : 0);
    if (!R.canAnnounce(g, seat, cur)) return -1;
    var s = R.handStrength(hand, g.game);
    var need = [16, 21, 25, 29, 34][cur];
    if (s >= need && rng() < 0.6) return cur;
    return -1;
  };

  /* ==================================================================
     Spiel (Oberflaeche)
     ================================================================== */

  var LEVEL_NAMES = ['Re/Kontra', 'keine 90', 'keine 60', 'keine 30', 'schwarz'];

  function mount(host) {
    var store = host.store;

    var st = {
      g: null,
      mode: 'ai',
      mySeat: 0,
      names: ['Du', 'Anna', 'Bert', 'Clara'],
      table: store.get('table', [0, 0, 0, 0]),
      rounds: store.get('rounds', 0),
      dealer: store.get('dealer', 0),
      sel: -1,
      anim: null,
      busy: false,
      hint: '',
    };
    var room = null, pill = null;
    var timer = null;

    var stage = host.canvas({ alpha: false });
    var ctx = stage.ctx;

    var sPhase = host.stat('Spiel', '—', 'gold');
    var sParty = host.stat('Partei', '—');
    var sPoints = host.stat('Augen', '0');
    var sRound = host.stat('Runde', '0');

    var annBtn = host.tool('Ansage', function () { showAnnounce(); });
    host.tool('📋', function () { showTable(); });
    host.menuTool([
      { icon: '🎮', label: 'Modus wechseln', onClick: chooseMode },
      { icon: '🃏', label: 'Neue Runde', onClick: function () { newRound(); } },
      { icon: '🧾', label: 'Letzter Stich', onClick: showLastTrick },
      { icon: '📊', label: 'Turnierliste', onClick: showTable },
      { icon: '↺', label: 'Liste zurücksetzen', onClick: resetTable },
      { icon: '?', label: 'Anleitung', onClick: function () { help(true); } },
    ]);

    /* ---------------------------------------------------------- Runde */

    function newRound(seed) {
      if (timer) { clearTimeout(timer); timer = null; }
      var s = seed !== undefined ? seed : ((Date.now() ^ (Math.random() * 1e9)) >>> 0);
      st.g = R.newRound(s, st.dealer);
      st.sel = -1;
      st.anim = null;
      st.busy = false;
      host.closeOverlay();
      startVorbehalt();
      syncBar();
    }

    function startVorbehalt() {
      var g = st.g;
      g.phase = 'vorbehalt';
      g.vorbehalt = [];
      g.asking = (g.dealer + 1) % 4;
      askNext();
    }

    function askNext() {
      var g = st.g;
      if (g.vorbehalt.length >= 4) { resolveVorbehalt(); return; }
      var seat = (g.dealer + 1 + g.vorbehalt.length) % 4;
      g.asking = seat;

      if (isHuman(seat)) {
        st.hint = 'Gesund oder Vorbehalt?';
        showVorbehaltDialog(seat);
        return;
      }
      // KI entscheidet
      timer = host.after(function () {
        var rng = U.rng((g.seed + seat * 7919) >>> 0);
        var choice = R.chooseVorbehalt(g.hands[seat], rng);
        if (choice && rng() < 0.75) g.vorbehalt.push({ seat: seat, choice: choice });
        else g.vorbehalt.push({ seat: seat, choice: null });
        askNext();
      }, 320);
    }

    function showVorbehaltDialog(seat) {
      var g = st.g;
      var body = UI.el('div');
      var options = [{ id: null, name: 'Gesund', desc: 'Normalspiel — Kreuz-Damen bilden Re.' }];
      var suggest = R.chooseVorbehalt(g.hands[seat], U.rng(g.seed));
      Object.keys(R.GAMES).forEach(function (k) {
        if (k === 'normal' || k === 'hochzeit') return;
        options.push({
          id: k, name: R.GAMES[k].name,
          desc: k === 'damen' ? 'Nur die vier Damen sind Trumpf.'
            : k === 'buben' ? 'Nur die vier Buben sind Trumpf.'
              : k === 'fleischlos' ? 'Gar kein Trumpf — nur Farben.'
                : 'Trumpf: ' + SUIT_NAME[R.GAMES[k].suit] + ' plus Damen, Buben und Herz-Zehn.',
        });
      });
      options.forEach(function (o) {
        body.appendChild(UI.el('div.item.tap' + (o.id === suggest ? '.sel' : ''), {
          on: {
            click: function () {
              m.close();
              g.vorbehalt.push({ seat: seat, choice: o.id });
              askNext();
            },
          },
        }, [
          UI.el('div.thumb', { text: o.id ? '★' : '✓' }),
          UI.el('div.main', null, [
            UI.el('div.t', { text: o.name }),
            UI.el('div.d', { text: o.desc }),
          ]),
        ]));
      });
      var m = host.modal({
        title: 'Vorbehalt?', body: body, closable: false,
      });
    }

    function resolveVorbehalt() {
      var g = st.g;
      var chosen = null;
      for (var i = 0; i < g.vorbehalt.length; i++) {
        if (g.vorbehalt[i].choice) { chosen = g.vorbehalt[i]; break; }
      }
      if (chosen) {
        g.game = chosen.choice;
        g.soloist = chosen.seat;
        g.log.push(R.GAMES[g.game].name + ' von Platz ' + (chosen.seat + 1));
      } else {
        g.game = 'normal';
      }
      R.assignParties(g);
      g.phase = 'spiel';
      g.turn = (g.dealer + 1) % 4;
      g.lead = g.turn;
      syncBar();
      step();
    }

    function isHuman(seat) {
      if (st.mode === 'online') {
        return room && seat < room.players.length;
      }
      return seat === st.mySeat;
    }

    function controlledLocally(seat) {
      if (st.mode !== 'online') return true;          // KI laeuft lokal
      return room && room.isHost;                     // online rechnet nur der Host
    }

    /* ---------------------------------------------------------- Ablauf */

    function step() {
      var g = st.g;
      if (!g || g.phase !== 'spiel') return;
      if (st.anim) return;
      if (isHuman(g.turn)) {
        st.hint = 'Du bist am Zug';
        return;
      }
      if (!controlledLocally(g.turn)) return;

      st.busy = true;
      timer = host.after(function () {
        st.busy = false;
        var seat = g.turn;
        var rng = U.rng((g.seed + g.tricks.length * 131 + seat * 17 + g.trick.length) >>> 0);

        // Ansage pruefen
        var lvl = R.aiAnnounce(g, seat, rng);
        if (lvl >= 0) {
          doAnnounce(seat, lvl);
        }

        var card = R.aiCard(g, seat, rng);
        doPlay(seat, card);
      }, 420 + Math.random() * 380);
    }

    function doPlay(seat, card, fromNet) {
      if (!fromNet && st.mode === 'online') {
        // Menschen duerfen nur fuer sich selbst legen; die Zuege der
        // Computermitspieler verteilt der Host.
        if (isHuman(seat) && seat !== st.mySeat) return;
        // Erst legen, dann melden - sonst liegt die Karte erst nach der
        // Netzrunde auf dem Tisch.
        room.send({ t: 'p', seat: seat, id: card.id });
      }
      applyPlay(seat, card);
    }

    function applyPlay(seat, card) {
      var g = st.g;
      var before = g.trick.length;
      if (!R.play(g, seat, card)) { host.sfx('error'); return; }
      host.sfx('card');
      st.sel = -1;
      syncBar();

      if (g.trick.length === 0 && before === 3) {
        // Stich ist voll und wurde ausgewertet
        var rec = g.tricks[g.tricks.length - 1];
        st.anim = { kind: 'trick', t: 0, rec: rec };
        host.sfx('clear');
        return;
      }
      step();
    }

    function doAnnounce(seat, level) {
      var g = st.g;
      if (st.mode === 'online' && isHuman(seat) && seat !== st.mySeat) return;
      if (st.mode === 'online') room.send({ t: 'a', seat: seat, lvl: level });
      applyAnnounce(seat, level);
    }

    function applyAnnounce(seat, level) {
      if (R.announce(st.g, seat, level)) {
        host.sfx('alert');
        UI.toast((st.g.party[seat] === 1 ? 'Re' : 'Kontra') +
          (level ? ' · ' + LEVEL_NAMES[level] : '') + ' — ' + st.names[seat], null, 2000);
        syncBar();
      }
    }

    function finishTrick() {
      var g = st.g;
      st.anim = null;
      if (g.phase === 'ende') { showResult(); return; }
      step();
    }

    function showResult() {
      var g = st.g;
      var res = g.result;
      for (var i = 0; i < 4; i++) st.table[i] += res.perSeat[i];
      st.rounds++;
      st.dealer = (st.dealer + 1) % 4;
      store.set('table', st.table);
      store.set('rounds', st.rounds);
      store.set('dealer', st.dealer);
      syncBar();

      var iWon = res.perSeat[st.mySeat] > 0;
      if (iWon) host.stats('siege', 1);

      var body = UI.el('div');
      body.appendChild(UI.el('div.small.muted', {
        text: R.GAMES[g.game].name + (g.soloist >= 0 ? ' von ' + st.names[g.soloist] : ''),
      }));
      body.appendChild(UI.kv([
        ['Re', res.rePoints + ' Augen' + (res.reNeed > 121 ? ' (braucht ' + res.reNeed + ')' : ''),
          res.winner === 're' ? 'g' : ''],
        ['Kontra', res.kontraPoints + ' Augen' + (res.kontraNeed > 120 ? ' (braucht ' + res.kontraNeed + ')' : ''),
          res.winner === 'kontra' ? 'g' : ''],
      ]));
      body.appendChild(UI.el('div.sec-head', null, [UI.el('h2', { text: 'Punkte' })]));
      res.lines.forEach(function (l) {
        body.appendChild(UI.el('div.row', { style: { justifyContent: 'space-between', fontSize: '13px' } }, [
          UI.el('span', { text: l.t }),
          UI.el('span.num', { text: (l.p > 0 ? '+' : '') + l.p }),
        ]));
      });
      body.appendChild(UI.el('div.sec-head', null, [UI.el('h2', { text: 'Spieler' })]));
      for (i = 0; i < 4; i++) {
        body.appendChild(UI.el('div.row', {
          style: { justifyContent: 'space-between', fontSize: '13.5px', padding: '3px 0' },
        }, [
          UI.el('span', {
            text: st.names[i] + (g.party[i] === 1 ? '  (Re)' : '  (Kontra)'),
            style: { color: i === st.mySeat ? 'var(--gold)' : '' },
          }),
          UI.el('span.num', {
            text: (res.perSeat[i] > 0 ? '+' : '') + res.perSeat[i] + '   →  ' + st.table[i],
            style: { color: res.perSeat[i] > 0 ? 'var(--green)' : 'var(--red)' },
          }),
        ]));
      }
      if (g.log.length) {
        body.appendChild(UI.el('div.sec-head', null, [UI.el('h2', { text: 'Verlauf' })]));
        var box = UI.el('div.logbox');
        g.log.forEach(function (l) {
          box.appendChild(UI.el('div.logline', null, [UI.el('div', { text: l })]));
        });
        body.appendChild(box);
      }

      host.gameOver({
        won: iWon,
        title: res.winner === 're' ? 'Re gewinnt' : 'Kontra gewinnt',
        sub: 'Spielwert ' + res.value,
        extra: body,
        againLabel: 'Nächste Runde',
        onAgain: function () { newRound(); },
        submit: false,
      });
    }

    /* ---------------------------------------------------------- Anzeige */

    function syncBar() {
      var g = st.g;
      if (!g) return;
      sPhase.set(g.phase === 'vorbehalt' ? 'Vorbehalt' : R.GAMES[g.game].name);
      var party = g.party[st.mySeat];
      var known = g.game === 'normal' || g.partyKnown[st.mySeat] || R.GAMES[g.game].solo || g.marriage >= 0;
      sParty.set(g.phase === 'vorbehalt' ? '—' : (party === 1 ? 'Re' : 'Kontra'));
      var mine = 0;
      for (var i = 0; i < 4; i++) if (g.party[i] === g.party[st.mySeat]) mine += g.points[i];
      sPoints.set(U.num(mine));
      sRound.set(U.num(st.rounds));

      var canAnn = false;
      for (var l = 0; l <= 4; l++) if (R.canAnnounce(g, st.mySeat, l)) canAnn = true;
      annBtn.classList.toggle('off', !canAnn);
    }

    function showAnnounce() {
      var g = st.g;
      var body = UI.el('div');
      var any = false;
      for (var l = 0; l <= 4; l++) {
        if (!R.canAnnounce(g, st.mySeat, l)) continue;
        any = true;
        (function (level) {
          body.appendChild(UI.el('div.item.tap', {
            on: {
              click: function () {
                m.close();
                doAnnounce(st.mySeat, level);
              },
            },
          }, [
            UI.el('div.thumb', { text: level === 0 ? (g.party[st.mySeat] === 1 ? 'Re' : 'Ko') : String(90 - (level - 1) * 30) }),
            UI.el('div.main', null, [
              UI.el('div.t', {
                text: level === 0 ? (g.party[st.mySeat] === 1 ? 'Re ansagen' : 'Kontra ansagen')
                  : LEVEL_NAMES[level] + ' ansagen',
              }),
              UI.el('div.d', {
                text: level === 0 ? 'Zeigt deine Partei und verdoppelt den Einsatz.'
                  : 'Du sagst zu, dass die Gegner unter ' +
                  [0, 90, 60, 30][level] + ' Augen bleiben.',
              }),
            ]),
          ]));
        })(l);
      }
      if (!any) {
        body.appendChild(UI.el('p.small.muted', {
          text: 'Gerade ist keine Ansage möglich. Re und Kontra gehen nur, solange du höchstens eine Karte gespielt hast; jede weitere Stufe eine Karte später.',
        }));
      }
      var m = host.modal({ title: 'Ansage', body: body });
    }

    function showTable() {
      var body = UI.el('div');
      var rows = [];
      for (var i = 0; i < 4; i++) {
        rows.push(UI.el('tr' + (i === st.mySeat ? '.hi' : ''), null, [
          UI.el('td', { text: st.names[i] }),
          UI.el('td.num', {
            text: (st.table[i] > 0 ? '+' : '') + st.table[i],
            style: { color: st.table[i] > 0 ? 'var(--green)' : st.table[i] < 0 ? 'var(--red)' : '' },
          }),
        ]));
      }
      var tbl = UI.el('table.tbl', null, [
        UI.el('thead', null, [UI.el('tr', null, [
          UI.el('th', { text: 'Spieler' }), UI.el('th.num', { text: 'Punkte' }),
        ])]),
        UI.el('tbody', null, rows),
      ]);
      body.appendChild(tbl);
      body.appendChild(UI.el('p.small.muted', {
        text: st.rounds + ' ' + U.plural(st.rounds, 'Runde', 'Runden') + ' gespielt.',
        style: { marginTop: '10px' },
      }));
      host.modal({ title: 'Turnierliste', body: body });
    }

    function resetTable() {
      host.confirm('Liste zurücksetzen?', 'Alle Punkte werden auf null gesetzt.', 'Zurücksetzen', true)
        .then(function (ok) {
          if (!ok) return;
          st.table = [0, 0, 0, 0];
          st.rounds = 0;
          store.set('table', st.table);
          store.set('rounds', 0);
          syncBar();
        });
    }

    function showLastTrick() {
      var g = st.g;
      if (!g.tricks.length) { UI.toast('Noch kein Stich gespielt.'); return; }
      var rec = g.tricks[g.tricks.length - 1];
      var body = UI.el('div');
      var row = UI.el('div.row', { style: { justifyContent: 'center', gap: '8px' } });
      rec.cards.forEach(function (c) {
        var cv = UI.el('canvas', { width: 60, height: 84, style: { width: '60px', height: '84px' } });
        var cc = cv.getContext('2d');
        cc.drawImage(G.cardFace(60, 84, RANK_TXT[c.card.r], c.card.s), 0, 0);
        row.appendChild(UI.el('div', { style: { textAlign: 'center' } }, [
          cv,
          UI.el('div.tiny.muted', { text: st.names[c.seat] }),
        ]));
      });
      body.appendChild(row);
      body.appendChild(UI.el('p.small.center', {
        text: rec.value + ' Augen · ' + st.names[rec.winner] + ' bekommt den Stich',
        style: { marginTop: '10px' },
      }));
      host.modal({ title: 'Letzter Stich', body: body });
    }

    /* ---------------------------------------------------------- Modus */

    function chooseMode() {
      SG.net.lobby(host, {
        game: 'doppelkopf', seats: 4,
        title: 'Doppelkopf',
        modes: ['ai', 'online'],
        aiLabel: 'Mit drei Computer-Mitspielern',
        aiDesc: 'Sofort losspielen.',
        autoStart: false,
      }).then(function (res) {
        if (!res) return;
        if (room) { room.leave(); room = null; }
        if (pill) { pill.destroy(); pill = null; }
        st.mode = res.mode;
        if (res.mode === 'online') {
          host.keepAwake(true);   // Bildschleife im Onlinespiel nicht bei Fokusverlust anhalten
          room = res.room;
          st.mySeat = room.seat;
          pill = SG.net.pill(host.stage, room);
          setNames();
          room.on('players', setNames);
          room.on('actions', function (fresh) {
            fresh.forEach(function (x) {
              var a = x.a;
              if (a.t === 'p') {
                var g = st.g;
                var hand = g.hands[a.seat];
                for (var i = 0; i < hand.length; i++) {
                  if (hand[i].id === a.id) { applyPlay(a.seat, hand[i]); return; }
                }
              } else if (a.t === 'a') {
                applyAnnounce(a.seat, a.lvl);
              } else if (a.t === 'r') {
                newRound(a.seed);
              } else if (a.t === 'v') {
                st.g.vorbehalt.push({ seat: a.seat, choice: a.choice });
                askNext();
              }
            });
          });
          if (room.isHost) newRound();
        } else {
          st.mySeat = 0;
          st.names = ['Du', 'Anna', 'Bert', 'Clara'];
          newRound();
        }
      });

      function setNames() {
        var ps = room.players;
        st.names = [];
        for (var i = 0; i < 4; i++) {
          st.names.push(ps[i] ? ps[i].name : ['Anna', 'Bert', 'Clara', 'Dora'][i]);
        }
        if (ps[st.mySeat]) st.names[st.mySeat] = ps[st.mySeat].name + ' (du)';
        syncBar();
      }
    }

    /* ---------------------------------------------------------- Zeichnen */

    var L = { cw: 56, ch: 78, handY: 0 };

    function relayout(w, h) {
      L.cw = U.clamp(Math.min(w / 13, h / 7.5), 34, 76);
      L.ch = L.cw * 1.4;
      L.handY = h - L.ch - 12;
    }
    stage.onResize = relayout;

    function handRects() {
      var g = st.g;
      if (!g) return [];
      var hand = R.sortHand(g.hands[st.mySeat], g.game);
      var n = hand.length;
      if (!n) return [];
      var maxW = stage.w - 20;
      var step = Math.min(L.cw + 6, maxW / Math.max(1, n));
      var total = step * (n - 1) + L.cw;
      var x0 = (stage.w - total) / 2;
      var out = [];
      for (var i = 0; i < n; i++) {
        out.push({ card: hand[i], x: x0 + i * step, y: L.handY, w: L.cw, h: L.ch });
      }
      return out;
    }

    function seatPos(seat) {
      // 0 unten (ich), 1 links, 2 oben, 3 rechts - relativ zu mySeat
      var rel = U.mod(seat - st.mySeat, 4);
      var w = stage.w, h = stage.h;
      var cx = w / 2, cy = (L.handY) / 2 + 10;
      var rx = Math.min(w * 0.3, 230), ry = Math.min(cy * 0.62, 130);
      if (rel === 0) return { x: cx, y: cy + ry, label: 'unten' };
      if (rel === 1) return { x: cx - rx, y: cy, label: 'links' };
      if (rel === 2) return { x: cx, y: cy - ry, label: 'oben' };
      return { x: cx + rx, y: cy, label: 'rechts' };
    }

    function draw() {
      var w = stage.w, h = stage.h;
      var g = st.g;
      if (!L.handY) relayout(w, h);
      ctx.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0);
      ctx.fillStyle = '#123322';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,.02)';
      for (var i = 0; i < h; i += 4) ctx.fillRect(0, i, w, 1);
      if (!g) return;

      // Mitspieler
      for (var seat = 0; seat < 4; seat++) {
        var p = seatPos(seat);
        if (seat === st.mySeat) continue;
        var isTurn = g.turn === seat && g.phase === 'spiel';
        var boxW = 108, boxH = 46;
        G.fillRound(ctx, p.x - boxW / 2, p.y - boxH / 2, boxW, boxH, 10,
          isTurn ? 'rgba(240,180,41,.22)' : 'rgba(11,20,16,.62)');
        if (isTurn) {
          G.strokeRound(ctx, p.x - boxW / 2, p.y - boxH / 2, boxW, boxH, 10, '#f0b429', 2);
        }
        G.text(ctx, st.names[seat], p.x, p.y - 6, {
          size: 13, weight: 700, color: '#e9edf6', align: 'center', baseline: 'middle',
        });
        var partyTxt = '';
        if (g.phase !== 'vorbehalt') {
          if (g.partyKnown[seat] || R.GAMES[g.game].solo) {
            partyTxt = g.party[seat] === 1 ? 'Re' : 'Kontra';
          }
        }
        G.text(ctx, g.hands[seat].length + ' Karten' + (partyTxt ? ' · ' + partyTxt : ''),
          p.x, p.y + 11, {
          size: 10.5, color: '#9fb3a6', align: 'center', baseline: 'middle',
        });
      }

      // Stich in der Mitte
      var cw = L.cw * 0.92, chh = L.ch * 0.92;
      var mid = { x: w / 2, y: (L.handY) / 2 + 10 };
      var offs = [[0, 46], [-58, 0], [0, -46], [58, 0]];
      for (i = 0; i < g.trick.length; i++) {
        var t = g.trick[i];
        var rel = U.mod(t.seat - st.mySeat, 4);
        var o = offs[rel];
        var x = mid.x + o[0] - cw / 2, y = mid.y + o[1] - chh / 2;
        ctx.drawImage(G.cardFace(cw, chh, RANK_TXT[t.card.r], t.card.s), x, y);
        if (R.isTrump(t.card, g.game)) {
          G.strokeRound(ctx, x + 1, y + 1, cw - 2, chh - 2, cw * 0.1, 'rgba(240,180,41,.6)', 2);
        }
      }

      // Stich-Auswertung
      if (st.anim && st.anim.kind === 'trick') {
        var rec = st.anim.rec;
        var alpha = U.clamp(1 - st.anim.t / 0.9, 0, 1);
        ctx.globalAlpha = alpha;
        for (i = 0; i < rec.cards.length; i++) {
          var t2 = rec.cards[i];
          var rel2 = U.mod(t2.seat - st.mySeat, 4);
          var o2 = offs[rel2];
          var wp = seatPos(rec.winner);
          var pr = U.easeOut(U.clamp(st.anim.t / 0.7, 0, 1));
          var xx = U.lerp(mid.x + o2[0], wp.x, pr) - cw / 2;
          var yy = U.lerp(mid.y + o2[1], wp.y, pr) - chh / 2;
          ctx.drawImage(G.cardFace(cw, chh, RANK_TXT[t2.card.r], t2.card.s), xx, yy);
        }
        ctx.globalAlpha = 1;
        G.text(ctx, rec.value + ' Augen für ' + st.names[rec.winner], w / 2, mid.y + 96, {
          size: 14, weight: 700, color: '#ffd166', align: 'center', baseline: 'middle',
        });
      }

      // Eigene Hand
      var rects = handRects();
      var legal = g.phase === 'spiel' && isHuman(g.turn) && g.turn === st.mySeat
        ? R.legal(g.hands[st.mySeat], g.trick, g.game) : null;
      for (i = 0; i < rects.length; i++) {
        var rct = rects[i];
        var isLegal = !legal || legal.some(function (c) { return c.id === rct.card.id; });
        var lift = (st.sel === i ? 16 : 0);
        ctx.save();
        if (!isLegal) ctx.globalAlpha = 0.45;
        ctx.drawImage(G.cardFace(rct.w, rct.h, RANK_TXT[rct.card.r], rct.card.s),
          rct.x, rct.y - lift);
        if (R.isTrump(rct.card, g.game)) {
          G.strokeRound(ctx, rct.x + 1, rct.y - lift + 1, rct.w - 2, rct.h - 2,
            rct.w * 0.1, 'rgba(240,180,41,.75)', 2);
        }
        if (st.sel === i) {
          G.strokeRound(ctx, rct.x - 1, rct.y - lift - 1, rct.w + 2, rct.h + 2,
            rct.w * 0.1, '#ffd166', 2.5);
        }
        ctx.restore();
      }

      // Hinweiszeile
      var hint = '';
      if (g.phase === 'vorbehalt') hint = 'Vorbehalt wird abgefragt…';
      else if (g.phase === 'ende') hint = 'Runde beendet';
      else if (g.turn === st.mySeat) hint = 'Du bist am Zug — Karte antippen';
      else hint = st.names[g.turn] + ' überlegt…';
      G.text(ctx, hint, w / 2, L.handY - 14, {
        size: 13, weight: 600, color: '#9fb3a6', align: 'center', baseline: 'middle',
      });

      // Ansagen anzeigen
      var annTxt = [];
      if (g.ann.re) annTxt.push('Re' + (g.ann.reLevel ? ' · ' + LEVEL_NAMES[g.ann.reLevel] : ''));
      if (g.ann.kontra) annTxt.push('Kontra' + (g.ann.kontraLevel ? ' · ' + LEVEL_NAMES[g.ann.kontraLevel] : ''));
      if (annTxt.length) {
        G.text(ctx, annTxt.join('   |   '), w / 2, 16, {
          size: 12.5, weight: 700, color: '#ffd166', align: 'center', baseline: 'top',
        });
      }
    }

    /* ---------------------------------------------------------- Schleife */

    var loop = host.loop({
      hz: 30,
      update: function (dt) {
        if (st.anim) {
          st.anim.t += dt;
          if (st.anim.t >= 0.95) finishTrick();
        }
      },
      render: draw,
    });

    host.input({
      onTap: function (x, y) {
        var g = st.g;
        if (!g || g.phase !== 'spiel') return;
        if (g.turn !== st.mySeat) return;
        var rects = handRects();
        for (var i = rects.length - 1; i >= 0; i--) {
          var r = rects[i];
          if (U.inRect(x, y, r.x, r.y - (st.sel === i ? 16 : 0), r.w, r.h + 16)) {
            var legal = R.legal(g.hands[st.mySeat], g.trick, g.game);
            var ok = legal.some(function (c) { return c.id === r.card.id; });
            if (!ok) { host.sfx('error'); UI.toast('Du musst bedienen.', 'bad', 1400); return; }
            if (st.sel === i) doPlay(st.mySeat, r.card);
            else { st.sel = i; host.sfx('tick'); }
            return;
          }
        }
        st.sel = -1;
      },
    });

    function help(force) {
      SG.tutorial.show({
        id: 'doppelkopf', force: force, parent: host.root, title: 'Doppelkopf',
        pages: [
          {
            kicker: 'Doppelkopf', title: 'Zwei gegen zwei — nur weiß man das nicht',
            art: function (c, w, h) {
              var cw = Math.min(46, w / 10), chh = cw * 1.4;
              var cards = [['D', 'c'], ['D', 'c'], ['10', 'h'], ['A', 'd']];
              var x0 = w / 2 - (cards.length * (cw + 6)) / 2;
              cards.forEach(function (cd, i) {
                c.drawImage(G.cardFace(cw, chh, cd[0], cd[1]), x0 + i * (cw + 6), h / 2 - chh / 2);
              });
            },
            body: [
              { ic: '♣', text: 'Wer eine <b>Kreuz-Dame</b> hat, gehört zu <b>Re</b> — die anderen beiden sind <b>Kontra</b>. Wer der Partner ist, merkt man erst im Spiel.' },
              { ic: '🎯', text: 'Zusammen gibt es <b>240 Augen</b>. Re braucht 121, Kontra genügen 120.' },
              { ic: '👆', text: 'Karte einmal antippen zum Auswählen, noch einmal zum Ausspielen.' },
            ],
          },
          {
            kicker: 'Trumpf', title: 'Was sticht was',
            art: function (c, w, h) {
              var cw = Math.min(40, w / 12), chh = cw * 1.4;
              var cards = [['10', 'h'], ['D', 'c'], ['D', 's'], ['B', 'c'], ['A', 'd'], ['9', 'd']];
              var x0 = w / 2 - (cards.length * (cw + 4)) / 2;
              cards.forEach(function (cd, i) {
                c.drawImage(G.cardFace(cw, chh, cd[0], cd[1]), x0 + i * (cw + 4), h / 2 - chh / 2 - 6);
              });
              G.text(c, 'stark  →  schwach', w / 2, h / 2 + chh / 2 + 10, {
                size: 11, color: '#8794b1', align: 'center', baseline: 'middle',
              });
            },
            body: [
              { ic: '1', text: 'Trumpf im Normalspiel, von oben nach unten: <b>Herz-Zehn</b>, dann die <b>Damen</b> (Kreuz, Pik, Herz, Karo), dann die <b>Buben</b> in derselben Reihenfolge, dann alle <b>Karo</b>-Karten (A, 10, K, 9).' },
              { ic: '2', text: 'Alles andere sind Fehlfarben: Ass schlägt Zehn schlägt König schlägt Neun.' },
              { ic: '3', text: '<b>Farbzwang</b>: Du musst bedienen, wenn du die angespielte Farbe (oder Trumpf) hast. Trumpfkarten sind im Blatt gelb umrandet.' },
              { ic: '4', text: 'Bei zwei gleichen Karten gewinnt die <b>zuerst gespielte</b>.' },
            ],
          },
          {
            kicker: 'Ansagen & Sonderpunkte', title: 'Mehr Einsatz, mehr Punkte',
            art: SG.tutorial.art.tap,
            body: [
              { ic: '📢', text: '<b>Re</b> oder <b>Kontra</b> darfst du ansagen, solange du höchstens eine Karte gespielt hast. Das verdoppelt den Einsatz — und verrät deine Partei.' },
              { ic: '9', text: 'Danach sind <b>keine 90</b>, <b>keine 60</b>, <b>keine 30</b> und <b>schwarz</b> möglich. Jede Stufe eine Karte später. Wer ansagt, muss dann auch mehr Augen holen (151, 181, 211).' },
              { ic: '⭐', text: 'Sonderpunkte: ein Stich mit 40+ Augen (<b>Doppelkopf</b>), der Kreuz-Bube im letzten Stich (<b>Karlchen</b>) und ein gefangenes gegnerisches <b>Karo-Ass</b> (Fuchs).' },
              { ic: '🃏', text: 'Vor dem Spiel wird <b>Vorbehalt</b> gefragt: Damen-Solo, Buben-Solo, ein Farb-Solo oder ein fleischloses Solo ganz ohne Trumpf.' },
            ],
          },
        ],
      });
    }

    newRound();
    loop.start();
    help(false);

    return {
      state: st,
      destroy: function () {
        if (timer) clearTimeout(timer);
        if (room) room.leave();
        if (pill) pill.destroy();
      },
      selftest: function () {
        // Kartensatz
        var deck = R.deck();
        if (deck.length !== 48) throw new Error('Blatt hat ' + deck.length + ' Karten');
        var total = 0;
        deck.forEach(function (c) { total += VALUE[c.r]; });
        if (total !== 240) throw new Error('Augensumme ist ' + total + ' statt 240');

        // Trumpfordnung im Normalspiel
        var h10 = { s: 'h', r: 'T' }, cd = { s: 'c', r: 'D' }, dj = { s: 'd', r: 'B' };
        var da = { s: 'd', r: 'A' }, ha = { s: 'h', r: 'A' };
        if (!(R.trumpRank(h10, 'normal') > R.trumpRank(cd, 'normal'))) {
          throw new Error('Herz-Zehn ist nicht die höchste Karte');
        }
        if (!(R.trumpRank(cd, 'normal') > R.trumpRank(dj, 'normal'))) {
          throw new Error('Damen stehen nicht über den Buben');
        }
        if (!(R.trumpRank(dj, 'normal') > R.trumpRank(da, 'normal'))) {
          throw new Error('Buben stehen nicht über Karo-Ass');
        }
        if (R.isTrump(ha, 'normal')) throw new Error('Herz-Ass darf kein Trumpf sein');
        if (R.isTrump(h10, 'fleischlos')) throw new Error('Im fleischlosen Solo gibt es keinen Trumpf');
        if (!R.isTrump({ s: 's', r: 'A' }, 'soloS')) throw new Error('Pik-Solo: Pik muss Trumpf sein');

        // Stichgewinner: gleiche Karte, erste gewinnt
        var tr = [
          { seat: 0, card: { s: 'h', r: 'T', id: 1 } },
          { seat: 1, card: { s: 'h', r: 'T', id: 2 } },
          { seat: 2, card: { s: 'c', r: 'D', id: 3 } },
          { seat: 3, card: { s: 'd', r: '9', id: 4 } },
        ];
        if (R.trickWinner(tr, 'normal') !== 0) throw new Error('Bei gleichen Karten muss die erste gewinnen');

        // Fehlfarbe sticht nicht
        var tr2 = [
          { seat: 0, card: { s: 'c', r: 'K', id: 1 } },
          { seat: 1, card: { s: 's', r: 'A', id: 2 } },
          { seat: 2, card: { s: 'c', r: '9', id: 3 } },
          { seat: 3, card: { s: 'c', r: 'A', id: 4 } },
        ];
        if (R.trickWinner(tr2, 'normal') !== 3) throw new Error('Höchste bediente Karte gewinnt nicht');

        // Farbzwang
        var hand = [
          { s: 'c', r: 'A', id: 1 }, { s: 'c', r: '9', id: 2 }, { s: 's', r: 'A', id: 3 },
        ];
        var legal = R.legal(hand, [{ seat: 0, card: { s: 'c', r: 'K', id: 9 } }], 'normal');
        if (legal.length !== 2) throw new Error('Farbzwang greift nicht');

        // Abrechnung
        var res = R.settle({
          rePoints: 130, kontraPoints: 110, reTricks: 7, kontraTricks: 5,
          reAnn: false, kontraAnn: false, reLevel: 0, kontraLevel: 0,
          solo: false, extras: { re: 0, kontra: 0 },
        });
        if (res.winner !== 're' || res.value !== 1) {
          throw new Error('Einfacher Sieg falsch gewertet: ' + res.winner + '/' + res.value);
        }
        var res2 = R.settle({
          rePoints: 120, kontraPoints: 120, reTricks: 6, kontraTricks: 6,
          reAnn: false, kontraAnn: false, reLevel: 0, kontraLevel: 0,
          solo: false, extras: { re: 0, kontra: 0 },
        });
        if (res2.winner !== 'kontra') throw new Error('Bei 120:120 muss Kontra gewinnen');
        var res3 = R.settle({
          rePoints: 145, kontraPoints: 95, reTricks: 8, kontraTricks: 4,
          reAnn: true, kontraAnn: false, reLevel: 1, kontraLevel: 0,
          solo: false, extras: { re: 0, kontra: 0 },
        });
        if (res3.winner !== 'kontra') {
          throw new Error('Verfehlte Ansage "keine 90" muss verloren gehen');
        }

        // Volle Runde mit vier KI-Spielern durchspielen
        for (var round = 0; round < 6; round++) {
          var g = R.newRound(1234 + round, round % 4);
          var counts = {};
          g.hands.forEach(function (hd) {
            if (hd.length !== 12) throw new Error('Hand hat ' + hd.length + ' Karten');
            hd.forEach(function (c) {
              var k = c.s + c.r;
              counts[k] = (counts[k] || 0) + 1;
            });
          });
          for (var k in counts) if (counts[k] !== 2) throw new Error('Karte ' + k + ' kommt ' + counts[k] + '-mal vor');

          R.assignParties(g);
          g.phase = 'spiel';
          g.turn = (g.dealer + 1) % 4;
          var guard = 0;
          while (g.phase === 'spiel' && guard++ < 100) {
            var rng = U.rng((g.seed + guard * 31) >>> 0);
            var card = R.aiCard(g, g.turn, rng);
            if (!card) throw new Error('KI findet keine Karte');
            if (!R.play(g, g.turn, card)) throw new Error('KI spielt eine unerlaubte Karte');
          }
          if (g.phase !== 'ende') throw new Error('Runde endet nicht');
          var sum = g.points[0] + g.points[1] + g.points[2] + g.points[3];
          if (sum !== 240) throw new Error('Augensumme nach der Runde: ' + sum);
          if (g.tricks.length !== 12) throw new Error('Es wurden ' + g.tricks.length + ' Stiche gespielt');
        }

        newRound(999);
        draw();
      },
    };
  }

  SG.register({
    id: 'doppelkopf',
    name: 'Doppelkopf',
    category: 'karten',
    online: true,
    desc: 'Volle Regeln, Solos, Ansagen',
    tags: ['karten', 'stich', 'mehrspieler', 'doko', 'trumpf'],
    preview: function (c, w, h) {
      c.fillStyle = '#123322';
      c.fillRect(0, 0, w, h);
      var cw = Math.min(w * 0.15, h * 0.34), chh = cw * 1.4;
      var cards = [['10', 'h'], ['D', 'c'], ['B', 'c'], ['A', 'd']];
      var x0 = (w - (cards.length * (cw * 0.72) + cw * 0.28)) / 2;
      cards.forEach(function (cd, i) {
        var x = x0 + i * cw * 0.72;
        var y = h / 2 - chh / 2 + Math.sin(i * 1.1) * 4;
        c.save();
        c.translate(x + cw / 2, y + chh / 2);
        c.rotate((i - 1.5) * 0.06);
        c.drawImage(G.cardFace(cw, chh, cd[0], cd[1]), -cw / 2, -chh / 2);
        c.restore();
      });
      G.text(c, 'Re · Kontra', w / 2, h - 12, {
        size: Math.max(9, h * 0.09), weight: 700, color: 'rgba(255,255,255,.5)',
        align: 'center', baseline: 'bottom',
      });
    },
    mount: mount,
  });
})(SG);
