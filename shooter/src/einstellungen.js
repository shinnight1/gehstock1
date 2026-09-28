/* ------------------------------------------------------------------
   Einstellungen und Statistik von Gehstock Ops.

   Eigene Schluessel im localStorage (gehstock-ops:...), getrennt von
   allem, was die Hideout-Seite speichert - deren Spielstaende fasst der
   Shooter nicht an. Ist Speichern nicht moeglich (privates Fenster),
   laeuft das Spiel mit den Standardwerten weiter.
   ------------------------------------------------------------------ */

import { BOT_REIHE, QUALITAET_REIHE, WAFFEN_REIHE } from './konfig.js';

const SCHLUESSEL = 'gehstock-ops:einstellungen:v1';
const STATISTIK = 'gehstock-ops:statistik:v1';

function touchGeraet() {
  try {
    return (navigator.maxTouchPoints || 0) > 0 && window.matchMedia('(pointer: coarse)').matches;
  } catch (e) {
    return false;
  }
}

export function standard() {
  const touch = touchGeraet();
  return {
    empfTouch: 1.0,          // Faktor auf die Blickgeschwindigkeit
    empfMaus: 1.0,
    empfVisier: 0.8,         // zusaetzlicher Faktor im Visier
    yUmkehren: false,
    zielhilfe: true,         // nur bei Touch wirksam
    visierModus: 'umschalten', // Touch: 'umschalten' oder 'halten'
    linkerFeuerknopf: true,
    knopfGroesse: 1.0,
    lautstaerke: 0.8,
    qualitaet: touch ? 'mittel' : 'hoch',
    dynamisch: true,
    fps: false,
    sichtfeld: 66,           // senkrecht; auf dem iPad quer rund 85° waagerecht
    schwierigkeit: 'normal',
    waffe: 'sturmgewehr',
    hilfeGesehen: false,
  };
}

const ZAHLEN = { empfTouch: [0.3, 3], empfMaus: [0.2, 4], empfVisier: [0.3, 1.5], lautstaerke: [0, 1], sichtfeld: [55, 80], knopfGroesse: [0.75, 1.35] };

export function einstellungenLaden() {
  const s = standard();
  try {
    const roh = JSON.parse(localStorage.getItem(SCHLUESSEL) || 'null');
    if (roh && typeof roh === 'object') {
      for (const k of Object.keys(s)) {
        if (!(k in roh)) continue;
        const v = roh[k];
        if (ZAHLEN[k]) {
          if (typeof v === 'number' && isFinite(v)) s[k] = Math.max(ZAHLEN[k][0], Math.min(ZAHLEN[k][1], v));
        } else if (typeof s[k] === 'boolean') {
          if (typeof v === 'boolean') s[k] = v;
        } else if (k === 'qualitaet') {
          if (QUALITAET_REIHE.indexOf(v) >= 0) s[k] = v;
        } else if (k === 'schwierigkeit') {
          if (BOT_REIHE.indexOf(v) >= 0) s[k] = v;
        } else if (k === 'waffe') {
          if (WAFFEN_REIHE.indexOf(v) >= 0) s[k] = v;
        } else if (k === 'visierModus') {
          if (v === 'umschalten' || v === 'halten') s[k] = v;
        }
      }
    }
  } catch (e) { /* Standardwerte */ }
  return s;
}

export function einstellungenSpeichern(e) {
  try {
    localStorage.setItem(SCHLUESSEL, JSON.stringify(e));
  } catch (err) { /* nicht speicherbar - egal */ }
}

export function statistikLaden() {
  const s = { matches: 0, siege: 0, niederlagen: 0, unentschieden: 0, abschuesse: 0, tode: 0, besteSerie: 0, meisteAbschuesse: 0 };
  try {
    const roh = JSON.parse(localStorage.getItem(STATISTIK) || 'null');
    if (roh && typeof roh === 'object') {
      for (const k of Object.keys(s)) if (typeof roh[k] === 'number' && isFinite(roh[k])) s[k] = Math.max(0, Math.floor(roh[k]));
    }
  } catch (e) { /* leer */ }
  return s;
}

export function statistikSpeichern(s) {
  try {
    localStorage.setItem(STATISTIK, JSON.stringify(s));
  } catch (e) { /* egal */ }
}
