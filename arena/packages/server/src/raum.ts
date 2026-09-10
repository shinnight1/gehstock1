/* ------------------------------------------------------------------
   Ein Raum: zwei Plaetze, eine autoritative Partie.

   Der Raum kennt keine Sockets. Er bekommt Ereignisse hineingereicht
   und gibt Nachrichten heraus - wer die verschickt, ist seine Sache
   nicht. Damit laesst er sich ohne Netz testen, und der Netzcode in
   index.ts bleibt duenn genug, um ihn beim Lesen zu ueberblicken.

   Der Raum ist die einzige Stelle, die Ticks zaehlt. Er rechnet
   dieselbe Partie wie beide Clients, nimmt Zuege nur an, wenn sie
   `pruefeZug` bestehen, und legt fest, in welchem Tick sie wirken.
   Ein Client, der sich Elixir erfindet, sieht seine Einheit nirgends
   erscheinen - auch bei sich nicht, denn er rechnet ja mit.

   Freigabe statt Zustand: nach jedem Tick geht eine 'zuege'-Nachricht
   heraus, auch wenn niemand etwas gespielt hat. Sie sagt den Clients,
   bis wohin sie rechnen duerfen. Ohne diese Bremse liefe ein schnelles
   Geraet dem Server davon und muesste staendig zurueckgeholt werden.
   ------------------------------------------------------------------ */

import {
  matchAnlegen, tick as simTick, pruefeZug, pruefsumme, zustandPacken,
  handPlatz, karteZyklieren, elixirAbziehen, karteVon,
  TICKS_PRO_SEKUNDE, MATCH,
} from '@arena/sim';
import type {
  MatchState, MatchAufbau, Command, Spieler, SpielerState,
} from '@arena/sim';
import {
  VERZUG_TICKS, PRUEF_TAKT, WIEDER_FENSTER_S,
} from '@arena/netz';
import type { VomServer, Anmeldung, ZugAnmeldung, Sitzplatz } from '@arena/netz';

const TICK_MS = 1000 / TICKS_PRO_SEKUNDE;

export type RaumPhase = 'wartet' | 'laeuft' | 'vorbei';

export interface Platz {
  anmeldung: Anmeldung;
  token: string;
  bereit: boolean;
  /** Verbunden? Bei false laeuft das Rueckkehrfenster. */
  da: boolean;
  /** Zeitpunkt der Trennung, sonst 0. */
  wegSeit: number;
}

/** Wohin eine Nachricht geht: an einen Platz oder an beide. */
export type Sender = (an: Spieler | 'beide', nachricht: VomServer) => void;

export interface Raum {
  readonly code: string;
  readonly phase: RaumPhase;
  readonly einheitlicheLevel: boolean;
  readonly plaetze: [Platz | null, Platz | null];
  /** Wann zuletzt etwas passiert ist - fuer den Verfall. */
  readonly letzteRegung: number;

  /** Platz belegen. Gibt die Nummer oder null, wenn kein Platz frei ist. */
  setzen(anmeldung: Anmeldung, token: string): Spieler | null;
  /** Platz per Token zurueckerobern. */
  wiederkehr(token: string): Spieler | null;
  bereitSetzen(spieler: Spieler, wert: boolean): void;
  /** Zug annehmen oder ablehnen. Antwort geht ueber den Sender heraus. */
  zugAnnehmen(spieler: Spieler, zug: ZugAnmeldung): void;
  trennen(spieler: Spieler): void;
  /** Endgueltig aufgeben - kein Rueckkehrfenster. */
  aufgeben(spieler: Spieler): void;
  schnappschussSenden(spieler: Spieler): void;
  sitzplaetze(): [Sitzplatz | null, Sitzplatz | null];
  /** Vom Server im Takt gerufen. `jetzt` ist die Uhrzeit in ms. */
  takt(jetzt: number): void;
  readonly serverTick: number;
  /**
   * Der laufende Zustand - nur zum Lesen.
   *
   * Der Server braucht ihn fuer Diagnose und Tests. Wer hier hinein
   * schreibt, bricht den Gleichlauf mit beiden Clients: die kennen
   * nur die Befehle, nicht die Aenderung.
   */
  readonly stand: MatchState | null;
}

