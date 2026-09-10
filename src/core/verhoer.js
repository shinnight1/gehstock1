/* ------------------------------------------------------------------
   Fehlversuche und Verhoere.

   Was an der Tuer schiefgeht, ist die interessanteste Spur ueberhaupt:
   wer probiert Codes durch, von welchem Geraet, wie oft, und wem hat
   dieses Geraet vorher gehoert. Genau das wird hier gesammelt.

   Der Ablauf:

     falscher Code        -> Meldung ins Brett 'fehlversuche'
     drei in 20 Minuten   -> ein Fall im Brett 'verhoere', die Tuer
                             geht in den Verhoerbildschirm
     BND sieht den Alarm  -> eigenes Fenster, ueberall in der App
     BND befragt          -> eigener Chatraum je Geraet
     BND entscheidet      -> Freigeben, oder Ablehnen: dann geht ein
                             Antrag an die Administration. Sperren
                             duerfen weiterhin nur Admins.

   Zwei Dinge, die hier anders sind als sonst im Hideout:

   1. All das laeuft OHNE Anmeldung. Wer vor der Tuer steht, hat keinen
      Code - die Meldung geht deshalb mit einem Ersatzabsender raus, und
      der Verhoerraum haengt am Geraet, nicht an einer Person.

   2. Gesperrt wird das GERAET, nicht der Code. Einen Code hat der
      Betreffende ja gerade nicht; er raet ihn.
   ------------------------------------------------------------------ */

