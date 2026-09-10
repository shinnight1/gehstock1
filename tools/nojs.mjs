/* ------------------------------------------------------------------
   Dateien-Modus: Spiele ganz ohne JavaScript.

   Die Vorschau der iPadOS-Dateien-App rendert HTML und CSS und nimmt
   Tipps entgegen - sie fuehrt nur keine Skripte aus. Alles hier drin
   kommt deshalb ohne eine einzige Zeile JavaScript aus:

     - Zustand  = <input type="checkbox|radio">
     - Eingabe  = <label for="...">
     - Logik    = Geschwisterselektoren (#a:checked ~ #b:checked ~ .ziel)
     - Zaehler  = CSS-Counter
     - Neustart = <button type="reset"> im <form>

   Alle Raetsel werden hier beim Bauen erzeugt und als fertiges CSS
   ausgegeben. Zur Laufzeit wird nichts mehr berechnet.
   ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ Zufall */

function rng(seed) {
  let a = seed >>> 0;
  const f = function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.int = (n) => Math.floor(f() * n);
  f.pick = (arr) => arr[f.int(arr.length)];
  f.shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = f.int(i + 1);
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };
  return f;
}

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/* Sammelt HTML und CSS eines Spiels ein. */
function Part() {
  return { html: [], css: [], h(s) { this.html.push(s); return this; },
    c(s) { this.css.push(s); return this; } };
}

/* ------------------------------------------------------------------ Minensucher */

function mineBoard(seed, w, h, mines) {
  const r = rng(seed);
  const m = new Uint8Array(w * h);
  let placed = 0;
  // Die Mitte bleibt frei, damit es einen sicheren ersten Tipp gibt.
  const safe = Math.floor(h / 2) * w + Math.floor(w / 2);
  while (placed < mines) {
    const i = r.int(w * h);
    if (m[i] || i === safe) continue;
    m[i] = 1; placed++;
  }
  const n = new Int8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (m[y * w + x]) { n[y * w + x] = -1; continue; }
      let c = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          if (m[ny * w + nx]) c++;
        }
      }
      n[y * w + x] = c;
    }
  }
  return { w, h, mines, n, safe };
}

function mineGame(key, title, sub, board) {
  const p = Part();
  const { w, h, n } = board;
  const P = key;                       // Praefix aller Kennungen

  p.h('<form class="ng" id="g-' + P + '">');
  p.h('<input type="checkbox" id="' + P + 'F" class="i">');   // Flaggen-Modus
  for (let i = 0; i < w * h; i++) {
    p.h('<input type="checkbox" id="' + P + 'a' + i + '" class="i">');  // aufdecken
    p.h('<input type="checkbox" id="' + P + 'f' + i + '" class="i">');  // Flagge
  }

  p.h('<div class="hd"><div class="ti">' + esc(title) + '</div>'
    + '<div class="su">' + esc(sub) + '</div></div>');
  p.h('<div class="jbar">'
    + '<label for="' + P + 'F" class="tg"><span class="jon">🚩 Flaggen-Modus</span>'
    + '<span class="joff">⛏ Aufdecken</span></label>'
    + '<div class="cnt">🚩 <b class="flags"></b> / ' + board.mines + '</div>'
    + '<button type="reset" class="rs">Neu</button></div>');

  p.h('<div class="mine" style="--w:' + w + '">');
  for (let i = 0; i < w * h; i++) {
    const v = n[i];
    p.h('<span class="cl c' + i + (v < 0 ? ' bomb' : ' v' + v) + '">'
      + '<label for="' + P + 'a' + i + '" class="la"></label>'
      + '<label for="' + P + 'f' + i + '" class="lf"></label>'
      + '<span class="mk">' + (v < 0 ? '💣' : (v > 0 ? v : '')) + '</span>'
      + '<span class="fl">🚩</span></span>');
  }
  p.h('</div>');

  p.h('<div class="ov lose"><b>Bumm.</b><br>Da lag eine Mine.'
    + '<button type="reset" class="rs jbig">Nochmal</button></div>');
  p.h('<div class="ov win"><b>Geschafft!</b><br>Alle sicheren Felder gefunden.'
    + '<button type="reset" class="rs jbig">Nochmal</button></div>');
  p.h('<label for="nav-menu" class="jback">‹ Zurück zum Menü</label>');
  p.h('</form>');

  /* --- Regeln --- */
  const S = '#g-' + P + ' ';
  // Aufdecken
  for (let i = 0; i < w * h; i++) {
    p.c('#' + P + 'a' + i + ':checked~.mine .c' + i + '{background:var(--n-open)}');
    p.c('#' + P + 'a' + i + ':checked~.mine .c' + i + ' .mk{opacity:1}');
    p.c('#' + P + 'a' + i + ':checked~.mine .c' + i + ' .la{pointer-events:none}');
  }
  // Flaggen: Zaehler und Anzeige
  for (let i = 0; i < w * h; i++) {
    p.c('#' + P + 'f' + i + ':checked~.mine .c' + i + ' .fl{opacity:1;counter-increment:fl}');
    p.c('#' + P + 'f' + i + ':checked~.mine .c' + i + ' .la{pointer-events:none}');
  }
  // Flaggen-Modus schaltet um, welche Beschriftung Tipps annimmt
  p.c('#' + P + 'F:checked~.mine .la{pointer-events:none}');
  p.c('#' + P + 'F:checked~.mine .lf{pointer-events:auto}');
  p.c('#' + P + 'F:checked~.jbar .tg .jon{display:inline}');
  p.c('#' + P + 'F:checked~.jbar .tg .joff{display:none}');
  p.c('#' + P + 'F:checked~.jbar .tg{background:var(--n-gold);color:#1a1204}');

  // Verloren: irgendeine Mine aufgedeckt
  const bombs = [];
  for (let i = 0; i < w * h; i++) if (n[i] < 0) bombs.push('#' + P + 'a' + i + ':checked~.lose');
  p.c(bombs.join(',') + '{display:block}');
  const bombsAll = [];
  for (let i = 0; i < w * h; i++) if (n[i] < 0) bombsAll.push('#' + P + 'a' + i + ':checked~.mine .bomb .mk');
  p.c(bombsAll.join(',') + '{opacity:1}');

  // Gewonnen: alle sicheren Felder aufgedeckt
  const safeSel = [];
  for (let i = 0; i < w * h; i++) if (n[i] >= 0) safeSel.push('#' + P + 'a' + i + ':checked');
  p.c(safeSel.join('~') + '~.win{display:block}');

  return p;
}

/* ------------------------------------------------------------------ Memory */

const MEM_SYMBOLS = ['🐙', '🦊', '🐢', '🦉', '🐝', '🦋', '🐬', '🦔', '🐳', '🦜', '🐸', '🦕'];

function memoryGame(seed, pairs) {
  const p = Part();
  const P = 'me';
  const r = rng(seed);
  const cards = [];
  for (let i = 0; i < pairs; i++) { cards.push(i); cards.push(i); }
  r.shuffle(cards);

  p.h('<form class="ng" id="g-' + P + '">');
  for (let i = 0; i < cards.length; i++) {
    p.h('<input type="checkbox" id="' + P + i + '" class="i">');
  }
  p.h('<div class="hd"><div class="ti">Memory</div>'
    + '<div class="su">' + pairs + ' Paare — decke zwei gleiche Tiere auf</div></div>');
  p.h('<div class="jbar"><div class="cnt">Aufgedeckt: <b class="flags"></b> / '
    + cards.length + '</div><button type="reset" class="rs">Neu mischen</button></div>');

  p.h('<div class="mem">');
  for (let i = 0; i < cards.length; i++) {
    p.h('<label for="' + P + i + '" class="mc m' + i + ' p' + cards[i] + '">'
      + '<span class="bk">?</span><span class="fr">' + MEM_SYMBOLS[cards[i]] + '</span></label>');
  }
  p.h('</div>');
  p.h('<div class="ov win"><b>Alle Paare gefunden!</b><br>Gut gemerkt.'
    + '<button type="reset" class="rs jbig">Nochmal</button></div>');
  p.h('<label for="nav-menu" class="jback">‹ Zurück zum Menü</label>');
  p.h('</form>');

  for (let i = 0; i < cards.length; i++) {
    p.c('#' + P + i + ':checked~.mem .m' + i + '{transform:rotateY(180deg)}');
    p.c('#' + P + i + ':checked~.mem .m' + i + '{counter-increment:fl}');
    p.c('#' + P + i + ':checked~.mem .m' + i + '{pointer-events:none}');
  }
  // Paar gefunden -> beide leuchten
  const byPair = {};
  cards.forEach((v, i) => { (byPair[v] = byPair[v] || []).push(i); });
  Object.keys(byPair).forEach((v) => {
    const [a, b] = byPair[v];
    p.c('#' + P + a + ':checked~#' + P + b + ':checked~.mem .p' + v + '{--mc:var(--n-green)}');
  });
  // Gewonnen
  p.c(cards.map((_, i) => '#' + P + i + ':checked').join('~') + '~.win{display:block}');

  return p;
}

