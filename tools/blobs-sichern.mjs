/* Holt alles aus den Netlify-Blobs in eine Datei. Laeuft ausserhalb von
   Netlify, deshalb siteID und token von Hand. */
import fs from 'node:fs';
import path from 'node:path';
import { getStore } from '@netlify/blobs';

const siteID = process.env.NETLIFY_SITE_ID;
const token = process.env.NETLIFY_AUTH_TOKEN;
if (!siteID || !token) { console.error('NETLIFY_SITE_ID oder NETLIFY_AUTH_TOKEN fehlt.'); process.exit(1); }

const namen = ['hgh-gehstockmon', 'hgh-gehstockmon-presence', 'hgh-rooms'];
const stempel = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
const ziel = path.resolve('.local', 'blobs-' + stempel + '.json');
const alles = {};

for (const name of namen) {
  const st = getStore({ name, siteID, token, consistency: 'strong' });
  let liste;
  try { liste = await st.list(); }
  catch (e) { console.warn('  ' + name + ' uebersprungen: ' + e.message); continue; }
  alles[name] = {};
  for (const b of liste.blobs) {
    alles[name][b.key] = await st.get(b.key, { type: 'json' });
    console.log('  ' + name + ' / ' + b.key);
  }
  console.log(name + ': ' + liste.blobs.length + ' Eintraege');
}

fs.mkdirSync(path.dirname(ziel), { recursive: true });
fs.writeFileSync(ziel, JSON.stringify(alles, null, 2));

const welt = alles['hgh-gehstockmon'] && alles['hgh-gehstockmon']['world-v2'];
if (welt) {
  console.log('\nSpielerwelt: ' + Object.keys(welt.players || {}).length + ' Spieler, Version ' + welt.version);
  for (const p of Object.values(welt.players || {})) console.log('  ' + p.name + ' - ' + p.gold + ' Gold, ' + (p.besitz || []).length + ' Mons');
} else console.log('\nACHTUNG: world-v2 wurde nicht gefunden.');
console.log('\nGesichert: ' + ziel);