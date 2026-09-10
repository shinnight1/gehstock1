/* Fünf Einstiegsreviere und zwanzig weitere Gebiete in einer großen Welt. */
(function (SG) {
  var D = SG.gehstockmon.daten;
  var names = ['Wurzelhafen', 'Dornental', 'Eisenfurt', 'Falkenwacht', 'Mondhain', 'Glutkessel', 'Runenpass', 'Schattensteg', 'Kristallbucht', 'Sturmwarte', 'Knochenkliff', 'Bernsteinwall', 'Nachtquell', 'Himmelsbruch', 'Titanenpfad', 'Sternenruh', 'Kronenfels', 'Aschenzunge', 'Leerenpforte', 'Weltenkrone'];
  var original = D.FELDER.slice();
  names.forEach(function (name, i) {
    var base = original[(i + 1) % 5];
    D.FELDER.push({ id: i + 6, name: name, lehre: base.lehre, feinde: JSON.parse(JSON.stringify(base.feinde)), vorlage: base.id });
  });
})(SG);
