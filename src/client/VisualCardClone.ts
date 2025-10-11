import VisualCard from "./VisualCard.js";
import {Vector3} from "three";

export default class VisualCardClone extends VisualCard{
    constructor(clonedFrom:VisualCard) {
        super(clonedFrom.game, {
            get cardData(){ return clonedFrom.logicalCard.cardData; },
            get side(){ return clonedFrom.logicalCard.side; },
            getSide() { return this.side; },
            get id(){ return clonedFrom.logicalCard.id; },
            get miscData(){ return clonedFrom.logicalCard.miscData; },
            get hasAttacked(){ return clonedFrom.logicalCard.hasAttacked; },
            getFaceUp(){ return clonedFrom.logicalCard.getFaceUp(); },

            flipFacedown() {},
            flipFaceup() {},

            ...{} as any//bro
        }, new Vector3(0,0,0));
    }
}
