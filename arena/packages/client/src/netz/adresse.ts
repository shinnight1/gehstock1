/* ------------------------------------------------------------------
   Woher die Serveradresse kommt.

   Drei Quellen, in dieser Reihenfolge:

     1. mount({ serverUrl })     die Hub-Seite weiss, wo der Server
                                 steht, und sagt es uns.
     2. ?server= in der Adresse  fuer den Test vom iPad: eine IP
                                 eintippen, ohne neu zu bauen.
   Eine dritte Quelle gab es einmal: die zuletzt eingetippte Adresse.
   Sie ist weg, seit das Duell ueber das Relais der Seite laeuft und
   niemand mehr eine Adresse eintippt. Ein gemerkter Wert von frueher
   wuerde das Relais stillschweigend uebersteuern - und der Spieler
   saesse vor einem Server, den es nicht mehr gibt.

   Was es ausdruecklich nicht gibt: eine Herleitung aus `location`.
   Der Auftrag verlangt, dass der Build nichts ueber die Domain
   annimmt, unter der er laeuft - und ein Spiel, das im iframe der
   Hub-Seite hartnaeckig deren Host nach einem Spielserver fragt,
   waere genau diese Annahme.

   Umgeschrieben wird nur eines: http wird zu ws. Wer eine Adresse aus
   dem Browser kopiert, hat sonst http:// davor und wundert sich, dass
   nichts geht.
   ------------------------------------------------------------------ */

export interface MitServer {
  /** Adresse aus mount(), falls die Hub-Seite eine gesetzt hat. */
  readonly serverUrl?: string | undefined;
}

export function serverUrlLesen(app: MitServer): string {
  if (app.serverUrl) return normalisieren(app.serverUrl);
  try {
    const ausAdresse = new URLSearchParams(location.search).get('server');
    if (ausAdresse) return normalisieren(ausAdresse);
  } catch { /* Kein location - dann eben nicht. */ }
  return '';
}

/**
 * Adresse geradebiegen.
 *
 * http/https werden zu ws/wss. Fehlt das Schema ganz, wird ws://
 * angenommen - das ist der Fall beim Test im WLAN, wo jemand nur
 * "192.168.1.20:8081" eintippt.
 */
export function normalisieren(roh: string): string {
  const t = roh.trim();
  if (!t) return '';
  if (t.startsWith('ws://') || t.startsWith('wss://')) return t;
  if (t.startsWith('https://')) return 'wss://' + t.slice(8);
  if (t.startsWith('http://')) return 'ws://' + t.slice(7);
  return 'ws://' + t;
}
