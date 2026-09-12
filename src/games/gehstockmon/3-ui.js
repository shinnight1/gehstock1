/* Erkundung, direkte Arenakämpfe und zeitbasierte Außenposten. */
(function (SG) {
  var UI=SG.ui, R=SG.gehstockmon, D=R.daten, E=R.wirtschaft, A=R.arena, H=R.zeiten, X=R.abenteuer;
  function el(tag,text,cls) { return UI.el(tag+(cls?'.'+cls.split(' ').join('.'):''),text===undefined?null:{text:text}); }
  function button(text,fn,cls) { var b=el('button',text,cls||'gm-button');b.type='button';b.addEventListener('click',fn);return b; }
  function art(mon) { return UI.el('img.gm-portrait',{src:SG.assets[mon.bild],alt:mon.name,draggable:false}); }
  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function duration(ms) { var m=Math.max(0,Math.ceil(ms/60000));return m>=60?Math.floor(m/60)+' Std. '+m%60+' Min.':m+' Min.'; }
  /* Die Testzone haelt nur bis zum Schliessen des Tabs: ein Neuladen soll den Admin
     nicht aussperren, ein fremder Browser bekommt sie nicht geschenkt. */
  function adminKey() { return 'hgh:gm-admin:'+(SG.auth.aktuell?SG.auth.aktuell.code:'guest'); }
  function adminSaved() { try{return sessionStorage.getItem(adminKey())==='1';}catch(e){return false;} }
  function saveAdmin(on) { try{if(on)sessionStorage.setItem(adminKey(),'1');else sessionStorage.removeItem(adminKey());}catch(e){} }
  function mount(host) {
    var st=D.neuerStand(null), online=null, connected=false, world, dead=false, busy=false, animating=false, drawerView=null;
    var selected=6, battle=null, visual=null, lastNear=null, lastPoll=0, timeOffset=0, tickCount=0, animationToken=0, requestEpoch=0, polling=false;
    var peerList=[],peerLabels={},presenceBusy=false,lastPresence=0,lastPresenceReply=0;
    var access=null,closeTimer=null,adminHits=0,adminResetTimer=null,adminNotice=null;
    R.adminOverride=adminSaved();
    var root=el('div',undefined,'gm-shell');host.root.classList.add('gm-game');host.stage.appendChild(root);
    var worldBox=el('div',undefined,'gm-world');root.appendChild(worldBox);
    var hud=el('div',undefined,'gm-hud'),brand=el('div',undefined,'gm-brand');
    brand.appendChild(el('span','GEHSTOCKMON','gm-eyebrow'));brand.appendChild(el('h1','Dunkelbruch'));
    var resources=el('div',undefined,'gm-resource-row'),gold=el('span','','gm-resource'),owned=el('span','','gm-resource');resources.appendChild(gold);resources.appendChild(owned);brand.appendChild(resources);hud.appendChild(brand);
    var actions=el('div',undefined,'gm-top-actions'),worldButton=button('Spielerwelt',showOnline,'gm-button gm-online-button');actions.appendChild(worldButton);actions.appendChild(button('Hilfe',showHelp,'gm-icon-button'));hud.appendChild(actions);root.appendChild(hud);
    var hoursLabel=el('span','','gm-hours-label');brand.appendChild(hoursLabel);
    var pinsBox=el('div',undefined,'gm-pins'),pins=[];root.appendChild(pinsBox);
    D.FELDER.forEach(function(f){var p=button('',function(){selectField(f.id,true);},'gm-map-pin');p.setAttribute('aria-label',f.name+' auswählen');p.appendChild(el('span',String(f.id),'gm-pin-number'));var text=el('div',undefined,'gm-pin-text');p.titleNode=el('strong',f.name,'gm-pin-name');p.ownerNode=el('span','Wird geladen …','gm-pin-owner');text.appendChild(p.titleNode);text.appendChild(p.ownerNode);p.appendChild(text);pinsBox.appendChild(p);pins.push(p);});
    var peerLayer=el('div',undefined,'gm-peer-labels');root.appendChild(peerLayer);
    var controls=el('div',undefined,'gm-camera-controls');
    [['+','Näher heran',function(){world.zoom(-7);}],['−','Herauszoomen',function(){world.zoom(7);}],['↶','Kamera drehen',function(){world.rotate(Math.PI/4);}],['◎','Zur eigenen Figur',function(){world.follow();}]].forEach(function(v){var b=button(v[0],function(){if(world)v[2]();},'gm-icon-button');b.setAttribute('aria-label',v[1]);controls.appendChild(b);});root.appendChild(controls);
    var legend=el('div',undefined,'gm-map-legend');[['own','Dein Gebiet'],['rival','Spieler'],['npc','Computer']].forEach(function(v){legend.appendChild(el('span',v[1],v[0]));});root.appendChild(legend);
    var target=el('section',undefined,'gm-target');root.appendChild(target);
    var dock=el('div',undefined,'gm-dock');dock.appendChild(button('▦ Mons',showCollection));dock.appendChild(button('◉ Eier',showEggs));dock.appendChild(button('✦ Abenteuer',function(){adventures.adventure();}));dock.appendChild(button('⚒ Ausrüstung',function(){adventures.shop();}));dock.appendChild(button('⚑ Außenposten',showOutposts));dock.appendChild(button('⌖ Weltkarte',function(){if(!connected||busy||battle||dueling())return;closeDrawer();root.classList.add('gm-overview');if(world)world.overview();}));root.appendChild(dock);
    var joystick=el('div',undefined,'gm-joystick'),knob=el('div','✥','gm-joystick-knob'),joyId=null;joystick.setAttribute('aria-label','Bewegungs-Joystick');joystick.appendChild(knob);root.appendChild(joystick);
    function joyMove(e){if(e.pointerId!==joyId||!world)return;var r=joystick.getBoundingClientRect(),x=(e.clientX-r.left-r.width/2)/40,y=(e.clientY-r.top-r.height/2)/40,len=Math.max(1,Math.hypot(x,y));x/=len;y/=len;knob.style.transform='translate('+x*33+'px,'+y*33+'px)';world.move(x,y);}
    function joyEnd(){joyId=null;knob.style.transform='';if(world)world.move(0,0);}
    joystick.addEventListener('pointerdown',function(e){if(!connected||joyId!==null||busy||battle||dueling()||!drawer.hidden)return;joyId=e.pointerId;joystick.setPointerCapture(joyId);joyMove(e);});joystick.addEventListener('pointermove',joyMove);
    ['pointerup','pointercancel','lostpointercapture'].forEach(function(name){joystick.addEventListener(name,joyEnd);});window.addEventListener('blur',joyEnd);document.addEventListener('visibilitychange',joyEnd);
    var drawer=el('section',undefined,'gm-drawer');drawer.hidden=true;root.appendChild(drawer);
    var arenaBox=el('section',undefined,'gm-arena');arenaBox.hidden=true;arenaBox.setAttribute('aria-label','Gebietsarena');root.appendChild(arenaBox);
    var connectionBox=el('section',undefined,'gm-connection');connectionBox.setAttribute('aria-label','Verbindung zur Spielerwelt');connectionBox.setAttribute('aria-live','polite');root.appendChild(connectionBox);
    var notice=el('div','','gm-notice');notice.setAttribute('role','status');root.appendChild(notice);var noticeTimer;
    function now(){return Date.now()+timeOffset;}
    function notify(text){if(dead)return;notice.textContent=text;notice.classList.add('visible');if(noticeTimer)host.cancel(noticeTimer);noticeTimer=host.after(function(){notice.classList.remove('visible');},5500);}
    host.onLeave(joyEnd);
    var encounterLayer=el('div',undefined,'gm-encounters');root.appendChild(encounterLayer);
    var adventures=R.mountAdventure({el:el,button:button,drawer:drawer,arenaBox:arenaBox,layer:encounterLayer,state:function(){return st;},world:function(){return world;},now:now,busy:function(){return busy;},open:openDrawer,closeDrawer:closeDrawer,request:requestOnline,apply:applyOnline,error:onlineError,notify:notify,arena:showArena,resume:resumeOnline,
      openCombat:function(){closeDrawer();battle=null;visual=null;root.classList.add('gm-arena-open');root.classList.remove('gm-overview');arenaBox.hidden=false;syncInput();if(world)world.pause(true);},
      closeCombat:function(){arenaBox.hidden=true;root.classList.remove('gm-arena-open');if(world){world.pause(false);world.follow();}update();}});
    function dueling(){return adventures&&adventures.active();}
    function syncInput(){if(world)world.blockInput(!connected||busy||!!battle||dueling()||!drawer.hidden);root.setAttribute('aria-busy',String(busy));}
    function territories(){return online?online.territories:[];}
    function own(t){return !!(online&&t&&t.ownerId===online.playerId);}
    function current(){return territories()[selected-1];}
    function income(){return territories().reduce(function(sum,t){return sum+(own(t)?E.LEVELS[t.level].income:0);},0);}
    function updateResources(){gold.textContent=online?'● '+st.gold+' Gold · +'+income()+'/Std.':'Gemeinsame Spielerwelt';owned.textContent=online?st.besitz.length+'/'+D.KATALOG.length+' Mons':'Fortschritt wird geladen …';}
    function deadline(parent,until,ready){var span=el('span',until<=now()?ready:duration(until-now()),'gm-countdown');span.setAttribute('data-until',String(until));span.setAttribute('data-ready',ready);parent.appendChild(span);return span;}
    function update(){
      var ts=territories();updateResources();
      pins.forEach(function(p,i){var t=ts[i];p.hidden=!t;if(!t)return;p.classList.toggle('selected',i+1===selected);p.classList.toggle('owned',own(t));p.classList.toggle('rival',!!t.ownerId&&!own(t));p.firstChild.textContent=own(t)?'⚑':String(i+1);p.titleNode.textContent=D.FELDER[i].name;p.ownerNode.textContent=(t.ownerId?'Besitzer: ':'Computer: ')+t.ownerName;p.title=D.FELDER[i].biom+' · '+E.LEVELS[t.level].name+' · '+p.ownerNode.textContent;});
      if(world&&online){world.select(selected,false);world.setHeld(ts.filter(own).map(function(t){return t.id;}));world.setSquad(st.truppe.map(D.mon));if(world.setAppearance)world.setAppearance(st.skin,st.weapon);if(world.setTerritories)world.setTerritories(ts,online.playerId);}
      drawTarget();syncInput();
    }
    function selectField(id,center){if(!connected||busy||battle||dueling()||!drawer.hidden)return;selected=id;lastNear=null;root.classList.remove('gm-overview');if(world)world.select(id,center);update();}
    function drawTarget(){
      UI.clear(target);if(!online||battle||dueling())return;var t=current(),f=D.FELDER[selected-1],level=E.LEVELS[t.level];
      target.appendChild(el('div',own(t)?'DEIN AUSSENPOSTEN':t.ownerId?'SPIELERGEBIET · '+t.ownerName:'COMPUTERGEBIET','gm-eyebrow'));target.appendChild(el('h2',f.name));
      target.appendChild(el('p',f.biom+' · '+f.difficulty+' · '+(t.ownerId?'Besitzer: ':'Verteidigt von ')+t.ownerName,'gm-territory-owner'));
      var badges=el('div',undefined,'gm-target-badges');badges.appendChild(el('span',level.name+' · Stufe '+t.level));badges.appendChild(el('span',own(t)?'+'+level.income+' Gold/Std.':'Verteidigung +'+Math.round(level.bonus*100)+' % KP'));badges.appendChild(el('span',own(t)?'Dein Tor öffnet sich bei Annäherung':'Tor geschlossen · Sieg gewährt Zutritt'));target.appendChild(badges);
      if(own(t)){var production=el('p');production.appendChild(el('span',(t.eggStock||0)+'/3 Eier bereit · '));deadline(production,E.nextEggAt(t),'Ei bereit');target.appendChild(production);}
      var row=el('div',undefined,'gm-target-actions');row.appendChild(button(own(t)?'Verwalten':'Aufklären',own(t)?function(){showPost(selected);}:showScout,'gm-button gm-secondary'));
      var near=world?world.distanceTo(selected)<10:true;
      var go=button(busy?'Bitte warten …':own(t)?'Eier abholen':near?'⚔ Arena betreten':'Zum Gebiet laufen',function(){
        if(!connected||busy)return;if(own(t)){perform('collect',{territoryId:selected});return;}
        if(world&&world.distanceTo(selected)>=10){world.walkTo(selected);notify('Deine Figur läuft zum Gebiet.');return;}startBattle();
      },'gm-button gm-primary');go.disabled=!connected||busy||(own(t)&&!t.eggStock);row.appendChild(go);target.appendChild(row);
    }
    function closeDrawer(){drawer.hidden=true;drawerView=null;root.classList.remove('gm-drawer-open');syncInput();}
    function openDrawer(title,view){if(dead||!connected||busy||battle||dueling())return false;joyEnd();drawer.hidden=false;drawerView=view||null;root.classList.add('gm-drawer-open');UI.clear(drawer);var head=el('header',undefined,'gm-drawer-head');head.appendChild(el('h2',title));var close=button('×',closeDrawer,'gm-icon-button');close.setAttribute('aria-label','Fenster schließen');head.appendChild(close);drawer.appendChild(head);drawer.scrollTop=0;syncInput();return true;}
    function showHelp(){if(!openDrawer('So wächst dein Revier'))return;
      drawer.appendChild(el('h3','Öffnungszeiten · deutsche Ortszeit'));H.LABELS.forEach(function(line){drawer.appendChild(el('p',line));});drawer.appendChild(el('p','Am Wochenende ruht die normale Eierproduktion. Jeder gehaltene Außenposten bringt zwei Wochenend-Eier. Beim nächsten Eintritt werden sie gutgeschrieben; bei voller Tasche bleiben sie reserviert. Gold und laufende Brutzeiten laufen weiter.'));
      [['Neue Abenteuer','Trainer erscheinen alle 30 Minuten und schenken dir für Siege Eier. Sammle Runen und erkunde Biome für Quests. In Ausrüstung kaufst du Skins und Waffen.'],['Überfälle','Tippe auf einen Mitspieler. Gewinne erst das Waffenduell gegen seine gespeicherte Ausrüstung und danach den Mon-Kampf, um ein Ei zu erbeuten. Beide Spieler brauchen 24 Stunden Spielalter und mindestens 6 Mons. Nach einem Diebstahl gelten 2 Stunden Schutz.'],['Erkunden','Laufe mit dem Joystick, WASD oder einem Tipp auf den Boden. Ziehen verschiebt die Kamera. Zwei Finger zoomen. ◎ bringt dich zur Figur.'],['Arenakämpfe','In der Arena kämpft ein Mon pro Seite. Wähle Stockhieb, Kraftschlag, Spezialattacke oder Deckung. Schnellere Mons greifen zuerst an. Ein freiwilliger Wechsel verbraucht deinen Zug; nach einem K. o. ist der Wechsel frei.'],['Eier und Brut','Jeder eigene Außenposten liefert alle 2 Stunden ein Ei und lagert höchstens 3. Hole sie ab und starte die einstündige Brut. Du hast 3 Brutplätze und Platz für 12 Eier. Gesammelte Eier bleiben bei dir, auch wenn du das Gebiet verlierst.'],['Gold und Ausbau','Ein Lager verdient 20 Gold pro Stunde, ein Wachtposten 35, eine Festung 55. Gold entsteht auch während deiner Abwesenheit. Die Ausbauten kosten 120 und 300 Gold. Sie erhöhen die KP der Verteidiger um 12 % und 25 % sowie deren Angriff um 6 % und 12,5 %.'],['Spielerwelt','Hier kämpfen echte Hideout-Spieler und Computergegner um dieselben Gebiete. Deine gespeicherte Truppe verteidigt automatisch, wenn du offline bist. Kämpfe und Brutzeiten bleiben auf dem Server gespeichert.']].forEach(function(v){drawer.appendChild(el('h3',v[0]));drawer.appendChild(el('p',v[1]));});
    }
    function showCollection(){if(!openDrawer('Deine Mons · '+st.besitz.length+'/'+D.KATALOG.length+'','mons'))return;drawer.appendChild(el('p','Deine Truppe · Das erste Mon beginnt jeden Arenakampf.'));
      var squad=el('div',undefined,'gm-squad-preview');st.truppe.forEach(function(id,i){var k=D.mon(id),b=button('',function(){showMon(id);},'gm-party-card');b.style.setProperty('--rarity',D.SELTENHEITEN[k.seltenheit].farbe);b.appendChild(art(k));b.appendChild(el('strong',(i+1)+'. '+k.name));squad.appendChild(b);});drawer.appendChild(squad);
      var grid=el('div',undefined,'gm-collection');D.KATALOG.forEach(function(k){var have=st.besitz.indexOf(k.id)>=0,b=button('',function(){showMon(k.id);},'gm-collect-card'+(have?'':' gm-unowned'));b.style.setProperty('--rarity',D.SELTENHEITEN[k.seltenheit].farbe);b.appendChild(art(k));b.appendChild(el('strong',k.name));b.appendChild(el('span',D.SELTENHEITEN[k.seltenheit].name));b.appendChild(el('small',st.truppe.indexOf(k.id)>=0?'IN DER TRUPPE':have?k.rolle:'SCHLÜPFT AUS EINEM EI'));grid.appendChild(b);});drawer.appendChild(grid);
    }
    function showMon(id){var k=D.mon(id);if(!k||!openDrawer(k.name))return;drawer.style.setProperty('--rarity',D.SELTENHEITEN[k.seltenheit].farbe);var hero=el('div',undefined,'gm-mon-hero');hero.appendChild(art(k));hero.appendChild(el('span',D.SELTENHEITEN[k.seltenheit].name,'gm-rarity-label'));drawer.appendChild(hero);drawer.appendChild(el('p',k.lore));var s=A.stats(k);drawer.appendChild(el('p',s.hp+' KP · '+s.ang+' Angriff · '+s.tempo+' Tempo','gm-mon-stats'));
      var u=A.create([k],[k],{}).teams[0][0];A.moves(u,1).forEach(function(m){drawer.appendChild(el('p',m.name+' · '+m.text));});
      if(st.besitz.indexOf(id)<0)drawer.appendChild(el('p','Erobere ein Gebiet, sammle dort ein Ei und brüte es aus. Es schlüpft immer ein Mon, das dir noch fehlt.'));
      else{drawer.appendChild(el('h3','Aufstellung ändern'));drawer.appendChild(el('p','Deine Aufstellung wird für Angriffe und die Verteidigung deiner Außenposten gespeichert.'));st.truppe.forEach(function(old,i){var b=button((i+1)+'. Platz: '+D.mon(old).name,function(){var squad=st.truppe.slice(),at=squad.indexOf(id);if(at>=0)squad[at]=old;squad[i]=id;perform('defend',{squad:squad},'mons');});b.disabled=old===id;drawer.appendChild(b);});}
    }
    function showScout(){var t=current();if(!openDrawer('Arena · '+D.FELDER[selected-1].name))return;drawer.appendChild(el('p',t.ownerName+' · '+E.LEVELS[t.level].name+' · Verteidiger-KP +'+Math.round(E.LEVELS[t.level].bonus*100)+' %'));var team=A.defenders(t.id,t.ownerId?t.defense:null),grid=el('div',undefined,'gm-squad-preview');team.forEach(function(k){var card=button('',function(){showMon(k.id);},'gm-party-card');card.appendChild(art(k));card.appendChild(el('strong',k.name));grid.appendChild(card);});drawer.appendChild(grid);drawer.appendChild(el('p','Besiege alle gegnerischen Mons. Jeder Zug gehört dir: angreifen, schützen, heilen oder wechseln.'));drawer.appendChild(button('Eigene Truppe ansehen',showCollection,'gm-button gm-primary'));}
    function showOutposts(){if(!openDrawer('Deine Außenposten','posts'))return;var ts=territories().filter(own);drawer.appendChild(el('p',ts.length+' Gebiete · '+income()+' Gold pro Stunde. Einnahmen werden automatisch gutgeschrieben.'));if(!ts.length)drawer.appendChild(el('p','Erobere dein erstes Gebiet in einem Arenakampf. Dort beginnen die Gold- und Eierproduktion.'));
      ts.forEach(function(t){var card=el('article',undefined,'gm-post-card');card.appendChild(el('h3',D.FELDER[t.id-1].name));card.appendChild(el('p',E.LEVELS[t.level].name+' · +'+E.LEVELS[t.level].income+' Gold/Std. · '+t.eggStock+'/3 Eier'));card.appendChild(button('Außenposten verwalten',function(){showPost(t.id);}));drawer.appendChild(card);});
    }
    function showPost(id){var t=territories()[id-1];if(!own(t)){showOutposts();notify('Dieser Außenposten gehört inzwischen einem anderen Spieler.');return;}if(!openDrawer(D.FELDER[id-1].name,'post:'+id))return;var l=E.LEVELS[t.level];drawer.appendChild(el('div',undefined,'gm-post-illustration level-'+t.level));drawer.appendChild(el('h3',l.name+' · Stufe '+t.level));drawer.appendChild(el('p','+'+l.income+' Gold/Std. · Verteidiger: +'+Math.round(l.bonus*100)+' % KP, +'+Math.round(l.bonus*50)+' % Angriff.'));var row=el('p',t.eggStock+'/3 Eier bereit. Nächstes Ei: ');deadline(row,E.nextEggAt(t),'bereit');drawer.appendChild(row);drawer.appendChild(el('p','Wochenende: 2 Eier, automatisch nach dem Wochenende.'));
      var collect=button('Eier abholen',function(){perform('collect',{territoryId:id});},'gm-button gm-primary');collect.disabled=!t.eggStock;drawer.appendChild(collect);
      if(l.cost){var next=E.LEVELS[t.level+1];drawer.appendChild(el('p','Ausbau zum '+next.name+': +'+next.income+' Gold/Std., Verteidiger-KP +'+Math.round(next.bonus*100)+' %.'));var upgrade=button('Ausbauen · '+l.cost+' Gold',function(){perform('upgrade',{territoryId:id});},'gm-button gm-primary');upgrade.disabled=st.gold<l.cost;drawer.appendChild(upgrade);}else drawer.appendChild(el('p','Höchste Ausbaustufe erreicht.'));
      drawer.appendChild(button('Auf der Karte zeigen',function(){closeDrawer();selectField(id,true);}));
    }
    function showEggs(){if(!openDrawer('Brutstation','eggs'))return;var occupied=st.eggs.filter(function(e){return e.startedAt!==null;}).length;drawer.appendChild(el('p',st.eggs.length+'/12 Eier · '+occupied+'/3 Brutplätze belegt · Brutzeit 1 Stunde'));if(!st.eggs.length)drawer.appendChild(el('p','Deine Außenposten produzieren alle 2 Stunden ein Ei. Hole fertige Eier dort ab.'));
      var rewards=Object.values(st.rewardEggs).reduce(function(sum,n){return sum+n;},0);if(rewards)drawer.appendChild(el('p',rewards+' Trainer-Eier warten sicher auf Platz in deiner Tasche.'));
      var reserved=Object.values(st.weekendEggs).reduce(function(sum,n){return sum+n;},0);if(reserved)drawer.appendChild(el('p',reserved+' Wochenend-Eier warten sicher auf Platz in deiner Bruttasche. Sobald ein Ei schlüpft, rückt eines nach.','gm-weekend-reserve'));
      st.eggs.forEach(function(egg){var card=el('article',undefined,'gm-egg-card'),visualEgg=el('div',undefined,'gm-egg'+(egg.readyAt!==null&&egg.readyAt<=now()?' ready':''));visualEgg.setAttribute('aria-hidden','true');card.appendChild(visualEgg);var detail=el('div');detail.appendChild(el('h3','Ei aus '+D.FELDER[egg.territoryId-1].name));
        if(egg.startedAt===null){detail.appendChild(el('p','Noch nicht im Brutplatz'));var begin=button('Ausbrüten · 1 Stunde',function(){perform('incubate',{eggId:egg.id});},'gm-button gm-primary');begin.disabled=occupied>=E.INCUBATORS;detail.appendChild(begin);}else{var row=el('p','Schlüpft in ');deadline(row,egg.readyAt,'jetzt!');detail.appendChild(row);var hatch=button('Schlüpfen lassen',function(){perform('hatch',{eggId:egg.id});},'gm-button gm-primary');hatch.disabled=egg.readyAt>now();hatch.setAttribute('data-enable-at',String(egg.readyAt));detail.appendChild(hatch);}card.appendChild(detail);drawer.appendChild(card);
      });if(st.besitz.length===D.KATALOG.length)drawer.appendChild(el('p','Sammlung vollständig: Jedes weitere ausgebrütete Ei bringt 75 Gold.'));
    }
    function refreshDrawer(view){if(view==='eggs')showEggs();else if(view==='posts')showOutposts();else if(view&&view.indexOf('post:')===0)showPost(Number(view.slice(5)));else if(view==='mons')showCollection();else adventures.refresh(view);}
    function perform(op,data,view){if(!connected||busy||battle||dueling())return;view=view||drawerView;
      requestOnline(op,data).then(function(res){if(dead)return;applyOnline(res);refreshDrawer(view);if(res.monId){showMon(res.monId);host.sfx('win');}notify(res.message||'Gespeichert.');}).catch(onlineError);
    }
    function startBattle(){if(!connected||busy||battle||dueling())return;var t=current();if(own(t))return;closeDrawer();joyEnd();
      requestOnline('arena_start',{territoryId:t.id,version:t.version,squad:st.truppe}).then(function(res){applyOnline(res);showArena(res.arena,true);}).catch(onlineError);
    }
    function showArena(state,entry){if(dead||!state)return;animationToken++;animating=false;closeDrawer();battle=state;selected=state.territoryId;visual=copy(state);root.classList.add('gm-arena-open');root.classList.remove('gm-overview');arenaBox.hidden=false;syncInput();if(world)world.pause(true);renderArena(entry);}
    function closeArena(){if(!connected||busy||animating)return;if(battle&&battle.phase!=='finished')return;animationToken++;battle=null;visual=null;arenaBox.hidden=true;root.classList.remove('gm-arena-open');if(world){world.pause(false);world.follow();}update();}
    function renderArena(entry){
      UI.clear(arenaBox);if(!battle)return;var state=visual||battle,f=D.FELDER[battle.territoryId-1];arenaBox.className='gm-arena biome-'+(battle.territoryId-1);
      var header=el('header',undefined,'gm-arena-header');header.appendChild(el('div',battle.title||'GEBIETSARENA · '+f.name,'gm-eyebrow'));header.appendChild(el('strong','Runde '+Math.min(battle.round,60)+' · '+E.LEVELS[battle.level].name));arenaBox.appendChild(header);
      var scene=el('div',undefined,'gm-arena-scene');scene.appendChild(el('div',undefined,'gm-arena-horizon'));
      [0,1].forEach(function(side){var u=state.teams[side][state.active[side]],mon=D.mon(u.monId),unit=el('div',undefined,'gm-arena-unit '+(side===0?'ally':'enemy')+(entry?' gm-send':''));unit.setAttribute('data-unit',u.uid);
        var health=el('div',undefined,'gm-arena-health');health.appendChild(el('strong',u.name));health.appendChild(el('span',Math.ceil(u.hp)+' / '+u.maxHp+' KP'));health.appendChild(UI.el('progress',{value:u.hp,max:u.maxHp,'aria-label':u.name+' Lebenspunkte'}));unit.appendChild(health);
        var pedestal=el('div',undefined,'gm-arena-pedestal');unit.appendChild(pedestal);unit.appendChild(el('div',undefined,'gm-throw-orb'));var img=art(mon);img.classList.add('gm-arena-mon');if(u.hp<=0)img.classList.add('fainted');unit.appendChild(img);
        var status=[];if(u.shield)status.push('Geschützt');if(u.weakened)status.push('Geschwächt');unit.appendChild(el('span',status.join(' · '),'gm-arena-status'));scene.appendChild(unit);
      });arenaBox.appendChild(scene);
      var panel=el('div',undefined,'gm-arena-panel'),line=el('p',entry?'Los, '+state.teams[0][state.active[0]].name+'!':battle.phase==='replace'?'Dein Mon ist kampfunfähig. Wähle den nächsten Begleiter.':'Welche Attacke setzt du ein?','gm-arena-line');line.setAttribute('aria-live','polite');panel.appendChild(line);
      if(battle.phase==='finished'&&!animating){line.textContent=battle.message||(battle.winner==='wir'?'Gebiet erobert!':'Der Kampf ist beendet.');panel.appendChild(el('h2',battle.winner==='wir'?(battle.kind==='trainer'?'Training geschafft!':battle.kind==='raid'?'Überfall beendet.':'Dein Revier wächst.'):battle.winner==='fled'?'Zurück im Lager.':'Die Verteidigung hält.'));panel.appendChild(button('Zurück zur Karte',closeArena,'gm-button gm-primary'));arenaBox.appendChild(panel);return;}
      var active=state.teams[0][state.active[0]],moves=el('div',undefined,'gm-moves');A.moves(active,battle.round).forEach(function(move){var b=button('',function(){takeTurn({kind:'move',move:move.id});},'gm-move gm-move-'+move.id);b.appendChild(el('strong',move.name));b.appendChild(el('span',move.damage?'Stärke '+move.damage:'Taktik'));b.appendChild(el('small',move.text));b.disabled=busy||animating||battle.phase!=='choose'||!move.enabled;moves.appendChild(b);});panel.appendChild(moves);
      var bench=el('div',undefined,'gm-arena-bench');battle.teams[0].forEach(function(u,i){var b=button('',function(){takeTurn({kind:'switch',slot:i});},'gm-bench-mon'+(i===battle.active[0]?' active':''));b.appendChild(art(D.mon(u.monId)));b.appendChild(el('span',u.name+' · '+u.hp+' KP'));b.disabled=busy||animating||u.hp<=0||i===battle.active[0];b.setAttribute('aria-label',u.name+' einwechseln');bench.appendChild(b);});panel.appendChild(bench);
      var footer=el('div',undefined,'gm-arena-footer');footer.appendChild(el('span',battle.phase==='replace'?'Ersatz nach K. o. kostet keinen Zug.':'Wechseln verbraucht deinen Zug.'));
      var flee=button('Zurückziehen',fleeBattle,'gm-button gm-secondary');flee.disabled=busy||animating;footer.appendChild(flee);var recover=button(R.online.pending()?'Offene Aktion prüfen':'Kampfstand abrufen',resumeOnline,'gm-button gm-primary');recover.disabled=busy||animating;footer.appendChild(recover);panel.appendChild(footer);arenaBox.appendChild(panel);
    }
    function animateTurn(next,before){
      battle=next;visual=copy(before);animating=true;var token=++animationToken,index=0;renderArena(false);syncInput();
      function step(){if(dead||token!==animationToken)return;if(document.hidden){host.after(step,200);return;}
        var event=next.events[index++];if(!event){animating=false;visual=copy(battle);renderArena(false);syncInput();return;}
        if(event.state){event.state.forEach(function(team,s){team.forEach(function(hp,i){visual.teams[s][i].hp=hp;});});visual.active=event.active.slice();}
        renderArena(false);var line=arenaBox.querySelector('.gm-arena-line');if(line)line.textContent=event.text;
        var actor=event.actor&&arenaBox.querySelector('[data-unit="'+event.actor+'"]'),victim=event.target&&arenaBox.querySelector('[data-unit="'+event.target+'"]');
        if(actor)actor.classList.add(event.kind==='send'?'gm-send':event.delta>0?'gm-heal':'gm-attack');
        if(victim&&event.delta){victim.classList.add(event.delta>0?'gm-heal':'gm-hit');victim.appendChild(el('b',(event.delta>0?'+':'')+event.delta,'gm-arena-damage'));}
        host.after(step,event.kind==='send'?900:700);
      }host.after(step,120);
    }
    function takeTurn(action){if(!connected||busy||animating||!battle)return;var before=copy(battle);
      requestOnline('arena_turn',{battleId:battle.id,revision:battle.revision,action:action}).then(function(res){if(dead)return;applyOnline(res);animateTurn(res.arena,before);}).catch(onlineError);
    }
    function fleeBattle(){if(!connected||busy||animating||!battle)return;requestOnline('arena_flee',{battleId:battle.id,revision:battle.revision}).then(function(res){applyOnline(res);showArena(res.arena,false);}).catch(onlineError);}
    function requestOnline(op,data){if(dead||busy)return Promise.reject(new Error('Bitte warte auf die aktuelle Aktion.'));requestEpoch++;busy=true;joyEnd();syncInput();if(battle)renderArena(false);else closeDrawer();return R.online.request(op,data).finally(function(){busy=false;if(!dead){syncInput();if(battle&&!animating)renderArena(false);drawTarget();}});}
    function applyOnline(res){if(dead)return;var wasConnected=connected;if(!res.territories||res.territories.length!==D.FELDER.length)throw new Error('Die Karte wurde aktualisiert. Bitte lade die Website neu.');setAccess(res.access);online=res;connected=true;lastPoll=Date.now();timeOffset=res.serverTime-Date.now();st=D.neuerStand(res.profile,res.serverTime);worldButton.textContent=lastPresenceReply?'Spielerwelt · '+(peerList.length+1)+' online':'Spielerwelt';connectionBox.hidden=true;root.classList.remove('gm-disconnected');adventures.apply(res);if(world)world.pause(!!battle||dueling());update();if(world&&!wasConnected&&res.spawn&&world.setPosition)world.setPosition(res.spawn);if(dueling())adventures.showDuel();if(res.weekendDelivery&&!res.duplicate)notify(res.weekendDelivery+' Wochenend-Eier sind in deiner Bruttasche angekommen.');}
    function applyPeers(peers,serverTime){if(dead)return;peerList=peers;var keep={};peers.forEach(function(p){keep[p.id]=true;var label=peerLabels[p.id];if(!label){label=button('',function(){var peer=peerList.find(function(v){return v.id===p.id;});if(peer)adventures.rival(peer);},'gm-peer-label');peerLayer.appendChild(label);peerLabels[p.id]=label;}label.textContent=p.name+(p.activity==='arena'?' · ⚔':'');label.hidden=true;label.title=p.activity==='arena'?'Kämpft gerade in einer Arena':'Auf der Insel unterwegs';});Object.keys(peerLabels).forEach(function(id){if(!keep[id]){peerLabels[id].remove();delete peerLabels[id];}});if(world&&world.setPeers)world.setPeers(peers,serverTime);worldButton.textContent='Spielerwelt · '+(peers.length+1)+' online';}
    function syncPresence(){if(dead||!connected||presenceBusy||document.hidden||!world||!world.position)return;presenceBusy=true;lastPresence=Date.now();R.online.request('presence',{position:world.position()}).then(function(res){if(dead||!connected)return;setAccess(res.access);if(res.positionCorrected&&world.setPosition)world.setPosition(res.position);lastPresenceReply=Date.now();applyPeers(res.peers||[],res.serverTime);}).catch(function(err){if(err.status===423){onlineError(err);return;}if(!dead&&Date.now()-lastPresenceReply>15000){applyPeers([],now());worldButton.textContent='Spielerwelt · Verbindung prüfen';}}).finally(function(){presenceBusy=false;});}
    function setAccess(next){
      if(!next)return;
      if(access&&!access.open&&next.open&&next.serverTime<access.serverTime){var err=new Error('GehstockMon ist gerade geschlossen.');err.status=423;err.access=access;throw err;}
      access=next;timeOffset=next.serverTime-Date.now();if(closeTimer)host.cancel(closeTimer);
      hoursLabel.textContent=next.adminOverride?'Developer-Testzone geöffnet':next.open?'Heute geöffnet bis '+new Intl.DateTimeFormat('de-DE',{timeZone:H.ZONE,hour:'2-digit',minute:'2-digit'}).format(new Date(next.closesAt))+' Uhr':'';
      if(next.open&&!next.adminOverride)closeTimer=host.after(function(){if(!dead)showClosed(H.access(Math.max(now(),next.closesAt)));},Math.max(0,next.closesAt-next.serverTime));
    }
    function showAdminMenu(card,message){
      if(root.querySelector('.gm-admin-menu'))return;
      var menu=el('div',undefined,'gm-admin-menu');menu.appendChild(el('strong','Developer-Testzone'));menu.appendChild(el('p','Admin-Code eingeben, um die Insel auch während der Ruhezeit zu öffnen. Das geht nur mit einem Admin-Zugang des Hideouts.'));
      var input=UI.el('input',{type:'text',inputMode:'numeric',maxLength:4,placeholder:'Vierstelliger Code','aria-label':'Vierstelliger Admin-Code'});menu.appendChild(input);
      var feedback=el('p',message||'','gm-admin-feedback');
      var unlock=button('Testzone öffnen',function(){if(input.value!=='3141'){feedback.textContent='Der Code ist nicht korrekt.';input.value='';input.focus();return;}R.adminOverride=true;saveAdmin(true);adminNotice=null;menu.remove();notify('Developer-Testzone aktiviert.');connectWorld();},'gm-button gm-primary');
      input.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();unlock.click();}});
      menu.appendChild(unlock);menu.appendChild(feedback);card.appendChild(menu);input.focus();
    }
    function showClosed(next){
      if(dead)return;if(next.open)next=Object.assign({},next,{open:false,closesAt:null,nextOpenAt:next.serverTime});setAccess(next);requestEpoch++;animationToken++;animating=false;connected=false;joyEnd();closeDrawer();adventures.clear();battle=null;visual=null;arenaBox.hidden=true;root.classList.remove('gm-arena-open','gm-overview');applyPeers([],next.serverTime);showConnection();
      UI.clear(connectionBox);var card=el('div',undefined,'gm-connection-card gm-closed-card');card.appendChild(el('span','GEHSTOCKMON · ÖFFNUNGSZEITEN','gm-eyebrow'));var title=el('h2');title.appendChild(el('span','Die ','gm-closed-title-prefix'));var island=el('button','Insel','gm-hidden-admin-trigger');island.type='button';island.setAttribute('aria-label','Insel');island.addEventListener('click',function(){adminHits++;if(adminResetTimer)host.cancel(adminResetTimer);adminResetTimer=host.after(function(){adminHits=0;},1800);if(adminHits>=5){adminHits=0;showAdminMenu(card);}});title.appendChild(island);title.appendChild(el('span',' ruht gerade.','gm-closed-title-suffix'));card.appendChild(title);card.appendChild(el('p','Wieder offen: '+H.format(next.nextOpenAt)+' Uhr.','gm-next-opening'));
      var list=el('ul',undefined,'gm-hours-list');H.LABELS.forEach(function(line){list.appendChild(el('li',line));});card.appendChild(list);card.appendChild(el('p','Deutsche Ortszeit · Sommerzeit wird automatisch berücksichtigt.'));
      card.appendChild(el('p','Am Wochenende erhältst du 2 Eier pro eigenem Außenposten. Sie kommen beim nächsten Eintritt nach dem Wochenende in deine Bruttasche. Bei voller Tasche bleiben sie reserviert.'));card.appendChild(el('p','Dein Fortschritt bleibt gespeichert. Zur Öffnungszeit verbindet sich das Spiel automatisch.'));connectionBox.appendChild(card);
      if(adminNotice){var hint=adminNotice;adminNotice=null;showAdminMenu(card,hint);}
    }
    function showConnection(message){if(dead)return;connected=false;joyEnd();connectionBox.hidden=false;root.classList.add('gm-disconnected');if(world)world.pause(true);syncInput();UI.clear(connectionBox);
      var card=el('div',undefined,'gm-connection-card');card.appendChild(el('span','GEHSTOCKMON · ONLINE','gm-eyebrow'));card.appendChild(el('h2',message?'Verbindung zur Spielerwelt unterbrochen':'Spielerwelt wird geladen …'));
      card.appendChild(el('p',message||'Deine Mons, Außenposten und die Gebiete der anderen Spieler werden geladen.'));
      if(message){card.appendChild(el('p','Dein Fortschritt bleibt auf dem Server gespeichert.'));var retry=button(R.online.pending()?'Offene Aktion prüfen':'Erneut verbinden',connectWorld,'gm-button gm-primary');retry.disabled=busy;card.appendChild(retry);}
      connectionBox.appendChild(card);
    }
    function onlineError(err){if(dead)return;if(err.status===423&&R.adminOverride){R.adminOverride=false;saveAdmin(false);adminNotice='Dieser Hideout-Zugang ist kein Admin-Zugang. Die Insel bleibt geschlossen.';}if(err.status===423&&err.access){showClosed(err.access);return;}if(!connected||!online||!err.status||err.status===401||err.status>=500||err.status===408||err.status===429){showConnection(err.message||'Der Server ist nicht erreichbar.');return;}notify(err.message);if(battle)renderArena(false);}
    function connectWorld(){if(dead||busy)return;showConnection();requestOnline('join').then(function(res){if(dead)return;if(R.online.pending())return requestOnline('resume');return res;}).then(function(res){if(dead||!res)return;applyOnline(res);if(res.arena&&(res.arena.phase!=='finished'||battle||res.action&&res.action.op==='arena_turn'||res.action&&res.action.op==='arena_flee'))showArena(res.arena,false);else if(battle){battle=null;visual=null;arenaBox.hidden=true;root.classList.remove('gm-arena-open');if(world)world.pause(false);update();}}).catch(onlineError);}
    function resumeOnline(){if(busy)return;requestOnline(R.online.pending()?'resume':'world').then(function(res){applyOnline(res);if(dueling())adventures.showDuel();else if(res.arena)showArena(res.arena,false);else{showOnline();notify(res.message||'Aktueller Stand geladen.');}}).catch(onlineError);}
    function showOnline(){if(!openDrawer('Die Spielerwelt','online'))return;drawer.appendChild(el('p','Du teilst diese Welt mit allen Hideout-Spielern. Erobere Gebiete von Spielern und Computergegnern. Deine gespeicherten Mons verteidigen auch, wenn du offline bist.'));
      drawer.appendChild(el('h3','Auf der Insel'));drawer.appendChild(el('p',peerList.length?peerList.map(function(p){return p.name+(p.activity==='arena'?' (in der Arena)':'');}).join(' · '):'Gerade sind keine anderen Spieler sichtbar.'));
      peerList.forEach(function(p){drawer.appendChild(button(p.name+' · '+(p.protected?'geschützt':X.weapon(p.weapon).name),function(){adventures.rival(p);}));});
      if(R.online.pending())drawer.appendChild(button('Offene Aktion prüfen',resumeOnline,'gm-button gm-primary'));
      drawer.appendChild(button('Welt aktualisieren',function(){requestOnline('world').then(function(res){applyOnline(res);if(res.arena&&res.arena.phase!=='finished')showArena(res.arena,false);else showOnline();}).catch(onlineError);}));
      drawer.appendChild(el('h3','Letzte Gebietskämpfe'));(online.reports||[]).slice().reverse().forEach(function(r){drawer.appendChild(el('p',r.text,'gm-report-line'));});if(!(online.reports||[]).length)drawer.appendChild(el('p','Noch keine Gebietskämpfe.'));
    }
    function connectionLost(){showConnection('Deine Internetverbindung ist unterbrochen.');}
    function connectionRestored(){if(!connected)connectWorld();}
    window.addEventListener('offline',connectionLost);window.addEventListener('online',connectionRestored);
    try{world=R.createWorld(host,worldBox,{
      explore:function(){root.classList.remove('gm-overview');},select:function(id){selectField(id,false);},
      frame:function(project,inBattle,position,visiblePeers){adventures.frame(project,!connected||!!battle||dueling(),root.classList.contains('gm-overview'));pins.forEach(function(pin,i){var o=R.orte[i],p=project({x:o.x,y:6,z:o.z});pin.style.transform='translate('+p.x+'px,'+p.y+'px) translate(-50%,-100%)';pin.hidden=!online||!!battle||dueling()||!p.visible||(!root.classList.contains('gm-overview')&&!p.near&&i+1!==selected);});Object.keys(peerLabels).forEach(function(id){peerLabels[id].hidden=true;});(visiblePeers||[]).forEach(function(peer){var label=peerLabels[peer.id];if(!label)return;var p=project({x:peer.position.x,y:4.2,z:peer.position.z});label.hidden=!!battle||dueling()||!connected||!p.visible||(!p.near&&!root.classList.contains('gm-overview'));label.style.transform='translate('+p.x+'px,'+p.y+'px) translate(-50%,-100%)';});if(!battle&&world){var near=world.distanceTo(selected)<10;if(near!==lastNear){lastNear=near;drawTarget();}}},
      contextLost:function(){notify('Die Grafik wurde angehalten und wird wiederhergestellt.');},contextRestored:function(){notify('Die Karte ist wieder bereit.');}
    });}catch(err){worldBox.appendChild(el('div','Die Karte konnte nicht gestartet werden. Bitte lade das Spiel neu. '+err.message,'gm-webgl-error'));}
    function tick(){if(dead)return;tickCount++;updateResources();
      if(access&&access.open&&now()>=access.closesAt)showClosed(H.access(now()));
      if(access&&!access.open&&!busy&&!document.hidden&&now()>=access.nextOpenAt){access=null;connectWorld();}
      if(connected&&Date.now()-lastPresence>=2000)syncPresence();
      if(peerList.length&&Date.now()-lastPresenceReply>15000)applyPeers([],now());
      root.querySelectorAll('[data-until]').forEach(function(node){var until=Number(node.getAttribute('data-until'));node.textContent=until<=now()?node.getAttribute('data-ready'):duration(until-now());});
      root.querySelectorAll('[data-enable-at]').forEach(function(node){node.disabled=busy||Number(node.getAttribute('data-enable-at'))>now();});
      if(connected&&tickCount%15===0&&!battle&&!dueling()){drawTarget();if(drawerView==='posts'||drawerView&&drawerView.indexOf('post:')===0)refreshDrawer(drawerView);}
      if(connected&&!busy&&!battle&&!dueling()&&!polling&&document.hidden===false&&Date.now()-lastPoll>30000){lastPoll=Date.now();polling=true;var epoch=requestEpoch;R.online.request('world').then(function(res){if(dead||!connected||epoch!==requestEpoch||busy||battle||dueling())return;applyOnline(res);if(res.arena&&res.arena.phase!=='finished')showArena(res.arena,false);else if(drawerView==='posts'||drawerView&&drawerView.indexOf('post:')===0)refreshDrawer(drawerView);}).catch(function(err){if(epoch===requestEpoch)onlineError(err);}).finally(function(){polling=false;});}
      host.after(tick,1000);
    }
    update();connectWorld();host.after(tick,1000);
    return {get state(){return st;},selftest:function(){if(D.KATALOG.length!==42)throw new Error('42 Mons erwartet');},destroy:function(){dead=true;requestEpoch++;animationToken++;if(closeTimer)host.cancel(closeTimer);window.removeEventListener('blur',joyEnd);window.removeEventListener('offline',connectionLost);window.removeEventListener('online',connectionRestored);document.removeEventListener('visibilitychange',joyEnd);if(world)world.destroy();}};
  }
  SG.register({id:'gehstockmon',name:'GehstockMon',category:'tycoon',onlineOnly:true,heavy:true,desc:'Gemeinsame Online-Welt: 42 Mons, 9 Biome, Quests und Überfälle',tags:['3d','monster','arena','eier','revier','spielerwelt'],
    preview:function(c,w,h){c.fillStyle='#18343a';c.fillRect(0,0,w,h);if(!R.previewArt&&SG.assets['gm-spaeher']){R.previewArt=new Image();R.previewArt.src=SG.assets['gm-spaeher'];}if(R.previewArt&&R.previewArt.complete&&R.previewArt.naturalWidth)c.drawImage(R.previewArt,w*.22,-h*.18,h*1.2,h*1.2);c.fillStyle='rgba(8,22,25,.7)';c.fillRect(0,h*.71,w,h*.29);SG.gfx.text(c,'GEHSTOCKMON',w*.5,h*.86,{font:SG.gfx.font(Math.round(h*.11),700),fill:'#ffdc97',align:'center',baseline:'middle'});},mount:mount});
})(SG);
