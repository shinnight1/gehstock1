/* ------------------------------------------------------------------
   HUD: Fadenkreuz, Leben, Munition, Teamstand, Zeit, Abschussliste,
   Treffer- und Abschussanzeige, Schadensrichtung, Ansagen.

   Reines DOM ueber dem Spielbild. Aktualisiert wird nur, was sich
   geaendert hat - Textknoten werden nicht in jedem Bild neu gesetzt.
   ------------------------------------------------------------------ */

import { TEAMS, WAFFEN, WAFFEN_REIHE } from '../konfig.js';
import { GRAD, winkelDiff, yawZu } from '../sim/mathe.js';

function el(tag, klasse, text) {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (text !== undefined) e.textContent = text;
  return e;
}

function zeitText(s) {
  const t = Math.max(0, Math.ceil(s));
  return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
}

export class Hud {
  constructor(wurzel, app) {
    this.app = app;
    const h = el('div', 'ops-hud');
    this.el = h;
    h.innerHTML = [
      '<div class="hud-vignette"></div>',
      '<div class="hud-schutz-rand"></div>',
      '<div class="hud-punkte">',
      '  <div class="p-team blau"><span class="p-name">BLAU</span><span class="p-zahl">0</span><div class="p-balken"><i></i></div></div>',
      '  <div class="p-mitte"><div class="p-zeit">5:00</div><div class="p-ziel">bis 30</div></div>',
      '  <div class="p-team rot"><div class="p-balken"><i></i></div><span class="p-zahl">0</span><span class="p-name">ROT</span></div>',
      '</div>',
      '<div class="hud-feed"></div>',
      '<div class="hud-fps"></div>',
      '<div class="hud-leben"><div class="l-kopf"><span class="l-zahl">100</span><span class="l-schutz">SPAWNSCHUTZ</span></div><div class="l-balken"><i></i></div></div>',
      '<div class="hud-muni"><div class="m-zahlen"><span class="m-mag">30</span><span class="m-res">/ 150</span></div><div class="m-name">Sturmgewehr</div><div class="m-laden"><i></i></div></div>',
      '<div class="hud-kreuz"><i class="k-o"></i><i class="k-u"></i><i class="k-l"></i><i class="k-r"></i><b class="k-punkt"></b></div>',
      '<div class="hud-treffer"><i></i><i></i><i></i><i></i></div>',
      '<div class="hud-schaden"><i></i><i></i><i></i><i></i></div>',
      '<div class="hud-zielname"></div>',
      '<div class="hud-hinweis"></div>',
      '<div class="hud-ansage"></div>',
      '<div class="hud-meldung"></div>',
      '<div class="hud-tod">',
      '  <div class="t-titel">AUSGESCHALTET</div>',
      '  <div class="t-von"></div>',
      '  <div class="t-zeit"></div>',
      '  <div class="t-waffen"></div>',
      '</div>',
      '<div class="hud-tabelle"></div>',
    ].join('');
    wurzel.appendChild(h);

    const q = (s) => h.querySelector(s);
    this.e = {
      vignette: q('.hud-vignette'),
      schutzRand: q('.hud-schutz-rand'),
      blauZahl: q('.p-team.blau .p-zahl'),
      rotZahl: q('.p-team.rot .p-zahl'),
      blauBalken: q('.p-team.blau .p-balken i'),
      rotBalken: q('.p-team.rot .p-balken i'),
      zeit: q('.p-zeit'),
      ziel: q('.p-ziel'),
      feed: q('.hud-feed'),
      fps: q('.hud-fps'),
      leben: q('.hud-leben'),
      lebenZahl: q('.l-zahl'),
      lebenBalken: q('.l-balken i'),
      muni: q('.hud-muni'),
      mag: q('.m-mag'),
      res: q('.m-res'),
      waffe: q('.m-name'),
      laden: q('.m-laden i'),
      kreuz: q('.hud-kreuz'),
      kreuzTeile: [q('.k-o'), q('.k-u'), q('.k-l'), q('.k-r')],
      treffer: q('.hud-treffer'),
      schaden: Array.from(h.querySelectorAll('.hud-schaden i')),
      zielname: q('.hud-zielname'),
      hinweis: q('.hud-hinweis'),
      ansage: q('.hud-ansage'),
      meldung: q('.hud-meldung'),
      tod: q('.hud-tod'),
      todVon: q('.t-von'),
      todZeit: q('.t-zeit'),
      todWaffen: q('.t-waffen'),
      tabelle: q('.hud-tabelle'),
    };
    this.alt = {};
    this.trefferBis = 0;
    this.meldungBis = 0;
    this.ansageBis = 0;
    this.schadenQuellen = [];
    this.schadenI = 0;
    this.feedEintraege = [];

    // Waffenwahl im Todesbildschirm
    WAFFEN_REIHE.forEach((id, i) => {
      const b = el('button', 't-waffe', WAFFEN[id].name);
      b.type = 'button';
      b.dataset.waffe = id;
      b.dataset.taste = String(i + 1);
      b.addEventListener('click', () => this.app.naechsteWaffe(id));
      this.e.todWaffen.appendChild(b);
    });
  }

