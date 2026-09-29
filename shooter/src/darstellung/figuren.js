/* ------------------------------------------------------------------
   Soldatenfiguren fuer Bots (und den Spieler im Todesbild).

   Aus Quadern gebaut, aber mit Gliedern: Beine mit Knie, Rumpf mit
   Weste und Rucksack, Kopf mit Helm und Brille, Arme im Anschlag, Waffe
   in der Hand. Weste und Helm tragen die Teamfarbe - Blau gegen Rot,
   gut lesbar auch auf Distanz. Verbuendete tragen zusaetzlich ihren
   Namen ueber dem Kopf.

   Jedes starre Glied ist eine einzige, verschmolzene Geometrie mit
   Eckfarben; alle Figuren teilen sich ein Material. So kostet ein
   Soldat rund acht Zeichenaufrufe. Nur die Weste hat je Figur ein
   eigenes Material, damit sie bei einem Treffer kurz aufleuchten kann.
   Die Fussschatten aller Figuren sind ein einziges Instanz-Mesh.
   ------------------------------------------------------------------ */

import {
  BoxGeometry, CylinderGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshLambertMaterial, Object3D, PlaneGeometry, Quaternion, Sprite, SpriteMaterial, Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FIGUR, TEAMS } from '../konfig.js';
import { namensTextur, schattenTextur } from './texturen.js';
import { gefaerbt } from './verschmelzen.js';

const TEAMFARBE = [
  { weste: '#2e6ee6', helm: '#24519e' },
  { weste: '#e2412f', helm: '#9e2c22' },
];
const F = {
  uniform: '#56603f',
  uniformDunkel: '#454d33',
  haut: '#c79a74',
  brille: '#1c2024',
  stiefel: '#2e2a24',
  handschuh: '#23252a',
  waffe: '#26292d',
  waffeHell: '#3a3f44',
  rucksack: '#4b5436',
  holz: '#6a4a2c',
};

const M = new Matrix4();
const Q = new Quaternion();
const S = new Vector3(1, 1, 1);
const P = new Vector3();
const HOCH = new Vector3(0, 1, 0);
const LEER = new Matrix4().makeScale(0, 0, 0);
const DUMMY = new Object3D();

/* Teil: Quader bx*by*bz an Position (x,y,z), optional um die Achse
   zwischen zwei Punkten ausgerichtet. */
function quader(bx, by, bz, x, y, z, farbe, dreh) {
  const g = new BoxGeometry(bx, by, bz);
  if (dreh) Q.copy(dreh); else Q.identity();
  M.compose(P.set(x, y, z), Q, S);
  const f = gefaerbt(g, M, farbe);
  g.dispose();
  return f;
}

/* Glied zwischen zwei Punkten. */
function glied(von, nach, dicke, farbe) {
  const d = new Vector3().subVectors(nach, von);
  const l = d.length();
  const q = new Quaternion().setFromUnitVectors(HOCH, d.clone().normalize());
  const mitte = von.clone().addScaledVector(d, 0.5);
  return quader(dicke, l, dicke, mitte.x, mitte.y, mitte.z, farbe, q);
}

function verschmelzen(teile) {
  const g = mergeGeometries(teile, false);
  for (const t of teile) t.dispose();
  g.computeBoundingSphere();
  return g;
}

export class Figuren {
  constructor(szene) {
    this.szene = szene;
    this.liste = [];
    this.material = new MeshLambertMaterial({ vertexColors: true });
    this.mats = [this.material];
    this.texturen = [];
    this.geos = this.geometrienBauen();

    const schatten = schattenTextur();
    this.texturen.push(schatten);
    this.matSchatten = new MeshBasicMaterial({ map: schatten, transparent: true, depthWrite: false });
    this.mats.push(this.matSchatten);
    const sg = new PlaneGeometry(1.0, 1.0);
    sg.rotateX(-Math.PI / 2);
    this.geos.schatten = sg;
    this.schatten = new InstancedMesh(sg, this.matSchatten, 8);
    this.schatten.renderOrder = 2;
    this.schatten.frustumCulled = false;
    for (let i = 0; i < 8; i++) this.schatten.setMatrixAt(i, LEER);
    szene.add(this.schatten);
  }

