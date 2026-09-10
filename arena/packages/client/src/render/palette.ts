/* ------------------------------------------------------------------
   Die feste Farbpalette. Kein Farbwert steht irgendwo sonst im Code.

   Seit der Umstellung auf die perspektivische Ansicht braucht fast
   jedes Material drei Toene: Deckflaeche, zugewandte Wand und
   Seitenwand. Das Licht kommt von vorne oben links, deshalb ist
   `oben` immer der hellste und `seite` der dunkelste Wert. Wer eine
   Farbe aendert, muss alle drei mitnehmen, sonst kippt das
   Raumgefuehl.
   ------------------------------------------------------------------ */

export const FARBE = {
  /* Rahmen und Flaeche ausserhalb der Arena */
  huelle: '#080b12',
  huelleKante: '#161d2b',

  /* Rasen. Der Mittelton traegt, die beiden anderen bilden das
     Maehmuster - so wie ein frisch gemaehter Sportplatz. */
  rasen: '#3a6b41',
  rasenHell: '#437a49',
  rasenDunkel: '#325c39',
  rasenOben: '#2f5a37',
  rasenTupfen: 'rgba(255, 255, 255, 0.05)',
  rasenSchatten: 'rgba(0, 0, 0, 0.06)',

  /* Erde am Ufer und unter den Bauwerken */
  erde: '#6b5335',
  erdeHell: '#82663f',
  erdeDunkel: '#4f3d27',
  sand: '#a08a5c',

  /* Fluss */
  wasserTief: '#12456a',
  wasser: '#1b5f8b',
  wasserHell: '#2f86b8',
  wasserGlanz: 'rgba(190, 232, 255, 0.42)',
  wasserSchaum: 'rgba(226, 245, 255, 0.6)',

  /* Holz fuer die Bruecken */
  holzOben: '#9a7549',
  holzVorne: '#7d5d38',
  holzSeite: '#5d442a',
  holzFuge: 'rgba(0, 0, 0, 0.26)',

  /* Stein fuer Tuerme und Bande */
  steinOben: '#dfe6ef',
  steinVorne: '#b8c3d2',
  steinSeite: '#8d99ab',
  steinFuge: 'rgba(40, 50, 66, 0.35)',
  steinRiss: 'rgba(28, 34, 46, 0.6)',

  /* Bande rund um das Feld */
  bandeOben: '#2b3446',
  bandeVorne: '#1d2534',
  bandeSeite: '#151b27',

  /* Parteien. 0 = unten = man selbst. */
  seite: ['#3b82f6', '#ef4444'] as const,
  seiteHell: ['#93c5fd', '#fca5a5'] as const,
  seiteDunkel: ['#1b47a8', '#8f1a1a'] as const,

  /* Zonen und Hinweise */
  zoneErlaubt: 'rgba(59, 130, 246, 0.13)',
  zoneKante: 'rgba(147, 197, 253, 0.4)',
  zoneVerboten: 'rgba(239, 68, 68, 0.16)',

  /* Text */
  text: '#e8eef7',
  textLeise: '#9aa8bd',
} as const;

/** Seltenheitsfarben - gelten in Sammlung, Deckbau und Roll-Animation. */
export const SELTENHEIT_FARBE = {
  gewoehnlich: '#94a3b8',
  selten: '#38bdf8',
  episch: '#a855f7',
  legendaer: '#f5b301',
} as const;

/** Materialsatz fuer den Quader-Baustein. */
export const MATERIAL = {
  stein: { oben: FARBE.steinOben, vorne: FARBE.steinVorne, seite: FARBE.steinSeite },
  holz: { oben: FARBE.holzOben, vorne: FARBE.holzVorne, seite: FARBE.holzSeite },
  bande: { oben: FARBE.bandeOben, vorne: FARBE.bandeVorne, seite: FARBE.bandeSeite },
  erde: { oben: FARBE.erdeHell, vorne: FARBE.erde, seite: FARBE.erdeDunkel },
} as const;

/** Parteifarbe als Materialsatz - fuer Sockel und Wimpel. */
export function parteiMaterial(spieler: 0 | 1): {
  oben: string; vorne: string; seite: string;
} {
  return {
    oben: FARBE.seiteHell[spieler],
    vorne: FARBE.seite[spieler],
    seite: FARBE.seiteDunkel[spieler],
  };
}
