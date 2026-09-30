/* ------------------------------------------------------------------
   Karte "Hafen Moewenkai"

   Ein Stueck Containerhafen, 68 x 44 m. Im Norden liegt das Wasser,
   Westen Basis Blau, Osten Basis Rot. Drei Wege:

     A  Kaikante (Norden)       offen, lange Sichtlinien unter dem
                                Portalkran - Scharfschuetzen-Gebiet
     B  Containerlager (Mitte)  Gassen zwischen Stapeln, schnelle Wechsel
     C  Lagerhaus (Sueden)      Halle mit Regalen und Gabelstapler,
                                davor der Vorplatz mit Aufliegern

   Alles ist spiegelgleich zur Achse x = 0. Hoehen: Poller 0,75,
   Barrieren 0,9, Kisten 1,2, Container 2,6 (Stapel 5,2), Halle 5,5.
   ------------------------------------------------------------------ */

import { KartenBauer } from './bauer.js';

const NACH_OST = -Math.PI / 2;
const NACH_WEST = Math.PI / 2;
const NACH_NORD = 0;

const GELB = '#c9a227';
const FARBEN = {
  blau: { grund: '#2f5f8a', oben: '#6d7b83' },
  rot: { grund: '#8a3b32', oben: '#b4643a' },
  gruen: { grund: '#4f6b3c', oben: '#a8915f' },
  petrol: { grund: '#3f6b6c', oben: '#6d7b83' },
  orange: { grund: '#b4643a', oben: '#56703f' },
  grau: { grund: '#6d7b83', oben: '#3f6b6c' },
};

