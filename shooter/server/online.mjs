/* ------------------------------------------------------------------
   Das Online-Match von Gehstock Ops - laeuft im Handy-Server mit.

   Es gibt genau eine Runde. Wer "Online" drueckt, kommt hinein: ins Team
   mit weniger Menschen (bei Gleichstand ins zurueckliegende), auf den
   Platz eines Bots. Bots fuellen immer auf drei gegen drei auf; hoechstens
   sechs Menschen passen hinein. Wer geht, wird wieder zum Bot. Runden
   laufen ohne Pause durch: fuenf Minuten oder 30 Punkte, zwoelf Sekunden
   Auswertung, dann die naechste - mit Teamausgleich, falls inzwischen
   zwei Menschen mehr in einem Team stehen.

   Der Server rechnet verbindlich (autoritativ): Treffer, Schaden und
   Abschuesse entscheidet nur er. Die Geraete schicken Befehle, der
   Server schickt 20-mal pro Sekunde den Zustand. Befehle eines Menschen
   rechnet er, sobald sie ankommen (fernSchritt), mit derselben Funktion,
   mit der das Geraet seine Figur vorhersagt. Schuesse rechnet er dort,
   wo der Schuetze seine Gegner gesehen hat (hoechstens 250 ms zurueck).

   Nichts davon landet in Redis: das Match lebt nur im Arbeitsspeicher.
   Ohne Spieler steht der Takt still - dann kostet das Match nichts.

   Mobilfunk und WLAN haben Aussetzer von mehreren Sekunden; danach kommt
   alles Aufgestaute auf einmal. Das ist kein Angriff: Nachrichten
   laufen durch einen Eimer mit reichlich Vorrat, Befehle haben vier
   Sekunden Vorrat. Reisst die Leitung trotzdem ab (Hintergrund,
   Funkloch, Neustart), haelt der Server den Platz samt Punkten eine
   Minute lang frei - das Geraet verbindet sich mit seinem Schluessel
   selbst wieder. Kein Fehler im Online-Teil darf den Server-Prozess
   mitreissen: alles, was von aussen kommt, ist abgefangen.
   ------------------------------------------------------------------ */

import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { TICK } from '../src/konfig.js';
import { kraehenfeld } from '../src/karte/kraehenfeld.js';
import { Welt } from '../src/sim/welt.js';
import { Navigation } from '../src/sim/navigation.js';
import { Simulation } from '../src/sim/simulation.js';
import { neuerBefehl } from '../src/sim/befehl.js';
import {
  altSchreiben, befehlLesen, C_ECHO, C_EINGABE, C_HALLO, C_TSCHUESS, C_WAFFE, echoAntwort, eigenSchreiben,
  Leser, MAX_MELDUNGEN, MAX_MENSCHEN, meldungSchreiben, rosterSchreiben, RUECKSPUL_MAX, RUNDEN_PAUSE,
  Schreiber, VERSION, vollSchreiben, waffeVon, willkommenSchreiben, ZUSTAND_TAKT, zustandKopfSchreiben,
} from '../src/netz/protokoll.js';
import { wsAnnehmen } from './websocket.mjs';

const VERLAUF = 64;                 // gemerkte Schritte fuers Rueckspulen (gut eine Sekunde)
const KONTINGENT_MAX = 240;         // Befehle im Vorrat: vier Sekunden (Aussetzer im Netz)
const NACHRICHTEN_RATE = 70;        // Nachrichten pro Sekunde auf Dauer (ein Geraet schickt gut 30)
const NACHRICHTEN_VORRAT = 900;     // Stau nach einem Aussetzer: bis rund 30 s Nachrichten auf einmal
const RESERVIERUNG = 60000;         // Platz nach einem Abbruch so lange freihalten
const LEER_AUFRAEUMEN = 120000;     // leere Runde nach zwei Minuten wegwerfen

