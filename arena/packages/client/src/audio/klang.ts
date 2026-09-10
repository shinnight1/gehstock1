/* ------------------------------------------------------------------
   Ton.

   Alle Klaenge entstehen zur Laufzeit aus Oszillatoren und Rauschen -
   keine einzige Audiodatei. Das hat drei Gruende: nichts muss geladen
   werden, nichts kann fehlen, und das fertige Spiel bleibt um die
   Dateien kleiner, die ein Klangpaket sonst mitbraechte. Fuer ein
   Spiel dieser Art reicht das klanglich vollkommen.

   Safari startet keinen Ton, bevor der Nutzer etwas angefasst hat.
   Der AudioContext wird deshalb erst beim ersten Tipp erzeugt, nicht
   beim Laden - ein frueher erzeugter Context bliebe stumm stehen und
   liesse sich spaeter nur schwer wiederbeleben.

   Alles laeuft ueber einen gemeinsamen Regler. Wer den Ton in den
   Optionen abschaltet, dreht ihn auf null; die Klaenge werden dann
   zwar noch berechnet, aber nichts davon ist zu hoeren. Das ist
   billiger als an jeder Aufrufstelle zu pruefen.
   ------------------------------------------------------------------ */

export type KlangArt =
  | 'deploy' | 'treffer' | 'flaeche' | 'tod' | 'turmfall'
  | 'zauber' | 'tipp' | 'sieg' | 'niederlage'
  | 'rollAufladen' | 'rollFlug' | 'rollAufprall' | 'rollReveal';

export interface Klang {
  /** Einen Klang abspielen. Ohne Wirkung, solange nichts freigegeben ist. */
  spiel(art: KlangArt, hoehe?: number): void;
  /** Nach der ersten Nutzerberuehrung aufrufen. Mehrfach unschaedlich. */
  freigeben(): void;
  an(wert: boolean): void;
  zerstoeren(): void;
}

/* Ein kurzes Rauschen, einmal erzeugt und dann immer wieder gespielt.
   Rauschen bei jedem Treffer neu zu wuerfeln waere bei vierzig
   Einheiten auf dem Feld spuerbar. */
let rauschPuffer: AudioBuffer | null = null;

function rauschen(ctx: AudioContext): AudioBuffer {
  if (rauschPuffer && rauschPuffer.sampleRate === ctx.sampleRate) return rauschPuffer;
  const laenge = Math.floor(ctx.sampleRate * 0.4);
  const puffer = ctx.createBuffer(1, laenge, ctx.sampleRate);
  const daten = puffer.getChannelData(0);
  for (let i = 0; i < laenge; i++) daten[i] = Math.random() * 2 - 1;
  rauschPuffer = puffer;
  return puffer;
}

