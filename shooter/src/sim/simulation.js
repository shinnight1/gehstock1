/* ------------------------------------------------------------------
   Die Simulation eines Team-Deathmatch.

   Sie kennt keine Grafik, keinen Ton und keine Eingabegeraete. Sie
   bekommt pro Schritt einen Befehl je Figur (Spieler: von der Eingabe,
   Bots: von der KI), rechnet einen festen Zeitschritt und meldet, was
   passiert ist (Schuss, Treffer, Abschuss, Schritt ...). Darstellung und
   Ton lesen nur den Zustand und diese Meldungen.

   Damit laeuft dieselbe Simulation im Browser, in den Tests unter Node
   und spaeter auf einem Server, der Mehrspieler-Matches verbindlich
   rechnet (siehe shooter/README.md).
   ------------------------------------------------------------------ */

import { BOT_STUFEN, FIGUR, LEBEN, MATCH, NAMEN, WAFFEN_REIHE } from '../konfig.js';
import { neuerBefehl } from './befehl.js';
import { augenhoehe, bewegeFigur, schiebeWaagerecht } from './bewegung.js';
import { GRAD, kegelRichtung, klemme, zufallsquelle } from './mathe.js';
import { schadenBerechnen, strahlFigur, ZONE_KOPF } from './treffer.js';
import { neueWaffe, nachSchuss, streuungBerechnen, waffeAuffuellen, waffeTick } from './waffen.js';
import { botGespawnt, botGetroffen, botsHoeren, denkeBots, neueKi } from './bots.js';

const RICHTUNG = { x: 0, y: 0, z: 0 };
const ZONE = { zone: 0 };
const STILL = neuerBefehl();

function neuerAkteur(id, name, team, bot, waffe, anzahl) {
  return {
    id, name, team, bot,
    x: 0, y: 0, z: 0, px: 0, py: 0, pz: 0,
    vx: 0, vy: 0, vz: 0,
    yaw: 0, pitch: 0, pyaw: 0, ppitch: 0,
    amBoden: true, geduckt: false, hoehe: FIGUR.hoehe, duckAnteil: 0,
    rutschZeit: 0, rutschPause: 0, rutschX: 0, rutschZ: 0, rutschtNeu: false,
    sprintet: false, stufenVersatz: 0, luftZeit: 0,
    landung: 0, gesprungen: false, schritt: false, schrittWeg: 0,
    tastenVorher: 0,
    lebt: false, leben: LEBEN.max, letzterTreffer: -99,
    respawnIn: 0, schutz: 0, todesZeit: -99, spawnZeit: -99, moerder: -1,
    waffe: neueWaffe(waffe), naechsteWaffe: waffe,
    befehl: neuerBefehl(),
    abschuesse: 0, tode: 0, assists: 0, serie: 0, besteSerie: 0,
    schuesse: 0, treffer: 0, kopftreffer: 0,
    schadenVon: new Float32Array(anzahl),
    schadenZeit: new Float32Array(anzahl).fill(-99),
    getroffenZeit: -99, getroffenVon: -1,
    ki: null,
  };
}

