import CardMagnet from "./CardMagnet.js";
import {Euler, Quaternion, Vector3} from "three";
import {sidesMatch, updateOrder} from "../../consts.js";
import {Side} from "../../GameElement.js";
import {DrawAction} from "../../networking/Events.js";
import type VisualGame from "../VisualGame.js";
import type VisualCard from "../VisualCard.js";


export default class DeckMagnet extends CardMagnet{
    private cards:Array<VisualCard> = [];

    constructor(position: Vector3, side:Side, props:{rotation?:Quaternion,enabled?:boolean}={}) {
        super(side, position, {
            onClick:game=>{
                if(!game.processingAction && sidesMatch(this.getSide(), game.currentTurn)) {
                    if (game.yourHand.cards.length < 5) {
                        this.drawCard(game);
                        game.sendEvent(new DrawAction({}));
                        return true;
                    }
                }
                return false;
            },
            ...props,
        });
    }

    addCard(game:VisualGame, card:VisualCard){
        card.position.copy(this.position);
        card.position.add(new Vector3(Math.random()*2-1,0,Math.random()*2-1));
        const newRot = new Euler().setFromQuaternion(this.rotation);
        newRot.y+=Math.random()*0.04-0.02;
        card.rotation.copy(new Quaternion().setFromEuler(newRot));
        card.flipFacedown();
        this.cards.push(card);
        this.position.add(CardMagnet.offs);

        return true;
    }
    removeCard(game:VisualGame){
        if(this.cards.length===0) return false;
        this.cards.pop();
        this.position.sub(CardMagnet.offs);

        return true;
    }

    tick(parent: VisualGame) {
        super.tick(parent);
    }

    drawCard(game:VisualGame){
        const hand = (this.getSide() == Side.YOU ? game.yourHand : game.theirHand);
        let tempCard = this.cards[this.cards.length - 1] as VisualCard;
        if (this.removeCard(game)) {
            tempCard.flipFaceup();
            hand.addCard(tempCard, hand.cards.length);
        }
    }
}
updateOrder[DeckMagnet.name] = CardMagnet.updateOrder;
