/* ------------------------------------------------------------------
   Menues: Start, Steuerung, Einstellungen, Pause, Auswertung, Fehler,
   Hinweis zum Querformat.

   Einfaches DOM ueber dem Spielbild. Jedes Menue ist ein eigener
   Bildschirm; es ist immer hoechstens einer offen (plus Einstellungen
   oder Steuerung als Ebene darueber).
   ------------------------------------------------------------------ */

import { BOT_REIHE, BOT_STUFEN, MATCH, QUALITAET, QUALITAET_REIHE, WAFFEN, WAFFEN_REIHE } from '../konfig.js';
import { tabelleBauen } from './hud.js';

function el(tag, klasse, kinder, text) {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (text !== undefined) e.textContent = text;
  if (kinder) for (const k of kinder) if (k) e.appendChild(k);
  return e;
}

function knopf(text, klasse, fn) {
  const b = el('button', 'm-knopf ' + (klasse || ''), null, text);
  b.type = 'button';
  b.addEventListener('click', (e) => {
    e.preventDefault();
    fn();
  });
  return b;
}

export class Menues {
  constructor(wurzel, app) {
    this.app = app;
    this.wurzel = wurzel;
    this.ebene = el('div', 'ops-menues');
    wurzel.appendChild(this.ebene);
    this.aktuell = null;
    this.ueber = null;

    // Hochformat-Hinweis: immer vorhanden, per CSS sichtbar
    this.hochkant = el('div', 'ops-hochkant', [
      el('div', 'h-symbol', null, '⟳'),
      el('div', 'h-titel', null, 'Bitte quer halten'),
      el('div', 'h-text', null, 'Gehstock Ops ist fürs Querformat gebaut. Dreh das iPad einfach um – das Spiel wartet so lange.'),
    ]);
    wurzel.appendChild(this.hochkant);

    this.hinweisEl = el('div', 'ops-hinweis');
    wurzel.appendChild(this.hinweisEl);
    this.hinweisTimer = 0;
  }

  zeigen(inhalt) {
    this.schliessen();
    this.aktuell = inhalt;
    this.ebene.appendChild(inhalt);
    this.ebene.classList.add('an');
    const erster = inhalt.querySelector('.m-start, .m-knopf.haupt');
    if (erster && this.app.eingabe && this.app.eingabe.modus === 'maus') {
      try { erster.focus({ preventScroll: true }); } catch (e) { /* egal */ }
    }
  }

  schliessen() {
    this.ueberSchliessen();
    if (this.aktuell) this.aktuell.remove();
    this.aktuell = null;
    this.ebene.classList.remove('an');
  }

  offen() {
    return !!this.aktuell;
  }

  ueberZeigen(inhalt) {
    this.ueberSchliessen();
    this.ueber = el('div', 'ops-ueber', [inhalt]);
    this.wurzel.appendChild(this.ueber);
  }

  ueberSchliessen() {
    if (this.ueber) this.ueber.remove();
    this.ueber = null;
  }

  hinweis(text, dauer) {
    this.hinweisEl.textContent = text;
    this.hinweisEl.classList.add('an');
    clearTimeout(this.hinweisTimer);
    this.hinweisTimer = setTimeout(() => this.hinweisEl.classList.remove('an'), dauer || 2600);
  }

  /* ---------------------------------------------------------- Start */

