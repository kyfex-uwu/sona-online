import VisualCardFan from "./CardFan.js";
import type {Side} from "../../GameElement.js";
import {Quaternion, type Scene, Vector3} from "three";
import VisualCard from "../VisualCard.js";
import  VisualGame from "../VisualGame.js";
import {sideTernary} from "../../consts.js";

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
                this.addCard(game, game.selectedCard, this.cards.indexOf(card) + 1);
                game.selectedCard = undefined;
            }
        }else if(card.enabled){
            this.removeCard(game, this.cards.indexOf(card));
            game.selectedCard = card;

        }
    }

    addCard(game: VisualGame, card: VisualCard, index: number = 0) {
        super.addCard(game, card, index);
        sideTernary(game.getGame().side, game.getGame().handA, game.getGame().handB).splice(index,0,card.card);
    }
}
