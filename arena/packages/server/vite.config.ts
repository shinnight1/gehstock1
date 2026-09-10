/* ------------------------------------------------------------------
   Den Server zu einer einzigen Datei buendeln.

   Warum ueberhaupt buendeln: die Pakete @arena/sim und @arena/netz
   zeigen mit `main` auf ihre TypeScript-Quellen. Das ist fuer Vite und
   Vitest genau richtig - beide lesen TypeScript direkt - aber Node
   kann es nicht: es findet die `.js`-Endungen in den Importen nicht
   wieder, weil dort `.ts`-Dateien liegen.

   Man koennte den Paketen dafuer eine zweite Aufloesung fuer Node
   verpassen. Dann liefe der Server aber gegen einen Stand, der zuletzt
   gebaut wurde, waehrend Client und Tests die Quellen lesen - und
   genau daraus entstehen Fehler, die nur auf einer der beiden Seiten
   auftreten. Ein Buendel loest das an der Wurzel: eine Datei, ein
   Stand, keine Aufloesung zur Laufzeit.

   `ws` und die Node-Bausteine bleiben aussen vor. Sie in das Buendel
   zu ziehen brauchte niemand und macht das Ergebnis nur groesser.
   ------------------------------------------------------------------ */

import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    ssr: 'src/index.ts',
    outDir: 'bau',
    emptyOutDir: true,
    target: 'node20',
    minify: false,
    sourcemap: true,
    rollupOptions: {
      external: ['ws'],
      output: { format: 'esm', entryFileNames: 'index.js' },
    },
  },
});
