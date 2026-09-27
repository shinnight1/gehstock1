/* Abenteuer, Ausrüstung und das zweistufige Spielerduell. */
(function(SG){var R=SG.gehstockmon,X=R.abenteuer,D=R.daten;
  R.mountAdventure=function(c){var el=c.el,button=c.button,drawer=c.drawer,duel=null,pins=[],encounters=[],dungeons=R.mountDungeons(c),handel=R.mountHandel(c),insel=R.mountInsel(c),projekte=null,projektLeiste=null;
    function state(){return c.state();}
    /* Die Leiste ueber der Karte zeigt, woran die Insel gerade gemeinsam
       arbeitet: die Lebenskraft des Zerhackers und die Hoehe des Leuchtturms.
       Beide Balken sind anklickbar und fuehren zum jeweiligen Fenster. */
    /* Links das Medaillon, rechts Titel und Stand. */
    function kachel(beim_klick, bild, cls) {
      var kasten = button('', beim_klick, cls), sym = R.symbol && R.symbol(bild, 'gm-projekt-symbol');
      if (sym) kasten.appendChild(sym);
      var text = el('span', undefined, 'gm-projekt-text'); kasten.appendChild(text);
      return { kasten: kasten, text: text };
    }
    function balken(titel, wert, ziel, farbe, beim_klick, bild) {
      var k = kachel(beim_klick, bild, 'gm-projekt'), kasten = k.text;
      var anteil = Math.max(0, Math.min(1, ziel ? wert / ziel : 0));
      kasten.appendChild(el('b', titel));
      var spur = el('span', undefined, 'gm-projekt-spur'), fuellung = el('i');
      fuellung.style.width = Math.round(anteil * 100) + '%';
      fuellung.style.background = farbe;
      spur.appendChild(fuellung); kasten.appendChild(spur);
      kasten.appendChild(el('small', Math.round(anteil * 100) + ' %'));
      return k.kasten;
    }
    /* Dasselbe Format wie ein Balken, nur ohne Fortschritt: fuer Dinge, die
       keine Zahl von hundert haben, aber trotzdem jeder sehen soll. */
    function marke(titel, text, farbe, beim_klick, bild) {
      var k = kachel(beim_klick, bild, 'gm-projekt gm-marke'), kasten = k.text;
      kasten.appendChild(el('b', titel));
      var zeile = el('strong', text, 'gm-marke-wert');
      zeile.style.color = farbe;
      kasten.appendChild(zeile);
      return k.kasten;
    }
    function zeigeProjekte() {
      if (!projektLeiste) { projektLeiste = el('div', undefined, 'gm-projekte'); c.layer.appendChild(projektLeiste); }
      projektLeiste.textContent = '';
      /* Ganz vorn: was heute zu tun ist - mit Serie und Truhe. */
      var heute = projekte && projekte.alltag;
      if (heute && c.heute) {
        var erledigt = heute.aufgaben.filter(function (a) { return a.stand >= a.ziel; }).length;
        projektLeiste.appendChild(marke('Heute' + (heute.serie ? ' · 🔥' + heute.serie : ''),
          heute.truhe ? '✓ Truhe geöffnet' : heute.fertig ? '🎁 Truhe bereit!' : erledigt + '/3 Aufgaben',
          heute.fertig && !heute.truhe ? '#81d2a3' : '#f0b429', c.heute, 'truhe'));
      }
      /* Das Wetter der Woche gleich danach - es veraendert alles andere. */
      var inselKacheln = insel.kacheln(marke);
      if (inselKacheln.wetter) projektLeiste.appendChild(inselKacheln.wetter);
      /* Streifzuege: zurueck geht vor, sonst die naechste Rueckkehr. */
      var zuege = (state() && state().streifzuege) || [];
      if (zuege.length) {
        var jetzt = c.now(), da = zuege.filter(function (z) { return z.fertigAt <= jetzt; }).length;
        var naechster = zuege.reduce(function (m, z) { return Math.min(m, z.fertigAt); }, Infinity);
        projektLeiste.appendChild(marke('Streifzüge', da ? '🎒 ' + da + ' zurück!' : 'bis ' + X.uhrText(naechster, jetzt).replace(/^um /, ''),
          da ? '#81d2a3' : '#89cce5', adventure, 'streifzug'));
      }
      /* Kurierkontor und Gemeinschaftsbau kommen aus 2-handel-ui.js. */
      var handelKacheln = handel.kacheln(marke, balken);
      if (handelKacheln.kurier) projektLeiste.appendChild(handelKacheln.kurier);
      var z = projekte && projekte.zerhacker, l = projekte && projekte.leuchtturm;
      if (z && z.hp > 0) projektLeiste.appendChild(balken('Zerhacker', z.hp, z.maxHp, '#f2705a', zeigeZerhacker, 'zerhacker'));
      else if (z) projektLeiste.appendChild(balken('Zerhacker erlegt', 1, 1, '#81d2a3', zeigeZerhacker, 'zerhacker'));
      if (l && !l.fertig) projektLeiste.appendChild(balken('Leuchtturm', l.gold, l.ziel, '#f0b429', zeigeLeuchtturm, 'leuchtturm'));
      if (handelKacheln.bau) projektLeiste.appendChild(handelKacheln.bau);
      var a = projekte && projekte.wochenaufgabe;
      if (a) projektLeiste.appendChild(balken(a.name, a.stand, a.ziel, a.erfuellt ? '#81d2a3' : '#89cce5', zeigeWoche, 'woche'));
      /* Das Kopfgeld stand bisher nur im Ausruestungsfenster und fiel damit
         niemandem auf, obwohl es das ganze Spielfeld betrifft. Hier steht es
         neben den anderen Weltzustaenden: eine Zeile, kein Banner. */
      var kopf = projekte && projekte.kopfgeld;
      if (kopf) projektLeiste.appendChild(marke(kopf.selbst ? 'Kopfgeld auf dich' : 'Kopfgeld',
        kopf.gold.toLocaleString('de-DE') + ' G · ' + (kopf.selbst ? 'du führst' : kopf.name),
        kopf.selbst ? '#f2705a' : '#f0b429', zeigeKopfgeld, 'kopfgeld'));
      projektLeiste.hidden = !projektLeiste.childNodes.length;
      leisteAusrichten();
    }
    /* Auf Touch-Geraeten und schmalen Bildschirmen steht die Leiste unter der
       Kopfzeile (siehe gehstockmon-abenteuer.css). Wie hoch die ist, haengt am
       Namen und daran, ob die Goldzeile umbricht - darum wird gemessen statt
       geschaetzt. Ohne Messmoeglichkeit gilt der Wert aus dem CSS. */
    function leisteAusrichten() {
      if (!projektLeiste || typeof window === 'undefined' || !window.matchMedia || !projektLeiste.getBoundingClientRect) return;
      var kopf = c.layer.parentNode && c.layer.parentNode.querySelector && c.layer.parentNode.querySelector('.gm-brand');
      if (!window.matchMedia('(pointer:coarse),(max-width:1049px)').matches || !kopf) { projektLeiste.style.top = ''; return; }
      var unten = kopf.getBoundingClientRect().bottom, oben = c.layer.getBoundingClientRect().top;
      if (unten > oben) projektLeiste.style.top = Math.round(unten - oben + 8) + 'px';
    }
    function tafel(eintraege, einheit) {
      var liste = el('ol', undefined, 'gm-tafel');
      (eintraege || []).forEach(function (v) {
        var zeile = el('li', v.name + ' · ' + v.wert + ' ' + einheit);
        if (v.selbst) zeile.className = 'gm-selbst';
        liste.appendChild(zeile);
      });
      return liste;
    }
    /* Das ist der Dienst, den der Leuchtturm leistet: er sagt, wohin man
       laufen muss. Ohne ihn bleibt nur die Suche. */
    function peilung() {
      var w = c.world(), ort = w && w.zerhackerOrt && w.zerhackerOrt();
      if (!ort || !w.position) return null;
      var mir = w.position(), dx = ort.x - mir.x, dz = ort.z - mir.z;
      var weit = Math.round(Math.hypot(dx, dz));
      var richtungen = ['Norden', 'Nordosten', 'Osten', 'Südosten', 'Süden', 'Südwesten', 'Westen', 'Nordwesten'];
      var achtel = Math.round(Math.atan2(dx, dz) / (Math.PI / 4));
      return { text: richtungen[((achtel % 8) + 8) % 8], weit: weit };
    }

    /* Ausserhalb der Oeffnungszeiten waechst nichts nach - dann steht hier
       die Stunde, zu der es weitergeht, statt einer Zahl in Minuten. */
    function wartetext(ms) {
      var min = Math.ceil((ms || 0) / 60000);
      if (min <= 90) return 'in ' + min + ' Minuten';
      return 'wenn die Insel wieder öffnet';
    }

    /* Er zieht weiter, waehrend man unterwegs zu ihm ist. Wer den Ort anpeilt,
       an dem er gerade steht, kommt ein paar Schritte hinter ihm an - und das
       jedes Mal aufs Neue, bis man aufgibt. Gesucht wird darum der Punkt, an
       dem beide gleichzeitig sind: einmal schaetzen, wie lange der Weg dauert,
       und mit dieser Zeit neu fragen, wo er dann steht. Nach ein paar Runden
       steht der Treffpunkt. Gerechnet wird mit 9 statt 11 Schritten je
       Sekunde, weil ein Weg um Mauern und ueber Bruecken laenger ist als die
       Luftlinie - lieber etwas zu weit vorn warten als hinterherlaufen. */
    function treffpunkt(von) {
      var jetzt = c.now(), ziel = X.zerhackerOrt(jetzt);
      for (var i = 0; i < 6; i++) {
        var dauer = Math.hypot(ziel.x - von.x, ziel.z - von.z) / 9 * 1000;
        ziel = X.zerhackerOrt(jetzt + dauer);
      }
      return ziel;
    }
    function zeigeZerhacker() {
      var z = projekte && projekte.zerhacker; if (!z || !c.open('Gehstockhassender Zerhacker', 'zerhacker')) return;
      if (z.hp <= 0) {
        drawer.appendChild(el('p', 'Er ist erlegt. Am Montag steht der nächste vor der Insel.'));
        drawer.appendChild(el('h3', 'Wer zugeschlagen hat'));
        drawer.appendChild(tafel(z.tafel, 'Schaden'));
        return;
      }
      drawer.appendChild(el('p', 'Ein Wesen, das jeden Gehstock hasst, zieht diese Woche seine Bahn über die Insel. Es fällt nur, wenn viele gemeinsam zuschlagen - jeder Treffer zählt auf dasselbe Ziel.'));
      /* Die Beute stand bisher nirgends. Sie richtet sich nach dem Anteil am
         Schaden (gehstockmon-adventure.mjs, zerhacker_schlagen). */
      drawer.appendChild(el('p', 'Beute, wenn er fällt: Bei gleichem Anteil bekommt jeder, der zugeschlagen hat, ' + X.ZERHACKER.beuteGold + ' Gold und ' + X.ZERHACKER.beuteRunen + ' Mythisch-Runen. Wer mehr Schaden macht, bekommt mehr, jeder mindestens 50 Gold und eine Rune. Mythisch-Runen zerlegst du in der Runenschmiede in Stockhafen in Runen für deine Mons.'));
      drawer.appendChild(el('p', 'Lebenskraft: ' + z.hp.toLocaleString('de-DE') + ' von ' + z.maxHp.toLocaleString('de-DE')
        + (z.eigen ? ' · dein Anteil: ' + z.eigen.toLocaleString('de-DE') : '')));
      var l = projekte && projekte.leuchtturm, ziel = peilung();
      if (l && l.fertig && ziel) drawer.appendChild(el('p', 'Der Leuchtturm meldet: ' + ziel.text
        + ', etwa ' + ziel.weit + ' Schritte entfernt.'));
      else if (ziel) drawer.appendChild(el('p', 'Wo er gerade steckt, weiß niemand genau - dafür müsste erst der Leuchtturm stehen.'));
      drawer.appendChild(el('p', 'Deine Schläge: ' + z.vorrat + ' von ' + z.vorratMax
        + (z.vorrat < z.vorratMax ? ' · der nächste ' + wartetext(z.naechsterIn) : ' · Beutel voll')));
      var wartet = !z.vorrat;
      var w = c.world(), ort = w && w.zerhackerOrt && w.zerhackerOrt();
      var nah = ort && w.position && Math.hypot(w.position().x - ort.x, w.position().z - ort.z) < X.ZERHACKER.reichweite;
      var knopf = button(wartet ? 'Kein Schlag übrig' : nah ? 'Zuschlagen (' + z.vorrat + ')' : 'Hingehen', function () {
        if (wartet) return;
        if (!nah) { c.closeDrawer(); if (w && w.walkToPoint) w.walkToPoint(treffpunkt(w.position())); c.notify('Du machst dich auf den Weg zum Zerhacker.'); return; }
        run('zerhacker_schlagen', {}, 'zerhacker');
      }, 'gm-button gm-primary');
      knopf.disabled = !!wartet;
      drawer.appendChild(knopf);
      drawer.appendChild(el('h3', 'Wer zugeschlagen hat'));
      drawer.appendChild(tafel(z.tafel, 'Schaden'));
    }
    function zeigeKopfgeld() {
      var kopf = projekte && projekte.kopfgeld;
      if (!kopf || !c.open(kopf.selbst ? 'Kopfgeld auf dich' : 'Kopfgeld auf ' + kopf.name, 'kopfgeld')) return;
      drawer.appendChild(el('p', kopf.selbst
        ? 'Du hältst mit ' + kopf.gebiete + ' Außenposten die meisten auf der Insel. Wer dich im Überfall schlägt, bekommt dafür ' + kopf.gold.toLocaleString('de-DE') + ' Gold obendrauf.'
        : kopf.name + ' hält mit ' + kopf.gebiete + ' Außenposten die meisten auf der Insel. Wer ihn im Überfall schlägt, bekommt ' + kopf.gold.toLocaleString('de-DE') + ' Gold obendrauf.'));
      drawer.appendChild(el('p', 'Das Kopfgeld wächst mit jedem Außenposten: ' + X.KOPFGELD_JE_GEBIET
        + ' Gold je Gebiet. Es liegt auf dem, der allein die meisten hält, sobald es mindestens ' + X.KOPFGELD_AB
        + ' sind. Jeder erfolgreiche Überfall auf ihn zahlt es aus - danach hat er zwei Stunden Schutz.'));
      drawer.appendChild(el('p', kopf.selbst
        ? 'Solange du vorn liegst, bist du das Ziel. Wer ein Ei bei sich trägt, verliert es im Überfall.'
        : 'Du musst ihn dafür auf der Insel finden und im Überfall schlagen - Waffenduell, dann Mon-Kampf.'));
    }
    /* Die Fehde: eine Woche gegeneinander, verlieren kann man nur die Woche. */
    function fehdeTeil(peer) {
      var f = projekte && projekte.fehde; if (!f) return;
      if (f.gegner) {
        if (f.gegner === peer.name) drawer.appendChild(el('p', 'Ihr steht in einer Fehde: ' + f.meine + ' zu ' + f.seine + ' Punkten.'));
        else drawer.appendChild(el('p', 'Du stehst diese Woche in einer Fehde mit ' + f.gegner + '.'));
        return;
      }
      var offen = (f.offeneAn || []).filter(function (v) { return v.name === peer.name; })[0];
      if (offen) {
        drawer.appendChild(el('p', peer.name + ' hat dich zur Fehde gefordert - eine Woche lang zählt alles, was ihr beide tut.'));
        drawer.appendChild(button('Fehde annehmen', function () { run('fehde_annehmen', { targetId: offen.id }, 'rival'); }, 'gm-button gm-primary'));
        return;
      }
      if ((f.eigeneAn || []).indexOf(peer.name) >= 0) {
        drawer.appendChild(el('p', 'Deine Herausforderung liegt bei ' + peer.name + '. Sie gilt bis Sonntag.'));
        return;
      }
      drawer.appendChild(button('Zur Fehde fordern', function () { run('fehde_fordern', { targetId: peer.id }, 'rival'); }, 'gm-button'));
    }

    function zeigeWoche() {
      var a = projekte && projekte.wochenaufgabe; if (!a || !c.open(a.name, 'woche')) return;
      drawer.appendChild(el('p', a.was + ' - diese Woche zählt jeder Beitrag von euch allen auf dasselbe Ziel. '
        + 'Es gibt nichts zu warten und keinen Weg zu laufen: was du ohnehin tust, zählt mit.'));
      drawer.appendChild(el('p', a.stand + ' von ' + a.ziel + (a.eigen ? ' · dein Anteil: ' + a.eigen : '')));
      /* Der Lohn stand bisher nirgends - man wusste nicht, wofuer man mitmacht. */
      var lohn = a.lohn || (X.wochenziel(c.now()) || {}).lohn;
      if (lohn) drawer.appendChild(el('p', 'Lohn: ' + lohn + ' Gold für jeden, der mindestens einmal beigetragen hat, dazu ein Bonus nach deinem Anteil - wer alles allein schafft, bekommt das Doppelte. Ausgezahlt wird sofort, wenn das Ziel erreicht ist. Bleibt es bis Sonntag offen, gibt es nichts.'));
      if (a.erfuellt) drawer.appendChild(el('p', 'Geschafft. Am Montag wartet die nächste Aufgabe.'));
      drawer.appendChild(el('h3', 'Wer mitgeholfen hat'));
      drawer.appendChild(tafel(a.tafel, 'Stück'));
    }

    function zeigeLeuchtturm() {
      var l = projekte && projekte.leuchtturm; if (!l || !c.open('Leuchtturm', 'leuchtturm')) return;
      if (l.fertig) {
        drawer.appendChild(el('p', 'Der Leuchtturm steht. Sein Licht peilt den Zerhacker an: im Fenster zu ihm stehen jetzt Richtung und Entfernung.'));
        var ziel = peilung();
        if (ziel) drawer.appendChild(el('p', 'Gerade im ' + ziel.text + ', etwa ' + ziel.weit + ' Schritte entfernt.'));
      } else {
        drawer.appendChild(el('p', 'Mitten auf der Insel steht ein Gerüst. Wer Gold hineinsteckt, baut mit - und steht danach für immer auf der Tafel. Ist der Turm fertig, peilt sein Licht den Zerhacker an, und jeder sieht Richtung und Entfernung, statt die halbe Insel abzusuchen.'));
        drawer.appendChild(el('p', l.gold.toLocaleString('de-DE') + ' von ' + l.ziel.toLocaleString('de-DE') + ' Gold verbaut'
          + (l.eigen ? ' · dein Anteil: ' + l.eigen.toLocaleString('de-DE') : '')));
        var s = state();
        [50, 250, 1000].forEach(function (betrag) {
          var b = button(betrag + ' Gold geben', function () { run('leuchtturm_spenden', { betrag: betrag }, 'leuchtturm'); }, 'gm-button');
          b.disabled = s.gold < betrag;
          drawer.appendChild(b);
        });
      }
      drawer.appendChild(el('h3', 'Die Tafel am Sockel'));
      drawer.appendChild(tafel(l.tafel, 'Gold'));
    }

    function player(skin,weapon){var p=el('div',undefined,'gm-skin-preview');p.style.setProperty('--skin',X.skin(skin).color);var canvas=el('canvas');canvas.width=canvas.height=128;canvas.setAttribute('aria-label',X.skin(skin).name);p.appendChild(canvas);R.drawAtlas(canvas,'skins',R.skinIndex(skin));p.appendChild(el('b',{gehstock:'⌁',eisenspeer:'♜',runenklinge:'⚔',sturmhammer:'⚒',titanenlanze:'↟',weltenbrecher:'✹'}[weapon]||'✦','gm-weapon-icon'));return p;}
    /* Titel: alle mit Fortschritt, der erreichte laesst sich tragen. */
    function titelTeil(s) {
      var kopf = el('h3', 'Titel'), sym = R.symbol && R.symbol('titel', 'gm-titel-symbol');
      if (sym) kopf.insertBefore(sym, kopf.firstChild);
      drawer.appendChild(kopf);
      drawer.appendChild(el('p', 'Der Titel steht unter deinem Namen - auf der Insel und in der Arena-Liste. Er bringt nur Ehre.'));
      var liste = el('div', undefined, 'gm-titel-liste');
      X.TITEL.forEach(function (t) {
        var n = Math.min(t.ziel, t.wert(s)), da = n >= t.ziel, traegt = s.titel === t.id;
        var zeile = el('div', undefined, 'gm-titel-zeile' + (da ? ' erreicht' : ''));
        var text = el('div', undefined, 'gm-titel-text');
        text.appendChild(el('strong', t.name));
        text.appendChild(el('small', n.toLocaleString('de-DE') + ' / ' + t.ziel.toLocaleString('de-DE') + ' ' + t.was));
        var spur = el('span', undefined, 'gm-projekt-spur'), fuellung = el('i');
        fuellung.style.width = Math.round(100 * n / t.ziel) + '%'; fuellung.style.background = da ? '#81d2a3' : '#f0b429';
        spur.appendChild(fuellung); text.appendChild(spur);
        zeile.appendChild(text);
        var b = button(traegt ? 'Getragen' : da ? 'Tragen' : 'Noch nicht', function () { run('titel_waehlen', { titel: t.id }, 'shop'); }, 'gm-button');
        b.disabled = traegt || !da || c.busy();
        zeile.appendChild(b); liste.appendChild(zeile);
      });
      drawer.appendChild(liste);
      if (s.titel) { var ab = button('Titel ablegen', function () { run('titel_waehlen', { titel: null }, 'shop'); }, 'gm-button gm-secondary'); ab.disabled = c.busy(); drawer.appendChild(ab); }
    }
    /* Ruestung und Schliff: beides haengt an den Runen aus den Dungeons. */
    function ruestungTeil(s) {
      drawer.appendChild(el('h3', 'Rüstung'));
      drawer.appendChild(el('p', 'Fundstücke aus den Dungeons. Sie dämpfen, was ein Gehstock im Waffenduell anrichtet - gegen Mons helfen sie nicht.'));
      var besitz = s.ruestungen || [];
      if (!besitz.length) drawer.appendChild(el('p', 'Noch keins. Wer einen Dungeonboss zum ersten Mal legt, nimmt seins mit.'));
      var raster = el('div', undefined, 'gm-shop-grid');
      X.RUESTUNGEN.forEach(function (teil) {
        var hat = besitz.indexOf(teil.id) >= 0, an = s.panzer === teil.id;
        var karte = el('article', undefined, 'gm-shop-card');
        karte.appendChild(el('h3', teil.name));
        karte.appendChild(el('p', teil.schutz + ' % weniger Schaden' + (hat ? '' : ' · aus ' + (X.DUNGEONS.find(function (d) { return d.id === teil.von; }) || {}).name)));
        var b = button(an ? 'Getragen' : hat ? 'Anlegen' : 'Noch nicht gefunden',
          function () { run('panzer_anlegen', { itemId: teil.id }, 'shop'); }, 'gm-button');
        b.disabled = an || !hat;
        karte.appendChild(b); raster.appendChild(karte);
      });
      drawer.appendChild(raster);
    }

    function run(op,data,view){var request=c.request(op,data);if(duel)showDuel();request.then(function(res){c.apply(res);if(res.arena&&res.arena.phase!=='finished')c.arena(res.arena,true);else if(res.duel)showDuel();else if(view==='shop')shop();else if(view==='adventure')adventure();else if(view==='leuchtturm')zeigeLeuchtturm();else if(view==='zerhacker')zeigeZerhacker();else if(view==='woche')zeigeWoche();else c.closeCombat();if(res.message)c.notify(res.message);}).catch(function(error){c.error(error);if(duel)showDuel();});}
    function approach(e){e=Object.assign({},e,X.encounterPosition(e,c.now()));c.closeDrawer();var w=c.world();if(w&&w.walkToPoint)w.walkToPoint(e);c.notify('Du läufst zu '+e.name+'. Tippe dort erneut auf die Begegnung.');}
    function encounter(e){var live=X.encounterPosition(e,c.now());e=Object.assign({},e,live);if(!c.open(e.name,'encounter'))return;var s=state(),at=c.world().position(),near=Math.hypot(at.x-e.x,at.z-e.z)<8;
      if(e.kind==='trainer'){drawer.appendChild(player('trainermeister','gehstock'));drawer.appendChild(el('p',(c.state().progress&&c.state().progress.trainerWins>=3?(e.id.split(':')[1]==='1'?'Wandertrainer Bo stellt sich auf deine Truppe ein und tritt gleich stark an.':'Trainerin Mira stellt sich auf deine Truppe ein und bleibt etwas darunter.'):'Ein freundliches Training gegen einfache Mons.')+' Ein Sieg bringt 1 Ei und 25 Gold. Du verlierst bei einer Niederlage nichts.'));}
      else {var runenBild=R.symbol&&R.symbol('rune','gm-waren-bild');if(runenBild)drawer.appendChild(runenBild);drawer.appendChild(el('p','Diese Rune bringt eine gewöhnliche Rune und 10 Gold und zählt für die Quest Runensuche. Nach sechs gesammelten schaltet sie den Runensucher-Skin frei.'));}
      drawer.appendChild(el('p','Ort: '+D.FELDER[e.territoryId-1].biom+' · Zwei Wandertrainer ziehen stündlich weiter.'));
      drawer.appendChild(button(near?(e.kind==='trainer'?'Training starten':'Rune einsammeln'):'Hingehen',function(){if(!near){approach(e);return;}run(e.kind==='trainer'?'trainer_start':'gather',{encounterId:e.id,squad:s.truppe},'adventure');},'gm-button gm-primary'));
    }
    /* Streifzuege: was unterwegs ist, was zurueck ist, und ein neuer Auftrag. */
    function streifzugTeil(){
      var s=state(),zuege=s.streifzuege||[],jetzt=c.now(),gebiete=(s.geschafft||[]).length;
      var kopf=el('h3','Streifzüge'),sym=R.symbol&&R.symbol('streifzug','gm-titel-symbol');if(sym)kopf.insertBefore(sym,kopf.firstChild);drawer.appendChild(kopf);
      drawer.appendChild(el('p','Mons, die nirgends Dienst tun, ziehen für dich los - die Zeit läuft nur, während die Insel offen ist. Die passende Rolle bringt die Hälfte mehr.','gm-plan-hinweis'));
      zuege.forEach(function(z){
        var mon=D.mon(z.monId),ziel=X.streifzugZiel(z.ziel),da=z.fertigAt<=jetzt,karte=el('article',undefined,'gm-quest-card gm-streifzug');
        karte.appendChild(el('h3',(mon?mon.name:'?')+' · '+(ziel?ziel.name:'')));
        karte.appendChild(el('p',da?'Zurück - die Beute wartet.':'Unterwegs, zurück '+X.uhrText(z.fertigAt,jetzt)+'.'));
        var b=button(da?'Beute abholen':'Unterwegs',function(){run('streifzug_abholen',{streifzugId:z.id},'adventure');},'gm-button gm-primary');
        b.disabled=!da||c.busy();karte.appendChild(b);drawer.appendChild(karte);
      });
      if(zuege.length>=X.STREIFZUG_PLAETZE)return;
      var frei=s.besitz.filter(function(id){return !!D.mon(id)&&!X.einsatzOrte(s,id).length;})
        .sort(function(a,b){var x=D.mon(a),y=D.mon(b);return x.typ-y.typ||y.seltenheit-x.seltenheit||x.name.localeCompare(y.name,'de');});
      if(!frei.length){drawer.appendChild(el('p','Gerade tun alle deine Mons Dienst. Wer weder im Kampfteam noch auf einem Posten steht, kann losziehen.'));return;}
      var neu=el('article',undefined,'gm-quest-card gm-streifzug');
      neu.appendChild(el('h3','Neuer Streifzug · '+(X.STREIFZUG_PLAETZE-zuege.length)+' frei'));
      var monWahl=el('select'),dauerWahl=el('select'),ziele=el('div',undefined,'gm-streifzug-ziele');
      monWahl.setAttribute('aria-label','Mon für den Streifzug');dauerWahl.setAttribute('aria-label','Dauer des Streifzugs');
      var ROLLEN=['Wall','Schneide','Pfleger','Störer'];
      frei.forEach(function(id){var k=D.mon(id),o=el('option',k.name+' · '+ROLLEN[k.typ]+' · '+D.SELTENHEITEN[k.seltenheit].name);o.value=id;monWahl.appendChild(o);});
      /* Das Wetter der Woche: Rueckenwind kuerzt den Weg, Runenregen fuellt die Taschen. */
      var eff=(projekte&&projekte.insel&&projekte.insel.effekte)||{},wegFaktor=eff.streifzugDauer||1,runenFaktor=eff.streifzugRunen||1;
      X.STREIFZUG_DAUERN.forEach(function(d){var o=el('option',d+' Min. · zurück '+X.uhrText(R.zeiten.productionAt(R.zeiten.openTime(jetzt)+Math.round(d*wegFaktor)*60000),jetzt));o.value=String(d);dauerWahl.appendChild(o);});
      monWahl.value=frei[0];dauerWahl.value='90';
      function zieleZeigen(){
        SG.ui.clear(ziele);var mon=X.mon(s,monWahl.value),dauer=Number(dauerWahl.value);
        X.STREIFZUG_ZIELE.forEach(function(ziel){
          var v=X.streifzugVorschau(mon,ziel.id,dauer,gebiete,runenFaktor);if(!v)return;
          var was=ziel.id==='runen'?(v.runen>=1?'~'+String(Math.round(v.runen*10)/10).replace('.',',')+' '+D.SELTENHEITEN[v.runenRang].name+'-Runen':Math.round(v.runen*100)+' % auf eine '+D.SELTENHEITEN[v.runenRang].name+'-Rune')
            :ziel.id==='waren'?v.gold+' Gold':Math.round(v.ei*100)+' % auf ein Ei';
          var b=button((v.passt?'★ ':'')+ziel.name+' · '+was,function(){run('streifzug_start',{monId:monWahl.value,ziel:ziel.id,dauer:dauer},'adventure');},'gm-button'+(v.passt?' gm-primary':''));
          b.disabled=c.busy();ziele.appendChild(b);
        });
      }
      monWahl.addEventListener('change',zieleZeigen);dauerWahl.addEventListener('change',zieleZeigen);
      var zeile=el('div',undefined,'gm-plan-row');zeile.appendChild(monWahl);zeile.appendChild(dauerWahl);
      neu.appendChild(zeile);neu.appendChild(ziele);zieleZeigen();
      if(gebiete)neu.appendChild(el('p','Mit '+gebiete+(gebiete===1?' Gebiet':' Gebieten')+' bringt Waren tragen '+(gebiete<=2?'die Hälfte':'ein Viertel')+' - wer kein Land hat, braucht das Gold dringender.','gm-plan-hinweis'));
      drawer.appendChild(neu);
    }
    function adventure(){if(!c.open('Abenteuer & Quests','adventure'))return;var s=state();drawer.appendChild(el('p','Starte mit Trainerkämpfen und der Tauwiese in den Blütenauen. Trainer schenken dir Eier; stärkere Mons helfen beim Erobern.','gm-beginner-tip'));
      streifzugTeil();
      drawer.appendChild(button('Aktuelles Biom erkunden',function(){run('survey',{},'adventure');},'gm-button gm-primary'));
      drawer.appendChild(el('h3','In deiner Nähe'));var at=c.world().position();encounters.slice().sort(function(a,b){return Math.hypot(a.x-at.x,a.z-at.z)-Math.hypot(b.x-at.x,b.z-at.z);}).forEach(function(e){var sym=R.symbol&&R.symbol(e.kind==='trainer'?'trainer':'rune'),b=button((sym?'':e.kind==='trainer'?'⚔ ':'✦ ')+e.name+' · '+Math.round(Math.hypot(e.x-at.x,e.z-at.z))+' m',function(){encounter(e);},'gm-button gm-mit-symbol');if(sym)b.insertBefore(sym,b.firstChild);drawer.appendChild(b);});
      drawer.appendChild(el('h3','Deine Quests'));X.QUESTS.forEach(function(q){var done=s.claimedQuests.indexOf(q.id)>=0,n=Math.min(q.goal,X.progress(s,q)),card=el('article',undefined,'gm-quest-card');card.appendChild(el('h3',q.name));card.appendChild(el('p',({trainerWins:'Trainingssiege',visited:'Biome erkundet',gathered:'Runen gesammelt',hatched:'Eier ausgebrütet',upgrades:'Außenposten ausgebaut'}[q.stat])+' · '+n+'/'+q.goal));card.appendChild(SG.ui.el('progress',{value:n,max:q.goal,'aria-label':q.name}));card.appendChild(el('p',q.skin?'Skin: '+X.skin(q.skin).name:q.gold+' Gold'));var claim=button(done?'Erhalten':'Belohnung abholen',function(){run('quest_claim',{questId:q.id},'adventure');},'gm-button gm-primary');claim.disabled=done||n<q.goal;card.appendChild(claim);drawer.appendChild(card);});
    }
    function shop(){if(!c.open('Skins & Waffen','shop'))return;var s=state();drawer.appendChild(el('p',s.gold+' Gold · Skins verändern deine Figur. Waffen bestimmen den Schaden im Waffenduell.'));
      var rang = X.rang(s);
      drawer.appendChild(el('p', 'Trainerrang: ' + rang.name + (rang.naechster
        ? ' · noch ' + (rang.bis - rang.erfahrung) + ' bis ' + rang.naechster : ' · höchster Rang')
        + ' · +' + Math.round((X.rangBonus(s) - 1) * 100) + ' % Schlagkraft'));
      var erst = projekte && projekte.erstschlag, kopf = projekte && projekte.kopfgeld;
      if (erst) drawer.appendChild(el('p', 'Erstschlag der Woche: ' + erst.name
        + (erst.selbst ? ' - das bist du, ein Zehntel mehr Schaden am Zerhacker.' : '.')));
      if (kopf) drawer.appendChild(el('p', kopf.selbst
        ? 'Auf dich liegt ein Kopfgeld von ' + kopf.gold + ' Gold - du hältst die meisten Gebiete.'
        : 'Kopfgeld auf ' + kopf.name + ': ' + kopf.gold + ' Gold für den, der ihn im Überfall schlägt.'));
      titelTeil(s);
      ruestungTeil(s);
      [['skin','Skins',X.SKINS],['weapon','Waffen',X.WEAPONS]].forEach(function(section){drawer.appendChild(el('h3',section[1]));var grid=el('div',undefined,'gm-shop-grid');section[2].forEach(function(item){var kind=section[0],own=s[kind==='skin'?'skins':'weapons'].indexOf(item.id)>=0,equipped=s[kind]===item.id,card=el('article',undefined,'gm-shop-card');card.appendChild(player(kind==='skin'?item.id:s.skin,kind==='weapon'?item.id:s.weapon));card.appendChild(el('h3',item.name));card.appendChild(el('p',kind==='weapon'?item.attack+' Waffenschaden':item.quest?'Quest: '+X.QUESTS.find(function(q){return q.id===item.quest;}).name:'Für Gold freischalten'));var b=button(equipped?'Ausgerüstet':own?'Ausrüsten':item.quest?'Durch Quest erhältlich':item.price+' Gold',function(){run(own?'equip':'shop_buy',{kind:kind,itemId:item.id},'shop');},'gm-button gm-primary');b.disabled=equipped||!own&&(!!item.quest||s.gold<item.price);card.appendChild(b);
        if(kind==='weapon'&&own){var stufe=X.schliff(s,item.id),kosten=X.schliffKosten(stufe),voll=stufe>=X.SCHLIFF_LIMIT;
          card.appendChild(el('p','Schliff '+stufe+'/'+X.SCHLIFF_LIMIT+' · '+X.waffenWert(s,item.id)+' Schaden'));
          var sb=button(voll?'Voll geschliffen':'Schleifen ('+kosten+' einfache Runen)',function(){run('waffe_schleifen',{itemId:item.id},'shop');},'gm-button');
          sb.disabled=voll||(s.runes&&s.runes[0]||0)<kosten;card.appendChild(sb);}grid.appendChild(card);});drawer.appendChild(grid);});
    }
    function rival(peer){if(!c.open(peer.name,'rival'))return;var s=state(),at=c.world().position(),near=Math.hypot(at.x-peer.x,at.z-peer.z)<8;drawer.appendChild(player(peer.skin,peer.weapon));
      fehdeTeil(peer);if(peer.titel)drawer.appendChild(el('p','🏅 '+peer.titel,'gm-peer-titel-zeile'));drawer.appendChild(el('p',X.skin(peer.skin).name+' · '+X.weapon(peer.weapon).name));
      /* Das Live-Duell: Kampfteam gegen Kampfteam, Zug um Zug - verlieren kann man dabei nichts. */
      if(c.duell){var fordern=button('⚔ Zum Live-Duell fordern',function(){c.closeDrawer();c.duell(peer);},'gm-button gm-primary');fordern.disabled=c.busy()||peer.activity==='arena';drawer.appendChild(fordern);drawer.appendChild(el('p','Beide Kampfteams gegeneinander, beide wählen gleichzeitig. Sieg: +'+X.DUELL.lohn.sieg+' Gold und +'+X.DUELL.ruhm+' Ruhm. Niemand verliert Mons oder Eier. Gold gibt es ab der '+X.DUELL.lohnAbRunde+'. Runde und für höchstens '+X.DUELL.lohnJePaar+' Duelle am Tag gegen denselben Gegner.','gm-plan-hinweis'));}drawer.appendChild(el('p','Überfall in zwei Stufen: Besiege die gespeicherte Waffenverteidigung, danach die Mon-Truppe. Bei Erfolg bekommst du genau ein getragenes oder brütendes Ei. Der Besitzer muss dabei keine Züge eingeben.'));
      var protection=!!peer.protected,ohneEi=peer.eier===0,pause=s.raidCooldown>c.now();
      drawer.appendChild(el('p',protection?'Dieser Spieler steht nach einem Diebstahl zwei Stunden unter Schutz.'
        :ohneEi?'Dieser Spieler trägt gerade kein Ei. Ohne Ei gibt es nichts zu holen.'
        :pause?'Dein nächster Überfall ist in '+Math.ceil((s.raidCooldown-c.now())/60000)+' Minuten möglich.'
        :'Alle 30 Minuten kannst du jemanden überfallen, der Eier trägt. Nach einem Diebstahl hat das Opfer zwei Stunden Ruhe.'));
      var b=button(near?'Überfall beginnen':'Zum Spieler gehen',function(){if(!near){approach(peer);return;}run('raid_start',{targetId:peer.id});},'gm-button gm-primary');b.disabled=protection||ohneEi||peer.activity==='arena'||pause;drawer.appendChild(b);
    }
    function showDuel(){if(dungeons.active()){dungeons.show();return;}if(!duel)return;c.openCombat();var box=c.arenaBox;SG.ui.clear(box);box.className='gm-arena gm-duel';var head=el('header',undefined,'gm-arena-header');head.appendChild(el('div','ÜBERFALL · STUFE 1 VON 2','gm-eyebrow'));head.appendChild(el('strong','Waffenduell · '+duel.targetName));box.appendChild(head);var scene=el('div',undefined,'gm-duel-scene');[[duel.hp,state().skin,duel.weapon,'Du'],[duel.enemyHp,duel.enemySkin,duel.enemyWeapon,duel.targetName]].forEach(function(v){var card=el('div',undefined,'gm-duel-fighter');card.appendChild(el('h3',v[3]));card.appendChild(player(v[1],v[2]));card.appendChild(el('p',X.weapon(v[2]).name+' · '+v[0]+'/100 KP'));card.appendChild(SG.ui.el('progress',{value:v[0],max:100,'aria-label':v[3]+' Lebenspunkte'}));scene.appendChild(card);});box.appendChild(scene);
      var panel=el('div',undefined,'gm-arena-panel');panel.appendChild(el('p',duel.message,'gm-arena-line'));panel.appendChild(el('small','Gegen die gespeicherte Verteidigung · Ein Überfall läuft nach 10 Minuten ab.'));
      if(duel.phase==='choose'){var moves=el('div',undefined,'gm-moves');[['strike','Schneller Hieb','Sicherer Treffer'],['heavy','Kraftschlag','Hoher Schaden'],['guard','Parieren','Weniger Schaden, starke Deckung']].forEach(function(v){var b=button('',function(){run('raid_turn',{duelId:duel.id,revision:duel.revision,move:v[0]});},'gm-move');b.appendChild(el('strong',v[1]));b.appendChild(el('span',v[2]));b.disabled=c.busy();moves.appendChild(b);});panel.appendChild(moves);}
      if(duel.phase==='won'){var next=button('Stufe 2: Mon-Kampf starten',function(){run('raid_arena',{squad:state().truppe});},'gm-button gm-primary');next.disabled=c.busy();panel.appendChild(next);}
      var cancel=button('Zurück zur Karte',function(){run('raid_cancel',{});},'gm-button gm-secondary');cancel.disabled=c.busy();panel.appendChild(cancel);var retry=button('Duellstand prüfen',function(){c.resume();},'gm-button');retry.disabled=c.busy();panel.appendChild(retry);box.appendChild(panel);
    }
    return{dungeons:dungeons.menu,dungeonActive:dungeons.active,adventure:adventure,shop:shop,rival:rival,showDuel:showDuel,kurier:handel.kurier,markthalle:handel.markthalle,bilanz:handel.bilanz,wetter:insel.wetter,active:function(){return dungeons.active()||!!duel&&duel.phase!=='arena';},clear:function(){duel=null;dungeons.clear();handel.clear();},
      refresh:function(view){if(view==='dungeons')dungeons.menu();if(view==='shop')shop();if(view==='adventure')adventure();if(view==='kurier')handel.kurier();if(view==='markthalle')handel.markthalle();if(view==='bilanz')handel.bilanz();if(view==='wetter')insel.wetter();},
      apply:function(res){dungeons.apply(res);handel.apply(res);insel.apply(res);duel=res.duel||null;encounters=res.encounters||[];projekte=res;if(c.world()&&c.world().setProjekte)c.world().setProjekte(res);zeigeProjekte();if(c.world()&&c.world().setEncounters)c.world().setEncounters(encounters,res.serverTime);pins.forEach(function(p){p.node.remove();});pins=encounters.map(function(e){var sym=e.kind==='rune'&&R.symbol&&R.symbol('rune','gm-pin-symbol'),node=button(sym?'':e.kind==='trainer'?'⚔':'✦',function(){encounter(e);},'gm-encounter-pin '+e.kind+(sym?' gm-mit-symbol':''));if(sym)node.appendChild(sym);node.title=e.name;node.setAttribute('aria-label',e.name);node.appendChild(el('span',e.name));c.layer.appendChild(node);return{node:node,e:e};});},
      frame:function(project,hidden,overview){dungeons.frame(project,hidden,overview);handel.frame(project,hidden,overview);pins.forEach(function(p){var at=X.encounterPosition(p.e,c.now()),point=project({x:at.x,z:at.z,y:p.e.kind==='trainer'?4.7:1.5});p.node.hidden=hidden||!point.visible||!point.near&&!overview;p.node.style.transform='translate('+point.x+'px,'+point.y+'px) translate(-50%,-100%)';});}
    };
  };
})(SG);
