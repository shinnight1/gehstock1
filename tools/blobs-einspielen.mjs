/* Spielt eine Sicherung aus der Netlify-Zeit in den neuen Speicher ein. */
import fs from 'node:fs';
import { getStore } from '../netlify/functions/lib/speicher.mjs';

const datei = process.argv[2];
if (!datei) { console.error('Aufruf: node --env-file=.env.local tools/blobs-einspielen.mjs <datei>'); process.exit(1); }
if (!(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL)) {
  console.error('Die Redis-Zugangsdaten fehlen. Erst "vercel env pull .env.local".'); process.exit(1);
}

const alles = JSON.parse(fs.readFileSync(datei, 'utf8'));
for (const [name, eintraege] of Object.entries(alles)) {
  const st = getStore({ name });
  let n = 0;
  for (const [key, wert] of Object.entries(eintraege)) {
    if (wert === null || wert === undefined) continue;
    const r = await st.setJSON(key, wert);
    if (!r.modified) console.warn('  NICHT geschrieben: ' + name + ' / ' + key);
    else n++;
  }
  console.log(name + ': ' + n + ' Eintraege geschrieben');
}

/* Gegenprobe: die Spielerwelt zurueckholen und nachzaehlen. */
const zurueck = await getStore({ name: 'hgh-gehstockmon' }).getWithMetadata('world-v2');
if (!zurueck) { console.error('\nFEHLER: world-v2 laesst sich nicht zuruecklesen.'); process.exit(1); }
const w = zurueck.data;
console.log('\nGegenprobe aus der neuen Datenbank:');
console.log('  ' + Object.keys(w.players || {}).length + ' Spieler, Version ' + w.version + ', '
  + (w.territories || []).filter((t) => t.ownerId).length + ' vergebene Gebiete');
for (const p of Object.values(w.players || {})) console.log('    ' + p.name + ' - ' + p.gold + ' Gold, ' + (p.besitz || []).length + ' Mons');
