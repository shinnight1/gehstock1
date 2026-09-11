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

import { BREITE, FLUSS_OBEN, FLUSS_UNTEN, tile } from '@arena/sim';
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
