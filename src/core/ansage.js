/* ------------------------------------------------------------------
   Ansagen-Banner.

   Faehrt von oben herein - im Hub genauso wie mitten im Spiel. Nach
   oben wegwischen oder antippen laesst es verschwinden; eine feste
   Ansage kommt beim naechsten Bildschirm wieder.

   Haengt an SG.verwaltung: sobald ein Admin irgendwo eine Ansage
   schreibt, taucht sie hier auf, ohne dass jemand neu laden muss.
   ------------------------------------------------------------------ */

(function (SG) {
  var UI = SG.ui;
  var A = SG.auth;

  var An = SG.ansage = {};

  var el = null;
  var aktuelleId = null;

  function weg(sofort) {
    if (!el) return;
    var e = el;
    el = null;
    e.classList.remove('an-offen');
    if (sofort) UI.remove(e);
    else setTimeout(function () { UI.remove(e); }, 320);
  }

  An.schliessen = function () { weg(); };

  /* Zeigt die aktuelle Ansage, falls es eine gibt und sie noch nicht
     weggewischt wurde. Wird nach jedem Bildschirmwechsel gerufen. */
  An.pruefen = function () {
    var a = A.ansage();

    if (!a) { aktuelleId = null; weg(); return; }
    if (a.art !== 'fest' && A.ansageGelesen(a.id)) { weg(); return; }
    if (el && aktuelleId === a.id) return;      // steht schon

    weg(true);
    aktuelleId = a.id;
    zeigen(a);
  };

  function zeigen(a) {
    el = UI.el('div.an-banner.' + a.art, null, [
      UI.el('div.an-griff', { 'aria-hidden': 'true' }),
      UI.el('div.an-inhalt', null, [
        UI.el('div.an-kopf', {
          text: A.rolleIcon(a.rolle) + ' ' + a.von
            + (a.art === 'warnung' ? ' · Warnung' : (a.art === 'fest' ? ' · angeheftet' : '')),
        }),
        UI.el('div.an-text', { text: a.text }),
      ]),
      UI.el('div.an-hinweis', {
        text: a.art === 'fest' ? 'Angeheftet' : 'Nach oben wischen',
      }),
    ]);
    document.body.appendChild(el);

    /* Hereinfahren im naechsten Bild, damit der Uebergang greift. Der
       Zeitgeber daneben ist die Rueckfallebene: liefert der Browser
       gerade keine Bilder (verdeckter Tab), bliebe das Banner sonst
       ausserhalb des Bildschirms haengen. */
    function auf() { if (el) el.classList.add('an-offen'); }
    requestAnimationFrame(function () { requestAnimationFrame(auf); });
    setTimeout(auf, 80);

    wischen(el, a);
    SG.audio.play('alert');
  }

  /* Nach oben wegwischen. Ein kurzer Tipp schliesst ebenfalls. */
  function wischen(node, a) {
    var startY = 0, dy = 0, zieht = false;

    node.addEventListener('pointerdown', function (e) {
      zieht = true;
      startY = e.clientY;
      dy = 0;
      node.style.transition = 'none';
      try { node.setPointerCapture(e.pointerId); } catch (err) { /* egal */ }
    });

    node.addEventListener('pointermove', function (e) {
      if (!zieht) return;
      dy = Math.min(0, e.clientY - startY);       // nur nach oben
      node.style.transform = 'translateY(' + dy + 'px)';
    });

    function los() {
      if (!zieht) return;
      zieht = false;
      node.style.transition = '';
      node.style.transform = '';
      if (dy < -40 || Math.abs(dy) < 4) {
        // weit genug nach oben gezogen - oder nur getippt
        if (a.art !== 'fest') A.ansageWegklicken(a.id);
        weg();
      }
    }
    node.addEventListener('pointerup', los);
    node.addEventListener('pointercancel', los);
  }

  /* Auf Aenderungen vom Relais hoeren */
  if (SG.verwaltung && SG.verwaltung.on) {
    SG.verwaltung.on('aenderung', function () {
      if (A.aktuell) An.pruefen();
    });
  }
})(SG);
