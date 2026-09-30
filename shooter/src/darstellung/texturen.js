/* ------------------------------------------------------------------
   Texturen, im Browser gemalt.

   Alle Oberflaechen entstehen beim Start auf kleinen Canvas-Flaechen
   (256 x 256): Beton, Container, Sperrholz, Sandsaecke, Hesco-Koerbe,
   Boeden, Schilder. Es gibt keine Bilddateien - nichts zu laden, keine
   Lizenzfragen, und alles passt farblich zusammen.

   Der Zufall ist fest geseedet: jede Sitzung sieht gleich aus.
   ------------------------------------------------------------------ */

import { CanvasTexture, RepeatWrapping, SRGBColorSpace, ClampToEdgeWrapping } from 'three';
import { zufallsquelle } from '../sim/mathe.js';

function leinwand(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h || w;
  return c;
}

function alsTextur(c, wiederholen) {
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  if (wiederholen !== false) {
    t.wrapS = RepeatWrapping;
    t.wrapT = RepeatWrapping;
  } else {
    t.wrapS = ClampToEdgeWrapping;
    t.wrapT = ClampToEdgeWrapping;
  }
  return t;
}

/* Feines Rauschen: viele kleine, halbdurchsichtige Punkte. */
function rauschen(g, w, h, r, anzahl, hell, dunkel, groesse) {
  for (let i = 0; i < anzahl; i++) {
    const x = r() * w, y = r() * h;
    const s = (groesse || 2) * (0.5 + r());
    g.fillStyle = r() < 0.5 ? hell : dunkel;
    g.globalAlpha = 0.05 + r() * 0.12;
    g.fillRect(x, y, s, s);
  }
  g.globalAlpha = 1;
}

/* Grosse, weiche Flecken (Verwitterung, Schmutz). */
function flecken(g, w, h, r, anzahl, farbe, alpha, radius) {
  for (let i = 0; i < anzahl; i++) {
    const x = r() * w, y = r() * h, rad = radius * (0.4 + r());
    const grad = g.createRadialGradient(x, y, 0, x, y, rad);
    grad.addColorStop(0, farbe);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = alpha * (0.4 + r() * 0.6);
    g.fillStyle = grad;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    // Kachelbar: am Rand noch einmal auf der Gegenseite
    if (x < rad) g.fillRect(x - rad + w, y - rad, rad * 2, rad * 2);
    if (y < rad) g.fillRect(x - rad, y - rad + h, rad * 2, rad * 2);
  }
  g.globalAlpha = 1;
}

function beton(r) {
  const c = leinwand(256);
  const g = c.getContext('2d');
  g.fillStyle = '#a3a49f';
  g.fillRect(0, 0, 256, 256);
  flecken(g, 256, 256, r, 14, 'rgba(70,72,68,1)', 0.12, 50);
  flecken(g, 256, 256, r, 8, 'rgba(210,210,200,1)', 0.12, 40);
  rauschen(g, 256, 256, r, 2600, '#d6d6cf', '#56584f', 2);
  // Schalungsfugen und Ankerloecher
  g.fillStyle = 'rgba(50,52,48,0.35)';
  g.fillRect(0, 127, 256, 2);
  g.fillRect(127, 0, 2, 256);
  g.fillStyle = 'rgba(40,40,38,0.55)';
  for (const [x, y] of [[32, 32], [96, 32], [160, 32], [224, 32], [32, 160], [96, 160], [160, 160], [224, 160]]) {
    g.beginPath();
    g.arc(x, y, 3, 0, Math.PI * 2);
    g.fill();
  }
  return alsTextur(c);
}

function mauer(r) {
  const c = leinwand(256);
  const g = c.getContext('2d');
  g.fillStyle = '#9a9b94';
  g.fillRect(0, 0, 256, 256);
  flecken(g, 256, 256, r, 10, 'rgba(60,62,58,1)', 0.14, 60);
  rauschen(g, 256, 256, r, 2200, '#cfcfc6', '#55574f', 2);
  // Grosse Betonsteine, versetzt
  g.fillStyle = 'rgba(45,46,42,0.5)';
  for (let row = 0; row < 4; row++) {
    const y = row * 64;
    g.fillRect(0, y, 256, 3);
    const off = row % 2 ? 64 : 0;
    for (let x = off; x < 256 + 128; x += 128) g.fillRect(x % 256, y, 3, 64);
  }
  // Laufspuren von oben
  for (let i = 0; i < 12; i++) {
    const x = r() * 256;
    const grad = g.createLinearGradient(0, 0, 0, 120 + r() * 100);
    grad.addColorStop(0, 'rgba(40,38,30,0.25)');
    grad.addColorStop(1, 'rgba(40,38,30,0)');
    g.fillStyle = grad;
    g.fillRect(x, 0, 2 + r() * 5, 220);
  }
  return alsTextur(c);
}

