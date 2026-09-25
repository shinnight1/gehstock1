import {data as D,economy as E,arena as A,adventure as X} from './gehstockmon-rules.mjs';
import {activeDungeon} from './gehstockmon-dungeons.mjs';
import {stadtSettle} from './gehstockmon-stadt.mjs';
import {anwesende} from './gehstockmon-anwesenheit.mjs';
const fail=(message)=>{throw new Error(message);};
export const activeArena=p=>p.arena&&p.arena.phase!=='finished';
export const activeDuel=p=>p.duel&&['choose','won'].includes(p.duel.phase);
export function expireAdventure(world,now){
  for(const p of Object.values(world.players)) {
    if(p.raidLock&&p.raidLock.until<=now)delete p.raidLock;
    if(activeDuel(p)&&p.duel.until<=now){p.duel.phase='finished';p.duel.winner='expired';p.duel.message='Der Überfall ist abgelaufen.';}
    if(activeArena(p)&&p.arena.kind==='raid'&&p.duel?.until<=now){p.arena=A.flee(p.arena);p.arena.winner='expired';p.arena.settled=true;p.arena.message='Der Überfall ist nach zehn Minuten abgelaufen. Kein Ei wurde gestohlen.';p.duel=null;}
  }
}
function log(world,p,id,defender,text,now){world.reports.push({id:'adventure-'+id+'-'+now,time:now,attackerId:id,defenderId:defender,territoryId:6,text:p.name+' '+text});world.reports=world.reports.slice(-150);}
function egg(p,territoryId,now){p.eggs.push({id:'reward-'+territoryId+'-'+now+'-'+(++p.eggSerial),territoryId,producedAt:now,startedAt:null,readyAt:null});}
export function finishEncounter(world,p,id,now){
  const b=p.arena;if(!b?.kind||b.phase!=='finished'||b.settled)return false;
  b.settled=true;
  if(b.kind==='rang'||b.kind==='champion')return stadtSettle(world,p,id,now);
  if(b.kind==='trainer'){
    if(b.winner==='wir'&&!p.encounterClaims.includes(b.encounterId)){
      p.encounterClaims=p.encounterClaims.concat(b.encounterId).slice(-100);p.progress.trainerWins++;p.gold+=25;wochenschritt(world,p,id,'trainer',now);fehdeSchritt(world,id,'trainer',now);
      if(p.eggs.length<E.BAG_LIMIT){egg(p,b.territoryId,now);b.message='Training gewonnen! Ein Ei und 25 Gold gehören dir.';}
      else {p.rewardEggs=p.rewardEggs||{};p.rewardEggs[b.territoryId]=(p.rewardEggs[b.territoryId]||0)+1;b.message='Training gewonnen! 25 Gold; dein Ei wartet auf Platz in der Tasche.';}
    }else b.message='Das Training ist beendet. Du verlierst weder Gold noch Eier. Probiere andere Attacken.';
    return true;
  }
  if(b.kind==='raid'){
    const target=world.players[b.targetId],lock=target?.raidLock;
    if(b.winner==='wir'&&lock?.attackerId===id&&lock.until>now&&lock.battleId===b.id){
      const stolen=target.eggs.find(e=>e.id===lock.eggId);
      /* Gekaufte Brutplaetze zaehlen auch hier. Vorher rechnete der Ueberfall
         gegen die drei festen, und wer sich welche dazugekauft hatte, konnte
         trotzdem kein bruetendes Ei mitnehmen. */
      if(stolen&&p.eggs.length<E.BAG_LIMIT&&(stolen.startedAt===null||p.eggs.filter(e=>e.startedAt!==null).length<X.brutplaetze(world.leuchtturm,p))){
        target.eggs=target.eggs.filter(e=>e.id!==stolen.id);p.eggs.push({...stolen,id:'stolen-'+now+'-'+(++p.eggSerial)});target.raidShield=now+2*E.HOUR;
        b.message='Überfall gewonnen! Ein Ei aus '+target.name+'s Tasche gehört dir. Seine Brutzeit bleibt erhalten.';log(world,p,id,b.targetId,'erbeutet ein Ei von '+target.name+'.',now);
        /* Wer den Fuehrenden stellt, kassiert das Kopfgeld. */
        const zaehler={};for(const t2 of world.territories||[])if(t2.ownerId)zaehler[t2.ownerId]=(zaehler[t2.ownerId]||0)+1;
        const kopf=X.kopfgeld(zaehler);
        if(kopf&&kopf.id===b.targetId){p.gold+=kopf.gold;b.message+=' Und '+kopf.gold+' Gold Kopfgeld - er hielt die meisten Gebiete.';
          log(world,p,id,b.targetId,'kassiert das Kopfgeld auf '+target.name+'.',now);}
      }else b.message='Gewonnen, aber das Ei kann nicht übertragen werden. Kein Ei geht verloren.';
    }else b.message=b.winner==='wir'?'Der Überfall ist abgelaufen. Kein Ei wird übertragen.':'Die Verteidigung hält. Es wurde kein Ei gestohlen.';
    if(lock?.attackerId===id)delete target.raidLock;p.duel=null;return true;
  }
  return false;
}
/* Der Leuchtturm wird einmal gebaut und bleibt dann stehen. */
export function leuchtturm(world){
  if(!world.leuchtturm)world.leuchtturm={gold:0,spender:{},fertigAm:null};
  return world.leuchtturm;
}
/* Wie viele diese Woche wirklich spielen: wer in den letzten sieben Tagen da
   war. Frueher zaehlte jedes Konto, das je beigetreten ist - eine Klasse mit
   acht Aktiven und zwanzig alten Konten bekam einen Zerhacker fuer zwanzig. */
