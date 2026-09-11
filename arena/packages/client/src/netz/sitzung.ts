/* ------------------------------------------------------------------
   Eine Online-Sitzung: Raum, Partie, Rueckkehr.

   Zwischen der Leitung (verbindung.ts) und dem Bildschirm
   (screens/online.ts). Die Leitung weiss nichts vom Spiel, der
   Bildschirm nichts vom Protokoll - hier laufen beide zusammen.

   Die Sitzung ueberlebt einen Verbindungsabriss. Code und Token
   liegen zusaetzlich im localStorage: wer auf dem iPad kurz die App
   wechselt und zurueckkommt, landet wieder in seiner Partie, statt in
   einem leeren Menue. Der Server haelt den Platz dreissig Sekunden.
   ------------------------------------------------------------------ */

import type { MatchAufbau, Ausgang, Spieler } from '@arena/sim';
import type { VomServer, Sitzplatz, Fehlergrund, Anmeldung } from '@arena/netz';
import { verbindungAnlegen, VERSION } from './verbindung.js';
import { relaisVerbindungAnlegen } from './relais.js';
import type { Verbindung, Netzzustand } from './verbindung.js';
import { onlineLaufStarten } from '../sim/onlineLauf.js';
import type { OnlineLauf } from '../sim/onlineLauf.js';

const RUECKKEHR_SCHLUESSEL = 'arena.online.rueckkehr.v1';

/** Aelter als das ist mit Sicherheit tot - der Server laesst Raeume
    nach einer Viertelstunde verfallen. */
const RUECKKEHR_HALTBAR_MS = 30 * 60_000;

interface Rueckkehr {
  code: string;
  token: string;
}

/**
 * Liegt ein Platz aus einer angefangenen Partie vor?
 *
 * Der Bildschirm fragt das beim Betreten. Auf dem iPad ist das kein
 * Randfall: Safari raeumt eine Seite im Hintergrund gern weg, und ohne
 * diesen Merker waere die Partie danach verloren - obwohl der Server
 * den Platz noch dreissig Sekunden haelt.
 */
export function rueckkehrVorhanden(): Rueckkehr | null {
  try {
    const roh = globalThis.localStorage?.getItem(RUECKKEHR_SCHLUESSEL);
    if (!roh) return null;
    const wert = JSON.parse(roh) as Partial<Rueckkehr> & { zeit?: number };
    if (!wert.code || !wert.token) return null;
    if (!wert.zeit || Date.now() - wert.zeit > RUECKKEHR_HALTBAR_MS) {
      rueckkehrVergessen();
      return null;
    }
    return { code: wert.code, token: wert.token };
  } catch {
    return null;
  }
}

export function rueckkehrVergessen(): void {
  try { globalThis.localStorage?.removeItem(RUECKKEHR_SCHLUESSEL); } catch { /* egal */ }
}

export interface SitzungBericht {
  netz: Netzzustand;
  code: string;
  du: Spieler | null;
  plaetze: [Sitzplatz | null, Sitzplatz | null];
  einheitlicheLevel: boolean;
  fehler: Fehlergrund | null;
  /** Gegenseite getrennt: verbleibende Sekunden, sonst 0. */
  gegnerWegBis: number;
}

export interface SitzungOptionen {
  url: string;
  anmeldung: Anmeldung;
  onBericht(b: SitzungBericht): void;
  /** Anpfiff - der Bildschirm baut jetzt das Spielfeld. */
  onStart(lauf: OnlineLauf, ich: Spieler, aufbau: MatchAufbau): void;
  onEnde(ausgang: Ausgang, tuerme: [number, number], grund: 'regulaer' | 'aufgabe'): void;
}

export interface Sitzung {
  raumOeffnen(einheitlicheLevel: boolean): void;
  raumBetreten(code: string): void;
  /** In eine angefangene Partie zurueck, mit dem gemerkten Token. */
  zurueckKehren(): void;
  bereit(wert: boolean): void;
  aufgeben(): void;
  schliessen(): void;
  readonly bericht: SitzungBericht;
}

