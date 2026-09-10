/* ------------------------------------------------------------------
   Ein ZIP zum Hochladen bauen.

   Fuer den Weg ueber die Netlify-Oberflaeche: Datei in das Drop-Feld
   ziehen, fertig. Das ZIP enthaelt den Inhalt von dist/ - nicht den
   dist-Ordner selbst, sonst laege die Seite spaeter unter /dist/.

   Beim manuellen Upload liest Netlify die netlify.toml NICHT. Die
   Regeln daraus muessen deshalb als _headers und _redirects im
   Paket liegen; dieses Skript erzeugt sie aus derselben Quelle,
   damit es keine zweite Wahrheit gibt.

   Was NICHT mitkommt: die Netlify Function unter netlify/functions/.
   Die braucht einen Bundler und laesst sich nur ueber die CLI
   ausliefern. Alles, was ueber /api/ laeuft, bleibt nach einem
   ZIP-Upload also tot.

   Aufruf:  node tools/deploy-paket.mjs
   ------------------------------------------------------------------ */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { zipSchreiben } from './zip.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const PAKET = path.join(ROOT, 'hideout-netlify.zip');

/* ------------------- netlify.toml auslesen ------------------------ */

/**
 * Winziger Leser fuer genau die beiden Tabellenarten, die hier
 * vorkommen. Kein vollstaendiger TOML-Parser - der waere eine
 * Abhaengigkeit, und das Projekt kommt bewusst ohne aus.
 */
function regelnLesen() {
  const text = fs.readFileSync(path.join(ROOT, 'netlify.toml'), 'utf8');
  const headers = [];
  const redirects = [];
  let aktuell = null;
  let inWerten = false;

  for (const roh of text.split(/\r?\n/)) {
    const zeile = roh.trim();
    if (!zeile || zeile.startsWith('#')) continue;

    if (zeile === '[[headers]]') {
      aktuell = { art: 'header', fuer: '', werte: {} };
      headers.push(aktuell);
      inWerten = false;
      continue;
    }
    if (zeile === '[[redirects]]') {
      aktuell = { art: 'redirect', von: '', nach: '', status: '301' };
      redirects.push(aktuell);
      inWerten = false;
      continue;
    }
    if (zeile.startsWith('[') && zeile !== '[headers.values]') {
      aktuell = null;
      inWerten = false;
      continue;
    }
    if (zeile === '[headers.values]') { inWerten = true; continue; }
    if (!aktuell) continue;

    const treffer = zeile.match(/^([A-Za-z0-9_-]+)\s*=\s*"(.*)"$/);
    if (!treffer) continue;
    const [, schluessel, wert] = treffer;

    if (aktuell.art === 'header') {
      if (schluessel === 'for') aktuell.fuer = wert;
      else if (inWerten) aktuell.werte[schluessel] = wert;
    } else {
      if (schluessel === 'from') aktuell.von = wert;
      else if (schluessel === 'to') aktuell.nach = wert;
    }
    const zahl = zeile.match(/^status\s*=\s*(\d+)$/);
    if (zahl && aktuell.art === 'redirect') aktuell.status = zahl[1];
  }

  // status steht ohne Anfuehrungszeichen und faellt oben durch.
  const statusZeilen = text.split(/\r?\n/)
    .filter((z) => /^\s*status\s*=/.test(z))
    .map((z) => z.replace(/\D/g, ''));
  redirects.forEach((r, i) => { if (statusZeilen[i]) r.status = statusZeilen[i]; });

  return { headers, redirects };
}

function regelnSchreiben() {
  const { headers, redirects } = regelnLesen();

  const kopfText = headers.map((h) => {
    const werte = Object.entries(h.werte)
      .map(([k, v]) => '  ' + k + ': ' + v)
      .join('\n');
    return h.fuer + '\n' + werte;
  }).join('\n\n');

  fs.writeFileSync(
    path.join(DIST, '_headers'),
    '# Erzeugt von tools/deploy-paket.mjs aus netlify.toml.\n'
    + '# Nicht von Hand aendern - die Quelle ist netlify.toml.\n\n'
    + kopfText + '\n',
    'utf8',
  );

  const umText = redirects
    .map((r) => r.von + '  ' + r.nach + '  ' + r.status)
    .join('\n');
  fs.writeFileSync(
    path.join(DIST, '_redirects'),
    '# Erzeugt von tools/deploy-paket.mjs aus netlify.toml.\n'
    + umText + '\n',
    'utf8',
  );

  return { anzahlHeaders: headers.length, anzahlRedirects: redirects.length };
}

/* ---------------------------- Ablauf ------------------------------ */

console.log('\n[36m> Alles bauen[0m');
execFileSync(process.execPath, [path.join(ROOT, 'tools', 'deploy-bauen.mjs')], {
  cwd: ROOT, stdio: 'inherit',
});

console.log('\n[36m> Regeln aus netlify.toml uebernehmen[0m');
const zahlen = regelnSchreiben();
console.log('  _headers    ' + zahlen.anzahlHeaders + ' Regeln');
console.log('  _redirects  ' + zahlen.anzahlRedirects + ' Regeln');

console.log('\n[36m> ZIP schnueren[0m');
fs.rmSync(PAKET, { force: true });
const bericht = zipSchreiben(DIST, PAKET);

const mb = (bericht.bytes / 1048576).toFixed(2);
console.log('\n[32mFertig.[0m');
console.log('  ' + PAKET);
console.log('  ' + bericht.dateien + ' Dateien, ' + mb + ' MB');
console.log('\nAuf https://app.netlify.com/drop ziehen.');
console.log('Achtung: /api/ funktioniert danach nicht - dafuer braucht es');
console.log('die CLI (npx netlify deploy --prod).\n');
