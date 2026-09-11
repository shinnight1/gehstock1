/* ------------------------------------------------------------------
   Einheiten und Geschosse zeichnen.

   Jede Einheit ist ein aufrechter Koerper auf einem Bodenschatten:
   ein Rumpf in der Kartenfarbe, ein Kopf, ein Fussring in der
   Parteifarbe. Das reicht, um auf einen Blick zu erkennen, wem etwas
   gehoert - und genau darauf kommt es an, wenn vierzig Figuren
   gleichzeitig ueber das Feld laufen.

   Flieger schweben ueber ihrem Schatten. Der Abstand zwischen beiden
   ist das Einzige, was Luft von Boden unterscheidet, und er muss
   deutlich sein: wer nicht sofort sieht, dass etwas fliegt, spielt
   den falschen Konter.

   Gezeichnet wird aus interpolierten Positionen. Die Sim laeuft mit
   20 Ticks, der Bildschirm mit 60 Bildern - ohne Interpolation
   ruckelt jede Bewegung sichtbar.
   ------------------------------------------------------------------ */

import { karteVon } from '@arena/sim';
import type { Einheit, Projektil, Spieler } from '@arena/sim';
import { FARBE } from './palette.js';
import { pxX, pxY, skalaBei, pxHoehe } from './kamera.js';
import { figurSkala } from './figurgroesse.js';
import type { Kamera } from './kamera.js';
import { schatten, bodenEllipse } from './perspektive.js';
import { figurJetzt } from '../assets/lader.js';

/** Wie hoch Flieger ueber ihrem Schatten schweben, in Millitiles. */
const FLUGHOEHE = 1400;

/** Wie lange ein Treffer aufblitzt, in Ticks. */
const BLITZ_TICKS = 3;

/**
 * Wie weit eine getroffene Figur zurueckzuckt, als Anteil ihres
 * Radius.
 *
 * Rein optisch - die Simulation weiss davon nichts und darf es auch
 * nicht: ein Versatz, der ins Spiel eingriffe, muesste auf beiden
 * Geraeten gleich sein, und dann waere er kein Effekt mehr, sondern
 * eine Regel. Fuenfzehn Prozent reichen; mehr sieht aus, als wuerde
 * die Figur weggeschleudert, und bei zwanzig Treffern je Sekunde
 * wackelt dann das halbe Feld.
 */
const ZUCK_ANTEIL = 0.15;

export interface EinheitAnsicht {
  einheit: Einheit;
  /** Interpolierte Position - nicht die aus dem Zustand. */
  x: number;
  y: number;
}

