/* ------------------------------------------------------------------
   Darstellung: WebGL, Szene, Licht, Kamera, Figuren, Effekte.

   Liest den Zustand der Simulation und zeichnet ihn - aendert ihn aber
   nie. Zwischen zwei Simulationsschritten wird weich interpoliert, der
   Blick des Spielers kommt direkt aus der Eingabe (keine Verzoegerung).

   Leistung:
     - Pixeldichte nach Qualitaetsstufe begrenzt (iPad: 2x waere doppelt
       so viele Pixel wie noetig),
     - dynamische Aufloesung: wird es eng, sinkt die Renderaufloesung in
       Stufen und steigt wieder, wenn Luft ist,
     - der Sonnenschatten wird nur einmal berechnet (die Welt steht still),
       Figuren bekommen einen weichen Fussschatten,
     - Welt in wenigen zusammengefassten Geometrien.
   ------------------------------------------------------------------ */

import {
  ACESFilmicToneMapping, Color, DirectionalLight, Fog, HemisphereLight, PCFShadowMap, PCFSoftShadowMap,
  PerspectiveCamera, Scene, SRGBColorSpace, Vector3, WebGLRenderer,
} from 'three';
import { QUALITAET } from '../konfig.js';
import { augenhoehe } from '../sim/bewegung.js';
import { Effekte } from './effekte.js';
import { Figuren } from './figuren.js';
import { texturenErzeugen } from './texturen.js';
import { feuerSpriteMaterial, Waffenmodell } from './waffenmodell.js';
import { thema, weltBauen } from './weltmodell.js';

export function webglVerfuegbar() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    if (!gl) return false;
    const ext = gl.getExtension('WEBGL_lose_context');
    if (ext) ext.loseContext();
    return true;
  } catch (e) {
    return false;
  }
}

const HIMMEL = new Color('#cfdbe3');

export class Darstellung {
  constructor(behaelter, qualitaet) {
    this.behaelter = behaelter;
    this.qualitaet = QUALITAET[qualitaet] ? qualitaet : 'mittel';
    this.aufloesung = 1;         // dynamischer Faktor auf die Pixeldichte
    this.dynamisch = true;
    this.touch = false;          // Touch-Geraet: niedrigere Obergrenze der Pixeldichte
    this.kontextWeg = false;
    this.beiKontext = null;

    this.szene = new Scene();
    this.szene.background = HIMMEL;
    this.szene.fog = new Fog(HIMMEL, 38, QUALITAET[this.qualitaet].sichtweite);
    this.kamera = new PerspectiveCamera(72, 1, 0.05, 900);
    this.kamera.rotation.order = 'YXZ';

    this.himmelLicht = new HemisphereLight('#dfe9f4', '#86765f', 2.15);
    this.szene.add(this.himmelLicht);
    this.sonne = new DirectionalLight('#fff0da', 2.3);
    this.sonne.position.set(-26, 46, 20);
    this.sonne.target.position.set(0, 0, 0);
    this.szene.add(this.sonne, this.sonne.target);
    const sc = this.sonne.shadow.camera;
    sc.left = -42; sc.right = 42; sc.top = 34; sc.bottom = -34; sc.near = 5; sc.far = 120;
    this.sonne.shadow.bias = -0.0006;
    this.sonne.shadow.normalBias = 0.035;

    this.texturen = texturenErzeugen();
    this.waffenmodell = new Waffenmodell();
    const feuer = feuerSpriteMaterial();
    this.feuerMat = feuer.material;
    this.feuerTex = feuer.textur;
    this.figuren = new Figuren(this.szene);
    this.effekte = new Effekte(this.szene, this.qualitaet);
    this.welt = null;
    this.animiert = [];
    this.fovJetzt = 72;
    this.breite = 1;
    this.hoehe = 1;

    this.rendererAnlegen();
  }

