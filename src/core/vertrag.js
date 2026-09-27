/* ------------------------------------------------------------------
   Der Vertrag GS-CEO-01.

   Die UEbergabe der Geschaeftsfuehrung von Lucas Hunke an Louis
   Siebrecht, dazu der Vorsitz im Aufsichtsrat. Er liegt hier im
   Quelltext und nicht als Datei daneben: so ist er auch in der
   Offline-Einzeldatei da, braucht keinen Betrachter und keine
   Verbindung.

   Zu sehen ist er im Admin-Menue unter Sitzung - und dieser Reiter
   steht nur dem Owner und dem Aufsichtsrat offen.

   Was hier steht, ist der Wortlaut. Was der Vertrag technisch
   verlangt, steckt in core/auth.js (Rolle Aufsichtsrat, geschwaerzte
   Codes) und in core/credits.js (Impressum).
   ------------------------------------------------------------------ */

(function (SG) {
  var UI = SG.ui;
  var U = SG.util;

  var Vt = SG.vertrag = {};

  Vt.KENNUNG = 'GS-CEO-01';
  Vt.FASSUNG = '1.0';
  Vt.TITEL = 'Vertrag über die Übertragung der Geschäftsführung';
  Vt.SITZ = 'Dorf hinter den Chicken Nuggets';

  Vt.PARTEIEN = [
    { rolle: 'Übergebende Partei', name: 'Lucas Hunke',
      text: 'Gründer der Website, Vorsitzender des Aufsichtsrats, '
        + 'im Vertrag „der Vorsitzende“.' },
    { rolle: 'Übernehmende Partei', name: 'Louis Siebrecht',
      text: 'Chief Executive Officer der Website, im Vertrag „der CEO“.' },
  ];

  /* Die Rangordnung aus Anlage A */
  Vt.KETTE = [
    { ebene: 'Ebene 1', name: 'Aufsichtsrat', icon: '⚖️',
      text: 'Vorsitz: Lucas Hunke · Vollzugriff · Vetorecht' },
    { ebene: 'Ebene 2', name: 'CEO', icon: '👑',
      text: 'Louis Siebrecht · operative Leitung · Owner-Rechte' },
    { ebene: 'Ebene 3', name: 'Admins', icon: '🛡',
      text: 'Verwaltung, Moderation und technische Pflege' },
    { ebene: 'Ebene 4', name: 'Innerer Kreis', icon: '🔑',
      text: 'Erweiterte Rechte im engeren Kreis der Leitung' },
    { ebene: 'Ebene 5', name: 'Member', icon: '🎮',
      text: 'Basisrechte und Zugang zur Website' },
    { ebene: 'Bedingt', name: 'BND', icon: '🕵',
      text: 'Externe Partei · verwaltet Member nur bei Verdacht oder '
        + 'laufendem Fall' },
  ];

  /* Der Wortlaut, Paragraph fuer Paragraph */
  Vt.PARAGRAPHEN = [
    { nr: '§ 1', titel: 'Begriffsbestimmungen', absaetze: [
      'Website: die unter dem Namen GehStock betriebene Website mit allen '
        + 'Unterseiten, Inhalten, Daten und Zugängen.',
      'Owner-Rechte: die vollständige technische Verfügungsgewalt über die '
        + 'Website, einschließlich aller Verwaltungszugänge.',
      'CEO: die Person, die die Website operativ leitet.',
      'Aufsichtsrat: das Kontrollgremium der Website. Vorsitzender ist der '
        + 'Übergebende.',
      'Admin: Rolle der Ebene 3 mit Rechten zur Verwaltung, Moderation und '
        + 'technischen Pflege.',
      'Inner Circle: Rolle der Ebene 4 mit erweiterten Rechten im engeren '
        + 'Kreis der Leitung.',
      'Member: registrierter Nutzer der Website ohne weitergehende Rechte.',
      'Veto: die Untersagung einer Entscheidung oder eines Vorhabens des CEO '
        + 'durch den Vorsitzenden.',
      'Verdacht oder Fall: ein dokumentierter Anfangsverdacht oder ein '
        + 'laufendes Verfahren des BND gegen einen Member.',
    ] },
    { nr: '§ 2', titel: 'Vertragsgegenstand', absaetze: [
      'Gegenstand dieses Vertrages ist die Website GehStock mit allen '
        + 'zugehörigen Zugängen, Konten, Daten und Verwaltungsrechten.',
      'Geregelt werden die Übertragung der Owner-Rechte, die Aufnahme von '
        + 'Lucas Hunke in den Aufsichtsrat, die Rechte und Pflichten beider '
        + 'Parteien und der Ausschluss seiner Verantwortlichkeit für den '
        + 'Betrieb der Website.',
    ] },
    { nr: '§ 3', titel: 'Übertragung der Owner-Rechte', absaetze: [
      'Lucas Hunke überträgt mit Wirkung zum Tag der Unterzeichnung sämtliche '
        + 'Owner-Rechte an der Website GehStock auf Louis Siebrecht.',
      'Louis Siebrecht führt ab diesem Zeitpunkt den Titel Chief Executive '
        + 'Officer und leitet die Website im Rahmen dieses Vertrages '
        + 'eigenverantwortlich.',
      'Die Übertragung erfolgt vollständig, freiwillig und ohne Gegenleistung.',
      'Der Umfang der Übergabe ergibt sich aus Anlage B. Das Protokoll ist von '
        + 'beiden Parteien zu bestätigen.',
    ] },
    { nr: '§ 4', titel: 'Aufsichtsrat und Vorsitz', absaetze: [
      'Die Einhaltung dieses Vertrages wird vom Aufsichtsrat überwacht. Der '
        + 'Aufsichtsrat hat seinen Sitz im Dorf hinter den Chicken Nuggets und '
        + 'tritt auf Antrag einer der beiden Parteien zusammen.',
      'Lucas Hunke wird mit Wirkung zum Tag der Unterzeichnung als '
        + 'Vorsitzender in den Aufsichtsrat aufgenommen.',
      'Der Vorsitz ist unbefristet und unwiderruflich. Er kann ihm weder '
        + 'entzogen noch gekündigt noch zeitlich begrenzt werden.',
      'Eine Herabstufung, Umbenennung oder inhaltliche Beschneidung des '
        + 'Vorsitzes ist ausgeschlossen. Das gilt auch für Umstrukturierungen '
        + 'des Aufsichtsrats, durch die die Stellung faktisch entwertet würde.',
    ] },
    { nr: '§ 5', titel: 'Vetorecht des Vorsitzenden', absaetze: [
      'Der Vorsitzende des Aufsichtsrats hat ein Vetorecht gegenüber allen '
        + 'Entscheidungen und Vorhaben des CEO.',
      'Die operative Leitung verbleibt beim CEO. Der Vorsitzende erteilt ihm '
        + 'keine Weisungen, kann ihm aber jede Maßnahme untersagen.',
      'Ein eingelegtes Veto ist für den CEO bindend. Die betroffene '
        + 'Entscheidung ist aufgehoben und darf ohne Zustimmung des '
        + 'Vorsitzenden weder umgesetzt noch in abgewandelter Form wiederholt '
        + 'werden.',
      'Das Veto ist an keine Frist, keine Form und keine Begründung gebunden.',
    ] },
    { nr: '§ 6', titel: 'Angaben im Impressum', absaetze: [
      'Ab dem Tag der Unterzeichnung sind die Ränge beider Parteien im '
        + 'Impressum der Website GehStock auszuweisen.',
      'Lucas Hunke wird dort als Vorsitzender des Aufsichtsrats '
        + '(Council Chairman) geführt. Die bisherige Angabe als '
        + 'Hauptdeveloper entfällt.',
      'Louis Siebrecht wird dort als Chief Executive Officer (CEO) geführt.',
      'Beide Angaben dürfen ohne Zustimmung des Vorsitzenden weder entfernt '
        + 'noch verändert noch an untergeordneter Stelle geführt werden.',
    ] },
    { nr: '§ 7', titel: 'Fortbestehende Zugriffs- und Änderungsrechte', absaetze: [
      'Lucas Hunke behält das uneingeschränkte Recht, Änderungen an der '
        + 'Website GehStock vorzunehmen.',
      'Dieses Recht umfasst Inhalte, Gestaltung, Struktur und technische '
        + 'Einstellungen und besteht unabhängig von der Zustimmung des CEO.',
      'Zugänge, Passwörter und Berechtigungen, die dieses Recht absichern, '
        + 'dürfen ihm nicht entzogen, gesperrt oder eingeschränkt werden.',
    ] },
    { nr: '§ 8', titel: 'Pflichten des CEO', absaetze: [
      'Der CEO sorgt für den laufenden Betrieb der Website, insbesondere für '
        + 'Wartung, Updates und regelmäßige Sicherungen.',
      'Sicherungen sind mindestens wöchentlich anzulegen und getrennt vom '
        + 'laufenden System aufzubewahren.',
      'Der CEO ist für den Aufsichtsrat erreichbar und antwortet in dringenden '
        + 'Fällen innerhalb von 48 Stunden.',
      'Neue Zugänge mit Owner- oder CEO-Rechten werden dem Vorsitzenden vorab '
        + 'angezeigt.',
    ] },
    { nr: '§ 9', titel: 'Letzte Anordnung des Übergebenden', absaetze: [
      'Mit der Übergabe ergeht die folgende letzte Anordnung des '
        + 'Übergebenden, die der CEO umzusetzen und dauerhaft aufrechtzuerhalten '
        + 'hat.',
      'Die Codes des Owners und des CEO, insbesondere Quellcode sowie Zugangs- '
        + 'und Verwaltungscodes, dürfen für die Admins nicht einsehbar sein. '
        + 'Der Zugriff bleibt auf Owner und CEO beschränkt; der Zugang des '
        + 'Vorsitzenden nach § 7 bleibt unberührt.',
      'Auf der Website wird eine eigene Rolle Aufsichtsrat eingerichtet und '
        + 'dauerhaft geführt. Sie steht in der Rangordnung über allen übrigen '
        + 'Rollen.',
      'Beide Anordnungen sind ab dem Tag der Unterzeichnung umzusetzen. Ein '
        + 'Verstoß gilt als Verstoß im Sinne des § 13.',
    ] },
    { nr: '§ 10', titel: 'Externe Partei', absaetze: [
      'Als externe Partei wird der BND anerkannt. Er ist nicht Teil der '
        + 'internen Rangordnung und untersteht weder dem CEO noch dem '
        + 'Aufsichtsrat.',
      'Der BND darf die Member der Website verwalten. Dieses Recht besteht '
        + 'ausschließlich dann, wenn gegen einen Member ein Verdacht oder ein '
        + 'laufender Fall vorliegt.',
      'Liegt kein Verdacht und kein laufender Fall vor, hat der BND weder '
        + 'Zugriff auf die Member noch sonstige Rechte an der Website.',
      'Über das Vorliegen eines Verdachts oder eines Falls ist der '
        + 'Aufsichtsrat zu unterrichten.',
    ] },
    { nr: '§ 11', titel: 'Vertraulichkeit', absaetze: [
      'Beide Parteien behandeln Zugangsdaten, interne Vorgänge und '
        + 'Entscheidungen des Aufsichtsrats vertraulich.',
      'Eine Weitergabe an Dritte ist unzulässig. Ausgenommen sind Auskünfte an '
        + 'den BND bei Verdacht oder laufendem Fall.',
      'Die Pflicht zur Vertraulichkeit besteht über das Ende der jeweiligen '
        + 'Rolle hinaus fort.',
    ] },
    { nr: '§ 12', titel: 'Ausschluss der Verantwortlichkeit', absaetze: [
      'Ab dem Tag der Unterzeichnung haftet Lucas Hunke nicht mehr für '
        + 'Serverausfälle, Downtime, Datenverluste, Fehlfunktionen oder '
        + 'sonstige technische und inhaltliche Probleme der Website.',
      'Er kann dafür weder verantwortlich gemacht noch in Anspruch genommen '
        + 'werden, unabhängig davon, wann die Ursache entstanden ist.',
      'Die Verantwortung für den laufenden Betrieb der Website liegt ab der '
        + 'Unterzeichnung vollständig beim CEO.',
    ] },
    { nr: '§ 13', titel: 'Verstoß, Abberufung und Wiedereintritt', absaetze: [
      'Verstößt der CEO gegen eine Bestimmung der § 4 bis § 11, gilt er mit '
        + 'sofortiger Wirkung als vom Aufsichtsrat abberufen und gekündigt.',
      'Die Abberufung bedarf weder einer Ankündigung noch einer Frist noch '
        + 'einer Begründung.',
      'Sämtliche Owner-Rechte an der Website GehStock fallen in diesem Fall '
        + 'ohne weitere Erklärung an Lucas Hunke zurück. Er tritt zugleich '
        + 'wieder als CEO in die Leitung der Website ein.',
      'Sein Vorsitz im Aufsichtsrat bleibt davon unberührt.',
    ] },
    { nr: '§ 14', titel: 'Verfahren vor dem Aufsichtsrat', absaetze: [
      'Jede Partei kann den Aufsichtsrat anrufen. Der Antrag ist formlos '
        + 'möglich.',
      'Der Aufsichtsrat hört den CEO an und entscheidet innerhalb von sieben '
        + 'Tagen nach Eingang des Antrags.',
      'Die Entscheidung des Aufsichtsrats ist endgültig und für beide Parteien '
        + 'bindend.',
    ] },
    { nr: '§ 15', titel: 'Inaktivität und Nachfolge', absaetze: [
      'Reagiert der CEO 30 Tage nicht auf Anfragen des Aufsichtsrats und führt '
        + 'er die Website in dieser Zeit nicht, gilt er als inaktiv.',
      'Mit der Feststellung der Inaktivität durch den Aufsichtsrat fallen die '
        + 'Owner-Rechte an Lucas Hunke zurück. § 13 Absatz 3 gilt entsprechend.',
      'Scheidet der CEO freiwillig aus, benennt der Aufsichtsrat den '
        + 'Nachfolger.',
      'Der Vorsitz im Aufsichtsrat ist nicht übertragbar. Der Vorsitzende '
        + 'benennt seinen Nachfolger selbst.',
    ] },
    { nr: '§ 16', titel: 'Schlussbestimmungen', absaetze: [
      'Änderungen und Ergänzungen dieses Vertrages bedürfen der Zustimmung '
        + 'beider Parteien in Textform.',
      'Die Anlagen A und B sind Bestandteil dieses Vertrages.',
      'Sollte eine Bestimmung dieses Vertrages unwirksam sein, bleibt der '
        + 'übrige Vertrag davon unberührt.',
      'Der Vertrag tritt mit der Unterzeichnung durch beide Parteien in Kraft '
        + 'und gilt unbefristet.',
    ] },
  ];

  /* Anlage B: was uebergeben wird. Die drei Zeilen, die diese Seite
     selbst betreffen, tragen einen Vermerk - sie sind erledigt. */
  Vt.UEBERGABE = [
    { nr: '01', was: 'Domain und DNS' },
    { nr: '02', was: 'Hosting und Server' },
    { nr: '03', was: 'Datenbank' },
    { nr: '04', was: 'Admin-Panel und Backend' },
    { nr: '05', was: 'Quellcode und Repository' },
    { nr: '06', was: 'Zugangsdaten und Passwörter' },
    { nr: '07', was: 'E-Mail-Postfächer' },
    { nr: '08', was: 'Discord-Server' },
    { nr: '09', was: 'Social-Media-Accounts' },
    { nr: '10', was: 'Sicherungen und Backups' },
    { nr: '11', was: 'Impressum aktualisiert (§ 6)', inSeite: true },
    { nr: '12', was: 'Rolle Aufsichtsrat eingerichtet (§ 9)', inSeite: true },
    { nr: '13', was: 'Codes vor Admins abgeschirmt (§ 9)', inSeite: true },
  ];

  /* ------------------------------------------------------------------
     Anzeige

     Ein langer Text in einem Dialog wird schnell unleserlich. Deshalb
     drei Reiter: der Wortlaut, die Rangordnung und das
     UEbergabeprotokoll.
     ------------------------------------------------------------------ */

  Vt.oeffnen = function (reiter) {
    var A = SG.auth;
    /* Derselbe Riegel wie am Reiter Sitzung - sonst haenge der Vertrag
       nur an der Oberflaeche und nicht an der Rolle. */
    if (!A.binOwner() && !A.binAufsicht()) return;
    reiter = reiter || 'text';

    var body = UI.el('div');
    var inhalt = UI.el('div');

    body.appendChild(UI.tabs([
      { id: 'text', label: '📜 Wortlaut' },
      { id: 'kette', label: '⚖️ Rangordnung' },
      { id: 'anlage', label: '✔ Übergabe' },
    ], function (id) {
      reiter = id;
      UI.clear(inhalt);
      bauen(inhalt);
    }, reiter));
    body.appendChild(inhalt);
    bauen(inhalt);

    UI.modal({ title: 'Vertrag ' + Vt.KENNUNG, body: body, wide: true });

    function bauen(ziel) {
      if (reiter === 'kette') kette(ziel);
      else if (reiter === 'anlage') anlage(ziel);
      else wortlaut(ziel);
    }

    function kopf(ziel) {
      ziel.appendChild(UI.el('p.small.muted.center', {
        text: 'Dokument ' + Vt.KENNUNG + ' · Fassung ' + Vt.FASSUNG,
      }));
    }

    function wortlaut(ziel) {
      kopf(ziel);
      ziel.appendChild(UI.el('div.notice', {
        html: '<b>' + U.esc(Vt.TITEL) + '</b><br>Übergabe der Owner-Rechte an '
          + 'der Website GehStock.',
      }));

      Vt.PARTEIEN.forEach(function (p) {
        ziel.appendChild(UI.el('div.item', null, [
          UI.el('div.main', null, [
            UI.el('div.t', { text: p.name }),
            UI.el('div.d', { text: p.rolle + ' · ' + p.text }),
          ]),
        ]));
      });

      ziel.appendChild(UI.el('div.sec-head', null, [
        UI.el('h2', { text: 'Präambel' }),
      ]));
      ziel.appendChild(UI.el('p.small.muted', {
        text: 'Die Website GehStock wurde von Lucas Hunke aufgebaut und bis '
          + 'heute von ihm geführt. Mit dieser Vereinbarung geht die operative '
          + 'Leitung auf Louis Siebrecht über. Lucas Hunke wechselt zugleich in '
          + 'den Aufsichtsrat und übernimmt dort den Vorsitz.',
      }));

      Vt.PARAGRAPHEN.forEach(function (p) {
        ziel.appendChild(UI.el('div.sec-head', null, [
          UI.el('h2', { text: p.nr + '  ·  ' + p.titel }),
        ]));
        p.absaetze.forEach(function (t, i) {
          ziel.appendChild(UI.el('p.small.muted', {
            style: { marginTop: i ? '6px' : '0' },
            html: '<b>(' + (i + 1) + ')</b> ' + U.esc(t),
          }));
        });
      });

      ziel.appendChild(UI.el('div.sec-head', null, [
        UI.el('h2', { text: 'Sitz des Aufsichtsrats' }),
      ]));
      ziel.appendChild(UI.el('p.small.muted', { text: Vt.SITZ }));
    }

    function kette(ziel) {
      kopf(ziel);
      ziel.appendChild(UI.el('div.notice', {
        html: '<b>Anlage A · Chain of Command</b><br>Der Aufsichtsrat steht '
          + 'außerhalb der operativen Kette: voller Zugriff auf alle Ebenen und '
          + 'ein Veto gegen jede Entscheidung des CEO. Weisungen laufen von '
          + 'oben nach unten, vom CEO über die Admins und den inneren Kreis bis '
          + 'zu den Membern.',
      }));
      Vt.KETTE.forEach(function (e) {
        ziel.appendChild(UI.el('div.item', null, [
          UI.el('div.thumb', { text: e.icon }),
          UI.el('div.main', null, [
            UI.el('div.t', { text: e.name }),
            UI.el('div.d', { text: e.text }),
          ]),
          UI.el('div.side', null, [UI.el('div.s', { text: e.ebene })]),
        ]));
      });
    }

    function anlage(ziel) {
      kopf(ziel);
      ziel.appendChild(UI.el('div.notice', {
        html: '<b>Anlage B · Übergabeprotokoll</b><br>Jede Zeile wird von '
          + 'beiden Parteien bestätigt. Die drei Punkte mit Haken betreffen '
          + 'diese Seite und sind hier umgesetzt.',
      }));
      Vt.UEBERGABE.forEach(function (e) {
        ziel.appendChild(UI.el('div.item', null, [
          UI.el('div.thumb', { text: e.inSeite ? '✔' : '·' }),
          UI.el('div.main', null, [
            UI.el('div.t', { text: e.was }),
            UI.el('div.d', {
              text: e.inSeite ? 'In dieser Seite umgesetzt' : 'Nr. ' + e.nr,
            }),
          ]),
        ]));
      });
    }
  };
})(SG);