  geometrienBauen() {
    const v = (x, y, z) => new Vector3(x, y, z);
    const g = {};
    // Beine: Oberschenkel haengt vom Hueftgelenk, Wade samt Stiefel vom Knie
    g.schenkel = verschmelzen([quader(0.17, 0.47, 0.2, 0, -0.235, 0, F.uniform)]);
    g.wade = verschmelzen([
      quader(0.15, 0.42, 0.17, 0, -0.21, 0, F.uniformDunkel),
      quader(0.16, 0.1, 0.29, 0, -0.43, -0.05, F.stiefel),
    ]);
    // Rumpf mit Rucksack, Armen und Haenden (Anschlag nach vorn, -Z)
    const schulterR = v(0.27, 0.5, 0), ellR = v(0.25, 0.28, -0.14), griffR = v(0.1, 0.3, -0.3);
    const schulterL = v(-0.27, 0.5, 0), ellL = v(-0.22, 0.3, -0.26), griffL = v(0.02, 0.34, -0.56);
    g.rumpf = verschmelzen([
      quader(0.44, 0.58, 0.25, 0, 0.3, 0, F.uniform),
      quader(0.36, 0.38, 0.16, 0, 0.34, 0.22, F.rucksack),
      glied(schulterR, ellR, 0.12, F.uniform),
      glied(ellR, griffR, 0.1, F.uniform),
      glied(schulterL, ellL, 0.12, F.uniform),
      glied(ellL, griffL, 0.1, F.uniform),
      quader(0.09, 0.09, 0.09, griffR.x, griffR.y, griffR.z, F.handschuh),
      quader(0.09, 0.09, 0.09, griffL.x, griffL.y, griffL.z, F.handschuh),
    ]);
    g.weste = new BoxGeometry(0.49, 0.4, 0.31);
    g.weste.translate(0, 0.33, 0);
    // Kopf je Team (Helm in Teamfarbe)
    g.kopf = TEAMFARBE.map((t) => verschmelzen([
      quader(0.12, 0.08, 0.12, 0, 0.03, 0, F.haut),
      quader(0.21, 0.24, 0.23, 0, 0.17, 0, F.haut),
      quader(0.29, 0.14, 0.31, 0, 0.3, 0.01, t.helm),
      quader(0.31, 0.03, 0.33, 0, 0.235, 0, t.helm),
      quader(0.2, 0.06, 0.03, 0, 0.2, -0.12, F.brille),
    ]));
    // Waffen (Lauf entlang -Z)
    g.sturmgewehr = verschmelzen([
      quader(0.06, 0.09, 0.42, 0, 0, 0, F.waffe),
      quader(0.05, 0.07, 0.22, 0, -0.005, 0.3, F.waffeHell),
      quader(0.04, 0.16, 0.07, 0, -0.11, -0.05, F.waffe),
      quader(0.03, 0.03, 0.34, 0, 0.012, -0.36, F.waffe),
      quader(0.05, 0.05, 0.07, 0, 0.07, -0.02, F.waffeHell),
    ]);
    g.mp = verschmelzen([
      quader(0.055, 0.085, 0.3, 0, 0, 0, F.waffe),
      quader(0.035, 0.2, 0.05, 0, -0.13, -0.02, F.waffe),
      quader(0.025, 0.025, 0.14, 0, 0.01, -0.22, F.waffe),
      quader(0.02, 0.05, 0.2, 0, 0, 0.24, F.waffeHell),
    ]);
    const lauf = new CylinderGeometry(0.018, 0.018, 0.58, 8);
    M.makeRotationX(Math.PI / 2).setPosition(0, 0.02, -0.4);
    const laufG = gefaerbt(lauf, M, F.waffeHell);
    lauf.dispose();
    g.schrotflinte = verschmelzen([
      quader(0.06, 0.085, 0.28, 0, 0, 0.02, F.waffe),
      laufG,
      quader(0.065, 0.06, 0.17, 0, -0.035, -0.34, F.holz),
      quader(0.05, 0.09, 0.26, 0, -0.02, 0.28, F.holz),
    ]);
    g.muendung = { sturmgewehr: -0.55, mp: -0.3, schrotflinte: -0.7 };
    return g;
  }

