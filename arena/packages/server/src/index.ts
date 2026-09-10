/* ------------------------------------------------------------------
   Spielserver: HTTP-Status und WebSocket-Vermittlung.

   Diese Datei kennt Sockets und sonst wenig. Was ein Raum ist und wie
   eine Partie laeuft, steht in raum.ts; was ueber die Leitung geht, in
   @arena/netz. Hier wird nur zugeordnet: Nachricht kommt an, richtiger
   Raum wird gesucht, Antwort geht zurueck.

   Konfiguration ausschliesslich ueber Umgebungsvariablen - der Server
   soll nichts ueber die Domain wissen, unter der der Client laeuft.
     ARENA_PORT   Port (Vorgabe 8081)
     ARENA_HOST   Bindeadresse (Vorgabe 0.0.0.0, damit das LAN drankommt)

   TLS macht der Server nicht selbst. Im Betrieb steht ein Proxy davor
   (Caddy, nginx, Fly, Railway), der HTTPS und WSS abwickelt; im LAN-
   Test reicht ws://. Selbst Zertifikate zu verwalten waere eine zweite
   Baustelle mit eigenen Fehlern, und jeder Hoster bringt sie mit.
   ------------------------------------------------------------------ */

import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { TICKS_PRO_SEKUNDE, karteVon, DECK } from '@arena/sim';
import type { Spieler } from '@arena/sim';
import {
  PROTOKOLL_VERSION, RAUM_VERFALL_MIN, nachrichtLesen,
  codeErzeugen, codeGueltig, codeSaeubern, tokenErzeugen,
} from '@arena/netz';
import type { VonClient, VomServer, Anmeldung, Fehlergrund } from '@arena/netz';
import { raumAnlegen } from './raum.js';
import type { Raum } from './raum.js';

const PORT = Number(process.env['ARENA_PORT'] ?? 8081);
const HOST = process.env['ARENA_HOST'] ?? '0.0.0.0';

/** Wie oft die Raeume gerechnet werden. Etwas feiner als der Tick. */
const SCHLEIFE_MS = 25;

interface Sitzung {
  raum: Raum;
  spieler: Spieler;
}

const raeume = new Map<string, Raum>();
/** Wer sitzt wo. Ein Socket ohne Eintrag hat noch keinen Platz. */
const sitzungen = new Map<WebSocket, Sitzung>();
/** Alle Sockets eines Raums, nach Platznummer. */
const drahtzieher = new Map<string, [WebSocket | null, WebSocket | null]>();

const server = createServer((anfrage, antwort) => {
  if (anfrage.url === '/status') {
    antwort.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      // Der Client liegt auf einer anderen Adresse - im LAN-Test immer.
      'access-control-allow-origin': '*',
    });
    antwort.end(JSON.stringify({
      dienst: 'arena',
      version: PROTOKOLL_VERSION,
      tickrate: TICKS_PRO_SEKUNDE,
      raeume: raeume.size,
      zeit: Date.now(),
    }));
    return;
  }
  antwort.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  antwort.end('Arena-Server. Es gibt /status und den WebSocket auf demselben Port.\n');
});

const wss = new WebSocketServer({ server, maxPayload: 256 * 1024 });

/* --------------------------- Verschicken --------------------------- */

function anSocket(sock: WebSocket | null, nachricht: VomServer): void {
  if (!sock || sock.readyState !== WebSocket.OPEN) return;
  try {
    sock.send(JSON.stringify(nachricht));
  } catch {
    /* Kaputte Leitung - das merkt gleich das close-Ereignis. */
  }
}

function senderFuer(code: string) {
  return (an: Spieler | 'beide', nachricht: VomServer): void => {
    const paar = drahtzieher.get(code);
    if (!paar) return;
    if (an === 'beide') {
      anSocket(paar[0], nachricht);
      anSocket(paar[1], nachricht);
    } else {
      anSocket(paar[an], nachricht);
    }
  };
}

function fehler(sock: WebSocket, grund: Fehlergrund): void {
  anSocket(sock, { t: 'fehler', grund });
}

/* ---------------------------- Pruefungen --------------------------- */

