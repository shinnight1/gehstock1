import { describe, it, expect } from 'vitest';
import { ROLL, LEVEL, TROPHAEEN, KARTEN_IDS, karteVon } from '@arena/sim';
import type { Seltenheit } from '@arena/sim';
import {
  profilAnlegen, profilPruefen, matchVerbuchen, besitzt, deckGueltig,
  deckAuffuellen, levelTabelle,
} from '../src/profil.js';
import {
  rollZiehen, rollsZiehen, erstpaketVergeben, pityStand, hoechsteSeltenheit,
} from '../src/roll.js';
import {
  aufsteigen, kannAufsteigen, kostenFuerStufe, splitterGeben,
  stufenFortschritt, sammlungsStand,
} from '../src/sammlung.js';
import { speicherAnlegen } from '../src/speicher.js';
import type { Ablage } from '../src/speicher.js';

function mitRolls(anzahl: number, seed = 1234) {
  const p = profilAnlegen(seed);
  p.rolls = anzahl;
  return p;
}

describe('Roll-Verteilung', () => {
  it('trifft die Sollraten auf unter ein Prozent genau', () => {
    const p = mitRolls(100000, 20260907);
    const zaehler: Record<Seltenheit, number> = {
      gewoehnlich: 0, selten: 0, episch: 0, legendaer: 0,
    };
    for (let i = 0; i < 100000; i++) {
      const r = rollZiehen(p);
      expect(r).not.toBeNull();
      zaehler[r!.seltenheit]++;
    }

    /* Der Vergleich laeuft gegen die Sollrate, nicht gegen den
       Erwartungswert der reinen Ziehung: die Pity-Zaehler heben die
       seltenen Stufen bewusst leicht an. Ein Prozent Toleranz deckt
       genau das ab. */
    for (const s of ['gewoehnlich', 'selten', 'episch', 'legendaer'] as const) {
      const anteil = zaehler[s] / 100000;
      const soll = ROLL.raten[s] / 10000;
      expect(Math.abs(anteil - soll)).toBeLessThan(0.01);
    }
  });

  it('zieht bei leerem Vorrat gar nichts', () => {
    const p = profilAnlegen(7);
    expect(p.rolls).toBe(0);
    expect(rollZiehen(p)).toBeNull();
    expect(p.rollsGesamt).toBe(0);
  });

  it('zieht nur Karten, die es auch gibt', () => {
    const p = mitRolls(2000, 99);
    for (let i = 0; i < 2000; i++) {
      const r = rollZiehen(p)!;
      expect(KARTEN_IDS).toContain(r.kartenId);
      expect(karteVon(r.kartenId)!.seltenheit).toBe(r.seltenheit);
    }
  });

  it('zieht nie die Spawner-Einheit', () => {
    const p = mitRolls(5000, 31337);
    for (let i = 0; i < 5000; i++) {
      expect(rollZiehen(p)!.kartenId).not.toBe('knochendiener');
    }
  });
});

describe('Pity', () => {
  it('liefert spaetestens beim zehnten Roll Episch oder besser', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const p = mitRolls(ROLL.pityEpisch, seed);
      let seitEpisch = 0;
      for (let i = 0; i < ROLL.pityEpisch; i++) {
        const r = rollZiehen(p)!;
        const gut = r.seltenheit === 'episch' || r.seltenheit === 'legendaer';
        seitEpisch = gut ? 0 : seitEpisch + 1;
        // Nach neun Nieten muss die zehnte sitzen.
        expect(seitEpisch).toBeLessThan(ROLL.pityEpisch);
      }
    }
  });

  it('liefert spaetestens beim sechzigsten Roll ein Legendaeres', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const p = mitRolls(ROLL.pityLegendaer * 2, seed * 13);
      let seit = 0;
      for (let i = 0; i < ROLL.pityLegendaer * 2; i++) {
        const r = rollZiehen(p)!;
        seit = r.seltenheit === 'legendaer' ? 0 : seit + 1;
        expect(seit).toBeLessThan(ROLL.pityLegendaer);
      }
    }
  });

  it('meldet den Stand bis zur Garantie', () => {
    const p = mitRolls(50, 5);
    expect(pityStand(p).episch).toBe(ROLL.pityEpisch - 1);
    expect(pityStand(p).legendaer).toBe(ROLL.pityLegendaer - 1);
    // Kurz vor der Garantie steht dort null.
    p.seitEpisch = ROLL.pityEpisch - 1;
    expect(pityStand(p).episch).toBe(0);
  });

  it('setzt beide Zaehler zurueck, wenn ein Legendaeres faellt', () => {
    const p = mitRolls(500, 4242);
    for (let i = 0; i < 500; i++) {
      const r = rollZiehen(p)!;
      if (r.seltenheit === 'legendaer') {
        expect(p.seitLegendaer).toBe(0);
        expect(p.seitEpisch).toBe(0);
        return;
      }
    }
    throw new Error('In 500 Rolls kam kein Legendaeres - Pity greift nicht');
  });

  it('markiert erzwungene Rolls als solche', () => {
    const p = mitRolls(ROLL.pityEpisch * 3, 8);
    let erzwungen = 0;
    for (let i = 0; i < ROLL.pityEpisch * 3; i++) {
      if (rollZiehen(p)!.durchPity) erzwungen++;
    }
    expect(erzwungen).toBeGreaterThan(0);
  });
});

