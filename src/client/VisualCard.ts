import {
    BoxGeometry,
    CylinderGeometry,
    Euler,
    Group,
    Material,
    Mesh,
    MeshBasicMaterial,
    MirroredRepeatWrapping,
    type Object3D,
    Quaternion,
    RepeatWrapping,
    ShaderMaterial,
    Texture,
    Vector3
} from "three";
import {modelLoader, textureLoader, updateOrder} from "./clientConsts.js";
import Card, {Stat} from "../Card.js";
import type VisualGame from "./VisualGame.js";
import {PositionedVisualGameElement} from "./PositionedVisualGameElement.js";
import type {CardHoldable} from "./CardHoldable.js";
import {sideTernary, statTernary} from "../consts.js";
import {CardTriggerType} from "../CardData.js";
import SuperficialVisualCard from "./SuperficialVisualCard.js";
import type {SidedVisualGameElement} from "./VisualGameElement.js";
import type ElementScene from "./ElementScene.js";

//A *visual* card. This wraps a logical {@link Card}
export default class VisualCard extends SuperficialVisualCard implements SidedVisualGameElement{
    public readonly game;
    constructor(game:VisualGame, card: Card, position: Vector3, rotation: Quaternion = new Quaternion()) {
        super(game, card, position, rotation);
        this.game=game;
    }
    public getSide(){ return this.logicalCard.side; }

    tick() {
        if(this.game.selectedCard === this) {
            this.position = this.game.cursorPos;
            this.rotation = sideTernary(this.game.getMySide(), new Quaternion(), new Quaternion().setFromEuler(new Euler(0,Math.PI,0)));
        }

        // if(!this.enabled){
        //     (this.model?.children[0]!.children[0] as Mesh).material = this.disabledMaterial!;
        // }else{
        //     (this.model?.children[0]!.children[0] as Mesh).material = this.enabledMaterial!;
        // }
    }

    protected ifSelected(targetPos:Vector3){
        if(this.game.selectedCard === this){
            targetPos.y =
                Math.max.apply(null,this.game.elements
                    .filter(e=>e instanceof VisualCard)
                    .filter(card => card.position.distanceTo(this.position)<70)
                    .map(card => card.position.y))+10;

        }
    }

    private holder:CardHoldable|undefined=undefined;

    //@return The thing holding this card
    public getHolder(){ return this.holder; }

    /**
     * Removes the card from any old holder and put it in the new holder
     * @param holder
     */
    setHolder(holder: CardHoldable | undefined){
        this.removeFromHolder();
        this.holder=holder;
    }

    //Removes the card from its holder, if it has one
    removeFromHolder(){
        this.holder?.removeCard(this);
        this.holder=undefined;
    }

    static getExactVisualCard(obj:any){
        return obj.constructor === VisualCard ? obj : undefined;
    }
}
updateOrder[VisualCard.name] = 0;

let lock=0;
export function newHighlightLock(){
    return lock++;
}