export function einheitZeichnen(
  c: CanvasRenderingContext2D, k: Kamera, a: EinheitAnsicht, tick: number,
): void {
  const e = a.einheit;
  const karte = karteVon(e.karte);
  const s = skalaBei(k, a.y);
  const px = pxX(k, a.x, a.y);
  const boden = pxY(k, a.y);

  const fliegt = e.ebene === 'luft';
  const hub = fliegt ? pxHoehe(k, a.y, FLUGHOEHE) : 0;

  /* Zurueckzucken: die Figur weicht kurz entgegen ihrer Blickrichtung
     zurueck. Woher der Schlag kam, weiss der Renderer nicht - aber
     eine Einheit schaut fast immer auf das, was sie angreift und was
     sie angreift, also stimmt die Richtung in der Praxis. */
  let zuckX = 0;
  let zuckY = 0;
  const seitTreffer = tick - e.getroffenTick;
  if (seitTreffer >= 0 && seitTreffer < BLITZ_TICKS) {
    const staerke = (1 - seitTreffer / BLITZ_TICKS) * s * e.radius * ZUCK_ANTEIL;
    const laenge = Math.hypot(e.blickX, e.blickY);
    if (laenge > 0) {
      zuckX = (-e.blickX / laenge) * staerke;
      // Flacher, weil die Tiefe perspektivisch gestaucht ist.
      zuckY = (-e.blickY / laenge) * staerke * 0.55;
    }
  }

  const px2 = px + zuckX;
  const fuss = boden - hub + zuckY;

  // Schatten bleibt am Boden, auch wenn die Einheit darueber schwebt
  // und auch wenn sie zurueckzuckt - er gehoert zum Standpunkt.
  schatten(c, k, a.x, a.y, e.radius, fliegt ? 0.55 : 1);

  if (e.istGebaeude) {
    gebaeudeZeichnen(c, k, a, karte?.farbe ?? FARBE.steinVorne, tick);
    return;
  }

  /* Deutlich groesser als der Kollisionsradius. Der Radius bestimmt,
     wie eng Einheiten stehen; die Figur darf darueber hinausragen,
     sonst sind sechs Ratten auf dem iPad sechs Punkte.

     Der Bildfaktor kommt aus figurgroesse.ts und setzt den Massstab:
     ein Katapult ist groesser als die Frau, die es bedient, und der
     Wal groesser als alles andere. Am Radius aendert das nichts - der
     bleibt Spielregel. */
  const bild = figurSkala(e.karte);
  const breite = s * e.radius * 2.2 * bild;
  const hoehe = s * e.radius * 2.9 * bild;
  const farbe = karte?.farbe ?? FARBE.steinVorne;
  const getroffen = tick - e.getroffenTick < BLITZ_TICKS;

  fussring(c, k, a, e.spieler, fliegt ? hub : 0);

  const figur = einheitenFigur(e.karte, e.spieler, getroffen);
  if (figur) {
    const qw = figur instanceof HTMLImageElement ? figur.naturalWidth : figur.width;
    const qh = figur instanceof HTMLImageElement ? figur.naturalHeight : figur.height;
    if (qw > 0 && qh > 0) {
      const maxB = s * e.radius * 2.6 * bild;
      const maxH = s * e.radius * 3.1 * bild;
      const sk = Math.min(maxB / qw, maxH / qh);
      const bw = qw * sk;
      const bh = qh * sk;
      const x = px2 - bw / 2;
      const y = fuss - bh;
      c.drawImage(figur, x, y, bw, bh);

      if (e.deployRest > 0) deployRing(c, k, a, e);
      else if (e.hp < e.maxHp) lebensbalken(c, px2, y - s * 220, Math.max(breite * 1.1, bw * 0.9), e);
      return;
    }
  }

  /* Rumpf. Eine Kapsel statt eines Rechtecks: bei zwanzig Pixeln
     Groesse ist die Silhouette alles, was man noch erkennt, und eine
     runde liest sich als Figur, eine eckige als Kiste. */
  const rumpfHoehe = hoehe * 0.62;
  const rumpfY = fuss - rumpfHoehe;
  c.fillStyle = getroffen ? '#ffffff' : farbe;
  kapsel(c, px2 - breite / 2, rumpfY, breite, rumpfHoehe);
  c.fill();

  // Kopf
  const kopfR = breite * 0.32;
  c.beginPath();
  c.arc(px2, rumpfY - kopfR * 0.7, kopfR, 0, Math.PI * 2);
  c.fill();

  // Schattenseite - gibt dem flachen Koerper Volumen.
  if (!getroffen) {
    c.fillStyle = 'rgba(0, 0, 0, 0.2)';
    kapsel(c, px2 + breite * 0.12, rumpfY, breite * 0.38, rumpfHoehe);
    c.fill();
  }

  if (e.deployRest > 0) deployRing(c, k, a, e);
  else if (e.hp < e.maxHp) lebensbalken(c, px2, rumpfY - kopfR * 1.9, breite * 1.1, e);
}

/** Abgerundetes Rechteck als Pfad. Ohne Fuellen - das macht der Aufrufer. */
function kapsel(
  c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
): void {
  const r = Math.min(w, h) * 0.42;
  c.beginPath();
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y);
  c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r);
  c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r);
  c.quadraticCurveTo(x, y, x + r, y);
  c.closePath();
}

/** Farbiger Ring unter der Einheit - die Parteizugehoerigkeit. */
function fussring(
  c: CanvasRenderingContext2D, k: Kamera, a: EinheitAnsicht,
  spieler: Spieler, hub: number,
): void {
  const e = a.einheit;
  c.save();
  if (hub > 0) c.translate(0, -hub);
  c.fillStyle = FARBE.seite[spieler];
  c.globalAlpha = 0.85;
  bodenEllipse(c, k, a.x, a.y, e.radius * 0.85, 0.55);
  c.fill();
  c.globalAlpha = 1;
  c.restore();
}

/**
 * Figur-Grafik fuer eine Einheit oder ein Gebaeude abrufen.
 *
 * Erst assets/units/<id>.webp, dann .png. WebP zuerst, weil das die
 * ausgelieferte Form ist - die Vorlagen liegen als PNG in
 * bildquellen/ und werden mit tools/bilder-wandeln.mjs umgerechnet.
 * Der PNG-Pfad bleibt als Ausweg, um eine einzelne Grafik ohne
 * Umweg nachzureichen.
 *
 * Bei Treffer weiss aufgeblitzt; fuer die gegnerische Partei mit deren
 * Farbe eingefaerbt - aber nur leicht.
 *
 * Die Staerke war urspruenglich fuer das Koenigsfoto gedacht, wo es
 * allein darum geht, die Seite zu erkennen. Bei gezeichneten Figuren
 * frisst sie die Vorlage auf: aus einem Frostkoloss wird ein roter
 * Klumpen. Ein Fuenftel reicht - die Seite steht ohnehin im Fussring
 * unter der Figur, und der ist selbst bei zwanzig Pixeln noch klar.
 */
const GEGNER_TOENUNG = 0.2;

function einheitenFigur(
  kartenId: string, spieler: Spieler, getroffen: boolean,
): HTMLCanvasElement | HTMLImageElement | null {
  const farbe = getroffen ? '#ffffff' : (spieler === 1 ? FARBE.seite[1] : undefined);
  const staerke = getroffen ? 0.75 : GEGNER_TOENUNG;
  return figurJetzt('units/' + kartenId + '.webp', farbe, staerke)
    ?? figurJetzt('units/' + kartenId + '.png', farbe, staerke);
}

