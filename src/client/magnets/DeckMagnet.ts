import CardMagnet from "./CardMagnet.js";
import {Euler, Quaternion, Vector3} from "three";
import {cSideTernary, updateOrder} from "../clientConsts.js";
import {Side} from "../../GameElement.js";
import {DrawAction} from "../../networking/Events.js";
import type VisualGame from "../VisualGame.js";
import type VisualCard from "../VisualCard.js";
import {StateFeatures, VTurnState} from "../VisualGameStates.js";

export default class DeckMagnet extends CardMagnet{
    private cards:Array<VisualCard> = [];
    /**
     * Creates a deck magnet
     * @param side Which side this element belongs to
     * @param position The position of the card magnet
     * @param props Optional data
     * @param rotation The rotation of this magnet
     * @param enabled If this magnet is enabled. Default is false
     */
    constructor(position: Vector3, side:Side, props:{rotation?:Quaternion,enabled?:boolean}={}) {
        super(side, position, {
            onClick:game=>{
                if (game.state.hasFeatures(StateFeatures.DECK_DRAWABLE) && this.getSide() === game.getMySide() && game.selectedCard === undefined) {
                    this.drawCard(game);
                    game.sendEvent(new DrawAction({}));
                    if(game.state instanceof VTurnState)
                        game.state.decrementTurn();
                    return true;
                }
                return false;
            },
            ...props,
        });
    }

    addCard(game:VisualGame, card:VisualCard){
        cSideTernary(game, game.getGame().deckA, game.getGame().deckB).push(card.logicalCard);

        card.position.copy(this.position);
        card.position.add(new Vector3(Math.random()*2-1,0,Math.random()*2-1));
        const newRot = new Euler().setFromQuaternion(this.rotation);
        newRot.y+=Math.random()*0.04-0.02;
        card.rotation.copy(new Quaternion().setFromEuler(newRot));
        card.flipFacedown();
        this.cards.push(card);
        this.position.add(CardMagnet.offs);
        card.setHolder(this);

        super.addCard(game, card);
        return true;
    }
    removeCard(game:VisualGame){
        if(this.cards.length===0) return false;
        cSideTernary(game, game.getGame().deckA, game.getGame().deckB).pop();
        this.unchildCard(game, this.cards[this.cards.length-1]!);

        return true;
    }
    unchildCard(game:VisualGame, card:VisualCard){
        let index = this.cards.indexOf(card);
        if(index===-1) return;
        this.cards.splice(this.cards.indexOf(card),1);
        this.position.sub(CardMagnet.offs);
        while(this.cards[index] !== undefined){
            this.cards[index]?.position.sub(CardMagnet.offs);
            index++;
        }
    }
    shouldSnapCards(): boolean {
        return false;
    }

    /**
     * Draws a card and puts in in the player's hand
     * @param game The game this element is in
     */
    drawCard(game:VisualGame){
        const hand = cSideTernary(this.getSide(), game.handA, game.handB);
        let tempCard = this.cards[this.cards.length - 1] as VisualCard;
        if (this.removeCard(game)) {
            tempCard.flipFaceup();
            hand.addCard(game, tempCard, hand.cards.length);
            return tempCard;
        }
    }
}
updateOrder[DeckMagnet.name] = CardMagnet.updateOrder;
