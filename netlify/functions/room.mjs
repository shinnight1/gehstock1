/* ------------------------------------------------------------------
   Das Relais.

   Ein einziger Endpunkt fuer alles, was zwischen den Geraeten fliesst:
   Spielraeume, Chat, Verwaltung, Anwesenheit, Bildschirme, Protokoll,
   BND. Netlify hostet nur statisch - es gibt also keinen dauerhaften
   Socket und keinen Spielserver. Was es gibt, ist ein Blob-Speicher
   und Funktionen, die einige Sekunden offen bleiben duerfen.

   Drei Entscheidungen tragen das Ganze:

   1. EINE Verbindung je Geraet.
      Frueher hielt jedes iPad drei Anfragen gleichzeitig offen (Spiel,
      Chat, Verwaltung). Netlify laesst aber nur wenige Funktionen
      gleichzeitig laufen; ab drei Leuten standen die Anfragen Schlange
      und ein Zug brauchte Sekunden. Jetzt gibt es 'sync': eine Anfrage,
      die alles beobachtet, was das Geraet gerade interessiert.

   2. Die Warteschleife liest genau EIN kleines Dokument.
      'welt' ist ein Inhaltsverzeichnis: je Kanal nur eine Zahl. Erst
      wenn sich eine davon aendert, werden die grossen Dokumente
      geholt. Damit kostet Warten fast nichts und bleibt trotzdem
      schnell.

   3. Warten schreibt nicht.
      Der alte Poll schrieb den Raum zurueck, um Anwesenheit zu merken.
      Lief parallel ein Zug, ueberschrieb der Poll ihn - der Zug war
      weg und der Client wartete auf eine Version, die nie kam. Genau
      das waren die langen Haenger. Anwesenheit liegt jetzt getrennt
      in 'welt' und wird hoechstens alle 20 Sekunden geschrieben.

   Was der Server weiterhin NICHT tut: Spielregeln kennen. Er speichert
   die Liste der Zuege, jeder Client rechnet sie selbst nach.
   ------------------------------------------------------------------ */

import { getStore } from '@netlify/blobs';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // ohne 0/O/1/I
const ROOM_TTL_MS = 20 * 60 * 1000;                    // 20 Minuten ohne Aktivitaet
const POLL_MS = 7500;                                  // unter dem Funktionslimit bleiben
const POLL_TICK = 200;
const MAX_LOG = 4000;

const CHAT_MAX = 250;                                  // Nachrichten je Brett
const CHAT_TEXT_MAX = 1000;
const PROTO_MAX = 400;                                 // Protokolleintraege
const BEFEHL_MAX = 40;
const PRAESENZ_TTL = 90 * 1000;
const PRAESENZ_SCHREIB_MS = 45 * 1000;
const BILD_MAX = 700 * 1024;                           // Base64-Laenge
const SCHIRM_MAX = 260 * 1024;

/* Dasselbe Geheimnis wie in src/core/auth.js. Der Server kann damit
   wenigstens pruefen, dass eine Anfrage von jemandem mit gueltigem
   Code kommt - Rollen kennt er weiterhin nicht, die stehen in der
   Verwaltung. Aendert sich GEHEIM dort, muss es hier mitwandern. */
const GEHEIM = 'gehstock:hideout:2026:kellergewoelbe';
const RASTER = 97;

function streu(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
  }
  return h >>> 0;
}

function codeGueltig(code) {
  const c = String(code || '').replace(/\D/g, '');
  if (c.length !== 4) return false;
  return streu('code:' + c + ':' + GEHEIM) % RASTER === 0;
}

