/* ------------------------------------------------------------------
   Online-Match auf dem Geraet.

   Der Server entscheidet alles (Treffer, Leben, Punkte). Damit sich das
   trotzdem sofort anfuehlt, gilt:

     eigene Figur   wird vorhergesagt: jeder Befehl wird sofort mit
                    derselben Funktion gerechnet wie auf dem Server
                    (akteurSchritt). Kommt ein Zustand, setzt die Figur
                    auf den Serverstand und rechnet die noch nicht
                    bestaetigten Befehle nach. Kleine Abweichungen werden
                    ueber ein Zehntel Sekunde weich ausgeglichen.
     Schuesse       Muendungsfeuer, Ton, Rueckstoss und Leuchtspur kommen
                    sofort (die Streuung ist je Schuss festgelegt, darum
                    fliegt die Spur dorthin, wo auch der Server rechnet).
                    Trefferanzeige und Schaden kommen vom Server.
     andere Figuren werden 100 ms hinter dem Server gezeigt und zwischen
                    zwei Zustaenden weich verschoben. Mit jedem Befehl
                    geht mit, welchen Zeitpunkt man gerade sieht - der
                    Server spult fuer den Treffer genau dorthin zurueck.

   Nach aussen sieht das Spiel eine "Simulation" (this.spiegel) mit
   denselben Feldern wie im Bot-Match: Figuren, Punkte, Phase, Meldungen.
   ------------------------------------------------------------------ */

import { FIGUR, MATCH, TICK } from '../konfig.js';
import { befehlKopieren, neuerBefehl } from '../sim/befehl.js';
import { augenhoehe } from '../sim/bewegung.js';
import { GRAD, klemme, startwert, winkelDiff, zufallsquelle } from '../sim/mathe.js';
import { akteurSchritt, BOT_NAMEN, kugelRichtung, neuerAkteur } from '../sim/simulation.js';
import { strahlFigur } from '../sim/treffer.js';
import { nachSchuss, neueWaffe, streuungBerechnen } from '../sim/waffen.js';
import {
  BUENDEL, befehlQuantisieren, C_ECHO, echoSchreiben, eigenUebernehmen, eingabeSchreiben, halloSchreiben,
  Leser, neuerZustand, PFAD, rosterLesen, S_ALT, S_ECHO, S_ROSTER, S_VOLL, S_WILLKOMMEN, S_ZUSTAND,
  Schreiber, waffeSchreiben, zustandLesen,
} from './protokoll.js';

const OFFEN = 256;             // gemerkte unbestaetigte Befehle (gut vier Sekunden)
const PUFFER = 24;             // gemerkte Zustaende fuer das Verschieben
const VERZUG = 0.1;            // andere Figuren so weit hinter dem Server
const GLAETTEN = 12;           // 1/s - Korrektur der eigenen Figur klingt so ab

/* Diese Meldungen der eigenen Figur hat das Geraet schon selbst erzeugt. */
const EIGENE_VORHERSAGE = new Set(['schuss', 'einschlag', 'sprung', 'landung', 'schritt', 'rutschen', 'schutzEnde']);

const RICHTUNG = { x: 0, y: 0, z: 0 };
const ZONE = { zone: 0 };

/* Was das Spiel als Simulation sieht. */
class Spiegel {
  constructor(karte, welt) {
    this.karte = karte;
    this.welt = welt;
    this.online = true;
    this.akteure = [];
    for (let id = 0; id < 6; id++) {
      const a = neuerAkteur(id, BOT_NAMEN[id], id < 3 ? 0 : 1, true, 'sturmgewehr', 6);
      a.lebt = false;
      this.akteure.push(a);
    }
    this.spieler = null;
    this.punkte = [0, 0];
    this.phase = 'vorlauf';
    this.phasenZeit = 0;
    this.restzeit = MATCH.dauer;
    this.dauer = MATCH.dauer;
    this.zielPunkte = MATCH.zielPunkte;
    this.sieger = -1;
    this.runde = 0;
    this.zeit = 0;
    this.meldungen = [];
    this.pool = [];
    this.waffeWaehlen = () => {};
  }

