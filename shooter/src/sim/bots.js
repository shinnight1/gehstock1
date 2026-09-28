/* ------------------------------------------------------------------
   Bot-KI.

   Ein Bot erzeugt pro Schritt denselben Befehl wie ein Spieler: Blick,
   Laufrichtung, Tasten. Er darf nichts, was ein Spieler nicht auch
   koennte - kein Blick durch Waende, keine sofortige Drehung, keine
   perfekte Treffsicherheit.

   Ablauf je Schritt:
     1. Wahrnehmung (zehnmal pro Sekunde, versetzt): Wen sehe ich?
        Sichtfeld, Sichtweite und eine echte Sichtlinie durch die Welt.
     2. Bewegung: im Kampf seitlich pendeln und Abstand halten, sonst
        einem Weg folgen, einem Geraeusch nachgehen oder jagen.
     3. Blick: auf das Ziel (mit Zielfehler, der sich abbaut), sonst auf
        die Bedrohung oder in Laufrichtung. Gedreht wird mit begrenzter
        Rate.
     4. Feuer erst nach der Reaktionszeit und nur, wenn die Waffe grob
        auf das Ziel zeigt; in Salven mit Pausen. Nachladen bei leerem
        oder halbleerem Magazin, wenn gerade niemand zu sehen ist.
   ------------------------------------------------------------------ */

import { BOT_REICHWEITE } from '../konfig.js';
import { T_DUCKEN, T_FEUER, T_NACHLADEN, T_SPRINGEN, T_SPRINT, T_VISIER } from './befehl.js';
import { augenhoehe } from './bewegung.js';
import { GRAD, klemme, winkelDiff, yawZu } from './mathe.js';

const RICHTUNG = { x: 0, z: 0, rest: 0, angekommen: false };
const ZUFALL = { x: 0, z: 0 };

export function neueKi(sim, a) {
  return {
    ziel: -1,
    zielSicht: false,
    zielGesehen: -99,
    zielX: 0, zielY: 0, zielZ: 0,
    reaktionBis: 0,
    fehlerYaw: 0,
    fehlerPitch: 0,
    kopf: false,
    salveRest: 0,
    pauseBis: 0,
    schussStand: 0,
    strafe: 1,
    strafeBis: 0,
    strafeSeit: 0,
    duckenBis: 0,
    weg: a.id % 3,
    wegIndex: 0,
    wegRichtung: a.team === 0 ? 1 : -1,
    jagd: false,
    jagdX: 0, jagdZ: 0, jagdBis: 0,
    pfad: new Float32Array(160),
    pfadN: 0,
    pfadI: 0,
    planX: NaN, planZ: NaN, planBis: 0, planNoetig: true,
    wahrnehmungBis: (a.id % 6) * 0.017,
    festSeit: 0, festX: 0, festZ: 0, festVersuche: 0,
    hoerX: 0, hoerZ: 0, hoerZeit: -99,
    angreifer: -1, angreiferZeit: -99,
  };
}

/* ---------------------------------------------------------- Ereignisse */

export function botGespawnt(sim, a) {
  const k = a.ki;
  const S = sim.stufe;
  k.ziel = -1;
  k.zielSicht = false;
  k.zielGesehen = -99;
  k.salveRest = 0;
  k.pauseBis = 0;
  k.duckenBis = 0;
  k.hoerZeit = -99;
  k.angreifer = -1;
  k.angreiferZeit = -99;
  k.pfadN = 0;
  k.planNoetig = true;
  k.festSeit = sim.zeit;
  k.festX = a.x;
  k.festZ = a.z;
  k.festVersuche = 0;
  k.schussStand = a.waffe.schuesse;
  // Wege gleichmaessig auf das Team verteilen, mit etwas Zufall.
  const zaehler = [0, 0, 0];
  for (const b of sim.akteure) {
    if (b !== a && b.team === a.team && b.ki && b.lebt) zaehler[b.ki.weg]++;
  }
  let weg = sim.zufall.ganz(3);
  for (let v = 0; v < 3; v++) {
    const w = (weg + v) % 3;
    if (zaehler[w] === Math.min(zaehler[0], zaehler[1], zaehler[2])) { weg = w; break; }
  }
  k.weg = weg;
  k.wegRichtung = a.team === 0 ? 1 : -1;
  const n = sim.karte.wege[weg].punkte.length;
  k.wegIndex = a.team === 0 ? 1 : n - 2;
  k.jagd = sim.zufall() < S.jagd;
  k.jagdBis = 0;
}

