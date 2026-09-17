/* ------------------------------------------------------------------
   Stattet ein Konto in der GehstockMon-Spielerwelt aus: Mons ins
   Besitzregal, Gebiete auf den Namen des Spielers.

   Aufruf:
     node --env-file=.env.local tools/spieler-ausstatten.mjs 5572 \
       --mons sturmhorn,seelenqualle,obsidianrabe,mondhexe --gebiete 2,4,5

     --probe        schreibt nichts, zeigt nur, was passieren wuerde
     --name <name>  Anzeigename, falls das Konto die Welt noch nie betreten hat
     --wegnehmen    ein Gebiet auch dann uebergeben, wenn es schon einem
                    anderen Spieler gehoert

   Der Zugangscode ist der Schluessel: aus ihm allein leitet der Server
   die Spielerkennung ab. Wer den Code hat, hat den Spielstand.

   Geschrieben wird mit demselben Vergleichen-und-Setzen wie im Spiel.
   Ein Kampf, der waehrend des Aufrufs endet, geht dadurch nicht verloren -
   der Versuch wird abgelehnt und mit dem neuen Stand wiederholt.
   ------------------------------------------------------------------ */

import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getStore } from '../netlify/functions/lib/speicher.mjs';
import { data as D, economy as E, adventure as X } from '../netlify/functions/lib/gehstockmon-rules.mjs';

const KEY = 'world-v2';

/* Dieselbe Ableitung wie in netlify/functions/gehstockmon.mjs. Weicht sie
   ab, landet das Geschenk bei einem Spieler, den es nicht gibt. */
export const spielerId = (code) => createHash('sha256').update('gehstockmon-player:' + code).digest('hex').slice(0, 24);

export function ausstatten(welt, { code, name = '', mons = [], gebiete = [], now = Date.now(), wegnehmen = false }) {
  if (!/^\d{4}$/.test(String(code))) throw new Error('Der Zugangscode besteht aus vier Ziffern.');
  /* Eine alte Karte wird beim naechsten Spielzug umgerechnet, und dabei
     wandern Gebiete. Erst spielen, dann verschenken. */
  if (welt.mapVersion !== D.MAP_VERSION) throw new Error('Die gespeicherte Welt steht auf Karte ' + welt.mapVersion + ', das Spiel auf ' + D.MAP_VERSION + '. Einmal GehstockMon oeffnen, dann erneut versuchen.');

  const unbekannt = mons.filter((id) => !D.mon(id));
  if (unbekannt.length) throw new Error('Diese Mons gibt es nicht: ' + unbekannt.join(', '));
  const daneben = gebiete.filter((id) => !D.FELDER.some((f) => f.id === id));
  if (daneben.length) throw new Error('Diese Gebiete gibt es nicht: ' + daneben.join(', ') + ' (1 bis ' + D.FELDER.length + ').');

  const id = spielerId(String(code)), bericht = { id, neu: false, name: '', mons: [], schonDa: [], gebiete: [], schonSeine: [], genommen: [] };
  let p = welt.players[id];
  if (!p) { p = welt.players[id] = { ...D.neuerStand(null, now), name: name || 'Wanderer', lastSeen: now, lastOfflineLoss: 0 }; bericht.neu = true; }
  bericht.name = p.name;

  for (const monId of mons) {
    if (p.besitz.includes(monId)) { bericht.schonDa.push(monId); continue; }
    p.besitz.push(monId); bericht.mons.push(monId);
  }

  for (const gebietId of gebiete) {
    const t = welt.territories[gebietId - 1];
    if (t.ownerId === id) { bericht.schonSeine.push(gebietId); continue; }
    const vorbesitzer = t.ownerId ? welt.players[t.ownerId] : null;
    if (vorbesitzer && !wegnehmen) throw new Error('Gebiet ' + gebietId + ' (' + D.FELDER[gebietId - 1].name + ') gehoert ' + vorbesitzer.name + '. Mit --wegnehmen trotzdem uebergeben.');
    if (vorbesitzer) {
      vorbesitzer.geschafft = (vorbesitzer.geschafft || []).filter((v) => v !== gebietId);
      if (vorbesitzer.outposts) delete vorbesitzer.outposts[gebietId];
      bericht.genommen.push({ id: gebietId, name: vorbesitzer.name });
    }
    /* Ausbaustufe bleibt am Gebiet, genau wie bei einer Eroberung im Spiel. */
    const stufe = t.level;
    Object.assign(t, E.outpost(null, now), { level: stufe, ownerId: id, ownerName: p.name,
      defense: p.truppe.map((monId) => ({ id: monId, upgrade: X.mon(p, monId).upgrade })), version: (t.version || 1) + 1 });
    if (!p.geschafft.includes(gebietId)) p.geschafft.push(gebietId);
    p.outposts[gebietId] = E.outpost(t, now);
    bericht.gebiete.push(gebietId);
  }

  if (bericht.mons.length || bericht.gebiete.length) welt.version = (welt.version || 1) + 1;
  return bericht;
}

function argumente(argv) {
  const liste = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean);
  const gelesen = { code: '', name: '', mons: [], gebiete: [], probe: false, wegnehmen: false };
  for (let i = 0; i < argv.length; i++) {
    const wert = argv[i + 1];
    if (argv[i] === '--mons') { gelesen.mons = liste(wert); i++; }
    else if (argv[i] === '--gebiete') { gelesen.gebiete = liste(wert).map(Number); i++; }
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
  if (bericht.schonSeine.length) console.log('  gehoerten ihm bereits: ' + bericht.schonSeine.join(', '));
  for (const weg of bericht.genommen) console.log('  ! Gebiet ' + weg.id + ' ' + wuerde + 'wechselt von ' + weg.name);
  if (!bericht.mons.length && !bericht.gebiete.length) console.log('  Nichts zu tun.');
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
    try { bericht = ausstatten(welt, { ...gelesen, now: Date.now() }); }
    catch (e) { console.log(e.message); process.exit(1); }
    zeigen(bericht, gelesen.probe);
    if (gelesen.probe) { console.log('\nProbe - nichts geschrieben.'); process.exit(0); }
    if (!bericht.mons.length && !bericht.gebiete.length) process.exit(0);
    geschrieben = (await store.setJSON(KEY, welt, { onlyIfMatch: eintrag.etag })).modified;
    if (!geschrieben) console.log('  Die Welt hat sich zwischendurch geaendert - neuer Versuch.');
  }
  if (!geschrieben) { console.log('\nDie Welt wird gerade staendig veraendert. Spaeter erneut versuchen.'); process.exit(1); }
  console.log('\nGeschrieben. Beim naechsten Laden ist alles da.');
}
