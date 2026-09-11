/* ------------------------------------------------------------------
   Freundesduell ueber das Relais der Hideout-Seite.

   Bisher brauchte die Arena einen eigenen WebSocket-Server, und der
   Spieler musste dessen Adresse eintippen. Auf Netlify laeuft so ein
   Server nicht - dort gibt es nur statische Dateien und Funktionen,
   die ein paar Sekunden offen bleiben duerfen. Genau dafuer hat die
   Seite aber schon ein Relais unter /api/room, das die anderen Spiele
   benutzen: Raum aufmachen, per Code beitreten, eine Liste von Zuegen
   fuehren. Mehr braucht ein Lockstep-Spiel nicht.

   Dieses Modul sieht von aussen aus wie die WebSocket-Verbindung und
   verhaelt sich auch so. Darueber bleibt alles unveraendert: Sitzung,
   Lauf und Bildschirm merken nicht, dass kein Server mehr da ist.

   WAS DAS RELAIS NICHT TUT

   Es kennt keine Spielregeln. Der alte Server pruefte jeden Zug und
   verteilte Freigaben; beides muss jetzt hier passieren. Die Regeln
   prueft ohnehin jeder Client selbst nach - das war schon vorher so,
   sonst waere die Pruefsumme sinnlos.

   WIE DIE ZEIT SYNCHRON BLEIBT

   Das ist der schwierige Teil. Ueber HTTP dauert eine Runde je nach
   Netz vier- bis achthundert Millisekunden. Zuege einfach "sofort"
   auszufuehren waere damit nicht mehr deterministisch: derselbe Zug
   traefe auf beiden Seiten in unterschiedlichen Ticks ein, und die
   Simulationen liefen auseinander.

   Deshalb Stapel statt Einzelzuege. Die Zeit ist in Abschnitte von
   einer Sekunde geteilt. Jeder Client schickt am Ende eines
   Abschnitts, was er darin gespielt hat - auch wenn das nichts ist.
   Gerechnet werden darf erst, wenn von BEIDEN Seiten der Stapel
   vorliegt. Ein Zug aus Stapel b wirkt in Stapel b+2, ist also
   unterwegs, bevor er gebraucht wird.

   Das kostet etwa eine Sekunde Eingabeverzoegerung. Das ist der
   ehrliche Preis dafuer, ein Echtzeitspiel ueber eine Poll-Schnittstelle
   zu spielen, und es ist der einzige Weg, der ohne Rueckrechnen
   auskommt. Die Alternative waere, bei jedem verspaeteten Zug den
   Spielstand zurueckzudrehen - dafuer muesste die Simulation
   Zwischenstaende aufheben, und das waere ein Umbau an genau der
   Stelle, die nie falsch rechnen darf.
   ------------------------------------------------------------------ */

import { TICKS_PRO_SEKUNDE } from '@arena/sim';
import type { MatchAufbau } from '@arena/sim';
import type {
  VonClient, VomServer, Anmeldung, Sitzplatz, ZugAnmeldung,
} from '@arena/netz';
import type { Netzzustand, Verbindung, VerbindungOptionen } from './verbindung.js';

/** Endpunkt des Relais. Gleiche Herkunft wie die Seite. */
const RELAIS = '/api/room';
/** Kennung, damit fremde Raeume der Seite nicht als Arena gelten. */
const SPIEL = 'arena';

/** Ticks je Stapel. Eine Sekunde. */
const STAPEL_TICKS = TICKS_PRO_SEKUNDE;
/** Wie viele Stapel ein Zug Vorlauf bekommt. */
const VORLAUF = 2;
/** Abstand zwischen zwei Anfragen, wenn gerade nichts passiert. */
const RUHE_MS = 300;

interface Aktion {
  k: 'hallo' | 'bereit' | 'stapel' | 'auf';
  anmeldung?: Anmeldung;
  wert?: boolean;
  b?: number;
  zuege?: ZugAnmeldung[];
}

interface LogEintrag { seat: number; a: Aktion }

interface RaumStand {
  code: string;
  seed: number;
  version: number;
  started: boolean;
  meta: Record<string, unknown>;
  log: LogEintrag[];
  players: { id: string; name: string; seat: number; seen: number }[];
  closed?: boolean;
}

