/* ------------------------------------------------------------------
   Navigationsraster fuer die Bots.

   Einmal beim Laden wird die Karte in Zellen zu 0,5 m zerlegt. Jede
   Zelle bekommt eine Bodenhoehe - oder gilt als versperrt, wenn eine
   Figur dort nicht stehen kann. Benachbarte Zellen sind verbunden, wenn
   der Hoehenunterschied eine Stufe nicht uebersteigt. Treppen und das
   Podest ergeben sich damit von selbst; wer die Karte aendert, muss
   keine Wegpunkte nachziehen.

   Gesucht wird mit A* (8 Nachbarn, keine Abkuerzung ueber Ecken), danach
   wird der Pfad geglaettet: von jedem Punkt aus springt der Bot zum
   entferntesten Punkt, der noch in gerader, freier Linie liegt.

   Alle Arbeitsspeicher werden einmal angelegt - eine Suche erzeugt
   keine neuen Objekte.
   ------------------------------------------------------------------ */

const SQRT2 = Math.SQRT2;
const NACHBARN = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, SQRT2], [1, -1, SQRT2], [-1, 1, SQRT2], [-1, -1, SQRT2],
];

export class Navigation {
  constructor(welt, grenzen, opt) {
    const o = opt || {};
    this.welt = welt;
    this.zelle = o.zelle || 0.5;
    this.radius = o.radius || 0.42;
    this.hoehe = o.hoehe || 1.8;
    this.stufe = o.stufe || 0.45;
    this.minX = grenzen.minX;
    this.minZ = grenzen.minZ;
    this.bx = Math.ceil((grenzen.maxX - grenzen.minX) / this.zelle);
    this.bz = Math.ceil((grenzen.maxZ - grenzen.minZ) / this.zelle);
    this.n = this.bx * this.bz;
    this.boden = new Float32Array(this.n);
    this.frei = new Uint8Array(this.n);
    this.wandnah = new Uint8Array(this.n);
    this.berechnen();

    // Arbeitsspeicher fuer A*
    this.g = new Float32Array(this.n);
    this.vorher = new Int32Array(this.n);
    this.stempel = new Uint32Array(this.n);
    this.zu = new Uint32Array(this.n);
    this.lauf = 0;
    this.heapN = 0;
    this.heapKnoten = new Int32Array(this.n * 4);
    this.heapWert = new Float32Array(this.n * 4);
    this.roh = new Int32Array(this.n);
    this.expandiert = 0;
  }

  berechnen() {
    const b = this.welt.b;
    const w = this.welt;
    const r = this.radius;
    const tops = [];
    for (let k = 0; k < this.bz; k++) {
      for (let i = 0; i < this.bx; i++) {
        const idx = k * this.bx + i;
        const cx = this.minX + (i + 0.5) * this.zelle;
        const cz = this.minZ + (k + 0.5) * this.zelle;
        tops.length = 0;
        for (let q = 0, o = 0; q < w.n; q++, o += 6) {
          if (cx > b[o] && cx < b[o + 3] && cz > b[o + 2] && cz < b[o + 5]) tops.push(b[o + 4]);
        }
        tops.sort((p, s) => p - s);
        this.frei[idx] = 0;
        for (const h of tops) {
          /* Frei heisst: vom Knie (eine Stufe ueber dem Boden) bis zum Kopf
             beruehrt nichts den Zylinder. Kleine Kanten darunter steigt die
             Figur ohnehin hinauf. */
          if (w.ueberlappt(cx - r, h + this.stufe, cz - r, cx + r, h + this.hoehe, cz + r) < 0) {
            this.boden[idx] = h;
            this.frei[idx] = 1;
            break;
          }
        }
      }
    }
    // Zellen neben Hindernissen: dort kostet ein Schritt etwas mehr,
    // damit Pfade nicht an Waenden entlangschrammen.
    for (let k = 0; k < this.bz; k++) {
      for (let i = 0; i < this.bx; i++) {
        const idx = k * this.bx + i;
        if (!this.frei[idx]) continue;
        let nah = 0;
        for (const [di, dk] of NACHBARN) {
          const ni = i + di, nk = k + dk;
          if (ni < 0 || nk < 0 || ni >= this.bx || nk >= this.bz) { nah = 1; break; }
          const j = nk * this.bx + ni;
          if (!this.frei[j] || Math.abs(this.boden[j] - this.boden[idx]) > this.stufe) { nah = 1; break; }
        }
        this.wandnah[idx] = nah;
      }
    }
  }