export function raumAnlegen(
  code: string, einheitlicheLevel: boolean, senden: Sender, jetzt: number,
): Raum {
  const plaetze: [Platz | null, Platz | null] = [null, null];
  let phase: RaumPhase = 'wartet';
  let letzteRegung = jetzt;

  let state: MatchState | null = null;
  let aufbau: MatchAufbau | null = null;
  /* Zuege, nach Zieltick sortiert. Ein Tick wird gerechnet, wenn seine
     Zeit gekommen ist - die Liste dazu wird vorher geleert. */
  const geplant = new Map<number, Command[]>();
  let naechsterTickAt = 0;

  const regung = (): void => { letzteRegung = Date.now(); };

  function sitzplaetze(): [Sitzplatz | null, Sitzplatz | null] {
    return [platzInfo(plaetze[0]), platzInfo(plaetze[1])];
  }

  function starten(): void {
    const a = plaetze[0];
    const b = plaetze[1];
    if (!a || !b) return;

    /* Der Seed entsteht hier und nur hier. Wuerde ihn ein Client
       vorschlagen, koennte er Partien so lange neu wuerfeln, bis ihm
       die Reihenfolge seiner Handkarten gefaellt. */
    const seed = (Math.floor(Math.random() * 0x7fffffff) | 0) & 0x7fffffff;
    aufbau = {
      seed,
      decks: [a.anmeldung.deck.slice(), b.anmeldung.deck.slice()],
      level: [{ ...a.anmeldung.level }, { ...b.anmeldung.level }],
      einheitlicheLevel,
    };
    state = matchAnlegen(aufbau);
    phase = 'laeuft';
    naechsterTickAt = Date.now();
    geplant.clear();

    senden(0, { t: 'start', aufbau, du: 0 });
    senden(1, { t: 'start', aufbau, du: 1 });
  }

  /** Siehe die Erlaeuterung unter platzInfo. */
  function vorschau(spieler: Spieler, bisTick: number): MatchState {
    const echt = state!;
    const kopie: SpielerState = {
      ...echt.spieler[spieler],
      hand: echt.spieler[spieler].hand.slice(),
      queue: echt.spieler[spieler].queue.slice(),
    };

    const offen: Command[] = [];
    for (const [tick, liste] of geplant) {
      if (tick > bisTick) continue;
      for (const c of liste) if (c.spieler === spieler) offen.push(c);
    }
    offen.sort((a, b) => a.tick - b.tick);

    for (const c of offen) {
      const karte = karteVon(c.kartenId);
      const platz = handPlatz(kopie, c.kartenId);
      if (!karte || platz < 0) continue;
      elixirAbziehen(kopie, karte.elixir);
      karteZyklieren(kopie, platz);
    }

    const spielerPaar: [SpielerState, SpielerState] = spieler === 0
      ? [kopie, echt.spieler[1]]
      : [echt.spieler[0], kopie];
    return { ...echt, spieler: spielerPaar };
  }

  function beenden(grund: 'regulaer' | 'aufgabe', erzwungen?: 'sieg0' | 'sieg1'): void {
    if (phase === 'vorbei') return;
    phase = 'vorbei';
    const ausgang = erzwungen ?? state?.ausgang ?? 'unentschieden';
    const tuerme: [number, number] = state
      ? [state.spieler[0].tuermeZerstoert, state.spieler[1].tuermeZerstoert]
      : [0, 0];
    senden('beide', { t: 'ende', ausgang, tuerme, grund });
  }

  return {
    get code() { return code; },
    get phase() { return phase; },
    get einheitlicheLevel() { return einheitlicheLevel; },
    get plaetze() { return plaetze; },
    get letzteRegung() { return letzteRegung; },
    get serverTick() { return state?.tick ?? 0; },
    get stand() { return state; },

    setzen(anmeldung, token) {
      if (phase !== 'wartet') return null;
      const nummer: Spieler | null = !plaetze[0] ? 0 : !plaetze[1] ? 1 : null;
      if (nummer === null) return null;
      plaetze[nummer] = { anmeldung, token, bereit: false, da: true, wegSeit: 0 };
      regung();
      return nummer;
    },

    wiederkehr(token) {
      for (let i = 0; i < 2; i++) {
        const p = plaetze[i];
        if (!p || p.token !== token) continue;
        p.da = true;
        p.wegSeit = 0;
        regung();
        senden('beide', { t: 'zurueck', spieler: i as 0 | 1 });
        return i as Spieler;
      }
      return null;
    },

    bereitSetzen(spieler, wert) {
      const p = plaetze[spieler];
      if (!p || phase !== 'wartet') return;
      p.bereit = wert;
      regung();
      senden('beide', {
        t: 'raum', code, du: spieler, token: '',
        plaetze: sitzplaetze(), einheitlicheLevel,
      });
      if (plaetze[0]?.bereit && plaetze[1]?.bereit) starten();
    },

    zugAnnehmen(spieler, zug) {
      if (!state || phase !== 'laeuft') return;
      regung();

      /* Zu spaet ist kein Betrug, sondern eine lange Leitung. Der
         Client bekommt eine Absage und nimmt seine Vorschau zurueck -
         die Alternative waere, den Zug still in einen spaeteren Tick
         zu schieben, und dann setzt die Karte irgendwo anders ab, als
         der Spieler getippt hat. */
      if (zug.tick <= state.tick) {
        senden(spieler, {
          t: 'abgelehnt', grund: 'zuSpaet', kartenId: zug.kartenId, tick: zug.tick,
        });
        return;
      }
      // Ebenso wenig darf ein Client weit in die Zukunft buchen.
      if (zug.tick > state.tick + VERZUG_TICKS * 4) {
        senden(spieler, {
          t: 'abgelehnt', grund: 'zuSpaet', kartenId: zug.kartenId, tick: zug.tick,
        });
        return;
      }

      const cmd: Command = {
        typ: 'playCard', spieler, kartenId: zug.kartenId,
        tick: zug.tick, x: Math.trunc(zug.x), y: Math.trunc(zug.y),
      };

      /* Geprueft wird gegen eine Vorschau, nicht gegen den Zustand von
         jetzt. Sonst kaeme ein Client mit acht Zuegen fuer denselben
         Tick durch: gegen den aktuellen Stand ist jeder einzelne
         bezahlbar, zusammen keiner. Ausgefuehrt wuerden sie ohnehin
         nicht - fuehreZugAus prueft noch einmal - aber der Server
         haette sie an beide Seiten verteilt, und der Spieler saehe
         acht Ringe, aus denen nichts wird. */
      const grund = pruefeZug(vorschau(spieler, zug.tick), cmd);
      if (grund) {
        console.warn(
          `[raum ${code}] Zug verworfen: Spieler ${spieler}, `
          + `${zug.kartenId}, Grund ${grund}`,
        );
        senden(spieler, { t: 'abgelehnt', grund, kartenId: zug.kartenId, tick: zug.tick });
        return;
      }

      const liste = geplant.get(zug.tick);
      if (liste) liste.push(cmd);
      else geplant.set(zug.tick, [cmd]);
    },

    trennen(spieler) {
      const p = plaetze[spieler];
      if (!p) return;
      p.da = false;
      p.wegSeit = Date.now();
      regung();
      if (phase === 'laeuft') {
        senden('beide', {
          t: 'weg', spieler: spieler as 0 | 1, sekunden: WIEDER_FENSTER_S,
        });
      } else {
        // Vor dem Anpfiff gibt es nichts zu retten - Platz wird frei.
        plaetze[spieler] = null;
        senden('beide', {
          t: 'raum', code, du: 0, token: '',
          plaetze: sitzplaetze(), einheitlicheLevel,
        });
      }
    },

    aufgeben(spieler) {
      regung();
      if (phase === 'laeuft') {
        beenden('aufgabe', spieler === 0 ? 'sieg1' : 'sieg0');
      } else {
        plaetze[spieler] = null;
        phase = 'vorbei';
      }
    },

    schnappschussSenden(spieler) {
      if (!state || !aufbau) return;
      senden(spieler, { t: 'schnappschuss', aufbau, stand: zustandPacken(state) });
    },

    sitzplaetze,

    takt(jetzt) {
      if (phase !== 'laeuft' || !state) return;

      /* Rueckkehrfenster: wer laenger weg ist, hat verloren. Gezaehlt
         wird in Echtzeit und nicht in Ticks - die Partie laeuft ja
         weiter, und dreissig Sekunden sollen dreissig Sekunden sein. */
      for (let i = 0; i < 2; i++) {
        const p = plaetze[i];
        if (!p || p.da || !p.wegSeit) continue;
        if (jetzt - p.wegSeit >= WIEDER_FENSTER_S * 1000) {
          beenden('aufgabe', i === 0 ? 'sieg1' : 'sieg0');
          return;
        }
      }

      /* Aufholen, aber nicht endlos: wenn der Prozess kurz haengt,
         soll er nicht hundert Ticks am Stueck rechnen und dabei alle
         weiteren Raeume blockieren. */
      let schritte = 0;
      while (jetzt >= naechsterTickAt && schritte < 5) {
        const zielTick = state.tick;
        const liste = geplant.get(zielTick) ?? [];
        geplant.delete(zielTick);

        simTick(state, liste);

        senden('beide', {
          t: 'zuege',
          bisTick: state.tick,
          liste: liste.map((c) => ({
            spieler: c.spieler as 0 | 1,
            zug: { kartenId: c.kartenId, x: c.x, y: c.y, tick: c.tick },
          })),
        });

        if (state.tick % PRUEF_TAKT === 0) {
          senden('beide', { t: 'pruef', tick: state.tick, summe: pruefsumme(state) });
        }

        naechsterTickAt += TICK_MS;
        schritte++;

        if (state.ausgang) { beenden('regulaer'); return; }
      }

      // Weit hinterher: lieber springen als ewig nachrechnen.
      if (jetzt - naechsterTickAt > TICK_MS * 20) naechsterTickAt = jetzt;

      // Sicherheitsnetz, falls die Sim den Ausgang nie setzt.
      if (state.tick > MATCH.countdown + MATCH.dauer + MATCH.overtime + TICKS_PRO_SEKUNDE) {
        beenden('regulaer');
      }
    },
  };
}

/**
 * Der Zustand, wie er im Zieltick aussehen wird - so gut es geht.
 *
 * Beruecksichtigt wird, was fuer diesen Spieler schon eingeplant ist:
 * Elixir ist dann weg, die Karte durch den Zyklus gewandert.
 * Angewendet wird dafuer dieselbe Logik wie in der Simulation, nicht
 * eine nachgebaute - eine zweite Fassung waere eine zweite Gelegenheit,
 * anders zu urteilen.
 *
 * Was nicht beruecksichtigt wird, ist der Nachschub in den wenigen
 * Ticks bis dahin. Bei einem Punkt alle 2,8 Sekunden und einem Verzug
 * von 200 ms ist das fast immer null, und im Zweifel urteilt der
 * Server damit etwas zu streng statt zu grosszuegig.
 *
 * Der Zustand selbst wird nicht angefasst: nur der Spieler wird
 * kopiert, alles andere bleibt geliehen.
 */
function platzInfo(p: Platz | null): Sitzplatz | null {
  if (!p) return null;
  return { name: p.anmeldung.name, bereit: p.bereit, da: p.da };
}
