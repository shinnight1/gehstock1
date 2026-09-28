/* ------------------------------------------------------------------
   Aus der Kartenbeschreibung wird die sichtbare Welt.

   Alle Quader einer Materialsorte landen in einer einzigen Geometrie:
   die ganze Karte kostet so rund ein Dutzend Zeichenaufrufe. Texturen
   liegen in Weltkoordinaten (Wellblech laeuft ueber Containergrenzen
   hinweg gleichmaessig), Kisten bekommen je Seite eine ganze Textur.

   Ein paar billige Tricks fuer Tiefe:
     - Seitenflaechen werden zum Boden hin dunkler (Umgebungsverdeckung
       ueber Eckfarben, kostet nichts beim Zeichnen),
     - um jeden Quader liegt ein weicher dunkler Saum auf dem Boden
       (Kontaktschatten),
     - die Sonne wirft einen Schatten, der nur einmal berechnet wird -
       die Welt bewegt sich ja nicht.
   ------------------------------------------------------------------ */

import {
  BackSide, BoxGeometry, BufferGeometry, Color, ConeGeometry, CylinderGeometry, DoubleSide,
  Float32BufferAttribute, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshLambertMaterial, PlaneGeometry, Quaternion, SphereGeometry, Sprite, SpriteMaterial, Vector3,
} from 'three';
import { zufallsquelle } from '../sim/mathe.js';
import { flaggenTextur, schildTextur, weichTextur, zielscheibeTextur } from './texturen.js';
import { Verschmelzer } from './verschmelzen.js';

/* uv: 'welt' = Weltkoordinaten / skala, 'lokal' = eine Textur je Flaeche,
   'wv' = waagerecht Welt, senkrecht eine Textur je Flaeche. */
const MATERIALIEN = {
  beton: { tex: 'beton', skala: 2.5, uv: 'welt', farbe: '#ffffff' },
  stufe: { tex: 'beton', skala: 2.5, uv: 'welt', farbe: '#e8e6dc' },
  mauer: { tex: 'mauer', skala: 4, uv: 'welt', farbe: '#ffffff' },
  container: { tex: 'container', skala: 2, uv: 'wv', farbe: '#ffffff' },
  holz: { tex: 'holz', skala: 1.2, uv: 'lokal', farbe: '#ffffff' },
  sandsack: { tex: 'sandsack', skala: 1.3, uv: 'welt', farbe: '#ffffff' },
  hesco: { tex: 'hesco', skala: 1.1, uv: 'welt', farbe: '#ffffff' },
  metall: { tex: 'metall', skala: 1.2, uv: 'welt', farbe: '#9aa0a5' },
  plane: { tex: 'plane', skala: 2, uv: 'welt', farbe: '#ffffff' },
  barriere: { tex: 'barriere', skala: 1.5, uv: 'wv', farbe: '#ffffff' },
  halle: { tex: 'halle', skala: 2.4, uv: 'welt', farbe: '#ffffff' },
  regal: { tex: 'regal', skala: 2.3, uv: 'wv', farbe: '#ffffff' },
  dach: { tex: 'dach', skala: 1.5, uv: 'welt', farbe: '#ffffff' },
};

const BODEN = {
  kies: { skala: 3.2 },
  asphalt: { skala: 4.5 },
  platten: { skala: 4 },
  estrich: { skala: 5 },
};

const FLAECHEN = [
  { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0], o: (q) => [q.max[0], q.min[1], q.max[2]], lu: 2, lv: 1, seite: true },
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], o: (q) => [q.min[0], q.min[1], q.min[2]], lu: 2, lv: 1, seite: true },
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], o: (q) => [q.min[0], q.min[1], q.max[2]], lu: 0, lv: 1, seite: true },
  { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0], o: (q) => [q.max[0], q.min[1], q.min[2]], lu: 0, lv: 1, seite: true },
  { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1], o: (q) => [q.min[0], q.max[1], q.max[2]], lu: 0, lv: 2, seite: false, oben: true },
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], o: (q) => [q.min[0], q.min[1], q.min[2]], lu: 0, lv: 2, seite: false },
];

/* Sammelt Vierecke und macht daraus eine Geometrie. */
class Bau {
  constructor(alpha) {
    this.pos = [];
    this.nor = [];
    this.uv = [];
    this.col = [];
    this.idx = [];
    this.alpha = !!alpha;
  }

  punkt(x, y, z, nx, ny, nz, u, v, r, g, b, a) {
    this.pos.push(x, y, z);
    this.nor.push(nx, ny, nz);
    this.uv.push(u, v);
    if (this.alpha) this.col.push(r, g, b, a);
    else this.col.push(r, g, b);
  }

