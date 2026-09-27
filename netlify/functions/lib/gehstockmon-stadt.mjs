/* Stockhafen: die Grosse Arena, der Gehstock-Champion und die Arbeit fuer
   alle, die gerade kein Gebiet halten.

   Der Grundgedanke der Arena ist, dass niemand dafuer da sein muss. Man
   kaempft gegen die gespeicherte Truppe eines anderen, genau wie beim
   Angriff auf einen Aussenposten - nur dass hier niemand etwas verliert.
   Das macht sie zum einzigen Spielerkampf, den man jederzeit haben kann.

   Ueber allem steht genau ein Champion. Haelt ihn niemand, haelt ihn das
   Haus: die Tafel ist damit nie leer, und der Titel ist vom ersten Tag an
   etwas, das man jemandem abnehmen kann. */
import {data as D,economy as E,arena as A,hours as H,adventure as X} from './gehstockmon-rules.mjs';
import {anwesende} from './gehstockmon-anwesenheit.mjs';
import {tickern} from './gehstockmon-alltag.mjs';
import {effekt,amtTitel} from './gehstockmon-insel.mjs';
const activeArena=(p)=>p.arena&&p.arena.phase!=='finished';
const fail=(message)=>{throw new Error(message);};

/* Der amtierende Champion. Ohne Titeltraeger uebernimmt der Meister des
   Hauses - und sein Sold faellt natuerlich niemandem zu. */
export function champion(world,now){
  if(!world.champion)world.champion={...X.HAUSMEISTER,seit:now,verteidigt:0,soldAt:now};
  const c=world.champion;
  /* Ein Spieler, der die Welt verlassen hat, kann den Titel nicht halten. */
  if(c.id&&!world.players[c.id])Object.assign(c,X.HAUSMEISTER,{seit:now,verteidigt:0,soldAt:now});
  return c;
}
/* Der Sold laeuft wie das taegliche Gebietsgold: er wird um Mitternacht
   gutgeschrieben und bei der naechsten Anmeldung ausgezahlt. */
export function championSold(world,now){
  const c=champion(world,now);
  if(!c.id)  {c.soldAt=now;return;}
  const tage=Math.max(0,H.day(now)-H.day(c.soldAt));
  if(!tage)return;
  c.soldAt=now;
  const wer=world.players[c.id];
  /* soldPending trennt den Sold in der Wochenbilanz vom Tagesgeld. */
  if(wer){wer.dailyGoldPending=(wer.dailyGoldPending||0)+X.championSold(tage);wer.soldPending=(wer.soldPending||0)+X.championSold(tage);}
}
function chronik(world){
  if(!Array.isArray(world.championChronik))world.championChronik=[];
  return world.championChronik;
}
function log(world,text,id,now){
  world.reports.push({id:'arena-'+id+'-'+now,time:now,attackerId:id,defenderId:null,territoryId:1,text});
  world.reports=world.reports.slice(-150);
}
/* Dieselbe Uebersetzung wie beim Gebietskampf. Vorher stand hier ein eigener
   Nachbau, der nur die Runenstufe mitnahm: der Champion und jeder Gegner der
   Rangliste kaempften damit ohne ihr Wesen und ohne den Plan, den ihr
   Besitzer gesetzt hatte - obwohl der Planeditor genau das verspricht. */
function truppe(squad){
  return (squad||[]).map(e=>A.ausSpeicher(e));
}
/* Die eigene Aufstellung, wie sie ein Angreifer zu sehen bekommt - das
   Kampfteam samt Runenstufe, Wesen und Plan. In der Arena verteidigt immer
   das Kampfteam, nie eine Gebietsbesatzung: die halten ihre Posten. */
export function aufstellung(p){
  return (p.truppe||[]).map(mid=>{
    const m=X.mon(p,mid);
    return {id:mid,upgrade:m.upgrade,wesen:m.wesenId||null,plan:A.eigenerPlan(p.plaene&&p.plaene[mid]),...(m.schimmernd?{schimmernd:true}:{})};
  });
}
function gegnerliste(world,id,now){
  const ich=world.players[id],meinRuhm=X.ruhm(ich);
  const echte=Object.entries(world.players)
    .filter(([pid,v])=>pid!==id&&Array.isArray(v.truppe)&&v.truppe.length===4)
    .map(([pid,v])=>({id:pid,name:v.name,ruhm:X.ruhm(v),squad:aufstellung(v),haus:false,titel:amtTitel(world,pid,now)||X.titelName(v)}))
    .sort((a,b)=>Math.abs(a.ruhm-meinRuhm)-Math.abs(b.ruhm-meinRuhm)).slice(0,5);
  return echte.concat(X.ARENA_GEGNER.map(v=>({...v,squad:v.squad.slice()})));
}
/* Die offenen Tauschangebote. Abgelaufene fallen beim Lesen heraus, damit
   niemand auf ein Angebot antwortet, das es nicht mehr gibt. */
