/* ------------------------------------------------------------------
   Bewegtes Wasser.

   Der Fluss ist die einzige Flaeche der Arena, die sich staendig
   bewegt - und genau deshalb traegt er den Eindruck, dass die Karte
   lebt. Alles andere im Untergrund steht still und ist gebacken.

   Aufwand pro Bild: eine Clip-Flaeche und rund ein Dutzend Linien.
   Das ist gemessen an einem gebackenen Untergrund viel, gemessen an
   einem Bild mit 40 Einheiten nichts.

   Trigonometrie ist hier ausdruecklich erlaubt - das ist der
   Renderer, nicht die Simulation. Die Sim darf kein Math.sin sehen
   (siehe packages/sim/src/fixed.ts).
   ------------------------------------------------------------------ */

import {
  BREITE, BRUECKEN, BRUECKE_BREITE, FLUSS_OBEN, FLUSS_UNTEN, tile,
} from '@arena/sim';
import { arenaFarben } from './arenafarben.js';
import type { FeldFarben } from './arenafarben.js';
import { pxX, pxY, skalaBei } from './kamera.js';
import type { Kamera } from './kamera.js';
import { bodenPfad } from './perspektive.js';

/** Wie viele Stuetzpunkte eine Wellenlinie bekommt. */
const PUNKTE = 22;

interface Welle {
  /** Lage im Fluss, 0 = Oberkante, 1 = Unterkante. */
  lage: number;
  /** Wellen pro Feldbreite. */
  dichte: number;
  /** Ausschlag in Tiles. */
  hub: number;
  /** Tiles pro Sekunde, Vorzeichen gibt die Richtung. */
  tempo: number;
  breite: number;
  /* Der Name der Farbe, nicht die Farbe selbst: diese Tabelle steht
     auf Modulebene und wird einmal ausgewertet, der Farbsatz haengt
     aber an der Arena und wechselt zur Laufzeit. */
  farbe: 'wasserGlanz' | 'wasserHell';
}

/* Drei Baender mit unterschiedlichem Tempo. Dass sie sich
   gegeneinander verschieben, laesst die Flaeche stroemen statt
   gleichfoermig zu wackeln. */
const WELLEN: readonly Welle[] = [
  { lage: 0.18, dichte: 3.3, hub: 0.05, tempo: 0.5, breite: 0.03, farbe: 'wasserGlanz' },
  { lage: 0.36, dichte: 2.1, hub: 0.08, tempo: -0.34, breite: 0.042, farbe: 'wasserHell' },
  { lage: 0.58, dichte: 4.2, hub: 0.04, tempo: 0.66, breite: 0.026, farbe: 'wasserGlanz' },
  { lage: 0.76, dichte: 2.7, hub: 0.07, tempo: -0.22, breite: 0.038, farbe: 'wasserHell' },
  { lage: 0.88, dichte: 5.1, hub: 0.03, tempo: 0.88, breite: 0.022, farbe: 'wasserHell' },
];

/**
 * Wasser zeichnen. `zeit` sind Sekunden seit Spielbeginn - eine
 * fortlaufende Uhr, keine Sim-Zeit; das Wasser laeuft auch weiter,
 * wenn das Match pausiert.
 */
