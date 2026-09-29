/* ------------------------------------------------------------------
   Netzprotokoll des Online-Matches (Geraet <-> Handy-Server).

   Binaer statt JSON: ein Zustand mit sechs Figuren und den Meldungen
   dazwischen sind so ein paar hundert Byte statt mehrerer Kilobyte -
   zwanzigmal pro Sekunde, fuer jeden Spieler. Beide Seiten benutzen
   genau diese Datei.

   Geraet -> Server
     HALLO     Version, Waffe, Name
     EINGABE   Nummer des ersten Befehls, Sichtzeit, 1..n Befehle
     WAFFE     Waffe fuers naechste Leben
     ECHO      Zeitstempel (fuer die Pingzeit)

   Server -> Geraet
     WILLKOMMEN  eigener Platz, aktueller Takt
     VOLL / ALT  Runde voll bzw. Geraet hat einen alten Stand
     ROSTER      wer auf welchem Platz steht (Name, Team, Mensch/Bot)
     ZUSTAND     alle Figuren, Meldungen seit dem letzten Zustand und -
                 nur fuer den Empfaenger - der volle Zustand seiner Figur
                 samt Nummer des letzten verarbeiteten Befehls
     ECHO        der Zeitstempel zurueck

   Befehle werden vor dem Senden gerundet (befehlQuantisieren) - und das
   Geraet rechnet seine Vorhersage mit genau diesem gerundeten Befehl.
   So fuehren Geraet und Server Bit fuer Bit dasselbe aus.
   ------------------------------------------------------------------ */

import { FIGUR, WAFFEN_REIHE } from '../konfig.js';
import { klemme, winkelNorm } from '../sim/mathe.js';

export const VERSION = 1;
export const PFAD = '/api/ops';
export const MAX_MENSCHEN = 6;       // drei gegen drei, Bots fuellen auf
export const ZUSTAND_TAKT = 3;       // alle drei Schritte ein Zustand: 20 pro Sekunde
export const BUENDEL = 2;            // Befehle je Nachricht: 30 Nachrichten pro Sekunde
export const RUECKSPUL_MAX = 15;     // Schuesse werden hoechstens 250 ms zurueckgerechnet
export const RUNDEN_PAUSE = 12;      // Sekunden Auswertung zwischen zwei Runden

export const C_HALLO = 1;
export const C_EINGABE = 2;
export const C_WAFFE = 3;
export const C_ECHO = 4;
export const S_WILLKOMMEN = 10;
export const S_VOLL = 11;
export const S_ALT = 12;
export const S_ROSTER = 13;
export const S_ZUSTAND = 14;
export const S_ECHO = 15;

export const PHASEN = ['vorlauf', 'laeuft', 'ende'];

/* Meldungen, die der Server weitergibt. Nachladen, Patrone, Geladen und
   Leer betreffen nur die eigene Figur - die sagt das Geraet selbst voraus. */
export const MELDUNGEN = [
  'schuss', 'einschlag', 'treffer', 'geschuetzt', 'abschuss', 'assist', 'spawn',
  'schritt', 'sprung', 'landung', 'rutschen', 'start', 'ende', 'schutzEnde',
];
const MELDUNG_NR = new Map(MELDUNGEN.map((t, i) => [t, i]));
export const MAX_MELDUNGEN = 255;

/* Felder der eigenen Figur, die das Geraet zum Abgleich braucht. */
const EIGEN_F64 = ['x', 'y', 'z', 'vx', 'vy', 'vz', 'duckAnteil', 'rutschZeit', 'rutschPause',
  'rutschX', 'rutschZ', 'stufenVersatz', 'luftZeit', 'schrittWeg'];
const WAFFE_F64 = ['abkling', 'laden', 'ladenGesamt', 'visier', 'bloom', 'rueckHoch', 'rueckSeite',
  'sprintAus', 'letzterSchuss'];

const ENC = new TextEncoder();
const DEC = new TextDecoder();

export function waffeNr(id) {
  const i = WAFFEN_REIHE.indexOf(id);
  return i < 0 ? 255 : i;
}

export function waffeVon(nr) {
  return WAFFEN_REIHE[nr] || '';
}

/* ------------------------------------------------------------ Schreiben */

export class Schreiber {
  constructor(groesse) {
    this.puffer = new ArrayBuffer(groesse || 512);
    this.dv = new DataView(this.puffer);
    this.bytes = new Uint8Array(this.puffer);
    this.pos = 0;
  }

