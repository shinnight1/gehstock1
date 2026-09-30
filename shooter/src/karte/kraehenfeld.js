/* ------------------------------------------------------------------
   Karte "Uebungsgelaende Kraehenfeld"

   Eine ummauerte Trainingsanlage, 64 x 44 m. Westen Basis Blau, Osten
   Basis Rot. Dazwischen drei Wege, die mehrfach verbunden sind:

     A  Containerhof (Norden)  lange Sichtlinien, versetzte Container,
                               dahinter der schmale Nordgang als Flanke
     B  Appellplatz (Mitte)    offener Platz mit erhoehtem Leitstand,
                               zwei LKW-Wracks, Betonsperren
     C  Werkhalle (Sueden)     enger Innenraum mit Pfeilern, Regalen,
                               Kisten - Schrotflinten-Gebiet

   Verbindungen: zwei Luecken in der Trennmauer A/B (x = +-12,7), zwei
   Hallentueren B/C (x = +-8,3), Fenster in der Hallenwand (nur Sicht),
   der Vorplatz vor den Hallentoren und die Basen selbst.

   Grosse Anlagen sind spiegelgleich zur Achse x = 0 (beide Teams haben
   denselben Containerhof im Norden). Die Wracks auf dem Platz sind
   punktgleich gesetzt: jedes Team hat eines rechts vor sich.

   Hoehen: Sandsaecke 1,1 (stehend schiesst man darueber, geduckt ist
   man gedeckt), Betonsperren 0,9, Kisten 1,2, Hesco-Waende 2,2,
   Container 2,6, Mauern 3,2 bis 5.
   ------------------------------------------------------------------ */

import { KartenBauer } from './bauer.js';

/* Blickrichtungen (yaw) - fuer Spawns und fuer die Seite, in die ein
   Schild zeigt. yaw 0 schaut nach Norden (-Z). */
const NACH_OST = -Math.PI / 2;
const NACH_WEST = Math.PI / 2;
const NACH_NORD = 0;
const NACH_SUED = Math.PI;

const FARBEN = {
  orange: { grund: '#b4643a' },
  gruen: { grund: '#56703f' },
  grau: { grund: '#6d7b83' },
  sand: { grund: '#a8915f' },
  petrol: { grund: '#3f6b6c' },
  blauBasis: { grund: '#3a4f73' },
  rotBasis: { grund: '#78403b' },
};

