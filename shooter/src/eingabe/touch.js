/* ------------------------------------------------------------------
   Touch-Steuerung fuer das iPad.

     links    schwebender Stick: wo der Daumen aufsetzt, ist die Mitte.
              Weit nach oben geschoben: Sprint.
     rechts   freie Flaeche zum Umsehen
     Knoepfe  Feuer (rechts, beim Halten weiter umsehen), zweiter
              Feuerknopf links oben neben dem Stick, Visier, Nachladen,
              Springen, Ducken, Pause, Tabelle

   Jeder Finger (pointerId) gehoert genau einer Steuerung - vom Aufsetzen
   bis zum Loslassen. Mehrere Finger arbeiten unabhaengig: laufen, zielen
   und schiessen gleichzeitig. pointercancel, verlorener Fokus, Drehen
   des Geraets und Pause lassen alles los; nichts bleibt haengen.

   Gegen Scrollen, Zoomen und die Lupe: touch-action: none, dazu
   touchstart/touchmove und Gesten ohne Standardverhalten.
   ------------------------------------------------------------------ */

const SYMBOLE = {
  feuer: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="9" fill="none" stroke="currentColor" stroke-width="3"/><path d="M24 4v10M24 34v10M4 24h10M34 24h10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
  visier: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="15" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="24" cy="24" r="3" fill="currentColor"/><path d="M24 5v8M24 35v8M5 24h8M35 24h8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>',
  laden: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M36 17a14 14 0 1 0 2 11" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/><path d="M38 7v11H27" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  sprung: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M12 30l12-12 12 12" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 38h20" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
  ducken: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M12 18l12 12 12-12" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 38h20" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
  pause: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M17 12v24M31 12v24" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></svg>',
};

const LOOK_KNOEPFE = new Set(['feuer', 'feuerL', 'visier']);

export class Touch {
  constructor(app, eingabe, wurzel) {
    this.app = app;
    this.eingabe = eingabe;
    this.aus = [];
    this.zeiger = new Map();
    this.stickId = -1;
    this.stickCx = 0;
    this.stickCy = 0;
    this.radius = 58;

    const el = document.createElement('div');
    el.className = 'ops-touch';
    el.setAttribute('aria-hidden', 'false');
    el.innerHTML = [
      '<div class="t-stick-ruhe"><div class="t-knauf"></div></div>',
      '<div class="t-stick"><div class="t-sprint">SPRINT</div><div class="t-knauf"></div></div>',
      '<div class="t-knopf t-pause" data-steuer="pause" role="button" aria-label="Pause">' + SYMBOLE.pause + '</div>',
      '<div class="t-tabelle" data-steuer="tabelle" role="button" aria-label="Punktetabelle"></div>',
      '<div class="t-knopf t-feuer" data-steuer="feuer" role="button" aria-label="Feuer">' + SYMBOLE.feuer + '</div>',
      '<div class="t-knopf t-feuer-links" data-steuer="feuerL" role="button" aria-label="Feuer links">' + SYMBOLE.feuer + '</div>',
      '<div class="t-knopf t-visier" data-steuer="visier" role="button" aria-label="Visier">' + SYMBOLE.visier + '</div>',
      '<div class="t-knopf t-laden" data-steuer="laden" role="button" aria-label="Nachladen">' + SYMBOLE.laden + '</div>',
      '<div class="t-knopf t-sprung" data-steuer="sprung" role="button" aria-label="Springen">' + SYMBOLE.sprung + '</div>',
      '<div class="t-knopf t-ducken" data-steuer="ducken" role="button" aria-label="Ducken">' + SYMBOLE.ducken + '</div>',
    ].join('');
    wurzel.appendChild(el);
    this.el = el;
    this.stickEl = el.querySelector('.t-stick');
    this.knaufEl = this.stickEl.querySelector('.t-knauf');
    this.sprintEl = this.stickEl.querySelector('.t-sprint');
    this.ruheEl = el.querySelector('.t-stick-ruhe');
    this.knoepfe = {};
    for (const k of el.querySelectorAll('[data-steuer]')) this.knoepfe[k.dataset.steuer] = k;
  }

