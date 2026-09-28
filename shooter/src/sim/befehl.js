/* ------------------------------------------------------------------
   Befehl: was eine Figur in einem Simulationsschritt tun will.

   Spieler und Bots liefern dasselbe Format. Die Eingabe (Tastatur,
   Maus, Touch) und die Bot-KI erzeugen Befehle, die Simulation fuehrt
   sie aus. Genau diese Trennung braucht spaeter ein Server: Clients
   schicken Befehle, der Server rechnet und schickt Zustaende zurueck.

   yaw/pitch sind absolute Blickwinkel (Bogenmass), vor/seit liegen
   zwischen -1 und 1, tasten ist eine Bitmaske.
   ------------------------------------------------------------------ */

export const T_FEUER = 1;
export const T_VISIER = 2;
export const T_SPRINGEN = 4;     // Kante: nur in einem Schritt gesetzt
export const T_DUCKEN = 8;       // Zustand: gesetzt, solange geduckt gewuenscht
export const T_SPRINT = 16;
export const T_NACHLADEN = 32;   // Kante

export function neuerBefehl() {
  return { yaw: 0, pitch: 0, vor: 0, seit: 0, tasten: 0 };
}

export function befehlKopieren(von, nach) {
  nach.yaw = von.yaw;
  nach.pitch = von.pitch;
  nach.vor = von.vor;
  nach.seit = von.seit;
  nach.tasten = von.tasten;
  return nach;
}
