import assert from 'node:assert/strict';
import {data as D,economy as E,hours as H} from '../netlify/functions/lib/gehstockmon-rules.mjs';
import {createHandler} from '../netlify/functions/gehstockmon.mjs';
const at=s=>Date.parse(s);let checks=0;
async function test(name,fn){await fn();checks++;console.log('ok',name);}

await test('Every weekday closes production and resumes the remaining time at the next opening',()=>{
  const monday=H.day(at('2026-09-14T07:00:00+02:00'));
  for(let i=0;i<5;i++){
    const day=monday+i,close=H.at(day,H.CLOSE[H.weekday(day)]),start=close-45*60000,next=H.access(close).nextOpenAt;
    const p=D.neuerStand(null,start);let post=E.outpost(null,start);
    E.settle(p,post,close);assert.equal(post.eggStock,0);const cursor=post.eggAt;
    E.settle(p,post,next-1);assert.equal(post.eggStock,0);assert.equal(post.eggAt,cursor);
    post=E.outpost(JSON.parse(JSON.stringify(post)),next);
    assert.equal(E.nextEggAt(post),next+75*60000);
    E.settle(p,post,next+75*60000-1);assert.equal(post.eggStock,0);
    E.settle(p,post,next+75*60000);assert.equal(post.eggStock,1);
    E.settle(p,post,close);assert.equal(post.eggStock,1,'backwards clocks cannot award again');
  }
});
await test('Production clock and completion times round-trip at boundaries and across both DST weekends',()=>{
  for(const date of ['2026-09-14','2026-10-19','2027-03-22']){
    const monday=H.day(at(date+'T08:00:00Z'));
    for(let day=monday;day<monday+8;day++)for(const hour of [0,7,8,12,13,14,15,23]){
      const time=H.at(day,hour)+123,production=H.productionTime(time),inverse=H.productionAt(production);
      assert.equal(H.productionTime(inverse),production);assert.ok(inverse<=time,'completion must not be in the future');
    }
    const friday=H.at(monday+4,12),p=D.neuerStand(null,friday),post=E.outpost(null,friday);
    assert.equal(E.nextEggAt(post),H.at(monday+7,8));E.settle(p,post,H.at(monday+7,7));assert.equal(post.eggStock,0);
    E.weekend(p,post,1,H.at(monday+7,7));assert.equal(p.weekendEggs[1],2);
  }
});
await test('Existing stocked eggs stay available; closed-time captures cannot produce early; incubation remains one real hour',()=>{
  const night=at('2026-09-14T22:00:00+02:00'),open=at('2026-09-15T07:00:00+02:00');
  const p=D.neuerStand(null,night),post=E.outpost({capturedAt:night,eggAt:night,eggStock:2},night);
  E.settle(p,post,open);assert.equal(post.eggStock,2);assert.equal(E.nextEggAt(post),open+2*E.HOUR);
  E.collect(p,post,1,open);assert.equal(p.eggs.length,2);assert.equal(post.eggStock,0);
  E.incubate(p,p.eggs[0].id,at('2026-09-15T12:30:00+02:00'));
  assert.equal(p.eggs[0].readyAt,at('2026-09-15T13:30:00+02:00'));
});
await test('Server reconnect after a closed night keeps partial production and collection pays once',async()=>{
  let time=at('2026-09-14T12:15:00+02:00'),value=null,version=0,serial=0;
  const store={async getWithMetadata(){return value?{data:structuredClone(value),etag:String(version)}:null;},async setJSON(k,next,o){if(o.onlyIfNew&&value||o.onlyIfMatch!==undefined&&o.onlyIfMatch!==String(version))return{modified:false};value=structuredClone(next);version++;return{modified:true};}};
  const handler=createHandler({store,now:()=>time});
  async function call(op,extra={}){const res=await handler(new Request('http://localhost/api/gehstockmon',{method:'POST',body:JSON.stringify({code:'0141',op,requestId:'egg-hours-'+(++serial),...extra})}));return{status:res.status,...await res.json()};}
  let r=await call('join');Object.assign(value.territories[0],{ownerId:r.playerId,...E.outpost(null,time)});
  time=at('2026-09-14T12:59:59+02:00');assert.equal((await call('world')).territories[0].eggStock,0);
  time=at('2026-09-14T20:00:00+02:00');const saved=JSON.stringify(value);assert.equal((await call('world')).status,423);assert.equal(JSON.stringify(value),saved);
  time=at('2026-09-15T07:00:00+02:00');r=await call('join');assert.equal(r.territories[0].eggStock,0);assert.equal(E.nextEggAt(r.territories[0]),time+75*60000);
  time+=75*60000;r=await call('collect',{territoryId:1,requestId:'egg-hours-collect'});assert.equal(r.status,200);assert.equal(r.profile.eggs.length,1);
  r=await call('collect',{territoryId:1,requestId:'egg-hours-collect'});assert.equal(r.profile.eggs.length,1);assert.equal(r.duplicate,true);
});
console.log('\n'+checks+' egg opening-hours checks passed.');
