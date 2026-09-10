/* ------------------------------------------------------------------
   Canvas-Verwaltung: Groesse, Pixeldichte, Kontext.

   Auf dem iPad ist devicePixelRatio 2. Volle Dichte sieht am besten
   aus, kostet aber die vierfache Fuellrate. Deshalb ist die Dichte
   hier eine Stellschraube: faellt die Bildrate ueber laengere Zeit
   ab, senkt der Aufrufer sie (siehe leistung.ts) und die Flaeche baut
   sich neu auf, ohne dass der Rest davon etwas merkt.
   ------------------------------------------------------------------ */

export interface Flaeche {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** Groesse in CSS-Pixeln - darin rechnet aller Layout-Code. */
  breite: number;
  hoehe: number;
  /** Aktuell verwendete Pixeldichte. */
  dichte: number;
  /** Neu vermessen. Gibt true zurueck, wenn sich etwas geaendert hat. */
  vermessen(): boolean;
  /** Pixeldichte setzen, z. B. beim Herunterschalten. */
  dichteSetzen(wert: number): void;
  zerstoeren(): void;
}

const MAX_DICHTE = 2;

export function flaecheAnlegen(eltern: HTMLElement): Flaeche {
  const canvas = document.createElement('canvas');
  canvas.className = 'arena-flaeche';
  eltern.appendChild(canvas);

  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas 2D nicht verfuegbar');

  let dichte = Math.min(window.devicePixelRatio || 1, MAX_DICHTE);
  let breite = 0;
  let hoehe = 0;

  const anwenden = (): boolean => {
    const kasten = canvas.getBoundingClientRect();
    const neuBreite = Math.max(1, Math.round(kasten.width));
    const neuHoehe = Math.max(1, Math.round(kasten.height));
    const pixelBreite = Math.round(neuBreite * dichte);
    const pixelHoehe = Math.round(neuHoehe * dichte);

    if (canvas.width === pixelBreite && canvas.height === pixelHoehe
      && breite === neuBreite && hoehe === neuHoehe) {
      return false;
    }

    breite = neuBreite;
    hoehe = neuHoehe;
    canvas.width = pixelBreite;
    canvas.height = pixelHoehe;
    // Ab hier rechnet aller Zeichencode in CSS-Pixeln.
    ctx.setTransform(dichte, 0, 0, dichte, 0, 0);
    ctx.imageSmoothingEnabled = true;
    return true;
  };

  anwenden();

  const beobachter = new ResizeObserver(() => { anwenden(); });
  beobachter.observe(canvas);

  return {
    canvas,
    ctx,
    get breite() { return breite; },
    get hoehe() { return hoehe; },
    get dichte() { return dichte; },
    vermessen: anwenden,
    dichteSetzen(wert: number) {
      const neu = Math.max(0.75, Math.min(wert, MAX_DICHTE));
      if (Math.abs(neu - dichte) < 0.01) return;
      dichte = neu;
      // Erzwingen, sonst faende anwenden() keine Aenderung.
      canvas.width = 0;
      anwenden();
    },
    zerstoeren() {
      beobachter.disconnect();
      canvas.remove();
    },
  };
}