export class Simulation {
  /* o: { karte, welt, nav, seed, schwierigkeit, spielerWaffe,
          nurBots, dauer, zielPunkte, ohneVorlauf } */
  constructor(o) {
    this.karte = o.karte;
    this.welt = o.welt;
    this.nav = o.nav;
    this.zufall = zufallsquelle((o.seed >>> 0) || 1);
    this.stufe = BOT_STUFEN[o.schwierigkeit] || BOT_STUFEN.normal;
    this.zeit = 0;
    this.phase = o.ohneVorlauf ? 'laeuft' : 'vorlauf';
    this.phasenZeit = o.ohneVorlauf ? 0 : MATCH.vorlauf;
    this.dauer = o.dauer || MATCH.dauer;
    this.restzeit = this.dauer;
    this.zielPunkte = o.zielPunkte || MATCH.zielPunkte;
    this.punkte = [0, 0];
    this.sieger = -1;
    this.meldungen = [];
    this.pool = [];
    this.planBudget = 0;
    this.akteure = [];
    this.spieler = null;
    this.schrotSchaden = new Float32Array(6);
    this.schrotZone = new Uint8Array(6);
    this.schrotPunkt = new Float32Array(18);

    const waffeZufall = () => {
      const r = this.zufall();
      return r < 0.45 ? 'sturmgewehr' : r < 0.8 ? 'mp' : 'schrotflinte';
    };
    const plaetze = [];
    if (o.nurBots) plaetze.push([0, 'Luchs', 0, true]);
    else plaetze.push([0, 'Du', 0, false]);
    plaetze.push([1, NAMEN.verbuendete[0], 0, true]);
    plaetze.push([2, NAMEN.verbuendete[1], 0, true]);
    plaetze.push([3, NAMEN.gegner[0], 1, true]);
    plaetze.push([4, NAMEN.gegner[1], 1, true]);
    plaetze.push([5, NAMEN.gegner[2], 1, true]);
    for (const [id, name, team, bot] of plaetze) {
      const waffe = bot ? waffeZufall() : (WAFFEN_REIHE.indexOf(o.spielerWaffe) >= 0 ? o.spielerWaffe : 'sturmgewehr');
      const a = neuerAkteur(id, name, team, bot, waffe, plaetze.length);
      if (bot) a.ki = neueKi(this, a);
      this.akteure.push(a);
    }
    if (!o.nurBots) this.spieler = this.akteure[0];
    for (const a of this.akteure) this.spawnen(a);
  }

  /* ------------------------------------------------------ Meldungen */

  melden(typ, a, b, wert) {
    let m = this.pool[this.meldungen.length];
    if (!m) {
      m = { typ: '', a: -1, b: -1, wert: 0, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, kopf: false, toedlich: false, waffe: '', serie: 0 };
      this.pool.push(m);
    }
    m.typ = typ;
    m.a = a;
    m.b = b;
    m.wert = wert;
    m.x = 0; m.y = 0; m.z = 0;
    m.nx = 0; m.ny = 0; m.nz = 0;
    m.kopf = false;
    m.toedlich = false;
    m.waffe = '';
    m.serie = 0;
    this.meldungen.push(m);
    return m;
  }

  /* Die Objekte werden wiederverwendet - wer sie liest, muss vorher
     fertig sein. */
  meldungenLeeren() {
    this.meldungen.length = 0;
  }

  /* ---------------------------------------------------------- Ablauf */

  schritt(dt) {
    this.zeit += dt;
    if (this.phase === 'vorlauf') {
      this.phasenZeit -= dt;
      if (this.phasenZeit <= 0) {
        this.phase = 'laeuft';
        this.melden('start', -1, -1, 0);
      }
    } else if (this.phase === 'laeuft') {
      this.restzeit -= dt;
      if (this.restzeit <= 0) {
        this.restzeit = 0;
        this.beenden();
      }
    } else {
      this.phasenZeit -= dt;
    }

    this.planBudget = 2;
    if (this.phase !== 'ende') denkeBots(this, dt);

    const laeuft = this.phase === 'laeuft';
    for (const a of this.akteure) {
      a.px = a.x; a.py = a.y; a.pz = a.z;
      a.pyaw = a.yaw; a.ppitch = a.pitch;
      if (!a.lebt) {
        if (this.phase !== 'ende') {
          a.respawnIn -= dt;
          if (a.respawnIn <= 0) this.spawnen(a);
        }
        continue;
      }
      let bef = a.befehl;
      if (!laeuft) {
        STILL.yaw = bef.yaw;
        STILL.pitch = bef.pitch;
        STILL.tasten = 0;
        bef = STILL;
      }
      a.yaw = bef.yaw;
      a.pitch = klemme(bef.pitch, -1.5, 1.5);
      const neu = bef.tasten & ~a.tastenVorher;
      waffeTick(this, a, bef.tasten, neu, dt, laeuft);
      bewegeFigur(this.welt, a, bef, dt, a.waffe, neu);
      a.tastenVorher = bef.tasten;

      if (a.gesprungen) { a.gesprungen = false; this.melden('sprung', a.id, -1, 0); }
      if (a.landung) { this.melden('landung', a.id, -1, a.landung); a.landung = 0; }
      if (a.schritt) {
        a.schritt = false;
        this.melden('schritt', a.id, -1, a.sprintet ? 1 : a.geduckt ? 0.35 : 0.65);
      }
      if (a.rutschtNeu) { a.rutschtNeu = false; this.melden('rutschen', a.id, -1, 0); }
      if (a.schutz > 0) a.schutz = Math.max(0, a.schutz - dt);
      if (a.leben < LEBEN.max && this.zeit - a.letzterTreffer >= LEBEN.regenPause) {
        a.leben = Math.min(LEBEN.max, a.leben + LEBEN.regenRate * dt);
      }
      // Sicherheitsnetz: wer aus der Welt faellt, kommt neu herein.
      if (a.y < -6 || !Number.isFinite(a.x + a.y + a.z)) this.spawnen(a);
    }
    this.trennen();
  }