/* ------------------------------------------------------------------ Drei gewinnt */

const TTT_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function tttGame() {
  const p = Part();
  const P = 'tt';

  p.h('<form class="ng" id="g-' + P + '">');
  for (let i = 0; i < 9; i++) {
    p.h('<input type="radio" name="' + P + i + '" id="' + P + 'x' + i + '" class="i">');
    p.h('<input type="radio" name="' + P + i + '" id="' + P + 'o' + i + '" class="i">');
  }
  p.h('<div class="hd"><div class="ti">Drei gewinnt</div>'
    + '<div class="su">Zu zweit am selben iPad — jeder tippt auf seine Hälfte</div></div>');
  p.h('<div class="jbar"><div class="cnt">Blau ✕ &nbsp;·&nbsp; Gold ◯</div>'
    + '<button type="reset" class="rs">Neu</button></div>');

  p.h('<div class="ttt">');
  for (let i = 0; i < 9; i++) {
    p.h('<span class="tc t' + i + '">'
      + '<label for="' + P + 'x' + i + '" class="hx">✕</label>'
      + '<label for="' + P + 'o' + i + '" class="ho">◯</label>'
      + '<span class="mx">✕</span><span class="mo">◯</span></span>');
  }
  p.h('</div>');
  p.h('<div class="ov win"><b class="wx">Blau gewinnt!</b><b class="wo">Gold gewinnt!</b>'
    + '<button type="reset" class="rs jbig">Nochmal</button></div>');
  p.h('<label for="nav-menu" class="jback">‹ Zurück zum Menü</label>');
  p.h('</form>');

  for (let i = 0; i < 9; i++) {
    p.c('#' + P + 'x' + i + ':checked~.ttt .t' + i + ' .mx{opacity:1}');
    p.c('#' + P + 'o' + i + ':checked~.ttt .t' + i + ' .mo{opacity:1}');
    p.c('#' + P + 'x' + i + ':checked~.ttt .t' + i + ' .hx,#' + P + 'x' + i + ':checked~.ttt .t' + i + ' .ho,'
      + '#' + P + 'o' + i + ':checked~.ttt .t' + i + ' .hx,#' + P + 'o' + i + ':checked~.ttt .t' + i + ' .ho'
      + '{display:none}');
  }
  const winX = TTT_LINES.map((l) => l.map((i) => '#' + P + 'x' + i + ':checked').join('~'));
  const winO = TTT_LINES.map((l) => l.map((i) => '#' + P + 'o' + i + ':checked').join('~'));
  p.c(winX.map((s) => s + '~.win').join(',') + '{display:block}');
  p.c(winX.map((s) => s + '~.win .wx').join(',') + '{display:block}');
  p.c(winO.map((s) => s + '~.win').join(',') + '{display:block}');
  p.c(winO.map((s) => s + '~.win .wo').join(',') + '{display:block}');
  // Nach dem Sieg ist das Brett zu
  p.c(winX.concat(winO).map((s) => s + '~.ttt').join(',') + '{pointer-events:none}');

  return p;
}

/* ------------------------------------------------------------------ Quiz */

const QUIZ = [
  { q: 'Wie viele Container passen auf ein ULCS-Schiff?', a: ['rund 24 000', 'rund 2 400', 'rund 240'], r: 0 },
  { q: 'Was misst die Einheit TEU?', a: ['Containergröße', 'Schiffsgeschwindigkeit', 'Wassertiefe'], r: 0 },
  { q: 'Wie heißt der tiefste Punkt der Ozeane?', a: ['Marianengraben', 'Tiefseegraben Nord', 'Atlantikschlucht'], r: 0 },
  { q: 'Welches Tier hat drei Herzen?', a: ['Krake', 'Elefant', 'Adler'], r: 0 },
  { q: 'Was macht ein Lotse im Hafen?', a: ['Er führt Schiffe sicher hinein', 'Er belädt Container', 'Er kontrolliert Pässe'], r: 0 },
  { q: 'Wie viele Felder hat ein Schachbrett?', a: ['64', '81', '100'], r: 0 },
  { q: 'Welcher Planet ist der Sonne am nächsten?', a: ['Merkur', 'Venus', 'Mars'], r: 0 },
  { q: 'Was ist ein Reefer-Container?', a: ['ein Kühlcontainer', 'ein Tankcontainer', 'ein Faltcontainer'], r: 0 },
  { q: 'Wie viele Bundesländer hat Deutschland?', a: ['16', '14', '18'], r: 0 },
  { q: 'Was bedeutet „Tiefgang" bei einem Schiff?', a: ['wie tief es im Wasser liegt', 'wie schnell es fährt', 'wie viel es kostet'], r: 0 },
];

function quizGame(seed) {
  const p = Part();
  const P = 'qz';
  const r = rng(seed);

  p.h('<form class="ng" id="g-' + P + '">');
  QUIZ.forEach((it, i) => {
    it.a.forEach((_, j) => {
      p.h('<input type="radio" name="' + P + i + '" id="' + P + i + '_' + j + '" class="i">');
    });
  });
  p.h('<div class="hd"><div class="ti">Quiz</div>'
    + '<div class="su">' + QUIZ.length + ' Fragen — richtig wird grün, falsch rot</div></div>');
  p.h('<div class="jbar"><div class="cnt">Richtig: <b class="flags"></b> / '
    + QUIZ.length + '</div><button type="reset" class="rs">Neu</button></div>');

  p.h('<div class="quiz">');
  QUIZ.forEach((it, i) => {
    // Antworten mischen, damit die richtige nicht immer oben steht
    const order = r.shuffle(it.a.map((_, j) => j));
    p.h('<div class="qq"><div class="qt">' + (i + 1) + '. ' + esc(it.q) + '</div>');
    order.forEach((j) => {
      p.h('<label for="' + P + i + '_' + j + '" class="qa a' + i + '_' + j + '">'
        + esc(it.a[j]) + '</label>');
    });
    p.h('</div>');
  });
  p.h('</div>');
  p.h('<div class="ov win"><b>Alles richtig!</b><br>Alle ' + QUIZ.length + ' Fragen gelöst.'
    + '<button type="reset" class="rs jbig">Nochmal</button></div>');
  p.h('<label for="nav-menu" class="jback">‹ Zurück zum Menü</label>');
  p.h('</form>');

  QUIZ.forEach((it, i) => {
    it.a.forEach((_, j) => {
      const ok = j === it.r;
      p.c('#' + P + i + '_' + j + ':checked~.quiz .a' + i + '_' + j
        + '{background:' + (ok ? 'var(--n-greenbg);border-color:var(--n-green);color:var(--n-greenfg)'
          : 'var(--n-redbg);border-color:var(--n-red);color:var(--n-redfg)') + '}');
      if (ok) {
        p.c('#' + P + i + '_' + j + ':checked~.quiz .a' + i + '_' + j + '{counter-increment:fl}');
        p.c('#' + P + i + '_' + j + ':checked~.quiz .qq:nth-child(' + (i + 1) + ')'
          + '{pointer-events:none}');
      }
    });
  });
  p.c(QUIZ.map((it, i) => '#' + P + i + '_' + it.r + ':checked').join('~') + '~.win{display:block}');

  return p;
}

/* ------------------------------------------------------------------ Nonogramm */

function cluesOf(line) {
  const out = [];
  let run = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i]) run++;
    else if (run) { out.push(run); run = 0; }
  }
  if (run) out.push(run);
  return out.length ? out : [0];
}

/* Loest eine einzelne Zeile so weit wie die Logik reicht.
   cells: 0 unbekannt, 1 voll, 2 leer. Gibt null zurueck, wenn es
   ueberhaupt keine passende Belegung gibt. */
function lineSolve(clues, cells) {
  const n = cells.length;
  const fits = [];
  const cur = new Uint8Array(n);
  (function place(ci, pos) {
    if (fits.length > 20000) return;
    if (ci >= clues.length || clues[0] === 0) {
      for (let i = pos; i < n; i++) { if (cells[i] === 1) return; cur[i] = 2; }
      fits.push(cur.slice());
      return;
    }
    const len = clues[ci];
    const rest = clues.slice(ci + 1).reduce((a, b) => a + b + 1, 0);
    for (let s = pos; s + len + rest <= n; s++) {
      let ok = true;
      for (let i = pos; i < s; i++) { if (cells[i] === 1) { ok = false; break; } cur[i] = 2; }
      if (!ok) break;
      for (let i = s; i < s + len; i++) { if (cells[i] === 2) { ok = false; break; } cur[i] = 1; }
      if (!ok) continue;
      if (s + len < n) { if (cells[s + len] === 1) continue; cur[s + len] = 2; }
      place(ci + 1, s + len + 1);
    }
  })(0, 0);
  if (!fits.length) return null;
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    let v = fits[0][i], same = true;
    for (let k = 1; k < fits.length; k++) if (fits[k][i] !== v) { same = false; break; }
    out[i] = same ? v : 0;
  }
  return out;
}