export function wasserZeichnen(
  c: CanvasRenderingContext2D, k: Kamera, zeit: number, arena = 0,
): void {
  const f = arenaFarben(arena);
  const hoehe = FLUSS_UNTEN - FLUSS_OBEN;

  c.save();
  bodenPfad(c, k, 0, FLUSS_OBEN, BREITE, FLUSS_UNTEN);
  c.clip();

  /* Grundton ueber dem dunklen Flussbett, an den Ufern durchscheinend.
     Flaches Wasser am Rand, tiefes in der Mitte - das ist der billigste
     Weg zu einem Fluss, der eine Rinne hat statt eine Flaeche zu sein. */
  const oben = pxY(k, FLUSS_OBEN);
  const unten = pxY(k, FLUSS_UNTEN);
  const tiefeVerlauf = c.createLinearGradient(0, oben, 0, unten);
  tiefeVerlauf.addColorStop(0, f.wasser);
  tiefeVerlauf.addColorStop(0.5, f.wasserTief);
  tiefeVerlauf.addColorStop(1, f.wasser);
  c.fillStyle = tiefeVerlauf;
  c.globalAlpha = 0.85;
  bodenPfad(c, k, 0, FLUSS_OBEN, BREITE, FLUSS_UNTEN);
  c.fill();
  c.globalAlpha = 1;

  spiegelungen(c, k, zeit, f);

  c.lineCap = 'round';
  c.lineJoin = 'round';
  for (const w of WELLEN) {
    const basis = FLUSS_OBEN + hoehe * w.lage;
    const versatz = zeit * w.tempo;
    c.strokeStyle = f[w.farbe];
    c.lineWidth = Math.max(1, skalaBei(k, basis) * tile(w.breite));
    /* In Stuecke zerlegt statt als eine durchgehende Linie: eine Welle,
       die ueber die ganze Feldbreite gleich hell laeuft, sieht aus wie
       ein aufgemalter Strich. */
    let offen = false;
    for (let i = 0; i <= PUNKTE; i++) {
      const anteil = i / PUNKTE;
      const x = BREITE * anteil;
      const phase = (anteil * w.dichte + versatz) * Math.PI * 2;
      const y = basis + tile(w.hub) * Math.sin(phase);
      const sichtbar = Math.sin(phase * 0.5 + anteil * 6.1) > -0.35;
      if (!sichtbar) {
        if (offen) { c.stroke(); offen = false; }
        continue;
      }
      const px = pxX(k, x, y);
      const py = pxY(k, y);
      if (!offen) { c.beginPath(); c.moveTo(px, py); offen = true; }
      else c.lineTo(px, py);
    }
    if (offen) c.stroke();
  }

  schaumkante(c, k, FLUSS_OBEN, zeit, 1, f);
  schaumkante(c, k, FLUSS_UNTEN, zeit, -1, f);
  c.restore();
}

/**
 * Was sich im Wasser spiegelt.
 *
 * Drei Sachen, und alle drei sind das, was ein Fluss von einer blauen
 * Flaeche unterscheidet:
 *
 *   Ufer     Der Erdstreifen liegt direkt am Wasser und wirft ein
 *            Abbild hinein. Es steht nicht still, sondern zittert
 *            mit der Stroemung.
 *   Bruecke  Unter einer Bruecke ist Schatten. Ohne ihn scheint die
 *            Bruecke ueber dem Wasser zu schweben.
 *   Glanz    Breite helle Baender, die langsam wandern. Das ist der
 *            Himmel auf der Oberflaeche.
 *
 * Gezeichnet wird alles in waagerechten Scheiben, deren x-Versatz
 * einer Sinuswelle folgt. Eine echte Spiegelung braeuchte die Szene
 * ein zweites Mal - das waere fuer einen Effekt, der halb verdeckt
 * ist, ein schlechter Tausch.
 */