describe('Duplikate und Splitter', () => {
  it('gibt beim ersten Mal die Karte, danach Splitter', () => {
    const p = mitRolls(400, 11);
    let ersteNeu = 0;
    let duplikate = 0;
    for (let i = 0; i < 400; i++) {
      const r = rollZiehen(p)!;
      if (r.neu) {
        ersteNeu++;
        expect(r.splitter).toBe(0);
        expect(besitzt(p, r.kartenId)).toBe(true);
      } else {
        duplikate++;
      }
    }
    expect(ersteNeu).toBeGreaterThan(0);
    expect(duplikate).toBeGreaterThan(0);
    // Mehr Karten als es gibt kann man nicht besitzen.
    expect(ersteNeu).toBeLessThanOrEqual(KARTEN_IDS.length);
  });

  it('rechnet Splitter in Stufen um, auch mehrere auf einmal', () => {
    const p = profilAnlegen(1);
    p.karten['hundemeute'] = { level: 1, splitter: 0 };
    const b = p.karten['hundemeute']!;

    expect(kannAufsteigen(b)).toBe(false);
    splitterGeben(p, 'hundemeute', kostenFuerStufe(1));
    expect(kannAufsteigen(b)).toBe(true);
    expect(aufsteigen(p, 'hundemeute')).toBe(1);
    expect(b.level).toBe(2);
    expect(b.splitter).toBe(0);

    // Genug fuer Stufe 3 und 4 auf einmal.
    splitterGeben(p, 'hundemeute', kostenFuerStufe(2) + kostenFuerStufe(3));
    expect(aufsteigen(p, 'hundemeute')).toBe(2);
    expect(b.level).toBe(4);
    expect(b.splitter).toBe(0);
  });

  it('haelt Restsplitter fuer die naechste Stufe', () => {
    const p = profilAnlegen(1);
    p.karten['snake'] = { level: 1, splitter: 0 };
    splitterGeben(p, 'snake', kostenFuerStufe(1) + 1);
    aufsteigen(p, 'snake');
    expect(p.karten['snake']!.level).toBe(2);
    expect(p.karten['snake']!.splitter).toBe(1);
  });

  it('nimmt am Hoechstlevel keine Splitter mehr an', () => {
    const p = profilAnlegen(1);
    p.karten['bogenschuetzin'] = { level: LEVEL.max, splitter: 0 };
    expect(splitterGeben(p, 'bogenschuetzin', 99)).toBe(0);
    expect(p.karten['bogenschuetzin']!.splitter).toBe(0);
    expect(aufsteigen(p, 'bogenschuetzin')).toBe(0);
    expect(stufenFortschritt(p.karten['bogenschuetzin']!)).toBe(1000);
  });

  it('zeigt den Fortschritt zur naechsten Stufe', () => {
    const b = { level: 1, splitter: 1 };
    expect(stufenFortschritt(b)).toBe(Math.trunc(1000 / kostenFuerStufe(1)));
  });
});

