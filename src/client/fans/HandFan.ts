import VisualCardFan from "./CardFan.js";
import type {Side} from "../../GameElement.js";
import {Euler, Quaternion, Vector3} from "three";
import VisualCard from "../VisualCard.js";
import VisualGame from "../VisualGame.js";
import {sideTernary} from "../../consts.js";
import {game} from "../../index.js";

export default class HandFan extends VisualCardFan{
    private defaultRotation;
    private rotatedRotation;
    constructor(game:VisualGame, position:Vector3, side:Side, params:{
        rotation?:Quaternion
    }={}) {
        super(game, side, position, {
            onSelect:(card:VisualCard)=>this.onSelectImpl(card),
            ...params
        });

        this.defaultRotation = this.rotation.clone();
        this.rotatedRotation = this.defaultRotation.clone().multiply(new Quaternion().setFromEuler(new Euler(0,Math.PI,0)));
    }

    /**
     * Runs when a card is selected
     * @param card The selected card
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
        sideTernary(this.getSide(), this.game!.getGame().handA, this.game!.getGame().handB).splice(index,0,card.logicalCard);
    }
    removeCard(card: VisualCard) {
        super.removeCard(card);
        const hand = sideTernary(this.getSide(), this.game!.getGame().handA, this.game!.getGame().handB);
        hand.splice(hand.indexOf(card.logicalCard),1);
    }

    tick() {
        super.tick();

        //og-041
        const shouldShow = this.getSide() !== this.game.getMySide() &&
            sideTernary(this.getSide(), game.fieldsA, game.fieldsB).some(field=>
            field.getCard()?.logicalCard.cardData.name === "og-041");
        this.rotation = shouldShow ? this.rotatedRotation : this.defaultRotation;
    }
}
