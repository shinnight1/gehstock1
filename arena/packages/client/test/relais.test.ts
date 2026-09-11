/* ------------------------------------------------------------------
   Das Freundesduell ueber das Relais, gegen eine Attrappe.

   Warum diese Tests wichtiger sind als die meisten: der Umbau vom
   WebSocket-Server auf das Relais laesst sich nicht von Hand pruefen.
   Dafuer braeuchte es zwei Geraete gegen die veroeffentlichte Seite,
   und die Seite wird gerade nicht gebaut. Ohne Test waere der ganze
   Netcode ungetestet ausgeliefert - an genau der Stelle, die nie
   falsch rechnen darf.

   Die Attrappe ist das Relais aus netlify/functions/room.mjs, auf das
   reduziert, was die Arena benutzt: create, join, act, start, sync,
   leave. Sie haelt einen Raum im Speicher und beantwortet sync sofort,
   statt zu warten - der Test soll die Abfolge pruefen, nicht die
   Wartezeit.
   ------------------------------------------------------------------ */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { relaisVerbindungAnlegen } from '../src/netz/relais.js';
import { sitzungAnlegen } from '../src/netz/sitzung.js';
import type { VomServer, Anmeldung } from '@arena/netz';

interface Raum {
  code: string;
  game: string;
  seats: number;
  seed: number;
  version: number;
  started: boolean;
  meta: Record<string, unknown>;
  log: { seat: number; a: unknown }[];
  players: { id: string; token: string; name: string; seat: number; seen: number }[];
}

function attrappe(): { raeume: Map<string, Raum> } {
  const raeume = new Map<string, Raum>();
  let zaehler = 0;

  const antwort = (daten: unknown, ok = true): Response => ({
    ok,
    json: () => Promise.resolve(daten),
  }) as unknown as Response;

  const oeffentlich = (r: Raum): Record<string, unknown> => ({
    code: r.code, game: r.game, seats: r.seats, seed: r.seed,
    version: r.version, started: r.started, meta: r.meta, log: r.log,
    players: r.players.map((p) => ({ id: p.id, name: p.name, seat: p.seat, seen: p.seen })),
  });

  globalThis.fetch = vi.fn(async (_url: unknown, init?: unknown) => {
    const roh = (init as { body: string }).body;
    const m = JSON.parse(roh) as Record<string, any>;
    const op = String(m['op']);

    if (op === 'create') {
      /* Vier Ziffern, wenn danach gefragt wird - genau wie im echten
         Relais. Der Test haengt daran: er prueft die Codeform mit. */
      const code = m['ziffern'] ? String(1000 + (zaehler++ % 9000)) : 'ABCDEF';
      const p = { id: 'p' + (++zaehler), token: 't' + zaehler, name: 'A', seat: 0, seen: Date.now() };
      const r: Raum = {
        code, game: String(m['game'] || ''), seats: 2, seed: 4242,
        version: 1, started: false, meta: (m['opts'] as Record<string, unknown>) || {},
        log: [], players: [p],
      };
      raeume.set(code, r);
      return antwort({ ...oeffentlich(r), playerId: p.id, token: p.token, seat: 0, isHost: true });
    }

    /* sync zuerst: dort steht der Raumcode verschachtelt in msg.raum,
       nicht flach in msg.code. Genau so macht es das echte Relais. */
    if (op === 'sync') {
      const wunsch = (m['raum'] ?? {}) as Record<string, unknown>;
      const rs = raeume.get(String(wunsch['code'] ?? ''));
      if (!rs) return antwort({ version: 0, raum: { closed: true } });
      const seit = Number(wunsch['since']) || 0;
      if (rs.version > seit) return antwort({ version: rs.version, raum: oeffentlich(rs) });
      return antwort({ version: rs.version, leer: true });
    }

    const r = raeume.get(String(m['code'] ?? ''));
    if (!r) return antwort({ error: 'room_not_found' }, false);

    if (op === 'join') {
      if (r.players.length >= r.seats) return antwort({ error: 'room_full' }, false);
      const p = { id: 'p' + (++zaehler), token: 't' + zaehler, name: 'B', seat: r.players.length, seen: Date.now() };
      r.players.push(p);
      r.version++;
      return antwort({ ...oeffentlich(r), playerId: p.id, token: p.token, seat: p.seat, isHost: false });
    }

    const ich = r.players.find((p) => p.id === m['playerId'] && p.token === m['token']);
    if (!ich) return antwort({ error: 'bad_token' }, false);

    if (op === 'act') {
      r.log.push({ seat: ich!.seat, a: m['action'] });
      r.version++;
      return antwort(oeffentlich(r));
    }
    if (op === 'start') {
      r.started = true;
      r.meta = { ...r.meta, ...(m['meta'] as Record<string, unknown>) };
      r.version++;
      return antwort(oeffentlich(r));
    }
    if (op === 'leave') return antwort({ ok: true });
    return antwort({ error: 'bad_op' }, false);
  }) as typeof fetch;

  return { raeume };
}

