/* ------------------------------------------------------------------
   Profil sichern und laden.

   Lokal geht das in den localStorage. Der ist manipulierbar, und das
   ist bewusst hingenommen: wer offline gegen einen Bot spielt und
   sich Karten schenkt, betruegt niemanden.

   Sobald ein Konto online existiert, gilt eine harte Regel: der
   Serverstand ueberschreibt den lokalen, nie umgekehrt. Deshalb hat
   `Speicher` bereits zwei getrennte Wege - `sichern` fuer den lokalen
   Stand und `uebernehmen` fuer einen Stand von aussen. Ohne diese
   Trennung wuerde spaeter irgendwo ein lokaler Stand hochgeschrieben.

   Jeder Zugriff ist eingepackt: Safari im privaten Modus wirft beim
   Schreiben, manche Geraete blockieren Speicher ganz. Ein Spiel darf
   daran nicht scheitern - es vergisst dann eben.
   ------------------------------------------------------------------ */

import type { Profil } from './profil.js';
import { profilPruefen } from './profil.js';

export interface Speicher {
  /** Geladenes Profil oder null, wenn nichts Brauchbares da ist. */
  laden(seed: number): Profil | null;
  /** Lokalen Stand schreiben. Fehler werden geschluckt. */
  sichern(p: Profil): void;
  /** Stand von aussen uebernehmen - gewinnt immer gegen den lokalen. */
  uebernehmen(roh: unknown, seed: number): Profil;
  /** Alles loeschen. Fuer den Zuruecksetzen-Knopf in den Optionen. */
  leeren(): void;
}

const SCHLUESSEL = 'arena.profil.v1';

/** Minimale Schnittstelle - so laesst sich der Speicher testen. */
export interface Ablage {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export function speicherAnlegen(ablage: Ablage | null): Speicher {
  return {
    laden(seed: number): Profil | null {
      if (!ablage) return null;
      let text: string | null = null;
      try {
        text = ablage.getItem(SCHLUESSEL);
      } catch {
        return null;
      }
      if (!text) return null;
      try {
        return profilPruefen(JSON.parse(text), seed);
      } catch {
        /* Kaputter Stand. Ihn zu behalten hilft niemandem - beim
           naechsten Sichern wird er ohnehin ueberschrieben. */
        return null;
      }
    },

    sichern(p: Profil): void {
      if (!ablage) return;
      try {
        ablage.setItem(SCHLUESSEL, JSON.stringify(p));
      } catch {
        /* Speicher voll oder gesperrt. Weiterspielen geht trotzdem. */
      }
    },

    uebernehmen(roh: unknown, seed: number): Profil {
      const p = profilPruefen(roh, seed);
      this.sichern(p);
      return p;
    },

    leeren(): void {
      if (!ablage) return;
      try {
        ablage.removeItem(SCHLUESSEL);
      } catch {
        /* Nichts zu machen. */
      }
    },
  };
}

/**
 * Der localStorage des Browsers, wenn er benutzbar ist.
 *
 * Geprueft wird mit einem echten Schreibversuch, nicht mit einer
 * Abfrage auf window.localStorage: das Objekt existiert auch dort, wo
 * jeder Schreibzugriff wirft.
 */
export function browserAblage(): Ablage | null {
  try {
    /* Ueber einen Zwischenschritt, weil dieses Package ohne DOM-Typen
       uebersetzt wird - es laeuft auch im Server. */
    const l = (globalThis as unknown as { localStorage?: Ablage }).localStorage;
    if (!l) return null;
    const probe = '__arena_probe__';
    l.setItem(probe, '1');
    l.removeItem(probe);
    return l;
  } catch {
    return null;
  }
}