  haupt() {
    const app = this.app;
    const E = app.einst;
    const karten = el('div', 'm-karten');
    const waffenKarte = (id) => {
      const w = WAFFEN[id];
      const balken = (name, wert) => el('div', 'w-wert', [
        el('span', '', null, name),
        el('div', 'w-balken', [(() => { const i = el('i'); i.style.transform = 'scaleX(' + wert + ')'; return i; })()]),
      ]);
      const k = el('button', 'm-waffe' + (E.waffe === id ? ' gewaehlt' : ''), [
        el('div', 'w-name', null, w.name),
        el('div', 'w-modell', null, w.modell),
        el('div', 'w-kurz', null, w.kurz),
        balken('Schaden', w.werte.schaden),
        balken('Feuerrate', w.werte.feuerrate),
        balken('Reichweite', w.werte.reichweite),
        balken('Kontrolle', w.werte.kontrolle),
      ]);
      k.type = 'button';
      k.addEventListener('click', () => {
        app.einstellungSetzen('waffe', id);
        for (const c of karten.children) c.classList.toggle('gewaehlt', c === k);
        app.klang.spielen('klick', 0.6);
      });
      return k;
    };
    for (const id of WAFFEN_REIHE) karten.appendChild(waffenKarte(id));

    const stufen = el('div', 'm-chips');
    for (const id of BOT_REIHE) {
      const s = BOT_STUFEN[id];
      const b = el('button', 'm-chip' + (E.schwierigkeit === id ? ' gewaehlt' : ''), [
        el('span', 'c-name', null, s.name),
        el('span', 'c-kurz', null, s.kurz),
      ]);
      b.type = 'button';
      b.addEventListener('click', () => {
        app.einstellungSetzen('schwierigkeit', id);
        for (const c of stufen.children) c.classList.toggle('gewaehlt', c === b);
        app.klang.spielen('klick', 0.6);
      });
      stufen.appendChild(b);
    }

    const st = app.statistik;
    const statistik = st.matches
      ? 'Matches ' + st.matches + ' · Siege ' + st.siege + ' · Abschüsse ' + st.abschuesse + ' · beste Serie ' + st.besteSerie
      : 'Noch kein Match gespielt.';

    const inhalt = el('div', 'ops-menue haupt', [
      el('div', 'm-kopf', [
        el('div', 'm-logo', null, 'GEHSTOCK OPS'),
        el('div', 'm-unter', null, 'Team-Deathmatch · 3 gegen 3 · Übungsgelände Krähenfeld'),
      ]),
      el('div', 'm-rumpf', [
        el('div', 'm-spalte', [
          el('h2', '', null, 'Waffe'),
          karten,
        ]),
        el('div', 'm-spalte schmal', [
          el('h2', '', null, 'Gegner'),
          stufen,
          el('div', 'm-regeln', null,
            'Du und zwei Verbündete gegen drei Gegner. Wer zuerst ' + MATCH.zielPunkte
            + ' Abschüsse hat oder nach ' + Math.round(MATCH.dauer / 60) + ' Minuten vorn liegt, gewinnt.'),
          knopf('SPIELEN', 'm-start haupt', () => app.matchStarten()),
          el('div', 'm-leiste', [
            knopf('Steuerung', 'klein', () => this.steuerung()),
            knopf('Einstellungen', 'klein', () => this.einstellungen()),
            knopf('Zurück zum Hideout', 'klein zurueck', () => app.zumHideout()),
          ]),
          el('div', 'm-statistik', null, statistik),
        ]),
      ]),
    ]);
    this.zeigen(inhalt);
  }

  /* ------------------------------------------------------ Steuerung */

  steuerung(danach) {
    const zeilen = (liste) => el('div', 's-liste', liste.map(([t, b]) => el('div', 's-zeile', [
      el('span', 's-taste', null, t), el('span', 's-was', null, b),
    ])));
    const inhalt = el('div', 'ops-menue steuerung', [
      el('h2', '', null, 'Steuerung'),
      el('div', 's-spalten', [
        el('div', 's-block', [
          el('h3', '', null, 'iPad / Touch'),
          zeilen([
            ['Linke Hälfte', 'Daumen aufsetzen und ziehen: laufen'],
            ['Stick weit hoch', 'Sprinten'],
            ['Rechte Hälfte', 'Wischen: umsehen'],
            ['Feuerknopf', 'Schießen – beim Halten weiter umsehen'],
            ['Visier', 'Antippen: zielen an/aus'],
            ['⟳ / ▲ / ▼', 'Nachladen / Springen / Ducken'],
            ['Im Sprint ▼', 'Rutschen'],
            ['Punktestand', 'Antippen: Tabelle'],
          ]),
        ]),
        el('div', 's-block', [
          el('h3', '', null, 'Tastatur & Maus'),
          zeilen([
            ['W A S D', 'Laufen'],
            ['Maus', 'Umsehen (nach Klick ins Bild)'],
            ['Linke Taste', 'Schießen'],
            ['Rechte Taste', 'Zielen (halten)'],
            ['R', 'Nachladen'],
            ['Shift', 'Sprinten'],
            ['Leertaste', 'Springen'],
            ['C', 'Ducken, im Sprint rutschen'],
            ['Tab', 'Tabelle'],
            ['Esc / P', 'Pause'],
          ]),
        ]),
      ]),
      el('p', 's-tipp', null, 'Tipp: Aus der Hüfte streut jede Waffe stark. Im Visier triffst du auf Distanz, geduckt noch etwas besser. Deckung heilt – nach vier Sekunden ohne Treffer kommt die Gesundheit zurück.'),
      knopf('Verstanden', 'haupt', () => {
        this.app.einstellungSetzen('hilfeGesehen', true);
        this.ueberSchliessen();
        if (danach) danach();
      }),
    ]);
    this.ueberZeigen(inhalt);
  }