/* Ist das Raetsel allein mit Logik loesbar? */
function logicSolvable(rowC, colC, w, h) {
  const g = new Uint8Array(w * h);
  for (let pass = 0; pass < 40; pass++) {
    let changed = false;
    for (let y = 0; y < h; y++) {
      const line = [];
      for (let x = 0; x < w; x++) line.push(g[y * w + x]);
      const r = lineSolve(rowC[y], line);
      if (!r) return false;
      for (let x = 0; x < w; x++) if (r[x] && !g[y * w + x]) { g[y * w + x] = r[x]; changed = true; }
    }
    for (let x = 0; x < w; x++) {
      const line = [];
      for (let y = 0; y < h; y++) line.push(g[y * w + x]);
      const r = lineSolve(colC[x], line);
      if (!r) return false;
      for (let y = 0; y < h; y++) if (r[y] && !g[y * w + x]) { g[y * w + x] = r[y]; changed = true; }
    }
    let done = true;
    for (let i = 0; i < w * h; i++) if (!g[i]) done = false;
    if (done) return true;
    if (!changed) return false;
  }
  return false;
}

function nonoPuzzle(seed, w, h, density) {
  for (let attempt = 0; attempt < 400; attempt++) {
    const r = rng(seed + attempt * 7919);
    const sol = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) sol[i] = r() < density ? 1 : 0;
    // Glaetten: Bloecke statt Rauschen, das ergibt loesbarere Muster
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let n = 0, c = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nx = x + dx, ny = y + dy;
              if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
              n++; c += sol[ny * w + nx];
            }
          }
          if (c * 2 > n + 1) sol[y * w + x] = 1;
          else if (c * 2 < n - 1) sol[y * w + x] = 0;
        }
      }
    }
    let filled = 0;
    for (let i = 0; i < w * h; i++) filled += sol[i];
    if (filled < w * h * 0.3 || filled > w * h * 0.72) continue;

    const rowC = [], colC = [];
    for (let y = 0; y < h; y++) {
      const l = []; for (let x = 0; x < w; x++) l.push(sol[y * w + x]);
      rowC.push(cluesOf(l));
    }
    for (let x = 0; x < w; x++) {
      const l = []; for (let y = 0; y < h; y++) l.push(sol[y * w + x]);
      colC.push(cluesOf(l));
    }
    if (logicSolvable(rowC, colC, w, h)) return { w, h, sol, rowC, colC };
  }
  return null;
}

function nonoGame(key, title, pz) {
  const p = Part();
  const P = key;
  const { w, h, sol, rowC, colC } = pz;

  p.h('<form class="ng" id="g-' + P + '">');
  p.h('<input type="checkbox" id="' + P + 'M" class="i">');
  for (let i = 0; i < w * h; i++) {
    p.h('<input type="checkbox" id="' + P + 'v' + i + '" class="i">');
    p.h('<input type="checkbox" id="' + P + 'x' + i + '" class="i">');
  }

  p.h('<div class="hd"><div class="ti">' + esc(title) + '</div>'
    + '<div class="su">' + w + '×' + h + ' — die Zahlen sagen, wie viele Felder am Stück voll sind</div></div>');
  p.h('<div class="jbar">'
    + '<label for="' + P + 'M" class="tg"><span class="jon">✕ Streichen</span>'
    + '<span class="joff">■ Ausmalen</span></label>'
    + '<button type="reset" class="rs">Neu</button></div>');

  p.h('<div class="non" style="--w:' + w + '">');
  p.h('<div class="ncr"></div><div class="ncc">');
  for (let x = 0; x < w; x++) {
    p.h('<span class="ccl">' + colC[x].map((v) => v ? '<i>' + v + '</i>' : '<i>0</i>').join('') + '</span>');
  }
  p.h('</div><div class="ncr2">');
  for (let y = 0; y < h; y++) {
    p.h('<span class="rcl">' + rowC[y].map((v) => '<i>' + v + '</i>').join('') + '</span>');
  }
  p.h('</div><div class="nbd">');
  for (let i = 0; i < w * h; i++) {
    p.h('<span class="nc n' + i + '">'
      + '<label for="' + P + 'v' + i + '" class="lv"></label>'
      + '<label for="' + P + 'x' + i + '" class="lx"></label>'
      + '<span class="xm">✕</span></span>');
  }
  p.h('</div></div>');

  p.h('<div class="ov win"><b>Gelöst!</b><br>Das Bild stimmt.'
    + '<button type="reset" class="rs jbig">Nochmal</button></div>');
  p.h('<label for="nav-menu" class="jback">‹ Zurück zum Menü</label>');
  p.h('</form>');

  for (let i = 0; i < w * h; i++) {
    p.c('#' + P + 'v' + i + ':checked~.non .n' + i + '{background:var(--n-tx)}');
    p.c('#' + P + 'x' + i + ':checked~.non .n' + i + ' .xm{opacity:.55}');
  }
  p.c('#' + P + 'M:checked~.non .lv{pointer-events:none}');
  p.c('#' + P + 'M:checked~.non .lx{pointer-events:auto}');
  p.c('#' + P + 'M:checked~.jbar .tg .jon{display:inline}');
  p.c('#' + P + 'M:checked~.jbar .tg .joff{display:none}');
  p.c('#' + P + 'M:checked~.jbar .tg{background:var(--n-gold);color:#1a1204}');

  const on = [], off = [];
  for (let i = 0; i < w * h; i++) (sol[i] ? on : off).push(i);
  p.c(on.map((i) => '#' + P + 'v' + i + ':checked').join('~') + '~.win{display:block}');
  // Ein einziges falsch ausgemaltes Feld nimmt den Sieg wieder weg.
  if (off.length) {
    p.c(off.map((i) => '#' + P + 'v' + i + ':checked~.win').join(',') + '{display:none!important}');
  }

  return p;
}

/* ------------------------------------------------------------------ Mini-Sudoku */

function sudokuGen(seed, n, bw, bh, holes) {
  const r = rng(seed);
  const g = new Int8Array(n * n);

  function ok(i, v) {
    const x = i % n, y = (i / n) | 0;
    for (let k = 0; k < n; k++) {
      if (g[y * n + k] === v || g[k * n + x] === v) return false;
    }
    const bx = Math.floor(x / bw) * bw, by = Math.floor(y / bh) * bh;
    for (let dy = 0; dy < bh; dy++) {
      for (let dx = 0; dx < bw; dx++) if (g[(by + dy) * n + bx + dx] === v) return false;
    }
    return true;
  }
  (function fill(i) {
    if (i >= n * n) return true;
    const vals = r.shuffle(Array.from({ length: n }, (_, k) => k + 1));
    for (const v of vals) {
      if (!ok(i, v)) continue;
      g[i] = v;
      if (fill(i + 1)) return true;
      g[i] = 0;
    }
    return false;
  })(0);

  const solution = Array.from(g);
  const puzzle = Array.from(g);

  function count(limit) {
    let found = 0;
    const t = puzzle.slice();
    (function go() {
      if (found >= limit) return;
      let i = -1;
      for (let k = 0; k < n * n; k++) if (!t[k]) { i = k; break; }
      if (i < 0) { found++; return; }
      const x = i % n, y = (i / n) | 0;
      for (let v = 1; v <= n; v++) {
        let bad = false;
        for (let k = 0; k < n; k++) if (t[y * n + k] === v || t[k * n + x] === v) { bad = true; break; }
        if (!bad) {
          const bx = Math.floor(x / bw) * bw, by = Math.floor(y / bh) * bh;
          for (let dy = 0; dy < bh && !bad; dy++) {
            for (let dx = 0; dx < bw; dx++) if (t[(by + dy) * n + bx + dx] === v) { bad = true; break; }
          }
        }
        if (bad) continue;
        t[i] = v; go(); t[i] = 0;
        if (found >= limit) return;
      }
    })();
    return found;
  }

  const order = r.shuffle(Array.from({ length: n * n }, (_, k) => k));
  let removed = 0;
  for (const i of order) {
    if (removed >= holes) break;
    const keep = puzzle[i];
    puzzle[i] = 0;
    if (count(2) !== 1) puzzle[i] = keep; else removed++;
  }
  return { n, bw, bh, puzzle, solution };
}

