/* ------------------------------------------------------------------
   WebSocket fuer den Handy-Server - ohne zusaetzliches Paket.

   Nur die Serverseite von RFC 6455, und nur so viel, wie Gehstock Ops
   braucht: Handschlag, Text- und Binaerrahmen (auch zerteilt), Ping,
   Pong, Schliessen. Keine Erweiterungen (Kompression lehnt der
   Handschlag stillschweigend ab, der Browser kommt ohne aus).

   Absichtlich streng: unmaskierte Rahmen vom Geraet, zu grosse
   Nachrichten und Protokollfehler schliessen die Verbindung. Wer nicht
   mehr antwortet, fliegt nach 30 Sekunden raus.
   ------------------------------------------------------------------ */

import crypto from 'node:crypto';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const PING_ALLE = 10000;
const STILL_MAX = 30000;
const STAU_MAX = 512 * 1024;       // so viel darf sich beim Senden stauen

/* Handschlag pruefen und beantworten. Gibt die Verbindung zurueck oder
   null (dann ist der Socket schon beantwortet und geschlossen). */
export function wsAnnehmen(req, socket, head, opt) {
  const o = opt || {};
  const key = req.headers['sec-websocket-key'];
  const ablehnen = (status, text) => {
    try {
      socket.end('HTTP/1.1 ' + status + ' ' + text + '\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
    } catch (e) { /* schon weg */ }
    socket.destroy();
    return null;
  };
  if (req.method !== 'GET' || !/websocket/i.test(req.headers.upgrade || '')
    || req.headers['sec-websocket-version'] !== '13' || typeof key !== 'string'
    || !/^[A-Za-z0-9+/]{22}==$/.test(key)) {
    return ablehnen(400, 'Bad Request');
  }
  /* Fremde Seiten duerfen keine Verbindung im Namen eines Besuchers
     aufbauen: kommt ein Origin mit, muss er zum Host passen. */
  const origin = req.headers.origin;
  if (origin) {
    let host = '';
    try { host = new URL(origin).host; } catch (e) { /* ungueltig */ }
    if (!host || host !== req.headers.host) return ablehnen(403, 'Forbidden');
  }
  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
    + 'Sec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  return new WsVerbindung(socket, head, o.maxNachricht || 4096);
}

export class WsVerbindung {
  constructor(socket, head, maxNachricht) {
    this.socket = socket;
    this.max = maxNachricht;
    this.offen = true;
    this.puffer = head && head.length ? Buffer.from(head) : Buffer.alloc(0);
    this.teile = [];
    this.teilGroesse = 0;
    this.teilArt = 0;
    this.zuletzt = Date.now();
    this.beiNachricht = null;    // (daten: Buffer, binaer: boolean)
    this.beiZu = null;           // ()
    try { socket.setNoDelay(true); } catch (e) { /* egal */ }
    socket.on('data', (d) => this.daten(d));
    socket.on('close', () => this.weg());
    socket.on('end', () => this.weg());
    socket.on('error', () => this.weg());
    this.pingTimer = setInterval(() => this.pruefen(), PING_ALLE);
    if (this.puffer.length) setImmediate(() => this.lesen());
  }

  pruefen() {
    if (!this.offen) return;
    if (Date.now() - this.zuletzt > STILL_MAX) {
      this.socket.destroy();
      this.weg();
      return;
    }
    this.rahmenSenden(9, Buffer.alloc(0));
  }

  daten(d) {
    if (!this.offen) return;
    this.zuletzt = Date.now();
    this.puffer = this.puffer.length ? Buffer.concat([this.puffer, d]) : d;
    this.lesen();
  }

  lesen() {
    while (this.offen) {
      const b = this.puffer;
      if (b.length < 2) return;
      const fin = (b[0] & 0x80) !== 0;
      const rsv = b[0] & 0x70;
      const art = b[0] & 0x0f;
      const maskiert = (b[1] & 0x80) !== 0;
      let laenge = b[1] & 0x7f;
      let pos = 2;
      if (rsv || !maskiert) return this.fehler(1002);
      if (laenge === 126) {
        if (b.length < 4) return;
        laenge = b.readUInt16BE(2);
        pos = 4;
      } else if (laenge === 127) {
        if (b.length < 10) return;
        if (b.readUInt32BE(2) !== 0) return this.fehler(1009);
        laenge = b.readUInt32BE(6);
        pos = 10;
      }
      if (laenge > this.max) return this.fehler(1009);
      if (b.length < pos + 4 + laenge) return;
      const m0 = b[pos], m1 = b[pos + 1], m2 = b[pos + 2], m3 = b[pos + 3];
      pos += 4;
      const nutz = Buffer.allocUnsafe(laenge);
      for (let i = 0; i < laenge; i++) {
        const m = (i & 3) === 0 ? m0 : (i & 3) === 1 ? m1 : (i & 3) === 2 ? m2 : m3;
        nutz[i] = b[pos + i] ^ m;
      }
      this.puffer = b.subarray(pos + laenge);
      this.rahmen(fin, art, nutz);
    }
  }

  rahmen(fin, art, nutz) {
    if (art >= 8) {
      // Steuerrahmen: nie zerteilt, hoechstens 125 Byte
      if (!fin || nutz.length > 125) return this.fehler(1002);
      if (art === 8) {
        const code = nutz.length >= 2 ? nutz.readUInt16BE(0) : 1000;
        this.schliessen(code === 1005 || code < 1000 ? 1000 : code);
      } else if (art === 9) {
        this.rahmenSenden(10, nutz);
      } else if (art !== 10) {
        this.fehler(1002);
      }
      return;
    }
    if (art === 0) {
      if (!this.teilArt) return this.fehler(1002);
    } else if (art === 1 || art === 2) {
      if (this.teilArt) return this.fehler(1002);
      this.teilArt = art;
      this.teile.length = 0;
      this.teilGroesse = 0;
    } else {
      return this.fehler(1002);
    }
    this.teilGroesse += nutz.length;
    if (this.teilGroesse > this.max) return this.fehler(1009);
    this.teile.push(nutz);
    if (!fin) return;
    const daten = this.teile.length === 1 ? this.teile[0] : Buffer.concat(this.teile);
    const binaer = this.teilArt === 2;
    this.teile.length = 0;
    this.teilArt = 0;
    this.teilGroesse = 0;
    if (this.beiNachricht) this.beiNachricht(daten, binaer);
  }

  rahmenSenden(art, nutz) {
    if (!this.offen) return false;
    const n = nutz.length;
    let kopf;
    if (n < 126) {
      kopf = Buffer.allocUnsafe(2);
      kopf[1] = n;
    } else if (n < 65536) {
      kopf = Buffer.allocUnsafe(4);
      kopf[1] = 126;
      kopf.writeUInt16BE(n, 2);
    } else {
      kopf = Buffer.allocUnsafe(10);
      kopf[1] = 127;
      kopf.writeUInt32BE(0, 2);
      kopf.writeUInt32BE(n, 6);
    }
    kopf[0] = 0x80 | art;
    try {
      this.socket.write(n ? Buffer.concat([kopf, nutz]) : kopf);
    } catch (e) {
      this.weg();
      return false;
    }
    // Wer nicht mitliest (Funkloch, eingeschlafenes Tablet), staut nicht
    // unbegrenzt Speicher auf dem Handy auf.
    if (this.socket.writableLength > STAU_MAX) {
      this.socket.destroy();
      this.weg();
      return false;
    }
    return true;
  }

  /* Binaer senden (Uint8Array oder Buffer). */
  senden(daten) {
    const b = Buffer.isBuffer(daten) ? daten : Buffer.from(daten.buffer, daten.byteOffset, daten.byteLength);
    return this.rahmenSenden(2, b);
  }

  schliessen(code, grund) {
    if (!this.offen) return;
    const text = Buffer.from(String(grund || '').slice(0, 100));
    const nutz = Buffer.allocUnsafe(2 + text.length);
    nutz.writeUInt16BE(code || 1000, 0);
    text.copy(nutz, 2);
    this.rahmenSenden(8, nutz);
    try { this.socket.end(); } catch (e) { /* egal */ }
    const s = this.socket;
    setTimeout(() => s.destroy(), 2000).unref();
    this.weg();
  }

  fehler(code) {
    this.schliessen(code);
  }

  weg() {
    if (!this.offen) return;
    this.offen = false;
    clearInterval(this.pingTimer);
    this.puffer = Buffer.alloc(0);
    this.teile.length = 0;
    const f = this.beiZu;
    this.beiZu = null;
    this.beiNachricht = null;
    if (f) f();
  }
}
