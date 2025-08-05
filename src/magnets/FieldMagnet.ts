import CardMagnet from "./CardMagnet.js";
import Card from "../Card.js";
import {type Scene, Vector3} from "three";
import {updateOrder} from "../consts.js";
import  Game from "../Game.js";

export default class FieldMagnet extends CardMagnet{
    private card:Card|undefined;

    constructor(position: Vector3) {
        super(position, {
            onClick:game=>{
                if(game.selectedCard !== undefined){
                    if(this.card === undefined) {
                        this.card = game.selectedCard;
                        game.selectedCard = undefined;
                        this.card.position.copy(this.position);
                        this.position.add(CardMagnet.offs);
                        return true;
                    }
                }else{
                    if(this.card !== undefined) {
                        game.selectedCard = this.card;
                        this.card = undefined;
                        this.position.sub(CardMagnet.offs);
                        return true;
                    }
                }
            },
        });
    }

    addToScene(scene: Scene, game:Game) {
        super.addToScene(scene, game);

        //debug
        this.card = new Card("1754325492309-b5bbee0a-1bc2-4bb3-b1fe-f79be3d07b3c_", new Vector3());
        this.card.position.copy(this.position);
        this.position.add(CardMagnet.offs);
        game.addElement(this.card);
    }

    tick(parent: Game) {
        super.tick(parent);

    }
}
updateOrder[FieldMagnet.name] = CardMagnet.updateOrder;