/* Wellblech, hell und neutral - die Farbe kommt pro Container dazu. */
function container(r) {
  const c = leinwand(256);
  const g = c.getContext('2d');
  g.fillStyle = '#d4d4d0';
  g.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 16) {
    const grad = g.createLinearGradient(x, 0, x + 16, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0.22)');
    grad.addColorStop(0.35, 'rgba(0,0,0,0)');
    grad.addColorStop(0.65, 'rgba(0,0,0,0.22)');
    grad.addColorStop(1, 'rgba(255,255,255,0.1)');
    g.fillStyle = grad;
    g.fillRect(x, 0, 16, 256);
  }
  // Rahmen oben und unten
  g.fillStyle = 'rgba(40,40,40,0.55)';
  g.fillRect(0, 0, 256, 10);
  g.fillRect(0, 246, 256, 10);
  g.fillStyle = 'rgba(255,255,255,0.25)';
  g.fillRect(0, 10, 256, 2);
  // Rost und Schmutz
  flecken(g, 256, 256, r, 9, 'rgba(90,50,25,1)', 0.22, 26);
  for (let i = 0; i < 16; i++) {
    const x = r() * 256;
    g.fillStyle = 'rgba(70,40,20,' + (0.08 + r() * 0.12).toFixed(2) + ')';
    g.fillRect(x, 10, 1 + r() * 3, 40 + r() * 160);
  }
  rauschen(g, 256, 256, r, 1200, '#ffffff', '#303030', 1.5);
  return alsTextur(c);
}

/* Sperrholzkiste: eine Seite pro Textur (lokal gemappt). */
function holz(r) {
  const c = leinwand(256);
  const g = c.getContext('2d');
  g.fillStyle = '#b48c58';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 70; i++) {
    const y = r() * 256;
    g.strokeStyle = 'rgba(110,75,40,' + (0.12 + r() * 0.2).toFixed(2) + ')';
    g.lineWidth = 1 + r() * 1.5;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= 256; x += 32) g.lineTo(x, y + Math.sin(x * 0.03 + i) * 3);
    g.stroke();
  }
  // Rahmenleisten und Diagonale
  g.fillStyle = '#8f6a3c';
  g.fillRect(0, 0, 256, 26);
  g.fillRect(0, 230, 256, 26);
  g.fillRect(0, 0, 26, 256);
  g.fillRect(230, 0, 26, 256);
  g.save();
  g.translate(128, 128);
  g.rotate(-Math.PI / 4);
  g.fillRect(-170, -12, 340, 24);
  g.restore();
  g.strokeStyle = 'rgba(50,32,15,0.6)';
  g.lineWidth = 2;
  g.strokeRect(1, 1, 254, 254);
  g.strokeRect(26, 26, 204, 204);
  // Naegel
  g.fillStyle = 'rgba(40,40,40,0.8)';
  for (const [x, y] of [[13, 13], [243, 13], [13, 243], [243, 243], [128, 13], [128, 243], [13, 128], [243, 128]]) {
    g.fillRect(x - 2, y - 2, 4, 4);
  }
  // Schablonenschrift
  g.fillStyle = 'rgba(40,40,30,0.55)';
  g.font = 'bold 22px sans-serif';
  g.textAlign = 'center';
  g.fillText('ÜBUNG', 128, 200);
  rauschen(g, 256, 256, r, 800, '#e0c090', '#5a3a1a', 1.5);
  return alsTextur(c);
}

