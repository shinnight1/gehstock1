/* Build fuer "Herr Gehstocks Hideout"
 *
 * Erzeugt:
 *   dist/index.html                                  Online-Seite (Vercel)
 *   dist/assets/app.<hash>.css|js                    gebuendelt, cachebar
 *   dist/offline/Herr-Gehstocks-Hideout-Offline.html Einzeldatei fuer die Dateien-App
 *   dist/manifest.webmanifest, dist/sw.js, Icons
 *
 * Bewusst ohne Abhaengigkeiten und ohne ES-Module im Ergebnis:
 * WebKit blockiert unter file:// sowohl Modul-Imports als auch Worker.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { buildNoJs, NOJS_ANZAHL } from './tools/nojs.mjs';
import { abziehen, pruefen } from './tools/kleiner.mjs';
import { buildSync, transformSync } from 'esbuild';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ROOT, 'src');
// HIDEOUT_DIST: anderer Ausgabeordner - das Handy baut daneben und tauscht dann in einem Schritt.
const DIST = process.env.HIDEOUT_DIST ? path.resolve(process.env.HIDEOUT_DIST) : path.join(ROOT, 'dist');

const APP_NAME = 'Herr Gehstocks Hideout';
const OFFLINE_FILE = 'Herr-Gehstocks-Hideout-Offline.html';

/* ------------------------------------------------------------------ Reihenfolge */

const CSS_ORDER = [
  'styles/base.css',
  'styles/shell.css',
  'styles/dienst.css',
  'styles/games.css',
  'styles/tycoon.css',
  'styles/gehstockmon.css',
  'styles/gehstockmon-abenteuer.css',
  'styles/gehstockmon-dungeons.css',
  'styles/gehstockmon-alltag.css',
];

const CORE_ORDER = [
  'core/namespace.js',
  'core/util.js',
  'core/storage.js',
  'core/settings.js',
  'core/audio.js',
  'core/gfx.js',
  'core/kulisse.js',
  'core/canvas.js',
  'core/loop.js',
  'core/input.js',
  'core/ui.js',
  'core/scores.js',
  'core/fortschritt.js',
  'core/tutorial.js',
  'core/host.js',
  'core/relais.js',
  'core/net.js',
  'core/verwaltung.js',
  'core/auth.js',
  'core/protokoll.js',
  'core/registry.js',
  'core/tarnung.js',
  'core/spiegel.js',
  'core/chat.js',
  'core/verhoer.js',
  'core/bnd.js',
  'core/meeting.js',
  'core/flix.js',
  'core/dev.js',
  'core/adminraum.js',
  'core/hub.js',
  'core/offline.js',
  'core/profil.js',
  'core/credits.js',
  'core/gate.js',
  'core/geschenke.js',
  'core/admin.js',
  'core/kreis.js',
  'core/wache.js',
  'core/ansage.js',
  'core/router.js',
  'core/invariants.js',
  'core/selftest.js',
];

const TAIL_ORDER = ['core/boot.js'];

/* ------------------------------------------------------------------ Helfer */

const log = (...a) => console.log(...a);
const read = (p) => fs.readFileSync(p, 'utf8');
const exists = (p) => fs.existsSync(p);

