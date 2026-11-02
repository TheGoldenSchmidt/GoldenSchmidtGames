const ROTATIONS = ["", "rotateX(0deg) rotateY(0deg)", "rotateX(0deg) rotateY(-90deg)", "rotateX(-90deg) rotateY(0deg)", "rotateX(90deg) rotateY(0deg)", "rotateX(0deg) rotateY(90deg)", "rotateX(180deg) rotateY(0deg)"];

export function PartyDice({values,rolling=false,boost=0}:{values:number[];rolling?:boolean;boost?:number}) {
  const dice=values.length?values:[1];
  return <div className={`party-dice-tray ${rolling?"is-rolling":""} ${values.length?"has-result":""}`} role="img" aria-label={values.length?`Würfelergebnis: ${values.join(" und ")}${boost?`, plus ${boost}`:""}`:"Würfel bereit"}>
    <div className="party-dice-shadow"/>
    {dice.map((value,i)=><div className="party-die-space" key={i}><div className="party-die-tumble"><div className="party-cube" style={{transform:ROTATIONS[value]}}>{[1,2,3,4,5,6].map(face=><div key={face} className={`party-cube-face party-cube-face--${face}`} aria-hidden="true">{Array.from({length:9},(_,pip)=><i key={pip} className={([[],[4],[0,8],[0,4,8],[0,2,6,8],[0,2,4,6,8],[0,2,3,5,6,8]][face]).includes(pip)?"is-pip":""}/>)}</div>)}</div></div></div>)}
    {boost>0&&<b className="party-dice-boost">+{boost}</b>}
    {values.length>0&&!rolling&&<strong className="party-dice-total">{values.reduce((a,b)=>a+b,0)+boost}<small>Schritte</small></strong>}
  </div>;
}