function sandsack(r) {
  const c = leinwand(256);
  const g = c.getContext('2d');
  g.fillStyle = '#6e6445';
  g.fillRect(0, 0, 256, 256);
  const reihen = 4, h = 256 / reihen;
  for (let row = 0; row < reihen; row++) {
    const off = row % 2 ? 42 : 0;
    for (let x = -84 + off; x < 256 + 84; x += 84) {
      const y = row * h;
      const grad = g.createLinearGradient(0, y, 0, y + h);
      grad.addColorStop(0, '#b3a47a');
      grad.addColorStop(0.5, '#a2936a');
      grad.addColorStop(1, '#7d7050');
      g.fillStyle = grad;
      g.beginPath();
      const bx = x + 3, by = y + 3, bw = 78, bh = h - 6, rad = 16;
      g.moveTo(bx + rad, by);
      g.arcTo(bx + bw, by, bx + bw, by + bh, rad);
      g.arcTo(bx + bw, by + bh, bx, by + bh, rad);
      g.arcTo(bx, by + bh, bx, by, rad);
      g.arcTo(bx, by, bx + bw, by, rad);
      g.fill();
      g.strokeStyle = 'rgba(70,60,40,0.4)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(bx + 10, by + bh * 0.5);
      g.lineTo(bx + bw - 10, by + bh * 0.5 + (r() - 0.5) * 4);
      g.stroke();
    }
  }
  rauschen(g, 256, 256, r, 1500, '#e0d4a8', '#4a4230', 1.5);
  return alsTextur(c);
}

function hesco(r) {
  const c = leinwand(256);
  const g = c.getContext('2d');
  g.fillStyle = '#b3a07a';
  g.fillRect(0, 0, 256, 256);
  flecken(g, 256, 256, r, 10, 'rgba(120,100,70,1)', 0.25, 40);
  rauschen(g, 256, 256, r, 2500, '#d8c8a0', '#6d5f45', 2);
  // Drahtgitter
  g.strokeStyle = 'rgba(60,62,60,0.75)';
  g.lineWidth = 2;
  for (let i = 0; i <= 256; i += 32) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke();
  }
  // Pfosten an den Kanten
  g.fillStyle = 'rgba(70,72,70,0.9)';
  g.fillRect(0, 0, 6, 256);
  g.fillRect(250, 0, 6, 256);
  return alsTextur(c);
}

function metall(r) {
  const c = leinwand(128);
  const g = c.getContext('2d');
  g.fillStyle = '#7d8286';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 90; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';
    g.fillRect(0, r() * 128, 128, 1);
  }
  flecken(g, 128, 128, r, 5, 'rgba(60,40,25,1)', 0.18, 18);
  rauschen(g, 128, 128, r, 400, '#ffffff', '#202020', 1);
  return alsTextur(c);
}

function plane(r) {
  const c = leinwand(256);
  const g = c.getContext('2d');
  g.fillStyle = '#6a7350';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 256; i += 3) {
    g.fillStyle = 'rgba(0,0,0,0.05)';
    g.fillRect(0, i, 256, 1);
    g.fillRect(i, 0, 1, 256);
  }
  // Falten
  for (let i = 0; i < 7; i++) {
    const x = r() * 256;
    const grad = g.createLinearGradient(x - 14, 0, x + 14, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.5, 'rgba(0,0,0,0.18)');
    grad.addColorStop(1, 'rgba(255,255,255,0.05)');
    g.fillStyle = grad;
    g.fillRect(x - 14, 0, 28, 256);
  }
  g.strokeStyle = 'rgba(40,44,30,0.5)';
  g.setLineDash([4, 4]);
  g.lineWidth = 1.5;
  g.strokeRect(6, 6, 244, 244);
  g.setLineDash([]);
  flecken(g, 256, 256, r, 6, 'rgba(60,55,35,1)', 0.18, 40);
  return alsTextur(c);
}

/* Betonsperre: Beton mit gelb-schwarzem Warnband (lokal gemappt). */
function barriere(r) {
  const c = leinwand(256);
  const g = c.getContext('2d');
  g.fillStyle = '#b5b5ad';
  g.fillRect(0, 0, 256, 256);
  rauschen(g, 256, 256, r, 1800, '#e0e0d8', '#5a5a52', 2);
  flecken(g, 256, 256, r, 6, 'rgba(70,70,60,1)', 0.18, 40);
  g.save();
  g.beginPath();
  g.rect(0, 30, 256, 44);
  g.clip();
  g.fillStyle = '#e0b42c';
  g.fillRect(0, 30, 256, 44);
  g.fillStyle = '#202020';
  for (let x = -60; x < 300; x += 44) {
    g.beginPath();
    g.moveTo(x, 74); g.lineTo(x + 22, 74); g.lineTo(x + 66, 30); g.lineTo(x + 44, 30);
    g.fill();
  }
  g.restore();
  return alsTextur(c);
}