  /* Eine Figur fuer einen Akteur anlegen. feuerMaterial ist das geteilte
     SpriteMaterial fuer das Muendungsfeuer. name: Schild ueber dem Kopf
     (Verbuendete) oder null. */
  anlegen(akteur, feuerMaterial, istSpieler, name) {
    const G = this.geos;
    const team = akteur.team;
    const alt = this.liste[akteur.id];
    if (alt) this.entfernen(alt);

    const weste = new MeshLambertMaterial({ color: TEAMFARBE[team].weste, emissive: '#000000' });
    this.mats.push(weste);
    const mesh = (geo, mat) => {
      const m = new Mesh(geo, mat || this.material);
      m.receiveShadow = true;
      return m;
    };

    const wurzel = new Group();
    const koerper = new Group();
    wurzel.add(koerper);
    const huefte = new Group();
    huefte.position.y = 0.95;
    koerper.add(huefte);

    const bein = (seite) => {
      const oben = new Group();
      oben.position.set(0.11 * seite, 0, 0);
      oben.add(mesh(G.schenkel));
      const knie = new Group();
      knie.position.y = -0.47;
      knie.add(mesh(G.wade));
      oben.add(knie);
      huefte.add(oben);
      return { oben, knie };
    };
    const beinL = bein(-1);
    const beinR = bein(1);

    const rumpf = new Group();
    huefte.add(rumpf);
    rumpf.add(mesh(G.rumpf), mesh(G.weste, weste));
    const kopf = new Group();
    kopf.position.y = 0.58;
    kopf.add(mesh(G.kopf[team]));
    rumpf.add(kopf);

    const waffe = new Group();
    waffe.position.set(0.06, 0.37, -0.32);
    rumpf.add(waffe);
    const waffen = {};
    for (const k of ['sturmgewehr', 'mp', 'schrotflinte']) {
      waffen[k] = mesh(G[k]);
      waffen[k].visible = false;
      waffe.add(waffen[k]);
    }
    const feuer = new Sprite(feuerMaterial);
    feuer.scale.set(0.55, 0.55, 1);
    feuer.visible = false;
    waffe.add(feuer);

    const nameText = name || '';
    name = null;
    if (nameText) {
      const t = namensTextur(nameText, TEAMS[team].farbeHell);
      const m = new SpriteMaterial({ map: t, depthTest: false, transparent: true });
      name = new Sprite(m);
      name.scale.set(1.2, 0.3, 1);
      name.renderOrder = 20;
      name.userData.textur = t;
      this.szene.add(name);
    }
    this.szene.add(wurzel);

    const fig = {
      id: akteur.id, team, istSpieler, nameText, wurzel, koerper, huefte, rumpf, kopf, beinL, beinR,
      waffe, waffen, feuer, feuerBis: 0, weste, name,
      phase: 0, schussZaehler: -1, rueck: 0, waffenId: '', todZeit: -1, todDrehung: 1,
    };
    this.liste[akteur.id] = fig;
    return fig;
  }

  entfernen(f) {
    this.szene.remove(f.wurzel);
    if (f.name) {
      this.szene.remove(f.name);
      f.name.material.dispose();
      f.name.userData.textur.dispose();
    }
    f.weste.dispose();
    const i = this.mats.indexOf(f.weste);
    if (i >= 0) this.mats.splice(i, 1);
  }

  schattenSetzen(id, x, y, z, an) {
    if (an) {
      DUMMY.position.set(x, y + 0.02, z);
      DUMMY.updateMatrix();
      this.schatten.setMatrixAt(id, DUMMY.matrix);
    } else {
      this.schatten.setMatrixAt(id, LEER);
    }
    this.schatten.instanceMatrix.needsUpdate = true;
  }

