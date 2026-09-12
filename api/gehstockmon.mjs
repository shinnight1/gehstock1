/* Vercel findet Funktionen unter api/. Der Code selbst bleibt dort, wo
   Netlify ihn erwartet - so laeuft ein Stand auf beiden Plattformen und
   der Rueckfallweg bleibt offen. */
export { default } from '../netlify/functions/gehstockmon.mjs';
