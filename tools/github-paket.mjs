/* ------------------------------------------------------------------
   Das Uebergabepaket aus dem Stand bauen, der auf GitHub liegt.

   tools/projekt-paket.mjs packt das Arbeitsverzeichnis ein - also auch
   alles, was gerade halbfertig herumliegt. Zu zweit ist das fast immer
   der falsche Stand: waehrend der eine packt, schreibt der andere.

   Dieses Skript nimmt stattdessen origin/main. Es legt dafuer einen
   zweiten Arbeitsbaum in einem temporaeren Ordner an, baut dort und
   raeumt ihn hinterher weg. Dein eigenes Arbeitsverzeichnis wird nicht
   angefasst - kein stash, kein checkout, keine verlorene Zeile.

   Die Abhaengigkeiten werden nicht neu installiert, sondern aus dem
   Hauptordner verlinkt. Das spart Minuten. Damit das ehrlich bleibt,
   vergleicht das Skript vorher die Lock-Dateien: weichen sie ab,
   passen die installierten Pakete nicht zu diesem Stand, und es
   bricht ab, statt ein falsch gebautes Paket auszuliefern.

   Aufruf:  npm run paket
            npm run paket -- origin/irgendein-zweig
   ------------------------------------------------------------------ */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ZWEIG = process.argv[2] ?? 'origin/main';
const PAKET = 'Hideout-Komplett-Online.zip';

const JUNCTION = process.platform === 'win32' ? 'junction' : 'dir';
const LOCKS = ['package-lock.json', 'arena/package-lock.json'];

function git(...argumente) {
  return execFileSync('git', argumente, {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  }).trim();
}

function laufe(datei, cwd) {
  execFileSync(process.execPath, [datei], { cwd, stdio: 'inherit' });
}

function schritt(text) {
  console.log('\n[36m> ' + text + '[0m');
}

/* Beide Seiten eines Vergleichs gleich behandeln: git show liefert je
   nach core.autocrlf CRLF, die Datei auf der Platte ebenso - nur nicht
   unbedingt dieselbe von beiden. */
function zeilen(text) {
  return text.replace(/\r\n?/g, '\n').trim();
}

/* ---------------------- Stand von GitHub holen -------------------- */

schritt('Stand von GitHub holen');
git('fetch', 'origin');
const commit = git('rev-parse', '--short', ZWEIG);
console.log('  ' + commit + '  ' + git('log', '-1', '--format=%s', ZWEIG));

/* Verlinkte Pakete muessen zu diesem Stand passen, sonst baut das
   Skript den neuen Quellcode gegen alte Abhaengigkeiten. */
for (const lock of LOCKS) {
  const dort = zeilen(git('show', ZWEIG + ':' + lock));
  const hier = zeilen(fs.readFileSync(path.join(ROOT, lock), 'utf8'));
  if (dort !== hier) {
    console.error('\n[31mAbbruch:[0m ' + lock + ' auf ' + ZWEIG
      + ' weicht von deiner Fassung ab.\nErst die Pakete nachziehen:\n'
      + '  git pull\n  npm ci\n  npm ci --prefix arena\n');
    process.exit(1);
  }
}

/* ------------------ Zweiter Arbeitsbaum, temporaer ---------------- */

const baum = fs.mkdtempSync(path.join(os.tmpdir(), 'hideout-github-paket-'));
const verlinkt = [path.join(baum, 'node_modules'), path.join(baum, 'arena', 'node_modules')];
let angelegt = false;

try {
  schritt('Arbeitsbaum anlegen');
  git('worktree', 'add', '--detach', baum, ZWEIG);
  angelegt = true;

  for (const ziel of verlinkt) {
    fs.symlinkSync(path.join(ROOT, path.relative(baum, ziel)), ziel, JUNCTION);
  }

  schritt('Website und Arena bauen');
  laufe(path.join(baum, 'tools', 'deploy-bauen.mjs'), baum);

  schritt('Paket schnueren');
  laufe(path.join(baum, 'tools', 'projekt-paket.mjs'), baum);

  /* Kopieren statt umbenennen: der Arbeitsbaum liegt im Temp-Ordner und
     damit oft auf einem anderen Laufwerk als das Projekt. Umbenennen
     scheitert dort mit EXDEV. */
  const ziel = path.join(ROOT, PAKET);
  fs.rmSync(ziel, { force: true });
  fs.copyFileSync(path.join(baum, PAKET), ziel);

  console.log('\n[32mFertig.[0m');
  console.log('  ' + ziel);
  console.log('  ' + (fs.statSync(ziel).size / 1048576).toFixed(2)
    + ' MB, gebaut aus ' + commit + ' (' + ZWEIG + ')');
  console.log('\nEntpacken und der ONLINE-START.md folgen.\n');
} finally {
  /* unlink loest nur die Verknuepfung. rm wuerde den Zielordner leeren,
     und der liegt im Hauptprojekt. */
  for (const ziel of verlinkt) if (fs.existsSync(ziel)) fs.unlinkSync(ziel);
  if (angelegt) {
    try { git('worktree', 'remove', '--force', baum); }
    catch { fs.rmSync(baum, { recursive: true, force: true }); }
    git('worktree', 'prune');
  } else fs.rmSync(baum, { recursive: true, force: true });
}
