/* ------------------------------------------------------------------
   Router ueber den Hash. Kein Server noetig, funktioniert auch
   unter file:// in der Dateien-App.
   ------------------------------------------------------------------ */

(function (SG) {
  var UI = SG.ui;

  var R = SG.router = {};
  var app = null;
  var current = null;       // { kind, id, view }
  var suspended = false;

  R.init = function (el) {
    app = el;
    window.addEventListener('hashchange', function () { R.apply(); });
    R.apply();
  };

  R.go = function (hash) {
    if (location.hash === hash) { R.apply(); return; }
    location.hash = hash;
  };

  R.reload = function () { R.apply(true); };

  R.parse = function () {
    var h = (location.hash || '#/').replace(/^#/, '');
    var parts = h.split('/').filter(Boolean);
    if (!parts.length) return { kind: 'hub' };
    if (parts[0] === 'spiel' && parts[1]) return { kind: 'game', id: decodeURIComponent(parts[1]) };
    if (parts[0] === 'offline') return { kind: 'offline' };
    if (parts[0] === 'ueber') return { kind: 'ueber' };
    if (parts[0] === 'kreis') return { kind: 'kreis' };
    if (parts[0] === 'profil') return { kind: 'profil' };
    if (parts[0] === 'adminraum') return { kind: 'adminraum' };
    if (parts[0] === 'bnd') return { kind: 'bnd' };
    if (parts[0] === 'dev') return { kind: 'dev' };
    if (parts[0] === 'flix') return { kind: 'flix' };
    if (parts[0] === 'befragung' && parts[1]) {
      return { kind: 'befragung', id: decodeURIComponent(parts[1]) };
    }
    if (parts[0] === 'verhoer' && parts[1]) {
      return { kind: 'verhoer', id: decodeURIComponent(parts[1]) };
    }
    if (parts[0] === 'meeting' && parts[1]) {
      return { kind: 'meeting', id: decodeURIComponent(parts[1]) };
    }
    return { kind: 'hub' };
  };

  /* Wird beim An- und Abmelden gerufen: die naechste Route muss neu
     aufgebaut werden, sonst bliebe die Ansicht der vorigen Person
     stehen - samt ihrer Rechte. */
  R.invalidate = function () { current = null; };

  R.apply = function (force) {
    if (suspended) return;
    var route = R.parse();

    /* Wer im Verhoer sitzt, kommt aus dem Raum nicht heraus - kein
       Spiel, kein Hub, keine Adresse von Hand. Erst wenn der Dienst
       freigibt, geht es weiter. */
    var haft = SG.verhoer && SG.verhoer.eigenePerson && SG.verhoer.eigenePerson();
    if (haft && !(route.kind === 'befragung' && route.id === haft.zusatz.code)) {
      R.go('#/befragung/' + haft.zusatz.code);
      return;
    }

    // Eine Ansage soll auf jedem Bildschirm auftauchen, auch im Spiel
    if (SG.ansage && SG.auth.aktuell) setTimeout(SG.ansage.pruefen, 60);

    /* Zugangspruefung vor der Abkuerzung unten. Wer die Rolle wechselt,
       darf nicht durch eine stehengebliebene Ansicht hindurchrutschen. */
    if (route.kind === 'kreis' && !SG.auth.imKreis()) { R.go('#/'); return; }
    if (route.kind === 'adminraum' && !SG.auth.istAdmin()) { R.go('#/'); return; }
    if (route.kind === 'bnd' && !SG.auth.istBnd()) { R.go('#/'); return; }
    if (route.kind === 'befragung') {
      var eigen = SG.auth.aktuell && SG.auth.aktuell.code === route.id;
      if (!SG.auth.istBnd() && !eigen) { R.go('#/'); return; }
    }
    if (route.kind === 'verhoer' && !SG.auth.istBnd()) { R.go('#/'); return; }
    if (route.kind === 'dev' && !SG.auth.istAdmin()) { R.go('#/'); return; }

    /* Die Anwesenheitsliste soll wissen, wo jemand steckt. */
    if (SG.relais && SG.spiegel) SG.relais.ortSetzen(SG.spiegel.wo());

    /* Waehrend eines Spiels liegt ein voller Bildschirm ueber der
       Kulisse. Sie weiterlaufen zu lassen kostet nur Akku. */
    if (SG.kulisse) SG.kulisse.ruhen(route.kind === 'game');

    if (!force && current && current.kind === route.kind && current.id === route.id) return;

    if (current && current.view && current.view.destroy) {
      try { current.view.destroy(); } catch (e) { SG.noteError('router.destroy', e); }
    }
    UI.clear(app);
    current = null;

    if (route.kind === 'game') {
      var def = SG.games[route.id];
      if (!def) {
        UI.toast('Dieses Spiel gibt es nicht.', 'bad');
        R.go('#/');
        return;
      }
      /* Wartung, innerer Kreis oder eine persoenliche Sperre gelten auch
         fuer den direkten Aufruf ueber die Adresse. */
      var sperre = SG.auth.zugang(def.id);
      if (sperre) {
        UI.toast(sperre.text, 'bad', 3000);
        R.go('#/');
        return;
      }
      mountGame(def);
      return;
    }

    if (route.kind === 'offline') {
      if (SG.offline) { R.go('#/'); return; }
      current = { kind: 'offline', view: SG.offlineScreen.render(app) };
      return;
    }

    if (route.kind === 'kreis') {
      if (!SG.auth.imKreis()) { R.go('#/'); return; }
      current = { kind: 'kreis', view: SG.kreis.render(app) };
      return;
    }

    if (route.kind === 'profil') {
      current = { kind: 'profil', view: SG.profil.render(app) };
      return;
    }

    if (route.kind === 'adminraum') {
      current = { kind: 'adminraum', view: SG.adminraum.render(app) };
      return;
    }

    if (route.kind === 'bnd') {
      current = { kind: 'bnd', view: SG.bnd.render(app) };
      return;
    }

    if (route.kind === 'befragung') {
      current = { kind: 'befragung', id: route.id, view: SG.bnd.befragung(app, route.id) };
      return;
    }

    if (route.kind === 'verhoer') {
      current = { kind: 'verhoer', id: route.id, view: SG.bnd.verhoerRaum(app, route.id) };
      return;
    }

    if (route.kind === 'meeting') {
      current = { kind: 'meeting', id: route.id, view: SG.meeting.render(app, route.id) };
      return;
    }

    if (route.kind === 'dev') {
      current = { kind: 'dev', view: SG.dev.render(app) };
      return;
    }

    if (route.kind === 'flix') {
      current = { kind: 'flix', view: SG.flix.render(app) };
      return;
    }

    if (route.kind === 'ueber') {
      current = { kind: 'ueber', view: SG.credits.render(app) };
      return;
    }

    current = { kind: 'hub', view: SG.hub.render(app) };
  };

  function mountGame(def) {
    var host = SG.host.create(def, app);
    var ctrl = null;
    try {
      ctrl = def.mount(host) || {};
    } catch (e) {
      SG.noteError('mount:' + def.id, e);
      UI.toast('Das Spiel konnte nicht gestartet werden.', 'bad', 3200);
      host.destroy();
      R.go('#/');
      return;
    }
    SG.scores.markPlayed(def.id);

    current = {
      kind: 'game',
      id: def.id,
      host: host,
      ctrl: ctrl,
      view: {
        destroy: function () {
          if (ctrl && ctrl.destroy) {
            try { ctrl.destroy(); } catch (e) { SG.noteError('destroy:' + def.id, e); }
          }
          host.destroy();
        },
      },
    };
  }

  R.currentGame = function () {
    return current && current.kind === 'game' ? current : null;
  };

  /* Fuer den Selbsttest: Router stilllegen */
  R.suspend = function (v) { suspended = !!v; };
})(SG);
