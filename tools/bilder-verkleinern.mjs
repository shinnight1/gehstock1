/* Verkleinert PNG-Bilder auf eine sinnvolle Anzeigegroesse.
 *
 * Hintergrund: src/assets/ wandert vollstaendig als Daten-URI in das Bundle.
 * Ein Mon-Bild mit 1254 x 1254 Punkten wiegt dort rund drei Megabyte, ein
 * fertiges wiegt neunzig Kilobyte - und fuenfzehn davon treiben die Seite von
 * acht auf dreiundfuenfzig Megabyte. Auf einem iPad im Schul-WLAN laedt das
 * nicht mehr. Die Bildpunkte werden ohnehin nie gebraucht: die Kachel in der
 * Sammlung ist gut hundert Punkte breit.
 *
 * Bewusst ohne Abhaengigkeit: Node bringt zlib mit, und mehr braucht ein
 * PNG nicht. Kodiert wird mit demselben Verfahren wie die App-Icons in
 * build.mjs.
 *
 *   node tools/bilder-verkleinern.mjs <kante> <datei...>
 *   node tools/bilder-verkleinern.mjs 384 src/assets/gm-*.png
 *
 * Bilder, die schon klein genug sind, bleiben unberuehrt.
 */
import fs from 'node:fs';
import zlib from 'node:zlib';

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c; }
  return t;
})();
function crc32(buf) { let c = -1; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePng(w, h, rgba) {
  const stride = w * 4, raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (stride + 1)] = 0; rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride); }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* Liest ein PNG und gibt es als RGBA zurueck. Unterstuetzt wird, was hier
   tatsaechlich vorkommt: acht Bit je Kanal, ohne Interlacing, als Graustufe,
   Palette, RGB oder RGBA. Alles andere bricht lieber ab, als still ein
   falsches Bild zu schreiben. */
function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('kein PNG');
  let at = 8, w = 0, h = 0, depth = 0, color = 0, interlace = 0;
  const idat = []; let plte = null, trns = null;
  while (at < buf.length) {
    const len = buf.readUInt32BE(at), type = buf.toString('latin1', at + 4, at + 8), data = buf.subarray(at + 8, at + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; color = data[9]; interlace = data[12]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'PLTE') plte = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IEND') break;
    at += 12 + len;
  }
  if (depth !== 8) throw new Error(depth + ' Bit je Kanal wird nicht unterstuetzt');
  if (interlace) throw new Error('Interlacing wird nicht unterstuetzt');
  const kanaele = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[color];
  if (!kanaele) throw new Error('Farbtyp ' + color + ' wird nicht unterstuetzt');
  const roh = zlib.inflateSync(Buffer.concat(idat)), stride = w * kanaele, zeilen = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const filter = roh[y * (stride + 1)], quelle = y * (stride + 1) + 1, ziel = y * stride;
    for (let i = 0; i < stride; i++) {
      const x = roh[quelle + i];
      const a = i >= kanaele ? zeilen[ziel + i - kanaele] : 0;
      const b = y ? zeilen[ziel - stride + i] : 0;
      const c = y && i >= kanaele ? zeilen[ziel - stride + i - kanaele] : 0;
      let wert;
      if (filter === 0) wert = x;
      else if (filter === 1) wert = x + a;
      else if (filter === 2) wert = x + b;
      else if (filter === 3) wert = x + ((a + b) >> 1);
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        wert = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      } else throw new Error('unbekannter Zeilenfilter ' + filter);
      zeilen[ziel + i] = wert & 0xff;
    }
  }
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0, n = w * h; i < n; i++) {
    const q = i * kanaele, z = i * 4;
    if (color === 3) { const idx = zeilen[q]; rgba[z] = plte[idx * 3]; rgba[z + 1] = plte[idx * 3 + 1]; rgba[z + 2] = plte[idx * 3 + 2]; rgba[z + 3] = trns && idx < trns.length ? trns[idx] : 255; }
    else if (color === 0) { rgba[z] = rgba[z + 1] = rgba[z + 2] = zeilen[q]; rgba[z + 3] = 255; }
    else if (color === 4) { rgba[z] = rgba[z + 1] = rgba[z + 2] = zeilen[q]; rgba[z + 3] = zeilen[q + 1]; }
    else if (color === 2) { rgba[z] = zeilen[q]; rgba[z + 1] = zeilen[q + 1]; rgba[z + 2] = zeilen[q + 2]; rgba[z + 3] = 255; }
    else { rgba[z] = zeilen[q]; rgba[z + 1] = zeilen[q + 1]; rgba[z + 2] = zeilen[q + 2]; rgba[z + 3] = zeilen[q + 3]; }
  }
  return { w, h, rgba };
}

