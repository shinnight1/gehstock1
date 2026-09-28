/* ------------------------------------------------------------------
   Tastatur und Maus.

   WASD laufen, Maus umsehen (Pointer Lock), linke Taste schiessen,
   rechte Taste zielen (halten), R nachladen, Shift sprinten, Leertaste
   springen, C ducken (umschalten; im Sprint: rutschen), Tab Tabelle,
   Escape oder P Pause.

   Pointer Lock wird nur nach einem Klick angefordert - so verlangen es
   die Browser. Geht er verloren (Escape, Fensterwechsel), pausiert das
   Spiel. Tasten werden ueber e.code gelesen, also nach Lage auf der
   Tastatur: WASD liegt auf QWERTZ genauso wie auf QWERTY.
   ------------------------------------------------------------------ */

import { WAFFEN_REIHE } from '../konfig.js';

const SPIELTASTEN = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Space', 'ShiftLeft', 'ShiftRight', 'KeyC', 'KeyR', 'Tab', 'KeyP',
]);

export class TastaturMaus {
  constructor(app, eingabe, flaeche) {
    this.app = app;
    this.eingabe = eingabe;
    this.flaeche = flaeche;
    this.aus = [];
    this.letzteBeruehrung = 0;
  }

  an() {
    const reg = (ziel, typ, fn, opt) => {
      ziel.addEventListener(typ, fn, opt);
      this.aus.push(() => ziel.removeEventListener(typ, fn, opt));
    };
    reg(window, 'keydown', (e) => this.taste(e, true));
    reg(window, 'keyup', (e) => this.taste(e, false));
    reg(this.flaeche, 'mousedown', (e) => this.mausTaste(e, true));
    reg(window, 'mouseup', (e) => this.mausTaste(e, false));
    reg(document, 'mousemove', (e) => this.mausBewegt(e));
    reg(this.flaeche, 'contextmenu', (e) => e.preventDefault());
    reg(document, 'pointerlockchange', () => this.sperreGeaendert());
    reg(document, 'pointerlockerror', () => this.app.sperreFehlgeschlagen());
    // Beruehrungen erzeugen in manchen Browsern nachgereichte Mausereignisse.
    reg(window, 'touchstart', () => { this.letzteBeruehrung = performance.now(); }, { passive: true });
  }

  ab() {
    for (const f of this.aus) f();
    this.aus.length = 0;
    this.sperreLoesen();
  }

  gesperrt() {
    return document.pointerLockElement === this.flaeche;
  }

  sperreAnfordern() {
    if (this.gesperrt() || !this.flaeche.requestPointerLock) return;
    try {
      const p = this.flaeche.requestPointerLock();
      if (p && p.catch) p.catch(() => this.app.sperreFehlgeschlagen());
    } catch (e) {
      this.app.sperreFehlgeschlagen();
    }
  }

  sperreLoesen() {
    if (this.gesperrt() && document.exitPointerLock) document.exitPointerLock();
  }

  sperreGeaendert() {
    if (this.gesperrt()) {
      this.eingabe.modus = 'maus';
      this.app.modusGeaendert('maus');
    } else {
      this.eingabe.mausFeuer = false;
      this.eingabe.mausVisier = false;
      this.app.sperreVerloren();
    }
  }

  taste(e, runter) {
    const code = e.code;
    const imSpiel = this.app.zustand === 'spiel';
    if (runter) {
      if (code === 'Escape' || code === 'KeyP') {
        if (!e.repeat) this.app.escape();
        return;
      }
      if (!imSpiel) {
        if (code === 'Tab') e.preventDefault();
        return;
      }
      if (SPIELTASTEN.has(code)) e.preventDefault();
      if (e.repeat) return;
      this.eingabe.tasten.add(code);
      if (code === 'Digit1' || code === 'Digit2' || code === 'Digit3') {
        // Waffe fuers naechste Leben (vor allem im Todesbildschirm)
        this.app.naechsteWaffe(WAFFEN_REIHE[Number(code.slice(5)) - 1]);
        return;
      }
      if (code === 'Space') this.eingabe.springen();
      else if (code === 'KeyR') this.eingabe.nachladen();
      else if (code === 'KeyC') this.eingabe.duckenUmschalten();
      else if (code === 'Tab') this.app.tabelle(true);
    } else {
      this.eingabe.tasten.delete(code);
      if (code === 'Tab') this.app.tabelle(false);
    }
  }

  mausTaste(e, runter) {
    if (performance.now() - this.letzteBeruehrung < 900) return;
    if (runter) {
      if (this.app.zustand !== 'spiel') return;
      this.app.klang.entsperren();
      if (!this.gesperrt()) {
        e.preventDefault();
        this.sperreAnfordern();
        return;
      }
      e.preventDefault();
      if (e.button === 0) this.eingabe.mausFeuer = true;
      else if (e.button === 2) this.eingabe.mausVisier = true;
    } else {
      if (e.button === 0) this.eingabe.mausFeuer = false;
      else if (e.button === 2) this.eingabe.mausVisier = false;
    }
  }

  mausBewegt(e) {
    if (!this.gesperrt() || this.app.zustand !== 'spiel') return;
    // Manche Browser liefern gelegentlich riesige Spruenge - kappen.
    const dx = Math.max(-300, Math.min(300, e.movementX || 0));
    const dy = Math.max(-300, Math.min(300, e.movementY || 0));
    this.eingabe.maus(dx, dy);
  }
}
