/* ------------------------------------------------------------------
   Himmel, Sternschnuppen und Kameraflug fuer die Ziehung - in 3D.

   Die Ziehung spielt unter freiem Himmel. Die Nacht hellt auf, Wolken
   ziehen durch, und aus der Tiefe kommt fuer jeden gezogenen
   Gegenstand eine Sternschnuppe in der Farbe seiner Seltenheit. Zehn
   Rolls sind zehn Schnuppen. Zum Schluss faehrt die Kamera auf die
   seltenste zu, bis sie das Bild fuellt.

   WARUM ECHTE 3D UND TROTZDEM KEIN WEBGL

   Der Client hat bewusst keine einzige Abhaengigkeit. Eine 3D-
   Bibliothek nur fuer eine Animation waere ein schlechter Tausch, und
   WebGL von Hand waere hundert Zeilen Shader-Aufbau fuer Punkte und
   Striche. Gerechnet wird deshalb richtig dreidimensional - jeder
   Punkt hat x, y und z, die Kamera bewegt sich durch den Raum - und
   nur das Zeichnen laeuft ueber Canvas 2D.

   Die Projektion ist die ganze Mathematik:

     bildX = mitteX + x / z * brennweite
     bildY = mitteY + y / z * brennweite
     groesse = brennweite / z

   Daraus faellt alles von allein: Nahes wandert schnell durchs Bild,
   Fernes langsam, und ein Objekt, auf das die Kamera zufaehrt, waechst
   nicht linear, sondern reisst am Ende auf. Genau das ist der Effekt,
   den eine Nahaufnahme braucht.

   WARUM WOLKEN VORGERENDERT WERDEN

   Weiche Wolken entstehen aus vielen halbdurchsichtigen Ellipsen. Die
   pro Bild zu zeichnen kostet auf dem iPad spuerbar Bildrate. Sie
   werden einmal in ein Offscreen-Canvas gemalt und danach nur noch
   verschoben und skaliert gezeichnet. Schatten und Filter kommen aus
   demselben Grund nirgends vor.
   ------------------------------------------------------------------ */

/** Wie viele Schnuppen gleichzeitig unterwegs sein koennen. */
const MAX_SCHNUPPEN = 14;
/** Punkte, die eine Schnuppe von ihrem Weg aufhebt. Das ist der Schweif. */
const SPUR_PUNKTE = 30;
/* Abstand zwischen zwei Schweifpunkten, in Sekunden.

   Bewusst an der Zeit festgemacht und nicht am Bild: auf einem
   Geraet mit 30 Bildern je Sekunde waere ein Schweif aus dreissig
   Bildern doppelt so lang wie auf einem mit 60. Der Schweif soll
   ueberall eine halbe Sekunde Weg zeigen. */
const SPUR_TAKT = 1 / 60;
/** Sterne im Raum. Sie fliegen mit der Kamera vorbei und machen die Tiefe sichtbar. */
const STERNE = 220;
/** Naeher als das wird nichts gezeichnet - dahinter liegt die Kamera. */
const NAH = 12;
/** Entfernung, in der die Heldenschnuppe am Ende des Anflugs steht. */
const HELD_NAH = 95;

interface Schnuppe {
  aktiv: boolean;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  rest: number;
  gesamt: number;
  farbe: string;
  /** Radius im Raum. Die Bildgroesse ergibt sich erst aus der Tiefe. */
  gross: number;
  /** Ringpuffer der letzten Raumpunkte, je drei Zahlen. */
  spur: Float32Array;
  spurLen: number;
  spurKopf: number;
  /** Angesammelte Zeit seit dem letzten Schweifpunkt. */
  spurZeit: number;
  /** Die Schnuppe, auf die am Ende zugeflogen wird. */
  held: boolean;
  /** Echte Farbe. Bis zur Enthuellung fliegt die Schnuppe blass. */
  wahr: string;
  /** Hoechste Stufe: der Schweif laeuft durch das Spektrum. */
  regenbogen: boolean;
  /** Sekunden seit dem Start, fuer Farbwechsel und Flackern. */
  alter: number;
}

