/* ------------------------------------------------------------------
   Karte "Dorf Birkenhain"

   Ein Dorf am spaeten Nachmittag, 66 x 46 m, von einer Ziegelmauer
   umgeben. Westen Gehoeft Blau, Osten Gehoeft Rot. Drei Wege:

     A  Hauptstrasse (Norden)   Pflaster zwischen zwei Haeuserzeilen,
                                die zwei mittleren Haeuser sind begehbar
     B  Marktplatz (Mitte)      Brunnen, Marktstaende, Linden
     C  Scheune (Sueden)        grosse Scheune mit Heu, links und rechts
                                Obstgaerten mit niedrigen Zaeunen

   Spiegelgleich zur Achse x = 0. Hoehen: Zaeune 1,0, Heuballen und
   Staende 1,1, Brunnen 0,8, Haeuser 3,4, Scheune 5,2, Mauer 3,6.
   ------------------------------------------------------------------ */

import { KartenBauer } from './bauer.js';

const NACH_OST = -Math.PI / 2;
const NACH_WEST = Math.PI / 2;
const NACH_NORD = 0;
const NACH_SUED = Math.PI;

const PUTZ = ['#e6dcc6', '#d9c7a4', '#cfd6cf', '#e8d2c0', '#d6cbb8'];
const HEU = '#fff4d8';