function store() {
  return getStore({ name: 'hgh-rooms', consistency: 'strong' });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function fail(msg, status = 400) {
  return json({ error: msg }, status);
}

function newId(n = 8) {
  let s = '';
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function newCode() {
  let c = '';
  for (let i = 0; i < 6; i++) c += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return c;
}

const schlaf = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------
   Schreiben ohne verlorene Aenderungen

   Der Blob-Speicher kennt kein "erhoehe um eins". Zwei Schreibvorgaenge
   kurz hintereinander koennen sich deshalb gegenseitig ueberholen -
   genau daran gingen frueher Zuege verloren. Deshalb: lesen, aendern,
   schreiben, wieder lesen. Steht die eigene Marke nicht drin, hat
   jemand anderes gewonnen und es geht von vorn los.
   ------------------------------------------------------------------ */

async function mutiere(st, key, fn, versuche = 6) {
  let letzte = null;
  for (let i = 0; i < versuche; i++) {
    const roh = await st.get(key, { type: 'json' });
    const kopie = roh ? JSON.parse(JSON.stringify(roh)) : null;
    const neu = fn(kopie);
    if (!neu) return roh;                       // Aenderung abgesagt
    const marke = 'm' + Date.now().toString(36) + newId(6);
    neu._m = marke;
    await st.setJSON(key, neu);
    const nach = await st.get(key, { type: 'json' });
    if (nach && nach._m === marke) return nach;
    letzte = nach;
    await schlaf(15 + Math.random() * 55);
  }
  return letzte;
}

/* ------------------------------------------------------------------
   welt - das Inhaltsverzeichnis

   Klein halten! Dieses Dokument wird in der Warteschleife alle 200 ms
   gelesen. Alles Grosse (Nachrichten, Bilder, Zuege) liegt woanders,
   hier steht nur, ob sich dort etwas getan hat.
   ------------------------------------------------------------------ */

function leereWelt() {
  return {
    version: 1,        // aendert sich bei Inhalten (Kanaele, Verwaltung, Befehle)
    pv: 1,             // aendert sich bei Anwesenheit und Bildschirmen
    kanaele: {},       // name -> Version
    verw: 0,           // Version der Verwaltung
    pix: 0,            // Version der Pixel-Weltkarte
    praesenz: {},      // geraet -> { code, name, rolle, wo, t }
    spiegelAn: [],     // Codes, deren Bildschirm gerade jemand sehen will
    spiegelBis: {},    // code -> bis wann die Anmeldung gilt
    spiegelV: {},      // code -> Version des letzten Bildes
    befehle: [],       // { id, ziel, art, ... } - kurzlebig
    bfId: 0,
  };
}

async function leseWelt(st) {
  const roh = await st.get('welt', { type: 'json' });
  if (!roh || typeof roh !== 'object') return leereWelt();
  return Object.assign(leereWelt(), roh);
}

/* Aufraeumen bei jedem Schreibvorgang - sonst waechst 'welt' still an
   und die Warteschleife wird wieder langsam. */
function weltPutzen(w) {
  const jetzt = Date.now();
  for (const g of Object.keys(w.praesenz)) {
    if (jetzt - (w.praesenz[g].t || 0) > PRAESENZ_TTL) delete w.praesenz[g];
  }
  w.befehle = (w.befehle || []).filter((b) => jetzt - (b.t || 0) < 5 * 60 * 1000);
  if (w.befehle.length > BEFEHL_MAX) w.befehle = w.befehle.slice(-BEFEHL_MAX);
  /* Ein Bildschirm wird nur so lange hochgeladen, wie ihn auch jemand
     ansieht. Wer sich nicht meldet, faellt nach einer Minute heraus. */
  w.spiegelBis = w.spiegelBis || {};
  w.spiegelAn = (w.spiegelAn || []).filter((c) => (w.spiegelBis[c] || 0) > jetzt);
  for (const c of Object.keys(w.spiegelBis)) {
    if (w.spiegelBis[c] < jetzt - 60000) delete w.spiegelBis[c];
  }
  return w;
}

/* Meldet eine Aenderung an einem Kanal und zaehlt die Weltversion hoch. */
async function weltBump(st, aend) {
  return mutiere(st, 'welt', (roh) => {
    const w = roh ? Object.assign(leereWelt(), roh) : leereWelt();
    aend(w);
    w.version = (w.version || 0) + 1;
    return weltPutzen(w);
  });
}

async function weltBumpP(st, aend) {
  return mutiere(st, 'welt', (roh) => {
    const w = roh ? Object.assign(leereWelt(), roh) : leereWelt();
    aend(w);
    w.pv = (w.pv || 0) + 1;
    return weltPutzen(w);
  });
}

/* Aendern, ohne jemanden zu wecken. Fuer das blosse Auffrischen eines
   Zeitstempels: dass jemand noch da ist, muss niemand sofort erfahren. */
async function weltStill(st, aend) {
  return mutiere(st, 'welt', (roh) => {
    const w = roh ? Object.assign(leereWelt(), roh) : leereWelt();
    aend(w);
    return weltPutzen(w);
  });
}

/* ------------------------------------------------------------------ Kanaele */

async function leseKanal(st, name) {
  const roh = await st.get('kanal:' + name, { type: 'json' });
  return roh && Array.isArray(roh.nachrichten) ? roh : { version: 0, nachrichten: [] };
}

function kanalName(roh) {
  return String(roh || 'kreis').replace(/[^a-z0-9_:-]/gi, '').slice(0, 40) || 'kreis';
}

/* ------------------------------------------------------------------ Raeume */

function publicRoom(room) {
  const now = Date.now();
  return {
    code: room.code,
    seed: room.seed,
    version: room.version,
    log: room.log,
    started: room.started,
    meta: room.meta || {},
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      seat: p.seat,
      connected: now - p.seen < 30000,
    })),
  };
}

async function readRoom(st, code) {
  if (!code || !/^[A-Z0-9]{4,8}$/.test(code)) return null;
  const room = await st.get('room:' + code, { type: 'json' });
  if (!room) return null;
  if (Date.now() - room.updated > ROOM_TTL_MS) {
    await st.delete('room:' + code).catch(() => {});
    return null;
  }
  return room;
}

