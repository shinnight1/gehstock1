/* Szenenregression ohne Browser: echter, reduzierter Three-Build und Canvas-
   Zeichenattrappe. Der ergaenzende rom-browsertest prueft Canvas und WebGL echt.
   Aufruf: node tools/gehstockmon-rom-szene-tests.mjs */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildSync } from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function quellen() {
  const regeln = ['1-daten.js', '1-sammlung.js', '1-weltkarte.js', '1-wirtschaft.js', '1-zeiten.js', '1-zusatz.js', '2-arena.js', '2-kampf.js', '2-alltag.js', '2-duell.js', '2-handel.js', '2-rohstoffe.js', '2-insel.js', '2-schatz.js', '2-startsprung.js', '2-automat.js', '2-rom.js'];
  return {
    three: buildSync({ absWorkingDir: ROOT, entryPoints: ['src/vendor/three-entry.js'], bundle: true, write: false, format: 'iife', platform: 'browser' }).outputFiles[0].text,
    spiel: 'var SG = { rules: {} };\n' + [...regeln, '2-rom-szene.js'].map(f => fs.readFileSync(path.join(ROOT, 'src/games/gehstockmon', f), 'utf8')).join('\n'),
  };
}

/* Selbststaendig serialisierbar: derselbe Ablauf laeuft auch im Browser. */
export function szenenPruefen(T, SG, zeichnen = () => {}) {
  const R = SG.gehstockmon, ROM = R.abenteuer.ROM, ergebnis = [];
  function pruefe(ja, text) { if (!ja) throw new Error(text); }
  pruefe(!T.InstancedMesh, 'Test muss den reduzierten Produktiv-Build verwenden');
  pruefe(R.weltErweiterungen.length === 1, 'Genau die Rom-Erweiterung ist geladen');

  function welt() {
    const scene = new T.Scene(), licht = [], ressourcen = new Map();
    let jetzt = 0, kampf = false;
    const api = R.weltErweiterungen[0]({ T, scene, uhr: () => jetzt, spieler: () => ({ x: 30, z: 38 }),
      kampf: () => kampf, leuchtturmHoehe: () => 35, licht: farben => licht.push(farben) });
    function merken(objekt) {
      if (!objekt || ressourcen.has(objekt)) return;
      ressourcen.set(objekt, false);
      objekt.addEventListener('dispose', () => ressourcen.set(objekt, true));
    }
    function schritt(zeit, dt = 1 / 30) {
      jetzt = zeit; api.update(dt, jetzt);
      scene.traverse(o => {
        pruefe([...o.position, ...o.scale, ...o.quaternion].every(Number.isFinite), 'Endliche Transformation: ' + o.type);
        if (o.geometry && !o.isSprite) merken(o.geometry);
        for (const m of o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []) { merken(m); merken(m.map); }
      });
      zeichnen(scene);
    }
    return { api, scene, licht, schritt, kampf: ja => { kampf = ja; },
      ende() {
        api.destroy();
        pruefe(!scene.getObjectByName('rom-event'), 'Rom-Gruppe beim Verlassen entfernt');
        pruefe([...ressourcen.values()].every(Boolean), 'Alle Szenen-Geometrien, Materialien und erfassten Texturen freigegeben');
        pruefe(api.zaehler().texturen === 0 && api.zaehler().partikel === 0, 'Caches und Partikel freigegeben');
        zeichnen(scene);
      } };
  }

  const leer = welt();
  leer.schritt(1000); leer.api.treffer();
  pruefe(!leer.api.zaehler().sichtbar && leer.api.zaehler().texturen === 0, 'Ohne Event wird keine Kulisse gebaut');
  leer.ende();
  ergebnis.push('Ohne Event betreten und verlassen');

  for (const ruhig of [false, true]) for (const faktor of [1, 3, 6]) {
    const w = welt(), a = w.api, ev = { id: 'szene-' + ruhig + '-' + faktor, start: 100000, faktor, ich: { zutaten: [] }, boss: { hp: 1000, max: 1000, besiegt: false } };
    const plan = ROM.plan(ev), max = ruhig ? 40 : 140;
    a.ruhig(ruhig); a.setEvent(ev); w.schritt(ev.start + 100);
    pruefe(a.zaehler().sichtbar && a.zaehler().texturen > 0, 'Countdown baut die Kulisse');
    const gruppe = w.scene.getObjectByName('rom-event'), kulisse = gruppe.children[0];
    const sichtbareSprites = () => { let anzahl = 0; gruppe.traverseVisible(o => { if (o.isSprite) anzahl++; }); return anzahl; };
    const countdownSprites = sichtbareSprites();
    const startHoehe = kulisse.position.y;
    w.schritt(plan.countdownBis - 1);
    pruefe(kulisse.position.y > startHoehe && kulisse.position.y < 0, 'Kulisse waechst im Countdown aus dem Boden');

    for (let nr = 0; nr < 5; nr++) {
      const zeit = plan.phasen[nr].von + 100;
      ev.ueberraschungen = { spaghetti: zeit - 50, vespa: zeit - 50, nonna: zeit - 2000 };
      a.setEvent(ev); w.schritt(zeit);
      pruefe(a.zaehler().sichtbar && kulisse.position.y === 0, 'Phase ' + nr + ' sichtbar');
      if (nr === 0) {
        const p = ROM.pizzen(ev, zeit)[0];
        a.tippen(p); pruefe(a.zielId() === p.id, 'Pizza antippen waehlt ein Ziel');
        pruefe(a.naechstePizza(p).id === p.id, 'Naechste Pizza entspricht der Serverposition');
        a.gesammelt(p.id); pruefe(a.zielId() === null, 'Sammeln entfernt das Ziel');
        pruefe(a.naechstePizza(p).id !== p.id, 'Gesammelte Pizza wird nicht erneut gewaehlt');
        a.setEvent({ ...ev, ich: { zutaten: ROM.pizzen(ev, zeit).map(pz => pz.id) } });
        pruefe(a.naechstePizza(p) === null, 'Serverstand verhindert erneutes Sammeln nach Laden');
      }
      if (nr === 2) for (let pose = 0; pose < 4; pose++) { a.pose(pose); w.schritt(zeit + pose); }
      if (nr === 3) for (const hp of [1000, 499, 249, 0]) {
        ev.boss = { hp, max: 1000, besiegt: hp === 0 }; a.setEvent(ev);
        a.treffer(); w.schritt(zeit + 10 + hp);
      }
      /* Viele Treffer erzwingen die Obergrenze unabhaengig vom Zufall. */
      if (nr === 4) {
        for (let i = 0; i < 80; i++) a.treffer();
        pruefe(a.zaehler().partikel === max, 'Belastungsprobe erreicht die Partikelgrenze ' + max);
      }
      for (let i = 0; i < 12; i++) {
        w.schritt(zeit + 1100 + i * 34);
        pruefe(a.zaehler().partikel <= max, 'Partikelgrenze ' + max + ' eingehalten');
      }
      w.kampf(true); w.schritt(zeit + 1700);
      pruefe(!a.zaehler().sichtbar, 'Event ist waehrend eines Kampfes ausgeblendet');
      w.kampf(false); w.schritt(zeit + 1800);
      pruefe(a.zaehler().sichtbar, 'Event kehrt nach dem Kampf zurueck');
      if (nr === 3) {
        const vorher = sichtbareSprites();
        w.schritt(zeit + ROM.dauer(ev, 20000) + 1);
        pruefe(sichtbareSprites() < vorher, 'Ueberraschungen verschwinden auch waehrend der Bossphase');
      }
    }
    w.schritt(plan.ende + 1000);
    pruefe(a.zaehler().sichtbar && kulisse.position.y < 0 && kulisse.scale.x < 1, 'Abspann zieht Kulisse ein');
    w.schritt(plan.ende + 9000, 10);
    pruefe(!a.zaehler().sichtbar && a.zaehler().partikel === 0, 'Abspann entfernt Partikel und blendet Event aus');
    pruefe(w.licht.at(-1) === null, 'Normales Licht nach dem Abspann wiederhergestellt');

    const neu = { ...ev, id: ev.id + '-neu', start: plan.ende + 10000, ueberraschungen: {}, boss: { hp: 1000, max: 1000, besiegt: false }, ich: { zutaten: [] } };
    a.setEvent(neu); w.schritt(neu.start + 100);
    pruefe(sichtbareSprites() === countdownSprites, 'Neuer Countdown zeigt keine Figuren aus dem vorigen Event');
    w.schritt(ROM.plan(neu).phasen[0].von + 100);
    pruefe(a.zaehler().sichtbar && kulisse.scale.x === 1, 'Neues Event stellt Kulisse wieder her');
    pruefe(a.naechstePizza({ x: 0, z: 0 }) !== null, 'Neues Event setzt gesammelte Zutaten zurueck');
    w.kampf(true); w.schritt(ROM.plan(neu).phasen[0].von + 200);
    a.setEvent(null); w.schritt(neu.start + 50000);
    pruefe(!a.zaehler().sichtbar && a.zaehler().partikel === 0, 'Entferntes Event hinterlaesst keine Partikel');
    pruefe(w.licht.at(-1) === null, 'Auch im Kampf entferntes Event stellt Licht wieder her');
    w.kampf(false);
    const direkt = { ...neu, id: neu.id + '-direkt', start: neu.start + 100000 };
    a.setEvent(direkt); w.schritt(direkt.start + 100);
    pruefe(sichtbareSprites() === countdownSprites, 'Neustart ohne Abspann zeigt keine alten Pizzen und Sprechblasen');
    w.ende();
    ergebnis.push((ruhig ? 'Ruhig' : 'Normal') + ', Tempo ' + faktor + ': Countdown, 5 Phasen, Interaktionen, Abspann, Neustart, Freigabe');
  }

  const abbruch = welt(), ev = { id: 'abbruch', start: 100000, abgebrochenAm: 101000 };
  abbruch.api.setEvent(ev); abbruch.schritt(102000);
  pruefe(abbruch.api.zaehler().texturen === 0 && !abbruch.api.zaehler().sichtbar, 'Countdown-Abbruch baut keine Kulisse');
  abbruch.ende(); ergebnis.push('Abbruch im Countdown');
  return ergebnis;
}