function sudokuGame(key, title, sd) {
  const p = Part();
  const P = key;
  const { n, bw, bh, puzzle, solution } = sd;
  const open = [];
  for (let i = 0; i < n * n; i++) if (!puzzle[i]) open.push(i);

  p.h('<form class="ng" id="g-' + P + '">');
  p.h('<input type="radio" name="' + P + 'pen" id="' + P + 'p0" class="i">');
  for (let v = 1; v <= n; v++) {
    p.h('<input type="radio" name="' + P + 'pen" id="' + P + 'p' + v + '" class="i"'
      + (v === 1 ? ' checked' : '') + '>');
  }
  open.forEach((i) => {
    p.h('<input type="radio" name="' + P + 'c' + i + '" id="' + P + 'c' + i + '_0" class="i" checked>');
    for (let v = 1; v <= n; v++) {
      p.h('<input type="radio" name="' + P + 'c' + i + '" id="' + P + 'c' + i + '_' + v + '" class="i">');
    }
  });

  p.h('<div class="hd"><div class="ti">' + esc(title) + '</div>'
    + '<div class="su">Zahl unten wählen, dann auf ein Feld tippen — '
    + 'jede Zahl einmal pro Zeile, Spalte und Kasten</div></div>');

  p.h('<div class="sud" style="--n:' + n + ';--bw:' + bw + ';--bh:' + bh + '">');
  for (let i = 0; i < n * n; i++) {
    const x = i % n, y = (i / n) | 0;
    const cls = 'sc s' + i
      + (x % bw === 0 && x ? ' bl' : '') + (y % bh === 0 && y ? ' bt' : '')
      + (puzzle[i] ? ' giv' : '');
    if (puzzle[i]) {
      p.h('<span class="' + cls + '"><span class="sv">' + puzzle[i] + '</span></span>');
    } else {
      let s = '<span class="' + cls + '">';
      for (let v = 0; v <= n; v++) {
        s += '<label for="' + P + 'c' + i + '_' + v + '" class="sl l' + v + '"></label>';
      }
      for (let v = 1; v <= n; v++) s += '<span class="sm m' + v + '">' + v + '</span>';
      p.h(s + '</span>');
    }
  }
  p.h('</div>');

  p.h('<div class="pen">');
  for (let v = 1; v <= n; v++) {
    p.h('<label for="' + P + 'p' + v + '" class="pb b' + v + '">' + v + '</label>');
  }
  p.h('<label for="' + P + 'p0" class="pb b0">⌫</label>');
  p.h('</div>');
  p.h('<div class="jbar"><button type="reset" class="rs">Neu</button></div>');

  p.h('<div class="ov win"><b>Gelöst!</b><br>Alles passt.'
    + '<button type="reset" class="rs jbig">Nochmal</button></div>');
  p.h('<label for="nav-menu" class="jback">‹ Zurück zum Menü</label>');
  p.h('</form>');

  /* Der aktive Stift entscheidet, welche der uebereinanderliegenden
     Beschriftungen Tipps annimmt - eine Regel je Stift, nicht je Feld. */
  for (let v = 0; v <= n; v++) {
    p.c('#' + P + 'p' + v + ':checked~.sud .sl.l' + v + '{pointer-events:auto}');
    p.c('#' + P + 'p' + v + ':checked~.pen .b' + v + '{background:var(--n-gold);color:#1a1204;'
      + 'border-color:var(--n-gold)}');
  }
  open.forEach((i) => {
    for (let v = 1; v <= n; v++) {
      p.c('#' + P + 'c' + i + '_' + v + ':checked~.sud .s' + i + ' .m' + v + '{opacity:1}');
    }
  });
  p.c(open.map((i) => '#' + P + 'c' + i + '_' + solution[i] + ':checked').join('~') + '~.win{display:block}');

  return p;
}

/* ------------------------------------------------------------------ Labyrinth */

function mazeGen(seed, w, h) {
  const r = rng(seed);
  // Zellenraster mit Waenden: Gitter (2w+1) x (2h+1)
  const W = 2 * w + 1, H = 2 * h + 1;
  const g = new Uint8Array(W * H);          // 1 = Gang
  const seen = new Uint8Array(w * h);
  const stack = [0];
  seen[0] = 1;
  g[1 * W + 1] = 1;
  while (stack.length) {
    const c = stack[stack.length - 1];
    const cx = c % w, cy = (c / w) | 0;
    const opts = [];
    if (cx > 0 && !seen[c - 1]) opts.push([-1, 0, c - 1]);
    if (cx < w - 1 && !seen[c + 1]) opts.push([1, 0, c + 1]);
    if (cy > 0 && !seen[c - w]) opts.push([0, -1, c - w]);
    if (cy < h - 1 && !seen[c + w]) opts.push([0, 1, c + w]);
    if (!opts.length) { stack.pop(); continue; }
    const [dx, dy, nx] = opts[r.int(opts.length)];
    g[(2 * cy + 1 + dy) * W + (2 * cx + 1 + dx)] = 1;
    g[(2 * ((nx / w) | 0) + 1) * W + (2 * (nx % w) + 1)] = 1;
    seen[nx] = 1;
    stack.push(nx);
  }
  return { W, H, g, start: 1 * W + 1, end: (H - 2) * W + (W - 2) };
}

function mazeGame(key, title, sub, mz) {
  const p = Part();
  const P = key;
  const { W, H, g, start, end } = mz;

  const cells = [];
  for (let i = 0; i < W * H; i++) if (g[i]) cells.push(i);

  p.h('<form class="ng" id="g-' + P + '">');
  cells.forEach((i) => {
    p.h('<input type="checkbox" id="' + P + 'm' + i + '" class="i"'
      + (i === start ? ' checked' : '') + '>');
  });

  p.h('<div class="hd"><div class="ti">' + esc(title) + '</div>'
    + '<div class="su">' + esc(sub) + '</div></div>');
  p.h('<div class="jbar"><div class="cnt">Von oben links nach unten rechts</div>'
    + '<button type="reset" class="rs">Neu</button></div>');

  p.h('<div class="maz" style="--w:' + W + '">');
  for (let i = 0; i < W * H; i++) {
    if (!g[i]) { p.h('<span class="mz wall"></span>'); continue; }
    p.h('<span class="mz way w' + i + (i === end ? ' goal' : '') + (i === start ? ' strt' : '') + '">'
      + '<label for="' + P + 'm' + i + '" class="ml"></label></span>');
  }
  p.h('</div>');

  p.h('<div class="ov win"><b>Ausgang gefunden!</b><br>Sauber durchgekommen.'
    + '<button type="reset" class="rs jbig">Nochmal</button></div>');
  p.h('<label for="nav-menu" class="jback">‹ Zurück zum Menü</label>');
  p.h('</form>');

  // Betretene Felder faerben sich; erreichbar ist nur, was an einem
  // betretenen Feld anliegt - das erzwingt echtes Laufen statt Springen.
  cells.forEach((i) => {
    p.c('#' + P + 'm' + i + ':checked~.maz .w' + i + '{background:var(--n-gold)}');
    const nb = [i - 1, i + 1, i - W, i + W].filter((k) => k >= 0 && k < W * H && g[k]);
    if (nb.length) {
      p.c(nb.map((k) => '#' + P + 'm' + i + ':checked~.maz .w' + k + ' .ml').join(',')
        + '{pointer-events:auto}');
    }
  });
  p.c('#' + P + 'm' + end + ':checked~.win{display:block}');

  return p;
}

/* ------------------------------------------------------------------ Abenteuer */

/* Verzweigte Geschichte. Jede Szene ist ein Radio derselben Gruppe -
   eine Wahl schaltet die naechste Szene ein. */
const STORY = {
  start: 'k0',
  scenes: {
    k0: {
      t: 'Der Keller',
      x: 'Hinter der Turnhalle steht eine Tür, die dort niemand vermutet. '
        + 'Dahinter führt eine Treppe nach unten. Ganz unten: drei Gänge und der '
        + 'Geruch von altem Papier. An der Wand lehnt ein Gehstock mit goldenem Knauf.',
      c: [['Den Gehstock mitnehmen', 'k1'], ['Ohne alles weitergehen', 'k2']],
    },
    k1: {
      t: 'Der Gehstock',
      x: 'Der Knauf ist warm. Als du ihn drehst, klickt etwas, und aus dem Griff '
        + 'fällt ein kleiner Messingschlüssel. Die drei Gänge liegen vor dir: '
        + 'links tropft Wasser, in der Mitte ist es still, rechts zieht Luft.',
      c: [['Nach links', 'w1'], ['Geradeaus', 'm1'], ['Nach rechts', 'r1']],
    },
    k2: {
      t: 'Ohne Stock',
      x: 'Du gehst weiter. Nach zwanzig Schritten steht der erste Gang unter Wasser, '
        + 'der mittlere endet an einer verschlossenen Tür mit Messingschloss, und '
        + 'rechts zieht kalte Luft.',
      c: [['Rechts weiter', 'r1'], ['Zurück zum Gehstock', 'k1']],
    },
    w1: {
      t: 'Die Zisterne',
      x: 'Der Gang mündet in einen runden Raum, knietief voll Wasser. In der Mitte '
        + 'ragt ein Sockel heraus, darauf liegt ein Notizbuch, staubtrocken.',
      c: [['Das Notizbuch holen', 'w2'], ['Umkehren', 'k1']],
    },
    w2: {
      t: 'Das Notizbuch',
      x: 'Eine Handschrift, sehr ordentlich: „Wer den dritten Gang nimmt, muss die '
        + 'Zahl kennen. Sie steht dort, wo niemand hinsieht — unter der Stufe." '
        + 'Auf der letzten Seite: 4 – 1 – 7.',
      c: [['Zurück und die Stufe prüfen', 'r1'], ['Zur Messingtür', 'm1']],
    },
    m1: {
      t: 'Die Messingtür',
      x: 'Eine schwere Tür, das Schloss glänzt, als würde es täglich geputzt.',
      c: [['Mit dem Messingschlüssel öffnen', 'm2'], ['Klopfen', 'm3'],
        ['Doch lieber nach rechts', 'r1']],
    },
    m2: {
      t: 'Das Archiv',
      x: 'Regale bis unter die Decke, alle beschriftet mit Jahreszahlen. In der '
        + 'Mitte ein Tisch, darauf eine Karte der ganzen Anlage — und ein '
        + 'eingekreistes Feld: der dritte Gang, hinter einer Zahlenscheibe.',
      c: [['Die Karte mitnehmen und weiter', 'r1']],
    },
    m3: {
      t: 'Es klopft zurück',
      x: 'Zweimal, sehr höflich. Dann Stille. Die Tür bleibt zu. Irgendwo hinter '
        + 'dir fällt eine andere Tür ins Schloss.',
      c: [['Schnell nach rechts', 'r1'], ['Zurück zum Anfang', 'k1']],
    },
    r1: {
      t: 'Der dritte Gang',
      x: 'Kalte Luft, und nach wenigen Metern eine Stahltür mit einer Zahlenscheibe. '
        + 'Drei Stellen. Unter der ersten Stufe klemmt ein Zettel.',
      c: [['Den Zettel herausziehen', 'r2'], ['Einfach etwas ausprobieren', 'r3']],
    },
    r2: {
      t: 'Der Zettel',
      x: 'Nur drei Ziffern, mit Bleistift: 4 – 1 – 7. Die Scheibe wartet.',
      c: [['4 – 1 – 7 einstellen', 'end'], ['7 – 1 – 4 einstellen', 'r3']],
    },
    r3: {
      t: 'Falsch',
      x: 'Die Scheibe rastet ein und springt sofort zurück. Von oben rieselt Staub. '
        + 'Beim dritten Versuch wird eine Klingel losgehen, so viel ist sicher.',
      c: [['Doch erst den Zettel suchen', 'r2'], ['Ins Archiv', 'm1']],
    },
    end: {
      t: 'Das Hideout',
      x: 'Die Tür schwingt auf. Dahinter: ein Raum mit Teppich, zwei Sesseln, einer '
        + 'Lampe und einem Regal voller Spiele. An der Wand ein Schild, sauber '
        + 'gemalt: „Herr Gehstocks Hideout — bitte leise spielen." Du hast es gefunden.',
      c: [],
      win: true,
    },
  },
};