export function tauschliste(world,now){
  if(!Array.isArray(world.tausch))world.tausch=[];
  /* Ein Angebot faellt heraus, sobald das Mon wieder Dienst tut - im
     Kampfteam oder auf einem Aussenposten. Vorher zaehlte nur das Kampfteam,
     und ein Mon liess sich von seinem Posten wegtauschen. */
  world.tausch=world.tausch.filter(v=>{
    const wer=v&&world.players[v.vonId];
    if(!wer||now-v.seit>=X.TAUSCH_DAUER||!wer.besitz.includes(v.gebe))return false;
    const ort=X.einsatzOrt(wer,v.gebe);
    return ort===null||ort===undefined;
  });
  return world.tausch;
}
/* Wie schwer ein Gegner im Vergleich zur eigenen Truppe ist. Unter 85 %
   der eigenen Staerke gilt er als leichter, ueber 115 % als schwerer. */
export const ARENA_LEICHT=.85,ARENA_SCHWER=1.15,ARENA_EINSTEIGER=3;
export function arenaEinstufung(eigene,seine){
  if(!eigene)return 'unbekannt';
  const verhaeltnis=seine/eigene;
  return verhaeltnis<ARENA_LEICHT?'leichter':verhaeltnis>ARENA_SCHWER?'schwerer':'ausgeglichen';
}
/* Fuer Einsteiger (weniger als drei Arenasiege insgesamt) wird ein Gegner
   empfohlen: der staerkste, der noch unter 85 % der eigenen Staerke bleibt -
   gut zu schaffen, aber kein reines Geschenk. Gibt es keinen, der schwaechste. */
export function arenaEmpfehlung(eigene,gegner){
  if(!eigene||!gegner.length)return null;
  const leichte=gegner.filter(g=>g.staerke<eigene*ARENA_LEICHT).sort((a,b)=>b.staerke-a.staerke);
  return (leichte[0]||gegner.slice().sort((a,b)=>a.staerke-b.staerke)[0]).id;
}
/* Was der Client von der Arena sehen darf. */
export function arenaStand(world,id,now){
  const c=champion(world,now),p=world.players[id];
  const eigeneStaerke=A.staerke((p.truppe||[]).map(mid=>X.mon(p,mid)));
  const gegner=gegnerliste(world,id,now).map(g=>{
    const staerke=A.staerke(truppe(g.squad));
    return {...g,staerke,einstufung:arenaEinstufung(eigeneStaerke,staerke)};
  });
  const siegeGesamt=p.arenaSiegeGesamt||0;
  return {turnier:{
    ruhm:X.ruhm(p),siege:X.arenaSiege(p),noetig:X.TITEL_SIEGE,
    versuche:p.arenaVersuche||0,siegeGesamt,eigeneStaerke,
    empfohlen:siegeGesamt<ARENA_EINSTEIGER?arenaEmpfehlung(eigeneStaerke,gegner):null,
    pause:Math.max(0,(p.arenaCooldown||0)-now),titelPause:Math.max(0,(p.titelCooldown||0)-now),
    champion:{name:c.name,selbst:!!c.id&&c.id===id,haus:!c.id,seit:c.seit,verteidigt:c.verteidigt||0,squad:c.squad},
    gegner,
    chronik:chronik(world).slice(-8).reverse()},
    stadt:{
      ohneGebiet:!world.territories.some(t=>t.ownerId===id),
      tagwerk:X.tagwerkStand(p,now).fertig,tagwerkMax:X.TAGWERK_VORRAT,
      tagwerkIn:X.tagwerkWartezeit(p,now),tagwerkLohn:Math.round(X.TAGWERK_LOHN*effekt(world,now,'tagwerk')),
      findelei:X.findeleiStand(p,now).fertig,findeleiMax:X.FINDELEI_VORRAT,findeleiIn:X.findeleiWartezeit(p,now),
      brutplaetze:X.brutplaetze(world.leuchtturm,p),gekauft:X.gekaufteBrutplaetze(p),
      preis:X.BRUTPLATZ_PREISE[X.gekaufteBrutplaetze(p)]||null},
    tausch:tauschliste(world,now).map(v=>({id:v.id,name:world.players[v.vonId]?.name||'Unbekannt',
      selbst:v.vonId===id,gebe:v.gebe,suche:v.suche,seit:v.seit,
      /* Ob ich das Gesuchte ueberhaupt anbieten kann, entscheidet der Server -
         der Client soll nicht raten muessen. */
      moeglich:v.vonId!==id&&!X.tauschErlaubt(p,v.suche,v.gebe)}))};
}

