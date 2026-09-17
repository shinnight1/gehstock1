/* ------------------------------------------------------------------
   Schenken: Mons und Aussenposten von Hand vergeben.

   Zwei Wege fuehren hierher, und beide sollen dasselbe tun:

     Adminmenue     -> Op 'admin_grant' in gehstockmon.mjs
     Kommandozeile  -> tools/spieler-ausstatten.mjs

   Darum steht die Logik hier und nicht in einem der beiden. Wer den
   Ablauf aendert, aendert ihn fuer beide.

   Vergeben werden Mons, Aussenposten und Gold.

   Jede Schenkung kommt ins Buch: wer, an wen, was, woher. Sich selbst
   zu beschenken ist erlaubt und faellt genau deshalb auf - im Buch
   stehen Geber und Beschenkter nebeneinander.
   ------------------------------------------------------------------ */

import { createHash } from 'node:crypto';
import { data as D, economy as E, adventure as X } from './gehstockmon-rules.mjs';

/* Dieselbe Ableitung wie im Spielserver. Weicht sie ab, landet das
   Geschenk bei einem Spieler, den es nicht gibt. */
export const spielerId = (code) => createHash('sha256').update('gehstockmon-player:' + code).digest('hex').slice(0, 24);

export const BUCH_LIMIT = 100;

export function schenken(welt, { code, name = '', mons = [], gebiete = [], gold = 0, now = Date.now(), wegnehmen = false, von = null, quelle = 'Adminmenü', id = null }) {
  if (!/^\d{4}$/.test(String(code))) throw new Error('Der Zugangscode besteht aus vier Ziffern.');
  /* Eine alte Karte wird beim naechsten Spielzug umgerechnet, und dabei
     wandern Gebiete. Erst spielen, dann verschenken. */
  if (welt.mapVersion !== D.MAP_VERSION) throw new Error('Die gespeicherte Welt steht auf Karte ' + welt.mapVersion + ', das Spiel auf ' + D.MAP_VERSION + '. Einmal GehstockMon öffnen, dann erneut versuchen.');

  const unbekannt = mons.filter((monId) => !D.mon(monId));
  if (unbekannt.length) throw new Error('Diese Mons gibt es nicht: ' + unbekannt.join(', '));
  const daneben = gebiete.filter((gebietId) => !D.FELDER.some((f) => f.id === gebietId));
  if (daneben.length) throw new Error('Diese Gebiete gibt es nicht: ' + daneben.join(', ') + ' (1 bis ' + D.FELDER.length + ').');

  const ziel = spielerId(String(code));
  const gabe = Math.min(10000000, Math.max(0, Math.floor(Number(gold) || 0)));
  const bericht = { id: ziel, neu: false, name: '', mons: [], schonDa: [], gebiete: [], schonSeine: [], genommen: [], gold: 0 };
  let p = welt.players[ziel];
  if (!p) { p = welt.players[ziel] = { ...D.neuerStand(null, now), name: name || 'Wanderer', lastSeen: now, lastOfflineLoss: 0 }; bericht.neu = true; }
  bericht.name = p.name;

  for (const monId of mons) {
    if (p.besitz.includes(monId)) { bericht.schonDa.push(monId); continue; }
    p.besitz.push(monId); bericht.mons.push(monId);
  }

  for (const gebietId of gebiete) {
    const t = welt.territories[gebietId - 1];
    if (t.ownerId === ziel) { bericht.schonSeine.push(gebietId); continue; }
    const vorbesitzer = t.ownerId ? welt.players[t.ownerId] : null;
    if (vorbesitzer && !wegnehmen) throw new Error('Gebiet ' + gebietId + ' (' + D.FELDER[gebietId - 1].name + ') gehört ' + vorbesitzer.name + '.');
    if (vorbesitzer) {
      vorbesitzer.geschafft = (vorbesitzer.geschafft || []).filter((v) => v !== gebietId);
      if (vorbesitzer.outposts) delete vorbesitzer.outposts[gebietId];
      bericht.genommen.push({ id: gebietId, name: vorbesitzer.name });
    }
    /* Ausbaustufe bleibt am Gebiet, genau wie bei einer Eroberung im Spiel. */
    const stufe = t.level;
    Object.assign(t, E.outpost(null, now), { level: stufe, ownerId: ziel, ownerName: p.name,
      defense: p.truppe.map((monId) => ({ id: monId, upgrade: X.mon(p, monId).upgrade })), version: (t.version || 1) + 1 });
    if (!p.geschafft.includes(gebietId)) p.geschafft.push(gebietId);
    p.outposts[gebietId] = E.outpost(t, now);
    bericht.gebiete.push(gebietId);
  }

  if (gabe) { p.gold = Math.min(10000000, (p.gold || 0) + gabe); bericht.gold = gabe; }

  if (!bericht.mons.length && !bericht.gebiete.length && !bericht.gold) return bericht;

  welt.version = (welt.version || 1) + 1;
  welt.schenkungen = (welt.schenkungen || []).concat({
    id: id || 'schenkung-' + now + '-' + ziel,
    t: now,
    vonId: von && von.id ? von.id : null,
    vonName: (von && von.name) || quelle,
    anId: ziel,
    anName: p.name,
    selbst: !!(von && von.id === ziel),
    mons: bericht.mons.slice(),
    gebiete: bericht.gebiete.slice(),
    gold: bericht.gold,
    genommen: bericht.genommen.slice(),
    quelle: quelle,
  }).slice(-BUCH_LIMIT);
  bericht.eintrag = welt.schenkungen[welt.schenkungen.length - 1];
  return bericht;
}

/* Das Buch, jung zuerst - so liest es sich im Menue. */
export const schenkungen = (welt) => (welt && welt.schenkungen ? welt.schenkungen.slice().reverse() : []);