/* ------------------------------------------------------------------ Einstieg */

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    });
  }
  if (req.method !== 'POST') return fail('method_not_allowed', 405);

  let msg;
  try {
    msg = await req.json();
  } catch {
    return fail('bad_json');
  }

  const st = store();
  const op = String(msg.op || '');

  try {
    if (op === 'sync') return await sync(st, msg);

    if (op === 'chat:post') return await chatPost(st, msg);
    if (op === 'chat:vote') return await chatVote(st, msg);
    if (op === 'chat:del') return await chatDel(st, msg);
    if (op === 'chat:patch') return await chatPatch(st, msg);
    if (op === 'chat:read') return await chatRead(st, msg);

    if (op === 'bild:put') return await bildPut(st, msg);
    if (op === 'bild:get') return await bildGet(st, msg);

    if (op === 'schirm:put') return await schirmPut(st, msg);
    if (op === 'schirm:get') return await schirmGet(st, msg);
    if (op === 'schirm:will') return await schirmWill(st, msg);

    if (op === 'befehl') return await befehl(st, msg);
    if (op === 'log') return await protokoll(st, msg);

    if (op === 'verw:read' || op === 'verw:write') return await verwaltung(st, op, msg);
    if (op === 'pix:read' || op === 'pix:write') return await pixel(st, op, msg);

    return await raum(st, op, msg);
  } catch (e) {
    return fail('server: ' + String((e && e.message) || e), 500);
  }
};

/* ==================================================================
   sync - die eine Verbindung

   Der Client sagt, was er beobachtet:
     { geraet, ich:{code,name,rolle}, wo,
       since, psince,
       kanaele: { kreis: 12, protokoll: 3 },
       raum:    { code:'ABC123', since: 44 },
       schirme: { '0141': 7 },
       praesenz: true }

   Zurueck kommt nur, was sich geaendert hat. Wenn nichts anliegt,
   bleibt die Anfrage einige Sekunden offen.
   ================================================================== */

