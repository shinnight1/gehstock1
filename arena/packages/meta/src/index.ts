/* ------------------------------------------------------------------
   Fortschritt: Profil, Rolls, Sammlung, Trophaeen.

   Bewusst getrennt von der Simulation. Die Sim weiss nichts davon,
   wie man an Karten kommt, und dieses Package weiss nichts davon,
   wie ein Match ablaeuft. Beruehrungspunkt sind allein die Kartendaten
   und die Balancing-Werte.
   ------------------------------------------------------------------ */

export * from './profil.js';
export * from './sammlung.js';
export * from './roll.js';
export * from './speicher.js';
