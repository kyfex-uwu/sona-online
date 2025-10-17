import CardMagnet from "./CardMagnet.js";
import {Euler, Quaternion, Vector3} from "three";
import {updateOrder} from "../clientConsts.js";
import {Side} from "../../GameElement.js";
import {DrawAction} from "../../networking/Events.js";
import type VisualGame from "../VisualGame.js";
import VisualCard from "../VisualCard.js";
import {StateFeatures, VTurnState} from "../VisualGameStates.js";
import {successOrFail} from "../../networking/Server.js";
import {sideTernary} from "../../consts.js";
import type {CardWithRot} from "./RunawayMagnet.js";

export default class DeckMagnet extends CardMagnet{
    private cards:Array<CardWithRot> = [];
    //Returns a snapshot of the current cards. DOES NOT return the actual data structure, this will not update
    public getCards(){ return [...this.cards];}
    /**
     * Creates a deck magnet
     * @param side Which side this element belongs to
     * @param position The position of the card magnet
     * @param props Optional data
     * @param rotation The rotation of this magnet
     * @param enabled If this magnet is enabled. Default is false
     */
    constructor(game:VisualGame, position: Vector3, side:Side, props:{rotation?:Quaternion,enabled?:boolean}={}) {
        super(game, side, position, {
            onClick:()=>{
                if (this.game.state.hasFeatures(StateFeatures.DECK_DRAWABLE) && this.getSide() === this.game.getMySide() && this.game.selectedCard === undefined) {
                    this.game.frozen=true;
                    this.game.sendEvent(new DrawAction({})).onReply(successOrFail(()=>{
                        this.drawCard();
                        if(this.game.state instanceof VTurnState)
                            this.game.state.decrementTurn();
                    },undefined,()=>{
                        this.game.frozen=false;
                    }));
                    return true;
                }
                return false;
            },
            ...props,
        });
    }

    addCard(card:VisualCard){
        sideTernary(this.getSide(), this.game.getGame().deckA, this.game.getGame().deckB).push(card.logicalCard);

        card.position.copy(this.position);
        card.position.add(new Vector3(Math.random()*2-1,0,Math.random()*2-1));
        const rotAmt = Math.random()*0.04-0.02;
        const newRot = new Euler().setFromQuaternion(this.rotation);
        newRot.y+=rotAmt;
        card.rotation.copy(new Quaternion().setFromEuler(newRot));
        card.flipFacedown();
        this.cards.push({card, rot:rotAmt});
        this.position.add(CardMagnet.offs);
        card.setHolder(this);

        super.addCard(card);
        return true;
    }
    removeCard(card:VisualCard){
        if(this.cards.find(data=>data.card===card) === undefined) return false;
        const deck = sideTernary(this.getSide(), this.game.getGame().deckA, this.game.getGame().deckB);
        deck.splice(deck.indexOf(card.logicalCard),1);

        let index = this.cards.findIndex(data=>data.card===card);
        this.cards.splice(index,1);
        this.position.sub(CardMagnet.offs);
        for(let i=index;i<this.cards.length;i++){
            this.cards[i]?.card.position.sub(CardMagnet.offs);
        }

        return true;
    }
    shouldSnapCards(): boolean {
        return false;
    }

    /**
     * Draws a card and puts it in the player's hand
     */
    drawCard(bottom?:boolean){
        const hand = sideTernary(this.getSide(), this.game.handA, this.game.handB);
        let tempCard = this.cards[this.cards.length - 1]?.card as VisualCard;
        if(bottom) tempCard=this.cards[0]?.card as VisualCard;
        if (tempCard && this.removeCard(tempCard)) {
            tempCard.flipFaceup();
            hand.addCard(tempCard, hand.cards.length);
            return tempCard;
        }
    }

    visualTick() {
        super.visualTick();
        for(const data of this.cards){
            data.card.rotation = this.rotation.clone();
            data.card.rotation.multiply(new Quaternion().setFromEuler(new Euler(0,data.rot,0)))
        }
        this.utilityCard.position.copy(this.position).sub(CardMagnet.offs.clone().multiplyScalar(this.cards.length));
        this.utilityCard.rotation.copy(this.rotation);
        this.utilityCard.highlight(this.game.state.hasFeatures(StateFeatures.DECK_DRAWABLE) && this.getSide() === this.game.getMySide() && this.game.selectedCard === undefined);
    }
}
updateOrder[DeckMagnet.name] = CardMagnet.updateOrder;
