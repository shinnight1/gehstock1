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

  /* ---------------------------------------------------------- Firmen */

  /* kosten = Preis der ersten Stufe, wachstum = Faktor je Stufe,
     ertrag = Euro pro Spielsekunde und Stufe.
     Alle 25 Stufen verdoppelt sich der Ertrag der Firma. */
  D.FIRMEN = [
    { id: 'zeitung', name: 'Zeitungsstand', icon: '📰', kosten: 60, wachstum: 1.13, ertrag: 0.6,
      text: 'Morgens um fünf, bei jedem Wetter.' },
    { id: 'wasch', name: 'Waschsalon', icon: '🧺', kosten: 900, wachstum: 1.135, ertrag: 4,
      text: 'Läuft von allein, solange die Trommeln halten.' },
    { id: 'kiosk', name: 'Kiosk', icon: '🏪', kosten: 7000, wachstum: 1.14, ertrag: 22,
      text: 'Zeitung, Kaffee, Lottoschein.' },
    { id: 'cafe', name: 'Café', icon: '☕', kosten: 45000, wachstum: 1.14, ertrag: 105,
      text: 'Die Miete ist hoch, die Marge auch.' },
    { id: 'werkstatt', name: 'Werkstatt', icon: '🔧', kosten: 260000, wachstum: 1.145, ertrag: 480,
      text: 'Termine bis in den übernächsten Monat.' },
    { id: 'bau', name: 'Baufirma', icon: '🏗', kosten: 1500000, wachstum: 1.15, ertrag: 2300,
      text: 'Zwei Kräne, achtzig Leute, ein Zeitplan.' },
    { id: 'software', name: 'Softwarehaus', icon: '💻', kosten: 9000000, wachstum: 1.15, ertrag: 11000,
      text: 'Skaliert, solange niemand kündigt.' },
    { id: 'logistik', name: 'Logistikzentrum', icon: '🚚', kosten: 55000000, wachstum: 1.155, ertrag: 55000,
      text: 'Vierzigtausend Pakete am Tag.' },
    { id: 'fabrik', name: 'Fabrik', icon: '🏭', kosten: 320000000, wachstum: 1.16, ertrag: 280000,
      text: 'Drei Schichten, keine Pause.' },
    { id: 'konzern', name: 'Konzern', icon: '🏛', kosten: 2000000000, wachstum: 1.165, ertrag: 1500000,
      text: 'Ab hier heißt Arbeit: unterschreiben.' },
  ];

  D.MEILENSTEIN = 25;          // alle 25 Stufen verdoppelt sich der Ertrag

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
  ];

  /* ---------------------------------------------------------- Luxus */

  D.LUXUS = [
    { id: 'uhr', name: 'Armbanduhr', icon: '⌚', preis: 55000, ansehen: 4,
      text: 'Fällt nur denen auf, die sie auch haben.' },
    { id: 'sportwagen', name: 'Sportwagen', icon: '🏎', preis: 380000, ansehen: 12,
      text: 'Zwei Sitze, kein Kofferraum, viel Lärm.' },
    { id: 'kunst', name: 'Kunstsammlung', icon: '🖼', preis: 3400000, ansehen: 34,
      text: 'Hängt im Flur und steigt im Wert.' },
    { id: 'jacht', name: 'Jacht', icon: '🛥', preis: 28000000, ansehen: 95,
      text: 'Der zweitschönste Tag ist der Kauf.' },
    { id: 'jet', name: 'Privatjet', icon: '✈', preis: 160000000, ansehen: 240,
      text: 'Nie wieder Sicherheitskontrolle.' },
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
  ];

  /* ---------------------------------------------------------- Ereignisse */

  /* dauer in Spieltagen. wirkung greift multiplikativ. */
  D.EREIGNISSE = [
    { id: 'boom', name: 'Konjunkturaufschwung', gut: true, dauer: 8, gewicht: 10,
      firmen: 1.35, text: 'Die Auftragsbücher sind voll. Alle Firmen liefern mehr ab.' },
    { id: 'flaute', name: 'Auftragsflaute', gut: false, dauer: 7, gewicht: 10,
      firmen: 0.72, text: 'Kaum Bestellungen. Die Firmen bringen deutlich weniger ein.' },
    { id: 'mietspiegel', name: 'Neuer Mietspiegel', gut: true, dauer: 12, gewicht: 8,
      mieten: 1.3, text: 'Die Mieten dürfen angehoben werden.' },
    { id: 'mietdeckel', name: 'Mietdeckel', gut: false, dauer: 12, gewicht: 7,
      mieten: 0.75, text: 'Die Stadt begrenzt die Mieten. Weniger Einnahmen aus Immobilien.' },
    { id: 'hausse', name: 'Börsenrausch', gut: true, dauer: 6, gewicht: 8,
      boerse: 1, text: 'An der Börse geht es steil nach oben. Kurse steigen kräftig.' },
    { id: 'crash', name: 'Börsencrash', gut: false, dauer: 5, gewicht: 6,
      boerse: -1, text: 'Panikverkäufe. Die Kurse brechen ein.' },
    { id: 'zins', name: 'Zinswende', gut: false, dauer: 14, gewicht: 6,
      mieten: 0.9, boerse: -0.4, text: 'Höhere Zinsen bremsen Immobilien und Börse.' },
    { id: 'foerderung', name: 'Fördermittel', gut: true, dauer: 10, gewicht: 6,
      firmen: 1.2, text: 'Ein Förderprogramm entlastet die Betriebe.' },
    { id: 'pruefung', name: 'Steuerprüfung', gut: false, dauer: 1, gewicht: 5,
      einmalig: 'pruefung', text: 'Das Finanzamt schaut genauer hin. Eine Nachzahlung wird fällig.' },
    { id: 'grossauftrag', name: 'Großauftrag', gut: true, dauer: 1, gewicht: 7,
      einmalig: 'bonus', text: 'Ein einzelner Kunde bestellt in großem Stil.' },
    { id: 'streik', name: 'Streik', gut: false, dauer: 4, gewicht: 5,
      firmen: 0.55, text: 'Die Belegschaft legt die Arbeit nieder.' },
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
