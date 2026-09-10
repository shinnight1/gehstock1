/* ------------------------------------------------------------------
   Speicher mit gestufter Rueckfallebene.

   Unter file:// (Dateien-App auf dem iPad) verweigert WebKit den Zugriff
   auf localStorage teils mit SecurityError. Deshalb: localStorage ->
   sessionStorage -> Arbeitsspeicher. Damit im letzten Fall nichts
   verlorengeht, gibt es einen Spielstand-Code zum Kopieren.
   ------------------------------------------------------------------ */

(function (SG) {
  var U = SG.util;

  /* Alles liegt unter hgh:. Sobald jemand mit einem Zugangscode
     angemeldet ist, kommt sein Code als zweite Ebene dazu:

         hgh:                     gemeinsame Daten (Sitzung, Namen)
         hgh:u:<CODE>:            alles, was dieser Person gehoert

     Damit teilen sich mehrere Leute ein iPad, ohne sich gegenseitig
     die Spielstaende zu ueberschreiben. */
  var BASIS = 'hgh:';
  var PREFIX = BASIS;

  function probe(kind) {
    try {
      var s = kind === 'local' ? window.localStorage : window.sessionStorage;
      if (!s) return null;
      var k = '__hgh_probe__';
      s.setItem(k, '1');
      if (s.getItem(k) !== '1') return null;
      s.removeItem(k);
      return s;
    } catch (e) { return null; }
  }

  var mem = {};
  var backend = probe('local');
  var mode = 'local';
  if (!backend) { backend = probe('session'); mode = backend ? 'session' : 'memory'; }
  if (!backend) {
    mode = 'memory';
    backend = {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
      setItem: function (k, v) { mem[k] = String(v); },
      removeItem: function (k) { delete mem[k]; },
      key: function (i) { return Object.keys(mem)[i]; },
      get length() { return Object.keys(mem).length; },
    };
  }

  var full = false;   // Quota erschoepft
  var listeners = U.emitter();

  var S = SG.storage = {
    mode: mode,
    /* true, wenn Fortschritt beim Schliessen verloren geht */
    volatile: mode !== 'local',
    on: listeners.on,
    off: listeners.off,

    raw: function (key) {
      try { return backend.getItem(PREFIX + key); } catch (e) { return null; }
    },

    get: function (key, def) {
      var v;
      try { v = backend.getItem(PREFIX + key); } catch (e) { return def; }
      if (v === null || v === undefined) return def;
      try { return JSON.parse(v); } catch (e) { return def; }
    },

    set: function (key, val) {
      var s;
      try { s = JSON.stringify(val); } catch (e) { return false; }
      try {
        backend.setItem(PREFIX + key, s);
        full = false;
        listeners.emit('change', key, val);
        return true;
      } catch (e) {
        // Quota voll: in den Arbeitsspeicher ausweichen, damit das Spiel weiterlaeuft
        full = true;
        mem[PREFIX + key] = s;
        listeners.emit('full', key);
        return false;
      }
    },

    del: function (key) {
      try { backend.removeItem(PREFIX + key); } catch (e) { /* egal */ }
      delete mem[PREFIX + key];
      listeners.emit('change', key, undefined);
    },

    isFull: function () { return full; },

    /* ---------------------------------------------- Benutzerraum */

    user: null,

    /* Wechselt den Benutzerraum. null = gemeinsamer Raum. */
    setUser: function (code) {
      S.user = code || null;
      PREFIX = code ? BASIS + 'u:' + code + ':' : BASIS;
      listeners.emit('user', S.user);
    },

    /* Gemeinsame Daten, unabhaengig vom angemeldeten Benutzer.
       Bewusst zwei Namen statt eines Aufrufs mit wechselnder Bedeutung -
       ein vergessenes zweites Argument haette sonst still geschrieben
       statt gelesen. */
    globalGet: function (key, def) {
      var v;
      try { v = backend.getItem(BASIS + key); } catch (e) { return def; }
      if (v === null || v === undefined) return def;
      try { return JSON.parse(v); } catch (e) { return def; }
    },

    globalSet: function (key, val) {
      var k = BASIS + key, s;
      try { s = JSON.stringify(val); } catch (e) { return false; }
      try { backend.setItem(k, s); return true; }
      catch (e) { mem[k] = s; return false; }
    },

    globalDel: function (key) {
      try { backend.removeItem(BASIS + key); } catch (e) { /* egal */ }
      delete mem[BASIS + key];
    },

    /* Zieht Daten aus dem gemeinsamen Raum in den Benutzerraum um.
       Wird einmal beim ersten Anmelden gebraucht, damit vorhandene
       Spielstaende nicht verlorengehen. */
    uebernehmen: function () {
      if (!S.user) return 0;
      var quelle = [], i, k;
      try {
        for (i = 0; i < backend.length; i++) {
          k = backend.key(i);
          if (!k || k.indexOf(BASIS) !== 0) continue;
          var rest = k.slice(BASIS.length);
          if (rest.indexOf('u:') === 0 || rest.indexOf('auth:') === 0) continue;
          quelle.push(rest);
        }
      } catch (e) { /* egal */ }
      var n = 0;
      quelle.forEach(function (rest) {
        if (S.raw(rest) !== null) return;              // im Benutzerraum schon da
        var v;
        try { v = backend.getItem(BASIS + rest); } catch (e) { return; }
        if (v === null) return;
        try { backend.setItem(PREFIX + rest, v); n++; } catch (e) { /* egal */ }
      });
      return n;
    },

    keys: function () {
      var out = [], i, k;
      try {
        for (i = 0; i < backend.length; i++) {
          k = backend.key(i);
          if (k && k.indexOf(PREFIX) === 0) out.push(k.slice(PREFIX.length));
        }
      } catch (e) { /* egal */ }
      for (k in mem) {
        if (k.indexOf(PREFIX) === 0 && out.indexOf(k.slice(PREFIX.length)) < 0) {
          out.push(k.slice(PREFIX.length));
        }
      }
      return out;
    },

    /* Benannter Unterspeicher, z. B. fuer ein einzelnes Spiel */
    ns: function (prefix) {
      var p = prefix + ':';
      return {
        get: function (k, d) { return S.get(p + k, d); },
        set: function (k, v) { return S.set(p + k, v); },
        del: function (k) { return S.del(p + k); },
        keys: function () {
          return S.keys()
            .filter(function (k) { return k.indexOf(p) === 0; })
            .map(function (k) { return k.slice(p.length); });
        },
        clear: function () {
          this.keys().forEach(function (k) { S.del(p + k); });
        },
      };
    },

    /* -------------------------------------------------- Sicherung */

    /* Alles als kopierbarer Text - der Rettungsanker unter file:// */
    exportCode: function () {
      var data = {};
      S.keys().forEach(function (k) { data[k] = S.raw(k); });
      var payload = { v: 1, app: 'hgh', t: Date.now(), d: data };
      return U.b64enc(JSON.stringify(payload));
    },

    importCode: function (code) {
      var payload;
      try { payload = JSON.parse(U.b64dec(String(code).trim())); }
      catch (e) { return { ok: false, msg: 'Der Code ist unlesbar.' }; }
      if (!payload || payload.app !== 'hgh' || !payload.d) {
        return { ok: false, msg: 'Das ist kein Spielstand-Code von Herr Gehstocks Hideout.' };
      }
      var n = 0;
      for (var k in payload.d) {
        if (!Object.prototype.hasOwnProperty.call(payload.d, k)) continue;
        try {
          backend.setItem(PREFIX + k, payload.d[k]);
          n++;
        } catch (e) { mem[PREFIX + k] = payload.d[k]; n++; }
      }
      listeners.emit('imported', n);
      return { ok: true, count: n, when: payload.t };
    },

    clearAll: function () {
      S.keys().forEach(function (k) { S.del(k); });
      mem = {};
      listeners.emit('cleared');
    },

    /* Grobe Groesse in Byte - fuer die Einstellungen */
    size: function () {
      var n = 0;
      S.keys().forEach(function (k) {
        var v = S.raw(k);
        n += (k.length + (v ? v.length : 0)) * 2;
      });
      return n;
    },
  };
})(SG);
