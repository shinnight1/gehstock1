/* ------------------------------------------------------------------
   Werkzeug zum Beschreiben einer Karte.

   Eine Karte ist eine Liste von Quadern (Kollision und Darstellung),
   dazu reine Schmuckstuecke (Deko), Bodenflaechen, Spawnpunkte und die
   Wege, an denen sich Bots orientieren. Alles in Metern, Y nach oben.
   ------------------------------------------------------------------ */

export class KartenBauer {
  constructor(name) {
    this.name = name;
    this.id = '';
    this.kurz = '';
    this.thema = {};
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

  /* Wand entlang X (bei z, Dicke d) oder entlang Z (bei x) mit Oeffnungen.
     luecken: [[von, bis, unten, oben], ...] entlang der Wand - eine Tuer
     hat unten 0, ein Fenster z. B. 1,0 bis 2,1. */
  wandX(x0, x1, z, d, h, mat, luecken, opt) {
    this.wand(x0, x1, (a, b, hh, o) => this.q(a, z - d / 2, b, z + d / 2, hh, mat, o), h, luecken, opt);
  }

  wandZ(z0, z1, x, d, h, mat, luecken, opt) {
    this.wand(z0, z1, (a, b, hh, o) => this.q(x - d / 2, a, x + d / 2, b, hh, mat, o), h, luecken, opt);
  }

  wand(a0, a1, stueck, h, luecken, opt) {
    const o = opt || {};
    const y0 = o.y || 0;
    const L = (luecken || []).slice().sort((p, q) => p[0] - q[0]);
    let a = a0;
    for (const [von, bis, unten, oben] of L) {
      if (von > a) stueck(a, von, h, o);
      if (unten > 0) stueck(von, bis, unten, o);
      if (oben < h) stueck(von, bis, h - oben, { ...o, y: y0 + oben });
      a = bis;
    }
    if (a < a1) stueck(a, a1, h, o);
  }

  /* Haus mit Satteldach (First entlang X). Ohne tueren ein fester Block,
     sonst begehbar: tueren/fenster je Seite n, s, w, o als [von, bis]. */
  haus(x0, z0, x1, z1, h, opt) {
    const o = opt || {};
    const farbe = o.farbe || '#e2dccf';
    const mat = o.mat || 'putz';
    if (!o.tueren) {
      this.q(x0, z0, x1, z1, h, mat, { farbe });
    } else {
      const d = 0.3;
      const t = o.tueren, f = o.fenster || {};
      const L = (seite) => (t[seite] || []).map(([a, b]) => [a, b, 0, 2.3])
        .concat((f[seite] || []).map(([a, b]) => [a, b, 1.0, 2.1]));
      this.wandX(x0, x1, z0 + d / 2, d, h, mat, L('n'), { farbe });
      this.wandX(x0, x1, z1 - d / 2, d, h, mat, L('s'), { farbe });
      this.wandZ(z0 + d, z1 - d, x0 + d / 2, d, h, mat, L('w'), { farbe });
      this.wandZ(z0 + d, z1 - d, x1 - d / 2, d, h, mat, L('o'), { farbe });
      this.bodenflaeche(x0 + d, z0 + d, x1 - d, z1 - d, o.boden || 'holzboden', 0.012);
      // Decke, damit man von innen nicht in den offenen Dachstuhl schaut
      this.q(x0, z0, x1, z1, 0.2, 'holzboden', { y: h, kollision: false, farbe: '#e8dccb' });
    }
    this.deko.push({
      typ: 'zeltdach', x0, x1, z0, z1, y: h, h: o.dachHoehe || Math.min(2.6, (z1 - z0) * 0.42),
      mat: o.dach || 'dachziegel', farbe: o.dachFarbe || '', giebel: mat, giebelFarbe: farbe,
    });
  }

  /* Stehender Zylinder (Tank, Poller, Brunnenrand). Kollision: ein
     Quader, knapp so gross wie der Kreis. */
  zylinder(cx, cz, r, h, farbe, opt) {
    const o = opt || {};
    const k = r * 0.9;
    if (o.kollision !== false) this.q(cx - k, cz - k, cx + k, cz + k, h, 'unsichtbar', { y: o.y || 0 });
    this.deko.push({ typ: 'zylinder', x: cx, y: (o.y || 0) + h / 2, z: cz, r, l: h, achse: 'y', farbe, mat: o.mat || 'metall' });
  }

  /* Liegendes Rohr zwischen zwei Punkten auf einer Achse (x oder z). */
  rohr(x0, z0, x1, z1, r, y, farbe, opt) {
    const o = opt || {};
    const k = r * 0.9;
    const achse = Math.abs(x1 - x0) > Math.abs(z1 - z0) ? 'x' : 'z';
    if (o.kollision !== false) {
      if (achse === 'x') this.q(x0, z0 - k, x1, z0 + k, 2 * k, 'unsichtbar', { y: y - k });
      else this.q(x0 - k, z0, x0 + k, z1, 2 * k, 'unsichtbar', { y: y - k });
    }
    this.deko.push({
      typ: 'zylinder', x: (x0 + x1) / 2, y, z: (z0 + z1) / 2, r,
      l: achse === 'x' ? Math.abs(x1 - x0) : Math.abs(z1 - z0), achse, farbe, mat: o.mat || 'metall',
    });
  }

  /* Baum auf der Karte: der Stamm haelt auf, die Krone nicht. */
  baum(cx, cz, art, groesse) {
    const g = groesse || 1;
    this.m(cx, cz, 0.5 * g, 0.5 * g, 3.2 * g, 'unsichtbar');
    this.deko.push({ typ: 'baum', x: cx, z: cz, art: art || 'laub', g });
  }

  /* Wasserflaeche (nur Bild - wer hineinlaufen koennte, braucht eine Mauer). */
  wasser(x0, z0, x1, z1, y, farbe) {
    this.deko.push({ typ: 'wasser', x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), y: y || 0, farbe: farbe || '#2f5560' });
  }

  /* Bodenmarkierungen: Linie (auf Wunsch gestrichelt), Ring, Schraffur. */
  linie(x0, z0, x1, z1, breite, farbe, strich, luecke) {
    this.deko.push({ typ: 'markierung', form: 'linie', x0, z0, x1, z1, breite, farbe, strich: strich || 0, luecke: luecke || 0 });
  }

  ring(cx, cz, r, breite, farbe) {
    this.deko.push({ typ: 'markierung', form: 'ring', x: cx, z: cz, r, breite, farbe });
  }

  schraffur(x0, z0, x1, z1, farbe) {
    this.deko.push({ typ: 'markierung', form: 'schraffur', x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), farbe });
  }

  /* Bodenflaeche; y > 0 legt sie knapp ueber eine andere (kein Flimmern). */
  bodenflaeche(x0, z0, x1, z1, mat, y) {
    this.boden.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), mat, y: y || 0 });
  }

  spawn(team, x, z, yaw) {
    this.spawns[team].push({ x, y: 0, z, yaw });
  }

  bereich(name, x0, z0, x1, z1) {
    this.bereiche.push({ name, x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) });
  }

  fertig() {
    return {
      id: this.id,
      name: this.name,
      kurz: this.kurz,
      thema: this.thema,
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
