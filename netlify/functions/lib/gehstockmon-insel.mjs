/* ------------------------------------------------------------------
   Die Insel als Ganzes, Serverseite: das Wetter der Woche und das
   Rathaus mit Buergermeisterwahl und Erlass.

   Die Regeln stehen in src/games/gehstockmon/2-insel.js. Hier steht, was
   die Spielerwelt veraendert, und die eine Funktion, ueber die jeder Zug
   nach dem Faktor der Woche fragt: effekt(world, now, schluessel).
   ------------------------------------------------------------------ */
import { adventure as X } from './gehstockmon-rules.mjs';
import { tickern } from './gehstockmon-alltag.mjs';

const fail = (message) => { throw new Error(message); };

/* Das Rathaus: laufende Wahl, das Amt dieser Woche und die Chronik. */
export function rathaus(world) {
  if (!world.rathaus || typeof world.rathaus !== 'object') world.rathaus = { woche: null, kandidaten: {}, stimmen: {}, amt: null, chronik: [] };
  const r = world.rathaus;
  if (!r.kandidaten || typeof r.kandidaten !== 'object') r.kandidaten = {};
  if (!r.stimmen || typeof r.stimmen !== 'object') r.stimmen = {};
  if (!Array.isArray(r.chronik)) r.chronik = [];
  return r;
}
/* Der Erlass, der gerade gilt - nur in der Woche, fuer die er gewaehlt wurde. */
export function aktuellerErlass(world, now) {
  const amt = world.rathaus && world.rathaus.amt;
  return amt && amt.woche === X.zerhackerWoche(now) ? amt.erlass : null;
}
export function effekt(world, now, schluessel) {
  return X.effekt(now, aktuellerErlass(world, now), schluessel);
}
/* Wer diese Woche Buergermeister ist - fuer den Titel unter dem Namen. */
export function amtTitel(world, id, now) {
  const amt = world.rathaus && world.rathaus.amt;
  return amt && amt.id === id && amt.woche === X.zerhackerWoche(now) ? 'Bürgermeister' : null;
}
/* Die Auszaehlung beim Wochenwechsel: die meisten Stimmen gewinnen, bei
   Gleichstand wer sich frueher aufgestellt hat. Nur wer noch in der Welt
   ist, zaehlt - als Kandidat und als Waehler. */
function wahlAuswerten(world, now) {
  const r = rathaus(world), woche = X.zerhackerWoche(now);
  if (r.woche === woche) return;
  const zaehlung = {};
  for (const [waehler, kandidat] of Object.entries(r.stimmen)) {
    if (world.players[waehler] && r.kandidaten[kandidat] && world.players[kandidat]) zaehlung[kandidat] = (zaehlung[kandidat] || 0) + 1;
  }
  /* Die Anmeldenummer entscheidet einen Gleichstand - die Uhrzeit allein kann gleich sein. */
  const reihe = (k) => r.kandidaten[k].nr || 0;
  const sieger = Object.keys(zaehlung).sort((a, b) => zaehlung[b] - zaehlung[a] || reihe(a) - reihe(b))[0];
  if (r.woche !== null && sieger) {
    const p = world.players[sieger], e = X.erlass(r.kandidaten[sieger].erlass);
    r.amt = { id: sieger, name: p.name, erlass: e.id, woche, stimmen: zaehlung[sieger], kandidaten: Object.keys(r.kandidaten).length };
    r.chronik = r.chronik.concat({ name: p.name, erlass: e.name, woche, stimmen: zaehlung[sieger] }).slice(-10);
    tickern(world, '👑 ' + p.name + ' ist Bürgermeister dieser Woche (' + zaehlung[sieger] + (zaehlung[sieger] === 1 ? ' Stimme' : ' Stimmen') + '). Erlass: '
      + e.zeichen + ' ' + e.name + ' - ' + e.text, 'wahl', now, sieger);
  } else if (r.woche !== null && Object.keys(r.kandidaten).length) {
    tickern(world, '🏛️ Niemand hat gewählt - die Insel bleibt diese Woche ohne Bürgermeister.', 'wahl', now);
  }
  r.woche = woche; r.kandidaten = {}; r.stimmen = {};
}
/* Der Wochenwechsel der Insel: erst die Wahl, dann das neue Wetter im
   Ticker. Laeuft vor dem Schreiben, wie Zerhacker und Wochenaufgabe. */
