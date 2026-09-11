/* ------------------------------------------------------------------
   Bildvorlagen in auslieferbare WebP-Dateien wandeln.

   Die Vorlagen unter bildquellen/ sind ein bis zwei Megabyte gross -
   PNG mit 1024 Pixeln Kantenlaenge. Auf dem Feld wird eine Figur
   selten hoeher als achtzig Pixel dargestellt. Unveraendert
   ausgeliefert waeren das zwanzig Megabyte, die das iPad ueber WLAN
   ziehen muesste, bevor das erste Bild steht.

   WARUM UEBER DEN BROWSER

   Auf diesem Rechner gibt es kein Bildwerkzeug: kein sharp, kein
   ImageMagick, kein PIL. Eine Abhaengigkeit nur fuer diesen Schritt
   waere ein schlechter Tausch - der Browser kann PNG lesen, skalieren
   und WebP schreiben, und er steht ohnehin bereit.

   Der Ablauf: dieses Skript stellt die Vorlagen bereit und nimmt die
   fertigen Dateien wieder entgegen. Die Umrechnung selbst passiert im
   Browser auf der Seite, die es ausliefert.

     node tools/bilder-wandeln.mjs units
     dann http://localhost:4180 im Browser oeffnen

   Der freigestellte Rand wird dabei gleich weggeschnitten. Zur
   Laufzeit macht das sonst `bildZugeschnitten` bei jedem Start neu -
   und die Datei bleibt unnoetig gross, weil sie vor allem Luft
   enthaelt.
   ------------------------------------------------------------------ */

import { createServer } from 'node:http';
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const WURZEL = join(HIER, '..');
const PORT = Number(process.env['ARENA_WANDEL_PORT'] ?? 4180);

const ORDNER = process.argv[2] ?? 'units';
/** Laengste Kante der Ausgabe. */
const KANTE = Number(process.argv[3] ?? 320);
/** WebP-Qualitaet. 0.85 ist die Grenze, ab der man nichts mehr sieht. */
const GUETE = Number(process.argv[4] ?? 0.85);

const QUELLE = join(WURZEL, 'bildquellen', ORDNER);
const ZIEL = join(WURZEL, 'packages', 'client', 'public', 'assets', ORDNER);

