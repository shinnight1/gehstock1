/* Generated from the shared browser rules by build.mjs. */
const SG = { rules: {} };
/* ------------------------------------------------------------------
   GehstockMon - Werte, Faehigkeiten, Gegner, Felder.

   Alles, was man zum Ausprobieren verstellen will, steht hier. Die
   Kampfregeln liegen in 2-kampf.js (ohne DOM, damit tools/test.mjs sie
   pruefen kann), die Oberflaeche in 3-ui.js.
   ------------------------------------------------------------------ */

(function (SG) {
  var R = SG.gehstockmon = SG.gehstockmon || {};
  var D = R.daten = {};

  /* Reihenfolge ist zugleich die Reihenfolge beim Weiterblaettern im
     Planeditor. '(keine Regel)' steht vorn, damit eine leere Zeile der
     Ausgangszustand ist und man sich nichts erst wegklicken muss. */
  D.BEDINGUNGEN = [
    { id: 'aus',            text: '(keine Regel)' },
    { id: 'immer',          text: 'immer' },
    { id: 'ich_schwach',    text: 'ich unter 40 %' },
    { id: 'freund_schwach', text: 'Verbündeter unter 40 %' },
    { id: 'feind_schwach',  text: 'Gegner unter 40 %' },
    { id: 'runde_1',        text: 'in Runde 1' },
    { id: 'ueberzahl',      text: 'Gegner in Überzahl' }
  ];

  D.AKTIONEN = [
    { id: 'vorderster',   text: 'vordersten Gegner angreifen' },
    { id: 'schwaechster', text: 'schwächsten Gegner angreifen' },
    { id: 'staerkster',   text: 'stärksten Gegner angreifen' },
    { id: 'faehigkeit',   text: 'Fähigkeit einsetzen' },
    { id: 'verteidigen',  text: 'verteidigen' }
  ];

  /* Vier Faehigkeiten, geteilt von beiden Seiten. Dass die Gegner
     dieselben Werkzeuge haben wie du, ist Absicht: sonst lernt man beim
     Lesen ihres Plans nichts ueber den eigenen. */
  D.FAEHIGKEITEN = {
    spott:      { name: 'Spott',      text: 'Zieht bis zum nächsten eigenen Zug alle Angriffe auf sich. Nur ein gezielter Schlag auf den Stärksten geht daran vorbei.' },
    hinrichten: { name: 'Hinrichten', text: 'Greift den schwächsten Gegner an. Doppelter Schaden, wenn der unter 40 % steht.' },
    flicken:    { name: 'Flicken',    text: 'Heilt dem am stärksten verletzten Verbündeten 32 Leben.' },
    stoeren:    { name: 'Stören',     text: 'Der stärkste Gegner richtet bei seinem nächsten Zug nur halben Schaden an.' }
  };

  /* Deine vier Kreaturen. mono ist der Platzhalter im Portraitfeld -
     sobald echte Bilder da sind, kommt statt dessen ein Emoji oder ein
     gezeichnetes Wappen hinein, der Aufbau bleibt gleich.

     Die Werte liegen absichtlich weit auseinander. Vier Kreaturen, die
     sich aehnlich spielen, machen jeden Plan austauschbar. */
  D.KREATUREN = [
    { id: 'bollwerk', name: 'Bollwerk', rolle: 'Wall',     mono: '🛡', hp: 130, ang:  8, tempo:  3, faeh: 'spott' },
    { id: 'klinge',   name: 'Klinge',   rolle: 'Schneide', mono: '⚔', hp:  62, ang: 23, tempo:  8, faeh: 'hinrichten' },
    { id: 'waerter',  name: 'Wärter',   rolle: 'Erhalt',   mono: '✚', hp:  86, ang:  7, tempo:  5, faeh: 'flicken' },
    { id: 'spaeher',  name: 'Späher',   rolle: 'Störung',  mono: '👁', hp:  70, ang: 13, tempo: 11, faeh: 'stoeren' }
  ];

  /* Startplan. Bewusst brauchbar, aber nicht optimal: Feld 1 gewinnt man
     damit, Feld 3 nicht mehr. Genau da soll das Basteln anfangen. */
  D.START_PLAN = {
    bollwerk: [ ['runde_1', 'faehigkeit'],        ['immer', 'vorderster'], ['aus', 'vorderster'] ],
    klinge:   [ ['feind_schwach', 'faehigkeit'],  ['immer', 'vorderster'], ['aus', 'vorderster'] ],
    waerter:  [ ['freund_schwach', 'faehigkeit'], ['immer', 'vorderster'], ['aus', 'vorderster'] ],
    spaeher:  [ ['immer', 'vorderster'],          ['aus', 'vorderster'],   ['aus', 'vorderster'] ]
  };

  D.SELTENHEITEN = [
    { name: 'Gewöhnlich', farbe: '#b8c5bc', rang: 1, text: 'Steinpanzer · geschnitzter Gehstock' },
    { name: 'Selten', farbe: '#50b8ff', rang: 2, text: 'Glutklingen · leuchtende Runen' },
    { name: 'Episch', farbe: '#c38bff', rang: 3, text: 'Kristallkrone · schwebende Magie' },
    { name: 'Legendär', farbe: '#ffca68', rang: 4, text: 'Goldrüstung · Drachenschwingen · Flammenaura' }
  ];
  D.KREATUREN.forEach(function (k, i) {
    k.seltenheit = i;
    k.bild = 'gm-' + k.id;
  });

  /* Die fuenf Felder. Jedes ist eine Aufgabe mit genau einer Lehre, und
     die Lehre steht im Klartext dabei - im Prototyp will man wissen,
     woran man gerade scheitert, nicht raten.

     Der gegnerische Plan liegt offen. Das ist der Kern des Spiels und
     keine Bequemlichkeit: du sollst seine Denkweise lesen, nicht seine
     Truppenstaerke. */
  D.FELDER = [
    {
      id: 1, name: 'Grenzstein',
      lehre: 'Der Kampf läuft ohne dich. Schau erst einmal zu.',
      feinde: [
        { name: 'Streuner', mono: '🐀', hp: 52, ang: 11, tempo: 6, faeh: 'stoeren',
          plan: [ ['immer', 'vorderster'] ] },
        { name: 'Streuner', mono: '🐀', hp: 52, ang: 11, tempo: 5, faeh: 'stoeren',
          plan: [ ['immer', 'vorderster'] ] }
      ]
    },
    {
      id: 2, name: 'Alte Furt',
      lehre: 'Zwei Pfleger halten die Reihe. Nimm sie zuerst heraus.',
      feinde: [
        { name: 'Balg',    mono: '🦎', hp: 120, ang: 19, tempo: 6, faeh: 'spott',
          plan: [ ['immer', 'vorderster'] ] },
        { name: 'Balg',    mono: '🦎', hp: 120, ang: 19, tempo: 5, faeh: 'spott',
          plan: [ ['immer', 'vorderster'] ] },
        { name: 'Pfleger', mono: '🌿', hp: 44, ang:  5, tempo: 7, faeh: 'flicken',
          plan: [ ['immer', 'faehigkeit'] ] },
        { name: 'Pfleger', mono: '🌿', hp: 44, ang:  5, tempo: 6, faeh: 'flicken',
          plan: [ ['immer', 'faehigkeit'] ] }
      ]
    },
    {
      id: 3, name: 'Schieferbruch',
      lehre: 'Einer schlägt härter als der Rest zusammen. Nimm ihm die Wucht.',
      feinde: [
        { name: 'Brecher',  mono: '🏹', hp: 105, ang: 46, tempo: 10, faeh: 'hinrichten',
          plan: [ ['immer', 'schwaechster'] ] },
        { name: 'Splitter', mono: '🪨', hp:  46, ang: 13, tempo:  8, faeh: 'hinrichten',
          plan: [ ['immer', 'schwaechster'] ] },
        { name: 'Splitter', mono: '🪨', hp:  46, ang: 13, tempo:  7, faeh: 'hinrichten',
          plan: [ ['immer', 'schwaechster'] ] }
      ]
    },
    {
      id: 4, name: 'Nebelsenke',
      lehre: 'Ihr Wall fängt alles ab. Schlag nach dem, was dahinter steht.',
      feinde: [
        { name: 'Bastion', mono: '🗿', hp: 230, ang:  6, tempo: 4, faeh: 'spott',
          plan: [ ['immer', 'faehigkeit'] ] },
        { name: 'Dorn',    mono: '🌵', hp:  58, ang: 24, tempo: 9, faeh: 'hinrichten',
          plan: [ ['feind_schwach', 'faehigkeit'], ['immer', 'schwaechster'] ] },
        { name: 'Dorn',    mono: '🌵', hp:  58, ang: 22, tempo: 8, faeh: 'hinrichten',
          plan: [ ['immer', 'schwaechster'] ] }
      ]
    },
    {
      id: 5, name: 'Der Horst',
      lehre: 'Ihr Plan steht offen da. Lies ihn, bevor du angreifst.',
      feinde: [
        { name: 'Warte',   mono: '🏚', hp:  84, ang: 12, tempo:  4, faeh: 'spott',
          plan: [ ['runde_1', 'faehigkeit'], ['ich_schwach', 'verteidigen'], ['immer', 'vorderster'] ] },
        { name: 'Sichel',  mono: '🦂', hp:  42, ang: 31, tempo: 12, faeh: 'hinrichten',
          plan: [ ['feind_schwach', 'faehigkeit'], ['immer', 'schwaechster'] ] },
        { name: 'Ätzer',   mono: '🦟', hp:  46, ang: 20, tempo: 10, faeh: 'stoeren',
          plan: [ ['runde_1', 'faehigkeit'], ['immer', 'staerkster'] ] },
        { name: 'Pfleger', mono: '🌿', hp:  35, ang:  7, tempo:  7, faeh: 'flicken',
          plan: [ ['freund_schwach', 'faehigkeit'], ['immer', 'vorderster'] ] }
      ]
    }
  ];
})(SG);

/* 57 eigenstaendige Mons, vier taktische Rollen. Seltenheit ist sichtbar,
   ersetzt aber keinen guten Plan. Bestehende Startwerte bleiben erhalten. */
(function (SG) {
  var D = SG.gehstockmon.daten;
  var extra = [
    ['moosling', 'Moosling', 0, 0, 'mossling', 'Ein Waldgeist mit einem Gehstock aus lebenden Wurzeln.'],
    ['glutfuchs', 'Glutfuchs', 1, 0, 'emberling', 'Sein Schweif glimmt noch lange nach dem letzten Schlag.'],
    ['nebelmolch', 'Nebelmolch', 2, 0, 'mistling', 'Sammelt heilenden Tau in seinem gewellten Gehstock.'],
    ['kieselkrabb', 'Kieselkrabb', 0, 0, 'kieselkrabb', 'Ein kleiner Fels mit Scheren und erstaunlich großer Geduld.'],
    ['wurzelzahn', 'Wurzelzahn', 1, 0, 'wurzelzahn', 'Pflügt durch die feindliche Reihe wie durch Waldboden.'],
    ['pilzhueter', 'Pilzhüter', 2, 0, 'pilzhueter', 'Seine Sporen flicken Risse in Haut und Stein.'],
    ['rostknirps', 'Rostknirps', 3, 0, 'rostknirps', 'Ein Klopfen mit dem Eisenstock bringt jeden Plan durcheinander.'],
    ['nachtflatter', 'Nachtflatter', 3, 0, 'nachtflatter', 'Hört die Schwachstelle, bevor der Gegner sie kennt.'],
    ['sumpfschnapper', 'Sumpfschnapper', 0, 1, 'sumpfschnapper', 'Korallenharter Panzer, ein Lächeln voller Zähne.'],
    ['donnerwidder', 'Donnerwidder', 1, 1, 'donnerwidder', 'Zwischen seinen Hörnern wartet ein Gewitter.'],
    ['frostklaue', 'Frostklaue', 1, 1, 'frostklaue', 'Die Kälte ihrer Klauen durchdringt jede Deckung.'],
    ['dornenwolf', 'Dornenwolf', 1, 1, 'dornenwolf', 'Jede Dorne trägt die Erinnerung an einen gewonnenen Kampf.'],
    ['kupferskorp', 'Kupferskorp', 0, 1, 'kupferskorp', 'Sieben Panzerplatten, keine offene Flanke.'],
    ['obsidianrabe', 'Obsidianrabe', 3, 1, 'obsidianrabe', 'Schwarzes Glas und ein Blick, der jede Absicht durchschaut.'],
    ['korallenwacht', 'Korallenwacht', 2, 1, 'korallenwacht', 'Ein wandelndes Riff, das seine Verbündeten beschützt.'],
    ['runengolem', 'Runengolem', 0, 2, 'runengolem', 'Uralte Runen halten seine schwebenden Steinplatten zusammen.'],
    ['mondhexe', 'Mondhexe', 2, 2, 'mondhexe', 'Webt im Mondlicht neue Kraft in ihre Truppe.'],
    ['aschenhydra', 'Aschenhydra', 1, 2, 'aschenhydra', 'Drei Köpfe. Eine Absicht. Kein sicherer Rückzug.'],
    ['sturmhorn', 'Sturmhorn', 0, 2, 'sturmhorn', 'Ein lebender Sturm hinter einer Wand aus Kristall.'],
    ['seelenqualle', 'Seelenqualle', 2, 2, 'seelenqualle', 'Ihr Licht führt verlorene Lebensenergie zurück.'],
    ['kristallspinne', 'Kristallspinne', 3, 2, 'kristallspinne', 'Spannt unsichtbare Fäden um die stärksten Gegner.'],
    ['sonnenkoenig', 'Sonnenkönig', 1, 3, 'sonnenkoenig', 'Sein Gehstock trägt das Feuer einer untergegangenen Sonne.'],
    ['leerenwyrm', 'Leerenwyrm', 3, 3, 'leerenwyrm', 'Zwischen seinen Schuppen verschwindet selbst das Licht.'],
    ['titanenkrone', 'Titanenkrone', 0, 3, 'titanenkrone', 'Ein Gebirge, das beschlossen hat, zurückzuschlagen.'],
    ['sternengeweih', 'Sternengeweih', 2, 3, 'sternengeweih', 'In seinem Geweih wachsen neue Sternbilder.'],
    ['weltenfresser', 'Weltenfresser', 1, 3, 'weltenfresser', 'Unter seiner Goldrüstung brennt das Herz eines Vulkans.'],
    ['blattschleicher','Blattschleicher',3,0,'blattschleicher','Zwischen zwei Blättern wartet ein kleiner Trickser.'],
    ['tauhupfer','Tauhupfer',2,0,'tauhupfer','Ein winziger Sprung bringt frische Lebenskraft.'],
    ['duenenschakal','Dünenschakal',1,1,'duenenschakal','Jagt im Windschatten der goldenen Dünen.'],
    ['bernsteinkaefer','Bernsteinkäfer',0,1,'bernsteinkaefer','Sein Panzer bewahrt das Licht vergangener Sommer.'],
    ['gewittergreif','Gewittergreif',1,2,'gewittergreif','Jeder Flügelschlag lässt den Himmel erzittern.'],
    ['frostorakel','Frostorakel',2,2,'frostorakel','Sieht im ewigen Eis den nächsten Lebensfunken.'],
    ['grabesritter','Grabesritter',0,3,'grabesritter','Eine vergessene Krone führte ihn aus dem Grab zurück.'],
    ['vulkanmantis','Vulkanmantis',1,3,'vulkanmantis','Ihre glühenden Sicheln schneiden durch Basalt.'],
    ['aetherdrache','Ätherdrache',1,4,'aetherdrache','Seine Schwingen tragen das Gewicht zerbrochener Sterne.'],
    ['chronoschreiter','Chronoschreiter',3,4,'chronoschreiter','Wo sein Stock aufsetzt, verliert die Zeit ihre Richtung.'],
    ['endrichter','Endrichter',0,5,'endrichter','Unter seiner Krone zerbrechen Welten. Sein Urteil lässt selbst Götter verstummen.'],
    ['nullwyrm','Nullwyrm',1,5,'nullwyrm','Er verschlingt das letzte Licht. Hinter seinen Schwingen bleibt keine Wirklichkeit.']
  ];
  D.SELTENHEITEN.push({name:'Mythisch',farbe:'#66f5df',rang:5,text:'Sternenrunen · gebrochene Zeit'}, {name:'Apokalyptisch',farbe:'#ff426f',rang:6,text:'Weltenuntergang · kosmische Vernichtung'});
  D.KATALOG = D.KREATUREN.map(function (k, i) { var c = Object.assign({}, k); c.typ = i; c.lore = D.SELTENHEITEN[i].text; return c; });
  extra.forEach(function (v) {
    var basis = D.KREATUREN[v[2]];
    D.KATALOG.push({ id: v[0], name: v[1], typ: v[2], seltenheit: v[3], bild: 'gm-' + v[4], lore: v[5], rolle: basis.rolle, hp: basis.hp, ang: basis.ang, tempo: basis.tempo, faeh: basis.faeh, mono: basis.mono });
  });
  // IDs bleiben stabil: gespeicherte Sammlungen behalten alle Mons.
  D.SELTENHEITEN.splice(2,0,{name:'Außergewöhnlich',farbe:'#69dcad',rang:3,text:'Erwachte Naturkraft · seltene Mutationen'});
  D.SELTENHEITEN.forEach(function(r,i){r.rang=i+1;});
  D.KATALOG.forEach(function(k){if(k.seltenheit>=2)k.seltenheit++;if(['donnerwidder','frostklaue','dornenwolf','obsidianrabe','korallenwacht','duenenschakal','bernsteinkaefer'].indexOf(k.id)>=0)k.seltenheit=2;});
  /* Neue Mons kommen nach dem Seltenheits-Shift mit ihren finalen Rängen
     hinein. Damit bleiben alle alten gespeicherten IDs und Raritäten stabil. */
  [
    ['blitzotter','Blitzotter',1,1,'blitzotter','Ein Stromstoß aus seinen Schnurrhaaren lässt selbst Rüstung beben.'],
    ['mondluchs','Mondluchs',3,1,'mondluchs','Folgt nur Pfaden, die im Mondlicht sichtbar werden.'],
    ['salzkrabbe','Salzkrabbe',0,1,'salzkrabbe','Ihr Kristallpanzer bricht Wellen und Angriffe gleichermaßen.'],
    ['sporenbison','Sporenbison',0,2,'sporenbison','In seiner Mähne leuchten Pilze, die alte Wunden schließen.'],
    ['prismensalamander','Prismensalamander',2,2,'prismensalamander','Sein Kristallrücken teilt Licht in heilende Farben.'],
    ['nebelkrake','Nebelkrake',2,2,'nebelkrake','Schwebt durch jeden Spalt und lässt den Gegner ins Leere greifen.'],
    ['stahlkolibri','Stahlkolibri',3,2,'stahlkolibri','Seine Flügel schlagen schneller als ein gezogener Plan.'],
    ['glutbasilisk','Glutbasilisk',1,3,'glutbasilisk','Unter seinen Schuppen glimmt ein Herd aus uraltem Feuer.'],
    ['runenminotaur','Runenminotaur',0,3,'runenminotaur','Jede eingeritzte Rune macht ihn schwerer aufzuhalten.'],
    ['frostmanta','Frostmanta',3,3,'frostmanta','Gleitet auf eisigen Strömungen über jede Gefahr hinweg.'],
    ['aurorabaer','Aurorabär',0,4,'aurorabaer','Sein Fell trägt das Nordlicht und sein Brüllen schützt die Truppe.'],
    ['obsidianbehemoth','Obsidianbehemoth',1,4,'obsidianbehemoth','Ein Schritt von ihm lässt selbst Basalt erzittern.'],
    ['novaorakel','Novaorakel',2,5,'novaorakel','Ein sechsäugiger Sternenwolf, dessen Geweih den Untergang vorhersagt.'],
    ['zeitphoenix','Zeitphönix',3,5,'zeitphoenix','Der Donneradler reißt Sekunden aus dem Kampf und lässt nur Asche zurück.'],
    ['risskaiser','Risskaiser',0,6,'risskaiser','Ein urzeitlicher Weltzerstörer; Mauern und Berge zerbrechen unter seinem Brüllen.']
  ].forEach(function(v){var basis=D.KREATUREN[v[2]];D.KATALOG.push({id:v[0],name:v[1],typ:v[2],seltenheit:v[3],bild:'gm-'+v[4],lore:v[5],rolle:basis.rolle,hp:basis.hp,ang:basis.ang,tempo:basis.tempo,faeh:basis.faeh,mono:basis.mono});});
  /* Der Spaeher ist breiter als hoch und fuellt seine hochkantige Atlaszelle
     nur zu gut sechzig Prozent. Ohne den groesseren Wert liefe er als
     Zwerg ueber die Insel; 4.4 bringt ihn auf dieselbe Hoehe wie vorher und
     laesst die Fluegel zu ihrer Breite kommen. */
  D.MON_SIZES=[3.8,3.2,3.4,4.4,1.25,1.55,1.2,1.25,2.1,1.7,1.2,1.2,3.4,3.1,2.8,2.6,1.6,1.5,3.2,4.6,3.6,5,4.6,2.4,2.1,4.6,5.5,5.8,4.3,5.5,1.2,1,2.6,1.7,4.5,3.5,3.9,3.8,5.8,4.2,6.8,7.5,2.4,2.8,2.7,4.8,3.1,3.4,1.9,4.6,5.7,4.4,6.4,6.8,7.1,7.3,10.5];
  /* Drei Mons haben ein eigenes Schaubild mit Hintergrund. Es steht nur in
     der Sammlung; auf der Insel laufen weiterhin die freigestellten Bilder,
     sonst traegt der Begleiter eine Landschaft mit sich herum. */
  /* Welche der drei Faehigkeiten seiner Rolle ein Mon beherrscht. Grundregel
     ist die Position im Katalog - der waechst nur hinten, also bleibt jede
     Zuordnung ueber Spielstaende hinweg stehen. Wo die Lore etwas anderes
     verlangt, steht es in der Tabelle darunter. */
  D.FAEHIGKEIT_FEST={
    bollwerk:0,klinge:0,waerter:0,spaeher:0,
    moosling:0,glutfuchs:0,nebelmolch:0,rostknirps:0,
    kieselkrabb:1,titanenkrone:1,runengolem:1,salzkrabbe:1,
    wurzelzahn:2,dornenwolf:2,kupferskorp:2,sporenbison:2,runenminotaur:2,risskaiser:2,
    aschenhydra:1,vulkanmantis:1,obsidianbehemoth:1,
    weltenfresser:2,sonnenkoenig:2,glutbasilisk:2,blitzotter:2,
    pilzhueter:1,seelenqualle:1,korallenwacht:1,prismensalamander:1,
    mondhexe:2,sternengeweih:2,frostorakel:2,novaorakel:2,nebelkrake:2,
    nachtflatter:1,kristallspinne:1,obsidianrabe:1,stahlkolibri:1,
    leerenwyrm:2,chronoschreiter:2,zeitphoenix:2,frostmanta:2,mondluchs:2
  };
  /* Die zehn neuen Faehigkeiten (ab Index 3, 27.09.2026). Getragen vor allem
     von Mons, die ihre alte nur ueber die Katalogposition hatten, und von
     Schneiden - vorher trugen zehn von siebzehn den Aderlass. Jede neue gibt es
     in mehreren Seltenheiten, weil sie mit ihr waechst. Starter und der
     Einsteiger-Trainer (blattschleicher) behalten ihre gewohnte. */
  Object.assign(D.FAEHIGKEIT_FEST,{
    bernsteinkaefer:3,sturmhorn:3,aurorabaer:3, sumpfschnapper:4,grabesritter:4,endrichter:4,
    donnerwidder:3,gewittergreif:3,aetherdrache:3, frostklaue:4,glutbasilisk:4, duenenschakal:5,weltenfresser:5,nullwyrm:5,
    tauhupfer:3,korallenwacht:3, seelenqualle:4,novaorakel:4,
    mondluchs:3,kristallspinne:3, stahlkolibri:4,chronoschreiter:4,zeitphoenix:4, obsidianrabe:5,leerenwyrm:5
  });
  D.faehigkeitVon=function(mon){
    if(!mon)return 0;
    var fest=D.FAEHIGKEIT_FEST[mon.id];
    return Number.isFinite(fest)?fest:Math.max(0,Math.floor(mon.spriteIndex||0))%3;
  };
  /* Der Welt-Atlas gm-mons-atlas.webp traegt 6 x 7 eigens freigestellte
     Grafiken - die ersten 42 Mons. Wer dahinter steht, hat keine Zelle mehr
     und laeuft mit seinem Einzelbild ueber die Insel. */
  D.ATLAS_MONS=42;
  D.VORSCHAUEN=['novaorakel','zeitphoenix','risskaiser'];
  D.KATALOG.forEach(function(k,i){k.spriteIndex=i;k.worldSize=D.MON_SIZES[i];
    if(D.VORSCHAUEN.indexOf(k.id)>=0)k.vorschau=k.bild+'-vorschau';});
  D.mon = function (id) { return D.KATALOG.find(function (k) { return k.id === id; }) || null; };
  D.STARTER = ['moosling','glutfuchs','nebelmolch','rostknirps'];
  D.neuerStand = function (save) {
    var collection=save&&Array.isArray(save.besitz)?Array.from(new Set(save.besitz.filter(function(id){return !!D.mon(id);} ))):[];
    D.STARTER.forEach(function(id){if(collection.length<4&&collection.indexOf(id)<0)collection.push(id);});
    /* Die Kampfplaene stehen in 1-zusatz.js: sie richten sich nach den
       Bausteinen der Arena, und die ist hier noch nicht geladen. */
    var st = { plaene: {}, geschafft: [], besitz: collection, truppe: collection.slice(0,4), essenz: 60, siege: 0, beschwoerungen: 0 };
    if (!save || typeof save !== 'object') return st;
    if (Array.isArray(save.geschafft)) st.geschafft = D.FELDER.map(function (f) { return f.id; }).filter(function (id) { return save.geschafft.indexOf(id) >= 0; });
    if (Array.isArray(save.besitz)) save.besitz.forEach(function (id) { if (D.mon(id) && st.besitz.indexOf(id) < 0) st.besitz.push(id); });
    if (Array.isArray(save.truppe) && save.truppe.length === 4 && new Set(save.truppe).size === 4 && save.truppe.every(function (id) { return st.besitz.indexOf(id) >= 0; })) st.truppe = save.truppe.slice();
    ['essenz', 'siege', 'beschwoerungen'].forEach(function (key) { if (Number.isFinite(save[key]) && save[key] >= 0) st[key] = Math.min(10000000, Math.floor(save[key])); });
    return st;
  };
  D.beschwoere = function (st, random) {
    if (st.essenz < 60) return null;
    var pool = D.KATALOG.filter(function (k) { return st.besitz.indexOf(k.id) < 0; });
    if (!pool.length) return null;
    var weights = [8, 5, 3.8, 3, 1, .25, .05], total = pool.reduce(function (sum, k) { return sum + weights[k.seltenheit]; }, 0);
    var pick = Math.max(0, Math.min(0.9999999, Number.isFinite(random) ? random : Math.random())) * total;
    var chosen = pool[pool.length - 1];
    for (var i = 0; i < pool.length; i++) { pick -= weights[pool[i].seltenheit]; if (pick < 0) { chosen = pool[i]; break; } }
    st.essenz -= 60; st.besitz.push(chosen.id); st.beschwoerungen++; return chosen;
  };
})(SG);

/* Eine große Insel mit genau einer Festung je Biom. */
(function (SG) {
  var D = SG.gehstockmon.daten;
  D.MAP_VERSION = 5;
  D.WORLD = {halfWidth:280,halfDepth:250,bridgeZ:[-210,-115,-20,80,205],
    coast:[[-265,-185],[-223,-235],[-128,-223],[-65,-245],[42,-231],[122,-238],[209,-202],[267,-129],[251,-50],[278,32],[260,128],[219,200],[128,232],[46,216],[-45,242],[-133,216],[-231,190],[-270,112],[-252,21],[-278,-70]]};
  D.BIOME = [
    { x:-158,z:95,farbe:'#547d4b',dach:'#a24e34',biom:'Mooswacht',terrain:'Smaragdwald' },
    { x:166,z:150,farbe:'#3e7772',dach:'#497f92',biom:'Flüsterufer',terrain:'Flussland' },
    { x:183,z:10,farbe:'#796452',dach:'#a95037',biom:'Aschenklippen',terrain:'Vulkanland' },
    { x:-43,z:-84,farbe:'#586584',dach:'#65518c',biom:'Nebelwald',terrain:'Geisterwald' },
    { x:-178,z:-148,farbe:'#a6bbb9',dach:'#b98841',biom:'Frostkrone',terrain:'Schneegebirge' },
    { x:-65,z:120,farbe:'#8aa653',dach:'#cda95c',biom:'Tauwiese',terrain:'Blütenauen',difficulty:'Einsteiger' },
    { x:162,z:-153,farbe:'#ba8d5c',dach:'#9d4940',biom:'Sonnengrab',terrain:'Bernsteinwüste',difficulty:'Sehr schwer' },
    { x:-186,z:-28,farbe:'#675780',dach:'#779aba',biom:'Donnergrat',terrain:'Sturmheide',difficulty:'Extrem' },
    { x:2,z:-187,farbe:'#452d4e',dach:'#c64e74',biom:'Weltenschlund',terrain:'Leerenbruch',difficulty:'Endspiel' }
  ];
  D.FELDER=D.FELDER.slice(0,5);
  var LEHREN={5:'Ein sicherer erster Schritt.',
    6:'Vier Legendäre, und einer heilt sie alle. Nimm den Pfleger zuerst.',
    7:'Baue eine starke Truppe auf.',8:'Baue eine starke Truppe auf.'};
  for(var i=5;i<9;i++)D.FELDER.push({id:i+1,feinde:JSON.parse(JSON.stringify(D.FELDER[i===5?0:4].feinde)),lehre:LEHREN[i]});
  D.FELDER.forEach(function(f,i){f.name=D.BIOME[i].biom;f.biom=D.BIOME[i].terrain;f.difficulty=D.BIOME[i].difficulty||['Leicht','Mittel','Mittel','Schwer','Schwer'][i];});
})(SG);

