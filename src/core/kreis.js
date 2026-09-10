/* ------------------------------------------------------------------
   Innerer Kreis - Gruppenchat.

   Die Ansicht selbst steckt in SG.chat; hier stehen nur die Tuer
   (wer darf herein) und die Beschriftung. Damit sieht der Admin-Raum
   genauso aus wie der Kreis und eine BND-Befragung genauso wie beide.

   Der Server kennt keine Rollen - wer die Adresse des Relais kennt,
   koennte schreiben. Die Tuer davor ist der Zugangscode.
   ------------------------------------------------------------------ */

(function (SG) {
  var UI = SG.ui;
  var A = SG.auth;

  var K = SG.kreis = {};

  K.verfuegbar = function () { return SG.chat.verfuegbar(); };

  K.render = function (app) {
    if (!A.imKreis()) {
      UI.clear(app);
      app.appendChild(UI.el('div.topbar', null, [
        UI.el('button.back.btn.sm.ghost', {
          html: '‹ Zurück',
          on: { click: function () { SG.router.go('#/'); } },
        }),
        UI.el('div.spacer'),
        UI.el('div.brand-title', { text: '🔑 Innerer Kreis' }),
        UI.el('div.spacer'),
      ]));
      var s = UI.el('div.screen');
      s.appendChild(UI.empty('🔒', 'Kein Zutritt',
        'Dieser Bereich ist dem inneren Kreis vorbehalten.'));
      app.appendChild(s);
      return { destroy: function () { } };
    }

    var werkzeug = UI.el('div.row', { style: { gap: '6px' } }, [
      UI.frischKnopf(),
      A.istAdmin() ? UI.el('button.btn.sm.gold', {
        html: '<span class="ico">🛡</span><span class="lbl">Admin-Raum</span>',
        on: { click: function () { SG.router.go('#/adminraum'); } },
      }) : null,
    ]);

    return SG.chat.bildschirm(app, {
      brett: 'kreis',
      titel: '🔑 Innerer Kreis',
      platzhalter: 'Nachricht an den Kreis…',
      loeschen: true,
      bilder: true,
      umfragen: true,
      werkzeug: werkzeug,
      leerText: 'Schreib die erste Nachricht an den Kreis. '
        + 'Bilder und Abstimmungen gehen auch — die Knöpfe links unten.',
    });
  };
})(SG);
