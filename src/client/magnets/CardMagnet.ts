import {Side} from "../../GameElement.js";
import {clickListener, removeClickListener, updateOrder} from "../clientConsts.js";
import {Quaternion, type Scene, Vector3} from "three";
import {PositionedVisualGameElement} from "../PositionedVisualGameElement.js";
import type VisualGame from "../VisualGame.js";
import type VisualCard from "../VisualCard.js";

export default abstract class CardMagnet extends PositionedVisualGameElement{
    private readonly radius:number;
    private readonly hardRadius:number;
    private readonly onClick:(v:VisualGame)=>boolean;

    public static readonly updateOrder = 1;
    public static readonly offs = new Vector3(0,1.5,0);

    public enabled: boolean;

    protected constructor(side:Side, position:Vector3, props:{
        radius?:number,
        hardRadius?:number,
        onClick?: (v:VisualGame) => boolean,
        rotation?: Quaternion,
        enabled?:boolean,
    }={}) {
        props = Object.assign({
            radius:70,
            hardRadius:40,
            onClick:()=>false,
            rotation: new Quaternion(),
            enabled:false,
        }, props);
        super(side, position, props.rotation!);
        this.radius = props.radius!;
        this.hardRadius = props.hardRadius!;
        this.onClick = props.onClick!;
        this.enabled = props.enabled!;
    }

    tick(parent: VisualGame) {
        if(!this.enabled) return;
        super.tick(parent);

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

    abstract addCard(parent:VisualGame, card:VisualCard):boolean;
    abstract removeCard(parent:VisualGame):boolean;
    private listener:number=-1;
    addToScene(scene: Scene, parent:VisualGame) {
        this.listener = clickListener(()=> {
            if(!this.enabled) return false;

            const dist = parent.cursorPos.distanceTo(this.position);
            if (dist <= this.radius) {
                return this.onClick(parent);
            }
            return false;
        });
    }
    removeFromScene() {
        removeClickListener(this.listener);
    }

    visualTick(parent: VisualGame) {}
}
updateOrder[CardMagnet.name] = 1;
