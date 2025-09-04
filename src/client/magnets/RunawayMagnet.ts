import CardMagnet from "./CardMagnet.js";
import {Euler, Quaternion, Vector3} from "three";
import {updateOrder} from "../clientConsts.js";
import type {Side} from "../../GameElement.js";
import type VisualCard from "../VisualCard.js";
import type VisualGame from "../VisualGame.js";
import {cSideTernary} from "../clientConsts.js";


export default class RunawayMagnet extends CardMagnet{
    private cards:Array<VisualCard> = [];

    constructor(position: Vector3, side:Side, props:{rotation?:Quaternion,enabled?:boolean}={}) {
        super(side, position, {
            onClick:game=>{
                if(game.selectedCard !== undefined && this.addCard(game, game.selectedCard)){
                    game.selectedCard = undefined;
                    return true;
                }else{
                    let tempCard = this.cards[this.cards.length-1];
                    if(this.removeCard(game)) {
                        game.selectedCard = tempCard;
                    }
                    return true;
                }
            },
            ...props,
        });
    }

    addCard(game:VisualGame, card:VisualCard){
        cSideTernary(game, game.getGame().runawayA, game.getGame().runawayB).push(card.card);

        card.position.copy(this.position);
        card.position.add(new Vector3(Math.random()*14-7,0,Math.random()*14-7));
        const newRot = new Euler().setFromQuaternion(this.rotation);
        newRot.y+=Math.random()*0.3-0.15;
        card.rotation.copy(new Quaternion().setFromEuler(newRot))
        this.cards.push(card);
        this.position.add(CardMagnet.offs);
        card.setHolder(this);

        super.addCard(game, card);
        return true;
    }
    removeCard(game:VisualGame){
        if(this.cards.length===0) return false;
        cSideTernary(game, game.getGame().runawayA, game.getGame().runawayB).pop();
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
}
updateOrder[RunawayMagnet.name] = CardMagnet.updateOrder;