/* Abrechnung eines Arenakampfes. Wird aus finishEncounter gerufen, sobald
   der Kampf zu Ende ist - hier faellt die Entscheidung ueber Ruhm, Gold und
   den Titel. */
export function stadtSettle(world,p,id,now){
  const b=p.arena;
  if(b.kind==='rang'){
    /* Das Arenafest des Buergermeisters legt ein Viertel drauf. */
    const sieg=b.winner==='wir',lohn=Math.round(X.arenaLohn(b.einstufung)*effekt(world,now,'arenaLohn'));
    p.arenaRuhm=Math.max(100,X.ruhm(p)+(sieg?X.RUHM_SIEG:-X.RUHM_NIEDERLAGE));
    E.buchen(p,sieg?lohn:X.ARENA_TROST,'arena',now);
    if(sieg){
      p.arenaSiege=X.arenaSiege(p)+1;p.arenaSiegeGesamt=(p.arenaSiegeGesamt||0)+1;X.alltagSchritt(p,'arena',now);
      b.message='Ranglistensieg gegen '+b.gegnerName+'! +'+lohn+' Gold, +'+X.RUHM_SIEG+' Ruhm · '
        +Math.min(p.arenaSiege,X.TITEL_SIEGE)+'/'+X.TITEL_SIEGE+' bis zum Titelkampf.';
    }else b.message='Niederlage gegen '+b.gegnerName+'. −'+X.RUHM_NIEDERLAGE+' Ruhm, '+X.ARENA_TROST+' Gold Trost. Deine Mons bleiben dir.';
    return true;
  }
  if(b.kind!=='champion')return false;
  const c=champion(world,now);
  if(b.winner==='wir'){
    /* Waehrend des Kampfes kann ein anderer den Titel geholt haben. Dann
       zaehlt der Sieg als Ranglistensieg und nicht als Titelgewinn. */
    if(c.seit!==b.championSeit){
      p.arenaRuhm=X.ruhm(p)+X.RUHM_SIEG;E.buchen(p,Math.round(X.ARENA_LOHN*effekt(world,now,'arenaLohn')),'arena',now);p.arenaSiegeGesamt=(p.arenaSiegeGesamt||0)+1;
      b.message='Gewonnen - aber der Titel hat während des Kampfes den Besitzer gewechselt. Der Sieg zählt als Ranglistensieg.';
      return true;
    }
    chronik(world).push({name:c.name,haus:!c.id,von:c.seit,bis:now,verteidigt:c.verteidigt||0});
    world.championChronik=chronik(world).slice(-20);
    Object.assign(c,{id,name:p.name,squad:aufstellung(p),seit:now,verteidigt:0,soldAt:now});
    p.arenaRuhm=X.ruhm(p)+X.RUHM_TITEL;p.arenaSiege=0;p.championSeit=now;p.arenaSiegeGesamt=(p.arenaSiegeGesamt||0)+1;
    p.championTitel=(p.championTitel||0)+1;
    b.message='Du bist Gehstock-Champion! Deine Aufstellung verteidigt ab jetzt den Titel, und du bekommst '
      +X.CHAMPION_SOLD+' Gold Sold je Tag, solange du ihn hältst.';
    log(world,p.name+' ist der neue Gehstock-Champion.',id,now);X.alltagSchritt(p,'arena',now);
    const vorgaenger=(world.championChronik[world.championChronik.length-1]||{}).name||'dem Haus';
    tickern(world,'♛ '+p.name+' entreißt '+vorgaenger+' den Titel und ist neuer Gehstock-Champion!','champion',now,id);
  }else{
    p.arenaRuhm=Math.max(100,X.ruhm(p)-X.RUHM_NIEDERLAGE);p.arenaSiege=0;E.buchen(p,X.ARENA_TROST,'arena',now);
    if(c.seit===b.championSeit)c.verteidigt=(c.verteidigt||0)+1;
    b.message='Der Titel bleibt bei '+c.name+'. Sammle drei neue Ranglistensiege und komm wieder.';
  }
  return true;
}

