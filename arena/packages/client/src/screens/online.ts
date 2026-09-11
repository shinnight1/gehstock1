/* ------------------------------------------------------------------
   Freundesduell: Raum aufmachen oder beitreten, dann spielen.

   Kein Zufallsgegner. Wer gegen jemanden spielen will, bekommt einen
   sechsstelligen Code und gibt ihn weiter - das ist der ganze
   Vorgang. Suchlisten und Warteschlangen waeren eine eigene Baustelle
   mit eigenen Problemen (Wartezeit, Abbrecher, Sprachen) und stehen
   nicht im Auftrag.

   Der Bildschirm hat drei Gesichter: Anmeldung, Warteraum, Partie. Er
   wechselt sie in seinem eigenen Element, ohne den App-Bildschirm zu
   wechseln - sonst muesste die Verbindung jedes Mal neu aufgebaut
   werden, und ein Abriss zwischen Warteraum und Anpfiff waere nicht
   zu ueberbruecken.

   Die Serveradresse wird nie geraten. Sie kommt aus mount(), aus
   ?server= oder aus dem, was der Spieler zuletzt eingetippt hat.
   ------------------------------------------------------------------ */

import { ARENEN } from '@arena/sim';
import type { Ausgang, Spieler, MatchAufbau } from '@arena/sim';
import { codeSaeubern, codeGueltig, WIEDER_FENSTER_S } from '@arena/netz';
import type { Fehlergrund, Sitzplatz } from '@arena/netz';
import { levelTabelle, deckGueltig } from '@arena/meta';
import { el, kopf } from '../ui/dom.js';
import { sitzungAnlegen, rueckkehrVorhanden, rueckkehrVergessen } from '../netz/sitzung.js';
import type { Sitzung, SitzungBericht } from '../netz/sitzung.js';
import type { OnlineLauf } from '../sim/onlineLauf.js';
import { spielStarten } from '../spiel.js';
import type { Spiel } from '../spiel.js';
import { serverUrlLesen, serverUrlMerken } from '../netz/adresse.js';
import type { App, Schirm } from '../app.js';
import type { EndeDaten } from './ende.js';

const FEHLERTEXT: Record<Fehlergrund, string> = {
  version: 'Server und Spiel passen nicht zusammen. Seite neu laden.',
  raumUnbekannt: 'Diesen Code gibt es nicht (mehr).',
  raumVoll: 'In diesem Raum sitzen schon zwei.',
  raumLaeuft: 'Die Partie in diesem Raum läuft bereits.',
  deckUngueltig: 'Dein Deck hat der Server nicht angenommen.',
  tokenUnbekannt: 'Dein Platz ist abgelaufen.',
  schonDrin: 'Du sitzt schon in einem Raum.',
  kaputt: 'Der Server kommt gerade nicht mit.',
};

