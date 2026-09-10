/* ------------------------------------------------------------------
   Flughafen-Tycoon - Simulation

   Der Kern ist ein Flug. Er kommt an, will landen, braucht ein Gate,
   wird abgefertigt und startet wieder. Alles andere haengt daran:

     Bahnen  begrenzen, wie viele Bewegungen pro Stunde moeglich sind.
     Gates   begrenzen, wie viele Flugzeuge gleichzeitig stehen koennen.
     Personal bestimmt, wie schnell abgefertigt wird.
     Wetter  nimmt Kapazitaet weg.

   Klemmt eine dieser Stellen, warten Fluege in der Schleife. Warten
   kostet Puenktlichkeit, Puenktlichkeit kostet Ruf, und ein schlechter
   Ruf kostet die naechste Fluggesellschaft. Das ist die ganze Kette -
   und sie laeuft in beide Richtungen.

   Der Takt: dt kommt in echten Sekunden herein und wird ueber
   SEK_PRO_STUNDE in Flugplanzeit umgerechnet.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var A = SG.tycoon.air;
  var D = A.data;

  var S = A.sim = {};

  /* ---------------------------------------------------------- Aufbau */

  S.create = function (seed) {
    var s = {
      seed: seed >>> 0,
      zufall: (seed >>> 0) || 12345,

      geld: 6500000,
      schulden: 0,
      entgelt: D.ENTGELT_START,

      /* Zeit */
      uhr: 6,                     // Stunde im Tag, mit Nachkommastellen
      tag: 1, monat: 3, jahr: 1,  // Start im April - gutes Flugwetter
      tempo: 1, pausiert: false,

      /* Anlagen */
      bahnen: [{ stufe: 0 }],
      terminal: 0,                // Index in D.TERMINALS, 0 = das kleine Haus
      gates: [
        { art: 'klein', belegt: null },
        { art: 'klein', belegt: null },
      ],
      anlagen: { feuerwehr: 1, tower: 1 },
      ausbau: {},
      personal: { lotsen: 3, boden: 8, sicherheit: 6, technik: 3 },
      lohn: 1,

      /* Betrieb */
      linien: { kuestenflug: { fluege: 4, zufrieden: 70, aerger: 0 } },
      angebote: [],
      fluege: [],
      flugNr: 1,
      wetter: 'klar',
      wetterRest: 6,
      bewegungenFrei: 0,

      /* Kennzahlen */
      ruf: 14,
      puenktlich: 92,
      paxHeute: 0, paxMonat: 0, paxJahr: 0, paxGesamt: 0,
      jahrTage: 0,
      frachtMonat: 0,
      bewegungenHeute: 0, bewegungenMonat: 0,
      verspaetetHeute: 0, ausfallHeute: 0,
      ausfallGesamt: 0,

      /* Buchhaltung */
      einnahmen: neueKasse(),
      kosten: neueKasse(),
      letzterMonat: null,
      historie: [],

      wirkungen: [],              // laufende Ereignisse
      meldungen: [],
      stufe: 0,
      hoechsteStufe: 0,
      tutorialGesehen: false,
    };
    return s;
  };

  function neueKasse() {
    return {
      landung: 0, passagier: 0, handel: 0, parken: 0, sprit: 0, fracht: 0,
      unterhalt: 0, gehalt: 0, betrieb: 0, zins: 0, steuer: 0, strafe: 0,
    };
  }

  /* Eigener Zufall je Spielstand, damit ein geladener Stand sich gleich
     weiterverhaelt und der Selbsttest reproduzierbar bleibt. */
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

  S.bahnLaenge = function (s) {
    var max = 0;
    for (var i = 0; i < s.bahnen.length; i++) {
      var l = D.BAHN_STUFEN[s.bahnen[i].stufe].laenge;
      if (l > max) max = l;
    }
    return max;
  };

  S.anlage = function (s, id) { return s.anlagen[id] || 0; };
  S.hatAusbau = function (s, id) { return !!s.ausbau[id]; };

  /* Wirkung einer Anlage: erste Stufe voll, jede weitere mit
     abnehmendem Ertrag - sonst waeren zwanzig Ladenzeilen die Loesung
     fuer alles. */
  function anlagenWert(s, id) {
    var def = D.anlage(id);
    if (!def) return 0;
    var n = S.anlage(s, id);
    var summe = 0;
    for (var i = 0; i < n; i++) summe += def.wert * Math.pow(0.82, i);
    return summe;
  }
  S.anlagenWert = anlagenWert;

  /* Bewegungen je Stunde - die harte Obergrenze des Flughafens */
  S.kapazitaet = function (s) {
    var basis = s.bahnen.length * D.BAHN_KAPAZITAET;
    basis *= 1 + anlagenWert(s, 'tower') + anlagenWert(s, 'rollweg');
    if (S.hatAusbau(s, 'radar')) basis *= 1.18;

    // Lotsen: je 9 Bewegungen einer, darunter wird gedrosselt
    var noetig = basis / 9;
    var haben = s.personal.lotsen || 0;
    if (haben < noetig) basis *= Math.max(0.3, haben / Math.max(1, noetig));

    var w = D.wetter(s.wetter);
    var wf = w.kapazitaet;
    if (w.ils) wf += ilsBonus(s) * (1 - w.kapazitaet);
    if (w.winter) wf += anlagenWert(s, 'enteisung') * (1 - w.kapazitaet);
    basis *= Math.min(1, wf);

    basis *= 1 + summeWirkung(s, 'kapazitaet');
    return Math.max(2, Math.round(basis));
  };

  function ilsBonus(s) {
    if (S.hatAusbau(s, 'ils3')) return 0.95;
    if (S.hatAusbau(s, 'ils2')) return 0.72;
    if (S.hatAusbau(s, 'ils1')) return 0.45;
    return 0;
  }

  /* Wie schnell abgefertigt wird. 1 = nach Plan, darunter dauert es. */
  S.bodenTempo = function (s) {
    var noetig = s.gates.length * 1.6 + 3;
    var haben = s.personal.boden || 0;
    var f = Math.min(1.35, 0.35 + 0.65 * (haben / Math.max(1, noetig)));
    f *= 1 + anlagenWert(s, 'gepaeck');
    if (S.hatAusbau(s, 'selbst')) f *= 1.08;
    f *= 1 + summeWirkung(s, 'boden');
    f *= zufriedenheit(s) < 40 ? 0.85 : 1;
    return Math.max(0.25, f);
  };

  /* Zufriedenheit der Belegschaft - haengt am Lohnniveau und daran,
     ob genug Leute da sind. */
  function zufriedenheit(s) {
    var lohn = D.LOHN_STUFEN[s.lohn].f;
    var z = 50 + (lohn - 1) * 130;
    var noetig = s.gates.length * 1.6 + 3;
    var haben = s.personal.boden || 0;
    z += Math.min(20, (haben - noetig) * 4);
    return U.clamp(Math.round(z), 0, 100);
  }
  S.zufriedenheit = zufriedenheit;

  /* Komfort fuer die Passagiere - geht in den Ruf ein */
  S.komfort = function (s) {
    var k = 0;
    for (var i = 0; i < s.gates.length; i++) k += D.gateArt(s.gates[i].art).komfort;
    k += anlagenWert(s, 'lounge');
    k += anlagenWert(s, 'handel') * 0.02;
    if (S.hatAusbau(s, 'selbst')) k += 0.03;
    if (S.hatAusbau(s, 'sicherheit')) k += 0.05;
    if (S.hatAusbau(s, 'bahn')) k += 0.04;

    // Zu wenig Sicherheitspersonal spuert jeder in der Schlange
    var noetig = Math.max(2, Math.round(s.paxHeute / 900));
    if ((s.personal.sicherheit || 0) < noetig) k -= 0.12;
    return k;
  };

  /* Freie Gate-Plaetze im Terminal */
  S.gatePlaetze = function (s) {
    var p = 0;
    for (var i = 0; i <= s.terminal; i++) p += D.TERMINALS[i].plaetze;
    return p;
  };

  S.terminalKapazitaet = function (s) {
    var k = 0;
    for (var i = 0; i <= s.terminal; i++) k += D.TERMINALS[i].kapazitaet;
    if (S.hatAusbau(s, 'sicherheit')) k *= 1.5;
    return k;
  };

  /* Brandschutzkategorie begrenzt die Flugzeuggroesse */
  S.brandschutz = function (s) {
    return Math.min(5, 1 + (S.anlage(s, 'feuerwehr') || 0));
  };

  /* Groesstes Muster, das hier ueberhaupt landen darf */
  S.groessteKlasse = function (s) {
    var bahn = S.bahnLaenge(s);
    var brand = S.brandschutz(s);
    var g = 0;
    for (var i = 0; i < D.MUSTER.length; i++) {
      var m = D.MUSTER[i];
      if (m.bahn <= bahn && m.groesse <= brand && m.groesse > g) g = m.groesse;
    }
    return g;
  };

  /* ---------------------------------------------------------- Wirkungen */

  function summeWirkung(s, feld) {
    var summe = 0;
    for (var i = 0; i < s.wirkungen.length; i++) {
      var w = s.wirkungen[i];
      if (typeof w[feld] === 'number') summe += w[feld];
    }
    return summe;
  }
  S.summeWirkung = summeWirkung;

  /* ---------------------------------------------------------- Geld */

  S.monatsUmsatz = function (s) {
    if (s.letzterMonat) {
      var e = s.letzterMonat.einnahmen;
      return e.landung + e.passagier + e.handel + e.parken + e.sprit + e.fracht;
    }
    var k = s.einnahmen;
    return k.landung + k.passagier + k.handel + k.parken + k.sprit + k.fracht;
  };

  S.kreditRahmen = function (s) {
    var max = Math.max(4000000, S.monatsUmsatz(s) * D.KREDIT_MAX_FAKTOR);
    return Math.max(0, Math.round(max - s.schulden));
  };

  S.aufnehmen = function (s, betrag) {
    betrag = Math.round(betrag);
    if (betrag <= 0) return 'Kein Betrag.';
    if (betrag > S.kreditRahmen(s)) return 'So viel gibt die Bank nicht.';
    s.schulden += betrag;
    s.geld += betrag;
    melden(s, '🏦', 'Kredit über ' + U.euro(betrag, true) + ' aufgenommen.');
    return null;
  };

  S.tilgen = function (s, betrag) {
    betrag = Math.min(Math.round(betrag), s.schulden, Math.floor(s.geld));
    if (betrag <= 0) return 'Nichts zu tilgen.';
    s.schulden -= betrag;
    s.geld -= betrag;
    melden(s, '🏦', U.euro(betrag, true) + ' getilgt.');
    return null;
  };

  /* ---------------------------------------------------------- Bauen */

  S.bahnPreis = function (s) {
    var i = Math.min(s.bahnen.length, D.BAHN_BAU.length - 1);
    return D.BAHN_BAU[i];
  };

  S.bahnBauen = function (s) {
    if (s.bahnen.length >= 3) return 'Mehr als drei Bahnen gibt das Gelände nicht her.';
    var preis = S.bahnPreis(s);
    if (s.geld < preis) return 'Dafür fehlt das Geld.';
    s.geld -= preis;
    s.bahnen.push({ stufe: 0 });
    melden(s, '🛬', 'Bahn ' + s.bahnen.length + ' eröffnet.', 'gut');
    return null;
  };

  S.bahnVerlaengern = function (s, index) {
    var b = s.bahnen[index];
    if (!b) return 'Diese Bahn gibt es nicht.';
    if (b.stufe >= D.BAHN_STUFEN.length - 1) return 'Länger geht es nicht.';
    var preis = D.BAHN_STUFEN[b.stufe + 1].kosten;
    if (s.geld < preis) return 'Dafür fehlt das Geld.';
    s.geld -= preis;
    b.stufe++;
    melden(s, '🛫', 'Bahn ' + (index + 1) + ' auf '
      + D.formatBahn(D.BAHN_STUFEN[b.stufe].laenge) + ' verlängert.', 'gut');
    return null;
  };

  S.gatePreis = function (s, artId) {
    var art = D.gateArt(artId);
    var vorhanden = 0;
    for (var i = 0; i < s.gates.length; i++) if (s.gates[i].art === artId) vorhanden++;
    return Math.round(art.kosten * Math.pow(D.GATE_STEIGERUNG, vorhanden));
  };

  S.gateBauen = function (s, artId) {
    if (s.gates.length >= S.gatePlaetze(s)) {
      return 'Das Terminal ist voll — erst erweitern.';
    }
    var preis = S.gatePreis(s, artId);
    if (s.geld < preis) return 'Dafür fehlt das Geld.';
    s.geld -= preis;
    s.gates.push({ art: artId, belegt: null });
    melden(s, '🚪', D.gateArt(artId).name + ' gebaut (' + s.gates.length + ' Gates).', 'gut');
    return null;
  };

  S.gateAbreissen = function (s, index) {
    var g = s.gates[index];
    if (!g) return 'Dieses Gate gibt es nicht.';
    if (g.belegt !== null) return 'Da steht ein Flugzeug.';
    if (s.gates.length <= 1) return 'Ganz ohne Gate geht es nicht.';
    s.geld += Math.round(S.gatePreis(s, g.art) * 0.3);
    s.gates.splice(index, 1);
    // Belegungen zeigen auf Gate-Indizes, die sich verschoben haben
    for (var i = 0; i < s.fluege.length; i++) {
      var f = s.fluege[i];
      if (f.gate === null || f.gate === undefined) continue;
      if (f.gate > index) f.gate--;
    }
    melden(s, '🧨', 'Gate abgerissen.');
    return null;
  };

  S.terminalPreis = function (s) {
    var n = s.terminal + 1;
    if (n >= D.TERMINALS.length) return null;
    return D.TERMINALS[n].kosten;
  };

  S.terminalBauen = function (s) {
    var preis = S.terminalPreis(s);
    if (preis === null) return 'Mehr Terminals sind nicht geplant.';
    if (s.geld < preis) return 'Dafür fehlt das Geld.';
    s.geld -= preis;
    s.terminal++;
    melden(s, '🏢', D.TERMINALS[s.terminal].name + ' eröffnet.', 'gut');
    return null;
  };

  S.anlagePreis = function (s, id) {
    var def = D.anlage(id);
    if (!def) return 0;
    return Math.round(def.kosten * Math.pow(def.steigerung, S.anlage(s, id)));
  };

  S.anlageBauen = function (s, id) {
    var def = D.anlage(id);
    if (!def) return 'Unbekannte Anlage.';
    if (S.anlage(s, id) >= def.stufen) return 'Höher geht es nicht.';
    var preis = S.anlagePreis(s, id);
    if (s.geld < preis) return 'Dafür fehlt das Geld.';
    s.geld -= preis;
    s.anlagen[id] = S.anlage(s, id) + 1;
    melden(s, def.icon, def.name + ' auf Stufe ' + s.anlagen[id] + '.', 'gut');
    return null;
  };

  S.ausbauKaufen = function (s, id) {
    var def = D.ausbau(id);
    if (!def) return 'Unbekannter Ausbau.';
    if (s.ausbau[id]) return 'Steht schon.';
    if (def.braucht && !s.ausbau[def.braucht]) {
      return 'Erst ' + D.ausbau(def.braucht).name + '.';
    }
    if (s.geld < def.kosten) return 'Dafür fehlt das Geld.';
    s.geld -= def.kosten;
    s.ausbau[id] = true;
    melden(s, def.icon, def.name + ' fertig.', 'gut');
    return null;
  };

  S.einstellen = function (s, id, anzahl) {
    var def = D.personal(id);
    if (!def) return 'Unbekannt.';
    s.personal[id] = Math.max(0, (s.personal[id] || 0) + anzahl);
    return null;
  };

  S.entgeltSetzen = function (s, wert) {
    s.entgelt = U.clamp(Math.round(wert), D.ENTGELT_MIN, D.ENTGELT_MAX);
  };

  /* ---------------------------------------------------------- Linien */

  S.vertragAnnehmen = function (s, id) {
    var def = D.linie(id);
    if (!def) return 'Unbekannte Gesellschaft.';
    if (s.linien[id]) return 'Läuft schon.';
    if (S.bahnLaenge(s) < def.mindestBahn) {
      return 'Die Bahn ist zu kurz — mindestens ' + D.formatBahn(def.mindestBahn) + '.';
    }
    if (def.brauchtAusbau && !s.ausbau[def.brauchtAusbau]) {
      return 'Es fehlt: ' + D.ausbau(def.brauchtAusbau).name + '.';
    }
    if (def.brauchtAnlage && !S.anlage(s, def.brauchtAnlage)) {
      return 'Es fehlt: ' + D.anlage(def.brauchtAnlage).name + '.';
    }
    s.linien[id] = { fluege: def.fluege, zufrieden: 70, aerger: 0 };
    U.remove(s.angebote, id);
    melden(s, def.icon, def.name + ' fliegt ab sofort hier.', 'gut');
    return null;
  };

  S.vertragKuendigen = function (s, id) {
    if (!s.linien[id]) return 'Diese Linie fliegt nicht hier.';
    delete s.linien[id];
    s.ruf = Math.max(0, s.ruf - 3);
    melden(s, '📄', D.linie(id).name + ' wurde gekündigt.', 'schlecht');
    return null;
  };

  /* Welche Gesellschaften wuerden hier landen wollen? */
  S.moegliche = function (s) {
    var raus = [];
    for (var i = 0; i < D.LINIEN.length; i++) {
      var def = D.LINIEN[i];
      if (s.linien[def.id]) continue;
      if (s.ruf < def.mindestRuf) continue;
      raus.push(def);
    }
    return raus;
  };

  /* ---------------------------------------------------------- Fluege */

  /* Wie voll die Flugzeuge sind. Haengt an Ruf, Entgelt (die Linien
     geben es weiter) und an laufenden Ereignissen. */
  S.auslastung = function (s) {
    var a = 0.52 + s.ruf / 260;
    a *= Math.pow(D.ENTGELT_START / Math.max(1, s.entgelt), 0.18);
    a *= 1 + summeWirkung(s, 'nachfrage');
    if (S.hatAusbau(s, 'bahn')) a += 0.04;
    if (S.hatAusbau(s, 'drehkreuz')) a += 0.05;
    return U.clamp(a, 0.2, 0.98);
  };

  /* Wie viele Fluege eine Linie pro Tag wirklich schickt */
  S.fluegeProTag = function (s, id) {
    var st = s.linien[id];
    var def = D.linie(id);
    if (!st || !def) return 0;
    var f = st.fluege;
    f *= Math.pow(D.ENTGELT_START / Math.max(1, s.entgelt), 0.5);
    f *= 0.7 + (st.zufrieden / 100) * 0.6;
    f *= 1 + s.ruf / 100;                        // ein guter Ruf fuellt den Flugplan
    f *= 1 + summeWirkung(s, 'nachfrage');
    if (S.hatAusbau(s, 'nachtflug')) f *= 1.15;
    return Math.max(0, f);
  };

  /* Tagesverlauf: morgens und abends Wellen, nachts fast nichts */
  var STUNDENKURVE = [
    0.02, 0.01, 0.01, 0.01, 0.02, 0.05, 0.08, 0.09, 0.08, 0.06, 0.05, 0.05,
    0.05, 0.05, 0.05, 0.06, 0.07, 0.08, 0.07, 0.05, 0.04, 0.03, 0.02, 0.02,
  ];

  function darfFliegen(s, stunde) {
    if (stunde >= 6 && stunde < 23) return true;
    return S.hatAusbau(s, 'nachtflug');
  }

  /* Baut die Ankuenfte einer Stunde */
  function stundeFuellen(s, stunde) {
    if (!darfFliegen(s, stunde)) return;
    var anteil = STUNDENKURVE[stunde] / 0.05;    // 1 = Durchschnittsstunde
    var groesste = S.groessteKlasse(s);

    for (var id in s.linien) {
      var def = D.linie(id);
      if (!def) continue;
      var proTag = S.fluegeProTag(s, id);
      var erwartet = (proTag / 17) * anteil;     // 17 Betriebsstunden
      var n = Math.floor(erwartet);
      if (wuerfel(s) < erwartet - n) n++;

      for (var k = 0; k < n; k++) {
        var muster = musterWaehlen(s, def, groesste);
        if (!muster) continue;
        s.fluege.push({
          nr: s.flugNr++,
          linie: id,
          muster: muster.id,
          pax: Math.round(muster.pax * S.auslastung(s)),
          fracht: muster.fracht,
          phase: 'anflug',
          t: 0,
          warte: 0,
          gate: null,
          x: 0, y: 0,
        });
      }
    }
  }

  /* Groesstes Muster, das die Linie hier einsetzen kann */
  function musterWaehlen(s, def, groesste) {
    var moeglich = [];
    for (var i = 0; i < def.muster.length; i++) {
      var m = D.musterVon(def.muster[i]);
      if (m.groesse <= groesste && m.bahn <= S.bahnLaenge(s)) moeglich.push(m);
    }
    if (!moeglich.length) return null;
    /* Fracht braucht ein Frachtzentrum */
    var gefiltert = moeglich.filter(function (m) {
      return m.id !== 'fracht' || S.anlage(s, 'fracht') > 0;
    });
    if (!gefiltert.length) return null;
    return gefiltert[Math.floor(wuerfel(s) * gefiltert.length)];
  }

  /* Freies, passendes Gate - das kleinste, das reicht */
  function gateSuchen(s, muster) {
    var besterIndex = -1;
    var besteGroesse = 99;
    for (var i = 0; i < s.gates.length; i++) {
      var g = s.gates[i];
      if (g.belegt !== null) continue;
      var art = D.gateArt(g.art);
      if (art.groesse < muster.groesse) continue;
      if (art.groesse < besteGroesse) { besteGroesse = art.groesse; besterIndex = i; }
    }
    return besterIndex;
  }

  /* ---------------------------------------------------------- Takt */

  S.step = function (s, dt) {
    if (s.pausiert) return;
    dt = Math.min(dt, 0.25) * s.tempo;
    var stunden = dt / D.SEK_PRO_STUNDE;
    var minuten = stunden * 60;

    var vorher = Math.floor(s.uhr);
    s.uhr += stunden;

    /* Stundengrenzen: Kapazitaet neu, neue Ankuenfte */
    var neueStunde = Math.floor(s.uhr);
    while (neueStunde > vorher) {
      vorher++;
      var st = ((vorher % 24) + 24) % 24;
      s.bewegungenFrei = S.kapazitaet(s);
      stundeFuellen(s, st);
      wetterTakt(s);
    }

    if (s.uhr >= 24) {
      s.uhr -= 24;
      tagesWechsel(s);
    }

    fluegeTakt(s, minuten);
  };

  /* Ein Flug wandert durch seine Phasen. Alle Zeiten in Minuten. */
  function fluegeTakt(s, minuten) {
    var tempo = S.bodenTempo(s);

    for (var i = s.fluege.length - 1; i >= 0; i--) {
      var f = s.fluege[i];
      var m = D.musterVon(f.muster);
      f.t += minuten;

      if (f.phase === 'anflug') {
        // Anflug dauert acht Minuten, danach braucht es eine Bewegung
        if (f.t < 8) continue;
        if (s.bewegungenFrei > 0) {
          s.bewegungenFrei--;
          s.bewegungenHeute++;
          s.bewegungenMonat++;
          f.phase = 'landung';
          f.t = 0;
        } else {
          f.warte += minuten;
          if (f.warte > 55) { umleiten(s, f, i); }
        }
        continue;
      }

      if (f.phase === 'landung') {
        if (f.t < 2) continue;
        var g = gateSuchen(s, m);
        if (g < 0) {
          // Gelandet, aber kein Platz: Warteposition auf dem Vorfeld
          f.warte += minuten;
          if (f.warte > 70) { umleiten(s, f, i); }
          continue;
        }
        s.gates[g].belegt = f.nr;
        f.gate = g;
        f.phase = 'rollen';
        f.t = 0;
        continue;
      }

      if (f.phase === 'rollen') {
        if (f.t < 4) continue;
        f.phase = 'gate';
        f.t = 0;
        ankunftBuchen(s, f, m);
        continue;
      }

      if (f.phase === 'gate') {
        if (f.t < m.boden / tempo) continue;
        f.phase = 'abrollen';
        f.t = 0;
        abflugBuchen(s, f, m);
        if (f.gate !== null && s.gates[f.gate]) s.gates[f.gate].belegt = null;
        continue;
      }

      if (f.phase === 'abrollen') {
        if (f.t < 5) continue;
        if (s.bewegungenFrei > 0) {
          s.bewegungenFrei--;
          s.bewegungenHeute++;
          s.bewegungenMonat++;
          f.phase = 'start';
          f.t = 0;
        } else {
          f.warte += minuten;
        }
        continue;
      }

      if (f.phase === 'start') {
        if (f.t < 3) continue;
        if (f.warte > 15) s.verspaetetHeute++;
        s.fluege.splice(i, 1);
      }
    }
  }

  function umleiten(s, f, index) {
    var def = D.linie(f.linie);
    s.ausfallHeute++;
    s.ausfallGesamt++;
    s.kosten.strafe += 25000;
    s.geld -= 25000;
    if (f.gate !== null && s.gates[f.gate]) s.gates[f.gate].belegt = null;
    /* Der Aerger wird gesammelt und einmal am Tag verrechnet. Sonst
       raeumt ein einziger Sturmtag mit dreissig Umleitungen den halben
       Flugplan ab, und die Linie ist fuer immer weg. */
    if (s.linien[f.linie]) {
      s.linien[f.linie].aerger = (s.linien[f.linie].aerger || 0) + 1;
    }
    melden(s, '↩', (def ? def.name : 'Ein Flug') + ' musste ausweichen — '
      + 'kein Platz, keine Bahn.', 'schlecht');
    s.fluege.splice(index, 1);
  }

  function ankunftBuchen(s, f, m) {
    var def = D.linie(f.linie);
    var tarif = def ? def.tarif : 1;

    var landung = m.entgelt * tarif;
    s.einnahmen.landung += landung;
    s.geld += landung;

    if (m.id === 'fracht') {
      var fracht = f.fracht * D.FRACHT_PREIS * (1 + anlagenWert(s, 'fracht') * 0.2);
      s.einnahmen.fracht += fracht;
      s.frachtMonat += f.fracht;
      s.geld += fracht;
    }

    var sprit = anlagenWert(s, 'sprit') * m.pax * 2.4;
    if (sprit > 0) { s.einnahmen.sprit += sprit; s.geld += sprit; }
  }

  function abflugBuchen(s, f, m) {
    if (!f.pax) return;
    var pax = f.pax;

    /* Ein zu kleines Terminal laesst nicht alle durch - der Rest kommt
       gar nicht erst, und das merkt der Ruf. */
    var kapazitaet = S.terminalKapazitaet(s);
    if (s.paxHeute > kapazitaet) {
      pax = Math.round(pax * 0.6);
      if (wuerfel(s) < 0.04) {
        melden(s, '🧍', 'Das Terminal ist überfüllt. Die Schlangen reichen bis vor die Tür.',
          'schlecht');
      }
    }

    s.paxHeute += pax;
    s.paxMonat += pax;
    s.paxJahr += pax;
    s.paxGesamt += pax;

    var passagier = pax * s.entgelt;
    var handel = pax * anlagenWert(s, 'handel') * (1 + summeWirkung(s, 'handel'));
    var parken = pax * D.PARK_QUOTE * anlagenWert(s, 'parken');
    if (S.hatAusbau(s, 'bahn')) parken *= 0.8;     // wer Bahn faehrt, parkt nicht

    s.einnahmen.passagier += passagier;
    s.einnahmen.handel += handel;
    s.einnahmen.parken += parken;
    s.geld += passagier + handel + parken;
  }

  /* ---------------------------------------------------------- Wetter */

  function wetterTakt(s) {
    s.wetterRest--;
    if (s.wetterRest > 0) return;
    var liste = D.WETTER_MONAT[s.monat % 12];
    s.wetter = liste[Math.floor(wuerfel(s) * liste.length)];
    s.wetterRest = 3 + Math.floor(wuerfel(s) * 9);
  }

  /* ---------------------------------------------------------- Tag */

  function tagesWechsel(s) {
    /* Puenktlichkeit als gleitender Wert - ein schlechter Tag reisst
       nicht alles ein, eine schlechte Woche schon. */
    var bewegungen = Math.max(1, s.bewegungenHeute);
    var stoerung = (s.verspaetetHeute + s.ausfallHeute * 3) / bewegungen;
    var heute = U.clamp(100 - stoerung * 210, 0, 100);
    s.puenktlich = s.puenktlich * 0.82 + heute * 0.18;

    rufTakt(s);

    s.verspaetetHeute = 0;
    s.ausfallHeute = 0;
    s.bewegungenHeute = 0;
    s.paxHeute = 0;

    /* Laufende Ereignisse ablaufen lassen */
    for (var i = s.wirkungen.length - 1; i >= 0; i--) {
      s.wirkungen[i].tage--;
      if (s.wirkungen[i].tage <= 0) s.wirkungen.splice(i, 1);
    }

    if (wuerfel(s) < 0.13) ereignisZiehen(s);

    s.tag++;
    s.jahrTage++;
    if (s.tag > D.TAGE_PRO_MONAT) {
      s.tag = 1;
      monatsWechsel(s);
    }
  }

  function rufTakt(s) {
    var ziel = 0;
    ziel += (s.puenktlich - 55) * 0.9;          // Puenktlichkeit ist alles
    ziel += S.komfort(s) * 120;
    ziel += Math.min(18, s.gates.length * 0.7);
    ziel += S.hatAusbau(s, 'nachtflug') ? -6 : 0;
    ziel += summeWirkung(s, 'ruf') * 4;
    ziel = U.clamp(ziel, 0, 100);
    s.ruf = U.clamp(s.ruf + (ziel - s.ruf) * 0.06, 0, 100);

    /* Zufriedenheit der Linien zieht der Puenktlichkeit nach */
    for (var id in s.linien) {
      var st = s.linien[id];
      var def = D.linie(id);
      var zielZ = U.clamp(s.puenktlich * 0.7 + s.ruf * 0.3, 0, 100);
      var traegheit = def ? def.bindung : 0.85;
      st.zufrieden = st.zufrieden * traegheit + zielZ * (1 - traegheit);

      /* Hoechstens 12 Punkte Tagesschaden - ein schlechter Tag aergert,
         eine schlechte Woche vertreibt. */
      if (st.aerger) {
        st.zufrieden = Math.max(0, st.zufrieden - Math.min(12, st.aerger * 2));
        st.aerger = 0;
      }
      /* Wer zufrieden ist, stockt auf. Ohne das bliebe der Flugplan
         fuer immer so duenn wie am ersten Tag - ein Drehkreuz waere
         rechnerisch unerreichbar. */
      if (def && st.zufrieden > 74 && wuerfel(s) < 0.09) {
        var deckel = def.fluege * 8;
        if (st.fluege < deckel) {
          st.fluege++;
          melden(s, def.icon, def.name + ' stockt auf ' + st.fluege
            + ' Flüge am Tag auf.', 'gut');
        }
      }

      if (st.zufrieden < 22 && wuerfel(s) < 0.2) {
        delete s.linien[id];
        s.ruf = Math.max(0, s.ruf - 4);
        melden(s, '📄', (def ? def.name : 'Eine Linie')
          + ' zieht ab. Zu viele Verspätungen.', 'schlecht');
      }
    }

    /* Neue Anfragen */
    var offen = S.moegliche(s);
    if (offen.length && wuerfel(s) < 0.10) {
      var def2 = offen[Math.floor(wuerfel(s) * offen.length)];
      if (s.angebote.indexOf(def2.id) < 0) {
        s.angebote.push(def2.id);
        melden(s, '🤝', def2.name + ' fragt an — Vertrag liegt im Büro.', 'gut');
      }
    }

    /* Die Hochrechnung, nicht der Jahresstand: sonst faellt der Rang
       jeden Januar zusammen, weil das Jahr bei null anfaengt. */
    var neueStufe = D.stufeVon(S.paxProJahr(s), s.ruf, S.bahnLaenge(s), s.gates.length);
    if (neueStufe > s.stufe) {
      s.stufe = neueStufe;
      if (neueStufe > s.hoechsteStufe) s.hoechsteStufe = neueStufe;
      melden(s, D.STUFEN[neueStufe].icon,
        'Neuer Rang: ' + D.STUFEN[neueStufe].name + '.', 'gut');
    } else if (neueStufe < s.stufe) {
      s.stufe = neueStufe;
    }
  }

  /* ---------------------------------------------------------- Ereignisse */

  function ereignisZiehen(s) {
    var moeglich = D.EREIGNISSE.filter(function (e) {
      if (e.bedingung === 'unzufrieden') return zufriedenheit(s) < 42;
      if (e.bedingung === 'puenktlich') return s.puenktlich > 90 && s.ruf > 30;
      if (e.bedingung === 'laut') return s.bewegungenMonat > 900;
      if (e.bedingung === 'technikarm') return (s.personal.technik || 0) < s.gates.length / 3;
      return true;
    });
    if (!moeglich.length) return;

    var e = moeglich[Math.floor(wuerfel(s) * moeglich.length)];
    var w = e.wirkung;

    if (typeof w.kosten === 'number') {
      s.geld -= w.kosten;
      s.kosten.betrieb += w.kosten;
    }
    if (w.geld === 'zuschuss') {
      var betrag = Math.round(600000 + s.stufe * 900000);
      s.geld += betrag;
      s.einnahmen.landung += 0;   // Zuschuss zaehlt nicht als Umsatz
      melden(s, e.icon, e.name + ': ' + U.euro(betrag, true) + ' vom Land.', 'gut');
      return;
    }
    if (w.pruefung) {
      if ((s.personal.technik || 0) < 2) {
        var strafe = 400000;
        s.geld -= strafe;
        s.kosten.strafe += strafe;
        melden(s, e.icon, e.name + ': Mängel gefunden, ' + U.euro(strafe, true)
          + ' Bußgeld.', 'schlecht');
      } else {
        melden(s, e.icon, e.name + ': alles in Ordnung.', 'gut');
      }
      return;
    }
    if (w.anfrage) {
      var offen = S.moegliche(s);
      if (!offen.length) return;
      var def = offen[Math.floor(wuerfel(s) * offen.length)];
      if (s.angebote.indexOf(def.id) < 0) s.angebote.push(def.id);
      melden(s, e.icon, e.name + ': ' + def.name + ' liegt im Büro.', 'gut');
      return;
    }
    if (typeof w.ruf === 'number') {
      s.ruf = U.clamp(s.ruf + w.ruf, 0, 100);
    }

    if (w.tage) {
      s.wirkungen.push({
        id: e.id, name: e.name, icon: e.icon, tage: w.tage,
        nachfrage: w.nachfrage || 0,
        boden: w.boden || 0,
        kapazitaet: w.kapazitaet || 0,
        handel: w.handel || 0,
      });
    }
    melden(s, e.icon, e.name + ': ' + e.text, w.nachfrage > 0 || w.ruf > 0 ? 'gut' : 'schlecht');
  }

  /* ---------------------------------------------------------- Monat */

  function monatsWechsel(s) {
    /* Unterhalt */
    var unterhalt = s.bahnen.length * D.BAHN_UNTERHALT;
    for (var i = 0; i <= s.terminal; i++) unterhalt += D.TERMINALS[i].unterhalt;
    for (i = 0; i < s.gates.length; i++) unterhalt += D.gateArt(s.gates[i].art).unterhalt;
    for (var id in s.anlagen) {
      var def = D.anlage(id);
      if (def) unterhalt += def.unterhalt * s.anlagen[id];
    }
    if (S.hatAusbau(s, 'solar')) unterhalt *= 0.9;

    /* Gehaelter */
    var gehalt = 0;
    var lohnF = D.LOHN_STUFEN[s.lohn].f;
    for (id in s.personal) {
      var p = D.personal(id);
      if (p) gehalt += p.gehalt * s.personal[id] * lohnF;
    }

    var zins = s.schulden * D.KREDIT_ZINS;

    s.kosten.unterhalt += unterhalt;
    s.kosten.gehalt += gehalt;
    s.kosten.zins += zins;
    s.geld -= unterhalt + gehalt + zins;

    /* Steuer auf den Gewinn vor Steuer */
    var ein = s.einnahmen;
    var aus = s.kosten;
    var umsatz = ein.landung + ein.passagier + ein.handel + ein.parken + ein.sprit + ein.fracht;
    var ausgaben = aus.unterhalt + aus.gehalt + aus.betrieb + aus.zins + aus.strafe;
    var gewinn = umsatz - ausgaben;
    var steuer = gewinn > 0 ? gewinn * D.STEUERSATZ : 0;
    s.kosten.steuer += steuer;
    s.geld -= steuer;

    s.letzterMonat = {
      monat: s.monat, jahr: s.jahr,
      einnahmen: s.einnahmen, kosten: s.kosten,
      umsatz: umsatz, gewinn: gewinn - steuer,
      pax: s.paxMonat, bewegungen: s.bewegungenMonat, fracht: s.frachtMonat,
    };
    s.historie.push({
      monat: s.monat, jahr: s.jahr,
      gewinn: Math.round(gewinn - steuer),
      pax: s.paxMonat,
      ruf: Math.round(s.ruf),
    });
    if (s.historie.length > 60) s.historie.shift();

    s.einnahmen = neueKasse();
    s.kosten = neueKasse();
    s.paxMonat = 0;
    s.bewegungenMonat = 0;
    s.frachtMonat = 0;

    melden(s, gewinn - steuer >= 0 ? '📈' : '📉',
      U.MONTHS[s.monat] + ': ' + U.eurSigned(Math.round(gewinn - steuer), true)
      + ' · ' + U.num(s.letzterMonat.pax) + ' Passagiere',
      gewinn - steuer >= 0 ? 'gut' : 'schlecht');

    s.monat++;
    if (s.monat > 11) {
      s.monat = 0;
      s.jahr++;
      s.paxJahr = 0;
      s.jahrTage = 0;
    }

    /* Pleite? Die Bank streckt einmal, danach ist Schluss. */
    if (s.geld < -2000000) {
      var hilfe = Math.min(S.kreditRahmen(s), 4000000);
      if (hilfe > 500000) {
        s.schulden += hilfe;
        s.geld += hilfe;
        melden(s, '🏦', 'Die Bank hat automatisch ' + U.euro(hilfe, true)
          + ' nachgeschossen.', 'schlecht');
      }
    }
  }

  /* ---------------------------------------------------------- Kennzahlen */

  S.paxProJahr = function (s) {
    /* Hochrechnung aus den Tagen, die seit dem Jahreswechsel wirklich
       geflogen wurden - nicht aus dem Kalendermonat. Das Spiel faengt im
       April an, da waeren drei Monate Verkehr schlicht erfunden. */
    var tage = Math.max(1, s.jahrTage);
    if (tage < 4) return Math.round(s.paxJahr / tage * 360 * (tage / 4));
    return Math.round(s.paxJahr / tage * (D.TAGE_PRO_MONAT * 12));
  };

  S.gatesFrei = function (s) {
    var n = 0;
    for (var i = 0; i < s.gates.length; i++) if (s.gates[i].belegt === null) n++;
    return n;
  };

  S.imAnflug = function (s) {
    var n = 0;
    for (var i = 0; i < s.fluege.length; i++) {
      if (s.fluege[i].phase === 'anflug' || s.fluege[i].phase === 'landung') n++;
    }
    return n;
  };

  S.wartend = function (s) {
    var n = 0;
    for (var i = 0; i < s.fluege.length; i++) if (s.fluege[i].warte > 10) n++;
    return n;
  };

  /* ---------------------------------------------------------- Sichern */

  S.serialize = function (s) {
    return {
      v: 1,
      seed: s.seed, zufall: s.zufall,
      geld: Math.round(s.geld), schulden: Math.round(s.schulden),
      entgelt: s.entgelt,
      uhr: s.uhr, tag: s.tag, monat: s.monat, jahr: s.jahr,
      tempo: s.tempo, pausiert: s.pausiert,
      bahnen: s.bahnen.map(function (b) { return b.stufe; }),
      terminal: s.terminal,
      gates: s.gates.map(function (g) { return g.art; }),
      anlagen: U.assign({}, s.anlagen),
      ausbau: U.assign({}, s.ausbau),
      personal: U.assign({}, s.personal),
      lohn: s.lohn,
      linien: JSON.parse(JSON.stringify(s.linien)),
      angebote: s.angebote.slice(),
      wetter: s.wetter, wetterRest: s.wetterRest,
      ruf: s.ruf, puenktlich: s.puenktlich,
      paxJahr: s.paxJahr, paxGesamt: s.paxGesamt, paxMonat: s.paxMonat,
      jahrTage: s.jahrTage,
      bewegungenMonat: s.bewegungenMonat, frachtMonat: s.frachtMonat,
      ausfallGesamt: s.ausfallGesamt,
      einnahmen: U.assign({}, s.einnahmen),
      kosten: U.assign({}, s.kosten),
      letzterMonat: s.letzterMonat,
      historie: s.historie.slice(-40),
      wirkungen: s.wirkungen.slice(),
      stufe: s.stufe, hoechsteStufe: s.hoechsteStufe,
      tutorialGesehen: s.tutorialGesehen,
      flugNr: s.flugNr,
    };
  };

  S.deserialize = function (raw) {
    if (!raw || typeof raw !== 'object') return null;
    var s = S.create(raw.seed || 1);
    try {
      s.zufall = raw.zufall || s.zufall;
      s.geld = raw.geld || 0;
      s.schulden = raw.schulden || 0;
      s.entgelt = raw.entgelt || D.ENTGELT_START;
      s.uhr = raw.uhr || 6;
      s.tag = raw.tag || 1;
      s.monat = raw.monat || 0;
      s.jahr = raw.jahr || 1;
      s.tempo = raw.tempo || 1;
      s.pausiert = !!raw.pausiert;

      s.bahnen = (raw.bahnen || [0]).map(function (st) { return { stufe: st }; });
      s.terminal = raw.terminal || 0;
      s.gates = (raw.gates || ['klein']).map(function (a) {
        return { art: a, belegt: null };
      });
      s.anlagen = U.assign({}, raw.anlagen || {});
      s.ausbau = U.assign({}, raw.ausbau || {});
      s.personal = U.assign({ lotsen: 0, boden: 0, sicherheit: 0, technik: 0 },
        raw.personal || {});
      s.lohn = raw.lohn === undefined ? 1 : raw.lohn;
      s.linien = raw.linien || {};
      s.angebote = raw.angebote || [];
      s.wetter = raw.wetter || 'klar';
      s.wetterRest = raw.wetterRest || 4;
      s.ruf = raw.ruf === undefined ? 14 : raw.ruf;
      s.puenktlich = raw.puenktlich === undefined ? 92 : raw.puenktlich;
      s.paxJahr = raw.paxJahr || 0;
      s.jahrTage = raw.jahrTage || 0;
      s.paxMonat = raw.paxMonat || 0;
      s.paxGesamt = raw.paxGesamt || 0;
      s.bewegungenMonat = raw.bewegungenMonat || 0;
      s.frachtMonat = raw.frachtMonat || 0;
      s.ausfallGesamt = raw.ausfallGesamt || 0;
      s.einnahmen = U.assign(neueKasse(), raw.einnahmen || {});
      s.kosten = U.assign(neueKasse(), raw.kosten || {});
      s.letzterMonat = raw.letzterMonat || null;
      s.historie = raw.historie || [];
      s.wirkungen = raw.wirkungen || [];
      s.stufe = raw.stufe || 0;
      s.hoechsteStufe = raw.hoechsteStufe || s.stufe;
      s.tutorialGesehen = !!raw.tutorialGesehen;
      s.flugNr = raw.flugNr || 1;

      /* Fluege werden nicht gesichert - sie sind Sekundenware. Der
         Flughafen faengt beim Laden mit leerem Himmel an. */
      s.fluege = [];
      s.bewegungenFrei = S.kapazitaet(s);
    } catch (e) {
      SG.noteError('air.deserialize', e);
      return null;
    }
    return s;
  };
})(SG);
