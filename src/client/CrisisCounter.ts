import {PositionedVisualGameElement} from "./PositionedVisualGameElement.js";
import type VisualGame from "./VisualGame.js";
import type {Side} from "../GameElement.js";
import {Euler, Quaternion, Vector3} from "three";
import CardMagnet from "./magnets/CardMagnet.js";
import {SuperficialVisualCard} from "./SuperficialVisualCard.js";

export class CrisisCounter extends PositionedVisualGameElement{
    private readonly counterCard;
    private readonly coverCard;
    private lastCrisisCount=-1;
    constructor(game:VisualGame, side:Side, position:Vector3, rotation?:Quaternion) {
        super(game, side, position, rotation??new Quaternion());

        game.addElement(this.counterCard=new SuperficialVisualCard(game, "crisis_counter.jpg", this.position.clone(), this.rotation));
        game.addElement(this.coverCard=new SuperficialVisualCard(game, "card_shape.jpg", this.position.clone(),
            this.rotation.multiply(new Quaternion().setFromEuler(new Euler(0,-Math.PI/2,0)))));
        this.coverCard.flipFacedown();
    }
    tick(){
        const crisisCount = this.game.getGame().getCrisis(this.getSide());
        if(this.lastCrisisCount === crisisCount) return;
        this.lastCrisisCount=crisisCount;

        this.coverCard.position = this.position.clone().add(CardMagnet.offs)
            .add(new Vector3(1,0,0).multiplyScalar(23*crisisCount).add(new Vector3(-2,0,7)).applyQuaternion(this.rotation));
    }
}
