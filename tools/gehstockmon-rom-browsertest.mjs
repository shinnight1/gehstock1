/* Optionaler Desktop-Test mit echtem Canvas/WebGL; absichtlich nicht *-tests.mjs,
   damit die automatische Handy-Aktualisierung kein Playwright voraussetzt.
   Aufruf: node tools/gehstockmon-rom-browsertest.mjs
   PLAYWRIGHT_MODULE_PATH kann auf ein vorhandenes Playwright-Paket zeigen;
   CHROMIUM_EXECUTABLE kann den Pfad eines installierten Chrome angeben. */
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { quellen, szenenPruefen } from './gehstockmon-rom-szene-tests.mjs';

const playwright = process.env.PLAYWRIGHT_MODULE_PATH;
const { chromium } = await import(playwright ? pathToFileURL(path.join(playwright, 'index.mjs')).href : 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE || undefined, args: ['--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 640 } }), fehler = [];
  page.on('pageerror', e => fehler.push(e.message));
  page.on('console', m => { if (m.type() === 'error' || /WebGL.*(?:INVALID|error)|THREE\.WebGLProgram/.test(m.text())) fehler.push(m.text()); });
  await page.setContent('<!doctype html><html lang="de"><title>Rom-Szenenregression</title><body style="margin:0"></body></html>');
  const input = quellen();
  await page.addScriptTag({ content: input.three });
  await page.addScriptTag({ content: input.spiel });
  const ergebnis = await page.evaluate(`(() => {
    const T = window.THREE, renderer = new T.WebGLRenderer({ antialias: true });
    renderer.setSize(960, 640); document.body.appendChild(renderer.domElement);
    renderer.setClearColor('#223344');
    const camera = new T.PerspectiveCamera(55, 960 / 640, 0.1, 400);
    camera.position.set(70, 65, 110); camera.lookAt(18, 8, 32);
    const gl = renderer.getContext(); let bilder = 0, dreiecke = 0;
    const zeichnen = scene => {
      const licht = new T.HemisphereLight('#ffffff', '#555566', 3); scene.add(licht);
      renderer.render(scene, camera); scene.remove(licht);
      const fehler = gl.getError(); if (fehler !== gl.NO_ERROR) throw new Error('WebGL-Fehler ' + fehler);
      if (gl.isContextLost()) throw new Error('WebGL-Kontext verloren');
      dreiecke = Math.max(dreiecke, renderer.info.render.triangles); bilder++;
    };
    try {
      const tests = (${szenenPruefen.toString()})(T, SG, zeichnen);
      if (!dreiecke) throw new Error('Keine echte Geometrie gerendert');
      return { tests, bilder, dreiecke };
    } finally { renderer.dispose(); }
  })()`);
  /* Laesst asynchrone Browser-/Shaderfehler noch an den Node-Prozess liefern. */
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.deepEqual(fehler, [], 'Keine JavaScript-, Shader- oder WebGL-Fehler');
  for (const name of ergebnis.tests) console.log('ok Browser', name);
  console.log(`${ergebnis.tests.length} Rom-Browsertests bestanden; ${ergebnis.bilder} Bilder, bis zu ${ergebnis.dreiecke} Dreiecke.`);
} finally { await browser.close(); }
