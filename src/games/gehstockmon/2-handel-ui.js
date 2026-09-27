/* Handel und Gemeinschaft im Browser: das Kurierkontor, die Markthalle und
   die Wochenbilanz. Die Regeln stehen in 2-handel.js und 1-wirtschaft.js,
   eingehaengt wird das Ganze von 2-abenteuer-ui.js (wie die Dungeons). */
(function (SG) {
  var R = SG.gehstockmon, D = R.daten, E = R.wirtschaft, X = R.abenteuer;
  R.mountHandel = function (c) {
    var el = c.el, button = c.button, drawer = c.drawer, handel = null, territories = [], pin = null;
    function state() { return c.state(); }
    function titel(text, bild) { var h = el('h3', text), sym = R.symbol && R.symbol(bild, 'gm-titel-symbol'); if (sym) h.insertBefore(sym, h.firstChild); return h; }
    function zahl(n) { return Math.round(n || 0).toLocaleString('de-DE'); }
    function wartetext(ms) { var m = Math.ceil((ms || 0) / 60000); return m <= 90 ? 'in ' + Math.max(1, m) + ' Minuten' : 'wenn die Insel wieder öffnet'; }
    function frist(ms) { var s = Math.max(0, Math.ceil(ms / 1000)); return s >= 60 ? Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') + ' Min.' : s + ' Sek.'; }
    function ort(o) { return X.kurierOrt(X.layout(territories), o); }
    function position() { var w = c.world(); return w && w.position ? w.position() : null; }
    /* Etwas enger als der Server (14): die gemeldete Position hinkt ein wenig hinterher. */
    function amOrt(o) {
      var p = position(); if (!p) return false;
      if (!o) return X.inStadt(p);
      var t = ort(o); return !!t && Math.hypot(p.x - t.x, p.z - t.z) <= X.KURIER_NAEHE - 3;
    }
    function hinlaufen(o) {
      c.closeDrawer(); var w = c.world(), t = ort(o);
      if (w && w.walkToPoint && t) w.walkToPoint(t);
      c.notify('Deine Figur läuft ' + (o ? 'vor das Tor von ' + X.kurierOrtName(o) : 'nach ' + X.STADT.name) + '.');
    }
    function run(op, data, view) {
      c.request(op, data).then(function (res) {
        c.apply(res); if (view === 'kurier') kurier(); else if (view === 'markthalle') markthalle(); else c.closeDrawer();
        if (res.message) c.notify(res.message);
      }).catch(function (error) { c.error(error); });
    }
    function aktuellerBau() {
      var liste = (handel && handel.bauten) || [];
      return liste.find(function (b) { return !b.fertig; }) || liste[liste.length - 1] || null;
    }

    /* ---------------- Kurierkontor ---------------- */
    function kurier() {
      if (!c.open('Kurierkontor', 'kurier')) return;
      var s = state(), k = s.kurier, brett = s.kurierBrett || [], gebiete = (s.geschafft || []).length, jetzt = c.now();
      drawer.appendChild(el('p', 'Im Kontor von ' + X.STADT.name + ' warten Pakete für die Außenposten der Insel: abholen, vor das Tor tragen, Gold kassieren. Jede geöffnete Stunde kommt ein Auftrag dazu, bis zu ' + X.KURIER_VORRAT + ' liegen bereit.', 'gm-beginner-tip'));
      if (k) {
        var paket = el('article', undefined, 'gm-quest-card gm-kurier-paket'), eil = !!(k.eilig && k.frist && jetzt <= k.frist);
        paket.appendChild(el('h3', '📦 ' + k.ware + ' → ' + X.kurierOrtName(k.nach)));
        paket.appendChild(el('p', 'Beim Abliefern: ' + X.kurierBetrag(k, gebiete, eil) + ' Gold'
          + (k.eilig ? (eil ? ' mit Eilzuschlag - noch ' + frist(k.frist - jetzt) : ' (die Eilfrist ist vorbei, der normale Lohn gilt)') : '') + '.'));
        var da = amOrt(k.nach);
        var ab = button(da ? 'Abliefern' : 'Zum Tor von ' + X.kurierOrtName(k.nach), function () {
          if (!amOrt(k.nach)) { hinlaufen(k.nach); return; } run('kurier_abliefern', {}, null);
        }, 'gm-button gm-primary');
        ab.disabled = c.busy(); paket.appendChild(ab);
        var zurueck = button('Zurückgeben', function () { run('kurier_abbrechen', {}, 'kurier'); }, 'gm-button gm-secondary');
        zurueck.disabled = c.busy(); paket.appendChild(zurueck);
        drawer.appendChild(paket);
      }
      drawer.appendChild(titel('Aufträge · ' + brett.length + '/' + X.KURIER_VORRAT, 'kurier'));
      var info = handel && handel.kurier;
      drawer.appendChild(el('p', brett.length >= X.KURIER_VORRAT ? 'Der Stapel ist voll. Der nächste Auftrag kommt erst, wenn du einen annimmst.'
        : 'Der nächste Auftrag kommt ' + wartetext(info && info.naechsterIn) + '.', 'gm-plan-hinweis'));
      if (!brett.length) drawer.appendChild(el('p', 'Gerade liegt nichts bereit.'));
      brett.forEach(function (a) {
        var karte = el('article', undefined, 'gm-quest-card gm-kurier-auftrag' + (a.eilig ? ' eilig' : ''));
        var kopf = el('h3', (a.eilig && !(R.symbol && SG.assets['gm-icon-eilbote']) ? '⚡ ' : '') + a.ware + ': ' + X.kurierOrtName(a.von) + ' → ' + X.kurierOrtName(a.nach)), eilSym = a.eilig && R.symbol && R.symbol('eilbote', 'gm-titel-symbol');
        if (eilSym) { eilSym.title = 'eilig'; kopf.insertBefore(eilSym, kopf.firstChild); }
        karte.appendChild(kopf);
        karte.appendChild(el('p', X.kurierBetrag(a, gebiete, false) + ' Gold'
          + (a.eilig ? ' · ' + X.kurierBetrag(a, gebiete, true) + ' in der Eilfrist (' + frist(X.kurierFrist(a)) + ')' : '')
          + ' · ' + X.kurierWeg(a.von, a.nach) + ' Schritte' + (a.von ? ' · Abholung vor dem Tor' : '')));
        var hier = amOrt(a.von);
        var b = button(k ? 'Erst das Paket abliefern' : hier ? 'Aufladen' : a.von ? 'Zum Tor von ' + X.kurierOrtName(a.von) : 'Nach ' + X.STADT.name + ' laufen', function () {
          if (!amOrt(a.von)) { hinZumAuftrag(a); return; } run('kurier_annehmen', { auftragId: a.id }, null);
        }, 'gm-button' + (hier && !k ? ' gm-primary' : ''));
        b.disabled = c.busy() || !!k; karte.appendChild(b); drawer.appendChild(karte);
      });
      if (gebiete) drawer.appendChild(el('p', 'Mit ' + gebiete + (gebiete === 1 ? ' Gebiet' : ' Gebieten') + ' zahlt das Kontor ' + (gebiete <= 2 ? 'die Hälfte' : 'ein Viertel') + ' - wer kein Land hat, braucht das Gold dringender.', 'gm-plan-hinweis'));
      drawer.appendChild(el('p', 'Abgeliefert: ' + (s.kurierGesamt || 0) + ' Pakete. Ab ' + X.TITEL.find(function (t) { return t.id === 'eilbote'; }).ziel + ' trägst du den Titel Eilbote.', 'gm-plan-hinweis'));
    }

    /* ---------------- Markthalle ---------------- */
    function markthalle() {
      var bau = aktuellerBau(); if (!bau || !c.open(bau.name, 'markthalle')) return;
      if (bau.fertig) {
        drawer.appendChild(el('p', 'Die ' + bau.name + ' steht. ' + bau.was + ' Du findest den Handel beim Händler in ' + X.STADT.name + '.'));
        if (!handel.abgabe) drawer.appendChild(el('p', 'Solange die Insel an nichts Neuem baut, ruht die Gebietsabgabe.', 'gm-plan-hinweis'));
      } else {
        drawer.appendChild(el('p', 'Nach dem Leuchtturm baut die Insel eine ' + bau.name + '. ' + bau.was));
        drawer.appendChild(el('p', 'Jeder kann Gold beisteuern und steht dafür auf der Tafel.'));
        drawer.appendChild(titel('Die Gebietsabgabe', 'abgabe'));
        drawer.appendChild(el('p', 'Wer Gebiete hält, zahlt ' + Math.round(E.ABGABE * 100) + ' % seines Gebietsgolds hinein, solange gebaut wird - Stundenertrag und Tagesgeld. Steht die Halle, ruht die Abgabe.'));
        drawer.appendChild(el('p', zahl(bau.gold) + ' von ' + zahl(bau.ziel) + ' Gold verbaut · davon ' + zahl(bau.abgabe) + ' aus der Gebietsabgabe'
          + (bau.eigen ? ' · deine Spenden: ' + zahl(bau.eigen) : '')));
        var spur = el('span', undefined, 'gm-projekt-spur gm-bau-spur'), fuellung = el('i');
        fuellung.style.width = Math.round(100 * bau.gold / bau.ziel) + '%'; fuellung.style.background = '#8fd18a';
        spur.appendChild(fuellung); drawer.appendChild(spur);
        var s = state(), reihe = el('div', undefined, 'gm-bau-knoepfe');
        [50, 250, 1000].forEach(function (betrag) {
          var b = button(betrag + ' Gold geben', function () { run('bau_spenden', { bauId: bau.id, betrag: betrag }, 'markthalle'); }, 'gm-button');
          b.disabled = c.busy() || s.gold < betrag; reihe.appendChild(b);
        });
        drawer.appendChild(reihe);
      }
      drawer.appendChild(el('h3', 'Die Tafel am Eingang'));
      var liste = el('ol', undefined, 'gm-tafel');
      (bau.tafel || []).forEach(function (v) { var z = el('li', v.name + ' · ' + zahl(v.wert) + ' Gold'); if (v.selbst) z.className = 'gm-selbst'; liste.appendChild(z); });
      if (!(bau.tafel || []).length) liste.appendChild(el('li', 'Noch leer - der erste Name steht ganz oben.'));
      drawer.appendChild(liste);
    }

    /* ---------------- Wochenbilanz ---------------- */
    function summe(seite) { return Object.keys(seite || {}).reduce(function (n, k) { return n + seite[k]; }, 0); }
    function tabelle(name, seite, namen, farbe) {
      var schluessel = Object.keys(seite || {}).filter(function (k) { return seite[k] > 0; }).sort(function (a, b) { return seite[b] - seite[a]; });
      drawer.appendChild(el('h4', name + ' · ' + zahl(summe(seite)) + ' Gold', 'gm-bilanz-kopf'));
      if (!schluessel.length) { drawer.appendChild(el('p', 'Noch nichts.', 'gm-plan-hinweis')); return; }
      var groesster = seite[schluessel[0]], liste = el('div', undefined, 'gm-bilanz');
      schluessel.forEach(function (k) {
        var zeile = el('div', undefined, 'gm-bilanz-zeile');
        zeile.appendChild(el('span', namen[k] || k));
        var spur = el('span', undefined, 'gm-bilanz-spur'), balken = el('i');
        balken.style.width = Math.max(3, Math.round(100 * seite[k] / groesster)) + '%'; balken.style.background = farbe;
        spur.appendChild(balken); zeile.appendChild(spur);
        zeile.appendChild(el('strong', zahl(seite[k])));
        liste.appendChild(zeile);
      });
      drawer.appendChild(liste);
    }
    function woche(ueberschrift, b) {
      var saldo = summe(b.rein) - summe(b.raus);
      drawer.appendChild(el('h3', ueberschrift + ' · ' + (saldo >= 0 ? '+' : '−') + zahl(Math.abs(saldo)) + ' Gold'));
      tabelle('Eingenommen', b.rein, E.BILANZ_REIN, '#81d2a3');
      tabelle('Ausgegeben', b.raus, E.BILANZ_RAUS, '#f2705a');
    }
    function bilanz() {
      if (!c.open('Wochenbilanz', 'bilanz')) return;
      var sicht = E.bilanzSicht(state(), c.now());
      drawer.appendChild(el('p', 'Woher dein Gold diese Woche kam und wofür es ging. Die Woche beginnt am Montag; die vorige bleibt zum Vergleich stehen.', 'gm-beginner-tip'));
      woche('Diese Woche', sicht.diese);
      if (sicht.diese.rein.gebiete && handel && handel.abgabe) drawer.appendChild(el('p', 'Beim Gebietsgold steht der volle Ertrag; die Abgabe für den Gemeinschaftsbau ist unter den Ausgaben aufgeführt.', 'gm-plan-hinweis'));
      if (sicht.vorige) woche('Vorige Woche', sicht.vorige);
    }

    /* ---------------- Karte und Projektleiste ---------------- */
    /* Zwei Kacheln fuer die Leiste ueber der Karte - das Kontor steht neben
       den Streifzuegen, der Bau neben dem Leuchtturm. */
    function kacheln(marke, balken) {
      var out = { kurier: null, bau: null }, s = state(), k = s && s.kurier, brett = (s && s.kurierBrett) || [];
      if (k) out.kurier = marke('Kurier', '📦 → ' + X.kurierOrtName(k.nach), '#f0b429', kurier, 'kurier');
      else if (brett.length) out.kurier = marke('Kurier', brett.length + (brett.length === 1 ? ' Auftrag' : ' Aufträge'), '#89cce5', kurier, 'kurier');
      var bau = aktuellerBau();
      if (bau && !bau.fertig) out.bau = balken(bau.name, bau.gold, bau.ziel, '#8fd18a', markthalle, 'markthalle');
      return out;
    }
    /* Die Stecknadel auf der Karte: mit Paket am Ziel, sonst an der Abholung
       des Auftrags, zu dem man gerade laeuft. Wer davorsteht und sie antippt,
       liefert ab oder laedt auf, ohne das Fenster zu oeffnen. */
    var angesteuert = null, gemeldet = null;
    function hinZumAuftrag(a) { angesteuert = a.id; hinlaufen(a.von); }
    function stecknadel() {
      var s = state(), k = s && s.kurier;
      if (k) return { id: 'ab-' + k.id, o: k.nach, text: k.ware + ' → ' + X.kurierOrtName(k.nach), tippen: function () { if (amOrt(k.nach)) run('kurier_abliefern', {}, null); else kurier(); } };
      var a = angesteuert && ((s && s.kurierBrett) || []).find(function (v) { return v.id === angesteuert; });
      if (!a) { angesteuert = null; return null; }
      return { id: 'auf-' + a.id, o: a.von, text: a.ware + ' abholen', tippen: function () { if (amOrt(a.von)) { angesteuert = null; run('kurier_annehmen', { auftragId: a.id }, null); } else kurier(); } };
    }
    function frame(project, hidden) {
      var ziel = stecknadel(), punkt = ziel && ort(ziel.o);
      if (!punkt) { if (pin) { pin.node.remove(); pin = null; } return; }
      if (!pin || pin.id !== ziel.id) {
        if (pin) pin.node.remove();
        var sym = R.symbol && R.symbol('kurier', 'gm-pin-symbol'), node = button(sym ? '' : '📦', function () { if (pin) pin.tippen(); }, 'gm-encounter-pin gm-kurier-pin' + (sym ? ' gm-mit-symbol' : ''));
        if (sym) node.appendChild(sym);
        node.title = ziel.text; node.setAttribute('aria-label', ziel.text);
        node.appendChild(el('span', ziel.text));
        c.layer.appendChild(node); pin = { id: ziel.id, node: node, tippen: ziel.tippen };
      }
      pin.tippen = ziel.tippen;
      /* Das Ziel zeigt sich auch von weitem - es ist der Grund, warum man
         gerade laeuft. Angekommen, sagt eine Meldung, was jetzt zu tun ist. */
      var pt = project({ x: punkt.x, z: punkt.z, y: 4 });
      pin.node.hidden = hidden || !pt.visible;
      pin.node.style.transform = 'translate(' + pt.x + 'px,' + pt.y + 'px) translate(-50%,-100%)';
      pin.node.classList.toggle('gm-kurier-da', amOrt(ziel.o));
      if (!hidden && amOrt(ziel.o) && gemeldet !== ziel.id) {
        gemeldet = ziel.id;
        c.notify(ziel.id.indexOf('ab-') === 0 ? '📦 Du stehst vor dem Tor. Tippe auf das Paket, um abzuliefern.' : '📦 Du bist da. Tippe auf das Paket, um es aufzuladen.');
      }
    }
    /* Stockhafen oeffnet das Kontor ueber diesen Weg, ohne selbst vom
       Abenteuer-Fenster zu wissen. */
    R.kurierOeffnen = kurier;
    return {
      kurier: kurier, markthalle: markthalle, bilanz: bilanz, kacheln: kacheln, frame: frame,
      apply: function (res) { if (res && res.handel) handel = res.handel; if (res && Array.isArray(res.territories)) territories = res.territories; },
      handel: function () { return handel; },
      clear: function () { if (pin) { pin.node.remove(); pin = null; } }
    };
  };
})(SG);
