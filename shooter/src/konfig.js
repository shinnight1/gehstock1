/* ------------------------------------------------------------------
   Gehstock Ops - alle Spielwerte an einer Stelle.

   Wer das Spielgefuehl aendern will, dreht hier und nirgends sonst:
   Bewegung, Leben, Matchregeln, Waffen und Bot-Stufen. Die Simulation
   liest nur diese Tabellen, die Darstellung nur die Anzeige-Werte
   (Namen, Zoom, Modelltyp).

   Einheiten: Meter, Sekunden, Grad (nur hier in der Tabelle - die
   Simulation rechnet intern in Bogenmass).
   ------------------------------------------------------------------ */

/* Fester Simulationsschritt. Bewegung, Feuerrate und Bots rechnen
   immer in diesen Schritten, egal wie schnell das Geraet zeichnet. */
export const TICK = 1 / 60;

export const FIGUR = {
  radius: 0.32,            // halbe Breite der Kollisionsbox
  hoehe: 1.8,
  hoeheGeduckt: 1.2,
  auge: 1.62,
  augeGeduckt: 1.04,
  tempo: {
    gehen: 4.8,
    sprint: 7.0,
    geduckt: 2.5,
    visier: 2.8,           // volles Visier, dazwischen wird gemischt
  },
  beschleunigung: 52,      // m/s^2 am Boden bis zum Zieltempo
  bremsen: 44,             // m/s^2 ohne Eingabe
  luftSteuerung: 9,        // m/s^2 in der Luft
  schwerkraft: 21,
  sprungTempo: 7.5,        // ergibt rund 1,28 m: reicht fuer Kisten und Sandsaecke
  maxFall: 30,
  stufe: 0.45,             // so hoch steigt man ohne Springen
  duckTempo: 8,            // Anteil pro Sekunde fuer den Blickhoehen-Wechsel
  rutschen: {
    start: 9.4,            // Anfangstempo
    ende: 3.4,             // Tempo am Ende
    dauer: 0.72,
    pause: 0.9,            // bis zum naechsten Rutschen
    lenkung: 1.6,          // wie stark man waehrend des Rutschens lenkt (rad/s)
  },
};

export const LEBEN = {
  max: 100,
  regenPause: 4.0,         // so lange ohne Treffer, bis es heilt
  regenRate: 38,           // Punkte pro Sekunde
};

export const MATCH = {
  dauer: 300,              // fuenf Minuten
  zielPunkte: 30,
  vorlauf: 3,              // Countdown vor dem Start
  respawn: 3.2,
  spawnSchutz: 2.5,        // endet frueher, sobald man schiesst
  endePause: 2.2,          // "Match vorbei" bis zur Auswertung
  assistFenster: 6,        // Schaden aus den letzten Sekunden zaehlt als Hilfe
  assistMindestens: 25,
};

/* Teams: 0 = Blau (Spieler plus zwei Bots), 1 = Rot (drei Bots). */
export const TEAMS = [
  { name: 'Blau', farbe: '#3b82f6', farbeHell: '#7fb2ff' },
  { name: 'Rot', farbe: '#ef4444', farbeHell: '#ff8a80' },
];

export const NAMEN = {
  verbuendete: ['Adler', 'Dachs'],
  gegner: ['Kobra', 'Wolf', 'Fuchs'],
};

/* ------------------------------------------------------------------
   Waffen

   schaden       pro Treffer (Schrot: pro Kugel) bis reichweite.voll,
                 danach linear bis reichweite.min auf schadenMin
   rpm           Schuss pro Minute
   streuung      halber Kegelwinkel in Grad
   rueckstoss    Grad pro Schuss; erholung in Grad pro Sekunde
   visier        zoom = Faktor auf das Sichtfeld, zeit = bis voll im Visier,
                 tempo = Faktor auf das Lauftempo im vollen Visier
   halbautomatisch  ein Schuss je Druck auf den Abzug (sonst Dauerfeuer)
   zielfernrohr  im vollen Visier zeigt das Bild das Fernrohr statt der Waffe
   zielAnteil    so genau schiesst ein Mensch, sobald er zielt (Standard 0,9)
   ------------------------------------------------------------------ */
