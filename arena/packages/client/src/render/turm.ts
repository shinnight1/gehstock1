/* ------------------------------------------------------------------
   Tuerme als Bauwerke mit Volumen.

   Jeder Turm besteht aus Bodenschatten, Sockel, Koerper und Aufbau -
   alles aus dem Quader-Baustein, also perspektivisch korrekt. Der
   Koenig setzt statt eines Koerpers das Foto aus
   public/assets/king.png auf sein Podest; fehlt die Datei, tritt ein
   Steinturm an seine Stelle.

   Bewegt sind nur die Wimpel. Das genuegt: ein Bauwerk, an dem etwas
   weht, wirkt sofort weniger wie ein aufgestelltes Stueck Pappe.
   ------------------------------------------------------------------ */

import { KOENIG_RADIUS, SEITE_RADIUS, tile, TICKS_PRO_SEKUNDE } from '@arena/sim';
import type { Spieler, TurmArt, Turm } from '@arena/sim';
import { FARBE, MATERIAL, parteiMaterial } from './palette.js';
import { pxX, pxY, skalaBei, pxHoehe } from './kamera.js';
import type { Kamera } from './kamera.js';
import { quader, schatten, mauerwerk } from './perspektive.js';
import { figurJetzt } from '../assets/lader.js';

/* Alle Masse in Millitiles. Zwei Tiles Kantenlaenge unter dem
   Turmradius: die Bauwerke sollen ihr Feld ausfuellen, aber nicht
   ueber die Zone hinausragen, in der Einheiten sie angreifen. */
interface Bau {
  sockel: number;
  sockelHoehe: number;
  koerper: number;
  koerperHoehe: number;
  zinne: number;
  zinnen: number;
}

function bauFuer(art: TurmArt, radius: number): Bau {
  return art === 'koenig'
    ? {
      sockel: radius * 1.3, sockelHoehe: tile(0.22),
      koerper: radius * 1.24, koerperHoehe: tile(1.5),
      zinne: tile(0.38), zinnen: 3,
    }
    : {
      sockel: radius * 1.44, sockelHoehe: tile(0.24),
      koerper: radius * 1.26, koerperHoehe: tile(1.15),
      zinne: tile(0.32), zinnen: 2,
    };
}

/**
 * Ticks, die der Einsturz dauert.
 *
 * Kurz gehalten: ein Turm faellt nicht wuerdevoll. Laenger als etwa
 * eine halbe Sekunde wirkt es, als sackte er in Zeitlupe, und der
 * Moment, um den es geht, verliert seine Wucht.
 */
const EINSTURZ_TICKS = TICKS_PRO_SEKUNDE * 0.65;

/** Ab hier blendet der Schutt darunter auf. */
const SCHUTT_AB = 0.45;

export function turmZeichnen(
  c: CanvasRenderingContext2D, k: Kamera, t: Turm, zeit: number, jetzt: number,
): void {
  if (t.hp <= 0) { einsturzZeichnen(c, k, t, jetzt); return; }
  const radius = t.art === 'koenig' ? KOENIG_RADIUS : SEITE_RADIUS;
  const b = bauFuer(t.art, radius);
  const anteil = Math.max(0, Math.min(1, t.hp / t.maxHp));

  schatten(c, k, t.x, t.y, radius * 0.95, 0.9);

  // Parteifarbener Sockel - auf einen Blick erkennbar, wem er gehoert.
  quader(c, k, t.x, t.y, b.sockel, b.sockel, b.sockelHoehe, parteiMaterial(t.spieler));

  let spitze: number;
  let mitFigur = false;
  if (t.art === 'koenig') {
    const vorher = spitzeAusFigur(c, k, t, b, zeit);
    mitFigur = vorher !== null;
    spitze = vorher ?? steinAufbau(c, k, t, b, anteil);
  } else {
    spitze = steinAufbau(c, k, t, b, anteil);
  }

  /* Der Wimpel bleibt den Steintuermen vorbehalten. Ueber dem Kopf
     einer Figur sitzt er im Weg des Lebensbalkens und liest sich
     nicht als Fahne, sondern als Fleck. */
  if (!mitFigur) wimpel(c, k, t, spitze, zeit);
  lebensbalken(c, k, t, spitze, b.koerper, anteil);
}

/* ---------------------------- Einsturz ------------------------------ */