/* Gemeinsame, zeitbasierte Regeln für lokale Kampagne und Server. */
(function (SG) {
  var D = SG.gehstockmon.daten, E = SG.gehstockmon.wirtschaft = {};
  E.HOUR = 3600000; E.EGG_TIME = 2 * E.HOUR; E.HATCH_TIME = E.HOUR;
  E.DAILY_GOLD = 150;
  E.STOCK_LIMIT = 3; E.BAG_LIMIT = 12; E.INCUBATORS = 3;
  /* Der Ausbau braucht seit der Warenwirtschaft (27.09.2026) auch Rohstoffe:
     Holz fuer den Wachtposten, Erz und Kristall fuer die Festung. */
  E.LEVELS = [null,
    { name: 'Lager', income: 20, bonus: 0, cost: 120, rohstoffe: { holz: 6 } },
    { name: 'Wachtposten', income: 35, bonus: 0.12, cost: 300, rohstoffe: { erz: 6, kristall: 4 } },
    { name: 'Festung', income: 55, bonus: 0.25, cost: null }
  ];
  function number(v, fallback) { return Number.isFinite(v) && v >= 0 ? v : fallback; }
  /* ------------------------------------------------------------------
     Warenwirtschaft (27.09.2026): drei Rohstoffe, jeder aus drei Biomen,
     damit ihn nie ein einzelner Gebietsbesitzer allein in der Hand hat
     (Codex: sonst wird ein Pflichtrohstoff zum Vetorecht). Jeder
     Aussenposten foerdert den seines Bioms - eine Einheit je geoeffnete
     Stunde, hoechstens vier liegen bereit, abgeholt wird mit den Eiern.
     ------------------------------------------------------------------ */
  E.ROHSTOFFE = [
    { id: 'holz', name: 'Holz', gebiete: [1, 4, 6] },
    { id: 'erz', name: 'Erz', gebiete: [3, 5, 8] },
    { id: 'kristall', name: 'Kristall', gebiete: [2, 7, 9] }
  ];
  E.ROHSTOFF_ZEIT = E.HOUR; E.ROHSTOFF_VORRAT = 4; E.LAGER_MAX = 999;
  E.rohstoff = function (id) { return E.ROHSTOFFE.find(function (r) { return r.id === id; }) || null; };
  E.rohstoffVon = function (gebietId) { return E.ROHSTOFFE.find(function (r) { return r.gebiete.indexOf(gebietId) >= 0; }) || E.ROHSTOFFE[0]; };
  E.lagerSauber = function (v) {
    var out = {};
    E.ROHSTOFFE.forEach(function (r) { var n = Math.floor(Number(v && v[r.id])); out[r.id] = Number.isFinite(n) && n > 0 ? Math.min(E.LAGER_MAX, n) : 0; });
    return out;
  };
  E.einlagern = function (st, id, menge) {
    st.lager = st.lager || E.lagerSauber(null);
    var vorher = st.lager[id] || 0; st.lager[id] = Math.max(0, Math.min(E.LAGER_MAX, vorher + Math.floor(menge)));
    return st.lager[id] - vorher;
  };
  /* Fehlt etwas fuer diese Kosten? Zurueck kommt ein Satz, sonst null. */
  E.rohstoffeFehlen = function (st, kosten) {
    var fehlt = [];
    Object.keys(kosten || {}).forEach(function (id) { var n = kosten[id] - ((st.lager && st.lager[id]) || 0); if (n > 0) fehlt.push(n + ' ' + E.rohstoff(id).name); });
    return fehlt.length ? 'Dir fehlen noch ' + fehlt.join(' und ') + '.' : null;
  };
  /* ------------------------------------------------------------------
     Wochenbilanz (27.09.2026)

     Jeder sieht fuer die laufende Woche, woher sein Gold kam und wofuer es
     ging, getrennt nach Quelle. Gebucht wird dort, wo sich das Gold bewegt
     (E.buchen). Was nur vermerkt wird, weil es nie auf dem eigenen Konto
     ankommt - die Gebietsabgabe -, geht ueber E.vermerken. Die Vorwoche
     bleibt stehen, damit man montags vergleichen kann. Die Woche springt
     montags um, wie beim Zerhacker.
     ------------------------------------------------------------------ */
  E.BILANZ_REIN = { gebiete: 'Gebiete', tagesgeld: 'Tagesgeld', sold: 'Champion-Sold', eroberung: 'Eroberungen', arena: 'Große Arena',
    trainer: 'Wandertrainer', runen: 'Verlorene Runen', tagwerk: 'Tagwerk', truhe: 'Tagestruhe', streifzug: 'Streifzüge', kurier: 'Kurierdienst',
    quest: 'Quests', woche: 'Wochenaufgabe', zerhacker: 'Zerhacker', fehde: 'Fehde', duell: 'Live-Duelle', kopfgeld: 'Kopfgeld',
    handel: 'Verkauf an den Händler', schatz: 'Schätze', geschenk: 'Geschenke', amt: 'Bürgermeister-Gehalt' };
  E.BILANZ_RAUS = { abgabe: 'Gebietsabgabe', ausbau: 'Ausbau', ausruestung: 'Skins & Waffen', brutplatz: 'Brutplätze', eier: 'Eierhändler',
    schmiede: 'Runenschmiede', perle: 'Schimmerperle', wesen: 'Wesen prägen', spende: 'Spenden', handel: 'Kauf beim Händler' };
  E.woche = function (now) { return Math.floor((now + 3 * 86400000) / (7 * 86400000)); };
  function bilanzSeite(v, namen) {
    var out = {};
    Object.keys(namen).forEach(function (k) { var n = Math.floor(Number(v && v[k])); if (Number.isFinite(n) && n > 0) out[k] = Math.min(100000000, n); });
    return out;
  }
  E.bilanzSauber = function (b) {
    if (!b || !Number.isFinite(b.woche)) return null;
    var vor = b.vorwoche && Number.isFinite(b.vorwoche.woche) ? b.vorwoche : null;
    return { woche: Math.floor(b.woche), rein: bilanzSeite(b.rein, E.BILANZ_REIN), raus: bilanzSeite(b.raus, E.BILANZ_RAUS),
      vorwoche: vor ? { woche: Math.floor(vor.woche), rein: bilanzSeite(vor.rein, E.BILANZ_REIN), raus: bilanzSeite(vor.raus, E.BILANZ_RAUS) } : null };
  };
  /* Die Bilanz der laufenden Woche - beim Wechsel wird die alte zur Vorwoche. */
  E.bilanz = function (st, now) {
    var w = E.woche(now), b = st.bilanz;
    if (!b || b.woche !== w) st.bilanz = b = { woche: w, rein: {}, raus: {}, vorwoche: b && b.woche === w - 1 ? { woche: b.woche, rein: b.rein, raus: b.raus } : null };
    return b;
  };
  /* Nur lesen: diese und die vorige Woche, ohne den Stand anzufassen. */
  E.bilanzSicht = function (st, now) {
    var w = E.woche(now), b = st && st.bilanz, leer = { rein: {}, raus: {} };
    if (!b) return { diese: leer, vorige: null };
    if (b.woche === w) return { diese: { rein: b.rein, raus: b.raus }, vorige: b.vorwoche && b.vorwoche.woche === w - 1 ? b.vorwoche : null };
    return { diese: leer, vorige: b.woche === w - 1 ? { rein: b.rein, raus: b.raus } : null };
  };
  E.vermerken = function (st, art, quelle, betrag, now) {
    betrag = Math.round(Number(betrag) || 0);
    if (!st || !(betrag > 0)) return;
    var b = E.bilanz(st, number(now, Date.now())), seite = art === 'raus' ? b.raus : b.rein;
    seite[quelle] = (seite[quelle] || 0) + betrag;
  };
  /* Gold aufs Konto oder herunter, mit Quelle fuer die Wochenbilanz. */
  E.buchen = function (st, betrag, quelle, now) {
    betrag = Math.round(Number(betrag) || 0);
    if (!st || !betrag) return 0;
    st.gold += betrag; E.vermerken(st, betrag > 0 ? 'rein' : 'raus', quelle, Math.abs(betrag), now);
    return betrag;
  };
  /* Die Gebietsabgabe: ein Zehntel von allem Gebietsgold - Stundenertrag und
     Tagesgeld - geht in den Gemeinschaftsbau, an dem die Insel gerade baut.
     Gebucht wird beim Verdienen, nicht am Wochenende: wer ein Gebiet vorher
     abgibt, entgeht ihr nicht. Ruht, solange kein Bau offen ist. */
  E.ABGABE = 0.1;
  E.outpost = function (value, now) {
    var t = value || {}, captured = number(t.capturedAt, now);
    return { level: Math.max(1, Math.min(3, Math.floor(number(t.level, 1)))), capturedAt: captured,
      dailyAt: Math.max(captured, number(t.dailyAt, now)),
      incomeAt: Math.max(captured, number(t.incomeAt, captured)), eggAt: Math.max(captured, number(t.eggAt, captured)),
      eggStock: Math.min(E.STOCK_LIMIT, Math.floor(number(t.eggStock, 0))),
      rohstoffAt: Math.max(captured, number(t.rohstoffAt, captured)), rohstoffVorrat: Math.min(E.ROHSTOFF_VORRAT, Math.floor(number(t.rohstoffVorrat, 0))),
      weekendAt: Math.max(captured, number(t.weekendAt, SG.gehstockmon.zeiten.REWARDS_START)) };
  };
  var previous = D.neuerStand;
  D.neuerStand = function (save, now) {
    now = number(now, Date.now()); var st = previous(save), old = save || {};
    st.economyVersion = 2; st.dailyGoldPending = Math.floor(number(old.dailyGoldPending, 0));
    /* Wie viel vom wartenden Tagesgeld Champion-Sold ist - nur fuer die Bilanz. */
    st.soldPending = Math.min(st.dailyGoldPending, Math.floor(number(old.soldPending, 0)));
    st.gold = Math.floor(number(old.gold, st.essenz + 120));
    st.goldRemainder = Math.min(0.999999999, number(old.goldRemainder, 0));
    st.abgabeRest = Math.min(0.999999999, number(old.abgabeRest, 0));
    /* Gleich auf die laufende Woche gestellt: sonst legte erst die erste
       Buchung die Bilanz an, und eine blosse Abfrage muesste schreiben. */
    st.bilanz = E.bilanzSauber(old.bilanz); E.bilanz(st, now);
    st.lager = E.lagerSauber(old.lager);
    st.clockAt = number(old.clockAt, now); st.eggSerial = Math.floor(number(old.eggSerial, 0));
    st.weekendEggs = {};
    D.FELDER.forEach(function (f) { var n = Math.floor(number(old.weekendEggs && old.weekendEggs[f.id], 0)); if (n) st.weekendEggs[f.id] = n; });
    st.eggs = []; var seen = {};
    (Array.isArray(old.eggs) ? old.eggs : []).slice(0, E.BAG_LIMIT).forEach(function (egg) {
      if (!egg || typeof egg.id !== 'string' || seen[egg.id] || !D.FELDER.some(function (f) { return f.id === egg.territoryId; })) return;
      seen[egg.id] = true;
      var start = number(egg.startedAt, null);
      var sauber = { id: egg.id, territoryId: egg.territoryId, producedAt: number(egg.producedAt, now), startedAt: start, readyAt: start === null ? null : start + E.HATCH_TIME };
      /* Ein Ei kann eine Mindest-Seltenheit tragen (etwa aus der Serien-Truhe)
         und sagen, woher es kommt. Beides ginge sonst beim naechsten Laden
         verloren. */
      var mindestens = Math.floor(Number(egg.mindestens) || 0);
      if (mindestens > 0) sauber.mindestens = Math.min(D.SELTENHEITEN.length - 1, mindestens);
      if (typeof egg.art === 'string' && /^[a-z]{1,16}$/.test(egg.art)) sauber.art = egg.art;
      st.eggs.push(sauber);
    });
    st.outposts = {};
    st.geschafft.forEach(function (id) { st.outposts[id] = E.outpost(old.outposts && old.outposts[id], now); });
    return st;
  };
  /* Abnehmender Ertrag. Im September hielten drei von vierzehn Spielern
     acht der neun Gebiete, und wer vier Festungen hat, verdient vier Mal so
     viel wie einer mit einer - das Gold zieht davon. Die zwei ertragreichsten
     Gebiete eines Spielers bringen darum volles Gold, jedes weitere die
     Haelfte. Mehr Land lohnt sich weiter, nur nicht mehr im selben Mass. */
  E.VOLLE_GEBIETE = 2; E.WEITERE_ANTEIL = 0.5;
  E.ertragsAnteile = function (territories) {
    var jeBesitzer = {}, anteil = {};
    (territories || []).forEach(function (t) { if (t && t.ownerId) (jeBesitzer[t.ownerId] = jeBesitzer[t.ownerId] || []).push(t); });
    Object.keys(jeBesitzer).forEach(function (id) {
      jeBesitzer[id].slice().sort(function (a, b) {
        return E.LEVELS[b.level || 1].income - E.LEVELS[a.level || 1].income || (a.capturedAt || 0) - (b.capturedAt || 0) || a.id - b.id;
      }).forEach(function (t, i) { anteil[t.id] = i < E.VOLLE_GEBIETE ? 1 : E.WEITERE_ANTEIL; });
    });
    return anteil;
  };
  /* Rechnet einen Aussenposten bis jetzt ab. 'abgabe' ist der Anteil fuer den
     Gemeinschaftsbau (0 ohne offenen Bau und im Einzelspiel); zurueck kommt,
     was davon an ganzem Gold faellig ist - der Aufrufer zahlt es ein. */
  E.settle = function (st, post, now, anteil, abgabe) {
    now = Math.max(st.clockAt || 0, now); st.clockAt = now;
    anteil = Number.isFinite(anteil) ? anteil : 1;
    abgabe = Number.isFinite(abgabe) ? Math.max(0, Math.min(1, abgabe)) : 0;
    var H = SG.gehstockmon.zeiten, end = Math.max(post.incomeAt, now);
    var brutto = (H.openTime(end) - H.openTime(post.incomeAt)) / E.HOUR * E.LEVELS[post.level].income * anteil;
    var earned = st.goldRemainder + brutto * (1 - abgabe), whole = Math.floor(earned + 1e-8);
    st.gold += whole; st.goldRemainder = Math.max(0, earned - whole); post.incomeAt = end;
    var offen = (st.abgabeRest || 0) + brutto * abgabe, kasse = Math.floor(offen + 1e-8);
    st.abgabeRest = Math.max(0, offen - kasse);
    E.vermerken(st, 'rein', 'gebiete', whole + kasse, now); E.vermerken(st, 'raus', 'abgabe', kasse, now);
    var days=Math.max(0,H.day(now)-H.day(post.dailyAt));
    /* Das Tagesgeld folgt demselben Anteil wie das Stundengold: ab dem dritten
       Gebiet die Haelfte. Vorher blieb es voll - und bei einem Lager ist es
       mehr als der Stundenertrag (1050 gegen 660 Gold die Woche), die Bremse
       griff also kaum. Die Abgabe geht davon ab, bevor es wartet. */
    if(days){
      var tag=Math.round(days*E.DAILY_GOLD*anteil),tagKasse=Math.round(tag*abgabe);
      st.dailyGoldPending=(st.dailyGoldPending||0)+tag-tagKasse;post.dailyAt=now;kasse+=tagKasse;
      E.vermerken(st,'rein','tagesgeld',tagKasse,now);E.vermerken(st,'raus','abgabe',tagKasse,now);
    }
    var produced = H.productionTime(post.eggAt), cycles = Math.max(0, Math.floor((H.productionTime(now) - produced) / E.EGG_TIME));
    if (cycles) { post.eggStock = Math.min(E.STOCK_LIMIT, post.eggStock + cycles); post.eggAt = H.productionAt(produced + cycles * E.EGG_TIME); }
    /* Rohstoffe wie Eier: nur in geoeffneten Stunden, volles Lager laeuft ueber. */
    if (Number.isFinite(post.rohstoffAt)) {
      var rohStart = H.productionTime(post.rohstoffAt), rohZyklen = Math.max(0, Math.floor((H.productionTime(now) - rohStart) / E.ROHSTOFF_ZEIT));
      if (rohZyklen) { post.rohstoffVorrat = Math.min(E.ROHSTOFF_VORRAT, (post.rohstoffVorrat || 0) + rohZyklen); post.rohstoffAt = H.productionAt(rohStart + rohZyklen * E.ROHSTOFF_ZEIT); }
    }
    return kasse;
  };
  /* Zahlt das wartende Tagesgeld aus - Champion-Sold getrennt verbucht. */
  E.deliverDaily = function (st, now) {
    var n = st.dailyGoldPending || 0, sold = Math.min(n, st.soldPending || 0);
    st.dailyGoldPending = 0; st.soldPending = 0;
    E.buchen(st, n - sold, 'tagesgeld', now); E.buchen(st, sold, 'sold', now);
    return n;
  };
  E.nextEggAt = function (post) { var H = SG.gehstockmon.zeiten; return H.productionAt(H.productionTime(post.eggAt) + E.EGG_TIME); };
  E.weekend = function (st, post, id, now) {
    var reward = SG.gehstockmon.zeiten.weekends(Math.max(post.capturedAt, post.weekendAt), now);
    if (reward.count) { st.weekendEggs[id] = (st.weekendEggs[id] || 0) + reward.count * 2; post.weekendAt = reward.through; }
  };
  E.deliverWeekend = function (st, now) {
    var delivered = 0;
    Object.keys(st.weekendEggs).forEach(function (id) {
      var count = Math.min(st.weekendEggs[id], E.BAG_LIMIT - st.eggs.length);
      for (var i = 0; i < count; i++) st.eggs.push({ id: 'weekend-' + id + '-' + now + '-' + (++st.eggSerial), territoryId: Number(id), producedAt: now, startedAt: null, readyAt: null });
      st.weekendEggs[id] -= count; delivered += count; if (!st.weekendEggs[id]) delete st.weekendEggs[id];
    });
    return delivered;
  };
  E.tick = function (st, now) { Object.keys(st.outposts).forEach(function (id) { E.settle(st, st.outposts[id], now); }); };
  E.capture = function (st, id, now) {
    if (st.geschafft.indexOf(id) < 0) st.geschafft.push(id);
    st.outposts[id] = E.outpost(null, now); st.siege++; E.buchen(st, 40, 'eroberung', now);
  };
  /* Nimmt die Rohstoffe eines Aussenpostens mit - wirft nie, zurueck kommt,
     was im Lager ankam. */
  E.rohstoffeAbholen = function (st, post, id, now) {
    E.settle(st, post, now);
    var r = E.rohstoffVon(id), menge = E.einlagern(st, r.id, post.rohstoffVorrat || 0);
    post.rohstoffVorrat = (post.rohstoffVorrat || 0) - menge;
    return { id: r.id, name: r.name, menge: menge };
  };
  E.collect = function (st, post, id, now) {
    E.settle(st, post, now);
    var count = Math.min(post.eggStock, E.BAG_LIMIT - st.eggs.length);
    if (!count) throw new Error(post.eggStock ? 'Deine Bruttasche ist voll (12 Eier).' : 'Hier ist noch kein Ei bereit.');
    for (var i = 0; i < count; i++) st.eggs.push({ id: 'egg-' + id + '-' + now + '-' + (++st.eggSerial), territoryId: id, producedAt: now, startedAt: null, readyAt: null });
    post.eggStock -= count; return count;
  };
  /* Wie viele Brutplaetze jemand hat, haengt am Leuchtturm und an gekauften
     Plaetzen - beides weiss nur der Aufrufer. Ohne Angabe bleiben es die drei
     festen. */
  E.incubate = function (st, id, now, plaetze) {
    var frei = Number.isFinite(plaetze) ? Math.max(E.INCUBATORS, plaetze) : E.INCUBATORS;
    var egg = st.eggs.find(function (e) { return e.id === id; });
    if (!egg) throw new Error('Dieses Ei ist nicht in deiner Bruttasche.');
    if (egg.startedAt !== null) throw new Error('Dieses Ei wird bereits ausgebrütet.');
    if (st.eggs.filter(function (e) { return e.startedAt !== null; }).length >= frei) throw new Error('Alle ' + frei + ' Brutplätze sind belegt.');
    egg.startedAt = Math.max(now, st.clockAt); egg.readyAt = egg.startedAt + E.HATCH_TIME; return egg;
  };
  /* Was aus einem Ei kommt, entscheidet allein die Seltenheit - mit festen
     Quoten fuer alle, egal was man schon hat. Innerhalb einer Seltenheit ist
     jedes Mon gleich wahrscheinlich. Frueher zog ein Mon, das man schon
     hatte, nur ein Drittel des Gewichts auf sich: die Quoten verschoben sich
     mit jeder Sammlung, und niemand wusste, was ein Ei eigentlich wert ist. */
  /* 28.09.2026: Mythisch 1,6 -> 1 %, Apokalyptisch 0,4 -> 0,1 %. Die frei
     gewordenen 0,9 % gehen an Gewoehnlich, damit die Summe 100 bleibt und
     alle anderen Stufen genau so wahrscheinlich sind wie vorher. */
  E.SCHLUPF_QUOTEN = [40.9, 25, 17, 11, 5, 1, 0.1];
  /* Der Garantie-Zaehler: spaetestens das zehnte Ei ohne Episches bringt ein
     Episches, spaetestens das vierzigste ohne Legendaeres ein Legendaeres.
     Damit ist auch ein schlechtes Ei ein Schritt nach vorn. */
  E.GARANTIEN = [{ ab: 3, nach: 10 }, { ab: 4, nach: 40 }];
  /* Eins von vierundsechzig Mons schluepft schimmernd - eine seltene
     Farbvariante, rein zum Ansehen. */
  E.SCHIMMER_CHANCE = 1 / 64;
  E.garantieStand = function (st) {
    var g = Array.isArray(st && st.garantie) ? st.garantie : [];
    return E.GARANTIEN.map(function (v, i) {
      var seit = Math.max(0, Math.min(v.nach - 1, Math.floor(Number(g[i]) || 0)));
      return { ab: v.ab, nach: v.nach, seit: seit, noch: v.nach - seit };
    });
  };
  E.schlupfChancen = function (st) {
    var summe = E.SCHLUPF_QUOTEN.reduce(function (s, v) { return s + v; }, 0);
    return D.SELTENHEITEN.map(function (r, i) {
      var alle = D.KATALOG.filter(function (k) { return k.seltenheit === i; });
      var offen = st && st.besitz ? alle.filter(function (k) { return st.besitz.indexOf(k.id) < 0; }).length : alle.length;
      return { name: r.name, farbe: r.farbe, offen: offen, anzahl: alle.length, anteil: (E.SCHLUPF_QUOTEN[i] || 0) / summe };
    }).filter(function (v) { return v.anteil > 0 && v.anzahl > 0; });
  };
  /* Mehrere unabhaengige Zufallszahlen aus einem Aufruf. Wer eine feste Zahl
     uebergibt (die Tests), bekommt sie als erste Ziehung und danach eine
     feste Folge - so bleibt jedes Ergebnis wiederholbar. */
  E.zufallsfolge = function (random) {
    if (typeof random === 'function') return function () { return Math.max(0, Math.min(0.9999999, Number(random()) || 0)); };
    var erste = Number.isFinite(random) ? Math.max(0, Math.min(0.9999999, random)) : Math.random();
    var saat = Math.floor(erste * 4294967296) >>> 0, zug = 0;
    return function () {
      if (zug++ === 0) return erste;
      saat = (Math.imul(saat ^ 0x9e3779b9, 1664525) + 1013904223) >>> 0;
      return saat / 4294967296;
    };
  };
  /* Ein Zwilling geht nicht verloren: Er steckt seine Kraft in das Mon, das
     schon da ist, und hebt es eine Runenstufe. Steht es schon auf der
     hoechsten, zerfaellt er zu Runen seiner eigenen Seltenheit - und die
     sind umso wertvoller, je seltener er war. */
  E.hatch = function (st, id, now, random) {
    var X = SG.gehstockmon.abenteuer, zufall = E.zufallsfolge(random);
    var egg = st.eggs.find(function (e) { return e.id === id; });
    if (!egg || egg.readyAt === null || now < egg.readyAt) throw new Error('Das Ei ist noch nicht fertig ausgebrütet.');
    var summe = E.SCHLUPF_QUOTEN.reduce(function (s, v) { return s + v; }, 0), wurf = zufall() * summe, rang = E.SCHLUPF_QUOTEN.length - 1;
    for (var i = 0; i < E.SCHLUPF_QUOTEN.length; i++) { wurf -= E.SCHLUPF_QUOTEN[i]; if (wurf < 0) { rang = i; break; } }
    var gewuerfelt = rang, stand = E.garantieStand(st), boden = Math.max(0, Math.floor(Number(egg.mindestens) || 0));
    E.GARANTIEN.forEach(function (g, i) { if (stand[i].seit >= g.nach - 1) boden = Math.max(boden, g.ab); });
    rang = Math.max(rang, Math.min(boden, D.SELTENHEITEN.length - 1));
    /* Ein Rom-Ei bringt seine Seltenheit schon mit: der Server wuerfelt sie
       unmittelbar vor dem Schluepfen (lib/gehstockmon-rom.mjs). */
    if (Number.isInteger(egg.festRang)) gewuerfelt = rang = Math.max(0, Math.min(D.SELTENHEITEN.length - 1, egg.festRang));
    st.garantie = E.GARANTIEN.map(function (g, i) { return rang >= g.ab ? 0 : stand[i].seit + 1; });
    /* Event-Mons stehen nicht im Katalog - aus einem Rom-Ei koennen sie trotzdem kommen. */
    var extra = egg.art === 'rom' && D.EVENT_MONS ? D.EVENT_MONS : [];
    var pool = [];
    for (var r = rang; r >= 0 && !pool.length; r--) pool = D.KATALOG.concat(extra).filter(function (k) { return k.seltenheit === r; });
    var mon = pool[Math.min(pool.length - 1, Math.floor(zufall() * pool.length))];
    var ergebnis = { mon: mon, neu: st.besitz.indexOf(mon.id) < 0, stufe: 0, runen: 0, rang: mon.seltenheit,
      garantiert: mon.seltenheit > gewuerfelt, schimmernd: zufall() < E.SCHIMMER_CHANCE, schimmerNeu: false };
    st.eggs = st.eggs.filter(function (e) { return e.id !== id; });
    st.schimmernd = st.schimmernd || {};
    if (ergebnis.schimmernd && !st.schimmernd[mon.id]) { st.schimmernd[mon.id] = true; ergebnis.schimmerNeu = true; }
    if (ergebnis.neu) { st.besitz.push(mon.id); st.beschwoerungen++; return ergebnis; }
    st.monUpgrades = st.monUpgrades || {};
    var stufe = X.upgradeLevel(st.monUpgrades[mon.id]);
    if (stufe < X.UPGRADE_LIMIT) { st.monUpgrades[mon.id] = stufe + 1; ergebnis.stufe = stufe + 1; return ergebnis; }
    st.runes = st.runes || D.SELTENHEITEN.map(function () { return 0; });
    ergebnis.stufe = stufe; ergebnis.runen = X.UPGRADE_LIMIT;
    st.runes[mon.seltenheit] = Math.min(9999, (st.runes[mon.seltenheit] || 0) + ergebnis.runen);
    return ergebnis;
  };
  E.upgrade = function (st, post, now) {
    E.settle(st, post, now); var stufe = E.LEVELS[post.level], price = stufe.cost;
    if (!price) throw new Error('Deine Festung ist vollständig ausgebaut.');
    if (st.gold < price) throw new Error('Für den Ausbau brauchst du ' + price + ' Gold.');
    var fehlt = E.rohstoffeFehlen(st, stufe.rohstoffe);
    if (fehlt) throw new Error('Für den Ausbau brauchst du auch Rohstoffe. ' + fehlt);
    Object.keys(stufe.rohstoffe || {}).forEach(function (rid) { st.lager[rid] -= stufe.rohstoffe[rid]; });
    E.buchen(st, -price, 'ausbau', now); post.level++; return post.level;
  };
})(SG);

