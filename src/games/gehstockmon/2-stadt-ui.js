/* Stockhafen: die Grosse Arena, der Gehstock-Champion und die Arbeit fuer
   alle ohne Gebiet.

   Das Fenster hat bewusst zwei Haelften. Oben die Arena - der einzige
   Spielerkampf, den man jederzeit haben kann, weil der Gegner dafuer nicht
   da sein muss. Unten der Hafen - Tagwerk und Findelhaus fuer jeden, der
   gerade keinen Aussenposten haelt. Wer eins hat, sieht die untere Haelfte
   ausgegraut und weiss damit, was ihn erwartet, wenn er alles verliert. */
(function(SG){
  var R=SG.gehstockmon,X=R.abenteuer,D=R.daten;
  R.mountStadt=function(c){
    var el=c.el,button=c.button,drawer=c.drawer,stand=null;
    function state(){return c.state();}
    function dauer(ms){var m=Math.max(0,Math.ceil(ms/60000));return m>=60?Math.floor(m/60)+' Std. '+m%60+' Min.':m+' Min.';}
    function wartetext(ms){return ms>90*60000?'wenn die Insel wieder oeffnet':'in '+dauer(ms);}
    function nah(){var w=c.world(),p=w&&w.position&&w.position();return !!p&&X.inStadt(p);}
    function hingehen(){c.closeDrawer();var w=c.world();if(w&&w.walkToPoint)w.walkToPoint(X.STADT_TOR);c.notify('Deine Figur laeuft nach '+X.STADT.name+'.');}
    function run(op,data){
      c.request(op,data).then(function(res){
        c.apply(res);
        if(res.arena&&res.arena.phase!=='finished')c.arena(res.arena,true);
        else zeigeStadt();
        if(res.message)c.notify(res.message);
      }).catch(function(error){c.error(error);});
    }
    function truppenreihe(squad){
      var reihe=el('div',undefined,'gm-squad-preview');
      (squad||[]).forEach(function(e){
        var k=D.mon(e.id||e);if(!k)return;
        var karte=el('div',undefined,'gm-party-card');
        karte.style.setProperty('--rarity',D.SELTENHEITEN[k.seltenheit].farbe);
        karte.appendChild(SG.ui.el('img.gm-portrait',{src:SG.assets[k.bild],alt:k.name,draggable:false}));
        karte.appendChild(el('strong',k.name));
        if(e.upgrade)karte.appendChild(el('span','Rune '+e.upgrade+'/'+X.UPGRADE_LIMIT));
        reihe.appendChild(karte);
      });
      return reihe;
    }
    /* Der Champion steht ganz oben, weil er der Grund ist, warum man
       ueberhaupt Ranglistenkaempfe sammelt. */
    function championTeil(t){
      var ch=t.champion;
      drawer.appendChild(el('h3','Der Gehstock-Champion'));
      drawer.appendChild(el('p',ch.selbst?'Du haeltst den Titel seit '+dauer(c.now()-ch.seit)+'. '+ch.verteidigt+' Herausforderung(en) abgewehrt. Solange er dir gehoert, bekommst du '+X.CHAMPION_SOLD+' Gold Sold je Tag.'
        :ch.name+(ch.haus?' haelt den Titel fuer das Haus, bis ihn jemand holt.':' traegt den Titel seit '+dauer(c.now()-ch.seit)+' und hat '+ch.verteidigt+' Herausforderung(en) abgewehrt.'),ch.selbst?'gm-selbst':undefined));
      drawer.appendChild(el('p','Er verteidigt mit der Aufstellung, die beim Titelgewinn eingefroren wurde - und mit einem Zehntel Heimvorteil.'));
      drawer.appendChild(truppenreihe(ch.squad));
      if(ch.selbst){drawer.appendChild(el('p','Du kannst dich nicht selbst herausfordern. Halte den Titel, indem andere an dir scheitern.'));return;}
      var reif=t.siege>=t.noetig,pause=t.titelPause>0;
      drawer.appendChild(el('p','Titelkampf: '+Math.min(t.siege,t.noetig)+'/'+t.noetig+' Ranglistensiege'
        +(pause?' · naechster Versuch '+wartetext(t.titelPause):reif?' · du darfst antreten':' · sammle noch '+(t.noetig-t.siege))));
      var b=button(nah()?'Um den Titel kaempfen':'Nach '+X.STADT.name+' laufen',function(){
        if(!nah()){hingehen();return;}run('champion_fordern',{});
      },'gm-button gm-primary');
      b.disabled=c.busy()||(nah()&&(!reif||pause));
      drawer.appendChild(b);
    }
    function rangTeil(t){
      drawer.appendChild(el('h3','Ranglistenkaempfe'));
      drawer.appendChild(el('p','Dein Ruhm: '+t.ruhm+' · Sieg +'+X.RUHM_SIEG+' Ruhm und '+X.ARENA_LOHN+' Gold, Niederlage -'+X.RUHM_NIEDERLAGE+' Ruhm und '+X.ARENA_TROST+' Gold Trost. Niemand verliert dabei Mons, Eier oder Gebiete.'));
      if(t.pause>0)drawer.appendChild(el('p','Der naechste Kampf ist '+wartetext(t.pause)+' moeglich.'));
      if(!nah()){drawer.appendChild(button('Nach '+X.STADT.name+' laufen',hingehen,'gm-button gm-primary'));return;}
      (t.gegner||[]).forEach(function(g){
        var karte=el('article',undefined,'gm-quest-card');
        karte.appendChild(el('h3',g.name+(g.haus?' · Haus':'')));
        karte.appendChild(el('p',(g.haus?'Gegner des Hauses':'Spieler')+' · Ruhm '+g.ruhm));
        karte.appendChild(truppenreihe(g.squad));
        var b=button('Herausfordern',function(){run('arena_rang',{targetId:g.id});},'gm-button');
        b.disabled=c.busy()||t.pause>0;
        karte.appendChild(b);drawer.appendChild(karte);
      });
    }
    function hafenTeil(s){
      drawer.appendChild(el('h3','Der Hafen'));
      if(!s.ohneGebiet){
        drawer.appendChild(el('p','Tagwerk und Findelhaus sind fuer alle da, die gerade keinen Aussenposten halten. Du haeltst einen - deine Eier kommen von dort.'));
        return;
      }
      drawer.appendChild(el('p','Du haeltst gerade kein Gebiet. Im Hafen gibt es trotzdem Arbeit und Nachwuchs: du bleibst im Spiel, auch ohne einen Fussbreit Land.'));
      var arbeit=el('article',undefined,'gm-quest-card');
      arbeit.appendChild(el('h3','Tagwerk · '+s.tagwerkLohn+' Gold'));
      arbeit.appendChild(el('p',s.tagwerk+'/'+s.tagwerkMax+' Auftraege liegen bereit'+(s.tagwerk<s.tagwerkMax?' · der naechste '+wartetext(s.tagwerkIn):' · Vorrat voll')));
      var ab=button(nah()?'Tagwerk annehmen ('+s.tagwerk+')':'Nach '+X.STADT.name+' laufen',function(){
        if(!nah()){hingehen();return;}run('tagwerk',{});
      },'gm-button gm-primary');
      ab.disabled=c.busy()||(nah()&&!s.tagwerk);
      arbeit.appendChild(ab);drawer.appendChild(arbeit);
      var findel=el('article',undefined,'gm-quest-card');
      findel.appendChild(el('h3','Das Findelhaus'));
      findel.appendChild(el('p',s.findelei?'Ein Ei liegt bereit.':'Das naechste Ei '+wartetext(s.findeleiIn)+'.'));
      var fb=button(nah()?'Ei abholen':'Nach '+X.STADT.name+' laufen',function(){
        if(!nah()){hingehen();return;}run('findelei',{});
      },'gm-button gm-primary');
      fb.disabled=c.busy()||(nah()&&!s.findelei);
      findel.appendChild(fb);drawer.appendChild(findel);
    }
    function brutTeil(s){
      drawer.appendChild(el('h3','Brutplaetze'));
      drawer.appendChild(el('p','Du hast '+s.brutplaetze+' Plaetze'+(s.gekauft?' ('+s.gekauft+' gekauft)':'')+'. Jeder weitere laesst dich ein Ei mehr gleichzeitig ausbrueten.'));
      if(!s.preis){drawer.appendChild(el('p','Mehr gibt es nicht zu kaufen.'));return;}
      var b=button('Brutplatz kaufen · '+s.preis+' Gold',function(){run('brutplatz_kaufen',{});},'gm-button gm-primary');
      b.disabled=c.busy()||state().gold<s.preis;
      drawer.appendChild(b);
    }
    function chronikTeil(t){
      if(!t.chronik||!t.chronik.length)return;
      drawer.appendChild(el('h3','Die Tafel der Champions'));
      var liste=el('ol',undefined,'gm-tafel');
      t.chronik.forEach(function(v){liste.appendChild(el('li',v.name+(v.haus?' (Haus)':'')+' · '+v.verteidigt+' Verteidigung(en)'));});
      drawer.appendChild(liste);
    }
    function zeigeStadt(){
      if(!stand||!c.open(X.STADT.name,'stadt'))return;
      drawer.appendChild(el('p','Eine freie Stadt: sie gehoert niemandem und kann nicht erobert werden. In ihrer Mitte steht die Grosse Arena - massives Gemaeuer, man geht aussen herum.','gm-beginner-tip'));
      if(!nah())drawer.appendChild(el('p','Du stehst noch ausserhalb. Fuer alles hier musst du in der Stadt sein.'));
      championTeil(stand.turnier);
      rangTeil(stand.turnier);
      hafenTeil(stand.stadt);
      brutTeil(stand.stadt);
      chronikTeil(stand.turnier);
    }
    return {
      menu:zeigeStadt,
      apply:function(res){if(res&&res.turnier)stand={turnier:res.turnier,stadt:res.stadt};},
      champion:function(){return stand&&stand.turnier&&stand.turnier.champion;},
      refresh:function(view){if(view==='stadt')zeigeStadt();}
    };
  };
})(SG);
