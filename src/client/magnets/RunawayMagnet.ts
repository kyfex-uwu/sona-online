import CardMagnet from "./CardMagnet.js";
import {Euler, Quaternion, Vector3} from "three";
import {updateOrder} from "../clientConsts.js";
import type {Side} from "../../GameElement.js";
import type VisualCard from "../VisualCard.js";
import type VisualGame from "../VisualGame.js";
import {StateFeatures} from "../VisualGameStates.js";
import {sideTernary} from "../../consts.js";


export default class RunawayMagnet extends CardMagnet{
    private cards:Array<VisualCard> = [];

    /**
     * Creates a runaway magnet
     * @param position The position of this element
     * @param side The side of this element
     * @param props Optional data
     * @param rotation The rotation of this element
     * @param enabled If this element is enabled
     */
    constructor(game:VisualGame, position: Vector3, side:Side, props:{rotation?:Quaternion,enabled?:boolean}={}) {
        super(game, side, position, {
            onClick:()=>{
                if(this.game.state.hasFeatures(StateFeatures.CAN_DISCARD_FROM_HAND) && this.game.selectedCard !== undefined && this.addCard(this.game.selectedCard)){
                    this.game.selectedCard = undefined;
                    return true;
                }else if(false){
                    let tempCard = this.cards[this.cards.length-1];
                    if(this.removeCard()) {
                        this.game.selectedCard = tempCard;
                    }
                    return true;
                }

                return false;
            },
            ...props,
        });
    }

    addCard(card:VisualCard){
        sideTernary(this.getSide(), this.game.getGame().runawayA, this.game.getGame().runawayB).push(card.logicalCard);

        card.position.copy(this.position);
        card.position.add(new Vector3(Math.random()*14-7,0,Math.random()*14-7));
        const newRot = new Euler().setFromQuaternion(this.rotation);
        newRot.y+=Math.random()*0.3-0.15;
        card.rotation.copy(new Quaternion().setFromEuler(newRot))
        this.cards.push(card);
        this.position.add(CardMagnet.offs);
        card.setHolder(this);

        super.addCard(card);
        return true;
    }
    removeCard(){
        if(this.cards.length===0) return false;
        sideTernary(this.getSide(), this.game.getGame().runawayA, this.game.getGame().runawayB).pop();
        this.unchildCard(this.cards[this.cards.length-1]!);

        return true;
    }
    unchildCard(card:VisualCard){
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
        if(!this.game) return false;
        return this.game.state.hasFeatures(StateFeatures.CAN_DISCARD_FROM_HAND) && this.game.getMySide() === this.getSide();
    }
}
updateOrder[RunawayMagnet.name] = CardMagnet.updateOrder;