const SEITE = `<!doctype html>
<meta charset="utf-8">
<title>Bilder wandeln</title>
<style>
  body { background:#0b0f17; color:#e2e8f0; font:14px system-ui; padding:20px; }
  #log { white-space:pre-wrap; font-family:ui-monospace, monospace; line-height:1.6; }
  .gut { color:#4ade80; } .schlecht { color:#f87171; }
</style>
<h1>Bilder wandeln</h1>
<div id="log">starte …</div>
<script type="module">
const log = document.getElementById('log');
const zeilen = [];
const sagen = (t, klasse) => {
  zeilen.push(klasse ? '<span class="' + klasse + '">' + t + '</span>' : t);
  log.innerHTML = zeilen.join('\\n');
};

const plan = await (await fetch('./liste')).json();
sagen(plan.dateien.length + ' Vorlagen, Kante ' + plan.kante + ', Güte ' + plan.guete);

/** Durchsichtigen Rand finden. Schwelle statt Null wegen weicher Kanten. */
function zuschnitt(daten, b, h) {
  let l = b, r = -1, o = h, u = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < b; x++) {
      if (daten[(y * b + x) * 4 + 3] < 12) continue;
      if (x < l) l = x; if (x > r) r = x;
      if (y < o) o = y; if (y > u) u = y;
    }
  }
  if (r < l || u < o) return null;
  return { l, o, b: r - l + 1, h: u - o + 1 };
}

let gesamtVor = 0, gesamtNach = 0;
for (const name of plan.dateien) {
  try {
    const bild = new Image();
    bild.src = './quelle/' + encodeURIComponent(name);
    /* Nicht decode(): das Versprechen loest in manchen Browserzustaenden
       nie aus, obwohl das Bild laengst vollstaendig da ist. Dann steht
       die ganze Schleife beim ersten Bild still. load kommt zuverlaessig. */
    if (!bild.complete) await new Promise((fertig, schief) => {
      bild.onload = fertig;
      bild.onerror = () => schief(new Error('Bild nicht lesbar'));
    });

    const mess = document.createElement('canvas');
    mess.width = bild.naturalWidth; mess.height = bild.naturalHeight;
    const mc = mess.getContext('2d', { willReadFrequently: true });
    mc.drawImage(bild, 0, 0);
    const roh = mc.getImageData(0, 0, mess.width, mess.height).data;
    const z = zuschnitt(roh, mess.width, mess.height) ?? { l:0, o:0, b:mess.width, h:mess.height };

    const sk = Math.min(1, plan.kante / Math.max(z.b, z.h));
    const zb = Math.max(1, Math.round(z.b * sk));
    const zh = Math.max(1, Math.round(z.h * sk));

    const aus = document.createElement('canvas');
    aus.width = zb; aus.height = zh;
    const ac = aus.getContext('2d');
    ac.imageSmoothingQuality = 'high';
    ac.drawImage(bild, z.l, z.o, z.b, z.h, 0, 0, zb, zh);

    const blob = await new Promise((f) => aus.toBlob(f, 'image/webp', plan.guete));
    const ziel = name.replace(/\\.[a-z0-9]+$/i, '') + '.webp';
    const antwort = await fetch('./ziel/' + encodeURIComponent(ziel), {
      method: 'POST', body: blob,
    });
    if (!antwort.ok) throw new Error(await antwort.text());

    gesamtNach += blob.size;
    sagen('  ' + name.padEnd(24) + ' → ' + zb + '×' + zh + '  '
      + (blob.size / 1024).toFixed(0) + ' kB', 'gut');
  } catch (e) {
    sagen('  ' + name + ' FEHLER: ' + e.message, 'schlecht');
  }
}
sagen('fertig — zusammen ' + (gesamtNach / 1024 / 1024).toFixed(2) + ' MB');
window.__fertig = true;
</script>`;

async function vorlagen() {
  const alle = await readdir(QUELLE);
  return alle.filter((n) => /\.(png|jpe?g|webp)$/i.test(n)).sort();
}

const server = createServer(async (anfrage, antwort) => {
  const pfad = decodeURIComponent((anfrage.url ?? '/').split('?')[0] ?? '/');

  try {
    if (pfad === '/' || pfad === '/index.html') {
      antwort.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      antwort.end(SEITE);
      return;
    }

    if (pfad === '/liste') {
      antwort.writeHead(200, { 'content-type': 'application/json' });
      antwort.end(JSON.stringify({ dateien: await vorlagen(), kante: KANTE, guete: GUETE }));
      return;
    }

    if (pfad.startsWith('/quelle/')) {
      // basename schneidet jeden Versuch ab, aus dem Ordner zu klettern.
      const name = basename(pfad.slice('/quelle/'.length));
      const daten = await readFile(join(QUELLE, name));
      const typ = extname(name).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
      antwort.writeHead(200, { 'content-type': typ });
      antwort.end(daten);
      return;
    }

    if (pfad.startsWith('/ziel/') && anfrage.method === 'POST') {
      const name = basename(pfad.slice('/ziel/'.length));
      if (!name.endsWith('.webp')) throw new Error('nur .webp');
      const stuecke = [];
      for await (const stueck of anfrage) stuecke.push(stueck);
      await mkdir(ZIEL, { recursive: true });
      await writeFile(join(ZIEL, name), Buffer.concat(stuecke));
      console.log(`  ${name}  ${(Buffer.concat(stuecke).length / 1024).toFixed(0)} kB`);
      antwort.writeHead(200); antwort.end('ok');
      return;
    }

    antwort.writeHead(404); antwort.end('weg');
  } catch (e) {
    antwort.writeHead(500);
    antwort.end(String(e instanceof Error ? e.message : e));
  }
});

server.listen(PORT, () => {
  console.log(`bildquellen/${ORDNER}  →  public/assets/${ORDNER}`);
  console.log(`Kante ${KANTE}, Güte ${GUETE}`);
  console.log(`Jetzt http://localhost:${PORT} im Browser öffnen.`);
});