function storyGame() {
  const p = Part();
  const P = 'ad';
  const keys = Object.keys(STORY.scenes);

  p.h('<form class="ng" id="g-' + P + '">');
  keys.forEach((k) => {
    p.h('<input type="radio" name="' + P + '" id="' + P + '_' + k + '" class="i"'
      + (k === STORY.start ? ' checked' : '') + '>');
  });

  p.h('<div class="hd"><div class="ti">Herr Gehstocks Keller</div>'
    + '<div class="su">Ein Abenteuer zum Durchtippen</div></div>');

  p.h('<div class="adv">');
  keys.forEach((k) => {
    const s = STORY.scenes[k];
    p.h('<div class="sc' + k + ' scn">'
      + '<div class="st">' + esc(s.t) + '</div>'
      + '<div class="sx">' + esc(s.x) + '</div>'
      + s.c.map((c) => '<label for="' + P + '_' + c[1] + '" class="ch">'
        + esc(c[0]) + '</label>').join('')
      + (s.win ? '<div class="fin">✦ Geschafft ✦</div>' : '')
      + '<label for="' + P + '_' + STORY.start + '" class="ch again">Von vorn anfangen</label>'
      + '</div>');
  });
  p.h('</div>');
  p.h('<label for="nav-menu" class="jback">‹ Zurück zum Menü</label>');
  p.h('</form>');

  keys.forEach((k) => {
    p.c('#' + P + '_' + k + ':checked~.adv .sc' + k + '{display:block}');
  });

  return p;
}

/* ------------------------------------------------------------------ Hideout-Tycoon

   Ein Tycoon ohne Rechnerei: Geld kann CSS nicht vergleichen, wohl aber
   zaehlen und verzweigen. Deshalb steckt die Wirtschaft in der Struktur -
   was gebaut werden darf, haengt daran, was schon steht (Geschwister-
   selektoren), und die Kennzahlen laufen ueber CSS-Counter, die beim
   Bauen hochgezaehlt werden. Die Anzeige steht im Dokument hinter dem
   Laden und wird per order:-1 nach oben geholt, denn ein Counter kennt
   nur, was vor ihm liegt.
   ------------------------------------------------------------------ */

const TYC = [
  { s: 1, id: 'sessel', ic: '🪑', n: 'Zweiter Sessel', k: 40, b: 2, e: 0,
    d: 'Damit man zu zweit sitzen kann.' },
  { s: 1, id: 'lampe', ic: '💡', n: 'Leselampe', k: 30, b: 1, e: 0,
    d: 'Die Kerze reicht nicht mehr.' },
  { s: 1, id: 'regal', ic: '📚', n: 'Spieleregal', k: 90, b: 4, e: 0,
    d: 'Endlich Platz für die Schachteln.' },
  { s: 1, id: 'teppich', ic: '🟫', n: 'Alter Teppich', k: 60, b: 2, e: 0,
    d: 'Schluckt den Hall im Gewölbe.' },

  { s: 2, id: 'kakao', ic: '☕', n: 'Kakaomaschine', k: 180, b: 3, e: 8,
    r: ['regal', 'teppich'], d: 'Der erste echte Grund wiederzukommen.' },
  { s: 2, id: 'kekse', ic: '🍪', n: 'Keksdose', k: 70, b: 2, e: 4,
    r: ['regal'], d: 'Wird verdächtig schnell leer.' },
  { s: 2, id: 'garde', ic: '🧥', n: 'Garderobe', k: 110, b: 2, e: 0,
    r: ['teppich'], d: 'Nasse Jacken gehören nicht auf die Sessel.' },
  { s: 2, id: 'raum2', ic: '🚪', n: 'Zweiter Raum', k: 320, b: 6, e: 0,
    r: ['regal', 'teppich'], d: 'Hinter der Wand war noch mehr Keller.' },

  { s: 3, id: 'turnier', ic: '🏆', n: 'Turnierbrett', k: 260, b: 8, e: 15,
    r: ['kakao', 'raum2'], d: 'Jeden Freitag Schach, jeden Dienstag Dame.' },
  { s: 3, id: 'karten', ic: '🃏', n: 'Kartentische', k: 240, b: 6, e: 12,
    r: ['raum2'], d: 'Doppelkopf bis in die Nacht.' },
  { s: 3, id: 'musik', ic: '🎵', n: 'Musikanlage', k: 200, b: 4, e: 0,
    r: ['kakao'], d: 'Leise. Es ist immer noch ein Versteck.' },
  { s: 3, id: 'kasse', ic: '💰', n: 'Kasse mit Sparbüchse', k: 150, b: 0, e: 20,
    r: ['kakao', 'kekse'], d: 'Freiwillig, aber alle werfen etwas ein.' },

  { s: 4, id: 'raum3', ic: '🗝', n: 'Dritter Raum', k: 640, b: 10, e: 0,
    r: ['turnier', 'kasse'], d: 'Der mit dem Gewölbebogen.' },
  { s: 4, id: 'werk', ic: '🔧', n: 'Werkstatt', k: 480, b: 5, e: 18,
    r: ['kasse'], d: 'Kaputte Spiele werden hier repariert statt weggeworfen.' },
  { s: 4, id: 'biblio', ic: '📖', n: 'Regelbibliothek', k: 420, b: 7, e: 10,
    r: ['turnier'], d: 'Jede Regelfrage endet hier.' },
  { s: 4, id: 'gang', ic: '🕳', n: 'Geheimgang', k: 700, b: 6, e: 0,
    r: ['raum3'], d: 'Ein zweiter Ausgang. Man weiß ja nie.' },

  { s: 5, id: 'kino', ic: '🎬', n: 'Kinoecke', k: 900, b: 12, e: 25,
    r: ['raum3', 'werk'], d: 'Leinwand, Projektor, viel zu viele Kissen.' },
  { s: 5, id: 'tresen', ic: '🥤', n: 'Tresen mit Limonade', k: 760, b: 9, e: 30,
    r: ['werk', 'biblio'], d: 'Selbstgemacht, drei Sorten.' },
  { s: 5, id: 'ausweis', ic: '🎫', n: 'Mitgliedsausweise', k: 300, b: 0, e: 40,
    r: ['biblio', 'gang'], d: 'Wer einen hat, kommt auch sonntags rein.' },
  { s: 5, id: 'thron', ic: '🦯', n: 'Herr Gehstocks Sessel', k: 1200, b: 15, e: 50,
    r: ['kino', 'tresen', 'ausweis'], d: 'Der Platz am Kopfende. Bleibt frei.' },
];

const TYC_STUFEN = ['Der Anfang', 'Für Gäste', 'Der Betrieb', 'Ausbau', 'Legende'];

