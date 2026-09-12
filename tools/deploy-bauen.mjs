/* ------------------------------------------------------------------
   Alles bauen, was hochgeladen werden soll.

   Das Hideout und die Arena sind zwei getrennte Projekte mit eigenen
   Werkzeugketten - esbuild hier, Vite dort. Dieses Skript baut beide
   und legt das Ergebnis in einen gemeinsamen dist-Ordner:

     dist/                 die Hideout-Seite
     dist/games/arena/     die Arena als eigene Seite

   Reihenfolge ist wichtig: build.mjs loescht dist/ komplett, die
   Arena muss also danach hinein.

   Aufruf:  node tools/deploy-bauen.mjs
   ------------------------------------------------------------------ */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const ARENA = path.join(ROOT, 'arena');
const ARENA_DIST = path.join(ARENA, 'packages', 'client', 'dist');
const ARENA_ZIEL = path.join(DIST, 'games', 'arena');

function schritt(text) {
  console.log('\n[36m> ' + text + '[0m');
}

function laufe(datei, argumente, cwd) {
  execFileSync(process.execPath, [datei, ...argumente], {
    cwd: cwd ?? ROOT,
    stdio: 'inherit',
  });
}

/* ------------------------- Hideout-Seite -------------------------- */

schritt('Hideout bauen');
laufe(path.join(ROOT, 'build.mjs'), []);

/* ----------------------------- Arena ------------------------------ */

const vite = path.join(ARENA, 'node_modules', 'vite', 'bin', 'vite.js');

if (!fs.existsSync(vite)) {
  /* Abbrechen, nicht ueberspringen.

     Frueher stand hier eine gelbe Zeile und der Build lief weiter mit
     Erfolgsmeldung. Das Ergebnis war eine Seite, auf der alles
     funktioniert - ausser /games/arena/, das als "Page not found" von
     Netlify erscheint. Die Ursache steht dann irgendwo mitten im
     Protokoll, waehrend ganz unten "Fertig" steht.

     Ein Build, der die Haelfte ausliefert und Erfolg meldet, ist
     schlimmer als einer, der abbricht: beim Abbruch bleibt die alte,
     heile Fassung online.

     Wer bewusst ohne Arena bauen will, sagt das ausdruecklich. */
  if (!process.argv.includes('--ohne-arena')) {
    console.error([
      '',
      'Abbruch: in arena/ fehlen die Abhaengigkeiten, die Arena liesse',
      'sich nicht bauen.',
      '',
      '  Nachholen mit:   npm ci --prefix arena',
      '  Bewusst ohne:    node tools/deploy-bauen.mjs --ohne-arena',
      '',
    ].join('\n'));
    process.exit(1);
  }
  console.log('\nArena uebersprungen - ausdruecklich verlangt.'
    + ' /games/arena/ fehlt in dieser Ausgabe.\n');
} else {
  schritt('Arena bauen');
  // Vite nimmt das Wurzelverzeichnis als Positionsargument.
  laufe(vite, ['build', path.join(ARENA, 'packages', 'client')]);

  schritt('Arena nach dist/games/arena legen');
  fs.rmSync(ARENA_ZIEL, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(ARENA_ZIEL), { recursive: true });
  fs.cpSync(ARENA_DIST, ARENA_ZIEL, { recursive: true });

  /* Quellkarten gehoeren nicht auf einen oeffentlichen Server: sie
     sind groesser als der Code selbst und verraten den kompletten
     Quelltext. Lokal bleiben sie erhalten, nur die Kopie wird
     bereinigt. */
  let entfernt = 0;
  for (const datei of fs.readdirSync(path.join(ARENA_ZIEL, 'bundle'))) {
    if (!datei.endsWith('.map')) continue;
    fs.rmSync(path.join(ARENA_ZIEL, 'bundle', datei));
    entfernt++;
  }
  if (entfernt) console.log('  ' + entfernt + ' Quellkarte(n) entfernt');

  schritt('Arena in den Offline-Vorrat des Service Workers legen');
  arenaInSw();
}

/* Immer, auch ohne Arena: gerade dann, wenn etwas fehlt, soll die
   Seite erklaeren koennen, was fehlt. */
vierhundertvier();

