/* ------------------------------------------------------------------
   Der Alltag auf der Insel, Serverseite: Tagestruhe, Insel-Ticker,
   Morgenbericht und Revanche.

   Die Regeln selbst (welche Aufgaben, was die Truhe bringt, wie die Serie
   zaehlt) stehen in src/games/gehstockmon/2-alltag.js und gelten im Browser
   genauso. Hier steht nur, was die Spielerwelt veraendert.
   ------------------------------------------------------------------ */
import { data as D, economy as E, hours as H, adventure as X } from './gehstockmon-rules.mjs';

const fail = (message) => { throw new Error(message); };

/* Der Insel-Ticker: was alle angeht - Eroberungen, seltene Schluepfe, neue
   Champions, erlegte Bosse, Serien. Kurz und fuer alle gleich. */
export const TICKER_MAX = 30;
/* 'wer' ist der Spieler, um den es geht - dessen Browser blendet es nicht noch einmal ein. */
export function tickern(world, text, art, now, wer) {
  if (!Array.isArray(world.ticker)) world.ticker = [];
  const letzte = world.ticker[world.ticker.length - 1];
  world.ticker.push({ id: (letzte ? letzte.id : 0) + 1, t: now, art: art || 'info', text, ...(wer ? { wer } : {}) });
  world.ticker = world.ticker.slice(-TICKER_MAX);
}
export function tickerSicht(world) {
  return (Array.isArray(world.ticker) ? world.ticker : []).slice(-12);
}

/* Was der Browser vom heutigen Tag sehen darf. */
export function alltagSicht(p, now) {
  const a = X.alltagStand(p, now), serie = X.serieStand(p, now);
  const offen = H.access(now).open;
  return {
    tag: a.tag,
    aufgaben: X.tagesaufgaben(now).map((t) => ({ id: t.id, text: t.text, ziel: t.ziel, stand: Math.min(t.ziel, a.zaehler[t.id] || 0) })),
    fertig: X.alltagFertig(p, now), truhe: a.truhe, serie, offen,
    lohn: X.truhenLohn(X.serieNachTruhe(p, now)), naechstesEi: X.naechstesSerienEi(a.truhe ? serie : X.serieNachTruhe(p, now) - 1),
  };
}

/* Der Morgenbericht: was seit dem letzten Besuch passiert ist. Wer drei
   Stunden im Unterricht sass, will beim Oeffnen wissen, ob sein Land noch
   steht - und wer es ihm genommen hat. */
