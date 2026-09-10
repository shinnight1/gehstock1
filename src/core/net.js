/* ------------------------------------------------------------------
   Online-Mehrspieler ohne eigenen Server.

   Netlify hostet nur statisch, also gibt es keinen dauerhaften Socket.
   Alle Online-Spiele hier sind rundenbasiert, deshalb genuegt ein
   winziges Relais als Netlify-Funktion:

     - Der Server kennt keine Spielregeln. Er speichert nur eine
       Aktionsliste, einen Zufallskern und die Sitzplaetze.
     - Jeder Client spielt dieselbe Liste durch dieselbe Regel-Engine
       ab. Damit sehen alle exakt denselben Zustand.
     - Eine Aktion wird lokal erneut gegen die Regeln geprueft, bevor
       sie angewendet wird - ein manipulierter Client kann also nicht
       ausserhalb der Regeln ziehen.
     - Gewartet wird nicht mehr hier, sondern in SG.relais: eine
       einzige offene Anfrage je Geraet fuer Spiel, Chat, Verwaltung
       und alles andere. Vorher waren es drei gleichzeitig - und weil
       Netlify nur wenige Funktionen parallel laufen laesst, standen
       sie Schlange. Genau das war die alte Verzoegerung.

   Das laeuft ueber gewoehnliches HTTPS und damit auch in strengen
   Schul-WLANs.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var UI = SG.ui;

  var Rel = SG.relais;
  var N = SG.net = {};

  /* Verbindung und Fehlererkennung liegen jetzt vollstaendig in
     SG.relais - dort haengt auch die eine gemeinsame Warteschleife.
     Diese beiden Namen bleiben, weil die Spiele sie benutzen. */
  Object.defineProperty(N, 'serviceMissing', {
    get: function () { return Rel.serviceFehlt; },
    set: function (v) { Rel.serviceFehlt = !!v; },
  });

  N.available = function () { return Rel.verfuegbar(); };

  var post = Rel.post;

  /* ------------------------------------------------------------------
     Raum-Client
     ------------------------------------------------------------------ */

  N.room = function (o) {
    o = o || {};
    var bus = U.emitter();
    var R = {
      game: o.game,
      seats: o.seats || 2,
      code: null,
      playerId: null,
      token: null,
      seat: -1,
      isHost: false,
      seed: 1,
      players: [],
      log: [],
      version: 0,
      started: false,
      status: 'offline',
      on: bus.on,
      off: bus.off,
    };

    var stopped = false, pingTimer = 0;

    /* Eigene Zuege werden sofort lokal ausgefuehrt und erst danach
       verschickt. Damit sie nicht ein zweites Mal ankommen, wenn das
       Relais sie an alle zurueckspiegelt, bekommt jede Aktion eine
       Kennnummer, die hier gemerkt und beim Empfang wieder aussortiert
       wird. Ohne das wuerde jeder Zug doppelt gespielt. */
    var eigene = {}, laufendeNummer = 0;

    function setStatus(s, msg) {
      R.status = s;
      bus.emit('status', s, msg);
    }

    function absorb(res) {
      if (!res) return;
      if (res.seed) R.seed = res.seed;
      if (res.players) {
        R.players = res.players;
        bus.emit('players', R.players);
      }
      if (typeof res.started === 'boolean' && res.started !== R.started) {
        R.started = res.started;
        if (R.started) bus.emit('start');
      }
      if (res.log && res.version > R.version) {
        var fresh = res.log.slice(R.log.length);
        R.log = res.log;
        R.version = res.version;
        // Eigene, lokal bereits ausgefuehrte Zuege herausfiltern
        var fremd = [];
        for (var i = 0; i < fresh.length; i++) {
          var kn = fresh[i] && fresh[i].a && fresh[i].a._n;
          if (kn && eigene[kn]) { delete eigene[kn]; continue; }
          fremd.push(fresh[i]);
        }
        if (fremd.length) bus.emit('actions', fremd, R.log);
      } else if (typeof res.version === 'number') {
        R.version = Math.max(R.version, res.version);
      }
      /* Der eigene Zug kommt als Antwort auf 'act' zurueck, nicht ueber
         die Schleife. Ohne diese Zeile wuesste die Schleife das nicht
         und liesse sich denselben Stand gleich noch einmal schicken. */
      Rel.raumVersion(R.version);
      if (res.closed) {
        setStatus('closed');
        bus.emit('closed', res.reason || '');
      }
    }

    function remember() {
      try {
        sessionStorage.setItem('hgh:room:' + R.game, JSON.stringify({
          code: R.code, playerId: R.playerId, token: R.token,
        }));
      } catch (e) { /* egal */ }
    }

    R.create = function (name, opts) {
      setStatus('connecting');
      return post({
        op: 'create', game: R.game, seats: R.seats,
        name: name || 'Spieler', opts: opts || {},
      }).then(function (res) {
        R.code = res.code; R.playerId = res.playerId; R.token = res.token;
        R.seat = res.seat; R.isHost = true; R.seed = res.seed;
        absorb(res);
        remember();
        setStatus('waiting');
        zuhoeren();
        return R;
      }, function (e) {
        setStatus('error', friendly(e));
        throw e;
      });
    };

    R.join = function (code, name) {
      setStatus('connecting');
      return post({
        op: 'join', code: String(code || '').toUpperCase().replace(/\s/g, ''),
        game: R.game, name: name || 'Spieler',
      }).then(function (res) {
        R.code = res.code; R.playerId = res.playerId; R.token = res.token;
        R.seat = res.seat; R.isHost = !!res.isHost; R.seed = res.seed;
        absorb(res);
        remember();
        setStatus(res.started ? 'playing' : 'waiting');
        zuhoeren();
        return R;
      }, function (e) {
        setStatus('error', friendly(e));
        throw e;
      });
    };

    /* Versucht, eine unterbrochene Sitzung fortzusetzen */
    R.resume = function () {
      var raw;
      try { raw = sessionStorage.getItem('hgh:room:' + R.game); } catch (e) { return Promise.reject(); }
      if (!raw) return Promise.reject();
      var s;
      try { s = JSON.parse(raw); } catch (e) { return Promise.reject(); }
      if (!s || !s.code) return Promise.reject();
      setStatus('connecting');
      return post({ op: 'resume', code: s.code, playerId: s.playerId, token: s.token })
        .then(function (res) {
          R.code = s.code; R.playerId = s.playerId; R.token = s.token;
          R.seat = res.seat; R.isHost = !!res.isHost; R.seed = res.seed;
          R.log = []; R.version = 0;
          absorb(res);
          setStatus(res.started ? 'playing' : 'waiting');
          zuhoeren();
          return R;
        });
    };

    R.start = function (meta) {
      return post({
        op: 'start', code: R.code, playerId: R.playerId, token: R.token, meta: meta || {},
      }).then(absorb);
    };

    /* Aktion an alle verteilen. Das Spiel hat sie lokal bereits
       ausgefuehrt - die Kennnummer sorgt dafuer, dass der Rueckweg vom
       Relais sie nicht ein zweites Mal anwendet. */
    R.send = function (action) {
      if (!R.code) return Promise.resolve();
      action = action || {};
      action._n = R.playerId + ':' + (++laufendeNummer);
      eigene[action._n] = true;
      return post({
        op: 'act', code: R.code, playerId: R.playerId, token: R.token,
        action: action, seat: R.seat,
      }).then(absorb, function (e) {
        // Kam der Zug nicht durch, darf er auch nicht gefiltert werden.
        delete eigene[action._n];
        setStatus('error', friendly(e));
      });
    };

    R.leave = function () {
      stopped = true;
      clearInterval(pingTimer);
      Rel.raumEnde();
      Rel.off('stoerung', stoerung);
      try { sessionStorage.removeItem('hgh:room:' + R.game); } catch (e) { /* egal */ }
      if (!R.code) return Promise.resolve();
      var p = post({ op: 'leave', code: R.code, playerId: R.playerId, token: R.token }, 3000)
        .catch(function () { /* egal */ });
      R.code = null;
      setStatus('offline');
      return p;
    };

    /* Zuhoeren.

       Es gibt keine eigene Warteschleife mehr. Der Raum haengt sich in
       die eine Verbindung des Geraets (SG.relais) ein - zusammen mit
       Chat, Verwaltung und allem anderen. Das war der Hauptgrund fuer
       die alte Verzoegerung: drei offene Anfragen je iPad, und Netlify
       laesst nur wenige gleichzeitig laufen. */
    function zuhoeren() {
      if (stopped || !R.code) return;
      Rel.raumBeobachten(R.code, R.version, function (res) {
        if (stopped) return;
        if (R.status === 'error' || R.status === 'reconnecting') {
          setStatus(R.started ? 'playing' : 'waiting');
        }
        absorb(res);
      });
      Rel.starten();

      /* Der gruene Punkt bei den Mitspielern braucht ab und zu ein
         Lebenszeichen. Selten genug, dass es keinen Zug ueberholt. */
      clearInterval(pingTimer);
      pingTimer = setInterval(function () {
        if (stopped || !R.code) return;
        post({ op: 'ping', code: R.code, playerId: R.playerId, token: R.token }, 8000)
          .catch(function () { /* egal */ });
      }, 15000);
    }

    var stoerung = function () {
      if (stopped || !R.code) return;
      setStatus('reconnecting', 'Verbindung wackelt');
    };
    Rel.on('stoerung', stoerung);

    function friendly(e) {
      var m = String((e && e.message) || e);
      if (/abort/i.test(m)) return 'Zeitüberschreitung';
      if (/room_not_found/.test(m)) return 'Raum nicht gefunden';
      if (/room_full/.test(m)) return 'Raum ist voll';
      if (/bad_token/.test(m)) return 'Sitzung abgelaufen';
      if (/game_mismatch/.test(m)) return 'Der Code gehört zu einem anderen Spiel';
      if (/no_service/.test(m)) {
        return 'Auf dieser Seite läuft kein Online-Dienst. Die Netlify-Funktion '
          + 'fehlt — beim Hochladen des Ordners per Drag-and-drop wird sie nicht '
          + 'mitgeliefert. Gegen den Computer und zu zweit am selben iPad geht es weiter.';
      }
      if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Keine Verbindung';
      return m;
    }
    R.friendly = friendly;

    return R;
  };

  /* ------------------------------------------------------------------
     Lobby-Oberflaeche: Modus waehlen, Raum erstellen oder beitreten.
     Liefert { mode:'local'|'ai'|'online', room?, seats? }
     ------------------------------------------------------------------ */

  N.lobby = function (host, o) {
    o = o || {};
    return new Promise(function (resolve) {
      var modes = o.modes || ['ai', 'local', 'online'];
      var body = UI.el('div');
      var picked = false;
      var weiter = false;   // absichtlicher Wechsel in den naechsten Dialog

      /* Das Versprechen darf genau einmal aufgeloest werden. Ohne diese
         Schranke gewinnt der erste Aufruf - und das war bisher das
         onClose des Modusdialogs, das beim Weiterschalten zum
         Online-Dialog feuerte und die Wahl als "abgebrochen" meldete. */
      function ende(v) {
        if (picked) return;
        picked = true;
        resolve(v);
      }

      function choose(v) {
        if (picked) return;
        weiter = true;
        m.close();
        ende(v);
      }

      var labels = {
        ai: { ic: '🤖', t: o.aiLabel || 'Gegen den Computer', d: o.aiDesc || 'Sofort losspielen.' },
        local: { ic: '👥', t: 'Zu zweit an einem iPad', d: 'Abwechselnd am selben Gerät.' },
        online: { ic: '🌐', t: 'Online mit Raum-Code', d: 'Freunde treten mit einem Code bei.' },
      };

      modes.forEach(function (mode) {
        var l = labels[mode];
        if (!l) return;
        var disabled = mode === 'online' && !N.available();
        body.appendChild(UI.el('div.item' + (disabled ? '.locked' : '.tap'), {
          on: {
            click: function () {
              if (disabled) {
                UI.toast(N.serviceMissing
                  ? 'Auf dieser Seite läuft kein Online-Dienst — die Netlify-Funktion fehlt.'
                  : 'Online geht nur auf der Webseite, nicht in der Offline-Datei.',
                'bad', 4200);
                return;
              }
              if (mode === 'online') openOnline();
              else choose({ mode: mode });
            },
          },
        }, [
          UI.el('div.thumb', { text: l.ic }),
          UI.el('div.main', null, [
            UI.el('div.t', { text: l.t }),
            UI.el('div.d', {
              text: !disabled ? l.d
                : (N.serviceMissing ? 'Auf dieser Seite nicht eingerichtet.'
                  : 'In der Offline-Datei nicht verfügbar.'),
            }),
          ]),
          UI.el('div.side', null, [UI.el('div.s', { text: disabled ? '' : '›' })]),
        ]));
      });

      var m = UI.modal({
        parent: host.root,
        title: o.title || 'Spielmodus',
        body: body,
        closable: o.closable !== false,
        onClose: function () { if (!weiter) ende(null); },
      });

      /* -------------------------------------------------- Online-Zweig */

      function openOnline() {
        // Erst merken, dann schliessen: close() loest onClose sofort aus.
        weiter = true;
        m.close();
        var b2 = UI.el('div');
        var nameInput = UI.el('input', {
          type: 'text',
          value: SG.storage.get('playerName', ''),
          placeholder: 'Dein Name',
          maxLength: 14,
          style: {
            width: '100%', height: '46px', background: '#0b0e15',
            border: '1px solid var(--line)', borderRadius: '10px',
            color: 'var(--text)', padding: '0 12px', outline: 'none', marginBottom: '12px',
          },
        });
        var codeInput = UI.el('input.code-input', {
          type: 'text', placeholder: 'CODE', maxLength: 6,
          autocapitalize: 'characters', autocorrect: 'off', spellcheck: false,
        });

        UI.add(b2, [
          UI.el('p.small.muted', { text: 'Name (wird den Mitspielern gezeigt)' }),
          nameInput,
          UI.btn('Neuen Raum erstellen', function () { go('create'); }, 'primary wide'),
          UI.el('div', {
            style: {
              textAlign: 'center', color: 'var(--dim)', fontSize: '12px', margin: '14px 0 10px',
            }, text: '— oder einem Raum beitreten —',
          }),
          codeInput,
          UI.el('div', { style: { height: '10px' } }),
          UI.btn('Beitreten', function () { go('join'); }, 'wide'),
        ]);

        var weiter2 = false;   // Wechsel in den Warteraum, kein Abbruch
        var m2 = UI.modal({
          parent: host.root,
          title: 'Online spielen',
          body: b2,
          onClose: function () { if (!weiter2) ende(null); },
        });

        function go(what) {
          var name = (nameInput.value || '').trim() || 'Spieler';
          SG.storage.set('playerName', name);
          if (what === 'join') {
            var code = (codeInput.value || '').trim().toUpperCase();
            if (code.length < 4) { UI.toast('Bitte den Raum-Code eingeben.', 'bad'); return; }
          }
          weiter2 = true;
          m2.close();
          waitRoom(what, name, codeInput.value);
        }
      }

      /* Warteraum, bis genug Spieler da sind */
      function waitRoom(what, name, code) {
        var room = N.room({ game: o.game || host.id, seats: o.seats || 2 });
        var gestartet = false;
        var listEl = UI.el('div');
        var codeEl = UI.el('div.room-code', { text: '……' });
        var statusEl = UI.el('div.small.muted.center', { text: 'Verbinde…' });
        var startBtn = UI.btn('Spiel starten', function () {
          if (gestartet) return;
          gestartet = true;
          room.start(o.meta || {});
        }, 'primary wide off');

        var body2 = UI.el('div', null, [
          UI.el('p.small.muted.center', { text: 'Raum-Code zum Weitergeben' }),
          codeEl,
          UI.el('div', { style: { height: '10px' } }),
          listEl,
          statusEl,
          UI.el('div', { style: { height: '12px' } }),
          o.seats > 2 || (o.seats && o.seats > 2) ? startBtn : null,
        ]);

        var closedByUs = false;
        var m3 = UI.modal({
          parent: host.root,
          title: 'Warteraum',
          body: body2,
          actions: [{ label: 'Abbrechen', cls: 'ghost', onClick: function () { closedByUs = true; room.leave(); ende(null); } }],
          onClose: function () { if (!closedByUs) { room.leave(); ende(null); } },
        });

        function aufSpieler(ps) {
          UI.clear(listEl);
          ps.forEach(function (p) {
            listEl.appendChild(UI.el('div.player-row', null, [
              UI.el('div.dot' + (p.id === room.playerId ? '.me' : (p.connected ? '.on' : ''))),
              UI.el('div', { text: p.name + (p.id === room.playerId ? ' (du)' : '') }),
              UI.el('div.spacer'),
              UI.el('div.small.muted', { text: 'Platz ' + (p.seat + 1) }),
            ]));
          });
          for (var i = ps.length; i < room.seats; i++) {
            listEl.appendChild(UI.el('div.player-row', { style: { opacity: '.45' } }, [
              UI.el('div.dot'),
              UI.el('div', { text: 'wartet auf Mitspieler…' }),
            ]));
          }
          var full = ps.length >= room.seats;
          startBtn.classList.toggle('off', !(room.isHost && ps.length >= 2));
          statusEl.textContent = full
            ? 'Alle da!' + (room.isHost ? ' Du kannst starten.' : ' Warte auf den Host…')
            : (ps.length + ' von ' + room.seats + ' Plätzen belegt');
          /* Nur einmal starten. Das Ereignis "players" kommt bei jeder
             Antwort des Relais - ohne diese Sperre schickte der Host
             dauerhaft Startbefehle und flutete damit die Verbindung. */
          if (full && room.isHost && o.autoStart !== false && !gestartet) {
            gestartet = true;
            room.start(o.meta || {});
          }
        }

        function aufStatus(s, msg) {
          if (s === 'error') statusEl.textContent = 'Fehler: ' + (msg || 'unbekannt');
          else if (s === 'reconnecting') statusEl.textContent = 'Verbindung wackelt… (' + (msg || '') + ')';
        }

        function aufStart() {
          gestartet = true;
          closedByUs = true;
          m3.close();
          /* Die Warteraum-Anzeigen haengen jetzt an entfernten Elementen,
             und die Startsperre oben gilt nur fuer diesen Dialog. Ab hier
             gehoert der Raum dem Spiel, nicht mehr der Lobby. */
          room.off('players', aufSpieler);
          room.off('status', aufStatus);
          room.off('start', aufStart);
          ende({ mode: 'online', room: room });
        }

        room.on('players', aufSpieler);
        room.on('status', aufStatus);
        room.on('start', aufStart);

        var p = what === 'create' ? room.create(name, o.meta) : room.join(code, name);
        p.then(function () {
          codeEl.textContent = room.code;
        }, function (e) {
          statusEl.textContent = 'Fehler: ' + room.friendly(e);
          codeEl.textContent = '—';
        });
      }
    });
  };

  /* Statusanzeige oben in der Buehne */
  N.pill = function (stage, room) {
    var el = UI.el('div.net-pill', { text: '' });
    stage.appendChild(el);
    function sync(s, msg) {
      var t = {
        connecting: 'verbinde…',
        waiting: 'warte auf Mitspieler…',
        playing: 'online · ' + (room.code || ''),
        reconnecting: 'Verbindung wackelt…',
        error: 'Fehler: ' + (msg || ''),
        closed: 'Raum geschlossen',
        offline: '',
      }[s] || s;
      el.textContent = t;
      el.className = 'net-pill' + (s === 'error' || s === 'reconnecting' || s === 'closed' ? ' bad'
        : (s === 'playing' ? ' good' : ''));
      el.style.display = t ? '' : 'none';
    }
    room.on('status', sync);
    sync(room.status);
    return { el: el, destroy: function () { UI.remove(el); } };
  };
})(SG);
