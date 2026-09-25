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
    function wartetext(ms){return ms>90*60000?'wenn die Insel wieder öffnet':'in '+dauer(ms);}
    function nah(){var w=c.world(),p=w&&w.position&&w.position();return !!p&&X.inStadt(p);}
    function hingehen(){c.closeDrawer();var w=c.world();if(w&&w.walkToPoint)w.walkToPoint(X.STADT_TOR);c.notify('Deine Figur läuft nach '+X.STADT.name+'.');}
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
      drawer.appendChild(el('p',ch.selbst?'Du hältst den Titel seit '+dauer(c.now()-ch.seit)+'. '+ch.verteidigt+' Herausforderung(en) abgewehrt. Solange er dir gehört, bekommst du '+X.CHAMPION_SOLD+' Gold Sold je Tag.'
        :ch.name+(ch.haus?' hält den Titel für das Haus, bis ihn jemand holt.':' trägt den Titel seit '+dauer(c.now()-ch.seit)+' und hat '+ch.verteidigt+' Herausforderung(en) abgewehrt.'),ch.selbst?'gm-selbst':undefined));
      drawer.appendChild(el('p','Er verteidigt mit der Aufstellung, die beim Titelgewinn eingefroren wurde - und mit einem Zehntel Heimvorteil.'));
      drawer.appendChild(truppenreihe(ch.squad));
      if(ch.selbst){drawer.appendChild(el('p','Du kannst dich nicht selbst herausfordern. Halte den Titel, indem andere an dir scheitern.'));return;}
      var reif=t.siege>=t.noetig,pause=t.titelPause>0;
      drawer.appendChild(el('p','Titelkampf: '+Math.min(t.siege,t.noetig)+'/'+t.noetig+' Ranglistensiege'
        +(pause?' · nächster Versuch '+wartetext(t.titelPause):reif?' · du darfst antreten':' · sammle noch '+(t.noetig-t.siege))));
      var b=button(nah()?'Um den Titel kämpfen':'Nach '+X.STADT.name+' laufen',function(){
        if(!nah()){hingehen();return;}run('champion_fordern',{});
      },'gm-button gm-primary');
      b.disabled=c.busy()||(nah()&&(!reif||pause));
      drawer.appendChild(b);
    }
    function rangTeil(t){
      drawer.appendChild(el('h3','Ranglistenkaempfe'));
      drawer.appendChild(el('p','Dein Ruhm: '+t.ruhm+' · Sieg +'+X.RUHM_SIEG+' Ruhm und '+X.ARENA_LOHN+' Gold, Niederlage -'+X.RUHM_NIEDERLAGE+' Ruhm und '+X.ARENA_TROST+' Gold Trost. Niemand verliert dabei Mons, Eier oder Gebiete.'));
      if(t.pause>0)drawer.appendChild(el('p','Der nächste Kampf ist '+wartetext(t.pause)+' möglich.'));
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
        drawer.appendChild(el('p','Tagwerk und Findelhaus sind für alle da, die gerade keinen Außenposten halten. Du hältst einen - deine Eier kommen von dort.'));
        return;
      }
      drawer.appendChild(el('p','Du hältst gerade kein Gebiet. Im Hafen gibt es trotzdem Arbeit und Nachwuchs: du bleibst im Spiel, auch ohne einen Fußbreit Land.'));
      var arbeit=el('article',undefined,'gm-quest-card');
      arbeit.appendChild(el('h3','Tagwerk · '+s.tagwerkLohn+' Gold'));
      arbeit.appendChild(el('p',s.tagwerk+'/'+s.tagwerkMax+' Aufträge liegen bereit'+(s.tagwerk<s.tagwerkMax?' · der nächste '+wartetext(s.tagwerkIn):' · Vorrat voll')));
      var ab=button(nah()?'Tagwerk annehmen ('+s.tagwerk+')':'Nach '+X.STADT.name+' laufen',function(){
        if(!nah()){hingehen();return;}run('tagwerk',{});
      },'gm-button gm-primary');
      ab.disabled=c.busy()||(nah()&&!s.tagwerk);
      arbeit.appendChild(ab);drawer.appendChild(arbeit);
      var findel=el('article',undefined,'gm-quest-card');
      findel.appendChild(el('h3','Das Findelhaus'));
      /* Jede geoeffnete Stunde ein Ei, bis zu zwei liegen bereit. */
      var bereit=Number(s.findelei)||0,max=s.findeleiMax||1;
      findel.appendChild(el('p',bereit+'/'+max+(bereit===1?' Ei liegt':' Eier liegen')+' bereit'+(bereit<max?' · das nächste '+wartetext(s.findeleiIn):' · Vorrat voll')+'. Jede geöffnete Stunde kommt eins dazu.'));
      var fb=button(nah()?'Ei abholen ('+bereit+')':'Nach '+X.STADT.name+' laufen',function(){
        if(!nah()){hingehen();return;}run('findelei',{});
      },'gm-button gm-primary');
      fb.disabled=c.busy()||(nah()&&!s.findelei);
      findel.appendChild(fb);drawer.appendChild(findel);
    }
    function brutTeil(s){
      drawer.appendChild(el('h3','Brutplaetze'));
      drawer.appendChild(el('p','Du hast '+s.brutplaetze+' Plätze'+(s.gekauft?' ('+s.gekauft+' gekauft)':'')+'. Jeder weitere lässt dich ein Ei mehr gleichzeitig ausbrüten.'));
      if(!s.preis){drawer.appendChild(el('p','Mehr gibt es nicht zu kaufen.'));return;}
      var b=button('Brutplatz kaufen · '+s.preis+' Gold',function(){run('brutplatz_kaufen',{});},'gm-button gm-primary');
      b.disabled=c.busy()||state().gold<s.preis;
      drawer.appendChild(b);
    }
    /* Das Tauschbrett. Nur gleiche Seltenheit gegen gleiche Seltenheit - das
       ist die Regel, die verhindert, dass ein zweites Konto das erste hochzieht. */
    function tauschTeil(liste){
      drawer.appendChild(el('h3','Das Tauschbrett'));
      drawer.appendChild(el('p','Mon gegen Mon, immer innerhalb derselben Seltenheit. Was du weggibst, ist weg - samt Runenstufe und Wesen. Was in deiner Truppe steht, kannst du nicht anbieten.'));
      var s=state(),eigene=(liste||[]).filter(function(v){return v.selbst;});
      (liste||[]).forEach(function(v){
        var gebe=D.mon(v.gebe),suche=D.mon(v.suche);if(!gebe||!suche)return;
        var karte=el('article',undefined,'gm-quest-card');
        karte.style.setProperty('--rarity',D.SELTENHEITEN[gebe.seltenheit].farbe);
        karte.appendChild(el('h3',(v.selbst?'Dein Angebot':v.name)+' · '+D.SELTENHEITEN[gebe.seltenheit].name));
        karte.appendChild(el('p','gibt '+gebe.name+' · sucht '+suche.name));
        karte.appendChild(truppenreihe([{id:v.gebe},{id:v.suche}]));
        if(v.selbst){
          var weg=button('Zurücknehmen',function(){run('tausch_zuruecknehmen',{tauschId:v.id});},'gm-button');
          weg.disabled=c.busy();karte.appendChild(weg);
        }else{
          /* Im Dienst ist im Dienst: das Kampfteam ebenso wie eine
             Gebietsbesatzung. Frueher stand hier nur die Truppe, und ein Mon
             von einem Aussenposten liess sich weggeben. */
          var hat=s.besitz.indexOf(v.suche)>=0,dienst=X.einsatzOrt(s,v.suche),drin=dienst!==null&&dienst!==undefined,doppelt=s.besitz.indexOf(v.gebe)>=0;
          var b=button(doppelt?gebe.name+' hast du schon':!hat?suche.name+' fehlt dir':drin?suche.name+' steht '+X.einsatzText(dienst):'Tauschen',
            function(){run('tausch_annehmen',{tauschId:v.id});},'gm-button gm-primary');
          b.disabled=c.busy()||!v.moeglich;karte.appendChild(b);
        }
        drawer.appendChild(karte);
      });
      if(!(liste||[]).length)drawer.appendChild(el('p','Das Brett ist leer. Häng das erste Angebot auf.'));
      if(eigene.length>=3){drawer.appendChild(el('p','Du hast drei Angebote am Brett - mehr gehen nicht.'));return;}
      /* Ein eigenes Angebot aufhaengen: nur Mons, die nirgends Dienst tun und
         nicht schon am Brett haengen, und gesucht wird nur, was fehlt. */
      drawer.appendChild(el('h3','Eigenes Angebot'));
      var haengt=eigene.map(function(v){return v.gebe;});
      var gebbar=s.besitz.filter(function(id){var ort=X.einsatzOrt(s,id);return (ort===null||ort===undefined)&&haengt.indexOf(id)<0;});
      if(!gebbar.length){drawer.appendChild(el('p','Du hast gerade nichts, das du entbehren kannst.'));return;}
      var gebeWahl=el('select'),sucheWahl=el('select');
      gebeWahl.setAttribute('aria-label','Mon, das du abgibst');
      sucheWahl.setAttribute('aria-label','Mon, das du suchst');
      function fuelleSuche(){
        SG.ui.clear(sucheWahl);
        /* Ohne gesetzten Wert steht die erste Zeile zur Wahl - ein Auswahlfeld
           ohne Auswahl gibt es sonst nur, bis der Browser selbst eine setzt. */
        var gewaehlt=D.mon(gebeWahl.value)||D.mon(gebbar[0]);
        if(!gewaehlt)return;
        gebeWahl.value=gewaehlt.id;
        var rang=gewaehlt.seltenheit;
        D.KATALOG.filter(function(k){return k.seltenheit===rang&&s.besitz.indexOf(k.id)<0;})
          .forEach(function(k){var o=el('option',k.name);o.value=k.id;sucheWahl.appendChild(o);});
        if(!sucheWahl.childNodes.length){var o=el('option','In dieser Seltenheit fehlt dir nichts');o.value='';sucheWahl.appendChild(o);}
      }
      gebbar.forEach(function(id){var k=D.mon(id),o=el('option',k.name+' · '+D.SELTENHEITEN[k.seltenheit].name);o.value=id;gebeWahl.appendChild(o);});
      gebeWahl.value=gebbar[0];
      gebeWahl.addEventListener('change',fuelleSuche);fuelleSuche();
      var zeile=el('div',undefined,'gm-plan-row');
      zeile.appendChild(gebeWahl);zeile.appendChild(el('span','→','gm-plan-pfeil'));zeile.appendChild(sucheWahl);
      drawer.appendChild(zeile);
      var anbieten=button('Angebot aufhängen',function(){
        if(!sucheWahl.value)return;
        run('tausch_anbieten',{gebe:gebeWahl.value,suche:sucheWahl.value});
      },'gm-button gm-primary');
      anbieten.disabled=c.busy();
      drawer.appendChild(anbieten);
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
      drawer.appendChild(el('p','Eine freie Stadt: sie gehört niemandem und kann nicht erobert werden. In ihrer Mitte steht die Große Arena - massives Gemäuer, man geht außen herum.','gm-beginner-tip'));
      if(!nah())drawer.appendChild(el('p','Du stehst noch außerhalb. Für alles hier musst du in der Stadt sein.'));
      championTeil(stand.turnier);
      rangTeil(stand.turnier);
      hafenTeil(stand.stadt);
      brutTeil(stand.stadt);
      tauschTeil(stand.tausch);
      chronikTeil(stand.turnier);
    }
    return {
      menu:zeigeStadt,
      apply:function(res){if(res&&res.turnier)stand={turnier:res.turnier,stadt:res.stadt,tausch:res.tausch||[]};},
      champion:function(){return stand&&stand.turnier&&stand.turnier.champion;},
      refresh:function(view){if(view==='stadt')zeigeStadt();}
    };
  };
})(SG);
