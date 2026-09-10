/* ------------------------------------------------------------------
   Zugangscodes.

   Was das ist und was nicht:

   Die Seite ist statisch. Es gibt keinen Server, der einen Code pruefen
   koennte - die Pruefung laeuft im Browser des Besuchers. Wer den
   Quelltext liest, kann sie umgehen und sich sogar eigene Codes
   ausrechnen. Das hier ist deshalb eine Tuer mit Schluessel, kein
   Tresor: es haelt Neugierige draussen, trennt Spielstaende sauber je
   Person und gibt dem Admin eine echte Verwaltung.

   Warum trotzdem kein Codeliste im Quelltext:
   Eine feste Liste haette bedeutet, dass jeder neue Code einen neuen
   Build braucht. Stattdessen traegt jeder Code seine eigene Pruefsumme.
   Damit kann der Admin auf seinem Geraet Codes erzeugen, und jedes
   andere Geraet erkennt sie, ohne sie je gesehen zu haben.

   Aufbau eines Codes:

       Vier Ziffern, z. B. 0141. Gueltig, wenn der Streuwert durch
       RASTER teilbar ist; die Rolle ergibt sich aus demselben Wert.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;

  var A = SG.auth = {};

  /* ------------------------------------------------------------------
     Vierstellige Zahlencodes

     Ein Code ist eine Zahl von 0000 bis 9999. Gueltig ist er, wenn sein
     Streuwert durch RASTER teilbar ist - daraus ergibt sich auch gleich
     die Rolle. Es gibt also keine Liste, die verteilt werden muesste:
     jedes Geraet rechnet dieselbe Antwort aus.

     Was das kostet: von 10 000 Zahlen sind rund 10 000/RASTER gueltig.
     Bei RASTER = 97 sind das etwa 103 Codes, also einer von 97. Wer raet,
     braucht im Schnitt rund fuenfzig Versuche - und nach jedem falschen
     zehn Sekunden Bedenkzeit. Fuer eine Tuer unter Freunden reicht das;
     ein Tresor ist es nicht, und das war es ohne Server auch vorher nie.
     ------------------------------------------------------------------ */

  var RASTER = 97;
  var STELLEN = 4;

  /* Das Geheimnis steckt im Build. Es ist im Quelltext sichtbar - siehe
     die Einordnung oben. Es verhindert nur, dass jemand durch Raten
     einen gueltigen Code trifft. */
  var GEHEIM = 'gehstock:hideout:2026:kellergewoelbe';

  /* Kleine, schnelle Streuwertfunktion (FNV-1a in 32 Bit) */
  function streu(text) {
    var h = 0x811c9dc5;
    for (var i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
    }
    return h >>> 0;
  }

  /* Der Streuwert einer Zahl - Grundlage fuer Gueltigkeit und Rolle */
  function wert(code) {
    return streu('code:' + code + ':' + GEHEIM);
  }

  /* Drei Rollen, von oben nach unten:
       A  Admin          darf alles: Codes, Sperren, Wartung, Ansagen
       K  Innerer Kreis  sieht den internen Bereich und dessen Spiele
       S  Spieler        das normale Hideout                           */
  A.ADMIN = 'A';
  A.KREIS = 'K';
  A.SPIELER = 'S';

  A.ROLLEN = [
    { id: 'A', name: 'Admin', icon: '🛡',
      text: 'Darf Codes erstellen, Spiele sperren und Ansagen schreiben.' },
    { id: 'K', name: 'Innerer Kreis', icon: '🔑',
      text: 'Sieht den internen Bereich und die Spiele, die nur dort laufen.' },
    { id: 'S', name: 'Spieler', icon: '🎮',
      text: 'Das normale Hideout.' },
  ];

  A.rolleName = function (r) {
    for (var i = 0; i < A.ROLLEN.length; i++) if (A.ROLLEN[i].id === r) return A.ROLLEN[i].name;
    return 'Spieler';
  };
  A.rolleIcon = function (r) {
    for (var i = 0; i < A.ROLLEN.length; i++) if (A.ROLLEN[i].id === r) return A.ROLLEN[i].icon;
    return '🎮';
  };
  A.gueltigeRolle = function (r) {
    return r === A.ADMIN || r === A.KREIS ? r : A.SPIELER;
  };

  /* Normiert eine Eingabe: nur Ziffern */
  A.normieren = function (eingabe) {
    return String(eingabe || '').replace(/\D/g, '').slice(0, STELLEN);
  };

  A.schoen = function (code) { return A.normieren(code); };

  A.stellen = STELLEN;

  /* Prueft einen Code. Liefert { rolle, code } oder null. */
  A.pruefen = function (eingabe) {
    var c = A.normieren(eingabe);
    if (c.length !== STELLEN) return null;
    var w = wert(c);
    if (w % RASTER !== 0) return null;
    var rolle = [A.SPIELER, A.KREIS, A.ADMIN][Math.floor(w / RASTER) % 3];
    return { rolle: rolle, code: c };
  };

  /* Alle gueltigen Codes einer Rolle - der Vorrat ist begrenzt, das
     gehoert bei vier Ziffern dazu. */
  A.vorrat = function (rolle) {
    var out = [];
    for (var n = 0; n < 10000; n++) {
      var c = String(n);
      while (c.length < STELLEN) c = '0' + c;
      var g = A.pruefen(c);
      if (g && (!rolle || g.rolle === rolle)) out.push(c);
    }
    return out;
  };

  /* Erzeugt einen neuen Code der gewuenschten Rolle. Schon vergebene
     werden uebersprungen. Liefert null, wenn keiner mehr frei ist. */
  A.erzeugen = function (rolle) {
    rolle = A.gueltigeRolle(rolle);
    var frei = A.vorrat(rolle).filter(function (c) {
      return !A.liste().some(function (e) { return e.code === c; });
    });
    if (!frei.length) return null;
    return frei[Math.floor(Math.random() * frei.length)];
  };

  /* ------------------------------------------------------------------
     Der erste Admin

     Damit ueberhaupt jemand hereinkommt, wird beim Bauen ein fester
     Admin-Code erzeugt und ausgegeben. Er steht in der Bauausgabe und
     laesst sich jederzeit neu erzeugen, indem man GEHEIM aendert.
     ------------------------------------------------------------------ */

  A.ersterAdmin = function () {
    var alle = A.vorrat(A.ADMIN);
    return alle.length ? alle[0] : null;
  };

  /* ------------------------------------------------------------------
     Angemeldete Person

     Der Speicher wird pro Code getrennt. Damit hat jeder seinen eigenen
     Fortschritt, ohne dass sich zwei Leute auf einem iPad in die Quere
     kommen.
     ------------------------------------------------------------------ */

  var SITZUNG = 'auth:sitzung';   // alter Schluessel - wird nur noch geraeumt

  A.aktuell = null;               // { code, rolle, name }

  A.anmelden = function (code, name) {
    var geprueft = A.pruefen(code);
    if (!geprueft) return null;
    var eintrag = {
      code: geprueft.code,
      rolle: geprueft.rolle,
      name: name || A.nameVon(geprueft.code) || '',
    };
    A.aktuell = eintrag;
    /* Bewusst NICHT gespeichert: der Code wird bei jedem Seitenaufruf
       neu verlangt. Siehe A.fortsetzen. */
    SG.storage.globalDel(SITZUNG);
    SG.storage.setUser(geprueft.code);
    /* Wer sich anmeldet, steht danach auch in der Liste - selbst wenn
       ihn nie ein Admin angelegt hat. Sonst kennt die Verwaltung nur
       die Leute, die jemand von Hand eingetragen hat, und das
       Lagebild des BND waere ausgerechnet dort leer, wo es zaehlt.

       Aber erst, wenn ein Name da ist: ein Profil ohne Namen bliebe
       sonst stehen und wuerde beim naechsten Mal den Namen aus dem
       Geraetespeicher verdecken - die Tuer fragte dann jedes Mal
       aufs Neue danach. */
    if (eintrag.name) A.merken(geprueft.code, eintrag.name, geprueft.rolle);
    A.geraetMelden(geprueft.code);
    if (SG.router && SG.router.invalidate) SG.router.invalidate();
    if (SG.fortschritt) SG.fortschritt.neuLaden();
    return eintrag;
  };

  A.abmelden = function () {
    A.aktuell = null;
    SG.storage.globalDel(SITZUNG);
    SG.storage.setUser(null);
    if (SG.bnd) SG.bnd.abmelden();
    if (SG.router && SG.router.invalidate) SG.router.invalidate();
    if (SG.fortschritt) SG.fortschritt.neuLaden();
  };

  /* Es gibt kein Fortsetzen mehr.

     Frueher lag die Sitzung im Geraetespeicher und wer einmal drin war,
     blieb drin. Wer das iPad kurz aus der Hand gab, gab damit auch
     seinen Zugang weiter. Jetzt gilt: jedes Neuladen, jeder neue Tab,
     jeder Neustart verlangt den Code wieder. Innerhalb der Seite - von
     Kachel zu Kachel, in ein Spiel und zurueck - passiert nichts,
     denn dabei laedt die Seite ja nicht neu.

     Bleibt hier stehen, damit ein alter Eintrag noch weggeraeumt wird. */
  A.fortsetzen = function () {
    SG.storage.globalDel(SITZUNG);
    return null;
  };

  A.istAdmin = function () { return !!(A.aktuell && A.aktuell.rolle === A.ADMIN); };

  /* Admins gehoeren automatisch zum inneren Kreis */
  A.imKreis = function () {
    return !!(A.aktuell && (A.aktuell.rolle === A.ADMIN || A.aktuell.rolle === A.KREIS));
  };

  /* Name zum Code - liegt global, damit er beim Wechsel erhalten bleibt */
  A.nameVon = function (code) {
    var k = A.normieren(code);
    /* Erst im geteilten Profil nachsehen - der Name, den der Admin beim
       Anlegen vergeben hat, gilt auf jedem Geraet. */
    var p = A.liste();
    for (var i = 0; i < p.length; i++) if (p[i].code === k && p[i].name) return p[i].name;
    var namen = SG.storage.globalGet('auth:namen', {});
    return namen[k] || '';
  };

  A.nameSetzen = function (code, name) {
    var k = A.normieren(code);
    var namen = SG.storage.globalGet('auth:namen', {});
    namen[k] = name;
    SG.storage.globalSet('auth:namen', namen);
    /* Im geteilten Profil nachziehen - und eines anlegen, falls es
       noch keines gibt. Der Name ist der Moment, in dem jemand zum
       ersten Mal wirklich jemand ist. */
    var vorhanden = A.liste().some(function (e) { return e.code === k; });
    if (vorhanden) {
      SG.verwaltung.schreiben(function (d) {
        (d.profile || []).forEach(function (e) { if (e.code === k) e.name = name; });
      });
    } else {
      var g = A.pruefen(k);
      if (g) A.merken(k, name, g.rolle);
    }
    if (A.aktuell && A.aktuell.code === A.normieren(code)) {
      A.aktuell.name = name;
      SG.storage.globalSet(SITZUNG, A.aktuell);
    }
  };

