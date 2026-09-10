/* Zusatztests fuer die restlichen Regel-Engines und die beiden Tycoons.
   Wird von tools/test.mjs eingebunden, sobald SG geladen ist. */

export function extraTests(SG, U, test) {
  /* --- Schach --- */
  const CH = SG.rules.chess;
  test('Schach: Perft 1-4 stimmt', () => {
    const expect = [1, 20, 400, 8902, 197281];
    for (let d = 1; d <= 4; d++) {
      const n = CH.perft(CH.create(), d);
      if (n !== expect[d]) throw new Error('Perft(' + d + ') = ' + n + ' statt ' + expect[d]);
    }
  });
  test('Schach: Matt in einem Zug wird gefunden', () => {
    const s = CH.create();
    s.b.fill(0);
    s.b[CH.sq(7, 0)] = -CH.K;
    s.b[CH.sq(1, 1)] = CH.Q;
    s.b[CH.sq(0, 7)] = CH.R;
    s.b[CH.sq(4, 7)] = CH.K;
    s.cast = { K: false, Q: false, k: false, q: false };
    s.turn = 1;
    const res = CH.searchDepth(s, 3, 200000, null);
    CH.make(s, res.move);
    if (CH.status(s) !== 'matt') throw new Error('spielte ' + CH.uciPlain(res.move));
  });

  /* --- Dame --- */
  const DA = SG.rules.checkers;
  test('Dame: Schlagzwang und Doppelschlag', () => {
    const t = DA.create('de');
    t.b.fill(0); t.b[5 * 8 + 2] = 1; t.b[4 * 8 + 3] = -1; t.turn = 1;
    const caps = DA.moves(t, 1);
    if (!caps.length || !caps[0].taken.length) throw new Error('kein Schlagzwang');
    if (caps.some((m) => !m.taken.length)) throw new Error('stille Züge trotz Schlagzwang');
    const d = DA.create('de');
    d.b.fill(0); d.b[6 * 8 + 1] = 1; d.b[5 * 8 + 2] = -1; d.b[3 * 8 + 4] = -1; d.turn = 1;
    const max = Math.max(...DA.moves(d, 1).map((m) => m.taken.length));
    if (max !== 2) throw new Error('Doppelschlag fehlt (' + max + ')');
  });
  test('Dame: 12 gegen 12 und sieben Eröffnungszüge', () => {
    const s = DA.create('de');
    let w = 0, b = 0;
    for (let i = 0; i < s.b.length; i++) { if (s.b[i] > 0) w++; else if (s.b[i] < 0) b++; }
    if (w !== 12 || b !== 12) throw new Error(w + '/' + b);
    if (DA.moves(s, 1).length !== 7) throw new Error('Eröffnungszüge');
  });

  /* --- Eins --- */
  const EI = SG.rules.eins;
  test('Eins: 40 Partien ohne Kartenverlust', () => {
    for (let r = 0; r < 40; r++) {
      const g = EI.newGame(20000 + r, 2 + (r % 5), { stacking: r % 2 === 0 });
      let guard = 0;
      while (!g.over && guard++ < 2000) {
        const rng = U.rng((g.seed + guard) >>> 0);
        const mv = EI.aiMove(g, g.turn, rng);
        if (mv) {
          if (!EI.play(g, g.turn, mv.card.id, mv.color)) throw new Error('unerlaubte Karte');
        } else EI.takeTurn(g, g.turn);
        let tot = g.draw.length + g.pile.length;
        for (let p = 0; p < g.players; p++) tot += g.hands[p].length;
        if (tot !== 108) throw new Error('Karten verloren: ' + tot);
      }
      if (!g.over) throw new Error('Partie ' + r + ' endet nicht');
    }
  });

  /* --- Rohre --- */
  const PI = SG.rules.pipes;
  test('Rohre: Netz gelöst, Fluss deckt das Feld ab', () => {
    for (let i = 0; i < 8; i++) {
      const net = PI.makeNet(U.rng(500 + i), 7, 7);
      if (!PI.netSolved(net.mask, 7, 7, net.source)) throw new Error('Netz nicht gelöst');
    }
    const f = PI.makeFlow(U.rng(99), 7, 7, 6);
    if (!f) throw new Error('kein Fluss-Rätsel');
    const cover = new Uint8Array(49);
    f.paths.forEach((p) => p.forEach((k) => {
      if (cover[k]) throw new Error('Zelle doppelt belegt');
      cover[k] = 1;
    }));
    for (let i = 0; i < 49; i++) if (!cover[i]) throw new Error('Lücke im Fluss-Rätsel');
  });

  /* --- Hafen-Tycoon --- */
  const PT = SG.tycoon.port.sim, PD = SG.tycoon.port.data;
  test('Hafen: Startkapital reicht für den Mindestaufbau', () => {
    const s = PT.create('nordhafen', 1);
    const min = PD.byId('quay').cost + PD.byId('crane1').cost
      + PD.byId('yard').cost + PD.byId('gate').cost;
    if (s.cash < min) throw new Error(Math.round(s.cash) + ' € < ' + min + ' €');
    if (PT.power(s).supply < PD.byId('crane1').power) throw new Error('erste Brücke ohne Strom');
  });
  test('Hafen: Schiff wird abgefertigt und bringt Geld', () => {
    const s = PT.create('nordhafen', 12345);
    PT.takeLoan(s, 1500000);
    PT.place(s, 'quay', 4, s.waterRows);
    PT.place(s, 'quay', 8, s.waterRows);
    PT.place(s, 'crane1', 5, s.waterRows);
    PT.place(s, 'yard', 4, s.waterRows + 3);
    PT.place(s, 'gate', 12, s.waterRows + 3);
    PT.buyVehicle(s, 'truck', 4);
    PT.hire(s, 'kran', 2); PT.hire(s, 'yard', 4);
    PT.spawnShip(s, U.rng(7), 'feeder');
    let guard = 0;
    while (s.stats.shipsDone < 1 && guard++ < 4000) PT.step(s, 0.1);
    if (s.stats.shipsDone < 1) throw new Error('kein Schiff fertig');
    if (s.ledger.tariff <= 0) throw new Error('keine Erlöse');
  });
  test('Hafen: Bauregeln und Abriss', () => {
    const s = PT.create('nordhafen', 5);
    PT.takeLoan(s, 2000000);
    if (PT.place(s, 'quay', 4, s.waterRows + 4) === null) throw new Error('Kaimauer an Land erlaubt');
    if (PT.place(s, 'quay', 4, s.waterRows)) throw new Error('Kaimauer geht nicht');
    if (PT.place(s, 'crane1', 5, s.waterRows)) throw new Error('Brücke geht nicht');
    const q = PT.list(s, 'quay')[0];
    PT.demolish(s, q);
    if (PT.buildingAt(s, q.x, q.y)) throw new Error('Abriss räumt das Feld nicht');
    if (PT.listKind(s, 'crane').length) throw new Error('Brücke bleibt ohne Kaimauer stehen');
  });
  test('Hafen: Speichern und Laden erhält den Stand', () => {
    const s = PT.create('nordhafen', 5);
    PT.takeLoan(s, 900000);
    PT.place(s, 'quay', 4, s.waterRows);
    PT.place(s, 'crane1', 5, s.waterRows);
    const back = PT.deserialize(JSON.parse(JSON.stringify(PT.serialize(s))));
    if (Math.round(back.cash) !== Math.round(s.cash)) throw new Error('Kasse');
    if (PT.list(back, 'quay').length !== 1) throw new Error('Kaimauer fehlt');
  });

  /* --- Agenten-Tycoon --- */
  const SP = SG.tycoon.spy.sim, SD = SG.tycoon.spy.data, SM = SG.tycoon.spy.mission;
  test('Agentur: Start, Bau und Forschung', () => {
    const s = SP.create(4242);
    if (s.agents.length !== 3) throw new Error('Startteam');
    const min = SD.roomById('labor').cost + Math.min(...SD.TECH.map((t) => t.cost));
    if (SD.ECON.start < min) throw new Error('Startkapital reicht nicht für Labor und Forschung');
    if (SP.build(s, 'labor', 0, 4, 0)) throw new Error('Labor lässt sich nicht bauen');
    if (SP.build(s, 'labor', 0, 4, 0) === null) throw new Error('Überlappender Bau erlaubt');
    if (SP.build(s, 'zentrale', 0, 0, 2) === null) throw new Error('zweite Zentrale erlaubt');
    if (SP.startResearch(s, 'maske')) throw new Error('Forschung startet nicht');
    for (let d = 0; d < 12; d++) SP.step(s, 12);
    if (s.tech.indexOf('maske') < 0) throw new Error('Forschung nicht fertig');
  });
  test('Agentur: Mission läuft vollständig durch', () => {
    const s = SP.create(777);
    const m = s.missions[0];
    const team = SP.available(s).slice(0, SD.missionType(m.type).team[0]);
    if (SP.startMission(s, m, team)) throw new Error('Start fehlgeschlagen');
    const run = s.active[0];
    let guard = 0;
    while (run.state === 'anreise' && guard++ < 400) SP.step(s, 1);
    guard = 0;
    while (run.state !== 'fertig' && guard++ < 30) {
      if (run.choicePending) SM.applyChoice(s, run, 0);
      else SM.step(s, run);
    }
    if (run.state !== 'fertig') throw new Error('Mission endet nicht');
    team.forEach((a) => { if (a.status === 'einsatz') throw new Error('Agent hängt fest'); });
    if (s.stats.missions !== 1) throw new Error('nicht gezählt');
    if (!run.summary) throw new Error('kein Bericht');
  });
  test('Agentur: 30 Missionen bleiben widerspruchsfrei', () => {
    const s = SP.create(31337);
    s.cash += 3000000;
    for (let i = 0; i < 30; i++) {
      SP.refreshMissions(s, U.rng(i + 1));
      const m = s.missions[0];
      if (!m) break;
      const team = SP.available(s).slice(0, SD.missionType(m.type).team[0]);
      if (!team.length) { SP.step(s, 12); continue; }
      if (SP.startMission(s, m, team)) { SP.step(s, 12); continue; }
      const run = s.active[s.active.length - 1];
      run.state = 'bereit';
      let guard = 0;
      while (run.state !== 'fertig' && guard++ < 30) {
        if (run.choicePending) SM.applyChoice(s, run, guard % 3);
        else SM.step(s, run);
      }
      if (run.state !== 'fertig') throw new Error('Mission ' + i + ' endet nicht');
      if (!isFinite(s.cash)) throw new Error('Kasse ungültig');
      s.agents.forEach((a) => {
        if (a.stress < 0 || a.stress > 100) throw new Error('Stress außerhalb des Bereichs');
        if (a.injury < 0 || a.injury > 100) throw new Error('Verletzung außerhalb des Bereichs');
      });
      SP.step(s, 12);
    }
  });
  test('Agentur: Speichern und Laden erhält den Stand', () => {
    const s = SP.create(9);
    SP.build(s, 'kantine', 0, 4, 0);
    const back = SP.deserialize(JSON.parse(JSON.stringify(SP.serialize(s))));
    if (back.rooms.length !== s.rooms.length) throw new Error('Räume');
    if (back.agents.length !== s.agents.length) throw new Error('Agenten');
    if (Math.round(back.cash) !== Math.round(s.cash)) throw new Error('Kasse');
  });

  /* --- Wirtschafts-Tycoon --- */
  const BZ = SG.tycoon.biz.sim, BD = SG.tycoon.biz.data;
  test('Wirtschaft: die erste Firma ist ertippbar', () => {
    const s = BZ.create(4242);
    if (BZ.ertragGesamt(s) !== 0) throw new Error('Startertrag ist nicht null');
    let tipps = 0;
    while (s.geld < BD.FIRMEN[0].kosten && tipps++ < 400) BZ.arbeiten(s);
    if (s.geld < BD.FIRMEN[0].kosten) throw new Error('nach 400 Tipps nicht bezahlbar');
    if (tipps > 40) throw new Error('zu zäh: ' + tipps + ' Tipps');
    if (BZ.firmaKaufen(s, 'zeitung', 1)) throw new Error('Kauf gescheitert');
    if (BZ.ertragGesamt(s) <= 0) throw new Error('Firma bringt nichts');
  });
  test('Wirtschaft: Meilenstein verdoppelt den Ertrag', () => {
    const s = BZ.create(1);
    s.geld = 1e9;
    BZ.firmaKaufen(s, 'zeitung', BD.MEILENSTEIN - 1);
    const vor = BZ.firmenErtrag(s, 'zeitung') / (BD.MEILENSTEIN - 1);
    BZ.firmaKaufen(s, 'zeitung', 1);
    const nach = BZ.firmenErtrag(s, 'zeitung') / BD.MEILENSTEIN;
    if (Math.abs(nach - vor * 2) > 1e-6) throw new Error('Ertrag je Stufe ' + vor + ' -> ' + nach);
  });
  test('Wirtschaft: Aktien erhalten den Wert beim Handeln', () => {
    const s = BZ.create(7);
    s.geld = 1000000;
    const vorher = s.geld + BZ.depotwert(s);
    if (BZ.aktieKaufen(s, 'nordbahn', 100)) throw new Error('Kauf gescheitert');
    const mitte = s.geld + BZ.depotwert(s);
    if (Math.abs(mitte - vorher) > 0.01) throw new Error('Kauf verändert das Vermögen');
    if (BZ.aktieVerkaufen(s, 'nordbahn', 100)) throw new Error('Verkauf gescheitert');
    if (Math.abs(s.geld - vorher) > 0.01) throw new Error('Verkauf verändert das Vermögen');
    if (BZ.aktieKaufen(s, 'nordbahn', 1e9) === null) throw new Error('Kauf ohne Deckung erlaubt');
  });
  test('Wirtschaft: Steuern kommen monatlich und lassen sich zahlen', () => {
    const s = BZ.create(9);
    s.geld = 2000000;
    BZ.firmaKaufen(s, 'zeitung', 30);
    for (let i = 0; i < BD.SEK_PRO_TAG * BD.TAGE_PRO_MONAT; i++) BZ.step(s, 1);
    if (s.steuerFaellig <= 0) throw new Error('kein Steuerbescheid nach einem Monat');
    const offen = s.steuerFaellig;
    if (BZ.steuerZahlen(s)) throw new Error('Zahlung gescheitert');
    if (s.steuerFaellig !== 0) throw new Error('nach der Zahlung immer noch offen');
    if (Math.round(s.stat.steuern) !== Math.round(offen)) throw new Error('Zahlung nicht gebucht');
    if (BD.steuersatz(500000, BD.MAX_RABATT) >= BD.steuersatz(500000, 0)) {
      throw new Error('Beratung senkt den Satz nicht');
    }
  });
  test('Wirtschaft: Ansehen und Rang hängen zusammen', () => {
    const s = BZ.create(3);
    s.geld = 1e12;
    const vorher = BZ.ansehen(s);
    BZ.luxusKaufen(s, 'uhr');
    if (BZ.ansehen(s) <= vorher) throw new Error('Luxus bringt kein Ansehen');
    // Geld allein reicht fuer die oberen Raenge nicht
    const nurGeld = BD.rang(1e10, 0).name;
    const mitAnsehen = BD.rang(1e10, 900).name;
    if (nurGeld === mitAnsehen) throw new Error('Ansehen spielt für den Rang keine Rolle');
  });
  test('Wirtschaft: Speichern und Laden erhält den Stand', () => {
    const s = BZ.create(5);
    s.geld = 500000;
    BZ.firmaKaufen(s, 'zeitung', 12);
    BZ.aktieKaufen(s, 'vesper', 40);
    BZ.immobilieKaufen(s, 'garage');
    for (let i = 0; i < 400; i++) BZ.step(s, 1);
    const back = BZ.deserialize(JSON.parse(JSON.stringify(BZ.serialize(s))));
    if (!back) throw new Error('Laden gescheitert');
    if (Math.round(back.geld) !== Math.round(s.geld)) throw new Error('Kasse');
    if (back.firmen.zeitung !== s.firmen.zeitung) throw new Error('Firmen');
    if (back.immobilien.garage !== s.immobilien.garage) throw new Error('Immobilien');
    if (Math.round(BZ.depotwert(back)) !== Math.round(BZ.depotwert(s))) throw new Error('Depot');
    if (back.tag !== s.tag) throw new Error('Datum');
  });

  /* --- Speicher unter file:// --- */
  test('Speicher: Spielstand-Code hin und zurück', () => {
    SG.storage.set('test:probe', { x: 42, s: 'Grüße' });
    const code = SG.storage.exportCode();
    SG.storage.del('test:probe');
    const r = SG.storage.importCode(code);
    if (!r.ok) throw new Error('Import abgelehnt');
    const back = SG.storage.get('test:probe');
    if (!back || back.x !== 42 || back.s !== 'Grüße') throw new Error('Daten stimmen nicht');
    if (SG.storage.importCode('kein code').ok) throw new Error('Müll wurde angenommen');
    SG.storage.del('test:probe');
  });

  /* --- W-Places & XP-Guthaben --- */
  test('W-Places: 2000x2000 Fläche, Raster und Palette', () => {
    const D = SG.welt.daten;
    if (D.BREITE !== 2000 || D.HOEHE !== 2000) throw new Error('Maße nicht 2000x2000');
    if (D.TAGESPIXEL !== 200) throw new Error('Tagespixel nicht 200');
    const n = D.nummer(1234, 567);
    if (n !== 567 * 2000 + 1234) throw new Error('Feldnummer falsch');
    if (D.zuX(n) !== 1234 || D.zuY(n) !== 567) throw new Error('Rückrechnung falsch');
    if (D.PALETTE.length < 32) throw new Error('Palette unvollständig');
    if (!D.farbe(8) || D.farbe(8).hex !== '#ed1c24') throw new Error('Palette fehlerhaft');
  });

  test('W-Places: XP-Guthaben ausgeben ohne Stufenverlust', () => {
    const F = SG.fortschritt;
    const vorXp = F.stand().xp;
    const vorStufe = F.stufe();
    F.geben(500, 'Test-Gutschrift');
    const guthaben = F.guthaben();
    if (guthaben < 500) throw new Error('Guthaben nicht gestiegen');
    const stufeNachXp = F.stufe();
    const geklappt = F.ausgeben(200, 'Testkauf');
    if (!geklappt) throw new Error('Ausgabe fehlgeschlagen');
    if (F.guthaben() !== guthaben - 200) throw new Error('Guthaben nicht um 200 gesunken');
    if (F.stufe() !== stufeNachXp) throw new Error('Stufe ist gesunken!');
  });

  test('W-Places: Pixelvorrat und Tageskontingent', () => {
    const P = SG.welt.ui;
    P.gutschreiben(100);
    const vor = P.uebrig();
    if (vor < 100) throw new Error('Vorrat zu klein: ' + vor);
    const ok = P.abziehen(5);
    if (!ok) throw new Error('Abzug fehlgeschlagen');
    if (P.uebrig() !== vor - 5) throw new Error('Restvorrat stimmt nicht: ' + P.uebrig());
  });

  /* --- GehstockMon ---
     Die Kampfmaschine ist deterministisch, also lassen sich nicht nur
     Abstuerze pruefen, sondern auch das Balancing. Feld 1 muss mit dem
     Startplan zu gewinnen sein, Feld 4 nicht - sonst hat das Feld seine
     Lehre verloren, ohne dass es jemandem auffiele. */
  const GM = SG.rules.gehstockmon;
  const GD = SG.gehstockmon.daten;

  test('GehstockMon: alle Felder rechnen sauber durch', () => {
    GD.FELDER.forEach((f) => {
      const e = GM.kaempfe(GD.KREATUREN, GD.START_PLAN, f.feinde);
      if (!e.schritte.length) throw new Error('Feld ' + f.id + ' ohne Schritte');
      if (['wir', 'sie', 'patt'].indexOf(e.sieger) < 0) throw new Error('Feld ' + f.id + ': ' + e.sieger);
      e.einheiten.forEach((u) => {
        if (typeof u.hp !== 'number' || Number.isNaN(u.hp)) throw new Error('NaN bei ' + u.name);
        if (u.hp < 0 || u.hp > u.maxHp) throw new Error('Leben ausserhalb: ' + u.name + ' ' + u.hp);
      });
    });
  });

  test('GehstockMon: gleicher Plan, gleiches Ergebnis', () => {
    const f = GD.FELDER[2];
    const a = GM.kaempfe(GD.KREATUREN, GD.START_PLAN, f.feinde);
    const b = GM.kaempfe(GD.KREATUREN, GD.START_PLAN, f.feinde);
    if (a.sieger !== b.sieger) throw new Error('Sieger schwankt');
    if (a.schritte.length !== b.schritte.length) throw new Error('Schrittzahl schwankt');
    for (let i = 0; i < a.schritte.length; i++) {
      if (a.schritte[i].text !== b.schritte[i].text) throw new Error('Schritt ' + i + ' weicht ab');
    }
  });

  test('GehstockMon: Feld 1 ist mit dem Startplan zu gewinnen', () => {
    const e = GM.kaempfe(GD.KREATUREN, GD.START_PLAN, GD.FELDER[0].feinde);
    if (e.sieger !== 'wir') throw new Error('Einstieg verloren: ' + e.sieger);
  });

  test('GehstockMon: Feld 2 bis 5 zwingen zum Umbauen', () => {
    /* Jedes Feld ab dem zweiten hat eine Lehre. Wenn der Startplan es
       gewinnt, ist die Lehre still verschwunden - genau das war beim
       ersten Bauen bei drei von fuenf Feldern der Fall. */
    [1, 2, 3, 4].forEach((i) => {
      const f = GD.FELDER[i];
      const e = GM.kaempfe(GD.KREATUREN, GD.START_PLAN, f.feinde);
      if (e.sieger === 'wir') throw new Error('Feld ' + f.id + ' (' + f.name + ') faellt schon mit dem Startplan');
    });
  });

  test('GehstockMon: Fähigkeiten haben eine Abklingzeit', () => {
    /* Ohne Pause heilen sich zwei Heiler endlos gegenseitig und jeder
       Kampf endet im Patt. Der Test haelt das fest. */
    const heiler = [{ id: 'h', name: 'Heiler', mono: 'h', hp: 100, ang: 5, tempo: 9, faeh: 'flicken' }];
    const plan = { h: [['immer', 'faehigkeit']] };
    const feind = [{ name: 'Stich', mono: 's', hp: 40, ang: 12, tempo: 1, faeh: 'flicken',
      plan: [['immer', 'vorderster']] }];
    const e = GM.kaempfe(heiler, plan, feind);
    const nichtBereit = e.schritte.filter((s) => s.text.indexOf('noch nicht bereit') >= 0);
    if (!nichtBereit.length) throw new Error('Abklingzeit greift nicht');
  });

  test('GehstockMon: Spott zieht Angriffe auf sich', () => {
    const wall = [{ id: 'a', name: 'Wall', mono: 'w', hp: 200, ang: 1, tempo: 9, faeh: 'spott' }];
    const plan = { a: [['immer', 'faehigkeit']] };
    const feind = [{ name: 'Hauer', mono: 'h', hp: 30, ang: 10, tempo: 1, faeh: 'spott',
      plan: [['immer', 'schwaechster']] }];
    const e = GM.kaempfe(wall, plan, feind);
    /* Nur eine Einheit auf unserer Seite: sie muss Schaden bekommen,
       das prueft, dass der Spott nicht die eigene Seite trifft. */
    const w = e.einheiten.find((u) => u.seite === 'wir');
    if (w.hp === w.maxHp) throw new Error('Wall blieb unberuehrt');
  });
}