/**
 * Der gefallene Turm: erst sackt er zusammen, dann bleibt Schutt.
 *
 * Dass etwas bleibt, ist wichtiger als die Bewegung. Eine leere
 * Rasenflaeche liest sich, als haette dort nie ein Turm gestanden -
 * dabei ist genau das die Stelle, an der jetzt die Flanke offen ist
 * und man platzieren darf. Der Schutthaufen markiert sie dauerhaft.
 *
 * `jetzt` ist der Tick mit Zwischenwert, damit der Einsturz nicht in
 * zwanzig Stufen ruckelt, sondern mit der Bildrate laeuft.
 */
function einsturzZeichnen(
  c: CanvasRenderingContext2D, k: Kamera, t: Turm, jetzt: number,
): void {
  const radius = t.art === 'koenig' ? KOENIG_RADIUS : SEITE_RADIUS;
  const b = bauFuer(t.art, radius);

  /* Ohne bekannten Zeitpunkt gleich den Schutt zeigen. Der Fall tritt
     nach einem Schnappschuss auf: der Turm war schon vorher gefallen,
     der Tick des Einsturzes liegt vor dem Beginn der Aufzeichnung. */
  const seit = t.gefallenTick < 0 ? EINSTURZ_TICKS : jetzt - t.gefallenTick;
  const fortschritt = Math.max(0, Math.min(1, seit / EINSTURZ_TICKS));

  schatten(c, k, t.x, t.y, radius * 0.95, 0.9);

  /* Der Schutt blendet unter dem sackenden Bauwerk auf, statt am Ende
     hart zu erscheinen. Ein Schnitt an dieser Stelle laese den Turm
     verschwinden und den Haufen auftauchen - zwei Ereignisse, wo es
     eines sein soll. */
  if (fortschritt > SCHUTT_AB) {
    const auf = (fortschritt - SCHUTT_AB) / (1 - SCHUTT_AB);
    c.globalAlpha = Math.min(1, auf);
    schutt(c, k, t, b);
    c.globalAlpha = 1;
  }

  if (fortschritt < 1) {
    /* Zusammensacken, nicht umkippen: die Hoehe geht gegen null,
       waehrend der Grundriss leicht auseinanderlaeuft - so sieht ein
       Bauwerk aus, das in sich zusammenfaellt. Beschleunigt, weil
       nichts gleichmaessig faellt. */
    const rest = Math.pow(1 - fortschritt, 1.35);
    const breiter = 1 + fortschritt * 0.35;

    /* Deckend bleiben, solange noch etwas steht. Ein Bauwerk, das von
       Anfang an durchscheinend wird, loest sich auf statt
       einzustuerzen - erst am Ende, wenn ohnehin kaum noch Hoehe da
       ist, darf es verschwinden. */
    c.globalAlpha = Math.min(1, (1 - fortschritt) * 2.4);
    quader(
      c, k, t.x, t.y, b.sockel * breiter, b.sockel * breiter,
      b.sockelHoehe * Math.max(0.3, rest), parteiMaterial(t.spieler),
    );
    if (rest > 0.02) {
      quader(
        c, k, t.x, t.y, b.koerper * breiter, b.koerper * breiter,
        b.koerperHoehe * rest, MATERIAL.stein, b.sockelHoehe * Math.max(0.3, rest),
      );
    }
    c.globalAlpha = 1;
    return;
  }

  schutt(c, k, t, b);
}

/**
 * Schutthaufen aus drei versetzten Bloecken.
 *
 * Kein Zufall im Spiel: die Versaetze haengen an der Position des
 * Turms, damit auf beiden Geraeten derselbe Haufen liegt. Ein
 * gewuerfelter saehe bei jedem Bild anders aus.
 */
function schutt(
  c: CanvasRenderingContext2D, k: Kamera, t: Turm, b: Bau,
): void {
  const seite = b.sockel * 0.42;
  const versaetze: [number, number, number][] = [
    [-seite * 0.5, seite * 0.22, 0.5],
    [seite * 0.42, -seite * 0.16, 0.34],
    [seite * 0.02, seite * 0.5, 0.66],
  ];
  for (const [dx, dy, hoch] of versaetze) {
    quader(
      c, k, t.x + dx, t.y + dy, seite, seite * 0.86,
      b.sockelHoehe * hoch * 1.6, MATERIAL.stein,
    );
  }
  // Ein Rest der Parteifarbe bleibt liegen - man sieht, wem er gehoerte.
  quader(
    c, k, t.x - seite * 0.1, t.y - seite * 0.45, seite * 0.8, seite * 0.5,
    b.sockelHoehe * 0.4, parteiMaterial(t.spieler),
  );
}

