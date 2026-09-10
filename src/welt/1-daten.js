/* ------------------------------------------------------------------
   W-Places - 2000 x 2000 Pixel-Fläche und Farben

   Eine riesige, weiße 2000x2000 Pixel-Leinwand, auf der alle gemeinsam
   zeichnen können (à la r/place). Zweihundert Pixel gibt es jeden Tag
   geschenkt; wer mehr möchte, tauscht seine Website-XP ein.
   ------------------------------------------------------------------ */

(function (SG) {
  var D = (SG.welt = SG.welt || {}).daten = {};

  /* Auflösung der Zeichenfläche: 2000 x 2000 Pixel = 4.000.000 Felder */
  D.BREITE = 2000;
  D.HOEHE = 2000;

  D.TAGESPIXEL = 200;          // 200 Gratis-Pixel pro Tag
  D.SPEICHER_DECKEL = 60000;   // so viele bemalte Felder hält das Relais im Cache

  /* Was ein Nachkauf kostet. Stufe/Rang sinken beim Kauf nicht! */
  D.PAKETE = [
    { pixel: 50, xp: 40, name: 'Kleiner Farbtopf' },
    { pixel: 200, xp: 140, name: 'Eimer' },
    { pixel: 1000, xp: 620, name: 'Fass' },
    { pixel: 5000, xp: 2800, name: 'Tanklaster' },
  ];

  /* ---------------------------------------------------------- Farben */

  /* 32 lebendige Farben + Radierer (Farbe 0 setzt das Feld auf Weiß zurück) */
  D.PALETTE = [
    { id: 0, hex: '#ffffff', name: 'Radieren (Weiß)' },
    { id: 1, hex: '#000000', name: 'Schwarz' },
    { id: 2, hex: '#3c3c3c', name: 'Dunkelgrau' },
    { id: 3, hex: '#787878', name: 'Grau' },
    { id: 4, hex: '#d2d2d2', name: 'Hellgrau' },
    { id: 5, hex: '#ffffff', name: 'Weiß' },
    { id: 6, hex: '#600018', name: 'Weinrot' },
    { id: 7, hex: '#a50e1e', name: 'Dunkelrot' },
    { id: 8, hex: '#ed1c24', name: 'Rot' },
    { id: 9, hex: '#fa8072', name: 'Lachs' },
    { id: 10, hex: '#e45c1a', name: 'Orange' },
    { id: 11, hex: '#ff7f27', name: 'Hellorange' },
    { id: 12, hex: '#f6aa09', name: 'Bernstein' },
    { id: 13, hex: '#f9dd3b', name: 'Gelb' },
    { id: 14, hex: '#fffabc', name: 'Hellgelb' },
    { id: 15, hex: '#0eb968', name: 'Grün' },
    { id: 16, hex: '#13e67b', name: 'Hellgrün' },
    { id: 17, hex: '#87ff5e', name: 'Giftgrün' },
    { id: 18, hex: '#0c816e', name: 'Dunkelgrün' },
    { id: 19, hex: '#10aea6', name: 'Petrol' },
    { id: 20, hex: '#13e1be', name: 'Türkis' },
    { id: 21, hex: '#28509e', name: 'Dunkelblau' },
    { id: 22, hex: '#4093e4', name: 'Blau' },
    { id: 23, hex: '#60f7f2', name: 'Hellblau' },
    { id: 24, hex: '#6b50f6', name: 'Indigo' },
    { id: 25, hex: '#99b1fb', name: 'Flieder' },
    { id: 26, hex: '#780c99', name: 'Violett' },
    { id: 27, hex: '#aa38b9', name: 'Lila' },
    { id: 28, hex: '#e09ff9', name: 'Rosa' },
    { id: 29, hex: '#cb007a', name: 'Magenta' },
    { id: 30, hex: '#ec1f80', name: 'Pink' },
    { id: 31, hex: '#684634', name: 'Braun' },
    { id: 32, hex: '#dba463', name: 'Beige' },
  ];

  D.farbe = function (id) {
    for (var i = 0; i < D.PALETTE.length; i++) {
      if (D.PALETTE[i].id === id) return D.PALETTE[i];
    }
    return null;
  };

  /* ---------------------------------------------------------- Orientierungspunkte */

  D.ORTE = [
    { name: 'Zentrum', x: 1000, y: 1000 },
    { name: 'Oben Links', x: 150, y: 150 },
    { name: 'Oben Rechts', x: 1850, y: 150 },
    { name: 'Unten Links', x: 150, y: 1850 },
    { name: 'Unten Rechts', x: 1850, y: 1850 },
    { name: 'Nordpol', x: 1000, y: 200 },
    { name: 'Südpol', x: 1000, y: 1800 },
  ];

  /* ---------------------------------------------------------- Umrechnen */

  /* Feldnummer <-> Koordinate */
  D.nummer = function (x, y) { return y * D.BREITE + x; };
  D.zuX = function (n) { return n % D.BREITE; };
  D.zuY = function (n) { return Math.floor(n / D.BREITE); };

  /* Formatierung für die Fußzeile */
  D.ortText = function (x, y) {
    return 'X: ' + Math.floor(x) + '  Y: ' + Math.floor(y);
  };
})(SG);
