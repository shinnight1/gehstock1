/* ------------------------------------------------------------------
   Der Spiegel bei Deno Deploy.

   Dieselbe Seite, dieselbe Spielerwelt, andere Adresse. Gedacht fuer
   Netze, die vercel.app sperren - etwa das Schul-WLAN.

   Eigene Logik bringt er keine mit. Die beiden Serverfunktionen sind
   dieselben Dateien, die auch Vercel ausliefert: sie nehmen ein
   Request und geben ein Response zurueck, und mehr braucht Deno.serve
   nicht. Auch die Spielerwelt ist dieselbe - steht
   UPSTASH_REDIS_REST_URL in der Umgebung, greift speicher.mjs auf das
   bestehende Redis zu. Fehlt sie, liefe der Spiegel auf einer eigenen,
   leeren Welt, und dann waere er keiner mehr.

   Die Kopfzeilen unten sind die aus vercel.json noch einmal. Zwei
   Listen, die auseinanderlaufen koennen, sind ein Risiko; es ist der
   Preis dafuer, dass jeder Anbieter sie in seinem eigenen Format will.
   ------------------------------------------------------------------ */

import { serveDir } from 'jsr:@std/http@^1/file-server';
import { join } from 'jsr:@std/path@^1';

import room from '../netlify/functions/room.mjs';
import gehstockmon from '../netlify/functions/gehstockmon.mjs';
import auth from '../netlify/functions/auth.mjs';

/* import.meta.dirname ist gesetzt, solange die Datei von der Platte
   kommt - lokal wie bei Deno Deploy. Der Rueckfall auf den
   Arbeitsordner ist nur dafuer da, dass ein fehlendes dirname nicht
   beim ersten Aufruf in einen Absturz laeuft. */
const DIST = import.meta.dirname ? join(import.meta.dirname, '..', 'dist') : 'dist';

/* Dieselben drei Endpunkte, die auch unter api/ fuer Vercel liegen. Kommt
   dort einer dazu, muss er hier mit - sonst fehlt er stillschweigend nur
   auf dem Spiegel. */
const ROUTEN = {
  '/api/room': room,
  '/api/gehstockmon': gehstockmon,
  '/api/auth': auth,
};

const JAHR = 'public, max-age=31536000, immutable';
const FRISCH = 'public, max-age=0, must-revalidate';

function kopfzeilen(pfad) {
  const k = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  };

  if (pfad.startsWith('/offline/')) {
    /* Die Offline-Einzeldatei soll heruntergeladen und nie angezeigt werden. */
    k['Content-Disposition'] = 'attachment';
    k['Cache-Control'] = FRISCH;
  } else if (pfad.startsWith('/assets/') || pfad.startsWith('/games/arena/bundle/')) {
    /* Gehashte Bundles duerfen ewig im Cache bleiben. */
    k['Cache-Control'] = JAHR;
  } else if (pfad === '/' || pfad === '/index.html' || pfad === '/sw.js') {
    k['Cache-Control'] = FRISCH;
  }

  return k;
}

/* Deno Deploy sucht sich den Port selbst; PORT ist nur dafuer da, den
   Spiegel lokal danebenlaufen zu lassen. */
const port = Number(Deno.env.get('PORT') || 8000);

Deno.serve({ port }, async (req) => {
  const pfad = new URL(req.url).pathname;

  const funktion = ROUTEN[pfad];
  if (funktion) return await funktion(req);

  const antwort = await serveDir(req, { fsRoot: DIST, quiet: true });

  /* serveDir baut die Antwort selbst; die Kopfzeilen kommen erst hier
     darauf. Der Umweg ueber new Response ist noetig, weil die
     Kopfzeilen einer fertigen Antwort nicht in jedem Fall
     beschreibbar sind. */
  const fertig = new Response(antwort.body, antwort);
  for (const [name, wert] of Object.entries(kopfzeilen(pfad))) {
    fertig.headers.set(name, wert);
  }
  return fertig;
});
