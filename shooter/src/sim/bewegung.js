/* ------------------------------------------------------------------
   Figurensteuerung: Laufen, Sprinten, Springen, Ducken, Rutschen.

   Die Figur ist ein aufrechter Quader (Breite 2 x radius). Bewegt wird
   Achse fuer Achse: erst waagerecht (mit Stufensteigen), dann senkrecht.
   Jede Achse haelt vor Hindernissen einen Millimeter Abstand (HAUT).
   Dadurch gleitet man an Waenden entlang, bleibt an Fugen zwischen zwei
   Mauerstuecken nicht haengen und rutscht nie in einen Quader hinein.

   Quader, in denen die Figur bereits steckt (sollte nie passieren),
   bremsen sie nicht - so kann sie sich aus einem Fehler selbst befreien,
   statt fuer immer festzusitzen.
   ------------------------------------------------------------------ */

import { FIGUR } from '../konfig.js';
import { T_DUCKEN, T_SPRINGEN, T_SPRINT, T_FEUER, T_VISIER } from './befehl.js';
import { klemme, mische, naehere } from './mathe.js';

const HAUT = 0.001;
const EPS = 1e-7;

function schiebeX(welt, f, dx) {
  if (dx === 0) return false;
  const r = FIGUR.radius;
  const b = welt.b;
  const altMin = f.x - r, altMax = f.x + r;
  const neuMin = altMin + dx, neuMax = altMax + dx;
  const minY = f.y, maxY = f.y + f.hoehe, minZ = f.z - r, maxZ = f.z + r;
  let grenze = dx > 0 ? Infinity : -Infinity;
  for (let i = 0, o = 0; i < welt.n; i++, o += 6) {
    if (!(minY < b[o + 4] && maxY > b[o + 1] && minZ < b[o + 5] && maxZ > b[o + 2])) continue;
    if (dx > 0) {
      if (b[o] >= altMax - EPS && b[o] < neuMax && b[o] < grenze) grenze = b[o];
    } else if (b[o + 3] <= altMin + EPS && b[o + 3] > neuMin && b[o + 3] > grenze) {
      grenze = b[o + 3];
    }
  }
  if (dx > 0 && grenze !== Infinity) {
    f.x = Math.max(f.x, grenze - r - HAUT);
    return true;
  }
  if (dx < 0 && grenze !== -Infinity) {
    f.x = Math.min(f.x, grenze + r + HAUT);
    return true;
  }
  f.x += dx;
  return false;
}

function schiebeZ(welt, f, dz) {
  if (dz === 0) return false;
  const r = FIGUR.radius;
  const b = welt.b;
  const altMin = f.z - r, altMax = f.z + r;
  const neuMin = altMin + dz, neuMax = altMax + dz;
  const minY = f.y, maxY = f.y + f.hoehe, minX = f.x - r, maxX = f.x + r;
  let grenze = dz > 0 ? Infinity : -Infinity;
  for (let i = 0, o = 0; i < welt.n; i++, o += 6) {
    if (!(minY < b[o + 4] && maxY > b[o + 1] && minX < b[o + 3] && maxX > b[o])) continue;
    if (dz > 0) {
      if (b[o + 2] >= altMax - EPS && b[o + 2] < neuMax && b[o + 2] < grenze) grenze = b[o + 2];
    } else if (b[o + 5] <= altMin + EPS && b[o + 5] > neuMin && b[o + 5] > grenze) {
      grenze = b[o + 5];
    }
  }
  if (dz > 0 && grenze !== Infinity) {
    f.z = Math.max(f.z, grenze - r - HAUT);
    return true;
  }
  if (dz < 0 && grenze !== -Infinity) {
    f.z = Math.min(f.z, grenze + r + HAUT);
    return true;
  }
  f.z += dz;
  return false;
}

/* Senkrecht. Ergebnis: 1 = gelandet, 2 = Kopf gestossen, 0 = frei.
   Beim Landen steht die Figur exakt auf der Oberkante - ohne Abstand,
   damit der Boden die waagerechte Bewegung nie bremst. */
