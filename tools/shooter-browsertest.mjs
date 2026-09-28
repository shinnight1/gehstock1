/* ------------------------------------------------------------------
   Gehstock Ops im echten Browser pruefen (optional, braucht Playwright).

   Startet den Entwicklungsserver auf einem eigenen Port, oeffnet den
   Shooter in Chromium und prueft, was Node-Tests nicht koennen:
     - Touch mit mehreren Fingern gleichzeitig (laufen, umsehen, feuern),
       pointercancel, Fokusverlust, alle Knoepfe, Sprint ueber den Stick,
       kein Scrollen oder Zoomen, Hochformat-Hinweis
     - Maus und Tastatur: Pointer Lock, Pause bei Verlust, P und Escape,
       Tabelle, Matchende, Auswertung, Nochmal
     - wiederholtes Starten ohne wachsenden GPU-Speicher, sauberes
       Aufraeumen (Schleife steht, Canvas, Oberflaeche, Ton, Listener weg)

   Vorher bauen (npm run build). Aufruf:
     node tools/shooter-browsertest.mjs
   Ohne Playwright meldet das Skript das und endet mit Code 2. Es gehoert
   nicht zu den Tests, die ein Update freigeben - dort laeuft kein Browser.
   ------------------------------------------------------------------ */

import fs from 'node:fs';
import path from 'node:path';
import { spawn, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.OPS_TEST_PORT || 8799);
const BASIS = 'http://localhost:' + PORT + '/games/shooter/';

function playwrightLaden() {
  const orte = [ROOT + '/'];
  try { orte.push(execSync('npm root -g', { encoding: 'utf8' }).trim() + '/'); } catch (e) { /* egal */ }
  for (const ort of orte) {
    try { return createRequire(ort)('playwright'); } catch (e) { /* weiter */ }
  }
  return null;
}

const pw = playwrightLaden();
if (!pw) {
  console.log('Playwright fehlt - dieser Test braucht es (npm i -g playwright). Uebersprungen.');
  process.exit(2);
}
if (!fs.existsSync(path.join(ROOT, 'dist', 'games', 'shooter', 'index.html'))) {
  console.log('Erst bauen: npm run build');
  process.exit(1);
}

let fehlschlaege = 0;
function pruefe(bedingung, text) {
  if (bedingung) console.log('  ok   ' + text);
  else {
    fehlschlaege++;
    console.log('  FAIL ' + text);
  }
}

const server = spawn(process.execPath, [path.join(ROOT, 'tools', 'handy-server.mjs'), '--dev', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
const warten = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 50; i++) {
  try { if ((await fetch(BASIS)).ok) break; } catch (e) { /* noch nicht da */ }
  await warten(100);
}

const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function seite(kontext, einst) {
  const ctx = await browser.newContext(kontext);
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', (e) => fehler.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') fehler.push(m.text()); });
  await page.addInitScript((e) => {
    localStorage.setItem('gehstock-ops:einstellungen:v1', JSON.stringify(e));
    // Nur Listener zaehlen, die das Spiel selbst anmeldet (Aufruf aus
    // dem Bundle) - Playwright haengt eigene an window.
    const aktiv = new Set();
    window.__opsListener = aktiv;
    for (const ziel of [window, document]) {
      const add = ziel.addEventListener.bind(ziel), rem = ziel.removeEventListener.bind(ziel);
      const name = ziel === window ? 'w' : 'd';
      const schluessel = (t, f, o) => name + t + '|' + (o === true || (o && o.capture) ? 1 : 0) + '|' + (f && f.__id);
      ziel.addEventListener = (t, f, o) => {
        if (f && /bundle\/ops\./.test(new Error().stack || '')) {
          if (!f.__id) f.__id = Math.random();
          aktiv.add(schluessel(t, f, o));
        }
        return add(t, f, o);
      };
      ziel.removeEventListener = (t, f, o) => { aktiv.delete(schluessel(t, f, o)); return rem(t, f, o); };
    }
  }, Object.assign({ hilfeGesehen: true, qualitaet: 'niedrig', dynamisch: false }, einst || {}));
  await page.goto(BASIS);
  await page.waitForFunction(() => window.__opsGestartet === true, null, { timeout: 40000 });
  return { ctx, page, fehler, ev: (f, a) => page.evaluate(f, a) };
}

const botsAnhalten = () => {
  for (const a of window.__ops.sim.akteure) {
    if (!a.bot) continue;
    a.ki = null;
    a.befehl.tasten = 0;
    a.befehl.vor = 0;
    a.befehl.seit = 0;
  }
  window.__ops.sim.spieler.schutz = 999;
};