export function nameSaeubern(roh) {
  const s = String(roh || '')
    .replace(/[\u0000-\u001f\u007f-\u009f\u00ad\u200b-\u200f\u2028-\u202e\u2060-\u2069\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return Array.from(s).slice(0, 16).join('') || 'Gast';
}

/* ------------------------------------------------------------ Die Runde */

class Raum {
  /* o: Einstellungen von OpsOnline (Tests verkuerzen damit die Runden) */
  constructor(welt, nav, karte, o) {
    this.log = o.log;
    this.rundenPause = o.rundenPause || RUNDEN_PAUSE;
    this.kontingentMax = o.kontingentMax || KONTINGENT_MAX;
    this.reservierungMs = o.reservierung || RESERVIERUNG;
    this.reserviert = new Map();        // Schluessel -> freigehaltener Platz
    this.befehle = [];
    for (let i = 0; i < 8; i++) this.befehle.push(neuerBefehl());
    this.simFehlerZeit = 0;
    this.sim = new Simulation({
      karte, welt, nav, online: true, schwierigkeit: 'normal',
      dauer: o.dauer, zielPunkte: o.zielPunkte, ohneVorlauf: o.ohneVorlauf,
      seed: o.seed || (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0,
    });
    this.sim.rueckspulen = (a, an) => this.rueckspulen(a, an);
    this.spieler = new Map();           // Platz -> Spieler
    this.takt = 0;
    this.akku = 0;
    this.letzte = performance.now();
    this.endeZeit = -1;
    this.rosterNeu = true;
    this.meldungen = new Schreiber(4096);
    this.meldungenN = 0;
    this.kopf = new Schreiber(1024);
    this.eigen = new Schreiber(512);
    this.schreiber = new Schreiber(256);
    this.verlauf = new Float64Array(VERLAUF * 6 * 5);
    this.verlaufTakt = new Int32Array(VERLAUF).fill(-1);
    this.gespult = [];
    this.gemerkt = new Float64Array(6 * 4);
    this.verlaufMerken();
  }

  menschen() {
    let n = 0;
    for (const a of this.sim.akteure) if (a.fern) n++;
    return n;
  }

  /* Platz fuer einen neuen Menschen: Team mit weniger Menschen, bei
     Gleichstand das zurueckliegende. Plaetze, die fuer jemanden nach
     einem Abbruch freigehalten werden, kommen zuletzt dran. */
  platzFinden() {
    const sim = this.sim;
    const h = [0, 0];
    for (const a of sim.akteure) if (a.fern) h[a.team]++;
    if (h[0] + h[1] >= MAX_MENSCHEN) return null;
    let team;
    if (h[0] !== h[1]) team = h[0] < h[1] ? 0 : 1;
    else if (sim.punkte[0] !== sim.punkte[1]) team = sim.punkte[0] < sim.punkte[1] ? 0 : 1;
    else team = Math.random() < 0.5 ? 0 : 1;
    const frei = new Set();
    const jetzt = Date.now();
    for (const r of this.reserviert.values()) if (r.bis > jetzt) frei.add(r.id);
    const wahl = (liste) => {
      const offen = liste.filter((a) => !frei.has(a.id));
      const aus = offen.length ? offen : liste;
      // Lieber einen Bot, der gerade tot ist - dann verschwindet niemand vor Augen.
      return aus.find((a) => !a.lebt) || aus[0] || null;
    };
    let bots = sim.akteure.filter((a) => !a.fern && a.team === team);
    if (!bots.length || bots.every((a) => frei.has(a.id))) {
      const alle = sim.akteure.filter((a) => !a.fern);
      if (alle.some((a) => !frei.has(a.id))) bots = alle;
    }
    return wahl(bots);
  }

  eindeutig(name) {
    const namen = new Set();
    for (const a of this.sim.akteure) if (a.fern) namen.add(a.name.toLowerCase());
    if (!namen.has(name.toLowerCase())) return name;
    for (let i = 2; i < 10; i++) {
      const n = Array.from(name).slice(0, 13).join('') + ' ' + i;
      if (!namen.has(n.toLowerCase())) return n;
    }
    return name;
  }

  /* schluessel: vom Geraet mitgebracht, wenn es sich nach einem Abbruch
     wieder meldet - dann gibt es den alten Platz samt Punkten zurueck. */
  beitreten(verbindung, name, waffe, schluessel) {
    this.reservierungenAufraeumen();
    let res = schluessel ? this.reserviert.get(schluessel) : null;
    if (!res && schluessel) {
      // Die alte Leitung haengt noch (halb offen): sie weicht der neuen.
      for (const alt of this.spieler.values()) {
        if (alt.schluessel !== schluessel) continue;
        this.verlassen(alt, false, 'neue Leitung');
        res = this.reserviert.get(schluessel);
        if (alt.v.sp === alt) alt.v.sp = null;
        alt.v.ws.schliessen(4003, 'anderswo verbunden');
        break;
      }
    }
    if (res) this.reserviert.delete(schluessel);
    let a = null;
    if (res) {
      const x = this.sim.akteure[res.id];
      if (x && !x.fern) a = x;
    }
    if (!a) a = this.platzFinden();
    if (!a) return null;
    this.sim.menschSetzen(a, this.eindeutig(res ? res.name : name), res && res.naechsteWaffe ? res.naechsteWaffe : waffe);
    if (res && res.runde === this.sim.runde) Object.assign(a, res.werte);
    const sp = {
      v: verbindung, a, ack: 0, kontingent: this.kontingentMax, sicht: this.takt,
      befehl: neuerBefehl(), gedrosselt: 0,
      schluessel: res ? schluessel : crypto.randomBytes(12).toString('base64url'),
    };
    this.spieler.set(a.id, sp);
    this.meldungenSammeln();
    this.rosterNeu = true;
    this.log('Ops: ' + a.name + (res ? ' ist wieder da' : ' spielt mit') + ' (Team ' + (a.team === 0 ? 'Blau' : 'Rot') + ', '
      + this.spieler.size + ' online)');
    return sp;
  }

  /* absichtlich: Tschuess vom Geraet - dann wird nichts freigehalten. */
  verlassen(sp, absichtlich, grund) {
    if (this.spieler.get(sp.a.id) !== sp) return;
    this.spieler.delete(sp.a.id);
    const a = sp.a;
    if (!absichtlich && sp.schluessel) {
      this.reserviert.set(sp.schluessel, {
        id: a.id, name: a.name, naechsteWaffe: a.naechsteWaffe, runde: this.sim.runde,
        bis: Date.now() + this.reservierungMs,
        werte: {
          abschuesse: a.abschuesse, tode: a.tode, assists: a.assists, serie: a.serie, besteSerie: a.besteSerie,
          schuesse: a.schuesse, treffer: a.treffer, kopftreffer: a.kopftreffer,
        },
      });
    }
    const name = a.name || '?';
    this.sim.botSetzen(a);
    this.rosterNeu = true;
    this.log('Ops: ' + name + ' ist raus'
      + (grund ? ' (' + grund + ')' : '') + (absichtlich ? '' : ', Platz eine Minute frei') + ' - ' + this.spieler.size + ' online');
  }

  reservierungenAufraeumen() {
    const jetzt = Date.now();
    for (const [k, r] of this.reserviert) if (r.bis <= jetzt) this.reserviert.delete(k);
  }

  /* Befehle eines Geraets, sofort gerechnet. */
  eingabe(sp, l) {
    const erste = l.u32();
    const sicht = l.f32e();
    const n = l.u8();
    if (n < 1 || n > 8) throw new Error('Befehle');
    // Erst die ganze Nachricht lesen: ein Formfehler wirft hier, bevor
    // irgendetwas gerechnet ist.
    for (let i = 0; i < n; i++) befehlLesen(l, this.befehle[i]);
    sp.sicht = Math.max(this.takt - RUECKSPUL_MAX, Math.min(this.takt, sicht));
    const a = sp.a;
    try {
      for (let i = 0; i < n; i++) {
        const nr = erste + i;
        if (nr <= sp.ack) continue;               // doppelt
        sp.ack = nr;
        // Schneller als die Zeit erlaubt? Dann verfaellt der Befehl - das
        // Geraet merkt es am naechsten Zustand und setzt neu auf.
        if (sp.kontingent < 1) { sp.gedrosselt++; continue; }
        sp.kontingent -= 1;
        a.uhr = nr * TICK;
        this.sim.fernSchritt(a, this.befehle[i]);
      }
    } catch (e) {
      // Ein Fehler der Simulation ist nicht die Schuld des Geraets - melden, weiterspielen.
      this.simFehler(e);
    }
    this.meldungenSammeln();
  }

  simFehler(e) {
    const jetzt = Date.now();
    if (jetzt - this.simFehlerZeit < 10000) return;
    this.simFehlerZeit = jetzt;
    this.log('Ops: Fehler bei einem Befehl: ' + String((e && e.stack) || e).split('\n').slice(0, 4).join(' | '));
  }

  /* --------------------------------------------------------- Takt */

  takten() {
    const jetzt = performance.now();
    let dt = (jetzt - this.letzte) / 1000;
    this.letzte = jetzt;
    if (!(dt >= 0)) dt = 0;
    if (dt > 0.25) dt = 0.25;
    this.akku += dt;
    let n = 0;
    while (this.akku >= TICK && n < 8) {
      this.akku -= TICK;
      n++;
      this.schritt();
    }
    if (n >= 8) this.akku = 0;
  }

  schritt() {
    const sim = this.sim;
    this.takt++;
    for (const sp of this.spieler.values()) {
      if (sp.kontingent < this.kontingentMax) sp.kontingent++;
    }
    sim.schritt(TICK);
    this.meldungenSammeln();
    this.verlaufMerken();
    if (sim.phase === 'ende') {
      if (this.endeZeit < 0) this.endeZeit = 0;
      this.endeZeit += TICK;
      if (this.endeZeit >= this.rundenPause) {
        this.endeZeit = -1;
        this.ausgleichen();
        sim.neueRunde();
        this.meldungenSammeln();
        this.verlaufMerken();
        this.rosterNeu = true;
      }
    }
    if (this.takt % 600 === 0) this.reservierungenAufraeumen();
    if (this.rosterNeu) {
      this.rosterNeu = false;
      for (const sp of this.spieler.values()) {
        sp.v.ws.senden(rosterSchreiben(this.schreiber, sp.a.id, sim.akteure));
      }
    }
    if (this.takt % ZUSTAND_TAKT === 0) this.zustandSenden();
  }

  /* Neue Runde: stehen in einem Team zwei Menschen mehr, wechselt einer
     mit einem Bot die Seite. */
  ausgleichen() {
    const A = this.sim.akteure;
    for (let schutz = 0; schutz < 6; schutz++) {
      const m = [A.filter((a) => a.fern && a.team === 0), A.filter((a) => a.fern && a.team === 1)];
      if (Math.abs(m[0].length - m[1].length) < 2) return;
      const gross = m[0].length > m[1].length ? 0 : 1;
      const bot = A.find((a) => !a.fern && a.team !== gross);
      if (!bot) return;
      const mensch = m[gross][m[gross].length - 1];
      bot.team = gross;
      mensch.team = 1 - gross;
      this.log('Ops: ' + mensch.name + ' wechselt fuer den Ausgleich das Team');
    }
  }

  meldungenSammeln() {
    const sim = this.sim;
    for (const m of sim.meldungen) {
      if (this.meldungenN < MAX_MELDUNGEN && meldungSchreiben(this.meldungen, m)) this.meldungenN++;
    }
    sim.meldungenLeeren();
  }

  zustandSenden() {
    const sim = this.sim;
    const k = this.kopf.leeren();
    const pz = sim.phasenZeit;
    if (sim.phase === 'ende') sim.phasenZeit = Math.max(0, this.rundenPause - this.endeZeit);
    zustandKopfSchreiben(k, sim, this.takt);
    sim.phasenZeit = pz;
    k.u8(this.meldungenN);
    k.anhaengen(this.meldungen.ansicht());
    this.meldungen.leeren();
    this.meldungenN = 0;
    const geteilt = Buffer.from(k.ansicht());
    for (const sp of this.spieler.values()) {
      const e = this.eigen.leeren();
      eigenSchreiben(e, sp.a, sp.ack);
      sp.v.ws.senden(Buffer.concat([geteilt, Buffer.from(e.ansicht())]));
    }
  }

  /* ------------------------------------------------------ Rueckspulen */

  verlaufMerken() {
    const i = this.takt % VERLAUF;
    this.verlaufTakt[i] = this.takt;
    const o = i * 30;
    for (const a of this.sim.akteure) {
      const p = o + a.id * 5;
      this.verlauf[p] = a.x;
      this.verlauf[p + 1] = a.y;
      this.verlauf[p + 2] = a.z;
      this.verlauf[p + 3] = a.hoehe;
      this.verlauf[p + 4] = a.lebt ? a.lebenNr : -1;
    }
  }

  rueckspulen(schuetze, an) {
    if (!an) {
      for (const b of this.gespult) {
        const g = b.id * 4;
        b.x = this.gemerkt[g];
        b.y = this.gemerkt[g + 1];
        b.z = this.gemerkt[g + 2];
        b.hoehe = this.gemerkt[g + 3];
      }
      this.gespult.length = 0;
      return;
    }
    const sp = this.spieler.get(schuetze.id);
    if (!sp || sp.a !== schuetze) return;
    const t = Math.max(this.takt - RUECKSPUL_MAX, Math.min(this.takt, sp.sicht));
    const t0 = Math.floor(t);
    const t1 = Math.min(this.takt, t0 + 1);
    const f = t - t0;
    const i0 = t0 % VERLAUF, i1 = t1 % VERLAUF;
    if (this.verlaufTakt[i0] !== t0 || this.verlaufTakt[i1] !== t1) return;
    for (const b of this.sim.akteure) {
      if (b === schuetze || !b.lebt || b.team === schuetze.team) continue;
      const p0 = i0 * 30 + b.id * 5, p1 = i1 * 30 + b.id * 5;
      const V = this.verlauf;
      // Nur dasselbe Leben zurueckspulen - wer inzwischen neu gespawnt
      // ist, stand damals nicht dort.
      if (V[p0 + 4] !== b.lebenNr || V[p1 + 4] !== b.lebenNr) continue;
      const g = b.id * 4;
      this.gemerkt[g] = b.x;
      this.gemerkt[g + 1] = b.y;
      this.gemerkt[g + 2] = b.z;
      this.gemerkt[g + 3] = b.hoehe;
      b.x = V[p0] + (V[p1] - V[p0]) * f;
      b.y = V[p0 + 1] + (V[p1 + 1] - V[p0 + 1]) * f;
      b.z = V[p0 + 2] + (V[p1 + 2] - V[p0 + 2]) * f;
      b.hoehe = f < 0.5 ? V[p0 + 3] : V[p1 + 3];
      this.gespult.push(b);
    }
  }
}

/* --------------------------------------------------- Server-Anbindung */

export class OpsOnline {
  /* opt: { log, maxVerbindungen } - und fuer Tests: dauer, zielPunkte,
     rundenPause, ohneVorlauf, kontingentMax, nachrichtenRate,
     nachrichtenVorrat, reservierung, seed */
  constructor(opt) {
    const o = opt || {};
    this.o = o;
    this.log = o.log || ((t) => console.log(t));
    this.maxVerbindungen = o.maxVerbindungen || 24;
    this.nachrichtenRate = o.nachrichtenRate || NACHRICHTEN_RATE;
    this.nachrichtenVorrat = o.nachrichtenVorrat || NACHRICHTEN_VORRAT;
    this.verbindungen = new Set();
    this.raum = null;
    this.timer = null;
    this.aufraeumTimer = null;
    this.gebaut = null;
  }

  /* Karte, Kollision und Wegenetz einmal bauen - erst, wenn jemand
     wirklich online spielt. */
  welt() {
    if (!this.gebaut) {
      const karte = kraehenfeld();
      const welt = new Welt(karte.quader.filter((q) => q.kollision));
      const nav = new Navigation(welt, karte.grenzen);
      this.gebaut = { karte, welt, nav };
    }
    return this.gebaut;
  }

  status() {
    const n = this.raum ? this.raum.menschen() : 0;
    return { spieler: n, max: MAX_MENSCHEN, version: VERSION };
  }

  /* Vom HTTP-Server bei "Upgrade: websocket" auf /api/ops gerufen. */
  upgrade(req, socket, head) {
    if (this.verbindungen.size >= this.maxVerbindungen) {
      try { socket.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\nContent-Length: 0\r\n\r\n'); } catch (e) { /* egal */ }
      socket.destroy();
      return;
    }
    const ws = wsAnnehmen(req, socket, head, { maxNachricht: 2048 });
    if (!ws) return;
    const v = { ws, sp: null, eimer: this.nachrichtenVorrat, eimerZeit: Date.now(), absichtlich: false };
    this.verbindungen.add(v);
    ws.beiNachricht = (d) => this.nachricht(v, d);
    ws.beiZu = () => this.weg(v);
    v.halloTimer = setTimeout(() => { if (!v.sp) ws.schliessen(1008, 'kein Hallo'); }, 10000);
    v.halloTimer.unref();
  }

  nachricht(v, daten) {
    // Eimer: fuellt sich mit NACHRICHTEN_RATE pro Sekunde bis zum Vorrat.
    // Nach einem Netzaussetzer darf alles Aufgestaute auf einmal kommen.
    const jetzt = Date.now();
    v.eimer = Math.min(this.nachrichtenVorrat, v.eimer + (jetzt - v.eimerZeit) * this.nachrichtenRate / 1000);
    v.eimerZeit = jetzt;
    if (v.eimer < 1) {
      v.ws.schliessen(1008, 'zu viele Nachrichten');
      return;
    }
    v.eimer -= 1;
    try {
      const l = new Leser(daten);
      const typ = l.u8();
      if (!v.sp) {
        if (typ !== C_HALLO) throw new Error('erst Hallo');
        this.hallo(v, l);
        return;
      }
      const raum = this.raum;
      if (!raum || raum.spieler.get(v.sp.a.id) !== v.sp) {
        v.ws.schliessen(1011, 'Runde weg');
        return;
      }
      if (typ === C_EINGABE) raum.eingabe(v.sp, l);
      else if (typ === C_WAFFE) raum.sim.waffeWaehlen(v.sp.a, waffeVon(l.u8()));
      else if (typ === C_ECHO) v.ws.senden(echoAntwort(raum.schreiber, l.f64()));
      else if (typ === C_TSCHUESS) {
        v.absichtlich = true;
        v.ws.schliessen(1000, 'tschuess');
      } else throw new Error('unbekannt');
    } catch (e) {
      v.ws.schliessen(1008, 'kaputte Nachricht');
    }
  }

  hallo(v, l) {
    const version = l.u16();
    const s = new Schreiber(64);
    if (version !== VERSION) {
      v.ws.senden(altSchreiben(s));
      v.ws.schliessen(4001, 'alter Stand');
      return;
    }
    const waffe = waffeVon(l.u8()) || 'sturmgewehr';
    const name = nameSaeubern(l.text());
    const schluessel = l.rest() > 0 ? l.text().slice(0, 40) : '';
    if (!this.raum) {
      const { karte, welt, nav } = this.welt();
      this.raum = new Raum(welt, nav, karte, { ...this.o, log: this.log });
    }
    const raum = this.raum;
    const sp = raum.beitreten(v, name, waffe, schluessel);
    if (!sp) {
      v.ws.senden(vollSchreiben(s));
      v.ws.schliessen(4002, 'voll');
      return;
    }
    clearTimeout(v.halloTimer);
    v.sp = sp;
    v.ws.senden(willkommenSchreiben(s, sp.a.id, raum.takt, sp.schluessel));
    v.ws.senden(rosterSchreiben(s, sp.a.id, raum.sim.akteure));
    this.laufen();
  }

  weg(v) {
    try {
      this.verbindungen.delete(v);
      clearTimeout(v.halloTimer);
      if (v.sp && this.raum) {
        this.raum.verlassen(v.sp, v.absichtlich, v.ws.grund || 'Leitung weg');
        v.sp = null;
        if (!this.raum.spieler.size) this.anhalten();
      }
    } catch (e) {
      this.log('Ops: Fehler beim Verlassen: ' + String((e && e.stack) || e).split('\n').slice(0, 3).join(' | '));
    }
  }

  laufen() {
    clearTimeout(this.aufraeumTimer);
    this.aufraeumTimer = null;
    if (this.timer) return;
    this.raum.letzte = performance.now();
    this.raum.akku = 0;
    this.timer = setInterval(() => {
      try {
        this.raum.takten();
      } catch (e) {
        this.log('Ops: Fehler in der Runde - neu aufgesetzt: ' + ((e && e.message) || e));
        this.abbrechen();
      }
    }, 16);
  }

  /* Niemand mehr da: Takt aus. Die Runde bleibt kurz liegen, falls
     gleich jemand wiederkommt. */
  anhalten() {
    clearInterval(this.timer);
    this.timer = null;
    clearTimeout(this.aufraeumTimer);
    this.aufraeumTimer = setTimeout(() => {
      if (this.raum && !this.raum.spieler.size) this.raum = null;
    }, LEER_AUFRAEUMEN);
    this.aufraeumTimer.unref();
  }

  abbrechen() {
    clearInterval(this.timer);
    this.timer = null;
    const raum = this.raum;
    this.raum = null;
    if (raum) for (const sp of raum.spieler.values()) sp.v.ws.schliessen(1011, 'Fehler');
  }

  schliessen() {
    clearInterval(this.timer);
    this.timer = null;
    clearTimeout(this.aufraeumTimer);
    for (const v of Array.from(this.verbindungen)) v.ws.schliessen(1001, 'Server startet neu');
    this.verbindungen.clear();
    this.raum = null;
  }
}
