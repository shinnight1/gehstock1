import { describe, it, expect } from 'vitest';
import { normalisieren } from '../src/netz/adresse.js';

describe('Serveradresse', () => {
  it('laesst fertige WebSocket-Adressen in Ruhe', () => {
    expect(normalisieren('wss://arena.example/ws')).toBe('wss://arena.example/ws');
    expect(normalisieren('ws://192.168.1.20:8081')).toBe('ws://192.168.1.20:8081');
  });

  it('macht aus http ws und aus https wss', () => {
    /* Wer die Adresse aus dem Browser kopiert, hat http davor und
       wundert sich sonst, warum nichts geht. */
    expect(normalisieren('https://arena.example')).toBe('wss://arena.example');
    expect(normalisieren('http://192.168.1.20:8081')).toBe('ws://192.168.1.20:8081');
  });

  it('ergaenzt ein fehlendes Schema', () => {
    expect(normalisieren('192.168.1.20:8081')).toBe('ws://192.168.1.20:8081');
  });

  it('vertraegt Leerzeichen und Leereingabe', () => {
    expect(normalisieren('  ws://a  ')).toBe('ws://a');
    expect(normalisieren('   ')).toBe('');
    expect(normalisieren('')).toBe('');
  });
});
