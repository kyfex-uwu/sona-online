import CardData from "./CardData.js";

const cards:{[k:string]:CardData} = {};

for(let i=1;i<=44;i++){
    cards[`og-${i.toString().padStart(3,"0")}`] = new CardData(
        `og-${i.toString().padStart(3,"0")}`,
        [0,0,0],
        Math.floor(Math.random()*3)+1 as 1|2|3,
        `og-${i.toString().padStart(3,"0")}`);
}
cards["unknown"] = new CardData("unknown", [0,0,0], 1, "unknown");

export default cards;
