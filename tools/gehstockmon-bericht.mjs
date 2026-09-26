/* ------------------------------------------------------------------
   Was in der Spielerwelt wirklich passiert - als Grundlage fuer neue Ideen.

   Liest die echte Welt nur und gibt Zahlen aus, keine Namen und keine
   Zugangscodes: Spieler erscheinen hoechstens als "Spieler 1..n". Die
   Ausgabe darf deshalb in einen Chat kopiert werden.

   Aufruf auf dem Handy:
     node --env-file=$HOME/.config/gehstock1/redis.env tools/gehstockmon-bericht.mjs
   ------------------------------------------------------------------ */

import { datenbank } from './datenbank.mjs';
import { data as D } from '../netlify/functions/lib/gehstockmon-rules.mjs';

const r = await datenbank();
if (!r) {
  console.log('Die Zugangsdaten fehlen: --env-file=$HOME/.config/gehstock1/redis.env mitgeben.');
  process.exit(1);
}
const TAG = 86400000, jetzt = Date.now();
const kb = (t) => (Buffer.byteLength(t) / 1024).toFixed(1) + ' KB';
const verteilung = (werte) => {
  const a = werte.filter(Number.isFinite).sort((x, y) => x - y);
  if (!a.length) return '-';
  return 'min ' + a[0] + ' · Median ' + a[Math.floor(a.length / 2)] + ' · max ' + a[a.length - 1];
};
const zeile = (titel, wert) => console.log('  ' + titel.padEnd(34) + wert);