function canvasAttrappe() {
  const context = {};
  for (const name of ['beginPath', 'arc', 'ellipse', 'fill', 'stroke', 'moveTo', 'lineTo', 'closePath', 'fillRect', 'save', 'restore', 'translate', 'rotate', 'quadraticCurveTo', 'fillText', 'roundRect', 'rect']) context[name] = () => {};
  context.measureText = text => ({ width: text.length * 16 });
  return { width: 1, height: 1, getContext: typ => { assert.equal(typ, '2d'); return context; } };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const input = quellen(), fehler = [];
  const kontext = vm.createContext({ AbortController, performance: { now: () => 123400 }, console: { ...console, error: (...args) => fehler.push(args.join(' ')) }, document: { createElement: tag => { assert.equal(tag, 'canvas'); return canvasAttrappe(); } } });
  kontext.window = kontext;
  vm.runInContext(input.three, kontext, { filename: 'three-produktiv.js' });
  vm.runInContext(input.spiel, kontext, { filename: 'rom-szenenquellen.js' });
  for (const name of szenenPruefen(kontext.THREE, kontext.SG)) console.log('ok', name);
  assert.deepEqual(fehler, [], 'Three meldet keine Fehler');
  console.log('8 Rom-Szenentests bestanden (echter Three-Build, Canvas-Attrappe).');
}