  beenden() {
    if (this.phase === 'ende') return;
    this.phase = 'ende';
    this.phasenZeit = MATCH.endePause;
    this.sieger = this.punkte[0] > this.punkte[1] ? 0 : this.punkte[1] > this.punkte[0] ? 1 : -1;
    for (const a of this.akteure) {
      a.befehl.tasten = 0;
      a.befehl.vor = 0;
      a.befehl.seit = 0;
    }
    this.melden('ende', -1, -1, this.sieger);
  }

  /* Figuren schieben sich weich auseinander, statt ineinander zu
     stehen. Geschoben wird mit Kollision - niemand landet in einer Wand. */
  trennen() {
    const A = this.akteure;
    const min = FIGUR.radius * 1.9;
    for (let i = 0; i < A.length; i++) {
      const a = A[i];
      if (!a.lebt) continue;
      for (let j = i + 1; j < A.length; j++) {
        const b = A[j];
        if (!b.lebt) continue;
        if (a.y >= b.y + b.hoehe || b.y >= a.y + a.hoehe) continue;
        let dx = b.x - a.x, dz = b.z - a.z;
        let d = Math.hypot(dx, dz);
        if (d >= min) continue;
        if (d < 1e-4) { dx = 1; dz = 0; d = 1; }
        const schub = (min - d) * 0.5;
        schiebeWaagerecht(this.welt, a, -dx / d * schub, -dz / d * schub);
        schiebeWaagerecht(this.welt, b, dx / d * schub, dz / d * schub);
      }
    }
  }

  /* ---------------------------------------------------------- Spawns */

  spawnPunkt(a) {
    const liste = this.karte.spawns[a.team];
    let best = liste[0];
    let bestWert = -Infinity;
    for (const p of liste) {
      let wert = this.zufall() * 6;
      let naechsterFeind = 60;
      let gesehen = false;
      for (const e of this.akteure) {
        if (e === a || !e.lebt) continue;
        const d = Math.hypot(e.x - p.x, e.z - p.z);
        if (e.team !== a.team) {
          if (d < naechsterFeind) naechsterFeind = d;
          if (d < 55 && this.welt.sichtFrei(e.x, e.y + augenhoehe(e), e.z, p.x, p.y + 1.5, p.z)) gesehen = true;
        } else {
          if (d < 1.4) wert -= 100;
          else if (d < 12) wert += 2;
        }
      }
      wert += naechsterFeind;
      if (gesehen) wert -= 35;
      if (wert > bestWert) {
        bestWert = wert;
        best = p;
      }
    }
    return best;
  }

  spawnen(a) {
    const p = this.spawnPunkt(a);
    a.x = a.px = p.x;
    a.y = a.py = p.y;
    a.z = a.pz = p.z;
    a.vx = 0; a.vy = 0; a.vz = 0;
    a.yaw = a.pyaw = p.yaw;
    a.pitch = a.ppitch = 0;
    a.befehl.yaw = p.yaw;
    a.befehl.pitch = 0;
    a.befehl.tasten = 0;
    a.befehl.vor = 0;
    a.befehl.seit = 0;
    a.amBoden = true;
    a.geduckt = false;
    a.hoehe = FIGUR.hoehe;
    a.duckAnteil = 0;
    a.rutschZeit = 0;
    a.rutschPause = 0;
    a.sprintet = false;
    a.stufenVersatz = 0;
    a.luftZeit = 0;
    a.tastenVorher = 0;
    a.lebt = true;
    a.leben = LEBEN.max;
    a.letzterTreffer = -99;
    a.schutz = MATCH.spawnSchutz;
    a.spawnZeit = this.zeit;
    a.schadenVon.fill(0);
    if (a.naechsteWaffe && a.naechsteWaffe !== a.waffe.id) a.waffe = neueWaffe(a.naechsteWaffe);
    else waffeAuffuellen(a.waffe);
    if (a.ki) botGespawnt(this, a);
    this.melden('spawn', a.id, -1, 0);
  }

