/* ------------------------------------------------------------------
   Bestwerte, Statistiken, Favoriten, "zuletzt gespielt".
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var store = SG.storage;

  var S = SG.scores = {};

  function key(id) { return 'score:' + id; }

  /* Waehrend des Selbsttests wird nichts geschrieben - sonst stünden
     nach einem Testlauf erfundene Rekorde in der Liste. */
  function locked() {
    return !!(SG.selftest && SG.selftest.active);
  }

  function load(id) {
    return store.get(key(id), { best: {}, plays: 0, last: 0, stats: {} });
  }
  function save(id, rec) { if (locked()) return; store.set(key(id), rec); }

  /* Bester Wert eines Modus. mode ist frei waehlbar ("4x4", "leicht" ...) */
  S.best = function (id, mode) {
    var r = load(id);
    var v = r.best[mode || 'std'];
    return v === undefined ? null : v;
  };

  S.allBest = function (id) { return load(id).best || {}; };

  /* Traegt einen Wert ein. higher=false, wenn kleiner besser ist (Zeiten). */
  S.submit = function (id, value, o) {
    o = o || {};
    if (typeof value !== 'number' || !isFinite(value)) return { isBest: false, best: null };
    var mode = o.mode || 'std';
    var higher = o.higher !== false;
    var r = load(id);
    var cur = r.best[mode];
    var isBest = cur === undefined || (higher ? value > cur : value < cur);
    if (isBest) r.best[mode] = value;
    r.last = Date.now();
    save(id, r);
    return { isBest: isBest, best: r.best[mode] };
  };

  S.markPlayed = function (id) {
    if (locked()) return;
    var r = load(id);
    r.plays = (r.plays || 0) + 1;
    r.last = Date.now();
    save(id, r);
    var rec = store.get('recent', []);
    U.remove(rec, id);
    rec.unshift(id);
    if (rec.length > 12) rec.length = 12;
    store.set('recent', rec);
  };

  S.plays = function (id) { return load(id).plays || 0; };
  S.lastPlayed = function (id) { return load(id).last || 0; };

  /* Freie Zaehler, z. B. gewonnene Partien */
  S.stat = function (id, k, delta) {
    var r = load(id);
    r.stats = r.stats || {};
    if (delta === undefined) return r.stats[k] || 0;
    r.stats[k] = (r.stats[k] || 0) + delta;
    save(id, r);
    return r.stats[k];
  };
  S.setStat = function (id, k, v) {
    var r = load(id);
    r.stats = r.stats || {};
    r.stats[k] = v;
    save(id, r);
    return v;
  };
  S.stats = function (id) { return load(id).stats || {}; };

  S.recent = function () {
    return store.get('recent', []).filter(function (id) { return !!SG.games[id]; });
  };

  S.favorites = function () {
    return store.get('favs', []).filter(function (id) { return !!SG.games[id]; });
  };

  S.isFav = function (id) { return S.favorites().indexOf(id) >= 0; };

  S.toggleFav = function (id) {
    var f = store.get('favs', []);
    if (f.indexOf(id) >= 0) U.remove(f, id);
    else f.unshift(id);
    if (f.length > 40) f.length = 40;
    store.set('favs', f);
    return f.indexOf(id) >= 0;
  };

  S.reset = function (id) { store.del(key(id)); };

  S.resetAll = function () {
    Object.keys(SG.games).forEach(function (id) { store.del(key(id)); });
    store.del('recent');
  };

  /* Formatierte Anzeige fuer die Kachel */
  S.label = function (id) {
    var def = SG.games[id];
    if (!def || !def.scoreLabel) {
      var b = S.best(id);
      return b === null ? null : U.num(b);
    }
    return def.scoreLabel(S.allBest(id), S.stats(id));
  };
})(SG);