async function sync(st, msg) {
  const geraet = String(msg.geraet || '').slice(0, 40);
  const ich = msg.ich && typeof msg.ich === 'object' ? msg.ich : null;
  const since = Number(msg.since) || 0;
  const psince = Number(msg.psince) || 0;
  const wKan = (msg.kanaele && typeof msg.kanaele === 'object') ? msg.kanaele : {};
  const wRaum = (msg.raum && msg.raum.code) ? String(msg.raum.code).toUpperCase() : null;
  const rSince = Number(msg.raum && msg.raum.since) || 0;
  const wSchirm = (msg.schirme && typeof msg.schirme === 'object') ? msg.schirme : {};
  const willPraesenz = !!msg.praesenz;

  /* Anwesenheit eintragen - aber nur, wenn der Eintrag alt ist oder
     sich der Aufenthaltsort geaendert hat. Sonst schreibt jede
     Verbindung alle paar Sekunden und weckt alle anderen mit. */
  if (geraet && ich && codeGueltig(ich.code)) {
    const w0 = await leseWelt(st);
    const alt = w0.praesenz[geraet];
    const neu = {
      code: String(ich.code).slice(0, 4),
      name: String(ich.name || '').slice(0, 24),
      rolle: String(ich.rolle || 'S').slice(0, 1),
      wo: String(msg.wo || '').slice(0, 40),
      geraet: geraet,
      art: String(msg.art || '').slice(0, 24),
      t: Date.now(),
    };
    /* Zwei Faelle auseinanderhalten: hat sich wirklich etwas geaendert
       (jemand ist neu da oder woanders hingegangen), muessen die
       Zuschauer geweckt werden. Wird nur der Zeitstempel aufgefrischt,
       darf das niemanden stoeren - sonst wacht bei jedem Geraet im
       Minutentakt die ganze Runde auf. */
    const anders = !alt || alt.wo !== neu.wo || alt.code !== neu.code
      || alt.name !== neu.name || alt.rolle !== neu.rolle;
    const alt2 = alt && (Date.now() - (alt.t || 0) > PRAESENZ_SCHREIB_MS);
    if (anders) await weltBumpP(st, (w) => { w.praesenz[geraet] = neu; });
    else if (alt2) await weltStill(st, (w) => { w.praesenz[geraet] = neu; });
  }

  const deadline = Date.now() + POLL_MS;
  let ersteRunde = true;

  for (;;) {
    const w = await leseWelt(st);
    const antwort = { version: w.version, pv: w.pv };
    let etwas = false;

    /* --- Kanaele --- */
    const kOut = {};
    for (const name of Object.keys(wKan)) {
      const k = kanalName(name);
      if ((w.kanaele[k] || 0) > (Number(wKan[name]) || 0)) {
        kOut[k] = await leseKanal(st, k);
        etwas = true;
      }
    }
    if (Object.keys(kOut).length) antwort.kanaele = kOut;

    /* --- Verwaltung --- */
    if (msg.verw !== undefined && (w.verw || 0) > (Number(msg.verw) || 0)) {
      const v = await st.get('verwaltung', { type: 'json' });
      antwort.verw = v && typeof v === 'object' ? v : { version: 0, daten: {} };
      etwas = true;
    }

    /* --- Weltkarte --- */
    if (msg.pix !== undefined && (w.pix || 0) > (Number(msg.pix) || 0)) {
      const pd = await st.get('wplace', { type: 'json' });
      antwort.pix = pixAntwort(pd, Number(msg.pix) || 0);
      etwas = true;
    }

    /* --- Spielraum --- */
    if (wRaum) {
      const rv = w.kanaele['raum:' + wRaum] || 0;
      if (rv > rSince) {
        const room = await readRoom(st, wRaum);
        antwort.raum = room ? publicRoom(room) : { closed: true, reason: 'room_gone' };
        etwas = true;
      }
    }

    /* --- Befehle an dieses Geraet --- */
    const bf = (w.befehle || []).filter((b) => {
      if ((b.id || 0) <= (Number(msg.befehl) || 0)) return false;
      if (b.ziel === '*') return true;
      if (ich && b.ziel === String(ich.code)) return true;
      return b.ziel === geraet;
    });
    if (bf.length) { antwort.befehle = bf; etwas = true; }

    /* --- Anwesenheit und Bildschirme --- */
    if (willPraesenz && w.pv > psince) {
      antwort.praesenz = Object.keys(w.praesenz).map((g) => w.praesenz[g]);
      antwort.spiegelAn = w.spiegelAn || [];
      antwort.spiegelV = w.spiegelV || {};
      etwas = true;
    }
    for (const c of Object.keys(wSchirm)) {
      if (((w.spiegelV && w.spiegelV[c]) || 0) > (Number(wSchirm[c]) || 0)) {
        antwort.schirme = antwort.schirme || {};
        const b = await st.get('schirm:' + c, { type: 'json' });
        if (b) antwort.schirme[c] = b;
        etwas = true;
      }
    }

    /* Wer gerade beobachtet wird, muss das sofort erfahren - sonst
       laedt er sein Bild erst nach der naechsten Runde hoch. */
    const beobachtet = !!(ich && (w.spiegelAn || []).indexOf(String(ich.code)) >= 0);
    antwort.spiegelMich = beobachtet;
    if (beobachtet && ersteRunde) etwas = true;

    if (etwas || w.version > since) return json(antwort);
    ersteRunde = false;

    if (Date.now() >= deadline) {
      return json({ version: w.version, pv: w.pv, spiegelMich: beobachtet, leer: true });
    }
    await schlaf(POLL_TICK);
  }
}

/* ==================================================================
   Chat und alle anderen Kanaele

   Ein Kanal ist eine Liste von Nachrichten. Was drin steht, ist dem
   Server egal: Text, ein Bildverweis, eine Umfrage, ein Antrag oder
   ein Protokolleintrag - alles derselbe Mechanismus.
   ================================================================== */

async function chatPost(st, msg) {
  const brett = kanalName(msg.brett);
  const text = String(msg.text || '').slice(0, CHAT_TEXT_MAX);
  const hatBild = msg.bild && typeof msg.bild === 'object';
  const hatUmfrage = msg.umfrage && typeof msg.umfrage === 'object';
  const hatZusatz = msg.zusatz && typeof msg.zusatz === 'object';
  if (!text.trim() && !hatBild && !hatUmfrage && !hatZusatz) return fail('leer');

  const grenze = brett === 'protokoll' ? PROTO_MAX : CHAT_MAX;
  let neue = null;

  await mutiere(st, 'kanal:' + brett, (roh) => {
    const k = roh && Array.isArray(roh.nachrichten) ? roh : { version: 0, nachrichten: [] };
    k.version++;
    neue = {
      id: k.version,
      von: String(msg.von || 'Unbekannt').slice(0, 24),
      code: codeGueltig(msg.code) ? String(msg.code) : '',
      rolle: String(msg.rolle || 'S').slice(0, 1),
      text: text,
      t: Date.now(),
    };
    if (hatBild) {
      neue.bild = {
        id: String(msg.bild.id || '').slice(0, 24),
        w: Number(msg.bild.w) || 0,
        h: Number(msg.bild.h) || 0,
      };
    }
    if (hatUmfrage) {
      neue.umfrage = {
        frage: String(msg.umfrage.frage || '').slice(0, 200),
        optionen: (msg.umfrage.optionen || []).slice(0, 8)
          .map((o) => String(o || '').slice(0, 80)),
        mehrfach: !!msg.umfrage.mehrfach,
        offen: msg.umfrage.offen !== false,
        stimmen: {},
      };
    }
    if (hatZusatz) neue.zusatz = msg.zusatz;
    k.nachrichten.push(neue);
    if (k.nachrichten.length > grenze) k.nachrichten = k.nachrichten.slice(-grenze);
    return k;
  });

  await weltBump(st, (w) => { w.kanaele[brett] = (w.kanaele[brett] || 0) + 1; });
  const k = await leseKanal(st, brett);
  return json({ version: k.version, nachrichten: k.nachrichten, neu: neue });
}

