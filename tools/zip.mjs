/* ------------------------------------------------------------------
   Minimaler ZIP-Schreiber.

   Warum nicht Compress-Archive? Weil es unter Windows PowerShell die
   Pfade mit Backslash in das Archiv schreibt: "assets\app.js" statt
   "assets/app.js". Der ZIP-Standard verlangt Schraegstriche. Auf
   einem Linux-Server - und Netlify ist einer - entsteht daraus keine
   Ordnerstruktur, sondern eine Datei, die woertlich
   "assets\app.js" heisst. Die Seite laedt dann und findet nichts.

   Deshalb hier von Hand: deflate kommt aus zlib, den Rest machen
   drei Datensaetze. Kein Zip64, kein Verschluesseln - fuer ein paar
   Megabyte statischer Dateien braucht es das nicht.
   ------------------------------------------------------------------ */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

/* ----------------------------- CRC32 ------------------------------ */

const crcTabelle = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTabelle[n] = c;
}

function crc32(puffer) {
  let c = -1;
  for (let i = 0; i < puffer.length; i++) {
    c = crcTabelle[(c ^ puffer[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ -1) >>> 0;
}

/* -------------------------- DOS-Zeitstempel ------------------------ */

/** ZIP speichert die Uhrzeit im Format von MS-DOS, sekundengenau/2. */
function dosZeit(datum) {
  const jahr = Math.max(1980, datum.getFullYear());
  return {
    zeit: (datum.getHours() << 11) | (datum.getMinutes() << 5)
      | (datum.getSeconds() >> 1),
    datum: ((jahr - 1980) << 9) | ((datum.getMonth() + 1) << 5) | datum.getDate(),
  };
}

/* ---------------------------- Sammeln ------------------------------ */

/** Alle Dateien unter `wurzel`, Pfade relativ und mit Schraegstrich. */
export function dateienSammeln(wurzel, unterordner = '') {
  const treffer = [];
  const voll = path.join(wurzel, unterordner);
  for (const eintrag of fs.readdirSync(voll, { withFileTypes: true })) {
    const relativ = unterordner ? unterordner + '/' + eintrag.name : eintrag.name;
    if (eintrag.isDirectory()) {
      treffer.push(...dateienSammeln(wurzel, relativ));
    } else if (eintrag.isFile()) {
      treffer.push(relativ);
    }
  }
  return treffer;
}

/* ---------------------------- Schreiben ---------------------------- */

/**
 * Verzeichnisinhalt als ZIP schreiben.
 *
 * Der Inhalt landet im Wurzelverzeichnis des Archivs, nicht in einem
 * Unterordner - genau das erwartet Netlify beim manuellen Upload.
 * Leere Ordner werden weggelassen, sie tragen nichts bei.
 */
export function zipSchreiben(quellordner, zieldatei) {
  const namen = dateienSammeln(quellordner).sort();
  const lokale = [];
  const zentrale = [];
  let versatz = 0;

  for (const name of namen) {
    const roh = fs.readFileSync(path.join(quellordner, name));
    const gepackt = zlib.deflateRawSync(roh, { level: 9 });
    /* Nur packen, wenn es sich lohnt. Bei bereits komprimierten
       Dateien - PNG etwa - wird deflate sonst groesser als das
       Original. */
    const nutzeDeflate = gepackt.length < roh.length;
    const daten = nutzeDeflate ? gepackt : roh;
    const verfahren = nutzeDeflate ? 8 : 0;

    const nameBytes = Buffer.from(name, 'utf8');
    const pruef = crc32(roh);
    const { zeit, datum } = dosZeit(fs.statSync(path.join(quellordner, name)).mtime);

    const kopf = Buffer.alloc(30);
    kopf.writeUInt32LE(0x04034b50, 0);
    kopf.writeUInt16LE(20, 4);          // benoetigte Version
    kopf.writeUInt16LE(0x0800, 6);      // Bit 11: Name ist UTF-8
    kopf.writeUInt16LE(verfahren, 8);
    kopf.writeUInt16LE(zeit, 10);
    kopf.writeUInt16LE(datum, 12);
    kopf.writeUInt32LE(pruef, 14);
    kopf.writeUInt32LE(daten.length, 18);
    kopf.writeUInt32LE(roh.length, 22);
    kopf.writeUInt16LE(nameBytes.length, 26);
    kopf.writeUInt16LE(0, 28);          // kein Zusatzfeld

    lokale.push(kopf, nameBytes, daten);

    const eintrag = Buffer.alloc(46);
    eintrag.writeUInt32LE(0x02014b50, 0);
    eintrag.writeUInt16LE(20, 4);       // erzeugende Version
    eintrag.writeUInt16LE(20, 6);
    eintrag.writeUInt16LE(0x0800, 8);
    eintrag.writeUInt16LE(verfahren, 10);
    eintrag.writeUInt16LE(zeit, 12);
    eintrag.writeUInt16LE(datum, 14);
    eintrag.writeUInt32LE(pruef, 16);
    eintrag.writeUInt32LE(daten.length, 20);
    eintrag.writeUInt32LE(roh.length, 24);
    eintrag.writeUInt16LE(nameBytes.length, 28);
    eintrag.writeUInt16LE(0, 30);       // Zusatzfeld
    eintrag.writeUInt16LE(0, 32);       // Kommentar
    eintrag.writeUInt16LE(0, 34);       // Datentraeger
    eintrag.writeUInt16LE(0, 36);       // interne Merkmale
    // Unix-Rechte 644. Der Schiebeoperator rechnet vorzeichenbehaftet,
    // deshalb multiplizieren - sonst wird der Wert negativ.
    eintrag.writeUInt32LE(0o100644 * 65536, 38);
    eintrag.writeUInt32LE(versatz, 42);

    zentrale.push(eintrag, nameBytes);
    versatz += kopf.length + nameBytes.length + daten.length;
  }

  const verzeichnis = Buffer.concat(zentrale);
  const ende = Buffer.alloc(22);
  ende.writeUInt32LE(0x06054b50, 0);
  ende.writeUInt16LE(0, 4);
  ende.writeUInt16LE(0, 6);
  ende.writeUInt16LE(namen.length, 8);
  ende.writeUInt16LE(namen.length, 10);
  ende.writeUInt32LE(verzeichnis.length, 12);
  ende.writeUInt32LE(versatz, 16);
  ende.writeUInt16LE(0, 20);

  fs.writeFileSync(zieldatei, Buffer.concat([
    ...lokale, verzeichnis, ende,
  ]));

  return { dateien: namen.length, bytes: fs.statSync(zieldatei).size };
}
