import CardMagnet from "./CardMagnet.js";
import {Euler, Quaternion, Vector3} from "three";
import {updateOrder} from "../clientConsts.js";
import type {Side} from "../../GameElement.js";
import type VisualCard from "../VisualCard.js";
import type VisualGame from "../VisualGame.js";
import {StateFeatures} from "../VisualGameStates.js";
import {sideTernary} from "../../consts.js";
import {DiscardEvent} from "../../networking/Events.js";
import {cancelCallback} from "../../networking/Server.js";

export type CardWithRot = {card:VisualCard,rot:number}
export default class RunawayMagnet extends CardMagnet{
    private cards:Array<CardWithRot> = [];

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
                    this.game.frozen=true;
                    const card = this.game.selectedCard;
                    this.game.selectedCard = undefined;
                    this.game.sendEvent(new DiscardEvent({which:card.logicalCard.id})).onReply(cancelCallback(()=>{
                        this.removeCard();
                        this.game.selectedCard = card;
                    },()=>{
                        this.game.frozen=false;
                    }));
                    return true;
                }else if(false){
                    let tempCard = this.cards[this.cards.length-1];
                    if(this.removeCard()) {
                        this.game.selectedCard = tempCard?.card;
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
        const rotAmt = (Math.random()*0.3-0.15)*5;
        const newRot = new Euler().setFromQuaternion(this.rotation);
        newRot.y+=rotAmt;
        card.rotation.copy(new Quaternion().setFromEuler(newRot))
        this.cards.push({card,rot:rotAmt});
        this.position.add(CardMagnet.offs);
        card.setHolder(this);

        super.addCard(card);
        return true;
    }
    removeCard(){
        if(this.cards.length===0) return false;
        sideTernary(this.getSide(), this.game.getGame().runawayA, this.game.getGame().runawayB).pop();

        let index = this.cards.length-1;
        this.cards.splice(index,1);
        this.position.sub(CardMagnet.offs);
        for(let i=index;i<this.cards.length;i++){
            this.cards[i]?.card.position.sub(CardMagnet.offs);
        }

        return true;
    }
    shouldSnapCards(): boolean {
        if(!this.game) return false;
        return this.game.state.hasFeatures(StateFeatures.CAN_DISCARD_FROM_HAND) && this.game.getMySide() === this.getSide();
    }

    visualTick() {
        super.visualTick();
        for(const data of this.cards){
            data.card.rotation = this.rotation.clone();
            data.card.rotation.y+=data.rot;
        }
        this.utilityCard.position.copy(this.position).sub(CardMagnet.offs.clone().multiplyScalar(this.cards.length));
        this.utilityCard.highlight(this.game.state.hasFeatures(StateFeatures.CAN_DISCARD_FROM_HAND) && this.getSide() === this.game.getMySide());
    }
}
updateOrder[RunawayMagnet.name] = CardMagnet.updateOrder;
