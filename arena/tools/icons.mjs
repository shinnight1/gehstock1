/* ------------------------------------------------------------------
   Die App-Icons erzeugen.

   Warum von Hand und nicht mit einer Bibliothek: das Projekt hat keine
   Bildwerkzeuge, und eine Abhaengigkeit nur fuer drei Dateien waere
   ein schlechter Tausch. PNG ist ausgeschrieben ueberschaubar - ein
   Kopf, ein zlib-Block mit den Bildzeilen, ein Ende, dazu je eine
   CRC-Pruefsumme. zlib bringt Node mit.

   Gezeichnet wird nicht mit einem Canvas, sondern direkt in einen
   Pixelpuffer: Hintergrund, Spielfeld in der Fluchtform, Fluss, zwei
   Bruecken, ein Turm. Also genau das, was man im Spiel sieht, auf
   Symbolgroesse eingedampft.

   Reproduzierbar heisst: derselbe Aufruf ergibt dieselben Bytes.
   Ein Icon, das sich bei jedem Lauf minimal aendert, waere in jedem
   Diff sichtbar, ohne dass sich etwas geaendert haette.

     node tools/icons.mjs
   ------------------------------------------------------------------ */

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const ZIEL = join(HIER, '..', 'packages', 'client', 'public');

/* ------------------------------ PNG -------------------------------- */

const CRC_TABELLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABELLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function block(typ, daten) {
  const kopf = Buffer.alloc(8);
  kopf.writeUInt32BE(daten.length, 0);
  kopf.write(typ, 4, 'ascii');
  const pruef = Buffer.alloc(4);
  pruef.writeUInt32BE(crc32(Buffer.concat([Buffer.from(typ, 'ascii'), daten])), 0);
  return Buffer.concat([kopf, daten, pruef]);
}

