import {Euler, type Scene, Vector3} from "three";
import type {GameElement} from "../GameElement.js";
import Game from "../Game.js";
import {updateOrder} from "../consts.js";

let clicked=false;
window.addEventListener("mouseup", ()=>{
    clicked=true;
})

export default abstract class CardMagnet implements GameElement{
    public static readonly updateOrder = 1;
    public static readonly offs = new Vector3(0,2,0);

    public readonly position: Vector3;
    public readonly rotation: Euler;
    public readonly radius: number;
    public readonly hardRadius: number;
    private readonly onClick: (v:Game) => boolean|undefined;

    protected constructor(position: Vector3, props:{
        radius?:number,
        hardRadius?:number,
        onClick?: (v:Game) => boolean|undefined,
        rotation?: Euler,
    }={}) {
        props = Object.assign({
            radius:70,
            hardRadius:40,
            onClick:()=>false,
            rotation: new Euler(),
        }, props);
        this.position = position;
        this.rotation = props.rotation!;
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
                    parent.selectedCard!.rotation.copy(this.rotation);
                } else {
                    parent.selectedCard!.position.lerp(this.position, (this.radius - dist) / this.radius);
                }
            }
            if (clicked) {
                clicked=!(this.onClick(parent)||false);
            }
        }
    }

    addCard(parent:Game){
    }
    removeCard(parent:Game){
    }

    addToScene(scene: Scene, parent:Game) {
    }
    visualTick(parent: Game) {
        clicked=false;
    }
}
updateOrder[CardMagnet.name] = 1;