async function chatVote(st, msg) {
  const brett = kanalName(msg.brett);
  const id = Number(msg.id) || 0;
  const code = String(msg.code || '');
  if (!codeGueltig(code)) return fail('kein_code', 403);

  await mutiere(st, 'kanal:' + brett, (roh) => {
    const k = roh && Array.isArray(roh.nachrichten) ? roh : null;
    if (!k) return null;
    const n = k.nachrichten.find((x) => x.id === id);
    if (!n || !n.umfrage || !n.umfrage.offen) return null;
    const wahl = Array.isArray(msg.wahl) ? msg.wahl.map(Number) : [Number(msg.wahl)];
    const gueltig = wahl.filter((i) => i >= 0 && i < n.umfrage.optionen.length);
    if (!gueltig.length) delete n.umfrage.stimmen[code];
    else n.umfrage.stimmen[code] = n.umfrage.mehrfach ? gueltig : [gueltig[0]];
    k.version++;
    return k;
  });

  await weltBump(st, (w) => { w.kanaele[brett] = (w.kanaele[brett] || 0) + 1; });
  const k = await leseKanal(st, brett);
  return json({ version: k.version, nachrichten: k.nachrichten });
}

/* Loeschen laesst eine Spur zurueck. Eine Nachricht, die spurlos
   verschwindet, sieht aus wie ein Fehler - und im Protokoll soll ja
   auch stehen, was weg ist. */
async function chatDel(st, msg) {
  const brett = kanalName(msg.brett);
  const id = Number(msg.id) || 0;
  let entfernt = null;

  await mutiere(st, 'kanal:' + brett, (roh) => {
    const k = roh && Array.isArray(roh.nachrichten) ? roh : null;
    if (!k) return null;
    const n = k.nachrichten.find((x) => x.id === id);
    if (!n || n.weg) return null;
    entfernt = { von: n.von, text: n.text, bild: !!n.bild, umfrage: !!n.umfrage };
    n.weg = { von: String(msg.von || 'Admin').slice(0, 24), t: Date.now() };
    n.text = '';
    delete n.bild;
    delete n.umfrage;
    k.version++;
    return k;
  });

  if (!entfernt) return json({ ok: false });
  await weltBump(st, (w) => { w.kanaele[brett] = (w.kanaele[brett] || 0) + 1; });
  const k = await leseKanal(st, brett);
  return json({ version: k.version, nachrichten: k.nachrichten, entfernt: entfernt });
}

/* Felder einer Nachricht aendern - fuer Antraege (angenommen/abgelehnt)
   und zum Schliessen einer Umfrage. Bewusst eine feste Liste: sonst
   liesse sich hier alles ueberschreiben. */
const PATCH_ERLAUBT = ['status', 'erledigtVon', 'erledigtT', 'notiz', 'offen'];

async function chatPatch(st, msg) {
  const brett = kanalName(msg.brett);
  const id = Number(msg.id) || 0;
  const feld = msg.feld && typeof msg.feld === 'object' ? msg.feld : {};

  await mutiere(st, 'kanal:' + brett, (roh) => {
    const k = roh && Array.isArray(roh.nachrichten) ? roh : null;
    if (!k) return null;
    const n = k.nachrichten.find((x) => x.id === id);
    if (!n) return null;
    for (const f of PATCH_ERLAUBT) {
      if (!(f in feld)) continue;
      if (f === 'offen') { if (n.umfrage) n.umfrage.offen = !!feld.offen; }
      else n[f] = feld[f];
    }
    k.version++;
    return k;
  });

  await weltBump(st, (w) => { w.kanaele[brett] = (w.kanaele[brett] || 0) + 1; });
  const k = await leseKanal(st, brett);
  return json({ version: k.version, nachrichten: k.nachrichten });
}

/* Einmal lesen, ohne zu warten - beim Betreten eines Bretts */
async function chatRead(st, msg) {
  const brett = kanalName(msg.brett);
  const k = await leseKanal(st, brett);
  return json({ version: k.version, nachrichten: k.nachrichten });
}

/* Protokoll ist ein Kanal wie jeder andere, nur mit eigener Tuer:
   ein Eintrag hat keine freie Textnachricht, sondern Art und Ziel. */
