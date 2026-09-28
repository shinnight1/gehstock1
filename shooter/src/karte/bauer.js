/* ------------------------------------------------------------------
   Werkzeug zum Beschreiben einer Karte.

   Eine Karte ist eine Liste von Quadern (Kollision und Darstellung),
   dazu reine Schmuckstuecke (Deko), Bodenflaechen, Spawnpunkte und die
   Wege, an denen sich Bots orientieren. Alles in Metern, Y nach oben.
   ------------------------------------------------------------------ */

export class KartenBauer {
  constructor(name) {
    this.name = name;
    this.quader = [];
    this.deko = [];
    this.boden = [];
    this.spawns = [[], []];
    this.wege = [];
    this.bereiche = [];
    this.grenzen = null;
  }

  /* Quader aus zwei Ecken im Grundriss, Hoehe h ab opt.y (Standard 0). */
  q(x0, z0, x1, z1, h, mat, opt) {
    const o = opt || {};
    const y0 = o.y || 0;
    this.quader.push({
      min: [Math.min(x0, x1), y0, Math.min(z0, z1)],
      max: [Math.max(x0, x1), y0 + h, Math.max(z0, z1)],
      mat,
      farbe: o.farbe || null,
      kollision: o.kollision !== false,
      schatten: o.schatten !== false,
    });
  }

  /* Quader um einen Mittelpunkt: Breite bx (X), Tiefe bz (Z). */
  m(cx, cz, bx, bz, h, mat, opt) {
    this.q(cx - bx / 2, cz - bz / 2, cx + bx / 2, cz + bz / 2, h, mat, opt);
  }

  /* Gespiegelt an der Mittelachse X = 0: fn(s) wird mit s = -1 (Westen,
     Basis Blau) und s = +1 (Osten, Basis Rot) aufgerufen. */
  beide(fn) {
    fn(-1);
    fn(1);
  }

  /* Seecontainer, 6,0 x 2,4 x 2,6 m. laengsX: lange Seite entlang X. */
  container(cx, cz, laengsX, farbe, stapel) {
    const bx = laengsX ? 6 : 2.4;
    const bz = laengsX ? 2.4 : 6;
    const n = stapel || 1;
    for (let i = 0; i < n; i++) {
      this.m(cx, cz, bx, bz, 2.6, 'container', { y: i * 2.6, farbe: i % 2 ? farbe.oben || farbe.grund : farbe.grund });
    }
    this.deko.push({ typ: 'containertuer', x: cx, z: cz, laengsX, stapel: n });
  }

  /* Kiste(n), 1,2 m Kantenlaenge. */
  kiste(cx, cz, stapel, groesse) {
    const g = groesse || 1.2;
    for (let i = 0; i < (stapel || 1); i++) {
      this.m(cx, cz, g, g, g, 'holz', { y: i * g });
    }
  }

  /* Oelfass als Kollisionsquader, gezeichnet als Zylinder. */
  fass(cx, cz, farbe) {
    this.m(cx, cz, 0.62, 0.62, 0.92, 'unsichtbar');
    this.deko.push({ typ: 'fass', x: cx, z: cz, farbe });
  }

  /* Treppe vor einer Kante der Hoehe hoeheOben: n Stufen, die letzte
     Stufe fehlt, weil die Kante selbst sie bildet. richtung 'x+' steigt
     nach +X an, 'x-' nach -X. Die Stufen ueberlappen sich nicht. */
  treppe(x0, x1, z0, z1, hoeheOben, stufen, richtung) {
    const n = stufen;
    const breite = (x1 - x0) / n;
    for (let i = 0; i < n; i++) {
      const h = hoeheOben * (i + 1) / (n + 1);
      const a = richtung === 'x+' ? x0 + breite * i : x1 - breite * (i + 1);
      this.q(a, z0, a + breite, z1, h, 'stufe');
    }
  }

  bodenflaeche(x0, z0, x1, z1, mat) {
    this.boden.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), mat });
  }

  spawn(team, x, z, yaw) {
    this.spawns[team].push({ x, y: 0, z, yaw });
  }

  bereich(name, x0, z0, x1, z1) {
    this.bereiche.push({ name, x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) });
  }

  fertig() {
    return {
      name: this.name,
      quader: this.quader,
      deko: this.deko,
      boden: this.boden,
      spawns: this.spawns,
      wege: this.wege,
      bereiche: this.bereiche,
      grenzen: this.grenzen,
    };
  }
}

/* Bereichsname an einer Stelle (fuer Anzeige und Minikarte). */
export function bereichBei(karte, x, z) {
  for (const b of karte.bereiche) {
    if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) return b.name;
  }
  return '';
}
