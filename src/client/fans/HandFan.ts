import VisualCardFan from "./CardFan.js";
import type {Side} from "../../GameElement.js";
import {Quaternion, Vector3} from "three";
import VisualCard from "../VisualCard.js";
import VisualGame from "../VisualGame.js";
import {cSideTernary} from "../clientConsts.js";

export default class HandFan extends VisualCardFan{
    constructor(game:VisualGame, position:Vector3, side:Side, params:{
        rotation?:Quaternion
    }={}) {
        super(game, side, position, {
            onSelect:(card:VisualCard)=>this.onSelectImpl(card),
            ...params
        });
    }

    /**
     * Runs when a card is selected
     * @param card The selected card
     * @param game The game
     */
    private onSelectImpl(card:VisualCard){
        if(this.game !== undefined && this.getSide() === this.game.getMySide()) {
            if (this.game.selectedCard !== undefined) {
                this.addCard(this.game.selectedCard, this.cards.indexOf(card) + 1);
                this.game.selectedCard = undefined;
            } else if (this.game.state.canSelectHandCard(card)) {
                this.removeCard(card);
                this.game.selectedCard = card;
            }
        }
    }

    addCard(card: VisualCard, index: number = 0) {
        super.addCard(card, index);
        cSideTernary(this.getSide(), this.game!.getGame().handA, this.game!.getGame().handB).splice(index,0,card.logicalCard);
    }
    removeCard(card: VisualCard) {
        super.removeCard(card);
        const hand = cSideTernary(this.getSide(), this.game!.getGame().handA, this.game!.getGame().handB);
        hand.splice(hand.indexOf(card.logicalCard),1);
    }
}