async function protokoll(st, msg) {
  const e = msg.eintrag && typeof msg.eintrag === 'object' ? msg.eintrag : null;
  if (!e) return fail('leer');
  return chatPost(st, {
    brett: 'protokoll',
    von: msg.von, code: msg.code, rolle: msg.rolle,
    text: String(e.text || '').slice(0, 400),
    zusatz: {
      art: String(e.art || 'info').slice(0, 24),
      ziel: String(e.ziel || '').slice(0, 40),
      wo: String(e.wo || '').slice(0, 60),
    },
  });
}

/* ==================================================================
   Bilder

   Liegen einzeln im Speicher, nicht in der Nachricht. Sonst muesste
   die Warteschleife bei jeder neuen Nachricht das ganze Brett samt
   Bildern uebertragen. Die Vorschau ist winzig und wird zuerst
   geladen, das grosse Bild erst beim Antippen.
   ================================================================== */

async function bildPut(st, msg) {
  const voll = String(msg.data || '');
  const mini = String(msg.mini || '');
  if (!voll || voll.length > BILD_MAX) return fail('zu_gross');
  const id = newId(12);
  await st.setJSON('bild:' + id, {
    data: voll, w: Number(msg.w) || 0, h: Number(msg.h) || 0, t: Date.now(),
  });
  if (mini) await st.setJSON('bildm:' + id, { data: mini, t: Date.now() });
  return json({ id: id });
}

async function bildGet(st, msg) {
  const id = String(msg.id || '').replace(/[^a-z0-9]/gi, '').slice(0, 24);
  if (!id) return fail('kein_bild', 404);
  const key = msg.mini ? 'bildm:' + id : 'bild:' + id;
  const b = await st.get(key, { type: 'json' });
  if (!b) return fail('kein_bild', 404);
  return json(b);
}

/* ==================================================================
   Bildschirme

   Ein Geraet laedt nur dann Bilder hoch, wenn jemand hinsieht. Wer
   zusehen will, meldet das mit 'schirm:will' an; die Anmeldung
   verfaellt nach einer Minute von selbst.
   ================================================================== */

async function schirmWill(st, msg) {
  const codes = (msg.codes || []).slice(0, 12)
    .map((c) => String(c).replace(/\D/g, '').slice(0, 4))
    .filter(codeGueltig);
  await weltBumpP(st, (w) => {
    w.spiegelBis = w.spiegelBis || {};
    const bis = Date.now() + 60000;
    for (const c of codes) {
      w.spiegelBis[c] = bis;
      if (w.spiegelAn.indexOf(c) < 0) w.spiegelAn.push(c);
    }
  });
  return json({ ok: true });
}

async function schirmPut(st, msg) {
  const code = String(msg.code || '').replace(/\D/g, '').slice(0, 4);
  if (!codeGueltig(code)) return fail('kein_code', 403);
  const data = String(msg.data || '');
  if (data.length > SCHIRM_MAX) return fail('zu_gross');
  await st.setJSON('schirm:' + code, {
    code: code,
    data: data,
    wo: String(msg.wo || '').slice(0, 60),
    name: String(msg.name || '').slice(0, 24),
    w: Number(msg.w) || 0,
    h: Number(msg.h) || 0,
    t: Date.now(),
  });
  await weltBumpP(st, (w) => {
    w.spiegelV = w.spiegelV || {};
    w.spiegelV[code] = (w.spiegelV[code] || 0) + 1;
  });
  return json({ ok: true });
}

async function schirmGet(st, msg) {
  const code = String(msg.code || '').replace(/\D/g, '').slice(0, 4);
  const b = await st.get('schirm:' + code, { type: 'json' });
  return json(b || { leer: true });
}

/* ==================================================================
   Befehle

   Kurze Anweisungen an ein Geraet oder an alle: Tarnung an, Sitzung
   beenden, Befragung eingeleitet. Sie liegen in 'welt' und kommen
   ueber dieselbe Verbindung wie alles andere.
   ================================================================== */

async function befehl(st, msg) {
  const art = String(msg.art || '').slice(0, 24);
  if (!art) return fail('leer');
  let id = 0;
  await weltBump(st, (w) => {
    w.bfId = (w.bfId || 0) + 1;
    id = w.bfId;
    w.befehle.push({
      id: id,
      ziel: String(msg.ziel || '*').slice(0, 40),
      art: art,
      von: String(msg.von || '').slice(0, 24),
      text: String(msg.text || '').slice(0, 200),
      daten: msg.daten && typeof msg.daten === 'object' ? msg.daten : null,
      t: Date.now(),
    });
  });
  return json({ ok: true, id: id });
}

/* ==================================================================
   Verwaltung
   ================================================================== */

