import type cards from "./Cards.js" ; //used for jsdocs

let globalID=0;

//The data of a card
export default class CardData{
    public readonly imagePath: string;
    public readonly stats: [number|undefined,number|undefined,number|undefined];
    public readonly id:number;
    public readonly level:1|2|3;
    public readonly name:string

    /**
     * Creates a card data
     * @param name The name of the card data (should be the same as its key in {@link cards})
     * @param stats The stats of the card: red, blue, yellow
     * @param level The level of the card
     * @param imagePath The image of the card
     */
    constructor(name:string, stats:[number|undefined,number|undefined,number|undefined], level:1|2|3, imagePath:string=name) {
        this.imagePath=imagePath;
        this.stats=stats;
        this.level=level;
        this.id=globalID++;
        this.name=name;
    }
}
