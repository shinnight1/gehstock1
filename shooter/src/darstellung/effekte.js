/* ------------------------------------------------------------------
   Kurzlebige Effekte: Leuchtspur, Farbkleckse, Staub- und Farbwolken.

   Geuebt wird mit Markierungsmunition: Einschlaege hinterlassen Kleckse
   in der Farbe des Schuetzen, Treffer an Figuren eine kleine Farbwolke.
   Alles kommt aus festen Vorraeten, die beim Start angelegt werden - im
   Spiel entsteht kein einziges neues Objekt.
   ------------------------------------------------------------------ */

import {
  AdditiveBlending, BoxGeometry, Mesh, MeshBasicMaterial, MeshLambertMaterial, PlaneGeometry,
  Quaternion, Sprite, SpriteMaterial, Vector3,
} from 'three';
import { klecksTextur, weichTextur } from './texturen.js';

const Z = new Vector3(0, 0, 1);
const V = new Vector3();
const Q = new Quaternion();
const QR = new Quaternion();

export const FARBEN = ['#3f86ff', '#ff4a3a', '#c9c3b5'];

export class Effekte {
  constructor(szene, qualitaet) {
    this.szene = szene;
    const viel = qualitaet !== 'niedrig';
    this.dinge = [];

    // Leuchtspuren: kurze Striche, die den Schussweg entlangfliegen
    this.spurGeo = new BoxGeometry(1, 1, 1);
    this.spurGeo.translate(0, 0, -0.5);
    this.spurMat = new MeshBasicMaterial({ color: '#ffe3a0', transparent: true, opacity: 0.85, blending: AdditiveBlending, depthWrite: false });
    this.spuren = [];
    for (let i = 0; i < (viel ? 24 : 12); i++) {
      const m = new Mesh(this.spurGeo, this.spurMat);
      m.visible = false;
      m.frustumCulled = false;
      szene.add(m);
      this.spuren.push({ m, t: 1, l: 0, ax: 0, ay: 0, az: 0, dx: 0, dy: 0, dz: 0 });
    }
    this.spurI = 0;

    // Kleckse: je Team ein Material
    this.klecksTex = klecksTextur(3);
    this.klecksGeo = new PlaneGeometry(0.3, 0.3);
    this.klecksMat = FARBEN.map((f) => new MeshLambertMaterial({
      map: this.klecksTex, color: f, transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    }));
    this.kleckse = [];
    for (let i = 0; i < (viel ? 56 : 24); i++) {
      const m = new Mesh(this.klecksGeo, this.klecksMat[2]);
      m.visible = false;
      m.renderOrder = 3;
      m.receiveShadow = true;
      szene.add(m);
      this.kleckse.push(m);
    }
    this.klecksI = 0;

    // Wolken (Staub, Farbe) - je Sprite ein eigenes Material fuer die Deckkraft
    this.weich = weichTextur();
    this.wolken = [];
    for (let i = 0; i < (viel ? 28 : 12); i++) {
      const mat = new SpriteMaterial({ map: this.weich, color: '#ffffff', transparent: true, depthWrite: false, opacity: 0 });
      const s = new Sprite(mat);
      s.visible = false;
      szene.add(s);
      this.wolken.push({ s, mat, t: 1, dauer: 0.35, groesse: 0.3, steig: 0.4 });
    }
    this.wolkeI = 0;
  }

  spur(ax, ay, az, bx, by, bz) {
    const s = this.spuren[this.spurI++ % this.spuren.length];
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const l = Math.hypot(dx, dy, dz);
    if (l < 1.5) return;
    s.ax = ax; s.ay = ay; s.az = az;
    s.dx = dx / l; s.dy = dy / l; s.dz = dz / l;
    s.l = l;
    s.t = 0;
    V.set(s.dx, s.dy, s.dz);
    // Der Strich liegt lokal auf -Z hinter seinem Ursprung (der Spitze):
    // +Z zeigt in Flugrichtung, der Schweif bleibt dahinter.
    Q.setFromUnitVectors(Z, V);
    s.m.quaternion.copy(Q);
    s.m.visible = true;
  }

  klecks(x, y, z, nx, ny, nz, team, zufall) {
    const m = this.kleckse[this.klecksI++ % this.kleckse.length];
    m.material = this.klecksMat[team >= 0 && team < 2 ? team : 2];
    m.position.set(x + nx * 0.01, y + ny * 0.01, z + nz * 0.01);
    V.set(nx, ny, nz);
    if (V.lengthSq() < 0.5) V.set(0, 1, 0);
    Q.setFromUnitVectors(Z, V.normalize());
    QR.setFromAxisAngle(Z, zufall * Math.PI * 2);
    m.quaternion.copy(Q).multiply(QR);
    const s = 0.7 + zufall * 0.6;
    m.scale.set(s, s, 1);
    m.visible = true;
  }

  wolke(x, y, z, farbe, groesse, dauer) {
    const w = this.wolken[this.wolkeI++ % this.wolken.length];
    w.s.position.set(x, y, z);
    w.mat.color.set(farbe);
    w.groesse = groesse;
    w.dauer = dauer || 0.35;
    w.t = 0;
    w.s.visible = true;
  }

  aktualisieren(dt) {
    for (const s of this.spuren) {
      if (!s.m.visible) continue;
      s.t += dt;
      const kopf = s.t * 320;
      if (kopf - 3 > s.l) {
        s.m.visible = false;
        continue;
      }
      const vorn = Math.min(kopf, s.l);
      const hinten = Math.max(0, kopf - 3);
      s.m.position.set(s.ax + s.dx * vorn, s.ay + s.dy * vorn, s.az + s.dz * vorn);
      s.m.scale.set(0.02, 0.02, Math.max(0.01, vorn - hinten));
    }
    for (const w of this.wolken) {
      if (!w.s.visible) continue;
      w.t += dt;
      const p = w.t / w.dauer;
      if (p >= 1) {
        w.s.visible = false;
        continue;
      }
      const g = w.groesse * (0.5 + p * 1.2);
      w.s.scale.set(g, g, 1);
      w.s.position.y += dt * 0.4;
      w.mat.opacity = (1 - p) * 0.75;
    }
  }

  leeren() {
    for (const s of this.spuren) s.m.visible = false;
    for (const k of this.kleckse) k.visible = false;
    for (const w of this.wolken) w.s.visible = false;
  }

  entsorgen() {
    for (const s of this.spuren) this.szene.remove(s.m);
    for (const k of this.kleckse) this.szene.remove(k);
    for (const w of this.wolken) {
      this.szene.remove(w.s);
      w.mat.dispose();
    }
    this.spurGeo.dispose();
    this.spurMat.dispose();
    this.klecksGeo.dispose();
    this.klecksTex.dispose();
    for (const m of this.klecksMat) m.dispose();
    this.weich.dispose();
  }
}
