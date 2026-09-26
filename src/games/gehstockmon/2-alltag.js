/* ------------------------------------------------------------------
   GehstockMon - der Alltag auf der Insel.

   Was jeden Schultag wiederkommt: Garantie-Zaehler und schimmernde Mons,
   die Tagesaufgaben mit ihrer Serie, die Revanche und der Insel-Ticker.
   Laeuft im Browser und auf dem Server (build.mjs haengt die Datei an die
   gemeinsamen Regeln), darum ohne DOM.

   Die Datei laedt im Browser vor 2-arena.js - sie darf die Arena erst in
   Funktionen ansprechen, nicht beim Laden.
   ------------------------------------------------------------------ */
(function (SG) {
  var R = SG.gehstockmon, D = R.daten, E = R.wirtschaft, H = R.zeiten, X = R.abenteuer;

  /* ----------------------------------------------------------------
     Tagesaufgaben

     Jeden Schultag drei Aufgaben, fuer alle dieselben - dann redet die
     Klasse ueber dieselben Dinge ("hast du schon die zwei Trainer?"). Wer
     alle drei schafft, oeffnet die Tagestruhe. Es stehen nur Aufgaben zur
     Wahl, die man allein und an jedem Tag schaffen kann: kein Duell (dafuer
     braucht es jemanden, der gerade da ist) und kein Zerhacker (der kann
     schon erlegt sein).
     ---------------------------------------------------------------- */
  X.TAGESAUFGABEN = [
    { id: 'trainer',  ziel: 2, text: 'Besiege zwei Wandertrainer' },
    { id: 'rune',     ziel: 3, text: 'Sammle drei verlorene Runen' },
    { id: 'ei',       ziel: 1, text: 'Brüte ein Ei aus' },
    { id: 'arena',    ziel: 1, text: 'Gewinne einen Kampf in der Großen Arena' },
    { id: 'dungeon',  ziel: 1, text: 'Besiege einen Dungeon-Boss' },
    { id: 'erkunden', ziel: 2, text: 'Erkunde zwei verschiedene Biome' }
  ];
  X.ALLTAG_OPS = ['tagestruhe'];
  X.SPIELZUEGE.push.apply(X.SPIELZUEGE, X.ALLTAG_OPS);
  /* Die drei Aufgaben eines Tages: aus dem Datum gezogen, also ueberall
     dieselben, ohne dass sie irgendwo gespeichert werden muessen. */
  X.tagesaufgaben = function (now) {
    var saat = (Math.imul(H.day(now), 2654435761) >>> 0) || 1, pool = X.TAGESAUFGABEN.slice(), out = [];
    while (out.length < 3) { saat = (Math.imul(saat, 1664525) + 1013904223) >>> 0; out.push(pool.splice(saat % pool.length, 1)[0]); }
    return out;
  };
  /* Der Stand des heutigen Tages - an einem neuen Tag faengt er leer an. */
  X.alltagStand = function (p, now) {
    var tag = H.day(now), a = p && p.alltag;
    if (!a || a.tag !== tag) return { tag: tag, zaehler: {}, erkundet: [], truhe: false };
    return a;
  };
  /* Zaehlt einen Schritt. Beim Erkunden zaehlt jedes Biom nur einmal. */
  X.alltagSchritt = function (p, art, now, wert) {
    if (!p) return null;
    var a = X.alltagStand(p, now);
    if (art === 'erkunden') {
      if (a.erkundet.indexOf(wert) < 0) a.erkundet.push(wert);
      a.zaehler.erkunden = a.erkundet.length;
    } else a.zaehler[art] = (a.zaehler[art] || 0) + (Number.isFinite(wert) ? wert : 1);
    p.alltag = a;
    return a;
  };
  X.alltagFertig = function (p, now) {
    var a = X.alltagStand(p, now);
    return X.tagesaufgaben(now).every(function (t) { return (a.zaehler[t.id] || 0) >= t.ziel; });
  };

  /* Die Serie zaehlt Schultage am Stueck, an denen die Truhe geoeffnet
     wurde. Das Wochenende unterbricht sie nicht - die Insel ist dann zu. */
  X.SERIE = { gold: 100, jeTag: 20, bonusMax: 200 };
  X.vorherigerSchultag = function (tag) {
    for (var d = tag - 1; d > tag - 8; d--) if (H.CLOSE[H.weekday(d)]) return d;
    return tag - 1;
  };
  /* Wie lang die Serie gerade ist (0, wenn sie abgerissen ist). */
  X.serieStand = function (p, now) {
    var tag = H.day(now), s = p && p.serie;
    if (!s || !Number.isFinite(s.tag)) return 0;
    return s.tag === tag || s.tag === X.vorherigerSchultag(tag) ? s.zahl : 0;
  };
  /* Wie lang sie wird, wenn heute die Truhe aufgeht. */
  X.serieNachTruhe = function (p, now) {
    var tag = H.day(now), s = p && p.serie;
    if (s && s.tag === tag) return s.zahl;
    return s && s.tag === X.vorherigerSchultag(tag) ? s.zahl + 1 : 1;
  };
  /* Was die Truhe bringt: Gold, das mit der Serie waechst, und immer ein
     Ei - am fuenften Tag der Serie ein Episches oder besser, am zehnten ein
     Legendaeres oder besser. */
  X.truhenLohn = function (serie) {
    return { gold: X.SERIE.gold + Math.min(X.SERIE.bonusMax, Math.max(0, serie - 1) * X.SERIE.jeTag),
      eiMindestens: serie > 0 && serie % 10 === 0 ? 4 : serie > 0 && serie % 5 === 0 ? 3 : 0 };
  };
  /* Der naechste besondere Tag der Serie - fuer die Anzeige. */
  X.naechstesSerienEi = function (serie) {
    for (var t = serie + 1; t < serie + 11; t++) { var l = X.truhenLohn(t); if (l.eiMindestens) return { tag: t, mindestens: l.eiMindestens }; }
    return null;
  };

  /* ----------------------------------------------------------------
     Revanche

     Wer ein Gebiet an einen Mitspieler verliert, darf es 30 Stunden lang
     mit einem Zuschlag zurueckfordern - solange es noch dem gehoert, der
     es genommen hat. So wird aus jeder Niederlage eine Geschichte, die
     weitergeht, statt eines Grundes aufzuhoeren.
     ---------------------------------------------------------------- */
  X.REVANCHE_BONUS = .15;
  X.REVANCHE_DAUER = 30 * 3600000;
  X.revanche = function (p, t, now) {
    var r = p && p.revanche && t && p.revanche[t.id];
    return r && t.ownerId && r.gegner === t.ownerId && now < r.bis ? r : null;
  };
  X.revancheBonus = function (p, t, now) { return X.revanche(p, t, now) ? X.REVANCHE_BONUS : 0; };

  /* Neue Felder im Spielstand. D.neuerStand baut den Stand bei jedem Laden
     neu auf und laesst weg, was es nicht kennt - ohne diese Zeilen kaeme im
     Browser weder der Garantie-Zaehler noch der Schimmer an. */
  function ganz(n, max) { n = Math.floor(Number(n)); return Number.isFinite(n) && n >= 0 ? Math.min(max, n) : 0; }
  var vorher = D.neuerStand;
  D.neuerStand = function (save, now) {
    var p = vorher(save, now), old = save || {};
    p.garantie = E.garantieStand(old).map(function (g) { return g.seit; });
    p.schimmernd = {};
    p.besitz.forEach(function (id) { if (old.schimmernd && old.schimmernd[id] === true) p.schimmernd[id] = true; });
    /* Tagesaufgaben: nur Zaehler, die es gibt, nur Biome, die es gibt. */
    var a = old.alltag;
    if (a && Number.isFinite(a.tag)) {
      p.alltag = { tag: Math.floor(a.tag), zaehler: {}, erkundet: [], truhe: a.truhe === true };
      X.TAGESAUFGABEN.forEach(function (t) { var n = ganz(a.zaehler && a.zaehler[t.id], 99); if (n) p.alltag.zaehler[t.id] = n; });
      p.alltag.erkundet = D.FELDER.map(function (f) { return f.id; }).filter(function (id) { return (a.erkundet || []).indexOf(id) >= 0; });
    } else p.alltag = null;
    p.serie = old.serie && Number.isFinite(old.serie.tag) ? { zahl: ganz(old.serie.zahl, 9999), tag: Math.floor(old.serie.tag) } : { zahl: 0, tag: null };
    /* Offene Revanchen - abgelaufene fallen heraus. */
    p.revanche = {};
    var jetzt = Number.isFinite(now) ? now : Date.now();
    D.FELDER.forEach(function (f) {
      var r = old.revanche && old.revanche[f.id];
      if (r && typeof r.gegner === 'string' && Number.isFinite(r.bis) && r.bis > jetzt)
        p.revanche[f.id] = { gegner: r.gegner, name: String(r.name || '').slice(0, 30), bis: r.bis };
    });
    /* Eier, die auf Platz in der Tasche warten (etwa aus der Truhe bei voller Tasche). */
    p.sonderEier = (Array.isArray(old.sonderEier) ? old.sonderEier : []).slice(0, 20).filter(function (e) {
      return e && typeof e.id === 'string' && D.FELDER.some(function (f) { return f.id === e.territoryId; });
    }).map(function (e) {
      var ei = { id: e.id, territoryId: e.territoryId, producedAt: Number(e.producedAt) || 0, startedAt: null, readyAt: null };
      if (ganz(e.mindestens, D.SELTENHEITEN.length - 1)) ei.mindestens = ganz(e.mindestens, D.SELTENHEITEN.length - 1);
      if (typeof e.art === 'string' && /^[a-z]{1,16}$/.test(e.art)) ei.art = e.art;
      return ei;
    });
    return p;
  };
  /* Wartende Eier rutschen nach, sobald in der Tasche Platz ist. */
  X.sonderEierLiefern = function (p) {
    var n = 0;
    while (p.sonderEier && p.sonderEier.length && p.eggs.length < E.BAG_LIMIT) { p.eggs.push(p.sonderEier.shift()); n++; }
    return n;
  };
})(SG);
