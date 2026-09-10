/* ------------------------------------------------------------------
   Bildschirme.

   Ein Admin kann sehen, was die anderen gerade im Hideout machen.

   Was das ist - und was nicht: eine Webseite kann den Bildschirm des
   Geraets nicht abfilmen. Dafuer gaebe es nur getDisplayMedia, und das
   fragt sichtbar um Erlaubnis; auf dem iPad gibt es das ohnehin nicht.
   Uebertragen wird deshalb genau das, was das Hideout selbst zeichnet:
   das Spielfeld und der Name des Bildschirms. Alles ausserhalb dieser
   Seite - andere Apps, Safari, Nachrichten - bleibt unsichtbar.

   Gesendet wird nur, solange jemand hinsieht. Die Anmeldung des
   Zuschauers verfaellt nach einer Minute von selbst; danach hoert das
   Geraet von allein wieder auf, Bilder hochzuladen.
   ------------------------------------------------------------------ */

(function (SG) {
  var UI = SG.ui;
  var A = SG.auth;
  var Rel = SG.relais;

  var S = SG.spiegel = {};

  var TAKT_MS = 1200;
  var BREITE = 320;

  var timer = 0;
  var laeuft = false;
  var letzte = '';

  /* ------------------------------------------------------------------
     Senden
     ------------------------------------------------------------------ */

  S.starten = function () {
    Rel.on('spiegelMich', function (an) {
      if (an && !laeuft) losSenden();
      else if (!an && laeuft) stoppSenden();
    });
  };

  function losSenden() {
    laeuft = true;
    clearInterval(timer);
    timer = setInterval(schuss, TAKT_MS);
    schuss();
  }

  function stoppSenden() {
    laeuft = false;
    clearInterval(timer);
  }

  function schuss() {
    if (!A.aktuell || !Rel.verfuegbar()) return;
    var bild = aufnehmen();
    if (!bild) return;
    /* Ein unveraendertes Bild noch einmal zu schicken kostet nur
       Bandbreite - im Hub aendert sich minutenlang nichts. */
    if (bild.data === letzte) return;
    letzte = bild.data;
    Rel.schirmHochladen(bild.data, bild.w, bild.h).catch(function () { /* egal */ });
  }

  /* Sucht die groesste sichtbare Zeichenflaeche. In einem Spiel ist das
     das Spielfeld; sonst gibt es keine, und dann wird eine kleine
     Uebersicht gezeichnet. */
  function groessteFlaeche() {
    var alle = document.querySelectorAll('#app canvas');
    var best = null, bestF = 0;
    for (var i = 0; i < alle.length; i++) {
      var cv = alle[i];
      var r = cv.getBoundingClientRect();
      if (r.width < 80 || r.height < 60) continue;
      if (r.bottom < 0 || r.top > window.innerHeight) continue;
      var f = r.width * r.height;
      if (f > bestF) { bestF = f; best = cv; }
    }
    return best;
  }

  function aufnehmen() {
    if (SG.tarnung && SG.tarnung.istAn()) return ersatzBild('Tarnung aktiv', '🫥');

    var quelle = groessteFlaeche();
    var cv = document.createElement('canvas');
    var w = BREITE;

    if (quelle) {
      var seite = quelle.height / quelle.width;
      var h = Math.max(60, Math.round(w * seite));
      cv.width = w; cv.height = h;
      var c = cv.getContext('2d');
      c.fillStyle = '#0b0e15';
      c.fillRect(0, 0, w, h);
      try { c.drawImage(quelle, 0, 0, w, h); }
      catch (e) { return ersatzBild(wo(), '🎮'); }
      beschriften(c, w, h, wo());
      return { data: cv.toDataURL('image/jpeg', 0.45), w: w, h: h };
    }
    return ersatzBild(wo(), zeichenVon());
  }

  function ersatzBild(text, icon) {
    var w = BREITE, h = 200;
    var cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    var c = cv.getContext('2d');
    c.fillStyle = '#0d1017';
    c.fillRect(0, 0, w, h);
    SG.gfx.text(c, icon || '•', w / 2, h * 0.42, {
      size: 52, align: 'center', baseline: 'middle',
    });
    SG.gfx.text(c, text, w / 2, h * 0.68, {
      size: 14, weight: 600, color: '#c7d0e4', align: 'center', baseline: 'middle',
    });
    return { data: cv.toDataURL('image/jpeg', 0.5), w: w, h: h };
  }

  function beschriften(c, w, h, text) {
    c.fillStyle = 'rgba(5,8,14,.72)';
    c.fillRect(0, h - 20, w, 20);
    SG.gfx.text(c, text, 6, h - 10, {
      size: 11, weight: 600, color: '#e6ebf5', baseline: 'middle',
    });
  }

  function wo() {
    var h = (location.hash || '#/').replace(/^#\/?/, '');
    if (!h) return 'Startseite';
    var t = h.split('/');
    if (t[0] === 'spiel' && t[1]) {
      var def = SG.games[decodeURIComponent(t[1])];
      return def ? def.name : 'Spiel';
    }
    var namen = {
      kreis: 'Innerer Kreis', profil: 'Profil', ueber: 'Über uns',
      offline: 'Offline', adminraum: 'Admin-Raum', bnd: 'BND',
      befragung: 'Befragung',
    };
    return namen[t[0]] || t[0];
  }

  function zeichenVon() {
    var h = (location.hash || '#/').replace(/^#\/?/, '').split('/')[0];
    var z = {
      '': '🏠', kreis: '🔑', profil: '🎖', ueber: 'ⓘ', offline: '⤓',
      adminraum: '🛡', bnd: '🕵', befragung: '🎙',
    };
    return z[h] || '📄';
  }

  S.wo = wo;

  /* ------------------------------------------------------------------
     Ansehen

     Eine Tafel mit einer Kachel je angemeldetem Geraet. Wer nicht
     online ist, erscheint grau; wer online ist, aber gerade kein Bild
     schickt, bekommt es innerhalb von ein bis zwei Sekunden.
     ------------------------------------------------------------------ */

  S.tafel = function (wurzel) {
    var kopf = UI.el('p.small.muted', {
      text: 'Übertragen wird nur, was das Hideout selbst zeichnet — das Spielfeld '
        + 'und der Name des Bildschirms. Andere Apps sieht hier niemand; '
        + 'eine Webseite kann das technisch nicht.',
    });
    var gitter = UI.el('div.schirm-gitter');
    var hinweis = UI.el('div.small.muted.center', { text: 'Suche Geräte…' });
    UI.add(wurzel, [kopf, gitter, hinweis]);

    var leute = [];
    var kacheln = {};
    var tot = false;

    function aufPraesenz(liste) {
      leute = (liste || []).filter(function (p) {
        return p.code && p.code !== (A.aktuell && A.aktuell.code);
      });
      var codes = [];
      leute.forEach(function (p) { if (codes.indexOf(p.code) < 0) codes.push(p.code); });
      Rel.schirmeBeobachten(codes);
      malen();
    }

    function malen() {
      hinweis.textContent = leute.length
        ? leute.length + ' ' + SG.util.plural(leute.length, 'Gerät', 'Geräte') + ' online'
        : 'Gerade ist niemand sonst online.';
      var gesehen = {};
      leute.forEach(function (p) {
        gesehen[p.code] = true;
        var k = kacheln[p.code];
        if (!k) {
          k = kachel(p);
          kacheln[p.code] = k;
          gitter.appendChild(k.el);
        }
        k.stand(p);
      });
      for (var c in kacheln) {
        if (!gesehen[c]) { UI.remove(kacheln[c].el); delete kacheln[c]; }
      }
    }

    function kachel(p) {
      var img = UI.el('img.schirm-bild', { alt: '' });
      var platz = UI.el('div.schirm-platz', { text: '…' });
      var name = UI.el('div.schirm-name', { text: p.name || p.code });
      var ort = UI.el('div.schirm-ort', { text: p.wo || '' });
      var el = UI.el('div.schirm-kachel', {
        on: {
          click: function () { gross(p.code); },
        },
      }, [
        UI.el('div.schirm-rahmen', null, [platz, img]),
        UI.el('div.schirm-fuss', null, [name, ort]),
      ]);
      return {
        el: el,
        stand: function (q) {
          name.textContent = (q.name || q.code) + ' · ' + q.code;
          ort.textContent = (q.wo || '') + (q.art ? ' · ' + q.art : '');
        },
        bild: function (b) {
          img.src = b.data;
          img.classList.add('da');
          platz.style.display = 'none';
          ort.textContent = b.wo || ort.textContent;
        },
      };
    }

    function gross(code) {
      var img = UI.el('img.voll-bild', { alt: '' });
      var deckel = UI.el('div.bild-voll', null, [
        img, UI.el('div.bild-voll-fuss', { text: 'Bildschirm ' + code }),
      ]);
      deckel.addEventListener('click', function () { UI.remove(deckel); grossEl = null; });
      document.body.appendChild(deckel);
      grossEl = { code: code, img: img };
      var k = kacheln[code];
      if (k && k.el.querySelector('img.da')) img.src = k.el.querySelector('img').src;
      if (SG.protokoll) {
        SG.protokoll.schreiben('schirm', 'Bildschirm im Vollbild angesehen', '', code);
      }
    }
    var grossEl = null;

    function aufSchirm(code, b) {
      var k = kacheln[code];
      if (k) k.bild(b);
      if (grossEl && grossEl.code === code) grossEl.img.src = b.data;
    }

    Rel.on('praesenz', aufPraesenz);
    Rel.on('schirm', aufSchirm);
    Rel.praesenzAn(true);
    Rel.starten();

    /* Die Anmeldung beim Relais verfaellt nach einer Minute - solange
       hier jemand zusieht, muss sie erneuert werden. */
    var frisch = setInterval(function () {
      if (tot) return;
      var codes = leute.map(function (p) { return p.code; });
      if (codes.length) Rel.schirmeBeobachten(codes);
    }, 30000);

    if (SG.protokoll) SG.protokoll.schreiben('schirm', 'Bildschirmtafel geöffnet');

    return {
      destroy: function () {
        tot = true;
        clearInterval(frisch);
        Rel.off('praesenz', aufPraesenz);
        Rel.off('schirm', aufSchirm);
        Rel.praesenzAn(false);
        Rel.schirmeBeobachten([]);
        if (grossEl) UI.remove(grossEl.img.parentNode);
      },
    };
  };
})(SG);
