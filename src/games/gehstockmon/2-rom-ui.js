/* ------------------------------------------------------------------
   Rom-Event: Anzeige, Knoepfe, Musik und Abschluss

   Der Stand kommt mit jeder Positionsmeldung (alle 3 bis 8 Sekunden) und
   mit jeder eigenen Aktion. Dazwischen rechnet der Browser die Phase
   selbst aus Startzeit und Serveruhr (X.ROM) - Phasenwechsel kommen also
   auf die Sekunde, ohne dass jemand zusaetzlich fragt.

   Alles geht auch ohne Ton: jede Ansage steht als Text da, der Tanz hat
   seinen Takt auf dem Bildschirm, und die Musik ist nur Zugabe. Welche
   Musik und welches Bild fuer die Sternschnuppen, steht zentral in
   R.ROM_ASSETS - fehlt eine Datei, laeuft es trotzdem.
   ------------------------------------------------------------------ */
(function (SG) {
  var R = SG.gehstockmon, X = R.abenteuer;

  /* Austauschbare Dateien des Events. Die Namen sind Schluessel in
     SG.assets, also Dateien in src/assets/ ohne Endung. */
  R.ROM_ASSETS = {
    musik: 'gm-rom-musik',
    stern: 'gm-rom-stern',
    lautstaerke: 0.7,
    /* Klang je Phase: Tempo (1 = normal) und Tiefpass in Hertz (null = offen). */
    phasen: [{ tempo: 1, filter: null }, { tempo: 1, filter: null }, { tempo: 1.06, filter: null }, { tempo: 0.94, filter: 1400 }, { tempo: 1.1, filter: null }]
  };
  /* Wie bunt der Bildschirm flackert, je Phase. Hoechstens zwei
     Farbwechsel je Sekunde und nur als weicher Schleier - schnelleres,
     grelles Flackern kann bei fotosensibler Epilepsie Anfaelle ausloesen. */
  var DISKO = [0.06, 0.12, 0.24, 0.1, 0.28];

  R.mountRom = function (c) {
    var ROM = X.ROM, UI = SG.ui, el = c.el, button = c.button;
    var ev = null, zuletzt = null, dead = false, unterwegs = false, uhr = null, phaseVorher = null, evVorher = null;
    var ruhig = lesen('ruhig', false) || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var ton = { an: lesen('ton', true), laut: lesen('laut', R.ROM_ASSETS.lautstaerke) };
    var folgen = false, abgerechnetAngefragt = 0;

    function lesen(k, v) { try { var x = SG.storage.get('gm:rom:' + k, v); return x === undefined || x === null ? v : x; } catch (e) { return v; } }
    function merken(k, v) { try { SG.storage.set('gm:rom:' + k, v); } catch (e) { /* egal */ } }
    function jetzt() { return c.now(); }
    function szene() { var w = c.world(); return w && w.erweiterung ? w.erweiterung('rom') : null; }
    function aktionId() { return window.crypto && crypto.randomUUID ? crypto.randomUUID() : 'rom-' + Date.now().toString(36) + Math.random().toString(36).slice(2); }
    function sekunden(ms) { var s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
    function abstand(a, b) { return a && b ? Math.hypot(a.x - b.x, a.z - b.z) : Infinity; }

    /* ------------------------------------------------ Grundgeruest */
    var box = el('div', undefined, 'gm-rom'); box.hidden = true; c.root.appendChild(box);
    var disko = el('div', undefined, 'gm-rom-disko'); box.appendChild(disko);
    var himmel = el('div', undefined, 'gm-rom-himmel'); box.appendChild(himmel);
    var kopf = el('section', undefined, 'gm-rom-kopf'); box.appendChild(kopf);
    var kopfZeile = el('div', '🇮🇹 ADMIN ABUSE · ROMA È FINITA', 'gm-rom-marke');
    var titel = el('strong', '', 'gm-rom-titel'), zeit = el('span', '', 'gm-rom-zeit');
    var titelZeile = el('div', undefined, 'gm-rom-titelzeile'); titelZeile.appendChild(titel); titelZeile.appendChild(zeit);
    var unterzeile = el('div', '', 'gm-rom-unter');
    kopf.appendChild(kopfZeile); kopf.appendChild(titelZeile); kopf.appendChild(unterzeile);
    var balken = el('div', undefined, 'gm-rom-balken'), balkenFuell = el('i'), balkenText = el('span', '');
    balken.appendChild(balkenFuell); balken.appendChild(balkenText); kopf.appendChild(balken);
    var haltungZeile = el('div', '', 'gm-rom-haltung'); kopf.appendChild(haltungZeile);
    var regler = el('div', undefined, 'gm-rom-regler'); kopf.appendChild(regler);
    var tonKnopf = button('', function () { ton.an = !ton.an; merken('ton', ton.an); musikPruefen(true); reglerZeigen(); }, 'gm-rom-mini');
    var lautRegler = el('input', undefined, 'gm-rom-laut'); lautRegler.type = 'range'; lautRegler.min = '0'; lautRegler.max = '1'; lautRegler.step = '0.05'; lautRegler.value = String(ton.laut);
    lautRegler.setAttribute('aria-label', 'Lautstärke der Event-Musik');
    lautRegler.addEventListener('input', function () { ton.laut = Number(lautRegler.value); merken('laut', ton.laut); musikLautstaerke(); });
    var ruhigKnopf = button('', function () { ruhig = !ruhig; merken('ruhig', ruhig); effekteZeigen(); reglerZeigen(); }, 'gm-rom-mini');
    var tonHinweis = button('🔊 Tippen für Musik', function () { if (SG.audio.unlock) SG.audio.unlock(); musikPruefen(true); }, 'gm-rom-mini gm-rom-tonhinweis'); tonHinweis.hidden = true;
    regler.appendChild(tonKnopf); regler.appendChild(lautRegler); regler.appendChild(ruhigKnopf); regler.appendChild(tonHinweis);
    function reglerZeigen() {
      tonKnopf.textContent = ton.an ? '🔊 Musik' : '🔇 Musik aus'; tonKnopf.setAttribute('aria-pressed', String(ton.an));
      ruhigKnopf.textContent = ruhig ? '✨ Effekte ruhig' : '✨ Effekte voll'; ruhigKnopf.setAttribute('aria-pressed', String(ruhig));
      lautRegler.disabled = !ton.an;
    }
    var lireBox = el('section', undefined, 'gm-rom-lire'); kopf.insertBefore(lireBox, regler);
    var lireZahl = el('strong', '', 'gm-rom-lire-zahl'), lireNaechste = el('span', '', 'gm-rom-lire-naechste'), stufenReihe = el('div', undefined, 'gm-rom-stufen');
    lireBox.appendChild(lireZahl); lireBox.appendChild(lireNaechste); lireBox.appendChild(stufenReihe);
    var leiste = el('div', undefined, 'gm-rom-aktionen'); box.appendChild(leiste);
    var hinweis = el('div', '', 'gm-rom-hinweis'); leiste.appendChild(hinweis);
    var knoepfe = el('div', undefined, 'gm-rom-knoepfe'); leiste.appendChild(knoepfe);
    var tanz = el('div', undefined, 'gm-rom-tanz'); tanz.hidden = true; leiste.insertBefore(tanz, knoepfe);
    var ansage = el('div', undefined, 'gm-rom-ansage'); ansage.hidden = true; box.appendChild(ansage);
    var kampfKarte = el('section', undefined, 'gm-rom-kampf'); kampfKarte.hidden = true; box.appendChild(kampfKarte);
    var ende = el('section', undefined, 'gm-rom-ende'); ende.hidden = true; box.appendChild(ende);
    var plus = el('div', '', 'gm-rom-plus'); box.appendChild(plus);
    reglerZeigen();

    /* Jede Beruehrung darf den Ton freischalten - iOS verlangt eine Geste. */
    function geste() { if (ev && ton.an && musik.soll) { if (SG.audio.unlock) SG.audio.unlock(); musikPruefen(true); } }
    c.root.addEventListener('pointerdown', geste, true);

    /* ------------------------------------------------------ Musik */
    var musik = { puffer: null, laedt: false, fehlt: false, quelle: null, gain: null, filter: null, soll: false, synth: null, synthSchritt: 0 };
    function musikLaden() {
      if (musik.puffer || musik.laedt || musik.fehlt) return;
      var url = SG.assets && SG.assets[R.ROM_ASSETS.musik], k = SG.audio.kontext ? SG.audio.kontext() : null;
      if (!url || !window.fetch) { musik.fehlt = true; return; }
      if (!k) return;
      musik.laedt = true;
      fetch(url).then(function (r) { if (!r.ok) throw new Error('fehlt'); return r.arrayBuffer(); })
        .then(function (b) { return new Promise(function (ok, nein) { k.ctx.decodeAudioData(b, ok, nein); }); })
        .then(function (p) { musik.puffer = p; musik.laedt = false; musikPruefen(); })
        .catch(function () { musik.laedt = false; musik.fehlt = true; musikPruefen(); });
    }
    function musikLautstaerke() {
      if (!musik.gain) return;
      var k = musik.gain.context; musik.gain.gain.setTargetAtTime(Math.max(0.0001, ton.laut), k.currentTime, 0.2);
    }
    function musikStarten() {
      var k = SG.audio.kontext ? SG.audio.kontext() : null;
      if (!k) return;
      if (k.ctx.state !== 'running') { tonHinweis.hidden = false; return; }
      tonHinweis.hidden = true;
      if (musik.puffer) {
        if (musik.quelle) return;
        var q = k.ctx.createBufferSource(), f = k.ctx.createBiquadFilter(), g = k.ctx.createGain();
        q.buffer = musik.puffer; q.loop = true; f.type = 'lowpass'; f.frequency.value = 20000;
        q.connect(f); f.connect(g); g.connect(k.ziel);
        g.gain.setValueAtTime(0.0001, k.ctx.currentTime); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, ton.laut), k.ctx.currentTime + 2);
        q.start(); musik.quelle = q; musik.filter = f; musik.gain = g; musikPhase(true);
      } else if (musik.fehlt && !musik.synth) synthStarten();
    }
    function musikStoppen(sanft) {
      if (musik.quelle) {
        var q = musik.quelle, g = musik.gain, t = g.context.currentTime, d = sanft ? 4 : 0.2;
        try { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); q.stop(t + d + 0.1); } catch (e) { /* schon weg */ }
        musik.quelle = null; musik.gain = null; musik.filter = null;
      }
      if (musik.synth) { c.cancel(musik.synth); musik.synth = null; }
    }
    /* Tempo und Klang je Phase; dazu beim Wechsel ein kurzes Ducken. */
    function musikPhase(sofort) {
      if (!musik.quelle || !ev) return;
      var ph = ROM.phase(ev, jetzt()), p = ph && ph.nr >= 0 && ph.nr <= 4 ? R.ROM_ASSETS.phasen[ph.nr] : R.ROM_ASSETS.phasen[0], k = musik.gain.context, t = k.currentTime;
      musik.quelle.playbackRate.setTargetAtTime(p.tempo || 1, t, sofort ? 0.01 : 0.6);
      musik.filter.frequency.setTargetAtTime(p.filter || 20000, t, sofort ? 0.01 : 0.6);
      if (!sofort) { musik.gain.gain.setTargetAtTime(Math.max(0.0001, ton.laut * 0.3), t, 0.05); musik.gain.gain.setTargetAtTime(Math.max(0.0001, ton.laut), t + 0.5, 0.3); }
    }
    /* Ohne Musikdatei: eine kleine Tarantella aus dem eigenen Synthesizer. */
    var TARANTELLA = [9, 12, 16, 12, 9, 12, 16, 12, 7, 11, 14, 11, 7, 11, 14, 11, 5, 9, 12, 9, 4, 8, 11, 8];
    function synthStarten() {
      var tempo = R.ROM_ASSETS.phasen[Math.max(0, Math.min(4, (ROM.phase(ev, jetzt()) || { nr: 0 }).nr))].tempo || 1;
      if (SG.audio.tone) SG.audio.tone({ f: SG.audio.note(TARANTELLA[musik.synthSchritt % TARANTELLA.length]), d: 0.14, v: 0.05 * ton.laut / 0.7, type: 'triangle' });
      if (musik.synthSchritt % 6 === 0 && SG.audio.tone) SG.audio.tone({ f: SG.audio.note(TARANTELLA[musik.synthSchritt % TARANTELLA.length] - 24), d: 0.3, v: 0.05 * ton.laut / 0.7, type: 'sine' });
      musik.synthSchritt++;
      musik.synth = c.after(synthStarten, 165 / tempo);
    }
    function musikPruefen(neu) {
      var soll = !!ev && ton.an && ROM.laeuft(ev, jetzt());
      musik.soll = soll;
      if (!soll) { musikStoppen(!!ev); tonHinweis.hidden = true; return; }
      musikLaden();
      if (neu || !musik.quelle) musikStarten();
    }

    /* ----------------------------------------------------- Aktionen */
    var warteAufOrt = null, fangTopf = {}, fangUhr = null;
    function senden(art, daten, leise) {
      if (unterwegs || !ev) return Promise.resolve(null);
      unterwegs = true;
      return R.online.request('rom_aktion', Object.assign({ art: art, aktionId: aktionId() }, daten || {})).then(function (res) {
        if (dead) return null;
        if (res.rom) uebernehmen(res.rom, res.serverTime);
        var e = res.ergebnis || {};
        if (e.lire) plusZeigen('+' + e.lire + (e.lire === 1 ? ' Lira' : ' Lire'));
        if (e.text && !(leise && !e.lire)) c.notify(e.text);
        if (art === 'zutat' && daten && daten.pizzaId && szene()) szene().gesammelt(daten.pizzaId);
        if (art === 'schlag' && szene()) szene().treffer();
        if (e.lire) SG.audio.play(art === 'schlag' ? 'hit' : 'coin');
        if (e.kampf) kampfZeigen(e.kampf, e.sieg);
        return e;
      }).catch(function (err) {
        if (!dead && !leise) c.notify(err.message);
        return null;
      }).finally(function () { unterwegs = false; });
    }
    /* Fuer Aktionen am Ort muss der Server den aktuellen Standort kennen.
       Ist die letzte Meldung aelter oder weit weg, erst neu melden lassen. */
    function mitFrischemOrt(ziel, radius, art, daten) {
      var w = c.world(), hier = w && w.position ? w.position() : null, gemeldet = c.gemeldet();
      if (!hier) return;
      if (gemeldet && Date.now() - gemeldet.t < 2500 && abstand(gemeldet, ziel) <= radius) { senden(art, daten); return; }
      if (!warteAufOrt) { warteAufOrt = { art: art, daten: daten, ziel: ziel, radius: radius, bis: Date.now() + 6000 }; c.sofortMelden(); }
    }
    function fangen(was) {
      fangTopf[was] = (fangTopf[was] || 0) + 1;
      if (!fangUhr) fangUhr = c.after(fangSenden, 1200);
    }
    function fangSenden() {
      fangUhr = null;
      var was = Object.keys(fangTopf).find(function (k) { return fangTopf[k] > 0; });
      if (!was) return;
      if (unterwegs) { fangUhr = c.after(fangSenden, 600); return; }
      var n = Math.min(5, fangTopf[was]); fangTopf[was] -= n;
      senden('fang', { fang: was, anzahl: n }, true).then(function () { if (Object.keys(fangTopf).some(function (k) { return fangTopf[k] > 0; }) && !fangUhr) fangUhr = c.after(fangSenden, 400); });
    }

    /* ------------------------------------------------------ Anzeige */
    function uebernehmen(sicht, serverTime) {
      var neuesEvent = sicht && (!ev || ev.id !== sicht.id);
      ev = sicht || null;
      if (szene()) { if (szene().zeitquelle) szene().zeitquelle(jetzt); szene().setEvent(ev); }
      if (neuesEvent) {
        phaseVorher = null; ende.hidden = true; abgerechnetAngefragt = 0; abrechnungVersuche = 0; folgen = false; evVorher = ev.id;
        /* Eine weitere Vorschau beginnt auch im selben Fenster ohne alte
           Tanzrunden, wartende Aktionen oder noch fliegende Sammelobjekte. */
        tanzStand = { runde: -1, eingabe: [], gesendet: {}, zeigenBis: 0 };
        warteAufOrt = null; fangTopf = {};
        if (fangUhr) c.cancel(fangUhr); fangUhr = null;
        UI.clear(himmel); fliegend = 0; naechsterStern = 0; naechstesFallen = 0;
        gemeldeteUeberraschungen = {}; kampfKarte.hidden = true;
      }
      void serverTime;
      zeichnen();
    }
    function plusZeigen(text) {
      plus.textContent = text; plus.classList.remove('an'); void plus.offsetWidth; plus.classList.add('an');
    }
    function ansageZeigen(gross, klein, dauer) {
      UI.clear(ansage); ansage.appendChild(el('strong', gross)); if (klein) ansage.appendChild(el('span', klein));
      ansage.hidden = false; ansage.classList.remove('an'); void ansage.offsetWidth; ansage.classList.add('an');
      if (ansage.uhr) c.cancel(ansage.uhr);
      ansage.uhr = c.after(function () { ansage.hidden = true; }, dauer || 2600);
    }
    function effekteZeigen() {
      var ph = ev ? ROM.phase(ev, jetzt()) : null, nr = ph ? ph.nr : 5;
      box.classList.toggle('gm-rom-ruhig', !!ruhig);
      disko.style.opacity = nr >= 0 && nr <= 4 ? String(ruhig ? Math.min(0.1, DISKO[nr]) : DISKO[nr]) : '0';
      if (szene()) szene().ruhig(ruhig);
    }
    function stufenZeigen(lire) {
      UI.clear(stufenReihe);
      ROM.STUFEN.forEach(function (s) {
        var ok = lire >= s.ab, chip = el('span', s.zeichen + ' ' + s.name, 'gm-rom-stufe' + (ok ? ' erreicht' : ''));
        chip.title = s.text + ' - ab ' + s.ab + ' Lire'; stufenReihe.appendChild(chip);
      });
      var n = ROM.naechsteStufe(lire);
      lireNaechste.textContent = n ? 'noch ' + (n.ab - lire) + ' bis ' + n.zeichen + ' ' + n.name : 'Alle Stufen erreicht!';
    }
    /* Die Knoepfe bleiben dieselben Elemente, solange sich nur Text oder
       Zustand aendern: wird ein Knopf zwischen Antippen und Loslassen
       ersetzt, geht der Tipp auf dem iPad verloren. */
    var specs = [], knopfListe = [];
    function knopf(key, text, fn, aus, klasse) { specs.push({ key: key, text: text, fn: fn, aus: !!aus, klasse: klasse || '' }); }
    function knoepfeSetzen() {
      var gleich = specs.length === knopfListe.length && specs.every(function (sp, i) { return knopfListe[i].key === sp.key; });
      if (!gleich) {
        UI.clear(knoepfe);
        knopfListe = specs.map(function (sp) {
          var b = button('', function () { if (!b.disabled && b.spec && b.spec.fn) b.spec.fn(); }, 'gm-button gm-rom-knopf');
          knoepfe.appendChild(b); return { key: sp.key, b: b };
        });
      }
      specs.forEach(function (sp, i) {
        var b = knopfListe[i].b; b.spec = sp;
        if (b.textContent !== sp.text) b.textContent = sp.text;
        b.disabled = sp.aus; b.className = 'gm-button gm-rom-knopf' + (sp.klasse ? ' ' + sp.klasse : '');
      });
    }
    var tanzStand = { runde: -1, eingabe: [], gesendet: {}, zeigenBis: 0 };
    function zeichnen() {
      if (dead) return;
      var t = jetzt(), ph = ev ? ROM.phase(ev, t) : null;
      var sichtbar = !!ev && !!ph && !(ph.nr === 5 && t - ph.von > ROM.NACHLAUF);
      box.hidden = !sichtbar;
      c.root.classList.toggle('gm-rom-an', sichtbar && ph.nr < 5);
      if (!sichtbar) { musikPruefen(); return; }
      var ich = ev.ich || {}, lire = ich.lire || 0;
      if (ph.nr !== phaseVorher) phasenwechsel(phaseVorher, ph.nr);
      phaseVorher = ph.nr;
      /* Kopf */
      if (ph.nr < 0) { titel.textContent = 'Rom zieht ein …'; zeit.textContent = sekunden(ph.bis - t); unterzeile.textContent = 'CEO ' + ev.von + ' hat Rom kaputt gemacht.' + (ev.vorschau ? ' · VORSCHAU' : ''); }
      else if (ph.nr <= 4) { titel.textContent = ROM.PHASEN[ph.nr].name; zeit.textContent = sekunden(ph.bis - t); unterzeile.textContent = 'Phase ' + (ph.nr + 1) + ' von 5 · ' + ev.teilnehmer + (ev.teilnehmer === 1 ? ' Held' : ' Helden') + ' in Rom' + (ev.vorschau ? ' · VORSCHAU ohne echte Belohnung' : ''); }
      else { titel.textContent = ph.abgebrochen ? 'Rom wurde abgebrochen' : 'ROMA È FINITA!'; zeit.textContent = ''; unterzeile.textContent = 'Danke fürs Mitmachen.'; }
      /* Leiste oder Boss */
      balken.hidden = true; haltungZeile.hidden = true;
      if (ph.nr >= 0 && ph.nr <= 2) {
        balken.hidden = false; balken.className = 'gm-rom-balken leiste' + (ev.leiste.voll ? ' voll' : '');
        balkenFuell.style.width = Math.round(100 * Math.min(1, ev.leiste.wert / Math.max(1, ev.leiste.ziel))) + '%';
        balkenText.textContent = ev.leiste.voll ? '🍝 Mamma-Mia-Leiste voll! Nonna gibt +20 % gegen den Imperator' : '🍝 Mamma-Mia-Leiste ' + ev.leiste.wert + ' / ' + ev.leiste.ziel;
      } else if (ph.nr === 3) {
        balken.hidden = false; balken.className = 'gm-rom-balken boss' + (ev.boss.besiegt ? ' besiegt' : '');
        var max = ev.boss.max || 1;
        balkenFuell.style.width = (ev.boss.max ? Math.round(100 * ev.boss.hp / max) : 100) + '%';
        balkenText.textContent = ev.boss.besiegt ? '🧀 Mozzarellus ist geschmolzen!' : ev.boss.max ? '👑 Imperatore Mozzarellus · ' + ev.boss.hp + ' / ' + ev.boss.max : '👑 Imperatore Mozzarellus wartet auf den ersten Schlag';
        if (!ev.boss.besiegt) {
          var h = ROM.haltung(ev, t), st = c.state(), passt = !!ROM.rollen(st)[h.rolle];
          haltungZeile.hidden = false; haltungZeile.textContent = h.zeichen + ' ' + h.name + ': ' + h.text + (passt ? ' ✓ Deine Truppe passt: ×1,4' : ' Deiner Truppe fehlt die Rolle.');
          haltungZeile.classList.toggle('passt', passt);
        }
      }
      /* Lire */
      lireZahl.textContent = '🪙 ' + lire + ' Lire'; stufenZeigen(lire);
      lireBox.hidden = ph.nr < 0;
      effekteZeigen();
      aktionenZeigen(ph, t, ich);
      if (ph.nr === 5) endeZeigen(ph);
      musikPruefen();
    }
    function phasenwechsel(alt, nr) {
      if (nr === -1) { ansageZeigen('ADMIN ABUSE!', 'CEO ' + ev.von + ' startet ROMA È FINITA', 3200); SG.audio.play('alert'); }
      else if (nr >= 0 && nr <= 4) { ansageZeigen(ROM.PHASEN[nr].ruf, ROM.PHASEN[nr].name, 2800); SG.audio.play('power'); musikPhase(false); }
      else if (nr === 5 && alt !== null) { SG.audio.play('win'); }
      if (nr !== 1) kampfKarte.hidden = true;
      folgen = false;
      if (szene()) szene().ziel(null);
    }
    function aktionenZeigen(ph, t, ich) {
      specs = [];
      aktionenSammeln(ph, t, ich);
      knoepfeSetzen();
    }
    function aktionenSammeln(ph, t, ich) {
      tanz.hidden = ph.nr !== 2; hinweis.textContent = '';
      leiste.hidden = ph.nr < 0 || ph.nr > 4;
      if (leiste.hidden) return;
      var w = c.world(), hier = w && w.position ? w.position() : null, imKampf = c.imKampf();
      if (imKampf) { tanz.hidden = true; hinweis.textContent = '⚔️ Nach deinem Kampf geht’s weiter – Rom wartet auf dich.'; return; }
      if (ph.nr === 0 || ph.nr === 1) {
        var zielId = szene() && szene().zielId(), ziel = zielId && ROM.pizza(ev, zielId, t);
        hinweis.textContent = ziel ? '🍕 Hinterher! Noch ' + Math.round(abstand(hier, ziel)) + ' m bis zur Pizza.' : 'Tippe eine Pizza an oder lass dich hinführen.';
        knopf('pizza', '🍕 Zur nächsten Pizza', function () { zurPizza(); });
      }
      if (ph.nr === 1) {
        var wagen = ROM.wagenOrt(ev, t), nah = abstand(hier, wagen) <= ROM.WAGEN.reichweite - 4, warten = ROM.dauer(ev, 20000) - (t - (ich.tGefecht || 0));
        if (!nah) knopf('legion', '⚔️ Zur Pizza-Legion', function () { hinlaufen(ROM.wagenOrt(ev, jetzt() + 3000)); }, false, 'gm-rom-haupt');
        else knopf('legion', warten > 0 ? '⚔️ Truppe verschnauft ' + Math.ceil(warten / 1000) + ' s' : '⚔️ Legionär stellen', function () { mitFrischemOrt(ROM.wagenOrt(ev, jetzt()), ROM.WAGEN.reichweite, 'gefecht'); }, warten > 0 || unterwegs, 'gm-rom-haupt');
        var g = ich.gefechte || {}; if (g.s || g.n) hinweis.textContent += ' · Gefechte: ' + g.s + ' gewonnen, ' + g.n + ' verloren';
      }
      if (ph.nr === 2) {
        tanzZeigen(t);
        var drin = abstand(hier, ROM.PIAZZA) <= ROM.POLONAISE.radius - 2;
        knopf('polonaise', drin ? '💃 Du tanzt Polonaise' : '💃 Zur Polonaise', function () { hinlaufen({ x: ROM.PIAZZA.x + (Math.random() - 0.5) * 8, z: ROM.PIAZZA.z + (Math.random() - 0.5) * 8 }); }, drin);
      }
      if (ph.nr === 3) {
        var boss = ROM.bossOrt(ev, t), nahBoss = abstand(hier, boss) <= ROM.BOSS.reichweite - 4;
        var vorrat = ROM.vorrat({ schlagStand: ich.schlagStand }, ev, t);
        if (ev.boss.besiegt) { hinweis.textContent = '🧀 Siegesparade! Genieß den Käseregen.'; }
        else {
          knopf('folgen', folgen ? '👣 Folge Mozzarellus' : '👣 Mozzarellus folgen', function () { folgen = !folgen; if (folgen) hinlaufen(ROM.bossOrt(ev, jetzt() + 3000)); zeichnen(); }, false, folgen ? 'aktiv' : '');
          knopf('schlag', '🗡 Zuschlagen' + ' ' + '●'.repeat(vorrat) + '○'.repeat(ROM.BOSS.vorrat - vorrat), function () {
            if (!nahBoss) { folgen = true; hinlaufen(ROM.bossOrt(ev, jetzt() + 3000)); return; }
            mitFrischemOrt(ROM.bossOrt(ev, jetzt()), ROM.BOSS.reichweite, 'schlag');
          }, vorrat < 1 || unterwegs, 'gm-rom-haupt');
          hinweis.textContent = nahBoss ? (ich.schlaege ? ich.schlaege + ' Schläge, ' + ich.schaden + ' Schaden' : 'Hau drauf!') : 'Lauf zu Mozzarellus – er zieht auf seinem Espresso-Wagen seine Runden.';
        }
      }
      if (ph.nr === 4) {
        knopf('muenze', ich.muenze ? '🪙 Deine Münze liegt im Brunnen' : '🪙 Münze in den Trevi werfen', function () { senden('muenze'); }, !!ich.muenze || unterwegs, 'gm-rom-haupt');
        hinweis.textContent = 'Fang die Münzen, die vom Himmel regnen!';
      }
    }
    function hinlaufen(p) { var w = c.world(); if (w && w.walkToPoint && p) w.walkToPoint({ x: p.x, z: p.z }); }
    function zurPizza() {
      var w = c.world(), s = szene(); if (!w || !s) return;
      var pz = s.naechstePizza(w.position());
      if (!pz) { c.notify('Gerade rennt keine Pizza herum, die du noch nicht hattest.'); return; }
      s.ziel(pz.id); hinlaufen(pz);
    }

    /* -------------------------------------------------------- Tanz */
    function tanzZeigen(t) {
      var runde = ROM.tanzRunde(ev, t), rundeBeginn = ROM.plan(ev).phasen[2].von + runde * ROM.TANZ_RUNDE;
      var folge = ROM.tanzFolge(ev, runde), zeigen = 2600 + folge.length * 250;
      if (runde !== tanzStand.runde) { tanzStand = { runde: runde, eingabe: [], gesendet: tanzStand.gesendet, zeigenBis: rundeBeginn + zeigen }; tanzBauen(folge); }
      var fertig = tanzStand.gesendet[runde] || (ev.ich && (ev.ich.tanz || []).indexOf(runde) >= 0);
      tanz.classList.toggle('zeigt', t < tanzStand.zeigenBis); tanz.classList.toggle('fertig', !!fertig);
      var rest = rundeBeginn + ROM.TANZ_RUNDE - t;
      tanz.titel.textContent = t < tanzStand.zeigenBis ? '👀 Merk dir die Tanzfolge!' : fertig ? '✓ Getanzt – nächste Runde in ' + Math.ceil(rest / 1000) + ' s' : '💃 Jetzt du! Tippe die Folge nach (' + tanzStand.eingabe.length + '/' + folge.length + ')';
      /* Die Posen erscheinen nacheinander, die Kakerlaken tanzen sie vor. */
      var gezeigt = Math.min(folge.length, Math.floor((t - rundeBeginn) / 450) + 1);
      tanz.folge.childNodes.forEach(function (n, i) { n.classList.toggle('sichtbar', t < tanzStand.zeigenBis ? i < gezeigt : i < tanzStand.eingabe.length); n.classList.toggle('richtig', i < tanzStand.eingabe.length); });
      if (t < tanzStand.zeigenBis && szene()) szene().pose(folge[Math.max(0, gezeigt - 1)]);
      tanz.tasten.forEach(function (b) { b.disabled = t < tanzStand.zeigenBis || !!fertig || unterwegs; });
    }
    function tanzBauen(folge) {
      UI.clear(tanz);
      tanz.titel = el('strong', ''); tanz.appendChild(tanz.titel);
      tanz.folge = el('div', undefined, 'gm-rom-folge');
      folge.forEach(function (p) { tanz.folge.appendChild(el('span', ROM.POSEN[p].zeichen)); });
      tanz.appendChild(tanz.folge);
      var tasten = el('div', undefined, 'gm-rom-tasten'); tanz.tasten = [];
      ROM.POSEN.forEach(function (p) {
        var b = button(p.zeichen, function () { tanzTippen(p.id); }, 'gm-rom-taste'); b.setAttribute('aria-label', p.name); b.title = p.name;
        tasten.appendChild(b); tanz.tasten.push(b);
      });
      tanz.appendChild(tasten);
    }
    function tanzTippen(pose) {
      var runde = tanzStand.runde, folge = ROM.tanzFolge(ev, runde);
      if (tanzStand.gesendet[runde]) return;
      tanzStand.eingabe.push(pose);
      if (szene()) szene().pose(pose);
      SG.audio.play('blip');
      if (tanzStand.eingabe.length >= folge.length) {
        tanzStand.gesendet[runde] = true;
        senden('tanz', { runde: runde, folge: tanzStand.eingabe.slice() });
      }
      zeichnen();
    }

    /* ------------------------------------------------ Schnellkampf */
    function kampfZeigen(k, sieg) {
      UI.clear(kampfKarte); kampfKarte.hidden = false;
      kampfKarte.appendChild(el('strong', '⚔️ ' + (k.wir || []).map(function (u) { return u.name; }).join(', ')));
      kampfKarte.appendChild(el('span', 'gegen ' + (k.sie || []).map(function (u) { return u.name; }).join(', '), 'gm-rom-gegner'));
      var zeilen = el('ol'); kampfKarte.appendChild(zeilen);
      var ergebnis = el('div', sieg ? '🏆 Sieg! +4 Lire' : '💨 Niederlage – 1 Trost-Lira', 'gm-rom-kampf-ergebnis ' + (sieg ? 'sieg' : 'niederlage')); ergebnis.hidden = true; kampfKarte.appendChild(ergebnis);
      var liste = (k.verlauf || []).slice(-10), i = 0;
      kampfKarte.onclick = function () { kampfKarte.hidden = true; };
      (function naechste() {
        if (dead || kampfKarte.hidden) return;
        if (i < liste.length) { zeilen.appendChild(el('li', liste[i++])); if (zeilen.childNodes.length > 5) zeilen.removeChild(zeilen.firstChild); c.after(naechste, ruhig ? 120 : 320); }
        else { ergebnis.hidden = false; c.after(function () { kampfKarte.hidden = true; }, 3500); }
      })();
    }

    /* ------------------------------------ Sternschnuppen und Regen */
    var fliegend = 0, naechsterStern = 0, naechstesFallen = 0;
    function sternschnuppe() {
      if (fliegend >= 3 || !ev) return;
      var url = SG.assets && SG.assets[R.ROM_ASSETS.stern];
      var s = el('button', undefined, 'gm-rom-stern'); s.type = 'button'; s.setAttribute('aria-label', 'Sternschnuppe fangen');
      if (url) { var img = document.createElement('img'); img.src = url; img.alt = ''; img.draggable = false; s.appendChild(img); } else s.appendChild(el('span', '🍕'));
      var links = Math.random() < 0.5, y0 = 5 + Math.random() * 30, y1 = y0 + 25 + Math.random() * 30;
      s.style.setProperty('--x0', links ? '-18vw' : '110vw'); s.style.setProperty('--x1', links ? '110vw' : '-18vw');
      s.style.setProperty('--y0', y0 + 'vh'); s.style.setProperty('--y1', y1 + 'vh');
      s.style.setProperty('--dreh', links ? '-30deg' : '30deg');
      s.style.animationDuration = (ruhig ? 7 : 4 + Math.random() * 1.5) + 's';
      s.classList.toggle('rechts', !links);
      fliegend++;
      function weg() { if (s.parentNode) { s.parentNode.removeChild(s); fliegend--; } }
      s.addEventListener('animationend', weg);
      s.addEventListener('pointerdown', function (e) {
        e.stopPropagation(); if (s.classList.contains('gefangen')) return;
        s.classList.add('gefangen'); senden('stern', null, false); c.after(weg, 500);
      });
      himmel.appendChild(s);
    }
    function fallendes(was, zeichen) {
      var f = el('button', zeichen, 'gm-rom-fall ' + was); f.type = 'button'; f.setAttribute('aria-label', 'Fangen');
      f.style.left = (5 + Math.random() * 85) + 'vw';
      f.style.animationDuration = (ruhig ? 6 : 3 + Math.random() * 2) + 's';
      if (was === 'vespa') { f.style.top = (25 + Math.random() * 45) + 'vh'; f.style.left = ''; }
      f.addEventListener('animationend', function () { if (f.parentNode) f.parentNode.removeChild(f); });
      f.addEventListener('pointerdown', function (e) { e.stopPropagation(); if (f.classList.contains('gefangen')) return; f.classList.add('gefangen'); fangen(was); plusZeigen('+1'); SG.audio.play('coin'); c.after(function () { if (f.parentNode) f.parentNode.removeChild(f); }, 350); });
      himmel.appendChild(f);
    }
    function himmelSchritt(ph, t) {
      if (!ph || ph.nr < 0 || ph.nr > 4) { UI.clear(himmel); fliegend = 0; return; }
      var ms = Date.now();
      if (ph.nr <= 3 && ms >= naechsterStern && (ev.ich.stern || 0) < ROM.STERN.max) { naechsterStern = ms + (ruhig ? 14000 : 8000) + Math.random() * 5000; sternschnuppe(); }
      var u = ev.ueberraschungen || {}, jetztFang = null;
      ['spaghetti', 'vespa'].forEach(function (id) { var d = ROM.UEBERRASCHUNGEN.find(function (x) { return x.id === id; }); if (u[id] && t >= u[id] && t < u[id] + ROM.dauer(ev, d.dauer) && ((ev.ich.fang || {})[id] || 0) + (fangTopf[id] || 0) < ROM.FANG[id]) jetztFang = id; });
      if (ph.nr === 4 && ((ev.ich.fang || {}).muenzen || 0) + (fangTopf.muenzen || 0) < ROM.FANG.muenzen) jetztFang = 'muenzen';
      if (jetztFang && ms >= naechstesFallen && himmel.querySelectorAll('.gm-rom-fall').length < 6) {
        naechstesFallen = ms + (ruhig ? 1400 : 700);
        fallendes(jetztFang, jetztFang === 'spaghetti' ? '🍝' : jetztFang === 'vespa' ? '🛵🍕' : '🪙');
      }
    }
    var gemeldeteUeberraschungen = {};
    function ueberraschungenMelden(t) {
      var u = ev.ueberraschungen || {};
      ROM.UEBERRASCHUNGEN.forEach(function (x) {
        var key = ev.id + ':' + x.id;
        if (u[x.id] && t - u[x.id] < 4000 && !gemeldeteUeberraschungen[key]) { gemeldeteUeberraschungen[key] = true; ansageZeigen(x.name + '!', x.text, 3000); SG.audio.play('levelup'); }
      });
    }

    /* ------------------------------------------------------ Abschluss */
    function endeZeigen(ph) {
      if (!ende.hidden && ende.dataset.ev === ev.id && ende.dataset.stand === zustandSchluessel()) return;
      if (ende.dataset.zu === ev.id) return;
      ende.dataset.ev = ev.id; ende.dataset.stand = zustandSchluessel();
      UI.clear(ende); ende.hidden = false;
      var ich = ev.ich || {}, st = c.state(), l = st && st.rom && st.rom.letztes && st.rom.letztes.ev === ev.id ? st.rom.letztes : null;
      ende.appendChild(el('h2', ph.abgebrochen ? '🇮🇹 Rom wurde vorzeitig beendet' : '🇮🇹 ROMA È FINITA!'));
      if (ev.vorschau) ende.appendChild(el('p', 'Vorschau in der Testzone – nichts davon ist echt.', 'gm-rom-vorschau'));
      var dein = el('div', undefined, 'gm-rom-ende-block'); dein.appendChild(el('h3', 'Dein Rom'));
      var pp = ich.proPhase || [0, 0, 0, 0, 0];
      dein.appendChild(el('p', '🪙 ' + (ich.lire || 0) + ' Lire · je Phase ' + ROM.PHASEN.map(function (p, i) { return pp[i] || 0; }).join(' / ') + (ich.stern ? ' · dazu ' + ich.stern + ' aus Sternschnuppen' : '')));
      var g = ich.gefechte || {};
      dein.appendChild(el('p', '⚔️ ' + (g.s || 0) + ' Legionäre besiegt · 💃 ' + ((ich.tanz || []).length) + ' Tanzrunden · 🗡 ' + (ich.schlaege || 0) + ' Schläge (' + (ich.schaden || 0) + ' Schaden)' + (ich.stern ? ' · 🌠 ' + ich.stern + ' Sternschnuppen' : '')));
      ende.appendChild(dein);
      var alle = el('div', undefined, 'gm-rom-ende-block'); alle.appendChild(el('h3', 'Gemeinsam'));
      alle.appendChild(el('p', '👥 ' + ev.teilnehmer + ' in Rom · 🍝 Mamma-Mia-Leiste ' + (ev.leiste.voll ? 'voll' : Math.round(100 * ev.leiste.wert / Math.max(1, ev.leiste.ziel)) + ' %') + ' · ' + (ev.boss.besiegt ? '🧀 Mozzarellus geschmolzen' : '🛵 Mozzarellus entkommen')));
      ende.appendChild(alle);
      var lohn = el('div', undefined, 'gm-rom-ende-block lohn'); lohn.appendChild(el('h3', 'Deine Belohnung'));
      if (l) {
        var liste = el('ul');
        (l.stufen || []).forEach(function (id) { var s = ROM.STUFEN.find(function (x) { return x.id === id; }); if (s) liste.appendChild(el('li', s.zeichen + ' ' + s.name + ' · garantiert')); });
        if (l.gold) liste.appendChild(el('li', '💰 ' + l.gold + ' Gold' + (l.leiste ? ' (inklusive 150 von Nonna)' : '')));
        Object.keys(l.runen || {}).forEach(function (r) { liste.appendChild(el('li', '💠 ' + l.runen[r] + ' ' + R.daten.SELTENHEITEN[r].name + '-Runen')); });
        if (l.ei === 'tasche') liste.appendChild(el('li', '🥚 Ein Rom-Ei, fertig ausgebrütet in deiner Brutstation – mindestens Legendär'));
        if (l.ei === 'warte') liste.appendChild(el('li', '🥚 Ein Rom-Ei – es wartet auf Platz in deiner Tasche'));
        if (l.ei === 'gold') liste.appendChild(el('li', '🥚 Tasche und Warteschlange voll: 350 Gold statt des Rom-Eis'));
        if (l.mozzarino === 'neu') liste.appendChild(el('li', '🛡 Centurio Mozzarino (Legendär) ist jetzt in deiner Sammlung!'));
        if (l.mozzarino === 'stufe') liste.appendChild(el('li', '🛡 Zweiter Centurio Mozzarino: eine Runenstufe mehr'));
        if (l.mozzarino === 'runen') liste.appendChild(el('li', '🛡 Centurio Mozzarino ist ausgereizt: 5 Legendär-Runen'));
        (l.titel || []).forEach(function (id) { var t2 = X.TITEL.find(function (x) { return x.id === id; }); if (t2) liste.appendChild(el('li', '🏅 Titel „' + t2.name + '“')); });
        if (!liste.childNodes.length) liste.appendChild(el('li', 'Diesmal nichts – für den Touristen braucht es 10 Lire.'));
        lohn.appendChild(liste);
        if (l.ei === 'tasche' || l.ei === 'warte') lohn.appendChild(button('🥚 Zur Brutstation', function () { ende.dataset.zu = ev.id; ende.hidden = true; c.eier(); }));
      } else if ((ich.lire || 0) > 0 && !lohnErwartet(ich)) {
        lohn.appendChild(el('p', ev.vorschau ? 'In der Vorschau gibt es nichts gutgeschrieben.' : 'Diesmal reicht es noch nicht: für den Touristen braucht es ' + ROM.STUFEN[0].ab + ' Lire.'));
      } else if ((ich.lire || 0) > 0) {
        lohn.appendChild(el('p', '⏳ Deine Belohnung wird gerade gutgeschrieben …'));
        abrechnungHolen();
      } else lohn.appendChild(el('p', 'Du warst diesmal nicht dabei. Beim nächsten Rom-Event reichen 10 Lire für den Touristen.'));
      ende.appendChild(lohn);
      ende.appendChild(button('Schließen', function () { ende.dataset.zu = ev.id; ende.hidden = true; }, 'gm-button'));
    }
    /* Dieselbe Rechnung wie bei der Abrechnung (ROM.lohn): gibt es fuer mich
       ueberhaupt etwas? Sonst wartet die Anzeige nicht auf eine Gutschrift,
       die nie kommt. */
    function lohnErwartet(ich) {
      var b = { lire: ich.proPhase || [], stern: ich.stern || 0, schlaege: ich.schlaege || 0 };
      var l = ROM.lohn(b, { leisteVoll: !!ev.leiste.voll, bossBesiegt: !!ev.boss.besiegt }, ev);
      return l.stufen.length > 0 || l.titel.length > 0;
    }
    function zustandSchluessel() { var st = c.state(); return st && st.rom && st.rom.letztes ? st.rom.letztes.ev : '-'; }
    /* Abgerechnet wird beim naechsten Weltzugriff nach dem Ende - den loest
       der Browser hier selbst aus, statt bis zur naechsten Weltabfrage zu warten. */
    function abgerechnet() { var st = c.state(); return !!(st && st.rom && st.rom.letztes && st.rom.letztes.ev === ev.id); }
    /* Hoechstens fuenf Versuche im Abstand von acht Sekunden - danach kommt
       die Gutschrift mit der normalen Weltabfrage (alle 30 Sekunden). */
    var abrechnungVersuche = 0;
    function abrechnungHolen() {
      var ms = Date.now();
      if (abrechnungVersuche >= 5 || (abgerechnetAngefragt && ms - abgerechnetAngefragt < 8000)) return;
      if (jetzt() < ROM.ende(ev) + 3500) return;
      abgerechnetAngefragt = ms;
      if (c.busy() || c.imKampf()) return;
      abrechnungVersuche++;
      R.online.request('world').then(function (res) { if (!dead) c.apply(res); }).catch(function () { /* naechster Versuch */ });
    }

    /* --------------------------------------------------------- Takt */
    function schritt() {
      if (dead) return;
      uhr = c.after(schritt, 250);
      if (!ev) return;
      var t = jetzt(), ph = ROM.phase(ev, t);
      if (!ph) return;
      /* Wartet eine Aktion auf den frischen Standort? */
      if (warteAufOrt) {
        var gemeldet = c.gemeldet();
        if (gemeldet && Date.now() - gemeldet.t < 2500 && abstand(gemeldet, warteAufOrt.ziel) <= warteAufOrt.radius) { var a = warteAufOrt; warteAufOrt = null; senden(a.art, a.daten); }
        else if (Date.now() > warteAufOrt.bis) warteAufOrt = null;
      }
      var w = c.world(), hier = w && w.position ? w.position() : null, s = szene();
      /* Pizza im Visier: nachlaufen und schnappen, sobald man dran ist. */
      if ((ph.nr === 0 || ph.nr === 1) && s && s.zielId() && hier && !unterwegs && !c.imKampf()) {
        var pz = ROM.pizza(ev, s.zielId(), t);
        if (!pz) s.ziel(null);
        else if (abstand(hier, pz) <= 6) { if (!warteAufOrt) mitFrischemOrt(pz, ROM.PIZZA_NAEHE - 1, 'zutat', { pizzaId: pz.id }); }
        else if (Date.now() % 1000 < 260) hinlaufen(pz);
      }
      /* Polonaise: wer auf der Piazza steht, tanzt mit. */
      if (ph.nr === 2 && hier && abstand(hier, ROM.PIAZZA) <= ROM.POLONAISE.radius - 2 && !unterwegs && !c.imKampf()
        && t - ((ev.ich && ev.ich.tPolonaise) || 0) >= ROM.dauer(ev, ROM.POLONAISE.takt) && !warteAufOrt) mitFrischemOrt(ROM.PIAZZA, ROM.POLONAISE.radius, 'polonaise');
      /* Mozzarellus folgen */
      if (ph.nr === 3 && folgen && hier && Date.now() % 2000 < 260) hinlaufen(ROM.bossOrt(ev, t + 2500));
      ueberraschungenMelden(t);
      himmelSchritt(ph, t);
      if (ph.nr === 5 && ev.ich && ev.ich.lire && !ev.vorschau && lohnErwartet(ev.ich) && !abgerechnet()) abrechnungHolen();
      zeichnen();
    }
    uhr = c.after(schritt, 250);

    return {
      /* Stand aus der Positionsmeldung - fehlt er, laeuft kein Event. */
      presenz: function (sicht, serverTime) {
        if (dead) return;
        if (!sicht) { if (ev) { ev = null; if (szene()) szene().setEvent(null); UI.clear(himmel); zeichnen(); } return; }
        uebernehmen(sicht, serverTime);
      },
      /* Nach einer Weltabfrage: die Abrechnung steht im Profil. */
      apply: function () { if (ev) zeichnen(); },
      aktiv: function () { return !!ev && ROM.laeuft(ev, jetzt()); },
      destroy: function () {
        dead = true; if (uhr) c.cancel(uhr); if (fangUhr) c.cancel(fangUhr);
        musikStoppen(false); c.root.removeEventListener('pointerdown', geste, true);
        c.root.classList.remove('gm-rom-an'); if (box.parentNode) box.parentNode.removeChild(box);
      }
    };
  };
})(SG);