  /* ---------------------------------------------------------- Schuss */

  /* Ein Schuss (bei Schrot: alle Kugeln). Wird von waffeTick gerufen. */
  schiessen(a, w) {
    const def = w.def;
    if (a.schutz > 0) {
      a.schutz = 0;
      this.melden('schutzEnde', a.id, -1, 0);
    }
    a.schuesse++;
    const augeY = a.y + augenhoehe(a);
    const yaw = a.yaw + w.rueckSeite * GRAD;
    const pitch = klemme(a.pitch + w.rueckHoch * GRAD, -1.55, 1.55);
    let streu = streuungBerechnen(a, w);
    if (a.ki) streu *= this.stufe.streuung;
    const streuRad = streu * GRAD;

    const schuss = this.melden('schuss', a.id, -1, 0);
    schuss.waffe = def.id;
    const n = def.kugeln;
    const sammeln = n > 1;
    if (sammeln) {
      this.schrotSchaden.fill(0);
      this.schrotZone.fill(0);
    }
    let getroffen = false;
    let kopf = false;
    for (let k = 0; k < n; k++) {
      let winkel, phi;
      if (n > 1) {
        // Schrot: ein festes Muster aus Ring und Mitte, leicht verwackelt.
        if (k === 0) {
          winkel = streuRad * 0.12 * this.zufall();
          phi = this.zufall() * Math.PI * 2;
        } else {
          phi = ((k - 1) / (n - 1)) * Math.PI * 2 + this.zufall.zwischen(-0.35, 0.35);
          winkel = streuRad * this.zufall.zwischen(0.45, 1);
        }
      } else {
        winkel = streuRad * Math.sqrt(this.zufall());
        phi = this.zufall() * Math.PI * 2;
      }
      kegelRichtung(yaw, pitch, winkel, phi, RICHTUNG);
      const erg = this.strahl(a, a.x, augeY, a.z, RICHTUNG.x, RICHTUNG.y, RICHTUNG.z, def.reichweite.max);
      const hx = a.x + RICHTUNG.x * erg.t;
      const hy = augeY + RICHTUNG.y * erg.t;
      const hz = a.z + RICHTUNG.z * erg.t;
      if (k === 0) {
        schuss.x = hx; schuss.y = hy; schuss.z = hz;
      }
      if (erg.ziel) {
        getroffen = true;
        const s = schadenBerechnen(def, erg.t, erg.zone);
        if (erg.zone === ZONE_KOPF) kopf = true;
        if (sammeln) {
          const id = erg.ziel.id;
          this.schrotSchaden[id] += s;
          if (erg.zone === ZONE_KOPF || !this.schrotZone[id]) this.schrotZone[id] = erg.zone;
          this.schrotPunkt[id * 3] = hx;
          this.schrotPunkt[id * 3 + 1] = hy;
          this.schrotPunkt[id * 3 + 2] = hz;
        } else {
          this.schaden(erg.ziel, s, a, erg.zone, hx, hy, hz, def.id);
        }
      } else if (erg.t < def.reichweite.max) {
        const e = this.melden('einschlag', a.id, -1, 0);
        e.x = hx; e.y = hy; e.z = hz;
        e.nx = this.welt.nx; e.ny = this.welt.ny; e.nz = this.welt.nz;
        e.waffe = def.id;
      }
    }
    if (sammeln) {
      for (const b of this.akteure) {
        const s = this.schrotSchaden[b.id];
        if (s > 0) {
          const o = b.id * 3;
          this.schaden(b, s, a, this.schrotZone[b.id], this.schrotPunkt[o], this.schrotPunkt[o + 1], this.schrotPunkt[o + 2], def.id);
        }
      }
    }
    if (getroffen) a.treffer++;
    if (kopf) a.kopftreffer++;
    nachSchuss(this, w);
    botsHoeren(this, a, def.hoerweite);
  }

