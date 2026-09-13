/* Decorative archipelago: never part of the playable land or collision map. */
(function(SG){
  var R=SG.gehstockmon;
  R.createSeascape=function(T,scene){
    var owned=[],batches=[[],[],[]],coast=R.abenteuer.coast();
    function mesh(points,material,name){
      var g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points,3));g.computeVertexNormals();
      var m=new T.Mesh(g,material);m.name=name;scene.add(m);owned.push(m);return m;
    }
    function band(inner,outer,y,points){
      inner.forEach(function(a,i){var j=(i+1)%inner.length,b=inner[j],c=outer[i],d=outer[j];[a,b,d,a,d,c].forEach(function(p){points.push(p.x,y,p.z);});});
    }
    function expanded(outline,amount){return outline.map(function(p){var length=Math.hypot(p.x,p.z);return{x:p.x+p.x/length*amount,z:p.z+p.z/length*amount};});}
    var shallows=[];band(coast,expanded(coast,19),-1.62,shallows);
    mesh(shallows,new T.MeshBasicMaterial({color:'#4a9a99',transparent:true,opacity:.36,side:T.DoubleSide,depthWrite:false}),'coastal-shallows');
    // Broken, asymmetric rock groups give the island a place in a larger archipelago.
    [[-342,-150,39,25],[-382,-98,22,15],[-314,125,27,20],[-367,178,51,32],[-135,322,43,25],[62,341,25,17],[313,199,32,23],[365,245,56,33],[353,-85,44,27],[311,-270,35,21],[35,-329,48,29],[-187,-322,31,19]].forEach(function(site,index){
      var ring=[],top=[],n=11;
      for(var i=0;i<n;i++){var a=i/n*Math.PI*2,r=1+Math.sin(i*4.7+index)*.19;ring.push({x:site[0]+Math.cos(a)*site[2]*r,z:site[1]+Math.sin(a)*site[3]*r});top.push({x:site[0]+Math.cos(a)*site[2]*r*.72,z:site[1]+Math.sin(a)*site[3]*r*.72});}
      ring.forEach(function(a,i){var j=(i+1)%n,b=ring[j],c=top[i],d=top[j],h=5+index%4*2;
        batches[0].push(a.x,-1.65,a.z,c.x,h,c.z,d.x,h,d.z,a.x,-1.65,a.z,d.x,h,d.z,b.x,-1.65,b.z);
        batches[1].push(site[0],h+.5,site[1],d.x,h,d.z,c.x,h,c.z);
      });
      for(var k=0;k<3;k++){var g=new T.ConeGeometry(5+k*2,13+k*5,5).toNonIndexed();g.translate(site[0]+(k-1)*site[2]*.3,11+k*3,site[1]+Math.sin(index+k)*5);batches[2].push.apply(batches[2],Array.from(g.attributes.position.array));g.dispose();}
    });
    ['#687778','#70835a','#536364'].forEach(function(color,i){mesh(batches[i],new T.MeshStandardMaterial({color:color,roughness:1,flatShading:true,side:T.DoubleSide}),'offshore-rocks-'+i);});
    var surf=[];band(expanded(coast,3),expanded(coast,4.3),-1.48,surf);
    var shore=mesh(surf,new T.MeshBasicMaterial({color:'#c0e4d9',transparent:true,opacity:.38,side:T.DoubleSide,depthWrite:false}),'shore-breakers');
    var waves=[];
    for(var z=-750;z<=750;z+=32)for(var x=-750;x<=750;x+=43){
      var px=x+Math.sin(z*2+x)*16,pz=z+Math.cos(x*3)*10;
      if(R.abenteuer.onLand({x:px,z:pz})||Math.abs(px)<290&&Math.abs(pz)<260)continue;
      var w=4+(1+Math.sin(x+z))*4;
      waves.push(px,-1.5,pz,px+w,-1.5,pz+1.2,px+w+2,-1.5,pz+1.5,px,-1.5,pz,px+w+2,-1.5,pz+1.5,px-1,-1.5,pz+.4);
    }
    var swell=mesh(waves,new T.MeshBasicMaterial({color:'#9bc9c7',transparent:true,opacity:.17,side:T.DoubleSide,depthWrite:false}),'ocean-swells');
    return {update:function(t){swell.position.x=Math.sin(t*.18)*2;swell.position.z=Math.sin(t*.13)*3;swell.material.opacity=.14+Math.sin(t*.6)*.035;shore.material.opacity=.3+Math.sin(t*1.1)*.12;},destroy:function(){owned.forEach(function(m){scene.remove(m);m.geometry.dispose();m.material.dispose();});}};
  };
})(SG);