  zelleVon(x, z) {
    const i = Math.floor((x - this.minX) / this.zelle);
    const k = Math.floor((z - this.minZ) / this.zelle);
    if (i < 0 || k < 0 || i >= this.bx || k >= this.bz) return -1;
    return k * this.bx + i;
  }

  mitteX(idx) { return this.minX + ((idx % this.bx) + 0.5) * this.zelle; }
  mitteZ(idx) { return this.minZ + (Math.floor(idx / this.bx) + 0.5) * this.zelle; }

  begehbar(x, z) {
    const c = this.zelleVon(x, z);
    return c >= 0 && this.frei[c] === 1;
  }

  bodenBei(x, z) {
    const c = this.zelleVon(x, z);
    return c >= 0 && this.frei[c] ? this.boden[c] : NaN;
  }

  /* Naechste freie Zelle in der Naehe (bis etwa 3 m), bevorzugt auf
     aehnlicher Hoehe. */
  naechsteFreie(x, z, y) {
    const c = this.zelleVon(x, z);
    if (c >= 0 && this.frei[c] && (y === undefined || Math.abs(this.boden[c] - y) < 1.2)) return c;
    const ci = Math.floor((x - this.minX) / this.zelle);
    const ck = Math.floor((z - this.minZ) / this.zelle);
    let best = -1, bestD = Infinity;
    for (let ring = 1; ring <= 6; ring++) {
      for (let dk = -ring; dk <= ring; dk++) {
        for (let di = -ring; di <= ring; di++) {
          if (Math.max(Math.abs(di), Math.abs(dk)) !== ring) continue;
          const i = ci + di, k = ck + dk;
          if (i < 0 || k < 0 || i >= this.bx || k >= this.bz) continue;
          const j = k * this.bx + i;
          if (!this.frei[j]) continue;
          let d = di * di + dk * dk;
          if (y !== undefined) d += Math.abs(this.boden[j] - y) * 8;
          if (d < bestD) { bestD = d; best = j; }
        }
      }
      if (best >= 0) return best;
    }
    return -1;
  }

