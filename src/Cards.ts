import CardData from "./CardData.js";

const cards:{[k:string]:CardData} = {};

for(let i=1;i<=44;i++){
    cards[`og-${i.toString().padStart(3,"0")}`] = new CardData(`og-${i.toString().padStart(3,"0")}`, [0,0,0]);
}
cards["unknown"] = new CardData("card_back", [0,0,0]);

export default cards;
