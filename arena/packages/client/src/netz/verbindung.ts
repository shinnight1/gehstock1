/* ------------------------------------------------------------------
   Die Leitung zum Server.

   Ein duenner Mantel um den WebSocket: verbinden, wiederverbinden,
   Nachrichten als getippte Objekte hinein und heraus. Was die
   Nachrichten bedeuten, weiss diese Datei nicht - sie reicht sie
   weiter.

   Wiederverbinden mit wachsendem Abstand, aber nach oben gedeckelt.
   Ein iPad, das aus dem Standby kommt, hat oft eine tote Leitung, ohne
   dass ein Fehler ankommt; deshalb wird auch auf `visibilitychange`
   und `online` hin geprueft, statt nur auf den Socket zu warten.

   Die Adresse kommt von aussen und wird nie geraten. Wenn der Client
   in einem iframe auf einer fremden Domain liegt, waere jede
   Herleitung aus `location` falsch - der Auftrag verlangt
   ausdruecklich, dass der Build nichts ueber die Hub-Domain annimmt.
   ------------------------------------------------------------------ */

import { nachrichtLesen, PROTOKOLL_VERSION } from '@arena/netz';
import type { VonClient, VomServer } from '@arena/netz';

export type Netzzustand = 'verbindet' | 'offen' | 'getrennt' | 'aufgegeben';

export interface Verbindung {
  readonly zustand: Netzzustand;
  senden(nachricht: VonClient): void;
  /** Halbe Rundreise in ms, aus dem letzten Ping geschaetzt. */
  readonly halbeLaufzeit: number;
  schliessen(): void;
}

export interface VerbindungOptionen {
  url: string;
  onNachricht(n: VomServer): void;
  onZustand(z: Netzzustand): void;
  /** Wird nach jedem erfolgreichen Verbinden gerufen - fuer die Rueckkehr. */
  onOffen(): void;
}

const PING_MS = 2000;
const MAX_VERSUCHE = 8;

export function verbindungAnlegen(o: VerbindungOptionen): Verbindung {
  let sock: WebSocket | null = null;
  let zustand: Netzzustand = 'verbindet';
  let versuche = 0;
  let zu = false;
  let pingTimer = 0;
  let neuTimer = 0;
  let halbeLaufzeit = 40;

  /* Nachrichten, die vor dem Verbinden abgeschickt wurden, warten
     hier. Ohne diesen Puffer verlieren die ersten Klicks nach einem
     Abriss ihre Wirkung, und der Spieler tippt ins Leere. */
  const warteschlange: VonClient[] = [];

  const zustandSetzen = (z: Netzzustand): void => {
    if (zustand === z) return;
    zustand = z;
    o.onZustand(z);
  };

  function verbinden(): void {
    if (zu) return;
    zustandSetzen('verbindet');
    try {
      sock = new WebSocket(o.url);
    } catch {
      planen();
      return;
    }

    sock.onopen = () => {
      versuche = 0;
      zustandSetzen('offen');
      o.onOffen();
      while (warteschlange.length) {
        const n = warteschlange.shift()!;
        rausschicken(n);
      }
      pingen();
    };

    sock.onmessage = (ev) => {
      const n = nachrichtLesen<VomServer>(String(ev.data));
      if (!n) return;
      if (n.t === 'pong') {
        // Halbe Rundreise: so weit liegt der Client hinter dem Server.
        halbeLaufzeit = Math.max(5, (Date.now() - n.zeit) / 2);
        return;
      }
      o.onNachricht(n);
    };

    sock.onclose = () => {
      sock = null;
      window.clearTimeout(pingTimer);
      if (zu) return;
      zustandSetzen('getrennt');
      planen();
    };

    sock.onerror = () => { /* close folgt */ };
  }

  function planen(): void {
    if (zu) return;
    versuche++;
    if (versuche > MAX_VERSUCHE) { zustandSetzen('aufgegeben'); return; }
    /* Erst schnell, dann langsamer: die meisten Abrisse sind nach
       einer halben Sekunde vorbei, und wer nach acht Versuchen noch
       nicht durchkommt, hat ein anderes Problem als Timing. */
    const abstand = Math.min(300 * 2 ** (versuche - 1), 5000);
    window.clearTimeout(neuTimer);
    neuTimer = window.setTimeout(verbinden, abstand);
  }

  function rausschicken(n: VonClient): void {
    if (!sock || sock.readyState !== WebSocket.OPEN) {
      warteschlange.push(n);
      return;
    }
    try {
      sock.send(JSON.stringify(n));
    } catch {
      warteschlange.push(n);
    }
  }

  function pingen(): void {
    window.clearTimeout(pingTimer);
    if (zu) return;
    rausschicken({ t: 'ping', zeit: Date.now() });
    pingTimer = window.setTimeout(pingen, PING_MS);
  }

  /* Aus dem Standby zurueck: Safari meldet den toten Socket oft erst,
     wenn man ihn benutzt. Ein Blick auf den Zustand beim Aufwachen
     spart dem Spieler das Warten. */
  const aufwachen = (): void => {
    if (zu || document.hidden) return;
    if (!sock || sock.readyState > WebSocket.OPEN) {
      versuche = 0;
      verbinden();
    }
  };
  document.addEventListener('visibilitychange', aufwachen);
  window.addEventListener('online', aufwachen);

  verbinden();

  return {
    get zustand() { return zustand; },
    get halbeLaufzeit() { return halbeLaufzeit; },
    senden: rausschicken,
    schliessen() {
      zu = true;
      window.clearTimeout(pingTimer);
      window.clearTimeout(neuTimer);
      document.removeEventListener('visibilitychange', aufwachen);
      window.removeEventListener('online', aufwachen);
      try { sock?.close(); } catch { /* schon zu */ }
      sock = null;
    },
  };
}

/** Version fuer jede Anmeldung - steht hier, damit sie nur einmal steht. */
export const VERSION = PROTOKOLL_VERSION;
