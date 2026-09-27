/* ------------------------------------------------------------------
   Die Insel als Ganzes, Serverseite: das Wetter der Woche und das
   Rathaus mit Buergermeisterwahl und Erlass.

   Die Regeln stehen in src/games/gehstockmon/2-insel.js. Hier steht, was
   die Spielerwelt veraendert, und die eine Funktion, ueber die jeder Zug
   nach dem Faktor der Woche fragt: effekt(world, now, schluessel).
   ------------------------------------------------------------------ */
import { adventure as X } from './gehstockmon-rules.mjs';
import { tickern } from './gehstockmon-alltag.mjs';

/* Der Erlass, der gerade gilt - nur in der Woche, fuer die er gewaehlt wurde. */
export function aktuellerErlass(world, now) {
  const amt = world.rathaus && world.rathaus.amt;
  return amt && amt.woche === X.zerhackerWoche(now) ? amt.erlass : null;
}
export function effekt(world, now, schluessel) {
  return X.effekt(now, aktuellerErlass(world, now), schluessel);
}
/* Der Wochenwechsel der Insel: neues Wetter im Ticker. Laeuft vor dem
   Schreiben, wie Zerhacker und Wochenaufgabe. Die Wahl haengt sich spaeter
   hier ein (wahlAuswerten). */
export const wochenwechsel = [];
export function inselWoche(world, now) {
  const woche = X.zerhackerWoche(now);
  if (world.insel && world.insel.woche === woche) return world.insel;
  const vorher = world.insel || null;
  world.insel = { woche };
  for (const schritt of wochenwechsel) schritt(world, now, vorher);
  const w = X.wetter(now);
  tickern(world, w.zeichen + ' Neue Woche, neues Wetter: ' + w.name + '. ' + w.text, 'wetter', now);
  return world.insel;
}
function wetterSicht(w) { return { id: w.id, name: w.name, zeichen: w.zeichen, text: w.text, farbe: w.farbe }; }
/* Was der Browser sehen darf: Wetter jetzt und naechste Woche, der Erlass
   und die Faktoren der Woche fuer seine Anzeigen. */
export function inselSicht(world, id, now) {
  const erlassId = aktuellerErlass(world, now), e = X.erlass(erlassId);
  return { insel: {
    wetter: wetterSicht(X.wetter(now)), naechste: wetterSicht(X.wetterNaechste(now)),
    erlass: e ? { id: e.id, name: e.name, zeichen: e.zeichen, text: e.text } : null,
    effekte: X.effekte(now, erlassId) } };
}
