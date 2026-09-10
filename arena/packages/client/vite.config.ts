import { defineConfig } from 'vite';

export default defineConfig({
  /* Relative Pfade: der Build soll unter /games/arena/ genauso laufen
     wie unter / oder in einem iframe. Keine Annahme ueber die Domain
     der Hub-Seite. */
  base: './',
  server: {
    /* --host, damit das iPad ueber die LAN-IP drankommt. */
    host: true,
    port: 5173,
    strictPort: false,
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsDir: 'bundle', // nicht 'assets': dort liegen die nachreichbaren PNGs aus public/
    sourcemap: true,
  },
});