export function aktiveSpieler(world,now){
  const n=Object.values(world.players||{}).filter(p=>now-(p.lastSeen||0)<7*86400000).length;
  return Math.max(1,n);
}
/* Der Zerhacker wird jede Woche neu gesetzt. Seine Lebenskraft waechst mit der
   Zahl der Leute in der Welt, damit er weder in einer Stunde faellt noch
   ewig steht. */
export function zerhacker(world,now){
  const woche=X.zerhackerWoche(now);
  if(!world.zerhacker||world.zerhacker.woche!==woche){
    /* Wer die Woche ueber am haertesten zugeschlagen hat, traegt in der
       naechsten den Erstschlag. */
    const alt=world.zerhacker&&world.zerhacker.beitraege;
    if(alt){
      let bester=null;
      for(const [pid,wert] of Object.entries(alt))if(!bester||wert>bester.wert)bester={pid,wert};
      world.erstschlag=bester?{woche,id:bester.pid,name:world.players[bester.pid]?.name||'Unbekannt',wert:bester.wert}:null;
    }
    const kraft=X.zerhackerKraft(aktiveSpieler(world,now));
    world.zerhacker={woche,hp:kraft,maxHp:kraft,beitraege:{},besiegtAm:null,verteilt:false};
  }
  /* Wird seine Lebenskraft neu festgelegt, gilt das sofort und nicht erst am
     Montag. Was diese Woche schon an Schaden liegt, bleibt angerechnet - der
     Rest schrumpft auf das neue Mass. */
  const kraft=X.zerhackerKraft(aktiveSpieler(world,now));
  if(world.zerhacker.maxHp!==kraft&&!world.zerhacker.besiegtAm){
    const geschlagen=world.zerhacker.maxHp-world.zerhacker.hp;
    world.zerhacker.maxHp=kraft;world.zerhacker.hp=Math.max(0,kraft-geschlagen);
  }
  return world.zerhacker;
}

/* Die Fehde laeuft wochenweise. Eine offene Herausforderung verfaellt mit der
   Woche, in der sie ausgesprochen wurde. */
export function fehden(world,now){
  const woche=X.zerhackerWoche(now);
  if(!world.fehden||world.fehden.woche!==woche){
    fehdenAbrechnen(world,world.fehden,now);
    world.fehden={woche,offen:{},paare:[]};
  }
  return world.fehden;
}
/* Beim Wochenwechsel wird abgerechnet. Vorher passierte hier gar nichts: die
   Punktestaende standen die Woche ueber in der Oberflaeche und waren montags
   samt Woche verschwunden, ohne dass jemand etwas davon hatte. Der Sieger
   bekommt Gold, der Unterlegene seinen Trost - verlieren kann man in einer
   Fehde weiterhin nichts ausser der Woche. */
