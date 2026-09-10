/* ------------------------------------------------------------------
   Das Spiel-HUD: Karten, Elixir, Uhr, Turmstand.

   Im Querformat ist das Feld hochkant und laesst links und rechts
   Platz. Genau dort sitzt die Bedienung - nicht ueber dem Feld, wo
   sie verdecken wuerde, was zaehlt.

     links   Uhr, Turmstand beider Seiten
     rechts  vier Handkarten im Zweierraster, naechste Karte,
             darunter die Elixirleiste

   Alles auf demselben Canvas wie das Spielfeld. Ein DOM-HUD muesste
   bei jeder Elixiraenderung Text schreiben, und DOM-Schreibzugriffe
   in der Zeichenschleife sind auf dem iPad das Teuerste, was man tun
   kann.
   ------------------------------------------------------------------ */

import { karteVon, ELIXIR, TICKS_PRO_SEKUNDE } from '@arena/sim';
import type { MatchState, Spieler } from '@arena/sim';
import { FARBE, SELTENHEIT_FARBE } from '../render/palette.js';
import { kartenbildJetzt } from '../render/kartenbild.js';
import type { Kamera } from '../render/kamera.js';

export interface KartenFeld {
  /** Platz auf der Hand, 0 bis 3. */
  platz: number;
  kartenId: string;
  x: number;
  y: number;
  breite: number;
  hoehe: number;
  /** Reicht das Elixir? */
  bezahlbar: boolean;
}

export interface HudLage {
  karten: KartenFeld[];
  elixir: { x: number; y: number; breite: number; hoehe: number };
  /**
   * Vorschau auf die naechste Karte des Zyklus.
   *
   * Kein Zierrat: wer weiss, was als naechstes kommt, kann seinen Zug
   * darauf ausrichten - eine teure Karte jetzt zu spielen ist etwas
   * anderes, wenn danach der Konter nachrueckt. Ohne die Anzeige
   * muesste man acht Karten und ihre Reihenfolge im Kopf mitzaehlen.
   *
   * Sie ist kleiner als die Handkarten und nicht antippbar - man kann
   * sie nicht spielen, nur sehen.
   */
  naechste: { x: number; y: number; breite: number; hoehe: number; kartenId: string };
}

const RAND = 14;

/** Hoehe der Vorschau, als Anteil einer Handkarte. */
const VORSCHAU_ANTEIL = 0.42;

/**
 * Wo die Bedienelemente liegen.
 *
 * Getrennt vom Zeichnen, weil die Eingabe dieselben Rechtecke braucht -
 * zwei Berechnungen waeren zwei Gelegenheiten, auseinanderzulaufen.
 */
export function hudLage(k: Kamera, hoehe: number): HudLage {
  const spalte = Math.max(120, k.randRechts - RAND * 2);
  const links = k.x0 + k.breitePx + RAND;
  const spaltenBreite = Math.min(spalte, 320);
  const elixirHoehe = Math.max(18, hoehe * 0.035);

  /* Erst die Breite, dann pruefen, ob die Hoehe reicht.
     Auf einem niedrigen Fenster - Handy im Querformat, verkleinerter
     Browser - waere die Spalte sonst hoeher als der Bildschirm, und
     was oben steht, faellt heraus. Statt es abzuschneiden, wird alles
     gleichmaessig kleiner: lieber vier kleine Karten sehen als drei
     grosse und eine halbe. */
  const ausBreite = ((spaltenBreite - RAND) / 2) * 1.22;
  const platz = hoehe - RAND * 2;
  const ausHoehe = (platz - RAND * 3 - elixirHoehe) / (2 + VORSCHAU_ANTEIL);
  const kartenHoehe = Math.max(48, Math.min(ausBreite, ausHoehe));
  const kartenBreite = kartenHoehe / 1.22;
  const naechsteHoehe = kartenHoehe * VORSCHAU_ANTEIL;

  /* Von unten nach oben gerechnet. Die Elixirleiste sitzt am unteren
     Rand, alles andere staffelt sich darueber - so bleibt der
     wichtigste Teil an seinem Platz, auch wenn oben etwas fehlt. */
  const elixirY = hoehe - RAND - elixirHoehe;
  const reiheZwei = elixirY - RAND - kartenHoehe;
  const reiheEins = reiheZwei - RAND - kartenHoehe;

  const karten: KartenFeld[] = [];
  for (let i = 0; i < 4; i++) {
    karten.push({
      platz: i,
      kartenId: '',
      x: links + (i % 2) * (kartenBreite + RAND),
      y: i < 2 ? reiheEins : reiheZwei,
      breite: kartenBreite,
      hoehe: kartenHoehe,
      bezahlbar: false,
    });
  }

  return {
    karten,
    elixir: {
      x: links,
      y: elixirY,
      breite: Math.max(spaltenBreite, kartenBreite * 2 + RAND),
      hoehe: elixirHoehe,
    },
    naechste: {
      x: links,
      y: Math.max(RAND, reiheEins - RAND - naechsteHoehe),
      breite: naechsteHoehe / 1.22,
      hoehe: naechsteHoehe,
      kartenId: '',
    },
  };
}

