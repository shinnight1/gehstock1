/* 30 eigenstaendige Mons, vier taktische Rollen. Seltenheit ist sichtbar,
   ersetzt aber keinen guten Plan. Bestehende Startwerte bleiben erhalten. */
(function (SG) {
  var D = SG.gehstockmon.daten;
  var extra = [
    ['moosling', 'Moosling', 0, 0, 'mossling', 'Ein Waldgeist mit einem Gehstock aus lebenden Wurzeln.'],
    ['glutfuchs', 'Glutfuchs', 1, 0, 'emberling', 'Sein Schweif glimmt noch lange nach dem letzten Schlag.'],
    ['nebelmolch', 'Nebelmolch', 2, 0, 'mistling', 'Sammelt heilenden Tau in seinem gewellten Gehstock.'],
    ['kieselkrabb', 'Kieselkrabb', 0, 0, 'kieselkrabb', 'Ein kleiner Fels mit Scheren und erstaunlich großer Geduld.'],
    ['wurzelzahn', 'Wurzelzahn', 1, 0, 'wurzelzahn', 'Pflügt durch die feindliche Reihe wie durch Waldboden.'],
    ['pilzhueter', 'Pilzhüter', 2, 0, 'pilzhueter', 'Seine Sporen flicken Risse in Haut und Stein.'],
    ['rostknirps', 'Rostknirps', 3, 0, 'rostknirps', 'Ein Klopfen mit dem Eisenstock bringt jeden Plan durcheinander.'],
    ['nachtflatter', 'Nachtflatter', 3, 0, 'nachtflatter', 'Hört die Schwachstelle, bevor der Gegner sie kennt.'],
    ['sumpfschnapper', 'Sumpfschnapper', 0, 1, 'sumpfschnapper', 'Korallenharter Panzer, ein Lächeln voller Zähne.'],
    ['donnerwidder', 'Donnerwidder', 1, 1, 'donnerwidder', 'Zwischen seinen Hörnern wartet ein Gewitter.'],
    ['frostklaue', 'Frostklaue', 1, 1, 'frostklaue', 'Die Kälte ihrer Klauen durchdringt jede Deckung.'],
    ['dornenwolf', 'Dornenwolf', 1, 1, 'dornenwolf', 'Jede Dorne trägt die Erinnerung an einen gewonnenen Kampf.'],
    ['kupferskorp', 'Kupferskorp', 0, 1, 'kupferskorp', 'Sieben Panzerplatten, keine offene Flanke.'],
    ['obsidianrabe', 'Obsidianrabe', 3, 1, 'obsidianrabe', 'Schwarzes Glas und ein Blick, der jede Absicht durchschaut.'],
    ['korallenwacht', 'Korallenwacht', 2, 1, 'korallenwacht', 'Ein wandelndes Riff, das seine Verbündeten beschützt.'],
    ['runengolem', 'Runengolem', 0, 2, 'runengolem', 'Uralte Runen halten seine schwebenden Steinplatten zusammen.'],
    ['mondhexe', 'Mondhexe', 2, 2, 'mondhexe', 'Webt im Mondlicht neue Kraft in ihre Truppe.'],
    ['aschenhydra', 'Aschenhydra', 1, 2, 'aschenhydra', 'Drei Köpfe. Eine Absicht. Kein sicherer Rückzug.'],
    ['sturmhorn', 'Sturmhorn', 0, 2, 'sturmhorn', 'Ein lebender Sturm hinter einer Wand aus Kristall.'],
    ['seelenqualle', 'Seelenqualle', 2, 2, 'seelenqualle', 'Ihr Licht führt verlorene Lebensenergie zurück.'],
    ['kristallspinne', 'Kristallspinne', 3, 2, 'kristallspinne', 'Spannt unsichtbare Fäden um die stärksten Gegner.'],
    ['sonnenkoenig', 'Sonnenkönig', 1, 3, 'sonnenkoenig', 'Sein Gehstock trägt das Feuer einer untergegangenen Sonne.'],
    ['leerenwyrm', 'Leerenwyrm', 3, 3, 'leerenwyrm', 'Zwischen seinen Schuppen verschwindet selbst das Licht.'],
    ['titanenkrone', 'Titanenkrone', 0, 3, 'titanenkrone', 'Ein Gebirge, das beschlossen hat, zurückzuschlagen.'],
    ['sternengeweih', 'Sternengeweih', 2, 3, 'sternengeweih', 'In seinem Geweih wachsen neue Sternbilder.'],
    ['weltenfresser', 'Weltenfresser', 1, 3, 'weltenfresser', 'Unter seiner Goldrüstung brennt das Herz eines Vulkans.']
  ];
  D.KATALOG = D.KREATUREN.map(function (k, i) { var c = Object.assign({}, k); c.typ = i; c.lore = D.SELTENHEITEN[i].text; return c; });
  extra.forEach(function (v) {
    var basis = D.KREATUREN[v[2]];
    D.KATALOG.push({ id: v[0], name: v[1], typ: v[2], seltenheit: v[3], bild: 'gm-' + v[4], lore: v[5], rolle: basis.rolle, hp: basis.hp, ang: basis.ang, tempo: basis.tempo, faeh: basis.faeh, mono: basis.mono });
  });
  D.mon = function (id) { return D.KATALOG.find(function (k) { return k.id === id; }) || null; };
  D.neuerStand = function (save) {
    var st = { plaene: {}, geschafft: [], besitz: ['bollwerk', 'klinge', 'waerter', 'spaeher'], truppe: ['bollwerk', 'klinge', 'waerter', 'spaeher'], essenz: 60, siege: 0, beschwoerungen: 0 };
    D.KATALOG.forEach(function (k) {
      var basis = D.KREATUREN[k.typ];
      var p = save && save.plaene && save.plaene[k.id];
      st.plaene[k.id] = D.START_PLAN[basis.id].map(function (r, i) {
        var v = p && p[i];
        return v && Array.isArray(v) && D.BEDINGUNGEN.some(function (b) { return b.id === v[0]; }) && D.AKTIONEN.some(function (a) { return a.id === v[1]; }) ? v.slice(0, 2) : r.slice();
      });
    });
    if (!save || typeof save !== 'object') return st;
    if (Array.isArray(save.geschafft)) st.geschafft = D.FELDER.map(function (f) { return f.id; }).filter(function (id) { return save.geschafft.indexOf(id) >= 0; });
    if (Array.isArray(save.besitz)) save.besitz.forEach(function (id) { if (D.mon(id) && st.besitz.indexOf(id) < 0) st.besitz.push(id); });
    if (Array.isArray(save.truppe) && save.truppe.length === 4 && new Set(save.truppe).size === 4 && save.truppe.every(function (id) { return st.besitz.indexOf(id) >= 0; })) st.truppe = save.truppe.slice();
    ['essenz', 'siege', 'beschwoerungen'].forEach(function (key) { if (Number.isFinite(save[key]) && save[key] >= 0) st[key] = Math.min(10000000, Math.floor(save[key])); });
    return st;
  };
  D.beschwoere = function (st, random) {
    if (st.essenz < 60) return null;
    var pool = D.KATALOG.filter(function (k) { return st.besitz.indexOf(k.id) < 0; });
    if (!pool.length) return null;
    var weights = [8, 5, 3, 1], total = pool.reduce(function (sum, k) { return sum + weights[k.seltenheit]; }, 0);
    var pick = Math.max(0, Math.min(0.9999999, Number.isFinite(random) ? random : Math.random())) * total;
    var chosen = pool[pool.length - 1];
    for (var i = 0; i < pool.length; i++) { pick -= weights[pool[i].seltenheit]; if (pick < 0) { chosen = pool[i]; break; } }
    st.essenz -= 60; st.besitz.push(chosen.id); st.beschwoerungen++; return chosen;
  };
})(SG);