function schiebeY(welt, f, dy) {
  if (dy === 0) return 0;
  const r = FIGUR.radius;
  const b = welt.b;
  const minX = f.x - r, maxX = f.x + r, minZ = f.z - r, maxZ = f.z + r;
  const altMin = f.y, altMax = f.y + f.hoehe;
  const neuMin = altMin + dy, neuMax = altMax + dy;
  if (dy < 0) {
    let grenze = -Infinity;
    for (let i = 0, o = 0; i < welt.n; i++, o += 6) {
      if (!(minX < b[o + 3] && maxX > b[o] && minZ < b[o + 5] && maxZ > b[o + 2])) continue;
      if (b[o + 4] <= altMin + EPS && b[o + 4] > neuMin && b[o + 4] > grenze) grenze = b[o + 4];
    }
    if (grenze !== -Infinity) {
      f.y = grenze;
      return 1;
    }
  } else {
    let grenze = Infinity;
    for (let i = 0, o = 0; i < welt.n; i++, o += 6) {
      if (!(minX < b[o + 3] && maxX > b[o] && minZ < b[o + 5] && maxZ > b[o + 2])) continue;
      if (b[o + 1] >= altMax - EPS && b[o + 1] < neuMax && b[o + 1] < grenze) grenze = b[o + 1];
    }
    if (grenze !== Infinity) {
      f.y = Math.max(f.y, grenze - f.hoehe - HAUT);
      return 2;
    }
  }
  f.y += dy;
  return 0;
}

/* Um hoechstens h absenken; landet die Figur nicht, bleibt sie, wo sie war. */
function senke(welt, f, h) {
  const y0 = f.y;
  if (schiebeY(welt, f, -h) === 1) return true;
  f.y = y0;
  return false;
}

function waagerecht(welt, f, dx, dz) {
  // Die groessere Achse zuerst - so gleitet man an Ecken sauber vorbei.
  if (Math.abs(dx) >= Math.abs(dz)) {
    const a = schiebeX(welt, f, dx);
    return schiebeZ(welt, f, dz) || a;
  }
  const a = schiebeZ(welt, f, dz);
  return schiebeX(welt, f, dx) || a;
}

/* Waagerecht bewegen, notfalls eine Stufe hinauf. */
function waagerechtMitStufe(welt, f, dx, dz, darfSteigen) {
  const sx = f.x, sy = f.y, sz = f.z;
  const blockiert = waagerecht(welt, f, dx, dz);
  if (!blockiert || !darfSteigen) return;
  const ax = f.x, az = f.z;
  const d1 = (ax - sx) * (ax - sx) + (az - sz) * (az - sz);

  f.x = sx;
  f.z = sz;
  schiebeY(welt, f, FIGUR.stufe);
  const hub = f.y - sy;
  if (hub > 0.01) {
    waagerecht(welt, f, dx, dz);
    const d2 = (f.x - sx) * (f.x - sx) + (f.z - sz) * (f.z - sz);
    if (d2 > d1 + 1e-8 && senke(welt, f, hub + 0.02)) {
      if (f.y > sy) f.stufenVersatz += f.y - sy;
      return;
    }
  }
  f.x = ax;
  f.y = sy;
  f.z = az;
}

export function platzZumStehen(welt, f) {
  const r = FIGUR.radius;
  return welt.ueberlappt(f.x - r, f.y + 0.001, f.z - r, f.x + r, f.y + FIGUR.hoehe, f.z + r) < 0;
}

export function steckt(welt, f) {
  const r = FIGUR.radius;
  return welt.ueberlappt(f.x - r, f.y + 0.001, f.z - r, f.x + r, f.y + f.hoehe, f.z + r) >= 0;
}

/* Waagerecht schieben ohne Stufen - fuer das Auseinanderdruecken
   zweier Figuren. */