  an() {
    const reg = (ziel, typ, fn, opt) => {
      ziel.addEventListener(typ, fn, opt);
      this.aus.push(() => ziel.removeEventListener(typ, fn, opt));
    };
    const el = this.el;
    reg(el, 'pointerdown', (e) => this.unten(e));
    reg(el, 'pointermove', (e) => this.bewegt(e));
    reg(el, 'pointerup', (e) => this.hoch(e));
    reg(el, 'pointercancel', (e) => this.hoch(e));
    reg(el, 'lostpointercapture', (e) => this.hoch(e));
    // Kein Scrollen, keine Lupe, kein Doppeltipp-Zoom
    const halt = (e) => { if (e.cancelable) e.preventDefault(); };
    reg(el, 'touchstart', halt, { passive: false });
    reg(el, 'touchmove', halt, { passive: false });
    reg(el, 'touchend', halt, { passive: false });
    reg(el, 'dblclick', halt);
    reg(el, 'contextmenu', halt);
    reg(document, 'gesturestart', halt, { passive: false });
    reg(document, 'gesturechange', halt, { passive: false });
  }

  ab() {
    this.loslassen();
    for (const f of this.aus) f();
    this.aus.length = 0;
  }

  entfernen() {
    this.ab();
    this.el.remove();
  }

  sichtbar(v) {
    this.el.classList.toggle('an', !!v);
    if (!v) this.loslassen();
  }

  einstellen(einst) {
    this.el.style.setProperty('--knopf', String(einst.knopfGroesse || 1));
    this.knoepfe.feuerL.style.display = einst.linkerFeuerknopf ? '' : 'none';
    this.radius = 58 * (einst.knopfGroesse || 1);
  }

  /* Alle Finger los: Fokusverlust, Pause, Drehen. */
  loslassen() {
    for (const id of this.zeiger.keys()) {
      try { this.el.releasePointerCapture(id); } catch (e) { /* schon weg */ }
    }
    this.zeiger.clear();
    this.stickId = -1;
    this.eingabe.stickX = 0;
    this.eingabe.stickY = 0;
    this.eingabe.stickSprint = false;
    this.eingabe.feuerFinger = 0;
    this.eingabe.visierFinger = false;
    this.stickEl.classList.remove('an');
    this.ruheEl.classList.remove('weg');
    this.sprintEl.classList.remove('an');
    for (const k of Object.values(this.knoepfe)) k.classList.remove('gedrueckt');
  }

  unten(e) {
    if (e.pointerType === 'mouse') return;
    if (e.cancelable) e.preventDefault();
    this.app.touchBenutzt();
    const x = e.clientX, y = e.clientY;
    const knopf = e.target && e.target.closest ? e.target.closest('[data-steuer]') : null;
    let art = knopf ? knopf.dataset.steuer : null;
    if (!art) {
      const links = x < window.innerWidth * 0.46 && y > window.innerHeight * 0.2;
      art = links && this.stickId === -1 ? 'stick' : 'blick';
    }
    const z = { art, lx: x, ly: y, knopf };
    this.zeiger.set(e.pointerId, z);
    try { this.el.setPointerCapture(e.pointerId); } catch (err) { /* nicht schlimm */ }
    if (knopf) knopf.classList.add('gedrueckt');

    const E = this.eingabe;
    switch (art) {
      case 'stick':
        this.stickStart(e.pointerId, x, y);
        break;
      case 'feuer':
      case 'feuerL':
        E.feuerFinger++;
        break;
      case 'visier':
        if (this.app.einst.visierModus === 'halten') E.visierFinger = true;
        else E.visierUmschalten();
        break;
      case 'laden':
        E.nachladen();
        break;
      case 'sprung':
        E.springen();
        break;
      case 'ducken':
        E.duckenUmschalten();
        break;
      case 'pause':
        this.app.pausieren();
        break;
      case 'tabelle':
        this.app.tabelle(true);
        break;
      default:
        break;
    }
  }

