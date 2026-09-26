/* ------------------------------------------------------------------
   Das Live-Duell im Browser: Einladung, Kampf Zug um Zug, Ergebnis -
   und das Zuschauen. Gezeigt wird im selben Kasten wie die Arena.

   Waehrend eines Duells fragt das Spiel alle anderthalb Sekunden nach dem
   Stand (wie im Dungeon): nur so sieht man den Zug des anderen, sobald
   die Runde gerechnet ist.
   ------------------------------------------------------------------ */
(function (SG) {
  var R = SG.gehstockmon, D = R.daten, A = R.arena;
  R.mountDuell = function (c) {
    var el = c.el, button = c.button, box = c.arenaBox;
    var duell = null, zuschau = null, zuschauId = null, laufend = [], einladung = null, offen = false;
    /* Weggeklickte Duelle bleiben weg, auch nach dem Neuladen. */
    var SPEICHER = 'g:gehstockmon:duelle-gesehen', verworfen = {};
    try { (SG.storage.get(SPEICHER, []) || []).forEach(function (id) { verworfen[id] = true; }); } catch (e) {}
    function merken(id) { verworfen[id] = true; try { SG.storage.set(SPEICHER, Object.keys(verworfen).slice(-20)); } catch (e) {} }
    var anim = { revision: null, id: null, laeuft: false, zeile: null, sicht: null };

    function sichtbar() { return zuschauId ? zuschau : duell && !verworfen[duell.id] ? duell : null; }
    function aktiv() { return !!sichtbar(); }
    function pollNoetig() { return !!zuschauId || !!einladung || !!(duell && (duell.phase === 'einladung' || duell.phase === 'kampf')); }
    function pollDaten() { return zuschauId ? { zuschauen: zuschauId } : undefined; }
    /* Jede Abfrage liest die ganze Spielerwelt - deshalb nur schnell, wenn man
       wirklich auf den anderen wartet. Wer selbst am Zug ist, braucht nur ab
       und zu einen Blick (falls der andere aufgibt oder die Zeit abläuft). */
    function pollIntervall() {
      if (zuschauId) return 3000;
      var k = duell && duell.kampf;
      if (duell && duell.phase === 'kampf' && k && k.warten[0] && !k.gewaehlt[0]) return 5000;
      return 1500;
    }
    function sek(bis) { return Math.max(0, Math.ceil((bis - c.now()) / 1000)); }
    function bild(u) {
      var mon = D.mon(u.monId) || D.KATALOG[0];
      return SG.ui.el('img.gm-portrait.gm-arena-mon' + (u.schimmernd ? '.gm-schimmer' : '') + (u.hp <= 0 ? '.fainted' : ''), { src: SG.assets[mon.bild], alt: mon.name, draggable: false });
    }
    function senden(op, daten) {
      return c.request(op, daten).then(function (res) { c.apply(res); if (res.message) c.notify(res.message); }).catch(function (e) { c.error(e); zeigen(); });
    }
    function schliessen() { if (!offen) return; offen = false; c.closeCombat(); }

    function szene(d, k) {
      var s = anim.sicht || k, wrap = el('div', undefined, 'gm-arena-scene');
      wrap.appendChild(el('div', undefined, 'gm-arena-horizon'));
      [0, 1].forEach(function (seite) {
        var u = s.teams[seite][s.active[seite]], einheit = el('div', undefined, 'gm-arena-unit ' + (seite ? 'enemy' : 'ally'));
        einheit.setAttribute('data-unit', u.uid);
        var leben = el('div', undefined, 'gm-arena-health');
        leben.appendChild(el('strong', d.namen[seite] + ': ' + u.name));
        leben.appendChild(el('span', Math.max(0, Math.ceil(u.hp)) + ' / ' + u.maxHp + ' KP'));
        leben.appendChild(SG.ui.el('progress', { value: Math.max(0, u.hp), max: u.maxHp, 'aria-label': u.name + ' Lebenspunkte' }));
        einheit.appendChild(leben);einheit.appendChild(el('div', undefined, 'gm-arena-pedestal'));einheit.appendChild(bild(u));
        var status = [];if (u.shield) status.push('Geschützt');if (u.weakened) status.push('Geschwächt');
        einheit.appendChild(el('span', status.join(' · '), 'gm-arena-status'));
        wrap.appendChild(einheit);
      });
      return wrap;
    }
    function zeigen() {
      var d = sichtbar();
      if (!d) { schliessen(); return; }
      if (!offen) { c.openCombat(); offen = true; }
      SG.ui.clear(box);box.className = 'gm-arena gm-duell';
      var kopf = el('header', undefined, 'gm-arena-header');
      kopf.appendChild(el('div', (d.zuschauer ? 'ZUSCHAUEN · ' : '') + 'LIVE-DUELL', 'gm-eyebrow'));
      kopf.appendChild(el('strong', (d.zuschauer ? d.namen[0] : 'Du') + ' gegen ' + d.namen[1] + (d.kampf ? ' · Runde ' + Math.min(d.kampf.round, 60) : '')));
      box.appendChild(kopf);
      var panel = el('div', undefined, 'gm-arena-panel');
      if (d.phase === 'einladung') {
        panel.appendChild(el('p', d.eingeladen ? d.namen[1] + ' fordert dich zum Live-Duell! Beide Kampfteams, Zug um Zug, ohne Zuschläge.' : 'Warte auf ' + d.namen[1] + ' …', 'gm-arena-line'));
        panel.appendChild(el('p', 'Noch ' + sek(d.einladungBis) + ' Sekunden.', 'gm-duell-warte'));
        if (d.eingeladen) {
          var ja = button('⚔ Annehmen', function () { senden('duell_antwort', { duellId: d.id, annehmen: true }); }, 'gm-button gm-primary');
          var nein = button('Ablehnen', function () { senden('duell_antwort', { duellId: d.id, annehmen: false }); }, 'gm-button gm-secondary');
          ja.disabled = nein.disabled = c.busy();panel.appendChild(ja);panel.appendChild(nein);
        } else {
          var ab = button('Absagen', function () { senden('duell_aufgeben', { duellId: d.id }); }, 'gm-button gm-secondary');
          ab.disabled = c.busy();panel.appendChild(ab);
        }
        box.appendChild(panel);return;
      }
      var k = d.kampf;
      if (k) box.appendChild(szene(d, k));
      if (d.phase === 'ende') {
        var titel = { sieg: 'Gewonnen!', niederlage: 'Verloren.', patt: 'Unentschieden.' }[d.ergebnis]
          || { abgelehnt: 'Abgelehnt.', abgelaufen: 'Keine Antwort.', zurueckgezogen: 'Abgesagt.' }[d.grund] || 'Das Duell ist vorbei.';
        if (d.zuschauer && d.ergebnis) titel = d.ergebnis === 'patt' ? 'Unentschieden.' : (d.ergebnis === 'sieg' ? d.namen[0] : d.namen[1]) + ' gewinnt.';
        panel.appendChild(el('h2', titel));
        var L = R.abenteuer.DUELL.lohn;
        if (!d.zuschauer && d.ergebnis) panel.appendChild(el('p', d.ergebnis === 'sieg' ? '+' + L.sieg + ' Gold und +' + R.abenteuer.DUELL.ruhm + ' Ruhm' + (d.grund === 'aufgabe' ? ' - ' + d.namen[1] + ' hat aufgegeben.' : d.grund === 'zeit' ? ' - ' + d.namen[1] + ' hat zu oft nicht gezogen.' : '.')
          : d.ergebnis === 'patt' ? '+' + L.patt + ' Gold für beide.' : '+' + L.trost + ' Gold Trost. Deine Mons bleiben dir.', 'gm-arena-line'));
        panel.appendChild(button('Zurück zur Karte', function () { merken(d.id); if (zuschauId) { zuschauId = null; zuschau = null; } schliessen(); }, 'gm-button gm-primary'));
        box.appendChild(panel);return;
      }
      /* Kampf. */
      var ich = k.warten[0], line;
      if (d.zuschauer) line = (k.gewaehlt[0] ? '✓ ' : '… ') + d.namen[0] + '   ·   ' + (k.gewaehlt[1] ? '✓ ' : '… ') + d.namen[1];
      else if (ich === 'replace') line = 'Dein Mon ist kampfunfähig. Wähle den nächsten.';
      else if (ich === 'choose' && !k.gewaehlt[0]) line = 'Wähle deinen Zug.';
      else if (ich === 'choose') line = 'Warte auf ' + d.namen[1] + ' …';
      else line = d.namen[1] + ' schickt ein neues Mon …';
      var zeile = el('p', anim.laeuft && anim.zeile ? anim.zeile : line, 'gm-arena-line');panel.appendChild(zeile);
      panel.appendChild(el('p', 'Noch ' + sek(k.deadline) + ' s für diese Runde' + (k.verpasst[0] ? ' · du hast ' + k.verpasst[0] + ' Runde(n) verpasst, bei 3 verlierst du' : ''), 'gm-duell-warte'));
      if (!d.zuschauer) {
        var gesperrt = c.busy() || anim.laeuft || !ich || k.gewaehlt[0];
        if (ich === 'choose') {
          var zuege = el('div', undefined, 'gm-moves'), aktiv = k.teams[0][k.active[0]];
          A.moves(aktiv, k.round).forEach(function (m) {
            var b = button('', function () { senden('duell_zug', { duellId: d.id, revision: k.revision, aktion: { kind: 'move', move: m.id } }); }, 'gm-move gm-move-' + m.id);
            b.appendChild(el('strong', m.name));b.appendChild(el('span', m.damage ? 'Stärke ' + m.damage : 'Taktik'));b.appendChild(el('small', m.text));
            b.disabled = gesperrt || !m.enabled;zuege.appendChild(b);
          });
          panel.appendChild(zuege);
        }
        var bank = el('div', undefined, 'gm-arena-bench');
        k.teams[0].forEach(function (u, i) {
          var b = button('', function () { senden('duell_zug', { duellId: d.id, revision: k.revision, aktion: { kind: 'switch', slot: i } }); }, 'gm-bench-mon' + (i === k.active[0] ? ' active' : ''));
          b.appendChild(bild(u));b.appendChild(el('span', u.name + ' · ' + Math.max(0, u.hp) + ' KP'));
          b.disabled = gesperrt || u.hp <= 0 || i === k.active[0];b.setAttribute('aria-label', u.name + ' einwechseln');bank.appendChild(b);
        });
        panel.appendChild(bank);
        panel.appendChild(el('small', ich === 'replace' ? 'Der Ersatz kostet keinen Zug.' : 'Wechseln verbraucht deinen Zug. Wer nicht wählt, geht in Deckung.'));
        var weg = button('Aufgeben', function () { senden('duell_aufgeben', { duellId: d.id }); }, 'gm-button gm-secondary');weg.disabled = c.busy();panel.appendChild(weg);
      } else panel.appendChild(button('Nicht mehr zuschauen', function () { zuschauId = null; zuschau = null; schliessen(); }, 'gm-button gm-secondary'));
      (k.verlauf || []).slice(-3).forEach(function (t) { panel.appendChild(el('small', t, 'gm-dungeon-log')); });
      box.appendChild(panel);
    }
    /* Die Ereignisse einer neuen Runde nacheinander zeigen: Treffer fuer
       Treffer, mit den Lebenspunkten, die sie hinterlassen. */
    function abspielen(d) {
      var k = d.kampf, alt = anim.id === d.id ? anim.revision : null;
      anim.id = d.id;anim.revision = k.revision;
      if (alt === null || alt === k.revision || !k.events || !k.events.length) return false;
      var sicht = JSON.parse(JSON.stringify(k)), i = 0;anim.laeuft = true;
      function schritt() {
        var e = k.events[i++];
        if (!e) { anim.laeuft = false;anim.sicht = null;anim.zeile = null;zeigen();return; }
        if (e.state) e.state.forEach(function (team, s) { team.forEach(function (hp, j) { sicht.teams[s][j].hp = hp; }); });
        if (e.active) sicht.active = e.active.slice();
        anim.sicht = sicht;anim.zeile = e.text;zeigen();
        c.after(schritt, e.kind === 'send' ? 800 : 650);
      }
      schritt();
      return true;
    }
    return {
      aktiv: aktiv, pollNoetig: pollNoetig, pollDaten: pollDaten, pollIntervall: pollIntervall,
      apply: function (res) {
        if (!res) return;
        if ('duell' in res) duell = res.duell || null;
        if (res.duelleLaufend) laufend = res.duelleLaufend;
        if (res.zuschauDuell && res.zuschauDuell.id === zuschauId) zuschau = res.zuschauDuell;
        if (duell && (duell.eingeladen || duell.phase !== 'einladung')) einladung = null;
        var d = sichtbar();
        if (!d) { schliessen(); return; }
        if (d.kampf && abspielen(d)) return;
        if (!anim.laeuft) zeigen();
      },
      /* Die Anwesenheit meldet eine Einladung, bevor die Weltabfrage sie hat. */
      einladung: function (e) {
        if (!e || verworfen[e.id] || (duell && duell.id === e.id)) return;
        einladung = e;c.notify('⚔ ' + e.von + ' fordert dich zum Live-Duell!');if (c.sofort) c.sofort();
      },
      laufend: function () { return laufend; },
      zuschauen: function (id) { zuschauId = id;zuschau = null;if (c.sofort) c.sofort(); },
      fordern: function (peer) { senden('duell_fordern', { targetId: peer.id }); }
    };
  };
})(SG);
