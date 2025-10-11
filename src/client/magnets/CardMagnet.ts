import {Side} from "../../GameElement.js";
import {clickListener, removeClickListener, updateOrder} from "../clientConsts.js";
import {Quaternion, Vector3} from "three";
import {PositionedVisualGameElement} from "../PositionedVisualGameElement.js";
import VisualGame from "../VisualGame.js";
import VisualCard from "../VisualCard.js";
import type {CardHoldable} from "../CardHoldable.js";
import Card from "../../Card.js";
import cards from "../../Cards.js";

//A game element that holds and attracts cards
export default abstract class CardMagnet extends PositionedVisualGameElement implements CardHoldable{
    private readonly radius:number;
    private readonly hardRadius:number;
    private readonly onClick:()=>boolean;

    public static readonly updateOrder = 1;
    public static readonly offs = new Vector3(0,1.5,0);

    protected readonly utilityCard;

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
    protected constructor(game:VisualGame, side:Side, position:Vector3, props:{
        radius?:number,
        hardRadius?:number,
        onClick?: () => boolean,
        rotation?: Quaternion,
    }={}) {
        props = Object.assign({
            radius:70,
            hardRadius:40,
            onClick:()=>false,
            rotation: new Quaternion(),
        }, props);
        super(game, side, position, props.rotation!);
        this.radius = props.radius!;
        this.hardRadius = props.hardRadius!;
        this.onClick = props.onClick!;

        this.listener = clickListener(()=> {
            if(this.game.frozen) return false;

            const dist = this.game.cursorPos.distanceTo(this.position);
            if (dist <= this.radius) {
                return this.onClick();
            }
            return false;
        });

        this.utilityCard = game.addElement(new VisualCard(game,new Card(cards["utility"]!,Side.A, -1),this.position, this.rotation));
    }

    //If this magnet should visually snap cards towards it. Should be false if you cant place cards there
    abstract shouldSnapCards():boolean;
    tick() {
        if(this.shouldSnapCards()) {
            const dist = this.game.cursorPos.distanceTo(this.position);
            if (dist <= this.radius) {
                if (this.game.selectedCard !== undefined) {
                    if (dist < this.hardRadius) {
                        this.game.selectedCard!.position.copy(this.position);
                        this.game.selectedCard!.rotation.copy(this.rotation);
                    } else {
                        this.game.selectedCard!.position.lerp(this.position, (this.radius - dist) / this.radius);
                    }
                }
            }
        }
    }

    addCard(card:VisualCard){
        return true;
    }
    abstract removeCard(card:VisualCard):boolean;
    private listener:number=-1;
    removeFromGame() {
        super.removeFromGame();
        removeClickListener(this.listener);
    }

    visualTick() {
        super.visualTick();
        this.utilityCard.position.copy(this.position);
        this.utilityCard.rotation.copy(this.rotation);
    }

    abstract unchildCard(card: VisualCard):void;
}
updateOrder[CardMagnet.name] = 1;
