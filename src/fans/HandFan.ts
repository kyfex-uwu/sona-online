import CardFan from "./CardFan.js";
import {Quaternion, type Scene, Vector3} from "three";
import type Card from "../Card.js";
import type Game from "../Game.js";
import type {Side} from "../GameElement.js";


export default class HandFan extends CardFan{
    constructor(position:Vector3, side:Side, params:{
        rotation?:Quaternion
    }={}) {
        super(position, side, {
            onSelect:(card:Card, scene:Scene, game:Game)=>this.onSelectImpl(card, scene, game),
            ...params
        });
    }

    onSelectImpl(card:Card, scene:Scene, parent:Game){
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
}
