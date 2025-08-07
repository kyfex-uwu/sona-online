import Card, {type CardTemplate} from "./Card.js";

const cards:{[k:string]:(id:number)=>CardTemplate} = {};

for(let i=1;i<=44;i++){
    cards[`og-${i.toString().padStart(3,"0")}`] = Card.template(`og-${i.toString().padStart(3,"0")}`);
}

export default cards;
