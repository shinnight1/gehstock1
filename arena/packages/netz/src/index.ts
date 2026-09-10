/* ------------------------------------------------------------------
   Alles, was Client und Server gemeinsam brauchen, um miteinander zu
   reden - und sonst nichts.

   Das Paket haengt bewusst nur an @arena/sim und an keinem Laufzeit-
   Umfeld: kein DOM, kein node:*. Sonst koennte es nicht auf beiden
   Seiten liegen, und das Protokoll waere zweimal beschrieben.
   ------------------------------------------------------------------ */

export * from './protokoll.js';
export * from './code.js';
