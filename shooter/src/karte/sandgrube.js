/* ------------------------------------------------------------------
   Karte "Wuestenposten Sandgrube"

   Ein Aussenposten in der Wueste, 68 x 46 m, mit Mauer und Draht.
   Westen Lager Blau, Osten Lager Rot. Drei Wege:

     A  Pipeline (Norden)   zwei grosse Tanks, Pumpenhaus, Rohre am
                            Boden (ueberspringbar) und in der Hoehe
     B  Ruinen (Mitte)      zerfallene Lehmhaeuser, halbhohe Mauern,
                            ein Torbogen - viele Winkel, kurze Wege
     C  Bunker (Sueden)     Betonbunker mit Gaengen und drei Eingaengen

   Spiegelgleich zur Achse x = 0. Hoehen: Rohre 0,9, Sandsaecke 1,1,
   Ruinenmauern 1,2 bis 3,4, Bunker 3,2, Tanks 6.
   ------------------------------------------------------------------ */

import { KartenBauer } from './bauer.js';

const NACH_OST = -Math.PI / 2;
const NACH_WEST = Math.PI / 2;
const NACH_NORD = 0;

const TANK = '#c8c2b4';
const ROHR = '#8a8f86';

export function sandgrube() {
  const k = new KartenBauer('Wüstenposten Sandgrube');
  k.id = 'sandgrube';
  k.grenzen = { minX: -34, maxX: 34, minZ: -23, maxZ: 23 };
  k.thema = {
    himmelOben: '#4f86c8', horizont: '#e4d8c0', himmelUnten: '#b9a684',
    nebelNah: 46,
    licht: '#f4ecdc', lichtBoden: '#a08a64', lichtStaerke: 2.1,
    sonne: '#fff2d8', sonnenStaerke: 2.8, sonnenRichtung: [20, 62, 24],
    baeume: 'keine', tuerme: true, draht: true, huegel: '#c6ad86',
  };

  /* ------------------------------------------------- Boden, Mauer */

  k.q(-60, -50, 60, 50, 1, 'unsichtbar', { y: -1 });
  const MAUER = { farbe: '#d6c6a6' };
  k.q(-35, -24, 35, -23, 4.2, 'mauer', MAUER);
  k.q(-35, 23, 35, 24, 4.2, 'mauer', MAUER);
  k.q(-35, -23, -34, 23, 4.2, 'mauer', MAUER);
  k.q(34, -23, 35, 23, 4.2, 'mauer', MAUER);

  k.bodenflaeche(-34, -23, 34, 23, 'sand');
  k.bodenflaeche(-25, -2.2, 25, 2.2, 'asphalt', 0.006);
  k.bodenflaeche(-12, 10.6, 12, 21.6, 'estrich', 0.006);

  k.bereich('Lager Blau', -34, -23, -25, 23);
  k.bereich('Lager Rot', 25, -23, 34, 23);
  k.bereich('Pipeline', -25, -23, 25, -9);
  k.bereich('Ruinen', -25, -9, 25, 9);
  k.bereich('Bunker', -12.5, 10, 12.5, 22);
  k.bereich('Sandsackstellung', -25, 9, -12.5, 23);
  k.bereich('Sandsackstellung', 12.5, 9, 25, 23);

  /* ---------------------------------------------------------- Lager */

  k.beide((s) => {
    const team = s < 0 ? 0 : 1;
    const x = (v) => v * s;
    const blick = s < 0 ? NACH_OST : NACH_WEST;

    // Zelte in den Ecken, Kommandocontainer, Hesco vor den Spawns
    k.q(x(29), -23, x(34), -18.5, 2.4, 'plane', { farbe: '#c8b890' });
    k.q(x(29), 18.5, x(34), 23, 2.4, 'plane', { farbe: '#c8b890' });
    k.deko.push({ typ: 'zeltdach', x0: x(29), x1: x(34), z0: -23, z1: -18.5, y: 2.4, farbe: '#d8c8a0' });
    k.deko.push({ typ: 'zeltdach', x0: x(29), x1: x(34), z0: 18.5, z1: 23, y: 2.4, farbe: '#d8c8a0' });
    k.q(x(31.6), -3, x(34), 3, 2.6, 'container', { farbe: team === 0 ? '#3a4f73' : '#78403b' });
    k.q(x(24.2), -13, x(25.4), -9.6, 2.2, 'hesco');
    k.q(x(24.2), 9.6, x(25.4), 13, 2.2, 'hesco');
    k.q(x(25.6), -5, x(26.4), -2.6, 1.1, 'sandsack');
    k.q(x(25.6), 2.6, x(26.4), 5, 1.1, 'sandsack');
    k.kiste(x(33.2), -9.4, 2);
    k.kiste(x(33.2), 8.6, 1);
    k.fass(x(33.3), 12.8, '#5a6b3a');
    k.fass(x(33.3), 13.6, '#5a6b3a');

    k.deko.push({ typ: 'flagge', x: x(30.8), z: -12, team });
    k.deko.push({ typ: 'flagge', x: x(30.8), z: 12, team });
    k.deko.push({ typ: 'schild', text: team === 0 ? 'LAGER BLAU' : 'LAGER ROT', team,
      x: x(31.58), y: 1.7, z: 0, yaw: s < 0 ? NACH_OST : NACH_WEST, breite: 3.4, hoehe: 0.8 });
    k.deko.push({ typ: 'markierung', form: 'basis', team, x: x(28), linie: 24.9, pfeil: 28.4, z0: -21, z1: 21 });

    k.spawn(team, x(29.5), -16, blick);
    k.spawn(team, x(28.5), -11, blick);
    k.spawn(team, x(29.5), -6.5, blick);
    k.spawn(team, x(28.5), 0, blick);
    k.spawn(team, x(29.5), 6.5, blick);
    k.spawn(team, x(28.5), 11, blick);
    k.spawn(team, x(29.5), 16, blick);
  });

  /* ------------------------------------------------- A  Pipeline */

  // Pumpenhaus in der Mitte mit Durchgang
  k.wandX(-3, 3, -18.4, 0.4, 3.2, 'beton', [[-1, 1, 0, 2.3]]);
  k.wandX(-3, 3, -13.6, 0.4, 3.2, 'beton', [[-1, 1, 0, 2.3]]);
  k.wandZ(-18.2, -13.8, -2.8, 0.4, 3.2, 'beton', [[-16.8, -15.2, 1.1, 2.1]]);
  k.wandZ(-18.2, -13.8, 2.8, 0.4, 3.2, 'beton', [[-16.8, -15.2, 1.1, 2.1]]);
  k.q(-3.2, -18.8, 3.2, -13.2, 0.25, 'dach', { y: 3.2, kollision: false });
  k.bodenflaeche(-2.6, -18.2, 2.6, -13.8, 'estrich', 0.012);
  k.deko.push({ typ: 'schild', text: 'PUMPE 1', x: 0, y: 2.75, z: -13.38, yaw: Math.PI, breite: 1.8, hoehe: 0.5 });

  k.beide((s) => {
    const x = (v) => v * s;
    // Tanks
    k.zylinder(x(11), -17.5, 3.1, 6, TANK);
    k.m(x(11), -17.5, 0.2, 0.2, 7.6, 'metall', { kollision: false });
    // Rohr am Boden (man springt darueber), mit Luecken als Durchgang
    k.rohr(x(4.5), -10.6, x(9), -10.6, 0.45, 0.45, ROHR);
    k.rohr(x(12.5), -10.6, x(20.5), -10.6, 0.45, 0.45, ROHR);
    // Hochrohr vom Tank zum Pumpenhaus (man laeuft darunter durch)
    k.rohr(x(3), -16, x(7.8), -16, 0.35, 3.4, ROHR);
    for (const px of [4.5, 6.5]) k.m(x(px), -16, 0.25, 0.25, 3.05, 'metall', { farbe: '#5c6166' });
    // Deckung
    k.q(x(17.4), -20.4, x(18.2), -17, 1.1, 'sandsack');
    k.kiste(x(21.5), -15.5, 1);
    k.kiste(x(21.5), -14.3, 2);
    k.fass(x(6.4), -21.6, '#6a5a3a');
    k.fass(x(7.1), -21.9, '#6a5a3a');
    k.q(x(15.4), -13.4, x(16.2), -11.8, 0.9, 'barriere');
  });

  /* ---------------------------------------------------- B  Ruinen */

  k.beide((s) => {
    const x = (v) => v * s;
    const a = (u, v) => [Math.min(x(u), x(v)), Math.max(x(u), x(v))];
    const L = { farbe: s < 0 ? '#f4ece0' : '#f0e6d8' };
    // Grosse Ruine: zwei Raeume, Mauern verschieden hoch
    const [r0, r1] = a(6, 13);
    k.wandX(r0, r1, -6.8, 0.5, 3.4, 'lehm', [[...a(8.4, 9.8), 0, 2.2]], L);
    k.wandX(r0, r1, -1.2, 0.5, 1.4, 'lehm', [[...a(10.6, 12), 0, 1.4]], L);
    k.wandZ(-6.6, -1.4, x(6.2), 0.5, 2.6, 'lehm', [[-4.6, -3.2, 0, 2.2]], L);
    k.wandZ(-6.6, -1.4, x(12.8), 0.5, 3.0, 'lehm', [[-5.2, -3.8, 1.0, 2.0]], L);
    k.q(x(9.3), -6.6, x(9.7), -3.6, 2.4, 'lehm', L);
    k.bodenflaeche(Math.min(x(6.4), x(12.6)), -6.6, Math.max(x(6.4), x(12.6)), -1.4, 'estrich', 0.012);
    // Kleine Ruine und Mauerreste im Sueden
    k.wandX(...a(15.5, 21), 4.6, 0.5, 2.4, 'lehm', [[...a(17.6, 19), 0, 2.2]], L);
    k.wandZ(4.8, 8.6, x(15.7), 0.5, 1.8, 'lehm', [], L);
    k.q(x(8), 5.6, x(11.5), 6.1, 1.2, 'lehm', L);
    k.q(x(19.5), -7.6, x(20.1), -4.4, 1.6, 'lehm', L);
    // Sandsaecke, Wrack, Kisten
    k.q(x(3.6), 4, x(5.6), 4.8, 1.1, 'sandsack');
    k.kiste(x(16.6), -1.8, 1);
    k.q(x(21.8), -1.2, x(23.8), 1.6, 1.3, 'metall', { farbe: '#c4b898' });
    k.q(x(22.1), -0.9, x(23.5), 1.3, 0.7, 'metall', { y: 1.3, farbe: '#aca488' });
  });
  // Torbogen in der Mitte
  k.m(-1.9, 0, 0.8, 0.8, 3.4, 'lehm');
  k.m(1.9, 0, 0.8, 0.8, 3.4, 'lehm');
  k.q(-2.3, -0.4, 2.3, 0.4, 0.8, 'lehm', { y: 3.4 });
  k.deko.push({ typ: 'schild', text: 'B', x: 0, y: 2.6, z: -0.42, yaw: NACH_NORD, breite: 0.8, hoehe: 0.8, gross: true });

  /* ---------------------------------------------------- C  Bunker */

  const H = 3.2;
  // Aussenwaende: Eingaenge im Norden (zwei) und an beiden Enden
  k.wandX(-12, 12, 10.8, 0.6, H, 'beton', [[-8, -6, 0, 2.3], [6, 8, 0, 2.3], [-2.5, -0.5, 1.2, 1.8], [0.5, 2.5, 1.2, 1.8]]);
  k.wandX(-12, 12, 21.4, 0.6, H, 'beton', []);
  k.wandZ(11.1, 21.1, -11.7, 0.6, H, 'beton', [[14.6, 16.6, 0, 2.3]]);
  k.wandZ(11.1, 21.1, 11.7, 0.6, H, 'beton', [[14.6, 16.6, 0, 2.3]]);
  // Innen: Mittelgang mit Raeumen
  k.wandX(-9, -3, 17.2, 0.4, H, 'beton', [[-6.6, -5.2, 0, 2.3]]);
  k.wandX(3, 9, 17.2, 0.4, H, 'beton', [[5.2, 6.6, 0, 2.3]]);
  k.wandZ(11.1, 14.8, -3, 0.4, H, 'beton', []);
  k.wandZ(11.1, 14.8, 3, 0.4, H, 'beton', []);
  k.q(-1.4, 18.6, 1.4, 21.1, 1.2, 'holzboden', { farbe: '#b8a898' });
  k.kiste(-9.8, 19.8, 1);
  k.kiste(9.8, 12.4, 1);
  k.q(-10.2, 12, -8, 12.8, 1.1, 'sandsack');
  k.q(-0.6, 12, 0.6, 13.8, 1.2, 'holzboden');
  k.q(-12.4, 10.4, 12.4, 21.8, 0.4, 'beton', { y: H, kollision: false });
  k.deko.push({ typ: 'hallenlampen', x0: -8, x1: 8, z: [13, 19.4], y: H - 0.1 });
  k.deko.push({ typ: 'schild', text: 'BUNKER 7', x: 0, y: 2.55, z: 10.48, yaw: NACH_NORD, breite: 2.2, hoehe: 0.5 });
  k.deko.push({ typ: 'schild', text: 'C', x: -4, y: 1.7, z: 10.48, yaw: NACH_NORD, breite: 0.9, hoehe: 0.9, gross: true });
  k.deko.push({ typ: 'schild', text: 'C', x: 4, y: 1.7, z: 10.48, yaw: NACH_NORD, breite: 0.9, hoehe: 0.9, gross: true });

  k.beide((s) => {
    const x = (v) => v * s;
    // Sandsackstellungen vor dem Bunker
    k.q(x(14.2), 11.2, x(15.2), 13.8, 1.1, 'sandsack');
    k.q(x(17.6), 17.6, x(20.6), 18.4, 1.1, 'sandsack');
    k.q(x(21.6), 11.4, x(22.8), 14.8, 2.2, 'hesco');
    k.kiste(x(18), 21.6, 1);
    k.q(x(13.8), 20.2, x(15.4), 21.8, 1.3, 'metall', { farbe: '#b8bec4' });
  });

  k.deko.push({ typ: 'umgebung' });

  /* --------------------------------------------------------- Wege */
  k.wege.push({ name: 'A', punkte: [[-28, -15], [-21, -12.5], [-11, -12], [0, -16], [11, -12], [21, -12.5], [28, -15]] });
  k.wege.push({ name: 'B', punkte: [[-28, 1], [-21, 3.2], [-9.5, 2], [0, 2.4], [9.5, 2], [21, 3.2], [28, 1]] });
  k.wege.push({ name: 'C', punkte: [[-28, 13], [-18, 15.6], [-10, 15.6], [0, 15.6], [10, 15.6], [18, 15.6], [28, 13]] });

  return k.fertig();
}
