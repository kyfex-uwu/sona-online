import VisualCardFan from "./CardFan.js";
import type {Side} from "../../GameElement.js";
import {Quaternion, type Scene, Vector3} from "three";
import VisualCard from "../VisualCard.js";
import type VisualGame from "../VisualGame.js";

export default class HandFan extends VisualCardFan{
    constructor(position:Vector3, side:Side, params:{
        rotation?:Quaternion
    }={}) {
        super(side, position, {
            onSelect:(card:VisualCard, game:VisualGame)=>this.onSelectImpl(card, game),
            ...params
        });
    }

    onSelectImpl(card:VisualCard, game:VisualGame){
        if(!this.enabled) return false;

        if(game.selectedCard !== undefined){
            if(this.cards.length<5) {
                this.cards.splice(this.cards.indexOf(card) + 1, 0, game.selectedCard);
                this.group.add(game.selectedCard.model!);
                this.recalculateCardPositions();

                game.selectedCard.setRealPosition(this.group.worldToLocal(game.selectedCard.model?.position!));
                //todo: this doesnt work vv
                game.selectedCard.setRealRotation(this.group.quaternion.clone().premultiply(game.selectedCard.model?.getWorldQuaternion(new Quaternion()).invert()!));
                game.selectedCard = undefined;
            }
        }else if(card.enabled){
            this.unchildCard(game, card);
            game.selectedCard = card;

        }
    }
}
