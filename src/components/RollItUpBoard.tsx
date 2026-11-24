import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { activePartyPlayer, ITEMS, ITEM_IDS, type PartyAction, type PartyGame } from "../../shared/party";
import { rollBoard, stationsOf, goalField, boardDistances, boardPathTo, boardRoute, FIELD_LABELS, fieldName, hasFullSet, partyBoard, partyPaths, stationAt } from "../../shared/partyBoard";
import { FIELD_HELP, FIELD_VISUALS } from "../lib/partyFieldVisuals";
import { preloadFigures } from "../figures/catalog";
import type { BoardFrame } from "../three/boardWorld";
import { CharacterAvatar } from "./CharacterAvatar";
import { Collection } from "./RollItUp";
import { PartyPanel } from "./PartyPanel";
import { PartyDice } from "./PartyDice";
import { PartyMapFallback } from "./PartyMapFallback";

interface Props {
  game:PartyGame;viewer:string;now:number;busy:boolean;rolling:boolean;blocked:boolean;connected:boolean;error:string;
  send:(action:PartyAction)=>void;onMenu:()=>void;onInventory:()=>void;
}
type Panel="collection"|"standings"|"fields"|"field"|"camera"|"rules";
const primary="button button--primary button--wide",secondary="button button--ghost button--wide";

