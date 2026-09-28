/* ------------------------------------------------------------------
   Ablaufsteuerung von Gehstock Ops.

   Zustaende: laden -> menue -> spiel <-> pause -> ergebnis -> ...

   Die Hauptschleife trennt drei Dinge:
     Eingabe      Tastatur/Maus/Touch fuellen einen Befehl je Schritt,
     Simulation   rechnet in festen Schritten (1/60 s), egal wie schnell
                  das Geraet zeichnet; hinkt sie hinterher, werden hoechstens
                  fuenf Schritte nachgeholt,
     Darstellung  zeichnet einmal pro Bild und interpoliert dazwischen.

   Alles, was angemeldet wird (Ereignisse, Ton, WebGL), wird in
   zerstoeren() wieder abgemeldet - beim Verlassen zum Hideout wie beim
   Neuaufbau.
   ------------------------------------------------------------------ */

import { TICK, WAFFEN } from './konfig.js';
import { kraehenfeld } from './karte/kraehenfeld.js';
import { Welt } from './sim/welt.js';
import { Navigation } from './sim/navigation.js';
import { Simulation } from './sim/simulation.js';
import { neuerBefehl } from './sim/befehl.js';
import { augenhoehe } from './sim/bewegung.js';
import { GRAD, klemme, richtung, winkelDiff, yawZu } from './sim/mathe.js';
import { strahlFigur } from './sim/treffer.js';
import { Darstellung, webglVerfuegbar } from './darstellung/renderer.js';
import { Klang } from './klang/klang.js';
import { Eingabe } from './eingabe/eingabe.js';
import { TastaturMaus } from './eingabe/tastatur-maus.js';
import { Touch } from './eingabe/touch.js';
import { Zielhilfe } from './eingabe/zielhilfe.js';
import { Hud } from './oberflaeche/hud.js';
import { Menues } from './oberflaeche/menues.js';
import { einstellungenLaden, einstellungenSpeichern, statistikLaden, statistikSpeichern } from './einstellungen.js';

const ZURUECK = '../../';
const glatt = (t) => t * t * (3 - 2 * t);
const R = { x: 0, y: 0, z: 0 };
const ZONE = { zone: 0 };

function touchGeraet() {
  try {
    return (navigator.maxTouchPoints || 0) > 0 && window.matchMedia('(pointer: coarse)').matches;
  } catch (e) {
    return false;
  }
}