/* Ein Kalender für Server und Anzeige: deutsche Ortszeit, auch bei Zeitumstellung. */
(function (SG) {
  var H = SG.gehstockmon.zeiten = {}, DAY = 86400000, HOUR = 3600000;
  H.ZONE = 'Europe/Berlin';
  H.CLOSE = [0, 13, 13, 14, 15, 13, 0];
  H.LABELS = ['Montag · 7–13 Uhr', 'Dienstag · 7–13 Uhr', 'Mittwoch · 7–14 Uhr', 'Donnerstag · 7–15 Uhr', 'Freitag · 7–13 Uhr', 'Samstag & Sonntag · geschlossen'];
  // Erstes Wochenende dieser Regel; alte Spielstände bekommen keine rückwirkenden Monate.
  H.REWARDS_START = Date.parse('2026-09-12T00:00:00+02:00');
  var parts = new Intl.DateTimeFormat('en-GB', { timeZone: H.ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  function local(t) { var p = {}; parts.formatToParts(new Date(t)).forEach(function (v) { if (v.type !== 'literal') p[v.type] = Number(v.value); }); return p; }
  function mod(n, d) { return ((n % d) + d) % d; }
  H.day = function (t) { var p = local(t); return Date.UTC(p.year, p.month - 1, p.day) / DAY; };
  H.weekday = function (d) { return new Date(d * DAY).getUTCDay(); };
  H.at = function (d, hour) {
    var wall = d * DAY + hour * HOUR, t = wall;
    for (var i = 0; i < 2; i++) { var p = local(t); t += wall - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second); }
    return t;
  };
  H.access = function (t) {
    var d = H.day(t), close = H.CLOSE[H.weekday(d)], open = !!close && t >= H.at(d, 7) && t < H.at(d, close), next = null;
    for (var i = 0; i <= 7; i++) if (H.CLOSE[H.weekday(d + i)] && H.at(d + i, 7) > t) { next = H.at(d + i, 7); break; }
    return { open: open, serverTime: t, timeZone: H.ZONE, closesAt: open ? H.at(d, close) : null, nextOpenAt: next };
  };
  // Nur geöffnete Stunden zählen; ganze Wochen werden ohne Tages-Schleife addiert.
  H.openTime = function(t){var d=H.day(t),monday=d-((H.weekday(d)+6)%7),total=Math.floor(monday/7)*33*HOUR;
    for(var day=monday;day<=d;day++){var close=H.CLOSE[H.weekday(day)];if(close)total+=Math.max(0,Math.min(t,H.at(day,close))-H.at(day,7));}return total;};
  H.format = function (t) { return new Intl.DateTimeFormat('de-DE', { timeZone: H.ZONE, weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(t)); };
  // Eier sammeln dieselben geöffneten Stunden wie Gold. Die Umkehrfunktion
  // liefert den Fertigzeitpunkt auch über Nächte, Wochenenden und Zeitumstellungen.
  H.productionTime = H.openTime;
  H.productionAt = function (v) {
    var week=Math.floor(v/(33*HOUR)),monday=week*7+4,left=v-week*33*HOUR;
    if(left===0)return H.at(monday-3,13);
    for(var i=0;i<5;i++){var span=(H.CLOSE[H.weekday(monday+i)]-7)*HOUR;
      if(left<=span)return H.at(monday+i,7)+left;left-=span;
    }
    return H.at(monday+4,13);
  };
  H.weekends = function (since, until) {
    since = Math.max(since, H.REWARDS_START); if (until <= since) return { count: 0, through: since };
    var day = H.day(since), saturday = day + mod(6 - H.weekday(day), 7);
    if (H.at(saturday, 0) < since) saturday += 7;
    var count = Math.max(0, Math.floor((H.day(until) - saturday - 2) / 7) + 1);
    return { count: count, through: count ? H.at(saturday + 2 + (count - 1) * 7, 0) : since };
  };
})(SG);

/* Gemeinsame Abenteuer-, Ausrüstungs- und Revierregeln ohne Browser-Abhängigkeit. */
(function(SG){
  var D=SG.gehstockmon.daten,E=SG.gehstockmon.wirtschaft,H=SG.gehstockmon.zeiten,X=SG.gehstockmon.abenteuer={};
  X.DUNGEON_OPS=['dungeon_create','dungeon_join','dungeon_ready','dungeon_start','dungeon_turn','dungeon_leave'];
  /* Wo ein Mon im Dienst steht. Jeder Aussenposten kann seine eigene
     Besatzung haben, und dasselbe Mon darf dabei an mehreren Stellen zugleich
     stehen - im Kampfteam und auf beliebig vielen Posten. Die fruehere Regel
     "jedes Mon nur an einer Stelle" ist gefallen: sie zwang dazu, schwache
     Mons auf Posten zu stellen, nur weil die starken schon woanders standen.

     Ein Gebiet ohne eigene Besatzung wird vom Kampfteam gehalten - der sanfte
     Einstieg: niemand verliert Land, nur weil er keine Besatzung gesetzt hat. */
  X.TRUPPE=4;
  X.posten=function(p,id){
    var t=p&&p.posten&&p.posten[id];
    return Array.isArray(t)&&t.length===X.TRUPPE?t.slice():null;
  };
  /* Die Truppe, die ein Gebiet tatsaechlich haelt - eigene Besatzung, sonst
     das Kampfteam als Notbesatzung. */
  X.besatzung=function(p,id){return X.posten(p,id)||((p&&p.truppe)||[]).slice();};
  X.notbesatzung=function(p,id){return !X.posten(p,id);};
  /* Wo dieses Mon gerade steht: 'kampfteam', eine Gebietsnummer, oder nichts. */
  /* Ein Mon auf Streifzug ist unterwegs: es kaempft nicht, haelt keinen Posten
     und haengt nicht am Tauschbrett, bis es zurueck ist. */
  X.aufStreifzug=function(p,monId){return !!(p&&Array.isArray(p.streifzuege)&&p.streifzuege.some(function(z){return z&&z.monId===monId;}));};
  X.einsatzOrt=function(p,monId,ausser){
    if(!p)return null;
    if(ausser!=='kampfteam'&&(p.truppe||[]).indexOf(monId)>=0)return 'kampfteam';
    if(X.aufStreifzug(p,monId))return 'streifzug';
    var gefunden=null;
    Object.keys(p.posten||{}).forEach(function(id){
      if(String(id)===String(ausser)||gefunden)return;
      if((p.posten[id]||[]).indexOf(monId)>=0)gefunden=Number(id);
    });
    return gefunden;
  };
  /* Alle Stellen, an denen ein Mon gerade steht - es koennen mehrere sein. */
  X.einsatzOrte=function(p,monId){
    if(!p)return [];
    var orte=(p.truppe||[]).indexOf(monId)>=0?['kampfteam']:[];
    if(X.aufStreifzug(p,monId))orte.push('streifzug');
    Object.keys(p.posten||{}).forEach(function(id){if((p.posten[id]||[]).indexOf(monId)>=0)orte.push(Number(id));});
    return orte;
  };
  X.einsatzText=function(ort){
    if(ort==='kampfteam')return 'im Kampfteam';
    if(ort==='streifzug')return 'auf Streifzug';
    return Number.isFinite(ort)?'auf '+(D.FELDER[ort-1]?D.FELDER[ort-1].name:'Gebiet '+ort):'';
  };
  X.einsatzListe=function(orte){
    var namen=(orte||[]).map(function(o){return o==='kampfteam'?'Kampfteam':o==='streifzug'?'Streifzug':(D.FELDER[o-1]?D.FELDER[o-1].name:'Gebiet '+o);});
    return namen.length>1?namen.slice(0,-1).join(', ')+' und '+namen[namen.length-1]:namen.join('');
  };
  /* Prueft eine Aufstellung: vier verschiedene Mons aus der eigenen Sammlung.
     Wo sie sonst noch stehen, spielt keine Rolle mehr. */
  X.truppePruefen=function(p,squad){
    if(!Array.isArray(squad)||squad.length!==X.TRUPPE||new Set(squad).size!==X.TRUPPE)
      return 'Wähle vier verschiedene Mons.';
    for(var i=0;i<squad.length;i++){
      var id=squad[i];
      if(typeof id!=='string'||!D.mon(id)||(p.besitz||[]).indexOf(id)<0)return 'Wähle vier Mons aus deiner Sammlung.';
      if(X.aufStreifzug(p,id))return D.mon(id).name+' ist gerade auf Streifzug.';
    }
    return null;
  };
  /* Wie stark ein Mon im Feld ist - ein Wert, der Leben und Schlagkraft
     zusammenzieht. Nur zum Sortieren gedacht, nicht fuer den Kampf. */
  X.kampfwert=function(p,monId){
    var A=SG.gehstockmon.arena,m=X.mon(p,monId);
    if(!m)return 0;
    var st=A.stats(m);
    return st.hp+st.ang*4;
  };
  /* Die staerkste Vierertruppe aus der ganzen Sammlung: erst je Rolle die
     staerkste - ein Wall haelt, ein Pfleger heilt, eine Schneide trifft, ein
     Stoerer bricht die Deckung -, dann mit den naechststaerksten auffuellen. */
  X.staerksteTruppe=function(p){
    var alle=(p.besitz||[]).filter(function(id){return !!D.mon(id)&&!X.aufStreifzug(p,id);})
      .sort(function(a,b){return X.kampfwert(p,b)-X.kampfwert(p,a);});
    var gewaehlt=[],rollen={};
    alle.forEach(function(id){
      if(gewaehlt.length>=X.TRUPPE)return;
      var typ=D.mon(id).typ;
      if(rollen[typ])return;
      rollen[typ]=true;gewaehlt.push(id);
    });
    alle.forEach(function(id){if(gewaehlt.length<X.TRUPPE&&gewaehlt.indexOf(id)<0)gewaehlt.push(id);});
    return gewaehlt.length===X.TRUPPE?gewaehlt:null;
  };
  /* Besatzungen von selbst setzen: jeder Posten ohne eigene Besatzung bekommt
     die staerkste Truppe. Seit ein Mon an mehreren Stellen stehen darf, gibt
     es nichts mehr zu verteilen - alle offenen Posten bekommen dieselben vier.
     Wer schon eine Besatzung gesetzt hat, behaelt sie. */
  X.autoBesetzen=function(p,gebiete){
    var truppe=X.staerksteTruppe(p);if(!truppe)return [];
    return (gebiete||[]).filter(function(g){return !X.posten(p,g.id);})
      .sort(function(a,b){return (b.level||1)-(a.level||1)||b.id-a.id;})
      .map(function(g){return {id:g.id,squad:truppe.slice()};});
  };
  X.STADT_OPS=['arena_rang','champion_fordern','tagwerk','findelei','brutplatz_kaufen','tausch_anbieten','tausch_annehmen','tausch_zuruecknehmen','ei_kaufen','runen_zerlegen','runen_verschmelzen','schimmerperle_kaufen'];
  X.OPS=['survey','gather','trainer_start','quest_claim','shop_buy','equip','raid_start','raid_turn','raid_arena','raid_cancel','mon_upgrade','leuchtturm_spenden','zerhacker_schlagen','waffe_schleifen','panzer_anlegen','fehde_fordern','fehde_annehmen','titel_waehlen','streifzug_start','streifzug_abholen'].concat(X.STADT_OPS).concat(X.DUNGEON_OPS);
  /* Jeder Spielzug, der den Spielstand aendert - eine Liste fuer Browser und
     Server. Der Browser haengt nur an diese Zuege eine Kennung, und der
     Server verlangt sie genau dafuer. Frueher fuehrte jede Seite ihre eigene
     Liste, und Kampfplan und Besatzungen fehlten auf der Browser-Seite: jedes
     Speichern scheiterte mit "Aktionskennung fehlt". Spaetere Dateien haengen
     ihre Zuege hier an. */
  X.SPIELZUEGE=['arena_start','arena_turn','arena_flee','collect','incubate','hatch','upgrade','defend','plan','wesen_praegen','besatzung','besatzung_auto'].concat(X.OPS);
  X.SPAWN={x:0,z:30};X.SPAWN_TIME=60*60000;
  X.UPGRADE_LIMIT=5;
  /* Der Leuchtturm ist das gemeinsame Bauwerk: alle zahlen darauf ein, und
     wenn er steht, bleibt er stehen. Er steht mitten auf der Insel und
     peilt von dort den Zerhacker an. */
  X.LEUCHTTURM={x:0,z:0,ziel:5000,mindestens:10};
  X.leuchtturmFertig=function(bau){return !!bau&&bau.gold>=X.LEUCHTTURM.ziel;};
  /* Drei feste Brutplaetze, einer aus dem Leuchtturm, dazu bis zu drei
     gekaufte. Bisher rechnete nur diese Funktion mit dem Leuchtturm, waehrend
     E.incubate hart gegen die drei festen prueft - der vierte Platz war also
     unerreichbar. Jetzt geht beides durch dieselbe Zahl. */
  X.BRUTPLATZ_PREISE=[400,1200,3000];
  X.gekaufteBrutplaetze=function(p){var n=p&&p.brutplaetze;
    return Number.isFinite(n)?Math.max(0,Math.min(X.BRUTPLATZ_PREISE.length,Math.floor(n))):0;};
  X.brutplaetze=function(bau,p){return E.INCUBATORS+(X.leuchtturmFertig(bau)?1:0)+X.gekaufteBrutplaetze(p);};

  /* ------------------------------------------------------------------
     Streifzuege (27.09.2026)

     Ein Mon, das gerade nirgends Dienst tut, zieht fuer 45, 90 oder 180
     geoeffnete Minuten los - die Uhr laeuft wie bei den Eiern nur, waehrend
     die Insel offen ist. Drei Ziele, je eine Rolle im Vorteil (+50 %):
       Runen suchen   Stoerer und Schneiden   Runen der Seltenheit des Mons
       Waren tragen   Waelle                  Gold
       Nester suchen  Pfleger                 mit Glueck ein Ei
     Codex hatte drei Einwaende, die hier eingebaut sind:
     - Neues Gold vergroessert den Abstand zwischen Gebietsbesitzern und
       allen anderen nicht: volles Gold gibt es nur ohne Gebiet, mit ein
       oder zwei Gebieten die Haelfte, ab drei ein Viertel.
     - Seltene Mons bringen keine groessere Menge, nur ihre Runensorte; ab
       Legendaer die Haelfte, weil diese Runen viel mehr wert sind.
     - Laengere Zuege sind je Stunde etwas ergiebiger - niemand muss jede
       Pause abholen, und wer es tut, bekommt kaum mehr.
     Die Mengen: je Platz mit passender Rolle etwa 0,5 Runen, 20 Gold oder
     0,12 Eier je geoeffneter Stunde (Lager: 20 Gold, Tagwerk: 40). Zwei
     Waelle ohne Gebiet bringen so etwa so viel wie das Tagwerk. Das
     Ergebnis wird beim Start ausgewuerfelt. Leer geht niemand aus: wer nichts
     findet, bringt ein paar Muenzen Kleingeld mit.
     ------------------------------------------------------------------ */
  X.STREIFZUG_PLAETZE=2;
  X.STREIFZUG_DAUERN=[45,90,180];
  X.STREIFZUG_ZIELE=[
    {id:'runen', name:'Runen suchen', rollen:[3,1], was:'Runen seiner Seltenheit'},
    {id:'waren', name:'Waren tragen', rollen:[0],   was:'Gold'},
    {id:'nester',name:'Nester suchen',rollen:[2],   was:'mit Glück ein Ei'}
  ];
  X.STREIFZUG_ERTRAG={45:{runen:.2,gold:8,ei:.05},90:{runen:.45,gold:18,ei:.1},180:{runen:1,gold:40,ei:.24}};
  X.STREIFZUG_ROLLE=1.5;X.STREIFZUG_KLEINGELD=5;
  X.streifzugZiel=function(id){return X.STREIFZUG_ZIELE.find(function(z){return z.id===id;})||null;};
  X.streifzugGoldAnteil=function(gebiete){return gebiete<=0?1:gebiete<=2?.5:.25;};
  /* Was ein Streifzug erwarten laesst - dieselbe Rechnung fuer Anzeige und Wurf. */
  /* runenFaktor: das Wetter der Woche (Runenregen), sonst 1. */
  X.streifzugVorschau=function(mon,zielId,dauer,gebiete,runenFaktor){
    var z=X.streifzugZiel(zielId),e=X.STREIFZUG_ERTRAG[dauer];if(!z||!e||!mon)return null;
    var passt=z.rollen.indexOf(mon.typ)>=0,f=passt?X.STREIFZUG_ROLLE:1,rf=Number.isFinite(runenFaktor)?runenFaktor:1;
    return {passt:passt,runenRang:mon.seltenheit,
      runen:z.id==='runen'?Math.round(e.runen*f*rf*(mon.seltenheit>=4?.5:1)*100)/100:0,
      gold:z.id==='waren'?Math.round(e.gold*f*X.streifzugGoldAnteil(gebiete)):0,
      ei:z.id==='nester'?Math.round(Math.min(.9,e.ei*f)*100)/100:0};
  };
  X.streifzugWuerfeln=function(vorschau,zufall){
    var r=vorschau.runen,n=Math.floor(r)+(zufall()<r-Math.floor(r)?1:0),ei=vorschau.ei>0&&zufall()<vorschau.ei;
    var gold=vorschau.gold;if(!n&&!ei&&!gold)gold=X.STREIFZUG_KLEINGELD;
    return {runen:n,rang:vorschau.runenRang,gold:gold,ei:ei};
  };
  /* Wann etwas zurueck ist, in Worten: "um 11:05", "morgen um 7:45". */
  X.uhrText=function(t,now){
    var tag=H.day(t)-H.day(now),zeit=new Intl.DateTimeFormat('de-DE',{timeZone:H.ZONE,hour:'2-digit',minute:'2-digit'}).format(new Date(t));
    return (tag<=0?'':tag===1?'morgen ':new Intl.DateTimeFormat('de-DE',{timeZone:H.ZONE,weekday:'long'}).format(new Date(t))+' ')+'um '+zeit;
  };

  /* Goldwaren (27.09.2026). Gold sammelte sich an: ausser Ausbau, Brutplaetzen
     und Ausruestung gab es nichts, wofuer es sich lohnte. Vier Dinge setzen es
     dort ein, wo es bisher klemmte - bei Eiern, bei Runen, die zu keinem
     eigenen Mon passen, beim Wesen, das man nie loswurde, und beim Schimmer,
     auf den man sonst 64 Eier lang wartet.

       Eierhaendler     ein normales Ei, eins je Tag
       Runenschmiede    1 Rune -> 2 der naechstniedrigeren Seltenheit,
                        3 Runen -> 1 der naechsthoeheren; beides gegen Gold.
                        Hin und zurueck verliert man immer etwas, eine
                        Runenschleife ohne Ende gibt es also nicht.
       Wesen praegen    ein anderes Wesen, zufaellig; teurer, je seltener
       Schimmerperle    das naechste Mon, das noch nicht schimmert, schimmert */
  X.HAENDLER_EI_PREIS=350;
  X.SCHIMMERPERLE_PREIS=2000;
  X.wesenPreis=function(rang){return 100+Math.max(0,Math.floor(rang)||0)*100;};
  X.schmiedeKosten=function(art,rang){return art==='zerlegen'?20*rang:40*(rang+1);};

  /* Die Arena (bis 27.09.2026 Stockhafen): der eine Ort auf der Insel, den
     niemand erobern kann. In der Mitte steht die Grosse Arena - massiv, man
     laeuft aussen herum. Im Ring darum stehen die Gebaeude (X.GEBAEUDE) mit
     allem, was nicht Kampf ist. X.inStadt meint weiter den ganzen Platz. */
  X.STADT={x:-46,z:24,name:'Arena',radius:26};
  X.ARENA_BAU={x:-46,z:24,radius:11};
  X.inStadt=function(p){return Math.hypot(p.x-X.STADT.x,p.z-X.STADT.z)<X.STADT.radius;};
  X.imArenaBau=function(p){return Math.hypot(p.x-X.ARENA_BAU.x,p.z-X.ARENA_BAU.z)<X.ARENA_BAU.radius;};
  /* Vor dem Tor auf der Suedseite steht man nah genug fuer alles, was die
     Stadt anbietet. */
  X.STADT_TOR={x:X.STADT.x,z:X.STADT.z+X.ARENA_BAU.radius+4};
  /* Die Gebaeude am Arenaplatz. Winkel und Abstand sind die Plaetze, auf
     denen vorher nur Deko-Haeuser standen (2-welt.js); der Sueden zwischen
     1.2 und 2.0 bleibt fuer das Torhaus frei. Tuer = wo die Figur hinlaeuft. */
  X.GEBAEUDE=[
    {id:'hafen',name:'Hafenkontor',bild:'tagwerk',winkel:0.75,abstand:19.7,dach:'#497f92'},
    {id:'haendler',name:'Händler',bild:'haendler',winkel:2.25,abstand:21.9,dach:'#b98841'},
    {id:'rathaus',name:'Rathaus',bild:'rathaus',winkel:0.15,abstand:17.5,dach:'#a24e34'},
    {id:'tausch',name:'Tauschhaus',bild:'tausch',winkel:2.85,abstand:17.5,dach:'#65518c'},
    {id:'schmiede',name:'Runenschmiede',bild:'schmiede',winkel:3.45,abstand:19.7,dach:'#a95037'},
    {id:'streifzug',name:'Streifzughaus',bild:'streifzug',winkel:4.05,abstand:21.9,dach:'#5b8a4e'}
  ].map(function(b){b.x=X.STADT.x+Math.cos(b.winkel)*b.abstand;b.z=X.STADT.z+Math.sin(b.winkel)*b.abstand;b.tuer={x:b.x,z:b.z+3.6};return b;});
  X.gebaeude=function(id){return X.GEBAEUDE.find(function(b){return b.id===id;})||null;};

  /* Der gehstockhassende Zerhacker zieht eine Woche lang seine Bahn ueber die
     Insel. Seine Lage rechnet sich wie bei den Wandertrainern aus der Zeit,
     seine Lebenskraft dagegen ist echter Weltzustand - daran schlagen alle
     gemeinsam. Sein Rundkurs meidet die Mitte, damit er nicht dauernd im
     Startplatz steht. */
  /* Die Zahlen sind auf eine Handvoll Leute mit kurzen Schulpausen gerechnet:
     rund zwanzig Schlaege pro Kopf und Woche sollen reichen. Statt einer
     starren Sperre nach jedem Schlag fuellt sich ein Vorrat - wer zwei Tage
     weg war, kommt mit vollem Beutel zurueck und haut sie am Stueck raus. */
  /* Reichweite mit Rand: Er zieht mit gut einem Schritt je Sekunde weiter,
     und die Standortmeldung darf bis zu 15 Sekunden alt sein. Bei 22 stand
     man neben ihm und der Server sah trotzdem einen zu grossen Abstand. */
  X.ZERHACKER={runde:11*60000,radius:150,kraft:5000,kraftJeSpieler:1800,kraftMax:30000,
               nachschub:10*60000,vorratMax:12,
               schadenJeStufe:800,beuteRunen:6,beuteGold:400,reichweite:34};
  /* Jede Woche eine gemeinsame Aufgabe, an der alle zusammen zaehlen. Anders
     als der Zerhacker verlangt sie keine Wartezeit und keinen Weg zu einem
     bestimmten Ort - jeder Beitrag zaehlt sofort, auch der aus fuenf Minuten
     Pause. Welche dran ist, ergibt sich aus der Wochennummer. */
  X.WOCHENZIELE=[
    {id:'runen',  name:'Runensuche',    was:'Verlorene Runen einsammeln', ziel:30, lohn:200},
    {id:'trainer',name:'Trainingslager',was:'Wandertrainer besiegen',     ziel:15, lohn:250},
    {id:'eier',   name:'Brutzeit',      was:'Eier ausbrüten',            ziel:20, lohn:200},
    {id:'tiefe',  name:'Tiefenzug',     was:'Dungeonbosse bezwingen',     ziel:8,  lohn:300}
  ];
  X.wochenziel=function(now){return X.WOCHENZIELE[X.zerhackerWoche(now)%X.WOCHENZIELE.length];};

  /* Montag null Uhr - ab da zaehlt die Woche. */
  X.wochenStart=function(now){var tag=H.day(now);return H.at(tag-((H.weekday(tag)+6)%7),0);};

  /* Der Vorrat waechst nur, waehrend die Insel offen ist: nachts und am
     Wochenende passiert nichts. Gezaehlt wird darum nicht die verstrichene
     Zeit, sondern die geoeffnete - dieselbe Rechnung, mit der Eier reifen.

     Gezaehlt wird ausserdem erst ab dem ersten Besuch der Woche, nicht ab
     Montag null Uhr: sonst haette, wer montags um zehn hereinschaut, den
     Beutel schon voll, ohne je dagewesen zu sein. */
  X.zerhackerVorrat=function(p,now){
    var stand=p&&p.zerhackerStand;
    if(!stand||stand<X.wochenStart(now))return 0;
    var offen=H.openTime(now)-H.openTime(stand);
    return Math.max(0,Math.min(X.ZERHACKER.vorratMax,Math.floor(offen/X.ZERHACKER.nachschub)));
  };

  /* Beim ersten Kontakt der Woche beginnt die Uhr. Danach ruehrt das hier
     nichts mehr an. */
  X.zerhackerUhrStellen=function(p,now){
    if(!p)return;
    if(!p.zerhackerStand||p.zerhackerStand<X.wochenStart(now))p.zerhackerStand=now;
  };
  /* Verbraucht einen Schlag. Ein lange unberuehrter Stand wird erst auf den
     vollen Beutel gezogen, sonst sammelte sich Guthaben ohne Grenze an. */
  /* Wie lange bis zum naechsten Schlag - fuer die Anzeige. */
  X.zerhackerWartezeit=function(p,now){
    var Z=X.ZERHACKER;if(X.zerhackerVorrat(p,now)>=Z.vorratMax)return 0;
    var stand=(p&&p.zerhackerStand)||now;
    if(stand<X.wochenStart(now))stand=now;
    var offen=H.openTime(now)-H.openTime(stand),bis=(Math.floor(Math.max(0,offen)/Z.nachschub)+1)*Z.nachschub;
    return Math.max(0,H.productionAt(H.openTime(stand)+bis)-now);
  };
  X.zerhackerVerbrauchen=function(p,now){
    var Z=X.ZERHACKER;X.zerhackerUhrStellen(p,now);
    var stand=H.openTime(p.zerhackerStand),voll=H.openTime(now)-Z.vorratMax*Z.nachschub;
    p.zerhackerStand=H.productionAt(Math.max(stand,voll)+Z.nachschub);
  };
  /* Wochennummer, die montags umspringt: der 1.1.1970 war ein Donnerstag,
     drei Tage Versatz ruecken den Wechsel auf Montag. */
  X.zerhackerWoche=function(now){return Math.floor((now+3*86400000)/(7*86400000));};
  X.zerhackerOrt=function(now){
    var Z=X.ZERHACKER,t=(now%Z.runde)/Z.runde*Math.PI*2;
    return {x:Math.cos(t)*Z.radius,z:Math.sin(t)*Z.radius*0.72-20,
            heading:Math.atan2(-Math.sin(t)*Z.radius,Math.cos(t)*Z.radius*0.72)};
  };
  /* Seine Lebenskraft waechst mit der Zahl der Leute in der Welt. Beide
     Aufrufstellen haben die Spielerzahl immer schon uebergeben - die Funktion
     hat sie nur nie angesehen und stur fuenftausend geliefert. Allein bleibt
     es dabei, jeder weitere legt achtzehnhundert drauf. */
  X.zerhackerKraft=function(spieler){
    var n=Math.max(1,Math.floor(spieler)||1),Z=X.ZERHACKER;
    return Math.min(Z.kraftMax,Z.kraft+(n-1)*Z.kraftJeSpieler);
  };
  /* Was ein Schlag austraegt, haengt an der eigenen Truppe - wer aufruestet,
     merkt es hier. */
  X.zerhackerSchaden=function(p){
    /* Dieselbe Rechnung wie im Kampf: Runenstufen und Wesen zaehlen hier genau
       so viel wie dort. Vorher stand hier eine eigene Formel mit zwei Punkten
       je Runenstufe - wer aufruestete, sah den Schaden anders steigen als
       erwartet. */
    var A=SG.gehstockmon.arena,summe=0;
    (p&&p.truppe||[]).forEach(function(id){var m=X.mon(p,id);if(m)summe+=A.stats(m).ang;});
    return Math.max(150,Math.round(summe*X.ZERHACKER.schadenJeStufe/100*X.rangBonus(p)));
  };

  X.upgradeLevel=function(n){return Number.isFinite(n)?Math.max(0,Math.min(X.UPGRADE_LIMIT,Math.floor(n))):0;};
  /* Das Wesen wird nicht mehr auf die Grundwerte gerechnet, sondern als Kennung
     durchgereicht - A.stats wendet es an, und nur dort kennt man den
     Seltenheitsfaktor, auf den es sich beziehen muss. */
  X.mon=function(p,id){var m=D.mon(id);if(!m)return m;
    var w=X.wesenVon&&X.wesenVon(p,id);
    return Object.assign({},m,{upgrade:X.upgradeLevel(p&&p.monUpgrades&&p.monUpgrades[id])},
      w?{wesenId:w.id,wesen:w.name}:{},p&&p.schimmernd&&p.schimmernd[id]?{schimmernd:true}:{});};
  X.DUNGEONS=[['Wurzelhöhle','Einfach','moosling',0,40],['Versunkene Grotte','Leicht','sumpfschnapper',35,105],['Kristallstollen','Mittel','donnerwidder',110,85],['Schattengewölbe','Schwer','runengolem',-80,-25],['Königsgrab','Sehr schwer','grabesritter',-110,-150],['Zeitenriss','Extrem','chronoschreiter',100,-95],['Abgrundtor','Apokalyptisch','endrichter',20,-130]].map(function(v,i){return{id:'dungeon-'+i,name:v[0],difficulty:v[1],bossId:v[2],x:v[3],z:v[4],rarity:i,reward:2+i%2};});
  X.SKINS=[{id:'wanderer',name:'Wanderer',color:'#ffffff',price:0},{id:'waldlaeufer',name:'Waldläufer',color:'#8ee6ad',price:150},{id:'frostwanderer',name:'Frostwanderer',color:'#83cfff',price:300},{id:'aschenritter',name:'Ascheritter',color:'#ff9576',price:500},{id:'trainermeister',name:'Trainermeister',color:'#ffe07b',quest:'trainer3'},{id:'runensucher',name:'Runensucher',color:'#bd90ff',quest:'gather6'},{id:'weltenwanderer',name:'Weltenwanderer',color:'#71ffe3',quest:'visit9'}];
  X.SKINS.push({id:'knochenkoenig',name:'Knochenkönig',color:'#f0dfb5',price:2400},{id:'leerenreaper',name:'Leerenschnitter',color:'#ad79ff',price:5000},{id:'drachenritter',name:'Drachenritter',color:'#ff6254',price:8000});
  X.WEAPONS=[{id:'gehstock',name:'Reisestock',attack:20,price:0},{id:'eisenspeer',name:'Eisenspeer',attack:24,price:200},{id:'runenklinge',name:'Runenklinge',attack:28,price:450},{id:'sturmhammer',name:'Sturmhammer',attack:32,price:800}];
  X.WEAPONS.push({id:'titanenlanze',name:'Titanenlanze',attack:37,price:2500},{id:'weltenbrecher',name:'Weltenbrecher',attack:43,price:6500});
  X.QUESTS=[{id:'trainer1',name:'Der erste Trainingssieg',stat:'trainerWins',goal:1,gold:80},{id:'trainer3',name:'Mit Geduld zum Meister',stat:'trainerWins',goal:3,skin:'trainermeister'},{id:'visit3',name:'Drei Horizonte',stat:'visited',goal:3,gold:120},{id:'visit9',name:'Die ganze Insel',stat:'visited',goal:9,skin:'weltenwanderer'},{id:'gather6',name:'Runensuche',stat:'gathered',goal:6,skin:'runensucher'},{id:'hatch1',name:'Ein neuer Begleiter',stat:'hatched',goal:1,gold:100},{id:'upgrade1',name:'Ein sicherer Rückzugsort',stat:'upgrades',goal:1,gold:100}];
  X.skin=function(id){return X.SKINS.find(function(v){return v.id===id;})||X.SKINS[0];};
  /* Titel (27.09.2026): Anerkennung fuer verschiedene Spielweisen, sichtbar
     unter dem Namen auf der Insel und in der Arena-Liste. Rein kosmetisch -
     kein Gold, keine Werte. Erreicht ist ein Titel, sobald sein Zaehler das
     Ziel erreicht; gespeichert wird nur, welchen man gerade traegt. Die Ziele
     sind an den Daten vom 26.09. ausgerichtet (Median nach knapp zwei Wochen:
     31 Eier, 26 Arten, 24 Trainer, 2 Eroberungen). */
  X.TITEL=[
    {id:'brutmeister',   name:'Brutmeister',   was:'Eier ausgebrütet',            ziel:100,  wert:function(p){return (p.progress&&p.progress.hatched)||0;}},
    {id:'sammler',       name:'Sammler',       was:'Mon-Arten in der Sammlung',   ziel:40,   wert:function(p){return (p.besitz||[]).length;}},
    {id:'kundschafter',  name:'Kundschafter',  was:'Biome erkundet',              ziel:9,    wert:function(p){return (p.visited||[]).length;}},
    {id:'runenjaeger',   name:'Runenjäger',    was:'verlorene Runen gesammelt',   ziel:50,   wert:function(p){return (p.progress&&p.progress.gathered)||0;}},
    {id:'trainerschreck',name:'Trainerschreck',was:'Wandertrainer besiegt',       ziel:60,   wert:function(p){return (p.progress&&p.progress.trainerWins)||0;}},
    {id:'arenaheld',     name:'Arenaheld',     was:'Siege in der Großen Arena',   ziel:25,   wert:function(p){return p.arenaSiegeGesamt||0;}},
    {id:'eroberer',      name:'Eroberer',      was:'Gebiete erobert',             ziel:5,    wert:function(p){return p.siege||0;}},
    {id:'zerhackerschreck',name:'Zerhacker-Schreck',was:'Schaden am Zerhacker',   ziel:8000, wert:function(p){return p.zerhackerGesamt||0;}},
    {id:'streifzuegler', name:'Streifzügler',  was:'Streifzüge beendet',          ziel:25,   wert:function(p){return p.streifzuegeGesamt||0;}}
  ];
  X.titelErreicht=function(p){return X.TITEL.filter(function(t){return t.wert(p||{})>=t.ziel;}).map(function(t){return t.id;});};
  /* Der Titel, den man traegt - nur, wenn er noch gilt. */
  X.titelName=function(p){var t=p&&p.titel&&X.TITEL.find(function(v){return v.id===p.titel;});return t&&t.wert(p)>=t.ziel?t.name:null;};
  /* Wer in einer Woche den meisten Schaden am Zerhacker macht, traegt in der
     naechsten den Erstschlag - ein Zehntel mehr Schlagkraft. So entsteht ein
     Wettstreit mitten in der Zusammenarbeit. */
  X.ERSTSCHLAG_BONUS=1.1;

  /* Kopfgeld: Wer die meisten Gebiete haelt, wird zur Zielscheibe. Das ist
     die Bremse gegen den einen, der sonst uneinholbar davonzieht - und es
     gibt den uebrigen ein gemeinsames Ziel, ohne dass sie sich absprechen. */
  X.KOPFGELD_AB=2;X.KOPFGELD_JE_GEBIET=150;
  X.kopfgeld=function(gebieteJeSpieler){
    var beste=null,zweit=0;
    Object.keys(gebieteJeSpieler||{}).forEach(function(id){
      var n=gebieteJeSpieler[id];
      if(!beste||n>beste.anzahl){zweit=beste?beste.anzahl:0;beste={id:id,anzahl:n};}
      else if(n>zweit)zweit=n;
    });
    if(!beste||beste.anzahl<X.KOPFGELD_AB||beste.anzahl<=zweit)return null;
    return {id:beste.id,anzahl:beste.anzahl,gold:beste.anzahl*X.KOPFGELD_JE_GEBIET};
  };

  /* Die Aussenseiterhilfe. Das Kopfgeld bremst den Fuehrenden nur bei
     Ueberfaellen - beim Kampf um Gebiete half es niemandem, und genau dort
     entscheidet sich, wer davonzieht. Wer weniger Land haelt als sein Ziel,
     schlaegt jetzt haerter zu: acht Prozent je Gebiet Unterschied, bei vierzig
     gedeckelt. Dem Fuehrenden wird dabei nichts weggenommen - er wird nur
     angreifbar, und das ist der Unterschied zwischen Bremse und Strafe. */
  X.AUSSENSEITER_JE_GEBIET=.08;X.AUSSENSEITER_MAX=.4;
  /* Wie ein Zuschlag im Kampf ankommt: voll auf die KP, zur Haelfte auf den
     Angriff (A.create rechnet ihn wie den Ausbau eines Gebiets). Die Texte
     versprachen lange "+X % KP und Angriff" - jetzt steht da, was wirkt. */
  X.zuschlagText=function(anteil){return '+'+Math.round(anteil*100)+' % KP und +'+Math.round(anteil*50)+' % Angriff';};
  X.aussenseiterBonus=function(meine,seine){
    var m=Math.max(0,Math.floor(meine)||0),s=Math.max(0,Math.floor(seine)||0);
    if(s<=m)return 0;
    return Math.min(X.AUSSENSEITER_MAX,(s-m)*X.AUSSENSEITER_JE_GEBIET);
  };

  /* Die Fehde: eine Woche lang gegeneinander, aus allem was man ohnehin tut.
     Verloren geht dabei nichts ausser der Woche - genau deshalb kann man sie
     unter Freunden austragen. */
  X.FEHDE_PUNKTE={trainer:10,rune:4,ei:6,tiefe:25,zerhacker:1/200,gebiet:15};
  /* Am Wochenwechsel wird abgerechnet. Das fehlte: die Punkte standen in der
     Oberflaeche, und montags waren sie samt Woche verschwunden, ohne dass
     jemand etwas davon hatte. Verlieren kann man dabei weiterhin nichts - der
     Unterlegene nimmt seinen Trost mit. */
  X.FEHDE_LOHN=500;X.FEHDE_TROST=150;
  X.fehdePunkte=function(zaehler){
    var z=zaehler||{},P=X.FEHDE_PUNKTE;
    return Math.round((z.trainer||0)*P.trainer+(z.rune||0)*P.rune+(z.ei||0)*P.ei
      +(z.tiefe||0)*P.tiefe+(z.zerhacker||0)*P.zerhacker+(z.gebiet||0)*P.gebiet);
  };

  /* Der Trainerrang waechst an allem, was man ohnehin tut, und gibt kleine
     Zuschlaege auf den eigenen Schaden. Er laesst sich nicht kaufen und nicht
     verlieren - das ist der ruhige Fortschritt neben Gold und Runen. */
  X.RAENGE=[{name:'Wanderer',ab:0},{name:'Späher',ab:60},{name:'Fährtenleser',ab:150},
            {name:'Hüter',ab:300},{name:'Meister',ab:550},{name:'Legende',ab:900}];
  X.erfahrung=function(p){
    /* Die erkundeten Biome stehen in p.visited und nicht in p.progress - dort
       hat die Summe frueher danach gegriffen und dabei immer null gefunden.
       Neun Gebiete sind zweiundsiebzig Punkte, und die zweite Rangstufe
       beginnt bei sechzig: der Fehler hat den halben Aufstieg verschluckt. */
    var g=(p&&p.progress)||{},besucht=((p&&p.visited)||[]).length;
    return (g.trainerWins||0)*10+(g.gathered||0)*4+(g.hatched||0)*6
         +besucht*8+(g.upgrades||0)*5+Math.floor((p&&p.zerhackerGesamt||0)/400);
  };
  X.rang=function(p){
    var e=X.erfahrung(p),stufe=0;
    for(var i=0;i<X.RAENGE.length;i++)if(e>=X.RAENGE[i].ab)stufe=i;
    var naechster=X.RAENGE[stufe+1]||null;
    return {stufe:stufe,name:X.RAENGE[stufe].name,erfahrung:e,
            bis:naechster?naechster.ab:null,naechster:naechster?naechster.name:null};
  };
  /* Zwei Prozent mehr Schlagkraft je Rangstufe. */
  X.rangBonus=function(p){return 1+X.rang(p).stufe*0.02;};

  /* Die Grosse Arena in Stockhafen. Hier kaempft man gegen die gespeicherte
     Truppe eines anderen - der muss dafuer nicht da sein und verliert auch
     nichts. Das macht sie zum einzigen Spielerkampf, den man jederzeit haben
     kann, und zur Einnahmequelle fuer alle ohne Gebiet.

     Ueber allem steht genau ein Gehstock-Champion. Solange ihn niemand
     geschlagen hat, haelt ihn ein Meister des Hauses: es gibt also vom ersten
     Tag an einen Titeltraeger und nie eine leere Tafel. */
  X.ARENA_PAUSE=8*60000;X.ARENA_LOHN=45;X.ARENA_TROST=10;
  /* Der Lohn richtet sich nach dem Gegner (27.09.2026). Vorher brachte jeder
     Sieg 45 Gold - auch gegen Stocklehrling Pim mit vier Gewoehnlichen, und
     den konnte man alle acht Minuten schlagen: bis zu 330 Gold die Stunde,
     sechsmal so viel wie eine Festung. Die Stufen sind dieselben, die die
     Arena neben jedem Gegner anzeigt (unter 85 % bzw. ueber 115 % der eigenen
     Staerke). */
  X.ARENA_LOHN_STUFEN={leichter:15,ausgeglichen:45,schwerer:70};
  X.arenaLohn=function(stufe){return X.ARENA_LOHN_STUFEN[stufe]||X.ARENA_LOHN;};
  X.RUHM_START=1000;X.RUHM_SIEG=25;X.RUHM_NIEDERLAGE=12;X.RUHM_TITEL=60;
  X.TITEL_PAUSE=40*60000;X.TITEL_SIEGE=3;
  X.CHAMPION_SOLD=400;
  X.HAUSMEISTER={id:null,name:'Meister Gehstock',
    squad:[{id:'titanenkrone',upgrade:3},{id:'weltenfresser',upgrade:3},{id:'sternengeweih',upgrade:3},{id:'leerenwyrm',upgrade:3}]};
  /* Drei Gegner des Hauses, damit die Arena auch dann etwas taugt, wenn
     ausser dir gerade niemand in der Welt ist. Sie stehen immer am Ende der
     Liste, hinter allen echten Leuten. */
  X.ARENA_GEGNER=[
    {id:'haus-1',name:'Stocklehrling Pim',ruhm:900,haus:true,
     squad:[{id:'kieselkrabb',upgrade:1},{id:'glutfuchs',upgrade:1},{id:'nebelmolch',upgrade:1},{id:'rostknirps',upgrade:1}]},
    {id:'haus-2',name:'Wachmeisterin Rade',ruhm:1150,haus:true,
     squad:[{id:'korallenwacht',upgrade:2},{id:'dornenwolf',upgrade:2},{id:'pilzhueter',upgrade:2},{id:'obsidianrabe',upgrade:2}]},
    {id:'haus-3',name:'Turnierritter Hald',ruhm:1450,haus:true,
     squad:[{id:'runengolem',upgrade:3},{id:'aschenhydra',upgrade:3},{id:'seelenqualle',upgrade:3},{id:'kristallspinne',upgrade:3}]}
  ];
  X.arenaGegner=function(id){return X.ARENA_GEGNER.find(function(v){return v.id===id;})||null;};
  X.ruhm=function(p){var n=p&&p.arenaRuhm;return Number.isFinite(n)?Math.max(0,Math.min(99999,Math.floor(n))):X.RUHM_START;};
  X.arenaSiege=function(p){var n=p&&p.arenaSiege;return Number.isFinite(n)?Math.max(0,Math.floor(n)):0;};
  /* Der Sold laeuft mit dem Titel aus - sonst waere der erste Champion auf
     ewig im Vorteil. Was bleibt, ist der Eintrag in der Chronik. */
  X.championSold=function(tage){return Math.max(0,Math.floor(tage))*X.CHAMPION_SOLD;};

  /* Stockhafen fuer alle ohne Gebiet: geregelte Arbeit statt Almosen. Beides
     reift nur waehrend der Oeffnungszeiten, genau wie die Eier auf einem
     Aussenposten - nachts und am Wochenende passiert nichts. */
  X.TAGWERK_ZEIT=2*3600000;X.TAGWERK_LOHN=80;X.TAGWERK_VORRAT=3;
  /* Das Findelhaus gab frueher alle vier geoeffneten Stunden ein Ei - wer
     sein letztes Gebiet am Vormittag verlor, bekam das erste frueh am
     naechsten Tag, und in der Testzone nie. Jetzt ist es eins je geoeffneter
     Stunde, bis zu zwei liegen bereit, und wer neu dazukommt, findet sofort
     eins vor. */
  X.FINDELEI_ZEIT=3600000;X.FINDELEI_VORRAT=2;X.FINDELEI_FELD=6;
  function reif(stand,now,dauer,hoechstens){
    if(!Number.isFinite(stand))return {fertig:0,stand:now};
    var offen=H.openTime(now)-H.openTime(stand),n=Math.max(0,Math.floor(offen/dauer));
    return {fertig:Math.min(hoechstens,n),stand:stand};
  }
  X.tagwerkStand=function(p,now){return reif(p&&p.tagwerkAt,now,X.TAGWERK_ZEIT,X.TAGWERK_VORRAT);};
  X.tagwerkWartezeit=function(p,now){
    var stand=p&&p.tagwerkAt;if(!Number.isFinite(stand))return 0;
    var offen=H.openTime(now)-H.openTime(stand),bis=(Math.floor(Math.max(0,offen)/X.TAGWERK_ZEIT)+1)*X.TAGWERK_ZEIT;
    return Math.max(0,H.productionAt(H.openTime(stand)+bis)-now);
  };
  /* Verbraucht genau ein Tagwerk und laesst angefangene Zeit stehen. */
  X.tagwerkVerbrauchen=function(p,now){
    var voll=H.openTime(now)-X.TAGWERK_VORRAT*X.TAGWERK_ZEIT;
    p.tagwerkAt=H.productionAt(Math.max(H.openTime(p.tagwerkAt),voll)+X.TAGWERK_ZEIT);
  };
  X.findeleiStand=function(p,now){return reif(p&&p.findeleiAt,now,X.FINDELEI_ZEIT,X.FINDELEI_VORRAT);};
  X.findeleiFertig=function(p,now){return X.findeleiStand(p,now).fertig>0;};
  X.findeleiWartezeit=function(p,now){
    var stand=p&&p.findeleiAt;if(!Number.isFinite(stand))return 0;
    if(X.findeleiStand(p,now).fertig>=X.FINDELEI_VORRAT)return 0;
    var offen=H.openTime(now)-H.openTime(stand),bis=(Math.floor(Math.max(0,offen)/X.FINDELEI_ZEIT)+1)*X.FINDELEI_ZEIT;
    return Math.max(0,H.productionAt(H.openTime(stand)+bis)-now);
  };
  /* Nimmt genau ein Ei heraus und laesst angefangene Zeit stehen. */
  X.findeleiVerbrauchen=function(p,now){
    var voll=H.openTime(now)-X.FINDELEI_VORRAT*X.FINDELEI_ZEIT;
    p.findeleiAt=H.productionAt(Math.max(H.openTime(p.findeleiAt),voll)+X.FINDELEI_ZEIT);
  };
  /* Ein Stand, bei dem schon so viele fertig sind: fuer neue Spieler und die
     Testzone. */
  X.schonReif=function(now,dauer,anzahl){return H.productionAt(Math.max(0,H.openTime(now)-dauer*anzahl));};

  /* Der Tauschposten in Stockhafen. Es gibt Zwillinge, es gibt Wesen, es gibt
     57 Mons - aber bisher keinen Weg, ein misslungenes Wesen loszuwerden oder
     gezielt an ein fehlendes Mon zu kommen. Getauscht wird Mon gegen Mon, und
     zwar nur innerhalb derselben Seltenheit: sonst fuettert ein zweites Konto
     in einer Viertelstunde das erste hoch.

     Was man verschenkt, verliert man wirklich - samt Runenstufe und Wesen.
     Das haelt den Tausch zu einer Entscheidung und nicht zu einem Verleih. */
  X.TAUSCH_MAX=12;X.TAUSCH_DAUER=7*86400000;
  X.tauschErlaubt=function(p,gebeId,sucheId){
    var gebe=D.mon(gebeId),suche=D.mon(sucheId);
    if(!gebe||!suche)return 'Dieses Mon gibt es nicht.';
    if(gebe.id===suche.id)return 'Such dir etwas anderes aus, als du anbietest.';
    if(gebe.seltenheit!==suche.seltenheit)return 'Getauscht wird nur innerhalb derselben Seltenheit.';
    if(!p.besitz||p.besitz.indexOf(gebe.id)<0)return 'Dieses Mon besitzt du nicht.';
    /* Auch eine Gebietsbesatzung ist Dienst. Vorher sperrte nur das Kampfteam,
       und wer ein Mon von einem Aussenposten weggab, liess dort eine
       Verteidigung stehen, die ihm nicht mehr gehoerte. */
    var orte=X.einsatzOrte(p,gebe.id);
    if(orte.length)return gebe.name+' steht im Dienst ('+X.einsatzListe(orte)+'). Zieh es erst ab.';
    return null;
  };

  /* Jedes geschluepfte Mon bringt ein Wesen mit. Damit ist nicht mehr jeder
     Donnerwidder derselbe - und es gibt einen Grund, Eier zu tauschen. */
  /* Anteile statt fester Punkte. Frueher stand hier "+8 KP" auf den Grundwert
     - und der wird im Kampf mit dem Seltenheitsfaktor multipliziert. Bei einem
     Apokalyptischen waren acht Punkte von knapp vierhundert nichts, und in
     A.stats kamen sie ohnehin nie an: das Wesen war reine Anzeige. Jetzt
     zaehlt es bei jedem Mon gleich viel. Tempo bleibt absolut, weil es die
     einzige Zahl ist, die nicht mitskaliert. */
  X.WESEN=[
    {id:'ruhig',    name:'ruhig',     hp: .06, ang:    0, tempo: 0},
    {id:'stuermisch',name:'stürmisch',hp:-.04, ang:    0, tempo: 1},
    {id:'stur',     name:'stur',      hp: .09, ang: -.03, tempo: 0},
    {id:'wild',     name:'wild',      hp:-.05, ang:  .07, tempo: 0},
    {id:'flink',    name:'flink',     hp:    0, ang: -.03, tempo: 2},
    {id:'treu',     name:'treu',      hp: .04, ang:  .02, tempo: 0}
  ];
  /* Wie ein Wesen sich anfuehlt, in einem Satz fuer die Anzeige. */
  X.wesenText=function(w){
    if(!w)return '';
    var teile=[];
    if(w.hp)teile.push((w.hp>0?'+':'')+Math.round(w.hp*100)+' % KP');
    if(w.ang)teile.push((w.ang>0?'+':'')+Math.round(w.ang*100)+' % Angriff');
    if(w.tempo)teile.push((w.tempo>0?'+':'')+w.tempo+' Tempo');
    return teile.join(' · ');
  };
  X.wesen=function(id){return X.WESEN.find(function(v){return v.id===id;})||null;};
  X.wesenVon=function(p,monId){return X.wesen(p&&p.wesen&&p.wesen[monId]);};
  X.wesenZuweisen=function(p,monId,zufall){
    p.wesen=p.wesen||{};
    if(!p.wesen[monId])p.wesen[monId]=X.WESEN[Math.min(X.WESEN.length-1,Math.floor(zufall*X.WESEN.length))].id;
    return X.wesen(p.wesen[monId]);
  };

  /* Waffen lassen sich mit Runen schaerfen, genau wie Mons aufgewertet
     werden. Damit bleibt auch der Reisestock eines Anfaengers brauchbar und
     die Runen aus den Dungeons haben ein zweites Ziel. */
  X.SCHLIFF_LIMIT=5;X.SCHLIFF_PLUS=3;
  X.schliff=function(p,id){var n=p&&p.waffenSchliff&&p.waffenSchliff[id];
    return Number.isFinite(n)?Math.max(0,Math.min(X.SCHLIFF_LIMIT,Math.floor(n))):0;};
  X.schliffKosten=function(stufe){return stufe+1;};
  X.waffenWert=function(p,id){return X.weapon(id).attack+X.schliff(p,id)*X.SCHLIFF_PLUS;};

  /* Ruestung kommt aus den Dungeons: Wer einen Boss zum ersten Mal legt,
     nimmt sein Fundstueck mit. Sie daempft, was ein Gehstock im Waffenduell
     anrichtet - gegen Mons hilft sie nicht. */
  X.RUESTUNGEN=[
    {id:'wanderweste',  name:'Wanderweste',   schutz:8,  von:'dungeon-0'},
    {id:'lederpanzer',  name:'Lederpanzer',   schutz:12, von:'dungeon-1'},
    {id:'kettenhemd',   name:'Kettenhemd',    schutz:16, von:'dungeon-2'},
    {id:'schuppenrock', name:'Schuppenrock',  schutz:20, von:'dungeon-3'},
    {id:'runenharnisch',name:'Runenharnisch', schutz:25, von:'dungeon-4'},
    {id:'drachenplatte',name:'Drachenplatte', schutz:30, von:'dungeon-5'},
    {id:'weltenwall',   name:'Weltenwall',    schutz:35, von:'dungeon-6'}
  ];
  X.ruestung=function(id){return X.RUESTUNGEN.find(function(v){return v.id===id;})||null;};
  X.ruestungFuer=function(dungeonId){return X.RUESTUNGEN.find(function(v){return v.von===dungeonId;})||null;};
  X.schutzWert=function(p){var r=p&&p.panzer&&X.ruestung(p.panzer);return r?r.schutz:0;};
  /* Was ein Schlag im Duell austraegt: Waffe mal Haltung, gedaempft durch die
     Deckung des Gegners und seine Ruestung. */
  X.duellSchaden=function(angreifer,waffe,zug,deckung,verteidiger){
    var roh=X.waffenWert(angreifer,waffe)*X.rangBonus(angreifer)*(zug==='guard'?.4:zug==='heavy'?1.4:1)*(deckung?.35:1);
    return Math.max(1,Math.round(roh*(1-X.schutzWert(verteidiger)/100)));
  };

  X.weapon=function(id){return X.WEAPONS.find(function(v){return v.id===id;})||X.WEAPONS[0];};
  var previous=D.neuerStand;
  D.neuerStand=function(save,now){var p=previous(save,now),old=save||{};now=Number.isFinite(now)?now:Date.now();
    p.joinedAt=Number.isFinite(old.joinedAt)?old.joinedAt:now;
    p.skins=X.SKINS.filter(function(s){return s.id==='wanderer'||(old.skins||[]).indexOf(s.id)>=0;}).map(function(s){return s.id;});
    p.weapons=X.WEAPONS.filter(function(w){return w.id==='gehstock'||(old.weapons||[]).indexOf(w.id)>=0;}).map(function(w){return w.id;});
    p.skin=p.skins.indexOf(old.skin)>=0?old.skin:'wanderer';p.weapon=p.weapons.indexOf(old.weapon)>=0?old.weapon:'gehstock';
    p.waffenSchliff=Object.assign({},old.waffenSchliff);p.wesen=Object.assign({},old.wesen);p.zerhackerGesamt=Math.max(0,Math.floor(old.zerhackerGesamt)||0);
    p.ruestungen=X.RUESTUNGEN.filter(function(r){return (old.ruestungen||[]).indexOf(r.id)>=0;}).map(function(r){return r.id;});
    p.panzer=p.ruestungen.indexOf(old.panzer)>=0?old.panzer:null;
    p.progress={};['trainerWins','gathered','hatched','upgrades'].forEach(function(k){p.progress[k]=Math.max(0,Math.floor(Number(old.progress&&old.progress[k])||0));});
    p.visited=D.FELDER.map(function(f){return f.id;}).filter(function(id){return(old.visited||[]).indexOf(id)>=0;});
    p.claimedQuests=X.QUESTS.filter(function(q){return(old.claimedQuests||[]).indexOf(q.id)>=0;}).map(function(q){return q.id;});
    p.encounterClaims=Array.isArray(old.encounterClaims)?old.encounterClaims.slice(-100):[];
    p.rewardEggs={};D.FELDER.forEach(function(f){var n=Math.max(0,Math.floor(Number(old.rewardEggs&&old.rewardEggs[f.id])||0));if(n)p.rewardEggs[f.id]=n;});
    p.runes=D.SELTENHEITEN.map(function(r,i){var n=old.runes&&old.runes[i];return Number.isFinite(n)?Math.max(0,Math.min(9999,Math.floor(n))):0;});
    p.monUpgrades={};p.besitz.forEach(function(id){var n=X.upgradeLevel(old.monUpgrades&&old.monUpgrades[id]);if(n)p.monUpgrades[id]=n;});
    p.raidCooldown=Number(old.raidCooldown)||0;p.raidShield=Number(old.raidShield)||0;
    /* Ein Plan wird nur behalten, wenn er zu den heutigen Bausteinen passt.
       Wer keinen gesetzt hat, bekommt keinen - ohne Plan greift im Kampf die
       alte Heuristik, und das ist genau der bisherige Zustand. */
    var A=SG.gehstockmon.arena;p.plaene={};
    if(A&&A.planGueltig)p.besitz.forEach(function(id){
      var alt=old.plaene&&old.plaene[id];
      if(A.planGueltig(alt))p.plaene[id]=alt.map(function(z){return z.slice(0,2);});
    });
    /* Besatzungen ueberleben nur, solange sie vollstaendig sind und dem
       Spieler gehoeren. Ein getauschtes oder verschenktes Mon raeumt seinen
       Posten damit von selbst. Ueberschneiden duerfen sie sich. */
    p.posten={};
    D.FELDER.forEach(function(f){
      var t=old.posten&&old.posten[f.id];
      if(!Array.isArray(t)||t.length!==X.TRUPPE||new Set(t).size!==X.TRUPPE)return;
      if(t.some(function(id){return typeof id!=='string'||!D.mon(id)||p.besitz.indexOf(id)<0;}))return;
      p.posten[f.id]=t.slice();
    });
    p.brutplaetze=X.gekaufteBrutplaetze(old);
    p.arenaRuhm=X.ruhm(old);p.arenaSiege=X.arenaSiege(old);
    /* arenaSiege zaehlt nur bis zum naechsten Titelkampf und faellt dann auf
       null. Die Bilanz dagegen bleibt: Kaempfe und Siege seit Beginn. */
    p.arenaVersuche=Math.max(0,Math.floor(Number(old.arenaVersuche)||0));
    p.arenaSiegeGesamt=Math.max(p.arenaSiege,Math.floor(Number(old.arenaSiegeGesamt)||0));
    p.arenaCooldown=Number(old.arenaCooldown)||0;p.titelCooldown=Number(old.titelCooldown)||0;
    /* Wer zum ersten Mal in die Stadt kommt, faengt sofort an zu verdienen:
       beide Uhren starten jetzt, nicht bei null. */
    p.tagwerkAt=Number.isFinite(old.tagwerkAt)?old.tagwerkAt:now;
    p.findeleiAt=Number.isFinite(old.findeleiAt)?old.findeleiAt:X.schonReif(now,X.FINDELEI_ZEIT,1);
    p.championSeit=Number.isFinite(old.championSeit)?old.championSeit:null;
    p.championTitel=Math.max(0,Math.floor(Number(old.championTitel)||0));
    /* Goldwaren: an welchem Tag zuletzt beim Haendler gekauft, und ob eine
       Schimmerperle auf das naechste Schluepfen wartet. */
    p.haendlerTag=Number.isFinite(old.haendlerTag)?Math.floor(old.haendlerTag):null;
    p.titel=X.TITEL.some(function(t){return t.id===old.titel;})?old.titel:null;
    /* Streifzuege: nur vollstaendige, fuer eigene Mons, hoechstens zwei. */
    p.streifzuege=(Array.isArray(old.streifzuege)?old.streifzuege:[]).filter(function(z){
      return z&&typeof z.id==='string'&&p.besitz.indexOf(z.monId)>=0&&!!X.streifzugZiel(z.ziel)&&X.STREIFZUG_DAUERN.indexOf(z.dauer)>=0
        &&Number.isFinite(z.start)&&Number.isFinite(z.fertigAt)&&!!z.ergebnis&&typeof z.ergebnis==='object';
    }).slice(0,X.STREIFZUG_PLAETZE).map(function(z){var e=z.ergebnis;return {id:z.id.slice(0,80),monId:z.monId,ziel:z.ziel,dauer:z.dauer,start:z.start,fertigAt:z.fertigAt,
      ergebnis:{runen:Math.max(0,Math.min(20,Math.floor(Number(e.runen)||0))),rang:Math.max(0,Math.min(D.SELTENHEITEN.length-1,Math.floor(Number(e.rang)||0))),gold:Math.max(0,Math.min(1000,Math.floor(Number(e.gold)||0))),ei:e.ei===true}};});
    p.streifzuegeGesamt=Math.max(0,Math.floor(Number(old.streifzuegeGesamt)||0));
    p.schimmerperle=old.schimmerperle===true;return p;
  };
  X.progress=function(p,q){return q.stat==='visited'?p.visited.length:p.progress[q.stat]||0;};
  /* Ueberfallschutz gibt es nur noch aus einem Grund: Wer gerade bestohlen
     wurde, hat zwei Stunden Ruhe. Der fruehere Anfaengerschutz - 24 Stunden
     Spielalter und sechs Mons - ist weg. Ein Ei traegt man auf eigenes
     Risiko, und zwar von der ersten Minute an. */
  X.UEBERFALL_PAUSE=30*60000;
  X.protected=function(p,now){return p.raidShield>now;};
  X.riverCenter=function(z){return 72+Math.sin(z*.02)*12;};
  X.polygonContains=function(p,points){var inside=false;for(var i=0,j=points.length-1;i<points.length;j=i++){var a=points[i],b=points[j];if((a.z>p.z)!==(b.z>p.z)&&p.x<(b.x-a.x)*(p.z-a.z)/(b.z-a.z)+a.x)inside=!inside;}return inside;};
  var coast=D.WORLD.coast.map(function(v){return{x:v[0],z:v[1]};});
  for(var smooth=0;smooth<2;smooth++){var nextCoast=[];coast.forEach(function(a,i){var b=coast[(i+1)%coast.length];[.18,.82].forEach(function(t){nextCoast.push({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});});});coast=nextCoast;}
  X.coast=function(){return coast;};
  X.onLand=function(p){return Number.isFinite(p.x)&&Number.isFinite(p.z)&&(Math.abs(p.x)<220&&Math.abs(p.z)<180||X.polygonContains(p,X.coast())&&X.coast().every(function(a,i,points){return pointDistance(p,a,points[(i+1)%points.length])>2;}));};
  X.waterAt=function(p){return Math.abs(p.x-X.riverCenter(p.z))<5.3&&!D.WORLD.bridgeZ.some(function(z){return Math.abs(p.z-z)<2.6;});};
  X.walkable=function(p){return X.onLand(p)&&!X.waterAt(p)&&!X.imArenaBau(p);};
  X.landTravel=function(a,b){if(!X.walkable(a)||!X.walkable(b))return false;var n=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/2);for(var i=1;i<n;i++)if(!X.walkable({x:a.x+(b.x-a.x)*i/n,z:a.z+(b.z-a.z)*i/n}))return false;return true;};
  // Unregelmäßige Reviere; die zwei angrenzenden Wald-/Wiesengebiete können verschmelzen.
  X.cells=function(){var cells=D.BIOME.map(function(b,i){return Array.from({length:7},function(_,j){var a=(j/7)*Math.PI*2+i*.31;return{x:b.x+Math.cos(a)*(45+i%3*3),z:b.z+Math.sin(a)*(39+i%2*4)};});});
    cells[0]=[[-209,76],[-175,48],[-110,50],[-110,140],[-169,147],[-211,119]].map(function(v){return{x:v[0],z:v[1]};});
    cells[5]=[[-110,50],[-56,71],[-18,112],[-35,164],[-87,171],[-110,140]].map(function(v){return{x:v[0],z:v[1]};});return cells;};
  X.biomeOutline=function(i,scale){var b=D.BIOME[i];return Array.from({length:64},function(_,j){var a=j/64*Math.PI*2,r=(1+.10*Math.sin(a*3+i)+.065*Math.cos(a*5-i))*(scale||1);return{x:b.x+Math.cos(a)*r*(48+i%3*3),z:b.z+Math.sin(a)*r*(42+i%2*4)};});};
  function pointKey(p){return p.x.toFixed(3)+','+p.z.toFixed(3);}
  X.layout=function(territories){var cells=X.cells(),edges={},parents=cells.map(function(c,i){return i;});
    function root(i){while(parents[i]!==i)i=parents[i];return i;}
    cells.forEach(function(cell,i){cell.forEach(function(a,j){var b=cell[(j+1)%cell.length],key=[pointKey(a),pointKey(b)].sort().join('|');if(!edges[key])edges[key]={a:a,b:b,fields:[]};edges[key].fields.push(i);});});
    Object.values(edges).forEach(function(e){if(e.fields.length!==2)return;var a=e.fields[0],b=e.fields[1];if(territories[a]&&territories[b]&&territories[a].ownerId&&territories[a].ownerId===territories[b].ownerId)parents[root(b)]=root(a);});
    var groups={};cells.forEach(function(c,i){var r=root(i);if(!groups[r])groups[r]={id:r,ownerId:territories[i]&&territories[i].ownerId,fields:[],edges:[]};groups[r].fields.push(i+1);});
    Object.values(edges).forEach(function(e){var roots=Array.from(new Set(e.fields.map(root)));if(e.fields.length===2&&roots.length===1)return;roots.forEach(function(r){groups[r].edges.push({a:e.a,b:e.b});});});
    return Object.values(groups).map(function(g){var center=g.fields.reduce(function(c,id){c.x+=D.BIOME[id-1].x/g.fields.length;c.z+=D.BIOME[id-1].z/g.fields.length;return c;},{x:0,z:0});
      var inset=g.fields.length>1?.8:.76;
      g.edges=g.edges.map(function(e){return{a:{x:center.x+(e.a.x-center.x)*inset,z:center.z+(e.a.z-center.z)*inset},b:{x:center.x+(e.b.x-center.x)*inset,z:center.z+(e.b.z-center.z)*inset}};});
      var candidates=g.edges.filter(function(e){return Math.hypot(e.a.x-e.b.x,e.a.z-e.b.z)>10;});candidates.sort(function(a,b){return Math.hypot((a.a.x+a.b.x)/2,(a.a.z+a.b.z)/2)-Math.hypot((b.a.x+b.b.x)/2,(b.a.z+b.b.z)/2);});
      var edge=candidates[0]||g.edges[0],mx=(edge.a.x+edge.b.x)/2,mz=(edge.a.z+edge.b.z)/2,len=Math.hypot(edge.b.x-edge.a.x,edge.b.z-edge.a.z),dx=(edge.b.x-edge.a.x)/len,dz=(edge.b.z-edge.a.z)/len,nx=-dz,nz=dx;
      if(Math.abs(mx-X.riverCenter(mz))<14){mx+=dx*24;mz+=dz*24;}
      if((mx-center.x)*nx+(mz-center.z)*nz<0){nx=-nx;nz=-nz;}g.gate={x:mx,z:mz,dx:dx,dz:dz,nx:nx,nz:nz,edge:edge};g.center=center;return g;
    });};
  X.inside=function(p,g){var inside=false;g.edges.forEach(function(e){var a=e.a,b=e.b;if((a.z>p.z)!==(b.z>p.z)&&p.x<(b.x-a.x)*(p.z-a.z)/(b.z-a.z)+a.x)inside=!inside;});return inside;};
  function crosses(a,b,c,d){var rx=b.x-a.x,rz=b.z-a.z,sx=d.x-c.x,sz=d.z-c.z,den=rx*sz-rz*sx;if(Math.abs(den)<1e-8)return false;var u=((c.x-a.x)*rz-(c.z-a.z)*rx)/den,t=((c.x-a.x)*sz-(c.z-a.z)*sx)/den;return t>=0&&t<=1&&u>=0&&u<=1;}
  function pointDistance(p,a,b){var dx=b.x-a.x,dz=b.z-a.z,l=dx*dx+dz*dz,t=l?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/l)):0;return Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz);}
  function touches(a,b,c,d){return crosses(a,b,c,d)||Math.min(pointDistance(a,c,d),pointDistance(b,c,d),pointDistance(c,a,b),pointDistance(d,a,b))<1.1;}
  X.canTravel=function(layout,from,to,id){return X.landTravel(from,to)&&layout.every(function(g){return g.edges.every(function(e){if(e===g.gate.edge){var q=g.gate,left={x:q.x-q.dx*3,z:q.z-q.dz*3},right={x:q.x+q.dx*3,z:q.z+q.dz*3};if(touches(from,to,e.a,left)||touches(from,to,right,e.b))return false;return g.ownerId===id||!touches(from,to,left,right);}return!touches(from,to,e.a,e.b);});});};
  X.outside=function(point,layout){var p={x:point.x,z:point.z};for(var i=0;i<layout.length+1;i++){var g=layout.find(function(g){return X.inside(p,g);});if(!g)break;p={x:g.gate.x+g.gate.nx*4,z:g.gate.z+g.gate.nz*4};}return p;};
  /* Sichtgraph um Mauer-Ecken: dieselben Wege für Klicknavigation und Positionsprüfung. */
  X.route=function(layout,from,to,id,limit){limit=limit||Infinity;if(layout.some(function(g){return g.ownerId!==id&&X.inside(to,g);}))return null;
    if(X.canTravel(layout,from,to,id))return Math.hypot(to.x-from.x,to.z-from.z)<=limit?[to]:null;
    var nodes=[from,to],seen={};function add(p){var k=pointKey(p);if(seen[k]||!X.walkable(p)||layout.some(function(g){return g.ownerId!==id&&X.inside(p,g);}))return;seen[k]=true;nodes.push(p);}
    layout.forEach(function(g){g.edges.forEach(function(e){[e.a,e.b].forEach(function(p){var dx=p.x-g.center.x,dz=p.z-g.center.z,l=Math.hypot(dx,dz);add({x:p.x+dx/l*2.5,z:p.z+dz/l*2.5});});});var q=g.gate;[-1,1].forEach(function(s){add({x:q.x+q.nx*4*s,z:q.z+q.nz*4*s});});});
    D.WORLD.bridgeZ.forEach(function(z){[-1,1].forEach(function(side){add({x:X.riverCenter(z)+side*10,z:z});});});
    /* Acht Punkte im Kreis um die Arena: ohne sie bricht jede Sichtlinie, die
       das Rund schneidet, und die Wegsuche gaebe auf, statt aussen herum zu
       gehen. */
    for(var ecke=0;ecke<8;ecke++){var winkel=ecke/8*Math.PI*2;add({x:X.ARENA_BAU.x+Math.cos(winkel)*(X.ARENA_BAU.radius+2.5),z:X.ARENA_BAU.z+Math.sin(winkel)*(X.ARENA_BAU.radius+2.5)});}
    var dist=nodes.map(function(){return Infinity;}),prev=[],done={};dist[0]=0;
    for(var n=0;n<nodes.length;n++){var at=-1;for(var i=0;i<nodes.length;i++)if(!done[i]&&(at<0||dist[i]<dist[at]))at=i;if(at<0||dist[at]>limit||!Number.isFinite(dist[at]))break;if(at===1){var path=[];while(at!==0){path.unshift(nodes[at]);at=prev[at];}return path;}done[at]=true;
      for(var j=0;j<nodes.length;j++){if(done[j])continue;var d=dist[at]+Math.hypot(nodes[at].x-nodes[j].x,nodes[at].z-nodes[j].z);if(d<dist[j]&&d<=limit&&X.canTravel(layout,nodes[at],nodes[j],id)){dist[j]=d;prev[j]=at;}}
    }return null;
  };
  X.encounterPosition=function(e,now){if(e.kind!=='trainer')return{x:e.x,z:e.z};var t=(now-e.epochAt)/1000,ease=(Math.sin(t*.055+e.phase)+1)/2;return{x:e.homeX+(e.patrolX-e.homeX)*ease,z:e.homeZ+(e.patrolZ-e.homeZ)*ease};};
  X.encounters=function(now,territories){var epoch=Math.floor(now/X.SPAWN_TIME),seed=(epoch*7919+49217)>>>0,layout=X.layout(territories),out=[];
    function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
    for(var i=0;i<8;i++){var p;for(var tries=0;tries<200;tries++){p={x:(random()-.5)*D.WORLD.halfWidth*1.7,z:(random()-.5)*D.WORLD.halfDepth*1.7};if(X.canTravel(layout,p,p,'public')&&!layout.some(function(g){return X.inside(p,g);})&&!out.some(function(e){return Math.hypot(e.x-p.x,e.z-p.z)<30;}))break;}
      var goal={x:p.x,z:p.z};if(i<2)for(var attempt=0;attempt<30;attempt++){var a=random()*Math.PI*2,candidate={x:p.x+Math.cos(a)*48,z:p.z+Math.sin(a)*48};if(X.canTravel(layout,p,candidate,'public')){goal=candidate;break;}}
      if(tries===200||i<2&&goal.x===p.x&&goal.z===p.z){p={x:-60+i*35,z:20};goal={x:p.x+28,z:p.z};}
      var biome=0;D.BIOME.forEach(function(b,j){if(Math.hypot(b.x-p.x,b.z-p.z)<Math.hypot(D.BIOME[biome].x-p.x,D.BIOME[biome].z-p.z))biome=j;});
      var e={id:epoch+':'+i,kind:i<2?'trainer':'rune',name:i<2?['Trainerin Mira','Wandertrainer Bo'][i]:'Verlorene Rune',skinIndex:10+i%2,homeX:p.x,homeZ:p.z,patrolX:goal.x,patrolZ:goal.z,phase:random()*6.28,epochAt:epoch*X.SPAWN_TIME,x:p.x,z:p.z,territoryId:biome+1,expiresAt:(epoch+1)*X.SPAWN_TIME};Object.assign(e,X.encounterPosition(e,now));out.push(e);
    }return out;};
})(SG);

