/** Ausschließlich die freigegebenen alpha_-Modelle. */
export const CHARACTERS = [
  {id:"alpha_rick_prime",name:"Prime Rick",color:"#69b6cf"},
  {id:"alpha_morty_smith",name:"Morty Smith",color:"#f6ea61"},
  {id:"alpha_summer_smith",name:"Summer Smith",color:"#db8a53"},
  {id:"alpha_jerry_smith",name:"Jerry Smith",color:"#698c57"},
  {id:"alpha_mr_nimbus",name:"Mr Nimbus",color:"#588bc5"},
  {id:"alpha_scary_terry",name:"Scary Terry",color:"#984e50"},
  {id:"alpha_mr_poopybutthole",name:"Mr Poopybutthole",color:"#dfc658"},
  {id:"alpha_captain_diabetes",name:"Captain Diabetes",color:"#b52e3b"},
  {id:"alpha_doctor_timothy",name:"Doctor Timothy",color:"#79598e"},
  {id:"alpha_the_coon",name:"The Coon",color:"#5d655c"},
  {id:"alpha_eric_cartman",name:"Eric Cartman",color:"#bd2826"},
  {id:"alpha_pupa",name:"Pupa",color:"#e6cb52"},
  {id:"alpha_korvo",name:"Korvo",color:"#79b8de"}
] as const;
export type CharacterId=typeof CHARACTERS[number]["id"];
export const isCharacterId=(id:unknown):id is CharacterId=>typeof id==="string"&&CHARACTERS.some(c=>c.id===id);
export const characterId=(id:unknown,index=0):CharacterId=>isCharacterId(id)?id:CHARACTERS[index%CHARACTERS.length].id;
export const characterName=(id:unknown)=>CHARACTERS.find(c=>c.id===id)?.name??"Figur wählen";
export const characterPortrait=(id:CharacterId)=>`/characters/${id}.png`;
export const randomCharacter=(random:()=>number=Math.random):CharacterId=>CHARACTERS[Math.min(CHARACTERS.length-1,Math.max(0,Math.floor(random()*CHARACTERS.length)))].id;
