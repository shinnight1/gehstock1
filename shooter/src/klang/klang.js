/* ------------------------------------------------------------------
   Ton: alle Geraeusche werden beim ersten Antippen erzeugt.

   Keine Audiodateien - Schuesse, Nachladen, Schritte und Signale sind
   kleine Syntheserezepte (gefiltertes Rauschen, Sinus-Schlaege). Beim
   Entsperren (erste Beruehrung oder erster Klick, so verlangt es
   Safari) werden sie einmal in Puffer gerechnet; danach kostet ein
   Geraeusch nur noch einen Pufferknoten.

   Geraeusche anderer Figuren klingen raeumlich: leiser und dumpfer mit
   der Entfernung, links oder rechts je nach Richtung.

   Stimmen sind hart begrenzt. Ohne Grenze liefen im Gefecht (sechs
   Figuren, Dauerfeuer, Schritte, Einschlaege) weit ueber hundert
   Audioknoten gleichzeitig - Safari auf dem iPad verkraftet das schlecht.
   Eigene Geraeusche und Rueckmeldungen haben Vorrang und verdraengen
   notfalls die aelteste Umgebungsstimme. Jede Stimme wird nach dem Ende
   vom Graphen getrennt.
   ------------------------------------------------------------------ */

import { zufallsquelle } from '../sim/mathe.js';

const MAX_STIMMEN = 18;          // insgesamt
const MAX_UMGEBUNG = 10;         // davon fuer Geraeusche anderer Figuren
const MAX_GLEICHE = 3;           // gleiches Umgebungsgeraeusch gleichzeitig

/* ---------------------------------------------------------- Synthese */

function rauschen(r) {
  return r() * 2 - 1;
}

/* Rezept -> Float32Array. Jede Schicht: { art: 'rauschen'|'sinus',
   laut, zerfall (s), tp (Tiefpass-Faktor 0..1), hp, von, bis (Hz),
   start (s) } */
function synth(rate, dauer, schichten, seed) {
  const n = Math.max(1, Math.floor(rate * dauer));
  const out = new Float32Array(n);
  const r = zufallsquelle(seed || 1);
  for (const s of schichten) {
    const start = Math.floor((s.start || 0) * rate);
    let lp = 0, hpVor = 0, hpAus = 0, phase = 0;
    const tp = s.tp === undefined ? 1 : s.tp;
    const hp = s.hp || 0;
    for (let i = start; i < n; i++) {
      const t = (i - start) / rate;
      const huelle = s.anstieg && t < s.anstieg ? t / s.anstieg : Math.exp(-(t - (s.anstieg || 0)) / s.zerfall);
      if (huelle < 0.0005 && t > 0.05) break;
      let v;
      if (s.art === 'sinus') {
        const f = s.bis === undefined ? s.von : s.bis + (s.von - s.bis) * Math.exp(-t / (s.gleit || 0.05));
        phase += (2 * Math.PI * f) / rate;
        v = Math.sin(phase);
        if (s.oberton) v += Math.sin(phase * 2.01) * s.oberton;
      } else {
        v = rauschen(r);
      }
      lp += (v - lp) * tp;
      v = lp;
      if (hp > 0) {
        hpAus = hp * (hpAus + v - hpVor);
        hpVor = v;
        v = hpAus;
      }
      out[i] += v * s.laut * huelle;
    }
  }
  // Normalisieren auf etwas unter 1
  let max = 0;
  for (let i = 0; i < n; i++) max = Math.max(max, Math.abs(out[i]));
  if (max > 0) {
    const f = 0.95 / max;
    for (let i = 0; i < n; i++) out[i] *= f;
  }
  return out;
}