/* Rundenkampf: genau ein aktives Mon pro Seite, jede Spieleraktion ist explizit. */
(function (SG) {
  var D = SG.gehstockmon.daten, A = SG.gehstockmon.arena = {};
  var stats = [[132,20,3],[88,29,8],[112,22,5],[96,25,11]];
  /* Drei Faehigkeiten je Rolle statt einer. Vorher spielte sich jedes Bollwerk
     wie jedes andere Bollwerk, nur mit anderen Zahlen - bei 57 Mons war das die
     groesste Schwaeche am Sammeln. Jetzt entscheidet die Aufstellung, welche
     drei Werkzeuge man im Kampf hat.

     Die erste jeder Rolle ist die alte: bestehende Spielstaende behalten damit
     ihre gewohnte Attacke, wo die Verteilung sie ohnehin dort hinlegt. */
  A.FAEHIGKEITEN = [
    [ { id:'schildstoss', name:'Schildstoß',   text:'Schaden und danach ein Schild',              faktor:.9 },
      { id:'steinwall',   name:'Steinwall',    text:'Kein Schaden, dafür starker Schild und Heilung', faktor:0 },
      { id:'dornenpanzer',name:'Dornenpanzer', text:'Schaden, und der nächste Treffer fällt auf den Angreifer zurück', faktor:.7 } ],
    [ { id:'sichelstreich',name:'Sichelstreich',text:'Stärker gegen geschwächte Ziele',            faktor:1.35 },
      { id:'doppelhieb',  name:'Doppelhieb',   text:'Zwei Treffer hintereinander',                faktor:.72 },
      { id:'aderlass',    name:'Aderlass',     text:'Schaden, und ein Teil davon heilt dich',     faktor:1.05 } ],
    /* nurVerletzt bekommt, was bei vollem Leben wirklich nichts tut. Frueher
       hing die Sperre an der Rolle, und damit waren auch Sammelruf und
       Laeuterung bei vollem Leben tot - obwohl ihr Schild und ihr geschaerfter
       Treffer genau dann am meisten wert sind. */
    [ { id:'lebensquell', name:'Lebensquell',  text:'Heilt 32 % deiner KP',                       faktor:0, nurVerletzt:true },
      { id:'sammelruf',   name:'Sammelruf',    text:'Heilt 18 % und gibt ein Schild',             faktor:0 },
      { id:'laeuterung',  name:'Läuterung',    text:'Heilt 22 % und schärft deinen nächsten Treffer', faktor:0 } ],
    [ { id:'runenstoerung',name:'Runenstörung',text:'Schwächt den nächsten Treffer des Gegners',  faktor:.8 },
      { id:'blendstoss',  name:'Blendstoß',    text:'Nimmt dem Gegner eine Fähigkeitsladung',     faktor:.75 },
      { id:'windschnitt', name:'Windschnitt',  text:'Geht durch Deckung und Schilde hindurch',    faktor:1.15 } ]
  ];
  /* ------------------------------------------------------------------
     Zehn weitere Faehigkeiten (27.09.2026). Sie bringen, was es bisher gar
     nicht gab: Blutung und Heilung ueber mehrere Zuege, Laehmung, Rueckstoss,
     eine Heilung fuer die ganze Truppe und Faehigkeiten, die sich nach der
     Lage richten. Sie haengen hinten an ihrer Rolle - bestehende Indizes
     bleiben damit stehen.

     Anders als die ersten zwoelf wachsen sie mit der Seltenheit ihres Mons
     (skaliert): ihre Hauptwirkung ist bei einem gewoehnlichen Mon 85 %, bei
     einem epischen 100 % und bei einem apokalyptischen 115 % stark. Die
     Grundwerte selbst sind mit tools/gehstockmon-attacken-tests.mjs gegen die
     alten zwoelf eingemessen: keine gewinnt deutlich haeufiger als die
     bisherigen ihrer Rolle.
     ------------------------------------------------------------------ */
  A.SELTENHEIT_SKALA = [.85, .9, .95, 1, 1.05, 1.1, 1.15];
  function prozent(x) { return Math.round(x * 100); }
  /* Die Texte lesen ihre Zahlen aus den Werten daneben (this) - so koennen
     Beschreibung und Wirkung nie auseinanderlaufen. */
  A.FAEHIGKEITEN[0].push(
    { id:'erdstoss',   name:'Erdstoß',     skaliert:true, faktor:.85, verzoegerung:2,
      text:function (k) { return prozent(this.faktor * k) + ' % Schaden, und der Kraftschlag des Gegners lädt zwei Runden später'; } },
    { id:'vergeltung', name:'Vergeltung',  skaliert:true, faktor:.5, zuwachs:1.1,
      text:function (k) { return 'Je mehr KP dir fehlen, desto härter: ' + prozent(this.faktor * k) + ' bis ' + prozent((this.faktor + this.zuwachs) * k) + ' % Schaden'; } });
  A.FAEHIGKEITEN[1].push(
    { id:'sturmangriff',  name:'Sturmangriff',  skaliert:true, faktor:1.45, rueckstoss:.15,
      text:function (k) { return prozent(this.faktor * k) + ' % Schaden, kostet dich ' + prozent(this.rueckstoss) + ' % deiner KP'; } },
    { id:'klingenwirbel', name:'Klingenwirbel', skaliert:true, faktor:.7, blutung:.05, runden:3,
      text:function (k) { return prozent(this.faktor * k) + ' % Schaden, dann blutet der Gegner drei Züge lang je ' + prozent(this.blutung * k) + ' % seiner KP'; } },
    { id:'blutrausch',    name:'Blutrausch',    skaliert:true, faktor:1.1, heilung:.15,
      text:function (k) { return prozent(this.faktor * k) + ' % Schaden; fällt der Gegner, kommt die Ladung zurück und du heilst ' + prozent(this.heilung * k) + ' %'; } });
  A.FAEHIGKEITEN[2].push(
    { id:'regeneration', name:'Regeneration', skaliert:true, faktor:0, nurVerletzt:true, heilung:.1, nachheilung:.08, runden:3,
      text:function (k) { return 'Heilt ' + prozent(this.heilung * k) + ' % sofort und drei Züge lang je ' + prozent(this.nachheilung * k) + ' %'; } },
    { id:'heilkreis',    name:'Heilkreis',    skaliert:true, faktor:0, heilung:.24, andere:.12,
      text:function (k) { return 'Heilt dich um ' + prozent(this.heilung * k) + ' % und jedes andere kampffähige Mon deiner Truppe um ' + prozent(this.andere * k) + ' %, auch auf der Bank'; } });
  A.FAEHIGKEITEN[3].push(
    { id:'laehmstich', name:'Lähmstich', skaliert:true, faktor:.8, runden:2,
      text:function (k) { return prozent(this.faktor * k) + ' % Schaden, der Gegner kann zwei Züge lang weder Kraftschlag noch Fähigkeit einsetzen'; } },
    { id:'zeitsprung', name:'Zeitsprung', skaliert:true, faktor:.6,
      text:function (k) { return prozent(this.faktor * k) + ' % Schaden, und dein Kraftschlag ist sofort wieder geladen'; } },
    { id:'runenraub',  name:'Runenraub',  skaliert:true, faktor:.6,
      text:function (k) { return prozent(this.faktor * k) + ' % Schaden und stiehlt dem Gegner eine Fähigkeitsladung'; } });
  A.faehigkeit = function (u) { return A.FAEHIGKEITEN[u.role][u.skill || 0] || A.FAEHIGKEITEN[u.role][0]; };
  /* Wie stark die Faehigkeit dieses Mons wirkt: nur die skalierten haengen an
     der Seltenheit. Die Einheit kennt ihr Mon ueber monId - so gilt das auch
     fuer Kaempfe, die vor dieser Aenderung begonnen haben. */
  A.skala = function (u) {
    if (!A.faehigkeit(u).skaliert) return 1;
    var mon = u && D.mon(u.monId);
    return mon ? A.SELTENHEIT_SKALA[mon.seltenheit] || 1 : 1;
  };
  A.faehigkeitText = function (u) {
    var f = A.faehigkeit(u);
    return typeof f.text === 'function' ? f.text(A.skala(u)) : f.text;
  };
  /* Der Schadensfaktor, mit dem die Faehigkeit gerade zuschlagen wuerde.
     Dieselbe Rechnung fuer Arena, Duell, Dungeon und die Vorschau. */
  A.faehigkeitFaktor = function (u) {
    var f = A.faehigkeit(u), k = A.skala(u);
    if (f.id === 'vergeltung') return (f.faktor + f.zuwachs * (1 - u.hp / u.maxHp)) * k;
    return f.faktor * k;
  };
  /* Ob eine Faehigkeit bei vollem Leben verpufft. Dungeon und Arena fragen
     dieselbe Stelle, sonst gilt im einen Kampf eine andere Regel als im
     anderen - und genau das war der Fall: im Dungeon war jede Faehigkeit bis
     zum ersten Treffer gesperrt, auch die reinen Schadensfaehigkeiten. */
  A.nurBeiSchaden = function (u) { return !!A.faehigkeit(u).nurVerletzt; };
  /* Was eine Runenstufe bringt. Drei Prozent je Stufe auf KP und Angriff statt
     bisher zwei, also bis zu +15 %. Mehr geht nicht: bei +18 % schlaegt ein
     voll aufgewertetes Aussergewoehnliches ein frisches Episches, und damit
     waere die Seltenheit nichts mehr wert. Die Prozente sind deshalb nicht der
     Grund, Runen auszugeben - das sind die beiden Schwellen:

       ab Stufe 3  laedt der Kraftschlag eine Runde schneller
       ab Stufe 4  gibt es eine dritte Ladung der Faehigkeit

     Beides haengt nicht an den Grundwerten und ist im Kampf sofort zu spueren.
     Tempo bleibt unangetastet - wer zuerst schlaegt, entscheidet zu viel. */
  A.UPGRADE_BONUS = .03; A.LADUNG_AB = 4; A.LADUNGEN = 2; A.SCHNELL_AB = 3; A.POWER_PAUSE = 3;
  A.ladungen = function (mon) { return A.LADUNGEN + (SG.gehstockmon.abenteuer.upgradeLevel(mon.upgrade) >= A.LADUNG_AB ? 1 : 0); };
  A.powerPause = function (mon) { return A.POWER_PAUSE - (SG.gehstockmon.abenteuer.upgradeLevel(mon.upgrade) >= A.SCHNELL_AB ? 1 : 0); };
  /* Grundwerte mal Seltenheit, dann die Runenstufe, dann das Wesen. Das Wesen
     kam frueher gar nicht hier an - es wurde in X.mon auf die Grundwerte
     addiert, und die benutzt diese Rechnung nicht. Damit war jedes wilde Mon
     im Kampf genauso stark wie jedes ruhige. */
  A.stats = function (mon) {
    var s = stats[mon.typ],factor=[.78,1.16,1.38,1.64,1.98,2.4,3][mon.seltenheit],bonus=1+SG.gehstockmon.abenteuer.upgradeLevel(mon.upgrade)*A.UPGRADE_BONUS;
    var w = mon.wesenId ? SG.gehstockmon.abenteuer.wesen(mon.wesenId) : null;
    var hp = Math.floor(Math.round(s[0]*factor)*bonus), ang = Math.floor(Math.round(s[1]*factor)*bonus), tempo = s[2];
    if (w) { hp = Math.max(1, Math.round(hp*(1+w.hp))); ang = Math.max(1, Math.round(ang*(1+w.ang))); tempo = Math.max(1, tempo+w.tempo); }
    return { hp: hp, ang: ang, tempo: tempo };
  };
  /* Eine Zahl fuer die Staerke einer Truppe: je Mon die Wurzel aus KP mal
     Angriff, zusammengezaehlt. Seltenheit, Runenstufe und Wesen stecken ueber
     A.stats schon darin. Dient zum Vergleichen - in der Arena als Orientierung
     und fuer Trainer, die sich auf die eigene Truppe einstellen. */
  A.staerke = function (mons) {
    return Math.round((mons || []).reduce(function (summe, mon) {
      if (!mon) return summe;
      var s = A.stats(mon);
      return summe + Math.sqrt(s.hp * s.ang);
    }, 0));
  };
  A.moves = function (u, round) {
    var voll = u.maxCharges || A.LADUNGEN, pause = (u.powerPause || A.POWER_PAUSE) - 1, f = A.faehigkeit(u);
    /* Eine reine Heilung darf nur bei Schaden eingesetzt werden - sonst
       verpufft sie. Alles andere geht immer, solange eine Ladung da ist. */
    var heiler = A.nurBeiSchaden(u), gelaehmt = u.gelaehmt > 0;
    return [
      { id: 'strike', name: 'Stockhieb', text: 'Zuverlässiger Angriff', damage: u.ang, enabled: true },
      { id: 'power', name: 'Kraftschlag', text: gelaehmt ? 'Gelähmt' : round < u.powerReady ? 'Bereit ab Runde ' + u.powerReady : 'Danach ' + pause + (pause === 1 ? ' Runde Pause' : ' Runden Pause'), damage: Math.round(u.ang * 1.55), enabled: round >= u.powerReady && !gelaehmt },
      { id: 'special', name: f.name, text: (gelaehmt ? 'Gelähmt · ' : '') + A.faehigkeitText(u) + ' · ' + u.charges + '/' + voll, damage: Math.round(u.ang * A.faehigkeitFaktor(u) * (f.id === 'doppelhieb' ? 2 : 1)), enabled: u.charges > 0 && (!heiler || u.hp < u.maxHp) && !gelaehmt },
      { id: 'guard', name: 'Deckung', text: 'Nächster Treffer −60 %', damage: 0, enabled: true }
    ];
  };
  function unit(mon, side, i, bonus) {
    var s = A.stats(mon), hp = Math.round(s.hp * (1 + bonus)), laden = A.ladungen(mon), pause = A.powerPause(mon);
    return { uid: side + i, monId: mon.id, name: mon.name, role: mon.typ, skill: D.faehigkeitVon(mon), wesen: mon.wesen || null, maxHp: hp, hp: hp, ang: Math.round(s.ang * (1 + bonus / 2)), speed: s.tempo, powerReady: 1, charges: laden, maxCharges: laden, powerPause: pause, shield: 0, weakened: false, dornen: false, geschaerft: false, plan: mon.plan || null, schimmernd: !!mon.schimmernd };
  }
  /* Ein gespeicherter Verteidiger, wie ihn die Welt haelt. Runenstufe, Wesen
     und Plan gehoeren dazu, und zwar ueberall gleich: die Grosse Arena hat
     sich ihre Gegner lange selbst zusammengebaut und dabei Wesen und Plan
     fallen lassen. Der Champion kaempfte dann nach der Faustregel statt nach
     dem Plan, den sein Besitzer gesetzt hatte. */
  A.ausSpeicher = function (e) {
    var X = SG.gehstockmon.abenteuer, w = X.wesen(e && e.wesen);
    return Object.assign({}, D.mon(e && (e.id || e.monId)) || D.KATALOG[0],
      { upgrade: X.upgradeLevel(e && e.upgrade), wesenId: w ? w.id : null, wesen: w ? w.name : null,
        plan: A.planGueltig(e && e.plan) ? e.plan : null, schimmernd: !!(e && e.schimmernd) });
  };
  A.defenders = function (fieldId, saved) {
    if (saved && saved.length) return saved.map(function (e) { return A.ausSpeicher(e); });
    var roster = [['moosling','rostknirps'], ['sumpfschnapper','nebelmolch','klinge'], ['kieselkrabb','glutfuchs','donnerwidder'], ['bernsteinkaefer','dornenwolf','nebelkrake','kristallspinne'], ['runengolem','frostklaue','seelenqualle','obsidianrabe']];
    /* Der Nebelwald hiess "Schwer", war mit einem Aussergewoehnlichen und zwei
       Gewoehnlichen aber schwaecher als beide "Mittel"-Gebiete - die
       Startertruppe gewann dort. Jetzt stehen drei Aussergewoehnliche und eine
       Epische, der Wall vorn (27.09.2026). Mit der Arena-KI auf beiden Seiten
       gewinnt die Startertruppe noch 13 %, zwei Seltene und zwei Gewoehnliche
       78 %, ab zwei Aussergewoehnlichen jede Truppe - die Frostkrone bleibt
       deutlich haerter. */
    /* Das Sonnengrab war ein Abklatsch des Horsts und damit die leichteste
       Stufe unter "Sehr schwer", die es je gab. Jetzt stehen dort vier
       Legendaere in allen vier Rollen - Wall, Schneide, Pfleger, Stoerung -,
       und der Pfleger macht daraus die eigentliche Aufgabe: ohne ihn zuerst
       zu brechen, heilt er alles wieder weg. */
    roster.push(['tauhupfer'],['grabesritter','sternengeweih','vulkanmantis','leerenwyrm'],['aetherdrache','chronoschreiter','grabesritter','frostorakel'],['endrichter','nullwyrm','chronoschreiter','aetherdrache']);
    var ids = roster[fieldId - 1].slice();
    /* Auch die Computergebiete kaempfen nach einem Plan. Ohne einen stand beim
       Aufklaeren neunmal "kein eigener Plan", und die ganze Aufklaerung lohnte
       sich erst gegen echte Spieler - von denen es wenige gibt. Jeder Plan
       passt zur Lehre seines Feldes, sodass man ihn lesen und kontern kann. */
    return ids.map(function (id) {
      var mon = D.mon(id);
      return mon ? Object.assign({}, mon, { plan: A.FELD_PLAENE[fieldId - 1] || null }) : mon;
    });
  };
  /* Ein Plan je Gebiet, gelesen wie die Lehre des Feldes:

       1 Grenzstein   schlaegt stur zu - hier lernt man nur zuzusehen
       2 Alte Furt    die Pfleger heilen, sobald es eng wird
       3 Schieferbruch der Brecher holt aus, sobald er kann
       4 Nebelsenke   deckt sich, wenn man selbst stark dasteht
       5 Der Horst    liest die Lage und wechselt zwischen Angriff und Schutz
       6 Tauwiese     ein sanfter Einstieg, fast ohne Gegenwehr
       7 Sonnengrab   heilt frueh und hartnaeckig - der Pfleger muss zuerst fallen
       8 Donnergrat   spart die Faehigkeit fuer den Moment der Schwaeche
       9 Weltenschlund schlaegt mit allem zu, was geladen ist */
  A.FELD_PLAENE = [
    [['immer','strike'],   ['aus','strike'],        ['aus','strike']],
    [['ich_schwach','special'], ['immer','strike'],  ['aus','strike']],
    [['kraft_bereit','power'],  ['immer','strike'],  ['aus','strike']],
    [['feind_stark','guard'],   ['ladung_da','special'], ['immer','strike']],
    [['ich_schwach','special'], ['feind_schwach','power'], ['immer','strike']],
    [['immer','strike'],   ['aus','strike'],        ['aus','strike']],
    [['ich_schwach','special'], ['geschuetzt','special'], ['immer','power']],
    [['feind_schwach','special'],['kraft_bereit','power'], ['immer','strike']],
    [['kraft_bereit','power'],  ['ladung_da','special'],  ['immer','strike']]
  ];
  /* Der Zuschlag der schweren Computergebiete auf KP (und halb auf Angriff).
     Beim Weltenschlund stand hier +65 %: in 80 000 simulierten Kaempfen mit
     dem staerksten moeglichen Team (drei Apokalyptische und ein Mythischer,
     alle auf Runenstufe 5) gab es keinen einzigen Sieg - das Endgebiet war
     nicht zu erobern. Mit +20 % schafft es nur genau dieses Team, und auch
     das nicht immer; der Donnergrat verlangt mit +30 % noch Mythische. */
  A.ENDGEBIET_BONUS = { 7: .22, 8: .3, 9: .2 };
  A.create = function (roster, enemies, options) {
    var o = options || {};
    return { id: o.id || 'local', territoryId: o.territoryId || 1, territoryVersion: o.version || 1,
      level: o.level || 1, revision: 0, round: 1, phase: 'choose', winner: null, settled: false,
      aussenseiter: o.aussenseiter || 0,
      teams: [roster.map(function (k,i) { return unit(k,'wir',i,o.aussenseiter || 0); }), enemies.map(function (k,i) { return unit(k,'sie',i,SG.gehstockmon.wirtschaft.LEVELS[o.level || 1].bonus+(o.npcTerritory?(o.territoryId===9?A.ENDGEBIET_BONUS[9]:o.territoryId===8?A.ENDGEBIET_BONUS[8]:o.territoryId===7?A.ENDGEBIET_BONUS[7]:0):0)+(o.bonus||0)); })],
      active: [0,0], events: [], startedAt: o.now || Date.now(), lastActionAt: o.now || Date.now() };
  };
  function active(s, side) { return s.teams[side][s.active[side]]; }
  /* Folgt ein Verteidiger seinem Plan, haengt die Regel an der ersten Zeile,
     die er in diesem Zug schreibt (siehe attack). */
  function record(s, text, actor, target, delta, kind) { if (s.hinweis && actor && actor.uid === s.hinweis.uid) { text += s.hinweis.text; delete s.hinweis; } s.events.push({ text: text, actor: actor && actor.uid, target: target && target.uid, delta: delta || 0, kind: kind || 'move', state: s.teams.map(function (team) { return team.map(function (u) { return u.hp; }); }), active: s.active.slice() }); }
  /* Das Rollen-Dreieck. Vorher entschieden nur KP, Angriff und Tempo - vier
     Rollen, die einander nichts anhaben konnten, und die Aufstellung war eine
     Zahlensumme. Jetzt hat jede Rolle eine, gegen die sie gut steht:

       Wall daempft die Schneide      Schneide zerlegt den Pfleger
       Pfleger haelt gegen Stoerung   Stoerung kommt am Wall vorbei

     Ein Viertel mehr oder weniger ist genug, um eine Aufstellung zu kippen,
     ohne dass ein falscher Konter den Kampf schon entscheidet. */
  A.DREIECK = .25;
  A.rollenFaktor = function (angreifer, verteidiger) {
    if (angreifer === 1 && verteidiger === 0) return 1 - A.DREIECK;
    if (angreifer === 1 && verteidiger === 2) return 1 + A.DREIECK;
    if (angreifer === 3 && verteidiger === 0) return 1 + A.DREIECK;
    if (angreifer === 3 && verteidiger === 2) return 1 - A.DREIECK;
    return 1;
  };
  function damage(s, actor, target, value, name, durchdringend) {
    if (actor.weakened) { value *= 0.65; actor.weakened = false; }
    if (actor.geschaerft) { value *= 1.3; actor.geschaerft = false; }
    value *= A.rollenFaktor(actor.role, target.role);
    if (!durchdringend) { value *= 1 - target.shield; target.shield = 0; }
    var n = Math.min(target.hp, Math.max(1, Math.round(value))); target.hp -= n;
    record(s, actor.name + ': ' + name + ' trifft für ' + n + ' Schaden.', actor, target, -n);
    /* Dornenpanzer wirft den naechsten Treffer anteilig zurueck. */
    if (target.dornen && target.hp > 0 && actor.hp > 0) {
      target.dornen = false;
      var zurueck = Math.min(actor.hp, Math.max(1, Math.round(n * 0.4)));
      actor.hp -= zurueck;
      record(s, target.name + ': Dornenpanzer wirft ' + zurueck + ' Schaden zurück.', target, actor, -zurueck);
    }
  }
  function heile(s, me, anteil) {
    var n = Math.min(me.maxHp - me.hp, Math.round(me.maxHp * anteil));
    if (n > 0) { me.hp += n; record(s, me.name + ' heilt ' + n + ' KP.', me, me, n); }
    return n;
  }
  /* Was ueber mehrere Zuege wirkt, rechnet zu Beginn des eigenen Zuges ab:
     erst die Heilung, dann die Blutung. Wer daran faellt, handelt nicht mehr. */
  function zustaende(s, me) {
    if (me.regeneration > 0) { me.regeneration--; heile(s, me, me.regenAnteil || 0.08); }
    if (me.blutung > 0) {
      me.blutung--;
      var n = Math.min(me.hp, Math.max(1, me.blutungSchaden || 1)); me.hp -= n;
      record(s, me.name + ' blutet: ' + n + ' Schaden.', null, me, -n, 'blutung');
    }
  }
  function attack(s, side, move, regel) {
    var me = active(s, side), other = active(s, 1-side); if (me.hp <= 0 || other.hp <= 0) return;
    zustaende(s, me); if (me.hp <= 0) return;
    if (regel !== undefined && regel !== null) { zaehle(s, me, regel); s.hinweis = { uid: me.uid, text: A.regelHinweis(me, regel) }; }
    /* Gelaehmt bleiben Stockhieb und Deckung. Auch ein Plan oder die KI, die
       trotzdem zur Faehigkeit greifen, schlagen dann nur zu. */
    var gelaehmt = me.gelaehmt > 0;
    if (gelaehmt) {
      me.gelaehmt--;
      if (move === 'power' || move === 'special') { record(s, me.name + ' ist gelähmt und schlägt nur zu.', me); move = 'strike'; }
    }
    me.shield = 0;
    if (move === 'guard') { me.shield = 0.6; record(s, me.name + ' geht in Deckung.', me); }
    else if (move === 'power') { me.powerReady = s.round + (me.powerPause || A.POWER_PAUSE); damage(s,me,other,me.ang*1.55,'Kraftschlag'); }
    else if (move === 'special') {
      me.charges--;
      var f = A.faehigkeit(me);
      if (f.id === 'schildstoss') { damage(s,me,other,me.ang*f.faktor,f.name); me.shield = 0.35; }
      else if (f.id === 'steinwall') { me.shield = 0.75; heile(s,me,0.1); record(s,me.name+' zieht den Steinwall hoch.',me); }
      else if (f.id === 'dornenpanzer') { damage(s,me,other,me.ang*f.faktor,f.name); me.dornen = true; }
      else if (f.id === 'sichelstreich') { damage(s,me,other,me.ang*(other.hp/other.maxHp<=0.35?1.9:f.faktor),f.name); }
      else if (f.id === 'doppelhieb') { damage(s,me,other,me.ang*f.faktor,f.name); if (other.hp > 0) damage(s,me,other,me.ang*f.faktor,f.name+' (zweiter Hieb)'); }
      else if (f.id === 'aderlass') { var vorher = other.hp; damage(s,me,other,me.ang*f.faktor,f.name); var traf = vorher - other.hp; var zurueck = Math.min(me.maxHp-me.hp,Math.round(traf*0.45)); if (zurueck > 0) { me.hp += zurueck; record(s,me.name+' saugt '+zurueck+' KP heraus.',me,me,zurueck); } }
      else if (f.id === 'lebensquell') { heile(s,me,0.32); }
      else if (f.id === 'sammelruf') { heile(s,me,0.18); me.shield = 0.35; record(s,me.name+' sammelt sich hinter einem Schild.',me); }
      else if (f.id === 'laeuterung') { heile(s,me,0.22); me.weakened = false; me.geschaerft = true; record(s,me.name+' schärft den nächsten Treffer.',me); }
      else if (f.id === 'runenstoerung') { damage(s,me,other,me.ang*f.faktor,f.name); if (other.hp > 0) other.weakened = true; }
      else if (f.id === 'blendstoss') { damage(s,me,other,me.ang*f.faktor,f.name); if (other.hp > 0 && other.charges > 0) { other.charges--; record(s,other.name+' verliert eine Ladung.',me,other); } }
      else if (f.id === 'windschnitt') { damage(s,me,other,me.ang*f.faktor,f.name,true); }
      else if (f.skaliert) neueFaehigkeit(s, side, me, other, f, A.skala(me));
      else damage(s,me,other,me.ang*f.faktor,f.name);
    } else damage(s,me,other,me.ang,'Stockhieb');
    delete s.hinweis;
  }
  function neueFaehigkeit(s, side, me, other, f, k) {
    var treffer = function () { damage(s, me, other, me.ang * A.faehigkeitFaktor(me), f.name); };
    if (f.id === 'erdstoss') {
      treffer();
      if (other.hp > 0) { other.powerReady = Math.max(other.powerReady || 1, s.round + f.verzoegerung); record(s, other.name + ' wankt - sein Kraftschlag lädt später.', me, other); }
    } else if (f.id === 'vergeltung') treffer();
    else if (f.id === 'sturmangriff') {
      treffer();
      var rueck = Math.min(me.hp - 1, Math.round(me.maxHp * f.rueckstoss));
      if (rueck > 0) { me.hp -= rueck; record(s, me.name + ' zahlt ' + rueck + ' KP für den Sturmangriff.', me, me, -rueck, 'rueckstoss'); }
    } else if (f.id === 'klingenwirbel') {
      treffer();
      if (other.hp > 0) { other.blutung = f.runden; other.blutungSchaden = Math.max(1, Math.round(other.maxHp * f.blutung * k)); record(s, other.name + ' blutet.', me, other); }
    } else if (f.id === 'blutrausch') {
      treffer();
      if (other.hp <= 0) { me.charges = Math.min(me.maxCharges || A.LADUNGEN, me.charges + 1); heile(s, me, f.heilung * k); record(s, me.name + ' gerät in einen Blutrausch - die Ladung kommt zurück.', me); }
    } else if (f.id === 'regeneration') {
      heile(s, me, f.heilung * k); me.regeneration = f.runden; me.regenAnteil = f.nachheilung * k;
      record(s, me.name + ' regeneriert sich.', me);
    } else if (f.id === 'heilkreis') {
      var geheilt = 0;
      s.teams[side].forEach(function (u) { if (u.hp > 0) geheilt += heile(s, u, (u === me ? f.heilung : f.andere) * k); });
      if (!geheilt) record(s, me.name + ': Heilkreis - alle sind unverletzt.', me);
    } else if (f.id === 'laehmstich') {
      treffer();
      if (other.hp > 0) { other.gelaehmt = f.runden; record(s, other.name + ' ist gelähmt.', me, other); }
    } else if (f.id === 'zeitsprung') {
      treffer();
      me.powerReady = Math.min(me.powerReady, s.round + 1); record(s, me.name + ' springt durch die Zeit - der Kraftschlag ist geladen.', me);
    } else if (f.id === 'runenraub') {
      treffer();
      if (other.hp > 0 && other.charges > 0) { other.charges--; me.charges = Math.min(me.maxCharges || A.LADUNGEN, me.charges + 1); record(s, me.name + ' stiehlt ' + other.name + ' eine Ladung.', me, other); }
    } else treffer();
  }
  function finish(s) {
    if (!s.teams[1].some(function (u) { return u.hp > 0; })) { s.winner='wir'; s.phase='finished'; }
    else if (!s.teams[0].some(function (u) { return u.hp > 0; })) { s.winner='sie'; s.phase='finished'; }
    if (s.phase === 'finished') return;
    if (active(s,1).hp<=0) { s.active[1]=s.teams[1].findIndex(function(u){return u.hp>0;}); record(s,active(s,1).name+' wird in die Arena geschickt.',active(s,1),null,0,'send'); }
    s.phase=active(s,0).hp<=0?'replace':'choose';
    if(s.round>60){s.phase='finished';s.winner='patt';record(s,'Nach 60 Runden hält die Verteidigung stand.');}
  }
  /* Der Kampfplan. Das war der eigentliche Einfall hinter GehstockMon - deine
     Truppe haelt dein Land nach Regeln, die du gesetzt hast, und ein Gegner
     kann sie beim Aufklaeren lesen und kontern. Er war beim Umbau auf den
     Einzelkampf verlorengegangen: seitdem kaempfte jede Verteidigung, auch die
     des Champions, nach derselben vierzeiligen Heuristik.

     Ein Plan sind drei Wenn-Dann-Zeilen je Mon, von oben nach unten geprueft.
     Greift keine, bleibt die alte Heuristik als Rueckfall - ein Mon ohne Plan
     kaempft also genau wie frueher. */
  A.PLAN_WENN = [
    { id:'aus',           text:'(keine Regel)' },
    { id:'immer',         text:'immer' },
    { id:'ich_schwach',   text:'ich unter 40 %' },
    { id:'ich_stark',     text:'ich über 70 %' },
    { id:'feind_schwach', text:'Gegner unter 40 %' },
    { id:'feind_stark',   text:'Gegner über 70 %' },
    { id:'runde_1',       text:'in Runde 1' },
    { id:'kraft_bereit',  text:'Kraftschlag geladen' },
    { id:'ladung_da',     text:'Fähigkeit hat Ladung' },
    { id:'geschuetzt',    text:'Gegner ist geschützt' }
  ];
  A.PLAN_DANN = [
    { id:'strike',  text:'Stockhieb' },
    { id:'power',   text:'Kraftschlag' },
    { id:'special', text:'Fähigkeit einsetzen' },
    { id:'guard',   text:'in Deckung gehen' }
  ];
  A.START_PLAN = [['runde_1','power'], ['feind_schwach','special'], ['immer','strike']];
  A.planGueltig = function (plan) {
    return Array.isArray(plan) && plan.length === A.START_PLAN.length && plan.every(function (zeile) {
      return Array.isArray(zeile) && zeile.length === 2
        && A.PLAN_WENN.some(function (w) { return w.id === zeile[0]; })
        && A.PLAN_DANN.some(function (d) { return d.id === zeile[1]; });
    });
  };
  /* Der Plan, den ein Verteidiger wirklich mitnimmt: der eigene, sonst keiner.
     Ohne Plan greift in A.ai die Faustregel seiner Rolle - so steht es im
     Planeditor, und so war es gedacht (siehe oben). Bis zum 27.09.2026 bekam
     jeder Verteidiger ohne eigenen Plan stattdessen den Startplan, und der
     verlor in gespiegelten Kaempfen drei von vier gegen die Faustregel: Pfleger
     heilten erst, wenn der Gegner schon fast lag. */
  A.eigenerPlan = function (plan) { return A.planGueltig(plan) ? plan.map(function (z) { return z.slice(0,2); }) : null; };
  A.planOder = function (plan) { return A.planGueltig(plan) ? plan.map(function (z) { return z.slice(0,2); }) : A.START_PLAN.map(function (z) { return z.slice(); }); };
  function trifftZu(wenn, me, other, round) {
    if (wenn === 'immer') return true;
    if (wenn === 'ich_schwach') return me.hp <= me.maxHp * 0.4;
    if (wenn === 'ich_stark') return me.hp > me.maxHp * 0.7;
    if (wenn === 'feind_schwach') return other.hp <= other.maxHp * 0.4;
    if (wenn === 'feind_stark') return other.hp > other.maxHp * 0.7;
    if (wenn === 'runde_1') return round === 1;
    if (wenn === 'kraft_bereit') return round >= me.powerReady;
    if (wenn === 'ladung_da') return me.charges > 0;
    if (wenn === 'geschuetzt') return other.shield > 0;
    return false;
  }
  function kiNeu(f, me, other, s) {
    if (!f.skaliert) return null;
    if (f.id === 'erdstoss') return other.powerReady <= s.round + 1 || s.round % 3 === 1;
    if (f.id === 'vergeltung') return me.hp <= me.maxHp * .5;
    if (f.id === 'sturmangriff') return me.hp > me.maxHp * .45;
    if (f.id === 'klingenwirbel') return !(other.blutung > 0) && other.hp > other.maxHp * .3;
    if (f.id === 'blutrausch') return other.hp <= other.maxHp * .4;
    if (f.id === 'regeneration') return me.hp < me.maxHp * .75 && !(me.regeneration > 0);
    if (f.id === 'heilkreis') return me.hp < me.maxHp * .6 || s.teams[1].filter(function (u) { return u.hp > 0 && u.hp < u.maxHp * .75; }).length >= 2;
    if (f.id === 'laehmstich') return !(other.gelaehmt > 0) && (other.charges > 0 || other.powerReady <= s.round + 1);
    if (f.id === 'zeitsprung') return s.round < me.powerReady;
    if (f.id === 'runenraub') return other.charges > 0;
    return false;
  }
  /* Der Zug des Verteidigers und woher er kommt: regel ist die Planzeile
     (0 bis 2), -1 wenn er einen Plan hat, aber keine Zeile passte, und null
     ohne Plan. Der Kampfbericht zeigt das - sonst sieht niemand, was sein
     Plan im Kampf wirklich tut, und niemand hat einen Grund, ihn zu aendern. */
  A.aiWahl = function(s) {
    var me=active(s,1), other=active(s,0);
    var moeglich = A.moves(me, s.round), mitPlan = A.planGueltig(me.plan);
    function erlaubt(id) { var m = moeglich.find(function (v) { return v.id === id; }); return m && m.enabled; }
    /* Erst der Plan des Verteidigers, Zeile fuer Zeile. */
    if (mitPlan) {
      for (var i = 0; i < me.plan.length; i++) {
        var wenn = me.plan[i][0], dann = me.plan[i][1];
        if (wenn === 'aus' || !trifftZu(wenn, me, other, s.round)) continue;
        if (erlaubt(dann)) return { zug: dann, regel: i };
      }
    }
    return { zug: faustregel(s, me, other, erlaubt), regel: mitPlan ? -1 : null };
  };
  A.ai = function(s) { return A.aiWahl(s).zug; };
  function faustregel(s, me, other, erlaubt) {
    /* Die neuen Faehigkeiten wollen je ihren eigenen Moment - die alten
       folgen weiter der Faustregel ihrer Rolle. */
    var neu = kiNeu(A.faehigkeit(me), me, other, s);
    if (neu !== null) { if (neu && erlaubt('special')) return 'special'; }
    /* Blendstoss nimmt eine Ladung - ohne Ladung beim Gegner verpufft genau
       das. Frueher setzte die KI ihn trotzdem ein, sobald der Gegner nicht
       geschwaecht war, und er gewann nur 38 % gegen die anderen Stoerer. Mit
       dieser Regel und 75 % statt 60 % Schaden sind es 48 % (27.09.2026). */
    else if(me.charges>0 && ((me.role===2 && me.hp<me.maxHp*0.65)||(me.role===1 && other.hp<other.maxHp*0.35)||(me.role===3 && (A.faehigkeit(me).id==='blendstoss'?other.charges>0:!other.weakened))||(me.role===0 && s.round%3===1)))return 'special';
    return s.round>=me.powerReady&&erlaubt('power')?'power':'strike';
  }
  function wennText(id) { var w = A.PLAN_WENN.find(function (v) { return v.id === id; }); return w ? w.text : id; }
  A.regelHinweis = function (u, regel) {
    if (regel === null || regel === undefined || !A.planGueltig(u.plan)) return '';
    return regel < 0 ? ' (keine Regel passte - Faustregel)' : ' (Regel ' + (regel + 1) + ': ' + wennText(u.plan[regel][0]) + ')';
  };
  /* Je Verteidiger mit Plan: wie oft jede Zeile griff, an vierter Stelle wie
     oft keine. Klein genug, um im Kampfstand mitzureisen. */
  function zaehle(s, u, regel) {
    if (!A.planGueltig(u.plan)) return;
    s.planBilanz = s.planBilanz || {};
    var z = s.planBilanz[u.uid] || (s.planBilanz[u.uid] = [0, 0, 0, 0]);
    z[regel < 0 ? 3 : regel]++;
  }
  /* Eine Zeile je Verteidiger fuer den Kopf des Kampfberichts, etwa
     "📋 Wärter: Regel 1 (in Runde 1) ×1 · Regel 2 (Gegner unter 40 %) ×0 · keine passte ×5".
     Auch eine Regel, die nie griff, steht da - gerade das will man wissen. */
  A.planBilanz = function (b) {
    var bilanz = (b && b.planBilanz) || {};
    return (b && b.teams ? b.teams[1] : []).filter(function (u) { return bilanz[u.uid] && A.planGueltig(u.plan); }).map(function (u) {
      var z = bilanz[u.uid], teile = [];
      u.plan.forEach(function (zeile, i) { if (zeile[0] !== 'aus') teile.push('Regel ' + (i + 1) + ' (' + wennText(zeile[0]) + ') ×' + z[i]); });
      if (z[3]) teile.push('keine passte ×' + z[3]);
      return '📋 ' + u.name + ': ' + teile.join(' · ');
    });
  };
  A.turn = function (original, action) {
    if(!original || original.phase==='finished') throw new Error('Dieser Kampf ist bereits beendet.');
    var s=JSON.parse(JSON.stringify(original)); s.events=[]; var me=active(s,0), enemy=active(s,1);
    if(action.kind==='switch') {
      if(!Number.isInteger(action.slot)||!s.teams[0][action.slot]||s.teams[0][action.slot].hp<=0||action.slot===s.active[0]) throw new Error('Wähle ein anderes kampffähiges Mon.');
      var forced=s.phase==='replace', enemyMove=A.aiWahl(s); me.shield=0; s.active[0]=action.slot; s.phase='choose';
      record(s,active(s,0).name+' wird in die Arena geschickt.',active(s,0),null,0,'send');
      if(!forced){attack(s,1,enemyMove.zug,enemyMove.regel);s.round++;finish(s);}
    } else {
      if(s.phase==='replace')throw new Error('Schicke zuerst ein neues Mon in die Arena.');
      var move=A.moves(me,s.round).find(function(m){return m.id===action.move && m.enabled;});
      if(action.kind!=='move'||!move)throw new Error('Diese Attacke ist gerade nicht verfügbar.');
      var ai=A.aiWahl(s), enemyUid=enemy.uid, meUid=me.uid;
      var first=move.id==='guard'||me.speed>=enemy.speed?0:1;
      [first,1-first].forEach(function(side){
        var actor=active(s,side), target=active(s,1-side);
        if(actor.hp>0 && target.hp>0 && actor.uid===(side===0?meUid:enemyUid))attack(s,side,side===0?move.id:ai.zug,side===0?undefined:ai.regel);
      });
      [0,1].forEach(function(side){if(active(s,side).hp<=0)record(s,active(s,side).name+' ist kampfunfähig.',active(s,side),null,0,'faint');});
      s.round++;finish(s);
    }
    /* Der Verlauf wird mitgeschrieben, damit ein Kampf spaeter nachlesbar ist.
       Bisher hielt jeder Zug nur seine eigenen Zeilen - wer nachts angegriffen
       wurde, sah am Morgen einen einzigen Satz und nicht, woran es lag. Nur
       Texte, keine Zustandsbilder: der Bericht soll die Welt nicht aufblaehen. */
    s.verlauf = (original.verlauf || []).concat(s.events.map(function (e) { return e.text; })).slice(-120);
    s.revision++;return s;
  };
  A.flee = function(original) { var s=JSON.parse(JSON.stringify(original));s.phase='finished';s.winner='fled';s.revision++;s.events=[{text:'Du hast dich zurückgezogen. Das Gebiet bleibt beim Verteidiger.',kind:'flee'}];return s; };
  /* Fuer das Live-Duell (2-duell.js): dieselben Treffer, Heilungen und
     Faehigkeiten wie hier, nur mit zwei Spielern statt einem Plan. */
  A.intern = { attack: attack, record: record, active: active };
})(SG);

