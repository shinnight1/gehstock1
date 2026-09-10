/* ------------------------------------------------------------------
   Bundesnachrichtendienst.

   Eine zusaetzliche Freigabe neben der Rolle - ein Admin vergibt sie
   im Profil. Wer sie hat, sieht im Hub einen eigenen, breiten Knopf
   und dahinter eine kleine Lagezentrale:

     Lagebild     alle Leute, ohne ihre Codes, mit einer Ampel
     Vorgaenge    was auffaellig ist - vor allem zweite Geraete
     Antraege     Sperrung beantragen, Admins entscheiden
     Befragungen  ein eigener Raum je Person
     Protokoll    was der Dienst getan hat

   Zwei Dinge sind bewusst so gebaut:

   1. Codes stehen nirgends. Statt "0141" zeigt der Dienst "K7-M2" -
      eine Kennung, die sich aus dem Code errechnet. Damit laesst sich
      ueber jemanden sprechen, ohne dass sein Zugang auf dem Schirm
      steht, wenn einer ueber die Schulter guckt.

   2. Der Zugang verlangt eine zweite Bestaetigung: den Dienst-
      schluessel, sechs Ziffern, ebenfalls aus dem eigenen Code
      gerechnet - der Admin sieht ihn im Profil und gibt ihn weiter.
      Er gilt fuer eine Sitzung; nach dem Neuladen wieder von vorn.
   ------------------------------------------------------------------ */