(function (SG) {
  var UI = SG.ui;
  var U = SG.util;
  var A = SG.auth;
  var Rel = SG.relais;

  var V = SG.verhoer = {};

  V.BRETT_FEHL = 'fehlversuche';
  V.BRETT_FAELLE = 'verhoere';

  V.raum = function (geraet) { return 'verhoer-' + String(geraet || '').slice(0, 24); };

  var FENSTER_MS = 20 * 60 * 1000;   // so lange zaehlt ein Fehlversuch mit
  var GRENZE = 3;                    // so viele, dann Verhoer

  V.GRENZE = GRENZE;

  /* ------------------------------------------------------------------
     Was ueber ein Geraet bekannt ist

     Nichts davon identifiziert eine Person. Es sagt nur, ob zwei
     Anfragen vom selben Kasten kommen und was fuer einer das ist -
     genug, um "Anna probiert auf ihrem eigenen iPad herum" von
     "jemand Fremdes sitzt an Annas iPad" zu unterscheiden.
     ------------------------------------------------------------------ */

  V.profil = function () {
    var n = navigator || {};
    var s = window.screen || {};
    var zone = '';
    try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { /* egal */ }
    var letzter = SG.storage.globalGet('letzterNutzer', null);
    return {
      geraet: Rel.geraet,
      art: Rel.geraeteArt,
      schirm: (s.width || 0) + '×' + (s.height || 0),
      fenster: window.innerWidth + '×' + window.innerHeight,
      dpr: Math.round((window.devicePixelRatio || 1) * 100) / 100,
      sprache: n.language || '',
      zone: zone,
      finger: n.maxTouchPoints || 0,
      kerne: n.hardwareConcurrency || 0,
      standalone: !!SG.env.standalone,
      letzterNutzer: letzter ? (letzter.name || '') : '',
      letzterNutzerT: letzter ? letzter.t : 0,
    };
  };

  /* Nach jeder erfolgreichen Anmeldung: wem gehoert dieses Geraet
     gerade? Steht nur lokal - der BND sieht es erst, wenn von hier
     eine Meldung ausgeht. */
  V.nutzerMerken = function (code, name) {
    SG.storage.globalSet('letzterNutzer', {
      code: code, name: name || A.nameVon(code) || '', t: Date.now(),
    });
  };

  /* ------------------------------------------------------------------
     Melden und zaehlen
     ------------------------------------------------------------------ */

  var ABSENDER = { name: 'Tür', code: '', rolle: 'S' };

  V.melden = function (versuch) {
    if (!Rel.verfuegbar()) return Promise.resolve({ anzahl: 0, fall: null });
    var p = V.profil();
    return Rel.senden(V.BRETT_FEHL, {
      text: 'Falscher Code an der Tür',
      zusatz: {
        art: 'fehlversuch',
        geraet: p.geraet,
        versuch: String(versuch || '').slice(0, 8),
        profil: p,
      },
    }, ABSENDER).then(function () {
      var n = V.anzahl();
      if (n >= GRENZE) return V.anlegen().then(function (f) { return { anzahl: n, fall: f }; });
      return { anzahl: n, fall: null };
    }, function () { return { anzahl: 0, fall: null }; });
  };

  V.versuche = function (geraet) {
    geraet = geraet || Rel.geraet;
    var grenze = Date.now() - FENSTER_MS;
    return (Rel.kanal(V.BRETT_FEHL).nachrichten || []).filter(function (m) {
      return m.zusatz && m.zusatz.art === 'fehlversuch'
        && m.zusatz.geraet === geraet && m.t > grenze;
    });
  };

  V.anzahl = function (geraet) { return V.versuche(geraet).length; };

  /* Alle Fehlversuche, nach Geraet gebuendelt - das Lagebild des BND */
  V.buendel = function () {
    var alle = (Rel.kanal(V.BRETT_FEHL).nachrichten || []).filter(function (m) {
      return m.zusatz && m.zusatz.art === 'fehlversuch';
    });
    var nach = {};
    alle.forEach(function (m) {
      var g = m.zusatz.geraet;
      if (!nach[g]) {
        nach[g] = {
          geraet: g, profil: m.zusatz.profil || {}, versuche: [],
          erste: m.t, letzte: m.t,
        };
      }
      nach[g].versuche.push({ code: m.zusatz.versuch, t: m.t });
      nach[g].letzte = Math.max(nach[g].letzte, m.t);
      nach[g].erste = Math.min(nach[g].erste, m.t);
      if (m.zusatz.profil) nach[g].profil = m.zusatz.profil;
    });
    return Object.keys(nach).map(function (g) { return nach[g]; })
      .sort(function (a, b) { return b.letzte - a.letzte; });
  };

  /* ------------------------------------------------------------------
     Faelle
     ------------------------------------------------------------------ */

  V.faelle = function () {
    return (Rel.kanal(V.BRETT_FAELLE).nachrichten || [])
      .filter(function (m) { return m.zusatz && m.zusatz.art === 'verhoer' && !m.weg; });
  };

  V.offeneFaelle = function () {
    return V.faelle().filter(function (m) { return m.status === undefined; });
  };

  V.fallVon = function (geraet) {
    var g = geraet || Rel.geraet;
    var treffer = V.faelle().filter(function (m) { return m.zusatz.geraet === g; });
    return treffer.length ? treffer[treffer.length - 1] : null;
  };

  /* Der offene Fall dieses Geraets - nur der sperrt die Tuer */
  V.eigenerFall = function () {
    var f = V.fallVon(Rel.geraet);
    return f && f.status === undefined ? f : null;
  };

  /* ------------------------------------------------------------------
     Verhoere gegen angemeldete Personen

     Dasselbe Brett, nur haengt der Fall an einem Code statt an einem
     Geraet. Der Unterschied in der Wirkung: an der Tuer sperrt er die
     Codeeingabe, drinnen sperrt er alles andere - wer im Verhoer ist,
     kommt aus dem Raum nicht heraus, bis der Dienst ihn freigibt.
     ------------------------------------------------------------------ */

  V.personFall = function (code) {
    var c = A.normieren(code);
    var treffer = V.faelle().filter(function (m) { return m.zusatz.code === c; });
    return treffer.length ? treffer[treffer.length - 1] : null;
  };

  /* Sitzt DIESE Person gerade im Verhoer?

     'abgelehnt' haelt weiter fest: dann liegt der Fall beim Admin, und
     bis der entschieden hat, waere ein Freilassen sinnlos. */
  V.eigenePerson = function () {
    if (!A.aktuell) return null;
    var f = V.personFall(A.aktuell.code);
    if (!f) return null;
    return (f.status === undefined || f.status === 'abgelehnt') ? f : null;
  };

  V.personAnlegen = function (code, name, grund) {
    var c = A.normieren(code);
    var da = V.personFall(c);
    if (da && (da.status === undefined || da.status === 'abgelehnt')) {
      return Promise.resolve(da);
    }
    return Rel.senden(V.BRETT_FAELLE, {
      text: grund || 'Befragung eingeleitet',
      zusatz: {
        art: 'verhoer',
        code: c,
        name: name || A.nameVon(c) || c,
        kennung: A.bndKennung(c),
        geraete: A.geraete(c).length,
      },
    }).then(function () { return V.personFall(c); });
  };

  V.personFreigeben = function (fall) {
    return Rel.aendern(V.BRETT_FAELLE, fall.id, {
      status: 'frei',
      erledigtVon: (A.aktuell && A.aktuell.name) || 'BND',
      erledigtT: Date.now(),
    }).then(function () {
      Rel.senden(V.raumPerson(fall.zusatz.code), {
        text: '✅ Die Befragung ist beendet. Du kannst weiterspielen.',
      });
      Rel.befehlSenden(fall.zusatz.code, 'verhoer-ende', 'Befragung beendet');
      SG.protokoll.schreiben('verhoer',
        'Befragung beendet: ' + (fall.zusatz.name || fall.zusatz.code),
        '', fall.zusatz.code);
    });
  };

  V.personAblehnen = function (fall, grund) {
    return Rel.aendern(V.BRETT_FAELLE, fall.id, {
      status: 'abgelehnt',
      erledigtVon: (A.aktuell && A.aktuell.name) || 'BND',
      erledigtT: Date.now(),
      notiz: grund || '',
    }).then(function () {
      Rel.senden(SG.bnd.ANTRAEGE, {
        text: grund || 'Befragung verlief negativ. Sperrung wird beantragt.',
        zusatz: {
          art: 'sperrung',
          ziel: fall.zusatz.code,
          zielName: fall.zusatz.name || '',
          kennung: fall.zusatz.kennung || A.bndKennung(fall.zusatz.code),
          ausVerhoer: fall.id,
        },
      });
      Rel.senden(V.raumPerson(fall.zusatz.code), {
        text: '⛔ Der Vorgang wurde an die Administration abgegeben.',
      });
      SG.protokoll.schreiben('verhoer',
        'Befragung abgelehnt, Sperre beantragt: '
        + (fall.zusatz.name || fall.zusatz.code), '', fall.zusatz.code);
    });
  };

  V.raumPerson = function (code) { return 'bnd-' + A.normieren(code); };

  V.anlegen = function () {
    var schon = V.eigenerFall();
    if (schon) return Promise.resolve(schon);
    var p = V.profil();
    var versuche = V.versuche().map(function (m) { return m.zusatz.versuch; });
    return Rel.senden(V.BRETT_FAELLE, {
      text: 'Zutrittsversuch: ' + versuche.length + ' falsche Codes',
      zusatz: {
        art: 'verhoer',
        geraet: p.geraet,
        profil: p,
        versuche: versuche,
      },
    }, ABSENDER).then(function () { return V.eigenerFall(); });
  };

  V.freigeben = function (fall) {
    return Rel.aendern(V.BRETT_FAELLE, fall.id, {
      status: 'frei',
      erledigtVon: (A.aktuell && A.aktuell.name) || 'BND',
      erledigtT: Date.now(),
    }).then(function () {
      Rel.senden(V.raum(fall.zusatz.geraet), {
        text: '✅ Freigegeben. Du kannst den Code erneut eingeben.',
      });
      SG.protokoll.schreiben('verhoer',
        'Gerät nach Verhör freigegeben (' + kurz(fall.zusatz.geraet) + ')');
    });
  };

  V.ablehnen = function (fall, grund) {
    return Rel.aendern(V.BRETT_FAELLE, fall.id, {
      status: 'abgelehnt',
      erledigtVon: (A.aktuell && A.aktuell.name) || 'BND',
      erledigtT: Date.now(),
      notiz: grund || '',
    }).then(function () {
      /* Sperren duerfen nur Admins. Der BND stellt den Antrag. */
      Rel.senden(SG.bnd.ANTRAEGE, {
        text: grund || 'Verhör verlief negativ. Gerät sollte gesperrt werden.',
        zusatz: {
          art: 'geraetesperre',
          geraet: fall.zusatz.geraet,
          zielName: 'Unbekanntes Gerät (' + kurz(fall.zusatz.geraet) + ')',
          kennung: kurz(fall.zusatz.geraet),
          versuche: fall.zusatz.versuche || [],
        },
      });
      Rel.senden(V.raum(fall.zusatz.geraet), {
        text: '⛔ Der Vorgang wurde an die Administration abgegeben.',
      });
      SG.protokoll.schreiben('verhoer',
        'Verhör abgelehnt, Sperre beantragt (' + kurz(fall.zusatz.geraet) + ')');
    });
  };

  /* Kurzform einer Geraetekennung - lesbar, aber ohne Aussagekraft */
  function kurz(g) {
    return String(g || '').slice(-6).toUpperCase();
  }
  V.kurz = kurz;

  /* ------------------------------------------------------------------
     Geraetesperren

     Liegen in der Verwaltung, damit die Tuer sie kennt, bevor jemand
     angemeldet ist.
     ------------------------------------------------------------------ */

  V.geraeteBanne = function () { return SG.verwaltung.daten().geraeteBanne || {}; };

  V.geraetGebannt = function (geraet) {
    return V.geraeteBanne()[geraet || Rel.geraet] || null;
  };

  V.geraetBannen = function (geraet, grund, von) {
    SG.verwaltung.schreiben(function (d) {
      d.geraeteBanne = d.geraeteBanne || {};
      d.geraeteBanne[geraet] = {
        grund: String(grund || 'Ohne Angabe'),
        von: von || (A.aktuell && A.aktuell.name) || 'Admin',
        t: Date.now(),
      };
    });
  };

  V.geraetEntbannen = function (geraet) {
    SG.verwaltung.schreiben(function (d) {
      d.geraeteBanne = d.geraeteBanne || {};
      delete d.geraeteBanne[geraet];
    });
  };

  /* ------------------------------------------------------------------
     Der Alarm

     Ein eigenes Fenster, das ueberall in der App auftaucht, sobald ein
     Fall aufgeht - auch mitten im Spiel. Nur fuer den BND sichtbar.
     ------------------------------------------------------------------ */

  var alarmEl = null;
  var gesehen = {};
  var wacht = false;

  V.alarmWachen = function () {
    if (wacht) return;
    wacht = true;
    /* Was beim Start schon dasteht, ist kein Alarm - sonst schreit es
       bei jedem Neuladen los. */
    Rel.beobachten(V.BRETT_FAELLE, function (nachrichten) {
      if (!A.istBnd()) return;
      var neu = null;
      nachrichten.forEach(function (m) {
        if (!m.zusatz || m.zusatz.art !== 'verhoer') return;
        var erstesMal = !gesehen[m.id];
        gesehen[m.id] = m.status;
        if (erstesMal && m.status === undefined && !erstAufbau) neu = m;
      });
      if (erstAufbau) { erstAufbau = false; return; }
      if (neu) V.alarmZeigen(neu);
    });
  };
  var erstAufbau = true;

  V.alarmZeigen = function (fall) {
    if (alarmEl) UI.remove(alarmEl);
    SG.audio.play('error');
    SG.settings.buzz(120);

    var p = fall.zusatz.profil || {};
    alarmEl = UI.el('div.bnd-alarm-fenster', null, [
      UI.el('div.baf-balken'),
      UI.el('div.baf-kopf', null, [
        UI.el('span.baf-ic', { text: '🦅' }),
        UI.el('span.baf-t', { text: 'BND · Zutrittsalarm' }),
        UI.el('div.spacer'),
        UI.el('button.x-btn', {
          html: '✕', 'aria-label': 'Schließen',
          on: { click: function () { UI.remove(alarmEl); alarmEl = null; } },
        }),
      ]),
      UI.el('div.baf-leib', null, [
        UI.el('div.baf-zeile', {
          text: (fall.zusatz.versuche || []).length + ' falsche Codes an der Tür',
        }),
        UI.el('div.baf-klein', {
          text: (p.art || 'Unbekanntes Gerät') + ' · ' + kurz(fall.zusatz.geraet)
            + (p.letzterNutzer ? ' · zuletzt: ' + p.letzterNutzer : ''),
        }),
      ]),
      UI.el('div.baf-fuss', null, [
        UI.btn('Fall öffnen', function () {
          UI.remove(alarmEl);
          alarmEl = null;
          SG.router.go('#/verhoer/' + fall.zusatz.geraet);
        }, 'primary wide'),
      ]),
    ]);
    document.body.appendChild(alarmEl);
    setTimeout(function () { if (alarmEl) alarmEl.classList.add('an'); }, 20);
  };

  /* ------------------------------------------------------------------
     Der Verhoerbildschirm an der Tuer

     Kein Tastenfeld mehr, sondern erst ein kurzer Text und dann der
     Chat. Der Fall gehoert dem Geraet, nicht einer Person - deshalb
     schreibt hier ein Absender ohne Code.
     ------------------------------------------------------------------ */

  V.tuerVerhoer = function (app, fall, fertig) {
    UI.clear(app);
    var wrap = UI.el('div.verhoer-tuer');
    app.appendChild(wrap);

    var kopf = UI.el('div.vt-kopf', null, [
      UI.el('div.vt-wappen', { text: '🦅' }),
      UI.el('div.vt-titel', { text: 'BUNDESNACHRICHTENDIENST' }),
      UI.el('div.vt-unter', { text: 'Zutrittskontrolle · Vorgang ' + kurz(fall.zusatz.geraet) }),
    ]);
    wrap.appendChild(kopf);

    var warte = UI.el('div.vt-warte', null, [
      UI.el('div.vt-punkte', null, [UI.el('i'), UI.el('i'), UI.el('i')]),
      UI.el('div.vt-text', { text: 'Sie werden kurz verhört.' }),
      UI.el('div.vt-text2', { text: 'Bitte gedulden Sie sich einen Moment.' }),
    ]);
    wrap.appendChild(warte);

    var raum = UI.el('div.vt-raum');
    wrap.appendChild(raum);

    var chat = null;
    setTimeout(function () {
      warte.classList.add('klein');
      chat = SG.chat.ansicht(raum, {
        brett: V.raum(fall.zusatz.geraet),
        platzhalter: 'Antwort…',
        loeschen: false,
        bilder: false,
        umfragen: false,
        absender: { name: 'Befragter', code: '', rolle: 'S' },
        leerIcon: '🎙',
        leerTitel: 'Verhör',
        leerText: 'Gleich meldet sich ein Mitarbeiter.',
      });
      raum.classList.add('an');
    }, 2600);

    /* Auf die Entscheidung warten */
    var ab = Rel.beobachten(V.BRETT_FAELLE, function () {
      var jetzt = V.fallVon(fall.zusatz.geraet);
      if (!jetzt || jetzt.id !== fall.id) return;
      if (jetzt.status === 'frei') {
        UI.toast('Freigegeben.', 'good', 3000);
        aufraeumen();
        fertig(true);
      } else if (jetzt.status === 'abgelehnt') {
        warte.classList.remove('klein');
        UI.clear(warte);
        UI.add(warte, [
          UI.el('div.vt-text', { text: '⛔ Der Vorgang liegt bei der Administration.' }),
          UI.el('div.vt-text2', { text: 'Bis dahin bleibt der Zutritt gesperrt.' }),
        ]);
      }
    });
    Rel.starten();

    function aufraeumen() {
      ab();
      if (chat && chat.destroy) chat.destroy();
    }

    return { destroy: aufraeumen };
  };
})(SG);
