/** Kleine gemeinsame Liste: Der Server akzeptiert ausschließlich bekannte Figuren. */
export const CHARACTERS = [
  { id: "rick_sanchez_3", name: "Rick", color: "#69b6cf" },
  { id: "morty_smith", name: "Morty", color: "#f6ea61" },
  { id: "eric_cartman_3", name: "Cartman", color: "#bd2826" },
  { id: "stan_marsh", name: "Stan", color: "#4277ab" },
  { id: "kyle_broflovski", name: "Kyle", color: "#53a64e" },
  { id: "kenny_mccormick", name: "Kenny", color: "#e68531" },
  { id: "butters_stotch", name: "Butters", color: "#71c7b2" },
  { id: "korvo_3", name: "Korvo", color: "#79b8de" },
  { id: "terry_solar_opposites", name: "Terry", color: "#9cc35d" },
  { id: "pupa", name: "Pupa", color: "#e6cb52" },
  { id: "ritter", name: "Ritter", color: "#3b6ea5" },
  { id: "rekrut", name: "Rekrut", color: "#ad896a" }
] as const;
export type CharacterId = typeof CHARACTERS[number]["id"];
export const isCharacterId = (id: unknown): id is CharacterId => typeof id === "string" && CHARACTERS.some(c => c.id === id);
export const characterId = (id: unknown, index = 0): CharacterId => isCharacterId(id) ? id : CHARACTERS[index % CHARACTERS.length].id;
