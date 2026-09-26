/* ------------------------------------------------------------------
   Das Live-Duell: zwei Spieler, die gerade auf der Insel sind, kaempfen
   mit ihren Kampfteams Zug um Zug gegeneinander.

   Beide waehlen gleichzeitig; erst wenn beide gewaehlt haben (oder die
   Zeit abgelaufen ist), rechnet der Server die Runde. Es gelten dieselben
   Treffer, Faehigkeiten und Rollen wie in der Arena - ohne Zuschlaege,
   ohne Plan, ohne Ausbaustufen: nur die beiden Truppen.

   Laeuft im Browser und auf dem Server, darum ohne DOM.
   ------------------------------------------------------------------ */
(function (SG) {
  var R = SG.gehstockmon, A = R.arena, X = R.abenteuer;
  X.DUELL_OPS = ['duell_fordern', 'duell_antwort', 'duell_zug', 'duell_aufgeben'];
  X.SPIELZUEGE.push.apply(X.SPIELZUEGE, X.DUELL_OPS);
  X.DUELL = { einladung: 60000, runde: 30000, verpasstMax: 3, rundenMax: 60,
    lohn: { sieg: 30, trost: 10, patt: 15 }, ruhm: 20, nachlauf: 10 * 60000 };

  function lebt(u) { return !!u && u.hp > 0; }
  function ersatzNoetig(s, seite) { return !lebt(s.teams[seite][s.active[seite]]) && s.teams[seite].some(lebt); }

  A.duellStart = function (teamA, teamB, now) {
    var s = A.create(teamA, teamB, { id: 'duell', now: now });
    s.phase = 'kampf'; s.warten = ['choose', 'choose']; s.aktionen = [null, null]; s.verpasst = [0, 0]; s.verlauf = [];
    return s;
  };
  /* Darf diese Seite gerade diesen Zug machen? */
  A.duellGueltig = function (s, seite, aktion) {
    if (!s || !aktion || typeof aktion !== 'object') return false;
    var team = s.teams[seite], wahl = s.warten[seite];
    if (aktion.kind === 'switch') return (wahl === 'choose' || wahl === 'replace') && Number.isInteger(aktion.slot)
      && lebt(team[aktion.slot]) && aktion.slot !== s.active[seite];
    if (wahl !== 'choose' || aktion.kind !== 'move') return false;
    var zug = A.moves(team[s.active[seite]], s.round).find(function (m) { return m.id === aktion.move; });
    return !!(zug && zug.enabled);
  };
  /* Eine Runde rechnen. Fehlt eine Aktion, geht das Mon in Deckung (oder
     beim Ersatz wird das erste kampffaehige geschickt). */
  A.duellRunde = function (original, aktionen) {
    var s = JSON.parse(JSON.stringify(original)), I = A.intern;
    s.events = [];
    var ersatz = s.warten[0] === 'replace' || s.warten[1] === 'replace';
    if (ersatz) {
      [0, 1].forEach(function (seite) {
        if (s.warten[seite] !== 'replace') return;
        var a = aktionen[seite], slot = a && a.kind === 'switch' && lebt(s.teams[seite][a.slot]) ? a.slot : s.teams[seite].findIndex(lebt);
        s.active[seite] = slot;
        I.record(s, s.teams[seite][slot].name + ' wird in die Arena geschickt.', s.teams[seite][slot], null, 0, 'send');
      });
    } else {
      var zuege = [0, 1].map(function (seite) {
        var a = aktionen[seite];
        if (a && a.kind === 'switch' && A.duellGueltig(s, seite, a)) {
          s.teams[seite][s.active[seite]].shield = 0; s.active[seite] = a.slot;
          I.record(s, s.teams[seite][a.slot].name + ' wird in die Arena geschickt.', s.teams[seite][a.slot], null, 0, 'send');
          return null;
        }
        return a && a.kind === 'move' && A.duellGueltig(s, seite, a) ? a.move : 'guard';
      });
      /* Deckung zuerst, dann das schnellere Mon; bei gleichem Tempo wechselt
         der Vortritt jede Runde, damit keine Seite immer vorn ist. */
      var reihe = [0, 1].filter(function (seite) { return zuege[seite]; }).sort(function (x, y) {
        var dx = zuege[x] === 'guard' ? 1 : 0, dy = zuege[y] === 'guard' ? 1 : 0;
        if (dx !== dy) return dy - dx;
        var vx = s.teams[x][s.active[x]].speed, vy = s.teams[y][s.active[y]].speed;
        if (vx !== vy) return vy - vx;
        return s.round % 2 === 1 ? x - y : y - x;
      });
      var wer = [s.teams[0][s.active[0]].uid, s.teams[1][s.active[1]].uid];
      reihe.forEach(function (seite) {
        var ich = s.teams[seite][s.active[seite]], gegner = s.teams[1 - seite][s.active[1 - seite]];
        if (lebt(ich) && lebt(gegner) && ich.uid === wer[seite]) I.attack(s, seite, zuege[seite]);
      });
      [0, 1].forEach(function (seite) {
        var u = s.teams[seite][s.active[seite]];
        if (!lebt(u)) I.record(s, u.name + ' ist kampfunfähig.', u, null, 0, 'faint');
      });
      s.round++;
    }
    var lebtA = s.teams[0].some(lebt), lebtB = s.teams[1].some(lebt);
    if (!lebtA || !lebtB) { s.phase = 'ende'; s.winner = lebtA ? 0 : lebtB ? 1 : 'patt'; }
    else if (s.round > X.DUELL.rundenMax) { s.phase = 'ende'; s.winner = 'patt'; I.record(s, 'Nach ' + X.DUELL.rundenMax + ' Runden steht es unentschieden.'); }
    else {
      var fehlt = [ersatzNoetig(s, 0), ersatzNoetig(s, 1)];
      s.warten = fehlt[0] || fehlt[1] ? fehlt.map(function (f) { return f ? 'replace' : null; }) : ['choose', 'choose'];
    }
    s.aktionen = [null, null];
    s.verlauf = (original.verlauf || []).concat(s.events.map(function (e) { return e.text; })).slice(-120);
    s.revision++;
    return s;
  };
})(SG);
