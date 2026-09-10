/* Textured terrain and non-overlapping political cells, built once per world. */
(function(SG){
  var R=SG.gehstockmon;
  R.groundTexture=function(T,kind){
    var canvas=document.createElement('canvas');canvas.width=canvas.height=256;var ctx=canvas.getContext('2d'),data=ctx.createImageData(256,256);
    var base=[[61,88,43],[54,85,66],[113,98,75],[63,71,72],[158,171,169]][kind],seed=71237+kind*89;
    function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
    for(var y=0;y<256;y++)for(var x=0;x<256;x++){
      var n=(random()-.5)*27+Math.sin(x/17)*Math.cos(y/21)*8+Math.sin((x+y)/7)*3,i=(y*256+x)*4;
      data.data[i]=base[0]+n;data.data[i+1]=base[1]+n;data.data[i+2]=base[2]+n*.65;data.data[i+3]=255;
    }
    ctx.putImageData(data,0,0);
    for(var blade=0;blade<4200;blade++){
      var bx=Math.floor(random()*256),by=Math.floor(random()*256),light=random()>.5;
      ctx.fillStyle=kind===4?(light?'#d7ddd1':'#9ca9a4'):kind===2?(light?'#b7a789':'#71694f'):(light?'rgba(163,179,96,.4)':'rgba(24,49,27,.5)');
      ctx.fillRect(bx,by,1,kind===2?1:2+Math.floor(random()*4));
    }
    var texture=new T.CanvasTexture(canvas);texture.name='ground-'+kind;texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(1,1);return texture;
  };
  R.influenceCells=function(){
    return R.orte.map(function(site,index){
      var polygon=[];for(var i=0;i<96;i++){var a=i*Math.PI*2/96;polygon.push({x:Math.cos(a)*123,z:Math.sin(a)*115});}
      R.orte.forEach(function(other,j){if(j===index)return;var nx=other.x-site.x,nz=other.z-site.z,c=(other.x*other.x+other.z*other.z-site.x*site.x-site.z*site.z)/2,out=[];
        for(var p=0;p<polygon.length;p++){var a=polygon[p],b=polygon[(p+1)%polygon.length],da=a.x*nx+a.z*nz-c,db=b.x*nx+b.z*nz-c;if(da<=0)out.push(a);if((da<=0)!==(db<=0)){var t=da/(da-db);out.push({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});}}polygon=out;
      });return polygon;
    });
  };
  R.createInfluence=function(T,scene){
    var cells=R.influenceCells(),objects=[];
    function geometry(points){var g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points,3));g.computeVertexNormals();return g;}
    cells.forEach(function(cell,index){
      var site=R.orte[index],inset=cell.map(function(p){var dx=site.x-p.x,dz=site.z-p.z,d=Math.hypot(dx,dz);return{x:p.x+dx/d*.28,z:p.z+dz/d*.28};}),fill=[],rim=[];
      for(var i=0;i<inset.length;i++){
        var a=inset[i],b=inset[(i+1)%inset.length];fill.push(site.x,.025,site.z,b.x,.025,b.z,a.x,.025,a.z);
        var dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz),nx=-dz/len*.15,nz=dx/len*.15;
        rim.push(a.x-nx,.24,a.z-nz,b.x-nx,.24,b.z-nz,b.x+nx,.24,b.z+nz,a.x-nx,.24,a.z-nz,b.x+nx,.24,b.z+nz,a.x+nx,.24,a.z+nz);
      }
      var fillMat=new T.MeshBasicMaterial({color:'#d9b569',transparent:true,opacity:.055,depthWrite:false,side:T.DoubleSide}),rimMat=new T.MeshBasicMaterial({color:'#c5a15b',side:T.DoubleSide});
      var face=new T.Mesh(geometry(fill),fillMat),border=new T.Mesh(geometry(rim),rimMat);face.name='influence-'+(index+1);border.name='border-'+(index+1);scene.add(face);scene.add(border);objects.push({face:face,border:border});
    });
    return {set:function(territories,playerId){objects.forEach(function(o,i){var t=territories[i],own=t.ownerId===playerId,color=own?'#50cfaa':t.ownerId?'#e37983':'#c5a15b';o.face.material.color.set(color);o.face.material.opacity=own?.16:t.ownerId?.12:.035;o.border.material.color.set(color);});},destroy:function(){objects.forEach(function(o){[o.face,o.border].forEach(function(m){scene.remove(m);m.geometry.dispose();m.material.dispose();});});}};
  };
})(SG);
