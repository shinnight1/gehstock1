/* Zugangsdaten werden ausschließlich auf dem Server geprüft. */
(function (SG) {
  var U = SG.util, A = SG.auth = {}, STELLEN = 4, sitzung = null;
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
    var text = String(eingabe || ''); return /^u[a-f0-9]{16}$/.test(text) ? text : text.replace(/\D/g, '').slice(0, STELLEN);
  };

  A.schoen = function (code) { return A.normieren(code); };

  A.stellen = STELLEN;

  A.headers = function () { return sitzung ? { 'Content-Type': 'application/json', Authorization: 'Bearer ' + sitzung } : { 'Content-Type': 'application/json' }; };
  A.verbunden = function () { return !!sitzung; };
  async function server(op, data) {
    if (SG.offline || SG.env.file) throw new Error('Zum Anmelden brauchst du eine Internetverbindung.');
    var ctrl = new AbortController(), timer = setTimeout(function () { ctrl.abort(); }, 12000);
    try {
      var res = await fetch('/api/auth', { method: 'POST', headers: A.headers(), cache: 'no-store', signal: ctrl.signal, body: JSON.stringify(Object.assign({}, data || {}, { op: op })) });
      var result = await res.json();
      if (!res.ok) { var error = new Error(result.error || 'Anmeldung fehlgeschlagen.'); error.status = res.status; throw error; }
      return result;
    } catch (error) { if (error.status) throw error; throw new Error('Der Anmeldeserver ist nicht erreichbar. Bitte versuche es erneut.'); }
    finally { clearTimeout(timer); }
  }
  // Bekannte Profile dienen nur der Anzeige; daraus entsteht keine Sitzung.
  A.profil = function (code) { return A.aktuell && A.aktuell.code === code ? A.aktuell : A.liste().find(function (p) { return p.code === code; }) || null; };
  A.erzeugen = async function (rolle, name) { var result = await server('create', { role: rolle, name: name }); SG.verwaltung.sitzung(result.verw); return result.code; };
  A.bndPruefen = function (value) { return server('bnd-check', { value: value }); };


  /* ------------------------------------------------------------------
     Angemeldete Person

     Der Speicher wird pro Code getrennt. Damit hat jeder seinen eigenen
     Fortschritt, ohne dass sich zwei Leute auf einem iPad in die Quere
     kommen.
     ------------------------------------------------------------------ */

  var SITZUNG = 'auth:sitzung';   // alter Schluessel - wird nur noch geraeumt

  A.aktuell = null;               // { code, rolle, name }

  A.anmelden = async function (code, name) {
    var result = await server('login', { code: A.normieren(code), device: SG.relais && SG.relais.geraet });
    sitzung = result.token;
    SG.verwaltung.sitzung(result.verw);
    var geprueft = result.profile;
    var eintrag = {
      code: geprueft.code,
      rolle: geprueft.rolle,
      name: name || geprueft.name || A.nameVon(geprueft.code) || '',
      kennung: geprueft.kennung,
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
    if (sitzung) server('logout').catch(function () {});
    sitzung = null;
    if (SG.verwaltung) SG.verwaltung.sitzung(null);
    A.aktuell = null;
    ['auth:namen', 'auth:ausgegeben', 'verwaltung'].forEach(SG.storage.globalDel);
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
    ['auth:namen', 'auth:ausgegeben', 'verwaltung'].forEach(SG.storage.globalDel);
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
    /* Beim Anmelden ist noch niemand da, der etwas duerfen muesste -
       da traegt sich jemand selbst ein. Einen fremden Namen aendert
       dagegen nur, wer auch sonst an diesen Code heranreicht. */
    if (A.aktuell && A.aktuell.code !== k && !A.darfGegen(k)) return false;
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
      var g = A.profil(k);
      if (g) A.merken(k, name, g.rolle);
    }
    if (A.aktuell && A.aktuell.code === A.normieren(code)) {
      A.aktuell.name = name;
      SG.storage.globalSet(SITZUNG, A.aktuell);
    }
    return true;
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
    if (!A.darfGegen(code)) return A.liste();
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
    if (!A.darfGegen(code)) return;
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
    if (!A.darfGegen(k)) return A.hatBnd(k);
    SG.verwaltung.schreiben(function (d) {
      d.bnd = d.bnd || [];
      var i = d.bnd.indexOf(k);
      if (an && i < 0) d.bnd.push(k);
      if (!an && i >= 0) d.bnd.splice(i, 1);
    });
    return A.hatBnd(k);
  };

  A.bndKennung = function (code) { var p = A.profil(code); return p && p.kennung || '—'; };
  A.bndSchluessel = async function (code) { return (await server('bnd-key', { code: code })).value; };

  /* ------------------------------------------------------------------
     Owner und der Schutz unter Admins

     Ein Admin darf viel - aber nichts gegen einen anderen Admin. Sonst
     sperrt einer den anderen aus und steht danach allein da. Ueber allen
     steht der Owner: an den kommt niemand heran, auch kein Admin.

     Wer Owner ist, steht in der Verwaltung und gilt damit auf jedem
     Geraet. Solange niemand eingetragen ist, kann der erste Admin die
     Rolle uebernehmen; danach gibt nur der Owner selbst sie weiter.
     ------------------------------------------------------------------ */

  A.owner = function () { return A.normieren(V().owner || ''); };

  A.istOwner = function (code) {
    var o = A.owner();
    return !!o && o === A.normieren(code);
  };

  A.binOwner = function () { return !!(A.aktuell && A.istOwner(A.aktuell.code)); };

  A.ownerFrei = function () { return !A.owner(); };

  /* Owner werden oder die Rolle weitergeben. Beides geht nur an einen
     Admin - ein Spieler koennte mit der Rolle nichts anfangen und waere
     nur unangreifbar. */
  A.ownerSetzen = function (code) {
    var k = A.normieren(code);
    var g = A.profil(k);
    if (!g || g.rolle !== A.ADMIN) return false;
    if (!A.ownerFrei() && !A.binOwner()) return false;
    SG.verwaltung.schreiben(function (d) { d.owner = k; });
    return true;
  };

  /* Die eine Frage, an der alles haengt: darf der Angemeldete gegen
     diesen Code vorgehen? Sperren, loeschen, umbenennen, Freigaben
     entziehen - alles laeuft hierueber. */
  A.darfGegen = function (code) {
    var k = A.normieren(code);
    if (!A.aktuell) return false;
    if (A.aktuell.code === k) return true;        // gegen sich selbst immer
    if (!A.istAdmin()) return false;
    if (A.istOwner(k)) return false;              // an den Owner kommt niemand
    if (A.binOwner()) return true;                // der Owner an jeden anderen
    var g = A.profil(k);
    return !(g && g.rolle === A.ADMIN);           // Admin gegen Admin: nein
  };

  /* Ein Satz, den die Oberflaeche anzeigen kann, wenn es nicht geht. */
  A.schutzGrund = function (code) {
    var k = A.normieren(code);
    if (A.darfGegen(k)) return '';
    if (A.istOwner(k)) return 'Das ist der Owner. An den kommt niemand heran.';
    var g = A.profil(k);
    if (g && g.rolle === A.ADMIN) {
      return 'Admins können einander nichts anhaben. Nur der Owner darf das.';
    }
    return 'Dafür fehlen dir die Rechte.';
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
    if (!A.darfGegen(k)) return null;
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
