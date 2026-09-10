/* ------------------------------------------------------------------
   Das Messwerkzeug zu einer Datei buendeln.

   Denselben Grund wie beim Server: @arena/sim zeigt mit `main` auf
   seine TypeScript-Quellen, und Node kann die nicht lesen - es findet
   die `.js`-Endungen in den Importen nicht wieder. Ein Buendel loest
   das an der Wurzel.
   ------------------------------------------------------------------ */

import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    ssr: 'tools/turnier.ts',
    outDir: 'tools/bau',
    emptyOutDir: true,
    target: 'node20',
    minify: false,
    sourcemap: false,
    rollupOptions: { output: { format: 'esm', entryFileNames: 'turnier.js' } },
  },
});
