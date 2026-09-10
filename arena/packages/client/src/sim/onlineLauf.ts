/* ------------------------------------------------------------------
   Die Simulation am Netz.

   Nach aussen dasselbe wie lauf.ts - der Spielbildschirm merkt nicht,
   ob er gegen einen Bot oder gegen einen Menschen laeuft. Innen ist
   der Unterschied grundlegend: hier bestimmt nicht die lokale Uhr, wie
   weit gerechnet wird, sondern die Freigabe des Servers.

   Der Server schickt nach jedem Tick eine Freigabe mit den Zuegen
   dieses Ticks - auch wenn keiner gespielt wurde. Bis dahin darf
   gerechnet werden und keinen Tick weiter. Das ist der ganze
   Gleichlauf: beide Clients und der Server fuehren dieselben Befehle
   in denselben Ticks aus und kommen deshalb auf dasselbe Bild.

   Vier Faelle muss dieser Puffer aushalten:

     zu wenig da   Die Freigabe haengt. Dann steht das Bild lieber
                   kurz, als in die Zukunft zu raten und danach
                   zurueckspringen zu muessen.
     etwas hinten  Nach einem Hakler liegen ein paar Ticks bereit.
                   Dann laeuft die Uhr kurz schneller, bis der Puffer
                   wieder steht.
     weit hinten   Ein Tab im Hintergrund bekommt keine Bilder und
                   faellt in Sekunden um Hunderte Ticks zurueck. Im
                   Takt gerechnet holte er das nie wieder auf - eine
                   Sekunde Rechnen bringt genau eine Sekunde. Deshalb
                   der Aufholgang, und ab hundert Ticks der Sprung
                   ueber einen Schnappschuss.
     auseinander   Die Pruefsumme des Servers passt nicht. Dann wird
                   ein Schnappschuss geholt und neu aufgesetzt - der
                   Serverzustand gewinnt immer, nie umgekehrt.
   ------------------------------------------------------------------ */

import {
  matchAnlegen, tick as simTick, pruefeZug, pruefsumme, zustandEntpacken,
  TICKS_PRO_SEKUNDE, MAX_EINHEITEN,
} from '@arena/sim';
import type {
  MatchState, MatchAufbau, Command, Ablehnung, Spieler, Ereignis,
} from '@arena/sim';
import { VERZUG_TICKS } from '@arena/netz';
import type { VomServer, ZugAnmeldung } from '@arena/netz';
import type { Lauf } from './lauf.js';

const TICK_MS = 1000 / TICKS_PRO_SEKUNDE;
const MAX_NACHHOLEN = 5;
const LEER: Ereignis[] = [];

/**
 * Ab diesem Rueckstand wird aufgeholt statt im Takt gerechnet.
 *
 * Ein oder zwei Ticks Rueckstand sind der Normalfall und gewollt -
 * sie sind der Puffer, der Schwankungen der Leitung schluckt. Mehr
 * heisst, dass das Geraet gehangen hat.
 */
const PUFFER_TICKS = 4;

/**
 * Wie viele Ticks ein Bild hoechstens aufholt.
 *
 * Rechnen ist billig, Zeichnen ist teuer - deshalb darf ein einzelnes
 * Bild vierzig Ticks nachholen, ohne dass man es merkt. Ohne diesen
 * Gang bliebe ein Client, der im Hintergrund lag, fuer immer
 * zurueck: im Takt gerechnet holt er je Sekunde genau eine Sekunde
 * auf und nie mehr.
 */
const AUFHOL_SCHRITTE = 40;

/**
 * Ab hier lohnt das Aufholen nicht mehr - dann lieber springen.
 *
 * Fuenf Sekunden Rueckstand aufzuholen hiesse, fuenf Sekunden Spiel
 * im Zeitraffer zu zeigen. Ein Schnappschuss setzt stattdessen dort
 * auf, wo der Server steht. Das ist ein sichtbarer Sprung, aber ein
 * ehrlicher.
 */
const SPRUNG_AB = 100;

/** Ein abgeschickter, noch nicht bestaetigter eigener Zug. */
export interface OffenerZug {
  kartenId: string;
  x: number;
  y: number;
  tick: number;
}