  melden(typ, a, b, wert) {
    let m = this.pool[this.meldungen.length];
    if (!m) {
      m = { typ: '', a: -1, b: -1, wert: 0, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, kopf: false, toedlich: false, waffe: '', serie: 0 };
      this.pool.push(m);
    }
    m.typ = typ;
    m.a = a;
    m.b = b;
    m.wert = wert;
    m.x = 0; m.y = 0; m.z = 0;
    m.nx = 0; m.ny = 0; m.nz = 0;
    m.kopf = false;
    m.toedlich = false;
    m.waffe = '';
    m.serie = 0;
    this.meldungen.push(m);
    return m;
  }

  meldungenLeeren() {
    this.meldungen.length = 0;
  }
}

export class OnlineSpiel {
  /* o: { karte, welt, name, waffe, adresse, beiStatus(zustand, text), beiRoster(alt, neu) } */
  constructor(o) {
    this.o = o;
    this.spiegel = new Spiegel(o.karte, o.welt);
    this.spiegel.waffeWaehlen = (a, id) => this.waffeWaehlen(id);
    this.zustand = 'aus';
    this.ws = null;
    this.eigenId = -1;
    this.ich = null;
    this.schreiber = new Schreiber(256);

    // Vorhersage
    this.nr = 0;
    this.ack = 0;
    this.offen = [];
    for (let i = 0; i < OFFEN; i++) this.offen.push(neuerBefehl());
    this.ausgang = [neuerBefehl(), neuerBefehl(), neuerBefehl(), neuerBefehl()];
    this.ausgangN = 0;
    this.ausgangErste = 0;
    this.nachrechnen = false;
    this.schussZufall = zufallsquelle(1);
    this.kor = { x: 0, y: 0, z: 0 };
    this.korrekturen = 0;
    this.welt = o.welt;

    // Zustaende zum Verschieben der anderen Figuren
    this.puffer = [];
    for (let i = 0; i < PUFFER; i++) this.puffer.push(neuerZustand());
    this.pufferN = 0;
    this.letzterTakt = -1;
    this.versatz = null;          // Serverzeit - eigene Zeit (Sekunden)
    this.sichtTakt = 0;
    this.warteMeldungen = [];     // [takt, meldung] fremder Figuren, bis die Sicht dort ist
    this.rosterDaten = { eigenId: -1, plaetze: [] };
    this.roster = [];

    this.ping = 0;
    this.echoUhr = 0;
    this.empfangen = 0;
  }

  /* ------------------------------------------------------ Verbindung */

  verbinden() {
    const adresse = this.o.adresse
      || (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + PFAD;
    this.status('verbinde');
    let ws;
    try {
      ws = new WebSocket(adresse);
    } catch (e) {
      this.status('fehler', 'Keine Verbindung zum Server möglich.');
      return;
    }
    ws.binaryType = 'arraybuffer';
    this.ws = ws;
    this.wecker = setTimeout(() => {
      if (this.zustand === 'verbinde') {
        this.status('fehler', 'Der Server antwortet nicht.');
        this.trennen();
      }
    }, 8000);
    ws.onopen = () => {
      ws.send(halloSchreiben(this.schreiber, this.o.name, this.o.waffe).slice());
    };
    ws.onmessage = (e) => {
      try {
        this.nachricht(e.data);
      } catch (err) {
        this.status('fehler', 'Unverständliche Antwort vom Server.');
        this.trennen();
      }
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.zustand === 'verbinde') this.status('fehler', navigator.onLine === false
        ? 'Kein Internet. Die Bot-Lobby geht auch ohne.' : 'Der Server ist gerade nicht erreichbar.');
      else if (this.zustand === 'drin' || this.zustand === 'warte') this.status('weg', 'Verbindung verloren.');
    };
    ws.onerror = () => { /* onclose folgt */ };
  }

  status(z, text) {
    if (this.zustand === z) return;
    this.zustand = z;
    if (z !== 'verbinde') clearTimeout(this.wecker);
    if (this.o.beiStatus) this.o.beiStatus(z, text || '');
  }