function walk(dir, out = []) {
  if (!exists(dir)) return out;
  const entries = fs.readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function collectJs() {
  const files = [];
  const push = (rel) => {
    const abs = path.join(SRC, rel);
    if (!exists(abs)) throw new Error('Datei fehlt: src/' + rel);
    files.push(abs);
  };
  for (const rel of CORE_ORDER) push(rel);

  const auto = [
    ...walk(path.join(SRC, 'data')),
    ...walk(path.join(SRC, 'games')),
    ...walk(path.join(SRC, 'tycoon')),
    ...walk(path.join(SRC, 'welt')),
  ].filter((f) => f.endsWith('.js'));

  // Innerhalb eines Ordners kommt data.js zuerst, dann alphabetisch.
  const rank = (f) => (path.basename(f) === 'data.js' ? 0 : 1);
  auto.sort((a, b) => {
    const da = path.dirname(a), db = path.dirname(b);
    if (da !== db) return da.localeCompare(db);
    return rank(a) - rank(b) || path.basename(a).localeCompare(path.basename(b));
  });
  files.push(...auto);

  for (const rel of TAIL_ORDER) push(rel);
  return files;
}

/* Bilder aus src/assets/ zweimal verpacken:
   - fuer die Offline-Einzeldatei als Daten-URI, damit sie ohne externe
     Verweise auskommt,
   - fuer die Online-Seite als eigene, gehashte Dateien neben dem Skript.
     Eingebettet machten sie rund 12 der 14 MB des Skripts aus - bei jedem
     neuen Stand wurden sie komplett neu geladen, obwohl sich kein Bild
     geaendert hatte, und der Browser konnte erst loslegen, wenn alles da war.
   Das Spiel sieht in beiden Faellen nur SG.assets[name] als Bildquelle. */
const BILD_TYP = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif',
};

/* Die Spielermodelle sind die Ausnahme: sie wiegen zusammen rund
   viereinhalb Megabyte und wuerden die Offline-Einzeldatei auf das
   Doppelte treiben. Sie gehen daher als eigene Dateien neben die Seite
   und werden im Spiel bei Bedarf geholt. Wer die Einzeldatei offline
   oeffnet, sieht weiterhin die gewohnten Bilder. */
const MODELL_PRAEFIX = 'gm-modell-';

function bundleAssets() {
  const dir = path.join(SRC, 'assets');
  const eingebettet = {}, verlinkt = {};
  let bytes = 0;
  if (exists(dir)) {
    for (const f of fs.readdirSync(dir).sort()) {
      if (f.startsWith(MODELL_PRAEFIX)) continue;
      const endung = path.extname(f).toLowerCase();
      const typ = BILD_TYP[endung];
      if (!typ) continue;
      const buf = fs.readFileSync(path.join(dir, f));
      bytes += buf.length;
      const name = path.basename(f, endung).toLowerCase();
      eingebettet[name] = 'data:' + typ + ';base64,' + buf.toString('base64');
      const datei = name + '.' + hash(buf.toString('latin1')) + endung;
      fs.writeFileSync(path.join(DIST, 'assets', datei), buf);
      verlinkt[name] = 'assets/' + datei;
    }
  }
  const code = (tabelle) => '\n/* ==== assets ==== */\n'
    + '(function (SG) { SG.assets = ' + JSON.stringify(tabelle) + '; })(SG);\n';
  return { online: code(verlinkt), offline: code(eingebettet), count: Object.keys(verlinkt).length, bytes };
}

/* Legt Modell und Grundfarbe gehasht nach dist/assets/ und gibt dem
   Spiel eine Tabelle mit den Adressen. Offline steht die Tabelle zwar auch
   im Bundle, die Dateien daneben fehlen dort aber - dann bleibt das Spiel
   beim Bild. */
function bundleSkins() {
  const dir = path.join(SRC, 'assets');
  const tabelle = {};
  const dateien = [];
  let bytes = 0;
  if (exists(dir)) {
    for (const f of fs.readdirSync(dir).sort()) {
      if (!f.startsWith(MODELL_PRAEFIX)) continue;
      const endung = path.extname(f).toLowerCase();
      if (endung !== '.glb' && endung !== '.webp') continue;
      const buf = fs.readFileSync(path.join(dir, f));
      bytes += buf.length;
      const rumpf = path.basename(f, endung);
      const name0 = rumpf.slice(MODELL_PRAEFIX.length).replace(/-textur$/, '');
      const name = rumpf + '.' + hash(buf.toString('latin1')) + endung;
      fs.writeFileSync(path.join(DIST, 'assets', name), buf);
      (tabelle[name0] || (tabelle[name0] = {}))[endung === '.glb' ? 'modell' : 'textur'] = 'assets/' + name;
      dateien.push('assets/' + name);
    }
  }
  /* Ein Skin ohne beides ist unbrauchbar - lieber gar nicht anbieten, als im
     Spiel ein Modell ohne Haut zu zeigen. */
  for (const skin of Object.keys(tabelle)) {
    if (!tabelle[skin].modell || !tabelle[skin].textur) delete tabelle[skin];
  }
  const code = '\n/* ==== Spielermodelle ==== */\n'
    + '(function (SG) { SG.modelle = ' + JSON.stringify(tabelle) + '; })(SG);\n';
  return { code, dateien, count: Object.keys(tabelle).length, bytes };
}