/* ------------------------------------------------------------------
   GehstockMon - Kampfmaschine.

   Reine Regeln, kein DOM. Rein gehen zwei Truppen mit ihren Plaenen,
   heraus kommt eine Liste von Schritten, die 3-ui.js abspielt. Liegt
   unter SG.rules, damit tools/test.mjs sie ohne Browser durchrechnen
   kann.

   Wichtigste Entscheidung: der Kampf ist VOLLSTAENDIG DETERMINISTISCH.
   Kein Zufall, keine Streuung beim Schaden. In einem Spiel, in dem man
   Regeln schreibt, muss eine Niederlage am Plan liegen und nicht am
   Wuerfel - sonst lernt man aus ihr nichts.
   ------------------------------------------------------------------ */

(function (SG) {
  var K = SG.rules.gehstockmon = {};

  var MAX_RUNDEN = 12;      /* danach Patt, zaehlt als Niederlage */
  var HEILUNG    = 32;
  var SCHWACH    = 0.4;     /* Schwelle fuer "unter 40 %" */

  K.MAX_RUNDEN = MAX_RUNDEN;

  function lebt(e) { return e.hp > 0; }

  function lebende(liste, seite) {
    var out = [];
    for (var i = 0; i < liste.length; i++) {
      if (!lebt(liste[i])) continue;
      if (seite && liste[i].seite !== seite) continue;
      out.push(liste[i]);
    }
    return out;
  }

  /* Baut aus einer Datenzeile eine Kampfeinheit. Die Marken sind der
     ganze veraenderliche Zustand: spott zieht Angriffe auf sich,
     stoeren halbiert den naechsten eigenen Schlag, verteidigt halbiert
     eingehenden Schaden. Alle drei laufen bis zum naechsten eigenen Zug
     ihres Traegers. */
  function baue(roh, seite, i, plan) {
    var p = plan || roh.plan || [];
    var aktiv = [];
    for (var n = 0; n < p.length; n++) if (p[n][0] !== 'aus') aktiv.push(p[n]);
    return {
      uid: seite + i, seite: seite,
      name: roh.name, mono: roh.mono, monId: roh.id || null,
      maxHp: roh.hp, hp: roh.hp, ang: roh.ang, tempo: roh.tempo,
      faeh: roh.faeh, plan: aktiv, gefallen: false, pause: 0,
      marken: { spott: 0, stoeren: 0, verteidigt: 0 }
    };
  }

  /* Prueft eine Bedingung. Bewusst ohne verdeckte Information: alles,
     was eine Regel abfragen kann, sieht der Spieler auch. */
  function trifftZu(bed, ich, alle, runde) {
    var meine = lebende(alle, ich.seite);
    var feinde = [], i;
    var alleLeben = lebende(alle);
    for (i = 0; i < alleLeben.length; i++) {
      if (alleLeben[i].seite !== ich.seite) feinde.push(alleLeben[i]);
    }
    if (bed === 'immer') return true;
    if (bed === 'ich_schwach') return ich.hp / ich.maxHp < SCHWACH;
    if (bed === 'runde_1') return runde === 1;
    if (bed === 'ueberzahl') return feinde.length > meine.length;
    if (bed === 'freund_schwach') {
      for (i = 0; i < meine.length; i++) {
        if (meine[i] !== ich && meine[i].hp / meine[i].maxHp < SCHWACH) return true;
      }
      return false;
    }
    if (bed === 'feind_schwach') {
      for (i = 0; i < feinde.length; i++) {
        if (feinde[i].hp / feinde[i].maxHp < SCHWACH) return true;
      }
      return false;
    }
    return false;
  }

  /* Zielwahl. Ein aktiver Spott ueberschreibt jede Absicht - das ist der
     Grund, warum Feld 4 mit dem Standardplan nicht zu gewinnen ist. */
  function waehleZiel(alle, ich, art) {
    var alleLeben = lebende(alle), feinde = [], i;
    for (i = 0; i < alleLeben.length; i++) {
      if (alleLeben[i].seite !== ich.seite) feinde.push(alleLeben[i]);
    }
    if (!feinde.length) return null;
    /* Spott zieht alles auf sich - ausser dem gezielten Schlag auf den
       Staerksten. Ohne diese Luecke waere ein Wall eine Mauer ohne Tuer,
       und Feld 4 waere mit keinem Plan zu gewinnen. So ist der Wall eine
       Aufgabe: erkennen, dass man am ihm vorbeizielen muss. */
    if (art !== 'staerkster') {
      for (i = 0; i < feinde.length; i++) if (feinde[i].marken.spott > 0) return feinde[i];
    }
    var best = feinde[0];
    for (i = 1; i < feinde.length; i++) {
      if (art === 'schwaechster' && feinde[i].hp < best.hp) best = feinde[i];
      else if (art === 'staerkster' && feinde[i].ang > best.ang) best = feinde[i];
    }
    if (art !== 'schwaechster' && art !== 'staerkster') return feinde[0];
    return best;
  }

  /* Zwei Halbierungen koennen sich stapeln: der Schlaeger ist gestoert
     UND das Ziel verteidigt. Gewollt, damit sich beides zusammen lohnt. */
  function schadenAn(ziel, roh) {
    var s = ziel.marken.verteidigt ? Math.round(roh / 2) : roh;
    ziel.hp = Math.max(0, ziel.hp - s);
    return s;
  }

  function nutzeFaehigkeit(alle, ich) {
    var ziel, i;

    if (ich.faeh === 'spott') {
      ich.marken.spott = 1;
      return ich.name + ' stellt sich vor die Reihe.';
    }

    if (ich.faeh === 'hinrichten') {
      ziel = waehleZiel(alle, ich, 'schwaechster');
      if (!ziel) return ich.name + ' findet kein Ziel.';
      var doppelt = ziel.hp / ziel.maxHp < SCHWACH;
      var roh = doppelt ? ich.ang * 2 : ich.ang;
      if (ich.marken.stoeren) { roh = Math.round(roh / 2); ich.marken.stoeren = 0; }
      var s = schadenAn(ziel, roh);
      return ich.name + ' richtet ' + ziel.name + ' hin: ' + s +
        (doppelt ? ' Schaden, doppelt.' : ' Schaden.');
    }

    if (ich.faeh === 'flicken') {
      var meine = lebende(alle, ich.seite);
      ziel = meine[0];
      for (i = 1; i < meine.length; i++) {
        if ((meine[i].maxHp - meine[i].hp) > (ziel.maxHp - ziel.hp)) ziel = meine[i];
      }
      if (!ziel || ziel.hp === ziel.maxHp) return ich.name + ' hat niemanden zu flicken.';
      var vorher = ziel.hp;
      ziel.hp = Math.min(ziel.maxHp, ziel.hp + HEILUNG);
      return ich.name + ' flickt ' + ziel.name + ': +' + (ziel.hp - vorher) + ' Leben.';
    }

    if (ich.faeh === 'stoeren') {
      ziel = waehleZiel(alle, ich, 'staerkster');
      if (!ziel) return ich.name + ' findet kein Ziel.';
      ziel.marken.stoeren = 1;
      return ich.name + ' stört ' + ziel.name + '. Nächster Schlag halbiert.';
    }

    return ich.name + ' zögert.';
  }

  function greifeAn(alle, ich, art) {
    var ziel = waehleZiel(alle, ich, art);
    if (!ziel) return ich.name + ' findet kein Ziel.';
    var roh = ich.ang, gestoert = false;
    if (ich.marken.stoeren) { roh = Math.round(roh / 2); ich.marken.stoeren = 0; gestoert = true; }
    var s = schadenAn(ziel, roh);
    return ich.name + ' trifft ' + ziel.name + ': ' + s + ' Schaden.' +
      (gestoert ? ' (gestört)' : '');
  }

  /* ----------------------------------------------------------------
     Der Kampf.

     kaempfe(meine, plaene, feinde) ->
       { schritte: [{runde, seite, text, zustand}], sieger: 'wir'|'sie'|'patt' }

     zustand ist eine Momentaufnahme aller Lebenspunkte nach dem Schritt.
     Kostet etwas Speicher und erspart der Oberflaeche jede eigene
     Simulation: sie spult nur die Liste ab.
     ---------------------------------------------------------------- */
  K.kaempfe = function (meineRoh, plaene, feindRoh) {
    var alle = [], i;
    for (i = 0; i < meineRoh.length; i++) {
      alle.push(baue(meineRoh[i], 'wir', i, plaene ? plaene[meineRoh[i].id] : null));
    }
    for (i = 0; i < feindRoh.length; i++) alle.push(baue(feindRoh[i], 'sie', i, null));

    var schritte = [];
    function momentaufnahme() {
      var m = [];
      for (var n = 0; n < alle.length; n++) m.push({ uid: alle[n].uid, hp: alle[n].hp });
      return m;
    }
    function notiere(runde, seite, text, actor) {
      schritte.push({ runde: runde, seite: seite, text: text, actor: actor || null, zustand: momentaufnahme() });
    }

    var sieger = 'patt';

    for (var runde = 1; runde <= MAX_RUNDEN; runde++) {
      /* Zugreihenfolge wird zu Rundenbeginn festgelegt. Wer schneller
         ist, kommt zuerst; bei Gleichstand unsere Seite. */
      var reihe = lebende(alle).slice().sort(function (a, b) {
        if (b.tempo !== a.tempo) return b.tempo - a.tempo;
        return a.seite === 'wir' ? -1 : 1;
      });

      for (var r = 0; r < reihe.length; r++) {
        var ich = reihe[r];
        if (!lebt(ich)) continue;

        /* Marken, die bis zum eigenen Zug laufen, verfallen hier. */
        ich.marken.spott = 0;
        ich.marken.verteidigt = 0;
        /* Abklingzeit ebenfalls. Ohne sie heilen sich zwei Heiler
           gegenseitig endlos und jeder Kampf endet im Patt - das war in
           der ersten Fassung tatsaechlich so. */
        if (ich.pause > 0) ich.pause--;

        var regel = null;
        for (var p = 0; p < ich.plan.length; p++) {
          if (trifftZu(ich.plan[p][0], ich, alle, runde)) { regel = ich.plan[p]; break; }
        }
        /* Ohne passende Regel wird draufgehauen. Ein Plan, der nichts
           trifft, soll die Kreatur nicht einfrieren lassen. */
        var aktion = regel ? regel[1] : 'vorderster';

        var text;
        if (aktion === 'faehigkeit') {
          if (ich.pause > 0) {
            /* Noch nicht bereit. Statt die Runde zu verschenken wird
               angegriffen - eine Kreatur, die dasteht, waere nur
               aergerlich, nicht lehrreich. */
            text = greifeAn(alle, ich, 'vorderster') + ' (Fähigkeit noch nicht bereit)';
          } else {
            text = nutzeFaehigkeit(alle, ich);
            /* Eine Faehigkeit, die ins Leere lief (nichts zu heilen,
               kein Ziel), darf die Abklingzeit nicht kosten. Sonst
               bestraft das Spiel eine Regel, die gar nicht gegriffen hat. */
            if (text.indexOf('niemanden') < 0 && text.indexOf('kein Ziel') < 0) ich.pause = 2;
          }
        }
        else if (aktion === 'verteidigen') {
          ich.marken.verteidigt = 1;
          text = ich.name + ' geht in Deckung.';
        } else text = greifeAn(alle, ich, aktion);

        notiere(runde, ich.seite, text, ich.uid);

        /* Gefallene sofort melden, sonst wundert man sich beim Zusehen. */
        for (var g = 0; g < alle.length; g++) {
          if (!lebt(alle[g]) && !alle[g].gefallen) {
            alle[g].gefallen = true;
            notiere(runde, alle[g].seite, alle[g].name + ' fällt.');
          }
        }

        if (!lebende(alle, 'sie').length) { sieger = 'wir'; break; }
        if (!lebende(alle, 'wir').length) { sieger = 'sie'; break; }
      }
      if (sieger !== 'patt') break;
    }

    return { schritte: schritte, sieger: sieger, einheiten: alle };
  };
})(SG);