export function morgenbericht(world, p, id, seit, now, extra = {}) {
  const zeilen = [];
  const kaempfe = (world.reports || []).filter((r) => r.defenderId === id && r.time > seit && Array.isArray(r.verteidiger));
  for (const r of kaempfe) {
    const angreifer = world.players[r.attackerId], feld = D.FELDER[r.territoryId - 1];
    if (!angreifer || !feld) continue;
    if (r.winner === 'wir') {
      const t = world.territories[r.territoryId - 1], rache = X.revanche(p, t, now);
      zeilen.push({ art: 'schlecht', text: '⚔️ ' + angreifer.name + ' hat dir ' + feld.name + ' abgenommen.'
        + (rache ? ' Revanche möglich: +' + Math.round(X.REVANCHE_BONUS * 100) + ' %, noch ' + Math.max(1, Math.round((rache.bis - now) / 3600000)) + ' Std.' : ''),
        ...(rache ? { revanche: r.territoryId } : {}) });
    } else if (r.winner !== 'stale') zeilen.push({ art: 'gut', text: '🛡️ Deine Verteidigung auf ' + feld.name + ' hielt gegen ' + angreifer.name + '.' });
  }
  const raub = (world.reports || []).filter((r) => r.defenderId === id && r.time > seit && /erbeutet ein Ei/.test(r.text || ''));
  for (const r of raub) zeilen.push({ art: 'schlecht', text: '🥚 ' + (world.players[r.attackerId]?.name || 'Jemand') + ' hat dir ein Ei gestohlen.' });
  if (extra.tagesgold) zeilen.push({ art: 'gut', text: '💰 +' + extra.tagesgold + ' Gold Tagesgeld für deine Gebiete.' });
  if (extra.wochenende) zeilen.push({ art: 'gut', text: '🥚 ' + extra.wochenende + ' Wochenend-Eier sind in deiner Tasche.' });
  const aussen = world.territories.filter((t) => t.ownerId === id).reduce((s, t) => s + (t.eggStock || 0), 0);
  if (aussen) zeilen.push({ art: 'info', text: '🏕️ ' + aussen + (aussen === 1 ? ' Ei wartet' : ' Eier warten') + ' auf deinen Außenposten.' });
  const fertig = p.eggs.filter((e) => e.readyAt !== null && e.readyAt <= now).length;
  if (fertig) zeilen.push({ art: 'gut', text: '🐣 ' + fertig + (fertig === 1 ? ' Ei ist' : ' Eier sind') + ' fertig ausgebrütet.' });
  if (!world.territories.some((t) => t.ownerId === id)) {
    const n = X.findeleiStand(p, now).fertig;
    if (n) zeilen.push({ art: 'info', text: '🏠 Du hältst kein Gebiet - im Findelhaus in Stockhafen ' + (n === 1 ? 'liegt ein Ei' : 'liegen ' + n + ' Eier') + ' für dich.' });
  }
  const serie = X.serieStand(p, now), a = X.alltagStand(p, now);
  if (serie && !a.truhe) zeilen.push({ art: 'info', text: '🔥 Deine Serie: ' + serie + (serie === 1 ? ' Tag' : ' Tage') + '. Öffne heute die Tagestruhe, sonst reißt sie.' });
  else if (!serie && p.serie && p.serie.zahl > 1 && !a.truhe) zeilen.push({ art: 'schlecht', text: 'Deine Serie von ' + p.serie.zahl + ' Tagen ist gerissen. Heute fängt eine neue an.' });
  const neuigkeiten = (world.ticker || []).filter((e) => e.t > seit && e.wer !== id).slice(-6).map((e) => e.text);
  if (!zeilen.length && !neuigkeiten.length) return null;
  return { seit, zeilen, neuigkeiten };
}

/* Die Tagestruhe oeffnen. */
export function alltagAction({ world, p, id, body, now }) {
  const extra = {};
  if (body.op !== 'tagestruhe') return extra;
  if (!X.alltagFertig(p, now)) fail('Erledige zuerst alle drei Tagesaufgaben.');
  const a = X.alltagStand(p, now);
  if (a.truhe) fail('Die Truhe für heute hast du schon geöffnet. Morgen gibt es eine neue.');
  const serie = X.serieNachTruhe(p, now), lohn = X.truhenLohn(serie);
  a.truhe = true; p.alltag = a; p.serie = { zahl: serie, tag: H.day(now) };
  p.gold += lohn.gold;
  const ei = { id: 'truhe-' + now + '-' + (++p.eggSerial), territoryId: X.FINDELEI_FELD, producedAt: now, startedAt: null, readyAt: null,
    art: lohn.eiMindestens ? 'serie' : 'truhe', ...(lohn.eiMindestens ? { mindestens: lohn.eiMindestens } : {}) };
  let wartet = false;
  if (p.eggs.length < E.BAG_LIMIT) p.eggs.push(ei); else { p.sonderEier = (p.sonderEier || []).concat(ei); wartet = true; }
  if (serie >= 5 && serie % 5 === 0) tickern(world, '🔥 ' + p.name + ' hält die Serie seit ' + serie + ' Schultagen!', 'serie', now, id);
  extra.truhe = { gold: lohn.gold, serie, eiMindestens: lohn.eiMindestens, wartet };
  const eiText = lohn.eiMindestens ? 'ein Ei, garantiert ' + D.SELTENHEITEN[lohn.eiMindestens].name + ' oder besser' : 'ein Ei';
  extra.message = 'Tagestruhe: +' + lohn.gold + ' Gold und ' + eiText + (wartet ? ' (wartet auf Platz in der Tasche)' : '') + '. Serie: ' + serie + (serie === 1 ? ' Tag.' : ' Tage.');
  return extra;
}
