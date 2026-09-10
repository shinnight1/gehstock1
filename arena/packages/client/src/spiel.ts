/* ------------------------------------------------------------------
   Der Spiel-Controller: Simulation, Eingabe, Zeichenschleife.

   Die Zeichenreihenfolge steht hier und nirgends sonst:

     1  Huelle
     2  Untergrund unten   gebacken
     3  Wasser             pro Bild
     4  Untergrund oben    gebacken (Bruecken, Bande, Vignette)
     5  Platzierungszone   nur bei gewaehlter Karte
     6  Tuerme und Einheiten, von hinten nach vorne
     7  Geschosse
     8  Zielring
     9  HUD
    10  Diagnose

   Punkt 6 ist der wichtige: alles, was auf dem Boden steht, wird nach
   seiner Tiefe sortiert gezeichnet. Ohne das steht eine Einheit vor
   einem Turm, der eigentlich vor ihr liegt.
   ------------------------------------------------------------------ */

import {
  karteVon, restZeit, botAnlegen, botTick, botProfil,
} from '@arena/sim';
import type { Einheit, Spieler, Ausgang, BotZustand } from '@arena/sim';
import { flaecheAnlegen } from './render/flaeche.js';
import type { Flaeche } from './render/flaeche.js';
import { kameraAnlegen, kameraNeuBerechnen } from './render/kamera.js';
import { feldBauen, feldPasst, obenVersatz } from './render/feld.js';
import type { Feldbild } from './render/feld.js';
import { wasserZeichnen } from './render/wasser.js';
import { turmZeichnen } from './render/turm.js';
import { einheitZeichnen, projektilZeichnen } from './render/einheit.js';
import type { EinheitAnsicht } from './render/einheit.js';
import { zoneZeichnen, zielringZeichnen, wartetringZeichnen } from './render/zone.js';
import { effekteAnlegen } from './render/effekte.js';
import { FARBE } from './render/palette.js';
import { ausrichtungUeberwachen } from './ui/ausrichtung.js';
import { zurueckKnopfAnlegen } from './ui/zurueck.js';
import { hudLage, hudAktualisieren, hudZeichnen } from './ui/hud.js';
import type { HudLage } from './ui/hud.js';
import { eingabeAnlegen } from './ui/eingabe.js';
import { leistungUeberwachen, debugAn } from './debug/leistung.js';
import { debugAnzeigeAnlegen } from './debug/anzeige.js';
import type { DebugAnzeige } from './debug/anzeige.js';
import { bildLaden } from './assets/lader.js';
import { laufStarten } from './sim/lauf.js';
import type { Lauf } from './sim/lauf.js';

export interface SpielOptionen {
  serverUrl?: string;
  onExit?: () => void;
  gespiegelt?: boolean;
  /**
   * Fertiger Lauf von aussen.
   *
   * Im Onlinemodus haengt die Simulation am Netz und nicht an der
   * lokalen Uhr; sie wird dort angelegt und hier nur bedient. Fehlt
   * die Angabe, macht sich das Spiel wie bisher seinen eigenen.
   */
  lauf?: Lauf;
  /** Welche Seite der Mensch spielt. Gegen den Bot immer 0. */
  ich?: Spieler;
  /** Seed des Matches. Ohne Angabe wird einer aus der Uhr gezogen. */
  seed?: number;
  /** Deck des Menschen. Ohne Angabe springt ein Standarddeck ein. */
  deck?: string[];
  /** Kartenlevel des Menschen. */
  level?: Record<string, number>;
  /** Deck des Gegners. */
  gegnerDeck?: string[];
  /** Trophaeenstand - bestimmt, wie stark der Bot spielt. */
  trophaeen?: number;
  /** Beide Seiten auf dieselbe Stufe normalisieren. */
  einheitlicheLevel?: boolean;
  /** Wird genau einmal gerufen, wenn das Match entschieden ist. */
  onEnde?: (ausgang: Ausgang, tuerme: [number, number]) => void;
  /** Erschuetterung bei Turmfall zulassen. */
  screenshake?: boolean;
  /** Wird fuer jedes Ereignis gerufen, das zu hoeren sein soll. */
  onKlang?: (art: string, hoehe?: number) => void;
}

export interface Spiel {
  zerstoeren(): void;
}

