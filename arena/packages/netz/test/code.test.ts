import { describe, it, expect } from 'vitest';
import { codeErzeugen, codeGueltig, codeSaeubern, tokenErzeugen } from '../src/code.js';
import { nachrichtLesen } from '../src/protokoll.js';

describe('Raumcode', () => {
  it('erzeugt immer sechs Ziffern', () => {
    for (let i = 0; i < 500; i++) {
      const code = codeErzeugen(() => false);
      expect(code).not.toBeNull();
      expect(codeGueltig(code)).toBe(true);
    }
  });

  it('faengt die Raender des Zufalls ab', () => {
    // Math.random() liefert 0 bis knapp unter 1 - beide Enden muessen gehen.
    expect(codeErzeugen(() => false, () => 0)).toBe('100000');
    expect(codeErzeugen(() => false, () => 0.9999999999)).toBe('999999');
  });

  it('weicht belegten Codes aus', () => {
    const belegt = new Set(['100000', '100001']);
    let n = 0;
    const zufall = (): number => {
      // Erst zwei belegte anbieten, dann einen freien.
      const werte = [0, 0.000001, 0.5];
      return werte[Math.min(n++, 2)]!;
    };
    const code = codeErzeugen((c) => belegt.has(c), zufall);
    expect(belegt.has(code!)).toBe(false);
  });

  it('gibt auf, wenn nichts frei ist', () => {
    expect(codeErzeugen(() => true, Math.random, 5)).toBeNull();
  });

  it('erkennt Unfug', () => {
    expect(codeGueltig('12345')).toBe(false);
    expect(codeGueltig('1234567')).toBe(false);
    expect(codeGueltig('12a456')).toBe(false);
    expect(codeGueltig(123456)).toBe(false);
    expect(codeGueltig(null)).toBe(false);
  });

  it('raeumt abgelesene Eingaben auf', () => {
    expect(codeSaeubern(' 123 456 ')).toBe('123456');
    expect(codeSaeubern('123-456')).toBe('123456');
    expect(codeSaeubern('1234567890')).toBe('123456');
  });
});

describe('Token', () => {
  it('sind einzeln und nicht kurz', () => {
    const gesehen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const t = tokenErzeugen();
      expect(t.length).toBeGreaterThanOrEqual(16);
      expect(gesehen.has(t)).toBe(false);
      gesehen.add(t);
    }
  });
});

describe('Nachricht lesen', () => {
  it('nimmt an, was ein Typfeld hat', () => {
    expect(nachrichtLesen('{"t":"ping","zeit":1}')).toEqual({ t: 'ping', zeit: 1 });
  });

  it('verwirft alles andere', () => {
    /* Was ueber das Netz kommt, ist erst einmal unbekannter Text.
       Faellt es hier durch, wird es gar nicht erst bedient. */
    expect(nachrichtLesen('kein json')).toBeNull();
    expect(nachrichtLesen('null')).toBeNull();
    expect(nachrichtLesen('42')).toBeNull();
    expect(nachrichtLesen('[]')).toBeNull();
    expect(nachrichtLesen('{"ohne":"typ"}')).toBeNull();
    expect(nachrichtLesen('{"t":5}')).toBeNull();
  });

  it('lehnt zu lange Nachrichten ab, ohne sie zu lesen', () => {
    const riesig = '{"t":"zug","fuell":"' + 'x'.repeat(5000) + '"}';
    expect(nachrichtLesen(riesig, 1000)).toBeNull();
  });
});