  setze(schluessel, element, wert, art) {
    if (this.alt[schluessel] === wert) return;
    this.alt[schluessel] = wert;
    if (art === 'breite') element.style.transform = 'scaleX(' + wert + ')';
    else if (art === 'deckkraft') element.style.opacity = String(wert);
    else element.textContent = wert;
  }

  klasse(schluessel, element, name, an) {
    const k = schluessel + ':' + name;
    if (this.alt[k] === an) return;
    this.alt[k] = an;
    element.classList.toggle(name, an);
  }

  sichtbar(v) {
    this.el.classList.toggle('an', !!v);
  }

  modus(touch) {
    this.el.classList.toggle('touch', !!touch);
  }

  /* Pro Bild. z: Zustand, siehe app.js */
  aktualisieren(z) {
    const sim = z.sim;
    const s = sim.spieler;
    const E = this.e;
    const jetzt = z.zeit;

    this.setze('blau', E.blauZahl, String(sim.punkte[0]));
    this.setze('rot', E.rotZahl, String(sim.punkte[1]));
    this.setze('bb', E.blauBalken, Math.min(1, sim.punkte[0] / sim.zielPunkte).toFixed(3), 'breite');
    this.setze('rb', E.rotBalken, Math.min(1, sim.punkte[1] / sim.zielPunkte).toFixed(3), 'breite');
    this.setze('zeit', E.zeit, zeitText(sim.restzeit));
    this.klasse('zeit', E.zeit, 'knapp', sim.restzeit < 30 && sim.phase === 'laeuft');
    this.setze('ziel', E.ziel, 'bis ' + sim.zielPunkte);

    const w = s.waffe;
    const lebt = s.lebt;
    this.setze('leben', E.lebenZahl, String(Math.ceil(s.leben)));
    this.setze('lb', E.lebenBalken, (s.leben / 100).toFixed(3), 'breite');
    this.klasse('leben', E.leben, 'niedrig', s.leben < 35 && lebt);
    this.klasse('leben', E.leben, 'schutz', s.schutz > 0 && lebt);
    this.klasse('schutz', E.schutzRand, 'an', s.schutz > 0 && lebt);
    const rot = lebt ? Math.max(0, (60 - s.leben) / 60) : 0;
    this.setze('vig', E.vignette, (rot * 0.85).toFixed(2), 'deckkraft');

    this.setze('mag', E.mag, String(w.magazin));
    this.setze('res', E.res, '/ ' + w.reserve);
    this.setze('wname', E.waffe, w.def.name);
    this.klasse('mag', E.muni, 'knapp', w.magazin <= Math.ceil(w.def.magazin * 0.25));
    this.klasse('mag', E.muni, 'leer', w.magazin === 0);
    const laden = w.laden > 0 ? 1 - w.laden / Math.max(0.01, w.ladenGesamt) : 0;
    this.setze('laden', E.laden, laden.toFixed(2), 'breite');
    this.klasse('laden', E.muni, 'laedt', w.laden > 0);

    // Fadenkreuz: Abstand aus der Streuung, weg im Visier und im Sprint
    const kreuzWeg = !lebt || w.visier > 0.55 || s.sprintet || sim.phase === 'ende';
    this.klasse('kreuz', E.kreuz, 'weg', kreuzWeg);
    if (!kreuzWeg) {
      const fovHalb = z.fov * 0.5 * GRAD;
      const px = (Math.tan(w.streuung * GRAD) / Math.tan(fovHalb)) * (z.hoehe / 2);
      const gap = Math.round(Math.max(5, Math.min(90, px)));
      if (this.alt.gap !== gap) {
        this.alt.gap = gap;
        E.kreuz.style.setProperty('--gap', gap + 'px');
      }
    }

    // Trefferanzeige
    this.klasse('tr', E.treffer, 'an', jetzt < this.trefferBis);

    // Hinweise
    let hinweis = '';
    if (lebt && sim.phase === 'laeuft') {
      if (w.laden > 0) hinweis = 'Lädt nach …';
      else if (w.magazin === 0 && w.reserve === 0) hinweis = 'Keine Munition mehr';
      else if (w.magazin === 0) hinweis = z.touch ? 'Nachladen ⟳' : 'Nachladen [R]';
      else if (w.magazin <= Math.ceil(w.def.magazin * 0.2)) hinweis = z.touch ? 'Wenig Munition' : 'Wenig Munition [R]';
    }
    this.setze('hinweis', E.hinweis, hinweis);

    // Zielname (Gegner rot, Verbuendete blau)
    const zn = z.zielName || '';
    this.setze('zn', E.zielname, zn);
    this.klasse('zn', E.zielname, 'freund', !!z.zielFreund);

    // Ansage und Meldung ausblenden
    this.klasse('ansage', E.ansage, 'an', jetzt < this.ansageBis);
    this.klasse('meldung', E.meldung, 'an', jetzt < this.meldungBis);

    // Schadensrichtung
    for (let i = 0; i < this.schadenQuellen.length; i++) {
      const q = this.schadenQuellen[i];
      const e = E.schaden[i];
      const rest = q.bis - jetzt;
      if (rest <= 0 || !lebt) {
        if (q.aktiv) { e.style.opacity = '0'; q.aktiv = false; }
        continue;
      }
      q.aktiv = true;
      const a = sim.akteure[q.von];
      const winkel = winkelDiff(z.yaw, yawZu(a.x - s.x, a.z - s.z));
      // Bildschirmdrehung: 0 = oben, positiv im Uhrzeigersinn; yaw waechst nach links
      e.style.transform = 'translate(-50%,-50%) rotate(' + (-winkel / GRAD).toFixed(1) + 'deg)';
      e.style.opacity = Math.min(1, rest / 0.5).toFixed(2);
    }

    // Todesbildschirm
    this.klasse('tod', E.tod, 'an', !lebt && sim.phase !== 'ende');
    if (!lebt) {
      const m = s.moerder >= 0 ? sim.akteure[s.moerder] : null;
      this.setze('todvon', E.todVon, m ? 'von ' + m.name + ' · ' + m.waffe.def.name : '');
      this.setze('todzeit', E.todZeit, 'Wieder dabei in ' + Math.max(0, s.respawnIn).toFixed(1) + ' s');
      for (const b of E.todWaffen.children) this.klasse('tw' + b.dataset.waffe, b, 'gewaehlt', b.dataset.waffe === s.naechsteWaffe);
    }

    if (z.fps !== undefined) {
      this.setze('fps', E.fps, z.fps);
    }
  }