/* Mittelwert ueber den ganzen Quellblock statt naechster Nachbar - sonst
   flimmern duenne Fluegel und Antennen beim Verkleinern weg. Gewichtet nach
   Deckkraft, damit die durchsichtigen Raender nicht in die Farbe bluten. */
function verkleinern(bild, kante) {
  const faktor = Math.min(1, kante / Math.max(bild.w, bild.h));
  const w = Math.max(1, Math.round(bild.w * faktor)), h = Math.max(1, Math.round(bild.h * faktor));
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y * bild.h / h), y1 = Math.max(y0 + 1, Math.floor((y + 1) * bild.h / h));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * bild.w / w), x1 = Math.max(x0 + 1, Math.floor((x + 1) * bild.w / w));
      let r = 0, g = 0, b = 0, a = 0, gewicht = 0, punkte = 0;
      for (let sy = y0; sy < y1; sy++) for (let sx = x0; sx < x1; sx++) {
        const i = (sy * bild.w + sx) * 4, alpha = bild.rgba[i + 3];
        r += bild.rgba[i] * alpha; g += bild.rgba[i + 1] * alpha; b += bild.rgba[i + 2] * alpha;
        a += alpha; gewicht += alpha; punkte++;
      }
      const z = (y * w + x) * 4;
      out[z] = gewicht ? Math.round(r / gewicht) : 0;
      out[z + 1] = gewicht ? Math.round(g / gewicht) : 0;
      out[z + 2] = gewicht ? Math.round(b / gewicht) : 0;
      out[z + 3] = Math.round(a / punkte);
    }
  }
  return { w, h, rgba: out };
}

const [kanteRoh, ...dateien] = process.argv.slice(2);
const kante = Number(kanteRoh);
if (!Number.isFinite(kante) || kante < 16 || !dateien.length) {
  console.error('Aufruf: node tools/bilder-verkleinern.mjs <kante> <datei...>');
  process.exit(1);
}
const kb = (n) => (n / 1024).toFixed(0) + ' kB';
let vorher = 0, nachher = 0, angefasst = 0;
for (const datei of dateien) {
  const alt = fs.readFileSync(datei);
  let bild;
  try { bild = decodePng(alt); }
  catch (fehler) { console.log('  uebersprungen ' + datei + ': ' + fehler.message); continue; }
  vorher += alt.length;
  if (Math.max(bild.w, bild.h) <= kante) { nachher += alt.length; console.log('  schon klein  ' + datei + ' (' + bild.w + 'x' + bild.h + ')'); continue; }
  const klein = verkleinern(bild, kante), neu = encodePng(klein.w, klein.h, klein.rgba);
  fs.writeFileSync(datei, neu);
  nachher += neu.length; angefasst++;
  console.log('  ' + datei + ': ' + bild.w + 'x' + bild.h + ' ' + kb(alt.length) + ' -> ' + klein.w + 'x' + klein.h + ' ' + kb(neu.length));
}
console.log('\n' + angefasst + ' Bild(er) verkleinert: ' + kb(vorher) + ' -> ' + kb(nachher));