/**
 * Deck pruefen, bevor irgendetwas damit gemacht wird.
 *
 * Ein Deck aus acht Mal derselben Karte oder aus Karten, die es nicht
 * gibt, wuerde die Simulation nicht abstuerzen lassen - sie wuerde nur
 * merkwuerdig laufen, und zwar auf beiden Seiten unterschiedlich
 * merkwuerdig. Deshalb hier und nicht spaeter.
 */
function deckOk(deck: unknown): deck is string[] {
  if (!Array.isArray(deck) || deck.length !== DECK.groesse) return false;
  const gesehen = new Set<string>();
  for (const id of deck) {
    if (typeof id !== 'string') return false;
    const karte = karteVon(id);
    if (!karte || karte.sammelbar === false) return false;
    if (gesehen.has(id)) return false;
    gesehen.add(id);
  }
  return true;
}

/** Anmeldung saeubern. Namen werden gekuerzt, nicht abgelehnt. */
function anmeldungLesen(roh: unknown): Anmeldung | null {
  if (!roh || typeof roh !== 'object') return null;
  const a = roh as Partial<Anmeldung>;
  if (!deckOk(a.deck)) return null;

  const level: Record<string, number> = {};
  if (a.level && typeof a.level === 'object') {
    for (const [id, wert] of Object.entries(a.level)) {
      if (typeof wert !== 'number' || !Number.isFinite(wert)) continue;
      // Ausserhalb 1..5 gibt es keine Stufe - alles andere waere ein
      // Client, der sich Werte ausdenkt.
      level[id] = Math.max(1, Math.min(5, Math.trunc(wert)));
    }
  }

  const name = typeof a.name === 'string' && a.name.trim()
    ? a.name.trim().slice(0, 20)
    : 'Gast';

  return { name, deck: a.deck, level };
}

/* --------------------------- Zuordnung ----------------------------- */

function platzBelegen(sock: WebSocket, raum: Raum, spieler: Spieler, token: string): void {
  const paar = drahtzieher.get(raum.code) ?? [null, null];
  /* Doppelte Anmeldung auf denselben Platz: die alte Leitung fliegt
     raus. Das ist die freundlichere Auslegung - meist ist es derselbe
     Spieler, dessen altes Fenster noch offen steht. */
  const alt = paar[spieler];
  if (alt && alt !== sock) {
    sitzungen.delete(alt);
    try { alt.close(4001, 'anderswo uebernommen'); } catch { /* schon zu */ }
  }
  paar[spieler] = sock;
  drahtzieher.set(raum.code, paar);
  sitzungen.set(sock, { raum, spieler });

  anSocket(sock, {
    t: 'raum', code: raum.code, du: spieler as 0 | 1, token,
    plaetze: raum.sitzplaetze(), einheitlicheLevel: raum.einheitlicheLevel,
  });
  senderFuer(raum.code)('beide', {
    t: 'raum', code: raum.code, du: spieler as 0 | 1, token: '',
    plaetze: raum.sitzplaetze(), einheitlicheLevel: raum.einheitlicheLevel,
  });
}

/* -------------------------- Nachrichten ---------------------------- */

