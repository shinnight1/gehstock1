/* ------------------------------------------------------------------
   Gehstock Ops bauen.

   Buendelt shooter/src/ mit esbuild und three.js aus den Paketen der
   Hideout-Seite (keine eigenen Abhaengigkeiten) und legt die fertige
   Seite nach <ziel>, normalerweise dist/games/shooter/:

     index.html                 die Seite
     bundle/ops.<hash>.js       Spiel samt three.js, minifiziert
     bundle/ops.<hash>.css      Oberflaeche

   Die Dateinamen tragen einen Pruefwert ihres Inhalts: der Server darf
   sie ewig zwischenspeichern (tools/handy-server.mjs), der Service
   Worker der Hideout-Seite legt sie beim ersten Oeffnen ab, und ein
   neuer Stand hat automatisch neue Namen.

   build.mjs ruft das mit auf - `npm run build` liefert den Shooter also
   immer mit, auch fuer HIDEOUT_DIST. Einzeln:  node shooter/bauen.mjs
   ------------------------------------------------------------------ */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildSync, transformSync } from 'esbuild';

const HIER = path.dirname(fileURLToPath(import.meta.url));

function pruefwert(text) {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 10);
}

export function shooterBauen(ziel) {
  const js = buildSync({
    entryPoints: [path.join(HIER, 'src', 'main.js')],
    bundle: true,
    minify: true,
    format: 'iife',
    target: 'safari15',
    write: false,
    legalComments: 'inline',
    logLevel: 'silent',
  }).outputFiles[0].text;

  const css = transformSync(fs.readFileSync(path.join(HIER, 'src', 'oberflaeche', 'stil.css'), 'utf8'), {
    loader: 'css',
    minify: true,
    target: 'safari15',
  }).code;

  /* Syntaxpruefung wie beim Hideout: parsen, nicht ausfuehren. */
  new Function(js);

  const jsName = 'ops.' + pruefwert(js) + '.js';
  const cssName = 'ops.' + pruefwert(css) + '.css';
  const html = fs.readFileSync(path.join(HIER, 'index.html'), 'utf8')
    .replace('<!--OPS-CSS-->', '<link rel="stylesheet" href="bundle/' + cssName + '">')
    .replace('<!--OPS-JS-->', '<script src="bundle/' + jsName + '" defer onerror="window.__opsLadefehler&&window.__opsLadefehler()"></script>');
  if (html.includes('<!--OPS-')) throw new Error('shooter/index.html: Platzhalter nicht ersetzt');

  fs.rmSync(ziel, { recursive: true, force: true });
  fs.mkdirSync(path.join(ziel, 'bundle'), { recursive: true });
  fs.writeFileSync(path.join(ziel, 'bundle', jsName), js);
  fs.writeFileSync(path.join(ziel, 'bundle', cssName), css);
  fs.writeFileSync(path.join(ziel, 'index.html'), html);

  return {
    dateien: ['index.html', 'bundle/' + jsName, 'bundle/' + cssName],
    bytes: Buffer.byteLength(js) + Buffer.byteLength(css) + Buffer.byteLength(html),
    js: Buffer.byteLength(js),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const root = path.resolve(HIER, '..');
  const dist = process.env.HIDEOUT_DIST ? path.resolve(process.env.HIDEOUT_DIST) : path.join(root, 'dist');
  const erg = shooterBauen(path.join(dist, 'games', 'shooter'));
  console.log('Gehstock Ops gebaut: ' + (erg.bytes / 1024).toFixed(1) + ' kB nach '
    + path.relative(root, path.join(dist, 'games', 'shooter')));
}