  /* ------------------------------------------------- Einstellungen */

  einstellungen() {
    const app = this.app;
    const E = app.einst;
    const regler = (titel, schluessel, min, max, schritt, anzeige) => {
      const wert = el('span', 'e-wert', null, anzeige(E[schluessel]));
      const r = document.createElement('input');
      r.type = 'range';
      r.min = String(min);
      r.max = String(max);
      r.step = String(schritt);
      r.value = String(E[schluessel]);
      r.addEventListener('input', () => {
        const v = Number(r.value);
        wert.textContent = anzeige(v);
        app.einstellungSetzen(schluessel, v);
      });
      return el('label', 'e-zeile', [el('span', 'e-titel', null, titel), r, wert]);
    };
    const schalter = (titel, schluessel, text) => {
      const c = document.createElement('input');
      c.type = 'checkbox';
      c.checked = !!E[schluessel];
      c.addEventListener('change', () => app.einstellungSetzen(schluessel, c.checked));
      return el('label', 'e-zeile schalter', [el('span', 'e-titel', [el('span', '', null, titel), text ? el('small', '', null, text) : null]), c]);
    };
    const auswahl = (titel, schluessel, optionen) => {
      const s = document.createElement('select');
      for (const [wert, name] of optionen) {
        const o = document.createElement('option');
        o.value = wert;
        o.textContent = name;
        if (E[schluessel] === wert) o.selected = true;
        s.appendChild(o);
      }
      s.addEventListener('change', () => app.einstellungSetzen(schluessel, s.value));
      return el('label', 'e-zeile', [el('span', 'e-titel', null, titel), s]);
    };
    const prozent = (v) => Math.round(v * 100) + ' %';
    const inhalt = el('div', 'ops-menue einstellungen', [
      el('h2', '', null, 'Einstellungen'),
      el('div', 'e-rollen', [
        el('div', 'e-gruppe', [
          el('h3', '', null, 'Steuerung'),
          regler('Blickempfindlichkeit (Touch)', 'empfTouch', 0.3, 3, 0.05, prozent),
          regler('Mausempfindlichkeit', 'empfMaus', 0.2, 4, 0.05, prozent),
          regler('Empfindlichkeit im Visier', 'empfVisier', 0.3, 1.5, 0.05, prozent),
          schalter('Zielhilfe (Touch)', 'zielhilfe', 'Bremst den Blick sanft am Gegner'),
          auswahl('Visierknopf (Touch)', 'visierModus', [['umschalten', 'Antippen schaltet'], ['halten', 'Halten zum Zielen']]),
          schalter('Feuerknopf links', 'linkerFeuerknopf'),
          regler('Knopfgröße (Touch)', 'knopfGroesse', 0.75, 1.35, 0.05, prozent),
          schalter('Blick vertikal umkehren', 'yUmkehren'),
        ]),
        el('div', 'e-gruppe', [
          el('h3', '', null, 'Grafik'),
          auswahl('Qualität', 'qualitaet', QUALITAET_REIHE.map((q) => [q, QUALITAET[q].name])),
          schalter('Dynamische Auflösung', 'dynamisch', 'Senkt die Auflösung, wenn es ruckelt'),
          regler('Sichtfeld', 'sichtfeld', 60, 95, 1, (v) => Math.round(v) + '°'),
          schalter('Bildrate anzeigen', 'fps'),
          el('h3', '', null, 'Ton'),
          regler('Lautstärke', 'lautstaerke', 0, 1, 0.05, prozent),
        ]),
      ]),
      knopf('Fertig', 'haupt', () => this.ueberSchliessen()),
    ]);
    this.ueberZeigen(inhalt);
  }

