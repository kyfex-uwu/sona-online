import {Quaternion, type Scene, Vector3} from "three";
import {type GameElement, Side} from "../GameElement.js";
import Game from "../Game.js";
import {clickListener, updateOrder} from "../consts.js";
import type Card from "../Card.js";

export default abstract class CardMagnet implements GameElement{
    public static readonly updateOrder = 1;
    public static readonly offs = new Vector3(0,1.5,0);

    public readonly position: Vector3;
    public readonly rotation: Quaternion;
    public readonly radius: number;
    public readonly hardRadius: number;
    private readonly onClick: (v:Game) => boolean;
    protected enabled: boolean;
    public getEnabled(){ return this.enabled; }
    private readonly side:Side;

    protected constructor(position: Vector3, side:Side, props:{
        radius?:number,
        hardRadius?:number,
        onClick?: (v:Game) => boolean,
        rotation?: Quaternion,
        enabled?:boolean,
    }={}) {
        this.side = side;
        props = Object.assign({
            radius:70,
            hardRadius:40,
            onClick:()=>false,
            rotation: new Quaternion(),
            enabled:true,
        }, props);
        this.position = position;
        this.rotation = props.rotation!;
        this.radius = props.radius!;
        this.hardRadius = props.hardRadius!;
        this.onClick = props.onClick!;
        this.enabled = props.enabled!;
    }

    tick(parent: Game) {
        if(!this.getEnabled()) return;

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
        }
    }

    abstract addCard(parent:Game, card:Card):boolean;
    abstract removeCard(parent:Game):boolean;

    addToScene(scene: Scene, parent:Game) {
        clickListener(()=> {
            if(!this.getEnabled()) return false;

            const dist = parent.cursorPos.distanceTo(this.position);
            if (dist <= this.radius) {
                return this.onClick(parent);
            }
            return false;
        });
    }
    visualTick(parent: Game) {
    }
    getSide() { return this.side; }
}
updateOrder[CardMagnet.name] = 1;
