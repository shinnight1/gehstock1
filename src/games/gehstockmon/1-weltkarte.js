/* Eine große Insel mit genau einer Festung je Biom. */
(function (SG) {
  var D = SG.gehstockmon.daten;
  D.MAP_VERSION = 4;
  D.WORLD = {halfWidth:450,halfDepth:420,bridgeZ:[-350,-240,-120,0,120,240,350]};
  D.BIOME = [
    { x:-240,z:240,farbe:'#547d4b',dach:'#a24e34',biom:'Mooswacht',terrain:'Smaragdwald' },
    { x:240,z:240,farbe:'#3e7772',dach:'#497f92',biom:'Flüsterufer',terrain:'Flussland' },
    { x:240,z:0,farbe:'#796452',dach:'#a95037',biom:'Aschenklippen',terrain:'Vulkanland' },
    { x:0,z:-240,farbe:'#586584',dach:'#65518c',biom:'Nebelwald',terrain:'Geisterwald' },
    { x:-240,z:-240,farbe:'#a6bbb9',dach:'#b98841',biom:'Frostkrone',terrain:'Schneegebirge' },
    { x:0,z:240,farbe:'#8aa653',dach:'#cda95c',biom:'Tauwiese',terrain:'Blütenauen',difficulty:'Einsteiger' },
    { x:240,z:-240,farbe:'#ba8d5c',dach:'#9d4940',biom:'Sonnengrab',terrain:'Bernsteinwüste',difficulty:'Sehr schwer' },
    { x:-240,z:0,farbe:'#675780',dach:'#779aba',biom:'Donnergrat',terrain:'Sturmheide',difficulty:'Extrem' },
    { x:0,z:0,farbe:'#452d4e',dach:'#c64e74',biom:'Weltenschlund',terrain:'Leerenbruch',difficulty:'Endspiel' }
  ];
  D.FELDER=D.FELDER.slice(0,5);
  for(var i=5;i<9;i++)D.FELDER.push({id:i+1,feinde:JSON.parse(JSON.stringify(D.FELDER[i===5?0:4].feinde)),lehre:i===5?'Ein sicherer erster Schritt.':'Baue eine starke Truppe auf.'});
  D.FELDER.forEach(function(f,i){f.name=D.BIOME[i].biom;f.biom=D.BIOME[i].terrain;f.difficulty=D.BIOME[i].difficulty||['Leicht','Mittel','Mittel','Schwer','Schwer'][i];});
})(SG);
