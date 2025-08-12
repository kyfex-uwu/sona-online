import {Side} from "../../GameElement.js";
import {clickListener} from "../clientConsts.js";
import {updateOrder} from "../../consts.js";
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

    protected enabled: boolean;
    public getEnabled(){ return this.enabled; }

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
            enabled:true,
        }, props);
        super(side, position, props.rotation!);
        this.radius = props.radius!;
        this.hardRadius = props.hardRadius!;
        this.onClick = props.onClick!;
        this.enabled = props.enabled!;
    }

    tick(parent: VisualGame) {
        if(!this.getEnabled()) return;
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

    addToScene(scene: Scene, parent:VisualGame) {
        clickListener(()=> {
            if(!this.getEnabled()) return false;

            const dist = parent.cursorPos.distanceTo(this.position);
            if (dist <= this.radius) {
                return this.onClick(parent);
            }
            return false;
        });
    }
    visualTick(parent: VisualGame) {}
}
updateOrder[CardMagnet.name] = 1;