function spiegelungen(
  c: CanvasRenderingContext2D, k: Kamera, zeit: number, f: FeldFarben,
): void {
  const hoehe = FLUSS_UNTEN - FLUSS_OBEN;

  /* ---------------------------- Ufer ---------------------------- */
  const ufer = [
    { kante: FLUSS_OBEN, richtung: 1 },
    { kante: FLUSS_UNTEN, richtung: -1 },
  ];
  for (const u of ufer) {
    const scheiben = 7;
    for (let i = 0; i < scheiben; i++) {
      const anteil = i / scheiben;
      const y = u.kante + tile(0.55) * anteil * u.richtung;
      /* Nach innen schwaecher: die Spiegelung verliert sich, je
         weiter sie von ihrem Ufer wegkommt. */
      c.globalAlpha = (1 - anteil) * (1 - anteil) * 0.34;
      c.fillStyle = f.erde;
      const wackel = tile(0.16) * Math.sin(zeit * 1.3 + anteil * 5.2);
      const hoch = tile(0.55) / scheiben * u.richtung;
      c.beginPath();
      const schritte = 12;
      for (let j = 0; j <= schritte; j++) {
        const x = (BREITE * j) / schritte + wackel * Math.sin(j * 1.7 + zeit);
        const px = pxX(k, x, y);
        if (j === 0) c.moveTo(px, pxY(k, y));
        else c.lineTo(px, pxY(k, y));
      }
      for (let j = schritte; j >= 0; j--) {
        const x = (BREITE * j) / schritte + wackel * Math.sin(j * 1.7 + zeit);
        c.lineTo(pxX(k, x, y + hoch), pxY(k, y + hoch));
      }
      c.closePath();
      c.fill();
    }
  }
  c.globalAlpha = 1;

  /* -------------------------- Bruecken --------------------------- */
  for (const b of BRUECKEN) {
    const halb = BRUECKE_BREITE / 2;
    const verlauf = c.createLinearGradient(
      0, pxY(k, FLUSS_OBEN), 0, pxY(k, FLUSS_UNTEN),
    );
    verlauf.addColorStop(0, 'rgba(0,0,0,0)');
    verlauf.addColorStop(0.5, 'rgba(0,0,0,0.42)');
    verlauf.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = verlauf;
    bodenPfad(c, k, b.x - halb * 1.25, FLUSS_OBEN, b.x + halb * 1.25, FLUSS_UNTEN);
    c.fill();
  }

  /* --------------------------- Glanz ----------------------------- */
  c.strokeStyle = f.wasserGlanz;
  for (let i = 0; i < 3; i++) {
    const takt = zeit * (0.09 + i * 0.035) + i * 0.4;
    const lage = (takt % 1.4) - 0.2;
    if (lage < 0 || lage > 1) continue;
    const y = FLUSS_OBEN + hoehe * lage;
    /* In der Mitte am hellsten: streifendes Licht trifft die Mitte
       der Rinne, nicht die flachen Raender. */
    const mitte = 1 - Math.abs(lage - 0.5) * 2;
    c.globalAlpha = 0.06 + mitte * 0.1;
    c.lineWidth = Math.max(2, skalaBei(k, y) * tile(0.22));
    c.beginPath();
    for (let j = 0; j <= PUNKTE; j++) {
      const anteil = j / PUNKTE;
      const x = BREITE * anteil;
      const yy = y + tile(0.05) * Math.sin(anteil * 5.4 + zeit * 0.7 + i);
      const px = pxX(k, x, yy);
      const py = pxY(k, yy);
      if (j === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.stroke();
  }
  c.globalAlpha = 1;
}

/**
 * Schaum an der Wasserlinie.
 *
 * Nur ein paar helle Striche, die langsam ein- und ausblenden. Der
 * Uebergang zwischen Erde und Wasser ist sonst eine harte Kante und
 * verraet sofort, dass beides flach ist.
 */
function schaumkante(
  c: CanvasRenderingContext2D, k: Kamera, kante: number,
  zeit: number, richtung: number, f: FeldFarben,
): void {
  const y = kante + tile(0.05) * richtung;
  c.strokeStyle = f.wasserSchaum;
  c.lineWidth = Math.max(1, skalaBei(k, y) * tile(0.045));
  const stuecke = 9;
  for (let i = 0; i < stuecke; i++) {
    const mitte = (i + 0.5) / stuecke;
    // Jedes Stueck atmet in eigenem Takt.
    const puls = 0.5 + 0.5 * Math.sin(zeit * 1.1 + i * 1.7);
    c.globalAlpha = 0.2 + puls * 0.45;
    const halb = (0.02 + puls * 0.028) * BREITE;
    const x1 = BREITE * mitte - halb;
    const x2 = BREITE * mitte + halb;
    c.beginPath();
    c.moveTo(pxX(k, x1, y), pxY(k, y));
    c.lineTo(pxX(k, x2, y), pxY(k, y));
    c.stroke();
  }
  c.globalAlpha = 1;
}
