/* ------------------------------------------------------------------
   Diagnose: Fehler merken, unerwartete Abbrueche erkennen.

   Auf dem iPad sieht niemand eine Konsole. Darum wird jeder Fehler mit
   Zeit, Ort und den ersten Zeilen des Aufrufstapels im Geraet gemerkt
   (hoechstens zwoelf). In den Einstellungen unter "Diagnose" steht die
   Liste zum Kopieren.

   Schliesst iOS die Seite hart (meist zu viel Speicher), laeuft kein
   Code mehr, der das melden koennte. Deshalb schreibt das Spiel alle
   paar Sekunden einen Herzschlag. Findet der naechste Start einen
   Herzschlag von einer sichtbaren Seite, die nicht ordentlich beendet
   wurde, war das ein Absturz - samt der letzten Messwerte.
   ------------------------------------------------------------------ */

const FEHLER = 'gehstock-ops:fehler:v1';
const SITZUNG = 'gehstock-ops:sitzung:v1';
const MAX = 12;

function lesen(schluessel, ersatz) {
  try {
    const v = JSON.parse(localStorage.getItem(schluessel) || 'null');
    return v === null ? ersatz : v;
  } catch (e) {
    return ersatz;
  }
}

function schreiben(schluessel, wert) {
  try {
    localStorage.setItem(schluessel, JSON.stringify(wert));
  } catch (e) { /* voll oder gesperrt - egal */ }
}

export function fehlerListe() {
  const l = lesen(FEHLER, []);
  return Array.isArray(l) ? l : [];
}

export function fehlerMerken(fehler, wo, info) {
  const e = fehler || {};
  const liste = fehlerListe();
  liste.push({
    zeit: new Date().toISOString(),
    wo: wo || '',
    text: String(e.message || e).slice(0, 240),
    stapel: String(e.stack || '').split('\n').slice(0, 5).map((z) => z.trim()).join(' | ').slice(0, 500),
    info: info || null,
  });
  while (liste.length > MAX) liste.shift();
  schreiben(FEHLER, liste);
}

export function fehlerLeeren() {
  schreiben(FEHLER, []);
}

/* Herzschlag: die Seite ist sichtbar und laeuft. */
export function herzschlag(info) {
  schreiben(SITZUNG, { laeuft: true, zeit: Date.now(), info });
}

/* Ordentlich beendet oder unsichtbar: kein Absturz, wenn danach nichts kommt. */
export function sitzungEnde() {
  const s = lesen(SITZUNG, null);
  if (s && s.laeuft) schreiben(SITZUNG, { laeuft: false, zeit: Date.now(), info: s.info });
}

/* Beim Start: wurde die letzte sichtbare Sitzung abgebrochen? Gibt die
   letzten Messwerte zurueck oder null. */
export function absturzPruefen() {
  const s = lesen(SITZUNG, null);
  schreiben(SITZUNG, { laeuft: false, zeit: Date.now(), info: null });
  if (!s || !s.laeuft || Date.now() - s.zeit > 3600 * 1000) return null;
  const info = s.info || {};
  fehlerMerken({ message: 'Seite wurde unerwartet beendet (vermutlich Speicher)' }, 'abbruch', info);
  return info;
}

/* Text fuers Kopieren (Einstellungen -> Diagnose). */
export function diagnoseText(technik) {
  const zeilen = ['Gehstock Ops - Diagnose', technik || ''];
  for (const f of fehlerListe()) {
    zeilen.push(f.zeit + ' [' + f.wo + '] ' + f.text);
    if (f.stapel) zeilen.push('  ' + f.stapel);
    if (f.info) zeilen.push('  ' + JSON.stringify(f.info));
  }
  return zeilen.join('\n');
}
