/* ------------------------------------------------------------------
   Handel und Gemeinschaft, Serverseite: Kurierdienst, Gemeinschaftsbauten
   samt Gebietsabgabe und der Runenhandel beim Haendler.

   Die Regeln (Wege, Lohn, Preise, Grenzen) stehen in
   src/games/gehstockmon/2-handel.js und gelten im Browser genauso, die
   Wochenbilanz in 1-wirtschaft.js. Hier steht nur, was die Spielerwelt
   veraendert.
   ------------------------------------------------------------------ */
import { data as D, economy as E, adventure as X } from './gehstockmon-rules.mjs';
import { anwesende } from './gehstockmon-anwesenheit.mjs';
import { tickern } from './gehstockmon-alltag.mjs';
import { effekt } from './gehstockmon-insel.mjs';

const fail = (message) => { throw new Error(message); };

/* Der Stand aller Gemeinschaftsbauten nach dem Leuchtturm. */
export function bauten(world) {
  if (!world.bauten || typeof world.bauten !== 'object') world.bauten = {};
  for (const def of X.BAUTEN) {
    const b = world.bauten[def.id];
    if (!b || typeof b !== 'object') world.bauten[def.id] = { gold: 0, abgabe: 0, spender: {}, fertigAm: null };
  }
  return world.bauten;
}
/* Mit welchem Satz gerade abgegeben wird - ohne offenen Bau ruht die Abgabe.
   Der Buergermeister kann ihn per Erlass heben oder senken. */
export function abgabeSatz(world, now) {
  return X.offenerBau(bauten(world)) ? Math.round(E.ABGABE * effekt(world, now, 'abgabe') * 1000) / 1000 : 0;
}
function einzahlen(world, def, betrag, now) {
  const b = bauten(world)[def.id], gibt = Math.max(0, Math.min(Math.floor(betrag), def.ziel - b.gold));
  b.gold += gibt;
  const fertig = b.gold >= def.ziel && !b.fertigAm;
  if (fertig) b.fertigAm = now;
  return { gibt, fertig };
}
/* Die Abgabe aus E.settle landet im offenen Bau. Was ueber das Ziel hinaus
   ginge, verfaellt - es sind hoechstens ein paar Muenzen. */
export function abgabeEinzahlen(world, betrag, now) {
  const def = X.offenerBau(bauten(world));
  if (!def || !(betrag > 0)) return;
  const r = einzahlen(world, def, betrag, now);
  world.bauten[def.id].abgabe = (world.bauten[def.id].abgabe || 0) + r.gibt;
  if (r.fertig) tickern(world, '🏛️ Die ' + def.name + ' steht - bezahlt aus Spenden und der Gebietsabgabe. ' + def.was, 'bau', now);
}
function tafel(eintraege, world, id) {
  return Object.entries(eintraege || {}).sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([pid, wert]) => ({ name: world.players[pid]?.name || 'Unbekannt', wert, selbst: pid === id }));
}
/* Legt faellige Kurierauftraege aufs Brett des Spielers. */
export function kurierPflegen(world, p, id, now, zufall) {
  const eigene = world.territories.filter((t) => t.ownerId === id).map((t) => t.id);
  return X.kurierNachfuellen(p, now, E.zufallsfolge(zufall), eigene);
}
/* Was der Browser davon sehen darf. Brett und Paket stehen schon im Profil. */
export function handelSicht(world, p, id, now) {
  const b = bauten(world), gebiete = world.territories.filter((t) => t.ownerId === id).length;
  return { handel: {
    bauten: X.BAUTEN.map((def) => {
      const s = b[def.id];
      return { id: def.id, name: def.name, was: def.was, ziel: def.ziel, gold: Math.min(s.gold, def.ziel), abgabe: s.abgabe || 0,
        fertig: X.bauFertig(b, def.id), fertigAm: s.fertigAm || null, eigen: s.spender[id] || 0, tafel: tafel(s.spender, world, id) };
    }),
    abgabe: abgabeSatz(world, now),
    kurier: { naechsterIn: X.kurierWartezeit(p, now), gebiete },
    runen: X.bauFertig(b, 'markthalle') ? X.runenHandelStand(p, now, effekt(world, now, 'handelDeckel')) : null } };
}