/* Hallenwand: Trapezblech mit Paneelfugen. */
function halle(r) {
  const c = leinwand(256);
  const g = c.getContext('2d');
  g.fillStyle = '#8e998c';
  g.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 32) {
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fillRect(x, 0, 6, 256);
    g.fillStyle = 'rgba(0,0,0,0.14)';
    g.fillRect(x + 14, 0, 10, 256);
  }
  g.fillStyle = 'rgba(30,35,30,0.45)';
  g.fillRect(0, 0, 256, 3);
  g.fillRect(0, 127, 256, 2);
  flecken(g, 256, 256, r, 10, 'rgba(60,65,55,1)', 0.18, 50);
  for (let i = 0; i < 10; i++) {
    const x = r() * 256;
    g.fillStyle = 'rgba(70,60,40,' + (0.06 + r() * 0.1).toFixed(2) + ')';
    g.fillRect(x, 0, 2 + r() * 3, 60 + r() * 190);
  }
  rauschen(g, 256, 256, r, 900, '#ffffff', '#303530', 1.5);
  return alsTextur(c);
}

/* Regal mit Kisten und Kanistern (lokal gemappt). */
function regal(r) {
  const c = leinwand(256);
  const g = c.getContext('2d');
  g.fillStyle = '#2b2f33';
  g.fillRect(0, 0, 256, 256);
  const boeden = [0, 84, 168, 252];
  const farben = ['#8c6a42', '#9c7a4c', '#3f5f8a', '#6e7a3a', '#a33a2c', '#7b7f84', '#b09a64'];
  for (let f = 0; f < 3; f++) {
    const y0 = boeden[f] + 6, y1 = boeden[f + 1] - 2;
    let x = 10;
    while (x < 240) {
      const bw = 24 + r() * 44;
      const bh = (y1 - y0) * (0.45 + r() * 0.5);
      g.fillStyle = farben[Math.floor(r() * farben.length)];
      g.fillRect(x, y1 - bh, Math.min(bw, 246 - x), bh);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(x, y1 - bh, Math.min(bw, 246 - x), 3);
      x += bw + 3 + r() * 8;
    }
  }
  g.fillStyle = '#d1802e';
  for (const y of boeden) g.fillRect(0, Math.max(0, y - 5), 256, 7);
  g.fillStyle = '#2d5d9c';
  g.fillRect(0, 0, 10, 256);
  g.fillRect(246, 0, 10, 256);
  rauschen(g, 256, 256, r, 500, '#ffffff', '#000000', 1.5);
  return alsTextur(c);
}

function kies(r) {
  const c = leinwand(256);
  const g = c.getContext('2d');
  g.fillStyle = '#857a64';
  g.fillRect(0, 0, 256, 256);
  flecken(g, 256, 256, r, 18, 'rgba(90,80,60,1)', 0.3, 40);
  flecken(g, 256, 256, r, 10, 'rgba(170,160,135,1)', 0.25, 30);
  for (let i = 0; i < 5200; i++) {
    const x = r() * 256, y = r() * 256, s = 1 + r() * 2.6;
    const t = r();
    g.fillStyle = t < 0.4 ? 'rgba(60,54,44,0.55)' : t < 0.8 ? 'rgba(190,180,158,0.5)' : 'rgba(140,128,105,0.6)';
    g.fillRect(x, y, s, s * (0.6 + r() * 0.6));
  }
  return alsTextur(c);
}

