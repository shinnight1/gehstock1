/* ------------------------------------------------------------------
   Profilbild.

   Jeder kann sich ein Bild machen: ein Foto (Kamera oder Fotos) oder
   eine Figur aus einem Zeichen auf einer Farbe. Es steht im Profil,
   oben im Hub, in der Leiste jedes Spiels, im Warteraum der
   Online-Spiele und in GehstockMon ueber der eigenen Figur - dort
   sehen es auch alle anderen.

   Gespeichert wird zweimal: im Geraet (damit es sofort und auch
   offline da ist) und im Relais (room.mjs, profilbild:*), damit es auf
   jedem iPad und bei den anderen ankommt. Klein gehalten: 128 x 128
   Pixel JPEG, ein paar Kilobyte.

   Die Kennung eines Bildes ist dieselbe wie die GehstockMon-Spieler-
   kennung (sha256 aus dem Code, rechnet der Server). Die Version ist
   die Uhrzeit des Hochladens; sie reist in GehstockMon mit der
   Anwesenheit, damit ein neues Bild bei allen genau einmal geholt wird.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var UI = SG.ui;

  var PB = SG.profilbild = {};
  var bus = U.emitter();
  PB.on = bus.on;
  PB.off = bus.off;

  var KANTE = 128;                 // Kantenlaenge des gespeicherten Bildes
  var GUETE = 0.82;                // JPEG
  var SCHLUESSEL = 'profilbild';   // im Benutzerraum von SG.storage

  /* Die eigene Kennung, sobald der Server sie einmal genannt hat. */
  PB.id = null;

  function angemeldet() { return !!(SG.auth && SG.auth.aktuell); }
  function online() { return angemeldet() && !!SG.relais && SG.relais.verfuegbar(); }
  function meinCode() { return angemeldet() ? SG.auth.aktuell.code : ''; }
  function meinName() { return (angemeldet() && SG.auth.aktuell.name) || ''; }

  /* ---------------------------------------------------------- Eigenes */

  /* Eintrag im Geraet:
       { data, v, offen }    ein Bild; offen = der Server hat es noch nicht
       { weg: true, offen }  Abnehmen steht noch aus
     Kein Eintrag: kein Bild. */
  function eintrag() { return angemeldet() ? SG.storage.get(SCHLUESSEL, null) : null; }

  PB.eigenes = function () {
    var e = eintrag();
    return e && e.data ? e.data : null;
  };

  /* Was GehstockMon mit der Anwesenheit schickt. Erst, wenn der Server
     das Bild hat - sonst fragten die anderen nach etwas, das dort noch
     nicht liegt. */
  PB.version = function () {
    var e = eintrag();
    return e && e.data && !e.offen ? e.v || 0 : 0;
  };

  function geaendert() {
    kreiseAuffrischen();
    bus.emit('aenderung', PB.eigenes());
  }

  /* Beide liefern true, wenn der Server es schon hat, sonst false -
     dann geht es beim naechsten Anmelden mit Verbindung hoch. */
  PB.setzen = function (data) {
    if (!angemeldet()) return Promise.resolve(false);
    SG.storage.set(SCHLUESSEL, { data: data, v: Date.now(), offen: true });
    geaendert();
    return nachreichen();
  };

  PB.entfernen = function () {
    if (!angemeldet()) return Promise.resolve(false);
    SG.storage.set(SCHLUESSEL, { weg: true, offen: true });
    geaendert();
    return nachreichen();
  };

  /* Bringt eine ausstehende Aenderung zum Server. */
  function nachreichen() {
    var e = eintrag();
    if (!e || !e.offen || !online()) return Promise.resolve(false);
    var code = meinCode();
    var anfrage = e.weg
      ? { op: 'profilbild:weg', code: code }
      : { op: 'profilbild:put', code: code, data: e.data };
    return SG.relais.post(anfrage, 20000).then(function (res) {
      if (meinCode() !== code) return false;
      var jetzt = eintrag();
      /* Inzwischen schon wieder geaendert? Dann gilt das Neuere, und
         das bringt sein eigener Aufruf zum Server. */
      if (!jetzt || !!jetzt.weg !== !!e.weg || jetzt.data !== e.data) return false;
      PB.id = res.id;
      cache[res.id] = { v: res.v || 0, data: e.weg ? null : e.data };
      if (e.weg) SG.storage.del(SCHLUESSEL);
      else SG.storage.set(SCHLUESSEL, { data: e.data, v: res.v, offen: false });
      geaendert();
      return true;
    }, function () { return false; });
  }

  /* Beim Anmelden: steht noch etwas aus, geht es jetzt hoch. Sonst gilt,
     was der Server hat - ein Bild von einem anderen iPad ebenso wie
     ein Bild, das ein Admin abgenommen hat. */
  PB.abgleichen = function () {
    if (!online()) return Promise.resolve(false);
    var e = eintrag();
    if (e && e.offen) return nachreichen();
    var code = meinCode();
    return SG.relais.post({ op: 'profilbild:mein', code: code }, 15000).then(function (res) {
      if (meinCode() !== code) return false;
      PB.id = res.id;
      var jetzt = eintrag();
      if (jetzt && jetzt.offen) return false;
      if (res.data) {
        cache[res.id] = { v: res.v, data: res.data };
        if (!jetzt || jetzt.v !== res.v || jetzt.data !== res.data) {
          SG.storage.set(SCHLUESSEL, { data: res.data, v: res.v, offen: false });
          geaendert();
        }
      } else if (jetzt) {
        SG.storage.del(SCHLUESSEL);
        geaendert();
      }
      return true;
    }, function () { return false; });
  };

  SG.storage.on('user', function () {
    PB.id = null;
    geaendert();
    if (angemeldet()) setTimeout(PB.abgleichen, 1500);
  });

  /* ---------------------------------------------------------- Fremde */

  var cache = {};       // Kennung -> { v, data }  (data null: hat keins)
  var gefragt = {};     // Kennung -> { v, liste }  wartet auf die naechste Abfrage
  var unterwegs = {};   // Kennung -> { v, liste }  Abfrage laeuft
  var sammler = 0;
  var pauseBis = 0;     // nach einem Fehler eine Weile nicht fragen

  /* Holt das Bild zu einer Kennung und ruft fertig(data|null).
       v > 0       diese Version (oder neuer) muss es sein
       v === 0     diese Person hat keins - gar nicht erst fragen
       v fehlt     was schon da ist, reicht; sonst einmal fragen
     Was in kurzer Folge gefragt wird, geht in einer Anfrage. */
  PB.holen = function (id, v, fertig) {
    if (!id) { fertig(null); return; }
    if (id === PB.id) { fertig(PB.eigenes()); return; }
    if (v === 0) { fertig(null); return; }
    var c = cache[id];
    if (c && (!v || c.v >= v)) { fertig(c.data); return; }
    if (!online() || Date.now() < pauseBis) { fertig(c ? c.data : null); return; }
    var g = unterwegs[id] || gefragt[id] || (gefragt[id] = { v: 0, liste: [] });
    g.v = Math.max(g.v, v || 0);
    g.liste.push(fertig);
    if (!sammler && gefragt[id]) sammler = setTimeout(abholen, 40);
  };

  function abholen() {
    sammler = 0;
    var ids = Object.keys(gefragt).slice(0, 40);
    if (!ids.length) return;
    var los = {};
    ids.forEach(function (id) { los[id] = unterwegs[id] = gefragt[id]; delete gefragt[id]; });
    if (Object.keys(gefragt).length) sammler = setTimeout(abholen, 40);
    SG.relais.post({ op: 'profilbild:get', code: meinCode(), ids: ids }, 20000).then(function (res) {
      var bilder = (res && res.bilder) || {};
      ids.forEach(function (id) {
        var b = bilder[id];
        /* Gemerkt wird mindestens die gefragte Version. Sonst fragte die
           Anwesenheit nach einem abgenommenen Bild alle paar Sekunden neu. */
        cache[id] = { v: Math.max(los[id].v, (b && b.v) || 0), data: b ? b.data : null };
        austeilen(id, los[id], cache[id].data);
      });
    }, function () {
      pauseBis = Date.now() + 30000;
      ids.forEach(function (id) { austeilen(id, los[id], cache[id] ? cache[id].data : null); });
    });
  }

  function austeilen(id, g, data) {
    delete unterwegs[id];
    g.liste.forEach(function (f) {
      try { f(data); } catch (e) { SG.noteError('profilbild', e); }
    });
  }

  /* Fuer den Admin: das Bild zu einem Code. Wer den Code kennt, darf
     es ohnehin sehen - der Server fragt nichts weiter. */
  PB.vonCode = function (code) {
    if (!online()) return Promise.resolve(null);
    return SG.relais.post({ op: 'profilbild:mein', code: code }, 15000).then(function (res) {
      return res.data || null;
    }, function () { return null; });
  };

  PB.abnehmenFuer = function (code) {
    return SG.relais.post({ op: 'profilbild:weg', code: meinCode(), ziel: code }, 15000)
      .then(function (res) {
        cache[res.id] = { v: Date.now(), data: null };
        if (code === meinCode()) { SG.storage.del(SCHLUESSEL); geaendert(); }
        return true;
      });
  };

  /* ---------------------------------------------------------- Anzeige */

  /* Ohne Bild: der Anfangsbuchstabe auf einer Farbe aus dem Namen -
     fuer jeden immer dieselbe. */
  var FARBEN = ['#3b7fc4', '#2f9e6e', '#c0572f', '#8b5cc4', '#b8892a', '#2f8fa3', '#b8447a', '#5f7d2f'];
  function farbe(name) {
    var h = 0, t = String(name || '?');
    for (var i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
    return FARBEN[h % FARBEN.length];
  }
  function buchstabe(name) {
    var t = String(name || '').trim();
    return t ? Array.from(t)[0].toUpperCase() : '?';
  }

  /* Der runde Kreis. Groesse und Rand kommen aus der Klasse. */
  PB.kreis = function (cls) {
    var k = UI.el('span.pb' + (cls ? '.' + cls.split(' ').join('.') : ''));
    k.setAttribute('aria-hidden', 'true');
    k.zeigen = function (data, name) {
      if (k._gezeigt && k._data === data && k._name === name) return;
      k._gezeigt = true; k._data = data; k._name = name;
      UI.clear(k);
      k.classList.toggle('leer', !data);
      if (data) {
        k.style.background = '';
        k.appendChild(UI.el('img', { src: data, alt: '', draggable: false }));
      } else {
        k.style.background = farbe(name);
        k.appendChild(UI.el('span', { text: buchstabe(name) }));
      }
    };
    return k;
  };

  /* Das eigene - folgt jeder Aenderung und jedem Wechsel der Person. */
  var eigene = [];
  PB.eigenerKreis = function (cls) {
    var k = PB.kreis(cls);
    k._seit = Date.now();
    k.zeigen(PB.eigenes(), meinName());
    k.classList.toggle('gast', !angemeldet());
    if (eigene.length > 30) aussortieren();
    eigene.push(k);
    return k;
  };
  /* Wer nicht mehr im Dokument haengt, faellt heraus - aber erst nach
     ein paar Sekunden, eingehaengt wird meist gleich nach dem Bauen.
     Sonst hielte jedes je geoeffnete Spiel seinen Kreis fest. */
  function aussortieren() {
    var jetzt = Date.now();
    eigene = eigene.filter(function (k) { return k.isConnected || jetzt - k._seit < 5000; });
  }
  function kreiseAuffrischen() {
    aussortieren();
    eigene.forEach(function (k) {
      k.zeigen(PB.eigenes(), meinName());
      k.classList.toggle('gast', !angemeldet());
    });
  }

  /* Das eines anderen. laden() stellt ihn spaeter auf jemand anderen
     oder eine neue Version um, ohne dass der Kreis flackert. */
  PB.fremderKreis = function (id, v, name, cls) {
    var k = PB.kreis(cls);
    k.laden = function (id2, v2, name2) {
      var wunsch = (id2 || '') + ':' + (v2 === undefined ? '' : v2) + ':' + (name2 || '');
      if (k._wunsch === wunsch) return;
      var anderePerson = k._id !== id2;
      k._wunsch = wunsch;
      k._id = id2;
      if (anderePerson || !k._data) k.zeigen(null, name2);
      PB.holen(id2, v2, function (data) { if (k._wunsch === wunsch) k.zeigen(data, name2); });
    };
    k.laden(id, v, name);
    return k;
  };

  /* ---------------------------------------------------------- Machen */

  var ZEICHEN = ['🦊', '🐼', '🐯', '🦁', '🐸', '🐙', '🦄', '🐲', '🐺', '🐧', '🦉', '🐵',
    '👾', '🤖', '👻', '💀', '🥷', '🧙', '🦸', '👑', '🎩', '😎', '🤠', '🥸',
    '⚽', '🎮', '🚀', '⚡', '🔥', '🌈', '⭐', '🍕'];
  var HINTERGRUENDE = ['#1f6feb', '#2f9e6e', '#d9480f', '#8b5cc4', '#f0b429', '#0f9fb8',
    '#d6336c', '#22262e'];

  /* Ein Foto aus der Datei holen und gleich verkleinern: ein Kamerabild
     hat zwoelf Megapixel, zum Zuschneiden reichen 1024 an der kurzen
     Seite. Das iPad dankt es mit Speicher. */
  function fotoLaden(datei) {
    return new Promise(function (fertig, schief) {
      if (!datei || !/^image\//.test(datei.type || '')) { schief(new Error('kein_bild')); return; }
      var url;
      try { url = URL.createObjectURL(datei); } catch (e) { schief(e); return; }
      var img = new Image();
      img.onload = function () {
        var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
        var f = Math.min(1, 1024 / Math.min(w, h));
        var cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.round(w * f));
        cv.height = Math.max(1, Math.round(h * f));
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        try { URL.revokeObjectURL(url); } catch (e) { /* egal */ }
        fertig(cv);
      };
      img.onerror = function () {
        try { URL.revokeObjectURL(url); } catch (e) { /* egal */ }
        schief(new Error('kein_bild'));
      };
      img.src = url;
    });
  }

  function bildAusDaten(data) {
    return new Promise(function (fertig) {
      var img = new Image();
      img.onload = function () { fertig(img); };
      img.onerror = function () { fertig(null); };
      img.src = data;
    });
  }

  /* Der Dialog zum Machen. Drei Wege: Kamera, Foto aus der Mediathek,
     Figur. Ein Foto laesst sich verschieben und heranzoomen - was im
     Kreis steht, wird gespeichert. */
  PB.bearbeiten = function (parent) {
    if (!angemeldet()) {
      UI.toast('Erst anmelden, dann gibt es ein Profilbild.', 'bad');
      return;
    }
    var GROESSE = 480;             // Zeichenflaeche (fuer scharfe Anzeige auf dem iPad)
    var st = { modus: 'leer', foto: null, cx: 0, cy: 0, zoom: 1, zeichen: ZEICHEN[0], farbe: HINTERGRUENDE[0], alt: null };

    var flaeche = UI.el('canvas.pb-flaeche', { width: GROESSE, height: GROESSE });
    var ctx = flaeche.getContext('2d');
    var zoomRegler = UI.el('input.pb-zoom', {
      type: 'range', min: '1', max: '4', step: '0.01', value: '1',
      'aria-label': 'Heranzoomen',
    });
    var zoomZeile = UI.el('label.pb-zoom-zeile', null, [
      UI.el('span', { text: '−' }), zoomRegler, UI.el('span', { text: '+' }),
    ]);
    var hinweis = UI.el('div.pb-hinweis');

    var figurFeld = UI.el('div.pb-figur');
    var zeichenGitter = UI.el('div.pb-zeichen');
    var farbZeile = UI.el('div.pb-farben');
    figurFeld.appendChild(zeichenGitter);
    figurFeld.appendChild(farbZeile);

    ZEICHEN.forEach(function (z) {
      zeichenGitter.appendChild(UI.el('button.pb-zeichen-k', {
        text: z, 'aria-label': 'Zeichen ' + z,
        on: { click: function () { st.zeichen = z; st.modus = 'figur'; auffrischen(); } },
      }));
    });
    HINTERGRUENDE.forEach(function (f) {
      farbZeile.appendChild(UI.el('button.pb-farbe', {
        'aria-label': 'Hintergrundfarbe', style: { background: f },
        dataset: { farbe: f },
        on: { click: function () { st.farbe = f; st.modus = 'figur'; auffrischen(); } },
      }));
    });

    function dateiWaehlen(kamera) {
      /* Der Stern steht bewusst getrennt: der Kommentar-Abzug im Build
         ist zeilenweise und haelt "image/" plus Stern sonst fuer den
         Anfang eines Blockkommentars. */
      var eingabe = UI.el('input', { type: 'file', accept: 'image/' + '*', style: { display: 'none' } });
      if (kamera) eingabe.setAttribute('capture', 'user');
      document.body.appendChild(eingabe);
      eingabe.addEventListener('change', function () {
        var datei = eingabe.files && eingabe.files[0];
        UI.remove(eingabe);
        if (!datei) return;
        hinweis.textContent = 'Wird geladen …';
        fotoLaden(datei).then(function (cv) {
          st.foto = cv;
          st.zoom = 1;
          zoomRegler.value = '1';
          st.cx = cv.width / 2;
          st.cy = cv.height / 2;
          st.modus = 'foto';
          auffrischen();
        }, function () {
          hinweis.textContent = 'Dieses Bild lässt sich nicht öffnen.';
        });
      });
      eingabe.click();
    }

    var wege = UI.el('div.pb-wege', null, [
      UI.btn('📷 Kamera', function () { dateiWaehlen(true); }, 'sm'),
      UI.btn('🖼 Foto wählen', function () { dateiWaehlen(false); }, 'sm'),
      UI.btn('🙂 Figur', function () { st.modus = 'figur'; auffrischen(); }, 'sm'),
    ]);

    /* Wie gross das Foto im Kreis steht: bei Zoom 1 fuellt die kurze
       Seite den Kreis gerade aus. */
    function massstab(groesse) {
      return groesse / Math.min(st.foto.width, st.foto.height) * st.zoom;
    }
    function begrenzen() {
      if (!st.foto) return;
      var halb = GROESSE / 2 / massstab(GROESSE);
      st.cx = Math.max(halb, Math.min(st.foto.width - halb, st.cx));
      st.cy = Math.max(halb, Math.min(st.foto.height - halb, st.cy));
    }

    function malen(c, groesse) {
      c.clearRect(0, 0, groesse, groesse);
      if (st.modus === 'foto' && st.foto) {
        var m = massstab(groesse);
        c.fillStyle = '#ffffff';
        c.fillRect(0, 0, groesse, groesse);
        c.drawImage(st.foto, groesse / 2 - st.cx * m, groesse / 2 - st.cy * m,
          st.foto.width * m, st.foto.height * m);
      } else if (st.modus === 'figur') {
        c.fillStyle = st.farbe;
        c.fillRect(0, 0, groesse, groesse);
        c.font = Math.round(groesse * 0.6) + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(st.zeichen, groesse / 2, groesse * 0.54);
      } else if (st.modus === 'alt' && st.alt) {
        c.drawImage(st.alt, 0, 0, groesse, groesse);
      } else {
        c.fillStyle = farbe(meinName());
        c.fillRect(0, 0, groesse, groesse);
        c.fillStyle = '#ffffff';
        c.font = '700 ' + Math.round(groesse * 0.42) + 'px system-ui,sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(buchstabe(meinName()), groesse / 2, groesse * 0.53);
      }
    }

    function auffrischen() {
      begrenzen();
      malen(ctx, GROESSE);
      zoomZeile.hidden = st.modus !== 'foto';
      figurFeld.hidden = st.modus !== 'figur';
      flaeche.classList.toggle('ziehbar', st.modus === 'foto');
      Array.prototype.forEach.call(zeichenGitter.children, function (b) {
        b.classList.toggle('an', b.textContent === st.zeichen);
      });
      Array.prototype.forEach.call(farbZeile.children, function (b) {
        b.classList.toggle('an', b.dataset.farbe === st.farbe);
      });
      hinweis.textContent = st.modus === 'foto'
        ? 'Mit dem Finger verschieben, mit dem Regler heranzoomen. Was im Kreis steht, wird dein Bild.'
        : st.modus === 'figur' ? 'Such dir ein Zeichen und eine Farbe aus.'
          : st.modus === 'alt' ? 'Dein jetziges Profilbild.'
            : 'Noch kein Profilbild. Mach ein Foto, nimm eins aus deinen Fotos oder bau dir eine Figur.';
      speichern.disabled = st.modus === 'leer' || st.modus === 'alt';
    }

    zoomRegler.addEventListener('input', function () {
      st.zoom = Number(zoomRegler.value) || 1;
      auffrischen();
    });

    /* Verschieben mit dem Finger. Ein Bildschirmpunkt ist hier
       GROESSE / angezeigte Breite Zeichenpunkte. */
    var zug = null;
    flaeche.addEventListener('pointerdown', function (e) {
      if (st.modus !== 'foto') return;
      zug = { id: e.pointerId, x: e.clientX, y: e.clientY };
      try { flaeche.setPointerCapture(e.pointerId); } catch (er) { /* egal */ }
      e.preventDefault();
    });
    flaeche.addEventListener('pointermove', function (e) {
      if (!zug || e.pointerId !== zug.id) return;
      var faktor = GROESSE / (flaeche.getBoundingClientRect().width || GROESSE) / massstab(GROESSE);
      st.cx -= (e.clientX - zug.x) * faktor;
      st.cy -= (e.clientY - zug.y) * faktor;
      zug.x = e.clientX;
      zug.y = e.clientY;
      auffrischen();
    });
    function loslassen(e) { if (zug && e.pointerId === zug.id) zug = null; }
    flaeche.addEventListener('pointerup', loslassen);
    flaeche.addEventListener('pointercancel', loslassen);

    var speichern = UI.btn('Speichern', function () {
      var aus = document.createElement('canvas');
      aus.width = aus.height = KANTE;
      var c = aus.getContext('2d');
      c.imageSmoothingQuality = 'high';
      malen(c, KANTE);
      var data;
      try { data = aus.toDataURL('image/jpeg', GUETE); } catch (e) {
        UI.toast('Das Bild ließ sich nicht speichern.', 'bad');
        return;
      }
      dlg.close();
      PB.setzen(data).then(function (amServer) {
        UI.toast(amServer ? 'Profilbild gespeichert.'
          : 'Gespeichert. Die anderen sehen es, sobald du wieder online bist.', 'good', 2800);
      });
    }, 'primary');

    var knoepfe = UI.el('div.pb-knoepfe', null, [
      PB.eigenes() ? UI.btn('Entfernen', function () {
        dlg.close();
        PB.entfernen().then(function () { UI.toast('Profilbild entfernt.'); });
      }, 'bad') : null,
      UI.el('div.spacer'),
      UI.btn('Abbrechen', function () { dlg.close(); }, 'ghost'),
      speichern,
    ]);

    var dlg = UI.modal({
      title: 'Profilbild',
      parent: parent,
      body: UI.el('div.pb-editor', null, [
        UI.el('div.pb-buehne', null, [flaeche]),
        zoomZeile,
        hinweis,
        wege,
        figurFeld,
        UI.el('p.small.muted.pb-sichtbar', {
          text: 'Dein Bild sehen alle: in GehstockMon über deiner Figur, im Warteraum '
            + 'der Online-Spiele und oben in jedem Spiel.',
        }),
        knoepfe,
      ]),
    });

    var alt = PB.eigenes();
    if (alt) {
      bildAusDaten(alt).then(function (img) {
        if (img && st.modus === 'leer') { st.alt = img; st.modus = 'alt'; auffrischen(); }
      });
    }
    auffrischen();
    return dlg;
  };
})(SG);