const REZEPTE = {
  sturmgewehr: [0.42, [
    { art: 'rauschen', laut: 1.0, zerfall: 0.011, hp: 0.8 },
    { art: 'rauschen', laut: 0.8, zerfall: 0.05, tp: 0.25 },
    { art: 'sinus', laut: 0.9, zerfall: 0.05, von: 150, bis: 52, gleit: 0.03 },
    { art: 'rauschen', laut: 0.22, zerfall: 0.16, tp: 0.08, start: 0.02 },
  ], 11],
  mp: [0.3, [
    { art: 'rauschen', laut: 1.0, zerfall: 0.008, hp: 0.85 },
    { art: 'rauschen', laut: 0.7, zerfall: 0.035, tp: 0.35 },
    { art: 'sinus', laut: 0.6, zerfall: 0.03, von: 190, bis: 80, gleit: 0.02 },
    { art: 'rauschen', laut: 0.16, zerfall: 0.1, tp: 0.1, start: 0.015 },
  ], 12],
  schrotflinte: [0.7, [
    { art: 'rauschen', laut: 1.0, zerfall: 0.016, hp: 0.7 },
    { art: 'rauschen', laut: 1.0, zerfall: 0.09, tp: 0.16 },
    { art: 'sinus', laut: 1.0, zerfall: 0.09, von: 110, bis: 38, gleit: 0.05 },
    { art: 'rauschen', laut: 0.3, zerfall: 0.28, tp: 0.05, start: 0.03 },
  ], 13],
  mg: [0.46, [
    { art: 'rauschen', laut: 1.0, zerfall: 0.012, hp: 0.75 },
    { art: 'rauschen', laut: 0.9, zerfall: 0.06, tp: 0.2 },
    { art: 'sinus', laut: 1.0, zerfall: 0.06, von: 120, bis: 45, gleit: 0.035 },
    { art: 'rauschen', laut: 0.25, zerfall: 0.18, tp: 0.07, start: 0.02 },
  ], 14],
  praezision: [0.55, [
    { art: 'rauschen', laut: 1.0, zerfall: 0.01, hp: 0.85 },
    { art: 'rauschen', laut: 0.85, zerfall: 0.06, tp: 0.22 },
    { art: 'sinus', laut: 0.9, zerfall: 0.07, von: 135, bis: 48, gleit: 0.04 },
    { art: 'rauschen', laut: 0.3, zerfall: 0.25, tp: 0.06, start: 0.025 },
  ], 15],
  scharfschuetze: [0.95, [
    { art: 'rauschen', laut: 1.0, zerfall: 0.014, hp: 0.8 },
    { art: 'rauschen', laut: 1.0, zerfall: 0.1, tp: 0.15 },
    { art: 'sinus', laut: 1.0, zerfall: 0.12, von: 95, bis: 34, gleit: 0.06 },
    { art: 'rauschen', laut: 0.35, zerfall: 0.4, tp: 0.04, start: 0.04 },
  ], 16],
  pistole: [0.24, [
    { art: 'rauschen', laut: 1.0, zerfall: 0.006, hp: 0.9 },
    { art: 'rauschen', laut: 0.55, zerfall: 0.025, tp: 0.4 },
    { art: 'sinus', laut: 0.5, zerfall: 0.025, von: 230, bis: 100, gleit: 0.015 },
    { art: 'rauschen', laut: 0.12, zerfall: 0.08, tp: 0.12, start: 0.012 },
  ], 17],
  magRaus: [0.16, [
    { art: 'rauschen', laut: 0.6, zerfall: 0.012, hp: 0.6 },
    { art: 'sinus', laut: 0.35, zerfall: 0.03, von: 1900 },
    { art: 'rauschen', laut: 0.3, zerfall: 0.05, tp: 0.3, start: 0.03 },
  ], 21],
  magRein: [0.18, [
    { art: 'rauschen', laut: 0.8, zerfall: 0.02, tp: 0.35 },
    { art: 'rauschen', laut: 0.7, zerfall: 0.008, hp: 0.7, start: 0.035 },
    { art: 'sinus', laut: 0.3, zerfall: 0.03, von: 1400, start: 0.035 },
  ], 22],
  verschluss: [0.22, [
    { art: 'rauschen', laut: 0.7, zerfall: 0.01, hp: 0.7 },
    { art: 'sinus', laut: 0.25, zerfall: 0.025, von: 2300 },
    { art: 'rauschen', laut: 0.9, zerfall: 0.012, hp: 0.6, start: 0.085 },
    { art: 'sinus', laut: 0.3, zerfall: 0.03, von: 1700, start: 0.085 },
  ], 23],
  patrone: [0.14, [
    { art: 'rauschen', laut: 0.6, zerfall: 0.015, tp: 0.4 },
    { art: 'sinus', laut: 0.3, zerfall: 0.02, von: 900 },
  ], 24],
  pumpe: [0.36, [
    { art: 'rauschen', laut: 0.5, zerfall: 0.05, tp: 0.5, hp: 0.3 },
    { art: 'rauschen', laut: 0.9, zerfall: 0.012, hp: 0.6, start: 0.1 },
    { art: 'rauschen', laut: 0.5, zerfall: 0.04, tp: 0.5, hp: 0.3, start: 0.17 },
    { art: 'rauschen', laut: 0.9, zerfall: 0.012, hp: 0.6, start: 0.26 },
  ], 25],
  leer: [0.08, [
    { art: 'rauschen', laut: 0.8, zerfall: 0.006, hp: 0.8 },
    { art: 'sinus', laut: 0.4, zerfall: 0.012, von: 2600 },
  ], 26],
  // Rueckmeldungen: kurz, hell und trocken - man hoert sie auch im Gefecht.
  treffer: [0.07, [
    { art: 'rauschen', laut: 0.9, zerfall: 0.0035, hp: 0.95 },
    { art: 'sinus', laut: 0.75, zerfall: 0.016, von: 2900, bis: 2350, gleit: 0.02 },
    { art: 'sinus', laut: 0.3, zerfall: 0.009, von: 4300 },
  ], 31],
  kopftreffer: [0.26, [
    { art: 'rauschen', laut: 0.9, zerfall: 0.003, hp: 0.95 },
    { art: 'sinus', laut: 0.8, zerfall: 0.07, von: 3150 },
    { art: 'sinus', laut: 0.45, zerfall: 0.05, von: 4870 },
    { art: 'sinus', laut: 0.25, zerfall: 0.03, von: 6230 },
  ], 32],
  abschuss: [0.5, [
    { art: 'sinus', laut: 1.0, zerfall: 0.055, von: 140, bis: 52, gleit: 0.03 },
    { art: 'rauschen', laut: 0.55, zerfall: 0.012, tp: 0.3 },
    { art: 'rauschen', laut: 0.5, zerfall: 0.004, hp: 0.9 },
    { art: 'sinus', laut: 0.55, zerfall: 0.13, von: 1245, oberton: 0.15, start: 0.03 },
    { art: 'sinus', laut: 0.5, zerfall: 0.17, von: 1865, start: 0.065 },
  ], 33],
  kopfabschuss: [0.55, [
    { art: 'sinus', laut: 1.0, zerfall: 0.055, von: 140, bis: 52, gleit: 0.03 },
    { art: 'rauschen', laut: 0.6, zerfall: 0.004, hp: 0.95 },
    { art: 'sinus', laut: 0.6, zerfall: 0.08, von: 3150 },
    { art: 'sinus', laut: 0.3, zerfall: 0.05, von: 4870 },
    { art: 'sinus', laut: 0.55, zerfall: 0.14, von: 1245, oberton: 0.15, start: 0.04 },
    { art: 'sinus', laut: 0.55, zerfall: 0.19, von: 1865, start: 0.08 },
  ], 34],
  schritt: [0.09, [
    { art: 'rauschen', laut: 0.9, zerfall: 0.02, tp: 0.12 },
    { art: 'rauschen', laut: 0.3, zerfall: 0.01, tp: 0.5, hp: 0.4 },
  ], 41],
  sprung: [0.12, [
    { art: 'rauschen', laut: 0.6, zerfall: 0.04, tp: 0.35, hp: 0.3, anstieg: 0.02 },
  ], 42],
  landung: [0.2, [
    { art: 'rauschen', laut: 0.9, zerfall: 0.04, tp: 0.1 },
    { art: 'sinus', laut: 0.6, zerfall: 0.05, von: 90, bis: 50 },
  ], 43],
  rutschen: [0.55, [
    { art: 'rauschen', laut: 0.7, zerfall: 0.25, tp: 0.3, hp: 0.2, anstieg: 0.04 },
  ], 44],
  schaden: [0.24, [
    { art: 'sinus', laut: 0.9, zerfall: 0.07, von: 95, bis: 45 },
    { art: 'rauschen', laut: 0.6, zerfall: 0.04, tp: 0.12 },
  ], 51],
  piep: [0.14, [
    { art: 'sinus', laut: 0.7, zerfall: 0.07, von: 660, anstieg: 0.005 },
  ], 61],
  start: [1.1, [
    { art: 'sinus', laut: 0.5, zerfall: 0.45, von: 440, oberton: 0.35, anstieg: 0.03 },
    { art: 'sinus', laut: 0.4, zerfall: 0.45, von: 554, oberton: 0.3, anstieg: 0.03 },
    { art: 'sinus', laut: 0.35, zerfall: 0.45, von: 659, oberton: 0.25, anstieg: 0.03 },
  ], 62],
  ende: [1.3, [
    { art: 'sinus', laut: 0.5, zerfall: 0.5, von: 392, oberton: 0.3, anstieg: 0.03 },
    { art: 'sinus', laut: 0.4, zerfall: 0.5, von: 294, oberton: 0.3, anstieg: 0.03, start: 0.25 },
  ], 63],
  spawn: [0.35, [
    { art: 'sinus', laut: 0.3, zerfall: 0.12, von: 300, bis: 700, gleit: 0.1, anstieg: 0.05 },
    { art: 'rauschen', laut: 0.2, zerfall: 0.1, tp: 0.2, anstieg: 0.05 },
  ], 64],
  klick: [0.05, [
    { art: 'sinus', laut: 0.5, zerfall: 0.01, von: 1800 },
  ], 65],
};

