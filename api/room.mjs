/* Vercel liefert alles aus dem Ordner api als Endpunkt aus. Die Logik
   bleibt in netlify/functions - dieselbe Datei bedient beide Haeuser. */
import handler from '../netlify/functions/room.mjs';
export const POST = handler;
export const OPTIONS = handler;
export const GET = handler;