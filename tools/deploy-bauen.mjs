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
  console.log('\n[33mArena uebersprungen:[0m in arena/ fehlen die '
    + 'Abhaengigkeiten.\nEinmalig nachholen mit:  cd arena && npm install\n');
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
