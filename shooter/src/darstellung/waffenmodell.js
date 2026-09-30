/* ------------------------------------------------------------------
   Die Waffe in der Hand des Spielers.

   Eigene kleine Szene mit eigener Kamera: die Waffe wird nach der Welt
   gezeichnet, mit geleertem Tiefenpuffer. So ragt sie nie in eine Wand,
   und ihr Sichtfeld bleibt gleich, waehrend das der Welt beim Zielen
   zoomt.

   Jede Waffe hat einen Visierpunkt (Rotpunkt, Kimme, Perlkorn). Beim
   Zielen wandert er genau in die Bildmitte - dort, wo die Simulation
   den Schuss hinlenkt.

   Bewegungen: Laufwackeln, Nachziehen beim Umsehen, Rueckstoss,
   Nachladen (Magazin raus und rein bzw. Patrone fuer Patrone),
   Sprinthaltung, Landung, Hochnehmen nach dem Spawn.
   ------------------------------------------------------------------ */

import {
  AdditiveBlending, BoxGeometry, CylinderGeometry, DirectionalLight, Group, HemisphereLight,
  Mesh, MeshBasicMaterial, MeshLambertMaterial, PerspectiveCamera, PlaneGeometry, RingGeometry, Scene,
  SphereGeometry, Sprite, SpriteMaterial,
} from 'three';
import { feuerTextur } from './texturen.js';

const glatt = (t) => t * t * (3 - 2 * t);
const naeher = (v, z, rate, dt) => v + (z - v) * (1 - Math.exp(-rate * dt));

export class Waffenmodell {
  constructor() {
    this.szene = new Scene();
    this.kamera = new PerspectiveCamera(54, 1, 0.01, 10);
    this.szene.add(new HemisphereLight('#eef3f8', '#5a4d3e', 2.3));
    const sonne = new DirectionalLight('#fff1dc', 2.6);
    sonne.position.set(-0.6, 1, 0.5);
    this.szene.add(sonne);

    this.geos = [];
    this.mats = [];
    this.texturen = [];
    const mat = (farbe) => {
      const m = new MeshLambertMaterial({ color: farbe });
      this.mats.push(m);
      return m;
    };
    this.M = {
      stahl: mat('#3d434a'),
      stahlHell: mat('#5c646d'),
      polymer: mat('#2e3136'),
      oliv: mat('#6b7550'),
      holz: mat('#8a5d34'),
      aermel: mat('#5f6a45'),
      handschuh: mat('#33373c'),
      messing: mat('#c9a23f'),
      glas: new MeshBasicMaterial({ color: '#9fd0ff', transparent: true, opacity: 0.12, depthWrite: false }),
      punkt: new MeshBasicMaterial({ color: '#ff3030' }),
    };
    this.mats.push(this.M.glas, this.M.punkt);

    this.halter = new Group();
    this.szene.add(this.halter);
    this.modelle = {
      sturmgewehr: this.sturmgewehr(),
      mp: this.mp(),
      schrotflinte: this.schrotflinte(),
      mg: this.mg(),
      praezision: this.praezision(),
      scharfschuetze: this.scharfschuetze(),
      pistole: this.pistole(),
    };
    for (const k of Object.keys(this.modelle)) {
      this.modelle[k].gruppe.visible = false;
      this.halter.add(this.modelle[k].gruppe);
    }

    const ft = feuerTextur();
    this.texturen.push(ft);
    this.feuerMat = new SpriteMaterial({ map: ft, blending: AdditiveBlending, depthWrite: false, transparent: true });
    this.mats.push(this.feuerMat);
    this.feuer = new Sprite(this.feuerMat);
    this.feuer.visible = false;
    this.feuerBis = 0;

    // Huelsen: kleiner Vorrat, einfache Flugbahn
    const huelseGeo = this.geo(new CylinderGeometry(0.005, 0.005, 0.03, 6));
    this.huelsen = [];
    for (let i = 0; i < 6; i++) {
      const h = new Mesh(huelseGeo, this.M.messing);
      h.visible = false;
      this.szene.add(h);
      this.huelsen.push({ m: h, t: 9, vx: 0, vy: 0, vz: 0 });
    }
    this.huelseI = 0;

    this.aktiv = '';
    this.zeit = 0;
    this.phase = 0;
    this.sprint = 0;
    this.visier = 0;
    this.rueck = 0;
    this.rueckDreh = 0;
    this.swayX = 0;
    this.swayY = 0;
    this.landung = 0;
    this.heben = 1;
    this.schuesse = -1;
    this.pumpe = 1;
    this.ducken = 0;
    this.fernrohr = false;       // Zielfernrohr im Auge: Waffe ausblenden
  }

