/* ------------------------------------------------------------------
   Wörtle - deutsches Wortraten

   Fuenf oder sechs Buchstaben, taeglicher Modus (fuer alle gleich) und
   unbegrenzter Modus. Die Tastatur faerbt sich mit, es gibt eine
   Statistik mit Serie und Verteilung.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var G = SG.gfx;
  var UI = SG.ui;

  var ROWS = 6;

  /* Bewertung: 2 = richtig, 1 = enthalten, 0 = nicht enthalten.
     Auf Modulebene, damit tools/test.mjs sie ohne DOM pruefen kann. */
  function score(guess, target) {
    var res = new Array(guess.length).fill(0);
    var rest = {};
    var i;
    for (i = 0; i < target.length; i++) {
      if (guess[i] === target[i]) res[i] = 2;
      else rest[target[i]] = (rest[target[i]] || 0) + 1;
    }
    for (i = 0; i < guess.length; i++) {
      if (res[i] === 2) continue;
      var c = guess[i];
      if (rest[c] > 0) { res[i] = 1; rest[c]--; }
    }
    return res;
  }
  SG.rules.woertle = { score: score };

  var KEYS = [
    'QWERTZUIOPÜ',
    'ASDFGHJKLÖÄ',
    '↵YXCVBNM⌫',
  ];

  function mount(host) {
    var store = host.store;
    var len = store.get('len', 5);
    var daily = store.get('daily', true);
    var freeInput = store.get('free', false);

    var st = {
      len: len,
      target: '',
      guesses: [],       // Array aus Strings
      states: [],        // Array aus Arrays mit 0/1/2
      cur: '',
      row: 0,
      done: false, won: false,
      shakeRow: -1,
      revealRow: -1, revealT: 0,
      msg: '', msgT: 0,
    };

    var sheet = host.sheet();
    var boardEl = UI.el('div', {
      style: {
        display: 'grid', gap: '6px', justifyContent: 'center',
        margin: '6px auto 14px', width: 'max-content',
      },
    });
    var kbdEl = UI.el('div.kbd');
    var msgEl = UI.el('div', {
      style: {
        textAlign: 'center', minHeight: '22px', fontSize: '14px',
        fontWeight: '650', color: 'var(--gold)', marginBottom: '6px',
      },
    });

    var wrap = UI.el('div', {
      style: { maxWidth: '520px', margin: '0 auto', display: 'flex', flexDirection: 'column', height: '100%' },
    }, [boardEl, msgEl, UI.el('div', { style: { flex: '1 0 6px' } }), kbdEl]);
    sheet.appendChild(wrap);

    var sMode = host.stat('Modus', '');
    var sStreak = host.stat('Serie', '0', 'gold');
    var sWins = host.stat('Gewonnen', '0');

    host.tool('📊', function () { showStats(); });
    host.menuTool([
      {
        icon: '↔', label: 'Wortlänge wechseln',
        desc: 'Aktuell: ' + st.len + ' Buchstaben',
        onClick: function () {
          st.len = st.len === 5 ? 6 : 5;
          store.set('len', st.len);
          newGame();
        },
      },
      {
        icon: '📅', label: 'Täglich / Unbegrenzt',
        desc: daily ? 'Aktuell: täglich' : 'Aktuell: unbegrenzt',
        onClick: function () {
          daily = !daily;
          store.set('daily', daily);
          newGame();
        },
      },
      {
        icon: '✓', label: 'Freie Eingabe',
        desc: freeInput ? 'Aktuell: an' : 'Aktuell: aus',
        onClick: function () {
          freeInput = !freeInput;
          store.set('free', freeInput);
          host.toast(freeInput
            ? 'Jedes Wort mit passender Länge wird angenommen.'
            : 'Nur Wörter aus der Liste werden angenommen.');
        },
      },
      { icon: '?', label: 'Anleitung', onClick: function () { help(true); } },
    ]);

    /* ---------------------------------------------------------- Zustand */

    function words() { return st.len === 5 ? SG.words.loesung5 : SG.words.loesung6; }
    function allowed() { return st.len === 5 ? SG.words.erlaubt5 : SG.words.erlaubt6; }
    function modeKey() { return st.len + (daily ? 'd' : 'u'); }

    function statsKey() { return 'stats' + st.len; }
    function getStats() {
      return store.get(statsKey(), {
        played: 0, won: 0, streak: 0, best: 0, dist: [0, 0, 0, 0, 0, 0],
      });
    }
    function setStats(s) { store.set(statsKey(), s); }

    function pickTarget() {
      var list = words();
      if (daily) {
        var day = U.dayIndex();
        var r = U.rng((day * 2654435761 + st.len * 97) >>> 0);
        // Ein paar Durchlaeufe, damit aufeinanderfolgende Tage stark streuen
        r(); r(); r();
        return list[Math.floor(r() * list.length)];
      }
      return list[U.irand(0, list.length - 1)];
    }

    function savedKey() { return 'run' + modeKey() + (daily ? ':' + U.dayIndex() : ''); }

    function newGame(keepSaved) {
      st.target = pickTarget();
      st.guesses = [];
      st.states = [];
      st.cur = '';
      st.row = 0;
      st.done = false; st.won = false;
      st.revealRow = -1;
      msgEl.textContent = '';

      if (daily && keepSaved !== false) {
        var saved = store.get(savedKey(), null);
        if (saved && saved.target === st.target) {
          st.guesses = saved.guesses;
          st.states = saved.guesses.map(function (g) { return score(g, st.target); });
          st.row = st.guesses.length;
          if (st.guesses.length && st.guesses[st.guesses.length - 1] === st.target) {
            st.done = true; st.won = true;
          } else if (st.guesses.length >= ROWS) {
            st.done = true;
          }
        }
      }
      buildBoard();
      buildKeyboard();
      syncBar();
      render();
    }

    function saveRun() {
      if (!daily) return;
      store.set(savedKey(), { target: st.target, guesses: st.guesses });
    }

    function syncBar() {
      var s = getStats();
      sMode.set(st.len + ' · ' + (daily ? 'täglich' : 'frei'));
      sStreak.set(U.num(s.streak));
      sWins.set(U.num(s.won) + '/' + U.num(s.played));
    }

    /* ---------------------------------------------------------- Eingabe */

    function type(ch) {
      if (st.done) return;
      if (st.cur.length >= st.len) return;
      st.cur += ch;
      host.sfx('tick');
      render();
    }

    function backspace() {
      if (st.done || !st.cur.length) return;
      st.cur = st.cur.slice(0, -1);
      host.sfx('click');
      render();
    }

    function submit() {
      if (st.done) return;
      if (st.cur.length < st.len) { flash('Zu kurz'); shake(); return; }
      if (!freeInput && !allowed()[st.cur]) {
        flash('Nicht in der Wortliste');
        shake();
        host.sfx('error');
        return;
      }
      var s = score(st.cur, st.target);
      st.guesses.push(st.cur);
      st.states.push(s);
      st.revealRow = st.row;
      st.revealT = 0;
      st.row++;
      st.cur = '';
      host.sfx('place');
      saveRun();
      render();

      var correct = st.guesses[st.guesses.length - 1] === st.target;
      host.after(function () {
        if (correct) finish(true);
        else if (st.row >= ROWS) finish(false);
        else buildKeyboard();
      }, st.len * 260 + 260);
    }

    function finish(won) {
      st.done = true;
      st.won = won;
      buildKeyboard();
      var s = getStats();
      s.played++;
      if (won) {
        s.won++;
        s.streak++;
        s.best = Math.max(s.best, s.streak);
        s.dist[st.row - 1]++;
      } else {
        s.streak = 0;
      }
      setStats(s);
      syncBar();
      host.sfx(won ? 'win' : 'lose');

      var extra = UI.el('div', { style: { marginBottom: '12px' } }, [
        UI.el('div', {
          style: {
            fontFamily: 'var(--mono)', fontSize: '15px', lineHeight: '1.35',
            letterSpacing: '.08em', marginBottom: '10px',
          },
          text: shareText(),
        }),
        UI.btn('Ergebnis kopieren', function () {
          var t = 'Wörtle ' + (daily ? U.dateShort(new Date()) : '') + ' ' +
            (won ? st.row : 'X') + '/' + ROWS + '\n' + shareText();
          copy(t);
        }, 'sm ghost wide'),
      ]);

      host.gameOver({
        won: won,
        title: won ? (['Wahnsinn!', 'Stark!', 'Sehr gut!', 'Gut!', 'Geschafft!', 'Puh!'][st.row - 1] || 'Geschafft!')
          : 'Leider nicht',
        sub: won ? 'In ' + st.row + ' ' + U.plural(st.row, 'Versuch', 'Versuchen')
          : 'Das Wort war ' + st.target,
        extra: extra,
        againLabel: daily ? 'Freies Spiel' : 'Nächstes Wort',
        onAgain: function () {
          if (daily) { daily = false; store.set('daily', false); }
          newGame(false);
        },
        submit: false,
      });
    }

    function shareText() {
      var out = [];
      for (var r = 0; r < st.states.length; r++) {
        var line = '';
        for (var c = 0; c < st.states[r].length; c++) {
          line += ['⬛', '🟨', '🟩'][st.states[r][c]];
        }
        out.push(line);
      }
      return out.join('\n');
    }

    function copy(text) {
      var ok = false;
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch (e) { /* egal */ }
      if (!ok && navigator.clipboard) {
        navigator.clipboard.writeText(text).then(function () {
          UI.toast('Kopiert.', 'good');
        }, function () { UI.toast('Kopieren nicht möglich.', 'bad'); });
      } else UI.toast(ok ? 'Kopiert.' : 'Kopieren nicht möglich.', ok ? 'good' : 'bad');
    }

    function flash(t) {
      msgEl.textContent = t;
      clearTimeout(flash._t);
      flash._t = host.after(function () { msgEl.textContent = ''; }, 1600);
    }

    function shake() {
      st.shakeRow = st.row;
      var row = boardEl.children[st.row];
      if (!row) return;
      row.style.animation = 'none';
      // Neuzeichnen erzwingen
      void row.offsetWidth;
      row.style.animation = 'wo-shake .32s';
      host.after(function () { row.style.animation = ''; }, 340);
    }

    /* ---------------------------------------------------------- Aufbau */

    var tiles = [];

    function buildBoard() {
      UI.clear(boardEl);
      tiles = [];
      boardEl.style.gridTemplateColumns = 'repeat(' + st.len + ', 1fr)';
      boardEl.style.display = 'block';
      var size = st.len === 5 ? 58 : 52;
      for (var r = 0; r < ROWS; r++) {
        var row = UI.el('div', {
          style: { display: 'flex', gap: '6px', marginBottom: '6px', justifyContent: 'center' },
        });
        var rowTiles = [];
        for (var c = 0; c < st.len; c++) {
          var t = UI.el('div', {
            style: {
              width: size + 'px', height: size + 'px',
              display: 'grid', placeItems: 'center',
              fontSize: Math.round(size * 0.48) + 'px', fontWeight: '750',
              border: '2px solid var(--line)', borderRadius: '6px',
              color: 'var(--text)', background: 'transparent',
              transition: 'transform .18s ease, background .2s ease, border-color .2s ease',
            },
          });
          row.appendChild(t);
          rowTiles.push(t);
        }
        boardEl.appendChild(row);
        tiles.push(rowTiles);
      }
    }

    var keyEls = {};

    function buildKeyboard() {
      UI.clear(kbdEl);
      keyEls = {};
      var letterState = {};
      for (var r = 0; r < st.states.length; r++) {
        for (var c = 0; c < st.states[r].length; c++) {
          var ch = st.guesses[r][c];
          var v = st.states[r][c];
          if ((letterState[ch] || 0) < v || letterState[ch] === undefined) {
            letterState[ch] = Math.max(letterState[ch] === undefined ? -1 : letterState[ch], v);
          }
        }
      }

      KEYS.forEach(function (rowStr) {
        var row = UI.el('div.kbd-row');
        for (var i = 0; i < rowStr.length; i++) {
          var ch = rowStr[i];
          var wide = ch === '↵' || ch === '⌫';
          var cls = 'key' + (wide ? ' wide' : '');
          var s = letterState[ch];
          if (s === 2) cls += ' g';
          else if (s === 1) cls += ' y';
          else if (s === 0) cls += ' b';
          var el = UI.el('button.' + cls.split(' ').join('.'), {
            text: ch === '↵' ? 'Raten' : ch,
            on: {
              click: (function (c2) {
                return function () {
                  if (c2 === '↵') submit();
                  else if (c2 === '⌫') backspace();
                  else type(c2);
                };
              })(ch),
            },
          });
          keyEls[ch] = el;
          row.appendChild(el);
        }
        kbdEl.appendChild(row);
      });
    }

    /* ---------------------------------------------------------- Anzeige */

    function render() {
      for (var r = 0; r < ROWS; r++) {
        for (var c = 0; c < st.len; c++) {
          var t = tiles[r] && tiles[r][c];
          if (!t) continue;
          var ch = '', state = -1;
          if (r < st.guesses.length) {
            ch = st.guesses[r][c];
            state = st.states[r][c];
          } else if (r === st.row) {
            ch = st.cur[c] || '';
          }
          if (t.textContent !== ch) {
            t.textContent = ch;
            if (ch) {
              t.style.transform = 'scale(1.08)';
              host.after((function (el) {
                return function () { el.style.transform = ''; };
              })(t), 90);
            }
          }
          var bg = 'transparent', border = 'var(--line)', col = 'var(--text)';
          if (state === 2) { bg = '#2c8a55'; border = '#2c8a55'; }
          else if (state === 1) { bg = '#a08420'; border = '#a08420'; }
          else if (state === 0) { bg = '#2a3348'; border = '#2a3348'; col = '#8794b1'; }
          else if (ch) border = 'var(--dim)';
          t.style.background = bg;
          t.style.borderColor = border;
          t.style.color = col;
        }
      }
    }

    function showStats() {
      var s = getStats();
      var max = Math.max.apply(null, s.dist.concat([1]));
      var rows = s.dist.map(function (n, i) {
        return UI.el('div', {
          style: { display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0' },
        }, [
          UI.el('div', { text: String(i + 1), style: { width: '14px', color: 'var(--muted)', fontSize: '13px' } }),
          UI.el('div', {
            style: {
              background: n ? '#2c8a55' : 'var(--panel-3)', height: '20px', borderRadius: '4px',
              width: Math.max(24, (n / max) * 220) + 'px',
              display: 'grid', placeItems: 'center', color: '#fff',
              fontSize: '12px', fontWeight: '700', paddingRight: '6px',
            },
            text: String(n),
          }),
        ]);
      });

      host.modal({
        title: 'Statistik · ' + st.len + ' Buchstaben',
        body: [
          UI.el('div', { style: { display: 'flex', gap: '18px', justifyContent: 'center', marginBottom: '14px' } }, [
            stat(s.played, 'Spiele'),
            stat(s.played ? Math.round(s.won / s.played * 100) + '%' : '—', 'Gewonnen'),
            stat(s.streak, 'Serie'),
            stat(s.best, 'Beste Serie'),
          ]),
          UI.el('div.small.muted', { text: 'Versuche bis zur Lösung', style: { marginBottom: '6px' } }),
        ].concat(rows),
      });

      function stat(v, k) {
        return UI.el('div', { style: { textAlign: 'center' } }, [
          UI.el('div', { text: String(v), style: { fontSize: '22px', fontWeight: '750' } }),
          UI.el('div', { text: k, style: { fontSize: '11px', color: 'var(--muted)' } }),
        ]);
      }
    }

    /* ---------------------------------------------------------- Tastatur */

    var keys = host.keys({
      prevent: false,
      onDown: function (k, e) {
        if (k === 'enter') submit();
        else if (k === 'backspace') backspace();
        else if (/^[a-zäöü]$/.test(k)) type(k.toUpperCase());
      },
    });

    function help(force) {
      SG.tutorial.show({
        id: 'woertle', force: force, parent: host.root, title: 'Wörtle',
        pages: [{
          kicker: 'Wörtle', title: 'Sechs Versuche',
          art: function (c, w, h) {
            var size = Math.min(38, w / 8);
            var word = 'WÖRTLE';
            var cols = [2, 0, 1, 0, 2, 0];
            var x0 = w / 2 - (word.length * (size + 5)) / 2;
            for (var i = 0; i < word.length; i++) {
              var x = x0 + i * (size + 5), y = h / 2 - size / 2;
              var bg = ['#2a3348', '#a08420', '#2c8a55'][cols[i]];
              G.fillRound(c, x, y, size, size, 5, bg);
              G.text(c, word[i], x + size / 2, y + size / 2 + 1, {
                size: size * 0.5, weight: 750, color: '#fff', align: 'center', baseline: 'middle',
              });
            }
          },
          body: [
            { ic: '🟩', text: '<b>Grün</b>: Buchstabe steht an der richtigen Stelle.' },
            { ic: '🟨', text: '<b>Gelb</b>: Buchstabe kommt vor, aber woanders.' },
            { ic: '⬛', text: '<b>Grau</b>: Buchstabe kommt nicht vor.' },
            { ic: '📅', text: 'Im <b>täglichen Modus</b> haben alle dasselbe Wort — einmal pro Tag.' },
            { ic: '↔', text: 'Im Menü lässt sich auf <b>sechs Buchstaben</b> umstellen.' },
          ],
        }],
      });
    }

    // Kleine Wackel-Animation nur fuer dieses Spiel
    if (!document.getElementById('wo-style')) {
      var sEl = document.createElement('style');
      sEl.id = 'wo-style';
      sEl.textContent = '@keyframes wo-shake{0%,100%{transform:translateX(0)}' +
        '20%{transform:translateX(-7px)}40%{transform:translateX(7px)}' +
        '60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}';
      document.head.appendChild(sEl);
    }

    newGame();
    help(false);

    return {
      state: st,
      destroy: function () { keys.destroy(); clearTimeout(flash._t); },
      selftest: function () {
        // Bewertung muss doppelte Buchstaben korrekt behandeln
        var s1 = score('ESSEN', 'NESTE');
        if (s1.length !== 5) throw new Error('Bewertung hat falsche Länge');
        var s2 = score('AAAAA', 'ABEND');
        if (s2[0] !== 2 || s2[1] !== 0 || s2[2] !== 0) {
          throw new Error('Doppelte Buchstaben falsch bewertet: ' + s2.join(''));
        }
        var s3 = score('ABEND', 'ABEND');
        for (var i = 0; i < 5; i++) if (s3[i] !== 2) throw new Error('Volltreffer nicht erkannt');

        // Wortlisten muessen gefuellt und sauber sein
        var st5 = SG.words.stats();
        if (st5.loesung5 < 200) throw new Error('Zu wenige 5er-Lösungswörter');
        if (st5.loesung6 < 150) throw new Error('Zu wenige 6er-Lösungswörter');
        SG.words.loesung5.forEach(function (w) {
          if (w.length !== 5) throw new Error('Falsche Länge: ' + w);
          if (!SG.words.erlaubt5[w]) throw new Error('Lösungswort nicht erlaubt: ' + w);
        });

        // Eine Partie durchspielen
        daily = false;
        newGame(false);
        var target = st.target;
        st.cur = target;
        freeInput = true;
        submit();
        if (st.guesses[0] !== target) throw new Error('Rateversuch nicht übernommen');
        if (st.states[0].join('') !== '22222'.slice(0, st.len)) {
          throw new Error('Treffer nicht als grün gewertet');
        }
        render();
      },
    };
  }

  SG.register({
    id: 'woertle',
    name: 'Wörtle',
    category: 'karten',
    desc: 'Deutsches Wortraten, täglich',
    tags: ['wordle', 'woerter', 'raten', 'sprache', 'buchstaben'],
    scoreLabel: function (bests, stats) { return null; },
    preview: function (c, w, h) {
      c.fillStyle = '#0b0e15';
      c.fillRect(0, 0, w, h);
      var cols = 5, rows = 4;
      var size = Math.min((w * 0.72) / cols, (h * 0.8) / rows) - 4;
      var gap = size * 0.12;
      var x0 = (w - (size * cols + gap * (cols - 1))) / 2;
      var y0 = (h - (size * rows + gap * (rows - 1))) / 2;
      var board = [
        ['R', 0], ['A', 0], ['T', 1], ['E', 0], ['N', 2],
        ['L', 0], ['I', 0], ['E', 2], ['B', 0], ['E', 1],
        ['T', 2], ['E', 2], ['I', 0], ['C', 0], ['H', 0],
        ['', -1], ['', -1], ['', -1], ['', -1], ['', -1],
      ];
      for (var i = 0; i < cols * rows; i++) {
        var x = x0 + (i % cols) * (size + gap), y = y0 + Math.floor(i / cols) * (size + gap);
        var b = board[i];
        var bg = b[1] === 2 ? '#2c8a55' : b[1] === 1 ? '#a08420' : b[1] === 0 ? '#2a3348' : 'transparent';
        if (bg === 'transparent') {
          G.strokeRound(c, x + 1, y + 1, size - 2, size - 2, 4, '#2f3a55', 2);
        } else {
          G.fillRound(c, x, y, size, size, 4, bg);
        }
        if (b[0]) {
          G.text(c, b[0], x + size / 2, y + size / 2 + 1, {
            size: size * 0.5, weight: 750, color: '#fff', align: 'center', baseline: 'middle',
          });
        }
      }
    },
    mount: mount,
  });
})(SG);