export interface OnlineLauf extends Lauf {
  /** Nachricht vom Server einspeisen. */
  aufnehmen(n: VomServer): void;
  /** Eigene Zuege, die noch unterwegs sind - fuer die Vorschau. */
  offeneZuege(): readonly OffenerZug[];
  /** Wie weit der Server schon ist. Fuer die Diagnose. */
  readonly freigabe: number;
}

export interface OnlineLaufOptionen {
  aufbau: MatchAufbau;
  ich: Spieler;
  /** Zug an den Server schicken. */
  senden(zug: ZugAnmeldung): void;
  /** Schnappschuss anfordern, weil etwas auseinandergelaufen ist. */
  schnappschussBitten(): void;
  /** Halbe Laufzeit in ms - fuer die Schaetzung des Serverticks. */
  laufzeit(): number;
}

export function onlineLaufStarten(o: OnlineLaufOptionen): OnlineLauf {
  let state: MatchState = matchAnlegen(o.aufbau);
  let aufbau = o.aufbau;

  const vorher = new Float64Array(MAX_EINHEITEN * 2);
  let rest = 0;
  let alpha = 0;

  /** Bestaetigte Zuege je Tick. Wird nach dem Rechnen geleert. */
  const bestaetigt = new Map<number, Command[]>();
  /** Bis zu diesem Tick hat der Server gerechnet. */
  let freigabe = 0;
  /** Wann die letzte Freigabe ankam - fuer die Schaetzung dazwischen. */
  let freigabeAt = performance.now();

  let offen: OffenerZug[] = [];
  let gesammelt: Ereignis[] = [];
  let wartetAufSchnappschuss = false;

  const merken = (): void => {
    const liste = state.einheiten;
    for (let i = 0; i < liste.length; i++) {
      const e = liste[i]!;
      vorher[i * 2] = e.x;
      vorher[i * 2 + 1] = e.y;
    }
  };

  merken();

  /**
   * Wo der Server gerade ungefaehr steht.
   *
   * Die letzte Freigabe plus die Zeit, die seitdem vergangen ist, plus
   * die halbe Laufzeit - denn als die Freigabe abging, war der Server
   * schon dort, und unterwegs ist weitere Zeit vergangen.
   */
  function serverTickJetzt(): number {
    const seit = performance.now() - freigabeAt + o.laufzeit();
    return freigabe + Math.floor(seit / TICK_MS);
  }

  return {
    get state() { return state; },
    get alpha() { return alpha; },
    get freigabe() { return freigabe; },

    vorherX(index: number) { return vorher[index * 2] ?? 0; },
    vorherY(index: number) { return vorher[index * 2 + 1] ?? 0; },

    vorschieben(dtMs: number): void {
      if (dtMs <= 0) return;

      const rueckstand = freigabe - state.tick;

      /* Zu weit hinten, um es einzuholen: Schnappschuss holen und
         dort aufsetzen, wo der Server steht. */
      if (rueckstand > SPRUNG_AB && !wartetAufSchnappschuss) {
        wartetAufSchnappschuss = true;
        o.schnappschussBitten();
        return;
      }

      /* Nicht mehr ansammeln, als in einem Rutsch abgearbeitet werden
         kann. Sonst rechnet ein Geraet, das eine Minute im Hintergrund
         lag, die ganze Minute im Takt nach. */
      rest = Math.min(rest + dtMs, TICK_MS * MAX_NACHHOLEN);

      const aufholen = rueckstand > PUFFER_TICKS;
      const maxSchritte = aufholen ? AUFHOL_SCHRITTE : MAX_NACHHOLEN;

      let schritte = 0;
      while (schritte < maxSchritte) {
        if (state.tick >= freigabe) break; // Freigabe fehlt - warten.
        /* Im Aufholgang zaehlt nur der Rueckstand, nicht die Uhr:
           die Ticks sind vom Server laengst freigegeben, sie muessen
           nur noch gerechnet werden. Sobald der Puffer wieder steht,
           uebernimmt der normale Takt. */
        const eilig = freigabe - state.tick > PUFFER_TICKS;
        if (!eilig && rest < TICK_MS) break;

        merken();
        const liste = bestaetigt.get(state.tick) ?? [];
        bestaetigt.delete(state.tick);

        // Was jetzt ausgefuehrt wird, ist nicht mehr offen.
        if (liste.length && offen.length) {
          offen = offen.filter((z) => !liste.some(
            (c) => c.spieler === o.ich && c.kartenId === z.kartenId && c.tick === z.tick,
          ));
        }

        simTick(state, liste);
        for (const e of state.ereignisse) gesammelt.push(e);
        if (!eilig) rest -= TICK_MS;
        schritte++;
      }

      /* Wartend die aufgelaufene Zeit wegwerfen: sonst schiesst der
         Puffer nach der naechsten Freigabe ueber und das Spiel
         ruckelt vorwaerts. */
      if (state.tick >= freigabe) rest = Math.min(rest, TICK_MS);

      alpha = Math.max(0, Math.min(1, rest / TICK_MS));
    },

    zugEinreihen(spieler, kartenId, x, y): Ablehnung | null {
      if (spieler !== o.ich) return 'phase';

      /* Der Zieltick liegt vor dem Server, nicht vor dem eigenen
         Zustand: der laeuft dem Server um die Laufzeit hinterher, und
         ein Zug fuer einen Tick, den der Server schon gerechnet hat,
         waere zu spaet. */
      const zielTick = serverTickJetzt() + VERZUG_TICKS;

      const cmd: Command = {
        typ: 'playCard', spieler, kartenId, tick: zielTick,
        x: Math.trunc(x), y: Math.trunc(y),
      };

      /* Vorpruefung gegen den eigenen Zustand. Sie ist nicht
         massgeblich - das ist die des Servers - aber sie erspart dem
         Spieler den Weg zum Server fuer einen Zug, der ohnehin nichts
         wird. */
      const grund = pruefeZug(state, cmd);
      if (grund) return grund;

      offen.push({ kartenId, x: cmd.x, y: cmd.y, tick: zielTick });
      o.senden({ kartenId, x: cmd.x, y: cmd.y, tick: zielTick });
      return null;
    },

    zugMoeglich(spieler, kartenId, x, y): Ablehnung | null {
      if (spieler !== o.ich) return 'phase';
      return pruefeZug(state, {
        typ: 'playCard', spieler, kartenId, tick: state.tick, x, y,
      });
    },

    // Online gibt es keinen Bot. Die Methode bleibt, damit die
    // Schnittstelle dieselbe ist.
    botSetzen() { /* nichts */ },

    ereignisseAbholen() {
      if (!gesammelt.length) return LEER;
      const raus = gesammelt;
      gesammelt = [];
      return raus;
    },

    offeneZuege() { return offen; },

    aufnehmen(n) {
      switch (n.t) {
        case 'zuege': {
          freigabe = n.bisTick;
          freigabeAt = performance.now();
          for (const eintrag of n.liste) {
            const cmd: Command = {
              typ: 'playCard',
              spieler: eintrag.spieler,
              kartenId: eintrag.zug.kartenId,
              tick: eintrag.zug.tick,
              x: eintrag.zug.x,
              y: eintrag.zug.y,
            };
            const liste = bestaetigt.get(cmd.tick);
            if (liste) liste.push(cmd);
            else bestaetigt.set(cmd.tick, [cmd]);
          }
          return;
        }

        case 'pruef': {
          /* Nur pruefen, wenn der eigene Zustand genau auf diesem Tick
             steht. Frueher zu vergleichen hiesse, unterschiedliche
             Zeitpunkte zu vergleichen. */
          if (n.tick !== state.tick || wartetAufSchnappschuss) return;
          if (pruefsumme(state) === n.summe) return;
          console.warn(
            `[netz] Zustaende laufen auseinander bei Tick ${n.tick} - hole Schnappschuss`,
          );
          wartetAufSchnappschuss = true;
          o.schnappschussBitten();
          return;
        }

        case 'schnappschuss': {
          aufbau = n.aufbau;
          state = zustandEntpacken(aufbau, n.stand);
          merken();
          bestaetigt.clear();
          freigabe = state.tick;
          freigabeAt = performance.now();
          rest = 0;
          offen = [];
          wartetAufSchnappschuss = false;
          return;
        }

        case 'abgelehnt': {
          // Vorschau zuruecknehmen - der Zug findet nicht statt.
          offen = offen.filter(
            (z) => !(z.kartenId === n.kartenId && z.tick === n.tick),
          );
          return;
        }

        default:
          return;
      }
    },
  };
}
