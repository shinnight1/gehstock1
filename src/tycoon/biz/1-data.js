/* ------------------------------------------------------------------
   Wirtschafts-Tycoon - Tabellen

   Alle Zahlen des Spiels stehen hier. Die Simulation liest sie nur,
   die Oberflaeche zeigt sie an - wer am Gleichgewicht dreht, muss
   nichts anderes anfassen.

   Zeit: eine Spielsekunde entspricht bei 1x einer echten Sekunde.
   Ein Tag hat 20 Spielsekunden, ein Monat 30 Tage. Mieten und
   Dividenden kommen taeglich, das Finanzamt meldet sich monatlich.
   ------------------------------------------------------------------ */

(function (SG) {
  var D = (SG.tycoon.biz = SG.tycoon.biz || {}).data = {};

  D.SEK_PRO_TAG = 20;
  D.TAGE_PRO_MONAT = 30;

  /* ---------------------------------------------------------- Arbeit */

  /* Was ein Tipp auf den Schreibtisch einbringt. Traegt das Spiel am
     Anfang und verliert spaeter gegen die Firmen - so soll es sein. */
  D.KARRIERE = [
    { id: 'aushilfe', name: 'Aushilfe', kosten: 0, proTipp: 5,
      text: 'Kisten schleppen, Regale einräumen. Es fängt klein an.' },
    { id: 'lehre', name: 'Ausbildung', kosten: 600, proTipp: 18,
      text: 'Drei Jahre Berufsschule zahlen sich aus.' },
    { id: 'fach', name: 'Fachkraft', kosten: 5000, proTipp: 70,
      text: 'Wer etwas kann, wird gebraucht.' },
    { id: 'meister', name: 'Meisterbrief', kosten: 38000, proTipp: 300,
      text: 'Eigener Betrieb, eigene Preise.' },
    { id: 'studium', name: 'Studium', kosten: 260000, proTipp: 1400,
      text: 'Spät, aber richtig.' },
    { id: 'mba', name: 'MBA', kosten: 1900000, proTipp: 7000,
      text: 'Man lernt vor allem, wen man kennt.' },
    { id: 'vorstand', name: 'Vorstandsposten', kosten: 15000000, proTipp: 36000,
      text: 'Der Stuhl am Kopfende hat eine Lehne aus Leder.' },
    { id: 'aufsicht', name: 'Aufsichtsrat', kosten: 110000000, proTipp: 190000,
      text: 'Vier Sitzungen im Jahr, ein Wort genügt.' },
  ];

  /* ---------------------------------------------------------- Branchen */

  /* Jede Firma gehoert zu einer Branche. Die Branche entscheidet ueber
     drei Dinge: wie stark die Konjunktur schwankt, wie lange eine volle
     Welle dauert, und in welcher Farbe die Oberflaeche sie zeigt.

     schwankung = Ausschlag nach oben wie nach unten (0.1 = plus/minus 10 %)
     zyklus     = Laenge einer vollen Welle in Spieltagen

     Ruhige Branchen tragen durch die Flaute, wilde bringen in guten
     Zeiten ein Vielfaches. Wer nur eine Branche hat, faehrt Achterbahn. */
  D.BRANCHEN = [
    { id: 'handel', name: 'Handel', icon: '🛒', farbe: '#4aa3ff', schwankung: 0.10, zyklus: 88,
      text: 'Die Nachfrage bricht nie ganz weg — üppig wird die Marge aber auch nie.' },
    { id: 'gastro', name: 'Gastronomie', icon: '🍽', farbe: '#ff8f5e', schwankung: 0.19, zyklus: 64,
      text: 'Lebt von Laune und Wetter. Die guten Monate tragen die schlechten.' },
    { id: 'agrar', name: 'Landwirtschaft', icon: '🌾', farbe: '#8bc34a', schwankung: 0.22, zyklus: 76,
      text: 'Ernte für Ernte — und Zulieferer für alles, was gegessen wird.' },
    { id: 'handwerk', name: 'Handwerk & Bau', icon: '🧱', farbe: '#f0b429', schwankung: 0.26, zyklus: 104,
      text: 'Hängt am Zins und an den Auftragsbüchern der anderen.' },
    { id: 'logistik', name: 'Logistik', icon: '🚚', farbe: '#3ddc84', schwankung: 0.15, zyklus: 92,
      text: 'Bewegt, was andere herstellen. Läuft, solange überhaupt etwas läuft.' },
    { id: 'industrie', name: 'Industrie', icon: '🏭', farbe: '#9aa7bd', schwankung: 0.23, zyklus: 148,
      text: 'Lange Zyklen, große Zahlen. Braucht Energie und beliefert alle.' },
    { id: 'energie', name: 'Energie', icon: '⚡', farbe: '#ffd166', schwankung: 0.30, zyklus: 128,
      text: 'Die Preise springen genau dann, wenn anderswo etwas schiefgeht.' },
    { id: 'tech', name: 'Technologie', icon: '💻', farbe: '#7c6cff', schwankung: 0.36, zyklus: 50,
      text: 'Am schnellsten oben, am schnellsten unten.' },
    { id: 'medien', name: 'Medien', icon: '🎬', farbe: '#ff6bb5', schwankung: 0.32, zyklus: 58,
      text: 'Ein Treffer trägt ein Jahr. Dazwischen ist es still.' },
    { id: 'gesund', name: 'Gesundheit', icon: '🩺', farbe: '#63d8e0', schwankung: 0.08, zyklus: 190,
      text: 'Krank wird man in jeder Konjunktur. Der ruhigste Hafen im Spiel.' },
    { id: 'finanz', name: 'Finanzen', icon: '🏦', farbe: '#c8a35a', schwankung: 0.34, zyklus: 70,
      text: 'Verdient am Geld der anderen — und merkt als Erstes, wenn es knapp wird.' },
  ];

  /* ---------------------------------------------------------- Firmen */

  /* kosten = Preis der ersten Stufe, wachstum = Faktor je Stufe,
     ertrag = Euro pro Spielsekunde und Stufe.
     Alle 25 Stufen verdoppelt sich der Ertrag der Firma.

     branche    = Konjunktur, Markt und Farbe kommen von dort
     zulieferer = Branche, aus der diese Firma einkauft. Wer dort selbst
                  Betriebe besitzt, spart ein und verdient mehr.

     Die Liste ist nach Preis sortiert. Auf jeder Preisstufe stehen
     mehrere Branchen zur Wahl - das ist der eigentliche Zug im Spiel. */
  D.FIRMEN = [
    { id: 'zeitung', name: 'Zeitungsstand', icon: '📰', kosten: 60, wachstum: 1.13, ertrag: 0.6,
      branche: 'medien',
      text: 'Morgens um fünf, bei jedem Wetter.' },
    { id: 'gemuese', name: 'Gemüsestand', icon: '🥕', kosten: 170, wachstum: 1.13, ertrag: 1.4,
      branche: 'agrar',
      text: 'Zwei Kisten Kartoffeln und ein Klapptisch.' },
    { id: 'imbiss', name: 'Imbisswagen', icon: '🌭', kosten: 480, wachstum: 1.132, ertrag: 3.2,
      branche: 'gastro', zulieferer: 'agrar',
      text: 'Steht da, wo abends niemand mehr kocht.' },
    { id: 'wasch', name: 'Waschsalon', icon: '🧺', kosten: 900, wachstum: 1.135, ertrag: 4,
      branche: 'handel',
      text: 'Läuft von allein, solange die Trommeln halten.' },
    { id: 'fahrrad', name: 'Fahrradkurier', icon: '🚲', kosten: 2400, wachstum: 1.134, ertrag: 9.5,
      branche: 'logistik',
      text: 'Schneller als jedes Auto, wenn die Stadt steht.' },
    { id: 'kiosk', name: 'Kiosk', icon: '🏪', kosten: 7000, wachstum: 1.14, ertrag: 22,
      branche: 'handel', zulieferer: 'logistik',
      text: 'Zeitung, Kaffee, Lottoschein.' },
    { id: 'baeckerei', name: 'Bäckerei', icon: '🥐', kosten: 16000, wachstum: 1.136, ertrag: 44,
      branche: 'gastro', zulieferer: 'agrar',
      text: 'Um drei geht das Licht an, um sechs die Tür.' },
    { id: 'solar', name: 'Solarpark', icon: '☀', kosten: 27000, wachstum: 1.138, ertrag: 68,
      branche: 'energie',
      text: 'Einmal aufgestellt, dann nur noch abrechnen.' },
    { id: 'cafe', name: 'Café', icon: '☕', kosten: 45000, wachstum: 1.14, ertrag: 105,
      branche: 'gastro', zulieferer: 'agrar',
      text: 'Die Miete ist hoch, die Marge auch.' },
    { id: 'webagentur', name: 'Webagentur', icon: '🖱', kosten: 95000, wachstum: 1.142, ertrag: 205,
      branche: 'tech',
      text: 'Vier Leute, elf Kunden, ein Großkunde zu viel.' },
    { id: 'praxis', name: 'Arztpraxis', icon: '🩺', kosten: 160000, wachstum: 1.138, ertrag: 330,
      branche: 'gesund',
      text: 'Volles Wartezimmer, egal wie die Wirtschaft steht.' },
    { id: 'werkstatt', name: 'Werkstatt', icon: '🔧', kosten: 260000, wachstum: 1.145, ertrag: 480,
      branche: 'handwerk', zulieferer: 'industrie',
      text: 'Termine bis in den übernächsten Monat.' },
    { id: 'spedition', name: 'Spedition', icon: '🚛', kosten: 490000, wachstum: 1.142, ertrag: 860,
      branche: 'logistik',
      text: 'Zwölf Zugmaschinen und ein Disponent mit Nerven.' },
    { id: 'brauerei', name: 'Brauerei', icon: '🍺', kosten: 820000, wachstum: 1.144, ertrag: 1400,
      branche: 'gastro', zulieferer: 'agrar',
      text: 'Vier Zutaten, dreihundert Jahre Übung.' },
    { id: 'bau', name: 'Baufirma', icon: '🏗', kosten: 1500000, wachstum: 1.15, ertrag: 2300,
      branche: 'handwerk', zulieferer: 'industrie',
      text: 'Zwei Kräne, achtzig Leute, ein Zeitplan.' },
    { id: 'radio', name: 'Radiosender', icon: '📻', kosten: 2700000, wachstum: 1.148, ertrag: 3900,
      branche: 'medien',
      text: 'Reichweite verkauft sich besser als Musik.' },
    { id: 'gutshof', name: 'Gutshof', icon: '🚜', kosten: 4400000, wachstum: 1.146, ertrag: 6200,
      branche: 'agrar',
      text: 'Vierhundert Hektar und ein sehr genauer Wetterbericht.' },
    { id: 'software', name: 'Softwarehaus', icon: '💻', kosten: 9000000, wachstum: 1.15, ertrag: 11000,
      branche: 'tech',
      text: 'Skaliert, solange niemand kündigt.' },
    { id: 'klinik', name: 'Privatklinik', icon: '🏥', kosten: 15000000, wachstum: 1.15, ertrag: 18000,
      branche: 'gesund',
      text: 'Einzelzimmer, Chefarzt, kurze Wartezeit.' },
    { id: 'windpark', name: 'Windpark', icon: '🌬', kosten: 27000000, wachstum: 1.152, ertrag: 31000,
      branche: 'energie', zulieferer: 'industrie',
      text: 'Zwanzig Jahre Laufzeit, zwei Jahre Genehmigung.' },
    { id: 'logistik', name: 'Logistikzentrum', icon: '🚚', kosten: 55000000, wachstum: 1.155, ertrag: 55000,
      branche: 'logistik', zulieferer: 'industrie',
      text: 'Vierzigtausend Pakete am Tag.' },
    { id: 'filmstudio', name: 'Filmstudio', icon: '🎬', kosten: 95000000, wachstum: 1.155, ertrag: 90000,
      branche: 'medien', zulieferer: 'tech',
      text: 'Drei Hallen, eine Nebelmaschine, ein Budget.' },
    { id: 'fabrik', name: 'Fabrik', icon: '🏭', kosten: 320000000, wachstum: 1.16, ertrag: 280000,
      branche: 'industrie', zulieferer: 'energie',
      text: 'Drei Schichten, keine Pause.' },
    { id: 'stahlwerk', name: 'Stahlwerk', icon: '⚙', kosten: 540000000, wachstum: 1.158, ertrag: 450000,
      branche: 'industrie', zulieferer: 'energie',
      text: 'Der Hochofen geht nie aus. Nie.' },
    { id: 'versicherung', name: 'Versicherung', icon: '🛡', kosten: 900000000, wachstum: 1.16, ertrag: 720000,
      branche: 'finanz',
      text: 'Verkauft Ruhe und rechnet mit Unruhe.' },
    { id: 'chipfabrik', name: 'Chipfabrik', icon: '🔬', kosten: 1300000000, wachstum: 1.162, ertrag: 1000000,
      branche: 'tech', zulieferer: 'industrie',
      text: 'Reinraum, Klasse eins. Ein Staubkorn kostet eine Charge.' },
    { id: 'konzern', name: 'Konzern', icon: '🏛', kosten: 2000000000, wachstum: 1.165, ertrag: 1500000,
      branche: 'finanz',
      text: 'Ab hier heißt Arbeit: unterschreiben.' },
    { id: 'reederei', name: 'Reederei', icon: '🚢', kosten: 3600000000, wachstum: 1.166, ertrag: 2600000,
      branche: 'logistik', zulieferer: 'industrie',
      text: 'Neunzig Prozent des Welthandels fahren über Wasser.' },
    { id: 'kraftwerk', name: 'Kraftwerkspark', icon: '🔋', kosten: 12000000000, wachstum: 1.17, ertrag: 8500000,
      branche: 'energie',
      text: 'Grundlast für eine halbe Republik.' },
    { id: 'raumfahrt', name: 'Raumfahrtkonzern', icon: '🛰', kosten: 60000000000, wachstum: 1.175, ertrag: 40000000,
      branche: 'tech', zulieferer: 'industrie',
      text: 'Startfenster alle elf Tage, Versicherung unbezahlbar.' },
    { id: 'staatsfonds', name: 'Staatsfonds', icon: '💰', kosten: 300000000000, wachstum: 1.18, ertrag: 200000000,
      branche: 'finanz',
      text: 'Besitzt Anteile an allem, was weiter oben in dieser Liste steht.' },
  ];

  D.MEILENSTEIN = 25;          // alle 25 Stufen verdoppelt sich der Ertrag

  /* ---------------------------------------------------------- Ausbau */

  /* Drei Ausbaustufen je Firma. Sie kosten ein Vielfaches des Grundpreises
     und wirken auf die ganze Firma statt auf eine einzelne Stufe - ab
     einer gewissen Groesse lohnt Ausbau mehr als die naechste Stufe.

     preis   = Vielfaches des Grundpreises der Firma
     abStufe = so gross muss die Firma sein, bevor es weitergeht */
  D.AUSBAU = [
    { faktor: 1.5, preis: 22, abStufe: 10,
      text: 'Neue Technik, weniger Stillstand.' },
    { faktor: 2, preis: 140, abStufe: 25,
      text: 'Aus einem Standort werden viele.' },
    { faktor: 3, preis: 850, abStufe: 50,
      text: 'Wer den Preis macht, verdient am meisten.' },
  ];

  /* Jede Branche nennt ihre Ausbaustufen anders - gleiche Wirkung,
     anderer Beleg auf der Rechnung. */
  D.AUSBAU_NAMEN = {
    handel: ['Kassensystem', 'Filialnetz', 'Eigenmarke'],
    gastro: ['Profiküche', 'Zweiter Standort', 'Franchise'],
    agrar: ['Maschinenpark', 'Zweiter Hof', 'Direktvermarktung'],
    handwerk: ['Maschinenhalle', 'Zweite Kolonne', 'Generalunternehmer'],
    logistik: ['Tourenplanung', 'Zweites Depot', 'Eigene Flotte'],
    industrie: ['Automatisierung', 'Zweite Linie', 'Eigene Fertigungstiefe'],
    energie: ['Speicher', 'Zweiter Park', 'Eigenes Netz'],
    tech: ['Aufgeräumter Code', 'Zweites Team', 'Eigene Plattform'],
    medien: ['Eigenes Studio', 'Zweiter Kanal', 'Rechtekatalog'],
    gesund: ['Gerätepark', 'Zweiter Standort', 'Ärztenetz'],
    finanz: ['Risikomodell', 'Zweites Haus', 'Eigene Bilanz'],
  };

  D.ausbauName = function (brancheId, i) {
    var n = D.AUSBAU_NAMEN[brancheId];
    return (n && n[i]) || ['Modernisierung', 'Ausbau', 'Marktführung'][i] || 'Ausbau';
  };

  /* ---------------------------------------------------------- Markt */

  /* Jede Branche hat einen Markt, und der ist endlich. Solange der eigene
     Ertrag darunter bleibt, aendert sich nichts. Darueber kauft niemand
     mehr zum vollen Preis - der Ertrag waechst dann nur noch gedaempft.

     Der Markt waechst mit: jede weitere Firma in der Branche macht ihn
     groesser, und eine Werbekampagne hebt ihn zusaetzlich an. Deshalb
     lohnt Verteilen auf mehrere Branchen mehr als Stapeln auf einer. */
  D.MARKT_STUFEN = 30;         // so viele Stufen je Firma nimmt der Markt auf
  D.MARKT_SCHUB = 1.6;         // Faktor je Werbekampagne
  D.MARKT_TAGE = 34;           // Preis einer Kampagne: so viele Tage Marktvolumen
  D.SAETTIGUNG = 0.3;          // Haerte der Daempfung, 0 = keine, 1 = harte Decke

  D.FIRMA_RUECK = 0.55;        // so viel bringt eine abgegebene Firmenstufe zurueck

  D.saettigung = function (roh, markt) {
    if (markt <= 0 || roh <= markt) return 1;
    return Math.pow(markt / roh, D.SAETTIGUNG);
  };

  /* ---------------------------------------------------------- Lieferketten */

  /* Wer seine Zulieferer selbst besitzt, kauft zum Selbstkostenpreis ein. */
  D.LIEFER_PRO = 0.1;          // je eigenem Betrieb in der Zulieferbranche
  D.LIEFER_MAX = 0.4;          // mehr als das bringt es nicht

  /* ---------------------------------------------------------- Bank */

  D.KREDIT = {
    zinsTag: 0.0025,           // je Tag auf die Restschuld
    quote: 0.4,                // hoechstens so viel vom schuldenfreien Vermoegen
    sockel: 4000,              // so viel gibt die Bank auch ohne Sicherheiten
    notgrenze: 0.8,            // darueber verwertet die Bank selbst
  };


  /* ---------------------------------------------------------- Personal */

  /* Wer einen Betrieb leitet, holt mehr heraus - kostet aber jeden Tag
     Geld, egal wie das Geschaeft laeuft.

     ertrag = Faktor auf den Ertrag der Firma
     lohn   = Anteil des Grundertrags je Tag, also der Groesse des
              Betriebs - nicht seines Tagesumsatzes. Genau darin liegt
              der Haken: in einer Flaute oder in einem uebersaettigten
              Markt verdient die Leitung weniger, als sie kostet. */
  D.LEITUNG = [
    { name: 'Betriebsleiter', icon: '🔑', ertrag: 1.18, lohn: 0.08,
      text: 'Kümmert sich um den Laden, wenn du woanders bist.' },
    { name: 'Geschäftsführer', icon: '👔', ertrag: 1.4, lohn: 0.2,
      text: 'Verhandelt Einkaufspreise, die du nie bekommen hättest.' },
    { name: 'Vorstand', icon: '🎩', ertrag: 1.7, lohn: 0.38,
      text: 'Kommt zweimal im Jahr vorbei und verdoppelt trotzdem den Umsatz.' },
  ];

  /* Einstellen kostet einmalig so viele Tagesloehne. */
  D.LEITUNG_ANTRITT = 12;

  /* ---------------------------------------------------------- Angebote */

  /* Zeitlich begrenzte Gelegenheiten. Sie sind der Grund, warum es sich
     lohnt, zwischendurch in die Firmenliste zu schauen, statt nur
     zuzusehen. Mehr als zwei liegen nie gleichzeitig an. */
  D.ANGEBOT_MAX = 2;
  D.ANGEBOT_ABSTAND = [6, 13];   // Spieltage zwischen zwei Gelegenheiten
  D.ANGEBOT_DAUER = [2, 4];      // so lange steht ein Angebot

  D.ANGEBOTE = [
    { art: 'paket', gewicht: 10, rabatt: [0.32, 0.48], menge: [8, 18],
      titel: 'Betrieb zu verkaufen',
      text: 'Ein Mitbewerber hört auf und gibt seinen Standort ab.' },
    { art: 'ausbau', gewicht: 7, rabatt: [0.4, 0.55],
      titel: 'Restposten beim Ausbau',
      text: 'Die Anlage steht schon fertig beim Lieferanten. Er will sie los.' },
    { art: 'kampagne', gewicht: 6, rabatt: [0.4, 0.55],
      titel: 'Freie Werbeplätze',
      text: 'Eine abgesagte Kampagne hinterlässt gebuchte Flächen.' },
    { art: 'immobilie', gewicht: 6, rabatt: [0.18, 0.3],
      titel: 'Objekt aus einer Erbmasse',
      text: 'Drei Erben, ein Notar und wenig Geduld.' },
  ];

  /* ---------------------------------------------------------- Boersenauftraege */

  /* Ein Limit-Auftrag wartet auf seinen Kurs, auch wenn niemand zusieht. */
  D.AUFTRAG_MAX = 6;             // so viele liegen gleichzeitig im Buch
  D.AUFTRAG_TAGE = 40;           // danach verfaellt er

  /* ---------------------------------------------------------- Abwesenheit */

  /* Was in der Zwischenzeit passiert ist. Bewusst gedeckelt: sonst
     entscheidet die Laenge der Pause das Spiel und nicht das Spielen. */
  D.OFFLINE_ANTEIL = 0.5;        // so viel der echten Zeit laeuft nach
  D.OFFLINE_MAX_TAGE = 60;       // hoechstens so viele Spieltage
  D.OFFLINE_MIN_SEK = 90;        // darunter lohnt keine Meldung

  /* ---------------------------------------------------------- Ziele */

  /* Kleine Aufgaben mit Belohnung. Sie geben der Mitte des Spiels eine
     Richtung, in der die Raenge noch weit weg sind.

     pruef(s, S) bekommt den Zustand und die Simulation - die Ziele
     rechnen damit selbst, statt dass die Simulation sie kennen muss. */
  function firmenAnzahl(s) {
    var n = 0;
    for (var i = 0; i < D.FIRMEN.length; i++) if ((s.firmen[D.FIRMEN[i].id] || 0) > 0) n++;
    return n;
  }
  function branchenAnzahl(s) {
    var da = {}, n = 0;
    for (var i = 0; i < D.FIRMEN.length; i++) {
      var f = D.FIRMEN[i];
      if ((s.firmen[f.id] || 0) > 0 && !da[f.branche]) { da[f.branche] = true; n++; }
    }
    return n;
  }
  function stufenSumme(s) {
    var n = 0;
    for (var i = 0; i < D.FIRMEN.length; i++) n += s.firmen[D.FIRMEN[i].id] || 0;
    return n;
  }
  function hoechsteStufe(s) {
    var n = 0;
    for (var i = 0; i < D.FIRMEN.length; i++) n = Math.max(n, s.firmen[D.FIRMEN[i].id] || 0);
    return n;
  }
  D.firmenAnzahl = firmenAnzahl;
  D.branchenAnzahl = branchenAnzahl;
  D.stufenSumme = stufenSumme;

  D.ZIELE = [
    { id: 'start', name: 'Der erste eigene Laden', lohn: 300,
      text: 'Gründe deinen ersten Betrieb.',
      pruef: function (s) { return firmenAnzahl(s) >= 1; } },
    { id: 'drei', name: 'Drei Standbeine', lohn: 4000,
      text: 'Habe Betriebe in drei verschiedenen Branchen.',
      pruef: function (s) { return branchenAnzahl(s) >= 3; } },
    { id: 'chef', name: 'Jemand für den Laden', lohn: 12000,
      text: 'Stelle die erste Leitung ein.',
      pruef: function (s) {
        for (var k in s.leitung) if (s.leitung[k] > 0) return true;
        return false;
      } },
    { id: 'verdopplung', name: 'Erste Verdopplung', lohn: 9000,
      text: 'Bringe eine Firma auf Stufe ' + D.MEILENSTEIN + '.',
      pruef: function (s) { return hoechsteStufe(s) >= D.MEILENSTEIN; } },
    { id: 'ausbau', name: 'Investiert statt gewartet', lohn: 30000,
      text: 'Kaufe die erste Ausbaustufe einer Firma.',
      pruef: function (s) {
        for (var k in s.ausbau) if (s.ausbau[k] > 0) return true;
        return false;
      } },
    { id: 'million', name: 'Die erste Million', lohn: 60000,
      text: 'Bringe dein Vermögen auf eine Million Euro.',
      pruef: function (s, S) { return S.vermoegen(s) >= 1e6; } },
    { id: 'kette', name: 'Eigene Lieferkette', lohn: 90000,
      text: 'Beliefere eine eigene Firma zu mindestens 30 Prozent selbst.',
      pruef: function (s, S) {
        for (var i = 0; i < D.FIRMEN.length; i++) {
          var f = D.FIRMEN[i];
          if ((s.firmen[f.id] || 0) > 0 && S.lieferBonus(s, f) >= 1.3 - 1e-9) return true;
        }
        return false;
      } },
    { id: 'fuenf', name: 'Breit aufgestellt', lohn: 200000,
      text: 'Habe Betriebe in fünf verschiedenen Branchen.',
      pruef: function (s) { return branchenAnzahl(s) >= 5; } },
    { id: 'boerse', name: 'Der Auftrag ging durch', lohn: 120000,
      text: 'Lass einen Limit-Auftrag an der Börse ausführen.',
      pruef: function (s) { return (s.zaehler.auftraege || 0) >= 1; } },
    { id: 'hundert', name: 'Hundert Stufen', lohn: 400000,
      text: 'Besitze insgesamt hundert Firmenstufen.',
      pruef: function (s) { return stufenSumme(s) >= 100; } },
    { id: 'schuldenfrei', name: 'Alles zurückgezahlt', lohn: 250000,
      text: 'Nimm einen Kredit auf und tilge ihn vollständig.',
      pruef: function (s) { return (s.zaehler.kredite || 0) >= 1; } },
    { id: 'puenktlich', name: 'Ein sauberes Halbjahr', lohn: 900000,
      text: 'Begleiche sechs Steuerbescheide, ohne in Rückstand zu geraten.',
      pruef: function (s) { return (s.zaehler.steuerPuenktlich || 0) >= 6; } },
    { id: 'jahr', name: 'Ein ganzes Jahr', lohn: 700000,
      text: 'Führe dein Unternehmen ' + (12 * D.TAGE_PRO_MONAT) + ' Tage lang.',
      pruef: function (s) { return s.tag >= 12 * D.TAGE_PRO_MONAT; } },
    { id: 'vorstand', name: 'Ein richtiger Konzern', lohn: 2500000,
      text: 'Setze in drei Firmen einen Vorstand ein.',
      pruef: function (s) {
        var n = 0;
        for (var k in s.leitung) if (s.leitung[k] >= D.LEITUNG.length) n++;
        return n >= 3;
      } },
    { id: 'marktfuehrer', name: 'Marktführer', lohn: 4000000,
      text: 'Erweitere den Markt einer Branche mit drei Werbekampagnen.',
      pruef: function (s) {
        for (var k in s.markt) if (s.markt[k] >= 3) return true;
        return false;
      } },
    { id: 'vollausbau', name: 'Ausgereizt', lohn: 8000000,
      text: 'Baue eine Firma auf allen drei Stufen aus.',
      pruef: function (s) {
        for (var k in s.ausbau) if (s.ausbau[k] >= D.AUSBAU.length) return true;
        return false;
      } },
    { id: 'alle', name: 'In jeder Branche zu Hause', lohn: 30000000,
      text: 'Habe in allen ' + D.BRANCHEN.length + ' Branchen einen Betrieb.',
      pruef: function (s) { return branchenAnzahl(s) >= D.BRANCHEN.length; } },
    { id: 'milliarde', name: 'Die erste Milliarde', lohn: 120000000,
      text: 'Bringe dein Vermögen auf eine Milliarde Euro.',
      pruef: function (s, S) { return S.vermoegen(s) >= 1e9; } },
  ];

  /* ---------------------------------------------------------- Aktien */

  D.AKTIEN = [
    { id: 'nordbahn', name: 'Nordbahn AG', kuerzel: 'NBA', start: 42, schwankung: 0.012, dividende: 0.0009,
      text: 'Schienen, Fracht, Fahrplan. Langweilig und verlässlich.' },
    { id: 'helios', name: 'Helios Energie', kuerzel: 'HLS', start: 128, schwankung: 0.026, dividende: 0.0006,
      text: 'Läuft mit der Politik — nach oben wie nach unten.' },
    { id: 'krantec', name: 'Krantec Systeme', kuerzel: 'KRT', start: 310, schwankung: 0.019, dividende: 0.0005,
      text: 'Maschinenbau mit Auftragsbuch bis 2031.' },
    { id: 'blausee', name: 'Blausee Pharma', kuerzel: 'BLS', start: 76, schwankung: 0.034, dividende: 0.0003,
      text: 'Ein Zulassungsbescheid entscheidet über alles.' },
    { id: 'orion', name: 'Orion Digital', kuerzel: 'ORN', start: 205, schwankung: 0.042, dividende: 0,
      text: 'Wächst schnell, fällt schneller.' },
    { id: 'vesper', name: 'Vesper Immobilien', kuerzel: 'VSP', start: 58, schwankung: 0.015, dividende: 0.0012,
      text: 'Zahlt zuverlässig aus, bewegt sich kaum.' },
  ];

  /* ---------------------------------------------------------- Immobilien */

  /* miete = Euro je Tag, unterhalt = Anteil der Miete, der wieder weggeht */
  D.IMMOBILIEN = [
    { id: 'garage', name: 'Garage', icon: '🚗', preis: 24000, miete: 90, unterhalt: 0.1,
      text: 'Trocken, abschließbar, immer gefragt.' },
    { id: 'einzimmer', name: 'Einzimmerwohnung', icon: '🚪', preis: 110000, miete: 380, unterhalt: 0.14,
      text: 'Vierter Stock, kein Aufzug.' },
    { id: 'reihenhaus', name: 'Reihenhaus', icon: '🏠', preis: 420000, miete: 1350, unterhalt: 0.16,
      text: 'Garten hinten raus, Familie drin.' },
    { id: 'mehrfamilien', name: 'Mehrfamilienhaus', icon: '🏢', preis: 1800000, miete: 5600, unterhalt: 0.18,
      text: 'Acht Parteien, acht Meinungen zur Heizung.' },
    { id: 'buero', name: 'Bürohaus', icon: '🏬', preis: 9000000, miete: 26000, unterhalt: 0.2,
      text: 'Langfristige Verträge, sehr langfristige.' },
    { id: 'zentrum', name: 'Einkaufszentrum', icon: '🛍', preis: 52000000, miete: 140000, unterhalt: 0.22,
      text: 'Vierzig Mieter, ein Hausmeister.' },
    { id: 'hochhaus', name: 'Hochhaus', icon: '🌆', preis: 280000000, miete: 700000, unterhalt: 0.24,
      text: 'Vierundvierzig Stockwerke mit eigener Postleitzahl.' },
  ];

  /* ---------------------------------------------------------- Residenzen */

  /* Wohnsitze. Bringen kein Geld, sondern Ansehen - und Ansehen
     schaltet Raenge frei. Der Unterhalt laeuft taeglich mit. */
  D.RESIDENZEN = [
    { id: 'wg', name: 'WG-Zimmer', icon: '🛏', preis: 0, ansehen: 0, unterhalt: 0,
      text: 'Zwölf Quadratmeter, geteilte Küche. Der Anfang.' },
    { id: 'wohnung', name: 'Stadtwohnung', icon: '🏙', preis: 320000, ansehen: 6, unterhalt: 120,
      text: 'Altbau, Stuck, viel zu laut. Trotzdem stolz.' },
    { id: 'villa', name: 'Villa am See', icon: '🏡', preis: 4200000, ansehen: 24, unterhalt: 900,
      text: 'Steg, Boot, morgens Nebel über dem Wasser.' },
    { id: 'penthouse', name: 'Penthouse', icon: '🌃', preis: 32000000, ansehen: 70, unterhalt: 5200,
      text: 'Oberste Etage, Blick bis zum Flughafen.' },
    { id: 'landsitz', name: 'Landsitz', icon: '🏰', preis: 210000000, ansehen: 190, unterhalt: 34000,
      text: 'Achtzig Hektar, eigene Auffahrt, eigener Wald.' },
    { id: 'insel', name: 'Privatinsel', icon: '🏝', preis: 1400000000, ansehen: 460, unterhalt: 210000,
      text: 'Kein Nachbar in Sichtweite. Keiner.' },
    { id: 'schloss', name: 'Schloss', icon: '🏯', preis: 9000000000, ansehen: 1100, unterhalt: 1400000,
      text: 'Zweihundert Zimmer, von denen du vier benutzt.' },
  ];

  /* ---------------------------------------------------------- Luxus */

  D.LUXUS = [
    { id: 'uhr', name: 'Armbanduhr', icon: '⌚', preis: 55000, ansehen: 4,
      text: 'Fällt nur denen auf, die sie auch haben.' },
    { id: 'sportwagen', name: 'Sportwagen', icon: '🏎', preis: 380000, ansehen: 12,
      text: 'Zwei Sitze, kein Kofferraum, viel Lärm.' },
    { id: 'weingut', name: 'Weingut', icon: '🍇', preis: 950000, ansehen: 18,
      text: 'Ein Hobby, das sich in guten Jahren fast trägt.' },
    { id: 'kunst', name: 'Kunstsammlung', icon: '🖼', preis: 3400000, ansehen: 34,
      text: 'Hängt im Flur und steigt im Wert.' },
    { id: 'rennstall', name: 'Rennstall', icon: '🐎', preis: 9500000, ansehen: 56,
      text: 'Sechs Pferde, ein Trainer, viele Meinungen.' },
    { id: 'jacht', name: 'Jacht', icon: '🛥', preis: 28000000, ansehen: 95,
      text: 'Der zweitschönste Tag ist der Kauf.' },
    { id: 'verein', name: 'Fußballverein', icon: '⚽', preis: 75000000, ansehen: 160,
      text: 'Achtzehntausend Menschen, die alle besser wissen, wie es geht.' },
    { id: 'jet', name: 'Privatjet', icon: '✈', preis: 160000000, ansehen: 240,
      text: 'Nie wieder Sicherheitskontrolle.' },
    { id: 'museum', name: 'Eigenes Museum', icon: '🏺', preis: 620000000, ansehen: 420,
      text: 'Der Name steht über dem Eingang, nicht auf einer Tafel im Foyer.' },
    { id: 'rakete', name: 'Raketenprogramm', icon: '🚀', preis: 2600000000, ansehen: 700,
      text: 'Weil es sonst niemand macht.' },
  ];

  /* ---------------------------------------------------------- Steuern */

  /* Monatlich auf den Gewinn seit der letzten Abrechnung. */
  D.STEUERSTUFEN = [
    { bis: 120000, satz: 0.20 },
    { bis: 1500000, satz: 0.30 },
    { bis: 60000000, satz: 0.38 },
    { bis: Infinity, satz: 0.45 },
  ];

  D.BERATUNG = [
    { id: 'steuerberater', name: 'Steuerberater', kosten: 25000, rabatt: 0.03,
      text: 'Kennt jede Zeile im Formular.' },
    { id: 'kanzlei', name: 'Wirtschaftskanzlei', kosten: 900000, rabatt: 0.03,
      text: 'Gestaltet, statt nur auszufüllen.' },
    { id: 'holding', name: 'Holdingstruktur', kosten: 18000000, rabatt: 0.03,
      text: 'Alles unter einem Dach, mit Absicht.' },
    { id: 'stiftung', name: 'Familienstiftung', kosten: 240000000, rabatt: 0.03,
      text: 'Denkt in Generationen statt in Jahren.' },
  ];
  D.MAX_RABATT = 0.12;

  /* So viele Monate laesst das Finanzamt eine Forderung offen stehen.
     Danach holt es sich das Geld selbst - erst von der Kasse, dann aus
     Depot und Immobilien. Die Firmen bleiben unangetastet. */
  D.STEUER_FRIST = 3;

  /* ---------------------------------------------------------- Raenge */

  /* Die ersten Stufen kommen bewusst schnell - der Anfang soll sich nicht
     wie Arbeit anfuehlen. Nach oben zieht es sich dann deutlich. */
  D.RAENGE = [
    { name: 'Praktikant', ab: 0, ansehen: 0 },
    { name: 'Angestellter', ab: 4000, ansehen: 0 },
    { name: 'Selbstständig', ab: 55000, ansehen: 0 },
    { name: 'Unternehmer', ab: 900000, ansehen: 10 },
    { name: 'Investor', ab: 12000000, ansehen: 40 },
    { name: 'Magnat', ab: 140000000, ansehen: 125 },
    { name: 'Milliardär', ab: 1500000000, ansehen: 340 },
    { name: 'Imperium', ab: 20000000000, ansehen: 900 },
    { name: 'Dynastie', ab: 250000000000, ansehen: 1900 },
    { name: 'Titan', ab: 4000000000000, ansehen: 2600 },
  ];

  /* ---------------------------------------------------------- Ereignisse */

  /* dauer in Spieltagen, wirkung multiplikativ. Bis zu zwei Ereignisse
     laufen gleichzeitig.

     firmen  = wirkt auf alle Firmen
     branchen = wirkt nur auf die genannten Branchen
     mieten, boerse = Immobilien und Kurse
     einmalig = wirkt sofort einmal statt ueber mehrere Tage */
  D.EREIGNISSE = [
    { id: 'boom', name: 'Konjunkturaufschwung', gut: true, dauer: 8, gewicht: 9,
      firmen: 1.35, text: 'Die Auftragsbücher sind voll. Alle Firmen liefern mehr ab.' },
    { id: 'flaute', name: 'Auftragsflaute', gut: false, dauer: 7, gewicht: 9,
      firmen: 0.72, text: 'Kaum Bestellungen. Die Firmen bringen deutlich weniger ein.' },
    { id: 'mietspiegel', name: 'Neuer Mietspiegel', gut: true, dauer: 12, gewicht: 7,
      mieten: 1.3, text: 'Die Mieten dürfen angehoben werden.' },
    { id: 'mietdeckel', name: 'Mietdeckel', gut: false, dauer: 12, gewicht: 6,
      mieten: 0.75, text: 'Die Stadt begrenzt die Mieten. Weniger Einnahmen aus Immobilien.' },
    { id: 'hausse', name: 'Börsenrausch', gut: true, dauer: 6, gewicht: 7,
      boerse: 1, text: 'An der Börse geht es steil nach oben. Kurse steigen kräftig.' },
    { id: 'crash', name: 'Börsencrash', gut: false, dauer: 5, gewicht: 5,
      boerse: -1, branchen: { finanz: 0.7 },
      text: 'Panikverkäufe. Die Kurse brechen ein, die Finanzbranche leidet mit.' },
    { id: 'zins', name: 'Zinswende', gut: false, dauer: 14, gewicht: 5,
      mieten: 0.9, boerse: -0.4, branchen: { handwerk: 0.72, finanz: 1.15 },
      text: 'Höhere Zinsen bremsen Bau, Immobilien und Börse — Banken verdienen daran.' },
    { id: 'foerderung', name: 'Fördermittel', gut: true, dauer: 10, gewicht: 5,
      firmen: 1.2, text: 'Ein Förderprogramm entlastet die Betriebe.' },
    { id: 'streik', name: 'Streik', gut: false, dauer: 4, gewicht: 5,
      firmen: 0.55, text: 'Die Belegschaft legt die Arbeit nieder.' },

    { id: 'techrausch', name: 'Technologie-Rausch', gut: true, dauer: 9, gewicht: 6,
      branchen: { tech: 1.8, medien: 1.25 },
      text: 'Alles, was nach Zukunft klingt, wird gekauft.' },
    { id: 'chipkrise', name: 'Chipkrise', gut: false, dauer: 11, gewicht: 5,
      branchen: { tech: 0.6, industrie: 0.82 },
      text: 'Keine Bauteile, keine Auslieferung.' },
    { id: 'duerre', name: 'Dürresommer', gut: false, dauer: 12, gewicht: 5,
      branchen: { agrar: 0.55, gastro: 1.2, energie: 0.88 },
      text: 'Die Ernte fällt aus. Die Biergärten sind trotzdem voll.' },
    { id: 'ernte', name: 'Rekordernte', gut: true, dauer: 10, gewicht: 5,
      branchen: { agrar: 1.55, gastro: 1.15 },
      text: 'Volle Scheunen und günstige Einkaufspreise.' },
    { id: 'energiekrise', name: 'Energiepreisschock', gut: false, dauer: 14, gewicht: 5,
      branchen: { energie: 1.7, industrie: 0.72, logistik: 0.85, handwerk: 0.88 },
      text: 'Der Strompreis explodiert. Wer ihn verkauft, verdient — wer ihn braucht, zahlt.' },
    { id: 'bauboom', name: 'Bauboom', gut: true, dauer: 12, gewicht: 5,
      branchen: { handwerk: 1.6, industrie: 1.2, logistik: 1.1 },
      text: 'Überall wird gebaut, und alle brauchen Material.' },
    { id: 'engpass', name: 'Lieferengpass', gut: false, dauer: 9, gewicht: 5,
      branchen: { logistik: 0.6, handel: 0.78, industrie: 0.85 },
      text: 'Die Häfen sind dicht, die Regale werden leer.' },
    { id: 'reform', name: 'Gesundheitsreform', gut: true, dauer: 16, gewicht: 4,
      branchen: { gesund: 1.45 },
      text: 'Neue Abrechnungssätze — und sie fallen gut aus.' },
    { id: 'streaming', name: 'Streamingboom', gut: true, dauer: 8, gewicht: 4,
      branchen: { medien: 1.7, tech: 1.15 },
      text: 'Alle schauen zu, und alle zahlen dafür.' },
    { id: 'tourismus', name: 'Rekordsaison', gut: true, dauer: 10, gewicht: 4,
      branchen: { gastro: 1.5, handel: 1.2, logistik: 1.1 },
      text: 'Die Stadt ist voll, die Kassen sind es auch.' },
    { id: 'mindestlohn', name: 'Lohnrunde', gut: false, dauer: 20, gewicht: 4,
      firmen: 0.92, branchen: { gastro: 0.82, handel: 0.86 },
      text: 'Höhere Löhne. Wer viele Leute beschäftigt, spürt es am meisten.' },
    { id: 'aufsicht', name: 'Verschärfte Finanzaufsicht', gut: false, dauer: 10, gewicht: 4,
      branchen: { finanz: 0.68 },
      text: 'Mehr Eigenkapital, weniger Geschäft.' },

    { id: 'pruefung', name: 'Steuerprüfung', gut: false, dauer: 1, gewicht: 5,
      einmalig: 'pruefung', text: 'Das Finanzamt schaut genauer hin. Eine Nachzahlung wird fällig.' },
    { id: 'grossauftrag', name: 'Großauftrag', gut: true, dauer: 1, gewicht: 6,
      einmalig: 'bonus', text: 'Ein einzelner Kunde bestellt in großem Stil.' },
    { id: 'schaden', name: 'Schadensfall', gut: false, dauer: 1, gewicht: 4,
      einmalig: 'schaden', text: 'Ein Wasserschaden, und die Versicherung zahlt nur die Hälfte.' },
  ];

  /* ---------------------------------------------------------- Helfer */

  D.firma = function (id) {
    for (var i = 0; i < D.FIRMEN.length; i++) if (D.FIRMEN[i].id === id) return D.FIRMEN[i];
    return null;
  };
  D.immobilie = function (id) {
    for (var i = 0; i < D.IMMOBILIEN.length; i++) if (D.IMMOBILIEN[i].id === id) return D.IMMOBILIEN[i];
    return null;
  };
  D.aktie = function (id) {
    for (var i = 0; i < D.AKTIEN.length; i++) if (D.AKTIEN[i].id === id) return D.AKTIEN[i];
    return null;
  };

  D.branche = function (id) {
    for (var i = 0; i < D.BRANCHEN.length; i++) if (D.BRANCHEN[i].id === id) return D.BRANCHEN[i];
    return null;
  };

  /* Alle Firmen einer Branche, in Preisreihenfolge. Das Ergebnis wird
     gemerkt - die Tabellen aendern sich zur Laufzeit nicht. */
  var brancheCache = null;
  D.firmenDerBranche = function (id) {
    if (!brancheCache) {
      brancheCache = {};
      for (var i = 0; i < D.FIRMEN.length; i++) {
        var b = D.FIRMEN[i].branche;
        (brancheCache[b] = brancheCache[b] || []).push(D.FIRMEN[i]);
      }
    }
    return brancheCache[id] || [];
  };

  /* Preis einer Ausbaustufe: ein Vielfaches des Grundpreises der Firma */
  D.ausbauPreis = function (def, i) {
    var a = D.AUSBAU[i];
    return a ? Math.round(def.kosten * a.preis) : null;
  };

  /* Preis der naechsten Stufe einer Firma */

  D.firmenPreis = function (def, stufe) {
    return Math.round(def.kosten * Math.pow(def.wachstum, stufe));
  };

  /* Preis fuer mehrere Stufen auf einmal (geometrische Reihe) */
  D.firmenPreisMenge = function (def, stufe, menge) {
    var q = def.wachstum;
    var erste = def.kosten * Math.pow(q, stufe);
    return Math.round(erste * (Math.pow(q, menge) - 1) / (q - 1));
  };

  D.rang = function (vermoegen, ansehen) {
    var beste = D.RAENGE[0];
    for (var i = 0; i < D.RAENGE.length; i++) {
      var r = D.RAENGE[i];
      if (vermoegen >= r.ab && ansehen >= r.ansehen) beste = r;
    }
    return beste;
  };

  D.steuersatz = function (gewinn, rabatt) {
    var satz = D.STEUERSTUFEN[D.STEUERSTUFEN.length - 1].satz;
    for (var i = 0; i < D.STEUERSTUFEN.length; i++) {
      if (gewinn <= D.STEUERSTUFEN[i].bis) { satz = D.STEUERSTUFEN[i].satz; break; }
    }
    return Math.max(0.05, satz - Math.min(rabatt || 0, D.MAX_RABATT));
  };
})(SG);