export function klangAnlegen(anfangsZustand: boolean): Klang {
  let ctx: AudioContext | null = null;
  let summe: GainNode | null = null;
  let eingeschaltet = anfangsZustand;

  /* Damit gleichzeitige Treffer nicht uebersteuern: die Summe wird
     leise genug gehalten, dass auch ein Dutzend Klaenge auf einmal
     nicht clippt. */
  const GRUNDLAUTSTAERKE = 0.22;

  function starten(): void {
    if (ctx) return;
    try {
      const Ctor = window.AudioContext
        ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      ctx = new Ctor();
      summe = ctx.createGain();
      summe.gain.value = eingeschaltet ? GRUNDLAUTSTAERKE : 0;
      summe.connect(ctx.destination);
    } catch {
      /* Kein Ton moeglich - das Spiel laeuft trotzdem. */
      ctx = null;
    }
  }

  /** Ein Ton mit Huellkurve. Alles hier baut darauf auf. */
  function ton(
    typ: OscillatorType, von: number, bis: number,
    dauer: number, lautstaerke: number, verzoegerung = 0,
  ): void {
    if (!ctx || !summe) return;
    const start = ctx.currentTime + verzoegerung;
    const osz = ctx.createOscillator();
    const huelle = ctx.createGain();
    osz.type = typ;
    osz.frequency.setValueAtTime(von, start);
    if (bis !== von) osz.frequency.exponentialRampToValueAtTime(Math.max(1, bis), start + dauer);

    /* Kurzer Anstieg statt Sprung: ein Ton, der bei voller Lautstaerke
       einsetzt, knackst hoerbar. */
    huelle.gain.setValueAtTime(0.0001, start);
    huelle.gain.exponentialRampToValueAtTime(lautstaerke, start + 0.008);
    huelle.gain.exponentialRampToValueAtTime(0.0001, start + dauer);

    osz.connect(huelle);
    huelle.connect(summe);
    osz.start(start);
    osz.stop(start + dauer + 0.02);
  }

  /** Gefiltertes Rauschen - fuer Schlaege, Explosionen, Wind. */
  function rausch(
    dauer: number, lautstaerke: number, filter: number,
    typ: BiquadFilterType = 'lowpass', verzoegerung = 0,
  ): void {
    if (!ctx || !summe) return;
    const start = ctx.currentTime + verzoegerung;
    const quelle = ctx.createBufferSource();
    quelle.buffer = rauschen(ctx);
    const bq = ctx.createBiquadFilter();
    bq.type = typ;
    bq.frequency.setValueAtTime(filter, start);
    const huelle = ctx.createGain();
    huelle.gain.setValueAtTime(lautstaerke, start);
    huelle.gain.exponentialRampToValueAtTime(0.0001, start + dauer);

    quelle.connect(bq);
    bq.connect(huelle);
    huelle.connect(summe);
    quelle.start(start);
    quelle.stop(start + dauer + 0.02);
  }

  return {
    freigeben() {
      starten();
      // Safari legt den Context nach dem Erzeugen schlafen.
      if (ctx && ctx.state === 'suspended') void ctx.resume();
    },

    an(wert) {
      eingeschaltet = wert;
      if (summe && ctx) {
        summe.gain.setTargetAtTime(wert ? GRUNDLAUTSTAERKE : 0, ctx.currentTime, 0.02);
      }
    },

    spiel(art, hoehe = 1) {
      if (!ctx || !eingeschaltet) return;

      switch (art) {
        case 'tipp':
          ton('sine', 520 * hoehe, 520 * hoehe, 0.05, 0.25);
          break;

        case 'deploy':
          // Kurzes Aufsetzen: tiefer Puls plus etwas Staub.
          ton('sine', 180 * hoehe, 90 * hoehe, 0.16, 0.5);
          rausch(0.12, 0.18, 900);
          break;

        case 'treffer':
          /* Absichtlich sehr kurz und leise: auf dem Feld schlagen
             pro Sekunde leicht zwanzig Einheiten zu, ein satter Klang
             waere hier innerhalb von Sekunden unertraeglich. */
          rausch(0.05, 0.1, 2400, 'bandpass');
          break;

        case 'flaeche':
          rausch(0.18, 0.22, 1100);
          ton('triangle', 220, 80, 0.2, 0.3);
          break;

        case 'tod':
          ton('sawtooth', 300 * hoehe, 70 * hoehe, 0.18, 0.22);
          rausch(0.14, 0.14, 1600, 'bandpass');
          break;

        case 'zauber':
          ton('sine', 900, 200, 0.35, 0.3);
          rausch(0.3, 0.25, 800);
          break;

        case 'turmfall':
          /* Der wichtigste Klang des Spiels - er darf lang sein und
             muss durch alles andere durchkommen. */
          rausch(0.9, 0.5, 500);
          ton('sawtooth', 140, 40, 0.8, 0.35);
          ton('sine', 70, 30, 1.1, 0.3, 0.05);
          break;

        case 'sieg':
          ton('triangle', 523, 523, 0.16, 0.4);
          ton('triangle', 659, 659, 0.16, 0.4, 0.14);
          ton('triangle', 784, 784, 0.4, 0.45, 0.28);
          break;

        case 'niederlage':
          ton('triangle', 392, 392, 0.2, 0.35);
          ton('triangle', 330, 330, 0.2, 0.35, 0.18);
          ton('triangle', 262, 262, 0.55, 0.4, 0.36);
          break;

        case 'rollAufladen':
          // Ansteigendes Sirren, baut Spannung auf.
          ton('sine', 200, 900, 0.6, 0.3);
          break;

        case 'rollFlug':
          rausch(0.5, 0.3, 3000, 'bandpass');
          ton('sine', 700 * hoehe, 1400 * hoehe, 0.5, 0.25);
          break;

        case 'rollAufprall':
          rausch(0.5, 0.45, 900);
          ton('sine', 400 * hoehe, 120 * hoehe, 0.45, 0.4);
          break;

        case 'rollReveal':
          /* Die Tonhoehe traegt die Seltenheit: je hoeher, desto
             seltener. Man hoert, was man gezogen hat, bevor die Karte
             sich fertig gedreht hat. */
          ton('triangle', 440 * hoehe, 440 * hoehe, 0.14, 0.35);
          ton('triangle', 660 * hoehe, 660 * hoehe, 0.3, 0.3, 0.1);
          break;
      }
    },

    zerstoeren() {
      if (!ctx) return;
      try { void ctx.close(); } catch { /* schon zu */ }
      ctx = null;
      summe = null;
    },
  };
}