/* Eine eigene Seite fuer Adressen, die es nicht gibt.

   Ohne sie zeigt Netlify seine Standardseite: "Looks like you've
   followed a broken link". Die sagt dem Spieler nichts und dem
   Entwickler noch weniger - sie sieht aus, als waere die ganze Seite
   kaputt, obwohl nur ein Pfad fehlt. Genau diese Verwechslung hat
   schon einmal Zeit gekostet.

   Bewusst ohne Bilder, Schriften und Bundle: sie muss auch dann
   stehen, wenn vom Rest der Ausgabe etwas fehlt. Das ist der einzige
   Fall, in dem sie ueberhaupt jemand zu sehen bekommt. */
function vierhundertvier() {
  const seite = [
    '<!doctype html>',
    '<html lang="de">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<title>Diese Seite gibt es nicht</title>',
    '<style>',
    'html,body{height:100%}',
    'body{margin:0;display:grid;place-items:center;background:#0b1020;',
    'color:#e2e8f0;font:16px/1.6 system-ui,sans-serif;padding:24px}',
    'main{max-width:32rem;text-align:center}',
    'h1{font-size:1.6rem;margin:0 0 .6rem}',
    'p{margin:.6rem 0;color:#94a3b8}',
    'a{display:inline-block;margin-top:1.4rem;padding:.7rem 1.4rem;',
    'border-radius:.6rem;background:#2563eb;color:#fff;text-decoration:none;',
    'font-weight:600}',
    'code{color:#cbd5e1}',
    '</style>',
    '</head>',
    '<body><main>',
    '<h1>Diese Adresse gibt es hier nicht</h1>',
    '<p>Die Seite selbst läuft. Nur der Pfad, den du aufgerufen hast,',
    ' steht nicht in dieser Ausgabe.</p>',
    '<p>Wenn das ein Spiel sein sollte, das es sonst gibt, ist beim',
    ' letzten Hochladen etwas unvollständig geblieben.</p>',
    '<a href="/">Zurück zum Hideout</a>',
    '</main></body>',
    '</html>',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(DIST, '404.html'), seite, 'utf8');
}

/* Die Arena wird nach dem Hideout gebaut - build.mjs kann ihre Dateien
   also noch gar nicht kennen und laesst in sw.js eine leere Liste stehen.
   Hier wird sie gefuellt. Ohne das laege die Arena zwar auf dem Server,
   waere auf dem Home-Bildschirm ohne Netz aber nicht da - und gegen den
   Bot spielt sie ja gerade dann, wenn niemand online ist. */
function arenaInSw() {
  const swDatei = path.join(DIST, 'sw.js');
  if (!fs.existsSync(swDatei)) return;

  const dateien = [];
  (function sammeln(ordner, praefix) {
    for (const e of fs.readdirSync(ordner, { withFileTypes: true })) {
      const pfad = path.join(ordner, e.name);
      if (e.isDirectory()) sammeln(pfad, praefix + e.name + '/');
      else dateien.push(praefix + e.name);
    }
  })(ARENA_ZIEL, 'games/arena/');

  const sw = fs.readFileSync(swDatei, 'utf8');
  const marke = 'const EXTRAS = [];';
  if (sw.indexOf(marke) < 0) {
    console.log('  [33mkeine EXTRAS-Zeile in sw.js gefunden[0m');
    return;
  }
  fs.writeFileSync(swDatei,
    sw.replace(marke, 'const EXTRAS = ' + JSON.stringify(dateien) + ';'));
  console.log('  ' + dateien.length + ' Dateien');
}

/* ---------------------------- Bericht ----------------------------- */

function groesse(ordner) {
  let summe = 0;
  for (const eintrag of fs.readdirSync(ordner, { withFileTypes: true })) {
    const p = path.join(ordner, eintrag.name);
    summe += eintrag.isDirectory() ? groesse(p) : fs.statSync(p).size;
  }
  return summe;
}

const mb = (bytes) => (bytes / 1048576).toFixed(2) + ' MB';

console.log('\n[32mFertig.[0m');
console.log('  dist/              ' + mb(groesse(DIST)));
if (fs.existsSync(ARENA_ZIEL)) {
  console.log('  dist/games/arena/  ' + mb(groesse(ARENA_ZIEL)));
}
console.log('\nHochladen mit:  npx netlify deploy --prod');
console.log('Die Arena liegt danach unter  /games/arena/\n');