export interface Rollhimmel {
  canvas: HTMLCanvasElement;
  /**
   * Eine Sternschnuppe in den Raum setzen.
   *
   * `tiefe` ist der Abstand zur Kamera. Kleine Werte heissen nah,
   * schnell und gross im Bild - darueber entsteht die Staffelung, die
   * einen Schwarm raeumlich wirken laesst.
   *
   * Startpunkt und Groesse werden in BILDeinheiten angegeben, nicht in
   * Weltkoordinaten: `sx` und `sy` laufen von -1 (linker/oberer Rand)
   * bis 1, `gross` ist der Radius in Pixeln beim Start. Die Umrechnung
   * in den Raum macht das Modul. Anders herum muesste der Aufrufer die
   * Brennweite kennen, und jede Tiefe braeuchte andere Zahlen - genau
   * so fliegt eine Schnuppe dann versehentlich am Bild vorbei.
   */
  schnuppe(tiefe: number, sx: number, sy: number, farbe: string,
    gross: number, dauer: number, held: boolean, regenbogen?: boolean): void;
  /**
   * Ein Bild weiterrechnen und zeichnen.
   *
   * `tag` laeuft von 0 (Nacht mit Sternen) bis 1 (heller Himmel mit
   * Wolken). `anflug` laeuft von 0 bis 1 und zieht die Kamera auf die
   * als `held` markierte Schnuppe zu.
   */
  bild(dt: number, tag: number, anflug: number): void;
  /** Bildposition und -groesse der Heldenschnuppe, fuer den Aufprall. */
  heldImBild(): { x: number; y: number; r: number } | null;
  leeren(): void;
  zerstoeren(): void;
}

/* ----------------------- Wolken vorrendern ------------------------ */

/** Kleiner, fester Zufall. Derselbe Himmel bei jeder Ziehung. */
function wuerfel(saat: number): () => number {
  let s = saat >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 0xffffffff;
  };
}

/**
 * Ein Band aus weichen Wolken.
 *
 * Die Weichheit entsteht aus uebereinandergelegten Ellipsen mit
 * niedriger Deckkraft, nicht aus einem Weichzeichner. Das sieht bei
 * dieser Groesse gleich aus und kostet zur Laufzeit nichts.
 */