function bundleJs(files, assets, assetCode) {
  const parts = [
    '/* ' + APP_NAME + ' */',
    '"use strict";',
  ];
  const beanstandet = [];
  let roh = 0;

  for (const f of files) {
    const rel = path.relative(SRC, f).replace(/\\/g, '/');
    const quelle = read(f).replace(/^﻿/, '');
    roh += quelle.length;
    beanstandet.push(...pruefen(quelle, 'src/' + rel));
    parts.push('\n/* ' + rel + ' */\n' + abziehen(quelle));
    // Direkt hinter den Namensraum: SG.assets muss stehen, bevor das
    // erste Modul darauf zugreift.
    if (rel === 'core/namespace.js' && assets) {
      parts.push(assetCode);
      if (assets.skins) parts.push(assets.skins.code);
    }
  }

  /* Der Abzug oben ist zeilenweise und kennt keine Zeichenketten. Er ist
     nur zulaessig, solange keine ueber mehrere Zeilen geht. Sobald das
     nicht mehr stimmt, bricht der Build lieber ab. */
  if (beanstandet.length) {
    throw new Error('Der Kommentar-Abzug ist hier nicht sicher:\n - '
      + beanstandet.join('\n - '));
  }

  const out = parts.join('\n');
  return { code: out, roh: roh, gespart: roh - out.length };
}

/* CSS: dieselbe Idee, nur simpler - hier gibt es keine Zeilenkommentare
   und keine Zeichenketten ueber mehrere Zeilen. */
function bundleCss() {
  const roh = CSS_ORDER.map((rel) => {
    const abs = path.join(SRC, rel);
    if (!exists(abs)) throw new Error('Datei fehlt: src/' + rel);
    return read(abs);
  }).join('\n');

  const out = roh
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((z) => z.trim())
    .filter(Boolean)
    .join('\n');

  return { code: out, roh: roh.length, gespart: roh.length - out.length };
}

function hash(str) {
  // FNV-1a, reicht als Cache-Buster vollkommen aus
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
  }
  return h.toString(36).padStart(7, '0');
}