/** Roll It Up's mobile board UI. Commands are committed by the existing room authority. */
export function RollItUpBoard({game:g,viewer,now,busy,rolling,blocked,connected,error,send,onMenu,onInventory}:Props) {
  const p=activePartyPlayer(g),own=g.players.find(player=>player.id===viewer)!,canAct=p.id===viewer;
  const [panel,setPanel]=useState<Panel>(),[selected,setSelected]=useState<number>(),[target,setTarget]=useState<number>();
  const [flat,setFlat]=useState(false),[failed,setFailed]=useState(false),[ready,setReady]=useState(false);
  const [overview,setOverview]=useState(false),[zoom,setZoom]=useState(1),[angle,setAngle]=useState(0),[view,setView]=useState(0);
  const [choice,setChoice]=useState<number>(),[replace,setReplace]=useState(0),[toast,setToast]=useState("");
  const [reduce,setReduce]=useState(()=>typeof window!=="undefined"&&window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [insets,setInsets]=useState({top:154,bottom:230,right:0});
  const root=useRef<HTMLDivElement>(null),host=useRef<HTMLDivElement>(null),head=useRef<HTMLElement>(null),tools=useRef<HTMLDivElement>(null),bottom=useRef<HTMLDivElement>(null);
  const markerNodes=useRef(new Map<string,HTMLDivElement>()),previousSupplies=useRef(own.supplies??[]);
  const board=partyBoard(g),paths=partyPaths(g,p),chosen=choice!==undefined&&paths.includes(choice)?choice:paths.includes(goalField(g))?goalField(g):paths[0];
  const preview=g.phase==="path"?boardRoute(g,p,chosen,g.steps):undefined;
  const route=preview?[p.position,...preview.fields]:hasFullSet(g,p)?boardPathTo(g,p,goalField(g)):undefined;
  const distances=boardDistances(g,own),missing=stationsOf(g).filter(s=>!own.supplies?.includes(s.field));
  const next=missing.slice().sort((a,b)=>(distances.get(a.field)??Infinity)-(distances.get(b.field)??Infinity))[0];
  const objective=target??(hasFullSet(g,own)?goalField(g):next?.field??goalField(g)),objectiveStation=stationAt(g,objective);
  const objectiveOwned=own.supplies?.includes(objective);
  const moving=g.phase==="moving"||rolling,disabled=busy||moving||Boolean(g.pausedAt)||!connected;
  const station=stationAt(g,p.position),seconds=g.deadline?Math.max(0,Math.ceil((g.deadline-now)/1000)):0;
  const show2d=flat||failed;
  const visibleMarkers=overview?[{key:"goal",field:goalField(g),text:"Jayspot",sub:hasFullSet(g,own)?"Weg frei":"Alle 6 Utensilien"},...stationsOf(g).map(s=>({key:`station-${s.field}`,field:s.field,text:s.name,sub:own.supplies?.includes(s.field)?"Gesammelt":`${s.price} Münzen`}))]:[
    {key:"goal",field:goalField(g),text:"Jayspot",sub:hasFullSet(g,own)?"Weg frei":"Alle 6 Utensilien"},
    {key:"active",field:p.position,text:canAct?"Du":p.name,sub:""},
    ...(selected!==undefined&&selected!==p.position&&selected!==goalField(g)?[{key:"selected",field:selected,text:fieldName(g,selected),sub:""}]:[])
  ];
  const frame:BoardFrame={game:g,positions:Object.fromEntries(g.players.map(player=>[player.id,player.position])),now,zoom,angle,follow:!overview,selected,view,reduce,blocked:blocked||Boolean(panel),insets,route};
  const current=useRef(frame);current.current=frame;
  const labels=useRef(visibleMarkers);labels.current=visibleMarkers;
  useEffect(()=>{
    const media=window.matchMedia("(prefers-reduced-motion: reduce)"),change=()=>setReduce(media.matches);media.addEventListener("change",change);return()=>media.removeEventListener("change",change);
  },[]);
  useEffect(()=>{
    if(show2d)return;let disposed=false,world:{dispose:()=>void}|undefined;setReady(false);
    void Promise.all([import("../three/boardWorld"),preloadFigures(g.players.map(player=>player.characterId))]).then(([{createBoardWorld}])=>{
      if(disposed||!host.current)return;
      try{world=createBoardWorld(host.current,()=>({...current.current,markers:labels.current.flatMap(label=>{const element=markerNodes.current.get(label.key);return element?[{field:label.field,element,height:label.key==="active"?2.7:2.2}]:[];})}),field=>{setSelected(field);setPanel("field");},()=>setFailed(true),setZoom);setReady(true);}catch{setFailed(true);}
    }).catch(()=>setFailed(true));
    return()=>{disposed=true;world?.dispose();};
  },[show2d]);
  useLayoutEffect(()=>{
    const measure=()=>{
      if(!root.current||!head.current||!tools.current)return;
      const r=root.current.getBoundingClientRect(),h=head.current.getBoundingClientRect(),t=tools.current.getBoundingClientRect();
      const landscape=r.width>r.height&&r.height<=500;
      const next={top:Math.ceil(h.bottom-r.top+8),bottom:landscape?8:Math.ceil(r.bottom-t.top+8),right:landscape?Math.ceil(r.right-t.left+8):0};
      setInsets(old=>old.top===next.top&&old.bottom===next.bottom&&old.right===next.right?old:next);
    };
    const observer=new ResizeObserver(measure);for(const element of [root.current,head.current,bottom.current])if(element)observer.observe(element);measure();return()=>observer.disconnect();
  },[g.phase,overview,canAct,toast,error,own.items.length]);
  useEffect(()=>{setChoice(undefined);setReplace(0);if(canAct&&["path","supply","shop","gift"].includes(g.phase))setOverview(false);},[g.phaseId]);
  useEffect(()=>{setSelected(undefined);setOverview(false);setZoom(1);setAngle(0);setView(n=>n+1);},[g.round,g.turn]);
  useEffect(()=>{
    const added=(own.supplies??[]).find(field=>!previousSupplies.current.includes(field));previousSupplies.current=own.supplies??[];
    if(added===undefined)return;setToast(`${stationAt(g,added)?.name} gesammelt`);
    const timer=setTimeout(()=>setToast(""),3500);return()=>clearTimeout(timer);
  },[own.supplies?.join()]);
  function camera(all:boolean){setOverview(all);setZoom(1);setAngle(0);setView(n=>n+1);}
  function showField(field:number){setSelected(field);setTarget(field);setPanel(undefined);camera(true);}
  const inspect=selected??p.position,look=board[inspect];
  const inspectStation=stationAt(g,inspect);
  const replaceControl=<label>Welches Item möchtest du ersetzen?<select value={replace} onChange={event=>setReplace(Number(event.target.value))}>{p.items.map((item,index)=><option key={index} value={index}>{ITEMS[item].name}</option>)}</select></label>;
  return <div className="roll-board" ref={root} data-board={rollBoard(g).id} data-overview={overview}>
    <div className="party-world-stage">
      {show2d?<div className="roll-flat" style={{top:insets.top,bottom:insets.bottom,right:insets.right}}><PartyMapFallback game={g} previewRoute={route} onInspect={field=>{setSelected(field);setPanel("field");}}/></div>:<div ref={host} className="party-world" aria-label="Drehbare Bauschale mit sechs Kaufstellen und Jayspot" role="group">{!ready&&<p className="party-world-loading" role="status">Die Bauschale wird geladen …</p>}</div>}
      {!show2d&&<div className="roll-map-labels" aria-hidden="true">{visibleMarkers.map(label=><div key={label.key} ref={node=>{if(node)markerNodes.current.set(label.key,node);else markerNodes.current.delete(label.key);}} className={`roll-world-label ${label.key==="active"?"is-active":""} ${label.field===objective?"is-objective":""}`}><strong>{label.text}</strong>{label.sub&&<small>{label.sub}</small>}</div>)}</div>}
    </div>
    <header className="roll-head party-header" ref={head}>
      <div className="roll-brand"><div><strong>Roll It Up!</strong><small>{rollBoard(g).name}</small></div><span>Runde <b>{g.round}</b></span><button className="party-game-menu" onClick={onMenu} aria-label="Spielmenü öffnen" aria-haspopup="dialog">☰</button></div>
      <div className="roll-personal"><button className="roll-set" onClick={()=>setPanel("collection")} aria-label="Dein Set öffnen" aria-haspopup="dialog"><span>Dein Set<span className="roll-set-progress" aria-hidden="true">{stationsOf(g).map(s=><i key={s.field} className={own.supplies?.includes(s.field)?"is-collected":""}/>)}</span></span><b>{own.supplies?.length??0} / 6</b><span aria-hidden="true">›</span></button><div className="roll-coins"><span aria-hidden="true">◉</span><strong>{own.coins}<small>Münzen</small></strong></div></div>
      <button className="roll-objective" onClick={()=>setPanel("collection")} aria-label="Sammelziel und Set ansehen">{objective===goalField(g)?(hasFullSet(g,own)?"Set komplett · auf zum Jayspot":"Jayspot · alle 6 Utensilien nötig"):`${objectiveStation?.name} ${objectiveOwned?"gesammelt":`fehlt · ${objectiveStation!.price} Münzen`}`}<span aria-hidden="true">›</span></button>
    </header>
    <div className="roll-bottom" ref={bottom}>
      {failed&&<p className="roll-notice" role="status">3D ist hier nicht verfügbar. Die 2D-Karte bleibt spielbar.</p>}
      {toast&&<p className="roll-notice" role="status">✓ {toast}</p>}
      <div ref={tools} className="roll-map-tools party-board-toolbar">
        <button className="roll-stone" onClick={()=>camera(!overview)} aria-label={overview?"Zur Figur zurückkehren":"Ganze Schale ansehen"} aria-pressed={overview}>{overview?"Zur Figur":"Ganze Schale"}</button>
        <button className="roll-icon" onClick={()=>setPanel("fields")} aria-label="Felder und Figuren" aria-haspopup="dialog">?</button>
        <button className="roll-icon" onClick={()=>setPanel("camera")} aria-label="Kamera öffnen" aria-haspopup="dialog">⌖</button>
        <button className="roll-icon party-view-toggle" onClick={()=>setFlat(value=>!value)} disabled={failed} aria-label={show2d?"Zur 3D-Ansicht wechseln":"Zur 2D-Übersicht wechseln"}>{show2d?"3D":"2D"}</button>
      </div>
      {!overview&&<section className="party-decision roll-decision" aria-label="Aktuelle Spielentscheidung">
        {(g.phase==="turn"||!canAct)&&<div className="roll-turn"><CharacterAvatar id={p.characterId}/><strong>{canAct?`${p.name}, du bist dran!`:`${p.name} ist am Zug`}</strong>{g.deadline>0&&<span className={seconds<=5?"is-urgent":""} aria-label={`${seconds} Sekunden verbleiben`}>{seconds}s</span>}</div>}
        {g.phase==="moving"&&g.dice.length>0&&<PartyDice values={g.dice} rolling={rolling} boost={g.boost}/>}
        {g.phase==="moving"?<p className="roll-moving" role="status">{p.name} zieht weiter · noch {g.steps} {g.steps===1?"Schritt":"Schritte"}</p>:!canAct?<p>{p.name} {g.phase==="turn"?"würfelt gleich.":g.phase==="supply"?`entscheidet über ${station?.name}.`:"entscheidet gerade."} Du kannst dein Set und die Karte ansehen.</p>:<fieldset disabled={disabled} className="roll-actions">
          {g.phase==="turn"&&<div className="roll-roll-actions"><button className={primary} onClick={()=>send({type:"roll"})}>Würfeln &amp; losziehen</button><button className="roll-stone roll-inventory" onClick={onInventory} aria-label="Dein Inventar öffnen" aria-haspopup="dialog">Items <small>{own.items.length}/3</small></button></div>}
          {g.phase==="path"&&<><h2>Welchen Weg nimmst du?</h2><p>Noch {g.steps} {g.steps===1?"Schritt":"Schritte"}. Wähle den Weg, dann bestätige.</p><div className="roll-paths party-path-choices">{paths.map((field,index)=>{const route=boardRoute(g,p,field,g.steps),s=route.stations.find(s=>!s.owned),last=route.fields.at(-1)!;return <button key={field} className="roll-path" aria-pressed={chosen===field} onClick={()=>setChoice(field)}><strong>{chosen===field?"✓ ":""}{field===goalField(g)?"Zum Jayspot":index===0?"Außenweg":"Hügelweg"}</strong><span>{s?`${s.name} in ${s.steps} ${s.steps===1?"Schritt":"Schritten"}`:route.junction?"Weitere Wegwahl":fieldName(g,last)}</span><small>{route.junction?"Vorschau bis zur nächsten Gabelung":last===goalField(g)?"Ziel erreicht":`Landung: ${FIELD_LABELS[board[last].type]}`}</small>{s&&<small>{s.price} Münzen{p.coins<s.price?` · noch ${s.price-p.coins} nötig`:""}</small>}</button>;})}</div><button className={primary} onClick={()=>send({type:"path",destination:chosen})}>Gewählten Weg nehmen</button></>}
          {g.phase==="supply"&&station&&<div className="roll-purchase"><div className="roll-purchase-heading"><p>{station.name} für dein Set · fehlt noch</p><strong>{station.price} Münzen</strong></div><button className={primary} disabled={p.coins<station.price} onClick={()=>send({type:"supply",buy:true})}>{station.name} kaufen</button><button className={secondary} onClick={()=>send({type:"supply",buy:false})}>Ohne Kauf weiter</button></div>}
          {g.phase==="shop"&&<><h2>Der Shop</h2><p>Ein Item pro Besuch</p>{p.items.length===3&&replaceControl}<div className="roll-shop">{ITEM_IDS.map(item=><button key={item} className="roll-shop-item" disabled={p.coins<ITEMS[item].price} onClick={()=>send({type:"shop",item,replace})}><strong>{ITEMS[item].name}<b>{ITEMS[item].price} ◉</b></strong><span>{ITEMS[item].description}</span>{p.coins<ITEMS[item].price&&<small>Noch {ITEMS[item].price-p.coins} Münzen nötig</small>}</button>)}</div><button className={secondary} onClick={()=>send({type:"shop"})}>Ohne Einkauf weiter</button></>}
          {g.phase==="gift"&&g.offered&&<><h2>{ITEMS[g.offered].name} für dich!</h2><p>{ITEMS[g.offered].description}</p>{p.items.length===3&&replaceControl}<button className={primary} onClick={()=>send({type:"gift",accept:true,replace})}>Geschenk annehmen</button><button className={secondary} onClick={()=>send({type:"gift",accept:false})}>Geschenk liegen lassen</button></>}
          {g.phase==="summary"&&<><p className="roll-outcome">{g.log.at(-1)?.replace(`${p.name}: `,"")??fieldName(g,p.position)}</p><button className={primary} onClick={()=>send({type:"next"})}>Nächster Zug</button></>}
        </fieldset>}
        {busy&&<p role="status">Zug wird bestätigt …</p>}{error&&<p className="error-message" role="alert">{error}</p>}
      </section>}
      <div className="party-board-roster roll-roster" aria-label="Feste Zugreihenfolge und Punktestand">{g.order.map(id=>g.players.find(q=>q.id===id)!).map(player=><button key={player.id} onClick={()=>setPanel("standings")} aria-label={`${player.name}: ${player.supplies?.length??0} von 6 Utensilien, ${player.coins} Münzen. Spielstand öffnen`} aria-current={player.id===p.id?"step":undefined}><CharacterAvatar id={player.characterId}/><span><strong>{player.name}{player.id===viewer?" · du":""}</strong><small>{player.supplies?.length??0}/6 · {player.coins} ◉{player.shield?" · Schild":""}{player.passive?" · pausiert":""}</small></span></button>)}</div>
    </div>
    <div className="party-position-announcements" aria-label="Figurenpositionen">{g.players.map(player=><output key={player.id} className="party-player-position" data-player={player.id} data-field={player.position}>{player.name}: Feld {player.position}</output>)}</div>
    {panel&&<PartyPanel title={({collection:"Dein Set",standings:"Spielstand",fields:"Felder und Figuren",field:"Feldinfo",camera:"Kamera",rules:"Roll It Up! Regeln"})[panel]} onClose={()=>setPanel(undefined)}>
      {panel==="collection"&&<Collection game={g} player={own} onShow={showField}/>}
      {panel==="standings"&&<><p>Sammle alle sechs Utensilien und erreiche zuerst den Jayspot.</p><ul className="roll-standing-list">{g.players.slice().sort((a,b)=>(b.supplies?.length??0)-(a.supplies?.length??0)||b.coins-a.coins).map(player=><li key={player.id}><CharacterAvatar id={player.characterId}/><strong>{player.name}</strong><span>{player.supplies?.length??0}/6 · {player.coins} Münzen</span></li>)}</ul></>}
      {(panel==="field"||panel==="fields")&&<><div className="party-map-caption" role="status"><strong>Feld {inspect}: {fieldName(g,inspect)}</strong><span>{inspect===goalField(g)?(hasFullSet(g,own)?"Dein Set ist komplett. Bei Ankunft gewinnst du.":`Mit vollständigem Set gewinnst du bei Ankunft. Dir fehlen noch ${missing.length} Utensilien.`):<>{inspectStation&&<>{inspectStation.name} beim Passieren für {inspectStation.price} Münzen kaufen. {own.supplies?.includes(inspect)?"Bereits in deinem Set. ":own.coins<inspectStation.price?`Dir fehlen ${inspectStation.price-own.coins} Münzen. `:""}</>}{FIELD_HELP[look.type]}</>}</span></div>{panel==="fields"&&<><div className="party-field-legend" aria-label="Feldarten">{Object.entries(FIELD_VISUALS).map(([type,look])=><span key={type}><i style={{backgroundColor:look.color,color:look.ink}}>{look.symbol}</i>{type==="start"?"Start":FIELD_LABELS[type as keyof typeof FIELD_LABELS]}</span>)}</div><div className="roll-field-list">{g.players.map(player=><button key={player.id} onClick={()=>setSelected(player.position)}>{player.name} · Feld {player.position}</button>)}{board.map(field=><button key={field.id} aria-pressed={selected===field.id} aria-label={`Feld ${field.id}: ${fieldName(g,field.id)}`} onClick={()=>setSelected(field.id)}>{field.id} {fieldName(g,field.id)}</button>)}</div><button className={secondary} onClick={()=>setPanel("rules")}>Spielregeln ansehen</button></>}</>}
      {panel==="camera"&&<><p>Ziehen zum Drehen, mit zwei Fingern zoomen. Hinweise verändern deinen Ausschnitt nicht.</p><div className="roll-camera party-camera-tools"><button className={secondary} aria-pressed={!overview} onClick={()=>camera(false)}>Zur Figur</button><button className={secondary} aria-pressed={overview} onClick={()=>camera(true)}>Ganze Schale</button><button onClick={()=>setAngle(n=>n-Math.PI/4)} aria-label="Kamera nach links drehen">↶</button><button onClick={()=>setAngle(n=>n+Math.PI/4)} aria-label="Kamera nach rechts drehen">↷</button><button disabled={zoom<=1} onClick={()=>setZoom(n=>Math.max(1,n-.5))} aria-label="Karte verkleinern">−</button><button disabled={zoom>=2.5} onClick={()=>setZoom(n=>Math.min(2.5,n+.5))} aria-label="Karte vergrößern">+</button></div></>}
      {panel==="rules"&&<><p>Sammle Grinder, Weedbud I, II und III, Pape und Filter. Fehlende Utensilien kaufst du beim Passieren der Station, wenn deine Münzen reichen.</p><p>Mit dem vollständigen Set öffnen sich die Wege zum Jayspot. Wer die Bank zuerst erreicht, gewinnt.</p><p>Nach jeder Runde spielt ihr gemeinsam ein Minispiel um Münzen. Vor dem Würfeln kannst du ein Item einsetzen. Feldwirkungen werden beim Landen ausgelöst; Start bringt beim Passieren 3 Münzen.</p></>}
    </PartyPanel>}
  </div>;
}

