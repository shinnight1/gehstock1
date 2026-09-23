/* ------------------------------------------------------------------
   Das Relais - Client-Seite.

   Frueher hielt jedes iPad drei Anfragen gleichzeitig offen: eine fuer
   das Spiel, eine fuer den Chat, eine fuer die Verwaltung. Netlify
   laesst aber nur wenige Funktionen gleichzeitig laufen. Ab drei
   Leuten standen die Anfragen Schlange, und ein Zug brauchte Sekunden
   statt Millisekunden.

   Jetzt gibt es genau EINE offene Verbindung je Geraet. Sie traegt
   alles: Spielraum, Chatbretter, Verwaltung, Anwesenheit, Bildschirme,
   Befehle. Wer etwas beobachten will, meldet es hier an; die Schleife
   nimmt es beim naechsten Durchlauf mit.

   Aufbau einer Runde:

       sync (kurz)  ->  Server sieht einmal nach
                    <-  sofort: nur das, was sich geaendert hat
       Pause, dann die naechste Runde

   Bis September 2026 hielt der Server jede Anfrage bis zu 7,5 s offen,
   und die naechste ging ohne Pause hinterher. Das war schnell, aber eine
   Schulklasse hat damit an einem Vormittag beide Gratiskontingente
   geleert: Netlify rechnet die Laufzeit der Funktionen ab, und jedes
   offene Fenster hielt eine davon ununterbrochen am Laufen; die
   Datenbank zaehlte je Fenster rund 80 Befehle in der Minute. Heute
   wartet der Browser selbst, und zwar nur so kurz, wie es die Lage
   verlangt (siehe pauseNach).
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;

  var R = SG.relais = {};

  var ENDPUNKT = '/api/room';

  /* Wird gesetzt, sobald sich zeigt, dass unter /api/room keine
     Funktion liegt (typisch: dist/ wurde per Drag-and-drop ohne
     netlify/functions hochgeladen). Danach wird gar nicht mehr
     gefragt, statt jedes Mal in denselben Fehler zu laufen. */
  R.serviceFehlt = false;

  R.verfuegbar = function () {
    return !SG.offline && typeof fetch === 'function' && !SG.env.file && !R.serviceFehlt;
  };

  /* ------------------------------------------------------------------
     Geraetekennung

     Bleibt erhalten, auch wenn sich jemand ab- und wieder anmeldet.
     Der BND erkennt daran, ob ein Code plotzlich auf einem zweiten
     Geraet auftaucht. Es steckt nichts Persoenliches darin - eine
     Zufallszahl, sonst nichts.
     ------------------------------------------------------------------ */

  R.geraet = (function () {
    var g = SG.storage.globalGet('geraet', null);
    if (!g || typeof g !== 'string' || g.length < 8) {
      g = 'g' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
      SG.storage.globalSet('geraet', g);
    }
    return g;
  })();

  /* Grobe Geraeteart - nur zur Anzeige im BND, kein Fingerabdruck */
  R.geraeteArt = (function () {
    var ua = (navigator && navigator.userAgent) || '';
    if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'iPad';
    if (/iPhone/.test(ua)) return 'iPhone';
    if (/Android/.test(ua)) return 'Android';
    if (/Macintosh/.test(ua)) return 'Mac';
    if (/Windows/.test(ua)) return 'Windows';
    return 'Unbekannt';
  })();

  /* ------------------------------------------------------------------ Senden */

  function post(nutzlast, timeoutMs, ctrlAus) {
    var ctrl = null;
    try { ctrl = new AbortController(); } catch (e) { /* egal */ }
    if (ctrlAus && ctrl) ctrlAus(ctrl);
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, timeoutMs || 12000);
    return fetch(ENDPUNKT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nutzlast),
      signal: ctrl ? ctrl.signal : undefined,
      cache: 'no-store',
    }).then(function (r) {
      clearTimeout(timer);
      /* Fehlt die Funktion, liefert der Host statt JSON die Seite selbst.
         Ohne diese Pruefung schluege erst JSON.parse zu und meldete
         "Unexpected token '<'" - damit kann niemand etwas anfangen. */
      var ct = '';
      try { ct = (r.headers.get('content-type') || '').toLowerCase(); } catch (e) { /* egal */ }
      if (ct.indexOf('json') < 0) {
        R.serviceFehlt = true;
        return r.text().then(function () { throw new Error('no_service'); },
          function () { throw new Error('no_service'); });
      }
      return r.json().then(function (j) {
        if (!r.ok || j.error) throw new Error(j.error || ('HTTP ' + r.status));
        return j;
      }, function () {
        R.serviceFehlt = true;
        throw new Error('no_service');
      });
    }, function (e) {
      clearTimeout(timer);
      throw e;
    });
  }

  R.post = post;

  /* ------------------------------------------------------------------
     Was gerade beobachtet wird
     ------------------------------------------------------------------ */

  var kanaele = {};          // name -> { version, refs, bus }
  var raumAbo = null;        // { code, version, bus }
  var schirmAbo = {};        // code -> version
  var praesenzRefs = 0;
  var verwVersion = 0;

  var weltVersion = 0;
  var praesenzVersion = 0;
  var letzterBefehl = 0;

  var bus = U.emitter();
  R.on = bus.on;
  R.off = bus.off;

  R.wo = '';                 // Aufenthaltsort fuer die Anwesenheitsliste
  R.online = false;          // hat die letzte Runde geklappt?
  R.beobachtetMich = false;  // schaut gerade jemand auf meinen Bildschirm?

  R.ortSetzen = function (wo) {
    if (R.wo === wo) return;
    R.wo = wo || '';
    anstossen();
  };

  /* ---------------------------------------------------------- Kanaele */

  R.kanal = function (name) {
    if (!kanaele[name]) {
      kanaele[name] = { version: 0, refs: 0, bus: U.emitter(), nachrichten: [] };
    }
    return kanaele[name];
  };

  /* Meldet Interesse an einem Brett an. Zurueck kommt eine Funktion,
     die es wieder abmeldet - so bleibt kein Brett in der Schleife
     haengen, das niemand mehr ansieht. */
  R.beobachten = function (name, aufNachrichten) {
    var k = R.kanal(name);
    k.refs++;
    if (aufNachrichten) k.bus.on('nachrichten', aufNachrichten);
    /* Erststand sofort holen, damit das Brett nicht leer dasteht,
       bis sich zufaellig etwas aendert. */
    if (R.verfuegbar()) {
      post({ op: 'chat:read', brett: name }, 8000).then(function (res) {
        if (!kanaele[name] || !kanaele[name].refs) return;
        uebernehmenKanal(name, res);
      }, function () { /* die Schleife holt es spaeter nach */ });
    }
    anstossen();
    return function () {
      k.refs = Math.max(0, k.refs - 1);
      if (aufNachrichten) k.bus.off('nachrichten', aufNachrichten);
    };
  };

  function uebernehmenKanal(name, res) {
    if (!res || typeof res.version !== 'number') return;
    var k = R.kanal(name);
    if (res.version < k.version) return;
    k.version = res.version;
    k.nachrichten = res.nachrichten || [];
    k.bus.emit('nachrichten', k.nachrichten, k.version);
  }

  /* Eine Antwort, die schon den ganzen Brettstand enthaelt, direkt
     uebernehmen - dann steht das eben Geschriebene sofort da und nicht
     erst nach der naechsten Runde. */
  R.kanalStand = uebernehmenKanal;

  /* 'absender' setzt den Namen von Hand. Gebraucht wird das an der Tuer:
     wer dort einen Fehlversuch meldet, ist noch nicht angemeldet und
     hat deshalb weder Code noch Namen. */
  R.senden = function (name, nutzlast, absender) {
    var ich = absender || R.ich();
    var voll = U.assign({
      op: 'chat:post', brett: name,
      von: ich.name, code: ich.code, rolle: ich.rolle,
    }, nutzlast || {});
    return post(voll, 15000).then(function (res) {
      uebernehmenKanal(name, res);
      beschleunigen();
      return res;
    });
  };

  R.stimmen = function (name, id, wahl) {
    return post({
      op: 'chat:vote', brett: name, id: id, wahl: wahl, code: R.ich().code,
    }, 12000).then(function (res) { uebernehmenKanal(name, res); beschleunigen(); return res; });
  };

  R.loeschen = function (name, id) {
    return post({
      op: 'chat:del', brett: name, id: id, von: R.ich().name,
    }, 12000).then(function (res) { uebernehmenKanal(name, res); beschleunigen(); return res; });
  };

  R.aendern = function (name, id, feld) {
    return post({
      op: 'chat:patch', brett: name, id: id, feld: feld,
    }, 12000).then(function (res) { uebernehmenKanal(name, res); beschleunigen(); return res; });
  };

  /* ---------------------------------------------------------- Raum */

  R.raumBeobachten = function (code, version, aufDaten) {
    raumAbo = { code: code, version: version || 0, cb: aufDaten };
    anstossen();
  };

  R.raumVersion = function (v) {
    if (raumAbo && v > raumAbo.version) raumAbo.version = v;
  };

  R.raumEnde = function () { raumAbo = null; };

  /* ---------------------------------------------------------- Anwesenheit */

  R.praesenzAn = function (an) {
    praesenzRefs = Math.max(0, praesenzRefs + (an ? 1 : -1));
    anstossen();
  };

  R.schirmeBeobachten = function (codes) {
    var neu = {};
    (codes || []).forEach(function (c) { neu[c] = schirmAbo[c] || 0; });
    schirmAbo = neu;
    if (codes && codes.length && R.verfuegbar()) {
      post({ op: 'schirm:will', codes: codes }, 8000).catch(function () { /* egal */ });
    }
    anstossen();
  };

  /* ---------------------------------------------------------- Verwaltung */

  R.verwVersionSetzen = function (v) { verwVersion = v || 0; };

  /* ---------------------------------------------------------- Weltkarte */

  /* Die gemeinsame Pixel-Weltkarte haengt mit an derselben Verbindung.
     pixRefs zaehlt, ob gerade jemand hinsieht - solange niemand die
     Karte offen hat, wird sie auch nicht abgefragt. */
  var pixVersion = 0;
  var pixRefs = 0;

  R.pixBeobachten = function (aufKarte) {
    pixRefs++;
    if (aufKarte) bus.on('weltkarte', aufKarte);
    if (R.verfuegbar()) {
      post({ op: 'pix:read', since: 0 }, 12000).then(function (res) {
        if (res && typeof res.version === 'number') pixVersion = res.version;
        bus.emit('weltkarte', res);
      }, function () { /* die Schleife holt es nach */ });
    }
    anstossen();
    return function () {
      pixRefs = Math.max(0, pixRefs - 1);
      if (aufKarte) bus.off('weltkarte', aufKarte);
    };
  };

  /* Striche sind [{ n: Feldnummer, c: Farbe }] - Farbe 0 radiert. */
  R.pixSetzen = function (striche) {
    var ich = R.ich();
    return post({
      op: 'pix:write', striche: striche, von: ich.name, code: ich.code,
    }, 15000).then(function (res) {
      if (res && typeof res.version === 'number') pixVersion = res.version;
      beschleunigen();
      return res;
    });
  };

  /* ---------------------------------------------------------- Wer bin ich */

  R.ich = function () {
    var a = SG.auth && SG.auth.aktuell;
    return {
      code: (a && a.code) || '',
      name: (a && a.name) || 'Unbekannt',
      rolle: (a && a.rolle) || 'S',
    };
  };

  /* ------------------------------------------------------------------
     Die Schleife
     ------------------------------------------------------------------ */

  /* 'lauf' zaehlt die Schleifengeneration. Jedes anstossen() erhoeht sie
     und entwertet damit alles, was noch von vorher unterwegs ist.

     Ohne diesen Zaehler passierte Folgendes: anstossen() bricht die
     offene Anfrage ab und stellt einen neuen Timer. Der Abbruch loest
     aber den Fehlerzweig der alten Anfrage aus, und der stellte
     ebenfalls einen Timer - die Variable zeigte danach nur noch auf
     einen der beiden. Ab da liefen zwei Schleifen nebeneinander, jede
     mit einer eigenen offenen Verbindung. Genau das, was hier
     eigentlich abgeschafft werden sollte. */
  var laeuft = false, offen = null, timer = 0, fehler = 0, lauf = 0;

  /* Die Pausen zwischen zwei Runden. Nur Inhalt haelt wach - dass
     jemand anderes den Ort gewechselt hat, zaehlt nicht, sonst liefe
     bei dreissig Kindern jedes Geraet im schnellsten Takt. */
  var PAUSE_RAUM = 1000;         // in einem Spielraum: Zuege sollen schnell ankommen
  var PAUSE_SCHIRM = 1500;       // ein fremder Bildschirm wird angesehen
  var PAUSE_LEBHAFT = 2000;      // gerade kam etwas an - danach jede ruhige Runde x1,5
  var PAUSE_RUHIG = 15000;       // lange nichts passiert
  var PAUSE_HINTERGRUND = 60000; // Tab verdeckt, iPad gesperrt
  var ruhe = PAUSE_LEBHAFT;
  var faellig = 0;               // wann die naechste Runde geplant ist
  var nachschlag = false;        // waehrend einer Anfrage kam etwas Neues dazu

  function verdeckt() {
    try { return document.visibilityState === 'hidden'; } catch (e) { return false; }
  }

  function pauseNach(res) {
    var inhalt = !!(res && (res.kanaele || res.verw || res.pix || res.raum || res.schirme
      || res.praesenz || (res.befehle && res.befehle.length)));
    ruhe = inhalt ? PAUSE_LEBHAFT : Math.min(PAUSE_RUHIG, Math.round(ruhe * 1.5));
    if (verdeckt()) return PAUSE_HINTERGRUND;
    if (raumAbo) return PAUSE_RAUM;
    if (Object.keys(schirmAbo).length) return PAUSE_SCHIRM;
    return ruhe;
  }

  function planen(meiner, ms) {
    clearTimeout(timer);
    faellig = Date.now() + ms;
    timer = setTimeout(function () { runde(meiner); }, ms);
  }

  /* Wer selbst etwas schreibt, erwartet eine Antwort. Eine lange Pause,
     die gerade laeuft, wird deshalb auf das lebhafte Mass gekuerzt. */
  function beschleunigen() {
    ruhe = PAUSE_LEBHAFT;
    if (!laeuft || offen || verdeckt()) return;
    if (faellig - Date.now() > PAUSE_LEBHAFT) planen(lauf, PAUSE_LEBHAFT);
  }

  function bauen() {
    var kv = {};
    for (var n in kanaele) {
      if (kanaele[n].refs > 0) kv[n] = kanaele[n].version;
    }
    var ich = R.ich();
    var n2 = {
      op: 'sync',
      kurz: true,
      geraet: R.geraet,
      art: R.geraeteArt,
      ich: ich.code ? ich : null,
      wo: R.wo,
      since: weltVersion,
      psince: praesenzVersion,
      befehl: letzterBefehl,
      kanaele: kv,
      verw: verwVersion,
    };
    if (pixRefs > 0) n2.pix = pixVersion;
    if (raumAbo) n2.raum = { code: raumAbo.code, since: raumAbo.version };
    if (praesenzRefs > 0) n2.praesenz = true;
    if (Object.keys(schirmAbo).length) n2.schirme = schirmAbo;
    return n2;
  }

  function verarbeiten(res) {
    if (!res) return;
    R.online = true;
    if (typeof res.version === 'number') weltVersion = Math.max(weltVersion, res.version);
    if (typeof res.pv === 'number') praesenzVersion = Math.max(praesenzVersion, res.pv);
    var vorherBeobachtet = R.beobachtetMich;
    R.beobachtetMich = !!res.spiegelMich;

    if (res.kanaele) {
      for (var n in res.kanaele) uebernehmenKanal(n, res.kanaele[n]);
    }

    if (res.verw) bus.emit('verwaltung', res.verw);

    if (res.pix) {
      if (typeof res.pix.version === 'number') pixVersion = res.pix.version;
      bus.emit('weltkarte', res.pix);
    }

    if (res.raum && raumAbo && raumAbo.cb) {
      if (typeof res.raum.version === 'number') raumAbo.version = res.raum.version;
      raumAbo.cb(res.raum);
    }

    if (res.befehle && res.befehle.length) {
      res.befehle.forEach(function (b) {
        if (b.id > letzterBefehl) letzterBefehl = b.id;
        bus.emit('befehl', b);
      });
    }

    if (res.praesenz) {
      bus.emit('praesenz', res.praesenz, res.spiegelAn || [], res.spiegelV || {});
    }

    if (res.schirme) {
      for (var c in res.schirme) {
        schirmAbo[c] = (res.spiegelV && res.spiegelV[c]) || (schirmAbo[c] + 1);
        bus.emit('schirm', c, res.schirme[c]);
      }
    }
    if (vorherBeobachtet !== R.beobachtetMich) bus.emit('spiegelMich', R.beobachtetMich);
  }

  function runde(meiner) {
    if (!laeuft || meiner !== lauf) return;
    if (!R.verfuegbar()) { laeuft = false; return; }
    nachschlag = false;
    post(bauen(), 15000, function (c) { offen = c; }).then(function (res) {
      if (meiner !== lauf) return;
      offen = null;
      fehler = 0;
      try { verarbeiten(res); } catch (e) { SG.noteError('relais.verarbeiten', e); }
      var pause = pauseNach(res);
      planen(meiner, nachschlag ? 0 : pause);
    }, function (e) {
      if (meiner !== lauf) return;
      offen = null;
      if (!laeuft) return;
      fehler++;
      R.online = false;
      bus.emit('stoerung', e);
      if (String((e && e.message) || e) === 'no_service') { laeuft = false; return; }
      /* Bis zu 20 s warten, frueher waren es hoechstens 5: Ist das
         Kontingent der Datenbank leer, scheitert jede Frage - und jede
         kostet trotzdem einen Funktionsaufruf. */
      var warten = verdeckt() ? PAUSE_HINTERGRUND
        : Math.min(20000, 500 * Math.pow(1.6, Math.min(fehler, 8)));
      planen(meiner, warten);
    });
  }

  /* Sofort eine Runde - noetig, sobald sich aendert, was beobachtet wird,
     sonst kaeme das Neue erst nach der laufenden Pause.

     Eine Anfrage, die gerade unterwegs ist, wird nicht mehr abgebrochen:
     sie ist in einem Augenblick zurueck, und die naechste folgt dann ohne
     Pause mit der neuen Liste. Ein Abbruch spart keine Zeit, kostet aber
     eine Anfrage, die der Server trotzdem bearbeitet. Ein Seitenwechsel
     meldet oft mehreres kurz hintereinander an (Ort, Bretter, Anwesenheit)
     - der kleine Aufschub fasst das zu einer Anfrage zusammen. */
  function anstossen() {
    if (!laeuft) return;
    ruhe = PAUSE_LEBHAFT;
    if (offen) { nachschlag = true; return; }
    lauf++;
    planen(lauf, 60);
  }
  R.anstossen = anstossen;

  /* Kommt der Tab wieder nach vorn, gleich nachsehen - im Hintergrund
     wurde ja nur einmal in der Minute gefragt. */
  try {
    document.addEventListener('visibilitychange', function () {
      if (!verdeckt()) anstossen();
    });
  } catch (e) { /* ohne document gibt es auch nichts aufzuwecken */ }

  R.starten = function () {
    if (laeuft || !R.verfuegbar()) return;
    laeuft = true;
    fehler = 0;
    lauf++;
    runde(lauf);
  };

  /* ------------------------------------------------------------------
     Von Hand auffrischen

     Eigentlich kommt alles von selbst - die Schleife haengt ja offen
     und antwortet, sobald sich etwas tut. Aber ein Browser drosselt
     verdeckte Tabs, ein iPad schlaeft ein, und ein WLAN in der Schule
     laesst auch mal eine Anfrage fallen. Dann steht man vor einer
     Ansicht und weiss nicht, ob nichts passiert ist oder nur nichts
     angekommen. Deshalb ein Knopf, der alles neu holt.
     ------------------------------------------------------------------ */

  R.auffrischen = function () {
    if (!R.verfuegbar()) return Promise.resolve(false);
    var arbeit = [];
    for (var n in kanaele) {
      if (kanaele[n].refs > 0) arbeit.push(frischKanal(n));
    }
    arbeit.push(SG.verwaltung.laden());
    laeuft = false;                 // die alte Schleife aufgeben
    R.starten();                    // startet sofort eine neue Runde
    return Promise.all(arbeit).then(function () { return true; },
      function () { return false; });
  };

  function frischKanal(name) {
    return post({ op: 'chat:read', brett: name }, 10000).then(function (res) {
      /* Beim Auffrischen faellt die Versionspruefung weg: wir wollen
         den Stand des Servers, auch wenn er gleich aussieht. */
      var k = R.kanal(name);
      k.version = res.version;
      k.nachrichten = res.nachrichten || [];
      k.bus.emit('nachrichten', k.nachrichten, k.version);
    }, function () { /* egal, die Schleife holt es nach */ });
  }

  R.stoppen = function () {
    laeuft = false;
    nachschlag = false;
    clearTimeout(timer);
    if (offen) { try { offen.abort(); } catch (e) { /* egal */ } offen = null; }
  };

  /* ------------------------------------------------------------------
     Bilder

     Werden einzeln abgelegt, nicht in der Nachricht. Sonst muesste die
     Schleife bei jeder neuen Nachricht das ganze Brett samt Bildern
     uebertragen. Der Zwischenspeicher hier sorgt dafuer, dass ein
     Bild nur einmal geholt wird.
     ------------------------------------------------------------------ */

  var bildCache = {};

  R.bildHochladen = function (voll, mini, w, h) {
    return post({ op: 'bild:put', data: voll, mini: mini, w: w, h: h }, 30000);
  };

  R.bildHolen = function (id, mini) {
    var k = (mini ? 'm' : 'v') + id;
    if (bildCache[k]) return Promise.resolve(bildCache[k]);
    return post({ op: 'bild:get', id: id, mini: !!mini }, 20000).then(function (res) {
      bildCache[k] = res.data;
      return res.data;
    });
  };

  /* ------------------------------------------------------------------ Befehle */

  R.befehlSenden = function (ziel, art, text, daten) {
    return post({
      op: 'befehl', ziel: ziel || '*', art: art, text: text || '',
      daten: daten || null, von: R.ich().name,
    }, 10000).then(function (res) { beschleunigen(); return res; });
  };

  /* ------------------------------------------------------------------ Bildschirm */

  R.schirmHochladen = function (datenUrl, w, h) {
    var ich = R.ich();
    return post({
      op: 'schirm:put', code: ich.code, name: ich.name,
      data: datenUrl, wo: R.wo, w: w, h: h,
    }, 20000);
  };

  /* ------------------------------------------------------------------ Klartext */

  R.klartext = function (e) {
    var m = String((e && e.message) || e);
    if (/abort/i.test(m)) return 'Zeitüberschreitung';
    if (/room_not_found/.test(m)) return 'Raum nicht gefunden';
    if (/room_full/.test(m)) return 'Raum ist voll';
    if (/bad_token/.test(m)) return 'Sitzung abgelaufen';
    if (/game_mismatch/.test(m)) return 'Der Code gehört zu einem anderen Spiel';
    if (/zu_gross/.test(m)) return 'Die Datei ist zu groß';
    if (/kein_code/.test(m)) return 'Ohne gültigen Code geht das nicht';
    if (/no_service/.test(m)) {
      return 'Auf dieser Seite läuft kein Online-Dienst. Die Netlify-Funktion '
        + 'fehlt — beim Hochladen des Ordners per Drag-and-drop wird sie nicht '
        + 'mitgeliefert. Gegen den Computer und zu zweit am selben iPad geht es weiter.';
    }
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Keine Verbindung';
    return m;
  };
})(SG);
