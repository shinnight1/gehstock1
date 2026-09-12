/* Große Reviermauern, gemeinsame Grenzen und animierte Falltore. */
(function(SG){var R=SG.gehstockmon,X=R.abenteuer;
  R.createWalls=function(T,scene){var group=new T.Group(),key='',layout=[],gates=[],materials=[],geometry=new T.BoxGeometry(1,1,1);group.name='territory-walls';scene.add(group);
    function clear(){group.traverse(function(m){if(m.geometry)m.geometry.dispose();});group.clear();materials.forEach(function(m){m.dispose();});materials=[];gates=[];}
    function set(ts,id){var next=id+':'+ts.map(function(t){return t.ownerId+':'+t.level;}).join('|');if(next===key)return;key=next;clear();layout=X.layout(ts);
      layout.forEach(function(g){var own=g.ownerId===id,stone=new T.MeshStandardMaterial({color:own?'#648b7c':g.ownerId?'#916867':'#86857b',roughness:.94}),trim=new T.MeshStandardMaterial({color:own?'#b5dac2':'#c2b79d',roughness:.8}),parts=[[],[]];materials.push(stone,trim);
        var h=5.2+Math.max.apply(null,g.fields.map(function(f){return ts[f-1].level;}))*.4;
        function box(x,y,z,sx,sy,sz,angle,type){var m=new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),angle||0),new T.Vector3(sx,sy,sz));var geo=geometry.clone().applyMatrix4(m);parts[type||0].push(geo);}
        function wall(a,b){var dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz),angle=-Math.atan2(dz,dx);if(len<.01)return;box((a.x+b.x)/2,h/2,(a.z+b.z)/2,len,h,1.1,angle);box((a.x+b.x)/2,h,(a.z+b.z)/2,len,.3,1.5,angle,1);var n=Math.max(1,Math.ceil(len/2.8));for(var i=0;i<n;i++){var t=(i+.5)/n;box(a.x+dx*t,h+.5,a.z+dz*t,1.25,.9,1.4,angle,1);}}
        g.edges.forEach(function(e){if(e===g.gate.edge){var q=g.gate;wall(e.a,{x:q.x-q.dx*3,z:q.z-q.dz*3});wall({x:q.x+q.dx*3,z:q.z+q.dz*3},e.b);}else wall(e.a,e.b);});
        var q=g.gate,angle=-Math.atan2(q.dz,q.dx);[-1,1].forEach(function(s){box(q.x+q.dx*3.7*s,h*.58,q.z+q.dz*3.7*s,2,h*1.16,2,angle);box(q.x+q.dx*3.7*s,h*1.2,q.z+q.dz*3.7*s,2.5,.6,2.5,angle,1);});box(q.x,h+.1,q.z,7.8,.65,1.5,angle,1);
        parts.forEach(function(list,i){if(!list.length)return;var combined=T.mergeGeometries(list,false),mesh=new T.Mesh(combined,i?trim:stone);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);list.forEach(function(g){g.dispose();});});
        var doorMat=new T.MeshStandardMaterial({color:own?'#67cba7':'#65443d',metalness:.3,roughness:.7});materials.push(doorMat);var door=new T.Mesh(geometry.clone(),doorMat);door.name='territory-gate-'+g.id;door.scale.set(5.9,h,.55);door.position.set(q.x,h/2,q.z);door.rotation.y=angle;door.castShadow=true;group.add(door);gates.push({door:door,gate:q,own:own,h:h,open:0});
      });
    }
    return{set:set,get layout(){return layout;},entrance:function(id){var g=layout.find(function(g){return g.fields.indexOf(id)>=0;});return g?{x:g.gate.x+g.gate.nx*4,z:g.gate.z+g.gate.nz*4}:R.orte[id-1];},update:function(dt,position){gates.forEach(function(g){var near=Math.hypot(position.x-g.gate.x,position.z-g.gate.z)<12;g.open+=((g.own&&near?1:0)-g.open)*Math.min(1,dt*5);g.door.position.y=g.h/2+g.open*(g.h+.4);});},destroy:function(){clear();geometry.dispose();scene.remove(group);}};
  };
})(SG);
