/* ------------------------------------------------------------------
   Bildschirm-Beobachtungshinweis.

   Früher gab es einen Vollbild-Tarnungsdeckel (Erdkunde-Referat).
   Dieser wurde entfernt. Stattdessen gibt es ein klares, auffälliges
   Pop-up oben links, das sofort erscheint, sobald jemand über das
   Relais oder den Adminbereich auf den Bildschirm schaut.
   ------------------------------------------------------------------ */

(function (SG) {
  var UI = SG.ui;
  var Rel = SG.relais;

  var T = SG.tarnung = {};

  var popup = null;
  var an = false;

  T.istAn = function () { return false; };
  T.MOTIVE = [];
  T.motivDa = function () { return false; };
  T.eigeneBilder = function () { return []; };

  T.bauen = function () {
    if (popup) return popup;
    popup = UI.el('div.schirm-beobachter-popup', {
      role: 'alert',
      'aria-live': 'assertive',
    }, [
      UI.el('span.sb-icon', { text: '👁' }),
      UI.el('span.sb-text', { text: 'Jemand schaut auf deinen Bildschirm' }),
    ]);
    popup.style.display = 'none';
    document.body.appendChild(popup);
    return popup;
  };

  T.zeigen = function (sichtbar) {
    if (!popup) T.bauen();
    an = !!sichtbar;
    if (an) {
      popup.style.display = 'flex';
      popup.classList.add('aktiv');
    } else {
      popup.style.display = 'none';
      popup.classList.remove('aktiv');
    }
  };

  T.an = function () { /* keine Vollbildtarnung mehr */ };
  T.aus = function () { /* keine Vollbildtarnung mehr */ };
  T.umschalten = function () { /* keine Vollbildtarnung mehr */ };

  T.starten = function () {
    T.bauen();
    if (Rel && Rel.on) {
      Rel.on('spiegelMich', function (beobachtet) {
        T.zeigen(beobachtet);
      });
      if (Rel.beobachtetMich) {
        T.zeigen(true);
      }
    }
  };
})(SG);