export async function stadtAction({world,p,id,body,now,presence}){
  const op=body.op,extra={};
  if(!X.STADT_OPS.includes(op))return extra;
  async function amTor(){
    const v=(await anwesende(presence))[id];
    if(!v||now-v.updatedAt>=15000||v.spawnAt!==p.lastJoinAt)fail('Die Kartenposition ist nicht aktuell. Warte kurz auf die Verbindung.');
    if(!X.inStadt(v))fail('Dafür musst du in Stockhafen stehen. Lauf zuerst in die Stadt.');
    return v;
  }
  function ohneGebiet(){
    if(world.territories.some(t=>t.ownerId===id))fail('Das ist die Hilfe für alle ohne Gebiet. Du hältst einen Außenposten.');
  }
  if(op==='brutplatz_kaufen'){
    const gekauft=X.gekaufteBrutplaetze(p),preis=X.BRUTPLATZ_PREISE[gekauft];
    if(!preis)fail('Mehr Brutplätze gibt es nicht.');
    if(p.gold<preis)fail('Dafür brauchst du '+preis+' Gold.');
    E.buchen(p,-preis,'brutplatz',now);p.brutplaetze=gekauft+1;
    extra.message='Brutplatz gekauft: '+X.brutplaetze(world.leuchtturm,p)+' Plätze. Du kannst jetzt so viele Eier gleichzeitig ausbrüten.';
    return extra;
  }
  /* Goldwaren - siehe X.HAENDLER_EI_PREIS in 1-zusatz.js. Alle drei gehen von
     ueberall, genau wie der Kauf eines Brutplatzes. */
  if(op==='ei_kaufen'){
    const tag=H.day(now);
    if(p.haendlerTag===tag)fail('Der Händler hat dir heute schon ein Ei verkauft. Morgen hat er ein neues.');
    if(p.gold<X.HAENDLER_EI_PREIS)fail('Ein Ei kostet '+X.HAENDLER_EI_PREIS+' Gold.');
    if(p.eggs.length>=E.BAG_LIMIT)fail('Deine Bruttasche ist voll.');
    E.buchen(p,-X.HAENDLER_EI_PREIS,'eier',now);p.haendlerTag=tag;
    p.eggs.push({id:'handel-'+now+'-'+(++p.eggSerial),territoryId:X.FINDELEI_FELD,producedAt:now,startedAt:null,readyAt:null,art:'handel'});
    extra.message='Der Händler gibt dir ein Ei. −'+X.HAENDLER_EI_PREIS+' Gold.';
    return extra;
  }
  if(op==='runen_zerlegen'||op==='runen_verschmelzen'){
    const zerlegen=op==='runen_zerlegen',rang=Number(body.rang),hoechster=D.SELTENHEITEN.length-1;
    if(!Number.isInteger(rang)||(zerlegen?rang<1||rang>hoechster:rang<0||rang>=hoechster))fail('Diese Runen lassen sich so nicht umschmieden.');
    const nimmt=zerlegen?1:3,gibt=zerlegen?2:1,ziel=zerlegen?rang-1:rang+1,kosten=X.schmiedeKosten(zerlegen?'zerlegen':'verschmelzen',rang);
    if((p.runes[rang]||0)<nimmt)fail('Dafür brauchst du '+nimmt+' '+D.SELTENHEITEN[rang].name+'-'+(nimmt===1?'Rune':'Runen')+'.');
    if(p.gold<kosten)fail('Die Schmiede verlangt '+kosten+' Gold.');
    E.buchen(p,-kosten,'schmiede',now);p.runes[rang]-=nimmt;p.runes[ziel]=Math.min(9999,(p.runes[ziel]||0)+gibt);
    extra.message=(zerlegen?'Zerlegt':'Verschmolzen')+': '+nimmt+' '+D.SELTENHEITEN[rang].name+' → '+gibt+' '+D.SELTENHEITEN[ziel].name+'. −'+kosten+' Gold.';
    return extra;
  }
  if(op==='schimmerperle_kaufen'){
    if(p.schimmerperle)fail('Du hast schon eine Schimmerperle. Sie wirkt beim nächsten Schlüpfen.');
    if(p.gold<X.SCHIMMERPERLE_PREIS)fail('Eine Schimmerperle kostet '+X.SCHIMMERPERLE_PREIS+' Gold.');
    E.buchen(p,-X.SCHIMMERPERLE_PREIS,'perle',now);p.schimmerperle=true;
    extra.message='Schimmerperle gekauft: Das nächste Mon, das du ausbrütest und das noch nicht schimmert, schlüpft schimmernd.';
    return extra;
  }
  if(op==='tagwerk'){
    ohneGebiet();await amTor();
    if(X.tagwerkStand(p,now).fertig<1)fail('Im Hafen gibt es gerade keine Arbeit. Komm in einer Weile wieder.');
    const lohn=Math.round(X.TAGWERK_LOHN*effekt(world,now,'tagwerk'));
    X.tagwerkVerbrauchen(p,now);E.buchen(p,lohn,'tagwerk',now);
    extra.message='Tagwerk erledigt: +'+lohn+' Gold.';
    return extra;
  }
  if(op==='findelei'){
    ohneGebiet();await amTor();
    if(!X.findeleiFertig(p,now))fail('Im Findelhaus liegt gerade kein Ei bereit.');
    if(p.eggs.length>=E.BAG_LIMIT)fail('Deine Bruttasche ist voll.');
    X.findeleiVerbrauchen(p,now);
    p.eggs.push({id:'findel-'+now+'-'+(++p.eggSerial),territoryId:X.FINDELEI_FELD,producedAt:now,startedAt:null,readyAt:null,art:'findel'});
    extra.message='Das Findelhaus gibt dir ein Ei. Auch ohne Gebiet wächst deine Sammlung weiter.';
    return extra;
  }
  if(op==='tausch_anbieten'){
    const liste=tauschliste(world,now);
    if(liste.filter(v=>v.vonId===id).length>=3)fail('Du hast schon drei Angebote am Brett. Nimm erst eins zurück.');
    if(liste.length>=X.TAUSCH_MAX)fail('Das Tauschbrett ist voll. Versuch es später noch einmal.');
    const fehler=X.tauschErlaubt(p,body.gebe,body.suche);
    if(fehler)fail(fehler);
    if(p.besitz.includes(body.suche))fail('Dieses Mon hast du bereits.');
    liste.push({id:body.requestId,vonId:id,gebe:body.gebe,suche:body.suche,seit:now});
    extra.message=D.mon(body.gebe).name+' hängt am Brett. Wer dir '+D.mon(body.suche).name+' bringt, bekommt ihn.';
    return extra;
  }
  if(op==='tausch_zuruecknehmen'){
    const liste=tauschliste(world,now),at=liste.findIndex(v=>v.id===body.tauschId&&v.vonId===id);
    if(at<0)fail('Dieses Angebot gibt es nicht mehr.');
    liste.splice(at,1);
    extra.message='Angebot zurückgenommen.';
    return extra;
  }
  if(op==='tausch_annehmen'){
    const liste=tauschliste(world,now),angebot=liste.find(v=>v.id===body.tauschId);
    if(!angebot)fail('Dieses Angebot gibt es nicht mehr.');
    if(angebot.vonId===id)fail('Das ist dein eigenes Angebot.');
    const andere=world.players[angebot.vonId];
    if(!andere)fail('Dieser Spieler ist nicht mehr in der Welt.');
    /* Ich gebe das Gesuchte und bekomme das Angebotene - beides mit denselben
       Regeln geprueft wie beim Anbieten. */
    const fehler=X.tauschErlaubt(p,angebot.suche,angebot.gebe);
    if(fehler)fail(fehler);
    if(p.besitz.includes(angebot.gebe))fail('Dieses Mon hast du bereits.');
    if(andere.besitz.includes(angebot.suche))fail('Der andere hat dieses Mon inzwischen selbst.');
    const seinOrt=X.einsatzOrt(andere,angebot.gebe);
    if(!andere.besitz.includes(angebot.gebe)||(seinOrt!==null&&seinOrt!==undefined))fail('Der andere kann sein Angebot gerade nicht einlösen.');
    if(activeArena(andere))fail('Der andere kämpft gerade. Versuch es gleich noch einmal.');
    function umziehen(von,nach,monId){
      von.besitz=von.besitz.filter(v=>v!==monId);
      delete von.monUpgrades[monId];delete von.wesen[monId];delete von.plaene[monId];
      if(!nach.besitz.includes(monId))nach.besitz.push(monId);
    }
    umziehen(andere,p,angebot.gebe);
    umziehen(p,andere,angebot.suche);
    liste.splice(liste.indexOf(angebot),1);
    log(world,p.name+' tauscht mit '+andere.name+': '+D.mon(angebot.suche).name+' gegen '+D.mon(angebot.gebe).name+'.',id,now);
    extra.monId=angebot.gebe;
    extra.message='Getauscht! '+D.mon(angebot.gebe).name+' gehört jetzt dir - '+D.mon(angebot.suche).name+' ist weg, samt Runenstufe und Wesen.';
    return extra;
  }
  /* Beide Kaempfe laufen ueber dieselbe Maschine wie ein Gebietsangriff. Der
     Gegner braucht nichts davon zu wissen und verliert auch nichts. */
  if(op==='arena_rang'||op==='champion_fordern'){
    if(p.arena&&p.arena.phase!=='finished')fail('Beende zuerst deinen aktuellen Kampf.');
    if(!Array.isArray(p.truppe)||p.truppe.length!==4)fail('Stelle zuerst eine Truppe aus vier Mons auf.');
    await amTor();
    const titel=op==='champion_fordern';
    if(titel){
      const c=champion(world,now);
      if(c.id===id)fail('Du hältst den Titel bereits. Deine eingefrorene Aufstellung verteidigt ihn von selbst.');
      if((p.titelCooldown||0)>now)fail('Der nächste Titelkampf ist in '+Math.ceil(((p.titelCooldown||0)-now)/60000)+' Minuten möglich.');
      if(X.arenaSiege(p)<X.TITEL_SIEGE)fail('Für einen Titelkampf brauchst du '+X.TITEL_SIEGE+' Ranglistensiege. Du hast '+X.arenaSiege(p)+'.');
      p.titelCooldown=now+X.TITEL_PAUSE;p.arenaVersuche=(p.arenaVersuche||0)+1;
      p.arena=A.create(p.truppe.map(mid=>X.mon(p,mid)),truppe(c.squad),{id:body.requestId,territoryId:1,now,bonus:.1});
      Object.assign(p.arena,{kind:'champion',title:'TITELKAMPF · '+c.name,gegnerName:c.name,championSeit:c.seit});
      extra.message='Titelkampf gegen '+c.name+'. Der Champion kämpft mit einem Zehntel Heimvorteil.';
      return extra;
    }
    if((p.arenaCooldown||0)>now)fail('Der nächste Ranglistenkampf ist in '+Math.ceil(((p.arenaCooldown||0)-now)/60000)+' Minuten möglich.');
    const gegner=gegnerliste(world,id,now).find(v=>v.id===body.targetId);
    if(!gegner)fail('Dieser Gegner steht nicht mehr auf der Liste. Aktualisiere die Arena.');
    p.arenaCooldown=now+X.ARENA_PAUSE;p.arenaVersuche=(p.arenaVersuche||0)+1;
    /* Die Stufe wird beim Start festgehalten - sie bestimmt den Lohn. */
    const eigene=A.staerke(p.truppe.map(mid=>X.mon(p,mid))),einstufung=arenaEinstufung(eigene,A.staerke(truppe(gegner.squad)));
    p.arena=A.create(p.truppe.map(mid=>X.mon(p,mid)),truppe(gegner.squad),{id:body.requestId,territoryId:1,now});
    Object.assign(p.arena,{kind:'rang',title:'GROSSE ARENA · '+gegner.name,gegnerName:gegner.name,einstufung});
    extra.message='Ranglistenkampf gegen '+gegner.name+'. Er muss dafür nicht anwesend sein.';
  }
  return extra;
}