export class Klang {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.puffer = {};
    this.lautstaerke = 0.8;
    this.stimmen = 0;
    this.liste = [];             // laufende Stimmen, aelteste zuerst
    this.bereit = false;
  }

  /* Muss aus einem Nutzerereignis heraus gerufen werden. */
  entsperren() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        const komp = this.ctx.createDynamicsCompressor();
        komp.threshold.value = -14;
        komp.ratio.value = 4;
        this.master = this.ctx.createGain();
        this.master.gain.value = this.lautstaerke;
        this.master.connect(komp);
        komp.connect(this.ctx.destination);
        const rate = this.ctx.sampleRate;
        for (const name of Object.keys(REZEPTE)) {
          const [dauer, schichten, seed] = REZEPTE[name];
          const daten = synth(rate, dauer, schichten, seed);
          const b = this.ctx.createBuffer(1, daten.length, rate);
          b.getChannelData(0).set(daten);
          this.puffer[name] = b;
        }
        this.bereit = true;
      }
      // iOS meldet nach Anruf oder Hintergrund auch "interrupted".
      if (this.ctx.state !== 'running' && this.ctx.state !== 'closed') this.ctx.resume().catch(() => {});
    } catch (e) {
      this.bereit = false;
    }
  }

  lautstaerkeSetzen(v) {
    this.lautstaerke = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.setTargetAtTime(this.lautstaerke, this.ctx.currentTime, 0.02);
  }

  /* Direkt abspielen (eigene Geraeusche, Oberflaeche) - mit Vorrang. */
  spielen(name, laut, rate, pan, tiefpass, verzoegerung) {
    this.stimme(name, laut, rate, pan, tiefpass, verzoegerung, true);
  }

  stimme(name, laut, rate, pan, tiefpass, verzoegerung, wichtig) {
    if (!this.bereit || this.lautstaerke <= 0 || this.ctx.state !== 'running') return;
    const b = this.puffer[name];
    if (!b) return;
    const L = this.liste;
    if (!wichtig) {
      let umgebung = 0, gleiche = 0;
      for (const s of L) {
        if (s.wichtig) continue;
        umgebung++;
        if (s.name === name) gleiche++;
      }
      if (umgebung >= MAX_UMGEBUNG || gleiche >= MAX_GLEICHE || L.length >= MAX_STIMMEN) return;
    } else if (L.length >= MAX_STIMMEN) {
      // Platz schaffen: die aelteste Umgebungsstimme, sonst die aelteste ueberhaupt
      const alt = L.find((s) => !s.wichtig) || L[0];
      this.stoppen(alt);
    }
    const ctx = this.ctx;
    const quelle = ctx.createBufferSource();
    quelle.buffer = b;
    quelle.playbackRate.value = rate || 1;
    const knoten = [quelle];
    let letzter = quelle;
    if (tiefpass && tiefpass < 12000) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = tiefpass;
      letzter.connect(f);
      letzter = f;
      knoten.push(f);
    }
    const g = ctx.createGain();
    g.gain.value = laut === undefined ? 1 : laut;
    letzter.connect(g);
    letzter = g;
    knoten.push(g);
    if (pan && Math.abs(pan) > 0.05 && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      letzter.connect(p);
      letzter = p;
      knoten.push(p);
    }
    letzter.connect(this.master);
    const s = { name, wichtig, quelle, knoten, aus: false };
    quelle.onended = () => this.ende(s);
    L.push(s);
    this.stimmen = L.length;
    quelle.start(ctx.currentTime + (verzoegerung || 0));
  }

  /* Stimme beenden und vom Graphen trennen - sonst haelt Safari die
     Knoten laenger fest als noetig. */
  ende(s) {
    if (s.aus) return;
    s.aus = true;
    s.quelle.onended = null;
    for (const k of s.knoten) {
      try { k.disconnect(); } catch (e) { /* schon getrennt */ }
    }
    const i = this.liste.indexOf(s);
    if (i >= 0) this.liste.splice(i, 1);
    this.stimmen = this.liste.length;
  }

  stoppen(s) {
    try { s.quelle.stop(); } catch (e) { /* lief noch nicht oder schon aus */ }
    this.ende(s);
  }

  /* Raeumlich: dx/dz relativ zum Hoerer, yaw = Blickrichtung des Hoerers. */
  raeumlich(name, dx, dz, yaw, laut, rate) {
    const d = Math.hypot(dx, dz);
    const abnahme = 1 / (1 + Math.pow(d / 10, 1.35));
    if (abnahme * (laut || 1) < 0.04) return;
    // Rechts vom Hoerer ist (cos yaw, -sin yaw)
    const rechts = d > 0.01 ? (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / d : 0;
    const tp = 18000 / (1 + d / 9);
    this.stimme(name, (laut || 1) * abnahme, rate, rechts * 0.75, tp, 0, false);
  }

  pausieren() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
  }

  fortsetzen() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  zerstoeren() {
    for (const s of this.liste.slice()) this.stoppen(s);
    if (this.ctx) {
      try { this.ctx.close(); } catch (e) { /* schon zu */ }
    }
    this.ctx = null;
    this.bereit = false;
    this.puffer = {};
  }
}
