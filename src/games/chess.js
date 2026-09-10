/* ------------------------------------------------------------------
   Schach

   Vollständige Regeln: Rochade, En passant, Umwandlung, Schach, Matt,
   Patt, 50-Züge-Regel, dreifache Stellungswiederholung und ungenügendes
   Material.

   Die KI ist eine Alpha-Beta-Suche mit iterativer Vertiefung, Zug-
   ordnung, Ruhesuche und Stellungstabellen. Sie laeuft in Zeitscheiben
   im Hauptthread - Web-Worker sind unter file:// nicht verfuegbar.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var G = SG.gfx;
  var UI = SG.ui;

  /* ==================================================================
     Regel-Engine
     ================================================================== */

  var R = SG.rules.chess = {};

  var EMPTY = 0, P = 1, N = 2, B = 3, RO = 4, Q = 5, K = 6;
  R.P = P; R.N = N; R.B = B; R.R = RO; R.Q = Q; R.K = K;

  var PIECE_CH = { 1: 'B', 2: 'S', 3: 'L', 4: 'T', 5: 'D', 6: 'K' };  // deutsche Kurzform
  R.PIECE_CH = PIECE_CH;

  function sq(f, r) { return r * 8 + f; }
  function fileOf(s) { return s & 7; }
  function rankOf(s) { return s >> 3; }
  R.sq = sq; R.fileOf = fileOf; R.rankOf = rankOf;

  R.create = function () {
    var b = new Int8Array(64);
    var back = [RO, N, B, Q, K, B, N, RO];
    for (var f = 0; f < 8; f++) {
      b[sq(f, 0)] = -back[f];      // Schwarz oben (Reihe 8)
      b[sq(f, 1)] = -P;
      b[sq(f, 6)] = P;
      b[sq(f, 7)] = back[f];       // Weiss unten (Reihe 1)
    }
    return {
      b: b,
      turn: 1,                      // 1 = Weiss, -1 = Schwarz
      cast: { K: true, Q: true, k: true, q: true },
      ep: -1,
      half: 0,
      full: 1,
      hist: [],
      reps: {},
    };
  };

  R.clone = function (s) {
    return {
      b: s.b.slice(),
      turn: s.turn,
      cast: { K: s.cast.K, Q: s.cast.Q, k: s.cast.k, q: s.cast.q },
      ep: s.ep,
      half: s.half,
      full: s.full,
      hist: s.hist.slice(),
      reps: U.assign({}, s.reps),
    };
  };

  /* Kompakter Stellungsschluessel fuer die Wiederholungsregel */
  R.key = function (s) {
    var k = '';
    for (var i = 0; i < 64; i++) k += String.fromCharCode(s.b[i] + 70);
    return k + (s.turn > 0 ? 'w' : 'b') +
      (s.cast.K ? 'K' : '') + (s.cast.Q ? 'Q' : '') +
      (s.cast.k ? 'k' : '') + (s.cast.q ? 'q' : '') + ':' + s.ep;
  };

  var KNIGHT_D = [-17, -15, -10, -6, 6, 10, 15, 17];
  var KING_D = [-9, -8, -7, -1, 1, 7, 8, 9];
  var BISHOP_D = [-9, -7, 7, 9];
  var ROOK_D = [-8, -1, 1, 8];

  function onBoard(s) { return s >= 0 && s < 64; }
  /* Verhindert Ueberlaufen am Brettrand */
  function stepOk(from, to, maxFileDelta) {
    if (!onBoard(to)) return false;
    return Math.abs(fileOf(from) - fileOf(to)) <= maxFileDelta;
  }

  R.attacked = function (s, target, bySide) {
    var b = s.b, i, from, to, d;

    // Bauern
    var pd = bySide > 0 ? -8 : 8;
    for (i = -1; i <= 1; i += 2) {
      from = target - pd + i;
      if (onBoard(from) && Math.abs(fileOf(from) - fileOf(target)) === 1) {
        if (b[from] === bySide * P) return true;
      }
    }
    // Springer
    for (i = 0; i < 8; i++) {
      to = target + KNIGHT_D[i];
      if (!onBoard(to)) continue;
      if (Math.abs(fileOf(to) - fileOf(target)) > 2) continue;
      if (b[to] === bySide * N) return true;
    }
    // Koenig
    for (i = 0; i < 8; i++) {
      to = target + KING_D[i];
      if (!stepOk(target, to, 1)) continue;
      if (b[to] === bySide * K) return true;
    }
    // Laeufer / Dame diagonal
    for (i = 0; i < 4; i++) {
      d = BISHOP_D[i];
      to = target;
      while (true) {
        var prev = to;
        to += d;
        if (!stepOk(prev, to, 1)) break;
        var v = b[to];
        if (v === 0) continue;
        if (v === bySide * B || v === bySide * Q) return true;
        break;
      }
    }
    // Turm / Dame gerade
    for (i = 0; i < 4; i++) {
      d = ROOK_D[i];
      to = target;
      while (true) {
        var prev2 = to;
        to += d;
        if (!onBoard(to)) break;
        if ((d === 1 || d === -1) && rankOf(to) !== rankOf(prev2)) break;
        var v2 = b[to];
        if (v2 === 0) continue;
        if (v2 === bySide * RO || v2 === bySide * Q) return true;
        break;
      }
    }
    return false;
  };

  R.kingSquare = function (s, side) {
    for (var i = 0; i < 64; i++) if (s.b[i] === side * K) return i;
    return -1;
  };

  R.inCheck = function (s, side) {
    var ks = R.kingSquare(s, side);
    return ks >= 0 && R.attacked(s, ks, -side);
  };

  /* Pseudo-legale Zuege */
  R.pseudo = function (s, side, capturesOnly) {
    var out = [];
    var b = s.b;
    side = side || s.turn;

    for (var from = 0; from < 64; from++) {
      var pc = b[from];
      if (!pc || (pc > 0) !== (side > 0)) continue;
      var t = Math.abs(pc);

      if (t === P) {
        var dir = side > 0 ? -8 : 8;
        var startRank = side > 0 ? 6 : 1;
        var promoRank = side > 0 ? 0 : 7;
        var one = from + dir;
        if (onBoard(one) && b[one] === 0 && !capturesOnly) {
          pushPawn(out, from, one, promoRank);
          var two = from + dir * 2;
          if (rankOf(from) === startRank && b[two] === 0) {
            out.push({ from: from, to: two, dbl: true });
          }
        }
        for (var dx = -1; dx <= 1; dx += 2) {
          var cap = from + dir + dx;
          if (!onBoard(cap)) continue;
          if (Math.abs(fileOf(cap) - fileOf(from)) !== 1) continue;
          if (b[cap] !== 0 && (b[cap] > 0) !== (side > 0)) {
            pushPawn(out, from, cap, promoRank);
          } else if (cap === s.ep && b[cap] === 0) {
            out.push({ from: from, to: cap, ep: true });
          }
        }
        continue;
      }

      if (t === N) {
        for (var i = 0; i < 8; i++) {
          var to = from + KNIGHT_D[i];
          if (!onBoard(to)) continue;
          if (Math.abs(fileOf(to) - fileOf(from)) > 2) continue;
          if (b[to] !== 0 && (b[to] > 0) === (side > 0)) continue;
          if (capturesOnly && b[to] === 0) continue;
          out.push({ from: from, to: to });
        }
        continue;
      }

      if (t === K) {
        for (i = 0; i < 8; i++) {
          to = from + KING_D[i];
          if (!stepOk(from, to, 1)) continue;
          if (b[to] !== 0 && (b[to] > 0) === (side > 0)) continue;
          if (capturesOnly && b[to] === 0) continue;
          out.push({ from: from, to: to });
        }
        if (!capturesOnly) addCastling(s, side, from, out);
        continue;
      }

      var dirs = t === B ? BISHOP_D : (t === RO ? ROOK_D : BISHOP_D.concat(ROOK_D));
      for (i = 0; i < dirs.length; i++) {
        var d = dirs[i];
        var cur = from;
        while (true) {
          var prev = cur;
          cur += d;
          if (!onBoard(cur)) break;
          // Randueberlauf abfangen
          if (Math.abs(fileOf(cur) - fileOf(prev)) > 1) break;
          var v = b[cur];
          if (v !== 0 && (v > 0) === (side > 0)) break;
          if (!capturesOnly || v !== 0) out.push({ from: from, to: cur });
          if (v !== 0) break;
        }
      }
    }
    return out;
  };

  function pushPawn(out, from, to, promoRank) {
    if (rankOf(to) === promoRank) {
      out.push({ from: from, to: to, promo: Q });
      out.push({ from: from, to: to, promo: RO });
      out.push({ from: from, to: to, promo: B });
      out.push({ from: from, to: to, promo: N });
    } else {
      out.push({ from: from, to: to });
    }
  }

  function addCastling(s, side, from, out) {
    var b = s.b;
    if (side > 0) {
      if (from !== 60) return;
      if (s.cast.K && b[61] === 0 && b[62] === 0 && b[63] === RO &&
        !R.attacked(s, 60, -1) && !R.attacked(s, 61, -1) && !R.attacked(s, 62, -1)) {
        out.push({ from: 60, to: 62, castle: 'K' });
      }
      if (s.cast.Q && b[59] === 0 && b[58] === 0 && b[57] === 0 && b[56] === RO &&
        !R.attacked(s, 60, -1) && !R.attacked(s, 59, -1) && !R.attacked(s, 58, -1)) {
        out.push({ from: 60, to: 58, castle: 'Q' });
      }
    } else {
      if (from !== 4) return;
      if (s.cast.k && b[5] === 0 && b[6] === 0 && b[7] === -RO &&
        !R.attacked(s, 4, 1) && !R.attacked(s, 5, 1) && !R.attacked(s, 6, 1)) {
        out.push({ from: 4, to: 6, castle: 'k' });
      }
      if (s.cast.q && b[3] === 0 && b[2] === 0 && b[1] === 0 && b[0] === -RO &&
        !R.attacked(s, 4, 1) && !R.attacked(s, 3, 1) && !R.attacked(s, 2, 1)) {
        out.push({ from: 4, to: 2, castle: 'q' });
      }
    }
  }

  R.make = function (s, m) {
    var b = s.b;
    var side = s.turn;
    var undo = {
      cap: b[m.to], from: m.from, to: m.to,
      cast: { K: s.cast.K, Q: s.cast.Q, k: s.cast.k, q: s.cast.q },
      ep: s.ep, half: s.half, piece: b[m.from], m: m,
      epCap: 0, epSq: -1,
    };

    var pc = b[m.from];
    var t = Math.abs(pc);

    b[m.to] = m.promo ? side * m.promo : pc;
    b[m.from] = 0;

    if (m.ep) {
      var capSq = m.to + (side > 0 ? 8 : -8);
      undo.epCap = b[capSq];
      undo.epSq = capSq;
      b[capSq] = 0;
    }
    if (m.castle) {
      if (m.castle === 'K') { b[61] = b[63]; b[63] = 0; }
      else if (m.castle === 'Q') { b[59] = b[56]; b[56] = 0; }
      else if (m.castle === 'k') { b[5] = b[7]; b[7] = 0; }
      else if (m.castle === 'q') { b[3] = b[0]; b[0] = 0; }
    }

    // Rochaderechte anpassen
    if (t === K) {
      if (side > 0) { s.cast.K = false; s.cast.Q = false; }
      else { s.cast.k = false; s.cast.q = false; }
    }
    if (m.from === 63 || m.to === 63) s.cast.K = false;
    if (m.from === 56 || m.to === 56) s.cast.Q = false;
    if (m.from === 7 || m.to === 7) s.cast.k = false;
    if (m.from === 0 || m.to === 0) s.cast.q = false;

    s.ep = m.dbl ? (m.from + (side > 0 ? -8 : 8)) : -1;
    s.half = (t === P || undo.cap !== 0) ? 0 : s.half + 1;
    if (side < 0) s.full++;
    s.turn = -side;
    s.hist.push(undo);
    return undo;
  };

  R.unmake = function (s) {
    var undo = s.hist.pop();
    if (!undo) return;
    var b = s.b;
    var m = undo.m;
    var side = -s.turn;

    b[undo.from] = undo.piece;
    b[undo.to] = undo.cap;
    if (m.ep) b[undo.epSq] = undo.epCap;
    if (m.castle) {
      if (m.castle === 'K') { b[63] = b[61]; b[61] = 0; }
      else if (m.castle === 'Q') { b[56] = b[59]; b[59] = 0; }
      else if (m.castle === 'k') { b[7] = b[5]; b[5] = 0; }
      else if (m.castle === 'q') { b[0] = b[3]; b[3] = 0; }
    }
    s.cast = undo.cast;
    s.ep = undo.ep;
    s.half = undo.half;
    if (side < 0) s.full--;
    s.turn = side;
  };

  R.legal = function (s, side) {
    side = side || s.turn;
    var ps = R.pseudo(s, side);
    var out = [];
    for (var i = 0; i < ps.length; i++) {
      R.make(s, ps[i]);
      if (!R.inCheck(s, side)) out.push(ps[i]);
      R.unmake(s);
    }
    return out;
  };

  R.perft = function (s, depth) {
    if (depth === 0) return 1;
    var moves = R.legal(s, s.turn);
    if (depth === 1) return moves.length;
    var n = 0;
    for (var i = 0; i < moves.length; i++) {
      R.make(s, moves[i]);
      n += R.perft(s, depth - 1);
      R.unmake(s);
    }
    return n;
  };

  R.insufficient = function (s) {
    var pieces = [];
    for (var i = 0; i < 64; i++) {
      var v = s.b[i];
      if (!v) continue;
      var t = Math.abs(v);
      if (t === P || t === RO || t === Q) return false;
      if (t !== K) pieces.push({ t: t, sq: i, side: v > 0 ? 1 : -1 });
    }
    if (pieces.length === 0) return true;                    // K gegen K
    if (pieces.length === 1) return true;                    // K+L oder K+S
    if (pieces.length === 2 && pieces[0].t === B && pieces[1].t === B) {
      var c0 = (fileOf(pieces[0].sq) + rankOf(pieces[0].sq)) % 2;
      var c1 = (fileOf(pieces[1].sq) + rankOf(pieces[1].sq)) % 2;
      return c0 === c1;                                      // gleichfarbige Laeufer
    }
    return false;
  };

  /* Ergebnis der Stellung: null, 'matt', 'patt', '50', 'wdh', 'material' */
  R.status = function (s, repCounts) {
    var moves = R.legal(s, s.turn);
    if (!moves.length) return R.inCheck(s, s.turn) ? 'matt' : 'patt';
    if (s.half >= 100) return '50';
    if (R.insufficient(s)) return 'material';
    if (repCounts && repCounts[R.key(s)] >= 3) return 'wdh';
    return null;
  };

  /* ---------------------------------------------------------- Notation */

  R.sqName = function (s) {
    return 'abcdefgh'[fileOf(s)] + (8 - rankOf(s));
  };

  R.notation = function (s, m) {
    var pc = Math.abs(s.b[m.from]);
    if (m.castle) return (m.castle === 'K' || m.castle === 'k') ? '0-0' : '0-0-0';
    var cap = s.b[m.to] !== 0 || m.ep;
    var txt = '';
    if (pc === P) {
      txt = cap ? 'abcdefgh'[fileOf(m.from)] + 'x' : '';
      txt += R.sqName(m.to);
      if (m.promo) txt += '=' + PIECE_CH[m.promo];
    } else {
      txt = PIECE_CH[pc];
      // Mehrdeutigkeit aufloesen
      var others = R.legal(s, s.turn).filter(function (x) {
        return x.to === m.to && x.from !== m.from && Math.abs(s.b[x.from]) === pc;
      });
      if (others.length) {
        var sameFile = others.some(function (x) { return fileOf(x.from) === fileOf(m.from); });
        txt += sameFile ? String(8 - rankOf(m.from)) : 'abcdefgh'[fileOf(m.from)];
      }
      if (cap) txt += 'x';
      txt += R.sqName(m.to);
    }
    R.make(s, m);
    if (R.inCheck(s, s.turn)) {
      txt += R.legal(s, s.turn).length ? '+' : '#';
    }
    R.unmake(s);
    return txt;
  };

  /* ---------------------------------------------------------- Bewertung */

  var VAL = [0, 100, 320, 330, 500, 900, 20000];

  var PST = {
    1: [   // Bauer (aus Sicht von Weiss, Index 0 = a8)
      0, 0, 0, 0, 0, 0, 0, 0,
      50, 50, 50, 50, 50, 50, 50, 50,
      10, 10, 20, 30, 30, 20, 10, 10,
      5, 5, 10, 25, 25, 10, 5, 5,
      0, 0, 0, 20, 20, 0, 0, 0,
      5, -5, -10, 0, 0, -10, -5, 5,
      5, 10, 10, -20, -20, 10, 10, 5,
      0, 0, 0, 0, 0, 0, 0, 0],
    2: [
      -50, -40, -30, -30, -30, -30, -40, -50,
      -40, -20, 0, 0, 0, 0, -20, -40,
      -30, 0, 10, 15, 15, 10, 0, -30,
      -30, 5, 15, 20, 20, 15, 5, -30,
      -30, 0, 15, 20, 20, 15, 0, -30,
      -30, 5, 10, 15, 15, 10, 5, -30,
      -40, -20, 0, 5, 5, 0, -20, -40,
      -50, -40, -30, -30, -30, -30, -40, -50],
    3: [
      -20, -10, -10, -10, -10, -10, -10, -20,
      -10, 0, 0, 0, 0, 0, 0, -10,
      -10, 0, 5, 10, 10, 5, 0, -10,
      -10, 5, 5, 10, 10, 5, 5, -10,
      -10, 0, 10, 10, 10, 10, 0, -10,
      -10, 10, 10, 10, 10, 10, 10, -10,
      -10, 5, 0, 0, 0, 0, 5, -10,
      -20, -10, -10, -10, -10, -10, -10, -20],
    4: [
      0, 0, 0, 0, 0, 0, 0, 0,
      5, 10, 10, 10, 10, 10, 10, 5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      0, 0, 0, 5, 5, 0, 0, 0],
    5: [
      -20, -10, -10, -5, -5, -10, -10, -20,
      -10, 0, 0, 0, 0, 0, 0, -10,
      -10, 0, 5, 5, 5, 5, 0, -10,
      -5, 0, 5, 5, 5, 5, 0, -5,
      0, 0, 5, 5, 5, 5, 0, -5,
      -10, 5, 5, 5, 5, 5, 0, -10,
      -10, 0, 5, 0, 0, 0, 0, -10,
      -20, -10, -10, -5, -5, -10, -10, -20],
    6: [
      -30, -40, -40, -50, -50, -40, -40, -30,
      -30, -40, -40, -50, -50, -40, -40, -30,
      -30, -40, -40, -50, -50, -40, -40, -30,
      -30, -40, -40, -50, -50, -40, -40, -30,
      -20, -30, -30, -40, -40, -30, -30, -20,
      -10, -20, -20, -20, -20, -20, -20, -10,
      20, 20, 0, 0, 0, 0, 20, 20,
      20, 30, 10, 0, 0, 10, 30, 20],
  };
  var PST_KING_END = [
    -50, -40, -30, -20, -20, -30, -40, -50,
    -30, -20, -10, 0, 0, -10, -20, -30,
    -30, -10, 20, 30, 30, 20, -10, -30,
    -30, -10, 30, 40, 40, 30, -10, -30,
    -30, -10, 30, 40, 40, 30, -10, -30,
    -30, -10, 20, 30, 30, 20, -10, -30,
    -30, -30, 0, 0, 0, 0, -30, -30,
    -50, -30, -30, -30, -30, -30, -30, -50];

  R.evaluate = function (s) {
    var score = 0, material = 0;
    var i, v, t;
    for (i = 0; i < 64; i++) {
      v = s.b[i];
      if (!v) continue;
      t = Math.abs(v);
      if (t !== K) material += VAL[t];
    }
    var endgame = material < 1800;
    for (i = 0; i < 64; i++) {
      v = s.b[i];
      if (!v) continue;
      t = Math.abs(v);
      var idx = v > 0 ? i : (56 - (i & 56) + (i & 7));   // spiegeln fuer Schwarz
      var pst = (t === K && endgame) ? PST_KING_END[idx] : PST[t][idx];
      var val = VAL[t] + pst;
      score += v > 0 ? val : -val;
    }
    return score;
  };

  /* ---------------------------------------------------------- Suche */

  function mvvLva(s, m) {
    var victim = Math.abs(s.b[m.to]);
    var attacker = Math.abs(s.b[m.from]);
    if (m.ep) victim = P;
    if (!victim) return m.promo ? 800 : 0;
    return 1000 + victim * 10 - attacker;
  }

  function order(s, moves, best) {
    var scored = moves.map(function (m) {
      var v = mvvLva(s, m);
      if (best && m.from === best.from && m.to === best.to && m.promo === best.promo) v += 100000;
      return { m: m, v: v };
    });
    scored.sort(function (a, b) { return b.v - a.v; });
    return scored.map(function (x) { return x.m; });
  }

  function quiesce(s, alpha, beta, ctx) {
    ctx.nodes++;
    var stand = R.evaluate(s) * s.turn;
    if (stand >= beta) return beta;
    if (stand > alpha) alpha = stand;
    if (ctx.nodes > ctx.maxNodes) return alpha;

    var caps = R.pseudo(s, s.turn, true);
    caps = order(s, caps, null);
    for (var i = 0; i < caps.length; i++) {
      R.make(s, caps[i]);
      if (R.inCheck(s, -s.turn)) { R.unmake(s); continue; }
      var v = -quiesce(s, -beta, -alpha, ctx);
      R.unmake(s);
      if (v >= beta) return beta;
      if (v > alpha) alpha = v;
    }
    return alpha;
  }

  function negamax(s, depth, alpha, beta, ctx) {
    if (ctx.stop || ctx.nodes > ctx.maxNodes) { ctx.stop = true; return alpha; }
    ctx.nodes++;

    if (s.half >= 100) return 0;
    if (depth <= 0) return quiesce(s, alpha, beta, ctx);

    var moves = R.pseudo(s, s.turn);
    moves = order(s, moves, ctx.pv[depth]);
    var any = false;
    var bestMove = null;

    for (var i = 0; i < moves.length; i++) {
      R.make(s, moves[i]);
      if (R.inCheck(s, -s.turn)) { R.unmake(s); continue; }
      any = true;
      var v = -negamax(s, depth - 1, -beta, -alpha, ctx);
      R.unmake(s);
      if (ctx.stop) return alpha;
      if (v >= beta) {
        ctx.pv[depth] = moves[i];
        return beta;
      }
      if (v > alpha) { alpha = v; bestMove = moves[i]; }
    }

    if (!any) {
      return R.inCheck(s, s.turn) ? -30000 + (ctx.rootDepth - depth) : 0;
    }
    if (bestMove) ctx.pv[depth] = bestMove;
    return alpha;
  }

  /* Eine Suchtiefe komplett rechnen. Liefert {move, score, nodes}. */
  R.searchDepth = function (s, depth, maxNodes, prevBest) {
    var ctx = { nodes: 0, maxNodes: maxNodes || 400000, pv: [], stop: false, rootDepth: depth };
    var moves = R.legal(s, s.turn);
    if (!moves.length) return { move: null, score: 0, nodes: 0 };
    moves = order(s, moves, prevBest);

    var alpha = -Infinity, best = moves[0];
    for (var i = 0; i < moves.length; i++) {
      R.make(s, moves[i]);
      var v = -negamax(s, depth - 1, -Infinity, -alpha, ctx);
      R.unmake(s);
      if (ctx.stop) break;
      if (v > alpha) { alpha = v; best = moves[i]; }
    }
    return { move: best, score: alpha, nodes: ctx.nodes, stopped: ctx.stop };
  };

  /* Zeitscheibengesteuerte Suche: pro Bild eine Tiefe, dann zuruecklehnen. */
  R.think = function (s, opts, done) {
    opts = opts || {};
    var maxDepth = opts.depth || 4;
    var budget = opts.nodes || 120000;
    var cancelled = false;
    var d = 1;
    var best = null, score = 0, nodes = 0;
    var work = R.clone(s);

    function stepOnce() {
      if (cancelled) return;
      var res = R.searchDepth(work, d, budget, best);
      if (res.move) { best = res.move; score = res.score; }
      nodes += res.nodes || 0;
      d++;
      if (cancelled) return;
      if (d > maxDepth || res.stopped || Math.abs(score) > 25000) {
        done(best, { score: score, depth: d - 1, nodes: nodes });
        return;
      }
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(stepOnce);
      else setTimeout(stepOnce, 0);
    }
    if (typeof setTimeout === 'function') setTimeout(stepOnce, 0);
    else stepOnce();

    return { cancel: function () { cancelled = true; } };
  };

  /* Kleines Eroeffnungsbuch (Zugfolgen als Feldpaare) */
  var BOOK = {
    '': ['e2e4', 'd2d4', 'g1f3', 'c2c4'],
    'e2e4': ['e7e5', 'c7c5', 'e7e6', 'c7c6'],
    'e2e4 e7e5': ['g1f3'],
    'e2e4 e7e5 g1f3': ['b8c6', 'g8f6'],
    'e2e4 e7e5 g1f3 b8c6': ['f1b5', 'f1c4'],
    'e2e4 c7c5': ['g1f3'],
    'e2e4 c7c5 g1f3': ['d7d6', 'b8c6'],
    'd2d4': ['g8f6', 'd7d5'],
    'd2d4 d7d5': ['c2c4'],
    'd2d4 g8f6': ['c2c4'],
    'd2d4 g8f6 c2c4': ['e7e6', 'g7g6'],
    'g1f3': ['g8f6', 'd7d5'],
    'c2c4': ['e7e5', 'g8f6'],
  };

  R.bookMove = function (moveList, rng) {
    var key = moveList.join(' ');
    var opts = BOOK[key];
    if (!opts || !opts.length) return null;
    return opts[rng ? rng.int(opts.length) : 0];
  };

  R.uci = function (m) {
    return R.sqName(m.from) + R.sqName(m.to) + (m.promo ? 'dtlsn'[0] : '');
  };
  R.uciPlain = function (m) { return R.sqName(m.from) + R.sqName(m.to); };

  /* ==================================================================
     Spiel
     ================================================================== */

  var LEVELS = [
    { id: 1, name: 'Anfänger', depth: 1, nodes: 8000, blunder: 0.4 },
    { id: 2, name: 'Leicht', depth: 2, nodes: 25000, blunder: 0.18 },
    { id: 3, name: 'Mittel', depth: 3, nodes: 70000, blunder: 0.06 },
    { id: 4, name: 'Stark', depth: 4, nodes: 160000, blunder: 0 },
    { id: 5, name: 'Sehr stark', depth: 5, nodes: 400000, blunder: 0 },
  ];

  var LIGHT = '#e8dcc0', DARK = '#8a6a4a';

  function mount(host) {
    var store = host.store;
    var level = store.get('level', 3);

    var st = {
      s: null,
      mode: 'ai',
      mySide: 1,
      mySeat: 0,
      sel: -1,
      legalFor: [],
      lastMove: null,
      moveList: [],       // Kurznotation
      uciList: [],
      reps: {},
      over: null,
      thinking: false,
      flip: false,
      names: ['Weiß', 'Schwarz'],
      hint: null,
      anim: null,
    };
    var room = null, pill = null;
    var task = null;

    var stage = host.canvas({ alpha: false });
    var ctx = stage.ctx;

    var sTurn = host.stat('Am Zug', 'Weiß', 'gold');
    var sMode = host.stat('Gegner', '');
    var sInfo = host.stat('Züge', '0');

    host.tool('↺', function () { undoMove(); });
    host.tool('⇅', function () { st.flip = !st.flip; });
    host.menuTool([
      { icon: '🎮', label: 'Modus wechseln', onClick: chooseMode },
      { icon: '🤖', label: 'Spielstärke', desc: LEVELS[level - 1].name, onClick: chooseLevel },
      { icon: '♟', label: 'Neue Partie', onClick: function () { newGame(); } },
      { icon: '🧾', label: 'Zugliste', onClick: showMoves },
      { icon: '💡', label: 'Zugvorschlag', onClick: showHint },
      { icon: '?', label: 'Anleitung', onClick: function () { help(true); } },
    ]);

    /* ---------------------------------------------------------- Partie */

    function newGame() {
      if (task) { task.cancel(); task = null; }
      st.s = R.create();
      st.sel = -1;
      st.legalFor = [];
      st.lastMove = null;
      st.moveList = [];
      st.uciList = [];
      st.reps = {};
      st.reps[R.key(st.s)] = 1;
      st.over = null;
      st.thinking = false;
      st.hint = null;
      host.closeOverlay();
      syncBar();
      maybeAI();
    }

    function syncBar() {
      var s = st.s;
      if (!s) return;
      var side = s.turn > 0 ? 'Weiß' : 'Schwarz';
      if (st.over) sTurn.set(st.over.short);
      else sTurn.set(side + (R.inCheck(s, s.turn) ? ' (Schach)' : ''));
      sMode.set(st.mode === 'ai' ? LEVELS[level - 1].name
        : st.mode === 'local' ? 'zu zweit' : 'online');
      sInfo.set(String(Math.ceil(st.moveList.length / 2)));
    }

    function myTurn() {
      if (st.over) return false;
      if (st.mode === 'local') return true;
      if (st.mode === 'ai') return st.s.turn === st.mySide;
      return st.s.turn === st.mySide;
    }

    function doMove(m, fromNet) {
      var s = st.s;
      if (st.over) return;
      if (!fromNet && st.mode === 'online') {
        // Erst ziehen, dann melden - der eigene Zug soll nicht auf die
        // Antwort des Relais warten.
        room.send({ from: m.from, to: m.to, promo: m.promo || 0 });
      }
      applyMove(m);
    }

    function applyMove(m) {
      var s = st.s;
      var note = R.notation(s, m);
      st.moveList.push(note);
      st.uciList.push(R.uciPlain(m));
      var captured = s.b[m.to] !== 0 || m.ep;
      R.make(s, m);
      st.lastMove = m;
      st.sel = -1;
      st.legalFor = [];
      st.hint = null;

      var key = R.key(s);
      st.reps[key] = (st.reps[key] || 0) + 1;

      host.sfx(captured ? 'hit' : 'place');
      if (R.inCheck(s, s.turn)) { host.sfx('alert'); host.buzz(20); }

      checkEnd();
      syncBar();
      if (!st.over) maybeAI();
    }

    function checkEnd() {
      var s = st.s;
      var status = R.status(s, st.reps);
      if (!status) return;
      var loser = s.turn;
      if (status === 'matt') {
        st.over = {
          short: 'Matt',
          title: (loser > 0 ? 'Schwarz' : 'Weiß') + ' gewinnt',
          sub: 'Schachmatt in ' + Math.ceil(st.moveList.length / 2) + ' Zügen',
          won: st.mode === 'ai' ? loser !== st.mySide : true,
        };
        host.sfx('win');
      } else {
        var names = {
          patt: ['Patt', 'Der Spieler am Zug hat keinen Zug mehr, steht aber nicht im Schach.'],
          '50': ['50-Züge-Regel', '50 Züge ohne Schlag und ohne Bauernzug.'],
          wdh: ['Stellungswiederholung', 'Dieselbe Stellung ist dreimal aufgetreten.'],
          material: ['Ungenügendes Material', 'Mit diesen Figuren kann niemand mehr mattsetzen.'],
        }[status];
        st.over = { short: 'Remis', title: 'Remis — ' + names[0], sub: names[1], won: false };
        host.sfx('lose');
      }
      host.after(function () {
        if (!st.over) return;
        host.gameOver({
          won: st.over.won,
          title: st.over.title,
          sub: st.over.sub,
          againLabel: 'Neue Partie',
          onAgain: newGame,
          submit: false,
          extra: st.moveList.length ? UI.el('div.small.muted', {
            style: { marginBottom: '12px', maxHeight: '90px', overflowY: 'auto' },
            text: movesText(),
          }) : null,
        });
        if (st.over.won && st.mode === 'ai') host.stats('siege', 1);
      }, 700);
    }

    function maybeAI() {
      if (st.mode !== 'ai' || st.over) return;
      var s = st.s;
      if (s.turn === st.mySide) return;
      st.thinking = true;
      var lv = LEVELS[level - 1];
      var rng = U.rng((Date.now() ^ st.moveList.length * 7919) >>> 0);

      // Eroeffnungsbuch
      var bm = R.bookMove(st.uciList, rng);
      if (bm && st.uciList.length < 8) {
        var moves = R.legal(s, s.turn);
        for (var i = 0; i < moves.length; i++) {
          if (R.uciPlain(moves[i]) === bm) {
            host.after(function (mv) {
              return function () { st.thinking = false; applyMove(mv); };
            }(moves[i]), 320);
            return;
          }
        }
      }

      task = R.think(s, { depth: lv.depth, nodes: lv.nodes }, function (move, info) {
        task = null;
        st.thinking = false;
        if (!move || st.over) return;
        if (lv.blunder && rng() < lv.blunder) {
          var all = R.legal(s, s.turn);
          move = all[rng.int(all.length)];
        }
        applyMove(move);
      });
    }

    function undoMove() {
      if (st.thinking || !st.s.hist.length) return;
      var n = (st.mode === 'ai' && st.s.turn === st.mySide) ? 2 : 1;
      for (var i = 0; i < n && st.s.hist.length; i++) {
        var key = R.key(st.s);
        if (st.reps[key]) st.reps[key]--;
        R.unmake(st.s);
        st.moveList.pop();
        st.uciList.pop();
      }
      st.lastMove = null;
      st.over = null;
      st.sel = -1;
      host.closeOverlay();
      host.sfx('click');
      syncBar();
    }

    function showHint() {
      if (st.thinking || st.over) return;
      st.thinking = true;
      UI.toast('Suche einen guten Zug…', null, 1200);
      task = R.think(st.s, { depth: 4, nodes: 120000 }, function (move) {
        task = null;
        st.thinking = false;
        if (!move) return;
        st.hint = move;
        host.after(function () { st.hint = null; }, 3500);
      });
    }

    function movesText() {
      var out = [];
      for (var i = 0; i < st.moveList.length; i += 2) {
        out.push((i / 2 + 1) + '. ' + st.moveList[i] +
          (st.moveList[i + 1] ? ' ' + st.moveList[i + 1] : ''));
      }
      return out.join('   ');
    }

    function showMoves() {
      host.modal({
        title: 'Zugliste',
        body: st.moveList.length
          ? UI.el('div', { style: { fontFamily: 'var(--mono)', fontSize: '13px', lineHeight: '1.8' }, text: movesText() })
          : UI.el('p.muted', { text: 'Noch kein Zug gespielt.' }),
      });
    }

    /* ---------------------------------------------------------- Modus */

    function chooseMode() {
      SG.net.lobby(host, {
        game: 'chess', seats: 2, title: 'Schach',
        aiLabel: 'Gegen den Computer',
        aiDesc: LEVELS[level - 1].name,
      }).then(function (res) {
        if (!res) return;
        if (room) { room.leave(); room = null; }
        if (pill) { pill.destroy(); pill = null; }
        st.mode = res.mode;
        if (res.mode === 'online') {
          host.keepAwake(true);   // Bildschleife im Onlinespiel nicht bei Fokusverlust anhalten
          room = res.room;
          st.mySeat = room.seat;
          st.mySide = room.seat === 0 ? 1 : -1;
          st.flip = st.mySide < 0;
          pill = SG.net.pill(host.stage, room);
          room.on('actions', function (fresh) {
            fresh.forEach(function (x) {
              var a = x.a;
              if (st.s.turn !== (x.seat === 0 ? 1 : -1)) return;
              var moves = R.legal(st.s, st.s.turn);
              for (var i = 0; i < moves.length; i++) {
                var m = moves[i];
                if (m.from === a.from && m.to === a.to && (m.promo || 0) === (a.promo || 0)) {
                  applyMove(m);
                  return;
                }
              }
            });
          });
          room.on('players', function (ps) {
            st.names = [ps[0] ? ps[0].name : 'Weiß', ps[1] ? ps[1].name : 'Schwarz'];
            syncBar();
          });
        } else if (res.mode === 'local') {
          st.mySide = 1;
          st.flip = false;
          st.names = ['Weiß', 'Schwarz'];
        } else {
          st.mySide = 1;
          st.flip = false;
          st.names = ['Du', 'Computer'];
        }
        newGame();
      });
    }

    function chooseLevel() {
      var body = UI.el('div');
      LEVELS.forEach(function (l) {
        body.appendChild(UI.el('div.item.tap' + (l.id === level ? '.sel' : ''), {
          on: {
            click: function () {
              m.close();
              level = l.id;
              store.set('level', l.id);
              if (st.mode !== 'ai') { st.mode = 'ai'; st.names = ['Du', 'Computer']; }
              newGame();
            },
          },
        }, [
          UI.el('div.thumb', { text: '♞' }),
          UI.el('div.main', null, [
            UI.el('div.t', { text: l.name }),
            UI.el('div.d', { text: l.depth + ' Halbzüge tief' + (l.blunder ? ' · macht Fehler' : '') }),
          ]),
        ]));
      });
      var m = host.modal({ title: 'Spielstärke', body: body });
    }

    /* ---------------------------------------------------------- Zeichnen */

    var L = { x: 0, y: 0, cell: 50 };

    function relayout(w, h) {
      var pad = 10;
      var size = Math.min(w - pad * 2, h - pad * 2);
      L.cell = Math.floor(size / 8);
      L.x = Math.round((w - L.cell * 8) / 2);
      L.y = Math.round((h - L.cell * 8) / 2);
    }
    stage.onResize = relayout;

    function viewSq(s) {
      return st.flip ? 63 - s : s;
    }
    function sqAt(x, y) {
      var f = Math.floor((x - L.x) / L.cell);
      var r = Math.floor((y - L.y) / L.cell);
      if (f < 0 || r < 0 || f > 7 || r > 7) return -1;
      var v = r * 8 + f;
      return st.flip ? 63 - v : v;
    }
    function sqPos(s) {
      var v = st.flip ? 63 - s : s;
      return { x: L.x + fileOf(v) * L.cell, y: L.y + rankOf(v) * L.cell };
    }

    /* Figuren aus Grundformen - keine Schriftart, keine Bilder */
    function drawPiece(x, y, size, piece) {
      var white = piece > 0;
      var t = Math.abs(piece);
      var fill = white ? '#f6f2e8' : '#26282f';
      var line = white ? '#8d8677' : '#0d0e12';
      var cx = x + size / 2, cy = y + size / 2;
      var u = size / 100;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.lineWidth = Math.max(1, 2.4 * u);
      ctx.strokeStyle = line;
      ctx.fillStyle = fill;
      ctx.lineJoin = 'round';

      function base(w) {
        ctx.beginPath();
        ctx.moveTo(-w, 34 * u);
        ctx.lineTo(w, 34 * u);
        ctx.lineTo(w * 0.82, 26 * u);
        ctx.lineTo(-w * 0.82, 26 * u);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
      }

      if (t === P) {
        ctx.beginPath();
        ctx.arc(0, -14 * u, 11 * u, 0, 6.283);
        ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-7 * u, -4 * u);
        ctx.quadraticCurveTo(-16 * u, 18 * u, -20 * u, 26 * u);
        ctx.lineTo(20 * u, 26 * u);
        ctx.quadraticCurveTo(16 * u, 18 * u, 7 * u, -4 * u);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        base(24 * u);
      } else if (t === RO) {
        ctx.beginPath();
        ctx.moveTo(-24 * u, -30 * u); ctx.lineTo(-24 * u, -18 * u);
        ctx.lineTo(-14 * u, -18 * u); ctx.lineTo(-14 * u, -26 * u);
        ctx.lineTo(-6 * u, -26 * u); ctx.lineTo(-6 * u, -18 * u);
        ctx.lineTo(6 * u, -18 * u); ctx.lineTo(6 * u, -26 * u);
        ctx.lineTo(14 * u, -26 * u); ctx.lineTo(14 * u, -18 * u);
        ctx.lineTo(24 * u, -18 * u); ctx.lineTo(24 * u, -30 * u);
        ctx.lineTo(24 * u, -30 * u);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-17 * u, -18 * u); ctx.lineTo(-13 * u, 22 * u);
        ctx.lineTo(13 * u, 22 * u); ctx.lineTo(17 * u, -18 * u);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        base(26 * u);
      } else if (t === N) {
        ctx.beginPath();
        ctx.moveTo(-16 * u, 26 * u);
        ctx.quadraticCurveTo(-20 * u, 0, -8 * u, -12 * u);
        ctx.quadraticCurveTo(-14 * u, -18 * u, -10 * u, -28 * u);
        ctx.quadraticCurveTo(-2 * u, -22 * u, 4 * u, -30 * u);
        ctx.quadraticCurveTo(22 * u, -20 * u, 20 * u, 4 * u);
        ctx.quadraticCurveTo(19 * u, 18 * u, 18 * u, 26 * u);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.arc(6 * u, -16 * u, 2.6 * u, 0, 6.283);
        ctx.fillStyle = line; ctx.fill();
        base(24 * u);
      } else if (t === B) {
        ctx.beginPath();
        ctx.arc(0, -26 * u, 5 * u, 0, 6.283);
        ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -22 * u);
        ctx.quadraticCurveTo(-18 * u, -8 * u, -14 * u, 12 * u);
        ctx.lineTo(14 * u, 12 * u);
        ctx.quadraticCurveTo(18 * u, -8 * u, 0, -22 * u);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-4 * u, -12 * u); ctx.lineTo(4 * u, -12 * u);
        ctx.moveTo(0, -16 * u); ctx.lineTo(0, -8 * u);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-16 * u, 12 * u); ctx.lineTo(16 * u, 12 * u);
        ctx.lineTo(13 * u, 24 * u); ctx.lineTo(-13 * u, 24 * u);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        base(24 * u);
      } else if (t === Q) {
        ctx.beginPath();
        ctx.moveTo(-24 * u, -14 * u);
        ctx.lineTo(-16 * u, 10 * u);
        ctx.lineTo(16 * u, 10 * u);
        ctx.lineTo(24 * u, -14 * u);
        ctx.lineTo(14 * u, -4 * u);
        ctx.lineTo(8 * u, -22 * u);
        ctx.lineTo(0, -6 * u);
        ctx.lineTo(-8 * u, -22 * u);
        ctx.lineTo(-14 * u, -4 * u);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        [-24, -8, 8, 24].forEach(function (px) {
          ctx.beginPath();
          ctx.arc(px * u, -18 * u, 4 * u, 0, 6.283);
          ctx.fill(); ctx.stroke();
        });
        ctx.beginPath();
        ctx.moveTo(-18 * u, 10 * u); ctx.lineTo(18 * u, 10 * u);
        ctx.lineTo(15 * u, 24 * u); ctx.lineTo(-15 * u, 24 * u);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        base(26 * u);
      } else {
        // Koenig
        ctx.beginPath();
        ctx.moveTo(0, -34 * u); ctx.lineTo(0, -20 * u);
        ctx.moveTo(-6 * u, -28 * u); ctx.lineTo(6 * u, -28 * u);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-20 * u, 10 * u);
        ctx.quadraticCurveTo(-24 * u, -14 * u, 0, -18 * u);
        ctx.quadraticCurveTo(24 * u, -14 * u, 20 * u, 10 * u);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-18 * u, 10 * u); ctx.lineTo(18 * u, 10 * u);
        ctx.lineTo(15 * u, 24 * u); ctx.lineTo(-15 * u, 24 * u);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        base(26 * u);
      }
      ctx.restore();
    }

    function draw() {
      var w = stage.w, h = stage.h;
      var s = st.s;
      if (!L.cell) relayout(w, h);
      ctx.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0);
      ctx.fillStyle = '#0b0e15';
      ctx.fillRect(0, 0, w, h);
      if (!s) return;

      var c = L.cell;
      G.fillRound(ctx, L.x - 7, L.y - 7, c * 8 + 14, c * 8 + 14, 8, '#3a2c1e');

      for (var i = 0; i < 64; i++) {
        var p = sqPos(i);
        var dark = (fileOf(i) + rankOf(i)) % 2 === 1;
        ctx.fillStyle = dark ? DARK : LIGHT;
        ctx.fillRect(p.x, p.y, c, c);
      }

      // Letzter Zug
      if (st.lastMove) {
        [st.lastMove.from, st.lastMove.to].forEach(function (q) {
          var pp = sqPos(q);
          ctx.fillStyle = 'rgba(240,180,41,.32)';
          ctx.fillRect(pp.x, pp.y, c, c);
        });
      }
      // Schach markieren
      if (R.inCheck(s, s.turn)) {
        var ks = R.kingSquare(s, s.turn);
        var kp = sqPos(ks);
        ctx.fillStyle = 'rgba(255,95,107,.45)';
        ctx.fillRect(kp.x, kp.y, c, c);
      }
      // Auswahl
      if (st.sel >= 0) {
        var sp = sqPos(st.sel);
        ctx.fillStyle = 'rgba(74,163,255,.35)';
        ctx.fillRect(sp.x, sp.y, c, c);
      }
      // Zugvorschlag
      if (st.hint) {
        [st.hint.from, st.hint.to].forEach(function (q) {
          var pp = sqPos(q);
          G.strokeRound(ctx, pp.x + 2, pp.y + 2, c - 4, c - 4, 4, '#3ddc84', 3);
        });
      }

      // Koordinaten
      for (i = 0; i < 8; i++) {
        var fx = L.x + i * c;
        var lbl = st.flip ? 'hgfedcba'[i] : 'abcdefgh'[i];
        G.text(ctx, lbl, fx + c - 4, L.y + c * 8 - 3, {
          size: Math.max(8, c * 0.18), weight: 700,
          color: (i % 2 === 1) ? 'rgba(0,0,0,.35)' : 'rgba(255,255,255,.5)',
          align: 'right', baseline: 'bottom',
        });
        var num = st.flip ? String(i + 1) : String(8 - i);
        G.text(ctx, num, L.x + 3, L.y + i * c + 3, {
          size: Math.max(8, c * 0.18), weight: 700,
          color: (i % 2 === 0) ? 'rgba(0,0,0,.35)' : 'rgba(255,255,255,.5)',
          align: 'left', baseline: 'top',
        });
      }

      // Zugziele
      for (i = 0; i < st.legalFor.length; i++) {
        var m = st.legalFor[i];
        var mp = sqPos(m.to);
        if (s.b[m.to] !== 0 || m.ep) {
          G.ring(ctx, mp.x + c / 2, mp.y + c / 2, c * 0.42, c * 0.07, 'rgba(30,40,60,.45)');
        } else {
          G.circle(ctx, mp.x + c / 2, mp.y + c / 2, c * 0.16, 'rgba(30,40,60,.4)');
        }
      }

      // Figuren
      for (i = 0; i < 64; i++) {
        var pc = s.b[i];
        if (!pc) continue;
        var q2 = sqPos(i);
        drawPiece(q2.x, q2.y, c, pc);
      }

      if (st.thinking) {
        G.fillRound(ctx, w / 2 - 80, 6, 160, 22, 11, 'rgba(11,14,21,.85)');
        G.text(ctx, 'Computer rechnet…', w / 2, 17, {
          size: 12, weight: 650, color: '#c8d4ea', align: 'center', baseline: 'middle',
        });
      }
    }

    /* ---------------------------------------------------------- Eingabe */

    var loop = host.loop({ hz: 30, update: function () {}, render: draw });

    function pick(square) {
      var s = st.s;
      if (st.over || st.thinking) return;
      if (!myTurn()) return;

      // Zug ausfuehren?
      for (var i = 0; i < st.legalFor.length; i++) {
        if (st.legalFor[i].to === square) {
          var cands = st.legalFor.filter(function (m) { return m.to === square; });
          if (cands.length > 1 && cands[0].promo) { askPromotion(cands); return; }
          doMove(cands[0]);
          return;
        }
      }

      var pc = s.b[square];
      if (pc && (pc > 0) === (s.turn > 0)) {
        st.sel = square;
        st.legalFor = R.legal(s, s.turn).filter(function (m) { return m.from === square; });
        host.sfx('tick');
      } else {
        st.sel = -1;
        st.legalFor = [];
      }
    }

    function askPromotion(cands) {
      var body = UI.el('div.row', { style: { justifyContent: 'center', gap: '10px' } });
      [Q, RO, B, N].forEach(function (t) {
        var m = cands.filter(function (x) { return x.promo === t; })[0];
        if (!m) return;
        var cv = UI.el('canvas', { width: 64, height: 64, style: { width: '64px', height: '64px' } });
        var cc = cv.getContext('2d');
        var save = ctx;
        // Vorschau in eigenes Canvas zeichnen
        var tmpCtx = cc;
        (function () {
          var old = ctx;
          ctx = tmpCtx;
          ctx.fillStyle = '#e8dcc0';
          ctx.fillRect(0, 0, 64, 64);
          drawPiece(0, 0, 64, st.s.turn * t);
          ctx = old;
        })();
        body.appendChild(UI.el('button', {
          style: { border: '2px solid var(--line)', borderRadius: '8px', overflow: 'hidden' },
          on: { click: function () { mo.close(); doMove(m); } },
        }, [cv]));
      });
      var mo = host.modal({ title: 'Umwandeln in', body: body, closable: false });
    }

    host.input({
      onTap: function (x, y) {
        var q = sqAt(x, y);
        if (q >= 0) pick(q);
      },
    });

    function help(force) {
      SG.tutorial.show({
        id: 'chess', force: force, parent: host.root, title: 'Schach',
        pages: [{
          kicker: 'Schach', title: 'Alle Regeln sind drin',
          art: SG.tutorial.art.tap,
          body: [
            { ic: '👆', text: 'Figur antippen, dann auf ein markiertes Feld tippen. Mögliche Züge werden als Punkte gezeigt.' },
            { ic: '♜', text: '<b>Rochade</b>, <b>En passant</b> und <b>Umwandlung</b> sind vollständig umgesetzt — bei der Umwandlung fragt das Spiel nach der Figur.' },
            { ic: '½', text: 'Remis erkennt das Spiel automatisch: Patt, 50-Züge-Regel, dreifache Stellungswiederholung und ungenügendes Material.' },
            { ic: '💡', text: 'Im Menü gibt es einen <b>Zugvorschlag</b>. ↺ nimmt Züge zurück, ⇅ dreht das Brett.' },
            { ic: '🤖', text: 'Fünf Spielstärken. Die stärkste rechnet fünf Halbzüge tief plus Ruhesuche.' },
          ],
        }],
      });
    }

    newGame();
    loop.start();
    help(false);

    return {
      state: st,
      destroy: function () {
        if (task) task.cancel();
        if (room) room.leave();
        if (pill) pill.destroy();
      },
      selftest: function () {
        // Perft aus der Grundstellung
        var s = R.create();
        var expect = [1, 20, 400, 8902];
        for (var d = 1; d <= 3; d++) {
          var n = R.perft(s, d);
          if (n !== expect[d]) {
            throw new Error('Perft(' + d + ') = ' + n + ', erwartet ' + expect[d]);
          }
        }

        // Rochade
        var s2 = R.create();
        ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5'].forEach(function (u) {
          var ms = R.legal(s2, s2.turn);
          for (var i = 0; i < ms.length; i++) {
            if (R.uciPlain(ms[i]) === u) { R.make(s2, ms[i]); return; }
          }
          throw new Error('Zug ' + u + ' nicht gefunden');
        });
        var castle = R.legal(s2, 1).filter(function (m) { return m.castle === 'K'; });
        if (!castle.length) throw new Error('Kurze Rochade fehlt');

        // Schachmatt (Narrenmatt)
        var s3 = R.create();
        ['f2f3', 'e7e5', 'g2g4', 'd8h4'].forEach(function (u) {
          var ms = R.legal(s3, s3.turn);
          for (var i = 0; i < ms.length; i++) {
            if (R.uciPlain(ms[i]) === u) { R.make(s3, ms[i]); return; }
          }
          throw new Error('Zug ' + u + ' nicht gefunden');
        });
        if (R.status(s3) !== 'matt') throw new Error('Narrenmatt nicht erkannt');

        // Ungenuegendes Material
        var s4 = R.create();
        s4.b.fill(0);
        s4.b[R.sq(4, 7)] = K;
        s4.b[R.sq(4, 0)] = -K;
        if (!R.insufficient(s4)) throw new Error('K gegen K muss remis sein');
        s4.b[R.sq(0, 7)] = RO;
        if (R.insufficient(s4)) throw new Error('Turm reicht zum Mattsetzen');

        // Suche findet Matt in einem Zug: Turm a1, Dame b7, König h8 -> Ta8#
        var s5 = R.create();
        s5.b.fill(0);
        s5.b[R.sq(7, 0)] = -K;      // h8
        s5.b[R.sq(1, 1)] = Q;       // b7 deckt die siebte Reihe
        s5.b[R.sq(0, 7)] = RO;      // a1
        s5.b[R.sq(4, 7)] = K;       // e1
        s5.cast = { K: false, Q: false, k: false, q: false };
        s5.turn = 1;
        var res = R.searchDepth(s5, 3, 200000, null);
        if (!res.move) throw new Error('Suche liefert keinen Zug');
        R.make(s5, res.move);
        if (R.status(s5) !== 'matt') {
          throw new Error('Suche findet das Matt nicht (' + R.uciPlain(res.move) + ')');
        }

        newGame();
        draw();
      },
    };
  }

  SG.register({
    id: 'chess',
    name: 'Schach',
    category: 'karten',
    online: true,
    desc: 'Volle Regeln, fünf Spielstärken',
    tags: ['schach', 'chess', 'brett', 'mehrspieler', 'denken'],
    preview: function (c, w, h) {
      var size = Math.min(w, h) * 0.92;
      var cell = size / 8;
      var x0 = (w - size) / 2, y0 = (h - size) / 2;
      G.fillRound(c, x0 - 4, y0 - 4, size + 8, size + 8, 5, '#3a2c1e');
      for (var i = 0; i < 64; i++) {
        var f = i % 8, r = Math.floor(i / 8);
        c.fillStyle = (f + r) % 2 ? DARK : LIGHT;
        c.fillRect(x0 + f * cell, y0 + r * cell, cell, cell);
      }
      // Ein paar Figuren als Silhouetten
      var setup = [
        [4, 0, -6], [3, 0, -5], [0, 0, -4], [6, 1, -1], [4, 1, -1],
        [4, 7, 6], [3, 7, 5], [7, 7, 4], [2, 6, 1], [5, 6, 1], [3, 4, 1],
      ];
      setup.forEach(function (s) {
        var px = x0 + s[0] * cell + cell / 2, py = y0 + s[1] * cell + cell / 2;
        var white = s[2] > 0;
        c.fillStyle = white ? '#f6f2e8' : '#26282f';
        c.strokeStyle = white ? '#8d8677' : '#0d0e12';
        c.lineWidth = Math.max(0.8, cell * 0.05);
        var t = Math.abs(s[2]);
        var rr = cell * (t === 1 ? 0.18 : t === 6 ? 0.3 : 0.24);
        c.beginPath();
        c.arc(px, py - cell * 0.06, rr, 0, 6.283);
        c.fill(); c.stroke();
        c.beginPath();
        c.moveTo(px - cell * 0.28, py + cell * 0.34);
        c.lineTo(px + cell * 0.28, py + cell * 0.34);
        c.lineTo(px + cell * 0.16, py + cell * 0.06);
        c.lineTo(px - cell * 0.16, py + cell * 0.06);
        c.closePath();
        c.fill(); c.stroke();
      });
    },
    mount: mount,
  });
})(SG);