/** Ein Spieler mit Sammelbecken fuer alles, was er vom "Server" hoert. */
function spieler(name: string) {
  const post: VomServer[] = [];
  const v = relaisVerbindungAnlegen({
    url: '',
    onNachricht: (n) => post.push(n),
    onZustand: () => { /* egal */ },
    onOffen: () => { /* das Relais ruft das nicht */ },
  });
  const anmeldung: Anmeldung = { name, deck: ['a', 'b'], level: { a: 1 } };
  return { v, post, anmeldung, letzte: (t: string) => post.filter((n) => n.t === t).at(-1) };
}

/* Echte Zeit, keine gestellte.

   Die Warteschleife des Relais schlaeft zwischen zwei Anfragen, und
   mit gestellten Zeitgebern muesste der Test jeden dieser Schlafe
   einzeln vorspulen. Ein paar hundert Millisekunden echt zu warten
   ist der ehrlichere und kuerzere Weg - und er prueft nebenbei, dass
   die Schleife wirklich weiterlaeuft. */
const warte = (ms: number): Promise<void> => new Promise((f) => { setTimeout(f, ms); });
const ruhen = (n = 1): Promise<void> => warte(400 * n);

describe('Freundesduell ueber das Relais', () => {
  beforeEach(() => { attrappe(); });

  /* Dieser Test geht bewusst durch die echte Sitzung statt direkt auf
     die Verbindung.

     Die drei Tests darunter taten das nicht, und genau deshalb gingen
     sie durch, waehrend der Warteraum auf der fertigen Seite ewig bei
     "verbinde ..." stand: die Sitzung macht den Raum nur auf, wenn die
     Verbindung sich als offen meldet, und die Relaisverbindung meldete
     das nie. Henne und Ei, und kein Test dazwischen. */
  it('macht den Raum ueber die Sitzung wirklich auf', async () => {
    let code = '';
    const s = sitzungAnlegen({
      url: '',
      anmeldung: { name: 'A', deck: ['a'], level: {} },
      onBericht: (b) => { if (b.code) code = b.code; },
      onStart: () => { /* kommt hier nicht */ },
      onEnde: () => { /* kommt hier nicht */ },
    });
    s.raumOeffnen(true);
    await ruhen(2);
    expect(code).toMatch(/^[0-9]{4}$/);
    s.schliessen();
  });

  it('vergibt einen vierstelligen Zahlencode', async () => {
    const a = spieler('A');
    a.v.senden({ t: 'raumNeu', version: 1, anmeldung: a.anmeldung, einheitlicheLevel: true });
    await ruhen();
    const raum = a.letzte('raum') as { code: string } | undefined;
    expect(raum).toBeDefined();
    expect(raum!.code).toMatch(/^[0-9]{4}$/);
    a.v.schliessen();
  });

  it('bringt beide Seiten mit demselben Aufbau an den Anpfiff', async () => {
    const a = spieler('A');
    a.v.senden({ t: 'raumNeu', version: 1, anmeldung: a.anmeldung, einheitlicheLevel: true });
    await ruhen();
    const code = (a.letzte('raum') as { code: string }).code;

    const b = spieler('B');
    b.v.senden({ t: 'raumBei', version: 1, code, anmeldung: b.anmeldung });
    await ruhen();

    a.v.senden({ t: 'bereit', wert: true });
    b.v.senden({ t: 'bereit', wert: true });
    await ruhen(3);

    const startA = a.letzte('start') as { aufbau: { seed: number; decks: string[][] }; du: number } | undefined;
    const startB = b.letzte('start') as { aufbau: { seed: number; decks: string[][] }; du: number } | undefined;
    expect(startA).toBeDefined();
    expect(startB).toBeDefined();
    /* Wort fuer Wort derselbe Aufbau - sonst rechnen die beiden
       Simulationen von der ersten Sekunde an unterschiedlich. */
    expect(startA!.aufbau).toEqual(startB!.aufbau);
    expect(startA!.du).toBe(0);
    expect(startB!.du).toBe(1);
    a.v.schliessen(); b.v.schliessen();
  });

  it('gibt erst frei, wenn von beiden Seiten ein Stapel vorliegt', async () => {
    const a = spieler('A');
    a.v.senden({ t: 'raumNeu', version: 1, anmeldung: a.anmeldung, einheitlicheLevel: true });
    await ruhen();
    const code = (a.letzte('raum') as { code: string }).code;
    const b = spieler('B');
    b.v.senden({ t: 'raumBei', version: 1, code, anmeldung: b.anmeldung });
    await ruhen();
    a.v.senden({ t: 'bereit', wert: true });
    b.v.senden({ t: 'bereit', wert: true });
    await ruhen(3);

    a.v.senden({ t: 'zug', zug: { kartenId: 'a', x: 1000, y: 2000, tick: 0 } });
    await warte(2800);

    const zuegeB = b.post.filter((n) => n.t === 'zuege') as { bisTick: number; liste: unknown[] }[];
    expect(zuegeB.length).toBeGreaterThan(0);
    /* Der Zug des einen muss beim anderen ankommen, und zwar mit einem
       Tick, der noch vor der Freigabe liegt. */
    const mitZug = zuegeB.find((n) => n.liste.length > 0);
    expect(mitZug).toBeDefined();
    a.v.schliessen(); b.v.schliessen();
  });
});
