/* ------------------------------------------------------------------
   Rom-Event - der Reiter im Admin-Menue, nur fuer den CEO.

   Startet, beobachtet und beendet "ROMA È FINITA" in GehstockMon. Der
   Reiter erscheint nur beim CEO (A.binOwner). Das ist Bequemlichkeit, keine
   Sicherheit: jede Anfrage prueft der Spielserver selbst - gegen den CEO in
   der Verwaltung und, auf der echten Seite, gegen die Event-PIN
   (netlify/functions/lib/gehstockmon-rom.mjs).

   Wie beim Reiter "Geben" geht die Anfrage hier eigenhaendig raus und
   nicht ueber SG.gehstockmon.online - dessen Anfragen tragen die Testzone
   mit sich. Nur die Vorschau schickt die Testzone ausdruecklich mit.
   ------------------------------------------------------------------ */

(function (SG) {
  var UI = SG.ui;
  var A = SG.auth;

  var RS = SG.romSteuerung = {};
  var TESTZONE = '3141';

  function rom() { return SG.gehstockmon && SG.gehstockmon.abenteuer && SG.gehstockmon.abenteuer.ROM; }
  function aktionId() { return window.crypto && crypto.randomUUID ? crypto.randomUUID() : 'rs-' + Date.now().toString(36) + Math.random().toString(36).slice(2); }
  function uhrzeit(t) { return new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }).format(new Date(t)); }
  function dauer(ms) { var s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

  RS.senden = function (nutzlast, testzone) {
    if (SG.offline || SG.env.file) return Promise.reject(new Error('Dafür braucht es die veröffentlichte Website.'));
    if (!A.aktuell) return Promise.reject(new Error('Nicht angemeldet.'));
    return fetch('/api/gehstockmon', {
      method: 'POST', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ op: 'rom_steuern', code: A.aktuell.code, name: A.aktuell.name || 'CEO' },
        testzone ? { adminOverride: true, adminCode: TESTZONE } : {}, nutzlast || {})),
    }).then(function (res) {
      if ((res.headers.get('content-type') || '').indexOf('json') < 0) throw new Error('Der Spielserver ist hier nicht erreichbar.');
      return res.json().then(function (r) {
        if (!res.ok || r.error) throw new Error(r.error || 'Server nicht erreichbar.');
        return r;
      });
    });
  };

  /* Nur am Entwicklungsserver und nur, solange beide Leitungsstuehle frei
     sind: ein Knopf, um sich selbst zum CEO zu machen. Auf der echten Seite
     sind die Stuehle besetzt, und das Relais laesst es ohnehin nicht zu
     (leitungSchuetzen in room.mjs). */
  RS.devHilfe = function (ziel, neu) {
    var lokal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
    if (!lokal || !A.ownerFrei() || !A.aufsichtFrei() || !A.istAdmin()) return;
    ziel.appendChild(UI.btn('🛠 Entwicklung: CEO werden (Rom-Event testen)', function () {
      if (!A.ownerSetzen(A.aktuell.code)) { UI.toast('Ging nicht - der Stuhl ist schon besetzt.', 'bad'); return; }
      UI.toast('Du bist jetzt CEO. Der Reiter „Rom-Event“ ist da.', 'good');
      setTimeout(function () { if (neu) neu(); }, 400);
    }, 'ghost'));
  };

  /* ---------------------------------------------------------- Der Reiter */
  RS.reiter = function (ziel) {
    var ROM = rom();
    if (!ROM) { ziel.appendChild(UI.empty('🇮🇹', 'GehstockMon fehlt', 'Ohne die Spieldaten lässt sich kein Event starten.')); return; }
    var stand = null, uhr = null, abstand = 0;
    var kasten = UI.el('div.rs-kasten');
    ziel.appendChild(UI.el('p.small.muted', { text: 'ROMA È FINITA – der große Pizzaputsch. 12 Minuten Rom in GehstockMon für alle '
      + 'Spieler derselben Welt, egal über welche Adresse, mit echten Belohnungen. Nur du als CEO kannst es starten.' }));
    ziel.appendChild(kasten);

    function laden() {
      if (!ziel.isConnected) { if (uhr) clearTimeout(uhr); return; }
      RS.senden({ aktion: 'status' }).then(function (r) { abstand = r.serverTime - Date.now(); stand = r.steuerung; zeichnen(); })
        .catch(function (err) { stand = null; zeichnen(err.message); })
        .finally(function () { if (ziel.isConnected) uhr = setTimeout(laden, 4000); });
    }
    /* Neu aufgebaut wird nur, wenn sich die Lage aendert (laeuft, beendet,
       startbar ...). Sonst werden nur die Texte nachgezogen: ersetzt ein
       Neuaufbau einen Knopf zwischen Antippen und Loslassen, geht der Tipp
       auf dem iPad verloren - und der Stand kommt alle vier Sekunden. */
    var signatur = null, text = {};
    function zeichnen(fehler) {
      var jetzt = Date.now() + abstand, ev = stand && stand.event, ph = ev ? ROM.phase(ev, jetzt) : null, laeuft = !!(ph && ph.nr < 5);
      var sig = JSON.stringify([fehler || '', !!stand, stand && stand.dev, laeuft, ev && ev.id, !!(ph && ph.nr === 5), stand && stand.gesperrtBis, stand && stand.startbar, stand && stand.grund]);
      if (sig !== signatur) { signatur = sig; aufbauen(fehler, ev, ph, laeuft); }
      if (laeuft) {
        text.titel.textContent = (ev.vorschau ? '🧪 Vorschau · ' : '🇮🇹 ') + (ph.nr < 0 ? 'Countdown' : 'Phase ' + (ph.nr + 1) + ' von 5: ' + ROM.PHASEN[ph.nr].name);
        text.zeit.textContent = 'Noch ' + dauer(ROM.ende(ev) - jetzt) + ' · Ende gegen ' + uhrzeit(ROM.ende(ev)) + ' Uhr · gestartet von ' + (ev.von || 'CEO') + (ev.faktor > 1 ? ' · Zeitraffer ×' + ev.faktor : '');
        text.lage.textContent = '👥 ' + ev.teilnehmer + ' dabei · 🍝 Leiste ' + ev.leiste.wert + '/' + ev.leiste.ziel + (ev.leiste.voll ? ' (voll)' : '')
          + ' · 👑 ' + (ev.boss.besiegt ? 'Mozzarellus besiegt' : ev.boss.max ? 'Mozzarellus ' + ev.boss.hp + '/' + ev.boss.max : 'Mozzarellus noch unberührt');
      } else if (text.letztes && ev) {
        text.letztes.textContent = (ev.abgebrochenAm ? '⛔ Zuletzt abgebrochen' : '✅ Zuletzt beendet') + ' um ' + uhrzeit(ROM.ende(ev)) + ' Uhr · ' + ev.teilnehmer + ' dabei · ' + (ev.boss.besiegt ? 'Mozzarellus besiegt' : 'Mozzarellus entkommen');
      }
    }
    function aufbauen(fehler, ev, ph, laeuft) {
      UI.clear(kasten); text = {};
      if (fehler) { kasten.appendChild(UI.el('div.rs-karte.bad', { text: '⚠️ ' + fehler })); return; }
      if (!stand) { kasten.appendChild(UI.el('p.small.muted', { text: 'Stand wird geladen …' })); return; }
      if (stand.dev) kasten.appendChild(UI.el('div.rs-karte', { text: '🛠 Entwicklungsserver: keine PIN, keine Öffnungszeiten, keine Wochengrenze, Zeitraffer wählbar.' }));
      if (laeuft) {
        var karte = UI.el('div.rs-karte.laeuft');
        text.titel = UI.el('strong'); text.zeit = UI.el('p'); text.lage = UI.el('p');
        karte.appendChild(text.titel); karte.appendChild(text.zeit); karte.appendChild(text.lage);
        kasten.appendChild(karte);
        kasten.appendChild(UI.btn('⛔ Event abbrechen', function () { abbrechen(stand.event || ev); }, 'bad'));
        kasten.appendChild(UI.el('p.small.muted', { text: 'Beim Abbruch wird alles bisher Verdiente ausgezahlt. Im Countdown abgebrochen zählt das Event nicht als Event dieser Woche.' }));
        return;
      }
      if (ev && ph && ph.nr === 5) { text.letztes = UI.el('div.rs-karte'); kasten.appendChild(text.letztes); }
      if (stand.gesperrtBis) kasten.appendChild(UI.el('div.rs-karte.bad', { text: '🔒 Zu viele falsche PINs - wieder möglich ab ' + uhrzeit(stand.gesperrtBis) + ' Uhr.' }));
      var start = UI.btn('🇮🇹 Rom-Event starten', function () { starten(false); }, 'primary rs-start');
      start.disabled = !stand.startbar;
      kasten.appendChild(start);
      if (stand.grund) kasten.appendChild(UI.el('p.small', { text: stand.grund }));
      kasten.appendChild(UI.btn('🧪 Vorschau in der Testzone', function () { starten(true); }, 'ghost'));
      kasten.appendChild(UI.el('p.small.muted', { text: 'Die Vorschau läuft in der Developer-Testzone im Zeitraffer: dieselbe Show, aber ohne echte Belohnungen und ohne die echte Spielerwelt zu berühren.' }));
      kasten.appendChild(UI.kv([
        ['Dauer', '1 Minute Countdown + 12 Minuten, 5 Phasen'],
        ['Belohnung', 'ab 10 Lire: 200 Gold + Rom-Ei (mind. Legendär) · ab 40: +300 Gold, 3 Episch-Runen · ab 75: +250 Gold, Titel'],
        ['Gemeinsam', 'volle Mamma-Mia-Leiste: +150 Gold · Mozzarellus besiegt: Centurio Mozzarino für Gladiatoren'],
        ['Grenzen', 'ein echtes Event pro Woche, nur während der Öffnungszeiten'],
      ]));
    }

    function starten(vorschau) {
      var id = aktionId(), faktoren = vorschau ? [3, 6, 1] : (stand && stand.zeitraffer) || [1], pinNoetig = !vorschau && stand && stand.pinNoetig;
      var jetzt = Date.now() + abstand;
      var pin = UI.el('input.code-input', { type: 'password', inputMode: 'numeric', autocomplete: 'off', placeholder: 'Event-PIN', maxLength: 12 });
      var faktor = UI.el('select.rs-select');
      faktoren.forEach(function (f) { faktor.appendChild(UI.el('option', { value: String(f), text: f === 1 ? 'Echtzeit (13 Minuten)' : 'Zeitraffer ×' + f + ' (' + Math.round(13 / f * 10) / 10 + ' Minuten)' })); });
      var ansage = UI.el('input', { type: 'checkbox', checked: !vorschau });
      var fehler = UI.el('p.small.rs-fehler');
      var teile = [
        UI.el('p', { text: vorschau
          ? 'Startet ROMA È FINITA in der Developer-Testzone. Dort landen nur Admins, die die Testzone betreten - Belohnungen gibt es nur zum Anschauen.'
          : 'ROMA È FINITA startet in 60 Sekunden für alle Spieler der GehstockMon-Welt - egal über welche Adresse sie spielen. '
            + 'Dauer 12 Minuten, Ende gegen ' + uhrzeit(jetzt + ROM.GESAMT) + ' Uhr. Die Belohnungen sind echt, und es zählt als Event dieser Woche.' }),
      ];
      if (faktoren.length > 1) teile.push(UI.el('label.rs-zeile', null, [UI.el('span', { text: 'Tempo' }), faktor]));
      if (pinNoetig) teile.push(UI.el('label.rs-zeile', null, [UI.el('span', { text: 'Event-PIN' }), pin]));
      if (!vorschau) teile.push(UI.el('label.rs-zeile.rs-haken', null, [ansage, UI.el('span', { text: 'Ansage im Hub, solange Rom läuft' })]));
      teile.push(fehler);
      var laeuft = false;
      var m = UI.modal({
        title: vorschau ? '🧪 Vorschau starten?' : '🇮🇹 Rom-Event starten?',
        body: teile,
        actions: [
          { label: 'Abbrechen', cls: 'ghost' },
          { label: vorschau ? 'Vorschau starten' : 'Jetzt starten', cls: 'primary', keepOpen: true, onClick: function () {
            if (laeuft) return;
            if (pinNoetig && !/^\d{4,12}$/.test(pin.value)) { fehler.textContent = 'Bitte die Event-PIN eingeben (4 bis 12 Ziffern).'; return; }
            laeuft = true; fehler.textContent = 'Wird gestartet …';
            var knopf = m.foot && m.foot.lastChild; if (knopf) knopf.disabled = true;
            RS.senden({ aktion: 'start', aktionId: id, pin: pin.value, faktor: Number(faktor.value) || 1 }, vorschau).then(function (r) {
              m.close();
              var ende = (r.serverTime || Date.now()) + ROM.GESAMT / (Number(faktor.value) || 1);
              if (!vorschau) {
                if (ansage.checked) A.ansageSetzen('🇮🇹 ADMIN ABUSE: ROMA È FINITA läuft jetzt in GehstockMon! Pizzen mit Beinen, Kakerlaken mit Sombreros und Imperatore Mozzarellus - komm auf die Insel, es gibt echte Belohnungen.', 'warnung', ende);
                if (SG.protokoll && SG.protokoll.schreiben) SG.protokoll.schreiben('rom', 'Rom-Event gestartet', '', A.aktuell.code);
                UI.toast('Rom-Event gestartet - Ende gegen ' + uhrzeit(ende) + ' Uhr.', 'good');
              } else {
                /* Direkt in die Testzone: GehstockMon liest den Merker beim Oeffnen. */
                try { sessionStorage.setItem('hgh:gm-admin:' + A.aktuell.code, '1'); } catch (e) { /* dann per Hand */ }
                UI.toast('Vorschau läuft - GehstockMon öffnet in der Testzone.', 'good');
                if (UI.closeTopModal) UI.closeTopModal();
                if (SG.router) { if (location.hash === '#/spiel/gehstockmon') SG.router.reload(); else SG.router.go('#/spiel/gehstockmon'); }
              }
              laden();
            }).catch(function (err) {
              laeuft = false; fehler.textContent = err.message; if (knopf) knopf.disabled = false;
            });
          } },
        ],
      });
      setTimeout(function () { if (pinNoetig) pin.focus(); }, 60);
    }

    function abbrechen(ev) {
      var id = aktionId(), pinNoetig = stand && stand.pinNoetig && !ev.vorschau;
      var pin = UI.el('input.code-input', { type: 'password', inputMode: 'numeric', autocomplete: 'off', placeholder: 'Event-PIN', maxLength: 12 });
      var fehler = UI.el('p.small.rs-fehler');
      var m = UI.modal({
        title: '⛔ Rom-Event abbrechen?',
        body: [UI.el('p', { text: 'Rom endet sofort für alle. Wer schon Lire gesammelt hat, bekommt die erreichten Stufen ausgezahlt - der Tourist schon ab 1 Lira.' }),
          pinNoetig ? UI.el('label.rs-zeile', null, [UI.el('span', { text: 'Event-PIN' }), pin]) : null, fehler],
        actions: [
          { label: 'Weiterlaufen lassen', cls: 'ghost' },
          { label: 'Abbrechen', cls: 'bad', keepOpen: true, onClick: function () {
            fehler.textContent = 'Wird abgebrochen …';
            RS.senden({ aktion: 'abbruch', aktionId: id, pin: pin.value }, !!ev.vorschau).then(function () {
              m.close();
              if (!ev.vorschau) { var a = A.ansage(); if (a && a.bis && /ROMA/.test(a.text || '')) A.ansageSetzen(null); if (SG.protokoll && SG.protokoll.schreiben) SG.protokoll.schreiben('rom', 'Rom-Event abgebrochen', '', A.aktuell.code); }
              UI.toast('Rom-Event abgebrochen.', 'good'); laden();
            }).catch(function (err) { fehler.textContent = err.message; });
          } },
        ],
      });
    }

    laden();
  };
})(SG);
