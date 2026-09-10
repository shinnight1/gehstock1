/* ------------------------------------------------------------------
   Die Simulation antreiben.

   Die Sim laeuft mit festem Takt, der Bildschirm mit dem, was das
   Geraet hergibt. Dazwischen sitzt ein Akkumulator: verstrichene Zeit
   sammeln, so viele Ticks abarbeiten, wie hineinpassen, den Rest als
   Zwischenwert an den Renderer geben.

   Ohne diese Trennung haengt das Spieltempo an der Bildrate - auf
   einem 120-Hz-iPad liefe alles doppelt so schnell wie auf einem
   60-Hz-Bildschirm, und zwei Geraete kaemen nie auf dasselbe
   Ergebnis.

   Fuer weiche Bewegung merkt sich der Lauf die Positionen vor dem
   letzten Tick. Der Renderer blendet zwischen vorher und jetzt.
   ------------------------------------------------------------------ */

import {
  matchAnlegen, tick, TICKS_PRO_SEKUNDE, MAX_EINHEITEN,
  pruefeZug, botTick,
} from '@arena/sim';
import type {
  MatchAufbau, MatchState, Command, Ablehnung, Spieler, BotZustand, Ereignis,
} from '@arena/sim';

const TICK_MS = 1000 / TICKS_PRO_SEKUNDE;

/* Mehr als das holt der Lauf nicht in einem Bild nach. Wer den Tab
   eine Minute im Hintergrund hatte, soll nicht 1200 Ticks am Stueck
   rechnen und dabei das Bild einfrieren - lieber ein Sprung. */
const MAX_NACHHOLEN = 5;

/* Wird zurueckgegeben, wenn nichts passiert ist - spart in den meisten
   Bildern eine Allokation. Der Aufrufer darf sie nicht veraendern. */
const LEER: Ereignis[] = [];

export interface Lauf {
  readonly state: MatchState;
  /** Zwischenwert 0 bis 1 zum naechsten Tick - fuer die Interpolation. */
  readonly alpha: number;
  /** Position einer Einheit vor dem letzten Tick. */
  vorherX(index: number): number;
  vorherY(index: number): number;
  /** Zeit weiterdrehen. dtMs ist der Abstand zum vorigen Bild. */
  vorschieben(dtMs: number): void;
  /** Zug fuer den naechsten Tick einreihen. Gibt den Grund bei Ablehnung. */
  zugEinreihen(spieler: Spieler, kartenId: string, x: number, y: number): Ablehnung | null;
  /** Prueft, ohne einzureihen - fuer die Vorschau beim Ziehen. */
  zugMoeglich(spieler: Spieler, kartenId: string, x: number, y: number): Ablehnung | null;
  /** Bot einhaengen, der vor jedem Tick handeln darf. */
  botSetzen(bot: BotZustand | null): void;
  /**
   * Ereignisse seit dem letzten Abholen, und leert die Liste dabei.
   *
   * Die Sim wirft ihre Ereignisliste bei jedem Tick weg. Fallen zwei
   * Ticks in ein Bild - was bei 20 Ticks und 60 Bildern regelmaessig
   * passiert, sobald das Geraet kurz haengt - waeren die des ersten
   * verloren. Deshalb werden sie hier nach jedem Tick eingesammelt.
   */
  ereignisseAbholen(): Ereignis[];
  /**
   * Eigene Zuege, die abgeschickt, aber noch nicht ausgefuehrt sind.
   *
   * Nur online besetzt. Lokal wirkt ein Zug im naechsten Tick, da gibt
   * es nichts anzuzeigen; ueber das Netz vergehen rund zweihundert
   * Millisekunden, und die will der Renderer ueberbruecken.
   */
  offeneZuege?(): readonly { kartenId: string; x: number; y: number }[];
}

export function laufStarten(aufbau: MatchAufbau): Lauf {
  const state = matchAnlegen(aufbau);
  const vorher = new Float64Array(MAX_EINHEITEN * 2);
  let rest = 0;
  let alpha = 0;

  /* Zuege werden gesammelt und im naechsten Tick ausgefuehrt, nicht
     sofort. So laeuft die lokale Partie durch denselben Kanal wie
     spaeter die Online-Partie - was hier funktioniert, funktioniert
     dort auch. */
  let warteschlange: Command[] = [];
  let bot: BotZustand | null = null;
  let gesammelt: Ereignis[] = [];

  const merken = (): void => {
    const liste = state.einheiten;
    for (let i = 0; i < liste.length; i++) {
      const e = liste[i]!;
      vorher[i * 2] = e.x;
      vorher[i * 2 + 1] = e.y;
    }
  };

  merken();

  return {
    get state() { return state; },
    get alpha() { return alpha; },

    vorherX(index: number) { return vorher[index * 2] ?? 0; },
    vorherY(index: number) { return vorher[index * 2 + 1] ?? 0; },

    vorschieben(dtMs: number): void {
      if (dtMs <= 0) return;
      rest += Math.min(dtMs, TICK_MS * MAX_NACHHOLEN);

      let schritte = 0;
      while (rest >= TICK_MS && schritte < MAX_NACHHOLEN) {
        merken();
        const fuerDiesenTick = warteschlange;
        if (fuerDiesenTick.length) {
          for (const c of fuerDiesenTick) c.tick = state.tick;
          warteschlange = [];
        }
        /* Bot vor dem Tick: sein Zug wirkt dann im selben Tick wie
           die Zuege des Menschen. Danach waere er immer einen Tick
           im Rueckstand. */
        if (bot) botTick(state, bot);
        tick(state, fuerDiesenTick);
        for (const e of state.ereignisse) gesammelt.push(e);
        rest -= TICK_MS;
        schritte++;
      }

      alpha = Math.max(0, Math.min(1, rest / TICK_MS));
    },

    zugEinreihen(spieler, kartenId, x, y): Ablehnung | null {
      const cmd: Command = {
        typ: 'playCard', spieler, kartenId, tick: state.tick, x, y,
      };
      const grund = pruefeZug(state, cmd);
      if (grund) return grund;
      warteschlange.push(cmd);
      return null;
    },

    zugMoeglich(spieler, kartenId, x, y): Ablehnung | null {
      return pruefeZug(state, {
        typ: 'playCard', spieler, kartenId, tick: state.tick, x, y,
      });
    },

    botSetzen(neu) { bot = neu; },

    ereignisseAbholen() {
      if (!gesammelt.length) return LEER;
      const raus = gesammelt;
      gesammelt = [];
      return raus;
    },
  };
}