  platz(n) {
    if (this.pos + n <= this.puffer.byteLength) return;
    let g = this.puffer.byteLength * 2;
    while (g < this.pos + n) g *= 2;
    const neu = new ArrayBuffer(g);
    new Uint8Array(neu).set(this.bytes.subarray(0, this.pos));
    this.puffer = neu;
    this.dv = new DataView(neu);
    this.bytes = new Uint8Array(neu);
  }

  leeren() { this.pos = 0; return this; }
  u8(v) { this.platz(1); this.dv.setUint8(this.pos, v); this.pos += 1; }
  i8(v) { this.platz(1); this.dv.setInt8(this.pos, v); this.pos += 1; }
  u16(v) { this.platz(2); this.dv.setUint16(this.pos, v); this.pos += 2; }
  i16(v) { this.platz(2); this.dv.setInt16(this.pos, v); this.pos += 2; }
  u32(v) { this.platz(4); this.dv.setUint32(this.pos, v >>> 0); this.pos += 4; }
  f32(v) { this.platz(4); this.dv.setFloat32(this.pos, v); this.pos += 4; }
  f64(v) { this.platz(8); this.dv.setFloat64(this.pos, v); this.pos += 8; }

  text(s) {
    const b = ENC.encode(String(s || ''));
    const n = Math.min(b.length, 255);
    this.u8(n);
    this.platz(n);
    this.bytes.set(b.subarray(0, n), this.pos);
    this.pos += n;
  }

  anhaengen(u8) {
    this.platz(u8.length);
    this.bytes.set(u8, this.pos);
    this.pos += u8.length;
  }

  /* Sicht auf das Geschriebene - gilt nur bis zum naechsten Schreiben. */
  ansicht() { return this.bytes.subarray(0, this.pos); }

  /* Eigene Kopie, darf aufbewahrt werden. */
  kopie() { return this.bytes.slice(0, this.pos); }
}

/* --------------------------------------------------------------- Lesen */

export class Leser {
  constructor(daten) {
    if (daten instanceof ArrayBuffer) this.dv = new DataView(daten);
    else this.dv = new DataView(daten.buffer, daten.byteOffset, daten.byteLength);
    this.pos = 0;
  }

  pruefen(n) {
    if (this.pos + n > this.dv.byteLength) throw new Error('Nachricht zu kurz');
  }

  u8() { this.pruefen(1); const v = this.dv.getUint8(this.pos); this.pos += 1; return v; }
  i8() { this.pruefen(1); const v = this.dv.getInt8(this.pos); this.pos += 1; return v; }
  u16() { this.pruefen(2); const v = this.dv.getUint16(this.pos); this.pos += 2; return v; }
  i16() { this.pruefen(2); const v = this.dv.getInt16(this.pos); this.pos += 2; return v; }
  u32() { this.pruefen(4); const v = this.dv.getUint32(this.pos); this.pos += 4; return v; }
  f32() { this.pruefen(4); const v = this.dv.getFloat32(this.pos); this.pos += 4; return v; }
  f64() { this.pruefen(8); const v = this.dv.getFloat64(this.pos); this.pos += 8; return v; }

  /* Zahl, die endlich sein muss - alles andere ist kaputt oder boeswillig. */
  f32e() { const v = this.f32(); if (!Number.isFinite(v)) throw new Error('Zahl'); return v; }
  f64e() { const v = this.f64(); if (!Number.isFinite(v)) throw new Error('Zahl'); return v; }

  text() {
    const n = this.u8();
    this.pruefen(n);
    const b = new Uint8Array(this.dv.buffer, this.dv.byteOffset + this.pos, n);
    this.pos += n;
    return DEC.decode(b);
  }

  rest() { return this.dv.byteLength - this.pos; }
}

/* ------------------------------------------------------------- Befehle */

export function befehlQuantisieren(b) {
  b.yaw = Math.fround(winkelNorm(b.yaw));
  b.pitch = Math.round(klemme(b.pitch, -1.5, 1.5) * 10000) / 10000;
  b.vor = Math.round(klemme(b.vor, -1, 1) * 127) / 127;
  b.seit = Math.round(klemme(b.seit, -1, 1) * 127) / 127;
  b.tasten &= 63;
  return b;
}