export async function handelAction({ world, p, id, body, now, presence }) {
  const op = body.op, extra = {};
  if (!X.HANDEL_OPS.includes(op)) return extra;
  async function position() {
    const v = (await anwesende(presence))[id];
    if (!v || now - v.updatedAt >= 15000 || v.spawnAt !== p.lastJoinAt) fail('Die Kartenposition ist nicht aktuell. Warte kurz auf die Verbindung.');
    return v;
  }
  /* Am Kontor heisst: in Stockhafen. An einem Gebiet heisst: vor seinem Tor. */
  async function amOrt(ort) {
    const v = await position();
    if (!ort) { if (!X.inStadt(v)) fail('Das Kontor ist in ' + X.STADT.name + '. Lauf zuerst in die Stadt.'); return; }
    const tor = X.tor(X.layout(world.territories), ort);
    if (!tor || Math.hypot(v.x - tor.x, v.z - tor.z) > X.KURIER_NAEHE) fail('Lauf zuerst vor das Tor von ' + X.kurierOrtName(ort) + '.');
  }
  const gebiete = world.territories.filter((t) => t.ownerId === id).length;

  if (op === 'kurier_annehmen') {
    if (p.kurier) fail('Du trägst schon ein Paket. Liefere es erst ab.');
    const at = p.kurierBrett.findIndex((a) => a.id === body.auftragId);
    if (at < 0) fail('Diesen Auftrag gibt es nicht mehr.');
    const a = p.kurierBrett[at];
    await amOrt(a.von);
    /* War das Brett voll, stand die Uhr - sie laeuft ab jetzt. Sonst saesse
       hinter dem vollen Stapel ein zweiter, unsichtbarer. */
    if (p.kurierBrett.length >= X.KURIER_VORRAT) p.kurierAt = now;
    p.kurierBrett.splice(at, 1);
    p.kurier = { ...a, seit: now, frist: a.eilig ? now + X.kurierFrist(a) : null };
    extra.message = a.ware + ' aufgeladen. Bring es zum Tor von ' + X.kurierOrtName(a.nach)
      + (a.eilig ? ' - eilig: ' + Math.round(X.kurierFrist(a) / 60000 * 10) / 10 + ' Minuten für die Hälfte mehr.' : '.');
    return extra;
  }
  if (op === 'kurier_abliefern') {
    const k = p.kurier;
    if (!k) fail('Du trägst gerade kein Paket.');
    await amOrt(k.nach);
    const eil = !!(k.eilig && k.frist && now <= k.frist), lohn = X.kurierBetrag(k, gebiete, eil, effekt(world, now, 'kurier'));
    E.buchen(p, lohn, 'kurier', now);
    p.kurier = null; p.kurierGesamt = (p.kurierGesamt || 0) + 1;
    const besitzer = world.territories[k.nach - 1]?.ownerId, wem = besitzer && besitzer !== id ? world.players[besitzer]?.name : null;
    extra.kurier = { lohn, eil };
    extra.message = k.ware + ' ist angekommen' + (wem ? ' - ' + wem + 's Außenposten sagt danke' : '') + '. +' + lohn + ' Gold'
      + (eil ? ' mit Eilzuschlag.' : k.eilig ? ' (die Eilfrist war vorbei).' : '.');
    return extra;
  }
  if (op === 'kurier_abbrechen') {
    if (!p.kurier) fail('Du trägst gerade kein Paket.');
    extra.message = p.kurier.ware + ' zurückgegeben. Der Auftrag ist verfallen, Gold gibt es dafür keins.';
    p.kurier = null;
    return extra;
  }
  if (op === 'bau_spenden') {
    const b = bauten(world), def = X.bau(body.bauId);
    if (!def) fail('Diesen Bau gibt es nicht.');
    if (X.bauFertig(b, def.id)) fail('Die ' + def.name + ' steht bereits.');
    if (X.offenerBau(b)?.id !== def.id) fail('Die Insel baut gerade an etwas anderem.');
    const betrag = Math.floor(Number(body.betrag));
    if (!Number.isFinite(betrag) || betrag < def.mindestens) fail('Mindestens ' + def.mindestens + ' Gold.');
    if (betrag > p.gold) fail('So viel Gold hast du nicht.');
    const r = einzahlen(world, def, betrag, now);
    E.buchen(p, -r.gibt, 'spende', now);
    b[def.id].spender[id] = (b[def.id].spender[id] || 0) + r.gibt;
    if (r.fertig) {
      tickern(world, '🏛️ ' + p.name + ' setzt den letzten Stein - die ' + def.name + ' steht! ' + def.was, 'bau', now, id);
      extra.message = 'Die ' + def.name + ' steht! ' + def.was;
    } else extra.message = r.gibt + ' Gold verbaut. Noch ' + (def.ziel - b[def.id].gold).toLocaleString('de-DE') + ' Gold bis zur ' + def.name + '.';
    return extra;
  }
  if (op === 'runen_kaufen' || op === 'runen_verkaufen') {
    if (!X.bauFertig(bauten(world), 'markthalle')) fail('Runen handelt der Händler erst, wenn die Markthalle steht.');
    const rang = Number(body.rang);
    if (!Number.isInteger(rang) || rang < 0 || rang >= D.SELTENHEITEN.length) fail('Diese Rune gibt es nicht.');
    const stand = X.runenHandelStand(p, now, effekt(world, now, 'handelDeckel')), name = D.SELTENHEITEN[rang].name + '-Rune';
    if (op === 'runen_kaufen') {
      const preis = X.RUNEN_PREISE[rang];
      if (preis > stand.kaufFrei) fail('Diese Woche verkauft dir der Händler nur noch Runen für ' + stand.kaufFrei + ' Gold. Am Montag wieder mehr.');
      if (p.gold < preis) fail('Eine ' + name + ' kostet ' + preis + ' Gold.');
      E.buchen(p, -preis, 'handel', now); p.runes[rang] = Math.min(9999, (p.runes[rang] || 0) + 1);
      extra.message = 'Gekauft: eine ' + name + '. −' + preis + ' Gold.';
    } else {
      const preis = X.runenAnkauf(rang);
      if ((p.runes[rang] || 0) < 1) fail('Du hast keine ' + name + '.');
      if (preis > stand.verkaufFrei) fail('Diese Woche nimmt dir der Händler nur noch Runen für ' + stand.verkaufFrei + ' Gold ab. Am Montag wieder mehr.');
      p.runes[rang] -= 1; E.buchen(p, preis, 'handel', now);
      extra.message = 'Verkauft: eine ' + name + '. +' + preis + ' Gold.';
    }
    return extra;
  }
  return extra;
}