/* ------------------------------------------------------------------ PNG-Icons */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(w, h, rgba) {
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // Filter: keiner
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/* Zeichnet das App-Icon: dunkler Hintergrund, Torbogen, goldener Gehstock. */
function drawIcon(size) {
  const S = size;
  const px = Buffer.alloc(S * S * 4);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const mix = (a, b, t) => a + (b - a) * t;

  const sdRoundRect = (x, y, cx, cy, hw, hh, r) => {
    const qx = Math.abs(x - cx) - (hw - r);
    const qy = Math.abs(y - cy) - (hh - r);
    const ax = Math.max(qx, 0), ay = Math.max(qy, 0);
    return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - r;
  };
  const sdCapsule = (x, y, ax, ay, bx, by, r) => {
    const pax = x - ax, pay = y - ay, bax = bx - ax, bay = by - ay;
    const denom = bax * bax + bay * bay || 1;
    const t = clamp((pax * bax + pay * bay) / denom, 0, 1);
    return Math.hypot(pax - bax * t, pay - bay * t) - r;
  };
  const sdArc = (x, y, cx, cy, R, r, a0, a1) => {
    let ang = Math.atan2(y - cy, x - cx);
    if (ang < 0) ang += Math.PI * 2;
    const inside = a0 <= a1 ? (ang >= a0 && ang <= a1) : (ang >= a0 || ang <= a1);
    if (inside) return Math.abs(Math.hypot(x - cx, y - cy) - R) - r;
    const p0x = cx + Math.cos(a0) * R, p0y = cy + Math.sin(a0) * R;
    const p1x = cx + Math.cos(a1) * R, p1y = cy + Math.sin(a1) * R;
    return Math.min(Math.hypot(x - p0x, y - p0y), Math.hypot(x - p1x, y - p1y)) - r;
  };

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      const fx = x + 0.5, fy = y + 0.5;

      const t = fy / S;
      let r = mix(26, 14, t), g = mix(32, 19, t), b = mix(52, 30, t);

      const dBg = sdRoundRect(fx, fy, S / 2, S / 2, S / 2, S / 2, 0.225 * S);
      const a = clamp(0.5 - dBg, 0, 1);

      // Torbogen als "Hideout"
      const arch = sdArc(fx, fy, 0.5 * S, 0.62 * S, 0.30 * S, Math.max(0.9, 0.016 * S),
        Math.PI, Math.PI * 2);
      const aArch = clamp(0.5 - arch, 0, 1) * 0.55;
      r = mix(r, 96, aArch); g = mix(g, 122, aArch); b = mix(b, 176, aArch);

      // Gehstock
      const stick = sdCapsule(fx, fy, 0.575 * S, 0.335 * S, 0.575 * S, 0.795 * S, 0.045 * S);
      const hook = sdArc(fx, fy, 0.45 * S, 0.335 * S, 0.125 * S, 0.045 * S, Math.PI, Math.PI * 2);
      const dc = Math.min(stick, hook);
      const ac = clamp(0.5 - dc, 0, 1);
      const shade = clamp((fx / S - 0.44) * 1.7, 0, 1);
      r = mix(r, mix(255, 212, shade), ac);
      g = mix(g, mix(208, 146, shade), ac);
      b = mix(b, mix(96, 40, shade), ac);

      px[i] = Math.round(r);
      px[i + 1] = Math.round(g);
      px[i + 2] = Math.round(b);
      px[i + 3] = Math.round(a * 255);
    }
  }
  return encodePng(S, S, px);
}

/* ------------------------------------------------------------------ Pruefungen */