function wolkenband(breite: number, hoehe: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(breite));
  c.height = Math.max(1, Math.round(hoehe));
  const g = c.getContext('2d');
  if (!g) return c;
  const zufall = wuerfel(0x2f6b3c1d);

  const ballen = Math.max(6, Math.round(breite / 240));
  for (let i = 0; i < ballen; i++) {
    const mx = zufall() * breite;
    const my = hoehe * (0.35 + zufall() * 0.5);
    const mb = hoehe * (0.6 + zufall() * 0.8);
    const mh = mb * (0.3 + zufall() * 0.18);
    const teile = 10 + Math.round(zufall() * 8);
    for (let k = 0; k < teile; k++) {
      const px = mx + (zufall() - 0.5) * mb;
      const py = my + (zufall() - 0.5) * mh * 0.8;
      const pr = mh * (0.45 + zufall() * 0.8);
      g.fillStyle = 'rgba(255,255,255,0.08)';
      g.beginPath();
      g.ellipse(px, py, pr, pr * (0.5 + zufall() * 0.3), 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  return c;
}

export function rollhimmelAnlegen(eltern: HTMLElement): Rollhimmel {
  const canvas = document.createElement('canvas');
  canvas.className = 'a-himmel';
  eltern.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  /* Zwei Flaechen, die nie im Dokument haengen: auf `leucht` kommt
     alles Leuchtende, `klein` ist dieselbe Flaeche stark verkleinert
     und dient als Unschaerfe fuer den Schein. */
  const leucht = document.createElement('canvas');
  const lctx = leucht.getContext('2d');
  const klein = document.createElement('canvas');
  const kctx = klein.getContext('2d');
  let kleinB = 1;
  let kleinH = 1;

  const schnuppen: Schnuppe[] = [];
  for (let i = 0; i < MAX_SCHNUPPEN; i++) {
    schnuppen.push({
      aktiv: false, x: 0, y: 0, z: 1000, vx: 0, vy: 0, vz: 0,
      rest: 0, gesamt: 1, farbe: '#fff', gross: 6, held: false,
      wahr: '#fff', regenbogen: false, alter: 0,
      spur: new Float32Array(SPUR_PUNKTE * 3), spurLen: 0, spurKopf: 0, spurZeit: 0,
    });
  }

  /** Sternenfeld im Raum: je drei Zahlen x, y, z. */
  const sterne = new Float32Array(STERNE * 3);
  const sternSaat = wuerfel(0x9e3779b9);
  for (let i = 0; i < STERNE; i++) {
    sterne[i * 3] = (sternSaat() - 0.5) * 2600;
    sterne[i * 3 + 1] = (sternSaat() - 0.5) * 1800;
    sterne[i * 3 + 2] = 120 + sternSaat() * 2600;
  }

  let dichte = 1;
  let breite = 0;
  let hoehe = 0;
  let brenn = 600;
  let wolken: HTMLCanvasElement | null = null;
  let drift = 0;
  /** Wie weit die Kamera seit dem Start nach vorn gefahren ist. */
  let kamera = 0;
  let heldBild: { x: number; y: number; r: number } | null = null;

  const vermessen = (): void => {
    const kasten = canvas.getBoundingClientRect();
    dichte = Math.min(window.devicePixelRatio || 1, 2);
    breite = Math.max(1, Math.round(kasten.width));
    hoehe = Math.max(1, Math.round(kasten.height));
    canvas.width = Math.round(breite * dichte);
    canvas.height = Math.round(hoehe * dichte);
    ctx?.setTransform(dichte, 0, 0, dichte, 0, 0);

    leucht.width = canvas.width;
    leucht.height = canvas.height;
    lctx?.setTransform(dichte, 0, 0, dichte, 0, 0);
    /* Ein Achtel je Kante, also ein Vierundsechzigstel der Punkte.
       Feiner braeuchte der Schein nicht zu sein - er ist Unschaerfe. */
    kleinB = Math.max(1, Math.round(breite / 8));
    kleinH = Math.max(1, Math.round(hoehe / 8));
    klein.width = kleinB;
    klein.height = kleinH;
    kctx?.setTransform(1, 0, 0, 1, 0, 0);
    /* Brennweite an die kurze Kante: sonst ist das Bild auf dem Handy
       ein anderer Ausschnitt als auf dem iPad. */
    brenn = Math.min(breite, hoehe) * 1.15;
    wolken = wolkenband(breite * 2, hoehe * 0.6);
  };
  vermessen();
  const beobachter = new ResizeObserver(vermessen);
  beobachter.observe(canvas);

  const misch = (a: number[], b: number[], t: number): string =>
    'rgb(' + Math.round(a[0]! + (b[0]! - a[0]!) * t) + ','
      + Math.round(a[1]! + (b[1]! - a[1]!) * t) + ','
      + Math.round(a[2]! + (b[2]! - a[2]!) * t) + ')';

  const NACHT_OBEN = [9, 14, 32];
  const NACHT_UNTEN = [26, 38, 74];
  const TAG_OBEN = [21, 62, 150];
  const TAG_UNTEN = [173, 216, 245];

  return {
    canvas,

    schnuppe(tiefe, sx, sy, farbe, gross, dauer, held, regenbogen) {
      const s = schnuppen.find((e) => !e.aktiv);
      if (!s) return;
      s.aktiv = true;
      s.z = tiefe;
      /* Eine halbe Bildbreite entspricht in dieser Tiefe so vielen
         Welteinheiten. Damit liegt jeder Startpunkt dort, wo er im
         Bild liegen soll, egal wie weit hinten die Schnuppe fliegt. */
      const einheitX = (breite / 2) * tiefe / brenn;
      const einheitY = (hoehe / 2) * tiefe / brenn;
      s.x = sx * einheitX;
      s.y = sy * einheitY;
      /* Alle fliegen in dieselbe Richtung: von links oben nach rechts
         unten, leicht auf die Kamera zu. Ein Schwarm aus einer
         Richtung liest sich als Ereignis, aus allen als Konfetti.
         Die Strecke ist in Bildbreiten gedacht, damit jede Schnuppe
         das Bild in ihrer Lebenszeit auch wirklich durchquert. */
      s.vx = (2.9 * einheitX) / dauer;
      s.vy = (1.15 * einheitY) / dauer;
      s.vz = -tiefe * 0.1;
      s.gesamt = dauer; s.rest = dauer;
      s.wahr = farbe;
      s.regenbogen = regenbogen === true;
      s.alter = 0;
      /* Die Heldenschnuppe fliegt zunaechst blass und springt erst
         kurz vor dem Aufprall auf ihre echte Farbe. Das ist der
         entscheidende Moment der ganzen Ziehung: bis dahin koennte
         es alles sein. Ohne diesen Aufschub verraet die Farbe das
         Ergebnis schon, waehrend die Schnuppe noch am Horizont ist. */
      s.farbe = held ? '#dbeafe' : farbe;
      /* Radius im Raum so waehlen, dass er beim Start `gross` Pixel
         gross erscheint. Waechst danach von allein, wenn die Kamera
         naeher kommt - und nur darum reisst die Nahaufnahme auf. */
      s.gross = gross * tiefe / brenn;
      s.held = held;
      s.spurLen = 0;
      s.spurKopf = 0;
      s.spurZeit = 0;
    },

    heldImBild() { return heldBild; },

    bild(dt, tag, anflug) {
      if (!ctx || !lctx || !kctx) return;
      const t = Math.max(0, Math.min(1, tag));
      const an = Math.max(0, Math.min(1, anflug));
      const mx = breite / 2;
      const my = hoehe / 2;

      /* Die Kamera faehrt die ganze Zeit langsam vorwaerts und beim
         Anflug stark beschleunigt. Quadratisch, damit der Schub am
         Ende kommt und nicht gleichmaessig ueber die Sekunde. */
      kamera += dt * (260 + an * an * 5200);

      /* ------------------------- Himmel ------------------------- */
      const verlauf = ctx.createLinearGradient(0, 0, 0, hoehe);
      verlauf.addColorStop(0, misch(NACHT_OBEN, TAG_OBEN, t));
      verlauf.addColorStop(1, misch(NACHT_UNTEN, TAG_UNTEN, t));
      ctx.fillStyle = verlauf;
      ctx.fillRect(0, 0, breite, hoehe);

      /* ---------------------- Wolken mit Tiefe ------------------- */
      drift = (drift + dt * 16) % breite;
      if (wolken && t > 0.02) {
        /* Die Wolken sitzen weit hinten. Beim Anflug wachsen sie nur
           wenig - genau das laesst die Schnuppe davor nah wirken. */
        const zoom = 1 + an * 0.55;
        const bw = breite * 2 * zoom;
        const bh = hoehe * 0.6 * zoom;
        const y = hoehe * 0.56 - (zoom - 1) * hoehe * 0.25;
        ctx.globalAlpha = t * 0.85;
        ctx.drawImage(wolken, -drift, y, bw, bh);
        ctx.drawImage(wolken, -drift + bw * 0.5, y, bw, bh);
        ctx.globalAlpha = t * 0.45;
        ctx.drawImage(wolken, drift * 0.35 - breite * 0.3, hoehe * 0.78,
          bw * 0.8, bh * 0.7);
        ctx.globalAlpha = 1;
      }

      /* ===================== Alles Leuchtende ===================
         Sterne und Schnuppen werden nicht direkt auf den Himmel
         gemalt, sondern auf eine eigene Flaeche. Die wird danach
         zweimal aufgelegt: einmal scharf, einmal klein gerechnet und
         gross zurueckgezogen. Das zweite Auflegen ist der Schein um
         die Lichter - der Umweg ueber die kleine Flaeche ist eine
         Unschaerfe, die nichts kostet, weil der Browser das
         Hochskalieren ohnehin glaettet.

         Warum nicht einfach ein Filter: `filter: blur()` auf einem
         Canvas kostet auf iOS-Safari mitten in der Bewegung so viel
         Bildrate, dass die Animation sichtbar hakt. Zwei drawImage
         kosten nichts. */
      lctx.clearRect(0, 0, breite, hoehe);
      lctx.save();
      lctx.globalCompositeOperation = 'lighter';
      lctx.lineCap = 'round';

      /* ------------------- Sterne, perspektivisch ---------------- */
      if (t < 1) {
        lctx.fillStyle = '#ffffff';
        for (let i = 0; i < STERNE; i++) {
          /* Wiedereintritt: was hinter der Kamera liegt, kommt weit
             vorn zurueck. So reicht ein festes Feld fuer jede Strecke. */
          let z = sterne[i * 3 + 2]! - (kamera % 2600);
          if (z < NAH) z += 2600;
          const s = brenn / z;
          const x = mx + sterne[i * 3]! * s;
          const y = my + sterne[i * 3 + 1]! * s;
          if (x < -20 || x > breite + 20 || y < -20 || y > hoehe + 20) continue;
          /* Fernes ist blasser: die Tiefe soll man sehen, nicht nur
             an der Geschwindigkeit ablesen. */
          const nah = Math.min(1, 900 / z);
          lctx.globalAlpha = (1 - t) * nah * 0.95;
          const r = Math.max(0.4, s * 1.3);
          lctx.beginPath();
          lctx.arc(x, y, r, 0, Math.PI * 2);
          lctx.fill();
        }
      }

      /* ---------------------- Sternschnuppen -------------------- */
      heldBild = null;
      for (const s of schnuppen) {
        if (!s.aktiv) continue;
        s.rest -= dt;
        if (s.rest <= 0) { s.aktiv = false; continue; }
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.z += s.vz * dt;

        /* Die Heldenschnuppe wird auf eine feste Endentfernung
           gezogen, nicht um eine Strecke verschoben. Verschieben hiess
           vorher: bei hoher Bildrate faehrt die Kamera weiter als
           gedacht, die Schnuppe rutscht hinter die Kamera und schiesst
           seitlich aus dem Bild. Ein Ziel kann man nicht verfehlen. */
        const z = s.held
          ? s.z + (HELD_NAH - s.z) * (an * an * (3 - 2 * an))
          : Math.max(NAH, s.z - kamera * 0.25);

        s.spurZeit += dt;
        while (s.spurZeit >= SPUR_TAKT) {
          s.spurZeit -= SPUR_TAKT;
          s.spur[s.spurKopf * 3] = s.x;
          s.spur[s.spurKopf * 3 + 1] = s.y;
          s.spur[s.spurKopf * 3 + 2] = z;
          s.spurKopf = (s.spurKopf + 1) % SPUR_PUNKTE;
          if (s.spurLen < SPUR_PUNKTE) s.spurLen++;
        }

        /* Die Kamera schwenkt beim Anflug auf die Heldenschnuppe.
           Ohne das schiebt die Perspektive sie seitlich aus dem Bild:
           je naeher sie kommt, desto staerker wirkt ihr seitlicher
           Abstand zur Bildachse. Gemessen stand sie am Ende bei
           x = 22847 statt in der Mitte. */
        const schwenk = s.held ? an * an * (3 - 2 * an) : 0;
        const wx = s.x * (1 - schwenk);
        const wy = s.y * (1 - schwenk);

        s.alter += dt;
        const anteil = s.rest / s.gesamt;
        const staerke = Math.min(1, anteil * 3) * Math.min(1, (1 - anteil) * 6 + 0.15);

        /* Enthuellung: ab 62 Prozent des Anflugs traegt die
           Heldenschnuppe ihre echte Farbe. Beim Regenbogen laeuft sie
           danach durch das Spektrum - das ist die Konvention fuer die
           hoechste Stufe, und sie ist auf einen Blick von jeder
           einzelnen Farbe zu unterscheiden. */
        if (s.held) {
          if (an > 0.62) {
            s.farbe = s.regenbogen
              ? 'hsl(' + Math.round((s.alter * 420) % 360) + ',100%,62%)'
              : s.wahr;
          } else s.farbe = '#dbeafe';
        }

        const skala = brenn / z;
        const bx = mx + wx * skala;
        const by = my + wy * skala;
        const br = Math.max(0.6, s.gross * skala);

        if (s.held) heldBild = { x: bx, y: by, r: br };

        /* Schweif: von hinten nach vorn duenner. Jeder Punkt wird
           einzeln projiziert - deshalb biegt sich der Schweif in der
           Perspektive, statt ein gerader Strich zu bleiben. */
        for (let i = 1; i < s.spurLen; i++) {
          const a = (s.spurKopf - i + SPUR_PUNKTE * 2) % SPUR_PUNKTE;
          const b = (s.spurKopf - i - 1 + SPUR_PUNKTE * 2) % SPUR_PUNKTE;
          const za = Math.max(NAH, s.spur[a * 3 + 2]!);
          const zb = Math.max(NAH, s.spur[b * 3 + 2]!);
          const sa = brenn / za;
          const sb = brenn / zb;
          const nah = 1 - i / s.spurLen;
          lctx.globalAlpha = staerke * nah * nah * 0.75;
          lctx.strokeStyle = s.farbe;
          lctx.lineWidth = Math.max(1, s.gross * sa * nah * 2.2);
          lctx.beginPath();
          /* Derselbe Schwenk wie fuer den Kern, sonst loest sich der
             Schweif beim Anflug vom Kopf. */
          lctx.moveTo(mx + s.spur[a * 3]! * (1 - schwenk) * sa,
            my + s.spur[a * 3 + 1]! * (1 - schwenk) * sa);
          lctx.lineTo(mx + s.spur[b * 3]! * (1 - schwenk) * sb,
            my + s.spur[b * 3 + 1]! * (1 - schwenk) * sb);
          lctx.stroke();
        }

        /* Kern: farbiger Hof, weisser Punkt. Die Seltenheit liest man
           am Hof - ein farbiger Punkt waere bei der Geschwindigkeit
           kaum als Farbe erkennbar.

           In der Nahaufnahme wird aus dem Punkt eine Flaeche mit
           Verlauf. Ein harter Kreis in Bildschirmgroesse sieht nach
           Grafikfehler aus, ein Verlauf nach Glut. */
        if (br > 26) {
          const hof = lctx.createRadialGradient(bx, by, 0, bx, by, br * 2.6);
          hof.addColorStop(0, '#ffffff');
          hof.addColorStop(0.28, s.farbe);
          hof.addColorStop(1, 'rgba(0,0,0,0)');
          lctx.globalAlpha = staerke;
          lctx.fillStyle = hof;
          lctx.beginPath();
          lctx.arc(bx, by, br * 2.6, 0, Math.PI * 2);
          lctx.fill();
        } else {
          lctx.globalAlpha = staerke * 0.7;
          lctx.fillStyle = s.farbe;
          lctx.beginPath();
          lctx.arc(bx, by, br * 2.2, 0, Math.PI * 2);
          lctx.fill();
          lctx.globalAlpha = staerke;
          lctx.fillStyle = '#ffffff';
          lctx.beginPath();
          lctx.arc(bx, by, br * 0.85, 0, Math.PI * 2);
          lctx.fill();
        }
      }
      lctx.restore();

      /* -------------------- Licht auflegen ---------------------- */
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(leucht, 0, 0, breite, hoehe);

      kctx.clearRect(0, 0, kleinB, kleinH);
      kctx.drawImage(leucht, 0, 0, kleinB, kleinH);
      /* Zweimal aufgelegt: einmal eng fuer den harten Schein, einmal
         doppelt so gross fuer den weiten. Ein einzelner Schein sieht
         nach Nebel aus, zwei nach Licht. */
      ctx.globalAlpha = 0.7;
      ctx.drawImage(klein, 0, 0, breite, hoehe);
      ctx.globalAlpha = 0.4;
      ctx.drawImage(klein, -breite * 0.06, -hoehe * 0.06, breite * 1.12, hoehe * 1.12);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    },

    leeren() {
      for (const s of schnuppen) s.aktiv = false;
      kamera = 0;
      heldBild = null;
      ctx?.clearRect(0, 0, breite, hoehe);
      lctx?.clearRect(0, 0, breite, hoehe);
      kctx?.clearRect(0, 0, kleinB, kleinH);
    },

    zerstoeren() {
      beobachter.disconnect();
      canvas.remove();
    },
  };
}
