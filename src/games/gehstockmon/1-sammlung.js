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
    klingenwolf:1,aschenhydra:1,vulkanmantis:1,obsidianbehemoth:1,
    weltenfresser:2,sonnenkoenig:2,glutbasilisk:2,blitzotter:2,
    pilzhueter:1,seelenqualle:1,korallenwacht:1,prismensalamander:1,
    mondhexe:2,sternengeweih:2,frostorakel:2,novaorakel:2,nebelkrake:2,
    nachtflatter:1,kristallspinne:1,obsidianrabe:1,stahlkolibri:1,
    leerenwyrm:2,chronoschreiter:2,zeitphoenix:2,frostmanta:2,mondluchs:2
  };
  D.faehigkeitVon=function(mon){
    if(!mon)return 0;
    var fest=D.FAEHIGKEIT_FEST[mon.id];
    return Number.isFinite(fest)?fest:Math.max(0,Math.floor(mon.spriteIndex||0))%3;
  };
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