function behandeln(sock: WebSocket, nachricht: VonClient): void {
  const sitzung = sitzungen.get(sock);

  switch (nachricht.t) {
    case 'raumNeu': {
      if (nachricht.version !== PROTOKOLL_VERSION) return fehler(sock, 'version');
      if (sitzung) return fehler(sock, 'schonDrin');
      const anmeldung = anmeldungLesen(nachricht.anmeldung);
      if (!anmeldung) return fehler(sock, 'deckUngueltig');

      const code = codeErzeugen((c) => raeume.has(c));
      if (!code) return fehler(sock, 'kaputt');

      const raum = raumAnlegen(
        code, nachricht.einheitlicheLevel !== false, senderFuer(code), Date.now(),
      );
      raeume.set(code, raum);
      drahtzieher.set(code, [null, null]);

      const token = tokenErzeugen();
      const spieler = raum.setzen(anmeldung, token);
      if (spieler === null) return fehler(sock, 'kaputt');
      platzBelegen(sock, raum, spieler, token);
      return;
    }

    case 'raumBei': {
      if (nachricht.version !== PROTOKOLL_VERSION) return fehler(sock, 'version');
      if (sitzung) return fehler(sock, 'schonDrin');
      const code = codeSaeubern(String(nachricht.code ?? ''));
      if (!codeGueltig(code)) return fehler(sock, 'raumUnbekannt');
      const raum = raeume.get(code);
      if (!raum) return fehler(sock, 'raumUnbekannt');
      if (raum.phase !== 'wartet') return fehler(sock, 'raumLaeuft');

      const anmeldung = anmeldungLesen(nachricht.anmeldung);
      if (!anmeldung) return fehler(sock, 'deckUngueltig');

      const token = tokenErzeugen();
      const spieler = raum.setzen(anmeldung, token);
      if (spieler === null) return fehler(sock, 'raumVoll');
      platzBelegen(sock, raum, spieler, token);
      return;
    }

    case 'wiederAn': {
      if (nachricht.version !== PROTOKOLL_VERSION) return fehler(sock, 'version');
      const code = codeSaeubern(String(nachricht.code ?? ''));
      const raum = raeume.get(code);
      if (!raum) return fehler(sock, 'raumUnbekannt');
      const spieler = raum.wiederkehr(String(nachricht.token ?? ''));
      if (spieler === null) return fehler(sock, 'tokenUnbekannt');
      platzBelegen(sock, raum, spieler, String(nachricht.token));
      // Wer zurueckkommt, braucht den ganzen Stand - er hat Ticks verpasst.
      raum.schnappschussSenden(spieler);
      return;
    }

    case 'bereit':
      if (!sitzung) return;
      sitzung.raum.bereitSetzen(sitzung.spieler, nachricht.wert === true);
      return;

    case 'zug': {
      if (!sitzung) return;
      const z = nachricht.zug;
      if (!z || typeof z.kartenId !== 'string'
        || !Number.isFinite(z.x) || !Number.isFinite(z.y)
        || !Number.isFinite(z.tick)) return;
      sitzung.raum.zugAnnehmen(sitzung.spieler, {
        kartenId: z.kartenId, x: z.x, y: z.y, tick: Math.trunc(z.tick),
      });
      return;
    }

    case 'schnappschussBitte':
      if (!sitzung) return;
      sitzung.raum.schnappschussSenden(sitzung.spieler);
      return;

    case 'verlassen':
      if (!sitzung) return;
      sitzung.raum.aufgeben(sitzung.spieler);
      return;

    case 'ping':
      anSocket(sock, {
        t: 'pong',
        zeit: Number(nachricht.zeit) || 0,
        serverTick: sitzung?.raum.serverTick ?? 0,
      });
      return;

    default:
      return;
  }
}

wss.on('connection', (sock) => {
  sock.on('message', (roh) => {
    const nachricht = nachrichtLesen<VonClient>(String(roh));
    if (!nachricht) return;
    try {
      behandeln(sock, nachricht);
    } catch (e) {
      console.error('[server] Nachricht fehlgeschlagen:', e);
      fehler(sock, 'kaputt');
    }
  });

  sock.on('close', () => {
    const sitzung = sitzungen.get(sock);
    sitzungen.delete(sock);
    if (!sitzung) return;
    const paar = drahtzieher.get(sitzung.raum.code);
    if (paar && paar[sitzung.spieler] === sock) paar[sitzung.spieler] = null;
    sitzung.raum.trennen(sitzung.spieler);
  });

  sock.on('error', () => { /* close kommt gleich hinterher */ });
});

/* ---------------------------- Schleife ----------------------------- */

const VERFALL_MS = RAUM_VERFALL_MIN * 60 * 1000;

setInterval(() => {
  const jetzt = Date.now();
  for (const [code, raum] of raeume) {
    raum.takt(jetzt);

    /* Aufraeumen: fertige Raeume bleiben eine Minute stehen, damit ein
       spaet ankommender Client noch eine Antwort bekommt statt ins
       Leere zu laufen. Unbenutzte verfallen nach einer Viertelstunde. */
    const still = jetzt - raum.letzteRegung;
    const weg = raum.phase === 'vorbei' ? still > 60_000 : still > VERFALL_MS;
    if (weg) {
      raeume.delete(code);
      drahtzieher.delete(code);
    }
  }
}, SCHLEIFE_MS);

server.listen(PORT, HOST, () => {
  console.log(`Arena-Server hört auf ${HOST}:${PORT} (Status: /status)`);
});
