/* ------------------------------------------------------------------
   Tests fuer Gehstock Ops (shooter/): Simulation ohne Browser.

   Laeuft einzeln (node tools/shooter-tests.mjs) und als Teil von
   tools/test.mjs. Alles ist geseedet und deterministisch: gleicher Code,
   gleiches Ergebnis - auch auf dem Handy vor jedem Update.

   Geprueft wird, was beim Spielen nie passieren darf: durch Waende
   laufen oder schiessen, im Boden versinken, an Ecken haengen bleiben,
   falsche Feuerrate, falsches Nachladen, Matches ohne Ende, Bots, die
   festsitzen oder durch Waende sehen.
   ------------------------------------------------------------------ */

import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { kraehenfeld } from '../shooter/src/karte/kraehenfeld.js';
import { karteBauen, KARTEN_REIHE } from '../shooter/src/karte/karten.js';
import { Welt } from '../shooter/src/sim/welt.js';
import { Navigation } from '../shooter/src/sim/navigation.js';
import { botWaffe, Simulation } from '../shooter/src/sim/simulation.js';
import { augenhoehe, bewegeFigur, steckt } from '../shooter/src/sim/bewegung.js';
import { T_DUCKEN, T_FEUER, T_NACHLADEN, T_SPRINGEN, T_SPRINT, T_VISIER, neuerBefehl } from '../shooter/src/sim/befehl.js';
import { neueWaffe, streuungBerechnen } from '../shooter/src/sim/waffen.js';
import { schadenBerechnen, ZONE_BEINE, ZONE_KOPF, ZONE_RUMPF } from '../shooter/src/sim/treffer.js';
import { FIGUR, LEBEN, MATCH, TICK, WAFFEN, WAFFEN_REIHE } from '../shooter/src/konfig.js';
import { yawZu } from '../shooter/src/sim/mathe.js';

function pruefe(bedingung, text) {
  if (!bedingung) throw new Error(text);
}

function nahe(a, b, toleranz, text) {
  if (!(Math.abs(a - b) <= toleranz)) throw new Error(text + ': ' + a + ' statt ' + b + ' (±' + toleranz + ')');
}

/* --------------------------------------------------- Testumgebung */

function figur(x, y, z) {
  return {
    x, y, z, vx: 0, vy: 0, vz: 0, amBoden: false, geduckt: false, hoehe: FIGUR.hoehe, duckAnteil: 0,
    rutschZeit: 0, rutschPause: 0, rutschX: 0, rutschZ: 0, sprintet: false, stufenVersatz: 0,
    luftZeit: 0, schrittWeg: 0, landung: 0, vorher: 0,
  };
}

const WAFFE = neueWaffe('sturmgewehr');

function laufen(welt, f, bef, sekunden, jedenSchritt) {
  const n = Math.round(sekunden / TICK);
  for (let i = 0; i < n; i++) {
    const neu = bef.tasten & ~f.vorher;
    bewegeFigur(welt, f, bef, TICK, WAFFE, neu);
    f.vorher = bef.tasten;
    if (jedenSchritt) jedenSchritt(f, i);
  }
}

function boden(extra) {
  return new Welt([{ min: [-50, -1, -50], max: [50, 0, 50] }].concat(extra || []));
}

/* Simulation mit festgehaltenen Bots: ohne KI stehen sie still. */
function stilleSim(karte, welt, nav, o) {
  const sim = new Simulation(Object.assign({ karte, welt, nav, seed: 7, ohneVorlauf: true }, o || {}));
  for (const a of sim.akteure) {
    if (a.bot) a.ki = null;
    a.schutz = 0;
  }
  return sim;
}

function setze(a, x, y, z, yaw) {
  a.x = a.px = x;
  a.y = a.py = y;
  a.z = a.pz = z;
  a.vx = a.vy = a.vz = 0;
  if (yaw !== undefined) {
    a.yaw = a.pyaw = yaw;
    a.befehl.yaw = yaw;
  }
}

/* Den Spieler auf die Brust (oder den Kopf) eines Ziels ausrichten. */
function zielen(s, z, kopf) {
  const dx = z.x - s.x, dz = z.z - s.z;
  const d = Math.hypot(dx, dz);
  const zy = kopf ? z.y + z.hoehe - 0.13 : z.y + z.hoehe * 0.7;
  s.befehl.yaw = yawZu(dx, dz);
  s.befehl.pitch = Math.atan2(zy - (s.y + augenhoehe(s)), d);
}

function schritte(sim, n, vorher) {
  for (let i = 0; i < n; i++) {
    if (vorher) vorher(i);
    sim.schritt(TICK);
    sim.meldungenLeeren();
  }
}

/* ---------------------------------------------------------- Tests */

