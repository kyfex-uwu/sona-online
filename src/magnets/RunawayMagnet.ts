import CardMagnet from "./CardMagnet.js";
import Card from "../Card.js";
import {Euler, Quaternion, Vector3} from "three";
import Game from "../Game.js";
import {updateOrder} from "../consts.js";


export default class RunawayMagnet extends CardMagnet{
    private cards:Array<Card> = [];

    constructor(position: Vector3, props:{rotation?:Quaternion,enabled?:boolean}={}) {
        super(position, {
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

    addCard(game:Game, card:Card){
        card.position.copy(this.position);
        card.position.add(new Vector3(Math.random()*14-7,0,Math.random()*14-7));
        const newRot = new Euler().setFromQuaternion(this.rotation);
        newRot.y+=Math.random()*0.3-0.15;
        card.rotation.copy(new Quaternion().setFromEuler(newRot))
        this.cards.push(card);
        this.position.add(CardMagnet.offs);

        return true;
    }
    removeCard(game:Game){
        if(this.cards.length===0) return false;
        this.cards.pop();
        this.position.sub(CardMagnet.offs);

        return true;
    }
}
updateOrder[RunawayMagnet.name] = CardMagnet.updateOrder;