export function kraehenfeld() {
  const k = new KartenBauer('Übungsgelände Krähenfeld');
  k.id = 'kraehenfeld';
  k.grenzen = { minX: -32, maxX: 32, minZ: -22, maxZ: 22 };

  /* ---------------------------------------------------- Boden, Mauer */

  // Ein einziger Kollisionsboden; gezeichnet werden die Flaechen unten.
  k.q(-60, -50, 60, 50, 1, 'unsichtbar', { y: -1 });

  k.q(-33, -23, 33, -22, 4.2, 'mauer');
  k.q(-33, 22, 33, 23, 4.2, 'mauer');
  k.q(-33, -22, -32, 22, 4.2, 'mauer');
  k.q(32, -22, 33, 22, 4.2, 'mauer');

  k.bodenflaeche(-32, -22, -22, 22, 'kies');
  k.bodenflaeche(22, -22, 32, 22, 'kies');
  k.bodenflaeche(-22, -22, 22, -8.6, 'asphalt');
  k.bodenflaeche(-22, -8.6, 22, 8.6, 'platten');
  k.bodenflaeche(-16, 8.6, 16, 22, 'estrich');
  k.bodenflaeche(-22, 8.6, -16, 22, 'kies');
  k.bodenflaeche(16, 8.6, 22, 22, 'kies');

  k.bereich('Basis Blau', -32, -22, -22, 22);
  k.bereich('Basis Rot', 22, -22, 32, 22);
  k.bereich('Containerhof', -22, -22, 22, -8.3);
  k.bereich('Leitstand', -4.5, -2.8, 4.5, 2.8);
  k.bereich('Appellplatz', -22, -8.3, 22, 8.6);
  k.bereich('Werkhalle', -16, 8.6, 16, 22);
  k.bereich('Hallenvorplatz', -22, 8.6, -16, 22);
  k.bereich('Hallenvorplatz', 16, 8.6, 22, 22);

  /* ---------------------------------------------------------- Basen */

  k.beide((s) => {
    const team = s < 0 ? 0 : 1;
    const x = (v) => v * s;

    // Hesco-Waende vor der Basis: brechen die Sichtlinien vom Platz
    // und vom Containerhof in die Spawns.
    k.q(x(22.1), -4.4, x(23.2), 4.4, 2.2, 'hesco');
    k.q(x(22.1), -16.5, x(23.2), -13.5, 2.2, 'hesco');
    // Sandsaecke als niedrige Deckung vor den aeusseren Spawns
    k.q(x(24.2), -14, x(25), -10, 1.1, 'sandsack');
    k.q(x(24.2), 10, x(25), 14, 1.1, 'sandsack');

    // Kommandocontainer an der Rueckwand
    k.q(x(29.6), -3, x(32), 3, 2.6, 'container', { farbe: s < 0 ? FARBEN.blauBasis.grund : FARBEN.rotBasis.grund });

    // Zelte in den Ecken
    k.q(x(28), -22, x(32), -18, 2.4, 'plane');
    k.q(x(28), 18, x(32), 22, 2.4, 'plane');
    k.deko.push({ typ: 'zeltdach', x0: x(28), x1: x(32), z0: -22, z1: -18, y: 2.4 });
    k.deko.push({ typ: 'zeltdach', x0: x(28), x1: x(32), z0: 18, z1: 22, y: 2.4 });

    // Nachschub an der Rueckwand
    k.kiste(x(31.3), -9, 1);
    k.kiste(x(31.3), -7.6, 2);
    k.kiste(x(31.3), 8.2, 1);
    k.fass(x(31.4), 12.5, '#445566');
    k.fass(x(31.4), 13.3, '#445566');

    k.deko.push({ typ: 'flagge', x: x(30.6), z: -12.6, team });
    k.deko.push({ typ: 'flagge', x: x(30.6), z: 12.6, team });
    k.deko.push({ typ: 'schild', text: team === 0 ? 'BASIS BLAU' : 'BASIS ROT', team,
      x: x(29.58), y: 1.7, z: 0, yaw: s < 0 ? NACH_OST : NACH_WEST, breite: 3.6, hoehe: 0.8 });
    k.deko.push({ typ: 'markierung', form: 'basis', team, x: x(27), z: 0 });

    const blick = s < 0 ? NACH_OST : NACH_WEST;
    k.spawn(team, x(28.5), -16, blick);
    k.spawn(team, x(27), -11.5, blick);
    k.spawn(team, x(28.5), -6.5, blick);
    k.spawn(team, x(26.5), 0, blick);
    k.spawn(team, x(28.5), 6.5, blick);
    k.spawn(team, x(27), 11.5, blick);
    k.spawn(team, x(28.5), 16, blick);
  });

  /* ------------------------------------------ Trennmauer Hof / Platz */

  k.beide((s) => {
    const x = (v) => v * s;
    k.q(x(14), -8.6, x(22), -8.0, 3.2, 'beton');
    k.q(x(3), -8.6, x(11.4), -8.0, 3.2, 'beton');
  });
  // In der Mitte nur brusthoch: man sieht und schiesst hinueber.
  k.q(-3, -8.6, 3, -8.0, 1.1, 'beton');
  k.deko.push({ typ: 'schild', text: 'A', x: 7.2, y: 1.9, z: -8.62, yaw: NACH_NORD, breite: 1.2, hoehe: 1.2, gross: true });
  k.deko.push({ typ: 'schild', text: 'A', x: -7.2, y: 1.9, z: -8.62, yaw: NACH_NORD, breite: 1.2, hoehe: 1.2, gross: true });

  /* ----------------------------------------------- A  Containerhof */

  // Mitte: ein Container an der Nordmauer und ein Doppelstapel davor
  k.container(0, -20.8, true, FARBEN.orange, 1);
  k.container(0, -13.8, false, { grund: FARBEN.grau.grund, oben: FARBEN.petrol.grund }, 2);

  k.beide((s) => {
    const x = (v) => v * s;
    // Flankencontainer: dahinter liegt der Nordgang
    k.container(x(15), -18.6, true, s < 0 ? FARBEN.gruen : FARBEN.sand, 1);
    // Versetzte Container im Hof
    k.container(x(7), -13.2, true, s < 0 ? FARBEN.petrol : FARBEN.orange, 1);
    // Kisten als niedrige Deckung
    k.kiste(x(15), -12.8, 1);
    k.kiste(x(7), -18.3, 1);
    k.kiste(x(20.2), -18.2, 2);
    k.fass(x(20.8), -20.9, '#5a6b3a');
    k.fass(x(20.1), -21.3, '#5a6b3a');
    k.fass(x(10.4), -21.2, '#7a3b2a');
  });
  k.deko.push({ typ: 'schild', text: 'CONTAINERHOF', x: 0, y: 1.4, z: -19.58, yaw: NACH_SUED, breite: 4.2, hoehe: 0.7 });
  k.deko.push({ typ: 'markierung', form: 'hof' });

  /* ------------------------------------------------ B  Appellplatz */

  // Leitstand: erhoehtes Podest mit Treppen nach Westen und Osten
  k.q(-3, -2.5, 3, 2.5, 1.0, 'beton');
  k.treppe(-4.5, -3, -1.25, 1.25, 1.0, 3, 'x+');
  k.treppe(3, 4.5, -1.25, 1.25, 1.0, 3, 'x-');
  k.q(-2.2, -2.5, 2.2, -1.9, 0.9, 'sandsack', { y: 1.0 });
  k.q(-2.2, 1.9, 2.2, 2.5, 0.9, 'sandsack', { y: 1.0 });
  for (const px of [-2.8, 2.8]) {
    for (const pz of [-2.3, 2.3]) k.m(px, pz, 0.2, 0.2, 2.4, 'metall', { y: 1.0 });
  }
  k.q(-3.3, -2.8, 3.3, 2.8, 0.2, 'dach', { y: 3.4 });
  k.deko.push({ typ: 'schild', text: 'B', x: 0, y: 0.52, z: 2.52, yaw: NACH_SUED, breite: 0.8, hoehe: 0.8, gross: true });
  k.deko.push({ typ: 'schild', text: 'B', x: 0, y: 0.52, z: -2.52, yaw: NACH_NORD, breite: 0.8, hoehe: 0.8, gross: true });
  k.deko.push({ typ: 'markierung', form: 'platz' });

  // Zwei LKW-Wracks, punktgleich
  for (const s of [-1, 1]) {
    const x = (v) => v * s;
    const z = (v) => v * s;
    k.q(x(-15), z(2.3), x(-8), z(4.5), 1.2, 'metall', { farbe: '#4b5236' });
    k.q(x(-15), z(2.2), x(-10.2), z(4.6), 1.9, 'plane', { y: 1.2 });
    k.q(x(-9.9), z(2.3), x(-8), z(4.5), 1.5, 'metall', { y: 1.2, farbe: '#566042' });
    k.deko.push({ typ: 'lkw', x: x(-11.5), z: z(3.4), richtung: s });
  }

  k.beide((s) => {
    const x = (v) => v * s;
    // Betonsperren
    k.q(x(18.7), -6.5, x(19.3), -3.5, 0.9, 'barriere');
    k.q(x(18.7), 3.5, x(19.3), 6.5, 0.9, 'barriere');
    // Sandsacknest an der Trennmauer
    k.q(x(5.3), -6.6, x(7.7), -5.8, 1.1, 'sandsack');
    // Flutlichtmasten
    k.m(x(20.6), -7.3, 0.34, 0.34, 8.5, 'metall');
    k.deko.push({ typ: 'flutlicht', x: x(20.6), z: -7.3, yaw: s < 0 ? -2.4 : 2.4 });
    k.m(x(20.6), 7.9, 0.34, 0.34, 8.5, 'metall');
    k.deko.push({ typ: 'flutlicht', x: x(20.6), z: 7.9, yaw: s < 0 ? -0.8 : 0.8 });
  });
  // Punktgleiche Sperren neben den Wracks
  k.q(-10, -4.8, -7, -4.2, 0.9, 'barriere');
  k.q(7, 4.2, 10, 4.8, 0.9, 'barriere');

  /* --------------------------------------------------- C  Werkhalle */

  const HALLE = 5.0;
  // Nordwand mit zwei Tueren und zwei Fenstern
  k.q(-1.4, 8.6, 1.4, 9.2, HALLE, 'halle');
  k.beide((s) => {
    const x = (v) => v * s;
    k.q(x(9.2), 8.6, x(16.6), 9.2, HALLE, 'halle');
    k.q(x(7.4), 8.6, x(9.2), 9.2, HALLE - 2.5, 'halle', { y: 2.5 });
    k.q(x(3.4), 8.6, x(7.4), 9.2, HALLE, 'halle');
    k.q(x(1.4), 8.6, x(3.4), 9.2, 1.1, 'halle');
    k.q(x(1.4), 8.6, x(3.4), 9.2, HALLE - 2.3, 'halle', { y: 2.3 });
    // Seitenwand mit Tor
    k.q(x(16), 9.2, x(16.6), 12.2, HALLE, 'halle');
    k.q(x(16), 17.8, x(16.6), 21.4, HALLE, 'halle');
    k.q(x(16), 12.2, x(16.6), 17.8, HALLE - 3.6, 'halle', { y: 3.6 });
    // Hesco vor dem Tor: keine Sichtlinie von Basis zu Basis
    k.q(x(19.2), 13.4, x(20.4), 16.6, 2.2, 'hesco');

    // Innen: Regalreihe, Pfeiler, Kisten
    k.q(x(4.5), 14.9, x(11.5), 15.9, 2.6, 'regal');
    k.m(x(4.5), 12, 0.6, 0.6, HALLE, 'beton');
    k.m(x(12.5), 12, 0.6, 0.6, HALLE, 'beton');
    k.m(x(8), 18.6, 0.6, 0.6, HALLE, 'beton');
    k.kiste(x(10.5), 13.5, 1);
    k.kiste(x(12.4), 20.2, 2, 1.6);
    k.kiste(x(3.5), 17.5, 1);
    k.kiste(x(14.9), 10.3, 1);
    k.fass(x(5.6), 20.8, '#8a6d2a');
    k.fass(x(6.3), 21.0, '#8a6d2a');

    // Vorplatz
    k.kiste(x(18.9), 10, 1);
    k.fass(x(21.2), 20.6, '#3f4d5c');
    k.fass(x(20.5), 21.1, '#3f4d5c');
    k.deko.push({ typ: 'schild', text: 'C', x: x(16.62), y: 4.3, z: 15, yaw: s < 0 ? NACH_WEST : NACH_OST, breite: 1.0, hoehe: 1.0, gross: true });
  });
  k.q(-16.6, 21.4, 16.6, 22, HALLE, 'halle');
  k.m(0, 18.6, 0.6, 0.6, HALLE, 'beton');
  k.kiste(0, 9.8, 2);
  k.deko.push({ typ: 'schild', text: 'WERKHALLE', x: 0, y: 3.9, z: 8.58, yaw: NACH_NORD, breite: 4.4, hoehe: 0.8 });
  k.deko.push({ typ: 'schild', text: 'C', x: 0, y: 2.6, z: 8.58, yaw: NACH_NORD, breite: 1.0, hoehe: 1.0, gross: true });
  // Offenes Dach: nur Traeger, die Sonne faellt in Streifen herein.
  for (let bx = -14; bx <= 14; bx += 4) k.q(bx - 0.14, 8.6, bx + 0.14, 22, 0.45, 'metall', { y: HALLE - 0.45, kollision: false });
  for (const bz of [12.4, 18.2]) k.q(-16.6, bz - 0.1, 16.6, bz + 0.1, 0.3, 'metall', { y: HALLE - 0.75, kollision: false });
  k.deko.push({ typ: 'hallenlampen', x0: -12, x1: 12, z: [12.4, 18.2], y: HALLE - 0.9 });
  k.deko.push({ typ: 'markierung', form: 'halle' });
  k.deko.push({ typ: 'zielscheiben', x0: -13, x1: 13, z: 21.36, anzahl: 7 });

  /* ------------------------------------------------ Umgebung (Deko) */

  k.deko.push({ typ: 'umgebung' });

  /* --------------------------------------------------------- Wege

     Drei Wege von West nach Ost, gleich viele Punkte an aehnlichen
     x-Stellen. Bots von Blau laufen vorwaerts, Rot rueckwaerts; an den
     Punkten 2 und 4 liegen Verbindungen, dort wechseln sie manchmal.  */
  k.wege.push({ name: 'A', punkte: [[-26.2, -12], [-19.5, -11.5], [-11, -15.8], [0, -18.2], [11, -15.8], [19.5, -11.5], [26.2, -12]] });
  k.wege.push({ name: 'B', punkte: [[-25.5, -6.5], [-19.5, -1.5], [-10, -1.5], [0, 0], [10, 1.5], [19.5, 1.5], [25.5, 6.5]] });
  k.wege.push({ name: 'C', punkte: [[-26, 10], [-18, 11.8], [-12.5, 14], [0, 13], [12.5, 14], [18, 11.8], [26, 10]] });

  return k.fertig();
}