/* ------------------------------------------------------------------
     Alles ab hier liegt in SG.verwaltung und damit auf dem Relais -
     eine Sperre wirkt so auch auf Geraeten, die sie nie gesehen haben.
     ------------------------------------------------------------------ */

  function V() { return SG.verwaltung.daten(); }

  A.liste = function () { return V().profile || []; };

  A.merken = function (code, name, rolle) {
    /* Schon da? Dann gar nicht erst schreiben - jeder Schreibvorgang
       geht ueber das Relais und weckt alle anderen Geraete auf. */
    if (A.liste().some(function (e) { return e.code === code; })) return A.liste();
    SG.verwaltung.schreiben(function (d) {
      d.profile = d.profile || [];
      if (d.profile.some(function (e) { return e.code === code; })) return;
      d.profile.unshift({ code: code, name: name || '', rolle: rolle, t: Date.now() });
      if (d.profile.length > 200) d.profile.length = 200;
    });
    return A.liste();
  };

  A.vergessen = function (code) {
    SG.verwaltung.schreiben(function (d) {
      d.profile = (d.profile || []).filter(function (e) { return e.code !== code; });
      delete (d.sperren || {})[code];
    });
    return A.liste();
  };

  A.einladung = function (code, name) {
    var n = String(name || '').replace(/[#s]+/g, ' ').trim();
    return (n ? n + '#' : '') + A.schoen(code);
  };

  A.zerlegen = function (eingabe) {
    var s = String(eingabe || '');
    var i = s.indexOf('#');
    if (i < 0) return { name: '', code: A.normieren(s) };
    return { name: s.slice(0, i).trim(), code: A.normieren(s.slice(i + 1)) };
  };

  A.sperren = function (code) { return (V().sperren || {})[A.normieren(code)] || []; };

  A.sperrenSetzen = function (code, liste) {
    SG.verwaltung.schreiben(function (d) {
      d.sperren = d.sperren || {};
      var k = A.normieren(code);
      if (liste && liste.length) d.sperren[k] = liste.slice();
      else delete d.sperren[k];
    });
  };

  A.sperreUmschalten = function (code, spielId) {
    var l = A.sperren(code).slice();
    var i = l.indexOf(spielId);
    if (i >= 0) l.splice(i, 1); else l.push(spielId);
    A.sperrenSetzen(code, l);
    return l.indexOf(spielId) >= 0;
  };

  A.wartung = function () { return V().wartung || {}; };

  A.wartungSetzen = function (spielId, an, grund) {
    SG.verwaltung.schreiben(function (d) {
      d.wartung = d.wartung || {};
      if (an) d.wartung[spielId] = grund || 'Wird gerade bearbeitet.';
      else delete d.wartung[spielId];
    });
    return A.wartung();
  };

  A.inWartung = function (spielId) { return !!A.wartung()[spielId]; };

  A.kreisSpiele = function () { return V().kreisSpiele || []; };
  A.nurKreis = function (spielId) { return A.kreisSpiele().indexOf(spielId) >= 0; };

  A.kreisUmschalten = function (spielId) {
    var drin = A.nurKreis(spielId);
    SG.verwaltung.schreiben(function (d) {
      d.kreisSpiele = d.kreisSpiele || [];
      var i = d.kreisSpiele.indexOf(spielId);
      if (i >= 0) d.kreisSpiele.splice(i, 1); else d.kreisSpiele.push(spielId);
    });
    return !drin;
  };

  A.zugang = function (spielId) {
    var w = A.wartung()[spielId];
    if (w && !A.istAdmin()) {
      return { grund: 'wartung', text: typeof w === 'string' ? w : 'Wird gerade bearbeitet.' };
    }
    if (A.nurKreis(spielId) && !A.imKreis()) {
      return { grund: 'kreis', text: 'Dieses Spiel läuft nur im inneren Kreis.' };
    }
    if (A.aktuell && A.sperren(A.aktuell.code).indexOf(spielId) >= 0) {
      return { grund: 'gesperrt', text: 'Dieses Spiel ist für dich gesperrt.' };
    }
    return null;
  };

  A.ansage = function () { return V().ansage || null; };

  A.ansageSetzen = function (text, art) {
    var a = null;
    if (text) {
      a = {
        id: 'a' + Date.now(),
        text: String(text),
        art: art || 'info',
        von: (A.aktuell && A.aktuell.name) || 'Admin',
        rolle: (A.aktuell && A.aktuell.rolle) || A.ADMIN,
        t: Date.now(),
      };
    }
    SG.verwaltung.schreiben(function (d) { d.ansage = a; });
    return a;
  };

  A.ansageGelesen = function (id) { return SG.storage.get('ansage:gelesen', '') === id; };
  A.ansageWegklicken = function (id) { SG.storage.set('ansage:gelesen', id); };

  /* ------------------------------------------------------------------
     Bundesnachrichtendienst

     Kein vierter Rollenbuchstabe, sondern eine zusaetzliche Freigabe
     neben der Rolle. Das hat einen handfesten Grund: die Rolle steckt
     im Streuwert des Codes. Gaebe es vier statt drei, bekaeme jeder
     schon vergebene Code eine andere Rolle - und alle Codes waeren auf
     einen Schlag falsch. Die Freigabe liegt deshalb in der Verwaltung,
     genau wie eine Sperre.
     ------------------------------------------------------------------ */

  A.bndListe = function () { return V().bnd || []; };

  A.hatBnd = function (code) {
    return A.bndListe().indexOf(A.normieren(code)) >= 0;
  };

  A.istBnd = function () { return !!(A.aktuell && A.hatBnd(A.aktuell.code)); };

  A.bndSetzen = function (code, an) {
    var k = A.normieren(code);
    SG.verwaltung.schreiben(function (d) {
      d.bnd = d.bnd || [];
      var i = d.bnd.indexOf(k);
      if (an && i < 0) d.bnd.push(k);
      if (!an && i >= 0) d.bnd.splice(i, 1);
    });
    return A.hatBnd(k);
  };

  /* Dienstschluessel: sechs Ziffern, aus dem eigenen Code gerechnet.
     Damit muss nichts gespeichert und nichts verteilt werden - der
     Admin sieht ihn im Profil und gibt ihn weiter, das Geraet des
     Agenten rechnet dieselbe Zahl aus. */
  /* Kennung: vier Zeichen, aus dem Code gerechnet. Im BND wird ueber
     Leute gesprochen, ohne dass dabei ihr Code auf dem Schirm steht -
     wer ueber die Schulter guckt, sieht damit nichts Brauchbares. */
  A.bndKennung = function (code) {
    var w = streu('kennung:' + A.normieren(code) + ':' + GEHEIM);
    var z = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var s = '';
    for (var i = 0; i < 4; i++) { s += z[w % z.length]; w = Math.floor(w / z.length); }
    return s.slice(0, 2) + '-' + s.slice(2);
  };

  A.bndSchluessel = function (code) {
    var w = streu('bnd:' + A.normieren(code) + ':' + GEHEIM);
    var s = String(w % 1000000);
    while (s.length < 6) s = '0' + s;
    return s;
  };

  /* ------------------------------------------------------------------
     Banne

     Ein gebannter Code kommt nicht mehr durch die Tuer, und wer schon
     drin ist, fliegt beim naechsten Stand der Verwaltung heraus.
     ------------------------------------------------------------------ */

  A.banne = function () { return V().banne || {}; };

  A.gebannt = function (code) {
    var b = A.banne()[A.normieren(code)];
    return b || null;
  };

  A.bannSetzen = function (code, grund, von) {
    var k = A.normieren(code);
    SG.verwaltung.schreiben(function (d) {
      d.banne = d.banne || {};
      d.banne[k] = {
        grund: String(grund || 'Ohne Angabe'),
        von: von || (A.aktuell && A.aktuell.name) || 'Admin',
        t: Date.now(),
      };
    });
    return A.gebannt(k);
  };

  A.bannLoesen = function (code) {
    var k = A.normieren(code);
    SG.verwaltung.schreiben(function (d) {
      d.banne = d.banne || {};
      delete d.banne[k];
    });
  };

  /* ------------------------------------------------------------------
     Geraete je Code

     Jedes Geraet hat eine Zufallskennung (SG.relais.geraet). Taucht ein
     Code auf einem zweiten auf, faellt das hier auf - mehr steckt nicht
     dahinter, insbesondere kein Fingerabdruck des Geraets.
     ------------------------------------------------------------------ */

  A.geraete = function (code) {
    var g = (V().geraete || {})[A.normieren(code)];
    return Array.isArray(g) ? g : [];
  };

  A.geraetMelden = function (code) {
    if (!SG.relais || !SG.relais.geraet) return;
    var k = A.normieren(code);
    var id = SG.relais.geraet;
    var art = SG.relais.geraeteArt;
    var jetzt = Date.now();

    var vorhanden = A.geraete(k).filter(function (e) { return e.id === id; })[0];
    // Nicht bei jedem Anmelden schreiben - nur wenn es etwas Neues gibt
    if (vorhanden && jetzt - (vorhanden.letzteSicht || 0) < 5 * 60 * 1000) return;

    SG.verwaltung.schreiben(function (d) {
      d.geraete = d.geraete || {};
      var liste = Array.isArray(d.geraete[k]) ? d.geraete[k] : [];
      var e = null;
      for (var i = 0; i < liste.length; i++) if (liste[i].id === id) e = liste[i];
      if (!e) {
        liste.push({ id: id, art: art, ersteSicht: jetzt, letzteSicht: jetzt });
      } else {
        e.letzteSicht = jetzt;
        e.art = art;
      }
      if (liste.length > 8) liste = liste.slice(-8);
      d.geraete[k] = liste;
    });
  };

  /* ------------------------------------------------------------------
     Freizeichnen

     Ein zweites Geraet heisst nicht immer, dass etwas faul ist - jemand
     spielt eben auch am Rechner der Eltern. Damit der Dienst so einen
     Fall nicht ewig als Alarm mitschleppt, kann er ihn abhaken.

     Abgehakt wird der Stand von JETZT: die Kennungen der Geraete, die
     zu diesem Zeitpunkt bekannt sind. Taucht spaeter ein weiteres auf,
     springt die Ampel wieder auf Rot - sonst waere ein einmal
     freigezeichneter Code fuer immer blind.
     ------------------------------------------------------------------ */

  A.geklaert = function (code) {
    var g = (V().geklaert || {})[A.normieren(code)];
    return g || null;
  };

  A.freizeichnen = function (code, notiz) {
    var k = A.normieren(code);
    var ids = A.geraete(k).map(function (e) { return e.id; });
    SG.verwaltung.schreiben(function (d) {
      d.geklaert = d.geklaert || {};
      d.geklaert[k] = {
        von: (A.aktuell && A.aktuell.name) || 'BND',
        t: Date.now(),
        notiz: String(notiz || ''),
        geraete: ids,
      };
    });
    return A.geklaert(k);
  };

  A.freizeichnungAufheben = function (code) {
    var k = A.normieren(code);
    SG.verwaltung.schreiben(function (d) {
      d.geklaert = d.geklaert || {};
      delete d.geklaert[k];
    });
  };

  /* Deckt die Freizeichnung noch alle Geraete ab? */
  function abgedeckt(code) {
    var g = A.geklaert(code);
    if (!g) return false;
    var bekannt = g.geraete || [];
    return A.geraete(code).every(function (e) { return bekannt.indexOf(e.id) >= 0; });
  }
  A.abgedeckt = abgedeckt;

  /* Wie sicher sieht ein Code aus? Der BND zeigt das als Ampel. */
  A.lageBewerten = function (code) {
    var k = A.normieren(code);
    if (A.gebannt(k)) {
      return { stufe: 'gesperrt', text: 'Gesperrt', farbe: 'rot' };
    }
    var g = A.geraete(k);
    if (g.length > 1 && abgedeckt(k)) {
      return { stufe: 'geklaert', text: 'Geprüft', farbe: 'gruen' };
    }
    if (g.length > 2) {
      return { stufe: 'streuung', text: g.length + ' Geräte', farbe: 'rot' };
    }
    if (g.length === 2) {
      return { stufe: 'zweitgeraet', text: 'Zweites Gerät', farbe: 'rot' };
    }
    if (!g.length) return { stufe: 'unbekannt', text: 'Nie gesehen', farbe: 'grau' };
    return { stufe: 'sicher', text: 'Unauffällig', farbe: 'gruen' };
  };

  /* Alle Codes, bei denen etwas nicht stimmt und noch nichts getan
     wurde - das ist die Zahl am BND-Knopf.

     Ein gesperrter Zugang zaehlt bewusst NICHT mehr dazu: der Fall ist
     erledigt. Sonst bliebe die Zahl fuer immer stehen, und eine Zahl,
     die nie auf null geht, sieht man nach zwei Tagen nicht mehr an.
     Im Lagebild steht er weiterhin rot, und unter Admin -> Sperren
     laesst er sich aufheben. */
  A.auffaellige = function () {
    var out = [];
    A.liste().forEach(function (p) {
      if (A.gebannt(p.code)) return;
      var l = A.lageBewerten(p.code);
      if (l.farbe === 'rot') out.push({ code: p.code, name: p.name, lage: l });
    });
    return out;
  };
})(SG);