  bewegt(e) {
    const z = this.zeiger.get(e.pointerId);
    if (!z) return;
    if (e.cancelable) e.preventDefault();
    const x = e.clientX, y = e.clientY;
    if (z.art === 'stick') this.stickZiehen(x, y);
    else if (z.art === 'blick' || LOOK_KNOEPFE.has(z.art)) this.eingabe.touch(x - z.lx, y - z.ly);
    z.lx = x;
    z.ly = y;
  }

  hoch(e) {
    const z = this.zeiger.get(e.pointerId);
    if (!z) return;
    this.zeiger.delete(e.pointerId);
    const E = this.eingabe;
    if (z.knopf) z.knopf.classList.remove('gedrueckt');
    switch (z.art) {
      case 'stick':
        this.stickEnde();
        break;
      case 'feuer':
      case 'feuerL':
        E.feuerFinger = Math.max(0, E.feuerFinger - 1);
        break;
      case 'visier':
        if (this.app.einst.visierModus === 'halten') E.visierFinger = false;
        break;
      case 'tabelle':
        this.app.tabelle(false);
        break;
      default:
        break;
    }
  }

  stickStart(id, x, y) {
    this.stickId = id;
    // Mitte so setzen, dass der ganze Stick auf dem Bildschirm bleibt
    const r = this.radius;
    this.stickCx = Math.max(r + 12, Math.min(window.innerWidth * 0.46 - r, x));
    this.stickCy = Math.max(r + 12, Math.min(window.innerHeight - r - 12, y));
    this.stickEl.style.transform = 'translate3d(' + (this.stickCx - r) + 'px,' + (this.stickCy - r) + 'px,0)';
    this.stickEl.classList.add('an');
    this.ruheEl.classList.add('weg');
    this.stickZiehen(x, y);
  }

  stickZiehen(x, y) {
    const r = this.radius;
    let dx = x - this.stickCx, dy = y - this.stickCy;
    const l = Math.hypot(dx, dy);
    // Sprint: weit nach oben geschoben, nicht zu weit seitlich
    const sprint = dy < -r * 1.25 && Math.abs(dx) < r * 0.8;
    const k = l > r ? r / l : 1;
    const kx = dx * k, ky = dy * k;
    this.knaufEl.style.transform = 'translate3d(' + kx + 'px,' + ky + 'px,0)';
    let sx = kx / r, sy = -ky / r;
    const betrag = Math.hypot(sx, sy);
    const tot = 0.12;
    if (betrag < tot) { sx = 0; sy = 0; } else {
      const f = (betrag - tot) / (1 - tot) / betrag;
      sx *= f; sy *= f;
    }
    this.eingabe.stickX = sx;
    this.eingabe.stickY = sprint ? 1 : sy;
    this.eingabe.stickSprint = sprint;
    this.sprintEl.classList.toggle('an', sprint);
  }

  stickEnde() {
    this.stickId = -1;
    this.eingabe.stickX = 0;
    this.eingabe.stickY = 0;
    this.eingabe.stickSprint = false;
    this.stickEl.classList.remove('an');
    this.ruheEl.classList.remove('weg');
    this.sprintEl.classList.remove('an');
    this.knaufEl.style.transform = 'translate3d(0,0,0)';
  }

  /* Anzeige der Umschalter (Visier, Ducken) an den Zustand anpassen. */
  zustand(E, lebt) {
    const v = E.zielt(), d = E.duckt;
    if (v !== this.altVisier) { this.altVisier = v; this.knoepfe.visier.classList.toggle('aktiv', v); }
    if (d !== this.altDucken) { this.altDucken = d; this.knoepfe.ducken.classList.toggle('aktiv', d); }
    if (lebt !== this.altLebt) { this.altLebt = lebt; this.el.classList.toggle('tot', !lebt); }
  }
}