function asphalt(r) {
  const c = leinwand(256);
  const g = c.getContext('2d');
  g.fillStyle = '#4a4d50';
  g.fillRect(0, 0, 256, 256);
  flecken(g, 256, 256, r, 14, 'rgba(30,32,34,1)', 0.35, 44);
  flecken(g, 256, 256, r, 8, 'rgba(110,112,112,1)', 0.18, 30);
  rauschen(g, 256, 256, r, 5000, '#8a8c8c', '#202224', 1.6);
  g.strokeStyle = 'rgba(25,25,25,0.55)';
  g.lineWidth = 1.2;
  for (let i = 0; i < 5; i++) {
    let x = r() * 256, y = r() * 256;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 8; k++) {
      x += (r() - 0.5) * 30;
      y += (r() - 0.5) * 30;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  return alsTextur(c);
}

function platten(r) {
  const c = leinwand(256);
  const g = c.getContext('2d');
  g.fillStyle = '#a4a49b';
  g.fillRect(0, 0, 256, 256);
  // leicht unterschiedlich getoente Platten
  for (let py = 0; py < 2; py++) {
    for (let px = 0; px < 2; px++) {
      g.fillStyle = 'rgba(' + (r() < 0.5 ? '0,0,0' : '255,255,255') + ',' + (0.03 + r() * 0.05).toFixed(2) + ')';
      g.fillRect(px * 128, py * 128, 128, 128);
    }
  }
  flecken(g, 256, 256, r, 12, 'rgba(70,70,62,1)', 0.16, 36);
  rauschen(g, 256, 256, r, 3200, '#d8d8d0', '#5a5a52', 1.8);
  g.fillStyle = 'rgba(55,55,50,0.7)';
  g.fillRect(0, 0, 256, 2);
  g.fillRect(0, 128, 256, 2);
  g.fillRect(0, 0, 2, 256);
  g.fillRect(128, 0, 2, 256);
  return alsTextur(c);
}

function estrich(r) {
  const c = leinwand(256);
  const g = c.getContext('2d');
  g.fillStyle = '#8e908b';
  g.fillRect(0, 0, 256, 256);
  flecken(g, 256, 256, r, 16, 'rgba(60,60,55,1)', 0.14, 50);
  flecken(g, 256, 256, r, 8, 'rgba(40,36,30,1)', 0.12, 20);
  rauschen(g, 256, 256, r, 2000, '#c8c8c0', '#4a4a44', 1.5);
  g.fillStyle = 'rgba(50,50,45,0.4)';
  g.fillRect(0, 0, 256, 2);
  g.fillRect(0, 0, 2, 256);
  return alsTextur(c);
}

function dach(r) {
  const c = leinwand(128);
  const g = c.getContext('2d');
  g.fillStyle = '#5d6266';
  g.fillRect(0, 0, 128, 128);
  for (let x = 0; x < 128; x += 16) {
    g.fillStyle = 'rgba(255,255,255,0.08)';
    g.fillRect(x, 0, 4, 128);
    g.fillStyle = 'rgba(0,0,0,0.15)';
    g.fillRect(x + 8, 0, 5, 128);
  }
  flecken(g, 128, 128, r, 5, 'rgba(90,60,30,1)', 0.2, 20);
  return alsTextur(c);
}

/* ------------------------------------------------------------ Einzelstuecke */

/* Farbklecks (Markierungsmunition): weiss, eingefaerbt ueber das Material. */
export function klecksTextur(seed) {
  const r = zufallsquelle(seed || 7);
  const c = leinwand(64);
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.beginPath();
  g.arc(32, 32, 11, 0, Math.PI * 2);
  g.fill();
  for (let i = 0; i < 9; i++) {
    const w = r() * Math.PI * 2, d = 10 + r() * 14, s = 2 + r() * 5;
    g.beginPath();
    g.arc(32 + Math.cos(w) * d, 32 + Math.sin(w) * d, s, 0, Math.PI * 2);
    g.fill();
  }
  return alsTextur(c, false);
}

export function weichTextur() {
  const c = leinwand(64);
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return alsTextur(c, false);
}

export function schattenTextur() {
  const c = leinwand(64);
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)');
  grad.addColorStop(0.6, 'rgba(0,0,0,0.3)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return alsTextur(c, false);
}

/* Muendungsfeuer: heller Stern mit weichem Kern. */
export function feuerTextur() {
  const c = leinwand(128);
  const g = c.getContext('2d');
  g.translate(64, 64);
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, 60);
  grad.addColorStop(0, 'rgba(255,250,220,1)');
  grad.addColorStop(0.25, 'rgba(255,200,90,0.9)');
  grad.addColorStop(0.6, 'rgba(255,120,30,0.35)');
  grad.addColorStop(1, 'rgba(255,90,20,0)');
  g.fillStyle = grad;
  for (let i = 0; i < 6; i++) {
    g.rotate(Math.PI / 3);
    g.beginPath();
    g.moveTo(0, -8);
    g.lineTo(58, 0);
    g.lineTo(0, 8);
    g.fill();
  }
  g.beginPath();
  g.arc(0, 0, 26, 0, Math.PI * 2);
  g.fill();
  return alsTextur(c, false);
}

