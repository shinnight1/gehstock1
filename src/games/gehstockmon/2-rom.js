/* ------------------------------------------------------------------
   GehstockMon-Event "ROMA È FINITA - Der große Pizzaputsch"

   Ein Admin-Abuse-Event, das nur der CEO startet: zwoelf Minuten Rom
   auf der Insel, in fuenf Phasen, fuer alle in derselben Spielerwelt.

     Regeln (hier)          Zeitplan, Wege der Figuren, Lire, Stufen
     Server                 netlify/functions/lib/gehstockmon-rom.mjs
     Szene                  2-rom-szene.js (Kulisse und Figuren in 3D)
     Oberflaeche            2-rom-ui.js (Anzeige, Knoepfe, Musik)
     Bedienung fuer den CEO src/core/rom-steuerung.js

   Alles haengt nur an der Startzeit und der Kennung des Events. Wer neu
   laedt oder spaet dazukommt, rechnet daraus denselben Stand aus, und
   der Server muss keine einzige Figurenposition speichern - er rechnet
   sie fuer seine Pruefungen genauso aus wie der Browser.

   Lire sind die Punkte des Events. Sie gehoeren nur zu diesem einen
   Event und werden am Ende in echte Belohnungen umgerechnet.
   ------------------------------------------------------------------ */
