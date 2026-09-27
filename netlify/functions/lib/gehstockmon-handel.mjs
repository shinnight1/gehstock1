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
    const s = world.bauten[def.id];
    if (def.rohstoffe && (!s.rohstoffe || typeof s.rohstoffe !== 'object')) { s.rohstoffe = {}; s.rohSpender = {}; }
  }
  return world.bauten;
}
/* Mit welchem Satz gerade abgegeben wird - ohne offenen Bau ruht die Abgabe.
   Der Buergermeister kann ihn per Erlass heben oder senken. */
export function abgabeSatz(world, now) {
  return X.bauFuerGold(bauten(world)) ? Math.round(E.ABGABE * effekt(world, now, 'abgabe') * 1000) / 1000 : 0;
}
/* Ein Bau ist fertig, wenn Gold und alle Rohstoffe beisammen sind. */
function fertigPruefen(world, def, now) {
  const b = bauten(world)[def.id], fertig = X.bauFertig(world.bauten, def.id) && !b.fertigAm;
  if (fertig) b.fertigAm = now;
  return fertig;
}
function einzahlen(world, def, betrag, now) {
  const b = bauten(world)[def.id], gibt = Math.max(0, Math.min(Math.floor(betrag), def.ziel - b.gold));
  b.gold += gibt;
  return { gibt, fertig: fertigPruefen(world, def, now) };
}
function rohstoffEinzahlen(world, def, rid, menge, now) {
  const b = bauten(world)[def.id], gibt = Math.max(0, Math.min(Math.floor(menge), ((def.rohstoffe || {})[rid] || 0) - (b.rohstoffe[rid] || 0)));
  b.rohstoffe[rid] = (b.rohstoffe[rid] || 0) + gibt;
  return { gibt, fertig: fertigPruefen(world, def, now) };
}
/* Die Abgabe aus E.settle landet im ersten Bau, der noch Gold braucht. Was
   ueber das Ziel hinaus ginge, verfaellt - es sind hoechstens ein paar Muenzen. */
