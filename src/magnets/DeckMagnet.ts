import CardMagnet from "./CardMagnet.js";
import Card from "../Card.js";
import {Euler, Quaternion, type Scene, Vector3} from "three";
import Game from "../Game.js";
import {updateOrder} from "../consts.js";


export default class DeckMagnet extends CardMagnet{
    private cards:Array<Card> = [];

    constructor(position: Vector3, props:{rotation?:Euler}={}) {
        super(position, {
            onClick:game=>{
                if(game.selectedCard !== undefined){
                    this.addCard(game);
                    return true;
                }else{
                    this.removeCard(game);
                    return true;
                }
            },
            ...props,
        });
    }

    addCard(game:Game){
        game.selectedCard!.position.copy(this.position);
        game.selectedCard!.flipFacedown();
        this.cards.push(game.selectedCard!);
        game.selectedCard = undefined;
        this.position.add(CardMagnet.offs);
    }
    removeCard(game:Game){
        game.selectedCard = this.cards.pop();
        if(game.selectedCard !== undefined) {
            game.selectedCard.flipFaceup();
            this.position.sub(CardMagnet.offs);
        }
    }
}
updateOrder[DeckMagnet.name] = CardMagnet.updateOrder;