function tycoonGame() {
  const p = Part();
  const P = 'ty';

  p.h('<form class="ng" id="g-' + P + '">');
  TYC.forEach((it) => {
    p.h('<input type="checkbox" id="' + P + '_' + it.id + '" class="i">');
  });

  p.h('<div class="hd"><div class="ti">Hideout-Tycoon</div>'
    + '<div class="su">Bau Herrn Gehstocks Keller aus — jedes Stück schaltet das nächste frei</div></div>');

  p.h('<div class="jty">');
  p.h('<div class="shop">');
  for (let s = 1; s <= 5; s++) {
    p.h('<div class="stf f' + s + '"><span class="sn">Stufe ' + s + '</span>'
      + '<span class="stl">' + esc(TYC_STUFEN[s - 1]) + '</span></div>');
    p.h('<div class="itg">');
    TYC.filter((it) => it.s === s).forEach((it) => {
      p.h('<div class="it i_' + it.id + (it.r ? '' : ' free') + '">'
        + '<span class="iic">' + it.ic + '</span>'
        + '<span class="inm">' + esc(it.n) + '</span>'
        + '<span class="idc">' + esc(it.d) + '</span>'
        + '<span class="ief">'
        + (it.b ? '<i>+' + it.b + ' Besucher</i>' : '')
        + (it.e ? '<i>+' + it.e + ' € / Woche</i>' : '')
        + '</span>'
        + '<label for="' + P + '_' + it.id + '" class="ibt">Bauen · ' + it.k + ' €</label>'
        + '<span class="idn">✓ gebaut</span>'
        + '<span class="ilk">🔒 ' + esc(it.r ? 'braucht ' + it.r.map(
          (r) => TYC.find((t) => t.id === r).n).join(' + ') : '') + '</span>'
        + '</div>');
    });
    p.h('</div>');
  }
  p.h('</div>');

  /* Steht hinter dem Laden, damit die Counter schon gezaehlt haben -
     und wird per order nach oben geholt. */
  p.h('<div class="tst">'
    + '<span class="tb"><i class="k">Besucher / Woche</i><i class="v vb"></i></span>'
    + '<span class="tb"><i class="k">Einnahmen / Woche</i><i class="v ve"></i></span>'
    + '<span class="tb"><i class="k">Investiert</i><i class="v vi"></i></span>'
    + '<span class="tb"><i class="k">Ausgebaut</i><i class="v vn"></i></span>'
    + '</div>');
  p.h('</div>');

  p.h('<div class="jbar"><button type="reset" class="rs">Von vorn anfangen</button></div>');
  p.h('<div class="ov win"><b>Das Hideout ist fertig.</b><br>'
    + 'Alle zwanzig Ausbauten stehen. Herr Gehstock würde nicken und nichts sagen.'
    + '<button type="reset" class="rs jbig">Nochmal</button></div>');
  p.h('<label for="nav-menu" class="jback">‹ Zurück zum Menü</label>');
  p.h('</form>');

  /* --- Regeln --- */
  TYC.forEach((it) => {
    const me = '#' + P + '_' + it.id;
    // Freigeschaltet, sobald alle Voraussetzungen stehen
    if (it.r) {
      const pre = it.r.map((r) => '#' + P + '_' + r + ':checked').join('~');
      p.c(pre + '~.jty .i_' + it.id + '{opacity:1}');
      p.c(pre + '~.jty .i_' + it.id + ' .ilk{display:none}');
      p.c(pre + '~.jty .i_' + it.id + ' .ibt{display:block;pointer-events:auto}');
    }
    // Gebaut - schlaegt die Freischaltung, deshalb mit Nachdruck
    p.c(me + ':checked~.jty .i_' + it.id
      + '{opacity:1;border-color:var(--n-green);counter-increment:bes ' + it.b
      + ' eur ' + it.e + ' inv ' + it.k + ' anz 1}');
    p.c(me + ':checked~.jty .i_' + it.id + ' .ibt{display:none!important}');
    p.c(me + ':checked~.jty .i_' + it.id + ' .ilk{display:none!important}');
    p.c(me + ':checked~.jty .i_' + it.id + ' .idn{display:block!important}');
  });

  // Eine Stufe zeigt sich erst, wenn eines ihrer Stuecke erreichbar ist
  for (let s = 2; s <= 5; s++) {
    const erste = TYC.filter((it) => it.s === s);
    const sel = [];
    erste.forEach((it) => {
      if (!it.r) return;
      sel.push(it.r.map((r) => '#' + P + '_' + r + ':checked').join('~') + '~.jty .f' + s);
    });
    if (sel.length) p.c(sel.join(',') + '{opacity:1}');
  }

  p.c(TYC.map((it) => '#' + P + '_' + it.id + ':checked').join('~') + '~.win{display:block}');

  return p;
}

/* ------------------------------------------------------------------ Zusammenbau */

const GAMES = [
  { id: 'ty', icon: '🏛', name: 'Hideout-Tycoon', desc: '20 Ausbauten' },
  { id: 'ad', icon: '🕯', name: 'Herr Gehstocks Keller', desc: 'Abenteuer' },
  { id: 'mi1', icon: '💣', name: 'Minensucher', desc: '8×8 · leicht' },
  { id: 'mi2', icon: '💣', name: 'Minensucher', desc: '10×10 · mittel' },
  { id: 'mi3', icon: '💣', name: 'Minensucher', desc: '12×12 · schwer' },
  { id: 'no1', icon: '🖼', name: 'Nonogramm', desc: '5×5 · leicht' },
  { id: 'no2', icon: '🖼', name: 'Nonogramm', desc: '8×8 · mittel' },
  { id: 'no3', icon: '🖼', name: 'Nonogramm', desc: '10×10 · schwer' },
  { id: 'su1', icon: '🔢', name: 'Mini-Sudoku', desc: '4×4' },
  { id: 'su2', icon: '🔢', name: 'Sudoku', desc: '6×6' },
  { id: 'me', icon: '🧠', name: 'Memory', desc: '12 Paare' },
  { id: 'la1', icon: '🌀', name: 'Labyrinth', desc: 'klein' },
  { id: 'la2', icon: '🌀', name: 'Labyrinth', desc: 'groß' },
  { id: 'tt', icon: '⭕', name: 'Drei gewinnt', desc: 'zu zweit' },
  { id: 'qz', icon: '❓', name: 'Quiz', desc: '10 Fragen' },
];

export function buildNoJs() {
  const parts = [
    tycoonGame(),
    storyGame(),
    mineGame('mi1', 'Minensucher', '8×8 · 10 Minen', mineBoard(1001, 8, 8, 10)),
    mineGame('mi2', 'Minensucher', '10×10 · 18 Minen', mineBoard(1002, 10, 10, 18)),
    mineGame('mi3', 'Minensucher', '12×12 · 30 Minen', mineBoard(1003, 12, 12, 30)),
    nonoGame('no1', 'Nonogramm', nonoPuzzle(4101, 5, 5, 0.55)),
    nonoGame('no2', 'Nonogramm', nonoPuzzle(4202, 8, 8, 0.52)),
    nonoGame('no3', 'Nonogramm', nonoPuzzle(4303, 10, 10, 0.5)),
    sudokuGame('su1', 'Mini-Sudoku 4×4', sudokuGen(5101, 4, 2, 2, 10)),
    sudokuGame('su2', 'Sudoku 6×6', sudokuGen(5202, 6, 3, 2, 22)),
    memoryGame(2001, 12),
    mazeGame('la1', 'Labyrinth', 'klein — 8×8 Zellen', mazeGen(6101, 8, 8)),
    mazeGame('la2', 'Labyrinth', 'groß — 12×12 Zellen', mazeGen(6202, 12, 12)),
    tttGame(),
    quizGame(3001),
  ];

  let html = '<div id="sg-nojs">\n';
  html += '<input type="radio" name="nav" id="nav-menu" class="i" checked>\n';
  GAMES.forEach((g) => {
    html += '<input type="radio" name="nav" id="nav-' + g.id + '" class="i">\n';
  });

  html += '<div class="nw">\n';
  html += '<div class="nmenu">'
    + '<div class="nhead"><div class="ncane"></div>'
    + '<div class="nname">Herr Gehstocks Hideout</div>'
    + '<div class="nsub">Dateien-Modus — spielbar ohne JavaScript</div></div>'
    + '<div class="ngrid">';
  GAMES.forEach((g) => {
    html += '<label for="nav-' + g.id + '" class="nt">'
      + '<span class="ni">' + g.icon + '</span>'
      + '<span class="nn">' + esc(g.name) + '</span>'
      + '<span class="nd">' + esc(g.desc) + '</span></label>';
  });
  html += '</div>'
    + '<div class="nnote"><b>Warum nur diese Spiele?</b> Die Vorschau der Dateien-App '
    + 'führt keine Skripte aus. Diese hier kommen ganz ohne aus — sie laufen über '
    + 'reines HTML und CSS.<br><br>Die vollen 27 Spiele samt beiden Tycoons brauchen '
    + 'Berechnungen und laufen, sobald die Datei in einem richtigen Browser geöffnet '
    + 'wird: am Mac oder PC per Doppelklick, auf dem iPad über <b>gedrückt halten → '
    + '„Öffnen mit"</b> oder über <b>Zum Home-Bildschirm</b>.</div>'
    + '</div>\n';

  parts.forEach((p) => { html += p.html.join('') + '\n'; });
  html += '</div>\n</div>\n';

  let css = BASE_CSS;
  css += '#nav-menu:checked~.nw .nmenu{display:block}\n';
  GAMES.forEach((g) => {
    css += '#nav-' + g.id + ':checked~.nw #g-' + g.id + '{display:block}\n';
  });
  parts.forEach((p) => { css += p.css.join('\n') + '\n'; });

  return '<style>\n' + css + '</style>\n' + html;
}

