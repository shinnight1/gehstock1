/* Der Arenaplatz (bis 27.09.2026 Stockhafen). Frueher ein einziges langes
   Fenster, jetzt eins je Gebaeude:

     Arena          Champion, Ranglistenkaempfe, Tafel - nur Kampf
     Hafenkontor    Tagwerk und Findelhaus (ohne Gebiet), Kurierkontor
     Haendler       Ei, Schimmerperle, Runen- und Rohstoffhandel
     Tauschhaus     das Tauschbrett
     Runenschmiede  zerlegen und verschmelzen

   Rathaus und Streifzughaus haben ihre Fenster in 2-insel-ui.js und
   2-abenteuer-ui.js, die Brutplaetze stehen in der Brutstation (3-ui.js).
   Die Pins ueber den Gebaeuden setzt 2-bauten-ui.js. */
(function(SG){
  var R=SG.gehstockmon,X=R.abenteuer,D=R.daten;
  R.mountStadt=function(c){
    var el=c.el,button=c.button,drawer=c.drawer,stand=null,aktuell=null;
    function state(){return c.state();}
    /* Ueberschrift mit Medaillon (R.symbol aus 3-ui.js); ohne Bild nur Text. */
    function titel(text,bild){var h=el('h3',text),sym=R.symbol&&R.symbol(bild,'gm-titel-symbol');if(sym)h.insertBefore(sym,h.firstChild);return h;}
    function dauer(ms){var m=Math.max(0,Math.ceil(ms/60000));return m>=60?Math.floor(m/60)+' Std. '+m%60+' Min.':m+' Min.';}
    function wartetext(ms){return ms>90*60000?'wenn die Insel wieder öffnet':'in '+dauer(ms);}
    function nah(){var w=c.world(),p=w&&w.position&&w.position();return !!p&&X.inStadt(p);}
    /* Zum Gebaeude laufen, ohne bau zum Tor der Arena. */
    function hingehen(bau){c.closeDrawer();var w=c.world();if(w&&w.walkToPoint)w.walkToPoint(bau?bau.tuer:X.STADT_TOR);c.notify('Deine Figur läuft zum '+(bau?bau.name:'Tor der '+X.STADT.name)+'.');}
    function zahl(n){return Math.round(n||0).toLocaleString('de-DE');}
    /* Das Arenafest des Buergermeisters legt auf jeden Sieg ein Viertel drauf. */
    function arenaFaktor(){return (stand&&stand.insel&&stand.insel.effekte&&stand.insel.effekte.arenaLohn)||1;}
    function lohn(stufe){return Math.round(X.arenaLohn(stufe)*arenaFaktor());}
    /* Nach einem Kauf bleibt das Fenster, wo es war - es ist lang, und wer
       unten beim Haendler kauft, soll nicht jedes Mal nach oben springen. */
    function run(op,data){
      var oben=drawer.scrollTop;
      c.request(op,data).then(function(res){
        c.apply(res);
        if(res.arena&&res.arena.phase!=='finished')c.arena(res.arena,true);
        else if(aktuell){aktuell();drawer.scrollTop=oben;}
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
      drawer.appendChild(titel('Der Gehstock-Champion','champion'));
      drawer.appendChild(el('p',ch.selbst?'Du hältst den Titel seit '+dauer(c.now()-ch.seit)+' und hast '+ch.verteidigt+' Herausforderung(en) abgewehrt. Das bringt '+X.CHAMPION_SOLD+' Gold am Tag.'
        :ch.name+(ch.haus?' hält den Titel für das Haus, bis ihn jemand holt.':' trägt den Titel seit '+dauer(c.now()-ch.seit)+' und hat '+ch.verteidigt+' Herausforderung(en) abgewehrt.')+' Verteidigt wird mit der eingefrorenen Truppe und einem Zehntel Heimvorteil.',ch.selbst?'gm-selbst':undefined));
      drawer.appendChild(truppenreihe(ch.squad));
      if(ch.selbst)return;
      var reif=t.siege>=t.noetig,pause=t.titelPause>0;
      drawer.appendChild(el('p','Titelkampf: '+Math.min(t.siege,t.noetig)+'/'+t.noetig+' Ranglistensiege'
        +(pause?' · nächster Versuch '+wartetext(t.titelPause):reif?' · du darfst antreten':' · sammle noch '+(t.noetig-t.siege))));
      var b=button(nah()?'Um den Titel kämpfen':'Zur '+X.STADT.name+' laufen',function(){
        if(!nah()){hingehen(null);return;}run('champion_fordern',{});
      },'gm-button gm-primary');
      b.disabled=c.busy()||(nah()&&(!reif||pause));
      drawer.appendChild(b);
    }
    function rangTeil(t){
      drawer.appendChild(titel('Ranglistenkämpfe','arena'));
      drawer.appendChild(el('p','Sieg: +'+X.RUHM_SIEG+' Ruhm und '+lohn('leichter')+' / '+lohn('ausgeglichen')+' / '+lohn('schwerer')+' Gold gegen Leichtere / Gleichstarke / Stärkere'+(arenaFaktor()!==1?' (Arenafest)':'')+'. Niederlage: −'+X.RUHM_NIEDERLAGE+' Ruhm und '+X.ARENA_TROST+' Gold Trost.'));
      /* Die Bilanz bleibt ueber Titelkaempfe hinweg stehen - der Ruhm
         dagegen zaehlt nur bis zum naechsten Titelkampf. */
      drawer.appendChild(el('p','Ruhm '+t.ruhm+' · Stärke '+(t.eigeneStaerke||0)+' · '+(t.siegeGesamt||0)+' Siege aus '+(t.versuche||0)+' Kämpfen','gm-plan-hinweis'));
      if(t.empfohlen)drawer.appendChild(el('p','Tipp: Fang mit dem markierten Gegner an.','gm-plan-hinweis'));
      if(t.pause>0)drawer.appendChild(el('p','Der nächste Kampf ist '+wartetext(t.pause)+' möglich.'));
      if(!nah()){drawer.appendChild(button('Zur '+X.STADT.name+' laufen',function(){hingehen(null);},'gm-button gm-primary'));return;}
      (t.gegner||[]).forEach(function(g){
        var karte=el('article',undefined,'gm-quest-card');
        karte.appendChild(el('h3',(g.id===t.empfohlen?'★ ':'')+g.name+(g.haus?' · Haus':'')));
        var stufe={leichter:'leichter als du',ausgeglichen:'etwa gleich stark',schwerer:'stärker als du'}[g.einstufung];
        karte.appendChild(el('p',(g.haus?'Gegner des Hauses':'Spieler'+(g.titel?' · 🏅 '+g.titel:''))+' · Ruhm '+g.ruhm+(g.staerke?' · Stärke '+g.staerke+(stufe?' ('+stufe+')':''):'')+(g.id===t.empfohlen?' · empfohlen':'')+' · Sieg: '+lohn(g.einstufung)+' Gold'));
        karte.appendChild(truppenreihe(g.squad));
        var b=button('Herausfordern',function(){run('arena_rang',{targetId:g.id});},'gm-button');
        b.disabled=c.busy()||t.pause>0;
        karte.appendChild(b);drawer.appendChild(karte);
      });
    }
    function hafenTeil(s){
      if(!s.ohneGebiet){
        drawer.appendChild(el('p','Tagwerk und Findelhaus gibt es nur für Spieler ohne Gebiet.','gm-plan-hinweis'));
        return;
      }
      var hafen=X.gebaeude('hafen');
      var arbeit=el('article',undefined,'gm-quest-card');
      arbeit.appendChild(titel('Tagwerk · '+s.tagwerkLohn+' Gold','tagwerk'));
      arbeit.appendChild(el('p',s.tagwerk+'/'+s.tagwerkMax+' Aufträge liegen bereit'+(s.tagwerk<s.tagwerkMax?' · der nächste '+wartetext(s.tagwerkIn):' · Vorrat voll')));
      var ab=button(nah()?'Tagwerk annehmen ('+s.tagwerk+')':'Hingehen',function(){
        if(!nah()){hingehen(hafen);return;}run('tagwerk',{});
      },'gm-button gm-primary');
      ab.disabled=c.busy()||(nah()&&!s.tagwerk);
      arbeit.appendChild(ab);drawer.appendChild(arbeit);
      var findel=el('article',undefined,'gm-quest-card');
      findel.appendChild(titel('Das Findelhaus','findelhaus'));
      /* Jede geoeffnete Stunde ein Ei, bis zu zwei liegen bereit. */
      var bereit=Number(s.findelei)||0,max=s.findeleiMax||1;
      findel.appendChild(el('p',bereit+'/'+max+(bereit===1?' Ei liegt':' Eier liegen')+' bereit'+(bereit<max?' · das nächste '+wartetext(s.findeleiIn):' · Vorrat voll')));
      var fb=button(nah()?'Ei abholen ('+bereit+')':'Hingehen',function(){
        if(!nah()){hingehen(hafen);return;}run('findelei',{});
      },'gm-button gm-primary');
      fb.disabled=c.busy()||(nah()&&!s.findelei);
      findel.appendChild(fb);drawer.appendChild(findel);
    }
    /* Das Kurierkontor steht allen offen - mit Land zahlt es weniger. Die
       Auftraege selbst stehen im eigenen Fenster (2-handel-ui.js). */
    function kontorTeil(){
      var s=state(),k=s.kurier,brett=s.kurierBrett||[];
      var karte=el('article',undefined,'gm-quest-card');
      karte.appendChild(titel('Kurierkontor','kurier'));
      karte.appendChild(el('p',k?'Du trägst '+k.ware+' nach '+X.kurierOrtName(k.nach)+'.'
        :brett.length+'/'+X.KURIER_VORRAT+(brett.length===1?' Auftrag liegt':' Aufträge liegen')+' bereit · 12 bis 35 Gold je Weg.'));
      var b=button(k?'Zum Paket':'Aufträge ansehen',function(){if(R.kurierOeffnen)R.kurierOeffnen();},'gm-button gm-primary');
      b.disabled=c.busy();karte.appendChild(b);drawer.appendChild(karte);
    }
    /* Goldwaren: der Haendler mit einem Ei je Tag und der Schimmerperle, dann
       die Runenschmiede. Gekauft wird von ueberall, wie beim Brutplatz. */
    function haendlerTeil(){
      var s=state(),heute=R.zeiten.day(c.now()),gekauft=s.haendlerTag===heute,voll=s.eggs.length>=R.wirtschaft.BAG_LIMIT;
      var raster=el('div',undefined,'gm-shop-grid');
      var ei=el('article',undefined,'gm-shop-card'),eiBild=R.symbol&&R.symbol('haendler','gm-waren-bild');
      if(eiBild)ei.appendChild(eiBild);
      ei.appendChild(el('h3','Ein Ei'));
      ei.appendChild(el('p','Normale Chancen, eins pro Tag.'));
      var kaufen=button(gekauft?'Heute schon gekauft':voll?'Bruttasche voll':'Kaufen · '+X.HAENDLER_EI_PREIS+' Gold',function(){run('ei_kaufen',{});},'gm-button gm-primary');
      kaufen.disabled=c.busy()||gekauft||voll||s.gold<X.HAENDLER_EI_PREIS;
      ei.appendChild(kaufen);raster.appendChild(ei);
      var perle=el('article',undefined,'gm-shop-card'),perleBild=R.symbol&&R.symbol('perle','gm-waren-bild');
      if(perleBild)perle.appendChild(perleBild);
      perle.appendChild(el('h3','Schimmerperle'));
      perle.appendChild(el('p','Dein nächstes Mon schlüpft schimmernd. Nur Optik.'));
      var perleKaufen=button(s.schimmerperle?'Liegt bereit':'Kaufen · '+X.SCHIMMERPERLE_PREIS+' Gold',function(){run('schimmerperle_kaufen',{});},'gm-button gm-primary');
      perleKaufen.disabled=c.busy()||!!s.schimmerperle||s.gold<X.SCHIMMERPERLE_PREIS;
      perle.appendChild(perleKaufen);raster.appendChild(perle);
      drawer.appendChild(raster);
    }
    /* Der Gluecksautomat (2-automat.js). Die Walzen drehen sofort beim Tippen
       los und halten von links nach rechts an, sobald das Ergebnis vom Server
       da ist. Das Fenster bleibt dabei offen (fensterBleibt) - vorher
       verschwand der Haendler bei jedem Spiel kurz und baute sich neu auf.
       Die Gewinnchance steht bewusst nirgends im Spiel (Louis, 30.09.2026). */
    var walzenZuletzt=['gold','eier','rune'],dreht=false;
    function walzenBild(sym){var b=R.symbol&&R.symbol(sym,'gm-walze-bild');return b||el('span',sym,'gm-walze-text');}
    function automatTeil(){
      var s=state(),A2=X.AUTOMAT,st=X.automatStand(s,c.now()),voll=s.eggs.length>=R.wirtschaft.BAG_LIMIT;
      var karte=el('article',undefined,'gm-quest-card gm-automat');
      karte.appendChild(titel('Glücksautomat','truhe'));
      karte.appendChild(el('p','Drei gleiche Bilder gewinnen.'));
      var walzen=el('div',undefined,'gm-walzen');
      walzenZuletzt.forEach(function(sym){var f=el('div',undefined,'gm-walze');f.appendChild(walzenBild(sym));walzen.appendChild(f);});
      karte.appendChild(walzen);
      /* Was es gibt - ohne Chancen. */
      var liste=el('div',undefined,'gm-gewinnliste');
      A2.gewinne.forEach(function(g){var z=el('div',undefined,'gm-gewinn'+(X.automatErreichbar(g,s,c.now())?'':' aus'));z.appendChild(walzenBild(g.symbol));z.appendChild(el('span','×3'));z.appendChild(el('strong',g.name));liste.appendChild(z);});
      karte.appendChild(liste);
      karte.appendChild(el('p',!st.frei?'Die Eier sind für heute ausgespielt - alles andere läuft weiter.':voll?'Deine Bruttasche ist voll - gerade ist kein Ei drin.':'Heute noch '+st.frei+(st.frei===1?' Ei':' Eier')+' zu gewinnen.','gm-plan-hinweis'));
      var knopf=button('Spielen · '+A2.einsatz+' Gold',spielen,'gm-button gm-primary');
      knopf.disabled=dreht||c.busy()||s.gold<A2.einsatz;
      karte.appendChild(knopf);drawer.appendChild(karte);
    }
    function spielen(e){
      var walzen=drawer.querySelector('.gm-walzen'),knopf=e&&e.currentTarget;
      if(dreht||c.busy()||!walzen)return;
      dreht=true;if(knopf)knopf.disabled=true;
      var S=X.AUTOMAT.symbole,felder=[].slice.call(walzen.children),laeuft=[true,true,true],start=Date.now();
      function zeige(f,sym){f.textContent='';f.appendChild(walzenBild(sym));}
      function anhalten(i,sym){laeuft[i]=false;felder[i].classList.remove('dreht');zeige(felder[i],sym);}
      felder.forEach(function(f){f.classList.add('dreht');});
      var takt=setInterval(function(){felder.forEach(function(f,i){if(laeuft[i])zeige(f,S[Math.floor(Math.random()*S.length)]);});},90);
      /* Zum Schluss einmal neu zeichnen, ohne zu schliessen: Resttreffer, Gold
         und die Knoepfe der anderen Waren stimmen danach wieder. Das passiert
         in einem Zug samt Scrollstand - zu sehen ist davon nichts. */
      function fertig(meldung,gewonnen){
        clearInterval(takt);dreht=false;
        if(meldung)c.notify(meldung);
        if(aktuell&&!drawer.hidden&&drawer.contains(walzen)){var oben=drawer.scrollTop;aktuell();drawer.scrollTop=oben;var neu=drawer.querySelector('.gm-walzen');if(neu&&gewonnen)neu.classList.add('gewonnen');}
      }
      function abbrechen(){felder.forEach(function(f,i){anhalten(i,walzenZuletzt[i]);});}
      c.request('automat_spielen',{},{fensterBleibt:true}).then(function(res){
        c.apply(res);
        var erg=res.automat;
        if(!erg){abbrechen();fertig(res.message,false);return;}
        walzenZuletzt=erg.walzen.slice();
        /* Mindestens 0,7 s drehen, auch wenn der Server schneller war. */
        var ab=Math.max(0,700-(Date.now()-start));
        [0,1,2].forEach(function(i){setTimeout(function(){anhalten(i,erg.walzen[i]);if(i===2)setTimeout(function(){fertig(res.message,erg.gewonnen);},250);},ab+i*450);});
      }).catch(function(error){abbrechen();fertig(null,false);c.error(error);});
    }
    /* Runenhandel: feste Preise, 70 % Ankauf, je Woche gedeckelt (2-handel.js).
       Offen erst, wenn die Markthalle steht. */
    function runenhandelTeil(){
      var h=stand&&stand.handel,r=h&&h.runen,s=state(),runen=s.runes||[];
      drawer.appendChild(titel('Runenhandel','runenhandel'));
      if(!r){
        var bau=((h&&h.bauten)||[]).find(function(b){return b.id==='markthalle';});
        drawer.appendChild(el('p','Öffnet, wenn die Markthalle steht'+(bau?' ('+zahl(bau.gold)+' von '+zahl(bau.ziel)+' Gold)':'')+'.'));
        return;
      }
      drawer.appendChild(el('p','Rückkauf zu '+Math.round(X.RUNEN_ANKAUF*100)+' %. Diese Woche noch frei: kaufen für '+zahl(r.kaufFrei)+' Gold, verkaufen für '+zahl(r.verkaufFrei)+' Gold.'));
      var liste=el('div',undefined,'gm-schmiede');
      D.SELTENHEITEN.forEach(function(sel,i){
        var n=runen[i]||0,zeile=el('div',undefined,'gm-schmiede-zeile'),preis=X.RUNEN_PREISE[i],ankauf=X.runenAnkauf(i);
        zeile.style.setProperty('--rarity',sel.farbe);
        zeile.appendChild(el('strong',sel.name+': '+n));
        var k=button('Kaufen · '+preis+' G',function(){run('runen_kaufen',{rang:i});},'gm-button');
        k.disabled=c.busy()||s.gold<preis||preis>r.kaufFrei;zeile.appendChild(k);
        var v=button('Verkaufen · '+ankauf+' G',function(){run('runen_verkaufen',{rang:i});},'gm-button');
        v.disabled=c.busy()||n<1||ankauf>r.verkaufFrei;zeile.appendChild(v);
        liste.appendChild(zeile);
      });
      drawer.appendChild(liste);
      rohstoffhandelTeil(r);
    }
    /* Rohstoffe beim Haendler: gleiche Wochengrenzen wie die Runen, er
       verkauft zum vollen Preis und nimmt zur Haelfte zurueck. */
    function rohstoffhandelTeil(r){
      var s=state(),lager=s.lager||{};
      drawer.appendChild(titel('Rohstoffe','kristall'));
      drawer.appendChild(el('p','Immer fünf Stück. Dein Lager: '+R.lagerText(s)+'.'));
      var liste=el('div',undefined,'gm-schmiede');
      R.wirtschaft.ROHSTOFFE.forEach(function(ro){
        var zeile=el('div',undefined,'gm-schmiede-zeile'),preis=X.ROHSTOFF_PREISE[ro.id]*5,ankauf=X.rohstoffAnkauf(ro.id)*5,n=lager[ro.id]||0;
        zeile.appendChild(el('strong',ro.name+': '+n));
        var k=button('5 kaufen · '+preis+' G',function(){run('rohstoff_kaufen',{rohstoff:ro.id,menge:5});},'gm-button');
        k.disabled=c.busy()||s.gold<preis||preis>r.kaufFrei;zeile.appendChild(k);
        var v=button('5 verkaufen · '+ankauf+' G',function(){run('rohstoff_verkaufen',{rohstoff:ro.id,menge:5});},'gm-button');
        v.disabled=c.busy()||n<5||ankauf>r.verkaufFrei;zeile.appendChild(v);
        liste.appendChild(zeile);
      });
      drawer.appendChild(liste);
    }
    function schmiedeTeil(){
      var s=state(),runen=s.runes||[],letzte=D.SELTENHEITEN.length-1;
      drawer.appendChild(el('p','Eine Rune zerfällt in zwei der Stufe darunter, drei verschmelzen zu einer darüber.'));
      var liste=el('div',undefined,'gm-schmiede');
      D.SELTENHEITEN.forEach(function(r,i){
        var n=runen[i]||0,zeile=el('div',undefined,'gm-schmiede-zeile');
        zeile.style.setProperty('--rarity',r.farbe);
        zeile.appendChild(el('strong',r.name+': '+n));
        if(i>0){var k=X.schmiedeKosten('zerlegen',i),z=button('1 → 2 '+D.SELTENHEITEN[i-1].name+' · '+k+' G',function(){run('runen_zerlegen',{rang:i});},'gm-button');
          z.disabled=c.busy()||n<1||s.gold<k;zeile.appendChild(z);}
        if(i<letzte){var v=X.schmiedeKosten('verschmelzen',i),m=button('3 → 1 '+D.SELTENHEITEN[i+1].name+' · '+v+' G',function(){run('runen_verschmelzen',{rang:i});},'gm-button');
          m.disabled=c.busy()||n<3||s.gold<v;zeile.appendChild(m);}
        liste.appendChild(zeile);
      });
      drawer.appendChild(liste);
    }
    /* Das Tauschbrett. Nur gleiche Seltenheit gegen gleiche Seltenheit - das
       ist die Regel, die verhindert, dass ein zweites Konto das erste hochzieht. */
    function tauschTeil(liste){
      drawer.appendChild(el('p','Mon gegen Mon, nur in derselben Seltenheit. Was du weggibst, ist samt Runen weg.'));
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
      if(!(liste||[]).length)drawer.appendChild(el('p','Das Tauschbrett ist leer.'));
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
    /* Ein Fenster je Gebaeude. aktuell merkt sich, welches offen ist, damit
       run() nach einem Kauf genau das wieder zeichnet. */
    function fenster(titelText,view,zeichnen){
      if(!stand||!c.open(titelText,view))return;
      aktuell=function(){fenster(titelText,view,zeichnen);};
      zeichnen();
    }
    function zeigeArena(){fenster(X.STADT.name,'stadt',function(){
      drawer.appendChild(el('p','Hier kämpfst du gegen die gespeicherten Truppen anderer Spieler. Verlieren kostet nie Mons, Eier oder Gebiete.','gm-beginner-tip'));
      championTeil(stand.turnier);
      rangTeil(stand.turnier);
      chronikTeil(stand.turnier);
    });}
    function zeigeHafen(){fenster('Hafenkontor','hafen',function(){hafenTeil(stand.stadt);kontorTeil();});}
    function zeigeHaendler(){fenster('Händler','haendler',function(){haendlerTeil();automatTeil();runenhandelTeil();});}
    function zeigeTausch(){fenster('Tauschhaus','tausch',function(){tauschTeil(stand.tausch);});}
    function zeigeSchmiede(){fenster('Runenschmiede','schmiede',function(){schmiedeTeil();});}
    var FENSTER={stadt:zeigeArena,hafen:zeigeHafen,haendler:zeigeHaendler,tausch:zeigeTausch,schmiede:zeigeSchmiede};
    return {
      menu:zeigeArena,hafen:zeigeHafen,haendler:zeigeHaendler,tausch:zeigeTausch,schmiede:zeigeSchmiede,
      views:Object.keys(FENSTER),
      apply:function(res){if(res&&res.turnier)stand={turnier:res.turnier,stadt:res.stadt,tausch:res.tausch||[],handel:res.handel||null,insel:res.insel||null};},
      stadt:function(){return stand&&stand.stadt;},
      champion:function(){return stand&&stand.turnier&&stand.turnier.champion;},
      refresh:function(view){if(FENSTER[view])FENSTER[view]();}
    };
  };
})(SG);