  /* Viereck aus Ursprung o und den Kantenvektoren du, dv (du x dv zeigt
     nach aussen). uvs: [u0,v0,u1,v1,u2,v2,u3,v3], farben je Ecke. */
  viereck(o, du, dv, n, uvs, f0, f1, f2, f3) {
    const i = this.pos.length / 3;
    const p = [
      [o[0], o[1], o[2]],
      [o[0] + du[0], o[1] + du[1], o[2] + du[2]],
      [o[0] + du[0] + dv[0], o[1] + du[1] + dv[1], o[2] + du[2] + dv[2]],
      [o[0] + dv[0], o[1] + dv[1], o[2] + dv[2]],
    ];
    const f = [f0, f1, f2, f3];
    for (let k = 0; k < 4; k++) {
      this.punkt(p[k][0], p[k][1], p[k][2], n[0], n[1], n[2], uvs[k * 2], uvs[k * 2 + 1], f[k][0], f[k][1], f[k][2], f[k][3]);
    }
    this.idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
  }

  dreieck(a, b, c, n, uvs, farbe) {
    const i = this.pos.length / 3;
    for (const [k, p] of [a, b, c].entries()) {
      this.punkt(p[0], p[1], p[2], n[0], n[1], n[2], uvs[k * 2], uvs[k * 2 + 1], farbe[0], farbe[1], farbe[2], farbe[3]);
    }
    this.idx.push(i, i + 1, i + 2);
  }

  leer() {
    return this.idx.length === 0;
  }

