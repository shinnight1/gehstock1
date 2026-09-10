/* ------------------------------------------------------------------
   Karten spielen: ziehen oder zweimal tippen.

   Beide Wege fuehren zum selben Zug, und beide muessen funktionieren -
   Ziehen fuehlt sich direkter an, Tippen ist genauer, wenn das Feld
   klein ist. Wer die Karte nur antippt, waehlt sie aus; der naechste
   Tipp auf das Feld setzt sie. Wer sie zieht und loslaesst, setzt sie
   sofort.

   Ausschliesslich Pointer Events. Mouse Events wuerden auf dem iPad
   erst nach 300 Millisekunden kommen und Multitouch gar nicht
   abbilden. Der aktive Zeiger wird ueber setPointerCapture gehalten,
   damit ein Finger, der ueber den Rand rutscht, den Zug nicht
   abbricht.
   ------------------------------------------------------------------ */

import { mtX, mtY, trifftArena } from '../render/kamera.js';
import type { Kamera } from '../render/kamera.js';
import type { HudLage } from './hud.js';

export interface Eingabe {
  /** Gewaehlter Handplatz, -1 wenn keiner. */
  gewaehlt: number;
  /** Laeuft gerade eine Ziehbewegung? */
  zieht: boolean;
  /** Zeigerposition in CSS-Pixeln, -1 wenn kein Zeiger unterwegs. */
  zeigerX: number;
  zeigerY: number;
  /** Sim-Koordinaten unter dem Zeiger. */
  feldX: number;
  feldY: number;
  /** Liegt der Zeiger auf dem Feld? */
  ueberFeld: boolean;
  zerstoeren(): void;
}

export interface EingabeHaken {
  /** Wo die Karten liegen - wird bei jedem Bild neu gesetzt. */
  lage(): HudLage;
  kamera(): Kamera;
  /** Zug ausloesen. Gibt true, wenn er angenommen wurde. */
  spielen(platz: number, x: number, y: number): boolean;
  /** Darf hier gesetzt werden? Fuer die Vorschau waehrend des Ziehens. */
  erlaubt(platz: number, x: number, y: number): boolean;
}

export function eingabeAnlegen(
  canvas: HTMLCanvasElement, haken: EingabeHaken,
): Eingabe {
  const zustand: Eingabe = {
    gewaehlt: -1, zieht: false,
    zeigerX: -1, zeigerY: -1, feldX: 0, feldY: 0, ueberFeld: false,
    zerstoeren: () => { /* unten ersetzt */ },
  };

  let aktiverZeiger = -1;
  /* Ob der Zeiger auf einer Karte begonnen hat. Nur dann ist es ein
     Ziehen; ein Wisch, der auf dem Feld beginnt, soll nichts setzen. */
  let startAufKarte = false;

  const lokal = (e: PointerEvent): { x: number; y: number } => {
    const k = canvas.getBoundingClientRect();
    return { x: e.clientX - k.left, y: e.clientY - k.top };
  };

  const kartenTreffer = (x: number, y: number): number => {
    for (const f of haken.lage().karten) {
      if (!f.kartenId) continue;
      if (x >= f.x && x <= f.x + f.breite && y >= f.y && y <= f.y + f.hoehe) {
        return f.platz;
      }
    }
    return -1;
  };

  const feldSetzen = (x: number, y: number): void => {
    const k = haken.kamera();
    zustand.zeigerX = x;
    zustand.zeigerY = y;
    zustand.ueberFeld = trifftArena(k, x, y);
    zustand.feldY = mtY(k, y);
    zustand.feldX = mtX(k, x, zustand.feldY);
  };

  const versuchen = (): void => {
    if (zustand.gewaehlt < 0 || !zustand.ueberFeld) return;
    if (haken.spielen(zustand.gewaehlt, zustand.feldX, zustand.feldY)) {
      zustand.gewaehlt = -1;
    }
  };

  const runter = (e: PointerEvent): void => {
    if (aktiverZeiger !== -1) return;
    aktiverZeiger = e.pointerId;
    canvas.setPointerCapture(e.pointerId);

    const { x, y } = lokal(e);
    const platz = kartenTreffer(x, y);

    if (platz >= 0) {
      // Zweiter Tipp auf dieselbe Karte hebt die Auswahl auf.
      zustand.gewaehlt = zustand.gewaehlt === platz ? -1 : platz;
      zustand.zieht = zustand.gewaehlt >= 0;
      startAufKarte = true;
      feldSetzen(x, y);
      return;
    }

    startAufKarte = false;
    feldSetzen(x, y);
    // Tipp auf das Feld bei gewaehlter Karte: sofort setzen.
    versuchen();
  };

  const bewegen = (e: PointerEvent): void => {
    if (e.pointerId !== aktiverZeiger) return;
    const { x, y } = lokal(e);
    feldSetzen(x, y);
  };

  const hoch = (e: PointerEvent): void => {
    if (e.pointerId !== aktiverZeiger) return;
    aktiverZeiger = -1;
    try { canvas.releasePointerCapture(e.pointerId); } catch { /* schon weg */ }

    const { x, y } = lokal(e);
    feldSetzen(x, y);

    /* Losgelassen ueber dem Feld, nachdem auf einer Karte begonnen
       wurde: das war ein Ziehen und setzt die Karte. Losgelassen auf
       der Karte selbst: das war ein Tipp, die Auswahl bleibt stehen. */
    if (startAufKarte && zustand.ueberFeld) versuchen();

    zustand.zieht = false;
    zustand.zeigerX = -1;
    zustand.zeigerY = -1;
    zustand.ueberFeld = false;
    startAufKarte = false;
  };

  const abbruch = (e: PointerEvent): void => {
    if (e.pointerId !== aktiverZeiger) return;
    aktiverZeiger = -1;
    zustand.zieht = false;
    zustand.zeigerX = -1;
    zustand.ueberFeld = false;
    startAufKarte = false;
  };

  canvas.addEventListener('pointerdown', runter);
  canvas.addEventListener('pointermove', bewegen);
  canvas.addEventListener('pointerup', hoch);
  canvas.addEventListener('pointercancel', abbruch);

  zustand.zerstoeren = (): void => {
    canvas.removeEventListener('pointerdown', runter);
    canvas.removeEventListener('pointermove', bewegen);
    canvas.removeEventListener('pointerup', hoch);
    canvas.removeEventListener('pointercancel', abbruch);
  };

  return zustand;
}
