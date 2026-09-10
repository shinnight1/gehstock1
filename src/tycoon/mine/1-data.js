/* ------------------------------------------------------------------
   Mining-Tycoon - Tabellen

   Der Grundgedanke: je tiefer, desto wertvoller - und desto
   unangenehmer. Ab einer gewissen Tiefe laeuft Wasser ein, es wird
   heiss, und ohne Stuetzen kommt der Berg herunter. Jede Schicht
   bringt also mehr Geld und eine neue Anforderung mit.

   Zeit: eine Schicht (8 Stunden) dauert bei 1x zwoelf Sekunden.
   Loehne und Strom werden am Ende jeder Woche abgerechnet.
   ------------------------------------------------------------------ */

(function (SG) {
  var D = (SG.tycoon.mine = SG.tycoon.mine || {}).data = {};

  D.SEK_PRO_SCHICHT = 12;
  D.SCHICHTEN_PRO_TAG = 3;
  D.TAGE_PRO_WOCHE = 7;

  D.SOHLE_ABSTAND = 40;        // Meter zwischen zwei Sohlen

  /* ---------------------------------------------------------- Rohstoffe */

  /* wert = Euro je Tonne bei Normalpreis. schwankung = Tagesausschlag. */
  D.ROHSTOFFE = [
    { id: 'stein', name: 'Bauschutt', icon: '🪨', farbe: '#6c7796', wert: 36, schwankung: 0.04 },
    { id: 'kies', name: 'Kies', icon: '⚪', farbe: '#8794b1', wert: 64, schwankung: 0.05 },
    { id: 'kalk', name: 'Kalkstein', icon: '🧱', farbe: '#c8cdd8', wert: 112, schwankung: 0.05 },
    { id: 'kohle', name: 'Kohle', icon: '⬛', farbe: '#2b3040', wert: 380, schwankung: 0.09 },
    { id: 'eisen', name: 'Eisenerz', icon: '🟤', farbe: '#8a5a3b', wert: 720, schwankung: 0.08 },
    { id: 'kupfer', name: 'Kupfer', icon: '🟠', farbe: '#c87137', wert: 1700, schwankung: 0.11 },
    { id: 'zink', name: 'Zink', icon: '🔘', farbe: '#9aa7b8', wert: 2400, schwankung: 0.1 },
    { id: 'silber', name: 'Silber', icon: '⚪', farbe: '#d8dee9', wert: 9600, schwankung: 0.14 },
    { id: 'gold', name: 'Gold', icon: '🟡', farbe: '#f0b429', wert: 39000, schwankung: 0.16 },
    { id: 'platin', name: 'Platin', icon: '⬜', farbe: '#e5e9f0', wert: 96000, schwankung: 0.18 },
    { id: 'diamant', name: 'Diamant', icon: '💎', farbe: '#7fd8e8', wert: 300000, schwankung: 0.22 },
    { id: 'uran', name: 'Uranerz', icon: '☢', farbe: '#7ee081', wert: 840000, schwankung: 0.26 },
  ];

  D.rohstoff = function (id) {
    for (var i = 0; i < D.ROHSTOFFE.length; i++) {
      if (D.ROHSTOFFE[i].id === id) return D.ROHSTOFFE[i];
    }
    return D.ROHSTOFFE[0];
  };

  /* ---------------------------------------------------------- Schichten */

  /* bis      Tiefe in Metern, bis zu der die Schicht reicht
     haerte   Faktor auf die Foerderleistung (haerter = langsamer)
     anteile  Rohstoff -> Anteil an der Foerderung
     verlangt Anforderungen, die ab hier gelten */
  D.SCHICHTEN = [
    {
      bis: 40, name: 'Mutterboden', icon: '🟫', farbe: '#4a3a28', haerte: 1.0,
      anteile: { stein: 0.7, kies: 0.3 },
      text: 'Sand, Lehm, ein paar Wurzeln. Man muss ja irgendwo anfangen.',
    },
    {
      bis: 100, name: 'Kiesbank', icon: '⚪', farbe: '#5a5344', haerte: 1.1,
      anteile: { kies: 0.6, stein: 0.3, kalk: 0.1 },
      text: 'Der Bagger kommt hier noch gut durch.',
    },
    {
      bis: 180, name: 'Kalkstein', icon: '🧱', farbe: '#6d6a5c', haerte: 1.35,
      anteile: { kalk: 0.6, kies: 0.2, kohle: 0.2 },
      text: 'Fester Fels. Ohne Presslufthammer wird das nichts.',
    },
    {
      bis: 300, name: 'Kohleflöz', icon: '⬛', farbe: '#3a3630', haerte: 1.6,
      anteile: { kohle: 0.65, kalk: 0.2, eisen: 0.15 },
      verlangt: { wasser: 1 },
      text: 'Das erste richtige Geld — und das erste Wasser im Schacht.',
    },
    {
      bis: 450, name: 'Erzgang', icon: '🟤', farbe: '#4a3a34', haerte: 1.95,
      anteile: { eisen: 0.5, kupfer: 0.25, kohle: 0.15, zink: 0.1 },
      verlangt: { wasser: 2, stuetzen: 1 },
      text: 'Erz in Bändern. Der Berg drückt, es braucht Stützen.',
    },
    {
      bis: 620, name: 'Sulfidzone', icon: '🟠', farbe: '#4a3828', haerte: 2.4,
      anteile: { kupfer: 0.4, zink: 0.3, silber: 0.2, eisen: 0.1 },
      verlangt: { wasser: 2, stuetzen: 2, luft: 1 },
      text: 'Schlechte Luft. Ohne Bewetterung geht hier niemand rein.',
    },
    {
      bis: 820, name: 'Edelmetallader', icon: '🟡', farbe: '#4a4028', haerte: 2.9,
      anteile: { silber: 0.4, gold: 0.3, kupfer: 0.2, zink: 0.1 },
      verlangt: { wasser: 3, stuetzen: 2, luft: 2 },
      text: 'Gold. Nicht viel, aber genug, um alles andere zu bezahlen.',
    },
    {
      bis: 1050, name: 'Tiefengestein', icon: '⬜', farbe: '#3c3c48', haerte: 3.5,
      anteile: { gold: 0.4, platin: 0.3, silber: 0.2, zink: 0.1 },
      verlangt: { wasser: 3, stuetzen: 3, luft: 2, kuehlung: 1 },
      text: 'Achtunddreißig Grad am Stoß. Ohne Kühlung hält das keiner aus.',
    },
    {
      bis: 1350, name: 'Kimberlitschlot', icon: '💎', farbe: '#2e3a48', haerte: 4.2,
      anteile: { diamant: 0.35, platin: 0.3, gold: 0.25, silber: 0.1 },
      verlangt: { wasser: 4, stuetzen: 3, luft: 3, kuehlung: 2 },
      text: 'Ein alter Vulkanschlot. Hier liegen die Diamanten.',
    },
    {
      bis: 9999, name: 'Grundgebirge', icon: '☢', farbe: '#26303a', haerte: 5.2,
      anteile: { uran: 0.3, diamant: 0.3, platin: 0.25, gold: 0.15 },
      verlangt: { wasser: 4, stuetzen: 4, luft: 3, kuehlung: 3 },
      text: 'Tiefer war noch niemand. Der Geigerzähler klickt.',
    },
  ];

  D.schichtBei = function (tiefe) {
    for (var i = 0; i < D.SCHICHTEN.length; i++) {
      if (tiefe <= D.SCHICHTEN[i].bis) return D.SCHICHTEN[i];
    }
    return D.SCHICHTEN[D.SCHICHTEN.length - 1];
  };

  D.schichtIndex = function (tiefe) {
    for (var i = 0; i < D.SCHICHTEN.length; i++) {
      if (tiefe <= D.SCHICHTEN[i].bis) return i;
    }
    return D.SCHICHTEN.length - 1;
  };

  /* ---------------------------------------------------------- Geraete */

  /* leistung = Tonnen je Schicht bei Haerte 1
     strom    = Kilowatt, geht in die Wochenrechnung
     Jede weitere Maschine derselben Art wird teurer. */
  D.GERAETE = [
    {
      id: 'hacke', name: 'Spitzhacke', icon: '⛏', kosten: 120, steigerung: 1.11,
      leistung: 6, strom: 0, mann: 1,
      text: 'Ein Mann, ein Werkzeug. Fängt jede Zeche so an.',
    },
    {
      id: 'hammer', name: 'Presslufthammer', icon: '🔨', kosten: 900, steigerung: 1.12,
      leistung: 30, strom: 4, mann: 1,
      text: 'Laut, staubig, dreimal so schnell.',
    },
    {
      id: 'bohrer', name: 'Bohrwagen', icon: '🛠', kosten: 24000, steigerung: 1.13,
      leistung: 160, strom: 22, mann: 1,
      text: 'Bohrt die Sprenglöcher in Reihe.',
    },
    {
      id: 'lader', name: 'Fahrlader', icon: '🚜', kosten: 190000, steigerung: 1.135,
      leistung: 760, strom: 70, mann: 1,
      text: 'Schaufelt weg, was die Sprengung gelöst hat.',
    },
    {
      id: 'schraem', name: 'Schrämmaschine', icon: '⚙', kosten: 1500000, steigerung: 1.14,
      leistung: 3800, strom: 260, mann: 2,
      text: 'Frisst sich mit Meißelwalzen durch den Stoß.',
    },
    {
      id: 'hobel', name: 'Kohlenhobel', icon: '🪚', kosten: 11000000, steigerung: 1.145,
      leistung: 18000, strom: 900, mann: 2,
      text: 'Zieht das Flöz in einem Zug ab.',
    },
    {
      id: 'tbm', name: 'Tunnelbohrmaschine', icon: '🌀', kosten: 90000000, steigerung: 1.15,
      leistung: 92000, strom: 3400, mann: 4,
      text: 'Ein Bohrkopf von zehn Metern. Läuft Tag und Nacht.',
    },
    {
      id: 'auto', name: 'Autonome Flotte', icon: '🤖', kosten: 800000000, steigerung: 1.155,
      leistung: 500000, strom: 14000, mann: 2,
      text: 'Fährt ohne Fahrer, gräbt ohne Pause.',
    },
  ];

  D.geraet = function (id) {
    for (var i = 0; i < D.GERAETE.length; i++) if (D.GERAETE[i].id === id) return D.GERAETE[i];
    return null;
  };

  /* ---------------------------------------------------------- Foerderung */

  /* Was oben ankommt, begrenzt alles. Ein Berg voll Gold nuetzt nichts,
     wenn er unten liegen bleibt. */
  D.FOERDERUNG = [
    { name: 'Schubkarre', icon: '🛒', menge: 40, kosten: 0, strom: 0 },
    { name: 'Grubenbahn', icon: '🚃', menge: 150, kosten: 9000, strom: 6 },
    { name: 'Förderband', icon: '➿', menge: 800, kosten: 120000, strom: 40 },
    { name: 'Schrägaufzug', icon: '🛗', menge: 4000, kosten: 1400000, strom: 180 },
    { name: 'Skipförderung', icon: '🏗', menge: 22000, kosten: 16000000, strom: 700 },
    { name: 'Doppelskip', icon: '⛓', menge: 120000, kosten: 190000000, strom: 2600 },
    { name: 'Vollautomatik', icon: '🛰', menge: 650000, kosten: 2200000000, strom: 9000 },
  ];

  /* ---------------------------------------------------------- Technik */

  /* Diese Anlagen erfuellen die Anforderungen der Schichten.
     stufen = wie oft ausbaubar, jede Stufe deckt eine Anforderungsstufe. */
  D.TECHNIK = [
    {
      id: 'wasser', name: 'Wasserhaltung', icon: '💧', kosten: 45000, steigerung: 4.2,
      stufen: 4, strom: 30,
      text: 'Pumpen halten den Schacht trocken. Ohne sie säuft er ab.',
    },
    {
      id: 'stuetzen', name: 'Ausbau und Stützen', icon: '🧯', kosten: 260000, steigerung: 4.6,
      stufen: 4, strom: 5,
      text: 'Stahlbögen und Anker gegen den Gebirgsdruck.',
    },
    {
      id: 'luft', name: 'Bewetterung', icon: '🌬', kosten: 900000, steigerung: 4.8,
      stufen: 3, strom: 120,
      text: 'Frischluft nach unten, Grubengas nach oben.',
    },
    {
      id: 'kuehlung', name: 'Grubenkühlung', icon: '❄', kosten: 8000000, steigerung: 5.0,
      stufen: 3, strom: 480,
      text: 'Unter Tage wird es pro hundert Meter drei Grad wärmer.',
    },
  ];

  D.technik = function (id) {
    for (var i = 0; i < D.TECHNIK.length; i++) if (D.TECHNIK[i].id === id) return D.TECHNIK[i];
    return null;
  };

  /* ---------------------------------------------------------- Forschung */

  D.FORSCHUNG = [
    {
      id: 'sprengen', name: 'Sprengtechnik', icon: '🧨', kosten: 60000,
      braucht: null, wirkt: 'leistung', wert: 0.25,
      text: 'Gelockertes Gestein fördert sich ein Viertel schneller.',
    },
    {
      id: 'sortier', name: 'Sortieranlage', icon: '🔀', kosten: 340000,
      braucht: 'sprengen', wirkt: 'ausbeute', wert: 0.2,
      text: 'Trennt Taubes vom Wertvollen — mehr Erz je Tonne.',
    },
    {
      id: 'aufbereitung', name: 'Aufbereitung', icon: '🏭', kosten: 2400000,
      braucht: 'sortier', wirkt: 'preis', wert: 0.18,
      text: 'Konzentrat statt Roherz. Bringt am Markt deutlich mehr.',
    },
    {
      id: 'geologie', name: 'Geologische Erkundung', icon: '🧭', kosten: 900000,
      braucht: null, wirkt: 'seltene', wert: 0.3,
      text: 'Findet die reichen Nester statt sie zu verfehlen.',
    },
    {
      id: 'strom', name: 'Eigenes Kraftwerk', icon: '⚡', kosten: 6500000,
      braucht: null, wirkt: 'strompreis', wert: -0.45,
      text: 'Senkt die Stromrechnung dauerhaft um fast die Hälfte.',
    },
    {
      id: 'sicherheit', name: 'Sicherheitsprogramm', icon: '🦺', kosten: 3200000,
      braucht: null, wirkt: 'unfall', wert: -0.6,
      text: 'Weniger Unfälle, zufriedenere Belegschaft.',
    },
    {
      id: 'automatik', name: 'Fernsteuerung', icon: '📟', kosten: 26000000,
      braucht: 'aufbereitung', wirkt: 'mann', wert: -0.35,
      text: 'Eine Maschine braucht ein Drittel weniger Leute.',
    },
    {
      id: 'schnellteufen', name: 'Schnellteufen', icon: '⏬', kosten: 14000000,
      braucht: null, wirkt: 'teufen', wert: -0.4,
      text: 'Neue Sohlen sind deutlich schneller aufgefahren.',
    },
    {
      id: 'recycling', name: 'Bergeversatz', icon: '♻', kosten: 42000000,
      braucht: 'aufbereitung', wirkt: 'ausbeute', wert: 0.25,
      text: 'Taubes Gestein wandert zurück in den Berg statt auf die Halde.',
    },
    {
      id: 'fusion', name: 'Tiefbohrprogramm', icon: '🛢', kosten: 320000000,
      braucht: 'schnellteufen', wirkt: 'leistung', wert: 0.4,
      text: 'Das ganze Bergwerk arbeitet spürbar schneller.',
    },
  ];

  D.forschung = function (id) {
    for (var i = 0; i < D.FORSCHUNG.length; i++) {
      if (D.FORSCHUNG[i].id === id) return D.FORSCHUNG[i];
    }
    return null;
  };

  /* ---------------------------------------------------------- Leute */

  D.PERSONAL = [
    { id: 'bergleute', name: 'Bergleute', icon: '👷', lohn: 2400, text: 'Ohne sie steht jede Maschine still.' },
    { id: 'technik', name: 'Technische Aufsicht', icon: '🔧', lohn: 3400, text: 'Hält die Anlagen am Laufen.' },
    { id: 'geologen', name: 'Geologen', icon: '🧭', lohn: 4000, text: 'Finden die Ader, bevor man daran vorbeigräbt.' },
  ];

  D.personal = function (id) {
    for (var i = 0; i < D.PERSONAL.length; i++) if (D.PERSONAL[i].id === id) return D.PERSONAL[i];
    return null;
  };

  /* ---------------------------------------------------------- Raenge */

  D.RAENGE = [
    { name: 'Schürfstelle', icon: '⛏', tiefe: 0, foerderung: 0 },
    { name: 'Kleine Zeche', icon: '🪨', tiefe: 80, foerderung: 500 },
    { name: 'Bergwerk', icon: '🏔', tiefe: 200, foerderung: 12000 },
    { name: 'Erzbergbau', icon: '🟤', tiefe: 380, foerderung: 160000 },
    { name: 'Großbergwerk', icon: '🏗', tiefe: 600, foerderung: 2400000 },
    { name: 'Tiefbaubetrieb', icon: '⬇', tiefe: 850, foerderung: 40000000 },
    { name: 'Bergbaukonzern', icon: '🏛', tiefe: 1150, foerderung: 700000000 },
    { name: 'Grundgebirge', icon: '☢', tiefe: 1500, foerderung: 9000000000 },
  ];

  D.rangVon = function (tiefe, gesamtWert) {
    var r = 0;
    for (var i = 0; i < D.RAENGE.length; i++) {
      if (tiefe >= D.RAENGE[i].tiefe && gesamtWert >= D.RAENGE[i].foerderung) r = i;
    }
    return r;
  };

  /* ---------------------------------------------------------- Ereignisse */

  D.EREIGNISSE = [
    {
      id: 'ader', icon: '✨', name: 'Reiche Ader',
      text: 'Die Bohrung trifft ein reiches Nest. Zwei Tage doppelte Ausbeute.',
      wirkung: { ausbeute: 1.0, tage: 2 },
    },
    {
      id: 'einbruch', icon: '🪨', name: 'Firstfall',
      text: 'Ein Stück Decke ist heruntergekommen. Die Sohle steht still.',
      wirkung: { leistung: -0.45, tage: 2, kosten: 0.04 }, bedingung: 'wenigStuetzen',
    },
    {
      id: 'wassereinbruch', icon: '🌊', name: 'Wassereinbruch',
      text: 'Wasser läuft in die Tiefste. Die Pumpen kommen nicht nach.',
      wirkung: { leistung: -0.6, tage: 3, kosten: 0.06 }, bedingung: 'wenigWasser',
    },
    {
      id: 'gas', icon: '💨', name: 'Grubengas',
      text: 'Methan am Stoß. Die Schicht wird abgebrochen.',
      wirkung: { leistung: -0.5, tage: 2 }, bedingung: 'wenigLuft',
    },
    {
      id: 'preis', icon: '📈', name: 'Rohstoffhausse',
      text: 'Die Börse dreht durch. Alle Preise steigen für eine Woche.',
      wirkung: { preis: 0.4, tage: 7 },
    },
    {
      id: 'preisfall', icon: '📉', name: 'Preisverfall',
      text: 'Überangebot auf dem Weltmarkt. Die Preise geben nach.',
      wirkung: { preis: -0.3, tage: 6 },
    },
    {
      id: 'streik', icon: '✊', name: 'Streik',
      text: 'Die Belegschaft legt die Arbeit nieder.',
      wirkung: { leistung: -0.75, tage: 2 }, bedingung: 'unzufrieden',
    },
    {
      id: 'inspektion', icon: '📋', name: 'Bergaufsicht',
      text: 'Die Behörde prüft den Ausbau.',
      wirkung: { pruefung: true },
    },
    {
      id: 'fund', icon: '💎', name: 'Einzelfund',
      text: 'Ein außergewöhnlicher Stein im Haufwerk. Der Händler zahlt sofort.',
      wirkung: { geld: true },
    },
    {
      id: 'panne', icon: '⚙', name: 'Getriebeschaden',
      text: 'Die Förderung steht, bis das Ersatzteil da ist.',
      wirkung: { foerder: -0.5, tage: 2, kosten: 0.03 }, bedingung: 'wenigTechnik',
    },
  ];

  /* ---------------------------------------------------------- Preise */

  D.STROMPREIS = 240;          // Euro je Kilowatt und Woche
  D.STEUERSATZ = 0.26;
  D.TEUFEN_KOSTEN = 400;      // Euro je Meter, steigt mit der Tiefe
  D.TEUFEN_STEIGERUNG = 1.011;
  D.TEUFEN_TEMPO = 4;          // Meter je Schicht bei voller Mannschaft

  D.formatTiefe = function (m) {
    return Math.round(m) + ' m';
  };
})(SG);
