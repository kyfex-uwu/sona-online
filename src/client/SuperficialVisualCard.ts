import VisualCard from "./VisualCard.js";
import {type Quaternion, Vector3} from "three";
import type VisualGame from "./VisualGame.js";


export class SuperficialVisualCard extends VisualCard{
    constructor(game:VisualGame, imagePath:string, position:Vector3, rotation?:Quaternion) {
        let faceUp=true;
        super(game, {
            cardData:{imagePath},

            getSide() { return this.side; },
            getFaceUp(){ return faceUp },
            flipFacedown() {faceUp=true;},
            flipFaceup() {faceUp=false;},
            ...{} as any
        }, position, rotation);
    }
}
