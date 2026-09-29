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
     - online mit zwei Browsern (Maus und Touch): Teams, gegenseitig
       sehen, Schuesse, Verlassen, Verbindungsabbruch
     - offline: Service Worker hat den Shooter, Bot-Lobby ohne Netz

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
    await page.tap('.m-start.zweit');
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
    const z = await ev(() => { const a = window.__ops, s = a.sim.spieler; return { x: s.x, z: s.z, yaw: a.eingabe.yaw, n: s.waffe.schuesse, f: a.eingabe.visierFeuerFinger, v: s.waffe.visier }; });
    pruefe(z.yaw < start.yaw - 0.1, 'rechte Haelfte dreht den Blick');
    pruefe(z.f === 1 && z.n > start.n, 'grosser Feuerknopf schiesst');
    pruefe(z.v > 0.5, '... und zielt dabei uebers Visier (wie in CoD Mobile)');
    pruefe(z.yaw > y0 + 0.05, 'Umsehen ueber den gehaltenen Feuerknopf');
    pruefe(Math.hypot(z.x - start.x, z.z - start.z) > 0.5, 'dabei gleichzeitig gelaufen');
    await touch('touchEnd', [[3, feuer[0] - 40, feuer[1]]]);
    let s = await ev(() => ({ f: window.__ops.eingabe.visierFeuerFinger, sy: window.__ops.eingabe.stickY }));
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
    await warten(500);
    const huefte = await mitte('.t-feuer-huefte');
    const n0 = await ev(() => window.__ops.sim.spieler.waffe.schuesse);
    await touch('touchStart', [[8, huefte[0], huefte[1]]]);
    await warten(500);
    s = await ev(() => ({ f: window.__ops.eingabe.feuerFinger, n: window.__ops.sim.spieler.waffe.schuesse, v: window.__ops.sim.spieler.waffe.visier }));
    pruefe(s.f === 1 && s.n > n0 && s.v < 0.1, 'kleiner Knopf darueber schiesst aus der Huefte');
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
    // Ohne Grafikkarte laeuft das Spiel langsam: auf die Landung warten statt auf die Uhr.
    await page.waitForFunction(() => window.__ops.sim.spieler.amBoden, null, { timeout: 10000 });
    await touch('touchStart', [[7, 220, 650]]);
    await touch('touchMove', [[7, 222, 520]]);
    const sprint = await page.waitForFunction(() => window.__ops.sim.spieler.sprintet, null, { timeout: 5000 }).then(() => true, () => false);
    pruefe(sprint, 'Sprint durch weites Hochschieben');
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
    await page.click('.m-start.zweit');
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
      await page.waitForFunction(() => window.__ops.zustand === 'ergebnis', null, { timeout: 90000 });
      speicher.push(await ev(() => { const m = window.__ops.darstellung.renderer.info.memory; return m.geometries + '/' + m.textures; }));
      await page.click('.ops-menue .m-knopf.haupt');
      await page.waitForFunction(() => window.__ops.zustand === 'spiel', null, { timeout: 90000 });
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

  /* ------------------------------------------------------------ Online */
  console.log('\nOnline mit zwei Browsern');
  {
    const A = await seite({ viewport: { width: 900, height: 620 } }, { name: 'Anna' });
    const B = await seite({ viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: true }, { name: 'Ben' });
    await A.page.waitForFunction(() => !/Frage/.test(document.querySelector('.o-status').textContent), null, { timeout: 10000 });
    pruefe(await A.ev(() => /niemand|spiel/.test(document.querySelector('.o-status').textContent)), 'Menue zeigt, wer online ist');
    await A.page.click('.m-online .m-start');
    await A.page.waitForFunction(() => window.__ops.zustand === 'spiel' && window.__ops.sim.online, null, { timeout: 30000 });
    await B.page.tap('.m-online .m-start');
    await B.page.waitForFunction(() => window.__ops.zustand === 'spiel' && window.__ops.sim.online, null, { timeout: 30000 });
    await A.page.waitForFunction(() => window.__ops.sim.akteure.filter((x) => !x.bot).length === 2, null, { timeout: 10000 });
    const teams = [await A.ev(() => window.__ops.sim.spieler.team), await B.ev(() => window.__ops.sim.spieler.team)];
    pruefe(teams[0] !== teams[1], 'zwei Menschen landen in verschiedenen Teams');
    pruefe(await A.ev(() => window.__ops.sim.akteure.some((x) => x.name === 'Ben' && !x.bot)), 'Anna sieht Ben als Mitspieler');
    pruefe(await B.ev(() => /ONLINE/.test(document.querySelector('.hud-online').textContent)), 'HUD zeigt online und Ping');
    await A.page.waitForFunction(() => window.__ops.sim.phase === 'laeuft', null, { timeout: 15000 });
    const idA = await A.ev(() => window.__ops.online.eigenId);
    const idB = await B.ev(() => window.__ops.online.eigenId);
    // Bots spielen mit und schiessen auch - faellt Anna waehrenddessen,
    // zaehlt der Versuch nicht.
    // Zwei Fenster: nur die Seite im Vordergrund zeichnet (und rechnet ihr
    // Bild der anderen nach) - wer gerade handelt oder beobachtet, kommt nach vorn.
    const vorn = async (S) => {
      await S.page.bringToFront();
      await S.ev(() => { if (window.__ops.zustand === 'pause') window.__ops.fortsetzen(); });
      await warten(700);
    };
    let lauf = null;
    for (let versuch = 0; versuch < 4 && !lauf; versuch++) {
      await vorn(B);
      const vorher = await B.ev((id) => { const x = window.__ops.sim.akteure[id]; return [x.x, x.z]; }, idA);
      await vorn(A);
      await A.page.waitForFunction(() => window.__ops.sim.spieler.lebt && window.__ops.zustand === 'spiel', null, { timeout: 15000 });
      const leben = await A.ev(() => window.__ops.sim.spieler.lebenNr);
      // Ohne Grafikkarte zeichnen zwei Seiten sehr langsam - das Spiel holt
      // hoechstens fuenf Schritte je Bild nach, Anna kommt darum langsam voran.
      await A.page.keyboard.down('KeyW');
      await warten(3000);
      await A.page.keyboard.up('KeyW');
      await warten(300);
      const a = await A.ev(() => ({ x: window.__ops.sim.spieler.x, z: window.__ops.sim.spieler.z, k: window.__ops.online.korrekturen,
        lebt: window.__ops.sim.spieler.lebt, nr: window.__ops.sim.spieler.lebenNr, spiel: window.__ops.zustand === 'spiel' }));
      await vorn(B);
      const nachher = await B.ev((id) => { const x = window.__ops.sim.akteure[id]; return [x.x, x.z]; }, idA);
      if (a.lebt && a.nr === leben && a.spiel && Math.hypot(nachher[0] - vorher[0], nachher[1] - vorher[1]) > 0.5) lauf = { vorher, nachher, a };
    }
    pruefe(lauf && Math.hypot(lauf.nachher[0] - lauf.vorher[0], lauf.nachher[1] - lauf.vorher[1]) > 0.5, 'Ben sieht Anna laufen');
    pruefe(lauf && Math.hypot(lauf.nachher[0] - lauf.a.x, lauf.nachher[1] - lauf.a.z) < 0.3, 'dort, wo Anna wirklich steht');
    pruefe(lauf && lauf.a.k === 0, 'Vorhersage ohne Korrektur (' + (lauf && lauf.a.k) + ')');
    const cdp = await B.ctx.newCDPSession(B.page);
    // Bots spielen mit - Ben muss gerade leben, um zu schiessen.
    await vorn(B);
    await B.page.waitForFunction(() => window.__ops.sim.spieler.lebt && window.__ops.zustand === 'spiel', null, { timeout: 15000 });
    const feuer = await B.ev(() => { const r = document.querySelector('.t-feuer').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
    const schuesse = await A.ev((id) => window.__ops.sim.akteure[id].waffe.schuesse, idB);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: feuer[0], y: feuer[1], id: 1 }] });
    await warten(700);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await vorn(A);
    pruefe(await A.ev((id) => window.__ops.sim.akteure[id].waffe.schuesse, idB) > schuesse, 'Bens Schuesse kommen bei Anna an');
    await vorn(B);
    await B.ev(() => window.__ops.pausieren());
    await warten(300);
    await B.page.tap('text=Online verlassen');
    await warten(300);
    pruefe(await B.ev(() => window.__ops.zustand === 'menue' && !window.__ops.online), 'Ben verlaesst die Runde');
    await A.page.waitForFunction((id) => window.__ops.sim.akteure[id].bot, idB, { timeout: 10000 });
    pruefe(true, 'fuer Ben spielt wieder ein Bot');
    await A.ev(() => window.__ops.online.ws.close());
    await A.page.waitForFunction(() => /VERBINDUNG WEG/.test(document.querySelector('.ops-menues').textContent), null, { timeout: 10000 });
    pruefe(true, 'Verbindungsabbruch: Hinweis statt Absturz');
    await A.page.click('text=Bot-Lobby spielen');
    await A.page.waitForFunction(() => window.__ops.zustand === 'spiel' && !window.__ops.sim.online, null, { timeout: 30000 });
    pruefe(true, 'von dort direkt in die Bot-Lobby');
    pruefe(A.fehler.length === 0 && B.fehler.length === 0, 'keine Fehler in der Konsole' + (A.fehler.concat(B.fehler).length ? ': ' + A.fehler.concat(B.fehler)[0] : ''));
    await A.ctx.close();
    await B.ctx.close();
  }

  /* ----------------------------------------------------------- Offline */
  /* Ohne Netz heisst hier: der Server ist weg (Chromiums Offline-Schalter
     laesst den Service Worker nicht zum Zug kommen). Danach laeuft nichts
     mehr, was den Server braucht - dieser Teil kommt darum zuletzt. */
  console.log('\nOffline');
  {
    const ctx = await browser.newContext({ viewport: { width: 900, height: 620 } });
    const page = await ctx.newPage();
    const fehler = [];
    page.on('pageerror', (e) => fehler.push(e.message));
    await page.addInitScript(() => {
      localStorage.setItem('gehstock-ops:einstellungen:v1', JSON.stringify({ hilfeGesehen: true, qualitaet: 'niedrig', dynamisch: false }));
    });
    await page.goto('http://localhost:' + PORT + '/');
    // Selbst abfragen: waitForFunction wartet nicht auf asynchrone Bedingungen.
    let bereit = false;
    for (let i = 0; i < 120 && !bereit; i++) {
      bereit = await page.evaluate(async () => {
        const r = await navigator.serviceWorker.getRegistration();
        if (!r || !r.active || r.active.state !== 'activated' || r.installing || r.waiting) return false;
        const urls = [];
        for (const n of await caches.keys()) for (const q of await (await caches.open(n)).keys()) urls.push(q.url);
        return [/games\/shooter\/index\.html$/, /games\/shooter\/bundle\/ops\..*\.js$/, /games\/shooter\/bundle\/ops\..*\.css$/]
          .every((m) => urls.some((u) => m.test(u)));
      });
      if (!bereit) await warten(250);
    }
    pruefe(bereit, 'Service Worker hat den Shooter schon beim Hideout mitgeladen');
    // Hart beenden: sonst bedient der Server offene Verbindungen noch Sekunden weiter.
    server.kill('SIGKILL');
    await warten(500);
    await page.goto(BASIS + 'index.html');
    await page.waitForFunction(() => window.__opsGestartet === true, null, { timeout: 40000 });
    await page.waitForFunction(() => !/Frage/.test(document.querySelector('.o-status').textContent), null, { timeout: 10000 });
    const status = await page.evaluate(() => document.querySelector('.o-status').textContent);
    pruefe(/nicht erreichbar|Kein Internet/.test(status), 'ohne Server: Seite kommt aus dem Speicher, Menue sagt es (' + status + ')');
    await page.click('.m-start.zweit');
    await page.waitForFunction(() => window.__ops.sim && window.__ops.sim.phase === 'laeuft', null, { timeout: 60000 });
    const z0 = await page.evaluate(() => window.__ops.sim.zeit);
    const laeuft = await page.waitForFunction((z) => window.__ops.sim.zeit > z + 0.5, z0, { timeout: 15000 }).then(() => true, () => false);
    pruefe(laeuft, 'Bot-Lobby laeuft komplett ohne Netz');
    pruefe(fehler.length === 0, 'keine Fehler' + (fehler.length ? ': ' + fehler[0] : ''));
    await ctx.close();
  }
} finally {
  await browser.close();
  server.kill();
}

console.log('\n' + (fehlschlaege ? fehlschlaege + ' Pruefung(en) durchgefallen' : 'Alle Browser-Pruefungen bestanden') + '\n');
process.exit(fehlschlaege ? 1 : 0);
