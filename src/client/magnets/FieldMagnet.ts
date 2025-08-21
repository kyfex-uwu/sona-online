import CardMagnet from "./CardMagnet.js";
import {Quaternion, Vector3} from "three";
import {updateOrder} from "../clientConsts.js";
import {Side} from "../../GameElement.js";
import type VisualCard from "../VisualCard.js";
import type VisualGame from "../VisualGame.js";
import {PlaceAction} from "../../networking/Events.js";

export default class FieldMagnet extends CardMagnet{
    private card:VisualCard|undefined;
    public readonly which:1|2|3;
    public getCard(){ return this.card; }

    constructor(position: Vector3, side:Side, which:1|2|3, props:{rotation?:Quaternion,enabled?:boolean}={}) {
        super(side, position, {
            onClick:game=>{
                if(game.selectedCard !== undefined){
                    if(this.addCard(game, game.selectedCard)) {
                        game.sendEvent(new PlaceAction({cardId: game.selectedCard.card.id, position: this.which, side:game.getGame().side}));
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
        this.which=which;
    }

    addCard(game:VisualGame, card:VisualCard){
        if(this.card !== undefined) return false;
        this.card = card;
        this.card!.position.copy(this.position);
        this.card!.rotation.copy(this.rotation);
        this.position.add(CardMagnet.offs);
        card.setHolder(this);

        return true;
    }
    removeCard(game:VisualGame){
        if(this.card === undefined) return false;
        this.unchildCard(game, this.card);
        this.position.sub(CardMagnet.offs);

        return true;
    }
    unchildCard(game:VisualGame, card:VisualCard){
        this.card = undefined;
    }
}
updateOrder[FieldMagnet.name] = CardMagnet.updateOrder;