  trennen() {
    clearTimeout(this.wecker);
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onclose = null;
      ws.onmessage = null;
      try { ws.close(1000); } catch (e) { /* egal */ }
    }
    if (this.zustand !== 'fehler' && this.zustand !== 'voll' && this.zustand !== 'alt') this.zustand = 'aus';
  }

  senden(bytes) {
    const ws = this.ws;
    if (!ws || ws.readyState !== 1) return;
    try {
      ws.send(bytes.slice());
    } catch (e) { /* onclose kuemmert sich */ }
  }

  nachricht(daten) {
    const l = new Leser(daten);
    const typ = l.u8();
    this.empfangen += daten.byteLength || 0;
    if (typ === S_ZUSTAND) this.zustandEmpfangen(l);
    else if (typ === S_ROSTER) this.rosterEmpfangen(l);
    else if (typ === S_WILLKOMMEN) {
      l.u16();
      this.eigenId = l.u8();
      this.ich = this.spiegel.akteure[this.eigenId];
      this.spiegel.spieler = this.ich;
      this.status('warte');
    } else if (typ === S_ECHO) {
      this.ping = Math.max(0, performance.now() - l.f64());
    } else if (typ === S_VOLL) {
      this.status('voll', 'Die Online-Runde ist voll (drei gegen drei). Probier es gleich nochmal – oder spiel die Bot-Lobby.');
      this.trennen();
    } else if (typ === S_ALT) {
      this.status('alt', 'Es gibt eine neue Version von Gehstock Ops. Bitte die Seite neu laden.');
      this.trennen();
    }
  }

  rosterEmpfangen(l) {
    const alt = this.roster.map((p) => ({ ...p }));
    rosterLesen(l, this.rosterDaten);
    const S = this.spiegel;
    if (this.rosterDaten.eigenId !== this.eigenId) {
      this.eigenId = this.rosterDaten.eigenId;
      this.ich = S.akteure[this.eigenId];
      S.spieler = this.ich;
    }
    for (const p of this.rosterDaten.plaetze) {
      const a = S.akteure[p.id];
      if (!a) continue;
      a.name = p.name;
      a.team = p.team;
      a.bot = !p.mensch;
    }
    this.roster = this.rosterDaten.plaetze.map((p) => ({ ...p }));
    if (this.o.beiRoster) this.o.beiRoster(alt, this.roster);
  }

  /* ------------------------------------------------------ Zustaende */

  zustandEmpfangen(l) {
    const jetzt = performance.now() / 1000;
    const z = this.puffer[this.pufferN % PUFFER];
    zustandLesen(l, z);
    if (z.takt <= this.letzterTakt) return;       // veraltet (sollte bei TCP nicht vorkommen)
    this.pufferN++;
    this.letzterTakt = z.takt;

    // Uhr: welcher Servertakt ist gerade? Frueh ankommende Zustaende
    // ziehen die Schaetzung schnell vor, spaete nur langsam zurueck.
    const probe = z.takt * TICK - jetzt;
    if (this.versatz === null || Math.abs(probe - this.versatz) > 1) this.versatz = probe;
    else if (probe > this.versatz) this.versatz += (probe - this.versatz) * 0.3;
    else this.versatz += (probe - this.versatz) * 0.03;

    const S = this.spiegel;
    const neueRunde = z.runde !== S.runde;
    S.runde = z.runde;
    S.phase = z.phase;
    S.phasenZeit = z.phasenZeit;
    S.restzeit = z.restzeit;
    S.punkte[0] = z.punkte[0];
    S.punkte[1] = z.punkte[1];
    S.sieger = z.sieger;
    S.zielPunkte = z.zielPunkte;
    if (neueRunde) this.rundeNeu = true;

    // Werte fuer die Tabelle gleich aus dem neuesten Zustand
    for (let i = 0; i < z.n; i++) {
      const r = z.akteure[i];
      const a = S.akteure[r.id];
      a.abschuesse = r.abschuesse;
      a.tode = r.tode;
      a.assists = r.assists;
    }

    if (this.ich && z.eigenId === this.eigenId) this.abgleichen(z);

    // Meldungen: eigene sofort, fremde erst, wenn die Sicht dort ist
    for (let i = 0; i < z.m; i++) {
      const e = z.meldungen[i];
      const eigen = e.a === this.eigenId;
      if (eigen && EIGENE_VORHERSAGE.has(e.typ)) continue;
      if (eigen || e.b === this.eigenId || e.typ === 'start' || e.typ === 'ende') this.meldungUebernehmen(e);
      else this.warteMeldungen.push([z.takt, this.kopie(e)]);
    }

    if (this.zustand === 'warte' && this.ich) this.status('drin');
  }

  kopie(e) {
    return {
      typ: e.typ, a: e.a, b: e.b, wert: e.wert, x: e.x, y: e.y, z: e.z, nx: e.nx, ny: e.ny, nz: e.nz,
      kopf: e.kopf, toedlich: e.toedlich, waffe: e.waffe, serie: e.serie,
    };
  }

  meldungUebernehmen(e) {
    const S = this.spiegel;
    // Holt niemand ab (Tab im Hintergrund), waechst die Liste nicht endlos.
    if (S.meldungen.length > 300) return;
    const m = S.melden(e.typ, e.a, e.b, e.wert);
    m.x = e.x; m.y = e.y; m.z = e.z;
    m.nx = e.nx; m.ny = e.ny; m.nz = e.nz;
    m.kopf = e.kopf;
    m.toedlich = e.toedlich;
    m.waffe = e.waffe;
    m.serie = e.serie;
    if (e.typ === 'treffer' && e.b >= 0 && S.akteure[e.b]) {
      const b = S.akteure[e.b];
      b.getroffenZeit = S.zeit;
      b.getroffenVon = e.a;
    }
    if (e.typ === 'abschuss' && e.b >= 0 && S.akteure[e.b]) {
      S.akteure[e.b].moerder = e.a;
    }
  }

  /* Eigene Figur auf den Serverstand setzen und die offenen Befehle
     nachrechnen. */
  abgleichen(z) {
    const ich = this.ich;
    const E = z.eigen;
    const warLebt = ich.lebt;
    const altNr = ich.lebenNr;
    const ax = ich.x, ay = ich.y, az = ich.z;
    if (ich.waffe.id !== E.waffe.id) ich.waffe = neueWaffe(E.waffe.id);
    eigenUebernehmen(E, ich);
    ich.leben = E.leben;
    ich.schutz = E.schutz;
    ich.respawnIn = E.respawnIn;
    ich.naechsteWaffe = E.naechsteWaffe || ich.naechsteWaffe;
    ich.schuesse = E.schuesse;
    ich.treffer = E.treffer;
    ich.kopftreffer = E.kopftreffer;
    ich.besteSerie = E.besteSerie;
    if (E.moerder >= 0) ich.moerder = E.moerder;
    if (warLebt && !ich.lebt) ich.todesZeit = this.spiegel.zeit;

    const r = this.datensatz(z, this.eigenId);
    const neuesLeben = ich.lebt && (!warLebt || altNr !== ich.lebenNr) && r;

    this.ack = z.ack;
    if (this.nr - this.ack < OFFEN) {
      this.nachrechnen = true;
      const laeuft = this.spiegel.phase === 'laeuft';
      for (let nr = this.ack + 1; nr <= this.nr; nr++) {
        if (!ich.lebt) break;
        ich.uhr = nr * TICK;
        akteurSchritt(this, ich, this.offen[nr % OFFEN], TICK, laeuft, ich.uhr);
      }
      this.nachrechnen = false;
    }
    // Neues Leben: Blickrichtung vom Spawnpunkt (nach dem Nachrechnen -
    // die offenen Befehle stammen noch aus der Todeskamera).
    if (neuesLeben) {
      ich.yaw = r.yaw;
      ich.pitch = 0;
      ich.pyaw = r.yaw;
      ich.ppitch = 0;
    }

    // Weich ausgleichen, solange es nur ein Stueck ist
    const dx = ax - ich.x, dy = ay - ich.y, dz = az - ich.z;
    const d = Math.hypot(dx, dy, dz);
    if (warLebt && ich.lebt && altNr === ich.lebenNr && d < 2) {
      if (d > 1e-4) {
        this.korrekturen++;
        this.kor.x += dx; this.kor.y += dy; this.kor.z += dz;
        ich.px -= dx; ich.py -= dy; ich.pz -= dz;
      }
    } else {
      this.kor.x = 0; this.kor.y = 0; this.kor.z = 0;
      ich.px = ich.x; ich.py = ich.y; ich.pz = ich.z;
    }
  }

  datensatz(z, id) {
    for (let i = 0; i < z.n; i++) if (z.akteure[i].id === id) return z.akteure[i];
    return null;
  }

  /* ---------------------------------------------- Vorhersage-Kontext */

  /* Fuer akteurSchritt: this ist die "Simulation" der eigenen Figur. */
  melden(typ, a, b, wert) {
    if (this.nachrechnen) return { x: 0, y: 0, z: 0 };
    return this.spiegel.melden(typ, a, b, wert);
  }

  get zeit() {
    return this.ich ? this.ich.uhr : 0;
  }

  schiessen(a, w) {
    if (a.schutz > 0) a.schutz = 0;
    if (this.nachrechnen) {
      nachSchuss(this, w);
      return;
    }
    const def = w.def;
    const augeY = a.y + augenhoehe(a);
    const yaw = a.yaw + w.rueckSeite * GRAD;
    const pitch = klemme(a.pitch + w.rueckHoch * GRAD, -1.55, 1.55);
    const streuRad = streuungBerechnen(a, w) * GRAD;
    const zufall = this.schussZufall;
    zufall.setzen(startwert(a.id + 1, w.schuesse, a.lebenNr));
    const schuss = this.spiegel.melden('schuss', a.id, -1, 0);
    schuss.waffe = def.id;
    for (let k = 0; k < def.kugeln; k++) {
      kugelRichtung(k, def.kugeln, streuRad, yaw, pitch, zufall, RICHTUNG);
      const max = def.reichweite.max;
      let t = this.welt.strahl(a.x, augeY, a.z, RICHTUNG.x, RICHTUNG.y, RICHTUNG.z, max);
      const nx = this.welt.nx, ny = this.welt.ny, nz = this.welt.nz;
      // Die Spur endet an der Figur, die man sieht - getroffen hat sie nur,
      // wenn der Server es meldet.
      let figur = false;
      const ix = RICHTUNG.x !== 0 ? 1 / RICHTUNG.x : 1e30;
      const iy = RICHTUNG.y !== 0 ? 1 / RICHTUNG.y : 1e30;
      const iz = RICHTUNG.z !== 0 ? 1 / RICHTUNG.z : 1e30;
      for (const b of this.spiegel.akteure) {
        if (b === a || !b.lebt || b.team === a.team) continue;
        const tb = strahlFigur(b, a.x, augeY, a.z, ix, iy, iz, t, ZONE);
        if (tb < t) { t = tb; figur = true; }
      }
      const hx = a.x + RICHTUNG.x * t, hy = augeY + RICHTUNG.y * t, hz = a.z + RICHTUNG.z * t;
      if (k === 0) { schuss.x = hx; schuss.y = hy; schuss.z = hz; }
      if (!figur && t < max) {
        const e = this.spiegel.melden('einschlag', a.id, -1, 0);
        e.x = hx; e.y = hy; e.z = hz;
        e.nx = nx; e.ny = ny; e.nz = nz;
        e.waffe = def.id;
      }
    }
    nachSchuss(this, w);
  }

  /* ------------------------------------------------------- Pro Schritt */

  /* Ein Befehl pro Simulationsschritt (60 pro Sekunde), vom Spiel
     gefuellt. Wird gerundet, sofort vorhergesagt und gebuendelt
     verschickt. */
  schritt(bef) {
    if (!this.ich || this.zustand !== 'drin') return;
    befehlQuantisieren(bef);
    const nr = ++this.nr;
    befehlKopieren(bef, this.offen[nr % OFFEN]);
    if (this.ausgangN === 0) this.ausgangErste = nr;
    befehlKopieren(bef, this.ausgang[this.ausgangN++]);
    const ich = this.ich;
    ich.px = ich.x; ich.py = ich.y; ich.pz = ich.z;
    ich.pyaw = ich.yaw; ich.ppitch = ich.pitch;
    if (ich.lebt) {
      ich.uhr = nr * TICK;
      akteurSchritt(this, ich, bef, TICK, this.spiegel.phase === 'laeuft', ich.uhr);
    }
    if (this.ausgangN >= BUENDEL) this.abschicken();
  }

  abschicken() {
    if (!this.ausgangN) return;
    this.senden(eingabeSchreiben(this.schreiber, this.ausgangErste, this.sichtTakt, this.ausgang, this.ausgangN));
    this.ausgangN = 0;
  }

  waffeWaehlen(id) {
    if (this.ich) this.ich.naechsteWaffe = id;
    this.senden(waffeSchreiben(this.schreiber, id));
  }

  /* ---------------------------------------------------------- Pro Bild */

  /* Uhr, Anzeige der anderen Figuren, Meldungen freigeben. */
  bild(dt) {
    const S = this.spiegel;
    S.zeit += dt;
    if (S.phase === 'laeuft') S.restzeit = Math.max(0, S.restzeit - dt);
    S.phasenZeit = Math.max(0, S.phasenZeit - dt);

    const f = Math.exp(-GLAETTEN * dt);
    this.kor.x *= f; this.kor.y *= f; this.kor.z *= f;

    if (this.versatz === null || !this.pufferN) return;
    const jetzt = performance.now() / 1000;
    const sicht = (jetzt + this.versatz - VERZUG) / TICK;
    // Nie rueckwaerts - und nach einer Pause nicht in alten Zustaenden haengen
    this.sichtTakt = Math.max(Math.min(this.sichtTakt, this.letzterTakt), sicht);
    if (this.sichtTakt < this.letzterTakt - 60) this.sichtTakt = this.letzterTakt - 6;
    this.verschieben(this.sichtTakt);

    const W = this.warteMeldungen;
    let n = 0;
    while (n < W.length && W[n][0] <= this.sichtTakt + 0.5) {
      this.meldungUebernehmen(W[n][1]);
      n++;
    }
    if (n) W.splice(0, n);
    if (W.length > 400) W.splice(0, W.length - 400);

    if (this.zustand === 'drin') {
      this.echoUhr -= dt;
      if (this.echoUhr <= 0) {
        this.echoUhr = 2;
        this.senden(echoSchreiben(this.schreiber, performance.now()));
      }
    }
  }

  /* Die anderen Figuren auf den Zeitpunkt t (Servertakt) setzen. */
  verschieben(t) {
    let A = null, B = null;
    const n = Math.min(this.pufferN, PUFFER);
    for (let i = 0; i < n; i++) {
      const z = this.puffer[(this.pufferN - 1 - i) % PUFFER];
      if (z.takt <= t) { A = z; break; }
      B = z;
    }
    if (!A) { A = B; B = null; }
    if (!A) return;
    const f = B ? klemme((t - A.takt) / Math.max(1, B.takt - A.takt), 0, 1) : 0;
    const S = this.spiegel;
    for (let i = 0; i < A.n; i++) {
      const ra = A.akteure[i];
      if (ra.id === this.eigenId) continue;
      const a = S.akteure[ra.id];
      let rb = B ? this.datensatz(B, ra.id) : null;
      if (rb && (rb.lebenNr !== ra.lebenNr || rb.lebt !== ra.lebt)) {
        // Tod oder Neustart dazwischen: nicht verschieben, sondern springen
        if (f >= 0.5) { this.setzen(a, rb, rb, 0); continue; }
        rb = null;
      }
      this.setzen(a, ra, rb || ra, rb ? f : 0);
    }
  }

  setzen(a, r, s, f) {
    const warLebt = a.lebt;
    a.lebt = r.lebt;
    if (warLebt && !a.lebt) a.todesZeit = this.spiegel.zeit;
    if (!warLebt && a.lebt) a.spawnZeit = this.spiegel.zeit;
    a.x = r.x + (s.x - r.x) * f;
    a.y = r.y + (s.y - r.y) * f;
    a.z = r.z + (s.z - r.z) * f;
    a.px = a.x; a.py = a.y; a.pz = a.z;
    a.yaw = r.yaw + winkelDiff(r.yaw, s.yaw) * f;
    a.pitch = r.pitch + (s.pitch - r.pitch) * f;
    a.pyaw = a.yaw;
    a.ppitch = a.pitch;
    a.vx = r.vx + (s.vx - r.vx) * f;
    a.vz = r.vz + (s.vz - r.vz) * f;
    a.vy = 0;
    a.duckAnteil = r.duckAnteil + (s.duckAnteil - r.duckAnteil) * f;
    const n = f < 0.5 ? r : s;
    a.geduckt = n.geduckt;
    a.hoehe = n.geduckt ? FIGUR.hoeheGeduckt : FIGUR.hoehe;
    a.sprintet = n.sprintet;
    a.amBoden = n.amBoden;
    a.rutschZeit = n.rutscht ? 0.1 : 0;
    a.schutz = n.schutz;
    a.leben = n.leben;
    a.lebenNr = n.lebenNr;
    if (r.waffe && a.waffe.id !== r.waffe) a.waffe = neueWaffe(r.waffe);
    a.waffe.schuesse = r.schuesse;
    a.waffe.visier = r.visier;
    a.waffe.laden = r.laedt ? 1 : 0;
  }

  /* Versatz der eigenen Figur durch Korrekturen, klingt schnell ab. */
  korrektur() {
    return this.kor;
  }
}
