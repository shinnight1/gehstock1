/* Gemeinsame Expeditionen: eine Lobby und ein synchroner Bosskampf für alle. */
(function(SG){
  var R=SG.gehstockmon,D=R.daten,X=R.abenteuer;
  R.mountDungeons=function(c){
    var el=c.el,button=c.button,room=null,lobbies=[],dismissed=null,pins=[],choice=null;
    function active(){return !!room&&(room.phase!=='finished'||dismissed!==room.id);}
    function art(id){var mon=D.mon(id);return SG.ui.el('img.gm-portrait',{src:SG.assets[mon.bild],alt:mon.name,draggable:false});}
    function run(op,data){c.request(op,data).then(function(res){c.apply(res);if(active())show();else c.closeCombat();if(res.message)c.notify(res.message);}).catch(function(error){c.error(error);if(active())show();});}
    function picker(parent,selected,change){var label=el('label','Dein Mon für diese Expedition','gm-dungeon-picker'),select=el('select');select.setAttribute('aria-label','Dungeon-Mon wählen');c.state().besitz.forEach(function(id){var m=X.mon(c.state(),id),o=el('option',m.name+' · '+D.SELTENHEITEN[m.seltenheit].name+' · Rune '+m.upgrade+'/5');o.value=id;select.appendChild(o);});select.value=selected;select.disabled=c.busy();select.addEventListener('change',function(){change(select.value);});label.appendChild(select);parent.appendChild(label);}
    function approach(d){c.closeDrawer();c.world().walkToPoint(d);c.notify('Du läufst zu '+d.name+'. Öffne den Dungeon dort erneut.');}
    function entrance(d){
      if(active()){show();return;}if(!c.open(d.name,'dungeons'))return;
      var drawer=c.drawer,at=c.world().position(),near=Math.hypot(at.x-d.x,at.z-d.z)<8;choice=c.state().truppe[0];
      drawer.appendChild(el('p',d.difficulty+' · 1–4 Spieler · Boss: '+D.mon(d.bossId).name,'gm-beginner-tip'));
      drawer.appendChild(el('p','Sieg: '+d.reward+' × '+D.SELTENHEITEN[d.rarity].name+'-Rune pro aktivem Teilnehmer. Der Boss wird mit der Gruppengröße stärker. Niederlagen kosten keine Mons, Runen oder Gold.'));
      if(!near){drawer.appendChild(button('Zum Eingang laufen',function(){approach(d);},'gm-button gm-primary'));return;}
      picker(drawer,choice,function(id){choice=id;});
      drawer.appendChild(button('Gruppe erstellen',function(){run('dungeon_create',{dungeonId:d.id,monId:choice});},'gm-button gm-primary'));
      drawer.appendChild(el('h3','Offene Gruppen'));
      var available=lobbies.filter(function(r){return r.dungeonId===d.id&&r.count<4;});
      if(!available.length)drawer.appendChild(el('p','Noch keine offene Gruppe. Erstelle eine und warte auf Mitspieler am Eingang.'));
      available.forEach(function(r){drawer.appendChild(button(r.leaderName+' · '+r.count+'/4 · Beitreten',function(){run('dungeon_join',{roomId:r.id,monId:choice});}));});
      drawer.appendChild(button('Gruppen aktualisieren',function(){c.request('world').then(function(res){c.apply(res);entrance(d);}).catch(c.error);}));
    }
    function menu(){if(active()){show();return;}if(!c.open('Dungeons & Runen','dungeons'))return;var drawer=c.drawer;
      drawer.appendChild(el('p','Kämpft zusammen gegen einen Boss. Jede Person steuert ein eigenes Mon. Wählt eure Züge gemeinsam; nach 45 Sekunden gehen fehlende Spieler automatisch in Deckung.'));
      X.DUNGEONS.forEach(function(d){var at=c.world().position(),card=el('article',undefined,'gm-quest-card');card.style.setProperty('--rarity',D.SELTENHEITEN[d.rarity].farbe);card.appendChild(el('h3',d.name+' · '+d.difficulty));card.appendChild(el('p',d.reward+' × '+D.SELTENHEITEN[d.rarity].name+'-Rune · '+Math.round(Math.hypot(at.x-d.x,at.z-d.z))+' m'));card.appendChild(button('Dungeon ansehen',function(){entrance(d);}));drawer.appendChild(card);});
      drawer.appendChild(el('h3','Deine Runen'));D.SELTENHEITEN.forEach(function(r,i){drawer.appendChild(el('p',r.name+': '+c.state().runes[i]));});drawer.appendChild(el('p','Upgrades findest du bei deinen Mons. Nur passende Runen zählen: maximal Stufe 5 und +10 % KP/Angriff. Für die fünf Stufen brauchst du 1, 2, 3, 4 und 5 Runen.'));
    }
    function show(){
      if(!active())return;c.openCombat();var box=c.arenaBox;SG.ui.clear(box);box.className='gm-arena gm-dungeon';
      var d=X.DUNGEONS.find(function(d){return d.id===room.dungeonId;}),me=room.players.find(function(m){return m.id===c.playerId();}),head=el('header',undefined,'gm-arena-header');
      head.appendChild(el('div','KOOP-DUNGEON · '+d.difficulty.toUpperCase(),'gm-eyebrow'));head.appendChild(el('strong',d.name+(room.phase==='battle'?' · Runde '+room.round:'')));box.appendChild(head);
      var panel=el('div',undefined,'gm-arena-panel gm-dungeon-panel');panel.appendChild(el('p',room.message,'gm-arena-line'));
      if(room.boss){var boss=el('div',undefined,'gm-dungeon-boss');boss.appendChild(art(room.boss.monId));boss.appendChild(el('strong',room.boss.name+' · '+room.boss.hp+'/'+room.boss.maxHp+' KP'));boss.appendChild(SG.ui.el('progress',{value:room.boss.hp,max:room.boss.maxHp,'aria-label':'Boss-Lebenspunkte'}));panel.appendChild(boss);}
      var team=el('div',undefined,'gm-dungeon-team');room.players.forEach(function(m){var card=el('article',undefined,'gm-quest-card');card.appendChild(art(m.monId));card.appendChild(el('strong',m.name+(m.id===room.leaderId?' · Leitung':'')));card.appendChild(el('p',D.mon(m.monId).name+' · '+(room.phase==='lobby'?(m.ready?'Bereit ✓':'Wählt noch …'):m.left?'Verlassen':m.hp+' / '+m.maxHp+' KP')));if(room.phase==='battle')card.appendChild(el('small',m.hp<=0?'Kampfunfähig':room.actions[m.id]?'Aktion gewählt ✓':'Wartet auf Aktion'));if(m.reward)card.appendChild(el('p','+'+m.reward+' '+D.SELTENHEITEN[d.rarity].name+'-Runen'));team.appendChild(card);});panel.appendChild(team);
      if(room.phase==='lobby'&&me){choice=me.monId;picker(panel,choice,function(id){run('dungeon_ready',{roomId:room.id,monId:id,ready:false});});
        var ready=button(me.ready?'Bereitschaft zurücknehmen':'Ich bin bereit',function(){run('dungeon_ready',{roomId:room.id,monId:choice,ready:!me.ready});},'gm-button gm-primary');ready.disabled=c.busy();panel.appendChild(ready);
        if(room.leaderId===me.id){var start=button(room.players.length===1?'Alleine starten':'Gemeinsam starten',function(){run('dungeon_start',{roomId:room.id});},'gm-button gm-primary');start.disabled=c.busy()||!room.players.every(function(m){return m.ready;});panel.appendChild(start);}
        panel.appendChild(el('p','Andere Spieler können dieser Gruppe am selben Eingang beitreten. Die Lobby bleibt fünf Minuten offen.'));
      }
      if(room.phase==='battle'&&me){panel.appendChild(el('p','Rundenende in höchstens '+Math.max(0,Math.ceil((room.deadline-c.now())/1000))+' Sekunden. Drei verpasste Runden beenden deine Teilnahme.'));
        var moves=el('div',undefined,'gm-moves');[['strike','Angreifen','Zuverlässiger Treffer'],['power','Kraftschlag','155 % Schaden · 2 Runden Pause'],['guard','Deckung','60 % weniger Schaden'],['heal','Erholen','25 % KP · '+me.heals+'/2 übrig']].forEach(function(v){var b=button('',function(){run('dungeon_turn',{roomId:room.id,round:room.round,move:v[0]});},'gm-move');b.appendChild(el('strong',v[1]));b.appendChild(el('span',v[2]));b.disabled=c.busy()||me.hp<=0||!!room.actions[me.id]||v[0]==='power'&&room.round<me.powerReady||v[0]==='heal'&&(me.heals<=0||me.hp>=me.maxHp);moves.appendChild(b);});panel.appendChild(moves);(room.log||[]).forEach(function(line){panel.appendChild(el('small',line,'gm-dungeon-log'));});
      }
      var leave=button(room.phase==='finished'?'Zurück zur Karte':'Expedition verlassen',function(){if(room.phase==='finished'){dismissed=room.id;c.closeCombat();}else run('dungeon_leave',{roomId:room.id});},'gm-button gm-secondary');leave.disabled=c.busy();panel.appendChild(leave);
      var retry=button('Expedition prüfen',function(){c.request(R.online.pending()?'resume':'world').then(function(res){c.apply(res);if(active())show();}).catch(c.error);});retry.disabled=c.busy();panel.appendChild(retry);box.appendChild(panel);
    }
    X.DUNGEONS.forEach(function(d){var node=button('◆',function(){entrance(d);},'gm-encounter-pin gm-dungeon-pin');node.title=d.name;node.setAttribute('aria-label',d.name);node.style.setProperty('--rarity',D.SELTENHEITEN[d.rarity].farbe);node.appendChild(el('span',d.name));c.layer.appendChild(node);pins.push({node:node,d:d});});
    return {menu:menu,show:show,active:active,apply:function(res){room=res.dungeon||null;lobbies=res.dungeonLobbies||[];},clear:function(){room=null;},frame:function(project,hidden,overview){pins.forEach(function(p){var pt=project({x:p.d.x,z:p.d.z,y:5});p.node.hidden=hidden||!pt.visible||!pt.near&&!overview;p.node.style.transform='translate('+pt.x+'px,'+pt.y+'px) translate(-50%,-100%)';});}};
  };
})(SG);
