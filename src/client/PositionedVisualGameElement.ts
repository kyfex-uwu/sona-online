import VisualGame from "./VisualGame.js";
import type {Quaternion, Scene, Vector3} from "three";
import type {Side} from "../GameElement.js";
import type {VisualGameElement} from "./VisualGameElement.js";

export class PositionedVisualGameElement implements VisualGameElement{
    private readonly side:Side;
    public position:Vector3;
    public rotation:Quaternion;
    protected realPosition:Vector3;
    protected realRotation:Quaternion;
    constructor(side:Side, position:Vector3, rotation:Quaternion) {
        this.side=side;
        this.position = position.clone();
        this.realPosition = position.clone();
        this.rotation = rotation.clone();
        this.realRotation = rotation.clone();
    }
    visualTick(parent:VisualGame, targetLocation=this.position, targetRotation=this.rotation):void{
        this.realPosition.lerp(targetLocation,0.2);
        this.realRotation.slerp(targetRotation, 0.1);
    }

    getSide(): Side {
        return this.side;
    }

    tick(parent: VisualGame): void {}
    addToScene(scene: Scene, parent: VisualGame): void {}

    setRealPosition(pos:Vector3){
        this.realPosition=pos;
    }
    setRealRotation(rot:Quaternion){
        this.realRotation=rot;
    }
}
