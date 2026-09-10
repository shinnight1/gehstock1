/* ------------------------------------------------------------------
   Wache.

   Zwei Aufgaben, die nirgends sonst hingehoeren:

   1. Sperren durchsetzen. Ein Bann wirkt nicht erst beim naechsten
      Anmelden - wer gesperrt wird, fliegt sofort heraus, auch mitten
      im Spiel. Sonst waere eine Sperre erst wirksam, wenn sich der
      Betreffende freiwillig abmeldet.

   2. Befehle ausfuehren, die ueber die gemeinsame Verbindung
      hereinkommen: Tarnung fuer alle, eine Befragung, ein Hinweis.
   ------------------------------------------------------------------ */

(function (SG) {
  var UI = SG.ui;
  var A = SG.auth;
  var Rel = SG.relais;

  var W = SG.wache = {};

  var raus = false;

  W.starten = function () {
    SG.verwaltung.on('aenderung', pruefen);
    Rel.on('befehl', aufBefehl);

    /* Ein Verhoer greift sofort, nicht erst beim naechsten Antippen.
       Deshalb haengt die Wache dauerhaft am Fallbrett - der Betreffende
       landet innerhalb einer Sekunde im Raum, egal wo er gerade ist. */
    Rel.beobachten(SG.verhoer.BRETT_FAELLE, function () {
      if (!A.aktuell) return;
      var haft = SG.verhoer.eigenePerson();
      var wo = SG.router.parse();
      if (haft) {
        if (wo.kind !== 'befragung' || wo.id !== haft.zusatz.code) {
          SG.audio.play('error');
          SG.settings.buzz(90);
          SG.router.go('#/befragung/' + haft.zusatz.code);
        }
      } else if (wo.kind === 'befragung' && wo.id === A.aktuell.code) {
        /* Freigegeben - die Ansicht muss den Knopf zeigen, statt den
           Riegel weiter zu behaupten. */
        SG.router.reload();
      }
    });
    Rel.starten();

    pruefen();
  };

  function pruefen() {
    if (raus || !A.aktuell) return;
    var b = A.gebannt(A.aktuell.code);
    if (b) rauswerfen(b);
  }

  function rauswerfen(b) {
    raus = true;
    try { SG.tarnung.aus(); } catch (e) { /* egal */ }
    var app = document.getElementById('app');
    if (!app) return;
    UI.clear(app);
    var wrap = UI.el('div.gate');
    wrap.appendChild(UI.el('div.gate-box.bann-box', null, [
      UI.el('div.bann-zeichen', { text: '⛔' }),
      UI.el('h1', { text: 'Zugang gesperrt' }),
      UI.el('p.gate-sub', { text: 'Dieser Code ist gesperrt.' }),
      UI.el('div.notice.warn', null, [
        UI.el('div', { text: b.grund || 'Ohne Angabe' }),
        UI.el('div.small.muted', {
          style: { marginTop: '6px' },
          text: 'Gesperrt von ' + (b.von || 'Admin'),
        }),
      ]),
      UI.btn('Neu anmelden', function () { location.reload(); }, 'wide ghost'),
    ]));
    app.appendChild(wrap);
    A.abmelden();
  }

  function aufBefehl(b) {
    if (!b || !A.aktuell) return;
    var meins = b.ziel === '*' || b.ziel === A.aktuell.code || b.ziel === Rel.geraet;
    if (!meins) return;

    if (b.art === 'tarnung') {
      SG.tarnung.an('Fernauslösung durch ' + (b.von || 'Admin'));
      return;
    }
    if (b.art === 'bann') {
      pruefen();
      return;
    }
    if (b.art === 'befragung' || b.art === 'verhoer') {
      if (b.ziel !== A.aktuell.code) return;
      SG.audio.play('error');
      SG.settings.buzz(80);
      /* Der Riegel liegt schon durch den Fall auf dem Brett; das hier
         ist nur die Erklaerung dazu. Deshalb ohne Wahlmoeglichkeit. */
      SG.router.go('#/befragung/' + A.aktuell.code);
      UI.toast('🕵 ' + (b.text || 'Der Dienst hat eine Befragung eingeleitet.'),
        'bad', 5000);
      return;
    }
    if (b.art === 'verhoer-ende') {
      UI.toast('✅ ' + (b.text || 'Die Befragung ist beendet.'), 'good', 4000);
      return;
    }
    if (b.art === 'meeting') {
      SG.audio.play('select');
      SG.settings.buzz(30);
      UI.toast('📋 ' + (b.text || 'Du bist zu einer Besprechung eingeladen.'),
        null, 5000);
      /* Der Knopf in der Leiste kommt beim naechsten Aufbau des Hubs -
         wer gerade dort steht, soll ihn sofort sehen. */
      if (SG.router.parse().kind === 'hub') SG.router.reload();
      return;
    }
    if (b.art === 'hinweis') {
      UI.toast(b.text || 'Hinweis', null, 4000);
    }
  }
})(SG);
