/* ------------------------------------------------------------------
   Querformat erzwingen.

   Das Spielfeld ist hochkant, die Bedienung liegt links und rechts
   davon - im Hochformat bliebe dafuer kein Platz. Statt ein zweites
   Layout zu pflegen, blendet sich eine Sperre ein.

   Geprueft wird das Seitenverhaeltnis des Elements, nicht
   screen.orientation: im iframe auf der Hub-Seite sagt die
   Bildschirmlage nichts darueber, wie viel Platz wir bekommen.
   ------------------------------------------------------------------ */

export interface Ausrichtung {
  istHochformat(): boolean;
  pruefen(): void;
  zerstoeren(): void;
}

export function ausrichtungUeberwachen(wurzel: HTMLElement): Ausrichtung {
  const sperre = document.createElement('div');
  sperre.className = 'arena-drehen';
  sperre.innerHTML = '<div>'
    + '<div class="zeichen">📱</div>'
    + '<h2>Bitte quer halten</h2>'
    + '<p>Die Arena braucht die Breite — dreh das Gerät einmal um.</p>'
    + '</div>';
  wurzel.appendChild(sperre);

  let hochformat = false;

  function pruefen(): void {
    const kasten = wurzel.getBoundingClientRect();
    const neu = kasten.height > kasten.width;
    if (neu === hochformat) return;
    hochformat = neu;
    wurzel.classList.toggle('ist-hochformat', hochformat);
  }

  pruefen();
  const beobachter = new ResizeObserver(pruefen);
  beobachter.observe(wurzel);

  return {
    istHochformat: () => hochformat,
    pruefen,
    zerstoeren() {
      beobachter.disconnect();
      sperre.remove();
    },
  };
}
