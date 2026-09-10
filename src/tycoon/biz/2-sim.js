/* ------------------------------------------------------------------
   Wirtschafts-Tycoon - Simulation

   Reine Rechenschicht ohne Oberflaeche, damit sie sich in Node
   nachrechnen laesst. Alles Zufaellige laeuft ueber den Kern im
   Zustand - derselbe Kern ergibt denselben Verlauf.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var B = SG.tycoon.biz;
  var D = B.data;
  var S = B.sim = {};

  /* ---------------------------------------------------------- Aufbau */

  S.create = function (seed) {
    var s = {
      seed: (seed === undefined ? 12345 : seed) >>> 0,
      zeit: 0,              // Spielsekunden
      tag: 0,
      monat: 0,
      geld: 0,
      verdientGesamt: 0,
      tipps: 0,
      pausiert: false,
      tempo: 1,

      karriere: 0,          // Index in D.KARRIERE
      firmen: {},           // id -> Stufe
      aktien: [],           // { id, kurs, verlauf[], stueck, einstand }
      immobilien: {},       // id -> Anzahl
      residenz: 0,          // Index in D.RESIDENZEN
      luxus: {},            // id -> true
      beratung: {},         // id -> true

      // Steuer
      gewinnSeitAbrechnung: 0,
      letzteSteuer: 0,
      steuerFaellig: 0,

      ereignis: null,       // { id, restTage }
      meldungen: [],        // Zeitleiste
      naechstesEreignis: 6 + 8,

      stat: { firmenErtrag: 0, mieten: 0, dividenden: 0, steuern: 0, luxusAusgaben: 0 },
      erreicht: {},         // Rangname -> true
    };

    var rng = U.rng(s.seed);
    D.AKTIEN.forEach(function (a) {
      var kurs = a.start * (0.9 + rng() * 0.2);
      s.aktien.push({
        id: a.id, kurs: kurs, stueck: 0, einstand: 0,
        verlauf: [kurs, kurs, kurs, kurs, kurs, kurs, kurs, kurs],
      });
    });
    D.FIRMEN.forEach(function (f) { s.firmen[f.id] = 0; });
    D.IMMOBILIEN.forEach(function (i) { s.immobilien[i.id] = 0; });

    melden(s, 'gut', '🌅', 'Erster Tag. Auf dem Konto: nichts. Der Schreibtisch wartet.');
    return s;
  };

  function melden(s, art, icon, text) {
    s.meldungen.push({ art: art, icon: icon, text: text, tag: s.tag });
    if (s.meldungen.length > 60) s.meldungen.shift();
  }
  S.melden = melden;

  /* ---------------------------------------------------------- Kennzahlen */

  S.proTipp = function (s) {
    var basis = D.KARRIERE[s.karriere].proTipp;
    // Ansehen faerbt auf die eigene Arbeit ab - wer wer ist, wird besser bezahlt
    return Math.round(basis * (1 + S.ansehen(s) / 260));
  };

  /* Ertrag einer einzelnen Firma je Spielsekunde */
  S.firmenErtrag = function (s, id) {
    var def = D.firma(id);
    var stufe = s.firmen[id] || 0;
    if (!def || !stufe) return 0;
    var meilen = Math.floor(stufe / D.MEILENSTEIN);
    return def.ertrag * stufe * Math.pow(2, meilen);
  };

  S.ertragGesamt = function (s) {
    var summe = 0;
    for (var i = 0; i < D.FIRMEN.length; i++) summe += S.firmenErtrag(s, D.FIRMEN[i].id);
    return summe * S.faktor(s, 'firmen');
  };

  /* Mieteinnahmen je Tag, abzueglich Unterhalt */
  S.mieteGesamt = function (s) {
    var summe = 0;
    for (var i = 0; i < D.IMMOBILIEN.length; i++) {
      var def = D.IMMOBILIEN[i];
      var n = s.immobilien[def.id] || 0;
      if (n) summe += n * def.miete * (1 - def.unterhalt);
    }
    return summe * S.faktor(s, 'mieten');
  };

  S.ansehen = function (s) {
    var summe = D.RESIDENZEN[s.residenz].ansehen;
    for (var i = 0; i < D.LUXUS.length; i++) {
      if (s.luxus[D.LUXUS[i].id]) summe += D.LUXUS[i].ansehen;
    }
    return summe;
  };

  S.depotwert = function (s) {
    var summe = 0;
    for (var i = 0; i < s.aktien.length; i++) summe += s.aktien[i].kurs * s.aktien[i].stueck;
    return summe;
  };

  S.immobilienwert = function (s) {
    var summe = 0;
    for (var i = 0; i < D.IMMOBILIEN.length; i++) {
      summe += (s.immobilien[D.IMMOBILIEN[i].id] || 0) * D.IMMOBILIEN[i].preis;
    }
    return summe;
  };

  S.vermoegen = function (s) {
    return s.geld + S.depotwert(s) + S.immobilienwert(s)
      + D.RESIDENZEN[s.residenz].preis;
  };

  S.rang = function (s) { return D.rang(S.vermoegen(s), S.ansehen(s)); };

  S.rabatt = function (s) {
    var r = 0;
    for (var i = 0; i < D.BERATUNG.length; i++) {
      if (s.beratung[D.BERATUNG[i].id]) r += D.BERATUNG[i].rabatt;
    }
    return Math.min(r, D.MAX_RABATT);
  };

  /* Laufender Ereignisfaktor fuer "firmen", "mieten" oder "boerse" */
  S.faktor = function (s, was) {
    if (!s.ereignis) return was === 'boerse' ? 0 : 1;
    var def = null;
    for (var i = 0; i < D.EREIGNISSE.length; i++) {
      if (D.EREIGNISSE[i].id === s.ereignis.id) def = D.EREIGNISSE[i];
    }
    if (!def) return was === 'boerse' ? 0 : 1;
    if (was === 'boerse') return def.boerse || 0;
    return def[was] === undefined ? 1 : def[was];
  };

  /* ---------------------------------------------------------- Handlungen */

  S.arbeiten = function (s) {
    var v = S.proTipp(s);
    s.geld += v;
    s.verdientGesamt += v;
    s.gewinnSeitAbrechnung += v;
    s.tipps++;
    return v;
  };

  S.karriereKosten = function (s) {
    var n = D.KARRIERE[s.karriere + 1];
    return n ? n.kosten : null;
  };

  S.karriereAufstieg = function (s) {
    var n = D.KARRIERE[s.karriere + 1];
    if (!n) return 'Mehr geht nicht.';
    if (s.geld < n.kosten) return 'Dafür reicht das Geld nicht.';
    s.geld -= n.kosten;
    s.karriere++;
    melden(s, 'gut', '🎓', n.name + ' geschafft — ' + U.euro(n.proTipp) + ' je Tipp.');
    return null;
  };

  S.firmaKaufen = function (s, id, menge) {
    menge = Math.max(1, menge || 1);
    var def = D.firma(id);
    if (!def) return 'Unbekannte Firma.';
    var stufe = s.firmen[id] || 0;
    var preis = D.firmenPreisMenge(def, stufe, menge);
    if (s.geld < preis) return 'Dafür reicht das Geld nicht.';
    s.geld -= preis;
    s.firmen[id] = stufe + menge;
    var vorher = Math.floor(stufe / D.MEILENSTEIN);
    var nachher = Math.floor(s.firmen[id] / D.MEILENSTEIN);
    if (nachher > vorher) {
      melden(s, 'gut', '⭐', def.name + ' Stufe ' + s.firmen[id]
        + ' — der Ertrag hat sich verdoppelt.');
    }
    return null;
  };

  /* Wie viele Stufen sind gerade bezahlbar? */
  S.maxStufen = function (s, id, deckel) {
    var def = D.firma(id);
    if (!def) return 0;
    var stufe = s.firmen[id] || 0;
    var n = 0;
    while (n < (deckel || 500)) {
      if (D.firmenPreisMenge(def, stufe, n + 1) > s.geld) break;
      n++;
    }
    return n;
  };

  S.aktieKaufen = function (s, id, stueck) {
    var a = null;
    for (var i = 0; i < s.aktien.length; i++) if (s.aktien[i].id === id) a = s.aktien[i];
    if (!a) return 'Unbekannte Aktie.';
    stueck = Math.floor(stueck);
    if (stueck < 1) return 'Mindestens ein Stück.';
    var preis = a.kurs * stueck;
    if (s.geld < preis) return 'Dafür reicht das Geld nicht.';
    s.geld -= preis;
    a.einstand = (a.einstand * a.stueck + preis) / (a.stueck + stueck);
    a.stueck += stueck;
    return null;
  };

  S.aktieVerkaufen = function (s, id, stueck) {
    var a = null;
    for (var i = 0; i < s.aktien.length; i++) if (s.aktien[i].id === id) a = s.aktien[i];
    if (!a) return 'Unbekannte Aktie.';
    stueck = Math.min(Math.floor(stueck), a.stueck);
    if (stueck < 1) return 'Nichts im Depot.';
    var erloes = a.kurs * stueck;
    var gewinn = (a.kurs - a.einstand) * stueck;
    s.geld += erloes;
    a.stueck -= stueck;
    if (a.stueck === 0) a.einstand = 0;
    if (gewinn > 0) {
      s.verdientGesamt += gewinn;
      s.gewinnSeitAbrechnung += gewinn;
    }
    return null;
  };

  S.immobilieKaufen = function (s, id) {
    var def = D.immobilie(id);
    if (!def) return 'Unbekanntes Objekt.';
    if (s.geld < def.preis) return 'Dafür reicht das Geld nicht.';
    s.geld -= def.preis;
    s.immobilien[id] = (s.immobilien[id] || 0) + 1;
    return null;
  };

  S.immobilieVerkaufen = function (s, id) {
    var def = D.immobilie(id);
    if (!def || !(s.immobilien[id] > 0)) return 'Nichts zu verkaufen.';
    s.immobilien[id]--;
    s.geld += Math.round(def.preis * 0.92);   // Makler und Steuer
    return null;
  };

  S.residenzBeziehen = function (s, index) {
    var def = D.RESIDENZEN[index];
    if (!def) return 'Unbekannte Residenz.';
    if (index <= s.residenz) return 'Da wohnst du schon — oder besser.';
    if (s.geld < def.preis) return 'Dafür reicht das Geld nicht.';
    s.geld -= def.preis;
    s.residenz = index;
    melden(s, 'gut', def.icon, 'Eingezogen: ' + def.name + '.');
    return null;
  };

  S.luxusKaufen = function (s, id) {
    var def = null;
    for (var i = 0; i < D.LUXUS.length; i++) if (D.LUXUS[i].id === id) def = D.LUXUS[i];
    if (!def) return 'Unbekannt.';
    if (s.luxus[id]) return 'Hast du schon.';
    if (s.geld < def.preis) return 'Dafür reicht das Geld nicht.';
    s.geld -= def.preis;
    s.luxus[id] = true;
    s.stat.luxusAusgaben += def.preis;
    melden(s, 'gut', def.icon, def.name + ' gekauft. Ansehen +' + def.ansehen + '.');
    return null;
  };

  S.beratungKaufen = function (s, id) {
    var def = null;
    for (var i = 0; i < D.BERATUNG.length; i++) if (D.BERATUNG[i].id === id) def = D.BERATUNG[i];
    if (!def) return 'Unbekannt.';
    if (s.beratung[id]) return 'Hast du schon.';
    if (s.geld < def.kosten) return 'Dafür reicht das Geld nicht.';
    s.geld -= def.kosten;
    s.beratung[id] = true;
    melden(s, 'gut', '📑', def.name + ' beauftragt — der Steuersatz sinkt.');
    return null;
  };

  S.steuerZahlen = function (s) {
    if (s.steuerFaellig <= 0) return 'Nichts offen.';
    if (s.geld < s.steuerFaellig) return 'Dafür reicht das Geld nicht.';
    s.geld -= s.steuerFaellig;
    s.stat.steuern += s.steuerFaellig;
    melden(s, 'neutral', '🧾', U.euro(s.steuerFaellig) + ' Steuern überwiesen.');
    s.steuerFaellig = 0;
    return null;
  };

  /* ---------------------------------------------------------- Takt */

  S.step = function (s, dt) {
    if (s.pausiert) return;
    var sek = dt * s.tempo;
    if (sek <= 0) return;

    var vorherTag = Math.floor(s.zeit / D.SEK_PRO_TAG);
    s.zeit += sek;
    var nachherTag = Math.floor(s.zeit / D.SEK_PRO_TAG);

    // Laufender Firmenertrag
    var ertrag = S.ertragGesamt(s) * sek;
    if (ertrag > 0) {
      s.geld += ertrag;
      s.verdientGesamt += ertrag;
      s.gewinnSeitAbrechnung += ertrag;
      s.stat.firmenErtrag += ertrag;
    }

    // Kurse bewegen sich fortlaufend
    kurse(s, sek);

    for (var t = vorherTag; t < nachherTag; t++) tagesWechsel(s);
  };

  function kurse(s, sek) {
    var rng = U.rng((s.seed + Math.floor(s.zeit * 4)) >>> 0);
    var schub = S.faktor(s, 'boerse');
    for (var i = 0; i < s.aktien.length; i++) {
      var a = s.aktien[i];
      var def = D.aktie(a.id);
      if (!def) continue;
      // Zufallsschritt mit leichter Rueckkehr zum Ausgangswert
      var drift = (def.start - a.kurs) / def.start * 0.004;
      var zufall = (rng() - 0.5) * def.schwankung * 2;
      var schritt = (drift + zufall + schub * def.schwankung * 0.9) * sek;
      a.kurs = Math.max(def.start * 0.05, a.kurs * (1 + schritt));
    }
  }

  function tagesWechsel(s) {
    s.tag++;
    var rng = U.rng((s.seed + s.tag * 7919) >>> 0);

    // Kursverlauf fortschreiben
    for (var i = 0; i < s.aktien.length; i++) {
      s.aktien[i].verlauf.push(s.aktien[i].kurs);
      if (s.aktien[i].verlauf.length > 40) s.aktien[i].verlauf.shift();
    }

    // Mieten
    var miete = S.mieteGesamt(s);
    if (miete > 0) {
      s.geld += miete;
      s.verdientGesamt += miete;
      s.gewinnSeitAbrechnung += miete;
      s.stat.mieten += miete;
    }

    // Dividenden
    var div = 0;
    for (i = 0; i < s.aktien.length; i++) {
      var def = D.aktie(s.aktien[i].id);
      if (def && def.dividende) div += s.aktien[i].kurs * s.aktien[i].stueck * def.dividende;
    }
    if (div > 0) {
      s.geld += div;
      s.verdientGesamt += div;
      s.gewinnSeitAbrechnung += div;
      s.stat.dividenden += div;
    }

    // Unterhalt der Residenz
    var wohnen = D.RESIDENZEN[s.residenz].unterhalt;
    if (wohnen > 0) {
      s.geld -= wohnen;
      s.gewinnSeitAbrechnung -= wohnen;
    }

    // Ereignis abbauen oder neues ziehen
    if (s.ereignis) {
      s.ereignis.restTage--;
      if (s.ereignis.restTage <= 0) s.ereignis = null;
    } else if (--s.naechstesEreignis <= 0) {
      ereignisZiehen(s, rng);
      s.naechstesEreignis = 9 + rng.int(11);
    }

    // Monatsabschluss
    if (s.tag % D.TAGE_PRO_MONAT === 0) monatsWechsel(s);

    // Rangaufstieg melden
    var r = S.rang(s);
    if (!s.erreicht[r.name]) {
      s.erreicht[r.name] = true;
      if (r.name !== 'Praktikant') melden(s, 'gut', '🏅', 'Neuer Rang: ' + r.name + '.');
    }
  }

  function ereignisZiehen(s, rng) {
    var summe = 0, i;
    for (i = 0; i < D.EREIGNISSE.length; i++) summe += D.EREIGNISSE[i].gewicht;
    var wurf = rng() * summe;
    var def = D.EREIGNISSE[0];
    for (i = 0; i < D.EREIGNISSE.length; i++) {
      wurf -= D.EREIGNISSE[i].gewicht;
      if (wurf <= 0) { def = D.EREIGNISSE[i]; break; }
    }

    if (def.einmalig === 'bonus') {
      var bonus = Math.max(500, S.ertragGesamt(s) * D.SEK_PRO_TAG * 6);
      s.geld += bonus;
      s.verdientGesamt += bonus;
      s.gewinnSeitAbrechnung += bonus;
      melden(s, 'gut', '📦', def.text + ' ' + U.euro(bonus) + ' zusätzlich.');
      return;
    }
    if (def.einmalig === 'pruefung') {
      var nach = Math.max(0, s.gewinnSeitAbrechnung * 0.05);
      s.steuerFaellig += nach;
      melden(s, 'schlecht', '🔍', def.text + ' ' + U.euro(nach) + ' Nachzahlung.');
      return;
    }

    s.ereignis = { id: def.id, restTage: def.dauer };
    melden(s, def.gut ? 'gut' : 'schlecht', def.gut ? '📈' : '📉',
      def.name + ': ' + def.text);
  }

  function monatsWechsel(s) {
    s.monat++;

    /* Wer den letzten Bescheid nicht beglichen hat, zahlt Saeumniszuschlag.
       Ohne das waere die Steuer eine Bitte statt einer Pflicht. */
    if (s.steuerFaellig > 0) {
      var zuschlag = s.steuerFaellig * 0.05;
      s.steuerFaellig += zuschlag;
      melden(s, 'schlecht', '⚠', 'Steuern noch offen — ' + U.euro(zuschlag)
        + ' Säumniszuschlag kommt dazu.');
    }

    var gewinn = Math.max(0, s.gewinnSeitAbrechnung);
    var satz = D.steuersatz(gewinn, S.rabatt(s));
    var betrag = gewinn * satz;
    s.letzteSteuer = betrag;
    s.gewinnSeitAbrechnung = 0;
    if (betrag <= 0) return;
    s.steuerFaellig += betrag;
    melden(s, 'neutral', '🧾', 'Steuerbescheid: ' + U.euro(betrag)
      + ' bei ' + Math.round(satz * 100) + ' % auf ' + U.euro(gewinn) + ' Gewinn.');
  }

  /* Offene Steuern werden nach zwei Monaten eingetrieben */
  S.steuerMahnung = function (s) {
    return s.steuerFaellig > 0;
  };

  /* ---------------------------------------------------------- Speichern */

  S.serialize = function (s) {
    return {
      v: 1, seed: s.seed, zeit: s.zeit, tag: s.tag, monat: s.monat,
      geld: s.geld, verdientGesamt: s.verdientGesamt, tipps: s.tipps,
      tempo: s.tempo, pausiert: s.pausiert,
      karriere: s.karriere, firmen: s.firmen, immobilien: s.immobilien,
      residenz: s.residenz, luxus: s.luxus, beratung: s.beratung,
      aktien: s.aktien.map(function (a) {
        return { id: a.id, kurs: a.kurs, stueck: a.stueck, einstand: a.einstand,
          verlauf: a.verlauf.slice(-20) };
      }),
      gewinnSeitAbrechnung: s.gewinnSeitAbrechnung,
      letzteSteuer: s.letzteSteuer, steuerFaellig: s.steuerFaellig,
      ereignis: s.ereignis, naechstesEreignis: s.naechstesEreignis,
      stat: s.stat, erreicht: s.erreicht,
      meldungen: s.meldungen.slice(-20),
    };
  };

  S.deserialize = function (raw) {
    if (!raw) return null;
    var s = S.create(raw.seed);
    var k;
    s.zeit = raw.zeit || 0; s.tag = raw.tag || 0; s.monat = raw.monat || 0;
    s.geld = raw.geld || 0;
    s.verdientGesamt = raw.verdientGesamt || 0;
    s.tipps = raw.tipps || 0;
    s.tempo = raw.tempo || 1;
    s.pausiert = !!raw.pausiert;
    s.karriere = raw.karriere || 0;
    if (raw.firmen) for (k in raw.firmen) if (s.firmen[k] !== undefined) s.firmen[k] = raw.firmen[k];
    if (raw.immobilien) for (k in raw.immobilien) {
      if (s.immobilien[k] !== undefined) s.immobilien[k] = raw.immobilien[k];
    }
    s.residenz = raw.residenz || 0;
    s.luxus = raw.luxus || {};
    s.beratung = raw.beratung || {};
    if (raw.aktien) {
      raw.aktien.forEach(function (a) {
        for (var i = 0; i < s.aktien.length; i++) {
          if (s.aktien[i].id !== a.id) continue;
          s.aktien[i].kurs = a.kurs;
          s.aktien[i].stueck = a.stueck || 0;
          s.aktien[i].einstand = a.einstand || 0;
          if (a.verlauf && a.verlauf.length) s.aktien[i].verlauf = a.verlauf.slice();
        }
      });
    }
    s.gewinnSeitAbrechnung = raw.gewinnSeitAbrechnung || 0;
    s.letzteSteuer = raw.letzteSteuer || 0;
    s.steuerFaellig = raw.steuerFaellig || 0;
    s.ereignis = raw.ereignis || null;
    s.naechstesEreignis = raw.naechstesEreignis || 12;
    if (raw.stat) s.stat = raw.stat;
    if (raw.erreicht) s.erreicht = raw.erreicht;
    if (raw.meldungen) s.meldungen = raw.meldungen;
    return s;
  };
})(SG);