  geo(g) {
    this.geos.push(g);
    return g;
  }

  teil(gruppe, bx, by, bz, x, y, z, mat) {
    const m = new Mesh(this.geo(new BoxGeometry(bx, by, bz)), mat);
    m.position.set(x, y, z);
    gruppe.add(m);
    return m;
  }

  /* Unterarm mit Handschuh von der Hand zum (unsichtbaren) Ellbogen. */
  arm(gruppe, hand, ellbogen) {
    const g = new Group();
    const dx = ellbogen[0] - hand[0], dy = ellbogen[1] - hand[1], dz = ellbogen[2] - hand[2];
    const l = Math.hypot(dx, dy, dz);
    const aermel = new Mesh(this.geo(new BoxGeometry(0.075, 0.075, l)), this.M.aermel);
    aermel.position.set(0, 0, l / 2);
    const h = new Mesh(this.geo(new BoxGeometry(0.06, 0.07, 0.1)), this.M.handschuh);
    h.position.set(0, 0, 0.02);
    g.add(aermel, h);
    g.position.set(hand[0], hand[1], hand[2]);
    g.lookAt(ellbogen[0], ellbogen[1], ellbogen[2]);
    gruppe.add(g);
    return g;
  }

  rotpunkt(g, y, z) {
    // Gehaeuse als duenner Rahmen, damit man hindurchsieht
    this.teil(g, 0.03, 0.02, 0.05, 0, y - 0.03, z, this.M.polymer);
    this.teil(g, 0.004, 0.04, 0.045, -0.018, y, z, this.M.polymer);
    this.teil(g, 0.004, 0.04, 0.045, 0.018, y, z, this.M.polymer);
    this.teil(g, 0.04, 0.004, 0.045, 0, y + 0.022, z, this.M.polymer);
    const glas = new Mesh(this.geo(new PlaneGeometry(0.032, 0.04)), this.M.glas);
    glas.position.set(0, y, z - 0.02);
    g.add(glas);
    const punkt = new Mesh(this.geo(new SphereGeometry(0.0011, 8, 6)), this.M.punkt);
    punkt.position.set(0, y, z - 0.02);
    g.add(punkt);
  }

  sturmgewehr() {
    const g = new Group();
    const M = this.M;
    this.teil(g, 0.044, 0.062, 0.34, 0, 0, 0, M.stahl);
    this.teil(g, 0.05, 0.056, 0.26, 0, -0.004, -0.29, M.oliv);
    this.teil(g, 0.018, 0.018, 0.18, 0, 0.004, -0.5, M.stahlHell);
    this.teil(g, 0.03, 0.026, 0.05, 0, 0.004, -0.61, M.stahl);
    this.teil(g, 0.026, 0.01, 0.34, 0, 0.037, -0.22, M.stahlHell);
    this.teil(g, 0.012, 0.012, 0.04, 0.026, 0.012, 0.05, M.stahlHell);
    const griff = this.teil(g, 0.032, 0.095, 0.042, 0, -0.07, 0.09, M.polymer);
    griff.rotation.x = -0.35;
    const magazin = this.teil(g, 0.032, 0.15, 0.06, 0, -0.1, -0.07, M.polymer);
    magazin.rotation.x = 0.18;
    this.teil(g, 0.04, 0.07, 0.2, 0, -0.012, 0.27, M.polymer);
    this.rotpunkt(g, 0.08, -0.03);
    const rechts = this.arm(g, [0.012, -0.085, 0.1], [0.16, -0.26, 0.42]);
    const links = this.arm(g, [-0.004, -0.045, -0.3], [-0.2, -0.24, -0.02]);
    return { gruppe: g, visier: [0, 0.08, -0.05], muendung: [0, 0.004, -0.64], magazin, magazinY: magazin.position.y, links, linksPos: links.position.clone(), rechts, auswurf: true, typ: 'magazin', abstand: 0.27, huefte: [0.2, -0.2, -0.43], rueck: 1, feuer: 1.1 };
  }

