/* ------------------------------------------------------------------
   Waffenzustand: Magazin, Nachladen, Feuerrate, Visier, Streuung,
   Rueckstoss.

   Die Feuerrate ist exakt, unabhaengig von der Bildrate: jede Waffe hat
   ein Abklingkonto. Solange der Abzug gedrueckt ist, wird geschossen,
   sobald das Konto bei null ist, und das Konto waechst um 60/rpm.
   Faellt ein Schuss zwischen zwei Simulationsschritte, holt der naechste
   Schritt ihn nach - im Mittel stimmt die Rate genau.

   Den Schuss selbst (Strahl, Treffer, Schaden) rechnet die Simulation,
   weil sie alle Figuren kennt.
   ------------------------------------------------------------------ */

import { FIGUR, WAFFEN } from '../konfig.js';
import { T_FEUER, T_NACHLADEN, T_VISIER } from './befehl.js';
import { klemme, mische, naehere, startwert, zufallsquelle } from './mathe.js';

/* Rueckstoss haengt nur an der Nummer des Schusses: so rechnen das Geraet
   (Vorhersage) und der Server (Mehrspieler) denselben Ausschlag. */
const RUECK = zufallsquelle(1);

/* Zielt ein Mensch (Visierknopf, Visierfeuer, rechte Maustaste), fliegen
   seine Schuesse sofort fast so genau wie voll im Visier - auch waehrend
   das Visier noch hochkommt. Sonst gingen beim Visierfeuer die ersten
   Schuesse wie aus der Huefte daneben, obwohl der Visierpunkt schon auf
   dem Ziel liegt. Bots zielen wie bisher mit dem echten Visieranteil. */
const ZIEL_ANTEIL = 0.9;

function zielAnteil(w) {
  if (!w.menschZielt) return w.visier;
  // Mit Zielfernrohr muss das Visier wirklich oben sein (kein Schnappschuss).
  const a = w.def.zielAnteil !== undefined ? w.def.zielAnteil : ZIEL_ANTEIL;
  return Math.max(w.visier, a);
}

export function neueWaffe(id) {
  const def = WAFFEN[id] || WAFFEN.sturmgewehr;
  return {
    id: def.id,
    def,
    magazin: def.magazin,
    reserve: def.reserve,
    abkling: 0,
    laden: 0,          // Restzeit des Nachladens, 0 = laedt nicht
    ladenGesamt: 0,
    ladenPhase: 0,     // Schrot: 1 Anfang, 2 Patronen, 3 Ende
    visier: 0,         // 0 = Huefte, 1 = voll im Visier
    menschZielt: false, // ein Mensch haelt das Visier (siehe ZIEL_ANTEIL)
    bloom: 0,          // zusaetzliche Streuung durch Dauerfeuer (Grad)
    rueckHoch: 0,      // Rueckstoss (Grad), wirkt auf Blick und Schuss
    rueckSeite: 0,
    sprintAus: 0,      // nach dem Sprint kurz keine Schuesse
    klickGesperrt: false,
    abzugGesperrt: false, // halbautomatisch: erst loslassen, dann der naechste Schuss
    schuesse: 0,       // laufender Zaehler, fuer Darstellung und Bots
    letzterSchuss: -99,
    streuung: 0,       // aktuelle Streuung (Grad), fuer das Fadenkreuz
  };
}

export function waffeAuffuellen(w) {
  w.magazin = w.def.magazin;
  w.reserve = w.def.reserve;
  w.abkling = 0;
  w.laden = 0;
  w.ladenGesamt = 0;
  w.ladenPhase = 0;
  w.visier = 0;
  w.menschZielt = false;
  w.bloom = 0;
  w.rueckHoch = 0;
  w.rueckSeite = 0;
  w.sprintAus = 0;
  w.klickGesperrt = false;
  w.abzugGesperrt = false;
}

export function kannNachladen(w) {
  return w.laden <= 0 && w.magazin < w.def.magazin && w.reserve > 0;
}

function nachladenStarten(sim, a, w) {
  const def = w.def;
  if (def.einzelnLaden) {
    const fehlt = Math.min(def.magazin - w.magazin, w.reserve);
    w.ladenPhase = 1;
    w.laden = def.einzelnLaden.start;
    w.ladenGesamt = def.einzelnLaden.start + fehlt * def.einzelnLaden.patrone + def.einzelnLaden.ende;
  } else {
    w.ladenPhase = 0;
    w.ladenGesamt = w.magazin === 0 ? def.nachladenLeer : def.nachladen;
    w.laden = w.ladenGesamt;
  }
  sim.melden('nachladen', a.id, -1, w.ladenGesamt);
}

function nachladenAbbrechen(w) {
  w.laden = 0;
  w.ladenPhase = 0;
}

function nachladenFortschritt(sim, a, w, dt) {
  const def = w.def;
  w.laden -= dt;
  if (!def.einzelnLaden) {
    if (w.laden <= 0) {
      const n = Math.min(def.magazin - w.magazin, w.reserve);
      w.magazin += n;
      w.reserve -= n;
      w.laden = 0;
      sim.melden('geladen', a.id, -1, 0);
    }
    return;
  }
  const e = def.einzelnLaden;
  let schutz = 0;
  while (w.laden <= 0 && w.ladenPhase > 0 && schutz++ < 4) {
    if (w.ladenPhase === 1) {
      w.ladenPhase = 2;
      w.laden += e.patrone;
    } else if (w.ladenPhase === 2) {
      if (w.reserve > 0 && w.magazin < def.magazin) {
        w.magazin++;
        w.reserve--;
        sim.melden('patrone', a.id, -1, 0);
      }
      if (w.magazin < def.magazin && w.reserve > 0) {
        w.laden += e.patrone;
      } else {
        w.ladenPhase = 3;
        w.laden += e.ende;
      }
    } else {
      w.ladenPhase = 0;
      w.laden = 0;
      sim.melden('geladen', a.id, -1, 0);
    }
  }
}