/* Schuesse hoert man - aber nur Gegner und nur in Hoerweite. */
export function botsHoeren(sim, schuetze, weite) {
  const faktor = sim.stufe.hoeren / 26;
  for (const b of sim.akteure) {
    if (!b.ki || !b.lebt || b.team === schuetze.team) continue;
    const d = Math.hypot(b.x - schuetze.x, b.z - schuetze.z);
    if (d > weite * faktor) continue;
    const k = b.ki;
    if (k.zielSicht) continue;
    k.hoerX = schuetze.x + sim.zufall.zwischen(-2.5, 2.5);
    k.hoerZ = schuetze.z + sim.zufall.zwischen(-2.5, 2.5);
    k.hoerZeit = sim.zeit;
  }
}

export function botGetroffen(sim, b, taeter) {
  const k = b.ki;
  k.angreifer = taeter.id;
  k.angreiferZeit = sim.zeit;
  k.hoerX = taeter.x;
  k.hoerZ = taeter.z;
  k.hoerZeit = sim.zeit;
}

/* ---------------------------------------------------------- Denken */

export function denkeBots(sim, dt) {
  for (const a of sim.akteure) {
    if (a.ki) denke(sim, a, dt);
  }
}

function wahrnehmen(sim, a, k, S, auge) {
  let bestes = null;
  let besterWert = Infinity;
  const halbesFeld = S.sichtFeld * 0.5 * GRAD;
  for (const e of sim.akteure) {
    if (e.team === a.team || !e.lebt) continue;
    const dx = e.x - a.x, dz = e.z - a.z;
    const d = Math.hypot(dx, dz);
    const angreifer = e.id === k.angreifer && sim.zeit - k.angreiferZeit < 2;
    if (d > S.sichtWeite && !angreifer) continue;
    const bekannt = e.id === k.ziel && sim.zeit - k.zielGesehen < 1.0;
    const nahUndLaut = d < 5 && Math.hypot(e.vx, e.vz) > 1.5;
    if (!angreifer && !bekannt && !nahUndLaut) {
      if (Math.abs(winkelDiff(a.yaw, yawZu(dx, dz))) > halbesFeld) continue;
    }
    // Echte Sichtlinie: Kopf oder Brust muessen frei sein.
    const kopfY = e.y + e.hoehe - 0.12;
    const brustY = e.y + e.hoehe * 0.62;
    if (!sim.welt.sichtFrei(a.x, auge, a.z, e.x, kopfY, e.z)
        && !sim.welt.sichtFrei(a.x, auge, a.z, e.x, brustY, e.z)) continue;
    let wert = d;
    if (e.id === k.ziel) wert -= 8;
    if (angreifer) wert -= 10;
    if (e.schutz > 0) wert += 25;
    if (wert < besterWert) {
      besterWert = wert;
      bestes = e;
    }
  }

  if (bestes) {
    const neu = bestes.id !== k.ziel || !k.zielSicht;
    if (neu) {
      /* Reaktionszeit und Zielfehler neu wuerfeln. Wer das Ziel eben
         noch gesehen hat, reagiert schneller und genauer. */
      const frisch = bestes.id === k.ziel && sim.zeit - k.zielGesehen < 1.2;
      k.reaktionBis = sim.zeit + sim.zufall.zwischen(S.reaktion[0], S.reaktion[1]) * (frisch ? 0.4 : 1);
      const f = S.zielFehler * GRAD * sim.zufall.zwischen(0.55, 1) * (frisch ? 0.45 : 1);
      k.fehlerYaw = sim.zufall.vorzeichen() * f;
      k.fehlerPitch = sim.zufall.zwischen(-0.6, 0.6) * f;
      k.kopf = sim.zufall() < S.kopfAnteil;
      k.salveRest = 0;
      k.schussStand = a.waffe.schuesse;
    } else {
      /* Bewegt sich das Ziel quer zur Sichtlinie, verliert der Bot etwas
         an Genauigkeit - wie ein Mensch, der nachziehen muss. */
      const lx = bestes.x - a.x, lz = bestes.z - a.z;
      const d = Math.max(1, Math.hypot(lx, lz));
      const quer = Math.abs(bestes.vx * lz - bestes.vz * lx) / d;
      const eigen = Math.hypot(a.vx, a.vz);
      const zuwachs = ((quer + eigen * 0.5) / d) * 0.12 * S.bewegungsFehler;
      const grenze = S.zielFehler * 2 * GRAD;
      k.fehlerYaw = klemme(k.fehlerYaw + sim.zufall.zwischen(-1, 1) * zuwachs, -grenze, grenze);
      k.fehlerPitch = klemme(k.fehlerPitch + sim.zufall.zwischen(-0.5, 0.5) * zuwachs, -grenze, grenze);
    }
    k.ziel = bestes.id;
    k.zielSicht = true;
    k.zielGesehen = sim.zeit;
    k.zielX = bestes.x;
    k.zielY = bestes.y + bestes.hoehe * 0.62;
    k.zielZ = bestes.z;
  } else {
    k.zielSicht = false;
    if (k.ziel >= 0) {
      const z = sim.akteure[k.ziel];
      if (!z.lebt || sim.zeit - k.zielGesehen > 5) k.ziel = -1;
    }
  }
}

