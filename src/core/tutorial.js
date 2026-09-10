/* ------------------------------------------------------------------
   Anleitung.

   Mehrseitige Erklaerung mit gezeichneter Illustration. Sie erscheint
   vor jedem Tycoon-Start automatisch (beim ersten Mal), laesst sich
   aber jederzeit ueberspringen und spaeter ueber den Anleitung-Knopf
   erneut oeffnen.
   ------------------------------------------------------------------ */

(function (SG) {
  var UI = SG.ui;
  var store = SG.storage;

  var T = SG.tutorial = {};

  T.seen = function (id) { return !!store.get('tut:' + id, false); };
  T.markSeen = function (id) { store.set('tut:' + id, true); };
  T.forget = function (id) { store.del('tut:' + id); };
  T.forgetAll = function () {
    store.keys().forEach(function (k) { if (k.indexOf('tut:') === 0) store.del(k); });
  };

  /* o = { id, title, pages:[{kicker,title,body,art}], force, onDone, parent } */
  T.show = function (o) {
    return new Promise(function (resolve) {
      if (!o.force && T.seen(o.id)) { if (o.onDone) o.onDone(false); resolve(false); return; }

      var pages = o.pages || [];
      var i = 0;
      var closed = false;

      var back = UI.el('div.tut-back');
      var box = UI.el('div.tut');

      var kicker = UI.el('div.kicker');
      var h3 = UI.el('h3');
      var head = UI.el('div.tut-head', null, [
        UI.el('div', null, [kicker, h3]),
        UI.el('div.spacer'),
      ]);

      var artWrap = UI.el('div.tut-art');
      var cv = UI.el('canvas');
      artWrap.appendChild(cv);

      var body = UI.el('div.tut-body');

      var skip = UI.btn('Überspringen', function () { finish(true); }, 'ghost sm');
      var dots = UI.el('div.tut-dots');
      var next = UI.btn('Weiter', function () { go(i + 1); }, 'primary');
      var foot = UI.el('div.tut-foot', null, [skip, dots, next]);

      box.appendChild(head);
      box.appendChild(artWrap);
      box.appendChild(body);
      box.appendChild(foot);
      back.appendChild(box);
      (o.parent || document.getElementById('app') || document.body).appendChild(back);

      pages.forEach(function () { dots.appendChild(UI.el('i')); });

      function drawArt() {
        var p = pages[i];
        var r = artWrap.getBoundingClientRect();
        var w = Math.max(120, r.width), h = Math.max(80, r.height);
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        cv.width = w * dpr; cv.height = h * dpr;
        var c = cv.getContext('2d');
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        c.clearRect(0, 0, w, h);
        c.fillStyle = '#0b0e15';
        c.fillRect(0, 0, w, h);
        if (p && p.art) {
          try { p.art(c, w, h); }
          catch (e) { SG.noteError('tutorial.art', e); }
        }
      }

      function go(n) {
        if (n >= pages.length) { finish(false); return; }
        i = Math.max(0, n);
        var p = pages[i];
        kicker.textContent = p.kicker || (o.title || '');
        h3.textContent = p.title || '';
        UI.clear(body);

        var lines = Array.isArray(p.body) ? p.body : [p.body];
        lines.forEach(function (l) {
          if (!l) return;
          if (typeof l === 'string') body.appendChild(UI.el('p', { html: l }));
          else if (l.nodeType) body.appendChild(l);
          else body.appendChild(UI.el('div.keyline', null, [
            UI.el('div.ic', { text: l.ic || '•' }),
            UI.el('div', { html: l.text }),
          ]));
        });

        for (var k = 0; k < dots.children.length; k++) {
          dots.children[k].classList.toggle('on', k === i);
        }
        next.innerHTML = i === pages.length - 1 ? "Los geht's" : 'Weiter';
        skip.style.visibility = i === pages.length - 1 ? 'hidden' : '';
        body.scrollTop = 0;
        drawArt();
        SG.audio.play('click');
      }

      function finish(skipped) {
        if (closed) return;
        closed = true;
        T.markSeen(o.id);
        window.removeEventListener('resize', drawArt);
        UI.remove(back);
        if (o.onDone) o.onDone(!skipped);
        resolve(!skipped);
      }

      /* Nach links/rechts wischen blaettert */
      SG.input.attach(box, {
        onSwipe: function (dir) {
          if (dir === 'left') go(i + 1);
          else if (dir === 'right') go(i - 1);
        },
        tapMax: 20,
      });

      window.addEventListener('resize', drawArt);
      go(0);
      setTimeout(drawArt, 40);
    });
  };

  /* ------------------------------------------------------------------
     Wiederverwendbare Zeichnungen fuer Anleitungsseiten.
     ------------------------------------------------------------------ */

  var G = SG.gfx;
  T.art = {
    /* Ein Finger, der tippt */
    tap: function (c, w, h) {
      var cx = w / 2, cy = h / 2;
      G.ring(c, cx, cy, 26, 2, 'rgba(240,180,41,.35)');
      G.ring(c, cx, cy, 40, 2, 'rgba(240,180,41,.15)');
      G.circle(c, cx, cy, 14, '#f0b429');
    },
    /* Pfeile in vier Richtungen */
    swipe: function (c, w, h) {
      var cx = w / 2, cy = h / 2;
      c.strokeStyle = '#4aa3ff'; c.lineWidth = 3; c.lineCap = 'round';
      [[0, -1], [0, 1], [-1, 0], [1, 0]].forEach(function (d) {
        c.beginPath();
        c.moveTo(cx + d[0] * 18, cy + d[1] * 18);
        c.lineTo(cx + d[0] * 46, cy + d[1] * 46);
        c.stroke();
        c.save();
        c.translate(cx + d[0] * 50, cy + d[1] * 50);
        c.rotate(Math.atan2(d[1], d[0]));
        c.beginPath(); c.moveTo(-8, -6); c.lineTo(2, 0); c.lineTo(-8, 6);
        c.stroke();
        c.restore();
      });
      G.circle(c, cx, cy, 11, '#f0b429');
    },
    /* Zwei Finger zum Zoomen */
    pinch: function (c, w, h) {
      var cx = w / 2, cy = h / 2;
      G.circle(c, cx - 34, cy - 18, 12, '#f0b429');
      G.circle(c, cx + 34, cy + 18, 12, '#f0b429');
      G.dashed(c, cx - 26, cy - 12, cx + 26, cy + 12, 'rgba(255,255,255,.35)', 2, [5, 4]);
      c.strokeStyle = '#4aa3ff'; c.lineWidth = 2.5; c.lineCap = 'round';
      c.beginPath(); c.moveTo(cx - 52, cy - 34); c.lineTo(cx - 40, cy - 24); c.stroke();
      c.beginPath(); c.moveTo(cx + 52, cy + 34); c.lineTo(cx + 40, cy + 24); c.stroke();
    },
  };
})(SG);