async function verwaltung(st, op, msg) {
  if (op === 'verw:write') {
    const neu = await mutiere(st, 'verwaltung', (roh) => ({
      version: ((roh && roh.version) || 0) + 1,
      daten: msg.daten && typeof msg.daten === 'object' ? msg.daten : {},
      t: Date.now(),
    }));
    await weltBump(st, (w) => { w.verw = (neu && neu.version) || (w.verw + 1); });
    return json(neu || { version: 0, daten: {} });
  }

  const v = await st.get('verwaltung', { type: 'json' });
  return json(v && typeof v === 'object' ? v : { version: 0, daten: {} });
}


/* ==================================================================
   W-Places: die gemeinsame Pixel-Weltkarte

   Ein einziges Dokument mit allen bemalten Feldern. Dazu ein kurzes
   Aenderungsprotokoll: wer schon fast auf dem Stand ist, bekommt nur
   die letzten Striche statt der ganzen Karte. Ohne das waere jeder
   gesetzte Punkt ein Download der kompletten Leinwand.
   ================================================================== */

const PIX_LOG = 400;          // so viele Aenderungen bleiben im Protokoll
const PIX_MAX = 60000;        // so viele bemalte Felder haelt die Karte
const PIX_PRO_ZUG = 400;      // hoechstens so viele Felder je Anfrage

async function pixel(st, op, msg) {
  if (op === 'pix:write') {
    const roh = Array.isArray(msg.striche) ? msg.striche.slice(0, PIX_PRO_ZUG) : [];
    const von = String(msg.von || '').slice(0, 24);
    const code = String(msg.code || '').slice(0, 4);

    const striche = [];
    for (const p of roh) {
      if (!p || typeof p !== 'object') continue;
      const n = Number(p.n);
      const c = Number(p.c);
      if (!Number.isInteger(n) || n < 0 || n >= 720 * 360) continue;
      if (!Number.isInteger(c) || c < 0 || c > 32) continue;
      striche.push({ n, c });
    }
    if (!striche.length) return fail('leer');

    const neu = await mutiere(st, 'wplace', (alt) => {
      const doc = (alt && typeof alt === 'object') ? alt : { version: 0, pixel: {}, log: [] };
      doc.pixel = doc.pixel || {};
      doc.log = doc.log || [];
      for (const p of striche) {
        if (p.c === 0) delete doc.pixel[p.n];
        else if (Object.keys(doc.pixel).length < PIX_MAX || doc.pixel[p.n] !== undefined) {
          doc.pixel[p.n] = p.c;
        }
      }
      doc.version = (doc.version || 0) + 1;
      doc.log.push({ v: doc.version, s: striche, von, code, t: Date.now() });
      if (doc.log.length > PIX_LOG) doc.log = doc.log.slice(-PIX_LOG);
      return doc;
    });

    await weltBump(st, (w) => { w.pix = (neu && neu.version) || ((w.pix || 0) + 1); });
    return json({ ok: true, version: (neu && neu.version) || 0 });
  }

  const doc = await st.get('wplace', { type: 'json' });
  return json(pixAntwort(doc, Number(msg.since) || 0));
}

/* Entweder nur die Aenderungen oder die ganze Karte - je nachdem, wie
   weit der Fragende zurueckliegt. */
function pixAntwort(doc, since) {
  const d = (doc && typeof doc === 'object') ? doc : { version: 0, pixel: {}, log: [] };
  const log = d.log || [];
  const aeltester = log.length ? log[0].v : d.version + 1;

  if (since > 0 && since >= aeltester - 1 && since <= d.version) {
    const striche = [];
    for (const e of log) if (e.v > since) for (const p of e.s) striche.push(p);
    return { version: d.version, striche, teil: true };
  }
  return { version: d.version, pixel: d.pixel || {}, teil: false };
}

/* ==================================================================
   Spielraeume

   Wie vorher, mit einem entscheidenden Unterschied: gewartet wird
   ausschliesslich in 'sync', und Warten schreibt nichts. Frueher
   schrieb jeder Poll den Raum zurueck und konnte damit einen
   gleichzeitigen Zug ueberschreiben - der Zug war weg, der Client
   wartete auf eine Version, die nie kam. Das waren die Haenger.
   ================================================================== */

