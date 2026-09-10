/* ------------------------------------------------------------------
   GehstockMon - Werte, Faehigkeiten, Gegner, Felder.

   Alles, was man zum Ausprobieren verstellen will, steht hier. Die
   Kampfregeln liegen in 2-kampf.js (ohne DOM, damit tools/test.mjs sie
   pruefen kann), die Oberflaeche in 3-ui.js.
   ------------------------------------------------------------------ */

(function (SG) {
  var R = SG.gehstockmon = SG.gehstockmon || {};
  var D = R.daten = {};

  /* Reihenfolge ist zugleich die Reihenfolge beim Weiterblaettern im
     Planeditor. '(keine Regel)' steht vorn, damit eine leere Zeile der
     Ausgangszustand ist und man sich nichts erst wegklicken muss. */
  D.BEDINGUNGEN = [
    { id: 'aus',            text: '(keine Regel)' },
    { id: 'immer',          text: 'immer' },
    { id: 'ich_schwach',    text: 'ich unter 40 %' },
    { id: 'freund_schwach', text: 'Verbündeter unter 40 %' },
    { id: 'feind_schwach',  text: 'Gegner unter 40 %' },
    { id: 'runde_1',        text: 'in Runde 1' },
    { id: 'ueberzahl',      text: 'Gegner in Überzahl' }
  ];

  D.AKTIONEN = [
    { id: 'vorderster',   text: 'vordersten Gegner angreifen' },
    { id: 'schwaechster', text: 'schwächsten Gegner angreifen' },
    { id: 'staerkster',   text: 'stärksten Gegner angreifen' },
    { id: 'faehigkeit',   text: 'Fähigkeit einsetzen' },
    { id: 'verteidigen',  text: 'verteidigen' }
  ];

  /* Vier Faehigkeiten, geteilt von beiden Seiten. Dass die Gegner
     dieselben Werkzeuge haben wie du, ist Absicht: sonst lernt man beim
     Lesen ihres Plans nichts ueber den eigenen. */
  D.FAEHIGKEITEN = {
    spott:      { name: 'Spott',      text: 'Zieht bis zum nächsten eigenen Zug alle Angriffe auf sich. Nur ein gezielter Schlag auf den Stärksten geht daran vorbei.' },
    hinrichten: { name: 'Hinrichten', text: 'Greift den schwächsten Gegner an. Doppelter Schaden, wenn der unter 40 % steht.' },
    flicken:    { name: 'Flicken',    text: 'Heilt dem am stärksten verletzten Verbündeten 32 Leben.' },
    stoeren:    { name: 'Stören',     text: 'Der stärkste Gegner richtet bei seinem nächsten Zug nur halben Schaden an.' }
  };

  /* Deine vier Kreaturen. mono ist der Platzhalter im Portraitfeld -
     sobald echte Bilder da sind, kommt statt dessen ein Emoji oder ein
     gezeichnetes Wappen hinein, der Aufbau bleibt gleich.

     Die Werte liegen absichtlich weit auseinander. Vier Kreaturen, die
     sich aehnlich spielen, machen jeden Plan austauschbar. */
  D.KREATUREN = [
    { id: 'bollwerk', name: 'Bollwerk', rolle: 'Wall',     mono: '🛡', hp: 130, ang:  8, tempo:  3, faeh: 'spott' },
    { id: 'klinge',   name: 'Klinge',   rolle: 'Schneide', mono: '⚔', hp:  62, ang: 23, tempo:  8, faeh: 'hinrichten' },
    { id: 'waerter',  name: 'Wärter',   rolle: 'Erhalt',   mono: '✚', hp:  86, ang:  7, tempo:  5, faeh: 'flicken' },
    { id: 'spaeher',  name: 'Späher',   rolle: 'Störung',  mono: '👁', hp:  70, ang: 13, tempo: 11, faeh: 'stoeren' }
  ];

  /* Startplan. Bewusst brauchbar, aber nicht optimal: Feld 1 gewinnt man
     damit, Feld 3 nicht mehr. Genau da soll das Basteln anfangen. */
  D.START_PLAN = {
    bollwerk: [ ['runde_1', 'faehigkeit'],        ['immer', 'vorderster'], ['aus', 'vorderster'] ],
    klinge:   [ ['feind_schwach', 'faehigkeit'],  ['immer', 'vorderster'], ['aus', 'vorderster'] ],
    waerter:  [ ['freund_schwach', 'faehigkeit'], ['immer', 'vorderster'], ['aus', 'vorderster'] ],
    spaeher:  [ ['immer', 'vorderster'],          ['aus', 'vorderster'],   ['aus', 'vorderster'] ]
  };

  D.SELTENHEITEN = [
    { name: 'Gewöhnlich', farbe: '#b8c5bc', rang: 1, text: 'Steinpanzer · geschnitzter Gehstock' },
    { name: 'Selten', farbe: '#50b8ff', rang: 2, text: 'Glutklingen · leuchtende Runen' },
    { name: 'Episch', farbe: '#c38bff', rang: 3, text: 'Kristallkrone · schwebende Magie' },
    { name: 'Legendär', farbe: '#ffca68', rang: 4, text: 'Goldrüstung · Drachenschwingen · Flammenaura' }
  ];
  D.KREATUREN.forEach(function (k, i) {
    k.seltenheit = i;
    k.bild = 'gm-' + k.id;
  });

  /* Die fuenf Felder. Jedes ist eine Aufgabe mit genau einer Lehre, und
     die Lehre steht im Klartext dabei - im Prototyp will man wissen,
     woran man gerade scheitert, nicht raten.

     Der gegnerische Plan liegt offen. Das ist der Kern des Spiels und
     keine Bequemlichkeit: du sollst seine Denkweise lesen, nicht seine
     Truppenstaerke. */
  D.FELDER = [
    {
      id: 1, name: 'Grenzstein',
      lehre: 'Der Kampf läuft ohne dich. Schau erst einmal zu.',
      feinde: [
        { name: 'Streuner', mono: '🐀', hp: 52, ang: 11, tempo: 6, faeh: 'stoeren',
          plan: [ ['immer', 'vorderster'] ] },
        { name: 'Streuner', mono: '🐀', hp: 52, ang: 11, tempo: 5, faeh: 'stoeren',
          plan: [ ['immer', 'vorderster'] ] }
      ]
    },
    {
      id: 2, name: 'Alte Furt',
      lehre: 'Zwei Pfleger halten die Reihe. Nimm sie zuerst heraus.',
      feinde: [
        { name: 'Balg',    mono: '🦎', hp: 120, ang: 19, tempo: 6, faeh: 'spott',
          plan: [ ['immer', 'vorderster'] ] },
        { name: 'Balg',    mono: '🦎', hp: 120, ang: 19, tempo: 5, faeh: 'spott',
          plan: [ ['immer', 'vorderster'] ] },
        { name: 'Pfleger', mono: '🌿', hp: 44, ang:  5, tempo: 7, faeh: 'flicken',
          plan: [ ['immer', 'faehigkeit'] ] },
        { name: 'Pfleger', mono: '🌿', hp: 44, ang:  5, tempo: 6, faeh: 'flicken',
          plan: [ ['immer', 'faehigkeit'] ] }
      ]
    },
    {
      id: 3, name: 'Schieferbruch',
      lehre: 'Einer schlägt härter als der Rest zusammen. Nimm ihm die Wucht.',
      feinde: [
        { name: 'Brecher',  mono: '🏹', hp: 105, ang: 46, tempo: 10, faeh: 'hinrichten',
          plan: [ ['immer', 'schwaechster'] ] },
        { name: 'Splitter', mono: '🪨', hp:  46, ang: 13, tempo:  8, faeh: 'hinrichten',
          plan: [ ['immer', 'schwaechster'] ] },
        { name: 'Splitter', mono: '🪨', hp:  46, ang: 13, tempo:  7, faeh: 'hinrichten',
          plan: [ ['immer', 'schwaechster'] ] }
      ]
    },
    {
      id: 4, name: 'Nebelsenke',
      lehre: 'Ihr Wall fängt alles ab. Schlag nach dem, was dahinter steht.',
      feinde: [
        { name: 'Bastion', mono: '🗿', hp: 230, ang:  6, tempo: 4, faeh: 'spott',
          plan: [ ['immer', 'faehigkeit'] ] },
        { name: 'Dorn',    mono: '🌵', hp:  58, ang: 24, tempo: 9, faeh: 'hinrichten',
          plan: [ ['feind_schwach', 'faehigkeit'], ['immer', 'schwaechster'] ] },
        { name: 'Dorn',    mono: '🌵', hp:  58, ang: 22, tempo: 8, faeh: 'hinrichten',
          plan: [ ['immer', 'schwaechster'] ] }
      ]
    },
    {
      id: 5, name: 'Der Horst',
      lehre: 'Ihr Plan steht offen da. Lies ihn, bevor du angreifst.',
      feinde: [
        { name: 'Warte',   mono: '🏚', hp:  84, ang: 12, tempo:  4, faeh: 'spott',
          plan: [ ['runde_1', 'faehigkeit'], ['ich_schwach', 'verteidigen'], ['immer', 'vorderster'] ] },
        { name: 'Sichel',  mono: '🦂', hp:  42, ang: 31, tempo: 12, faeh: 'hinrichten',
          plan: [ ['feind_schwach', 'faehigkeit'], ['immer', 'schwaechster'] ] },
        { name: 'Ätzer',   mono: '🦟', hp:  46, ang: 20, tempo: 10, faeh: 'stoeren',
          plan: [ ['runde_1', 'faehigkeit'], ['immer', 'staerkster'] ] },
        { name: 'Pfleger', mono: '🌿', hp:  35, ang:  7, tempo:  7, faeh: 'flicken',
          plan: [ ['freund_schwach', 'faehigkeit'], ['immer', 'vorderster'] ] }
      ]
    }
  ];
})(SG);