/* Richtung entlang des Pfads zum Punkt (gx, gz). */
function pfadRichtung(sim, a, k, gx, gz) {
  const aus = RICHTUNG;
  const abweichung = Math.hypot(gx - k.planX, gz - k.planZ);
  if ((k.planNoetig || !(abweichung < 1.5) || sim.zeit > k.planBis) && sim.planBudget > 0) {
    sim.planBudget--;
    k.pfadN = sim.nav.pfad(a.x, a.z, a.y, gx, gz, k.pfad, 80);
    k.pfadI = 0;
    k.planX = gx;
    k.planZ = gz;
    k.planBis = sim.zeit + 2.5 + sim.zufall() * 1.5;
    k.planNoetig = false;
  }
  let px = gx, pz = gz;
  if (k.pfadN > 0) {
    while (k.pfadI < k.pfadN - 1) {
      const qx = k.pfad[k.pfadI * 2], qz = k.pfad[k.pfadI * 2 + 1];
      if (Math.hypot(qx - a.x, qz - a.z) < 0.7) k.pfadI++;
      else break;
    }
    px = k.pfad[k.pfadI * 2];
    pz = k.pfad[k.pfadI * 2 + 1];
  }
  const dx = px - a.x, dz = pz - a.z;
  const l = Math.hypot(dx, dz);
  const zielD = Math.hypot(gx - a.x, gz - a.z);
  aus.angekommen = zielD < 1.0;
  aus.rest = zielD;
  if (l < 1e-3) {
    aus.x = 0;
    aus.z = 0;
  } else {
    aus.x = dx / l;
    aus.z = dz / l;
  }
  return aus;
}

function jagdZielWaehlen(sim, a, k) {
  // Ungefaehre Lage eines zufaelligen lebenden Gegners - wie ein Blick
  // auf die Minikarte, auf der schiessende Gegner kurz aufleuchten.
  const gegner = [];
  for (const e of sim.akteure) if (e.team !== a.team && e.lebt) gegner.push(e);
  if (!gegner.length) return false;
  const e = gegner[sim.zufall.ganz(gegner.length)];
  if (!sim.nav.zufallsPunkt(e.x, e.z, 7, sim.zufall, ZUFALL)) return false;
  k.jagdX = ZUFALL.x;
  k.jagdZ = ZUFALL.z;
  k.jagdBis = sim.zeit + 12;
  return true;
}