/* --------------------------- Koenig-Foto --------------------------- */

/**
 * Der Koenig als Bild auf dem Podest. Gibt die Bildschirmhoehe der
 * Spitze zurueck.
 *
 * Begrenzt wird ueber die HOEHE, nicht die Breite: ein hochkantes
 * Foto waere sonst hoeher als die halbe Arena und liefe beim hinteren
 * Koenig aus dem Bild.
 */
function spitzeAusFigur(
  c: CanvasRenderingContext2D, k: Kamera, t: Turm, b: Bau, zeit: number,
): number | null {
  /* Zugeschnitten und fuer die Gegenseite eingefaerbt. Der Zuschnitt
     ist wichtiger, als er klingt: ohne ihn steht die Figur kleiner da,
     als sie muesste, und der Lebensbalken schwebt ueber dem
     durchsichtigen Rand des Fotos. */
  const figur = figurJetzt('king.png', t.spieler === 1 ? FARBE.seite[1] : undefined);
  if (!figur) return null;

  const quelleBreite = figur instanceof HTMLImageElement ? figur.naturalWidth : figur.width;
  const quelleHoehe = figur instanceof HTMLImageElement ? figur.naturalHeight : figur.height;
  if (!quelleBreite || !quelleHoehe) return null;

  /* Zweite Stufe aus Stein zwischen Platte und Figur. Ein Foto, das
     unmittelbar auf einer farbigen Flaeche steht, sieht aufgeklebt
     aus; die Stufe gibt ihm einen Standplatz und fuellt die Breite,
     die eine hochkante Figur allein nicht ausfuellt. */
  const stufe = tile(0.34);
  quader(
    c, k, t.x, t.y, b.sockel * 0.62, b.sockel * 0.62, stufe,
    MATERIAL.stein, b.sockelHoehe,
  );
  const fuss = pxY(k, t.y) - pxHoehe(k, t.y, b.sockelHoehe + stufe);

  const maxHoehe = pxHoehe(k, t.y, tile(2.8));
  const maxBreite = skalaBei(k, t.y) * tile(2.2);
  const verhaeltnis = quelleBreite / quelleHoehe;

  let hoehe = maxHoehe;
  let breite = hoehe * verhaeltnis;
  if (breite > maxBreite) {
    breite = maxBreite;
    hoehe = breite / verhaeltnis;
  }

  /* Ein Hauch Bewegung, damit die Figur nicht wie aufgeklebt wirkt.
     Vier Promille der Hoehe reichen - mehr sieht nach Wackelpudding
     aus. */
  const atem = Math.sin(zeit * 1.3 + t.spieler * 2.1) * hoehe * 0.004;
  c.drawImage(figur, pxX(k, t.x, t.y) - breite / 2, fuss - hoehe + atem, breite, hoehe);
  return fuss - hoehe + atem;
}

/* --------------------------- Steinaufbau --------------------------- */