try {
  const weltText = await r.get('hgh:hgh-gehstockmon:world-v2');
  const welt = JSON.parse(weltText);
  const spieler = Object.values(welt.players || {});
  const n = spieler.length;

  console.log('\n== GehstockMon-Welt (' + kb(weltText) + ', Version ' + welt.version + ')');
  console.log('\nGroesse nach Bereich:');
  for (const [k, v] of Object.entries(welt).sort((a, b) => JSON.stringify(b[1]).length - JSON.stringify(a[1]).length).slice(0, 8)) {
    zeile(k, kb(JSON.stringify(v)));
  }
  const feldGroesse = {};
  for (const p of spieler) for (const [k, v] of Object.entries(p)) feldGroesse[k] = (feldGroesse[k] || 0) + JSON.stringify(v ?? null).length;
  console.log('\nGroesste Felder je Spieler (Summe ueber alle):');
  for (const [k, v] of Object.entries(feldGroesse).sort((a, b) => b[1] - a[1]).slice(0, 6)) zeile(k, (v / 1024).toFixed(1) + ' KB');

  console.log('\nAktivitaet (' + n + ' Spieler):');
  const zuletzt = (t) => spieler.filter((p) => jetzt - (p.lastSeen || 0) < t).length;
  zeile('in den letzten 24 Stunden', zuletzt(TAG));
  zeile('in den letzten 7 Tagen', zuletzt(7 * TAG));
  zeile('in den letzten 30 Tagen', zuletzt(30 * TAG));
  zeile('Tage seit Beitritt', verteilung(spieler.map((p) => Math.round((jetzt - (p.joinedAt || jetzt)) / TAG))));
  zeile('Tage seit letztem Besuch', verteilung(spieler.map((p) => Math.round((jetzt - (p.lastSeen || 0)) / TAG))));

  console.log('\nFortschritt:');
  zeile('Gold', verteilung(spieler.map((p) => p.gold)));
  zeile('Essenz', verteilung(spieler.map((p) => p.essenz)));
  zeile('Mons im Besitz', verteilung(spieler.map((p) => (p.besitz || []).length)));
  zeile('Eier im Brutkasten', verteilung(spieler.map((p) => (p.eggs || []).length)));
  zeile('Siege', verteilung(spieler.map((p) => p.siege)));
  zeile('Arena-Siege', verteilung(spieler.map((p) => p.arenaSiege)));
  zeile('Beschwoerungen', verteilung(spieler.map((p) => p.beschwoerungen)));
  zeile('Trainer besiegt', verteilung(spieler.map((p) => p.progress && p.progress.trainerWins)));
  zeile('geschluepft', verteilung(spieler.map((p) => p.progress && p.progress.hatched)));
  zeile('Serie (Tage am Stueck)', verteilung(spieler.map((p) => p.serie && p.serie.zahl)));

  console.log('\nWer nutzt was (Spieler mit mindestens einem Eintrag):');
  const nutzt = (titel, fn) => zeile(titel, spieler.filter((p) => { try { return fn(p); } catch { return false; } }).length + ' von ' + n);
  nutzt('Aussenposten', (p) => Object.keys(p.outposts || {}).length > 0);
  nutzt('Quests abgeschlossen', (p) => (p.claimedQuests || []).length > 0);
  nutzt('Orte besucht', (p) => (p.visited || []).length > 0);
  nutzt('Mon-Verbesserungen', (p) => Object.keys(p.monUpgrades || {}).length > 0);
  nutzt('Ruestungen', (p) => (p.ruestungen || []).length > 0);
  nutzt('weitere Skins', (p) => (p.skins || []).length > 1);
  nutzt('weitere Waffen', (p) => (p.weapons || []).length > 1);
  nutzt('Arena gewonnen', (p) => (p.arenaSiege || 0) > 0);
  nutzt('Champion-Titel', (p) => (p.championTitel || 0) > 0);
  nutzt('schimmernde Mons', (p) => Object.keys(p.schimmernd || {}).length > 0);
  nutzt('Sonder-Eier', (p) => (p.sonderEier || []).length > 0);
  nutzt('Tagesaufgaben (Alltag)', (p) => p.alltag && Object.keys(p.alltag).length > 0);

  console.log('\nSammlung (' + D.KATALOG.length + ' Mons im Katalog):');
  const besitzer = {};
  for (const p of spieler) for (const id of new Set(p.besitz || [])) besitzer[id] = (besitzer[id] || 0) + 1;
  const nie = D.KATALOG.filter((m) => !besitzer[m.id]);
  zeile('von niemandem besessen', nie.length + (nie.length ? ' (' + nie.slice(0, 12).map((m) => m.id).join(', ') + (nie.length > 12 ? ', ...' : '') + ')' : ''));
  const haeufig = Object.entries(besitzer).sort((a, b) => b[1] - a[1]);
  zeile('am haeufigsten', haeufig.slice(0, 6).map(([id, k]) => id + ' ' + k).join(', '));
  const inTruppe = {};
  for (const p of spieler) for (const id of p.truppe || []) inTruppe[id] = (inTruppe[id] || 0) + 1;
  zeile('am oeftesten in der Truppe', Object.entries(inTruppe).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id, k]) => id + ' ' + k).join(', '));

  const gebiete = welt.territories || [];
  const halter = {};
  for (const t of gebiete) if (t.ownerId) halter[t.ownerId] = (halter[t.ownerId] || 0) + 1;
  console.log('\nGebiete (' + gebiete.length + '):');
  zeile('frei', gebiete.filter((t) => !t.ownerId).length);
  zeile('Spieler mit Gebieten', Object.keys(halter).length);
  zeile('Gebiete je Besitzer', Object.values(halter).sort((a, b) => b - a).join(', ') || '-');
  zeile('Meldungen im Weltprotokoll', (welt.reports || []).length);

  console.log('\n== Hideout');
  let cursor = '0'; const keys = [];
  do { const [c, k] = await r.scan(cursor, { match: 'hgh:hgh-rooms:*', count: 500 }); cursor = String(c); keys.push(...k); } while (cursor !== '0');
  const kurz = (k) => k.slice('hgh:hgh-rooms:'.length);
  const verw = JSON.parse(await r.get('hgh:hgh-rooms:verwaltung') || '{}');
  const profile = (verw.daten && verw.daten.profile) || [];
  const rollen = {};
  for (const p of profile) rollen[p.rolle || p.role || '?'] = (rollen[p.rolle || p.role || '?'] || 0) + 1;
  zeile('Profile', profile.length + ' ' + JSON.stringify(rollen));
  const kanaele = keys.filter((k) => /:kanal:/.test(k));
  for (const k of kanaele.sort()) {
    const t = await r.get(k); if (!t) continue;
    let d; try { d = JSON.parse(t); } catch { continue; }
    const msgs = d.nachrichten || d.messages || [];
    const letzte = msgs.length ? Math.max(...msgs.map((m) => m.t || m.zeit || m.at || 0)) : 0;
    zeile('Kanal ' + kurz(k), msgs.length + ' Nachrichten, ' + kb(t) + (letzte ? ', zuletzt vor ' + Math.round((jetzt - letzte) / TAG) + ' Tagen' : ''));
  }
  const bilder = keys.filter((k) => /:bild:/.test(k));
  zeile('hochgeladene Bilder', bilder.length);
  const rest = keys.filter((k) => !/:kanal:|:bild:|:room:|:schirm:/.test(k)).map(kurz);
  zeile('weitere Eintraege', rest.join(', '));
  console.log('');
} finally { r.schliessen(); }