export const WAFFEN = {
  sturmgewehr: {
    id: 'sturmgewehr',
    name: 'Sturmgewehr',
    kurzname: 'Sturmgewehr',
    modell: 'K7 „Falke“',
    kurz: 'Allround, präzise auf Distanz',
    schaden: 26,
    schadenMin: 20,
    reichweite: { voll: 28, min: 50, max: 160 },
    kopf: 1.5,
    bein: 0.9,
    kugeln: 1,
    rpm: 620,
    magazin: 30,
    reserve: 150,
    nachladen: 2.0,
    nachladenLeer: 2.5,
    streuung: { hueft: 3.0, visier: 0.18, bewegung: 1.8, luft: 4.5, bloom: 0.34, bloomVisier: 0.07, bloomMax: 2.4, bloomAbbau: 7 },
    rueckstoss: { hoch: 0.6, seite: 0.28, visierFaktor: 0.62, erholung: 10, max: 5 },
    visier: { zoom: 0.72, zeit: 0.22, tempo: 0.55 },
    tempo: 0.96,
    sprintAus: 0.16,
    lautstaerke: 1.0,
    hoerweite: 38,
    // Anzeige im Menue, 0 bis 1
    werte: { schaden: 0.62, feuerrate: 0.62, reichweite: 0.85, kontrolle: 0.72 },
  },
  mp: {
    id: 'mp',
    name: 'Maschinenpistole',
    kurzname: 'MP',
    modell: 'MP9 „Wiesel“',
    kurz: 'Schnell, stark auf kurze Distanz',
    schaden: 22,
    schadenMin: 15,
    reichweite: { voll: 12, min: 30, max: 120 },
    kopf: 1.35,
    bein: 0.9,
    kugeln: 1,
    rpm: 860,
    magazin: 32,
    reserve: 192,
    nachladen: 1.7,
    nachladenLeer: 2.1,
    streuung: { hueft: 2.3, visier: 0.42, bewegung: 0.8, luft: 3.0, bloom: 0.24, bloomVisier: 0.1, bloomMax: 2.4, bloomAbbau: 8 },
    rueckstoss: { hoch: 0.44, seite: 0.42, visierFaktor: 0.7, erholung: 12, max: 4 },
    visier: { zoom: 0.82, zeit: 0.16, tempo: 0.7 },
    tempo: 1.06,
    sprintAus: 0.1,
    lautstaerke: 0.8,
    hoerweite: 30,
    werte: { schaden: 0.5, feuerrate: 0.9, reichweite: 0.45, kontrolle: 0.62 },
  },
  schrotflinte: {
    id: 'schrotflinte',
    name: 'Schrotflinte',
    kurzname: 'Schrot',
    modell: 'SF12 „Keiler“',
    kurz: 'Ein Schuss aus der Nähe genügt',
    schaden: 17,
    schadenMin: 4,
    reichweite: { voll: 6, min: 20, max: 60 },
    kopf: 1.0,
    bein: 1.0,
    kugeln: 9,
    rpm: 72,
    magazin: 7,
    reserve: 35,
    /* Schrot wird Patrone fuer Patrone geladen und laesst sich durch
       einen Schuss unterbrechen. */
    einzelnLaden: { start: 0.38, patrone: 0.5, ende: 0.32 },
    streuung: { hueft: 5.2, visier: 3.6, bewegung: 0.6, luft: 1.5, bloom: 0, bloomVisier: 0, bloomMax: 0, bloomAbbau: 1 },
    rueckstoss: { hoch: 3.4, seite: 0.9, visierFaktor: 0.8, erholung: 14, max: 7 },
    visier: { zoom: 0.9, zeit: 0.2, tempo: 0.7 },
    tempo: 1.0,
    sprintAus: 0.14,
    lautstaerke: 1.2,
    hoerweite: 42,
    werte: { schaden: 0.98, feuerrate: 0.15, reichweite: 0.2, kontrolle: 0.4 },
  },
  mg: {
    id: 'mg',
    name: 'Maschinengewehr',
    kurzname: 'MG',
    modell: 'MG5 „Bär“',
    kurz: 'Großes Magazin, hält lange drauf',
    schaden: 24,
    schadenMin: 19,
    reichweite: { voll: 26, min: 55, max: 160 },
    kopf: 1.4,
    bein: 0.9,
    kugeln: 1,
    rpm: 700,
    magazin: 75,
    reserve: 225,
    nachladen: 4.2,
    nachladenLeer: 4.8,
    streuung: { hueft: 4.2, visier: 0.3, bewegung: 2.2, luft: 5.5, bloom: 0.2, bloomVisier: 0.05, bloomMax: 2.8, bloomAbbau: 6 },
    rueckstoss: { hoch: 0.5, seite: 0.36, visierFaktor: 0.6, erholung: 9, max: 5 },
    visier: { zoom: 0.7, zeit: 0.34, tempo: 0.45 },
    tempo: 0.88,
    sprintAus: 0.28,
    lautstaerke: 1.1,
    hoerweite: 42,
    werte: { schaden: 0.6, feuerrate: 0.7, reichweite: 0.8, kontrolle: 0.5 },
  },
  praezision: {
    id: 'praezision',
    name: 'Präzisionsgewehr',
    kurzname: 'Präzision',
    modell: 'PG8 „Habicht“',
    kurz: 'Halbautomatisch, drei Treffer genügen',
    schaden: 42,
    schadenMin: 36,
    reichweite: { voll: 40, min: 80, max: 190 },
    kopf: 1.6,
    bein: 0.85,
    kugeln: 1,
    rpm: 320,
    halbautomatisch: true,
    magazin: 15,
    reserve: 75,
    nachladen: 2.3,
    nachladenLeer: 2.8,
    streuung: { hueft: 4.0, visier: 0.06, bewegung: 2.0, luft: 5.0, bloom: 0.7, bloomVisier: 0.12, bloomMax: 2.5, bloomAbbau: 7 },
    rueckstoss: { hoch: 1.5, seite: 0.3, visierFaktor: 0.6, erholung: 11, max: 5 },
    visier: { zoom: 0.52, zeit: 0.27, tempo: 0.55 },
    tempo: 0.94,
    sprintAus: 0.2,
    lautstaerke: 1.15,
    hoerweite: 45,
    werte: { schaden: 0.78, feuerrate: 0.35, reichweite: 0.95, kontrolle: 0.7 },
  },
  scharfschuetze: {
    id: 'scharfschuetze',
    name: 'Scharfschützengewehr',
    kurzname: 'Scharfschütze',
    modell: 'SSG3 „Bussard“',
    kurz: 'Ein Treffer am Oberkörper genügt',
    schaden: 100,
    schadenMin: 80,
    reichweite: { voll: 60, min: 110, max: 220 },
    kopf: 1.5,
    bein: 0.7,
    kugeln: 1,
    rpm: 46,
    halbautomatisch: true,
    magazin: 5,
    reserve: 25,
    nachladen: 2.9,
    nachladenLeer: 3.4,
    streuung: { hueft: 7.5, visier: 0.02, bewegung: 3.5, luft: 9, bloom: 0, bloomVisier: 0, bloomMax: 0, bloomAbbau: 1 },
    rueckstoss: { hoch: 4.2, seite: 0.6, visierFaktor: 0.7, erholung: 9, max: 7 },
    visier: { zoom: 0.3, zeit: 0.4, tempo: 0.4 },
    zielfernrohr: true,
    zielAnteil: 0.4,        // Visierfeuer trifft erst mit angelegtem Fernrohr genau
    repetierer: true,       // nach jedem Schuss den Kammerstengel ziehen (Klang, Bild)
    tempo: 0.9,
    sprintAus: 0.3,
    lautstaerke: 1.35,
    hoerweite: 60,
    werte: { schaden: 1.0, feuerrate: 0.06, reichweite: 1.0, kontrolle: 0.35 },
  },
  pistole: {
    id: 'pistole',
    name: 'Pistole',
    kurzname: 'Pistole',
    modell: 'P8 „Spatz“',
    kurz: 'Leicht und schnell, schnell im Ziel',
    schaden: 34,
    schadenMin: 22,
    reichweite: { voll: 10, min: 28, max: 100 },
    kopf: 1.6,
    bein: 0.9,
    kugeln: 1,
    rpm: 420,
    halbautomatisch: true,
    magazin: 12,
    reserve: 84,
    nachladen: 1.3,
    nachladenLeer: 1.6,
    streuung: { hueft: 1.9, visier: 0.35, bewegung: 0.6, luft: 2.5, bloom: 0.5, bloomVisier: 0.2, bloomMax: 2.2, bloomAbbau: 9 },
    rueckstoss: { hoch: 1.1, seite: 0.35, visierFaktor: 0.7, erholung: 14, max: 4 },
    visier: { zoom: 0.86, zeit: 0.12, tempo: 0.8 },
    tempo: 1.1,
    sprintAus: 0.06,
    lautstaerke: 0.7,
    hoerweite: 26,
    werte: { schaden: 0.52, feuerrate: 0.55, reichweite: 0.35, kontrolle: 0.8 },
  },
};