/** Steinkoerper mit Zinnen. Gibt die Bildschirmhoehe der Spitze zurueck. */
function steinAufbau(
  c: CanvasRenderingContext2D, k: Kamera, t: Turm, b: Bau, anteil: number,
): number {
  quader(
    c, k, t.x, t.y, b.koerper, b.koerper, b.koerperHoehe,
    MATERIAL.stein, b.sockelHoehe,
  );

  /* Sieben Lagen statt vier. Vier liest sich noch als Streifenmuster,
     ab sechs bis acht kippt es in Mauerwerk um - die Lagen werden
     schmaler als die Steine breit sind, und genau das erkennt das
     Auge als Verband. */
  mauerwerk(
    c, k, t.x, t.y, b.koerper, b.koerper, b.koerperHoehe,
    b.sockelHoehe, 7, FARBE.steinFuge,
  );

  torbogen(c, k, t, b);
  verwitterung(c, k, t, b);

  // Schiessscharte in Parteifarbe.
  const scharteBreite = b.koerper * 0.26;
  quader(
    c, k, t.x, t.y + b.koerper / 2, scharteBreite, tile(0.06), b.koerperHoehe * 0.34,
    parteiMaterial(t.spieler), b.sockelHoehe + b.koerperHoehe * 0.3,
  );

  /* Gesims: eine Platte, die einen Tick ueber den Koerper hinaussteht.
     Sie kostet einen Quader und macht aus einer Saeule ein Bauwerk -
     die Silhouette bekommt eine Stufe, statt glatt durchzulaufen.
     Das ist nur Aussehen; der Radius, auf den Einheiten zielen,
     aendert sich nicht. */
  const gesimsHoehe = tile(0.13);
  const gesimsBasis = b.sockelHoehe + b.koerperHoehe;
  quader(
    c, k, t.x, t.y, b.koerper * 1.14, b.koerper * 1.14, gesimsHoehe,
    MATERIAL.stein, gesimsBasis,
  );

  // Zinnen als kleine Bloecke auf der Deckflaeche.
  const felder = b.zinnen * 2 - 1;
  const breite = b.koerper / (felder + 1);
  const basis = gesimsBasis + gesimsHoehe;
  for (let i = 0; i < b.zinnen; i++) {
    const versatz = -b.koerper / 2 + breite * (i * 2 + 0.5) + breite / 2;
    for (const reihe of [-1, 1]) {
      quader(
        c, k, t.x + versatz, t.y + (reihe * b.koerper) / 2.6,
        breite, breite * 0.7, b.zinne, MATERIAL.stein, basis,
      );
    }
  }

  risse(c, k, t, b, anteil);
  return pxY(k, t.y) - pxHoehe(k, t.y, basis + b.zinne);
}

/**
 * Tor an der Vorderwand.
 *
 * Ein Bauwerk ohne Eingang liest sich als Block. Der Bogen ist die
 * billigste Form, die das Auge sofort als Tuer nimmt - und weil er
 * dunkel ist, gibt er der Wand nebenbei Tiefe.
 */
function torbogen(
  c: CanvasRenderingContext2D, k: Kamera, t: Turm, b: Bau,
): void {
  const vorne = t.y + b.koerper / 2;
  const px = pxX(k, t.x, vorne);
  const boden = pxY(k, vorne) - pxHoehe(k, vorne, b.sockelHoehe);
  const breit = skalaBei(k, vorne) * b.koerper;
  const hoch = pxHoehe(k, vorne, b.koerperHoehe) * 0.4;
  const halb = breit * 0.15;

  c.fillStyle = 'rgba(12, 14, 20, 0.72)';
  c.beginPath();
  c.moveTo(px - halb, boden);
  c.lineTo(px - halb, boden - hoch * 0.55);
  c.quadraticCurveTo(px, boden - hoch * 1.25, px + halb, boden - hoch * 0.55);
  c.lineTo(px + halb, boden);
  c.closePath();
  c.fill();

  // Heller Sturz ueber dem Bogen, damit er nicht als Loch wirkt.
  c.strokeStyle = FARBE.steinFuge;
  c.lineWidth = Math.max(1, breit * 0.022);
  c.beginPath();
  c.moveTo(px - halb * 1.2, boden - hoch * 0.55);
  c.quadraticCurveTo(px, boden - hoch * 1.35, px + halb * 1.2, boden - hoch * 0.55);
  c.stroke();
}

/**
 * Verwitterung am Fuss.
 *
 * Ein paar dunkle Flecken dort, wo Regen und Erde an den Stein gehen.
 * Feste Positionen aus der Turmlage abgeleitet, damit derselbe Turm
 * bei jedem Bild dieselben Flecken hat - ein Bauwerk, dessen Patina
 * flackert, faellt sofort auf.
 */
function verwitterung(
  c: CanvasRenderingContext2D, k: Kamera, t: Turm, b: Bau,
): void {
  const vorne = t.y + b.koerper / 2;
  const px = pxX(k, t.x, vorne);
  const boden = pxY(k, vorne) - pxHoehe(k, vorne, b.sockelHoehe);
  const breit = skalaBei(k, vorne) * b.koerper;
  const hoch = pxHoehe(k, vorne, b.koerperHoehe);

  c.fillStyle = 'rgba(30, 38, 30, 0.22)';
  for (let i = 0; i < 5; i++) {
    const seite = ((t.x / 1000 + i * 7) % 5) / 5 - 0.5;
    const x = px + seite * breit * 0.8;
    const h = hoch * (0.1 + ((i * 3) % 4) * 0.05);
    c.beginPath();
    c.ellipse(x, boden - h * 0.3, breit * 0.09, h, 0, 0, Math.PI * 2);
    c.fill();
  }
}

