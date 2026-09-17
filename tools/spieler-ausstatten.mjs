/* ------------------------------------------------------------------
   Stattet ein Konto in der GehstockMon-Spielerwelt aus: Mons ins
   Besitzregal, Gebiete auf den Namen des Spielers.

   Aufruf:
     node --env-file=.env.local tools/spieler-ausstatten.mjs 5572 \
       --mons sturmhorn,seelenqualle,obsidianrabe,mondhexe --gebiete 2,4,5

     --gold <zahl>  Gold obendrauf
     --probe        schreibt nichts, zeigt nur, was passieren wuerde
     --name <name>  Anzeigename, falls das Konto die Welt noch nie betreten hat
     --wegnehmen    ein Gebiet auch dann uebergeben, wenn es schon einem
                    anderen Spieler gehoert

   Der Zugangscode ist der Schluessel: aus ihm allein leitet der Server
   die Spielerkennung ab. Wer den Code hat, hat den Spielstand.

   Dasselbe geht ohne Kommandozeile im Adminmenue unter 'Geben'. Beide
   Wege benutzen dieselbe Logik und schreiben dasselbe Buch:
   netlify/functions/lib/gehstockmon-schenken.mjs

   Geschrieben wird mit demselben Vergleichen-und-Setzen wie im Spiel.
   Ein Kampf, der waehrend des Aufrufs endet, geht dadurch nicht verloren -
   der Versuch wird abgelehnt und mit dem neuen Stand wiederholt.
   ------------------------------------------------------------------ */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getStore } from '../netlify/functions/lib/speicher.mjs';
import { data as D } from '../netlify/functions/lib/gehstockmon-rules.mjs';
import { schenken } from '../netlify/functions/lib/gehstockmon-schenken.mjs';

const KEY = 'world-v2';

function argumente(argv) {
  const liste = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean);
  const gelesen = { code: '', name: '', mons: [], gebiete: [], gold: 0, probe: false, wegnehmen: false };
  for (let i = 0; i < argv.length; i++) {
    const wert = argv[i + 1];
    if (argv[i] === '--mons') { gelesen.mons = liste(wert); i++; }
    else if (argv[i] === '--gebiete') { gelesen.gebiete = liste(wert).map(Number); i++; }
    else if (argv[i] === '--gold') { gelesen.gold = Number(wert) || 0; i++; }
    else if (argv[i] === '--name') { gelesen.name = String(wert || ''); i++; }
    else if (argv[i] === '--probe') gelesen.probe = true;
    else if (argv[i] === '--wegnehmen') gelesen.wegnehmen = true;
    else if (!argv[i].startsWith('--') && !gelesen.code) gelesen.code = argv[i];
  }
  return gelesen;
}

function zeigen(bericht, probe) {
  const wuerde = probe ? 'wuerde ' : '';
  console.log((bericht.neu ? 'Konto neu angelegt: ' : 'Konto: ') + bericht.name + '  (' + bericht.id + ')');
  if (bericht.mons.length) console.log('  ' + wuerde + 'Mons: ' + bericht.mons.map((id) => D.mon(id).name).join(', '));
  if (bericht.schonDa.length) console.log('  schon vorhanden: ' + bericht.schonDa.map((id) => D.mon(id).name).join(', '));
  if (bericht.gebiete.length) console.log('  ' + wuerde + 'Gebiete: ' + bericht.gebiete.map((id) => id + ' ' + D.FELDER[id - 1].name).join(', '));
  if (bericht.gold) console.log('  ' + wuerde + 'Gold: ' + bericht.gold);
  if (bericht.schonSeine.length) console.log('  gehoerten ihm bereits: ' + bericht.schonSeine.join(', '));
  for (const weg of bericht.genommen) console.log('  ! Gebiet ' + weg.id + ' ' + wuerde + 'wechselt von ' + weg.name);
  if (!bericht.mons.length && !bericht.gebiete.length && !bericht.gold) console.log('  Nichts zu tun.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const gelesen = argumente(process.argv.slice(2));
  if (!gelesen.code) {
    console.log('Aufruf: node --env-file=.env.local tools/spieler-ausstatten.mjs <code> --mons <id,id> --gebiete <1,2>');
    process.exit(1);
  }
  if (!(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL)) {
    console.log('Die Redis-Zugangsdaten fehlen. Erst "vercel env pull .env.local".');
    process.exit(1);
  }
  const store = getStore({ name: 'hgh-gehstockmon' });
  let geschrieben = false;
  for (let versuch = 0; versuch < 8 && !geschrieben; versuch++) {
    const eintrag = await store.getWithMetadata(KEY);
    if (!eintrag) { console.log('Es gibt noch keine Spielerwelt. Einmal GehstockMon oeffnen, dann erneut versuchen.'); process.exit(1); }
    const welt = JSON.parse(JSON.stringify(eintrag.data));
    let bericht;
    try { bericht = schenken(welt, { ...gelesen, now: Date.now(), von: { name: 'Kommandozeile' }, quelle: 'Werkzeug' }); }
    catch (e) { console.log(e.message + (/gehört/.test(e.message) ? ' Mit --wegnehmen trotzdem übergeben.' : '')); process.exit(1); }
    zeigen(bericht, gelesen.probe);
    if (gelesen.probe) { console.log('\nProbe - nichts geschrieben.'); process.exit(0); }
    if (!bericht.mons.length && !bericht.gebiete.length && !bericht.gold) process.exit(0);
    geschrieben = (await store.setJSON(KEY, welt, { onlyIfMatch: eintrag.etag })).modified;
    if (!geschrieben) console.log('  Die Welt hat sich zwischendurch geaendert - neuer Versuch.');
  }
  if (!geschrieben) { console.log('\nDie Welt wird gerade staendig veraendert. Spaeter erneut versuchen.'); process.exit(1); }
  console.log('\nGeschrieben. Beim naechsten Laden ist alles da.');
}