/* ------------------------------------------------------------------
   GehstockMon - der Alltag auf der Insel.

   Was jeden Schultag wiederkommt: Garantie-Zaehler und schimmernde Mons,
   die Tagesaufgaben mit ihrer Serie, die Revanche und der Insel-Ticker.
   Laeuft im Browser und auf dem Server (build.mjs haengt die Datei an die
   gemeinsamen Regeln), darum ohne DOM.

   Die Datei laedt im Browser vor 2-arena.js - sie darf die Arena erst in
   Funktionen ansprechen, nicht beim Laden.
   ------------------------------------------------------------------ */
(function (SG) {
  var R = SG.gehstockmon, D = R.daten, E = R.wirtschaft, H = R.zeiten, X = R.abenteuer;

  /* ----------------------------------------------------------------
     Tagesaufgaben

     Jeden Schultag drei Aufgaben, fuer alle dieselben - dann redet die
     Klasse ueber dieselben Dinge ("hast du schon die zwei Trainer?"). Wer
     alle drei schafft, oeffnet die Tagestruhe. Es stehen nur Aufgaben zur
     Wahl, die man allein und an jedem Tag schaffen kann: kein Duell (dafuer
     braucht es jemanden, der gerade da ist) und kein Zerhacker (der kann
     schon erlegt sein).
     ---------------------------------------------------------------- */
  X.TAGESAUFGABEN = [
    { id: 'trainer',  ziel: 2, text: 'Besiege zwei Wandertrainer' },
    { id: 'rune',     ziel: 3, text: 'Sammle drei verlorene Runen' },
    { id: 'ei',       ziel: 1, text: 'Brüte ein Ei aus' },
    { id: 'arena',    ziel: 1, text: 'Gewinne einen Kampf in der Großen Arena' },
    { id: 'dungeon',  ziel: 1, text: 'Besiege einen Dungeon-Boss' },
    { id: 'erkunden', ziel: 2, text: 'Erkunde zwei verschiedene Biome' }
  ];
  X.ALLTAG_OPS = ['tagestruhe'];
  X.SPIELZUEGE.push.apply(X.SPIELZUEGE, X.ALLTAG_OPS);
  /* Die drei Aufgaben eines Tages: aus dem Datum gezogen, also ueberall
     dieselben, ohne dass sie irgendwo gespeichert werden muessen. */
  X.tagesaufgaben = function (now) {
    var saat = (Math.imul(H.day(now), 2654435761) >>> 0) || 1, pool = X.TAGESAUFGABEN.slice(), out = [];
    while (out.length < 3) { saat = (Math.imul(saat, 1664525) + 1013904223) >>> 0; out.push(pool.splice(saat % pool.length, 1)[0]); }
    return out;
  };
  /* Der Stand des heutigen Tages - an einem neuen Tag faengt er leer an. */
  X.alltagStand = function (p, now) {
    var tag = H.day(now), a = p && p.alltag;
    if (!a || a.tag !== tag) return { tag: tag, zaehler: {}, erkundet: [], truhe: false };
    return a;
  };
  /* Zaehlt einen Schritt. Beim Erkunden zaehlt jedes Biom nur einmal. */
  X.alltagSchritt = function (p, art, now, wert) {
    if (!p) return null;
    var a = X.alltagStand(p, now);
    if (art === 'erkunden') {
      if (a.erkundet.indexOf(wert) < 0) a.erkundet.push(wert);
      a.zaehler.erkunden = a.erkundet.length;
    } else a.zaehler[art] = (a.zaehler[art] || 0) + (Number.isFinite(wert) ? wert : 1);
    p.alltag = a;
    return a;
  };
  X.alltagFertig = function (p, now) {
    var a = X.alltagStand(p, now);
    return X.tagesaufgaben(now).every(function (t) { return (a.zaehler[t.id] || 0) >= t.ziel; });
  };

  /* Die Serie zaehlt Schultage am Stueck, an denen die Truhe geoeffnet
     wurde. Das Wochenende unterbricht sie nicht - die Insel ist dann zu. */
  X.SERIE = { gold: 100, jeTag: 20, bonusMax: 200 };
  X.vorherigerSchultag = function (tag) {
    for (var d = tag - 1; d > tag - 8; d--) if (H.CLOSE[H.weekday(d)]) return d;
    return tag - 1;
  };
  /* Wie lang die Serie gerade ist (0, wenn sie abgerissen ist). */
  X.serieStand = function (p, now) {
    var tag = H.day(now), s = p && p.serie;
    if (!s || !Number.isFinite(s.tag)) return 0;
    return s.tag === tag || s.tag === X.vorherigerSchultag(tag) ? s.zahl : 0;
  };
  /* Wie lang sie wird, wenn heute die Truhe aufgeht. */
  X.serieNachTruhe = function (p, now) {
    var tag = H.day(now), s = p && p.serie;
    if (s && s.tag === tag) return s.zahl;
    return s && s.tag === X.vorherigerSchultag(tag) ? s.zahl + 1 : 1;
  };
  /* Was die Truhe bringt: Gold, das mit der Serie waechst, und immer ein
     Ei - am fuenften Tag der Serie ein Episches oder besser, am zehnten ein
     Legendaeres oder besser. */
  X.truhenLohn = function (serie) {
    return { gold: X.SERIE.gold + Math.min(X.SERIE.bonusMax, Math.max(0, serie - 1) * X.SERIE.jeTag),
      eiMindestens: serie > 0 && serie % 10 === 0 ? 4 : serie > 0 && serie % 5 === 0 ? 3 : 0 };
  };
  /* Der naechste besondere Tag der Serie - fuer die Anzeige. */
  X.naechstesSerienEi = function (serie) {
    for (var t = serie + 1; t < serie + 11; t++) { var l = X.truhenLohn(t); if (l.eiMindestens) return { tag: t, mindestens: l.eiMindestens }; }
    return null;
  };

  /* ----------------------------------------------------------------
     Revanche

     Wer ein Gebiet an einen Mitspieler verliert, darf es 30 Stunden lang
     mit einem Zuschlag zurueckfordern - solange es noch dem gehoert, der
     es genommen hat. So wird aus jeder Niederlage eine Geschichte, die
     weitergeht, statt eines Grundes aufzuhoeren.
     ---------------------------------------------------------------- */
  X.REVANCHE_BONUS = .15;
  X.REVANCHE_DAUER = 30 * 3600000;
  X.revanche = function (p, t, now) {
    var r = p && p.revanche && t && p.revanche[t.id];
    return r && t.ownerId && r.gegner === t.ownerId && now < r.bis ? r : null;
  };
  X.revancheBonus = function (p, t, now) { return X.revanche(p, t, now) ? X.REVANCHE_BONUS : 0; };

  /* Neue Felder im Spielstand. D.neuerStand baut den Stand bei jedem Laden
     neu auf und laesst weg, was es nicht kennt - ohne diese Zeilen kaeme im
     Browser weder der Garantie-Zaehler noch der Schimmer an. */
  function ganz(n, max) { n = Math.floor(Number(n)); return Number.isFinite(n) && n >= 0 ? Math.min(max, n) : 0; }
  var vorher = D.neuerStand;
  D.neuerStand = function (save, now) {
    var p = vorher(save, now), old = save || {};
    p.garantie = E.garantieStand(old).map(function (g) { return g.seit; });
    p.schimmernd = {};
    p.besitz.forEach(function (id) { if (old.schimmernd && old.schimmernd[id] === true) p.schimmernd[id] = true; });
    /* Tagesaufgaben: nur Zaehler, die es gibt, nur Biome, die es gibt. */
    var a = old.alltag;
    if (a && Number.isFinite(a.tag)) {
      p.alltag = { tag: Math.floor(a.tag), zaehler: {}, erkundet: [], truhe: a.truhe === true };
      X.TAGESAUFGABEN.forEach(function (t) { var n = ganz(a.zaehler && a.zaehler[t.id], 99); if (n) p.alltag.zaehler[t.id] = n; });
      p.alltag.erkundet = D.FELDER.map(function (f) { return f.id; }).filter(function (id) { return (a.erkundet || []).indexOf(id) >= 0; });
    } else p.alltag = null;
    p.serie = old.serie && Number.isFinite(old.serie.tag) ? { zahl: ganz(old.serie.zahl, 9999), tag: Math.floor(old.serie.tag) } : { zahl: 0, tag: null };
    /* Offene Revanchen - abgelaufene fallen heraus. */
    p.revanche = {};
    var jetzt = Number.isFinite(now) ? now : Date.now();
    D.FELDER.forEach(function (f) {
      var r = old.revanche && old.revanche[f.id];
      if (r && typeof r.gegner === 'string' && Number.isFinite(r.bis) && r.bis > jetzt)
        p.revanche[f.id] = { gegner: r.gegner, name: String(r.name || '').slice(0, 30), bis: r.bis };
    });
    /* Eier, die auf Platz in der Tasche warten (etwa aus der Truhe bei voller Tasche). */
    p.sonderEier = (Array.isArray(old.sonderEier) ? old.sonderEier : []).slice(0, 20).filter(function (e) {
      return e && typeof e.id === 'string' && D.FELDER.some(function (f) { return f.id === e.territoryId; });
    }).map(function (e) {
      var ei = { id: e.id, territoryId: e.territoryId, producedAt: Number(e.producedAt) || 0, startedAt: null, readyAt: null };
      if (ganz(e.mindestens, D.SELTENHEITEN.length - 1)) ei.mindestens = ganz(e.mindestens, D.SELTENHEITEN.length - 1);
      if (typeof e.art === 'string' && /^[a-z]{1,16}$/.test(e.art)) ei.art = e.art;
      /* Ein geschenktes, schon ausgebruetetes Ei bleibt auch beim Warten fertig. */
      if (e.fertig === true && Number.isFinite(e.startedAt) && e.startedAt >= 0) { ei.fertig = true; ei.startedAt = e.startedAt; ei.readyAt = e.startedAt + E.HATCH_TIME; }
      return ei;
    });
    return p;
  };
  /* Wartende Eier rutschen nach, sobald in der Tasche Platz ist. */
  X.sonderEierLiefern = function (p) {
    var n = 0;
    while (p.sonderEier && p.sonderEier.length && p.eggs.length < E.BAG_LIMIT) { p.eggs.push(p.sonderEier.shift()); n++; }
    return n;
  };
})(SG);