function denke(sim, a, dt) {
  const k = a.ki;
  const S = sim.stufe;
  const bef = a.befehl;
  bef.tasten = 0;
  bef.vor = 0;
  bef.seit = 0;
  if (!a.lebt) return;
  if (sim.phase !== 'laeuft') {
    bef.yaw = a.yaw;
    bef.pitch = a.pitch * 0.9;
    return;
  }

  const auge = a.y + augenhoehe(a);
  if (sim.zeit >= k.wahrnehmungBis) {
    k.wahrnehmungBis = sim.zeit + 0.1;
    wahrnehmen(sim, a, k, S, auge);
  }

  const w = a.waffe;
  const ziel = k.ziel >= 0 ? sim.akteure[k.ziel] : null;
  const kampf = !!(ziel && ziel.lebt && k.zielSicht);
  const erinnert = !!(ziel && ziel.lebt && !k.zielSicht && sim.zeit - k.zielGesehen < 4);
  const rw = BOT_REICHWEITE[w.id];
  const dist = ziel ? Math.hypot(ziel.x - a.x, ziel.z - a.z) : 0;

  /* ---------------------------------------------------- Bewegung */
  let mx = 0, mz = 0;          // gewuenschte Laufrichtung (Welt)
  let tempo = 1;
  let sprint = false;
  let laufen = false;

  if (kampf) {
    if (sim.zeit >= k.strafeBis) {
      k.strafe = sim.zufall.vorzeichen();
      k.strafeBis = sim.zeit + sim.zufall.zwischen(0.45, 1.3);
      k.strafeSeit = sim.zeit;
    }
    const lx = (ziel.x - a.x) / Math.max(dist, 0.01);
    const lz = (ziel.z - a.z) / Math.max(dist, 0.01);
    let vor = 0;
    if (dist > rw.wunsch[1]) vor = 1;
    else if (dist < rw.wunsch[0]) vor = -0.7;
    if (vor > 0 && dist > rw.wunsch[1] + 5) {
      const r = pfadRichtung(sim, a, k, ziel.x, ziel.z);
      mx = r.x; mz = r.z;
    } else {
      // seitlich: rechts von der Sichtlinie ist (-lz, lx)
      mx = lx * vor + (-lz) * k.strafe * S.strafen;
      mz = lz * vor + lx * k.strafe * S.strafen;
    }
    laufen = true;
    tempo = 1;
    if (sim.zeit < k.duckenBis) bef.tasten |= T_DUCKEN;
    else if (dist > 9 && sim.zufall() < S.ducken * dt * 2.5) {
      k.duckenBis = sim.zeit + sim.zufall.zwischen(0.7, 1.6);
    }
    // Beim Pendeln an ein Hindernis gestossen: andersherum.
    if (Math.hypot(a.vx, a.vz) < 0.3 && sim.zeit - k.strafeSeit > 0.35) {
      k.strafe *= -1;
      k.strafeSeit = sim.zeit;
    }
  } else {
    let gx, gz;
    if (erinnert) {
      gx = k.zielX; gz = k.zielZ;
    } else if (sim.zeit - k.hoerZeit < 4) {
      gx = k.hoerX; gz = k.hoerZ;
    } else if (k.jagd && (sim.zeit < k.jagdBis || jagdZielWaehlen(sim, a, k))) {
      gx = k.jagdX; gz = k.jagdZ;
      sprint = true;
    } else {
      const weg = sim.karte.wege[k.weg].punkte;
      let p = weg[k.wegIndex];
      if (Math.hypot(p[0] - a.x, p[1] - a.z) < 2.2) {
        let ni = k.wegIndex + k.wegRichtung;
        if (ni < 0 || ni >= weg.length) {
          // Am Ende angekommen: Richtung wechseln, oft gleich auf die Jagd.
          k.wegRichtung *= -1;
          ni = k.wegIndex + k.wegRichtung;
          if (sim.zufall() < 0.6) k.jagd = true;
          k.weg = sim.zufall.ganz(3);
        } else if ((ni === 2 || ni === 4) && sim.zufall() < 0.3) {
          k.weg = (k.weg + 1 + sim.zufall.ganz(2)) % 3;
        }
        k.wegIndex = klemme(ni, 0, sim.karte.wege[k.weg].punkte.length - 1);
        p = sim.karte.wege[k.weg].punkte[k.wegIndex];
      }
      gx = p[0]; gz = p[1];
      sprint = true;
    }
    const r = pfadRichtung(sim, a, k, gx, gz);
    if (r.angekommen) {
      if (erinnert) k.ziel = -1;
      if (sim.zeit - k.hoerZeit < 4) k.hoerZeit = -99;
      if (k.jagd && sim.zeit < k.jagdBis) { k.jagdBis = 0; k.jagd = sim.zufall() < S.jagd; }
    }
    mx = r.x; mz = r.z;
    laufen = mx !== 0 || mz !== 0;
    if (erinnert || sim.zeit - k.hoerZeit < 4) sprint = sim.zeit - k.zielGesehen > 2;
    if (r.rest < 4) sprint = false;
  }

  // Abstand zu Teamkameraden halten
  for (const b of sim.akteure) {
    if (b === a || !b.lebt || b.team !== a.team) continue;
    const dx = a.x - b.x, dz = a.z - b.z;
    const d = Math.hypot(dx, dz);
    if (d < 1.6 && d > 0.01) {
      const s = (1.6 - d) / 1.6;
      mx += (dx / d) * s * 1.2;
      mz += (dz / d) * s * 1.2;
    }
  }

  /* -------------------------------------------------------- Blick */
  let sollYaw = a.yaw;
  let sollPitch = 0;
  if (kampf || (erinnert && sim.zeit - k.zielGesehen < 1.2)) {
    const tx = kampf ? ziel.x : k.zielX;
    const tz = kampf ? ziel.z : k.zielZ;
    const ty = kampf ? (k.kopf ? ziel.y + ziel.hoehe - 0.13 : ziel.y + ziel.hoehe * 0.62) : k.zielY;
    const dx = tx - a.x, dz = tz - a.z;
    const d = Math.max(0.1, Math.hypot(dx, dz));
    sollYaw = yawZu(dx, dz) + k.fehlerYaw - w.rueckSeite * GRAD * S.ausgleich;
    sollPitch = Math.atan2(ty - auge, d) + k.fehlerPitch - w.rueckHoch * GRAD * S.ausgleich;
  } else if (sim.zeit - k.angreiferZeit < 2.5 || sim.zeit - k.hoerZeit < 1.5) {
    sollYaw = yawZu(k.hoerX - a.x, k.hoerZ - a.z);
  } else if (laufen && (mx !== 0 || mz !== 0)) {
    sollYaw = yawZu(mx, mz);
  }
  const abbau = Math.exp(-dt / S.fehlerZeit);
  k.fehlerYaw *= abbau;
  k.fehlerPitch *= abbau;

  const maxDreh = S.drehRate * GRAD * dt;
  const glatt = Math.min(1, dt * 11);
  const dYaw = winkelDiff(a.yaw, sollYaw);
  bef.yaw = a.yaw + klemme(dYaw * glatt, -maxDreh, maxDreh);
  bef.pitch = klemme(a.pitch + klemme((sollPitch - a.pitch) * glatt, -maxDreh, maxDreh), -1.3, 1.3);

  /* Laufrichtung in Befehlswerte relativ zum neuen Blick umrechnen:
     vorn ist (-sin yaw, -cos yaw), rechts (cos yaw, -sin yaw). */
  if (laufen) {
    const l = Math.hypot(mx, mz);
    if (l > 0.01) {
      mx /= l; mz /= l;
      const sy = Math.sin(bef.yaw), cy = Math.cos(bef.yaw);
      bef.vor = (-sy * mx - cy * mz) * tempo;
      bef.seit = (cy * mx - sy * mz) * tempo;
      if (sprint && bef.vor > 0.8 && !kampf) bef.tasten |= T_SPRINT;
    }
  }

  /* --------------------------------------------- Festsitzen erkennen */
  if (laufen && !kampf) {
    if (Math.hypot(a.x - k.festX, a.z - k.festZ) > 0.5) {
      k.festX = a.x;
      k.festZ = a.z;
      k.festSeit = sim.zeit;
      k.festVersuche = 0;
    } else if (sim.zeit - k.festSeit > 1.0) {
      k.festSeit = sim.zeit;
      k.festVersuche++;
      bef.tasten |= T_SPRINGEN;
      k.planNoetig = true;
      if (k.festVersuche >= 3) {
        k.festVersuche = 0;
        k.weg = sim.zufall.ganz(3);
        k.jagd = !k.jagd;
        k.jagdBis = 0;
        k.hoerZeit = -99;
      }
    }
  } else {
    k.festSeit = sim.zeit;
    k.festX = a.x;
    k.festZ = a.z;
  }

  /* ---------------------------------------------------------- Feuer */
  if (kampf && sim.zeit >= k.reaktionBis && dist <= rw.feuer) {
    const wahrYaw = yawZu(ziel.x - a.x, ziel.z - a.z);
    const wahrPitch = Math.atan2(ziel.y + ziel.hoehe * 0.6 - auge, Math.max(dist, 0.1));
    const abw = Math.hypot(
      winkelDiff(wahrYaw, bef.yaw + w.rueckSeite * GRAD),
      bef.pitch + w.rueckHoch * GRAD - wahrPitch);
    const groesse = Math.atan2(0.45, Math.max(dist, 0.5));
    if (abw < S.feuerWinkel * GRAD + groesse) {
      if (w.magazin > 0 && sim.zeit >= k.pauseBis && (w.laden <= 0 || w.def.einzelnLaden)) {
        if (k.salveRest <= 0) {
          k.salveRest = S.salve[0] + sim.zufall.ganz(S.salve[1] - S.salve[0] + 1);
          if (dist < 7 || w.def.kugeln > 1) k.salveRest += 6;
          k.schussStand = w.schuesse;
        }
        bef.tasten |= T_FEUER;
      }
      if (dist > 11 && w.def.kugeln === 1) bef.tasten |= T_VISIER;
    }
  }
  if (w.schuesse !== k.schussStand) {
    k.salveRest -= w.schuesse - k.schussStand;
    k.schussStand = w.schuesse;
    if (k.salveRest <= 0) {
      k.pauseBis = sim.zeit + sim.zufall.zwischen(S.salvePause[0], S.salvePause[1]) * (dist < 8 ? 0.35 : 1);
    }
  }

  /* ------------------------------------------------------ Nachladen */
  if (w.laden <= 0 && w.reserve > 0) {
    if (w.magazin === 0) bef.tasten |= T_NACHLADEN;
    else if (!kampf && sim.zeit - k.zielGesehen > 1.5 && w.magazin <= w.def.magazin * 0.5) bef.tasten |= T_NACHLADEN;
  }
}
