/* ------------------------------------------------------------------
   Der Raum ohne Netz.

   Er bekommt Ereignisse hineingereicht und gibt Nachrichten heraus -
   deshalb laesst er sich hier vollstaendig pruefen, ohne dass ein
   Socket im Spiel waere. Geprueft wird vor allem das, was der Auftrag
   ausdruecklich verlangt: dass ungueltige Befehle verworfen werden,
   statt irgendwie doch zu wirken.
   ------------------------------------------------------------------ */

import { describe, it, expect } from 'vitest';
import { MATCH, karteVon, tile } from '@arena/sim';
import type { Spieler } from '@arena/sim';
import type { VomServer, Anmeldung } from '@arena/netz';
import { VERZUG_TICKS } from '@arena/netz';
import { raumAnlegen } from '../src/raum.js';
import type { Raum } from '../src/raum.js';

const DECK_A = [
  'rattenschar', 'hundemeute', 'bogenschuetzin', 'steinwaechter',
  'funkenregen', 'speerwerferinnen', 'hammergarde', 'bollwerk',
];
const DECK_B = [
  'frostkoloss', 'sturmfalken', 'flammenspeier', 'blitzmagier',
  'feuersturm', 'krypta', 'wolkenwal', 'frostschleier',
];

function anmeldung(name: string, deck: string[]): Anmeldung {
  return { name, deck: deck.slice(), level: {} };
}

interface Post {
  an: Spieler | 'beide';
  n: VomServer;
}

interface Aufbau {
  raum: Raum;
  post: Post[];
  /** Ticks rechnen lassen, als waere Zeit vergangen. */
  laufen(anzahl: number): void;
}

function angepfiffen(): Aufbau {
  const post: Post[] = [];
  const raum = raumAnlegen('123456', true, (an, n) => post.push({ an, n }), Date.now());
  raum.setzen(anmeldung('A', DECK_A), 'tokenA');
  raum.setzen(anmeldung('B', DECK_B), 'tokenB');
  raum.bereitSetzen(0, true);
  raum.bereitSetzen(1, true);

  let uhr = Date.now();
  const laufen = (anzahl: number): void => {
    for (let i = 0; i < anzahl; i++) {
      uhr += 50;
      raum.takt(uhr);
    }
  };
  return { raum, post, laufen };
}

function letzte<T extends VomServer['t']>(
  post: Post[], art: T,
): Extract<VomServer, { t: T }> | undefined {
  for (let i = post.length - 1; i >= 0; i--) {
    const n = post[i]!.n;
    if (n.t === art) return n as Extract<VomServer, { t: T }>;
  }
  return undefined;
}

