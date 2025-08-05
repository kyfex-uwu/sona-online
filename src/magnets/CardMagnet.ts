import {type Scene, Vector3} from "three";
import type {GameElement} from "../GameElement.js";
import Game from "../Game.js";
import {updateOrder} from "../consts.js";

let clicked=false;
window.addEventListener("mouseup", ()=>{
    clicked=true;
})

export default abstract class CardMagnet implements GameElement{
    public readonly position: Vector3;
    public readonly positionRange: Vector3;
    public readonly rotation: Vector3;
    public readonly rotationRange: Vector3;
    public readonly radius: number;
    public readonly hardRadius: number;
    private readonly onClick: (v:Game) => boolean|undefined;

    protected constructor(position: Vector3, props:{
        radius?:number,
        hardRadius?:number,
        onClick?: (v:Game) => boolean|undefined,
        positionRange?: Vector3,
        rotation?: Vector3,
        rotationRange?: Vector3,
    }={}) {
        props = Object.assign({
            radius:70,
            hardRadius:40,
            onClick:()=>false,
            positionRange: new Vector3(),
            rotation: new Vector3(),
            rotationRange: new Vector3(),
        }, props);
        this.position = position;
        this.positionRange = props.positionRange!;
        this.rotation = props.rotation!;
        this.rotationRange = props.rotationRange!;
        this.radius = props.radius!;
        this.hardRadius = props.hardRadius!;
        this.onClick = props.onClick!;
    }

    tick(parent: Game) {
        const dist = parent.cursorPos.distanceTo(this.position);
        if (dist <= this.radius) {
            if (parent.selectedCard !== undefined) {
                if (dist < this.hardRadius) {
                    parent.selectedCard!.position.copy(this.position);
                } else {
                    parent.selectedCard!.position.lerp(this.position, (this.radius - dist) / this.radius);
                }
            }
            if (clicked) {
                clicked=!(this.onClick(parent)||false);
            }
        }
    }


    addToScene(scene: Scene, parent:Game) {
    }
    visualTick(parent: Game) {
        clicked=false;
    }
}
updateOrder[CardMagnet.name] = 1;