(function (SG) {
  var R = SG.gehstockmon, D = R.daten, E = R.wirtschaft, X = R.abenteuer;
  var ROM = X.ROM = {};

  /* ------------------------------------------------------ Zeitplan */
  ROM.COUNTDOWN = 60000;
  ROM.PHASEN = [
    { id: 'wahnsinn', name: 'Rom verliert den Verstand', ruf: 'ROMA È FINITA!', dauer: 120000, lire: 20 },
    { id: 'rebellion', name: 'Die Pizza-Rebellion', ruf: 'LA RIBELLIONE!', dauer: 150000, lire: 30 },
    { id: 'invasion', name: 'Die Sombrero-Invasion', ruf: '¡OLÈ! … äh, OLÉ?', dauer: 150000, lire: 30 },
    { id: 'imperator', name: 'Imperatore Mozzarellus', ruf: 'AVE, MOZZARELLUS!', dauer: 210000, lire: 40 },
    { id: 'trevi', name: 'Der Trevi-Brunnen explodiert', ruf: 'FONTANA DI TREVI: BOOM!', dauer: 90000, lire: 10 }
  ];
  ROM.DAUER = ROM.PHASEN.reduce(function (s, p) { return s + p.dauer; }, 0);
  ROM.GESAMT = ROM.COUNTDOWN + ROM.DAUER;
  /* Zeitraffer nur in der Testzone und am Entwicklungsserver. */
  ROM.ZEITRAFFER = [1, 3, 6];
  /* So viel Luft muss nach dem Ende bis zum Schliessen der Insel bleiben. */
  ROM.PUFFER = 2 * 60000;
  /* So lange zeigt die Insel ein beendetes Event noch mit Zusammenfassung. */
  ROM.NACHLAUF = 10 * 60000;

  ROM.faktor = function (ev) { var f = ev && ev.faktor; return ROM.ZEITRAFFER.indexOf(f) >= 0 ? f : 1; };
  ROM.dauer = function (ev, ms) { return ms / ROM.faktor(ev); };
  /* Die festen Grenzen eines Events. */
  ROM.plan = function (ev) {
    var t = ev.start + ROM.dauer(ev, ROM.COUNTDOWN), phasen = [];
    ROM.PHASEN.forEach(function (ph) { var von = t; t += ROM.dauer(ev, ph.dauer); phasen.push({ von: von, bis: t }); });
    return { countdownBis: ev.start + ROM.dauer(ev, ROM.COUNTDOWN), phasen: phasen, ende: t };
  };
  /* Wann das Event wirklich endet - beim Abbruch frueher. */
  ROM.ende = function (ev) { var e = ROM.plan(ev).ende; return ev.abgebrochenAm ? Math.min(e, ev.abgebrochenAm) : e; };
  /* Wo das Event steht: nr -1 Countdown, 0 bis 4 die Phasen, 5 vorbei. */
  ROM.phase = function (ev, now) {
    if (!ev || !Number.isFinite(ev.start)) return null;
    var p = ROM.plan(ev), ende = ROM.ende(ev);
    if (now >= ende) return { nr: 5, von: ende, bis: null, abgebrochen: !!ev.abgebrochenAm && ev.abgebrochenAm < p.ende };
    if (now < p.countdownBis) return { nr: -1, von: ev.start, bis: p.countdownBis };
    for (var i = 0; i < p.phasen.length; i++) if (now < p.phasen[i].bis) return { nr: i, von: p.phasen[i].von, bis: p.phasen[i].bis };
    return { nr: 5, von: p.ende, bis: null, abgebrochen: false };
  };
  ROM.laeuft = function (ev, now) { var ph = ROM.phase(ev, now); return !!ph && ph.nr < 5; };
  /* Im Countdown abgebrochen: dann ist nichts passiert, und es zaehlt nicht. */
  ROM.nieGelaufen = function (ev) { return !!ev.abgebrochenAm && ev.abgebrochenAm < ROM.plan(ev).countdownBis; };

  /* ------------------------------------------ Zufall ohne Zustand */
  /* Dieselbe Zahl auf jedem Geraet: aus Event-Kennung und Schluessel. */
  function streu(text) {
    var h = 0x811c9dc5;
    for (var i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0; h ^= h >>> 16;
    return h >>> 0;
  }
  ROM.wurf = function (ev, schluessel) { return streu(String(ev.id) + ':' + schluessel) / 4294967296; };

  /* ------------------------------------------------------- Orte */
  /* Die Piazza liegt oestlich vom Startplatz, der Trevi-Brunnen an ihrem
     Nordrand. Aus der Arena wird fuer zwoelf Minuten das Kolosseum. */
  ROM.PIAZZA = { x: 30, z: 38, radius: 14 };
  ROM.TREVI = { x: 30, z: 53 };
  ROM.KOLOSSEUM = { x: X.STADT.x, z: X.STADT.z, radius: X.STADT.radius + 3 };
  /* Wegpunkte der Pizzen: ein Raster rund um Start und Piazza, ohne
     Brunnen und Leuchtturm. Dass jeder davon begehbar ist und auch jede
     gerade Strecke zwischen zwei nahen, prueft tools/gehstockmon-rom-tests.mjs. */
  ROM.WEGE = (function () {
    var liste = [];
    for (var x = -12; x <= 52; x += 8) for (var z = 10; z <= 58; z += 8) {
      if (Math.hypot(x - ROM.TREVI.x, z - ROM.TREVI.z) < 8 || Math.hypot(x, z) < 7) continue;
      liste.push({ x: x, z: z });
    }
    return liste;
  })();

  /* ------------------------------------------------------ Pizzen */
  /* Jede Pizza lebt einen Abschnitt lang und laeuft dabei von einem
     Wegpunkt zu einem nahen anderen. Danach rennt sie davon, und eine neue
     kommt. Jede hat eine eigene Kennung - geschnappt wird jede nur einmal. */
  ROM.PIZZA_ABSCHNITT = 24000;
  ROM.PIZZA_ANZAHL = [8, 4, 0, 0, 0];
  ROM.PIZZA_NAEHE = 10;
  function ziel(ev, von, schluessel) {
    var nah = ROM.WEGE.filter(function (w) { var d = Math.hypot(w.x - von.x, w.z - von.z); return d > 6 && d < 24; });
    return nah[Math.floor(ROM.wurf(ev, schluessel) * nah.length)] || von;
  }
  /* Alle Pizzen zu einem Zeitpunkt. */
  ROM.pizzen = function (ev, now) {
    var ph = ROM.phase(ev, now);
    if (!ph || ph.nr < 0 || ph.nr > 4) return [];
    var anzahl = ROM.PIZZA_ANZAHL[ph.nr];
    if (!anzahl) return [];
    var laenge = ROM.dauer(ev, ROM.PIZZA_ABSCHNITT), abschnitt = Math.floor((now - ph.von) / laenge), liste = [];
    for (var i = 0; i < anzahl; i++) liste.push(ROM.pizza(ev, ph.nr + '-' + abschnitt + '-' + i, now));
    return liste.filter(Boolean);
  };
  /* Eine Pizza nach Kennung (Phase-Abschnitt-Nummer) zu einem Zeitpunkt,
     oder null, wenn sie zu der Zeit nicht unterwegs war. */
  ROM.pizza = function (ev, id, now) {
    var teile = String(id).split('-').map(Number);
    if (teile.length !== 3 || teile.some(function (n) { return !Number.isInteger(n) || n < 0; })) return null;
    var nr = teile[0], abschnitt = teile[1], i = teile[2];
    if (nr > 4 || i >= ROM.PIZZA_ANZAHL[nr]) return null;
    var grenze = ROM.plan(ev).phasen[nr], laenge = ROM.dauer(ev, ROM.PIZZA_ABSCHNITT);
    var von = grenze.von + abschnitt * laenge, bis = Math.min(grenze.bis, von + laenge);
    if (now < von || now >= bis) return null;
    var start = ROM.WEGE[Math.floor(ROM.wurf(ev, 'pizza:' + id) * ROM.WEGE.length)];
    var z = ziel(ev, start, 'pizza-ziel:' + id), t = (now - von) / (bis - von);
    /* Watschelnd: vorwaerts mit kleinen Pausen, dabei seitlich wackelnd. */
    var weg = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    var dx = z.x - start.x, dz = z.z - start.z, laenge2 = Math.hypot(dx, dz) || 1, quer = Math.sin(t * Math.PI * 6) * 0.9;
    return { id: id, x: start.x + dx * weg - dz / laenge2 * quer, z: start.z + dz * weg + dx / laenge2 * quer,
      heading: Math.atan2(dx, dz), bis: bis, sorte: Math.floor(ROM.wurf(ev, 'sorte:' + id) * 4) };
  };

  /* --------------------------------------- Wagen, Legion und Boss */
  function ellipse(ev, now, o) {
    var t = ((now - ev.start) / ROM.dauer(ev, o.runde)) * Math.PI * 2 * (o.richtung || 1) + (o.versatz || 0);
    var x = o.x + Math.cos(t) * o.rx, z = o.z + Math.sin(t) * o.rz;
    var vx = -Math.sin(t) * o.rx * (o.richtung || 1), vz = Math.cos(t) * o.rz * (o.richtung || 1);
    return { x: x, z: z, heading: Math.atan2(vx, vz) };
  }
  ROM.WAGEN = { x: 14, z: 32, rx: 28, rz: 18, runde: 70000, reichweite: 34 };
  ROM.wagenOrt = function (ev, now) { return ellipse(ev, now, ROM.WAGEN); };
  /* Die Legionaere marschieren hinterher, jeder ein Stueck weiter zurueck. */
  ROM.legionaerOrt = function (ev, now, i) { return ellipse(ev, now, Object.assign({}, ROM.WAGEN, { versatz: -0.16 - i * 0.07 })); };
  ROM.BOSS = { x: 6, z: 34, rx: 24, rz: 17, runde: 80000, richtung: -1, reichweite: 34,
    basis: 2000, anteil: 12, min: 250, max: 800, bonus: 1.4, leiste: 1.2, nachschub: 6000, vorrat: 3, lire: 2, letzter: 5 };
  ROM.bossOrt = function (ev, now) { return ellipse(ev, now, ROM.BOSS); };
  /* Alle 30 Sekunden wechselt Mozzarellus die Haltung. Gegen jede hilft eine
     Rolle - die Start-Truppe hat jede einmal und passt darum immer. */
  ROM.HALTUNG_DAUER = 30000;
  ROM.HALTUNGEN = [
    { id: 'kaese', name: 'Käsepanzer', zeichen: '🧀', rolle: 1, text: 'Schneiden zerlegen den Käse.' },
    { id: 'espresso', name: 'Espresso-Rausch', zeichen: '☕', rolle: 3, text: 'Störer bremsen ihn aus.' },
    { id: 'tomate', name: 'Tomatenhagel', zeichen: '🍅', rolle: 2, text: 'Pfleger halten die Truppe sauber.' },
    { id: 'schieber', name: 'Pizzaschieber-Wall', zeichen: '🛡', rolle: 0, text: 'Walls halten dagegen.' }
  ];
  ROM.haltung = function (ev, now) {
    var von = ROM.plan(ev).phasen[3].von;
    return ROM.HALTUNGEN[Math.max(0, Math.floor((now - von) / ROM.dauer(ev, ROM.HALTUNG_DAUER))) % ROM.HALTUNGEN.length];
  };
  /* Was ein Schlag austraegt: die Zerhacker-Rechnung der eigenen Truppe,
     aber begrenzt - Neulinge zaehlen spuerbar, Profis erledigen ihn nicht
     allein. */
  ROM.schlagwert = function (p) { var B = ROM.BOSS; return Math.max(B.min, Math.min(B.max, X.zerhackerSchaden(p))); };
  ROM.rollen = function (p) {
    var r = {};
    ((p && p.truppe) || []).forEach(function (id) { var m = D.mon(id); if (m) r[m.typ] = true; });
    return r;
  };
  ROM.schaden = function (p, ev, now, leisteVoll) {
    var B = ROM.BOSS, h = ROM.haltung(ev, now);
    return Math.round(ROM.schlagwert(p) * (ROM.rollen(p)[h.rolle] ? B.bonus : 1) * (leisteVoll ? B.leiste : 1));
  };
  /* Schlagvorrat: alle sechs Sekunden einer, bis zu drei gesammelt. */
  ROM.vorrat = function (b, ev, now) {
    var B = ROM.BOSS, n = ROM.dauer(ev, B.nachschub), stand = b && Number.isFinite(b.schlagStand) ? b.schlagStand : ROM.plan(ev).phasen[3].von - B.vorrat * n;
    return Math.max(0, Math.min(B.vorrat, Math.floor((now - stand) / n)));
  };
  ROM.schlagVerbrauchen = function (b, ev, now) {
    var B = ROM.BOSS, n = ROM.dauer(ev, B.nachschub), stand = Number.isFinite(b.schlagStand) ? b.schlagStand : ROM.plan(ev).phasen[3].von - B.vorrat * n;
    b.schlagStand = Math.max(stand, now - B.vorrat * n) + n;
  };

  /* ---------------------------------------------------- Tanzfolge */
  ROM.POSEN = [
    { id: 0, zeichen: '⬆️', name: 'Arme hoch' },
    { id: 1, zeichen: '➡️', name: 'Hüfte rechts' },
    { id: 2, zeichen: '⬇️', name: 'In die Knie' },
    { id: 3, zeichen: '⬅️', name: 'Hüfte links' }
  ];
  /* Eine Tanzrunde dauert immer zehn Sekunden, auch im Zeitraffer - sonst
     liesse sich die Folge dort gar nicht mehr nachtippen. */
  ROM.TANZ_RUNDE = 10000;
  ROM.tanzRunde = function (ev, now) { return Math.floor((now - ROM.plan(ev).phasen[2].von) / ROM.TANZ_RUNDE); };
  /* Die Folge wird mit jeder dritten Runde laenger - hoechstens sieben. */
  ROM.tanzFolge = function (ev, runde) {
    var laenge = Math.min(7, 4 + Math.floor(Math.max(0, runde) / 3)), folge = [];
    for (var k = 0; k < laenge; k++) folge.push(Math.floor(ROM.wurf(ev, 'tanz:' + runde + ':' + k) * ROM.POSEN.length));
    return folge;
  };
  ROM.tanzLire = function (folge) { return folge.length >= 6 ? 3 : 2; };
  ROM.POLONAISE = { radius: 16, takt: 15000, lire: 1 };

  /* ------------------------------------------- Gemeinsame Leiste */
  /* Alle Lire der ersten drei Phasen fuellen die Mamma-Mia-Leiste. Das Ziel
     waechst mit der Zahl der Mitspieler. Ueber jede Schwelle kommt eine
     Ueberraschung; ist sie voll, schlaegt die Truppe den Boss haerter. */
  ROM.LEISTE = { je: 25, min: 75, gold: 150 };
  ROM.UEBERRASCHUNGEN = [
    { id: 'spaghetti', anteil: 1 / 3, name: 'Spaghetti-Regen', text: 'Fang die Nudeln!', fang: 5, dauer: 20000 },
    { id: 'vespa', anteil: 2 / 3, name: 'Vespa-Stampede', text: 'Pizzen auf Vespas! Tipp sie an!', fang: 5, dauer: 20000 },
    { id: 'nonna', anteil: 1, name: 'Nonna Colossale', text: 'MANGIA! Mehr Kraft gegen den Imperator und 150 Gold für alle.' }
  ];
  ROM.leisteZiel = function (teilnehmer) { return Math.max(ROM.LEISTE.min, ROM.LEISTE.je * teilnehmer); };
  ROM.FANG = { spaghetti: 5, vespa: 5, muenzen: 10 };
  ROM.STERN = { max: 5, abstand: 6000 };
  ROM.MUENZE = 3;

  /* ------------------------------------------- Beitrag und Lage */
  ROM.LIRE_MAX = 120;
  ROM.leer = function () { return { lire: [0, 0, 0, 0, 0], stern: 0, schlaege: 0, schaden: 0, hp: 0 }; };
  /* Lire eines Beitrags, gedeckelt. */
  ROM.lire = function (b) {
    if (!b) return 0;
    var summe = (b.lire || []).reduce(function (s, n) { return s + (Number(n) || 0); }, 0) + (Number(b.stern) || 0);
    return Math.min(ROM.LIRE_MAX, Math.max(0, Math.floor(summe)));
  };
  /* Die gemeinsame Lage aus allen Beitraegen: Leiste und Boss. Einmal voll
     bleibt die Leiste voll, auch wenn danach noch Leute dazukommen und das
     Ziel waechst - Nonna Colossale war da, und dabei bleibt es. */
  ROM.lage = function (alle, ev) {
    var teilnehmer = 0, leiste = 0, schaden = 0, hp = 0, letzter = false;
    Object.keys(alle || {}).forEach(function (pid) {
      var b = alle[pid]; if (!b) return;
      if (ROM.lire(b) > 0) teilnehmer++;
      leiste += [0, 1, 2].reduce(function (s, i) { return s + (Number(b.lire && b.lire[i]) || 0); }, 0);
      schaden += Number(b.schaden) || 0; hp += Number(b.hp) || 0; if (b.letzter) letzter = true;
    });
    var ziel = ROM.leisteZiel(teilnehmer), max = hp ? ROM.BOSS.basis + hp : 0;
    var voll = leiste >= ziel || !!(ev && ev.ueberraschungen && ev.ueberraschungen.nonna);
    /* Ein bestaetigter letzter Schlag bleibt ein Sieg, auch wenn ein
       gleichzeitiger erster Angriff noch zusaetzliche Boss-HP eintraegt. */
    var besiegt = !!max && (letzter || schaden >= max);
    return { teilnehmer: teilnehmer, leiste: voll ? ziel : Math.min(leiste, ziel), leisteZiel: ziel, leisteVoll: voll,
      bossMax: max, bossSchaden: besiegt ? max : Math.min(schaden, max), bossHp: besiegt ? 0 : Math.max(0, max - schaden), bossBesiegt: besiegt, letzter: letzter };
  };

  /* ---------------------------------------------------- Belohnungen */
  ROM.STUFEN = [
    { id: 'tourist', name: 'Tourist', zeichen: '🧳', ab: 10, gold: 200, romEi: true, text: '200 Gold und ein Rom-Ei (mindestens Legendär)' },
    { id: 'gladiator', name: 'Gladiator', zeichen: '⚔️', ab: 40, gold: 300, runen: { rang: 3, anzahl: 3 }, text: '300 Gold und 3 Episch-Runen' },
    { id: 'held', name: 'Held von Rom', zeichen: '🌿', ab: 75, gold: 250, titel: 'held_von_rom', text: '250 Gold und der Titel „Held von Rom“' }
  ];
  ROM.MOZZARINO = { id: 'mozzarino', stufe: 'gladiator', schlaege: 5 };
  /* Wer was bekommt. Wird das Event nach dem Countdown abgebrochen, reicht
     fuer den Touristen eine einzige Lira - wer mitgemacht hat, soll nicht
     leer ausgehen, weil der CEO abbricht. */
  ROM.lohn = function (b, lage, ev) {
    var lire = ROM.lire(b), abgebrochen = !!(ev && ev.abgebrochenAm && ev.abgebrochenAm < ROM.plan(ev).ende);
    var stufen = ROM.STUFEN.filter(function (s, i) { return lire >= (i === 0 && abgebrochen ? 1 : s.ab); });
    var ids = stufen.map(function (s) { return s.id; }), tourist = ids.indexOf('tourist') >= 0;
    var out = { lire: lire, stufen: ids, gold: 0, runen: {}, romEi: false, mozzarino: false, titel: [], leiste: !!(lage && lage.leisteVoll && tourist),
      boss: !!(lage && lage.bossBesiegt), schlaege: (b && b.schlaege) || 0, abgebrochen: abgebrochen };
    stufen.forEach(function (s) {
      out.gold += s.gold;
      if (s.romEi) out.romEi = true;
      if (s.runen) out.runen[s.runen.rang] = (out.runen[s.runen.rang] || 0) + s.runen.anzahl;
      if (s.titel) out.titel.push(s.titel);
    });
    if (out.leiste) out.gold += ROM.LEISTE.gold;
    if (out.boss && ids.indexOf(ROM.MOZZARINO.stufe) >= 0 && out.schlaege >= ROM.MOZZARINO.schlaege) out.mozzarino = true;
    if (out.boss && out.schlaege >= 1) out.titel.push('mozzarella_bezwinger');
    return out;
  };
  /* Welche Stufe als naechste kommt - fuer die Anzeige. */
  ROM.naechsteStufe = function (lire) { return ROM.STUFEN.find(function (s) { return lire < s.ab; }) || null; };

  /* ------------------------------------------------ Das Event-Mon */
  /* Centurio Mozzarino gibt es nur aus dem Rom-Event. Er steht darum nicht
     im Katalog: aus dem kommen alle Eier, Beschwoerungen, Trainer und
     Dungeons, und dort soll er nie auftauchen. D.mon kennt ihn trotzdem -
     so bleibt er in der Sammlung, kaempft, steigt mit Zwillingen auf und
     laesst sich praegen wie jedes andere Mon.

     Er ist ein legendaerer Wall mit den Grundwerten seiner Rolle, also
     genau so stark wie der Aurorabaer - nicht staerker. */
  var wall = D.KREATUREN[0];
  D.EVENT_MONS = [{ id: 'mozzarino', name: 'Centurio Mozzarino', typ: 0, seltenheit: 4, bild: 'gm-mozzarino', event: 'rom',
    lore: 'Ein Legionär aus Pizzateig mit Käsehelm. Er hält die Reihe, bis der Mozzarella Fäden zieht.',
    rolle: wall.rolle, hp: wall.hp, ang: wall.ang, tempo: wall.tempo, faeh: wall.faeh, mono: wall.mono, spriteIndex: 1000, worldSize: 4.8 }];
  D.FAEHIGKEIT_FEST.mozzarino = 4;
  var katalogMon = D.mon;
  D.mon = function (id) { return katalogMon(id) || D.EVENT_MONS.find(function (k) { return k.id === id; }) || null; };
  /* Ein Mon ins Regal: neu, sonst wie ein Zwilling aus dem Ei - eine
     Runenstufe hoeher, auf der hoechsten fuenf Runen seiner Seltenheit. */
  ROM.monGeben = function (p, monId) {
    var mon = D.mon(monId);
    if (!mon) return null;
    if (p.besitz.indexOf(monId) < 0) { p.besitz.push(monId); return 'neu'; }
    p.monUpgrades = p.monUpgrades || {};
    var stufe = X.upgradeLevel(p.monUpgrades[monId]);
    if (stufe < X.UPGRADE_LIMIT) { p.monUpgrades[monId] = stufe + 1; return 'stufe'; }
    p.runes = p.runes || D.SELTENHEITEN.map(function () { return 0; });
    p.runes[mon.seltenheit] = Math.min(9999, (p.runes[mon.seltenheit] || 0) + X.UPGRADE_LIMIT);
    return 'runen';
  };

  /* ------------------------------------------ Titel und Bilanz */
  X.TITEL.push(
    { id: 'held_von_rom', name: 'Held von Rom', was: 'Rom-Events als Held beendet', ziel: 1, wert: function (p) { return (p.rom && p.rom.held) || 0; } },
    { id: 'mozzarella_bezwinger', name: 'Mozzarella-Bezwinger', was: 'Imperatore Mozzarellus besiegt', ziel: 1, wert: function (p) { return (p.rom && p.rom.boss) || 0; } }
  );
  E.BILANZ_REIN.rom = 'Rom-Event';

  /* ---------------------------------------------- Spielstand */
  function ganz(v, max) { var n = Math.floor(Number(v)); return Number.isFinite(n) && n > 0 ? Math.min(max, n) : 0; }
  var ERGEBNISSE = { ei: ['tasche', 'warte', 'gold'], mozzarino: ['neu', 'stufe', 'runen'] };
  function letztesSauber(l) {
    if (!l || typeof l !== 'object' || typeof l.ev !== 'string') return null;
    var runen = {};
    Object.keys(l.runen || {}).forEach(function (r) { var n = ganz(l.runen[r], 99); if (n && D.SELTENHEITEN[r]) runen[r] = n; });
    return { ev: l.ev.slice(0, 60), t: Number(l.t) || 0, lire: ganz(l.lire, ROM.LIRE_MAX), gold: ganz(l.gold, 100000), runen: runen,
      stufen: ROM.STUFEN.map(function (s) { return s.id; }).filter(function (id) { return (l.stufen || []).indexOf(id) >= 0; }),
      titel: ['held_von_rom', 'mozzarella_bezwinger'].filter(function (id) { return (l.titel || []).indexOf(id) >= 0; }),
      ei: ERGEBNISSE.ei.indexOf(l.ei) >= 0 ? l.ei : null, mozzarino: ERGEBNISSE.mozzarino.indexOf(l.mozzarino) >= 0 ? l.mozzarino : null,
      leiste: l.leiste === true, boss: l.boss === true, abgebrochen: l.abgebrochen === true, vorschau: l.vorschau === true };
  }
  var vorher = D.neuerStand;
  D.neuerStand = function (save, now) {
    var p = vorher(save, now), r = (save && save.rom) || {};
    p.rom = { held: ganz(r.held, 9999), boss: ganz(r.boss, 9999), letztes: letztesSauber(r.letztes) };
    return p;
  };
})(SG);