export function moewenkai() {
  const k = new KartenBauer('Hafen Möwenkai');
  k.id = 'moewenkai';
  k.grenzen = { minX: -34, maxX: 34, minZ: -22, maxZ: 22 };
  k.thema = {
    himmelOben: '#6d86a0', horizont: '#c7d1d8', himmelUnten: '#6f7d84',
    nebelNah: 34,
    licht: '#d8e2ea', lichtBoden: '#6f6a60', lichtStaerke: 2.3,
    sonne: '#f4f0e6', sonnenStaerke: 1.9, sonnenRichtung: [30, 44, -22],
    baeume: 'nadel', baumZahl: 60, ohneBaeume: [[-400, -400, 400, -24]],
    tuerme: false, draht: false, huegel: '#8a9aa3',
  };

  /* ------------------------------------- Boden, Kaikante, Umfassung */

  k.q(-60, -50, 60, 50, 1, 'unsichtbar', { y: -1 });
  // Norden: Kaikante - unsichtbar hoch, damit niemand ins Wasser faellt
  k.q(-35, -23.4, 35, -22, 6, 'unsichtbar');
  k.q(-34, -22.35, 34, -22, 0.3, 'beton');
  k.q(-60, -22.7, 60, -22.35, 1.5, 'beton', { y: -1.5, kollision: false });
  k.wasser(-240, -170, 240, -22.4, -0.9, '#35586a');
  // Die anderen Seiten: Mauer
  k.q(-35, 22, 35, 23, 4.2, 'mauer');
  k.q(-35, -22, -34, 22, 4.2, 'mauer');
  k.q(34, -22, 35, 22, 4.2, 'mauer');

  k.bodenflaeche(-34, -22, -25, 22, 'kies');
  k.bodenflaeche(25, -22, 34, 22, 'kies');
  k.bodenflaeche(-25, -22, 25, -10, 'platten');
  k.bodenflaeche(-25, -10, 25, 8, 'asphalt');
  k.bodenflaeche(-16, 8, 16, 22, 'estrich');
  k.bodenflaeche(-25, 8, -16, 22, 'asphalt');
  k.bodenflaeche(16, 8, 25, 22, 'asphalt');

  k.bereich('Basis Blau', -34, -22, -25, 22);
  k.bereich('Basis Rot', 25, -22, 34, 22);
  k.bereich('Kaikante', -25, -22, 25, -10);
  k.bereich('Containerlager', -25, -10, 25, 8);
  k.bereich('Lagerhaus', -16, 8, 16, 22);
  k.bereich('Vorplatz', -25, 8, -16, 22);
  k.bereich('Vorplatz', 16, 8, 25, 22);

  /* Frachter am Kai (nur Kulisse) */
  k.q(-28, -35, 22, -24.5, 7.5, 'metall', { y: -1.5, farbe: '#6a8094', kollision: false });
  k.q(-28, -35, 22, -24.5, 0.4, 'metall', { y: 5.95, farbe: '#8a2f2a', kollision: false });
  k.q(10, -33.5, 19, -26, 6, 'metall', { y: 6.3, farbe: '#d6dad6', kollision: false });
  k.q(11, -33, 18, -26.5, 0.8, 'metall', { y: 9.6, farbe: '#2a3036', kollision: false });
  k.zylinder(14.5, -29.8, 1.3, 4, '#b33a2a', { y: 12.3, kollision: false });
  const ladung = [FARBEN.blau, FARBEN.orange, FARBEN.gruen, FARBEN.rot, FARBEN.petrol, FARBEN.grau];
  for (let i = 0; i < 6; i++) {
    const x = -24 + i * 6.3;
    const f = ladung[i];
    k.q(x, -33.5, x + 6, -31.1, 2.6, 'container', { y: 6.3, farbe: f.grund, kollision: false });
    k.q(x, -30.8, x + 6, -28.4, 2.6, 'container', { y: 6.3, farbe: f.oben, kollision: false });
    if (i % 2 === 0) k.q(x, -33.5, x + 6, -31.1, 2.6, 'container', { y: 8.9, farbe: f.oben, kollision: false });
  }

  /* ---------------------------------------------------------- Basen */

  k.beide((s) => {
    const team = s < 0 ? 0 : 1;
    const x = (v) => v * s;
    const blick = s < 0 ? NACH_OST : NACH_WEST;

    // Hafenbuero (Container) an der Rueckwand, Stapel in den Ecken
    k.container(x(32.7), 0, false, team === 0 ? FARBEN.blau : FARBEN.rot, 1);
    k.container(x(31), -19.6, true, FARBEN.grau, 2);
    k.container(x(31), 19.6, true, FARBEN.gruen, 2);
    // Deckung vor den Spawns
    k.q(x(24.4), -6.5, x(25.2), -3, 0.9, 'barriere');
    k.q(x(24.4), 3, x(25.2), 6.5, 0.9, 'barriere');
    k.kiste(x(26.2), -12.5, 2);
    k.kiste(x(26.2), 12.5, 2);
    k.fass(x(33.2), -8, '#3f4d5c');
    k.fass(x(33.2), 8.6, '#3f4d5c');

    k.deko.push({ typ: 'flagge', x: x(30.4), z: -10.8, team });
    k.deko.push({ typ: 'flagge', x: x(30.4), z: 11.2, team });
    k.deko.push({ typ: 'schild', text: team === 0 ? 'BASIS BLAU' : 'BASIS ROT', team,
      x: x(31.48), y: 1.7, z: 0, yaw: s < 0 ? NACH_OST : NACH_WEST, breite: 3.6, hoehe: 0.8 });
    k.deko.push({ typ: 'markierung', form: 'basis', team, x: x(28), linie: 24.9, pfeil: 28.2, z0: -20, z1: 20 });

    k.spawn(team, x(29), -16, blick);
    k.spawn(team, x(28.5), -11, blick);
    k.spawn(team, x(29), -5.5, blick);
    k.spawn(team, x(28), 0, blick);
    k.spawn(team, x(29), 5.5, blick);
    k.spawn(team, x(28.5), 11, blick);
    k.spawn(team, x(29), 16, blick);
  });

  /* ------------------------------------------------- A  Kaikante */

  // Portalkran: vier Beine, oben Traeger und Kanzel
  for (const px of [-6, 6]) {
    for (const pz of [-20.4, -12.6]) k.m(px, pz, 0.9, 0.9, 12, 'metall', { farbe: GELB });
    k.q(px - 0.5, -21, px + 0.5, -12, 1.2, 'metall', { y: 12, farbe: GELB, kollision: false });
  }
  for (const pz of [-20.4, -12.6]) k.q(-6.5, pz - 0.5, 6.5, pz + 0.5, 1.2, 'metall', { y: 12, farbe: GELB, kollision: false });
  k.q(-1.8, -18, 1.8, -15, 2.4, 'metall', { y: 9.4, farbe: GELB, kollision: false });
  k.q(-0.08, -16.6, 0.08, -16.4, 5.4, 'metall', { y: 4, farbe: '#2a2a2a', kollision: false });
  k.q(-1.3, -17.7, 1.3, -15.3, 0.5, 'metall', { y: 3.4, farbe: '#2a2a2a', kollision: false });
  k.linie(-25, -20.4, 25, -20.4, 0.16, '#3b3f44');
  k.linie(-25, -12.6, 25, -12.6, 0.16, '#3b3f44');
  k.linie(-25, -10.2, 25, -10.2, 0.14, '#d8b030', 1.4, 1.0);

  k.beide((s) => {
    const x = (v) => v * s;
    // Poller an der Kante
    for (const px of [3, 11, 17, 22]) k.zylinder(x(px), -21.2, 0.28, 0.75, '#2b2f33');
    // Ein Container quer auf dem Kai - Deckung mitten im langen Weg
    k.container(x(14), -16.5, false, s < 0 ? FARBEN.petrol : FARBEN.orange, 1);
    // Kisten, Barrieren, Faesser
    k.kiste(x(9.6), -16, 2);
    k.kiste(x(10.8), -16, 1);
    k.kiste(x(18.4), -19.6, 1);
    k.kiste(x(19.6), -19.6, 1);
    k.q(x(20.2), -14.2, x(21), -11.4, 0.9, 'barriere');
    k.fass(x(2.4), -12.2, '#7a3b2a');
    k.fass(x(3.1), -11.7, '#7a3b2a');
  });
  k.kiste(0, -20.2, 1);
  k.deko.push({ typ: 'schild', text: 'KAI 3', x: 0, y: 1.5, z: -9.62, yaw: NACH_NORD, breite: 2, hoehe: 0.7 });

  /* --------------------------------------------- B  Containerlager */

  k.beide((s) => {
    const x = (v) => v * s;
    // Nordreihe (Doppelstapel): trennt Lager und Kai, Luecken als Durchgang
    k.container(x(10), -8.2, true, s < 0 ? FARBEN.blau : FARBEN.rot, 2);
    k.container(x(19), -8.2, true, FARBEN.grau, 2);
    // Mitte: quer stehende Container
    k.container(x(4.6), -1, false, s < 0 ? FARBEN.orange : FARBEN.gruen, 1);
    k.container(x(14.5), -0.5, false, FARBEN.petrol, 2);
    k.container(x(21.2), 0.5, false, s < 0 ? FARBEN.gruen : FARBEN.orange, 1);
    // Suedreihe
    k.container(x(9.5), 6, true, FARBEN.grau, 1);
    k.container(x(18.5), 6, true, s < 0 ? FARBEN.rot : FARBEN.blau, 2);
    // Kisten in den Gassen
    k.kiste(x(9.2), -2.2, 1);
    k.kiste(x(19.5), -4.9, 1);
    k.kiste(x(23.2), 6.2, 1);
    k.fass(x(12), 3.3, '#445566');
  });
  k.kiste(0, -1, 2);
  k.kiste(0, 0.2, 1);
  k.kiste(-1.2, -1, 1);
  k.kiste(1.2, 0.2, 1);
  k.deko.push({ typ: 'schild', text: 'B', x: 0, y: 1.9, z: -9.42, yaw: NACH_NORD, breite: 0.9, hoehe: 0.9, gross: true });
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i++) k.linie(s * (3 + i * 1.8), 3.2, s * (3 + i * 1.8), 4.4, 0.12, '#e8e8e0');
  }

  /* --------------------------------------------------- C  Lagerhaus */

  const H = 5.5;
  // Nordwand: Tor in der Mitte, zwei Tueren, Fenster
  k.beide((s) => {
    const x = (v) => v * s;
    const a = (u, v) => [Math.min(x(u), x(v)), Math.max(x(u), x(v))];
    const tor = a(0, 2);
    const fenster = a(3.5, 6.5);
    const tuer = a(8.5, 11);
    k.wandX(Math.min(x(0), x(16)), Math.max(x(0), x(16)), 8.9, 0.6, H, 'halle', [
      [tor[0], tor[1], 0, 4.2],
      [fenster[0], fenster[1], 1.1, 2.3],
      [tuer[0], tuer[1], 0, 2.5],
    ]);
    // Seitenwand mit Tuer
    k.wandZ(9.2, 21.4, x(15.7), 0.6, H, 'halle', [[13, 16.5, 0, 3]]);
    // Innen: Regale quer, Gabelstapler, Paletten, Pfeiler
    k.q(x(4.6), 11.8, x(5.6), 17.2, 2.6, 'regal');
    k.q(x(10.6), 16, x(11.6), 20.8, 2.6, 'regal');
    k.q(x(7.4), 11.6, x(8.6), 13.6, 1.3, 'metall', { farbe: '#c9a227' });
    k.q(x(7.5), 11.1, x(8.5), 11.6, 2.8, 'metall', { farbe: '#8a9096' });
    k.kiste(x(12.8), 11.2, 1);
    k.kiste(x(2.2), 19.6, 2);
    k.kiste(x(7.4), 20.2, 1);
    k.m(x(8), 16.2, 0.6, 0.6, H, 'beton');
    // Vorplatz: Auflieger und Barrieren
    k.q(x(19.6), 16, x(22), 21.6, 2.9, 'container', { farbe: s < 0 ? '#6d7b83' : '#a8915f' });
    k.q(x(19.6), 16, x(22), 16.4, 1, 'metall', { y: 2.9, farbe: '#8a9096' });
    k.q(x(18.5), 10.4, x(19.3), 13, 0.9, 'barriere');
    k.fass(x(23.8), 20.8, '#3f4d5c');
    k.fass(x(23.2), 21.3, '#3f4d5c');
    k.deko.push({ typ: 'schild', text: 'C', x: x(16.02), y: 4.2, z: 14.75, yaw: s < 0 ? NACH_WEST : NACH_OST, breite: 1, hoehe: 1, gross: true });
    k.schraffur(Math.min(x(13.6), x(15.4)), 13, Math.max(x(13.6), x(15.4)), 16.5, '#d8b030');
  });
  k.q(-16, 21.4, 16, 22, H, 'halle');
  k.m(0, 16.2, 0.6, 0.6, H, 'beton');
  k.kiste(0, 11.4, 1);
  // Dach mit Lichtbaendern
  for (const [z0, z1] of [[8.6, 12.4], [13.8, 17.2], [18.6, 22]]) k.q(-16, z0, 16, z1, 0.25, 'dach', { y: H, kollision: false });
  k.deko.push({ typ: 'hallenlampen', x0: -12, x1: 12, z: [13.1, 17.9], y: H - 0.4 });
  k.deko.push({ typ: 'schild', text: 'LAGERHAUS 2', x: 0, y: 4.75, z: 8.58, yaw: NACH_NORD, breite: 4.6, hoehe: 0.8 });
  k.deko.push({ typ: 'schild', text: 'C', x: 0, y: 3.2, z: 8.58, yaw: NACH_NORD, breite: 1, hoehe: 1, gross: true });
  k.linie(-15.6, 10, 15.6, 10, 0.1, '#d8b030');
  k.linie(-15.6, 21, 15.6, 21, 0.1, '#d8b030');

  k.deko.push({ typ: 'umgebung' });

  /* --------------------------------------------------------- Wege */
  k.wege.push({ name: 'A', punkte: [[-28, -16], [-21, -17], [-11, -18.6], [0, -17], [11, -18.6], [21, -17], [28, -16]] });
  k.wege.push({ name: 'B', punkte: [[-28, -1], [-21, -5.5], [-10, -5.5], [0, -5.6], [10, -5.5], [21, -5.5], [28, -1]] });
  k.wege.push({ name: 'C', punkte: [[-28, 13], [-20, 13.2], [-12.5, 14], [0, 13.6], [12.5, 14], [20, 13.2], [28, 13]] });

  return k.fertig();
}