export function birkenhain() {
  const k = new KartenBauer('Dorf Birkenhain');
  k.id = 'birkenhain';
  k.grenzen = { minX: -33, maxX: 33, minZ: -23, maxZ: 23 };
  k.thema = {
    himmelOben: '#5f86b8', horizont: '#e6d4b6', himmelUnten: '#998e7c',
    nebelNah: 40,
    licht: '#f0e2c8', lichtBoden: '#7a6a52', lichtStaerke: 2.0,
    sonne: '#ffd49a', sonnenStaerke: 2.6, sonnenRichtung: [-42, 30, 14],
    baeume: 'laub', baumZahl: 80, tuerme: false, draht: false, huegel: '#8a9a7c', mauerHoehe: 3.6,
  };

  /* ---------------------------------------------- Boden, Dorfmauer */

  k.q(-60, -50, 60, 50, 1, 'unsichtbar', { y: -1 });
  k.q(-34, -24, 34, -23, 3.6, 'ziegel');
  k.q(-34, 23, 34, 24, 3.6, 'ziegel');
  k.q(-34, -23, -33, 23, 3.6, 'ziegel');
  k.q(33, -23, 34, 23, 3.6, 'ziegel');

  k.bodenflaeche(-33, -23, -24, 23, 'gras');
  k.bodenflaeche(24, -23, 33, 23, 'gras');
  k.bodenflaeche(-24, -23, 24, -3.8, 'pflaster');
  k.bodenflaeche(-24, -3.8, 24, 8.5, 'pflaster');
  k.bodenflaeche(-24, 8.5, 24, 23, 'gras');
  k.bodenflaeche(-8.5, 8.5, 8.5, 23, 'kies', 0.006);

  k.bereich('Gehöft Blau', -33, -23, -24, 23);
  k.bereich('Gehöft Rot', 24, -23, 33, 23);
  k.bereich('Hauptstraße', -24, -23, 24, -10.5);
  k.bereich('Marktplatz', -24, -10.5, 24, 8.5);
  k.bereich('Scheune', -8.5, 8.5, 8.5, 23);
  k.bereich('Obstgarten', -24, 8.5, -8.5, 23);
  k.bereich('Obstgarten', 8.5, 8.5, 24, 23);

  /* -------------------------------------------------------- Gehoefte */

  k.beide((s) => {
    const team = s < 0 ? 0 : 1;
    const x = (v) => v * s;
    const blick = s < 0 ? NACH_OST : NACH_WEST;

    // Schuppen an der Rueckwand, Heuballen, Zaun zum Dorf
    k.q(x(30), -4, x(33), 4, 2.8, 'holzboden', { farbe: team === 0 ? '#9fb4d0' : '#d0a8a0' });
    k.deko.push({ typ: 'zeltdach', x0: x(30), x1: x(33), z0: -4, z1: 4, y: 2.8, h: 1.2, mat: 'dach' });
    k.q(x(25.6), -14.4, x(26.8), -12.2, 1.1, 'heu', { farbe: HEU });
    k.q(x(25.6), 12.2, x(26.8), 14.4, 1.1, 'heu', { farbe: HEU });
    k.q(x(24.1), -9, x(24.5), -3.5, 1.0, 'holzboden');
    k.q(x(24.1), 3.5, x(24.5), 9, 1.0, 'holzboden');
    // Sichtschutz zum Dorf: Heuwagen vor dem Hof, Hoftor an der Strasse
    k.q(x(22.6), -2.2, x(24.4), 2.4, 1.3, 'holzboden', { farbe: '#e0c4a0' });
    k.q(x(22.7), -2.0, x(24.3), 2.2, 1.3, 'heu', { farbe: HEU, y: 1.3 });
    k.q(x(23.5), -16.4, x(24.1), -12.8, 2.3, 'holzboden', { farbe: '#c8a080' });
    k.q(x(23.5), 5.6, x(24.1), 8.2, 2.3, 'holzboden', { farbe: '#c8a080' });
    k.fass(x(32.2), -10, '#5a4a2e');
    k.fass(x(32.2), 10.6, '#5a4a2e');
    k.baum(x(31), -19.5, 'laub', 1.1);
    k.baum(x(31), 19.5, 'laub', 1.1);

    k.deko.push({ typ: 'flagge', x: x(29.2), z: -8, team });
    k.deko.push({ typ: 'flagge', x: x(29.2), z: 8, team });
    k.deko.push({ typ: 'schild', text: team === 0 ? 'GEHÖFT BLAU' : 'GEHÖFT ROT', team,
      x: x(29.98), y: 1.6, z: 0, yaw: s < 0 ? NACH_OST : NACH_WEST, breite: 3.4, hoehe: 0.8 });
    k.deko.push({ typ: 'markierung', form: 'basis', team, x: x(27), linie: 23.6, pfeil: 27, z0: -21, z1: 21 });

    // Jeder Spawn liegt im Schatten eines Hauses, des Wagens, des Tors
    // oder der Scheune - keine freie Sicht bis zum anderen Hof.
    k.spawn(team, x(28), -20, blick);
    k.spawn(team, x(27.5), -8, blick);
    k.spawn(team, x(27), -1, blick);
    k.spawn(team, x(28.5), 2, blick);
    k.spawn(team, x(27.5), 7, blick);
    k.spawn(team, x(28), 12, blick);
    k.spawn(team, x(28), 20, blick);
  });

  /* ---------------------------------------------- A  Hauptstrasse */

  // Nordzeile: feste Haeuser an der Mauer, dazwischen Gaertchen
  const nord = [[-23.5, -15.5], [-14.5, -6.5], [-3, 3], [6.5, 14.5], [15.5, 23.5]];
  nord.forEach(([a, b], i) => k.haus(a, -23, b, -17.6, 3.4, { farbe: PUTZ[i % PUTZ.length] }));
  // Suedzeile: aussen fest, die beiden mittleren begehbar
  k.beide((s) => {
    const x = (v) => v * s;
    const a = (u, v) => [Math.min(x(u), x(v)), Math.max(x(u), x(v))];
    const [f0, f1] = a(15, 21);
    k.haus(f0, -10.5, f1, -4.6, 3.4, { farbe: s < 0 ? PUTZ[1] : PUTZ[3] });
    const [h0, h1] = a(3.5, 9.5);
    const tuer = a(5.6, 7.1);
    const fensterA = a(4.2, 5.2);
    const fensterB = a(7.9, 8.9);
    k.haus(h0, -10.5, h1, -4.6, 3.4, {
      farbe: s < 0 ? PUTZ[2] : PUTZ[4],
      tueren: { n: [tuer], s: [a(6.2, 7.7)], [s < 0 ? 'o' : 'w']: [[-8.4, -7]] },
      fenster: { n: [fensterA, fensterB], s: [fensterA], [s < 0 ? 'w' : 'o']: [[-8.2, -6.8]] },
    });
    k.kiste(x(8.6), -9.6, 1);
    k.q(x(4.3), -6.1, x(5.3), -5.4, 0.8, 'holzboden', { farbe: '#e0c4a0' });
    // Strasse: Brunnentrog, Karren, Laterne
    k.q(x(12.2), -14.6, x(14.2), -13.8, 0.8, 'beton');
    k.q(x(19), -16.8, x(21.2), -15.4, 1.1, 'holzboden', { farbe: '#f0dcc0' });
    k.m(x(10.8), -11, 0.2, 0.2, 3.4, 'metall', { farbe: '#2b2f33' });
  });
  k.kiste(0, -12, 1);
  k.deko.push({ typ: 'schild', text: 'HAUPTSTRASSE', x: 0, y: 2.3, z: -17.58, yaw: NACH_SUED, breite: 3.6, hoehe: 0.6 });

  /* ------------------------------------------------ B  Marktplatz */

  // Brunnen mit Wasser und Saeule
  k.q(-1.9, 0.1, 1.9, 3.9, 0.8, 'beton');
  k.wasser(-1.6, 0.4, 1.6, 3.6, 0.82, '#3e6a78');
  k.m(0, 2, 0.5, 0.5, 2.2, 'beton', { y: 0.8 });
  k.ring(0, 2, 3.2, 0.14, '#cfc6b4');
  k.beide((s) => {
    const x = (v) => v * s;
    // Marktstaende: Tisch als Deckung, Plane darueber
    for (const [cx, cz] of [[7.5, -1.2], [7.5, 5.2]]) {
      k.m(x(cx), cz, 3, 1.1, 1.05, 'holzboden', { farbe: '#f0dcc0' });
      k.deko.push({ typ: 'zeltdach', x0: x(cx) - 1.7, x1: x(cx) + 1.7, z0: cz - 1.4, z1: cz + 1.4, y: 2.3, h: 0.6,
        farbe: s < 0 ? '#9fb4d0' : '#d8a898' });
      for (const px of [-1.5, 1.5]) for (const pz of [-1.2, 1.2]) k.m(x(cx) + px, cz + pz, 0.1, 0.1, 2.3, 'holzboden', { kollision: false });
    }
    // Linden, Baenke, Kisten
    k.baum(x(15.5), 2, 'laub', 1.2);
    k.q(x(12.4), -2.2, x(13.4), -1.6, 0.5, 'holzboden', { farbe: '#c8a080' });
    k.q(x(19.5), 5.4, x(21.3), 6.4, 1.2, 'holzboden');
    k.kiste(x(20.8), -2.4, 1);
    k.fass(x(11.8), 7.2, '#5a4a2e');
  });
  k.deko.push({ typ: 'schild', text: 'MARKT', x: 0, y: 2.6, z: -4.58, yaw: NACH_SUED, breite: 2, hoehe: 0.6 });

  /* --------------------------------------------- C  Scheune, Obstgarten */

  const H = 5.2;
  // Scheune: Tore nach Norden (Mitte), Westen und Osten
  k.wandX(-8, 8, 11.3, 0.4, H, 'holzboden', [[-2, 2, 0, 3.8], [-6.2, -4.8, 1.3, 2.3], [4.8, 6.2, 1.3, 2.3]], { farbe: '#e39a82' });
  k.wandX(-8, 8, 22.7, 0.4, H, 'holzboden', [], { farbe: '#e39a82' });
  k.wandZ(11.5, 22.5, -7.8, 0.4, H, 'holzboden', [[14.5, 18.5, 0, 3.4]], { farbe: '#e39a82' });
  k.wandZ(11.5, 22.5, 7.8, 0.4, H, 'holzboden', [[14.5, 18.5, 0, 3.4]], { farbe: '#e39a82' });
  k.bodenflaeche(-7.6, 11.5, 7.6, 22.5, 'holzboden', 0.012);
  k.deko.push({ typ: 'zeltdach', x0: -8, x1: 8, z0: 11.1, z1: 22.9, y: H, h: 2.8, mat: 'dachziegel', giebel: 'holzboden', giebelFarbe: '#e39a82' });
  // Heu innen: Deckung auf halber Hoehe und hoch gestapelt
  k.q(-6.6, 19.6, -2.8, 21.9, 1.1, 'heu', { farbe: HEU });
  k.q(-6.6, 19.6, -4.6, 21.9, 1.1, 'heu', { farbe: HEU, y: 1.1 });
  k.q(2.4, 12.6, 4.6, 14.4, 1.1, 'heu', { farbe: HEU });
  k.q(3.2, 19.8, 6.8, 21.9, 1.1, 'heu', { farbe: HEU });
  k.q(-1.2, 16.2, 1.2, 17.4, 1.1, 'heu', { farbe: HEU });
  k.m(-3.6, 16.6, 0.4, 0.4, H, 'holzboden', { farbe: '#c8a080' });
  k.m(3.6, 16.6, 0.4, 0.4, H, 'holzboden', { farbe: '#c8a080' });
  k.deko.push({ typ: 'schild', text: 'C', x: 0, y: 4.3, z: 11.08, yaw: NACH_NORD, breite: 1, hoehe: 1, gross: true });

  k.beide((s) => {
    const x = (v) => v * s;
    // Obstgarten: Baumreihen, Zaun mit Luecken
    for (const bx of [12, 16.5, 21]) {
      for (const bz of [12, 16.5, 21]) {
        if (bx === 21 && bz === 12) continue;
        k.baum(x(bx), bz, 'laub', 0.8);
      }
    }
    k.q(x(9.4), 9.6, x(15), 9.9, 1.0, 'holzboden');
    k.q(x(17.4), 9.6, x(24), 9.9, 1.0, 'holzboden');
    k.q(x(9.4), 9.9, x(9.7), 13.5, 1.0, 'holzboden');
    k.q(x(9.4), 17, x(9.7), 22.6, 1.0, 'holzboden');
    k.q(x(13.8), 13.4, x(15.4), 15, 1.1, 'heu', { farbe: HEU });
    k.kiste(x(19), 18.6, 1);
    k.q(x(22.2), 13.2, x(23.2), 15.6, 1.1, 'holzboden', { farbe: '#e0c4a0' });
  });

  k.deko.push({ typ: 'umgebung' });

  /* --------------------------------------------------------- Wege */
  k.wege.push({ name: 'A', punkte: [[-27.5, -14], [-21, -14], [-11, -14.5], [0, -14.2], [11, -14.5], [21, -14], [27.5, -14]] });
  k.wege.push({ name: 'B', punkte: [[-27.5, 1], [-21, 1.6], [-11, 2], [0, -2.4], [11, 2], [21, 1.6], [27.5, 1]] });
  k.wege.push({ name: 'C', punkte: [[-27.5, 14.5], [-18.8, 14.3], [-11, 15.6], [0, 15], [11, 15.6], [18.8, 14.3], [27.5, 14.5]] });

  return k.fertig();
}
