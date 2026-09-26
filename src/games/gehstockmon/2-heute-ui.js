/* ------------------------------------------------------------------
   Heute auf der Insel: die drei Tagesaufgaben, die Tagestruhe mit der
   Serie - und der Insel-Ticker, der allen zeigt, was gerade passiert.

   Der Ticker kommt mit jeder Antwort des Servers mit (auch mit der
   Abfrage alle dreissig Sekunden) - er braucht keine eigene Anfrage.
   ------------------------------------------------------------------ */
(function (SG) {
  var R = SG.gehstockmon, D = R.daten;
  R.mountHeute = function (c) {
    var el = c.el, button = c.button, drawer = c.drawer, stand = null, ticker = [], gesehen = null, toastTimer = null;
    var toast = el('div', undefined, 'gm-ticker-toast');toast.hidden = true;toast.setAttribute('role', 'status');c.root.appendChild(toast);

    function vorWann(t) {
      var min = Math.max(0, Math.round((c.now() - t) / 60000));
      return min < 1 ? 'gerade eben' : min < 60 ? 'vor ' + min + ' Min.' : 'vor ' + Math.floor(min / 60) + ' Std.';
    }
    function tickerTeil() {
      drawer.appendChild(el('h3', 'Auf der Insel'));
      if (!ticker.length) { drawer.appendChild(el('p', 'Noch ist nichts passiert. Das ändert sich gleich.', 'gm-plan-hinweis')); return; }
      var liste = el('ol', undefined, 'gm-ticker-liste');
      ticker.slice().reverse().forEach(function (e) {
        var zeile = el('li', undefined, 'gm-ticker-' + e.art);
        zeile.appendChild(el('span', e.text));zeile.appendChild(el('small', vorWann(e.t)));
        liste.appendChild(zeile);
      });
      drawer.appendChild(liste);
    }
    function zeigen() {
      if (!stand || !c.open('Heute auf der Insel', 'heute')) return;
      var serie = stand.serie;
      drawer.appendChild(el('p', serie ? '🔥 Serie: ' + serie + (serie === 1 ? ' Schultag' : ' Schultage') + ' am Stück.' : 'Noch keine Serie. Öffne heute die Truhe, dann beginnt sie.', 'gm-heute-serie'));
      stand.aufgaben.forEach(function (a) {
        var fertig = a.stand >= a.ziel, karte = el('article', undefined, 'gm-quest-card gm-heute-aufgabe' + (fertig ? ' erledigt' : ''));
        karte.appendChild(el('h3', (fertig ? '✓ ' : '') + a.text));
        karte.appendChild(el('p', a.stand + ' / ' + a.ziel));
        karte.appendChild(SG.ui.el('progress', { value: a.stand, max: a.ziel, 'aria-label': a.text }));
        drawer.appendChild(karte);
      });
      var lohn = stand.lohn, ei = lohn.eiMindestens ? 'ein Ei, garantiert ' + D.SELTENHEITEN[lohn.eiMindestens].name + ' oder besser' : 'ein Ei';
      var truhe = button(stand.truhe ? '🎁 Heute schon geöffnet' : stand.fertig ? '🎁 Tagestruhe öffnen · +' + lohn.gold + ' Gold und ' + ei : '🎁 Tagestruhe · erst alle drei Aufgaben', function () {
        c.request('tagestruhe', {}).then(function (res) { c.apply(res); zeigen(); if (res.message) c.notify(res.message); if (c.sfx) c.sfx('win'); }).catch(c.error);
      }, 'gm-button gm-primary gm-heute-truhe');
      truhe.disabled = c.busy() || stand.truhe || !stand.fertig;
      drawer.appendChild(truhe);
      if (stand.naechstesEi) drawer.appendChild(el('p', 'Tag ' + stand.naechstesEi.tag + ' deiner Serie: ein Ei, garantiert ' + D.SELTENHEITEN[stand.naechstesEi.mindestens].name + ' oder besser.', 'gm-plan-hinweis'));
      drawer.appendChild(el('p', 'Die Aufgaben gelten für alle gleich und wechseln jeden Schultag. Das Wochenende unterbricht die Serie nicht, ein verpasster Schultag schon.', 'gm-chancen-fuss'));
      tickerTeil();
    }
    /* Neues im Ticker kurz einblenden - aber nicht beim ersten Laden (sonst
       prasselt alles von heute auf einmal herein) und nicht, was man selbst
       gerade getan hat. */
    function neuesZeigen(liste) {
      var hoechste = liste.reduce(function (m, e) { return Math.max(m, e.id); }, 0);
      if (gesehen === null || hoechste < gesehen) { gesehen = hoechste; return; }
      var neu = liste.filter(function (e) { return e.id > gesehen && e.wer !== c.playerId(); });
      gesehen = hoechste;
      if (!neu.length) return;
      var e = neu[neu.length - 1];
      toast.textContent = e.text + (neu.length > 1 ? '  (+' + (neu.length - 1) + ')' : '');
      toast.hidden = false;toast.classList.remove('gm-ticker-an');void toast.offsetWidth;toast.classList.add('gm-ticker-an');
      if (toastTimer) c.cancel(toastTimer);
      toastTimer = c.after(function () { toast.hidden = true; }, 6500);
    }
    return {
      zeigen: zeigen,
      apply: function (res) {
        if (!res) return;
        if (res.alltag) stand = res.alltag;
        if (Array.isArray(res.ticker)) { ticker = res.ticker; neuesZeigen(ticker); }
      },
      stand: function () { return stand; },
      refresh: function (view) { if (view === 'heute') zeigen(); }
    };
  };
})(SG);
