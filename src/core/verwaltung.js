/* ------------------------------------------------------------------
   Verwaltung.

   Profile, Sperren, Wartung, Kreis-Spiele, Ansage, Banne und die
   BND-Liste liegen in EINEM Dokument auf dem Relais. Jedes Geraet
   liest dasselbe und wird ueber die gemeinsame Verbindung (SG.relais)
   benachrichtigt, sobald ein Admin etwas aendert - ohne Neuladen.

   Frueher hatte diese Datei ihre eigene Warteschleife. Zusammen mit
   Spiel und Chat waren das drei offene Anfragen je Geraet; Netlify
   laesst nur wenige gleichzeitig laufen, und der Rest stand Schlange.
   Deshalb haengt das hier jetzt mit an der einen Verbindung.

   Ohne Relais (Offline-Datei, Netlify ohne Funktion) faellt alles auf
   den Geraetespeicher zurueck - dann gilt eben wieder nur lokal, was
   lokal gesetzt wurde. Besser als gar nichts, und es steht im
   Admin-Menue auch so da.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;
  var Rel = SG.relais;

  var V = SG.verwaltung = {};

  var SCHLUESSEL = 'verwaltung';       // im Geraetespeicher

  var daten = null;
  var version = 0;
  var offeneSchreiben = 0;             // eigene Aenderungen noch unterwegs
  var bus = U.emitter();

  V.on = bus.on;
  V.off = bus.off;
  V.online = false;                    // wurde schon einmal vom Relais gelesen?

  function leer() {
    return {
      profile: [],
      sperren: {},
      wartung: {},
      kreisSpiele: [],
      ansage: null,
      bnd: [],           // Codes mit Nachrichtendienst-Freigabe
      banne: {},         // code -> { von, grund, t }
      geraeteBanne: {},  // geraet -> { von, grund, t }
      geraete: {},       // code -> [ { id, art, ersteSicht, letzteSicht } ]
      geklaert: {},      // code -> { von, t, notiz, geraete } - vom BND abgehakt
      meetings: [],      // Besprechungen
      stundenplan: {},   // "tag:stunde" -> { fach, raum }
    };
  }
  V.leer = leer;

  function ausGeraet() {
    var d = SG.storage.globalGet(SCHLUESSEL, null);
    if (d && typeof d === 'object') return U.assign(leer(), d);
    /* Erstmalig: was frueher einzeln lag, einsammeln */
    return U.assign(leer(), {
      profile: SG.storage.globalGet('auth:ausgegeben', []),
      sperren: SG.storage.globalGet('auth:sperren', {}),
      wartung: SG.storage.globalGet('auth:wartung', {}),
      kreisSpiele: SG.storage.globalGet('auth:kreisspiele', []),
      ansage: SG.storage.globalGet('auth:ansage', null),
    });
  }

  function merken() {
    SG.storage.globalSet(SCHLUESSEL, daten);
  }

  V.daten = function () {
    if (!daten) { daten = ausGeraet(); }
    return daten;
  };

  V.verfuegbar = function () { return Rel.verfuegbar(); };

  function uebernehmen(res) {
    if (!res || typeof res.version !== 'number') return false;
    if (res.version < version) return false;
    /* Solange eigene Aenderungen unterwegs sind, gilt der lokale Stand.
       Sonst ueberholt eine schon offene Abfrage den eigenen Schreibvorgang
       und die eben gesetzte Sperre waere im Admin-Menue kurz wieder weg. */
    if (offeneSchreiben > 0) return false;
    var neu = U.assign(leer(), res.daten || {});
    var vorher = JSON.stringify(daten);
    daten = neu;
    version = res.version;
    Rel.verwVersionSetzen(version);
    V.online = true;
    merken();
    if (JSON.stringify(daten) !== vorher) bus.emit('aenderung', daten);
    return true;
  }

  /* Einmal holen - beim Start, noch vor der Tuer. Die Bannliste muss
     da sein, bevor jemand seinen Code eingibt. */
  V.laden = function () {
    V.daten();
    if (!V.verfuegbar()) return Promise.resolve(daten);
    return Rel.post({ op: 'verw:read', since: 0 }, 6000).then(function (res) {
      // Ein leeres Relais darf lokale Daten nicht wegwischen
      if (res && res.version === 0 && daten && hatInhalt(daten)) {
        return V.schreiben(function () { /* lokalen Stand hochladen */ });
      }
      uebernehmen(res);
      return daten;
    }, function () { return daten; });
  };

  function hatInhalt(d) {
    return !!(d && ((d.profile && d.profile.length)
      || Object.keys(d.sperren || {}).length
      || Object.keys(d.wartung || {}).length
      || (d.kreisSpiele && d.kreisSpiele.length)
      || (d.bnd && d.bnd.length)
      || Object.keys(d.banne || {}).length
      || Object.keys(d.geraeteBanne || {}).length
      || (d.meetings && d.meetings.length)
      || Object.keys(d.stundenplan || {}).length
      || d.ansage));
  }

  /* Hoert ab jetzt auf die gemeinsame Verbindung */
  V.starten = function () {
    Rel.verwVersionSetzen(version);
    Rel.on('verwaltung', function (res) { uebernehmen(res); });
    Rel.starten();
  };

  /* Aendert das Dokument und schiebt es hoch. Der Aufruf bekommt die
     Daten und darf sie an Ort und Stelle veraendern. */
  V.schreiben = function (aenderung) {
    V.daten();
    if (aenderung) aenderung(daten);
    merken();
    bus.emit('aenderung', daten);
    if (!V.verfuegbar()) return Promise.resolve(daten);
    offeneSchreiben++;
    return Rel.post({ op: 'verw:write', daten: daten }, 8000).then(function (res) {
      offeneSchreiben--;
      if (res && typeof res.version === 'number') {
        version = res.version;
        Rel.verwVersionSetzen(version);
        V.online = true;
      }
      return daten;
    }, function () { offeneSchreiben--; return daten; });
  };
})(SG);