function checkOffline(html) {
  const problems = [];
  const rules = [
    [/<script[^>]+\ssrc\s*=/i, 'externes <script src>'],
    [/<link[^>]+rel\s*=\s*["']?stylesheet/i, 'externes <link stylesheet>'],
    [/@import\s/i, 'CSS @import'],
    [/\bnew\s+Worker\s*\(/, 'new Worker() (unter file:// nicht verfuegbar)'],
    [/serviceWorker\s*\.\s*register/, 'serviceWorker.register()'],
    [/[^.\w]import\s*\(/, 'dynamischer import()'],
    [/^\s*import\s+[\w{*]/m, 'ES-Modul-Import'],
    [/^\s*export\s+(default|const|function|class|\{)/m, 'ES-Modul-Export'],
    [/<img[^>]+src\s*=\s*["']https?:/i, 'externes Bild'],
    [/url\(\s*["']?https?:/i, 'externe CSS-URL'],
    [/\bfetch\s*\(\s*["'`]https?:/i, 'fetch() auf absolute URL'],
    [/<(audio|video|iframe)\b/i, 'externes Medien-Element'],
  ];
  for (const [re, name] of rules) if (re.test(html)) problems.push(name);
  return problems;
}

/* ------------------------------------------------------------------ Build */

function build() {
  const t0 = Date.now();
  const serverRulesDir = path.join(ROOT, 'netlify/functions/lib');
  fs.mkdirSync(serverRulesDir, { recursive: true });
  // Zeilenenden vereinheitlichen: Git legt die Quellen je nach Rechner mit CRLF oder LF ab,
  // die erzeugte Datei soll aber ueberall gleich aussehen.
  const serverRules = ['1-daten.js', '1-sammlung.js', '1-weltkarte.js', '1-wirtschaft.js', '1-zeiten.js', '1-zusatz.js', '2-arena.js', '2-kampf.js', '2-alltag.js', '2-duell.js'].map((f) => read(path.join(SRC, 'games/gehstockmon', f)).replace(/\r\n?/g, '\n')).join('\n');
  fs.writeFileSync(path.join(serverRulesDir, 'gehstockmon-rules.mjs'), '/* Generated from the shared browser rules by build.mjs. */\nconst SG = { rules: {} };\n' + serverRules + '\nexport const data = SG.gehstockmon.daten;\nexport const economy = SG.gehstockmon.wirtschaft;\nexport const hours = SG.gehstockmon.zeiten;\nexport const adventure = SG.gehstockmon.abenteuer;\nexport const arena = SG.gehstockmon.arena;\nexport const fight = SG.rules.gehstockmon.kaempfe;\n');
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(path.join(DIST, 'assets'), { recursive: true });
  fs.mkdirSync(path.join(DIST, 'offline'), { recursive: true });
  fs.mkdirSync(path.join(DIST, 'icons'), { recursive: true });

  const jsFiles = collectJs();
  const cssPaket = bundleCss();
  const css = cssPaket.code;
  const assets = bundleAssets();
  const skins = bundleSkins();
  assets.skins = skins;
  const jsPaket = bundleJs(jsFiles, assets, assets.online);
  const three = buildSync({ entryPoints: [path.join(SRC, 'vendor/three-entry.js')], bundle: true, minify: true, format: 'iife', target: 'safari15', write: false, legalComments: 'inline' }).outputFiles[0].text;
  /* Online zusaetzlich verdichtet: Leerraum und ueberfluessige Syntax raus,
     Namen bleiben - Fehlermeldungen und #/dev lesen sich wie vorher. Das spart
     gut ein Zehntel beim Laden und Parsen auf dem iPad. Die Offline-Datei
     bleibt beim bewaehrten Kommentar-Abzug. */
  const js = transformSync(three + '\n' + jsPaket.code, { minifyWhitespace: true, minifySyntax: true, target: 'safari15', legalComments: 'inline' }).code;
  const jsOffline = three + '\n' + bundleJs(jsFiles, assets, assets.offline).code;
  const gespart = jsPaket.gespart + cssPaket.gespart;
  const tmpl = read(path.join(SRC, 'index.html'));
  const version = hash(js + css);

  const cssName = 'app.' + hash(css) + '.css';
  const jsName = 'app.' + hash(js) + '.js';
  fs.writeFileSync(path.join(DIST, 'assets', cssName), css);
  fs.writeFileSync(path.join(DIST, 'assets', jsName), js);

  /* Syntaxpruefung des gesamten Bundles.

     new Function laesst V8 den ganzen Text parsen und wirft bei einem
     Syntaxfehler; ausgefuehrt wird dabei nichts. Frueher stand hier ein
     Unterprozess mit --check. Der ging ueberall dort kaputt, wo node in
     Wahrheit Deno ist - etwa im Build von Deno Deploy. Dort bedeutet
     "deno --check datei.js" naemlich nicht "nur pruefen", sondern "mit
     Typpruefung ausfuehren", und beim Ausfuehren fehlt dem Bundle
     natuerlich window. */
  try {
    new Function(js);
    new Function(jsOffline);
  } catch (fehler) {
    console.error('\nSyntaxfehler im Bundle:\n' + ((fehler && fehler.message) || fehler));
    process.exit(1);
  }

  // ---- Online-Seite
  const online = tmpl
    .replace('<!--HEAD-EXTRA-->',
      '<link rel="manifest" href="manifest.webmanifest">\n' +
      '  <link rel="apple-touch-icon" href="icons/icon-180.png">\n' +
      '  <link rel="icon" type="image/png" sizes="32x32" href="icons/icon-32.png">\n' +
      '  <style>.sg-only-offline{display:none!important}</style>')
    // Der Dateien-Modus steckt nur in der Offline-Einzeldatei - online waere
    // er totes Gewicht, denn dort hilft nur "JavaScript einschalten".
    .replace('<!--NOJS-->', '')
    .replace('<!--STYLES-->', '<link rel="stylesheet" href="assets/' + cssName + '">')
    .replace('<!--SCRIPTS-->',
      '<script>window.SG_BUILD={offline:false,nojs:' + NOJS_ANZAHL + ',version:"' + version + '",' +
      'offlineFile:"offline/' + OFFLINE_FILE + '"};</script>\n' +
      '  <script src="assets/' + jsName + '" defer></script>\n' +
      // Nur im Online-Build: macht "Zum Home-Bildschirm" offlinefaehig.
      // Bewusst hier und nicht im Bundle, damit die Offline-Einzeldatei
      // garantiert keinen Service-Worker-Code enthaelt.
      '  <script>if("serviceWorker" in navigator){window.addEventListener("load",function(){' +
      'navigator.serviceWorker.register("sw.js").catch(function(){});});}</script>');
  fs.writeFileSync(path.join(DIST, 'index.html'), online);

  // ---- Offline-Einzeldatei
  const offline = tmpl
    .replace('<!--HEAD-EXTRA-->', '<style>.sg-only-online{display:none!important}</style>')
    .replace('<!--NOJS-->', buildNoJs())
    .replace('<!--STYLES-->', '<style>\n' + css + '\n</style>')
    .replace('<!--SCRIPTS-->',
      '<script>window.SG_BUILD={offline:true,nojs:' + NOJS_ANZAHL + ',version:"' + version + '",offlineFile:null};</script>\n' +
      '<script>\n' + jsOffline + '\n</script>');
  const problems = checkOffline(offline);
  if (problems.length) {
    console.error('\nOffline-Datei enthaelt externe Abhaengigkeiten:\n - ' + problems.join('\n - '));
    process.exit(1);
  }
  fs.writeFileSync(path.join(DIST, 'offline', OFFLINE_FILE), offline);

  // ---- Mitgelieferte Fremdspiele (eigene Seiten)
  //
  // Krisenstab bringt React, Babel und Tailwind von CDNs mit und kann
  // deshalb nicht in die Offline-Einzeldatei. Die Datei selbst bleibt
  // unangetastet; ergaenzt werden nur Zeichensatz und Bildschirmbreite
  // (sonst zoomt das iPad die Seite auf 980 px heraus) und ein Rueckweg.
  const externDir = path.join(SRC, 'extern');
  let externCount = 0;
  if (exists(externDir)) {
    for (const f of fs.readdirSync(externDir)) {
      if (!f.endsWith('.html')) continue;
      const roh = read(path.join(externDir, f));
      const kopf =
        '<meta charset="utf-8">\n' +
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
        '<meta name="color-scheme" content="dark">\n';
      const zurueck =
        '\n<a href="./index.html" style="position:fixed;left:10px;bottom:10px;z-index:99999;' +
        'display:inline-block;padding:8px 14px;border-radius:999px;background:rgba(12,10,9,.86);' +
        'border:1px solid #44403c;color:#a8a29e;font:13px/1 -apple-system,BlinkMacSystemFont,' +
        '&quot;Segoe UI&quot;,Roboto,sans-serif;text-decoration:none">&lsaquo; Hideout</a>\n';
      fs.writeFileSync(path.join(DIST, f), kopf + roh + zurueck);
      externCount++;
    }
  }

  /* Der Schultest wird unveraendert danebengelegt, damit er sich auch im
     Browser aufrufen laesst und nicht nur als Datei vom iPad. Den Kopf der
     extern-Seiten vertraegt er nicht: er ist ein vollstaendiges Dokument,
     und ein <meta> vor dem doctype schickt Safari in den Quirks-Modus.
     Kopiert statt zweimal gepflegt - zwei Fassungen liefen auseinander. */
  const schultest = path.join(ROOT, 'docs', 'schul-test.html');
  if (exists(schultest)) fs.copyFileSync(schultest, path.join(DIST, 'schul-test.html'));

  // ---- Icons
  const icons = [32, 180, 192, 512];
  for (const s of icons) {
    fs.writeFileSync(path.join(DIST, 'icons', 'icon-' + s + '.png'), drawIcon(s));
  }

  // ---- Manifest
  fs.writeFileSync(path.join(DIST, 'manifest.webmanifest'), JSON.stringify({
    name: APP_NAME,
    short_name: 'Hideout',
    description: 'Spielesammlung mit Tycoons - auch komplett offline spielbar.',
    start_url: './index.html',
    scope: './',
    display: 'standalone',
    orientation: 'any',
    background_color: '#0d1017',
    theme_color: '#0d1017',
    lang: 'de',
    icons: [
      { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }, null, 2));

  // ---- Service Worker (nur online; macht "Zum Home-Bildschirm" offlinefaehig)
  const swAssets = [
    './', './index.html', 'assets/' + cssName, 'assets/' + jsName,
    'manifest.webmanifest',
  ].concat(icons.map((s) => 'icons/icon-' + s + '.png'));

  const sw = [
    '/* ' + APP_NAME + ' - Service Worker */',
    "const CACHE = 'hgh-" + version + "';",
    'const ASSETS = ' + JSON.stringify(swAssets) + ';',
    '/* Beigaben: eigene Seiten, die neben dem Hideout liegen und erst nach',
    '   dem Hideout gebaut werden - tools/deploy-bauen.mjs traegt sie hier',
    '   ein. Ohne sie fehlt zum Beispiel die Arena, sobald das Netz weg ist. */',
    'const EXTRAS = ' + JSON.stringify(skins.dateien) + ';',
    "self.addEventListener('install', function (e) {",
    '  e.waitUntil(caches.open(CACHE).then(function (c) {',
    '    /* Der Kern muss vollstaendig sein: fehlt davon etwas, ist die Seite',
    '       offline kaputt - dann lieber gar nicht erst installieren. */',
    '    return c.addAll(ASSETS).then(function () {',
    '      /* Die Beigaben einzeln und nachsichtig. Eine fehlende Datei darf',
    '         nicht die ganze Installation umwerfen. */',
    '      return Promise.all(EXTRAS.map(function (u) {',
    '        return c.add(u).catch(function () { /* egal */ });',
    '      }));',
    '    });',
    '  }).then(function () { return self.skipWaiting(); }));',
    '});',
    "self.addEventListener('activate', function (e) {",
    '  e.waitUntil(caches.keys().then(function (ks) {',
    '    return Promise.all(ks.filter(function (k) { return k !== CACHE; })',
    '      .map(function (k) { return caches.delete(k); }));',
    '  }).then(function () { return self.clients.claim(); }));',
    '});',
    "self.addEventListener('fetch', function (e) {",
    '  var req = e.request;',
    "  if (req.method !== 'GET') return;",
    '  var url = new URL(req.url);',
    "  if (url.pathname.indexOf('/.netlify/') === 0 || url.pathname.indexOf('/api/') === 0) return;",
    '  if (url.origin !== self.location.origin) return;',
    '',
    '  // Die Seite selbst immer zuerst aus dem Netz holen, sonst haengt nach',
    '  // einem neuen Stand die alte index.html mit alten Dateinamen fest.',
    '  var isPage = req.mode === "navigate" ||',
    '    /\\/$|\\/index\\.html$|\\.webmanifest$/.test(url.pathname);',
    '  if (isPage) {',
    '    e.respondWith(fetch(req).then(function (res) {',
    '      if (res && res.ok) {',
    '        var copy = res.clone();',
    '        caches.open(CACHE).then(function (c) { c.put(req, copy); });',
    '      }',
    '      return res;',
    '    }).catch(function () {',
    "      return caches.match(req).then(function (hit) { return hit || caches.match('./index.html'); });",
    '    }));',
    '    return;',
    '  }',
    '',
    '  // Gehashte Dateien aendern bei jedem Stand ihren Namen - hier ist',
    '  // der Cache immer richtig.',
    '  e.respondWith(caches.match(req).then(function (hit) {',
    '    return hit || fetch(req).then(function (res) {',
    '      if (res && res.ok) {',
    '        var copy = res.clone();',
    '        caches.open(CACHE).then(function (c) { c.put(req, copy); });',
    '      }',
    '      return res;',
    '    });',
    '  }));',
    '});',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(DIST, 'sw.js'), sw);

  // ---- Bericht
  const kb = (n) => (n / 1024).toFixed(1) + ' kB';
  const offSize = fs.statSync(path.join(DIST, 'offline', OFFLINE_FILE)).size;
  const games = (js.match(/SG\.register\s*\(\s*\{/g) || []).length;
  log('');
  log(APP_NAME + ' - Build fertig in ' + (Date.now() - t0) + ' ms');
  log('  Quelldateien (JS)  : ' + jsFiles.length);
  log('  Registrierte Spiele: ' + games);
  log('  app.css            : ' + kb(css.length));
  log('  app.js             : ' + kb(js.length));
  log('  Kommentare raus    : ' + kb(gespart) + ' gespart');
  log('  Offline-Einzeldatei: ' + kb(offSize) + '  (Budget 2048.0 kB)');
  if (externCount) log('  Eigene Seiten      : ' + externCount + ' (nicht in der Offline-Datei)');
  if (assets.count) log('  Bilder (online eigene Dateien, offline eingebettet): ' + assets.count + ' (' + kb(assets.bytes) + ')');
  if (skins.count) log('  Modelle daneben     : ' + skins.count + ' (' + kb(skins.bytes) + ')');
  log('');
  const adm = ersterAdminCode();
  log('  Erster Admin-Code  : ' + adm.code);
  log('  Codevorrat         : ' + adm.zaehler.A + ' Admin, ' + adm.zaehler.K + ' Kreis, ' + adm.zaehler.S + ' Spieler');
  if (offSize > 2 * 1024 * 1024) log('  ! Offline-Datei ueber Budget');
  log('');
}

build();

/* Denselben ersten Admin-Code ausrechnen, den src/core/auth.js erwartet.
   Ohne ihn kaeme niemand durch die Tuer. */
function ersterAdminCode() {
  const src = read(path.join(SRC, 'core/auth.js'));
  const g = /var GEHEIM = '([^']+)'/.exec(src);
  const r = /var RASTER = (\d+)/.exec(src);
  const GEHEIM = g ? g[1] : '';
  const RASTER = r ? Number(r[1]) : 97;

  const streu = (t) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < t.length; i++) {
      h ^= t.charCodeAt(i);
      h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
    }
    return h >>> 0;
  };

  const rollen = ['S', 'K', 'A'];
  const zaehler = { A: 0, K: 0, S: 0 };
  let erster = null;
  for (let n = 0; n < 10000; n++) {
    const c = String(n).padStart(4, '0');
    const w = streu('code:' + c + ':' + GEHEIM);
    if (w % RASTER !== 0) continue;
    const rolle = rollen[Math.floor(w / RASTER) % 3];
    zaehler[rolle]++;
    if (rolle === 'A' && !erster) erster = c;
  }
  return { code: erster, zaehler };
}
