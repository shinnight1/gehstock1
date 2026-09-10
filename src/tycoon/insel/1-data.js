/* ------------------------------------------------------------------
   Island Quest - Tabellen

   Aufbau, Erkundung, Strategie. Der Unterschied zu den anderen Tycoons:
   hier gibt es kein Geld als Hauptwaehrung, sondern Ketten. Holz wird zu
   Brettern, Erz und Holz werden zu Metall, Bretter und Metall werden zu
   Werkzeug - und ohne Werkzeug faehrt kein Schiff zur naechsten Insel.

   Der Platz ist knapp: jede Insel hat ein festes Raster, und jedes
   Gebaeude will an die richtige Stelle. Ein Holzfaeller im Wald bringt
   das Dreifache, ein Fischer ohne Wasser gar nichts.

   Zeit: ein Tag dauert bei 1x acht Sekunden.
   ------------------------------------------------------------------ */

(function (SG) {
  var D = (SG.tycoon.insel = SG.tycoon.insel || {}).data = {};

  D.SEK_PRO_TAG = 8;
  D.BREITE = 10;
  D.HOEHE = 8;

  /* ---------------------------------------------------------- Boden */

  D.BODEN = {
    wasser: { name: 'Wasser', farbe: '#1b3a52', bebaubar: false, icon: '🌊' },
    strand: { name: 'Strand', farbe: '#b8a06a', bebaubar: true, icon: '🏖' },
    wiese: { name: 'Wiese', farbe: '#3f6b3a', bebaubar: true, icon: '🌿' },
    wald: { name: 'Wald', farbe: '#245231', bebaubar: true, icon: '🌲' },
    fels: { name: 'Fels', farbe: '#5c5f6b', bebaubar: true, icon: '🪨' },
    berg: { name: 'Berg', farbe: '#7b7f8c', bebaubar: true, icon: '⛰' },
    sumpf: { name: 'Sumpf', farbe: '#3b4a34', bebaubar: true, icon: '🌾' },
    ruine: { name: 'Ruine', farbe: '#6b6152', bebaubar: true, icon: '🏛' },
    vulkan: { name: 'Vulkan', farbe: '#6b3a2e', bebaubar: false, icon: '🌋' },
  };

  /* ---------------------------------------------------------- Waren */

  D.WAREN = [
    { id: 'holz', name: 'Holz', icon: '🪵', grund: true },
    { id: 'stein', name: 'Stein', icon: '🪨', grund: true },
    { id: 'nahrung', name: 'Nahrung', icon: '🍞', grund: true },
    { id: 'fasern', name: 'Fasern', icon: '🌾', grund: true },
    { id: 'erz', name: 'Erz', icon: '🟤', grund: true },
    { id: 'bretter', name: 'Bretter', icon: '🪚' },
    { id: 'ziegel', name: 'Ziegel', icon: '🧱' },
    { id: 'stoff', name: 'Stoff', icon: '🧵' },
    { id: 'metall', name: 'Metall', icon: '⚙' },
    { id: 'werkzeug', name: 'Werkzeug', icon: '🛠' },
    { id: 'muenzen', name: 'Münzen', icon: '🪙', geld: true },
  ];

  D.ware = function (id) {
    for (var i = 0; i < D.WAREN.length; i++) if (D.WAREN[i].id === id) return D.WAREN[i];
    return null;
  };

  /* Was der Markt je Stueck zahlt */
  D.MARKTPREIS = {
    holz: 2, stein: 3, nahrung: 2, fasern: 3, erz: 8,
    bretter: 7, ziegel: 9, stoff: 11, metall: 26, werkzeug: 70,
  };

  /* ---------------------------------------------------------- Gebaeude */

  /* kosten     was der Bau verbraucht
     bewohner   wie viele Leute es beschaeftigt (negativ = es beherbergt)
     erzeugt    Waren je Tag bei voller Besetzung
     braucht    Waren je Tag, die es verbraucht
     boden      erlaubte Felder
     nachbar    Bonus je angrenzendem Feld dieser Art
     schalter   besondere Wirkung */
  D.GEBAEUDE = [
    {
      id: 'huette', name: 'Hütte', icon: '🛖', kosten: { holz: 12 },
      bewohner: -4, boden: ['strand', 'wiese', 'wald', 'sumpf', 'ruine'],
      text: 'Platz für vier Leute. Ohne Wohnraum wächst nichts.',
    },
    {
      id: 'haus', name: 'Steinhaus', icon: '🏠', kosten: { bretter: 14, ziegel: 10 },
      bewohner: -10, boden: ['strand', 'wiese', 'wald', 'ruine'],
      text: 'Zehn Leute, und es hält auch dem Sturm stand.',
    },
    {
      id: 'holzfaeller', name: 'Holzfäller', icon: '🪓', kosten: { holz: 8 },
      bewohner: 2, erzeugt: { holz: 4 }, boden: ['wald', 'wiese'],
      nachbar: { wald: 1.6 },
      text: 'Bringt viel mehr, wenn ringsum Wald steht.',
    },
    {
      id: 'steinbruch', name: 'Steinbruch', icon: '⛏', kosten: { holz: 14 },
      bewohner: 3, erzeugt: { stein: 4 }, boden: ['fels', 'berg'],
      nachbar: { fels: 1.2, berg: 1.4 },
      text: 'Nur im Fels. Je mehr Stein ringsum, desto besser.',
    },
    {
      id: 'feld', name: 'Feld', icon: '🌾', kosten: { holz: 6 },
      bewohner: 2, erzeugt: { nahrung: 5, fasern: 1 }, boden: ['wiese', 'sumpf'],
      nachbar: { wiese: 1.25 },
      text: 'Getreide und Flachs. Die Grundlage von allem.',
    },
    {
      id: 'fischer', name: 'Fischerhütte', icon: '🎣', kosten: { holz: 10 },
      bewohner: 2, erzeugt: { nahrung: 6 }, boden: ['strand'],
      nachbar: { wasser: 1.35 },
      text: 'Muss ans Wasser. Je mehr offene See, desto voller die Netze.',
    },
    {
      id: 'jaeger', name: 'Jägerhütte', icon: '🏹', kosten: { holz: 9 },
      bewohner: 2, erzeugt: { nahrung: 4, fasern: 2 }, boden: ['wald'],
      nachbar: { wald: 1.3 },
      text: 'Wild und Felle aus dem Wald.',
    },
    {
      id: 'saegewerk', name: 'Sägewerk', icon: '🪚', kosten: { holz: 20, stein: 8 },
      bewohner: 3, braucht: { holz: 6 }, erzeugt: { bretter: 4 },
      boden: ['wiese', 'wald', 'strand'],
      text: 'Aus Holz werden Bretter. Ohne die kommt man nicht weit.',
    },
    {
      id: 'steinmetz', name: 'Steinmetz', icon: '🧱', kosten: { holz: 18, stein: 12 },
      bewohner: 3, braucht: { stein: 6 }, erzeugt: { ziegel: 4 },
      boden: ['wiese', 'fels', 'strand'],
      text: 'Aus Bruchstein werden Ziegel.',
    },
    {
      id: 'weberei', name: 'Weberei', icon: '🧵', kosten: { bretter: 12, stein: 8 },
      bewohner: 3, braucht: { fasern: 5 }, erzeugt: { stoff: 3 },
      boden: ['wiese', 'strand', 'ruine'],
      text: 'Stoff für Segel — und ohne Segel kein Schiff.',
    },
    {
      id: 'mine', name: 'Mine', icon: '🕳', kosten: { bretter: 16, stein: 14 },
      bewohner: 4, erzeugt: { erz: 3 }, boden: ['berg', 'fels'],
      nachbar: { berg: 1.5 },
      text: 'Erz aus dem Berg. Der Anfang jeder Metallverarbeitung.',
    },
    {
      id: 'schmelze', name: 'Schmelze', icon: '🔥', kosten: { ziegel: 16, bretter: 10 },
      bewohner: 4, braucht: { erz: 4, holz: 6 }, erzeugt: { metall: 2 },
      boden: ['fels', 'berg', 'wiese'],
      text: 'Frisst Holz und Erz, spuckt Metall.',
    },
    {
      id: 'werkstatt', name: 'Werkstatt', icon: '🛠', kosten: { bretter: 22, ziegel: 14 },
      bewohner: 5, braucht: { bretter: 3, metall: 2 }, erzeugt: { werkzeug: 1 },
      boden: ['wiese', 'strand', 'ruine'],
      text: 'Werkzeug. Man braucht es für jede Fahrt und jeden Ausbau.',
    },
    {
      id: 'lager', name: 'Lagerhaus', icon: '📦', kosten: { bretter: 14, stein: 10 },
      bewohner: 1, schalter: 'lager', wert: 400,
      boden: ['strand', 'wiese', 'fels', 'ruine'],
      text: 'Ohne Platz verdirbt der Überschuss.',
    },
    {
      id: 'markt', name: 'Markt', icon: '🏪', kosten: { bretter: 18, stoff: 6 },
      bewohner: 3, schalter: 'markt', wert: 0.25,
      boden: ['strand', 'wiese', 'ruine'],
      text: 'Verkauft, was über dem Lagerziel liegt, gegen Münzen.',
    },
    {
      id: 'hafen', name: 'Hafen', icon: '⚓', kosten: { bretter: 30, ziegel: 18, werkzeug: 4 },
      bewohner: 4, schalter: 'hafen', wert: 1,
      boden: ['strand'], nachbar: { wasser: 1 },
      text: 'Von hier fahren die Expeditionen. Muss ans Wasser.',
    },
    {
      id: 'leuchtturm', name: 'Leuchtturm', icon: '🗼', kosten: { ziegel: 30, metall: 10 },
      bewohner: 2, schalter: 'fahrt', wert: 0.25,
      boden: ['strand', 'fels'], nachbar: { wasser: 1 },
      text: 'Verkürzt jede Fahrt um ein Viertel.',
    },
    {
      id: 'schule', name: 'Schule', icon: '📚', kosten: { bretter: 26, ziegel: 20, stoff: 8 },
      bewohner: 3, schalter: 'wissen', wert: 0.12,
      boden: ['wiese', 'strand', 'ruine'],
      text: 'Jede Schule hebt die Leistung aller Betriebe.',
    },
    {
      id: 'tempel', name: 'Versammlungshaus', icon: '🏛', kosten: { ziegel: 24, stoff: 10 },
      bewohner: 2, schalter: 'laune', wert: 12,
      boden: ['wiese', 'fels', 'ruine'],
      text: 'Hebt die Stimmung — und zufriedene Leute arbeiten besser.',
    },
    {
      id: 'brunnen', name: 'Brunnen', icon: '⛲', kosten: { stein: 14 },
      bewohner: 0, schalter: 'laune', wert: 5,
      boden: ['wiese', 'strand', 'sumpf', 'ruine', 'fels'],
      text: 'Kostet fast nichts und hilft ein bisschen.',
    },
  ];

  D.gebaeude = function (id) {
    for (var i = 0; i < D.GEBAEUDE.length; i++) {
      if (D.GEBAEUDE[i].id === id) return D.GEBAEUDE[i];
    }
    return null;
  };

  /* ---------------------------------------------------------- Inseln */

  /* mischung  Wahrscheinlichkeiten der Bodenarten
     fahrt     Tage, die eine Expedition dorthin braucht
     ausruest  was die Fahrt kostet
     gabe      diese Insel bringt etwas mit, was es sonst nicht gibt */
  D.INSELN = [
    {
      id: 'heim', name: 'Ankerbucht', icon: '🏝', fahrt: 0, ausruest: null,
      mischung: { wiese: 0.34, wald: 0.28, strand: 0.16, fels: 0.12, sumpf: 0.06, berg: 0.04 },
      text: 'Wo alles anfängt. Wald, Wiese, ein bisschen Fels.',
    },
    {
      id: 'kiefern', name: 'Kiefernklippe', icon: '🌲', fahrt: 4,
      ausruest: { nahrung: 40, werkzeug: 2 },
      mischung: { wald: 0.52, fels: 0.2, wiese: 0.14, strand: 0.12, berg: 0.02 },
      gabe: 'holz',
      text: 'Nichts als Wald und Steilküste. Holz im Überfluss.',
    },
    {
      id: 'salzbank', name: 'Salzbank', icon: '🏖', fahrt: 6,
      ausruest: { nahrung: 70, werkzeug: 4, stoff: 6 },
      mischung: { strand: 0.46, wiese: 0.24, sumpf: 0.16, wald: 0.1, fels: 0.04 },
      gabe: 'nahrung',
      text: 'Flach, sandig, von Fischgründen umgeben.',
    },
    {
      id: 'grauhorn', name: 'Grauhorn', icon: '⛰', fahrt: 9,
      ausruest: { nahrung: 120, werkzeug: 8, stoff: 10 },
      mischung: { berg: 0.4, fels: 0.32, wald: 0.12, wiese: 0.1, strand: 0.06 },
      gabe: 'erz',
      text: 'Ein Felsklotz im Meer. Darin steckt Erz.',
    },
    {
      id: 'nebelmoor', name: 'Nebelmoor', icon: '🌫', fahrt: 12,
      ausruest: { nahrung: 180, werkzeug: 14, metall: 8 },
      mischung: { sumpf: 0.42, wald: 0.22, wiese: 0.16, strand: 0.12, ruine: 0.08 },
      gabe: 'fasern',
      text: 'Zäher Boden, aber die Ruinen dort sind alt und voller Spuren.',
    },
    {
      id: 'aschekap', name: 'Aschekap', icon: '🌋', fahrt: 16,
      ausruest: { nahrung: 260, werkzeug: 22, metall: 16 },
      mischung: { fels: 0.34, vulkan: 0.14, berg: 0.2, strand: 0.16, wiese: 0.16 },
      gabe: 'metall',
      text: 'Der Vulkan raucht noch. Der Boden ist reich, die Lage heikel.',
    },
    {
      id: 'goldriff', name: 'Goldriff', icon: '✨', fahrt: 22,
      ausruest: { nahrung: 400, werkzeug: 40, metall: 30, stoff: 24 },
      mischung: { strand: 0.34, ruine: 0.24, wiese: 0.2, fels: 0.14, berg: 0.08 },
      gabe: 'muenzen',
      text: 'Ein Ring aus Riffen um eine versunkene Stadt. Das Ziel der Reise.',
    },
  ];

  D.insel = function (id) {
    for (var i = 0; i < D.INSELN.length; i++) if (D.INSELN[i].id === id) return D.INSELN[i];
    return D.INSELN[0];
  };

  /* ---------------------------------------------------------- Bewohner */

  D.NAHRUNG_PRO_KOPF = 0.5;    // je Bewohner und Tag
  D.WACHSTUM = 0.06;           // je Tag, wenn satt und Platz da ist
  D.LAGER_GRUND = 300;

  /* ---------------------------------------------------------- Ereignisse */

  D.EREIGNISSE = [
    {
      id: 'sturm', icon: '🌪', name: 'Sturm',
      text: 'Ein Sturm reißt Dächer ab. Die Erträge brechen für drei Tage ein.',
      wirkung: { ertrag: -0.4, tage: 3 },
    },
    {
      id: 'ernte', icon: '🌻', name: 'Gute Ernte',
      text: 'Die Felder stehen prächtig. Vier Tage doppelte Nahrung.',
      wirkung: { nahrung: 1.0, tage: 4 },
    },
    {
      id: 'strandgut', icon: '🪵', name: 'Strandgut',
      text: 'Ein Wrack treibt an. Die Leute schleppen alles Brauchbare heim.',
      wirkung: { fund: true },
    },
    {
      id: 'seuche', icon: '🤒', name: 'Fieber',
      text: 'Ein Fieber geht um. Die Hälfte liegt flach.',
      wirkung: { ertrag: -0.35, tage: 4 }, bedingung: 'eng',
    },
    {
      id: 'piraten', icon: '🏴', name: 'Piraten',
      text: 'Ein fremdes Segel am Horizont. Sie nehmen sich, was oben liegt.',
      wirkung: { raub: 0.25 }, bedingung: 'reich',
    },
    {
      id: 'wanderer', icon: '🧳', name: 'Neuankömmlinge',
      text: 'Ein Boot mit Schiffbrüchigen. Sie bleiben, wenn Platz ist.',
      wirkung: { zuzug: true },
    },
    {
      id: 'fund', icon: '🏺', name: 'Alter Fund',
      text: 'In den Ruinen liegt ein Depot. Münzen, und sie sind noch gut.',
      wirkung: { schatz: true }, bedingung: 'ruinen',
    },
    {
      id: 'ausbruch', icon: '🌋', name: 'Ascheregen',
      text: 'Der Vulkan spuckt. Asche legt sich über die Felder.',
      wirkung: { nahrung: -0.5, tage: 5 }, bedingung: 'vulkan',
    },
    {
      id: 'fest', icon: '🎉', name: 'Inselfest',
      text: 'Drei Tage Musik. Danach arbeitet es sich leichter.',
      wirkung: { laune: 15 },
    },
  ];

  /* ---------------------------------------------------------- Stufen */

  D.STUFEN = [
    { name: 'Strandgut', icon: '🪵', bewohner: 0, inseln: 1 },
    { name: 'Siedlung', icon: '🛖', bewohner: 20, inseln: 1 },
    { name: 'Dorf', icon: '🏠', bewohner: 60, inseln: 2 },
    { name: 'Handelsposten', icon: '⚓', bewohner: 140, inseln: 3 },
    { name: 'Inselgruppe', icon: '🗺', bewohner: 300, inseln: 4 },
    { name: 'Seemacht', icon: '🚢', bewohner: 600, inseln: 5 },
    { name: 'Archipelreich', icon: '👑', bewohner: 1100, inseln: 7 },
  ];

  D.stufeVon = function (bewohner, inseln) {
    var s = 0;
    for (var i = 0; i < D.STUFEN.length; i++) {
      if (bewohner >= D.STUFEN[i].bewohner && inseln >= D.STUFEN[i].inseln) s = i;
    }
    return s;
  };
})(SG);