function befehlSchreiben(s, b) {
  s.f32(b.yaw);
  s.i16(Math.round(klemme(b.pitch, -1.5, 1.5) * 10000));
  s.i8(Math.round(klemme(b.vor, -1, 1) * 127));
  s.i8(Math.round(klemme(b.seit, -1, 1) * 127));
  s.u8(b.tasten & 63);
}

export function befehlLesen(l, b) {
  b.yaw = l.f32e();
  if (Math.abs(b.yaw) > 4) throw new Error('Winkel');
  b.pitch = l.i16() / 10000;
  if (Math.abs(b.pitch) > 1.5) throw new Error('Winkel');
  b.vor = l.i8() / 127;
  b.seit = l.i8() / 127;
  b.tasten = l.u8() & 63;
  if (b.vor < -1) b.vor = -1;
  if (b.seit < -1) b.seit = -1;
  return b;
}

/* ---------------------------------------------------- Geraet -> Server */

export function halloSchreiben(s, name, waffe) {
  s.leeren();
  s.u8(C_HALLO);
  s.u16(VERSION);
  s.u8(waffeNr(waffe));
  s.text(name);
  return s.ansicht();
}

/* befehle: Liste von Befehlen, die ersten n werden geschickt. */
export function eingabeSchreiben(s, ersteNr, sicht, befehle, n) {
  s.leeren();
  s.u8(C_EINGABE);
  s.u32(ersteNr);
  s.f32(sicht);
  s.u8(n);
  for (let i = 0; i < n; i++) befehlSchreiben(s, befehle[i]);
  return s.ansicht();
}

export function waffeSchreiben(s, waffe) {
  s.leeren();
  s.u8(C_WAFFE);
  s.u8(waffeNr(waffe));
  return s.ansicht();
}

export function echoSchreiben(s, zeit) {
  s.leeren();
  s.u8(C_ECHO);
  s.f64(zeit);
  return s.ansicht();
}

/* ---------------------------------------------------- Server -> Geraet */

export function willkommenSchreiben(s, eigenId, takt) {
  s.leeren();
  s.u8(S_WILLKOMMEN);
  s.u16(VERSION);
  s.u8(eigenId);
  s.u32(takt);
  return s.ansicht();
}

export function vollSchreiben(s) {
  s.leeren();
  s.u8(S_VOLL);
  return s.ansicht();
}

export function altSchreiben(s) {
  s.leeren();
  s.u8(S_ALT);
  s.u16(VERSION);
  return s.ansicht();
}

export function echoAntwort(s, zeit) {
  s.leeren();
  s.u8(S_ECHO);
  s.f64(zeit);
  return s.ansicht();
}

export function rosterSchreiben(s, eigenId, akteure) {
  s.leeren();
  s.u8(S_ROSTER);
  s.u8(eigenId);
  s.u8(akteure.length);
  for (const a of akteure) {
    s.u8(a.id);
    s.u8(a.team);
    s.u8(a.bot ? 0 : 1);
    s.text(a.name);
  }
  return s.ansicht();
}

export function rosterLesen(l, aus) {
  aus.eigenId = l.u8();
  const n = l.u8();
  aus.plaetze.length = 0;
  for (let i = 0; i < n; i++) {
    aus.plaetze.push({ id: l.u8(), team: l.u8(), mensch: l.u8() === 1, name: l.text() });
  }
  return aus;
}

/* Kopf und Figuren eines Zustands - fuer alle Empfaenger gleich. */
export function zustandKopfSchreiben(s, sim, takt) {
  s.u8(S_ZUSTAND);
  s.u32(takt);
  s.u16(sim.runde & 0xffff);
  s.u8(Math.max(0, PHASEN.indexOf(sim.phase)));
  s.f32(sim.phasenZeit);
  s.f32(sim.restzeit);
  s.u8(Math.min(255, sim.punkte[0]));
  s.u8(Math.min(255, sim.punkte[1]));
  s.i8(sim.sieger);
  s.u8(Math.min(255, sim.zielPunkte));
  s.u8(sim.akteure.length);
  for (const a of sim.akteure) {
    const w = a.waffe;
    s.u8(a.id);
    s.u8((a.lebt ? 1 : 0) | (a.geduckt ? 2 : 0) | (a.sprintet ? 4 : 0) | (a.amBoden ? 8 : 0)
      | (a.rutschZeit > 0 ? 16 : 0) | (w.laden > 0 ? 32 : 0) | (a.schutz > 0 ? 64 : 0));
    s.u8(a.lebenNr & 255);
    s.f32(a.x);
    s.f32(a.y);
    s.f32(a.z);
    s.i16(Math.round(winkelNorm(a.yaw) * 10000));
    s.i16(Math.round(klemme(a.pitch, -1.5, 1.5) * 10000));
    s.i16(Math.round(klemme(a.vx, -300, 300) * 100));
    s.i16(Math.round(klemme(a.vz, -300, 300) * 100));
    s.u8(Math.round(klemme(a.duckAnteil, 0, 1) * 255));
    s.u8(waffeNr(w.id));
    s.u16(w.schuesse & 0xffff);
    s.u8(Math.round(klemme(a.leben, 0, 255)));
    s.u8(Math.round(klemme(a.schutz, 0, 5) * 50));
    s.u8(Math.round(klemme(w.visier, 0, 1) * 255));
    s.u8(Math.min(255, a.abschuesse));
    s.u8(Math.min(255, a.tode));
    s.u8(Math.min(255, a.assists));
  }
}