/* Reihenfolge in Menue, HUD und Protokoll (Tasten 1 bis 7). Neue Waffen
   nur hinten anhaengen: die Stelle ist ihre Nummer im Netz. */
export const WAFFEN_REIHE = ['sturmgewehr', 'mp', 'schrotflinte', 'mg', 'praezision', 'scharfschuetze', 'pistole'];

/* So oft greifen Bots zu einer Waffe (Anteile, Summe egal). */
export const BOT_WAFFEN = {
  sturmgewehr: 24, mp: 20, schrotflinte: 12, mg: 13, praezision: 12, scharfschuetze: 8, pistole: 11,
};

/* ------------------------------------------------------------------
   Bot-Stufen

   reaktion      Sekunden von "sehe dich" bis zum ersten Schuss (von-bis)
   zielFehler    Anfangsfehler in Grad, baut sich mit fehlerZeit ab
   drehRate      Grad pro Sekunde, schneller dreht kein Bot
   feuerWinkel   ab dieser Abweichung (Grad) wird geschossen
   streuung      Faktor auf die Waffenstreuung
   ausgleich     wie viel vom eigenen Rueckstoss der Bot gegensteuert
   jagd          Anteil der Bots, die gezielt nach Gegnern suchen, statt
                 einen Weg abzulaufen (sie ahnen ungefaehr, wo jemand ist)
   ------------------------------------------------------------------ */