/* ------------------------------------------------------------------ Aussehen */

const BASE_CSS = `
#sg-nojs{
  --n-bg:#0d1017; --n-bg2:#121722; --n-pan:#191f2e; --n-pan2:#212a3d;
  --n-line:#2f3a55; --n-line2:#232c40; --n-tx:#e9edf6; --n-tx2:#b9c3da;
  --n-mut:#8794b1; --n-gold:#f0b429; --n-gold2:#ffd166;
  --n-green:#3ddc84; --n-greenbg:rgba(61,220,132,.12); --n-greenfg:#c8f3da;
  --n-red:#ff5f6b; --n-redbg:rgba(255,95,107,.12); --n-redfg:#ffd3d7;
  --n-blue:#4aa3ff; --n-open:#0f131c;
  position:absolute; inset:0; overflow:auto; -webkit-overflow-scrolling:touch;
  background:var(--n-bg); color:var(--n-tx);
  font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
  opacity:0; visibility:hidden;
  animation:sg-help-in 0s linear 3s forwards;
  z-index:10000;
}
html.js #sg-nojs{animation:none}

/* Schutzwall: das App-Stylesheet steht in derselben Datei und benutzt
   dieselben kurzen Klassennamen. Ein Selektor mit Kennung schlaegt jede
   Klassenregel - damit erbt hier drin nichts Fremdes mehr. Eigene Regeln
   liegen eine Stufe darueber (Kennung + Klasse) und gewinnen weiterhin. */
#sg-nojs *{margin:0;padding:0;border:0;background:none;color:inherit;font:inherit;
  width:auto;height:auto;min-width:0;min-height:0;max-width:none;max-height:none;
  position:static;inset:auto;float:none;transform:none;box-shadow:none;opacity:1;
  letter-spacing:inherit;text-transform:inherit;text-align:inherit;line-height:inherit;
  list-style:none;box-sizing:border-box;-webkit-appearance:none;appearance:none}
#sg-nojs div,#sg-nojs form,#sg-nojs ol,#sg-nojs li{display:block}
#sg-nojs span,#sg-nojs b{display:inline}
#sg-nojs label,#sg-nojs button{display:inline-block}

#sg-nojs .i{position:absolute;opacity:0;width:0;height:0;pointer-events:none}
#sg-nojs .nw{max-width:640px;margin:0 auto;
  padding:calc(16px + env(safe-area-inset-top,0px)) 14px calc(28px + env(safe-area-inset-bottom,0px))}
#sg-nojs .nmenu,#sg-nojs .ng{display:none}

/* --- Menue --- */
#sg-nojs .nhead{text-align:center;padding:10px 0 22px}
#sg-nojs .ncane{width:40px;height:56px;margin:0 auto 14px;border:5px solid var(--n-gold);
  border-radius:22px 22px 0 0;border-bottom:0;position:relative}
#sg-nojs .ncane::after{content:"";position:absolute;right:-5px;top:22px;width:5px;height:38px;
  background:var(--n-gold);border-radius:3px}
#sg-nojs .nname{font-size:19px;font-weight:650}
#sg-nojs .nsub{font-size:13px;color:var(--n-mut);margin-top:3px}
#sg-nojs .ngrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
#sg-nojs .nt{display:block;background:var(--n-pan);border:1px solid var(--n-line);
  border-radius:16px;padding:14px;text-align:center;-webkit-user-select:none;user-select:none;
  cursor:pointer}
#sg-nojs .nt:active{background:var(--n-pan2)}
#sg-nojs .ni{display:block;font-size:26px;margin-bottom:6px}
#sg-nojs .nn{display:block;font-weight:650}
#sg-nojs .nd{display:block;font-size:12.5px;color:var(--n-mut);margin-top:2px}
#sg-nojs .nnote{margin-top:18px;background:var(--n-bg2);border:1px solid var(--n-line2);
  border-radius:14px;padding:14px 16px;font-size:13.5px;color:var(--n-tx2)}
#sg-nojs .nnote b{color:var(--n-tx)}

/* --- Spielrahmen --- */
#sg-nojs .ng{counter-reset:fl}
#sg-nojs .hd{text-align:center;margin-bottom:12px}
#sg-nojs .ti{font-size:20px;font-weight:700}
#sg-nojs .su{font-size:13px;color:var(--n-mut);margin-top:2px}
#sg-nojs .jbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;
  justify-content:center;margin-bottom:14px}
#sg-nojs .cnt{font-size:13.5px;color:var(--n-tx2);background:var(--n-pan);
  border:1px solid var(--n-line);border-radius:999px;padding:7px 14px}
#sg-nojs .cnt b{color:var(--n-gold2)}
#sg-nojs .flags::before{content:counter(fl)}
#sg-nojs .tg{background:var(--n-pan);border:1px solid var(--n-line);border-radius:999px;
  padding:7px 14px;font-size:13.5px;font-weight:650;-webkit-user-select:none;user-select:none;
  cursor:pointer}
#sg-nojs .tg .jon{display:none}
#sg-nojs .rs{background:var(--n-pan2);border:1px solid var(--n-line);color:var(--n-tx);
  border-radius:999px;padding:7px 16px;font:inherit;font-size:13.5px;font-weight:650;
  cursor:pointer;-webkit-appearance:none}
#sg-nojs .rs:active{background:var(--n-line)}
#sg-nojs .rs.jbig{display:block;margin:14px auto 0;padding:11px 26px;font-size:15px;
  background:var(--n-gold);border-color:var(--n-gold);color:#1a1204}
#sg-nojs .jback{display:block;text-align:center;margin-top:20px;color:var(--n-mut);
  font-size:14px;padding:10px;-webkit-user-select:none;user-select:none;cursor:pointer}
#sg-nojs .ov{display:none;background:var(--n-pan);border:1px solid var(--n-gold);
  border-radius:16px;padding:20px;text-align:center;margin-top:16px;font-size:15px;
  color:var(--n-tx2)}
#sg-nojs .ov b{display:block;font-size:19px;color:var(--n-tx);margin-bottom:4px}

/* --- Minensucher --- */
#sg-nojs .mine{display:grid;grid-template-columns:repeat(var(--w),1fr);gap:3px;
  max-width:min(100%,460px);margin:0 auto}
#sg-nojs .cl{position:relative;aspect-ratio:1;background:var(--n-pan2);border-radius:5px;
  display:grid;place-items:center;font-size:min(4.2vw,17px);font-weight:700}
#sg-nojs .cl .la,#sg-nojs .cl .lf{position:absolute;inset:0;cursor:pointer;
  -webkit-user-select:none;user-select:none}
#sg-nojs .cl .lf{pointer-events:none}
#sg-nojs .cl .mk,#sg-nojs .cl .fl{opacity:0;pointer-events:none}
#sg-nojs .cl .fl{position:absolute;inset:0;display:grid;place-items:center}
#sg-nojs .v1 .mk{color:#7fb4ff}#sg-nojs .v2 .mk{color:var(--n-green)}
#sg-nojs .v3 .mk{color:var(--n-gold2)}#sg-nojs .v4 .mk{color:#c79bff}
#sg-nojs .v5 .mk{color:#ff9c3f}#sg-nojs .v6 .mk{color:#34d3d3}
#sg-nojs .v7 .mk,#sg-nojs .v8 .mk{color:var(--n-red)}

/* --- Memory --- */
#sg-nojs .mem{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;
  max-width:min(100%,460px);margin:0 auto}
#sg-nojs .mc{--mc:var(--n-line);position:relative;aspect-ratio:.78;cursor:pointer;
  transform-style:preserve-3d;transition:transform .32s ease;
  -webkit-user-select:none;user-select:none}
#sg-nojs .mc .bk,#sg-nojs .mc .fr{position:absolute;inset:0;border-radius:10px;
  display:grid;place-items:center;-webkit-backface-visibility:hidden;backface-visibility:hidden}
#sg-nojs .mc .bk{background:var(--n-pan2);border:1px solid var(--n-line);
  color:var(--n-mut);font-size:20px;font-weight:700}
#sg-nojs .mc .fr{background:var(--n-pan);border:2px solid var(--mc);
  font-size:min(7vw,28px);transform:rotateY(180deg)}

/* --- Drei gewinnt --- */
#sg-nojs .ttt{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;
  max-width:min(100%,340px);margin:0 auto}
#sg-nojs .tc{position:relative;aspect-ratio:1;background:var(--n-pan2);
  border:1px solid var(--n-line);border-radius:12px;overflow:hidden}
#sg-nojs .tc .hx,#sg-nojs .tc .ho{position:absolute;left:0;width:100%;height:50%;
  display:grid;place-items:center;font-size:20px;opacity:.22;cursor:pointer;
  -webkit-user-select:none;user-select:none}
#sg-nojs .tc .hx{top:0;color:var(--n-blue);border-bottom:1px dashed var(--n-line)}
#sg-nojs .tc .ho{bottom:0;color:var(--n-gold)}
#sg-nojs .tc .mx,#sg-nojs .tc .mo{position:absolute;inset:0;display:grid;place-items:center;
  font-size:min(13vw,44px);font-weight:700;opacity:0;pointer-events:none}
#sg-nojs .tc .mx{color:var(--n-blue)}
#sg-nojs .tc .mo{color:var(--n-gold)}
#sg-nojs .win .wx,#sg-nojs .win .wo{display:none}

/* --- Nonogramm --- */
#sg-nojs .non{display:grid;grid-template-columns:auto 1fr;grid-template-rows:auto 1fr;
  gap:4px;max-width:min(100%,480px);margin:0 auto}
#sg-nojs .ncc{display:grid;grid-template-columns:repeat(var(--w),1fr);gap:2px}
#sg-nojs .ccl{display:flex;flex-direction:column;justify-content:flex-end;align-items:center;
  gap:1px;font-size:min(2.7vw,12px);color:var(--n-gold2);padding-bottom:2px}
#sg-nojs .ncr2{display:grid;gap:2px}
#sg-nojs .rcl{display:flex;align-items:center;justify-content:flex-end;gap:4px;
  font-size:min(2.7vw,12px);color:var(--n-gold2);padding-right:3px}
#sg-nojs .nbd{display:grid;grid-template-columns:repeat(var(--w),1fr);gap:2px}
#sg-nojs .nc{position:relative;aspect-ratio:1;background:var(--n-pan2);border-radius:3px}
#sg-nojs .nc .lv,#sg-nojs .nc .lx{position:absolute;inset:0;cursor:pointer;
  -webkit-user-select:none;user-select:none}
#sg-nojs .nc .lx{pointer-events:none}
#sg-nojs .nc .xm{position:absolute;inset:0;display:grid;place-items:center;opacity:0;
  font-size:min(3.2vw,13px);color:var(--n-mut);pointer-events:none}

/* --- Sudoku --- */
#sg-nojs .sud{display:grid;grid-template-columns:repeat(var(--n),1fr);gap:2px;
  max-width:min(100%,360px);margin:0 auto;background:var(--n-line);padding:3px;
  border-radius:10px}
#sg-nojs .sc{position:relative;aspect-ratio:1;background:var(--n-pan2);border-radius:4px;
  display:grid;place-items:center}
#sg-nojs .sc.bl{margin-left:3px}
#sg-nojs .sc.bt{margin-top:3px}
#sg-nojs .sc.giv{background:var(--n-pan)}
#sg-nojs .sv{font-size:min(6vw,22px);font-weight:700;color:var(--n-mut)}
#sg-nojs .sl{position:absolute;inset:0;pointer-events:none;cursor:pointer;
  -webkit-user-select:none;user-select:none}
#sg-nojs .sm{position:absolute;inset:0;display:grid;place-items:center;opacity:0;
  font-size:min(6vw,22px);font-weight:700;color:var(--n-gold2);pointer-events:none}
#sg-nojs .pen{display:flex;justify-content:center;gap:6px;flex-wrap:wrap;margin:14px 0}
#sg-nojs .pb{width:44px;height:44px;display:grid;place-items:center;background:var(--n-pan);
  border:1px solid var(--n-line);border-radius:11px;font-size:18px;font-weight:700;
  cursor:pointer;-webkit-user-select:none;user-select:none}

/* --- Labyrinth --- */
#sg-nojs .maz{display:grid;grid-template-columns:repeat(var(--w),1fr);gap:0;
  max-width:min(100%,440px);margin:0 auto;background:var(--n-bg2);padding:6px;
  border-radius:10px}
#sg-nojs .mz{position:relative;aspect-ratio:1}
#sg-nojs .mz.wall{background:var(--n-pan2)}
#sg-nojs .mz.way{background:var(--n-bg)}
#sg-nojs .mz .ml{position:absolute;inset:-2px;pointer-events:none;cursor:pointer;
  -webkit-user-select:none;user-select:none}
#sg-nojs .mz.strt{background:var(--n-gold)}
#sg-nojs .mz.goal{background:var(--n-green)}

/* --- Hideout-Tycoon --- */
#sg-nojs .jty{display:flex;flex-direction:column;max-width:560px;margin:0 auto;
  counter-reset:bes 0 eur 0 inv 0 anz 0}
#sg-nojs .tst{order:-1;display:grid;grid-template-columns:repeat(2,1fr);gap:8px;
  margin-bottom:16px}
#sg-nojs .tb{display:block;background:var(--n-pan);border:1px solid var(--n-line);
  border-radius:13px;padding:10px 13px}
#sg-nojs .tb .k{display:block;font-size:11.5px;letter-spacing:.05em;
  text-transform:uppercase;color:var(--n-mut)}
#sg-nojs .tb .v{display:block;font-size:20px;font-weight:700;color:var(--n-gold2);
  margin-top:2px}
#sg-nojs .vb::before{content:counter(bes)}
#sg-nojs .ve::before{content:counter(eur) " €"}
#sg-nojs .vi::before{content:counter(inv) " €"}
#sg-nojs .vn::before{content:counter(anz) " / 20"}
#sg-nojs .stf{display:flex;align-items:baseline;gap:9px;margin:16px 0 9px;opacity:.35}
#sg-nojs .stf.f1{opacity:1}
#sg-nojs .sn{font-size:11.5px;font-weight:700;letter-spacing:.07em;
  text-transform:uppercase;color:var(--n-gold)}
#sg-nojs .stl{font-size:15px;font-weight:650}
#sg-nojs .itg{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:9px}
#sg-nojs .it{display:block;background:var(--n-pan);border:1px solid var(--n-line);
  border-radius:14px;padding:13px 14px;opacity:.4}
#sg-nojs .it.free{opacity:1}
#sg-nojs .iic{display:block;font-size:21px;margin-bottom:3px}
#sg-nojs .inm{display:block;font-weight:650}
#sg-nojs .idc{display:block;font-size:12.5px;color:var(--n-mut);margin:2px 0 7px}
#sg-nojs .ief{display:block;margin-bottom:9px}
#sg-nojs .ief i{display:inline-block;font-size:12px;font-style:normal;
  background:var(--n-bg2);border:1px solid var(--n-line2);border-radius:999px;
  padding:3px 9px;margin:0 5px 4px 0;color:var(--n-tx2)}
#sg-nojs .ibt{display:none;pointer-events:none;background:var(--n-gold);color:#1a1204;
  border-radius:10px;padding:10px;text-align:center;font-weight:650;cursor:pointer;
  -webkit-user-select:none;user-select:none}
#sg-nojs .it.free .ibt{display:block;pointer-events:auto}
#sg-nojs .idn{display:none;text-align:center;padding:10px;font-weight:650;
  color:var(--n-green)}
#sg-nojs .ilk{display:block;text-align:center;padding:10px;font-size:12.5px;
  color:var(--n-mut)}
#sg-nojs .it.free .ilk{display:none}

/* --- Abenteuer --- */
#sg-nojs .adv{max-width:520px;margin:0 auto}
#sg-nojs .scn{display:none;background:var(--n-pan);border:1px solid var(--n-line);
  border-radius:16px;padding:18px 18px 14px}
#sg-nojs .st{font-size:18px;font-weight:700;margin-bottom:8px;color:var(--n-gold2)}
#sg-nojs .sx{color:var(--n-tx2);margin-bottom:14px}
#sg-nojs .ch{display:block;background:var(--n-bg2);border:1px solid var(--n-line2);
  border-radius:11px;padding:12px 14px;margin-bottom:8px;cursor:pointer;
  -webkit-user-select:none;user-select:none}
#sg-nojs .ch.again{background:none;border:0;color:var(--n-mut);font-size:13.5px;
  text-align:center;padding:10px 0 0;margin:0}
#sg-nojs .fin{text-align:center;color:var(--n-gold);font-size:17px;font-weight:700;
  margin:6px 0 12px;letter-spacing:.08em}

/* --- Quiz --- */
#sg-nojs .quiz{max-width:520px;margin:0 auto}
#sg-nojs .qq{background:var(--n-pan);border:1px solid var(--n-line);border-radius:14px;
  padding:14px 16px;margin-bottom:10px}
#sg-nojs .qt{font-weight:650;margin-bottom:10px}
#sg-nojs .qa{display:block;background:var(--n-bg2);border:1px solid var(--n-line2);
  border-radius:10px;padding:11px 13px;margin-bottom:7px;cursor:pointer;
  -webkit-user-select:none;user-select:none;font-size:14.5px}
#sg-nojs .qa:last-child{margin-bottom:0}
`;
