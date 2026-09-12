/* Freigestellte Atlas-Grafiken: dieselbe Silhouette in Welt und Ausrüstung. */
(function(SG){var R=SG.gehstockmon,loaded={};
  var monRows=[0,246,439,650,857,1044,1254],monCols=[[0,190,363,540,715,880,1055,1254],[0,188,372,547,716,870,1069,1254],[0,182,369,538,715,875,1074,1254],[0,189,383,546,708,880,1075,1254],[0,190,377,550,709,874,1064,1254],[0,174,330,502,689,834,1015,1254]];
  var skinRows=[0,414,817,1254],skinCols=[[0,311,620,921,1254],[0,308,620,921,1254],[0,370,681,925,1254]];
  R.drawAtlas=function(canvas,kind,index,done){var key='gm-'+kind+'-atlas',entry=loaded[key];
    function draw(img){var cols=kind==='mons'?7:4,row=Math.floor(index/cols),col=index%cols,xs=(kind==='mons'?monCols:skinCols)[row],ys=kind==='mons'?monRows:skinRows;
      var x=xs[col]/1254*img.naturalWidth,y=ys[row]/1254*img.naturalHeight,w=(xs[col+1]-xs[col])/1254*img.naturalWidth,h=(ys[row+1]-ys[row])/1254*img.naturalHeight;
      var ctx=canvas.getContext('2d'),scale=Math.min(canvas.width/w,canvas.height/h)*.94;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingEnabled=kind!=='skins';ctx.drawImage(img,x,y,w,h,(canvas.width-w*scale)/2,canvas.height-h*scale,w*scale,h*scale);if(done)done();
    }
    if(entry){if(entry.ready)draw(entry.image);else entry.wait.push(draw);return;}
    var img=new Image();entry=loaded[key]={image:img,ready:false,wait:[draw]};img.onload=function(){entry.ready=true;entry.wait.splice(0).forEach(function(fn){fn(img);});};img.src=SG.assets[key];
  };
  R.skinIndex=function(id){var at=R.abenteuer.SKINS.findIndex(function(s){return s.id===id;});return Math.max(0,at);};
})(SG);
