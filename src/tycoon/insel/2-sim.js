/* ------------------------------------------------------------------
   Island Quest - Simulation

   Der Tagesablauf in vier Schritten:

     1. Wer arbeitet wo?  Es gibt nur so viele Bewohner, wie es gibt.
        Reicht die Belegschaft nicht, laufen alle Betriebe gedrosselt.
     2. Verbrauch.  Ein Betrieb, dem die Vorprodukte fehlen, steht still.
     3. Erzeugung.  Was uebrig ist, wandert ins Lager - bis es voll ist.
     4. Essen, Stimmung, Wachstum.

   Die Karten der Inseln werden aus einem Startwert erzeugt, nicht
   gespeichert: derselbe Startwert ergibt immer dieselbe Insel. Das
   spart im Spielstand ein paar hundert Felder.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var I = SG.tycoon.insel;
  var D = I.data;

  var S = I.sim = {};

  /* ---------------------------------------------------------- Karte */

  /* Erzeugt die Karte einer Insel. Rund, mit Wasser aussen herum, und
     die Bodenarten in Flecken statt zufaellig verstreut - sonst sieht
     es aus wie Konfetti und keine Nachbarschaft ergibt Sinn. */
  S.karteBauen = function (inselId, seed) {
    var def = D.insel(inselId);
    var rng = U.rng(seed >>> 0);
    var b = D.BREITE, h = D.HOEHE;
    var karte = [];

    /* Ein paar Keimzellen je Bodenart, danach waechst jedes Feld zum
       naechstgelegenen Keim - das gibt zusammenhaengende Flecken. */
    var arten = Object.keys(def.mischung);
    var keime = [];
    arten.forEach(function (art) {
      var n = Math.max(1, Math.round(def.mischung[art] * 11));
      for (var i = 0; i < n; i++) {
        keime.push({ x: rng() * b, y: rng() * h, art: art });
      }
    });

    for (var y = 0; y < h; y++) {
      var zeile = [];
      for (var x = 0; x < b; x++) {
        /* Rand: alles ausserhalb der Ellipse ist See */
        var dx = (x - (b - 1) / 2) / ((b - 1) / 2);
        var dy = (y - (h - 1) / 2) / ((h - 1) / 2);
        var r = dx * dx + dy * dy;
        if (r > 0.82 + rng() * 0.22) { zeile.push('wasser'); continue; }

        var beste = null, bestD = 1e9;
        for (var k = 0; k < keime.length; k++) {
          var ddx = keime[k].x - x, ddy = keime[k].y - y;
          var d2 = ddx * ddx + ddy * ddy * 1.4;
          if (d2 < bestD) { bestD = d2; beste = keime[k].art; }
        }
        /* Direkt am Wasser wird aus allem Strand */
        if (r > 0.62 && beste !== 'vulkan' && rng() < 0.6) beste = 'strand';
        zeile.push(beste || 'wiese');
      }
      karte.push(zeile);
    }
    return karte;
  };

  /* ---------------------------------------------------------- Aufbau */

  S.create = function (seed) {
    var s = {
      seed: seed >>> 0,
      zufall: (seed >>> 0) || 4919,

      tag: 1, teilTag: 0,
      tempo: 1, pausiert: false,

      inseln: {},                 // id -> { seed, bauten: {"x,y": gebaeudeId} }
      aktiv: 'heim',
      entdeckt: ['heim'],

      lager: {},
      bewohner: 6,
      laune: 60,
      hunger: 0,

      fahrt: null,                // { ziel, rest, gesamt }
      wirkungen: [],
      meldungen: [],

      erzeugtGesamt: {},
      stufe: 0,
      hoechsteStufe: 0,
      tutorialGesehen: false,
    };

    D.WAREN.forEach(function (w) { s.lager[w.id] = 0; });
    s.lager.holz = 40;
    s.lager.stein = 20;
    s.lager.nahrung = 60;

    s.inseln.heim = { seed: (seed >>> 0) + 17, bauten: {} };
    return s;
  };

  function wuerfel(s) {
    s.zufall = (s.zufall * 1664525 + 1013904223) >>> 0;
    return s.zufall / 4294967296;
  }
  S.wuerfel = wuerfel;

  function melden(s, icon, text, art) {
    s.meldungen.unshift({ icon: icon, text: text, art: art || '', t: Date.now() });
    if (s.meldungen.length > 60) s.meldungen.length = 60;
  }
  S.melden = melden;

  /* Karten werden bei Bedarf erzeugt und dann gemerkt */
  var karten = {};
  S.karte = function (s, inselId) {
    var st = s.inseln[inselId];
    if (!st) return null;
    var schluessel = inselId + ':' + st.seed;
    if (!karten[schluessel]) karten[schluessel] = S.karteBauen(inselId, st.seed);
    return karten[schluessel];
  };
  S.kartenLeeren = function () { karten = {}; };

  /* ---------------------------------------------------------- Felder */

  S.feld = function (s, inselId, x, y) {
    var k = S.karte(s, inselId);
    if (!k || y < 0 || y >= D.HOEHE || x < 0 || x >= D.BREITE) return null;
    return k[y][x];
  };

  S.bau = function (s, inselId, x, y) {
    var st = s.inseln[inselId];
    if (!st) return null;
    return st.bauten[x + ',' + y] || null;
  };

  /* Wie viele Nachbarfelder einer Art angrenzen (die vier direkten) */
  function nachbarn(s, inselId, x, y, art) {
    var n = 0;
    var p = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    for (var i = 0; i < 4; i++) {
      if (S.feld(s, inselId, x + p[i][0], y + p[i][1]) === art) n++;
    }
    return n;
  }
  S.nachbarn = nachbarn;

  /* Wie stark ein Gebaeude an dieser Stelle arbeitet.
     1.0 = ohne Bonus, mehr durch passende Nachbarschaft. */
  S.lage = function (s, inselId, x, y, def) {
    if (!def || !def.nachbar) return 1;
    var f = 1;
    for (var art in def.nachbar) {
      f += nachbarn(s, inselId, x, y, art) * (def.nachbar[art] - 1) * 0.5;
    }
    return f;
  };

  S.darfBauen = function (s, inselId, x, y, def) {
    var boden = S.feld(s, inselId, x, y);
    if (!boden) return 'Außerhalb der Insel.';
    if (!D.BODEN[boden].bebaubar) return 'Auf ' + D.BODEN[boden].name + ' geht das nicht.';
    if (S.bau(s, inselId, x, y)) return 'Hier steht schon etwas.';
    if (def.boden.indexOf(boden) < 0) {
      return def.name + ' braucht: ' + def.boden.map(function (b) {
        return D.BODEN[b].name;
      }).join(', ') + '.';
    }
    if (def.nachbar && def.nachbar.wasser === 1 && !nachbarn(s, inselId, x, y, 'wasser')) {
      return def.name + ' muss ans Wasser.';
    }
    return null;
  };

  S.kannZahlen = function (s, kosten) {
    for (var id in kosten) if ((s.lager[id] || 0) < kosten[id]) return false;
    return true;
  };

  S.bauen = function (s, inselId, x, y, gebaeudeId) {
    var def = D.gebaeude(gebaeudeId);
    if (!def) return 'Unbekanntes Gebäude.';
    var fehler = S.darfBauen(s, inselId, x, y, def);
    if (fehler) return fehler;
    if (!S.kannZahlen(s, def.kosten)) return 'Das Material fehlt.';

    for (var id in def.kosten) s.lager[id] -= def.kosten[id];
    s.inseln[inselId].bauten[x + ',' + y] = gebaeudeId;
    return null;
  };

  S.abreissen = function (s, inselId, x, y) {
    var id = S.bau(s, inselId, x, y);
    if (!id) return 'Da steht nichts.';
    var def = D.gebaeude(id);
    /* Die Haelfte kommt zurueck - abreissen soll weh tun, aber nicht
       endgueltig sein. */
    for (var w in def.kosten) {
      s.lager[w] = (s.lager[w] || 0) + Math.floor(def.kosten[w] / 2);
    }
    delete s.inseln[inselId].bauten[x + ',' + y];
    return null;
  };

  /* ---------------------------------------------------------- Bestand */

  /* Alle Gebaeude aller entdeckten Inseln, mit ihrer Lage */
  S.alleBauten = function (s) {
    var raus = [];
    for (var i = 0; i < s.entdeckt.length; i++) {
      var inselId = s.entdeckt[i];
      var st = s.inseln[inselId];
      if (!st) continue;
      for (var k in st.bauten) {
        var teile = k.split(',');
        var def = D.gebaeude(st.bauten[k]);
        if (!def) continue;
        raus.push({
          insel: inselId, x: +teile[0], y: +teile[1], def: def,
          lage: S.lage(s, inselId, +teile[0], +teile[1], def),
        });
      }
    }
    return raus;
  };

  S.zaehlen = function (s, gebaeudeId) {
    var n = 0;
    var alle = S.alleBauten(s);
    for (var i = 0; i < alle.length; i++) if (alle[i].def.id === gebaeudeId) n++;
    return n;
  };

  S.schalterWert = function (s, schalter) {
    var summe = 0;
    var alle = S.alleBauten(s);
    for (var i = 0; i < alle.length; i++) {
      if (alle[i].def.schalter === schalter) summe += alle[i].def.wert;
    }
    return summe;
  };

  S.wohnraum = function (s) {
    var p = 0;
    var alle = S.alleBauten(s);
    for (var i = 0; i < alle.length; i++) {
      if (alle[i].def.bewohner < 0) p -= alle[i].def.bewohner;
    }
    return p;
  };

  S.arbeitsBedarf = function (s) {
    var n = 0;
    var alle = S.alleBauten(s);
    for (var i = 0; i < alle.length; i++) {
      if (alle[i].def.bewohner > 0) n += alle[i].def.bewohner;
    }
    return n;
  };

  /* Fehlen Leute, arbeiten alle Betriebe anteilig langsamer */
  S.arbeitsFaktor = function (s) {
    var bedarf = S.arbeitsBedarf(s);
    if (bedarf <= 0) return 1;
    return U.clamp(s.bewohner / bedarf, 0, 1);
  };

  S.lagerGrenze = function (s) {
    return D.LAGER_GRUND + S.schalterWert(s, 'lager');
  };

  S.wirkung = function (s, feld) {
    var summe = 0;
    for (var i = 0; i < s.wirkungen.length; i++) {
      if (typeof s.wirkungen[i][feld] === 'number') summe += s.wirkungen[i][feld];
    }
    return summe;
  };

  /* Allgemeiner Leistungsfaktor: Arbeitskraft, Stimmung, Schulen */
  S.leistung = function (s) {
    var f = S.arbeitsFaktor(s);
    f *= 0.7 + (s.laune / 100) * 0.45;
    f *= 1 + S.schalterWert(s, 'wissen');
    f *= 1 + S.wirkung(s, 'ertrag');
    return Math.max(0, f);
  };

  /* Was ein Tag brutto brächte - fuer die Anzeige */
  S.tagesBilanz = function (s) {
    var ein = {}, aus = {};
    var f = S.leistung(s);
    var alle = S.alleBauten(s);
    for (var i = 0; i < alle.length; i++) {
      var b = alle[i];
      if (b.def.braucht) {
        for (var w in b.def.braucht) aus[w] = (aus[w] || 0) + b.def.braucht[w] * f;
      }
      if (b.def.erzeugt) {
        for (w in b.def.erzeugt) {
          var menge = b.def.erzeugt[w] * b.lage * f;
          if (w === 'nahrung') menge *= 1 + S.wirkung(s, 'nahrung');
          ein[w] = (ein[w] || 0) + menge;
        }
      }
    }
    aus.nahrung = (aus.nahrung || 0) + s.bewohner * D.NAHRUNG_PRO_KOPF;
    return { ein: ein, aus: aus };
  };

  /* ---------------------------------------------------------- Fahrten */

  S.fahrtDauer = function (s, zielId) {
    var def = D.insel(zielId);
    var tage = def.fahrt;
    tage *= 1 - Math.min(0.6, S.schalterWert(s, 'fahrt'));
    return Math.max(1, Math.round(tage));
  };

  S.fahrtMoeglich = function (s, zielId) {
    if (s.fahrt) return 'Ein Schiff ist schon unterwegs.';
    if (s.entdeckt.indexOf(zielId) >= 0) return 'Diese Insel kennst du bereits.';
    if (!S.zaehlen(s, 'hafen')) return 'Dafür braucht es einen Hafen.';
    var def = D.insel(zielId);
    if (!def.ausruest) return 'Dorthin fährt niemand.';
    if (!S.kannZahlen(s, def.ausruest)) return 'Die Ausrüstung fehlt.';
    /* Der Reihe nach: erst die naeheren Inseln */
    for (var i = 0; i < D.INSELN.length; i++) {
      var vorher = D.INSELN[i];
      if (vorher.id === zielId) break;
      if (s.entdeckt.indexOf(vorher.id) < 0) {
        return 'Erst muss ' + vorher.name + ' erkundet sein.';
      }
    }
    return null;
  };

  S.fahrtStarten = function (s, zielId) {
    var fehler = S.fahrtMoeglich(s, zielId);
    if (fehler) return fehler;
    var def = D.insel(zielId);
    for (var w in def.ausruest) s.lager[w] -= def.ausruest[w];
    var dauer = S.fahrtDauer(s, zielId);
    s.fahrt = { ziel: zielId, rest: dauer, gesamt: dauer };
    melden(s, '⛵', 'Ein Schiff läuft aus nach ' + def.name + '. '
      + dauer + ' Tage Fahrt.', 'gut');
    return null;
  };

  function fahrtAnkommen(s) {
    var zielId = s.fahrt.ziel;
    var def = D.insel(zielId);
    s.fahrt = null;
    s.entdeckt.push(zielId);
    s.inseln[zielId] = { seed: (s.seed + zielId.length * 977 + s.entdeckt.length * 31) >>> 0,
      bauten: {} };
    melden(s, def.icon, def.name + ' entdeckt! ' + def.text, 'gut');
    if (def.gabe) {
      var w = D.ware(def.gabe);
      melden(s, w.icon, 'Die Insel bringt ' + w.name + ' in Mengen mit.', 'gut');
    }
  }

  /* ---------------------------------------------------------- Takt */

  S.step = function (s, dt) {
    if (s.pausiert) return;
    dt = Math.min(dt, 0.25) * s.tempo;
    s.teilTag += dt / D.SEK_PRO_TAG;
    var runden = 0;
    while (s.teilTag >= 1 && runden < 40) {
      s.teilTag -= 1;
      runden++;
      tagesWechsel(s);
    }
  };

  function tagesWechsel(s) {
    var f = S.leistung(s);
    var grenze = S.lagerGrenze(s);
    var alle = S.alleBauten(s);

    /* 1. Verbrauchende Betriebe zuerst - wer nichts bekommt, steht still */
    for (var i = 0; i < alle.length; i++) {
      var b = alle[i];
      var lauft = 1;
      if (b.def.braucht) {
        for (var w in b.def.braucht) {
          var noetig = b.def.braucht[w] * f;
          var da = s.lager[w] || 0;
          if (da < noetig) lauft = Math.min(lauft, noetig > 0 ? da / noetig : 0);
        }
        if (lauft > 0) {
          for (w in b.def.braucht) {
            s.lager[w] = Math.max(0, (s.lager[w] || 0) - b.def.braucht[w] * f * lauft);
          }
        }
      }
      b.__lauft = lauft;
    }

    /* 2. Erzeugung */
    for (i = 0; i < alle.length; i++) {
      b = alle[i];
      if (!b.def.erzeugt) continue;
      for (w in b.def.erzeugt) {
        var menge = b.def.erzeugt[w] * b.lage * f * b.__lauft;
        if (w === 'nahrung') menge *= 1 + S.wirkung(s, 'nahrung');
        s.lager[w] = Math.min(grenze, (s.lager[w] || 0) + menge);
        s.erzeugtGesamt[w] = (s.erzeugtGesamt[w] || 0) + menge;
      }
    }

    /* 3. Markt: was ueber dem Lagerziel liegt, wird zu Muenzen */
    var marktAnteil = S.schalterWert(s, 'markt');
    if (marktAnteil > 0) {
      for (var id in D.MARKTPREIS) {
        var ueber = (s.lager[id] || 0) - grenze * 0.8;
        if (ueber <= 0) continue;
        var verkauft = Math.min(ueber, ueber * marktAnteil);
        s.lager[id] -= verkauft;
        s.lager.muenzen = (s.lager.muenzen || 0) + verkauft * D.MARKTPREIS[id];
      }
    }

    /* 4. Essen, Stimmung, Wachstum */
    var braucht = s.bewohner * D.NAHRUNG_PRO_KOPF;
    var vorrat = s.lager.nahrung || 0;
    if (vorrat >= braucht) {
      s.lager.nahrung = vorrat - braucht;
      s.hunger = Math.max(0, s.hunger - 1);
    } else {
      s.lager.nahrung = 0;
      s.hunger++;
      if (s.hunger === 3) {
        melden(s, '🍽', 'Die Vorräte sind leer. Wenn das anhält, geht jemand.', 'schlecht');
      }
      if (s.hunger > 5 && s.bewohner > 1) {
        s.bewohner = Math.max(1, Math.round(s.bewohner * 0.94));
      }
    }

    var laune = 55;
    laune += S.schalterWert(s, 'laune');
    laune -= s.hunger * 9;
    var platz = S.wohnraum(s);
    if (s.bewohner > platz) laune -= 15;
    laune += S.wirkung(s, 'laune');
    s.laune = U.clamp(s.laune + (U.clamp(laune, 0, 100) - s.laune) * 0.18, 0, 100);

    if (s.hunger === 0 && s.bewohner < platz) {
      s.bewohner = Math.min(platz, s.bewohner + Math.max(0.2, s.bewohner * D.WACHSTUM));
    }

    /* 5. Fahrt, Ereignisse, Stufe */
    if (s.fahrt) {
      s.fahrt.rest--;
      if (s.fahrt.rest <= 0) fahrtAnkommen(s);
    }

    for (i = s.wirkungen.length - 1; i >= 0; i--) {
      s.wirkungen[i].tage--;
      if (s.wirkungen[i].tage <= 0) s.wirkungen.splice(i, 1);
    }

    if (wuerfel(s) < 0.09) ereignisZiehen(s);

    var neu = D.stufeVon(Math.floor(s.bewohner), s.entdeckt.length);
    if (neu > s.stufe) {
      s.stufe = neu;
      if (neu > s.hoechsteStufe) s.hoechsteStufe = neu;
      melden(s, D.STUFEN[neu].icon, 'Neuer Rang: ' + D.STUFEN[neu].name + '.', 'gut');
    } else if (neu < s.stufe) {
      s.stufe = neu;
    }

    s.tag++;
  }

  function ereignisZiehen(s) {
    var hatRuinen = false, hatVulkan = false;
    for (var i = 0; i < s.entdeckt.length; i++) {
      var k = S.karte(s, s.entdeckt[i]);
      if (!k) continue;
      for (var y = 0; y < D.HOEHE; y++) {
        for (var x = 0; x < D.BREITE; x++) {
          if (k[y][x] === 'ruine') hatRuinen = true;
          if (k[y][x] === 'vulkan') hatVulkan = true;
        }
      }
    }

    var moeglich = D.EREIGNISSE.filter(function (e) {
      if (e.bedingung === 'eng') return s.bewohner > S.wohnraum(s) * 0.9 && s.bewohner > 20;
      if (e.bedingung === 'reich') return (s.lager.muenzen || 0) > 400;
      if (e.bedingung === 'ruinen') return hatRuinen;
      if (e.bedingung === 'vulkan') return hatVulkan;
      return true;
    });
    if (!moeglich.length) return;

    var e = moeglich[Math.floor(wuerfel(s) * moeglich.length)];
    var w = e.wirkung;

    if (w.fund) {
      var menge = 20 + Math.round(s.bewohner * 1.5);
      s.lager.holz = Math.min(S.lagerGrenze(s), (s.lager.holz || 0) + menge);
      s.lager.stoff = Math.min(S.lagerGrenze(s), (s.lager.stoff || 0) + Math.round(menge / 5));
      melden(s, e.icon, e.name + ': ' + menge + ' Holz und etwas Stoff geborgen.', 'gut');
      return;
    }
    if (w.schatz) {
      var gold = 120 + Math.round(s.bewohner * 4);
      s.lager.muenzen = (s.lager.muenzen || 0) + gold;
      melden(s, e.icon, e.name + ': ' + gold + ' Münzen.', 'gut');
      return;
    }
    if (w.zuzug) {
      var platz = S.wohnraum(s) - s.bewohner;
      if (platz < 2) {
        melden(s, e.icon, e.name + ': aber es ist kein Platz. Sie ziehen weiter.', 'schlecht');
        return;
      }
      var n = Math.min(platz, 2 + Math.floor(wuerfel(s) * 5));
      s.bewohner += n;
      melden(s, e.icon, e.name + ': ' + n + ' Menschen bleiben.', 'gut');
      return;
    }
    if (w.raub) {
      var verlust = 0;
      for (var id in D.MARKTPREIS) {
        var weg = (s.lager[id] || 0) * w.raub;
        s.lager[id] -= weg;
        verlust += weg;
      }
      s.lager.muenzen = Math.round((s.lager.muenzen || 0) * (1 - w.raub));
      melden(s, e.icon, e.name + ': ' + Math.round(verlust) + ' Einheiten geplündert.',
        'schlecht');
      return;
    }
    if (typeof w.laune === 'number') {
      s.laune = U.clamp(s.laune + w.laune, 0, 100);
    }
    if (w.tage) {
      s.wirkungen.push({
        id: e.id, name: e.name, icon: e.icon, tage: w.tage,
        ertrag: w.ertrag || 0, nahrung: w.nahrung || 0, laune: 0,
      });
    }
    melden(s, e.icon, e.name + ': ' + e.text,
      (w.ertrag > 0 || w.nahrung > 0 || w.laune > 0) ? 'gut' : 'schlecht');
  }

  /* ---------------------------------------------------------- Sichern */

  S.serialize = function (s) {
    var inseln = {};
    for (var id in s.inseln) {
      inseln[id] = { seed: s.inseln[id].seed, bauten: U.assign({}, s.inseln[id].bauten) };
    }
    return {
      v: 1,
      seed: s.seed, zufall: s.zufall,
      tag: s.tag, teilTag: s.teilTag, tempo: s.tempo, pausiert: s.pausiert,
      inseln: inseln, aktiv: s.aktiv, entdeckt: s.entdeckt.slice(),
      lager: U.assign({}, s.lager),
      bewohner: s.bewohner, laune: s.laune, hunger: s.hunger,
      fahrt: s.fahrt ? U.assign({}, s.fahrt) : null,
      wirkungen: s.wirkungen.slice(),
      erzeugtGesamt: U.assign({}, s.erzeugtGesamt),
      stufe: s.stufe, hoechsteStufe: s.hoechsteStufe,
      tutorialGesehen: s.tutorialGesehen,
    };
  };

  S.deserialize = function (raw) {
    if (!raw || typeof raw !== 'object') return null;
    var s = S.create(raw.seed || 1);
    try {
      s.zufall = raw.zufall || s.zufall;
      s.tag = raw.tag || 1;
      s.teilTag = raw.teilTag || 0;
      s.tempo = raw.tempo || 1;
      s.pausiert = !!raw.pausiert;
      s.inseln = {};
      for (var id in (raw.inseln || {})) {
        s.inseln[id] = {
          seed: raw.inseln[id].seed,
          bauten: U.assign({}, raw.inseln[id].bauten || {}),
        };
      }
      if (!s.inseln.heim) s.inseln.heim = { seed: s.seed + 17, bauten: {} };
      s.aktiv = raw.aktiv || 'heim';
      s.entdeckt = raw.entdeckt || ['heim'];
      s.lager = U.assign(s.lager, raw.lager || {});
      s.bewohner = raw.bewohner === undefined ? 6 : raw.bewohner;
      s.laune = raw.laune === undefined ? 60 : raw.laune;
      s.hunger = raw.hunger || 0;
      s.fahrt = raw.fahrt || null;
      s.wirkungen = raw.wirkungen || [];
      s.erzeugtGesamt = raw.erzeugtGesamt || {};
      s.stufe = raw.stufe || 0;
      s.hoechsteStufe = raw.hoechsteStufe || s.stufe;
      s.tutorialGesehen = !!raw.tutorialGesehen;
    } catch (e) {
      SG.noteError('insel.deserialize', e);
      return null;
    }
    return s;
  };
})(SG);