export function sitzungAnlegen(o: SitzungOptionen): Sitzung {
  let lauf: OnlineLauf | null = null;
  let wunsch: { art: 'neu'; einheitlich: boolean } | { art: 'bei'; code: string } | null = null;

  const bericht: SitzungBericht = {
    netz: 'verbindet',
    code: '',
    du: null,
    plaetze: [null, null],
    einheitlicheLevel: true,
    fehler: null,
    gegnerWegBis: 0,
  };

  const melden = (): void => { o.onBericht({ ...bericht }); };

  /* Ohne Adresse laeuft das Duell ueber das Relais der Seite - das
     ist der Normalfall, seit niemand mehr einen Server starten muss.
     Eine Adresse ist die Ausnahme fuer die Entwicklung: wer den
     echten WebSocket-Server laufen hat, bekommt ihn mit ?server=. */
  const bauen = o.url ? verbindungAnlegen : relaisVerbindungAnlegen;
  const verbindung: Verbindung = bauen({
    url: o.url,
    onZustand: (z) => { bericht.netz = z; melden(); },
    onOffen: () => {
      /* Nach jedem Verbinden zuerst versuchen, den alten Platz
         zurueckzubekommen. Erst wenn das nichts wird, gilt der
         urspruengliche Wunsch. */
      const alt = rueckkehrVorhanden();
      if (alt) {
        verbindung.senden({
          t: 'wiederAn', version: VERSION, code: alt.code, token: alt.token,
        });
        return;
      }
      wunschSenden();
    },
    onNachricht: (n) => behandeln(n),
  });

  function wunschSenden(): void {
    if (!wunsch) return;
    if (wunsch.art === 'neu') {
      verbindung.senden({
        t: 'raumNeu', version: VERSION,
        anmeldung: o.anmeldung, einheitlicheLevel: wunsch.einheitlich,
      });
    } else {
      verbindung.senden({
        t: 'raumBei', version: VERSION, code: wunsch.code, anmeldung: o.anmeldung,
      });
    }
  }

  function behandeln(n: VomServer): void {
    // Waehrend einer Partie geht alles Weitere an den Lauf.
    if (lauf) lauf.aufnehmen(n);

    switch (n.t) {
      case 'raum':
        bericht.code = n.code;
        // Das leere Token in der Rundmeldung darf das eigene nicht loeschen.
        if (n.token) {
          bericht.du = n.du;
          rueckkehrSchreiben(n.code, n.token);
        }
        bericht.plaetze = n.plaetze;
        bericht.einheitlicheLevel = n.einheitlicheLevel;
        bericht.fehler = null;
        melden();
        return;

      case 'fehler':
        bericht.fehler = n.grund;
        /* Ein unbekanntes Token heisst: der Platz ist weg. Dann den
           urspruenglichen Wunsch nachholen, statt haengen zu bleiben. */
        if (n.grund === 'tokenUnbekannt' || n.grund === 'raumUnbekannt') {
          rueckkehrVergessen();
          if (wunsch) { bericht.fehler = null; wunschSenden(); }
        }
        melden();
        return;

      case 'start': {
        bericht.du = n.du;
        bericht.fehler = null;
        lauf = laufAnlegen(n.aufbau, n.du);
        melden();
        o.onStart(lauf, n.du, n.aufbau);
        return;
      }

      case 'schnappschuss': {
        /* Kommt auch beim Wiedereinstieg in eine laufende Partie -
           dann gab es hier noch keinen Lauf. Der Aufbau steckt im
           Schnappschuss, also laesst er sich daraus anlegen und
           anschliessend auf den mitgeschickten Stand setzen. */
        if (lauf || bericht.du === null) return;
        lauf = laufAnlegen(n.aufbau, bericht.du);
        lauf.aufnehmen(n);
        melden();
        o.onStart(lauf, bericht.du, n.aufbau);
        return;
      }

      case 'weg':
        if (n.spieler !== bericht.du) bericht.gegnerWegBis = n.sekunden;
        melden();
        return;

      case 'zurueck':
        if (n.spieler !== bericht.du) bericht.gegnerWegBis = 0;
        melden();
        return;

      case 'ende':
        rueckkehrVergessen();
        o.onEnde(n.ausgang, n.tuerme, n.grund);
        return;

      default:
        return;
    }
  }

  return {
    get bericht() { return { ...bericht }; },

    raumOeffnen(einheitlicheLevel) {
      wunsch = { art: 'neu', einheitlich: einheitlicheLevel };
      rueckkehrVergessen();
      if (verbindung.zustand === 'offen') wunschSenden();
    },

    raumBetreten(code) {
      wunsch = { art: 'bei', code };
      rueckkehrVergessen();
      if (verbindung.zustand === 'offen') wunschSenden();
    },

    zurueckKehren() {
      /* Kein Wunsch: es gibt nichts nachzuholen, wenn das Token nicht
         mehr gilt. Der Bildschirm zeigt dann die Anmeldung. */
      wunsch = null;
      const alt = rueckkehrVorhanden();
      if (alt && verbindung.zustand === 'offen') {
        verbindung.senden({
          t: 'wiederAn', version: VERSION, code: alt.code, token: alt.token,
        });
      }
    },

    bereit(wert) { verbindung.senden({ t: 'bereit', wert }); },

    aufgeben() {
      verbindung.senden({ t: 'verlassen' });
      rueckkehrVergessen();
    },

    schliessen() {
      verbindung.schliessen();
      lauf = null;
    },
  };

  function laufAnlegen(aufbau: MatchAufbau, ich: Spieler): OnlineLauf {
    return onlineLaufStarten({
      aufbau,
      ich,
      senden: (zug) => verbindung.senden({ t: 'zug', zug }),
      schnappschussBitten: () => verbindung.senden({ t: 'schnappschussBitte' }),
      laufzeit: () => verbindung.halbeLaufzeit,
    });
  }

  /* ------------------------- Rueckkehrmerker ----------------------- */

  function rueckkehrSchreiben(code: string, tok: string): void {
    try {
      globalThis.localStorage?.setItem(
        RUECKKEHR_SCHLUESSEL, JSON.stringify({ code, token: tok, zeit: Date.now() }),
      );
    } catch { /* Kein Speicher - dann eben keine Rueckkehr. */ }
  }
}