  fpsZeigen(v) {
    this.e.fps.classList.toggle('an', !!v);
  }

  treffer(kopf, toedlich, geschuetzt, zeit) {
    const T = this.e.treffer;
    T.classList.toggle('kopf', !!kopf);
    T.classList.toggle('toedlich', !!toedlich);
    T.classList.toggle('geschuetzt', !!geschuetzt);
    // Animation neu starten
    T.classList.remove('puls');
    void T.offsetWidth;
    T.classList.add('puls');
    this.alt['tr:an'] = undefined;
    this.trefferBis = zeit + (toedlich ? 0.4 : 0.22);
  }

  schadenVon(id, zeit) {
    let q = this.schadenQuellen.find((x) => x.von === id);
    if (!q) {
      const i = this.schadenI++ % this.e.schaden.length;
      q = this.schadenQuellen[i] = { von: id, bis: 0, aktiv: false };
    }
    q.von = id;
    q.bis = zeit + 1.4;
  }

  meldung(text, art, zeit) {
    const M = this.e.meldung;
    M.textContent = text;
    M.className = 'hud-meldung an ' + (art || '');
    this.alt['meldung:an'] = true;
    this.meldungBis = zeit + 1.6;
  }

  ansage(text, zeit, dauer, art) {
    const A = this.e.ansage;
    A.textContent = text;
    A.className = 'hud-ansage an ' + (art || '');
    this.alt['ansage:an'] = true;
    this.ansageBis = zeit + (dauer || 1.2);
  }