export function schiebeWaagerecht(welt, f, dx, dz) {
  waagerecht(welt, f, dx, dz);
}

/* Ein Simulationsschritt fuer eine lebende Figur.

   neu sind die in diesem Schritt frisch gedrueckten Tasten, waffe
   liefert visier (0..1) und das Tempo der Waffe. Ereignisse (Landung,
   Schritte, Sprung) stehen danach als Merker an der Figur, die
   Simulation macht daraus Meldungen. */
export function bewegeFigur(welt, f, bef, dt, waffe, neu) {
  const F = FIGUR;
  const tasten = bef.tasten;

  const warGeduckt = f.geduckt && f.rutschZeit <= 0;
  const warAmBoden = f.amBoden;

  /* Rutschen: aus dem Sprint heraus frisch ducken. */
  if (f.rutschPause > 0) f.rutschPause -= dt;
  if ((neu & T_DUCKEN) && f.sprintet && f.amBoden && f.rutschPause <= 0 && f.rutschZeit <= 0) {
    let rx = f.vx, rz = f.vz;
    const l = Math.hypot(rx, rz);
    if (l > 0.5) {
      f.rutschX = rx / l;
      f.rutschZ = rz / l;
      f.rutschZeit = F.rutschen.dauer;
      f.rutschPause = F.rutschen.dauer + F.rutschen.pause;
      f.rutschtNeu = true;
    }
  }

  /* Ducken und Aufstehen. Aufgestanden wird nur, wenn darueber Platz ist. */
  const duckenGewollt = (tasten & T_DUCKEN) !== 0 || f.rutschZeit > 0;
  if (duckenGewollt && !f.geduckt) {
    f.geduckt = true;
    f.hoehe = F.hoeheGeduckt;
  } else if (!duckenGewollt && f.geduckt && platzZumStehen(welt, f)) {
    f.geduckt = false;
    f.hoehe = F.hoehe;
  }
  f.duckAnteil = naehere(f.duckAnteil, f.geduckt ? 1 : 0, F.duckTempo * dt);

  /* Wunschrichtung in Weltkoordinaten. */
  const sy = Math.sin(bef.yaw), cy = Math.cos(bef.yaw);
  let vor = klemme(bef.vor || 0, -1, 1);
  let seit = klemme(bef.seit || 0, -1, 1);
  let laenge = Math.hypot(vor, seit);
  if (laenge > 1) { vor /= laenge; seit /= laenge; laenge = 1; }
  const wx = -sy * vor + cy * seit;
  const wz = -cy * vor - sy * seit;

  /* Sprinten nur nach vorn, nicht geduckt, nicht beim Schiessen oder
     Zielen. In der Luft bleibt ein Sprint erhalten. */
  f.sprintet = (tasten & T_SPRINT) !== 0 && vor > 0.45 && !f.geduckt
    && (tasten & (T_FEUER | T_VISIER)) === 0 && f.rutschZeit <= 0
    && (f.amBoden || f.sprintet);

  let tempo = F.tempo.gehen;
  if (f.sprintet) tempo = F.tempo.sprint;
  else if (f.geduckt) tempo = F.tempo.geduckt;
  if (vor < 0) tempo *= mische(1, 0.86, -vor);
  if (waffe) {
    tempo *= waffe.def.tempo;
    if (waffe.visier > 0) tempo *= mische(1, waffe.def.visier.tempo, waffe.visier);
  }

  if (f.rutschZeit > 0) {
    f.rutschZeit -= dt;
    const p = 1 - Math.max(0, f.rutschZeit) / F.rutschen.dauer;
    const v = mische(F.rutschen.start, F.rutschen.ende, p);
    /* Leicht lenkbar: die Rutschrichtung dreht sich begrenzt zur
       Wunschrichtung. */
    if (laenge > 0.1) {
      const soll = Math.atan2(wz, wx);
      const ist = Math.atan2(f.rutschZ, f.rutschX);
      let d = soll - ist;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      const max = F.rutschen.lenkung * dt;
      const neuWinkel = ist + klemme(d, -max, max);
      f.rutschX = Math.cos(neuWinkel);
      f.rutschZ = Math.sin(neuWinkel);
    }
    f.vx = f.rutschX * v;
    f.vz = f.rutschZ * v;
    if (!f.amBoden) f.rutschZeit = 0;
  } else {
    const zx = wx * tempo, zz = wz * tempo;
    const dvx = zx - f.vx, dvz = zz - f.vz;
    const d = Math.hypot(dvx, dvz);
    let rate;
    if (f.amBoden) rate = (laenge > 0.01 ? F.beschleunigung : F.bremsen) * dt;
    else rate = laenge > 0.01 ? F.luftSteuerung * dt : 0;
    if (d <= rate) {
      f.vx = zx;
      f.vz = zz;
    } else if (rate > 0) {
      f.vx += (dvx / d) * rate;
      f.vz += (dvz / d) * rate;
    }
  }

  /* Springen. Wer geduckt ist, steht mit der Sprungtaste nur auf (die
     Eingabe nimmt dafuer das Ducken zurueck). Aus dem Rutschen heraus
     wird gesprungen und der Schwung bleibt. */
  if ((neu & T_SPRINGEN) && (f.amBoden || f.luftZeit < 0.1) && f.vy <= 0.5) {
    if (f.rutschZeit > 0) {
      f.rutschZeit = 0;
      if (platzZumStehen(welt, f)) {
        f.geduckt = false;
        f.hoehe = F.hoehe;
      }
    }
    if (!warGeduckt && !f.geduckt) {
      f.vy = F.sprungTempo;
      f.amBoden = false;
      f.luftZeit = 1;
      f.gesprungen = true;
    }
  }

  /* Bewegen: erst waagerecht, dann senkrecht. */
  f.vy = Math.max(f.vy - F.schwerkraft * dt, -F.maxFall);
  waagerechtMitStufe(welt, f, f.vx * dt, f.vz * dt, warAmBoden && f.vy <= 0);

  const fallTempo = -f.vy;
  const ergebnis = schiebeY(welt, f, f.vy * dt);
  if (ergebnis === 1) {
    if (!warAmBoden && fallTempo > 2.5) f.landung = fallTempo;
    f.amBoden = true;
    f.vy = 0;
  } else if (ergebnis === 2) {
    f.vy = Math.min(f.vy, 0);
    f.amBoden = false;
  } else {
    f.amBoden = false;
    /* Treppab und ueber kleine Kanten: am Boden bleiben, statt in
       kleinen Spruengen hinunterzufallen. */
    if (warAmBoden && f.vy <= 0) {
      const y0 = f.y;
      if (senke(welt, f, F.stufe + 0.05)) {
        f.amBoden = true;
        f.vy = 0;
        f.stufenVersatz += f.y - y0;
      }
    }
  }

  f.luftZeit = f.amBoden ? 0 : f.luftZeit + dt;
  f.stufenVersatz = klemme(f.stufenVersatz * Math.exp(-dt * 14), -0.6, 0.6);
  if (Math.abs(f.stufenVersatz) < 0.001) f.stufenVersatz = 0;

  /* Schritte fuer Klang und Wackeln der Waffe. */
  if (f.amBoden) {
    const v = Math.hypot(f.vx, f.vz);
    f.schrittWeg += v * dt;
    const laengeSchritt = f.rutschZeit > 0 ? 99 : f.sprintet ? 2.0 : f.geduckt ? 1.1 : 1.65;
    if (f.schrittWeg > laengeSchritt) {
      f.schrittWeg = 0;
      f.schritt = true;
    }
  }
}

/* Blickhoehe ueber den Fuessen, weich zwischen Stehen und Ducken. */
export function augenhoehe(f) {
  return mische(FIGUR.auge, FIGUR.augeGeduckt, f.duckAnteil);
}
