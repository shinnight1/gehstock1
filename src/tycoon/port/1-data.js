/* ------------------------------------------------------------------
   Hafen-Tycoon - Zahlen und Tabellen

   Alles, was sich am Spielgefuehl drehen laesst, steht hier an einer
   Stelle: Gebaeude, Fahrzeuge, Schiffsklassen, Vertraege, Forschung,
   Ereignisse und die drei Hafenkarten.
   ------------------------------------------------------------------ */

(function (SG) {
  var P = SG.tycoon.port = SG.tycoon.port || {};
  var D = P.data = {};

  /* Ein Feld entspricht 25 Metern Kailaenge. */
  D.TILE_M = 25;

  /* ---------------------------------------------------------- Karten */

  D.MAPS = [
    {
      id: 'nordhafen', name: 'Nordhafen', level: 1,
      w: 46, h: 30, waterRows: 9,
      baseDepth: 11,           // Wassertiefe am Kai in Metern
      baseSupply: 200,         // Strom aus dem oeffentlichen Netz
      start: 1400000,
      desc: 'Kleiner Flusshafen. Wenig Platz, aber die Reedereien sind geduldig.',
    },
    {
      id: 'weststrand', name: 'Weststrand', level: 6,
      w: 56, h: 34, waterRows: 11,
      baseDepth: 13, baseSupply: 300,
      start: 2400000,
      desc: 'Mehr Fläche und tieferes Wasser — dafür teurere Löhne.',
      wageMul: 1.18,
    },
    {
      id: 'tiefbucht', name: 'Tiefbucht', level: 12,
      w: 66, h: 38, waterRows: 13,
      baseDepth: 15, baseSupply: 400,
      start: 3600000,
      desc: 'Tiefwasserhafen für die ganz großen Pötte. Alles ist hier eine Nummer größer.',
      wageMul: 1.32, tariffMul: 1.22,
    },
  ];

  /* ---------------------------------------------------------- Gebaeude */

  /* kind:
       quay    Kaimauer (nur auf der Kailinie)
       crane   Containerbruecke (nur auf einer Kaimauer)
       yard    Lagerflaeche
       infra   sonstige Gebaeude
     w/h in Feldern, cost in Euro, upkeep pro Tag
  */
  D.BUILDINGS = [
    {
      id: 'quay', name: 'Kaimauer', kind: 'quay', w: 4, h: 1,
      cost: 240000, upkeep: 90, icon: '▬', color: '#6b7280',
      desc: '100 m Liegeplatz. Erst hier lassen sich Containerbrücken aufstellen.',
      needLevel: 1,
    },
    {
      id: 'crane1', name: 'Containerbrücke (Panamax)', kind: 'crane', w: 2, h: 1,
      cost: 520000, upkeep: 210, icon: '⌂', color: '#f0b429',
      moves: 22, reach: 13, staff: 'kran', power: 90,
      desc: '22 Bewegungen je Stunde, greift bis 13 Reihen weit.',
      needLevel: 1,
    },
    {
      id: 'crane2', name: 'Containerbrücke (Post-Panamax)', kind: 'crane', w: 2, h: 1,
      cost: 1150000, upkeep: 380, icon: '⌂', color: '#ffd166',
      moves: 30, reach: 18, staff: 'kran', power: 140,
      desc: '30 Bewegungen je Stunde, greift bis 18 Reihen weit.',
      needLevel: 4, needTech: 'ppx',
    },
    {
      id: 'crane3', name: 'Containerbrücke (ULCS)', kind: 'crane', w: 2, h: 1,
      cost: 2300000, upkeep: 620, icon: '⌂', color: '#ff9c3f',
      moves: 40, reach: 24, staff: 'kran', power: 210,
      desc: '40 Bewegungen je Stunde, erreicht auch die breitesten Schiffe.',
      needLevel: 8, needTech: 'ulcs',
    },
    {
      id: 'yard', name: 'Yard-Block', kind: 'yard', w: 5, h: 3,
      cost: 160000, upkeep: 70, icon: '▦', color: '#3f5170',
      slots: 560, stack: 3,
      desc: '560 Stellplätze, dreifach stapelbar. Das Rückgrat des Terminals.',
      needLevel: 1,
    },
    {
      id: 'reefer', name: 'Reefer-Block', kind: 'yard', w: 4, h: 3,
      cost: 330000, upkeep: 150, icon: '❄', color: '#34d3d3',
      slots: 200, stack: 3, reefer: true, power: 120,
      desc: 'Für Kühlcontainer. Braucht Strom, bringt aber den besten Tarif.',
      needLevel: 2,
    },
    {
      id: 'hazmat', name: 'Gefahrgut-Zone', kind: 'yard', w: 4, h: 3,
      cost: 290000, upkeep: 130, icon: '☣', color: '#ff9c3f',
      slots: 120, stack: 2, hazmat: true,
      desc: 'Getrennte Fläche mit Sicherheitsabstand für Gefahrgut.',
      needLevel: 3,
    },
    {
      id: 'empty', name: 'Leercontainer-Depot', kind: 'yard', w: 4, h: 3,
      cost: 120000, upkeep: 40, icon: '□', color: '#4b5570',
      slots: 800, stack: 5, empty: true,
      desc: 'Leercontainer lassen sich hoch stapeln und blockieren so nicht das Yard.',
      needLevel: 2,
    },
    {
      id: 'gate', name: 'Lkw-Gate', kind: 'infra', w: 3, h: 2,
      cost: 130000, upkeep: 110, icon: '⇥', color: '#8794b1',
      truckRate: 14, staff: 'zoll',
      desc: '14 Lkw-Abfertigungen je Stunde. Ohne Gate kommt nichts vom Terminal.',
      needLevel: 1,
    },
    {
      id: 'rail', name: 'Bahnterminal', kind: 'infra', w: 8, h: 3,
      cost: 720000, upkeep: 260, icon: '⇄', color: '#a97bff',
      railRate: 46, staff: 'yard', power: 70,
      desc: '46 Container je Stunde per Zug — billiger und schneller als Lkw.',
      needLevel: 5,
    },
    {
      id: 'shed', name: 'Lagerhalle', kind: 'infra', w: 5, h: 3,
      cost: 240000, upkeep: 90, icon: '▤', color: '#6b7280',
      storeBonus: 0.35,
      desc: 'Erlaubt längere Lagerung und bringt zusätzliche Lagergebühren.',
      needLevel: 3,
    },
    {
      id: 'workshop', name: 'Werkstatt', kind: 'infra', w: 3, h: 2,
      cost: 190000, upkeep: 120, icon: '🔧', color: '#8794b1',
      repair: 1, staff: 'technik',
      desc: 'Halbiert Ausfallzeiten und senkt die Wartungskosten.',
      needLevel: 2,
    },
    {
      id: 'office', name: 'Bürogebäude', kind: 'infra', w: 4, h: 3,
      cost: 260000, upkeep: 140, icon: '🏢', color: '#4aa3ff',
      planning: 1, staff: 'planer',
      desc: 'Bessere Liegeplatzplanung: Schiffe warten kürzer, Verträge werden besser.',
      needLevel: 2,
    },
    {
      id: 'canteen', name: 'Kantine', kind: 'infra', w: 3, h: 2,
      cost: 110000, upkeep: 80, icon: '🍽', color: '#3ddc84',
      morale: 12,
      desc: 'Hebt die Stimmung der Belegschaft deutlich.',
      needLevel: 2,
    },
    {
      id: 'power', name: 'Umspannwerk', kind: 'infra', w: 3, h: 2,
      cost: 190000, upkeep: 60, icon: '⚡', color: '#f0b429',
      supply: 600,
      desc: 'Liefert 600 kW. Ohne Strom stehen Brücken und Kühlcontainer still.',
      needLevel: 1,
    },
    {
      id: 'bunker', name: 'Bunkerstation', kind: 'infra', w: 3, h: 2,
      cost: 350000, upkeep: 150, icon: '⛽', color: '#ff5f6b',
      bunkerFee: 1,
      desc: 'Schiffe tanken bei dir und zahlen dafür — hübsches Nebengeschäft.',
      needLevel: 4,
    },
    {
      id: 'road', name: 'Fahrweg', kind: 'infra', w: 1, h: 1,
      cost: 6000, upkeep: 2, icon: '·', color: '#3a3f4c',
      road: true,
      desc: 'Verbindet die Flächen. Fahrzeuge werden auf gut erschlossenen Terminals schneller.',
      needLevel: 1,
    },
  ];

  D.byId = function (id) {
    for (var i = 0; i < D.BUILDINGS.length; i++) {
      if (D.BUILDINGS[i].id === id) return D.BUILDINGS[i];
    }
    return null;
  };

  /* ---------------------------------------------------------- Fahrzeuge */

  D.VEHICLES = [
    {
      id: 'truck', name: 'Terminaltraktor', cost: 95000, upkeep: 26,
      rate: 9, diesel: 12, staff: 'yard', icon: '🚚',
      desc: 'Fährt Container zwischen Kai und Yard. 9 Bewegungen je Stunde.',
      needLevel: 1,
    },
    {
      id: 'reach', name: 'Reachstacker', cost: 210000, upkeep: 48,
      rate: 13, diesel: 20, staff: 'yard', icon: '🏗',
      desc: 'Stapelt selbst und ist deutlich flotter als ein Traktor.',
      needLevel: 2,
    },
    {
      id: 'straddle', name: 'Van-Carrier', cost: 380000, upkeep: 78,
      rate: 20, diesel: 27, staff: 'yard', icon: '🦿',
      desc: 'Der Klassiker: nimmt den Container selbst auf und stapelt dreifach.',
      needLevel: 4,
    },
    {
      id: 'asc', name: 'Automatikkran (ASC)', cost: 820000, upkeep: 120,
      rate: 34, diesel: 0, power: 110, staff: null, icon: '🤖',
      desc: 'Fährt ohne Fahrer. Teuer, aber ohne Lohnkosten und rund um die Uhr.',
      needLevel: 7, needTech: 'asc',
    },
    {
      id: 'tug', name: 'Schlepper', cost: 290000, upkeep: 90,
      tug: true, diesel: 30, staff: 'yard', icon: '⛴',
      desc: 'Zieht große Schiffe an den Kai. Ohne Schlepper dauert das Anlegen dreimal so lang.',
      needLevel: 3,
    },
  ];

  D.vehicleById = function (id) {
    for (var i = 0; i < D.VEHICLES.length; i++) if (D.VEHICLES[i].id === id) return D.VEHICLES[i];
    return null;
  };

  /* ---------------------------------------------------------- Personal */

  D.STAFF = [
    { id: 'kran', name: 'Kranfahrer', wage: 260, icon: '👷', desc: 'Bedient die Containerbrücken.' },
    { id: 'yard', name: 'Yard-Fahrer', wage: 205, icon: '🧑‍🔧', desc: 'Fährt Traktoren, Reachstacker und Van-Carrier.' },
    { id: 'planer', name: 'Planer', wage: 290, icon: '🧑‍💼', desc: 'Verteilt Liegeplätze und Brücken sinnvoll.' },
    { id: 'zoll', name: 'Zoll & Gate', wage: 220, icon: '🧾', desc: 'Wickelt Lkw und Papiere ab.' },
    { id: 'technik', name: 'Mechaniker', wage: 275, icon: '🔧', desc: 'Repariert Brücken und Fahrzeuge.' },
  ];

  D.staffById = function (id) {
    for (var i = 0; i < D.STAFF.length; i++) if (D.STAFF[i].id === id) return D.STAFF[i];
    return null;
  };

  /* Schichtmodelle: mehr Schichten = mehr Betriebsstunden, mehr Lohn */
  D.SHIFTS = [
    { id: 1, name: 'Eine Schicht', hours: 8, wageMul: 1, desc: '8 Stunden Betrieb pro Tag.' },
    { id: 2, name: 'Zwei Schichten', hours: 16, wageMul: 2.05, desc: '16 Stunden. Der übliche Weg.' },
    { id: 3, name: 'Drei Schichten', hours: 24, wageMul: 3.3, desc: 'Rund um die Uhr. Zehrt an der Stimmung.' },
  ];

  /* ---------------------------------------------------------- Schiffe */

  D.SHIP_CLASSES = [
    {
      id: 'feeder', name: 'Feeder', teu: 300, len: 100, draft: 8,
      color: '#3ddc84', minLevel: 1,
      desc: 'Kleiner Zubringer. Passt an fast jeden Kai.',
    },
    {
      id: 'panamax', name: 'Panamax', teu: 4500, len: 290, draft: 12,
      color: '#4aa3ff', minLevel: 2,
      desc: 'Das lange Zeit größte Maß, das durch den alten Panamakanal passte.',
    },
    {
      id: 'postpanamax', name: 'Post-Panamax', teu: 8000, len: 340, draft: 14,
      color: '#a97bff', minLevel: 5,
      desc: 'Breiter als der alte Kanal — braucht Brücken mit mehr Ausladung.',
    },
    {
      id: 'neopanamax', name: 'Neo-Panamax', teu: 14000, len: 366, draft: 15.2,
      color: '#ff9c3f', minLevel: 8,
      desc: 'Das Maß des neuen Panamakanals.',
    },
    {
      id: 'ulcs', name: 'ULCS', teu: 24000, len: 400, draft: 16.5,
      color: '#ff5f6b', minLevel: 11,
      desc: 'Ultra Large Container Ship. Wer die abfertigt, spielt ganz oben mit.',
    },
  ];

  D.shipClass = function (id) {
    for (var i = 0; i < D.SHIP_CLASSES.length; i++) {
      if (D.SHIP_CLASSES[i].id === id) return D.SHIP_CLASSES[i];
    }
    return D.SHIP_CLASSES[0];
  };

  /* Ladungsarten mit Tarifaufschlag */
  D.CARGO = [
    { id: 'import', name: 'Import', share: 0.34, tariff: 1.0, icon: '⬇' },
    { id: 'export', name: 'Export', share: 0.30, tariff: 1.0, icon: '⬆' },
    { id: 'transship', name: 'Transshipment', share: 0.18, tariff: 0.78, icon: '⇄' },
    { id: 'reefer', name: 'Reefer', share: 0.08, tariff: 1.85, icon: '❄' },
    { id: 'hazmat', name: 'Gefahrgut', share: 0.05, tariff: 1.65, icon: '☣' },
    { id: 'oog', name: 'Übergroß', share: 0.03, tariff: 2.1, icon: '⤢' },
    { id: 'emptybox', name: 'Leercontainer', share: 0.02, tariff: 0.45, icon: '□' },
  ];

  /* ---------------------------------------------------------- Reedereien */

  D.LINES = [
    { id: 'nordstern', name: 'Nordstern Lines', color: '#4aa3ff', minLevel: 1 },
    { id: 'baltic', name: 'Baltic Container', color: '#3ddc84', minLevel: 1 },
    { id: 'hansa', name: 'Hansa Maritim', color: '#f0b429', minLevel: 3 },
    { id: 'orient', name: 'Orient Express Sea', color: '#a97bff', minLevel: 5 },
    { id: 'pacific', name: 'Pacific Crown', color: '#ff9c3f', minLevel: 8 },
    { id: 'global', name: 'Global Ocean Alliance', color: '#ff5f6b', minLevel: 11 },
  ];

  /* ---------------------------------------------------------- Forschung */

  D.TECH = [
    {
      id: 'ppx', name: 'Post-Panamax-Technik', cost: 480000, days: 12, icon: '⌂',
      desc: 'Schaltet die zweite Brückengeneration frei.', needs: [],
    },
    {
      id: 'tos', name: 'Terminal-Software', cost: 380000, days: 10, icon: '🖥',
      desc: 'Weniger Umstapeln im Yard: −30 % Rückstapelaufwand.', needs: [],
    },
    {
      id: 'dual', name: 'Dual-Trolley-Brücken', cost: 620000, days: 14, icon: '⇅',
      desc: 'Alle Brücken schaffen 20 % mehr Bewegungen.', needs: ['ppx'],
    },
    {
      id: 'edrive', name: 'Elektrische Antriebe', cost: 520000, days: 12, icon: '🔋',
      desc: 'Halbiert den Dieselverbrauch der Fahrzeuge.', needs: ['tos'],
    },
    {
      id: 'asc', name: 'Yard-Automatisierung', cost: 900000, days: 18, icon: '🤖',
      desc: 'Schaltet den Automatikkran frei.', needs: ['tos'],
    },
    {
      id: 'ulcs', name: 'ULCS-Ausbau', cost: 1400000, days: 22, icon: '🚢',
      desc: 'Schaltet die größte Brückengeneration frei.', needs: ['dual'],
    },
    {
      id: 'customs', name: 'Digitaler Zoll', cost: 340000, days: 9, icon: '🧾',
      desc: 'Lkw-Abfertigung 40 % schneller.', needs: [],
    },
    {
      id: 'maint', name: 'Vorausschauende Wartung', cost: 460000, days: 12, icon: '🔧',
      desc: 'Halbiert die Ausfallwahrscheinlichkeit.', needs: ['tos'],
    },
    {
      id: 'stack5', name: 'Hochstapelung', cost: 700000, days: 15, icon: '▦',
      desc: 'Alle Yard-Blöcke fassen zwei Lagen mehr.', needs: ['asc'],
    },
  ];

  D.techById = function (id) {
    for (var i = 0; i < D.TECH.length; i++) if (D.TECH[i].id === id) return D.TECH[i];
    return null;
  };

  /* ---------------------------------------------------------- Ereignisse */

  D.EVENTS = [
    {
      id: 'sturm', name: 'Sturmwarnung', icon: '🌪', kind: 'bad', weight: 10,
      dur: [6, 16], desc: 'Der Betrieb am Kai steht still, bis der Wind nachlässt.',
      effect: { craneStop: true },
    },
    {
      id: 'nebel', name: 'Dichter Nebel', icon: '🌫', kind: 'warn', weight: 12,
      dur: [4, 12], desc: 'Schiffe kommen langsamer herein, die Brücken arbeiten vorsichtiger.',
      effect: { craneMul: 0.6, arrivalMul: 0.5 },
    },
    {
      id: 'kranausfall', name: 'Brücke ausgefallen', icon: '⚠', kind: 'bad', weight: 12,
      dur: [8, 30], desc: 'Eine Containerbrücke ist defekt. Eine Werkstatt verkürzt die Reparatur.',
      effect: { craneDown: 1 },
    },
    {
      id: 'zoll', name: 'Zollkontrolle', icon: '🧾', kind: 'warn', weight: 10,
      dur: [10, 24], desc: 'Der Zoll schaut genauer hin — das Gate braucht länger.',
      effect: { gateMul: 0.45 },
    },
    {
      id: 'boom', name: 'Frachtboom', icon: '📈', kind: 'good', weight: 9,
      dur: [24, 72], desc: 'Die Raten steigen: mehr Geld je Container.',
      effect: { tariffMul: 1.35 },
    },
    {
      id: 'flaute', name: 'Ratenflaute', icon: '📉', kind: 'bad', weight: 9,
      dur: [24, 72], desc: 'Die Frachtraten fallen. Jeder Container bringt weniger.',
      effect: { tariffMul: 0.72 },
    },
    {
      id: 'konkurrenz', name: 'Konkurrenzhafen wirbt', icon: '🏴', kind: 'warn', weight: 8,
      dur: [24, 60], desc: 'Der Nachbarhafen macht Sonderpreise — weniger Schiffe kommen.',
      effect: { arrivalMul: 0.6 },
    },
    {
      id: 'inspektion', name: 'Sicherheitsinspektion', icon: '🔍', kind: 'warn', weight: 7,
      dur: [8, 16], desc: 'Bestandene Inspektion hebt den Ruf, sonst kostet es.',
      effect: { inspection: true },
    },
    {
      id: 'streik', name: 'Warnstreik', icon: '✊', kind: 'bad', weight: 6,
      dur: [8, 24], desc: 'Bei schlechter Stimmung wird gestreikt. Alles steht.',
      effect: { craneStop: true, gateMul: 0.2 }, needsLowMorale: true,
    },
    {
      id: 'verlust', name: 'Container über Bord', icon: '🌊', kind: 'bad', weight: 5,
      dur: [1, 2], desc: 'Ein Schiff hat Ladung verloren — Ersatz kostet.',
      effect: { instantCost: [40000, 160000] },
    },
    {
      id: 'grossauftrag', name: 'Sonderverkehr', icon: '🚢', kind: 'good', weight: 8,
      dur: [12, 36], desc: 'Eine Reederei leitet zusätzliche Schiffe zu dir um.',
      effect: { arrivalMul: 1.8 },
    },
  ];

  /* ---------------------------------------------------------- Fortschritt */

  /* TEU, die fuer das jeweilige Terminal-Level noetig sind */
  D.LEVEL_TEU = [0, 0, 3000, 9000, 20000, 40000, 70000, 115000, 175000,
    260000, 380000, 540000, 760000, 1050000, 1450000];

  D.levelFor = function (teu) {
    var lv = 1;
    for (var i = 2; i < D.LEVEL_TEU.length; i++) {
      if (teu >= D.LEVEL_TEU[i]) lv = i;
    }
    return lv;
  };

  D.nextLevelTeu = function (level) {
    return D.LEVEL_TEU[Math.min(level + 1, D.LEVEL_TEU.length - 1)];
  };

  /* ---------------------------------------------------------- Wirtschaft */

  D.ECON = {
    baseTariff: 105,        // Euro je TEU im Standardvertrag
    storageFee: 2.4,        // Euro je TEU und Tag ab dem dritten Tag
    freeDays: 3,
    demurrage: 1500,        // Euro je Stunde Liegezeitueberschreitung
    dispatchBonus: 600,    // Euro je Stunde frueher fertig
    powerPrice: 0.31,       // Euro je kWh
    dieselPrice: 1.62,      // Euro je Liter
    loanRate: 0.055,        // Zins pro Jahr
    loanMax: 4000000,
    taxRate: 0.19,
    dredgeCost: 42000,      // Euro je Feld und Meter
    maxDepth: 18,
    bunkerFee: 9200,        // Euro je Schiff mit Bunkerstation
    truckRevenue: 42,       // Euro je Container ueber die Strasse
    railRevenue: 31,
    startCrew: { kran: 2, yard: 3, planer: 1, zoll: 2, technik: 1 },
  };

  /* ---------------------------------------------------------- Kampagne */

  D.GOALS = [
    { id: 'g1', text: 'Baue eine Kaimauer und eine Containerbrücke.', check: function (s) { return s.counts.quay >= 1 && s.counts.crane >= 1; }, reward: 60000 },
    { id: 'g2', text: 'Fertige das erste Schiff komplett ab.', check: function (s) { return s.stats.shipsDone >= 1; }, reward: 80000 },
    { id: 'g3', text: 'Schlage 3.000 TEU um.', check: function (s) { return s.stats.teu >= 3000; }, reward: 120000 },
    { id: 'g4', text: 'Nimm zwei Verträge gleichzeitig an.', check: function (s) { return s.contracts.length >= 2; }, reward: 100000 },
    { id: 'g5', text: 'Erreiche Terminal-Level 4.', check: function (s) { return s.level >= 4; }, reward: 200000 },
    { id: 'g6', text: 'Schließe eine Forschung ab.', check: function (s) { return s.tech.length >= 1; }, reward: 150000 },
    { id: 'g7', text: 'Bagger das Fahrwasser auf 14 m.', check: function (s) { return s.depth >= 14; }, reward: 220000 },
    { id: 'g8', text: 'Fertige ein Post-Panamax-Schiff ab.', check: function (s) { return (s.stats.byClass.postpanamax || 0) >= 1; }, reward: 260000 },
    { id: 'g9', text: 'Halte 500.000 € Bargeld und keine Schulden.', check: function (s) { return s.cash >= 500000 && s.loan <= 0; }, reward: 300000 },
    { id: 'g10', text: 'Erreiche Terminal-Level 8.', check: function (s) { return s.level >= 8; }, reward: 500000 },
    { id: 'g11', text: 'Schlage 250.000 TEU um.', check: function (s) { return s.stats.teu >= 250000; }, reward: 700000 },
    { id: 'g12', text: 'Fertige ein ULCS ab.', check: function (s) { return (s.stats.byClass.ulcs || 0) >= 1; }, reward: 1200000 },
  ];
})(SG);
