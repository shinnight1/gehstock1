/* ------------------------------------------------------------------
   Kleine Bauhilfe fuer die Menue-Bildschirme.

   Nur das Noetigste: Element mit Klassen, Text und Kindern. Kein
   Framework, keine Reaktivitaet - die Menues bauen sich bei jedem
   Wechsel neu auf, und das ist bei einer Handvoll Elementen billiger
   als jede Abgleichlogik.

   Das Spielfeld selbst laeuft weiter auf Canvas. DOM ist hier nur
   fuer Menues, wo Text, Scrollen und Tippziele zaehlen.
   ------------------------------------------------------------------ */

type Kind = Node | string | null | undefined | false;

export interface ElOptionen {
  text?: string;
  html?: string;
  klasse?: string;
  /** Wird als data-Attribut gesetzt - fuer Tests und Ereignisse. */
  daten?: Record<string, string>;
  attr?: Record<string, string>;
  stil?: Partial<CSSStyleDeclaration>;
  /* Pointer statt Click: auf dem iPad kostet click rund 300 ms, weil
     Safari erst auf einen Doppeltipp wartet. */
  tippen?: (e: Event) => void;
}

export function el(
  beschreibung: string, optionen: ElOptionen = {}, kinder: Kind[] = [],
): HTMLElement {
  const [tag, ...klassen] = beschreibung.split('.');
  const e = document.createElement(tag || 'div');
  if (klassen.length) e.className = klassen.join(' ');
  if (optionen.klasse) e.className += (e.className ? ' ' : '') + optionen.klasse;
  if (optionen.text !== undefined) e.textContent = optionen.text;
  if (optionen.html !== undefined) e.innerHTML = optionen.html;

  for (const [k, v] of Object.entries(optionen.attr ?? {})) e.setAttribute(k, v);
  for (const [k, v] of Object.entries(optionen.daten ?? {})) e.dataset[k] = v;
  if (optionen.stil) Object.assign(e.style, optionen.stil);

  if (optionen.tippen) {
    const ausloesen = (ev: Event): void => {
      ev.preventDefault();
      optionen.tippen!(ev);
    };
    e.addEventListener('pointerup', ausloesen);
    // Tastatur: Menues muessen auch ohne Finger bedienbar bleiben.
    e.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') ausloesen(ev);
    });
    if (e.tagName !== 'BUTTON') {
      e.setAttribute('role', 'button');
      e.setAttribute('tabindex', '0');
    }
  }

  for (const kind of kinder) {
    if (kind === null || kind === undefined || kind === false) continue;
    e.appendChild(typeof kind === 'string' ? document.createTextNode(kind) : kind);
  }
  return e;
}

/** Kopfzeile mit Zurueck-Pfeil und Titel. */
export function kopf(titel: string, zurueck: () => void, rechts?: Node): HTMLElement {
  return el('div.a-kopf', {}, [
    el('button.a-zurueck', { text: '‹', attr: { 'aria-label': 'Zurück' }, tippen: zurueck }),
    el('h1.a-titel', { text: titel }),
    el('div.a-kopf-rechts', {}, [rechts ?? null]),
  ]);
}

/** Zahl mit Tausenderpunkten - deutsche Schreibweise. */
export function zahl(n: number): string {
  return n.toLocaleString('de-DE');
}