(function (SG) {
  var UI = SG.ui;
  var U = SG.util;
  var A = SG.auth;
  var Rel = SG.relais;

  var B = SG.bnd = {};

  B.ANTRAEGE = 'antraege';

  var frei = false;              // Schleuse in dieser Sitzung passiert?

  B.frei = function () { return frei; };
  B.abmelden = function () { frei = false; };

  /* Wie viele Vorgaenge liegen an? Das ist die Zahl am Knopf im Hub. */
  B.offen = function () {
    var n = A.auffaellige().length;
    var k = Rel.kanal(B.ANTRAEGE);
    (k.nachrichten || []).forEach(function (m) {
      if (m.zusatz && m.zusatz.art && m.status === undefined && !m.weg) n++;
    });
    if (SG.verhoer) n += SG.verhoer.offeneFaelle().length;
    return n;
  };

  /* ==================================================================
     Der Bildschirm
     ================================================================== */

  B.render = function (app) {
    UI.clear(app);
    if (!A.istBnd()) { SG.router.go('#/'); return { destroy: function () { } }; }

    var lebt = true;
    var inhalt = null;

    if (!frei) {
      var schleuse = schleuseZeigen(app, function () {
        if (!lebt) return;
        frei = true;
        if (SG.protokoll) SG.protokoll.schreiben('bnd', 'Lagezentrale betreten');
        konsole();
      });
      return {
        destroy: function () { lebt = false; schleuse.destroy(); },
      };
    }
    konsole();

    function konsole() {
      if (!lebt) return;
      UI.clear(app);
      inhalt = konsoleBauen(app);
    }

    return {
      destroy: function () {
        lebt = false;
        if (inhalt && inhalt.destroy) inhalt.destroy();
      },
    };
  };

  /* ==================================================================
     Schleuse: Vorspann und Dienstschluessel
     ================================================================== */

  function schleuseZeigen(app, fertig) {
    var wrap = UI.el('div.bnd-schleuse');
    var cv = UI.el('canvas.bnd-vorspann');
    wrap.appendChild(cv);
    app.appendChild(wrap);

    var abbruch = UI.el('button.bnd-weg', {
      html: '‹ Zurück', type: 'button',
      on: { click: function () { SG.router.go('#/'); } },
    });
    wrap.appendChild(abbruch);

    var W = 640, H = 420;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = W * dpr; cv.height = H * dpr;
    var c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);

    var t0 = 0, raf = 0, vorbei = false;
    var DAUER = 2900;

    function bild(zeit) {
      if (!t0) t0 = zeit;
      var t = zeit - t0;
      zeichnen(c, W, H, t);
      if (t < DAUER && !vorbei) raf = requestAnimationFrame(bild);
      else ende();
    }

    function ende() {
      if (vorbei) return;
      vorbei = true;
      if (raf) cancelAnimationFrame(raf);
      schluesselFeld();
    }

    wrap.addEventListener('pointerdown', function (e) {
      if (e.target === abbruch) return;
      ende();
    });
    raf = requestAnimationFrame(bild);
    setTimeout(ende, DAUER + 1200);

    /* ---------------------------------------------------------- Vorspann */

    function zeichnen(ctx, w, h, t) {
      ctx.fillStyle = '#05070c';
      ctx.fillRect(0, 0, w, h);

      // Raster im Hintergrund, laeuft langsam nach oben
      ctx.save();
      ctx.globalAlpha = 0.14;
      ctx.strokeStyle = '#2b4a6b';
      ctx.lineWidth = 1;
      var off = (t * 0.03) % 28;
      for (var y = -28 + off; y < h; y += 28) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
      for (var x = 0; x < w; x += 28) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      ctx.restore();

      var mx = w / 2, my = h * 0.40;

      // Ring, der sich aufbaut (0 - 900 ms)
      var p1 = U.clamp(t / 900, 0, 1);
      var e1 = U.easeOutCubic(p1);
      SG.gfx.glow(ctx, mx, my, 150, '#1d5c8f', 0.05 + e1 * 0.16);
      ctx.save();
      ctx.strokeStyle = '#7fb5e6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mx, my, 96, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * e1);
      ctx.stroke();
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(mx, my, 112, -Math.PI / 2, -Math.PI / 2 - Math.PI * 2 * e1);
      ctx.stroke();
      ctx.restore();

      // Wappen (400 - 1500 ms)
      if (t > 400) {
        var p2 = U.clamp((t - 400) / 1100, 0, 1);
        ctx.save();
        ctx.globalAlpha = U.easeOutCubic(p2);
        wappen(ctx, mx, my, 62 * (0.86 + 0.14 * U.easeOutBack(p2)));
        ctx.restore();
      }

      // Schriftzug (1100 - 2100 ms), Buchstabe fuer Buchstabe
      if (t > 1100) {
        var wort = 'BUNDESNACHRICHTENDIENST';
        var n = Math.min(wort.length, Math.floor((t - 1100) / 34));
        SG.gfx.text(ctx, wort.slice(0, n), mx, h * 0.74, {
          size: 21, weight: 800, color: '#dce9f7', align: 'center', baseline: 'middle',
        });
        ctx.save();
        ctx.globalAlpha = 0.5;
        SG.gfx.text(ctx, 'LAGEZENTRALE · HIDEOUT', mx, h * 0.74 + 24, {
          size: 11, weight: 600, color: '#7fb5e6', align: 'center', baseline: 'middle',
        });
        ctx.restore();
      }

      // Warnbalken (ab 2000 ms), pulsierend
      if (t > 2000) {
        var puls = 0.55 + 0.45 * Math.sin(t / 150);
        ctx.save();
        ctx.globalAlpha = puls;
        SG.gfx.text(ctx, 'AUTHENTIFIZIERUNG ERFORDERLICH', mx, h * 0.92, {
          size: 12, weight: 700, color: '#ffb648', align: 'center', baseline: 'middle',
        });
        ctx.restore();
      }

      // Bildstoerung, damit es nicht zu sauber aussieht
      if (Math.random() < 0.25) {
        var sy = Math.random() * h;
        ctx.save();
        ctx.globalAlpha = 0.08;
        ctx.fillStyle = '#9fd0ff';
        ctx.fillRect(0, sy, w, 1 + Math.random() * 2);
        ctx.restore();
      }
    }

    function wappen(ctx, x, y, r) {
      // Schild
      ctx.beginPath();
      ctx.moveTo(x - r * 0.72, y - r * 0.78);
      ctx.lineTo(x + r * 0.72, y - r * 0.78);
      ctx.lineTo(x + r * 0.72, y + r * 0.16);
      ctx.quadraticCurveTo(x + r * 0.66, y + r * 0.86, x, y + r * 1.02);
      ctx.quadraticCurveTo(x - r * 0.66, y + r * 0.86, x - r * 0.72, y + r * 0.16);
      ctx.closePath();
      var g = ctx.createLinearGradient(x, y - r, x, y + r);
      g.addColorStop(0, '#123454');
      g.addColorStop(1, '#0a1c2e');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = '#7fb5e6';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Adler, stark vereinfacht: Koerper, zwei Schwingen, Kopf
      ctx.fillStyle = '#e8f2fd';
      ctx.beginPath();
      ctx.moveTo(x, y - r * 0.44);
      ctx.lineTo(x + r * 0.10, y - r * 0.20);
      ctx.lineTo(x + r * 0.06, y + r * 0.40);
      ctx.lineTo(x - r * 0.06, y + r * 0.40);
      ctx.lineTo(x - r * 0.10, y - r * 0.20);
      ctx.closePath();
      ctx.fill();

      [-1, 1].forEach(function (s) {
        ctx.beginPath();
        ctx.moveTo(x + s * r * 0.08, y - r * 0.26);
        ctx.lineTo(x + s * r * 0.60, y - r * 0.06);
        ctx.lineTo(x + s * r * 0.50, y + r * 0.06);
        ctx.lineTo(x + s * r * 0.56, y + r * 0.14);
        ctx.lineTo(x + s * r * 0.44, y + r * 0.22);
        ctx.lineTo(x + s * r * 0.10, y + r * 0.06);
        ctx.closePath();
        ctx.fill();
      });

      ctx.beginPath();
      ctx.arc(x, y - r * 0.50, r * 0.10, 0, Math.PI * 2);
      ctx.fill();
    }

    /* ---------------------------------------------------------- Schluessel */

    function schluesselFeld() {
      UI.clear(wrap);
      wrap.appendChild(abbruch);

      var soll = A.bndSchluessel(A.aktuell.code);
      var eingabe = '';
      var punkte = UI.el('div.pin-punkte.bnd-punkte');
      var punktEl = [];
      for (var i = 0; i < 6; i++) {
        var d = UI.el('div.pin-punkt');
        punktEl.push(d);
        punkte.appendChild(d);
      }
      var meldung = UI.el('div.bnd-meldung', { text: '' });

      var feld = UI.el('div.pinfeld.bnd-feld');
      function taste(txt, fn, cls) {
        return UI.el('button.pintaste' + (cls ? '.' + cls : ''), {
          type: 'button', text: txt,
          on: {
            pointerdown: function (e) {
              e.preventDefault();
              SG.audio.play('click');
              SG.settings.buzz(8);
              fn();
            },
          },
        });
      }
      function ziffer(z) {
        return taste(String(z), function () {
          if (eingabe.length >= 6) return;
          eingabe += String(z);
          malen();
          if (eingabe.length === 6) setTimeout(pruefen, 160);
        });
      }
      for (var z = 1; z <= 9; z++) feld.appendChild(ziffer(z));
      feld.appendChild(taste('C', function () { eingabe = ''; malen(); }, 'neben'));
      feld.appendChild(ziffer(0));
      feld.appendChild(taste('⌫', function () { eingabe = eingabe.slice(0, -1); malen(); }, 'neben'));

      function malen() {
        for (var i = 0; i < punktEl.length; i++) {
          punktEl[i].classList.toggle('voll', i < eingabe.length);
        }
        meldung.textContent = '';
      }

      /* Zweiter Teil: Hand auflegen. Kein zweites Geheimnis, nur eine
         bewusste Handlung - man soll hier nicht aus Versehen
         hineinrutschen. */
      var scanner = UI.el('div.bnd-scanner', null, [
        UI.el('div.bnd-scan-ring'),
        UI.el('div.bnd-scan-hand', { text: '🖐' }),
        UI.el('div.bnd-scan-text', { text: 'Hand auflegen und halten' }),
      ]);
      var haltTimer = 0;

      function scanStart() {
        scanner.classList.add('an');
        clearTimeout(haltTimer);
        haltTimer = setTimeout(function () {
          scanner.classList.remove('an');
          scanner.classList.add('gut');
          SG.audio.play('win');
          setTimeout(fertig, 320);
        }, 1600);
      }
      function scanStopp() {
        clearTimeout(haltTimer);
        scanner.classList.remove('an');
      }
      scanner.addEventListener('pointerdown', scanStart);
      scanner.addEventListener('pointerup', scanStopp);
      scanner.addEventListener('pointerleave', scanStopp);
      scanner.addEventListener('pointercancel', scanStopp);
      scanner.style.display = 'none';

      function pruefen() {
        if (eingabe !== soll) {
          SG.audio.play('error');
          SG.settings.buzz(60);
          punkte.classList.add('falsch');
          setTimeout(function () { punkte.classList.remove('falsch'); }, 450);
          meldung.textContent = 'Dienstschlüssel falsch.';
          eingabe = '';
          setTimeout(malen, 460);
          if (SG.protokoll) {
            SG.protokoll.schreiben('bnd', 'Fehlgeschlagene Anmeldung an der Lagezentrale');
          }
          return;
        }
        SG.audio.play('select');
        feld.style.display = 'none';
        punkte.style.display = 'none';
        meldung.textContent = 'Schlüssel akzeptiert. Zweiter Faktor.';
        scanner.style.display = '';
      }

      UI.add(wrap, [
        UI.el('div.bnd-kopf', null, [
          UI.el('div.bnd-wappen', { text: '🦅' }),
          UI.el('div.bnd-titel', { text: 'BUNDESNACHRICHTENDIENST' }),
          UI.el('div.bnd-unter', { text: 'Zugang nur mit Dienstschlüssel' }),
        ]),
        punkte,
        meldung,
        feld,
        scanner,
        UI.el('p.small.muted.center', {
          style: { marginTop: '14px' },
          text: 'Sechs Ziffern. Den Schlüssel kennt der Admin, der dir die '
            + 'Freigabe gegeben hat.',
        }),
      ]);
      malen();
    }

    return {
      destroy: function () {
        vorbei = true;
        if (raf) cancelAnimationFrame(raf);
      },
    };
  }

  /* ==================================================================
     Die Konsole
     ================================================================== */

  function konsoleBauen(app) {
    var reiter = 'lage';
    var abmelder = [];

    var kopf = UI.el('div.topbar.bnd-topbar', null, [
      UI.el('button.back.btn.sm.ghost', {
        html: '‹ Hideout',
        on: { click: function () { SG.router.go('#/'); } },
      }),
      UI.el('div.spacer'),
      UI.el('div.brand-title', { text: '🦅 Lagezentrale' }),
      UI.el('div.spacer'),
      UI.el('div.bnd-agent', {
        text: A.aktuell.name + ' · ' + A.bndKennung(A.aktuell.code),
      }),
      UI.frischKnopf(function () { bauen(); }),
    ]);
    app.appendChild(kopf);

    var schirm = UI.el('div.screen.bnd-schirm');
    var wrap = UI.el('div.wrap-1000');
    schirm.appendChild(wrap);
    app.appendChild(schirm);

    var tabs = UI.tabs([
      { id: 'lage', label: '📋 Lagebild' },
      { id: 'tuer', label: '🚪 Tür' },
      { id: 'vorgang', label: '⚠ Vorgänge' },
      { id: 'antrag', label: '📨 Anträge' },
      { id: 'befragung', label: '🎙 Befragungen' },
      { id: 'proto', label: '📜 Protokoll' },
    ], function (id) { reiter = id; bauen(); }, reiter);
    wrap.appendChild(tabs);

    var inhalt = UI.el('div.bnd-inhalt');
    wrap.appendChild(inhalt);

    /* Die Antragsliste wird laufend gebraucht - fuer die Zahl am
       Reiter und fuer die Ansicht selbst. */
    abmelder.push(Rel.beobachten(B.ANTRAEGE, function () {
      if (reiter === 'antrag' || reiter === 'vorgang') bauen();
    }));
    abmelder.push(Rel.beobachten(SG.verhoer.BRETT_FEHL, function () {
      if (reiter === 'tuer') bauen();
    }));
    /* Faelle betreffen zwei Reiter: die Tuer zeigt sie, und die
       Befragungsliste soll den Zustand mit anzeigen. */
    abmelder.push(Rel.beobachten(SG.verhoer.BRETT_FAELLE, function () {
      if (reiter === 'tuer' || reiter === 'befragung') bauen();
    }));
    /* Wer online ist, steht in der Anwesenheitsliste - das Lagebild
       zeigt es an, also muss es sie auch beobachten. */
    var online = {};
    var aufPraesenz = function (liste) {
      online = {};
      (liste || []).forEach(function (p) { online[p.code] = p; });
      if (reiter === 'lage') bauen();
    };
    Rel.on('praesenz', aufPraesenz);
    Rel.praesenzAn(true);
    abmelder.push(function () {
      Rel.off('praesenz', aufPraesenz);
      Rel.praesenzAn(false);
    });

    var aufVerw = function () { if (reiter !== 'proto') bauen(); };
    SG.verwaltung.on('aenderung', aufVerw);
    Rel.starten();

    bauen();

    function bauen() {
      UI.clear(inhalt);
      if (reiter === 'lage') lagebild(inhalt);
      else if (reiter === 'tuer') tuer(inhalt);
      else if (reiter === 'vorgang') vorgaenge(inhalt);
      else if (reiter === 'antrag') antraege(inhalt);
      else if (reiter === 'befragung') befragungen(inhalt);
      else protokollListe(inhalt);
    }

    /* ---------------------------------------------------------- Tür

       Was an der Codeeingabe schiefgeht. Ein Geraet, das drei falsche
       Codes hintereinander probiert hat, steht oben als offener Fall -
       da kann man hineingehen und befragen. */

    function tuer(ziel) {
      var VH = SG.verhoer;
      var offene = VH.offeneFaelle();
      var buendel = VH.buendel();

      ziel.appendChild(UI.el('p.small.muted', {
        text: 'Jeder falsche Code an der Tür wird hier vermerkt — mit Gerät, '
          + 'Zeitpunkt und der Zahl, die probiert wurde. Nach '
          + VH.GRENZE + ' Fehlversuchen in 20 Minuten geht die Tür in ein '
          + 'Verhör und wartet auf dich.',
      }));

      if (offene.length) {
        ziel.appendChild(UI.el('div.sec-head', null, [
          UI.el('h2', { text: '🚨 Offene Verhöre' }),
          UI.el('span.count', { text: String(offene.length) }),
        ]));
        offene.slice().reverse().forEach(function (f) {
          ziel.appendChild(fallKarte(f));
        });
      }

      var erledigt = VH.faelle().filter(function (f) { return f.status !== undefined; });
      if (erledigt.length) {
        ziel.appendChild(UI.el('div.sec-head', null, [
          UI.el('h2', { text: 'Erledigte Verhöre' }),
        ]));
        erledigt.slice().reverse().slice(0, 8).forEach(function (f) {
          ziel.appendChild(fallKarte(f));
        });
      }

      ziel.appendChild(UI.el('div.sec-head', null, [
        UI.el('h2', { text: 'Geräte mit Fehlversuchen' }),
        UI.el('span.count', { text: String(buendel.length) }),
      ]));

      if (!buendel.length) {
        ziel.appendChild(UI.empty('🚪', 'Nichts vorgefallen',
          'An der Tür hat sich niemand vertan.'));
        return;
      }

      buendel.forEach(function (b) {
        var p = b.profil || {};
        var gesperrt = VH.geraetGebannt(b.geraet);
        ziel.appendChild(UI.el('div.item.tap', {
          on: { click: function () { geraeteAkte(b); } },
        }, [
          UI.el('div.thumb.bnd-ampel.' + (gesperrt ? 'rot' : (b.versuche.length >= VH.GRENZE ? 'rot' : 'grau')), {
            text: '🚪',
          }),
          UI.el('div.main', null, [
            UI.el('div.t', {
              text: (p.art || 'Unbekannt') + ' · ' + VH.kurz(b.geraet),
            }),
            UI.el('div.d', {
              text: b.versuche.length + ' ' + U.plural(b.versuche.length, 'Fehlversuch', 'Fehlversuche')
                + ' · zuletzt ' + datum(b.letzte)
                + (p.letzterNutzer ? ' · zuletzt angemeldet: ' + p.letzterNutzer : ''),
            }),
          ]),
          UI.el('div.side', null, [
            UI.el('div.bnd-status.' + (gesperrt ? 'rot' : 'grau'), {
              text: gesperrt ? 'Gesperrt' : '›',
            }),
          ]),
        ]));
      });
    }

    function fallKarte(f) {
      var VH = SG.verhoer;
      var p = f.zusatz.profil || {};
      var offen = f.status === undefined;
      var karte = UI.el('div.antrag.' + (offen ? 'rot.offen' : 'erledigt'));
      UI.add(karte, [
        UI.el('div.antrag-kopf', null, [
          UI.el('span.antrag-ic', { text: offen ? '🚨' : '✔' }),
          UI.el('span.antrag-art', { text: 'Zutrittsversuch' }),
          UI.el('span.spacer'),
          UI.el('span.antrag-status', {
            text: offen ? 'wartet auf dich'
              : (f.status === 'frei' ? 'freigegeben · ' + (f.erledigtVon || '')
                : 'abgelehnt · ' + (f.erledigtVon || '')),
          }),
        ]),
        UI.el('div.antrag-ziel', {
          text: (p.art || 'Unbekanntes Gerät') + ' · ' + VH.kurz(f.zusatz.geraet),
        }),
        UI.el('div.antrag-grund', {
          text: 'Probiert: ' + (f.zusatz.versuche || []).join(' · ')
            + (p.letzterNutzer ? '\nDieses Gerät gehörte zuletzt ' + p.letzterNutzer : ''),
        }),
        UI.el('div.antrag-von', { text: new Date(f.t).toLocaleString('de-DE') }),
      ]);
      if (offen) {
        karte.appendChild(UI.el('div.antrag-knoepfe', null, [
          UI.btn('🎙 Verhör führen', function () {
            SG.router.go('#/verhoer/' + f.zusatz.geraet);
          }, 'primary'),
        ]));
      }
      return karte;
    }

    /* Alles, was ueber ein Geraet bekannt ist */
    function geraeteAkte(b) {
      var VH = SG.verhoer;
      var p = b.profil || {};
      var body = UI.el('div');

      UI.add(body, [
        UI.el('div.bnd-akte-kopf.rot', null, [
          UI.el('div.bnd-akte-name', { text: p.art || 'Unbekanntes Gerät' }),
          UI.el('div.bnd-akte-kennung', { text: VH.kurz(b.geraet) }),
          UI.el('div.bnd-akte-lage', {
            text: b.versuche.length + ' Fehlversuche · zuletzt ' + datum(b.letzte),
          }),
        ]),
        UI.el('div.sec-head', null, [UI.el('h2', { text: 'Probierte Codes' })]),
      ]);

      var liste = UI.el('div.vh-codes');
      b.versuche.slice().reverse().forEach(function (v) {
        liste.appendChild(UI.el('div.vh-code', null, [
          UI.el('span.vc-zahl', { text: v.code || '????' }),
          UI.el('span.vc-zeit', { text: datum(v.t) }),
        ]));
      });
      body.appendChild(liste);

      body.appendChild(UI.el('div.sec-head', null, [UI.el('h2', { text: 'Gerät' })]));
      body.appendChild(UI.kv([
        ['Art', p.art || '—'],
        ['Bildschirm', p.schirm || '—'],
        ['Fenster', p.fenster || '—'],
        ['Pixeldichte', p.dpr ? String(p.dpr) : '—'],
        ['Sprache', p.sprache || '—'],
        ['Zeitzone', p.zone || '—'],
        ['Berührpunkte', p.finger === undefined ? '—' : String(p.finger)],
        ['Rechenkerne', p.kerne ? String(p.kerne) : '—'],
        ['Vom Home-Bildschirm', p.standalone ? 'ja' : 'nein'],
        ['Zuletzt angemeldet', p.letzterNutzer
          ? p.letzterNutzer + (p.letzterNutzerT ? ' · ' + datum(p.letzterNutzerT) : '')
          : 'nie'],
        ['Kennung', VH.kurz(b.geraet)],
      ]));

      var gesperrt = VH.geraetGebannt(b.geraet);
      if (gesperrt) {
        body.appendChild(UI.el('div.notice.warn', {
          style: { marginTop: '10px' },
          html: '<b>⛔ Gesperrt</b> von ' + gesperrt.von + '<br>' + gesperrt.grund,
        }));
      }

      UI.modal({
        title: 'Geräteakte', body: body, wide: true,
        actions: [
          {
            label: '🎙 Verhör', cls: 'ghost',
            onClick: function () { SG.router.go('#/verhoer/' + b.geraet); },
          },
          { label: 'Fertig', cls: 'primary' },
        ],
      });
    }

    /* ---------------------------------------------------------- Lagebild */

    function lagebild(ziel) {
      var leute = A.liste();
      ziel.appendChild(UI.el('p.small.muted', {
        text: 'Alle bekannten Personen. Codes werden hier nicht angezeigt — '
          + 'nur die Kennung, die sich daraus errechnet.',
      }));

      if (!leute.length) {
        ziel.appendChild(UI.empty('📋', 'Keine Personen erfasst',
          'Sobald ein Admin Codes anlegt, stehen sie hier.'));
        return;
      }

      var rot = 0, gruen = 0;
      leute.forEach(function (p) {
        if (A.lageBewerten(p.code).farbe === 'rot') rot++; else gruen++;
      });
      ziel.appendChild(UI.el('div.bnd-zahlen', null, [
        zahl('Erfasst', String(leute.length), ''),
        zahl('Unauffällig', String(gruen), 'gruen'),
        zahl('Auffällig', String(rot), 'rot'),
      ]));

      leute.slice().sort(function (a, b) {
        var fa = A.lageBewerten(a.code).farbe === 'rot' ? 0 : 1;
        var fb = A.lageBewerten(b.code).farbe === 'rot' ? 0 : 1;
        return fa - fb || String(a.name).localeCompare(String(b.name));
      }).forEach(function (p) {
        ziel.appendChild(person(p));
      });
    }

    function zahl(k, v, cls) {
      return UI.el('div.bnd-zahl' + (cls ? '.' + cls : ''), null, [
        UI.el('div.v', { text: v }),
        UI.el('div.k', { text: k }),
      ]);
    }

    function person(p) {
      var lage = A.lageBewerten(p.code);
      var g = A.geraete(p.code);
      var da = online[p.code];
      var fall = SG.verhoer.personFall(p.code);
      var imVerhoer = fall && (fall.status === undefined || fall.status === 'abgelehnt');
      return UI.el('div.item.tap.bnd-person', {
        on: { click: function () { akte(p); } },
      }, [
        UI.el('div.thumb.bnd-ampel.' + lage.farbe + (da ? '.online' : ''), {
          text: A.rolleIcon(p.rolle),
        }),
        UI.el('div.main', null, [
          UI.el('div.t', {
            text: (p.name || 'ohne Namen') + (A.hatBnd(p.code) ? ' 🕵' : '')
              + (imVerhoer ? ' 🎙' : ''),
          }),
          UI.el('div.d', {
            text: A.bndKennung(p.code) + ' · ' + A.rolleName(p.rolle)
              + ' · ' + g.length + ' ' + U.plural(g.length, 'Gerät', 'Geräte')
              + (da ? ' · jetzt: ' + (da.wo || 'online') : ' · offline'),
          }),
        ]),
        UI.el('div.side', null, [
          UI.el('div.bnd-status.' + lage.farbe, { text: lage.text }),
        ]),
      ]);
    }

    /* ---------------------------------------------------------- Akte */

    function akte(p) {
      var lage = A.lageBewerten(p.code);
      var g = A.geraete(p.code);
      var body = UI.el('div');

      UI.add(body, [
        UI.el('div.bnd-akte-kopf.' + lage.farbe, null, [
          UI.el('div.bnd-akte-name', { text: p.name || 'ohne Namen' }),
          UI.el('div.bnd-akte-kennung', { text: A.bndKennung(p.code) }),
          UI.el('div.bnd-akte-lage', { text: lage.text }),
        ]),
        UI.el('div.sec-head', null, [UI.el('h2', { text: 'Geräte' })]),
      ]);

      if (!g.length) {
        body.appendChild(UI.el('p.small.muted', { text: 'Noch nie angemeldet.' }));
      } else {
        g.slice().sort(function (a, b) { return b.letzteSicht - a.letzteSicht; })
          .forEach(function (e, i) {
            body.appendChild(UI.el('div.bnd-geraet' + (i > 0 ? '.fremd' : ''), null, [
              UI.el('div.bg-art', { text: e.art || 'Unbekannt' }),
              UI.el('div.bg-zeit', {
                text: 'Zuerst ' + datum(e.ersteSicht) + ' · zuletzt ' + datum(e.letzteSicht),
              }),
              i > 0 ? UI.el('div.bg-warn', { text: 'Zweitgerät' }) : null,
            ]));
          });
      }

      if (g.length > 1) {
        body.appendChild(UI.el('div.notice.warn', {
          style: { marginTop: '10px' },
          html: '<b>Auffällig:</b> derselbe Zugang wurde auf ' + g.length
            + ' verschiedenen Geräten benutzt. Das ist der übliche Hinweis '
            + 'darauf, dass ein Code weitergegeben wurde.',
        }));
      }

      var b = A.gebannt(p.code);
      if (b) {
        body.appendChild(UI.el('div.notice.warn', {
          style: { marginTop: '10px' },
          html: '<b>Gesperrt</b> von ' + b.von + '<br>' + b.grund,
        }));
      }

      /* Freizeichnen: den Fall abhaken, ohne ihn zu vergessen. Taucht
         spaeter ein weiteres Geraet auf, springt die Ampel von selbst
         wieder auf Rot. */
      var kl = A.geklaert(p.code);
      body.appendChild(UI.el('div.sec-head', null, [
        UI.el('h2', { text: 'Bewertung' }),
      ]));
      if (kl && A.abgedeckt(p.code)) {
        body.appendChild(UI.el('div.notice', {
          html: '<b>✅ Geprüft</b> von ' + kl.von + ' am '
            + new Date(kl.t).toLocaleDateString('de-DE')
            + (kl.notiz ? '<br>' + kl.notiz : '')
            + '<br><span class="small">Kommt ein weiteres Gerät dazu, '
            + 'meldet sich der Vorgang von selbst wieder.</span>',
        }));
        body.appendChild(UI.btn('Freizeichnung aufheben', function () {
          A.freizeichnungAufheben(p.code);
          SG.protokoll.schreiben('bnd',
            'Freizeichnung aufgehoben: ' + (p.name || p.code), '', p.code);
          UI.toast('Wieder offen.', null);
          dlg.close();
          bauen();
        }, 'sm wide ghost'));
      } else {
        body.appendChild(UI.el('p.small.muted', {
          text: g.length > 1
            ? 'Wenn das zweite Gerät in Ordnung geht — der Rechner der Eltern, '
              + 'das alte iPad —, hak den Vorgang hier ab. Er zählt dann nicht '
              + 'mehr als offen.'
            : 'Nichts zu beanstanden.',
        }));
        var notiz = UI.el('input', {
          type: 'text', className: 'feld', maxLength: 120,
          placeholder: 'Notiz, z. B. „zweites Gerät ist der Familien-Mac"',
        });
        body.appendChild(notiz);
        body.appendChild(UI.btn('✅ Als unauffällig eintragen', function () {
          A.freizeichnen(p.code, (notiz.value || '').trim());
          SG.protokoll.schreiben('bnd',
            'Freigezeichnet: ' + (p.name || p.code)
            + ((notiz.value || '').trim() ? ' — ' + notiz.value.trim() : ''),
            '', p.code);
          UI.toast('Eingetragen.', 'good');
          dlg.close();
          bauen();
        }, 'sm wide primary'));
      }

      var dlg = UI.modal({
        title: 'Akte', body: body, wide: true,
        actions: [
          {
            label: '🎙 Befragung', cls: 'ghost',
            onClick: function () { befragungStarten(p); },
          },
          {
            label: '📨 Antrag stellen', cls: 'primary',
            onClick: function () { antragStellen(p); },
          },
        ],
      });
      return dlg;
    }

    function datum(t) {
      if (!t) return '—';
      var d = new Date(t);
      return d.getDate() + '.' + (d.getMonth() + 1) + '. '
        + String(d.getHours()).padStart(2, '0') + ':'
        + String(d.getMinutes()).padStart(2, '0');
    }

    /* ---------------------------------------------------------- Vorgaenge */

    function vorgaenge(ziel) {
      var liste = A.auffaellige();
      ziel.appendChild(UI.el('p.small.muted', {
        text: 'Was gerade nicht zusammenpasst. Ein zweites Gerät heißt fast '
          + 'immer: der Code ist weitergegeben worden.',
      }));
      if (!liste.length) {
        var gesperrt = Object.keys(A.banne()).length;
        ziel.appendChild(UI.empty('✅', 'Lage unauffällig',
          'Kein offener Zugang wird derzeit auf mehreren Geräten benutzt.'
          + (gesperrt ? ' (' + gesperrt + ' gesperrt — die stehen im Lagebild.)' : '')));
        return;
      }
      liste.forEach(function (v) {
        var p = A.liste().filter(function (x) { return x.code === v.code; })[0] || v;
        var el = person(p);
        el.classList.add('bnd-alarm');
        ziel.appendChild(el);
      });
    }

    /* ---------------------------------------------------------- Antraege */

    function antragStellen(p) {
      var art = 'sperrung';
      var grund = UI.el('textarea', {
        placeholder: 'Warum? Der Admin sieht diesen Text.', rows: 3, maxLength: 400,
        className: 'feld hoch',
      });

      var wahl = UI.el('div.row.wrap', { style: { gap: '6px' } });
      [
        { id: 'sperrung', label: '⛔ Sperrung' },
        { id: 'verwarnung', label: '⚠ Verwarnung' },
        { id: 'beobachtung', label: '👁 Beobachtung' },
      ].forEach(function (a) {
        var b = UI.btn(a.label, function () {
          art = a.id;
          [].forEach.call(wahl.children, function (x) {
            x.classList.remove('primary'); x.classList.add('ghost');
          });
          b.classList.remove('ghost'); b.classList.add('primary');
        }, 'sm' + (a.id === art ? ' primary' : ' ghost'));
        wahl.appendChild(b);
      });

      var dlg = UI.modal({
        title: '📨 Antrag an die Administration',
        body: [
          UI.el('div.notice', {
            html: '<b>' + (p.name || 'ohne Namen') + '</b> · ' + A.bndKennung(p.code),
          }),
          UI.el('div.sec-head', null, [UI.el('h2', { text: 'Art' })]),
          wahl,
          UI.el('div.sec-head', null, [UI.el('h2', { text: 'Begründung' })]),
          grund,
          UI.el('p.small.muted', {
            text: 'Ein Admin entscheidet. Bei einer angenommenen Sperrung ist '
              + 'der Zugang sofort gesperrt — auch mitten im Spiel.',
          }),
        ],
        actions: [
          { label: 'Abbrechen', cls: 'ghost' },
          {
            label: 'Antrag senden', cls: 'primary', keepOpen: true,
            onClick: function () {
              var t = (grund.value || '').trim();
              if (t.length < 4) { UI.toast('Bitte eine Begründung angeben.', 'bad'); return; }
              dlg.close();
              Rel.senden(B.ANTRAEGE, {
                text: t,
                zusatz: {
                  art: art,
                  ziel: p.code,
                  zielName: p.name || '',
                  kennung: A.bndKennung(p.code),
                },
              }).then(function () {
                UI.toast('Antrag ist raus.', 'good');
                if (SG.protokoll) {
                  SG.protokoll.schreiben('antrag',
                    'Antrag (' + art + ') gestellt gegen ' + (p.name || p.code)
                    + ': ' + U.trunc(t, 120), '', p.code);
                }
                befragungAnbieten(p);
              }, function () { UI.toast('Antrag kam nicht durch.', 'bad'); });
            },
          },
        ],
      });
    }

    function befragungAnbieten(p) {
      UI.confirm('Befragung einleiten?',
        'Der Antrag liegt beim Admin. Willst du ' + (p.name || 'die Person')
        + ' jetzt selbst befragen? Sie bekommt sofort eine Vorladung und '
        + 'landet im Befragungsraum.', 'Befragung einleiten')
        .then(function (ok) { if (ok) befragungStarten(p); });
    }

    /* Eine Befragung ist kein Hinweis, sondern ein Zustand: erst den
       Fall anlegen, dann den Betreffenden dorthin holen. Ohne den Fall
       koennte er das Fenster einfach wegtippen. */
    function befragungStarten(p) {
      SG.verhoer.personAnlegen(p.code, p.name,
        'Befragung eingeleitet').then(function () {
          Rel.befehlSenden(p.code, 'verhoer',
            'Der Bundesnachrichtendienst hat eine Befragung eingeleitet.');
          Rel.senden(raumName(p.code), {
            text: 'Befragung eingeleitet. Bitte beantworte die folgenden Fragen.',
          });
          if (SG.protokoll) {
            SG.protokoll.schreiben('befragung',
              'Befragung eingeleitet gegen ' + (p.name || p.code), '', p.code);
          }
          SG.router.go('#/befragung/' + p.code);
        });
    }

    function antraege(ziel) {
      var k = Rel.kanal(B.ANTRAEGE);
      var liste = (k.nachrichten || []).filter(function (m) { return m.zusatz && !m.weg; });
      ziel.appendChild(UI.el('p.small.muted', {
        text: 'Gestellte Anträge und was daraus geworden ist.',
      }));
      if (!liste.length) {
        ziel.appendChild(UI.empty('📨', 'Keine Anträge',
          'Über die Akte einer Person lässt sich ein Antrag stellen.'));
        return;
      }
      liste.slice().reverse().forEach(function (m) {
        ziel.appendChild(antragKarte(m, false));
      });
    }

    /* ---------------------------------------------------------- Befragungen */

    function befragungen(ziel) {
      ziel.appendChild(UI.el('p.small.muted', {
        text: 'Ein eigener Raum je Person. Beide Seiten sehen dasselbe.',
      }));
      var leute = A.liste();
      if (!leute.length) {
        ziel.appendChild(UI.empty('🎙', 'Niemand erfasst', ''));
        return;
      }
      leute.forEach(function (p) {
        var fall = SG.verhoer.personFall(p.code);
        var offen = fall && (fall.status === undefined || fall.status === 'abgelehnt');
        ziel.appendChild(UI.el('div.item.tap' + (offen ? '.bnd-alarm' : ''), {
          on: { click: function () { SG.router.go('#/befragung/' + p.code); } },
        }, [
          UI.el('div.thumb', { text: offen ? '🔒' : '🎙' }),
          UI.el('div.main', null, [
            UI.el('div.t', { text: p.name || 'ohne Namen' }),
            UI.el('div.d', {
              text: A.bndKennung(p.code)
                + (offen ? ' · sitzt im Verhör'
                  : (fall ? ' · zuletzt freigegeben von ' + (fall.erledigtVon || '—')
                    : ' · kein Vorgang')),
            }),
          ]),
          UI.el('div.side', null, [UI.el('div.s', { text: '›' })]),
        ]));
      });
    }

    /* ---------------------------------------------------------- Protokoll */

    function protokollListe(ziel) {
      var box = UI.el('div.proto-box');
      ziel.appendChild(box);
      var v = SG.adminraum.protokollAnsicht(box, function (m) {
        return !m.zusatz || ['bnd', 'antrag', 'befragung', 'bann', 'entbann', 'schirm']
          .indexOf(m.zusatz.art) >= 0;
      });
      abmelder.push(v.destroy);
    }

    return {
      destroy: function () {
        abmelder.forEach(function (f) { try { f(); } catch (e) { /* egal */ } });
        SG.verwaltung.off('aenderung', aufVerw);
      },
    };
  }

  /* ==================================================================
     Antragskarte - im BND und im Admin-Raum dieselbe
     ================================================================== */

  B.antragKarte = function (m, mitKnoepfen) {
    return antragKarte(m, mitKnoepfen);
  };

  function antragKarte(m, mitKnoepfen) {
    var z = m.zusatz || {};
    var arten = {
      sperrung: { icon: '⛔', name: 'Sperrung beantragt', cls: 'rot' },
      verwarnung: { icon: '⚠', name: 'Verwarnung beantragt', cls: 'gelb' },
      beobachtung: { icon: '👁', name: 'Beobachtung beantragt', cls: 'blau' },
      geraetesperre: { icon: '🚪', name: 'Gerätesperre beantragt', cls: 'rot' },
    };
    var a = arten[z.art] || { icon: '📨', name: 'Antrag', cls: '' };
    var offen = m.status === undefined;

    var karte = UI.el('div.antrag.' + a.cls + (offen ? '.offen' : '.erledigt'));
    UI.add(karte, [
      UI.el('div.antrag-kopf', null, [
        UI.el('span.antrag-ic', { text: a.icon }),
        UI.el('span.antrag-art', { text: a.name }),
        UI.el('span.spacer'),
        UI.el('span.antrag-status', {
          text: offen ? 'offen'
            : (m.status === 'ja' ? '✔ angenommen · ' + (m.erledigtVon || '')
              : '✖ abgelehnt · ' + (m.erledigtVon || '')),
        }),
      ]),
      UI.el('div.antrag-ziel', {
        text: (z.zielName || 'Unbekannt') + ' · ' + (z.kennung || ''),
      }),
      UI.el('div.antrag-grund', { text: m.text }),
      UI.el('div.antrag-von', {
        text: 'Von ' + m.von + ' · ' + new Date(m.t).toLocaleString('de-DE'),
      }),
    ]);

    if (mitKnoepfen && offen && A.istAdmin()) {
      karte.appendChild(UI.el('div.antrag-knoepfe', null, [
        UI.btn('✔ Annehmen', function () { entscheiden(m, true); }, 'primary'),
        UI.btn('✖ Ablehnen', function () { entscheiden(m, false); }, 'ghost'),
      ]));
    }
    return karte;
  }

  function entscheiden(m, ja) {
    var z = m.zusatz || {};
    var name = z.zielName || z.ziel;

    function fertig() {
      Rel.aendern(B.ANTRAEGE, m.id, {
        status: ja ? 'ja' : 'nein',
        erledigtVon: A.aktuell.name,
        erledigtT: Date.now(),
      });
    }

    if (!ja) {
      fertig();
      /* Lehnt ein Admin die Gerätesperre ab, muss die Tuer wieder
         aufgehen - sonst haengt der Betreffende fuer immer im
         Verhoerbildschirm fest. */
      if (z.art === 'geraetesperre') {
        var fall = SG.verhoer.fallVon(z.geraet);
        if (fall) {
          Rel.aendern(SG.verhoer.BRETT_FAELLE, fall.id, {
            status: 'frei', erledigtVon: A.aktuell.name, erledigtT: Date.now(),
          });
        }
      }
      SG.protokoll.schreiben('antrag', 'Antrag gegen ' + name + ' abgelehnt', '', z.ziel);
      UI.toast('Abgelehnt.', null);
      return;
    }

    /* Der Dienst kann keine Sperre setzen - er beantragt sie. Das gilt
       fuer Personen wie fuer Geraete. */
    if (z.art === 'geraetesperre') {
      UI.confirm('Gerät sperren?',
        'Dieses Gerät kommt danach gar nicht mehr an die Codeeingabe — '
        + 'egal, welchen Code jemand kennt. Aufheben lässt sich das im '
        + 'Admin-Menü unter Sperren.', 'Gerät sperren', true).then(function (ok) {
          if (!ok) return;
          SG.verhoer.geraetBannen(z.geraet,
            'Antrag ' + (m.von || 'BND') + ': ' + m.text, A.aktuell.name);
          Rel.befehlSenden(z.geraet, 'bann', 'Gerät gesperrt');
          fertig();
          SG.protokoll.schreiben('bann',
            'Gerät ' + SG.verhoer.kurz(z.geraet) + ' gesperrt (Antrag von ' + m.von + ')');
          UI.toast('Gerät gesperrt.', 'good');
        });
      return;
    }

    if (z.art === 'sperrung') {
      UI.confirm('Zugang sperren?',
        (name || 'Diese Person') + ' kommt danach nicht mehr herein und fliegt '
        + 'sofort heraus, auch mitten im Spiel. Aufheben lässt sich das im '
        + 'Admin-Menü unter Leute.', 'Sperren', true).then(function (ok) {
          if (!ok) return;
          A.bannSetzen(z.ziel, 'Antrag ' + (m.von || 'BND') + ': ' + m.text, A.aktuell.name);
          Rel.befehlSenden(z.ziel, 'bann', 'Zugang gesperrt');
          fertig();
          SG.protokoll.schreiben('bann',
            name + ' gesperrt (Antrag von ' + m.von + ')', '', z.ziel);
          UI.toast(name + ' ist gesperrt.', 'good');
        });
      return;
    }

    fertig();
    SG.protokoll.schreiben('antrag',
      'Antrag (' + z.art + ') gegen ' + name + ' angenommen', '', z.ziel);
    if (z.art === 'verwarnung') {
      Rel.befehlSenden(z.ziel, 'hinweis',
        '⚠ Verwarnung: ' + m.text);
    }
    UI.toast('Angenommen.', 'good');
  }

  /* ==================================================================
     Befragungsraum
     ================================================================== */

  function raumName(code) { return SG.verhoer.raumPerson(code); }
  B.raumName = raumName;

  B.befragung = function (app, code) {
    code = A.normieren(code);
    var VH = SG.verhoer;
    var ichBinZiel = A.aktuell && A.aktuell.code === code;
    if (!A.istBnd() && !ichBinZiel) { SG.router.go('#/'); return { destroy: function () { } }; }

    var name = A.nameVon(code) || A.bndKennung(code);
    /* Sitzt die Person fest, gibt es hier keinen Rueckweg - der Knopf
       'Zurueck' waere ein Ausgang, den es nicht geben soll. */
    var eingesperrt = ichBinZiel && !!VH.eigenePerson();

    var werkzeug = UI.el('div.row', { style: { gap: '6px' } }, [
      UI.frischKnopf(),
      A.istBnd() && !ichBinZiel ? fragenKnopf(code) : null,
    ]);

    var v = SG.chat.bildschirm(app, {
      brett: VH.raumPerson(code),
      titel: '🎙 Befragung · ' + (ichBinZiel ? 'Dich' : name),
      zurueck: ichBinZiel ? '#/' : '#/bnd',
      ohneZurueck: eingesperrt,
      platzhalter: ichBinZiel ? 'Deine Antwort…' : 'Frage stellen…',
      loeschen: false,
      umfragen: false,
      werkzeug: werkzeug,
      leerIcon: '🎙',
      leerTitel: 'Befragungsraum',
      leerText: ichBinZiel
        ? 'Hier stellt der Dienst seine Fragen. Antworte ehrlich.'
        : 'Stell deine Fragen. Die Person sieht diesen Raum ebenfalls.',
    });

    var leiste = leisteEinhaengen(app);
    var ab = Rel.beobachten(VH.BRETT_FAELLE, malen);
    malen();

    function malen() {
      UI.clear(leiste);
      var fall = VH.personFall(code);
      var offen = fall && (fall.status === undefined || fall.status === 'abgelehnt');

      if (ichBinZiel) {
        /* Die Sicht des Befragten: nur eine Zeile, die sagt, woran man
           ist. Kein Knopf - es gibt hier nichts zu entscheiden. */
        if (!offen) {
          leiste.appendChild(UI.el('div.vh-hinweis.gut', {
            text: '✅ Die Befragung ist beendet.',
          }));
          leiste.appendChild(UI.btn('Weiter zum Hideout', function () {
            SG.router.go('#/');
          }, 'sm primary'));
        } else if (fall && fall.status === 'abgelehnt') {
          leiste.appendChild(UI.el('div.vh-hinweis.schlecht', {
            text: '⛔ Der Vorgang liegt bei der Administration.',
          }));
        } else {
          leiste.appendChild(UI.el('div.vh-hinweis', {
            text: '🔒 Der Raum ist verschlossen, bis der Dienst freigibt.',
          }));
        }
        return;
      }

      if (!A.istBnd()) return;

      if (!fall) {
        leiste.appendChild(UI.btn('🎙 Verhör eröffnen', function () {
          VH.personAnlegen(code, name).then(function () {
            Rel.befehlSenden(code, 'verhoer',
              'Der Bundesnachrichtendienst hat eine Befragung eingeleitet.');
            UI.toast('Die Person sitzt jetzt im Raum fest.', 'good');
            malen();
          });
        }, 'primary wide'));
        return;
      }
      if (fall.status === 'frei') {
        leiste.appendChild(UI.el('div.vh-hinweis.gut', {
          text: '✅ Freigegeben von ' + (fall.erledigtVon || '—'),
        }));
        leiste.appendChild(UI.btn('Erneut eröffnen', function () {
          VH.personAnlegen(code, name).then(function () {
            Rel.befehlSenden(code, 'verhoer', 'Erneute Befragung.');
            malen();
          });
        }, 'sm ghost'));
        return;
      }
      if (fall.status === 'abgelehnt') {
        leiste.appendChild(UI.el('div.vh-hinweis.schlecht', {
          text: '⛔ Abgelehnt — Sperre bei der Administration beantragt.',
        }));
        return;
      }

      UI.add(leiste, [
        UI.btn('✅ Freigeben', function () {
          UI.confirm('Freigeben?',
            (name || 'Die Person') + ' kommt danach sofort wieder heraus.',
            'Freigeben').then(function (ok) {
              if (ok) VH.personFreigeben(fall);
            });
        }, 'primary'),
        UI.btn('⛔ Ablehnen', function () { ablehnenDialog(fall); }, 'bad'),
      ]);
    }

    function ablehnenDialog(fall) {
      var grund = UI.el('textarea', {
        placeholder: 'Was hat die Befragung ergeben?',
        rows: 3, maxLength: 300, className: 'feld hoch',
      });
      var dlg = UI.modal({
        title: 'Ablehnen',
        body: [
          UI.el('p.small.muted', {
            text: 'Sperren darfst du nicht selbst — es geht ein Antrag an die '
              + 'Administration. Bis dort entschieden ist, bleibt die Person '
              + 'im Raum.',
          }),
          grund,
        ],
        actions: [
          { label: 'Abbrechen', cls: 'ghost' },
          {
            label: 'Ablehnen und beantragen', cls: 'bad', keepOpen: true,
            onClick: function () {
              var t = (grund.value || '').trim();
              if (t.length < 4) { UI.toast('Bitte kurz begründen.', 'bad'); return; }
              dlg.close();
              VH.personAblehnen(fall, t);
              UI.toast('Antrag ist bei der Administration.', 'good');
            },
          },
        ],
      });
    }

    return {
      destroy: function () {
        ab();
        v.destroy();
      },
    };
  };

  /* Haengt die Entscheidungsleiste zwischen Chatliste und Eingabe. */
  function leisteEinhaengen(app) {
    var leiste = UI.el('div.vh-entscheidung');
    var schirm = app.querySelector('.chat-schirm');
    if (schirm && schirm.parentNode) {
      schirm.parentNode.insertBefore(leiste, schirm.nextSibling);
    } else {
      app.appendChild(leiste);
    }
    return leiste;
  }

  /* ==================================================================
     Verhoerraum - die Seite des Dienstes

     Gegenstueck zu SG.verhoer.tuerVerhoer. Dort sitzt jemand vor
     verschlossener Tuer; hier wird entschieden, ob sie aufgeht.
     ================================================================== */

  B.verhoerRaum = function (app, geraet) {
    var VH = SG.verhoer;
    if (!A.istBnd()) { SG.router.go('#/'); return { destroy: function () { } }; }

    var fall = VH.fallVon(geraet);
    var p = (fall && fall.zusatz.profil) || {};

    var werkzeug = UI.el('div.row', { style: { gap: '6px' } }, [
      UI.frischKnopf(),
      UI.el('button.btn.sm.ghost', {
        html: '<span class="ico">❓</span>',
        'aria-label': 'Fragenkatalog',
        on: { click: function () { katalog(); } },
      }),
      UI.el('button.btn.sm.ghost', {
        html: '<span class="ico">📄</span>',
        'aria-label': 'Geräteakte',
        on: { click: function () { akteZeigen(); } },
      }),
    ]);

    var v = SG.chat.bildschirm(app, {
      brett: VH.raum(geraet),
      titel: '🎙 Verhör · ' + (p.art || 'Gerät') + ' ' + VH.kurz(geraet),
      zurueck: '#/bnd',
      platzhalter: 'Frage stellen…',
      loeschen: false,
      bilder: false,
      umfragen: false,
      werkzeug: werkzeug,
      leerIcon: '🎙',
      leerTitel: 'Verhörraum',
      leerText: 'Der Befragte sieht diesen Raum ebenfalls. Stell deine Fragen.',
    });

    /* Die Entscheidungsleiste sitzt ueber der Eingabe - sie ist der
       Zweck dieses Raums und soll nicht im Menue verschwinden. */
    var leiste = leisteEinhaengen(app);

    function malen() {
      UI.clear(leiste);
      var jetzt = VH.fallVon(geraet);
      if (!jetzt) {
        leiste.appendChild(UI.el('div.vh-hinweis', {
          text: 'Kein offener Vorgang für dieses Gerät.',
        }));
        return;
      }
      if (jetzt.status === 'frei') {
        leiste.appendChild(UI.el('div.vh-hinweis.gut', {
          text: '✅ Freigegeben von ' + (jetzt.erledigtVon || '—'),
        }));
        return;
      }
      if (jetzt.status === 'abgelehnt') {
        leiste.appendChild(UI.el('div.vh-hinweis.schlecht', {
          text: '⛔ Abgelehnt — Sperre bei der Administration beantragt.',
        }));
        return;
      }
      UI.add(leiste, [
        UI.btn('✅ Freigeben', function () {
          UI.confirm('Freigeben?',
            'Die Tür geht sofort wieder auf und der Betreffende kann seinen '
            + 'Code eingeben.', 'Freigeben').then(function (ok) {
              if (ok) VH.freigeben(jetzt);
            });
        }, 'primary'),
        UI.btn('⛔ Ablehnen', function () {
          var grund = UI.el('textarea', {
            placeholder: 'Was hat die Befragung ergeben?',
            rows: 3, maxLength: 300, className: 'feld hoch',
          });
          var dlg = UI.modal({
            title: 'Ablehnen',
            body: [
              UI.el('p.small.muted', {
                text: 'Sperren darfst du nicht selbst — es geht ein Antrag an die '
                  + 'Administration. Bis dort entschieden ist, bleibt die Tür zu.',
              }),
              grund,
            ],
            actions: [
              { label: 'Abbrechen', cls: 'ghost' },
              {
                label: 'Ablehnen und beantragen', cls: 'bad', keepOpen: true,
                onClick: function () {
                  var t = (grund.value || '').trim();
                  if (t.length < 4) { UI.toast('Bitte kurz begründen.', 'bad'); return; }
                  dlg.close();
                  VH.ablehnen(jetzt, t);
                  UI.toast('Antrag ist bei der Administration.', 'good');
                },
              },
            ],
          });
        }, 'bad'),
      ]);
    }

    function katalog() {
      var fragen = [
        'Wer bist du?',
        'Wem gehört dieses Gerät?',
        'Warum probierst du fremde Codes durch?',
        'Von wem hast du die Zahlen, die du eingegeben hast?',
        'Kennst du jemanden aus dem Hideout persönlich?',
        'Möchtest du dazu etwas sagen, bevor entschieden wird?',
      ];
      var body = UI.el('div');
      var dlg = UI.modal({ title: 'Fragenkatalog', body: body });
      fragen.forEach(function (f) {
        body.appendChild(UI.el('div.item.tap', {
          on: {
            click: function () {
              dlg.close();
              Rel.senden(VH.raum(geraet), { text: f });
            },
          },
        }, [
          UI.el('div.thumb', { text: '❓' }),
          UI.el('div.main', null, [UI.el('div.t', { text: f })]),
        ]));
      });
    }

    function akteZeigen() {
      UI.modal({
        title: 'Geräteakte', wide: true,
        body: [
          UI.el('div.bnd-akte-kopf.rot', null, [
            UI.el('div.bnd-akte-name', { text: p.art || 'Unbekanntes Gerät' }),
            UI.el('div.bnd-akte-kennung', { text: VH.kurz(geraet) }),
          ]),
          UI.el('div.sec-head', null, [UI.el('h2', { text: 'Probierte Codes' })]),
          UI.el('div.vh-codes', null, ((fall && fall.zusatz.versuche) || [])
            .map(function (c) {
              return UI.el('div.vh-code', null, [UI.el('span.vc-zahl', { text: c })]);
            })),
          UI.el('div.sec-head', null, [UI.el('h2', { text: 'Gerät' })]),
          UI.kv([
            ['Art', p.art || '—'],
            ['Bildschirm', p.schirm || '—'],
            ['Sprache', p.sprache || '—'],
            ['Zeitzone', p.zone || '—'],
            ['Berührpunkte', p.finger === undefined ? '—' : String(p.finger)],
            ['Zuletzt angemeldet', p.letzterNutzer || 'nie'],
          ]),
        ],
        actions: [{ label: 'Fertig', cls: 'primary' }],
      });
    }

    malen();
    var ab = Rel.beobachten(VH.BRETT_FAELLE, function () { malen(); });

    return {
      destroy: function () {
        ab();
        v.destroy();
      },
    };
  };

  function fragenKnopf(code) {
    return UI.el('button.btn.sm.ghost', {
      html: '<span class="ico">❓</span><span class="lbl">Fragen</span>',
      on: {
        click: function () {
          var fragen = [
            'Auf wie vielen Geräten benutzt du deinen Code?',
            'Hast du deinen Code jemandem weitergegeben?',
            'Wer hat dir den Code gegeben?',
            'Wann hast du dich zuletzt an einem fremden Gerät angemeldet?',
            'Kennst du noch jemanden, der denselben Code benutzt?',
            'Möchtest du dazu etwas sagen, bevor entschieden wird?',
          ];
          var body = UI.el('div');
          var dlg = UI.modal({ title: 'Fragenkatalog', body: body });
          fragen.forEach(function (f) {
            body.appendChild(UI.el('div.item.tap', {
              on: {
                click: function () {
                  dlg.close();
                  Rel.senden(raumName(code), { text: f });
                },
              },
            }, [
              UI.el('div.thumb', { text: '❓' }),
              UI.el('div.main', null, [UI.el('div.t', { text: f })]),
            ]));
          });
        },
      },
    });
  }
})(SG);