describe('Raum', () => {
  it('vergibt zwei Plaetze und dann keinen mehr', () => {
    const raum = raumAnlegen('111111', true, () => { /* still */ }, Date.now());
    expect(raum.setzen(anmeldung('A', DECK_A), 't1')).toBe(0);
    expect(raum.setzen(anmeldung('B', DECK_B), 't2')).toBe(1);
    expect(raum.setzen(anmeldung('C', DECK_A), 't3')).toBeNull();
  });

  it('pfeift erst an, wenn beide bereit sind', () => {
    const post: Post[] = [];
    const raum = raumAnlegen('222222', true, (an, n) => post.push({ an, n }), Date.now());
    raum.setzen(anmeldung('A', DECK_A), 't1');
    raum.setzen(anmeldung('B', DECK_B), 't2');

    raum.bereitSetzen(0, true);
    expect(letzte(post, 'start')).toBeUndefined();
    expect(raum.phase).toBe('wartet');

    raum.bereitSetzen(1, true);
    expect(post.filter((e) => e.n.t === 'start')).toHaveLength(2);
    expect(raum.phase).toBe('laeuft');
  });

  it('gibt beiden Seiten denselben Aufbau, aber verschiedene Seiten', () => {
    const post: Post[] = [];
    const raum = raumAnlegen('333333', true, (an, n) => post.push({ an, n }), Date.now());
    raum.setzen(anmeldung('A', DECK_A), 't1');
    raum.setzen(anmeldung('B', DECK_B), 't2');
    raum.bereitSetzen(0, true);
    raum.bereitSetzen(1, true);

    const starts = post
      .map((e) => e.n)
      .filter((n): n is Extract<VomServer, { t: 'start' }> => n.t === 'start');
    expect(JSON.stringify(starts[0]!.aufbau)).toBe(JSON.stringify(starts[1]!.aufbau));
    expect(starts[0]!.du).toBe(0);
    expect(starts[1]!.du).toBe(1);
  });

  it('gibt nach jedem Tick frei, auch ohne Zuege', () => {
    const { post, laufen } = angepfiffen();
    laufen(6);
    const frei = post.filter((e) => e.n.t === 'zuege');
    expect(frei.length).toBeGreaterThanOrEqual(5);
    const zuletzt = letzte(post, 'zuege')!;
    expect(zuletzt.bisTick).toBeGreaterThan(0);
    expect(zuletzt.liste).toHaveLength(0);
  });

  it('nimmt einen gueltigen Zug an und gibt ihn im Zieltick heraus', () => {
    const { raum, post, laufen } = angepfiffen();
    laufen(MATCH.countdown + 4);

    raum.zugAnnehmen(0, {
      kartenId: raum.stand!.spieler[0].hand[0]!, x: tile(5), y: tile(20),
      tick: raum.serverTick + VERZUG_TICKS,
    });
    expect(letzte(post, 'abgelehnt')).toBeUndefined();

    laufen(VERZUG_TICKS + 3);
    const mitZug = post.filter((e) => e.n.t === 'zuege' && e.n.liste.length > 0);
    expect(mitZug).toHaveLength(1);
  });

  it('verwirft einen Zug fuer einen Tick, der schon vorbei ist', () => {
    const { raum, post, laufen } = angepfiffen();
    laufen(MATCH.countdown + 10);
    raum.zugAnnehmen(0, {
      kartenId: DECK_A[0]!, x: tile(5), y: tile(20), tick: raum.serverTick - 1,
    });
    expect(letzte(post, 'abgelehnt')?.grund).toBe('zuSpaet');
  });

  it('verwirft einen Zug, der weit in die Zukunft gebucht wird', () => {
    const { raum, post, laufen } = angepfiffen();
    laufen(MATCH.countdown + 10);
    raum.zugAnnehmen(0, {
      kartenId: DECK_A[0]!, x: tile(5), y: tile(20), tick: raum.serverTick + 500,
    });
    expect(letzte(post, 'abgelehnt')?.grund).toBe('zuSpaet');
  });

  it('verwirft eine Karte, die nicht auf der Hand liegt', () => {
    const { raum, post, laufen } = angepfiffen();
    laufen(MATCH.countdown + 4);
    /* Eine Karte aus dem gegnerischen Deck kann nie auf der eigenen
       Hand liegen - genau der Fall, den ein manipulierter Client
       versuchen wuerde. */
    raum.zugAnnehmen(0, {
      kartenId: DECK_B[0]!, x: tile(5), y: tile(20),
      tick: raum.serverTick + VERZUG_TICKS,
    });
    expect(letzte(post, 'abgelehnt')?.grund).toBe('nichtAufDerHand');
  });

  it('verwirft eine erfundene Karte', () => {
    const { raum, post, laufen } = angepfiffen();
    laufen(MATCH.countdown + 4);
    raum.zugAnnehmen(0, {
      kartenId: 'drachenkaiser', x: tile(5), y: tile(20),
      tick: raum.serverTick + VERZUG_TICKS,
    });
    expect(letzte(post, 'abgelehnt')?.grund).toBe('unbekannteKarte');
  });

  it('verwirft eine Platzierung auf der gegnerischen Haelfte', () => {
    const { raum, post, laufen } = angepfiffen();
    laufen(MATCH.countdown + 4);
    // Aus der Hand, nicht aus dem Deck: nur vier der acht liegen aus.
    const hand = raum.stand!.spieler[0].hand
      .find((id) => karteVon(id)?.art !== 'zauber')!;
    raum.zugAnnehmen(0, {
      // Vier Kacheln von oben liegt tief in der Haelfte von Spieler 1.
      kartenId: hand, x: tile(9), y: tile(4),
      tick: raum.serverTick + VERZUG_TICKS,
    });
    expect(letzte(post, 'abgelehnt')?.grund).toBe('zonneVerboten');
  });

  it('verrechnet eingeplante Zuege gegeneinander und stoppt beim Elixir', () => {
    const { raum, post, laufen } = angepfiffen();
    laufen(MATCH.countdown + 2);

    /* Vier Handkarten auf denselben Tick. Einzeln waere jede
       bezahlbar, zusammen keine - der Server muss die schon
       eingeplanten mitrechnen, sonst kaeme ein Client mit vier Zuegen
       fuer fuenf Elixir durch. */
    const hand = raum.stand!.spieler[0].hand.slice();
    /* Der Stand von jetzt, nicht der Startwert: bis hierher ist echte
       Zeit vergangen, und ein Punkt kann schon nachgewachsen sein. */
    const vorrat = raum.stand!.spieler[0].elixir;
    const ziel = raum.serverTick + VERZUG_TICKS;

    /* Nachgerechnet wird wie der Server: ein abgelehnter Zug
       verbraucht nichts, also kann eine spaetere billigere Karte
       durchaus noch hineinpassen. Eine blosse Summe waere zu streng. */
    let rest = vorrat;
    let mussScheitern = 0;
    for (const id of hand) {
      const kosten = karteVon(id)!.elixir;
      if (kosten <= rest) rest -= kosten;
      else mussScheitern++;
      raum.zugAnnehmen(0, { kartenId: id, x: tile(5), y: tile(20), tick: ziel });
    }
    expect(mussScheitern).toBeGreaterThan(0);

    const abgelehnt = post.filter(
      (e) => e.n.t === 'abgelehnt' && e.n.grund === 'zuwenigElixir',
    );
    expect(abgelehnt).toHaveLength(mussScheitern);
  });

  it('laesst dieselbe Karte nicht zweimal setzen', () => {
    const { raum, post, laufen } = angepfiffen();
    laufen(MATCH.countdown + 2);

    /* Der Doppeltipp: nach dem ersten Zug ist die Karte durch den
       Zyklus gewandert und liegt nicht mehr aus. */
    const id = raum.stand!.spieler[0].hand[0]!;
    const ziel = raum.serverTick + VERZUG_TICKS;
    raum.zugAnnehmen(0, { kartenId: id, x: tile(5), y: tile(20), tick: ziel });
    expect(letzte(post, 'abgelehnt')).toBeUndefined();

    raum.zugAnnehmen(0, { kartenId: id, x: tile(6), y: tile(20), tick: ziel });
    expect(letzte(post, 'abgelehnt')?.grund).toBe('nichtAufDerHand');
  });

  it('schickt regelmaessig eine Pruefsumme mit', () => {
    const { post, laufen } = angepfiffen();
    laufen(45);
    expect(post.filter((e) => e.n.t === 'pruef').length).toBeGreaterThanOrEqual(2);
  });

  it('gibt einen Platz vor dem Anpfiff wieder frei', () => {
    const post: Post[] = [];
    const raum = raumAnlegen('444444', true, (an, n) => post.push({ an, n }), Date.now());
    raum.setzen(anmeldung('A', DECK_A), 't1');
    raum.setzen(anmeldung('B', DECK_B), 't2');
    raum.trennen(1);
    expect(raum.plaetze[1]).toBeNull();
    // Danach darf wieder jemand hinein.
    expect(raum.setzen(anmeldung('C', DECK_B), 't3')).toBe(1);
  });

  it('haelt den Platz waehrend der Partie und gibt ihn per Token zurueck', () => {
    const { raum, post } = angepfiffen();
    raum.trennen(1);
    expect(raum.plaetze[1]).not.toBeNull();
    expect(letzte(post, 'weg')?.spieler).toBe(1);

    expect(raum.wiederkehr('tokenB')).toBe(1);
    expect(letzte(post, 'zurueck')?.spieler).toBe(1);
    expect(raum.phase).toBe('laeuft');
  });

  it('kennt fremde Token nicht', () => {
    const { raum } = angepfiffen();
    raum.trennen(1);
    expect(raum.wiederkehr('geraten')).toBeNull();
  });

  it('erklaert die Partie verloren, wer zu lange weg bleibt', () => {
    const post: Post[] = [];
    const raum = raumAnlegen('555555', true, (an, n) => post.push({ an, n }), Date.now());
    raum.setzen(anmeldung('A', DECK_A), 'tA');
    raum.setzen(anmeldung('B', DECK_B), 'tB');
    raum.bereitSetzen(0, true);
    raum.bereitSetzen(1, true);

    raum.trennen(1);
    raum.takt(Date.now() + 31_000);

    expect(letzte(post, 'ende')?.ausgang).toBe('sieg0');
    expect(letzte(post, 'ende')?.grund).toBe('aufgabe');
    expect(raum.phase).toBe('vorbei');
  });

  it('beendet die Partie bei Aufgabe zugunsten der Gegenseite', () => {
    const { raum, post } = angepfiffen();
    raum.aufgeben(0);
    expect(letzte(post, 'ende')?.ausgang).toBe('sieg1');
    expect(raum.phase).toBe('vorbei');
  });

  it('nimmt nach dem Ende keine Zuege mehr an', () => {
    const { raum, post } = angepfiffen();
    raum.aufgeben(0);
    const vorher = post.length;
    raum.zugAnnehmen(1, {
      kartenId: DECK_B[0]!, x: tile(5), y: tile(10),
      tick: raum.serverTick + VERZUG_TICKS,
    });
    expect(post).toHaveLength(vorher);
  });
});