/* Aktuelle Streuung in Grad (halber Kegelwinkel). */
export function streuungBerechnen(a, w) {
  const s = w.def.streuung;
  const ziel = zielAnteil(w);
  let grad = mische(s.hueft, s.visier, ziel);
  const v = Math.hypot(a.vx, a.vz);
  grad += s.bewegung * klemme(v / FIGUR.tempo.gehen, 0, 1.4) * (1 - 0.6 * ziel);
  if (!a.amBoden) grad += s.luft;
  if (a.geduckt && a.amBoden && a.rutschZeit <= 0) grad *= 0.82;
  grad += w.bloom;
  return grad;
}

/* Ein Simulationsschritt fuer die Waffe einer lebenden Figur.
   neu: in diesem Schritt frisch gedrueckte Tasten. jetzt: die Uhr der
   Figur - ohne Angabe die der Simulation. Mehrspieler-Figuren haben eine
   eigene, die mit jedem ihrer Befehle weiterlaeuft. */
export function waffeTick(sim, a, tasten, neu, dt, darfSchiessen, jetzt) {
  const w = a.waffe;
  const def = w.def;
  if (jetzt === undefined) jetzt = sim.zeit;

  // Zielen: nicht im Sprint. Waehrend des Nachladens darf man zielen.
  const willVisier = (tasten & T_VISIER) !== 0 && !a.sprintet && darfSchiessen;
  w.visier = naehere(w.visier, willVisier ? 1 : 0, dt / def.visier.zeit);
  w.menschZielt = willVisier && !a.ki;

  if (a.sprintet) w.sprintAus = def.sprintAus;
  else if (w.sprintAus > 0) w.sprintAus = Math.max(0, w.sprintAus - dt);

  w.abkling -= dt;
  const abzug = (tasten & T_FEUER) !== 0 && darfSchiessen;
  if (!abzug) {
    if (w.abkling < 0) w.abkling = 0;
    w.klickGesperrt = false;
    w.abzugGesperrt = false;
  }

  if (w.laden > 0) nachladenFortschritt(sim, a, w, dt);

  if ((neu & T_NACHLADEN) && darfSchiessen && kannNachladen(w)) nachladenStarten(sim, a, w);

  if (abzug && !a.sprintet) {
    if (w.magazin <= 0) {
      if (w.laden <= 0) {
        if (w.reserve > 0) nachladenStarten(sim, a, w);
        else if (!w.klickGesperrt) {
          w.klickGesperrt = true;
          sim.melden('leer', a.id, -1, 0);
        }
      }
    } else {
      let n = 0;
      while (w.abkling <= 0 && w.magazin > 0 && w.sprintAus <= 0 && n < 3 && !w.abzugGesperrt) {
        if (w.laden > 0) {
          // Schrot laesst sich unterbrechen, Magazinwaffen nicht.
          if (def.einzelnLaden) nachladenAbbrechen(w);
          else break;
        }
        sim.schiessen(a, w);
        w.magazin--;
        w.schuesse++;
        w.letzterSchuss = jetzt;
        w.abkling += 60 / def.rpm;
        n++;
        // Halbautomatisch: der Abzug muss erst wieder los. Wer waehrend
        // der Sperrzeit drueckt und haelt, schiesst, sobald sie um ist.
        if (def.halbautomatisch) w.abzugGesperrt = true;
      }
    }
  }

  // Rueckstoss und Bloom bauen sich ab, waehrend des Feuerns langsamer.
  const feuert = jetzt - w.letzterSchuss < 60 / def.rpm + 0.06;
  const erholung = def.rueckstoss.erholung * (feuert ? 0.3 : 1) * dt;
  w.rueckHoch = naehere(w.rueckHoch, 0, erholung);
  w.rueckSeite = naehere(w.rueckSeite, 0, erholung * 0.8);
  w.bloom = naehere(w.bloom, 0, def.streuung.bloomAbbau * dt * (feuert ? 0.15 : 1));
  w.streuung = streuungBerechnen(a, w);
}

/* Nach einem Schuss: Bloom und Rueckstoss aufschlagen. */
export function nachSchuss(sim, w) {
  const def = w.def;
  const r = def.rueckstoss;
  const s = def.streuung;
  const ziel = zielAnteil(w);
  w.bloom = Math.min(s.bloomMax, w.bloom + mische(s.bloom, s.bloomVisier, ziel));
  const faktor = mische(1, r.visierFaktor, ziel);
  RUECK.setzen(startwert(w.schuesse, def.rpm, 0x7e57));
  w.rueckHoch = Math.min(r.max, w.rueckHoch + r.hoch * faktor * RUECK.zwischen(0.85, 1.15));
  w.rueckSeite = klemme(w.rueckSeite + r.seite * faktor * RUECK.zwischen(-1, 1), -r.max * 0.5, r.max * 0.5);
}
