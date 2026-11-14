/** Die 13 freigegebenen alpha_-Modelle (klassische Figuren aus Einzelteilen). */
export const CLASSIC_CHARACTERS = [
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
/**
 * Animierte Figuren mit Skelett (Quaternius, CC0, und eigene Entwürfe); Aussehen in
 * src/three/riggedFigure.ts. Langfristig lösen sie die klassischen Figuren ab.
 */
export const RIGGED_CHARACTERS = [
  {id:"rig_jonas",name:"Jonas",color:"#b98a5e"},
  {id:"rig_amara",name:"Amara",color:"#7a4b33"},
  {id:"rig_malik",name:"Malik",color:"#5f3d2c"},
  {id:"rig_lena",name:"Lena",color:"#e0b85c"},
  {id:"rig_erik",name:"Erik",color:"#b4532a"},
  {id:"rig_zoe",name:"Zoe",color:"#e07a24"},
  {id:"rig_mc_goldie",name:"MC Goldie",color:"#ffd34d"},
  {id:"rig_lil_schmidt",name:"Lil Schmidt",color:"#8a7dff"},
  {id:"rig_kiki_komet",name:"Kiki Komet",color:"#ff86c8"},
  {id:"rig_bolt",name:"Bolt",color:"#9fb3c8"},
  {id:"rig_glubschi",name:"Glubschi",color:"#57e4cb"}
] as const;
export const CHARACTERS = [...CLASSIC_CHARACTERS, ...RIGGED_CHARACTERS] as const;
export type ClassicCharacterId=typeof CLASSIC_CHARACTERS[number]["id"];
export type RiggedCharacterId=typeof RIGGED_CHARACTERS[number]["id"];
export const isRiggedCharacter=(id:unknown):id is RiggedCharacterId=>typeof id==="string"&&RIGGED_CHARACTERS.some(c=>c.id===id);
export type CharacterId=typeof CHARACTERS[number]["id"];
export const isCharacterId=(id:unknown):id is CharacterId=>typeof id==="string"&&CHARACTERS.some(c=>c.id===id);
export const characterId=(id:unknown,index=0):CharacterId=>isCharacterId(id)?id:CHARACTERS[index%CHARACTERS.length].id;
export const characterName=(id:unknown)=>CHARACTERS.find(c=>c.id===id)?.name??"Figur wählen";
export const characterPortrait=(id:CharacterId)=>`/characters/${id}.png`;
export const randomCharacter=(random:()=>number=Math.random):CharacterId=>CHARACTERS[Math.min(CHARACTERS.length-1,Math.max(0,Math.floor(random()*CHARACTERS.length)))].id;