try {
  /* ------------------------------------------------------------ Touch */
  console.log('\nTouch (iPad quer, 1180 x 820)');
  {
    const { ctx, page, fehler, ev } = await seite({ viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: true });
    const cdp = await ctx.newCDPSession(page);
    const touch = (type, punkte) => cdp.send('Input.dispatchTouchEvent', {
      type, touchPoints: punkte.map(([id, x, y]) => ({ x, y, id, radiusX: 8, radiusY: 8, force: 1 })),
    });
    const mitte = (sel) => ev((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, sel);
    const tippe = async (sel) => {
      const p = await mitte(sel);
      await touch('touchStart', [[9, p[0], p[1]]]);
      await warten(40);
      await touch('touchEnd', []);
      await warten(150);
    };
    pruefe(await ev(() => window.__ops.eingabe.modus === 'touch'), 'Touch-Geraet erkannt');
    await page.tap('.m-start');
    await page.waitForFunction(() => window.__ops.sim && window.__ops.sim.phase === 'laeuft', null, { timeout: 60000 });
    await ev(botsAnhalten);
    const start = await ev(() => { const a = window.__ops, s = a.sim.spieler; return { x: s.x, z: s.z, yaw: a.eingabe.yaw, n: s.waffe.schuesse }; });
    await touch('touchStart', [[1, 200, 640]]);
    await touch('touchMove', [[1, 200, 580]]);
    await touch('touchStart', [[1, 200, 580], [2, 760, 360]]);
    await touch('touchMove', [[1, 200, 580], [2, 880, 360]]);
    const feuer = await mitte('.t-feuer');
    await touch('touchStart', [[1, 200, 580], [2, 880, 360], [3, feuer[0], feuer[1]]]);
    const y0 = await ev(() => window.__ops.eingabe.yaw);
    for (let i = 1; i <= 5; i++) await touch('touchMove', [[1, 200, 580], [2, 880, 360], [3, feuer[0] - i * 8, feuer[1]]]);
    await warten(900);
    const z = await ev(() => { const a = window.__ops, s = a.sim.spieler; return { x: s.x, z: s.z, yaw: a.eingabe.yaw, n: s.waffe.schuesse, f: a.eingabe.feuerFinger }; });
    pruefe(z.yaw < start.yaw - 0.1, 'rechte Haelfte dreht den Blick');
    pruefe(z.f === 1 && z.n > start.n, 'Feuerknopf schiesst');
    pruefe(z.yaw > y0 + 0.05, 'Umsehen ueber den gehaltenen Feuerknopf');
    pruefe(Math.hypot(z.x - start.x, z.z - start.z) > 0.5, 'dabei gleichzeitig gelaufen');
    await touch('touchEnd', [[3, feuer[0] - 40, feuer[1]]]);
    let s = await ev(() => ({ f: window.__ops.eingabe.feuerFinger, sy: window.__ops.eingabe.stickY }));
    pruefe(s.f === 0 && s.sy > 0.5, 'ein Finger los, die anderen bleiben');
    await touch('touchEnd', []);
    s = await ev(() => ({ sy: window.__ops.eingabe.stickY, n: window.__ops.touch.zeiger.size }));
    pruefe(s.sy === 0 && s.n === 0, 'alle Finger los, nichts haengt');
    await touch('touchStart', [[5, 220, 640]]);
    await touch('touchMove', [[5, 220, 560]]);
    await touch('touchCancel', []);
    s = await ev(() => ({ sy: window.__ops.eingabe.stickY, n: window.__ops.touch.zeiger.size }));
    pruefe(s.sy === 0 && s.n === 0, 'pointercancel laesst los');
    await touch('touchStart', [[6, 220, 640]]);
    await touch('touchMove', [[6, 220, 560]]);
    await ev(() => window.dispatchEvent(new Event('blur')));
    s = await ev(() => ({ sy: window.__ops.eingabe.stickY, n: window.__ops.touch.zeiger.size }));
    pruefe(s.sy === 0 && s.n === 0, 'Fokusverlust laesst los');
    await touch('touchEnd', []);
    await tippe('.t-ducken');
    pruefe(await ev(() => window.__ops.sim.spieler.geduckt), 'Ducken');
    await tippe('.t-ducken');
    await tippe('.t-visier');
    await warten(400);
    pruefe(await ev(() => window.__ops.sim.spieler.waffe.visier > 0.9), 'Visier');
    await tippe('.t-visier');
    await ev(() => { window.__ops.sim.spieler.waffe.magazin = 5; });
    await tippe('.t-laden');
    pruefe(await ev(() => window.__ops.sim.spieler.waffe.laden > 0), 'Nachladen');
    await tippe('.t-sprung');
    await warten(120);
    pruefe(await ev(() => window.__ops.sim.spieler.y > 0.05), 'Springen');
    await warten(900);
    await touch('touchStart', [[7, 220, 650]]);
    await touch('touchMove', [[7, 222, 520]]);
    await warten(400);
    pruefe(await ev(() => window.__ops.sim.spieler.sprintet), 'Sprint durch weites Hochschieben');
    await touch('touchEnd', []);
    pruefe(await ev(() => window.scrollX === 0 && window.scrollY === 0 && (!window.visualViewport || window.visualViewport.scale === 1)), 'kein Scrollen, kein Zoom');
    await tippe('.t-pause');
    pruefe(await ev(() => window.__ops.zustand === 'pause'), 'Pause-Knopf');
    await page.tap('.ops-menue .m-knopf.haupt');
    await warten(200);
    await page.setViewportSize({ width: 820, height: 1180 });
    await warten(500);
    pruefe(await ev(() => window.__ops.zustand === 'pause' && window.__ops.wurzel.classList.contains('hochkant')), 'Hochformat: Hinweis und Pause');
    await page.setViewportSize({ width: 1180, height: 820 });
    await warten(300);
    pruefe(fehler.length === 0, 'keine Fehler in der Konsole' + (fehler.length ? ': ' + fehler[0] : ''));
    await ctx.close();
  }

  /* ---------------------------------------------------- Maus, Ablauf */
  console.log('\nMaus und Tastatur, Ablauf, Aufraeumen');
  {
    const { ctx, page, fehler, ev } = await seite({ viewport: { width: 900, height: 620 } });
    await page.click('.m-start');
    await page.waitForFunction(() => window.__ops.zustand === 'spiel', null, { timeout: 30000 });
    pruefe(await ev(() => !!document.pointerLockElement), 'Maus nach Klick gefangen');
    await ev(() => document.exitPointerLock());
    await warten(300);
    pruefe(await ev(() => window.__ops.zustand === 'pause'), 'Lock verloren: Pause');
    await page.click('.ops-menue .m-knopf.haupt');
    await warten(300);
    pruefe(await ev(() => window.__ops.zustand === 'spiel'), 'Weiter');
    await page.keyboard.press('KeyP');
    await warten(500);
    pruefe(await ev(() => window.__ops.zustand === 'pause'), 'P pausiert');
    await page.keyboard.press('Escape');
    await warten(300);
    pruefe(await ev(() => window.__ops.zustand === 'spiel'), 'Escape setzt fort');
    await page.keyboard.down('Tab');
    await warten(150);
    pruefe(await ev(() => document.querySelector('.hud-tabelle').classList.contains('an')), 'Tab zeigt die Tabelle');
    await page.keyboard.up('Tab');
    const speicher = [];
    for (let i = 0; i < 7; i++) {
      await warten(500);
      await ev((i) => { const a = window.__ops; a.einst.waffe = ['sturmgewehr', 'mp', 'schrotflinte'][i % 3]; a.sim.punkte[0] = 30; a.sim.beenden(); }, i);
      await page.waitForFunction(() => window.__ops.zustand === 'ergebnis', null, { timeout: 30000 });
      speicher.push(await ev(() => { const m = window.__ops.darstellung.renderer.info.memory; return m.geometries + '/' + m.textures; }));
      await page.click('.ops-menue .m-knopf.haupt');
      await page.waitForFunction(() => window.__ops.zustand === 'spiel', null, { timeout: 30000 });
    }
    pruefe(await ev(() => JSON.parse(localStorage.getItem('gehstock-ops:statistik:v1')).matches >= 7), 'Statistik wird gespeichert');
    console.log('       GPU-Speicher nach jedem Match (Geometrien/Texturen): ' + speicher.join('  '));
    pruefe(speicher[6] === speicher[4], 'GPU-Speicher waechst nach dem Einlaufen nicht mehr');
    const lauscher = await ev(() => window.__opsListener.size);
    await ev(() => window.__ops.zerstoeren());
    await warten(300);
    const rest = await ev(() => ({
      canvas: document.querySelectorAll('canvas').length,
      ui: document.querySelectorAll('.ops-hud,.ops-touch,.ops-menues').length,
      ton: window.__ops.klang.ctx === null,
      listener: window.__opsListener.size,
    }));
    pruefe(rest.canvas === 0 && rest.ui === 0 && rest.ton, 'Verlassen raeumt Canvas, Oberflaeche und Ton ab');
    pruefe(rest.listener === 0 && lauscher > 5, 'Verlassen meldet alle ' + lauscher + ' Listener des Spiels ab (' + rest.listener + ' uebrig)');
    pruefe(fehler.length === 0, 'keine Fehler in der Konsole' + (fehler.length ? ': ' + fehler[0] : ''));
    await ctx.close();
  }
} finally {
  await browser.close();
  server.kill();
}

console.log('\n' + (fehlschlaege ? fehlschlaege + ' Pruefung(en) durchgefallen' : 'Alle Browser-Pruefungen bestanden') + '\n');
process.exit(fehlschlaege ? 1 : 0);
