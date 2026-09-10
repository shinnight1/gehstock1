/* ------------------------------------------------------------------
   DOM-Bausteine: Elemente, Dialoge, Toasts, Schubladen, Reiter.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var UI = SG.ui = {};

  /* ---------------------------------------------------------- Elemente */

  /* el('div.card', {text:'Hallo'}, [kind1, kind2]) */
  UI.el = function (tag, props, kids) {
    var cls = null, id = null;
    var m = String(tag).match(/^([a-z0-9]+)?((?:[.#][^.#]+)*)$/i);
    var name = 'div';
    if (m) {
      name = m[1] || 'div';
      if (m[2]) {
        m[2].split(/(?=[.#])/).forEach(function (p) {
          if (p[0] === '.') cls = (cls ? cls + ' ' : '') + p.slice(1);
          else if (p[0] === '#') id = p.slice(1);
        });
      }
    } else name = tag;

    var e = document.createElement(name);
    if (cls) e.className = cls;
    if (id) e.id = id;

    if (props) {
      for (var k in props) {
        if (!Object.prototype.hasOwnProperty.call(props, k)) continue;
        var v = props[k];
        if (v === undefined || v === null) continue;
        if (k === 'text') e.textContent = v;
        else if (k === 'html') e.innerHTML = v;
        else if (k === 'className') e.className = (cls ? cls + ' ' : '') + v;
        else if (k === 'style' && typeof v === 'object') { for (var s in v) e.style[s] = v[s]; }
        else if (k === 'on' && typeof v === 'object') {
          for (var ev in v) (function (name2, fn) {
            e.addEventListener(name2, fn);
          })(ev, v[ev]);
        }
        else if (k === 'dataset') { for (var d in v) e.dataset[d] = v[d]; }
        else if (k === 'disabled') { if (v) e.setAttribute('disabled', ''); }
        else if (k in e && k !== 'list') { try { e[k] = v; } catch (er) { e.setAttribute(k, v); } }
        else e.setAttribute(k, v);
      }
    }

    if (kids) UI.add(e, kids);
    return e;
  };

  UI.add = function (parent, kids) {
    if (kids === null || kids === undefined || kids === false) return parent;
    if (Array.isArray(kids)) {
      for (var i = 0; i < kids.length; i++) UI.add(parent, kids[i]);
      return parent;
    }
    if (typeof kids === 'string' || typeof kids === 'number') {
      parent.appendChild(document.createTextNode(String(kids)));
      return parent;
    }
    if (kids.nodeType) parent.appendChild(kids);
    return parent;
  };

  UI.clear = function (el) {
    while (el && el.firstChild) el.removeChild(el.firstChild);
    return el;
  };

  UI.remove = function (el) { if (el && el.parentNode) el.parentNode.removeChild(el); };

  /* Knopf mit Standardklassen */
  UI.btn = function (label, onClick, cls) {
    return UI.el('button.btn' + (cls ? '.' + cls.split(' ').join('.') : ''), {
      html: label,
      on: { click: function (e) { SG.audio.play('click'); if (onClick) onClick(e); } },
    });
  };

  UI.icoBtn = function (label, onClick, cls) {
    return UI.el('button.' + (cls || 'tool'), {
      html: label,
      on: { click: function (e) { SG.audio.play('click'); if (onClick) onClick(e); } },
    });
  };

  /* Beschriftete Statistik in der Spielleiste */
  UI.stat = function (key, value, cls) {
    var v = UI.el('div.v', { text: value });
    var box = UI.el('div.stat' + (cls ? '.' + cls : ''), null, [
      UI.el('div.k', { text: key }), v,
    ]);
    box.set = function (nv) { if (v.textContent !== String(nv)) v.textContent = nv; };
    return box;
  };

  /* ---------------------------------------------------------- Toasts */

  var toastHost = null;
  UI.toast = function (msg, kind, ms) {
    if (!toastHost) {
      toastHost = UI.el('div.toasts');
      document.body.appendChild(toastHost);
    }
    var t = UI.el('div.toast' + (kind ? '.' + kind : ''), { text: msg });
    toastHost.appendChild(t);
    setTimeout(function () {
      t.style.transition = 'opacity .25s ease, transform .25s ease';
      t.style.opacity = '0';
      t.style.transform = 'translateY(8px)';
      setTimeout(function () { UI.remove(t); }, 260);
    }, ms || 2100);
    return t;
  };

  /* ---------------------------------------------------------- Dialoge */

  var openModals = [];

  UI.modal = function (o) {
    o = o || {};
    var back = UI.el('div.modal-back');
    var box = UI.el('div.modal' + (o.wide ? '.wide' : ''));

    var head = null;
    if (o.title !== false) {
      head = UI.el('div.modal-head', null, [
        UI.el('h3', { text: o.title || '' }),
        UI.el('div.spacer'),
        o.closable === false ? null : UI.el('button.x-btn', {
          html: '✕', 'aria-label': 'Schliessen',
          on: { click: function () { api.close(); } },
        }),
      ]);
      box.appendChild(head);
    }

    var body = UI.el('div.modal-body');
    if (o.body) UI.add(body, o.body);
    if (o.text) body.appendChild(UI.el('p', { text: o.text }));
    box.appendChild(body);

    /* Wurde der Dialog durch einen seiner eigenen Knoepfe geschlossen?
       onClose kann das sonst nicht unterscheiden und meldet faelschlich
       "abgebrochen" - und zwar bevor der Knopf sein eigenes Ergebnis
       liefern kann. */
    var durchKnopf = false;

    var foot = null;
    if (o.actions && o.actions.length) {
      foot = UI.el('div.modal-foot');
      o.actions.forEach(function (a) {
        foot.appendChild(UI.btn(a.label, function () {
          if (a.keepOpen) { if (a.onClick) a.onClick(api); }
          else { durchKnopf = true; api.close(); if (a.onClick) a.onClick(api); }
        }, a.cls));
      });
      box.appendChild(foot);
    }

    back.appendChild(box);
    if (o.closable !== false) {
      back.addEventListener('pointerdown', function (e) {
        if (e.target === back) api.close();
      });
    }

    (o.parent || document.getElementById('app') || document.body).appendChild(back);
    openModals.push(back);

    var api = {
      el: back, box: box, body: body, foot: foot,
      close: function () {
        U.remove(openModals, back);
        UI.remove(back);
        if (o.onClose) o.onClose(durchKnopf);
      },
      setTitle: function (t) { if (head) head.firstChild.textContent = t; },
    };
    return api;
  };

  UI.closeTopModal = function () {
    if (!openModals.length) return false;
    var m = openModals[openModals.length - 1];
    var evt = m.__api;
    UI.remove(m);
    openModals.pop();
    if (evt && evt.onClose) evt.onClose();
    return true;
  };

  UI.alert = function (title, text, okLabel) {
    return new Promise(function (res) {
      UI.modal({
        title: title,
        body: typeof text === 'string' ? UI.el('p', { text: text }) : text,
        actions: [{ label: okLabel || 'Alles klar', cls: 'primary', onClick: function () { res(true); } }],
        onClose: function () { res(true); },
      });
    });
  };

  UI.confirm = function (title, text, okLabel, danger) {
    return new Promise(function (res) {
      var done = false;
      var m = UI.modal({
        title: title,
        body: typeof text === 'string' ? UI.el('p', { text: text }) : text,
        actions: [
          { label: 'Abbrechen', cls: 'ghost', onClick: function () { done = true; res(false); } },
          {
            label: okLabel || 'Ja', cls: danger ? 'bad' : 'primary',
            onClick: function () { done = true; res(true); },
          },
        ],
        // Der Knopf setzt "done" erst nach dem Schliessen - ohne die
        // Abfrage auf durchKnopf gewaenne hier immer das "abgebrochen".
        onClose: function (durchKnopf) { if (!done && !durchKnopf) res(false); },
      });
      return m;
    });
  };

  UI.prompt = function (title, label, value, o) {
    o = o || {};
    return new Promise(function (res) {
      var input = UI.el('input', {
        type: 'text', value: value || '',
        className: o.className || 'code-input',
        placeholder: o.placeholder || '',
        maxLength: o.maxLength || 200,
      });
      var done = false;
      UI.modal({
        title: title,
        body: [label ? UI.el('p.small.muted', { text: label }) : null, input],
        actions: [
          { label: 'Abbrechen', cls: 'ghost', onClick: function () { done = true; res(null); } },
          {
            label: o.ok || 'Ok', cls: 'primary',
            onClick: function () { done = true; res(input.value); },
          },
        ],
        onClose: function () { if (!done) res(null); },
      });
      setTimeout(function () { input.focus(); }, 60);
    });
  };

  /* ---------------------------------------------------------- Schublade */

  UI.drawer = function (o) {
    o = o || {};
    var back = UI.el('div.drawer-back');
    var box = UI.el('div.drawer' + (o.side === 'left' ? '.left' : ''));

    var head = UI.el('div.drawer-head', null, [
      UI.el('h3', { text: o.title || '' }),
      UI.el('button.x-btn', {
        html: '✕', 'aria-label': 'Schliessen',
        on: { click: function () { api.close(); } },
      }),
    ]);
    var body = UI.el('div.drawer-body');
    box.appendChild(head);
    box.appendChild(body);

    var foot = null;
    if (o.actions && o.actions.length) {
      foot = UI.el('div.drawer-foot');
      o.actions.forEach(function (a) {
        foot.appendChild(UI.btn(a.label, function () {
          if (!a.keepOpen) api.close();
          if (a.onClick) a.onClick(api);
        }, a.cls));
      });
      box.appendChild(foot);
    }

    back.appendChild(box);
    back.addEventListener('pointerdown', function (e) { if (e.target === back) api.close(); });
    (o.parent || document.getElementById('app')).appendChild(back);

    var api = {
      el: back, body: body, foot: foot,
      setTitle: function (t) { head.firstChild.textContent = t; },
      close: function () {
        UI.remove(back);
        if (o.onClose) o.onClose();
      },
    };
    if (o.build) o.build(body, api);
    return api;
  };

  /* ---------------------------------------------------------- Reiter */

  UI.tabs = function (items, onChange, initial) {
    var wrap = UI.el('div.tabs');
    var cur = initial || items[0].id;
    var btns = {};
    items.forEach(function (it) {
      var b = UI.el('button', {
        text: it.label,
        on: {
          click: function () {
            if (cur === it.id) return;
            cur = it.id;
            sync();
            SG.audio.play('click');
            onChange(it.id);
          },
        },
      });
      btns[it.id] = b;
      wrap.appendChild(b);
    });
    function sync() {
      for (var k in btns) btns[k].classList.toggle('on', k === cur);
    }
    sync();
    wrap.select = function (id) { cur = id; sync(); onChange(id); };
    wrap.current = function () { return cur; };
    return wrap;
  };

  /* ---------------------------------------------------------- Einstellungszeile */

  UI.toggleRow = function (title, desc, get, set) {
    var tg = UI.el('div.toggle');
    function sync() { tg.classList.toggle('on', !!get()); }
    sync();
    var row = UI.el('div.set-row', {
      on: {
        click: function () {
          set(!get());
          sync();
          SG.audio.play('click');
        },
      },
    }, [
      UI.el('div.txt', null, [UI.el('b', { text: title }), UI.el('span', { text: desc || '' })]),
      tg,
    ]);
    row.sync = sync;
    return row;
  };

  UI.segRow = function (title, desc, options, get, set) {
    var seg = UI.el('div.seg');
    var btns = {};
    options.forEach(function (o) {
      var b = UI.el('button', {
        text: o.label,
        on: {
          click: function () { set(o.value); sync(); SG.audio.play('click'); },
        },
      });
      btns[String(o.value)] = b;
      seg.appendChild(b);
    });
    function sync() {
      var v = String(get());
      for (var k in btns) btns[k].classList.toggle('on', k === v);
    }
    sync();
    var row = UI.el('div.set-row', null, [
      UI.el('div.txt', null, [UI.el('b', { text: title }), UI.el('span', { text: desc || '' })]),
      seg,
    ]);
    row.sync = sync;
    return row;
  };

  /* ---------------------------------------------------------- Kleinteile */

  UI.bar = function (t, cls) {
    var fill = UI.el('i', { style: { width: U.clamp(t, 0, 1) * 100 + '%' } });
    var b = UI.el('div.bar' + (cls ? '.' + cls : ''), null, [fill]);
    b.set = function (v) { fill.style.width = U.clamp(v, 0, 1) * 100 + '%'; };
    return b;
  };

  UI.pips = function (n, max) {
    var w = UI.el('div.pips');
    for (var i = 0; i < max; i++) w.appendChild(UI.el('i' + (i < n ? '.on' : '')));
    return w;
  };

  UI.kv = function (pairs) {
    var dl = UI.el('dl.kv');
    pairs.forEach(function (p) {
      if (!p) return;
      dl.appendChild(UI.el('dt', { text: p[0] }));
      dl.appendChild(UI.el('dd' + (p[2] ? '.' + p[2] : ''), { text: p[1] }));
    });
    return dl;
  };

  UI.tags = function (list) {
    var w = UI.el('div.tagline');
    list.forEach(function (t) {
      if (!t) return;
      w.appendChild(UI.el('span.tag' + (t.cls ? '.' + t.cls : ''), { text: t.text || t }));
    });
    return w;
  };

  /* Auffrischknopf fuer die Kopfzeilen.

     Dreht sich, solange geholt wird, und meldet danach kurz zurueck.
     Ohne Rueckmeldung tippt man dreimal, weil man nicht sieht, ob
     etwas passiert ist. */
  UI.frischKnopf = function (nachher) {
    var b = UI.el('button.btn.sm.ghost.frisch', {
      html: '<span class="ico">↻</span>',
      'aria-label': 'Neu laden',
      on: {
        click: function () {
          if (b.classList.contains('dreht')) return;
          b.classList.add('dreht');
          SG.audio.play('click');
          SG.relais.auffrischen().then(function (ok) {
            b.classList.remove('dreht');
            if (nachher) nachher();
            UI.toast(ok ? 'Auf dem neuesten Stand.' : 'Keine Verbindung.',
              ok ? 'good' : 'bad', 1400);
          });
        },
      },
    });
    return b;
  };

  UI.empty = function (icon, title, sub) {
    return UI.el('div.empty', null, [
      UI.el('div.big', { text: icon || '∅' }),
      UI.el('div', { text: title }),
      sub ? UI.el('div.small', { text: sub, style: { marginTop: '6px', opacity: '.8' } }) : null,
    ]);
  };

  /* Kleines Liniendiagramm auf Canvas - fuer Tycoon-Statistiken */
  UI.chart = function (series, o) {
    o = o || {};

    /* Zwei Aufrufformen: entweder fertige Reihen [{ data, color }] oder
       einfach eine Liste von Zahlen. Die kurze Form ist die haeufigere -
       ein Kursverlauf hat nun einmal nur eine Linie. */
    if (Array.isArray(series) && (!series.length || typeof series[0] === 'number')) {
      series = [{ data: series, color: o.color, fill: o.fill, width: o.width }];
    }

    var cv = UI.el('canvas.chart');
    var draw = function () {
      var r = cv.getBoundingClientRect();
      var w = Math.max(80, r.width || 300), h = o.height || 110;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = w * dpr; cv.height = h * dpr;
      cv.style.height = h + 'px';
      var c = cv.getContext('2d');
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, w, h);

      var all = [];
      series.forEach(function (s) { all = all.concat(s.data); });
      if (!all.length) return;
      var mn = Math.min.apply(null, all), mx = Math.max.apply(null, all);
      if (o.zero) mn = Math.min(0, mn);
      if (mx === mn) { mx = mn + 1; }
      var pad = 6;
      var gy = function (v) { return h - pad - (v - mn) / (mx - mn) * (h - pad * 2); };

      // Nulllinie
      if (mn < 0 && mx > 0) {
        c.strokeStyle = 'rgba(255,255,255,.14)';
        c.lineWidth = 1;
        c.beginPath(); c.moveTo(0, gy(0)); c.lineTo(w, gy(0)); c.stroke();
      }

      series.forEach(function (s) {
        var n = s.data.length;
        if (n < 2) return;
        var gx = function (i) { return pad + (i / (n - 1)) * (w - pad * 2); };
        if (s.fill) {
          c.beginPath();
          c.moveTo(gx(0), gy(s.data[0]));
          for (var i = 1; i < n; i++) c.lineTo(gx(i), gy(s.data[i]));
          c.lineTo(gx(n - 1), h - pad); c.lineTo(gx(0), h - pad);
          c.closePath();
          var g = c.createLinearGradient(0, 0, 0, h);
          g.addColorStop(0, s.fill); g.addColorStop(1, 'rgba(0,0,0,0)');
          c.fillStyle = g; c.fill();
        }
        c.beginPath();
        c.moveTo(gx(0), gy(s.data[0]));
        for (var j = 1; j < n; j++) c.lineTo(gx(j), gy(s.data[j]));
        c.strokeStyle = s.color || '#f0b429';
        c.lineWidth = s.width || 2;
        c.lineJoin = 'round';
        c.stroke();
      });
    };
    cv.redraw = draw;
    setTimeout(draw, 0);
    return cv;
  };
})(SG);
