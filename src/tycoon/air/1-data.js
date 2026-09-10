/* ------------------------------------------------------------------
   Flughafen-Tycoon - Tabellen

   Alle Zahlen stehen hier. Die Simulation liest sie, die Oberflaeche
   zeigt sie an.

   Zeit: eine Stunde Flugbetrieb dauert bei 1x zwei echte Sekunden,
   ein Tag also knapp eine Minute. Betriebskosten und Gehaelter kommen
   monatlich, Entgelte sofort mit jedem Flug.

   Der Flughafen wird nicht auf ein Raster gesetzt, sondern aus Bauteilen
   zusammengesetzt: Bahnen, Terminals, Piers mit Gates, dazu die Anlagen
   drumherum. Das Bild ergibt sich daraus - wer eine zweite Bahn baut,
   sieht sie liegen.
   ------------------------------------------------------------------ */

(function (SG) {
  var D = (SG.tycoon.air = SG.tycoon.air || {}).data = {};

  D.SEK_PRO_STUNDE = 2;
  D.STUNDEN_PRO_TAG = 24;
  D.TAGE_PRO_MONAT = 30;

  /* ---------------------------------------------------------- Flugzeuge */

  /* groesse  1 Turboprop … 5 Grossraum XL - bestimmt, welches Gate passt
     bahn     Startbahnlaenge in Metern, die das Muster braucht
     pax      Sitzplaetze (Auslastung kommt aus der Nachfrage dazu)
     entgelt  Landeentgelt in Euro, grob nach Hoechstabflugmasse
     boden    Minuten Standzeit bei normaler Abfertigung */
  D.MUSTER = [
    {
      id: 'prop', name: 'Turboprop', kurz: 'DH8', icon: '🛩', groesse: 1,
      bahn: 1300, pax: 76, fracht: 1, entgelt: 320, boden: 30,
      text: 'Kurzstrecke, laut, aber sie fliegt bei jedem Wetter.',
    },
    {
      id: 'regio', name: 'Regionaljet', kurz: 'CRJ', icon: '✈', groesse: 2,
      bahn: 1700, pax: 100, fracht: 2, entgelt: 640, boden: 35,
      text: 'Der Standard auf dünnen Strecken.',
    },
    {
      id: 'schmal', name: 'Standardrumpf', kurz: 'A320', icon: '✈', groesse: 3,
      bahn: 2200, pax: 180, fracht: 4, entgelt: 1650, boden: 45,
      text: 'Das Arbeitstier Europas.',
    },
    {
      id: 'breit', name: 'Großraum', kurz: 'A330', icon: '🛫', groesse: 4,
      bahn: 2900, pax: 290, fracht: 14, entgelt: 4200, boden: 75,
      text: 'Langstrecke. Bringt Passagiere und Fracht zugleich.',
    },
    {
      id: 'jumbo', name: 'Großraum XL', kurz: 'B777', icon: '🛫', groesse: 4,
      bahn: 3200, pax: 380, fracht: 22, entgelt: 6800, boden: 90,
      text: 'Zwei Triebwerke, elf Stunden Flugzeit.',
    },
    {
      id: 'riese', name: 'Doppeldecker', kurz: 'A380', icon: '🛬', groesse: 5,
      bahn: 3600, pax: 540, fracht: 18, entgelt: 11500, boden: 120,
      text: 'Braucht ein eigenes Gate und viel Bahn.',
    },
    {
      id: 'fracht', name: 'Frachter', kurz: 'B767F', icon: '📦', groesse: 4,
      bahn: 2800, pax: 0, fracht: 55, entgelt: 3900, boden: 110,
      text: 'Nachts unterwegs, wenn niemand sonst fliegt.',
    },
  ];

  D.musterVon = function (id) {
    for (var i = 0; i < D.MUSTER.length; i++) if (D.MUSTER[i].id === id) return D.MUSTER[i];
    return D.MUSTER[0];
  };

  /* ---------------------------------------------------------- Bahnen */

  /* Eine Bahn kostet beim Bau, jede Verlaengerung kostet erneut.
     laenge entscheidet, welche Muster ueberhaupt landen duerfen. */
  D.BAHN_STUFEN = [
    { laenge: 1400, name: '1.400 m', kosten: 0 },
    { laenge: 1800, name: '1.800 m', kosten: 900000 },
    { laenge: 2400, name: '2.400 m', kosten: 2600000 },
    { laenge: 3000, name: '3.000 m', kosten: 7000000 },
    { laenge: 3600, name: '3.600 m', kosten: 16000000 },
    { laenge: 4000, name: '4.000 m', kosten: 34000000 },
  ];

  D.BAHN_BAU = [1800000, 12000000, 55000000];   // Preis der 1., 2., 3. Bahn
  D.BAHN_UNTERHALT = 42000;                     // je Bahn und Monat
  D.BAHN_KAPAZITAET = 26;                       // Bewegungen je Stunde und Bahn

  /* ---------------------------------------------------------- Gates */

  /* groesse = groesstes Muster, das hier stehen darf.
     Ein kleines Flugzeug darf an ein grosses Gate - umgekehrt nicht. */
  D.GATE_ARTEN = [
    {
      id: 'position', name: 'Außenposition', icon: '🅿', groesse: 3,
      kosten: 260000, unterhalt: 3200, komfort: -0.06,
      text: 'Bus statt Fluggastbrücke. Billig, aber niemand mag es.',
    },
    {
      id: 'klein', name: 'Gate klein', icon: '🚪', groesse: 2,
      kosten: 620000, unterhalt: 6500, komfort: 0.01,
      text: 'Für Turboprops und Regionaljets.',
    },
    {
      id: 'mittel', name: 'Gate mittel', icon: '🚪', groesse: 3,
      kosten: 1500000, unterhalt: 11000, komfort: 0.03,
      text: 'Fluggastbrücke für Standardrumpf.',
    },
    {
      id: 'gross', name: 'Gate groß', icon: '🛃', groesse: 4,
      kosten: 4400000, unterhalt: 24000, komfort: 0.05,
      text: 'Zwei Brücken, für Großraumflugzeuge.',
    },
    {
      id: 'xl', name: 'Gate XL', icon: '🛃', groesse: 5,
      kosten: 13500000, unterhalt: 52000, komfort: 0.07,
      text: 'Drei Brücken auf zwei Ebenen. Nur der Doppeldecker braucht es.',
    },
  ];

  D.gateArt = function (id) {
    for (var i = 0; i < D.GATE_ARTEN.length; i++) {
      if (D.GATE_ARTEN[i].id === id) return D.GATE_ARTEN[i];
    }
    return D.GATE_ARTEN[0];
  };

  /* Jedes weitere Gate derselben Art wird teurer - der Platz wird knapp */
  D.GATE_STEIGERUNG = 1.16;

  /* ---------------------------------------------------------- Terminals */

  /* Ein Terminal fasst nur so viele Gates. Ohne Platz kein weiteres Gate. */
  D.TERMINALS = [
    { name: 'Abfertigungsgebäude', plaetze: 4, kosten: 1200000, unterhalt: 28000, kapazitaet: 900 },
    { name: 'Terminal 2', plaetze: 8, kosten: 9500000, unterhalt: 95000, kapazitaet: 2800 },
    { name: 'Terminal 3', plaetze: 12, kosten: 42000000, unterhalt: 260000, kapazitaet: 7000 },
    { name: 'Terminal 4', plaetze: 16, kosten: 150000000, unterhalt: 620000, kapazitaet: 15000 },
    { name: 'Satellitenhalle', plaetze: 20, kosten: 420000000, unterhalt: 1300000, kapazitaet: 26000 },
  ];

  /* ---------------------------------------------------------- Anlagen */

  /* stufen: wie oft man dieselbe Anlage bauen kann. wirkung wird in
     der Simulation ausgewertet - der Schluessel steht in `wirkt`. */
  D.ANLAGEN = [
    {
      id: 'tower', name: 'Kontrollturm', icon: '🗼', kosten: 2200000, unterhalt: 45000,
      stufen: 3, steigerung: 3.2, wirkt: 'bewegungen', wert: 0.14,
      text: 'Jede Stufe schafft mehr Bewegungen pro Stunde.',
    },
    {
      id: 'rollweg', name: 'Rollwegsystem', icon: '🛣', kosten: 1400000, unterhalt: 30000,
      stufen: 4, steigerung: 2.6, wirkt: 'bewegungen', wert: 0.08,
      text: 'Schnellabrollwege räumen die Bahn früher.',
    },
    {
      id: 'parkhaus', name: 'Parkhaus', icon: '🅿', kosten: 900000, unterhalt: 16000,
      stufen: 6, steigerung: 1.7, wirkt: 'parken', wert: 1.9,
      text: 'Parkgebühren sind die stillste Einnahme eines Flughafens.',
    },
    {
      id: 'laden', name: 'Ladenzeile', icon: '🛍', kosten: 1600000, unterhalt: 34000,
      stufen: 6, steigerung: 1.8, wirkt: 'handel', wert: 2.6,
      text: 'Umsatzbeteiligung je Passagier. Skaliert mit dem Verkehr.',
    },
    {
      id: 'lounge', name: 'Lounge', icon: '🛋', kosten: 2400000, unterhalt: 52000,
      stufen: 3, steigerung: 2.2, wirkt: 'komfort', wert: 0.05,
      text: 'Hebt den Ruf - und lockt die zahlungskräftigen Linien.',
    },
    {
      id: 'gepaeck', name: 'Gepäckanlage', icon: '🧳', kosten: 3800000, unterhalt: 62000,
      stufen: 3, steigerung: 2.4, wirkt: 'boden', wert: 0.1,
      text: 'Kürzere Standzeiten, weniger verlorene Koffer.',
    },
    {
      id: 'feuerwehr', name: 'Feuerwache', icon: '🚒', kosten: 1900000, unterhalt: 58000,
      stufen: 4, steigerung: 2.1, wirkt: 'brandschutz', wert: 1,
      text: 'Ohne passende Brandschutzkategorie darf nichts Großes landen.',
    },
    {
      id: 'fracht', name: 'Frachtzentrum', icon: '📦', kosten: 5200000, unterhalt: 88000,
      stufen: 4, steigerung: 2.0, wirkt: 'fracht', wert: 1,
      text: 'Erlaubt Frachtflüge und zahlt pro Tonne.',
    },
    {
      id: 'tank', name: 'Tanklager', icon: '⛽', kosten: 2800000, unterhalt: 40000,
      stufen: 3, steigerung: 2.3, wirkt: 'sprit', wert: 0.9,
      text: 'Kerosinverkauf je Bewegung. Rechnet sich ab dem zweiten Terminal.',
    },
    {
      id: 'enteisung', name: 'Enteisungsanlage', icon: '❄', kosten: 3100000, unterhalt: 46000,
      stufen: 2, steigerung: 2.0, wirkt: 'winter', wert: 0.5,
      text: 'Im Winter der Unterschied zwischen Betrieb und Stillstand.',
    },
    {
      id: 'bahn', name: 'Bahnanschluss', icon: '🚆', kosten: 26000000, unterhalt: 180000,
      stufen: 1, steigerung: 1, wirkt: 'anbindung', wert: 0.12,
      text: 'Fernbahnhof unter dem Terminal. Hebt Nachfrage und Ruf dauerhaft.',
    },
    {
      id: 'hangar', name: 'Wartungshangar', icon: '🔧', kosten: 6400000, unterhalt: 74000,
      stufen: 3, steigerung: 2.1, wirkt: 'wartung', wert: 1,
      text: 'Technikstützpunkt. Linien mit Basis hier fliegen häufiger.',
    },
  ];

  D.anlage = function (id) {
    for (var i = 0; i < D.ANLAGEN.length; i++) if (D.ANLAGEN[i].id === id) return D.ANLAGEN[i];
    return null;
  };

  /* ---------------------------------------------------------- Ausbau */

  /* Einmalige Verbesserungen - keine Stufen, entweder da oder nicht. */
  D.AUSBAU = [
    {
      id: 'ils1', name: 'ILS Kategorie I', icon: '📡', kosten: 3400000,
      braucht: null, text: 'Instrumentenlandung bei mäßiger Sicht. Weniger Wetterausfälle.',
    },
    {
      id: 'ils2', name: 'ILS Kategorie II', icon: '📡', kosten: 11000000,
      braucht: 'ils1', text: 'Landung bei 300 m Sicht.',
    },
    {
      id: 'ils3', name: 'ILS Kategorie III', icon: '📡', kosten: 38000000,
      braucht: 'ils2', text: 'Automatische Landung. Nebel kostet fast nichts mehr.',
    },
    {
      id: 'radar', name: 'Anflugradar', icon: '📶', kosten: 8600000,
      braucht: null, text: 'Engere Staffelung: mehr Bewegungen auf derselben Bahn.',
    },
    {
      id: 'selbst', name: 'Selbst-Check-in', icon: '🖥', kosten: 4200000,
      braucht: null, text: 'Kürzere Schlangen, weniger Bodenpersonal nötig.',
    },
    {
      id: 'sicherheit', name: 'Neue Sicherheitskontrolle', icon: '🛂', kosten: 9800000,
      braucht: 'selbst', text: 'Doppelter Durchsatz an der Kontrolle.',
    },
    {
      id: 'nachtflug', name: 'Nachtfluggenehmigung', icon: '🌙', kosten: 24000000,
      braucht: null, text: 'Betrieb von 23 bis 6 Uhr. Mehr Flüge, weniger Ruf.',
    },
    {
      id: 'zoll', name: 'Zoll und Grenzkontrolle', icon: '🛄', kosten: 14000000,
      braucht: null, text: 'Pflicht für Interkontinentalflüge.',
    },
    {
      id: 'solar', name: 'Solardach', icon: '☀', kosten: 7200000,
      braucht: null, text: 'Senkt die Betriebskosten dauerhaft um ein Zehntel.',
    },
    {
      id: 'drehkreuz', name: 'Umsteigeverbindung', icon: '🔁', kosten: 62000000,
      braucht: 'zoll', text: 'Umsteiger zählen doppelt: sie kommen und fliegen weiter.',
    },
  ];

  D.ausbau = function (id) {
    for (var i = 0; i < D.AUSBAU.length; i++) if (D.AUSBAU[i].id === id) return D.AUSBAU[i];
    return null;
  };

  /* ---------------------------------------------------------- Personal */

  /* je Kopf und Monat; wirkung steht in der Simulation */
  D.PERSONAL = [
    {
      id: 'lotsen', name: 'Fluglotsen', icon: '🎧', gehalt: 7400, start: 3,
      text: 'Mehr Lotsen, mehr Bewegungen pro Stunde.',
    },
    {
      id: 'boden', name: 'Bodenpersonal', icon: '🧰', gehalt: 3100, start: 8,
      text: 'Beladen, betanken, schleppen. Kürzere Standzeiten.',
    },
    {
      id: 'sicherheit', name: 'Sicherheitspersonal', icon: '🛂', gehalt: 3400, start: 6,
      text: 'Ohne genug Kontrolleure stauen sich die Passagiere.',
    },
    {
      id: 'technik', name: 'Technik', icon: '🔧', gehalt: 4200, start: 3,
      text: 'Hält Anlagen in Betrieb. Zu wenige Techniker heißt Ausfälle.',
    },
  ];

  D.personal = function (id) {
    for (var i = 0; i < D.PERSONAL.length; i++) if (D.PERSONAL[i].id === id) return D.PERSONAL[i];
    return null;
  };

  /* Gehaltsniveau: unter 1,0 spart Geld und kostet Zufriedenheit */
  D.LOHN_STUFEN = [
    { f: 0.8, name: 'unter Tarif' },
    { f: 1.0, name: 'nach Tarif' },
    { f: 1.25, name: 'über Tarif' },
  ];

  /* ---------------------------------------------------------- Linien */

  /* mindestRuf  ab welchem Ruf die Linie ueberhaupt anfragt
     mindestBahn Bahnlaenge, die sie braucht
     bindung     wie treu sie ist, wenn es einmal klemmt */
  D.LINIEN = [
    {
      id: 'kuestenflug', name: 'Küstenflug', icon: '🐟', muster: ['prop'],
      mindestRuf: 0, mindestBahn: 1400, fluege: 4, tarif: 1.0, bindung: 0.9,
      text: 'Zwei Maschinen, ein Wartungsvertrag, viel Herzblut.',
    },
    {
      id: 'nordluft', name: 'Nordluft', icon: '🌊', muster: ['prop', 'regio'],
      mindestRuf: 12, mindestBahn: 1700, fluege: 6, tarif: 1.05, bindung: 0.85,
      text: 'Regionalverkehr im Takt. Zahlt pünktlich.',
    },
    {
      id: 'billigflug', name: 'Spar-Air', icon: '💸', muster: ['schmal'],
      mindestRuf: 20, mindestBahn: 2200, fluege: 14, tarif: 0.72, bindung: 0.55,
      text: 'Viel Verkehr, kleine Entgelte, keine Geduld bei Verspätungen.',
    },
    {
      id: 'stadtlinie', name: 'Stadtlinie', icon: '🏙', muster: ['regio', 'schmal'],
      mindestRuf: 28, mindestBahn: 2200, fluege: 10, tarif: 1.0, bindung: 0.8,
      text: 'Geschäftsreisende, morgens hin, abends zurück.',
    },
    {
      id: 'kondor', name: 'Kondor Luftverkehr', icon: '🦅', muster: ['schmal', 'breit'],
      mindestRuf: 42, mindestBahn: 2900, fluege: 12, tarif: 1.15, bindung: 0.88,
      text: 'Ferienflieger. Kommt im Sommer in Wellen.',
    },
    {
      id: 'transatlantik', name: 'Transatlantik', icon: '🌎', muster: ['breit', 'jumbo'],
      mindestRuf: 58, mindestBahn: 3200, fluege: 8, tarif: 1.4, bindung: 0.9,
      brauchtAusbau: 'zoll',
      text: 'Langstrecke nach Westen. Braucht Zoll und eine lange Bahn.',
    },
    {
      id: 'orientwings', name: 'Orient Wings', icon: '🕌', muster: ['jumbo', 'riese'],
      mindestRuf: 72, mindestBahn: 3600, fluege: 6, tarif: 1.6, bindung: 0.92,
      brauchtAusbau: 'zoll',
      text: 'Doppeldecker zweimal täglich. Wenn das Gate steht.',
    },
    {
      id: 'weltfracht', name: 'Weltfracht', icon: '📦', muster: ['fracht'],
      mindestRuf: 34, mindestBahn: 2800, fluege: 7, tarif: 1.2, bindung: 0.95,
      brauchtAnlage: 'fracht',
      text: 'Nachtsprung nach Asien. Braucht ein Frachtzentrum.',
    },
  ];

  D.linie = function (id) {
    for (var i = 0; i < D.LINIEN.length; i++) if (D.LINIEN[i].id === id) return D.LINIEN[i];
    return null;
  };

  /* ---------------------------------------------------------- Stufen */

  D.STUFEN = [
    {
      name: 'Landeplatz', icon: '🌾', paxJahr: 0, ruf: 0, bahn: 0, gates: 0,
      text: 'Ein Streifen Asphalt, ein Windsack, ein Häuschen.',
    },
    {
      name: 'Regionalflughafen', icon: '🛩', paxJahr: 150000, ruf: 20, bahn: 1800, gates: 3,
      text: 'Fahrplan an der Wand, Kaffee am Automaten.',
    },
    {
      name: 'Verkehrsflughafen', icon: '✈', paxJahr: 900000, ruf: 38, bahn: 2400, gates: 6,
      text: 'Eigene Sicherheitskontrolle, echte Abflugtafel.',
    },
    {
      name: 'Internationaler Flughafen', icon: '🌍', paxJahr: 4000000, ruf: 55, bahn: 3000, gates: 12,
      text: 'Zoll, Langstrecke, Ankünfte aus drei Kontinenten.',
    },
    {
      name: 'Großflughafen', icon: '🏙', paxJahr: 9000000, ruf: 70, bahn: 3600, gates: 20,
      text: 'Zwei Bahnen im Parallelbetrieb, Terminal 3 im Bau.',
    },
    {
      name: 'Drehkreuz', icon: '🌐', paxJahr: 24000000, ruf: 84, bahn: 3600, gates: 30,
      text: 'Wer hier landet, fliegt meistens weiter.',
    },
  ];

  D.stufeVon = function (paxJahr, ruf, bahn, gates) {
    var i = 0;
    for (var s = 0; s < D.STUFEN.length; s++) {
      var st = D.STUFEN[s];
      if (paxJahr >= st.paxJahr && ruf >= st.ruf && bahn >= st.bahn && gates >= st.gates) i = s;
    }
    return i;
  };

  /* ---------------------------------------------------------- Wetter */

  D.WETTER = [
    { id: 'klar', name: 'Klar', icon: '☀', kapazitaet: 1.0, ausfall: 0 },
    { id: 'wolken', name: 'Bewölkt', icon: '☁', kapazitaet: 0.98, ausfall: 0 },
    { id: 'regen', name: 'Regen', icon: '🌧', kapazitaet: 0.9, ausfall: 0.02 },
    { id: 'wind', name: 'Starkwind', icon: '💨', kapazitaet: 0.78, ausfall: 0.05 },
    { id: 'nebel', name: 'Nebel', icon: '🌫', kapazitaet: 0.55, ausfall: 0.16, ils: true },
    { id: 'schnee', name: 'Schnee', icon: '❄', kapazitaet: 0.5, ausfall: 0.2, winter: true },
    { id: 'sturm', name: 'Sturm', icon: '🌪', kapazitaet: 0.28, ausfall: 0.34 },
  ];

  D.wetter = function (id) {
    for (var i = 0; i < D.WETTER.length; i++) if (D.WETTER[i].id === id) return D.WETTER[i];
    return D.WETTER[0];
  };

  /* Monat 0-11 -> Wahrscheinlichkeiten. Der Winter ist ungemuetlich. */
  D.WETTER_MONAT = [
    ['schnee', 'nebel', 'wolken', 'regen', 'wind'],       // Januar
    ['schnee', 'nebel', 'wolken', 'wind', 'klar'],
    ['regen', 'wind', 'wolken', 'klar', 'klar'],
    ['regen', 'wolken', 'klar', 'klar', 'wind'],
    ['klar', 'klar', 'wolken', 'regen', 'wind'],
    ['klar', 'klar', 'klar', 'wolken', 'sturm'],
    ['klar', 'klar', 'klar', 'wolken', 'regen'],
    ['klar', 'klar', 'wolken', 'sturm', 'regen'],
    ['wolken', 'klar', 'regen', 'nebel', 'wind'],
    ['nebel', 'regen', 'wolken', 'wind', 'klar'],
    ['nebel', 'regen', 'wind', 'wolken', 'schnee'],
    ['schnee', 'nebel', 'regen', 'wolken', 'wind'],       // Dezember
  ];

  /* ---------------------------------------------------------- Ereignisse */

  D.EREIGNISSE = [
    {
      id: 'messe', icon: '🎪', name: 'Luftfahrtmesse',
      text: 'Die Messe in der Stadt füllt jeden Flug. Drei Tage volle Kabinen.',
      wirkung: { nachfrage: 0.45, tage: 3 },
    },
    {
      id: 'ferien', icon: '🏖', name: 'Ferienbeginn',
      text: 'Schulferien. Die Terminals sind voll, die Läden auch.',
      wirkung: { nachfrage: 0.3, handel: 0.4, tage: 5 },
    },
    {
      id: 'streik', icon: '✊', name: 'Warnstreik',
      text: 'Das Bodenpersonal legt die Arbeit nieder. Nichts geht schnell.',
      wirkung: { boden: -0.5, tage: 2 }, bedingung: 'unzufrieden',
    },
    {
      id: 'vogelschlag', icon: '🦆', name: 'Vogelschlag',
      text: 'Eine Maschine hat eine Gänseschar erwischt. Bahn eine Stunde dicht.',
      wirkung: { kapazitaet: -0.4, tage: 1, kosten: 180000 },
    },
    {
      id: 'kontrolle', icon: '📋', name: 'Luftaufsicht',
      text: 'Unangekündigte Kontrolle. Ohne Technik im Haus wird es teuer.',
      wirkung: { pruefung: true },
    },
    {
      id: 'kerosin', icon: '🛢', name: 'Kerosinpreis steigt',
      text: 'Die Linien sparen: kleinere Muster, weniger Flüge.',
      wirkung: { nachfrage: -0.25, tage: 6 },
    },
    {
      id: 'aschewolke', icon: '🌋', name: 'Aschewolke',
      text: 'Ein Vulkan auf Island. Der Luftraum bleibt zu.',
      wirkung: { kapazitaet: -0.85, tage: 2 },
    },
    {
      id: 'auszeichnung', icon: '🏆', name: 'Bester Regionalflughafen',
      text: 'Eine Fachzeitschrift lobt die Abfertigung. Der Ruf steigt.',
      wirkung: { ruf: 6 }, bedingung: 'puenktlich',
    },
    {
      id: 'laerm', icon: '📣', name: 'Bürgerinitiative gegen Fluglärm',
      text: 'Die Anwohner klagen. Der Ruf leidet, bis Ruhe einkehrt.',
      wirkung: { ruf: -7 }, bedingung: 'laut',
    },
    {
      id: 'neueLinie', icon: '🤝', name: 'Anfrage einer Linie',
      text: 'Eine Gesellschaft prüft den Standort. Freie Gates helfen.',
      wirkung: { anfrage: true },
    },
    {
      id: 'panne', icon: '⚙', name: 'Gepäckanlage steht',
      text: 'Ein Band ist gerissen. Die Standzeiten steigen, bis es läuft.',
      wirkung: { boden: -0.3, tage: 2, kosten: 240000 }, bedingung: 'technikarm',
    },
    {
      id: 'foerderung', icon: '🏛', name: 'Landeszuschuss',
      text: 'Das Land beteiligt sich am Ausbau.',
      wirkung: { geld: 'zuschuss' },
    },
  ];

  /* ---------------------------------------------------------- Preise */

  D.ENTGELT_MIN = 4;
  D.ENTGELT_MAX = 26;
  D.ENTGELT_START = 11;      // Euro je abfliegendem Passagier

  D.STEUERSATZ = 0.24;
  D.KREDIT_ZINS = 0.055;     // je Monat auf die Restschuld
  D.KREDIT_MAX_FAKTOR = 2.5; // Vielfaches des Monatsumsatzes

  D.PARK_QUOTE = 0.22;       // Anteil der Passagiere, der parkt
  D.FRACHT_PREIS = 210;      // Euro je Tonne

  D.formatBahn = function (m) {
    return (m / 1000).toFixed(1).replace('.', ',') + ' km';
  };
})(SG);
