/* ------------------------------------------------------------------
   Protokoll.

   Ein eigenes Brett auf dem Relais, auf dem steht, was passiert ist:
   geloeschte Nachrichten, Banne, angelegte Codes, BND-Zugriffe,
   Bildschirmbeobachtung, Antraege. Sichtbar im Admin-Raum.

   Absichtlich nur anhaengen - Eintraege lassen sich nicht aendern und
   nicht loeschen. Ein Protokoll, das man frisieren kann, ist keines.
   (Die aeltesten fallen heraus, wenn es zu lang wird; das ist eine
   Speichergrenze, kein Bearbeiten.)
   ------------------------------------------------------------------ */

(function (SG) {
  var A = SG.auth;
  var Rel = SG.relais;

  var P = SG.protokoll = {};

  P.BRETT = 'protokoll';

  P.ARTEN = {
    anmeldung: { icon: '🚪', name: 'Anmeldung' },
    abmeldung: { icon: '👋', name: 'Abmeldung' },
    loeschen: { icon: '🗑', name: 'Nachricht gelöscht' },
    bann: { icon: '⛔', name: 'Gesperrt' },
    entbann: { icon: '✅', name: 'Sperre aufgehoben' },
    code: { icon: '🎫', name: 'Code erstellt' },
    codeweg: { icon: '✂️', name: 'Profil gelöscht' },
    rolle: { icon: '🎖', name: 'Rolle geändert' },
    sperre: { icon: '🚫', name: 'Spielsperre' },
    wartung: { icon: '🔧', name: 'Wartung' },
    ansage: { icon: '📣', name: 'Ansage' },
    schirm: { icon: '👁', name: 'Bildschirm' },
    bnd: { icon: '🕵', name: 'BND' },
    antrag: { icon: '📨', name: 'Antrag' },
    befragung: { icon: '🎙', name: 'Befragung' },
    tarnung: { icon: '🫥', name: 'Tarnung' },
    verhoer: { icon: '🚪', name: 'Verhör an der Tür' },
    meeting: { icon: '📋', name: 'Besprechung' },
    umfrage: { icon: '📊', name: 'Umfrage' },
    'umfrage-zu': { icon: '📊', name: 'Umfrage' },
    info: { icon: 'ℹ️', name: 'Hinweis' },
  };

  P.art = function (id) {
    return P.ARTEN[id] || { icon: '•', name: id || 'Ereignis' };
  };

  /* schreiben('bann', 'Anna gesperrt', '#/kreis', '0141')

     'ziel' ist immer ein Code, nie ein Name - die Ansicht schlaegt
     darueber den Namen nach und faellt sonst auf die Kennung zurueck. */
  P.schreiben = function (art, text, wo, ziel) {
    if (!Rel.verfuegbar()) return Promise.resolve(null);
    var ich = Rel.ich();
    return Rel.post({
      op: 'log',
      von: ich.name, code: ich.code, rolle: ich.rolle,
      eintrag: {
        art: art || 'info',
        text: String(text || ''),
        wo: wo || '',
        ziel: ziel || '',
      },
    }, 10000).then(function (res) {
      /* Gleich in den Zwischenspeicher legen. Sonst steht der Eintrag
         erst da, wenn die naechste Runde der Verbindung zurueckkommt -
         und wer gerade das Protokoll offen hat, sieht sein eigenes
         Tun mit Verspaetung. */
      Rel.kanalStand(P.BRETT, res);
      return res;
    }, function () { return null; });
  };
})(SG);
