/* ------------------------------------------------------------------
   Partikel fuer die Roll-Animation.

   Eigenes Overlay-Canvas, getrennt vom Spielfeld und vom DOM der
   Karten. Nur hier wird pro Bild gezeichnet; alles andere an der
   Animation laeuft ueber CSS-Transforms, die der Browser auf der
   Grafikeinheit erledigt.

   Objekt-Pool mit fester Obergrenze. Waehrend der Animation entsteht
   kein einziges neues Objekt - ein Muellsammler-Lauf mitten im Flug
   waere genau der Ruckler, den man am staerksten sieht.
   ------------------------------------------------------------------ */

const MAX = 300;

interface Partikel {
  aktiv: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Verbleibende Lebensdauer in Sekunden. */
  rest: number;
  gesamt: number;
  groesse: number;
  farbe: string;
  /** Bremsung pro Sekunde, als Faktor. */
  reibung: number;
}

/** Ein Ring, der nach aussen laeuft und dabei duenner wird. */
interface Ring {
  aktiv: boolean;
  x: number;
  y: number;
  ziel: number;
  rest: number;
  gesamt: number;
  farbe: string;
  dicke: number;
}

/** Lichtstrahlen, die vom Einschlag nach aussen stehen. */
interface Strahlen {
  aktiv: boolean;
  x: number;
  y: number;
  rest: number;
  gesamt: number;
  farbe: string;
  anzahl: number;
  laenge: number;
  drehung: number;
}

export interface Partikelfeld {
  canvas: HTMLCanvasElement;
  /** Punktexplosion. `anzahl` wird auf den freien Vorrat begrenzt. */
  explosion(x: number, y: number, anzahl: number, farbe: string, wucht: number): void;
  /**
   * Schockwelle. Der Ring traegt die Wucht, die einzelne Funken nicht
   * herstellen koennen: hundert Punkte sehen nach Konfetti aus, eine
   * Front nach Einschlag.
   */
  schockwelle(x: number, y: number, ziel: number, farbe: string, dauer: number): void;
  /**
   * Strahlenkranz, der sich langsam dreht. Nur fuer die hohen
   * Seltenheiten - er ist das Zeichen dafuer, dass gleich etwas
   * Seltenes liegt, und verliert seine Wirkung, wenn er jedes Mal kommt.
   */
  strahlenkranz(x: number, y: number, farbe: string, laenge: number, dauer: number): void;
  /** Einzelner Funke mit vorgegebener Richtung. */
  funke(x: number, y: number, vx: number, vy: number, farbe: string, dauer: number): void;
  /** Spur hinter einem fliegenden Objekt. */
  spur(x: number, y: number, farbe: string, breite: number): void;
  /** Einen Zeitschritt weiterrechnen und zeichnen. */
  bild(dt: number): void;
  leeren(): void;
  zerstoeren(): void;
}

