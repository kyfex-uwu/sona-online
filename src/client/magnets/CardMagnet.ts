import {Side} from "../../GameElement.js";
import {clickListener, removeClickListener, updateOrder} from "../clientConsts.js";
import {Quaternion, type Scene, Vector3} from "three";
import {PositionedVisualGameElement} from "../PositionedVisualGameElement.js";
import VisualGame from "../VisualGame.js";
import VisualCard from "../VisualCard.js";
import type {CardHoldable} from "../CardHoldable.js";

//A game element that holds and attracts cards
export default abstract class CardMagnet extends PositionedVisualGameElement implements CardHoldable{
    private readonly radius:number;
    private readonly hardRadius:number;
    private readonly onClick:(v:VisualGame)=>boolean;

    public static readonly updateOrder = 1;
    public static readonly offs = new Vector3(0,1.5,0);

    /**
     * Creates a card magnet
     * @param side Which side this element belongs to
     * @param position The position of the card magnet
     * @param props Optional data
     * @param radius The radius in which a card will float towards this element. Default is 70
     * @param hardRadius The radius in which a card will snap on this element. Default is 40
     * @param onClick The function to run when this is clicked
     * @param rotation The rotation of this element
     * @param enabled If this element is enabled. Default is false
     * @protected
     */
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

    addCard(game:VisualGame, card:VisualCard){
        return true;
    }
    abstract removeCard(parent:VisualGame):boolean;
    private listener:number=-1;
    addToGame(game:VisualGame) {
        super.addToGame(game);
        this.listener = clickListener(()=> {
            if(!this.enabled) return false;

            const dist = game.cursorPos.distanceTo(this.position);
            if (dist <= this.radius) {
                return this.onClick(game);
            }
            return false;
        });
    }
    removeFromGame() {
        super.removeFromGame();
        removeClickListener(this.listener);
    }

    visualTick(parent: VisualGame) {}

    abstract unchildCard(game: VisualGame, card: VisualCard):void;
}
updateOrder[CardMagnet.name] = 1;