/* ------------------------------------------------------------------
   Das Live-Duell: zwei Spieler, die gerade auf der Insel sind, kaempfen
   mit ihren Kampfteams Zug um Zug gegeneinander.

   Beide waehlen gleichzeitig; erst wenn beide gewaehlt haben (oder die
   Zeit abgelaufen ist), rechnet der Server die Runde. Es gelten dieselben
   Treffer, Faehigkeiten und Rollen wie in der Arena - ohne Zuschlaege,
   ohne Plan, ohne Ausbaustufen: nur die beiden Truppen.

   Laeuft im Browser und auf dem Server, darum ohne DOM.
   ------------------------------------------------------------------ */
(function (SG) {
  var R = SG.gehstockmon, A = R.arena, X = R.abenteuer;
  X.DUELL_OPS = ['duell_fordern', 'duell_antwort', 'duell_zug', 'duell_aufgeben'];
  X.SPIELZUEGE.push.apply(X.SPIELZUEGE, X.DUELL_OPS);
  X.DUELL = { einladung: 60000, runde: 30000, verpasstMax: 3, rundenMax: 60,
    lohn: { sieg: 30, trost: 10, patt: 15 }, ruhm: 20, nachlauf: 10 * 60000,
    /* Gold und Ruhm erst ab der dritten Runde und fuer hoechstens drei Duelle
       am Tag gegen denselben Gegner. Vorher liess sich ein Duell annehmen und
       sofort aufgeben, und zwei Spieler erzeugten so Gold ohne Ende. */
    lohnAbRunde: 3, lohnJePaar: 3 };

  function lebt(u) { return !!u && u.hp > 0; }
  function ersatzNoetig(s, seite) { return !lebt(s.teams[seite][s.active[seite]]) && s.teams[seite].some(lebt); }

  A.duellStart = function (teamA, teamB, now) {
    var s = A.create(teamA, teamB, { id: 'duell', now: now });
    s.phase = 'kampf'; s.warten = ['choose', 'choose']; s.aktionen = [null, null]; s.verpasst = [0, 0]; s.verlauf = [];
    return s;
  };
  /* Darf diese Seite gerade diesen Zug machen? */
  A.duellGueltig = function (s, seite, aktion) {
    if (!s || !aktion || typeof aktion !== 'object') return false;
    var team = s.teams[seite], wahl = s.warten[seite];
    if (aktion.kind === 'switch') return (wahl === 'choose' || wahl === 'replace') && Number.isInteger(aktion.slot)
      && lebt(team[aktion.slot]) && aktion.slot !== s.active[seite];
    if (wahl !== 'choose' || aktion.kind !== 'move') return false;
    var zug = A.moves(team[s.active[seite]], s.round).find(function (m) { return m.id === aktion.move; });
    return !!(zug && zug.enabled);
  };
  /* Eine Runde rechnen. Fehlt eine Aktion, geht das Mon in Deckung (oder
     beim Ersatz wird das erste kampffaehige geschickt). */
  A.duellRunde = function (original, aktionen) {
    var s = JSON.parse(JSON.stringify(original)), I = A.intern;
    s.events = [];
    var ersatz = s.warten[0] === 'replace' || s.warten[1] === 'replace';
    if (ersatz) {
      [0, 1].forEach(function (seite) {
        if (s.warten[seite] !== 'replace') return;
        var a = aktionen[seite], slot = a && a.kind === 'switch' && lebt(s.teams[seite][a.slot]) ? a.slot : s.teams[seite].findIndex(lebt);
        s.active[seite] = slot;
        I.record(s, s.teams[seite][slot].name + ' wird in die Arena geschickt.', s.teams[seite][slot], null, 0, 'send');
      });
    } else {
      var zuege = [0, 1].map(function (seite) {
        var a = aktionen[seite];
        if (a && a.kind === 'switch' && A.duellGueltig(s, seite, a)) {
          s.teams[seite][s.active[seite]].shield = 0; s.active[seite] = a.slot;
          I.record(s, s.teams[seite][a.slot].name + ' wird in die Arena geschickt.', s.teams[seite][a.slot], null, 0, 'send');
          return null;
        }
        return a && a.kind === 'move' && A.duellGueltig(s, seite, a) ? a.move : 'guard';
      });
      /* Deckung zuerst, dann das schnellere Mon; bei gleichem Tempo wechselt
         der Vortritt jede Runde, damit keine Seite immer vorn ist. */
      var reihe = [0, 1].filter(function (seite) { return zuege[seite]; }).sort(function (x, y) {
        var dx = zuege[x] === 'guard' ? 1 : 0, dy = zuege[y] === 'guard' ? 1 : 0;
        if (dx !== dy) return dy - dx;
        var vx = s.teams[x][s.active[x]].speed, vy = s.teams[y][s.active[y]].speed;
        if (vx !== vy) return vy - vx;
        return s.round % 2 === 1 ? x - y : y - x;
      });
      var wer = [s.teams[0][s.active[0]].uid, s.teams[1][s.active[1]].uid];
      reihe.forEach(function (seite) {
        var ich = s.teams[seite][s.active[seite]], gegner = s.teams[1 - seite][s.active[1 - seite]];
        if (lebt(ich) && lebt(gegner) && ich.uid === wer[seite]) I.attack(s, seite, zuege[seite]);
      });
      [0, 1].forEach(function (seite) {
        var u = s.teams[seite][s.active[seite]];
        if (!lebt(u)) I.record(s, u.name + ' ist kampfunfähig.', u, null, 0, 'faint');
      });
      s.round++;
    }
    var lebtA = s.teams[0].some(lebt), lebtB = s.teams[1].some(lebt);
    if (!lebtA || !lebtB) { s.phase = 'ende'; s.winner = lebtA ? 0 : lebtB ? 1 : 'patt'; }
    else if (s.round > X.DUELL.rundenMax) { s.phase = 'ende'; s.winner = 'patt'; I.record(s, 'Nach ' + X.DUELL.rundenMax + ' Runden steht es unentschieden.'); }
    else {
      var fehlt = [ersatzNoetig(s, 0), ersatzNoetig(s, 1)];
      s.warten = fehlt[0] || fehlt[1] ? fehlt.map(function (f) { return f ? 'replace' : null; }) : ['choose', 'choose'];
    }
    s.aktionen = [null, null];
    s.verlauf = (original.verlauf || []).concat(s.events.map(function (e) { return e.text; })).slice(-120);
    s.revision++;
    return s;
  };
})(SG);

/* ------------------------------------------------------------------
   GehstockMon - Handel und Gemeinschaft (27.09.2026).

   Drei Dinge, die zusammengehoeren:
   - der Kurierdienst: Pakete zu fremden Aussenposten tragen, gegen Gold;
   - die Markthalle: der zweite Gemeinschaftsbau nach dem Leuchtturm,
     bezahlt aus Spenden und der Gebietsabgabe (E.ABGABE);
   - der Runenhandel beim Haendler, den die Markthalle freischaltet.
   Die Wochenbilanz selbst steht in 1-wirtschaft.js (E.buchen).

   Laeuft im Browser und auf dem Server (build.mjs haengt die Datei an die
   gemeinsamen Regeln), darum ohne DOM.
   ------------------------------------------------------------------ */
(function (SG) {
  var R = SG.gehstockmon, D = R.daten, E = R.wirtschaft, H = R.zeiten, X = R.abenteuer;
  X.HANDEL_OPS = ['kurier_annehmen', 'kurier_abliefern', 'kurier_abbrechen', 'bau_spenden', 'runen_kaufen', 'runen_verkaufen'];
  X.SPIELZUEGE.push.apply(X.SPIELZUEGE, X.HANDEL_OPS);

  /* ----------------------------------------------------------------
     Kurierdienst

     Im Kontor am Arenaplatz liegen Auftraege: ein Paket am Kontor oder am
     Tor eines Aussenpostens abholen und zum Tor eines anderen tragen. Wer
     ankommt, wird bezahlt. Jede geoeffnete Stunde kommt ein Auftrag dazu,
     bis zu fuenf warten - wer nur einmal am Tag hereinschaut, findet also
     einen vollen Stapel. Solange der Stapel voll ist, steht die Uhr.

     Codex hat die erste Fassung (alle 30 Minuten, drei warten) geprueft:
     sie speicherte nur neunzig Minuten und belohnte, wer jede Pause kommt.
     Bezahlt wird der kuerzeste Weg um alle Mauern herum, gemessen als
     Runde vom Kontor ueber Abholung und Ziel zurueck - nicht die Luftlinie
     und nicht, was jemand an Umwegen laeuft. Gold gibt es gestaffelt wie
     bei den Streifzuegen: ohne Gebiet voll, mit einem oder zwei die Haelfte,
     ab drei ein Viertel.

     Jeder vierte Auftrag ist eilig: wer ihn in der Frist abliefert, bekommt
     die Haelfte mehr. Danach gilt der normale Lohn - verloren geht nichts.
     ---------------------------------------------------------------- */
  X.KURIER_ZEIT = 60 * 60000; X.KURIER_VORRAT = 5;
  X.KURIER_EIL = 1.5; X.KURIER_EIL_ANTEIL = .25;
  /* Wie nah man am Tor stehen muss - das Tor selbst ist gut acht Schritte breit. */
  X.KURIER_NAEHE = 14;
  X.KURIER_WAREN = ['Proviant', 'Werkzeug', 'Heilkräuter', 'Laternenöl', 'Briefe', 'Seile', 'Gewürze', 'Runenstaub', 'Decken', 'Honig'];
  /* Wegstrecken um alle Mauern herum, gemessen mit X.route auf der Karte ohne
     Spielergebiete: Zeile und Spalte 0 ist das Kontor (X.STADT_TOR), 1-9 die
     Tore der Gebiete. tools/gehstockmon-handel-tests.mjs misst nach - aendert
     sich die Karte, schlaegt der Test an. Fest hinterlegt, weil eine einzige
     Wegsuche auf dem Handy-Server bis zu 50 ms braucht. */
  X.KURIER_WEGE = [
    [0, 95, 217, 218, 97, 198, 57, 265, 124, 208],
    [95, 0, 300, 310, 167, 224, 103, 359, 130, 284],
    [217, 300, 0, 122, 262, 396, 206, 270, 340, 345],
    [218, 310, 122, 0, 197, 338, 216, 149, 305, 253],
    [97, 167, 262, 197, 0, 142, 147, 198, 115, 124],
    [198, 224, 396, 338, 142, 0, 248, 293, 95, 141],
    [57, 103, 206, 216, 147, 248, 0, 298, 166, 259],
    [265, 359, 270, 149, 198, 293, 298, 0, 313, 169],
    [124, 130, 340, 305, 115, 95, 166, 313, 0, 186],
    [208, 284, 345, 253, 124, 141, 259, 169, 186, 0]
  ];
  X.kurierWeg = function (von, nach) { var z = X.KURIER_WEGE[von]; return z && Number.isFinite(z[nach]) ? z[nach] : 0; };
  /* Die ganze Runde: vom Kontor zur Abholung, von dort zum Ziel, zurueck. */
  X.kurierRunde = function (a) { return X.kurierWeg(0, a.von) + X.kurierWeg(a.von, a.nach) + X.kurierWeg(a.nach, 0); };
  /* 12 Gold fuer die kuerzeste Runde (Tauwiese und zurueck), 35 fuer die laengsten. */
  X.kurierLohn = function (runde) { return Math.max(12, Math.min(35, Math.round(6 + runde * 0.05))); };
  /* Eilig heisst: eine Minute Luft plus anderthalbmal die Laufzeit (9 Schritte
     je Sekunde, etwas langsamer als moeglich). */
  X.kurierFrist = function (a) { return 60000 + Math.round(X.kurierWeg(a.von, a.nach) / 9 * 1500); };
  /* Wo abgeholt und abgeliefert wird: das Kontor oder vor dem Tor eines
     Gebiets. Gehoeren zwei benachbarte Gebiete demselben, teilen sie sich ein
     Tor - dann zaehlt das gemeinsame. */
  X.tor = function (layout, id) {
    var g = (layout || []).find(function (v) { return v.fields.indexOf(id) >= 0; });
    return g ? { x: g.gate.x + g.gate.nx * 4, z: g.gate.z + g.gate.nz * 4 } : null;
  };
  X.kurierOrt = function (layout, ort) { return ort ? X.tor(layout, ort) : { x: X.STADT_TOR.x, z: X.STADT_TOR.z }; };
  X.kurierOrtName = function (ort) { return ort ? D.FELDER[ort - 1].name : X.STADT.name; };
  /* Ein neuer Auftrag. Abholen und Abliefern nur an fremden Posten - wer
     fast die ganze Insel haelt, bekommt Ziele aus allen. */
  X.kurierAuftrag = function (zufall, eigene, nummer) {
    var alle = D.FELDER.map(function (f) { return f.id; });
    var fremd = alle.filter(function (id) { return (eigene || []).indexOf(id) < 0; });
    if (fremd.length < 2) fremd = alle;
    var von = zufall() < 0.7 ? 0 : fremd[Math.floor(zufall() * fremd.length)];
    var ziele = fremd.filter(function (id) { return id !== von; }), nach = ziele[Math.floor(zufall() * ziele.length)];
    var a = { id: 'k' + nummer, von: von, nach: nach, ware: X.KURIER_WAREN[Math.floor(zufall() * X.KURIER_WAREN.length)] };
    a.lohn = X.kurierLohn(X.kurierRunde(a)); a.eilig = zufall() < X.KURIER_EIL_ANTEIL;
    return a;
  };
  function reifeAuftraege(p, now) {
    var stand = p && p.kurierAt;
    if (!Number.isFinite(stand)) return 0;
    return Math.max(0, Math.min(X.KURIER_VORRAT, Math.floor((H.openTime(now) - H.openTime(stand)) / X.KURIER_ZEIT)));
  }
  /* Legt faellige Auftraege aufs Brett. Zurueck kommt, wie viele neu sind. */
  X.kurierNachfuellen = function (p, now, zufall, eigene) {
    var neu = 0;
    while (p.kurierBrett.length < X.KURIER_VORRAT && reifeAuftraege(p, now) > 0) {
      p.kurierSerie = (p.kurierSerie || 0) + 1;
      p.kurierBrett.push(X.kurierAuftrag(zufall, eigene, p.kurierSerie));
      var voll = H.openTime(now) - X.KURIER_VORRAT * X.KURIER_ZEIT;
      p.kurierAt = H.productionAt(Math.max(H.openTime(p.kurierAt), voll) + X.KURIER_ZEIT);
      neu++;
    }
    return neu;
  };
  /* Wann der naechste Auftrag kommt - fuer die Anzeige. Bei vollem Brett keiner. */
  X.kurierWartezeit = function (p, now) {
    if (!p || (p.kurierBrett || []).length >= X.KURIER_VORRAT || !Number.isFinite(p.kurierAt)) return 0;
    var offen = H.openTime(now) - H.openTime(p.kurierAt), bis = (Math.floor(Math.max(0, offen) / X.KURIER_ZEIT) + 1) * X.KURIER_ZEIT;
    return Math.max(0, H.productionAt(H.openTime(p.kurierAt) + bis) - now);
  };
  /* Was ein Auftrag jemandem mit so vielen Gebieten bringt. */
  /* faktor: Wetter und Erlass der Woche (X.effekt 'kurier'), sonst 1. */
  X.kurierBetrag = function (a, gebiete, eil, faktor) {
    return Math.round(a.lohn * (eil ? X.KURIER_EIL : 1) * X.streifzugGoldAnteil(gebiete) * (Number.isFinite(faktor) ? faktor : 1));
  };

  /* ----------------------------------------------------------------
     Gemeinschaftsbauten nach dem Leuchtturm

     Die Insel baut ein Bauwerk nach dem anderen. Bezahlt wird aus Spenden
     und aus der Gebietsabgabe; die Spender stehen auf der Tafel. Solange
     kein Bau offen ist, ruht die Abgabe.

     Die Markthalle kostet 6.000 Gold. Ohne Spenden braeuchte sie 60.000
     Gold Gebietsertrag - bei vollem Land etwa vier Schulwochen; jede Spende
     macht es schneller. Sie schaltet den Runenhandel beim Haendler frei.
     ---------------------------------------------------------------- */
  X.BAUTEN = [
    { id: 'markthalle', name: 'Markthalle', ziel: 6000, mindestens: 10,
      was: 'Schaltet den Runenhandel beim Händler frei: Runen jeder Seltenheit kaufen und verkaufen.' }
  ];
  X.bau = function (id) { return X.BAUTEN.find(function (b) { return b.id === id; }) || null; };
  X.bauFertig = function (stand, id) { var def = X.bau(id), b = stand && stand[id]; return !!(def && b && b.gold >= def.ziel); };
  /* Der Bau, an dem die Insel gerade arbeitet - der erste, der noch fehlt. */
  X.offenerBau = function (stand) { return X.BAUTEN.find(function (b) { return !X.bauFertig(stand, b.id); }) || null; };

  /* ----------------------------------------------------------------
     Runenhandel beim Haendler

     Feste Preise statt eines Kurses: Codex hat gezeigt, dass ein Kurs nach
     Bestand sich mit Zweitkonten verschieben laesst und wer billig kauft und
     teuer verkauft, bis zu neun Prozent verdient. Der Haendler kauft zu 70 %
     zurueck. Hin und zurueck verliert man immer, auch ueber die Schmiede:
     eine Rune kaufen und zerlegen kostet mindestens 24 Gold mehr, als die
     zwei kleineren beim Verkauf bringen.

     Zwei Grenzen je Woche. Verkaufen hoechstens fuer 500 Gold, sonst werden
     seltene Streifzug-Runen zur Goldquelle. Kaufen hoechstens fuer 1.000
     Gold - sonst verwandelt sich Gebietsgold ohne Umweg in Runenstufen, und
     wer am meisten Land haelt, zieht auch im Kampf davon. Gezaehlt wird in
     der Wochenbilanz (Runenverkauf und Runenkauf).
     ---------------------------------------------------------------- */
  X.RUNEN_PREISE = [8, 15, 25, 45, 80, 140, 240];
  X.RUNEN_ANKAUF = 0.7;
  X.RUNEN_VERKAUF_DECKEL = 500; X.RUNEN_KAUF_DECKEL = 1000;
  X.runenAnkauf = function (rang) { return Math.floor((X.RUNEN_PREISE[rang] || 0) * X.RUNEN_ANKAUF); };
  /* faktor: die Marktwoche verdoppelt beide Grenzen (X.effekt 'handelDeckel'). */
  X.runenHandelStand = function (p, now, faktor) {
    var b = E.bilanzSicht(p, now).diese, f = Number.isFinite(faktor) ? faktor : 1;
    return { verkauft: b.rein.handel || 0, gekauft: b.raus.handel || 0,
      verkaufFrei: Math.max(0, Math.round(X.RUNEN_VERKAUF_DECKEL * f) - (b.rein.handel || 0)), kaufFrei: Math.max(0, Math.round(X.RUNEN_KAUF_DECKEL * f) - (b.raus.handel || 0)) };
  };

  /* Wer am meisten austraegt, bekommt einen Titel dafuer. */
  X.TITEL.push({ id: 'eilbote', name: 'Eilbote', was: 'Pakete abgeliefert', ziel: 40, wert: function (p) { return p.kurierGesamt || 0; } });

  /* Neue Felder im Spielstand. */
  function ganz(n, max) { n = Math.floor(Number(n)); return Number.isFinite(n) && n >= 0 ? Math.min(max, n) : 0; }
  function auftragSauber(a) {
    if (!a || typeof a.id !== 'string' || !/^k\d{1,9}$/.test(a.id)) return null;
    var von = ganz(a.von, D.FELDER.length), nach = ganz(a.nach, D.FELDER.length);
    if (!nach || von === nach || X.KURIER_WAREN.indexOf(a.ware) < 0) return null;
    var sauber = { id: a.id, von: von, nach: nach, ware: a.ware, lohn: Math.max(12, Math.min(35, ganz(a.lohn, 35))), eilig: a.eilig === true };
    return sauber;
  }
  var vorher = D.neuerStand;
  D.neuerStand = function (save, now) {
    var p = vorher(save, now), old = save || {}, jetzt = Number.isFinite(now) ? now : Date.now();
    /* Wer zum ersten Mal kommt, findet einen vollen Stapel vor. */
    p.kurierAt = Number.isFinite(old.kurierAt) ? old.kurierAt : X.schonReif(jetzt, X.KURIER_ZEIT, X.KURIER_VORRAT);
    p.kurierSerie = ganz(old.kurierSerie, 1e9);
    var gesehen = {};
    p.kurierBrett = (Array.isArray(old.kurierBrett) ? old.kurierBrett : []).map(auftragSauber)
      .filter(function (a) { if (!a || gesehen[a.id]) return false; gesehen[a.id] = true; return true; }).slice(0, X.KURIER_VORRAT);
    var k = auftragSauber(old.kurier);
    p.kurier = k && Number.isFinite(old.kurier.seit) ? Object.assign(k, { seit: old.kurier.seit, frist: k.eilig && Number.isFinite(old.kurier.frist) ? old.kurier.frist : null }) : null;
    p.kurierGesamt = ganz(old.kurierGesamt, 1e6);
    return p;
  };
})(SG);

/* ------------------------------------------------------------------
   GehstockMon - Warenwirtschaft (27.09.2026).

   Holz, Erz und Kristall (E.ROHSTOFFE in 1-wirtschaft.js). Sie kommen von
   drei Seiten:
   - Aussenposten foerdern den Rohstoff ihres Bioms (abgeholt mit den Eiern);
   - Rohstoffstellen auf der Insel kann jeder abbauen, auch ohne Gebiet;
   - wer ein Paket an einem Aussenposten abholt, bekommt beim Abliefern eine
     Einheit von dessen Rohstoff dazu.
   Gebraucht werden sie fuer den Ausbau der Aussenposten, fuer den Hafenkran
   und im Handel mit dem Haendler (nach der Markthalle).

   Codex hat die erste Fassung verworfen, weil drei Spieler acht der neun
   Gebiete halten: Pflichtrohstoffe aus Gebieten waeren ihr Vetorecht ueber
   alle Bauten. Darum gibt es jeden Rohstoff auch an oeffentlichen Stellen
   und beim Haendler, und es gibt keinen Weg, Rohstoffe an andere Spieler zu
   geben - sonst schoebe ein Zweitkonto seine Ernte aufs Hauptkonto.
   ------------------------------------------------------------------ */