  /* Strahl gegen Welt und gegnerische Figuren. Verbuendete stehen
     nicht im Weg: es gibt kein Eigenfeuer. */
  strahl(a, ox, oy, oz, dx, dy, dz, maxT) {
    const erg = this._erg || (this._erg = { t: 0, ziel: null, zone: 0 });
    let t = this.welt.strahl(ox, oy, oz, dx, dy, dz, maxT);
    erg.ziel = null;
    erg.zone = 0;
    const ix = dx !== 0 ? 1 / dx : 1e30;
    const iy = dy !== 0 ? 1 / dy : 1e30;
    const iz = dz !== 0 ? 1 / dz : 1e30;
    for (const b of this.akteure) {
      if (b === a || !b.lebt || b.team === a.team) continue;
      // Grobtest: Kugel um die Figur
      const cx = b.x - ox, cy = b.y + b.hoehe * 0.5 - oy, cz = b.z - oz;
      const tca = cx * dx + cy * dy + cz * dz;
      if (tca < -1.2 || tca > t + 1.2) continue;
      const d2 = cx * cx + cy * cy + cz * cz - tca * tca;
      if (d2 > 1.3) continue;
      const tb = strahlFigur(b, ox, oy, oz, ix, iy, iz, t, ZONE);
      if (tb < t) {
        t = tb;
        erg.ziel = b;
        erg.zone = ZONE.zone;
      }
    }
    erg.t = t;
    return erg;
  }

  schaden(ziel, betrag, taeter, zone, x, y, z, waffe) {
    if (!ziel.lebt || this.phase !== 'laeuft') return;
    if (ziel.schutz > 0) {
      const m = this.melden('geschuetzt', taeter.id, ziel.id, 0);
      m.x = x; m.y = y; m.z = z;
      return;
    }
    ziel.leben -= betrag;
    ziel.letzterTreffer = this.zeit;
    ziel.getroffenZeit = this.zeit;
    ziel.getroffenVon = taeter.id;
    ziel.schadenVon[taeter.id] += betrag;
    ziel.schadenZeit[taeter.id] = this.zeit;
    const m = this.melden('treffer', taeter.id, ziel.id, betrag);
    m.kopf = zone === ZONE_KOPF;
    m.x = x; m.y = y; m.z = z;
    m.waffe = waffe;
    if (ziel.ki) botGetroffen(this, ziel, taeter);
    if (ziel.leben <= 0) {
      m.toedlich = true;
      this.toeten(ziel, taeter, zone === ZONE_KOPF, waffe);
    }
  }

  toeten(opfer, taeter, kopf, waffe) {
    opfer.lebt = false;
    opfer.leben = 0;
    opfer.tode++;
    opfer.serie = 0;
    opfer.respawnIn = MATCH.respawn;
    opfer.todesZeit = this.zeit;
    opfer.moerder = taeter ? taeter.id : -1;
    opfer.sprintet = false;
    if (taeter && taeter !== opfer && taeter.team !== opfer.team) {
      taeter.abschuesse++;
      taeter.serie++;
      if (taeter.serie > taeter.besteSerie) taeter.besteSerie = taeter.serie;
      this.punkte[taeter.team]++;
    }
    for (const h of this.akteure) {
      if (h === taeter || h.team === opfer.team) continue;
      if (opfer.schadenVon[h.id] >= MATCH.assistMindestens && this.zeit - opfer.schadenZeit[h.id] <= MATCH.assistFenster) {
        h.assists++;
        this.melden('assist', h.id, opfer.id, 0);
      }
    }
    opfer.schadenVon.fill(0);
    const m = this.melden('abschuss', taeter ? taeter.id : -1, opfer.id, 0);
    m.kopf = kopf;
    m.waffe = waffe || '';
    m.serie = taeter ? taeter.serie : 0;
    m.x = opfer.x; m.y = opfer.y; m.z = opfer.z;
    if (taeter && this.punkte[taeter.team] >= this.zielPunkte) this.beenden();
  }

  /* Waffe fuer das naechste Leben (Spieler waehlt im Todesbildschirm). */
  waffeWaehlen(a, id) {
    if (WAFFEN_REIHE.indexOf(id) >= 0) a.naechsteWaffe = id;
  }
}
