/* Gemeinsame Abenteuer-, Ausrüstungs- und Revierregeln ohne Browser-Abhängigkeit. */
(function(SG){
  var D=SG.gehstockmon.daten,E=SG.gehstockmon.wirtschaft,H=SG.gehstockmon.zeiten,X=SG.gehstockmon.abenteuer={};
  X.DUNGEON_OPS=['dungeon_create','dungeon_join','dungeon_ready','dungeon_start','dungeon_turn','dungeon_leave'];
  X.OPS=['survey','gather','trainer_start','quest_claim','shop_buy','equip','raid_start','raid_turn','raid_arena','raid_cancel','mon_upgrade','leuchtturm_spenden','zerhacker_schlagen','waffe_schleifen','panzer_anlegen','fehde_fordern','fehde_annehmen'].concat(X.DUNGEON_OPS);
  X.SPAWN={x:0,z:30};X.SPAWN_TIME=60*60000;
  X.UPGRADE_LIMIT=5;
  /* Der Leuchtturm ist das gemeinsame Bauwerk: alle zahlen darauf ein, und
     wenn er steht, bleibt er stehen. Er steht mitten auf der Insel und
     peilt von dort den Zerhacker an. */
  X.LEUCHTTURM={x:0,z:0,ziel:5000,mindestens:10};
  X.leuchtturmFertig=function(bau){return !!bau&&bau.gold>=X.LEUCHTTURM.ziel;};
  X.brutplaetze=function(bau){return E.INCUBATORS+(X.leuchtturmFertig(bau)?1:0);};

  /* Der gehstockhassende Zerhacker zieht eine Woche lang seine Bahn ueber die
     Insel. Seine Lage rechnet sich wie bei den Wandertrainern aus der Zeit,
     seine Lebenskraft dagegen ist echter Weltzustand - daran schlagen alle
     gemeinsam. Sein Rundkurs meidet die Mitte, damit er nicht dauernd im
     Startplatz steht. */
  /* Die Zahlen sind auf eine Handvoll Leute mit kurzen Schulpausen gerechnet:
     rund zwanzig Schlaege pro Kopf und Woche sollen reichen. Statt einer
     starren Sperre nach jedem Schlag fuellt sich ein Vorrat - wer zwei Tage
     weg war, kommt mit vollem Beutel zurueck und haut sie am Stueck raus. */
  X.ZERHACKER={runde:11*60000,radius:150,kraft:25000,
               nachschub:10*60000,vorratMax:12,
               schadenJeStufe:800,beuteRunen:6,beuteGold:400,reichweite:22};
  /* Jede Woche eine gemeinsame Aufgabe, an der alle zusammen zaehlen. Anders
     als der Zerhacker verlangt sie keine Wartezeit und keinen Weg zu einem
     bestimmten Ort - jeder Beitrag zaehlt sofort, auch der aus fuenf Minuten
     Pause. Welche dran ist, ergibt sich aus der Wochennummer. */
  X.WOCHENZIELE=[
    {id:'runen',  name:'Runensuche',    was:'Verlorene Runen einsammeln', ziel:30, lohn:200},
    {id:'trainer',name:'Trainingslager',was:'Wandertrainer besiegen',     ziel:15, lohn:250},
    {id:'eier',   name:'Brutzeit',      was:'Eier ausbrueten',            ziel:20, lohn:200},
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
  X.zerhackerKraft=function(){return X.ZERHACKER.kraft;};
  /* Was ein Schlag austraegt, haengt an der eigenen Truppe - wer aufruestet,
     merkt es hier. */
  X.zerhackerSchaden=function(p){
    var summe=0;(p&&p.truppe||[]).forEach(function(id){var m=X.mon(p,id);if(m)summe+=m.ang+m.upgrade*2;});
    return Math.max(150,Math.round(summe*X.ZERHACKER.schadenJeStufe/100*X.rangBonus(p)));
  };

  X.upgradeLevel=function(n){return Number.isFinite(n)?Math.max(0,Math.min(X.UPGRADE_LIMIT,Math.floor(n))):0;};
  X.mon=function(p,id){var m=D.mon(id);if(!m)return m;
    var w=X.wesenVon&&X.wesenVon(p,id);
    return Object.assign({},m,{upgrade:X.upgradeLevel(p&&p.monUpgrades&&p.monUpgrades[id])},
      w?{hp:Math.max(20,m.hp+w.hp),ang:Math.max(1,m.ang+w.ang),tempo:Math.max(1,m.tempo+w.tempo),wesen:w.name}:{});};
  X.DUNGEONS=[['Wurzelhöhle','Einfach','moosling',0,40],['Versunkene Grotte','Leicht','sumpfschnapper',35,105],['Kristallstollen','Mittel','donnerwidder',110,85],['Schattengewölbe','Schwer','runengolem',-80,-25],['Königsgrab','Sehr schwer','grabesritter',-110,-150],['Zeitenriss','Extrem','chronoschreiter',100,-95],['Abgrundtor','Apokalyptisch','endrichter',20,-130]].map(function(v,i){return{id:'dungeon-'+i,name:v[0],difficulty:v[1],bossId:v[2],x:v[3],z:v[4],rarity:i,reward:2+i%2};});
  X.SKINS=[{id:'wanderer',name:'Wanderer',color:'#ffffff',price:0},{id:'waldlaeufer',name:'Waldläufer',color:'#8ee6ad',price:150},{id:'frostwanderer',name:'Frostwanderer',color:'#83cfff',price:300},{id:'aschenritter',name:'Ascheritter',color:'#ff9576',price:500},{id:'trainermeister',name:'Trainermeister',color:'#ffe07b',quest:'trainer3'},{id:'runensucher',name:'Runensucher',color:'#bd90ff',quest:'gather6'},{id:'weltenwanderer',name:'Weltenwanderer',color:'#71ffe3',quest:'visit9'}];
  X.SKINS.push({id:'knochenkoenig',name:'Knochenkönig',color:'#f0dfb5',price:2400},{id:'leerenreaper',name:'Leerenschnitter',color:'#ad79ff',price:5000},{id:'drachenritter',name:'Drachenritter',color:'#ff6254',price:8000});
  X.WEAPONS=[{id:'gehstock',name:'Reisestock',attack:20,price:0},{id:'eisenspeer',name:'Eisenspeer',attack:24,price:200},{id:'runenklinge',name:'Runenklinge',attack:28,price:450},{id:'sturmhammer',name:'Sturmhammer',attack:32,price:800}];
  X.WEAPONS.push({id:'titanenlanze',name:'Titanenlanze',attack:37,price:2500},{id:'weltenbrecher',name:'Weltenbrecher',attack:43,price:6500});
  X.QUESTS=[{id:'trainer1',name:'Der erste Trainingssieg',stat:'trainerWins',goal:1,gold:80},{id:'trainer3',name:'Mit Geduld zum Meister',stat:'trainerWins',goal:3,skin:'trainermeister'},{id:'visit3',name:'Drei Horizonte',stat:'visited',goal:3,gold:120},{id:'visit9',name:'Die ganze Insel',stat:'visited',goal:9,skin:'weltenwanderer'},{id:'gather6',name:'Runensuche',stat:'gathered',goal:6,skin:'runensucher'},{id:'hatch1',name:'Ein neuer Begleiter',stat:'hatched',goal:1,gold:100},{id:'upgrade1',name:'Ein sicherer Rückzugsort',stat:'upgrades',goal:1,gold:100}];
  X.skin=function(id){return X.SKINS.find(function(v){return v.id===id;})||X.SKINS[0];};
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

  /* Die Fehde: eine Woche lang gegeneinander, aus allem was man ohnehin tut.
     Verloren geht dabei nichts ausser der Woche - genau deshalb kann man sie
     unter Freunden austragen. */
  X.FEHDE_PUNKTE={trainer:10,rune:4,ei:6,tiefe:25,zerhacker:1/200,gebiet:15};
  X.fehdePunkte=function(zaehler){
    var z=zaehler||{},P=X.FEHDE_PUNKTE;
    return Math.round((z.trainer||0)*P.trainer+(z.rune||0)*P.rune+(z.ei||0)*P.ei
      +(z.tiefe||0)*P.tiefe+(z.zerhacker||0)*P.zerhacker+(z.gebiet||0)*P.gebiet);
  };

  /* Der Trainerrang waechst an allem, was man ohnehin tut, und gibt kleine
     Zuschlaege auf den eigenen Schaden. Er laesst sich nicht kaufen und nicht
     verlieren - das ist der ruhige Fortschritt neben Gold und Runen. */
  X.RAENGE=[{name:'Wanderer',ab:0},{name:'Spaeher',ab:60},{name:'Faehrtenleser',ab:150},
            {name:'Hueter',ab:300},{name:'Meister',ab:550},{name:'Legende',ab:900}];
  X.erfahrung=function(p){
    var g=(p&&p.progress)||{};
    return (g.trainerWins||0)*10+(g.gathered||0)*4+(g.hatched||0)*6
         +(g.visited||0)*8+(g.upgrades||0)*5+Math.floor((p&&p.zerhackerGesamt||0)/400);
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

  /* Jedes geschluepfte Mon bringt ein Wesen mit. Damit ist nicht mehr jeder
     Donnerwidder derselbe - und es gibt einen Grund, Eier zu tauschen. */
  X.WESEN=[
    {id:'ruhig',    name:'ruhig',     hp: 8, ang: 0, tempo: 0},
    {id:'stuermisch',name:'stuermisch',hp:-4, ang: 0, tempo: 2},
    {id:'stur',     name:'stur',      hp:12, ang:-1, tempo:-1},
    {id:'wild',     name:'wild',      hp:-6, ang: 3, tempo: 0},
    {id:'flink',    name:'flink',     hp: 0, ang:-1, tempo: 3},
    {id:'treu',     name:'treu',      hp: 5, ang: 1, tempo: 0}
  ];
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
    p.raidCooldown=Number(old.raidCooldown)||0;p.raidShield=Number(old.raidShield)||0;return p;
  };
  X.progress=function(p,q){return q.stat==='visited'?p.visited.length:p.progress[q.stat]||0;};
  X.protected=function(p,now){return now-p.joinedAt<24*E.HOUR||p.besitz.length<6||p.raidShield>now;};
  X.riverCenter=function(z){return 72+Math.sin(z*.02)*12;};
  X.polygonContains=function(p,points){var inside=false;for(var i=0,j=points.length-1;i<points.length;j=i++){var a=points[i],b=points[j];if((a.z>p.z)!==(b.z>p.z)&&p.x<(b.x-a.x)*(p.z-a.z)/(b.z-a.z)+a.x)inside=!inside;}return inside;};
  var coast=D.WORLD.coast.map(function(v){return{x:v[0],z:v[1]};});
  for(var smooth=0;smooth<2;smooth++){var nextCoast=[];coast.forEach(function(a,i){var b=coast[(i+1)%coast.length];[.18,.82].forEach(function(t){nextCoast.push({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});});});coast=nextCoast;}
  X.coast=function(){return coast;};
  X.onLand=function(p){return Number.isFinite(p.x)&&Number.isFinite(p.z)&&(Math.abs(p.x)<220&&Math.abs(p.z)<180||X.polygonContains(p,X.coast())&&X.coast().every(function(a,i,points){return pointDistance(p,a,points[(i+1)%points.length])>2;}));};
  X.waterAt=function(p){return Math.abs(p.x-X.riverCenter(p.z))<5.3&&!D.WORLD.bridgeZ.some(function(z){return Math.abs(p.z-z)<2.6;});};
  X.walkable=function(p){return X.onLand(p)&&!X.waterAt(p);};
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
