/* ------------------------------------------------------------------
   Viele kleine Teile zu wenigen Zeichenaufrufen zusammenfassen.

   Jeder Zeichenaufruf kostet auf dem iPad spuerbar mehr als ein paar
   Dreiecke mehr. Unbewegliche Teile mit demselben Material werden darum
   zu einer Geometrie verschmolzen; unterschiedliche Farben wandern in
   Eckfarben.
   ------------------------------------------------------------------ */

import { BufferAttribute, Color, Mesh } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const FARBE = new Color();

/* Kopie einer Geometrie mit angewandter Matrix und einheitlicher Eckfarbe. */
export function gefaerbt(geo, matrix, farbe) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  if (matrix) g.applyMatrix4(matrix);
  FARBE.set(farbe || '#ffffff');
  const n = g.attributes.position.count;
  const f = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    f[i * 3] = FARBE.r;
    f[i * 3 + 1] = FARBE.g;
    f[i * 3 + 2] = FARBE.b;
  }
  g.setAttribute('color', new BufferAttribute(f, 3));
  for (const k of Object.keys(g.attributes)) {
    if (k !== 'position' && k !== 'normal' && k !== 'uv' && k !== 'color') g.deleteAttribute(k);
  }
  if (!g.attributes.uv) g.setAttribute('uv', new BufferAttribute(new Float32Array(n * 2), 2));
  return g;
}

/* Sammelt Meshes (mit Weltmatrix) und baut je Material ein Mesh. */
export class Verschmelzer {
  constructor() {
    this.teile = new Map();
  }

  /* Ein Mesh aufnehmen. Die Farbe kommt aus farbe oder - falls das
     Material eine eigene Farbe hat - wird weiss angenommen. */
  add(mesh, farbe) {
    mesh.updateWorldMatrix(true, false);
    const liste = this.teile.get(mesh.material) || [];
    liste.push(gefaerbt(mesh.geometry, mesh.matrixWorld, farbe));
    this.teile.set(mesh.material, liste);
  }

  /* Eine Gruppe samt Kindern aufnehmen. */
  gruppe(g) {
    g.updateMatrixWorld(true);
    g.traverse((o) => {
      if (o.isMesh && !o.isInstancedMesh) this.add(o);
    });
  }

  bauen(ziel, merken, schatten) {
    const ergebnis = [];
    for (const [material, geos] of this.teile) {
      const g = mergeGeometries(geos, false);
      for (const x of geos) x.dispose();
      if (!g) continue;
      g.computeBoundingSphere();
      if (!material.vertexColors) {
        material.vertexColors = true;
        material.needsUpdate = true;
      }
      const m = new Mesh(merken ? merken(g) : g, material);
      m.castShadow = !!schatten;
      m.receiveShadow = true;
      ziel.add(m);
      ergebnis.push(m);
    }
    this.teile.clear();
    return ergebnis;
  }
}
