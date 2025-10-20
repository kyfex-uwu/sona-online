import {type GameElement, Side} from "./GameElement.js";
import type CardData from "./CardData.js";

//Which stat on a card
export enum Stat{
    RED,
    BLUE,
    YELLOW
}
export function getVictim(stat:Stat){
    switch(stat){
        case Stat.RED: return Stat.YELLOW;
        case Stat.BLUE: return Stat.RED;
        case Stat.YELLOW: return Stat.BLUE;
    }
}
export function getAttacker(stat:Stat){
    switch(stat){
        case Stat.RED: return Stat.BLUE;
        case Stat.BLUE: return Stat.YELLOW;
        case Stat.YELLOW: return Stat.RED;
    }
}

export type MiscDataString<T> = {};
export const MiscDataStrings = {
    TRASH_PANDA_IMMUNITY: "og-011_immunity" as MiscDataString<"wait"|"immune"|"not immune">,
};

//A *logical* card
export default class Card implements GameElement{
    public readonly cardData: CardData;
    public readonly side:Side;
    public readonly id:number;

    private miscData: { [k: string]: any } = {};
    public getMiscData<T>(key:MiscDataString<T>){ return this.miscData[key as string] as T; }
    public setMiscData<T>(key:MiscDataString<T>, val: T){ this.miscData[key as string]=val; }
    public hasAttacked=false;

    /**
     * Creates a logical card
     * @param cardData The card data
     * @param side Which side the card belongs to
     * @param id The id of the card (should be unique per game)
     */
    constructor(cardData: CardData, side:Side, id:number) {
        this.cardData=cardData;
        this.side=side;
        this.id=id;
    }

    private faceUp = true;
    //Flips the logical card facedown
    flipFacedown(){
        this.faceUp=false;
    }
    //Flips the logical card faceup
    flipFaceup(){
        this.faceUp=true;
    }
    //Returns this card's side
    getSide(){ return this.side; }
    //Returns if this card is face up
    getFaceUp(){ return this.faceUp; }
}