  mp() {
    const g = new Group();
    const M = this.M;
    this.teil(g, 0.042, 0.064, 0.28, 0, 0, 0, M.stahl);
    this.teil(g, 0.02, 0.02, 0.12, 0, 0.008, -0.2, M.stahlHell);
    const magazin = this.teil(g, 0.028, 0.19, 0.042, 0, -0.125, -0.03, M.polymer);
    const griff = this.teil(g, 0.032, 0.09, 0.04, 0, -0.068, 0.08, M.polymer);
    griff.rotation.x = -0.3;
    this.teil(g, 0.01, 0.01, 0.2, -0.016, 0.0, 0.22, M.stahlHell);
    this.teil(g, 0.01, 0.01, 0.2, 0.016, 0.0, 0.22, M.stahlHell);
    this.teil(g, 0.046, 0.046, 0.012, 0, -0.01, 0.32, M.polymer);
    // Kimme (zwei Backen auf einem Sockel) und Korn auf einem Turm
    this.teil(g, 0.026, 0.02, 0.02, 0, 0.042, 0.09, M.stahl);
    this.teil(g, 0.007, 0.022, 0.01, -0.009, 0.062, 0.09, M.stahl);
    this.teil(g, 0.007, 0.022, 0.01, 0.009, 0.062, 0.09, M.stahl);
    this.teil(g, 0.012, 0.03, 0.012, 0, 0.046, -0.12, M.stahl);
    this.teil(g, 0.003, 0.016, 0.004, 0, 0.068, -0.12, M.stahl);
    this.teil(g, 0.004, 0.004, 0.004, 0, 0.075, -0.12, M.punkt);
    const rechts = this.arm(g, [0.012, -0.078, 0.09], [0.16, -0.26, 0.4]);
    const links = this.arm(g, [-0.006, -0.12, -0.03], [-0.19, -0.26, 0.1]);
    return { gruppe: g, visier: [0, 0.075, 0.09], muendung: [0, 0.008, -0.28], magazin, magazinY: magazin.position.y, links, linksPos: links.position.clone(), rechts, auswurf: true, typ: 'magazin', abstand: 0.3, huefte: [0.165, -0.165, -0.35], rueck: 0.75, feuer: 0.9 };
  }

  schrotflinte() {
    const g = new Group();
    const M = this.M;
    this.teil(g, 0.055, 0.075, 0.26, 0, 0, 0.02, M.stahl);
    const lauf = new Mesh(this.geo(new CylinderGeometry(0.014, 0.014, 0.56, 10)), M.stahlHell);
    lauf.rotation.x = Math.PI / 2;
    lauf.position.set(0, 0.018, -0.38);
    g.add(lauf);
    const rohr = new Mesh(this.geo(new CylinderGeometry(0.012, 0.012, 0.46, 10)), M.stahl);
    rohr.rotation.x = Math.PI / 2;
    rohr.position.set(0, -0.012, -0.33);
    g.add(rohr);
    const pumpe = this.teil(g, 0.052, 0.046, 0.16, 0, -0.016, -0.3, M.holz);
    const kolben = this.teil(g, 0.044, 0.085, 0.26, 0, -0.05, 0.28, M.holz);
    kolben.rotation.x = 0.12;
    const griff = this.teil(g, 0.034, 0.09, 0.04, 0, -0.07, 0.12, M.holz);
    griff.rotation.x = -0.3;
    // Ringvisier hinten, Korn mit Perle vorn: die Visierlinie liegt ueber
    // dem Gehaeuse, das Gehaeuse bleibt beim Zielen unten im Bild.
    this.teil(g, 0.03, 0.02, 0.03, 0, 0.047, 0.08, M.stahl);
    this.teil(g, 0.006, 0.028, 0.01, -0.011, 0.07, 0.08, M.stahl);
    this.teil(g, 0.006, 0.028, 0.01, 0.011, 0.07, 0.08, M.stahl);
    this.teil(g, 0.028, 0.006, 0.01, 0, 0.083, 0.08, M.stahl);
    this.teil(g, 0.028, 0.006, 0.01, 0, 0.058, 0.08, M.stahl);
    this.teil(g, 0.018, 0.018, 0.02, 0, 0.038, -0.62, M.stahl);
    this.teil(g, 0.004, 0.024, 0.004, 0, 0.058, -0.62, M.stahl);
    const korn = new Mesh(this.geo(new SphereGeometry(0.0035, 8, 6)), M.messing);
    korn.position.set(0, 0.071, -0.62);
    g.add(korn);
    const rechts = this.arm(g, [0.012, -0.075, 0.13], [0.16, -0.26, 0.44]);
    const links = this.arm(g, [0, -0.045, -0.3], [-0.2, -0.24, -0.05]);
    const patrone = this.teil(g, 0.018, 0.018, 0.06, 0, -0.08, -0.02, M.messing);
    patrone.visible = false;
    return { gruppe: g, visier: [0, 0.07, 0.08], muendung: [0, 0.018, -0.68], pumpe, pumpeZ: pumpe.position.z, pumpeWeg: 0.075, pumpeHand: true, pumpeDauer: 0.55, links, linksPos: links.position.clone(), rechts, patrone, auswurf: false, typ: 'einzeln', abstand: 0.14, huefte: [0.2, -0.215, -0.44], rueck: 2.2, feuer: 1.6 };
  }