/**
 * Risszustaende. Ab der Haelfte laeuft ein Riss ueber die Vorderwand,
 * ab einem Viertel kommt ein zweiter dazu und die Zinnen bekommen
 * Ausbrueche. Der Balken allein sagt zu wenig - man soll am Bauwerk
 * selbst sehen, wie es steht.
 */
function risse(
  c: CanvasRenderingContext2D, k: Kamera, t: Turm, b: Bau, anteil: number,
): void {
  if (anteil >= 0.5) return;
  const vorne = t.y + b.koerper / 2;
  const px = pxX(k, t.x, vorne);
  const unten = pxY(k, vorne) - pxHoehe(k, vorne, b.sockelHoehe);
  const hoch = pxHoehe(k, vorne, b.koerperHoehe);
  const breit = skalaBei(k, vorne) * b.koerper;

  c.strokeStyle = FARBE.steinRiss;
  c.lineWidth = Math.max(1, breit * 0.035);
  c.beginPath();
  c.moveTo(px - breit * 0.06, unten);
  c.lineTo(px + breit * 0.04, unten - hoch * 0.34);
  c.lineTo(px - breit * 0.1, unten - hoch * 0.62);
  c.lineTo(px + breit * 0.02, unten - hoch * 0.88);
  c.stroke();

  if (anteil >= 0.25) return;
  c.beginPath();
  c.moveTo(px + breit * 0.3, unten);
  c.lineTo(px + breit * 0.18, unten - hoch * 0.42);
  c.lineTo(px + breit * 0.32, unten - hoch * 0.7);
  c.stroke();
}

/* ----------------------------- Wimpel ------------------------------ */

/** Fahne auf der Spitze. Das einzige Bewegte am Bauwerk. */
function wimpel(
  c: CanvasRenderingContext2D, k: Kamera, t: Turm,
  spitze: number, zeit: number,
): void {
  const px = pxX(k, t.x, t.y);
  const s = skalaBei(k, t.y);
  const stange = s * tile(0.6);
  const tuch = s * tile(0.44);

  c.strokeStyle = FARBE.steinSeite;
  c.lineWidth = Math.max(1, s * tile(0.05));
  c.beginPath();
  c.moveTo(px, spitze);
  c.lineTo(px, spitze - stange);
  c.stroke();

  /* Das Tuch als Dreieck, dessen Spitze auf und ab schwingt. Zwei
     ueberlagerte Wellen wirken unregelmaessiger als eine. */
  const oben = spitze - stange;
  const weht = Math.sin(zeit * 3.1 + t.x * 0.0004) * 0.28
    + Math.sin(zeit * 5.3 + t.spieler) * 0.12;
  c.fillStyle = FARBE.seite[t.spieler];
  c.beginPath();
  c.moveTo(px, oben);
  c.lineTo(px + tuch, oben + tuch * (0.36 + weht * 0.3));
  c.lineTo(px, oben + tuch * 0.62);
  c.closePath();
  c.fill();
}

/* -------------------------- Lebensbalken --------------------------- */

function lebensbalken(
  c: CanvasRenderingContext2D, k: Kamera, t: Turm,
  spitze: number, koerper: number, anteil: number,
): void {
  const s = skalaBei(k, t.y);
  const breite = s * koerper * 1.15;
  const hoehe = Math.max(3, breite * 0.16);
  const x = pxX(k, t.x, t.y) - breite / 2;
  // Ueber der Fahne, nicht darin.
  const y = spitze - s * tile(0.32) - hoehe;

  c.fillStyle = 'rgba(4, 9, 18, 0.78)';
  c.fillRect(x - 1.5, y - 1.5, breite + 3, hoehe + 3);
  c.fillStyle = FARBE.seiteDunkel[t.spieler];
  c.fillRect(x, y, breite, hoehe);
  c.fillStyle = FARBE.seiteHell[t.spieler];
  c.fillRect(x, y, breite * anteil, hoehe);
  // Schmaler Glanz auf der oberen Haelfte - nimmt dem Balken das Flache.
  c.fillStyle = 'rgba(255, 255, 255, 0.22)';
  c.fillRect(x, y, breite * anteil, hoehe * 0.38);
}