  /* Pro Bild: Figur an den Zustand des Akteurs anpassen. */
  aktualisieren(a, alpha, zeit, dt) {
    const f = this.liste[a.id];
    if (!f) return;
    const x = a.px + (a.x - a.px) * alpha;
    const y = a.py + (a.y - a.py) * alpha;
    const z = a.pz + (a.z - a.pz) * alpha;

    const tot = !a.lebt;
    const seitTod = zeit - a.todesZeit;
    let sichtbar = !f.istSpieler || tot;
    if (tot && seitTod > 3.1) sichtbar = false;
    // Spawnschutz: Figur blinkt
    if (!tot && a.schutz > 0.25 && Math.floor(zeit * 9) % 3 === 0) sichtbar = false;
    f.wurzel.visible = sichtbar;
    this.schattenSetzen(a.id, x, y, z, sichtbar && !tot);
    if (f.name) f.name.visible = !tot && sichtbar;
    if (!sichtbar) return;

    if (f.waffenId !== a.waffe.id) {
      for (const k of Object.keys(f.waffen)) f.waffen[k].visible = k === a.waffe.id;
      f.waffenId = a.waffe.id;
      f.feuer.position.set(0, 0.02, this.geos.muendung[a.waffe.id] - 0.12);
    }

    f.wurzel.position.set(x, y, z);
    if (!tot) f.wurzel.rotation.y = a.yaw;

    if (tot) {
      if (f.todZeit !== a.todesZeit) {
        f.todZeit = a.todesZeit;
        f.todDrehung = a.id % 2 ? 1 : -1;
      }
      const t = Math.min(1, seitTod / 0.45);
      const fall = t * t * (3 - 2 * t);
      f.koerper.rotation.set(fall * Math.PI * 0.5, 0, fall * 0.35 * f.todDrehung);
      f.koerper.position.y = seitTod > 2.2 ? -(seitTod - 2.2) * 0.5 : 0;
      f.huefte.position.y = 0.95;
      f.feuer.visible = false;
      f.weste.emissive.setRGB(0, 0, 0);
      return;
    }
    f.koerper.rotation.set(0, 0, 0);
    f.koerper.position.y = 0;

    // Laufzyklus
    const tempo = Math.hypot(a.vx, a.vz);
    const duck = a.duckAnteil;
    f.phase += tempo * dt * (a.sprintet ? 1.25 : 1.7);
    const schwung = Math.min(1, tempo / 4.5) * (a.amBoden ? 1 : 0.25);
    const s = Math.sin(f.phase), c = Math.cos(f.phase);
    f.huefte.position.y = 0.95 - duck * 0.4 - Math.abs(c) * 0.035 * schwung;
    const knick = -1.25 * duck;
    if (a.amBoden) {
      f.beinL.oben.rotation.x = s * 0.62 * schwung + knick;
      f.beinR.oben.rotation.x = -s * 0.62 * schwung + knick;
      f.beinL.knie.rotation.x = Math.max(0, -Math.cos(f.phase + 0.6)) * 0.9 * schwung + duck * 1.9;
      f.beinR.knie.rotation.x = Math.max(0, Math.cos(f.phase + 0.6)) * 0.9 * schwung + duck * 1.9;
    } else {
      f.beinL.oben.rotation.x = -0.5;
      f.beinR.oben.rotation.x = 0.1;
      f.beinL.knie.rotation.x = 0.9;
      f.beinR.knie.rotation.x = 0.4;
    }

    // Rumpf folgt dem Blick nach oben/unten, beim Sprint nach vorn geneigt
    const pitch = a.ppitch + (a.pitch - a.ppitch) * alpha;
    f.rumpf.rotation.x = pitch * 0.65 + (a.sprintet ? -0.28 : 0) + duck * 0.15;
    f.kopf.rotation.x = pitch * 0.35;

    // Rueckstoss beim Schiessen, Muendungsfeuer
    if (f.schussZaehler !== a.waffe.schuesse) {
      if (f.schussZaehler >= 0) {
        f.rueck = 1;
        f.feuerBis = zeit + 0.05;
      }
      f.schussZaehler = a.waffe.schuesse;
    }
    f.rueck *= Math.exp(-dt * 18);
    f.waffe.position.z = -0.32 + f.rueck * 0.05;
    f.feuer.visible = zeit < f.feuerBis;

    // Nachladen: Waffe kippt
    const w = a.waffe;
    const laden = w.laden > 0 ? Math.sin(Math.min(1, 1 - w.laden / Math.max(0.01, w.ladenGesamt)) * Math.PI) : 0;
    f.waffe.rotation.set(-laden * 0.5, 0, laden * 0.5);

    // Trefferleuchten der Weste
    const seitTreffer = zeit - a.getroffenZeit;
    const glut = seitTreffer < 0.12 ? 1 - seitTreffer / 0.12 : 0;
    f.weste.emissive.setRGB(glut * 0.9, glut * 0.9, glut * 0.9);

    if (f.name) f.name.position.set(x, y + FIGUR.hoehe * (1 - duck * 0.33) + 0.42, z);
  }

  alleVerstecken() {
    for (const f of this.liste) {
      if (!f) continue;
      f.wurzel.visible = false;
      if (f.name) f.name.visible = false;
      this.schattenSetzen(f.id, 0, 0, 0, false);
    }
  }

  entsorgen() {
    for (const f of this.liste) if (f) this.entfernen(f);
    this.liste.length = 0;
    this.szene.remove(this.schatten);
    for (const k of Object.keys(this.geos)) {
      const g = this.geos[k];
      if (Array.isArray(g)) g.forEach((x) => x.dispose());
      else if (g && g.dispose) g.dispose();
    }
    for (const m of this.mats) m.dispose();
    for (const t of this.texturen) t.dispose();
  }
}
