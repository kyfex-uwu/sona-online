import {PositionedVisualGameElement} from "./PositionedVisualGameElement.js";
import type {SidedVisualGameElement} from "./VisualGameElement.js";
import type VisualGame from "./VisualGame.js";
import type {Side} from "../GameElement.js";
import {Euler, Quaternion, Vector3} from "three";
import CardMagnet from "./magnets/CardMagnet.js";
import type VisualCard from "./VisualCard.js";
import {SuperficialVisualCard} from "./SuperficialVisualCard.js";
import {camera} from "./clientConsts.js";

export class CrisisCounter extends PositionedVisualGameElement{
    private readonly counterCard;
    private readonly coverCard;
    private lastCrisisCount=-1;
    constructor(game:VisualGame, side:Side, position:Vector3, rotation?:Quaternion) {
        super(game, side, position, rotation??new Quaternion());

        game.addElement(this.counterCard=new SuperficialVisualCard(game, "crisis_counter.jpg", position, rotation));
        game.addElement(this.coverCard=new SuperficialVisualCard(game, "card_shape.jpg", position, rotation));
        this.coverCard.flipFacedown();
    }
    tick(){
        const crisisCount = this.game.getGame().getCrisis(this.getSide());
        if(this.lastCrisisCount === crisisCount) return;
        this.lastCrisisCount=crisisCount;

        this.coverCard.position = this.position.add(CardMagnet.offs)
            .add(new Vector3(0,0,1).multiplyScalar(23*crisisCount).add(new Vector3(0,0,10)).applyQuaternion(this.rotation));
    }
}
