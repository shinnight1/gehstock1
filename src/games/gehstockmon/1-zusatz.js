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

  /* Stockhafen: der eine Ort auf der Insel, den niemand erobern kann. Er ist
     die Antwort auf die Frage, was jemand tut, der gerade kein Gebiet haelt -
     hier gibt es Arbeit, ein Findelei und die Grosse Arena. Das Rund der
     Arena selbst ist massiv: man laeuft aussen herum, nicht hindurch. */
  X.STADT={x:-46,z:24,name:'Stockhafen',radius:26};
  X.ARENA_BAU={x:-46,z:24,radius:11};
  X.inStadt=function(p){return Math.hypot(p.x-X.STADT.x,p.z-X.STADT.z)<X.STADT.radius;};
  X.imArenaBau=function(p){return Math.hypot(p.x-X.ARENA_BAU.x,p.z-X.ARENA_BAU.z)<X.ARENA_BAU.radius;};
  /* Vor dem Tor auf der Suedseite steht man nah genug fuer alles, was die
     Stadt anbietet. */
  X.STADT_TOR={x:X.STADT.x,z:X.STADT.z+X.ARENA_BAU.radius+4};

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
