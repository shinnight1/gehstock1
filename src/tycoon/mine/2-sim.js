/* ------------------------------------------------------------------
   Mining-Tycoon - Simulation

   Vier Zahlen halten das ganze Spiel zusammen:

     Tiefe        bestimmt, welche Schicht abgebaut wird und damit,
                  was sie einbringt und was sie verlangt.
     Leistung     was die Geraete auf allen Sohlen zusammen loesen.
     Foerderung   was davon nach oben kommt - der Engpass.
     Anforderung  Wasser, Stuetzen, Luft, Kuehlung. Fehlt etwas, faellt
                  die Leistung, und irgendwann passiert ein Unglueck.

   Wer nur Maschinen kauft, steht bald vor einem vollen Schacht und
   einer leeren Halde. Das ist der Kern: unten graben ist die eine
   Haelfte, oben ankommen die andere.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var M = SG.tycoon.mine;
  var D = M.data;

  var S = M.sim = {};

  /* ---------------------------------------------------------- Aufbau */

  S.create = function (seed) {
    var s = {
      seed: seed >>> 0,
      zufall: (seed >>> 0) || 7919,

      geld: 3000,
      schulden: 0,

      /* Zeit */
      schicht: 0, tag: 1, woche: 1,
      teilSchicht: 0,
      tempo: 1, pausiert: false,

      /* Der Schacht */
      tiefe: 12,
      teufen: false,          // wird gerade tiefer gegraben?
      teufenZiel: 0,
      sohlen: [{ tiefe: 12, geraete: { hacke: 1 } }],

      foerderStufe: 0,
      technik: { wasser: 0, stuetzen: 0, luft: 0, kuehlung: 0 },
      forschung: {},
      personal: { bergleute: 0, technik: 0, geologen: 0 },

      /* Lager und Markt */
      lager: {},
      preise: {},
      autoVerkauf: true,

      /* Kennzahlen */
      gefoerdert: 0,          // Tonnen insgesamt
      erloesGesamt: 0,
      unfaelle: 0,
      zufrieden: 70,

      einnahmen: 0,
      kosten: { lohn: 0, strom: 0, steuer: 0, reparatur: 0 },
      letzteWoche: null,
      historie: [],

      wirkungen: [],
      meldungen: [],
      rang: 0,
      hoechsterRang: 0,
      tutorialGesehen: false,
    };

    D.ROHSTOFFE.forEach(function (r) {
      s.lager[r.id] = 0;
      s.preise[r.id] = r.wert;
    });
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

  /* ---------------------------------------------------------- Ableitungen */

  S.hatForschung = function (s, id) { return !!s.forschung[id]; };

  function forschWert(s, feld) {
    var summe = 0;
    for (var i = 0; i < D.FORSCHUNG.length; i++) {
      var f = D.FORSCHUNG[i];
      if (f.wirkt === feld && s.forschung[f.id]) summe += f.wert;
    }
    return summe;
  }
  S.forschWert = forschWert;

  function wirkung(s, feld) {
    var summe = 0;
    for (var i = 0; i < s.wirkungen.length; i++) {
      if (typeof s.wirkungen[i][feld] === 'number') summe += s.wirkungen[i][feld];
    }
    return summe;
  }
  S.wirkung = wirkung;

  /* Wie viele Leute die Maschinen brauchen */
  S.mannschaftBedarf = function (s) {
    var n = 0;
    for (var i = 0; i < s.sohlen.length; i++) {
      var g = s.sohlen[i].geraete;
      for (var id in g) {
        var def = D.geraet(id);
        if (def) n += def.mann * g[id];
      }
    }
    n *= 1 + forschWert(s, 'mann');
    return Math.ceil(n);
  };

  /* Der Betreiber und sein Kompagnon arbeiten ohne Lohn mit. Ohne die
     beiden liesse sich die allererste Spitzhacke gar nicht bedienen:
     an Kies verdient ein bezahlter Bergmann weniger, als er kostet.
     Genau dieses Gefaelle treibt einen zur ersten Maschine. */
  S.FREIE_HAENDE = 2;

  /* Fehlt Personal, laeuft nur ein Teil der Maschinen */
  S.mannschaftFaktor = function (s) {
    var bedarf = S.mannschaftBedarf(s);
    if (bedarf <= 0) return 1;
    return U.clamp(((s.personal.bergleute || 0) + S.FREIE_HAENDE) / bedarf, 0, 1);
  };

  /* Erfuellt die Technik, was die tiefste Sohle verlangt?
     Gibt 1 zurueck, wenn alles passt, sonst weniger. */
  S.technikFaktor = function (s) {
    var schicht = D.schichtBei(s.tiefe);
    var verlangt = schicht.verlangt || {};
    var f = 1;
    for (var k in verlangt) {
      var haben = s.technik[k] || 0;
      var noetig = verlangt[k];
      if (haben < noetig) f *= Math.max(0.15, 0.45 + 0.55 * (haben / noetig));
    }
    return f;
  };

  S.fehlendeTechnik = function (s) {
    var schicht = D.schichtBei(s.tiefe);
    var verlangt = schicht.verlangt || {};
    var raus = [];
    for (var k in verlangt) {
      if ((s.technik[k] || 0) < verlangt[k]) {
        raus.push({ id: k, haben: s.technik[k] || 0, braucht: verlangt[k] });
      }
    }
    return raus;
  };

  /* Alles, was ausserhalb einer einzelnen Sohle auf die Leistung wirkt */
  function globalerFaktor(s) {
    var f = 1 + forschWert(s, 'leistung');
    f *= S.mannschaftFaktor(s);
    f *= S.technikFaktor(s);
    f *= 1 + wirkung(s, 'leistung');
    f *= 0.75 + (s.zufrieden / 100) * 0.35;
    return Math.max(0, f);
  }

  /* Leistung je Sohle in Tonnen je Schicht.
     Wichtig: jede Sohle liegt in ihrer eigenen Schicht und foerdert
     deren Gestein. Eine alte Sohle im Mutterboden bringt eben weiter
     Bauschutt, auch wenn der Schacht laengst im Kimberlit steht. */
  S.leistungJeSohle = function (s) {
    var g = globalerFaktor(s);
    var raus = [];
    for (var i = 0; i < s.sohlen.length; i++) {
      var sohle = s.sohlen[i];
      var haerte = D.schichtBei(sohle.tiefe).haerte;
      var t = 0;
      for (var id in sohle.geraete) {
        var def = D.geraet(id);
        if (def) t += (def.leistung * sohle.geraete[id]) / haerte;
      }
      raus.push(t * g);
    }
    return raus;
  };

  /* Rohleistung aller Geraete in Tonnen je Schicht */
  S.leistung = function (s) {
    var je = S.leistungJeSohle(s);
    var summe = 0;
    for (var i = 0; i < je.length; i++) summe += je[i];
    return summe;
  };

  /* Was die Foerderanlage nach oben schafft */
  S.foerderMenge = function (s) {
    var f = D.FOERDERUNG[s.foerderStufe].menge;
    f *= 1 + wirkung(s, 'foerder');
    return Math.max(1, f);
  };

  /* Was tatsaechlich oben ankommt */
  S.effektiv = function (s) {
    return Math.min(S.leistung(s), S.foerderMenge(s));
  };

  S.engpass = function (s) {
    return S.leistung(s) > S.foerderMenge(s) * 1.02 ? 'foerder' : 'abbau';
  };

  S.stromBedarf = function (s) {
    var kw = D.FOERDERUNG[s.foerderStufe].strom;
    for (var i = 0; i < s.sohlen.length; i++) {
      var g = s.sohlen[i].geraete;
      for (var id in g) {
        var def = D.geraet(id);
        if (def) kw += def.strom * g[id];
      }
    }
    for (var t in s.technik) {
      var td = D.technik(t);
      if (td) kw += td.strom * s.technik[t];
    }
    return Math.round(kw);
  };

  S.lohnSumme = function (s) {
    var l = 0;
    for (var id in s.personal) {
      var p = D.personal(id);
      if (p) l += p.lohn * s.personal[id];
    }
    return l;
  };

  S.lagerWert = function (s) {
    var w = 0;
    for (var id in s.lager) w += s.lager[id] * S.preis(s, id);
    return w;
  };

  S.lagerMenge = function (s) {
    var m = 0;
    for (var id in s.lager) m += s.lager[id];
    return m;
  };

  S.preis = function (s, id) {
    var p = s.preise[id] || D.rohstoff(id).wert;
    p *= 1 + forschWert(s, 'preis');
    p *= 1 + wirkung(s, 'preis');
    return p;
  };

  /* ---------------------------------------------------------- Bauen */

  S.geraetPreis = function (s, sohleIndex, id) {
    var def = D.geraet(id);
    if (!def) return 0;
    var vorhanden = 0;
    for (var i = 0; i < s.sohlen.length; i++) {
      vorhanden += s.sohlen[i].geraete[id] || 0;
    }
    return Math.round(def.kosten * Math.pow(def.steigerung, vorhanden));
  };

  S.geraetKaufen = function (s, sohleIndex, id, menge) {
    var sohle = s.sohlen[sohleIndex];
    if (!sohle) return 'Diese Sohle gibt es nicht.';
    var def = D.geraet(id);
    if (!def) return 'Unbekanntes Gerät.';
    menge = Math.max(1, menge || 1);

    var gesamt = 0;
    var vorhanden = 0;
    for (var i = 0; i < s.sohlen.length; i++) vorhanden += s.sohlen[i].geraete[id] || 0;
    for (i = 0; i < menge; i++) {
      gesamt += Math.round(def.kosten * Math.pow(def.steigerung, vorhanden + i));
    }
    if (s.geld < gesamt) return 'Dafür fehlt das Geld.';

    s.geld -= gesamt;
    sohle.geraete[id] = (sohle.geraete[id] || 0) + menge;
    return null;
  };

  /* Wie viele Geraete man sich gerade leisten kann */
  S.maxGeraete = function (s, id, deckel) {
    var def = D.geraet(id);
    if (!def) return 0;
    var vorhanden = 0;
    for (var i = 0; i < s.sohlen.length; i++) vorhanden += s.sohlen[i].geraete[id] || 0;
    var geld = s.geld;
    var n = 0;
    while (n < (deckel || 500)) {
      var p = Math.round(def.kosten * Math.pow(def.steigerung, vorhanden + n));
      if (p > geld) break;
      geld -= p;
      n++;
    }
    return n;
  };

  S.foerderPreis = function (s) {
    var n = s.foerderStufe + 1;
    if (n >= D.FOERDERUNG.length) return null;
    return D.FOERDERUNG[n].kosten;
  };

  S.foerderAusbauen = function (s) {
    var preis = S.foerderPreis(s);
    if (preis === null) return 'Mehr geht nicht.';
    if (s.geld < preis) return 'Dafür fehlt das Geld.';
    s.geld -= preis;
    s.foerderStufe++;
    melden(s, D.FOERDERUNG[s.foerderStufe].icon,
      D.FOERDERUNG[s.foerderStufe].name + ' in Betrieb.', 'gut');
    return null;
  };

  S.technikPreis = function (s, id) {
    var def = D.technik(id);
    if (!def) return 0;
    return Math.round(def.kosten * Math.pow(def.steigerung, s.technik[id] || 0));
  };

  S.technikAusbauen = function (s, id) {
    var def = D.technik(id);
    if (!def) return 'Unbekannt.';
    if ((s.technik[id] || 0) >= def.stufen) return 'Höher geht es nicht.';
    var preis = S.technikPreis(s, id);
    if (s.geld < preis) return 'Dafür fehlt das Geld.';
    s.geld -= preis;
    s.technik[id] = (s.technik[id] || 0) + 1;
    melden(s, def.icon, def.name + ' auf Stufe ' + s.technik[id] + '.', 'gut');
    return null;
  };

  S.forschen = function (s, id) {
    var def = D.forschung(id);
    if (!def) return 'Unbekannt.';
    if (s.forschung[id]) return 'Schon erforscht.';
    if (def.braucht && !s.forschung[def.braucht]) {
      return 'Erst ' + D.forschung(def.braucht).name + '.';
    }
    if (s.geld < def.kosten) return 'Dafür fehlt das Geld.';
    s.geld -= def.kosten;
    s.forschung[id] = true;
    melden(s, def.icon, def.name + ' abgeschlossen.', 'gut');
    return null;
  };

  S.einstellen = function (s, id, n) {
    s.personal[id] = Math.max(0, (s.personal[id] || 0) + n);
    return null;
  };

  /* ---------------------------------------------------------- Teufen */

  /* Eine neue Sohle wird nicht gekauft, sondern gegraben. Das dauert -
     und genau deshalb lohnt es sich, vorher die Technik zu bauen. */
  S.teufenKosten = function (s) {
    var meter = D.SOHLE_ABSTAND;
    var proMeter = D.TEUFEN_KOSTEN * Math.pow(D.TEUFEN_STEIGERUNG, s.tiefe);
    return Math.round(meter * proMeter);
  };

  S.teufenStarten = function (s) {
    if (s.teufen) return 'Es wird schon geteuft.';
    var preis = S.teufenKosten(s);
    if (s.geld < preis) return 'Dafür fehlt das Geld.';
    s.geld -= preis;
    s.teufen = true;
    s.teufenZiel = s.tiefe + D.SOHLE_ABSTAND;
    melden(s, '⏬', 'Der Schacht wird auf ' + D.formatTiefe(s.teufenZiel) + ' geteuft.');
    return null;
  };

  S.teufenTempo = function (s) {
    var t = D.TEUFEN_TEMPO;
    t *= 1 + (forschWert(s, 'teufen') * -1);      // negativer Wert = schneller
    t *= S.mannschaftFaktor(s);
    return Math.max(0.4, t);
  };

  /* ---------------------------------------------------------- Verkauf */

  S.verkaufen = function (s, id, menge) {
    var da = s.lager[id] || 0;
    menge = menge === undefined ? da : Math.min(menge, da);
    if (menge <= 0) return 0;
    var erloes = menge * S.preis(s, id);
    s.lager[id] = da - menge;
    s.geld += erloes;
    s.einnahmen += erloes;
    s.erloesGesamt += erloes;
    return erloes;
  };

  S.allesVerkaufen = function (s) {
    var summe = 0;
    for (var id in s.lager) summe += S.verkaufen(s, id);
    return summe;
  };

  /* ---------------------------------------------------------- Takt */

  S.step = function (s, dt) {
    if (s.pausiert) return;
    dt = Math.min(dt, 0.25) * s.tempo;
    var anteil = dt / D.SEK_PRO_SCHICHT;      // Bruchteil einer Schicht

    foerdern(s, anteil);

    if (s.teufen) {
      s.tiefe += S.teufenTempo(s) * anteil;
      if (s.tiefe >= s.teufenZiel) {
        s.tiefe = s.teufenZiel;
        s.teufen = false;
        s.sohlen.push({ tiefe: s.tiefe, geraete: {} });
        var sch = D.schichtBei(s.tiefe);
        melden(s, sch.icon, 'Neue Sohle bei ' + D.formatTiefe(s.tiefe)
          + ' — ' + sch.name + '.', 'gut');
        var fehlt = S.fehlendeTechnik(s);
        if (fehlt.length) {
          melden(s, '⚠', 'Hier fehlt noch: '
            + fehlt.map(function (f) { return D.technik(f.id).name; }).join(', ')
            + '.', 'schlecht');
        }
      }
    }

    s.teilSchicht += anteil;
    while (s.teilSchicht >= 1) {
      s.teilSchicht -= 1;
      schichtWechsel(s);
    }
  };

  /* Foerdern: loesen, nach oben bringen, ins Lager legen.

     Die Foerderanlage begrenzt die Summe. Reicht sie nicht, kommt von
     jeder Sohle anteilig weniger hoch - der Schacht ist einer fuer alle. */
  function foerdern(s, anteil) {
    var je = S.leistungJeSohle(s);
    var summe = 0;
    for (var i = 0; i < je.length; i++) summe += je[i];
    if (summe <= 0) return;

    var deckel = S.foerderMenge(s);
    var drossel = summe > deckel ? deckel / summe : 1;

    var ausbeute = 1 + forschWert(s, 'ausbeute') + wirkung(s, 'ausbeute');
    var seltene = forschWert(s, 'seltene');
    var gesamt = 0;

    for (i = 0; i < je.length; i++) {
      var menge = je[i] * drossel * anteil;
      if (menge <= 0) continue;
      var schicht = D.schichtBei(s.sohlen[i].tiefe);
      for (var id in schicht.anteile) {
        var anteilRoh = schicht.anteile[id];
        /* Die Erkundung verschiebt den Anteil zum Wertvollsten hin */
        if (seltene && D.rohstoff(id).wert > 1000) anteilRoh *= 1 + seltene;
        s.lager[id] = (s.lager[id] || 0) + menge * anteilRoh * ausbeute;
      }
      gesamt += menge;
    }
    s.gefoerdert += gesamt;

    if (s.autoVerkauf) S.allesVerkaufen(s);
  }

  /* ---------------------------------------------------------- Schicht */

  function schichtWechsel(s) {
    s.schicht++;
    if (s.schicht < D.SCHICHTEN_PRO_TAG) return;
    s.schicht = 0;
    tagesWechsel(s);
  }

  function tagesWechsel(s) {
    preiseBewegen(s);

    for (var i = s.wirkungen.length - 1; i >= 0; i--) {
      s.wirkungen[i].tage--;
      if (s.wirkungen[i].tage <= 0) s.wirkungen.splice(i, 1);
    }

    /* Zufriedenheit: Sicherheit, genug Leute, keine Unfaelle */
    var ziel = 60;
    ziel += S.hatForschung(s, 'sicherheit') ? 18 : 0;
    ziel += (S.mannschaftFaktor(s) - 1) * 40;
    ziel += S.technikFaktor(s) < 0.8 ? -22 : 0;
    s.zufrieden = U.clamp(s.zufrieden + (ziel - s.zufrieden) * 0.12, 0, 100);

    if (wuerfel(s) < 0.16) ereignisZiehen(s);
    unfallPruefen(s);

    var neu = D.rangVon(s.tiefe, s.erloesGesamt);
    if (neu > s.rang) {
      s.rang = neu;
      if (neu > s.hoechsterRang) s.hoechsterRang = neu;
      melden(s, D.RAENGE[neu].icon, 'Neuer Rang: ' + D.RAENGE[neu].name + '.', 'gut');
    }

    s.tag++;
    if (s.tag > D.TAGE_PRO_WOCHE) {
      s.tag = 1;
      wochenWechsel(s);
    }
  }

  function preiseBewegen(s) {
    for (var i = 0; i < D.ROHSTOFFE.length; i++) {
      var r = D.ROHSTOFFE[i];
      var p = s.preise[r.id];
      var stoss = (wuerfel(s) - 0.5) * 2 * r.schwankung;
      /* Rueckkehr zum Grundwert, sonst laufen die Preise davon */
      p = p * (1 + stoss) + (r.wert - p) * 0.06;
      s.preise[r.id] = U.clamp(p, r.wert * 0.45, r.wert * 2.4);
    }
  }

  function unfallPruefen(s) {
    var risiko = 0.012;
    var fehlt = S.fehlendeTechnik(s);
    risiko += fehlt.length * 0.05;
    risiko *= 1 + forschWert(s, 'unfall');
    risiko *= s.zufrieden < 40 ? 1.6 : 1;
    if (wuerfel(s) >= risiko) return;

    s.unfaelle++;
    var kosten = Math.max(600, s.erloesGesamt * 0.01);
    s.geld -= kosten;
    s.kosten.reparatur += kosten;
    s.zufrieden = Math.max(0, s.zufrieden - 12);
    melden(s, '🚨', 'Unfall unter Tage. ' + U.euro(Math.round(kosten), true)
      + ' und viel Ärger.', 'schlecht');
  }

  function ereignisZiehen(s) {
    var moeglich = D.EREIGNISSE.filter(function (e) {
      var schicht = D.schichtBei(s.tiefe);
      var v = schicht.verlangt || {};
      if (e.bedingung === 'wenigStuetzen') return (s.technik.stuetzen || 0) < (v.stuetzen || 0);
      if (e.bedingung === 'wenigWasser') return (s.technik.wasser || 0) < (v.wasser || 0);
      if (e.bedingung === 'wenigLuft') return (s.technik.luft || 0) < (v.luft || 0);
      if (e.bedingung === 'unzufrieden') return s.zufrieden < 42;
      if (e.bedingung === 'wenigTechnik') return (s.personal.technik || 0) < s.sohlen.length / 2;
      return true;
    });
    if (!moeglich.length) return;

    var e = moeglich[Math.floor(wuerfel(s) * moeglich.length)];
    var w = e.wirkung;

    if (w.geld) {
      var betrag = Math.max(5000, s.erloesGesamt * 0.02);
      s.geld += betrag;
      melden(s, e.icon, e.name + ': ' + U.euro(Math.round(betrag), true) + ' sofort.', 'gut');
      return;
    }
    if (w.pruefung) {
      var fehlt = S.fehlendeTechnik(s);
      if (fehlt.length) {
        var strafe = Math.max(8000, s.erloesGesamt * 0.015);
        s.geld -= strafe;
        s.kosten.reparatur += strafe;
        melden(s, e.icon, e.name + ': Mängel, ' + U.euro(Math.round(strafe), true)
          + ' Bußgeld.', 'schlecht');
      } else {
        melden(s, e.icon, e.name + ': keine Beanstandung.', 'gut');
      }
      return;
    }
    if (typeof w.kosten === 'number') {
      var k = Math.max(3000, s.erloesGesamt * w.kosten);
      s.geld -= k;
      s.kosten.reparatur += k;
    }
    if (w.tage) {
      s.wirkungen.push({
        id: e.id, name: e.name, icon: e.icon, tage: w.tage,
        leistung: w.leistung || 0,
        foerder: w.foerder || 0,
        ausbeute: w.ausbeute || 0,
        preis: w.preis || 0,
      });
    }
    melden(s, e.icon, e.name + ': ' + e.text,
      (w.ausbeute > 0 || w.preis > 0) ? 'gut' : 'schlecht');
  }

  function wochenWechsel(s) {
    var lohn = S.lohnSumme(s);
    var strompreis = D.STROMPREIS * (1 + forschWert(s, 'strompreis'));
    var strom = S.stromBedarf(s) * strompreis;

    s.kosten.lohn += lohn;
    s.kosten.strom += strom;
    s.geld -= lohn + strom;

    var gewinn = s.einnahmen - (lohn + strom + s.kosten.reparatur);
    var steuer = gewinn > 0 ? gewinn * D.STEUERSATZ : 0;
    s.kosten.steuer += steuer;
    s.geld -= steuer;

    s.letzteWoche = {
      woche: s.woche,
      einnahmen: s.einnahmen,
      lohn: lohn, strom: strom,
      reparatur: s.kosten.reparatur,
      steuer: steuer,
      gewinn: gewinn - steuer,
    };
    s.historie.push({
      woche: s.woche,
      gewinn: Math.round(gewinn - steuer),
      tonnen: Math.round(s.gefoerdert),
      tiefe: Math.round(s.tiefe),
    });
    if (s.historie.length > 60) s.historie.shift();

    melden(s, gewinn - steuer >= 0 ? '📈' : '📉',
      'Woche ' + s.woche + ': ' + U.eurSigned(Math.round(gewinn - steuer)),
      gewinn - steuer >= 0 ? 'gut' : 'schlecht');

    s.einnahmen = 0;
    s.kosten = { lohn: 0, strom: 0, steuer: 0, reparatur: 0 };
    s.woche++;
  }

  /* ---------------------------------------------------------- Sichern */

  S.serialize = function (s) {
    return {
      v: 1,
      seed: s.seed, zufall: s.zufall,
      geld: s.geld, schulden: s.schulden,
      schicht: s.schicht, tag: s.tag, woche: s.woche, teilSchicht: s.teilSchicht,
      tempo: s.tempo, pausiert: s.pausiert,
      tiefe: s.tiefe, teufen: s.teufen, teufenZiel: s.teufenZiel,
      sohlen: s.sohlen.map(function (so) {
        return { tiefe: so.tiefe, geraete: U.assign({}, so.geraete) };
      }),
      foerderStufe: s.foerderStufe,
      technik: U.assign({}, s.technik),
      forschung: U.assign({}, s.forschung),
      personal: U.assign({}, s.personal),
      lager: U.assign({}, s.lager),
      preise: U.assign({}, s.preise),
      autoVerkauf: s.autoVerkauf,
      gefoerdert: s.gefoerdert, erloesGesamt: s.erloesGesamt,
      unfaelle: s.unfaelle, zufrieden: s.zufrieden,
      einnahmen: s.einnahmen, kosten: U.assign({}, s.kosten),
      letzteWoche: s.letzteWoche,
      historie: s.historie.slice(-40),
      wirkungen: s.wirkungen.slice(),
      rang: s.rang, hoechsterRang: s.hoechsterRang,
      tutorialGesehen: s.tutorialGesehen,
    };
  };

  S.deserialize = function (raw) {
    if (!raw || typeof raw !== 'object') return null;
    var s = S.create(raw.seed || 1);
    try {
      s.zufall = raw.zufall || s.zufall;
      s.geld = raw.geld || 0;
      s.schulden = raw.schulden || 0;
      s.schicht = raw.schicht || 0;
      s.tag = raw.tag || 1;
      s.woche = raw.woche || 1;
      s.teilSchicht = raw.teilSchicht || 0;
      s.tempo = raw.tempo || 1;
      s.pausiert = !!raw.pausiert;
      s.tiefe = raw.tiefe || 12;
      s.teufen = !!raw.teufen;
      s.teufenZiel = raw.teufenZiel || 0;
      s.sohlen = (raw.sohlen || []).map(function (so) {
        return { tiefe: so.tiefe, geraete: U.assign({}, so.geraete || {}) };
      });
      if (!s.sohlen.length) s.sohlen = [{ tiefe: s.tiefe, geraete: { hacke: 1 } }];
      s.foerderStufe = raw.foerderStufe || 0;
      s.technik = U.assign({ wasser: 0, stuetzen: 0, luft: 0, kuehlung: 0 }, raw.technik || {});
      s.forschung = U.assign({}, raw.forschung || {});
      s.personal = U.assign({ bergleute: 0, technik: 0, geologen: 0 }, raw.personal || {});
      s.lager = U.assign(s.lager, raw.lager || {});
      s.preise = U.assign(s.preise, raw.preise || {});
      s.autoVerkauf = raw.autoVerkauf !== false;
      s.gefoerdert = raw.gefoerdert || 0;
      s.erloesGesamt = raw.erloesGesamt || 0;
      s.unfaelle = raw.unfaelle || 0;
      s.zufrieden = raw.zufrieden === undefined ? 70 : raw.zufrieden;
      s.einnahmen = raw.einnahmen || 0;
      s.kosten = U.assign({ lohn: 0, strom: 0, steuer: 0, reparatur: 0 }, raw.kosten || {});
      s.letzteWoche = raw.letzteWoche || null;
      s.historie = raw.historie || [];
      s.wirkungen = raw.wirkungen || [];
      s.rang = raw.rang || 0;
      s.hoechsterRang = raw.hoechsterRang || s.rang;
      s.tutorialGesehen = !!raw.tutorialGesehen;
    } catch (e) {
      SG.noteError('mine.deserialize', e);
      return null;
    }
    return s;
  };
})(SG);
