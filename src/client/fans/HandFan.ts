import VisualCardFan from "./CardFan.js";
import type {Side} from "../../GameElement.js";
import {Quaternion, type Scene, Vector3} from "three";
import  VisualCard from "../VisualCard.js";
import type VisualGame from "../VisualGame.js";

export default class HandFan extends VisualCardFan{
    constructor(position:Vector3, side:Side, params:{
        rotation?:Quaternion
    }={}) {
        super(side, position, {
            onSelect:(card:VisualCard, scene:Scene, game:VisualGame)=>this.onSelectImpl(card, scene, game),
            ...params
        });
    }

    onSelectImpl(card:VisualCard, scene:Scene, parent:VisualGame){
        if(!this.enabled) return false;

        if(parent.selectedCard !== undefined){
            if(this.cards.length<5) {
                this.cards.splice(this.cards.indexOf(card) + 1, 0, parent.selectedCard);
                this.group.add(parent.selectedCard.model!);
                this.recalculateCardPositions();

                parent.selectedCard.setRealPosition(this.group.worldToLocal(parent.selectedCard.model?.position!));
                parent.selectedCard.setRealRotation(this.group.quaternion.clone().premultiply(parent.selectedCard.model?.getWorldQuaternion(new Quaternion()).invert()!));
                parent.selectedCard = undefined;
            }
        }else {
            this.cards.splice(this.cards.indexOf(card), 1);
            this.recalculateCardPositions();

            card.setRealPosition(card.model?.getWorldPosition(new Vector3())!);
            card.setRealRotation(card.model?.getWorldQuaternion(new Quaternion())!);
            card.rotation = new Quaternion();
            parent.selectedCard = card;

            scene.add(card.model!);
        }
    }

    addCard(card: VisualCard, index: number = 0) {
        super.addCard(card, index);
        console.log("bro")
    }
}