describe('Startpaket', () => {
  it('gibt genau einmal zehn Rolls', () => {
    const p = profilAnlegen(3);
    expect(erstpaketVergeben(p)).toBe(true);
    expect(p.rolls).toBe(ROLL.erstpaket);
    expect(erstpaketVergeben(p)).toBe(false);
    expect(p.rolls).toBe(ROLL.erstpaket);
  });

  it('reicht bei jedem Seed fuer ein spielbares Deck', () => {
    /* Ueber viele Startseeds, nicht nur einen: der erste Eindruck
       darf nicht vom Zufall abhaengen. Ohne den Anfaengerschutz in
       roll.ts faellt hier rund jeder dritte Durchlauf durch. */
    for (let seed = 1; seed <= 300; seed++) {
      const p = profilAnlegen(seed * 7919);
      erstpaketVergeben(p);
      rollsZiehen(p, ROLL.erstpaket);
      deckAuffuellen(p, (id) => karteVon(id)!.elixir);
      expect(deckGueltig(p), 'Seed ' + seed).toBe(true);
    }
  });
});

describe('Trophaeen', () => {
  it('vergibt Punkte nach Ausgang', () => {
    const p = profilAnlegen(1);
    p.trophaeen = 500;
    expect(matchVerbuchen(p, 'sieg', [1, 0], 0).trophaeen).toBe(TROPHAEEN.sieg);
    expect(p.trophaeen).toBe(500 + TROPHAEEN.sieg);
    matchVerbuchen(p, 'niederlage', [0, 1], 0);
    expect(p.trophaeen).toBe(500 + TROPHAEEN.sieg + TROPHAEEN.niederlage);
  });

  it('faellt nicht unter null', () => {
    const p = profilAnlegen(1);
    p.trophaeen = 10;
    matchVerbuchen(p, 'niederlage', [0, 1], 0);
    expect(p.trophaeen).toBe(TROPHAEEN.min);
  });

  it('gibt auch bei einer Niederlage einen Roll', () => {
    const p = profilAnlegen(1);
    expect(matchVerbuchen(p, 'niederlage', [0, 1], 0).rolls).toBe(ROLL.proMatch);
    expect(matchVerbuchen(p, 'sieg', [1, 0], 0).rolls)
      .toBe(ROLL.proMatch + ROLL.bonusSieg);
  });

  it('merkt sich den Hoechststand', () => {
    const p = profilAnlegen(1);
    matchVerbuchen(p, 'sieg', [3, 0], 0);
    const hoch = p.trophaeen;
    matchVerbuchen(p, 'niederlage', [0, 3], 0);
    expect(p.trophaeen).toBeLessThan(hoch);
    expect(p.bestwert).toBe(hoch);
  });

  it('haelt die Historie auf der vereinbarten Laenge', () => {
    const p = profilAnlegen(1);
    for (let i = 0; i < TROPHAEEN.historie + 12; i++) {
      matchVerbuchen(p, 'sieg', [1, 0], i);
    }
    expect(p.historie.length).toBe(TROPHAEEN.historie);
    // Neueste zuerst.
    expect(p.historie[0]!.zeit).toBeGreaterThan(p.historie[1]!.zeit);
  });
});

describe('Deck', () => {
  it('erkennt ein unvollstaendiges Deck', () => {
    const p = profilAnlegen(1);
    expect(deckGueltig(p)).toBe(false);
  });

  it('weist Karten ab, die man nicht besitzt', () => {
    const p = profilAnlegen(1);
    p.deck = KARTEN_IDS.slice(0, 8);
    expect(deckGueltig(p)).toBe(false);
  });

  it('weist Doppelte ab', () => {
    const p = profilAnlegen(1);
    for (const id of KARTEN_IDS) p.karten[id] = { level: 1, splitter: 0 };
    p.deck = [KARTEN_IDS[0]!, ...KARTEN_IDS.slice(0, 7)];
    expect(deckGueltig(p)).toBe(false);
  });

  it('wirft beim Auffuellen fremde Karten heraus', () => {
    const p = profilAnlegen(1);
    for (const id of KARTEN_IDS.slice(0, 10)) {
      p.karten[id] = { level: 1, splitter: 0 };
    }
    p.deck = ['gibtesnicht', KARTEN_IDS[0]!, KARTEN_IDS[0]!];
    deckAuffuellen(p, (id) => karteVon(id)?.elixir ?? 9);
    expect(p.deck.length).toBe(8);
    expect(new Set(p.deck).size).toBe(8);
    expect(deckGueltig(p)).toBe(true);
  });

  it('liefert die Level als flache Tabelle fuer die Sim', () => {
    const p = profilAnlegen(1);
    p.karten['hundemeute'] = { level: 3, splitter: 1 };
    expect(levelTabelle(p)['hundemeute']).toBe(3);
  });
});

