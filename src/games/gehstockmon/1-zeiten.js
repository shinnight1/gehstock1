/* Ein Kalender für Server und Anzeige: deutsche Ortszeit, auch bei Zeitumstellung. */
(function (SG) {
  var H = SG.gehstockmon.zeiten = {}, DAY = 86400000, HOUR = 3600000;
  H.ZONE = 'Europe/Berlin';
  H.CLOSE = [0, 13, 13, 14, 15, 13, 0];
  H.LABELS = ['Montag · 7–13 Uhr', 'Dienstag · 7–13 Uhr', 'Mittwoch · 7–14 Uhr', 'Donnerstag · 7–15 Uhr', 'Freitag · 7–13 Uhr', 'Samstag & Sonntag · geschlossen'];
  // Erstes Wochenende dieser Regel; alte Spielstände bekommen keine rückwirkenden Monate.
  H.REWARDS_START = Date.parse('2026-09-12T00:00:00+02:00');
  var parts = new Intl.DateTimeFormat('en-GB', { timeZone: H.ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  function local(t) { var p = {}; parts.formatToParts(new Date(t)).forEach(function (v) { if (v.type !== 'literal') p[v.type] = Number(v.value); }); return p; }
  function mod(n, d) { return ((n % d) + d) % d; }
  H.day = function (t) { var p = local(t); return Date.UTC(p.year, p.month - 1, p.day) / DAY; };
  H.weekday = function (d) { return new Date(d * DAY).getUTCDay(); };
  H.at = function (d, hour) {
    var wall = d * DAY + hour * HOUR, t = wall;
    for (var i = 0; i < 2; i++) { var p = local(t); t += wall - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second); }
    return t;
  };
  H.access = function (t) {
    var d = H.day(t), close = H.CLOSE[H.weekday(d)], open = !!close && t >= H.at(d, 7) && t < H.at(d, close), next = null;
    for (var i = 0; i <= 7; i++) if (H.CLOSE[H.weekday(d + i)] && H.at(d + i, 7) > t) { next = H.at(d + i, 7); break; }
    return { open: open, serverTime: t, timeZone: H.ZONE, closesAt: open ? H.at(d, close) : null, nextOpenAt: next };
  };
  // Nur geöffnete Stunden zählen; ganze Wochen werden ohne Tages-Schleife addiert.
  H.openTime = function(t){var d=H.day(t),monday=d-((H.weekday(d)+6)%7),total=Math.floor(monday/7)*33*HOUR;
    for(var day=monday;day<=d;day++){var close=H.CLOSE[H.weekday(day)];if(close)total+=Math.max(0,Math.min(t,H.at(day,close))-H.at(day,7));}return total;};
  H.format = function (t) { return new Intl.DateTimeFormat('de-DE', { timeZone: H.ZONE, weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(t)); };
  // Virtuelle Produktionszeit lässt Samstag und Sonntag aus. Die Zeitumstellung
  // liegt ebenfalls am Sonntag und verändert daher keine Eier-Produktionsstunde.
  H.productionTime = function (t) { var d = H.day(t), weekday = mod(d + 3, 7); return (Math.floor((d + 3) / 7) * 5 + Math.min(weekday, 5)) * DAY + (weekday < 5 ? t - H.at(d, 0) : 0); };
  H.productionAt = function (v) { var days = Math.floor(v / DAY), d = Math.floor(days / 5) * 7 + mod(days, 5) - 3; return H.at(d, 0) + mod(v, DAY); };
  H.weekends = function (since, until) {
    since = Math.max(since, H.REWARDS_START); if (until <= since) return { count: 0, through: since };
    var day = H.day(since), saturday = day + mod(6 - H.weekday(day), 7);
    if (H.at(saturday, 0) < since) saturday += 7;
    var count = Math.max(0, Math.floor((H.day(until) - saturday - 2) / 7) + 1);
    return { count: count, through: count ? H.at(saturday + 2 + (count - 1) * 7, 0) : since };
  };
})(SG);