export function shooterTests(test) {
  const karte = kraehenfeld();
  const welt = new Welt(karte.quader.filter((q) => q.kollision));
  const nav = new Navigation(welt, karte.grenzen);

  /* --- Bewegung und Kollision --- */

  test('Ops: Figur landet auf dem Boden und faellt nicht durch', () => {
    const w = boden();
    const f = figur(0, 3, 0);
    laufen(w, f, neuerBefehl(), 2);
    pruefe(f.y === 0 && f.amBoden, 'y=' + f.y + ' amBoden=' + f.amBoden);
    // Auch aus grosser Hoehe mit Hoechsttempo nicht
    const g = figur(0, 60, 0);
    laufen(w, g, neuerBefehl(), 5);
    pruefe(g.y === 0 && g.amBoden, 'aus 60 m: y=' + g.y);
  });

  test('Ops: Lauf- und Sprinttempo stimmen', () => {
    const w = boden();
    const f = figur(0, 0, 0);
    const bef = neuerBefehl();
    bef.vor = 1;
    laufen(w, f, bef, 0.5);
    const z0 = f.z;
    laufen(w, f, bef, 1);
    nahe(z0 - f.z, FIGUR.tempo.gehen * WAFFEN.sturmgewehr.tempo, 0.05, 'Gehtempo');
    bef.tasten = T_SPRINT;
    laufen(w, f, bef, 0.5);
    const z1 = f.z;
    laufen(w, f, bef, 1);
    nahe(z1 - f.z, FIGUR.tempo.sprint * WAFFEN.sturmgewehr.tempo, 0.05, 'Sprinttempo');
  });

  test('Ops: niemand laeuft durch eine Wand, aus keinem Winkel', () => {
    const wand = { min: [5, 0, -200], max: [5.3, 3, 200] };
    const w = boden([wand]);
    for (const grad of [0, 15, 30, 45, 60, 75, 85, 89.5]) {
      const f = figur(0, 0, 0);
      const bef = neuerBefehl();
      // Richtung +X mit Winkel zur Wandnormalen
      bef.yaw = yawZu(Math.cos(grad * Math.PI / 180), Math.sin(grad * Math.PI / 180));
      bef.vor = 1;
      bef.tasten = T_SPRINT;
      laufen(w, f, bef, 4, (g) => {
        pruefe(!steckt(w, g), 'steckt in der Wand bei ' + grad + '°');
        pruefe(g.x + FIGUR.radius <= wand.min[0] + 1e-9, 'durch die Wand bei ' + grad + '°: x=' + g.x);
      });
    }
  });

  test('Ops: gleitet an Waenden entlang, Fugen und Ecken halten nicht auf', () => {
    // Zwei Mauerstuecke mit Fuge bei z=0, danach endet die Mauer bei z=6
    const w = boden([{ min: [2, 0, -10], max: [2.5, 3, 0] }, { min: [2, 0, 0], max: [2.5, 3, 6] }]);
    const f = figur(1.5, 0, -8);
    const bef = neuerBefehl();
    bef.yaw = yawZu(1, 1); // schraeg in die Wand
    bef.vor = 1;
    laufen(w, f, bef, 6, (g) => pruefe(!steckt(w, g), 'steckt'));
    pruefe(f.z > 6.5, 'haengt an der Mauer fest: z=' + f.z.toFixed(2));
    pruefe(f.x > 2.5, 'nicht um die Ecke gekommen: x=' + f.x.toFixed(2));
    // Innenecke: gerade hinein, bleibt stehen ohne zu zittern oder einzudringen
    const e = boden([{ min: [2, 0, -5], max: [2.5, 3, 5] }, { min: [-5, 0, 2], max: [2.5, 3, 2.5] }]);
    const g = figur(0, 0, 0);
    bef.yaw = yawZu(1, 1);
    laufen(e, g, bef, 3, (h) => pruefe(!steckt(e, h), 'steckt in der Innenecke'));
    pruefe(g.x < 2 && g.z < 2, 'Innenecke durchbrochen');
  });

  test('Ops: Treppen hinauf, hohe Kanten nicht', () => {
    const treppe = [];
    for (let i = 0; i < 4; i++) treppe.push({ min: [2 + i * 0.5, 0, -2], max: [2 + (i + 1) * 0.5, 0.25 * (i + 1), 2] });
    treppe.push({ min: [4, 0, -2], max: [8, 1, 2] });
    const w = boden(treppe);
    const f = figur(0, 0, 0);
    const bef = neuerBefehl();
    bef.yaw = yawZu(1, 0);
    bef.vor = 1;
    let oben = false;
    laufen(w, f, bef, 2.5, (g) => {
      pruefe(!steckt(w, g), 'steckt in der Treppe');
      if (g.x > 5 && g.x < 7.5) {
        pruefe(g.y === 1, 'auf der Plattform nicht oben: y=' + g.y);
        oben = true;
      }
    });
    pruefe(oben, 'Plattform nie erreicht');
    const k = boden([{ min: [2, 0, -2], max: [3, 0.6, 2] }]);
    const g = figur(0, 0, 0);
    laufen(k, g, bef, 2);
    pruefe(g.y === 0 && g.x < 2 - FIGUR.radius + 0.01, '0,6 m ohne Sprung erklommen');
  });

  test('Ops: Sprunghoehe reicht fuer Kisten (1 m), nicht fuer Container', () => {
    const w = boden();
    const f = figur(0, 0, 0);
    laufen(w, f, neuerBefehl(), 0.2);
    const bef = neuerBefehl();
    bef.tasten = T_SPRINGEN;
    let max = 0;
    laufen(w, f, bef, 0.02);
    bef.tasten = 0;
    laufen(w, f, bef, 1.5, (g) => { max = Math.max(max, g.y); });
    pruefe(max > 1.22 && max < 1.45, 'Sprunghoehe ' + max.toFixed(2));
    // Mit Anlauf auf eine 1,2 m hohe Kiste
    const k = boden([{ min: [3, 0, -1], max: [4.2, 1.2, 1] }]);
    const g = figur(0, 0, 0);
    const lauf = neuerBefehl();
    lauf.yaw = yawZu(1, 0);
    lauf.vor = 1;
    laufen(k, g, lauf, 0.25);
    lauf.tasten = T_SPRINGEN;
    laufen(k, g, lauf, TICK);
    lauf.tasten = 0;
    laufen(k, g, lauf, 0.45);
    pruefe(g.y === 1.2 || g.x > 3.2, 'nicht auf die Kiste gekommen: x=' + g.x.toFixed(2) + ' y=' + g.y.toFixed(2));
    // Container (2,6 m) bleiben unerreichbar
    const c = boden([{ min: [3, 0, -1], max: [9, 2.6, 1] }]);
    const h = figur(0, 0, 0);
    laufen(c, h, lauf, 0.25);
    lauf.tasten = T_SPRINGEN;
    laufen(c, h, lauf, TICK);
    lauf.tasten = 0;
    laufen(c, h, lauf, 1.5);
    pruefe(h.y < 0.01 && h.x < 3, 'auf den Container gesprungen');
  });

  test('Ops: unter niedriger Decke bleibt man geduckt', () => {
    const w = boden([{ min: [-2, 1.5, -2], max: [2, 2, 2] }]);
    const f = figur(-4, 0, 0);
    const bef = neuerBefehl();
    bef.yaw = yawZu(1, 0);
    bef.tasten = T_DUCKEN;
    bef.vor = 1;
    laufen(w, f, bef, 1.4);
    pruefe(f.geduckt && f.x > -1.5 && f.x < 1.5, 'nicht unter der Decke: x=' + f.x.toFixed(2));
    bef.tasten = 0;
    bef.vor = 0;
    laufen(w, f, bef, 0.5);
    pruefe(f.geduckt && f.hoehe === FIGUR.hoeheGeduckt, 'unter der Decke aufgestanden');
    pruefe(!steckt(w, f), 'steckt in der Decke');
    bef.vor = 1;
    laufen(w, f, bef, 1.5);
    pruefe(!f.geduckt, 'draussen nicht aufgestanden');
  });

  test('Ops: Rutschen aus dem Sprint, danach geduckt', () => {
    const w = boden();
    const f = figur(0, 0, 0);
    const bef = neuerBefehl();
    bef.vor = 1;
    bef.tasten = T_SPRINT;
    laufen(w, f, bef, 1);
    bef.tasten = T_SPRINT | T_DUCKEN;
    laufen(w, f, bef, TICK);
    pruefe(f.rutschZeit > 0, 'kein Rutschen');
    const v = Math.hypot(f.vx, f.vz);
    pruefe(v > FIGUR.tempo.sprint, 'Rutschen nicht schneller: ' + v.toFixed(2));
    laufen(w, f, bef, 1);
    pruefe(f.rutschZeit <= 0 && f.geduckt, 'nach dem Rutschen nicht geduckt');
  });

  // Alle Karten einmal bauen (Kollision und Wegenetz)
  const alle = KARTEN_REIHE.map((id) => {
    const k = karteBauen(id);
    const w = new Welt(k.quader.filter((q) => q.kollision));
    return { id, karte: k, welt: w, nav: new Navigation(w, k.grenzen) };
  });

  test('Ops: auf keiner Karte steckt ein Spawn oder Wegpunkt in einer Wand', () => {
    for (const { id, karte: k, welt: w, nav: n } of alle) {
      pruefe(k.spawns[0].length >= 7 && k.spawns[1].length >= 7, id + ': zu wenig Spawns');
      pruefe(k.wege.length === 3 && k.wege.every((x) => x.punkte.length === 7), id + ': Bots brauchen drei Wege mit sieben Punkten');
      for (const team of [0, 1]) {
        for (const p of k.spawns[team]) {
          pruefe(!steckt(w, figur(p.x, 0, p.z)), id + ': Spawn steckt: ' + p.x + ',' + p.z);
          pruefe(n.begehbar(p.x, p.z), id + ': Spawn nicht begehbar: ' + p.x + ',' + p.z);
        }
      }
      for (const x of k.wege) {
        for (const p of x.punkte) pruefe(n.begehbar(p[0], p[1]), id + ': Wegpunkt ' + x.name + ' ' + p);
      }
    }
  });

  test('Ops: jede Karte ist rundum geschlossen und die Spawns sehen sich kaum', () => {
    for (const { id, karte: k, welt: w } of alle) {
      const g = k.grenzen;
      // Von der Mitte in 64 Richtungen: ueberall kommt vor dem Rand eine Wand
      for (let i = 0; i < 64; i++) {
        const a = (i / 64) * Math.PI * 2;
        const t = w.strahl(0, 1.0, 0, Math.cos(a), 0, Math.sin(a), 200);
        pruefe(t < 200, id + ': offen in Richtung ' + Math.round(a * 57.3) + ' Grad');
      }
      // Freie Sicht von Spawn zu Spawn: hoechstens wie auf Kraehenfeld
      let frei = 0;
      for (const p of k.spawns[0]) {
        for (const q of k.spawns[1]) {
          const dx = q.x - p.x, dz = q.z - p.z, l = Math.hypot(dx, dz);
          if (w.strahl(p.x, 1.62, p.z, dx / l, 0, dz / l, l) >= l - 0.01) frei++;
        }
      }
      pruefe(frei <= 3, id + ': ' + frei + ' freie Sichtlinien zwischen den Spawns');
      pruefe(g.maxX - g.minX >= 50 && g.maxZ - g.minZ >= 36, id + ': zu klein');
    }
  });

  test('Ops: Navigation verbindet auf allen Karten alle Spawns und Wegpunkte', () => {
    const aus2 = new Float32Array(200);
    for (const { id, karte: k, nav: n } of alle) {
      for (const s0 of k.spawns[0]) {
        const ziele = k.spawns[1].map((p) => [p.x, p.z]).concat(...k.wege.map((w) => w.punkte));
        for (const z of ziele) pruefe(n.pfad(s0.x, s0.z, 0, z[0], z[1], aus2, 80) > 0, id + ': kein Weg von ' + s0.x + ',' + s0.z + ' nach ' + z);
      }
    }
  });

  test('Ops: Navigation verbindet alle Spawns und Wegpunkte', () => {
    const aus = new Float32Array(200);
    const s0 = karte.spawns[0][0];
    const ziele = karte.spawns[1].map((p) => [p.x, p.z]).concat(...karte.wege.map((w) => w.punkte));
    for (const z of ziele) {
      const n = nav.pfad(s0.x, s0.z, 0, z[0], z[1], aus, 80);
      pruefe(n > 0, 'kein Weg nach ' + z);
      // Der geglaettete Pfad fuehrt nirgends durch eine Wand
      let px = s0.x, pz = s0.z;
      for (let i = 0; i < n; i++) {
        const qx = aus[i * 2], qz = aus[i * 2 + 1];
        pruefe(nav.linieFrei(px, pz, qx, qz, 0.3) || Math.hypot(qx - px, qz - pz) < 0.8, 'Pfadstueck durch Hindernis bei ' + qx.toFixed(1) + ',' + qz.toFixed(1));
        px = qx;
        pz = qz;
      }
    }
    // Das Podest ist ueber die Treppen erreichbar
    pruefe(nav.bodenBei(0, 0) === 1, 'Podest: Boden ' + nav.bodenBei(0, 0));
    pruefe(nav.pfad(-10, 0, 0, 0, 0, aus, 80) > 0, 'Podest nicht erreichbar');
  });

  /* --- Strahlen und Treffer --- */

  test('Ops: Strahl trifft die erste Wand und meldet die Seite', () => {
    const w = boden([{ min: [5, 0, -1], max: [6, 3, 1] }, { min: [8, 0, -1], max: [9, 3, 1] }]);
    const t = w.strahl(0, 1, 0, 1, 0, 0, 100);
    nahe(t, 5, 1e-9, 'Entfernung');
    pruefe(w.nx === -1 && w.ny === 0 && w.nz === 0, 'Normale');
    pruefe(!w.sichtFrei(0, 1, 0, 10, 1, 0), 'Sicht durch Wand');
    pruefe(w.sichtFrei(0, 3.5, 0, 10, 3.5, 0), 'Sicht ueber die Wand blockiert');
  });

  test('Ops: Treffer auf freiem Feld, keiner durch Deckung', () => {
    const sim = stilleSim(karte, welt, nav);
    const s = sim.spieler;
    const z = sim.akteure.find((a) => a.team === 1);
    // Freie Linie im Containerhof
    setze(s, -5, 0, -18.2, yawZu(1, 0));
    setze(z, 5, 0, -18.2);
    s.waffe.visier = 1;
    zielen(s, z);
    s.befehl.tasten = T_FEUER | T_VISIER;
    schritte(sim, 1);
    s.befehl.tasten = T_VISIER;
    nahe(z.leben, LEBEN.max - WAFFEN.sturmgewehr.schaden, 0.01, 'Rumpftreffer');
    // Hinter der Trennmauer: 30 Schuss, kein Schaden
    const sim2 = stilleSim(karte, welt, nav);
    const s2 = sim2.spieler;
    const z2 = sim2.akteure.find((a) => a.team === 1);
    setze(s2, 8, 0, -6.5);
    setze(z2, 8, 0, -10.5);
    s2.waffe.visier = 1;
    zielen(s2, z2);
    let einschlaege = 0;
    for (let i = 0; i < 180; i++) {
      s2.befehl.tasten = T_FEUER | T_VISIER;
      zielen(s2, z2);
      sim2.schritt(TICK);
      for (const m of sim2.meldungen) if (m.typ === 'einschlag') einschlaege++;
      sim2.meldungenLeeren();
    }
    pruefe(s2.schuesse >= 20, 'zu wenig geschossen: ' + s2.schuesse);
    pruefe(z2.leben === LEBEN.max, 'Schaden durch die Mauer: ' + z2.leben);
    pruefe(einschlaege >= 20, 'Einschlaege in der Mauer fehlen: ' + einschlaege);
  });

  test('Ops: Kopftreffer zaehlen mehr, Beine weniger, Schaden faellt ab', () => {
    const sim = stilleSim(karte, welt, nav);
    const s = sim.spieler;
    const z = sim.akteure.find((a) => a.team === 1);
    setze(s, -5, 0, -18.2);
    setze(z, 5, 0, -18.2);
    s.waffe.visier = 1;
    zielen(s, z, true);
    s.befehl.tasten = T_FEUER | T_VISIER;
    schritte(sim, 1);
    nahe(LEBEN.max - z.leben, WAFFEN.sturmgewehr.schaden * WAFFEN.sturmgewehr.kopf, 0.01, 'Kopftreffer');
    const d = WAFFEN.sturmgewehr;
    nahe(schadenBerechnen(d, 10, ZONE_RUMPF), d.schaden, 1e-9, 'voll bis ' + d.reichweite.voll + ' m');
    nahe(schadenBerechnen(d, 200, ZONE_RUMPF), d.schadenMin, 1e-9, 'Mindestschaden');
    nahe(schadenBerechnen(d, 10, ZONE_BEINE), d.schaden * d.bein, 1e-9, 'Beine');
    nahe(schadenBerechnen(d, 10, ZONE_KOPF), d.schaden * d.kopf, 1e-9, 'Kopf');
    const sf = WAFFEN.schrotflinte;
    pruefe(schadenBerechnen(sf, 4, ZONE_RUMPF) * sf.kugeln >= 100, 'Schrot toetet aus der Naehe nicht');
  });

  test('Ops: kein Eigenbeschuss, Kugeln gehen durch Verbuendete', () => {
    const sim = stilleSim(karte, welt, nav);
    const s = sim.spieler;
    const freund = sim.akteure.find((a) => a.team === 0 && a.bot);
    const feind = sim.akteure.find((a) => a.team === 1);
    setze(s, -5, 0, -18.2);
    setze(freund, 0, 0, -18.2);
    setze(feind, 5, 0, -18.2);
    s.waffe.visier = 1;
    zielen(s, feind);
    s.befehl.tasten = T_FEUER | T_VISIER;
    schritte(sim, 1);
    pruefe(freund.leben === LEBEN.max, 'Verbuendeter getroffen');
    pruefe(feind.leben < LEBEN.max, 'Kugel blieb am Verbuendeten haengen');
  });

  /* --- Waffen --- */

  test('Ops: Feuerrate ist exakt und haengt nicht an der Bildrate', () => {
    for (const id of ['sturmgewehr', 'mp']) {
      const sim = stilleSim(karte, welt, nav, { spielerWaffe: id });
      const s = sim.spieler;
      setze(s, -26, 0, 0);
      s.waffe.reserve = 999;
      s.befehl.tasten = T_FEUER;
      const n = Math.round(2 / TICK);
      schritte(sim, n);
      const erwartet = Math.floor(2 * WAFFEN[id].rpm / 60) + 1;
      pruefe(Math.abs(s.waffe.schuesse - erwartet) <= 1, id + ': ' + s.waffe.schuesse + ' statt ' + erwartet);
    }
  });

  test('Ops: Nachladen - Magazin, Reserve, Dauer, automatisch bei leerem Magazin', () => {
    const sim = stilleSim(karte, welt, nav);
    const s = sim.spieler;
    setze(s, -26, 0, 0);
    const w = s.waffe;
    const def = WAFFEN.sturmgewehr;
    s.befehl.tasten = T_FEUER;
    let t = 0;
    while (w.magazin > 0 && t++ < 600) schritte(sim, 1);
    pruefe(w.magazin === 0, 'Magazin nicht leer');
    schritte(sim, 2);
    pruefe(w.laden > 0, 'kein automatisches Nachladen');
    nahe(w.ladenGesamt, def.nachladenLeer, 1e-9, 'Dauer leer');
    s.befehl.tasten = 0;
    schritte(sim, Math.ceil(def.nachladenLeer / TICK) + 1);
    pruefe(w.magazin === def.magazin && w.reserve === def.reserve - def.magazin, 'nach Laden: ' + w.magazin + '/' + w.reserve);
    // Taktisch: 10 Schuss raus, R
    s.befehl.tasten = T_FEUER;
    while (w.magazin > def.magazin - 10) schritte(sim, 1);
    s.befehl.tasten = T_NACHLADEN;
    schritte(sim, 1);
    s.befehl.tasten = 0;
    nahe(w.ladenGesamt, def.nachladen, 1e-9, 'Dauer taktisch');
    const reserve = w.reserve;
    schritte(sim, Math.ceil(def.nachladen / TICK) - 5);
    pruefe(w.magazin === def.magazin - 10, 'zu frueh geladen');
    schritte(sim, 10);
    pruefe(w.magazin === def.magazin && w.reserve === reserve - 10, 'Reserve falsch: ' + w.reserve);
  });

  test('Ops: Schrotflinte laedt Patrone fuer Patrone, Schuss unterbricht', () => {
    const sim = stilleSim(karte, welt, nav, { spielerWaffe: 'schrotflinte' });
    const s = sim.spieler;
    setze(s, -26, 0, 0);
    const w = s.waffe;
    s.befehl.tasten = T_FEUER;
    schritte(sim, Math.ceil(2 / TICK));
    s.befehl.tasten = 0;
    schritte(sim, 1);
    const vorher = w.magazin;
    pruefe(vorher <= w.def.magazin - 2, 'zu wenig geschossen');
    s.befehl.tasten = T_NACHLADEN;
    schritte(sim, 1);
    s.befehl.tasten = 0;
    const e = w.def.einzelnLaden;
    schritte(sim, Math.ceil((e.start + e.patrone + 0.05) / TICK));
    pruefe(w.magazin === vorher + 1, 'erste Patrone: ' + w.magazin);
    const schuss = w.schuesse;
    s.befehl.tasten = T_FEUER;
    schritte(sim, 1);
    pruefe(w.schuesse === schuss + 1 && w.laden === 0, 'Schuss unterbricht nicht');
  });

  test('Ops: im Sprint wird nicht geschossen, danach kurz verzoegert', () => {
    const sim = stilleSim(karte, welt, nav);
    const s = sim.spieler;
    setze(s, -26, 0, 0, yawZu(1, 0));
    s.befehl.vor = 1;
    s.befehl.tasten = T_SPRINT;
    schritte(sim, 30);
    pruefe(s.sprintet, 'sprintet nicht');
    const vorher = s.waffe.schuesse;
    // Feuer beendet den Sprint, der erste Schuss kommt nach sprintAus
    s.befehl.tasten = T_SPRINT | T_FEUER;
    schritte(sim, 1);
    pruefe(!s.sprintet && s.waffe.schuesse === vorher, 'Schuss im Sprint');
    schritte(sim, Math.ceil(WAFFEN.sturmgewehr.sprintAus / TICK) + 1);
    pruefe(s.waffe.schuesse > vorher, 'nach dem Sprint kein Schuss');
  });

  test('Ops: Visierfeuer trifft sofort den Visierpunkt, Bots zielen wie bisher', () => {
    for (const id of WAFFEN_REIHE) {
      const sim = stilleSim(karte, welt, nav);
      const s = sim.spieler;
      setze(s, -26, 0, 0, yawZu(1, 0));
      s.waffe = neueWaffe(id);
      // Aus der Huefte: Visierfeuer gedrueckt - erster Schuss im ersten Schritt
      s.befehl.tasten = T_FEUER | T_VISIER;
      schritte(sim, 1);
      const def = WAFFEN[id];
      pruefe(s.waffe.schuesse === 1, id + ': kein sofortiger Schuss');
      pruefe(s.waffe.visier < 0.2, id + ': Visier schon oben?');
      const anteil = def.zielAnteil !== undefined ? def.zielAnteil : 0.9;
      const soll = def.streuung.hueft + (def.streuung.visier - def.streuung.hueft) * anteil;
      // streuung enthaelt schon den Aufschlag dieses Schusses (bloom) - der Schuss selbst flog ohne
      const erster = s.waffe.streuung - s.waffe.bloom;
      pruefe(erster <= soll + 1e-9, id + ': erster Schuss streut ' + erster.toFixed(2) + ' Grad');
      // Loslassen: zurueck aus dem Visier, Streuung wieder aus der Huefte
      s.befehl.tasten = 0;
      schritte(sim, 60);
      pruefe(s.waffe.visier === 0 && s.waffe.streuung > soll, id + ': nach dem Loslassen nicht zurueck');
    }
    // Bots bekommen den Vorteil nicht
    const sim = stilleSim(karte, welt, nav);
    const b = sim.akteure.find((a) => a.bot);
    const w = b.waffe;
    w.visier = 0.1;
    w.menschZielt = false;
    b.vx = 0; b.vz = 0; b.amBoden = true; b.geduckt = false;
    const stBot = streuungBerechnen(b, w);
    pruefe(stBot > w.def.streuung.hueft * 0.85, 'Bot streut nicht mehr wie aus der Huefte');
  });

  /* --- Leben, Spawn, Match --- */

  test('Ops: Spawnschutz haelt Schaden ab und endet beim eigenen Schuss', () => {
    const sim = stilleSim(karte, welt, nav);
    const s = sim.spieler;
    const z = sim.akteure.find((a) => a.team === 1);
    setze(s, -5, 0, -18.2);
    setze(z, 5, 0, -18.2);
    z.schutz = 2;
    s.waffe.visier = 1;
    zielen(s, z);
    s.befehl.tasten = T_FEUER | T_VISIER;
    schritte(sim, 1);
    pruefe(z.leben === LEBEN.max, 'Schaden trotz Schutz');
    // Der Geschuetzte schiesst selbst: Schutz ist weg
    z.befehl.tasten = T_FEUER;
    z.befehl.yaw = yawZu(-1, 0);
    sim.schritt(TICK);
    pruefe(z.schutz === 0, 'Schutz bleibt nach eigenem Schuss');
  });

  test('Ops: Gesundheit heilt erst nach der Pause ohne Treffer', () => {
    const sim = stilleSim(karte, welt, nav);
    const s = sim.spieler;
    setze(s, -26, 0, 0);
    s.leben = 40;
    s.letzterTreffer = sim.zeit;
    schritte(sim, Math.floor((LEBEN.regenPause - 0.2) / TICK));
    pruefe(s.leben === 40, 'heilt zu frueh: ' + s.leben);
    schritte(sim, Math.ceil(0.4 / TICK) + Math.ceil(60 / LEBEN.regenRate / TICK));
    pruefe(s.leben === LEBEN.max, 'nicht geheilt: ' + s.leben);
  });

  test('Ops: Abschuss zaehlt, Respawn mit vollem Leben und Munition', () => {
    const sim = stilleSim(karte, welt, nav);
    const s = sim.spieler;
    const z = sim.akteure.find((a) => a.team === 1);
    setze(s, -5, 0, -18.2);
    setze(z, 5, 0, -18.2);
    z.waffe.magazin = 3;
    s.waffe.visier = 1;
    let t = 0;
    while (z.lebt && t++ < 120) {
      zielen(s, z);
      s.befehl.tasten = T_FEUER | T_VISIER;
      schritte(sim, 1);
    }
    pruefe(!z.lebt, 'Ziel nicht ausgeschaltet');
    pruefe(s.abschuesse === 1 && z.tode === 1 && sim.punkte[0] === 1, 'Zaehlung falsch');
    s.befehl.tasten = 0;
    schritte(sim, Math.ceil(MATCH.respawn / TICK) + 2);
    pruefe(z.lebt && z.leben === LEBEN.max && z.waffe.magazin === z.waffe.def.magazin, 'Respawn unvollstaendig');
    pruefe(z.schutz > 0, 'kein Spawnschutz');
    pruefe(Math.hypot(z.x - s.x, z.z - s.z) > 20, 'Respawn direkt neben dem Gegner');
  });

  test('Ops: Match endet bei 30 Punkten und nach Zeitablauf', () => {
    const sim = stilleSim(karte, welt, nav);
    const s = sim.spieler;
    const z = sim.akteure.find((a) => a.team === 1);
    sim.punkte[0] = MATCH.zielPunkte - 1;
    setze(s, -5, 0, -18.2);
    setze(z, 5, 0, -18.2);
    z.leben = 1;
    s.waffe.visier = 1;
    zielen(s, z);
    s.befehl.tasten = T_FEUER | T_VISIER;
    schritte(sim, 1);
    pruefe(sim.phase === 'ende' && sim.sieger === 0, 'kein Ende bei ' + sim.punkte[0]);
    const sim2 = stilleSim(karte, welt, nav);
    sim2.restzeit = 0.5;
    schritte(sim2, 60);
    pruefe(sim2.phase === 'ende' && sim2.sieger === -1, 'kein Ende nach Zeitablauf');
    // Nach dem Ende bewegt sich niemand mehr
    const x = sim2.spieler.x;
    sim2.spieler.befehl.vor = 1;
    schritte(sim2, 30);
    pruefe(sim2.spieler.x === x, 'Bewegung nach Matchende');
  });

  test('Ops: Spawnwahl meidet Gegner', () => {
    const sim = stilleSim(karte, welt, nav);
    const s = sim.spieler;
    // Gegner stehen im Norden der eigenen Basis
    const gegner = sim.akteure.filter((a) => a.team === 1);
    gegner.forEach((g, i) => setze(g, -27, 0, -14 + i));
    for (let i = 0; i < 10; i++) {
      const p = sim.spawnPunkt(s);
      pruefe(p.z > 0, 'Spawn bei den Gegnern: z=' + p.z);
    }
  });

  /* --- Bots --- */

  test('Ops: Bots sehen nicht durch Waende und reagieren nicht sofort', () => {
    const sim = new Simulation({ karte, welt, nav, seed: 11, ohneVorlauf: true, schwierigkeit: 'schwer' });
    for (const a of sim.akteure) if (a !== sim.akteure[3]) { if (a.bot) a.ki = null; }
    const s = sim.spieler;
    const bot = sim.akteure[3];
    // Hinter der Mauer, direkt zugewandt
    setze(s, 8, 0, -6.5);
    setze(bot, 8, 0, -10.5, yawZu(0, 1));
    s.schutz = 0;
    schritte(sim, 30, () => { s.befehl.tasten = 0; });
    pruefe(!bot.ki.zielSicht, 'Bot sieht durch die Mauer');
    // Freie Sicht: erst nach der Reaktionszeit wird geschossen
    setze(s, -5, 0, -18.2);
    setze(bot, 5, 0, -18.2, yawZu(-1, 0));
    bot.schutz = 0;
    const schuss0 = bot.waffe.schuesse;
    let gesehen = -1, geschossen = -1;
    for (let i = 0; i < 120; i++) {
      s.befehl.tasten = 0;
      sim.schritt(TICK);
      sim.meldungenLeeren();
      if (gesehen < 0 && bot.ki.zielSicht) gesehen = sim.zeit;
      if (geschossen < 0 && bot.waffe.schuesse > schuss0) geschossen = sim.zeit;
    }
    pruefe(gesehen > 0, 'Bot sieht den Spieler nicht');
    pruefe(geschossen > 0, 'Bot schiesst nicht');
    pruefe(geschossen - gesehen >= sim.stufe.reaktion[0] - 0.02, 'Reaktion zu schnell: ' + (geschossen - gesehen).toFixed(2));
  });

  test('Ops: komplette Bot-Matches auf allen Stufen laufen sauber durch', () => {
    for (const stufe of ['leicht', 'normal', 'schwer']) {
      const sim = new Simulation({ karte, welt, nav, seed: 1234, schwierigkeit: stufe, nurBots: true });
      const weg = new Float64Array(6);
      let nachladen = 0, abschuesse = 0;
      const t0 = performance.now();
      let n = 0;
      while (sim.phase !== 'ende' && n < (MATCH.dauer + MATCH.vorlauf + 1) / TICK) {
        const vorher = sim.akteure.map((a) => [a.x, a.z, a.lebt]);
        sim.schritt(TICK);
        n++;
        for (const m of sim.meldungen) {
          if (m.typ === 'nachladen') nachladen++;
          if (m.typ === 'abschuss') abschuesse++;
        }
        sim.meldungenLeeren();
        sim.akteure.forEach((a, i) => {
          pruefe(Number.isFinite(a.x + a.y + a.z + a.yaw + a.pitch), 'NaN bei ' + a.name);
          if (a.lebt && vorher[i][2]) weg[i] += Math.hypot(a.x - vorher[i][0], a.z - vorher[i][1]);
          if (a.lebt) pruefe(!steckt(welt, a), a.name + ' steckt in der Welt bei ' + a.x.toFixed(1) + ',' + a.z.toFixed(1));
        });
      }
      const ms = (performance.now() - t0) / n;
      pruefe(sim.phase === 'ende', stufe + ': Match endet nicht');
      pruefe(abschuesse >= 15, stufe + ': zu wenig Action (' + abschuesse + ' Abschuesse)');
      pruefe(nachladen > 0, stufe + ': niemand laedt nach');
      for (let i = 0; i < 6; i++) pruefe(weg[i] > 60, stufe + ': ' + sim.akteure[i].name + ' bewegt sich kaum (' + weg[i].toFixed(0) + ' m)');
      pruefe(ms < 1.5, stufe + ': Simulationsschritt zu langsam (' + ms.toFixed(3) + ' ms)');
    }
  });

  test('Ops: Bot-Matches auf den neuen Karten laufen sauber durch, niemand sitzt fest', () => {
    for (const { id, karte: k, welt: w, nav: n } of alle) {
      if (id === 'kraehenfeld') continue;
      const sim = new Simulation({ karte: k, welt: w, nav: n, seed: 4321, schwierigkeit: 'normal', nurBots: true });
      const weg = new Float64Array(6);
      let abschuesse = 0, schuesse = 0;
      let i = 0;
      while (sim.phase !== 'ende' && i < (MATCH.dauer + MATCH.vorlauf + 1) / TICK) {
        const vorher = sim.akteure.map((a) => [a.x, a.z, a.lebt]);
        sim.schritt(TICK);
        i++;
        for (const m of sim.meldungen) {
          if (m.typ === 'abschuss') abschuesse++;
          if (m.typ === 'schuss') schuesse++;
        }
        sim.meldungenLeeren();
        sim.akteure.forEach((a, j) => {
          if (a.lebt && vorher[j][2]) weg[j] += Math.hypot(a.x - vorher[j][0], a.z - vorher[j][1]);
          if (a.lebt) pruefe(!steckt(w, a), id + ': ' + a.name + ' steckt bei ' + a.x.toFixed(1) + ',' + a.z.toFixed(1));
        });
      }
      pruefe(sim.phase === 'ende', id + ': Match endet nicht');
      pruefe(abschuesse >= 15, id + ': zu wenig Action (' + abschuesse + ' Abschuesse)');
      for (let j = 0; j < 6; j++) pruefe(weg[j] > 60, id + ': ' + sim.akteure[j].name + ' bewegt sich kaum (' + weg[j].toFixed(0) + ' m)');
    }
  });

  /* --- Neue Waffen --- */

  test('Ops: halbautomatische Waffen schiessen einmal je Druck, gehalten nicht weiter', () => {
    for (const id of WAFFEN_REIHE.filter((x) => WAFFEN[x].halbautomatisch)) {
      const sim = stilleSim(karte, welt, nav, { spielerWaffe: id });
      const s = sim.spieler;
      setze(s, -26, 0, 0);
      s.befehl.tasten = T_FEUER;
      schritte(sim, 90);
      pruefe(s.waffe.schuesse === 1, id + ': gehalten ' + s.waffe.schuesse + ' Schuesse statt 1');
      // Loslassen und wieder druecken: der naechste Schuss
      s.befehl.tasten = 0;
      schritte(sim, 1);
      s.befehl.tasten = T_FEUER;
      schritte(sim, 1);
      pruefe(s.waffe.schuesse === 2, id + ': zweiter Druck ohne Schuss');
      // Schnell tippen: nie schneller als die Feuerrate erlaubt
      const n0 = s.waffe.schuesse;
      for (let k = 0; k < 120; k++) {
        s.befehl.tasten = k % 2 ? 0 : T_FEUER;
        schritte(sim, 1);
      }
      const max = Math.floor(2 * WAFFEN[id].rpm / 60) + 1;
      pruefe(s.waffe.schuesse - n0 <= Math.min(max, WAFFEN[id].magazin), id + ': zu schnell (' + (s.waffe.schuesse - n0) + ')');
    }
    // Dauerfeuerwaffen feuern gehalten weiter
    const sim = stilleSim(karte, welt, nav, { spielerWaffe: 'mg' });
    sim.spieler.befehl.tasten = T_FEUER;
    setze(sim.spieler, -26, 0, 0);
    schritte(sim, 60);
    pruefe(sim.spieler.waffe.schuesse > 8, 'MG feuert gehalten nicht weiter');
  });

  test('Ops: Scharfschuetzengewehr - Oberkoerper toedlich, Beine nicht, Fernrohr braucht Zeit', () => {
    const d = WAFFEN.scharfschuetze;
    pruefe(schadenBerechnen(d, 50, ZONE_RUMPF) >= LEBEN.max, 'Rumpftreffer auf 50 m toetet nicht');
    pruefe(schadenBerechnen(d, 20, ZONE_BEINE) < LEBEN.max, 'Beintreffer toetet');
    pruefe(schadenBerechnen(WAFFEN.praezision, 20, ZONE_RUMPF) * 3 >= LEBEN.max && schadenBerechnen(WAFFEN.praezision, 20, ZONE_RUMPF) * 2 < LEBEN.max,
      'Praezisionsgewehr: nicht genau drei Rumpftreffer');
    pruefe(schadenBerechnen(WAFFEN.pistole, 8, ZONE_RUMPF) * 3 >= LEBEN.max, 'Pistole braucht mehr als drei Treffer aus der Naehe');
    const sim = stilleSim(karte, welt, nav, { spielerWaffe: 'scharfschuetze' });
    const s = sim.spieler;
    const z = sim.akteure.find((a) => a.team === 1);
    setze(s, -5, 0, -18.2);
    setze(z, 5, 0, -18.2);
    s.waffe.visier = 1;
    zielen(s, z);
    s.befehl.tasten = T_FEUER | T_VISIER;
    schritte(sim, 1);
    pruefe(!z.lebt, 'Rumpftreffer mit dem Scharfschuetzengewehr ueberlebt (' + z.leben + ')');
    // Aus der Huefte: grosse Streuung - erst angelegt ist es genau
    const w = neueWaffe('scharfschuetze');
    const f = { vx: 0, vz: 0, amBoden: true, geduckt: false, rutschZeit: 0 };
    w.menschZielt = true;
    w.visier = 0;
    const huefte = streuungBerechnen(f, w);
    w.visier = 1;
    const voll = streuungBerechnen(f, w);
    pruefe(huefte > 3 && voll < 0.1, 'Streuung Huefte ' + huefte.toFixed(2) + ', im Fernrohr ' + voll.toFixed(2));
  });

  test('Ops: Bots nehmen alle Waffen und schiessen mit jeder', () => {
    const gesehen = new Set();
    for (let i = 0; i < 1000; i++) gesehen.add(botWaffe(i / 1000));
    pruefe(WAFFEN_REIHE.every((id) => gesehen.has(id)), 'nicht jede Waffe kommt vor: ' + [...gesehen].join(','));
    for (const id of WAFFEN_REIHE) {
      const sim = new Simulation({ karte, welt, nav, seed: 99, schwierigkeit: 'normal', nurBots: true, ohneVorlauf: true });
      for (const a of sim.akteure) { a.waffe = neueWaffe(id); a.naechsteWaffe = id; }
      let schuesse = 0, treffer = 0;
      for (let i = 0; i < 60 / TICK && treffer < 3; i++) {
        sim.schritt(TICK);
        for (const m of sim.meldungen) {
          if (m.typ === 'schuss') schuesse++;
          if (m.typ === 'treffer') treffer++;
        }
        sim.meldungenLeeren();
      }
      pruefe(schuesse > 0 && treffer >= 3, id + ': Bots schiessen ' + schuesse + ' mal, ' + treffer + ' Treffer');
    }
  });

  /* --- Leistung --- */

  test('Ops: Strahltest und Pfadsuche sind billig', () => {
    const t0 = performance.now();
    let summe = 0;
    for (let i = 0; i < 20000; i++) {
      const w = i * 0.37;
      summe += Math.min(99, welt.strahl(0, 1.6, 0, Math.cos(w), 0.01, Math.sin(w), 80));
    }
    const proStrahl = (performance.now() - t0) * 1000 / 20000;
    pruefe(summe > 0 && proStrahl < 25, 'Strahltest ' + proStrahl.toFixed(2) + ' µs');
    const aus = new Float32Array(200);
    const t1 = performance.now();
    for (let i = 0; i < 40; i++) nav.pfad(-28, -16 + i * 0.5, 0, 28, 16 - i * 0.5, aus, 80);
    const proPfad = (performance.now() - t1) / 40;
    // Grenzen grosszuegig: die Tests laufen auch vor jedem Update auf dem langsameren Handy
    pruefe(proPfad < 25, 'Pfadsuche ' + proPfad.toFixed(2) + ' ms');
  });
}

/* Einzeln ausfuehrbar */
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  let ok = 0, schlecht = 0;
  const test = (name, fn) => {
    const t0 = performance.now();
    try {
      fn();
      ok++;
      console.log('  ok   ' + name + '  (' + Math.round(performance.now() - t0) + ' ms)');
    } catch (e) {
      schlecht++;
      console.log('  FAIL ' + name + '  -> ' + e.message);
    }
  };
  console.log('\nGehstock Ops');
  shooterTests(test);
  console.log('\n' + ok + ' bestanden, ' + schlecht + ' durchgefallen\n');
  process.exit(schlecht ? 1 : 0);
}