  /* ---------------------------------------------------------- Pause */

  pause() {
    const app = this.app;
    const inhalt = el('div', 'ops-menue pause', [
      el('div', 'm-logo klein', null, 'PAUSE'),
      el('div', 'p-stand', null, app.sim ? 'Blau ' + app.sim.punkte[0] + ' : ' + app.sim.punkte[1] + ' Rot' : ''),
      knopf('Weiter', 'haupt', () => app.fortsetzen()),
      el('div', 'm-leiste', [
        knopf('Einstellungen', 'klein', () => this.einstellungen()),
        knopf('Steuerung', 'klein', () => this.steuerung()),
        knopf('Match neu starten', 'klein', () => app.matchStarten()),
        knopf('Hauptmenü', 'klein', () => app.zumMenue()),
        knopf('Zurück zum Hideout', 'klein zurueck', () => app.zumHideout()),
      ]),
      app.sim ? el('div', 'p-tabelle', [tabelleBauen(app.sim)]) : null,
    ]);
    this.zeigen(inhalt);
  }

  /* ------------------------------------------------------ Auswertung */

  ergebnis(sim, eigen) {
    const app = this.app;
    const s = sim.spieler;
    const titel = sim.sieger === 0 ? 'SIEG' : sim.sieger === 1 ? 'NIEDERLAGE' : 'UNENTSCHIEDEN';
    const quote = s.schuesse ? Math.round((s.treffer / s.schuesse) * 100) + ' %' : '–';
    const wert = (name, w) => el('div', 'r-wert', [el('div', 'r-zahl', null, String(w)), el('div', 'r-name', null, name)]);
    const inhalt = el('div', 'ops-menue ergebnis ' + (sim.sieger === 0 ? 'sieg' : sim.sieger === 1 ? 'niederlage' : ''), [
      el('div', 'm-logo', null, titel),
      el('div', 'r-stand', [
        el('span', 'blau', null, String(sim.punkte[0])),
        el('span', 'r-trenner', null, ':'),
        el('span', 'rot', null, String(sim.punkte[1])),
      ]),
      el('div', 'r-werte', [
        wert('Abschüsse', s.abschuesse),
        wert('Tode', s.tode),
        wert('Hilfen', s.assists),
        wert('beste Serie', s.besteSerie),
        wert('Trefferquote', quote),
        wert('Kopftreffer', s.kopftreffer),
      ]),
      eigen && eigen.rekord ? el('div', 'r-rekord', null, 'Neuer Rekord: ' + eigen.rekord) : null,
      el('div', 'r-tabelle', [tabelleBauen(sim)]),
      el('div', 'm-leiste', [
        knopf('Nochmal', 'haupt', () => app.matchStarten()),
        knopf('Hauptmenü', 'klein', () => app.zumMenue()),
        knopf('Zurück zum Hideout', 'klein zurueck', () => app.zumHideout()),
      ]),
    ]);
    this.zeigen(inhalt);
  }

  /* ---------------------------------------------------------- Fehler */

  fehler(titel, text) {
    const inhalt = el('div', 'ops-menue fehler', [
      el('div', 'm-logo klein', null, titel),
      el('p', '', null, text),
      el('div', 'm-leiste', [
        knopf('Neu laden', 'haupt', () => location.reload()),
        knopf('Zurück zum Hideout', 'klein zurueck', () => this.app.zumHideout()),
      ]),
    ]);
    this.zeigen(inhalt);
  }

  /* Hinweis ueber dem Spielbild, solange die Maus nicht gefangen ist. */
  klickHinweis(an) {
    if (an && !this.klickEl) {
      this.klickEl = el('div', 'ops-klick', [
        el('div', 'k-titel', null, 'Ins Bild klicken'),
        el('div', 'k-text', null, 'Dann steuert die Maus den Blick. Esc pausiert.'),
      ]);
      this.klickEl.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.app.mausSperren();
      });
      this.wurzel.appendChild(this.klickEl);
    } else if (!an && this.klickEl) {
      this.klickEl.remove();
      this.klickEl = null;
    }
  }

  entfernen() {
    clearTimeout(this.hinweisTimer);
    this.schliessen();
    this.klickHinweis(false);
    this.ebene.remove();
    this.hochkant.remove();
    this.hinweisEl.remove();
  }
}