export function relaisVerbindungAnlegen(o: VerbindungOptionen): Verbindung {
  /* Sofort offen, und das ist keine Schoenfaerberei.

     Es gibt hier nichts zu verbinden: das Relais ist eine Adresse, zu
     der man einzelne Anfragen schickt, kein Draht, der erst stehen
     muss. Der Bildschirm legt die Sitzung an und will unmittelbar
     danach den Raum aufmachen - er fragt dafuer den Zustand ab. Stand
     hier 'verbindet', wartete er auf ein Ereignis, das nie kommt,
     waehrend die Verbindung auf den Raumwunsch wartete, den er nie
     schickt. Genau so hing der Warteraum bei "verbinde ...". */
  let zustand: Netzzustand = 'offen';
  let zu = false;

  /* Den Zustand trotzdem melden, sonst steht in der Anzeige weiter
     'verbindet' - sie kennt ihn nur aus dieser Meldung. Verzoegert,
     damit der Aufrufer das Ergebnis erst zu fassen bekommt. */
  setTimeout(() => { if (!zu) o.onZustand('offen'); }, 0);

  /* Platz im Raum. Ohne diese drei Werte ist man beim Relais niemand. */
  let code = '';
  let playerId = '';
  let token = '';
  let sitz: 0 | 1 = 0;

  let anmeldung: Anmeldung | null = null;
  let einheitlicheLevel = true;

  /** Wie weit das Log schon ausgewertet wurde. */
  let gelesen = 0;
  let version = 0;
  let gestartet = false;
  /* Getrennt von `gestartet`, und das ist wichtig: der Gastgeber muss
     sich gegen einen zweiten Anpfiff sperren, bevor er ihn abschickt -
     aber `gestartet` darf erst gelten, wenn die Startnachricht
     tatsaechlich draussen ist. Beides zusammenzulegen hiess: der
     Gastgeber sperrte sich selbst aus und bekam seinen eigenen
     Anpfiff nie zu sehen. */
  let pfeifeLaeuft = false;
  let aufbau: MatchAufbau | null = null;

  const plaetze: [Sitzplatz | null, Sitzplatz | null] = [null, null];
  /** Stapel je Sitz: Nummer -> Zuege. */
  const stapel: [Map<number, ZugAnmeldung[]>, Map<number, ZugAnmeldung[]>] = [new Map(), new Map()];
  /** Bis zu welchem Stapel beide Seiten geliefert haben. */
  let freigegeben = -1;
  /** Was seit dem letzten Absenden gespielt wurde. */
  let offeneZuege: ZugAnmeldung[] = [];
  let eigenerStapel = 0;
  let stapelTimer: ReturnType<typeof setInterval> | null = null;
  let startZeit = 0;

  const zustandSetzen = (z: Netzzustand): void => {
    if (zustand === z) return;
    zustand = z;
    o.onZustand(z);
  };

  /* ------------------------- Relais sprechen ----------------------- */

  async function ruf(op: string, felder: Record<string, unknown> = {}): Promise<Record<string, unknown> | null> {
    try {
      const antwort = await fetch(RELAIS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op, ...felder }),
      });
      const daten = await antwort.json() as Record<string, unknown>;
      if (!antwort.ok) {
        fehlerMelden(String(daten['error'] ?? 'kaputt'));
        return null;
      }
      return daten;
    } catch {
      zustandSetzen('getrennt');
      return null;
    }
  }

  function fehlerMelden(grund: string): void {
    const uebersetzt = grund === 'room_not_found' ? 'raumUnbekannt'
      : grund === 'room_full' ? 'raumVoll'
        : grund === 'game_mismatch' ? 'raumUnbekannt'
          : grund === 'bad_token' ? 'tokenUnbekannt'
            : 'kaputt';
    o.onNachricht({ t: 'fehler', grund: uebersetzt } as VomServer);
  }

  /** Eine Aktion ins Log legen. Das ist der einzige Weg, etwas zu sagen. */
  async function handeln(a: Aktion): Promise<void> {
    if (!code) return;
    await ruf('act', { code, playerId, token, action: a });
  }

  /* --------------------------- Beitreten --------------------------- */

  async function raumNeu(): Promise<void> {
    if (code) return;   // schon in einem Raum - kein zweiter
    /* ziffern: vierstelliger Zahlencode statt des sechsstelligen
       Buchstabencodes der anderen Spiele. Man ruft ihn quer ueber
       den Tisch zu, da zaehlt jede Stelle. */
    const d = await ruf('create', {
      game: SPIEL, seats: 2, ziffern: true, opts: { einheitlicheLevel },
    });
    if (!d) return;
    uebernehmen(d);
    if (anmeldung) await handeln({ k: 'hallo', anmeldung });
    schleifeStarten();
  }

  async function raumBei(gesucht: string): Promise<void> {
    if (code) return;
    const d = await ruf('join', { code: gesucht, game: SPIEL });
    if (!d) return;
    uebernehmen(d);
    if (anmeldung) await handeln({ k: 'hallo', anmeldung });
    schleifeStarten();
  }

  async function wiederAn(alterCode: string, altesToken: string): Promise<void> {
    /* Das Relais kennt kein "wer war ich" ohne playerId. Die steht im
       Merker mit im Token, getrennt durch einen Doppelpunkt. */
    const [id, tok] = altesToken.split(':');
    if (!id || !tok) { fehlerMelden('bad_token'); return; }
    const d = await ruf('resume', { code: alterCode, playerId: id, token: tok });
    if (!d) return;
    code = alterCode; playerId = id; token = tok;
    uebernehmen({ ...d, playerId: id, token: tok });
    schleifeStarten();
  }

  function uebernehmen(d: Record<string, unknown>): void {
    code = String(d['code'] ?? code);
    if (d['playerId']) playerId = String(d['playerId']);
    if (d['token']) token = String(d['token']);
    const s = Number(d['seat'] ?? 0);
    sitz = (s === 1 ? 1 : 0);
    const meta = (d['meta'] ?? {}) as Record<string, unknown>;
    if (typeof meta['einheitlicheLevel'] === 'boolean') {
      einheitlicheLevel = meta['einheitlicheLevel'];
    }
    zustandSetzen('offen');
    standVerarbeiten(d as unknown as RaumStand);
  }

  /* ------------------------- Warten und lesen ---------------------- */

  let schleifeLaeuft = false;

  function schleifeStarten(): void {
    if (schleifeLaeuft) return;
    schleifeLaeuft = true;
    void schleife();
  }

  async function schleife(): Promise<void> {
    while (!zu && code) {
      const d = await ruf('sync', { raum: { code, since: version } });
      if (zu) return;
      if (!d) { await schlaf(RUHE_MS * 3); continue; }
      const raum = d['raum'] as RaumStand | undefined;
      if (raum) {
        if (raum.closed) {
          o.onNachricht({ t: 'fehler', grund: 'raumUnbekannt' } as VomServer);
          return;
        }
        standVerarbeiten(raum);
      } else {
        await schlaf(RUHE_MS);
      }
    }
  }

  /* Die nackten Timerfunktionen, nicht die von `window`: dieses Modul
     soll sich auch ausserhalb eines Browserfensters anlegen lassen,
     sonst ist der Netcode nicht pruefbar. */
  const schlaf = (ms: number): Promise<void> => new Promise((f) => { setTimeout(f, ms); });

  /**
   * Einen Raumstand auswerten.
   *
   * Das Log wird nur vorwaerts gelesen: `gelesen` merkt sich, wie weit.
   * Das Relais schickt jedes Mal das ganze Log mit, und jeden Eintrag
   * zweimal auszuwerten hiesse, jeden Zug zweimal zu spielen.
   */
  function standVerarbeiten(raum: RaumStand): void {
    if (typeof raum.version === 'number') version = raum.version;
    if (Array.isArray(raum.players)) {
      for (let i = 0; i < 2; i++) {
        const p = raum.players.find((e) => e.seat === i);
        plaetze[i] = p
          ? { name: p.name, bereit: plaetze[i]?.bereit ?? false, da: true }
          : null;
      }
    }

    const log = Array.isArray(raum.log) ? raum.log : [];
    let neueLeute = false;
    for (let i = gelesen; i < log.length; i++) {
      const e = log[i];
      if (!e || !e.a) continue;
      const seat = e.seat === 1 ? 1 : 0;
      const a = e.a;

      if (a.k === 'hallo' && a.anmeldung) {
        const platz = plaetze[seat];
        if (platz) platz.name = a.anmeldung.name;
        merkeAnmeldung(seat, a.anmeldung);
        neueLeute = true;
      } else if (a.k === 'bereit') {
        const platz = plaetze[seat];
        if (platz) platz.bereit = a.wert === true;
        neueLeute = true;
      } else if (a.k === 'stapel' && typeof a.b === 'number') {
        stapel[seat].set(a.b, Array.isArray(a.zuege) ? a.zuege : []);
      } else if (a.k === 'auf') {
        o.onNachricht({
          t: 'ende',
          ausgang: seat === sitz ? (sitz === 0 ? 'sieg1' : 'sieg0') : (sitz === 0 ? 'sieg0' : 'sieg1'),
          tuerme: [0, 0],
          grund: 'aufgabe',
        } as VomServer);
      }
    }
    gelesen = log.length;

    if (neueLeute || !gestartet) raumMelden();

    if (!gestartet && raum.started) {
      const roh = (raum.meta ?? {})['aufbau'];
      if (roh) {
        gestartet = true;
        aufbau = roh as MatchAufbau;
        startZeit = Number((raum.meta ?? {})['startZeit']) || Date.now();
        o.onNachricht({ t: 'start', aufbau, du: sitz } as VomServer);
        stapelLaufLassen();
      }
    }

    /* Gastgeber pfeift an, sobald beide da und bereit sind. Nur er -
       zwei Anpfiffe waeren zwei verschiedene Aufbauten. */
    if (!gestartet && !pfeifeLaeuft && sitz === 0
      && plaetze[0]?.bereit && plaetze[1]?.bereit) {
      void anpfeifen(raum.seed);
    }

    freigabenPruefen();
  }

  const anmeldungen: [Anmeldung | null, Anmeldung | null] = [null, null];
  function merkeAnmeldung(seat: 0 | 1, a: Anmeldung): void { anmeldungen[seat] = a; }

  async function anpfeifen(seed: number): Promise<void> {
    if (gestartet || pfeifeLaeuft) return;
    const a = anmeldungen[0];
    const b = anmeldungen[1];
    if (!a || !b) return;
    pfeifeLaeuft = true;   // sperren, sonst pfeift der naechste Sync erneut an
    const neu: MatchAufbau = {
      seed: seed | 0,
      decks: [a.deck.slice(), b.deck.slice()],
      level: [a.level, b.level],
      einheitlicheLevel,
    };
    const d = await ruf('start', {
      code, playerId, token,
      meta: { aufbau: neu, startZeit: Date.now(), einheitlicheLevel },
    });
    if (!d) { pfeifeLaeuft = false; return; }
    standVerarbeiten(d as unknown as RaumStand);
  }

  function raumMelden(): void {
    o.onNachricht({
      t: 'raum',
      code,
      du: sitz,
      token: playerId && token ? playerId + ':' + token : '',
      plaetze: [plaetze[0], plaetze[1]],
      einheitlicheLevel,
    } as VomServer);
  }

  /* --------------------------- Die Stapel -------------------------- */

  function stapelLaufLassen(): void {
    if (stapelTimer) return;
    stapelAbschicken();
    stapelTimer = setInterval(stapelAbschicken, (STAPEL_TICKS / TICKS_PRO_SEKUNDE) * 1000);
  }

  function stapelAbschicken(): void {
    const b = eigenerStapel++;
    const zuege = offeneZuege;
    offeneZuege = [];
    void handeln({ k: 'stapel', b, zuege });
  }

  /**
   * Freigeben, was beide Seiten bestaetigt haben.
   *
   * Ein Zug aus Stapel b wirkt in Stapel b + VORLAUF. Liegt Stapel b
   * von beiden vor, sind damit alle Zuege bis zum Beginn von b+VORLAUF
   * bekannt - genau bis dorthin darf gerechnet werden.
   */
  function freigabenPruefen(): void {
    if (!gestartet) return;
    while (stapel[0].has(freigegeben + 1) && stapel[1].has(freigegeben + 1)) {
      freigegeben++;
      const liste: { spieler: 0 | 1; zug: ZugAnmeldung }[] = [];
      for (const seat of [0, 1] as const) {
        for (const zug of stapel[seat].get(freigegeben) ?? []) liste.push({ spieler: seat, zug });
      }
      o.onNachricht({
        t: 'zuege',
        bisTick: (freigegeben + VORLAUF) * STAPEL_TICKS - 1,
        liste,
      } as VomServer);
    }
  }

  /** In welchem Tick ein jetzt gespielter Zug wirken soll. */
  function zielTick(): number {
    return (eigenerStapel + VORLAUF) * STAPEL_TICKS;
  }

  /* ---------------------- Nach aussen: Verbindung ------------------- */

  return {
    get zustand() { return zustand; },
    /* Ohne Server gibt es keine Rundreise zu messen. Der Wert geht in
       die Vorschau der eigenen Zuege; ein halber Stapel ist die
       ehrliche Schaetzung. */
    get halbeLaufzeit() { return (STAPEL_TICKS / TICKS_PRO_SEKUNDE) * 500; },

    senden(n: VonClient) {
      switch (n.t) {
        case 'raumNeu':
          anmeldung = n.anmeldung;
          einheitlicheLevel = n.einheitlicheLevel;
          void raumNeu();
          return;
        case 'raumBei':
          anmeldung = n.anmeldung;
          void raumBei(n.code);
          return;
        case 'wiederAn':
          void wiederAn(n.code, n.token);
          return;
        case 'bereit':
          void handeln({ k: 'bereit', wert: n.wert });
          return;
        case 'zug':
          /* Der Zeitpunkt wird hier gesetzt, nicht vom Aufrufer: nur
             hier ist bekannt, in welchem Stapel man gerade steckt. */
          offeneZuege.push({ ...n.zug, tick: zielTick() });
          return;
        case 'verlassen':
          void handeln({ k: 'auf' }).then(() => ruf('leave', { code, playerId, token }));
          return;
        default:
          /* schnappschussBitte und ping laufen ins Leere: es gibt
             keinen Server, der einen Stand haette oder antworten
             koennte. Die Pruefsumme meldet Abweichungen weiterhin in
             der Konsole. */
          return;
      }
    },

    schliessen() {
      zu = true;
      if (stapelTimer) clearInterval(stapelTimer);
      stapelTimer = null;
      if (code) void ruf('leave', { code, playerId, token });
      zustandSetzen('aufgegeben');
    },
  };
}