export function abgabeEinzahlen(world, betrag, now) {
  const def = X.bauFuerGold(bauten(world));
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
        fertig: X.bauFertig(b, def.id), fertigAm: s.fertigAm || null, eigen: s.spender[id] || 0, tafel: tafel(s.spender, world, id),
        ...(def.rohstoffe ? { rohstoffe: def.rohstoffe, geliefert: { ...s.rohstoffe }, eigenRoh: (s.rohSpender || {})[id] || 0, tafelRoh: tafel(s.rohSpender, world, id) } : {}) };
    }),
    abgabe: abgabeSatz(world, now),
    kurier: { naechsterIn: X.kurierWartezeit(p, now), gebiete },
    hafenkran: X.bauFertig(b, 'hafenkran'),
    runen: X.bauFertig(b, 'markthalle') ? X.runenHandelStand(p, now, effekt(world, now, 'handelDeckel')) : null },
    rohstoffStellen: X.rohstoffStellen(now, world.territories).filter((s) => !(p.rohstoffClaims || []).includes(s.id)) };
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
    /* Der fertige Hafenkran legt fuer immer ein Fuenftel drauf. */
    const kran = X.bauFertig(bauten(world), 'hafenkran') ? X.HAFENKRAN_KURIER : 1;
    const eil = !!(k.eilig && k.frist && now <= k.frist), lohn = X.kurierBetrag(k, gebiete, eil, effekt(world, now, 'kurier') * kran);
    E.buchen(p, lohn, 'kurier', now);
    /* Wer an einem Aussenposten abgeholt hat, traegt dessen Ware mit. */
    const ware = k.von ? E.rohstoffVon(k.von) : null, mit = ware ? E.einlagern(p, ware.id, X.KURIER_ROHSTOFF) : 0;
    p.kurier = null; p.kurierGesamt = (p.kurierGesamt || 0) + 1;
    const besitzer = world.territories[k.nach - 1]?.ownerId, wem = besitzer && besitzer !== id ? world.players[besitzer]?.name : null;
    extra.kurier = { lohn, eil };
    extra.message = k.ware + ' ist angekommen' + (wem ? ' - ' + wem + 's Außenposten sagt danke' : '') + '. +' + lohn + ' Gold'
      + (eil ? ' mit Eilzuschlag' : k.eilig ? ' (die Eilfrist war vorbei)' : '') + (mit ? ' und ' + mit + ' ' + ware.name : '') + '.';
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
    if (X.bauFertig(b, def.id)) fail(def.name + ' steht bereits.');
    /* Rohstoffe spenden: nur was der Bau noch braucht. */
    if (body.rohstoff !== undefined) {
      const r = E.rohstoff(body.rohstoff), menge = Math.floor(Number(body.menge));
      if (!r || !def.rohstoffe || !def.rohstoffe[r.id]) fail(def.name + ' braucht kein ' + (r ? r.name : 'solches Material') + '.');
      if (!Number.isFinite(menge) || menge < 1 || menge > 100) fail('Gib zwischen 1 und 100 Einheiten.');
      if ((p.lager[r.id] || 0) < menge) fail('So viel ' + r.name + ' hast du nicht.');
      const erg = rohstoffEinzahlen(world, def, r.id, menge, now);
      if (!erg.gibt) fail('Vom ' + r.name + ' hat ' + def.name + ' schon genug.');
      p.lager[r.id] -= erg.gibt; b[def.id].rohSpender[id] = (b[def.id].rohSpender[id] || 0) + erg.gibt;
      if (erg.fertig) {
        tickern(world, '🏗️ ' + p.name + ' bringt das letzte Material - ' + def.name + ' steht! ' + def.was, 'bau', now, id);
        extra.message = def.name + ' steht! ' + def.was;
      } else extra.message = erg.gibt + ' ' + r.name + ' verbaut. Es fehlen noch ' + ((def.rohstoffe[r.id] || 0) - b[def.id].rohstoffe[r.id]) + '.';
      return extra;
    }
    if (X.bauGoldFertig(b, def.id)) fail('Für ' + def.name + ' ist genug Gold da - es fehlen nur noch Rohstoffe.');
    const betrag = Math.floor(Number(body.betrag));
    if (!Number.isFinite(betrag) || betrag < def.mindestens) fail('Mindestens ' + def.mindestens + ' Gold.');
    if (betrag > p.gold) fail('So viel Gold hast du nicht.');
    const r = einzahlen(world, def, betrag, now);
    E.buchen(p, -r.gibt, 'spende', now);
    b[def.id].spender[id] = (b[def.id].spender[id] || 0) + r.gibt;
    if (r.fertig) {
      tickern(world, '🏛️ ' + p.name + ' setzt den letzten Stein - ' + def.name + ' steht! ' + def.was, 'bau', now, id);
      extra.message = def.name + ' steht! ' + def.was;
    } else extra.message = r.gibt + ' Gold verbaut. ' + (X.bauGoldFertig(b, def.id) ? 'Das Gold ist beisammen - es fehlen noch Rohstoffe.' : 'Noch ' + (def.ziel - b[def.id].gold).toLocaleString('de-DE') + ' Gold bis ' + def.name + '.');
    return extra;
  }
  if (op === 'abbauen') {
    const stelle = X.rohstoffStellen(now, world.territories).find((s) => s.id === body.stelleId);
    if (!stelle) fail('Diese Rohstoffstelle ist erschöpft. Neue tauchen jede Stunde auf.');
    if ((p.rohstoffClaims || []).includes(stelle.id)) fail('Hier hast du schon abgebaut.');
    const v = await position();
    if (Math.hypot(v.x - stelle.x, v.z - stelle.z) > X.ROHSTOFF_NAEHE) fail('Lauf zuerst näher heran.');
    /* Erntezeit und Erntedank machen die Stellen ergiebiger. */
    const r = E.rohstoff(stelle.rohstoff), menge = Math.max(1, Math.round(stelle.menge * effekt(world, now, 'rohstoffStelle')));
    const kam = E.einlagern(p, r.id, menge);
    p.rohstoffClaims = (p.rohstoffClaims || []).concat(stelle.id).slice(-60); p.abgebaut = (p.abgebaut || 0) + 1;
    extra.message = '+' + kam + ' ' + r.name + (kam < menge ? ' - dein Lager ist voll.' : '. Im Lager: ' + p.lager[r.id] + '.');
    return extra;
  }
  if (op === 'rohstoff_kaufen' || op === 'rohstoff_verkaufen') {
    if (!X.bauFertig(bauten(world), 'markthalle')) fail('Rohstoffe handelt der Händler erst, wenn die Markthalle steht.');
    const r = E.rohstoff(body.rohstoff), menge = Math.floor(Number(body.menge));
    if (!r) fail('Diesen Rohstoff gibt es nicht.');
    if (!Number.isFinite(menge) || menge < 1 || menge > 20) fail('Handle zwischen 1 und 20 Einheiten auf einmal.');
    const stand = X.runenHandelStand(p, now, effekt(world, now, 'handelDeckel'));
    if (op === 'rohstoff_kaufen') {
      const preis = X.ROHSTOFF_PREISE[r.id] * menge;
      if (preis > stand.kaufFrei) fail('Diese Woche verkauft dir der Händler nur noch für ' + stand.kaufFrei + ' Gold. Am Montag wieder mehr.');
      if (p.gold < preis) fail(menge + ' ' + r.name + ' kosten ' + preis + ' Gold.');
      const kam = E.einlagern(p, r.id, menge);
      if (kam < menge) { p.lager[r.id] -= kam; fail('So viel passt nicht mehr in dein Lager.'); }
      E.buchen(p, -preis, 'handel', now);
      extra.message = 'Gekauft: ' + menge + ' ' + r.name + '. −' + preis + ' Gold.';
    } else {
      const preis = X.rohstoffAnkauf(r.id) * menge;
      if ((p.lager[r.id] || 0) < menge) fail('So viel ' + r.name + ' hast du nicht.');
      if (preis > stand.verkaufFrei) fail('Diese Woche nimmt dir der Händler nur noch für ' + stand.verkaufFrei + ' Gold etwas ab. Am Montag wieder mehr.');
      p.lager[r.id] -= menge; E.buchen(p, preis, 'handel', now);
      extra.message = 'Verkauft: ' + menge + ' ' + r.name + '. +' + preis + ' Gold.';
    }
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
