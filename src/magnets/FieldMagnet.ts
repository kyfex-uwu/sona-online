import CardMagnet from "./CardMagnet.js";
import Card from "../Card.js";
import {type Euler, type Scene, Vector3} from "three";
import {updateOrder} from "../consts.js";
import  Game from "../Game.js";

export default class FieldMagnet extends CardMagnet{
    private card:Card|undefined;

    constructor(position: Vector3, props:{rotation?:Euler}={}) {
        super(position, {
            onClick:game=>{
                if(game.selectedCard !== undefined){
                    if(this.card === undefined) {
                        this.addCard(game);
                        return true;
                    }
                }else{
                    if(this.card !== undefined) {
                        this.removeCard(game);
                        return true;
                    }
                }
            },
            ...props,
        });
    }

    addToScene(scene: Scene, game:Game) {
        super.addToScene(scene, game);

        //debug
        const card = new Card("1754325492309-b5bbee0a-1bc2-4bb3-b1fe-f79be3d07b3c_", new Vector3());
        game.selectedCard = card;
        game.addElement(card);
        this.addCard(game);
    }

    addCard(game:Game){
        this.card = game.selectedCard;
        game.selectedCard = undefined;
        this.card!.position.copy(this.position);
        this.card!.rotation.copy(this.rotation);
        this.position.add(CardMagnet.offs);
    }
    removeCard(game:Game){
        game.selectedCard = this.card;
        this.card = undefined;
        this.position.sub(CardMagnet.offs);
    }
}
updateOrder[FieldMagnet.name] = CardMagnet.updateOrder;