export function fehdenAbrechnen(world,alt,now){
  if(!alt||!Array.isArray(alt.paare))return;
  for(const paar of alt.paare){
    const a=world.players[paar.a],b=world.players[paar.b];
    const pa=X.fehdePunkte(paar.zaehlerA),pb=X.fehdePunkte(paar.zaehlerB);
    if(!a||!b||(!pa&&!pb))continue;
    const gleich=pa===pb,siegerId=gleich?null:(pa>pb?paar.a:paar.b);
    for(const [pid,wer,eigen,fremd] of [[paar.a,a,pa,pb],[paar.b,b,pb,pa]]){
      const gewonnen=siegerId===pid;
      wer.gold+=gleich?X.FEHDE_LOHN:gewonnen?X.FEHDE_LOHN:X.FEHDE_TROST;
      const gegner=(pid===paar.a?b:a).name;
      world.reports.push({id:'fehde-'+pid+'-'+alt.woche,time:now,attackerId:pid,defenderId:null,territoryId:1,
        text:'Fehde gegen '+gegner+' beendet: '+eigen+' zu '+fremd+' Punkten · '
          +(gleich?'unentschieden, beide bekommen '+X.FEHDE_LOHN+' Gold.'
            :gewonnen?'gewonnen! +'+X.FEHDE_LOHN+' Gold.'
            :'verloren. '+X.FEHDE_TROST+' Gold Trost.')});
    }
  }
  world.reports=world.reports.slice(-150);
}
export function fehdeVon(world,id,now){
  const f=fehden(world,now);
  return f.paare.find(v=>v.a===id||v.b===id)||null;
}
/* Zaehlt einen Fehdepunkt fuer beide Seiten getrennt. */
export function fehdeSchritt(world,id,art,now,anzahl=1){
  const paar=fehdeVon(world,id,now);if(!paar)return;
  const seite=paar.a===id?'zaehlerA':'zaehlerB';
  paar[seite][art]=(paar[seite][art]||0)+anzahl;
}
/* Die Wochenaufgabe wird wie der Zerhacker jede Woche neu gesetzt. */
export function wochenaufgabe(world,now){
  const woche=X.zerhackerWoche(now);
  if(!world.wochenaufgabe||world.wochenaufgabe.woche!==woche)
    world.wochenaufgabe={woche,stand:0,beitraege:{},erfuelltAm:null};
  return world.wochenaufgabe;
}
/* Zaehlt einen Beitrag, wenn er zur laufenden Aufgabe passt, und schuettet
   beim Erreichen an alle aus, die mitgeholfen haben. */
export function wochenschritt(world,p,id,art,now,anzahl=1){
  const ziel=X.wochenziel(now);
  if(!ziel||ziel.id!==art)return null;
  const a=wochenaufgabe(world,now);
  if(a.erfuelltAm)return null;
  a.stand+=anzahl;a.beitraege[id]=(a.beitraege[id]||0)+anzahl;
  if(a.stand<ziel.ziel)return null;
  a.erfuelltAm=now;
  for(const [pid,anteil] of Object.entries(a.beitraege)){
    const wer=world.players[pid];if(!wer)continue;
    wer.gold+=ziel.lohn+Math.round(ziel.lohn*anteil/Math.max(1,a.stand));
  }
  return 'Die Wochenaufgabe "'+ziel.name+'" ist geschafft! Alle Beteiligten haben ihren Lohn erhalten.';
}

/* Was der Client von beidem sehen darf. Die Spenderliste wird auf die groessten
   zehn gekuerzt - mehr passt ohnehin nicht auf die Tafel. */
/* Nur lesen. Die Zerhacker-Uhr wurde frueher hier gestellt - und weil
   publicResult erst nach dem Schreiben laeuft, ist sie nie im Spielstand
   gelandet: der Beutel blieb auf null und niemand konnte je zuschlagen. Sie
   wird jetzt im Handler gestellt, vor dem Schreiben. */