  rendererAnlegen() {
    const q = QUALITAET[this.qualitaet];
    const canvas = document.createElement('canvas');
    canvas.className = 'ops-leinwand';
    canvas.setAttribute('aria-label', 'Spielfeld');
    const renderer = new WebGLRenderer({
      canvas,
      antialias: q.kantenglaettung,
      powerPreference: 'high-performance',
      stencil: false,
      alpha: false,
      preserveDrawingBuffer: false,
    });
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.info.autoReset = false;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = q.schatten > 0;
    // Weiche Schattenkanten nur auf Hoch - auf Mittel reicht die guenstigere Filterung.
    renderer.shadowMap.type = q.kantenglaettung ? PCFSoftShadowMap : PCFShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    this.sonne.castShadow = q.schatten > 0;
    if (q.schatten > 0) {
      this.sonne.shadow.mapSize.set(q.schatten, q.schatten);
      if (this.sonne.shadow.map) {
        this.sonne.shadow.map.dispose();
        this.sonne.shadow.map = null;
      }
    }
    const aniso = Math.min(q.kantenglaettung ? 8 : 4, renderer.capabilities.getMaxAnisotropy());
    for (const k of ['kies', 'asphalt', 'platten', 'estrich', 'halle', 'container', 'mauer', 'sand', 'gras', 'pflaster', 'holzboden']) {
      this.texturen[k].anisotropy = aniso;
      this.texturen[k].needsUpdate = true;
    }
    this.kontextVerloren = (e) => {
      e.preventDefault();
      this.kontextWeg = true;
      if (this.beiKontext) this.beiKontext(false);
    };
    this.kontextZurueck = () => {
      this.kontextWeg = false;
      renderer.shadowMap.needsUpdate = true;
      if (this.beiKontext) this.beiKontext(true);
    };
    canvas.addEventListener('webglcontextlost', this.kontextVerloren);
    canvas.addEventListener('webglcontextrestored', this.kontextZurueck);
    this.canvas = canvas;
    this.renderer = renderer;
    this.behaelter.insertBefore(canvas, this.behaelter.firstChild);
    this.groesseAnpassen();
  }

  rendererEntfernen() {
    if (!this.renderer) return;
    this.groesseSchluessel = '';
    this.canvas.removeEventListener('webglcontextlost', this.kontextVerloren);
    this.canvas.removeEventListener('webglcontextrestored', this.kontextZurueck);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
    this.renderer = null;
    this.canvas = null;
  }