export const BOT_STUFEN = {
  leicht: {
    id: 'leicht', name: 'Rekrut', kurz: 'Langsam und ungenau',
    reaktion: [0.6, 0.95], zielFehler: 7, fehlerZeit: 1.0, bewegungsFehler: 1.4,
    drehRate: 150, sichtFeld: 100, sichtWeite: 38, feuerWinkel: 6,
    salve: [2, 4], salvePause: [0.4, 0.8], kopfAnteil: 0.04, streuung: 1.7,
    strafen: 0.35, ducken: 0.05, hoeren: 18, ausgleich: 0.35, jagd: 0.15,
  },
  normal: {
    id: 'normal', name: 'Soldat', kurz: 'Ausgewogen',
    reaktion: [0.38, 0.62], zielFehler: 4.5, fehlerZeit: 0.65, bewegungsFehler: 1.0,
    drehRate: 240, sichtFeld: 120, sichtWeite: 55, feuerWinkel: 4.5,
    salve: [3, 6], salvePause: [0.25, 0.55], kopfAnteil: 0.12, streuung: 1.3,
    strafen: 0.65, ducken: 0.12, hoeren: 26, ausgleich: 0.65, jagd: 0.3,
  },
  schwer: {
    id: 'schwer', name: 'Veteran', kurz: 'Schnell und treffsicher',
    reaktion: [0.24, 0.42], zielFehler: 3, fehlerZeit: 0.45, bewegungsFehler: 0.7,
    drehRate: 360, sichtFeld: 140, sichtWeite: 75, feuerWinkel: 3.2,
    salve: [4, 9], salvePause: [0.15, 0.35], kopfAnteil: 0.22, streuung: 1.05,
    strafen: 0.9, ducken: 0.2, hoeren: 34, ausgleich: 0.85, jagd: 0.45,
  },
};

export const BOT_REIHE = ['leicht', 'normal', 'schwer'];

/* Wie weit Bots ihre Waffe sinnvoll einsetzen (Meter). */
export const BOT_REICHWEITE = {
  sturmgewehr: { wunsch: [12, 30], feuer: 70 },
  mp: { wunsch: [5, 14], feuer: 36 },
  schrotflinte: { wunsch: [2, 7], feuer: 15 },
  mg: { wunsch: [10, 28], feuer: 65 },
  praezision: { wunsch: [14, 36], feuer: 80 },
  scharfschuetze: { wunsch: [18, 45], feuer: 95 },
  pistole: { wunsch: [4, 12], feuer: 30 },
};

/* ------------------------------------------------------------------
   Darstellung: Qualitaetsstufen
   ------------------------------------------------------------------ */
export const QUALITAET = {
  // pixelTouch: Obergrenze auf Touch-Geraeten. Das iPad hat Pixeldichte 2 -
  // voll aufgeloest mit Kantenglaettung waeren das ueber 100 MB Bildspeicher.
  niedrig: { name: 'Niedrig', pixel: 1.0, pixelTouch: 1.0, schatten: 0, kantenglaettung: false, effekte: 0.5, sichtweite: 110 },
  mittel: { name: 'Mittel', pixel: 1.35, pixelTouch: 1.25, schatten: 1024, kantenglaettung: false, effekte: 1, sichtweite: 140 },
  hoch: { name: 'Hoch', pixel: 2.0, pixelTouch: 1.5, schatten: 2048, kantenglaettung: true, effekte: 1, sichtweite: 160 },
};

export const QUALITAET_REIHE = ['niedrig', 'mittel', 'hoch'];
