/* ------------------------------------------------------------------
   Wer steht wo auf der Insel

   Bis September 2026 lag das in EINEM Dokument fuer alle ('presence-v1').
   Jede Positionsmeldung las es, trug sich ein und schrieb es bedingt
   zurueck. Mit einer ganzen Klasse auf der Insel kamen sich die
   Meldungen dabei staendig in die Quere: zwischen Lesen und Schreiben
   hatte fast immer schon jemand anderes geschrieben, die Meldung
   scheiterte und begann von vorn - jedes Mal zwei Datenbankbefehle mehr,
   bis zu achtmal. Gemessen mit zwanzig Spielern und realistischer
   Netzlaufzeit musste rund jede dritte Meldung wiederholt werden, und
   einige gaben nach acht Versuchen ganz auf ("Die Mitspieler werden
   gerade aktualisiert").

   In Redis bekommt deshalb jeder Spieler ein eigenes Feld (ein Hash).
   Wer sich eintraegt, schreibt nur sein Feld und kann niemandem mehr
   dazwischenkommen: hoechstens ein Befehl zum Lesen, einer zum Schreiben.

   Speicher ohne Felder - Netlify Blobs als Rueckfallweg, die Testzone,
   die Tests - behalten das alte Dokument. Dort ist das Gedraenge kein
   Thema, und die Tests bleiben unveraendert gueltig.
   ------------------------------------------------------------------ */

export const DOKUMENT = 'presence-v1';
export const FELDER = 'anwesenheit-v2';

const mitFeldern = (store) => !!(store && typeof store.felder === 'function');

/* Eine warme Funktion bearbeitet in einer vollen Klasse mehrere Meldungen
   je Sekunde. Fuer die Positionsmeldung darf die Liste deshalb bis zu einer
   Sekunde alt sein - so wird sie hoechstens einmal je Sekunde gelesen statt
   bei jeder Meldung, und geschrieben wird nur noch das eigene Feld.

   Der eigene letzte Stand, von dem aus die Wegpruefung rechnet, ist darin
   trotzdem immer aktuell: der Browser meldet fruehestens zwei Sekunden
   nach der letzten Antwort, jede gemerkte Liste ist also juenger als der
   letzte eigene Eintrag. Und was diese Funktion selbst schreibt, traegt sie
   sofort nach. Aufgeraeumt wird nur nach frischem Lesen (gemerkt: false) -
   sonst koennte eine alte Liste jemanden austragen, der sich eben erst
   ueber eine andere Funktion zurueckgemeldet hat. Nur mit Feldern - das
   Dokument braucht zum bedingten Schreiben ohnehin den frischen Stempel. */
const gemerkt = new WeakMap();

/* Alle Eintraege als { spielerId: eintrag } - ohne Filter nach Alter,
   das entscheidet der Aufrufer. Immer frisch gelesen: Aktionen pruefen
   damit, ob jemand wirklich am Dungeon oder in der Stadt steht. */
export async function anwesende(store) {
  return (await lesen(store)).eintraege;
}

export async function lesen(store, jetzt, frischMs = 0) {
  if (mitFeldern(store)) {
    const m = gemerkt.get(store);
    if (frischMs && m && jetzt >= m.at && jetzt - m.at < frischMs) return { ...m.stand, gemerkt: true };
    const stand = { eintraege: (await store.felder(FELDER)) || {}, etag: null };
    if (Number.isFinite(jetzt)) gemerkt.set(store, { stand, at: jetzt });
    return stand;
  }
  const entry = await store.getWithMetadata(DOKUMENT, { type: 'json', consistency: 'strong' });
  const eintraege = (entry && entry.data && entry.data.players) || {};
  return { eintraege, etag: entry ? entry.etag : null };
}

/* Traegt einen Spieler ein (eintrag darf null sein - dann nur aufraeumen)
   und entfernt die Spieler in 'weg'. Liefert false, wenn das Dokument
   inzwischen ein anderer geschrieben hat; dann von vorn mit lesen().
   Mit Feldern kann das nicht passieren. */
export async function schreiben(store, stand, id, eintrag, weg) {
  if (mitFeldern(store)) {
    if (eintrag) await store.feldSetzen(FELDER, id, eintrag);
    if (weg.length) await store.felderWeg(FELDER, weg);
    const m = gemerkt.get(store);
    if (m) {
      if (eintrag) m.stand.eintraege[id] = eintrag;
      for (const pid of weg) delete m.stand.eintraege[pid];
    }
    return true;
  }
  const players = { ...stand.eintraege };
  for (const pid of weg) delete players[pid];
  if (eintrag) players[id] = eintrag;
  const result = await store.setJSON(DOKUMENT, { players }, stand.etag ? { onlyIfMatch: stand.etag } : { onlyIfNew: true });
  return !!(result && result.modified);
}