/** RGBA-Puffer als PNG. `pixel` ist breite*hoehe*4 Byte. */
function png(breite, hoehe, pixel) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(breite, 0);
  ihdr.writeUInt32BE(hoehe, 4);
  ihdr[8] = 8;   // Bit je Kanal
  ihdr[9] = 6;   // Farbtyp 6 = RGBA
  // 10..12 bleiben 0: Deflate, Standardfilter, kein Interlace.

  /* Jede Zeile bekommt ein Filterbyte vorangestellt. Filter 0 heisst
     "unveraendert" - bei Flaechen dieser Groesse spart ein klügerer
     Filter kaum etwas und macht den Code doppelt so lang. */
  const roh = Buffer.alloc(hoehe * (breite * 4 + 1));
  for (let y = 0; y < hoehe; y++) {
    const von = y * breite * 4;
    roh[y * (breite * 4 + 1)] = 0;
    pixel.copy(roh, y * (breite * 4 + 1) + 1, von, von + breite * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    block('IHDR', ihdr),
    block('IDAT', deflateSync(roh, { level: 9 })),
    block('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------------------------- Zeichnen ------------------------------ */

function leinwand(groesse) {
  const pixel = Buffer.alloc(groesse * groesse * 4);
  const setzen = (x, y, [r, g, b], a = 255) => {
    if (x < 0 || y < 0 || x >= groesse || y >= groesse) return;
    const i = (y * groesse + x) * 4;
    if (a >= 255) {
      pixel[i] = r; pixel[i + 1] = g; pixel[i + 2] = b; pixel[i + 3] = 255;
      return;
    }
    // Ueber das Vorhandene legen, damit sich Kanten weich mischen.
    const t = a / 255;
    pixel[i] = Math.round(pixel[i] * (1 - t) + r * t);
    pixel[i + 1] = Math.round(pixel[i + 1] * (1 - t) + g * t);
    pixel[i + 2] = Math.round(pixel[i + 2] * (1 - t) + b * t);
    pixel[i + 3] = Math.max(pixel[i + 3], Math.round(255 * t));
  };
  return { pixel, setzen };
}

function rechteck(l, x0, y0, x1, y1, farbe) {
  for (let y = Math.round(y0); y < Math.round(y1); y++) {
    for (let x = Math.round(x0); x < Math.round(x1); x++) l.setzen(x, y, farbe);
  }
}

/**
 * Das Spielfeld in seiner Fluchtform.
 *
 * Oben schmaler als unten, genau wie die Kamera es im Spiel zeigt.
 * `anteil` laeuft von 0 (oben) bis 1 (unten) und bestimmt die Breite.
 */
function feld(l, groesse, oben, unten, breiteOben, breiteUnten, farbeOben, farbeUnten) {
  const mitte = groesse / 2;
  for (let y = Math.round(oben); y < Math.round(unten); y++) {
    const t = (y - oben) / (unten - oben);
    const halb = (breiteOben + (breiteUnten - breiteOben) * t) / 2;
    const farbe = [
      Math.round(farbeOben[0] + (farbeUnten[0] - farbeOben[0]) * t),
      Math.round(farbeOben[1] + (farbeUnten[1] - farbeOben[1]) * t),
      Math.round(farbeOben[2] + (farbeUnten[2] - farbeOben[2]) * t),
    ];
    for (let x = Math.round(mitte - halb); x < Math.round(mitte + halb); x++) {
      l.setzen(x, y, farbe);
    }
  }
}

function icon(groesse, randAnteil) {
  const l = leinwand(groesse);
  const g = groesse;

  // Grund - dasselbe Dunkelblau wie die Huelle im Spiel.
  rechteck(l, 0, 0, g, g, [11, 15, 23]);

  const rand = g * randAnteil;
  const oben = rand;
  const unten = g - rand;
  const bOben = (g - rand * 2) * 0.52;
  const bUnten = g - rand * 2;

  feld(l, g, oben, unten, bOben, bUnten, [26, 82, 44], [46, 122, 62]);

  /* Fluss auf halber Hoehe, mit zwei Bruecken. Er ist das Merkmal,
     an dem man das Feld auch bei 32 Pixeln noch erkennt. */
  const flussOben = oben + (unten - oben) * 0.47;
  const flussUnten = oben + (unten - oben) * 0.57;
  for (let y = Math.round(flussOben); y < Math.round(flussUnten); y++) {
    const t = (y - oben) / (unten - oben);
    const halb = (bOben + (bUnten - bOben) * t) / 2;
    for (let x = Math.round(g / 2 - halb); x < Math.round(g / 2 + halb); x++) {
      l.setzen(x, y, [27, 95, 134]);
    }
    const brueckeHalb = halb * 0.17;
    for (const versatz of [-halb * 0.52, halb * 0.52]) {
      const bx = g / 2 + versatz;
      for (let x = Math.round(bx - brueckeHalb); x < Math.round(bx + brueckeHalb); x++) {
        l.setzen(x, y, [138, 90, 43]);
      }
    }
  }

  // Turm im Vordergrund: Sockel, Koerper, drei Zinnen.
  const tb = g * 0.22;
  const tx = g / 2 - tb / 2;
  const ty = oben + (unten - oben) * 0.66;
  const th = g * 0.2;
  rechteck(l, tx - tb * 0.14, ty + th, tx + tb * 1.14, ty + th + g * 0.035, [58, 76, 104]);
  rechteck(l, tx, ty, tx + tb, ty + th, [176, 182, 196]);
  rechteck(l, tx, ty, tx + tb, ty + th * 0.18, [206, 212, 224]);
  for (let i = 0; i < 3; i++) {
    const zb = tb / 5;
    rechteck(l, tx + i * zb * 2, ty - zb, tx + i * zb * 2 + zb, ty, [206, 212, 224]);
  }

  return png(g, g, l.pixel);
}

/* ------------------------------ Lauf -------------------------------- */

mkdirSync(ZIEL, { recursive: true });

const dateien = [
  ['icon-192.png', icon(192, 0.1)],
  ['icon-512.png', icon(512, 0.1)],
  // Apple schneidet selbst zu - deshalb hier weniger Rand und voll deckend.
  ['apple-touch-icon.png', icon(180, 0.06)],
];

for (const [name, daten] of dateien) {
  writeFileSync(join(ZIEL, name), daten);
  console.log(`  ${name}  ${(daten.length / 1024).toFixed(1)} kB`);
}
console.log('Icons geschrieben nach packages/client/public/');
