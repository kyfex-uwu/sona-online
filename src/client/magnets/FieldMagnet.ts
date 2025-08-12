import CardMagnet from "./CardMagnet.js";
import {Quaternion, Vector3} from "three";
import {updateOrder} from "../clientConsts.js";
import type {Side} from "../../GameElement.js";
import type VisualCard from "../VisualCard.js";
import type VisualGame from "../VisualGame.js";

export default class FieldMagnet extends CardMagnet{
    private card:VisualCard|undefined;

    constructor(position: Vector3, side:Side, props:{rotation?:Quaternion,enabled?:boolean}={}) {
        super(side, position, {
            onClick:game=>{
                if(game.selectedCard !== undefined){
                    if(this.addCard(game, game.selectedCard)) {
                        game.selectedCard = undefined;
                        return true;
                    }
                }else{
                    let tempCard = this.card;
                    if(this.removeCard(game)) {
                        game.selectedCard = tempCard;
                        return true;
                    }
                }

                return false;
            },
            ...props,
        });
    }

    addCard(game:VisualGame, card:VisualCard){
        if(this.card !== undefined) return false;
        this.card = card;
        this.card!.position.copy(this.position);
        this.card!.rotation.copy(this.rotation);
        this.position.add(CardMagnet.offs);

        return true;
    }
    removeCard(game:VisualGame){
        if(this.card === undefined) return false;
        this.card = undefined;
        this.position.sub(CardMagnet.offs);

        return true;
    }
    getEnabled(){
        return this.card === undefined && this.enabled;
    }
}
updateOrder[FieldMagnet.name] = CardMagnet.updateOrder;
