import CardMagnet from "./CardMagnet.js";
import Card from "../Card.js";
import {Euler, Quaternion, type Scene, Vector3} from "three";
import Game from "../Game.js";
import {updateOrder} from "../consts.js";


export default class RunawayMagnet extends CardMagnet{
    private cards:Array<Card> = [];

    constructor(position: Vector3) {
        super(position, {
            onClick:game=>{
                if(game.selectedCard !== undefined){
                    game.selectedCard.position.copy(this.position);
                    game.selectedCard.position.add(new Vector3(Math.random()*14-7,0,Math.random()*14-7));
                    game.selectedCard.rotation.copy(new Euler(
                        game.selectedCard.rotation.x,
                        game.selectedCard.rotation.y+Math.random()*0.3-0.15,
                        game.selectedCard.rotation.z))
                    this.cards.push(game.selectedCard);
                    game.selectedCard = undefined;
                    this.position.add(CardMagnet.offs)
                    return true;
                }else{
                    game.selectedCard = this.cards.pop();
                    if(game.selectedCard !== undefined)
                        this.position.sub(CardMagnet.offs);
                    return true;
                }
            },
        });
    }

    addToScene(scene: Scene, game:Game) {
        super.addToScene(scene, game);

        // //debug
        // this.card = new Card("1754325492309-b5bbee0a-1bc2-4bb3-b1fe-f79be3d07b3c_", new Vector3());
        // this.card.position.copy(this.position);
        // this.position.add(offs);
        // game.addElement(this.card);
    }

    tick(parent: Game) {
        super.tick(parent);

    }
}
updateOrder[RunawayMagnet.name] = CardMagnet.updateOrder;
