/* ------------------------------------------------------------------
   Profil: Stufe, Erfahrung, Erfolge.

   Der Bildschirm hinter dem Stufenabzeichen oben rechts. Zeigt, wo
   jemand steht, was als Naechstes ansteht und was noch offen ist.

   Erfolge stehen nach Spiel gruppiert - so sieht man auf einen Blick,
   wo noch etwas zu holen ist, und genau das war der Sinn der Sache.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var UI = SG.ui;
  var F = SG.fortschritt;

  var P = SG.profil = {};

  /* Ring mit dem Fuellstand der laufenden Stufe */
  function ring(stand, groesse) {
    var r = groesse / 2 - 7;
    var umfang = 2 * Math.PI * r;
    var an = Math.max(0, Math.min(1, stand.anteil)) * umfang;

    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 ' + groesse + ' ' + groesse);
    svg.setAttribute('width', String(groesse));
    svg.setAttribute('height', String(groesse));
    svg.setAttribute('class', 'xp-ring');

    function kreis(farbe, breite, laenge) {
      var c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', String(groesse / 2));
      c.setAttribute('cy', String(groesse / 2));
      c.setAttribute('r', String(r));
      c.setAttribute('fill', 'none');
      c.setAttribute('stroke', farbe);
      c.setAttribute('stroke-width', String(breite));
      c.setAttribute('stroke-linecap', 'round');
      if (laenge !== undefined) {
        c.setAttribute('stroke-dasharray', laenge + ' ' + umfang);
        c.setAttribute('transform', 'rotate(-90 ' + (groesse / 2) + ' ' + (groesse / 2) + ')');
      }
      svg.appendChild(c);
      return c;
    }

    kreis('rgba(255,255,255,.09)', 9);
    kreis('#f0b429', 9, an);
    return svg;
  }

  P.render = function (app) {
    UI.clear(app);

    app.appendChild(UI.el('div.topbar', null, [
      UI.el('button.back.btn.sm.ghost', {
        html: '‹ Zurück',
        on: { click: function () { SG.router.go('#/'); } },
      }),
      UI.el('div.spacer'),
      UI.el('div.brand-title', { text: 'Profil' }),
      UI.el('div.spacer'),
    ]));

    var screen = UI.el('div.screen');
    var wrap = UI.el('div.wrap-780');
    screen.appendChild(wrap);
    app.appendChild(screen);

    var stand = F.stand();
    var name = (SG.auth.aktuell && SG.auth.aktuell.name) || 'Gast';

    /* ---------------------------------------------------- Kopf */

    var kopf = UI.el('div.pf-kopf', null, [
      UI.el('div.pf-ring', null, [
        ring(stand, 132),
        UI.el('div.pf-ring-in', null, [
          UI.el('div.pf-stufe', { text: String(stand.stufe) }),
          UI.el('div.pf-stufe-k', { text: 'Stufe' }),
        ]),
      ]),
      UI.el('div.pf-wer', null, [
        UI.el('div.pf-name', { text: name }),
        UI.el('div.pf-rang', {
          text: stand.rang.icon + ' ' + stand.rang.name,
        }),
        UI.el('div.pf-xp', {
          text: stand.voll
            ? U.num(stand.xp) + ' XP · Höchststufe erreicht'
            : U.num(stand.rest) + ' / ' + U.num(stand.bedarf) + ' XP bis Stufe '
              + (stand.stufe + 1),
        }),
        UI.el('div.pf-balken', null, [
          UI.el('div.pf-balken-in', {
            style: { width: Math.round(stand.anteil * 100) + '%' },
          }),
        ]),
        UI.el('div.pf-gesamt', { text: U.num(stand.xp) + ' XP insgesamt' }),
      ]),
    ]);
    wrap.appendChild(kopf);

    /* ---------------------------------------------------- Zahlen */

    var zahlen = UI.el('div.pf-zahlen');
    [
      ['🎮', 'Runden', U.num(stand.runden)],
      ['🏅', 'Siege', U.num(stand.siege)],
      ['📈', 'Bestwerte', U.num(stand.rekorde)],
      ['🧭', 'Spiele probiert', F.verschiedeneSpiele() + ' / ' + spieleGesamt()],
      ['📅', 'Tage gespielt', U.num(stand.tage)],
      ['🎯', 'Erfolge', stand.erfolge + ' / ' + stand.erfolgeGesamt],
    ].forEach(function (z) {
      zahlen.appendChild(UI.el('div.pf-zahl', null, [
        UI.el('div.ic', { text: z[0] }),
        UI.el('div.v', { text: z[2] }),
        UI.el('div.k', { text: z[1] }),
      ]));
    });
    wrap.appendChild(zahlen);

    /* ---------------------------------------------------- Naechster Rang */

    var naechster = null;
    for (var i = 0; i < F.RAENGE.length; i++) {
      if (F.RAENGE[i].ab > stand.stufe) { naechster = F.RAENGE[i]; break; }
    }
    if (naechster) {
      wrap.appendChild(UI.el('div.pf-hinweis', {
        html: 'Nächster Rang: <b>' + naechster.icon + ' ' + naechster.name
          + '</b> ab Stufe ' + naechster.ab + '.',
      }));
    }

    /* ---------------------------------------------------- Erfolge */

    wrap.appendChild(UI.el('h3.pf-h', { text: 'Erfolge' }));

    var filterZeile = UI.el('div.pf-filter');
    var liste = UI.el('div.pf-erfolge');

    var modus = 'offen';
    var reiter = UI.tabs([
      { id: 'offen', label: 'Offen' },
      { id: 'geschafft', label: 'Geschafft' },
      { id: 'alle', label: 'Alle' },
    ], function (id) { modus = id; zeichne(); }, 'offen');
    filterZeile.appendChild(reiter);
    wrap.appendChild(filterZeile);
    wrap.appendChild(liste);

    function gruppen() {
      var g = [{ id: null, name: 'Rund ums Haus', icon: '🏠', eintraege: [] }];
      var proSpiel = {};
      F.ERFOLGE.forEach(function (e) {
        if (!e.spiel) { g[0].eintraege.push(e); return; }
        if (!proSpiel[e.spiel]) {
          var def = SG.games[e.spiel];
          proSpiel[e.spiel] = {
            id: e.spiel,
            name: def ? def.name : e.spiel,
            icon: '🎮',
            eintraege: [],
          };
          g.push(proSpiel[e.spiel]);
        }
        proSpiel[e.spiel].eintraege.push(e);
      });
      return g;
    }

    function zeichne() {
      UI.clear(liste);
      var gezeigt = 0;

      gruppen().forEach(function (gr) {
        var passend = gr.eintraege.filter(function (e) {
          var hat = F.hat(e.id);
          if (modus === 'offen') return !hat;
          if (modus === 'geschafft') return hat;
          return true;
        });
        if (!passend.length) return;

        var hat = 0;
        gr.eintraege.forEach(function (e) { if (F.hat(e.id)) hat++; });

        liste.appendChild(UI.el('div.pf-gruppe', null, [
          UI.el('div.t', { text: gr.name }),
          UI.el('div.z', { text: hat + ' / ' + gr.eintraege.length }),
        ]));

        passend.forEach(function (e) {
          gezeigt++;
          var offen = !F.hat(e.id);
          var geheim = offen && e.geheim;
          liste.appendChild(UI.el('div.pf-erfolg' + (offen ? '.zu' : ''), null, [
            UI.el('div.ic', { text: geheim ? '❔' : e.icon }),
            UI.el('div.tx', null, [
              UI.el('div.t', { text: geheim ? 'Versteckter Erfolg' : e.name }),
              UI.el('div.d', {
                text: geheim
                  ? 'Wird verraten, sobald du ihn hast.'
                  : e.text,
              }),
            ]),
            UI.el('div.xp', { text: '+' + e.xp }),
          ]));
        });
      });

      if (!gezeigt) {
        liste.appendChild(UI.empty('🎉', 'Alles geschafft',
          'Hier ist gerade nichts offen.'));
      }
    }

    zeichne();

    return {
      destroy: function () { /* nichts zu loesen */ },
    };
  };

  function spieleGesamt() {
    return SG.list().filter(function (g) { return !g.external; }).length;
  }

  /* ------------------------------------------------------------------
     Einblendungen.

     Erfahrung soll man mitbekommen, ohne dass sie im Weg steht: eine
     kleine Zahl unten fuer XP, eine groessere Karte fuer einen Erfolg,
     und fuer den Stufenaufstieg einmal das ganze Abzeichen.
     ------------------------------------------------------------------ */

  var warteschlange = [];
  var laeuft = false;

  function naechste() {
    if (laeuft || !warteschlange.length) return;
    laeuft = true;
    var karte = warteschlange.shift();
    document.body.appendChild(karte);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { karte.classList.add('an'); });
    });
    setTimeout(function () { karte.classList.add('an'); }, 60);
    setTimeout(function () {
      karte.classList.remove('an');
      setTimeout(function () {
        UI.remove(karte);
        laeuft = false;
        naechste();
      }, 320);
    }, karte._dauer || 2600);
  }

  function einblenden(node, dauer) {
    node._dauer = dauer;
    warteschlange.push(node);
    if (warteschlange.length > 4) warteschlange.length = 4;
    naechste();
  }

  P.xpFlug = function (betrag, grund) {
    var t = UI.el('div.xp-flug', null, [
      UI.el('span.b', { text: '+' + betrag + ' XP' }),
      grund ? UI.el('span.g', { text: grund }) : null,
    ]);
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('an'); });
    setTimeout(function () { t.classList.add('an'); }, 40);
    setTimeout(function () {
      t.classList.remove('an');
      setTimeout(function () { UI.remove(t); }, 400);
    }, 1500);
  };

  P.erfolgKarte = function (e) {
    einblenden(UI.el('div.pf-karte.erfolg', null, [
      UI.el('div.ic', { text: e.icon }),
      UI.el('div.tx', null, [
        UI.el('div.k', { text: 'Erfolg freigeschaltet' }),
        UI.el('div.t', { text: e.name }),
        UI.el('div.d', { text: e.text }),
      ]),
      UI.el('div.xp', { text: '+' + e.xp }),
    ]), 3000);
  };

  P.stufeKarte = function (info) {
    einblenden(UI.el('div.pf-karte.stufe', null, [
      UI.el('div.ic', { text: info.rang.icon }),
      UI.el('div.tx', null, [
        UI.el('div.k', { text: 'Stufe ' + info.auf }),
        UI.el('div.t', { text: info.rang.name }),
        UI.el('div.d', {
          text: info.von + ' → ' + info.auf + ' · weiter so.',
        }),
      ]),
    ]), 3200);
  };

  /* Anschluss an den Fortschritt. Waehrend des Selbsttests bleibt es
     still - dort laufen tausende Runden in Sekunden. */
  F.on('xp', function (e) {
    if (SG.selftest && SG.selftest.active) return;
    if (e.auf) return;                    // die Stufenkarte sagt es schon
    P.xpFlug(e.betrag, e.grund);
  });

  F.on('erfolg', function (e) {
    if (SG.selftest && SG.selftest.active) return;
    SG.audio.play('power');
    P.erfolgKarte(e);
  });

  F.on('stufe', function (info) {
    if (SG.selftest && SG.selftest.active) return;
    SG.audio.play('levelup');
    SG.settings.buzz(24);
    P.stufeKarte(info);
  });
})(SG);
