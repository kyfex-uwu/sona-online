import VisualGame from "./VisualGame.js";
import {Vector3, type Quaternion} from "three";
import type {Side} from "../GameElement.js";
import {type SidedVisualGameElement, VisualGameElement} from "./VisualGameElement.js";

//A sided game element that has a position
export abstract class PositionedVisualGameElement extends VisualGameElement implements SidedVisualGameElement{
    private readonly side:Side;
    public position:Vector3;
    public rotation:Quaternion;
    public scale: Vector3 = new Vector3(1,1,1);
    protected realPosition:Vector3;
    protected realRotation:Quaternion;
    protected realScale:Vector3 = new Vector3(1,1,1);

    /**
     * Creates a positioned game element
     * @param side Which side this element belongs to
     * @param position The starting position of this element
     * @param rotation The starting rotation of this element
     * @protected
     */
    protected constructor(game:VisualGame, side:Side, position:Vector3, rotation:Quaternion) {
        super(game);
        this.side=side;
        this.position = position.clone();
        this.realPosition = position.clone();
        this.rotation = rotation.clone();
        this.realRotation = rotation.clone();
    }

    /**
     * Run every frame, this updates the game element visually. May update while not enabled
     * @param parent VisualGame this is a part of
     * @param targetLocation Where this element should be
     * @param targetRotation How this element should be rotated
     */
    visualTick(targetLocation=this.position, targetRotation=this.rotation, targetScale=this.scale):void{
        this.realPosition.lerp(targetLocation,0.2);
        this.realRotation.slerp(targetRotation, 0.1);
        this.realScale.lerp(targetScale, 0.1);
    }

    getSide(): Side { return this.side; }

    //Sets the real position of this element (not the shown, smoothed position)
    setRealPosition(pos:Vector3){
        this.realPosition=pos;
    }
    //Sets the real rotation of this element (not the shown, smoothed rotation)
    setRealRotation(rot:Quaternion){
        this.realRotation=rot;
    }
    setRealScale(scale:Vector3){
        this.realScale=scale;
    }
}
