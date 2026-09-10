/* ------------------------------------------------------------------
   GehstockMon - Kampfmaschine.

   Reine Regeln, kein DOM. Rein gehen zwei Truppen mit ihren Plaenen,
   heraus kommt eine Liste von Schritten, die 3-ui.js abspielt. Liegt
   unter SG.rules, damit tools/test.mjs sie ohne Browser durchrechnen
   kann.

   Wichtigste Entscheidung: der Kampf ist VOLLSTAENDIG DETERMINISTISCH.
   Kein Zufall, keine Streuung beim Schaden. In einem Spiel, in dem man
   Regeln schreibt, muss eine Niederlage am Plan liegen und nicht am
   Wuerfel - sonst lernt man aus ihr nichts.
   ------------------------------------------------------------------ */

(function (SG) {
  var K = SG.rules.gehstockmon = {};

  var MAX_RUNDEN = 12;      /* danach Patt, zaehlt als Niederlage */
  var HEILUNG    = 32;
  var SCHWACH    = 0.4;     /* Schwelle fuer "unter 40 %" */

  K.MAX_RUNDEN = MAX_RUNDEN;

  function lebt(e) { return e.hp > 0; }

  function lebende(liste, seite) {
    var out = [];
    for (var i = 0; i < liste.length; i++) {
      if (!lebt(liste[i])) continue;
      if (seite && liste[i].seite !== seite) continue;
      out.push(liste[i]);
    }
    return out;
  }

  /* Baut aus einer Datenzeile eine Kampfeinheit. Die Marken sind der
     ganze veraenderliche Zustand: spott zieht Angriffe auf sich,
     stoeren halbiert den naechsten eigenen Schlag, verteidigt halbiert
     eingehenden Schaden. Alle drei laufen bis zum naechsten eigenen Zug
     ihres Traegers. */
  function baue(roh, seite, i, plan) {
    var p = plan || roh.plan || [];
    var aktiv = [];
    for (var n = 0; n < p.length; n++) if (p[n][0] !== 'aus') aktiv.push(p[n]);
    return {
      uid: seite + i, seite: seite,
      name: roh.name, mono: roh.mono, monId: roh.id || null,
      maxHp: roh.hp, hp: roh.hp, ang: roh.ang, tempo: roh.tempo,
      faeh: roh.faeh, plan: aktiv, gefallen: false, pause: 0,
      marken: { spott: 0, stoeren: 0, verteidigt: 0 }
    };
  }

  /* Prueft eine Bedingung. Bewusst ohne verdeckte Information: alles,
     was eine Regel abfragen kann, sieht der Spieler auch. */
  function trifftZu(bed, ich, alle, runde) {
    var meine = lebende(alle, ich.seite);
    var feinde = [], i;
    var alleLeben = lebende(alle);
    for (i = 0; i < alleLeben.length; i++) {
      if (alleLeben[i].seite !== ich.seite) feinde.push(alleLeben[i]);
    }
    if (bed === 'immer') return true;
    if (bed === 'ich_schwach') return ich.hp / ich.maxHp < SCHWACH;
    if (bed === 'runde_1') return runde === 1;
    if (bed === 'ueberzahl') return feinde.length > meine.length;
    if (bed === 'freund_schwach') {
      for (i = 0; i < meine.length; i++) {
        if (meine[i] !== ich && meine[i].hp / meine[i].maxHp < SCHWACH) return true;
      }
      return false;
    }
    if (bed === 'feind_schwach') {
      for (i = 0; i < feinde.length; i++) {
        if (feinde[i].hp / feinde[i].maxHp < SCHWACH) return true;
      }
      return false;
    }
    return false;
  }

  /* Zielwahl. Ein aktiver Spott ueberschreibt jede Absicht - das ist der
     Grund, warum Feld 4 mit dem Standardplan nicht zu gewinnen ist. */
  function waehleZiel(alle, ich, art) {
    var alleLeben = lebende(alle), feinde = [], i;
    for (i = 0; i < alleLeben.length; i++) {
      if (alleLeben[i].seite !== ich.seite) feinde.push(alleLeben[i]);
    }
    if (!feinde.length) return null;
    /* Spott zieht alles auf sich - ausser dem gezielten Schlag auf den
       Staerksten. Ohne diese Luecke waere ein Wall eine Mauer ohne Tuer,
       und Feld 4 waere mit keinem Plan zu gewinnen. So ist der Wall eine
       Aufgabe: erkennen, dass man am ihm vorbeizielen muss. */
    if (art !== 'staerkster') {
      for (i = 0; i < feinde.length; i++) if (feinde[i].marken.spott > 0) return feinde[i];
    }
    var best = feinde[0];
    for (i = 1; i < feinde.length; i++) {
      if (art === 'schwaechster' && feinde[i].hp < best.hp) best = feinde[i];
      else if (art === 'staerkster' && feinde[i].ang > best.ang) best = feinde[i];
    }
    if (art !== 'schwaechster' && art !== 'staerkster') return feinde[0];
    return best;
  }

  /* Zwei Halbierungen koennen sich stapeln: der Schlaeger ist gestoert
     UND das Ziel verteidigt. Gewollt, damit sich beides zusammen lohnt. */
  function schadenAn(ziel, roh) {
    var s = ziel.marken.verteidigt ? Math.round(roh / 2) : roh;
    ziel.hp = Math.max(0, ziel.hp - s);
    return s;
  }

  function nutzeFaehigkeit(alle, ich) {
    var ziel, i;

    if (ich.faeh === 'spott') {
      ich.marken.spott = 1;
      return ich.name + ' stellt sich vor die Reihe.';
    }

    if (ich.faeh === 'hinrichten') {
      ziel = waehleZiel(alle, ich, 'schwaechster');
      if (!ziel) return ich.name + ' findet kein Ziel.';
      var doppelt = ziel.hp / ziel.maxHp < SCHWACH;
      var roh = doppelt ? ich.ang * 2 : ich.ang;
      if (ich.marken.stoeren) { roh = Math.round(roh / 2); ich.marken.stoeren = 0; }
      var s = schadenAn(ziel, roh);
      return ich.name + ' richtet ' + ziel.name + ' hin: ' + s +
        (doppelt ? ' Schaden, doppelt.' : ' Schaden.');
    }

    if (ich.faeh === 'flicken') {
      var meine = lebende(alle, ich.seite);
      ziel = meine[0];
      for (i = 1; i < meine.length; i++) {
        if ((meine[i].maxHp - meine[i].hp) > (ziel.maxHp - ziel.hp)) ziel = meine[i];
      }
      if (!ziel || ziel.hp === ziel.maxHp) return ich.name + ' hat niemanden zu flicken.';
      var vorher = ziel.hp;
      ziel.hp = Math.min(ziel.maxHp, ziel.hp + HEILUNG);
      return ich.name + ' flickt ' + ziel.name + ': +' + (ziel.hp - vorher) + ' Leben.';
    }

    if (ich.faeh === 'stoeren') {
      ziel = waehleZiel(alle, ich, 'staerkster');
      if (!ziel) return ich.name + ' findet kein Ziel.';
      ziel.marken.stoeren = 1;
      return ich.name + ' stört ' + ziel.name + '. Nächster Schlag halbiert.';
    }

    return ich.name + ' zögert.';
  }

  function greifeAn(alle, ich, art) {
    var ziel = waehleZiel(alle, ich, art);
    if (!ziel) return ich.name + ' findet kein Ziel.';
    var roh = ich.ang, gestoert = false;
    if (ich.marken.stoeren) { roh = Math.round(roh / 2); ich.marken.stoeren = 0; gestoert = true; }
    var s = schadenAn(ziel, roh);
    return ich.name + ' trifft ' + ziel.name + ': ' + s + ' Schaden.' +
      (gestoert ? ' (gestört)' : '');
  }

  /* ----------------------------------------------------------------
     Der Kampf.

     kaempfe(meine, plaene, feinde) ->
       { schritte: [{runde, seite, text, zustand}], sieger: 'wir'|'sie'|'patt' }

     zustand ist eine Momentaufnahme aller Lebenspunkte nach dem Schritt.
     Kostet etwas Speicher und erspart der Oberflaeche jede eigene
     Simulation: sie spult nur die Liste ab.
     ---------------------------------------------------------------- */
  K.kaempfe = function (meineRoh, plaene, feindRoh) {
    var alle = [], i;
    for (i = 0; i < meineRoh.length; i++) {
      alle.push(baue(meineRoh[i], 'wir', i, plaene ? plaene[meineRoh[i].id] : null));
    }
    for (i = 0; i < feindRoh.length; i++) alle.push(baue(feindRoh[i], 'sie', i, null));

    var schritte = [];
    function momentaufnahme() {
      var m = [];
      for (var n = 0; n < alle.length; n++) m.push({ uid: alle[n].uid, hp: alle[n].hp });
      return m;
    }
    function notiere(runde, seite, text, actor) {
      schritte.push({ runde: runde, seite: seite, text: text, actor: actor || null, zustand: momentaufnahme() });
    }

    var sieger = 'patt';

    for (var runde = 1; runde <= MAX_RUNDEN; runde++) {
      /* Zugreihenfolge wird zu Rundenbeginn festgelegt. Wer schneller
         ist, kommt zuerst; bei Gleichstand unsere Seite. */
      var reihe = lebende(alle).slice().sort(function (a, b) {
        if (b.tempo !== a.tempo) return b.tempo - a.tempo;
        return a.seite === 'wir' ? -1 : 1;
      });

      for (var r = 0; r < reihe.length; r++) {
        var ich = reihe[r];
        if (!lebt(ich)) continue;

        /* Marken, die bis zum eigenen Zug laufen, verfallen hier. */
        ich.marken.spott = 0;
        ich.marken.verteidigt = 0;
        /* Abklingzeit ebenfalls. Ohne sie heilen sich zwei Heiler
           gegenseitig endlos und jeder Kampf endet im Patt - das war in
           der ersten Fassung tatsaechlich so. */
        if (ich.pause > 0) ich.pause--;

        var regel = null;
        for (var p = 0; p < ich.plan.length; p++) {
          if (trifftZu(ich.plan[p][0], ich, alle, runde)) { regel = ich.plan[p]; break; }
        }
        /* Ohne passende Regel wird draufgehauen. Ein Plan, der nichts
           trifft, soll die Kreatur nicht einfrieren lassen. */
        var aktion = regel ? regel[1] : 'vorderster';

        var text;
        if (aktion === 'faehigkeit') {
          if (ich.pause > 0) {
            /* Noch nicht bereit. Statt die Runde zu verschenken wird
               angegriffen - eine Kreatur, die dasteht, waere nur
               aergerlich, nicht lehrreich. */
            text = greifeAn(alle, ich, 'vorderster') + ' (Fähigkeit noch nicht bereit)';
          } else {
            text = nutzeFaehigkeit(alle, ich);
            /* Eine Faehigkeit, die ins Leere lief (nichts zu heilen,
               kein Ziel), darf die Abklingzeit nicht kosten. Sonst
               bestraft das Spiel eine Regel, die gar nicht gegriffen hat. */
            if (text.indexOf('niemanden') < 0 && text.indexOf('kein Ziel') < 0) ich.pause = 2;
          }
        }
        else if (aktion === 'verteidigen') {
          ich.marken.verteidigt = 1;
          text = ich.name + ' geht in Deckung.';
        } else text = greifeAn(alle, ich, aktion);

        notiere(runde, ich.seite, text, ich.uid);

        /* Gefallene sofort melden, sonst wundert man sich beim Zusehen. */
        for (var g = 0; g < alle.length; g++) {
          if (!lebt(alle[g]) && !alle[g].gefallen) {
            alle[g].gefallen = true;
            notiere(runde, alle[g].seite, alle[g].name + ' fällt.');
          }
        }

        if (!lebende(alle, 'sie').length) { sieger = 'wir'; break; }
        if (!lebende(alle, 'wir').length) { sieger = 'sie'; break; }
      }
      if (sieger !== 'patt') break;
    }

    return { schritte: schritte, sieger: sieger, einheiten: alle };
  };
})(SG);
