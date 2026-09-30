/* ------------------------------------------------------------------
   Neu seit dem Update: ein kleines Fenster, das jeder Person einmal sagt,
   was dazugekommen ist - mit einem Knopf, der gleich hinfuehrt.

   Es erscheint erst, wenn gerade nichts anderes offen ist: kein Fenster,
   kein Kampf, kein Duell. Sonst laege es ueber dem Morgenbericht oder
   mitten in einer Arena. 3-ui.js fragt dafuer jede Sekunde in tick() nach.

   Gemerkt wird ueber SG.storage, das nach der Anmeldung im Raum des
   Zugangscodes liegt - wie beim Umzugs-Intro (src/core/umzug.js). Wer erst
   nach einer Neuigkeit zum ersten Mal die Insel betreten hat, bekommt sie
   nicht: fuer ihn ist nichts davon neu.

   Neue Ankuendigungen kommen OBEN in die Liste. Gezeigt wird immer nur
   eine je Besuch, die oberste, die jemand noch nicht gesehen hat.
   ------------------------------------------------------------------ */
(function (SG) {
  var R = SG.gehstockmon, X = R.abenteuer;
  var SPEICHER = 'gm-neuigkeiten-gesehen';

  R.NEUIGKEITEN = [
    { id: 'automat-2026-09', seit: Date.parse('2026-09-30T04:00:00+02:00'), bild: 'truhe',
      titel: 'Der Glücksautomat',
      text: function () {
        var a = X.AUTOMAT;
        return 'Beim Händler am Arenaplatz steht jetzt ein Glücksautomat. Ein Spiel kostet ' + a.einsatz + ' Gold, drei Eier auf den Walzen bringen ein Ei - höchstens ' + a.proTag + ' am Tag.';
      },
      knopf: 'Ausprobieren', ziel: 'automat' }
  ];

  R.mountNeu = function (c) {
    var el = c.el, button = c.button, offen = null, gesehen = {}, dieserBesuch = false;
    try { (SG.storage.get(SPEICHER, []) || []).forEach(function (id) { gesehen[id] = true; }); } catch (e) {}
    function merken(id) { gesehen[id] = true; try { SG.storage.set(SPEICHER, Object.keys(gesehen).slice(-30)); } catch (e) {} }

    /* Die oberste Neuigkeit, die diese Person noch nicht gesehen hat und die
       nach ihrem ersten Besuch kam. */
    function faellig() {
      var st = c.state(), seit = st && Number.isFinite(st.joinedAt) ? st.joinedAt : 0;
      return R.NEUIGKEITEN.find(function (n) { return !gesehen[n.id] && seit < n.seit; }) || null;
    }
    function schliessen(n, danach) {
      if (!offen) return;
      offen.remove(); offen = null; merken(n.id);
      document.removeEventListener('keydown', taste);
      if (danach) danach();
    }
    var aktuelle = null;
    function taste(e) { if (e.key === 'Escape' && aktuelle) schliessen(aktuelle); }
    function zeigen(n) {
      aktuelle = n; dieserBesuch = true;
      offen = el('div', undefined, 'gm-neu');
      var karte = el('section', undefined, 'gm-neu-karte');
      karte.setAttribute('role', 'dialog'); karte.setAttribute('aria-modal', 'true'); karte.setAttribute('aria-label', 'Neu: ' + n.titel);
      karte.appendChild(el('span', 'Neu seit dem Update', 'gm-eyebrow'));
      var bild = R.symbol && R.symbol(n.bild, 'gm-neu-bild');
      if (bild) karte.appendChild(bild);
      karte.appendChild(el('h2', n.titel));
      karte.appendChild(el('p', typeof n.text === 'function' ? n.text() : n.text));
      var reihe = el('div', undefined, 'gm-neu-knoepfe');
      reihe.appendChild(button(n.knopf, function () { schliessen(n, function () { c.hinfuehren(n.ziel); }); }, 'gm-button gm-primary'));
      reihe.appendChild(button('Okay', function () { schliessen(n); }, 'gm-button gm-secondary'));
      karte.appendChild(reihe);
      offen.appendChild(karte);
      c.root.appendChild(offen);
      document.addEventListener('keydown', taste);
      var erster = reihe.querySelector('button'); if (erster && erster.focus) erster.focus();
    }
    return {
      /* Aus tick(): frei heisst, gerade ist nichts anderes offen. */
      pruefen: function (frei) {
        if (offen || dieserBesuch || !frei) return;
        var n = faellig();
        if (n) zeigen(n);
      },
      offen: function () { return !!offen; }
    };
  };
})(SG);