  /* Zielfernrohr: Rohr mit Linsen, innen ein Leuchtpunkt. Beim
     Scharfschuetzengewehr blendet im vollen Visier das Bild ueber
     (HUD), hier zaehlt nur die Haltung davor. */
  fernrohr(g, y, z, laenge, r, punkt) {
    const M = this.M;
    const rohr = new Mesh(this.geo(new CylinderGeometry(r, r, laenge, 14, 1, true)), M.stahl);
    rohr.rotation.x = Math.PI / 2;
    rohr.position.set(0, y, z);
    g.add(rohr);
    for (const e of [-1, 1]) {
      const ring = new Mesh(this.geo(new CylinderGeometry(r * 1.28, r * 1.28, 0.03, 14, 1, true)), M.polymer);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, y, z + e * (laenge / 2 - 0.012));
      g.add(ring);
      const glas = new Mesh(this.geo(new PlaneGeometry(r * 2, r * 2)), M.glas);
      glas.position.set(0, y, z + e * (laenge / 2 - 0.02));
      g.add(glas);
    }
    // Rand der hinteren Linse als dunkler Ring: man sieht, wo man hineinschaut.
    const blende = new Mesh(this.geo(new RingGeometry(r * 0.8, r * 1.05, 18)), M.polymer);
    blende.position.set(0, y, z + laenge / 2 - 0.004);
    g.add(blende);
    // Halterungen enden unter dem Rohr - nichts ragt in die Visierlinie
    const hh = y - r - 0.03;
    this.teil(g, 0.014, hh, 0.024, 0, 0.03 + hh / 2, z - laenge * 0.28, M.stahl);
    this.teil(g, 0.014, hh, 0.024, 0, 0.03 + hh / 2, z + laenge * 0.28, M.stahl);
    if (punkt) {
      const p = new Mesh(this.geo(new SphereGeometry(0.0012, 8, 6)), M.punkt);
      p.position.set(0, y, z - laenge / 2 + 0.03);
      g.add(p);
    }
  }

  mg() {
    const g = new Group();
    const M = this.M;
    this.teil(g, 0.058, 0.078, 0.38, 0, 0, 0, M.stahl);
    this.teil(g, 0.064, 0.064, 0.24, 0, 0.004, -0.31, M.oliv);
    const lauf = new Mesh(this.geo(new CylinderGeometry(0.013, 0.013, 0.32, 10)), M.stahlHell);
    lauf.rotation.x = Math.PI / 2;
    lauf.position.set(0, 0.004, -0.57);
    g.add(lauf);
    this.teil(g, 0.036, 0.032, 0.07, 0, 0.004, -0.75, M.stahl);
    this.teil(g, 0.028, 0.012, 0.42, 0, 0.045, -0.2, M.stahlHell);
    // Tragegriff seitlich (frei fuer die Visierlinie), eingeklapptes Zweibein
    this.teil(g, 0.012, 0.024, 0.012, -0.04, 0.03, -0.33, M.stahl);
    this.teil(g, 0.012, 0.024, 0.012, -0.04, 0.03, -0.19, M.stahl);
    this.teil(g, 0.014, 0.012, 0.16, -0.04, 0.046, -0.26, M.polymer);
    this.teil(g, 0.008, 0.008, 0.2, -0.018, -0.042, -0.46, M.stahl);
    this.teil(g, 0.008, 0.008, 0.2, 0.018, -0.042, -0.46, M.stahl);
    const griff = this.teil(g, 0.034, 0.095, 0.044, 0, -0.072, 0.09, M.polymer);
    griff.rotation.x = -0.35;
    // Gurtkasten
    const magazin = this.teil(g, 0.074, 0.11, 0.11, -0.012, -0.094, -0.06, M.oliv);
    this.teil(g, 0.048, 0.08, 0.22, 0, -0.014, 0.29, M.polymer);
    this.rotpunkt(g, 0.085, -0.1);
    const rechts = this.arm(g, [0.012, -0.088, 0.1], [0.17, -0.27, 0.43]);
    const links = this.arm(g, [-0.004, -0.05, -0.32], [-0.21, -0.25, -0.03]);
    return { gruppe: g, visier: [0, 0.085, -0.12], muendung: [0, 0.004, -0.79], magazin, magazinY: magazin.position.y, links, linksPos: links.position.clone(), rechts, auswurf: true, typ: 'magazin', abstand: 0.27, huefte: [0.21, -0.225, -0.46], rueck: 0.9, feuer: 1.2 };
  }

  praezision() {
    const g = new Group();
    const M = this.M;
    this.teil(g, 0.044, 0.064, 0.36, 0, 0, 0, M.stahl);
    this.teil(g, 0.048, 0.054, 0.3, 0, -0.004, -0.32, M.polymer);
    const lauf = new Mesh(this.geo(new CylinderGeometry(0.011, 0.011, 0.3, 10)), M.stahlHell);
    lauf.rotation.x = Math.PI / 2;
    lauf.position.set(0, 0.004, -0.6);
    g.add(lauf);
    this.teil(g, 0.026, 0.026, 0.05, 0, 0.004, -0.76, M.stahl);
    this.teil(g, 0.024, 0.01, 0.3, 0, 0.037, -0.12, M.stahlHell);
    const griff = this.teil(g, 0.032, 0.095, 0.042, 0, -0.07, 0.1, M.polymer);
    griff.rotation.x = -0.35;
    const magazin = this.teil(g, 0.03, 0.1, 0.06, 0, -0.078, -0.07, M.polymer);
    magazin.rotation.x = 0.12;
    this.teil(g, 0.042, 0.075, 0.24, 0, -0.016, 0.29, M.oliv);
    this.fernrohr(g, 0.078, -0.06, 0.2, 0.019, true);
    const rechts = this.arm(g, [0.012, -0.085, 0.11], [0.16, -0.26, 0.43]);
    const links = this.arm(g, [-0.004, -0.045, -0.32], [-0.2, -0.24, -0.03]);
    return { gruppe: g, visier: [0, 0.078, 0.02], muendung: [0, 0.004, -0.8], magazin, magazinY: magazin.position.y, links, linksPos: links.position.clone(), rechts, auswurf: true, typ: 'magazin', abstand: 0.13, huefte: [0.2, -0.205, -0.44], rueck: 1.5, feuer: 1.2 };
  }

  scharfschuetze() {
    const g = new Group();
    const M = this.M;
    this.teil(g, 0.046, 0.066, 0.32, 0, 0, 0, M.stahl);
    this.teil(g, 0.056, 0.06, 0.36, 0, -0.01, -0.3, M.oliv);
    const lauf = new Mesh(this.geo(new CylinderGeometry(0.012, 0.014, 0.46, 10)), M.stahl);
    lauf.rotation.x = Math.PI / 2;
    lauf.position.set(0, 0.006, -0.66);
    g.add(lauf);
    this.teil(g, 0.034, 0.03, 0.08, 0, 0.006, -0.92, M.stahl);
    this.teil(g, 0.05, 0.09, 0.3, 0, -0.03, 0.29, M.oliv);
    this.teil(g, 0.036, 0.036, 0.1, 0, 0.03, 0.22, M.oliv);
    const griff = this.teil(g, 0.032, 0.09, 0.04, 0, -0.07, 0.1, M.polymer);
    griff.rotation.x = -0.3;
    const magazin = this.teil(g, 0.03, 0.06, 0.07, 0, -0.058, -0.06, M.polymer);
    // Kammerstengel rechts - er faehrt nach jedem Schuss zurueck
    const verschluss = new Group();
    this.teil(verschluss, 0.05, 0.012, 0.012, 0.03, 0, 0, M.stahlHell);
    const knopf = new Mesh(this.geo(new SphereGeometry(0.011, 8, 6)), M.stahl);
    knopf.position.set(0.058, -0.004, 0);
    verschluss.add(knopf);
    verschluss.position.set(0, 0.02, 0.06);
    g.add(verschluss);
    this.fernrohr(g, 0.085, -0.04, 0.3, 0.024, false);
    const rechts = this.arm(g, [0.012, -0.08, 0.11], [0.16, -0.26, 0.44]);
    const links = this.arm(g, [-0.004, -0.05, -0.33], [-0.2, -0.24, -0.05]);
    return { gruppe: g, visier: [0, 0.085, 0.08], muendung: [0, 0.006, -0.97], magazin, magazinY: magazin.position.y, links, linksPos: links.position.clone(), rechts, pumpe: verschluss, pumpeZ: verschluss.position.z, pumpeWeg: 0.07, pumpeHand: false, pumpeDauer: 0.8, auswurf: false, typ: 'magazin', abstand: 0.12, huefte: [0.22, -0.25, -0.5], rueck: 2.4, feuer: 1.5 };
  }

  pistole() {
    const g = new Group();
    const M = this.M;
    // Schlitten faehrt beim Schuss zurueck
    const schlitten = new Group();
    this.teil(schlitten, 0.032, 0.034, 0.19, 0, 0, 0, M.stahl);
    this.teil(schlitten, 0.02, 0.012, 0.012, 0, 0.022, 0.085, M.stahl);
    this.teil(schlitten, 0.006, 0.014, 0.01, -0.007, 0.034, 0.085, M.stahl);
    this.teil(schlitten, 0.006, 0.014, 0.01, 0.007, 0.034, 0.085, M.stahl);
    this.teil(schlitten, 0.004, 0.016, 0.008, 0, 0.026, -0.085, M.stahl);
    this.teil(schlitten, 0.004, 0.004, 0.004, 0, 0.035, -0.085, M.punkt);
    g.add(schlitten);
    this.teil(g, 0.03, 0.022, 0.17, 0, -0.026, -0.01, M.polymer);
    const griff = this.teil(g, 0.032, 0.11, 0.048, 0, -0.085, 0.06, M.polymer);
    griff.rotation.x = -0.28;
    const magazin = this.teil(g, 0.024, 0.1, 0.036, 0, -0.1, 0.064, M.stahlHell);
    magazin.rotation.x = -0.28;
    this.teil(g, 0.012, 0.012, 0.03, 0, 0.004, -0.1, M.stahlHell);
    const rechts = this.arm(g, [0.014, -0.09, 0.07], [0.15, -0.27, 0.36]);
    const links = this.arm(g, [-0.016, -0.095, 0.065], [-0.17, -0.28, 0.33]);
    return { gruppe: g, visier: [0, 0.035, 0.085], muendung: [0, 0.004, -0.11], magazin, magazinY: magazin.position.y, links, linksPos: links.position.clone(), rechts, pumpe: schlitten, pumpeZ: 0, pumpeWeg: 0.035, pumpeHand: false, pumpeDauer: 0.1, pumpeSofort: true, auswurf: true, typ: 'magazin', abstand: 0.34, huefte: [0.14, -0.15, -0.36], rueck: 0.9, feuer: 0.8 };
  }

  waehlen(id) {
    if (this.aktiv === id) return;
    for (const k of Object.keys(this.modelle)) this.modelle[k].gruppe.visible = k === id;
    const m = this.modelle[id];
    if (this.feuer.parent) this.feuer.parent.remove(this.feuer);
    m.gruppe.add(this.feuer);
    this.feuer.position.set(m.muendung[0], m.muendung[1], m.muendung[2] - 0.06);
    this.aktiv = id;
    this.heben = 0;
  }

  /* Hochnehmen, z. B. nach dem Spawn. */
  hochnehmen() {
    this.heben = 0;
  }

  groesse(breite, hoehe) {
    this.kamera.aspect = breite / Math.max(1, hoehe);
    this.kamera.updateProjectionMatrix();
  }

  /* z: Zustand aus der Simulation fuer dieses Bild (siehe app.js). */
  aktualisieren(z, dt) {
    const m = this.modelle[z.waffe];
    if (!m) return;
    this.waehlen(z.waffe);
    this.zeit += dt;

    // Neue Schuesse erkennen
    let neuerSchuss = false;
    if (this.schuesse !== z.schuesse) {
      if (this.schuesse >= 0 && z.schuesse > this.schuesse) neuerSchuss = true;
      this.schuesse = z.schuesse;
    }
    if (neuerSchuss) {
      const staerke = m.rueck;
      this.rueck = Math.min(2.5, this.rueck + staerke * (1 - 0.45 * z.visier));
      this.rueckDreh = Math.min(2.5, this.rueckDreh + staerke);
      this.feuerBis = this.zeit + 0.045;
      const s = (0.07 + Math.random() * 0.05) * m.feuer;
      this.feuer.scale.set(s, s, 1);
      if (m.auswurf) this.huelseAuswerfen(m);
      if (m.pumpe) this.pumpe = 0;
    }
    this.feuer.visible = this.zeit < this.feuerBis;

    // Glaettung der Haltungen
    this.visier = z.visier;
    this.sprint = naeher(this.sprint, z.sprint ? 1 : 0, 8, dt);
    this.ducken = naeher(this.ducken, z.geduckt ? 1 : 0, 8, dt);
    this.heben = Math.min(1, this.heben + dt / 0.38);
    this.rueck = naeher(this.rueck, 0, 16, dt);
    this.rueckDreh = naeher(this.rueckDreh, 0, 11, dt);
    if (z.landung > 0) this.landung = Math.min(1, z.landung / 9);
    this.landung = naeher(this.landung, 0, 7, dt);

    // Nachziehen beim Umsehen (Sway)
    const sollX = Math.max(-0.05, Math.min(0.05, -z.blickDx * 0.35));
    const sollY = Math.max(-0.05, Math.min(0.05, z.blickDy * 0.35));
    this.swayX = naeher(this.swayX, sollX, 10, dt);
    this.swayY = naeher(this.swayY, sollY, 10, dt);

    // Laufwackeln
    const tempo = z.amBoden ? z.tempo : 0;
    this.phase += tempo * dt * (z.sprint ? 1.55 : 2.0);
    const amp = Math.min(1.4, tempo / 4.8) * (1 - 0.97 * this.visier) * (z.rutschen ? 0.2 : 1);
    const bobX = Math.sin(this.phase) * 0.011 * amp * (1 + this.sprint * 1.2);
    const bobY = -Math.abs(Math.cos(this.phase)) * 0.009 * amp * (1 + this.sprint * 1.4);
    const atmen = Math.sin(this.zeit * 1.6) * 0.0018 * (1 - this.visier);

    // Grundhaltung: Huefte -> Visier, dazu Sprint
    const v = glatt(this.visier);
    const hx = m.huefte[0], hy = m.huefte[1], hz = m.huefte[2];
    const ax = -m.visier[0], ay = -m.visier[1], az = -m.abstand - m.visier[2];
    let px = hx + (ax - hx) * v;
    let py = hy + (ay - hy) * v;
    let pz = hz + (az - hz) * v;
    let rx = 0, ry = 0, rz = 0;
    const sp = glatt(this.sprint) * (1 - v);
    px += (-0.02 - px) * sp * 0.6;
    py += (-0.24 - py) * sp;
    pz += (-0.3 - pz) * sp;
    rx += 0.3 * sp;
    ry += 0.85 * sp;
    rz += 0.35 * sp;
    // Rutschen/Ducken: Waffe leicht gekippt
    rz += this.ducken * 0.06 * (1 - v);

    // Nachladen
    let links = 0;
    if (z.laden >= 0) {
      const p = z.laden;
      if (m.typ === 'magazin') {
        const kipp = glatt(Math.min(1, p / 0.15)) * glatt(Math.min(1, (1 - p) / 0.15));
        rz += 0.55 * kipp;
        rx += -0.28 * kipp;
        py += -0.06 * kipp;
        // Magazin: raus (0,2-0,4), neues rein (0,55-0,75)
        let magOff = 0;
        if (p > 0.18 && p < 0.42) magOff = glatt((p - 0.18) / 0.24);
        else if (p >= 0.42 && p < 0.55) magOff = 1;
        else if (p >= 0.55 && p < 0.76) magOff = 1 - glatt((p - 0.55) / 0.21);
        m.magazin.position.y = m.magazinY - magOff * 0.28;
        m.magazin.visible = magOff < 0.98;
        links = p > 0.15 && p < 0.8 ? Math.sin(((p - 0.15) / 0.65) * Math.PI) : 0;
        if (p > 0.84 && p < 0.95) pz += 0.02 * Math.sin(((p - 0.84) / 0.11) * Math.PI);
      } else {
        const kipp = glatt(Math.min(1, p / 0.12)) * glatt(Math.min(1, (1 - p) / 0.12));
        rz += -0.4 * kipp;
        rx += -0.18 * kipp;
        py += -0.03 * kipp;
        const zyklus = z.ladenPhase === 2 ? (this.zeit * 2) % 1 : 0;
        links = z.ladenPhase === 2 ? Math.sin(zyklus * Math.PI) : 0;
        if (m.patrone) m.patrone.visible = z.ladenPhase === 2 && zyklus < 0.6;
      }
    } else {
      if (m.magazin) {
        m.magazin.position.y = m.magazinY;
        m.magazin.visible = true;
      }
      if (m.patrone) m.patrone.visible = false;
    }
    if (m.links) {
      m.links.position.set(m.linksPos.x - links * 0.03, m.linksPos.y - links * 0.1, m.linksPos.z + links * 0.12);
    }

    // Pumpe der Schrotflinte, Kammerstengel, Pistolenschlitten
    if (m.pumpe) {
      this.pumpe = Math.min(1, this.pumpe + dt / m.pumpeDauer);
      const start = m.pumpeSofort ? 0 : 0.35;
      const zurueck = this.pumpe < start ? 0 : Math.sin(Math.min(1, (this.pumpe - start) / (1 - start)) * Math.PI);
      m.pumpe.position.z = m.pumpeZ + zurueck * m.pumpeWeg;
      if (m.pumpeHand && !(z.laden >= 0)) m.links.position.z = m.linksPos.z + zurueck * m.pumpeWeg;
    }

    // Hochnehmen und Landung
    const h = 1 - glatt(this.heben);
    py += -0.22 * h - this.landung * 0.035 * (1 - 0.8 * v);
    rx += -0.55 * h;

    // Im vollen Visier liegt der Visierpunkt genau in der Bildmitte - dort,
    // wohin die Kugeln fliegen. Alles, was die Visierlinie verschieben
    // wuerde (Nachziehen, Kippen beim Rueckstoss), blendet darum mit dem
    // Visier aus; der Stoss nach hinten bleibt, er liegt auf der Linie.
    const frei = 1 - v;
    pz += this.rueck * 0.028 * (1 - 0.5 * v);
    py += this.rueck * 0.004 * frei;
    rx += this.rueckDreh * 0.045 * frei;

    // Mit Zielfernrohr im Auge sieht man durch das Rohr, nicht die Waffe.
    this.fernrohr = !!z.fernrohr && this.visier > 0.9;
    this.halter.visible = !this.fernrohr;
    this.halter.position.set(px + bobX + this.swayX * frei, py + bobY + atmen + this.swayY * frei, pz);
    this.halter.rotation.set(rx + this.swayY * 0.6 * frei, ry - this.swayX * 0.5 * frei, rz + bobX * 2);

    // Huelsen
    for (const s of this.huelsen) {
      if (s.t > 0.5) { s.m.visible = false; continue; }
      s.t += dt;
      s.vy -= 3.5 * dt;
      s.m.position.x += s.vx * dt;
      s.m.position.y += s.vy * dt;
      s.m.position.z += s.vz * dt;
      s.m.rotation.x += dt * 20;
      s.m.rotation.z += dt * 14;
      s.m.visible = true;
    }
  }

  huelseAuswerfen(m) {
    const s = this.huelsen[this.huelseI++ % this.huelsen.length];
    s.t = 0;
    s.m.position.set(this.halter.position.x + 0.02, this.halter.position.y + 0.04, this.halter.position.z - 0.02);
    s.vx = 0.9 + Math.random() * 0.4;
    s.vy = 0.8 + Math.random() * 0.3;
    s.vz = 0.25 + (m.typ === 'magazin' ? 0 : 0.1);
  }

  entsorgen() {
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
    for (const t of this.texturen) t.dispose();
  }
}

/* Feuer-Material fuer die Figuren der Bots (geteilt). */
export function feuerSpriteMaterial() {
  const t = feuerTextur();
  const m = new SpriteMaterial({ map: t, blending: AdditiveBlending, depthWrite: false, transparent: true });
  return { material: m, textur: t };
}

