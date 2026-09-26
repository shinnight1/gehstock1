/* ------------------------------------------------------------------
   Der Schlüpf-Moment. Frueher stand nach "Schlüpfen lassen" sofort das
   Mon im Fenster - der spannendste Augenblick des Spiels dauerte null
   Sekunden. Jetzt wackelt das Ei, blitzt in der Farbe seiner Seltenheit,
   und erst dann steht das Mon da.
   ------------------------------------------------------------------ */
(function (SG) {
  var R = SG.gehstockmon, D = R.daten, X = R.abenteuer, A = R.arena;
  /* c: {root, el, after, sfx}; res: Antwort auf 'hatch'; weiter: nach dem Antippen. */
  R.schlupfSzene = function (c, res, weiter) {
    var s = res && res.schlupf, mon = s && D.mon(s.monId);
    if (!s || !mon) { weiter(); return; }
    var r = D.SELTENHEITEN[mon.seltenheit], el = c.el, fertig = false;
    var box = el('div', undefined, 'gm-schlupf');box.style.setProperty('--rarity', r.farbe);
    box.setAttribute('role', 'dialog');box.setAttribute('aria-label', 'Ein Ei schlüpft');
    box.appendChild(el('div', undefined, 'gm-schlupf-licht'));
    box.appendChild(el('div', undefined, 'gm-schlupf-ei'));
    var text = el('p', 'Es bewegt sich …', 'gm-schlupf-zusatz');box.appendChild(text);
    var zeige = el('div', undefined, 'gm-schlupf-mon');
    var bild = SG.ui.el('img', { src: SG.assets[mon.vorschau] || SG.assets[mon.bild], alt: mon.name, draggable: false });
    if (s.schimmernd) bild.classList.add('gm-schimmer');
    zeige.appendChild(bild);
    zeige.appendChild(el('span', (s.schimmernd ? '✨ Schimmernd · ' : '') + r.name, 'gm-schlupf-seltenheit'));
    zeige.appendChild(el('strong', mon.name, 'gm-schlupf-name'));
    var zeilen = [];
    if (s.neu) zeilen.push('Neu in deiner Sammlung!');
    else if (s.runen) zeilen.push('Ein Zwilling auf Runenstufe ' + X.UPGRADE_LIMIT + ': +' + s.runen + ' ' + r.name + '-Runen.');
    else zeilen.push('Ein Zwilling: Runenstufe ' + s.stufe + '/' + X.UPGRADE_LIMIT + ' (+' + Math.round(s.stufe * A.UPGRADE_BONUS * 100) + ' % KP und Angriff).');
    if (s.schimmerNeu && !s.neu) zeilen.push('Sein Schimmer geht auf dein ' + mon.name + ' über.');
    if (s.garantiert) zeilen.push('Garantie eingelöst!');
    zeige.appendChild(el('p', zeilen.join(' '), 'gm-schlupf-zusatz'));
    zeige.appendChild(el('p', 'Tippen zum Weiterspielen', 'gm-schlupf-weiter'));
    box.appendChild(zeige);
    function schliessen() { if (!fertig) return; box.remove(); weiter(); }
    box.addEventListener('click', schliessen);
    c.root.appendChild(box);
    /* Je seltener, desto laenger wackelt es - die Spannung gehoert dazu. */
    var wackeln = 900 + Math.min(4, mon.seltenheit) * 250;
    c.after(function () { box.classList.add('gm-schlupf-blitz'); }, wackeln);
    c.after(function () {
      box.classList.add('gm-schlupf-da');text.remove();fertig = true;
      if (c.sfx) c.sfx('win');
    }, wackeln + 450);
  };
})(SG);