  heapPush(knoten, wert) {
    let i = this.heapN++;
    const hk = this.heapKnoten, hw = this.heapWert;
    if (i >= hk.length) { this.heapN--; return; }
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (hw[p] <= wert) break;
      hk[i] = hk[p];
      hw[i] = hw[p];
      i = p;
    }
    hk[i] = knoten;
    hw[i] = wert;
  }

  heapPop() {
    const hk = this.heapKnoten, hw = this.heapWert;
    const oben = hk[0];
    const n = --this.heapN;
    if (n > 0) {
      const k = hk[n], w = hw[n];
      let i = 0;
      for (;;) {
        let c = i * 2 + 1;
        if (c >= n) break;
        if (c + 1 < n && hw[c + 1] < hw[c]) c++;
        if (hw[c] >= w) break;
        hk[i] = hk[c];
        hw[i] = hw[c];
        i = c;
      }
      hk[i] = k;
      hw[i] = w;
    }
    return oben;
  }

  /* A* von Zelle s nach Zelle z. Schreibt die Zellen in this.roh (Ziel
     zuerst) und gibt ihre Anzahl zurueck, 0 wenn es keinen Weg gibt. */
  suche(s, z) {
    this.lauf++;
    if (this.lauf > 0xfffffff0) {
      this.lauf = 1;
      this.stempel.fill(0);
      this.zu.fill(0);
    }
    const lauf = this.lauf;
    const bx = this.bx;
    const zx = z % bx, zk = Math.floor(z / bx);
    const h = (idx) => {
      const dx = Math.abs((idx % bx) - zx), dk = Math.abs(Math.floor(idx / bx) - zk);
      return (dx + dk + (SQRT2 - 2) * Math.min(dx, dk)) * this.zelle;
    };
    this.heapN = 0;
    this.g[s] = 0;
    this.vorher[s] = -1;
    this.stempel[s] = lauf;
    this.heapPush(s, h(s));
    this.expandiert = 0;
    let gefunden = false;
    while (this.heapN > 0) {
      const c = this.heapPop();
      if (this.zu[c] === lauf) continue;
      this.zu[c] = lauf;
      this.expandiert++;
      if (c === z) { gefunden = true; break; }
      const ci = c % bx, ck = Math.floor(c / bx);
      const hc = this.boden[c];
      for (let q = 0; q < 8; q++) {
        const nb = NACHBARN[q];
        const ni = ci + nb[0], nk = ck + nb[1];
        if (ni < 0 || nk < 0 || ni >= bx || nk >= this.bz) continue;
        const j = nk * bx + ni;
        if (!this.frei[j] || this.zu[j] === lauf) continue;
        if (Math.abs(this.boden[j] - hc) > this.stufe) continue;
        if (nb[2] > 1) {
          // Diagonal nur, wenn beide Nachbarn frei sind: keine Ecken schneiden.
          const a = ck * bx + ni, b = nk * bx + ci;
          if (!this.frei[a] || !this.frei[b]) continue;
          if (Math.abs(this.boden[a] - hc) > this.stufe || Math.abs(this.boden[b] - hc) > this.stufe) continue;
        }
        const kosten = nb[2] * this.zelle * (this.wandnah[j] ? 1.6 : 1);
        const g = this.g[c] + kosten;
        if (this.stempel[j] === lauf && g >= this.g[j]) continue;
        this.stempel[j] = lauf;
        this.g[j] = g;
        this.vorher[j] = c;
        this.heapPush(j, g + h(j));
      }
    }
    if (!gefunden) return 0;
    let n = 0;
    for (let c = z; c >= 0 && n < this.roh.length; c = this.vorher[c]) this.roh[n++] = c;
    return n;
  }

  /* Ist die gerade Linie von a nach b begehbar? Prueft in kleinen
     Schritten: freie Zelle, keine zu hohe Stufe, und in Wandnaehe genau
     mit dem Koerper des Bots. */
  linieFrei(ax, az, bx, bz, radius) {
    const dx = bx - ax, dz = bz - az;
    const l = Math.hypot(dx, dz);
    const schritte = Math.max(1, Math.ceil(l / (this.zelle * 0.5)));
    let hVor = NaN;
    const r = radius || 0.36;
    for (let s = 0; s <= schritte; s++) {
      const t = s / schritte;
      const x = ax + dx * t, z = az + dz * t;
      const c = this.zelleVon(x, z);
      if (c < 0 || !this.frei[c]) return false;
      const h = this.boden[c];
      if (hVor === hVor && Math.abs(h - hVor) > this.stufe) return false;
      hVor = h;
      if (this.wandnah[c] && this.welt.ueberlappt(x - r, h + this.stufe, z - r, x + r, h + this.hoehe, z + r) >= 0) return false;
    }
    return true;
  }

  /* Pfad von (ax,az) nach (bx,bz). Schreibt geglaettete Wegpunkte als
     x,z-Paare nach aus und gibt die Anzahl Punkte zurueck (0 = kein Weg). */
  pfad(ax, az, ay, bx, bz, aus, maxPunkte) {
    const s = this.naechsteFreie(ax, az, ay);
    const z = this.naechsteFreie(bx, bz);
    if (s < 0 || z < 0) return 0;
    if (s === z) {
      aus[0] = bx;
      aus[1] = bz;
      return 1;
    }
    const n = this.suche(s, z);
    if (!n) return 0;
    // roh[n-1] ist der Start, roh[0] das Ziel.
    let punkte = 0;
    let ankerX = ax, ankerZ = az;
    let i = n - 1;
    const zielFrei = this.begehbar(bx, bz);
    while (i > 0 && punkte < maxPunkte) {
      let weit = i - 1;
      const grenze = Math.max(0, i - 48);
      for (let j = i - 1; j >= grenze; j--) {
        const c = this.roh[j];
        if (this.linieFrei(ankerX, ankerZ, this.mitteX(c), this.mitteZ(c))) weit = j;
        else if (j < i - 2) break;
      }
      const c = this.roh[weit];
      ankerX = this.mitteX(c);
      ankerZ = this.mitteZ(c);
      aus[punkte * 2] = ankerX;
      aus[punkte * 2 + 1] = ankerZ;
      punkte++;
      i = weit;
    }
    if (zielFrei && punkte > 0) {
      aus[(punkte - 1) * 2] = bx;
      aus[(punkte - 1) * 2 + 1] = bz;
    }
    return punkte;
  }

  /* Zufaellige freie Zelle in einem Umkreis - fuer Suchbewegungen. */
  zufallsPunkt(x, z, radius, zufall, aus) {
    for (let v = 0; v < 12; v++) {
      const w = zufall() * Math.PI * 2;
      const r = radius * Math.sqrt(zufall());
      const px = x + Math.cos(w) * r, pz = z + Math.sin(w) * r;
      const c = this.zelleVon(px, pz);
      if (c >= 0 && this.frei[c] && !this.wandnah[c]) {
        aus.x = px;
        aus.z = pz;
        return true;
      }
    }
    return false;
  }
}