  /* Abschussliste: hoechstens fuenf Eintraege, jeder fuenf Sekunden. */
  abschuss(taeter, opfer, waffe, kopf, spielerId) {
    const e = el('div', 'f-eintrag');
    if (taeter) {
      e.appendChild(el('span', 'f-name ' + (taeter.team === 0 ? 'blau' : 'rot') + (taeter.id === spielerId ? ' ich' : ''), taeter.name));
      e.appendChild(el('span', 'f-waffe', (WAFFEN[waffe] ? WAFFEN[waffe].name : '') + (kopf ? ' ✚' : '')));
    }
    e.appendChild(el('span', 'f-name ' + (opfer.team === 0 ? 'blau' : 'rot') + (opfer.id === spielerId ? ' ich' : ''), opfer.name));
    this.e.feed.insertBefore(e, this.e.feed.firstChild);
    while (this.e.feed.children.length > 5) this.e.feed.lastChild.remove();
    const t = setTimeout(() => e.remove(), 5000);
    this.feedEintraege.push(t);
    if (this.feedEintraege.length > 12) this.feedEintraege.shift();
  }

  feedLeeren() {
    for (const t of this.feedEintraege) clearTimeout(t);
    this.feedEintraege.length = 0;
    this.e.feed.textContent = '';
    this.schadenQuellen.length = 0;
    this.trefferBis = 0;
    this.meldungBis = 0;
    this.ansageBis = 0;
    this.alt = {};
  }

  /* Punktetabelle (Tab oder Tipp auf den Stand). */
  tabelle(sim, an) {
    const T = this.e.tabelle;
    T.classList.toggle('an', !!an);
    if (!an || !sim) return;
    T.textContent = '';
    T.appendChild(tabelleBauen(sim));
  }

  entfernen() {
    this.feedLeeren();
    this.el.remove();
  }
}

/* Tabelle aller Figuren nach Team, fuer HUD und Auswertung. */
export function tabelleBauen(sim) {
  const tab = el('div', 'tabelle');
  for (const team of [0, 1]) {
    const block = el('div', 'tab-team ' + (team === 0 ? 'blau' : 'rot'));
    const kopf = el('div', 'tab-kopf');
    kopf.appendChild(el('span', 'tab-name', 'Team ' + TEAMS[team].name));
    kopf.appendChild(el('span', 'tab-punkte', String(sim.punkte[team])));
    block.appendChild(kopf);
    const zeile = (werte, klasse) => {
      const z = el('div', 'tab-zeile ' + (klasse || ''));
      for (const w of werte) z.appendChild(el('span', '', w));
      block.appendChild(z);
    };
    zeile(['Name', 'Abschüsse', 'Tode', 'Hilfen', 'Waffe'], 'tab-titel');
    const liste = sim.akteure.filter((a) => a.team === team).sort((a, b) => b.abschuesse - a.abschuesse || a.tode - b.tode);
    for (const a of liste) {
      zeile([a.name + (a.bot ? '' : ' (du)'), String(a.abschuesse), String(a.tode), String(a.assists), a.waffe.def.name], a.bot ? '' : 'ich');
    }
    tab.appendChild(block);
  }
  return tab;
}
