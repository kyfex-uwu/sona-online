import VisualCardFan from "./CardFan.js";
import type {Side} from "../../GameElement.js";
import {Quaternion, Vector3} from "three";
import VisualCard from "../VisualCard.js";
import VisualGame from "../VisualGame.js";
import {cSideTernary} from "../clientConsts.js";

export default class HandFan extends VisualCardFan{
    constructor(position:Vector3, side:Side, params:{
        rotation?:Quaternion
    }={}) {
        super(side, position, {
            onSelect:(card:VisualCard, game:VisualGame)=>this.onSelectImpl(card, game),
            ...params
        });
    }

    /**
     * Runs when a card is selected
     * @param card The selected card
     * @param game The game
     */
    private onSelectImpl(card:VisualCard, game:VisualGame){
        if(!this.enabled) return false;

        if(game.selectedCard !== undefined){
            this.addCard(game, game.selectedCard, this.cards.indexOf(card) + 1);
            game.selectedCard = undefined;
        }else if(card.enabled){
            this.removeCard(game, card);
            game.selectedCard = card;

        }
    }

    addCard(game: VisualGame, card: VisualCard, index: number = 0) {
        super.addCard(game, card, index);
        cSideTernary(this.getSide(), game.getGame().handA, game.getGame().handB).splice(index,0,card.card);
    }
    removeCard(game: VisualGame, card: VisualCard) {
        super.removeCard(game, card);
        const hand = cSideTernary(this.getSide(), game.getGame().handA, game.getGame().handB);
        hand.splice(hand.indexOf(card.card),1);
    }
}
