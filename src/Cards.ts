import CardData from "./CardData.js";

const cards:{[k:string]:CardData} = {};

const setCard = (data:CardData) => cards[data.name] = data;

setCard(new CardData("og-021", [2,1,8], 1));
setCard(new CardData("og-017", [5,3,undefined], 1));
setCard(new CardData("og-005", [2,2,2], 1));
setCard(new CardData("og-037", [1,8,2], 1));
setCard(new CardData("og-016", [8,2,1], 1));
setCard(new CardData("og-009", [2,2,2], 1));
setCard(new CardData("og-011", [1,3,1], 1));
setCard(new CardData("og-041", [1,1,1], 1));
setCard(new CardData("og-018", [3,1,undefined], 1));
setCard(new CardData("og-007", [2,1,undefined], 1));
setCard(new CardData("og-043", [2,2,2], 1));
setCard(new CardData("og-033", [2,undefined,1], 1));
setCard(new CardData("og-010", [1,2,undefined], 1));
setCard(new CardData("og-006", [undefined,2,1], 1));
setCard(new CardData("og-034", [undefined,5,7], 2));
setCard(new CardData("og-012", [1,1,1], 1));
setCard(new CardData("og-024", [3,1,2], 1));
setCard(new CardData("og-025", [1,3,2], 1));
setCard(new CardData("og-008", [1,undefined,2], 1));
setCard(new CardData("og-019", [undefined,3,5], 1));
setCard(new CardData("og-022", [undefined,1,3], 1));
setCard(new CardData("og-030", [3,5,6], 2));
setCard(new CardData("og-013", [undefined,1,2], 1));
setCard(new CardData("og-044", [2,2,2], 2));
setCard(new CardData("og-002", [9,7,5], 3));
setCard(new CardData("og-028", [4,4,3], 2));
setCard(new CardData("og-039", [5,7,undefined], 2));
setCard(new CardData("og-003", [3,3,3], 3));
setCard(new CardData("og-014", [4,5,3], 2));
setCard(new CardData("og-036", [7,undefined,5], 2));
setCard(new CardData("og-027", [6,3,5], 2));
setCard(new CardData("og-004", [7,9,5], 3));
setCard(new CardData("og-031", [3,4,7], 2));
setCard(new CardData("og-038", [6,5,8], 3));
setCard(new CardData("og-001", [5,5,5], 3));
setCard(new CardData("og-040", [undefined,undefined,5], 2));
setCard(new CardData("og-020", [3,undefined,2], 1));
setCard(new CardData("og-026", [undefined,5,undefined], 2));
setCard(new CardData("og-015", [5,6,5], 3));
setCard(new CardData("og-035", [3,3,3], 2));
setCard(new CardData("og-023", [5,undefined,undefined], 2));
setCard(new CardData("og-042", [2,2,2], 1));
setCard(new CardData("og-029", [5,6,3], 2));
setCard(new CardData("og-032", [4,3,7], 2));
setCard(new CardData("og-002", [9,7,5], 3));

setCard(new CardData("unknown", [0,0,0], 1));

export default cards;