/* Schild mit Schrift. gross: ein einzelner, grosser Buchstabe (Wege). */
export function schildTextur(text, opt) {
  const o = opt || {};
  const breite = o.gross ? 128 : 512;
  const hoehe = o.gross ? 128 : Math.round(512 * (o.hoehe || 0.8) / (o.breite || 4));
  const c = leinwand(breite, Math.max(32, hoehe));
  const g = c.getContext('2d');
  const h = c.height;
  if (o.gross) {
    g.fillStyle = '#e8b93a';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#1a1c1e';
    g.fillRect(6, 6, 116, 116);
    g.fillStyle = '#e8b93a';
    g.font = 'bold 96px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 64, 70);
  } else {
    const grund = o.team === 0 ? '#1f4f9a' : o.team === 1 ? '#9a2a24' : '#26303a';
    g.fillStyle = grund;
    g.fillRect(0, 0, breite, h);
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.fillRect(0, 4, breite, 3);
    g.fillRect(0, h - 7, breite, 3);
    g.fillStyle = '#f2f2ea';
    g.font = 'bold ' + Math.round(h * 0.56) + 'px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, breite / 2, h / 2 + 2);
  }
  const t = alsTextur(c, false);
  return t;
}

/* Zielscheibe fuer den Schiessstand in der Halle. */
export function zielscheibeTextur() {
  const c = leinwand(128, 192);
  const g = c.getContext('2d');
  g.fillStyle = '#d8cfb4';
  g.fillRect(0, 0, 128, 192);
  // Umriss eines Oberkoerpers, klassisch fuer Uebungsscheiben
  g.fillStyle = '#39424b';
  g.beginPath();
  g.arc(64, 52, 24, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(18, 190); g.lineTo(26, 100); g.quadraticCurveTo(64, 78, 102, 100); g.lineTo(110, 190);
  g.fill();
  g.strokeStyle = '#e8e2cc';
  g.lineWidth = 2;
  for (const rr of [14, 28, 42]) {
    g.beginPath();
    g.arc(64, 132, rr, 0, Math.PI * 2);
    g.stroke();
  }
  return alsTextur(c, false);
}

/* Flagge in Teamfarbe mit Wappen (Gehstock). */
export function flaggenTextur(team) {
  const c = leinwand(128, 80);
  const g = c.getContext('2d');
  g.fillStyle = team === 0 ? '#2f63c4' : '#c43a2f';
  g.fillRect(0, 0, 128, 80);
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.fillRect(0, 34, 128, 12);
  g.fillStyle = team === 0 ? '#2f63c4' : '#c43a2f';
  g.beginPath();
  g.arc(64, 40, 18, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#f5d36a';
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(68, 58);
  g.lineTo(68, 30);
  g.arc(61, 30, 7, 0, Math.PI, true);
  g.stroke();
  return alsTextur(c, false);
}

/* Name ueber Verbuendeten. */
export function namensTextur(text, farbe) {
  const c = leinwand(256, 64);
  const g = c.getContext('2d');
  g.font = 'bold 34px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 6;
  g.strokeStyle = 'rgba(0,0,0,0.75)';
  g.strokeText(text, 128, 34);
  g.fillStyle = farbe;
  g.fillText(text, 128, 34);
  return alsTextur(c, false);
}

/* Alle Flaechentexturen einer Sitzung. */
/* ------------------------------------------- Weitere Karten (Hafen,
   Dorf, Wueste). Eigener Zufall: die alten Texturen bleiben gleich. */

function sand(r) {
  const c = leinwand(256);
  const g = c.getContext('2d');
  g.fillStyle = '#c7a676';
  g.fillRect(0, 0, 256, 256);
  flecken(g, 256, 256, r, 16, 'rgba(160,125,80,1)', 0.25, 50);
  flecken(g, 256, 256, r, 10, 'rgba(230,205,160,1)', 0.25, 40);
  // Windrippeln
  g.strokeStyle = 'rgba(120,92,58,0.18)';
  g.lineWidth = 2;
  for (let i = 0; i < 14; i++) {
    const y0 = (i / 14) * 256 + r() * 8;
    g.beginPath();
    for (let x = 0; x <= 256; x += 16) g.lineTo(x, y0 + Math.sin(x * 0.045 + i) * 4);
    g.stroke();
  }
  rauschen(g, 256, 256, r, 4200, '#ecd9b0', '#8a6c44', 1.3);
  return alsTextur(c);
}

function gras(r) {
  const c = leinwand(256);
  const g = c.getContext('2d');
  g.fillStyle = '#56733a';
  g.fillRect(0, 0, 256, 256);
  flecken(g, 256, 256, r, 18, 'rgba(70,95,40,1)', 0.35, 44);
  flecken(g, 256, 256, r, 12, 'rgba(130,140,70,1)', 0.25, 34);
  for (let i = 0; i < 5200; i++) {
    const x = r() * 256, y = r() * 256, l = 2 + r() * 4;
    const t = r();
    g.strokeStyle = t < 0.35 ? 'rgba(40,62,26,0.55)' : t < 0.8 ? 'rgba(110,145,62,0.5)' : 'rgba(160,170,90,0.45)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (r() - 0.5) * 2, y - l);
    g.stroke();
  }
  return alsTextur(c);
}

function pflaster(r) {
  const c = leinwand(256);
  const g = c.getContext('2d');
  g.fillStyle = '#4d4a44';
  g.fillRect(0, 0, 256, 256);
  const n = 8, s = 256 / n;
  for (let y = 0; y < n; y++) {
    const off = (y % 2) * s / 2;
    for (let x = -1; x < n + 1; x++) {
      const t = 118 + Math.floor(r() * 40);
      g.fillStyle = 'rgb(' + t + ',' + (t - 6) + ',' + (t - 16) + ')';
      const px = x * s + off + 2, py = y * s + 2, w = s - 4, h = s - 4;
      g.beginPath();
      if (g.roundRect) g.roundRect(px, py, w, h, 7);
      else g.rect(px, py, w, h);
      g.fill();
    }
  }
  flecken(g, 256, 256, r, 12, 'rgba(50,46,40,1)', 0.2, 30);
  rauschen(g, 256, 256, r, 2600, '#d0c8b8', '#3a3630', 1.4);
  return alsTextur(c);
}

function holzboden(r) {
  const c = leinwand(256);
  const g = c.getContext('2d');
  g.fillStyle = '#3a2c1e';
  g.fillRect(0, 0, 256, 256);
  const n = 8, h = 256 / n;
  for (let i = 0; i < n; i++) {
    const t = r();
    g.fillStyle = t < 0.33 ? '#8b6a45' : t < 0.66 ? '#7d5d3b' : '#94734c';
    g.fillRect(0, i * h + 1.5, 256, h - 3);
    g.strokeStyle = 'rgba(60,40,22,0.35)';
    g.lineWidth = 1;
    for (let k = 0; k < 4; k++) {
      const y = i * h + 4 + r() * (h - 8);
      g.beginPath();
      g.moveTo(0, y);
      for (let x = 0; x <= 256; x += 32) g.lineTo(x, y + Math.sin(x * 0.04 + k + i) * 1.5);
      g.stroke();
    }
    // Stoesse und Naegel
    const stoss = r() * 256;
    g.fillStyle = 'rgba(30,20,12,0.8)';
    g.fillRect(stoss, i * h + 1.5, 2, h - 3);
    g.fillStyle = 'rgba(40,40,40,0.8)';
    g.fillRect(stoss + 5, i * h + 5, 2, 2);
    g.fillRect(stoss + 5, i * h + h - 7, 2, 2);
  }
  rauschen(g, 256, 256, r, 1200, '#c8a878', '#2a1c10', 1.3);
  return alsTextur(c);
}

function ziegel(r) {
  const c = leinwand(256);
  const g = c.getContext('2d');
  g.fillStyle = '#b8ab98';
  g.fillRect(0, 0, 256, 256);
  const reihen = 16, h = 256 / reihen, b = 32;
  for (let y = 0; y < reihen; y++) {
    const off = (y % 2) * b / 2;
    for (let x = -1; x < 256 / b + 1; x++) {
      const t = r();
      g.fillStyle = t < 0.3 ? '#8f4332' : t < 0.7 ? '#9c4d38' : '#a85a42';
      g.fillRect(x * b + off + 1.5, y * h + 1.5, b - 3, h - 3);
    }
  }
  flecken(g, 256, 256, r, 12, 'rgba(60,40,30,1)', 0.18, 40);
  rauschen(g, 256, 256, r, 2400, '#e0b8a0', '#40241a', 1.4);
  return alsTextur(c);
}

function putz(r) {
  const c = leinwand(256);
  const g = c.getContext('2d');
  g.fillStyle = '#e2dccf';
  g.fillRect(0, 0, 256, 256);
  flecken(g, 256, 256, r, 16, 'rgba(160,150,130,1)', 0.16, 60);
  flecken(g, 256, 256, r, 6, 'rgba(120,110,95,1)', 0.12, 26);
  rauschen(g, 256, 256, r, 3200, '#ffffff', '#8a8272', 1.6);
  // ein paar Risse
  g.strokeStyle = 'rgba(90,82,70,0.35)';
  g.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    let x = r() * 256, y = r() * 256;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 5; k++) {
      x += (r() - 0.5) * 30; y += r() * 18;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  return alsTextur(c);
}

function lehm(r) {
  const c = leinwand(256);
  const g = c.getContext('2d');
  g.fillStyle = '#cfb28e';
  g.fillRect(0, 0, 256, 256);
  flecken(g, 256, 256, r, 18, 'rgba(160,128,94,1)', 0.28, 50);
  flecken(g, 256, 256, r, 10, 'rgba(232,214,186,1)', 0.3, 40);
  rauschen(g, 256, 256, r, 3800, '#eee0c4', '#7a624a', 1.8);
  g.strokeStyle = 'rgba(100,78,56,0.4)';
  g.lineWidth = 1.2;
  for (let i = 0; i < 7; i++) {
    let x = r() * 256, y = r() * 256;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 4; k++) {
      x += (r() - 0.5) * 34; y += (r() - 0.5) * 34;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  return alsTextur(c);
}

function heu(r) {
  const c = leinwand(256);
  const g = c.getContext('2d');
  g.fillStyle = '#c9ad5c';
  g.fillRect(0, 0, 256, 256);
  flecken(g, 256, 256, r, 14, 'rgba(150,120,50,1)', 0.3, 40);
  for (let i = 0; i < 4200; i++) {
    const x = r() * 256, y = r() * 256, l = 3 + r() * 8, w = (r() - 0.5) * 1.6;
    const t = r();
    g.strokeStyle = t < 0.3 ? 'rgba(120,92,36,0.5)' : t < 0.8 ? 'rgba(230,205,120,0.55)' : 'rgba(250,235,170,0.5)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + l * w, y + l);
    g.stroke();
  }
  return alsTextur(c);
}

function dachziegel(r) {
  const c = leinwand(256);
  const g = c.getContext('2d');
  g.fillStyle = '#5e2a1e';
  g.fillRect(0, 0, 256, 256);
  const reihen = 10, h = 256 / reihen, b = 26;
  for (let y = 0; y < reihen; y++) {
    const off = (y % 2) * b / 2;
    for (let x = -1; x < 256 / b + 1; x++) {
      const t = r();
      g.fillStyle = t < 0.4 ? '#9a3e2a' : t < 0.8 ? '#a8492f' : '#8a3624';
      g.beginPath();
      g.moveTo(x * b + off + 1, y * h);
      g.lineTo(x * b + off + b - 1, y * h);
      g.lineTo(x * b + off + b - 1, y * h + h * 0.7);
      g.quadraticCurveTo(x * b + off + b / 2, y * h + h + 3, x * b + off + 1, y * h + h * 0.7);
      g.fill();
    }
  }
  flecken(g, 256, 256, r, 10, 'rgba(40,30,20,1)', 0.2, 40);
  rauschen(g, 256, 256, r, 1800, '#e0a080', '#301410', 1.3);
  return alsTextur(c);
}

export function texturenErzeugen() {
  const r = zufallsquelle(20260928);
  return {
    beton: beton(r),
    mauer: mauer(r),
    container: container(r),
    holz: holz(r),
    sandsack: sandsack(r),
    hesco: hesco(r),
    metall: metall(r),
    plane: plane(r),
    barriere: barriere(r),
    halle: halle(r),
    regal: regal(r),
    dach: dach(r),
    kies: kies(r),
    asphalt: asphalt(r),
    platten: platten(r),
    estrich: estrich(r),
    ...weitereTexturen(),
  };
}

function weitereTexturen() {
  const r = zufallsquelle(20260930);
  return {
    sand: sand(r),
    gras: gras(r),
    pflaster: pflaster(r),
    holzboden: holzboden(r),
    ziegel: ziegel(r),
    putz: putz(r),
    lehm: lehm(r),
    dachziegel: dachziegel(r),
    heu: heu(r),
  };
}
