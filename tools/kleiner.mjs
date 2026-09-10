/* ------------------------------------------------------------------
   Kommentare raus, Einrückung raus.

   Der Quelltext dieses Projekts ist absichtlich dicht kommentiert — er
   soll sich lesen lassen. In der Offline-Einzeldatei nützt das niemandem:
   dort zählt jedes Byte gegen das Budget, und das iPad muss alles parsen.

   Das hier ist bewusst *kein* richtiger Minifier. Namen bleiben, Zeilen
   bleiben Zeilen, es wird nichts umgestellt. Entfernt wird nur, was
   nachweislich Kommentar ist:

     - Zeilen, die (nach Leerzeichen) mit // beginnen
     - Blockkommentare, die am Zeilenanfang beginnen
     - führende und folgende Leerzeichen, Leerzeilen

   Warum das hier sicher ist — beides vom Build geprüft, siehe pruefen():
     1. Keine Zeichenkette geht über mehr als eine Zeile (keine
        Template-Literale, keine Backslash-Fortsetzungen). Eine Zeile, die
        mit // oder /* anfängt, kann also nicht in einer Zeichenkette liegen.
     2. Kein Blockkommentar beginnt mitten in einer Zeile und läuft weiter.
        Sonst bliebe seine schließende Klammer als vermeintlicher Code stehen.

   Trifft eine der beiden Annahmen nicht mehr zu, bricht der Build ab,
   statt stillschweigend kaputten Code auszuliefern.
   ------------------------------------------------------------------ */

/* Prüft die beiden Annahmen. Gibt eine Liste von Beanstandungen zurück -
   leer heißt: der Abzug unten ist zulässig. */
export function pruefen(quelle, name) {
  const fehler = [];
  const zeilen = quelle.split('\n');
  let imBlock = false;

  for (let i = 0; i < zeilen.length; i++) {
    const roh = zeilen[i];
    const t = roh.trim();

    if (imBlock) {
      if (t.includes('*/')) imBlock = false;
      continue;
    }

    // Ein Blockkommentar am Zeilenanfang ist erlaubt und erwartet
    if (t.startsWith('/*')) {
      if (!t.includes('*/', 2)) imBlock = true;
      continue;
    }

    // Zeilenkommentar am Anfang: unkritisch
    if (t.startsWith('//')) continue;

    /* Ein Blockkommentar, der mitten in einer Zeile beginnt und nicht in
       derselben Zeile endet - den erkennt der Abzug unten nicht. */
    const auf = roh.lastIndexOf('/*');
    if (auf >= 0 && roh.indexOf('*/', auf + 2) < 0) {
      fehler.push(name + ':' + (i + 1) + ' Blockkommentar beginnt mitten in der Zeile');
    }

    // Backslash am Zeilenende innerhalb einer Zeichenkette
    if (/(^|[^\\])\\$/.test(roh) && /['"]/.test(roh)) {
      fehler.push(name + ':' + (i + 1) + ' mögliche Zeilenfortsetzung in einer Zeichenkette');
    }

    // Template-Literal: Backtick außerhalb eines Kommentars
    const ohneZeilenkommentar = roh.replace(/\/\/.*$/, '');
    const ohneBlock = ohneZeilenkommentar.replace(/\/\*.*?\*\//g, '');
    if (ohneBlock.includes('`')) {
      fehler.push(name + ':' + (i + 1) + ' Template-Literal (Backtick) im Code');
    }
  }

  return fehler;
}

/* Entfernt Kommentarzeilen und Einrückung. */
export function abziehen(quelle) {
  const zeilen = quelle.split('\n');
  const raus = [];
  let imBlock = false;

  for (const roh of zeilen) {
    const t = roh.trim();

    if (imBlock) {
      const zu = t.indexOf('*/');
      if (zu < 0) continue;
      imBlock = false;
      const rest = t.slice(zu + 2).trim();
      if (rest) raus.push(rest);
      continue;
    }

    if (!t) continue;
    if (t.startsWith('//')) continue;

    if (t.startsWith('/*')) {
      const zu = t.indexOf('*/', 2);
      if (zu < 0) { imBlock = true; continue; }
      const rest = t.slice(zu + 2).trim();
      if (rest) raus.push(rest);
      continue;
    }

    raus.push(t);
  }

  return raus.join('\n');
}