describe('Speichern', () => {
  function ablage(): Ablage {
    const daten = new Map<string, string>();
    return {
      getItem: (k) => daten.get(k) ?? null,
      setItem: (k, v) => { daten.set(k, v); },
      removeItem: (k) => { daten.delete(k); },
    };
  }

  it('sichert und laedt unveraendert', () => {
    const s = speicherAnlegen(ablage());
    const p = profilAnlegen(42);
    p.trophaeen = 777;
    p.karten['hundemeute'] = { level: 3, splitter: 5 };
    s.sichern(p);
    const zurueck = s.laden(1)!;
    expect(zurueck.trophaeen).toBe(777);
    expect(zurueck.karten['hundemeute']).toEqual({ level: 3, splitter: 5 });
    expect(zurueck.id).toBe(p.id);
  });

  it('kommt ohne Ablage aus', () => {
    const s = speicherAnlegen(null);
    expect(s.laden(1)).toBeNull();
    // Darf nicht werfen.
    s.sichern(profilAnlegen(1));
    s.leeren();
  });

  it('ueberlebt kaputte Daten', () => {
    const a = ablage();
    a.setItem('arena.profil.v1', '{das ist kein json');
    expect(speicherAnlegen(a).laden(1)).toBeNull();
  });

  it('repariert unsinnige Werte beim Laden', () => {
    const kaputt = {
      trophaeen: -50, rolls: 'viele', karten: { hundemeute: { level: 99, splitter: -3 } },
      deck: [1, 2, 'hundemeute'], rng: { a: 0, b: 0, c: 0, d: 0 },
    };
    const p = profilPruefen(kaputt, 5);
    expect(p.trophaeen).toBe(0);
    expect(p.rolls).toBe(0);
    expect(p.karten['hundemeute']).toEqual({ level: LEVEL.max, splitter: 0 });
    expect(p.deck).toEqual(['hundemeute']);
    // Der Nullzustand des Generators wurde ersetzt.
    expect(p.rng.a | p.rng.b | p.rng.c | p.rng.d).not.toBe(0);
  });

  it('laesst einen Stand von aussen gewinnen', () => {
    const s = speicherAnlegen(ablage());
    const lokal = profilAnlegen(1);
    lokal.trophaeen = 9999;
    s.sichern(lokal);

    const vomServer = { ...profilAnlegen(2), trophaeen: 100 };
    const danach = s.uebernehmen(vomServer, 3);
    expect(danach.trophaeen).toBe(100);
    expect(s.laden(4)!.trophaeen).toBe(100);
  });
});

describe('Sammlungsstand', () => {
  it('zaehlt Besitz und Stufen', () => {
    const p = profilAnlegen(1);
    p.karten['hundemeute'] = { level: 3, splitter: 0 };
    p.karten['rattenschar'] = { level: 2, splitter: 0 };
    const stand = sammlungsStand(p, KARTEN_IDS);
    expect(stand.besessen).toBe(2);
    expect(stand.gesamt).toBe(KARTEN_IDS.length);
    expect(stand.stufenSumme).toBe(5);
  });

  it('findet die hoechste Seltenheit einer Ziehung', () => {
    expect(hoechsteSeltenheit([
      { kartenId: 'a', seltenheit: 'gewoehnlich', neu: true, splitter: 0, durchPity: null },
      { kartenId: 'b', seltenheit: 'episch', neu: true, splitter: 0, durchPity: null },
      { kartenId: 'c', seltenheit: 'selten', neu: true, splitter: 0, durchPity: null },
    ])).toBe('episch');
  });
});
