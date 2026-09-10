import { describe, it, expect } from 'vitest';
import { ROLL, LEVEL, ELIXIR, MATCH, arenaFuer, ARENEN } from '../src/data/balance.js';

describe('Balancing-Werte', () => {
  it('summiert die Roll-Raten auf genau 10000 Zehntausendstel', () => {
    const summe = ROLL.raten.gewoehnlich + ROLL.raten.selten
      + ROLL.raten.episch + ROLL.raten.legendaer;
    expect(summe).toBe(10000);
  });

  it('hat fuer jede Levelstufe einen Faktor und einen Preis', () => {
    expect(LEVEL.faktorPromille.length).toBe(LEVEL.max);
    expect(LEVEL.splitterProStufe.length).toBe(LEVEL.max - 1);
    expect(LEVEL.faktorPromille[0]).toBe(1000);
    expect(LEVEL.einheitlich).toBeGreaterThanOrEqual(1);
    expect(LEVEL.einheitlich).toBeLessThanOrEqual(LEVEL.max);
  });

  it('steigert die Levelfaktoren streng monoton', () => {
    for (let i = 1; i < LEVEL.faktorPromille.length; i++) {
      expect(LEVEL.faktorPromille[i]!).toBeGreaterThan(LEVEL.faktorPromille[i - 1]!);
    }
  });

  it('haelt das Doppel-Elixir innerhalb der regulaeren Spielzeit', () => {
    expect(MATCH.doppeltAb).toBeLessThan(MATCH.dauer);
    expect(MATCH.dauer - MATCH.doppeltAb).toBe(60 * 20);
    expect(ELIXIR.start).toBeLessThan(ELIXIR.cap);
  });

  it('ordnet Trophaeen der richtigen Arena zu', () => {
    expect(arenaFuer(0).id).toBe(0);
    expect(arenaFuer(299).id).toBe(0);
    expect(arenaFuer(300).id).toBe(1);
    expect(arenaFuer(99999).id).toBe(ARENEN[ARENEN.length - 1]!.id);
  });
});