  geometrie() {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new Float32BufferAttribute(this.col, this.alpha ? 4 : 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

function farbeLinear(hex) {
  const c = new Color(hex);
  return [c.r, c.g, c.b, 1];
}

const skal = (f, s) => [f[0] * s, f[1] * s, f[2] * s, f[3]];

function dot(p, a) {
  return p[0] * a[0] + p[1] * a[1] + p[2] * a[2];
}

/* Ein Quader in eine Sammlung. */
function quaderEintragen(bau, q, def) {
  const tint = farbeLinear(q.farbe || '#ffffff');
  const laengen = [q.max[0] - q.min[0], q.max[1] - q.min[1], q.max[2] - q.min[2]];
  const ruht = q.min[1] < 1.3;
  for (const F of FLAECHEN) {
    if (!F.seite && !F.oben && q.min[1] < 0.01) continue; // Unterseite am Boden sieht niemand
    const o = F.o(q);
    const LU = laengen[F.lu];
    const LV = laengen[F.lv];
    const uvFuer = (p, fo) => {
      if (def.uv === 'lokal') {
        return [dot([p[0] - fo[0], p[1] - fo[1], p[2] - fo[2]], F.u) / LU, dot([p[0] - fo[0], p[1] - fo[1], p[2] - fo[2]], F.v) / LV];
      }
      if (def.uv === 'wv' && F.seite) {
        return [dot(p, F.u) / def.skala, (p[1] - q.min[1]) / LV];
      }
      return [dot(p, F.u) / def.skala, dot(p, F.v) / def.skala];
    };
    const teil = (v0, v1, hell0, hell1) => {
      const oo = [o[0] + F.v[0] * v0, o[1] + F.v[1] * v0, o[2] + F.v[2] * v0];
      const du = [F.u[0] * LU, F.u[1] * LU, F.u[2] * LU];
      const dv = [F.v[0] * (v1 - v0), F.v[1] * (v1 - v0), F.v[2] * (v1 - v0)];
      const ecken = [oo, [oo[0] + du[0], oo[1] + du[1], oo[2] + du[2]],
        [oo[0] + du[0] + dv[0], oo[1] + du[1] + dv[1], oo[2] + du[2] + dv[2]],
        [oo[0] + dv[0], oo[1] + dv[1], oo[2] + dv[2]]];
      const uvs = [];
      for (const e of ecken) uvs.push(...uvFuer(e, o));
      bau.viereck(oo, du, dv, F.n, uvs, skal(tint, hell0), skal(tint, hell0), skal(tint, hell1), skal(tint, hell1));
    };
    if (F.seite && ruht) {
      if (LV > 1.5) {
        teil(0, 1.2, 0.6, 1);
        teil(1.2, LV, 1, 1);
      } else {
        teil(0, LV, 0.68, 1);
      }
    } else if (F.seite) {
      teil(0, LV, 0.92, 1);
    } else {
      teil(0, LV, F.oben ? 1 : 0.8, F.oben ? 1 : 0.8);
    }
  }
}

/* Weicher Saum um den Fuss eines Quaders. */
function kontaktschatten(bau, q) {
  const y = q.min[1] + 0.012;
  const x0 = q.min[0], x1 = q.max[0], z0 = q.min[2], z1 = q.max[2];
  const klein = Math.min(x1 - x0, z1 - z0) < 0.8;
  const w = klein ? 0.3 : 0.55;
  const a = klein ? 0.3 : 0.42;
  const innen = [0, 0, 0, a], aussen = [0, 0, 0, 0];
  const n = [0, 1, 0];
  const uv = [0, 0, 0, 0, 0, 0, 0, 0];
  /* Nach oben zeigende Vierecke: du entlang +X, dv entlang -Z.
     Reihenfolge Norden, Sueden, Westen, Osten. */
  bau.viereck([x0 - w, y, z0], [x1 - x0 + 2 * w, 0, 0], [0, 0, -w], n, uv, innen, innen, aussen, aussen);
  bau.viereck([x0 - w, y, z1 + w], [x1 - x0 + 2 * w, 0, 0], [0, 0, -w], n, uv, aussen, aussen, innen, innen);
  bau.viereck([x0 - w, y, z1], [w, 0, 0], [0, 0, -(z1 - z0)], n, uv, aussen, innen, innen, aussen);
  bau.viereck([x1, y, z1], [w, 0, 0], [0, 0, -(z1 - z0)], n, uv, innen, aussen, aussen, innen);
}

/* ------------------------------------------------------------- Welt */

export function weltBauen(karte, tex, qualitaet) {
  const gruppe = new Group();
  gruppe.name = 'welt';
  const entsorgen = [];
  const animiert = [];
  const merken = (x) => { entsorgen.push(x); return x; };

  /* --- Quader nach Material */
  const baus = {};
  const saum = new Bau(true);
  for (const q of karte.quader) {
    if (q.mat === 'unsichtbar') continue;
    const def = MATERIALIEN[q.mat] || MATERIALIEN.beton;
    const b = baus[q.mat] || (baus[q.mat] = new Bau(false));
    quaderEintragen(b, q, def);
    if (q.min[1] < 1.3 && q.mat !== 'metall' && (q.max[1] - q.min[1]) > 0.3) kontaktschatten(saum, q);
  }
  // Fasser bekommen ebenfalls einen Saum
  for (const d of karte.deko) {
    if (d.typ === 'fass') kontaktschatten(saum, { min: [d.x - 0.3, 0, d.z - 0.3], max: [d.x + 0.3, 0.9, d.z + 0.3] });
  }
  for (const name of Object.keys(baus)) {
    const def = MATERIALIEN[name] || MATERIALIEN.beton;
    const mat = merken(new MeshLambertMaterial({ map: tex[def.tex], color: def.farbe, vertexColors: true }));
    const mesh = new Mesh(merken(baus[name].geometrie()), mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = 'quader-' + name;
    gruppe.add(mesh);
  }

  /* --- Bodenflaechen */
  const boeden = {};
  for (const f of karte.boden) {
    const s = (BODEN[f.mat] || BODEN.kies).skala;
    const b = boeden[f.mat] || (boeden[f.mat] = new Bau(false));
    const weiss = [1, 1, 1, 1];
    b.viereck([f.x0, 0, f.z1], [f.x1 - f.x0, 0, 0], [0, 0, -(f.z1 - f.z0)], [0, 1, 0],
      [f.x0 / s, -f.z1 / s, f.x1 / s, -f.z1 / s, f.x1 / s, -f.z0 / s, f.x0 / s, -f.z0 / s],
      weiss, weiss, weiss, weiss);
  }
  for (const name of Object.keys(boeden)) {
    const mat = merken(new MeshLambertMaterial({ map: tex[name], vertexColors: true }));
    const mesh = new Mesh(merken(boeden[name].geometrie()), mat);
    mesh.receiveShadow = true;
    mesh.name = 'boden-' + name;
    gruppe.add(mesh);
  }

  /* --- Kontaktschatten */
  if (qualitaet !== 'niedrig' && !saum.leer()) {
    const mat = merken(new MeshBasicMaterial({
      color: 0xffffff, vertexColors: true, transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }));
    const mesh = new Mesh(merken(saum.geometrie()), mat);
    mesh.renderOrder = 1;
    mesh.name = 'kontaktschatten';
    gruppe.add(mesh);
  }

  /* --- Bodenmarkierungen */
  markierungenBauen(karte, gruppe, merken);

  /* --- Deko */
  dekoBauen(karte, tex, gruppe, merken, animiert);

  return {
    gruppe,
    animiert,
    entsorgen() {
      for (const x of entsorgen) x.dispose();
      entsorgen.length = 0;
    },
  };
}

/* ------------------------------------------------------ Markierungen */

function markierungenBauen(karte, gruppe, merken) {
  const b = new Bau(false);
  const y = 0.006;
  const n = [0, 1, 0];
  const uv = [0, 0, 0, 0, 0, 0, 0, 0];
  const streifen = (x0, z0, x1, z1, breite, farbe) => {
    const f = farbeLinear(farbe);
    const dx = x1 - x0, dz = z1 - z0;
    const l = Math.hypot(dx, dz) || 1;
    // links der Laufrichtung (von oben gesehen)
    const nx = -dz / l * breite / 2, nz = dx / l * breite / 2;
    const o = [x0 - nx, y, z0 - nz];
    const du = [dx, 0, dz];
    const dv = [2 * nx, 0, 2 * nz];
    // du x dv muss nach oben zeigen, sonst Reihenfolge tauschen
    const kreuzY = du[2] * dv[0] - du[0] * dv[2];
    if (kreuzY > 0) b.viereck(o, du, dv, n, uv, f, f, f, f);
    else b.viereck([o[0] + dv[0], y, o[2] + dv[2]], du, [-dv[0], 0, -dv[2]], n, uv, f, f, f, f);
  };
  const gestrichelt = (x0, z0, x1, z1, breite, farbe, strich, luecke) => {
    const l = Math.hypot(x1 - x0, z1 - z0);
    for (let t = 0; t < l; t += strich + luecke) {
      const a = t / l, e = Math.min(l, t + strich) / l;
      streifen(x0 + (x1 - x0) * a, z0 + (z1 - z0) * a, x0 + (x1 - x0) * e, z0 + (z1 - z0) * e, breite, farbe);
    }
  };
  const ring = (cx, cz, r, breite, farbe, teile) => {
    for (let i = 0; i < teile; i++) {
      const a0 = (i / teile) * Math.PI * 2, a1 = ((i + 1) / teile) * Math.PI * 2;
      streifen(cx + Math.cos(a0) * r, cz + Math.sin(a0) * r, cx + Math.cos(a1) * r, cz + Math.sin(a1) * r, breite, farbe);
    }
  };
  const schraffur = (x0, z0, x1, z1, farbe) => {
    streifen(x0, z0, x1, z0, 0.1, farbe);
    streifen(x0, z1, x1, z1, 0.1, farbe);
    streifen(x0, z0, x0, z1, 0.1, farbe);
    streifen(x1, z0, x1, z1, 0.1, farbe);
    for (let t = 0.6; t < (x1 - x0) + (z1 - z0); t += 0.6) {
      const ax = Math.min(x1, x0 + t), az = z0 + Math.max(0, t - (x1 - x0));
      const bx = x0 + Math.max(0, t - (z1 - z0)), bz = Math.min(z1, z0 + t);
      streifen(ax, az, bx, bz, 0.12, farbe);
    }
  };

  for (const d of karte.deko) {
    if (d.typ !== 'markierung') continue;
    if (d.form === 'basis') {
      const farbe = d.team === 0 ? '#3f7fe8' : '#e0473d';
      const s = d.x < 0 ? -1 : 1;
      streifen(s * 23.7, -20, s * 23.7, 20, 0.25, farbe);
      streifen(s * 24.2, -20, s * 24.2, 20, 0.1, farbe);
      for (let z = -18; z <= 18; z += 6) {
        // Pfeile Richtung Front
        streifen(s * 27.5, z - 0.8, s * 26.2, z, 0.2, '#e8e8e0');
        streifen(s * 27.5, z + 0.8, s * 26.2, z, 0.2, '#e8e8e0');
      }
    } else if (d.form === 'hof') {
      gestrichelt(-21, -10.1, 21, -10.1, 0.14, '#d8b030', 1.4, 1.0);
      gestrichelt(-21, -21.2, -3.4, -21.2, 0.12, '#e8e8e0', 1.0, 1.0);
      gestrichelt(3.4, -21.2, 21, -21.2, 0.12, '#e8e8e0', 1.0, 1.0);
      schraffur(-13.8, -9.9, -11.6, -8.9, '#d8b030');
      schraffur(11.6, -9.9, 13.8, -8.9, '#d8b030');
    } else if (d.form === 'platz') {
      ring(0, 0, 7.4, 0.22, '#e8e8e0', 48);
      ring(0, 0, 7.0, 0.08, '#e8e8e0', 48);
      for (const s of [-1, 1]) {
        for (let i = 0; i < 6; i++) {
          const x = s * (9 + i * 1.6);
          streifen(x - 0.4, s * 6.6, x + 0.4, s * 6.6, 0.12, '#e8e8e0');
        }
        streifen(s * 14.5, -8, s * 14.5, 8.4, 0.12, '#d8b030');
      }
    } else if (d.form === 'halle') {
      for (const z of [14.55, 16.25]) {
        streifen(-15.8, z, -4.8, z, 0.12, '#d8b030');
        streifen(4.8, z, 15.8, z, 0.12, '#d8b030');
      }
      streifen(-15.8, 9.6, 15.8, 9.6, 0.1, '#d8b030');
      streifen(-15.8, 21.0, 15.8, 21.0, 0.1, '#d8b030');
      for (const s of [-1, 1]) {
        schraffur(s > 0 ? 13.4 : -15.8, 12.4, s > 0 ? 15.8 : -13.4, 17.6, '#d8b030');
        schraffur(s > 0 ? 7.2 : -9.4, 9.3, s > 0 ? 9.4 : -7.2, 10.5, '#d8b030');
      }
    }
  }
  if (b.leer()) return;
  const mat = merken(new MeshLambertMaterial({
    vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  }));
  const mesh = new Mesh(merken(b.geometrie()), mat);
  mesh.receiveShadow = true;
  mesh.name = 'markierungen';
  gruppe.add(mesh);
}

/* -------------------------------------------------------------- Deko */

const M4 = new Matrix4();
const Q = new Quaternion();
const V1 = new Vector3();
const V2 = new Vector3(1, 1, 1);

function dekoBauen(karte, tex, gruppe, merken, animiert) {
  // Unbewegliche Deko wird am Ende je Material zusammengefasst.
  const v = new Verschmelzer();
  const metallDunkel = merken(new MeshLambertMaterial({ map: tex.metall, color: '#5c6166' }));
  const gummi = merken(new MeshLambertMaterial({ color: '#1d1f21' }));
  const glas = merken(new MeshLambertMaterial({ color: '#27323b' }));
  const leuchte = merken(new MeshBasicMaterial({ color: '#fff4cc' }));

  /* Faesser: ein Aufruf fuer alle */
  const faesser = karte.deko.filter((d) => d.typ === 'fass');
  if (faesser.length) {
    const geo = merken(new CylinderGeometry(0.3, 0.3, 0.92, 14));
    const mat = merken(new MeshLambertMaterial({ map: tex.metall, color: '#ffffff' }));
    const inst = new InstancedMesh(geo, mat, faesser.length);
    faesser.forEach((d, i) => {
      M4.makeRotationY(i * 1.7);
      M4.setPosition(d.x, 0.46, d.z);
      inst.setMatrixAt(i, M4);
      inst.setColorAt(i, new Color(d.farbe || '#556070'));
    });
    inst.castShadow = true;
    inst.receiveShadow = true;
    inst.name = 'faesser';
    gruppe.add(inst);
  }

  /* Zeltdaecher */
  const zelte = new Bau(false);
  const weiss = [1, 1, 1, 1];
  for (const d of karte.deko) {
    if (d.typ !== 'zeltdach') continue;
    const x0 = Math.min(d.x0, d.x1) - 0.2, x1 = Math.max(d.x0, d.x1) + 0.2;
    const z0 = d.z0 - 0.2, z1 = d.z1 + 0.2, zm = (d.z0 + d.z1) / 2, y = d.y, h = 1.1;
    const l = Math.hypot(zm - z0, h);
    const nN = [0, (zm - z0) / l, -h / l], nS = [0, (zm - z0) / l, h / l];
    // Nordhang zeigt nach oben und Norden, Suedhang nach oben und Sueden.
    zelte.viereck([x1, y, z0], [x0 - x1, 0, 0], [0, h, zm - z0], nN,
      [x1 / 2, 0, x0 / 2, 0, x0 / 2, l / 2, x1 / 2, l / 2], weiss, weiss, weiss, weiss);
    zelte.viereck([x0, y, z1], [x1 - x0, 0, 0], [0, h, zm - z1], nS,
      [x0 / 2, 0, x1 / 2, 0, x1 / 2, l / 2, x0 / 2, l / 2], weiss, weiss, weiss, weiss);
    zelte.dreieck([x0, y, z0], [x0, y, z1], [x0, y + h, zm], [-1, 0, 0], [0, 0, 1, 0, 0.5, 0.5], weiss);
    zelte.dreieck([x1, y, z1], [x1, y, z0], [x1, y + h, zm], [1, 0, 0], [0, 0, 1, 0, 0.5, 0.5], weiss);
  }
  if (!zelte.leer()) {
    const m = new Mesh(merken(zelte.geometrie()), merken(new MeshLambertMaterial({ map: tex.plane, vertexColors: true, color: '#d8dcc8' })));
    m.castShadow = true;
    m.receiveShadow = true;
    gruppe.add(m);
  }

  /* Flaggen: Mast und wehendes Tuch */
  const mastGeo = merken(new CylinderGeometry(0.045, 0.06, 5.2, 8));
  for (const d of karte.deko) {
    if (d.typ !== 'flagge') continue;
    const mast = new Mesh(mastGeo, metallDunkel);
    mast.position.set(d.x, 2.6, d.z);
    v.add(mast);
    const geo = merken(new PlaneGeometry(1.5, 0.95, 10, 1));
    geo.translate(0.75, 0, 0);
    const mat = merken(new MeshLambertMaterial({ map: merken(flaggenTextur(d.team)), side: DoubleSide }));
    const tuch = new Mesh(geo, mat);
    tuch.position.set(d.x + 0.05, 4.6, d.z);
    tuch.rotation.y = d.x < 0 ? 0 : Math.PI;
    gruppe.add(tuch);
    const basis = Float32Array.from(geo.attributes.position.array);
    animiert.push((zeit) => {
      const p = geo.attributes.position.array;
      for (let i = 0; i < p.length; i += 3) {
        const x = basis[i];
        p[i + 2] = Math.sin(x * 3.2 - zeit * 4.2 + d.z) * 0.12 * (x / 1.5);
      }
      geo.attributes.position.needsUpdate = true;
    });
  }

  /* Schilder */
  for (const d of karte.deko) {
    if (d.typ !== 'schild') continue;
    const t = merken(schildTextur(d.text, d));
    const m = new Mesh(merken(new PlaneGeometry(d.breite, d.hoehe)), merken(new MeshLambertMaterial({
      map: t, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    })));
    m.position.set(d.x, d.y, d.z);
    m.rotation.y = d.yaw + Math.PI;
    m.receiveShadow = true;
    gruppe.add(m);
  }

  /* LKW-Wracks: Raeder, Scheiben, Scheinwerfer */
  const raeder = karte.deko.filter((d) => d.typ === 'lkw');
  if (raeder.length) {
    const radGeo = merken(new CylinderGeometry(0.46, 0.46, 0.34, 14));
    const inst = new InstancedMesh(radGeo, gummi, raeder.length * 6);
    let i = 0;
    for (const d of raeder) {
      const s = d.richtung;
      for (const ax of [2.3, -1.3, -2.5]) {
        for (const az of [-1.08, 1.08]) {
          Q.setFromAxisAngle(V1.set(1, 0, 0), Math.PI / 2);
          M4.compose(V1.set(d.x + ax * s, 0.46, d.z + az), Q, V2);
          inst.setMatrixAt(i++, M4);
        }
      }
      const scheibe = new Mesh(merken(new PlaneGeometry(1.9, 0.9)), glas);
      scheibe.position.set(d.x + s * 3.52, 2.15, d.z);
      scheibe.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2;
      v.add(scheibe);
      for (const az of [-0.8, 0.8]) {
        const licht = new Mesh(merken(new BoxGeometry(0.06, 0.18, 0.3)), leuchte);
        licht.position.set(d.x + s * 3.52, 0.95, d.z + az);
        v.add(licht);
      }
    }
    inst.castShadow = true;
    gruppe.add(inst);
  }

  /* Flutlichter */
  for (const d of karte.deko) {
    if (d.typ !== 'flutlicht') continue;
    const kopf = new Group();
    const gehaeuse = new Mesh(merken(new BoxGeometry(1.4, 0.55, 0.35)), metallDunkel);
    const scheibe = new Mesh(merken(new PlaneGeometry(1.25, 0.42)), leuchte);
    scheibe.position.z = -0.18;
    scheibe.rotation.y = Math.PI;
    kopf.add(gehaeuse, scheibe);
    kopf.position.set(d.x, 8.6, d.z);
    kopf.rotation.set(0.35, d.yaw, 0, 'YXZ');
    v.gruppe(kopf);
  }

  /* Hallenlampen */
  for (const d of karte.deko) {
    if (d.typ !== 'hallenlampen') continue;
    const geo = merken(new BoxGeometry(1.2, 0.12, 0.3));
    for (let x = d.x0; x <= d.x1; x += 6) {
      for (const z of d.z) {
        const l = new Mesh(geo, leuchte);
        l.position.set(x + 2, d.y, z);
        v.add(l);
      }
    }
  }

  /* Zielscheiben */
  for (const d of karte.deko) {
    if (d.typ !== 'zielscheiben') continue;
    const mat = merken(new MeshLambertMaterial({ map: merken(zielscheibeTextur()) }));
    const geo = merken(new PlaneGeometry(0.8, 1.2));
    const pfosten = merken(new BoxGeometry(0.06, 1.0, 0.06));
    for (let i = 0; i < d.anzahl; i++) {
      const x = d.x0 + (d.x1 - d.x0) * (i / (d.anzahl - 1));
      const m = new Mesh(geo, mat);
      m.position.set(x, 1.55, d.z - 0.12);
      m.rotation.y = Math.PI;
      v.add(m);
      const p = new Mesh(pfosten, metallDunkel);
      p.position.set(x, 0.5, d.z - 0.12);
      v.add(p);
    }
  }

  /* Stacheldraht auf der Umfassungsmauer */
  const g = karte.grenzen;
  const draht = new Bau(false);
  const drahtKante = (x0, z0, x1, z1) => {
    const l = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.round(l / 3));
    for (let i = 0; i <= n; i++) {
      const x = x0 + (x1 - x0) * i / n, z = z0 + (z1 - z0) * i / n;
      quaderEintragen(draht, { min: [x - 0.03, 4.2, z - 0.03], max: [x + 0.03, 4.75, z + 0.03], farbe: '#2e3134' }, MATERIALIEN.metall);
    }
    for (const h of [4.38, 4.56, 4.72]) {
      const dx = x1 - x0, dz = z1 - z0;
      const qx = dx === 0 ? 0.012 : 0, qz = dz === 0 ? 0.012 : 0;
      quaderEintragen(draht, {
        min: [Math.min(x0, x1) - qx, h, Math.min(z0, z1) - qz],
        max: [Math.max(x0, x1) + qx, h + 0.02, Math.max(z0, z1) + qz], farbe: '#2e3134',
      }, MATERIALIEN.metall);
    }
  };
  drahtKante(g.minX - 0.5, g.minZ - 0.5, g.maxX + 0.5, g.minZ - 0.5);
  drahtKante(g.minX - 0.5, g.maxZ + 0.5, g.maxX + 0.5, g.maxZ + 0.5);
  drahtKante(g.minX - 0.5, g.minZ - 0.5, g.minX - 0.5, g.maxZ + 0.5);
  drahtKante(g.maxX + 0.5, g.minZ - 0.5, g.maxX + 0.5, g.maxZ + 0.5);
  if (!draht.leer()) {
    const m = new Mesh(merken(draht.geometrie()), merken(new MeshLambertMaterial({ vertexColors: true })));
    gruppe.add(m);
  }

  if (karte.deko.some((d) => d.typ === 'umgebung')) umgebungBauen(karte, tex, gruppe, merken, metallDunkel, v);
  v.bauen(gruppe, merken, true);
}

/* Draussen: Baeume, Wachtuerme, Huegel und Himmel. */
function umgebungBauen(karte, tex, gruppe, merken, metallDunkel, v) {
  const r = zufallsquelle(4711);
  const g = karte.grenzen;

  // Baeume in einem Guertel um die Anlage
  const orte = [];
  for (let i = 0; i < 400 && orte.length < 90; i++) {
    const x = (r() * 2 - 1) * 75, z = (r() * 2 - 1) * 60;
    if (Math.abs(x) < g.maxX + 6 && Math.abs(z) < g.maxZ + 6) continue;
    orte.push([x, z, 0.8 + r() * 0.7]);
  }
  const kronen = new InstancedMesh(merken(new ConeGeometry(2.1, 6.5, 7)), merken(new MeshLambertMaterial({ color: '#3d5a34' })), orte.length);
  const staemme = new InstancedMesh(merken(new CylinderGeometry(0.22, 0.3, 1.8, 6)), merken(new MeshLambertMaterial({ color: '#4a3a2a' })), orte.length);
  orte.forEach(([x, z, s], i) => {
    Q.identity();
    M4.compose(V1.set(x, 1.8 * s + 3.0 * s, z), Q, V2.set(s, s, s));
    kronen.setMatrixAt(i, M4);
    M4.compose(V1.set(x, 0.9 * s, z), Q, V2.set(s, s, s));
    staemme.setMatrixAt(i, M4);
    kronen.setColorAt(i, new Color().setHSL(0.27 + r() * 0.06, 0.32, 0.22 + r() * 0.08));
  });
  V2.set(1, 1, 1);
  gruppe.add(kronen, staemme);

  // Wachtuerme an den Ecken, ausserhalb der Mauer
  const holzMat = merken(new MeshLambertMaterial({ map: tex.holz, color: '#9c8466' }));
  const bein = merken(new BoxGeometry(0.28, 7.2, 0.28));
  const boden = merken(new BoxGeometry(3.2, 0.3, 3.2));
  const bruestung = merken(new BoxGeometry(3.2, 1.1, 0.12));
  const dachGeo = merken(new ConeGeometry(2.6, 1.3, 4));
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const t = new Group();
      for (const bx of [-1.3, 1.3]) {
        for (const bz of [-1.3, 1.3]) {
          const m = new Mesh(bein, metallDunkel);
          m.position.set(bx, 3.6, bz);
          t.add(m);
        }
      }
      const b = new Mesh(boden, holzMat);
      b.position.y = 7.2;
      t.add(b);
      for (let k = 0; k < 4; k++) {
        const w = new Mesh(bruestung, holzMat);
        w.position.set(Math.sin(k * Math.PI / 2) * 1.54, 7.9, Math.cos(k * Math.PI / 2) * 1.54);
        w.rotation.y = k * Math.PI / 2;
        t.add(w);
      }
      const d = new Mesh(dachGeo, metallDunkel);
      d.position.y = 9.6;
      d.rotation.y = Math.PI / 4;
      t.add(d);
      for (const bx of [-1.3, 1.3]) {
        for (const bz of [-1.3, 1.3]) {
          const m = new Mesh(merken(new BoxGeometry(0.12, 1.3, 0.12)), metallDunkel);
          m.position.set(bx, 8.9, bz);
          t.add(m);
        }
      }
      t.position.set(sx * (g.maxX + 4.5), 0, sz * (g.maxZ + 4.5));
      v.gruppe(t);
    }
  }

  // Himmel: Kuppel mit Verlauf, dazu die Sonne
  const himmelGeo = merken(new SphereGeometry(460, 24, 14));
  const farben = [];
  const oben = new Color('#5b8dc2'), horizont = new Color('#cfdbe3'), unten = new Color('#8f9a9e');
  const pos = himmelGeo.attributes.position;
  const c = new Color();
  for (let i = 0; i < pos.count; i++) {
    const h = pos.getY(i) / 460;
    if (h >= 0) c.copy(horizont).lerp(oben, Math.pow(h, 0.55));
    else c.copy(horizont).lerp(unten, Math.min(1, -h * 4));
    farben.push(c.r, c.g, c.b);
  }
  himmelGeo.setAttribute('color', new Float32BufferAttribute(farben, 3));
  const himmel = new Mesh(himmelGeo, merken(new MeshBasicMaterial({ vertexColors: true, side: BackSide, fog: false, depthWrite: false })));
  himmel.renderOrder = -10;
  himmel.name = 'himmel';
  himmel.frustumCulled = false;
  gruppe.add(himmel);

  const sonne = new Sprite(merken(new SpriteMaterial({ map: merken(weichTextur()), color: '#fff3d6', fog: false, depthWrite: false, transparent: true })));
  sonne.position.set(-190, 330, 150);
  sonne.scale.set(70, 70, 1);
  sonne.renderOrder = -9;
  gruppe.add(sonne);

  // Ferne Huegel ohne Nebel, damit sie als blasse Silhouette bleiben
  const huegelMat = merken(new MeshBasicMaterial({ color: '#7f959c', fog: false }));
  const huegelGeo = merken(new SphereGeometry(1, 16, 8));
  for (let i = 0; i < 9; i++) {
    const w = (i / 9) * Math.PI * 2 + r() * 0.4;
    const d = 230 + r() * 60;
    const h = new Mesh(huegelGeo, huegelMat);
    h.position.set(Math.cos(w) * d, -8, Math.sin(w) * d);
    h.scale.set(70 + r() * 60, 26 + r() * 22, 70 + r() * 50);
    v.add(h);
  }
}
