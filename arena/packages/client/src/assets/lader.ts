/* ------------------------------------------------------------------
   Bilder laden - mit Ersatz, wenn es sie nicht gibt.

   V1 zeichnet fast alles aus Primitiven. Einzelne PNGs sollen sich
   aber jederzeit nachreichen lassen, ohne dass Code angefasst wird:
   Datei nach public/assets/ legen, fertig. Fehlt sie, liefert der
   Lader null und der Zeichencode nimmt seine Ersatzform.

   Geladen wird genau einmal pro Pfad. Ein fehlgeschlagener Ladeversuch
   wird ebenfalls gemerkt, damit nicht jeder Frame eine neue Anfrage
   ausloest.
   ------------------------------------------------------------------ */

type Eintrag = { bild: HTMLImageElement | null };

const speicher = new Map<string, Eintrag>();
const laufend = new Map<string, Promise<HTMLImageElement | null>>();

/** Basis fuer alle Asset-Pfade. import.meta.env.BASE_URL endet auf '/'. */
function pfad(datei: string): string {
  const basis = import.meta.env.BASE_URL || './';
  return basis + 'assets/' + datei;
}

export function bildLaden(datei: string): Promise<HTMLImageElement | null> {
  const vorhanden = laufend.get(datei);
  if (vorhanden) return vorhanden;

  const versprechen = new Promise<HTMLImageElement | null>((fertig) => {
    const bild = new Image();
    bild.decoding = 'async';
    bild.onload = () => { speicher.set(datei, { bild }); fertig(bild); };
    bild.onerror = () => { speicher.set(datei, { bild: null }); fertig(null); };
    bild.src = pfad(datei);
  });

  laufend.set(datei, versprechen);
  return versprechen;
}

/**
 * Sofortiger Zugriff aus der Zeichenschleife heraus.
 * Gibt null, solange nichts geladen ist - der Aufrufer zeichnet dann
 * seine Ersatzform. Kein Warten, kein await im Renderpfad.
 */
export function bildJetzt(datei: string): HTMLImageElement | null {
  const e = speicher.get(datei);
  if (e) return e.bild;
  if (!laufend.has(datei)) void bildLaden(datei);
  return null;
}

/* --------------------------- Zuschneiden --------------------------- */

const beschnitten = new Map<string, HTMLCanvasElement | null>();

/**
 * Durchsichtigen Rand wegschneiden.
 *
 * Ein freigestelltes Foto hat fast immer Luft um die Figur herum.
 * Zeichnet man es unbesehen, steht die Figur zu klein auf ihrem
 * Podest und der Lebensbalken schwebt ueber leerem Raum. Nach dem
 * Zuschnitt fuellt die Figur ihren Rahmen wirklich aus, und die
 * Oberkante des Bildes ist auch die Oberkante des Kopfes.
 *
 * Laeuft genau einmal pro Bild. Ergebnis wird gemerkt.
 */
export function bildZugeschnitten(bild: HTMLImageElement): HTMLCanvasElement | null {
  const vorhanden = beschnitten.get(bild.src);
  if (vorhanden !== undefined) return vorhanden;

  const w = bild.naturalWidth;
  const h = bild.naturalHeight;
  if (!w || !h) return null;

  const mess = document.createElement('canvas');
  mess.width = w;
  mess.height = h;
  const mc = mess.getContext('2d', { willReadFrequently: true });
  if (!mc) { beschnitten.set(bild.src, null); return null; }
  mc.drawImage(bild, 0, 0);

  let daten: Uint8ClampedArray;
  try {
    daten = mc.getImageData(0, 0, w, h).data;
  } catch {
    // Sollte nie passieren - das Bild kommt von derselben Herkunft.
    beschnitten.set(bild.src, null);
    return null;
  }

  /* Schwelle statt strikter Null: weiche Freistellungskanten haben
     einen Saum aus fast durchsichtigen Pixeln, der sonst mitgezaehlt
     wird und den Zuschnitt wirkungslos macht. */
  const schwelle = 12;
  let links = w;
  let rechts = -1;
  let oben = h;
  let unten = -1;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (daten[(y * w + x) * 4 + 3]! < schwelle) continue;
      if (x < links) links = x;
      if (x > rechts) rechts = x;
      if (y < oben) oben = y;
      if (y > unten) unten = y;
    }
  }

  if (rechts < links || unten < oben) {
    beschnitten.set(bild.src, null);
    return null;
  }

  const nb = rechts - links + 1;
  const nh = unten - oben + 1;
  // Nichts zu holen - das Original tut es auch.
  if (nb === w && nh === h) { beschnitten.set(bild.src, null); return null; }

  const flaeche = document.createElement('canvas');
  flaeche.width = nb;
  flaeche.height = nh;
  const c = flaeche.getContext('2d');
  if (!c) { beschnitten.set(bild.src, null); return null; }
  c.drawImage(bild, links, oben, nb, nh, 0, 0, nb, nh);

  beschnitten.set(bild.src, flaeche);
  return flaeche;
}

/**
 * Fertige Figur: zugeschnitten und bei Bedarf eingefaerbt. Gibt null,
 * solange nichts geladen ist - der Aufrufer zeichnet dann seine
 * Ersatzform.
 */
export function figurJetzt(
  datei: string, farbe?: string, staerke = 0.45,
): HTMLCanvasElement | HTMLImageElement | null {
  const bild = bildJetzt(datei);
  if (!bild || !bild.naturalWidth) return null;
  const quelle = bildZugeschnitten(bild) ?? bild;
  if (!farbe) return quelle;
  return bildGetoent(quelle, farbe, staerke) ?? quelle;
}

/* --------------------------- Einfaerben ---------------------------- */

const getoent = new Map<string, HTMLCanvasElement>();

/**
 * Bild einmalig in eine Farbe tauchen. Der Alphakanal bleibt erhalten,
 * das freigestellte Foto behaelt also seine Silhouette.
 *
 * `staerke` 0 laesst das Bild unveraendert, 1 faerbt es voll ein. Fuer
 * die gegnerische Seite reicht etwa 0.45: erkennbar rot, aber das
 * Gesicht bleibt zu sehen.
 *
 * Das Ergebnis wird gemerkt. Einfaerben im Renderpfad waere auf dem
 * iPad sofort ein Ruckler.
 */
export function bildGetoent(
  bild: HTMLImageElement | HTMLCanvasElement, farbe: string, staerke: number,
): HTMLCanvasElement | null {
  const istBild = bild instanceof HTMLImageElement;
  const w = istBild ? bild.naturalWidth : bild.width;
  const h = istBild ? bild.naturalHeight : bild.height;
  if (!w || !h) return null;

  const schluessel = (istBild ? bild.src : 'canvas:' + w + 'x' + h)
    + '|' + farbe + '|' + staerke.toFixed(2);
  const fertig = getoent.get(schluessel);
  if (fertig) return fertig;

  const flaeche = document.createElement('canvas');
  flaeche.width = w;
  flaeche.height = h;
  const ctx = flaeche.getContext('2d');
  if (!ctx) return null;

  ctx.drawImage(bild, 0, 0);
  // source-atop faerbt nur, wo das Bild deckend ist - der transparente
  // Hintergrund bleibt transparent.
  ctx.globalCompositeOperation = 'source-atop';
  ctx.globalAlpha = staerke;
  ctx.fillStyle = farbe;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  getoent.set(schluessel, flaeche);
  return flaeche;
}
