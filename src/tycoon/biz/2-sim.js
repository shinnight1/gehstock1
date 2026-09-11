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
      ausbau: {},           // id -> Anzahl gekaufter Ausbaustufen
      leitung: {},          // id -> Stufe in D.LEITUNG (0 = niemand)
      markt: {},            // Branche -> Anzahl Werbekampagnen
      aktien: [],           // { id, kurs, verlauf[], stueck, einstand }
      immobilien: {},       // id -> Anzahl
      residenz: 0,          // Index in D.RESIDENZEN
      luxus: {},            // id -> true
      beratung: {},         // id -> true
      schuld: 0,            // offener Kredit bei der Bank

      // Steuer
      gewinnSeitAbrechnung: 0,
      letzteSteuer: 0,
      steuerFaellig: 0,
      steuerOffenMonate: 0,

      ereignisse: [],       // bis zu zwei gleichzeitig: { id, restTage }
      meldungen: [],        // Zeitleiste
      naechstesEreignis: 6 + 8,
      verlauf: [],          // je Spieltag ein Punkt fuer die Kurven
      angebote: [],         // zeitlich begrenzte Gelegenheiten
      naechstesAngebot: 5,
      auftraege: [],        // Limit-Auftraege an der Boerse
      auftragNr: 1,
      ziele: {},            // Ziel-Id -> true, wenn erreicht
      zaehler: { auftraege: 0, kredite: 0, steuerPuenktlich: 0 },
      zuletzt: 0,           // echte Uhrzeit beim Speichern, fuer die Abwesenheit

      stat: { firmenErtrag: 0, mieten: 0, dividenden: 0, steuern: 0,
        luxusAusgaben: 0, zinsen: 0, werbung: 0, loehne: 0, branchen: {} },
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
    D.FIRMEN.forEach(function (f) {
      s.firmen[f.id] = 0; s.ausbau[f.id] = 0; s.leitung[f.id] = 0;
    });
    D.IMMOBILIEN.forEach(function (i) { s.immobilien[i.id] = 0; });

    /* Jede Branche startet an einer anderen Stelle ihrer Konjunkturwelle.
       Der Versatz haengt am Kern - dieselbe Partie, derselbe Verlauf. */
    s.phasen = {};
    D.BRANCHEN.forEach(function (b) {
      s.markt[b.id] = 0;
      s.stat.branchen[b.id] = 0;
      s.phasen[b.id] = rng();
    });

    melden(s, 'gut', '🌅', 'Erster Tag. Auf dem Konto: nichts. Der Schreibtisch wartet.');
    return s;
  };

  /* Alles, was die Branchenlage veraendert, zaehlt hier hoch. Die
     gemerkte Lage wird dadurch ungueltig. */
  function aendern(s) { s.rev = (s.rev || 0) + 1; }
  S.aendern = aendern;
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

  /* Wirkung der gekauften Ausbaustufen einer Firma */
  S.ausbauFaktor = function (s, id) {
    var n = (s.ausbau && s.ausbau[id]) || 0;
    var f = 1;
    for (var i = 0; i < n && i < D.AUSBAU.length; i++) f *= D.AUSBAU[i].faktor;
    return f;
  };

  /* Grundertrag einer Firma je Spielsekunde: Stufen, Meilensteine und
     Ausbau - ohne Leitung. Die Loehne haengen genau an dieser Zahl,
     also an der Groesse des Betriebs, nicht an seinem Tagesumsatz. */
  S.firmenGrund = function (s, id) {
    var def = D.firma(id);
    var stufe = s.firmen[id] || 0;
    if (!def || !stufe) return 0;
    var meilen = Math.floor(stufe / D.MEILENSTEIN);
    return def.ertrag * stufe * Math.pow(2, meilen) * S.ausbauFaktor(s, id);
  };

  S.leitungFaktor = function (s, id) {
    var n = (s.leitung && s.leitung[id]) || 0;
    var def = D.LEITUNG[n - 1];
    return def ? def.ertrag : 1;
  };

  /* Tageslohn der Leitung einer Firma */
  S.leitungLohn = function (s, id, stufe) {
    var n = stufe === undefined ? ((s.leitung && s.leitung[id]) || 0) : stufe;
    var def = D.LEITUNG[n - 1];
    if (!def) return 0;
    return S.firmenGrund(s, id) * D.SEK_PRO_TAG * def.lohn;
  };

  S.loehneGesamt = function (s) {
    var summe = 0;
    for (var i = 0; i < D.FIRMEN.length; i++) summe += S.leitungLohn(s, D.FIRMEN[i].id);
    return summe;
  };

  /* Roher Ertrag einschliesslich Leitung. Branche, Markt und
     Ereignisse kommen erst danach dazu. */
  S.firmenErtrag = function (s, id) {
    return S.firmenGrund(s, id) * S.leitungFaktor(s, id);
  };

  /* Konjunktur einer Branche: zwei ueberlagerte Wellen um die 1 herum.
     Reine Funktion der Spielzeit - nach dem Laden laeuft sie nahtlos
     weiter, ohne dass etwas gespeichert werden muesste. */
  S.konjunktur = function (s, brancheId, tagVersatz) {
    var def = D.branche(brancheId);
    if (!def) return 1;
    var ph = (s.phasen && s.phasen[brancheId]) || 0;
    var t = s.zeit / D.SEK_PRO_TAG + (tagVersatz || 0);
    var lang = Math.sin((t / def.zyklus + ph) * Math.PI * 2);
    var kurz = Math.sin((t / (def.zyklus * 0.37) + ph * 3.1) * Math.PI * 2);
    return 1 + (lang * 0.72 + kurz * 0.28) * def.schwankung;
  };

  /* Wie viel Ertrag die Branche noch zum vollen Preis aufnimmt. Jede
     eigene Firma dort vergroessert den Markt, jede Werbekampagne auch. */
  S.branchenMarkt = function (s, brancheId) {
    var liste = D.firmenDerBranche(brancheId);
    var basis = 0;
    for (var i = 0; i < liste.length; i++) {
      if ((s.firmen[liste[i].id] || 0) > 0) basis += liste[i].ertrag;
    }
    var kampagnen = (s.markt && s.markt[brancheId]) || 0;
    return basis * D.MARKT_STUFEN * Math.pow(D.MARKT_SCHUB, kampagnen);
  };

  /* Aufschlag fuer eigene Zulieferer */
  S.lieferBonus = function (s, def) {
    if (!def || !def.zulieferer) return 1;
    var liste = D.firmenDerBranche(def.zulieferer);
    var n = 0;
    for (var i = 0; i < liste.length; i++) if ((s.firmen[liste[i].id] || 0) > 0) n++;
    return 1 + Math.min(D.LIEFER_MAX, n * D.LIEFER_PRO);
  };

  S.lieferEigene = function (s, def) {
    if (!def || !def.zulieferer) return 0;
    var liste = D.firmenDerBranche(def.zulieferer);
    var n = 0;
    for (var i = 0; i < liste.length; i++) if ((s.firmen[liste[i].id] || 0) > 0) n++;
    return n;
  };

  /* Laufende Ereignisse, als Tabelleneintraege */
  S.aktiveEreignisse = function (s) {
    var out = [], liste = s.ereignisse || [];
    for (var i = 0; i < liste.length; i++) {
      for (var j = 0; j < D.EREIGNISSE.length; j++) {
        if (D.EREIGNISSE[j].id === liste[i].id) { out.push(D.EREIGNISSE[j]); break; }
      }
    }
    return out;
  };

  /* Wirkung der laufenden Ereignisse auf genau eine Branche */
  S.ereignisBranche = function (s, brancheId) {
    var liste = S.aktiveEreignisse(s), f = 1;
    for (var i = 0; i < liste.length; i++) {
      var b = liste[i].branchen;
      if (b && b[brancheId] !== undefined) f *= b[brancheId];
    }
    return f;
  };

  /* Laufender Ereignisfaktor fuer "firmen", "mieten" oder "boerse".
     Mehrere Ereignisse wirken zusammen. */
  S.faktor = function (s, was) {
    var liste = S.aktiveEreignisse(s), i;
    if (was === 'boerse') {
      var summe = 0;
      for (i = 0; i < liste.length; i++) summe += liste[i].boerse || 0;
      return summe;
    }
    var f = 1;
    for (i = 0; i < liste.length; i++) if (liste[i][was] !== undefined) f *= liste[i][was];
    return f;
  };

  /* Die Lage aller Branchen auf einen Blick. Wird je Zeitscheibe gemerkt:
     die Schleife fragt dreissigmal je Sekunde, die Oberflaeche dauernd. */
  S.lage = function (s) {
    var schluessel = Math.floor(s.zeit * 2) + ':' + (s.rev || 0);
    if (s.lageCache && s.lageSchluessel === schluessel) return s.lageCache;

    var out = {}, i, b;
    for (i = 0; i < D.BRANCHEN.length; i++) {
      b = D.BRANCHEN[i];
      out[b.id] = {
        def: b, roh: 0, firmen: 0,
        markt: S.branchenMarkt(s, b.id),
        konj: S.konjunktur(s, b.id),
        ereignis: S.ereignisBranche(s, b.id),
        saettigung: 1, faktor: 1,
      };
    }
    for (i = 0; i < D.FIRMEN.length; i++) {
      var l = out[D.FIRMEN[i].branche];
      if (!l) continue;
      var roh = S.firmenErtrag(s, D.FIRMEN[i].id);
      if (roh > 0) { l.roh += roh; l.firmen++; }
    }
    for (i = 0; i < D.BRANCHEN.length; i++) {
      var e = out[D.BRANCHEN[i].id];
      e.saettigung = D.saettigung(e.roh, e.markt);
      e.faktor = e.konj * e.saettigung * e.ereignis;
    }
    s.lageCache = out;
    s.lageSchluessel = schluessel;
    return out;
  };

  /* Was eine Firma nach allen Einfluessen tatsaechlich abwirft */
  S.firmenErtragEff = function (s, id, lage) {
    var def = D.firma(id);
    var roh = S.firmenErtrag(s, id);
    if (!def || roh <= 0) return 0;
    var l = (lage || S.lage(s))[def.branche];
    return roh * (l ? l.faktor : 1) * S.lieferBonus(s, def);
  };

  S.ertragGesamt = function (s) {
    var lage = S.lage(s);
    var summe = 0;
    for (var i = 0; i < D.FIRMEN.length; i++) {
      summe += S.firmenErtragEff(s, D.FIRMEN[i].id, lage);
    }
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

  /* Buchwert der Firmen: was beim Verkauf zurueckkaeme. Genau dieser
     Wert dient der Bank als Sicherheit. */
  S.firmenwert = function (s) {
    var summe = 0;
    for (var i = 0; i < D.FIRMEN.length; i++) {
      var def = D.FIRMEN[i], stufe = s.firmen[def.id] || 0;
      if (stufe > 0) summe += D.firmenPreisMenge(def, 0, stufe) * D.FIRMA_RUECK;
    }
    return summe;
  };

  /* Alles, was die Bank beleihen wuerde - ohne die Kasse, sonst liesse
     sich ein Kredit mit dem naechsten Kredit besichern. */
  S.sicherheiten = function (s) {
    return S.depotwert(s) + S.immobilienwert(s) + S.firmenwert(s)
      + D.RESIDENZEN[s.residenz].preis;
  };

  S.bruttovermoegen = function (s) { return s.geld + S.sicherheiten(s); };

  S.vermoegen = function (s) { return S.bruttovermoegen(s) - (s.schuld || 0); };

  S.rang = function (s) { return D.rang(S.vermoegen(s), S.ansehen(s)); };

  S.rabatt = function (s) {
    var r = 0;
    for (var i = 0; i < D.BERATUNG.length; i++) {
      if (s.beratung[D.BERATUNG[i].id]) r += D.BERATUNG[i].rabatt;
    }
    return Math.min(r, D.MAX_RABATT);
  };

  /* ---------------------------------------------------------- Bank */

  S.kreditRahmen = function (s) {
    var basis = Math.max(0, S.sicherheiten(s)) * D.KREDIT.quote + D.KREDIT.sockel;
    return Math.max(0, basis - (s.schuld || 0));
  };

  S.zinsTag = function (s) { return (s.schuld || 0) * D.KREDIT.zinsTag; };

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
    aendern(s);
    if (!stufe) {
      var br = D.branche(def.branche);
      melden(s, 'gut', def.icon, def.name + ' gegründet'
        + (br ? ' — neue Branche: ' + br.name + '.' : '.'));
    }
    var vorher = Math.floor(stufe / D.MEILENSTEIN);
    var nachher = Math.floor(s.firmen[id] / D.MEILENSTEIN);
    if (nachher > vorher) {
      melden(s, 'gut', '⭐', def.name + ' Stufe ' + s.firmen[id]
        + ' — der Ertrag hat sich verdoppelt.');
    }
    return null;
  };

  /* Stufen wieder abgeben. Bringt einen Teil des Kaufpreises zurueck und
     ist der einzige Weg, sich aus einer uebersaettigten Branche
     zurueckzuziehen. */
  S.firmaVerkaufen = function (s, id, menge) {
    var def = D.firma(id);
    if (!def) return 'Unbekannte Firma.';
    var stufe = s.firmen[id] || 0;
    menge = Math.min(Math.max(1, Math.floor(menge || 1)), stufe);
    if (menge < 1) return 'Da gibt es nichts abzugeben.';
    var erloes = Math.round(D.firmenPreisMenge(def, stufe - menge, menge) * D.FIRMA_RUECK);
    s.firmen[id] = stufe - menge;
    s.geld += erloes;
    aendern(s);
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

  /* ---------------------------------------------------------- Ausbau */

  S.ausbauNaechster = function (s, id) {
    var n = (s.ausbau && s.ausbau[id]) || 0;
    return D.AUSBAU[n] || null;
  };

  S.ausbauKaufen = function (s, id) {
    var def = D.firma(id);
    if (!def) return 'Unbekannte Firma.';
    var n = (s.ausbau[id] || 0);
    var a = D.AUSBAU[n];
    if (!a) return 'Weiter ausbauen geht nicht.';
    if ((s.firmen[id] || 0) < a.abStufe) return 'Erst ab Stufe ' + a.abStufe + '.';
    var preis = D.ausbauPreis(def, n);
    if (s.geld < preis) return 'Dafür reicht das Geld nicht.';
    s.geld -= preis;
    s.ausbau[id] = n + 1;
    aendern(s);
    melden(s, 'gut', def.icon, def.name + ': ' + D.ausbauName(def.branche, n) + ' steht.');
    return null;
  };

  /* ---------------------------------------------------------- Personal */

  S.leitungNaechste = function (s, id) {
    return D.LEITUNG[(s.leitung[id] || 0)] || null;
  };

  /* Antrittskosten: zwoelf Tagesloehne der neuen Stufe */
  S.leitungAntritt = function (s, id) {
    var n = (s.leitung[id] || 0) + 1;
    if (!D.LEITUNG[n - 1]) return null;
    return Math.round(S.leitungLohn(s, id, n) * D.LEITUNG_ANTRITT);
  };

  S.leitungEinstellen = function (s, id) {
    var def = D.firma(id);
    if (!def) return 'Unbekannte Firma.';
    if (!(s.firmen[id] > 0)) return 'Diesen Betrieb gibt es noch nicht.';
    var n = (s.leitung[id] || 0) + 1;
    var stufe = D.LEITUNG[n - 1];
    if (!stufe) return 'Darüber sitzt niemand mehr.';
    var preis = S.leitungAntritt(s, id);
    if (s.geld < preis) return 'Dafür reicht das Geld nicht.';
    s.geld -= preis;
    s.leitung[id] = n;
    aendern(s);
    melden(s, 'gut', stufe.icon, def.name + ': ' + stufe.name + ' eingestellt.');
    return null;
  };

  S.leitungEntlassen = function (s, id) {
    var n = s.leitung[id] || 0;
    if (!n) return 'Da ist niemand.';
    s.leitung[id] = n - 1;
    aendern(s);
    return null;
  };

  /* ---------------------------------------------------------- Markt */

  S.marktPreis = function (s, brancheId) {
    var markt = S.branchenMarkt(s, brancheId);
    if (markt <= 0) return null;
    return Math.round(markt * D.SEK_PRO_TAG * D.MARKT_TAGE);
  };

  /* Werbung ist eine Betriebsausgabe: sie senkt den zu versteuernden
     Gewinn. Kurz vor dem Monatsabschluss ist sie deshalb doppelt klug. */
  S.marktKaufen = function (s, brancheId) {
    var br = D.branche(brancheId);
    if (!br) return 'Unbekannte Branche.';
    var preis = S.marktPreis(s, brancheId);
    if (preis === null) return 'In dieser Branche gibt es noch nichts zu bewerben.';
    if (s.geld < preis) return 'Dafür reicht das Geld nicht.';
    s.geld -= preis;
    s.gewinnSeitAbrechnung -= preis;
    s.stat.werbung = (s.stat.werbung || 0) + preis;
    s.markt[brancheId] = (s.markt[brancheId] || 0) + 1;
    aendern(s);
    melden(s, 'gut', '📣', 'Werbekampagne ' + br.name + ' — der Markt wächst um '
      + Math.round((D.MARKT_SCHUB - 1) * 100) + ' Prozent.');
    return null;
  };

  /* ---------------------------------------------------------- Kredit */

  S.kreditAufnehmen = function (s, betrag) {
    betrag = Math.floor(betrag);
    if (!(betrag > 0)) return 'Kein Betrag.';
    if (betrag > S.kreditRahmen(s)) return 'So viel gibt die Bank nicht her.';
    s.geld += betrag;
    s.schuld = (s.schuld || 0) + betrag;
    melden(s, 'neutral', '🏦', U.euro(betrag) + ' Kredit aufgenommen.');
    return null;
  };

  S.kreditTilgen = function (s, betrag) {
    betrag = Math.min(Math.floor(betrag), Math.floor(s.schuld || 0));
    if (!(betrag > 0)) return 'Es ist nichts offen.';
    if (s.geld < betrag) return 'Dafür reicht das Geld nicht.';
    s.geld -= betrag;
    s.schuld -= betrag;
    if (s.schuld < 1) {
      s.schuld = 0;
      s.zaehler.kredite = (s.zaehler.kredite || 0) + 1;
      melden(s, 'gut', '🏦', 'Der Kredit ist zurückgezahlt.');
    }
    return null;
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
    if (!s.steuerOffenMonate) {
      s.zaehler.steuerPuenktlich = (s.zaehler.steuerPuenktlich || 0) + 1;
    }
    s.steuerFaellig = 0;
    s.steuerOffenMonate = 0;
    return null;
  };

  /* ---------------------------------------------------------- Angebote */

  S.angebot = function (s, nr) {
    for (var i = 0; i < s.angebote.length; i++) if (s.angebote[i].nr === nr) return s.angebote[i];
    return null;
  };

  S.angebotAnnehmen = function (s, nr) {
    var a = S.angebot(s, nr);
    if (!a) return 'Das Angebot gibt es nicht mehr.';
    if (s.geld < a.preis) return 'Dafür reicht das Geld nicht.';
    var i;
    if (a.art === 'paket') {
      var def = D.firma(a.ziel);
      if (!def) return 'Der Betrieb steht nicht mehr zum Verkauf.';
      s.geld -= a.preis;
      s.firmen[a.ziel] = (s.firmen[a.ziel] || 0) + a.menge;
    } else if (a.art === 'ausbau') {
      if ((s.ausbau[a.ziel] || 0) !== a.stufe) return 'Der Ausbau passt nicht mehr.';
      s.geld -= a.preis;
      s.ausbau[a.ziel] = a.stufe + 1;
    } else if (a.art === 'kampagne') {
      s.geld -= a.preis;
      s.gewinnSeitAbrechnung -= a.preis;
      s.stat.werbung = (s.stat.werbung || 0) + a.preis;
      s.markt[a.ziel] = (s.markt[a.ziel] || 0) + 1;
    } else if (a.art === 'immobilie') {
      s.geld -= a.preis;
      s.immobilien[a.ziel] = (s.immobilien[a.ziel] || 0) + 1;
    } else {
      return 'Unbekanntes Angebot.';
    }
    for (i = 0; i < s.angebote.length; i++) {
      if (s.angebote[i].nr === nr) { s.angebote.splice(i, 1); break; }
    }
    aendern(s);
    melden(s, 'gut', '🤝', a.titel + ' angenommen: ' + a.was + '.');
    return null;
  };

  /* ---------------------------------------------------------- Boersenauftraege */

  S.auftragStellen = function (s, aktieId, art, kurs, stueck) {
    if (!D.aktie(aktieId)) return 'Unbekannte Aktie.';
    if (art !== 'kauf' && art !== 'verkauf') return 'Kaufen oder verkaufen?';
    kurs = Number(kurs); stueck = Math.floor(Number(stueck));
    if (!(kurs > 0)) return 'Kein gültiger Kurs.';
    if (!(stueck > 0)) return 'Mindestens ein Stück.';
    if (s.auftraege.length >= D.AUFTRAG_MAX) {
      return 'Mehr als ' + D.AUFTRAG_MAX + ' Aufträge nimmt die Bank nicht an.';
    }
    s.auftraege.push({
      nr: s.auftragNr++, aktie: aktieId, art: art,
      kurs: kurs, stueck: stueck, restTage: D.AUFTRAG_TAGE,
    });
    return null;
  };

  S.auftragLoeschen = function (s, nr) {
    for (var i = 0; i < s.auftraege.length; i++) {
      if (s.auftraege[i].nr === nr) { s.auftraege.splice(i, 1); return null; }
    }
    return 'Den Auftrag gibt es nicht mehr.';
  };

  /* ---------------------------------------------------------- Takt */

  S.step = function (s, dt) {
    if (s.pausiert) return;
    var sek = dt * s.tempo;
    if (sek <= 0) return;

    var vorherTag = Math.floor(s.zeit / D.SEK_PRO_TAG);
    s.zeit += sek;
    var nachherTag = Math.floor(s.zeit / D.SEK_PRO_TAG);

    /* Laufender Firmenertrag, je Branche getrennt gebucht - die
       Statistik zeigt spaeter, woher das Geld wirklich kam. */
    var lage = S.lage(s);
    var global = S.faktor(s, 'firmen');
    var ertrag = 0;
    for (var i = 0; i < D.FIRMEN.length; i++) {
      var def = D.FIRMEN[i];
      var e = S.firmenErtragEff(s, def.id, lage) * global * sek;
      if (e <= 0) continue;
      ertrag += e;
      s.stat.branchen[def.branche] = (s.stat.branchen[def.branche] || 0) + e;
    }
    if (ertrag > 0) {
      s.geld += ertrag;
      s.verdientGesamt += ertrag;
      s.gewinnSeitAbrechnung += ertrag;
      s.stat.firmenErtrag += ertrag;
    }

    // Kurse bewegen sich fortlaufend, danach die wartenden Auftraege
    kurse(s, sek);
    auftraegePruefen(s);

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
    var i;

    // Kursverlauf fortschreiben
    for (i = 0; i < s.aktien.length; i++) {
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

    /* Loehne. Sie richten sich nach der Groesse der Betriebe, nicht
       nach dem Umsatz des Tages - deshalb tun sie in einer Flaute weh. */
    var lohn = S.loehneGesamt(s);
    if (lohn > 0) {
      s.gewinnSeitAbrechnung -= lohn;
      s.stat.loehne = (s.stat.loehne || 0) + lohn;
      if (s.geld >= lohn) {
        s.geld -= lohn;
      } else {
        s.geld = 0;
        leitungGehtWeg(s);
      }
    }

    // Unterhalt der Residenz
    var wohnen = D.RESIDENZEN[s.residenz].unterhalt;
    if (wohnen > 0) {
      s.geld -= wohnen;
      s.gewinnSeitAbrechnung -= wohnen;
    }

    /* Zinsen. Reicht die Kasse nicht, wachsen sie in die Schuld hinein -
       so wird aus einem kleinen Kredit ein grosses Problem. */
    var zins = S.zinsTag(s);
    if (zins > 0) {
      s.stat.zinsen = (s.stat.zinsen || 0) + zins;
      s.gewinnSeitAbrechnung -= zins;
      if (s.geld >= zins) {
        s.geld -= zins;
      } else {
        s.schuld += zins - s.geld;
        s.geld = 0;
      }
    }
    kreditPruefen(s);

    // Ereignisse abbauen, danach vielleicht ein neues ziehen
    for (i = s.ereignisse.length - 1; i >= 0; i--) {
      if (--s.ereignisse[i].restTage <= 0) s.ereignisse.splice(i, 1);
    }
    if (--s.naechstesEreignis <= 0) {
      if (s.ereignisse.length < 2) ereignisZiehen(s, rng);
      s.naechstesEreignis = 7 + rng.int(10);
    }

    // Angebote ablaufen lassen, danach vielleicht ein neues
    for (i = s.angebote.length - 1; i >= 0; i--) {
      if (--s.angebote[i].restTage <= 0) s.angebote.splice(i, 1);
    }
    if (--s.naechstesAngebot <= 0) {
      if (s.angebote.length < D.ANGEBOT_MAX) angebotZiehen(s, rng);
      s.naechstesAngebot = D.ANGEBOT_ABSTAND[0]
        + rng.int(D.ANGEBOT_ABSTAND[1] - D.ANGEBOT_ABSTAND[0] + 1);
    }

    // Auftraege verfallen lassen
    for (i = s.auftraege.length - 1; i >= 0; i--) {
      if (--s.auftraege[i].restTage <= 0) {
        var weg = s.auftraege.splice(i, 1)[0];
        var adef = D.aktie(weg.aktie);
        melden(s, 'neutral', '📄', 'Auftrag verfallen: '
          + (weg.art === 'kauf' ? 'Kauf' : 'Verkauf') + ' ' + U.num(weg.stueck)
          + ' ' + (adef ? adef.kuerzel : weg.aktie) + ' zu ' + U.euro(weg.kurs) + '.');
      }
    }

    // Monatsabschluss
    if (s.tag % D.TAGE_PRO_MONAT === 0) monatsWechsel(s);

    // Kurve fuer die Statistik
    s.verlauf.push({
      t: s.tag,
      v: Math.round(S.vermoegen(s)),
      e: Math.round(S.ertragGesamt(s) * D.SEK_PRO_TAG + miete + div),
    });
    if (s.verlauf.length > 120) s.verlauf.shift();

    S.zielePruefen(s);

    // Rangaufstieg melden
    var r = S.rang(s);
    if (!s.erreicht[r.name]) {
      s.erreicht[r.name] = true;
      if (r.name !== 'Praktikant') melden(s, 'gut', '🏅', 'Neuer Rang: ' + r.name + '.');
    }
  }

  /* Die Bank sieht taeglich nach, ob die Sicherheiten noch reichen.
     Tun sie das nicht, verwertet sie selbst - erst die Kasse, dann das
     Depot, dann die Immobilien. Die Firmen bleiben unangetastet. */
  function kreditPruefen(s) {
    if (!(s.schuld > 0)) return;
    if (s.schuld <= S.sicherheiten(s) * D.KREDIT.notgrenze) return;

    var vorher = s.schuld, i;
    tilgenAusKasse(s);
    for (i = 0; i < s.aktien.length && s.schuld > 0; i++) {
      if (!s.aktien[i].stueck) continue;
      S.aktieVerkaufen(s, s.aktien[i].id, s.aktien[i].stueck);
      tilgenAusKasse(s);
    }
    for (i = 0; i < D.IMMOBILIEN.length && s.schuld > 0; i++) {
      while ((s.immobilien[D.IMMOBILIEN[i].id] || 0) > 0 && s.schuld > 0) {
        S.immobilieVerkaufen(s, D.IMMOBILIEN[i].id);
        tilgenAusKasse(s);
      }
    }
    if (s.schuld < vorher) {
      melden(s, 'schlecht', '🏦', 'Die Bank hat Sicherheiten verwertet — '
        + U.euro(vorher - s.schuld) + ' Schulden getilgt.');
    }
  }

  /* Das Finanzamt holt sich die offene Forderung selbst. Anders als die
     Bank wartet es nicht auf eine Deckungsluecke, sondern auf den Ablauf
     der Frist - Steuern sind keine Bitte. */
  function vollstrecken(s) {
    var vorher = s.steuerFaellig, i;
    steuerAusKasse(s);
    for (i = 0; i < s.aktien.length && s.steuerFaellig > 0; i++) {
      if (!s.aktien[i].stueck) continue;
      S.aktieVerkaufen(s, s.aktien[i].id, s.aktien[i].stueck);
      steuerAusKasse(s);
    }
    for (i = 0; i < D.IMMOBILIEN.length && s.steuerFaellig > 0; i++) {
      while ((s.immobilien[D.IMMOBILIEN[i].id] || 0) > 0 && s.steuerFaellig > 0) {
        S.immobilieVerkaufen(s, D.IMMOBILIEN[i].id);
        steuerAusKasse(s);
      }
    }
    if (s.steuerFaellig <= 0) s.steuerOffenMonate = 0;
    melden(s, 'schlecht', '🔒', 'Vollstreckung: das Finanzamt hat '
      + U.euro(vorher - s.steuerFaellig) + ' eingezogen.'
      + (s.steuerFaellig > 0 ? ' ' + U.euro(s.steuerFaellig) + ' bleiben offen.' : ''));
  }

  function steuerAusKasse(s) {
    var z = Math.min(s.geld, s.steuerFaellig);
    if (z > 0) { s.geld -= z; s.steuerFaellig -= z; s.stat.steuern += z; }
    if (s.steuerFaellig < 1) s.steuerFaellig = 0;
  }

  function tilgenAusKasse(s) {
    var z = Math.min(s.geld, s.schuld);
    if (z > 0) { s.geld -= z; s.schuld -= z; }
    if (s.schuld < 1) s.schuld = 0;
  }

  /* Wer die Loehne nicht zahlen kann, verliert seine Leute - eine
     Stufe je Betrieb, bis es wieder passt. */
  function leitungGehtWeg(s) {
    var weg = 0;
    for (var i = 0; i < D.FIRMEN.length; i++) {
      var id = D.FIRMEN[i].id;
      if ((s.leitung[id] || 0) > 0) { s.leitung[id]--; weg++; }
    }
    if (!weg) return;
    aendern(s);
    melden(s, 'schlecht', '📤', 'Die Löhne waren nicht gedeckt — ' + weg + ' '
      + U.plural(weg, 'Betrieb steht', 'Betriebe stehen') + ' wieder ohne Leitung da.');
  }

  /* Wartende Limit-Auftraege. Sie greifen auch, waehrend niemand
     zusieht - genau dafuer sind sie da. */
  function auftraegePruefen(s) {
    for (var i = s.auftraege.length - 1; i >= 0; i--) {
      var a = s.auftraege[i];
      var kurs = null;
      for (var k = 0; k < s.aktien.length; k++) if (s.aktien[k].id === a.aktie) kurs = s.aktien[k];
      if (!kurs) { s.auftraege.splice(i, 1); continue; }
      var dran = a.art === 'kauf' ? kurs.kurs <= a.kurs : kurs.kurs >= a.kurs;
      if (!dran) continue;
      var fehler = a.art === 'kauf'
        ? S.aktieKaufen(s, a.aktie, a.stueck)
        : S.aktieVerkaufen(s, a.aktie, a.stueck);
      if (fehler) continue;
      s.auftraege.splice(i, 1);
      s.zaehler.auftraege = (s.zaehler.auftraege || 0) + 1;
      var def = D.aktie(a.aktie);
      melden(s, 'gut', '📑', 'Auftrag ausgeführt: '
        + (a.art === 'kauf' ? 'gekauft' : 'verkauft') + ' ' + U.num(a.stueck) + ' '
        + (def ? def.kuerzel : a.aktie) + ' zu ' + U.euro(kurs.kurs) + '.');
    }
  }

  /* ---------------------------------------------------------- Angebote */

  /* Ein Angebot passt nur, wenn es etwas betrifft, das der Spieler
     ueberhaupt gebrauchen kann. Alles andere waere Papier. */
  function angebotZiehen(s, rng) {
    var moeglich = [], i, f;
    for (i = 0; i < D.ANGEBOTE.length; i++) {
      var art = D.ANGEBOTE[i];
      var ziele = angebotsZiele(s, art.art);
      if (ziele.length) moeglich.push({ art: art, ziele: ziele, w: art.gewicht });
    }
    if (!moeglich.length) return;

    var wahl = rng.weighted(moeglich);
    var ziel = rng.pick(wahl.ziele);
    var art2 = wahl.art;
    var rabatt = rng.range(art2.rabatt[0], art2.rabatt[1]);
    var dauer = D.ANGEBOT_DAUER[0]
      + rng.int(D.ANGEBOT_DAUER[1] - D.ANGEBOT_DAUER[0] + 1);
    var ang = {
      nr: s.auftragNr++, art: art2.art, ziel: ziel, restTage: dauer,
      titel: art2.titel, text: art2.text, rabatt: rabatt,
    };

    if (art2.art === 'paket') {
      f = D.firma(ziel);
      ang.menge = art2.menge[0] + rng.int(art2.menge[1] - art2.menge[0] + 1);
      ang.voll = D.firmenPreisMenge(f, s.firmen[ziel] || 0, ang.menge);
      ang.icon = f.icon;
      ang.was = ang.menge + ' Stufen ' + f.name;
    } else if (art2.art === 'ausbau') {
      f = D.firma(ziel);
      ang.stufe = s.ausbau[ziel] || 0;
      ang.voll = D.ausbauPreis(f, ang.stufe);
      ang.icon = f.icon;
      ang.was = D.ausbauName(f.branche, ang.stufe) + ' für ' + f.name;
    } else if (art2.art === 'kampagne') {
      var br = D.branche(ziel);
      ang.voll = S.marktPreis(s, ziel);
      ang.icon = '📣';
      ang.was = 'Werbekampagne ' + br.name;
    } else {
      var im = D.immobilie(ziel);
      ang.voll = im.preis;
      ang.icon = im.icon;
      ang.was = im.name;
    }

    if (!(ang.voll > 0)) return;
    ang.preis = Math.round(ang.voll * (1 - rabatt));
    s.angebote.push(ang);
    melden(s, 'gut', '🤝', ang.titel + ': ' + ang.was + ' für '
      + U.euro(ang.preis, true) + ' statt ' + U.euro(ang.voll, true)
      + ' — ' + dauer + ' Tage.');
  }

  function angebotsZiele(s, art) {
    var out = [], i, def;
    if (art === 'paket') {
      for (i = 0; i < D.FIRMEN.length; i++) {
        def = D.FIRMEN[i];
        if ((s.firmen[def.id] || 0) > 0) out.push(def.id);
      }
    } else if (art === 'ausbau') {
      for (i = 0; i < D.FIRMEN.length; i++) {
        def = D.FIRMEN[i];
        var n = s.ausbau[def.id] || 0;
        var stufe = D.AUSBAU[n];
        if (stufe && (s.firmen[def.id] || 0) >= stufe.abStufe) out.push(def.id);
      }
    } else if (art === 'kampagne') {
      for (i = 0; i < D.BRANCHEN.length; i++) {
        if (S.branchenMarkt(s, D.BRANCHEN[i].id) > 0) out.push(D.BRANCHEN[i].id);
      }
    } else {
      for (i = 0; i < D.IMMOBILIEN.length; i++) {
        if (D.IMMOBILIEN[i].preis <= Math.max(s.geld * 3, S.vermoegen(s) * 0.6)) {
          out.push(D.IMMOBILIEN[i].id);
        }
      }
    }
    return out;
  }

  /* ---------------------------------------------------------- Ziele */

  S.zielePruefen = function (s) {
    for (var i = 0; i < D.ZIELE.length; i++) {
      var z = D.ZIELE[i];
      if (s.ziele[z.id]) continue;
      if (!z.pruef(s, S)) continue;
      s.ziele[z.id] = true;
      s.geld += z.lohn;
      s.verdientGesamt += z.lohn;
      s.gewinnSeitAbrechnung += z.lohn;
      melden(s, 'gut', '🎯', 'Ziel erreicht — ' + z.name + ': '
        + U.euro(z.lohn, true) + '.');
    }
  };

  S.zieleOffen = function (s) {
    var n = 0;
    for (var i = 0; i < D.ZIELE.length; i++) if (!s.ziele[D.ZIELE[i].id]) n++;
    return n;
  };

  /* ---------------------------------------------------------- Abwesenheit */

  /* Was gelaufen ist, waehrend die Seite zu war. Gedeckelt, damit
     nicht die Laenge der Pause das Spiel entscheidet. */
  S.nachholen = function (s, realSek) {
    if (!(realSek > D.OFFLINE_MIN_SEK)) return null;
    var sek = Math.min(realSek * D.OFFLINE_ANTEIL, D.OFFLINE_MAX_TAGE * D.SEK_PRO_TAG);
    if (sek < D.SEK_PRO_TAG) return null;

    var vorher = {
      tag: s.tag, geld: s.geld, verdient: s.verdientGesamt,
      meldungen: s.meldungen.length,
    };
    var tempo = s.tempo, pausiert = s.pausiert;
    s.tempo = 1; s.pausiert = false;
    var rest = sek;
    while (rest > 0) {
      var d = Math.min(2, rest);
      S.step(s, d);
      rest -= d;
    }
    s.tempo = tempo; s.pausiert = pausiert;

    return {
      echtSek: realSek,
      tage: s.tag - vorher.tag,
      gedeckelt: realSek * D.OFFLINE_ANTEIL > sek,
      verdient: s.verdientGesamt - vorher.verdient,
      kasse: s.geld - vorher.geld,
      steuer: s.steuerFaellig,
      meldungen: s.meldungen.slice(vorher.meldungen),
    };
  };

  function ereignisZiehen(s, rng) {
    var moeglich = [], i;
    for (i = 0; i < D.EREIGNISSE.length; i++) {
      var kandidat = D.EREIGNISSE[i], schon = false;
      for (var j = 0; j < s.ereignisse.length; j++) {
        if (s.ereignisse[j].id === kandidat.id) schon = true;
      }
      if (!schon) moeglich.push(kandidat);
    }
    if (!moeglich.length) return;

    var summe = 0;
    for (i = 0; i < moeglich.length; i++) summe += moeglich[i].gewicht;
    var wurf = rng() * summe;
    var def = moeglich[0];
    for (i = 0; i < moeglich.length; i++) {
      wurf -= moeglich[i].gewicht;
      if (wurf <= 0) { def = moeglich[i]; break; }
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
    if (def.einmalig === 'schaden') {
      var kosten = Math.max(300, S.ertragGesamt(s) * D.SEK_PRO_TAG * 4);
      kosten = Math.min(kosten, Math.max(300, s.geld * 0.3));
      s.geld -= kosten;
      s.gewinnSeitAbrechnung -= kosten;
      melden(s, 'schlecht', '🧯', def.text + ' ' + U.euro(kosten) + ' Kosten.');
      return;
    }

    s.ereignisse.push({ id: def.id, restTage: def.dauer });
    melden(s, def.gut ? 'gut' : 'schlecht', def.gut ? '📈' : '📉',
      def.name + ': ' + def.text);
  }

  function monatsWechsel(s) {
    s.monat++;

    /* Wer den letzten Bescheid nicht beglichen hat, zahlt Saeumniszuschlag.
       Ohne das waere die Steuer eine Bitte statt einer Pflicht. */
    if (s.steuerFaellig > 0) {
      s.steuerOffenMonate = (s.steuerOffenMonate || 0) + 1;
      var zuschlag = s.steuerFaellig * 0.05;
      s.steuerFaellig += zuschlag;
      var rest = D.STEUER_FRIST - s.steuerOffenMonate;
      melden(s, 'schlecht', '⚠', 'Steuern noch offen — ' + U.euro(zuschlag)
        + ' Säumniszuschlag kommt dazu.'
        + (rest > 0 ? ' Noch ' + rest + ' ' + U.plural(rest, 'Monat', 'Monate')
          + ' bis zur Vollstreckung.' : ''));
      if (s.steuerOffenMonate >= D.STEUER_FRIST) vollstrecken(s);
    } else {
      s.steuerOffenMonate = 0;
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
      v: 2, seed: s.seed, zeit: s.zeit, tag: s.tag, monat: s.monat,
      geld: s.geld, verdientGesamt: s.verdientGesamt, tipps: s.tipps,
      tempo: s.tempo, pausiert: s.pausiert,
      karriere: s.karriere, firmen: s.firmen, ausbau: s.ausbau,
      leitung: s.leitung, angebote: s.angebote, naechstesAngebot: s.naechstesAngebot,
      auftraege: s.auftraege, auftragNr: s.auftragNr,
      ziele: s.ziele, zaehler: s.zaehler, zuletzt: Date.now(),
      markt: s.markt, immobilien: s.immobilien,
      residenz: s.residenz, luxus: s.luxus, beratung: s.beratung,
      schuld: s.schuld,
      aktien: s.aktien.map(function (a) {
        return { id: a.id, kurs: a.kurs, stueck: a.stueck, einstand: a.einstand,
          verlauf: a.verlauf.slice(-20) };
      }),
      gewinnSeitAbrechnung: s.gewinnSeitAbrechnung,
      letzteSteuer: s.letzteSteuer, steuerFaellig: s.steuerFaellig,
      steuerOffenMonate: s.steuerOffenMonate,
      ereignisse: s.ereignisse, naechstesEreignis: s.naechstesEreignis,
      stat: s.stat, erreicht: s.erreicht,
      verlauf: s.verlauf.slice(-60),
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
    if (raw.ausbau) for (k in raw.ausbau) if (s.ausbau[k] !== undefined) s.ausbau[k] = raw.ausbau[k];
    if (raw.leitung) for (k in raw.leitung) if (s.leitung[k] !== undefined) s.leitung[k] = raw.leitung[k];
    if (raw.markt) for (k in raw.markt) if (s.markt[k] !== undefined) s.markt[k] = raw.markt[k];
    if (raw.immobilien) for (k in raw.immobilien) {
      if (s.immobilien[k] !== undefined) s.immobilien[k] = raw.immobilien[k];
    }
    s.residenz = Math.min(raw.residenz || 0, D.RESIDENZEN.length - 1);
    s.luxus = raw.luxus || {};
    s.beratung = raw.beratung || {};
    s.schuld = raw.schuld || 0;
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
    s.steuerOffenMonate = raw.steuerOffenMonate || 0;

    /* Staende aus der Zeit vor den Branchen kannten nur ein Ereignis. */
    if (raw.ereignisse) s.ereignisse = raw.ereignisse;
    else if (raw.ereignis) s.ereignisse = [raw.ereignis];

    s.naechstesEreignis = raw.naechstesEreignis || 12;
    if (raw.stat) {
      for (k in raw.stat) s.stat[k] = raw.stat[k];
      if (!s.stat.branchen) s.stat.branchen = {};
    }
    if (raw.erreicht) s.erreicht = raw.erreicht;
    if (raw.verlauf) s.verlauf = raw.verlauf;
    if (raw.angebote) s.angebote = raw.angebote;
    if (raw.naechstesAngebot) s.naechstesAngebot = raw.naechstesAngebot;
    if (raw.auftraege) s.auftraege = raw.auftraege;
    if (raw.auftragNr) s.auftragNr = raw.auftragNr;
    if (raw.ziele) s.ziele = raw.ziele;
    if (raw.zaehler) for (k in raw.zaehler) s.zaehler[k] = raw.zaehler[k];
    s.zuletzt = raw.zuletzt || 0;
    if (raw.meldungen) s.meldungen = raw.meldungen;
    aendern(s);
    return s;
  };
})(SG);