/* Eine Meldung der Simulation in den Sammelpuffer. false: nicht fuers Netz. */
export function meldungSchreiben(s, m) {
  const nr = MELDUNG_NR.get(m.typ);
  if (nr === undefined) return false;
  s.u8(nr);
  s.i8(m.a);
  s.i8(m.b);
  s.f32(m.wert);
  s.u8((m.kopf ? 1 : 0) | (m.toedlich ? 2 : 0));
  s.u8(waffeNr(m.waffe));
  s.u8(Math.min(255, m.serie | 0));
  s.f32(m.x);
  s.f32(m.y);
  s.f32(m.z);
  s.i8(Math.round(klemme(m.nx, -1, 1) * 127));
  s.i8(Math.round(klemme(m.ny, -1, 1) * 127));
  s.i8(Math.round(klemme(m.nz, -1, 1) * 127));
  return true;
}

/* Der Teil nur fuer den Empfaenger: seine Figur, voll und genau. */
export function eigenSchreiben(s, a, ack) {
  const w = a.waffe;
  s.u32(ack);
  s.u8(a.id);
  s.u8((a.lebt ? 1 : 0) | (a.amBoden ? 2 : 0) | (a.geduckt ? 4 : 0) | (a.sprintet ? 8 : 0)
    | (w.klickGesperrt ? 16 : 0));
  s.u8(a.tastenVorher & 63);
  s.u8(a.lebenNr & 255);
  for (const k of EIGEN_F64) s.f64(a[k]);
  s.u8(waffeNr(w.id));
  s.u8(w.magazin);
  s.u16(w.reserve);
  s.u8(w.ladenPhase);
  s.u32(w.schuesse);
  for (const k of WAFFE_F64) s.f64(w[k]);
  s.f32(a.leben);
  s.f32(a.schutz);
  s.f32(a.respawnIn);
  s.i8(a.moerder);
  s.u8(waffeNr(a.naechsteWaffe));
  s.u16(Math.min(65535, a.schuesse));
  s.u16(Math.min(65535, a.treffer));
  s.u16(Math.min(65535, a.kopftreffer));
  s.u16(Math.min(65535, a.besteSerie));
}

/* Leeres Zustandsobjekt zum Wiederverwenden (keine Speicherhaeppchen
   pro Nachricht). */
export function neuerZustand() {
  const akteure = [];
  for (let i = 0; i < 6; i++) {
    akteure.push({
      id: 0, lebt: false, geduckt: false, sprintet: false, amBoden: true, rutscht: false, laedt: false,
      schutz: 0, lebenNr: 0, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, vx: 0, vz: 0, duckAnteil: 0,
      waffe: '', schuesse: 0, leben: 0, visier: 0, abschuesse: 0, tode: 0, assists: 0,
    });
  }
  const eigen = { x: 0, y: 0, z: 0, waffe: { } };
  return {
    takt: 0, runde: 0, phase: 'vorlauf', phasenZeit: 0, restzeit: 0, punkte: [0, 0], sieger: -1,
    zielPunkte: 30, n: 0, akteure, meldungen: [], m: 0, ack: 0, eigenId: -1, eigen,
  };
}

function neueMeldung() {
  return { typ: '', a: -1, b: -1, wert: 0, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, kopf: false, toedlich: false, waffe: '', serie: 0 };
}