export function weltprojekte(world,id,now){
  const bau=leuchtturm(world),z=zerhacker(world,now),a=wochenaufgabe(world,now),ziel=X.wochenziel(now),namen=(eintraege)=>
    Object.entries(eintraege).sort((a,b)=>b[1]-a[1]).slice(0,10)
      .map(([pid,wert])=>({name:world.players[pid]?.name||'Unbekannt',wert,selbst:pid===id}));
  return {leuchtturm:{gold:bau.gold,ziel:X.LEUCHTTURM.ziel,fertig:X.leuchtturmFertig(bau),
                      fertigAm:bau.fertigAm,eigen:bau.spender[id]||0,tafel:namen(bau.spender)},
          zerhacker:{hp:z.hp,maxHp:z.maxHp,besiegtAm:z.besiegtAm,eigen:z.beitraege[id]||0,
                     tafel:namen(z.beitraege),vorrat:X.zerhackerVorrat(world.players[id],now),vorratMax:X.ZERHACKER.vorratMax,naechsterIn:X.zerhackerWartezeit(world.players[id],now)},
          wochenaufgabe:{name:ziel.name,was:ziel.was,stand:Math.min(a.stand,ziel.ziel),ziel:ziel.ziel,
                         erfuellt:!!a.erfuelltAm,eigen:a.beitraege[id]||0,tafel:namen(a.beitraege)},
          erstschlag:world.erstschlag?{name:world.erstschlag.name,selbst:world.erstschlag.id===id,wert:world.erstschlag.wert}:null,
          kopfgeld:(()=>{const zaehler={};for(const t of world.territories||[])if(t.ownerId)zaehler[t.ownerId]=(zaehler[t.ownerId]||0)+1;
            const k=X.kopfgeld(zaehler);return k?{name:world.players[k.id]?.name||'Unbekannt',selbst:k.id===id,gebiete:k.anzahl,gold:k.gold}:null;})(),
          fehde:(()=>{const f=fehden(world,now),paar=fehdeVon(world,id,now);
            if(paar){const ich=paar.a===id?'A':'B',du=ich==='A'?'B':'A';
              return {gegner:world.players[paar[du.toLowerCase()]]?.name||'Unbekannt',
                      meine:X.fehdePunkte(paar['zaehler'+ich]),seine:X.fehdePunkte(paar['zaehler'+du])};}
            const offen=Object.entries(f.offen).filter(([von,an])=>an===id||von===id);
            return {offeneAn:offen.filter(([von])=>von!==id).map(([von])=>({id:von,name:world.players[von]?.name||'Unbekannt'})),
                    eigeneAn:offen.filter(([von])=>von===id).map(([,an])=>world.players[an]?.name||'Unbekannt')};})()};
}

