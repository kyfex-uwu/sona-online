import {type GameElement, Side} from "./GameElement.js";
import Game from "./Game.js";
import type CardData from "./CardData.js";

export enum CardColor{
    RED,
    YELLOW,
    BLUE
}

export type CardTemplate = (side:Side)=>Card;

export default class Card implements GameElement{
    public readonly cardData: CardData;
    public readonly side:Side;
    public readonly id:number;

    constructor(cardData: CardData, side:Side, id:number) {
        this.cardData=cardData;
        this.side=side;
        this.id=id;
    }

    private faceUp = true;
    _flipFacedown(){
        this.faceUp=false;
    }
    _flipFaceup(){
        this.faceUp=true;
    }
    getSide(){ return this.side; }
    getFaceUp(){ return this.faceUp; }
}
