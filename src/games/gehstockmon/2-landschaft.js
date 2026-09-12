/* Textured terrain and non-overlapping political cells, built once per world. */
(function(SG){
  var R=SG.gehstockmon;
  R.groundTexture=function(T,kind){
    var canvas=document.createElement('canvas');canvas.width=canvas.height=256;var ctx=canvas.getContext('2d'),data=ctx.createImageData(256,256);
    var base=[[64,96,48],[59,99,81],[79,65,60],[53,65,78],[178,197,202],[108,141,67],[181,132,75],[75,65,107],[56,32,65]][kind],seed=71237+kind*89;
    function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
    for(var y=0;y<256;y++)for(var x=0;x<256;x++){
      var u=x*Math.PI/128,v=y*Math.PI/128;
      var n=(random()-.5)*18+Math.sin(u*2+Math.cos(v*3))*Math.cos(v*2)*4+Math.sin(u*7+v*5)*2,i=(y*256+x)*4;
      data.data[i]=base[0]+n;data.data[i+1]=base[1]+n;data.data[i+2]=base[2]+n*.65;data.data[i+3]=255;
    }
    ctx.putImageData(data,0,0);
    for(var blade=0;blade<4200;blade++){
      var bx=Math.floor(random()*256),by=Math.floor(random()*256),light=random()>.5;
      ctx.fillStyle=kind===8?(light?'#7b3f6c':'#292335'):kind===7?(light?'#96859d':'#454257'):kind===6?(light?'#dfb97a':'#ab7f52'):kind===5?(light?'rgba(224,220,155,.5)':'rgba(72,103,41,.5)'):kind===4?(light?'#dfedef':'#a3bdc4'):kind===2?(light?'#938075':'#524948'):(light?'rgba(163,179,96,.4)':'rgba(24,49,27,.5)');
      ctx.fillRect(bx,by,1,kind===2||kind===6||kind===8?1:2+Math.floor(random()*4));
    }
    var texture=new T.CanvasTexture(canvas);texture.name='ground-'+kind;texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(1,1);return texture;
  };
  var outlines;
  R.biomeAt=function(x,z){outlines=outlines||R.daten.BIOME.map(function(_,i){return R.abenteuer.biomeOutline(i);});return outlines.findIndex(function(p){return R.abenteuer.polygonContains({x:x,z:z},p);});};
  R.createIsland=function(T,scene,material){
    var coast=R.abenteuer.coast(),positions=[],uv=[],sides=[];
    coast.forEach(function(a,i){var b=coast[(i+1)%coast.length];[{x:0,z:0},b,a].forEach(function(p){positions.push(p.x,0,p.z);uv.push(p.x/8,p.z/8);});sides.push(a.x,-2,a.z,b.x,-2,b.z,b.x,0,b.z,a.x,-2,a.z,b.x,0,b.z,a.x,0,a.z);});
    function geometry(points){var g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points,3));g.computeVertexNormals();return g;}
    var ground=geometry(positions);ground.setAttribute('uv',new T.Float32BufferAttribute(uv,2));var land=new T.Mesh(ground,material);land.name='natural-island';land.receiveShadow=true;scene.add(land);
    var cliffs=new T.Mesh(geometry(sides),new T.MeshStandardMaterial({color:'#80775e',roughness:1,side:T.DoubleSide}));cliffs.name='coastal-cliffs';scene.add(cliffs);
    return function(){scene.remove(land);scene.remove(cliffs);ground.dispose();cliffs.geometry.dispose();cliffs.material.dispose();};
  };
  R.createBiomeGround=function(T,scene,materials){
    var ownedMaterials=[];
    R.orte.map(function(o,i){return R.abenteuer.biomeOutline(i);}).forEach(function(cell,i){var site=R.orte[i],positions=[],uv=[];
      for(var j=0;j<cell.length;j++){var a=cell[j],b=cell[(j+1)%cell.length];[site,b,a].forEach(function(p){positions.push(p.x,.012,p.z);uv.push(p.x/8,p.z/8);});}
      var g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeVertexNormals();
      var bodyMaterial=materials[i].clone();bodyMaterial.polygonOffset=true;bodyMaterial.polygonOffsetFactor=-1;bodyMaterial.polygonOffsetUnits=-2;ownedMaterials.push(bodyMaterial);
      var ground=new T.Mesh(g,bodyMaterial);ground.receiveShadow=true;ground.name='biome-ground-'+i;scene.add(ground);
      // Ein transparenter Saum lässt die unregelmäßigen Biome ins Gras auslaufen.
      var outer=R.abenteuer.biomeOutline(i,1.12),fringe=[],colors=[],fuv=[];
      cell.forEach(function(a,j){var k=(j+1)%cell.length,b=cell[k],c=outer[j],d=outer[k];[[a,1],[b,1],[d,0],[a,1],[d,0],[c,0]].forEach(function(v){fringe.push(v[0].x,.014,v[0].z);fuv.push(v[0].x/8,v[0].z/8);colors.push(1,1,1,v[1]);});});
      var fg=new T.BufferGeometry();fg.setAttribute('position',new T.Float32BufferAttribute(fringe,3));fg.setAttribute('uv',new T.Float32BufferAttribute(fuv,2));fg.setAttribute('color',new T.Float32BufferAttribute(colors,4));fg.computeVertexNormals();var fm=bodyMaterial.clone();fm.vertexColors=true;fm.transparent=true;fm.depthWrite=false;fm.side=T.DoubleSide;ownedMaterials.push(fm);var fade=new T.Mesh(fg,fm);fade.name='biome-fringe-'+i;scene.add(fade);
    });
    return function(){ownedMaterials.forEach(function(m){m.dispose();});};
  };
  R.riverCenter=R.abenteuer.riverCenter;
  R.createWater=function(T,scene){
    var owned=[],waterMat=new T.MeshStandardMaterial({color:'#397e88',roughness:.3,metalness:.12}),bankMat=new T.MeshStandardMaterial({color:'#a69972',roughness:1});
    function ribbon(width,y,material){var positions=[];for(var i=0;i<250;i++){var z=-250+i*2,next=z+2,a=R.riverCenter(z),b=R.riverCenter(next);if(!R.abenteuer.onLand({x:a,z:z})||!R.abenteuer.onLand({x:b,z:next}))continue;positions.push(a-width,y,z,b-width,y,next,b+width,y,next,a-width,y,z,b+width,y,next,a+width,y,z);}
      var g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.computeVertexNormals();var m=new T.Mesh(g,material);m.receiveShadow=true;scene.add(m);owned.push(m);return m;}
    ribbon(6.3,.035,bankMat);var river=ribbon(4.8,.08,waterMat);river.name='meandering-river';
    var sea=new T.Mesh(new T.PlaneGeometry(1900,1900),new T.MeshStandardMaterial({color:'#285d6b',roughness:.35,metalness:.16}));sea.rotation.x=-Math.PI/2;sea.position.y=-1.7;sea.name='ocean';scene.add(sea);owned.push(sea);
    var highlights=new T.BufferGeometry(),points=[];
    for(var j=0;j<200;j++){var z=-220+j*2.2,x=R.riverCenter(z)+Math.sin(j*4)*1.1;points.push(x,.092,z,x+.6,.092,z+.17,x+.7,.092,z+.1,x,.092,z,x-.1,.092,z+.07,x+.6,.092,z+.17);}
    highlights.setAttribute('position',new T.Float32BufferAttribute(points,3));highlights.computeVertexNormals();var foam=new T.Mesh(highlights,new T.MeshBasicMaterial({color:'#b2e3db',transparent:true,opacity:.22,depthWrite:false}));scene.add(foam);owned.push(foam);
    return {update:function(t){var pos=highlights.getAttribute('position');for(var j=0;j<200;j++){var z=-220+((j*2.2+t*2.2)%440),x=R.riverCenter(z)+Math.sin(j*4)*2.8,base=j*6;[[0,0],[.9,.18],[1,.1],[0,0],[-.1,.07],[.9,.18]].forEach(function(v,k){pos.setXYZ(base+k,x+v[0],.092+Math.sin(t*2+j)*.008,z+v[1]);});}pos.needsUpdate=true;foam.material.opacity=.35;},destroy:function(){owned.forEach(function(m){scene.remove(m);m.geometry.dispose();m.material.dispose();});}};
  };
  R.contactShadow=function(T){
    var c=document.createElement('canvas');c.width=c.height=64;var ctx=c.getContext('2d'),g=ctx.createRadialGradient(32,32,2,32,32,31);
    g.addColorStop(0,'rgba(6,18,22,.55)');g.addColorStop(.45,'rgba(6,18,22,.25)');g.addColorStop(1,'rgba(6,18,22,0)');ctx.fillStyle=g;ctx.fillRect(0,0,64,64);return new T.CanvasTexture(c);
  };
  R.influenceCells=R.abenteuer.cells;
  R.createInfluence=function(T,scene){
    var cells=R.influenceCells(),objects=[];
    function geometry(points){var g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points,3));g.computeVertexNormals();return g;}
    cells.forEach(function(cell,index){
      var site=R.orte[index],inset=cell.map(function(p){var dx=site.x-p.x,dz=site.z-p.z,d=Math.hypot(dx,dz);return{x:p.x+dx/d*.28,z:p.z+dz/d*.28};}),fill=[],rim=[];
      for(var i=0;i<inset.length;i++){
        var a=inset[i],b=inset[(i+1)%inset.length];fill.push(site.x,.20,site.z,b.x,.20,b.z,a.x,.20,a.z);
        var dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz),nx=-dz/len*.15,nz=dx/len*.15;
        rim.push(a.x-nx,.24,a.z-nz,b.x-nx,.24,b.z-nz,b.x+nx,.24,b.z+nz,a.x-nx,.24,a.z-nz,b.x+nx,.24,b.z+nz,a.x+nx,.24,a.z+nz);
      }
      var fillMat=new T.MeshBasicMaterial({color:'#d9b569',transparent:true,opacity:.055,depthWrite:false,side:T.DoubleSide}),rimMat=new T.MeshBasicMaterial({color:'#c5a15b',side:T.DoubleSide});
      var face=new T.Mesh(geometry(fill),fillMat),border=new T.Mesh(geometry(rim),rimMat);face.name='influence-'+(index+1);border.name='border-'+(index+1);scene.add(face);scene.add(border);objects.push({face:face,border:border});
    });
    return {set:function(territories,playerId){objects.forEach(function(o,i){var t=territories[i],own=t.ownerId===playerId,color=own?'#50cfaa':t.ownerId?'#e37983':'#c5a15b';o.face.material.color.set(color);o.face.material.opacity=own?.16:t.ownerId?.12:.035;o.border.material.color.set(color);});},destroy:function(){objects.forEach(function(o){[o.face,o.border].forEach(function(m){scene.remove(m);m.geometry.dispose();m.material.dispose();});});}};
  };
})(SG);