/* Einen Zustand lesen (der Typ-Byte ist schon gelesen). */
export function zustandLesen(l, z) {
  z.takt = l.u32();
  z.runde = l.u16();
  z.phase = PHASEN[l.u8()] || 'laeuft';
  z.phasenZeit = l.f32();
  z.restzeit = l.f32();
  z.punkte[0] = l.u8();
  z.punkte[1] = l.u8();
  z.sieger = l.i8();
  z.zielPunkte = l.u8();
  const n = l.u8();
  if (n > 6) throw new Error('Figuren');
  z.n = n;
  for (let i = 0; i < n; i++) {
    const r = z.akteure[i];
    r.id = l.u8();
    const f = l.u8();
    r.lebt = (f & 1) !== 0;
    r.geduckt = (f & 2) !== 0;
    r.sprintet = (f & 4) !== 0;
    r.amBoden = (f & 8) !== 0;
    r.rutscht = (f & 16) !== 0;
    r.laedt = (f & 32) !== 0;
    r.lebenNr = l.u8();
    r.x = l.f32();
    r.y = l.f32();
    r.z = l.f32();
    r.yaw = l.i16() / 10000;
    r.pitch = l.i16() / 10000;
    r.vx = l.i16() / 100;
    r.vz = l.i16() / 100;
    r.duckAnteil = l.u8() / 255;
    r.waffe = waffeVon(l.u8());
    r.schuesse = l.u16();
    r.leben = l.u8();
    r.schutz = (f & 64) ? Math.max(0.01, l.u8() / 50) : (l.u8(), 0);
    r.visier = l.u8() / 255;
    r.abschuesse = l.u8();
    r.tode = l.u8();
    r.assists = l.u8();
  }
  const m = l.u8();
  z.m = m;
  for (let i = 0; i < m; i++) {
    const e = z.meldungen[i] || (z.meldungen[i] = neueMeldung());
    e.typ = MELDUNGEN[l.u8()] || '';
    e.a = l.i8();
    e.b = l.i8();
    e.wert = l.f32();
    const bits = l.u8();
    e.kopf = (bits & 1) !== 0;
    e.toedlich = (bits & 2) !== 0;
    e.waffe = waffeVon(l.u8());
    e.serie = l.u8();
    e.x = l.f32();
    e.y = l.f32();
    e.z = l.f32();
    e.nx = l.i8() / 127;
    e.ny = l.i8() / 127;
    e.nz = l.i8() / 127;
  }
  z.ack = l.u32();
  const E = z.eigen;
  z.eigenId = l.u8();
  const f = l.u8();
  E.lebt = (f & 1) !== 0;
  E.amBoden = (f & 2) !== 0;
  E.geduckt = (f & 4) !== 0;
  E.sprintet = (f & 8) !== 0;
  E.klickGesperrt = (f & 16) !== 0;
  E.tastenVorher = l.u8();
  E.lebenNr = l.u8();
  for (const k of EIGEN_F64) E[k] = l.f64();
  const W = E.waffe;
  W.id = waffeVon(l.u8());
  W.magazin = l.u8();
  W.reserve = l.u16();
  W.ladenPhase = l.u8();
  W.schuesse = l.u32();
  for (const k of WAFFE_F64) W[k] = l.f64();
  E.leben = l.f32();
  E.schutz = l.f32();
  E.respawnIn = l.f32();
  E.moerder = l.i8();
  E.naechsteWaffe = waffeVon(l.u8());
  E.schuesse = l.u16();
  E.treffer = l.u16();
  E.kopftreffer = l.u16();
  E.besteSerie = l.u16();
  return z;
}

/* Den gelesenen Zustand der eigenen Figur uebernehmen (Vorhersage setzt
   hier neu auf und rechnet die noch offenen Befehle nach). */
export function eigenUebernehmen(E, a) {
  a.lebt = E.lebt;
  a.amBoden = E.amBoden;
  a.geduckt = E.geduckt;
  a.hoehe = E.geduckt ? FIGUR.hoeheGeduckt : FIGUR.hoehe;
  a.sprintet = E.sprintet;
  a.tastenVorher = E.tastenVorher;
  a.lebenNr = E.lebenNr;
  for (const k of EIGEN_F64) a[k] = E[k];
  const w = a.waffe;
  w.magazin = E.waffe.magazin;
  w.reserve = E.waffe.reserve;
  w.ladenPhase = E.waffe.ladenPhase;
  w.schuesse = E.waffe.schuesse;
  w.klickGesperrt = E.klickGesperrt;
  for (const k of WAFFE_F64) w[k] = E.waffe[k];
}