export function inselWoche(world, now) {
  const woche = X.zerhackerWoche(now);
  wahlAuswerten(world, now);
  if (world.insel && world.insel.woche === woche) return world.insel;
  world.insel = { woche };
  const w = X.wetter(now);
  tickern(world, w.zeichen + ' Neue Woche, neues Wetter: ' + w.name + '. ' + w.text, 'wetter', now);
  return world.insel;
}
function wetterSicht(w) { return { id: w.id, name: w.name, zeichen: w.zeichen, text: w.text, farbe: w.farbe }; }
function erlassSicht(e) { return e ? { id: e.id, name: e.name, zeichen: e.zeichen, text: e.text } : null; }
/* Was der Browser sehen darf: Wetter jetzt und naechste Woche, der Erlass,
   die Faktoren der Woche und die Wahl - ohne fremde Stimmen. */
export function inselSicht(world, id, now) {
  const erlassId = aktuellerErlass(world, now), r = rathaus(world), p = world.players[id], recht = X.wahlRecht(p, now);
  const amt = r.amt && r.amt.woche === X.zerhackerWoche(now) ? r.amt : null;
  return { insel: {
    wetter: wetterSicht(X.wetter(now)), naechste: wetterSicht(X.wetterNaechste(now)),
    erlass: erlassSicht(X.erlass(erlassId)), effekte: X.effekte(now, erlassId),
    rathaus: {
      amt: amt ? { name: amt.name, selbst: amt.id === id, stimmen: amt.stimmen, erlass: erlassSicht(X.erlass(amt.erlass)) } : null,
      kandidaten: Object.entries(r.kandidaten).filter(([kid]) => world.players[kid]).sort((a, b) => (a[1].nr || 0) - (b[1].nr || 0))
        .map(([kid, k]) => ({ id: kid, name: world.players[kid].name, selbst: kid === id, erlass: erlassSicht(X.erlass(k.erlass)) })),
      meineStimme: r.stimmen[id] || null, abgegeben: Object.keys(r.stimmen).length,
      recht: { stimme: recht.stimme, kandidat: recht.kandidat, fehlt: recht.fehlt, kandidatFehlt: recht.kandidatFehlt },
      chronik: r.chronik.slice(-6).reverse()
    } } };
}
/* Kandidieren und Waehlen. */
export function inselAction({ world, p, id, body, now }) {
  const op = body.op, extra = {};
  if (!X.WAHL_OPS.includes(op)) return extra;
  const r = rathaus(world), recht = X.wahlRecht(p, now);
  if (op === 'kandidieren') {
    if (body.erlass === null || body.erlass === '') {
      if (!r.kandidaten[id]) fail('Du kandidierst gerade nicht.');
      delete r.kandidaten[id];
      for (const [waehler, kandidat] of Object.entries(r.stimmen)) if (kandidat === id) delete r.stimmen[waehler];
      extra.message = 'Du hast deine Kandidatur zurückgezogen. Wer dich gewählt hatte, kann neu wählen.';
      return extra;
    }
    const e = X.erlass(body.erlass);
    if (!e) fail('Diesen Erlass gibt es nicht.');
    if (!recht.kandidat) fail('Kandidieren kannst du, sobald du ' + recht.kandidatFehlt.join(', ') + ' hast.');
    if (!r.kandidaten[id] && Object.keys(r.kandidaten).length >= 8) fail('Es kandidieren schon acht - mehr passen nicht auf den Wahlzettel.');
    const neu = !r.kandidaten[id];
    if (neu) r.nummer = (r.nummer || 0) + 1;
    r.kandidaten[id] = { erlass: e.id, seit: neu ? now : r.kandidaten[id].seit, nr: neu ? r.nummer : r.kandidaten[id].nr };
    if (neu) tickern(world, '🗳️ ' + p.name + ' kandidiert fürs Rathaus und verspricht: ' + e.zeichen + ' ' + e.name + '.', 'wahl', now, id);
    extra.message = neu ? 'Du kandidierst. Dein Versprechen: ' + e.name + '. Gewählt wird bis zum Wochenende.' : 'Dein Versprechen lautet jetzt: ' + e.name + '.';
    return extra;
  }
  if (op === 'waehlen') {
    if (!recht.stimme) fail('Wählen kannst du, sobald du ' + recht.fehlt.join(', ') + ' hast.');
    const kandidat = body.kandidatId;
    if (!r.kandidaten[kandidat] || !world.players[kandidat]) fail('Diese Person steht nicht auf dem Wahlzettel.');
    r.stimmen[id] = kandidat;
    extra.message = 'Deine Stimme geht an ' + world.players[kandidat].name + '. Bis zum Wochenende kannst du sie noch ändern - ausgezählt wird am Montag.';
    return extra;
  }
  return extra;
}