export class App {
  constructor(wurzel) {
    this.wurzel = wurzel;
    this.einst = einstellungenLaden();
    this.statistik = statistikLaden();
    this.klang = new Klang();
    this.klang.lautstaerkeSetzen(this.einst.lautstaerke);
    this.zustand = 'laden';
    this.aus = [];
    this.sim = null;
    this.akku = 0;
    this.letzte = 0;
    this.raf = 0;
    this.zeit = 0;
    this.zerstoert = false;
    this.pauseZeit = 0;
    this.neuZeichnen = false;
    this.leerBefehl = neuerBefehl();

    this.bildzeiten = new Float32Array(30);
    this.bildI = 0;
    this.messZeit = 0;
    this.fpsText = '';

    this.kam = { landung: 0, wackeln: 0, sprintFov: 0, todYaw: 0, todPitch: 0 };
    this.blick = { dx: 0, dy: 0 };
    this.ansicht = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, fov: 72, waffe: null, sim: null, alpha: 1, zeit: 0, dt: 0 };
    this.wz = {
      waffe: 'sturmgewehr', visier: 0, sprint: false, amBoden: true, tempo: 0, geduckt: false, rutschen: false,
      laden: -1, ladenPhase: 0, schuesse: 0, landung: 0, blickDx: 0, blickDy: 0,
    };
    this.hz = { sim: null, zeit: 0, fov: 72, hoehe: 800, touch: false, yaw: 0, fps: undefined, zielName: '', zielFreund: false };
    this.laden = { p: -1 };
    this.countdownZahl = 0;
    this.zielTakt = 0;
    this.schleife = this.schleife.bind(this);
  }

  reg(ziel, typ, fn, opt) {
    ziel.addEventListener(typ, fn, opt);
    this.aus.push(() => ziel.removeEventListener(typ, fn, opt));
  }

  /* ------------------------------------------------------------ Start */

  starten() {
    if (!webglVerfuegbar()) {
      this.startFehler('Dieses Gerät oder dieser Browser kann kein WebGL 2 darstellen. Gehstock Ops braucht es für die 3D-Grafik. '
        + 'Bitte Safari oder Chrome in einer aktuellen Version verwenden und die Hardwarebeschleunigung eingeschaltet lassen.');
      return;
    }
    this.karte = kraehenfeld();
    this.welt = new Welt(this.karte.quader.filter((q) => q.kollision));
    this.nav = new Navigation(this.welt, this.karte.grenzen);

    this.darstellung = new Darstellung(this.wurzel, this.einst.qualitaet);
    this.darstellung.dynamisch = this.einst.dynamisch;
    this.darstellung.beiKontext = (ok) => this.kontext(ok);
    this.darstellung.weltAufbauen(this.karte);

    this.eingabe = new Eingabe(this.einst);
    this.hud = new Hud(this.wurzel, this);
    this.hud.fpsZeigen(this.einst.fps);
    this.touch = new Touch(this, this.eingabe, this.wurzel);
    this.touch.einstellen(this.einst);
    this.touch.an();
    this.tm = new TastaturMaus(this, this.eingabe, this.wurzel);
    this.tm.an();
    this.zielhilfe = new Zielhilfe();
    this.menues = new Menues(this.wurzel, this);

    this.reg(window, 'resize', () => this.groesse());
    this.reg(window, 'orientationchange', () => {
      this.allesLoslassen();
      setTimeout(() => this.groesse(), 300);
    });
    this.reg(document, 'visibilitychange', () => {
      if (document.hidden) this.versteckt();
    });
    this.reg(window, 'blur', () => this.allesLoslassen());
    this.reg(window, 'pagehide', () => this.versteckt());
    this.reg(window, 'pageshow', (e) => {
      if (e.persisted) {
        this.letzte = performance.now();
        this.neuZeichnen = true;
      }
    });
    const entsperren = () => this.klang.entsperren();
    this.reg(window, 'pointerdown', entsperren, true);
    this.reg(window, 'keydown', entsperren, true);
    this.reg(window, 'touchend', entsperren, true);
    if (window.visualViewport) this.reg(window.visualViewport, 'resize', () => this.groesse());

    this.modusSetzen(touchGeraet() ? 'touch' : 'maus');
    this.groesse();
    this.zustand = 'menue';
    this.menues.haupt();
    this.letzte = performance.now();
    // Erstes Bild sofort, dann den Ladebildschirm weg
    this.bild(this.letzte);
    const laden = document.getElementById('ops-laden');
    if (laden) laden.remove();
    window.__opsGestartet = true;
    this.raf = requestAnimationFrame(this.schleife);
  }

  startFehler(text) {
    window.__opsGestartet = false;
    if (window.__opsFehlerAnzeigen) window.__opsFehlerAnzeigen(text);
  }

  groesse() {
    if (this.darstellung) this.darstellung.groesseAnpassen();
    this.neuZeichnen = true;
  }

  modusSetzen(m) {
    this.eingabe.modus = m;
    this.wurzel.classList.toggle('touch', m === 'touch');
    this.wurzel.classList.toggle('maus', m === 'maus');
    this.hud.modus(m === 'touch');
    this.touch.sichtbar(m === 'touch' && this.zustand === 'spiel');
    if (m === 'touch') this.menues.klickHinweis(false);
  }

  touchBenutzt() {
    this.klang.entsperren();
    if (this.eingabe.modus !== 'touch') {
      this.tm.sperreLoesen();
      this.modusSetzen('touch');
    }
  }

  modusGeaendert(m) {
    if (m === 'maus' && this.eingabe.modus !== 'maus') this.modusSetzen('maus');
    this.menues.klickHinweis(false);
  }

  allesLoslassen() {
    if (this.eingabe) this.eingabe.alleLoslassen();
    if (this.touch) this.touch.loslassen();
  }

  /* ------------------------------------------------------- Einstellungen */

  einstellungSetzen(k, v) {
    this.einst[k] = v;
    einstellungenSpeichern(this.einst);
    if (k === 'lautstaerke') this.klang.lautstaerkeSetzen(v);
    else if (k === 'qualitaet') {
      this.darstellung.qualitaetSetzen(v);
      this.neuZeichnen = true;
    } else if (k === 'dynamisch') this.darstellung.dynamisch = v;
    else if (k === 'fps') this.hud.fpsZeigen(v);
    else if (k === 'linkerFeuerknopf' || k === 'knopfGroesse') this.touch.einstellen(this.einst);
  }

  naechsteWaffe(id) {
    if (!this.sim || !WAFFEN[id]) return;
    this.sim.waffeWaehlen(this.sim.spieler, id);
    this.einstellungSetzen('waffe', id);
    this.klang.spielen('klick', 0.6);
  }

  /* ------------------------------------------------------------ Match */

  matchStarten() {
    this.klang.entsperren();
    if (!this.einst.hilfeGesehen) {
      this.menues.steuerung(() => this.matchStarten());
      return;
    }
    this.menues.schliessen();
    this.hud.feedLeeren();
    this.hud.tabelle(null, false);
    const seed = ((Date.now() & 0xffffffff) ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    this.sim = new Simulation({
      karte: this.karte, welt: this.welt, nav: this.nav, seed,
      schwierigkeit: this.einst.schwierigkeit, spielerWaffe: this.einst.waffe,
    });
    this.darstellung.figurenVerbinden(this.sim);
    this.allesLoslassen();
    this.eingabe.neuesLeben(this.sim.spieler.yaw);
    this.darstellung.waffenmodell.hochnehmen();
    this.akku = 0;
    this.letzte = performance.now();
    this.countdownZahl = 0;
    this.kam.landung = 0;
    this.kam.wackeln = 0;
    this.ergebnisFertig = false;
    this.zustand = 'spiel';
    this.hud.sichtbar(true);
    this.touch.sichtbar(this.eingabe.modus === 'touch');
    if (this.eingabe.modus === 'maus') this.tm.sperreAnfordern();
    this.klang.fortsetzen();
  }

  pausieren() {
    if (this.zustand !== 'spiel') return;
    this.zustand = 'pause';
    this.pauseZeit = performance.now();
    this.allesLoslassen();
    this.touch.sichtbar(false);
    this.hud.tabelle(null, false);
    this.tm.sperreLoesen();
    this.menues.klickHinweis(false);
    this.menues.pause();
  }

  fortsetzen() {
    if (this.zustand !== 'pause') return;
    if (this.hochkant()) {
      this.menues.hinweis('Bitte das Gerät quer halten.');
      return;
    }
    this.menues.schliessen();
    this.zustand = 'spiel';
    this.akku = 0;
    this.letzte = performance.now();
    this.allesLoslassen();
    this.touch.sichtbar(this.eingabe.modus === 'touch');
    if (this.eingabe.modus === 'maus') this.tm.sperreAnfordern();
    this.klang.entsperren();
  }

  escape() {
    if (performance.now() - this.pauseZeit < 400) return;
    if (this.menues.ueber) {
      this.menues.ueberSchliessen();
      return;
    }
    if (this.zustand === 'spiel') this.pausieren();
    else if (this.zustand === 'pause') this.fortsetzen();
  }

  sperreVerloren() {
    if (this.zustand === 'spiel' && this.eingabe.modus === 'maus') this.pausieren();
  }

  sperreFehlgeschlagen() {
    if (this.zustand === 'spiel' && this.eingabe.modus === 'maus') this.menues.klickHinweis(true);
  }

  mausSperren() {
    this.menues.klickHinweis(false);
    this.tm.sperreAnfordern();
  }

  tabelle(an) {
    if (this.zustand !== 'spiel') return;
    this.hud.tabelle(this.sim, an);
  }

  versteckt() {
    if (this.zustand === 'spiel') this.pausieren();
    this.allesLoslassen();
    this.klang.pausieren();
  }

  kontext(ok) {
    if (!ok) {
      if (this.zustand === 'spiel') this.pausieren();
      this.menues.hinweis('Die Grafik wurde kurz zurückgesetzt …', 4000);
    } else {
      this.neuZeichnen = true;
      this.menues.hinweis('Grafik wieder da.', 2000);
    }
  }

  hochkant() {
    return this.eingabe.modus === 'touch' && window.innerHeight > window.innerWidth * 1.05;
  }

  zumMenue() {
    this.zustand = 'menue';
    this.sim = null;
    this.hud.sichtbar(false);
    this.hud.feedLeeren();
    this.touch.sichtbar(false);
    this.tm.sperreLoesen();
    this.menues.klickHinweis(false);
    this.darstellung.effekte.leeren();
    this.menues.haupt();
    this.neuZeichnen = true;
  }

  zumHideout() {
    this.zerstoeren();
    location.href = ZURUECK;
  }

  ergebnisZeigen() {
    const sim = this.sim;
    this.zustand = 'ergebnis';
    this.allesLoslassen();
    this.touch.sichtbar(false);
    this.hud.sichtbar(false);
    this.hud.tabelle(null, false);
    this.tm.sperreLoesen();
    this.menues.klickHinweis(false);
    const s = sim.spieler;
    const st = this.statistik;
    let rekord = '';
    st.matches++;
    if (sim.sieger === 0) st.siege++;
    else if (sim.sieger === 1) st.niederlagen++;
    else st.unentschieden++;
    st.abschuesse += s.abschuesse;
    st.tode += s.tode;
    if (s.besteSerie > st.besteSerie) {
      st.besteSerie = s.besteSerie;
      if (s.besteSerie >= 3) rekord = 'beste Serie ' + s.besteSerie;
    }
    if (s.abschuesse > st.meisteAbschuesse) {
      st.meisteAbschuesse = s.abschuesse;
      if (st.matches > 1 && s.abschuesse > 0) rekord = s.abschuesse + ' Abschüsse in einem Match';
    }
    statistikSpeichern(st);
    this.menues.ergebnis(sim, { rekord });
  }

  /* ------------------------------------------------------ Hauptschleife */

  schleife(jetzt) {
    if (this.zerstoert) return;
    this.raf = requestAnimationFrame(this.schleife);
    try {
      this.bild(jetzt);
    } catch (e) {
      this.absturz(e);
    }
  }

  absturz(e) {
    if (this.zerstoert) return;
    cancelAnimationFrame(this.raf);
    this.zerstoert = true;
    console.error(e);
    try {
      this.allesLoslassen();
      this.tm.sperreLoesen();
      this.touch.sichtbar(false);
      this.menues.fehler('Fehler', 'Da ist etwas schiefgegangen: ' + ((e && e.message) || e) + '. Neu laden hilft meistens.');
    } catch (f) {
      this.startFehler('Da ist etwas schiefgegangen. Bitte neu laden.');
    }
  }

  bild(jetzt) {
    let dt = (jetzt - this.letzte) / 1000;
    this.letzte = jetzt;
    if (!(dt >= 0)) dt = 0;
    if (dt > 0.1) dt = 0.1;
    this.zeit += dt;
    this.messen(dt);

    const quer = !this.hochkant();
    this.wurzel.classList.toggle('hochkant', !quer);
    if (!quer) {
      // Hochformat: Hinweis liegt ueber allem, Zeichnen spart nur Akku.
      if (this.zustand === 'spiel') this.pausieren();
      this.neuZeichnen = true;
      return;
    }

    const sim = this.sim;
    let alpha = 1;
    if (this.zustand === 'spiel' && sim) {
      const s = sim.spieler;
      this.zielhilfe.aktualisieren(sim, this.eingabe, dt, this.einst.zielhilfe);
      const w = s.waffe;
      const v = glatt(w.visier);
      this.eingabe.visierFaktor = (1 + (w.def.visier.zoom - 1) * v) * (1 + (this.einst.empfVisier - 1) * v);
      this.akku += dt;
      let n = 0;
      while (this.akku >= TICK && n < 5) {
        this.eingabe.befehl(s.lebt ? s.befehl : this.leerBefehl);
        sim.schritt(TICK);
        this.meldungen(sim);
        this.akku -= TICK;
        n++;
      }
      if (n >= 5) this.akku = Math.min(this.akku, TICK);
      alpha = this.akku / TICK;
      this.nachladeGeraeusche(s);
      this.countdown(sim);
      if (sim.phase === 'ende' && sim.phasenZeit <= 0 && !this.ergebnisFertig) {
        this.ergebnisFertig = true;
        this.ergebnisZeigen();
      }
    } else if (this.zustand === 'pause' || this.zustand === 'laden') {
      // Standbild: nichts rechnen, nur bei Bedarf neu zeichnen.
      if (!this.neuZeichnen) return;
    }
    this.neuZeichnen = false;
    this.zeichnen(dt, alpha);
    if (this.zustand === 'spiel' && this.sim) this.hudAktualisieren(this.sim, dt);
  }

  messen(dt) {
    this.bildzeiten[this.bildI++ % this.bildzeiten.length] = dt;
    this.messZeit += dt;
    if (this.messZeit < 0.5) return;
    this.messZeit = 0;
    let summe = 0;
    for (let i = 0; i < this.bildzeiten.length; i++) summe += this.bildzeiten[i];
    const mittel = summe / this.bildzeiten.length;
    if (mittel > 0) {
      const info = this.darstellung.info();
      this.fpsText = Math.round(1 / mittel) + ' fps · ' + (mittel * 1000).toFixed(1) + ' ms'
        + (info ? ' · ' + Math.round(info.pixel * 100) / 100 + 'x · ' + info.zeichnungen + ' Aufrufe' : '');
      if (this.zustand === 'spiel') this.darstellung.bildzeitMelden(mittel * 1000);
    }
  }

  countdown(sim) {
    if (sim.phase !== 'vorlauf') return;
    const z = Math.ceil(sim.phasenZeit);
    if (z !== this.countdownZahl && z > 0) {
      this.countdownZahl = z;
      this.hud.ansage(String(z), this.zeit, 0.9, 'zahl');
      this.klang.spielen('piep', 0.5);
    }
  }

  /* Meldungen der Simulation: Ton, HUD, Effekte. */
  meldungen(sim) {
    const s = sim.spieler;
    const id = s.id;
    const k = this.darstellung.kamera;
    for (const m of sim.meldungen) {
      this.darstellung.meldung(m, sim, id, k);
      const a = m.a >= 0 ? sim.akteure[m.a] : null;
      const eigen = m.a === id;
      switch (m.typ) {
        case 'schuss': {
          const def = a.waffe.def;
          const rate = 0.95 + Math.random() * 0.1;
          if (eigen) {
            this.klang.spielen(def.id, 0.85 * def.lautstaerke, rate);
            if (def.einzelnLaden) this.klang.spielen('pumpe', 0.5, 1, 0, 0, 0.28);
          } else {
            this.klang.raeumlich(def.id, a.x - s.x, a.z - s.z, this.eingabe.yaw, 1.1 * def.lautstaerke, rate);
          }
          break;
        }
        case 'treffer':
          if (eigen) {
            this.hud.treffer(m.kopf, m.toedlich, false, this.zeit);
            this.klang.spielen(m.kopf ? 'kopftreffer' : 'treffer', 0.55);
          }
          if (m.b === id) {
            this.hud.schadenVon(m.a, this.zeit);
            this.klang.spielen('schaden', 0.7, 0.9 + Math.random() * 0.2);
            this.kam.wackeln = Math.min(1, this.kam.wackeln + 0.5);
          }
          break;
        case 'geschuetzt':
          if (eigen) this.hud.treffer(false, false, true, this.zeit);
          break;
        case 'abschuss': {
          const opfer = sim.akteure[m.b];
          this.hud.abschuss(a, opfer, m.waffe, m.kopf, id);
          if (eigen) {
            const serie = m.serie >= 3 ? ' · Serie ' + m.serie : '';
            this.hud.meldung(opfer.name + ' ausgeschaltet' + (m.kopf ? ' · Kopftreffer' : '') + serie, 'abschuss', this.zeit);
            this.klang.spielen('abschuss', 0.6);
          } else if (m.b === id) {
            this.klang.spielen('schaden', 0.9, 0.7);
          }
          break;
        }
        case 'assist':
          if (eigen) this.hud.meldung('Hilfe bei ' + sim.akteure[m.b].name, 'hilfe', this.zeit);
          break;
        case 'spawn':
          if (m.a === id) {
            this.eingabe.neuesLeben(s.yaw);
            this.darstellung.waffenmodell.hochnehmen();
            this.klang.spielen('spawn', 0.4);
            this.laden.p = -1;
          }
          break;
        case 'leer':
          if (eigen) this.klang.spielen('leer', 0.6);
          break;
        case 'nachladen':
          if (eigen) this.laden.p = 0;
          break;
        case 'patrone':
          if (eigen) this.klang.spielen('patrone', 0.55, 0.95 + Math.random() * 0.1);
          break;
        case 'geladen':
          if (eigen && a.waffe.def.einzelnLaden) this.klang.spielen('pumpe', 0.5);
          break;
        case 'schritt':
          if (eigen) this.klang.spielen('schritt', 0.16 + m.wert * 0.2, 0.9 + Math.random() * 0.25);
          else if (a) this.klang.raeumlich('schritt', a.x - s.x, a.z - s.z, this.eingabe.yaw, 0.25 + m.wert * 0.4, 0.9 + Math.random() * 0.2);
          break;
        case 'sprung':
          if (eigen) this.klang.spielen('sprung', 0.35);
          break;
        case 'landung':
          if (eigen) {
            this.klang.spielen('landung', Math.min(0.8, m.wert / 10));
            this.kam.landung = Math.min(1, this.kam.landung + m.wert / 9);
            this.wz.landung = m.wert;
          }
          break;
        case 'rutschen':
          if (eigen) this.klang.spielen('rutschen', 0.45);
          break;
        case 'start':
          this.hud.ansage('LOS!', this.zeit, 1.1, 'los');
          this.klang.spielen('start', 0.55);
          break;
        case 'ende': {
          const t = sim.sieger === 0 ? 'SIEG' : sim.sieger === 1 ? 'NIEDERLAGE' : 'UNENTSCHIEDEN';
          this.hud.ansage(t, this.zeit, 3, sim.sieger === 0 ? 'sieg' : 'niederlage');
          this.klang.spielen('ende', 0.6);
          this.allesLoslassen();
          break;
        }
        default:
          break;
      }
    }
    sim.meldungenLeeren();
  }

  /* Nachladegeraeusche am Fortschritt festmachen: so passen sie zur
     Animation, auch wenn ein Bild ausfaellt. */
  nachladeGeraeusche(s) {
    const w = s.waffe;
    if (!s.lebt || w.laden <= 0 || w.def.einzelnLaden) {
      this.laden.p = -1;
      return;
    }
    const p = 1 - w.laden / Math.max(0.01, w.ladenGesamt);
    const vor = this.laden.p;
    if (vor < 0) {
      this.laden.p = p;
      return;
    }
    const kreuzt = (grenze) => vor < grenze && p >= grenze;
    if (kreuzt(0.2)) this.klang.spielen('magRaus', 0.55);
    if (kreuzt(0.62)) this.klang.spielen('magRein', 0.6);
    if (kreuzt(0.86)) this.klang.spielen('verschluss', 0.55);
    this.laden.p = p;
  }

  /* --------------------------------------------------------- Kamera */

  zeichnen(dt, alpha) {
    const a = this.ansicht;
    const sim = this.zustand === 'menue' ? null : this.sim;
    a.waffe = null;
    a.roll = 0;
    const kam = this.kam;
    kam.landung = Math.max(0, kam.landung - dt * 4);
    kam.wackeln = Math.max(0, kam.wackeln - dt * 3);

    if (sim && sim.spieler && this.zustand !== 'ergebnis') {
      const s = sim.spieler;
      if (s.lebt) {
        const x = s.px + (s.x - s.px) * alpha;
        const y = s.py + (s.y - s.py) * alpha;
        const z = s.pz + (s.z - s.pz) * alpha;
        const w = s.waffe;
        const wack = kam.wackeln * 0.012;
        a.x = x + (Math.random() - 0.5) * wack;
        a.y = y + augenhoehe(s) - s.stufenVersatz - glatt(Math.min(1, kam.landung)) * 0.07 + (Math.random() - 0.5) * wack;
        a.z = z + (Math.random() - 0.5) * wack;
        a.yaw = this.eingabe.yaw + w.rueckSeite * GRAD;
        a.pitch = klemme(this.eingabe.pitch + w.rueckHoch * GRAD, -1.55, 1.55);
        // Leichtes Neigen beim Rutschen
        a.roll = s.rutschZeit > 0 ? 0.035 : 0;
        const v = glatt(w.visier);
        kam.sprintFov += ((s.sprintet ? 5 : 0) - kam.sprintFov) * Math.min(1, dt * 8);
        a.fov = this.einst.sichtfeld * (1 + (w.def.visier.zoom - 1) * v) + kam.sprintFov * (1 - v);

        const z2 = this.wz;
        z2.waffe = w.id;
        z2.visier = w.visier;
        z2.sprint = s.sprintet;
        z2.amBoden = s.amBoden;
        z2.tempo = Math.hypot(s.vx, s.vz);
        z2.geduckt = s.geduckt;
        z2.rutschen = s.rutschZeit > 0;
        z2.laden = w.laden > 0 ? 1 - w.laden / Math.max(0.01, w.ladenGesamt) : -1;
        z2.ladenPhase = w.ladenPhase;
        z2.schuesse = w.schuesse;
        this.eingabe.blickAbholen(this.blick);
        z2.blickDx = this.blick.dx;
        z2.blickDy = this.blick.dy;
        a.waffe = z2;
      } else {
        // Todeskamera: hochziehen und zum Schuetzen schauen
        const t = Math.min(1, (sim.zeit - s.todesZeit) / 0.7);
        const e = glatt(t);
        const m = s.moerder >= 0 ? sim.akteure[s.moerder] : null;
        const zx = m && m.lebt ? m.x : s.x;
        const zy = m && m.lebt ? m.y + 1.3 : s.y + 0.4;
        const zz = m && m.lebt ? m.z : s.z;
        let bx = s.x - zx, bz = s.z - zz;
        const bl = Math.hypot(bx, bz) || 1;
        bx /= bl; bz /= bl;
        // Nicht in eine Wand hinein: Weg vom Koerper zur Kamera pruefen
        const hx = bx * 1.6 * e, hy = 1.5 * e, hz = bz * 1.6 * e;
        const hl = Math.hypot(hx, hy, hz);
        let f = 1;
        if (hl > 0.01) {
          const t = this.welt.strahl(s.x, s.y + 1.4, s.z, hx / hl, hy / hl, hz / hl, hl + 0.3);
          if (t < hl + 0.3) f = Math.max(0, (t - 0.3) / hl);
        }
        a.x = s.x + hx * f;
        a.y = s.y + 1.4 + hy * f;
        a.z = s.z + hz * f;
        const soll = yawZu(zx - a.x, zz - a.z);
        const sollP = Math.atan2(zy - a.y, Math.hypot(zx - a.x, zz - a.z));
        kam.todYaw = t < 0.05 ? this.eingabe.yaw : kam.todYaw + winkelDiff(kam.todYaw, soll) * Math.min(1, dt * 5);
        kam.todPitch = t < 0.05 ? this.eingabe.pitch : kam.todPitch + (sollP - kam.todPitch) * Math.min(1, dt * 5);
        a.yaw = kam.todYaw;
        a.pitch = kam.todPitch;
        a.fov = this.einst.sichtfeld;
        this.eingabe.blickAbholen(this.blick);
      }
    } else {
      // Menue und Auswertung: langsamer Rundflug ueber das Gelaende
      const t = this.zeit * 0.045;
      a.x = Math.sin(t) * 27;
      a.z = Math.cos(t) * 17;
      a.y = 10.5;
      a.yaw = yawZu(-a.x, -a.z);
      a.pitch = -0.36;
      a.fov = 64;
    }
    a.sim = sim;
    a.alpha = alpha;
    a.zeit = this.zeit;
    a.dt = dt;
    this.darstellung.bild(a);
  }

  /* ------------------------------------------------------------ HUD */

  hudAktualisieren(sim, dt) {
    const s = sim.spieler;
    const z = this.hz;
    z.sim = sim;
    z.zeit = this.zeit;
    z.fov = this.ansicht.fov;
    z.hoehe = this.darstellung.hoehe;
    z.touch = this.eingabe.modus === 'touch';
    z.yaw = this.eingabe.yaw;
    z.fps = this.einst.fps ? this.fpsText : undefined;
    // Name unter dem Fadenkreuz, zehnmal pro Sekunde
    this.zielTakt -= dt;
    if (this.zielTakt <= 0) {
      this.zielTakt = 0.1;
      this.zielErmitteln(sim, s);
    }
    this.hud.aktualisieren(z);
    this.touch.zustand(this.eingabe, s.lebt);
  }

  zielErmitteln(sim, s) {
    const z = this.hz;
    z.zielName = '';
    z.zielFreund = false;
    if (!s.lebt) return;
    const auge = s.y + augenhoehe(s);
    richtung(this.eingabe.yaw, this.eingabe.pitch, R);
    const tWelt = this.welt.strahl(s.x, auge, s.z, R.x, R.y, R.z, 60);
    const ix = R.x !== 0 ? 1 / R.x : 1e30, iy = R.y !== 0 ? 1 / R.y : 1e30, iz = R.z !== 0 ? 1 / R.z : 1e30;
    let best = tWelt, wer = null;
    for (const a of sim.akteure) {
      if (a === s || !a.lebt) continue;
      const t = strahlFigur(a, s.x, auge, s.z, ix, iy, iz, best, ZONE);
      if (t < best) { best = t; wer = a; }
    }
    if (wer) {
      z.zielName = wer.name;
      z.zielFreund = wer.team === s.team;
    }
  }

  /* ------------------------------------------------------ Aufraeumen */

  zerstoeren() {
    if (this.zerstoertFertig) return;
    this.zerstoertFertig = true;
    this.zerstoert = true;
    cancelAnimationFrame(this.raf);
    for (const f of this.aus) f();
    this.aus.length = 0;
    if (this.tm) this.tm.ab();
    if (this.touch) this.touch.entfernen();
    if (this.hud) this.hud.entfernen();
    if (this.menues) this.menues.entfernen();
    if (this.darstellung) this.darstellung.entsorgen();
    this.klang.zerstoeren();
    this.sim = null;
  }
}