  qualitaetSetzen(stufe) {
    if (!QUALITAET[stufe] || stufe === this.qualitaet) return;
    const altKanten = QUALITAET[this.qualitaet].kantenglaettung;
    this.qualitaet = stufe;
    const q = QUALITAET[stufe];
    this.szene.fog.far = q.sichtweite;
    this.aufloesung = 1;
    if (altKanten !== q.kantenglaettung) {
      // Kantenglaettung laesst sich nur mit einem neuen Kontext umschalten.
      this.rendererEntfernen();
      this.rendererAnlegen();
    } else {
      this.renderer.shadowMap.enabled = q.schatten > 0;
      this.sonne.castShadow = q.schatten > 0;
      if (q.schatten > 0) {
        this.sonne.shadow.mapSize.set(q.schatten, q.schatten);
        if (this.sonne.shadow.map) {
          this.sonne.shadow.map.dispose();
          this.sonne.shadow.map = null;
        }
      }
      this.renderer.shadowMap.needsUpdate = true;
      // Materialien muessen wissen, dass sich Schatten geaendert haben.
      this.szene.traverse((o) => {
        if (o.material) {
          const ms = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of ms) m.needsUpdate = true;
        }
      });
      this.groesseAnpassen();
    }
  }

  pixelDichte() {
    const q = QUALITAET[this.qualitaet];
    const geraet = window.devicePixelRatio || 1;
    const grenze = this.touch ? q.pixelTouch : q.pixel;
    // Auf Hundertstel runden: sonst loest jeder Rundungsunterschied ein
    // neues Anlegen des Bildspeichers aus.
    return Math.round(Math.max(0.5, Math.min(geraet, grenze) * this.aufloesung) * 100) / 100;
  }

  /* Nur wenn sich die Pixelgroesse wirklich aendert: jedes setSize legt
     den Bildspeicher neu an. Safari auf dem iPad meldet beim Ein- und
     Ausblenden seiner Leisten viele Groessenaenderungen - neu angelegt
     wird trotzdem nur einmal. */
  groesseAnpassen() {
    if (!this.renderer) return;
    const b = Math.max(1, this.behaelter.clientWidth || window.innerWidth);
    const h = Math.max(1, this.behaelter.clientHeight || window.innerHeight);
    const dichte = this.pixelDichte();
    const schluessel = b + 'x' + h + '@' + dichte;
    if (schluessel === this.groesseSchluessel) return;
    this.groesseSchluessel = schluessel;
    this.breite = b;
    this.hoehe = h;
    this.renderer.setPixelRatio(dichte);
    this.renderer.setSize(this.breite, this.hoehe, false);
    this.kamera.aspect = this.breite / this.hoehe;
    this.kamera.updateProjectionMatrix();
    this.waffenmodell.groesse(this.breite, this.hoehe);
  }

  /* Von der Hauptschleife gerufen: mittlere Bildzeit in ms. Gestuft,
     damit die Aufloesung nicht staendig springt. */
  bildzeitMelden(ms) {
    if (!this.dynamisch) {
      if (this.aufloesung !== 1) {
        this.aufloesung = 1;
        this.groesseAnpassen();
      }
      return;
    }
    let neu = this.aufloesung;
    if (ms > 19.5 && this.aufloesung > 0.6) neu = Math.max(0.6, this.aufloesung - 0.1);
    else if (ms < 14.5 && this.aufloesung < 1) neu = Math.min(1, this.aufloesung + 0.05);
    if (Math.abs(neu - this.aufloesung) > 0.001) {
      this.aufloesung = neu;
      this.groesseAnpassen();
    }
  }

  weltAufbauen(karte) {
    if (this.welt && this.karte === karte) return;
    this.weltAbbauen();
    this.karte = karte;
    this.themaSetzen(karte);
    this.welt = weltBauen(karte, this.texturen, this.qualitaet);
    this.szene.add(this.welt.gruppe);
    this.animiert = this.welt.animiert;
    this.effekte.leeren();
    this.renderer.shadowMap.needsUpdate = true;
  }

  /* Alte Welt ganz freigeben (Geometrien, Materialien, eigene Texturen) -
     beim Kartenwechsel darf auf dem iPad nichts liegen bleiben. */
  weltAbbauen() {
    if (!this.welt) return;
    this.szene.remove(this.welt.gruppe);
    this.welt.entsorgen();
    this.welt = null;
    this.animiert = [];
  }

  /* Himmel, Nebel, Licht und Schattenausschnitt je Karte. */
  themaSetzen(karte) {
    const T = thema(karte);
    const horizont = new Color(T.horizont);
    this.szene.background = horizont;
    this.szene.fog.color.copy(horizont);
    this.szene.fog.near = T.nebelNah;
    this.himmelLicht.color.set(T.licht);
    this.himmelLicht.groundColor.set(T.lichtBoden);
    this.himmelLicht.intensity = T.lichtStaerke;
    this.sonne.color.set(T.sonne);
    this.sonne.intensity = T.sonnenStaerke;
    this.sonne.position.set(T.sonnenRichtung[0], T.sonnenRichtung[1], T.sonnenRichtung[2]);
    const g = karte.grenzen;
    const sc = this.sonne.shadow.camera;
    const bx = Math.max(Math.abs(g.minX), Math.abs(g.maxX)) + 10;
    const bz = Math.max(Math.abs(g.minZ), Math.abs(g.maxZ)) + 12;
    sc.left = -bx; sc.right = bx; sc.top = bz; sc.bottom = -bz;
    sc.far = 140;
    sc.updateProjectionMatrix();
  }

  /* Figuren zu den Akteuren eines neuen Matchs - und online, wenn
     jemand kommt, geht oder das Team wechselt. Verbuendete tragen ihren
     Namen ueber dem Kopf. */
  figurenVerbinden(sim, effekteLeeren = true) {
    const ich = sim.spieler;
    for (const a of sim.akteure) {
      const istSpieler = a === ich;
      const freund = ich ? a.team === ich.team : a.team === 0;
      const name = !istSpieler && freund ? a.name : '';
      const f = this.figuren.liste[a.id];
      if (!f || f.team !== a.team || f.istSpieler !== istSpieler || f.nameText !== name) {
        this.figuren.anlegen(a, this.feuerMat, istSpieler, name);
      }
    }
    if (effekteLeeren) this.effekte.leeren();
  }

  /* Alle Shader vorab uebersetzen: sonst ruckelt es beim ersten
     Muendungsfeuer, beim ersten Treffer oder bei der ersten Schrotflinte.
     compile() sieht nur sichtbare Objekte - darum kurz alles zeigen. */
  vorwaermen() {
    if (!this.renderer || this.kontextWeg) return;
    const versteckt = [];
    const zeigen = (o) => {
      if (o && !o.visible) {
        o.visible = true;
        versteckt.push(o);
      }
    };
    for (const f of this.figuren.liste) {
      if (!f) continue;
      zeigen(f.wurzel);
      zeigen(f.feuer);
      for (const k of Object.keys(f.waffen)) zeigen(f.waffen[k]);
    }
    for (const s of this.effekte.spuren) zeigen(s.m);
    for (const k of this.effekte.kleckse) zeigen(k);
    for (const w of this.effekte.wolken) zeigen(w.s);
    for (const k of Object.keys(this.waffenmodell.modelle)) zeigen(this.waffenmodell.modelle[k].gruppe);
    zeigen(this.waffenmodell.feuer);
    try {
      this.renderer.compile(this.szene, this.kamera);
      this.renderer.compile(this.waffenmodell.szene, this.waffenmodell.kamera);
    } finally {
      for (const o of versteckt) o.visible = false;
    }
  }

  /* Meldungen der Simulation in Effekte uebersetzen. */
  meldung(m, sim, spielerId, kamera) {
    const a = m.a >= 0 ? sim.akteure[m.a] : null;
    switch (m.typ) {
      case 'schuss': {
        if (!a) break;
        const eigen = a.id === spielerId;
        // Bei Dauerfeuer zeigt nicht jede Kugel eine Spur - das waere zu
        // unruhig. Einzelschuesse (Scharfschuetze, Praezision) immer.
        if (a.waffe.def.kugeln === 1 && a.waffe.def.rpm > 400 && a.waffe.schuesse % 2 === 1) break;
        let sx, sy, sz;
        if (eigen) {
          const k = kamera;
          const vorn = RICHTUNG.set(0, 0, -1).applyQuaternion(k.quaternion);
          const rechts = RECHTS.set(1, 0, 0).applyQuaternion(k.quaternion);
          sx = k.position.x + vorn.x * 0.6 + rechts.x * 0.16;
          sy = k.position.y + vorn.y * 0.6 - 0.12;
          sz = k.position.z + vorn.z * 0.6 + rechts.z * 0.16;
        } else {
          const sy0 = Math.sin(a.yaw), cy0 = Math.cos(a.yaw);
          const auge = a.y + augenhoehe(a) - 0.2;
          sx = a.x - sy0 * 0.75 + cy0 * 0.1;
          sy = auge;
          sz = a.z - cy0 * 0.75 - sy0 * 0.1;
        }
        this.effekte.spur(sx, sy, sz, m.x, m.y, m.z);
        break;
      }
      case 'einschlag': {
        const team = a ? a.team : 2;
        const r = ((m.x * 13.7 + m.z * 7.3) % 1 + 1) % 1;
        if (m.waffe !== 'schrotflinte' || r < 0.6) this.effekte.klecks(m.x, m.y, m.z, m.nx, m.ny, m.nz, team, r);
        if (QUALITAET[this.qualitaet].effekte >= 1 || r < 0.5) this.effekte.wolke(m.x + m.nx * 0.08, m.y + m.ny * 0.08, m.z + m.nz * 0.08, '#cbbfa8', 0.35, 0.4);
        break;
      }
      case 'treffer': {
        const farbe = a && a.team === 0 ? '#5a9bff' : '#ff6a55';
        this.effekte.wolke(m.x, m.y, m.z, farbe, m.kopf ? 0.5 : 0.38, 0.3);
        break;
      }
      case 'abschuss': {
        const b = sim.akteure[m.b];
        const farbe = a && a.team === 0 ? '#5a9bff' : '#ff6a55';
        this.effekte.wolke(b.x, b.y + 1.1, b.z, farbe, 1.1, 0.6);
        break;
      }
      default:
        break;
    }
  }

  /* Ein Bild zeichnen.
     ansicht: { x, y, z, yaw, pitch, roll, fov, waffe (Zustand fuer das
     Waffenmodell oder null), spielerId, sim, alpha, zeit, dt } */
  bild(ans) {
    if (!this.renderer || this.kontextWeg) return;
    const k = this.kamera;
    k.position.set(ans.x, ans.y, ans.z);
    k.rotation.set(ans.pitch, ans.yaw, ans.roll || 0);
    if (Math.abs(ans.fov - this.fovJetzt) > 0.01) {
      this.fovJetzt = ans.fov;
      k.fov = ans.fov;
      k.updateProjectionMatrix();
    }
    for (const f of this.animiert) f(ans.zeit);
    if (ans.sim) {
      for (const a of ans.sim.akteure) this.figuren.aktualisieren(a, ans.alpha, ans.sim.zeit, ans.dt);
    } else {
      this.figuren.alleVerstecken();
    }
    this.effekte.aktualisieren(ans.dt);

    const r = this.renderer;
    r.info.reset();
    r.autoClear = true;
    r.render(this.szene, k);
    if (ans.waffe) {
      this.waffenmodell.aktualisieren(ans.waffe, ans.dt);
      r.autoClear = false;
      r.clearDepth();
      r.render(this.waffenmodell.szene, this.waffenmodell.kamera);
      r.autoClear = true;
    }
  }

  info() {
    if (!this.renderer) return null;
    const i = this.renderer.info;
    return {
      zeichnungen: i.render.calls,
      dreiecke: i.render.triangles,
      geometrien: i.memory.geometries,
      texturen: i.memory.textures,
      programme: i.programs ? i.programs.length : 0,
      pixel: this.pixelDichte(),
    };
  }

  entsorgen() {
    this.rendererEntfernen();
    this.weltAbbauen();
    this.figuren.entsorgen();
    this.effekte.entsorgen();
    this.waffenmodell.entsorgen();
    this.feuerMat.dispose();
    this.feuerTex.dispose();
    for (const k of Object.keys(this.texturen)) this.texturen[k].dispose();
    this.animiert = [];
  }
}

const RICHTUNG = new Vector3();
const RECHTS = new Vector3();
