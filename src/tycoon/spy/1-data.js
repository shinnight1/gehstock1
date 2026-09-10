/* ------------------------------------------------------------------
   Geheimagenten-Tycoon - Zahlen und Tabellen

   Raeume, Agenten, Gadgets, Forschung, Missionen, Regionen,
   Auftraggeber und Gegenorganisationen.
   ------------------------------------------------------------------ */

(function (SG) {
  var A = SG.tycoon.spy = SG.tycoon.spy || {};
  var D = A.data = {};

  /* ---------------------------------------------------------- Faehigkeiten */

  D.SKILLS = [
    { id: 'kampf', name: 'Nahkampf', icon: '🥊', short: 'KA' },
    { id: 'schuss', name: 'Schießen', icon: '🎯', short: 'SC' },
    { id: 'tarnung', name: 'Tarnung', icon: '🕶', short: 'TA' },
    { id: 'technik', name: 'Technik', icon: '🔩', short: 'TE' },
    { id: 'hacking', name: 'Hacking', icon: '💻', short: 'HA' },
    { id: 'charisma', name: 'Charisma', icon: '🎭', short: 'CH' },
  ];

  D.skillName = function (id) {
    for (var i = 0; i < D.SKILLS.length; i++) if (D.SKILLS[i].id === id) return D.SKILLS[i].name;
    return id;
  };
  D.skill = function (id) {
    for (var i = 0; i < D.SKILLS.length; i++) if (D.SKILLS[i].id === id) return D.SKILLS[i];
    return D.SKILLS[0];
  };

  /* ---------------------------------------------------------- Eigenschaften */

  D.TRAITS = [
    { id: 'draufgaenger', name: 'Draufgänger', good: true, icon: '🔥',
      desc: '+15 % im Nahkampf, aber +30 % Stress bei jeder Mission.' },
    { id: 'perfektionist', name: 'Perfektionist', good: true, icon: '📐',
      desc: '+10 % auf alles, braucht aber einen Tag mehr Erholung.' },
    { id: 'eiskalt', name: 'Eiskalt', good: true, icon: '❄',
      desc: 'Wird bei Stress kaum schlechter.' },
    { id: 'schattenlaeufer', name: 'Schattenläufer', good: true, icon: '🌑',
      desc: '+20 % Tarnung, hinterlässt weniger Spuren.' },
    { id: 'techniknarr', name: 'Techniknarr', good: true, icon: '🧰',
      desc: '+20 % Technik und Hacking, versteht jedes Gadget.' },
    { id: 'gluecksritter', name: 'Glücksritter', good: true, icon: '🍀',
      desc: 'Einmal je Mission wird ein Fehlschlag zum Erfolg.' },
    { id: 'spieler', name: 'Spieler', good: false, icon: '🎲',
      desc: 'Kostet gelegentlich Geld aus der Kasse.' },
    { id: 'grossmaul', name: 'Großmaul', good: false, icon: '📢',
      desc: 'Erhöht die Hitze in der Region deutlich schneller.' },
    { id: 'nervoes', name: 'Nervös', good: false, icon: '😰',
      desc: 'Baut Stress doppelt so schnell auf.' },
    { id: 'doppelagent', name: 'Verdächtig', good: false, icon: '🕵',
      desc: 'Könnte ein eingeschleuster Maulwurf sein.', hidden: true },
  ];

  D.traitById = function (id) {
    for (var i = 0; i < D.TRAITS.length; i++) if (D.TRAITS[i].id === id) return D.TRAITS[i];
    return null;
  };

  /* ---------------------------------------------------------- Raeume */

  /* Das Hauptquartier ist ein Raster aus 3 Etagen à 10×4 Feldern. */
  D.HQ = { floors: 3, w: 10, h: 4 };

  D.ROOMS = [
    { id: 'zentrale', name: 'Kommandozentrale', w: 3, h: 2, cost: 0, upkeep: 400,
      icon: '🖥', color: '#4aa3ff', unique: true, floor: 0,
      desc: 'Der Kern der Agentur. Von hier laufen alle Fäden zusammen.',
      effect: { missionSlots: 2 } },
    { id: 'rekrut', name: 'Rekrutierungsbüro', w: 2, h: 2, cost: 90000, upkeep: 260,
      icon: '📋', color: '#3ddc84',
      desc: 'Mehr und bessere Bewerber im Pool.',
      effect: { recruitQuality: 1, recruitSlots: 2 } },
    { id: 'training', name: 'Trainingsraum', w: 3, h: 2, cost: 130000, upkeep: 340,
      icon: '🏋', color: '#ff9c3f',
      desc: 'Agenten trainieren hier eine Fähigkeit ihrer Wahl.',
      effect: { trainSlots: 2 } },
    { id: 'labor', name: 'Labor', w: 3, h: 2, cost: 150000, upkeep: 420,
      icon: '🧪', color: '#a97bff',
      desc: 'Erforscht neue Gadgets. Ohne Labor keine Forschung.',
      effect: { research: 1 } },
    { id: 'werkstatt', name: 'Werkstatt', w: 2, h: 2, cost: 120000, upkeep: 280,
      icon: '🔧', color: '#8794b1',
      desc: 'Baut erforschte Gadgets nach und repariert sie.',
      effect: { craft: 1 } },
    { id: 'server', name: 'Serverraum', w: 2, h: 2, cost: 160000, upkeep: 380,
      icon: '💾', color: '#34d3d3',
      desc: '+20 % auf alle Hacking-Proben.',
      effect: { hackBonus: 0.2 } },
    { id: 'medizin', name: 'Krankenstation', w: 2, h: 2, cost: 110000, upkeep: 300,
      icon: '⚕', color: '#ff5f6b',
      desc: 'Verletzte Agenten werden doppelt so schnell wieder fit.',
      effect: { heal: 2 } },
    { id: 'verhoer', name: 'Verhörraum', w: 2, h: 2, cost: 100000, upkeep: 240,
      icon: '🔦', color: '#f0b429',
      desc: 'Gefangene Gegner liefern Informationen über feindliche Organisationen.',
      effect: { intel: 1 } },
    { id: 'archiv', name: 'Archiv', w: 2, h: 2, cost: 80000, upkeep: 180,
      icon: '📚', color: '#6b7280',
      desc: 'Zeigt vor jeder Mission die genauen Erfolgsaussichten.',
      effect: { briefing: 1 } },
    { id: 'tarnfirma', name: 'Tarnfirma', w: 3, h: 2, cost: 200000, upkeep: 100,
      icon: '🏢', color: '#3f5170',
      desc: 'Legale Einnahmen und weniger Aufmerksamkeit: Hitze sinkt schneller.',
      effect: { income: 2400, heatDecay: 0.4 } },
    { id: 'hangar', name: 'Hangar', w: 4, h: 2, cost: 260000, upkeep: 520,
      icon: '✈', color: '#ffd166',
      desc: 'Halbiert die Anreisezeit zu allen Missionen.',
      effect: { travel: 0.5 } },
    { id: 'waffen', name: 'Waffenkammer', w: 2, h: 2, cost: 140000, upkeep: 320,
      icon: '🗄', color: '#c0764a',
      desc: '+15 % auf Nahkampf und Schießen.',
      effect: { combatBonus: 0.15 } },
    { id: 'kantine', name: 'Kantine', w: 3, h: 2, cost: 70000, upkeep: 200,
      icon: '🍽', color: '#9ad14b',
      desc: 'Senkt den Stress aller Agenten jeden Tag ein Stück.',
      effect: { stressRelief: 3 } },
    { id: 'sicherheit', name: 'Sicherheitsanlage', w: 2, h: 2, cost: 150000, upkeep: 360,
      icon: '🛡', color: '#ff7ac8',
      desc: 'Deckt eingeschleuste Maulwürfe schneller auf.',
      effect: { security: 1 } },
  ];

  D.roomById = function (id) {
    for (var i = 0; i < D.ROOMS.length; i++) if (D.ROOMS[i].id === id) return D.ROOMS[i];
    return null;
  };

  /* ---------------------------------------------------------- Gadgets */

  D.GADGETS = [
    { id: 'dietrich', name: 'Dietrich-Set', icon: '🗝', cost: 9000, tech: null,
      bonus: { technik: 18 }, uses: 4, desc: '+18 auf Technik. Öffnet fast jedes Schloss.' },
    { id: 'wanze', name: 'Abhörwanze', icon: '🐞', cost: 12000, tech: null,
      bonus: { technik: 10, tarnung: 8 }, uses: 3, desc: 'Hört mit, ohne aufzufallen.' },
    { id: 'maske', name: 'Gesichtsmaske', icon: '🎭', cost: 26000, tech: 'maske',
      bonus: { tarnung: 22, charisma: 10 }, uses: 2, desc: 'Verwandelt den Träger in jemand anderen.' },
    { id: 'hackdeck', name: 'Hack-Deck', icon: '💻', cost: 34000, tech: 'hackdeck',
      bonus: { hacking: 26 }, uses: 3, desc: 'Knackt Netzwerke, für die man sonst Wochen bräuchte.' },
    { id: 'drohne', name: 'Mini-Drohne', icon: '🛸', cost: 42000, tech: 'drohne',
      bonus: { tarnung: 12, technik: 12 }, uses: 3, desc: 'Späht voraus und findet den sicheren Weg.' },
    { id: 'emp', name: 'EMP-Granate', icon: '💥', cost: 38000, tech: 'emp',
      bonus: { technik: 20, hacking: 14 }, uses: 1, desc: 'Legt jede Elektronik für Minuten lahm.' },
    { id: 'tarnkappe', name: 'Tarnkappen-Anzug', icon: '👻', cost: 75000, tech: 'tarnkappe',
      bonus: { tarnung: 34 }, uses: 2, desc: 'Nahezu unsichtbar — solange man sich nicht bewegt.' },
    { id: 'schall', name: 'Schallwaffe', icon: '🔊', cost: 56000, tech: 'schall',
      bonus: { kampf: 24 }, uses: 2, desc: 'Schaltet Wachen aus, ohne sie zu verletzen.' },
    { id: 'fallschirm', name: 'Gleitschirm', icon: '🪂', cost: 21000, tech: null,
      bonus: { kampf: 8, tarnung: 12 }, uses: 3, desc: 'Für Anmarsch und Flucht aus großer Höhe.' },
    { id: 'giftstift', name: 'Betäubungsstift', icon: '🖊', cost: 30000, tech: 'giftstift',
      bonus: { kampf: 16, tarnung: 10 }, uses: 2, desc: 'Sieht aus wie ein Kugelschreiber.' },
  ];

  D.gadgetById = function (id) {
    for (var i = 0; i < D.GADGETS.length; i++) if (D.GADGETS[i].id === id) return D.GADGETS[i];
    return null;
  };

  /* ---------------------------------------------------------- Forschung */

  D.TECH = [
    { id: 'maske', name: 'Gesichtsmasken', cost: 60000, days: 8, icon: '🎭', needs: [],
      desc: 'Schaltet die Gesichtsmaske frei.' },
    { id: 'hackdeck', name: 'Hack-Deck', cost: 90000, days: 10, icon: '💻', needs: [],
      desc: 'Schaltet das Hack-Deck frei.' },
    { id: 'drohne', name: 'Mini-Drohnen', cost: 120000, days: 12, icon: '🛸', needs: ['hackdeck'],
      desc: 'Schaltet die Mini-Drohne frei.' },
    { id: 'emp', name: 'EMP-Technik', cost: 140000, days: 13, icon: '💥', needs: ['hackdeck'],
      desc: 'Schaltet die EMP-Granate frei.' },
    { id: 'giftstift', name: 'Betäubungsmittel', cost: 100000, days: 10, icon: '🖊', needs: [],
      desc: 'Schaltet den Betäubungsstift frei.' },
    { id: 'schall', name: 'Schallwaffen', cost: 170000, days: 14, icon: '🔊', needs: ['emp'],
      desc: 'Schaltet die Schallwaffe frei.' },
    { id: 'tarnkappe', name: 'Tarnkappen-Gewebe', cost: 260000, days: 20, icon: '👻', needs: ['maske', 'drohne'],
      desc: 'Schaltet den Tarnkappen-Anzug frei.' },
    { id: 'satellit', name: 'Eigener Satellit', cost: 380000, days: 24, icon: '🛰', needs: ['drohne'],
      desc: 'Zeigt in allen Regionen mehr Aufträge und bessere Aufklärung.' },
    { id: 'ausbildung', name: 'Ausbildungsprogramm', cost: 150000, days: 12, icon: '🎓', needs: [],
      desc: 'Agenten sammeln 50 % mehr Erfahrung.' },
    { id: 'gegenspionage', name: 'Gegenspionage', cost: 200000, days: 16, icon: '🛡', needs: ['ausbildung'],
      desc: 'Maulwürfe werden viel schneller entdeckt.' },
  ];

  D.techById = function (id) {
    for (var i = 0; i < D.TECH.length; i++) if (D.TECH[i].id === id) return D.TECH[i];
    return null;
  };

  /* ---------------------------------------------------------- Regionen */

  /* x/y sind Anteile der Weltkarte (0..1). Sie stehen hier ausgerechnet
     statt in Grad, weil die Karte sie so braucht und diese Datei vor
     der Karte geladen wird. Der Ausschnitt in 4-render.js reicht von
     84 Grad Nord bis 56 Grad Sued ueber die ganze Erde:

       x = (Laenge + 180) / 360        y = (84 - Breite) / 140

     Der Ort in Grad steht jeweils dahinter - wer eine Region
     verschiebt, rechnet damit zwei Zeilen nach. */
  D.REGIONS = [
    /* 4 O, 48 N */
    { id: 'westeuropa', name: 'Westeuropa', x: 0.511, y: 0.257, minLevel: 1 },
    /* 28 O, 50 N */
    { id: 'osteuropa', name: 'Osteuropa', x: 0.578, y: 0.243, minLevel: 1 },
    /* 98 W, 40 N */
    { id: 'nordamerika', name: 'Nordamerika', x: 0.228, y: 0.314, minLevel: 1 },
    /* 58 W, 12 S */
    { id: 'suedamerika', name: 'Südamerika', x: 0.339, y: 0.686, minLevel: 2 },
    /* 14 O, 26 N */
    { id: 'nordafrika', name: 'Nordafrika', x: 0.539, y: 0.414, minLevel: 2 },
    /* 3 W, 9 N */
    { id: 'westafrika', name: 'Westafrika', x: 0.492, y: 0.536, minLevel: 3 },
    /* 44 O, 29 N */
    { id: 'nahost', name: 'Naher Osten', x: 0.622, y: 0.393, minLevel: 3 },
    /* 78 O, 22 N */
    { id: 'suedasien', name: 'Südasien', x: 0.717, y: 0.443, minLevel: 4 },
    /* 114 O, 34 N */
    { id: 'ostasien', name: 'Ostasien', x: 0.817, y: 0.357, minLevel: 5 },
    /* 137 O, 25 S */
    { id: 'ozeanien', name: 'Ozeanien', x: 0.881, y: 0.779, minLevel: 6 },
    /* 0 O, 76 N */
    { id: 'arktis', name: 'Arktis', x: 0.500, y: 0.060, minLevel: 8 },
  ];

  D.regionById = function (id) {
    for (var i = 0; i < D.REGIONS.length; i++) if (D.REGIONS[i].id === id) return D.REGIONS[i];
    return null;
  };

  /* ---------------------------------------------------------- Missionen */

  /* phases: Abfolge von Proben. skill = geforderte Faehigkeit,
     dc = Schwierigkeit (wird mit dem Missionsgrad skaliert). */
  D.MISSION_TYPES = [
    {
      id: 'beschatten', name: 'Beschattung', icon: '👁', team: [1, 2], risk: 0.5,
      desc: 'Eine Zielperson unauffällig verfolgen und dokumentieren.',
      phases: [
        { name: 'Anmarsch', skill: 'tarnung', dc: 40 },
        { name: 'Kontakt aufnehmen', skill: 'charisma', dc: 45 },
        { name: 'Unbemerkt folgen', skill: 'tarnung', dc: 55 },
        { name: 'Rückzug', skill: 'tarnung', dc: 40 },
      ],
    },
    {
      id: 'einbruch', name: 'Einbruch', icon: '🚪', team: [2, 3], risk: 0.9,
      desc: 'In ein gesichertes Gebäude eindringen und wieder heraus.',
      phases: [
        { name: 'Perimeter überwinden', skill: 'tarnung', dc: 50 },
        { name: 'Schloss knacken', skill: 'technik', dc: 55 },
        { name: 'Alarmanlage umgehen', skill: 'hacking', dc: 60 },
        { name: 'Fluchtweg', skill: 'kampf', dc: 45 },
      ],
    },
    {
      id: 'diebstahl', name: 'Diebstahl', icon: '💎', team: [2, 3], risk: 1.0,
      desc: 'Ein wertvolles Objekt entwenden — und den Tausch nicht bemerken lassen.',
      phases: [
        { name: 'Aufklärung', skill: 'tarnung', dc: 45 },
        { name: 'Tresor öffnen', skill: 'technik', dc: 65 },
        { name: 'Austausch', skill: 'technik', dc: 55 },
        { name: 'Unbemerkt verschwinden', skill: 'tarnung', dc: 60 },
      ],
    },
    {
      id: 'hacking', name: 'Netzwerk-Einbruch', icon: '💻', team: [1, 2], risk: 0.6,
      desc: 'In ein fremdes Netz eindringen und Daten kopieren.',
      phases: [
        { name: 'Zugang finden', skill: 'hacking', dc: 50 },
        { name: 'Firewall überwinden', skill: 'hacking', dc: 62 },
        { name: 'Daten kopieren', skill: 'technik', dc: 50 },
        { name: 'Spuren löschen', skill: 'hacking', dc: 58 },
      ],
    },
    {
      id: 'sabotage', name: 'Sabotage', icon: '💣', team: [2, 4], risk: 1.3,
      desc: 'Eine Anlage lahmlegen, ohne dass es nach Sabotage aussieht.',
      phases: [
        { name: 'Einschleusen', skill: 'tarnung', dc: 52 },
        { name: 'Wachen ausschalten', skill: 'kampf', dc: 58 },
        { name: 'Ladung platzieren', skill: 'technik', dc: 60 },
        { name: 'Rückzug unter Feuer', skill: 'schuss', dc: 62 },
      ],
    },
    {
      id: 'extraktion', name: 'Extraktion', icon: '🚁', team: [3, 4], risk: 1.4,
      desc: 'Eine Person aus feindlichem Gebiet herausholen.',
      phases: [
        { name: 'Kontakt herstellen', skill: 'charisma', dc: 50 },
        { name: 'Zugriff', skill: 'kampf', dc: 62 },
        { name: 'Rückzug sichern', skill: 'schuss', dc: 65 },
        { name: 'Übergabe', skill: 'tarnung', dc: 48 },
      ],
    },
    {
      id: 'attentat', name: 'Anschlag verhindern', icon: '🛡', team: [3, 4], risk: 1.5,
      desc: 'Einen geplanten Anschlag stoppen, bevor er ausgeführt wird.',
      phases: [
        { name: 'Hinweise auswerten', skill: 'hacking', dc: 55 },
        { name: 'Verdächtigen aufspüren', skill: 'tarnung', dc: 60 },
        { name: 'Zugriff', skill: 'kampf', dc: 68 },
        { name: 'Sprengsatz entschärfen', skill: 'technik', dc: 70 },
      ],
    },
    {
      id: 'maulwurf', name: 'Maulwurf enttarnen', icon: '🕵', team: [2, 3], risk: 0.8,
      desc: 'Einen eingeschleusten Spion in den eigenen Reihen finden.',
      phases: [
        { name: 'Akten sichten', skill: 'hacking', dc: 52 },
        { name: 'Verhalten beobachten', skill: 'tarnung', dc: 55 },
        { name: 'Falle stellen', skill: 'charisma', dc: 60 },
        { name: 'Zugriff', skill: 'kampf', dc: 55 },
      ],
    },
    {
      id: 'eskorte', name: 'Eskorte', icon: '🚗', team: [2, 4], risk: 1.1,
      desc: 'Eine wichtige Person sicher ans Ziel bringen.',
      phases: [
        { name: 'Route prüfen', skill: 'technik', dc: 45 },
        { name: 'Hinterhalt abwehren', skill: 'schuss', dc: 64 },
        { name: 'Ausweichroute', skill: 'tarnung', dc: 55 },
        { name: 'Übergabe', skill: 'charisma', dc: 45 },
      ],
    },
    {
      id: 'befreiung', name: 'Befreiung', icon: '⛓', team: [3, 4], risk: 1.6, special: 'rescue',
      desc: 'Einen gefangenen eigenen Agenten herausholen.',
      phases: [
        { name: 'Aufenthaltsort finden', skill: 'hacking', dc: 55 },
        { name: 'Anmarsch', skill: 'tarnung', dc: 58 },
        { name: 'Wachen überwinden', skill: 'kampf', dc: 66 },
        { name: 'Flucht', skill: 'schuss', dc: 62 },
      ],
    },
  ];

  D.missionType = function (id) {
    for (var i = 0; i < D.MISSION_TYPES.length; i++) {
      if (D.MISSION_TYPES[i].id === id) return D.MISSION_TYPES[i];
    }
    return D.MISSION_TYPES[0];
  };

  /* Entscheidungen mitten in der Mission */
  D.CHOICES = [
    {
      id: 'wache', text: 'Eine Wache kommt den Gang entlang. Wie geht es weiter?',
      options: [
        { text: 'Verstecken und abwarten', skill: 'tarnung', bonus: 0, heat: 0, time: 1 },
        { text: 'Lautlos ausschalten', skill: 'kampf', bonus: 8, heat: 6, time: 0 },
        { text: 'Als Kollege ausgeben', skill: 'charisma', bonus: 5, heat: 2, time: 0 },
      ],
    },
    {
      id: 'kamera', text: 'Eine Kamera überwacht den nächsten Abschnitt.',
      options: [
        { text: 'Bild einfrieren (Hacking)', skill: 'hacking', bonus: 10, heat: 2, time: 0 },
        { text: 'Toten Winkel nutzen', skill: 'tarnung', bonus: 4, heat: 0, time: 1 },
        { text: 'Kamera abschrauben', skill: 'technik', bonus: 6, heat: 8, time: 0 },
      ],
    },
    {
      id: 'alarm', text: 'Der Alarm ist ausgelöst. Was jetzt?',
      options: [
        { text: 'Durchziehen und rennen', skill: 'kampf', bonus: 12, heat: 14, time: 0 },
        { text: 'Abbrechen und später zurück', skill: 'tarnung', bonus: -6, heat: -4, time: 2 },
        { text: 'Ablenkung legen', skill: 'technik', bonus: 6, heat: 4, time: 1 },
      ],
    },
    {
      id: 'informant', text: 'Ein Informant bietet Hilfe an — gegen Bezahlung.',
      options: [
        { text: '25.000 € zahlen', skill: null, bonus: 14, heat: 0, time: 0, cost: 25000 },
        { text: 'Ablehnen', skill: null, bonus: 0, heat: 0, time: 0 },
        { text: 'Unter Druck setzen', skill: 'charisma', bonus: 9, heat: 7, time: 0 },
      ],
    },
    {
      id: 'zivilist', text: 'Eine unbeteiligte Person hat euch gesehen.',
      options: [
        { text: 'Beruhigen und wegschicken', skill: 'charisma', bonus: 4, heat: 3, time: 0 },
        { text: 'Ausweichen und weiter', skill: 'tarnung', bonus: 0, heat: 8, time: 1 },
        { text: 'Betäuben', skill: 'kampf', bonus: 6, heat: 12, time: 0 },
      ],
    },
  ];

  /* ---------------------------------------------------------- Auftraggeber */

  D.CLIENTS = [
    { id: 'regierung', name: 'Regierungsstelle', icon: '🏛', color: '#4aa3ff',
      payMul: 1.0, repMul: 1.3, desc: 'Zahlt ordentlich und öffnet Türen — aber verzeiht keine Fehler.' },
    { id: 'konzern', name: 'Großkonzern', icon: '🏢', color: '#f0b429',
      payMul: 1.35, repMul: 0.8, desc: 'Zahlt am besten, fragt aber wenig nach Moral.' },
    { id: 'privat', name: 'Privatkunde', icon: '🎩', color: '#a97bff',
      payMul: 1.1, repMul: 0.9, desc: 'Diskret und unkompliziert.' },
    { id: 'presse', name: 'Investigativredaktion', icon: '📰', color: '#3ddc84',
      payMul: 0.7, repMul: 1.6, desc: 'Zahlt wenig, bringt aber viel Ansehen.' },
  ];

  D.clientById = function (id) {
    for (var i = 0; i < D.CLIENTS.length; i++) if (D.CLIENTS[i].id === id) return D.CLIENTS[i];
    return D.CLIENTS[0];
  };

  /* ---------------------------------------------------------- Gegner */

  D.ENEMIES = [
    { id: 'nachtorden', name: 'Nachtorden', icon: '🌒', color: '#a97bff',
      desc: 'Ein alter Zirkel, der Regierungen von innen aushöhlt.' },
    { id: 'zenith', name: 'Zenith Konsortium', icon: '⬢', color: '#ff9c3f',
      desc: 'Wirtschaftsspionage im ganz großen Stil.' },
    { id: 'hydra', name: 'Rote Hydra', icon: '🐍', color: '#ff5f6b',
      desc: 'Waffenhandel und Söldner — schlägt hart zurück.' },
  ];

  /* ---------------------------------------------------------- Namen */

  D.FIRST = ['Anna', 'Bea', 'Clara', 'Dana', 'Elif', 'Fiona', 'Greta', 'Hanna', 'Ida', 'Jara',
    'Kira', 'Lena', 'Mira', 'Nora', 'Olga', 'Pia', 'Rana', 'Sina', 'Tara', 'Vera',
    'Ben', 'Cem', 'Dario', 'Emre', 'Finn', 'Gero', 'Hugo', 'Ivan', 'Jonas', 'Kai',
    'Lars', 'Milo', 'Nils', 'Omar', 'Piet', 'Raul', 'Sven', 'Timo', 'Uwe', 'Yann'];
  D.LAST = ['Achterberg', 'Bergmann', 'Coelho', 'Duarte', 'Engel', 'Falk', 'Gerber', 'Holm',
    'Iversen', 'Jansen', 'Krause', 'Lindqvist', 'Moreau', 'Novak', 'Ortiz', 'Petrov',
    'Quandt', 'Reiter', 'Sasaki', 'Tavares', 'Ulrich', 'Vogel', 'Wilder', 'Zangger'];
  D.CODENAMES = ['Falke', 'Nebel', 'Zunder', 'Kobalt', 'Perle', 'Anker', 'Distel', 'Eisvogel',
    'Fuchs', 'Granit', 'Halo', 'Iris', 'Jaguar', 'Kranich', 'Luchs', 'Marder',
    'Nordwind', 'Otter', 'Prisma', 'Quarz', 'Rabe', 'Saphir', 'Tundra', 'Uhu',
    'Viper', 'Wolke', 'Zenit'];

  /* ---------------------------------------------------------- Fortschritt */

  D.LEVEL_XP = [0, 0, 400, 1000, 2000, 3600, 6000, 9500, 14500, 21000,
    30000, 42000, 58000, 80000, 110000];

  D.levelFor = function (xp) {
    var lv = 1;
    for (var i = 2; i < D.LEVEL_XP.length; i++) if (xp >= D.LEVEL_XP[i]) lv = i;
    return lv;
  };
  D.nextLevelXp = function (lv) {
    return D.LEVEL_XP[Math.min(lv + 1, D.LEVEL_XP.length - 1)];
  };

  /* ---------------------------------------------------------- Wirtschaft */

  D.ECON = {
    start: 450000,
    baseFee: 46000,          // Grundhonorar einer Mission
    salary: 380,             // Tagesgehalt je Agent
    recruitCost: 12000,      // Kosten je Bewerbung
    trainCost: 9000,         // Kosten je Trainingstag
    heatDecay: 0.55,         // Hitze faellt pro Tag
    heatRisk: 70,            // ab hier drohen Ermittlungen
    bribeBase: 40000,        // Bestechung senkt Hitze
    marketMul: 1.6,          // Schwarzmarkt-Aufschlag
    monthlyTax: 0.12,
  };

  /* ---------------------------------------------------------- Kampagne */

  D.STORY = [
    { id: 's1', title: 'Erste Spur', text: 'Verdiene 150.000 € und stelle drei Agenten ein.',
      check: function (s) { return s.cash >= 150000 && s.agents.length >= 3; }, reward: 60000 },
    { id: 's2', title: 'Werkbank', text: 'Baue ein Labor und schließe eine Forschung ab.',
      check: function (s) { return s.hasRoom('labor') && s.tech.length >= 1; }, reward: 90000 },
    { id: 's3', title: 'Netzwerk', text: 'Schließe zehn Missionen erfolgreich ab.',
      check: function (s) { return s.stats.won >= 10; }, reward: 120000 },
    { id: 's4', title: 'Ausbau', text: 'Erreiche Agentur-Level 4.',
      check: function (s) { return s.level >= 4; }, reward: 150000 },
    { id: 's5', title: 'Erste Fährte', text: 'Bringe eine feindliche Organisation unter 60 % Einfluss.',
      check: function (s) { return s.enemies.some(function (e) { return e.power < 60; }); }, reward: 200000 },
    { id: 's6', title: 'Saubere Weste', text: 'Halte alle Regionen unter 40 Hitze.',
      check: function (s) { return s.regions.every(function (r) { return r.heat < 40; }); }, reward: 180000 },
    { id: 's7', title: 'Elite', text: 'Bilde einen Agenten auf Stufe 5 aus.',
      check: function (s) { return s.agents.some(function (a) { return a.level >= 5; }); }, reward: 220000 },
    { id: 's8', title: 'Weltweit', text: 'Schalte acht Regionen frei.',
      check: function (s) { return s.regions.filter(function (r) { return r.unlocked; }).length >= 8; }, reward: 260000 },
    { id: 's9', title: 'Gegenschlag', text: 'Schalte eine feindliche Organisation ganz aus.',
      check: function (s) { return s.enemies.some(function (e) { return e.power <= 0; }); }, reward: 400000 },
    { id: 's10', title: 'Vollausbau', text: 'Baue zwölf Räume im Hauptquartier.',
      check: function (s) { return s.rooms.length >= 12; }, reward: 350000 },
    { id: 's11', title: 'Legende', text: 'Erreiche Agentur-Level 9.',
      check: function (s) { return s.level >= 9; }, reward: 600000 },
    { id: 's12', title: 'Endspiel', text: 'Schalte alle drei Organisationen aus.',
      check: function (s) { return s.enemies.every(function (e) { return e.power <= 0; }); }, reward: 1500000 },
  ];
})(SG);