export function onlineBauen(wurzel: HTMLElement, app: App): Schirm {
  const p = app.profil;
  if (!deckGueltig(p)) {
    app.gehe('deck');
    return { zerstoeren() { /* nichts */ } };
  }

  const seite = el('div.a-schirm.a-online');
  wurzel.appendChild(seite);

  let sitzung: Sitzung | null = null;
  let spiel: Spiel | null = null;
  let fertig = false;
  let letzterBericht: SitzungBericht | null = null;

  anmeldungZeigen();

  return {
    zerstoeren() {
      spiel?.zerstoeren();
      sitzung?.schliessen();
      seite.remove();
    },
  };

  /* ---------------------------- Anmeldung -------------------------- */

  function anmeldungZeigen(fehler?: string): void {
    const adresse = el('input.a-feld', {
      attr: {
        type: 'url', placeholder: 'wss://…', value: serverUrlLesen(app),
        autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false',
      },
    }) as HTMLInputElement;

    const code = el('input.a-feld.a-code-feld', {
      attr: {
        type: 'text', inputmode: 'numeric', placeholder: '123456',
        maxlength: '7', autocomplete: 'off',
      },
    }) as HTMLInputElement;

    const einheitlich = el('input', { attr: { type: 'checkbox', checked: 'checked' } }) as HTMLInputElement;

    /* Eine angefangene Partie steht ganz oben. Auf dem iPad ist das
       kein Randfall: Safari raeumt eine Seite im Hintergrund weg, und
       der Server haelt den Platz danach noch dreissig Sekunden. */
    const offen = rueckkehrVorhanden();

    seite.textContent = '';
    seite.appendChild(el('div.a-online-innen', {}, [
      kopf('Freundesduell', () => app.gehe('menu')),

      fehler ? el('div.a-online-fehler', { text: fehler }) : null,

      offen ? el('div.a-online-block', {}, [
        el('div.a-online-hinweis', {
          text: 'Du warst in Raum ' + offen.code + '. Der Platz wird nur kurz gehalten.',
        }),
        el('button.a-gross', {
          text: 'Zurück in die Partie',
          tippen: () => {
            const url = adresse.value.trim() || serverUrlLesen(app);
            if (!url) { anmeldungZeigen('Ohne Serveradresse geht es nicht.'); return; }
            starten(url, (sitz) => sitz.zurueckKehren());
          },
        }),
        el('button.a-klein', {
          text: 'Verwerfen',
          tippen: () => { rueckkehrVergessen(); anmeldungZeigen(); },
        }),
      ]) : null,

      el('label.a-online-zeile', {}, [
        el('span.a-online-marke', { text: 'Server' }),
        adresse,
      ]),
      el('div.a-online-hinweis', {
        text: 'Die Adresse deines eigenen Servers. Im WLAN reicht ws://<IP>:8081, '
          + 'im Netz muss es wss:// sein.',
      }),

      el('div.a-online-block', {}, [
        el('button.a-gross', {
          text: 'Raum aufmachen',
          tippen: () => {
            const url = adresse.value.trim();
            if (!url) { anmeldungZeigen('Ohne Serveradresse geht es nicht.'); return; }
            serverUrlMerken(url);
            starten(url, (s) => s.raumOeffnen(einheitlich.checked));
          },
        }),
        el('label.a-online-haken', {}, [
          einheitlich,
          el('span', {
            text: 'Einheitliche Level (beide auf Stufe 3)',
          }),
        ]),
        /* Voreingestellt an, und das mit Absicht: sonst entscheidet
           nicht, wer besser spielt, sondern wer laenger gesammelt
           hat. Wer es anders will, macht den Haken weg - aber er soll
           es bewusst tun. */
        el('div.a-online-hinweis', {
          text: 'Ohne den Haken zählen eure echten Kartenlevel.',
        }),
      ]),

      el('div.a-online-trenner', { text: 'oder' }),

      el('div.a-online-block', {}, [
        el('label.a-online-zeile', {}, [
          el('span.a-online-marke', { text: 'Code' }),
          code,
        ]),
        el('button.a-gross.zweit', {
          text: 'Raum betreten',
          tippen: () => {
            const url = adresse.value.trim();
            const c = codeSaeubern(code.value);
            if (!url) { anmeldungZeigen('Ohne Serveradresse geht es nicht.'); return; }
            if (!codeGueltig(c)) { anmeldungZeigen('Ein Code hat sechs Ziffern.'); return; }
            serverUrlMerken(url);
            starten(url, (s) => s.raumBetreten(c));
          },
        }),
      ]),
    ]));
  }

  function starten(url: string, was: (s: Sitzung) => void): void {
    sitzung?.schliessen();
    sitzung = sitzungAnlegen({
      url,
      anmeldung: {
        name: p.name || 'Gast',
        deck: p.deck.slice(),
        level: levelTabelle(p),
      },
      onBericht: (b) => { letzterBericht = b; warteraumZeigen(b); },
      onStart: (lauf, ich, aufbau) => partieStarten(lauf, ich, aufbau),
      onEnde: (ausgang, tuerme, grund) => partieBeenden(ausgang, tuerme, grund),
    });
    was(sitzung);
    warteraumZeigen(null);
  }

  /* ---------------------------- Warteraum -------------------------- */

  function warteraumZeigen(b: SitzungBericht | null): void {
    if (spiel) { standAktualisieren(b); return; }

    if (b?.fehler) {
      const text = FEHLERTEXT[b.fehler];
      sitzung?.schliessen();
      sitzung = null;
      anmeldungZeigen(text);
      return;
    }

    const ich = b?.du ?? null;
    const meiner = ich !== null ? b?.plaetze[ich] ?? null : null;
    const bereit = meiner?.bereit ?? false;

    seite.textContent = '';
    seite.appendChild(el('div.a-online-innen', {}, [
      kopf('Warteraum', () => { sitzung?.aufgeben(); app.gehe('menu'); }),

      el('div.a-netzlage.' + (b?.netz ?? 'verbindet'), {
        text: netzText(b?.netz ?? 'verbindet'),
      }),

      b?.code
        ? el('div.a-code-block', {}, [
          el('div.a-code-marke', { text: 'Code zum Weitergeben' }),
          el('div.a-code-gross', { text: b.code }),
        ])
        : el('div.a-online-hinweis', { text: 'Raum wird geöffnet …' }),

      el('div.a-sitze', {}, [
        sitzKachel(b?.plaetze[0] ?? null, ich === 0),
        sitzKachel(b?.plaetze[1] ?? null, ich === 1),
      ]),

      b?.einheitlicheLevel
        ? el('div.a-online-hinweis', { text: 'Einheitliche Level: beide spielen auf Stufe 3.' })
        : el('div.a-online-hinweis', { text: 'Es zählen die echten Kartenlevel.' }),

      el('button.a-gross' + (bereit ? '.zweit' : ''), {
        text: bereit ? 'Doch noch nicht' : 'Bereit',
        tippen: () => sitzung?.bereit(!bereit),
      }),

      el('div.a-online-hinweis', {
        text: 'Sobald beide bereit sind, geht es los.',
      }),
    ]));
  }

  function sitzKachel(platz: Sitzplatz | null, istIch: boolean): HTMLElement {
    if (!platz) {
      return el('div.a-sitz.a-sitz-leer', {}, [
        el('div.a-sitz-name', { text: 'wartet …' }),
      ]);
    }
    return el('div.a-sitz' + (platz.bereit ? '.bereit' : ''), {}, [
      el('div.a-sitz-name', { text: platz.name + (istIch ? ' (du)' : '') }),
      el('div.a-sitz-lage', {
        text: !platz.da ? 'getrennt' : platz.bereit ? 'bereit' : 'wählt noch',
      }),
    ]);
  }

  /* ----------------------------- Partie ---------------------------- */

  function partieStarten(lauf: OnlineLauf, ich: Spieler, aufbau: MatchAufbau): void {
    /* Im Freundesduell zaehlen keine Trophaeen, also gibt es auch
       keine Arena, in der man steht. Gewaehlt wird aus dem Seed des
       Matches - den haben beide Seiten, also sehen beide dasselbe
       Feld, und es ist nicht jedes Mal dieselbe Sandgrube. */
    const arena = Math.abs(aufbau.seed) % ARENEN.length;
    seite.textContent = '';
    /* Dasselbe Element traegt jetzt das Spielfeld statt eines Menues:
       Polsterung und Scrollen weg, sonst sitzt der Canvas in einem
       Rahmen und die Zeigerkoordinaten stimmen nicht mehr. */
    seite.className = 'a-spielflaeche';
    spiel = spielStarten(seite, {
      lauf,
      ich,
      arena,
      screenshake: app.optionen.screenshake,
      onKlang: (art, hoehe) => app.klang.spiel(art as never, hoehe),
      onExit: () => { sitzung?.aufgeben(); app.gehe('menu'); },
      /* Das Ende meldet der Server, nicht die lokale Simulation: bei
         einer Aufgabe oder einem Verbindungsabriss endet die Partie,
         ohne dass die Sim etwas davon mitbekaeme. */
      onEnde: () => { /* Server hat das letzte Wort */ },
    });
    standAktualisieren(letzterBericht);
  }

  /** Hinweis ueber dem Feld, wenn die Gegenseite weg ist. */
  function standAktualisieren(b: SitzungBericht | null): void {
    const alt = seite.querySelector('.a-online-warnung');
    alt?.remove();
    if (!b) return;

    const text = b.netz !== 'offen'
      ? 'Verbindung weg – versuche zurückzukommen …'
      : b.gegnerWegBis > 0
        ? `Gegner getrennt – ${WIEDER_FENSTER_S} s zum Zurückkommen`
        : '';
    if (!text) return;
    seite.appendChild(el('div.a-online-warnung', { text }));
  }

  function partieBeenden(
    ausgang: Ausgang, tuerme: [number, number], grund: 'regulaer' | 'aufgabe',
  ): void {
    if (fertig) return;
    fertig = true;

    const ich = letzterBericht?.du ?? 0;
    const meiner = ausgang === 'unentschieden' ? 'unentschieden'
      : (ausgang === 'sieg0') === (ich === 0) ? 'sieg' : 'niederlage';

    /* Freundesduelle zaehlen nicht auf die Trophaeen. Sonst waere der
       kuerzeste Weg nach oben ein zweites Geraet, und der ganze
       Bestwert waere nichts mehr wert. Den Roll fuer das gespielte
       Match gibt es trotzdem - gespielt ist gespielt. */
    const rolls = meiner === 'sieg' ? 2 : 1;
    app.aendern((prof) => { prof.rolls += rolls; });

    const daten: EndeDaten = {
      ausgang: meiner,
      aenderung: 0,
      vorher: app.profil.trophaeen,
      nachher: app.profil.trophaeen,
      rolls,
      tuerme: ich === 0 ? tuerme : [tuerme[1]!, tuerme[0]!],
      ohneWertung: true,
      ...(grund === 'aufgabe'
        ? { hinweis: meiner === 'sieg'
          ? 'Gegner hat aufgegeben oder die Verbindung verloren.'
          : 'Verbindung verloren.' }
        : {}),
    };
    window.setTimeout(() => app.gehe('ende', daten), 1200);
  }
}

function netzText(z: string): string {
  if (z === 'offen') return 'verbunden';
  if (z === 'verbindet') return 'verbinde …';
  if (z === 'getrennt') return 'Verbindung weg – versuche es erneut';
  return 'Server nicht erreichbar';
}