function gebaeudeZeichnen(
  c: CanvasRenderingContext2D, k: Kamera, a: EinheitAnsicht,
  farbe: string, tick: number,
): void {
  const e = a.einheit;
  const s = skalaBei(k, a.y);
  const px = pxX(k, a.x, a.y);
  const boden = pxY(k, a.y);
  const bild = figurSkala(e.karte);
  const breite = s * e.radius * 1.9 * bild;
  const hoehe = s * e.radius * 1.7 * bild;
  const getroffen = tick - e.getroffenTick < BLITZ_TICKS;

  c.fillStyle = FARBE.seite[e.spieler];
  c.globalAlpha = 0.8;
  bodenEllipse(c, k, a.x, a.y, e.radius, 0.55);
  c.fill();
  c.globalAlpha = 1;

  const figur = einheitenFigur(e.karte, e.spieler, getroffen);
  if (figur) {
    const qw = figur instanceof HTMLImageElement ? figur.naturalWidth : figur.width;
    const qh = figur instanceof HTMLImageElement ? figur.naturalHeight : figur.height;
    if (qw > 0 && qh > 0) {
      const maxB = s * e.radius * 2.4 * bild;
      const maxH = s * e.radius * 2.2 * bild;
      const sk = Math.min(maxB / qw, maxH / qh);
      const bw = qw * sk;
      const bh = qh * sk;
      const x = px - bw / 2;
      const y = boden - bh;
      c.drawImage(figur, x, y, bw, bh);

      if (e.deployRest > 0) deployRing(c, k, a, e);
      else if (e.hp < e.maxHp) lebensbalken(c, px, y - s * 220, Math.max(breite, bw * 0.9), e);
      return;
    }
  }

  c.fillStyle = getroffen ? '#ffffff' : farbe;
  c.fillRect(px - breite / 2, boden - hoehe, breite, hoehe);
  c.fillStyle = 'rgba(0, 0, 0, 0.24)';
  c.fillRect(px + breite * 0.16, boden - hoehe, breite * 0.34, hoehe);

  if (e.deployRest > 0) deployRing(c, k, a, e);
  else if (e.hp < e.maxHp) lebensbalken(c, px, boden - hoehe - s * 300, breite, e);
}

/**
 * Ring, der sich waehrend der Aufstellzeit schliesst.
 *
 * Er sagt zweierlei auf einmal: hier entsteht etwas, und es kann
 * noch nicht handeln. Beides muss der Gegner sehen koennen.
 */
function deployRing(
  c: CanvasRenderingContext2D, k: Kamera, a: EinheitAnsicht, e: Einheit,
): void {
  const karte = karteVon(e.karte);
  const gesamt = karte?.deployZeit || 20;
  const anteil = 1 - e.deployRest / gesamt;

  c.strokeStyle = FARBE.seiteHell[e.spieler];
  c.lineWidth = Math.max(1.5, skalaBei(k, a.y) * 90);
  c.globalAlpha = 0.9;
  bodenEllipse(c, k, a.x, a.y, e.radius * 1.25, 0.55);
  c.stroke();

  c.strokeStyle = '#ffffff';
  c.globalAlpha = 0.35 + anteil * 0.5;
  bodenEllipse(c, k, a.x, a.y, e.radius * (1.25 - anteil * 0.3), 0.55);
  c.stroke();
  c.globalAlpha = 1;
}

function lebensbalken(
  c: CanvasRenderingContext2D, cx: number, y: number, breite: number, e: Einheit,
): void {
  const h = Math.max(2.5, breite * 0.14);
  const x = cx - breite / 2;
  const anteil = Math.max(0, Math.min(1, e.hp / e.maxHp));
  c.fillStyle = 'rgba(4, 9, 18, 0.75)';
  c.fillRect(x - 1, y - 1, breite + 2, h + 2);
  c.fillStyle = FARBE.seiteDunkel[e.spieler];
  c.fillRect(x, y, breite, h);
  c.fillStyle = FARBE.seiteHell[e.spieler];
  c.fillRect(x, y, breite * anteil, h);
}

/* --------------------------- Geschosse ----------------------------- */

export function projektilZeichnen(
  c: CanvasRenderingContext2D, k: Kamera, p: Projektil,
): void {
  const s = skalaBei(k, p.y);
  const px = pxX(k, p.x, p.y);
  // Geschosse fliegen auf halber Figurhoehe - sonst kleben sie am Boden.
  const py = pxY(k, p.y) - pxHoehe(k, p.y, 700);
  const r = Math.max(1.5, s * p.radius * 2.2);

  c.fillStyle = p.farbe;
  c.beginPath();
  c.arc(px, py, r, 0, Math.PI * 2);
  c.fill();

  c.fillStyle = 'rgba(255, 255, 255, 0.5)';
  c.beginPath();
  c.arc(px - r * 0.25, py - r * 0.25, r * 0.45, 0, Math.PI * 2);
  c.fill();
}