export function partikelfeldAnlegen(eltern: HTMLElement): Partikelfeld {
  const canvas = document.createElement('canvas');
  canvas.className = 'a-partikel';
  eltern.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const ringe: Ring[] = [];
  for (let i = 0; i < 6; i++) {
    ringe.push({ aktiv: false, x: 0, y: 0, ziel: 0, rest: 0, gesamt: 1, farbe: '#fff', dicke: 3 });
  }
  const kraenze: Strahlen[] = [];
  for (let i = 0; i < 2; i++) {
    kraenze.push({
      aktiv: false, x: 0, y: 0, rest: 0, gesamt: 1,
      farbe: '#fff', anzahl: 12, laenge: 0, drehung: 0,
    });
  }

  const pool: Partikel[] = [];
  for (let i = 0; i < MAX; i++) {
    pool.push({
      aktiv: false, x: 0, y: 0, vx: 0, vy: 0,
      rest: 0, gesamt: 1, groesse: 2, farbe: '#fff', reibung: 1,
    });
  }

  let dichte = 1;
  let breite = 0;
  let hoehe = 0;

  const vermessen = (): void => {
    const kasten = canvas.getBoundingClientRect();
    dichte = Math.min(window.devicePixelRatio || 1, 2);
    breite = Math.max(1, Math.round(kasten.width));
    hoehe = Math.max(1, Math.round(kasten.height));
    canvas.width = Math.round(breite * dichte);
    canvas.height = Math.round(hoehe * dichte);
    ctx?.setTransform(dichte, 0, 0, dichte, 0, 0);
  };
  vermessen();
  const beobachter = new ResizeObserver(vermessen);
  beobachter.observe(canvas);

  const holen = (): Partikel | null => {
    for (const p of pool) if (!p.aktiv) return p;
    return null;
  };

  return {
    canvas,

    schockwelle(x, y, ziel, farbe, dauer) {
      const r = ringe.find((k) => !k.aktiv);
      if (!r) return;
      r.aktiv = true;
      r.x = x; r.y = y; r.ziel = ziel;
      r.gesamt = dauer; r.rest = dauer;
      r.farbe = farbe;
      r.dicke = Math.max(2, ziel * 0.03);
    },

    strahlenkranz(x, y, farbe, laenge, dauer) {
      const k = kraenze.find((e) => !e.aktiv);
      if (!k) return;
      k.aktiv = true;
      k.x = x; k.y = y;
      k.gesamt = dauer; k.rest = dauer;
      k.farbe = farbe;
      k.anzahl = 14;
      k.laenge = laenge;
      k.drehung = 0;
    },

    explosion(x, y, anzahl, farbe, wucht) {
      for (let i = 0; i < anzahl; i++) {
        const p = holen();
        if (!p) return;
        /* Gleichmaessig verteilte Richtungen ueber den Kreis. Hier ist
           Trigonometrie erlaubt - das ist Optik, keine Simulation. */
        const winkel = (i / anzahl) * Math.PI * 2 + Math.random() * 0.4;
        const tempo = wucht * (0.4 + Math.random() * 0.8);
        p.aktiv = true;
        p.x = x;
        p.y = y;
        p.vx = Math.cos(winkel) * tempo;
        p.vy = Math.sin(winkel) * tempo;
        p.gesamt = 0.5 + Math.random() * 0.6;
        p.rest = p.gesamt;
        p.groesse = 2 + Math.random() * 3.5;
        p.farbe = farbe;
        p.reibung = 0.9;
      }
    },

    funke(x, y, vx, vy, farbe, dauer) {
      const p = holen();
      if (!p) return;
      p.aktiv = true;
      p.x = x;
      p.y = y;
      p.vx = vx;
      p.vy = vy;
      p.gesamt = dauer;
      p.rest = dauer;
      p.groesse = 2 + Math.random() * 2;
      p.farbe = farbe;
      p.reibung = 0.97;
    },

    spur(x, y, farbe, groesse) {
      const p = holen();
      if (!p) return;
      p.aktiv = true;
      p.x = x + (Math.random() - 0.5) * groesse;
      p.y = y + (Math.random() - 0.5) * groesse;
      p.vx = (Math.random() - 0.5) * 40;
      p.vy = (Math.random() - 0.5) * 40;
      p.gesamt = 0.35;
      p.rest = p.gesamt;
      p.groesse = groesse * (0.3 + Math.random() * 0.4);
      p.farbe = farbe;
      p.reibung = 0.9;
    },

    bild(dt) {
      if (!ctx) return;
      ctx.clearRect(0, 0, breite, hoehe);

      /* Strahlen zuerst, damit sie hinter allem liegen. Gezeichnet
         wird mit lighter: Licht addiert sich, es deckt nicht ab -
         und genau so soll ein Kranz wirken. */
      for (const k of kraenze) {
        if (!k.aktiv) continue;
        k.rest -= dt;
        if (k.rest <= 0) { k.aktiv = false; continue; }
        const anteil = k.rest / k.gesamt;
        k.drehung += dt * 0.35;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = anteil * 0.5;
        ctx.strokeStyle = k.farbe;
        ctx.translate(k.x, k.y);
        ctx.rotate(k.drehung);
        for (let i = 0; i < k.anzahl; i++) {
          const w = (i / k.anzahl) * Math.PI * 2;
          // Ungleich lange Strahlen - gleich lange sehen nach Zahnrad aus.
          const l = k.laenge * (0.55 + ((i * 37) % 45) / 100);
          ctx.lineWidth = 2 + (i % 3);
          ctx.beginPath();
          ctx.moveTo(Math.cos(w) * 20, Math.sin(w) * 20);
          ctx.lineTo(Math.cos(w) * l, Math.sin(w) * l);
          ctx.stroke();
        }
        ctx.restore();
      }

      for (const r of ringe) {
        if (!r.aktiv) continue;
        r.rest -= dt;
        if (r.rest <= 0) { r.aktiv = false; continue; }
        const t = 1 - r.rest / r.gesamt;
        // Schnell auf, langsam aus - so liest sich eine Druckwelle.
        const radius = r.ziel * (1 - (1 - t) * (1 - t));
        ctx.globalAlpha = (1 - t) * 0.8;
        ctx.strokeStyle = r.farbe;
        ctx.lineWidth = r.dicke * (1 - t) + 1;
        ctx.beginPath();
        ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      for (const p of pool) {
        if (!p.aktiv) continue;
        p.rest -= dt;
        if (p.rest <= 0) { p.aktiv = false; continue; }
        const bremse = Math.pow(p.reibung, dt * 60);
        p.vx *= bremse;
        p.vy *= bremse;
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        const anteil = p.rest / p.gesamt;
        ctx.globalAlpha = anteil;
        ctx.fillStyle = p.farbe;
        const r = p.groesse * anteil;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },

    leeren() {
      for (const p of pool) p.aktiv = false;
      for (const r of ringe) r.aktiv = false;
      for (const k of kraenze) k.aktiv = false;
      ctx?.clearRect(0, 0, breite, hoehe);
    },

    zerstoeren() {
      beobachter.disconnect();
      canvas.remove();
    },
  };
}
