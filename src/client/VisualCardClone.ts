import VisualCard from "./VisualCard.js";
import {Vector3} from "three";
import Card, {type MiscDataString} from "../Card.js";

export default class VisualCardClone extends VisualCard{
    private readonly clonedFrom;
    constructor(clonedFrom:VisualCard) {
        super(clonedFrom.game, {
            get cardData(){ return clonedFrom.logicalCard.cardData; },
            get side(){ return clonedFrom.logicalCard.side; },
            getSide() { return this.side; },
            get id(){ return clonedFrom.logicalCard.id; },
            get miscData(){ return {}; },//dont
            getMiscData:<T>(key:MiscDataString<T>)=>{ return clonedFrom.logicalCard.getMiscData(key);},
            setMiscData:()=>{},
            get hasAttacked(){ return clonedFrom.logicalCard.hasAttacked; },
            getFaceUp(){ return clonedFrom.logicalCard.getFaceUp(); },

            flipFacedown() {},
            flipFaceup() {},

            ...{} as any//bro
        }, new Vector3(0,0,0));

        this.clonedFrom=clonedFrom;
    }

    getReal(){
        return this.clonedFrom;
    }
    populate(card: Card) {
        super.populate(card);
        this.model.userData.card=this.clonedFrom;
    }
}
