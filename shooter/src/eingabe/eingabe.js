/* ------------------------------------------------------------------
   Gemeinsamer Eingabezustand.

   Tastatur/Maus und Touch schreiben hier hinein, die Hauptschleife holt
   pro Simulationsschritt genau einen Befehl ab. Einmal-Aktionen
   (Springen, Nachladen) werden gemerkt, bis ein Schritt sie abholt - so
   geht kein Tipp verloren, und keiner wird doppelt ausgefuehrt.

   Der Blick (yaw/pitch) wird sofort bei jedem Eingabeereignis
   veraendert, nicht erst im naechsten Simulationsschritt: die Kamera
   folgt dem Finger bzw. der Maus ohne Verzoegerung.
   ------------------------------------------------------------------ */

import { T_DUCKEN, T_FEUER, T_NACHLADEN, T_SPRINGEN, T_SPRINT, T_VISIER } from '../sim/befehl.js';
import { GRAD, klemme } from '../sim/mathe.js';

const PITCH_MAX = 86 * GRAD;

export class Eingabe {
  constructor(einst) {
    this.einst = einst;
    this.yaw = 0;
    this.pitch = 0;
    this.modus = 'maus';

    // Tastatur und Maus
    this.tasten = new Set();
    this.mausFeuer = false;
    this.mausVisier = false;

    // Touch (von touch.js gesetzt)
    this.stickX = 0;
    this.stickY = 0;
    this.stickSprint = false;
    this.feuerFinger = 0;        // Huefte
    this.visierFeuerFinger = 0;  // zielt beim Schiessen mit (wie Visierfeuer in CoD Mobile)
    this.visierFinger = false;
    this.visierAn = false;

    this.duckt = false;
    this.kanteSprung = false;
    this.kanteLaden = false;
    this.sprintVorher = false;

    // fuer das Nachziehen der Waffe und die Zielhilfe
    this.blickDx = 0;
    this.blickDy = 0;
    this.reibung = 1;          // Zielhilfe: < 1 bremst den Blick nahe am Ziel
    this.visierFaktor = 1;     // kleiner beim Zielen (gezoomtes Sichtfeld)
  }

  /* Blick drehen um Bogenmass (rechts/oben positiv). */
  drehen(dx, dy) {
    this.yaw -= dx;
    this.pitch = klemme(this.pitch - dy, -PITCH_MAX, PITCH_MAX);
    this.blickDx += dx;
    this.blickDy += dy;
  }

  /* Maus: Bewegung in Pixeln. */
  maus(dx, dy) {
    const f = 0.11 * GRAD * this.einst.empfMaus * this.visierFaktor;
    this.drehen(dx * f, dy * f * (this.einst.yUmkehren ? -1 : 1));
  }

  /* Touch: Fingerweg in CSS-Pixeln. */
  touch(dx, dy) {
    const f = 0.24 * GRAD * this.einst.empfTouch * this.visierFaktor * this.reibung;
    this.drehen(dx * f, dy * f * (this.einst.yUmkehren ? -1 : 1));
  }

  blickSetzen(yaw, pitch) {
    this.yaw = yaw;
    this.pitch = pitch;
  }

  springen() {
    this.kanteSprung = true;
    // Aus der Hocke steht man mit der Sprungtaste auf.
    if (this.duckt) this.duckt = false;
  }

  nachladen() {
    this.kanteLaden = true;
  }

  duckenUmschalten() {
    this.duckt = !this.duckt;
  }

  visierUmschalten() {
    this.visierAn = !this.visierAn;
  }

  zielt() {
    return this.mausVisier || this.visierFinger || this.visierAn || this.visierFeuerFinger > 0;
  }

  feuert() {
    return this.mausFeuer || this.feuerFinger > 0 || this.visierFeuerFinger > 0;
  }

  /* Alles loslassen: Fokusverlust, Pause, Drehen des Geraets. */
  alleLoslassen() {
    this.tasten.clear();
    this.mausFeuer = false;
    this.mausVisier = false;
    this.stickX = 0;
    this.stickY = 0;
    this.stickSprint = false;
    this.feuerFinger = 0;
    this.visierFeuerFinger = 0;
    this.visierFinger = false;
    this.kanteSprung = false;
    this.kanteLaden = false;
    this.sprintVorher = false;
  }

  /* Nach dem Spawn: Umschalter zuruecksetzen. */
  neuesLeben(yaw) {
    this.alleLoslassenAusserBewegung();
    this.yaw = yaw;
    this.pitch = 0;
    this.visierAn = false;
    this.duckt = false;
  }

  alleLoslassenAusserBewegung() {
    this.kanteSprung = false;
    this.kanteLaden = false;
  }

  /* Einen Befehl fuer einen Simulationsschritt fuellen. */
  befehl(aus) {
    const t = this.tasten;
    let vor = 0, seit = 0;
    if (t.has('KeyW') || t.has('ArrowUp')) vor += 1;
    if (t.has('KeyS') || t.has('ArrowDown')) vor -= 1;
    if (t.has('KeyD') || t.has('ArrowRight')) seit += 1;
    if (t.has('KeyA') || t.has('ArrowLeft')) seit -= 1;
    vor += this.stickY;
    seit += this.stickX;
    const l = Math.hypot(vor, seit);
    if (l > 1) { vor /= l; seit /= l; }

    const sprint = t.has('ShiftLeft') || t.has('ShiftRight') || this.stickSprint;
    if (sprint && !this.sprintVorher) {
      // Losrennen beendet Hocke und Visier (wie gewohnt aus Shootern).
      this.duckt = false;
      this.visierAn = false;
    }
    this.sprintVorher = sprint;

    let tasten = 0;
    if (this.feuert()) tasten |= T_FEUER;
    if (this.zielt()) tasten |= T_VISIER;
    if (this.duckt) tasten |= T_DUCKEN;
    if (sprint) tasten |= T_SPRINT;
    if (this.kanteSprung) tasten |= T_SPRINGEN;
    if (this.kanteLaden) tasten |= T_NACHLADEN;
    this.kanteSprung = false;
    this.kanteLaden = false;

    aus.yaw = this.yaw;
    aus.pitch = this.pitch;
    aus.vor = vor;
    aus.seit = seit;
    aus.tasten = tasten;
    return aus;
  }

  /* Blickbewegung seit dem letzten Bild (fuer die Waffe), danach null. */
  blickAbholen(aus) {
    aus.dx = this.blickDx;
    aus.dy = this.blickDy;
    this.blickDx = 0;
    this.blickDy = 0;
    return aus;
  }
}