(function (SG) {
  var R = SG.gehstockmon, D = R.daten, E = R.wirtschaft, H = R.zeiten, X = R.abenteuer;
  X.ROHSTOFF_OPS = ['abbauen', 'rohstoff_kaufen', 'rohstoff_verkaufen'];
  X.SPIELZUEGE.push.apply(X.SPIELZUEGE, X.ROHSTOFF_OPS);
  X.HANDEL_OPS.push.apply(X.HANDEL_OPS, X.ROHSTOFF_OPS);

  /* Je Stunde sechs Stellen, von jedem Rohstoff zwei in zwei seiner drei
     Biome, ausserhalb der Mauern. Zwei Einheiten je Stelle, in der Erntezeit
     doppelt so viel. Wie bei den Runen: jede Stelle einmal je Spieler. */
  X.ROHSTOFF_STELLEN = 2; X.ROHSTOFF_MENGE = 2; X.ROHSTOFF_NAEHE = 8;
  X.rohstoffStellen = function (now, territories) {
    var epoche = Math.floor(now / X.SPAWN_TIME), saat = (Math.imul(epoche, 104729) + 7331) >>> 0, layout = X.layout(territories || []), out = [];
    function zufall() { saat = (Math.imul(saat, 1664525) + 1013904223) >>> 0; return saat / 4294967296; }
    E.ROHSTOFFE.forEach(function (r) {
      var gebiete = r.gebiete.slice();
      for (var n = 0; n < X.ROHSTOFF_STELLEN && gebiete.length; n++) {
        var gebiet = gebiete.splice(Math.floor(zufall() * gebiete.length), 1)[0], mitte = D.BIOME[gebiet - 1], punkt = null;
        for (var versuch = 0; versuch < 40 && !punkt; versuch++) {
          var w = zufall() * Math.PI * 2, d = 54 + zufall() * 18, p = { x: mitte.x + Math.cos(w) * d, z: mitte.z + Math.sin(w) * d };
          if (X.walkable(p) && !layout.some(function (g) { return X.inside(p, g); }) && X.canTravel(layout, p, p, 'public')) punkt = p;
        }
        if (punkt) out.push({ id: epoche + ':' + r.id + ':' + gebiet, rohstoff: r.id, gebiet: gebiet, x: Math.round(punkt.x * 10) / 10, z: Math.round(punkt.z * 10) / 10,
          menge: X.ROHSTOFF_MENGE, expiresAt: (epoche + 1) * X.SPAWN_TIME });
      }
    });
    return out;
  };

  /* Handel mit dem Haendler, erst wenn die Markthalle steht - dieselben
     Wochengrenzen wie bei den Runen (Runen und Rohstoffe zusammen). Er
     verkauft zum vollen Preis und kauft zur Haelfte zurueck. */
  X.ROHSTOFF_PREISE = { holz: 8, erz: 10, kristall: 12 };
  X.rohstoffAnkauf = function (id) { return Math.floor((X.ROHSTOFF_PREISE[id] || 0) / 2); };
  /* Wer ein Paket an einem Aussenposten abholt, traegt dessen Ware mit. */
  X.KURIER_ROHSTOFF = 1;

  /* Der zweite Gemeinschaftsbau: der Hafenkran. Er braucht Gold und alle
     drei Rohstoffe und macht die Kuriere fuer immer schneller reich. Er
     steht gleichzeitig mit der Markthalle offen; die Gebietsabgabe geht in
     den ersten Bau, der noch Gold braucht. */
  X.HAFENKRAN_KURIER = 1.2;
  X.BAUTEN.push({ id: 'hafenkran', name: 'Hafenkran', ziel: 1500, mindestens: 10, rohstoffe: { holz: 60, erz: 40, kristall: 30 },
    was: 'Kuriere bekommen 20 % mehr Lohn - für immer.' });
  X.bauGoldFertig = function (stand, id) { var def = X.bau(id), b = stand && stand[id]; return !!(def && b && b.gold >= def.ziel); };
  X.bauFertig = function (stand, id) {
    var def = X.bau(id), b = stand && stand[id];
    if (!def || !b || b.gold < def.ziel) return false;
    return Object.keys(def.rohstoffe || {}).every(function (r) { return ((b.rohstoffe && b.rohstoffe[r]) || 0) >= def.rohstoffe[r]; });
  };
  /* Wohin die Gebietsabgabe fliesst: in den ersten Bau, der noch Gold braucht. */
  X.bauFuerGold = function (stand) { return X.BAUTEN.find(function (b) { return !X.bauGoldFertig(stand, b.id); }) || null; };

  /* Rohstoffsammler: ein Titel fuer die, die am meisten abbauen. */
  X.TITEL.push({ id: 'rohstoffsammler', name: 'Bergmann', was: 'Rohstoffstellen abgebaut', ziel: 60, wert: function (p) { return p.abgebaut || 0; } });

  function ganz(n, max) { n = Math.floor(Number(n)); return Number.isFinite(n) && n >= 0 ? Math.min(max, n) : 0; }
  var vorher = D.neuerStand;
  D.neuerStand = function (save, now) {
    var p = vorher(save, now), old = save || {};
    p.rohstoffClaims = Array.isArray(old.rohstoffClaims) ? old.rohstoffClaims.filter(function (v) { return typeof v === 'string'; }).slice(-60) : [];
    p.abgebaut = ganz(old.abgebaut, 1e6);
    return p;
  };
})(SG);

/* ------------------------------------------------------------------
   GehstockMon - die Insel als Ganzes (27.09.2026): Inselwetter und die
   Erlasse des Buergermeisters.

   Beides wirkt eine Schulwoche lang auf dieselben Stellschrauben, und
   beides laeuft ueber X.effekt: Wer irgendwo Gold, Runen oder Zeiten
   berechnet, fragt dort nach dem Faktor der Woche. So steht an einer
   Stelle, was eine Woche veraendert, und nicht verstreut in jedem Zug.

   Codex hat die erste Fassung geprueft. Uebernommen:
   - Kein Wetter sperrt Wege (Sturm mit gesperrten Bruecken ist raus) oder
     versteckt Verteidigungen (Nebel liess sich per Screenshot umgehen).
   - Kein Wetter und kein Erlass beruehrt das Schluepfen - sonst horten
     alle ihre Eier fuer die guenstige Woche.
   - Jede Wirkung ist ein klarer Faktor; "doppelt so stark" heisst hier
     immer genau eine Zahl.

   Laeuft im Browser und auf dem Server, darum ohne DOM.
   ------------------------------------------------------------------ */
(function (SG) {
  var R = SG.gehstockmon, D = R.daten, E = R.wirtschaft, H = R.zeiten, X = R.abenteuer;

  /* ----------------------------------------------------------------
     Inselwetter: jede Woche ein Zustand, eine Woche im Voraus bekannt.
     ---------------------------------------------------------------- */
  X.WETTER = [
    { id: 'klar', name: 'Klarer Himmel', zeichen: '☀️', farbe: '#f0ca80',
      text: 'Nichts Besonderes - die Insel atmet durch.', effekte: {} },
    { id: 'duerre', name: 'Dürre', zeichen: '🌵', farbe: '#e0a45a',
      text: 'Die Gebiete bringen ein Fünftel weniger Gold. Wer im Hafen arbeitet oder Pakete trägt, bekommt 30 % mehr.',
      effekte: { gebietsgold: .8, tagwerk: 1.3, kurier: 1.3 } },
    { id: 'rueckenwind', name: 'Rückenwind', zeichen: '🍃', farbe: '#8fd18a',
      text: 'Streifzüge sind ein Viertel schneller zurück.', effekte: { streifzugDauer: .75 } },
    { id: 'runenregen', name: 'Runenregen', zeichen: '✨', farbe: '#c9b6ff',
      text: 'Verlorene Runen geben zwei statt einer, und wer auf Streifzug Runen sucht, findet die Hälfte mehr.',
      effekte: { runenFund: 2, streifzugRunen: 1.5 } },
    { id: 'heldenwoche', name: 'Heldenwoche', zeichen: '⚔️', farbe: '#f2705a',
      text: 'Der Zerhacker hat anderthalbmal so viel Lebenskraft - und lässt anderthalbmal so viel Beute fallen.',
      effekte: { zerhackerKraft: 1.5, zerhackerBeute: 1.5 } },
    { id: 'erntezeit', name: 'Erntezeit', zeichen: '🌾', farbe: '#e8d06a',
      text: 'Rohstoffstellen geben doppelt so viel Holz, Erz und Kristall.', effekte: { rohstoffStelle: 2 } },
    { id: 'marktwoche', name: 'Marktwoche', zeichen: '🏷️', farbe: '#89cce5',
      text: 'Der Händler kauft und verkauft doppelt so viel wie sonst - die Wochengrenzen im Runen- und Rohstoffhandel verdoppeln sich.',
      effekte: { handelDeckel: 2 } }
  ];
  X.wetterNach = function (id) { return X.WETTER.find(function (w) { return w.id === id; }) || X.WETTER[0]; };
  /* Jede Folge von sieben Wochen bringt jedes Wetter genau einmal, in einer
     aus der Folgennummer gemischten Reihenfolge. Am Uebergang zweier Folgen
     kommt dasselbe Wetter nie zweimal hintereinander. */
  function folge(n) {
    var ids = X.WETTER.map(function (w) { return w.id; }), saat = (Math.imul(n + 7, 2654435761) >>> 0) || 1;
    for (var i = ids.length - 1; i > 0; i--) {
      saat = (Math.imul(saat, 1664525) + 1013904223) >>> 0;
      var j = saat % (i + 1), t = ids[i]; ids[i] = ids[j]; ids[j] = t;
    }
    return ids;
  }
  X.wetterDerWoche = function (woche) {
    var n = X.WETTER.length, runde = Math.floor(woche / n), stelle = ((woche % n) + n) % n, ids = folge(runde);
    var vorher = folge(runde - 1);
    if (ids[0] === vorher[n - 1]) { var t = ids[0]; ids[0] = ids[1]; ids[1] = t; }
    return X.wetterNach(ids[stelle]);
  };
  X.wetter = function (now) { return X.wetterDerWoche(X.zerhackerWoche(now)); };
  X.wetterNaechste = function (now) { return X.wetterDerWoche(X.zerhackerWoche(now) + 1); };

  /* ----------------------------------------------------------------
     Erlasse: was der Buergermeister fuer seine Woche verspricht. Die Wahl
     selbst steht weiter unten; hier nur, was ein Erlass bewirkt. Keiner
     schaltet etwas ab (Codex: eine "Friedenswoche" nimmt anderen ein Spiel
     weg), und keiner belohnt es, mit Spenden zu warten.
     ---------------------------------------------------------------- */
  X.ERLASSE = [
    { id: 'kurierwoche', name: 'Kurierwoche', zeichen: '📦', text: 'Kuriere bekommen 25 % mehr Lohn.', effekte: { kurier: 1.25 } },
    { id: 'arenafest', name: 'Arenafest', zeichen: '🏟️', text: 'Siege in der Großen Arena bringen 25 % mehr Gold.', effekte: { arenaLohn: 1.25 } },
    { id: 'bauwoche', name: 'Bauwoche', zeichen: '🏗️', text: 'Die Gebietsabgabe steigt auf 15 % - die Insel baut schneller.', effekte: { abgabe: 1.5 } },
    { id: 'steuererleichterung', name: 'Steuererleichterung', zeichen: '💰', text: 'Die Gebietsabgabe sinkt auf 5 %.', effekte: { abgabe: .5 } },
    { id: 'erntedank', name: 'Erntedank', zeichen: '🌾', text: 'Rohstoffstellen geben die Hälfte mehr.', effekte: { rohstoffStelle: 1.5 } },
    { id: 'schutzwache', name: 'Schutzwache', zeichen: '🛡️', text: 'Wer überfallen wurde, hat vier statt zwei Stunden Ruhe, und zwischen zwei Überfällen liegen 45 statt 30 Minuten.',
      effekte: { raubSchutz: 2, raubPause: 1.5 } },
    { id: 'wetterschutz', name: 'Wetterschutz', zeichen: '☂️', text: 'Das Wetter wirkt nur halb so stark - im Guten wie im Schlechten.', effekte: {}, daempft: .5 }
  ];
  X.erlass = function (id) { return X.ERLASSE.find(function (e) { return e.id === id; }) || null; };
  /* Der Faktor der Woche fuer eine Stellschraube: erst das Wetter (vom
     Wetterschutz gedaempft), dann der Erlass. Ohne Wirkung 1. */
  X.effekt = function (now, erlassId, schluessel) {
    var w = X.wetter(now), e = X.erlass(erlassId), m = (w.effekte && w.effekte[schluessel]) || 1;
    if (e && e.daempft) m = 1 + (m - 1) * e.daempft;
    if (e && e.effekte && e.effekte[schluessel]) m *= e.effekte[schluessel];
    return m;
  };
  /* ----------------------------------------------------------------
     Die Buergermeisterwahl

     Jede Woche kann kandidieren, wer lange genug dabei ist, und verspricht
     dabei einen Erlass. Gewaehlt wird die ganze Woche; beim Wochenwechsel
     wird ausgezaehlt, und der Erlass des Siegers gilt die naechste Woche.
     Stimmen bleiben bis zur Auszaehlung geheim.

     Codex' Einwand: drei Besuchstage beweisen keine drei Menschen - ein
     Zweitkonto kann mitwaehlen. Ganz verhindern laesst sich das nicht,
     solange die Zugangscodes berechenbar sind. Teuer wird es trotzdem:
     Waehlen darf nur, wer den Trainerrang Spaeher hat (60 Erfahrung, etwa
     sechs Trainersiege), an drei verschiedenen Schultagen der letzten zwei
     Wochen da war und dessen Konto drei Tage alt ist. Kandidieren verlangt
     den Rang Faehrtenleser (150) und ein Konto von sieben Tagen.
     ---------------------------------------------------------------- */
  X.WAHL_OPS = ['kandidieren', 'waehlen'];
  X.SPIELZUEGE.push.apply(X.SPIELZUEGE, X.WAHL_OPS);
  /* offen: Vorerst (28.09.2026, auf Wunsch von Louis) darf jeder waehlen
     und kandidieren. Die Huerden unten bleiben stehen und gelten wieder,
     sobald offen auf false steht. */
  /* gehalt: Gold fuer den Sieger, einmal bei der Auszaehlung (28.09.2026).
     Der Erlass hilft allen gleich - ohne eigenen Lohn hatte das Amt ausser
     dem Titel nichts zu bieten. So viel wie die groesste Wochenaufgabe. */
  X.WAHL = { offen: true, gehalt: 300, stimmeErfahrung: 60, kandidatErfahrung: 150, tage: 3, stimmeAlter: 3 * 86400000, kandidatAlter: 7 * 86400000, fenster: 14 };
  /* Schultage, an denen jemand da war - die letzten vierzehn. */
  X.aktivMerken = function (p, now) {
    var tag = H.day(now); p.aktivTage = Array.isArray(p.aktivTage) ? p.aktivTage : [];
    if (p.aktivTage[p.aktivTage.length - 1] !== tag) p.aktivTage = p.aktivTage.concat(tag).slice(-X.WAHL.fenster);
  };
  X.aktiveTage = function (p, now) { var heute = H.day(now); return (p && p.aktivTage || []).filter(function (t) { return heute - t < X.WAHL.fenster; }).length; };
  X.wahlRecht = function (p, now) {
    if (X.WAHL.offen) return { stimme: true, kandidat: true, fehlt: [], kandidatFehlt: [] };
    var erf = X.erfahrung(p), tage = X.aktiveTage(p, now), alter = now - ((p && p.joinedAt) || now), W = X.WAHL, fehlt = [];
    if (erf < W.stimmeErfahrung) fehlt.push('Trainerrang Späher (' + erf + '/' + W.stimmeErfahrung + ' Erfahrung)');
    if (tage < W.tage) fehlt.push(W.tage + ' Schultage in zwei Wochen (' + tage + ')');
    if (alter < W.stimmeAlter) fehlt.push('ein Konto, das drei Tage alt ist');
    var stimme = !fehlt.length, kFehlt = fehlt.slice();
    if (erf < W.kandidatErfahrung) kFehlt.push('Trainerrang Fährtenleser (' + erf + '/' + W.kandidatErfahrung + ' Erfahrung)');
    if (alter < W.kandidatAlter) kFehlt.push('ein Konto, das sieben Tage alt ist');
    return { stimme: stimme, kandidat: !kFehlt.length, fehlt: fehlt, kandidatFehlt: kFehlt.filter(function (v, i, a) { return a.indexOf(v) === i; }) };
  };
  var vorher = D.neuerStand;
  D.neuerStand = function (save, now) {
    var p = vorher(save, now), alt = save && save.aktivTage;
    p.aktivTage = Array.isArray(alt) ? alt.filter(function (t) { return Number.isFinite(t); }).map(Math.floor).slice(-X.WAHL.fenster) : [];
    return p;
  };

  /* Alle Faktoren der Woche auf einmal - fuer die Anzeige im Browser. */
  X.EFFEKT_SCHLUESSEL = ['gebietsgold', 'tagwerk', 'kurier', 'streifzugDauer', 'runenFund', 'streifzugRunen', 'zerhackerKraft', 'zerhackerBeute',
    'rohstoffStelle', 'handelDeckel', 'arenaLohn', 'abgabe', 'raubSchutz', 'raubPause'];
  X.effekte = function (now, erlassId) {
    var out = {};
    X.EFFEKT_SCHLUESSEL.forEach(function (k) { var m = X.effekt(now, erlassId, k); if (m !== 1) out[k] = Math.round(m * 1000) / 1000; });
    return out;
  };
})(SG);

/* ------------------------------------------------------------------
   GehstockMon - Schatzkarten (27.09.2026).

   Vier Kartenfetzen ergeben eine Karte. Sie liest man, und sie fuehrt zu
   einer Grabstelle, die nur fuer einen selbst gilt: kein Wettlauf, wer
   zuerst da ist. Die Karte nennt das Biom, eine Wuenschelrute sagt beim
   Laufen "kalt", "warm", "heiss" - gesucht ist man in zwei bis fuenf
   Minuten, also in einer Pause.

   Codex hat die erste Fassung geprueft. Uebernommen:
   - Die Fetzen kommen sicher aus dem, was man ohnehin tut, nicht aus einem
     seltenen Zufall (bei 10 % Chance waeren es vierzig Aktionen je Karte).
   - Fortschritt verfaellt nicht, aber gelesen wird hoechstens eine Karte je
     Woche.
   - Der Fund sind Runen, Gold und Rohstoffe - kein garantiertes episches
     Ei, das haette die Truhenserie entwertet.
   ------------------------------------------------------------------ */
(function (SG) {
  var R = SG.gehstockmon, D = R.daten, E = R.wirtschaft, H = R.zeiten, X = R.abenteuer;
  X.SCHATZ_OPS = ['schatz_lesen', 'schatz_graben'];
  X.OPS.push.apply(X.OPS, X.SCHATZ_OPS);
  X.SPIELZUEGE.push.apply(X.SPIELZUEGE, X.SCHATZ_OPS);

  X.SCHATZ_FETZEN = 4;
  /* Woher die Fetzen kommen: jede Quelle zaehlt fuer sich, und alle n Mal
     gibt es einen Fetzen. Die Truhe jeden Tag, ein langer Streifzug jedes
     Mal - so hat jede Spielweise ihren Weg zur Karte. */
  X.SCHATZ_QUELLEN = { truhe: 1, streifzug: 1, kurier: 3, rohstoff: 4, trainer: 3 };
  X.SCHATZ_NAME = { truhe: 'Tagestruhe', streifzug: 'lange Streifzüge', kurier: 'jede dritte Lieferung', rohstoff: 'jede vierte Rohstoffstelle', trainer: 'jeder dritte Trainersieg' };
  X.schatzStand = function (p) {
    var s = p && p.schatz;
    return s && typeof s === 'object' ? s : { fetzen: 0, zaehler: {}, woche: null, karte: null, funde: 0 };
  };
  /* Zaehlt eine Taetigkeit. Zurueck kommt true, wenn daraus ein Fetzen wurde. */
  X.schatzFetzen = function (p, quelle) {
    var n = X.SCHATZ_QUELLEN[quelle]; if (!p || !n) return false;
    var s = X.schatzStand(p); p.schatz = s;
    if (s.karte || s.fetzen >= X.SCHATZ_FETZEN) return false;
    s.zaehler = s.zaehler || {}; s.zaehler[quelle] = (s.zaehler[quelle] || 0) + 1;
    if (s.zaehler[quelle] < n) return false;
    s.zaehler[quelle] = 0; s.fetzen = Math.min(X.SCHATZ_FETZEN, s.fetzen + 1);
    return true;
  };
  X.schatzLesbar = function (p, now) { var s = X.schatzStand(p); return !s.karte && s.fetzen >= X.SCHATZ_FETZEN && s.woche !== X.zerhackerWoche(now); };
  /* Die Grabstelle: in einem Biom, ausserhalb aller Mauern, gut erreichbar. */
  X.schatzOrt = function (zufall, territories) {
    var layout = X.layout(territories || []);
    for (var versuch = 0; versuch < 200; versuch++) {
      var gebiet = 1 + Math.floor(zufall() * D.FELDER.length), mitte = D.BIOME[gebiet - 1];
      var w = zufall() * Math.PI * 2, d = 50 + zufall() * 26, p = { x: mitte.x + Math.cos(w) * d, z: mitte.z + Math.sin(w) * d };
      if (X.walkable(p) && !layout.some(function (g) { return X.inside(p, g); }) && X.canTravel(layout, p, p, 'public'))
        return { x: Math.round(p.x * 10) / 10, z: Math.round(p.z * 10) / 10, gebiet: gebiet };
    }
    return { x: X.STADT_TOR.x, z: X.STADT_TOR.z + 20, gebiet: 6 };
  };
  /* Die Wuenschelrute: wie weit ist es noch? */
  X.SCHATZ_NAEHE = 6;
  X.schatzRute = function (abstand) {
    if (abstand <= X.SCHATZ_NAEHE) return { stufe: 4, text: 'Hier graben!', zeichen: '✨' };
    if (abstand <= 18) return { stufe: 3, text: 'ganz heiß', zeichen: '🔥' };
    if (abstand <= 40) return { stufe: 2, text: 'heiß', zeichen: '♨️' };
    if (abstand <= 80) return { stufe: 1, text: 'warm', zeichen: '🌡️' };
    return { stufe: 0, text: 'kalt', zeichen: '❄️' };
  };
  /* Der Fund: drei Runen einer gewuerfelten Seltenheit, Gold und Rohstoffe
     des Bioms. */
  X.SCHATZ_GOLD = 100; X.SCHATZ_RUNEN = 3; X.SCHATZ_ROHSTOFF = 5;
  X.schatzFund = function (zufall, gebiet) {
    var w = zufall(), rang = w < .5 ? 2 : w < .85 ? 3 : 4;
    return { gold: X.SCHATZ_GOLD, runen: X.SCHATZ_RUNEN, rang: rang, rohstoff: E.rohstoffVon(gebiet).id, menge: X.SCHATZ_ROHSTOFF };
  };
  X.TITEL.push({ id: 'schatzsucher', name: 'Schatzsucher', was: 'Schätze gehoben', ziel: 5, wert: function (p) { return (p.schatz && p.schatz.funde) || 0; } });

  function ganz(n, max) { n = Math.floor(Number(n)); return Number.isFinite(n) && n >= 0 ? Math.min(max, n) : 0; }
  var vorher = D.neuerStand;
  D.neuerStand = function (save, now) {
    var p = vorher(save, now), s = save && save.schatz;
    var sauber = { fetzen: 0, zaehler: {}, woche: null, karte: null, funde: 0 };
    if (s && typeof s === 'object') {
      sauber.fetzen = ganz(s.fetzen, X.SCHATZ_FETZEN);
      Object.keys(X.SCHATZ_QUELLEN).forEach(function (q) { var n = ganz(s.zaehler && s.zaehler[q], 99); if (n) sauber.zaehler[q] = n; });
      sauber.woche = Number.isFinite(s.woche) ? Math.floor(s.woche) : null;
      var k = s.karte;
      if (k && Number.isFinite(k.x) && Number.isFinite(k.z) && ganz(k.gebiet, D.FELDER.length) > 0)
        sauber.karte = { x: k.x, z: k.z, gebiet: ganz(k.gebiet, D.FELDER.length), seit: Number(k.seit) || 0 };
      sauber.funde = ganz(s.funde, 1e6);
    }
    p.schatz = sauber;
    return p;
  };
})(SG);

/* ------------------------------------------------------------------
   Zurueck zum Start.

   Wer sich auf der Insel verlaufen hat oder schnell wieder in die Mitte
   will, springt unter "Spielerwelt" an den Startplatz - einmal alle
   fuenf Minuten. Umgesetzt wird die Figur vom Server (Zug 'zum_start'
   in netlify/functions/gehstockmon.mjs): die Wegpruefung liesse einen so
   weiten Satz sonst nicht gelten und stellte die Figur zurueck.

   Diese Datei gilt fuer Browser und Server gleich (build.mjs erzeugt
   daraus gehstockmon-rules.mjs).
   ------------------------------------------------------------------ */
(function (SG) {
  var R = SG.gehstockmon, D = R.daten, X = R.abenteuer;

  X.START_SPRUNG_PAUSE = 5 * 60000;
  X.SPIELZUEGE.push('zum_start');

  /* Ab wann es wieder geht; 0 heisst: sofort. */
  X.startSprungAb = function (p) {
    var at = p && p.startSprungAt;
    return Number.isFinite(at) && at > 0 ? at + X.START_SPRUNG_PAUSE : 0;
  };

  /* Der Zeitpunkt des letzten Sprungs gehoert zum Spielstand - ohne das
     fiele er beim Aufbereiten fuer den Browser heraus, und der Knopf
     wuesste nichts von der Wartezeit. */
  var vorher = D.neuerStand;
  D.neuerStand = function (save, now) {
    var p = vorher(save, now), at = save && save.startSprungAt;
    p.startSprungAt = Number.isFinite(at) && at > 0 ? at : 0;
    return p;
  };
})(SG);

/* ------------------------------------------------------------------
   Der Gluecksautomat beim Haendler: drei Walzen, ein Spiel kostet 10 Gold,
   drei gleiche Bilder gewinnen. Die Gewinnchancen stehen bewusst nirgends
   im Spiel (Wunsch von Louis, 30.09.2026) - nur hier.

   Ob und was gewonnen ist, entscheidet der Server mit einem einzigen Wurf.
   Die Walzen zeigen danach nur das Ergebnis: beim Gewinn dreimal dessen
   Bild, sonst drei Bilder, die nie alle gleich sind - drei Gleiche, die
   nichts bringen, saehen nach Betrug aus. Zwei Gleiche und ein anderes
   kommen genau so oft, wie der Zufall sie bringt, nicht haeufiger.

   Die Gewinne und warum sie so hoch sind (Einsatz 10 Gold, Werte zum
   Haendlerpreis, Rueckkauf beim Haendler: Runen 70 %, Rohstoffe 50 %):

     Bild      Gewinn               Chance   Wert je Spiel
     Ei        ein Ei (2 am Tag)    2 %      7,0  (Ei beim Haendler 350)
     Gold      20 Gold              8 %      1,6
     Holz      3 Holz               5 %      1,2
     Rune      1 seltene Rune       4 %      0,6
     Kristall  2 Kristall           3 %      0,7
     Perle     Schimmerperle        0,05 %   1,0  (2000, reine Optik)

   Rund jedes fuenfte Spiel gewinnt etwas. Zurueck in Gold - Gewinn plus
   Wiederverkauf - kommen nur rund 3 von 10: der Automat bleibt ein Ort,
   an dem Gold verschwindet, und niemand kann damit Gold machen. Die
   kleinen Gewinne sind Beigaben, keine Bezugsquelle: Holz kostet hier im
   Schnitt 67 Gold das Stueck, beim Haendler 8. Das prueft
   tools/gehstockmon-automat-tests.mjs.

   Was jemand gerade nicht bekommen kann - ein Ei nach zwei am Tag oder bei
   voller Bruttasche, eine Schimmerperle, wenn er schon eine hat -, faellt
   aus der Ziehung. Seine Chance wird dann zu "nichts" und nicht auf die
   anderen verteilt: jeder Gewinn bleibt immer gleich wahrscheinlich.

   Diese Datei gilt fuer Browser und Server gleich (build.mjs erzeugt
   daraus gehstockmon-rules.mjs).
   ------------------------------------------------------------------ */
(function (SG) {
  var R = SG.gehstockmon, D = R.daten, E = R.wirtschaft, H = R.zeiten, X = R.abenteuer;

  /* Die Bilder auf den Walzen sind die Medaillons aus src/assets/gm-icon-*.webp.
     Die Reihenfolge der Gewinne legt die Wurfbereiche fest - nicht umsortieren. */
  X.AUTOMAT = { einsatz: 10, proTag: 2,
    symbole: ['eier', 'gold', 'holz', 'rune', 'kristall', 'perle'],
    gewinne: [
      { symbol: 'eier', chance: .02, name: 'ein Ei',
        meldung: 'Drei Eier! Ein Ei liegt in deiner Bruttasche.' },
      { symbol: 'gold', chance: .08, gold: 20, name: '20 Gold',
        meldung: 'Drei Goldmünzen! +20 Gold.' },
      { symbol: 'holz', chance: .05, rohstoff: 'holz', menge: 3, name: '3 Holz',
        meldung: 'Dreimal Holz! +3 Holz im Lager.' },
      { symbol: 'rune', chance: .04, rune: 1, menge: 1, name: '1 seltene Rune',
        meldung: 'Drei Runen! +1 seltene Rune.' },
      { symbol: 'kristall', chance: .03, rohstoff: 'kristall', menge: 2, name: '2 Kristall',
        meldung: 'Dreimal Kristall! +2 Kristall im Lager.' },
      { symbol: 'perle', chance: .0005, perle: true, name: 'Schimmerperle',
        meldung: 'Drei Perlen! Eine Schimmerperle - dein nächstes Mon schlüpft schimmernd.' }
    ] };
  X.AUTOMAT_OPS = ['automat_spielen'];
  X.STADT_OPS.push.apply(X.STADT_OPS, X.AUTOMAT_OPS);
  X.SPIELZUEGE.push.apply(X.SPIELZUEGE, X.AUTOMAT_OPS);
  E.BILANZ_RAUS.automat = 'Glücksautomat';
  E.BILANZ_REIN.automat = 'Glücksautomat';

  /* Was heute noch geht. gewinne zaehlt die Eier des Tages; der Tag ist der
     deutsche Kalendertag wie beim Haendler. */
  X.automatStand = function (p, now) {
    var a = p && p.automat, heute = a && a.tag === H.day(now);
    var gewinne = heute ? a.gewinne : 0;
    return { gewinne: gewinne, frei: Math.max(0, X.AUTOMAT.proTag - gewinne), spiele: heute ? a.spiele : 0 };
  };
  /* Ob ein Ei gerade drin ist: noch nicht zwei am Tag und Platz in der Tasche. */
  X.automatEiMoeglich = function (p, now) {
    return X.automatStand(p, now).frei > 0 && !!p && Array.isArray(p.eggs) && p.eggs.length < E.BAG_LIMIT;
  };
  X.automatErreichbar = function (g, p, now) {
    if (g.symbol === 'eier') return X.automatEiMoeglich(p, now);
    if (g.perle) return !(p && p.schimmerperle);
    return true;
  };

  /* Der Wurf (eine Zahl in [0, 1)) gegen die feste Tabelle. Landet er auf
     einem Gewinn, der gerade nicht erreichbar ist, gibt es nichts. */
  X.automatZiehung = function (wurf, erreichbar) {
    var unten = 0, liste = X.AUTOMAT.gewinne;
    for (var i = 0; i < liste.length; i++) {
      if (wurf < unten + liste[i].chance) return erreichbar(liste[i]) ? liste[i] : null;
      unten += liste[i].chance;
    }
    return null;
  };

  /* Die drei Walzen zum Ergebnis. zufall liefert Zahlen in [0, 1). */
  X.automatWalzen = function (gewinn, zufall) {
    var s = X.AUTOMAT.symbole;
    if (gewinn) return [gewinn.symbol, gewinn.symbol, gewinn.symbol];
    for (var i = 0; i < 50; i++) {
      var w = [0, 1, 2].map(function () { return s[Math.min(s.length - 1, Math.floor(zufall() * s.length))]; });
      if (!(w[0] === w[1] && w[1] === w[2])) return w;
    }
    return [s[0], s[1], s[2]];
  };

  /* Der Stand des Automaten gehoert zum Spielstand - ohne das fiele er beim
     Aufbereiten fuer den Browser heraus, und die Anzeige wuesste nichts von
     den Eiern des Tages. */
  function ganz(n, max) { n = Math.floor(Number(n)); return Number.isFinite(n) && n >= 0 ? Math.min(max, n) : 0; }
  var vorher = D.neuerStand;
  D.neuerStand = function (save, now) {
    var p = vorher(save, now), a = save && save.automat;
    p.automat = a && Number.isFinite(a.tag) ? { tag: Math.floor(a.tag), gewinne: ganz(a.gewinne, X.AUTOMAT.proTag), spiele: ganz(a.spiele, 99999) } : null;
    return p;
  };
})(SG);

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
  ROM.TANZ_RUNDE = 10000;
  ROM.tanzRunde = function (ev, now) { return Math.floor((now - ROM.plan(ev).phasen[2].von) / ROM.dauer(ev, ROM.TANZ_RUNDE)); };
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
    return { teilnehmer: teilnehmer, leiste: voll ? ziel : Math.min(leiste, ziel), leisteZiel: ziel, leisteVoll: voll,
      bossMax: max, bossSchaden: Math.min(schaden, max), bossHp: Math.max(0, max - schaden), bossBesiegt: !!max && schaden >= max, letzter: letzter };
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

export const data = SG.gehstockmon.daten;
export const economy = SG.gehstockmon.wirtschaft;
export const hours = SG.gehstockmon.zeiten;
export const adventure = SG.gehstockmon.abenteuer;
export const arena = SG.gehstockmon.arena;
export const fight = SG.rules.gehstockmon.kaempfe;