async function raum(st, op, msg) {
  if (op === 'create') {
    const seats = Math.max(2, Math.min(8, Number(msg.seats) || 2));
    let code = newCode();
    for (let i = 0; i < 5; i++) {
      const da = await st.get('room:' + code, { type: 'json' });
      if (!da) break;
      code = newCode();
    }
    const player = {
      id: 'p' + newId(),
      token: newId(16),
      name: String(msg.name || 'Spieler').slice(0, 14),
      seat: 0,
      seen: Date.now(),
    };
    const room = {
      code,
      game: String(msg.game || ''),
      seats,
      seed: (Math.random() * 0x7fffffff) | 0,
      version: 1,
      log: [],
      started: false,
      meta: msg.opts || {},
      players: [player],
      created: Date.now(),
      updated: Date.now(),
    };
    await st.setJSON('room:' + code, room);
    await weltBump(st, (w) => { w.kanaele['raum:' + code] = 1; });
    return json({
      ...publicRoom(room),
      playerId: player.id,
      token: player.token,
      seat: 0,
      isHost: true,
    });
  }

  const code = String(msg.code || '').toUpperCase();
  const vorhanden = await readRoom(st, code);
  if (!vorhanden) return fail('room_not_found', 404);

  if (op === 'join') {
    if (msg.game && vorhanden.game !== msg.game) return fail('game_mismatch', 409);
    let player = null;
    let fehler = null;
    const room = await mutiere(st, 'room:' + code, (r) => {
      if (!r) { fehler = 'room_not_found'; return null; }
      if (r.players.length >= r.seats) { fehler = 'room_full'; return null; }
      player = {
        id: 'p' + newId(),
        token: newId(16),
        name: String(msg.name || 'Spieler').slice(0, 14),
        seat: r.players.length,
        seen: Date.now(),
      };
      r.players.push(player);
      r.version++;
      r.updated = Date.now();
      return r;
    });
    if (fehler || !player || !room) return fail(fehler || 'room_full', 409);
    await weltBump(st, (w) => { w.kanaele['raum:' + code] = room.version; });
    return json({
      ...publicRoom(room),
      playerId: player.id,
      token: player.token,
      seat: player.seat,
      isHost: false,
    });
  }

  const me = vorhanden.players.find((p) => p.id === msg.playerId && p.token === msg.token);
  if (!me) return fail('bad_token', 403);

  if (op === 'resume') {
    return json({ ...publicRoom(vorhanden), seat: me.seat, isHost: me.seat === 0 });
  }

  if (op === 'start') {
    const room = await mutiere(st, 'room:' + code, (r) => {
      if (!r) return null;
      r.started = true;
      r.meta = { ...(r.meta || {}), ...(msg.meta || {}) };
      r.version++;
      r.updated = Date.now();
      const mich = r.players.find((p) => p.id === me.id);
      if (mich) mich.seen = Date.now();
      return r;
    });
    if (!room) return fail('room_not_found', 404);
    await weltBump(st, (w) => { w.kanaele['raum:' + code] = room.version; });
    return json(publicRoom(room));
  }

  if (op === 'act') {
    let voll = false;
    const room = await mutiere(st, 'room:' + code, (r) => {
      if (!r) return null;
      if (r.log.length >= MAX_LOG) { voll = true; return null; }
      r.log.push({ seat: me.seat, a: msg.action, t: Date.now() });
      r.version++;
      r.updated = Date.now();
      const mich = r.players.find((p) => p.id === me.id);
      if (mich) mich.seen = Date.now();
      return r;
    });
    if (voll) return fail('log_full', 409);
    if (!room) return fail('room_not_found', 404);
    await weltBump(st, (w) => { w.kanaele['raum:' + code] = room.version; });
    return json(publicRoom(room));
  }

  if (op === 'ping') {
    /* Nur Anwesenheit auffrischen. Selten genug, dass es keinen Zug
       ueberholen kann - und ohne Rueckgabe des ganzen Raums. */
    await mutiere(st, 'room:' + code, (r) => {
      if (!r) return null;
      const mich = r.players.find((p) => p.id === me.id);
      if (!mich) return null;
      if (Date.now() - mich.seen < 12000) return null;
      mich.seen = Date.now();
      r.updated = Date.now();
      return r;
    });
    return json({ ok: true });
  }

  if (op === 'leave') {
    let leer = false;
    const room = await mutiere(st, 'room:' + code, (r) => {
      if (!r) return null;
      r.players = r.players.filter((p) => p.id !== me.id);
      r.version++;
      r.updated = Date.now();
      leer = !r.players.length;
      return r;
    });
    if (leer) await st.delete('room:' + code).catch(() => {});
    await weltBump(st, (w) => {
      if (leer) delete w.kanaele['raum:' + code];
      else w.kanaele['raum:' + code] = (room && room.version) || 0;
    });
    return json({ ok: true });
  }

  /* Alter Client (zwischengespeicherte Seite): einmal antworten, damit
     er nicht in einer Fehlerschleife haengt. */
  if (op === 'poll') {
    const deadline = Date.now() + POLL_MS;
    while (Date.now() < deadline) {
      const frisch = await readRoom(st, code);
      if (!frisch) return json({ closed: true, reason: 'room_gone' });
      if (frisch.version > (Number(msg.since) || 0)) return json(publicRoom(frisch));
      await schlaf(POLL_TICK);
    }
    const letzte = await readRoom(st, code);
    return json(letzte ? publicRoom(letzte) : { closed: true, reason: 'room_gone' });
  }

  return fail('bad_op');
}