export function spielStarten(wurzel: HTMLElement, optionen: SpielOptionen = {}): Spiel {
  /* Gegen den Bot spielt der Mensch Seite 0. Online kann er auch
     Seite 1 sein - dann steht die Kamera gespiegelt, damit er
     trotzdem von unten nach oben angreift. */
  const ICH: Spieler = optionen.ich ?? 0;

  const flaeche: Flaeche = flaecheAnlegen(wurzel);
  const kamera = kameraAnlegen(optionen.gespiegelt ?? ICH === 1);
  const ausrichtung = ausrichtungUeberwachen(wurzel);
  const zurueck = zurueckKnopfAnlegen(wurzel, optionen.onExit);

  const trophaeen = optionen.trophaeen ?? 0;

  const lauf = optionen.lauf ?? laufStarten({
    seed: optionen.seed ?? (Date.now() & 0x7fffffff),
    decks: [
      optionen.deck ?? [],
      optionen.gegnerDeck ?? optionen.deck ?? [],
    ],
    level: [optionen.level ?? {}, {}],
    einheitlicheLevel: optionen.einheitlicheLevel ?? false,
  });

  /* Der Bot spielt Seite 1. Er bekommt keinen Blick in die Hand des
     Menschen und kein Extra-Elixir - nur ein Profil, das mit den
     Trophaeen waechst. Online gibt es ihn nicht: dort sitzt am
     anderen Ende ein Mensch, und der Lauf kommt fertig herein. */
  if (!optionen.lauf) {
    const bot: BotZustand = botAnlegen(1, botProfil(trophaeen));
    lauf.botSetzen(bot);
  }

  let endeGemeldet = false;

  let lage: HudLage = hudLage(kamera, 1);

  const eingabe = eingabeAnlegen(flaeche.canvas, {
    lage: () => lage,
    kamera: () => kamera,
    spielen: (platz, x, y) => {
      const id = lauf.state.spieler[ICH].hand[platz];
      if (!id) return false;
      return lauf.zugEinreihen(ICH, id, x, y) === null;
    },
    erlaubt: (platz, x, y) => {
      const id = lauf.state.spieler[ICH].hand[platz];
      if (!id) return false;
      return lauf.zugMoeglich(ICH, id, x, y) === null;
    },
  });

  const grundDichte = flaeche.dichte;
  const leistung = leistungUeberwachen((stufe) => {
    flaeche.dichteSetzen(grundDichte * (stufe === 1 ? 0.75 : 0.5));
    feldbild = null;
  });

  const debug: DebugAnzeige | null = debugAn() ? debugAnzeigeAnlegen(wurzel) : null;
  const ruhig = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const effekte = effekteAnlegen((optionen.screenshake ?? true) && !ruhig);

  let feldbild: Feldbild | null = null;
  let letzteBreite = 0;
  let letzteHoehe = 0;

  /* Zeichenliste, einmal angelegt und pro Bild neu befuellt. Ein
     frisches Array je Bild waere 60 Allokationen je Sekunde, die der
     Muellsammler irgendwann alle auf einmal einsammelt. */
  const zeichenliste: EinheitAnsicht[] = [];
  for (let i = 0; i < 256; i++) {
    zeichenliste.push({ einheit: null as unknown as Einheit, x: 0, y: 0 });
  }

  void bildLaden('king.png');

  /* Bilder vorladen, bevor sie gebraucht werden.

     Ohne das zeigt die Kartenleiste in den ersten Sekunden vier
     Farbfelder - genau in dem Moment, in dem man zum ersten Mal auf
     sie tippt - und die ersten Einheiten auf dem Feld erscheinen als
     Kapseln, weil ihre Figur noch unterwegs ist. Beides faellt genau
     dann auf, wenn das Match anfaengt.

     Beide Decks, nicht nur das eigene: die Einheiten des Gegners
     stehen genauso schnell auf dem Feld. Das Spawner-Gebaeude bringt
     seine eigene Einheit mit, die in keinem Deck steht. */
  const vorladen = new Set<string>([
    ...(optionen.deck ?? []),
    ...(optionen.gegnerDeck ?? optionen.deck ?? []),
  ]);
  for (const id of vorladen) {
    void bildLaden('cards/' + id + '.webp');
    void bildLaden('units/' + id + '.webp');
    const karte = karteVon(id);
    if (karte?.spawnKarte) void bildLaden('units/' + karte.spawnKarte + '.webp');
  }

  /* Hinter ?debug=1 haengt der Zustand am Fenster. Das ist kein
     Hintertuerchen: ohne Debug-Flag passiert es nicht, und wer die
     Adresse aendern kann, spielt ohnehin lokal gegen einen Bot. Im
     Online-Modus rechnet der Server mit. */
  if (debug) {
    (window as unknown as Record<string, unknown>)['arena'] = {
      lauf, kamera, eingabe, lage: () => lage,
      /* Flaeche und Leistungsmesser stehen hier, damit sich die
         Fuellrate eines iPads auf dem Rechner nachstellen laesst:
         dichteSetzen(2) kostet dieselbe Pixelmenge wie dort. */
      flaeche, leistung, effekte,
    };
  }

  let laeuft = true;
  let letzterStempel = 0;
  let anforderung = 0;

  function bild(stempel: number): void {
    if (!laeuft) return;
    anforderung = requestAnimationFrame(bild);

    const dt = letzterStempel ? stempel - letzterStempel : 16.7;
    letzterStempel = stempel;
    leistung.messen(dt);

    if (ausrichtung.istHochformat()) return;

    lauf.vorschieben(dt);

    flaeche.vermessen();
    const ctx = flaeche.ctx;
    const breite = flaeche.breite;
    const hoehe = flaeche.hoehe;
    const zeit = ruhig ? 0 : stempel / 1000;
    const s = lauf.state;

    if (breite !== letzteBreite || hoehe !== letzteHoehe) {
      letzteBreite = breite;
      letzteHoehe = hoehe;
      kameraNeuBerechnen(kamera, breite, hoehe);
      lage = hudLage(kamera, hoehe);
      feldbild = null;
    }
    hudAktualisieren(lage, s, ICH);

    /* Ereignisse abholen, bevor gezeichnet wird: die Effekte des
       aktuellen Ticks sollen im selben Bild zu sehen sein, in dem der
       Treffer passiert ist. */
    const ereignisse = lauf.ereignisseAbholen();
    if (ereignisse.length) {
      effekte.aufnehmen(ereignisse, kamera);
      for (const e of ereignisse) vertonen(e);
    }

    ctx.fillStyle = FARBE.huelle;
    ctx.fillRect(0, 0, breite, hoehe);

    /* Alles ab hier wackelt mit, wenn ein Turm faellt - Feld, Einheiten
       und Effekte gemeinsam. Das HUD bleibt bewusst ruhig stehen: eine
       zitternde Kartenleiste waere nicht dramatisch, sondern nur
       schwerer zu treffen. */
    const ruettelX = effekte.ruettelX();
    const ruettelY = effekte.ruettelY();
    const wackelt = ruettelX !== 0 || ruettelY !== 0;
    if (wackelt) {
      ctx.save();
      ctx.translate(ruettelX, ruettelY);
    }

    if (!feldPasst(feldbild, kamera, flaeche.dichte)) {
      feldbild = feldBauen(kamera, flaeche.dichte);
    }
    ctx.drawImage(feldbild.unten, kamera.x0, kamera.y0, kamera.breitePx, kamera.hoehePx);
    wasserZeichnen(ctx, kamera, zeit);

    const rand = obenVersatz(kamera);
    ctx.drawImage(
      feldbild.oben, kamera.x0 - rand, kamera.y0 - rand,
      kamera.breitePx + rand * 2, kamera.hoehePx + rand * 2,
    );

    /* Zone nur, solange eine Karte in der Hand haengt. Dauerhaft
       eingeblendet wuerde sie das Feld einfaerben und die Lesbarkeit
       kosten, ohne je etwas Neues zu sagen. */
    const gewaehlteId = eingabe.gewaehlt >= 0
      ? s.spieler[ICH].hand[eingabe.gewaehlt]
      : undefined;
    if (gewaehlteId) {
      const karte = karteVon(gewaehlteId);
      zoneZeichnen(
        ctx, kamera, ICH, s.spieler[ICH].offeneFlanken,
        karte?.art === 'zauber',
      );
    }

    // Alles auf dem Boden nach Tiefe sortiert zeichnen.
    let anzahl = 0;
    const a = lauf.alpha;
    for (let i = 0; i < s.einheiten.length && anzahl < zeichenliste.length; i++) {
      const e = s.einheiten[i]!;
      if (!e.aktiv) continue;
      const eintrag = zeichenliste[anzahl++]!;
      eintrag.einheit = e;
      // Zwischen der Position vor dem letzten Tick und der jetzigen.
      eintrag.x = lauf.vorherX(i) + (e.x - lauf.vorherX(i)) * a;
      eintrag.y = lauf.vorherY(i) + (e.y - lauf.vorherY(i)) * a;
    }
    const sichtbar = zeichenliste.slice(0, anzahl);
    sichtbar.sort((p, q) => p.y - q.y);

    let naechste = 0;
    const tuermeNachTiefe = s.tuerme
      .map((t, i) => ({ t, i }))
      .sort((p, q) => p.t.y - q.t.y);
    for (const { t } of tuermeNachTiefe) {
      while (naechste < sichtbar.length && sichtbar[naechste]!.y < t.y) {
        einheitZeichnen(ctx, kamera, sichtbar[naechste]!, s.tick);
        naechste++;
      }
      turmZeichnen(ctx, kamera, t, zeit, s.tick + lauf.alpha);
    }
    while (naechste < sichtbar.length) {
      einheitZeichnen(ctx, kamera, sichtbar[naechste]!, s.tick);
      naechste++;
    }

    for (const p of s.projektile) {
      if (p.aktiv) projektilZeichnen(ctx, kamera, p);
    }

    effekte.zeichnen(ctx, Math.min(0.05, dt / 1000));
    if (wackelt) ctx.restore();

    /* Ende genau einmal melden. Die Schleife laeuft danach weiter -
       der Bildschirmwechsel kommt von aussen, und bis dahin soll das
       Bild stehen bleiben statt einzufrieren. */
    if (s.phase === 'ende' && s.ausgang && !endeGemeldet) {
      endeGemeldet = true;
      optionen.onEnde?.(s.ausgang, [
        s.spieler[0].tuermeZerstoert, s.spieler[1].tuermeZerstoert,
      ]);
    }

    if (gewaehlteId && eingabe.ueberFeld) {
      const karte = karteVon(gewaehlteId);
      zielringZeichnen(
        ctx, kamera, eingabe.feldX, eingabe.feldY,
        karte?.art === 'zauber' ? (karte.zauberRadius ?? 1500) : (karte?.radius ?? 500),
        eingabe.gewaehlt >= 0
        && lauf.zugMoeglich(ICH, gewaehlteId, eingabe.feldX, eingabe.feldY) === null,
      );
    }

    /* Optimistische Anzeige: online ist ein Zug unterwegs, bevor er
       wirkt. Der gestrichelte Ring steht dort, wo die Einheit gleich
       erscheint - und verschwindet wieder, wenn der Server den Zug
       ablehnt. */
    const unterwegs = lauf.offeneZuege?.();
    if (unterwegs?.length) {
      for (const z of unterwegs) {
        const k = karteVon(z.kartenId);
        wartetringZeichnen(
          ctx, kamera, z.x, z.y,
          k?.art === 'zauber' ? (k.zauberRadius ?? 1500) : (k?.radius ?? 500),
          zeit,
        );
      }
    }

    hudZeichnen(ctx, kamera, lage, s, ICH, eingabe.gewaehlt, restZeit(s), flaeche.dichte);

    if (debug) {
      debug.setzen([
        'fps    ' + leistung.fps().toFixed(0),
        'dichte ' + flaeche.dichte.toFixed(2) + (leistung.stufe() ? ' (gesenkt)' : ''),
        'tick   ' + s.tick + '  ' + s.phase,
        'einh   ' + anzahl,
        'elixir ' + s.spieler[0].elixir + ' / ' + s.spieler[1].elixir,
      ]);
    }
  }

  /**
   * Ereignis in einen Klang uebersetzen.
   *
   * Treffer sind bewusst der leiseste Klang im Spiel: auf einem vollen
   * Feld schlagen pro Sekunde zwanzig Einheiten zu, und jeder davon
   * satt zu vertonen waere nach zehn Sekunden unertraeglich.
   */
  function vertonen(e: { art: string; radius: number }): void {
    if (!optionen.onKlang) return;
    if (e.art === 'tod') optionen.onKlang('tod', 0.8 + Math.random() * 0.5);
    else if (e.art === 'turmfall') optionen.onKlang('turmfall');
    else if (e.art === 'zauber') optionen.onKlang('zauber');
    else if (e.art === 'deploy') optionen.onKlang('deploy', 0.9 + Math.random() * 0.3);
    else if (e.art === 'treffer') {
      optionen.onKlang(e.radius > 0 ? 'flaeche' : 'treffer');
    }
  }

  anforderung = requestAnimationFrame(bild);

  return {
    zerstoeren() {
      laeuft = false;
      cancelAnimationFrame(anforderung);
      effekte.leeren();
      eingabe.zerstoeren();
      debug?.zerstoeren();
      zurueck.zerstoeren();
      ausrichtung.zerstoeren();
      flaeche.zerstoeren();
    },
  };
}