export function deliverRewards(p,now){if(activeArena(p)||activeDuel(p))return;for(const [id,n]of Object.entries(p.rewardEggs||{})){const count=Math.min(n,E.BAG_LIMIT-p.eggs.length);for(let i=0;i<count;i++)egg(p,Number(id),now);p.rewardEggs[id]-=count;if(!p.rewardEggs[id])delete p.rewardEggs[id];}}
export async function adventureAction({world,p,id,body,now,draw,presence,validateSquad}){
  const op=body.op,extra={};
  if(!X.OPS.includes(op))return extra;
  if(activeArena(p))fail('Beende zuerst deinen Mon-Kampf.');
  if(activeDuel(p)&&!['raid_turn','raid_arena','raid_cancel'].includes(op))fail('Beende zuerst deinen Überfall.');
  async function position(pid){const v=(await anwesende(presence))[pid];if(!v||now-v.updatedAt>=15000||v.spawnAt!==world.players[pid].lastJoinAt)fail('Die Kartenposition ist nicht aktuell. Warte kurz auf die Verbindung.');return v;}
  async function nearby(point,distance=8){const at=await position(id);if(Math.hypot(at.x-point.x,at.z-point.z)>distance)fail('Laufe zuerst näher heran.');return at;}
  if(op==='survey'){const at=await position(id);let best=0;D.BIOME.forEach((b,i)=>{if(Math.hypot(b.x-at.x,b.z-at.z)<Math.hypot(D.BIOME[best].x-at.x,D.BIOME[best].z-at.z))best=i;});if(!p.visited.includes(best+1))p.visited.push(best+1);extra.message=D.BIOME[best].terrain+' erkundet.';}
  if(op==='gather'||op==='trainer_start'){
    const encounter=X.encounters(now,world.territories).find(e=>e.id===body.encounterId);if(!encounter||encounter.kind!==(op==='gather'?'rune':'trainer'))fail('Diese Begegnung ist weitergezogen. Aktualisiere die Karte.');
    if(p.encounterClaims.includes(encounter.id))fail('Diese Begegnung hast du bereits abgeschlossen.');await nearby(encounter);
    if(op==='gather'){p.encounterClaims=p.encounterClaims.concat(encounter.id).slice(-100);p.progress.gathered++;p.gold+=10;fehdeSchritt(world,id,'rune',now);extra.message=wochenschritt(world,p,id,'runen',now)||'Rune gefunden! +10 Gold und Fortschritt für deine Quest.';}
    else {p.truppe=validateSquad(p,body.squad);p.arena=A.create(p.truppe.map(mid=>X.mon(p,mid)),['blattschleicher','tauhupfer'].slice(0,p.progress.trainerWins<3?1:2).map(D.mon),{id:body.requestId,territoryId:encounter.territoryId,now});Object.assign(p.arena,{kind:'trainer',encounterId:encounter.id,title:encounter.name});}
  }
  if(op==='leuchtturm_spenden'){
    const bau=leuchtturm(world),betrag=Math.floor(Number(body.betrag));
    if(X.leuchtturmFertig(bau))fail('Der Leuchtturm steht bereits.');
    if(!Number.isFinite(betrag)||betrag<X.LEUCHTTURM.mindestens)fail('Mindestens '+X.LEUCHTTURM.mindestens+' Gold.');
    if(betrag>p.gold)fail('So viel Gold hast du nicht.');
    const rest=X.LEUCHTTURM.ziel-bau.gold,gibt=Math.min(betrag,rest);
    p.gold-=gibt;bau.gold+=gibt;bau.spender[id]=(bau.spender[id]||0)+gibt;
    if(X.leuchtturmFertig(bau)&&!bau.fertigAm){
      bau.fertigAm=now;
      log(world,p,id,null,'vollendet den Leuchtturm. Er wacht jetzt ueber die ganze Insel.',now);
      extra.message='Der Leuchtturm steht! Von nun an siehst du, wo der Zerhacker umherzieht.';
    }else extra.message=gibt+' Gold verbaut. Noch '+(X.LEUCHTTURM.ziel-bau.gold)+' Gold bis zur Spitze.';
  }
  if(op==='zerhacker_schlagen'){
    const z=zerhacker(world,now);
    if(z.hp<=0)fail('Der Zerhacker ist fuer diese Woche erledigt.');
    if(X.zerhackerVorrat(p,now)<1)fail('Deine Truppe sammelt sich noch. In wenigen Minuten hast du wieder einen Schlag.');
    if(!p.truppe||!p.truppe.length)fail('Stelle zuerst eine Truppe auf.');
    /* Er zieht weiter, waehrend die Standortmeldung unterwegs ist. Beide
       Punkte darum zur selben Zeit messen - sonst steht man neben ihm und
       der Server rechnet gegen den Ort, an dem er jetzt waere. */
    const wo=await position(id),bahn=X.zerhackerOrt(wo.updatedAt);
    if(Math.hypot(wo.x-bahn.x,wo.z-bahn.z)>X.ZERHACKER.reichweite)fail('Laufe zuerst näher heran.');
    const erst=world.erstschlag&&world.erstschlag.id===id?X.ERSTSCHLAG_BONUS:1;
    const schaden=Math.min(z.hp,Math.round(X.zerhackerSchaden(p)*erst));
    z.hp-=schaden;z.beitraege[id]=(z.beitraege[id]||0)+schaden;
    p.zerhackerGesamt=(p.zerhackerGesamt||0)+schaden;
    fehdeSchritt(world,id,'zerhacker',now,schaden);
    X.zerhackerVerbrauchen(p,now);
    extra.message='Treffer! '+schaden+' Schaden am Zerhacker.';
    if(z.hp<=0&&!z.verteilt){
      z.verteilt=true;z.besiegtAm=now;
      /* Die Beute richtet sich nach dem Anteil, den jemand beigetragen hat -
         wer nur einmal zugeschlagen hat, geht aber auch nicht leer aus. */
      const gesamt=Object.values(z.beitraege).reduce((a,b)=>a+b,0)||1;
      for(const [pid,anteil] of Object.entries(z.beitraege)){
        const wer=world.players[pid];if(!wer)continue;
        const teil=anteil/gesamt;
        wer.gold+=Math.max(50,Math.round(X.ZERHACKER.beuteGold*teil*Object.keys(z.beitraege).length));
        const runen=Math.max(1,Math.round(X.ZERHACKER.beuteRunen*teil*Object.keys(z.beitraege).length));
        wer.runes[5]=Math.min(9999,(wer.runes[5]||0)+runen);
      }
      log(world,p,id,null,'streckt den gehstockhassenden Zerhacker nieder.',now);
      extra.message='Der Zerhacker ist gefallen! Alle Beteiligten haben ihre Beute erhalten.';
    }
  }
  if(op==='fehde_fordern'){
    const gegner=world.players[body.targetId];
    if(!gegner||body.targetId===id)fail('Fordere einen anderen Spieler heraus.');
    if(fehdeVon(world,id,now))fail('Du stehst diese Woche schon in einer Fehde.');
    if(fehdeVon(world,body.targetId,now))fail(gegner.name+' steht diese Woche schon in einer Fehde.');
    const f=fehden(world,now);
    /* Hat der andere mich schon gefordert, gilt das sofort als Handschlag. */
    if(f.offen[body.targetId]===id){
      delete f.offen[body.targetId];
      f.paare.push({a:body.targetId,b:id,zaehlerA:{},zaehlerB:{},seit:now});
      extra.message='Die Fehde mit '+gegner.name+' steht. Gezählt wird bis Freitag, abgerechnet beim Wochenwechsel.';
    } else {
      f.offen[id]=body.targetId;
      extra.message=gegner.name+' wurde herausgefordert. Erst wenn er annimmt, zaehlt die Woche.';
    }
  }
  if(op==='fehde_annehmen'){
    const f=fehden(world,now),von=body.targetId;
    if(f.offen[von]!==id)fail('Diese Herausforderung gibt es nicht mehr.');
    if(fehdeVon(world,id,now)||fehdeVon(world,von,now))fail('Eine der beiden Seiten steht schon in einer Fehde.');
    delete f.offen[von];
    f.paare.push({a:von,b:id,zaehlerA:{},zaehlerB:{},seit:now});
    extra.message='Die Fehde mit '+(world.players[von]?.name||'ihm')+' steht. Gezählt wird bis Freitag, abgerechnet beim Wochenwechsel.';
  }
  if(op==='waffe_schleifen'){
    const waffe=X.WEAPONS.find(v=>v.id===body.itemId);
    if(!waffe||!p.weapons.includes(waffe.id))fail('Diese Waffe besitzt du nicht.');
    const stufe=X.schliff(p,waffe.id);
    if(stufe>=X.SCHLIFF_LIMIT)fail('Diese Waffe ist so scharf, wie sie werden kann.');
    const kosten=X.schliffKosten(stufe),vorrat=p.runes[0]||0;
    if(vorrat<kosten)fail('Dafuer brauchst du '+kosten+' einfache Runen.');
    p.runes[0]=vorrat-kosten;p.waffenSchliff=p.waffenSchliff||{};p.waffenSchliff[waffe.id]=stufe+1;
    extra.message=waffe.name+' geschliffen: Stufe '+(stufe+1)+', jetzt '+X.waffenWert(p,waffe.id)+' Schaden.';
  }
  if(op==='panzer_anlegen'){
    if(body.itemId===null||body.itemId===''){p.panzer=null;extra.message='Ruestung abgelegt.';}
    else{
      const teil=X.ruestung(body.itemId);
      if(!teil||!(p.ruestungen||[]).includes(teil.id))fail('Dieses Ruestungsteil hast du nicht.');
      p.panzer=teil.id;extra.message=teil.name+' angelegt: '+teil.schutz+' % weniger Schaden durch Gehstoecke.';
    }
  }
  if(op==='quest_claim'){const quest=X.QUESTS.find(q=>q.id===body.questId);if(!quest||p.claimedQuests.includes(quest.id)||X.progress(p,quest)<quest.goal)fail('Diese Questbelohnung ist noch nicht verfügbar.');p.claimedQuests.push(quest.id);if(quest.gold)p.gold+=quest.gold;if(quest.skin&&!p.skins.includes(quest.skin))p.skins.push(quest.skin);extra.message=quest.skin?X.skin(quest.skin).name+' freigeschaltet!':'Quest geschafft! +'+quest.gold+' Gold.';}
  if(op==='shop_buy'||op==='equip'){
    if(p.raidLock?.until>now)fail('Während eines Überfalls bleibt deine Ausrüstung fest.');
    const skin=body.kind==='skin',list=skin?X.SKINS:body.kind==='weapon'?X.WEAPONS:[],item=list.find(v=>v.id===body.itemId),owned=skin?p.skins:p.weapons;if(!item)fail('Diese Ausrüstung gibt es nicht.');
    if(op==='shop_buy'){if(owned.includes(item.id))fail('Das besitzt du bereits.');if(!item.price||item.price>p.gold)fail(item.quest?'Erfülle zuerst die zugehörige Quest.':'Du hast noch nicht genug Gold.');p.gold-=item.price;owned.push(item.id);}
    else if(!owned.includes(item.id))fail('Schalte diese Ausrüstung zuerst frei.');p[skin?'skin':'weapon']=item.id;extra.message=item.name+' ausgerüstet.';
  }
  if(op==='raid_start'){
    const target=world.players[body.targetId];if(!target||body.targetId===id)fail('Wähle einen anderen Spieler.');
    if(X.protected(target,now))fail('Dieser Spieler steht nach einem Diebstahl zwei Stunden unter Schutz.');
    if(p.raidCooldown>now||target.raidLock?.until>now||activeArena(target)||activeDuel(target)||activeDungeon(world,target))fail('Dieser Überfall ist gerade nicht möglich.');
    if(p.eggs.length>=E.BAG_LIMIT)fail('Du brauchst einen freien Platz für ein erbeutetes Ei.');
    const targetPos=await position(body.targetId);await nearby(targetPos);const plaetze=X.brutplaetze(world.leuchtturm,p),belegt=p.eggs.filter(e=>e.startedAt!==null).length;const victimEgg=(belegt<plaetze?target.eggs.find(e=>e.startedAt!==null):null)||target.eggs.find(e=>e.startedAt===null);if(!victimEgg)fail('Dieser Spieler trägt kein Ei, das in deine Brutstation passt.');
    p.raidCooldown=now+X.UEBERFALL_PAUSE;p.duel={id:body.requestId,targetId:body.targetId,targetName:target.name,revision:0,round:1,phase:'choose',hp:100,enemyHp:100,weapon:p.weapon,enemyWeapon:target.weapon,enemySkin:target.skin,enemyPanzer:target.panzer||null,until:now+10*60000,message:'Gewinne zuerst das Waffenduell, danach den Mon-Kampf.'};target.raidLock={attackerId:id,eggId:victimEgg.id,until:p.duel.until};
  }
  if(op==='raid_turn'){
    const d=p.duel;if(!d||d.phase!=='choose'||d.id!==body.duelId||d.revision!==body.revision)fail('Rufe den aktuellen Duellstand ab.');if(!['strike','heavy','guard'].includes(body.move))fail('Wähle eine Waffenaktion.');
    const enemyMove=['strike','heavy','guard'][Math.min(2,Math.floor(draw*3))];
    /* Der Verteidiger kaempft mit dem Stand, den er gespeichert hat - deshalb
       wird er hier nachgeschlagen und nicht aus dem Duell gelesen. */
    const gegner=world.players[d.targetId]||{panzer:d.enemyPanzer};
    const damage=X.duellSchaden(p,d.weapon,body.move,enemyMove==='guard',gegner);
    const counter=X.duellSchaden(gegner,d.enemyWeapon,enemyMove,body.move==='guard',p);d.enemyHp=Math.max(0,d.enemyHp-damage);if(d.enemyHp)d.hp=Math.max(0,d.hp-counter);d.revision++;d.round++;d.message='Dein Treffer: '+damage+' Schaden. Gegenangriff: '+(d.enemyHp?counter:0)+'.';
    if(!d.enemyHp){d.phase='won';d.message='Waffenduell gewonnen. Fordere jetzt seine Mons heraus, um ein Ei zu erbeuten.';}
    else if(!d.hp||d.round>20){d.phase='finished';d.message='Duell verloren. Deine Eier bleiben unberührt.';const t=world.players[d.targetId];if(t?.raidLock?.attackerId===id)delete t.raidLock;}
  }
  if(op==='raid_arena'){
    const d=p.duel,target=d&&world.players[d.targetId];if(!d||d.phase!=='won'||d.until<=now||target?.raidLock?.attackerId!==id)fail('Gewinne zuerst ein gültiges Waffenduell.');p.truppe=validateSquad(p,body.squad);
    p.arena=A.create(p.truppe.map(mid=>X.mon(p,mid)),target.truppe.map(mid=>X.mon(target,mid)),{id:body.requestId,territoryId:6,now});Object.assign(p.arena,{kind:'raid',targetId:d.targetId,title:'Überfall auf '+target.name});target.raidLock.battleId=p.arena.id;d.phase='arena';
  }
  if(op==='raid_cancel'){const d=p.duel,target=d&&world.players[d.targetId];if(target?.raidLock?.attackerId===id)delete target.raidLock;p.duel=null;extra.message='Zurückgezogen. Kein Ei wurde gestohlen.';}
  return extra;
}