/** Lage mit dem aktuellen Handinhalt fuellen. */
export function hudAktualisieren(
  lage: HudLage, s: MatchState, spieler: Spieler,
): void {
  const p = s.spieler[spieler];
  for (const feld of lage.karten) {
    const id = p.hand[feld.platz] ?? '';
    feld.kartenId = id;
    const karte = id ? karteVon(id) : undefined;
    feld.bezahlbar = !!karte && p.elixir >= karte.elixir;
  }
  lage.naechste.kartenId = p.queue[0] ?? '';
}

/* ---------------------------- Zeichnen ----------------------------- */

export function hudZeichnen(
  c: CanvasRenderingContext2D, k: Kamera, lage: HudLage,
  s: MatchState, spieler: Spieler, gewaehlt: number, restTicks: number,
  dichte: number,
): void {
  for (const feld of lage.karten) {
    karteZeichnen(c, feld, feld.platz === gewaehlt, dichte);
  }
  naechsteZeichnen(c, lage, dichte);
  elixirZeichnen(c, lage, s, spieler);
  uhrZeichnen(c, k, restTicks, s.phase === 'overtime');
  turmstandZeichnen(c, k, s, spieler);
}

function karteZeichnen(
  c: CanvasRenderingContext2D, f: KartenFeld, gewaehlt: boolean, dichte: number,
): void {
  const karte = f.kartenId ? karteVon(f.kartenId) : undefined;
  const r = f.breite * 0.12;

  c.fillStyle = gewaehlt ? '#1c2740' : '#111827';
  rundRechteck(c, f.x, f.y, f.breite, f.hoehe, r);
  c.fill();

  if (!karte) return;

  const bildBreite = f.breite - 8;
  const bildHoehe = f.hoehe * 0.58;
  const kachel = kartenbildJetzt(f.kartenId, bildBreite, bildHoehe, dichte, karte.farbe);

  c.globalAlpha = f.bezahlbar ? 1 : 0.35;
  if (kachel) {
    c.drawImage(kachel, f.x + 4, f.y + 4, bildBreite, bildHoehe);
  } else {
    // Farbfeld, solange das Bild noch nicht geladen ist.
    c.fillStyle = karte.farbe;
    rundRechteck(c, f.x + 4, f.y + 4, bildBreite, bildHoehe, r * 0.7);
    c.fill();
  }
  c.globalAlpha = 1;

  // Rahmen in der Seltenheitsfarbe
  c.strokeStyle = gewaehlt ? '#ffffff' : SELTENHEIT_FARBE[karte.seltenheit];
  c.lineWidth = gewaehlt ? 3 : 2;
  rundRechteck(c, f.x, f.y, f.breite, f.hoehe, r);
  c.stroke();

  /* Name in die Zeile direkt unter dem Bild - nicht tiefer. Weiter
     unten liefe er in den Kostenkreis, und ein Kartenname, der von
     einer Zahl durchschnitten wird, ist im Gefecht unlesbar. */
  c.fillStyle = f.bezahlbar ? FARBE.text : FARBE.textLeise;
  c.font = '600 ' + Math.round(f.breite * 0.115) + 'px system-ui, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  kurzText(c, karte.name, f.x + f.breite / 2, f.y + f.hoehe * 0.7, f.breite - 8);

  // Elixirkosten als Kreis unten links
  const kr = f.breite * 0.15;
  const kx = f.x + kr + 4;
  const ky = f.y + f.hoehe - kr - 4;
  c.fillStyle = f.bezahlbar ? '#c026d3' : '#4b2a52';
  c.beginPath();
  c.arc(kx, ky, kr, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#ffffff';
  c.font = '700 ' + Math.round(kr * 1.25) + 'px system-ui, sans-serif';
  c.fillText(String(karte.elixir), kx, ky + 1);

  if (!f.bezahlbar) {
    c.fillStyle = 'rgba(6, 10, 18, 0.55)';
    rundRechteck(c, f.x, f.y, f.breite, f.hoehe, r);
    c.fill();
  }
}

/**
 * Die naechste Karte des Zyklus, klein und gedaempft.
 *
 * Bewusst schmaler als eine Handkarte und ohne Namen: sie soll auf
 * einen Blick erkennbar sein, aber nicht mit den vier Karten
 * konkurrieren, die man tatsaechlich spielen kann. Ein
 * gleichgrosses Feld daneben waere im Gefecht eine Falle.
 */
function naechsteZeichnen(
  c: CanvasRenderingContext2D, lage: HudLage, dichte: number,
): void {
  const n = lage.naechste;
  const karte = n.kartenId ? karteVon(n.kartenId) : undefined;

  c.fillStyle = FARBE.textLeise;
  c.font = '600 ' + Math.round(n.hoehe * 0.3) + 'px system-ui, sans-serif';
  c.textAlign = 'left';
  c.textBaseline = 'middle';
  c.fillText('Nächste', n.x + n.breite + 10, n.y + n.hoehe / 2);

  const r = n.breite * 0.14;
  c.fillStyle = '#111827';
  rundRechteck(c, n.x, n.y, n.breite, n.hoehe, r);
  c.fill();
  if (!karte) return;

  const kachel = kartenbildJetzt(n.kartenId, n.breite - 4, n.hoehe - 4, dichte, karte.farbe);
  c.globalAlpha = 0.85;
  if (kachel) {
    c.drawImage(kachel, n.x + 2, n.y + 2, n.breite - 4, n.hoehe - 4);
  } else {
    c.fillStyle = karte.farbe;
    rundRechteck(c, n.x + 2, n.y + 2, n.breite - 4, n.hoehe - 4, r * 0.7);
    c.fill();
  }
  c.globalAlpha = 1;

  c.strokeStyle = SELTENHEIT_FARBE[karte.seltenheit];
  c.lineWidth = 1.5;
  rundRechteck(c, n.x, n.y, n.breite, n.hoehe, r);
  c.stroke();

  // Kosten in die Ecke - der einzige Wert, der hier zaehlt.
  const kr = n.breite * 0.2;
  c.fillStyle = '#c026d3';
  c.beginPath();
  c.arc(n.x + kr + 2, n.y + n.hoehe - kr - 2, kr, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#ffffff';
  c.font = '700 ' + Math.round(kr * 1.3) + 'px system-ui, sans-serif';
  c.textAlign = 'center';
  c.fillText(String(karte.elixir), n.x + kr + 2, n.y + n.hoehe - kr - 1);
}

function elixirZeichnen(
  c: CanvasRenderingContext2D, lage: HudLage, s: MatchState, spieler: Spieler,
): void {
  const p = s.spieler[spieler];
  const { x, y, breite, hoehe } = lage.elixir;
  const luecke = 3;
  const feld = (breite - luecke * (ELIXIR.cap - 1)) / ELIXIR.cap;
  const teil = p.elixir >= ELIXIR.cap
    ? 1
    : p.elixirRest / ELIXIR.ticksProPunkt;

  for (let i = 0; i < ELIXIR.cap; i++) {
    const bx = x + i * (feld + luecke);
    c.fillStyle = '#2a1b33';
    rundRechteck(c, bx, y, feld, hoehe, hoehe * 0.28);
    c.fill();

    let fuellung = 0;
    if (i < p.elixir) fuellung = 1;
    else if (i === p.elixir) fuellung = teil;
    if (fuellung <= 0) continue;

    c.fillStyle = '#d946ef';
    rundRechteck(c, bx, y + hoehe * (1 - fuellung), feld, hoehe * fuellung, hoehe * 0.28);
    c.fill();
  }

  /* Keine Zahl neben der Leiste: sie sagt nichts, was die Leiste
     nicht schon zeigt, und sass genau dort, wo die unterste
     Kartenreihe endet. */
}

function uhrZeichnen(
  c: CanvasRenderingContext2D, k: Kamera, restTicks: number, overtime: boolean,
): void {
  const sekunden = Math.max(0, Math.ceil(restTicks / TICKS_PRO_SEKUNDE));
  const m = Math.floor(sekunden / 60);
  const sek = sekunden % 60;
  const text = m + ':' + (sek < 10 ? '0' : '') + sek;

  const mitte = k.x0 / 2;
  c.textAlign = 'center';
  c.textBaseline = 'top';
  c.fillStyle = overtime ? '#fbbf24' : FARBE.text;
  c.font = '700 ' + Math.round(k.x0 * 0.22) + 'px system-ui, sans-serif';
  c.fillText(text, mitte, 28);

  if (overtime) {
    c.fillStyle = '#fbbf24';
    c.font = '700 ' + Math.round(k.x0 * 0.08) + 'px system-ui, sans-serif';
    c.fillText('VERLÄNGERUNG', mitte, 28 + k.x0 * 0.26);
  }
}

/** Turmstand als Punktreihe: eigene unten, gegnerische oben. */
function turmstandZeichnen(
  c: CanvasRenderingContext2D, k: Kamera, s: MatchState, spieler: Spieler,
): void {
  const mitte = k.x0 / 2;
  const r = Math.max(6, k.x0 * 0.035);
  const reihen: { spieler: Spieler; y: number }[] = [
    { spieler: (spieler === 0 ? 1 : 0) as Spieler, y: 28 + k.x0 * 0.42 },
    { spieler, y: 28 + k.x0 * 0.42 + r * 3.2 },
  ];

  for (const reihe of reihen) {
    const tuerme = s.tuerme.filter((t) => t.spieler === reihe.spieler);
    for (let i = 0; i < tuerme.length; i++) {
      const t = tuerme[i]!;
      const x = mitte + (i - (tuerme.length - 1) / 2) * r * 2.6;
      c.beginPath();
      c.arc(x, reihe.y, t.art === 'koenig' ? r : r * 0.78, 0, Math.PI * 2);
      c.fillStyle = t.hp > 0 ? FARBE.seite[reihe.spieler] : '#33415580';
      c.fill();
      if (t.hp > 0 && t.hp < t.maxHp) {
        c.strokeStyle = '#ffffff';
        c.lineWidth = 1.5;
        c.stroke();
      }
    }
  }
}

/* ----------------------------- Helfer ------------------------------ */

function rundRechteck(
  c: CanvasRenderingContext2D, x: number, y: number,
  w: number, h: number, r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + rr, y);
  c.lineTo(x + w - rr, y);
  c.quadraticCurveTo(x + w, y, x + w, y + rr);
  c.lineTo(x + w, y + h - rr);
  c.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  c.lineTo(x + rr, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - rr);
  c.lineTo(x, y + rr);
  c.quadraticCurveTo(x, y, x + rr, y);
  c.closePath();
}

/** Text, der notfalls schrumpft statt ueberzulaufen. */
function kurzText(
  c: CanvasRenderingContext2D, text: string, x: number, y: number, maxBreite: number,
): void {
  let groesse = parseInt(c.font, 10) || 12;
  while (c.measureText(text).width > maxBreite && groesse > 7) {
    groesse--;
    c.font = c.font.replace(/\d+px/, groesse + 'px');
  }
  c.fillText(text, x, y);
}
