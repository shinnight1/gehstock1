/* ------------------------------------------------------------------
   Die Tuer.

   Vier Ziffern auf einem richtigen Bedienfeld. Wer daneben liegt,
   bekommt zehn Sekunden lang ein Bild zu sehen und darf es danach
   erneut versuchen.

   Das Bild kommt aus src/assets/ und wird beim Bauen als Daten-URI
   eingebettet (SG.assets). Liegt dort nichts, wird ein gezeichneter
   Ersatz gezeigt - die Offline-Datei bleibt in beiden Faellen ohne
   externe Verweise.
   ------------------------------------------------------------------ */

(function (SG) {
  var UI = SG.ui;
  var G = SG.gfx;
  var A = SG.auth;

  var Gate = SG.gate = {};

  var SPERRE_MS = 10000;

  Gate.render = function (app, onFertig) {
    UI.clear(app);

    /* Gesperrtes Geraet: gar nicht erst das Tastenfeld zeigen. */
    var gsperre = SG.verhoer.geraetGebannt();
    if (gsperre) return geraetGesperrt(app, gsperre);

    /* Laeuft gegen dieses Geraet ein Verhoer, geht die Tuer nicht auf,
       bevor der Dienst entschieden hat. */
    var offenerFall = null;
    var abFaelle = SG.relais.beobachten(SG.verhoer.BRETT_FAELLE, function () {
      var f = SG.verhoer.eigenerFall();
      if (f && !offenerFall) { offenerFall = f; insVerhoer(f); }
    });
    var abFehl = SG.relais.beobachten(SG.verhoer.BRETT_FEHL);
    SG.relais.starten();

    /* Beide Bretter braucht nur die Tuer. Wer drin ist, soll sie nicht
       weiter mitschleppen - sonst haengen sie fuer immer an jeder
       Anfrage, obwohl sie niemanden mehr interessieren. */
    function fallAbo() { abFaelle(); abFehl(); }

    function insVerhoer(fall) {
      fallAbo();
      document.removeEventListener('keydown', aufTaste);
      var v = SG.verhoer.tuerVerhoer(app, fall, function () {
        v.destroy();
        Gate.render(app, onFertig);
      });
    }

    var wrap = UI.el('div.gate');
    app.appendChild(wrap);

    var box = UI.el('div.gate-box');
    wrap.appendChild(box);

    /* ---------------------------------------------------------- Anzeige */

    var eingabe = '';
    var offenerName = '';          // aus einer eingefuegten Einladung

    var punkte = UI.el('div.pin-punkte');
    var punktEl = [];
    for (var i = 0; i < A.stellen; i++) {
      var p = UI.el('div.pin-punkt');
      punktEl.push(p);
      punkte.appendChild(p);
    }

    var meldung = UI.el('div.gate-msg');

    /* ---------------------------------------------------------- Tastenfeld */

    var feld = UI.el('div.pinfeld');

    function taste(inhalt, cls, onDruck) {
      var b = UI.el('button.pintaste' + (cls ? '.' + cls : ''), {
        type: 'button',
        on: {
          pointerdown: function (e) {
            e.preventDefault();
            b.classList.add('gedrueckt');
            SG.audio.unlock();
            SG.audio.play('click');
            SG.settings.buzz(8);
            onDruck();
          },
          pointerup: function () { b.classList.remove('gedrueckt'); },
          pointercancel: function () { b.classList.remove('gedrueckt'); },
          pointerleave: function () { b.classList.remove('gedrueckt'); },
        },
      });
      if (typeof inhalt === 'string') b.textContent = inhalt;
      else b.appendChild(inhalt);
      return b;
    }

    function ziffer(z) {
      return taste(String(z), '', function () {
        if (gesperrt || eingabe.length >= A.stellen) return;
        eingabe += String(z);
        anzeigen();
        if (eingabe.length === A.stellen) {
          // Kurz stehen lassen, damit man den letzten Punkt noch sieht
          setTimeout(versuchen, 180);
        }
      });
    }

    for (var z = 1; z <= 9; z++) feld.appendChild(ziffer(z));
    feld.appendChild(taste('C', 'neben', function () {
      if (gesperrt) return;
      eingabe = '';
      anzeigen();
    }));
    feld.appendChild(ziffer(0));
    feld.appendChild(taste('⌫', 'neben', function () {
      if (gesperrt) return;
      eingabe = eingabe.slice(0, -1);
      anzeigen();
    }));

    function anzeigen() {
      for (var i = 0; i < punktEl.length; i++) {
        punktEl[i].classList.toggle('voll', i < eingabe.length);
      }
      if (meldung.textContent) meldung.textContent = '';
    }

    UI.add(box, [
      UI.el('div.gate-cane', { 'aria-hidden': 'true' }),
      UI.el('h1', { text: 'Herr Gehstocks Hideout' }),
      UI.el('p.gate-sub', { text: 'Vier Ziffern. Zutritt nur mit Code.' }),
      punkte,
      meldung,
      feld,
      UI.el('button.gate-einladung', {
        type: 'button',
        text: 'Einladung einfügen',
        on: { click: function () { einladungEingeben(); } },
      }),
      UI.el('p.gate-fuss', {
        text: 'Keinen Code? Frag einen Admin — jeder bekommt einen eigenen, '
          + 'und der Spielstand hängt daran.',
      }),
    ]);

    /* Tastatur am Rechner soll auch gehen */
    function aufTaste(e) {
      if (gesperrt) return;
      if (e.key >= '0' && e.key <= '9') {
        if (eingabe.length < A.stellen) {
          eingabe += e.key;
          anzeigen();
          if (eingabe.length === A.stellen) setTimeout(versuchen, 180);
        }
      } else if (e.key === 'Backspace') {
        eingabe = eingabe.slice(0, -1);
        anzeigen();
      } else if (e.key === 'Escape') {
        eingabe = '';
        anzeigen();
      }
    }
    document.addEventListener('keydown', aufTaste);

    /* ---------------------------------------------------------- Prüfen */

    var gesperrt = false;

    function versuchen() {
      var eingegeben = eingabe;
      var geprueft = A.pruefen(eingabe);
      if (!geprueft) {
        SG.audio.play('error');
        SG.settings.buzz(40);
        punkte.classList.add('falsch');
        setTimeout(function () { punkte.classList.remove('falsch'); }, 450);
        strafe(eingegeben);
        return;
      }
      /* Gesperrt heisst gesperrt - auch wenn der Code an sich stimmt.
         Die Sperrliste kommt vom Relais und liegt vor der Tuer schon
         bereit (siehe boot.js). */
      var bann = A.gebannt(geprueft.code);
      if (bann) {
        SG.audio.play('error');
        SG.settings.buzz(60);
        eingabe = '';
        anzeigen();
        gesperrtZeigen(bann);
        return;
      }
      SG.audio.play('win');
      if (offenerName) A.nameSetzen(geprueft.code, offenerName);
      var eintrag = A.anmelden(geprueft.code);
      SG.storage.uebernehmen();
      /* Wem gehoert dieses Geraet gerade? Steht nur lokal - der Dienst
         erfaehrt es erst, wenn von hier eine Meldung ausgeht. */
      SG.verhoer.nutzerMerken(eintrag.code, eintrag.name);
      SG.protokoll.schreiben('anmeldung',
        (eintrag.name || eintrag.code) + ' hat sich angemeldet ('
        + SG.relais.geraeteArt + ')', '', eintrag.code);
      fallAbo();
      document.removeEventListener('keydown', aufTaste);
      if (!eintrag.name) fragName(eintrag, weiter);
      else weiter(eintrag);
    }

    function weiter(eintrag) {
      Gate.willkommen(app, eintrag.name, function () { onFertig(eintrag); });
    }

    /* -------------------------------------------------- Gesperrter Code */

    function gesperrtZeigen(bann) {
      gesperrt = true;
      var deckel = UI.el('div.gate-strafe.gate-bann');
      UI.add(deckel, [
        UI.el('div.bann-zeichen', { text: '⛔' }),
        UI.el('div.gate-strafe-kopf', { text: 'Zugang gesperrt' }),
        UI.el('div.bann-grund', { text: bann.grund || 'Ohne Angabe' }),
        UI.el('div.bann-von', { text: 'Gesperrt von ' + (bann.von || 'Admin') }),
        UI.btn('Verstanden', function () {
          UI.remove(deckel);
          gesperrt = false;
        }, 'wide ghost'),
      ]);
      app.appendChild(deckel);
    }

    /* Einladung wie "Karl#4711" - der Name kommt gleich mit */
    function einladungEingeben() {
      var ef = UI.el('input', {
        type: 'text', placeholder: 'z. B. Karl#4711',
        style: {
          width: '100%', height: '48px', background: '#0b0e15',
          border: '1px solid var(--line)', borderRadius: '10px',
          color: 'var(--text)', padding: '0 12px', outline: 'none', fontSize: '17px',
        },
      });
      UI.modal({
        title: 'Einladung',
        body: [
          UI.el('p.small.muted', {
            text: 'Hast du eine Einladung bekommen, füg sie hier ein. '
              + 'Sie bringt den Namen gleich mit.',
          }),
          ef,
        ],
        actions: [
          { label: 'Abbrechen', cls: 'ghost' },
          {
            label: 'Übernehmen', cls: 'primary',
            onClick: function () {
              var teile = A.zerlegen(ef.value);
              offenerName = teile.name || '';
              eingabe = A.normieren(teile.code);
              anzeigen();
              if (eingabe.length === A.stellen) setTimeout(versuchen, 200);
            },
          },
        ],
      });
      setTimeout(function () { try { ef.focus(); } catch (e) { /* egal */ } }, 120);
    }

    /* -------------------------------------------------- Falscher Code */

    function strafe(versuch) {
      gesperrt = true;
      eingabe = '';
      anzeigen();

      var deckel = UI.el('div.gate-strafe');
      var rest = Math.ceil(SPERRE_MS / 1000);

      var bild;
      if (SG.assets && SG.assets.falschercode) {
        bild = UI.el('img.gate-bild', { src: SG.assets.falschercode, alt: '' });
      } else {
        var cv = UI.el('canvas.gate-bild');
        bild = cv;
        setTimeout(function () { ersatzBild(cv); }, 0);
      }

      var zaehler = UI.el('div.gate-zaehler', { text: rest + ' s' });
      var warnung = UI.el('div.gate-warnung');
      UI.add(deckel, [
        UI.el('div.gate-strafe-kopf', { text: 'Falscher Code' }),
        bild,
        zaehler,
        warnung,
      ]);
      app.appendChild(deckel);

      /* Melden, was hier passiert. Der Dienst zaehlt mit; nach drei
         Fehlversuchen in zwanzig Minuten macht er einen Fall auf und
         die Tuer geht in den Verhoerbildschirm. */
      SG.verhoer.melden(versuch).then(function (r) {
        if (r.fall) {
          offenerFall = r.fall;
          clearInterval(t);
          UI.remove(deckel);
          insVerhoer(r.fall);
          return;
        }
        var uebrig = SG.verhoer.GRENZE - r.anzahl;
        if (r.anzahl > 0 && uebrig > 0) {
          warnung.textContent = uebrig === 1
            ? 'Noch ein Fehlversuch, dann wird der Zugang überprüft.'
            : 'Noch ' + uebrig + ' Versuche, dann wird der Zugang überprüft.';
        }
      });

      var t = setInterval(function () {
        rest--;
        zaehler.textContent = rest + ' s';
        if (rest <= 0) {
          clearInterval(t);
          UI.remove(deckel);
          gesperrt = false;
        }
      }, 1000);
    }

    function ersatzBild(cv) {
      var w = 320, h = 320;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = w * dpr; cv.height = h * dpr;
      cv.style.width = '100%';
      var c = cv.getContext('2d');
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.fillStyle = '#0b0e15';
      c.fillRect(0, 0, w, h);
      G.glow(c, w / 2, h / 2, w * 0.45, '#ff5f6b', 0.25);
      /* G.text nimmt size/weight/color - font/fill waren hier wirkungslos
         und der Ersatz kam in weissem Standardtext heraus. */
      G.text(c, '⛔', w / 2, h * 0.42, {
        size: 110, align: 'center', baseline: 'middle',
      });
      G.text(c, 'Kein Zutritt', w / 2, h * 0.72, {
        size: 24, weight: 700, color: '#ffd3d7', align: 'center', baseline: 'middle',
      });
      G.text(c, 'Hier gehört ein Bild hin — siehe src/assets/', w / 2, h * 0.82, {
        size: 12, weight: 500, color: '#8794b1', align: 'center', baseline: 'middle',
      });
    }

    /* -------------------------------------------------- Name erfragen */

    function fragName(eintrag, fertig) {
      var nf = UI.el('input', {
        type: 'text', placeholder: 'Dein Name', maxLength: 18,
        style: {
          width: '100%', height: '48px', background: '#0b0e15',
          border: '1px solid var(--line)', borderRadius: '10px',
          color: 'var(--text)', padding: '0 12px', outline: 'none', fontSize: '17px',
        },
      });
      UI.modal({
        title: 'Willkommen',
        closable: false,
        body: [
          UI.el('p.small.muted', {
            text: 'Wie sollen dich die anderen nennen? Der Name steht später '
              + 'im Online-Modus über deinen Zügen.',
          }),
          nf,
        ],
        actions: [{
          label: 'Los geht\'s', cls: 'primary',
          onClick: function () {
            var name = (nf.value || '').trim() || 'Spieler';
            A.nameSetzen(eintrag.code, name);
            fertig(A.aktuell);
          },
        }],
      });
    }

    return {
      destroy: function () {
        document.removeEventListener('keydown', aufTaste);
        fallAbo();
        UI.clear(app);
      },
    };
  };

  /* ------------------------------------------------------------------
     Gesperrtes Geraet

     Trifft nicht den Code, sondern den Kasten. Wer hier steht, hat
     keinen Code - er hat geraten, und ein Admin hat den Antrag des
     Dienstes angenommen.
     ------------------------------------------------------------------ */

  function geraetGesperrt(app, sperre) {
    UI.clear(app);
    var wrap = UI.el('div.gate');
    wrap.appendChild(UI.el('div.gate-box.bann-box', null, [
      UI.el('div.bann-zeichen', { text: '⛔' }),
      UI.el('h1', { text: 'Dieses Gerät ist gesperrt' }),
      UI.el('p.gate-sub', { text: 'Der Zutritt wurde von der Administration entzogen.' }),
      UI.el('div.notice.warn', null, [
        UI.el('div', { text: sperre.grund || 'Ohne Angabe' }),
        UI.el('div.small.muted', {
          style: { marginTop: '6px' },
          text: 'Gesperrt von ' + (sperre.von || 'Admin')
            + ' · Kennung ' + SG.verhoer.kurz(SG.relais.geraet),
        }),
      ]),
      UI.el('p.gate-fuss', {
        text: 'Ein Admin kann die Sperre unter Admin → Sperren wieder aufheben.',
      }),
    ]));
    app.appendChild(wrap);

    /* Hebt jemand die Sperre auf, soll sich das hier sofort zeigen. */
    var ab = function () {
      if (!SG.verhoer.geraetGebannt()) {
        SG.verwaltung.off('aenderung', ab);
        location.reload();
      }
    };
    SG.verwaltung.on('aenderung', ab);
    SG.relais.starten();

    return { destroy: function () { SG.verwaltung.off('aenderung', ab); } };
  }

  /* ------------------------------------------------------------------
     Willkommen

     Der Gehstock zeichnet sich selbst: erst der Bogen, dann der Schaft,
     dann ein goldener Strich, der einmal darueberfaehrt. Danach der
     Name. Antippen ueberspringt alles.
     ------------------------------------------------------------------ */

  Gate.willkommen = function (app, name, fertig) {
    UI.clear(app);
    var wrap = UI.el('div.willk');
    var cv = UI.el('canvas.willk-bild');
    var text = UI.el('div.willk-text', null, [
      UI.el('div.willk-klein', { text: 'Herzlich willkommen' }),
      UI.el('div.willk-name', { text: name || 'Spieler' }),
    ]);
    var tipp = UI.el('div.willk-tipp', { text: 'Tippen zum Überspringen' });
    UI.add(wrap, [cv, text, tipp]);
    app.appendChild(wrap);

    var W = 260, H = 320;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = W * dpr; cv.height = H * dpr;
    var c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);

    /* Der Stock als ein durchgehender Pfad: Bogen oben, dann Schaft.
       Ueber die Bogenlaenge laesst er sich Stueck fuer Stueck zeichnen. */
    var MX = W * 0.52, BOGEN_Y = H * 0.26, BOGEN_R = W * 0.17;
    var SCHAFT_UNTEN = H * 0.86;
    var bogenLaenge = Math.PI * BOGEN_R;
    var schaftLaenge = SCHAFT_UNTEN - BOGEN_Y;
    var gesamt = bogenLaenge + schaftLaenge;

    function stockZeichnen(anteil) {
      var bis = gesamt * anteil;
      c.lineWidth = 13;
      c.lineCap = 'round';
      c.strokeStyle = '#f0b429';

      // Bogen von links unten ueber oben nach rechts
      var bogenAnteil = Math.min(1, bis / bogenLaenge);
      if (bogenAnteil > 0) {
        c.beginPath();
        c.arc(MX - BOGEN_R, BOGEN_Y, BOGEN_R, Math.PI, Math.PI + Math.PI * bogenAnteil);
        c.stroke();
      }
      // Schaft nach unten
      if (bis > bogenLaenge) {
        var s = Math.min(schaftLaenge, bis - bogenLaenge);
        c.beginPath();
        c.moveTo(MX, BOGEN_Y);
        c.lineTo(MX, BOGEN_Y + s);
        c.stroke();
      }
    }

    var t0 = 0, raf = 0, beendet = false;
    var DAUER = 2600;

    function bild(zeit) {
      if (!t0) t0 = zeit;
      var t = zeit - t0;
      c.clearRect(0, 0, W, H);

      // Zeichnen (0 – 1100 ms), weich beschleunigt und wieder abgebremst
      var p = Math.min(1, t / 1100);
      var weich = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      G.glow(c, MX, H * 0.5, W * 0.6, '#f0b429', 0.05 + weich * 0.14);
      stockZeichnen(weich);

      // Goldener Strich fährt einmal darüber (900 – 1900 ms)
      if (t > 900 && t < 1900) {
        var q = (t - 900) / 1000;
        var y = H * (0.05 + q * 1.0);
        var g = c.createLinearGradient(0, y - 34, 0, y + 34);
        g.addColorStop(0, 'rgba(255,209,102,0)');
        g.addColorStop(0.5, 'rgba(255,255,255,.75)');
        g.addColorStop(1, 'rgba(255,209,102,0)');
        c.save();
        c.globalCompositeOperation = 'source-atop';
        c.fillStyle = g;
        c.fillRect(0, y - 34, W, 68);
        c.restore();
      }

      // Text ab 1200 ms
      if (t > 1200 && !text.classList.contains('an')) text.classList.add('an');
      if (t > 2000 && !tipp.classList.contains('an')) tipp.classList.add('an');

      if (t < DAUER && !beendet) raf = requestAnimationFrame(bild);
      else ende();
    }

    function ende() {
      if (beendet) return;
      beendet = true;
      if (raf) cancelAnimationFrame(raf);
      wrap.classList.add('weg');
      setTimeout(function () { UI.remove(wrap); fertig(); }, 320);
    }

    wrap.addEventListener('pointerdown', ende);
    raf = requestAnimationFrame(bild);
    // Falls der Browser keine Bilder liefert (verdeckter Tab), nicht haengen bleiben
    setTimeout(ende, DAUER + 900);
  };
})(SG);
